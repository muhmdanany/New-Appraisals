package store

import "context"

// DashboardStats holds entity counts for the dashboard.
type DashboardStats struct {
	Jobs        int `json:"jobs"`
	Competencies int `json:"competencies"`
	Grades      int `json:"grades"`
	Evaluations int `json:"evaluations"`
	Employees   int `json:"employees"`
	Kpis        int `json:"kpis"`
	CareerPaths int `json:"careerPaths"`
	Departments int `json:"departments"`
}

// DashboardStats returns aggregate counts.
func (s *Store) DashboardStats(ctx context.Context) (*DashboardStats, error) {
	var st DashboardStats
	row := s.pool.QueryRow(ctx, `
		SELECT
			(SELECT count(*) FROM "Job"),
			(SELECT count(*) FROM "Competency"),
			(SELECT count(*) FROM "Grade"),
			(SELECT count(*) FROM "Evaluation"),
			(SELECT count(*) FROM "Employee"),
			(SELECT count(*) FROM "Kpi"),
			(SELECT count(*) FROM "CareerPath"),
			(SELECT count(*) FROM "Department")`)
	if err := row.Scan(&st.Jobs, &st.Competencies, &st.Grades, &st.Evaluations, &st.Employees, &st.Kpis, &st.CareerPaths, &st.Departments); err != nil {
		return nil, err
	}
	return &st, nil
}

// RatingBucket is one band of the rating distribution.
type RatingBucket struct {
	Label string `json:"label"`
	Count int    `json:"count"`
}

// DashboardAnalytics holds finalized-evaluation analytics.
type DashboardAnalytics struct {
	FinalizedCount     int            `json:"finalizedCount"`
	AverageScore       float64        `json:"averageScore"`
	RatingDistribution []RatingBucket `json:"ratingDistribution"`
	ActivePolicyName   *string        `json:"activePolicyName"`
}

var finalizedStatuses = []string{"APPROVED", "ACKNOWLEDGED", "OBJECTED"}

// DashboardAnalytics computes finalized evaluation analytics.
func (s *Store) DashboardAnalytics(ctx context.Context) (*DashboardAnalytics, error) {
	var a DashboardAnalytics
	row := s.pool.QueryRow(ctx, `
		SELECT count(*), COALESCE(avg("totalScore"), 0)
		FROM "Evaluation"
		WHERE status = ANY($1) AND "totalScore" IS NOT NULL`, finalizedStatuses)
	if err := row.Scan(&a.FinalizedCount, &a.AverageScore); err != nil {
		return nil, err
	}

	bands := []struct {
		label    string
		min, max int
	}{
		{"متميز", 91, 100},
		{"يتجاوز التوقعات", 76, 90},
		{"يحقق التوقعات", 61, 75},
		{"يحتاج تحسيناً", 41, 60},
		{"دون المستوى", 0, 40},
	}
	a.RatingDistribution = []RatingBucket{}
	for _, b := range bands {
		var c int
		row := s.pool.QueryRow(ctx, `
			SELECT count(*) FROM "Evaluation"
			WHERE status = ANY($1) AND "totalScore" BETWEEN $2 AND $3`, finalizedStatuses, b.min, b.max)
		if err := row.Scan(&c); err != nil {
			return nil, err
		}
		a.RatingDistribution = append(a.RatingDistribution, RatingBucket{Label: b.label, Count: c})
	}

	var name string
	if err := s.pool.QueryRow(ctx, `SELECT name FROM "BellCurvePolicy" WHERE "isActive" = true LIMIT 1`).Scan(&name); err == nil {
		a.ActivePolicyName = &name
	}
	return &a, nil
}
