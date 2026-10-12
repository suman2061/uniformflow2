/**
 * Order lifecycle state machine (16 states incl. lateral ON_HOLD / CANCELLED).
 * Transitions are enforced server-side.
 */

export const ORDER_STATES = [
  'REQUIREMENT_COLLECTION',
  'REQUIREMENTS_VERIFIED',
  'ORDER_CONFIRMED',
  'FABRIC_PROCUREMENT_PENDING',
  'FABRIC_ORDERED',
  'FABRIC_PARTIALLY_RECEIVED',
  'FABRIC_RECEIVED',
  'CUTTING_IN_PROGRESS',
  'STITCHING_IN_PROGRESS',
  'QUALITY_CHECK',
  'READY_FOR_DISPATCH',
  'PARTIALLY_DELIVERED',
  'DELIVERED',
  'CLOSED',
] as const;

export const LATERAL_STATES = ['ON_HOLD', 'CANCELLED'] as const;

export type OrderState = (typeof ORDER_STATES)[number] | (typeof LATERAL_STATES)[number];

export const ORDER_STATE_LABELS: Record<string, string> = {
  REQUIREMENT_COLLECTION: 'Requirement Collection',
  REQUIREMENTS_VERIFIED: 'Requirements Verified',
  ORDER_CONFIRMED: 'Order Confirmed',
  FABRIC_PROCUREMENT_PENDING: 'Fabric Procurement Pending',
  FABRIC_ORDERED: 'Fabric Ordered',
  FABRIC_PARTIALLY_RECEIVED: 'Fabric Partially Received',
  FABRIC_RECEIVED: 'Fabric Received',
  CUTTING_IN_PROGRESS: 'Cutting In Progress',
  STITCHING_IN_PROGRESS: 'Stitching In Progress',
  QUALITY_CHECK: 'Quality Check',
  READY_FOR_DISPATCH: 'Ready for Dispatch',
  PARTIALLY_DELIVERED: 'Partially Delivered',
  DELIVERED: 'Delivered',
  CLOSED: 'Closed / Completed',
  ON_HOLD: 'On Hold',
  CANCELLED: 'Cancelled',
};

// Statuses from which no further transition is allowed.
const TERMINAL = new Set<string>(['CLOSED', 'CANCELLED']);

/**
 * Returns the list of valid next states for a given current state.
 */
export function allowedTransitions(current: string): OrderState[] {
  if (TERMINAL.has(current)) return [];

  if (current === 'ON_HOLD') {
    // Resume to any active forward state (user chooses) or cancel.
    return [...ORDER_STATES.filter((s) => s !== 'CLOSED'), 'CANCELLED'];
  }

  const idx = ORDER_STATES.indexOf(current as any);
  const next: OrderState[] = [];

  if (idx >= 0 && idx < ORDER_STATES.length - 1) {
    next.push(ORDER_STATES[idx + 1]);
  }
  // DELIVERED can go to CLOSED (already the next in sequence) — handled above.
  // Allow lateral transitions from any non-terminal active state.
  next.push('ON_HOLD');
  next.push('CANCELLED');

  return next;
}

export function canTransition(from: string, to: string): boolean {
  return allowedTransitions(from).includes(to as OrderState);
}

export function stateLabel(state: string): string {
  return ORDER_STATE_LABELS[state] ?? state;
}
