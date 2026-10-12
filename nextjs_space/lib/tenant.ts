import { auth } from '@/auth';
import { NextResponse } from 'next/server';

export interface TenantSession {
  userId: string;
  userName: string;
  userEmail: string;
  businessId: string;
  role: string;
}

export interface SuperAdminSession {
  userId: string;
  userName: string;
  userEmail: string;
  role: 'SUPER_ADMIN';
}

/**
 * Require an authenticated session with a valid business tenant.
 * Returns 401 if unauthenticated, 403 if no business context.
 * NEVER trust client-supplied businessId.
 */
export async function requireTenant(): Promise<TenantSession | NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!session?.user?.businessId) {
    return NextResponse.json({ error: 'No business context' }, { status: 403 });
  }
  return {
    userId: session.user.id,
    userName: session.user.name ?? '',
    userEmail: session.user.email ?? '',
    businessId: session.user.businessId,
    role: session.user.role ?? '',
  };
}

/**
 * Require a Super Admin session.
 */
export async function requireSuperAdmin(): Promise<SuperAdminSession | NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (session?.user?.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return {
    userId: session.user.id,
    userName: session.user.name ?? '',
    userEmail: session.user.email ?? '',
    role: 'SUPER_ADMIN',
  };
}

export function isTenantSession(result: TenantSession | NextResponse): result is TenantSession {
  return !(result instanceof NextResponse);
}

export function isSuperAdminSession(result: SuperAdminSession | NextResponse): result is SuperAdminSession {
  return !(result instanceof NextResponse);
}
