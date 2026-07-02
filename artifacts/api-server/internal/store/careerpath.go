package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v4"

	"competency/internal/domain"
)

// ListCareerPaths returns paths with stage counts.
func (s *Store) ListCareerPaths(ctx context.Context) ([]domain.CareerPath, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT cp.id, cp.name, cp.field, cp.duration, cp.description, cp."isAiGenerated", cp."createdAt",
			(SELECT count(*) FROM "CareerPathStage" st WHERE st."careerPathId" = cp.id)
		FROM "CareerPath" cp ORDER BY cp."createdAt" DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.CareerPath{}
	for rows.Next() {
		var c domain.CareerPath
		c.Stages = []domain.CareerPathStage{}
		if err := rows.Scan(&c.ID, &c.Name, &c.Field, &c.Duration, &c.Description, &c.IsAiGenerated, &c.CreatedAt, &c.StageCount); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	for i := range out {
		stages, err := s.careerPathStages(ctx, out[i].ID)
		if err != nil {
			return nil, err
		}
		out[i].Stages = stages
	}
	return out, nil
}

func (s *Store) careerPathStages(ctx context.Context, pathID string) ([]domain.CareerPathStage, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, "careerPathId", "order", title, level, "gradeNum", "durationInRole", description, "requiredCompetencies", "promotionCriteria"
		FROM "CareerPathStage" WHERE "careerPathId"=$1 ORDER BY "order"`, pathID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.CareerPathStage{}
	for rows.Next() {
		var st domain.CareerPathStage
		if err := rows.Scan(&st.ID, &st.CareerPathID, &st.Order, &st.Title, &st.Level, &st.GradeNum, &st.DurationInRole, &st.Description, &st.RequiredCompetencies, &st.PromotionCriteria); err != nil {
			return nil, err
		}
		out = append(out, st)
	}
	return out, rows.Err()
}

// CareerPathByID returns one path with stages.
func (s *Store) CareerPathByID(ctx context.Context, id string) (*domain.CareerPath, error) {
	var c domain.CareerPath
	row := s.pool.QueryRow(ctx, `
		SELECT id, name, field, duration, description, "isAiGenerated", "createdAt" FROM "CareerPath" WHERE id=$1`, id)
	if err := row.Scan(&c.ID, &c.Name, &c.Field, &c.Duration, &c.Description, &c.IsAiGenerated, &c.CreatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	stages, err := s.careerPathStages(ctx, id)
	if err != nil {
		return nil, err
	}
	c.Stages = stages
	c.StageCount = len(stages)
	return &c, nil
}

// CareerPathInput is the create/update payload.
type CareerPathInput struct {
	Name          string             `json:"name"`
	Field         *string            `json:"field"`
	Duration      *string            `json:"duration"`
	Description   *string            `json:"description"`
	IsAiGenerated bool               `json:"isAiGenerated"`
	Stages        []CareerStageInput `json:"stages"`
}

// CareerStageInput is a nested stage.
type CareerStageInput struct {
	Title                string   `json:"title"`
	Level                string   `json:"level"`
	GradeNum             *string  `json:"gradeNum"`
	DurationInRole       *string  `json:"durationInRole"`
	Description          *string  `json:"description"`
	RequiredCompetencies []string `json:"requiredCompetencies"`
	PromotionCriteria    []string `json:"promotionCriteria"`
}

// SaveCareerPath creates or updates a path, replacing its stages.
func (s *Store) SaveCareerPath(ctx context.Context, id string, in CareerPathInput) (string, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)

	if id == "" {
		id = NewID()
		if _, err := tx.Exec(ctx, `
			INSERT INTO "CareerPath" (id, name, field, duration, description, "isAiGenerated", "createdAt", "updatedAt")
			VALUES ($1,$2,$3,$4,$5,$6, now(), now())`,
			id, in.Name, in.Field, in.Duration, in.Description, in.IsAiGenerated); err != nil {
			return "", err
		}
	} else {
		ct, err := tx.Exec(ctx, `
			UPDATE "CareerPath" SET name=$2, field=$3, duration=$4, description=$5, "isAiGenerated"=$6, "updatedAt"=now() WHERE id=$1`,
			id, in.Name, in.Field, in.Duration, in.Description, in.IsAiGenerated)
		if err != nil {
			return "", err
		}
		if ct.RowsAffected() == 0 {
			return "", pgx.ErrNoRows
		}
	}

	if _, err := tx.Exec(ctx, `DELETE FROM "CareerPathStage" WHERE "careerPathId"=$1`, id); err != nil {
		return "", err
	}
	for i, st := range in.Stages {
		level := st.Level
		if !domain.InSet(domain.CareerStages, level) {
			level = "MID"
		}
		_, err := tx.Exec(ctx, `
			INSERT INTO "CareerPathStage" (id, "careerPathId", "order", title, level, "gradeNum", "durationInRole", description, "requiredCompetencies", "promotionCriteria")
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
			NewID(), id, i, st.Title, level, st.GradeNum, st.DurationInRole, st.Description,
			orEmptySlice(st.RequiredCompetencies), orEmptySlice(st.PromotionCriteria))
		if err != nil {
			return "", err
		}
	}
	return id, tx.Commit(ctx)
}

func orEmptySlice(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}

// DeleteCareerPath removes a career path and its stages.
func (s *Store) DeleteCareerPath(ctx context.Context, id string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `DELETE FROM "CareerPathStage" WHERE "careerPathId"=$1`, id); err != nil {
		return err
	}
	ct, err := tx.Exec(ctx, `DELETE FROM "CareerPath" WHERE id=$1`, id)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return tx.Commit(ctx)
}
