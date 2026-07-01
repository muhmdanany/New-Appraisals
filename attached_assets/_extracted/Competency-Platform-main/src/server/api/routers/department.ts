import { createTRPCRouter, generalReadProcedure } from "@/server/api/trpc";

export const departmentRouter = createTRPCRouter({
  /** All organizational units, for form selects (used by ADMIN/HR forms). */
  list: generalReadProcedure.query(async ({ ctx }) => {
    return ctx.db.department.findMany({
      select: { id: true, name: true, level: true, parentId: true },
      orderBy: [{ level: "asc" }, { name: "asc" }],
    });
  }),
});
