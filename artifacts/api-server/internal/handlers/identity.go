package handlers

import (
	"net/http"

	"competency/internal/domain"
	"competency/internal/httpx"
	"competency/internal/identity"
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

// ListUsers handles GET /users, returning the selectable identities.
func (h *Handler) ListUsers(w http.ResponseWriter, r *http.Request) {
	users, err := h.Store.ListUsers(r.Context())
	if err != nil {
		httpx.WriteErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, users)
}
