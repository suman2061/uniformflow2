export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSuperAdmin, isSuperAdminSession } from '@/lib/tenant';

export async function GET() {
  const sa = await requireSuperAdmin();
  if (!isSuperAdminSession(sa)) return sa;

  const plans = await prisma.plan.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { subscriptions: true } } },
  });
  return NextResponse.json({ plans });
}

export async function POST(req: NextRequest) {
  const sa = await requireSuperAdmin();
  if (!isSuperAdminSession(sa)) return sa;

  try {
    const body = await req.json();
    const {
      name, slug, monthlyPrice, annualPrice, trialDays,
      maxSchools, maxUsers, maxStudents, storageMb, features, sortOrder, active,
    } = body ?? {};

    if (!name || !slug) {
      return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 });
    }

    const plan = await prisma.plan.create({
      data: {
        name,
        slug: (slug as string).toLowerCase().trim(),
        monthlyPrice: Number(monthlyPrice) || 0,
        annualPrice: Number(annualPrice) || 0,
        trialDays: Number(trialDays) ?? 14,
        maxSchools: Number(maxSchools) || 0,
        maxUsers: Number(maxUsers) || 0,
        maxStudents: Number(maxStudents) || 0,
        storageMb: Number(storageMb) || 0,
        features: features ?? null,
        sortOrder: Number(sortOrder) || 0,
        active: active !== false,
      },
    });
    return NextResponse.json({ plan }, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'A plan with that name or slug already exists' }, { status: 409 });
    }
    console.error('Create plan error:', error);
    return NextResponse.json({ error: 'Failed to create plan' }, { status: 500 });
  }
}
