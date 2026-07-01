// Package store contains the data-access layer backed by pgx.
package store

import (
	"github.com/jackc/pgx/v4/pgxpool"
	"github.com/lucsky/cuid"
)

// Store wraps the database pool and exposes repository methods.
type Store struct {
	pool *pgxpool.Pool
}

// New constructs a Store.
func New(pool *pgxpool.Pool) *Store { return &Store{pool: pool} }

// Pool exposes the underlying pool for advanced use (transactions).
func (s *Store) Pool() *pgxpool.Pool { return s.pool }

// NewID generates a collision-resistant unique id (cuid), matching the
// original Prisma id strategy.
func NewID() string { return cuid.New() }
