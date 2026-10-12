export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireTenant, isTenantSession } from '@/lib/tenant';
import { checkPermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { nextOrderNumber } from '@/lib/sequence';
import { computeLine, computeTotals } from '@/lib/money';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;
  const perm = checkPermission(tenant, 'ORDERS', 'VIEW');
  if (perm) return perm;

  const url = new URL(req.url);
  const schoolId = url.searchParams.get('schoolId') ?? '';
  const academicYearId = url.searchParams.get('academicYearId') ?? '';
  const status = url.searchParams.get('status') ?? '';
  const search = url.searchParams.get('search')?.trim() ?? '';

  const where: any = { businessId: tenant.businessId };
  if (schoolId) where.schoolId = schoolId;
  if (academicYearId) where.academicYearId = academicYearId;
  if (status) where.status = status;
  if (search) where.orderNumber = { contains: search, mode: 'insensitive' };

  const orders = await prisma.order.findMany({
    where,
    include: { lines: true },
    orderBy: { createdAt: 'desc' },
    take: 1000,
  });

  // Attach school names
  const schoolIds = Array.from(new Set(orders.map((o) => o.schoolId)));
  const schools = await prisma.school.findMany({
    where: { id: { in: schoolIds }, businessId: tenant.businessId },
    select: { id: true, name: true },
  });
  const schoolMap = Object.fromEntries(schools.map((s) => [s.id, s.name]));
  const data = orders.map((o) => ({ ...o, schoolName: schoolMap[o.schoolId] ?? '' }));

  return NextResponse.json({ orders: data });
}

const lineSchema = z.object({
  productId: z.string().min(1),
  productName: z.string().min(1),
  size: z.string().optional().nullable(),
  quantity: z.number().int().min(1),
  unitPrice: z.number().min(0),
  discount: z.number().min(0).optional(),
  taxRate: z.number().min(0).max(100).optional(),
});

const createSchema = z.object({
  schoolId: z.string().min(1),
  academicYearId: z.string().min(1),
  studentId: z.string().optional().nullable(),
  orderType: z.enum(['SCHOOL', 'STUDENT']).default('SCHOOL'),
  expectedDeliveryDate: z.string().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  lines: z.array(lineSchema).min(1),
});

export async function POST(req: NextRequest) {
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;
  const perm = checkPermission(tenant, 'ORDERS', 'CREATE');
  if (perm) return perm;

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  const d = parsed.data;

  const school = await prisma.school.findFirst({ where: { id: d.schoolId, businessId: tenant.businessId } });
  if (!school) return NextResponse.json({ error: 'School not found' }, { status: 404 });

  // Duplicate-prevention: dedupe lines by product+size
  const seen = new Set<string>();
  for (const l of d.lines) {
    const key = `${l.productId}::${l.size ?? ''}`;
    if (seen.has(key)) return NextResponse.json({ error: 'Duplicate product/size in order lines' }, { status: 400 });
    seen.add(key);
  }

  const totals = computeTotals(d.lines.map((l) => ({ quantity: l.quantity, unitPrice: l.unitPrice, discount: l.discount, taxRate: l.taxRate })));
  const orderNumber = await nextOrderNumber(tenant.businessId);

  const now = new Date().toISOString();
  const order = await prisma.order.create({
    data: {
      businessId: tenant.businessId,
      orderNumber,
      schoolId: d.schoolId,
      academicYearId: d.academicYearId,
      studentId: d.studentId || null,
      orderType: d.orderType,
      status: 'REQUIREMENT_COLLECTION',
      expectedDeliveryDate: d.expectedDeliveryDate ? new Date(d.expectedDeliveryDate) : null,
      notes: d.notes ?? null,
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      taxTotal: totals.taxTotal,
      grandTotal: totals.grandTotal,
      statusHistory: [{ from: null, to: 'REQUIREMENT_COLLECTION', byId: tenant.userId, byName: tenant.userName, at: now, reason: 'Order created' }],
      createdById: tenant.userId,
      isDemoData: school.isDemoData,
      lines: {
        create: d.lines.map((l) => {
          const { taxAmount, lineTotal } = computeLine({ quantity: l.quantity, unitPrice: l.unitPrice, discount: l.discount, taxRate: l.taxRate });
          return {
            businessId: tenant.businessId,
            productId: l.productId,
            productName: l.productName,
            size: l.size ?? '',
            quantity: l.quantity,
            approvedQty: l.quantity,
            unitPrice: l.unitPrice,
            discount: l.discount ?? 0,
            taxRate: l.taxRate ?? 0,
            taxAmount,
            lineTotal,
            isDemoData: school.isDemoData,
          };
        }),
      },
    },
    include: { lines: true },
  });

  await createAuditLog({
    businessId: tenant.businessId, userId: tenant.userId, userName: tenant.userName,
    action: 'CREATE', entityType: 'Order', entityId: order.id,
    summary: `Order ${orderNumber} created for ${school.name}`,
  });

  return NextResponse.json({ order }, { status: 201 });
}
