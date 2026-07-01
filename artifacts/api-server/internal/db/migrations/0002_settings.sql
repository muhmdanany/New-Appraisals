-- Settings key-value store for application configuration (evaluation defaults, etc.)
CREATE TABLE IF NOT EXISTS "Settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("key")
);
