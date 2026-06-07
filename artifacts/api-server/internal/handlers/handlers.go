// Package handlers implements the HTTP handlers for the REST API.
package handlers

import (
	"competency/internal/ai"
	"competency/internal/config"
	"competency/internal/store"
)

// Handler bundles dependencies shared by all route handlers.
type Handler struct {
	Store *store.Store
	AI    *ai.Client
	Cfg   *config.Config
}

// New constructs a Handler.
func New(s *store.Store, aiClient *ai.Client, cfg *config.Config) *Handler {
	return &Handler{Store: s, AI: aiClient, Cfg: cfg}
}

func (h *Handler) secure() bool { return h.Cfg.Env == "production" }
