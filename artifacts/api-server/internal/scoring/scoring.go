// Package scoring ports the evaluation scoring engine from the original
// TypeScript service. Pure and dependency-free so it can be unit tested.
package scoring

import "math"

// Mode mirrors the EvaluationMode enum.
type Mode string

const (
	ModeShared   Mode = "SHARED"
	ModeSpecific Mode = "SPECIFIC"
	ModeBoth     Mode = "BOTH"
)

// SharedCompetencyKeys are the stable refKeys for the shared competency groups.
var SharedCompetencyKeys = map[string][]string{
	"behavioral": {"b1", "b2", "b3", "b4", "b5"},
	"leadership": {"l1", "l2", "l3", "l4", "l5"},
	"technical":  {"t1", "t2", "t3", "t4"},
}

// RatingBand maps a minimum score to an Arabic rating label.
type RatingBand struct {
	Min   int
	Label string
}

var RatingBands = []RatingBand{
	{91, "متميز"},
	{76, "يتجاوز التوقعات"},
	{61, "يحقق التوقعات"},
	{41, "يحتاج تحسيناً"},
	{0, "دون المستوى"},
}

// RatingLabelFor returns the Arabic rating band label for a score.
func RatingLabelFor(score int) string {
	for _, b := range RatingBands {
		if score >= b.Min {
			return b.Label
		}
	}
	return RatingBands[len(RatingBands)-1].Label
}

// CompetencyTo100 converts a 1..5 rating to a /100 score.
func CompetencyTo100(value float64) int {
	return int(math.Round(((value - 1) / 4) * 100))
}

func mean(values []float64) (float64, bool) {
	if len(values) == 0 {
		return 0, false
	}
	var sum float64
	for _, v := range values {
		sum += v
	}
	return sum / float64(len(values)), true
}

func groupTo100(values []float64) *int {
	avg, ok := mean(values)
	if !ok {
		return nil
	}
	v := CompetencyTo100(avg)
	return &v
}

// Input describes the rated values for a single evaluation.
type Input struct {
	Mode        Mode
	KpiWeight   float64 // 0..100
	Behavioral  []float64
	Leadership  []float64
	Technical   []float64
	JobSpecific []float64
	Kpis        []float64 // 0..100 achievement percentages
}

// GroupScores holds the per-group /100 scores (nil when absent).
type GroupScores struct {
	Behavioral  *int `json:"behavioral"`
	Leadership  *int `json:"leadership"`
	Technical   *int `json:"technical"`
	JobSpecific *int `json:"jobSpecific"`
}

// Result is the computed scoring outcome.
type Result struct {
	KpiScore        *float64    `json:"kpiScore"`
	CompetencyScore *float64    `json:"competencyScore"`
	GroupScores     GroupScores `json:"groupScores"`
	TotalScore      *int        `json:"totalScore"`
	RatingLabel     *string     `json:"ratingLabel"`
}

func clampWeight(w float64) float64 {
	if math.IsNaN(w) {
		return 60
	}
	return math.Min(100, math.Max(0, w))
}

// Calculate computes the full scoring result, matching the original logic:
//   - competency groups: mean of 1..5 ratings -> /100
//   - competencyScore: mean of present groups
//   - kpiScore: mean of kpi achievements
//   - total = kpiScore*w + competencyScore*(1-w), one side -> full weight.
func Calculate(in Input) Result {
	useShared := in.Mode == ModeShared || in.Mode == ModeBoth
	useSpecific := in.Mode == ModeSpecific || in.Mode == ModeBoth

	var behavioral, leadership, technical, jobSpecific *int
	if useShared {
		behavioral = groupTo100(in.Behavioral)
		leadership = groupTo100(in.Leadership)
		technical = groupTo100(in.Technical)
	}
	if useSpecific {
		jobSpecific = groupTo100(in.JobSpecific)
	}

	var present []float64
	for _, g := range []*int{behavioral, leadership, technical, jobSpecific} {
		if g != nil {
			present = append(present, float64(*g))
		}
	}

	var competencyScore *float64
	if len(present) > 0 {
		cs, _ := mean(present)
		competencyScore = &cs
	}

	var kpiScore *float64
	if ks, ok := mean(in.Kpis); ok {
		kpiScore = &ks
	}

	w := clampWeight(in.KpiWeight) / 100
	cw := 1 - w

	var total *float64
	switch {
	case kpiScore != nil && competencyScore != nil:
		t := *kpiScore*w + *competencyScore*cw
		total = &t
	case kpiScore != nil:
		total = kpiScore
	case competencyScore != nil:
		total = competencyScore
	}

	var totalScore *int
	var ratingLabel *string
	if total != nil {
		ts := int(math.Round(*total))
		totalScore = &ts
		rl := RatingLabelFor(ts)
		ratingLabel = &rl
	}

	return Result{
		KpiScore:        kpiScore,
		CompetencyScore: competencyScore,
		GroupScores:     GroupScores{behavioral, leadership, technical, jobSpecific},
		TotalScore:      totalScore,
		RatingLabel:     ratingLabel,
	}
}
