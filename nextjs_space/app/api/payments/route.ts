export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireTenant, isTenantSession } from '@/lib/tenant';
import { checkPermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { invoiceFinancials, invoiceStatusFrom, toNum } from '@/lib/money';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;
  const perm = checkPermission(tenant, 'PAYMENTS', 'VIEW');
  if (perm) return perm;

  const url = new URL(req.url);
  const schoolId = url.searchParams.get('schoolId') ?? '';
  const where: any = { businessId: tenant.businessId };
  if (schoolId) where.schoolId = schoolId;

  const payments = await prisma.payment.findMany({ where, include: { allocations: true }, orderBy: { createdAt: 'desc' }, take: 1000 });
  const schoolIds = Array.from(new Set(payments.map((p) => p.schoolId)));
  const schools = await prisma.school.findMany({ where: { id: { in: schoolIds } }, select: { id: true, name: true } });
  const sm = Object.fromEntries(schools.map((s) => [s.id, s.name]));
  return NextResponse.json({ payments: payments.map((p) => ({ ...p, schoolName: sm[p.schoolId] ?? '' })) });
}

const allocSchema = z.object({ invoiceId: z.string().optional().nullable(), studentId: z.string().optional().nullable(), amount: z.number().min(0) });

const createSchema = z.object({
  schoolId: z.string().min(1),
  invoiceId: z.string().optional().nullable(),
  type: z.enum(['ADVANCE', 'PARTIAL', 'FULL', 'REFUND', 'ADJUSTMENT']).default('PARTIAL'),
  method: z.enum(['CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'GATEWAY']).default('CASH'),
  amount: z.number().min(0.01),
  transactionRef: z.string().optional().nullable(),
  paymentDate: z.string().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  allocations: z.array(allocSchema).optional(),
});

export async function POST(req: NextRequest) {
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;
  const perm = checkPermission(tenant, 'PAYMENTS', 'CREATE');
  if (perm) return perm;

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  const d = parsed.data;

  const school = await prisma.school.findFirst({ where: { id: d.schoolId, businessId: tenant.businessId } });
  if (!school) return NextResponse.json({ error: 'School not found' }, { status: 404 });

  // Default allocation: whole amount to the given invoice if provided.
  let allocations = d.allocations ?? [];
  if (allocations.length === 0 && d.invoiceId) allocations = [{ invoiceId: d.invoiceId, studentId: null, amount: d.amount }];
  const allocSum = allocations.reduce((s, a) => s + a.amount, 0);
  if (allocations.length > 0 && allocSum - 0.009 > d.amount) return NextResponse.json({ error: 'Allocations exceed payment amount' }, { status: 400 });

  // Validate invoice ownership for each allocation.
  for (const a of allocations) {
    if (a.invoiceId) {
      const inv = await prisma.invoice.findFirst({ where: { id: a.invoiceId, businessId: tenant.businessId } });
      if (!inv) return NextResponse.json({ error: 'Invoice not found for allocation' }, { status: 404 });
    }
  }

  const affectedInvoiceIds = new Set<string>();
  const payment = await prisma.$transaction(async (tx) => {
    const p = await tx.payment.create({
      data: {
        businessId: tenant.businessId, schoolId: d.schoolId, invoiceId: d.invoiceId || null, type: d.type, method: d.method,
        amount: d.amount, transactionRef: d.transactionRef ?? null, paymentDate: d.paymentDate ? new Date(d.paymentDate) : new Date(),
        notes: d.notes ?? null, receivedById: tenant.userId, isDemoData: school.isDemoData,
        allocations: { create: allocations.map((a) => ({ businessId: tenant.businessId, invoiceId: a.invoiceId || null, studentId: a.studentId || null, amount: a.amount })) },
      },
      include: { allocations: true },
    });
    for (const a of allocations) if (a.invoiceId) affectedInvoiceIds.add(a.invoiceId);
    return p;
  });

  // Recompute affected invoice statuses from allocations (money rule: derived).
  for (const invId of affectedInvoiceIds) {
    const inv = await prisma.invoice.findUnique({ where: { id: invId } });
    if (!inv) continue;
    const fin = await invoiceFinancials(invId, toNum(inv.grandTotal));
    const status = invoiceStatusFrom(fin.paidAmount, toNum(inv.grandTotal), inv.status);
    if (status !== inv.status) await prisma.invoice.update({ where: { id: invId }, data: { status } });
  }

  await createAuditLog({ businessId: tenant.businessId, userId: tenant.userId, userName: tenant.userName, action: 'CREATE', entityType: 'Payment', entityId: payment.id, summary: `Payment ${d.amount} (${d.method}) received from ${school.name}` });
  return NextResponse.json({ payment }, { status: 201 });
}
