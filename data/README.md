# Data design assets

The SQLite store creates the current schema on first run. [Storage code](../src/server/storage/store.ts)

Keep future schema migrations in `migrations/`.

Keep account data, database files and credentials outside git.
