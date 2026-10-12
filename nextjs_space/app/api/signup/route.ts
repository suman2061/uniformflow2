export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, password, businessName: rawBusinessName } = body ?? {};

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 });
    }

    const businessName = rawBusinessName || `${name}'s Business`;

    const emailLower = (email as string).toLowerCase().trim();

    const existing = await prisma.user.findUnique({ where: { email: emailLower } });
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    const businessCode = `BIZ-${Date.now().toString(36).toUpperCase()}`;
    const passwordHash = await bcrypt.hash(password, 12);

    const result = await prisma.$transaction(async (tx: any) => {
      const business = await tx.business.create({
        data: {
          name: businessName,
          code: businessCode,
          status: 'active',
        },
      });

      const user = await tx.user.create({
        data: {
          businessId: business.id,
          email: emailLower,
          passwordHash,
          name,
          role: 'BUSINESS_OWNER',
          active: true,
        },
      });

      return { business, user };
    });

    await createAuditLog({
      businessId: result.business.id,
      userId: result.user.id,
      userName: name,
      action: 'CREATE',
      entityType: 'Business',
      entityId: result.business.id,
      summary: `Business "${businessName}" created via signup`,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
      },
    });
  } catch (error: any) {
    console.error('Signup error:', error);
    return NextResponse.json({ error: 'Signup failed' }, { status: 500 });
  }
}
