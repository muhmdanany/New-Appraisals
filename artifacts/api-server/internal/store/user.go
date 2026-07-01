package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v4"
)

// ErrNoSystemUser indicates that no user row exists to act as the record actor.
// The system has no login, so records that require a User foreign key
// (e.g. Evaluation.evaluatorId) borrow a stable existing user; if the table is
// empty this is surfaced as a clear error instead of a cryptic FK violation.
var ErrNoSystemUser = errors.New("no system actor user found; run the seed command")

// SystemUserID returns a stable user id to use as the actor for records that
// require a User foreign key. Since the system has no login, it resolves the
// seeded admin user, falling back to any user, and returns ErrNoSystemUser when
// no user exists.
func (s *Store) SystemUserID(ctx context.Context) (string, error) {
	var id string
	row := s.pool.QueryRow(ctx, `SELECT id FROM "User" ORDER BY (role = 'ADMIN') DESC, "createdAt" LIMIT 1`)
	err := row.Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNoSystemUser
	}
	return id, err
}
