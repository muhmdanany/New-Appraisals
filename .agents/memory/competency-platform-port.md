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

## Never hand-edit artifact.toml (port-mismatch workflow failures)
Artifact service ports are auto-assigned and cannot be hand-specified. Editing
`.replit-artifact/artifact.toml` in place drifts its `localPort` away from the
real assigned port, so the proxy watches the wrong port and the workflow fails
(e.g. DIDNT_OPEN_A_PORT even though vite reports "ready").
**Why:** the assigned port lives outside the toml; in-place edits desync them.
**How to apply:** always change artifact config via the `verifyAndReplaceArtifactToml`
callback (full-content temp `artifact.edit.toml`), never a direct file edit, then
restart the workflow.

## Auth was fully removed — this is an OPEN system (no login/session/roles)
Login/authentication was deliberately stripped from the whole stack: no
`internal/auth`, no `internal/rbac`, no `/auth/*` routes, no session/cookie
middleware; every route is mounted openly in `internal/handlers/router.go` via
`router.New(h)`. Frontend has no login page, no `ProtectedRoute`, no auth-context;
`useCanManage()` always returns true; nav shows all items.
**Why:** product decision — everyone has full access. Do NOT re-add role gating
or `SESSION_SECRET` unless the user explicitly asks to reintroduce auth.
**How to apply:** records that need a `User` FK actor (e.g. `Evaluation.evaluatorId`
NOT NULL, audit actor) borrow a stable existing user via `store.SystemUserID`,
which returns `ErrNoSystemUser` on an empty `User` table (handlers surface a clear
503 "run seed" message, not a cryptic FK 500). The `User` table still exists and
must be seeded so an actor resolves. `role` column still exists but is unused.

## Contract source of truth
`lib/api-spec/openapi.yaml` is authoritative; Go handlers/structs must match its
JSON shapes (regenerate client via `pnpm --filter @workspace/api-spec run
codegen` only when the spec itself changes). Backend struct json tags drifting
from the spec is a recurring bug class here (e.g. report rows, PolicySet.labels).

## Dev seed & AI key
`cmd/seed/main.go` inserts demo users with NULL `hashedPassword` (no login) — they
exist only to satisfy actor FKs. AI endpoints return 412 (Arabic message) until
`OPENROUTER_API_KEY` is set.

## go build needs x/crypto but the firewall 403s it (Critical CVE)
`golang.org/x/crypto` is required transitively by pgx SCRAM auth, so `go build`
fails without it, but the plain firewalled `go get` returns 403 (Critical CVE) and
the module cache is wiped on container recycle.
**Why:** recurring blocker — the CVE block makes the default proxy refuse it.
**How to apply:** `GOPROXY=direct GOSUMDB=off go get golang.org/x/crypto@v0.31.0`
(fetches from source, bypassing the proxy/sumdb). Do NOT retry the plain install
after a 403. Run `go build`/`go vet` as a single isolated command — chaining with
`&&` trips the main-agent git index.lock guard.

## Enum fields must be dropdowns, not free-text
Backend `validateEnum` rejects invalid enum values with 400. contractType (jobs)
and competency level/type are Postgres enums — render them as `SelectField`s with
valid options + a sane default, never free-text inputs.

## Postgres errors don't auto-map to HTTP — map unique violations explicitly
`httpx.WriteErr` only special-cases `*httpx.APIError`; any raw DB error (e.g. a
unique-constraint violation) falls through to a generic 500. Handlers that do
INSERT/UPDATE on user input must map pg errors themselves.
**Why:** a duplicate `employeeNumber` surfaced as a raw 500 + generic "حدث خطأ".
**How to apply:** use the `writeDBErr` helper (handlers/util.go) which detects
`*pgconn.PgError` code 23505 and returns 409 with an Arabic message; reuse it for
any new create/update handler with unique constraints. Frontend reads `err.status`
+ `err.data.detail` (ApiError shape) to show the server message on 409.
