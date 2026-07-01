package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v4"

	"competency/internal/domain"
)

// ErrNoSystemUser indicates that no user row exists to act as a record actor.
var ErrNoSystemUser = errors.New("no system actor user found; run the seed command")

// SystemUserID returns a stable user id (seeded admin, else any user) for
// records that require a User foreign key when no identity is supplied.
func (s *Store) SystemUserID(ctx context.Context) (string, error) {
	var id string
	row := s.pool.QueryRow(ctx, `SELECT id FROM "User" ORDER BY (role = 'ADMIN') DESC, "createdAt" LIMIT 1`)
	err := row.Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNoSystemUser
	}
	return id, err
}

func scanUser(row pgx.Row) (*domain.User, error) {
	var u domain.User
	err := row.Scan(&u.ID, &u.Email, &u.Name, &u.HashedPassword, &u.Role, &u.IsActive, &u.EmployeeID, &u.CreatedAt, &u.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

// UserByID looks up a user by id (used to resolve the acting identity).
func (s *Store) UserByID(ctx context.Context, id string) (*domain.User, error) {
	row := s.pool.QueryRow(ctx, `
SELECT id, email, name, "hashedPassword", role, "isActive", "employeeId", "createdAt", "updatedAt"
FROM "User" WHERE id = $1`, id)
	return scanUser(row)
}

// ListUsers returns active users as selectable identities.
func (s *Store) ListUsers(ctx context.Context) ([]domain.User, error) {
	rows, err := s.pool.Query(ctx, `
SELECT id, email, name, "hashedPassword", role, "isActive", "employeeId", "createdAt", "updatedAt"
FROM "User" WHERE "isActive" = true ORDER BY role, name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.User{}
	for rows.Next() {
		u, err := scanUser(rows)
		if err != nil {
			return nil, err
		}
		if u != nil {
			out = append(out, *u)
		}
	}
	return out, rows.Err()
}
