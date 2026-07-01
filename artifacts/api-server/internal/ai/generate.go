package ai

import (
	"context"
	"fmt"
	"strings"
)

const systemPrompt = "أنت مساعد يُخرج JSON صالحًا فقط دون أي نص إضافي أو علامات Markdown أو شرح."

// CompetencyTypes / Levels / CareerStages mirror the domain enums for prompts.
var (
	competencyTypes  = []string{"LEADERSHIP", "TECHNICAL", "BEHAVIORAL", "JOB", "MANAGERIAL"}
	competencyLevels = []string{"BASIC", "INTERMEDIATE", "ADVANCED", "EXPERT"}
	careerStages     = []string{"ENTRY", "MID", "SENIOR", "LEAD", "EXEC"}
)

// AiCompetency is one generated competency.
type AiCompetency struct {
	Name        string `json:"name"`
	Type        string `json:"type"`
	Level       string `json:"level"`
	Description string `json:"description"`
	Indicators  string `json:"indicators"`
}

// AiCompetencyResult is the competency generation payload.
type AiCompetencyResult struct {
	Competencies []AiCompetency `json:"competencies"`
}

// AiKpi is one generated KPI.
type AiKpi struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Measure     string `json:"measure"`
	Target      string `json:"target"`
	Frequency   string `json:"frequency"`
	Weight      string `json:"weight"`
}

// AiKpiGroup buckets generated KPIs by competency.
type AiKpiGroup struct {
	CompetencyName string  `json:"competencyName"`
	CompType       string  `json:"compType"`
	Kpis           []AiKpi `json:"kpis"`
}

// AiKpiResult is the KPI generation payload.
type AiKpiResult struct {
	Summary string       `json:"summary"`
	Groups  []AiKpiGroup `json:"groups"`
}

// AiCareerStage is one generated career stage.
type AiCareerStage struct {
	Title                string   `json:"title"`
	Level                string   `json:"level"`
	GradeNum             string   `json:"gradeNum"`
	DurationInRole       string   `json:"durationInRole"`
	Description          string   `json:"description"`
	RequiredCompetencies []string `json:"requiredCompetencies"`
	PromotionCriteria    []string `json:"promotionCriteria"`
}

// AiCareerPath is the career-path generation payload.
type AiCareerPath struct {
	Name        string          `json:"name"`
	Field       string          `json:"field"`
	Duration    string          `json:"duration"`
	Description string          `json:"description"`
	Stages      []AiCareerStage `json:"stages"`
}

