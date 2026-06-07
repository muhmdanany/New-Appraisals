package store

import (
	"context"
	"encoding/json"
)

// WriteAudit records an audit-log entry. It never returns an error to the
// caller in a way that should abort the primary operation; callers may ignore
// the result. (Mirrors the original resilient audit service.)
func (s *Store) WriteAudit(ctx context.Context, userID *string, action, entityType string, entityID *string, metadata map[string]any, ip *string) error {
	var meta []byte
	if metadata != nil {
		meta, _ = json.Marshal(metadata)
	}
	_, err := s.pool.Exec(ctx, `
		INSERT INTO "AuditLog" (id, "userId", action, "entityType", "entityId", metadata, "ipAddress", "createdAt")
		VALUES ($1, $2, $3, $4, $5, $6, $7, now())`,
		NewID(), userID, action, entityType, entityID, meta, ip)
	return err
}
