export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireTenant, isTenantSession } from '@/lib/tenant';
import { checkPermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';
import { nextInvoiceNumber } from '@/lib/sequence';
import { computeLine, computeTotals, invoiceFinancials, toNum } from '@/lib/money';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;
  const perm = checkPermission(tenant, 'INVOICES', 'VIEW');
  if (perm) return perm;

  const url = new URL(req.url);
  const schoolId = url.searchParams.get('schoolId') ?? '';
  const status = url.searchParams.get('status') ?? '';
  const where: any = { businessId: tenant.businessId };
  if (schoolId) where.schoolId = schoolId;
  if (status) where.status = status;

  const invoices = await prisma.invoice.findMany({ where, include: { allocations: { select: { amount: true } } }, orderBy: { createdAt: 'desc' }, take: 1000 });
  const schoolIds = Array.from(new Set(invoices.map((i) => i.schoolId)));
  const schools = await prisma.school.findMany({ where: { id: { in: schoolIds } }, select: { id: true, name: true } });
  const sm = Object.fromEntries(schools.map((s) => [s.id, s.name]));

  const data = invoices.map((inv) => {
    const paidAmount = +inv.allocations.reduce((s, a) => s + toNum(a.amount), 0).toFixed(2);
    const grand = toNum(inv.grandTotal);
    return { ...inv, allocations: undefined, schoolName: sm[inv.schoolId] ?? '', paidAmount, outstanding: +(grand - paidAmount).toFixed(2) };
  });
  return NextResponse.json({ invoices: data });
}

const lineSchema = z.object({
  description: z.string().min(1),
  productId: z.string().optional().nullable(),
  quantity: z.number().int().min(1),
  unitPrice: z.number().min(0),
  discount: z.number().min(0).optional(),
  taxRate: z.number().min(0).max(100).optional(),
});

const createSchema = z.object({
  schoolId: z.string().min(1),
  academicYearId: z.string().min(1),
  dueDate: z.string().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  fromOrderIds: z.array(z.string()).optional(),
  lines: z.array(lineSchema).optional(),
});

export async function POST(req: NextRequest) {
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;
  const perm = checkPermission(tenant, 'INVOICES', 'CREATE');
  if (perm) return perm;

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  const d = parsed.data;

  const school = await prisma.school.findFirst({ where: { id: d.schoolId, businessId: tenant.businessId } });
  if (!school) return NextResponse.json({ error: 'School not found' }, { status: 404 });

  // Build lines either from explicit input or derived from selected orders.
  let lines = d.lines ?? [];
  if ((!lines || lines.length === 0) && d.fromOrderIds && d.fromOrderIds.length > 0) {
    const orders = await prisma.order.findMany({ where: { id: { in: d.fromOrderIds }, businessId: tenant.businessId, schoolId: d.schoolId }, include: { lines: true } });
    lines = [];
    for (const o of orders) {
      for (const l of o.lines) {
        const net = Math.max(0, (l.approvedQty || l.quantity) - l.cancelledQty);
        if (net <= 0) continue;
        lines.push({ description: `${o.orderNumber} — ${l.productName}${l.size ? ' / ' + l.size : ''}`, productId: l.productId, quantity: net, unitPrice: toNum(l.unitPrice), discount: toNum(l.discount), taxRate: toNum(l.taxRate) });
      }
    }
  }
  if (!lines || lines.length === 0) return NextResponse.json({ error: 'No invoice lines' }, { status: 400 });

  const totals = computeTotals(lines.map((l) => ({ quantity: l.quantity, unitPrice: l.unitPrice, discount: l.discount, taxRate: l.taxRate })));
  const invoiceNumber = await nextInvoiceNumber(tenant.businessId);

  const invoice = await prisma.invoice.create({
    data: {
      businessId: tenant.businessId, invoiceNumber, schoolId: d.schoolId, academicYearId: d.academicYearId,
      dueDate: d.dueDate ? new Date(d.dueDate) : null, notes: d.notes ?? null, status: 'ISSUED',
      subtotal: totals.subtotal, discountTotal: totals.discountTotal, taxTotal: totals.taxTotal, grandTotal: totals.grandTotal,
      createdById: tenant.userId, isDemoData: school.isDemoData,
      lines: { create: lines.map((l) => { const { taxAmount, lineTotal } = computeLine({ quantity: l.quantity, unitPrice: l.unitPrice, discount: l.discount, taxRate: l.taxRate }); return { businessId: tenant.businessId, description: l.description, productId: l.productId ?? null, quantity: l.quantity, unitPrice: l.unitPrice, discount: l.discount ?? 0, taxRate: l.taxRate ?? 0, taxAmount, lineTotal, isDemoData: school.isDemoData }; }) },
    },
    include: { lines: true },
  });

  await createAuditLog({ businessId: tenant.businessId, userId: tenant.userId, userName: tenant.userName, action: 'CREATE', entityType: 'Invoice', entityId: invoice.id, summary: `Invoice ${invoiceNumber} for ${school.name} (${totals.grandTotal})` });
  const fin = await invoiceFinancials(invoice.id, totals.grandTotal);
  return NextResponse.json({ invoice: { ...invoice, ...fin } }, { status: 201 });
}
