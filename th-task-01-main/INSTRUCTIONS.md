# Assessment Code: TH-FS-001

You’ve inherited a small restaurant ordering system that was built quickly and now needs to support reporting and a better operator UI. The existing SQLite database contains real-world “messy” orders data. Your job is to migrate it into a typed, queryable schema, expose it via a REST API, and build a simple orders table UI for staff.

## Context

- **DB**: `database/orders.db` (seed script: `backend/scripts/seed-orders-db.ts`)
- **Backend**: Bun + Elysia + `bun:sqlite` (`backend/`)
- **Frontend**: TanStack Start/Router + React + Tailwind (`frontend/`)

The seed data is intentionally messy (mixed encodings, inconsistent formats, Unicode, empty/placeholder values). **Do not assume one encoding or one format.**

## What you must deliver

### 1) Migration + schema

- Design and implement a migration that normalizes the existing `orders` table into a **typed, queryable schema**.
- You may redesign the database, but keep the solution to **a maximum of 4 tables**.
- **No data loss (strict)**: all information represented in the current dataset must remain representable after the migration (even if moved to different columns/tables).

### 2) REST API (CRUD)

- Implement **CRUD** for orders (and any related entities you introduce).
- **Zod is required (strict)** for request validation and response shaping.
- Lint must remain green (an ESLint rule blocks Joi/Yup/etc).

### 3) Cursor-based pagination only (strict)

- Any list endpoint must use **cursor-based pagination** (keyset pagination).
- **Offset-based pagination is not allowed**.
- Your list responses must include:
  - `items`
  - `nextCursor` (nullable)
  - `hasMore` (boolean)

### 4) Frontend (TanStack Table)

- Build an orders table UI using **TanStack Table**.
- Pagination in the UI must be **cursor-based** (next/load-more) using the API.

## Working agreement

- You are expected to **read and improve the provided starter code** as needed to meet the requirements.
- It’s okay to add dependencies (e.g. Zod), but keep the solution focused.

