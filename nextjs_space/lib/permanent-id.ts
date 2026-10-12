import { prisma } from '@/lib/db';

/**
 * Atomically generate the next permanent student ID for a business.
 * Format: UF-000001, UF-000002, ...
 */
export async function generatePermanentId(businessId: string): Promise<string> {
  const updated = await prisma.business.update({
    where: { id: businessId },
    data: { nextStudentSeq: { increment: 1 } },
    select: { nextStudentSeq: true },
  });
  const seq = updated?.nextStudentSeq ?? 1;
  return `UF-${String(seq).padStart(6, '0')}`;
}

/**
 * Generate multiple permanent IDs in batch.
 */
export async function generatePermanentIds(
  businessId: string,
  count: number
): Promise<string[]> {
  if (count <= 0) return [];
  const updated = await prisma.business.update({
    where: { id: businessId },
    data: { nextStudentSeq: { increment: count } },
    select: { nextStudentSeq: true },
  });
  const endSeq = updated?.nextStudentSeq ?? count;
  const startSeq = endSeq - count + 1;
  const ids: string[] = [];
  for (let i = startSeq; i <= endSeq; i++) {
    ids.push(`UF-${String(i).padStart(6, '0')}`);
  }
  return ids;
}
