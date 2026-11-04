import { describe, expect, it } from 'vitest';
import { SEEDED_AUDIT_EVENTS } from '../store/auditMockData';
import { AuditTrailEvent } from '../types/audit';
import { DashboardRole } from '../types/dashboard';
import {
  extractCleanSubject,
  formatAuditEventSentence,
  formatRelativeTime,
  getRoleRecentActivity,
  isEventRelevantToRole,
} from '../utils/recentActivityFeed';

describe('recentActivityFeed', () => {
  describe('formatRelativeTime', () => {
    const fixedNow = new Date('2026-11-05T12:00:00Z');

    it('handles invalid or empty inputs gracefully', () => {
      expect(formatRelativeTime('', fixedNow)).toBe('');
      expect(formatRelativeTime('not-a-date', fixedNow)).toBe('');
    });

    it('returns "Just now" for current or future times', () => {
      expect(formatRelativeTime('2026-11-05T12:00:00Z', fixedNow)).toBe('Just now');
      expect(formatRelativeTime('2026-11-05T12:00:30Z', fixedNow)).toBe('Just now');
      expect(formatRelativeTime('2026-11-05T11:59:45Z', fixedNow)).toBe('Just now');
    });

    it('formats minutes ago', () => {
      expect(formatRelativeTime('2026-11-05T11:45:00Z', fixedNow)).toBe('15 min ago');
      expect(formatRelativeTime('2026-11-05T11:01:00Z', fixedNow)).toBe('59 min ago');
    });

    it('formats hours ago', () => {
      expect(formatRelativeTime('2026-11-05T11:00:00Z', fixedNow)).toBe('1 h ago');
      expect(formatRelativeTime('2026-11-05T08:00:00Z', fixedNow)).toBe('4 h ago');
    });

    it('formats "Yesterday" for 24-48 hours ago', () => {
      expect(formatRelativeTime('2026-11-04T10:00:00Z', fixedNow)).toBe('Yesterday');
    });

    it('formats days ago', () => {
      expect(formatRelativeTime('2026-11-03T12:00:00Z', fixedNow)).toBe('2 days ago');
      expect(formatRelativeTime('2026-10-31T12:00:00Z', fixedNow)).toBe('5 days ago');
    });

    it('formats months ago', () => {
      expect(formatRelativeTime('2026-09-20T12:00:00Z', fixedNow)).toBe('1 mo ago');
      expect(formatRelativeTime('2026-08-01T12:00:00Z', fixedNow)).toBe('3 mo ago');
    });
  });

  describe('extractCleanSubject', () => {
    it('extracts inside parentheses when present', () => {
      expect(extractCleanSubject('AS-2026-001 (MV Pacific Endeavour)')).toBe('MV Pacific Endeavour');
      expect(extractCleanSubject('MAP-VES-2026-STAT-00001 (Certificate of Class)')).toBe('Certificate of Class');
    });

    it('extracts after middle dot delimiter', () => {
      expect(extractCleanSubject('AS-CRW-101-01 · Capt. Alexander Wright Vetting')).toBe('Capt. Alexander Wright Vetting');
      expect(extractCleanSubject('CAPA-118 · Replace port-side liferaft HRU')).toBe('Replace port-side liferaft HRU');
    });

    it('extracts after slash delimiter', () => {
      expect(extractCleanSubject('AS-CRW-101-01 / Requirement REQ-103')).toBe('Requirement REQ-103');
    });

    it('strips IMO numbers', () => {
      expect(extractCleanSubject('MV Pacific Endeavour (IMO 9123453)')).toBe('MV Pacific Endeavour');
    });
  });

  describe('formatAuditEventSentence', () => {
    const baseEvent: AuditTrailEvent = {
      id: 'AUD-TEST-1',
      timestampUtc: '2026-11-04T10:00:00Z',
      userId: 'USR-101',
      userRole: 'Administrator',
      organization: 'Northwind Marine Pty Ltd',
      action: '',
      targetAsset: 'AS-2026-001 (MV Pacific Endeavour)',
      target: { kind: 'set', setId: 'AS-2026-001' },
    };

    it('formats stage transitions to approval', () => {
      const sentence = formatAuditEventSentence({
        ...baseEvent,
        action: 'System Transition: Inspection -> Approval',
      });
      expect(sentence).toBe('MV Pacific Endeavour reached approval');
    });

    it('formats verifier acceptance', () => {
      const sentence = formatAuditEventSentence({
        ...baseEvent,
        action: 'Requirement Verification: Verified',
        targetAsset: 'MAP-VES-2026-STAT-00001 (Certificate of Class)',
      });
      expect(sentence).toBe('Verifier accepted Certificate of Class');
    });

    it('formats verifier returned', () => {
      const sentence = formatAuditEventSentence({
        ...baseEvent,
        action: 'Correction Requested on Document',
        targetAsset: 'MAP-VES-2026-STAT-00001 (Certificate of Class)',
      });
      expect(sentence).toBe('Verifier returned Certificate of Class');
    });

    it('formats submitter uploaded and re-uploaded', () => {
      const uploadSentence = formatAuditEventSentence({
        ...baseEvent,
        action: 'Uploaded Document for Assurance Requirement',
        targetAsset: 'MAP-VES-2026-STAT-00001 (Certificate of Class)',
      });
      expect(uploadSentence).toBe('Submitter uploaded Certificate of Class');

      const reuploadSentence = formatAuditEventSentence({
        ...baseEvent,
        action: 'Uploaded Document Revision v1.1',
        targetAsset: 'MAP-VES-2026-STAT-00001 (Certificate of Class)',
        fieldDelta: { fieldName: 'Version', oldValue: 'v1.0', newValue: 'v1.1' },
      });
      expect(reuploadSentence).toBe('Submitter re-uploaded Certificate of Class');
    });

    it('formats inspector findings and completions', () => {
      const findingSentence = formatAuditEventSentence({
        ...baseEvent,
        action: 'Raised finding',
        targetAsset: 'CAPA-118 · Replace port-side liferaft HRU',
      });
      expect(findingSentence).toBe('Inspector logged finding on Replace port-side liferaft HRU');

      const surveySentence = formatAuditEventSentence({
        ...baseEvent,
        action: 'Completed On-Site Survey Checklist',
      });
      expect(surveySentence).toBe('Inspector completed survey on MV Pacific Endeavour');
    });

    it('formats approver approval', () => {
      const sentence = formatAuditEventSentence({
        ...baseEvent,
        action: 'Approved assurance set',
      });
      expect(sentence).toBe('Approver approved MV Pacific Endeavour');
    });

    it('formats client re-inspection flag', () => {
      const sentence = formatAuditEventSentence({
        ...baseEvent,
        action: 'Flagged finding for re-inspection',
        targetAsset: 'CAPA-119 · Fire pump pressure test',
      });
      expect(sentence).toBe('Client flagged Fire pump pressure test for re-inspection');
    });
  });

  describe('isEventRelevantToRole', () => {
    const roles: DashboardRole[] = [
      'Administrator as client',
      'Submitter',
      'Verifier',
      'Inspector',
      'Approver',
    ];

    it('marks major set events relevant to Administrator as client', () => {
      for (const ev of SEEDED_AUDIT_EVENTS) {
        expect(isEventRelevantToRole(ev, 'Administrator as client')).toBe(true);
      }
    });

    it('correctly discriminates role relevance', () => {
      const verifierEvent: AuditTrailEvent = {
        id: 'A1',
        timestampUtc: '2026-11-04T10:00:00Z',
        userId: 'USR-202',
        userRole: 'Verifier',
        organization: 'Bureau Veritas',
        action: 'Requirement Verification: Verified',
        targetAsset: 'Certificate of Class',
        target: { kind: 'document', setId: 'AS-1', documentId: 'D1' },
      };

      expect(isEventRelevantToRole(verifierEvent, 'Verifier')).toBe(true);
      expect(isEventRelevantToRole(verifierEvent, 'Submitter')).toBe(true);
      expect(isEventRelevantToRole(verifierEvent, 'Administrator as client')).toBe(true);

      const inspectionEvent: AuditTrailEvent = {
        id: 'A2',
        timestampUtc: '2026-11-04T10:00:00Z',
        userId: 'USR-203',
        userRole: 'Inspector',
        organization: 'Lloyds Register',
        action: 'Raised finding',
        targetAsset: 'CAPA-101 · Bilge pump test',
        target: { kind: 'finding', setId: 'AS-1', findingId: 'CAPA-101' },
      };

      expect(isEventRelevantToRole(inspectionEvent, 'Inspector')).toBe(true);
      expect(isEventRelevantToRole(inspectionEvent, 'Approver')).toBe(false);
    });
  });

  describe('getRoleRecentActivity with seeded mock data', () => {
    const roles: DashboardRole[] = [
      'Administrator as client',
      'Submitter',
      'Verifier',
      'Inspector',
      'Approver',
    ];

    it('returns exactly 5 newest items for every role from SEEDED_AUDIT_EVENTS', () => {
      const testNow = new Date('2026-11-01T12:00:00Z');

      for (const role of roles) {
        const activity = getRoleRecentActivity(role, SEEDED_AUDIT_EVENTS, 5, testNow);
        expect(activity).toHaveLength(5);

        // Verify all sentences are non-empty strings
        for (const item of activity) {
          expect(item.id).toBeTruthy();
          expect(item.text).toBeTruthy();
          expect(item.text.length).toBeGreaterThan(5);
          expect(item.timeAgo).toBeTruthy();
        }

        // Verify items are sorted newest first
        for (let i = 1; i < activity.length; i++) {
          const prevTime = Date.parse(activity[i - 1].timestampUtc || '');
          const currTime = Date.parse(activity[i].timestampUtc || '');
          expect(prevTime).toBeGreaterThanOrEqual(currTime);
        }
      }
    });

    it('returns empty array when auditEvents is empty', () => {
      const activity = getRoleRecentActivity('Submitter', []);
      expect(activity).toEqual([]);
    });
  });
});
