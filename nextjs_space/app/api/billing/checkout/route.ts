export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireTenant, isTenantSession } from '@/lib/tenant';
import { getProvider, getDefaultProvider, ProviderName } from '@/lib/billing/provider';
import { createAuditLog } from '@/lib/audit';

// Initiate a checkout for a plan change. In test mode (no keys) this returns a
// clear "not configured" response. A payment is NEVER recorded here — only a
// verified webhook upgrades the subscription.
export async function POST(req: NextRequest) {
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;

  // Only the business owner manages billing.
  if (tenant.role !== 'BUSINESS_OWNER') {
    return NextResponse.json({ error: 'Only the business owner can manage billing' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { planId, billingCycle, provider } = body ?? {};
    if (!planId) return NextResponse.json({ error: 'planId required' }, { status: 400 });

    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan || !plan.active) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    const cycle: 'monthly' | 'annual' = billingCycle === 'annual' ? 'annual' : 'monthly';
    const amount = cycle === 'annual' ? Number(plan.annualPrice) : Number(plan.monthlyPrice);

    const prov = provider ? getProvider(provider as ProviderName) : getDefaultProvider();
    if (!prov) return NextResponse.json({ error: 'Unknown provider' }, { status: 400 });

    // Free plan (amount 0): assign immediately without a gateway.
    if (amount <= 0) {
      const sub = await prisma.subscription.upsert({
        where: { businessId: tenant.businessId },
        update: { planId: plan.id, status: 'active', billingCycle: cycle },
        create: {
          businessId: tenant.businessId,
          planId: plan.id,
          status: 'active',
          billingCycle: cycle,
        },
      });
      await createAuditLog({
        businessId: tenant.businessId,
        userId: tenant.userId,
        userName: tenant.userName,
        action: 'UPDATE',
        entityType: 'Subscription',
        entityId: sub.id,
        summary: `Subscribed to ${plan.name} (free)`,
      });
      return NextResponse.json({ ok: true, free: true, subscription: sub });
    }

    const result = await prov.createCheckout({
      businessId: tenant.businessId,
      planSlug: plan.slug,
      planName: plan.name,
      amount,
      billingCycle: cycle,
      customerEmail: tenant.userEmail,
    });

    if (!result.configured) {
      return NextResponse.json(
        {
          ok: false,
          configured: false,
          provider: result.provider,
          message: result.message,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({ ...result });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json({ error: 'Failed to start checkout' }, { status: 500 });
  }
}
