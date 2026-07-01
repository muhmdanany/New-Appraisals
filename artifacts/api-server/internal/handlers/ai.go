package handlers

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	"competency/internal/ai"
	"competency/internal/httpx"
)

func (h *Handler) aiError(w http.ResponseWriter, err error) {
	if errors.Is(err, ai.ErrNotConfigured) {
		httpx.Error(w, http.StatusPreconditionFailed, "ميزة الذكاء الاصطناعي غير مفعّلة. أضف مفتاح OpenRouter في إعدادات الخادم.")
		return
	}
	httpx.Error(w, http.StatusBadGateway, "تعذّر إكمال طلب الذكاء الاصطناعي. حاول مجدداً لاحقاً.")
}

type generateCompetenciesRequest struct {
	JobID string `json:"jobId"`
}

// GenerateCompetencies handles POST /competencies/generate.
func (h *Handler) GenerateCompetencies(w http.ResponseWriter, r *http.Request) {
	var req generateCompetenciesRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.WriteErr(w, err)
		return
	}
	if !required(w, req.JobID, "jobId") {
		return
	}
	job, err := h.Store.JobByID(r.Context(), req.JobID)
	if err != nil {
		httpx.WriteErr(w, err)
		return
	}
	if job == nil {
		httpx.Error(w, http.StatusNotFound, "Job not found")
		return
	}
	result, err := h.AI.GenerateCompetencies(r.Context(), job.Name, job.Description)
	if err != nil {
		h.aiError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, result)
}

// GenerateJobDescription handles POST /jobs/{id}/generate-description.
func (h *Handler) GenerateJobDescription(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	job, err := h.Store.JobByID(r.Context(), id)
	if err != nil {
		httpx.WriteErr(w, err)
		return
	}
	if job == nil {
		httpx.Error(w, http.StatusNotFound, "Job not found")
		return
	}
	names, err := h.Store.JobCompetencyNames(r.Context(), id)
	if err != nil {
		httpx.WriteErr(w, err)
		return
	}
	desc, err := h.AI.GenerateJobDescription(r.Context(), job.Name, names, job.DepartmentName, job.GradeName)
	if err != nil {
		h.aiError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"description": desc})
}

// GenerateKpis handles POST /kpis/{jobId}/generate.
func (h *Handler) GenerateKpis(w http.ResponseWriter, r *http.Request) {
	jobID := chi.URLParam(r, "jobId")
	job, err := h.Store.JobByID(r.Context(), jobID)
	if err != nil {
		httpx.WriteErr(w, err)
		return
	}
	if job == nil {
		httpx.Error(w, http.StatusNotFound, "Job not found")
		return
	}
	names, err := h.Store.JobCompetencyNames(r.Context(), jobID)
	if err != nil {
		httpx.WriteErr(w, err)
		return
	}
	result, err := h.AI.GenerateKpis(r.Context(), job.Name, names)
	if err != nil {
		h.aiError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, result)
}

type generateCareerPathRequest struct {
	Field string `json:"field"`
}

// GenerateCareerPath handles POST /career-paths/generate.
func (h *Handler) GenerateCareerPath(w http.ResponseWriter, r *http.Request) {
	var req generateCareerPathRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.WriteErr(w, err)
		return
	}
	if !required(w, req.Field, "field") {
		return
	}
	result, err := h.AI.GenerateCareerPath(r.Context(), req.Field)
	if err != nil {
		h.aiError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, result)
}
