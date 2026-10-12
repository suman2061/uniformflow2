export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireTenant, isTenantSession } from '@/lib/tenant';
import { checkPermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { nextPoNumber } from '@/lib/sequence';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;
  const perm = checkPermission(tenant, 'PROCUREMENT', 'VIEW');
  if (perm) return perm;

  const url = new URL(req.url);
  const status = url.searchParams.get('status') ?? '';
  const where: any = { businessId: tenant.businessId };
  if (status) where.status = status;

  const purchaseOrders = await prisma.purchaseOrder.findMany({ where, include: { receipts: true }, orderBy: { createdAt: 'desc' }, take: 1000 });
  return NextResponse.json({ purchaseOrders });
}

const createSchema = z.object({
  supplierName: z.string().min(1),
  supplierContact: z.string().optional().nullable(),
  fabricType: z.string().optional().nullable(),
  quantity: z.number().min(0),
  unit: z.string().default('METERS'),
  unitCost: z.number().min(0),
  expectedDeliveryDate: z.string().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export async function POST(req: NextRequest) {
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;
  const perm = checkPermission(tenant, 'PROCUREMENT', 'CREATE');
  if (perm) return perm;

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  const d = parsed.data;

  const poNumber = await nextPoNumber(tenant.businessId);
  const totalCost = +(d.quantity * d.unitCost).toFixed(2);
  const po = await prisma.purchaseOrder.create({
    data: {
      businessId: tenant.businessId, poNumber, supplierName: d.supplierName, supplierContact: d.supplierContact ?? null,
      fabricType: d.fabricType ?? null, quantity: d.quantity, unit: d.unit, unitCost: d.unitCost, totalCost,
      status: 'ORDERED', expectedDeliveryDate: d.expectedDeliveryDate ? new Date(d.expectedDeliveryDate) : null,
      notes: d.notes ?? null, createdById: tenant.userId, isDemoData: false,
    },
  });
  await createAuditLog({ businessId: tenant.businessId, userId: tenant.userId, userName: tenant.userName, action: 'CREATE', entityType: 'PurchaseOrder', entityId: po.id, summary: `PO ${poNumber} raised for ${d.supplierName}` });
  return NextResponse.json({ purchaseOrder: po }, { status: 201 });
}
