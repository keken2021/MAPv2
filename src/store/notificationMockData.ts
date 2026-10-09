/*
  file summary: seeded in-app notifications and the display metadata for notification types, statuses and tabs.
  responsibilities: populates the initial inbox for each signed-in persona user and maps types to categories, id codes and action labels, and statuses to their color pairs.
  role in system: loaded by useMapStore.ts on initialization; metadata consumed by notificationHelpers.ts, NotificationPanel.tsx and NotificationsView.tsx.
*/

import { UserRolePersona } from '../types/audit';
import {
  AppNotification,
  NotificationCategory,
  NotificationStatus,
  NotificationStatusMeta,
  NotificationTab,
  NotificationType,
  NotificationTypeMeta,
} from '../types/notification';

export const NOTIFICATION_TYPE_META: Record<NotificationType, NotificationTypeMeta> = {
  assurance_set_request: { category: 'Assurance Request', idCode: 'ASRQ', actionLabel: 'Create Set' },
  stakeholder_assigned: { category: 'Assignment', idCode: 'ASGN', actionLabel: 'Open Set' },
  review_requested: { category: 'Verification', idCode: 'VERF', actionLabel: 'Review Documents' },
  document_correction: { category: 'Verification', idCode: 'VERF', actionLabel: 'Open Document' },
  approval_requested: { category: 'Approval', idCode: 'APRV', actionLabel: 'Review Approval' },
  approval_decision: { category: 'Approval', idCode: 'APRV', actionLabel: 'Open Set' },
  capa_reinspection: { category: 'CAPA', idCode: 'CAPA', actionLabel: 'Open CAPA' },
};

/* row action shown on an assurance set request once its set exists */
export const NOTIFICATION_REQUEST_FULFILLED_ACTION_LABEL = 'Open Set';

/* row action for a stakeholder assignment, by the role the recipient was given */
export const NOTIFICATION_ASSIGNMENT_ACTION_LABELS: Partial<Record<UserRolePersona, string>> = {
  Submitter: 'Upload Documents',
  Verifier: 'Review Documents',
  Inspector: 'Start Inspection',
  Approver: 'Review Approval',
};

export const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  'Assurance Request',
  'Assignment',
  'Verification',
  'Approval',
  'CAPA',
];

export const NOTIFICATION_STATUS_META: Record<NotificationStatus, NotificationStatusMeta> = {
  unread: { label: 'Unread', background: '#E1F3FE', text: '#1F6C9F' },
  read: { label: 'Read', background: '#F8FAFC', text: '#64748B' },
  actioned: { label: 'Actioned', background: '#EDF3EC', text: '#346538' },
};

/* shown when the signed-in user has no notifications at all */
export const NOTIFICATION_EMPTY_INBOX_TEXT =
  'Requests, assignments and review updates addressed to you appear here.';

export const NOTIFICATION_TABS: { key: NotificationTab; label: string; emptyText: string }[] = [
  {
    key: 'all',
    label: 'All',
    emptyText: NOTIFICATION_EMPTY_INBOX_TEXT,
  },
  {
    key: 'unread',
    label: 'Unread',
    emptyText: 'You have read every notification.',
  },
  {
    key: 'actioned',
    label: 'Actioned',
    emptyText: 'Notifications move here once you complete or open the linked task.',
  },
];

/* number of notifications listed in the header bell dropdown */
export const NOTIFICATION_PANEL_LIMIT = 5;

