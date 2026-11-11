import { createHash } from "node:crypto";
import { chmodSync, closeSync, mkdirSync, openSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

export type Session = {
  workspaceKey: string;
  expiresAt: number;
  accountId?: string;
  organizations?: { id: string; name: string }[];
  token?: string;
};

export type OAuthAttempt = { state: string; verifier: string; expiresAt: number };

type Value = string | number;
export type QueryResult = { rows: Record<string, unknown>[]; changes: number };
type Query = (sql: string, values: Value[]) => QueryResult | Promise<QueryResult>;

export function workspaceSchema(dialect: "sqlite" | "postgres"): string {
  const integer = dialect === "sqlite" ? "INTEGER" : "BIGINT";
  const strict = dialect === "sqlite" ? " STRICT" : "";
  return `
    CREATE TABLE IF NOT EXISTS workspaces (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      expires_at ${integer} NOT NULL
    )${strict};

    CREATE TABLE IF NOT EXISTS sessions (
      id_hash TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      expires_at ${integer} NOT NULL
    )${strict};

    CREATE TABLE IF NOT EXISTS oauth_attempts (
      session_hash TEXT PRIMARY KEY REFERENCES sessions(id_hash) ON DELETE CASCADE,
      state_hash TEXT NOT NULL,
      verifier TEXT NOT NULL,
      expires_at ${integer} NOT NULL
    )${strict};

    CREATE TABLE IF NOT EXISTS write_guards (
      organization_id TEXT NOT NULL,
      post_id TEXT NOT NULL,
      operation_id TEXT NOT NULL,
      PRIMARY KEY (organization_id, post_id)
    )${strict};

    CREATE TABLE IF NOT EXISTS write_checks (
      organization_id TEXT NOT NULL,
      post_id TEXT NOT NULL,
      operation_id TEXT NOT NULL,
      expires_at ${integer} NOT NULL,
      PRIMARY KEY (organization_id, post_id, operation_id)
    )${strict};

    CREATE INDEX IF NOT EXISTS workspace_expiration ON workspaces(expires_at);
    CREATE INDEX IF NOT EXISTS session_expiration ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS oauth_expiration ON oauth_attempts(expires_at);
    CREATE INDEX IF NOT EXISTS check_expiration ON write_checks(expires_at);
  `;
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export class WorkspaceQueries<State> {
  readonly #query: Query;

  constructor(query: Query) {
    this.#query = query;
  }

  async getWorkspace(key: string, now = Date.now()): Promise<State | undefined> {
    const { rows: [row] } = await this.#query(
      "SELECT value FROM workspaces WHERE key = $1 AND expires_at > $2", [key, now]);
    return row ? JSON.parse(row.value as string) as State : undefined;
  }

  async putWorkspace(key: string, state: State, expiresAt: number): Promise<void> {
    await this.#query(`
      INSERT INTO workspaces (key, value, expires_at) VALUES ($1, $2, $3)
      ON CONFLICT (key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at
    `, [key, JSON.stringify(state), expiresAt]);
  }

  async deleteWorkspace(key: string): Promise<void> {
    await this.#query("DELETE FROM workspaces WHERE key = $1", [key]);
  }

  async getSession(id: string, now: number): Promise<Session | undefined> {
    const { rows: [row] } = await this.#query(
      "SELECT value FROM sessions WHERE id_hash = $1 AND expires_at > $2", [digest(id), now]);
    return row ? JSON.parse(row.value as string) as Session : undefined;
  }

  async putSession(id: string, session: Session): Promise<void> {
    await this.#query(`
      INSERT INTO sessions (id_hash, value, expires_at) VALUES ($1, $2, $3)
      ON CONFLICT (id_hash) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at
    `, [digest(id), JSON.stringify(session), session.expiresAt]);
  }

  async deleteSession(id: string): Promise<void> {
    await this.#query("DELETE FROM sessions WHERE id_hash = $1", [digest(id)]);
  }

  async putOAuth(id: string, attempt: OAuthAttempt): Promise<void> {
    await this.#query(`
      INSERT INTO oauth_attempts (session_hash, state_hash, verifier, expires_at) VALUES ($1, $2, $3, $4)
      ON CONFLICT (session_hash) DO UPDATE SET state_hash = excluded.state_hash,
        verifier = excluded.verifier, expires_at = excluded.expires_at
    `, [digest(id), digest(attempt.state), attempt.verifier, attempt.expiresAt]);
  }

  async takeOAuth(id: string, state: string, now: number): Promise<OAuthAttempt | undefined> {
    const { rows: [row] } = await this.#query(`
      DELETE FROM oauth_attempts
      WHERE session_hash = $1 AND state_hash = $2 AND expires_at > $3
        AND EXISTS (
          SELECT 1 FROM sessions WHERE id_hash = oauth_attempts.session_hash AND expires_at > $3
        )
      RETURNING verifier, expires_at
    `, [digest(id), digest(state), now]);
    return row ? { state, verifier: row.verifier as string, expiresAt: Number(row.expires_at) } : undefined;
  }

  async getGuard(organizationId: string, postId: string): Promise<string | undefined> {
    const { rows: [row] } = await this.#query(`
      SELECT operation_id FROM write_guards WHERE organization_id = $1 AND post_id = $2
    `, [organizationId, postId]);
    return row?.operation_id as string | undefined;
  }

  async startWriteCheck(organizationId: string, postId: string, operationId: string, expiresAt: number): Promise<boolean> {
    const { changes } = await this.#query(`
      INSERT INTO write_checks (organization_id, post_id, operation_id, expires_at)
      SELECT $1, $2, $3, $4 WHERE NOT EXISTS (
        SELECT 1 FROM write_guards WHERE organization_id = $1 AND post_id = $2
      )
    `, [organizationId, postId, operationId, expiresAt]);
    return changes === 1;
  }

  async claimGuard(organizationId: string, postId: string, operationId: string, now: number): Promise<boolean> {
    // Each engine's trigger invalidates overlapping preflight reads atomically with the claim.
    const { changes } = await this.#query(`
      INSERT INTO write_guards (organization_id, post_id, operation_id)
      SELECT organization_id, post_id, operation_id FROM write_checks
      WHERE organization_id = $1 AND post_id = $2 AND operation_id = $3 AND expires_at > $4
      ON CONFLICT (organization_id, post_id) DO NOTHING
    `, [organizationId, postId, operationId, now]);
    return changes === 1;
  }

  async clearGuard(organizationId: string, postId: string, operationId: string): Promise<void> {
    await this.#query(`
      DELETE FROM write_guards WHERE organization_id = $1 AND post_id = $2 AND operation_id = $3
    `, [organizationId, postId, operationId]);
  }

  async prune(now: number): Promise<void> {
    await this.#query("DELETE FROM oauth_attempts WHERE expires_at <= $1", [now]);
    await this.#query("DELETE FROM sessions WHERE expires_at <= $1", [now]);
    await this.#query("DELETE FROM workspaces WHERE expires_at <= $1", [now]);
    await this.#query("DELETE FROM write_checks WHERE expires_at <= $1", [now]);
  }
}

export interface WorkspaceStorage<State> extends WorkspaceQueries<State> {
  transaction<T>(work: (transaction: WorkspaceQueries<State>) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

function prepareDatabasePath(filename: string): string {
  if (filename === ":memory:") return filename;
  if (!filename.trim()) throw new Error("Set a path for the Patchwork database.");

  const path = resolve(filename);
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  // Set the mode before SQLite opens the database and creates its WAL files.
  closeSync(openSync(path, "a", 0o600));
  chmodSync(path, 0o600);
  return path;
}

const sqliteTrigger = `
  CREATE TRIGGER IF NOT EXISTS invalidate_write_checks
  AFTER INSERT ON write_guards
  BEGIN
    DELETE FROM write_checks WHERE organization_id = NEW.organization_id AND post_id = NEW.post_id;
  END;
`;

export class WorkspaceStore<State> extends WorkspaceQueries<State> implements WorkspaceStorage<State> {
  readonly #db: DatabaseSync;
  readonly #access: WorkspaceQueries<State>;
  readonly #enqueue: <T>(work: () => T | Promise<T>) => Promise<T>;

  constructor(filename: string) {
    const db = new DatabaseSync(prepareDatabasePath(filename));
    try {
      db.exec(`
        PRAGMA busy_timeout = 5000;
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = FULL;
        PRAGMA secure_delete = ON;
        PRAGMA foreign_keys = ON;
        ${workspaceSchema("sqlite")}
        ${sqliteTrigger}
      `);
    } catch (error) {
      db.close();
      throw error;
    }

    const query: Query = (sql, values) => {
      const statement = db.prepare(sql);
      const bindings = Object.fromEntries(values.map((value, index) => [String(index + 1), value]));
      if (statement.columns().length) {
        const rows = statement.all(bindings);
        return { rows, changes: rows.length };
      }
      return { rows: [], changes: Number(statement.run(bindings).changes) };
    };
    let tail = Promise.resolve();
    function enqueue<T>(work: () => T | Promise<T>): Promise<T> {
      const result = tail.then(work);
      tail = result.then(() => undefined, () => undefined);
      return result;
    }
    super((sql, values) => enqueue(() => query(sql, values)));
    this.#db = db;
    this.#access = new WorkspaceQueries(query);
    this.#enqueue = enqueue;
  }

  transaction<T>(work: (transaction: WorkspaceQueries<State>) => Promise<T>): Promise<T> {
    return this.#enqueue(async () => {
      this.#db.exec("BEGIN IMMEDIATE");
      try {
        const result = await work(this.#access);
        this.#db.exec("COMMIT");
        return result;
      } catch (error) {
        this.#db.exec("ROLLBACK");
        throw error;
      }
    });
  }

  close(): Promise<void> {
    return this.#enqueue(() => this.#db.close());
  }
}
