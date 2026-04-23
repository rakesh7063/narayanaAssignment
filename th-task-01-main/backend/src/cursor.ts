export type CursorPayload = {
  rowid: number;
  order_id: string;
};

function parsePayload(raw: unknown): CursorPayload {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Invalid cursor payload");
  }
  const o = raw as Record<string, unknown>;
  if (!("rowid" in o) || !("order_id" in o)) {
    throw new Error("Invalid cursor payload");
  }
  const rowid = o.rowid;
  const order_id = o.order_id;
  if (typeof rowid !== "number" || !Number.isInteger(rowid) || rowid < 1) {
    throw new Error("Invalid cursor rowid");
  }
  if (typeof order_id !== "string") {
    throw new Error("Invalid cursor order_id");
  }
  return { rowid, order_id };
}

export function encodeCursor(payload: CursorPayload): string {
  const json = JSON.stringify(parsePayload(payload));
  return Buffer.from(json, "utf8").toString("base64url");
}

export function decodeCursor(encoded: string): CursorPayload {
  const buf = Buffer.from(encoded, "base64url");
  const json = buf.toString("latin1");
  return parsePayload(JSON.parse(json));
}
