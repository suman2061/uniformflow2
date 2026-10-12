export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { requireTenant, isTenantSession } from '@/lib/tenant';
import { checkPermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { enforceLimit } from '@/lib/subscription';

export async function GET(req: NextRequest) {
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;
  const perm = checkPermission(tenant, 'USERS', 'VIEW');
  if (perm) return perm;

  const users = await prisma.user.findMany({
    where: { businessId: tenant.businessId },
    select: {
      id: true, email: true, name: true, phone: true, role: true,
      permissions: true, active: true, createdAt: true, isDemoData: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;

  // Only BUSINESS_OWNER can create users
  if (tenant.role !== 'BUSINESS_OWNER') {
    return NextResponse.json({ error: 'Only the business owner can create users' }, { status: 403 });
  }

  const limit = await enforceLimit(tenant.businessId, 'users');
  if (limit) return limit;

  try {
    const body = await req.json();
    const { email, password, name, phone, role, permissions } = body ?? {};

    if (!email || !password || !name || !role) {
      return NextResponse.json({ error: 'email, password, name, role required' }, { status: 400 });
    }

    const validRoles = ['BUSINESS_ADMIN', 'OPERATIONS_MANAGER', 'ACCOUNTS_MANAGER', 'DATA_ENTRY_OPERATOR', 'READ_ONLY'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const emailLower = (email as string).toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email: emailLower } });
    if (existing) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        businessId: tenant.businessId,
        email: emailLower,
        passwordHash,
        name,
        phone: phone ?? null,
        role,
        permissions: permissions ?? null,
      },
    });

    await createAuditLog({
      businessId: tenant.businessId,
      userId: tenant.userId,
      userName: tenant.userName,
      action: 'CREATE',
      entityType: 'User',
      entityId: user.id,
      summary: `User "${name}" (${role}) created`,
    });

    return NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role, active: user.active },
    }, { status: 201 });
  } catch (error: any) {
    console.error('Create user error:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
