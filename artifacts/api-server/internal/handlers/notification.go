package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"competency/internal/domain"
	"competency/internal/httpx"
	"competency/internal/notifier"
)

// GetNotificationConfig handles GET /admin/notification/config.
func (h *Handler) GetNotificationConfig(w http.ResponseWriter, r *http.Request) {
	raw, err := h.Store.GetSetting(r.Context(), "notification_config")
	if err != nil {
		httpx.JSON(w, http.StatusOK, domain.NotificationConfig{ReminderDays: 3})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(raw)
}

// SaveNotificationConfig handles PUT /admin/notification/config.
func (h *Handler) SaveNotificationConfig(w http.ResponseWriter, r *http.Request) {
	var cfg domain.NotificationConfig
	if err := httpx.Decode(r, &cfg); err != nil {
		httpx.WriteErr(w, err)
		return
	}
	if cfg.ReminderDays <= 0 {
		cfg.ReminderDays = 3
	}
	raw, err := json.Marshal(cfg)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "marshal error")
		return
	}
	if err := h.Store.SaveSetting(r.Context(), "notification_config", raw); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "save error")
		return
	}
	httpx.JSON(w, http.StatusOK, cfg)
}

type testNotifReq struct {
	Channel string `json:"channel"` // EMAIL or WHATSAPP
	To      string `json:"to"`
}

// TestNotification handles POST /admin/notification/test.
func (h *Handler) TestNotification(w http.ResponseWriter, r *http.Request) {
	var req testNotifReq
	if err := httpx.Decode(r, &req); err != nil {
		httpx.WriteErr(w, err)
		return
	}
	if !required(w, req.To, "to") {
		return
	}

	ch := domain.NotificationChannel(req.Channel)
	if err := h.Notifier.SendTest(r.Context(), ch, req.To); err != nil {
		httpx.Error(w, http.StatusBadRequest, "فشل الإرسال: "+err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"status": "sent"})
}

type sendNotifReq struct {
	EvalIDs  []string `json:"evalIds"`
	Type     string   `json:"type"`     // NEW_EVALUATION, RESULT_SUMMARY, etc.
	Channels []string `json:"channels"` // ["EMAIL","WHATSAPP"]
}

// SendNotification handles POST /notifications/send (manual send).
func (h *Handler) SendNotification(w http.ResponseWriter, r *http.Request) {
	var req sendNotifReq
	if err := httpx.Decode(r, &req); err != nil {
		httpx.WriteErr(w, err)
		return
	}
	if len(req.EvalIDs) == 0 {
		httpx.Error(w, http.StatusBadRequest, "evalIds required")
		return
	}

	sent := 0
	for _, evalID := range req.EvalIDs {
		ev, err := h.Store.EvaluationByID(r.Context(), evalID)
		if err != nil || ev == nil {
			continue
		}

		empName := ""
		if ev.EmployeeName != nil {
			empName = *ev.EmployeeName
		}

		var totalScore *int
		if ev.TotalScore != nil {
			v := *ev.TotalScore
			totalScore = &v
		}

		notifType := domain.NotificationType(req.Type)
		if notifType == "" {
			notifType = domain.NotifResultSummary
		}

		h.Notifier.Send(r.Context(), notifier.BuildPayload(
			notifType, ev.EmployeeID, empName, ev.ID, ev.Period, totalScore, ev.RatingLabel,
		))
		sent++
	}

	httpx.JSON(w, http.StatusOK, map[string]int{"sent": sent})
}

// NotificationLogs handles GET /notifications/logs.
func (h *Handler) NotificationLogs(w http.ResponseWriter, r *http.Request) {
	limit := 50
	offset := 0
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 200 {
			limit = n
		}
	}
	if v := r.URL.Query().Get("offset"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			offset = n
		}
	}
	logs, total, err := h.Store.ListNotificationLogs(r.Context(), limit, offset)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "fetch error")
		return
	}
	if logs == nil {
		logs = []domain.NotificationLog{}
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"logs": logs, "total": total})
}
