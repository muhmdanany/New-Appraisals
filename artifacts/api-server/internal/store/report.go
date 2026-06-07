package store

import (
        "context"
        "time"

        "competency/internal/bellcurve"
)

// EvaluationStatusLabels maps status codes to Arabic labels (mirrors EVALUATION_STATUS_LABELS).
var EvaluationStatusLabels = map[string]string{
        "DRAFT":        "مسودة",
        "SUBMITTED":    "قيد الاعتماد",
        "APPROVED":     "معتمد",
        "REJECTED":     "مرفوض",
        "ACKNOWLEDGED": "تم الإقرار",
        "OBJECTED":     "معترض عليه",
}

// ReportEvaluationRow is a flat evaluation row for CSV export.
type ReportEvaluationRow struct {
        EmployeeName    string   `json:"employeeName"`
        EmployeeNumber  string   `json:"employeeNumber"`
        Job             string   `json:"job"`
        Period          string   `json:"period"`
        KpiScore        *float64 `json:"kpiScore"`
        CompetencyScore *float64 `json:"competencyScore"`
        TotalScore      *int     `json:"totalScore"`
        Rating          string   `json:"rating"`
        Status          string   `json:"status"`
        Evaluator       string   `json:"evaluator"`
        Approver        string   `json:"approver"`
        Date            string   `json:"date"`
}

// ReportEvaluations returns flattened evaluation rows ordered by recency.
func (s *Store) ReportEvaluations(ctx context.Context) ([]ReportEvaluationRow, error) {
        rows, err := s.pool.Query(ctx, `
                SELECT emp.name, emp."employeeNumber", COALESCE(j.name,''), e.period,
                        e."kpiScore", e."competencyScore", e."totalScore", COALESCE(e."ratingLabel",''),
                        e.status, ev.name, COALESCE(ap.name,''), e."createdAt"
                FROM "Evaluation" e
                JOIN "Employee" emp ON emp.id = e."employeeId"
                LEFT JOIN "Job" j ON j.id = e."jobId"
                JOIN "User" ev ON ev.id = e."evaluatorId"
                LEFT JOIN "User" ap ON ap.id = e."approverId"
                ORDER BY e."createdAt" DESC`)
        if err != nil {
                return nil, err
        }
        defer rows.Close()
        out := []ReportEvaluationRow{}
        for rows.Next() {
                var row ReportEvaluationRow
                var status string
                var createdAt time.Time
                if err := rows.Scan(&row.EmployeeName, &row.EmployeeNumber, &row.Job, &row.Period,
                        &row.KpiScore, &row.CompetencyScore, &row.TotalScore, &row.Rating,
                        &status, &row.Evaluator, &row.Approver, &createdAt); err != nil {
                        return nil, err
                }
                if label, ok := EvaluationStatusLabels[status]; ok {
                        row.Status = label
                } else {
                        row.Status = status
                }
                row.Date = createdAt.Format("2006-01-02")
                out = append(out, row)
        }
        return out, rows.Err()
}

// ReportBellCurveDept is one department's distribution row.
type ReportBellCurveDept struct {
        ID             string  `json:"id"`
        Name           string  `json:"name"`
        Categories     []int   `json:"categories"`
        Achievement    float64 `json:"achievement"`
        EmployeeCount  int     `json:"employeeCount"`
        EvaluatedCount int     `json:"evaluatedCount"`
}

// ReportBellCurve is the bell-curve report payload.
type ReportBellCurve struct {
        PolicyName  *string               `json:"policyName"`
        Policy      bellcurve.PolicySet   `json:"policy"`
        Departments []ReportBellCurveDept `json:"departments"`
}

