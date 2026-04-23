# Restaurant Orders Assignment

A full-stack restaurant order reporting system built with Bun, Elysia, SQLite, and React.
This project demonstrates a clean migration from messy legacy orders data to a typed, queryable schema, exposes CRUD and cursor-based pagination APIs, and renders a staff-facing orders table UI with TanStack Table.

## Project structure

- `backend/`
  - `src/` - Elysia API server and migration logic
  - `scripts/` - seed and helper scripts for the database
  - `migrations/` - SQL migration files for normalizing legacy data
  - `package.json` - backend scripts and dependencies
- `frontend/`
  - `src/` - React UI using TanStack Table and TanStack Router
  - `package.json` - frontend scripts and dependencies
- `database/orders.db` - SQLite database file created by the seed script
- `INSTRUCTIONS.md` - assignment requirements and project goals

## Key functionality

- Normalizes legacy `orders` data into typed tables: `orders`, `customers`, `waiters`, and `order_items`
- Uses Zod for request validation and response shaping
- Implements cursor-based pagination for listing orders
- Provides full CRUD operations for orders, customers, and waiters
- Builds a polished staff orders table UI with cursor-based "Load more" pagination

## Prerequisites

- Bun installed: https://bun.sh
- Git (optional)
- A terminal on your machine

## Setup

### 1. Install dependencies

```bash
cd backend
bun install

cd ../frontend
bun install
```

### 2. Seed the database

```bash
cd backend
bun run db:seed
```

### 3. Run migrations

```bash
cd backend
bun run db:migrate
```

> The migration normalizes the legacy `orders` table and creates the required `customers`, `waiters`, and `order_items` tables.

## Running the app

### Backend

```bash
cd backend
bun run dev
```

Backend server is available at `http://localhost:3001`.

### Frontend

```bash
cd frontend
bun run dev
```

Frontend app is available at `http://localhost:3000`.

## Recommended workflow

1. Start backend first: `cd backend && bun run dev`
2. Start frontend second: `cd frontend && bun run dev`
3. Open the app at `http://localhost:3000`
4. Visit the orders page to view cursor-based pagination and raw order data

## Common troubleshooting

### `Request failed (500): no such table: customers`

This can happen when the legacy database has not been migrated yet or if the migration state is inconsistent.

Fix:

```bash
cd backend
bun run db:migrate
```

If the problem persists, recreate the database from seed and rerun migrations:

```bash
cd backend
bun run db:seed
bun run db:migrate
```

## Backend scripts

- `bun run dev` — starts the backend API server
- `bun run db:seed` — populates `database/orders.db` with seed data
- `bun run db:migrate` — applies SQL migrations to normalize the schema
- `bun run lint` — runs ESLint over backend source files

## Frontend scripts

- `bun run dev` — starts the frontend development server
- `bun run build` — builds the production frontend bundle
- `bun run preview` — previews the production build locally
- `bun run test` — runs frontend tests

## Notes

- The backend listens on port `3001`
- The frontend development server uses port `3000`
- The UI uses cursor-based pagination so the orders list grows by appending pages instead of using offset-based queries

## Contact

If you need any further clarification on the assignment or the setup, inspect `INSTRUCTIONS.md` and the backend migration logic in `backend/src/migrate.ts`.
