package store

import (
	"context"
	"encoding/json"

	"competency/internal/domain"
)

// UserInput is the create/update payload for users.
type UserInput struct {
	Name       string  `json:"name"`
	Email      string  `json:"email"`
	Role       string  `json:"role"`
	IsActive   *bool   `json:"isActive"`
	EmployeeID *string `json:"employeeId"`
}

// ListAllUsers returns all users (including inactive) for admin view.
func (s *Store) ListAllUsers(ctx context.Context) ([]domain.User, error) {
	rows, err := s.pool.Query(ctx, `
SELECT id, email, name, "hashedPassword", role, "isActive", "employeeId", "createdAt", "updatedAt"
FROM "User" ORDER BY role, name`)
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

// CreateUser inserts a new user record.
func (s *Store) CreateUser(ctx context.Context, in UserInput) (string, error) {
	id := NewID()
	isActive := true
	if in.IsActive != nil {
		isActive = *in.IsActive
	}
	_, err := s.pool.Exec(ctx, `
INSERT INTO "User" (id, email, name, role, "isActive", "employeeId", "createdAt", "updatedAt")
VALUES ($1, $2, $3, $4::"Role", $5, $6, now(), now())`,
		id, in.Email, in.Name, in.Role, isActive, in.EmployeeID)
	return id, err
}

// UpdateUser updates a user's fields.
func (s *Store) UpdateUser(ctx context.Context, id string, in UserInput) (bool, error) {
	isActive := true
	if in.IsActive != nil {
		isActive = *in.IsActive
	}
	ct, err := s.pool.Exec(ctx, `
UPDATE "User" SET name=$2, email=$3, role=$4::"Role", "isActive"=$5, "employeeId"=$6, "updatedAt"=now()
WHERE id=$1`,
		id, in.Name, in.Email, in.Role, isActive, in.EmployeeID)
	if err != nil {
		return false, err
	}
	return ct.RowsAffected() > 0, nil
}

// DeactivateUser soft-deletes a user by setting isActive=false.
func (s *Store) DeactivateUser(ctx context.Context, id string) (bool, error) {
	ct, err := s.pool.Exec(ctx, `UPDATE "User" SET "isActive"=false, "updatedAt"=now() WHERE id=$1`, id)
	if err != nil {
		return false, err
	}
	return ct.RowsAffected() > 0, nil
}

// EmployeeByNumber looks up an employee by employeeNumber.
func (s *Store) EmployeeByNumber(ctx context.Context, num string) (*domain.Employee, error) {
	rows, err := s.pool.Query(ctx, employeeSelect+` WHERE e."employeeNumber" = $1`, num)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	if !rows.Next() {
		return nil, nil
	}
	e, err := scanEmployee(rows)
	if err != nil {
		return nil, err
	}
	return &e, nil
}

// UpsertUserForEmployee creates or updates a User linked to the given employee.
func (s *Store) UpsertUserForEmployee(ctx context.Context, employeeID, name, email, role string) error {
	_, err := s.pool.Exec(ctx, `
INSERT INTO "User" (id, email, name, role, "isActive", "employeeId", "createdAt", "updatedAt")
VALUES ($1, $2, $3, $4::"Role", true, $5, now(), now())
ON CONFLICT ("employeeId") DO UPDATE SET name=EXCLUDED.name, email=EXCLUDED.email, role=EXCLUDED.role::"Role", "updatedAt"=now()`,
		NewID(), email, name, role, employeeID)
	return err
}

// --- Settings ---

// GetSetting reads a JSON value from the Settings table.
func (s *Store) GetSetting(ctx context.Context, key string) (json.RawMessage, error) {
	var val json.RawMessage
	err := s.pool.QueryRow(ctx, `SELECT value FROM "Settings" WHERE key=$1`, key).Scan(&val)
	if err != nil {
		return nil, err
	}
	return val, nil
}

// SaveSetting upserts a setting by key.
func (s *Store) SaveSetting(ctx context.Context, key string, val json.RawMessage) error {
	_, err := s.pool.Exec(ctx, `
INSERT INTO "Settings" (key, value, "updatedAt")
VALUES ($1, $2, now())
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, "updatedAt"=now()`,
		key, val)
	return err
}
