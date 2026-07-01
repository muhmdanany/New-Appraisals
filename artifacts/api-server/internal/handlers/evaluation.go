package handlers

import (
        "context"
        "net/http"

        "github.com/go-chi/chi/v5"

        "competency/internal/domain"
        "competency/internal/httpx"
        "competency/internal/rbac"
        "competency/internal/store"
)

// visibleScope resolves a user's employee-visibility scope.
// orgWide=true means no restriction (ADMIN/HR_MANAGER).
func (h *Handler) visibleScope(ctx context.Context, u *domain.User) (ids map[string]bool, orgWide bool, err error) {
        if u.Role == domain.RoleAdmin || u.Role == domain.RoleHRManager {
                return nil, true, nil
        }
        if u.EmployeeID == nil {
                return map[string]bool{}, false, nil
        }
        ids, err = h.Store.VisibleEmployeeIDs(ctx, *u.EmployeeID)
        return ids, false, err
}

func keysOfBoolMap(m map[string]bool) []string {
        out := make([]string, 0, len(m))
        for k := range m {
                out = append(out, k)
        }
        return out
}

func (h *Handler) canView(ctx context.Context, u *domain.User, ev *store.EvalCore) (bool, error) {
        switch u.Role {
        case domain.RoleAdmin, domain.RoleHRManager:
                return true, nil
        case domain.RoleFirstLevel:
                return ev.EvaluatorID == u.ID, nil
        case domain.RoleSecondLevel:
                ids, orgWide, err := h.visibleScope(ctx, u)
                if err != nil {
                        return false, err
                }
                inScope := orgWide || ids[ev.EmployeeID]
                return inScope && ev.Status != "DRAFT", nil
        case domain.RoleEmployee:
                visible := ev.Status == "APPROVED" || ev.Status == "ACKNOWLEDGED" || ev.Status == "OBJECTED"
                return u.EmployeeID != nil && ev.EmployeeID == *u.EmployeeID && visible, nil
        }
        return false, nil
}

func (h *Handler) canApprove(ctx context.Context, u *domain.User, ev *store.EvalCore) (bool, error) {
        if u.Role == domain.RoleAdmin {
                return true, nil
        }
        if u.Role != domain.RoleSecondLevel {
                return false, nil
        }
        ids, orgWide, err := h.visibleScope(ctx, u)
        if err != nil {
                return false, err
        }
        return orgWide || ids[ev.EmployeeID], nil
}

// ListEvaluations handles GET /evaluations, scoped by the acting user's role.
func (h *Handler) ListEvaluations(w http.ResponseWriter, r *http.Request) {
        u, ok := h.requireUser(w, r)
        if !ok {
                return
        }
        f := store.EvalListFilter{}
        if status := qStr(r, "status"); status != "" {
                f.Status = &status
        }

        switch u.Role {
        case domain.RoleAdmin, domain.RoleHRManager:
                // no restriction
        case domain.RoleFirstLevel:
                f.EvaluatorID = &u.ID
        case domain.RoleSecondLevel:
                ids, _, err := h.visibleScope(r.Context(), u)
                if err != nil {
                        httpx.WriteErr(w, err)
                        return
                }
                f.RestrictEmployees = true
                f.EmployeeIDs = keysOfBoolMap(ids)
                f.ExcludeStatuses = []string{"DRAFT"}
        case domain.RoleEmployee:
                f.RestrictEmployees = true
                if u.EmployeeID != nil {
                        f.EmployeeIDs = []string{*u.EmployeeID}
                } else {
                        f.EmployeeIDs = []string{"__none__"}
                }
                f.Statuses = []string{"APPROVED", "ACKNOWLEDGED", "OBJECTED"}
        }

        items, err := h.Store.ListEvaluations(r.Context(), f)
        if err != nil {
                httpx.WriteErr(w, err)
                return
        }
        httpx.JSON(w, http.StatusOK, items)
}

