package handlers

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"competency/internal/httpx"
	"competency/internal/rbac"
	"competency/internal/store"
)

// ListGrades handles GET /grades.
func (h *Handler) ListGrades(w http.ResponseWriter, r *http.Request) {
	grades, err := h.Store.ListGrades(r.Context())
	if err != nil {
		httpx.WriteErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, grades)
}

// CreateGrade handles POST /grades.
func (h *Handler) CreateGrade(w http.ResponseWriter, r *http.Request) {
	var in store.GradeInput
	if err := httpx.Decode(r, &in); err != nil {
		httpx.WriteErr(w, err)
		return
	}
	if !required(w, in.Num, "num") || !required(w, in.Name, "name") {
		return
	}
	id, err := h.Store.UpsertGrade(r.Context(), in)
	if err != nil {
		httpx.WriteErr(w, err)
		return
	}
	g, err := h.Store.GradeByID(r.Context(), id)
	if err != nil {
		httpx.WriteErr(w, err)
		return
	}
	h.audit(r, "grade.create", "Grade", &id)
	httpx.JSON(w, http.StatusCreated, g)
}

// UpdateGrade handles PUT /grades/{id}.
func (h *Handler) UpdateGrade(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var in store.GradeInput
	if err := httpx.Decode(r, &in); err != nil {
		httpx.WriteErr(w, err)
		return
	}
	if !required(w, in.Num, "num") || !required(w, in.Name, "name") {
		return
	}
	uid, err := h.Store.UpsertGrade(r.Context(), in)
	if err != nil {
		httpx.WriteErr(w, err)
		return
	}
	_ = id // id used for routing; upsert uses num
	g, err := h.Store.GradeByID(r.Context(), uid)
	if err != nil {
		httpx.WriteErr(w, err)
		return
	}
	h.audit(r, "grade.update", "Grade", &uid)
	httpx.JSON(w, http.StatusOK, g)
}

type importGradesRequest struct {
	Rows []store.GradeInput `json:"rows"`
}

// ImportGrades handles POST /grades/import.
func (h *Handler) ImportGrades(w http.ResponseWriter, r *http.Request) {
	var req importGradesRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.WriteErr(w, err)
		return
	}
	count := 0
	for _, row := range req.Rows {
		if row.Num == "" || row.Name == "" {
			continue
		}
		if _, err := h.Store.UpsertGrade(r.Context(), row); err != nil {
			httpx.WriteErr(w, err)
			return
		}
		count++
	}
	h.audit(r, "grade.import", "Grade", nil)
	httpx.JSON(w, http.StatusOK, map[string]int{"imported": count})
}

// DeleteGrade handles DELETE /grades/{id}. Restricted to ADMIN/HR_MANAGER.
func (h *Handler) DeleteGrade(w http.ResponseWriter, r *http.Request) {
	u, ok := h.requireUser(w, r)
	if !ok {
		return
	}
	if !rbac.HasOrgWideAccess(u.Role) {
		httpx.Error(w, http.StatusForbidden, "Forbidden")
		return
	}
	id := chi.URLParam(r, "id")
	deleted, err := h.Store.DeleteGrade(r.Context(), id)
	if err != nil {
		writeDBErr(w, err)
		return
	}
	if !deleted {
		httpx.Error(w, http.StatusNotFound, "الدرجة غير موجودة")
		return
	}
	h.audit(r, "grade.delete", "Grade", &id)
	httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
