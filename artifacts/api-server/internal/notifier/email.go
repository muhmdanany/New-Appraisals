package notifier

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/smtp"
	"strconv"

	"competency/internal/domain"
	"competency/internal/store"
)

// sendViaSMTP sends an HTML email using standard SMTP.
func sendViaSMTP(cfg *domain.NotificationConfig, to, subject, bodyHTML string) error {
	addr := net.JoinHostPort(cfg.SMTPHost, strconv.Itoa(cfg.SMTPPort))

	headers := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=\"UTF-8\"\r\n\r\n",
		cfg.SMTPFrom, to, subject)
	msg := []byte(headers + bodyHTML)

	var auth smtp.Auth
	if cfg.SMTPUser != "" {
		auth = smtp.PlainAuth("", cfg.SMTPUser, cfg.SMTPPassword, cfg.SMTPHost)
	}

	if cfg.SMTPTLS {
		tlsCfg := &tls.Config{ServerName: cfg.SMTPHost}
		conn, err := tls.Dial("tcp", addr, tlsCfg)
		if err != nil {
			return fmt.Errorf("smtp tls dial: %w", err)
		}
		client, err := smtp.NewClient(conn, cfg.SMTPHost)
		if err != nil {
			return fmt.Errorf("smtp client: %w", err)
		}
		defer client.Close()

		if auth != nil {
			if err := client.Auth(auth); err != nil {
				return fmt.Errorf("smtp auth: %w", err)
			}
		}
		if err := client.Mail(cfg.SMTPFrom); err != nil {
			return fmt.Errorf("smtp mail: %w", err)
		}
		if err := client.Rcpt(to); err != nil {
			return fmt.Errorf("smtp rcpt: %w", err)
		}
		w, err := client.Data()
		if err != nil {
			return fmt.Errorf("smtp data: %w", err)
		}
		if _, err := w.Write(msg); err != nil {
			return fmt.Errorf("smtp write: %w", err)
		}
		return w.Close()
	}

	return smtp.SendMail(addr, auth, cfg.SMTPFrom, []string{to}, msg)
}

// sendViaGraph sends an email using Microsoft Graph API (leveraging existing Office 365 config).
func sendViaGraph(ctx context.Context, st *store.Store, to, subject, bodyHTML string) error {
	// Read Office 365 config for token
	raw, err := st.GetSetting(ctx, "office365_config")
	if err != nil {
		return fmt.Errorf("graph: office365 config not found")
	}
	var o365 struct {
		TenantID     string `json:"tenantId"`
		ClientID     string `json:"clientId"`
		ClientSecret string `json:"clientSecret"`
	}
	if err := json.Unmarshal(raw, &o365); err != nil {
		return fmt.Errorf("graph: invalid office365 config")
	}

	// Get access token
	tokenURL := fmt.Sprintf("https://login.microsoftonline.com/%s/oauth2/v2.0/token", o365.TenantID)
	tokenBody := fmt.Sprintf("client_id=%s&scope=https%%3A%%2F%%2Fgraph.microsoft.com%%2F.default&client_secret=%s&grant_type=client_credentials",
		o365.ClientID, o365.ClientSecret)

	tokenResp, err := http.Post(tokenURL, "application/x-www-form-urlencoded", bytes.NewBufferString(tokenBody))
	if err != nil {
		return fmt.Errorf("graph: token request failed: %w", err)
	}
	defer tokenResp.Body.Close()

	var tokenResult struct {
		AccessToken string `json:"access_token"`
		Error       string `json:"error"`
	}
	if err := json.NewDecoder(tokenResp.Body).Decode(&tokenResult); err != nil {
		return fmt.Errorf("graph: token decode: %w", err)
	}
	if tokenResult.AccessToken == "" {
		return fmt.Errorf("graph: no access token (%s)", tokenResult.Error)
	}

	// Send email via Graph
	mailJSON := map[string]any{
		"message": map[string]any{
			"subject": subject,
			"body": map[string]string{
				"contentType": "HTML",
				"content":     bodyHTML,
			},
			"toRecipients": []map[string]any{
				{"emailAddress": map[string]string{"address": to}},
			},
		},
	}
	mailBytes, _ := json.Marshal(mailJSON)

	// Use /users endpoint with the first admin user, or sendMail on the application
	sendURL := "https://graph.microsoft.com/v1.0/users/" + to + "/sendMail"

	req, _ := http.NewRequestWithContext(ctx, "POST", sendURL, bytes.NewReader(mailBytes))
	req.Header.Set("Authorization", "Bearer "+tokenResult.AccessToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("graph: send failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("graph: HTTP %d — %s", resp.StatusCode, string(body))
	}
	return nil
}
