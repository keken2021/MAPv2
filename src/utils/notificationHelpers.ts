/*
  file summary: pure helpers for in-app notifications.
  responsibilities: recipient filtering, tab and search filters, id generation, row action resolution, and the assurance set request context used by the creation wizard.
  role in system: consumed by useMapStore.ts, App.tsx, NotificationPanel.tsx, NotificationsView.tsx and CreateAssuranceSetView.tsx.
*/

import { AssuranceRequirement, AssuranceSet } from '../types/assurance';
import { CapaItem } from '../types/capa';
import { MasterDocument } from '../types/document';
import {
  AppNotification,
  NotificationCategory,
  NotificationDraft,
  NotificationTab,
  NotificationType,
  TargetDateNoticeKind,
} from '../types/notification';
import { Project } from '../types/project';
import { UserProfile } from '../types/user';
import {
  NOTIFICATION_ASSIGNMENT_ACTION_LABELS,
  NOTIFICATION_REQUEST_FULFILLED_ACTION_LABEL,
  NOTIFICATION_TYPE_META,
} from '../store/notificationMockData';
import { getProjectClientOrganization } from './projectHelpers';
import { orgFieldMatches } from './rbacHelpers';
import { findUserByAssigneeLabel } from './userRoleHelpers';
import { isTaskOpen } from './readinessHelpers';

/**
  what: subject line for an invitation to create one assurance set.
  how: a request names the project; an assignment names the assurance set that was created.
  with what file: src/utils/notificationHelpers.ts used by useMapStore.ts.
*/
export function assuranceInvitationSubject(title: string): string {
  return `You are invited to create an assurance set for this particular ${title.trim()}`;
}

