import { Elysia } from "elysia";
import { db } from "./db";
import { decodeCursor, encodeCursor } from "./cursor";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

type OrderRow = {
  rowid: number;
  order_id: string;
  customer_name: string;
  customer_phone: string;
  table_number: string;
  waiter_name: string;
  waiter_phone: string;
  food_items: string;
};

const listSql = `
  SELECT rowid AS rowid, order_id, customer_name, customer_phone, table_number, waiter_name, waiter_phone, food_items
  FROM orders
  WHERE rowid > ?
  ORDER BY rowid ASC
  LIMIT ?
`;

const app = new Elysia()
  .get("/", () => "Hello Elysia")
  .get("/orders", ({ query, set }) => {
    const rawLimit = query.limit;
    const limit =
      rawLimit === undefined || rawLimit === ""
        ? DEFAULT_LIMIT
        : Math.min(
          MAX_LIMIT,
          Math.max(1, Math.floor(Number(rawLimit)) || DEFAULT_LIMIT)
        );

    let afterRowid = 0;
    const cursorParam = query.cursor;
    if (cursorParam !== undefined && cursorParam !== "") {
      try {
        const c = decodeCursor(cursorParam);
        afterRowid = c.rowid;
      } catch {
        set.status = 400;
        return { error: "Invalid cursor" };
      }
    }

    const stmt = db.query(listSql);
    const take = limit + 1;
    const rows = stmt.all(afterRowid, take) as OrderRow[];

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    const items = page.map(({ rowid: _r, ...rest }) => rest);

    let nextCursor: string | null = null;
    if (hasMore && page.length > 0) {
      const last = page[page.length - 1];
      nextCursor = encodeCursor({
        rowid: last.rowid,
        order_id: last.order_id,
      });
    }

    return {
      items,
      nextCursor,
      hasMore,
    };
  })
  .listen(3001);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
