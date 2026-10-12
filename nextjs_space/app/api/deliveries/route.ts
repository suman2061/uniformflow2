export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireTenant, isTenantSession } from '@/lib/tenant';
import { checkPermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { nextChallanNumber } from '@/lib/sequence';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;
  const perm = checkPermission(tenant, 'DELIVERIES', 'VIEW');
  if (perm) return perm;

  const url = new URL(req.url);
  const schoolId = url.searchParams.get('schoolId') ?? '';
  const status = url.searchParams.get('status') ?? '';
  const where: any = { businessId: tenant.businessId };
  if (schoolId) where.schoolId = schoolId;
  if (status) where.status = status;

  const deliveries = await prisma.delivery.findMany({ where, include: { lines: true }, orderBy: { createdAt: 'desc' }, take: 1000 });
  const schoolIds = Array.from(new Set(deliveries.map((x) => x.schoolId)));
  const schools = await prisma.school.findMany({ where: { id: { in: schoolIds } }, select: { id: true, name: true } });
  const sm = Object.fromEntries(schools.map((s) => [s.id, s.name]));
  return NextResponse.json({ deliveries: deliveries.map((x) => ({ ...x, schoolName: sm[x.schoolId] ?? '' })) });
}

const lineSchema = z.object({
  productId: z.string().min(1),
  productName: z.string().min(1),
  size: z.string().optional().nullable(),
  qtyRequired: z.number().int().min(0),
  qtyDelivered: z.number().int().min(0),
});

const createSchema = z.object({
  schoolId: z.string().min(1),
  academicYearId: z.string().min(1),
  orderId: z.string().optional().nullable(),
  studentId: z.string().optional().nullable(),
  recipientName: z.string().optional().nullable(),
  deliveryDate: z.string().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  proofFileUrl: z.string().optional().nullable(),
  lines: z.array(lineSchema).min(1),
});

export async function POST(req: NextRequest) {
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;
  const perm = checkPermission(tenant, 'DELIVERIES', 'CREATE');
  if (perm) return perm;

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  const d = parsed.data;

  const school = await prisma.school.findFirst({ where: { id: d.schoolId, businessId: tenant.businessId } });
  if (!school) return NextResponse.json({ error: 'School not found' }, { status: 404 });

  const challanNumber = await nextChallanNumber(tenant.businessId);
  const anyPending = d.lines.some((l) => l.qtyDelivered < l.qtyRequired);
  const anyDelivered = d.lines.some((l) => l.qtyDelivered > 0);
  const status = anyDelivered && anyPending ? 'PARTIAL' : anyPending ? 'PENDING' : 'DELIVERED';

  const result = await prisma.$transaction(async (tx) => {
    const delivery = await tx.delivery.create({
      data: {
        businessId: tenant.businessId, challanNumber, schoolId: d.schoolId, academicYearId: d.academicYearId,
        orderId: d.orderId || null, studentId: d.studentId || null, recipientName: d.recipientName ?? null,
        status, deliveryDate: d.deliveryDate ? new Date(d.deliveryDate) : new Date(), notes: d.notes ?? null,
        proofFileUrl: d.proofFileUrl ?? null, createdById: tenant.userId, isDemoData: school.isDemoData,
        lines: { create: d.lines.map((l) => ({ businessId: tenant.businessId, productId: l.productId, productName: l.productName, size: l.size ?? '', qtyRequired: l.qtyRequired, qtyDelivered: l.qtyDelivered, isDemoData: school.isDemoData })) },
      },
      include: { lines: true },
    });

    // Update linked order's delivered quantities + status
    if (d.orderId) {
      const order = await tx.order.findFirst({ where: { id: d.orderId, businessId: tenant.businessId }, include: { lines: true } });
      if (order) {
        for (const dl of d.lines) {
          const ol = order.lines.find((x) => x.productId === dl.productId && x.size === (dl.size ?? ''));
          if (ol) await tx.orderLine.update({ where: { id: ol.id }, data: { deliveredQty: { increment: dl.qtyDelivered } } });
        }
        const refreshed = await tx.order.findUnique({ where: { id: d.orderId }, include: { lines: true } });
        if (refreshed) {
          const fullyDelivered = refreshed.lines.every((x) => x.deliveredQty >= Math.max(0, (x.approvedQty || x.quantity) - x.cancelledQty));
          const partly = refreshed.lines.some((x) => x.deliveredQty > 0);
          let newStatus = refreshed.status;
          if (fullyDelivered && !['CLOSED', 'CANCELLED'].includes(refreshed.status)) newStatus = 'DELIVERED';
          else if (partly && !['CLOSED', 'CANCELLED', 'DELIVERED'].includes(refreshed.status)) newStatus = 'PARTIALLY_DELIVERED';
          if (newStatus !== refreshed.status) {
            const hist = Array.isArray(refreshed.statusHistory) ? (refreshed.statusHistory as any[]) : [];
            hist.push({ from: refreshed.status, to: newStatus, byId: tenant.userId, byName: tenant.userName, at: new Date().toISOString(), reason: `Delivery ${challanNumber}` });
            await tx.order.update({ where: { id: refreshed.id }, data: { status: newStatus, statusHistory: hist } });
          }
        }
      }
    }
    return delivery;
  });

  await createAuditLog({ businessId: tenant.businessId, userId: tenant.userId, userName: tenant.userName, action: 'CREATE', entityType: 'Delivery', entityId: result.id, summary: `Challan ${challanNumber} for ${school.name}` });
  return NextResponse.json({ delivery: result }, { status: 201 });
}
