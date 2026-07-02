package store

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v4"

	"competency/internal/bellcurve"
	"competency/internal/domain"
	"competency/internal/scoring"
)

// EvalKpiInput is one rated KPI line in a save payload.
type EvalKpiInput struct {
	Name        string  `json:"name"`
	Achievement float64 `json:"achievement"`
	Note        *string `json:"note"`
}

// EvaluationSave is the create/update payload (mirrors evaluationSaveSchema).
type EvaluationSave struct {
	Period       string             `json:"period"`
	Mode         string             `json:"mode"`
	KpiWeight    int                `json:"kpiWeight"`
	SharedScores map[string]float64 `json:"sharedScores"`
	JobScores    map[string]float64 `json:"jobScores"`
	Kpis         []EvalKpiInput     `json:"kpis"`
}

type evalItem struct {
	kind   string
	refKey string
	label  string
	score  float64
	note   *string
}

func valuesWithPrefix(scores map[string]float64, prefix string) []float64 {
	out := []float64{}
	for k, v := range scores {
		if strings.HasPrefix(k, prefix) {
			out = append(out, v)
		}
	}
	return out
}

func mapValues(scores map[string]float64) []float64 {
	out := []float64{}
	for _, v := range scores {
		out = append(out, v)
	}
	return out
}

// buildScoresAndItems computes scores and the flat item list for a save payload.
func (s *Store) buildScoresAndItems(ctx context.Context, in EvaluationSave) (scoring.Result, []evalItem, error) {
	res := scoring.Calculate(scoring.Input{
		Mode:        scoring.Mode(in.Mode),
		KpiWeight:   float64(in.KpiWeight),
		Behavioral:  valuesWithPrefix(in.SharedScores, "b"),
		Leadership:  valuesWithPrefix(in.SharedScores, "l"),
		Technical:   valuesWithPrefix(in.SharedScores, "t"),
		JobSpecific: mapValues(in.JobScores),
		Kpis:        kpiAchievements(in.Kpis),
	})

	useShared := in.Mode != "SPECIFIC"
	useJob := in.Mode != "SHARED"
	items := []evalItem{}

	if useShared && len(in.SharedScores) > 0 {
		names, err := s.competencyNamesBySharedKey(ctx, keysOf(in.SharedScores))
		if err != nil {
			return res, nil, err
		}
		for k, v := range in.SharedScores {
			label := names[k]
			if label == "" {
				label = k
			}
			items = append(items, evalItem{kind: "COMPETENCY", refKey: k, label: label, score: v})
		}
	}
	if useJob && len(in.JobScores) > 0 {
		names, err := s.competencyNamesByID(ctx, keysOf(in.JobScores))
		if err != nil {
			return res, nil, err
		}
		for k, v := range in.JobScores {
			label := names[k]
			if label == "" {
				label = k
			}
			items = append(items, evalItem{kind: "COMPETENCY", refKey: k, label: label, score: v})
		}
	}
	for _, k := range in.Kpis {
		note := k.Note
		items = append(items, evalItem{kind: "KPI", refKey: k.Name, label: k.Name, score: k.Achievement, note: note})
	}
	return res, items, nil
}

func kpiAchievements(kpis []EvalKpiInput) []float64 {
	out := []float64{}
	for _, k := range kpis {
		out = append(out, k.Achievement)
	}
	return out
}

func keysOf(m map[string]float64) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	return out
}

func (s *Store) competencyNamesBySharedKey(ctx context.Context, keys []string) (map[string]string, error) {
	out := map[string]string{}
	if len(keys) == 0 {
		return out, nil
	}
	rows, err := s.pool.Query(ctx, `SELECT "sharedKey", name FROM "Competency" WHERE "sharedKey" = ANY($1)`, keys)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var k *string
		var name string
		if err := rows.Scan(&k, &name); err != nil {
			return nil, err
		}
		if k != nil {
			out[*k] = name
		}
	}
	return out, rows.Err()
}

func (s *Store) competencyNamesByID(ctx context.Context, ids []string) (map[string]string, error) {
	out := map[string]string{}
	if len(ids) == 0 {
		return out, nil
	}
	rows, err := s.pool.Query(ctx, `SELECT id, name FROM "Competency" WHERE id = ANY($1)`, ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var id, name string
		if err := rows.Scan(&id, &name); err != nil {
			return nil, err
		}
		out[id] = name
	}
	return out, rows.Err()
}

