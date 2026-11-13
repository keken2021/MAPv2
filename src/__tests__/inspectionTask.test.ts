import { describe, expect, it } from 'vitest';
import {
  getInspectionTaskStatus,
  getApprovalTaskStatus,
  isStageTaskActionableForViewer,
  isInspectionDue,
  isInspectionDueForViewer,
  INSPECTION_TASK_TITLE,
  INSPECTION_TASK_STATUS,
  APPROVAL_TASK_TITLE,
  APPROVAL_TASK_STATUS,
} from '../utils/stageTasks';
import { AssuranceSet } from '../types/assurance';
import { UserProfile } from '../types/user';

describe('stageTasks (Inspection and Approval as task rows)', () => {
  const baseSet: AssuranceSet = {
    id: 'AS-TEST-001',
    title: 'Offshore Tug Support Vetting',
    stage: 'Inspection',
    mandatoryInspectionRequired: true,
    inspectionCompleted: false,
    assignedInspector: 'N. Technical (Bureau Veritas Inspectorate)',
    assignedApprover: 'G. Hallworth (Inpex Operations Australia)',
    requirements: [],
  } as unknown as AssuranceSet;

  const assignedInspectorUser: Pick<UserProfile, 'id' | 'name' | 'organization' | 'roles'> = {
    id: 'USR-203',
    name: 'N. Technical',
    organization: 'Bureau Veritas Inspectorate',
    roles: ['Inspector'],
  };

  const unassignedInspectorUser: Pick<UserProfile, 'id' | 'name' | 'organization' | 'roles'> = {
    id: 'USR-204',
    name: 'J. External',
    organization: 'DNV',
    roles: ['Inspector'],
  };

  const assignedApproverUser: Pick<UserProfile, 'id' | 'name' | 'organization' | 'roles'> = {
    id: 'USR-217',
    name: 'G. Hallworth',
    organization: 'Inpex Operations Australia',
    roles: ['Approver'],
  };

  const unassignedApproverUser: Pick<UserProfile, 'id' | 'name' | 'organization' | 'roles'> = {
    id: 'USR-220',
    name: 'P. Nardelli',
    organization: 'Chevron Australia Pty Ltd',
    roles: ['Approver'],
  };

  describe('getInspectionTaskStatus - 4 rules rows', () => {
    it('Row 1: mandatoryInspectionRequired false, or stage before Inspection -> no row (null)', () => {
      // mandatoryInspectionRequired false
      expect(getInspectionTaskStatus({ ...baseSet, mandatoryInspectionRequired: false })).toBeNull();
      // stage before Inspection
      expect(getInspectionTaskStatus({ ...baseSet, stage: 'Initiated' })).toBeNull();
      expect(getInspectionTaskStatus({ ...baseSet, stage: 'Validation' })).toBeNull();
      expect(getInspectionTaskStatus({ ...baseSet, stage: 'Verification' })).toBeNull();
      // null / undefined set
      expect(getInspectionTaskStatus(null)).toBeNull();
      expect(getInspectionTaskStatus(undefined)).toBeNull();
    });

    it('Row 2: stage Inspection, not completed -> To Inspect', () => {
      expect(getInspectionTaskStatus({
        ...baseSet,
        stage: 'Inspection',
        inspectionCompleted: false,
        inspectionFailedAt: undefined,
      })).toEqual({
        status: 'To Inspect',
      });
    });

    it('Row 3: stage Inspection, not completed, after a failed inspection -> On-going, note "Inspection failed"', () => {
      expect(getInspectionTaskStatus({
        ...baseSet,
        stage: 'Inspection',
        inspectionCompleted: false,
        inspectionFailedAt: '2026-11-13T10:00:00.000Z',
      })).toEqual({
        status: 'On-going',
        note: 'Inspection failed',
      });
    });

    it('Row 4: inspectionCompleted true -> Done, badge Passed', () => {
      expect(getInspectionTaskStatus({
        ...baseSet,
        inspectionCompleted: true,
      })).toEqual({
        status: 'Done',
        outcomeLabel: 'Passed',
      });

      // Even if stage is Approval or Approved, completed inspection stays Done, Passed
      expect(getInspectionTaskStatus({
        ...baseSet,
        stage: 'Approval',
        inspectionCompleted: true,
      })).toEqual({
        status: 'Done',
        outcomeLabel: 'Passed',
      });
    });
  });

  describe('getApprovalTaskStatus - 4 rules rows', () => {
    it('Row 5: stage before Approval, never decided -> no row (null)', () => {
      expect(getApprovalTaskStatus({ ...baseSet, stage: 'Initiated', approverDecision: undefined })).toBeNull();
      expect(getApprovalTaskStatus({ ...baseSet, stage: 'Validation', approverDecision: undefined })).toBeNull();
      expect(getApprovalTaskStatus({ ...baseSet, stage: 'Verification', approverDecision: undefined })).toBeNull();
      expect(getApprovalTaskStatus({ ...baseSet, stage: 'Inspection', approverDecision: undefined })).toBeNull();
      expect(getApprovalTaskStatus(null)).toBeNull();
      expect(getApprovalTaskStatus(undefined)).toBeNull();
    });

    it('Row 6: stage Approval, decision Pending or none -> To Approve', () => {
      expect(getApprovalTaskStatus({
        ...baseSet,
        stage: 'Approval',
        approverDecision: undefined,
      })).toEqual({
        status: 'To Approve',
      });

      expect(getApprovalTaskStatus({
        ...baseSet,
        stage: 'Approval',
        approverDecision: 'Pending',
      })).toEqual({
        status: 'To Approve',
      });
    });

    it('Row 7: approverDecision Returned for Correction, set back before Approval -> On-going, note "Returned for correction"', () => {
      expect(getApprovalTaskStatus({
        ...baseSet,
        stage: 'Verification',
        approverDecision: 'Returned for Correction',
      })).toEqual({
        status: 'On-going',
        note: 'Returned for correction',
      });
    });

    it('Row 8: approverDecision Approved or Rejected -> Done, badge Approved or Rejected', () => {
      expect(getApprovalTaskStatus({
        ...baseSet,
        stage: 'Approved',
        approverDecision: 'Approved',
      })).toEqual({
        status: 'Done',
        outcomeLabel: 'Approved',
      });

      expect(getApprovalTaskStatus({
        ...baseSet,
        stage: 'Approval',
        approverDecision: 'Rejected',
      })).toEqual({
        status: 'Done',
        outcomeLabel: 'Rejected',
      });
    });
  });

  describe('isStageTaskActionableForViewer', () => {
    it('returns true for assigned inspector when inspection task is open (To Inspect or On-going failed)', () => {
      const openSet: AssuranceSet = {
        ...baseSet,
        stage: 'Inspection',
        inspectionCompleted: false,
      };
      expect(isStageTaskActionableForViewer(
        openSet,
        'inspection',
        'Inspector',
        'Bureau Veritas Inspectorate',
        assignedInspectorUser,
      )).toBe(true);

      const failedSet: AssuranceSet = {
        ...baseSet,
        stage: 'Inspection',
        inspectionCompleted: false,
        inspectionFailedAt: '2026-11-13T10:00:00Z',
      };
      expect(isStageTaskActionableForViewer(
        failedSet,
        'inspection',
        'Inspector',
        'Bureau Veritas Inspectorate',
        assignedInspectorUser,
      )).toBe(true);
    });

    it('returns false for inspection when viewer is not assigned inspector or row is completed', () => {
      const openSet: AssuranceSet = {
        ...baseSet,
        stage: 'Inspection',
        inspectionCompleted: false,
      };
      // Different inspector
      expect(isStageTaskActionableForViewer(
        openSet,
        'inspection',
        'Inspector',
        'DNV',
        unassignedInspectorUser,
      )).toBe(false);

      // Non-inspector personas
      expect(isStageTaskActionableForViewer(
        openSet,
        'inspection',
        'Submitter',
        'Bureau Veritas Inspectorate',
        assignedInspectorUser,
      )).toBe(false);
      expect(isStageTaskActionableForViewer(
        openSet,
        'inspection',
        'Approver',
        'Bureau Veritas Inspectorate',
        assignedInspectorUser,
      )).toBe(false);

      // Completed inspection row is not actionable (gets View)
      const completedSet: AssuranceSet = {
        ...baseSet,
        stage: 'Approval',
        inspectionCompleted: true,
      };
      expect(isStageTaskActionableForViewer(
        completedSet,
        'inspection',
        'Inspector',
        'Bureau Veritas Inspectorate',
        assignedInspectorUser,
      )).toBe(false);
    });

    it('returns true for assigned approver when approval task is open (To Approve)', () => {
      const approvalSet: AssuranceSet = {
        ...baseSet,
        stage: 'Approval',
        approverDecision: 'Pending',
      };
      expect(isStageTaskActionableForViewer(
        approvalSet,
        'approval',
        'Approver',
        'Inpex Operations Australia',
        assignedApproverUser,
      )).toBe(true);
    });

    it('returns false for approval when viewer is not assigned approver, or row is Returned for Correction, or row is Done', () => {
      const approvalSet: AssuranceSet = {
        ...baseSet,
        stage: 'Approval',
        approverDecision: 'Pending',
      };
      // Different approver
      expect(isStageTaskActionableForViewer(
        approvalSet,
        'approval',
        'Approver',
        'Chevron Australia Pty Ltd',
        unassignedApproverUser,
      )).toBe(false);

      // Non-approver
      expect(isStageTaskActionableForViewer(
        approvalSet,
        'approval',
        'Submitter',
        'Inpex Operations Australia',
        assignedApproverUser,
      )).toBe(false);

      // Returned for correction (set back before Approval) -> button is none, not actionable
      const returnedSet: AssuranceSet = {
        ...baseSet,
        stage: 'Verification',
        approverDecision: 'Returned for Correction',
      };
      expect(isStageTaskActionableForViewer(
        returnedSet,
        'approval',
        'Approver',
        'Inpex Operations Australia',
        assignedApproverUser,
      )).toBe(false);

      // Done (Approved or Rejected) -> not actionable (gets View)
      const doneSet: AssuranceSet = {
        ...baseSet,
        stage: 'Approved',
        approverDecision: 'Approved',
      };
      expect(isStageTaskActionableForViewer(
        doneSet,
        'approval',
        'Approver',
        'Inpex Operations Australia',
        assignedApproverUser,
      )).toBe(false);
    });
  });

  describe('isInspectionDue', () => {
    it('returns true when stage is Inspection, mandatoryInspectionRequired is true, and inspectionCompleted is false', () => {
      expect(isInspectionDue(baseSet)).toBe(true);
    });

    it('returns false when set is null or undefined or not due', () => {
      expect(isInspectionDue(null)).toBe(false);
      expect(isInspectionDue(undefined)).toBe(false);
      expect(isInspectionDue({ ...baseSet, stage: 'Initiated' })).toBe(false);
      expect(isInspectionDue({ ...baseSet, mandatoryInspectionRequired: false })).toBe(false);
      expect(isInspectionDue({ ...baseSet, inspectionCompleted: true })).toBe(false);
    });
  });

  describe('constants', () => {
    it('exports expected title and status constants', () => {
      expect(INSPECTION_TASK_TITLE).toBe('Inspection');
      expect(INSPECTION_TASK_STATUS).toBe('To Inspect');
      expect(APPROVAL_TASK_TITLE).toBe('Approval');
      expect(APPROVAL_TASK_STATUS).toBe('To Approve');
    });
  });
});
