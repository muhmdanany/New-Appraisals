package notifier

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"competency/internal/domain"
)

// sendViaTwilio sends a WhatsApp message via Twilio's REST API.
func sendViaTwilio(cfg *domain.NotificationConfig, to, body string) error {
	if cfg.TwilioSID == "" || cfg.TwilioToken == "" || cfg.TwilioFrom == "" {
		return fmt.Errorf("twilio: missing configuration")
	}

	// Ensure "whatsapp:" prefix
	if !strings.HasPrefix(to, "whatsapp:") {
		to = "whatsapp:" + to
	}
	from := cfg.TwilioFrom
	if !strings.HasPrefix(from, "whatsapp:") {
		from = "whatsapp:" + from
	}

	apiURL := fmt.Sprintf("https://api.twilio.com/2010-04-01/Accounts/%s/Messages.json", cfg.TwilioSID)

	data := url.Values{}
	data.Set("From", from)
	data.Set("To", to)
	data.Set("Body", body)

	req, err := http.NewRequest("POST", apiURL, strings.NewReader(data.Encode()))
	if err != nil {
		return fmt.Errorf("twilio: request build: %w", err)
	}
	req.SetBasicAuth(cfg.TwilioSID, cfg.TwilioToken)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("twilio: request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("twilio: HTTP %d — %s", resp.StatusCode, string(body))
	}
	return nil
}
