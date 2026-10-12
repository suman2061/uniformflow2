export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { requireSuperAdmin, isSuperAdminSession } from '@/lib/tenant';
import { createAuditLog } from '@/lib/audit';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sa = await requireSuperAdmin();
  if (!isSuperAdminSession(sa)) return sa;

  const { id } = await params;
  const body = await req.json();

  const business = await prisma.business.findUnique({ where: { id } });
  if (!business) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const data: any = {};
  if (body.status !== undefined) data.status = body.status;
  if (body.name !== undefined) data.name = body.name;

  const updated = await prisma.business.update({ where: { id }, data });

  await createAuditLog({
    businessId: null,
    userId: sa.userId,
    userName: sa.userName,
    action: 'UPDATE',
    entityType: 'Business',
    entityId: id,
    summary: `Business "${updated.name}" ${body.status ? `status changed to ${body.status}` : 'updated'}`,
  });

  return NextResponse.json({ business: updated });
}

// Reset owner password
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sa = await requireSuperAdmin();
  if (!isSuperAdminSession(sa)) return sa;

  const { id } = await params;
  const body = await req.json();
  const { action, newPassword } = body ?? {};

  if (action === 'reset-password' && newPassword) {
    const owner = await prisma.user.findFirst({
      where: { businessId: id, role: 'BUSINESS_OWNER' },
    });
    if (!owner) return NextResponse.json({ error: 'Owner not found' }, { status: 404 });

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: owner.id }, data: { passwordHash } });

    await createAuditLog({
      businessId: null,
      userId: sa.userId,
      userName: sa.userName,
      action: 'UPDATE',
      entityType: 'User',
      entityId: owner.id,
      summary: `Password reset for owner of business ${id}`,
    });

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
