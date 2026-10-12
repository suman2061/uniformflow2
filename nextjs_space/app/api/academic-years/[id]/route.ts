export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireTenant, isTenantSession } from '@/lib/tenant';
import { checkPermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;
  const perm = checkPermission(tenant, 'ACADEMIC_YEARS', 'EDIT');
  if (perm) return perm;

  const { id } = await params;
  const existing = await prisma.academicYear.findFirst({
    where: { id, businessId: tenant.businessId },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const updated = await prisma.academicYear.update({
    where: { id },
    data: {
      name: body.name ?? existing.name,
      startsOn: body.startsOn !== undefined ? (body.startsOn ? new Date(body.startsOn) : null) : existing.startsOn,
      endsOn: body.endsOn !== undefined ? (body.endsOn ? new Date(body.endsOn) : null) : existing.endsOn,
      isActive: body.isActive !== undefined ? body.isActive : existing.isActive,
    },
  });

  await createAuditLog({
    businessId: tenant.businessId,
    userId: tenant.userId,
    userName: tenant.userName,
    action: 'UPDATE',
    entityType: 'AcademicYear',
    entityId: id,
    summary: `Academic year "${updated.name}" updated`,
  });

  return NextResponse.json({ academicYear: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;
  const perm = checkPermission(tenant, 'ACADEMIC_YEARS', 'DELETE');
  if (perm) return perm;

  const { id } = await params;
  const existing = await prisma.academicYear.findFirst({
    where: { id, businessId: tenant.businessId },
    include: { _count: { select: { enrollments: true } } },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if ((existing?._count?.enrollments ?? 0) > 0) {
    await prisma.academicYear.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ archived: true });
  }

  await prisma.academicYear.delete({ where: { id } });
  await createAuditLog({
    businessId: tenant.businessId,
    userId: tenant.userId,
    userName: tenant.userName,
    action: 'DELETE',
    entityType: 'AcademicYear',
    entityId: id,
    summary: `Academic year "${existing.name}" deleted`,
  });

  return NextResponse.json({ deleted: true });
}
