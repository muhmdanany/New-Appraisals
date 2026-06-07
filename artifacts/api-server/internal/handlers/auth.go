package handlers

import (
	"net/http"
	"strings"
	"time"

	"competency/internal/auth"
	"competency/internal/httpx"
)

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// Login authenticates a user and starts a session.
func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.WriteErr(w, err)
		return
	}
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Email == "" || req.Password == "" {
		httpx.Error(w, http.StatusBadRequest, "Email and password are required")
		return
	}

	u, err := h.Store.UserByEmail(r.Context(), req.Email)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Internal server error")
		return
	}
	if u == nil || u.HashedPassword == nil || !u.IsActive || !auth.CheckPassword(*u.HashedPassword, req.Password) {
		httpx.Error(w, http.StatusUnauthorized, "Invalid email or password")
		return
	}

	token, err := auth.NewToken()
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Internal server error")
		return
	}
	if err := h.Store.CreateSession(r.Context(), u.ID, token, time.Now().Add(auth.SessionTTL)); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Internal server error")
		return
	}
	_ = h.Store.WriteAudit(r.Context(), &u.ID, "auth.signIn", "User", &u.ID, nil, clientIP(r))
	auth.SetCookie(w, token, h.secure())

	cu, err := h.Store.CurrentUser(r.Context(), u.ID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Internal server error")
		return
	}
	httpx.JSON(w, http.StatusOK, cu)
}

// Logout clears the current session.
func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(auth.CookieName); err == nil && c.Value != "" {
		_ = h.Store.DeleteSession(r.Context(), c.Value)
	}
	auth.ClearCookie(w, h.secure())
	httpx.JSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// Me returns the current authenticated user.
func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	u := auth.UserFrom(r.Context())
	cu, err := h.Store.CurrentUser(r.Context(), u.ID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Internal server error")
		return
	}
	httpx.JSON(w, http.StatusOK, cu)
}

func clientIP(r *http.Request) *string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		ip := strings.TrimSpace(strings.Split(xff, ",")[0])
		return &ip
	}
	if r.RemoteAddr != "" {
		return &r.RemoteAddr
	}
	return nil
}
