import { prisma } from '@/lib/db';

/**
 * Atomic sequence generators for Phase 3 business documents.
 * Each uses a dedicated counter on the Business row, incremented atomically.
 */

async function nextSeq(
  businessId: string,
  field: 'nextOrderSeq' | 'nextPoSeq' | 'nextChallanSeq' | 'nextInvoiceSeq'
): Promise<number> {
  const updated = await prisma.business.update({
    where: { id: businessId },
    data: { [field]: { increment: 1 } },
    select: { [field]: true } as any,
  });
  return (updated as any)?.[field] ?? 1;
}

function yearFragment(): string {
  const now = new Date();
  const y = now.getFullYear();
  // Indian financial year style: 2026-27
  const month = now.getMonth(); // 0-based
  const fyStart = month >= 3 ? y : y - 1; // FY starts April
  const fyEnd = (fyStart + 1) % 100;
  return `${fyStart}-${String(fyEnd).padStart(2, '0')}`;
}

export async function nextOrderNumber(businessId: string): Promise<string> {
  const seq = await nextSeq(businessId, 'nextOrderSeq');
  return `ORD-${yearFragment()}-${String(seq).padStart(5, '0')}`;
}

export async function nextPoNumber(businessId: string): Promise<string> {
  const seq = await nextSeq(businessId, 'nextPoSeq');
  return `PO-${yearFragment()}-${String(seq).padStart(5, '0')}`;
}

export async function nextChallanNumber(businessId: string): Promise<string> {
  const seq = await nextSeq(businessId, 'nextChallanSeq');
  return `DC-${yearFragment()}-${String(seq).padStart(5, '0')}`;
}

export async function nextInvoiceNumber(businessId: string): Promise<string> {
  const seq = await nextSeq(businessId, 'nextInvoiceSeq');
  return `INV-${yearFragment()}-${String(seq).padStart(5, '0')}`;
}
