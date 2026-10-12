export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireTenant, isTenantSession } from '@/lib/tenant';
import { checkPermission } from '@/lib/rbac';
import { createAuditLog, diffChanges } from '@/lib/audit';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;
  const perm = checkPermission(tenant, 'SCHOOLS', 'VIEW');
  if (perm) return perm;

  const { id } = await params;
  const school = await prisma.school.findFirst({
    where: { id, businessId: tenant.businessId },
    include: {
      academicYears: { orderBy: { name: 'desc' } },
      schoolClasses: { orderBy: { sortOrder: 'asc' } },
      schoolDivisions: { orderBy: { sortOrder: 'asc' } },
      _count: { select: { students: true, schoolProducts: true } },
    },
  });

  if (!school) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ school });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;
  const perm = checkPermission(tenant, 'SCHOOLS', 'EDIT');
  if (perm) return perm;

  const { id } = await params;
  const existing = await prisma.school.findFirst({
    where: { id, businessId: tenant.businessId },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const body = await req.json();
    const updated = await prisma.school.update({
      where: { id },
      data: {
        name: body.name ?? existing.name,
        code: body.code ? (body.code as string).toUpperCase().trim() : existing.code,
        address: body.address !== undefined ? body.address : existing.address,
        phone: body.phone !== undefined ? body.phone : existing.phone,
        email: body.email !== undefined ? body.email : existing.email,
        contactPerson: body.contactPerson !== undefined ? body.contactPerson : existing.contactPerson,
        billingName: body.billingName !== undefined ? body.billingName : existing.billingName,
        billingAddress: body.billingAddress !== undefined ? body.billingAddress : existing.billingAddress,
        gstin: body.gstin !== undefined ? body.gstin : existing.gstin,
        active: body.active !== undefined ? body.active : existing.active,
        logoUrl: body.logoUrl !== undefined ? body.logoUrl : existing.logoUrl,
      },
    });

    const changes = diffChanges(existing as any, updated as any);
    await createAuditLog({
      businessId: tenant.businessId,
      userId: tenant.userId,
      userName: tenant.userName,
      action: 'UPDATE',
      entityType: 'School',
      entityId: id,
      summary: `School "${updated.name}" updated`,
      changes,
    });

    return NextResponse.json({ school: updated });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'School code already exists' }, { status: 409 });
    }
    console.error('Update school error:', error);
    return NextResponse.json({ error: 'Failed to update school' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;
  const perm = checkPermission(tenant, 'SCHOOLS', 'DELETE');
  if (perm) return perm;

  const { id } = await params;
  const school = await prisma.school.findFirst({
    where: { id, businessId: tenant.businessId },
    include: { _count: { select: { students: true } } },
  });
  if (!school) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if ((school?._count?.students ?? 0) > 0) {
    // Soft archive instead
    await prisma.school.update({ where: { id }, data: { active: false } });
    await createAuditLog({
      businessId: tenant.businessId,
      userId: tenant.userId,
      userName: tenant.userName,
      action: 'UPDATE',
      entityType: 'School',
      entityId: id,
      summary: `School "${school.name}" archived (has students)`,
    });
    return NextResponse.json({ archived: true });
  }

  await prisma.school.delete({ where: { id } });
  await createAuditLog({
    businessId: tenant.businessId,
    userId: tenant.userId,
    userName: tenant.userName,
    action: 'DELETE',
    entityType: 'School',
    entityId: id,
    summary: `School "${school.name}" deleted`,
  });

  return NextResponse.json({ deleted: true });
}
