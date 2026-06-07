// Package rbac holds role-based access helpers ported from the original
// TypeScript RBAC service and procedure definitions.
package rbac

import "competency/internal/domain"

// Role group sets matching the original tRPC procedure types.
var (
	// AdminOnly — adminProcedure.
	AdminOnly = []domain.Role{domain.RoleAdmin}
	// GeneralRead — generalReadProcedure (Admin / HR full org data).
	GeneralRead = []domain.Role{domain.RoleAdmin, domain.RoleHRManager}
	// HRRead — hrReadProcedure (Admin / HR / both manager levels).
	HRRead = []domain.Role{
		domain.RoleAdmin, domain.RoleHRManager,
		domain.RoleFirstLevel, domain.RoleSecondLevel,
	}
	// Evaluators — may create/edit evaluations.
	Evaluators = []domain.Role{domain.RoleAdmin, domain.RoleFirstLevel}
	// Approvers — may approve/reject evaluations.
	Approvers = []domain.Role{domain.RoleAdmin, domain.RoleSecondLevel}
)

func In(roles []domain.Role, r domain.Role) bool {
	for _, x := range roles {
		if x == r {
			return true
		}
	}
	return false
}

// HasOrgWideAccess reports whether the role sees all employees.
func HasOrgWideAccess(r domain.Role) bool {
	return r == domain.RoleAdmin || r == domain.RoleHRManager
}

// IsReadOnly reports whether the role is read-only for HR data.
func IsReadOnly(r domain.Role) bool {
	return r == domain.RoleHRManager || r == domain.RoleEmployee
}

// DefaultPathForRole returns the landing route for a role.
func DefaultPathForRole(r domain.Role) string {
	if r == domain.RoleAdmin || r == domain.RoleHRManager {
		return "/dashboard"
	}
	return "/evaluations"
}
