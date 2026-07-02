// Package handlers implements the HTTP handlers for the REST API.
package handlers

import (
	"context"
	"net/http"
	"sync"

	"competency/internal/ai"
	"competency/internal/config"
	"competency/internal/identity"
	"competency/internal/notifier"
	"competency/internal/rbac"
	"competency/internal/store"
)

// Handler bundles dependencies shared by all route handlers.
type Handler struct {
	Store    *store.Store
	AI       *ai.Client
	Cfg      *config.Config
	Notifier *notifier.Notifier

	permsMu sync.RWMutex
	perms   rbac.PermissionMatrix
}

// New constructs a Handler and loads permissions from DB.
func New(s *store.Store, aiClient *ai.Client, cfg *config.Config) *Handler {
	h := &Handler{Store: s, AI: aiClient, Cfg: cfg, Notifier: notifier.New(s)}
	h.perms = rbac.LoadPermissions(context.Background(), s)
	return h
}

func (h *Handler) secure() bool { return h.Cfg.Env == "production" }

// Perms returns the current permission matrix (thread-safe read).
func (h *Handler) Perms() rbac.PermissionMatrix {
	h.permsMu.RLock()
	defer h.permsMu.RUnlock()
	return h.perms
}

// ReloadPerms refreshes the cached permission matrix from DB.
func (h *Handler) ReloadPerms() {
	m := rbac.LoadPermissions(context.Background(), h.Store)
	h.permsMu.Lock()
	h.perms = m
	h.permsMu.Unlock()
}

// Require returns middleware that checks the permission matrix for the given resource+action.
func (h *Handler) Require(res rbac.Resource, act rbac.Action) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			u := identity.UserFrom(r.Context())
			if u == nil {
				http.Error(w, `{"detail":"Unauthorized"}`, http.StatusUnauthorized)
				return
			}
			if !rbac.Can(h.Perms(), u.Role, res, act) {
				http.Error(w, `{"detail":"Forbidden"}`, http.StatusForbidden)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
