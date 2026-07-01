import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { writeAudit } from "@/server/services/audit";
import type { Role } from "@/lib/rbac";

/**
 * Context available to every procedure: the Prisma client, the current Auth.js
 * session (or null), and the request headers (for client IP in the audit log).
 */
export const createTRPCContext = async (opts: { headers: Headers }) => {
  const session = await auth();
  return { db, session, headers: opts.headers };
};

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createCallerFactory = t.createCallerFactory;
export const createTRPCRouter = t.router;

/** Open to anyone (no auth). */
export const publicProcedure = t.procedure;

/** Ensures a session exists and narrows `ctx.session` to non-null. */
const enforceAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: { session: { ...ctx.session, user: ctx.session.user } },
  });
});

/** Logs successful mutations to the audit trail (action = procedure path). */
const auditMutations = t.middleware(async ({ ctx, path, type, next }) => {
  const result = await next();
  if (type === "mutation" && result.ok) {
    await writeAudit(ctx.db, {
      userId: ctx.session?.user?.id ?? null,
      action: path,
      ipAddress: ctx.headers.get("x-forwarded-for"),
    });
  }
  return result;
});

/** Requires an authenticated user. All authenticated mutations are audited. */
export const protectedProcedure = t.procedure
  .use(enforceAuth)
  .use(auditMutations);

/** Restricts a procedure to one or more roles. */
export const roleProcedure = (...roles: Role[]) =>
  protectedProcedure.use(({ ctx, next }) => {
    if (!roles.includes(ctx.session.user.role)) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return next();
  });

/** Convenience: write-capable HR data procedures (ADMIN only). */
export const adminProcedure = roleProcedure("ADMIN");

/** Read access to HR reference data — everyone except plain EMPLOYEE. */
export const hrReadProcedure = roleProcedure(
  "ADMIN",
  "HR_MANAGER",
  "FIRST_LEVEL_MANAGER",
  "SECOND_LEVEL_MANAGER",
);

/** General/reference data (jobs, competencies, grades, paths) — ADMIN + HR_MANAGER only. */
export const generalReadProcedure = roleProcedure("ADMIN", "HR_MANAGER");
