---
name: Competency Platform Go+React port
description: Gotchas porting the HR Competency Platform from Next.js/tRPC/Prisma to a Go(chi/pgx) backend + React frontend
---

# Competency Platform (Go backend + React frontend)

## No migration runner — schema applied manually
There is NO automatic migration runner in the Go api-server. The DB schema is
applied by hand from `artifacts/api-server/internal/db/migrations/0001_init.sql`
(e.g. `psql "$DATABASE_URL" < 0001_init.sql`). Seeding is `cmd/seed/main.go`.

**Why:** editing `0001_init.sql` does NOT change an already-provisioned DB.
**How to apply:** when you add/change a column, edit `0001_init.sql` AND run an
explicit `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` against the live DB. The
deployed/production DB needs the same manual application step.

## web dev workflow port-detection is an accepted infra blocker
The `artifacts/web: web` dev workflow fails `DIDNT_OPEN_A_PORT` on every port
(vite reaches "ready" and binds, but supervisor openPorts stays null).
`configureWorkflow` is prohibited (artifact-managed), and bash/code_execution
both kill background processes (exit 143), so a manual vite for screenshots
won't stay alive.
**Why:** infra-level; it does NOT affect production — deployment serves the
static `dist/public` vite build, which builds fine.
**How to apply:** don't chase this for dev preview/e2e/screenshots; verify the
frontend via `pnpm --filter @workspace/web run typecheck` + production build, and
the backend via curl through `localhost:80/api/...`.

## Canonical Role enum (backend source of truth)
`ADMIN, HR_MANAGER, FIRST_LEVEL_MANAGER, SECOND_LEVEL_MANAGER, EMPLOYEE`
(matches original Prisma). RBAC groups live in `internal/rbac/rbac.go`; route
guards in `internal/router/router.go`. Frontend nav role gating in
`web/src/components/layout.tsx` must mirror those guards (GeneralRead =
ADMIN+HR_MANAGER; HRRead = all except EMPLOYEE; KPIs = AdminOnly; Evaluators =
ADMIN+FIRST_LEVEL; Approvers = ADMIN+SECOND_LEVEL).

## Contract source of truth
`lib/api-spec/openapi.yaml` is authoritative; Go handlers/structs must match its
JSON shapes (regenerate client via `pnpm --filter @workspace/api-spec run
codegen` only when the spec itself changes). Backend struct json tags drifting
from the spec is a recurring bug class here (e.g. report rows, PolicySet.labels).

## Admin login (dev seed)
`admin@hr.local` / `Password123!`. AI endpoints return 412 (Arabic message)
until `OPENROUTER_API_KEY` is set.
