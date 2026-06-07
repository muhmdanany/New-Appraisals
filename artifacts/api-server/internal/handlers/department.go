package handlers

import (
	"net/http"

	"competency/internal/httpx"
)

// ListDepartments handles GET /departments.
func (h *Handler) ListDepartments(w http.ResponseWriter, r *http.Request) {
	deps, err := h.Store.ListDepartments(r.Context())
	if err != nil {
		httpx.WriteErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, deps)
}
