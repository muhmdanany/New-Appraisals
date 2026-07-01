package handlers

import (
	"net/http"

	"competency/internal/httpx"
)

// ReportEvaluations handles GET /reports/evaluations.
func (h *Handler) ReportEvaluations(w http.ResponseWriter, r *http.Request) {
	rows, err := h.Store.ReportEvaluations(r.Context())
	if err != nil {
		httpx.WriteErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, rows)
}

// ReportBellCurve handles GET /reports/bell-curve.
func (h *Handler) ReportBellCurve(w http.ResponseWriter, r *http.Request) {
	data, err := h.Store.ReportBellCurveData(r.Context())
	if err != nil {
		httpx.WriteErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, data)
}

// ReportOrgTree handles GET /reports/org-tree. The system is open, so the full
// organization tree is always returned.
func (h *Handler) ReportOrgTree(w http.ResponseWriter, r *http.Request) {
	nodes, err := h.Store.OrgTree(r.Context(), nil, true)
	if err != nil {
		httpx.WriteErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, nodes)
}
