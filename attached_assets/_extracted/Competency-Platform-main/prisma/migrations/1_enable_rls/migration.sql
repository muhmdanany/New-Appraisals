-- Enable Row Level Security on every table.
--
-- This app accesses PostgreSQL exclusively through Prisma using the privileged
-- `postgres` role (which has BYPASSRLS), so RLS does not affect the application.
-- However, Supabase auto-exposes every `public` table through its PostgREST/Realtime
-- Data API to the browser-public `anon` / `authenticated` roles. Enabling RLS with
-- NO policies denies that auto-API entirely (zero rows, no writes), closing the
-- exposure that triggers Supabase's "RLS disabled in public" critical warnings.
--
-- We deliberately add no policies: the only intended database client is Prisma.

ALTER TABLE "public"."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."VerificationToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Department" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Grade" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."GradeLevel" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Competency" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Job" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."JobCompetency" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."CareerPath" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."CareerPathStage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."KpiSet" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."KpiGroup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Kpi" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Employee" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Evaluation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."EvaluationItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."BellCurvePolicy" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."AuditLog" ENABLE ROW LEVEL SECURITY;

-- Prisma's own migration bookkeeping table is also in `public`.
ALTER TABLE "public"."_prisma_migrations" ENABLE ROW LEVEL SECURITY;
