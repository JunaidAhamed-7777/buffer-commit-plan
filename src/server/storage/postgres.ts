import pg from "pg";
import type { PoolClient } from "pg";
import { WorkspaceQueries, workspaceSchema } from "./store.ts";
import type { WorkspaceStorage } from "./store.ts";

const lock = "SELECT pg_advisory_xact_lock(33894, 1760317)";
const schema = `
  ${workspaceSchema("postgres")}
  CREATE OR REPLACE FUNCTION invalidate_write_checks() RETURNS trigger LANGUAGE plpgsql AS $body$
  BEGIN
    DELETE FROM write_checks WHERE organization_id = NEW.organization_id AND post_id = NEW.post_id;
    RETURN NEW;
  END;
  $body$;
  CREATE OR REPLACE TRIGGER invalidate_write_checks
  AFTER INSERT ON write_guards FOR EACH ROW EXECUTE FUNCTION invalidate_write_checks();
`;

export class PostgresWorkspaceStore<State> extends WorkspaceQueries<State> implements WorkspaceStorage<State> {
  readonly #pool: pg.Pool;
  readonly #ready: () => Promise<void>;

  constructor(databaseUrl: string, localTest = false) {
    const url = new URL(databaseUrl);
    // Require normal certificate and hostname validation for a hosted database.
    // Connection-string SSL options would otherwise override the TLS configuration.
    for (const name of ["ssl", "sslmode", "sslcert", "sslkey", "sslrootcert", "uselibpqcompat"]) url.searchParams.delete(name);
    const local = localTest && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    const pool = new pg.Pool({
      connectionString: url.href,
      ssl: local ? false : { rejectUnauthorized: true },
      enableChannelBinding: !local,
      max: 4,
      idleTimeoutMillis: 5_000,
      connectionTimeoutMillis: 10_000,
      query_timeout: 15_000,
      allowExitOnIdle: true,
    });
    // A dropped idle socket should not crash a warm serverless instance.
    pool.on("error", () => {});
    let schemaReady: Promise<void> | undefined;
    function ready(): Promise<void> {
      return schemaReady ??= transaction(pool, async client => {
        await client.query(schema);
      }).catch((error: unknown) => {
        schemaReady = undefined;
        throw error;
      });
    }
    super(async (sql, values) => {
      await ready();
      const result = await pool.query(sql, values);
      return { rows: result.rows, changes: result.rowCount ?? 0 };
    });
    this.#pool = pool;
    this.#ready = ready;
  }

  async transaction<T>(work: (transaction: WorkspaceQueries<State>) => Promise<T>): Promise<T> {
    await this.#ready();
    return transaction(this.#pool, client => work(new WorkspaceQueries(async (sql, values) => {
      const result = await client.query(sql, values);
      return { rows: result.rows, changes: result.rowCount ?? 0 };
    })));
  }

  close(): Promise<void> {
    return this.#pool.end();
  }
}

async function transaction<T>(pool: pg.Pool, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  let discard = false;
  try {
    await client.query(`
      BEGIN;
      SET LOCAL lock_timeout = '5s';
      SET LOCAL statement_timeout = '10s';
      SET LOCAL idle_in_transaction_session_timeout = '15s';
    `);
    // Match SQLite's BEGIN IMMEDIATE across instances. Work in this lock is
    // limited to database reads and writes. Provider requests run outside it.
    await client.query(lock);
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try { await client.query("ROLLBACK"); }
    catch { discard = true; }
    throw error;
  } finally {
    client.release(discard);
  }
}
