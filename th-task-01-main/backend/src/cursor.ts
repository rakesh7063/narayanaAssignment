export type CursorPayload = {
  id: number;
};

function parsePayload(raw: unknown): CursorPayload {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Invalid cursor payload");
  }
  const o = raw as Record<string, unknown>;
  if (!("id" in o)) {
    throw new Error("Invalid cursor payload");
  }
  const id = o.id;
  if (typeof id !== "number" || !Number.isInteger(id) || id < 1) {
    throw new Error("Invalid cursor id");
  }
  return { id };
}

export function encodeCursor(payload: CursorPayload): string {
  const json = JSON.stringify(parsePayload(payload));
  return Buffer.from(json, "utf8").toString("base64url");
}

export function decodeCursor(encoded: string): CursorPayload {
  const buf = Buffer.from(encoded, "base64url");
  const json = buf.toString("utf8");
  return parsePayload(JSON.parse(json));
}
