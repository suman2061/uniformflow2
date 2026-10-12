export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireTenant, isTenantSession } from '@/lib/tenant';
import { checkPermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;
  const perm = checkPermission(tenant, 'PRODUCTION', 'VIEW');
  if (perm) return perm;

  const url = new URL(req.url);
  const academicYearId = url.searchParams.get('academicYearId') ?? '';
  const status = url.searchParams.get('status') ?? '';
  const where: any = { businessId: tenant.businessId };
  if (academicYearId) where.academicYearId = academicYearId;
  if (status) where.status = status;

  const batches = await prisma.productionBatch.findMany({ where, orderBy: { createdAt: 'desc' }, take: 1000 });
  return NextResponse.json({ batches });
}

const createSchema = z.object({
  academicYearId: z.string().min(1),
  productId: z.string().min(1),
  productName: z.string().min(1),
  size: z.string().optional().nullable(),
  plannedQty: z.number().int().min(1),
  worker: z.string().optional().nullable(),
  vendor: z.string().optional().nullable(),
  plannedCompletion: z.string().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export async function POST(req: NextRequest) {
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;
  const perm = checkPermission(tenant, 'PRODUCTION', 'CREATE');
  if (perm) return perm;

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  const d = parsed.data;

  const batch = await prisma.productionBatch.create({
    data: {
      businessId: tenant.businessId, academicYearId: d.academicYearId, productId: d.productId, productName: d.productName,
      size: d.size ?? '', plannedQty: d.plannedQty, status: 'PLANNED', worker: d.worker ?? null, vendor: d.vendor ?? null,
      plannedCompletion: d.plannedCompletion ? new Date(d.plannedCompletion) : null, notes: d.notes ?? null, isDemoData: false,
    },
  });
  await createAuditLog({ businessId: tenant.businessId, userId: tenant.userId, userName: tenant.userName, action: 'CREATE', entityType: 'ProductionBatch', entityId: batch.id, summary: `Production batch for ${d.productName} ${d.size ?? ''} (${d.plannedQty})` });
  return NextResponse.json({ batch }, { status: 201 });
}
