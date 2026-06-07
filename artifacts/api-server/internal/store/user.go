package store

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v4"

	"competency/internal/domain"
)

// UserByEmail looks up a user by email (case-insensitive).
func (s *Store) UserByEmail(ctx context.Context, email string) (*domain.User, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT id, email, name, "hashedPassword", role, "isActive", "employeeId", "createdAt", "updatedAt"
		FROM "User" WHERE lower(email) = lower($1)`, email)
	return scanUser(row)
}

// UserByID looks up a user by id.
func (s *Store) UserByID(ctx context.Context, id string) (*domain.User, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT id, email, name, "hashedPassword", role, "isActive", "employeeId", "createdAt", "updatedAt"
		FROM "User" WHERE id = $1`, id)
	return scanUser(row)
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

// CurrentUser builds the authenticated-user payload, joining the linked employee.
func (s *Store) CurrentUser(ctx context.Context, id string) (*domain.CurrentUser, error) {
	u, err := s.UserByID(ctx, id)
	if err != nil || u == nil {
		return nil, err
	}
	cu := &domain.CurrentUser{
		ID: u.ID, Email: u.Email, Name: u.Name, Role: u.Role, EmployeeID: u.EmployeeID,
	}
	if u.EmployeeID != nil {
		row := s.pool.QueryRow(ctx, `
			SELECT e.id, e.name, e."employeeNumber", e."departmentId", d.name
			FROM "Employee" e LEFT JOIN "Department" d ON d.id = e."departmentId"
			WHERE e.id = $1`, *u.EmployeeID)
		var es domain.EmployeeSummary
		if err := row.Scan(&es.ID, &es.Name, &es.EmployeeNumber, &es.DepartmentID, &es.DepartmentName); err == nil {
			cu.Employee = &es
		}
	}
	return cu, nil
}

// --- Sessions -------------------------------------------------------------

// CreateSession inserts a new session row and returns its token.
func (s *Store) CreateSession(ctx context.Context, userID, token string, expires time.Time) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO "Session" (id, "sessionToken", "userId", expires)
		VALUES ($1, $2, $3, $4)`, NewID(), token, userID, expires)
	return err
}

// SessionUserID returns the user id for a valid (unexpired) session token.
func (s *Store) SessionUserID(ctx context.Context, token string) (string, error) {
	var userID string
	var expires time.Time
	row := s.pool.QueryRow(ctx, `SELECT "userId", expires FROM "Session" WHERE "sessionToken" = $1`, token)
	err := row.Scan(&userID, &expires)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	if time.Now().After(expires) {
		_ = s.DeleteSession(ctx, token)
		return "", nil
	}
	return userID, nil
}

// DeleteSession removes a session by token.
func (s *Store) DeleteSession(ctx context.Context, token string) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM "Session" WHERE "sessionToken" = $1`, token)
	return err
}
