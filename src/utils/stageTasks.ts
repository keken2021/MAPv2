/*
  file summary: pure business logic governing stage-derived task rows (Inspection and Approval) on assurance sets.
  responsibilities: computes task row status, outcome labels, notes, and viewer actionability for Inspection and Approval tasks.
  role in system: consumed by AssuranceDetailTasksTab, ProjectTasksTable, useMapStore, and notification helpers.
*/

import { AssuranceSet, AssuranceStage } from '../types/assurance';
import { UserRolePersona } from '../types/audit';
import { UserProfile } from '../types/user';
import { TaskStatus } from '../components/tables/ProjectTasksTable';
import { getAssuranceSetRoleActions } from './rbacHelpers';

export const INSPECTION_TASK_TITLE = 'Inspection';
export const INSPECTION_TASK_STATUS: TaskStatus = 'To Inspect';

export const APPROVAL_TASK_TITLE = 'Approval';
export const APPROVAL_TASK_STATUS: TaskStatus = 'To Approve';

export interface StageTaskStatusInfo {
  status: TaskStatus;
  outcomeLabel?: string;
  note?: string;
}

const STAGES_BEFORE_INSPECTION: ReadonlySet<AssuranceStage> = new Set([
  'Initiated',
  'Validation',
  'Verification',
]);

const STAGES_BEFORE_APPROVAL: ReadonlySet<AssuranceStage> = new Set([
  'Initiated',
  'Validation',
  'Verification',
  'Inspection',
]);

/**
 * Derives the Inspection task status for an assurance set:
 * - mandatoryInspectionRequired false, or stage before Inspection: null (no row)
 * - stage Inspection, not completed, not failed: To Inspect
 * - stage Inspection, not completed, after a failed inspection: On-going, note "Inspection failed"
 * - inspectionCompleted true: Done, outcomeLabel "Passed"
 */
export function getInspectionTaskStatus(
  set?: Partial<Pick<AssuranceSet, 'stage' | 'mandatoryInspectionRequired' | 'inspectionCompleted' | 'inspectionFailedAt'>> | null,
): StageTaskStatusInfo | null {
  if (!set || !set.mandatoryInspectionRequired) {
    return null;
  }

  if (set.inspectionCompleted) {
    return {
      status: 'Done',
      outcomeLabel: 'Passed',
    };
  }

  if (!set.stage || STAGES_BEFORE_INSPECTION.has(set.stage)) {
    return null;
  }

  if (set.inspectionFailedAt) {
    return {
      status: 'On-going',
      note: 'Inspection failed',
    };
  }

  return {
    status: 'To Inspect',
  };
}

/**
 * Derives the Approval task status for an assurance set:
 * - approverDecision Approved or Rejected: Done, outcomeLabel Approved | Rejected
 * - approverDecision Returned for Correction, set back before Approval: On-going, note "Returned for correction"
 * - stage Approval, decision Pending or none: To Approve
 * - stage before Approval, never decided: null (no row)
 */
export function getApprovalTaskStatus(
  set?: Partial<Pick<AssuranceSet, 'stage' | 'approverDecision'>> | null,
): StageTaskStatusInfo | null {
  if (!set) return null;

  if (set.approverDecision === 'Approved' || set.approverDecision === 'Rejected') {
    return {
      status: 'Done',
      outcomeLabel: set.approverDecision,
    };
  }

  if (set.approverDecision === 'Returned for Correction') {
    return {
      status: 'On-going',
      note: 'Returned for correction',
    };
  }

  if (set.stage === 'Approval') {
    return {
      status: 'To Approve',
    };
  }

  if (set.stage === 'Approved' || set.stage === 'Certified') {
    return {
      status: 'Done',
      outcomeLabel: 'Approved',
    };
  }

  return null;
}

/**
 * Determines whether a stage task row (Inspection or Approval) has an open, actionable button for the viewer:
 * - For inspection: open while stage is Inspection and inspectionCompleted is false.
 *   Only assigned inspector gets Inspect; everyone else gets View.
 * - For approval: open while stage is Approval and decision is Pending or none.
 *   Only assigned approver gets Approve; everyone else gets View.
 * - Completed stage rows get View (not actionable).
 * - Returned for correction approval row gets none (not actionable).
 */
export function isStageTaskActionableForViewer(
  set: AssuranceSet | null | undefined,
  kind: 'inspection' | 'approval' | string,
  persona: UserRolePersona,
  organization?: string,
  user?: Pick<UserProfile, 'id' | 'name' | 'organization' | 'roles'> | null,
): boolean {
  if (!set) return false;
  const normalizedKind = kind.toLowerCase();

  if (normalizedKind === 'inspection') {
    const statusInfo = getInspectionTaskStatus(set);
    if (!statusInfo || statusInfo.status === 'Done') {
      return false;
    }
    const roleActions = getAssuranceSetRoleActions(set, persona, organization, user);
    return Boolean(roleActions.canInspect);
  }

  if (normalizedKind === 'approval') {
    const statusInfo = getApprovalTaskStatus(set);
    if (!statusInfo || statusInfo.status !== 'To Approve') {
      return false;
    }
    const roleActions = getAssuranceSetRoleActions(set, persona, organization, user);
    return Boolean(roleActions.canApprove);
  }

  return false;
}

/**
 * Returns true if an assurance set is currently waiting on inspection:
 * 1. set.stage === 'Inspection'
 * 2. set.mandatoryInspectionRequired is true
 * 3. set.inspectionCompleted is false
 * Kept for store inspection notifications.
 */
export function isInspectionDue(
  set?: Partial<Pick<AssuranceSet, 'stage' | 'mandatoryInspectionRequired' | 'inspectionCompleted'>> | null,
): boolean {
  if (!set) return false;
  return (
    set.stage === 'Inspection' &&
    Boolean(set.mandatoryInspectionRequired) &&
    !set.inspectionCompleted
  );
}

/**
 * Backward compatibility helper for inspection actionability.
 */
export function isInspectionDueForViewer(
  set: AssuranceSet | null | undefined,
  persona: UserRolePersona,
  organization?: string,
  user?: Pick<UserProfile, 'id' | 'name' | 'organization' | 'roles'> | null,
): boolean {
  return isStageTaskActionableForViewer(set, 'inspection', persona, organization, user);
}

