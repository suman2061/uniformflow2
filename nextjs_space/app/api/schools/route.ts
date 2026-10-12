export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireTenant, isTenantSession } from '@/lib/tenant';
import { checkPermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { enforceLimit } from '@/lib/subscription';

export async function GET(req: NextRequest) {
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;
  const perm = checkPermission(tenant, 'SCHOOLS', 'VIEW');
  if (perm) return perm;

  const url = new URL(req.url);
  const search = url.searchParams.get('search') ?? '';
  const status = url.searchParams.get('status') ?? '';
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20')));
  const sortBy = url.searchParams.get('sortBy') ?? 'name';
  const sortOrder = url.searchParams.get('sortOrder') === 'desc' ? 'desc' : 'asc';

  const where: any = { businessId: tenant.businessId };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { code: { contains: search, mode: 'insensitive' } },
      { contactPerson: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (status === 'active') where.active = true;
  if (status === 'archived') where.active = false;

  const [schools, total] = await Promise.all([
    prisma.school.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        _count: { select: { students: true, academicYears: true } },
      },
    }),
    prisma.school.count({ where }),
  ]);

  return NextResponse.json({ schools, total, page, limit });
}

export async function POST(req: NextRequest) {
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;
  const perm = checkPermission(tenant, 'SCHOOLS', 'CREATE');
  if (perm) return perm;

  const limit = await enforceLimit(tenant.businessId, 'schools');
  if (limit) return limit;

  try {
    const body = await req.json();
    const { name, code, address, phone, email, contactPerson, billingName, billingAddress, gstin } = body ?? {};

    if (!name || !code) {
      return NextResponse.json({ error: 'Name and code are required' }, { status: 400 });
    }

    const school = await prisma.school.create({
      data: {
        businessId: tenant.businessId,
        name,
        code: code.toUpperCase().trim(),
        address: address ?? null,
        phone: phone ?? null,
        email: email ?? null,
        contactPerson: contactPerson ?? null,
        billingName: billingName ?? null,
        billingAddress: billingAddress ?? null,
        gstin: gstin ?? null,
      },
    });

    await createAuditLog({
      businessId: tenant.businessId,
      userId: tenant.userId,
      userName: tenant.userName,
      action: 'CREATE',
      entityType: 'School',
      entityId: school.id,
      summary: `School "${name}" (${code}) created`,
    });

    return NextResponse.json({ school }, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'School code already exists for this business' }, { status: 409 });
    }
    console.error('Create school error:', error);
    return NextResponse.json({ error: 'Failed to create school' }, { status: 500 });
  }
}
