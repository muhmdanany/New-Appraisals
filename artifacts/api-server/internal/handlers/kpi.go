package handlers

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"competency/internal/httpx"
	"competency/internal/store"
)

// ListKpis handles GET /kpis (job coverage list).
func (h *Handler) ListKpis(w http.ResponseWriter, r *http.Request) {
	items, err := h.Store.ListJobKpiStatus(r.Context())
	if err != nil {
		httpx.WriteErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}

// GetKpiSet handles GET /kpis/{jobId}.
func (h *Handler) GetKpiSet(w http.ResponseWriter, r *http.Request) {
	ks, err := h.Store.KpiSetByJob(r.Context(), chi.URLParam(r, "jobId"))
	if err != nil {
		httpx.WriteErr(w, err)
		return
	}
	if ks == nil {
		httpx.JSON(w, http.StatusOK, nil)
		return
	}
	httpx.JSON(w, http.StatusOK, ks)
}

// SaveKpiSet handles PUT /kpis/{jobId}.
func (h *Handler) SaveKpiSet(w http.ResponseWriter, r *http.Request) {
	jobID := chi.URLParam(r, "jobId")
	var in store.KpiSetInput
	if err := httpx.Decode(r, &in); err != nil {
		httpx.WriteErr(w, err)
		return
	}
	if err := h.Store.SaveKpiSet(r.Context(), jobID, in); err != nil {
		httpx.WriteErr(w, err)
		return
	}
	ks, _ := h.Store.KpiSetByJob(r.Context(), jobID)
	h.audit(r, "kpi.save", "KpiSet", &jobID)
	httpx.JSON(w, http.StatusOK, ks)
}
