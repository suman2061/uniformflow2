export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { requireSuperAdmin, isSuperAdminSession } from '@/lib/tenant';
import { createAuditLog } from '@/lib/audit';

export async function GET() {
  const sa = await requireSuperAdmin();
  if (!isSuperAdminSession(sa)) return sa;

  const businesses = await prisma.business.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { users: true, schools: true, students: true, products: true },
      },
    },
  });

  return NextResponse.json({ businesses });
}

export async function POST(req: NextRequest) {
  const sa = await requireSuperAdmin();
  if (!isSuperAdminSession(sa)) return sa;

  try {
    const body = await req.json();
    const { name, code, ownerName, ownerEmail, ownerPassword } = body ?? {};

    if (!name || !code || !ownerName || !ownerEmail || !ownerPassword) {
      return NextResponse.json({ error: 'All fields required' }, { status: 400 });
    }

    const emailLower = (ownerEmail as string).toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email: emailLower } });
    if (existing) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(ownerPassword, 12);

    const result = await prisma.$transaction(async (tx: any) => {
      const business = await tx.business.create({
        data: { name, code: (code as string).toUpperCase().trim(), status: 'active' },
      });
      const user = await tx.user.create({
        data: {
          businessId: business.id,
          email: emailLower,
          passwordHash,
          name: ownerName,
          role: 'BUSINESS_OWNER',
          active: true,
        },
      });
      return { business, user };
    });

    await createAuditLog({
      businessId: null,
      userId: sa.userId,
      userName: sa.userName,
      action: 'CREATE',
      entityType: 'Business',
      entityId: result.business.id,
      summary: `Business "${name}" created by Super Admin`,
    });

    return NextResponse.json({ business: result.business }, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Business code already exists' }, { status: 409 });
    }
    console.error('Create business error:', error);
    return NextResponse.json({ error: 'Failed to create business' }, { status: 500 });
  }
}
