package domain

import "time"

// User is an application account.
type User struct {
	ID             string     `json:"id"`
	Email          string     `json:"email"`
	Name           string     `json:"name"`
	HashedPassword *string    `json:"-"`
	Role           Role       `json:"role"`
	IsActive       bool       `json:"isActive"`
	EmployeeID     *string    `json:"employeeId"`
	CreatedAt      time.Time  `json:"createdAt"`
	UpdatedAt      time.Time  `json:"updatedAt"`
	EmailVerified  *time.Time `json:"emailVerified,omitempty"`
}

// CurrentUser is the authenticated user payload, including linked employee info.
type CurrentUser struct {
	ID         string           `json:"id"`
	Email      string           `json:"email"`
	Name       string           `json:"name"`
	Role       Role             `json:"role"`
	EmployeeID *string          `json:"employeeId"`
	Employee   *EmployeeSummary `json:"employee"`
}

// EmployeeSummary is a minimal employee view embedded in CurrentUser.
type EmployeeSummary struct {
	ID             string  `json:"id"`
	Name           string  `json:"name"`
	EmployeeNumber string  `json:"employeeNumber"`
	DepartmentID   *string `json:"departmentId"`
	DepartmentName *string `json:"departmentName"`
}

// Department in the org tree.
type Department struct {
	ID       string  `json:"id"`
	Name     string  `json:"name"`
	Level    string  `json:"level"`
	ParentID *string `json:"parentId"`
}

