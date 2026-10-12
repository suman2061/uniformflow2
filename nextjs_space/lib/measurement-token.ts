import crypto from 'crypto';
import { prisma } from '@/lib/db';

/**
 * Secure measurement submission tokens.
 * - We generate a >=32 byte URL-safe random token and show it ONLY once (in the link).
 * - We persist only its SHA-256 hash. The raw token is never stored.
 * - Tokens expire and can be revoked.
 */

export function generateRawToken(): string {
  // 48 bytes -> 64 url-safe chars, unguessable
  return crypto.randomBytes(48).toString('base64url');
}

export function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export function defaultExpiry(days = 30): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

export type ResolveResult =
  | { ok: false; reason: 'NOT_FOUND' | 'EXPIRED' | 'REVOKED' | 'ALREADY_SUBMITTED' }
  | { ok: true; submission: any };

/**
 * Resolve a raw token to its submission. Exposes nothing until validated.
 */
export async function resolveToken(raw: string): Promise<ResolveResult> {
  if (!raw || raw.length < 20) return { ok: false, reason: 'NOT_FOUND' };
  const tokenHash = hashToken(raw);
  const submission = await prisma.measurementSubmission.findUnique({
    where: { tokenHash },
    include: {
      student: { select: { id: true, name: true, permanentId: true, gender: true, uniformCategory: true } },
      school: { select: { id: true, name: true, logoUrl: true } },
      academicYear: { select: { id: true, name: true, measurementWindowStart: true, measurementWindowEnd: true } },
      business: { select: { id: true, name: true, logoUrl: true } },
      enrollment: {
        include: {
          class: { select: { id: true, name: true } },
          division: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!submission) return { ok: false, reason: 'NOT_FOUND' };
  if (submission.tokenRevoked) return { ok: false, reason: 'REVOKED' };
  if (submission.tokenExpiresAt && submission.tokenExpiresAt.getTime() < Date.now()) {
    return { ok: false, reason: 'EXPIRED' };
  }
  if (submission.status === 'SUBMITTED' || submission.status === 'VERIFIED') {
    return { ok: false, reason: 'ALREADY_SUBMITTED' };
  }
  return { ok: true, submission };
}

/**
 * Fetch the products the parent should provide measurements for, scoped strictly
 * to this student's school + academic year + class/division/uniform-category mapping.
 * Exposes no other student's data and no internal pricing/cost.
 */
export async function productsForSubmission(submission: any): Promise<any[]> {
  const mappings = await prisma.schoolProduct.findMany({
    where: {
      businessId: submission.businessId,
      schoolId: submission.schoolId,
      academicYearId: submission.academicYearId,
      isActive: true,
    },
    include: {
      product: {
        select: {
          id: true, name: true, category: true, color: true,
          hasStandardSize: true, sizeChart: true, measurementFields: true, imageUrl: true,
        },
      },
    },
  });

  const classId = submission.enrollment?.classId ?? null;
  const divisionId = submission.enrollment?.divisionId ?? null;
  const category = submission.student?.uniformCategory ?? null;

  const filtered = (mappings ?? []).filter((m: any) => {
    const classIds = Array.isArray(m.applicableClassIds) ? m.applicableClassIds : null;
    const divIds = Array.isArray(m.applicableDivisionIds) ? m.applicableDivisionIds : null;
    const cats = Array.isArray(m.uniformCategories) ? m.uniformCategories : null;
    if (classIds && classIds.length > 0 && classId && !classIds.includes(classId)) return false;
    if (divIds && divIds.length > 0 && divisionId && !divIds.includes(divisionId)) return false;
    if (cats && cats.length > 0 && category && !cats.includes(category)) return false;
    return true;
  });

  return filtered.map((m: any) => ({
    schoolProductId: m.id,
    isMandatory: m.isMandatory,
    product: m.product,
  }));
}
