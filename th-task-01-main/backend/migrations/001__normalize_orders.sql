-- Normalize legacy `orders` into a typed, queryable schema (<=4 domain tables).
-- Strict no-data-loss requirement: all legacy columns are preserved as *_raw.

PRAGMA foreign_keys = ON;

BEGIN;

-- 1) Related entities (dedupe by exact raw identity to avoid accidental merges)
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name_raw TEXT,
  phone_raw TEXT,
  name_trim TEXT,
  phone_compact TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS customers_raw_uniq
  ON customers(name_raw, phone_raw);

CREATE TABLE IF NOT EXISTS waiters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name_raw TEXT,
  phone_raw TEXT,
  name_trim TEXT,
  phone_compact TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS waiters_raw_uniq
  ON waiters(name_raw, phone_raw);

-- 2) Orders (store all legacy fields as raw; references to related entities)
CREATE TABLE IF NOT EXISTS orders_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id_raw TEXT NOT NULL,
  customer_id INTEGER,
  waiter_id INTEGER,
  table_raw TEXT,
  food_items_raw TEXT,
  order_date_raw TEXT,
  status_raw TEXT,
  metadata_raw TEXT,
  price_raw TEXT,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (waiter_id) REFERENCES waiters(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS orders_order_id_raw_uniq
  ON orders_new(order_id_raw);

CREATE INDEX IF NOT EXISTS orders_new_customer_id_idx
  ON orders_new(customer_id);

CREATE INDEX IF NOT EXISTS orders_new_waiter_id_idx
  ON orders_new(waiter_id);

-- 3) Order items (best-effort extraction; original raw string always preserved)
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  idx INTEGER NOT NULL,
  item_raw TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders_new(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS order_items_order_id_idx
  ON order_items(order_id);

-- Backfill customers/waiters from legacy table.
INSERT OR IGNORE INTO customers (name_raw, phone_raw, name_trim, phone_compact)
SELECT
  customer_name,
  customer_phone,
  trim(COALESCE(customer_name, '')),
  replace(replace(replace(replace(replace(replace(replace(replace(replace(lower(COALESCE(customer_phone,'')),
    '+',''),'-',''),'(',''),')',''),' ',''),'.',''),'/',''),'\t',''),'\r','')
FROM orders;

INSERT OR IGNORE INTO waiters (name_raw, phone_raw, name_trim, phone_compact)
SELECT
  waiter_name,
  waiter_phone,
  trim(COALESCE(waiter_name, '')),
  replace(replace(replace(replace(replace(replace(replace(replace(replace(lower(COALESCE(waiter_phone,'')),
    '+',''),'-',''),'(',''),')',''),' ',''),'.',''),'/',''),'\t',''),'\r','')
FROM orders;

-- Backfill orders.
INSERT INTO orders_new (
  order_id_raw,
  customer_id,
  waiter_id,
  table_raw,
  food_items_raw,
  order_date_raw,
  status_raw,
  metadata_raw,
  price_raw
)
SELECT
  o.order_id,
  (SELECT c.id FROM customers c WHERE c.name_raw = o.customer_name AND c.phone_raw = o.customer_phone),
  (SELECT w.id FROM waiters w WHERE w.name_raw = o.waiter_name AND w.phone_raw = o.waiter_phone),
  o.table_number,
  o.food_items,
  o.order_date,
  o.status,
  o.metadata,
  o.price
FROM orders o;

-- Extract items: JSON array in food_items_raw
INSERT INTO order_items (order_id, idx, item_raw)
SELECT
  onew.id,
  CAST(je.key AS INTEGER),
  CASE
    WHEN typeof(je.value) = 'text' THEN je.value
    ELSE json(je.value)
  END
FROM orders_new onew
JOIN orders o ON o.order_id = onew.order_id_raw
JOIN json_each(o.food_items) je
WHERE json_valid(o.food_items) AND json_type(o.food_items) = 'array';

-- Extract items: JSON object with $.items array
INSERT INTO order_items (order_id, idx, item_raw)
SELECT
  onew.id,
  CAST(je.key AS INTEGER),
  CASE
    WHEN typeof(je.value) = 'text' THEN je.value
    ELSE json(je.value)
  END
FROM orders_new onew
JOIN orders o ON o.order_id = onew.order_id_raw
JOIN json_each(json_extract(o.food_items, '$.items')) je
WHERE
  json_valid(o.food_items)
  AND json_type(o.food_items) = 'object'
  AND json_type(json_extract(o.food_items, '$.items')) = 'array';

-- Helper: split by a delimiter (recursive CTE) - pipe
WITH RECURSIVE split(order_id, rest, part, idx) AS (
  SELECT
    onew.id,
    COALESCE(o.food_items, ''),
    '',
    0
  FROM orders_new onew
  JOIN orders o ON o.order_id = onew.order_id_raw
  WHERE
    NOT json_valid(COALESCE(o.food_items, ''))
    AND instr(COALESCE(o.food_items, ''), '|') > 0

  UNION ALL

  SELECT
    order_id,
    CASE WHEN instr(rest, '|') = 0 THEN '' ELSE substr(rest, instr(rest, '|') + 1) END,
    trim(CASE WHEN instr(rest, '|') = 0 THEN rest ELSE substr(rest, 1, instr(rest, '|') - 1) END),
    idx + 1
  FROM split
  WHERE rest != ''
)
INSERT INTO order_items (order_id, idx, item_raw)
SELECT order_id, idx - 1, part FROM split WHERE idx > 0 AND part != '';

-- Split by semicolon
WITH RECURSIVE split(order_id, rest, part, idx) AS (
  SELECT
    onew.id,
    COALESCE(o.food_items, ''),
    '',
    0
  FROM orders_new onew
  JOIN orders o ON o.order_id = onew.order_id_raw
  WHERE
    NOT json_valid(COALESCE(o.food_items, ''))
    AND instr(COALESCE(o.food_items, ''), ';') > 0

  UNION ALL

  SELECT
    order_id,
    CASE WHEN instr(rest, ';') = 0 THEN '' ELSE substr(rest, instr(rest, ';') + 1) END,
    trim(CASE WHEN instr(rest, ';') = 0 THEN rest ELSE substr(rest, 1, instr(rest, ';') - 1) END),
    idx + 1
  FROM split
  WHERE rest != ''
)
INSERT INTO order_items (order_id, idx, item_raw)
SELECT order_id, idx - 1, part FROM split WHERE idx > 0 AND part != '';

-- Split by comma (only when not obviously CSV-ish inside JSON-like brackets)
WITH RECURSIVE split(order_id, rest, part, idx) AS (
  SELECT
    onew.id,
    COALESCE(o.food_items, ''),
    '',
    0
  FROM orders_new onew
  JOIN orders o ON o.order_id = onew.order_id_raw
  WHERE
    NOT json_valid(COALESCE(o.food_items, ''))
    AND instr(COALESCE(o.food_items, ''), ',') > 0
    AND instr(COALESCE(o.food_items, ''), '[') = 0
    AND instr(COALESCE(o.food_items, ''), '{') = 0

  UNION ALL

  SELECT
    order_id,
    CASE WHEN instr(rest, ',') = 0 THEN '' ELSE substr(rest, instr(rest, ',') + 1) END,
    trim(CASE WHEN instr(rest, ',') = 0 THEN rest ELSE substr(rest, 1, instr(rest, ',') - 1) END),
    idx + 1
  FROM split
  WHERE rest != ''
)
INSERT INTO order_items (order_id, idx, item_raw)
SELECT order_id, idx - 1, part FROM split WHERE idx > 0 AND part != '';

-- Split by newline
WITH RECURSIVE split(order_id, rest, part, idx) AS (
  SELECT
    onew.id,
    replace(COALESCE(o.food_items, ''), char(13), ''),
    '',
    0
  FROM orders_new onew
  JOIN orders o ON o.order_id = onew.order_id_raw
  WHERE
    NOT json_valid(COALESCE(o.food_items, ''))
    AND instr(replace(COALESCE(o.food_items, ''), char(13), ''), char(10)) > 0

  UNION ALL

  SELECT
    order_id,
    CASE WHEN instr(rest, char(10)) = 0 THEN '' ELSE substr(rest, instr(rest, char(10)) + 1) END,
    trim(CASE WHEN instr(rest, char(10)) = 0 THEN rest ELSE substr(rest, 1, instr(rest, char(10)) - 1) END),
    idx + 1
  FROM split
  WHERE rest != ''
)
INSERT INTO order_items (order_id, idx, item_raw)
SELECT order_id, idx - 1, part FROM split WHERE idx > 0 AND part != '';

-- Fallback: if we didn't extract any items but food_items_raw is non-empty, store it as a single row.
INSERT INTO order_items (order_id, idx, item_raw)
SELECT
  onew.id,
  0,
  COALESCE(onew.food_items_raw, '')
FROM orders_new onew
WHERE
  COALESCE(onew.food_items_raw, '') != ''
  AND NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = onew.id);

-- Swap tables: keep the new schema as `orders`.
DROP TABLE orders;
ALTER TABLE orders_new RENAME TO orders;

COMMIT;
