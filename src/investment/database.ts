import { createHash, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { event_message } from "@blamnetwork/datamine";
import { listAssets, readAsset } from "../assets";
import { buildFolder, type e_build } from "../builds";
import { tigerDatabaseUrlFor } from "../env";

const FILE_PREFIX = "file:";
const MIGRATION_FILE = "/migration.sql";

// Prisma's own bookkeeping table, so a database stays usable with
// `prisma migrate` (scripts/prisma.mjs).
const CREATE_MIGRATIONS_TABLE = `CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id"                    TEXT PRIMARY KEY NOT NULL,
    "checksum"              TEXT NOT NULL,
    "finished_at"           DATETIME,
    "migration_name"        TEXT NOT NULL,
    "logs"                  TEXT,
    "rolled_back_at"        DATETIME,
    "started_at"            DATETIME NOT NULL DEFAULT current_timestamp,
    "applied_steps_count"   INTEGER UNSIGNED NOT NULL DEFAULT 0
)`;

// The build's migrations in order: directory name and SQL.
function migrations(build: e_build): { name: string; sql: Buffer }[] {
  const prefix = `prisma/${buildFolder(build)}/migrations/`;
  return listAssets(prefix)
    .filter((key) => key.endsWith(MIGRATION_FILE))
    .map((key) => ({
      name: key.slice(prefix.length, -MIGRATION_FILE.length),
      sql: readAsset(key),
    }));
}

// Applies the build's migrations that the file hasn't recorded yet, the way
// `prisma migrate deploy` does: each in a transaction, recorded in
// _prisma_migrations with the sha256 of its SQL.
function applyMigrations(db: DatabaseSync, build: e_build): void {
  db.exec(CREATE_MIGRATIONS_TABLE);
  const applied = new Set(
    db
      .prepare(
        'SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL'
      )
      .all()
      .map((row) => row.migration_name)
  );
  const record = db.prepare(
    'INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, started_at, applied_steps_count) VALUES (?, ?, ?, ?, ?, 1)'
  );
  for (const { name, sql } of migrations(build)) {
    if (applied.has(name)) {
      continue;
    }
    const started = Date.now();
    db.exec("BEGIN");
    try {
      db.exec(sql.toString("utf8"));
      record.run(
        randomUUID(),
        createHash("sha256").update(sql).digest("hex"),
        Date.now(),
        name,
        started
      );
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw new Error(
        `migration ${name} of ${build} failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    event_message("lifecycle: applied migration %s (%s)", name, build);
  }
}

// Creates `build`'s SQLite file in `dir` if it is missing and applies the
// build's pending migrations, so a fresh install needs no setup. Returns the
// connection URL.
export function prepareBuildDatabase(dir: string, build: e_build): string {
  const url = tigerDatabaseUrlFor(dir, build);
  const db = new DatabaseSync(url.slice(FILE_PREFIX.length));
  try {
    applyMigrations(db, build);
  } finally {
    db.close();
  }
  event_message("lifecycle: database %s ready", url);
  return url;
}
