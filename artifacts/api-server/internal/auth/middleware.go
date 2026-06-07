package auth

import (
	"net/http"

	"competency/internal/domain"
	"competency/internal/httpx"
	"competency/internal/rbac"
	"competency/internal/store"
)

// Middleware resolves sessions and enforces role-based access.
type Middleware struct {
	Store *store.Store
}

// Resolve loads the user (if any) from the session cookie into the context.
// It never rejects the request; downstream guards decide what auth is required.
func (m *Middleware) Resolve(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		c, err := r.Cookie(CookieName)
		if err == nil && c.Value != "" {
			if uid, err := m.Store.SessionUserID(r.Context(), c.Value); err == nil && uid != "" {
				if u, err := m.Store.UserByID(r.Context(), uid); err == nil && u != nil && u.IsActive {
					r = r.WithContext(WithUser(r.Context(), u))
				}
			}
		}
		next.ServeHTTP(w, r)
	})
}

// RequireAuth ensures an authenticated user is present.
func RequireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if UserFrom(r.Context()) == nil {
			httpx.Error(w, http.StatusUnauthorized, "Authentication required")
			return
		}
		next(w, r)
	}
}

// RequireRoles ensures the authenticated user holds one of the allowed roles.
func RequireRoles(roles []domain.Role, next http.HandlerFunc) http.HandlerFunc {
	return RequireAuth(func(w http.ResponseWriter, r *http.Request) {
		u := UserFrom(r.Context())
		if !rbac.In(roles, u.Role) {
			httpx.Error(w, http.StatusForbidden, "You do not have permission to perform this action")
			return
		}
		next(w, r)
	})
}
