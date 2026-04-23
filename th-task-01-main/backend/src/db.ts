import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { runMigrations } from "./migrate";

const dbPath = join(import.meta.dir, "../../database/orders.db");

mkdirSync(join(import.meta.dir, "../../database"), { recursive: true });
runMigrations();

export const db = new Database(dbPath, { create: true });
db.run("PRAGMA foreign_keys = ON");
