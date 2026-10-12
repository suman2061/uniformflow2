export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireTenant, isTenantSession } from '@/lib/tenant';
import { checkPermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { generateRawToken, hashToken, defaultExpiry } from '@/lib/measurement-token';
import { z } from 'zod';

async function loadOwned(businessId: string, id: string) {
  const s = await prisma.measurementSubmission.findFirst({ where: { id, businessId } });
  return s;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;
  const perm = checkPermission(tenant, 'MEASUREMENTS', 'VIEW');
  if (perm) return perm;
  const { id } = await params;

  const s = await prisma.measurementSubmission.findFirst({
    where: { id, businessId: tenant.businessId },
    include: {
      student: true,
      school: { select: { name: true } },
      academicYear: { select: { name: true } },
      enrollment: { include: { class: { select: { name: true } }, division: { select: { name: true } } } },
      verifiedBy: { select: { name: true } },
      measurements: { include: { product: { select: { name: true, category: true, hasStandardSize: true, measurementFields: true } } } },
    },
  });
  if (!s) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ submission: s });
}

const actionSchema = z.object({
  action: z.enum(['resend', 'revoke', 'close', 'verify', 'reject', 'request_resubmission', 'reminder']),
  reason: z.string().max(500).optional().nullable(),
  expiryDays: z.number().int().min(1).max(365).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;
  const { id } = await params;

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  const { action, reason, expiryDays } = parsed.data;

  const s = await loadOwned(tenant.businessId, id);
  if (!s) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const needsApprove = ['verify', 'reject', 'request_resubmission'].includes(action);
  const perm = checkPermission(tenant, 'MEASUREMENTS', needsApprove ? 'APPROVE' : 'EDIT');
  if (perm) return perm;

  let data: any = {};
  let rawToken: string | null = null;
  let summary = '';

  if (action === 'revoke') {
    data = { tokenRevoked: true };
    summary = 'Measurement link revoked';
  } else if (action === 'close') {
    data = { status: 'NOT_SUBMITTED', tokenRevoked: true };
    summary = 'Measurement window closed for student';
  } else if (action === 'resend' || action === 'request_resubmission') {
    const raw = generateRawToken();
    rawToken = raw;
    data = {
      tokenHash: hashToken(raw),
      tokenExpiresAt: defaultExpiry(expiryDays ?? 30),
      tokenRevoked: false,
      status: action === 'request_resubmission' ? 'RESUBMISSION_REQUIRED' : 'LINK_SENT',
      lastSentAt: new Date(),
      sendCount: { increment: 1 },
      ...(action === 'request_resubmission' ? { rejectionReason: reason ?? null } : {}),
    };
    summary = action === 'request_resubmission' ? 'Requested resubmission (new link issued)' : 'Measurement link resent (new link issued)';
  } else if (action === 'reminder') {
    data = { lastSentAt: new Date(), sendCount: { increment: 1 } };
    summary = 'Reminder logged (no external message sent)';
  } else if (action === 'verify') {
    data = { status: 'VERIFIED', verifiedById: tenant.userId, verifiedAt: new Date(), rejectionReason: null };
    summary = 'Measurement submission verified';
  } else if (action === 'reject') {
    data = { status: 'REJECTED', rejectionReason: reason ?? 'Rejected' };
    summary = `Measurement submission rejected${reason ? ': ' + reason : ''}`;
  }

  const updated = await prisma.measurementSubmission.update({ where: { id }, data });

  await createAuditLog({
    businessId: tenant.businessId,
    userId: tenant.userId,
    userName: tenant.userName,
    action: needsApprove ? 'APPROVE' : 'EDIT',
    entityType: 'MeasurementSubmission',
    entityId: id,
    summary,
  });

  return NextResponse.json({ submission: updated, token: rawToken });
}
