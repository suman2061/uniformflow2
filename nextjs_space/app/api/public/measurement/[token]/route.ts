export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { resolveToken, productsForSubmission } from '@/lib/measurement-token';
import { z } from 'zod';

// GET: resolve a public measurement link. Exposes only this student's authorized data.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await resolveToken(token);
  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason }, { status: 200 });
  }
  const s = result.submission;
  const products = await productsForSubmission(s);

  return NextResponse.json({
    ok: true,
    status: s.status,
    business: { name: s.business?.name, logoUrl: s.business?.logoUrl ?? null },
    school: { name: s.school?.name },
    academicYear: { name: s.academicYear?.name },
    student: {
      name: s.student?.name,
      permanentId: s.student?.permanentId,
      gender: s.student?.gender ?? null,
      uniformCategory: s.student?.uniformCategory ?? null,
    },
    enrollment: {
      className: s.enrollment?.class?.name ?? null,
      divisionName: s.enrollment?.division?.name ?? null,
      rollNumber: s.enrollment?.rollNumber ?? null,
    },
    products,
    existing: s.submissionData ?? null,
  });
}

const submitSchema = z.object({
  items: z.array(z.object({
    productId: z.string().min(1),
    mode: z.enum(['standard', 'manual']),
    size: z.string().optional().nullable(),
    fields: z.record(z.any()).optional().nullable(),
    notes: z.string().max(500).optional().nullable(),
  })).min(1),
  parentConfirmed: z.boolean(),
});

// POST: submit measurements for this student only.
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await resolveToken(token);
  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason }, { status: 200 });
  }
  const s = result.submission;

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid submission', details: parsed.error.flatten() }, { status: 400 });
  }
  if (!parsed.data.parentConfirmed) {
    return NextResponse.json({ error: 'Please confirm the student details before submitting.' }, { status: 400 });
  }

  // Validate products belong to this submission's authorized set.
  const allowed = await productsForSubmission(s);
  const allowedIds = new Set((allowed ?? []).map((a: any) => a.product.id));
  for (const item of parsed.data.items) {
    if (!allowedIds.has(item.productId)) {
      return NextResponse.json({ error: 'Invalid product in submission' }, { status: 400 });
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.measurementSubmission.update({
      where: { id: s.id },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        submissionData: parsed.data.items as any,
      },
    });
    // Create pending (unverified) Measurement rows from the submission (source SELF_SERVICE).
    for (const item of parsed.data.items) {
      await tx.measurement.upsert({
        where: {
          businessId_studentId_academicYearId_productId: {
            businessId: s.businessId,
            studentId: s.studentId,
            academicYearId: s.academicYearId,
            productId: item.productId,
          },
        },
        update: {
          source: 'SELF_SERVICE',
          size: item.mode === 'standard' ? (item.size ?? null) : null,
          fields: item.mode === 'manual' ? (item.fields ?? {}) : undefined,
          notes: item.notes ?? null,
          submissionId: s.id,
          isDemoData: s.isDemoData,
        },
        create: {
          businessId: s.businessId,
          studentId: s.studentId,
          academicYearId: s.academicYearId,
          productId: item.productId,
          submissionId: s.id,
          source: 'SELF_SERVICE',
          size: item.mode === 'standard' ? (item.size ?? null) : null,
          fields: item.mode === 'manual' ? (item.fields ?? {}) : undefined,
          notes: item.notes ?? null,
          isDemoData: s.isDemoData,
        },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
