# Kiosk Production Tracker

Web app for tracking kiosk **build** and **repair** productivity on the GoTyme
factory floor. Tracks each kiosk individually (by serial) through a configurable
workflow and surfaces throughput, turnaround time, first-pass yield, and parts
consumption for ~24 users across 6 roles.

## Stack

- **Next.js 16** (App Router, TypeScript) + **Tailwind CSS 4**
- **Prisma 7** with a **driver adapter** — SQLite (`better-sqlite3`) for local
  dev, PostgreSQL (`@prisma/adapter-pg`) for production
- Lightweight session auth: bcrypt + signed JWT (`jose`) in an httpOnly cookie,
  with role-based access control

## Getting started

```bash
npm install
npx prisma migrate dev      # creates dev.db, applies the schema
npx prisma db seed          # seeds roles, users, teams, parts, demo units
npm run dev                 # http://localhost:3000
```

If `better-sqlite3`'s native binary was skipped during install (npm gates native
install scripts), build it explicitly once:

```bash
npm rebuild better-sqlite3
```

### Demo logins

All seeded accounts use the password **`changeme123`** (development only).

| Role | Email |
| --- | --- |
| Production Manager | `thabo.mahlangu@tymedigital.com` |
| Inventory Manager | `inventory.manager@kiosk.local` |
| Inventory Officer | `io1@kiosk.local`, `io2@kiosk.local` |
| Team Leader | `tl1@kiosk.local` … `tl3@kiosk.local` |
| Repair Technician | `tech1@kiosk.local` … `tech15@kiosk.local` |
| QA Technician | `qa1@kiosk.local`, `qa2@kiosk.local` |

## Project layout

```
prisma/schema.prisma       data model (portable to Postgres)
prisma/seed.ts             seed data
prisma.config.ts           Prisma 7 config (datasource URL, seed command)
src/lib/                   db (adapter), session, auth, rbac, enums, workflow
src/proxy.ts               optimistic auth redirect (Next 16 "Proxy" = middleware)
src/app/(auth)/login       login
src/app/(app)/…            dashboard, units, intake, queue, qa, inventory, reports, admin
src/components/            UI primitives + shared components
```

## Notes for the next developer

- **Next.js 16 renamed Middleware to Proxy** — the file is `src/proxy.ts`
  exporting `proxy()`. It only does an optimistic cookie check; real
  authorization lives in server components/actions via
  `requireUser()` / `requireAction()`.
- **Prisma 7 removed the `url` field from the schema.** The connection URL is in
  `prisma.config.ts` (for Migrate) and passed to `PrismaClient` via a driver
  adapter in `src/lib/db.ts`. To switch to Postgres: change the schema
  `datasource` provider to `postgresql`, set `DATABASE_URL`, swap the adapter to
  `@prisma/adapter-pg`, and run `prisma migrate dev`.
- Enum-like fields are `String` (SQLite has no enums); allowed values and the
  workflows live in `src/lib/enums.ts`.

## Roadmap

- ✅ **Phase 0/1** — foundation, auth/RBAC, intake, unit list, unit detail +
  stage timeline, stage advancement, technician queue
- ✅ **Phase 2** — QA inspections, pass/fail, rework loop, defect catalog →
  first-pass yield (on QA page + dashboard)
- ✅ **Phase 3** — inventory: catalog, receive/adjust/issue stock movements,
  low-stock alerts, issue-to-job → parts consumption & cost per unit
- ✅ **Phase 4** — reports: throughput (by day/team/tech), turnaround (end-to-end +
  per-stage), CSV export (serial, kind, turnaround_hours, first_qa, parts_cost)
- **Phase 5** — polish & deploy: audit log UI, barcode scanning, admin config, Docker
