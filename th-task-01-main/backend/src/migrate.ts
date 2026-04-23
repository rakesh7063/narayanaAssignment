import { Database } from "bun:sqlite";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

type MigrationRow = {
  id: number;
  name: string;
  applied_at: string;
};

const dbPath = join(import.meta.dir, "../../database/orders.db");
const migrationsDir = join(import.meta.dir, "../migrations");

function ensureTable(db: Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS __migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `);
}

function listMigrationFiles(): string[] {
  return readdirSync(migrationsDir)
    .filter((f) => f.includes(".sql"))
    .sort((a, b) => a.localeCompare(b));
}

function getApplied(db: Database): MigrationRow[] {
  const rows = db
    .query(
      "SELECT id, name, applied_at FROM __migrations ORDER BY id ASC"
    )
    .all() as MigrationRow[];
  return rows;
}

function tableExists(db: Database, name: string): boolean {
  return (
    db
      .query(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1"
      )
      .get(name) as { '1': number } | null
  ) !== null;
}

function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let buffer = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    const next = sql[i + 1];

    if (inLineComment) {
      if (char === "\n") {
        inLineComment = false;
        buffer += char;
      }
      continue;
    }

    if (inBlockComment) {
      if (char === "*" && next === "/") {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote) {
      if (char === "-" && next === "-") {
        inLineComment = true;
        i += 1;
        continue;
      }

      if (char === "/" && next === "*") {
        inBlockComment = true;
        i += 1;
        continue;
      }

      if (char === "'") {
        inSingleQuote = true;
        buffer += char;
        continue;
      }

      if (char === '"') {
        inDoubleQuote = true;
        buffer += char;
        continue;
      }

      if (char === ";") {
        const stmt = buffer.trim();
        if (stmt) {
          statements.push(stmt);
        }
        buffer = "";
        continue;
      }
    } else {
      if (char === "'" && inSingleQuote) {
        if (next === "'") {
          buffer += "''";
          i += 1;
          continue;
        }
        inSingleQuote = false;
      }

      if (char === '"' && inDoubleQuote) {
        inDoubleQuote = false;
      }
    }

    buffer += char;
  }

  const lastStmt = buffer.trim();
  if (lastStmt) {
    statements.push(lastStmt);
  }

  return statements;
}

function applyOne(db: Database, filename: string) {
  const fullPath = join(migrationsDir, filename);
  const sql = readFileSync(fullPath, "utf8");
  const statements = splitStatements(sql);

  for (const stmt of statements) {
    db.run(stmt);
  }

  const canonicalName = filename.replace(/\s+/g, " ").trim();
  db.run("INSERT INTO __migrations (name, applied_at) VALUES (?, datetime())", [
    canonicalName,
  ]);
}

export function runMigrations() {
  mkdirSync(join(import.meta.dir, "../../database"), { recursive: true });
  const db = new Database(dbPath, { create: true });
  ensureTable(db);

  const legacyOrdersTable = tableExists(db, 'orders');
  const hasCustomersTable = tableExists(db, 'customers');

  if (!legacyOrdersTable) {
    console.log("No legacy orders table found; skipping migrations.");
    db.close();
    return;
  }

  const files = listMigrationFiles();
  let applied = getApplied(db);

  if (legacyOrdersTable && !hasCustomersTable) {
    console.log(
      "Detected legacy orders table without customers; replaying migration to repair schema."
    );
    db.run("DELETE FROM __migrations WHERE name = ?", [files[0]]);
    applied = getApplied(db);
  }

  const lastAppliedName = applied.length ? applied[applied.length - 1]!.name : "";
  const startIndex = lastAppliedName ? files.indexOf(lastAppliedName) + 1 : 0;

  const pending = files.slice(startIndex);

  if (pending.length === 0) {
    console.log("No migrations to run.");
    db.close();
    return;
  }

  console.log(`Running ${pending.length} migration(s)...`);
  for (const f of pending) {
    console.log(`→ ${f}`);
    applyOne(db, f);
  }

  console.log("Done.");
  db.close();
}

if (import.meta.main) {
  runMigrations();
}

