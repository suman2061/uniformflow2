export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireTenant, isTenantSession } from '@/lib/tenant';
import { checkPermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';

export async function GET(req: NextRequest) {
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;
  const perm = checkPermission(tenant, 'ACADEMIC_YEARS', 'VIEW');
  if (perm) return perm;

  const url = new URL(req.url);
  const schoolId = url.searchParams.get('schoolId') ?? '';
  const active = url.searchParams.get('active');

  const where: any = { businessId: tenant.businessId };
  if (schoolId) where.schoolId = schoolId;
  if (active === 'true') where.isActive = true;
  if (active === 'false') where.isActive = false;

  const years = await prisma.academicYear.findMany({
    where,
    orderBy: { name: 'desc' },
    include: {
      school: { select: { id: true, name: true, code: true } },
      _count: { select: { enrollments: true } },
    },
  });

  return NextResponse.json({ academicYears: years });
}

export async function POST(req: NextRequest) {
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;
  const perm = checkPermission(tenant, 'ACADEMIC_YEARS', 'CREATE');
  if (perm) return perm;

  try {
    const body = await req.json();
    const { schoolId, name, startsOn, endsOn, isActive } = body ?? {};

    if (!schoolId || !name) {
      return NextResponse.json({ error: 'School and name are required' }, { status: 400 });
    }

    // Verify school belongs to tenant
    const school = await prisma.school.findFirst({
      where: { id: schoolId, businessId: tenant.businessId },
    });
    if (!school) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 });
    }

    const year = await prisma.academicYear.create({
      data: {
        businessId: tenant.businessId,
        schoolId,
        name,
        startsOn: startsOn ? new Date(startsOn) : null,
        endsOn: endsOn ? new Date(endsOn) : null,
        isActive: isActive !== false,
      },
    });

    await createAuditLog({
      businessId: tenant.businessId,
      userId: tenant.userId,
      userName: tenant.userName,
      action: 'CREATE',
      entityType: 'AcademicYear',
      entityId: year.id,
      summary: `Academic year "${name}" created for ${school.name}`,
    });

    return NextResponse.json({ academicYear: year }, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Academic year already exists for this school' }, { status: 409 });
    }
    console.error('Create academic year error:', error);
    return NextResponse.json({ error: 'Failed to create academic year' }, { status: 500 });
  }
}
