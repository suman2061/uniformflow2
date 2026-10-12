export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireTenant, isTenantSession } from '@/lib/tenant';

export async function GET() {
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;

  const [schools, students, products, academicYears, users, recentAudit] = await Promise.all([
    prisma.school.count({ where: { businessId: tenant.businessId, active: true } }),
    prisma.student.count({ where: { businessId: tenant.businessId, status: 'active' } }),
    prisma.product.count({ where: { businessId: tenant.businessId, isActive: true } }),
    prisma.academicYear.count({ where: { businessId: tenant.businessId, isActive: true } }),
    prisma.user.count({ where: { businessId: tenant.businessId, active: true } }),
    prisma.auditLog.findMany({
      where: { businessId: tenant.businessId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  return NextResponse.json({
    stats: { schools, students, products, academicYears, users },
    recentActivity: recentAudit,
  });
}
