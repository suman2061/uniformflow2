export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSuperAdmin, isSuperAdminSession } from '@/lib/tenant';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sa = await requireSuperAdmin();
  if (!isSuperAdminSession(sa)) return sa;
  const { id } = await params;

  try {
    const body = await req.json();
    const data: any = {};
    const fields = [
      'name', 'slug', 'monthlyPrice', 'annualPrice', 'trialDays',
      'maxSchools', 'maxUsers', 'maxStudents', 'storageMb', 'features', 'sortOrder', 'active',
    ];
    for (const f of fields) {
      if (body[f] === undefined) continue;
      if (['monthlyPrice', 'annualPrice'].includes(f)) data[f] = Number(body[f]) || 0;
      else if (['trialDays', 'maxSchools', 'maxUsers', 'maxStudents', 'storageMb', 'sortOrder'].includes(f)) data[f] = Number(body[f]) || 0;
      else if (f === 'slug') data[f] = (body[f] as string).toLowerCase().trim();
      else data[f] = body[f];
    }

    const plan = await prisma.plan.update({ where: { id }, data });
    return NextResponse.json({ plan });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'A plan with that name or slug already exists' }, { status: 409 });
    }
    console.error('Update plan error:', error);
    return NextResponse.json({ error: 'Failed to update plan' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sa = await requireSuperAdmin();
  if (!isSuperAdminSession(sa)) return sa;
  const { id } = await params;

  const inUse = await prisma.subscription.count({ where: { planId: id } });
  if (inUse > 0) {
    // Soft-disable instead of deleting a plan that businesses are on.
    const plan = await prisma.plan.update({ where: { id }, data: { active: false } });
    return NextResponse.json({ plan, softDisabled: true });
  }

  await prisma.plan.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
