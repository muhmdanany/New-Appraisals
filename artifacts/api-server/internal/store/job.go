package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v4"

	"competency/internal/domain"
)

// ListJobs returns jobs with department/grade names and competency counts.
func (s *Store) ListJobs(ctx context.Context, search string, take, skip int) ([]domain.Job, error) {
	q := `
		SELECT j.id, j.name, j.description, j."contractType", j."experienceLevel",
			j."departmentId", j."gradeId", j."createdAt", j."updatedAt",
			d.name, g.name,
			(SELECT count(*) FROM "JobCompetency" jc WHERE jc."jobId" = j.id)
		FROM "Job" j
		LEFT JOIN "Department" d ON d.id = j."departmentId"
		LEFT JOIN "Grade" g ON g.id = j."gradeId"
		WHERE 1=1`
	args := []any{}
	if search != "" {
		args = append(args, "%"+search+"%")
		q += " AND j.name ILIKE $1"
	}
	q += ` ORDER BY j."createdAt" DESC`
	if take > 0 {
		args = append(args, take)
		q += " LIMIT $" + itoa(len(args))
	}
	if skip > 0 {
		args = append(args, skip)
		q += " OFFSET $" + itoa(len(args))
	}

	rows, err := s.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.Job{}
	for rows.Next() {
		var j domain.Job
		if err := rows.Scan(&j.ID, &j.Name, &j.Description, &j.ContractType, &j.ExperienceLevel,
			&j.DepartmentID, &j.GradeID, &j.CreatedAt, &j.UpdatedAt, &j.DepartmentName, &j.GradeName, &j.CompetencyCount); err != nil {
			return nil, err
		}
		out = append(out, j)
	}
	return out, rows.Err()
}

