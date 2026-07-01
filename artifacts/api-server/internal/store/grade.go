package store

import (
	"context"

	"github.com/jackc/pgx/v4"

	"competency/internal/domain"
)

// ListGrades returns all grades with nested levels, sorted numerically by num.
func (s *Store) ListGrades(ctx context.Context) ([]domain.Grade, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, num, name, classification, "leaveDays", "salaryMin", "salaryMax",
			housing, transport, bonus, benefits
		FROM "Grade"
		ORDER BY NULLIF(regexp_replace(num, '\D', '', 'g'), '')::int NULLS LAST, num`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	grades := []domain.Grade{}
	index := map[string]int{}
	for rows.Next() {
		var g domain.Grade
		if err := rows.Scan(&g.ID, &g.Num, &g.Name, &g.Classification, &g.LeaveDays, &g.SalaryMin, &g.SalaryMax,
			&g.Housing, &g.Transport, &g.Bonus, &g.Benefits); err != nil {
			return nil, err
		}
		g.Levels = []domain.GradeLevel{}
		index[g.ID] = len(grades)
		grades = append(grades, g)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	lrows, err := s.pool.Query(ctx, `
		SELECT id, "gradeId", level, label, "minScore", "stayYears",
			"minYrsSecondary", "minYrsDiploma", "minYrsBachelor", "minYrsMaster", "minYrsPhd", competencies
		FROM "GradeLevel" ORDER BY "gradeId", level`)
	if err != nil {
		return nil, err
	}
	defer lrows.Close()
	for lrows.Next() {
		var l domain.GradeLevel
		if err := lrows.Scan(&l.ID, &l.GradeID, &l.Level, &l.Label, &l.MinScore, &l.StayYears,
			&l.MinYrsSecondary, &l.MinYrsDiploma, &l.MinYrsBachelor, &l.MinYrsMaster, &l.MinYrsPhd, &l.Competencies); err != nil {
			return nil, err
		}
		if idx, ok := index[l.GradeID]; ok {
			grades[idx].Levels = append(grades[idx].Levels, l)
		}
	}
	return grades, lrows.Err()
}

// GradeInput is the create/import payload.
type GradeInput struct {
	Num            string            `json:"num"`
	Name           string            `json:"name"`
	Classification *string           `json:"classification"`
	LeaveDays      *int              `json:"leaveDays"`
	SalaryMin      *float64          `json:"salaryMin"`
	SalaryMax      *float64          `json:"salaryMax"`
	Housing        *string           `json:"housing"`
	Transport      *string           `json:"transport"`
	Bonus          *string           `json:"bonus"`
	Benefits       *string           `json:"benefits"`
	Levels         []GradeLevelInput `json:"levels"`
}

// GradeLevelInput is a nested level on a grade.
type GradeLevelInput struct {
	Level           int     `json:"level"`
	Label           string  `json:"label"`
	MinScore        *int    `json:"minScore"`
	StayYears       *int    `json:"stayYears"`
	MinYrsSecondary *int    `json:"minYrsSecondary"`
	MinYrsDiploma   *int    `json:"minYrsDiploma"`
	MinYrsBachelor  *int    `json:"minYrsBachelor"`
	MinYrsMaster    *int    `json:"minYrsMaster"`
	MinYrsPhd       *int    `json:"minYrsPhd"`
	Competencies    *string `json:"competencies"`
}

func ival(p *int, d int) int {
	if p != nil {
		return *p
	}
	return d
}

// UpsertGrade creates or updates a grade by num, replacing nested levels.
func (s *Store) UpsertGrade(ctx context.Context, in GradeInput) (string, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)

	leave := ival(in.LeaveDays, 21)
	var id string
	row := tx.QueryRow(ctx, `
		INSERT INTO "Grade" (id, num, name, classification, "leaveDays", "salaryMin", "salaryMax", housing, transport, bonus, benefits, "createdAt", "updatedAt")
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now(), now())
		ON CONFLICT (num) DO UPDATE SET name=EXCLUDED.name, classification=EXCLUDED.classification,
			"leaveDays"=EXCLUDED."leaveDays", "salaryMin"=EXCLUDED."salaryMin", "salaryMax"=EXCLUDED."salaryMax",
			housing=EXCLUDED.housing, transport=EXCLUDED.transport, bonus=EXCLUDED.bonus, benefits=EXCLUDED.benefits, "updatedAt"=now()
		RETURNING id`,
		NewID(), in.Num, in.Name, in.Classification, leave, in.SalaryMin, in.SalaryMax, in.Housing, in.Transport, in.Bonus, in.Benefits)
	if err := row.Scan(&id); err != nil {
		return "", err
	}

	if _, err := tx.Exec(ctx, `DELETE FROM "GradeLevel" WHERE "gradeId"=$1`, id); err != nil {
		return "", err
	}
	for _, l := range in.Levels {
		_, err := tx.Exec(ctx, `
			INSERT INTO "GradeLevel" (id, "gradeId", level, label, "minScore", "stayYears",
				"minYrsSecondary", "minYrsDiploma", "minYrsBachelor", "minYrsMaster", "minYrsPhd", competencies)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
			NewID(), id, l.Level, l.Label, ival(l.MinScore, 85), ival(l.StayYears, 0),
			ival(l.MinYrsSecondary, 0), ival(l.MinYrsDiploma, 0), ival(l.MinYrsBachelor, 0),
			ival(l.MinYrsMaster, 0), ival(l.MinYrsPhd, 0), l.Competencies)
		if err != nil {
			return "", err
		}
	}
	return id, tx.Commit(ctx)
}

// GradeByID returns one grade with levels.
func (s *Store) GradeByID(ctx context.Context, id string) (*domain.Grade, error) {
	all, err := s.ListGrades(ctx)
	if err != nil {
		return nil, err
	}
	for i := range all {
		if all[i].ID == id {
			return &all[i], nil
		}
	}
	return nil, pgx.ErrNoRows
}
