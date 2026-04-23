export type CursorPage<T> = {
  items: T[]
  nextCursor: string | null
  hasMore: boolean
}

export type PersonRef = {
  id: number
  nameRaw: string | null
  phoneRaw: string | null
}

export type OrderListItem = {
  id: number
  orderIdRaw: string
  tableRaw: string | null
  orderDateRaw: string | null
  statusRaw: string | null
  priceRaw: string | null
  customer: PersonRef | null
  waiter: PersonRef | null
}

const API_BASE_URL =
  (import.meta as any).env?.VITE_API_BASE_URL ?? 'http://localhost:3001'

export async function listOrders(input: {
  limit?: number
  cursor?: string | null
}): Promise<CursorPage<OrderListItem>> {
  const url = new URL('/orders', API_BASE_URL)
  if (input.limit) url.searchParams.set('limit', String(input.limit))
  if (input.cursor) url.searchParams.set('cursor', input.cursor)

  const res = await fetch(url.toString(), {
    headers: { accept: 'application/json' },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Request failed (${res.status}): ${text || res.statusText}`)
  }
  return (await res.json()) as CursorPage<OrderListItem>
}

