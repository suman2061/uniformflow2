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
  const perm = checkPermission(tenant, 'STUDENTS', 'VIEW');
  if (perm) return perm;

  const { id } = await params;
  const student = await prisma.student.findFirst({
    where: { id, businessId: tenant.businessId },
    include: {
      school: { select: { id: true, name: true, code: true } },
      enrollments: {
        orderBy: { createdAt: 'desc' },
        include: {
          academicYear: { select: { id: true, name: true } },
          class: { select: { id: true, name: true } },
          division: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!student) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Get products assigned to this student via school-product mapping
  const latestEnrollment = student?.enrollments?.[0];
  let assignedProducts: any[] = [];
  if (latestEnrollment) {
    const schoolProducts = await prisma.schoolProduct.findMany({
      where: {
        businessId: tenant.businessId,
        schoolId: student.schoolId,
        academicYearId: latestEnrollment.academicYearId,
        isActive: true,
      },
      include: {
        product: { select: { id: true, name: true, sku: true, category: true, thumbnailUrl: true, imageUrl: true, sellingPrice: true } },
      },
    });

    // Filter by applicable class/division/uniform category
    assignedProducts = (schoolProducts ?? []).filter((sp: any) => {
      const classIds = sp?.applicableClassIds as string[] | null;
      const divIds = sp?.applicableDivisionIds as string[] | null;
      const cats = sp?.uniformCategories as string[] | null;

      if (classIds && Array.isArray(classIds) && classIds.length > 0 && !classIds.includes(latestEnrollment.classId)) return false;
      if (divIds && Array.isArray(divIds) && divIds.length > 0 && latestEnrollment?.divisionId && !divIds.includes(latestEnrollment.divisionId)) return false;
      if (cats && Array.isArray(cats) && cats.length > 0 && student?.uniformCategory && !cats.includes(student.uniformCategory)) return false;
      return true;
    });
  }

  return NextResponse.json({ student, assignedProducts });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;
  const perm = checkPermission(tenant, 'STUDENTS', 'EDIT');
  if (perm) return perm;

  const { id } = await params;
  const existing = await prisma.student.findFirst({
    where: { id, businessId: tenant.businessId },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const updated = await prisma.student.update({
    where: { id },
    data: {
      name: body.name ?? existing.name,
      gender: body.gender !== undefined ? body.gender : existing.gender,
      uniformCategory: body.uniformCategory !== undefined ? body.uniformCategory : existing.uniformCategory,
      parentName: body.parentName !== undefined ? body.parentName : existing.parentName,
      parentPhone: body.parentPhone !== undefined ? body.parentPhone : existing.parentPhone,
      parentEmail: body.parentEmail !== undefined ? body.parentEmail : existing.parentEmail,
      status: body.status ?? existing.status,
      notes: body.notes !== undefined ? body.notes : existing.notes,
    },
  });

  const changes = diffChanges(existing as any, updated as any);
  await createAuditLog({
    businessId: tenant.businessId,
    userId: tenant.userId,
    userName: tenant.userName,
    action: 'UPDATE',
    entityType: 'Student',
    entityId: id,
    summary: `Student "${updated.name}" (${updated.permanentId}) updated`,
    changes,
  });

  return NextResponse.json({ student: updated });
}
