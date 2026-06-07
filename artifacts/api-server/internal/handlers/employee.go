package handlers

import (
        "net/http"

        "github.com/go-chi/chi/v5"

        "competency/internal/auth"
        "competency/internal/domain"
        "competency/internal/httpx"
        "competency/internal/rbac"
        "competency/internal/store"
)

// ListEmployees handles GET /employees, applying RBAC visibility.
func (h *Handler) ListEmployees(w http.ResponseWriter, r *http.Request) {
        u := auth.UserFrom(r.Context())
        search := qStr(r, "search")

        var (
                emps []domain.Employee
                err  error
        )
        switch {
        case rbac.HasOrgWideAccess(u.Role):
                emps, err = h.Store.ListAllEmployees(r.Context(), search)
        case u.EmployeeID != nil:
                emps, err = h.Store.ListVisibleEmployees(r.Context(), *u.EmployeeID)
        default:
                emps = []domain.Employee{}
        }
        if err != nil {
                httpx.WriteErr(w, err)
                return
        }
        httpx.JSON(w, http.StatusOK, emps)
}

func (h *Handler) decodeEmployee(w http.ResponseWriter, r *http.Request) (*store.EmployeeInput, bool) {
        var in store.EmployeeInput
        if err := httpx.Decode(r, &in); err != nil {
                httpx.WriteErr(w, err)
                return nil, false
        }
        in.JobID = emptyToNil(in.JobID)
        in.DepartmentID = emptyToNil(in.DepartmentID)
        in.GradeID = emptyToNil(in.GradeID)
        in.ManagerID = emptyToNil(in.ManagerID)
        if !required(w, in.Name, "name") || !required(w, in.EmployeeNumber, "employeeNumber") {
                return nil, false
        }
        return &in, true
}

// CreateEmployee handles POST /employees.
func (h *Handler) CreateEmployee(w http.ResponseWriter, r *http.Request) {
        in, ok := h.decodeEmployee(w, r)
        if !ok {
                return
        }
        id, err := h.Store.CreateEmployee(r.Context(), *in)
        if err != nil {
                httpx.WriteErr(w, err)
                return
        }
        emp, _ := h.Store.EmployeeByID(r.Context(), id)
        h.audit(r, "employee.create", "Employee", &id)
        httpx.JSON(w, http.StatusCreated, emp)
}

// UpdateEmployee handles PUT /employees/{id}.
func (h *Handler) UpdateEmployee(w http.ResponseWriter, r *http.Request) {
        id := chi.URLParam(r, "id")
        in, ok := h.decodeEmployee(w, r)
        if !ok {
                return
        }
        updated, err := h.Store.UpdateEmployee(r.Context(), id, *in)
        if err != nil {
                httpx.WriteErr(w, err)
                return
        }
        if !updated {
                httpx.Error(w, http.StatusNotFound, "Employee not found")
                return
        }
        emp, _ := h.Store.EmployeeByID(r.Context(), id)
        h.audit(r, "employee.update", "Employee", &id)
        httpx.JSON(w, http.StatusOK, emp)
}

type employeeImportRow struct {
        store.EmployeeInput
        ManagerNumber string `json:"managerNumber"`
}

type importEmployeesRequest struct {
        Rows []employeeImportRow `json:"rows"`
}

// ImportEmployees handles POST /employees/import (two-pass).
func (h *Handler) ImportEmployees(w http.ResponseWriter, r *http.Request) {
        var req importEmployeesRequest
        if err := httpx.Decode(r, &req); err != nil {
                httpx.WriteErr(w, err)
                return
        }
        count := 0
        for _, row := range req.Rows {
                if row.EmployeeNumber == "" || row.Name == "" {
                        continue
                }
                if err := h.Store.UpsertEmployeeByNumber(r.Context(), row.EmployeeInput); err != nil {
                        httpx.WriteErr(w, err)
                        return
                }
                count++
        }
        for _, row := range req.Rows {
                if row.EmployeeNumber == "" || row.ManagerNumber == "" {
                        continue
                }
                if err := h.Store.LinkManagerByNumber(r.Context(), row.EmployeeNumber, row.ManagerNumber); err != nil {
                        httpx.WriteErr(w, err)
                        return
                }
        }
        h.audit(r, "employee.import", "Employee", nil)
        httpx.JSON(w, http.StatusOK, map[string]int{"imported": count})
}
