/* 
  file summary: Audit Trail log event interfaces for the marine assurance platform (map).
  responsibilities: defines structured event entries recording timestamps, user ids, persona roles, field deltas, and compliance status changes.
  role in system: consumed by audit trail offcanvas drawer, store audit logging actions, and compliance reporting.
*/

export type UserRolePersona =
  | "Administrator"
  | "C Admin"
  | "Submitter"
  | "Verifier"
  | "Inspector"
  | "Approver";

export interface AuditTrailEvent {
  id: string; // e.g. AUD-90481
  timestampUtc: string; // ISO 8601 UTC
  userId: string;
  userRole: UserRolePersona;
  organization: string;
  action: string; // e.g. "Verified Certificate", "Registered Vessel", "Logged CAPA Defect"
  targetAsset: string; // e.g. MV Pacific Endeavour / AS-2026-001
  fieldDelta?: {
    fieldName: string;
    oldValue: string;
    newValue: string;
  };
  documentStatusDelta?: {
    documentId: string;
    oldStatus: string;
    newStatus: string;
  };
  justificationNotes?: string;
}
