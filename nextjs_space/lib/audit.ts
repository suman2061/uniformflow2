import { prisma } from '@/lib/db';

interface AuditInput {
  businessId: string | null;
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId?: string;
  summary: string;
  changes?: Record<string, any> | null;
  ip?: string;
}

export async function createAuditLog(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        businessId: input.businessId ?? null,
        userId: input.userId,
        userName: input.userName,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        summary: input.summary,
        changes: input.changes ?? undefined,
        ip: input.ip ?? null,
      },
    });
  } catch (e) {
    console.error('Failed to write audit log:', e);
  }
}

export function diffChanges(
  before: Record<string, any>,
  after: Record<string, any>
): Record<string, { from: any; to: any }> | null {
  const changes: Record<string, { from: any; to: any }> = {};
  const allKeys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  for (const key of allKeys) {
    if (key === 'updatedAt' || key === 'createdAt') continue;
    const bv = (before ?? {})[key];
    const av = (after ?? {})[key];
    if (JSON.stringify(bv) !== JSON.stringify(av)) {
      changes[key] = { from: bv, to: av };
    }
  }
  return Object.keys(changes).length > 0 ? changes : null;
}
