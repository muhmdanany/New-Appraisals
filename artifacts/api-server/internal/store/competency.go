package store

import (
	"context"

	"competency/internal/domain"
)

// CompetencyFilter narrows a competency list query.
type CompetencyFilter struct {
	Search string
	Type   string
	Take   int
	Skip   int
}

// ListCompetencies returns competencies matching the filter.
func (s *Store) ListCompetencies(ctx context.Context, f CompetencyFilter) ([]domain.Competency, error) {
	q := `SELECT id, name, type, level, description, indicators, "isShared", "sharedKey", "createdAt", "updatedAt"
		FROM "Competency" WHERE 1=1`
	args := []any{}
	if f.Search != "" {
		args = append(args, "%"+f.Search+"%")
		q += " AND name ILIKE $1"
	}
	if f.Type != "" {
		args = append(args, f.Type)
		q += " AND type = $" + itoa(len(args))
	}
	q += ` ORDER BY "isShared" DESC, name`
	if f.Take > 0 {
		args = append(args, f.Take)
		q += " LIMIT $" + itoa(len(args))
	}
	if f.Skip > 0 {
		args = append(args, f.Skip)
		q += " OFFSET $" + itoa(len(args))
	}

	rows, err := s.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.Competency{}
	for rows.Next() {
		var c domain.Competency
		if err := rows.Scan(&c.ID, &c.Name, &c.Type, &c.Level, &c.Description, &c.Indicators, &c.IsShared, &c.SharedKey, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// CompetencyOption is a minimal competency view.
type CompetencyOption struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Type string `json:"type"`
}

// CompetencyOptions returns minimal competencies for selects.
func (s *Store) CompetencyOptions(ctx context.Context) ([]CompetencyOption, error) {
	rows, err := s.pool.Query(ctx, `SELECT id, name, type FROM "Competency" ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []CompetencyOption{}
	for rows.Next() {
		var c CompetencyOption
		if err := rows.Scan(&c.ID, &c.Name, &c.Type); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// CompetencyInput is the create/update payload.
type CompetencyInput struct {
	Name        string  `json:"name"`
	Type        string  `json:"type"`
	Level       string  `json:"level"`
	Description *string `json:"description"`
	Indicators  *string `json:"indicators"`
}

// CreateCompetency inserts a competency.
func (s *Store) CreateCompetency(ctx context.Context, in CompetencyInput) (*domain.Competency, error) {
	id := NewID()
	_, err := s.pool.Exec(ctx, `
		INSERT INTO "Competency" (id, name, type, level, description, indicators, "isShared", "createdAt", "updatedAt")
		VALUES ($1,$2,$3,$4,$5,$6,false, now(), now())`,
		id, in.Name, in.Type, in.Level, in.Description, in.Indicators)
	if err != nil {
		return nil, err
	}
	return s.competencyByID(ctx, id)
}

// UpdateCompetency updates a competency.
func (s *Store) UpdateCompetency(ctx context.Context, id string, in CompetencyInput) (*domain.Competency, error) {
	ct, err := s.pool.Exec(ctx, `
		UPDATE "Competency" SET name=$2, type=$3, level=$4, description=$5, indicators=$6, "updatedAt"=now()
		WHERE id=$1`, id, in.Name, in.Type, in.Level, in.Description, in.Indicators)
	if err != nil {
		return nil, err
	}
	if ct.RowsAffected() == 0 {
		return nil, nil
	}
	return s.competencyByID(ctx, id)
}

// DeleteCompetency removes a competency by id, cleaning up references first.
func (s *Store) DeleteCompetency(ctx context.Context, id string) (deleted, shared bool, err error) {
	// Clean up evaluation items referencing this competency.
	_, _ = s.pool.Exec(ctx, `DELETE FROM "EvaluationItem" WHERE "competencyId"=$1`, id)
	// Clean up job-competency links.
	_, _ = s.pool.Exec(ctx, `DELETE FROM "JobCompetency" WHERE "competencyId"=$1`, id)
	// Clean up template items referencing this competency.
	_, _ = s.pool.Exec(ctx, `DELETE FROM eval_template_items WHERE competency_id=$1`, id)
	_, err = s.pool.Exec(ctx, `DELETE FROM "Competency" WHERE id=$1`, id)
	return err == nil, false, err
}

// UpsertCompetencyByName inserts or updates a competency keyed by name, returning its id.
func (s *Store) UpsertCompetencyByName(ctx context.Context, in CompetencyInput) (string, error) {
	var id string
	row := s.pool.QueryRow(ctx, `
		INSERT INTO "Competency" (id, name, type, level, description, indicators, "isShared", "createdAt", "updatedAt")
		VALUES ($1,$2,$3,$4,$5,$6,false, now(), now())
		ON CONFLICT (name) DO UPDATE SET type=EXCLUDED.type, level=EXCLUDED.level,
			description=EXCLUDED.description, indicators=EXCLUDED.indicators, "updatedAt"=now()
		RETURNING id`,
		NewID(), in.Name, in.Type, in.Level, in.Description, in.Indicators)
	err := row.Scan(&id)
	return id, err
}

func (s *Store) competencyByID(ctx context.Context, id string) (*domain.Competency, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT id, name, type, level, description, indicators, "isShared", "sharedKey", "createdAt", "updatedAt"
		FROM "Competency" WHERE id=$1`, id)
	var c domain.Competency
	if err := row.Scan(&c.ID, &c.Name, &c.Type, &c.Level, &c.Description, &c.Indicators, &c.IsShared, &c.SharedKey, &c.CreatedAt, &c.UpdatedAt); err != nil {
		return nil, err
	}
	return &c, nil
}
