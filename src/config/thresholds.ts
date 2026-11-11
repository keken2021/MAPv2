import type { AssuranceSet } from '../types/assurance';
import { isTaskOpen } from '../utils/readinessHelpers';

export const REMINDER_PERCENT = 90;
export const REMINDER_REPEAT_DAYS = 3;
export const TARGET_DATE_WARNING_DAYS = 14;
export const TARGET_DATE_REMINDER_DAYS = 14;
export const AT_RISK_DAYS = 14;
export const EXPIRY_WARNING_DAYS = 90;
export const OCR_MIN_CONFIDENCE = 90;
export const DATE_PERMISSION_DEFAULT_DAYS = 14;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function daysUntilTarget(targetDate: string, today: string | Date = new Date()): number {
  const target = Date.parse(`${targetDate.slice(0, 10)}T00:00:00Z`);
  const todayStr = typeof today === 'string' ? today.slice(0, 10) : today.toISOString().slice(0, 10);
  const start = Date.parse(`${todayStr}T00:00:00Z`);
  return Math.round((target - start) / MS_PER_DAY);
}

export function isAssuranceSetAtRisk(
  set: Pick<AssuranceSet, 'stage' | 'approverDecision' | 'targetDate' | 'complianceDeadline' | 'requirements'>,
  today: string | Date = new Date(),
): boolean {
  if (
    set.stage === 'Approved' ||
    set.stage === 'Certified' ||
    set.stage === 'Cancelled' ||
    set.approverDecision === 'Approved'
  ) {
    return false;
  }
  const dateStr = set.targetDate || set.complianceDeadline;
  if (!dateStr?.trim()) return false;
  const days = daysUntilTarget(dateStr, today);
  if (days < 0 || days > AT_RISK_DAYS) return false;

  const mandatoryTasks = (set.requirements || []).filter((r) => r.isMandatory && !r.isOtherDocument);
  if (mandatoryTasks.length === 0) return false;
  return mandatoryTasks.some((r) => isTaskOpen(r));
}
