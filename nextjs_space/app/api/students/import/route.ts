export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireTenant, isTenantSession } from '@/lib/tenant';
import { checkPermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { generatePermanentIds } from '@/lib/permanent-id';

export async function POST(req: NextRequest) {
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;
  const perm = checkPermission(tenant, 'STUDENTS', 'IMPORT');
  if (perm) return perm;

  try {
    const body = await req.json();
    const { schoolId, academicYearId, classId, divisionId, students: rows } = body ?? {};

    if (!schoolId || !academicYearId || !classId || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'schoolId, academicYearId, classId, and students array required' }, { status: 400 });
    }

    // Verify ownership
    const [school, year, cls] = await Promise.all([
      prisma.school.findFirst({ where: { id: schoolId, businessId: tenant.businessId } }),
      prisma.academicYear.findFirst({ where: { id: academicYearId, businessId: tenant.businessId } }),
      prisma.schoolClass.findFirst({ where: { id: classId, businessId: tenant.businessId } }),
    ]);

    if (!school || !year || !cls) {
      return NextResponse.json({ error: 'Invalid school, academic year, or class' }, { status: 404 });
    }

    // Validate rows
    const errors: any[] = [];
    const validRows: any[] = [];
    (rows ?? []).forEach((row: any, idx: number) => {
      const rowErrors: string[] = [];
      if (!row?.name || (row.name as string).trim().length === 0) rowErrors.push('Name is required');
      if (rowErrors.length > 0) {
        errors.push({ row: idx + 1, errors: rowErrors });
      } else {
        validRows.push({ ...row, rowIndex: idx + 1 });
      }
    });

    if (validRows.length === 0) {
      return NextResponse.json({ imported: 0, skipped: rows.length, errors }, { status: 200 });
    }

    const permanentIds = await generatePermanentIds(tenant.businessId, validRows.length);
    let imported = 0;
    const importErrors: any[] = [];

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      try {
        await prisma.$transaction(async (tx: any) => {
          const student = await tx.student.create({
            data: {
              businessId: tenant.businessId,
              schoolId,
              permanentId: permanentIds[i],
              name: (row.name as string).trim(),
              gender: row.gender ?? null,
              uniformCategory: row.uniformCategory ?? null,
              parentName: row.parentName ?? null,
              parentPhone: row.parentPhone ?? null,
              parentEmail: row.parentEmail ?? null,
            },
          });

          await tx.enrollment.create({
            data: {
              businessId: tenant.businessId,
              studentId: student.id,
              schoolId,
              academicYearId,
              classId,
              divisionId: divisionId ?? null,
              rollNumber: row.rollNumber ?? null,
            },
          });
        });
        imported++;
      } catch (e: any) {
        importErrors.push({ row: row.rowIndex, errors: [e?.message ?? 'Unknown error'] });
      }
    }

    await createAuditLog({
      businessId: tenant.businessId,
      userId: tenant.userId,
      userName: tenant.userName,
      action: 'IMPORT',
      entityType: 'Student',
      summary: `Imported ${imported} students into ${school.name} / ${cls.name}`,
    });

    return NextResponse.json({
      imported,
      skipped: errors.length + importErrors.length,
      errors: [...errors, ...importErrors],
    });
  } catch (error: any) {
    console.error('Import students error:', error);
    return NextResponse.json({ error: 'Import failed' }, { status: 500 });
  }
}
