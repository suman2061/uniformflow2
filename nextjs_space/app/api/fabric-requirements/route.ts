export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireTenant, isTenantSession } from '@/lib/tenant';
import { checkPermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { toNum } from '@/lib/money';
import { z } from 'zod';

// Orders whose lines count toward fabric requirement (confirmed onward, not cancelled).
const COUNTABLE = ['ORDER_CONFIRMED', 'FABRIC_PROCUREMENT_PENDING', 'FABRIC_ORDERED', 'FABRIC_PARTIALLY_RECEIVED', 'FABRIC_RECEIVED', 'CUTTING_IN_PROGRESS', 'STITCHING_IN_PROGRESS', 'QUALITY_CHECK', 'READY_FOR_DISPATCH', 'PARTIALLY_DELIVERED', 'DELIVERED', 'CLOSED'];

export async function GET(req: NextRequest) {
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;
  const perm = checkPermission(tenant, 'PROCUREMENT', 'VIEW');
  if (perm) return perm;

  const url = new URL(req.url);
  const academicYearId = url.searchParams.get('academicYearId') ?? '';

  const where: any = { businessId: tenant.businessId };
  if (academicYearId) where.academicYearId = academicYearId;

  const saved = await prisma.fabricRequirement.findMany({ where, orderBy: [{ productName: 'asc' }, { size: 'asc' }] });
  return NextResponse.json({ requirements: saved });
}

const genSchema = z.object({ academicYearId: z.string().min(1) });

// POST: (re)compute fabric requirements from approved order quantities for an academic year.
export async function POST(req: NextRequest) {
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;
  const perm = checkPermission(tenant, 'PROCUREMENT', 'CREATE');
  if (perm) return perm;

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }
  const parsed = genSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'academicYearId required' }, { status: 400 });
  const { academicYearId } = parsed.data;

  const orders = await prisma.order.findMany({
    where: { businessId: tenant.businessId, academicYearId, status: { in: COUNTABLE } },
    include: { lines: true },
  });

  // Aggregate approved quantities by product+size
  const agg = new Map<string, { productId: string; productName: string; size: string; qty: number }>();
  for (const o of orders) {
    for (const l of o.lines) {
      const net = Math.max(0, (l.approvedQty || l.quantity) - l.cancelledQty);
      if (net <= 0) continue;
      const key = `${l.productId}::${l.size}`;
      const cur = agg.get(key);
      if (cur) cur.qty += net;
      else agg.set(key, { productId: l.productId, productName: l.productName, size: l.size, qty: net });
    }
  }

  // Preserve any existing manual adjustments / consumption rules.
  const existing = await prisma.fabricRequirement.findMany({ where: { businessId: tenant.businessId, academicYearId } });
  const existMap = new Map(existing.map((e) => [`${e.productId}::${e.size}`, e]));

  const results = [];
  for (const [key, a] of agg) {
    const prev = existMap.get(key);
    const consumption = prev ? toNum(prev.consumptionPerUnit) : 0;
    const wastage = prev ? toNum(prev.wastagePercent) : 0;
    const manual = prev ? toNum(prev.manualAdjustment) : 0;
    const fabricRequired = +((a.qty * consumption) * (1 + wastage / 100) + manual).toFixed(3);
    if (prev) {
      const u = await prisma.fabricRequirement.update({
        where: { id: prev.id },
        data: { totalQuantity: a.qty, productName: a.productName, fabricRequired },
      });
      results.push(u);
    } else {
      const c = await prisma.fabricRequirement.create({
        data: { businessId: tenant.businessId, academicYearId, productId: a.productId, productName: a.productName, size: a.size, totalQuantity: a.qty, fabricRequired, isDemoData: false },
      });
      results.push(c);
    }
  }

  await createAuditLog({ businessId: tenant.businessId, userId: tenant.userId, userName: tenant.userName, action: 'CREATE', entityType: 'FabricRequirement', summary: `Computed fabric requirements (${results.length} rows)` });
  return NextResponse.json({ requirements: results, computed: results.length });
}

const adjustSchema = z.object({ id: z.string().min(1), consumptionPerUnit: z.number().min(0), wastagePercent: z.number().min(0).max(100), fabricType: z.string().optional().nullable(), manualAdjustment: z.number(), adjustmentReason: z.string().max(300).optional().nullable() });

// PATCH: authorized manual adjustment of consumption rules.
export async function PATCH(req: NextRequest) {
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;
  const perm = checkPermission(tenant, 'PROCUREMENT', 'EDIT');
  if (perm) return perm;

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }
  const parsed = adjustSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  const d = parsed.data;

  const fr = await prisma.fabricRequirement.findFirst({ where: { id: d.id, businessId: tenant.businessId } });
  if (!fr) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const fabricRequired = +((fr.totalQuantity * d.consumptionPerUnit) * (1 + d.wastagePercent / 100) + d.manualAdjustment).toFixed(3);
  const updated = await prisma.fabricRequirement.update({
    where: { id: d.id },
    data: { consumptionPerUnit: d.consumptionPerUnit, wastagePercent: d.wastagePercent, fabricType: d.fabricType ?? fr.fabricType, manualAdjustment: d.manualAdjustment, adjustmentReason: d.adjustmentReason ?? null, fabricRequired },
  });
  await createAuditLog({ businessId: tenant.businessId, userId: tenant.userId, userName: tenant.userName, action: 'EDIT', entityType: 'FabricRequirement', entityId: d.id, summary: `Adjusted fabric rule for ${fr.productName} ${fr.size}` });
  return NextResponse.json({ requirement: updated });
}
