// Package ai wraps the OpenRouter (OpenAI-compatible) chat completions API and
// exposes the HR generation helpers used by the platform. The provider is
// pluggable via configuration; when no API key is present, calls fail with a
// clear, explicit error rather than returning fabricated data.
package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const endpoint = "https://openrouter.ai/api/v1/chat/completions"

// ErrNotConfigured is returned when no OpenRouter API key is configured.
var ErrNotConfigured = errors.New("AI is not configured: set OPENROUTER_API_KEY")

// Client talks to OpenRouter.
type Client struct {
	apiKey string
	model  string
	http   *http.Client
}

// New builds an AI client.
func New(apiKey, model string) *Client {
	return &Client{
		apiKey: apiKey,
		model:  model,
		http:   &http.Client{Timeout: 90 * time.Second},
	}
}

// Configured reports whether an API key is available.
func (c *Client) Configured() bool { return c.apiKey != "" }

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatRequest struct {
	Model          string          `json:"model"`
	Messages       []chatMessage   `json:"messages"`
	Temperature    float64         `json:"temperature"`
	ResponseFormat map[string]any  `json:"response_format,omitempty"`
}

type chatResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

// completeJSON sends a prompt asking for JSON and returns the raw content.
func (c *Client) completeJSON(ctx context.Context, system, user string) (string, error) {
	if !c.Configured() {
		return "", ErrNotConfigured
	}
	body, _ := json.Marshal(chatRequest{
		Model: c.model,
		Messages: []chatMessage{
			{Role: "system", Content: system},
			{Role: "user", Content: user},
		},
		Temperature:    0.4,
		ResponseFormat: map[string]any{"type": "json_object"},
	})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Title", "Competency Platform")

	resp, err := c.http.Do(req)
	if err != nil {
		return "", fmt.Errorf("AI request failed: %w", err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return "", fmt.Errorf("AI provider error (%d): %s", resp.StatusCode, strings.TrimSpace(string(raw)))
	}
	var parsed chatResponse
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return "", fmt.Errorf("AI response decode failed: %w", err)
	}
	if parsed.Error != nil {
		return "", fmt.Errorf("AI provider error: %s", parsed.Error.Message)
	}
	if len(parsed.Choices) == 0 {
		return "", errors.New("AI returned no choices")
	}
	return strings.TrimSpace(parsed.Choices[0].Message.Content), nil
}

func stripFences(s string) string {
	s = strings.TrimSpace(s)
	if strings.HasPrefix(s, "```") {
		s = strings.TrimPrefix(s, "```json")
		s = strings.TrimPrefix(s, "```")
		s = strings.TrimSuffix(s, "```")
	}
	return strings.TrimSpace(s)
}

func decodeInto(raw string, dst any) error {
	if err := json.Unmarshal([]byte(stripFences(raw)), dst); err != nil {
		return fmt.Errorf("AI returned malformed JSON: %w", err)
	}
	return nil
}
