package handlers

import (
	"net/http"
	"time"

	"competency/internal/httpx"
)

// Healthz is a public health probe.
func (h *Handler) Healthz(w http.ResponseWriter, r *http.Request) {
	httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// Health mirrors the original me.health procedure.
func (h *Handler) Health(w http.ResponseWriter, r *http.Request) {
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "ts": time.Now().UnixMilli()})
}
