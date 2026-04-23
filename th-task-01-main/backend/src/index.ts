import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { z } from "zod";
import { db } from "./db";
import { decodeCursor, encodeCursor } from "./cursor";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const zNonEmptyString = z.string().transform((s) => s).refine((s) => s.length > 0);

const zListQuery = z.object({
  limit: z.string().optional(),
  cursor: z.string().optional(),
});

function parseLimit(rawLimit: string | undefined): number {
  if (rawLimit === undefined || rawLimit.trim() === "") return DEFAULT_LIMIT;
  const n = Math.floor(Number(rawLimit));
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, n);
}

function parseAfterId(cursorParam: string | undefined): number {
  if (cursorParam === undefined || cursorParam.trim() === "") return 0;
  const c = decodeCursor(cursorParam);
  return c.id;
}

const zCustomerCreate = z.object({
  nameRaw: z.string().nullable().optional(),
  phoneRaw: z.string().nullable().optional(),
});

const zWaiterCreate = z.object({
  nameRaw: z.string().nullable().optional(),
  phoneRaw: z.string().nullable().optional(),
});

const zCustomerPatch = z
  .object({
    nameRaw: z.string().nullable().optional(),
    phoneRaw: z.string().nullable().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "No fields to update" });

const zWaiterPatch = z
  .object({
    nameRaw: z.string().nullable().optional(),
    phoneRaw: z.string().nullable().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "No fields to update" });

const zOrderCreate = z.object({
  orderIdRaw: zNonEmptyString,
  customerId: z.number().int().positive().optional(),
  waiterId: z.number().int().positive().optional(),
  tableRaw: z.string().nullable().optional(),
  foodItemsRaw: z.string().nullable().optional(),
  orderDateRaw: z.string().nullable().optional(),
  statusRaw: z.string().nullable().optional(),
  metadataRaw: z.string().nullable().optional(),
  priceRaw: z.string().nullable().optional(),
});

const zOrderPatch = z
  .object({
    orderIdRaw: z.string().min(1).optional(),
    customerId: z.number().int().positive().nullable().optional(),
    waiterId: z.number().int().positive().nullable().optional(),
    tableRaw: z.string().nullable().optional(),
    foodItemsRaw: z.string().nullable().optional(),
    orderDateRaw: z.string().nullable().optional(),
    statusRaw: z.string().nullable().optional(),
    metadataRaw: z.string().nullable().optional(),
    priceRaw: z.string().nullable().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "No fields to update" });

type CustomerRow = {
  id: number;
  name_raw: string | null;
  phone_raw: string | null;
};

type WaiterRow = {
  id: number;
  name_raw: string | null;
  phone_raw: string | null;
};

type OrderListRow = {
  id: number;
  order_id_raw: string;
  table_raw: string | null;
  order_date_raw: string | null;
  status_raw: string | null;
  price_raw: string | null;
  customer_id: number | null;
  customer_name_raw: string | null;
  customer_phone_raw: string | null;
  waiter_id: number | null;
  waiter_name_raw: string | null;
  waiter_phone_raw: string | null;
};

type OrderDetailRow = {
  id: number;
  order_id_raw: string;
  table_raw: string | null;
  food_items_raw: string | null;
  order_date_raw: string | null;
  status_raw: string | null;
  metadata_raw: string | null;
  price_raw: string | null;
  customer_id: number | null;
  customer_name_raw: string | null;
  customer_phone_raw: string | null;
  waiter_id: number | null;
  waiter_name_raw: string | null;
  waiter_phone_raw: string | null;
};

type OrderItemRow = {
  idx: number;
  item_raw: string;
};

const listOrdersSql = `
  SELECT
    o.id,
    o.order_id_raw,
    o.table_raw,
    o.order_date_raw,
    o.status_raw,
    o.price_raw,
    c.id AS customer_id,
    c.name_raw AS customer_name_raw,
    c.phone_raw AS customer_phone_raw,
    w.id AS waiter_id,
    w.name_raw AS waiter_name_raw,
    w.phone_raw AS waiter_phone_raw
  FROM orders o
  LEFT JOIN customers c ON c.id = o.customer_id
  LEFT JOIN waiters w ON w.id = o.waiter_id
  WHERE o.id > ?
  ORDER BY o.id ASC
  LIMIT ?
`;

