import { describe, expect, it } from 'vitest';
import { evaluateRule, outsideCooldown } from '../src/modules/alerts/evaluator.js';

describe('alerts', () => {
  it('detects transition to stock', () =>
    expect(
      evaluateRule({ type: 'IN_STOCK' }, { available: true }, { available: false }),
    ).toBe(true));
  it('does not alert continuously for stock', () =>
    expect(evaluateRule({ type: 'IN_STOCK' }, { available: true }, { available: true })).toBe(
      false,
    ));
  it('matches target price and percent changes', () => {
    expect(evaluateRule({ type: 'PRICE_BELOW', targetValue: 550 }, { price: 499 })).toBe(true);
    expect(
      evaluateRule(
        { type: 'PRICE_CHANGE_PERCENT', targetValue: 10 },
        { price: 440 },
        { price: 500 },
      ),
    ).toBe(true);
  });
  it('supports failure thresholds', () =>
    expect(
      evaluateRule({ type: 'CHECK_FAILURE', failureCount: 3, failureThreshold: 3 }, {}),
    ).toBe(true));
  it('enforces cooldown', () => {
    const now = new Date('2026-01-01T12:00:00Z');
    expect(outsideCooldown(new Date('2026-01-01T11:30:00Z'), 60, now)).toBe(false);
    expect(outsideCooldown(new Date('2026-01-01T10:30:00Z'), 60, now)).toBe(true);
  });
});
