/*
  file summary: tests the notifications inbox helpers, store actions and workflow emitters.
  responsibilities: verifies recipient-only visibility, tab and search filters, row action targets, request-scoped wizard access, and that each workflow action notifies the right user.
  role in system: covers src/utils/notificationHelpers.ts, src/store/notificationMockData.ts and the notification actions in src/store/useMapStore.ts.
*/

import { beforeEach, describe, expect, it } from 'vitest';
import { useMapStore } from '../store/useMapStore';
import { MOCK_PERSONA_SESSION_USER_IDS, MOCK_USERS } from '../store/mockData';
import { MOCK_NOTIFICATIONS, NOTIFICATION_TYPE_META } from '../store/notificationMockData';
import { MOCK_PROJECTS } from '../store/projectMockData';
import { UserRolePersona } from '../types/audit';
import { AppNotification } from '../types/notification';
import {
  NotificationActionContext,
  canOpenAssuranceRequestWizard,
  countUnread,
  filterNotificationsByTab,
  filterNotificationsForUser,
  generateNotificationId,
  getNotificationAction,
  matchesNotificationSearch,
  resolveAssuranceRequestContext,
  resolveNotificationRecipient,
} from '../utils/notificationHelpers';
import { getProjectClientOrganization } from '../utils/projectHelpers';
import { isViewAccessibleToPersona } from '../utils/rbacHelpers';
import { buildBrdRolePermissionDefaults } from '../utils/permissionDefaults';
import { getSessionUserForPersona } from '../utils/userRoleHelpers';
import { formatMaritimeDateTime } from '../utils/formatters';

const ALL_PERSONAS: UserRolePersona[] = [
  'Administrator',
  'C Admin',
  'Submitter',
  'Verifier',
  'Inspector',
  'Approver',
];

const inboxOf = (userId: string) =>
  filterNotificationsForUser(useMapStore.getState().notifications, userId);

describe('seeded notifications', () => {
  it('follows the MAP-NTF id format with the category code of its type', () => {
    MOCK_NOTIFICATIONS.forEach((n) => {
      expect(n.id).toMatch(/^MAP-NTF-\d{4}-[A-Z]{4}-\d{5}$/);
      expect(n.id).toContain(`-${NOTIFICATION_TYPE_META[n.type].idCode}-`);
    });
    expect(new Set(MOCK_NOTIFICATIONS.map((n) => n.id)).size).toBe(MOCK_NOTIFICATIONS.length);
  });

  it('addresses every notification to a registered user and gives each persona an inbox', () => {
    MOCK_NOTIFICATIONS.forEach((n) => {
      expect(MOCK_USERS.some((u) => u.id === n.recipientUserId)).toBe(true);
    });
    ALL_PERSONAS.forEach((persona) => {
      const user = getSessionUserForPersona(persona, MOCK_USERS);
      expect(user?.id).toBe(MOCK_PERSONA_SESSION_USER_IDS[persona]);
      expect(filterNotificationsForUser(MOCK_NOTIFICATIONS, user?.id).length).toBeGreaterThan(0);
    });
  });
});

