import { prisma } from '@/lib/db';

/** Format a number as INR currency string. */
export function formatINR(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value);
}

function toNum(v: any): number {
  if (v === null || v === undefined) return 0;
  return typeof v === 'number' ? v : Number(v.toString());
}

export interface LineInput {
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxRate?: number;
}

/** Compute a single line's tax amount and total. */
export function computeLine(line: LineInput) {
  const gross = line.quantity * line.unitPrice;
  const discount = line.discount ?? 0;
  const taxable = Math.max(0, gross - discount);
  const taxRate = line.taxRate ?? 0;
  const taxAmount = +(taxable * (taxRate / 100)).toFixed(2);
  const lineTotal = +(taxable + taxAmount).toFixed(2);
  return { taxAmount, lineTotal, taxable };
}

/** Compute document totals from a set of lines. */
export function computeTotals(lines: LineInput[]) {
  let subtotal = 0;
  let discountTotal = 0;
  let taxTotal = 0;
  let grandTotal = 0;
  for (const l of lines) {
    const gross = l.quantity * l.unitPrice;
    const { taxAmount, lineTotal } = computeLine(l);
    subtotal += gross;
    discountTotal += l.discount ?? 0;
    taxTotal += taxAmount;
    grandTotal += lineTotal;
  }
  return {
    subtotal: +subtotal.toFixed(2),
    discountTotal: +discountTotal.toFixed(2),
    taxTotal: +taxTotal.toFixed(2),
    grandTotal: +grandTotal.toFixed(2),
  };
}

/**
 * Compute paid amount and outstanding for an invoice from its allocations.
 * Money rule: paidAmount & outstanding are ALWAYS derived, never manual.
 */
export async function invoiceFinancials(invoiceId: string, grandTotal: number) {
  const allocations = await prisma.paymentAllocation.findMany({
    where: { invoiceId },
    select: { amount: true },
  });
  const paidAmount = +allocations.reduce((s, a) => s + toNum(a.amount), 0).toFixed(2);
  const outstanding = +(grandTotal - paidAmount).toFixed(2);
  return { paidAmount, outstanding };
}

/** Derive invoice status from totals. */
export function invoiceStatusFrom(paidAmount: number, grandTotal: number, current: string): string {
  if (current === 'CANCELLED' || current === 'DRAFT') return current;
  if (paidAmount <= 0) return 'ISSUED';
  if (paidAmount + 0.009 < grandTotal) return 'PARTIALLY_PAID';
  return 'PAID';
}

export { toNum };
