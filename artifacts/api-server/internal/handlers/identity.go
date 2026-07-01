package handlers

import (
        "net/http"

        "competency/internal/domain"
        "competency/internal/httpx"
        "competency/internal/identity"
        "competency/internal/rbac"
)

// requireUser returns the acting user resolved from the identity header, or
// writes a 401 asking the client to pick a user when no identity is present.
func (h *Handler) requireUser(w http.ResponseWriter, r *http.Request) (*domain.User, bool) {
        u := identity.UserFrom(r.Context())
        if u == nil {
                httpx.Error(w, http.StatusUnauthorized, "يجب اختيار المستخدم أولاً من القائمة.")
                return nil, false
        }
        return u, true
}

// RequireAuth is middleware that rejects requests without a selected identity.
func (h *Handler) RequireAuth(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
                if _, ok := h.requireUser(w, r); !ok {
                        return
                }
                next.ServeHTTP(w, r)
        })
}

// RequireOrgWide is middleware allowing only org-wide roles (ADMIN/HR_MANAGER).
// Used to gate administrative catalog mutations (jobs, competencies, grades,
// KPIs, career paths, employees).
func (h *Handler) RequireOrgWide(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
                u, ok := h.requireUser(w, r)
                if !ok {
                        return
                }
                if !rbac.HasOrgWideAccess(u.Role) {
                        httpx.Error(w, http.StatusForbidden, "Forbidden")
                        return
                }
                next.ServeHTTP(w, r)
        })
}

// ListUsers handles GET /users, returning the selectable identities.
func (h *Handler) ListUsers(w http.ResponseWriter, r *http.Request) {
        users, err := h.Store.ListUsers(r.Context())
        if err != nil {
                httpx.WriteErr(w, err)
                return
        }
        httpx.JSON(w, http.StatusOK, users)
}
