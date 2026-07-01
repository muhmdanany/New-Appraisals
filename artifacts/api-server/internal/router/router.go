// Package router wires the HTTP routes for the REST API. All routes are served
// under the /api base path to match the reverse-proxy configuration.
package router

import (
        "net/http"

        "github.com/go-chi/chi/v5"
        "github.com/go-chi/chi/v5/middleware"

        "competency/internal/handlers"
        "competency/internal/identity"
)

// New builds the chi router. The system is password-less: identity is resolved
// from the X-User-Id header (identity.Resolver), and authorization is enforced
// per route. Health checks and the identity picker (/users) are the only routes
// reachable without a selected identity. Administrative catalog mutations
// (jobs, competencies, grades, KPIs, career paths, employees) are gated to
// org-wide roles (ADMIN/HR_MANAGER); evaluation/report handlers enforce their
// own finer-grained scope internally.
func New(h *handlers.Handler) http.Handler {
        r := chi.NewRouter()
        r.Use(middleware.RequestID)
        r.Use(middleware.RealIP)
        r.Use(middleware.Recoverer)

        idmw := &identity.Resolver{Store: h.Store}

        r.Route("/api", func(r chi.Router) {
                r.Use(idmw.Middleware)

                r.Get("/healthz", h.Healthz)
                r.Get("/health", h.Health)

                // Selectable identities — must be reachable before an identity is picked.
                r.Get("/users", h.ListUsers)

                // Everything below requires a selected identity.
                r.Group(func(r chi.Router) {
                        r.Use(h.RequireAuth)

                        // Org-wide only: administrative mutation. Reads stay open to any
                        // authenticated identity.
                        admin := h.RequireOrgWide

                        // Departments.
                        r.Get("/departments", h.ListDepartments)

                        // Dashboard.
                        r.Get("/dashboard/stats", h.DashboardStats)
                        r.Get("/dashboard/analytics", h.DashboardAnalytics)

                        // Competencies.
                        r.Get("/competencies", h.ListCompetencies)
                        r.Get("/competencies/options", h.CompetencyOptions)
                        r.With(admin).Post("/competencies", h.CreateCompetency)
                        r.With(admin).Put("/competencies/{id}", h.UpdateCompetency)
                        r.With(admin).Delete("/competencies/{id}", h.DeleteCompetency)
                        r.With(admin).Post("/competencies/generate", h.GenerateCompetencies)
                        r.With(admin).Post("/competencies/import", h.ImportCompetencies)

                        // Grades.
                        r.Get("/grades", h.ListGrades)
                        r.With(admin).Post("/grades", h.CreateGrade)
                        r.With(admin).Post("/grades/import", h.ImportGrades)

                        // Jobs.
                        r.Get("/jobs", h.ListJobs)
                        r.Get("/jobs/{id}", h.GetJob)
                        r.Get("/jobs/{id}/profile", h.JobProfile)
                        r.With(admin).Post("/jobs", h.CreateJob)
                        r.With(admin).Put("/jobs/{id}", h.UpdateJob)
                        r.With(admin).Post("/jobs/{id}/generate-description", h.GenerateJobDescription)

                        // Employees. (Handlers also self-enforce scope/role.)
                        r.Get("/employees", h.ListEmployees)
                        r.With(admin).Post("/employees", h.CreateEmployee)
                        r.With(admin).Put("/employees/{id}", h.UpdateEmployee)
                        r.With(admin).Post("/employees/import", h.ImportEmployees)

                        // KPIs.
                        r.Get("/kpis", h.ListKpis)
                        r.Get("/kpis/{jobId}", h.GetKpiSet)
                        r.With(admin).Put("/kpis/{jobId}", h.SaveKpiSet)
                        r.With(admin).Post("/kpis/{jobId}/generate", h.GenerateKpis)

                        // Career paths.
                        r.Get("/career-paths", h.ListCareerPaths)
                        r.With(admin).Post("/career-paths", h.CreateCareerPath)
                        r.With(admin).Put("/career-paths/{id}", h.UpdateCareerPath)
                        r.With(admin).Post("/career-paths/generate", h.GenerateCareerPath)

                        // Evaluations. (Handlers self-enforce role + subtree scope.)
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

                        // Reports. (Handlers self-enforce role + scope.)
                        r.Get("/reports/evaluations", h.ReportEvaluations)
                        r.Get("/reports/bell-curve", h.ReportBellCurve)
                        r.Get("/reports/org-tree", h.ReportOrgTree)

                        // Admin panel. (ADMIN/HR_MANAGER only)
                        r.With(admin).Get("/admin/users", h.AdminListUsers)
                        r.With(admin).Post("/users", h.CreateUser)
                        r.With(admin).Put("/users/{id}", h.UpdateUser)
                        r.With(admin).Delete("/users/{id}", h.DeactivateUser)
                        r.With(admin).Post("/admin/import-with-roles", h.AdminImportWithRoles)
                        r.With(admin).Get("/settings/evaluation", h.GetEvaluationSettings)
                        r.With(admin).Put("/settings/evaluation", h.SaveEvaluationSettings)
                })
        })

        return r
}