// GetEvaluation handles GET /evaluations/{id}.
func (h *Handler) GetEvaluation(w http.ResponseWriter, r *http.Request) {
        u, ok := h.requireUser(w, r)
        if !ok {
                return
        }
        id := chi.URLParam(r, "id")
        ev, err := h.Store.EvaluationByID(r.Context(), id)
        if err != nil {
                httpx.WriteErr(w, err)
                return
        }
        if ev == nil {
                httpx.Error(w, http.StatusNotFound, "Evaluation not found")
                return
        }
        allowed, err := h.canView(r.Context(), u, &store.EvalCore{EmployeeID: ev.EmployeeID, EvaluatorID: ev.EvaluatorID, Status: ev.Status})
        if err != nil {
                httpx.WriteErr(w, err)
                return
        }
        if !allowed {
                httpx.Error(w, http.StatusForbidden, "Forbidden")
                return
        }
        httpx.JSON(w, http.StatusOK, ev)
}

func (h *Handler) decodeSave(w http.ResponseWriter, r *http.Request) (*store.EvaluationSave, bool) {
        var in store.EvaluationSave
        if err := httpx.Decode(r, &in); err != nil {
                httpx.WriteErr(w, err)
                return nil, false
        }
        if in.SharedScores == nil {
                in.SharedScores = map[string]float64{}
        }
        if in.JobScores == nil {
                in.JobScores = map[string]float64{}
        }
        if in.Kpis == nil {
                in.Kpis = []store.EvalKpiInput{}
        }
        if !required(w, in.Period, "period") || !validateEnum(w, domain.EvaluationModes, in.Mode, "mode") {
                return nil, false
        }
        if in.KpiWeight < 0 || in.KpiWeight > 100 {
                httpx.Error(w, http.StatusBadRequest, "kpiWeight must be between 0 and 100")
                return nil, false
        }
        return &in, true
}

type createEvaluationRequest struct {
        EmployeeID string `json:"employeeId"`
        store.EvaluationSave
}

// CreateEvaluation handles POST /evaluations.
func (h *Handler) CreateEvaluation(w http.ResponseWriter, r *http.Request) {
        u, ok := h.requireUser(w, r)
        if !ok {
                return
        }
        if !rbac.In(rbac.Evaluators, u.Role) {
                httpx.Error(w, http.StatusForbidden, "Forbidden")
                return
        }
        var req createEvaluationRequest
        if err := httpx.Decode(r, &req); err != nil {
                httpx.WriteErr(w, err)
                return
        }
        if !required(w, req.EmployeeID, "employeeId") ||
                !required(w, req.Period, "period") ||
                !validateEnum(w, domain.EvaluationModes, req.Mode, "mode") {
                return
        }
        if req.SharedScores == nil {
                req.SharedScores = map[string]float64{}
        }
        if req.JobScores == nil {
                req.JobScores = map[string]float64{}
        }
        if req.Kpis == nil {
                req.Kpis = []store.EvalKpiInput{}
        }

        if u.Role == domain.RoleFirstLevel {
                ids, orgWide, err := h.visibleScope(r.Context(), u)
                if err != nil {
                        httpx.WriteErr(w, err)
                        return
                }
                if !orgWide && !ids[req.EmployeeID] {
                        httpx.Error(w, http.StatusForbidden, "Forbidden")
                        return
                }
        }

        emp, err := h.Store.EmployeeByID(r.Context(), req.EmployeeID)
        if err != nil {
                httpx.WriteErr(w, err)
                return
        }
        if emp == nil {
                httpx.Error(w, http.StatusNotFound, "Employee not found")
                return
        }

        id, err := h.Store.CreateEvaluation(r.Context(), u.ID, req.EmployeeID, emp.JobID, req.EvaluationSave)
        if err != nil {
                httpx.WriteErr(w, err)
                return
        }
        h.audit(r, "evaluation.create", "Evaluation", &id)
        httpx.JSON(w, http.StatusCreated, map[string]string{"id": id})
}

