/*
  file summary: BRD-seeded permission scope catalog and default role CRUD matrix.
  responsibilities: defines all MAP permission scopes and builds Administrator/C Admin/Submitter/Verifier/Inspector/Approver defaults from the Roles & CRUD matrix.
  role in system: consumed by permissionHelpers, useMapStore initialization, and RolesAndPermissionsView reset.
*/

import { UserRolePersona } from '../types/audit';
import {
  ALL_ROLE_PERSONAS,
  CrudAction,
  CrudFlags,
  PermissionScopeDefinition,
  PermissionScopeKey,
  RolePermissionMatrix,
  createReadUpdate,
  emptyCrud,
  fullCrud,
  readOnly,
  readUpdate,
} from '../types/permissions';

export const PERMISSION_SCOPE_CATALOG: PermissionScopeDefinition[] = [
  {
    key: 'vessels',
    label: 'Fleet / Vessel Registry (Sidepanel Page)',
    description: 'Controls showing/hiding the Vessels sidepanel button and fleet registry page access.',
    category: 'Setup & configuration',
    lockDelete: true,
  },
  {
    key: 'equipment',
    label: 'Equipment Registry (Sidepanel Page)',
    description: 'Controls showing/hiding the Equipment sidepanel button and fleet equipment page access.',
    category: 'Setup & configuration',
    lockDelete: true,
  },
  {
    key: 'vessel_status',
    label: 'Vessel operating status',
    description: 'View and change operating status (in operations, dry dock, under charter, etc.).',
    category: 'Setup & configuration',
    lockCreate: true,
    lockDelete: true,
  },
  {
    key: 'assurance_sets',
    label: 'Assurance Sets (Sidepanel Page)',
    description: 'Controls showing/hiding the Assurance Sets sidepanel button and campaign view access.',
    category: 'Setup & configuration',
    lockDelete: true,
  },
  {
    key: 'assurance_requirements',
    label: 'Assurance requirement checklist',
    description: 'Add custom requirements and toggle mandatory/optional compliance items.',
    category: 'Setup & configuration',
    lockDelete: true,
  },
  {
    key: 'workflow_assignment',
    label: 'Workflow role assignment',
    description: 'Assign Submitter, Verifier, Inspector, and Approver on an assurance set (UC-04).',
    category: 'Setup & configuration',
    lockDelete: true,
  },
  {
    key: 'third_party_delegation',
    label: 'Third-party delegation',
    description: 'Invite third parties with vessel/set scope and access duration. Delete = archive/revoke.',
    category: 'Setup & configuration',
  },
  {
    key: 'users',
    label: 'User Accounts (Sidepanel Page)',
    description: 'Controls showing/hiding the User Management sidepanel button and directory page access. Delete = archive.',
    category: 'Setup & configuration',
  },
  {
    key: 'role_rights',
    label: 'Role Rights Matrix (Sidepanel Page)',
    description:
      'BRD blank for all roles. The Roles & Permissions settings screen is available to Administrator as a system settings page; rights cannot be granted via this matrix row.',
    category: 'Setup & configuration',
  },
  {
    key: 'validation_thresholds',
    label: 'Validation thresholds / rules',
    description: 'Configure confidence, expiry windows, DPI, and identity-match rules. BRD blank for all roles.',
    category: 'Setup & configuration',
    lockCreate: true,
    lockDelete: true,
  },
  {
    key: 'crew',
    label: 'Crew Directory (Sidepanel Page)',
    description: 'Controls showing/hiding the Crew Directory sidepanel button and seafarer roster page access.',
    category: 'Crew',
    lockDelete: true,
  },
  {
    key: 'crew_certificates',
    label: 'Crew profile & certificate links',
    description: 'Attach and manage STCW and medical certificate links on crew profiles.',
    category: 'Crew',
    lockDelete: true,
  },
  {
    key: 'documents',
    label: 'Document Library (Sidepanel Page)',
    description: 'Controls showing/hiding the Document Library sidepanel button and vault page access.',
    category: 'Documents & submission',
    lockDelete: true,
  },
  {
    key: 'document_vault',
    label: 'Pre-assurance document vault',
    description: 'Upload and maintain reusable documents before an assurance set exists.',
    category: 'Documents & submission',
    lockDelete: true,
  },
  {
    key: 'document_linking',
    label: 'Link document to Assurance Set',
    description: 'Associate existing master documents with assurance requirements.',
    category: 'Documents & submission',
    lockDelete: true,
  },
  {
    key: 'document_exceptions',
    label: 'Exception / re-upload',
    description: 'View validation exceptions and resubmit corrected evidence (UC-07).',
    category: 'Documents & submission',
    lockDelete: true,
  },
  {
    key: 'verification_queue',
    label: 'Verification Queue (Sidepanel Page)',
    description: 'Controls showing/hiding the Verification Queue sidepanel button and verifier workspace.',
    category: 'Verification',
    lockCreate: true,
    lockUpdate: true,
    lockDelete: true,
  },
  {
    key: 'verification_decisions',
    label: 'Document verification decisions',
    description: 'Verify, request correction, or reject documents (UC-08).',
    category: 'Verification',
    lockCreate: true,
    lockDelete: true,
  },
  {
    key: 'ocr_results',
    label: 'OCR / extraction results',
    description: 'View extracted metadata and confidence scores; correct fields when allowed.',
    category: 'Verification',
    lockCreate: true,
    lockUpdate: true,
    lockDelete: true,
  },
  {
    key: 'inspection_workspace',
    label: 'Physical Inspections (Sidepanel Page)',
    description: 'Controls showing/hiding the Physical Inspections sidepanel button and inspector workspace.',
    category: 'Physical inspection & CAPA',
    lockCreate: true,
    lockUpdate: true,
    lockDelete: true,
  },
  {
    key: 'inspection_findings',
    label: 'Inspection checklist / findings',
    description: 'Record checklist outcomes, comments, and condition results.',
    category: 'Physical inspection & CAPA',
    lockDelete: true,
  },
  {
    key: 'inspection_evidence',
    label: 'Inspection evidence',
    description: 'Upload and manage photos and survey reports from the field.',
    category: 'Physical inspection & CAPA',
    lockDelete: true,
  },
  {
    key: 'post_inspection_review',
    label: 'Post-inspection review join',
    description: 'Join review after inspection when explicitly assigned (e.g. Verifier override).',
    category: 'Physical inspection & CAPA',
    lockCreate: true,
    lockUpdate: true,
    lockDelete: true,
  },
  {
    key: 'capa',
    label: 'CAPA Tracker (Sidepanel Page)',
    description: 'Controls showing/hiding the CAPA Tracker sidepanel button. BRD blank for all roles.',
    category: 'Physical inspection & CAPA',
    lockDelete: true,
  },
  {
    key: 'approval_gate',
    label: 'Approval Gate (Sidepanel Page)',
    description: 'Controls showing/hiding the Approval Gate sidepanel button and approver dashboard page access.',
    category: 'Approval',
    lockCreate: true,
    lockUpdate: true,
    lockDelete: true,
  },
  {
    key: 'approval_decisions',
    label: 'Approve / return / reject',
    description: 'Make approval decisions on requirements with mandatory comments.',
    category: 'Approval',
    lockCreate: true,
    lockDelete: true,
  },
  {
    key: 'assurance_completion',
    label: 'Complete / certify Assurance Set',
    description: 'Issue final sign-off when all mandatory requirements are approved.',
    category: 'Approval',
    lockCreate: true,
    lockDelete: true,
  },
  {
    key: 'dashboard',
    label: 'Dashboard (Sidepanel Page)',
    description: 'Controls showing/hiding the Dashboard sidepanel button and command view page access.',
    category: 'Visibility & compliance',
    lockCreate: true,
    lockUpdate: true,
    lockDelete: true,
  },
  {
    key: 'audit_trail',
    label: 'Audit Trail (Sidepanel Page)',
    description: 'Controls showing/hiding the Audit Trail sidepanel button and logs view page access.',
    category: 'Visibility & compliance',
    lockCreate: true,
    lockUpdate: true,
    lockDelete: true,
  },
  {
    key: 'compliance_export',
    label: 'Compliance / regulator export',
    description: 'Generate and download controlled compliance packs. BRD blank for all roles.',
    category: 'Visibility & compliance',
    lockUpdate: true,
    lockDelete: true,
  },
];