// JobByID returns a job including its linked competency ids.
func (s *Store) JobByID(ctx context.Context, id string) (*domain.Job, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT j.id, j.name, j.description, j."contractType", j."experienceLevel",
			j."departmentId", j."gradeId", j."createdAt", j."updatedAt", d.name, g.name
		FROM "Job" j
		LEFT JOIN "Department" d ON d.id = j."departmentId"
		LEFT JOIN "Grade" g ON g.id = j."gradeId"
		WHERE j.id = $1`, id)
	var j domain.Job
	err := row.Scan(&j.ID, &j.Name, &j.Description, &j.ContractType, &j.ExperienceLevel,
		&j.DepartmentID, &j.GradeID, &j.CreatedAt, &j.UpdatedAt, &j.DepartmentName, &j.GradeName)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	ids, err := s.jobCompetencyIDs(ctx, id)
	if err != nil {
		return nil, err
	}
	j.CompetencyIDs = ids
	j.CompetencyCount = len(ids)
	return &j, nil
}

func (s *Store) jobCompetencyIDs(ctx context.Context, jobID string) ([]string, error) {
	rows, err := s.pool.Query(ctx, `SELECT "competencyId" FROM "JobCompetency" WHERE "jobId"=$1`, jobID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	ids := []string{}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// JobInput is the create/update payload.
type JobInput struct {
	Name            string   `json:"name"`
	Description     *string  `json:"description"`
	ContractType    string   `json:"contractType"`
	ExperienceLevel *string  `json:"experienceLevel"`
	DepartmentID    *string  `json:"departmentId"`
	GradeID         *string  `json:"gradeId"`
	ReportsToJobID  *string  `json:"reportsToJobId"`
	CompetencyIDs   []string `json:"competencyIds"`
}

// CreateJob inserts a job and links competencies.
func (s *Store) CreateJob(ctx context.Context, in JobInput) (string, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)
	id := NewID()
	_, err = tx.Exec(ctx, `
		INSERT INTO "Job" (id, name, description, "contractType", "experienceLevel", "departmentId", "gradeId", "reportsToJobId", "createdAt", "updatedAt")
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now(), now())`,
		id, in.Name, in.Description, in.ContractType, in.ExperienceLevel, in.DepartmentID, in.GradeID, in.ReportsToJobID)
	if err != nil {
		return "", err
	}
	if err := linkJobCompetencies(ctx, tx, id, in.CompetencyIDs); err != nil {
		return "", err
	}
	return id, tx.Commit(ctx)
}

// UpdateJob updates a job, replacing competency links.
func (s *Store) UpdateJob(ctx context.Context, id string, in JobInput) (bool, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer tx.Rollback(ctx)
	ct, err := tx.Exec(ctx, `
		UPDATE "Job" SET name=$2, description=$3, "contractType"=$4, "experienceLevel"=$5,
			"departmentId"=$6, "gradeId"=$7, "reportsToJobId"=$8, "updatedAt"=now()
		WHERE id=$1`,
		id, in.Name, in.Description, in.ContractType, in.ExperienceLevel, in.DepartmentID, in.GradeID, in.ReportsToJobID)
	if err != nil {
		return false, err
	}
	if ct.RowsAffected() == 0 {
		return false, nil
	}
	if _, err := tx.Exec(ctx, `DELETE FROM "JobCompetency" WHERE "jobId"=$1`, id); err != nil {
		return false, err
	}
	if err := linkJobCompetencies(ctx, tx, id, in.CompetencyIDs); err != nil {
		return false, err
	}
	return true, tx.Commit(ctx)
}

func linkJobCompetencies(ctx context.Context, tx pgx.Tx, jobID string, compIDs []string) error {
	for _, cid := range compIDs {
		if cid == "" {
			continue
		}
		_, err := tx.Exec(ctx, `
			INSERT INTO "JobCompetency" (id, "jobId", "competencyId") VALUES ($1,$2,$3)
			ON CONFLICT ("jobId","competencyId") DO NOTHING`, NewID(), jobID, cid)
		if err != nil {
			return err
		}
	}
	return nil
}

// UpdateJobDescription sets only the description field.
func (s *Store) UpdateJobDescription(ctx context.Context, id, desc string) error {
	_, err := s.pool.Exec(ctx, `UPDATE "Job" SET description=$2, "updatedAt"=now() WHERE id=$1`, id, desc)
	return err
}

// JobProfile returns a full job profile with competencies and KPI set for PDF export.
type JobProfile struct {
	Job          domain.Job          `json:"job"`
	Competencies []domain.Competency `json:"competencies"`
	KpiSet       *domain.KpiSet      `json:"kpiSet"`
}

// JobProfile assembles the full profile for a job.
func (s *Store) JobProfile(ctx context.Context, id string) (*JobProfile, error) {
	job, err := s.JobByID(ctx, id)
	if err != nil || job == nil {
		return nil, err
	}
	comps := []domain.Competency{}
	rows, err := s.pool.Query(ctx, `
		SELECT c.id, c.name, c.type, c.level, c.description, c.indicators, c."isShared", c."sharedKey", c."createdAt", c."updatedAt"
		FROM "Competency" c JOIN "JobCompetency" jc ON jc."competencyId" = c.id
		WHERE jc."jobId" = $1 ORDER BY c.name`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var c domain.Competency
		if err := rows.Scan(&c.ID, &c.Name, &c.Type, &c.Level, &c.Description, &c.Indicators, &c.IsShared, &c.SharedKey, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		comps = append(comps, c)
	}
	kpiSet, err := s.KpiSetByJob(ctx, id)
	if err != nil {
		return nil, err
	}
	return &JobProfile{Job: *job, Competencies: comps, KpiSet: kpiSet}, nil
}

// UpsertJobByName creates or updates a job keyed by name (used by import).
func (s *Store) UpsertJobByName(ctx context.Context, in JobInput) (string, error) {
	var id string
	err := s.pool.QueryRow(ctx, `SELECT id FROM "Job" WHERE name=$1 LIMIT 1`, in.Name).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return s.CreateJob(ctx, in)
	}
	if err != nil {
		return "", err
	}
	if _, err := s.UpdateJob(ctx, id, in); err != nil {
		return "", err
	}
	return id, nil
}
