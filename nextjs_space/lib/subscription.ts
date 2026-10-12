import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export type LimitedResource = 'schools' | 'users' | 'students';

export interface UsageSnapshot {
  schools: { used: number; limit: number };
  users: { used: number; limit: number };
  students: { used: number; limit: number };
  storageMb: { used: number; limit: number };
}

/**
 * Fetch a business subscription with its plan. Returns null if none exists.
 */
export async function getSubscription(businessId: string) {
  return prisma.subscription.findUnique({
    where: { businessId },
    include: { plan: true },
  });
}

/**
 * Count current usage for a business across limited resources.
 */
export async function countUsage(businessId: string) {
  const [schools, users, students] = await Promise.all([
    prisma.school.count({ where: { businessId } }),
    prisma.user.count({ where: { businessId } }),
    prisma.student.count({ where: { businessId } }),
  ]);
  return { schools, users, students };
}

/**
 * Build a full usage snapshot (used vs limit) for billing UI.
 * A limit of 0 means unlimited.
 */
export async function getUsageSnapshot(businessId: string): Promise<UsageSnapshot> {
  const [sub, usage] = await Promise.all([
    getSubscription(businessId),
    countUsage(businessId),
  ]);
  const plan = sub?.plan;
  return {
    schools: { used: usage.schools, limit: plan?.maxSchools ?? 0 },
    users: { used: usage.users, limit: plan?.maxUsers ?? 0 },
    students: { used: usage.students, limit: plan?.maxStudents ?? 0 },
    storageMb: { used: 0, limit: plan?.storageMb ?? 0 },
  };
}

function isSubscriptionActive(status: string): boolean {
  // trial and active allow writes; suspended/cancelled/expired block
  return status === 'trial' || status === 'active';
}

/**
 * Enforce a plan limit before creating a resource.
 * Returns a NextResponse (402/403) if the write should be blocked, else null.
 *
 * Rules:
 *  - No subscription at all: allow (business not yet onboarded to billing).
 *  - Suspended / cancelled / expired subscription: block all writes (402).
 *  - limit of 0 = unlimited.
 *  - Trial that has passed trialEndsAt: treated as expired → block.
 */
export async function enforceLimit(
  businessId: string,
  resource: LimitedResource
): Promise<NextResponse | null> {
  const sub = await getSubscription(businessId);

  // No subscription configured — do not block (billing not enabled for this tenant yet).
  if (!sub) return null;

  // Trial expiry check
  const now = new Date();
  if (
    sub.status === 'trial' &&
    sub.trialEndsAt &&
    sub.trialEndsAt.getTime() < now.getTime()
  ) {
    return NextResponse.json(
      {
        error: 'Your free trial has ended. Please choose a plan to continue adding data.',
        code: 'TRIAL_EXPIRED',
      },
      { status: 402 }
    );
  }

  if (!isSubscriptionActive(sub.status)) {
    return NextResponse.json(
      {
        error: 'Your subscription is not active. Please update your billing to continue.',
        code: 'SUBSCRIPTION_INACTIVE',
      },
      { status: 402 }
    );
  }

  const plan = sub.plan;
  if (!plan) return null;

  const limitMap: Record<LimitedResource, number> = {
    schools: plan.maxSchools,
    users: plan.maxUsers,
    students: plan.maxStudents,
  };
  const limit = limitMap[resource];

  // 0 = unlimited
  if (!limit || limit <= 0) return null;

  const usage = await countUsage(businessId);
  const used = usage[resource];

  if (used >= limit) {
    const label =
      resource === 'schools' ? 'schools' : resource === 'users' ? 'team members' : 'students';
    return NextResponse.json(
      {
        error: `You've reached your plan limit of ${limit} ${label}. Upgrade your plan to add more.`,
        code: 'LIMIT_REACHED',
        resource,
        limit,
        used,
      },
      { status: 402 }
    );
  }

  return null;
}