// Competency definition.
type Competency struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Type        string    `json:"type"`
	Level       string    `json:"level"`
	Description *string   `json:"description"`
	Indicators  *string   `json:"indicators"`
	IsShared    bool      `json:"isShared"`
	SharedKey   *string   `json:"sharedKey"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// Grade with nested levels.
type Grade struct {
	ID             string       `json:"id"`
	Num            string       `json:"num"`
	Name           string       `json:"name"`
	Classification *string      `json:"classification"`
	LeaveDays      int          `json:"leaveDays"`
	SalaryMin      *float64     `json:"salaryMin"`
	SalaryMax      *float64     `json:"salaryMax"`
	Housing        *string      `json:"housing"`
	Transport      *string      `json:"transport"`
	Bonus          *string      `json:"bonus"`
	Benefits       *string      `json:"benefits"`
	Levels         []GradeLevel `json:"levels"`
}

// GradeLevel is a step within a Grade.
type GradeLevel struct {
	ID              string  `json:"id"`
	GradeID         string  `json:"gradeId"`
	Level           int     `json:"level"`
	Label           string  `json:"label"`
	MinScore        int     `json:"minScore"`
	StayYears       int     `json:"stayYears"`
	MinYrsSecondary int     `json:"minYrsSecondary"`
	MinYrsDiploma   int     `json:"minYrsDiploma"`
	MinYrsBachelor  int     `json:"minYrsBachelor"`
	MinYrsMaster    int     `json:"minYrsMaster"`
	MinYrsPhd       int     `json:"minYrsPhd"`
	Competencies    *string `json:"competencies"`
}

// Job posting.
type Job struct {
	ID              string    `json:"id"`
	Name            string    `json:"name"`
	Description     *string   `json:"description"`
	ContractType    string    `json:"contractType"`
	ExperienceLevel *string   `json:"experienceLevel"`
	DepartmentID    *string   `json:"departmentId"`
	GradeID         *string   `json:"gradeId"`
	CreatedAt       time.Time `json:"createdAt"`
	UpdatedAt       time.Time `json:"updatedAt"`
	DepartmentName  *string   `json:"departmentName,omitempty"`
	GradeName       *string   `json:"gradeName,omitempty"`
	CompetencyIDs   []string  `json:"competencyIds,omitempty"`
	CompetencyCount int       `json:"competencyCount,omitempty"`
}

// Employee record.
type Employee struct {
	ID             string            `json:"id"`
	EmployeeNumber string            `json:"employeeNumber"`
	Name           string            `json:"name"`
	JobID          *string           `json:"jobId"`
	DepartmentID   *string           `json:"departmentId"`
	GradeID        *string           `json:"gradeId"`
	ManagerID      *string           `json:"managerId"`
	ExtraFields    map[string]string `json:"extraFields"`
	CreatedAt      time.Time         `json:"createdAt"`
	UpdatedAt      time.Time         `json:"updatedAt"`
	JobName        *string           `json:"jobName,omitempty"`
	DepartmentName *string           `json:"departmentName,omitempty"`
	GradeName      *string           `json:"gradeName,omitempty"`
	ManagerName    *string           `json:"managerName,omitempty"`
}

// CareerPath with stages.
type CareerPath struct {
	ID            string            `json:"id"`
	Name          string            `json:"name"`
	Field         *string           `json:"field"`
	Duration      *string           `json:"duration"`
	Description   *string           `json:"description"`
	IsAiGenerated bool              `json:"isAiGenerated"`
	CreatedAt     time.Time         `json:"createdAt"`
	Stages        []CareerPathStage `json:"stages"`
	StageCount    int               `json:"stageCount,omitempty"`
}

// CareerPathStage is one step on a career path.
type CareerPathStage struct {
	ID                   string   `json:"id"`
	CareerPathID         string   `json:"careerPathId"`
	Order                int      `json:"order"`
	Title                string   `json:"title"`
	Level                string   `json:"level"`
	GradeNum             *string  `json:"gradeNum"`
	DurationInRole       *string  `json:"durationInRole"`
	Description          *string  `json:"description"`
	RequiredCompetencies []string `json:"requiredCompetencies"`
	PromotionCriteria    []string `json:"promotionCriteria"`
}

// KpiSet groups KPIs for a job.
type KpiSet struct {
	ID            string     `json:"id"`
	JobID         string     `json:"jobId"`
	Summary       *string    `json:"summary"`
	IsAiGenerated bool       `json:"isAiGenerated"`
	Groups        []KpiGroup `json:"groups"`
}

// KpiGroup buckets KPIs under a competency name.
type KpiGroup struct {
	ID             string  `json:"id"`
	KpiSetID       string  `json:"kpiSetId"`
	CompetencyName string  `json:"competencyName"`
	CompType       *string `json:"compType"`
	Order          int     `json:"order"`
	Kpis           []Kpi   `json:"kpis"`
}

// Kpi is a single key performance indicator.
type Kpi struct {
	ID          string  `json:"id"`
	KpiGroupID  string  `json:"kpiGroupId"`
	Name        string  `json:"name"`
	Description *string `json:"description"`
	Measure     *string `json:"measure"`
	Target      *string `json:"target"`
	Frequency   *string `json:"frequency"`
	Weight      *string `json:"weight"`
	Order       int     `json:"order"`
}

// Evaluation record.
type Evaluation struct {
	ID              string           `json:"id"`
	EmployeeID      string           `json:"employeeId"`
	JobID           *string          `json:"jobId"`
	EvaluatorID     string           `json:"evaluatorId"`
	ApproverID      *string          `json:"approverId"`
	Period          string           `json:"period"`
	Mode            string           `json:"mode"`
	KpiWeight       int              `json:"kpiWeight"`
	CompetencyWeight int             `json:"competencyWeight"`
	KpiScore        *float64         `json:"kpiScore"`
	CompetencyScore *float64         `json:"competencyScore"`
	TotalScore      *int             `json:"totalScore"`
	RatingLabel     *string          `json:"ratingLabel"`
	Status          string           `json:"status"`
	ApprovedAt      *time.Time       `json:"approvedAt"`
	RejectionReason *string          `json:"rejectionReason"`
	EmployeeAck     bool             `json:"employeeAck"`
	ObjectionNote   *string          `json:"objectionNote"`
	TemplateID      *string          `json:"templateId"`
	EvalType        string           `json:"evalType"`
	CreatedAt       time.Time        `json:"createdAt"`
	UpdatedAt       time.Time        `json:"updatedAt"`
	Items           []EvaluationItem `json:"items,omitempty"`
	EmployeeName    *string          `json:"employeeName,omitempty"`
	EvaluatorName   *string          `json:"evaluatorName,omitempty"`
}

// EvaluationItem is a scored line on an evaluation.
type EvaluationItem struct {
	ID           string   `json:"id"`
	EvaluationID string   `json:"evaluationId"`
	Kind         string   `json:"kind"`
	RefKey       string   `json:"refKey"`
	Label        string   `json:"label"`
	Score        *float64 `json:"score"`
	Note         *string  `json:"note"`
}

// BellCurvePolicy distribution policy.
type BellCurvePolicy struct {
	ID           string         `json:"id"`
	Name         string         `json:"name"`
	Distribution map[string]any `json:"distribution"`
	IsActive     bool           `json:"isActive"`
}
