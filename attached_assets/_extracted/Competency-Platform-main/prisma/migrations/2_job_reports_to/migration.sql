-- Add the line-manager (reports-to) self-relation on Job.
ALTER TABLE "Job" ADD COLUMN "reportsToJobId" TEXT;

CREATE INDEX "Job_reportsToJobId_idx" ON "Job"("reportsToJobId");

ALTER TABLE "Job" ADD CONSTRAINT "Job_reportsToJobId_fkey"
  FOREIGN KEY ("reportsToJobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;
