import { Database } from 'bun:sqlite';
const dbPath = 'file:///C:/Users/rakes/Documents/Placement/narayanaAssignment/th-task-01-main/database/orders.db';
console.log('dbPath', dbPath);
const db = new Database(dbPath, { create: true });
const rows = db.query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log('tables:', rows.map((r: any) => r.name));
db.close();
