// Package router wires the HTTP routes for the REST API. All routes are served
// under the /api base path to match the reverse-proxy configuration.
package router

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"competency/internal/handlers"
)

// New builds the chi router. The system is open: there is no authentication or
// role-based access control, so every route is mounted directly.
func New(h *handlers.Handler) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)

	r.Route("/api", func(r chi.Router) {
		r.Get("/healthz", h.Healthz)
		r.Get("/health", h.Health)

		// Departments.
		r.Get("/departments", h.ListDepartments)

		// Dashboard.
		r.Get("/dashboard/stats", h.DashboardStats)
		r.Get("/dashboard/analytics", h.DashboardAnalytics)

		// Competencies.
		r.Get("/competencies", h.ListCompetencies)
		r.Get("/competencies/options", h.CompetencyOptions)
		r.Post("/competencies", h.CreateCompetency)
		r.Put("/competencies/{id}", h.UpdateCompetency)
		r.Delete("/competencies/{id}", h.DeleteCompetency)
		r.Post("/competencies/generate", h.GenerateCompetencies)
		r.Post("/competencies/import", h.ImportCompetencies)

		// Grades.
		r.Get("/grades", h.ListGrades)
		r.Post("/grades", h.CreateGrade)
		r.Post("/grades/import", h.ImportGrades)

		// Jobs.
		r.Get("/jobs", h.ListJobs)
		r.Get("/jobs/{id}", h.GetJob)
		r.Get("/jobs/{id}/profile", h.JobProfile)
		r.Post("/jobs", h.CreateJob)
		r.Put("/jobs/{id}", h.UpdateJob)
		r.Post("/jobs/{id}/generate-description", h.GenerateJobDescription)

		// Employees.
		r.Get("/employees", h.ListEmployees)
		r.Post("/employees", h.CreateEmployee)
		r.Put("/employees/{id}", h.UpdateEmployee)

		// KPIs.
		r.Get("/kpis", h.ListKpis)
		r.Get("/kpis/{jobId}", h.GetKpiSet)
		r.Put("/kpis/{jobId}", h.SaveKpiSet)
		r.Post("/kpis/{jobId}/generate", h.GenerateKpis)

		// Career paths.
		r.Get("/career-paths", h.ListCareerPaths)
		r.Post("/career-paths", h.CreateCareerPath)
		r.Put("/career-paths/{id}", h.UpdateCareerPath)
		r.Post("/career-paths/generate", h.GenerateCareerPath)

		// Evaluations.
		r.Get("/evaluations", h.ListEvaluations)
		r.Get("/evaluations/form-data", h.EvaluationFormData)
		r.Get("/evaluations/department-distribution", h.DepartmentDistribution)
		r.Get("/evaluations/{id}", h.GetEvaluation)
		r.Post("/evaluations", h.CreateEvaluation)
		r.Put("/evaluations/{id}", h.UpdateEvaluation)
		r.Post("/evaluations/{id}/submit", h.SubmitEvaluation)
		r.Post("/evaluations/{id}/approve", h.ApproveEvaluation)
		r.Post("/evaluations/{id}/reject", h.RejectEvaluation)
		r.Post("/evaluations/{id}/acknowledge", h.AcknowledgeEvaluation)
		r.Post("/evaluations/{id}/object", h.ObjectEvaluation)

		// Reports.
		r.Get("/reports/evaluations", h.ReportEvaluations)
		r.Get("/reports/bell-curve", h.ReportBellCurve)
		r.Get("/reports/org-tree", h.ReportOrgTree)
	})

	return r
}
