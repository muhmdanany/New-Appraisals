package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"competency/internal/httpx"
)

const office365SettingsKey = "office365_config"

// office365Config holds Azure AD / Entra ID connection details.
type office365Config struct {
	TenantID     string `json:"tenantId"`
	ClientID     string `json:"clientId"`
	ClientSecret string `json:"clientSecret"`
}

// GetOffice365Config returns the saved Office 365 config (secrets masked).
func (h *Handler) GetOffice365Config(w http.ResponseWriter, r *http.Request) {
	val, err := h.Store.GetSetting(r.Context(), office365SettingsKey)
	if err != nil {
		httpx.JSON(w, http.StatusOK, office365Config{})
		return
	}
	var cfg office365Config
	if err := json.Unmarshal(val, &cfg); err != nil {
		httpx.JSON(w, http.StatusOK, office365Config{})
		return
	}
	// Mask the secret for the response.
	if len(cfg.ClientSecret) > 4 {
		cfg.ClientSecret = strings.Repeat("*", len(cfg.ClientSecret)-4) + cfg.ClientSecret[len(cfg.ClientSecret)-4:]
	}
	httpx.JSON(w, http.StatusOK, cfg)
}

// SaveOffice365Config saves the Office 365 connection settings.
func (h *Handler) SaveOffice365Config(w http.ResponseWriter, r *http.Request) {
	var cfg office365Config
	if err := httpx.Decode(r, &cfg); err != nil {
		httpx.WriteErr(w, err)
		return
	}
	if cfg.TenantID == "" || cfg.ClientID == "" || cfg.ClientSecret == "" {
		httpx.Error(w, http.StatusBadRequest, "جميع الحقول مطلوبة")
		return
	}

	// If secret is masked (unchanged), preserve the old one.
	if strings.Contains(cfg.ClientSecret, "*") {
		old, err := h.Store.GetSetting(r.Context(), office365SettingsKey)
		if err == nil {
			var prev office365Config
			if json.Unmarshal(old, &prev) == nil {
				cfg.ClientSecret = prev.ClientSecret
			}
		}
	}

	val, _ := json.Marshal(cfg)
	if err := h.Store.SaveSetting(r.Context(), office365SettingsKey, val); err != nil {
		httpx.WriteErr(w, err)
		return
	}
	h.audit(r, "office365.config.update", "Settings", nil)
	httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// office365TokenResponse represents the OAuth token response from Azure AD.
type office365TokenResponse struct {
	AccessToken string `json:"access_token"`
	ExpiresIn   int    `json:"expires_in"`
	TokenType   string `json:"token_type"`
}

// office365GraphUser represents a user from Microsoft Graph.
type office365GraphUser struct {
	ID          string `json:"id"`
	DisplayName string `json:"displayName"`
	Mail        string `json:"mail"`
	UPN         string `json:"userPrincipalName"`
	JobTitle    string `json:"jobTitle"`
	Department  string `json:"department"`
}

type graphUsersResponse struct {
	Value   []office365GraphUser `json:"value"`
	NextURL string               `json:"@odata.nextLink"`
}

// FetchOffice365Users fetches users from Microsoft Graph API using client credentials.
func (h *Handler) FetchOffice365Users(w http.ResponseWriter, r *http.Request) {
	// Load saved config.
	val, err := h.Store.GetSetting(r.Context(), office365SettingsKey)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "لم يتم حفظ إعدادات Office 365 بعد")
		return
	}
	var cfg office365Config
	if err := json.Unmarshal(val, &cfg); err != nil || cfg.TenantID == "" {
		httpx.Error(w, http.StatusBadRequest, "إعدادات Office 365 غير صالحة")
		return
	}

	// Step 1: Get access token via client credentials flow.
	tokenURL := fmt.Sprintf("https://login.microsoftonline.com/%s/oauth2/v2.0/token", cfg.TenantID)
	form := url.Values{}
	form.Set("grant_type", "client_credentials")
	form.Set("client_id", cfg.ClientID)
	form.Set("client_secret", cfg.ClientSecret)
	form.Set("scope", "https://graph.microsoft.com/.default")

	client := &http.Client{Timeout: 15 * time.Second}
	tokenResp, err := client.PostForm(tokenURL, form)
	if err != nil {
		httpx.Error(w, http.StatusBadGateway, "فشل الاتصال بخدمة Microsoft: "+err.Error())
		return
	}
	defer tokenResp.Body.Close()

	if tokenResp.StatusCode != 200 {
		body, _ := io.ReadAll(tokenResp.Body)
		httpx.Error(w, http.StatusBadGateway, "فشل الحصول على رمز الوصول: "+string(body))
		return
	}

	var tok office365TokenResponse
	if err := json.NewDecoder(tokenResp.Body).Decode(&tok); err != nil {
		httpx.Error(w, http.StatusBadGateway, "فشل قراءة رمز الوصول")
		return
	}

	// Step 2: Fetch users from Microsoft Graph.
	graphURL := "https://graph.microsoft.com/v1.0/users?$select=id,displayName,mail,userPrincipalName,jobTitle,department&$top=999"
	req, _ := http.NewRequest("GET", graphURL, nil)
	req.Header.Set("Authorization", "Bearer "+tok.AccessToken)
	req.Header.Set("Content-Type", "application/json")

	usersResp, err := client.Do(req)
	if err != nil {
		httpx.Error(w, http.StatusBadGateway, "فشل جلب المستخدمين من Microsoft Graph: "+err.Error())
		return
	}
	defer usersResp.Body.Close()

	if usersResp.StatusCode != 200 {
		body, _ := io.ReadAll(usersResp.Body)
		httpx.Error(w, http.StatusBadGateway, "خطأ في Microsoft Graph API: "+string(body))
		return
	}

	var graphResp graphUsersResponse
	if err := json.NewDecoder(usersResp.Body).Decode(&graphResp); err != nil {
		httpx.Error(w, http.StatusBadGateway, "فشل قراءة بيانات المستخدمين")
		return
	}

	// Return the users list.
	h.audit(r, "office365.fetch_users", "Employee", nil)
	httpx.JSON(w, http.StatusOK, map[string]interface{}{
		"users": graphResp.Value,
		"count": len(graphResp.Value),
	})
}
