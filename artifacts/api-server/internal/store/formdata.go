package store

import (
	"context"
	"encoding/json"
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
// If templateID is non-empty, loads questions from the template instead of
// the global shared competencies.
func (s *Store) EvaluationFormData(ctx context.Context, employeeID string, templateID ...string) (*EvaluationFormData, error) {
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

	// Build type-value → Arabic label map from field options settings.
	typeLabelMap := map[string]string{
		"BEHAVIORAL": "سلوكية",
		"LEADERSHIP": "قيادية",
		"TECHNICAL":  "فنية",
	}
	raw, ferr := s.GetSetting(ctx, "field_options")
	if ferr == nil {
		var fo struct {
			CompetencyTypes []struct {
				Value  string `json:"value"`
				Label  string `json:"label"`
				Active bool   `json:"active"`
			} `json:"competencyTypes"`
		}
		if json.Unmarshal(raw, &fo) == nil {
			for _, t := range fo.CompetencyTypes {
				typeLabelMap[t.Value] = t.Label
			}
		}
	}

	out := &EvaluationFormData{
		Employee:        emp,
		Shared:          map[string][]FormSharedItem{},
		JobCompetencies: []FormJobCompetency{},
		Kpis:            []FormKpi{},
	}

	// Determine if we should load from a template instead of global competencies.
	var tplID string
	if len(templateID) > 0 && templateID[0] != "" {
		tplID = templateID[0]
	}

	if tplID != "" {
		// Load items from the evaluation template.
		trows, err := s.pool.Query(ctx, `
			SELECT g.name, i.id, i.label, i.help_text, g.sort_order, i.sort_order
			FROM eval_template_items i
			JOIN eval_template_groups g ON g.id = i.group_id
			WHERE g.template_id=$1
			ORDER BY g.sort_order, i.sort_order`, tplID)
		if err != nil {
			return nil, err
		}
		defer trows.Close()
		for trows.Next() {
			var groupName, itemID, label string
			var helpText *string
			var gSort, iSort int
			if err := trows.Scan(&groupName, &itemID, &label, &helpText, &gSort, &iSort); err != nil {
				return nil, err
			}
			item := FormSharedItem{Key: "tpl_" + itemID, Name: label, Indicators: helpText}
			out.Shared[groupName] = append(out.Shared[groupName], item)
		}
		if err := trows.Err(); err != nil {
			return nil, err
		}
	} else {
		// Default: load from global shared competencies.
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
			label, ok := typeLabelMap[typ]
			if !ok {
				label = typ
			}
			out.Shared[label] = append(out.Shared[label], item)
		}
		if err := srows.Err(); err != nil {
			return nil, err
		}
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
