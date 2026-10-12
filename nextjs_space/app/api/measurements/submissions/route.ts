export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireTenant, isTenantSession } from '@/lib/tenant';
import { checkPermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { generateRawToken, hashToken, defaultExpiry } from '@/lib/measurement-token';
import { z } from 'zod';

// GET: status board of measurement submissions for an academic year.
export async function GET(req: NextRequest) {
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;
  const perm = checkPermission(tenant, 'MEASUREMENTS', 'VIEW');
  if (perm) return perm;

  const url = new URL(req.url);
  const schoolId = url.searchParams.get('schoolId') ?? '';
  const academicYearId = url.searchParams.get('academicYearId') ?? '';
  const status = url.searchParams.get('status') ?? '';
  const search = url.searchParams.get('search') ?? '';

  const where: any = { businessId: tenant.businessId };
  if (schoolId) where.schoolId = schoolId;
  if (academicYearId) where.academicYearId = academicYearId;
  if (status) where.status = status;
  if (search) {
    where.student = {
      is: {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { permanentId: { contains: search, mode: 'insensitive' } },
        ],
      },
    };
  }

  const submissions = await prisma.measurementSubmission.findMany({
    where,
    include: {
      student: { select: { id: true, name: true, permanentId: true } },
      school: { select: { id: true, name: true } },
      academicYear: { select: { id: true, name: true } },
      enrollment: { include: { class: { select: { name: true } }, division: { select: { name: true } } } },
      _count: { select: { measurements: true } },
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 1000,
  });

  // Aggregate counts by status
  const counts: Record<string, number> = {};
  for (const s of submissions) counts[s.status] = (counts[s.status] ?? 0) + 1;

  return NextResponse.json({ submissions, counts, total: submissions.length });
}

const generateSchema = z.object({
  schoolId: z.string().min(1),
  academicYearId: z.string().min(1),
  studentIds: z.array(z.string()).optional(),
  expiryDays: z.number().int().min(1).max(365).optional(),
  all: z.boolean().optional(),
});

// POST: generate submission links (bulk or individual). Returns generated raw tokens once.
export async function POST(req: NextRequest) {
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;
  const perm = checkPermission(tenant, 'MEASUREMENTS', 'CREATE');
  if (perm) return perm;

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }
  const parsed = generateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });

  const { schoolId, academicYearId, expiryDays } = parsed.data;

  // Determine target enrollments for this school + academic year.
  const enrollWhere: any = { businessId: tenant.businessId, schoolId, academicYearId, status: 'enrolled' };
  if (!parsed.data.all && parsed.data.studentIds && parsed.data.studentIds.length > 0) {
    enrollWhere.studentId = { in: parsed.data.studentIds };
  }
  const enrollments = await prisma.enrollment.findMany({ where: enrollWhere, include: { student: true } });

  if (enrollments.length === 0) {
    return NextResponse.json({ error: 'No matching enrolled students found' }, { status: 400 });
  }

  const expiresAt = defaultExpiry(expiryDays ?? 30);
  const generated: Array<{ studentId: string; studentName: string; permanentId: string; token: string }> = [];

  for (const en of enrollments) {
    const raw = generateRawToken();
    const tokenHash = hashToken(raw);
    await prisma.measurementSubmission.upsert({
      where: {
        businessId_academicYearId_studentId: {
          businessId: tenant.businessId,
          academicYearId,
          studentId: en.studentId,
        },
      },
      update: {
        tokenHash,
        tokenExpiresAt: expiresAt,
        tokenRevoked: false,
        enrollmentId: en.id,
        schoolId,
        status: 'LINK_SENT',
        lastSentAt: new Date(),
        sendCount: { increment: 1 },
      },
      create: {
        businessId: tenant.businessId,
        schoolId,
        academicYearId,
        studentId: en.studentId,
        enrollmentId: en.id,
        tokenHash,
        tokenExpiresAt: expiresAt,
        status: 'LINK_SENT',
        lastSentAt: new Date(),
        sendCount: 1,
        isDemoData: en.student?.isDemoData ?? false,
      },
    });
    generated.push({
      studentId: en.studentId,
      studentName: en.student?.name ?? '',
      permanentId: en.student?.permanentId ?? '',
      token: raw,
    });
  }

  await createAuditLog({
    businessId: tenant.businessId,
    userId: tenant.userId,
    userName: tenant.userName,
    action: 'CREATE',
    entityType: 'MeasurementSubmission',
    summary: `Generated ${generated.length} measurement link(s)`,
  });

  return NextResponse.json({ generated, count: generated.length }, { status: 201 });
}