/**
  what: notifications addressed to one user, newest first; inputs are all notifications and the user id.
  how: keeps records whose recipientUserId matches and sorts by createdAt descending; returns nothing when no user is given.
  with what file: src/utils/notificationHelpers.ts used by NotificationPanel.tsx and NotificationsView.tsx.
*/
export function filterNotificationsForUser(
  notifications: AppNotification[],
  userId: string | undefined,
): AppNotification[] {
  if (!userId) return [];
  return notifications
    .filter((n) => n.recipientUserId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
  what: narrows a notification list to one tab; inputs are the list and the tab key.
  how: all keeps everything, unread and actioned keep the matching status.
  with what file: src/utils/notificationHelpers.ts used by NotificationsView.tsx.
*/
export function filterNotificationsByTab(
  notifications: AppNotification[],
  tab: NotificationTab,
): AppNotification[] {
  if (tab === 'all') return notifications;
  return notifications.filter((n) => n.status === tab);
}

/**
  what: true when a notification matches a project or sender search; inputs are the notification and the raw search text.
  how: case-insensitive match against project name, project id and sender name; an empty term matches everything.
  with what file: src/utils/notificationHelpers.ts used by NotificationsView.tsx.
*/
export function matchesNotificationSearch(notification: AppNotification, searchTerm: string): boolean {
  const term = searchTerm.trim().toLowerCase();
  if (!term) return true;
  return [notification.projectName, notification.projectId, notification.senderName].some(
    (field) => Boolean(field) && (field as string).toLowerCase().includes(term),
  );
}

/**
  what: number of unread notifications in a list.
  with what file: src/utils/notificationHelpers.ts used by NotificationPanel.tsx and NotificationsView.tsx.
*/
export function countUnread(notifications: AppNotification[]): number {
  return notifications.filter((n) => n.status === 'unread').length;
}

/**
  what: category of a notification, from its type.
  with what file: src/utils/notificationHelpers.ts used by NotificationsView.tsx.
*/
export function getNotificationCategory(notification: Pick<AppNotification, 'type'>): NotificationCategory {
  return NOTIFICATION_TYPE_META[notification.type].category;
}

/**
  what: next notification id in the MAP-NTF-[YYYY]-[CATEGORY]-[SEQ] format; inputs are the existing notifications and the new type.
  how: takes the highest sequence already issued across all categories and adds one.
  with what file: src/utils/notificationHelpers.ts used by useMapStore.ts.
*/
export function generateNotificationId(
  existing: Pick<AppNotification, 'id'>[],
  type: NotificationType,
): string {
  const year = new Date().getFullYear();
  const highest = existing.reduce((max, n) => {
    const seq = Number(n.id.split('-').pop());
    return Number.isFinite(seq) && seq > max ? seq : max;
  }, 0);
  return `MAP-NTF-${year}-${NOTIFICATION_TYPE_META[type].idCode}-${String(highest + 1).padStart(5, '0')}`;
}

/**
  what: user a stakeholder label such as "A. Fontaine (Bureau Veritas Inspectorate)" refers to; inputs are the label and the user registry.
  how: delegates to findUserByAssigneeLabel; placeholder labels with no matching user resolve to undefined.
  with what file: src/utils/notificationHelpers.ts used by useMapStore.ts.
*/
export function resolveNotificationRecipient(
  assigneeLabel: string | undefined,
  users: UserProfile[],
): UserProfile | undefined {
  if (!assigneeLabel || !assigneeLabel.trim()) return undefined;
  return findUserByAssigneeLabel(users, assigneeLabel);
}

/**
  what: true when opening a notification's row action completes it.
  how: an assurance set request stays open until its set is created, and a document renewal until a new version is uploaded; every other type is actioned once the recipient opens the linked record.
  with what file: src/utils/notificationHelpers.ts used by useMapStore.ts.
*/
export function isNotificationActionedOnOpen(notification: AppNotification): boolean {
  return notification.type !== 'assurance_set_request' && notification.type !== 'document_renewal';
}

export interface NotificationAction {
  label: string;
  view: string;
  entityId?: string;
  /** true when the action opens the creation wizard for an assurance set request */
  opensRequestWizard?: boolean;
  /** set when the action cannot be used; explains why */
  disabledReason?: string;
}

export interface NotificationActionContext {
  assuranceSets: Pick<AssuranceSet, 'id' | 'vesselName'>[];
  documents: Pick<MasterDocument, 'id'>[];
  capaItems: Pick<CapaItem, 'id' | 'vesselName'>[];
  projects: Pick<Project, 'id'>[];
  /** route access check for the active persona */
  canAccessView: (view: string, entityId?: string) => boolean;
}

/**
  what: row action of a notification: its label and the route it opens; inputs are the notification and the records it may point at.
  how: maps each type to its target view; an inspection or approval workspace the persona cannot reach falls back to the assurance set, and the action is disabled when the target record is gone or no route is open to the persona.
  with what file: src/utils/notificationHelpers.ts used by NotificationPanel.tsx and NotificationsView.tsx.
*/
export function getNotificationAction(
  notification: AppNotification,
  ctx: NotificationActionContext,
): NotificationAction {
  const meta = NOTIFICATION_TYPE_META[notification.type];
  const set = notification.assuranceSetId
    ? ctx.assuranceSets.find((s) => s.id === notification.assuranceSetId)
    : undefined;
  const missingSet = 'This assurance set no longer exists.';

  const guard = (action: NotificationAction): NotificationAction => {
    if (action.disabledReason || action.opensRequestWizard) return action;
    return ctx.canAccessView(action.view, action.entityId)
      ? action
      : { ...action, disabledReason: 'Your role cannot open this record.' };
  };

  /* opens the role workspace when the persona can reach it, otherwise the assurance set itself */
  const workspaceOrSet = (action: NotificationAction): NotificationAction =>
    !action.disabledReason && !ctx.canAccessView(action.view, action.entityId)
      ? guard({ ...action, view: 'assurance-sets', entityId: notification.assuranceSetId })
      : guard(action);

  switch (notification.type) {
    case 'assurance_set_request': {
      const createdSetId = notification.request?.createdAssuranceSetId;
      if (createdSetId) {
        return guard({
          label: NOTIFICATION_REQUEST_FULFILLED_ACTION_LABEL,
          view: 'assurance-sets',
          entityId: createdSetId,
          disabledReason: ctx.assuranceSets.some((s) => s.id === createdSetId) ? undefined : missingSet,
        });
      }
      return {
        label: meta.actionLabel,
        view: 'create-assurance-set',
        opensRequestWizard: true,
        disabledReason: ctx.projects.some((p) => p.id === notification.projectId)
          ? undefined
          : 'This project no longer exists.',
      };
    }
    case 'stakeholder_assigned': {
      const role = notification.assignedRole;
      const label = (role && NOTIFICATION_ASSIGNMENT_ACTION_LABELS[role]) || meta.actionLabel;
      const disabledReason = set ? undefined : missingSet;
      if (role === 'Inspector') {
        return workspaceOrSet({
          label,
          view: 'inspector',
          entityId: notification.vesselName || set?.vesselName,
          disabledReason,
        });
      }
      if (role === 'Approver') {
        return workspaceOrSet({ label, view: 'approver', entityId: notification.assuranceSetId, disabledReason });
      }
      return guard({ label, view: 'assurance-sets', entityId: notification.assuranceSetId, disabledReason });
    }
    case 'document_correction':
    case 'document_renewal':
      return guard({
        label: meta.actionLabel,
        view: 'documents',
        entityId: notification.documentId,
        disabledReason: ctx.documents.some((d) => d.id === notification.documentId)
          ? undefined
          : 'This document no longer exists.',
      });
    case 'approval_requested':
      return workspaceOrSet({
        label: meta.actionLabel,
        view: 'approver',
        entityId: notification.assuranceSetId,
        disabledReason: set ? undefined : missingSet,
      });
    case 'capa_reinspection': {
      const capa = ctx.capaItems.find((c) => c.id === notification.capaId);
      return guard({
        label: meta.actionLabel,
        view: 'capa',
        entityId: notification.vesselName || capa?.vesselName,
        disabledReason: capa ? undefined : 'This CAPA no longer exists.',
      });
    }
    case 'target_date':
    case 'review_requested':
    case 'approval_decision':
    default:
      return guard({
        label: meta.actionLabel,
        view: 'assurance-sets',
        entityId: notification.assuranceSetId,
        disabledReason: set ? undefined : missingSet,
      });
  }
}

export interface AssuranceRequestContext {
  notification: AppNotification;
  project: Project;
  /** client the created set must carry: the project client */
  clientOrganization: string;
  /** user the set is to be created by */
  assigneeName: string;
  assignee?: UserProfile;
  requestedByName: string;
  /** organization that sent the request */
  requestedByOrganization?: string;
}

/**
  what: project, client and assigned creator for an assurance set request; inputs are the notification, all projects and the user registry.
  how: reads the project by id and takes its current client organization, and resolves the assignee from the request payload; returns undefined for any other notification type or a missing project.
  with what file: src/utils/notificationHelpers.ts used by CreateAssuranceSetView.tsx and NotificationsView.tsx.
*/
export function resolveAssuranceRequestContext(
  notification: AppNotification | undefined,
  projects: Project[],
  users: UserProfile[],
): AssuranceRequestContext | undefined {
  if (!notification || notification.type !== 'assurance_set_request' || !notification.request) {
    return undefined;
  }
  const project = projects.find((p) => p.id === notification.projectId);
  if (!project) return undefined;

  const assignee = users.find((u) => u.id === notification.request?.assigneeUserId);
  const sender = users.find((u) => u.id === notification.senderUserId);
  return {
    notification,
    project,
    clientOrganization:
      getProjectClientOrganization(project) || notification.request.clientOrganization,
    assigneeName: assignee?.name || notification.request.assigneeName,
    assignee,
    requestedByName: notification.senderName,
    requestedByOrganization: sender?.organization,
  };
}

/**
  what: the service provider for a set opened from an assurance request; inputs are the request, the set client, and the owner of the selected asset.
  how: when another organization asks this client to create the set, that requester is the service provider and supplies the submitter. A request from the set's own client keeps the asset owner as the provider.
  with what file: src/utils/notificationHelpers.ts used by CreateAssuranceSetView.tsx.
*/
export function resolveRequestedServiceProviderOrg(
  context: Pick<AssuranceRequestContext, 'requestedByOrganization'> | undefined,
  setClientOrg: string,
  assetProviderOrg: string,
): string {
  const requesterOrg = context?.requestedByOrganization?.trim() || '';
  if (requesterOrg && !orgFieldMatches(setClientOrg, requesterOrg)) return requesterOrg;
  return assetProviderOrg;
}

/**
  what: the client written onto a set opened from an assurance request.
  how: an invited organization that is not the project client becomes the client of the set it creates. Every other request keeps the project client.
  with what file: src/utils/notificationHelpers.ts used by CreateAssuranceSetView.tsx.
*/
export function resolveAssuranceRequestSetClient(
  creatingOrganization: string,
  context: Pick<AssuranceRequestContext, 'clientOrganization' | 'project'> | undefined,
): string {
  if (!context) return creatingOrganization;
  const invited = context.project.invitedOrganizations?.some((org) =>
    orgFieldMatches(creatingOrganization, org),
  );
  const isProjectClient = orgFieldMatches(creatingOrganization, context.clientOrganization);
  if (invited && !isProjectClient) return creatingOrganization;
  return context.clientOrganization || creatingOrganization;
}

/**
  what: true when the signed-in user may open the creation wizard through an assurance set request.
  how: the notification must be an open assurance set request addressed to that user.
  with what file: src/utils/notificationHelpers.ts used by App.tsx to grant request-scoped wizard access.
*/
/** a reminder is 8 to 14 days out, a warning is within 7 days, and an escalation is overdue */
export const TARGET_DATE_WARNING_DAYS = 7;
export const TARGET_DATE_REMINDER_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysUntilTarget(targetDate: string, today: string): number {
  const target = Date.parse(`${targetDate.slice(0, 10)}T00:00:00Z`);
  const start = Date.parse(`${today.slice(0, 10)}T00:00:00Z`);
  return Math.round((target - start) / DAY_MS);
}

/**
  what: which notice a target date needs today.
  how: overdue is an escalation, 7 days or fewer is a warning, 8 to 14 days is a reminder.
  with what file: src/utils/notificationHelpers.ts used by useMapStore.ts.
*/
export function targetDateNoticeKind(targetDate: string | undefined, today: string): TargetDateNoticeKind | null {
  if (!targetDate?.trim()) return null;
  const days = daysUntilTarget(targetDate, today);
  if (Number.isNaN(days)) return null;
  if (days < 0) return 'escalation';
  if (days <= TARGET_DATE_WARNING_DAYS) return 'warning';
  if (days <= TARGET_DATE_REMINDER_DAYS) return 'reminder';
  return null;
}

const noticeLabel: Record<TargetDateNoticeKind, string> = {
  reminder: 'Reminder',
  warning: 'Warning',
  escalation: 'Escalation',
  date_changed: 'Target date changed',
};

export function targetDateRecipientIds(
  set: Pick<AssuranceSet, 'assignedSubmitter' | 'assignedVerifier' | 'assignedApprover'>,
  users: UserProfile[],
  actorUserId?: string,
): string[] {
  const ids = [set.assignedSubmitter, set.assignedVerifier, set.assignedApprover]
    .map((label) => resolveNotificationRecipient(label, users)?.id)
    .filter((id): id is string => Boolean(id));
  if (actorUserId) ids.push(actorUserId);
  return [...new Set(ids)];
}

function setStillOpen(set: Pick<AssuranceSet, 'stage' | 'approverDecision'>): boolean {
  return set.stage !== 'Approved' && set.stage !== 'Certified' && set.approverDecision !== 'Approved';
}

/**
  what: warning, escalation and reminder drafts for open sets and tasks, plus a notice when a date changes.
  how: one draft per affected user. A changed date always notifies. A date inside the windows also raises that notice.
  with what file: src/utils/notificationHelpers.ts used by useMapStore.ts.
*/
export function buildTargetDateNoticeDrafts(input: {
  set: AssuranceSet;
  users: UserProfile[];
  today: string;
  actorUserId?: string;
  changed?: {
    scope: 'set' | 'task';
    taskId?: string;
    taskTitle?: string;
    oldDate?: string;
    newDate: string;
  };
}): NotificationDraft[] {
  const recipients = targetDateRecipientIds(input.set, input.users, input.actorUserId);
  if (recipients.length === 0) return [];
  const drafts: NotificationDraft[] = [];
  const push = (kind: TargetDateNoticeKind, subject: string, message: string, taskId: string | undefined, targetDate: string) => {
    recipients.forEach((recipientUserId) => {
      drafts.push({
        type: 'target_date',
        targetDateKind: kind,
        subject,
        message,
        recipientUserId,
        senderName: 'MAP',
        projectId: input.set.projectId,
        projectName: input.set.projectName,
        assuranceSetId: input.set.id,
        taskId,
        targetDate,
        vesselName: input.set.vesselName,
      });
    });
  };

  if (input.changed) {
    const name = input.changed.scope === 'task' ? input.changed.taskTitle || 'Task' : input.set.title;
    const from = input.changed.oldDate && input.changed.oldDate !== '—' ? ` from ${input.changed.oldDate}` : '';
    push(
      'date_changed',
      `${noticeLabel.date_changed}: ${name}`,
      `${name} on ${input.set.id} moved${from} to ${input.changed.newDate}.`,
      input.changed.taskId,
      input.changed.newDate,
    );
  }

  const items: { taskId?: string; title: string; date?: string; open: boolean }[] = [];
  if (setStillOpen(input.set)) {
    items.push({
      title: input.set.title,
      date: input.set.targetDate || input.set.complianceDeadline,
      open: true,
    });
    input.set.requirements.forEach((task: AssuranceRequirement) => {
      if (!isTaskOpen(task)) return;
      items.push({ taskId: task.id, title: task.title, date: task.targetDate, open: true });
    });
  }
  items.forEach((item) => {
    const kind = targetDateNoticeKind(item.date, input.today);
    if (!kind || !item.date) return;
    const when = kind === 'escalation' ? `was due ${item.date}` : `is due ${item.date}`;
    push(kind, `${noticeLabel[kind]}: ${item.title}`, `${item.title} on ${input.set.id} ${when}.`, item.taskId, item.date);
  });
  return drafts;
}

/**
  what: inbox records for target dates already inside the reminder, warning or escalation window.
  how: builds one unread notice per affected user and skips a notice that is already in the list.
  with what file: src/utils/notificationHelpers.ts used by the initial state of useMapStore.ts.
*/
export function seedTargetDateNotices(
  existing: AppNotification[],
  sets: AssuranceSet[],
  users: UserProfile[],
  today: string,
): AppNotification[] {
  const all = [...existing];
  sets.forEach((set) => {
    buildTargetDateNoticeDrafts({ set, users, today }).forEach((draft) => {
      const duplicate = all.some(
        (notice) =>
          notice.type === 'target_date' &&
          notice.targetDateKind === draft.targetDateKind &&
          notice.assuranceSetId === draft.assuranceSetId &&
          (notice.taskId || '') === (draft.taskId || '') &&
          notice.targetDate === draft.targetDate &&
          notice.recipientUserId === draft.recipientUserId,
      );
      if (duplicate) return;
      const notification: AppNotification = {
        ...draft,
        id: generateNotificationId(all, draft.type),
        status: 'unread',
        createdAt: `${today}T08:00:00.000Z`,
      };
      all.unshift(notification);
    });
  });
  return all;
}

export function canOpenAssuranceRequestWizard(
  notification: AppNotification | undefined,
  sessionUser: Pick<UserProfile, 'id'> | undefined | null,
): boolean {
  return Boolean(
    notification &&
      sessionUser &&
      notification.type === 'assurance_set_request' &&
      notification.status !== 'actioned' &&
      notification.recipientUserId === sessionUser.id,
  );
}
