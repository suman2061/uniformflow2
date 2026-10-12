export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSuperAdmin, isSuperAdminSession } from '@/lib/tenant';

export async function GET() {
  const sa = await requireSuperAdmin();
  if (!isSuperAdminSession(sa)) return sa;

  const subscriptions = await prisma.subscription.findMany({
    include: {
      plan: true,
      business: { select: { id: true, name: true, code: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ subscriptions });
}

// Assign or change a business's subscription (super admin override).
export async function POST(req: NextRequest) {
  const sa = await requireSuperAdmin();
  if (!isSuperAdminSession(sa)) return sa;

  try {
    const body = await req.json();
    const { businessId, planId, status, billingCycle, trialDays } = body ?? {};
    if (!businessId || !planId) {
      return NextResponse.json({ error: 'businessId and planId are required' }, { status: 400 });
    }

    const [business, plan] = await Promise.all([
      prisma.business.findUnique({ where: { id: businessId } }),
      prisma.plan.findUnique({ where: { id: planId } }),
    ]);
    if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });

    const nextStatus = status || 'active';
    let trialEndsAt: Date | null = null;
    if (nextStatus === 'trial') {
      const days = Number(trialDays) || plan.trialDays || 14;
      trialEndsAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    }

    const subscription = await prisma.subscription.upsert({
      where: { businessId },
      update: {
        planId,
        status: nextStatus,
        billingCycle: billingCycle || 'monthly',
        trialEndsAt,
      },
      create: {
        businessId,
        planId,
        status: nextStatus,
        billingCycle: billingCycle || 'monthly',
        trialEndsAt,
      },
      include: { plan: true, business: { select: { id: true, name: true, code: true } } },
    });

    return NextResponse.json({ subscription });
  } catch (error) {
    console.error('Assign subscription error:', error);
    return NextResponse.json({ error: 'Failed to assign subscription' }, { status: 500 });
  }
}
