export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireTenant, isTenantSession } from '@/lib/tenant';
import { checkPermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';

export async function GET(req: NextRequest) {
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;

  const url = new URL(req.url);
  const schoolId = url.searchParams.get('schoolId') ?? '';

  const where: any = { businessId: tenant.businessId };
  if (schoolId) where.schoolId = schoolId;

  const divisions = await prisma.schoolDivision.findMany({
    where,
    orderBy: { sortOrder: 'asc' },
  });

  return NextResponse.json({ divisions });
}

export async function POST(req: NextRequest) {
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;
  const perm = checkPermission(tenant, 'SCHOOLS', 'EDIT');
  if (perm) return perm;

  try {
    const body = await req.json();
    const { schoolId, name, sortOrder } = body ?? {};

    if (!schoolId || !name) {
      return NextResponse.json({ error: 'School and name are required' }, { status: 400 });
    }

    const school = await prisma.school.findFirst({
      where: { id: schoolId, businessId: tenant.businessId },
    });
    if (!school) return NextResponse.json({ error: 'School not found' }, { status: 404 });

    const div = await prisma.schoolDivision.create({
      data: {
        businessId: tenant.businessId,
        schoolId,
        name,
        sortOrder: sortOrder ?? 0,
      },
    });

    await createAuditLog({
      businessId: tenant.businessId,
      userId: tenant.userId,
      userName: tenant.userName,
      action: 'CREATE',
      entityType: 'SchoolDivision',
      entityId: div.id,
      summary: `Division "${name}" created for ${school.name}`,
    });

    return NextResponse.json({ division: div }, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Division already exists for this school' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create division' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;
  const perm = checkPermission(tenant, 'SCHOOLS', 'EDIT');
  if (perm) return perm;

  const body = await req.json();
  const { id, name, sortOrder, active } = body ?? {};
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  const existing = await prisma.schoolDivision.findFirst({
    where: { id, businessId: tenant.businessId },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updated = await prisma.schoolDivision.update({
    where: { id },
    data: {
      name: name ?? existing.name,
      sortOrder: sortOrder ?? existing.sortOrder,
      active: active !== undefined ? active : existing.active,
    },
  });

  return NextResponse.json({ division: updated });
}