// UpdateEvaluation handles PUT /evaluations/{id}.
func (h *Handler) UpdateEvaluation(w http.ResponseWriter, r *http.Request) {
        u, ok := h.requireUser(w, r)
        if !ok {
                return
        }
        id := chi.URLParam(r, "id")
        in, ok := h.decodeSave(w, r)
        if !ok {
                return
        }
        ev, err := h.Store.EvaluationCore(r.Context(), id)
        if err != nil {
                httpx.WriteErr(w, err)
                return
        }
        if ev == nil {
                httpx.Error(w, http.StatusNotFound, "Evaluation not found")
                return
        }
        if u.Role != domain.RoleAdmin && ev.EvaluatorID != u.ID {
                httpx.Error(w, http.StatusForbidden, "Forbidden")
                return
        }
        if ev.Status != "DRAFT" && ev.Status != "REJECTED" {
                httpx.Error(w, http.StatusBadRequest, "لا يمكن تعديل تقييم بعد إرساله.")
                return
        }
        if err := h.Store.UpdateEvaluation(r.Context(), id, *in); err != nil {
                httpx.WriteErr(w, err)
                return
        }
        h.audit(r, "evaluation.update", "Evaluation", &id)
        httpx.JSON(w, http.StatusOK, map[string]string{"id": id})
}

// SubmitEvaluation handles POST /evaluations/{id}/submit.
func (h *Handler) SubmitEvaluation(w http.ResponseWriter, r *http.Request) {
        u, ok := h.requireUser(w, r)
        if !ok {
                return
        }
        id := chi.URLParam(r, "id")
        ev, err := h.Store.EvaluationCore(r.Context(), id)
        if err != nil {
                httpx.WriteErr(w, err)
                return
        }
        if ev == nil {
                httpx.Error(w, http.StatusNotFound, "Evaluation not found")
                return
        }
        if u.Role != domain.RoleAdmin && ev.EvaluatorID != u.ID {
                httpx.Error(w, http.StatusForbidden, "Forbidden")
                return
        }
        if ev.Status != "DRAFT" && ev.Status != "REJECTED" {
                httpx.Error(w, http.StatusBadRequest, "التقييم في حالة لا تسمح بالإرسال.")
                return
        }
        if ev.TotalScore == nil {
                httpx.Error(w, http.StatusBadRequest, "أكمل إدخال الدرجات قبل الإرسال.")
                return
        }
        if err := h.Store.SubmitEvaluation(r.Context(), id); err != nil {
                httpx.WriteErr(w, err)
                return
        }
        h.audit(r, "evaluation.submit", "Evaluation", &id)
        httpx.JSON(w, http.StatusOK, map[string]string{"id": id, "status": "SUBMITTED"})
}

// ApproveEvaluation handles POST /evaluations/{id}/approve.
func (h *Handler) ApproveEvaluation(w http.ResponseWriter, r *http.Request) {
        u, ok := h.requireUser(w, r)
        if !ok {
                return
        }
        id := chi.URLParam(r, "id")
        ev, err := h.Store.EvaluationCore(r.Context(), id)
        if err != nil {
                httpx.WriteErr(w, err)
                return
        }
        if ev == nil {
                httpx.Error(w, http.StatusNotFound, "Evaluation not found")
                return
        }
        allowed, err := h.canApprove(r.Context(), u, ev)
        if err != nil {
                httpx.WriteErr(w, err)
                return
        }
        if !allowed {
                httpx.Error(w, http.StatusForbidden, "Forbidden")
                return
        }
        if ev.Status != "SUBMITTED" {
                httpx.Error(w, http.StatusBadRequest, "التقييم ليس قيد الاعتماد.")
                return
        }
        if err := h.Store.ApproveEvaluation(r.Context(), id, u.ID); err != nil {
                httpx.WriteErr(w, err)
                return
        }
        h.audit(r, "evaluation.approve", "Evaluation", &id)
        httpx.JSON(w, http.StatusOK, map[string]string{"id": id, "status": "APPROVED"})
}

