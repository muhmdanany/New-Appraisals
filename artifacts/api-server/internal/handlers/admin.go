package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"competency/internal/domain"
	"competency/internal/httpx"
	"competency/internal/rbac"
	"competency/internal/store"
)

// ---------- User Management ----------

// AdminListUsers returns ALL users (including inactive) for the admin panel.
func (h *Handler) AdminListUsers(w http.ResponseWriter, r *http.Request) {
	users, err := h.Store.ListAllUsers(r.Context())
	if err != nil {
		httpx.WriteErr(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, users)
}

// CreateUser handles POST /api/users — creates a new user.
func (h *Handler) CreateUser(w http.ResponseWriter, r *http.Request) {
	var in store.UserInput
	if err := httpx.Decode(r, &in); err != nil {
		httpx.WriteErr(w, err)
		return
	}
	if !required(w, in.Name, "name") || !required(w, in.Email, "email") {
		return
	}
	if !domain.Role(in.Role).Valid() {
		httpx.Error(w, http.StatusBadRequest, "دور غير صالح")
		return
	}
	id, err := h.Store.CreateUser(r.Context(), in)
	if err != nil {
		writeDBErr(w, err)
		return
	}
	u, _ := h.Store.UserByID(r.Context(), id)
	h.audit(r, "user.create", "User", &id)
	httpx.JSON(w, http.StatusCreated, u)
}

// UpdateUser handles PUT /api/users/{id}.
func (h *Handler) UpdateUser(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var in store.UserInput
	if err := httpx.Decode(r, &in); err != nil {
		httpx.WriteErr(w, err)
		return
	}
	if !required(w, in.Name, "name") || !required(w, in.Email, "email") {
		return
	}
	if !domain.Role(in.Role).Valid() {
		httpx.Error(w, http.StatusBadRequest, "دور غير صالح")
		return
	}
	ok, err := h.Store.UpdateUser(r.Context(), id, in)
	if err != nil {
		writeDBErr(w, err)
		return
	}
	if !ok {
		httpx.Error(w, http.StatusNotFound, "المستخدم غير موجود")
		return
	}
	u, _ := h.Store.UserByID(r.Context(), id)
	h.audit(r, "user.update", "User", &id)
	httpx.JSON(w, http.StatusOK, u)
}

// DeactivateUser handles DELETE /api/users/{id} (soft delete).
func (h *Handler) DeactivateUser(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	ok, err := h.Store.DeactivateUser(r.Context(), id)
	if err != nil {
		httpx.WriteErr(w, err)
		return
	}
	if !ok {
		httpx.Error(w, http.StatusNotFound, "المستخدم غير موجود")
		return
	}
	h.audit(r, "user.deactivate", "User", &id)
	httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// ---------- Admin Import (Employees + Users) ----------

type adminImportRow struct {
	EmployeeNumber string  `json:"employeeNumber"`
	Name           string  `json:"name"`
	Email          string  `json:"email"`
	Role           string  `json:"role"`
	ManagerNumber  string  `json:"managerNumber"`
	JobID          *string `json:"jobId"`
	DepartmentID   *string `json:"departmentId"`
	GradeID        *string `json:"gradeId"`
}

type adminImportRequest struct {
	Rows []adminImportRow `json:"rows"`
}

type adminImportResult struct {
	Imported     int `json:"imported"`
	UsersCreated int `json:"usersCreated"`
}

// AdminImportWithRoles handles POST /api/admin/import-with-roles.
// Three-pass: 1) upsert employees 2) link managers 3) create/update users.
func (h *Handler) AdminImportWithRoles(w http.ResponseWriter, r *http.Request) {
	u, ok := h.requireUser(w, r)
	if !ok {
		return
	}
	if !rbac.HasOrgWideAccess(u.Role) {
		httpx.Error(w, http.StatusForbidden, "Forbidden")
		return
	}

	var req adminImportRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.WriteErr(w, err)
		return
	}

	result := adminImportResult{}

	// Pass 1: upsert employees
	for _, row := range req.Rows {
		if row.EmployeeNumber == "" || row.Name == "" {
			continue
		}
		in := store.EmployeeInput{
			Name:           row.Name,
			EmployeeNumber: row.EmployeeNumber,
			JobID:          emptyToNil(row.JobID),
			DepartmentID:   emptyToNil(row.DepartmentID),
			GradeID:        emptyToNil(row.GradeID),
		}
		if err := h.Store.UpsertEmployeeByNumber(r.Context(), in); err != nil {
			httpx.WriteErr(w, err)
			return
		}
		result.Imported++
	}

	// Pass 2: link managers
	for _, row := range req.Rows {
		if row.EmployeeNumber == "" || row.ManagerNumber == "" {
			continue
		}
		if err := h.Store.LinkManagerByNumber(r.Context(), row.EmployeeNumber, row.ManagerNumber); err != nil {
			httpx.WriteErr(w, err)
			return
		}
	}

	// Pass 3: create/update users
	for _, row := range req.Rows {
		if row.EmployeeNumber == "" || row.Email == "" {
			continue
		}
		role := row.Role
		if role == "" {
			role = "EMPLOYEE"
		}
		if !domain.Role(role).Valid() {
			continue
		}
		emp, err := h.Store.EmployeeByNumber(r.Context(), row.EmployeeNumber)
		if err != nil || emp == nil {
			continue
		}
		if err := h.Store.UpsertUserForEmployee(r.Context(), emp.ID, row.Name, row.Email, role); err != nil {
			httpx.WriteErr(w, err)
			return
		}
		result.UsersCreated++
	}

	h.audit(r, "admin.import", "Employee", nil)
	httpx.JSON(w, http.StatusOK, result)
}

// ---------- Evaluation Settings ----------

const evalSettingsKey = "evaluation_settings"

type evaluationSettings struct {
	DefaultKpiWeight        int      `json:"defaultKpiWeight"`
	DefaultCompetencyWeight int      `json:"defaultCompetencyWeight"`
	RatingScale             int      `json:"ratingScale"`
	RatingLabels            []string `json:"ratingLabels"`
	EvaluationPeriods       []string `json:"evaluationPeriods"`
	RequireApproval         bool     `json:"requireApproval"`
	RequireAcknowledgment   bool     `json:"requireAcknowledgment"`
}

var defaultEvalSettings = evaluationSettings{
	DefaultKpiWeight:        60,
	DefaultCompetencyWeight: 40,
	RatingScale:             5,
	RatingLabels:            []string{"دون التوقعات", "يحتاج تحسين", "يحقق التوقعات", "يتجاوز التوقعات", "متميز"},
	EvaluationPeriods:       []string{"2026", "النصف الأول 2026", "النصف الثاني 2026"},
	RequireApproval:         true,
	RequireAcknowledgment:   true,
}

// GetEvaluationSettings handles GET /api/settings/evaluation.
func (h *Handler) GetEvaluationSettings(w http.ResponseWriter, r *http.Request) {
	val, err := h.Store.GetSetting(r.Context(), evalSettingsKey)
	if err != nil {
		// Return defaults if no saved settings
		httpx.JSON(w, http.StatusOK, defaultEvalSettings)
		return
	}
	var s evaluationSettings
	if err := json.Unmarshal(val, &s); err != nil {
		httpx.JSON(w, http.StatusOK, defaultEvalSettings)
		return
	}
	httpx.JSON(w, http.StatusOK, s)
}

// SaveEvaluationSettings handles PUT /api/settings/evaluation.
func (h *Handler) SaveEvaluationSettings(w http.ResponseWriter, r *http.Request) {
	var s evaluationSettings
	if err := httpx.Decode(r, &s); err != nil {
		httpx.WriteErr(w, err)
		return
	}
	if s.DefaultKpiWeight+s.DefaultCompetencyWeight != 100 {
		httpx.Error(w, http.StatusBadRequest, "مجموع أوزان مؤشرات الأداء والجدارات يجب أن يساوي 100")
		return
	}
	val, _ := json.Marshal(s)
	if err := h.Store.SaveSetting(r.Context(), evalSettingsKey, val); err != nil {
		httpx.WriteErr(w, err)
		return
	}
	h.audit(r, "settings.evaluation.update", "Settings", nil)
	httpx.JSON(w, http.StatusOK, s)
}
