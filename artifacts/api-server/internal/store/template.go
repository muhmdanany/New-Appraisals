package store

import (
	"context"
	"fmt"
	"time"

	"competency/internal/domain"
)

// EnsureEvalTemplateTable creates the eval_templates, eval_template_groups,
// and eval_template_items tables if they don't exist.
func (s *Store) EnsureEvalTemplateTable(ctx context.Context) error {
	_, err := s.pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS eval_templates (
			id          TEXT PRIMARY KEY,
			name        TEXT NOT NULL,
			description TEXT NOT NULL DEFAULT '',
			is_default  BOOLEAN NOT NULL DEFAULT false,
			eval_type   TEXT NOT NULL DEFAULT 'EMPLOYEE',
			created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
			updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
		);
		CREATE TABLE IF NOT EXISTS eval_template_groups (
			id          TEXT PRIMARY KEY,
			template_id TEXT NOT NULL REFERENCES eval_templates(id) ON DELETE CASCADE,
			name        TEXT NOT NULL,
			weight      INT NOT NULL DEFAULT 0,
			sort_order  INT NOT NULL DEFAULT 0
		);
		CREATE TABLE IF NOT EXISTS eval_template_items (
			id         TEXT PRIMARY KEY,
			group_id   TEXT NOT NULL REFERENCES eval_template_groups(id) ON DELETE CASCADE,
			label      TEXT NOT NULL,
			help_text  TEXT,
			sort_order INT NOT NULL DEFAULT 0
		);
	`)
	if err != nil {
		return err
	}
	// Add templateId column to Evaluation table if missing.
	_, _ = s.pool.Exec(ctx, `ALTER TABLE "Evaluation" ADD COLUMN IF NOT EXISTS "templateId" TEXT`)
	// Add eval_type columns if missing.
	_, _ = s.pool.Exec(ctx, `ALTER TABLE eval_templates ADD COLUMN IF NOT EXISTS eval_type TEXT NOT NULL DEFAULT 'EMPLOYEE'`)
	_, _ = s.pool.Exec(ctx, `ALTER TABLE "Evaluation" ADD COLUMN IF NOT EXISTS eval_type TEXT NOT NULL DEFAULT 'EMPLOYEE'`)
	return nil
}

// TemplateSummary is the lightweight list representation.
type TemplateSummary struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	IsDefault   bool      `json:"isDefault"`
	EvalType    string    `json:"evalType"`
	GroupCount  int       `json:"groupCount"`
	ItemCount   int       `json:"itemCount"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// ListTemplates returns all templates with group/item counts.
// If evalType is non-empty, only templates of that type are returned.
func (s *Store) ListTemplates(ctx context.Context, evalType string) ([]TemplateSummary, error) {
	q := `
		SELECT t.id, t.name, t.description, t.is_default, t.eval_type, t.created_at, t.updated_at,
		       (SELECT count(*) FROM eval_template_groups g WHERE g.template_id = t.id),
		       (SELECT count(*) FROM eval_template_items i
		        JOIN eval_template_groups g ON g.id = i.group_id WHERE g.template_id = t.id)
		FROM eval_templates t`
	args := []any{}
	if evalType != "" {
		args = append(args, evalType)
		q += ` WHERE t.eval_type = $1`
	}
	q += ` ORDER BY t.created_at DESC`
	rows, err := s.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []TemplateSummary
	for rows.Next() {
		var r TemplateSummary
		if err := rows.Scan(&r.ID, &r.Name, &r.Description, &r.IsDefault, &r.EvalType,
			&r.CreatedAt, &r.UpdatedAt, &r.GroupCount, &r.ItemCount); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// GetTemplate returns a full template with groups and items.
func (s *Store) GetTemplate(ctx context.Context, id string) (*domain.EvalTemplate, error) {
	var t domain.EvalTemplate
	err := s.pool.QueryRow(ctx, `
		SELECT id, name, description, is_default, eval_type, created_at, updated_at
		FROM eval_templates WHERE id=$1`, id).
		Scan(&t.ID, &t.Name, &t.Description, &t.IsDefault, &t.EvalType, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, err
	}

	grows, err := s.pool.Query(ctx, `
		SELECT id, template_id, name, weight, sort_order
		FROM eval_template_groups WHERE template_id=$1 ORDER BY sort_order`, id)
	if err != nil {
		return nil, err
	}
	defer grows.Close()
	groupIdx := map[string]int{}
	for grows.Next() {
		var g domain.EvalTemplateGroup
		if err := grows.Scan(&g.ID, &g.TemplateID, &g.Name, &g.Weight, &g.SortOrder); err != nil {
			return nil, err
		}
		g.Items = []domain.EvalTemplateItem{}
		groupIdx[g.ID] = len(t.Groups)
		t.Groups = append(t.Groups, g)
	}
	if err := grows.Err(); err != nil {
		return nil, err
	}

	if len(t.Groups) > 0 {
		irows, err := s.pool.Query(ctx, `
			SELECT i.id, i.group_id, i.label, i.help_text, i.sort_order
			FROM eval_template_items i
			JOIN eval_template_groups g ON g.id = i.group_id
			WHERE g.template_id=$1 ORDER BY i.sort_order`, id)
		if err != nil {
			return nil, err
		}
		defer irows.Close()
		for irows.Next() {
			var item domain.EvalTemplateItem
			if err := irows.Scan(&item.ID, &item.GroupID, &item.Label, &item.HelpText, &item.SortOrder); err != nil {
				return nil, err
			}
			if idx, ok := groupIdx[item.GroupID]; ok {
				t.Groups[idx].Items = append(t.Groups[idx].Items, item)
			}
		}
		if err := irows.Err(); err != nil {
			return nil, err
		}
	}

	if t.Groups == nil {
		t.Groups = []domain.EvalTemplateGroup{}
	}
	return &t, nil
}

// TemplateSaveInput is the payload for create/update.
type TemplateSaveInput struct {
	Name        string               `json:"name"`
	Description string               `json:"description"`
	IsDefault   bool                 `json:"isDefault"`
	EvalType    string               `json:"evalType"`
	Groups      []TemplateGroupInput `json:"groups"`
}

// TemplateGroupInput defines a group in the save payload.
type TemplateGroupInput struct {
	Name      string              `json:"name"`
	Weight    int                 `json:"weight"`
	SortOrder int                 `json:"sortOrder"`
	Items     []TemplateItemInput `json:"items"`
}

// TemplateItemInput defines an item in the save payload.
type TemplateItemInput struct {
	Label     string  `json:"label"`
	HelpText  *string `json:"helpText"`
	SortOrder int     `json:"sortOrder"`
}

// CreateTemplate inserts a new template with its groups and items.
func (s *Store) CreateTemplate(ctx context.Context, in TemplateSaveInput) (*domain.EvalTemplate, error) {
	id := NewID()
	now := time.Now()

	evalType := in.EvalType
	if evalType == "" {
		evalType = "EMPLOYEE"
	}

	if in.IsDefault {
		_, _ = s.pool.Exec(ctx, `UPDATE eval_templates SET is_default=false WHERE is_default=true AND eval_type=$1`, evalType)
	}

	_, err := s.pool.Exec(ctx, `
		INSERT INTO eval_templates (id, name, description, is_default, eval_type, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$6)`, id, in.Name, in.Description, in.IsDefault, evalType, now)
	if err != nil {
		return nil, err
	}

	if err := s.insertTemplateGroups(ctx, id, in.Groups); err != nil {
		return nil, err
	}
	return s.GetTemplate(ctx, id)
}

// UpdateTemplate replaces a template's groups/items (delete+reinsert).
func (s *Store) UpdateTemplate(ctx context.Context, id string, in TemplateSaveInput) (*domain.EvalTemplate, error) {
	evalType := in.EvalType
	if evalType == "" {
		evalType = "EMPLOYEE"
	}

	if in.IsDefault {
		_, _ = s.pool.Exec(ctx, `UPDATE eval_templates SET is_default=false WHERE is_default=true AND id<>$1 AND eval_type=$2`, id, evalType)
	}

	_, err := s.pool.Exec(ctx, `
		UPDATE eval_templates SET name=$2, description=$3, is_default=$4, eval_type=$5, updated_at=now()
		WHERE id=$1`, id, in.Name, in.Description, in.IsDefault, evalType)
	if err != nil {
		return nil, err
	}

	// Delete old groups (cascade deletes items).
	_, _ = s.pool.Exec(ctx, `DELETE FROM eval_template_groups WHERE template_id=$1`, id)

	if err := s.insertTemplateGroups(ctx, id, in.Groups); err != nil {
		return nil, err
	}
	return s.GetTemplate(ctx, id)
}

// DeleteTemplate removes a template.
func (s *Store) DeleteTemplate(ctx context.Context, id string) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM eval_templates WHERE id=$1`, id)
	return err
}

// DuplicateTemplate copies a template with a new name.
func (s *Store) DuplicateTemplate(ctx context.Context, id string) (*domain.EvalTemplate, error) {
	src, err := s.GetTemplate(ctx, id)
	if err != nil {
		return nil, err
	}
	groups := make([]TemplateGroupInput, len(src.Groups))
	for i, g := range src.Groups {
		items := make([]TemplateItemInput, len(g.Items))
		for j, it := range g.Items {
			items[j] = TemplateItemInput{Label: it.Label, HelpText: it.HelpText, SortOrder: it.SortOrder}
		}
		groups[i] = TemplateGroupInput{Name: g.Name, Weight: g.Weight, SortOrder: g.SortOrder, Items: items}
	}
	return s.CreateTemplate(ctx, TemplateSaveInput{
		Name:        fmt.Sprintf("%s (نسخة)", src.Name),
		Description: src.Description,
		IsDefault:   false,
		Groups:      groups,
	})
}

func (s *Store) insertTemplateGroups(ctx context.Context, templateID string, groups []TemplateGroupInput) error {
	for _, g := range groups {
		gid := NewID()
		_, err := s.pool.Exec(ctx, `
			INSERT INTO eval_template_groups (id, template_id, name, weight, sort_order)
			VALUES ($1,$2,$3,$4,$5)`, gid, templateID, g.Name, g.Weight, g.SortOrder)
		if err != nil {
			return err
		}
		for _, it := range g.Items {
			iid := NewID()
			_, err := s.pool.Exec(ctx, `
				INSERT INTO eval_template_items (id, group_id, label, help_text, sort_order)
				VALUES ($1,$2,$3,$4,$5)`, iid, gid, it.Label, it.HelpText, it.SortOrder)
			if err != nil {
				return err
			}
		}
	}
	return nil
}
