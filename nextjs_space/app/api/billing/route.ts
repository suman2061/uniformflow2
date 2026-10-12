export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireTenant, isTenantSession } from '@/lib/tenant';
import { getSubscription, getUsageSnapshot } from '@/lib/subscription';
import { getProviderStatus } from '@/lib/billing/provider';

// Tenant billing overview: current subscription, usage vs limits, available plans.
export async function GET() {
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;

  const [subscription, usage, plans] = await Promise.all([
    getSubscription(tenant.businessId),
    getUsageSnapshot(tenant.businessId),
    prisma.plan.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
  ]);

  return NextResponse.json({
    subscription,
    usage,
    plans,
    providers: getProviderStatus(),
  });
}
