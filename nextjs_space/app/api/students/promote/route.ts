export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireTenant, isTenantSession } from '@/lib/tenant';
import { checkPermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';

export async function POST(req: NextRequest) {
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;
  const perm = checkPermission(tenant, 'STUDENTS', 'EDIT');
  if (perm) return perm;

  try {
    const body = await req.json();
    const { enrollmentIds, toAcademicYearId, toClassId, toDivisionId } = body ?? {};

    if (!Array.isArray(enrollmentIds) || enrollmentIds.length === 0 || !toAcademicYearId || !toClassId) {
      return NextResponse.json({ error: 'enrollmentIds, toAcademicYearId, toClassId are required' }, { status: 400 });
    }

    // Verify target year and class belong to tenant
    const [targetYear, targetClass] = await Promise.all([
      prisma.academicYear.findFirst({ where: { id: toAcademicYearId, businessId: tenant.businessId } }),
      prisma.schoolClass.findFirst({ where: { id: toClassId, businessId: tenant.businessId } }),
    ]);

    if (!targetYear || !targetClass) {
      return NextResponse.json({ error: 'Invalid target academic year or class' }, { status: 404 });
    }

    // Get source enrollments
    const sourceEnrollments = await prisma.enrollment.findMany({
      where: {
        id: { in: enrollmentIds },
        businessId: tenant.businessId,
      },
      include: { student: { select: { name: true } } },
    });

    let promoted = 0;
    const errors: any[] = [];

    for (const enrollment of sourceEnrollments) {
      try {
        // Check if already enrolled in target year
        const existing = await prisma.enrollment.findFirst({
          where: {
            businessId: tenant.businessId,
            studentId: enrollment.studentId,
            academicYearId: toAcademicYearId,
          },
        });

        if (existing) {
          errors.push({ enrollmentId: enrollment.id, error: 'Already enrolled in target year' });
          continue;
        }

        await prisma.$transaction(async (tx: any) => {
          // Mark old enrollment as promoted
          await tx.enrollment.update({
            where: { id: enrollment.id },
            data: { status: 'promoted' },
          });

          // Create new enrollment
          await tx.enrollment.create({
            data: {
              businessId: tenant.businessId,
              studentId: enrollment.studentId,
              schoolId: enrollment.schoolId,
              academicYearId: toAcademicYearId,
              classId: toClassId,
              divisionId: toDivisionId ?? null,
              status: 'enrolled',
            },
          });
        });

        promoted++;
      } catch (e: any) {
        errors.push({ enrollmentId: enrollment.id, error: e?.message ?? 'Unknown error' });
      }
    }

    await createAuditLog({
      businessId: tenant.businessId,
      userId: tenant.userId,
      userName: tenant.userName,
      action: 'UPDATE',
      entityType: 'Enrollment',
      summary: `Promoted ${promoted} students to ${targetYear.name} / ${targetClass.name}`,
    });

    return NextResponse.json({ promoted, errors });
  } catch (error: any) {
    console.error('Promote students error:', error);
    return NextResponse.json({ error: 'Promotion failed' }, { status: 500 });
  }
}
