export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getProvider, ProviderName } from '@/lib/billing/provider';

// Gateway webhook receiver. Verifies the signature via the provider, then
// records a BillingEvent (idempotent on externalId) and upgrades the
// subscription. A payment is ONLY honoured through this verified path.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  const prov = getProvider(provider as ProviderName);
  if (!prov) return NextResponse.json({ error: 'Unknown provider' }, { status: 404 });

  const rawBody = await req.text();
  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => {
    headers[k] = v;
  });

  const verified = await prov.verifyWebhook(rawBody, headers);
  if (!verified.configured) {
    return NextResponse.json({ error: 'Provider not configured' }, { status: 503 });
  }
  if (!verified.ok || !verified.eventId) {
    return NextResponse.json({ error: verified.message ?? 'Verification failed' }, { status: 400 });
  }

  // Idempotency: skip if we've already processed this external event.
  const existing = await prisma.billingEvent.findUnique({
    where: { externalId: verified.eventId },
  });
  if (existing) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  await prisma.billingEvent.create({
    data: {
      businessId: verified.businessId ?? null,
      provider,
      eventType: verified.eventType ?? 'unknown',
      externalId: verified.eventId,
      payload: rawBody ? (JSON.parse(rawBody) as any) : undefined,
    },
  });

  // A full implementation would, based on verified.eventType, update the
  // relevant subscription's status/currentPeriodEnd here.

  return NextResponse.json({ ok: true });
}