func insertItems(ctx context.Context, tx pgx.Tx, evalID string, items []evalItem) error {
	for _, it := range items {
		_, err := tx.Exec(ctx, `
			INSERT INTO "EvaluationItem" (id, "evaluationId", kind, "refKey", label, score, note, objected)
			VALUES ($1,$2,$3,$4,$5,$6,$7,false)`,
			NewID(), evalID, it.kind, it.refKey, it.label, it.score, it.note)
		if err != nil {
			return err
		}
	}
	return nil
}

// CreateEvaluation inserts a DRAFT evaluation with its items.
func (s *Store) CreateEvaluation(ctx context.Context, evaluatorID, employeeID string, jobID *string, in EvaluationSave) (string, error) {
	res, items, err := s.buildScoresAndItems(ctx, in)
	if err != nil {
		return "", err
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)

	id := NewID()
	_, err = tx.Exec(ctx, `
		INSERT INTO "Evaluation" (id, "employeeId", "jobId", "evaluatorId", period, mode,
			"kpiWeight", "competencyWeight", "kpiScore", "competencyScore", "totalScore", "ratingLabel",
			status, "employeeAck", "createdAt", "updatedAt")
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'DRAFT',false, now(), now())`,
		id, employeeID, jobID, evaluatorID, in.Period, in.Mode,
		in.KpiWeight, 100-in.KpiWeight, res.KpiScore, res.CompetencyScore, res.TotalScore, res.RatingLabel)
	if err != nil {
		return "", err
	}
	if err := insertItems(ctx, tx, id, items); err != nil {
		return "", err
	}
	return id, tx.Commit(ctx)
}

// EvalCore holds the fields used for workflow checks.
type EvalCore struct {
	ID          string
	EmployeeID  string
	EvaluatorID string
	Status      string
	TotalScore  *int
	Period      string
	RatingLabel *string
}

// EvaluationCore fetches the workflow-relevant fields.
func (s *Store) EvaluationCore(ctx context.Context, id string) (*EvalCore, error) {
	var c EvalCore
	row := s.pool.QueryRow(ctx, `SELECT id, "employeeId", "evaluatorId", status, "totalScore", period, "ratingLabel" FROM "Evaluation" WHERE id=$1`, id)
	if err := row.Scan(&c.ID, &c.EmployeeID, &c.EvaluatorID, &c.Status, &c.TotalScore, &c.Period, &c.RatingLabel); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &c, nil
}

// UpdateEvaluation replaces items and recomputes scores; resets to DRAFT.
func (s *Store) UpdateEvaluation(ctx context.Context, id string, in EvaluationSave) error {
	res, items, err := s.buildScoresAndItems(ctx, in)
	if err != nil {
		return err
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `DELETE FROM "EvaluationItem" WHERE "evaluationId"=$1`, id); err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `
		UPDATE "Evaluation" SET period=$2, mode=$3, "kpiWeight"=$4, "competencyWeight"=$5,
			"kpiScore"=$6, "competencyScore"=$7, "totalScore"=$8, "ratingLabel"=$9,
			status='DRAFT', "rejectionReason"=NULL, "updatedAt"=now()
		WHERE id=$1`,
		id, in.Period, in.Mode, in.KpiWeight, 100-in.KpiWeight,
		res.KpiScore, res.CompetencyScore, res.TotalScore, res.RatingLabel)
	if err != nil {
		return err
	}
	if err := insertItems(ctx, tx, id, items); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// SetEvaluationStatus updates status and optional approver/reason/approvedAt.
func (s *Store) SubmitEvaluation(ctx context.Context, id string) error {
	_, err := s.pool.Exec(ctx, `UPDATE "Evaluation" SET status='SUBMITTED', "rejectionReason"=NULL, "updatedAt"=now() WHERE id=$1`, id)
	return err
}

// ApproveEvaluation marks an evaluation APPROVED.
func (s *Store) ApproveEvaluation(ctx context.Context, id, approverID string) error {
	now := time.Now()
	_, err := s.pool.Exec(ctx, `UPDATE "Evaluation" SET status='APPROVED', "approverId"=$2, "approvedAt"=$3, "updatedAt"=now() WHERE id=$1`, id, approverID, now)
	return err
}

// RejectEvaluation marks an evaluation REJECTED with a reason.
func (s *Store) RejectEvaluation(ctx context.Context, id, approverID, reason string) error {
	_, err := s.pool.Exec(ctx, `UPDATE "Evaluation" SET status='REJECTED', "approverId"=$2, "rejectionReason"=$3, "updatedAt"=now() WHERE id=$1`, id, approverID, reason)
	return err
}

// AcknowledgeEvaluation marks an evaluation ACKNOWLEDGED.
func (s *Store) AcknowledgeEvaluation(ctx context.Context, id string) error {
	_, err := s.pool.Exec(ctx, `UPDATE "Evaluation" SET status='ACKNOWLEDGED', "employeeAck"=true, "updatedAt"=now() WHERE id=$1`, id)
	return err
}

