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

## web dev workflow DIDNT_OPEN_A_PORT was a toml/port MISMATCH (fixable)
Symptom: `artifacts/web: web` shows vite "ready" on a port but the workflow is
marked FAILED (DIDNT_OPEN_A_PORT). Root cause here: the artifact.toml had been
hand-edited to `localPort = 5000`, but the system auto-assigned the service to a
DIFFERENT port (22333, where vite actually listened) — so the supervisor/proxy
watched 5000 and never saw an open port.
**Why:** artifact port assignment is automatic and cannot be hand-specified;
editing `artifact.toml` in place (instead of via `verifyAndReplaceArtifactToml`)
drifts the toml's localPort away from the real assigned port and away from the
workflow.
**How to apply:** check the actual port in the vite log vs `[[services]]
localPort` in `.replit-artifact/artifact.toml`. Align them by writing a temp
`artifact.edit.toml` (full content) with `localPort` AND `[services.env] PORT`
set to the real assigned port (cross-check `.replit` `[[ports]]`), then run the
`verifyAndReplaceArtifactToml` callback (NOT a direct edit) and restart the
workflow. Never hand-edit artifact.toml in place.

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

## Dev seed & AI key
Seed users (incl. an admin) are created by `cmd/seed/main.go` — read it for the
current dev login emails/passwords; do not hardcode credentials elsewhere. AI
endpoints return 412 (Arabic message) until `OPENROUTER_API_KEY` is set.

## RBAC: frontend manage gating MUST mirror backend route guards
Mutation routes in `internal/router/router.go` use `rbac` groups: AdminOnly =
[ADMIN] (competencies, grades, jobs, employees, kpis, career-paths
create/update/delete); Evaluators = [ADMIN, FIRST_LEVEL_MANAGER]
(evaluation create/edit/submit); Approvers = [ADMIN, SECOND_LEVEL_MANAGER]
(approve/reject); acknowledge/object = any authed.
**Why:** `useCanManage()` defaulting wider than the backend makes privileged
non-admins (e.g. HR_MANAGER) see create/edit buttons that 403.
**How to apply:** gate each page's manage UI with the exact role set of its
mutation endpoint; default `useCanManage` is [ADMIN].

## Enum fields must be dropdowns, not free-text
Backend `validateEnum` rejects invalid enum values with 400. contractType (jobs)
and competency level/type are Postgres enums — render them as `SelectField`s with
valid options + a sane default, never free-text inputs.
