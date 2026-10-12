export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireTenant, isTenantSession } from '@/lib/tenant';
import { checkPermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { generatePermanentId } from '@/lib/permanent-id';
import { enforceLimit } from '@/lib/subscription';

export async function GET(req: NextRequest) {
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;
  const perm = checkPermission(tenant, 'STUDENTS', 'VIEW');
  if (perm) return perm;

  const url = new URL(req.url);
  const search = url.searchParams.get('search') ?? '';
  const schoolId = url.searchParams.get('schoolId') ?? '';
  const academicYearId = url.searchParams.get('academicYearId') ?? '';
  const classId = url.searchParams.get('classId') ?? '';
  const divisionId = url.searchParams.get('divisionId') ?? '';
  const status = url.searchParams.get('status') ?? '';
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20')));
  const sortBy = url.searchParams.get('sortBy') ?? 'name';
  const sortOrder = url.searchParams.get('sortOrder') === 'desc' ? 'desc' : 'asc';

  const where: any = { businessId: tenant.businessId };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { permanentId: { contains: search, mode: 'insensitive' } },
      { parentName: { contains: search, mode: 'insensitive' } },
      { parentPhone: { contains: search } },
    ];
  }
  if (schoolId) where.schoolId = schoolId;
  if (status) where.status = status;

  // Filter by enrollment (class/division/academic year)
  if (academicYearId || classId || divisionId) {
    where.enrollments = {
      some: {
        businessId: tenant.businessId,
        ...(academicYearId ? { academicYearId } : {}),
        ...(classId ? { classId } : {}),
        ...(divisionId ? { divisionId } : {}),
      },
    };
  }

  const [students, total] = await Promise.all([
    prisma.student.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        school: { select: { id: true, name: true, code: true } },
        enrollments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            academicYear: { select: { id: true, name: true } },
            class: { select: { id: true, name: true } },
            division: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.student.count({ where }),
  ]);

  return NextResponse.json({ students, total, page, limit });
}

export async function POST(req: NextRequest) {
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;
  const perm = checkPermission(tenant, 'STUDENTS', 'CREATE');
  if (perm) return perm;

  const limit = await enforceLimit(tenant.businessId, 'students');
  if (limit) return limit;

  try {
    const body = await req.json();
    const { schoolId, name, gender, uniformCategory, parentName, parentPhone, parentEmail, notes,
      academicYearId, classId, divisionId, rollNumber } = body ?? {};

    if (!schoolId || !name) {
      return NextResponse.json({ error: 'School and name are required' }, { status: 400 });
    }

    // Verify school belongs to tenant
    const school = await prisma.school.findFirst({
      where: { id: schoolId, businessId: tenant.businessId },
    });
    if (!school) return NextResponse.json({ error: 'School not found' }, { status: 404 });

    const permanentId = await generatePermanentId(tenant.businessId);

    const result = await prisma.$transaction(async (tx: any) => {
      const student = await tx.student.create({
        data: {
          businessId: tenant.businessId,
          schoolId,
          permanentId,
          name,
          gender: gender ?? null,
          uniformCategory: uniformCategory ?? null,
          parentName: parentName ?? null,
          parentPhone: parentPhone ?? null,
          parentEmail: parentEmail ?? null,
          notes: notes ?? null,
        },
      });

      let enrollment = null;
      if (academicYearId && classId) {
        enrollment = await tx.enrollment.create({
          data: {
            businessId: tenant.businessId,
            studentId: student.id,
            schoolId,
            academicYearId,
            classId,
            divisionId: divisionId ?? null,
            rollNumber: rollNumber ?? null,
          },
        });
      }

      return { student, enrollment };
    });

    await createAuditLog({
      businessId: tenant.businessId,
      userId: tenant.userId,
      userName: tenant.userName,
      action: 'CREATE',
      entityType: 'Student',
      entityId: result.student.id,
      summary: `Student "${name}" (${permanentId}) created`,
    });

    return NextResponse.json({ student: result.student, enrollment: result.enrollment }, { status: 201 });
  } catch (error: any) {
    console.error('Create student error:', error);
    return NextResponse.json({ error: 'Failed to create student' }, { status: 500 });
  }
}
