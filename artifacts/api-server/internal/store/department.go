package store

import (
	"context"

	"competency/internal/domain"
)

// ListDepartments returns all departments ordered by level then name.
func (s *Store) ListDepartments(ctx context.Context) ([]domain.Department, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, name, level, "parentId" FROM "Department" ORDER BY level, name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.Department{}
	for rows.Next() {
		var d domain.Department
		if err := rows.Scan(&d.ID, &d.Name, &d.Level, &d.ParentID); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}
