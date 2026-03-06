# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Personal finance PWA (YNAB-like). Local-first, no server dependency. Currency: AED (UAE Dirham). Light theme only.

## Stack

- Runtime: Bun
- Framework: React 19 + TanStack Router (SPA, file-based routes)
- Build: Vite 7
- Styling: Tailwind CSS v4 (`@theme` block in globals.css for design tokens)
- UI: Custom shadcn-inspired components (no Radix dependency — built on native HTML elements)
- Charts: Recharts
- Database: wa-sqlite (WASM) via Web Worker — OPFS primary, IndexedDB fallback
- PWA: vite-plugin-pwa + Workbox
- Validation: Zod
- Language: TypeScript (strict mode)

## Commands

- `bun run dev` — Start dev server
- `bun run build` — Production build
- `bun run preview` — Preview production build

## Architecture

### Database Layer

The DB is the single source of truth — no external state library.

1. **Web Worker** (`worker/db-worker.ts`) — Runs wa-sqlite async, initializes with OPFS (falls back to IndexedDB), enables WAL mode and foreign keys
2. **DbClient** (`src/db/client.ts`) — Promise-based `exec<T>(sql, params)` wrapping postMessage/onmessage with request ID tracking
3. **React Context** (`src/context/DbContext.tsx`) — Provides singleton DbClient via `useDb()` hook, handles loading/error states
4. **Schema** (`src/db/schema.ts`) — All DDL, versioned via `PRAGMA user_version` (currently version 1)
5. **Query Modules** (`src/db/queries/`) — Typed async functions accepting DbClient: `transactions.ts`, `categories.ts`, `recurring.ts`, `settings.ts`
6. **Seed Data** (`src/db/seed.ts`) — ~30 default categories with hierarchy, colors, icons

### Data Flow

```
Component -> Custom Hook (useTransactions, useCategories, etc.)
  -> db.exec(sql, params) -> Worker -> wa-sqlite -> result
  -> After mutation: emitDbEvent("transactions-changed")
  -> Other hooks subscribed via onDbEvent() auto-refresh
```

### Event Bus (`src/lib/db-events.ts`)

Simple EventTarget pub/sub for cross-hook cache invalidation. Event types: `transactions-changed`, `categories-changed`, `recurring-changed`, `settings-changed`, `tags-changed`.

### Routes

TanStack Router file-based routing in `src/routes/`. Auto-generates `routeTree.gen.ts` via plugin. Each route exports via `createFileRoute()`.

- `__root.tsx` — Layout: wraps app with DbProvider, ToastProvider, Sidebar, MobileNav
- `index.tsx` — Dashboard with charts
- `transactions.tsx`, `categories.tsx`, `recurring.tsx`, `settings.tsx`

### Custom Hooks (`src/hooks/`)

Each hook calls `useDb()`, provides `{ data, loading, refresh, add, update, remove }` pattern, and subscribes to the event bus for auto-refresh.

## Key Conventions

- **Font:** TX-02 (OTF files in `public/fonts/`)
- **Colors:** CSS variables in `src/globals.css` using custom naming (`--color-accent`, `--color-surface`, `--color-text-muted`, etc.)
- **Class merging:** Use `cn()` from `src/lib/utils.ts` (clsx + tailwind-merge)
- **Formatting:** `formatCurrency()`, `formatDate()`, `getCurrentMonth()` from `src/lib/format.ts`
- **Toasts:** Custom ToastProvider context (`src/components/ui/Toast.tsx`) — use `useToast()` hook
- **Modals/Dialogs:** `<Modal />` wrapping HTML `<dialog>`, `<ConfirmDialog />` for confirm/cancel
- **UI Components** (`src/components/ui/`): Button (variants: primary/secondary/danger/ghost), Input, Select, Card, Badge, EmptyState, etc.
- **Icons:** Inline SVG components defined in component files (not using an icon library)
- **Path alias:** `@/*` maps to `./src/*`

## Important Config (vite.config.ts)

- **COOP/COEP headers** required for OPFS: `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp`
- **Worker format:** ES modules
- **wa-sqlite** excluded from optimizeDeps (installed from `github:rhashimoto/wa-sqlite`, not npm)

## Schema (Tables)

`categories` (hierarchical, color/icon, is_income/is_system flags) | `transactions` (amount, type, category_id, date, payee, notes) | `recurring_transactions` (frequency, next_occurrence, mode) | `tags` + `transaction_tags` (many-to-many) | `budgets` (category budgets by month) | `settings` (key-value store)
