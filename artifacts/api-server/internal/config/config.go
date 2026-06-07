package config

import (
	"fmt"
	"os"
)

// Config holds runtime configuration sourced from environment variables.
type Config struct {
	Port             string
	DatabaseURL      string
	SessionSecret    string
	OpenRouterAPIKey string
	OpenRouterModel  string
	Env              string
}

// Load reads configuration from the environment, applying sensible defaults.
func Load() (*Config, error) {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		return nil, fmt.Errorf("DATABASE_URL environment variable is required")
	}

	secret := os.Getenv("SESSION_SECRET")
	if secret == "" {
		secret = "dev-insecure-session-secret-change-me"
	}

	model := os.Getenv("OPENROUTER_MODEL")
	if model == "" {
		model = "qwen/qwen-2.5-72b-instruct:free"
	}

	env := os.Getenv("NODE_ENV")
	if env == "" {
		env = "development"
	}

	return &Config{
		Port:             port,
		DatabaseURL:      dbURL,
		SessionSecret:    secret,
		OpenRouterAPIKey: os.Getenv("OPENROUTER_API_KEY"),
		OpenRouterModel:  model,
		Env:              env,
	}, nil
}
