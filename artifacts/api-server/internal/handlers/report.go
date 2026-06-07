package handlers

import (
        "net/http"

        "competency/internal/auth"
        "competency/internal/domain"
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

// ReportOrgTree handles GET /reports/org-tree.
func (h *Handler) ReportOrgTree(w http.ResponseWriter, r *http.Request) {
        u := auth.UserFrom(r.Context())
        if u.Role == domain.RoleAdmin || u.Role == domain.RoleHRManager {
                nodes, err := h.Store.OrgTree(r.Context(), nil, true)
                if err != nil {
                        httpx.WriteErr(w, err)
                        return
                }
                httpx.JSON(w, http.StatusOK, nodes)
                return
        }

        ids, orgWide, err := h.visibleScope(r.Context(), u)
        if err != nil {
                httpx.WriteErr(w, err)
                return
        }
        if orgWide {
                nodes, err := h.Store.OrgTree(r.Context(), nil, true)
                if err != nil {
                        httpx.WriteErr(w, err)
                        return
                }
                httpx.JSON(w, http.StatusOK, nodes)
                return
        }
        idList := keysOfBoolMap(ids)
        if u.EmployeeID != nil {
                idList = append(idList, *u.EmployeeID)
        }
        nodes, err := h.Store.OrgTree(r.Context(), idList, false)
        if err != nil {
                httpx.WriteErr(w, err)
                return
        }
        httpx.JSON(w, http.StatusOK, nodes)
}
