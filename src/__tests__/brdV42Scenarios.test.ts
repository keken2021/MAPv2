import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { CreateAssuranceSetView } from '../views/CreateAssuranceSetView';
import { AssuranceDetailView } from '../views/AssuranceDetailView';
import { describe, expect, it } from 'vitest';
import { MOCK_PROJECTS, PROJECT_SEED_ASSURANCE_SETS } from '../store/projectMockData';
import {
  OIL_CO_AURORA_ID,
  OIL_CO_LNG_PROJECT_ID,
  OIL_CO_ORG,
  OIL_CO_PILOT_ASSURANCE_OBJECTS,
  OIL_CO_PILOT_AUDIT,
  OIL_CO_PILOT_NOTIFICATIONS,
  OIL_CO_SS01_ID,
  OIL_CO_SS03_ID,
  NORTHWIND_ORG,
} from '../store/oilCoLngPilotMockData';
import { getAssuranceSetObjects } from '../utils/assuranceTemplates';
import { isComplianceDeadlineOverdue, isDatePermissionActive } from '../utils/validation';
import { deriveObjectVerification } from '../utils/documentVersionSnapshot';
import { useMapStore } from '../store/useMapStore';

describe('BRD V4.2 Scenarios Mock Data (Task 5206)', () => {
  const project = MOCK_PROJECTS.find((p) => p.id === OIL_CO_LNG_PROJECT_ID);
  const ss01 = PROJECT_SEED_ASSURANCE_SETS.find((s) => s.id === OIL_CO_SS01_ID);
  const ss03 = PROJECT_SEED_ASSURANCE_SETS.find((s) => s.id === OIL_CO_SS03_ID);

  describe('Scenario 1: Date change', () => {
    it('sets target date on set and tasks, with active short-term permission and history ledger', () => {
      expect(ss01?.targetDate).toBe('2026-11-15');
      expect(ss01?.complianceDeadline).toBe('2026-11-15');

      // Date permission grant
      expect(ss01?.datePermissionGrants).toBeDefined();
      expect(ss01?.datePermissionGrants?.length).toBeGreaterThan(0);
      const grant = ss01?.datePermissionGrants?.[0];
      expect(grant?.userId).toBe('USR-228');
      expect(grant?.userName).toBe('A. Okonkwo');
      expect(grant?.grantedBy).toContain('Oil Company');
      expect(isDatePermissionActive(grant!, new Date('2026-10-28'))).toBe(true);

      // Date change history
      expect(ss01?.targetDateHistory).toBeDefined();
      expect(ss01?.targetDateHistory?.length).toBeGreaterThanOrEqual(2);
      const setHistory = ss01?.targetDateHistory?.find((h) => h.scope === 'set');
      expect(setHistory?.oldDate).toBe('2026-11-01');
      expect(setHistory?.newDate).toBe('2026-11-15');
      expect(setHistory?.changedBy).toContain('Oil Company');

      const taskHistory = ss01?.targetDateHistory?.find((h) => h.scope === 'task');
      expect(taskHistory?.taskId).toBe('REQ-SS01-10');
      expect(taskHistory?.newDate).toBe('2026-11-12');

      // Task target date
      const req10 = ss01?.requirements.find((r) => r.id === 'REQ-SS01-10');
      expect(req10?.targetDate).toBe('2026-11-12');
      expect(new Date(req10?.targetDate!).getTime()).toBeLessThanOrEqual(
        new Date(ss01?.targetDate!).getTime(),
      );

      // Audit event and notification
      expect(OIL_CO_PILOT_AUDIT.some((a) => a.action === 'Changed Target Date')).toBe(true);
      expect(OIL_CO_PILOT_NOTIFICATIONS.some((n) => n.type === 'target_date' && n.targetDateKind === 'date_changed')).toBe(true);
    });
  });

  describe('Scenario 2: Exemption and overdue outcome', () => {
    it('records exemptions on late items 15 and 16 with revised completion date', () => {
      expect(ss01?.revisedCompletionDate).toBe('2026-11-22');

      const req15 = ss01?.requirements.find((r) => r.id === 'REQ-SS01-15');
      const req16 = ss01?.requirements.find((r) => r.id === 'REQ-SS01-16');

      expect(req15?.exemption).toBeDefined();
      expect(req15?.exemption?.reason).toContain('extension');
      expect(req15?.exemption?.grantedBy).toContain('Oil Company');
      expect(req15?.exemption?.newDate).toBe('2026-11-22');

      expect(req16?.exemption).toBeDefined();
      expect(req16?.exemption?.reason).toContain('safety metrics');
      expect(req16?.exemption?.newDate).toBe('2026-11-22');

      // Revised date clears overdue on active set when evaluated before revised date
      const testDate = new Date('2026-11-16');
      expect(isComplianceDeadlineOverdue(ss01!, testDate)).toBe(false);

      // Audit event
      expect(OIL_CO_PILOT_AUDIT.some((a) => a.action === 'Granted Task Exemption')).toBe(true);
    });
  });

  describe('Scenario 3: Mid-set task change', () => {
    it('records mid-set task modification in task notes, audit trail, and notifications', () => {
      const req20 = ss01?.requirements.find((r) => r.id === 'REQ-SS01-20');
      expect(req20?.notes).toContain('mid-set');

      const auditEvent = OIL_CO_PILOT_AUDIT.find((a) => a.action === 'Updated Task on Open Set');
      expect(auditEvent).toBeDefined();
      expect(auditEvent?.targetAsset).toContain('REQ-SS01-20');
      expect(auditEvent?.organization).toBe(OIL_CO_ORG);

      const notif = OIL_CO_PILOT_NOTIFICATIONS.find((n) => n.id === 'MAP-NTF-2026-ASGN-00036');
      expect(notif).toBeDefined();
      expect(notif?.message).toContain('REQ-SS01-20');
      expect(notif?.recipientUserId).toBe('USR-102'); // Northwind Submitter
    });
  });

  describe('Scenario 4: Shared operation date', () => {
    it('holds shared on-hire date on the master project and aligns set timelines', () => {
      expect(project?.onHireDate).toBe('2026-11-15');
      expect(ss01?.charterWindowStart).toBe('2026-11-15');
      expect(ss01?.complianceDeadline).toBe('2026-11-15');

      // Additional projects with on-hire dates
      const sbeProj = MOCK_PROJECTS.find((p) => p.id === 'MAP-PROJ-2026-MARINE-009');
      expect(sbeProj?.onHireDate).toBe('2026-09-15');
    });
  });

  describe('Scenario 5: Self-verification vs external review', () => {
    it('distinguishes external review on vessel from internal self-assurance on operational methods', () => {
      // SS-01 vessel review is external
      expect(ss01?.reviewMode).toBe('third_party');
      expect(ss01?.assignedVerifier).toContain('XY Marine Assurance');

      const vesselVerification = deriveObjectVerification(OIL_CO_AURORA_ID, [ss01!], OIL_CO_ORG);
      expect(vesselVerification?.status).toBe('Externally verified');
      expect(vesselVerification?.channel).toBe('external');
      expect(vesselVerification?.verifiedBy).toBe('L. Ferreira');

      // Audit trail captures Oil Company self-verification of internal methodology
      const selfVerifyAudit = OIL_CO_PILOT_AUDIT.find((a) => a.action === 'Self-Verified Assurance Object');
      expect(selfVerifyAudit).toBeDefined();
      expect(selfVerifyAudit?.organization).toBe(OIL_CO_ORG);
      expect(selfVerifyAudit?.targetAsset).toContain('OBJ-METH-SIMOPS-AURORA');
    });
  });

  describe('Scenario 6: Non-asset assurance objects (activities)', () => {
    it('creates activity objects and binds them to sets and tasks', () => {
      expect(OIL_CO_PILOT_ASSURANCE_OBJECTS.length).toBeGreaterThanOrEqual(4);

      const activityObj1 = OIL_CO_PILOT_ASSURANCE_OBJECTS.find((o) => o.id === 'OBJ-PROC-LNG-AURORA-01');
      expect(activityObj1).toBeDefined();
      expect(activityObj1?.type).toBe('activity');
      expect(activityObj1?.name).toBeTruthy();
      expect(activityObj1?.ownerOrganization).toBeTruthy();

      const activityObj2 = OIL_CO_PILOT_ASSURANCE_OBJECTS.find((o) => o.id === 'OBJ-METH-SIMOPS-AURORA');
      expect(activityObj2).toBeDefined();
      expect(activityObj2?.type).toBe('activity');
      expect(activityObj2?.name).toBeTruthy();
      expect(activityObj2?.ownerOrganization).toBeTruthy();

      // SS-01 holds mixed object types (vessel, activity)
      const ss01Objects = getAssuranceSetObjects(ss01!);
      const ss01Types = new Set(ss01Objects.map((o) => o.type));
      expect(ss01Types.has('vessel')).toBe(true);
      expect(ss01Types.has('activity')).toBe(true);
      expect(ss01Types.has('procedure')).toBe(false);
      expect(ss01Types.has('method')).toBe(false);

      // SS-03 holds activity objects
      const ss03Objects = getAssuranceSetObjects(ss03!);
      const ss03Types = new Set(ss03Objects.map((o) => o.type));
      expect(ss03Types.has('activity')).toBe(true);
      expect(ss03Types.has('procedure')).toBe(false);
      expect(ss03Types.has('method')).toBe(false);

      // Requirements point to non-asset object target IDs
      const portReq = ss01?.requirements.find((r) => r.id === 'REQ-SS01-19');
      expect(portReq?.targetObjectId).toBe('OBJ-PROC-LNG-AURORA-01');

      const esdReq = ss03?.requirements.find((r) => r.id === 'REQ-SS03-05');
      expect(esdReq?.targetObjectId).toBe('OBJ-PROC-HARBOUR-ESD');

      // Objects are registered in store
      const storeObjects = useMapStore.getState().assuranceObjects;
      expect(storeObjects.some((o) => o.id === 'OBJ-PROC-LNG-AURORA-01')).toBe(true);
      expect(storeObjects.some((o) => o.id === 'OBJ-METH-SIMOPS-AURORA')).toBe(true);
    });
  });

  describe('Pending helper organization scenario', () => {
    it('labels the helper organization as pending and does not build submission delegation', () => {
      // Contract parties on project
      const helperParty = project?.contractParties?.find((p) =>
        p.organization.toLowerCase().includes('helper'),
      );
      expect(helperParty).toBeDefined();
      expect(helperParty?.organization).toContain('Pending');
      expect(helperParty?.group).toBe('Vendor');

      // Project description notes AI-11 pending
      expect(project?.description).toContain('AI-11');
      expect(project?.description).toContain('pending');

      // Audit log records pending status
      const auditHelper = OIL_CO_PILOT_AUDIT.find((a) => a.action === 'Recorded Pending Helper Organization');
      expect(auditHelper).toBeDefined();
      expect(auditHelper?.justificationNotes).toContain('pending');
    });
  });

  describe('Scenario 8: Organization party role on assurance set request (Task 5333)', () => {
    it('carries party roles in request payload, pre-fills in wizard with note, and saves on assurance set', () => {
      const store = useMapStore.getState();
      const proj = MOCK_PROJECTS.find((p) => p.id === OIL_CO_LNG_PROJECT_ID)!;

      // 1. Party role in the request notification payload
      const reqResult = store.requestAssuranceSet({
        projectId: proj.id,
        recipientUserId: 'USR-102',
        senderUserId: 'USR-228',
        senderName: 'A. Okonkwo',
        suggestedScope: 'Vessel',
        message: 'Please initiate vetting set for the charter window.',
      });
      expect(reqResult.success).toBe(true);

      const notif = useMapStore.getState().notifications.find((n) => n.recipientUserId === 'USR-102' && n.type === 'assurance_set_request');
      expect(notif).toBeDefined();
      expect(notif?.request?.requestingParty).toBe(OIL_CO_ORG);
      expect(notif?.request?.respondingParty).toBe('Northwind Marine Pty Ltd');
      expect(notif?.request?.partyRoles?.requestingParty).toBe(OIL_CO_ORG);
      expect(notif?.request?.partyRoles?.respondingParty).toBe('Northwind Marine Pty Ltd');

      // 2. Wizard pre-fill and note
      useMapStore.setState({ pendingAssuranceRequestNotificationId: notif?.id });
      const { unmount } = render(React.createElement(CreateAssuranceSetView));
      expect(screen.getAllByText(/Pre-filled from request/i).length).toBeGreaterThan(0);
      unmount();

      // 3. Saved set carries party roles and shows on detail view
      const testSetId = 'AS-PARTY-ROLE-TEST';
      const createdSet = {
        ...ss01!,
        id: testSetId,
        title: 'Aurora Party Role Test Set',
        requestingParty: OIL_CO_ORG,
        respondingParty: NORTHWIND_ORG,
        partyRoles: {
          [OIL_CO_ORG]: 'Requesting party',
          [NORTHWIND_ORG]: 'Responding party',
        },
        parties: [
          { organization: OIL_CO_ORG, group: 'Client' as const, partyRole: 'Requesting party' },
          { organization: NORTHWIND_ORG, group: 'Vendor' as const, partyRole: 'Responding party' },
        ],
      };
      useMapStore.setState({ assuranceSets: [createdSet, ...useMapStore.getState().assuranceSets] });

      const { unmount: unmountDetail } = render(React.createElement(AssuranceDetailView, { setId: testSetId }));
      expect(screen.getAllByText(OIL_CO_ORG).length).toBeGreaterThan(0);
      expect(screen.getAllByText(NORTHWIND_ORG).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Requesting party/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Responding party/i).length).toBeGreaterThan(0);
      unmountDetail();
    });
  });

  describe('Scenario 9: Activities section replaces Procedures and Methods in AssuranceDetailView (Task 5401)', () => {
    it('shows one Activities section on set detail and no Procedures or Methods sections', () => {
      const testSetId = 'AS-ACTIVITY-DETAIL-TEST';
      const createdSet = {
        ...ss01!,
        id: testSetId,
        title: 'Aurora Activity Detail Test Set',
        assuranceObjects: [
          {
            id: 'OBJ-ACT-TEST-01',
            type: 'activity' as const,
            name: 'Cargo Transfer Loading Procedure',
            ownerOrganization: 'Northwind Marine Pty Ltd',
          },
        ],
        sections: [
          { id: 'sec-general', name: 'General documents', order: 0 },
          { id: 'sec-activity', name: 'Activities', order: 40 },
        ],
        requirements: [
          {
            id: 'REQ-ACT-01',
            title: 'Approved Cargo Transfer Checklist',
            sectionId: 'sec-activity',
            subtype: 'Activity' as any,
            category: 'Standard Documents',
            status: 'Compliant' as const,
            isMandatory: true,
            isFulfilled: true,
            ocrConfidence: 95,
            verifierStatus: 'Verified' as const,
          },
        ],
      };
      useMapStore.setState({ assuranceSets: [createdSet as any, ...useMapStore.getState().assuranceSets] });

      const { unmount: unmountDetail } = render(React.createElement(AssuranceDetailView, { setId: testSetId }));
      const reqTab = screen.getByRole('tab', { name: 'Requirements' });
      fireEvent.click(reqTab);
      expect(screen.getAllByText('Activities').length).toBeGreaterThan(0);
      expect(screen.queryByText('Procedures')).toBeNull();
      expect(screen.queryByText('Methods')).toBeNull();
      unmountDetail();
    });
  });
});
