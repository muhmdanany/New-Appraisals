import type { PrismaClient } from "@prisma/client";
import type { Role } from "@/lib/rbac";

/**
 * Server-side RBAC scoping helpers.
 *
 * The data-visibility rules that depend on the reporting hierarchy live here so
 * the evaluation router (Phase 4) and any other scoped query can reuse them.
 *
 *  - ADMIN / HR_MANAGER: see everything (HR_MANAGER is read-only, enforced by
 *    procedure selection, not by scope).
 *  - FIRST_LEVEL_MANAGER: their direct reports.
 *  - SECOND_LEVEL_MANAGER: the reports of the first-level managers reporting to
 *    them (i.e. two levels down), plus those first-level managers themselves.
 *  - EMPLOYEE: only themselves.
 */

export function hasOrgWideAccess(role: Role): boolean {
  return role === "ADMIN" || role === "HR_MANAGER";
}

export function isReadOnly(role: Role): boolean {
  return role === "HR_MANAGER" || role === "EMPLOYEE";
}

/**
 * Returns the set of employee IDs a user may view, or `null` meaning "no scope
 * restriction" (org-wide access). Returns an empty array when the user has no
 * linked employee record and therefore no scope.
 */
export async function visibleEmployeeIds(
  db: PrismaClient,
  user: { role: Role; employeeId: string | null },
): Promise<string[] | null> {
  if (hasOrgWideAccess(user.role)) return null;
  if (!user.employeeId) return [];

  if (user.role === "EMPLOYEE") {
    return [user.employeeId];
  }

  if (user.role === "FIRST_LEVEL_MANAGER") {
    const reports = await db.employee.findMany({
      where: { managerId: user.employeeId },
      select: { id: true },
    });
    return reports.map((r) => r.id);
  }

  if (user.role === "SECOND_LEVEL_MANAGER") {
    const firstLevel = await db.employee.findMany({
      where: { managerId: user.employeeId },
      select: { id: true },
    });
    const firstLevelIds = firstLevel.map((r) => r.id);
    const secondLevelReports = firstLevelIds.length
      ? await db.employee.findMany({
          where: { managerId: { in: firstLevelIds } },
          select: { id: true },
        })
      : [];
    return [...firstLevelIds, ...secondLevelReports.map((r) => r.id)];
  }

  return [];
}
