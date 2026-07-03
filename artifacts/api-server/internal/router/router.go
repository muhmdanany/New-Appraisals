package router

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"competency/internal/handlers"
	"competency/internal/identity"
	"competency/internal/rbac"
)

func New(h *handlers.Handler) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)

	idmw := &identity.Resolver{Store: h.Store}

	// Shorthand permission middleware builders.
	perm := func(res rbac.Resource, act rbac.Action) func(http.Handler) http.Handler {
		return h.Require(res, act)
	}

	r.Route("/api", func(r chi.Router) {
		r.Use(idmw.Middleware)

		r.Get("/healthz", h.Healthz)
		r.Get("/health", h.Health)
		r.Get("/users", h.ListUsers)

		r.Group(func(r chi.Router) {
			r.Use(h.RequireAuth)

			// Departments.
			r.Get("/departments", h.ListDepartments)

			// Dashboard.
			r.Get("/dashboard/stats", h.DashboardStats)
			r.Get("/dashboard/analytics", h.DashboardAnalytics)

			// Competencies.
			r.Get("/competencies", h.ListCompetencies)
			r.Get("/competencies/options", h.CompetencyOptions)
			r.With(perm(rbac.ResCompetencies, rbac.ActCreate)).Post("/competencies", h.CreateCompetency)
			r.With(perm(rbac.ResCompetencies, rbac.ActEdit)).Put("/competencies/{id}", h.UpdateCompetency)
			r.With(perm(rbac.ResCompetencies, rbac.ActDelete)).Delete("/competencies/{id}", h.DeleteCompetency)
			r.With(perm(rbac.ResCompetencies, rbac.ActCreate)).Post("/competencies/generate", h.GenerateCompetencies)
			r.With(perm(rbac.ResCompetencies, rbac.ActCreate)).Post("/competencies/import", h.ImportCompetencies)

			// Grades.
			r.Get("/grades", h.ListGrades)
			r.With(perm(rbac.ResGrades, rbac.ActCreate)).Post("/grades", h.CreateGrade)
			r.With(perm(rbac.ResGrades, rbac.ActEdit)).Put("/grades/{id}", h.UpdateGrade)
			r.With(perm(rbac.ResGrades, rbac.ActDelete)).Delete("/grades/{id}", h.DeleteGrade)
			r.With(perm(rbac.ResGrades, rbac.ActCreate)).Post("/grades/import", h.ImportGrades)

			// Jobs.
			r.Get("/jobs", h.ListJobs)
			r.Get("/jobs/{id}", h.GetJob)
			r.Get("/jobs/{id}/profile", h.JobProfile)
			r.With(perm(rbac.ResJobs, rbac.ActCreate)).Post("/jobs", h.CreateJob)
			r.With(perm(rbac.ResJobs, rbac.ActEdit)).Put("/jobs/{id}", h.UpdateJob)
			r.With(perm(rbac.ResJobs, rbac.ActDelete)).Delete("/jobs/{id}", h.DeleteJob)
			r.With(perm(rbac.ResJobs, rbac.ActEdit)).Post("/jobs/{id}/generate-description", h.GenerateJobDescription)

			// Employees.
			r.Get("/employees", h.ListEmployees)
			r.With(perm(rbac.ResEmployees, rbac.ActCreate)).Post("/employees", h.CreateEmployee)
			r.With(perm(rbac.ResEmployees, rbac.ActEdit)).Put("/employees/{id}", h.UpdateEmployee)
			r.With(perm(rbac.ResEmployees, rbac.ActDelete)).Delete("/employees/{id}", h.DeleteEmployee)
			r.With(perm(rbac.ResEmployees, rbac.ActCreate)).Post("/employees/import", h.ImportEmployees)

			// KPIs.
			r.Get("/kpis", h.ListKpis)
			r.Get("/kpis/{jobId}", h.GetKpiSet)
			r.With(perm(rbac.ResKpis, rbac.ActEdit)).Put("/kpis/{jobId}", h.SaveKpiSet)
			r.With(perm(rbac.ResKpis, rbac.ActCreate)).Post("/kpis/{jobId}/generate", h.GenerateKpis)

			// Career paths.
			r.Get("/career-paths", h.ListCareerPaths)
			r.With(perm(rbac.ResCareerPaths, rbac.ActCreate)).Post("/career-paths", h.CreateCareerPath)
			r.With(perm(rbac.ResCareerPaths, rbac.ActEdit)).Put("/career-paths/{id}", h.UpdateCareerPath)
			r.With(perm(rbac.ResCareerPaths, rbac.ActDelete)).Delete("/career-paths/{id}", h.DeleteCareerPath)
			r.With(perm(rbac.ResCareerPaths, rbac.ActCreate)).Post("/career-paths/generate", h.GenerateCareerPath)

			// Evaluations.
			r.Get("/evaluations", h.ListEvaluations)
			r.Get("/evaluations/form-data", h.EvaluationFormData)
			r.Get("/evaluations/department-distribution", h.DepartmentDistribution)
			r.Get("/evaluations/{id}", h.GetEvaluation)
			r.With(perm(rbac.ResEvaluations, rbac.ActCreate)).Post("/evaluations", h.CreateEvaluation)
			r.With(perm(rbac.ResEvaluations, rbac.ActEdit)).Put("/evaluations/{id}", h.UpdateEvaluation)
			r.With(perm(rbac.ResEvaluations, rbac.ActDelete)).Delete("/evaluations/{id}", h.DeleteEvaluation)
			r.With(perm(rbac.ResEvaluations, rbac.ActEdit)).Post("/evaluations/{id}/submit", h.SubmitEvaluation)
			r.With(perm(rbac.ResEvaluations, rbac.ActEdit)).Post("/evaluations/{id}/approve", h.ApproveEvaluation)
			r.With(perm(rbac.ResEvaluations, rbac.ActEdit)).Post("/evaluations/{id}/reject", h.RejectEvaluation)
			r.Post("/evaluations/{id}/acknowledge", h.AcknowledgeEvaluation)
			r.Post("/evaluations/{id}/object", h.ObjectEvaluation)

			// Reports.
			r.Get("/reports/evaluations", h.ReportEvaluations)
			r.Get("/reports/bell-curve", h.ReportBellCurve)
			r.Get("/reports/org-tree", h.ReportOrgTree)

			// Admin panel.
			r.With(perm(rbac.ResAdmin, rbac.ActView)).Get("/admin/users", h.AdminListUsers)
			r.With(perm(rbac.ResAdmin, rbac.ActCreate)).Post("/users", h.CreateUser)
			r.With(perm(rbac.ResAdmin, rbac.ActEdit)).Put("/users/{id}", h.UpdateUser)
			r.With(perm(rbac.ResAdmin, rbac.ActDelete)).Delete("/users/{id}", h.DeleteUser)
			r.With(perm(rbac.ResAdmin, rbac.ActCreate)).Post("/admin/import-with-roles", h.AdminImportWithRoles)

			// Office 365 integration.
			r.With(perm(rbac.ResAdmin, rbac.ActView)).Get("/admin/office365/config", h.GetOffice365Config)
			r.With(perm(rbac.ResAdmin, rbac.ActEdit)).Put("/admin/office365/config", h.SaveOffice365Config)
			r.With(perm(rbac.ResAdmin, rbac.ActCreate)).Post("/admin/office365/fetch-users", h.FetchOffice365Users)

			// Settings (permissions + evaluation + field options).
			r.With(perm(rbac.ResAdmin, rbac.ActView)).Get("/settings/evaluation", h.GetEvaluationSettings)
			r.With(perm(rbac.ResAdmin, rbac.ActEdit)).Put("/settings/evaluation", h.SaveEvaluationSettings)
			r.Get("/settings/field-options", h.GetFieldOptions)
			r.With(perm(rbac.ResAdmin, rbac.ActEdit)).Put("/settings/field-options", h.SaveFieldOptions)
			r.Get("/settings/permissions", h.GetPermissions)
			r.With(perm(rbac.ResAdmin, rbac.ActEdit)).Put("/settings/permissions", h.SavePermissions)
			r.Get("/settings/hidden-roles", h.GetHiddenRoles)
			r.With(perm(rbac.ResAdmin, rbac.ActEdit)).Put("/settings/hidden-roles", h.SaveHiddenRoles)

			// Notifications.
			r.With(perm(rbac.ResAdmin, rbac.ActView)).Get("/admin/notification/config", h.GetNotificationConfig)
			r.With(perm(rbac.ResAdmin, rbac.ActEdit)).Put("/admin/notification/config", h.SaveNotificationConfig)
			r.With(perm(rbac.ResAdmin, rbac.ActEdit)).Post("/admin/notification/test", h.TestNotification)
			r.With(perm(rbac.ResAdmin, rbac.ActEdit)).Post("/notifications/send", h.SendNotification)
			r.With(perm(rbac.ResAdmin, rbac.ActView)).Get("/notifications/logs", h.NotificationLogs)

			// Evaluation templates.
			r.With(perm(rbac.ResAdmin, rbac.ActView)).Get("/admin/templates", h.ListTemplates)
			r.With(perm(rbac.ResAdmin, rbac.ActView)).Get("/admin/templates/{id}", h.GetTemplate)
			r.With(perm(rbac.ResAdmin, rbac.ActCreate)).Post("/admin/templates", h.CreateTemplate)
			r.With(perm(rbac.ResAdmin, rbac.ActEdit)).Put("/admin/templates/{id}", h.UpdateTemplate)
			r.With(perm(rbac.ResAdmin, rbac.ActDelete)).Delete("/admin/templates/{id}", h.DeleteTemplate)
			r.With(perm(rbac.ResAdmin, rbac.ActCreate)).Post("/admin/templates/{id}/duplicate", h.DuplicateTemplate)
		})
	})

	return r
}
