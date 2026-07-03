package domain

import "time"

// EvalTemplate is a reusable evaluation form template.
type EvalTemplate struct {
	ID          string              `json:"id"`
	Name        string              `json:"name"`
	Description string              `json:"description"`
	IsDefault   bool                `json:"isDefault"`
	EvalType    string              `json:"evalType"`
	CreatedAt   time.Time           `json:"createdAt"`
	UpdatedAt   time.Time           `json:"updatedAt"`
	Groups      []EvalTemplateGroup `json:"groups,omitempty"`
}

// EvalTemplateGroup is a named group of items within a template.
type EvalTemplateGroup struct {
	ID         string             `json:"id"`
	TemplateID string             `json:"templateId"`
	Name       string             `json:"name"`
	Weight     int                `json:"weight"`
	SortOrder  int                `json:"sortOrder"`
	Items      []EvalTemplateItem `json:"items,omitempty"`
}

// EvalTemplateItem is a single question/criterion inside a group.
type EvalTemplateItem struct {
	ID        string  `json:"id"`
	GroupID   string  `json:"groupId"`
	Label     string  `json:"label"`
	HelpText  *string `json:"helpText"`
	SortOrder int     `json:"sortOrder"`
}
