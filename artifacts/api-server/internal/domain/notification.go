package domain

import "time"

// NotificationType enumerates the kinds of notification events.
type NotificationType string

const (
	NotifNewEvaluation    NotificationType = "NEW_EVALUATION"
	NotifDeadlineReminder NotificationType = "DEADLINE_REMINDER"
	NotifApproved         NotificationType = "APPROVED"
	NotifResultSummary    NotificationType = "RESULT_SUMMARY"
)

// NotificationChannel enumerates delivery channels.
type NotificationChannel string

const (
	ChannelEmail    NotificationChannel = "EMAIL"
	ChannelWhatsApp NotificationChannel = "WHATSAPP"
)

// NotificationStatus tracks delivery state.
type NotificationStatus string

const (
	NotifPending NotificationStatus = "PENDING"
	NotifSent    NotificationStatus = "SENT"
	NotifFailed  NotificationStatus = "FAILED"
)

// NotificationLog records a single notification dispatch attempt.
type NotificationLog struct {
	ID           string              `json:"id"`
	RecipientID  string              `json:"recipientId"`
	Recipient    string              `json:"recipient"`    // email or phone
	Channel      NotificationChannel `json:"channel"`
	Type         NotificationType    `json:"type"`
	Subject      string              `json:"subject"`
	Status       NotificationStatus  `json:"status"`
	ErrorMessage *string             `json:"errorMessage,omitempty"`
	EvalID       *string             `json:"evalId,omitempty"`
	CreatedAt    time.Time           `json:"createdAt"`
}

// NotificationConfig holds the admin-configurable notification settings.
type NotificationConfig struct {
	// Email settings
	EmailEnabled bool   `json:"emailEnabled"`
	EmailProvider string `json:"emailProvider"` // "smtp" or "graph"

	// SMTP settings
	SMTPHost     string `json:"smtpHost"`
	SMTPPort     int    `json:"smtpPort"`
	SMTPUser     string `json:"smtpUser"`
	SMTPPassword string `json:"smtpPassword"`
	SMTPFrom     string `json:"smtpFrom"`
	SMTPTLS      bool   `json:"smtpTLS"`

	// WhatsApp settings
	WhatsAppEnabled bool   `json:"whatsappEnabled"`
	TwilioSID       string `json:"twilioSid"`
	TwilioToken     string `json:"twilioToken"`
	TwilioFrom      string `json:"twilioFrom"` // whatsapp:+14155238886

	// Auto-notification toggles
	AutoNewEval     bool `json:"autoNewEval"`
	AutoApproved    bool `json:"autoApproved"`
	AutoReminder    bool `json:"autoReminder"`
	ReminderDays    int  `json:"reminderDays"` // days before deadline

	// Base URL for links
	BaseURL string `json:"baseUrl"`
}
