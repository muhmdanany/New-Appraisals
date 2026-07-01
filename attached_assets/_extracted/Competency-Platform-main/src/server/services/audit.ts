import type { Prisma, PrismaClient } from "@prisma/client";

export interface AuditEntry {
  userId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
}

/**
 * Writes an audit-log row. Never throws into the caller's path — auditing must not
 * break the operation it records; failures are logged to the server console.
 */
export async function writeAudit(
  db: PrismaClient,
  entry: AuditEntry,
): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        metadata: entry.metadata,
        ipAddress: entry.ipAddress ?? null,
      },
    });
  } catch (err) {
    console.error("[audit] failed to write audit log", err);
  }
}
