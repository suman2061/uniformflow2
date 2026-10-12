export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireTenant, isTenantSession } from '@/lib/tenant';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;

  const notifications = await prisma.notification.findMany({
    where: { businessId: tenant.businessId, OR: [{ recipientUserId: tenant.userId }, { recipientUserId: null }] },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  const unread = notifications.filter((n) => !n.readAt).length;
  return NextResponse.json({ notifications, unread });
}

const patchSchema = z.object({ action: z.enum(['markRead', 'markAllRead']), id: z.string().optional() });

export async function PATCH(req: NextRequest) {
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  const d = parsed.data;

  if (d.action === 'markAllRead') {
    await prisma.notification.updateMany({ where: { businessId: tenant.businessId, OR: [{ recipientUserId: tenant.userId }, { recipientUserId: null }], readAt: null }, data: { readAt: new Date() } });
    return NextResponse.json({ ok: true });
  }
  if (!d.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await prisma.notification.updateMany({ where: { id: d.id, businessId: tenant.businessId }, data: { readAt: new Date() } });
  return NextResponse.json({ ok: true });
}
