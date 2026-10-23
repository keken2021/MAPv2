/*
  file summary: how a document's expiry is judged against one assurance set's contract period.
  responsibilities: holds the one warning period, and states whether a document is valid through the contract period, expires during it, expires soon, or has lapsed.
  role in system: used by documentRenewalHelpers.ts, validation.ts, AssuranceDetailView.tsx and DashboardView.tsx; gap review findings E5 and G3.
*/

import type { AssuranceSet } from '../types/assurance';

/* the one warning period for expiring documents, from the BRD's 90-day warning; pending supervisor Q3 (prototype used 183, 180 and 60) */
export const EXPIRY_WARNING_DAYS = 90;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export type ContractPeriodValidity =
  | 'valid_through_period'
  | 'expires_in_period'
  | 'expiring_soon'
  | 'lapsed'
  | 'unknown';

export interface ContractPeriodValidityResult {
  state: ContractPeriodValidity;
  label: string;
  /* the expiry date the label refers to */
  expiryDate?: string;
}

/**
  what: whole days from a day to a date; negative once the date has passed, undefined for an unreadable date.
  how: compares the two timestamps and rounds up to whole days.
  with what file: src/utils/expiryPolicy.ts only.
*/
function daysUntil(dateStr: string | undefined, today: Date): number | undefined {
  if (!dateStr) return undefined;
  const time = new Date(dateStr).getTime();
  if (Number.isNaN(time)) return undefined;
  return Math.ceil((time - today.getTime()) / MS_PER_DAY);
}

/**
  what: a document's validity for one set; inputs are the expiry date, the set's contract period and today.
  how: lapsed once expired; expires in period when it ends before the contract period ends; expiring soon within the warning period; otherwise valid through the period. The same document can read differently on two sets.
  with what file: src/utils/expiryPolicy.ts used by AssuranceDetailView.tsx and isExpiringWithinWarning.
*/
export function getValidityInContractPeriod(
  expiryDate: string | undefined,
  set: Pick<AssuranceSet, 'charterWindowEnd'>,
  today: Date = new Date(),
): ContractPeriodValidityResult {
  const daysLeft = daysUntil(expiryDate, today);
  if (daysLeft === undefined) return { state: 'unknown', label: 'Expiry not recorded' };
  if (daysLeft < 0) return { state: 'lapsed', label: 'Lapsed', expiryDate };

  const periodEnd = new Date(set.charterWindowEnd).getTime();
  if (!Number.isNaN(periodEnd) && new Date(expiryDate!).getTime() < periodEnd) {
    return { state: 'expires_in_period', label: 'Expires During Contract Period', expiryDate };
  }
  if (daysLeft <= EXPIRY_WARNING_DAYS) {
    return { state: 'expiring_soon', label: `Expires Within ${EXPIRY_WARNING_DAYS} Days`, expiryDate };
  }
  return { state: 'valid_through_period', label: 'Valid Through Contract Period', expiryDate };
}

/**
  what: true when a document has not expired and expires within the warning period; inputs are the expiry date and today.
  how: whole days left between 0 and EXPIRY_WARNING_DAYS.
  with what file: src/utils/expiryPolicy.ts used by DashboardView.tsx and documentRenewalHelpers.ts.
*/
export function isExpiringWithinWarning(expiryDate: string | undefined, today: Date = new Date()): boolean {
  const daysLeft = daysUntil(expiryDate, today);
  return daysLeft !== undefined && daysLeft >= 0 && daysLeft <= EXPIRY_WARNING_DAYS;
}