describe('inbox filters', () => {
  it('shows a notification to its recipient only, newest first', () => {
    const inbox = filterNotificationsForUser(MOCK_NOTIFICATIONS, 'USR-102');
    expect(inbox.every((n) => n.recipientUserId === 'USR-102')).toBe(true);
    const times = inbox.map((n) => new Date(n.createdAt).getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
    expect(filterNotificationsForUser(MOCK_NOTIFICATIONS, undefined)).toEqual([]);
  });

  it('resolves the verifier persona to the user shown in the sidebar, not the first user holding the role', () => {
    expect(getSessionUserForPersona('Verifier', MOCK_USERS)?.name).toBe('A. Fontaine');
    expect(getSessionUserForPersona('Submitter', MOCK_USERS)?.name).toBe('M. Chen');
  });

  it('splits the inbox into all, unread and actioned tabs', () => {
    const inbox = filterNotificationsForUser(MOCK_NOTIFICATIONS, 'USR-102');
    expect(filterNotificationsByTab(inbox, 'all')).toHaveLength(inbox.length);
    expect(filterNotificationsByTab(inbox, 'unread').every((n) => n.status === 'unread')).toBe(true);
    expect(filterNotificationsByTab(inbox, 'actioned').every((n) => n.status === 'actioned')).toBe(true);
    expect(countUnread(inbox)).toBe(filterNotificationsByTab(inbox, 'unread').length);
  });

  it('searches by project or sender, and not by subject', () => {
    const request = MOCK_NOTIFICATIONS.find((n) => n.id === 'MAP-NTF-2026-ASRQ-00001') as AppNotification;
    expect(matchesNotificationSearch(request, 'dangerous route')).toBe(true);
    expect(matchesNotificationSearch(request, 'MARINE-007')).toBe(true);
    expect(matchesNotificationSearch(request, 'rostova')).toBe(true);
    expect(matchesNotificationSearch(request, '  ')).toBe(true);
    expect(matchesNotificationSearch(request, 'assurance set creation requested')).toBe(false);
  });

  it('generates the next id in sequence for the type category', () => {
    expect(generateNotificationId(MOCK_NOTIFICATIONS, 'capa_reinspection')).toBe(
      `MAP-NTF-${new Date().getFullYear()}-CAPA-${String(MOCK_NOTIFICATIONS.length + 1).padStart(5, '0')}`,
    );
  });

  it('formats notification time as a maritime date with UTC time', () => {
    expect(formatMaritimeDateTime('2026-10-08T03:15:00.000Z')).toBe('08 OCT 2026 03:15 UTC');
  });
});

describe('row actions', () => {
  const state = useMapStore.getState();
  const ctx: NotificationActionContext = {
    assuranceSets: state.assuranceSets,
    documents: state.documents,
    capaItems: state.capaItems,
    projects: state.projects,
    canAccessView: () => true,
  };
  const byId = (id: string) => MOCK_NOTIFICATIONS.find((n) => n.id === id) as AppNotification;

  it('opens the creation wizard for an open request and the created set once fulfilled', () => {
    expect(getNotificationAction(byId('MAP-NTF-2026-ASRQ-00001'), ctx)).toMatchObject({
      label: 'Create Set',
      view: 'create-assurance-set',
      opensRequestWizard: true,
      disabledReason: undefined,
    });
    expect(getNotificationAction(byId('MAP-NTF-2026-ASRQ-00009'), ctx)).toMatchObject({
      label: 'Open Set',
      view: 'assurance-sets',
      entityId: 'AS-01-V008',
      disabledReason: undefined,
    });
  });

  it('sends each assigned role to its own workspace', () => {
    expect(getNotificationAction(byId('MAP-NTF-2026-ASGN-00004'), ctx)).toMatchObject({
      label: 'Review Documents',
      view: 'assurance-sets',
      entityId: 'AS-2026-006',
    });
    expect(getNotificationAction(byId('MAP-NTF-2026-ASGN-00008'), ctx)).toMatchObject({
      label: 'Upload Documents',
      view: 'assurance-sets',
      entityId: 'AS-2026-005',
    });
    expect(getNotificationAction(byId('MAP-NTF-2026-ASGN-00014'), ctx)).toMatchObject({
      label: 'Start Inspection',
      view: 'inspector',
      entityId: 'MV Atlantic Ocean',
    });
    expect(getNotificationAction(byId('MAP-NTF-2026-ASGN-00018'), ctx)).toMatchObject({
      label: 'Review Approval',
      view: 'approver',
      entityId: 'AS-2026-003',
    });
  });

  it('routes verification, approval and capa notifications to the linked record', () => {
    expect(getNotificationAction(byId('MAP-NTF-2026-VERF-00007'), ctx)).toMatchObject({
      label: 'Open Document',
      view: 'documents',
      entityId: 'MAP-VES-2026-STAT-00002',
    });
    expect(getNotificationAction(byId('MAP-NTF-2026-VERF-00011'), ctx)).toMatchObject({
      label: 'Review Documents',
      view: 'assurance-sets',
      entityId: 'AS-2026-008',
    });
    expect(getNotificationAction(byId('MAP-NTF-2026-APRV-00016'), ctx)).toMatchObject({
      label: 'Review Approval',
      view: 'approver',
      entityId: 'AS-2026-001',
    });
    expect(getNotificationAction(byId('MAP-NTF-2026-APRV-00002'), ctx)).toMatchObject({
      label: 'Open Set',
      view: 'assurance-sets',
      entityId: 'AS-EQP-007-01',
    });
    expect(getNotificationAction(byId('MAP-NTF-2026-CAPA-00013'), ctx)).toMatchObject({
      label: 'Open CAPA',
      view: 'capa',
      entityId: 'MV Pacific Endeavour',
    });
  });

  it('has an enabled action for every seeded notification', () => {
    MOCK_NOTIFICATIONS.forEach((n) => {
      expect(getNotificationAction(n, ctx).disabledReason, n.id).toBeUndefined();
    });
  });

  it('falls back to the assurance set when the role workspace is closed to the persona', () => {
    const clientApprover = getNotificationAction(byId('MAP-NTF-2026-ASGN-00018'), {
      ...ctx,
      canAccessView: (view) => view !== 'approver',
    });
    expect(clientApprover).toMatchObject({
      label: 'Review Approval',
      view: 'assurance-sets',
      entityId: 'AS-2026-003',
      disabledReason: undefined,
    });
  });

  it('disables the action when the record is gone or the role cannot open the route', () => {
    const orphaned = { ...byId('MAP-NTF-2026-APRV-00016'), assuranceSetId: 'AS-MISSING' };
    expect(getNotificationAction(orphaned, ctx).disabledReason).toBe('This assurance set no longer exists.');

    const blocked = getNotificationAction(byId('MAP-NTF-2026-APRV-00016'), {
      ...ctx,
      canAccessView: () => false,
    });
    expect(blocked.disabledReason).toBe('Your role cannot open this record.');

    const requestWithoutProject = { ...byId('MAP-NTF-2026-ASRQ-00001'), projectId: 'MAP-PROJ-MISSING' };
    expect(getNotificationAction(requestWithoutProject, ctx).disabledReason).toBe(
      'This project no longer exists.',
    );
  });
});

describe('route access', () => {
  const matrix = buildBrdRolePermissionDefaults();

  it('opens the notifications page to every role, with and without the matrix', () => {
    ALL_PERSONAS.forEach((persona) => {
      expect(isViewAccessibleToPersona('notifications', undefined, persona)).toBe(true);
      expect(isViewAccessibleToPersona('notifications', undefined, persona, matrix)).toBe(true);
    });
  });

  it('keeps the creation wizard closed to a submitter by role and grants it only through their own open request', () => {
    expect(isViewAccessibleToPersona('create-assurance-set', undefined, 'Submitter', matrix)).toBe(false);

    const request: AppNotification = {
      ...(MOCK_NOTIFICATIONS.find((n) => n.id === 'MAP-NTF-2026-ASRQ-00009') as AppNotification),
      status: 'unread',
    };
    expect(canOpenAssuranceRequestWizard(request, { id: 'USR-102' })).toBe(true);
    expect(canOpenAssuranceRequestWizard(request, { id: 'USR-103' })).toBe(false);
    expect(canOpenAssuranceRequestWizard({ ...request, status: 'actioned' }, { id: 'USR-102' })).toBe(false);
    expect(canOpenAssuranceRequestWizard(undefined, { id: 'USR-102' })).toBe(false);

    const assignment = MOCK_NOTIFICATIONS.find((n) => n.type === 'stakeholder_assigned') as AppNotification;
    expect(canOpenAssuranceRequestWizard(assignment, { id: assignment.recipientUserId })).toBe(false);
  });
});

describe('store: read state', () => {
  beforeEach(() => {
    useMapStore.setState({ notifications: MOCK_NOTIFICATIONS, activePersona: 'Administrator' });
  });

  it('marks all read for one recipient without touching other inboxes', () => {
    const othersBefore = useMapStore
      .getState()
      .notifications.filter((n) => n.recipientUserId !== 'USR-203');

    useMapStore.getState().markAllNotificationsRead('USR-203');

    expect(countUnread(inboxOf('USR-203'))).toBe(0);
    expect(inboxOf('USR-203').some((n) => n.status === 'actioned')).toBe(false);
    expect(
      useMapStore.getState().notifications.filter((n) => n.recipientUserId !== 'USR-203'),
    ).toEqual(othersBefore);
  });

  it('leaves actioned notifications actioned when marking all read', () => {
    useMapStore.getState().markAllNotificationsRead('USR-102');
    expect(inboxOf('USR-102').find((n) => n.id === 'MAP-NTF-2026-ASRQ-00009')?.status).toBe('actioned');
  });

  it('actions a notification when its row action is used, but keeps a request open until the set exists', () => {
    useMapStore.getState().openNotification('MAP-NTF-2026-APRV-00016');
    const opened = inboxOf('USR-204').find((n) => n.id === 'MAP-NTF-2026-APRV-00016');
    expect(opened?.status).toBe('actioned');
    expect(opened?.actionedAt).toBeTruthy();

    useMapStore.getState().openNotification('MAP-NTF-2026-ASRQ-00001');
    expect(inboxOf('USR-101').find((n) => n.id === 'MAP-NTF-2026-ASRQ-00001')?.status).toBe('read');
  });

  it('does not notify a user about their own action', () => {
    const before = useMapStore.getState().notifications.length;
    const id = useMapStore.getState().pushNotification({
      type: 'review_requested',
      subject: 'Review requested: self',
      recipientUserId: 'USR-101',
      senderUserId: 'USR-101',
      senderName: 'K. Osei',
    });
    expect(id).toBeUndefined();
    expect(useMapStore.getState().notifications).toHaveLength(before);
  });
});

describe('store: assurance set request', () => {
  const chevronProject = MOCK_PROJECTS.find((p) => p.id === 'MAP-PROJ-2026-MARINE-013')!;

  beforeEach(() => {
    useMapStore.setState({
      notifications: MOCK_NOTIFICATIONS,
      activePersona: 'Administrator',
      pendingAssuranceRequestNotificationId: undefined,
    });
  });

  const sendRequest = () => {
    const result = useMapStore.getState().requestAssuranceSet({
      projectId: chevronProject.id,
      recipientUserId: 'USR-102',
      suggestedScope: 'Equipment',
      message: 'Winch package needs its own set.',
      senderUserId: 'USR-101',
      senderName: 'K. Osei',
    });
    expect(result.success).toBe(true);
    return inboxOf('USR-102')[0];
  };

  it('carries the project and the user the set is to be created by', () => {
    const request = sendRequest();
    expect(request).toMatchObject({
      type: 'assurance_set_request',
      status: 'unread',
      recipientUserId: 'USR-102',
      senderUserId: 'USR-101',
      senderName: 'K. Osei',
      projectId: chevronProject.id,
      projectName: chevronProject.name,
      request: {
        assigneeUserId: 'USR-102',
        assigneeName: 'M. Chen',
        clientOrganization: 'Chevron Australia Pty Ltd',
        suggestedScope: 'Equipment',
      },
    });
    expect(request.id).toMatch(/^MAP-NTF-\d{4}-ASRQ-\d{5}$/);
  });

  it('is visible to the recipient only', () => {
    const request = sendRequest();
    ALL_PERSONAS.forEach((persona) => {
      const user = getSessionUserForPersona(persona, MOCK_USERS);
      const sees = inboxOf(user!.id).some((n) => n.id === request.id);
      expect(sees, persona).toBe(persona === 'Submitter');
    });
  });

  it('rejects an unknown project, an unknown recipient and a request to oneself', () => {
    const base = { senderUserId: 'USR-101', senderName: 'K. Osei' };
    const { requestAssuranceSet } = useMapStore.getState();
    expect(requestAssuranceSet({ ...base, projectId: 'MAP-PROJ-MISSING', recipientUserId: 'USR-102' }).success).toBe(false);
    expect(requestAssuranceSet({ ...base, projectId: chevronProject.id, recipientUserId: 'USR-000' }).success).toBe(false);
    expect(requestAssuranceSet({ ...base, projectId: chevronProject.id, recipientUserId: 'USR-101' }).success).toBe(false);
  });

  it('resolves the set client to the project client and the creator to the assigned user', () => {
    const request = sendRequest();
    const { projects, users } = useMapStore.getState();
    const context = resolveAssuranceRequestContext(request, projects, users);

    expect(context?.project.id).toBe(chevronProject.id);
    expect(context?.clientOrganization).toBe(getProjectClientOrganization(chevronProject));
    expect(context?.clientOrganization).toBe('Chevron Australia Pty Ltd');
    expect(context?.assigneeName).toBe('M. Chen');
    expect(context?.assignee?.id).toBe('USR-102');
    expect(context?.requestedByName).toBe('K. Osei');

    const assignment = MOCK_NOTIFICATIONS.find((n) => n.type === 'stakeholder_assigned');
    expect(resolveAssuranceRequestContext(assignment, projects, users)).toBeUndefined();
  });

  it('is actioned with the created set once the assigned user creates it', () => {
    const request = sendRequest();
    const { projects, users, assuranceSets } = useMapStore.getState();
    const context = resolveAssuranceRequestContext(request, projects, users)!;

    useMapStore.setState({
      activePersona: 'Submitter',
      pendingAssuranceRequestNotificationId: request.id,
    });
    useMapStore.getState().addAssuranceSet({
      ...assuranceSets[0],
      id: 'AS-NTF-TEST-001',
      title: 'Gorgon Traction Winch Rental Vetting',
      projectId: context.project.id,
      projectName: context.project.name,
      charterer: context.clientOrganization,
      clientOrg: context.clientOrganization,
      initiatorOrg: 'Northwind Marine Pty Ltd',
      createdByName: context.assigneeName,
    });

    const created = useMapStore.getState().assuranceSets.find((s) => s.id === 'AS-NTF-TEST-001');
    expect(created?.clientOrg).toBe('Chevron Australia Pty Ltd');
    expect(created?.createdByName).toBe('M. Chen');

    const actioned = inboxOf('USR-102').find((n) => n.id === request.id);
    expect(actioned?.status).toBe('actioned');
    expect(actioned?.request?.createdAssuranceSetId).toBe('AS-NTF-TEST-001');
    expect(useMapStore.getState().pendingAssuranceRequestNotificationId).toBeUndefined();
  });
});

describe('store: workflow notifications', () => {
  beforeEach(() => {
    useMapStore.setState({ notifications: [], activePersona: 'Administrator' });
  });

  it('ignores placeholder stakeholder labels', () => {
    expect(resolveNotificationRecipient('Pending Admin Assignment', MOCK_USERS)).toBeUndefined();
    expect(resolveNotificationRecipient('Designated by Chartered Asset Owner', MOCK_USERS)).toBeUndefined();
    expect(resolveNotificationRecipient(undefined, MOCK_USERS)).toBeUndefined();
    expect(resolveNotificationRecipient('A. Fontaine (Bureau Veritas Inspectorate)', MOCK_USERS)?.id).toBe('USR-202');
  });

  it('notifies the verifier, inspector and approver named on a newly created set', () => {
    const template = useMapStore.getState().assuranceSets.find((s) => s.id === 'AS-2026-001')!;
    useMapStore.getState().addAssuranceSet({
      ...template,
      id: 'AS-NTF-TEST-002',
      title: 'Northwind Coral Titan Anchor Handling Vetting',
      projectId: undefined,
      projectName: undefined,
      visibility: 'organization',
    });

    const created = useMapStore.getState().notifications.filter((n) => n.assuranceSetId === 'AS-NTF-TEST-002');
    expect(created.map((n) => [n.recipientUserId, n.assignedRole]).sort()).toEqual([
      ['USR-202', 'Verifier'],
      ['USR-203', 'Inspector'],
      ['USR-204', 'Approver'],
    ]);
    expect(created.every((n) => n.type === 'stakeholder_assigned' && n.senderUserId === 'USR-101')).toBe(true);
  });

  it('does not notify stakeholders of a draft set', () => {
    const template = useMapStore.getState().assuranceSets.find((s) => s.id === 'AS-2026-001')!;
    useMapStore.getState().addAssuranceSet({
      ...template,
      id: 'AS-NTF-TEST-003',
      title: 'Northwind Draft Campaign For Notification Test',
      projectId: undefined,
      projectName: undefined,
      visibility: 'draft',
    });
    expect(useMapStore.getState().notifications).toHaveLength(0);
  });

  it('notifies a stakeholder who is assigned to an existing set', () => {
    /* an initiated set that is not yet under review, so stakeholders can still be reassigned */
    const template = useMapStore.getState().assuranceSets.find((s) => s.id === 'AS-2026-001')!;
    useMapStore.getState().addAssuranceSet({
      ...template,
      id: 'AS-NTF-TEST-004',
      title: 'Northwind Tasman Pioneer Reassignment Vetting',
      projectId: undefined,
      projectName: undefined,
      visibility: 'organization',
      stage: 'Initiated',
      approverDecision: 'Pending',
      clientWorkflowStage: undefined,
    });
    useMapStore.setState({ notifications: [] });

    const target = useMapStore.getState().assuranceSets.find((s) => s.id === 'AS-NTF-TEST-004')!;
    const result = useMapStore
      .getState()
      .updateAssuranceStakeholder(target.id, 'Inspector', 'Capt. Robert Shaw (Meridian Marine Surveyors)');
    expect(result.success, result.message).toBe(true);

    expect(inboxOf('USR-207')[0]).toMatchObject({
      type: 'stakeholder_assigned',
      assignedRole: 'Inspector',
      assuranceSetId: target.id,
      subject: `Assigned as Inspector: ${target.title}`,
      senderName: 'K. Osei',
    });
  });

  it('notifies the verifier when a set is sent for review', () => {
    useMapStore.setState({ activePersona: 'C Admin' });
    useMapStore.getState().sendAssuranceForReview('AS-2026-007');
    expect(inboxOf('USR-205')[0]).toMatchObject({
      type: 'review_requested',
      assuranceSetId: 'AS-2026-007',
      senderUserId: 'USR-201',
    });
  });

  it('notifies the set creator of the approver decision', () => {
    useMapStore.setState({ activePersona: 'Approver' });
    useMapStore.getState().setApproverDecision('AS-2026-005', 'Returned for Correction', 'Class certificate missing.');
    expect(inboxOf('USR-201')[0]).toMatchObject({
      type: 'approval_decision',
      assuranceSetId: 'AS-2026-005',
      subject: 'Returned for correction: Southern Basin Platform Support Charter',
      message: 'Class certificate missing.',
      senderUserId: 'USR-204',
      projectId: 'MAP-PROJ-2026-MARINE-009',
    });
  });

  it('notifies the submitter when a verifier requests a document correction', () => {
    const { assuranceSets, users } = useMapStore.getState();
    const linked = assuranceSets
      .flatMap((s) => s.requirements.map((r) => ({ set: s, docId: r.documentId })))
      .find(({ set, docId }) => docId && resolveNotificationRecipient(set.assignedSubmitter, users));
    expect(linked).toBeDefined();

    useMapStore.setState({ activePersona: 'Verifier' });
    useMapStore.getState().verifyDocument(linked!.docId!, 'Correction Requested', 'Expiry falls inside the charter window.');

    const submitter = resolveNotificationRecipient(linked!.set.assignedSubmitter, users)!;
    const correction = inboxOf(submitter.id).find(
      (n) => n.type === 'document_correction' && n.assuranceSetId === linked!.set.id,
    );
    expect(correction).toMatchObject({
      documentId: linked!.docId,
      message: 'Expiry falls inside the charter window.',
      senderUserId: 'USR-202',
    });
  });

  it('notifies the vessel inspector when a capa is flagged for re-inspection', () => {
    useMapStore.setState({ activePersona: 'C Admin' });
    useMapStore.getState().flagCapaForReinspection('CAPA-118', 'Verify HRU replacement on board.');
    expect(inboxOf('USR-203')[0]).toMatchObject({
      type: 'capa_reinspection',
      capaId: 'CAPA-118',
      vesselName: 'MV Pacific Endeavour',
      message: 'Verify HRU replacement on board.',
      senderUserId: 'USR-201',
    });
  });
});
