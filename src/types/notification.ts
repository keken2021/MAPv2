/*
  file summary: in-app notification types for requests, assignments, verification, document renewal, approval and capa events.
  responsibilities: defines the notification record, its type, category and status enums, and the assurance set request payload.
  role in system: consumed by useMapStore, notificationMockData, notificationHelpers, NotificationPanel and NotificationsView.
*/

import { UserRolePersona } from './audit';
import { ProjectAssetType } from './project';

export type NotificationStatus = 'unread' | 'read' | 'actioned';

export type NotificationType =
  | 'assurance_set_request'
  | 'stakeholder_assigned'
  | 'review_requested'
  | 'document_correction'
  | 'document_renewal'
  | 'approval_requested'
  | 'approval_decision'
  | 'capa_reinspection'
  /* a new version of a document this set uses was submitted on another set; this set keeps its own decision */
  | 'document_new_version';

export type NotificationCategory =
  | 'Assurance Request'
  | 'Assignment'
  | 'Verification'
  | 'Document Renewal'
  | 'Approval'
  | 'CAPA';

/** why a document on an assurance set must be renewed; present on document_renewal only */
export type DocumentRenewalReason =
  | 'expired'
  | 'charter_window'
  | 'expiring'
  | 'reupload_requested';

export type NotificationTab = 'all' | 'unread' | 'actioned';

/** payload of an assurance set request: who must create the set and for which client */
export interface AssuranceSetRequestPayload {
  /** user the assurance set is to be created by */
  assigneeUserId: string;
  assigneeName: string;
  /** client of the project at the time of the request; the created set takes this client */
  clientOrganization: string;
  /** legacy single scope hint; set when exactly one scope is suggested */
  suggestedScope?: ProjectAssetType;
  /** optional scope hints; empty means no preference */
  suggestedScopes?: ProjectAssetType[];
  /** project assets the requester suggested; each assurance set still belongs to one asset */
  suggestedAssets?: SuggestedAssuranceAsset[];
  createdAssuranceSetId?: string;
}

export interface SuggestedAssuranceAsset {
  assetId: string;
  assetType: ProjectAssetType;
  assetName: string;
}

export interface AppNotification {
  id: string; // e.g. MAP-NTF-2026-ASRQ-00001
  type: NotificationType;
  subject: string;
  message?: string;
  recipientUserId: string;
  senderUserId?: string;
  senderName: string;
  projectId?: string;
  projectName?: string;
  status: NotificationStatus;
  createdAt: string; // ISO 8601 UTC
  readAt?: string;
  actionedAt?: string;
  /* record the row action opens */
  assuranceSetId?: string;
  documentId?: string;
  capaId?: string;
  vesselName?: string;
  /** present on document_renewal only */
  renewalReason?: DocumentRenewalReason;
  /** workflow role the recipient was assigned, for stakeholder_assigned */
  assignedRole?: UserRolePersona;
  /** present on assurance_set_request only */
  request?: AssuranceSetRequestPayload;
}

/** values a store action supplies when raising a notification; id, status and createdAt are assigned by the store */
export type NotificationDraft = Omit<AppNotification, 'id' | 'status' | 'createdAt' | 'readAt' | 'actionedAt'>;

export interface NotificationTypeMeta {
  category: NotificationCategory;
  /** category segment of the MAP-NTF id */
  idCode: string;
  actionLabel: string;
}

export interface NotificationStatusMeta {
  label: string;
  background: string;
  text: string;
}
