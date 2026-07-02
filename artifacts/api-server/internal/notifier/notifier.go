// Package notifier sends email and WhatsApp notifications.
package notifier

import (
	"context"
	"encoding/json"
	"log/slog"

	"competency/internal/domain"
	"competency/internal/store"
)

// Notifier orchestrates sending notifications through configured channels.
type Notifier struct {
	Store *store.Store
}

// New creates a Notifier.
func New(s *store.Store) *Notifier { return &Notifier{Store: s} }

// LoadConfig reads the notification config from Settings (exported for handlers).
func (n *Notifier) LoadConfig(ctx context.Context) (*domain.NotificationConfig, error) {
	return n.loadConfig(ctx)
}

// loadConfig reads the notification config from Settings.
func (n *Notifier) loadConfig(ctx context.Context) (*domain.NotificationConfig, error) {
	raw, err := n.Store.GetSetting(ctx, "notification_config")
	if err != nil {
		return &domain.NotificationConfig{ReminderDays: 3}, nil // default
	}
	var cfg domain.NotificationConfig
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return &domain.NotificationConfig{ReminderDays: 3}, nil
	}
	if cfg.ReminderDays == 0 {
		cfg.ReminderDays = 3
	}
	return &cfg, nil
}

// SendPayload holds the data needed to render a notification.
type SendPayload struct {
	Type         domain.NotificationType
	EmployeeID   string
	EmployeeName string
	EvalID       string
	EvalPeriod   string
	TotalScore   *int
	RatingLabel  *string
	EvalLink     string
}

// BuildPayload creates a SendPayload with optional fields.
func BuildPayload(notifType domain.NotificationType, employeeID, employeeName, evalID, evalPeriod string, totalScore *int, ratingLabel *string) SendPayload {
	return SendPayload{
		Type:         notifType,
		EmployeeID:   employeeID,
		EmployeeName: employeeName,
		EvalID:       evalID,
		EvalPeriod:   evalPeriod,
		TotalScore:   totalScore,
		RatingLabel:  ratingLabel,
	}
}

// Send dispatches a notification through all enabled channels.
func (n *Notifier) Send(ctx context.Context, p SendPayload) {
	cfg, err := n.loadConfig(ctx)
	if err != nil {
		slog.Error("notifier: loadConfig", "err", err)
		return
	}

	email, name, _ := n.Store.EmployeeEmailByID(ctx, p.EmployeeID)
	if name != "" && p.EmployeeName == "" {
		p.EmployeeName = name
	}

	if p.EvalLink == "" && cfg.BaseURL != "" {
		p.EvalLink = cfg.BaseURL + "/evaluations"
	}

	subject, bodyHTML, bodyText := renderTemplates(p)

	// Email
	if cfg.EmailEnabled && email != "" {
		log := &domain.NotificationLog{
			RecipientID: p.EmployeeID,
			Recipient:   email,
			Channel:     domain.ChannelEmail,
			Type:        p.Type,
			Subject:     subject,
			Status:      domain.NotifPending,
			EvalID:      &p.EvalID,
		}
		_ = n.Store.InsertNotificationLog(ctx, log)

		var sendErr error
		if cfg.EmailProvider == "graph" {
			sendErr = sendViaGraph(ctx, n.Store, email, subject, bodyHTML)
		} else {
			sendErr = sendViaSMTP(cfg, email, subject, bodyHTML)
		}
		if sendErr != nil {
			errMsg := sendErr.Error()
			_ = n.Store.UpdateNotificationStatus(ctx, log.ID, domain.NotifFailed, &errMsg)
			slog.Error("notifier: email send failed", "to", email, "err", sendErr)
		} else {
			_ = n.Store.UpdateNotificationStatus(ctx, log.ID, domain.NotifSent, nil)
		}
	}

	// WhatsApp
	if cfg.WhatsAppEnabled {
		phone, _ := n.Store.EmployeePhoneByID(ctx, p.EmployeeID)
		if phone != "" {
			log := &domain.NotificationLog{
				RecipientID: p.EmployeeID,
				Recipient:   phone,
				Channel:     domain.ChannelWhatsApp,
				Type:        p.Type,
				Subject:     subject,
				Status:      domain.NotifPending,
				EvalID:      &p.EvalID,
			}
			_ = n.Store.InsertNotificationLog(ctx, log)

			sendErr := sendViaTwilio(cfg, phone, bodyText)
			if sendErr != nil {
				errMsg := sendErr.Error()
				_ = n.Store.UpdateNotificationStatus(ctx, log.ID, domain.NotifFailed, &errMsg)
				slog.Error("notifier: whatsapp send failed", "to", phone, "err", sendErr)
			} else {
				_ = n.Store.UpdateNotificationStatus(ctx, log.ID, domain.NotifSent, nil)
			}
		}
	}
}

// SendTest sends a test notification to verify channel configuration.
func (n *Notifier) SendTest(ctx context.Context, channel domain.NotificationChannel, to string) error {
	cfg, err := n.loadConfig(ctx)
	if err != nil {
		return err
	}

	subject := "إشعار تجريبي — منصة الكفاءات"
	bodyHTML := "<div dir='rtl' style='font-family:IBM Plex Sans Arabic,sans-serif;'><h2>إشعار تجريبي</h2><p>تم إرسال هذا الإشعار للتحقق من إعدادات القناة.</p></div>"
	bodyText := "إشعار تجريبي — تم إرسال هذا الإشعار للتحقق من إعدادات القناة."

	switch channel {
	case domain.ChannelEmail:
		if cfg.EmailProvider == "graph" {
			return sendViaGraph(ctx, n.Store, to, subject, bodyHTML)
		}
		return sendViaSMTP(cfg, to, subject, bodyHTML)
	case domain.ChannelWhatsApp:
		return sendViaTwilio(cfg, to, bodyText)
	}
	return nil
}
