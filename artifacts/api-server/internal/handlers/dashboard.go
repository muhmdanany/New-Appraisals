package handlers

import (
	"net/http"

	"competency/internal/httpx"
)

// DashboardStats handles GET /dashboard/stats.
func (h *Handler) DashboardStats(w http.ResponseWriter, r *http.Request) {
	st, err := h.Store.DashboardStats(r.Context())
	if err != nil {
		httpx.WriteErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, st)
}

// DashboardAnalytics handles GET /dashboard/analytics.
func (h *Handler) DashboardAnalytics(w http.ResponseWriter, r *http.Request) {
	a, err := h.Store.DashboardAnalytics(r.Context())
	if err != nil {
		httpx.WriteErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, a)
}
