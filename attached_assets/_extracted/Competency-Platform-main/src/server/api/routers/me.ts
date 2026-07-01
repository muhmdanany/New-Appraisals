import { createTRPCRouter, protectedProcedure, publicProcedure } from "@/server/api/trpc";

export const meRouter = createTRPCRouter({
  /** Liveness probe — open to anyone. */
  health: publicProcedure.query(() => ({ ok: true, ts: Date.now() })),

  /** The current user with their linked employee record (if any). */
  current: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        employee: {
          select: {
            id: true,
            name: true,
            employeeNumber: true,
            department: { select: { id: true, name: true } },
          },
        },
      },
    });
    return user;
  }),
});