const SCOPE_KEYS = PERMISSION_SCOPE_CATALOG.map((s) => s.key);

/**
  what: returns BRD matrix CRUD flags for one role × scope (blank cell = all false).
*/
function flagsForRole(role: UserRolePersona, key: string): CrudFlags {
  switch (key) {
    case 'vessels':
    case 'equipment':
      if (role === 'Administrator') return createReadUpdate();
      if (role === 'C Admin' || role === 'Submitter' || role === 'Inspector') return readOnly();
      return emptyCrud();

    case 'vessel_status':
      if (role === 'Administrator') return readUpdate();
      if (role === 'C Admin' || role === 'Submitter') return readOnly();
      return emptyCrud();

    case 'assurance_sets':
      if (role === 'Administrator') return createReadUpdate();
      if (role === 'C Admin') return createReadUpdate();
      if (role === 'Submitter' || role === 'Verifier' || role === 'Inspector' || role === 'Approver') return readOnly();
      return emptyCrud();

    case 'assurance_requirements':
      if (role === 'Administrator' || role === 'C Admin') return createReadUpdate();
      if (role === 'Submitter') return readOnly();
      return emptyCrud();

    case 'workflow_assignment':
      if (role === 'Administrator') return createReadUpdate();
      return emptyCrud();

    case 'third_party_delegation':
      /* D* kept as Delete in matrix; product behaviour is archive/revoke */
      if (role === 'Administrator') return fullCrud();
      return emptyCrud();

    case 'users':
      /* administrator has full crud; c admin can create, read, and update own-created users (restricted to verifier, approver, inspector roles only) */
      if (role === 'Administrator') return fullCrud();
      if (role === 'C Admin') return { create: true, read: true, update: true, delete: false };
      return emptyCrud();

    case 'role_rights':
    case 'validation_thresholds':
    case 'compliance_export':
      return emptyCrud();

    case 'capa':
      if (role === 'Administrator' || role === 'Inspector') return createReadUpdate();
      if (role === 'C Admin') return readOnly();
      return emptyCrud();

    case 'crew':
      if (role === 'Administrator') return createReadUpdate();
      return emptyCrud();

    case 'crew_certificates':
      if (role === 'Administrator' || role === 'Submitter') return createReadUpdate();
      if (role === 'C Admin') return readOnly();
      return emptyCrud();

    case 'documents':
    case 'document_linking':
      if (role === 'Administrator' || role === 'Submitter') return createReadUpdate();

      return emptyCrud();

    case 'document_vault':
      if (role === 'Administrator' || role === 'Submitter') return createReadUpdate();
      return emptyCrud();

    case 'document_exceptions':
      if (role === 'Submitter') return createReadUpdate();
      if (role === 'Administrator' || role === 'C Admin' || role === 'Verifier') {
        return readOnly();
      }
      return emptyCrud();

    case 'verification_queue':
      if (role === 'Submitter' || role === 'Verifier') {
        return readOnly();
      }
      return emptyCrud();

    case 'verification_decisions':
      if (role === 'Verifier') return readUpdate();
      if (role === 'Administrator') return readOnly();
      return emptyCrud();

    case 'ocr_results':
      if (
        role === 'Administrator' ||
        role === 'C Admin' ||
        role === 'Submitter' ||
        role === 'Verifier' ||
        role === 'Approver' ||
        role === 'Inspector'
      ) {
        return readOnly();
      }
      return emptyCrud();

    case 'inspection_workspace':
      if (role === 'Administrator') return readOnly();
      if (role === 'Inspector') return readUpdate();
      return emptyCrud();

    case 'inspection_findings':
    case 'inspection_evidence':
      if (role === 'Inspector') return createReadUpdate();
      if (role === 'Administrator') return readOnly();
      return emptyCrud();

    case 'post_inspection_review':
      if (role === 'Administrator' || role === 'Verifier' || role === 'Inspector') {
        return readOnly();
      }
      return emptyCrud();

    case 'approval_gate':
      // if (role === 'Administrator') re turn readOnly();
      if (role === 'Approver') return readUpdate();
      return emptyCrud();

    case 'approval_decisions':
      if (role === 'Approver') return readUpdate();
      if (role === 'C Admin') return readUpdate();
      if (role === 'Administrator') return readOnly();
      return emptyCrud();

    case 'assurance_completion':
      if (role === 'Approver' || role === 'C Admin') return readUpdate();
      return emptyCrud();

    case 'dashboard':
    case 'audit_trail':
      return readOnly();

    default:
      return emptyCrud();
  }
}