// ReportBellCurveData computes the per-department bell-curve distribution.
func (s *Store) ReportBellCurveData(ctx context.Context) (*ReportBellCurve, error) {
        var policyName *string
        policy := bellcurve.DefaultPolicy
        prow := s.pool.QueryRow(ctx, `SELECT name, distribution FROM "BellCurvePolicy" WHERE "isActive"=true LIMIT 1`)
        var pname string
        var praw []byte
        if err := prow.Scan(&pname, &praw); err == nil {
                policyName = &pname
                if p, err := s.ActiveBellCurvePolicy(ctx); err == nil && p != nil {
                        policy = *p
                }
        }

        type agg struct {
                name           string
                counts         []int
                achievementSum float64
                n              int
                employeeCount  int
        }
        deptRows, err := s.pool.Query(ctx, `
                SELECT d.id, d.name, (SELECT count(*) FROM "Employee" x WHERE x."departmentId"=d.id)
                FROM "Department" d ORDER BY d.name`)
        if err != nil {
                return nil, err
        }
        order := []string{}
        byID := map[string]*agg{}
        for deptRows.Next() {
                var id, name string
                var cnt int
                if err := deptRows.Scan(&id, &name, &cnt); err != nil {
                        deptRows.Close()
                        return nil, err
                }
                byID[id] = &agg{name: name, counts: []int{0, 0, 0, 0, 0}, employeeCount: cnt}
                order = append(order, id)
        }
        deptRows.Close()
        if err := deptRows.Err(); err != nil {
                return nil, err
        }

        evRows, err := s.pool.Query(ctx, `
                SELECT emp."departmentId", e."totalScore", e."kpiScore"
                FROM "Evaluation" e JOIN "Employee" emp ON emp.id = e."employeeId"
                WHERE e.status IN ('APPROVED','ACKNOWLEDGED','OBJECTED') AND e."totalScore" IS NOT NULL AND emp."departmentId" IS NOT NULL`)
        if err != nil {
                return nil, err
        }
        defer evRows.Close()
        for evRows.Next() {
                var deptID *string
                var total int
                var kpi *float64
                if err := evRows.Scan(&deptID, &total, &kpi); err != nil {
                        return nil, err
                }
                if deptID == nil {
                        continue
                }
                a := byID[*deptID]
                if a == nil {
                        continue
                }
                idx := bellcurve.ScoreToBandIndex(total)
                a.counts[idx]++
                if kpi != nil {
                        a.achievementSum += *kpi / 100
                } else {
                        a.achievementSum += float64(total) / 100
                }
                a.n++
        }
        if err := evRows.Err(); err != nil {
                return nil, err
        }

        departments := []ReportBellCurveDept{}
        for _, id := range order {
                a := byID[id]
                if a == nil || a.n == 0 {
                        continue
                }
                cats := make([]int, 5)
                for i, c := range a.counts {
                        cats[i] = int(float64(c)/float64(a.n)*100 + 0.5)
                }
                departments = append(departments, ReportBellCurveDept{
                        ID:             id,
                        Name:           a.name,
                        Categories:     cats,
                        Achievement:    a.achievementSum / float64(a.n),
                        EmployeeCount:  a.employeeCount,
                        EvaluatedCount: a.n,
                })
        }

        return &ReportBellCurve{PolicyName: policyName, Policy: policy, Departments: departments}, nil
}

// OrgTreeNode is a node in the org chart.
type OrgTreeNode struct {
        ID         string  `json:"id"`
        Name       string  `json:"name"`
        ManagerID  *string `json:"managerId"`
        JobName    *string `json:"jobName"`
        Department *string `json:"department"`
}

// OrgTree returns visible employees for the org chart. When all is true, no
// employee filter is applied; otherwise only ids in the set are returned.
func (s *Store) OrgTree(ctx context.Context, ids []string, all bool) ([]OrgTreeNode, error) {
        q := `
                SELECT e.id, e.name, e."managerId", j.name, d.name
                FROM "Employee" e
                LEFT JOIN "Job" j ON j.id = e."jobId"
                LEFT JOIN "Department" d ON d.id = e."departmentId"`
        args := []any{}
        if !all {
                q += ` WHERE e.id = ANY($1)`
                args = append(args, ids)
        }
        q += ` ORDER BY e.name`
        rows, err := s.pool.Query(ctx, q, args...)
        if err != nil {
                return nil, err
        }
        defer rows.Close()
        out := []OrgTreeNode{}
        for rows.Next() {
                var n OrgTreeNode
                if err := rows.Scan(&n.ID, &n.Name, &n.ManagerID, &n.JobName, &n.Department); err != nil {
                        return nil, err
                }
                out = append(out, n)
        }
        return out, rows.Err()
}

// JobCompetencyNames returns the competency names linked to a job.
func (s *Store) JobCompetencyNames(ctx context.Context, jobID string) ([]string, error) {
        rows, err := s.pool.Query(ctx, `
                SELECT c.name FROM "Competency" c
                JOIN "JobCompetency" jc ON jc."competencyId" = c.id
                WHERE jc."jobId"=$1 ORDER BY c.name`, jobID)
        if err != nil {
                return nil, err
        }
        defer rows.Close()
        out := []string{}
        for rows.Next() {
                var name string
                if err := rows.Scan(&name); err != nil {
                        return nil, err
                }
                out = append(out, name)
        }
        return out, rows.Err()
}
