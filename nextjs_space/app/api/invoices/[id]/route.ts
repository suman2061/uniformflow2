export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireTenant, isTenantSession } from '@/lib/tenant';
import { checkPermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { invoiceFinancials, invoiceStatusFrom, toNum } from '@/lib/money';
import { z } from 'zod';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;
  const perm = checkPermission(tenant, 'INVOICES', 'VIEW');
  if (perm) return perm;

  const invoice = await prisma.invoice.findFirst({ where: { id, businessId: tenant.businessId }, include: { lines: true, allocations: { include: { payment: true } } } });
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const school = await prisma.school.findUnique({ where: { id: invoice.schoolId }, select: { name: true, billingName: true, billingAddress: true, gstin: true } });
  const fin = await invoiceFinancials(invoice.id, toNum(invoice.grandTotal));
  return NextResponse.json({ invoice: { ...invoice, ...fin, school } });
}

const patchSchema = z.object({ action: z.enum(['cancel', 'edit']), notes: z.string().max(1000).optional().nullable(), dueDate: z.string().optional().nullable() });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;
  const perm = checkPermission(tenant, 'INVOICES', 'EDIT');
  if (perm) return perm;

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  const d = parsed.data;

  const invoice = await prisma.invoice.findFirst({ where: { id, businessId: tenant.businessId } });
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (d.action === 'cancel') {
    const fin = await invoiceFinancials(id, toNum(invoice.grandTotal));
    if (fin.paidAmount > 0) return NextResponse.json({ error: 'Cannot cancel an invoice with payments allocated' }, { status: 400 });
    const updated = await prisma.invoice.update({ where: { id }, data: { status: 'CANCELLED' } });
    await createAuditLog({ businessId: tenant.businessId, userId: tenant.userId, userName: tenant.userName, action: 'EDIT', entityType: 'Invoice', entityId: id, summary: `Invoice ${invoice.invoiceNumber} cancelled` });
    return NextResponse.json({ invoice: updated });
  }

  const updated = await prisma.invoice.update({ where: { id }, data: { notes: d.notes ?? invoice.notes, dueDate: d.dueDate ? new Date(d.dueDate) : invoice.dueDate } });
  await createAuditLog({ businessId: tenant.businessId, userId: tenant.userId, userName: tenant.userName, action: 'EDIT', entityType: 'Invoice', entityId: id, summary: `Invoice ${invoice.invoiceNumber} updated` });
  return NextResponse.json({ invoice: updated });
}