/**
  what: builds a complete role permission matrix seeded from the Roles & CRUD permission table.
*/
export function buildBrdRolePermissionDefaults(): RolePermissionMatrix {
  const matrix = {} as RolePermissionMatrix;
  for (const role of ALL_ROLE_PERSONAS) {
    matrix[role] = {} as Record<PermissionScopeKey, CrudFlags>;
    for (const key of SCOPE_KEYS) {
      matrix[role][key] = flagsForRole(role, key);
    }
  }
  return matrix;
}

/** Immutable BRD baseline — blank cells are hard-locked in the matrix UI */
export const BRD_ROLE_PERMISSION_BASELINE = buildBrdRolePermissionDefaults();

/**
  what: true when this role × scope × action is blank in the BRD matrix (button must stay disabled).
  how: only applies to built-in BRD personas; custom roles and custom scopes are not locked by BRD.
       C Admin verification scopes and Verifier approval scopes stay unlockable so Administrator can grant dual-role access (BRD dual-role note).
*/
export function isBrdHardDenied(role: string, scopeKey: string, action: CrudAction): boolean {
  if (!(ALL_ROLE_PERSONAS as string[]).includes(role)) return false;

  /* BRD: C Admin may hold Verifier access when explicitly designated under the assurance agreement */
  if (
    role === 'C Admin' &&
    (scopeKey === 'verification_queue' || scopeKey === 'verification_decisions')
  ) {
    return false;
  }

  /* BRD: Verifier may also hold Approver access when explicitly granted in role defaults */
  if (
    role === 'Verifier' &&
    (scopeKey === 'approval_gate' ||
      scopeKey === 'approval_decisions' ||
      scopeKey === 'assurance_completion')
  ) {
    return false;
  }

  const baseline = BRD_ROLE_PERMISSION_BASELINE[role]?.[scopeKey];
  if (!baseline) return false;
  return !baseline[action];
}

export function getScopeDefinition(
  key: string,
  extraScopes: PermissionScopeDefinition[] = [],
): PermissionScopeDefinition | undefined {
  return (
    PERMISSION_SCOPE_CATALOG.find((s) => s.key === key) ||
    extraScopes.find((s) => s.key === key)
  );
}

export function countEnabledRights(matrix: Record<string, CrudFlags>): number {
  let count = 0;
  for (const flags of Object.values(matrix)) {
    if (!flags) continue;
    if (flags.create) count += 1;
    if (flags.read) count += 1;
    if (flags.update) count += 1;
    if (flags.delete) count += 1;
  }
  return count;
}

export function buildEmptyFlagsForCatalog(
  catalog: PermissionScopeDefinition[],
): Record<string, CrudFlags> {
  const row: Record<string, CrudFlags> = {};
  for (const scope of catalog) {
    row[scope.key] = emptyCrud();
  }
  return row;
}
