export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireTenant, isTenantSession } from '@/lib/tenant';
import { checkPermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;
  const perm = checkPermission(tenant, 'MEASUREMENTS', 'VIEW');
  if (perm) return perm;
  const { id } = await params;

  const m = await prisma.measurement.findFirst({
    where: { id, businessId: tenant.businessId },
    include: {
      product: { select: { name: true, category: true, hasStandardSize: true, measurementFields: true } },
      student: { select: { name: true, permanentId: true } },
      history: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!m) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ measurement: m });
}

const updateSchema = z.object({
  size: z.string().optional().nullable(),
  fields: z.record(z.any()).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  reason: z.string().max(500).optional().nullable(),
});

// PATCH: authorized edit of a measurement, preserving history (never overwrite silently).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;
  const perm = checkPermission(tenant, 'MEASUREMENTS', 'EDIT');
  if (perm) return perm;
  const { id } = await params;

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  const d = parsed.data;

  const existing = await prisma.measurement.findFirst({ where: { id, businessId: tenant.businessId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const before = { size: existing.size, fields: existing.fields, notes: existing.notes };
  const after = {
    size: d.size !== undefined ? d.size : existing.size,
    fields: d.fields !== undefined ? d.fields : existing.fields,
    notes: d.notes !== undefined ? d.notes : existing.notes,
  };

  const updated = await prisma.$transaction(async (tx) => {
    const m = await tx.measurement.update({
      where: { id },
      data: { size: after.size, fields: after.fields as any, notes: after.notes, source: 'MANUAL' },
    });
    await tx.measurementHistory.create({
      data: {
        businessId: tenant.businessId, measurementId: id, changedById: tenant.userId,
        changedByName: tenant.userName, changeType: 'CORRECTION', before, after, reason: d.reason ?? 'Correction',
      },
    });
    return m;
  });

  await createAuditLog({
    businessId: tenant.businessId, userId: tenant.userId, userName: tenant.userName,
    action: 'EDIT', entityType: 'Measurement', entityId: id,
    summary: `Measurement corrected${d.reason ? ': ' + d.reason : ''}`,
  });

  return NextResponse.json({ measurement: updated });
}
