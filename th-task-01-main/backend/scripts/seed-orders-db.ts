import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const dbPath = join(import.meta.dir, "../../database/orders.db");
mkdirSync(join(import.meta.dir, "../../database"), { recursive: true });
const db = new Database(dbPath, { create: true });

db.run("DROP TABLE IF EXISTS orders");
db.run(`
  CREATE TABLE orders (
    order_id TEXT PRIMARY KEY,
    customer_name TEXT,
    customer_phone TEXT,
    table_number TEXT,
    waiter_name TEXT,
    waiter_phone TEXT,
    food_items TEXT,
    order_date TEXT,
    status TEXT,
    metadata TEXT,
    price TEXT
  )
`);

const insert = db.prepare(`
  INSERT INTO orders (
    order_id, customer_name, customer_phone, table_number,
    waiter_name, waiter_phone, food_items,
    order_date, status, metadata, price
  ) VALUES (
    $order_id, $customer_name, $customer_phone, $table_number,
    $waiter_name, $waiter_phone, $food_items,
    $order_date, $status, $metadata, $price
  )
`);

type SeedRow = {
  order_id: string;
  customer_name: string;
  customer_phone: string;
  table_number: string;
  waiter_name: string;
  waiter_phone: string;
  food_items: string;
  order_date: string;
  status: string;
  metadata: string;
  price: string;
};

function doubleStringifyJson(value: unknown): string {
  // Yields a JSON string whose contents are JSON, e.g. "\"{\\\"k\\\":\\\"v\\\"}\""
  return JSON.stringify(JSON.stringify(value));
}

const DATE_VARIANTS = [
  // ISO date-only
  "2024-04-16",
  // ISO datetime (UTC, Z)
  "2024-04-16T13:45:22Z",
  // US (MM/DD/YYYY)
  "04/16/2024",
  // epoch millis (as string)
  "1713225600000",
] as const;

const STATUS_VARIANTS = ["active", "Active", "ACTIVE", " active ", "1"] as const;

const METADATA_VARIANTS = [
  JSON.stringify({ key: "val", source: "seed", ok: true }),
  doubleStringifyJson({ key: "val", source: "seed", ok: true }),
  "call me maybe",
] as const;

const PRICE_VARIANTS = ["$12.50", "12,50", "12.5", ""] as const;

