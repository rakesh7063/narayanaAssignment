import { Database } from "bun:sqlite";
import { join } from "node:path";

const dbPath = join(import.meta.dir, "../../database/orders.db");

export const db = new Database(dbPath, { create: true });