// ObjectionItem is one objected line.
type ObjectionItem struct {
	ItemID string  `json:"itemId"`
	Note   *string `json:"note"`
}

// ObjectEvaluation records objections on specific items and flips status.
func (s *Store) ObjectEvaluation(ctx context.Context, id string, targets []ObjectionItem) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `UPDATE "EvaluationItem" SET objected=false, "objectionNote"=NULL WHERE "evaluationId"=$1`, id); err != nil {
		return err
	}
	for _, t := range targets {
		if _, err := tx.Exec(ctx, `UPDATE "EvaluationItem" SET objected=true, "objectionNote"=$2 WHERE id=$1 AND "evaluationId"=$3`, t.ItemID, t.Note, id); err != nil {
			return err
		}
	}
	if _, err := tx.Exec(ctx, `UPDATE "Evaluation" SET status='OBJECTED', "updatedAt"=now() WHERE id=$1`, id); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// EvalItemIDs returns the set of valid item ids for an evaluation.
func (s *Store) EvalItemIDs(ctx context.Context, evalID string) (map[string]bool, error) {
	rows, err := s.pool.Query(ctx, `SELECT id FROM "EvaluationItem" WHERE "evaluationId"=$1`, evalID)
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

// EvalListFilter narrows the evaluation list query.
type EvalListFilter struct {
	EvaluatorID       *string
	RestrictEmployees bool
	EmployeeIDs       []string
	Statuses          []string // allowed (IN)
	ExcludeStatuses   []string
	Status            *string
}

// ListEvaluations returns evaluations matching the filter (max 200).
func (s *Store) ListEvaluations(ctx context.Context, f EvalListFilter) ([]domain.Evaluation, error) {
	q := `
		SELECT e.id, e."employeeId", e."jobId", e."evaluatorId", e."approverId", e.period, e.mode,
			e."kpiWeight", e."competencyWeight", e."kpiScore", e."competencyScore", e."totalScore", e."ratingLabel",
			e.status, e."approvedAt", e."rejectionReason", e."employeeAck", e."objectionNote", e."createdAt", e."updatedAt",
			emp.name, u.name
		FROM "Evaluation" e
		LEFT JOIN "Employee" emp ON emp.id = e."employeeId"
		LEFT JOIN "User" u ON u.id = e."evaluatorId"
		WHERE 1=1`
	args := []any{}
	if f.EvaluatorID != nil {
		args = append(args, *f.EvaluatorID)
		q += ` AND e."evaluatorId" = $` + itoa(len(args))
	}
	if f.RestrictEmployees {
		args = append(args, f.EmployeeIDs)
		q += ` AND e."employeeId" = ANY($` + itoa(len(args)) + `)`
	}
	if len(f.Statuses) > 0 {
		args = append(args, f.Statuses)
		q += ` AND e.status = ANY($` + itoa(len(args)) + `)`
	}
	for _, ex := range f.ExcludeStatuses {
		args = append(args, ex)
		q += ` AND e.status <> $` + itoa(len(args))
	}
	if f.Status != nil {
		args = append(args, *f.Status)
		q += ` AND e.status = $` + itoa(len(args))
	}
	q += ` ORDER BY e."createdAt" DESC LIMIT 200`

	rows, err := s.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.Evaluation{}
	for rows.Next() {
		var e domain.Evaluation
		if err := rows.Scan(&e.ID, &e.EmployeeID, &e.JobID, &e.EvaluatorID, &e.ApproverID, &e.Period, &e.Mode,
			&e.KpiWeight, &e.CompetencyWeight, &e.KpiScore, &e.CompetencyScore, &e.TotalScore, &e.RatingLabel,
			&e.Status, &e.ApprovedAt, &e.RejectionReason, &e.EmployeeAck, &e.ObjectionNote, &e.CreatedAt, &e.UpdatedAt,
			&e.EmployeeName, &e.EvaluatorName); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

// EvaluationByID returns a full evaluation with items.
func (s *Store) EvaluationByID(ctx context.Context, id string) (*domain.Evaluation, error) {
	var e domain.Evaluation
	row := s.pool.QueryRow(ctx, `
		SELECT e.id, e."employeeId", e."jobId", e."evaluatorId", e."approverId", e.period, e.mode,
			e."kpiWeight", e."competencyWeight", e."kpiScore", e."competencyScore", e."totalScore", e."ratingLabel",
			e.status, e."approvedAt", e."rejectionReason", e."employeeAck", e."objectionNote", e."createdAt", e."updatedAt",
			emp.name, u.name
		FROM "Evaluation" e
		LEFT JOIN "Employee" emp ON emp.id = e."employeeId"
		LEFT JOIN "User" u ON u.id = e."evaluatorId"
		WHERE e.id = $1`, id)
	if err := row.Scan(&e.ID, &e.EmployeeID, &e.JobID, &e.EvaluatorID, &e.ApproverID, &e.Period, &e.Mode,
		&e.KpiWeight, &e.CompetencyWeight, &e.KpiScore, &e.CompetencyScore, &e.TotalScore, &e.RatingLabel,
		&e.Status, &e.ApprovedAt, &e.RejectionReason, &e.EmployeeAck, &e.ObjectionNote, &e.CreatedAt, &e.UpdatedAt,
		&e.EmployeeName, &e.EvaluatorName); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	rows, err := s.pool.Query(ctx, `
		SELECT id, "evaluationId", kind, "refKey", label, score, note FROM "EvaluationItem" WHERE "evaluationId"=$1 ORDER BY kind, "refKey"`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	e.Items = []domain.EvaluationItem{}
	for rows.Next() {
		var it domain.EvaluationItem
		if err := rows.Scan(&it.ID, &it.EvaluationID, &it.Kind, &it.RefKey, &it.Label, &it.Score, &it.Note); err != nil {
			return nil, err
		}
		e.Items = append(e.Items, it)
	}
	return &e, rows.Err()
}

// DeleteEvaluation removes an evaluation and its items. Only DRAFT evaluations can be deleted.
func (s *Store) DeleteEvaluation(ctx context.Context, id string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	// Only allow deleting drafts
	var status string
	if err := tx.QueryRow(ctx, `SELECT status FROM "Evaluation" WHERE id=$1`, id).Scan(&status); err != nil {
		return err
	}
	if status != "DRAFT" {
		return errors.New("only draft evaluations can be deleted")
	}
	if _, err := tx.Exec(ctx, `DELETE FROM "EvaluationItem" WHERE "evaluationId"=$1`, id); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM "Evaluation" WHERE id=$1`, id); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// DepartmentDistribution is the running rating distribution for an employee's
// department in a period, vs. the active bell-curve policy.
type DepartmentDistribution struct {
	DepartmentName string              `json:"departmentName"`
	EmployeeCount  int                 `json:"employeeCount"`
	Counts         []int               `json:"counts"`
	EvaluatedCount int                 `json:"evaluatedCount"`
	Achievement    float64             `json:"achievement"`
	Policy         bellcurve.PolicySet `json:"policy"`
}

// DepartmentDistribution computes the department distribution for the guardrail.
func (s *Store) DepartmentDistribution(ctx context.Context, employeeID, period string, excludeEvalID *string) (*DepartmentDistribution, error) {
	var deptID *string
	var deptName string
	var empCount int
	row := s.pool.QueryRow(ctx, `
		SELECT e."departmentId", d.name, (SELECT count(*) FROM "Employee" x WHERE x."departmentId" = d.id)
		FROM "Employee" e LEFT JOIN "Department" d ON d.id = e."departmentId" WHERE e.id=$1`, employeeID)
	if err := row.Scan(&deptID, &deptName, &empCount); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if deptID == nil {
		return nil, nil
	}

	q := `
		SELECT e."totalScore", e."kpiScore"
		FROM "Evaluation" e JOIN "Employee" emp ON emp.id = e."employeeId"
		WHERE e.period=$1 AND e.status <> 'REJECTED' AND e."totalScore" IS NOT NULL AND emp."departmentId"=$2`
	args := []any{period, *deptID}
	if excludeEvalID != nil {
		args = append(args, *excludeEvalID)
		q += ` AND e.id <> $3`
	}
	rows, err := s.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	counts := []int{0, 0, 0, 0, 0}
	var achievementSum float64
	n := 0
	for rows.Next() {
		var total int
		var kpi *float64
		if err := rows.Scan(&total, &kpi); err != nil {
			return nil, err
		}
		idx := bellcurve.ScoreToBandIndex(total)
		counts[idx]++
		if kpi != nil {
			achievementSum += *kpi / 100
		} else {
			achievementSum += float64(total) / 100
		}
		n++
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	policy := bellcurve.DefaultPolicy
	if p, err := s.ActiveBellCurvePolicy(ctx); err == nil && p != nil {
		policy = *p
	}
	ach := 0.0
	if n > 0 {
		ach = achievementSum / float64(n)
	}
	return &DepartmentDistribution{
		DepartmentName: deptName,
		EmployeeCount:  empCount,
		Counts:         counts,
		EvaluatedCount: n,
		Achievement:    ach,
		Policy:         policy,
	}, nil
}