const getOrderSql = `
  SELECT
    o.id,
    o.order_id_raw,
    o.table_raw,
    o.food_items_raw,
    o.order_date_raw,
    o.status_raw,
    o.metadata_raw,
    o.price_raw,
    c.id AS customer_id,
    c.name_raw AS customer_name_raw,
    c.phone_raw AS customer_phone_raw,
    w.id AS waiter_id,
    w.name_raw AS waiter_name_raw,
    w.phone_raw AS waiter_phone_raw
  FROM orders o
  LEFT JOIN customers c ON c.id = o.customer_id
  LEFT JOIN waiters w ON w.id = o.waiter_id
  WHERE o.id = ?
  LIMIT 1
`;

const listCustomersSql = `
  SELECT id, name_raw, phone_raw
  FROM customers
  WHERE id > ?
  ORDER BY id ASC
  LIMIT ?
`;

const listWaitersSql = `
  SELECT id, name_raw, phone_raw
  FROM waiters
  WHERE id > ?
  ORDER BY id ASC
  LIMIT ?
`;

const app = new Elysia()
  .use(cors({ origin: true }))
  .get("/", () => "Hello Elysia")
  .get("/customers", ({ query, set }) => {
    const parsed = zListQuery.safeParse(query);
    if (!parsed.success) {
      set.status = 400;
      return { error: "Invalid query" };
    }

    const limit = parseLimit(parsed.data.limit);
    let afterId = 0;
    try {
      afterId = parseAfterId(parsed.data.cursor);
    } catch {
      set.status = 400;
      return { error: "Invalid cursor" };
    }

    const take = limit + 1;
    const rows = db.query(listCustomersSql).all(afterId, take) as CustomerRow[];
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore && page.length ? encodeCursor({ id: page[page.length - 1]!.id }) : null;
    return { items: page.map((r) => ({ id: r.id, nameRaw: r.name_raw, phoneRaw: r.phone_raw })), nextCursor, hasMore };
  })
  .post("/customers", ({ body, set }) => {
    const parsed = zCustomerCreate.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { error: parsed.error.message };
    }
    const nameRaw = parsed.data.nameRaw ?? null;
    const phoneRaw = parsed.data.phoneRaw ?? null;

    const nameTrim = (nameRaw ?? "").trim();
    const phoneCompact = (phoneRaw ?? "")
      .toLowerCase()
      .replaceAll("+", "")
      .replaceAll("-", "")
      .replaceAll("(", "")
      .replaceAll(")", "")
      .replaceAll(" ", "")
      .replaceAll(".", "")
      .replaceAll("/", "")
      .replaceAll("\t", "")
      .replaceAll("\r", "");

    db.run(
      "INSERT OR IGNORE INTO customers (name_raw, phone_raw, name_trim, phone_compact) VALUES (?, ?, ?, ?)",
      [nameRaw, phoneRaw, nameTrim, phoneCompact]
    );
    const row = db
      .query("SELECT id, name_raw, phone_raw FROM customers WHERE name_raw IS ? AND phone_raw IS ? LIMIT 1")
      .get(nameRaw, phoneRaw) as CustomerRow | null;
    if (!row) {
      set.status = 500;
      return { error: "Failed to create customer" };
    }
    return { id: row.id, nameRaw: row.name_raw, phoneRaw: row.phone_raw };
  })
  .get("/customers/:id", ({ params, set }) => {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id < 1) {
      set.status = 400;
      return { error: "Invalid id" };
    }
    const row = db.query("SELECT id, name_raw, phone_raw FROM customers WHERE id = ? LIMIT 1").get(id) as CustomerRow | null;
    if (!row) {
      set.status = 404;
      return { error: "Not found" };
    }
    return { id: row.id, nameRaw: row.name_raw, phoneRaw: row.phone_raw };
  })
  .patch("/customers/:id", ({ params, body, set }) => {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id < 1) {
      set.status = 400;
      return { error: "Invalid id" };
    }
    const parsed = zCustomerPatch.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { error: parsed.error.message };
    }
    const existing = db.query("SELECT id FROM customers WHERE id = ? LIMIT 1").get(id) as { id: number } | null;
    if (!existing) {
      set.status = 404;
      return { error: "Not found" };
    }
    const patch = parsed.data;
    const nameRaw = patch.nameRaw === undefined ? undefined : patch.nameRaw ?? null;
    const phoneRaw = patch.phoneRaw === undefined ? undefined : patch.phoneRaw ?? null;
    const nameTrim = nameRaw === undefined ? undefined : (nameRaw ?? "").trim();
    const phoneCompact =
      phoneRaw === undefined
        ? undefined
        : (phoneRaw ?? "")
          .toLowerCase()
          .replaceAll("+", "")
          .replaceAll("-", "")
          .replaceAll("(", "")
          .replaceAll(")", "")
          .replaceAll(" ", "")
          .replaceAll(".", "")
          .replaceAll("/", "")
          .replaceAll("\t", "")
          .replaceAll("\r", "");

    const fields: string[] = [];
    const values: Array<string | null | number> = [];
    if (nameRaw !== undefined) {
      fields.push("name_raw = ?");
      values.push(nameRaw);
      fields.push("name_trim = ?");
      values.push(nameTrim ?? "");
    }
    if (phoneRaw !== undefined) {
      fields.push("phone_raw = ?");
      values.push(phoneRaw);
      fields.push("phone_compact = ?");
      values.push(phoneCompact ?? "");
    }
    values.push(id);
    try {
      db.run(`UPDATE customers SET ${fields.join(", ")} WHERE id = ?`, values);
    } catch {
      set.status = 409;
      return { error: "Update failed (possibly duplicate customer identity)" };
    }
    const row = db.query("SELECT id, name_raw, phone_raw FROM customers WHERE id = ? LIMIT 1").get(id) as CustomerRow | null;
    if (!row) {
      set.status = 500;
      return { error: "Failed to load updated customer" };
    }
    return { id: row.id, nameRaw: row.name_raw, phoneRaw: row.phone_raw };
  })
  .delete("/customers/:id", ({ params, set }) => {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id < 1) {
      set.status = 400;
      return { error: "Invalid id" };
    }
    const existing = db.query("SELECT id FROM customers WHERE id = ? LIMIT 1").get(id) as { id: number } | null;
    if (!existing) {
      set.status = 404;
      return { error: "Not found" };
    }
    db.run("UPDATE orders SET customer_id = NULL WHERE customer_id = ?", [id]);
    db.run("DELETE FROM customers WHERE id = ?", [id]);
    set.status = 204;
    return null;
  })
  .get("/waiters", ({ query, set }) => {
    const parsed = zListQuery.safeParse(query);
    if (!parsed.success) {
      set.status = 400;
      return { error: "Invalid query" };
    }

    const limit = parseLimit(parsed.data.limit);
    let afterId = 0;
    try {
      afterId = parseAfterId(parsed.data.cursor);
    } catch {
      set.status = 400;
      return { error: "Invalid cursor" };
    }

    const take = limit + 1;
    const rows = db.query(listWaitersSql).all(afterId, take) as WaiterRow[];
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore && page.length ? encodeCursor({ id: page[page.length - 1]!.id }) : null;
    return { items: page.map((r) => ({ id: r.id, nameRaw: r.name_raw, phoneRaw: r.phone_raw })), nextCursor, hasMore };
  })
  .post("/waiters", ({ body, set }) => {
    const parsed = zWaiterCreate.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { error: parsed.error.message };
    }
    const nameRaw = parsed.data.nameRaw ?? null;
    const phoneRaw = parsed.data.phoneRaw ?? null;

    const nameTrim = (nameRaw ?? "").trim();
    const phoneCompact = (phoneRaw ?? "")
      .toLowerCase()
      .replaceAll("+", "")
      .replaceAll("-", "")
      .replaceAll("(", "")
      .replaceAll(")", "")
      .replaceAll(" ", "")
      .replaceAll(".", "")
      .replaceAll("/", "")
      .replaceAll("\t", "")
      .replaceAll("\r", "");

    db.run(
      "INSERT OR IGNORE INTO waiters (name_raw, phone_raw, name_trim, phone_compact) VALUES (?, ?, ?, ?)",
      [nameRaw, phoneRaw, nameTrim, phoneCompact]
    );
    const row = db
      .query("SELECT id, name_raw, phone_raw FROM waiters WHERE name_raw IS ? AND phone_raw IS ? LIMIT 1")
      .get(nameRaw, phoneRaw) as WaiterRow | null;
    if (!row) {
      set.status = 500;
      return { error: "Failed to create waiter" };
    }
    return { id: row.id, nameRaw: row.name_raw, phoneRaw: row.phone_raw };
  })
  .get("/waiters/:id", ({ params, set }) => {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id < 1) {
      set.status = 400;
      return { error: "Invalid id" };
    }
    const row = db.query("SELECT id, name_raw, phone_raw FROM waiters WHERE id = ? LIMIT 1").get(id) as WaiterRow | null;
    if (!row) {
      set.status = 404;
      return { error: "Not found" };
    }
    return { id: row.id, nameRaw: row.name_raw, phoneRaw: row.phone_raw };
  })
  .patch("/waiters/:id", ({ params, body, set }) => {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id < 1) {
      set.status = 400;
      return { error: "Invalid id" };
    }
    const parsed = zWaiterPatch.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { error: parsed.error.message };
    }
    const existing = db.query("SELECT id FROM waiters WHERE id = ? LIMIT 1").get(id) as { id: number } | null;
    if (!existing) {
      set.status = 404;
      return { error: "Not found" };
    }
    const patch = parsed.data;
    const nameRaw = patch.nameRaw === undefined ? undefined : patch.nameRaw ?? null;
    const phoneRaw = patch.phoneRaw === undefined ? undefined : patch.phoneRaw ?? null;
    const nameTrim = nameRaw === undefined ? undefined : (nameRaw ?? "").trim();
    const phoneCompact =
      phoneRaw === undefined
        ? undefined
        : (phoneRaw ?? "")
          .toLowerCase()
          .replaceAll("+", "")
          .replaceAll("-", "")
          .replaceAll("(", "")
          .replaceAll(")", "")
          .replaceAll(" ", "")
          .replaceAll(".", "")
          .replaceAll("/", "")
          .replaceAll("\t", "")
          .replaceAll("\r", "");

    const fields: string[] = [];
    const values: Array<string | null | number> = [];
    if (nameRaw !== undefined) {
      fields.push("name_raw = ?");
      values.push(nameRaw);
      fields.push("name_trim = ?");
      values.push(nameTrim ?? "");
    }
    if (phoneRaw !== undefined) {
      fields.push("phone_raw = ?");
      values.push(phoneRaw);
      fields.push("phone_compact = ?");
      values.push(phoneCompact ?? "");
    }
    values.push(id);
    try {
      db.run(`UPDATE waiters SET ${fields.join(", ")} WHERE id = ?`, values);
    } catch {
      set.status = 409;
      return { error: "Update failed (possibly duplicate waiter identity)" };
    }
    const row = db.query("SELECT id, name_raw, phone_raw FROM waiters WHERE id = ? LIMIT 1").get(id) as WaiterRow | null;
    if (!row) {
      set.status = 500;
      return { error: "Failed to load updated waiter" };
    }
    return { id: row.id, nameRaw: row.name_raw, phoneRaw: row.phone_raw };
  })
  .delete("/waiters/:id", ({ params, set }) => {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id < 1) {
      set.status = 400;
      return { error: "Invalid id" };
    }
    const existing = db.query("SELECT id FROM waiters WHERE id = ? LIMIT 1").get(id) as { id: number } | null;
    if (!existing) {
      set.status = 404;
      return { error: "Not found" };
    }
    db.run("UPDATE orders SET waiter_id = NULL WHERE waiter_id = ?", [id]);
    db.run("DELETE FROM waiters WHERE id = ?", [id]);
    set.status = 204;
    return null;
  })
  .get("/orders", ({ query, set }) => {
    const parsed = zListQuery.safeParse(query);
    if (!parsed.success) {
      set.status = 400;
      return { error: "Invalid query" };
    }

    const limit = parseLimit(parsed.data.limit);
    let afterId = 0;
    try {
      afterId = parseAfterId(parsed.data.cursor);
    } catch {
      set.status = 400;
      return { error: "Invalid cursor" };
    }

    const take = limit + 1;
    const rows = db.query(listOrdersSql).all(afterId, take) as OrderListRow[];

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    const items = page.map((r) => ({
      id: r.id,
      orderIdRaw: r.order_id_raw,
      tableRaw: r.table_raw,
      orderDateRaw: r.order_date_raw,
      statusRaw: r.status_raw,
      priceRaw: r.price_raw,
      customer: r.customer_id
        ? { id: r.customer_id, nameRaw: r.customer_name_raw, phoneRaw: r.customer_phone_raw }
        : null,
      waiter: r.waiter_id
        ? { id: r.waiter_id, nameRaw: r.waiter_name_raw, phoneRaw: r.waiter_phone_raw }
        : null,
    }));

    const nextCursor = hasMore && page.length ? encodeCursor({ id: page[page.length - 1]!.id }) : null;

    return { items, nextCursor, hasMore };
  })
  .post("/orders", ({ body, set }) => {
    const parsed = zOrderCreate.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { error: parsed.error.message };
    }

    const o = parsed.data;
    let newId: number | null = null;
    try {
      db.run(
        `INSERT INTO orders (
          order_id_raw, customer_id, waiter_id, table_raw, food_items_raw, order_date_raw, status_raw, metadata_raw, price_raw
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          o.orderIdRaw,
          o.customerId ?? null,
          o.waiterId ?? null,
          o.tableRaw ?? null,
          o.foodItemsRaw ?? null,
          o.orderDateRaw ?? null,
          o.statusRaw ?? null,
          o.metadataRaw ?? null,
          o.priceRaw ?? null,
        ]
      );
      const idRow = db.query("SELECT last_insert_rowid() AS id").get() as { id: number } | null;
      newId = idRow?.id ?? null;
    } catch (e) {
      set.status = 409;
      return { error: "Order already exists or insert failed" };
    }

    if (!newId) {
      set.status = 500;
      return { error: "Failed to determine created id" };
    }

    const row = db.query(getOrderSql).get(newId) as OrderDetailRow | null;
    if (!row) {
      set.status = 500;
      return { error: "Failed to load created order" };
    }
    return {
      id: row.id,
      orderIdRaw: row.order_id_raw,
      tableRaw: row.table_raw,
      foodItemsRaw: row.food_items_raw,
      orderDateRaw: row.order_date_raw,
      statusRaw: row.status_raw,
      metadataRaw: row.metadata_raw,
      priceRaw: row.price_raw,
      customer: row.customer_id
        ? { id: row.customer_id, nameRaw: row.customer_name_raw, phoneRaw: row.customer_phone_raw }
        : null,
      waiter: row.waiter_id
        ? { id: row.waiter_id, nameRaw: row.waiter_name_raw, phoneRaw: row.waiter_phone_raw }
        : null,
    };
  })
  .get("/orders/:id", ({ params, set }) => {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id < 1) {
      set.status = 400;
      return { error: "Invalid id" };
    }

    const row = db.query(getOrderSql).get(id) as OrderDetailRow | null;
    if (!row) {
      set.status = 404;
      return { error: "Not found" };
    }

    const items = db
      .query("SELECT idx, item_raw FROM order_items WHERE order_id = ? ORDER BY idx ASC")
      .all(id) as OrderItemRow[];

    return {
      id: row.id,
      orderIdRaw: row.order_id_raw,
      tableRaw: row.table_raw,
      foodItemsRaw: row.food_items_raw,
      orderDateRaw: row.order_date_raw,
      statusRaw: row.status_raw,
      metadataRaw: row.metadata_raw,
      priceRaw: row.price_raw,
      customer: row.customer_id
        ? { id: row.customer_id, nameRaw: row.customer_name_raw, phoneRaw: row.customer_phone_raw }
        : null,
      waiter: row.waiter_id
        ? { id: row.waiter_id, nameRaw: row.waiter_name_raw, phoneRaw: row.waiter_phone_raw }
        : null,
      items: items.map((it) => ({ idx: it.idx, itemRaw: it.item_raw })),
    };
  })
  .patch("/orders/:id", ({ params, body, set }) => {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id < 1) {
      set.status = 400;
      return { error: "Invalid id" };
    }

    const parsed = zOrderPatch.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { error: parsed.error.message };
    }

    const existing = db.query("SELECT id FROM orders WHERE id = ? LIMIT 1").get(id) as { id: number } | null;
    if (!existing) {
      set.status = 404;
      return { error: "Not found" };
    }

    const patch = parsed.data;
    const fields: string[] = [];
    const values: Array<string | number | null> = [];

    if (patch.orderIdRaw !== undefined) {
      fields.push("order_id_raw = ?");
      values.push(patch.orderIdRaw);
    }
    if (patch.customerId !== undefined) {
      fields.push("customer_id = ?");
      values.push(patch.customerId === null ? null : patch.customerId);
    }
    if (patch.waiterId !== undefined) {
      fields.push("waiter_id = ?");
      values.push(patch.waiterId === null ? null : patch.waiterId);
    }
    if (patch.tableRaw !== undefined) {
      fields.push("table_raw = ?");
      values.push(patch.tableRaw ?? null);
    }
    if (patch.foodItemsRaw !== undefined) {
      fields.push("food_items_raw = ?");
      values.push(patch.foodItemsRaw ?? null);
    }
    if (patch.orderDateRaw !== undefined) {
      fields.push("order_date_raw = ?");
      values.push(patch.orderDateRaw ?? null);
    }
    if (patch.statusRaw !== undefined) {
      fields.push("status_raw = ?");
      values.push(patch.statusRaw ?? null);
    }
    if (patch.metadataRaw !== undefined) {
      fields.push("metadata_raw = ?");
      values.push(patch.metadataRaw ?? null);
    }
    if (patch.priceRaw !== undefined) {
      fields.push("price_raw = ?");
      values.push(patch.priceRaw ?? null);
    }

    values.push(id);

    try {
      db.run(`UPDATE orders SET ${fields.join(", ")} WHERE id = ?`, values);
    } catch {
      set.status = 409;
      return { error: "Update failed (possibly duplicate orderIdRaw)" };
    }

    const row = db.query(getOrderSql).get(id) as OrderDetailRow | null;
    if (!row) {
      set.status = 500;
      return { error: "Failed to load updated order" };
    }
    return {
      id: row.id,
      orderIdRaw: row.order_id_raw,
      tableRaw: row.table_raw,
      foodItemsRaw: row.food_items_raw,
      orderDateRaw: row.order_date_raw,
      statusRaw: row.status_raw,
      metadataRaw: row.metadata_raw,
      priceRaw: row.price_raw,
      customer: row.customer_id
        ? { id: row.customer_id, nameRaw: row.customer_name_raw, phoneRaw: row.customer_phone_raw }
        : null,
      waiter: row.waiter_id
        ? { id: row.waiter_id, nameRaw: row.waiter_name_raw, phoneRaw: row.waiter_phone_raw }
        : null,
    };
  })
  .delete("/orders/:id", ({ params, set }) => {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id < 1) {
      set.status = 400;
      return { error: "Invalid id" };
    }
    const existing = db.query("SELECT id FROM orders WHERE id = ? LIMIT 1").get(id) as { id: number } | null;
    if (!existing) {
      set.status = 404;
      return { error: "Not found" };
    }
    db.run("DELETE FROM orders WHERE id = ?", [id]);
    set.status = 204;
    return null;
  })
  .listen(3001);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
