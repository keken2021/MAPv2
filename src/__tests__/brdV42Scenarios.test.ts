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
      expect(vesselVerification?.status).toBe('Tested externally');
      expect(vesselVerification?.channel).toBe('external');
      expect(vesselVerification?.verifiedBy).toBe('L. Ferreira');

      // Audit trail captures Oil Company self-verification of internal methodology
      const selfVerifyAudit = OIL_CO_PILOT_AUDIT.find((a) => a.action === 'Self-Verified Assurance Object');
      expect(selfVerifyAudit).toBeDefined();
      expect(selfVerifyAudit?.organization).toBe(OIL_CO_ORG);
      expect(selfVerifyAudit?.targetAsset).toContain('OBJ-METH-SIMOPS-AURORA');
    });
  });

  describe('Scenario 6: Non-asset assurance objects (procedures and methods)', () => {
    it('creates procedure and method objects and binds them to sets and tasks', () => {
      expect(OIL_CO_PILOT_ASSURANCE_OBJECTS.length).toBeGreaterThanOrEqual(4);

      const procedure = OIL_CO_PILOT_ASSURANCE_OBJECTS.find((o) => o.type === 'procedure');
      expect(procedure).toBeDefined();
      expect(procedure?.name).toBeTruthy();
      expect(procedure?.ownerOrganization).toBeTruthy();

      const method = OIL_CO_PILOT_ASSURANCE_OBJECTS.find((o) => o.type === 'method');
      expect(method).toBeDefined();
      expect(method?.name).toBeTruthy();
      expect(method?.ownerOrganization).toBeTruthy();

      // SS-01 holds mixed object types (vessel, procedure, method)
      const ss01Objects = getAssuranceSetObjects(ss01!);
      const ss01Types = new Set(ss01Objects.map((o) => o.type));
      expect(ss01Types.has('vessel')).toBe(true);
      expect(ss01Types.has('procedure')).toBe(true);
      expect(ss01Types.has('method')).toBe(true);

      // SS-03 holds activity with procedure and method objects
      const ss03Objects = getAssuranceSetObjects(ss03!);
      const ss03Types = new Set(ss03Objects.map((o) => o.type));
      expect(ss03Types.has('procedure')).toBe(true);
      expect(ss03Types.has('method')).toBe(true);

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
});
