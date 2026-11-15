/*
  file summary: pure functions for reading stakeholder and creator assignments from an assurance set.
  responsibilities: provides single source of truth for submitter, verifier, inspector, approver, and createdBy fields.
  role in system: replaces retired assignedStakeholders, assignedVerifier, etc. under ADR 0042.
*/

import type {
  AssuranceSet,
  AssuranceStakeholderMapping,
  SetSubmitter,
} from '../types/assurance';

export interface SetStakeholdersInput {
  submitters?: SetSubmitter[];
  stakeholders?: AssuranceStakeholderMapping | null;
  createdBy?: {
    userId?: string;
    name?: string;
    persona?: string;
  };
  /* legacy fields during migration */
  assignedSubmitter?: string;
  assignedVerifier?: string;
  assignedInspector?: string;
  assignedApprover?: string;
  assignedStakeholders?: AssuranceStakeholderMapping | null;
  createdByUserId?: string;
  createdByName?: string;
  createdByPersona?: string;
  initiatorRole?: string;
}

/**
 * Returns the primary submitter assignee string (e.g. "M. Chen (Northwind Marine Pty Ltd)").
 * Reads from the first element of the submitters array.
 */
export function getSetAssignedSubmitter(set?: SetStakeholdersInput | null): string {
  if (!set) return '';
  if (Array.isArray(set.submitters) && set.submitters.length > 0) {
    return set.submitters[0].assignee || '';
  }
  if (set.assignedSubmitter) return set.assignedSubmitter;
  return '';
}

/**
 * Returns the verifier assignee display string for the assurance set.
 * Reads from the single stakeholders mapping.
 */
export function getSetAssignedVerifier(set?: SetStakeholdersInput | null): string {
  if (!set) return '';
  if (set.assignedVerifier) return set.assignedVerifier;
  const mapping = set.stakeholders || set.assignedStakeholders;
  if (mapping?.verifierName) {
    if (mapping.verifierOrg && !mapping.verifierName.includes(`(${mapping.verifierOrg})`)) {
      return `${mapping.verifierName} (${mapping.verifierOrg})`;
    }
    return mapping.verifierName;
  }
  if (mapping?.verifierOrg || (set as any)?.verificationRequired) {
    return 'Pending Assignment';
  }
  return '';
}

/**
 * Returns the inspector assignee display string for the assurance set.
 * Reads from the single stakeholders mapping.
 */
export function getSetAssignedInspector(set?: SetStakeholdersInput | null): string {
  if (!set) return '';
  if (set.assignedInspector) return set.assignedInspector;
  const mapping = set.stakeholders || set.assignedStakeholders;
  if (mapping?.inspectorName) {
    if (mapping.inspectorOrg && !mapping.inspectorName.includes(`(${mapping.inspectorOrg})`)) {
      return `${mapping.inspectorName} (${mapping.inspectorOrg})`;
    }
    return mapping.inspectorName;
  }
  if (mapping?.inspectorOrg || (set as any)?.mandatoryInspectionRequired) {
    return 'Pending Assignment';
  }
  return '';
}

/**
 * Returns the approver assignee display string for the assurance set.
 * Reads from the single stakeholders mapping.
 */
export function getSetAssignedApprover(set?: SetStakeholdersInput | null): string {
  if (!set) return '';
  if (set.assignedApprover) return set.assignedApprover;
  const mapping = set.stakeholders || set.assignedStakeholders;
  if (mapping?.approverName) {
    if (mapping.approverOrg && !mapping.approverName.includes(`(${mapping.approverOrg})`)) {
      return `${mapping.approverName} (${mapping.approverOrg})`;
    }
    return mapping.approverName;
  }
  if (mapping?.approverOrg || (set as any)?.formalApprovalRequired) {
    return 'Pending Assignment';
  }
  return '';
}

/**
 * Returns the creator identity record (userId, name, persona) of the assurance set.
 */
export function getSetCreatedBy(set?: SetStakeholdersInput | null): {
  userId?: string;
  name?: string;
  persona?: string;
} {
  if (!set) return {};
  return {
    userId: set.createdBy?.userId || set.createdByUserId,
    name: set.createdBy?.name || set.createdByName,
    persona: set.createdBy?.persona || set.createdByPersona,
  };
}
