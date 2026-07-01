// Package identity resolves the acting user from a request header. The system
// has no passwords: the client picks an identity and sends its user id in the
// X-User-Id header. This middleware never rejects a request; handlers decide
// what identity a given action requires.
package identity

import (
	"context"
	"net/http"

	"competency/internal/domain"
	"competency/internal/store"
)

// HeaderName is the request header carrying the selected user id.
const HeaderName = "X-User-Id"

type ctxKey struct{}

// WithUser stores the acting user in the context.
func WithUser(ctx context.Context, u *domain.User) context.Context {
	return context.WithValue(ctx, ctxKey{}, u)
}

// UserFrom returns the acting user, or nil when no valid identity was supplied.
func UserFrom(ctx context.Context) *domain.User {
	u, _ := ctx.Value(ctxKey{}).(*domain.User)
	return u
}

// Resolver loads the acting user from the X-User-Id header into the context.
type Resolver struct {
	Store *store.Store
}

// Middleware resolves the identity header without rejecting the request.
func (m *Resolver) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if id := r.Header.Get(HeaderName); id != "" {
			if u, err := m.Store.UserByID(r.Context(), id); err == nil && u != nil && u.IsActive {
				r = r.WithContext(WithUser(r.Context(), u))
			}
		}
		next.ServeHTTP(w, r)
	})
}
