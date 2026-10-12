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
  const perm = checkPermission(tenant, 'MEASUREMENTS', 'VIEW');
  if (perm) return perm;

  const url = new URL(req.url);
  const academicYearId = url.searchParams.get('academicYearId') ?? '';
  const studentId = url.searchParams.get('studentId') ?? '';
  const productId = url.searchParams.get('productId') ?? '';

  const where: any = { businessId: tenant.businessId };
  if (academicYearId) where.academicYearId = academicYearId;
  if (studentId) where.studentId = studentId;
  if (productId) where.productId = productId;

  const measurements = await prisma.measurement.findMany({
    where,
    include: {
      student: { select: { name: true, permanentId: true } },
      product: { select: { name: true, category: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 2000,
  });
  return NextResponse.json({ measurements });
}

const createSchema = z.object({
  studentId: z.string().min(1),
  academicYearId: z.string().min(1),
  productId: z.string().min(1),
  size: z.string().optional().nullable(),
  fields: z.record(z.any()).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

// POST: staff manual measurement entry.
export async function POST(req: NextRequest) {
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;
  const perm = checkPermission(tenant, 'MEASUREMENTS', 'CREATE');
  if (perm) return perm;

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  const d = parsed.data;

  // Validate referenced entities belong to tenant.
  const student = await prisma.student.findFirst({ where: { id: d.studentId, businessId: tenant.businessId } });
  if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

  const existing = await prisma.measurement.findFirst({
    where: { businessId: tenant.businessId, studentId: d.studentId, academicYearId: d.academicYearId, productId: d.productId },
  });

  const result = await prisma.$transaction(async (tx) => {
    if (existing) {
      const before = { size: existing.size, fields: existing.fields };
      const after = { size: d.size ?? null, fields: d.fields ?? {} };
      const m = await tx.measurement.update({
        where: { id: existing.id },
        data: { source: 'STAFF', size: d.size ?? null, fields: d.fields ?? {}, notes: d.notes ?? null },
      });
      await tx.measurementHistory.create({
        data: {
          businessId: tenant.businessId, measurementId: existing.id, changedById: tenant.userId,
          changedByName: tenant.userName, changeType: 'STAFF_EDIT', before, after, reason: 'Staff manual entry',
        },
      });
      return m;
    }
    const m = await tx.measurement.create({
      data: {
        businessId: tenant.businessId, studentId: d.studentId, academicYearId: d.academicYearId,
        productId: d.productId, source: 'STAFF', size: d.size ?? null, fields: d.fields ?? {},
        notes: d.notes ?? null, isDemoData: student.isDemoData,
      },
    });
    await tx.measurementHistory.create({
      data: {
        businessId: tenant.businessId, measurementId: m.id, changedById: tenant.userId,
        changedByName: tenant.userName, changeType: 'CREATE', before: {}, after: { size: m.size, fields: m.fields },
        reason: 'Staff manual entry',
      },
    });
    return m;
  });

  await createAuditLog({
    businessId: tenant.businessId, userId: tenant.userId, userName: tenant.userName,
    action: existing ? 'EDIT' : 'CREATE', entityType: 'Measurement', entityId: result.id,
    summary: `Measurement ${existing ? 'updated' : 'recorded'} for ${student.name}`,
  });

  return NextResponse.json({ measurement: result }, { status: existing ? 200 : 201 });
}
