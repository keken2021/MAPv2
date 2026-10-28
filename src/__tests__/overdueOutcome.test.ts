/*
  file summary: tests for overdue assurance set outcomes (revised completion date, task exemptions, partial closure, cancel).
  responsibilities: tests isComplianceDeadlineOverdue with revised dates and Cancelled status, task exemptions ledger, partial closure preserving open exempted tasks, and the SS-02 two late items scenario.
  role in system: validates compliance with BRD V4.2 change 7 and prototype task 5196 requirements.
*/

import { describe, it, expect, beforeEach } from 'vitest';
import { isComplianceDeadlineOverdue } from '../utils/validation';
import { useMapStore } from '../store/useMapStore';
import { AssuranceSet, AssuranceRequirement } from '../types/assurance';

function createMockRequirement(id: string, title: string, isFulfilled = false): AssuranceRequirement {
  return {
    id,
    title,
    category: 'Statutory Certificate',
    isMandatory: true,
    isFulfilled,
    ocrConfidence: 95,
    verifierStatus: isFulfilled ? 'Verified' : 'Pending',
    targetDate: '2026-10-15',
  };
}

describe('Overdue Assurance Set Outcomes', () => {
  const baseOverdueSet: AssuranceSet = {
    id: 'AS-TEST-OVERDUE-01',
    title: 'Offshore Overdue Campaign',
    vesselId: 'VESSEL-001',
    vesselName: 'Pacific Valour',
    imoNumber: '9694414',
    initiatorOrg: 'Northwind Marine Pty Ltd',
    initiatorRole: 'Vessel Provider Admin',
    charterer: 'Chevron Australia Pty Ltd',
    clientOrg: 'Chevron Australia Pty Ltd',
    serviceProviderOrg: 'Northwind Marine Pty Ltd',
    charterWindowStart: '2026-10-15',
    charterWindowEnd: '2027-04-15',
    complianceDeadline: '2026-10-15',
    targetDate: '2026-10-15',
    stage: 'Verification',
    readinessScore: 50,
    mandatoryInspectionRequired: false,
    inspectionCompleted: false,
    requirements: [
      createMockRequirement('REQ-01', 'Document 1', true),
      createMockRequirement('REQ-02', 'Document 2', false),
    ],
  };

  beforeEach(() => {
    useMapStore.setState((state) => ({
      ...state,
      assuranceSets: [
        ...state.assuranceSets.filter((s) => s.id !== baseOverdueSet.id),
        baseOverdueSet,
      ],
    }));
  });

  describe('isComplianceDeadlineOverdue validation', () => {
    it('returns true when compliance deadline is in the past for active sets', () => {
      const today = new Date('2026-10-28');
      expect(isComplianceDeadlineOverdue({ complianceDeadline: '2026-10-15', stage: 'Verification' }, today)).toBe(true);
    });

    it('returns false when stage is Cancelled', () => {
      const today = new Date('2026-10-28');
      expect(isComplianceDeadlineOverdue({ complianceDeadline: '2026-10-15', stage: 'Cancelled' }, today)).toBe(false);
    });

    it('returns false when stage is Approved or Certified', () => {
      const today = new Date('2026-10-28');
      expect(isComplianceDeadlineOverdue({ complianceDeadline: '2026-10-15', stage: 'Approved' }, today)).toBe(false);
      expect(isComplianceDeadlineOverdue({ complianceDeadline: '2026-10-15', stage: 'Certified' }, today)).toBe(false);
    });

    it('clears overdue when revised completion date is set in the future', () => {
      const today = new Date('2026-10-28');
      expect(
        isComplianceDeadlineOverdue(
          {
            complianceDeadline: '2026-10-15',
            revisedCompletionDate: '2026-11-15',
            stage: 'Verification',
          },
          today,
        ),
      ).toBe(false);
    });

    it('remains overdue if revised completion date is also in the past', () => {
      const today = new Date('2026-10-28');
      expect(
        isComplianceDeadlineOverdue(
          {
            complianceDeadline: '2026-10-15',
            revisedCompletionDate: '2026-10-20',
            stage: 'Verification',
          },
          today,
        ),
      ).toBe(true);
    });
  });

  describe('Revised Completion Date', () => {
    it('saves revised completion date, updates targetDate, records history, and clears overdue badge', () => {
      const store = useMapStore.getState();
      const res = store.reviseAssuranceSetDeadline(
        baseOverdueSet.id,
        '2026-11-10',
        'Set Manager',
        'Class survey endorsement delayed',
      );
      expect(res.success).toBe(true);

      const updated = useMapStore.getState().assuranceSets.find((s) => s.id === baseOverdueSet.id);
      expect(updated?.revisedCompletionDate).toBe('2026-11-10');
      expect(updated?.targetDate).toBe('2026-11-10');

      const today = new Date('2026-10-28');
      expect(isComplianceDeadlineOverdue(updated!, today)).toBe(false);

      const historyRow = updated?.targetDateHistory?.find((h) => h.scope === 'set');
      expect(historyRow).toBeDefined();
      expect(historyRow?.newDate).toBe('2026-11-10');
      expect(historyRow?.changedBy).toBe('Set Manager');
      expect(historyRow?.reason).toBe('Class survey endorsement delayed');

      const auditLog = useMapStore.getState().auditEvents.find((a) => a.action === 'Revised Completion Date');
      expect(auditLog).toBeDefined();
    });
  });

  describe('Task Exemptions', () => {
    it('saves exemption reason, granted by, new date, updates task target date, and records history', () => {
      const store = useMapStore.getState();
      const res = store.exemptAssuranceTasks(
        baseOverdueSet.id,
        ['REQ-02'],
        'Dry dock extension granted by flag state',
        'Port State Inspector',
        '2026-11-20',
      );
      expect(res.success).toBe(true);

      const updated = useMapStore.getState().assuranceSets.find((s) => s.id === baseOverdueSet.id);
      const req = updated?.requirements.find((r) => r.id === 'REQ-02');
      expect(req?.targetDate).toBe('2026-11-20');
      expect(req?.exemption).toEqual({
        reason: 'Dry dock extension granted by flag state',
        grantedBy: 'Port State Inspector',
        newDate: '2026-11-20',
        grantedAt: expect.any(String),
      });

      const historyRow = updated?.targetDateHistory?.find((h) => h.requirementId === 'REQ-02');
      expect(historyRow).toBeDefined();
      expect(historyRow?.newDate).toBe('2026-11-20');
      expect(historyRow?.changedBy).toBe('Port State Inspector');

      const auditLog = useMapStore.getState().auditEvents.find((a) => a.action === 'Exempted Tasks');
      expect(auditLog).toBeDefined();
    });
  });

  describe('Partial Closure', () => {
    it('partially closes set: moves to Approved with closureType partial while leaving exempted tasks open', () => {
      const store = useMapStore.getState();
      store.exemptAssuranceTasks(
        baseOverdueSet.id,
        ['REQ-02'],
        'Postponed by client agreement',
        'Client Assurance Lead',
        '2026-11-30',
      );

      const res = store.partiallyCloseAssuranceSet(
        baseOverdueSet.id,
        'Client Approver',
        'Approved with partial closure under formal exemption',
      );
      expect(res.success).toBe(true);

      const updated = useMapStore.getState().assuranceSets.find((s) => s.id === baseOverdueSet.id);
      expect(updated?.stage).toBe('Approved');
      expect(updated?.closureType).toBe('partial');
      expect(updated?.partiallyClosedAt).toBeDefined();

      const openTask = updated?.requirements.find((r) => r.id === 'REQ-02');
      expect(openTask?.isFulfilled).toBe(false);
      expect(openTask?.verifierStatus).toBe('Pending');
      expect(openTask?.exemption?.newDate).toBe('2026-11-30');

      const today = new Date('2026-10-28');
      expect(isComplianceDeadlineOverdue(updated!, today)).toBe(false);

      const auditLog = useMapStore.getState().auditEvents.find((a) => a.action === 'Partial Closure');
      expect(auditLog).toBeDefined();
    });
  });

  describe('Cancel Set', () => {
    it('cancels set: moves to Cancelled status with cancellation reason and clears overdue', () => {
      const store = useMapStore.getState();
      const res = store.cancelAssuranceSet(
        baseOverdueSet.id,
        'Client Admin',
        'Charter cancelled due to project postponement',
      );
      expect(res.success).toBe(true);

      const updated = useMapStore.getState().assuranceSets.find((s) => s.id === baseOverdueSet.id);
      expect(updated?.stage).toBe('Cancelled');
      expect(updated?.cancelledAt).toBeDefined();
      expect(updated?.cancellationReason).toBe('Charter cancelled due to project postponement');

      const today = new Date('2026-10-28');
      expect(isComplianceDeadlineOverdue(updated!, today)).toBe(false);

      const auditLog = useMapStore.getState().auditEvents.find((a) => a.action === 'Cancelled Assurance Set');
      expect(auditLog).toBeDefined();
    });
  });

  describe('BRD SS-02 Scenario: Two late items exempted and partially closed', () => {
    it('walks overdue flow where 14 items close on time and items 15 & 16 close a week later', () => {
      const requirements: AssuranceRequirement[] = Array.from({ length: 16 }, (_, i) => {
        const id = `TASK-${i + 1}`;
        const isLate = i === 14 || i === 15;
        return {
          id,
          title: `Assurance Requirement ${i + 1}`,
          category: 'Statutory Certificate',
          isMandatory: true,
          isFulfilled: !isLate,
          ocrConfidence: 95,
          verifierStatus: isLate ? 'Pending' : 'Verified',
          targetDate: '2026-10-15',
        };
      });

      const ss02Set: AssuranceSet = {
        ...baseOverdueSet,
        id: 'AS-SS-02-SCENARIO',
        title: 'SS-02 Vessel Delivery Assurance',
        complianceDeadline: '2026-10-15',
        targetDate: '2026-10-15',
        stage: 'Verification',
        requirements,
      };

      useMapStore.setState((state) => ({
        ...state,
        assuranceSets: [...state.assuranceSets.filter((s) => s.id !== ss02Set.id), ss02Set],
      }));

      const today = new Date('2026-10-28');
      expect(isComplianceDeadlineOverdue(ss02Set, today)).toBe(true);

      const store = useMapStore.getState();
      const exemptRes = store.exemptAssuranceTasks(
        ss02Set.id,
        ['TASK-15', 'TASK-16'],
        'Delivery documentation pending final signature from builder',
        'Peter Bengtsson',
        '2026-11-04',
      );
      expect(exemptRes.success).toBe(true);

      const closeRes = store.partiallyCloseAssuranceSet(
        ss02Set.id,
        'Peter Bengtsson',
        'Partially approved under BRD V4.2 change 7 exemption for items 15 and 16',
      );
      expect(closeRes.success).toBe(true);

      const finalSet = useMapStore.getState().assuranceSets.find((s) => s.id === ss02Set.id);
      expect(finalSet?.stage).toBe('Approved');
      expect(finalSet?.closureType).toBe('partial');

      const task15 = finalSet?.requirements.find((r) => r.id === 'TASK-15');
      const task16 = finalSet?.requirements.find((r) => r.id === 'TASK-16');
      expect(task15?.isFulfilled).toBe(false);
      expect(task16?.isFulfilled).toBe(false);
      expect(task15?.exemption?.newDate).toBe('2026-11-04');
      expect(task16?.exemption?.newDate).toBe('2026-11-04');
      expect(task15?.exemption?.grantedBy).toBe('Peter Bengtsson');

      const fulfilledTasks = finalSet?.requirements.filter((r) => r.isFulfilled);
      expect(fulfilledTasks?.length).toBe(14);

      expect(isComplianceDeadlineOverdue(finalSet!, today)).toBe(false);
    });
  });
});
