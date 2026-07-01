package handlers

import (
        "net/http"

        "github.com/go-chi/chi/v5"

        "competency/internal/domain"
        "competency/internal/httpx"
        "competency/internal/store"
)

// ListCompetencies handles GET /competencies.
func (h *Handler) ListCompetencies(w http.ResponseWriter, r *http.Request) {
        f := store.CompetencyFilter{
                Search: qStr(r, "search"),
                Type:   qStr(r, "type"),
                Take:   qInt(r, "take"),
                Skip:   qInt(r, "skip"),
        }
        items, err := h.Store.ListCompetencies(r.Context(), f)
        if err != nil {
                httpx.WriteErr(w, err)
                return
        }
        httpx.JSON(w, http.StatusOK, items)
}

// CompetencyOptions handles GET /competencies/options.
func (h *Handler) CompetencyOptions(w http.ResponseWriter, r *http.Request) {
        items, err := h.Store.CompetencyOptions(r.Context())
        if err != nil {
                httpx.WriteErr(w, err)
                return
        }
        httpx.JSON(w, http.StatusOK, items)
}

func (h *Handler) decodeCompetency(w http.ResponseWriter, r *http.Request) (*store.CompetencyInput, bool) {
        var in store.CompetencyInput
        if err := httpx.Decode(r, &in); err != nil {
                httpx.WriteErr(w, err)
                return nil, false
        }
        if in.Level == "" {
                in.Level = "BASIC"
        }
        if !required(w, in.Name, "name") ||
                !validateEnum(w, domain.CompetencyTypes, in.Type, "type") ||
                !validateEnum(w, domain.CompetencyLevels, in.Level, "level") {
                return nil, false
        }
        return &in, true
}

// CreateCompetency handles POST /competencies.
func (h *Handler) CreateCompetency(w http.ResponseWriter, r *http.Request) {
        in, ok := h.decodeCompetency(w, r)
        if !ok {
                return
        }
        c, err := h.Store.CreateCompetency(r.Context(), *in)
        if err != nil {
                httpx.WriteErr(w, err)
                return
        }
        h.audit(r, "competency.create", "Competency", &c.ID)
        httpx.JSON(w, http.StatusCreated, c)
}

// UpdateCompetency handles PUT /competencies/{id}.
func (h *Handler) UpdateCompetency(w http.ResponseWriter, r *http.Request) {
        id := chi.URLParam(r, "id")
        in, ok := h.decodeCompetency(w, r)
        if !ok {
                return
        }
        c, err := h.Store.UpdateCompetency(r.Context(), id, *in)
        if err != nil {
                httpx.WriteErr(w, err)
                return
        }
        if c == nil {
                httpx.Error(w, http.StatusNotFound, "Competency not found")
                return
        }
        h.audit(r, "competency.update", "Competency", &id)
        httpx.JSON(w, http.StatusOK, c)
}

// DeleteCompetency handles DELETE /competencies/{id}.
func (h *Handler) DeleteCompetency(w http.ResponseWriter, r *http.Request) {
        id := chi.URLParam(r, "id")
        deleted, shared, err := h.Store.DeleteCompetency(r.Context(), id)
        if err != nil {
                httpx.WriteErr(w, err)
                return
        }
        if shared {
                httpx.Error(w, http.StatusBadRequest, "Shared competencies cannot be deleted")
                return
        }
        if !deleted {
                httpx.Error(w, http.StatusNotFound, "Competency not found")
                return
        }
        h.audit(r, "competency.delete", "Competency", &id)
        httpx.JSON(w, http.StatusOK, map[string]bool{"ok": true})
}

type importCompetenciesRequest struct {
        Rows []store.CompetencyInput `json:"rows"`
}

// ImportCompetencies handles POST /competencies/import.
func (h *Handler) ImportCompetencies(w http.ResponseWriter, r *http.Request) {
        var req importCompetenciesRequest
        if err := httpx.Decode(r, &req); err != nil {
                httpx.WriteErr(w, err)
                return
        }
        count := 0
        for _, row := range req.Rows {
                if row.Name == "" {
                        continue
                }
                if !domain.InSet(domain.CompetencyTypes, row.Type) {
                        row.Type = "BEHAVIORAL"
                }
                if !domain.InSet(domain.CompetencyLevels, row.Level) {
                        row.Level = "BASIC"
                }
                if _, err := h.Store.UpsertCompetencyByName(r.Context(), row); err != nil {
                        httpx.WriteErr(w, err)
                        return
                }
                count++
        }
        h.audit(r, "competency.import", "Competency", nil)
        httpx.JSON(w, http.StatusOK, map[string]int{"imported": count})
}

// audit records an audit entry (best effort). The system has no authenticated
// user, so the actor is left null.
func (h *Handler) audit(r *http.Request, action, entityType string, entityID *string) {
        _ = h.Store.WriteAudit(r.Context(), nil, action, entityType, entityID, nil, clientIP(r))
}
