// Package bellcurve ports the distribution-policy analysis from the original
// TypeScript service. Pure and dependency-free.
package bellcurve

var CategoryLabels = []string{"غير مرضي", "دون المتوقع", "حسب المتوقع", "فوق المتوقع", "استثنائي"}

// PolicySet holds the three achievement-band distributions.
type PolicySet struct {
        Labels   []string `json:"labels"`
        Above    []int    `json:"above"`
        Achieved []int    `json:"achieved"`
        Below    []int    `json:"below"`
}

// DefaultPolicy is the seeded default (also used as a fallback).
var DefaultPolicy = PolicySet{
        Above:    []int{0, 0, 35, 50, 15},
        Achieved: []int{5, 5, 40, 40, 10},
        Below:    []int{10, 10, 35, 40, 5},
}

// ScoreToBandIndex maps a 0..100 score to a category index (0=worst..4=best).
func ScoreToBandIndex(score int) int {
        switch {
        case score >= 91:
                return 4
        case score >= 76:
                return 3
        case score >= 61:
                return 2
        case score >= 41:
                return 1
        default:
                return 0
        }
}

// AchievementCategory returns which policy column applies for a ratio (1.0=100%).
func AchievementCategory(achievement float64) string {
        switch {
        case achievement > 1.0:
                return "above"
        case achievement >= 0.95:
                return "achieved"
        default:
                return "below"
        }
}

func PolicyForAchievement(achievement float64, p PolicySet) []int {
        switch AchievementCategory(achievement) {
        case "above":
                return append([]int(nil), p.Above...)
        case "achieved":
                return append([]int(nil), p.Achieved...)
        default:
                return append([]int(nil), p.Below...)
        }
}

// ShiftResult is returned by CalculateShiftedPolicy.
type ShiftResult struct {
        Shifted     []int    `json:"shifted"`
        Notes       []string `json:"notes"`
        ShiftArrows []string `json:"shiftArrows"` // "up" | "down" | ""
}

// CalculateShiftedPolicy lets the middle categories borrow unused quota from the
// adjacent better category (tolerance rule from the reference tool).
func CalculateShiftedPolicy(categories, originalPolicy []int) ShiftResult {
        shifted := append([]int(nil), originalPolicy...)
        for len(shifted) < 5 {
                shifted = append(shifted, 0)
        }
        notes := []string{}
        arrows := make([]string, 5)

        at := func(s []int, i int) int {
                if i < len(s) {
                        return s[i]
                }
                return 0
        }

        for i := 2; i < 4; i++ {
                actual := at(categories, i)
                current := shifted[i]
                if actual > current {
                        diff := actual - current
                        next := i + 1
                        if next < 5 {
                                available := shifted[next]
                                take := diff
                                if available < take {
                                        take = available
                                }
                                if take > 0 {
                                        shifted[i] = current + take
                                        shifted[next] = available - take
                                        arrows[i] = "up"
                                        arrows[next] = "down"
                                        notes = append(notes, "فئة \""+CategoryLabels[i]+"\" استلفت من حصة فئة \""+CategoryLabels[next]+"\"")
                                }
                        }
                }
        }
        return ShiftResult{Shifted: shifted, Notes: notes, ShiftArrows: arrows}
}

// ExclusionThreshold: departments with fewer employees are exempt.
const ExclusionThreshold = 10

// IsDeptCompliant reports whether a department's distribution respects policy.
func IsDeptCompliant(categories []int, employeeCount int, achievement float64, p PolicySet) bool {
        if employeeCount < ExclusionThreshold {
                return true
        }
        original := PolicyForAchievement(achievement, p)
        res := CalculateShiftedPolicy(categories, original)
        for i, val := range categories {
                limit := 0
                if i < len(res.Shifted) {
                        limit = res.Shifted[i]
                }
                if val > limit {
                        return false
                }
        }
        return true
}
