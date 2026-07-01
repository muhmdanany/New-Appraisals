package handlers

import (
        "net/http"

        "competency/internal/domain"
        "competency/internal/httpx"
        "competency/internal/rbac"
)

// ReportEvaluations handles GET /reports/evaluations.
// Org-wide reports are restricted to ADMIN/HR_MANAGER.
func (h *Handler) ReportEvaluations(w http.ResponseWriter, r *http.Request) {
        u, ok := h.requireUser(w, r)
        if !ok {
                return
        }
        if !rbac.HasOrgWideAccess(u.Role) {
                httpx.Error(w, http.StatusForbidden, "Forbidden")
                return
        }
        rows, err := h.Store.ReportEvaluations(r.Context())
        if err != nil {
                httpx.WriteErr(w, err)
                return
        }
        httpx.JSON(w, http.StatusOK, rows)
}

// ReportBellCurve handles GET /reports/bell-curve.
// Org-wide reports are restricted to ADMIN/HR_MANAGER.
func (h *Handler) ReportBellCurve(w http.ResponseWriter, r *http.Request) {
        u, ok := h.requireUser(w, r)
        if !ok {
                return
        }
        if !rbac.HasOrgWideAccess(u.Role) {
                httpx.Error(w, http.StatusForbidden, "Forbidden")
                return
        }
        data, err := h.Store.ReportBellCurveData(r.Context())
        if err != nil {
                httpx.WriteErr(w, err)
                return
        }
        httpx.JSON(w, http.StatusOK, data)
}

// ReportOrgTree handles GET /reports/org-tree, scoped to the acting user.
func (h *Handler) ReportOrgTree(w http.ResponseWriter, r *http.Request) {
        u, ok := h.requireUser(w, r)
        if !ok {
                return
        }
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
