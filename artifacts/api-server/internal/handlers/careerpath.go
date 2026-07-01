package handlers

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v4"

	"competency/internal/httpx"
	"competency/internal/store"
)

// ListCareerPaths handles GET /career-paths.
func (h *Handler) ListCareerPaths(w http.ResponseWriter, r *http.Request) {
	paths, err := h.Store.ListCareerPaths(r.Context())
	if err != nil {
		httpx.WriteErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, paths)
}

func (h *Handler) decodeCareerPath(w http.ResponseWriter, r *http.Request) (*store.CareerPathInput, bool) {
	var in store.CareerPathInput
	if err := httpx.Decode(r, &in); err != nil {
		httpx.WriteErr(w, err)
		return nil, false
	}
	if in.Stages == nil {
		in.Stages = []store.CareerStageInput{}
	}
	if !required(w, in.Name, "name") {
		return nil, false
	}
	return &in, true
}

// CreateCareerPath handles POST /career-paths.
func (h *Handler) CreateCareerPath(w http.ResponseWriter, r *http.Request) {
	in, ok := h.decodeCareerPath(w, r)
	if !ok {
		return
	}
	id, err := h.Store.SaveCareerPath(r.Context(), "", *in)
	if err != nil {
		httpx.WriteErr(w, err)
		return
	}
	cp, _ := h.Store.CareerPathByID(r.Context(), id)
	h.audit(r, "careerPath.create", "CareerPath", &id)
	httpx.JSON(w, http.StatusCreated, cp)
}

// UpdateCareerPath handles PUT /career-paths/{id}.
func (h *Handler) UpdateCareerPath(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	in, ok := h.decodeCareerPath(w, r)
	if !ok {
		return
	}
	_, err := h.Store.SaveCareerPath(r.Context(), id, *in)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusNotFound, "Career path not found")
		return
	}
	if err != nil {
		httpx.WriteErr(w, err)
		return
	}
	cp, _ := h.Store.CareerPathByID(r.Context(), id)
	h.audit(r, "careerPath.update", "CareerPath", &id)
	httpx.JSON(w, http.StatusOK, cp)
}
