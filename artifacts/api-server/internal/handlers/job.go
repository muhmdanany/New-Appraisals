package handlers

import (
        "net/http"

        "github.com/go-chi/chi/v5"

        "competency/internal/domain"
        "competency/internal/httpx"
        "competency/internal/store"
)

// ListJobs handles GET /jobs.
func (h *Handler) ListJobs(w http.ResponseWriter, r *http.Request) {
        jobs, err := h.Store.ListJobs(r.Context(), qStr(r, "search"), qInt(r, "take"), qInt(r, "skip"))
        if err != nil {
                httpx.WriteErr(w, err)
                return
        }
        httpx.JSON(w, http.StatusOK, jobs)
}

// GetJob handles GET /jobs/{id}.
func (h *Handler) GetJob(w http.ResponseWriter, r *http.Request) {
        job, err := h.Store.JobByID(r.Context(), chi.URLParam(r, "id"))
        if err != nil {
                httpx.WriteErr(w, err)
                return
        }
        if job == nil {
                httpx.Error(w, http.StatusNotFound, "Job not found")
                return
        }
        httpx.JSON(w, http.StatusOK, job)
}

// JobProfile handles GET /jobs/{id}/profile.
func (h *Handler) JobProfile(w http.ResponseWriter, r *http.Request) {
        p, err := h.Store.JobProfile(r.Context(), chi.URLParam(r, "id"))
        if err != nil {
                httpx.WriteErr(w, err)
                return
        }
        if p == nil {
                httpx.Error(w, http.StatusNotFound, "Job not found")
                return
        }
        httpx.JSON(w, http.StatusOK, p)
}

func (h *Handler) decodeJob(w http.ResponseWriter, r *http.Request) (*store.JobInput, bool) {
        var in store.JobInput
        if err := httpx.Decode(r, &in); err != nil {
                httpx.WriteErr(w, err)
                return nil, false
        }
        if in.ContractType == "" {
                in.ContractType = "FULL_TIME"
        }
        in.DepartmentID = emptyToNil(in.DepartmentID)
        in.GradeID = emptyToNil(in.GradeID)
        in.ReportsToJobID = emptyToNil(in.ReportsToJobID)
        in.ExperienceLevel = emptyToNil(in.ExperienceLevel)
        in.Description = emptyToNil(in.Description)
        if in.CompetencyIDs == nil {
                in.CompetencyIDs = []string{}
        }
        if !required(w, in.Name, "name") || !validateEnum(w, domain.ContractTypes, in.ContractType, "contractType") {
                return nil, false
        }
        return &in, true
}

// CreateJob handles POST /jobs.
func (h *Handler) CreateJob(w http.ResponseWriter, r *http.Request) {
        in, ok := h.decodeJob(w, r)
        if !ok {
                return
        }
        id, err := h.Store.CreateJob(r.Context(), *in)
        if err != nil {
                httpx.WriteErr(w, err)
                return
        }
        job, _ := h.Store.JobByID(r.Context(), id)
        h.audit(r, "job.create", "Job", &id)
        httpx.JSON(w, http.StatusCreated, job)
}

// UpdateJob handles PUT /jobs/{id}.
func (h *Handler) UpdateJob(w http.ResponseWriter, r *http.Request) {
        id := chi.URLParam(r, "id")
        in, ok := h.decodeJob(w, r)
        if !ok {
                return
        }
        updated, err := h.Store.UpdateJob(r.Context(), id, *in)
        if err != nil {
                httpx.WriteErr(w, err)
                return
        }
        if !updated {
                httpx.Error(w, http.StatusNotFound, "Job not found")
                return
        }
        job, _ := h.Store.JobByID(r.Context(), id)
        h.audit(r, "job.update", "Job", &id)
        httpx.JSON(w, http.StatusOK, job)
}

type importJobsRequest struct {
        Rows []store.JobInput `json:"rows"`
}

// ImportJobs handles POST /jobs/import.
func (h *Handler) ImportJobs(w http.ResponseWriter, r *http.Request) {
        var req importJobsRequest
        if err := httpx.Decode(r, &req); err != nil {
                httpx.WriteErr(w, err)
                return
        }
        count := 0
        for _, row := range req.Rows {
                if row.Name == "" {
                        continue
                }
                if row.ContractType == "" {
                        row.ContractType = "FULL_TIME"
                }
                if _, err := h.Store.UpsertJobByName(r.Context(), row); err != nil {
                        httpx.WriteErr(w, err)
                        return
                }
                count++
        }
        h.audit(r, "job.import", "Job", nil)
        httpx.JSON(w, http.StatusOK, map[string]int{"imported": count})
}
