// Command server runs the Competency Platform REST API (Go backend).
package main

import (
        "context"
        "log/slog"
        "net/http"
        "os"
        "time"

        "competency/internal/ai"
        "competency/internal/config"
        "competency/internal/db"
        "competency/internal/handlers"
        "competency/internal/router"
        "competency/internal/store"
)

func main() {
        logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
        slog.SetDefault(logger)

        cfg, err := config.Load()
        if err != nil {
                logger.Error("config error", "err", err)
                os.Exit(1)
        }

        ctx := context.Background()
        pool, err := db.New(ctx, cfg.DatabaseURL)
        if err != nil {
                logger.Error("database connection failed", "err", err)
                os.Exit(1)
        }
        defer pool.Close()

        st := store.New(pool)
        aiClient := ai.New(cfg.OpenRouterAPIKey, cfg.OpenRouterModel)
        h := handlers.New(st, aiClient, cfg)

        srv := &http.Server{
                Addr:              ":" + cfg.Port,
                Handler:           router.New(h),
                ReadHeaderTimeout: 10 * time.Second,
        }

        logger.Info("server listening", "port", cfg.Port, "env", cfg.Env, "aiConfigured", aiClient.Configured())
        if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
                logger.Error("server error", "err", err)
                os.Exit(1)
        }
}
