package domain

// Role enumerates the system roles (mirrors the Prisma Role enum).
type Role string

const (
	RoleAdmin       Role = "ADMIN"
	RoleHRManager   Role = "HR_MANAGER"
	RoleFirstLevel  Role = "FIRST_LEVEL_MANAGER"
	RoleSecondLevel Role = "SECOND_LEVEL_MANAGER"
	RoleEmployee    Role = "EMPLOYEE"
)

var AllRoles = []Role{RoleAdmin, RoleHRManager, RoleFirstLevel, RoleSecondLevel, RoleEmployee}

func (r Role) Valid() bool {
	for _, x := range AllRoles {
		if x == r {
			return true
		}
	}
	return false
}

// Enum value sets used for validation.
var (
	DepartmentLevels = []string{"SECTOR", "DIVISION", "DEPARTMENT"}
	CompetencyTypes  = []string{"LEADERSHIP", "TECHNICAL", "BEHAVIORAL", "JOB", "MANAGERIAL"}
	CompetencyLevels = []string{"BASIC", "INTERMEDIATE", "ADVANCED", "EXPERT"}
	ContractTypes    = []string{"FULL_TIME", "PART_TIME", "CONTRACT", "TEMPORARY"}
	CareerStages     = []string{"ENTRY", "MID", "SENIOR", "LEAD", "EXEC"}
	EvaluationModes  = []string{"SHARED", "SPECIFIC", "BOTH"}
	EvaluationStatus = []string{"DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "ACKNOWLEDGED", "OBJECTED"}
)

func InSet(set []string, v string) bool {
	for _, x := range set {
		if x == v {
			return true
		}
	}
	return false
}
