package store

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v4"
)

// FormSharedItem is a shared competency option on the evaluation form.
type FormSharedItem struct {
	Key        string  `json:"key"`
	Name       string  `json:"name"`
	Indicators *string `json:"indicators"`
}

// FormJobCompetency is a job-specific competency on the form.
type FormJobCompetency struct {
	ID         string  `json:"id"`
	Name       string  `json:"name"`
	Indicators *string `json:"indicators"`
}

// FormKpi is a KPI line on the form.
type FormKpi struct {
	Name    string  `json:"name"`
	Measure *string `json:"measure"`
	Target  *string `json:"target"`
}

// FormJob is the minimal job reference.
type FormJob struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// FormEmployee is the employee header on the form.
type FormEmployee struct {
	ID             string   `json:"id"`
	Name           string   `json:"name"`
	EmployeeNumber string   `json:"employeeNumber"`
	Department     *string  `json:"department"`
	Grade          *string  `json:"grade"`
	Job            *FormJob `json:"job"`
}

// EvaluationFormData is everything needed to render a blank evaluation form.
type EvaluationFormData struct {
	Employee        FormEmployee        `json:"employee"`
	Shared          map[string][]FormSharedItem `json:"shared"`
	JobCompetencies []FormJobCompetency `json:"jobCompetencies"`
	Kpis            []FormKpi           `json:"kpis"`
}

// EvaluationFormData assembles the blank-form payload for an employee.
func (s *Store) EvaluationFormData(ctx context.Context, employeeID string) (*EvaluationFormData, error) {
	var (
		emp        FormEmployee
		deptName   *string
		gradeNum   *string
		gradeName  *string
		jobID      *string
		jobName    *string
	)
	row := s.pool.QueryRow(ctx, `
		SELECT e.id, e.name, e."employeeNumber", d.name, g.num, g.name, j.id, j.name
		FROM "Employee" e
		LEFT JOIN "Department" d ON d.id = e."departmentId"
		LEFT JOIN "Grade" g ON g.id = e."gradeId"
		LEFT JOIN "Job" j ON j.id = e."jobId"
		WHERE e.id=$1`, employeeID)
	if err := row.Scan(&emp.ID, &emp.Name, &emp.EmployeeNumber, &deptName, &gradeNum, &gradeName, &jobID, &jobName); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	emp.Department = deptName
	if gradeNum != nil && gradeName != nil {
		g := fmt.Sprintf("درجة %s — %s", *gradeNum, *gradeName)
		emp.Grade = &g
	}
	if jobID != nil && jobName != nil {
		emp.Job = &FormJob{ID: *jobID, Name: *jobName}
	}

	out := &EvaluationFormData{
		Employee:        emp,
		Shared:          map[string][]FormSharedItem{"behavioral": {}, "leadership": {}, "technical": {}},
		JobCompetencies: []FormJobCompetency{},
		Kpis:            []FormKpi{},
	}

	srows, err := s.pool.Query(ctx, `
		SELECT "sharedKey", name, indicators, type FROM "Competency" WHERE "isShared"=true ORDER BY "sharedKey"`)
	if err != nil {
		return nil, err
	}
	defer srows.Close()
	for srows.Next() {
		var key *string
		var name string
		var indicators *string
		var typ string
		if err := srows.Scan(&key, &name, &indicators, &typ); err != nil {
			return nil, err
		}
		item := FormSharedItem{Name: name, Indicators: indicators}
		if key != nil {
			item.Key = *key
		}
		switch typ {
		case "BEHAVIORAL":
			out.Shared["behavioral"] = append(out.Shared["behavioral"], item)
		case "LEADERSHIP":
			out.Shared["leadership"] = append(out.Shared["leadership"], item)
		case "TECHNICAL":
			out.Shared["technical"] = append(out.Shared["technical"], item)
		}
	}
	if err := srows.Err(); err != nil {
		return nil, err
	}

	if jobID != nil {
		jrows, err := s.pool.Query(ctx, `
			SELECT c.id, c.name, c.indicators FROM "Competency" c
			JOIN "JobCompetency" jc ON jc."competencyId" = c.id
			WHERE jc."jobId"=$1 ORDER BY c.name`, *jobID)
		if err != nil {
			return nil, err
		}
		defer jrows.Close()
		for jrows.Next() {
			var jc FormJobCompetency
			if err := jrows.Scan(&jc.ID, &jc.Name, &jc.Indicators); err != nil {
				return nil, err
			}
			out.JobCompetencies = append(out.JobCompetencies, jc)
		}
		if err := jrows.Err(); err != nil {
			return nil, err
		}

		ks, err := s.KpiSetByJob(ctx, *jobID)
		if err != nil {
			return nil, err
		}
		if ks != nil {
			for _, g := range ks.Groups {
				for _, k := range g.Kpis {
					out.Kpis = append(out.Kpis, FormKpi{Name: k.Name, Measure: k.Measure, Target: k.Target})
				}
			}
		}
	}
	return out, nil
}
