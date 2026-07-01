---
name: Competency Platform (منصة الكفاءات) port
description: HR platform ported to Go + React; how identity/scoping works and where authorization must live.
---

# Competency Platform — identity & scoping model

The app is Arabic/RTL. **Always respond to the user in Arabic.**

## Password-less identity (by design)
- No login/session/password. The frontend shows a "simple identity selector" (pick your name),
  stores the chosen user id in localStorage, and sends it as the `X-User-Id` request header.
- The backend resolves `X-User-Id` into a request-scoped user via identity middleware. The
  middleware **never rejects** — handlers call `requireUser` and return 401 (Arabic) when absent.
- **X-User-Id can be forged** — this is accepted within the current threat model (password-less).
  Do NOT treat spoofing as a bug unless the product adds real authentication.

## Authorization must be enforced server-side, per handler
**Why:** frontend nav/action gating is UX-only. Every sensitive endpoint must independently
enforce identity + role/scope, or it leaks/mutates data across scopes (Broken Access Control).
**How to apply:** the router puts everything except health + `/users` (the pre-identity picker)
behind a `RequireAuth` group; administrative catalog mutations (jobs, competencies, grades, KPIs,
career paths, employees) are wrapped with `RequireOrgWide` (ADMIN/HR) via `r.With(admin)`.
Evaluation/report handlers self-enforce finer role+subtree scope internally. When adding ANY new
endpoint, put it in the authed group and add the matching middleware / in-handler `requireUser` +
role check. A missing check is a real security hole, not a style issue.

### Role rules (roles: ADMIN, HR_MANAGER, FIRST_LEVEL_MANAGER, SECOND_LEVEL_MANAGER, EMPLOYEE)
- Org-wide read/reports and employee record mutations (create/update/import): ADMIN + HR_MANAGER
  (`rbac.HasOrgWideAccess`).
- Create/edit evaluations, evaluation form-data, department-distribution: evaluators = ADMIN +
  FIRST_LEVEL_MANAGER (`rbac.Evaluators`); first-level is further limited to their subtree
  (`visibleScope`).
- Approve/reject evaluations: ADMIN + SECOND_LEVEL_MANAGER (`rbac.Approvers`).
- Acknowledge/object: only the evaluated employee (`u.EmployeeID == ev.EmployeeID`).
- Managers see only their reporting subtree of employees; ADMIN/HR see everyone.

## Gotchas
- `go build ./...` / `go vet ./...` must each be a **single isolated bash command**; chaining with
  `&&` (or any multi-step) can trip the git `index.lock` destructive-op guard. If a stale
  zero-byte `.git/index.lock` blocks a build, retry after a few seconds — the checkpoint process
  clears it.
- OpenAPI `info.title` must stay `Api` (controls generated filenames). Run
  `pnpm --filter @workspace/api-spec run codegen` separately.
- After editing a `lib/*` package (e.g. api-client-react `custom-fetch.ts`), run
  `pnpm run typecheck:libs` before web typecheck — web resolves the lib's built `.d.ts`, so stale
  declarations cause phantom "no exported member" errors.
- `ImportEmployees` handler exists but is not wired to a route in the router.
