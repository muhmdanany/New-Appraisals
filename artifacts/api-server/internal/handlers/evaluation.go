package handlers

import (
        "errors"
        "net/http"

        "github.com/go-chi/chi/v5"

        "competency/internal/domain"
        "competency/internal/httpx"
        "competency/internal/store"
)

// systemActor resolves the user id used as the actor for records that require a
// User foreign key. On an empty User table it responds with a clear error
// instead of letting a foreign-key violation surface later.
func (h *Handler) systemActor(w http.ResponseWriter, r *http.Request) (string, bool) {
        actor, err := h.Store.SystemUserID(r.Context())
        if err != nil {
                if errors.Is(err, store.ErrNoSystemUser) {
                        httpx.Error(w, http.StatusServiceUnavailable, "لا يوجد مستخدم في النظام لتسجيل الإجراء. شغّل أمر التهيئة (seed) أولاً.")
                        return "", false
                }
                httpx.WriteErr(w, err)
                return "", false
        }
        return actor, true
}

// ListEvaluations handles GET /evaluations. The system is open, so all
// evaluations are listed (optionally filtered by status).
func (h *Handler) ListEvaluations(w http.ResponseWriter, r *http.Request) {
        f := store.EvalListFilter{}
        if status := qStr(r, "status"); status != "" {
                f.Status = &status
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

        emp, err := h.Store.EmployeeByID(r.Context(), req.EmployeeID)
        if err != nil {
                httpx.WriteErr(w, err)
                return
        }
        if emp == nil {
                httpx.Error(w, http.StatusNotFound, "Employee not found")
                return
        }

        actor, ok := h.systemActor(w, r)
        if !ok {
                return
        }

        id, err := h.Store.CreateEvaluation(r.Context(), actor, req.EmployeeID, emp.JobID, req.EvaluationSave)
        if err != nil {
                httpx.WriteErr(w, err)
                return
        }
        h.audit(r, "evaluation.create", "Evaluation", &id)
        httpx.JSON(w, http.StatusCreated, map[string]string{"id": id})
}

// UpdateEvaluation handles PUT /evaluations/{id}.
func (h *Handler) UpdateEvaluation(w http.ResponseWriter, r *http.Request) {
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
        if ev.Status != "SUBMITTED" {
                httpx.Error(w, http.StatusBadRequest, "التقييم ليس قيد الاعتماد.")
                return
        }
        actor, ok := h.systemActor(w, r)
        if !ok {
                return
        }
        if err := h.Store.ApproveEvaluation(r.Context(), id, actor); err != nil {
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
        if ev.Status != "SUBMITTED" {
                httpx.Error(w, http.StatusBadRequest, "التقييم ليس قيد الاعتماد.")
                return
        }
        actor, ok := h.systemActor(w, r)
        if !ok {
                return
        }
        if err := h.Store.RejectEvaluation(r.Context(), id, actor, req.Reason); err != nil {
                httpx.WriteErr(w, err)
                return
        }
        h.audit(r, "evaluation.reject", "Evaluation", &id)
        httpx.JSON(w, http.StatusOK, map[string]string{"id": id, "status": "REJECTED"})
}

// AcknowledgeEvaluation handles POST /evaluations/{id}/acknowledge.
func (h *Handler) AcknowledgeEvaluation(w http.ResponseWriter, r *http.Request) {
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

// ObjectEvaluation handles POST /evaluations/{id}/object.
func (h *Handler) ObjectEvaluation(w http.ResponseWriter, r *http.Request) {
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
        employeeID := qStr(r, "employeeId")
        if !required(w, employeeID, "employeeId") {
                return
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
func (h *Handler) DepartmentDistribution(w http.ResponseWriter, r *http.Request) {
        employeeID := qStr(r, "employeeId")
        period := qStr(r, "period")
        if !required(w, employeeID, "employeeId") || !required(w, period, "period") {
                return
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
