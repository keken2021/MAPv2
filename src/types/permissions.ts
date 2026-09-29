/*
  file summary: role and user permission matrix types for MAP RBAC settings.
  responsibilities: defines CRUD flags, scope catalog keys, role defaults, and per-user overrides.
  role in system: consumed by permissionDefaults, permissionHelpers, RolesAndPermissionsView, and useMapStore.
*/

import { UserRolePersona } from './audit';

export type CrudAction = 'create' | 'read' | 'update' | 'delete';

export interface CrudFlags {
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
}

export type PermissionScopeKey =
  | 'vessels'
  | 'equipment'
  | 'vessel_status'
  | 'assurance_sets'
  | 'assurance_requirements'
  | 'workflow_assignment'
  | 'third_party_delegation'
  | 'users'
  | 'role_rights'
  | 'validation_thresholds'
  | 'crew'
  | 'crew_certificates'
  | 'documents'
  | 'document_vault'
  | 'document_linking'
  | 'document_exceptions'
  | 'verification_queue'
  | 'verification_decisions'
  | 'ocr_results'
  | 'inspection_workspace'
  | 'inspection_findings'
  | 'inspection_evidence'
  | 'post_inspection_review'
  | 'capa'
  | 'approval_gate'
  | 'approval_decisions'
  | 'assurance_completion'
  | 'dashboard'
  | 'audit_trail'
  | 'compliance_export';

export type PermissionCategory = string;

export interface PermissionScopeDefinition {
  key: string;
  label: string;
  description: string;
  category: PermissionCategory;
  /** When true, Create is not applicable and stays locked off */
  lockCreate?: boolean;
  lockRead?: boolean;
  lockUpdate?: boolean;
  lockDelete?: boolean;
  /** Hard BRD locks that admin UI cannot enable for specific roles */
  hardDeny?: Partial<Record<string, CrudAction[]>>;
  /** True when admin created this scope at runtime */
  isCustom?: boolean;
}

/** Role name — BRD personas plus any admin-created custom roles */
export type RoleName = UserRolePersona | string;

export type RolePermissionMatrix = Record<string, Record<string, CrudFlags>>;

export type UserPermissionOverrides = Record<
  string,
  Partial<Record<string, Partial<CrudFlags>>>
>;

export const CRUD_ACTIONS: CrudAction[] = ['create', 'read', 'update', 'delete'];

export const ALL_ROLE_PERSONAS: UserRolePersona[] = [
  'Administrator',
  'C Admin',
  'Submitter',
  'Verifier',
  'Inspector',
  'Approver',
];

/** Vessel-owner admin — not assignable as an assurance operational role */
export const SYSTEM_ROLE_PERSONAS: UserRolePersona[] = ['Administrator'];

/** Built-in module groupings (admin can add more categories at runtime) */
export const BUILTIN_PERMISSION_CATEGORIES: string[] = [
  'Setup & configuration',
  'Crew',
  'Documents & submission',
  'Verification',
  'Physical inspection & CAPA',
  'Approval',
  'Visibility & compliance',
];

/** @deprecated Use BUILTIN_PERMISSION_CATEGORIES — kept for older imports */
export const PERMISSION_CATEGORIES = BUILTIN_PERMISSION_CATEGORIES;

export const emptyCrud = (): CrudFlags => ({
  create: false,
  read: false,
  update: false,
  delete: false,
});

export const fullCrud = (): CrudFlags => ({
  create: true,
  read: true,
  update: true,
  delete: true,
});

export const readOnly = (): CrudFlags => ({
  create: false,
  read: true,
  update: false,
  delete: false,
});

export const readUpdate = (): CrudFlags => ({
  create: false,
  read: true,
  update: true,
  delete: false,
});

export const createReadUpdate = (): CrudFlags => ({
  create: true,
  read: true,
  update: true,
  delete: false,
});

export function slugifyPermissionKey(label: string): string {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return base || `custom_${Date.now()}`;
}