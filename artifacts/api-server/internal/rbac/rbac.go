// Package rbac holds role-based access helpers used to scope data by the
// acting user's role. Identity is supplied via the identity package.
package rbac

import "competency/internal/domain"

// Role group sets.
var (
	// AdminOnly — administrative-only actions.
	AdminOnly = []domain.Role{domain.RoleAdmin}
	// GeneralRead — Admin / HR full org data.
	GeneralRead = []domain.Role{domain.RoleAdmin, domain.RoleHRManager}
	// Evaluators — may create/edit evaluations.
	Evaluators = []domain.Role{domain.RoleAdmin, domain.RoleFirstLevel}
	// Approvers — may approve/reject evaluations.
	Approvers = []domain.Role{domain.RoleAdmin, domain.RoleSecondLevel}
)

// In reports whether role r is in the given set.
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
