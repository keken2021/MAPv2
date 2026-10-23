/*
  file summary: tests that a document's expiry is judged against each set's contract period.
  responsibilities: verifies the four validity states, that one document reads differently on two sets, and the one warning period.
  role in system: covers src/utils/expiryPolicy.ts; gap review findings E5 and G3.
*/

import { describe, expect, it } from 'vitest';
import {
  EXPIRY_WARNING_DAYS,
  getValidityInContractPeriod,
  isExpiringWithinWarning,
} from '../utils/expiryPolicy';

const TODAY = new Date('2026-10-23T00:00:00Z');

describe('expiry policy', () => {
  it('uses one 90-day warning period', () => {
    expect(EXPIRY_WARNING_DAYS).toBe(90);
  });

  it.each([
    ['2026-10-01', '2027-11-01', 'lapsed'],
    ['2026-11-30', '2027-11-01', 'expires_in_period'],
    ['2026-12-15', '2026-11-01', 'expiring_soon'],
    ['2029-06-30', '2027-11-01', 'valid_through_period'],
  ])('expiry %s against a period ending %s is %s', (expiry, periodEnd, state) => {
    expect(getValidityInContractPeriod(expiry, { charterWindowEnd: periodEnd }, TODAY).state).toBe(state);
  });

  it('reads the same document differently on two sets', () => {
    /* the review's example: a certificate expiring 2026-11-30 */
    const shortSet = getValidityInContractPeriod('2026-11-30', { charterWindowEnd: '2026-11-15' }, TODAY);
    const longSet = getValidityInContractPeriod('2026-11-30', { charterWindowEnd: '2027-11-01' }, TODAY);
    expect(shortSet.state).toBe('expiring_soon');
    expect(longSet.state).toBe('expires_in_period');
  });

  it('counts a document as expiring only inside the warning period', () => {
    expect(isExpiringWithinWarning('2026-12-01', TODAY)).toBe(true);
    expect(isExpiringWithinWarning('2027-06-01', TODAY)).toBe(false);
    expect(isExpiringWithinWarning('2026-10-01', TODAY)).toBe(false);
    expect(isExpiringWithinWarning(undefined, TODAY)).toBe(false);
  });
});
