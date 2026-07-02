package store

import (
	"context"
	"time"

	"competency/internal/domain"
)

// EnsureNotificationTable creates the notification_logs table if it doesn't exist.
func (s *Store) EnsureNotificationTable(ctx context.Context) error {
	_, err := s.pool.Exec(ctx, `
CREATE TABLE IF NOT EXISTS "NotificationLog" (
	id          TEXT PRIMARY KEY,
	"recipientId" TEXT NOT NULL,
	recipient   TEXT NOT NULL,
	channel     TEXT NOT NULL,
	type        TEXT NOT NULL,
	subject     TEXT NOT NULL DEFAULT '',
	status      TEXT NOT NULL DEFAULT 'PENDING',
	"errorMessage" TEXT,
	"evalId"    TEXT,
	"createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notiflog_recipient ON "NotificationLog"("recipientId");
CREATE INDEX IF NOT EXISTS idx_notiflog_created   ON "NotificationLog"("createdAt" DESC);
`)
	return err
}

// InsertNotificationLog writes a notification log entry.
func (s *Store) InsertNotificationLog(ctx context.Context, log *domain.NotificationLog) error {
	log.ID = NewID()
	log.CreatedAt = time.Now()
	_, err := s.pool.Exec(ctx, `
INSERT INTO "NotificationLog" (id, "recipientId", recipient, channel, type, subject, status, "errorMessage", "evalId", "createdAt")
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
		log.ID, log.RecipientID, log.Recipient, log.Channel, log.Type, log.Subject, log.Status, log.ErrorMessage, log.EvalID, log.CreatedAt)
	return err
}

// UpdateNotificationStatus updates the status (and optional error) of a log entry.
func (s *Store) UpdateNotificationStatus(ctx context.Context, id string, status domain.NotificationStatus, errMsg *string) error {
	_, err := s.pool.Exec(ctx, `UPDATE "NotificationLog" SET status=$2, "errorMessage"=$3 WHERE id=$1`, id, status, errMsg)
	return err
}

// ListNotificationLogs retrieves recent notification logs (newest first).
func (s *Store) ListNotificationLogs(ctx context.Context, limit, offset int) ([]domain.NotificationLog, int, error) {
	var total int
	err := s.pool.QueryRow(ctx, `SELECT count(*) FROM "NotificationLog"`).Scan(&total)
	if err != nil {
		return nil, 0, err
	}
	rows, err := s.pool.Query(ctx, `
SELECT id, "recipientId", recipient, channel, type, subject, status, "errorMessage", "evalId", "createdAt"
FROM "NotificationLog"
ORDER BY "createdAt" DESC
LIMIT $1 OFFSET $2`, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var logs []domain.NotificationLog
	for rows.Next() {
		var l domain.NotificationLog
		if err := rows.Scan(&l.ID, &l.RecipientID, &l.Recipient, &l.Channel, &l.Type, &l.Subject, &l.Status, &l.ErrorMessage, &l.EvalID, &l.CreatedAt); err != nil {
			return nil, 0, err
		}
		logs = append(logs, l)
	}
	return logs, total, nil
}

// EmployeeEmailByID returns the email of the user linked to an employee.
func (s *Store) EmployeeEmailByID(ctx context.Context, employeeID string) (string, string, error) {
	var email, name string
	err := s.pool.QueryRow(ctx, `
SELECT u.email, u.name FROM "User" u WHERE u."employeeId" = $1 AND u."isActive" = true
`, employeeID).Scan(&email, &name)
	return email, name, err
}

// EmployeePhoneByID returns the phone from the employee's extra_fields.
func (s *Store) EmployeePhoneByID(ctx context.Context, employeeID string) (string, error) {
	var phone *string
	err := s.pool.QueryRow(ctx, `
SELECT "extraFields"->>'phone' FROM "Employee" WHERE id = $1
`, employeeID).Scan(&phone)
	if err != nil || phone == nil {
		return "", err
	}
	return *phone, nil
}

// PendingEvaluationsNearDeadline returns evaluations whose period is about to end.
func (s *Store) PendingEvaluationsNearDeadline(ctx context.Context, withinDays int) ([]domain.Evaluation, error) {
	// Evaluations in DRAFT or SUBMITTED status — we check the period string pattern.
	// Since period is free-form, this is best-effort; we return all non-completed evaluations.
	rows, err := s.pool.Query(ctx, `
SELECT e.id, e."employeeId", e."evaluatorId", e.period, e.status,
       e."totalScore", e."ratingLabel",
       emp.name as "employeeName"
FROM "Evaluation" e
JOIN "Employee" emp ON emp.id = e."employeeId"
WHERE e.status IN ('DRAFT', 'SUBMITTED')
ORDER BY e."createdAt" DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var evals []domain.Evaluation
	for rows.Next() {
		var ev domain.Evaluation
		var empName *string
		if err := rows.Scan(&ev.ID, &ev.EmployeeID, &ev.EvaluatorID, &ev.Period, &ev.Status,
			&ev.TotalScore, &ev.RatingLabel, &empName); err != nil {
			return nil, err
		}
		ev.EmployeeName = empName
		evals = append(evals, ev)
	}
	return evals, nil
}
