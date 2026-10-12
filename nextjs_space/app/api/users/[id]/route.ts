export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { requireTenant, isTenantSession } from '@/lib/tenant';
import { createAuditLog } from '@/lib/audit';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;

  if (tenant.role !== 'BUSINESS_OWNER') {
    return NextResponse.json({ error: 'Only the business owner can edit users' }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.user.findFirst({
    where: { id, businessId: tenant.businessId },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const data: any = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.phone !== undefined) data.phone = body.phone;
  if (body.role !== undefined) data.role = body.role;
  if (body.permissions !== undefined) data.permissions = body.permissions;
  if (body.active !== undefined) data.active = body.active;
  if (body.password) {
    data.passwordHash = await bcrypt.hash(body.password, 12);
  }

  const updated = await prisma.user.update({ where: { id }, data });

  await createAuditLog({
    businessId: tenant.businessId,
    userId: tenant.userId,
    userName: tenant.userName,
    action: 'UPDATE',
    entityType: 'User',
    entityId: id,
    summary: `User "${updated.name}" updated`,
  });

  return NextResponse.json({
    user: { id: updated.id, email: updated.email, name: updated.name, role: updated.role, active: updated.active },
  });
}