/** Base rows: intentionally inconsistent encodings in food_items and identity fields. */
const baseRows: Array<Omit<SeedRow, "order_date" | "status" | "metadata" | "price">> = [
  {
    order_id: "ORD-2024-0001",
    customer_name: "sam  kumar",
    customer_phone: "+1-415-555-0199",
    table_number: "12",
    waiter_name: "Alex",
    waiter_phone: "4155557720",
    food_items: '["caesar","margherita pizza","2x garlic bread"]',
  },
  {
    order_id: "88",
    customer_name: "O'Brien, Maeve",
    customer_phone: "(650) 555-0142 ext 9",
    table_number: "T-7",
    waiter_name: "alex",
    waiter_phone: "+16505550142",
    food_items: "tuna melt|side salad|coke",
  },
  {
    order_id: " 00901 ",
    customer_name: "李 伟",
    customer_phone: "0016505553300",
    table_number: "bar-3",
    waiter_name: "Jordan P.",
    waiter_phone: "650-555-3300",
    food_items:
      '{"items":[{"sku":"B-01","qty":1},{"sku":"F-22","qty":2}],"note":"no onion"}',
  },
  {
    order_id: "9001",
    customer_name: "guest",
    customer_phone: "n/a",
    table_number: "7",
    waiter_name: "SAM",
    waiter_phone: "",
    food_items: "burger\nfries\n\nmilkshake (vanilla)",
  },
  {
    order_id: "ord-batch-A",
    customer_name: "Corporate Catering — Acme",
    customer_phone: "8005550199",
    table_number: "conf room B",
    waiter_name: "Pat",
    waiter_phone: "4155550000",
    food_items: '[ "wrap" , "wrap" , "fruit plate" ]',
  },
  {
    order_id: "42",
    customer_name: "Casey",
    customer_phone: "+44 20 7946 0958",
    table_number: "12a",
    waiter_name: "Alex",
    waiter_phone: "4155557720",
    food_items: "Qty 2x chicken sandwich, 1 soup of day, coffee black",
  },
  {
    order_id: "00000042",
    customer_name: "CASEY",
    customer_phone: "+442079460958",
    table_number: "12",
    waiter_name: "alex",
    waiter_phone: "4155557720",
    food_items: "chicken sandwich,chicken sandwich,soup,coffee",
  },
  {
    order_id: "piZZa-77",
    customer_name: "Jamie",
    customer_phone: "6505551111",
    table_number: "99",
    waiter_name: "Riley",
    waiter_phone: "(650) 555-2222",
    food_items: '["pizza","pizza"]',
  },
  {
    order_id: "x-100",
    customer_name: "Dr. A. Nguyen",
    customer_phone: "650.555.4444",
    table_number: "4",
    waiter_name: "Taylor",
    waiter_phone: "6505554444",
    food_items: "salmon;rice pilaf;seasonal veg",
  },
  {
    order_id: "7",
    customer_name: "   ",
    customer_phone: "unknown",
    table_number: "takeout-1",
    waiter_name: "?",
    waiter_phone: "n/a",
    food_items: "[]",
  },
  {
    order_id: "ORD20240416-Ω",
    customer_name: "Renée",
    customer_phone: "+33 1 42 86 82 00",
    table_number: "patio-2",
    waiter_name: "Jordan P.",
    waiter_phone: "650-555-3300",
    food_items:
      "[[\"escargot\",1],[\"steak frites\",1],[\"crème brûlée\",1]]",
  },
  {
    order_id: "bulk-003",
    customer_name: "Stadium Concessions",
    customer_phone: "5550100",
    table_number: "SEC-114-ROW5",
    waiter_name: "Morgan",
    waiter_phone: "5550101",
    food_items: "hot dog|hot dog|hot dog|nachos|beer|beer",
  },
  {
    order_id: "last-call",
    customer_name: "Nick",
    customer_phone: "6505559988",
    table_number: "bar",
    waiter_name: "Riley",
    waiter_phone: "(650) 555-2222",
    food_items: "wings;wings;wings;ranch on side",
  },
  {
    order_id: "0xDEAD",
    customer_name: "Dev Test",
    customer_phone: "0000000000",
    table_number: "0",
    waiter_name: "Taylor",
    waiter_phone: "6505554444",
    food_items: '{"oops": "single object not array"}',
  },
  {
    order_id: "mixed-1",
    customer_name: "Asha & Priya",
    customer_phone: "6505557777 / 6505557778",
    table_number: "8",
    waiter_name: "Pat",
    waiter_phone: "4155550000",
    food_items: "1x dosa, 2x idli, sambar (share), masala chai ×2",
  },
];

const TARGET_ROWS = 500;

function pick<const T>(arr: readonly T[], idx: number): T {
  return arr[idx % arr.length]!;
}

function makeGeneratedOrderId(i: number): string {
  // Intentionally sprinkle Unicode and odd formatting to keep cursor payload tricky.
  if (i % 57 === 0) return `ORD-Ω-${String(i).padStart(4, "0")}`;
  if (i % 41 === 0) return ` ord-${String(i).padStart(4, "0")} `;
  return `ORD-2024-${String(i).padStart(4, "0")}`;
}

for (let i = 0; i < TARGET_ROWS; i++) {
  const base = baseRows[i % baseRows.length]!;

  const order_id = i < baseRows.length ? base.order_id : makeGeneratedOrderId(i + 1);

  const row: SeedRow = {
    ...base,
    order_id,
    order_date: pick(DATE_VARIANTS, i),
    status: pick(STATUS_VARIANTS, i),
    metadata: pick(METADATA_VARIANTS, i),
    price: pick(PRICE_VARIANTS, i),
  };

  insert.run({
    $order_id: row.order_id,
    $customer_name: row.customer_name,
    $customer_phone: row.customer_phone,
    $table_number: row.table_number,
    $waiter_name: row.waiter_name,
    $waiter_phone: row.waiter_phone,
    $food_items: row.food_items,
    $order_date: row.order_date,
    $status: row.status,
    $metadata: row.metadata,
    $price: row.price,
  });
}

const count = db.query("SELECT COUNT(*) AS c FROM orders").get() as { c: number };
console.log(`orders.db ready at ${dbPath} (${count.c} rows)`);
db.close();
