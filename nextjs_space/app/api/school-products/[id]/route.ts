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
  const perm = checkPermission(tenant, 'SCHOOL_PRODUCTS', 'EDIT');
  if (perm) return perm;

  const { id } = await params;
  const existing = await prisma.schoolProduct.findFirst({
    where: { id, businessId: tenant.businessId },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const updated = await prisma.schoolProduct.update({
    where: { id },
    data: {
      priceOverride: body.priceOverride !== undefined ? body.priceOverride : existing.priceOverride,
      applicableClassIds: body.applicableClassIds !== undefined ? body.applicableClassIds : existing.applicableClassIds,
      applicableDivisionIds: body.applicableDivisionIds !== undefined ? body.applicableDivisionIds : existing.applicableDivisionIds,
      uniformCategories: body.uniformCategories !== undefined ? body.uniformCategories : existing.uniformCategories,
      isMandatory: body.isMandatory !== undefined ? body.isMandatory : existing.isMandatory,
      isActive: body.isActive !== undefined ? body.isActive : existing.isActive,
    },
  });

  await createAuditLog({
    businessId: tenant.businessId,
    userId: tenant.userId,
    userName: tenant.userName,
    action: 'UPDATE',
    entityType: 'SchoolProduct',
    entityId: id,
    summary: `School-product mapping updated`,
  });

  return NextResponse.json({ schoolProduct: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;
  const perm = checkPermission(tenant, 'SCHOOL_PRODUCTS', 'DELETE');
  if (perm) return perm;

  const { id } = await params;
  const existing = await prisma.schoolProduct.findFirst({
    where: { id, businessId: tenant.businessId },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.schoolProduct.delete({ where: { id } });
  await createAuditLog({
    businessId: tenant.businessId,
    userId: tenant.userId,
    userName: tenant.userName,
    action: 'DELETE',
    entityType: 'SchoolProduct',
    entityId: id,
    summary: `School-product mapping removed`,
  });

  return NextResponse.json({ deleted: true });
}
