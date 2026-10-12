export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireTenant, isTenantSession } from '@/lib/tenant';
import { checkPermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { toNum } from '@/lib/money';
import { z } from 'zod';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;
  const perm = checkPermission(tenant, 'PROCUREMENT', 'VIEW');
  if (perm) return perm;
  const po = await prisma.purchaseOrder.findFirst({ where: { id, businessId: tenant.businessId }, include: { receipts: { orderBy: { receivedDate: 'desc' } } } });
  if (!po) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ purchaseOrder: po });
}

const patchSchema = z.object({
  action: z.enum(['receive', 'cancel']),
  receivedQty: z.number().min(0).optional(),
  shortageQty: z.number().min(0).optional(),
  notes: z.string().max(500).optional().nullable(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;
  const perm = checkPermission(tenant, 'PROCUREMENT', 'EDIT');
  if (perm) return perm;

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  const d = parsed.data;

  const po = await prisma.purchaseOrder.findFirst({ where: { id, businessId: tenant.businessId } });
  if (!po) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (po.status === 'CANCELLED' || po.status === 'RECEIVED') return NextResponse.json({ error: 'PO already closed' }, { status: 400 });

  if (d.action === 'cancel') {
    const updated = await prisma.purchaseOrder.update({ where: { id }, data: { status: 'CANCELLED' } });
    await createAuditLog({ businessId: tenant.businessId, userId: tenant.userId, userName: tenant.userName, action: 'EDIT', entityType: 'PurchaseOrder', entityId: id, summary: `PO ${po.poNumber} cancelled` });
    return NextResponse.json({ purchaseOrder: updated });
  }

  // receive
  const recv = d.receivedQty ?? 0;
  if (recv <= 0) return NextResponse.json({ error: 'receivedQty must be positive' }, { status: 400 });
  const result = await prisma.$transaction(async (tx) => {
    await tx.fabricReceipt.create({ data: { businessId: tenant.businessId, purchaseOrderId: id, receivedQty: recv, shortageQty: d.shortageQty ?? 0, notes: d.notes ?? null, receivedById: tenant.userId, isDemoData: po.isDemoData } });
    const newReceived = +(toNum(po.receivedQty) + recv).toFixed(3);
    const status = newReceived + 0.0009 >= toNum(po.quantity) ? 'RECEIVED' : 'PARTIALLY_RECEIVED';
    return tx.purchaseOrder.update({ where: { id }, data: { receivedQty: newReceived, status }, include: { receipts: true } });
  });
  await createAuditLog({ businessId: tenant.businessId, userId: tenant.userId, userName: tenant.userName, action: 'EDIT', entityType: 'PurchaseOrder', entityId: id, summary: `PO ${po.poNumber}: received ${recv} ${po.unit}` });
  return NextResponse.json({ purchaseOrder: result });
}
