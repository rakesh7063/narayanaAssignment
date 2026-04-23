import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
  flexRender,
} from '@tanstack/react-table'
import { listOrders, type OrderListItem } from '../lib/api'

export const Route = createFileRoute('/orders')({
  component: OrdersPage,
})

const columns: Array<ColumnDef<OrderListItem>> = [
  {
    header: 'Order ID',
    accessorKey: 'orderIdRaw',
    cell: (ctx) => (
      <span className="font-mono text-xs text-[var(--sea-ink)]">
        {String(ctx.getValue() ?? '')}
      </span>
    ),
  },
  {
    header: 'Customer',
    accessorFn: (row) => row.customer?.nameRaw ?? '',
    id: 'customerName',
    cell: ({ row }) => {
      const c = row.original.customer
      return c ? (
        <div className="leading-tight">
          <div className="font-semibold text-[var(--sea-ink)]">
            {c.nameRaw?.trim() ? c.nameRaw : '—'}
          </div>
          <div className="text-xs text-[var(--sea-ink-soft)]">{c.phoneRaw ?? ''}</div>
        </div>
      ) : (
        <span className="text-[var(--sea-ink-soft)]">—</span>
      )
    },
  },
  {
    header: 'Table',
    accessorKey: 'tableRaw',
    cell: (ctx) => (
      <span className="text-sm text-[var(--sea-ink)]">
        {String(ctx.getValue() ?? '—')}
      </span>
    ),
  },
  {
    header: 'Status',
    accessorKey: 'statusRaw',
    cell: (ctx) => {
      const v = String(ctx.getValue() ?? '')
      const label = v.trim() || '—'
      return (
        <span className="inline-flex items-center rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1 text-xs font-semibold text-[var(--sea-ink)]">
          {label}
        </span>
      )
    },
  },
  {
    header: 'Date (raw)',
    accessorKey: 'orderDateRaw',
    cell: (ctx) => (
      <span className="font-mono text-xs text-[var(--sea-ink-soft)]">
        {String(ctx.getValue() ?? '—')}
      </span>
    ),
  },
  {
    header: 'Price (raw)',
    accessorKey: 'priceRaw',
    cell: (ctx) => (
      <span className="font-mono text-xs text-[var(--sea-ink-soft)]">
        {String(ctx.getValue() ?? '—')}
      </span>
    ),
  },
  {
    header: 'Waiter',
    accessorFn: (row) => row.waiter?.nameRaw ?? '',
    id: 'waiterName',
    cell: ({ row }) => {
      const w = row.original.waiter
      return w ? (
        <div className="leading-tight">
          <div className="font-semibold text-[var(--sea-ink)]">
            {w.nameRaw?.trim() ? w.nameRaw : '—'}
          </div>
          <div className="text-xs text-[var(--sea-ink-soft)]">{w.phoneRaw ?? ''}</div>
        </div>
      ) : (
        <span className="text-[var(--sea-ink-soft)]">—</span>
      )
    },
  },
]

function OrdersPage() {
  const [rows, setRows] = React.useState<OrderListItem[]>([])
  const [nextCursor, setNextCursor] = React.useState<string | null>(null)
  const [hasMore, setHasMore] = React.useState(true)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(
    async (mode: 'initial' | 'more') => {
      setIsLoading(true)
      setError(null)
      try {
        const page = await listOrders({
          limit: 25,
          cursor: mode === 'more' ? nextCursor : null,
        })
        setRows((prev) => (mode === 'more' ? [...prev, ...page.items] : page.items))
        setNextCursor(page.nextCursor)
        setHasMore(page.hasMore)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setIsLoading(false)
      }
    },
    [nextCursor],
  )

  React.useEffect(() => {
    void load('initial')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  return (
    <main className="page-wrap px-4 pb-10 pt-14">
      <section className="island-shell rise-in rounded-[2rem] px-6 py-8 sm:px-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="island-kicker mb-2">Staff</p>
            <h1 className="display-title text-3xl font-bold text-[var(--sea-ink)] sm:text-4xl">
              Orders
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--sea-ink-soft)]">
              Cursor-based pagination, raw fields preserved from messy seed data.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              className="rounded-full border border-[rgba(23,58,64,0.2)] bg-white/60 px-5 py-2.5 text-sm font-semibold text-[var(--sea-ink)] transition hover:-translate-y-0.5 hover:border-[rgba(23,58,64,0.35)] disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => void load('initial')}
              disabled={isLoading}
            >
              Refresh
            </button>
            <button
              className="rounded-full border border-[rgba(50,143,151,0.3)] bg-[rgba(79,184,178,0.14)] px-5 py-2.5 text-sm font-semibold text-[var(--lagoon-deep)] no-underline transition hover:-translate-y-0.5 hover:bg-[rgba(79,184,178,0.24)] disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => void load('more')}
              disabled={isLoading || !hasMore}
            >
              {hasMore ? 'Load more' : 'No more'}
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--line)] bg-white/60">
          <div className="overflow-auto">
            <table className="min-w-[980px] w-full border-collapse text-left text-sm">
              <thead className="bg-white/70">
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id} className="border-b border-[var(--line)]">
                    {hg.headers.map((h) => (
                      <th
                        key={h.id}
                        className="whitespace-nowrap px-4 py-3 text-xs font-semibold tracking-wide text-[var(--sea-ink-soft)]"
                      >
                        {h.isPlaceholder
                          ? null
                          : flexRender(h.column.columnDef.header, h.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="px-4 py-10 text-center text-sm text-[var(--sea-ink-soft)]"
                    >
                      {isLoading ? 'Loading…' : 'No orders found.'}
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-[var(--line)] last:border-b-0 hover:bg-[rgba(79,184,178,0.06)]"
                    >
                      {r.getVisibleCells().map((c) => (
                        <td key={c.id} className="px-4 py-3 align-top">
                          {flexRender(c.column.columnDef.cell, c.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] bg-white/50 px-4 py-3 text-xs text-[var(--sea-ink-soft)]">
            <span>
              Showing <span className="font-semibold text-[var(--sea-ink)]">{rows.length}</span>{' '}
              row(s)
            </span>
            <span className="font-mono">
              nextCursor: {nextCursor ? nextCursor : 'null'}
            </span>
          </div>
        </div>
      </section>
    </main>
  )
}

