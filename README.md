# Job Application Tracker

A web app for managing a job search from one dashboard: applications, a Kanban pipeline, interviews, documents and analytics.

**Stack:** Next.js 16 · React 19 · Auth.js v5 · Redux Toolkit · Tailwind CSS 4 · Express 5 · PostgreSQL · Prisma 7 · Cloudinary · dnd-kit · Recharts · Playwright/Vitest

## Status

- [x] **Phase 1 — Planning & design** (see [`docs/`](./docs))
- [x] **Phase 2 — Backend (Express + Prisma)**: auth, profile, applications (CRUD, status history, search/filter/sort/pagination), Kanban board, interviews, documents (local disk storage for now) and dashboard analytics
  - Remaining: avatar upload. API tests: 143 passing.
- [x] **Phase 3 — Frontend (Next.js)**: Redux Toolkit + RTK Query; dashboard (stat tiles, weekly activity chart with table view, pipeline and status bars); applications list/form/details; Kanban board (drag & drop, keyboard, optimistic updates); interviews (schedule/edit, upcoming/past/calendar, outcomes, time zones); documents (upload, versions, preview/download, attach); settings (profile, email change, password, sessions, delete account)
- [ ] Phase 4 — Testing & deployment — **in progress:** API tests (143) and Playwright end-to-end tests (41) done; deployment next

## Design Docs

| Doc | Contents |
|---|---|
| [01 Requirements](docs/01-requirements.md) | Requirements with IDs, architecture decisions, non-functional requirements, analytics definitions, sitemap |
| [02 Database schema](docs/02-database-schema.md) | ERD, table notes, delete behaviour, Kanban ordering, indexes |
| [`schema.prisma`](server/prisma/schema.prisma) | Prisma schema |
| [03 API endpoints](docs/03-api-endpoints.md) | REST endpoints, request/response shapes, error format |
| [04 Wireframes](docs/04-wireframes.md) | Wireframes for every screen, design tokens, component list |

## Repository Layout

```
job-application-tracker/
  client/   Next.js app + Auth.js (port 3000) — proxies /api/v1/* to the API
  server/   Express API + Prisma (port 4000)
  e2e/      Playwright end-to-end tests
  docs/     Design documents
```

## Running Locally

Prerequisites: Node.js 22+, PostgreSQL 16+.

**1. Create the database** (once):

```bash
sudo -u postgres psql -c "CREATE ROLE jat WITH LOGIN CREATEDB PASSWORD 'jat_dev_password';"
sudo -u postgres createdb -O jat job_tracker
```

**2. Configure environment** (once). Copy the examples and set the same `AUTH_SECRET` and `INTERNAL_API_SECRET` in both files (`openssl rand -base64 33`):

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env.local
```

**3. Install, migrate and run** (two terminals):

```bash
cd server && npm install && npm run db:migrate && npm run dev   # http://localhost:4000/api/v1/health
cd client && npm install && npm run dev                          # http://localhost:3000
```

Without SMTP settings, verification and password-reset emails are **printed in the server terminal**. Copy the link from there.

| Script (server) | Does |
|---|---|
| `npm run dev` | API with auto-restart |
| `npm run db:migrate` | Create/apply migrations (dev) |
| `npm run db:deploy` | Apply migrations (production) |
| `npm run db:studio` | Browse the database in Prisma Studio |
| `npm test` | API tests (Vitest + Supertest). Uses a separate `job_tracker_test` database, created automatically; your dev data is never touched. |

## Testing

**API tests** (Vitest + Supertest, 143 tests). They use a separate `job_tracker_test` database, created automatically; your dev data is never touched.

```bash
cd server && npm test
```

**End-to-end tests** (Playwright, 41 tests across sign-in, applications, board, interviews, documents, settings and the dashboard):

```bash
cd e2e
npm install
npx playwright install chromium   # once
npm test                          # npm run report → HTML report of the last run
```

- They run against the dev servers on ports 3000 and 4000, and start them if they aren't running.
- Test accounts are created directly in the **dev database** as `e2e-…@example.com` (never any other address; see `server/scripts/e2e-db.js`) and are deleted, with their uploaded files, when the run ends.
- `PW_CHANNEL=chrome npm test` uses your installed Google Chrome instead of Playwright's Chromium.
- On failure, a screenshot and a trace are kept in `e2e/test-results/` (`npx playwright show-trace <trace.zip>`).

