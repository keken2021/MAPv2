/*
  file summary: tests verifying that the audit trail displays only the active user's activities.
  responsibilities: verifies user-level isolation in audit trail event logs across personas, session switches, and newly logged events.
  role in system: covers rbacHelpers.ts (filterAuditTrailForUser, filterAuditTrailForPersona), AuditTrailView, and useMapStore.ts.
*/

import { beforeEach, describe, expect, it } from 'vitest';
import { useMapStore } from '../store/useMapStore';
import { filterAuditTrailForPersona, filterAuditTrailForUser } from '../utils/rbacHelpers';
import { AuditTrailEvent, AuditTrailEventDraft, withStructuredAuditTarget } from '../types/audit';
import { MOCK_AUDIT_TRAIL } from '../store/mockData';

const testEvents: AuditTrailEvent[] = ([
  {
    id: 'AUD-001',
    timestampUtc: '2026-10-01T10:00:00Z',
    userId: 'USR-101',
    userRole: 'Administrator',
    organization: 'Northwind Marine Pty Ltd',
    action: 'Registered Unique Vessel Record',
    targetAsset: 'MV Pacific Endeavour',
  },
  {
    id: 'AUD-002',
    timestampUtc: '2026-10-01T11:00:00Z',
    userId: 'USR-102',
    userRole: 'Submitter',
    organization: 'Northwind Marine Pty Ltd',
    action: 'Uploaded Document Revision',
    targetAsset: 'Certificate of Class',
  },
  {
    id: 'AUD-003',
    timestampUtc: '2026-10-01T12:00:00Z',
    userId: 'USR-201',
    userRole: 'C Admin',
    organization: 'Southern Basin Energy Pty Ltd',
    action: 'Initiated Assurance Set',
    targetAsset: 'AS-2026-005',
  },
  {
    id: 'AUD-004',
    timestampUtc: '2026-10-01T13:00:00Z',
    userId: 'USR-202',
    userRole: 'Verifier',
    organization: 'Bureau Veritas Inspectorate',
    action: 'Verified Statutory Certificate',
    targetAsset: 'MAP-VES-2026-STAT-00001',
  },
  {
    id: 'AUD-005',
    timestampUtc: '2026-10-01T14:00:00Z',
    userId: 'USR-105',
    userRole: 'Administrator',
    organization: 'Northwind Marine Pty Ltd',
    action: 'Updated Vessel Availability',
    targetAsset: 'MV Northern Pioneer',
  },
] satisfies AuditTrailEventDraft[]).map(withStructuredAuditTarget);

describe('audit trail user activity isolation', () => {
  const initialStoreState = useMapStore.getState();

  beforeEach(() => {
    useMapStore.setState(initialStoreState, true);
  });

  describe('filterAuditTrailForUser', () => {
    it('returns only activities performed by the specified user', () => {
      const adminActivities = filterAuditTrailForUser(testEvents, 'USR-101');
      expect(adminActivities).toHaveLength(1);
      expect(adminActivities[0].id).toBe('AUD-001');
      expect(adminActivities[0].userId).toBe('USR-101');

      const submitterActivities = filterAuditTrailForUser(testEvents, 'USR-102');
      expect(submitterActivities).toHaveLength(1);
      expect(submitterActivities[0].id).toBe('AUD-002');
      expect(submitterActivities[0].userId).toBe('USR-102');
    });

    it('isolates users within the same organization and role', () => {
      // USR-101 and USR-105 are both Administrators at Northwind Marine
      const user101Activities = filterAuditTrailForUser(testEvents, 'USR-101');
      expect(user101Activities.some((e) => e.userId === 'USR-105')).toBe(false);

      const user105Activities = filterAuditTrailForUser(testEvents, 'USR-105');
      expect(user105Activities).toHaveLength(1);
      expect(user105Activities[0].id).toBe('AUD-005');
      expect(user105Activities.some((e) => e.userId === 'USR-101')).toBe(false);
    });

    it('returns empty array when user has no logged activities', () => {
      const noActivities = filterAuditTrailForUser(testEvents, 'USR-999');
      expect(noActivities).toHaveLength(0);
    });
  });

  describe('filterAuditTrailForPersona', () => {
    it('filters by explicit userId when provided', () => {
      const results = filterAuditTrailForPersona(
        testEvents,
        'Administrator',
        [],
        [],
        'USR-101',
      );
      expect(results.every((e) => e.userId === 'USR-101')).toBe(true);
    });

    it('falls back to persona default session user if userId is not provided', () => {
      const adminDefault = filterAuditTrailForPersona(testEvents, 'Administrator');
      expect(adminDefault.every((e) => e.userId === 'USR-101')).toBe(true);

      const submitterDefault = filterAuditTrailForPersona(testEvents, 'Submitter');
      expect(submitterDefault.every((e) => e.userId === 'USR-102')).toBe(true);

      const verifierDefault = filterAuditTrailForPersona(testEvents, 'Verifier');
      expect(verifierDefault.every((e) => e.userId === 'USR-202')).toBe(true);
    });
  });

  describe('store audit events and session switching', () => {
    it('ensures new actions logged by the user appear in their audit trail', () => {
      useMapStore.setState({
        activePersona: 'Administrator',
        activeDemoOrganization: 'Northwind Marine Pty Ltd',
        activeSessionUserId: 'USR-101',
      });

      useMapStore.getState().logAuditEvent({
        action: 'Custom User Activity Logged',
        targetAsset: 'Global System Context',
        justificationNotes: 'Test justification.',
      });

      const currentEvents = useMapStore.getState().auditEvents;
      const userActivities = filterAuditTrailForPersona(
        currentEvents,
        'Administrator',
        [],
        [],
        'USR-101',
      );

      const latest = userActivities[0];
      expect(latest.action).toBe('Custom User Activity Logged');
      expect(latest.userId).toBe('USR-101');
      expect(userActivities.every((e) => e.userId === 'USR-101')).toBe(true);
    });

    it('does not display newly logged action to another user', () => {
      // USR-101 logs an event
      useMapStore.setState({
        activePersona: 'Administrator',
        activeDemoOrganization: 'Northwind Marine Pty Ltd',
        activeSessionUserId: 'USR-101',
      });

      useMapStore.getState().logAuditEvent({
        action: 'Admin Confidential Action',
        targetAsset: 'MV Pacific Endeavour',
      });

      const currentEvents = useMapStore.getState().auditEvents;

      // Submitter USR-102 inspects their audit trail
      const submitterActivities = filterAuditTrailForPersona(
        currentEvents,
        'Submitter',
        [],
        [],
        'USR-102',
      );

      expect(submitterActivities.some((e) => e.action === 'Admin Confidential Action')).toBe(false);
      expect(submitterActivities.every((e) => e.userId === 'USR-102')).toBe(true);
    });

    it('filters MOCK_AUDIT_TRAIL so Administrator only sees their own activities', () => {
      const adminActivities = filterAuditTrailForPersona(
        MOCK_AUDIT_TRAIL,
        'Administrator',
        [],
        [],
        'USR-101',
      );

      expect(adminActivities.length).toBeGreaterThan(0);
      expect(adminActivities.every((e) => e.userId === 'USR-101')).toBe(true);
      expect(adminActivities.some((e) => e.userId === 'USR-102')).toBe(false);
      expect(adminActivities.some((e) => e.userId === 'USR-201')).toBe(false);
      expect(adminActivities.some((e) => e.userId === 'USR-202')).toBe(false);
    });
  });
});
