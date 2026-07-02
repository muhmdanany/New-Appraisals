package notifier

import (
	"context"
	"log/slog"
	"time"

	"competency/internal/domain"
)

// StartScheduler launches a background goroutine that sends deadline reminders.
func (n *Notifier) StartScheduler(ctx context.Context) {
	go func() {
		// Wait 30s on startup before first check
		time.Sleep(30 * time.Second)
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()

		// Run immediately, then on ticker
		n.checkDeadlines(ctx)
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				n.checkDeadlines(ctx)
			}
		}
	}()
}

func (n *Notifier) checkDeadlines(ctx context.Context) {
	cfg, err := n.loadConfig(ctx)
	if err != nil || !cfg.AutoReminder {
		return
	}

	evals, err := n.Store.PendingEvaluationsNearDeadline(ctx, cfg.ReminderDays)
	if err != nil {
		slog.Error("scheduler: fetch pending evals", "err", err)
		return
	}

	for _, ev := range evals {
		link := ""
		if cfg.BaseURL != "" {
			link = cfg.BaseURL + "/evaluations"
		}
		empName := ""
		if ev.EmployeeName != nil {
			empName = *ev.EmployeeName
		}
		n.Send(ctx, SendPayload{
			Type:         domain.NotifDeadlineReminder,
			EmployeeID:   ev.EmployeeID,
			EmployeeName: empName,
			EvalID:       ev.ID,
			EvalPeriod:   ev.Period,
			EvalLink:     link,
		})
	}

	if len(evals) > 0 {
		slog.Info("scheduler: sent deadline reminders", "count", len(evals))
	}
}
