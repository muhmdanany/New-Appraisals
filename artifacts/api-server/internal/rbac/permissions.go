package rbac

import (
	"context"
	"encoding/json"

	"competency/internal/domain"
)

// Resource represents a screen/module in the system.
type Resource string

const (
	ResDashboard    Resource = "dashboard"
	ResJobs         Resource = "jobs"
	ResCompetencies Resource = "competencies"
	ResGrades       Resource = "grades"
	ResCareerPaths  Resource = "career-paths"
	ResEmployees    Resource = "employees"
	ResKpis         Resource = "kpis"
	ResEvaluations  Resource = "evaluations"
	ResReports      Resource = "reports"
	ResBellCurve    Resource = "bell-curve"
	ResOrgChart     Resource = "org-chart"
	ResAdmin        Resource = "admin"
)

// AllResources is the ordered list of all resources.
var AllResources = []Resource{
	ResDashboard, ResJobs, ResCompetencies, ResGrades, ResCareerPaths,
	ResEmployees, ResKpis, ResEvaluations, ResReports, ResBellCurve,
	ResOrgChart, ResAdmin,
}

// Action represents a CRUD operation.
type Action string

const (
	ActView   Action = "view"
	ActCreate Action = "create"
	ActEdit   Action = "edit"
	ActDelete Action = "delete"
)

var AllActions = []Action{ActView, ActCreate, ActEdit, ActDelete}

// RolePerms maps each resource to its allowed actions.
type RolePerms map[Resource][]Action

// PermissionMatrix maps each role to its resource permissions.
type PermissionMatrix map[domain.Role]RolePerms

// DefaultPermissions returns the hardcoded default permission matrix.
func DefaultPermissions() PermissionMatrix {
	all := []Action{ActView, ActCreate, ActEdit, ActDelete}
	viewOnly := []Action{ActView}

	return PermissionMatrix{
		domain.RoleAdmin: {
			ResDashboard:    all,
			ResJobs:         all,
			ResCompetencies: all,
			ResGrades:       all,
			ResCareerPaths:  all,
			ResEmployees:    all,
			ResKpis:         all,
			ResEvaluations:  all,
			ResReports:      all,
			ResBellCurve:    all,
			ResOrgChart:     all,
			ResAdmin:        all,
		},
		domain.RoleHRManager: {
			ResDashboard:    viewOnly,
			ResJobs:         all,
			ResCompetencies: all,
			ResGrades:       all,
			ResCareerPaths:  all,
			ResEmployees:    all,
			ResKpis:         all,
			ResEvaluations:  {ActView, ActCreate, ActEdit},
			ResReports:      viewOnly,
			ResBellCurve:    viewOnly,
			ResOrgChart:     viewOnly,
			ResAdmin:        {ActView, ActEdit},
		},
		domain.RoleFirstLevel: {
			ResDashboard:   viewOnly,
			ResJobs:        viewOnly,
			ResCompetencies: viewOnly,
			ResEmployees:   viewOnly,
			ResKpis:        viewOnly,
			ResEvaluations: {ActView, ActCreate, ActEdit},
			ResReports:     viewOnly,
			ResOrgChart:    viewOnly,
		},
		domain.RoleSecondLevel: {
			ResDashboard:   viewOnly,
			ResJobs:        viewOnly,
			ResCompetencies: viewOnly,
			ResEmployees:   viewOnly,
			ResEvaluations: {ActView, ActCreate, ActEdit},
			ResReports:     viewOnly,
			ResOrgChart:    viewOnly,
		},
		domain.RoleEmployee: {
			ResDashboard:   viewOnly,
			ResEvaluations: viewOnly,
		},
	}
}

// Can checks whether the given role has permission to perform action on resource.
func Can(m PermissionMatrix, role domain.Role, res Resource, act Action) bool {
	rp, ok := m[role]
	if !ok {
		return false
	}
	actions, ok := rp[res]
	if !ok {
		return false
	}
	for _, a := range actions {
		if a == act {
			return true
		}
	}
	return false
}

// CanView is a shortcut for Can(m, role, res, ActView).
func CanView(m PermissionMatrix, role domain.Role, res Resource) bool {
	return Can(m, role, res, ActView)
}

// SettingsStore is the minimal interface for reading/writing settings.
type SettingsStore interface {
	GetSetting(ctx context.Context, key string) (json.RawMessage, error)
	SaveSetting(ctx context.Context, key string, val json.RawMessage) error
}

const permissionsKey = "role_permissions"

// LoadPermissions loads the permission matrix from the settings store.
// Falls back to DefaultPermissions if nothing is saved.
func LoadPermissions(ctx context.Context, store SettingsStore) PermissionMatrix {
	val, err := store.GetSetting(ctx, permissionsKey)
	if err != nil || val == nil {
		return DefaultPermissions()
	}
	var m PermissionMatrix
	if err := json.Unmarshal(val, &m); err != nil {
		return DefaultPermissions()
	}
	// Ensure ADMIN always has admin access (safety).
	if m[domain.RoleAdmin] == nil {
		m[domain.RoleAdmin] = DefaultPermissions()[domain.RoleAdmin]
	}
	if acts, ok := m[domain.RoleAdmin][ResAdmin]; !ok || !containsAction(acts, ActView) {
		m[domain.RoleAdmin][ResAdmin] = []Action{ActView, ActCreate, ActEdit, ActDelete}
	}
	return m
}

// SavePermissions persists the permission matrix to the settings store.
func SavePermissions(ctx context.Context, store SettingsStore, m PermissionMatrix) error {
	val, err := json.Marshal(m)
	if err != nil {
		return err
	}
	return store.SaveSetting(ctx, permissionsKey, val)
}

func containsAction(actions []Action, a Action) bool {
	for _, x := range actions {
		if x == a {
			return true
		}
	}
	return false
}
