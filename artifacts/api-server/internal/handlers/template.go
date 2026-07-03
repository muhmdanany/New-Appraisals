package handlers

import (
	"net/http"

	"competency/internal/httpx"
	"competency/internal/store"

	"github.com/go-chi/chi/v5"
)

// ListTemplates handles GET /admin/templates.
func (h *Handler) ListTemplates(w http.ResponseWriter, r *http.Request) {
	evalType := r.URL.Query().Get("evalType")
	list, err := h.Store.ListTemplates(r.Context(), evalType)
	if err != nil {
		httpx.WriteErr(w, err)
		return
	}
	if list == nil {
		list = []store.TemplateSummary{}
	}
	httpx.JSON(w, http.StatusOK, list)
}

// GetTemplate handles GET /admin/templates/{id}.
func (h *Handler) GetTemplate(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	t, err := h.Store.GetTemplate(r.Context(), id)
	if err != nil {
		httpx.WriteErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, t)
}

// CreateTemplate handles POST /admin/templates.
func (h *Handler) CreateTemplate(w http.ResponseWriter, r *http.Request) {
	var in store.TemplateSaveInput
	if err := httpx.Decode(r, &in); err != nil {
		httpx.WriteErr(w, err)
		return
	}
	if !required(w, in.Name, "name") {
		return
	}
	t, err := h.Store.CreateTemplate(r.Context(), in)
	if err != nil {
		httpx.WriteErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, t)
}

// UpdateTemplate handles PUT /admin/templates/{id}.
func (h *Handler) UpdateTemplate(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var in store.TemplateSaveInput
	if err := httpx.Decode(r, &in); err != nil {
		httpx.WriteErr(w, err)
		return
	}
	if !required(w, in.Name, "name") {
		return
	}
	t, err := h.Store.UpdateTemplate(r.Context(), id, in)
	if err != nil {
		httpx.WriteErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, t)
}

// DeleteTemplate handles DELETE /admin/templates/{id}.
func (h *Handler) DeleteTemplate(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.Store.DeleteTemplate(r.Context(), id); err != nil {
		httpx.WriteErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// DuplicateTemplate handles POST /admin/templates/{id}/duplicate.
func (h *Handler) DuplicateTemplate(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	t, err := h.Store.DuplicateTemplate(r.Context(), id)
	if err != nil {
		httpx.WriteErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, t)
}
