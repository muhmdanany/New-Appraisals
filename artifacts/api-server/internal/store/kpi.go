package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v4"

	"competency/internal/domain"
)

// JobKpiStatus describes a job's KPI coverage for the KPI list page.
type JobKpiStatus struct {
	JobID        string  `json:"jobId"`
	JobName      string  `json:"jobName"`
	DepartmentName *string `json:"departmentName"`
	HasKpiSet    bool    `json:"hasKpiSet"`
	KpiCount     int     `json:"kpiCount"`
}

// ListJobKpiStatus lists jobs with their KPI coverage status.
func (s *Store) ListJobKpiStatus(ctx context.Context) ([]JobKpiStatus, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT j.id, j.name, d.name,
			(ks.id IS NOT NULL) AS has_set,
			COALESCE((SELECT count(*) FROM "Kpi" k JOIN "KpiGroup" kg ON kg.id = k."kpiGroupId" WHERE kg."kpiSetId" = ks.id), 0)
		FROM "Job" j
		LEFT JOIN "Department" d ON d.id = j."departmentId"
		LEFT JOIN "KpiSet" ks ON ks."jobId" = j.id
		ORDER BY j.name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []JobKpiStatus{}
	for rows.Next() {
		var s JobKpiStatus
		if err := rows.Scan(&s.JobID, &s.JobName, &s.DepartmentName, &s.HasKpiSet, &s.KpiCount); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

// KpiSetByJob returns the KPI set (with groups and kpis) for a job, or nil.
func (s *Store) KpiSetByJob(ctx context.Context, jobID string) (*domain.KpiSet, error) {
	var ks domain.KpiSet
	row := s.pool.QueryRow(ctx, `SELECT id, "jobId", summary, "isAiGenerated" FROM "KpiSet" WHERE "jobId"=$1`, jobID)
	if err := row.Scan(&ks.ID, &ks.JobID, &ks.Summary, &ks.IsAiGenerated); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	ks.Groups = []domain.KpiGroup{}

	grows, err := s.pool.Query(ctx, `
		SELECT id, "kpiSetId", "competencyName", "compType", "order" FROM "KpiGroup" WHERE "kpiSetId"=$1 ORDER BY "order"`, ks.ID)
	if err != nil {
		return nil, err
	}
	defer grows.Close()
	groupIdx := map[string]int{}
	for grows.Next() {
		var g domain.KpiGroup
		if err := grows.Scan(&g.ID, &g.KpiSetID, &g.CompetencyName, &g.CompType, &g.Order); err != nil {
			return nil, err
		}
		g.Kpis = []domain.Kpi{}
		groupIdx[g.ID] = len(ks.Groups)
		ks.Groups = append(ks.Groups, g)
	}
	if err := grows.Err(); err != nil {
		return nil, err
	}

	krows, err := s.pool.Query(ctx, `
		SELECT k.id, k."kpiGroupId", k.name, k.description, k.measure, k.target, k.frequency, k.weight, k."order"
		FROM "Kpi" k JOIN "KpiGroup" kg ON kg.id = k."kpiGroupId"
		WHERE kg."kpiSetId"=$1 ORDER BY k."order"`, ks.ID)
	if err != nil {
		return nil, err
	}
	defer krows.Close()
	for krows.Next() {
		var k domain.Kpi
		if err := krows.Scan(&k.ID, &k.KpiGroupID, &k.Name, &k.Description, &k.Measure, &k.Target, &k.Frequency, &k.Weight, &k.Order); err != nil {
			return nil, err
		}
		if idx, ok := groupIdx[k.KpiGroupID]; ok {
			ks.Groups[idx].Kpis = append(ks.Groups[idx].Kpis, k)
		}
	}
	return &ks, krows.Err()
}

// KpiSetInput is the save payload.
type KpiSetInput struct {
	Summary       *string         `json:"summary"`
	IsAiGenerated bool            `json:"isAiGenerated"`
	Groups        []KpiGroupInput `json:"groups"`
}

// KpiGroupInput is a nested group.
type KpiGroupInput struct {
	CompetencyName string     `json:"competencyName"`
	CompType       *string    `json:"compType"`
	Kpis           []KpiInput `json:"kpis"`
}

// KpiInput is a nested kpi.
type KpiInput struct {
	Name        string  `json:"name"`
	Description *string `json:"description"`
	Measure     *string `json:"measure"`
	Target      *string `json:"target"`
	Frequency   *string `json:"frequency"`
	Weight      *string `json:"weight"`
}

// SaveKpiSet creates or replaces the entire KPI set for a job.
func (s *Store) SaveKpiSet(ctx context.Context, jobID string, in KpiSetInput) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `DELETE FROM "KpiSet" WHERE "jobId"=$1`, jobID); err != nil {
		return err
	}
	setID := NewID()
	if _, err := tx.Exec(ctx, `
		INSERT INTO "KpiSet" (id, "jobId", summary, "isAiGenerated", "createdAt", "updatedAt")
		VALUES ($1,$2,$3,$4, now(), now())`, setID, jobID, in.Summary, in.IsAiGenerated); err != nil {
		return err
	}
	for gi, g := range in.Groups {
		groupID := NewID()
		if _, err := tx.Exec(ctx, `
			INSERT INTO "KpiGroup" (id, "kpiSetId", "competencyName", "compType", "order")
			VALUES ($1,$2,$3,$4,$5)`, groupID, setID, g.CompetencyName, g.CompType, gi); err != nil {
			return err
		}
		for ki, k := range g.Kpis {
			if _, err := tx.Exec(ctx, `
				INSERT INTO "Kpi" (id, "kpiGroupId", name, description, measure, target, frequency, weight, "order")
				VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
				NewID(), groupID, k.Name, k.Description, k.Measure, k.Target, k.Frequency, k.Weight, ki); err != nil {
				return err
			}
		}
	}
	return tx.Commit(ctx)
}
