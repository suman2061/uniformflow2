export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireTenant, isTenantSession } from '@/lib/tenant';
import { checkPermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';

const patchSchema = z.object({
  cuttingQty: z.number().int().min(0).optional(),
  stitchingQty: z.number().int().min(0).optional(),
  completedQty: z.number().int().min(0).optional(),
  defectiveQty: z.number().int().min(0).optional(),
  reworkQty: z.number().int().min(0).optional(),
  status: z.enum(['PLANNED', 'CUTTING', 'STITCHING', 'QC', 'COMPLETED', 'ON_HOLD']).optional(),
  qcStatus: z.enum(['PENDING', 'PASSED', 'FAILED']).optional().nullable(),
  worker: z.string().optional().nullable(),
  vendor: z.string().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;
  const perm = checkPermission(tenant, 'PRODUCTION', 'EDIT');
  if (perm) return perm;

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  const d = parsed.data;

  const batch = await prisma.productionBatch.findFirst({ where: { id, businessId: tenant.businessId } });
  if (!batch) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const data: any = {};
  for (const k of ['cuttingQty', 'stitchingQty', 'completedQty', 'defectiveQty', 'reworkQty', 'status', 'qcStatus', 'worker', 'vendor', 'notes'] as const) {
    if (d[k] !== undefined) data[k] = d[k];
  }
  if (d.status === 'COMPLETED' && !batch.actualCompletion) data.actualCompletion = new Date();

  const updated = await prisma.productionBatch.update({ where: { id }, data });
  await createAuditLog({ businessId: tenant.businessId, userId: tenant.userId, userName: tenant.userName, action: 'EDIT', entityType: 'ProductionBatch', entityId: id, summary: `Production batch ${batch.productName} ${batch.size} updated` });
  return NextResponse.json({ batch: updated });
}
