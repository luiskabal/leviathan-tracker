import type { AlertRuleType } from '@prisma/client';

export type CheckSnapshot = { available?: boolean | null; price?: number | null };
export type RuleSnapshot = {
  type: AlertRuleType;
  targetValue?: number | null;
  failureCount?: number;
  failureThreshold?: number;
};

export function evaluateRule(
  rule: RuleSnapshot,
  current: CheckSnapshot,
  previous?: CheckSnapshot,
): boolean {
  switch (rule.type) {
    case 'IN_STOCK':
      return current.available === true && previous?.available === false;
    case 'PRICE_BELOW':
      return current.price != null && rule.targetValue != null && current.price <= rule.targetValue;
    case 'PRICE_CHANGE_PERCENT': {
      if (!current.price || !previous?.price || rule.targetValue == null) return false;
      return (Math.abs(current.price - previous.price) / previous.price) * 100 >= rule.targetValue;
    }
    case 'CHECK_FAILURE':
      return (rule.failureCount ?? 0) >= (rule.failureThreshold ?? 3);
  }
}

export function outsideCooldown(lastSentAt: Date | undefined, minutes: number, now = new Date()): boolean {
  return !lastSentAt || now.getTime() - lastSentAt.getTime() >= minutes * 60_000;
}