type rejectRequest struct {
        Reason string `json:"reason"`
}

// RejectEvaluation handles POST /evaluations/{id}/reject.
func (h *Handler) RejectEvaluation(w http.ResponseWriter, r *http.Request) {
        u, ok := h.requireUser(w, r)
        if !ok {
                return
        }
        id := chi.URLParam(r, "id")
        var req rejectRequest
        if err := httpx.Decode(r, &req); err != nil {
                httpx.WriteErr(w, err)
                return
        }
        if !required(w, req.Reason, "reason") {
                return
        }
        ev, err := h.Store.EvaluationCore(r.Context(), id)
        if err != nil {
                httpx.WriteErr(w, err)
                return
        }
        if ev == nil {
                httpx.Error(w, http.StatusNotFound, "Evaluation not found")
                return
        }
        allowed, err := h.canApprove(r.Context(), u, ev)
        if err != nil {
                httpx.WriteErr(w, err)
                return
        }
        if !allowed {
                httpx.Error(w, http.StatusForbidden, "Forbidden")
                return
        }
        if ev.Status != "SUBMITTED" {
                httpx.Error(w, http.StatusBadRequest, "التقييم ليس قيد الاعتماد.")
                return
        }
        if err := h.Store.RejectEvaluation(r.Context(), id, u.ID, req.Reason); err != nil {
                httpx.WriteErr(w, err)
                return
        }
        h.audit(r, "evaluation.reject", "Evaluation", &id)
        httpx.JSON(w, http.StatusOK, map[string]string{"id": id, "status": "REJECTED"})
}

// AcknowledgeEvaluation handles POST /evaluations/{id}/acknowledge — only the
// evaluated employee may acknowledge (يوافق) their own approved evaluation.
func (h *Handler) AcknowledgeEvaluation(w http.ResponseWriter, r *http.Request) {
        u, ok := h.requireUser(w, r)
        if !ok {
                return
        }
        id := chi.URLParam(r, "id")
        ev, err := h.Store.EvaluationCore(r.Context(), id)
        if err != nil {
                httpx.WriteErr(w, err)
                return
        }
        if ev == nil {
                httpx.Error(w, http.StatusNotFound, "Evaluation not found")
                return
        }
        if u.EmployeeID == nil || ev.EmployeeID != *u.EmployeeID {
                httpx.Error(w, http.StatusForbidden, "Forbidden")
                return
        }
        if ev.Status != "APPROVED" {
                httpx.Error(w, http.StatusBadRequest, "لا يمكن الاعتماد في هذه الحالة.")
                return
        }
        if err := h.Store.AcknowledgeEvaluation(r.Context(), id); err != nil {
                httpx.WriteErr(w, err)
                return
        }
        h.audit(r, "evaluation.acknowledge", "Evaluation", &id)
        httpx.JSON(w, http.StatusOK, map[string]string{"id": id, "status": "ACKNOWLEDGED"})
}

type objectRequest struct {
        Items []store.ObjectionItem `json:"items"`
}

