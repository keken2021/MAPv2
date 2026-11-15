import { describe, it, expect } from 'vitest';
import {
  REMINDER_PERCENT,
  REMINDER_REPEAT_DAYS,
  TARGET_DATE_WARNING_DAYS,
  TARGET_DATE_REMINDER_DAYS,
  AT_RISK_DAYS,
  EXPIRY_WARNING_DAYS,
  OCR_MIN_CONFIDENCE,
  DATE_PERMISSION_DEFAULT_DAYS,
  daysUntilTarget,
  isAssuranceSetAtRisk,
} from '../config/thresholds';
import { targetDateNoticeKind } from '../utils/notificationHelpers';
import { getStatusTone } from '../components/common/StatusBadge';
import type { AssuranceRequirement, AssuranceSet } from '../types/assurance';

describe('Central Reminder and Risk Thresholds (Task 5524 / A17)', () => {
  it('defines the required central constants', () => {
    expect(REMINDER_PERCENT).toBe(90);
    expect(REMINDER_REPEAT_DAYS).toBe(3);
    expect(TARGET_DATE_WARNING_DAYS).toBe(14);
    expect(TARGET_DATE_REMINDER_DAYS).toBe(14);
    expect(AT_RISK_DAYS).toBe(14);
    expect(EXPIRY_WARNING_DAYS).toBe(90);
    expect(OCR_MIN_CONFIDENCE).toBe(90);
    expect(DATE_PERMISSION_DEFAULT_DAYS).toBe(14);
  });

  it('computes days until target accurately', () => {
    expect(daysUntilTarget('2026-11-25', '2026-11-11')).toBe(14);
    expect(daysUntilTarget('2026-11-11', '2026-11-11')).toBe(0);
    expect(daysUntilTarget('2026-11-10', '2026-11-11')).toBe(-1);
  });

  it('fires target warning at 14 days before target', () => {
    const today = '2026-11-11';
    expect(targetDateNoticeKind('2026-11-25', today)).toBe('warning');
    expect(targetDateNoticeKind('2026-11-20', today)).toBe('warning');
    expect(targetDateNoticeKind('2026-11-26', today)).toBeNull();
  });

  describe('isAssuranceSetAtRisk rule', () => {
    const baseSet: AssuranceSet = {
      id: 'AS-RISK-01',
      title: 'Risk Test Set',
      parties: [
        { organization: 'OilCo', role: 'Requesting party' },
        { organization: 'Test Provider', role: 'Responding party' },
      ],
      assuranceObjects: [
        {
          id: 'VESSEL-1',
          type: 'vessel',
          name: 'Test Vessel',
          identifier: '9123456',
          ownerOrganization: 'Test Provider',
        },
      ],
      startDate: '2026-11-01',
      endDate: '2026-11-30',
      deadline: '2026-11-20',
      dateHistory: [],
      stage: 'Verification',
      readinessScore: 50,
      mandatoryInspectionRequired: false,
      inspectionCompleted: false,
      createdBy: { userId: 'USR-101', name: 'K. Osei', persona: 'Administrator' },
      requirements: [
        {
          id: 'REQ-1',
          category: 'Statutory',
          title: 'Load Line Certificate',
          isMandatory: true,
          isFulfilled: false,
          ocrConfidence: 95,
          verifierStatus: 'Pending',
        } as AssuranceRequirement,
      ],
    };

    it('returns true when target date is within 14 days and has an unapproved required task', () => {
      expect(isAssuranceSetAtRisk(baseSet, '2026-11-11')).toBe(true);
    });

    it('returns false when target date is more than 14 days away', () => {
      const farSet = { ...baseSet, deadline: '2026-11-30' }; // 19 days away
      expect(isAssuranceSetAtRisk(farSet, '2026-11-11')).toBe(false);
    });

    it('returns false when all mandatory tasks are verified or fulfilled', () => {
      const clearedSet = {
        ...baseSet,
        requirements: [
          {
            ...baseSet.requirements[0],
            verifierStatus: 'Verified',
            isFulfilled: true,
          } as AssuranceRequirement,
        ],
      };
      expect(isAssuranceSetAtRisk(clearedSet, '2026-11-11')).toBe(false);
    });

    it('returns false when only optional tasks are unapproved', () => {
      const optionalSet = {
        ...baseSet,
        requirements: [
          {
            ...baseSet.requirements[0],
            isMandatory: false,
            verifierStatus: 'Pending',
          } as AssuranceRequirement,
        ],
      };
      expect(isAssuranceSetAtRisk(optionalSet, '2026-11-11')).toBe(false);
    });

    it('returns false when set is already Approved or Certified', () => {
      const approvedSet = { ...baseSet, stage: 'Approved' as const };
      const certifiedSet = { ...baseSet, stage: 'Certified' as const };
      const decidedSet = { ...baseSet, approverDecision: 'Approved' as const };
      expect(isAssuranceSetAtRisk(approvedSet, '2026-11-11')).toBe(false);
      expect(isAssuranceSetAtRisk(certifiedSet, '2026-11-11')).toBe(false);
      expect(isAssuranceSetAtRisk(decidedSet, '2026-11-11')).toBe(false);
    });

    it('returns false when set is Cancelled', () => {
      const cancelledSet = { ...baseSet, stage: 'Cancelled' as const };
      expect(isAssuranceSetAtRisk(cancelledSet, '2026-11-11')).toBe(false);
    });

    it('returns false when target date is in the past (overdue rather than at risk)', () => {
      const pastSet = { ...baseSet, deadline: '2026-11-05' }; // 6 days overdue
      expect(isAssuranceSetAtRisk(pastSet, '2026-11-11')).toBe(false);
    });

    it('falls back to complianceDeadline when deadline is not set', () => {
      const deadlineSet = {
        ...baseSet,
        deadline: undefined,
        complianceDeadline: '2026-11-20',
      };
      expect(isAssuranceSetAtRisk(deadlineSet, '2026-11-11')).toBe(true);
    });
  });

  it('maps At risk status badge to danger tone', () => {
    expect(getStatusTone('At risk')).toBe('danger');
    expect(getStatusTone('at risk')).toBe('danger');
  });
});
