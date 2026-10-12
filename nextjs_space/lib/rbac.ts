import { NextResponse } from 'next/server';
import { TenantSession } from './tenant';

export type Module =
  | 'DASHBOARD'
  | 'SCHOOLS'
  | 'ACADEMIC_YEARS'
  | 'STUDENTS'
  | 'PRODUCTS'
  | 'SCHOOL_PRODUCTS'
  | 'USERS'
  | 'AUDIT_LOG'
  | 'REPORTS'
  | 'MEASUREMENTS'
  | 'ORDERS'
  | 'PROCUREMENT'
  | 'PRODUCTION'
  | 'DELIVERIES'
  | 'INVOICES'
  | 'PAYMENTS'
  | 'SUBSCRIPTION'
  | 'NOTIFICATIONS';

export type Action = 'VIEW' | 'CREATE' | 'EDIT' | 'DELETE' | 'APPROVE' | 'EXPORT' | 'PRINT' | 'IMPORT';

const ALL_ACTIONS: Action[] = ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'APPROVE', 'EXPORT', 'PRINT', 'IMPORT'];
const VIEW_ONLY: Action[] = ['VIEW'];

const ALL_MODULES: Module[] = [
  'DASHBOARD', 'SCHOOLS', 'ACADEMIC_YEARS', 'STUDENTS', 'PRODUCTS', 'SCHOOL_PRODUCTS',
  'USERS', 'AUDIT_LOG', 'REPORTS', 'MEASUREMENTS', 'ORDERS', 'PROCUREMENT', 'PRODUCTION',
  'DELIVERIES', 'INVOICES', 'PAYMENTS', 'SUBSCRIPTION', 'NOTIFICATIONS',
];

type RolePermissionMap = Record<string, Record<string, Action[]>>;