// GenerateCompetencies suggests competencies for a job.
func (c *Client) GenerateCompetencies(ctx context.Context, jobName string, description *string) (*AiCompetencyResult, error) {
	desc := "غير متوفر"
	if description != nil && strings.TrimSpace(*description) != "" {
		desc = strings.TrimSpace(*description)
	}
	prompt := fmt.Sprintf(`أنت خبير موارد بشرية متخصص في تصميم الجدارات الوظيفية.
الوظيفة: %s
الوصف الوظيفي: %s

اقترح من 5 إلى 8 جدارات مناسبة لهذه الوظيفة. لكل جدارة:
- name: اسم الجدارة بالعربية
- type: واحدة فقط من: %s
- level: واحدة فقط من: %s
- description: وصف موجز
- indicators: مؤشرات مفصولة بعلامة |
أعد JSON فقط بالشكل: {"competencies":[{"name":"...","type":"...","level":"...","description":"...","indicators":"..."}]}`,
		jobName, desc, strings.Join(competencyTypes, " | "), strings.Join(competencyLevels, " | "))

	raw, err := c.completeJSON(ctx, systemPrompt, prompt)
	if err != nil {
		return nil, err
	}
	var out AiCompetencyResult
	if err := decodeInto(raw, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// GenerateKpis suggests KPIs for a job and its competencies.
func (c *Client) GenerateKpis(ctx context.Context, jobName string, competencies []string) (*AiKpiResult, error) {
	compList := "- (لا توجد جدارات محددة، اقترح مؤشرات عامة مناسبة للوظيفة)"
	if len(competencies) > 0 {
		lines := make([]string, len(competencies))
		for i, comp := range competencies {
			lines[i] = "- " + comp
		}
		compList = strings.Join(lines, "\n")
	}
	prompt := fmt.Sprintf(`أنت خبير موارد بشرية متخصص في مؤشرات الأداء الرئيسية (KPIs).
الوظيفة: %s
الجدارات المطلوبة:
%s

اقترح لكل جدارة من 2 إلى 3 مؤشرات أداء قابلة للقياس. لكل مؤشر حدّد: الاسم، وصف موجز، طريقة القياس، المستهدف، تكرار القياس، والوزن كنسبة مئوية. اجعل مجموع أوزان كل المؤشرات يساوي 100%% تقريباً.
أعد JSON فقط بالشكل: {"summary":"...","groups":[{"competencyName":"...","compType":"...","kpis":[{"name":"...","description":"...","measure":"...","target":"...","frequency":"...","weight":"..."}]}]}`,
		jobName, compList)

	raw, err := c.completeJSON(ctx, systemPrompt, prompt)
	if err != nil {
		return nil, err
	}
	var out AiKpiResult
	if err := decodeInto(raw, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// GenerateCareerPath designs a career path for a field.
func (c *Client) GenerateCareerPath(ctx context.Context, field string) (*AiCareerPath, error) {
	prompt := fmt.Sprintf(`أنت خبير في تطوير المسارات المهنية والتعاقب الوظيفي.
المجال/التخصص: %s

صمّم مساراً وظيفياً من 5 إلى 7 مراحل من المستوى المبتدئ حتى القيادة. لكل مرحلة:
- title: المسمى الوظيفي
- level: واحدة فقط من: %s
- gradeNum: رقم الدرجة المقترح (نص)
- durationInRole: المدة المتوقعة
- description: وصف موجز
- requiredCompetencies: مصفوفة نصية بالجدارات المطلوبة
- promotionCriteria: مصفوفة نصية بمعايير الترقية
أعد JSON فقط بالشكل: {"name":"...","field":"...","duration":"...","description":"...","stages":[{"title":"...","level":"...","gradeNum":"...","durationInRole":"...","description":"...","requiredCompetencies":["..."],"promotionCriteria":["..."]}]}`,
		field, strings.Join(careerStages, " | "))

	raw, err := c.completeJSON(ctx, systemPrompt, prompt)
	if err != nil {
		return nil, err
	}
	var out AiCareerPath
	if err := decodeInto(raw, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// GenerateJobDescription writes a job description in Arabic.
func (c *Client) GenerateJobDescription(ctx context.Context, jobName string, competencies []string, department, grade *string) (string, error) {
	comps := "غير محددة"
	if len(competencies) > 0 {
		comps = strings.Join(competencies, "، ")
	}
	deptStr := "غير محددة"
	if department != nil && *department != "" {
		deptStr = *department
	}
	gradeStr := "غير محددة"
	if grade != nil && *grade != "" {
		gradeStr = *grade
	}
	prompt := fmt.Sprintf(`أنت خبير موارد بشرية متخصص في توصيف الوظائف.
اكتب وصفاً وظيفياً احترافياً ومختصراً بالعربية للوظيفة التالية:
- المسمى: %s
- الإدارة: %s
- الدرجة: %s
- الجدارات المطلوبة: %s

يتضمن الوصف: الغرض الوظيفي العام في فقرة قصيرة، ثم المسؤوليات الرئيسية في نقاط.
أعد JSON فقط بالشكل: {"description":"..."}`,
		jobName, deptStr, gradeStr, comps)

	raw, err := c.completeJSON(ctx, systemPrompt, prompt)
	if err != nil {
		return "", err
	}
	var out struct {
		Description string `json:"description"`
	}
	if err := decodeInto(raw, &out); err != nil {
		return "", err
	}
	return out.Description, nil
}
