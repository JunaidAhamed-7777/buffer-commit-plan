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

const schema = `
  CREATE TABLE IF NOT EXISTS workspaces (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  ) STRICT;

  CREATE TABLE IF NOT EXISTS sessions (
    id_hash TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  ) STRICT;

  CREATE TABLE IF NOT EXISTS oauth_attempts (
    session_hash TEXT PRIMARY KEY REFERENCES sessions(id_hash) ON DELETE CASCADE,
    state_hash TEXT NOT NULL,
    verifier TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  ) STRICT;

  CREATE TABLE IF NOT EXISTS write_guards (
    organization_id TEXT NOT NULL,
    post_id TEXT NOT NULL,
    operation_id TEXT NOT NULL,
    PRIMARY KEY (organization_id, post_id)
  ) STRICT;

  CREATE TABLE IF NOT EXISTS write_checks (
    organization_id TEXT NOT NULL,
    post_id TEXT NOT NULL,
    operation_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    PRIMARY KEY (organization_id, post_id, operation_id)
  ) STRICT;

  CREATE TRIGGER IF NOT EXISTS invalidate_write_checks
  AFTER INSERT ON write_guards
  BEGIN
    DELETE FROM write_checks WHERE organization_id = NEW.organization_id AND post_id = NEW.post_id;
  END;
`;

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
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

export class WorkspaceStore<State> {
  private readonly db: DatabaseSync;

  constructor(filename: string) {
    this.db = new DatabaseSync(prepareDatabasePath(filename));
    try {
      this.db.exec(`
        PRAGMA busy_timeout = 5000;
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = FULL;
        PRAGMA secure_delete = ON;
        PRAGMA foreign_keys = ON;
        ${schema}
      `);
    } catch (error) {
      this.db.close();
      throw error;
    }
  }

  transaction<T>(work: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = work();
      if (result instanceof Promise) throw new TypeError("A database transaction must be synchronous.");
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  getWorkspace(key: string): State | undefined {
    const row = this.db.prepare("SELECT value FROM workspaces WHERE key = ?").get(key);
    return row ? JSON.parse(row.value as string) as State : undefined;
  }

  putWorkspace(key: string, state: State, expiresAt: number): void {
    this.db.prepare(`
      INSERT INTO workspaces (key, value, expires_at) VALUES (?, ?, ?)
      ON CONFLICT (key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at
    `).run(key, JSON.stringify(state), expiresAt);
  }

  deleteWorkspace(key: string): void {
    this.db.prepare("DELETE FROM workspaces WHERE key = ?").run(key);
  }

  getSession(id: string, now: number): Session | undefined {
    const row = this.db.prepare("SELECT value FROM sessions WHERE id_hash = ? AND expires_at > ?").get(digest(id), now);
    return row ? JSON.parse(row.value as string) as Session : undefined;
  }

  putSession(id: string, session: Session): void {
    this.db.prepare(`
      INSERT INTO sessions (id_hash, value, expires_at) VALUES (?, ?, ?)
      ON CONFLICT (id_hash) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at
    `).run(digest(id), JSON.stringify(session), session.expiresAt);
  }

  deleteSession(id: string): void {
    this.db.prepare("DELETE FROM sessions WHERE id_hash = ?").run(digest(id));
  }

  putOAuth(id: string, attempt: OAuthAttempt): void {
    this.db.prepare(`
      INSERT INTO oauth_attempts (session_hash, state_hash, verifier, expires_at) VALUES (?, ?, ?, ?)
      ON CONFLICT (session_hash) DO UPDATE SET state_hash = excluded.state_hash,
        verifier = excluded.verifier, expires_at = excluded.expires_at
    `).run(digest(id), digest(attempt.state), attempt.verifier, attempt.expiresAt);
  }

  takeOAuth(id: string, state: string, now: number): OAuthAttempt | undefined {
    const row = this.db.prepare(`
      DELETE FROM oauth_attempts
      WHERE session_hash = ? AND state_hash = ? AND expires_at > ?
        AND EXISTS (
          SELECT 1 FROM sessions WHERE id_hash = oauth_attempts.session_hash AND expires_at > ?
        )
      RETURNING verifier, expires_at
    `).get(digest(id), digest(state), now, now);
    return row ? { state, verifier: row.verifier as string, expiresAt: row.expires_at as number } : undefined;
  }

  getGuard(organizationId: string, postId: string): string | undefined {
    const row = this.db.prepare(`
      SELECT operation_id FROM write_guards WHERE organization_id = ? AND post_id = ?
    `).get(organizationId, postId);
    return row?.operation_id as string | undefined;
  }

  startWriteCheck(organizationId: string, postId: string, operationId: string, expiresAt: number): boolean {
    const { changes } = this.db.prepare(`
      INSERT INTO write_checks (organization_id, post_id, operation_id, expires_at)
      SELECT ?, ?, ?, ? WHERE NOT EXISTS (
        SELECT 1 FROM write_guards WHERE organization_id = ? AND post_id = ?
      )
    `).run(organizationId, postId, operationId, expiresAt, organizationId, postId);
    return changes === 1;
  }

  claimGuard(organizationId: string, postId: string, operationId: string, now: number): boolean {
    // Dispatch invalidates every overlapping read of this post, even if the guard clears before that read returns.
    const { changes } = this.db.prepare(`
      INSERT INTO write_guards (organization_id, post_id, operation_id)
      SELECT organization_id, post_id, operation_id FROM write_checks
      WHERE organization_id = ? AND post_id = ? AND operation_id = ? AND expires_at > ?
      ON CONFLICT (organization_id, post_id) DO NOTHING
    `).run(organizationId, postId, operationId, now);
    return changes === 1;
  }

  clearGuard(organizationId: string, postId: string, operationId: string): void {
    this.db.prepare(`
      DELETE FROM write_guards WHERE organization_id = ? AND post_id = ? AND operation_id = ?
    `).run(organizationId, postId, operationId);
  }

  prune(now: number): void {
    this.db.prepare("DELETE FROM oauth_attempts WHERE expires_at <= ?").run(now);
    this.db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now);
    this.db.prepare("DELETE FROM workspaces WHERE expires_at <= ?").run(now);
    this.db.prepare("DELETE FROM write_checks WHERE expires_at <= ?").run(now);
  }

  close(): void {
    this.db.close();
  }
}