const ROLE_DEFAULTS: RolePermissionMap = {
  BUSINESS_OWNER: Object.fromEntries(ALL_MODULES.map((m) => [m, ALL_ACTIONS])),
  BUSINESS_ADMIN: {
    DASHBOARD: ALL_ACTIONS,
    SCHOOLS: ALL_ACTIONS,
    ACADEMIC_YEARS: ALL_ACTIONS,
    STUDENTS: ALL_ACTIONS,
    PRODUCTS: ALL_ACTIONS,
    SCHOOL_PRODUCTS: ALL_ACTIONS,
    USERS: ['VIEW'],
    AUDIT_LOG: VIEW_ONLY,
    REPORTS: ALL_ACTIONS,
    MEASUREMENTS: ALL_ACTIONS,
    ORDERS: ALL_ACTIONS,
    PROCUREMENT: ALL_ACTIONS,
    PRODUCTION: ALL_ACTIONS,
    DELIVERIES: ALL_ACTIONS,
    INVOICES: ALL_ACTIONS,
    PAYMENTS: ALL_ACTIONS,
    SUBSCRIPTION: VIEW_ONLY,
    NOTIFICATIONS: ALL_ACTIONS,
  },
  OPERATIONS_MANAGER: {
    DASHBOARD: VIEW_ONLY,
    SCHOOLS: VIEW_ONLY,
    ACADEMIC_YEARS: VIEW_ONLY,
    STUDENTS: VIEW_ONLY,
    PRODUCTS: ['VIEW', 'CREATE', 'EDIT', 'EXPORT'],
    SCHOOL_PRODUCTS: ['VIEW', 'CREATE', 'EDIT', 'EXPORT'],
    REPORTS: ['VIEW', 'EXPORT', 'PRINT'],
    MEASUREMENTS: ['VIEW', 'CREATE', 'EDIT', 'APPROVE', 'EXPORT', 'PRINT'],
    ORDERS: ['VIEW', 'CREATE', 'EDIT', 'APPROVE', 'EXPORT', 'PRINT'],
    PROCUREMENT: ALL_ACTIONS,
    PRODUCTION: ALL_ACTIONS,
    DELIVERIES: ['VIEW', 'CREATE', 'EDIT', 'APPROVE', 'EXPORT', 'PRINT'],
    INVOICES: VIEW_ONLY,
    PAYMENTS: VIEW_ONLY,
    NOTIFICATIONS: ['VIEW', 'CREATE'],
  },
  ACCOUNTS_MANAGER: {
    DASHBOARD: VIEW_ONLY,
    SCHOOLS: VIEW_ONLY,
    STUDENTS: VIEW_ONLY,
    REPORTS: ['VIEW', 'EXPORT', 'PRINT'],
    MEASUREMENTS: VIEW_ONLY,
    ORDERS: ['VIEW', 'EXPORT', 'PRINT'],
    DELIVERIES: VIEW_ONLY,
    INVOICES: ALL_ACTIONS,
    PAYMENTS: ALL_ACTIONS,
    NOTIFICATIONS: ['VIEW', 'CREATE'],
  },
  DATA_ENTRY_OPERATOR: {
    DASHBOARD: VIEW_ONLY,
    SCHOOLS: ['VIEW', 'CREATE', 'EDIT'],
    ACADEMIC_YEARS: ['VIEW', 'CREATE', 'EDIT'],
    STUDENTS: ['VIEW', 'CREATE', 'EDIT', 'IMPORT'],
    PRODUCTS: VIEW_ONLY,
    SCHOOL_PRODUCTS: VIEW_ONLY,
    MEASUREMENTS: ['VIEW', 'CREATE', 'EDIT'],
    ORDERS: ['VIEW', 'CREATE', 'EDIT'],
  },
  READ_ONLY: {
    DASHBOARD: VIEW_ONLY,
    SCHOOLS: VIEW_ONLY,
    ACADEMIC_YEARS: VIEW_ONLY,
    STUDENTS: VIEW_ONLY,
    PRODUCTS: VIEW_ONLY,
    SCHOOL_PRODUCTS: VIEW_ONLY,
    REPORTS: VIEW_ONLY,
    MEASUREMENTS: VIEW_ONLY,
    ORDERS: VIEW_ONLY,
    PROCUREMENT: VIEW_ONLY,
    PRODUCTION: VIEW_ONLY,
    DELIVERIES: VIEW_ONLY,
    INVOICES: VIEW_ONLY,
    PAYMENTS: VIEW_ONLY,
    NOTIFICATIONS: VIEW_ONLY,
  },
};

/**
 * Check if a user with the given role (and optional custom permissions) has access
 * to a specific module+action.
 */
export function hasPermission(
  role: string,
  module: Module,
  action: Action,
  customPermissions?: Record<string, string[]> | null
): boolean {
  if (role === 'SUPER_ADMIN') return false; // Super admin uses platform routes
  if (role === 'BUSINESS_OWNER') return true; // Full access

  // Check custom per-user overrides first
  if (customPermissions && typeof customPermissions === 'object') {
    const modulePerms = customPermissions[module];
    if (Array.isArray(modulePerms)) {
      return modulePerms.includes(action);
    }
  }

  // Fall back to role defaults
  const rolePerms = ROLE_DEFAULTS[role];
  if (!rolePerms) return false;
  const modulePerms = rolePerms[module];
  if (!modulePerms) return false;
  return modulePerms.includes(action);
}

/**
 * API route guard: checks permission and returns 403 if denied.
 */
export function checkPermission(
  tenant: TenantSession,
  module: Module,
  action: Action,
  customPermissions?: Record<string, string[]> | null
): NextResponse | null {
  if (!hasPermission(tenant.role, module, action, customPermissions)) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }
  return null;
}

/**
 * Get all modules+actions available for a role.
 */
export function getPermissionsForRole(role: string): Record<string, Action[]> {
  if (role === 'BUSINESS_OWNER') {
    return ROLE_DEFAULTS.BUSINESS_OWNER;
  }
  return ROLE_DEFAULTS[role] ?? {};
}

export function getAllModules(): Module[] {
  return [...ALL_MODULES];
}

export function getAllActions(): Action[] {
  return [...ALL_ACTIONS];
}
