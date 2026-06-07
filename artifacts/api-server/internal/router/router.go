// Package router wires the HTTP routes for the REST API. All routes are served
// under the /api base path to match the reverse-proxy configuration.
package router

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"competency/internal/auth"
	"competency/internal/handlers"
	"competency/internal/rbac"
)

// New builds the chi router.
func New(h *handlers.Handler, mw *auth.Middleware) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)
	r.Use(mw.Resolve)

	r.Route("/api", func(r chi.Router) {
		// Public.
		r.Get("/healthz", h.Healthz)
		r.Get("/health", h.Health)
		r.Post("/auth/login", h.Login)
		r.Post("/auth/logout", h.Logout)
		r.Get("/auth/me", auth.RequireAuth(h.Me))

		// Departments.
		r.Get("/departments", auth.RequireRoles(rbac.GeneralRead, h.ListDepartments))

		// Dashboard.
		r.Get("/dashboard/stats", auth.RequireRoles(rbac.GeneralRead, h.DashboardStats))
		r.Get("/dashboard/analytics", auth.RequireRoles(rbac.GeneralRead, h.DashboardAnalytics))

		// Competencies.
		r.Get("/competencies", auth.RequireRoles(rbac.GeneralRead, h.ListCompetencies))
		r.Get("/competencies/options", auth.RequireRoles(rbac.GeneralRead, h.CompetencyOptions))
		r.Post("/competencies", auth.RequireRoles(rbac.AdminOnly, h.CreateCompetency))
		r.Put("/competencies/{id}", auth.RequireRoles(rbac.AdminOnly, h.UpdateCompetency))
		r.Delete("/competencies/{id}", auth.RequireRoles(rbac.AdminOnly, h.DeleteCompetency))
		r.Post("/competencies/generate", auth.RequireRoles(rbac.AdminOnly, h.GenerateCompetencies))
		r.Post("/competencies/import", auth.RequireRoles(rbac.AdminOnly, h.ImportCompetencies))

		// Grades.
		r.Get("/grades", auth.RequireRoles(rbac.GeneralRead, h.ListGrades))
		r.Post("/grades", auth.RequireRoles(rbac.AdminOnly, h.CreateGrade))
		r.Post("/grades/import", auth.RequireRoles(rbac.AdminOnly, h.ImportGrades))

		// Jobs.
		r.Get("/jobs", auth.RequireRoles(rbac.GeneralRead, h.ListJobs))
		r.Get("/jobs/{id}", auth.RequireRoles(rbac.GeneralRead, h.GetJob))
		r.Get("/jobs/{id}/profile", auth.RequireRoles(rbac.GeneralRead, h.JobProfile))
		r.Post("/jobs", auth.RequireRoles(rbac.AdminOnly, h.CreateJob))
		r.Put("/jobs/{id}", auth.RequireRoles(rbac.AdminOnly, h.UpdateJob))
		r.Post("/jobs/{id}/generate-description", auth.RequireRoles(rbac.AdminOnly, h.GenerateJobDescription))

		// Employees.
		r.Get("/employees", auth.RequireRoles(rbac.HRRead, h.ListEmployees))
		r.Post("/employees", auth.RequireRoles(rbac.AdminOnly, h.CreateEmployee))
		r.Put("/employees/{id}", auth.RequireRoles(rbac.AdminOnly, h.UpdateEmployee))

		// KPIs.
		r.Get("/kpis", auth.RequireRoles(rbac.AdminOnly, h.ListKpis))
		r.Get("/kpis/{jobId}", auth.RequireRoles(rbac.AdminOnly, h.GetKpiSet))
		r.Put("/kpis/{jobId}", auth.RequireRoles(rbac.AdminOnly, h.SaveKpiSet))
		r.Post("/kpis/{jobId}/generate", auth.RequireRoles(rbac.AdminOnly, h.GenerateKpis))

		// Career paths.
		r.Get("/career-paths", auth.RequireRoles(rbac.GeneralRead, h.ListCareerPaths))
		r.Post("/career-paths", auth.RequireRoles(rbac.AdminOnly, h.CreateCareerPath))
		r.Put("/career-paths/{id}", auth.RequireRoles(rbac.AdminOnly, h.UpdateCareerPath))
		r.Post("/career-paths/generate", auth.RequireRoles(rbac.AdminOnly, h.GenerateCareerPath))

		// Evaluations.
		r.Get("/evaluations", auth.RequireAuth(h.ListEvaluations))
		r.Get("/evaluations/form-data", auth.RequireRoles(rbac.Evaluators, h.EvaluationFormData))
		r.Get("/evaluations/department-distribution", auth.RequireRoles(rbac.HRRead, h.DepartmentDistribution))
		r.Get("/evaluations/{id}", auth.RequireAuth(h.GetEvaluation))
		r.Post("/evaluations", auth.RequireRoles(rbac.Evaluators, h.CreateEvaluation))
		r.Put("/evaluations/{id}", auth.RequireRoles(rbac.Evaluators, h.UpdateEvaluation))
		r.Post("/evaluations/{id}/submit", auth.RequireRoles(rbac.Evaluators, h.SubmitEvaluation))
		r.Post("/evaluations/{id}/approve", auth.RequireRoles(rbac.Approvers, h.ApproveEvaluation))
		r.Post("/evaluations/{id}/reject", auth.RequireRoles(rbac.Approvers, h.RejectEvaluation))
		r.Post("/evaluations/{id}/acknowledge", auth.RequireAuth(h.AcknowledgeEvaluation))
		r.Post("/evaluations/{id}/object", auth.RequireAuth(h.ObjectEvaluation))

		// Reports.
		r.Get("/reports/evaluations", auth.RequireRoles(rbac.GeneralRead, h.ReportEvaluations))
		r.Get("/reports/bell-curve", auth.RequireRoles(rbac.GeneralRead, h.ReportBellCurve))
		r.Get("/reports/org-tree", auth.RequireRoles(rbac.HRRead, h.ReportOrgTree))
	})

	return r
}