// ObjectEvaluation handles POST /evaluations/{id}/object — only the evaluated
// employee may object (يرفض/يكتب ملاحظة) to their own approved evaluation.
func (h *Handler) ObjectEvaluation(w http.ResponseWriter, r *http.Request) {
        u, ok := h.requireUser(w, r)
        if !ok {
                return
        }
        id := chi.URLParam(r, "id")
        var req objectRequest
        if err := httpx.Decode(r, &req); err != nil {
                httpx.WriteErr(w, err)
                return
        }
        if len(req.Items) == 0 {
                httpx.Error(w, http.StatusBadRequest, "اختر بنداً واحداً على الأقل للاعتراض عليه")
                return
        }
        ev, err := h.Store.EvaluationCore(r.Context(), id)
        if err != nil {
                httpx.WriteErr(w, err)
                return
        }
        if ev == nil {
                httpx.Error(w, http.StatusNotFound, "Evaluation not found")
                return
        }
        if u.EmployeeID == nil || ev.EmployeeID != *u.EmployeeID {
                httpx.Error(w, http.StatusForbidden, "Forbidden")
                return
        }
        if ev.Status != "APPROVED" {
                httpx.Error(w, http.StatusBadRequest, "لا يمكن الاعتراض في هذه الحالة.")
                return
        }
        valid, err := h.Store.EvalItemIDs(r.Context(), id)
        if err != nil {
                httpx.WriteErr(w, err)
                return
        }
        targets := []store.ObjectionItem{}
        for _, it := range req.Items {
                if valid[it.ItemID] {
                        targets = append(targets, it)
                }
        }
        if len(targets) == 0 {
                httpx.Error(w, http.StatusBadRequest, "بنود الاعتراض غير صالحة.")
                return
        }
        if err := h.Store.ObjectEvaluation(r.Context(), id, targets); err != nil {
                httpx.WriteErr(w, err)
                return
        }
        h.audit(r, "evaluation.object", "Evaluation", &id)
        httpx.JSON(w, http.StatusOK, map[string]string{"id": id, "status": "OBJECTED"})
}

// EvaluationFormData handles GET /evaluations/form-data.
func (h *Handler) EvaluationFormData(w http.ResponseWriter, r *http.Request) {
        u, ok := h.requireUser(w, r)
        if !ok {
                return
        }
        if !rbac.In(rbac.Evaluators, u.Role) {
                httpx.Error(w, http.StatusForbidden, "Forbidden")
                return
        }
        employeeID := qStr(r, "employeeId")
        if !required(w, employeeID, "employeeId") {
                return
        }
        if u.Role == domain.RoleFirstLevel {
                ids, orgWide, err := h.visibleScope(r.Context(), u)
                if err != nil {
                        httpx.WriteErr(w, err)
                        return
                }
                if !orgWide && !ids[employeeID] {
                        httpx.Error(w, http.StatusForbidden, "Forbidden")
                        return
                }
        }
        data, err := h.Store.EvaluationFormData(r.Context(), employeeID)
        if err != nil {
                httpx.WriteErr(w, err)
                return
        }
        if data == nil {
                httpx.Error(w, http.StatusNotFound, "Employee not found")
                return
        }
        httpx.JSON(w, http.StatusOK, data)
}

// DepartmentDistribution handles GET /evaluations/department-distribution.
// Used when building/viewing an evaluation, so it is limited to evaluators and
// scoped to the acting first-level manager's subtree.
func (h *Handler) DepartmentDistribution(w http.ResponseWriter, r *http.Request) {
        u, ok := h.requireUser(w, r)
        if !ok {
                return
        }
        if !rbac.In(rbac.Evaluators, u.Role) {
                httpx.Error(w, http.StatusForbidden, "Forbidden")
                return
        }
        employeeID := qStr(r, "employeeId")
        period := qStr(r, "period")
        if !required(w, employeeID, "employeeId") || !required(w, period, "period") {
                return
        }
        if u.Role == domain.RoleFirstLevel {
                ids, orgWide, err := h.visibleScope(r.Context(), u)
                if err != nil {
                        httpx.WriteErr(w, err)
                        return
                }
                if !orgWide && !ids[employeeID] {
                        httpx.Error(w, http.StatusForbidden, "Forbidden")
                        return
                }
        }
        var exclude *string
        if e := qStr(r, "excludeEvaluationId"); e != "" {
                exclude = &e
        }
        dist, err := h.Store.DepartmentDistribution(r.Context(), employeeID, period, exclude)
        if err != nil {
                httpx.WriteErr(w, err)
                return
        }
        httpx.JSON(w, http.StatusOK, dist)
}
