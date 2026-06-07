package store

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v4"

	"competency/internal/bellcurve"
)

// ActiveBellCurvePolicy returns the active policy distribution, or nil.
func (s *Store) ActiveBellCurvePolicy(ctx context.Context) (*bellcurve.PolicySet, error) {
	var raw []byte
	err := s.pool.QueryRow(ctx, `SELECT distribution FROM "BellCurvePolicy" WHERE "isActive"=true LIMIT 1`).Scan(&raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var p bellcurve.PolicySet
	if err := json.Unmarshal(raw, &p); err != nil {
		return nil, err
	}
	return &p, nil
}
