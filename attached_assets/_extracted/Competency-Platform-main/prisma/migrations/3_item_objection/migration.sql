-- Per-item employee objection.
ALTER TABLE "EvaluationItem" ADD COLUMN "objected" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "EvaluationItem" ADD COLUMN "objectionNote" TEXT;
