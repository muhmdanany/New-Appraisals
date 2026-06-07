# منصة الكفاءات الوظيفية — Enterprise HR Competency Platform

Arabic-first, RTL, secure HR platform for tracking job competencies, evaluations,
grades, KPIs, and career paths. Migrated from a single-file prototype to a
production-grade Next.js application.

## Tech stack

Next.js 14 (App Router) · TypeScript (strict) · tRPC v11 · Prisma · PostgreSQL ·
Auth.js v5 · Tailwind + shadcn/ui (RTL) · TanStack Query · Zod · Vitest.

## Prerequisites

- Node.js 20+
- **Docker Desktop** (for the local PostgreSQL database) — must be installed and
  running. Download: https://www.docker.com/products/docker-desktop/

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Copy env (already present as .env for local dev)
cp .env.example .env        # then set AUTH_SECRET in production

# 3. Start PostgreSQL (requires Docker Desktop running)
docker compose up -d

# 4. Apply the schema and seed demo data
npm run db:setup            # = prisma migrate deploy && prisma db seed

# 5. Run the app
npm run dev                 # http://localhost:3000
```

## Demo accounts

All seeded users share the password **`Password123!`**.

| Email             | Role                  | Capability                                              |
| ----------------- | --------------------- | ------------------------------------------------------- |
| `admin@hr.local`  | ADMIN                 | Full system, manage data + users, create evaluations    |
| `hr@hr.local`     | HR_MANAGER            | Read-only: all evaluations + dashboards                 |
| `mgr2@hr.local`   | SECOND_LEVEL_MANAGER  | Approve/reject first-level managers' evaluations        |
| `mgr1@hr.local`   | FIRST_LEVEL_MANAGER   | Evaluate own direct reports                             |
| `emp@hr.local`    | EMPLOYEE              | View own result, confirm/object                         |

## Useful scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm run lint` | ESLint |
| `npm run test` | Vitest unit tests |
| `npm run db:migrate` | Create/apply a dev migration |
| `npm run db:deploy` | Apply committed migrations |
| `npm run db:seed` | Seed reference + demo data |
| `npm run db:studio` | Open Prisma Studio |

## Architecture

```
UI (App Router)  →  tRPC routers (transport)  →  services (business logic)  →  Prisma (data)
```

- Shared **Zod** validators in `src/lib/validators` (client + server).
- Business logic in `src/server/services` (e.g. the evaluation scoring engine).
- RBAC: route protection in `src/middleware.ts`, procedure guards in
  `src/server/api/trpc.ts`, hierarchy scoping in `src/server/services/rbac.ts`.
- All authenticated mutations are written to the `AuditLog` automatically.

See `CLAUDE.md` for the full build plan and development rules.

## Deployment (Docker)

The app ships as a multi-stage Docker image using Next.js **standalone** output
(small image, non-root user). `Dockerfile` exposes three useful targets:
`runner` (the app), `migrator` (runs `prisma migrate deploy`), and `builder`.

### Option A — Self-hosted stack (app + Postgres)

Brings up Postgres, applies migrations once, then starts the app:

```bash
AUTH_SECRET=$(openssl rand -base64 32) \
  docker compose -f docker-compose.prod.yml up --build
# → http://localhost:3000
```

Seed reference/demo data once (optional):

```bash
docker compose -f docker-compose.prod.yml run --rm migrate npx prisma db seed
```

### Option B — App container + external DB (e.g. Supabase)

```bash
docker build -t competency-platform .

# Apply migrations (run once, from CI or locally):
docker build -t competency-migrator --target migrator .
docker run --rm -e DATABASE_URL=... -e DIRECT_URL=... competency-migrator

# Run the app:
docker run -p 3000:3000 \
  -e DATABASE_URL=... -e DIRECT_URL=... \
  -e AUTH_SECRET=... -e AUTH_URL=https://your-domain \
  -e AUTH_TRUST_HOST=true \
  -e AI_ENABLED=true -e GEMINI_API_KEY=... \
  competency-platform
```

### Required runtime env

| Var | Notes |
| --- | --- |
| `DATABASE_URL` | Pooled connection (app runtime) |
| `DIRECT_URL` | Direct connection (migrations) |
| `AUTH_SECRET` | `openssl rand -base64 32` — **required** |
| `AUTH_URL` | Public URL of the app (e.g. `https://hr.example.com`) |
| `AUTH_TRUST_HOST` | `true` behind a proxy (set by default in the image) |
| `AI_ENABLED`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` | Optional — AI features (OpenRouter) |

> Managed hosts (Vercel, etc.) can deploy directly from the repo without Docker;
> set the same env vars and run `npm run db:deploy` in the release step.
