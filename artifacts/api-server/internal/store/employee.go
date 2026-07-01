package store

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v4"

	"competency/internal/domain"
)

const employeeSelect = `
	SELECT e.id, e."employeeNumber", e.name, e."jobId", e."departmentId", e."gradeId", e."managerId",
		e."extraFields", e."createdAt", e."updatedAt",
		j.name, d.name, g.name, m.name
	FROM "Employee" e
	LEFT JOIN "Job" j ON j.id = e."jobId"
	LEFT JOIN "Department" d ON d.id = e."departmentId"
	LEFT JOIN "Grade" g ON g.id = e."gradeId"
	LEFT JOIN "Employee" m ON m.id = e."managerId"`

func scanEmployee(rows pgx.Rows) (domain.Employee, error) {
	var e domain.Employee
	var extra []byte
	err := rows.Scan(&e.ID, &e.EmployeeNumber, &e.Name, &e.JobID, &e.DepartmentID, &e.GradeID, &e.ManagerID,
		&extra, &e.CreatedAt, &e.UpdatedAt, &e.JobName, &e.DepartmentName, &e.GradeName, &e.ManagerName)
	if err != nil {
		return e, err
	}
	e.ExtraFields = map[string]string{}
	if len(extra) > 0 {
		_ = json.Unmarshal(extra, &e.ExtraFields)
	}
	return e, nil
}

// ListAllEmployees returns every employee (org-wide access).
func (s *Store) ListAllEmployees(ctx context.Context, search string) ([]domain.Employee, error) {
	q := employeeSelect
	args := []any{}
	if search != "" {
		args = append(args, "%"+search+"%")
		q += ` WHERE e.name ILIKE $1 OR e."employeeNumber" ILIKE $1`
	}
	q += " ORDER BY e.name"
	return s.queryEmployees(ctx, q, args...)
}

// ListVisibleEmployees returns the subtree of employees reporting (directly or
// transitively) to the given root employee, including the root.
func (s *Store) ListVisibleEmployees(ctx context.Context, rootEmployeeID string) ([]domain.Employee, error) {
	q := `
		WITH RECURSIVE subtree AS (
			SELECT id FROM "Employee" WHERE id = $1
			UNION ALL
			SELECT e.id FROM "Employee" e JOIN subtree s ON e."managerId" = s.id
		)` + employeeSelect + ` WHERE e.id IN (SELECT id FROM subtree) ORDER BY e.name`
	return s.queryEmployees(ctx, q, rootEmployeeID)
}

// VisibleEmployeeIDs returns the set of employee ids in a manager's subtree.
func (s *Store) VisibleEmployeeIDs(ctx context.Context, rootEmployeeID string) (map[string]bool, error) {
	rows, err := s.pool.Query(ctx, `
		WITH RECURSIVE subtree AS (
			SELECT id FROM "Employee" WHERE id = $1
			UNION ALL
			SELECT e.id FROM "Employee" e JOIN subtree s ON e."managerId" = s.id
		) SELECT id FROM subtree`, rootEmployeeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]bool{}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out[id] = true
	}
	return out, rows.Err()
}

func (s *Store) queryEmployees(ctx context.Context, q string, args ...any) ([]domain.Employee, error) {
	rows, err := s.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.Employee{}
	for rows.Next() {
		e, err := scanEmployee(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

// EmployeeByID returns one employee.
func (s *Store) EmployeeByID(ctx context.Context, id string) (*domain.Employee, error) {
	rows, err := s.pool.Query(ctx, employeeSelect+" WHERE e.id = $1", id)
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

// EmployeeInput is the create/update payload.
type EmployeeInput struct {
	Name           string            `json:"name"`
	EmployeeNumber string            `json:"employeeNumber"`
	JobID          *string           `json:"jobId"`
	DepartmentID   *string           `json:"departmentId"`
	GradeID        *string           `json:"gradeId"`
	ManagerID      *string           `json:"managerId"`
	ExtraFields    map[string]string `json:"extraFields"`
}

// CreateEmployee inserts an employee.
func (s *Store) CreateEmployee(ctx context.Context, in EmployeeInput) (string, error) {
	id := NewID()
	extra, _ := json.Marshal(orEmptyMap(in.ExtraFields))
	_, err := s.pool.Exec(ctx, `
		INSERT INTO "Employee" (id, "employeeNumber", name, "jobId", "departmentId", "gradeId", "managerId", "extraFields", "createdAt", "updatedAt")
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now(), now())`,
		id, in.EmployeeNumber, in.Name, in.JobID, in.DepartmentID, in.GradeID, in.ManagerID, extra)
	return id, err
}

// UpdateEmployee updates an employee.
func (s *Store) UpdateEmployee(ctx context.Context, id string, in EmployeeInput) (bool, error) {
	extra, _ := json.Marshal(orEmptyMap(in.ExtraFields))
	ct, err := s.pool.Exec(ctx, `
		UPDATE "Employee" SET "employeeNumber"=$2, name=$3, "jobId"=$4, "departmentId"=$5, "gradeId"=$6, "managerId"=$7, "extraFields"=$8, "updatedAt"=now()
		WHERE id=$1`,
		id, in.EmployeeNumber, in.Name, in.JobID, in.DepartmentID, in.GradeID, in.ManagerID, extra)
	if err != nil {
		return false, err
	}
	return ct.RowsAffected() > 0, nil
}

// UpsertEmployeeByNumber inserts/updates core fields keyed by employeeNumber (import pass 1).
func (s *Store) UpsertEmployeeByNumber(ctx context.Context, in EmployeeInput) error {
	extra, _ := json.Marshal(orEmptyMap(in.ExtraFields))
	_, err := s.pool.Exec(ctx, `
		INSERT INTO "Employee" (id, "employeeNumber", name, "jobId", "departmentId", "gradeId", "extraFields", "createdAt", "updatedAt")
		VALUES ($1,$2,$3,$4,$5,$6,$7, now(), now())
		ON CONFLICT ("employeeNumber") DO UPDATE SET name=EXCLUDED.name, "jobId"=EXCLUDED."jobId",
			"departmentId"=EXCLUDED."departmentId", "gradeId"=EXCLUDED."gradeId", "extraFields"=EXCLUDED."extraFields", "updatedAt"=now()`,
		NewID(), in.EmployeeNumber, in.Name, in.JobID, in.DepartmentID, in.GradeID, extra)
	return err
}

// LinkManagerByNumber sets managerId by resolving the manager's employeeNumber (import pass 2).
func (s *Store) LinkManagerByNumber(ctx context.Context, employeeNumber, managerNumber string) error {
	var managerID string
	err := s.pool.QueryRow(ctx, `SELECT id FROM "Employee" WHERE "employeeNumber"=$1`, managerNumber).Scan(&managerID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	_, err = s.pool.Exec(ctx, `UPDATE "Employee" SET "managerId"=$2, "updatedAt"=now() WHERE "employeeNumber"=$1`, employeeNumber, managerID)
	return err
}

func orEmptyMap(m map[string]string) map[string]string {
	if m == nil {
		return map[string]string{}
	}
	return m
}