export const MOCK_NOTIFICATIONS: AppNotification[] = [
  /* k. osei - vessel admin */
  {
    id: 'MAP-NTF-2026-ASRQ-00001',
    type: 'assurance_set_request',
    subject: 'Assurance set creation requested',
    message: 'Escort vessel still needs a vetting set before the transit window opens.',
    recipientUserId: 'USR-101',
    senderUserId: 'USR-104',
    senderName: 'E. Rostova',
    projectId: 'MAP-PROJ-2026-MARINE-007',
    projectName: 'Northwind Dangerous Route Transit',
    status: 'unread',
    createdAt: '2026-10-08T03:15:00.000Z',
    request: {
      assigneeUserId: 'USR-101',
      assigneeName: 'K. Osei',
      clientOrganization: 'Northwind Marine Pty Ltd',
      suggestedScope: 'Vessel',
    },
  },
  {
    id: 'MAP-NTF-2026-APRV-00002',
    type: 'approval_decision',
    subject: 'Approved: Schilling ROV System Mobilization Assurance',
    message: 'Mobilization evidence accepted. Set certified for the rental window.',
    recipientUserId: 'USR-101',
    senderUserId: 'USR-204',
    senderName: 'P. Nardelli',
    projectId: 'MAP-PROJ-2026-MARINE-013',
    projectName: 'Gorgon Subsea Equipment Rental & Testing',
    status: 'read',
    createdAt: '2026-10-06T09:40:00.000Z',
    readAt: '2026-10-06T22:05:00.000Z',
    assuranceSetId: 'AS-EQP-007-01',
  },
  {
    id: 'MAP-NTF-2026-APRV-00003',
    type: 'approval_decision',
    subject: 'Returned for correction: MV Pacific Endeavour — Vessel Charter Vetting',
    message: 'Safety equipment certificate expires inside the charter window.',
    recipientUserId: 'USR-101',
    senderUserId: 'USR-204',
    senderName: 'P. Nardelli',
    projectId: 'MAP-PROJ-2026-MARINE-007',
    projectName: 'Northwind Dangerous Route Transit',
    status: 'actioned',
    createdAt: '2026-10-02T05:20:00.000Z',
    readAt: '2026-10-02T06:00:00.000Z',
    actionedAt: '2026-10-02T06:00:00.000Z',
    assuranceSetId: 'AS-01-V001',
  },

  /* s. basin - client admin */
  {
    id: 'MAP-NTF-2026-ASGN-00004',
    type: 'stakeholder_assigned',
    subject: 'Assigned as Verifier: MV Kimberley Guardian — ERRV Charter Vetting',
    recipientUserId: 'USR-201',
    senderUserId: 'USR-101',
    senderName: 'K. Osei',
    status: 'unread',
    createdAt: '2026-10-08T23:50:00.000Z',
    assuranceSetId: 'AS-SBE-010-V001',
    assignedRole: 'Verifier',
  },
  {
    id: 'MAP-NTF-2026-ASGN-00005',
    type: 'stakeholder_assigned',
    subject: 'Assigned as Verifier: MV Atlantic Ocean — Platform Alpha Supply Vetting',
    recipientUserId: 'USR-201',
    senderUserId: 'USR-101',
    senderName: 'K. Osei',
    status: 'read',
    createdAt: '2026-10-05T01:10:00.000Z',
    readAt: '2026-10-05T04:30:00.000Z',
    assuranceSetId: 'AS-SBE-012-V001',
    assignedRole: 'Verifier',
  },
  {
    id: 'MAP-NTF-2026-APRV-00006',
    type: 'approval_decision',
    subject: 'Approved: Woodside Scarborough Subsea Charter',
    message: 'All statutory and inspection evidence accepted.',
    recipientUserId: 'USR-101',
    senderUserId: 'USR-219',
    senderName: 'F. Abernathy',
    projectId: 'MAP-PROJ-2026-MARINE-015',
    projectName: 'Browse Basin Annual Assurance Campaign',
    status: 'actioned',
    createdAt: '2026-09-30T07:25:00.000Z',
    readAt: '2026-09-30T08:10:00.000Z',
    actionedAt: '2026-09-30T08:10:00.000Z',
    assuranceSetId: 'AS-2026-004',
  },

  /* m. chen - submitter */
  {
    id: 'MAP-NTF-2026-VERF-00007',
    type: 'document_correction',
    subject: 'Correction requested: Cargo Ship Safety Equipment Certificate',
    message: 'Certificate expires 30 NOV 2026. Upload the renewed certificate.',
    recipientUserId: 'USR-102',
    senderUserId: 'USR-202',
    senderName: 'A. Fontaine',
    status: 'unread',
    createdAt: '2026-10-08T11:05:00.000Z',
    assuranceSetId: 'AS-2026-001',
    documentId: 'MAP-VES-2026-STAT-00002',
  },
  {
    id: 'MAP-NTF-2026-ASGN-00008',
    type: 'stakeholder_assigned',
    subject: 'Assigned as Submitter: Southern Basin Platform Support Charter',
    recipientUserId: 'USR-102',
    senderUserId: 'USR-201',
    senderName: 'S. Basin',
    projectId: 'MAP-PROJ-2026-MARINE-009',
    projectName: 'Southern Basin Platform Support Charter',
    status: 'read',
    createdAt: '2026-10-04T02:45:00.000Z',
    readAt: '2026-10-04T03:20:00.000Z',
    assuranceSetId: 'AS-2026-005',
    assignedRole: 'Submitter',
  },
  {
    id: 'MAP-NTF-2026-ASRQ-00009',
    type: 'assurance_set_request',
    subject: 'Assurance set creation requested',
    message: 'Create the vessel set for the hull cleaning contractor engagement.',
    recipientUserId: 'USR-102',
    senderUserId: 'USR-101',
    senderName: 'K. Osei',
    projectId: 'MAP-PROJ-2026-MARINE-008',
    projectName: 'Pacific Endeavour — Hull Fouling Removal',
    status: 'actioned',
    createdAt: '2026-09-28T04:00:00.000Z',
    readAt: '2026-09-28T04:35:00.000Z',
    actionedAt: '2026-09-28T05:10:00.000Z',
    request: {
      assigneeUserId: 'USR-102',
      assigneeName: 'M. Chen',
      clientOrganization: 'Northwind Marine Pty Ltd',
      suggestedScope: 'Vessel',
      createdAssuranceSetId: 'AS-01-V008',
    },
  },

  /* a. fontaine - verifier */
  {
    id: 'MAP-NTF-2026-ASGN-00010',
    type: 'stakeholder_assigned',
    subject: 'Assigned as Verifier: MV Atlantic Ocean Legacy Verification',
    recipientUserId: 'USR-202',
    senderUserId: 'USR-101',
    senderName: 'K. Osei',
    status: 'unread',
    createdAt: '2026-10-08T21:30:00.000Z',
    assuranceSetId: 'AS-2026-011',
    assignedRole: 'Verifier',
  },
  {
    id: 'MAP-NTF-2026-VERF-00011',
    type: 'review_requested',
    subject: 'Review requested: Schilling ROV System Mobilization Assurance',
    message: 'Mobilization dossier uploaded and ready for statutory review.',
    recipientUserId: 'USR-202',
    senderUserId: 'USR-101',
    senderName: 'K. Osei',
    status: 'read',
    createdAt: '2026-10-05T12:15:00.000Z',
    readAt: '2026-10-05T13:00:00.000Z',
    assuranceSetId: 'AS-2026-008',
  },
  {
    id: 'MAP-NTF-2026-VERF-00012',
    type: 'review_requested',
    subject: 'Review requested: Chevron Gorgon Charter Vetting',
    recipientUserId: 'USR-202',
    senderUserId: 'USR-201',
    senderName: 'S. Basin',
    status: 'actioned',
    createdAt: '2026-09-29T06:50:00.000Z',
    readAt: '2026-09-29T07:15:00.000Z',
    actionedAt: '2026-09-29T07:15:00.000Z',
    assuranceSetId: 'AS-2026-001',
  },

  /* n. technical - vessel inspector */
  {
    id: 'MAP-NTF-2026-CAPA-00013',
    type: 'capa_reinspection',
    subject: 'Re-inspection requested: CAPA-120',
    message: 'Confirm the fire pump relief valve was recalibrated before on-hire.',
    recipientUserId: 'USR-203',
    senderUserId: 'USR-201',
    senderName: 'S. Basin',
    status: 'unread',
    createdAt: '2026-10-08T08:20:00.000Z',
    capaId: 'CAPA-120',
    vesselName: 'MV Pacific Endeavour',
  },
  {
    id: 'MAP-NTF-2026-ASGN-00014',
    type: 'stakeholder_assigned',
    subject: 'Assigned as Inspector: Southern Basin Platform Support Charter',
    recipientUserId: 'USR-203',
    senderUserId: 'USR-201',
    senderName: 'S. Basin',
    projectId: 'MAP-PROJ-2026-MARINE-009',
    projectName: 'Southern Basin Platform Support Charter',
    status: 'unread',
    createdAt: '2026-10-07T00:40:00.000Z',
    assuranceSetId: 'AS-2026-005',
    vesselName: 'MV Atlantic Ocean',
    assignedRole: 'Inspector',
  },
  {
    id: 'MAP-NTF-2026-CAPA-00015',
    type: 'capa_reinspection',
    subject: 'Re-inspection requested: CAPA-112',
    recipientUserId: 'USR-203',
    senderUserId: 'USR-201',
    senderName: 'S. Basin',
    status: 'read',
    createdAt: '2026-10-03T10:05:00.000Z',
    readAt: '2026-10-03T11:30:00.000Z',
    capaId: 'CAPA-112',
    vesselName: 'MV Atlantic Ocean',
  },

  /* p. nardelli - approver */
  {
    id: 'MAP-NTF-2026-APRV-00016',
    type: 'approval_requested',
    subject: 'Approval requested: Chevron Gorgon Charter Vetting',
    message: 'Verification complete. Awaiting formal sign-off.',
    recipientUserId: 'USR-204',
    senderUserId: 'USR-202',
    senderName: 'A. Fontaine',
    status: 'unread',
    createdAt: '2026-10-08T14:35:00.000Z',
    assuranceSetId: 'AS-2026-001',
  },
  {
    id: 'MAP-NTF-2026-APRV-00017',
    type: 'approval_requested',
    subject: 'Approval requested: MV Atlantic Ocean Legacy Verification',
    recipientUserId: 'USR-204',
    senderUserId: 'USR-202',
    senderName: 'A. Fontaine',
    status: 'read',
    createdAt: '2026-10-06T02:10:00.000Z',
    readAt: '2026-10-06T03:45:00.000Z',
    assuranceSetId: 'AS-2026-011',
  },
  {
    id: 'MAP-NTF-2026-ASGN-00018',
    type: 'stakeholder_assigned',
    subject: 'Assigned as Approver: Inpex Ichthys Inspection',
    recipientUserId: 'USR-204',
    senderUserId: 'USR-201',
    senderName: 'S. Basin',
    status: 'actioned',
    createdAt: '2026-09-27T09:00:00.000Z',
    readAt: '2026-09-27T09:30:00.000Z',
    actionedAt: '2026-09-27T09:30:00.000Z',
    assuranceSetId: 'AS-2026-003',
    assignedRole: 'Approver',
  },
];
