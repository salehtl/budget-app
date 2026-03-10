# Test Framework Design

## Decision

Add Vitest-based testing covering three tiers: pure logic, database queries, and React components.

## Stack

- **Runner:** Vitest (extends existing Vite config)
- **DOM:** happy-dom
- **Component testing:** @testing-library/react + @testing-library/user-event
- **DB testing:** better-sqlite3 (in-memory SQLite, same SQL dialect as wa-sqlite)
- **Files:** Colocated (`*.test.ts` / `*.test.tsx` next to source)

## Architecture

```
vitest.config.ts          — extends vite.config, adds test settings
src/test/                 — shared test utilities
  setup.ts                — global setup (happy-dom, cleanup)
  db-helpers.ts           — in-memory SQLite factory: creates DB, runs schema, optional seed
  render-helpers.ts       — wraps render() with providers (DbContext, ToastProvider, Router)
```

## Three Test Tiers

### Tier 1 — Pure Logic (no DOM, no DB)

Target modules: `format.ts`, `zakat-utils.ts`, `stream-parser.ts`, `db-events.ts`, category matching in `parse-statement.ts`.

Fastest tests, no special setup beyond Vitest.

### Tier 2 — Database Queries (in-memory SQLite, no DOM)

Each test gets a fresh in-memory DB with schema applied. `db-helpers.ts` exposes `createTestDb()` returning a mock DbClient backed by better-sqlite3. Tests call actual query functions against real SQL.

```ts
// src/test/db-helpers.ts
export function createTestDb(): { exec, close } {
  const raw = new Database(":memory:");
  // Run schema DDL, enable foreign keys
  // Return exec<T>(sql, params) matching DbClient interface
}
```

Key insight: query modules accept a DbClient with `exec()` — swap in better-sqlite3 with the same interface.

### Tier 3 — Components (happy-dom + testing-library)

`render-helpers.ts` provides `renderWithProviders()` wrapping DbContext, ToastProvider, TanStack Router.

- **Unit tests:** Individual components (StatusPill, CategoryCombo, MonthPicker)
- **Integration tests:** Critical flows (cashflow inline-add, PDF import review modal)

## Scripts

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage"
}
```

## Starter Test Targets

Prioritized by value-to-effort ratio:

1. `src/lib/format.ts` — formatCurrency, formatDate, getCurrentMonth
2. `src/lib/pdf-import/stream-parser.ts` — incremental JSON parsing
3. `src/components/zakat/zakat-utils.ts` — calculation engine (madhab-aware, multiple modes)
4. `src/db/queries/categories.ts` — CRUD against in-memory DB
5. `src/db/queries/transactions.ts` — CRUD + filtering
6. `src/components/ui/CategoryCombo.tsx` — keyboard nav, filtering, ARIA
7. `src/components/cashflow/SingleMonthView.tsx` — inline add flow (integration)
