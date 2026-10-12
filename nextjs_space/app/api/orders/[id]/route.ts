export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireTenant, isTenantSession } from '@/lib/tenant';
import { checkPermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { canTransition, stateLabel } from '@/lib/order-workflow';
import { z } from 'zod';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;
  const perm = checkPermission(tenant, 'ORDERS', 'VIEW');
  if (perm) return perm;

  const order = await prisma.order.findFirst({
    where: { id, businessId: tenant.businessId },
    include: { lines: { orderBy: { productName: 'asc' } } },
  });
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const school = await prisma.school.findUnique({ where: { id: order.schoolId }, select: { name: true } });
  const ay = await prisma.academicYear.findUnique({ where: { id: order.academicYearId }, select: { name: true } });
  const student = order.studentId ? await prisma.student.findUnique({ where: { id: order.studentId }, select: { name: true, permanentId: true } }) : null;

  return NextResponse.json({ order: { ...order, schoolName: school?.name ?? '', academicYearName: ay?.name ?? '', student } });
}

const patchSchema = z.object({
  action: z.enum(['transition', 'edit']),
  toStatus: z.string().optional(),
  reason: z.string().max(500).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  expectedDeliveryDate: z.string().optional().nullable(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  const d = parsed.data;

  const order = await prisma.order.findFirst({ where: { id, businessId: tenant.businessId } });
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (d.action === 'transition') {
    const perm = checkPermission(tenant, 'ORDERS', 'APPROVE');
    if (perm) return perm;
    if (!d.toStatus) return NextResponse.json({ error: 'toStatus required' }, { status: 400 });
    if (!canTransition(order.status, d.toStatus)) {
      return NextResponse.json({ error: `Cannot move from ${stateLabel(order.status)} to ${stateLabel(d.toStatus)}` }, { status: 400 });
    }
    const history = Array.isArray(order.statusHistory) ? (order.statusHistory as any[]) : [];
    history.push({ from: order.status, to: d.toStatus, byId: tenant.userId, byName: tenant.userName, at: new Date().toISOString(), reason: d.reason ?? null });
    const updated = await prisma.order.update({
      where: { id },
      data: { status: d.toStatus, statusHistory: history },
      include: { lines: true },
    });
    await createAuditLog({
      businessId: tenant.businessId, userId: tenant.userId, userName: tenant.userName,
      action: 'EDIT', entityType: 'Order', entityId: id,
      summary: `Order ${order.orderNumber}: ${stateLabel(order.status)} → ${stateLabel(d.toStatus)}`,
      changes: { status: { from: order.status, to: d.toStatus }, reason: d.reason ?? null },
    });
    return NextResponse.json({ order: updated });
  }

  // edit
  const perm = checkPermission(tenant, 'ORDERS', 'EDIT');
  if (perm) return perm;
  const updated = await prisma.order.update({
    where: { id },
    data: {
      notes: d.notes ?? order.notes,
      expectedDeliveryDate: d.expectedDeliveryDate ? new Date(d.expectedDeliveryDate) : order.expectedDeliveryDate,
    },
    include: { lines: true },
  });
  await createAuditLog({
    businessId: tenant.businessId, userId: tenant.userId, userName: tenant.userName,
    action: 'EDIT', entityType: 'Order', entityId: id, summary: `Order ${order.orderNumber} updated`,
  });
  return NextResponse.json({ order: updated });
}
