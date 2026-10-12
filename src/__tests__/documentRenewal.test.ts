/*
  file summary: tests the document renewal notification category.
  responsibilities: verifies the renewal reason order, that a reason is notified once per document per set, the recipient order, the wording, the reviewer's reupload request, and that a new version closes the notification.
  role in system: covers src/utils/documentRenewalHelpers.ts and the document renewal actions in src/store/useMapStore.ts.
*/

import { beforeEach, describe, expect, it } from 'vitest';
import { useMapStore } from '../store/useMapStore';
import { MOCK_ASSURANCE_SETS, MOCK_DOCUMENTS } from '../store/mockData';
import { NOTIFICATION_CATEGORIES, NOTIFICATION_TYPE_META } from '../store/notificationMockData';
import { AssuranceSet } from '../types/assurance';
import { MasterDocument } from '../types/document';
import { AppNotification } from '../types/notification';
import {
  findDocumentRenewalsDue,
  getDocumentRenewalReason,
  getRenewalMessage,
  getRenewalSubject,
  getRenewalSubmitterLabel,
} from '../utils/documentRenewalHelpers';
import { formatMaritimeDate } from '../utils/formatters';
import {
  generateNotificationId,
  getNotificationAction,
  getNotificationCategory,
  isNotificationActionedOnOpen,
} from '../utils/notificationHelpers';

const TODAY = new Date('2026-10-12T00:00:00.000Z');
const SET_ID = 'AS-2026-001';
const DOC_ID = 'MAP-VES-2026-STAT-00002';

const baseSet = MOCK_ASSURANCE_SETS.find((s) => s.id === SET_ID)!;
const baseDocument = MOCK_DOCUMENTS.find((d) => d.id === DOC_ID)!;

function makeDocument(overrides: Partial<MasterDocument>): MasterDocument {
  return { ...baseDocument, complianceState: 'Valid', ...overrides };
}

function makeSet(overrides: Partial<AssuranceSet>): AssuranceSet {
  return { ...baseSet, charterWindowEnd: '2027-01-31', ...overrides };
}

describe('document renewal: reason', () => {
  it('reports an expired document before any other reason', () => {
    expect(getDocumentRenewalReason(makeDocument({ expiryDate: '2026-09-30' }), makeSet({}), TODAY)).toBe('expired');
    expect(
      getDocumentRenewalReason(makeDocument({ expiryDate: '2028-01-01', complianceState: 'Expired' }), makeSet({}), TODAY),
    ).toBe('expired');
  });

  it('reports a document that expires before the charter window ends', () => {
    expect(
      getDocumentRenewalReason(
        makeDocument({ expiryDate: '2026-12-15', complianceState: 'Expiring < 6 Mos' }),
        makeSet({}),
        TODAY,
      ),
    ).toBe('charter_window');
  });

  it('reports an expiring document that still covers the charter window', () => {
    expect(
      getDocumentRenewalReason(
        makeDocument({ expiryDate: '2027-02-28', complianceState: 'Expiring < 6 Mos' }),
        makeSet({}),
        TODAY,
      ),
    ).toBe('expiring');
  });

  it('reports nothing for a valid document that covers the charter window', () => {
    expect(getDocumentRenewalReason(makeDocument({ expiryDate: '2029-01-01' }), makeSet({}), TODAY)).toBeUndefined();
  });
});

describe('document renewal: renewals due', () => {
  const document = makeDocument({ expiryDate: '2026-09-30' });
  const set = makeSet({
    requirements: [
      { ...baseSet.requirements[0], id: 'req-a', documentId: DOC_ID },
      { ...baseSet.requirements[0], id: 'req-b', documentId: DOC_ID },
      { ...baseSet.requirements[0], id: 'req-c', documentId: undefined, linkedDocumentId: undefined },
    ],
  });

  it('lists a document once per set', () => {
    const due = findDocumentRenewalsDue([set], [document], [], TODAY);
    expect(due.map((d) => [d.set.id, d.document.id, d.reason])).toEqual([[SET_ID, DOC_ID, 'expired']]);
    expect(due[0].requirement.id).toBe('req-a');
  });

  it('skips a reason that was already notified, whatever the notification status', () => {
    const raised = {
      type: 'document_renewal',
      assuranceSetId: SET_ID,
      documentId: DOC_ID,
      renewalReason: 'expired',
    } as AppNotification;
    expect(findDocumentRenewalsDue([set], [document], [{ ...raised, status: 'unread' }], TODAY)).toHaveLength(0);
    expect(findDocumentRenewalsDue([set], [document], [{ ...raised, status: 'actioned' }], TODAY)).toHaveLength(0);
  });

  it('raises a new notification when the reason becomes more urgent', () => {
    const earlier = {
      type: 'document_renewal',
      status: 'actioned',
      assuranceSetId: SET_ID,
      documentId: DOC_ID,
      renewalReason: 'expiring',
    } as AppNotification;
    expect(findDocumentRenewalsDue([set], [document], [earlier], TODAY)).toHaveLength(1);
  });
});

describe('document renewal: wording and recipient', () => {
  const document = makeDocument({ title: 'IOPP Certificate', certificateNo: 'DNV-IOPP-77', expiryDate: '2026-11-22' });
  const vesselSet = makeSet({ assuranceType: 'Vessel', subtypes: ['Vessel'], vesselName: 'MV Pacific Endeavour' });

  it('names the reason, its date and the asset in the subject', () => {
    expect(getRenewalSubject('expired', { ...document, expiryDate: '2026-09-30' }, vesselSet, TODAY)).toBe(
      `Expired ${formatMaritimeDate('2026-09-30')}: IOPP Certificate (MV Pacific Endeavour)`,
    );
    expect(getRenewalSubject('expiring', document, vesselSet, TODAY)).toBe(
      'Expires in 41 days: IOPP Certificate (MV Pacific Endeavour)',
    );
    expect(getRenewalSubject('charter_window', document, vesselSet, TODAY)).toBe(
      `Expires before charter end ${formatMaritimeDate('2027-01-31')}: IOPP Certificate (MV Pacific Endeavour)`,
    );
    expect(getRenewalSubject('reupload_requested', document, vesselSet, TODAY)).toBe(
      'Reupload requested: IOPP Certificate (MV Pacific Endeavour)',
    );
  });

  it('names the provider by the asset type the set covers', () => {
    expect(getRenewalMessage('expired', document, vesselSet)).toContain('as the Vessel Provider of MV Pacific Endeavour');
    const crewSet = makeSet({ assuranceType: 'Crew', subtypes: ['Crew'], crewId: 'CREW-001', crewName: 'Capt. James Stirling' });
    expect(getRenewalMessage('expired', document, crewSet)).toContain('as the Crew Provider of Capt. James Stirling');
    const equipmentSet = makeSet({
      assuranceType: 'Equipment',
      subtypes: ['Equipment'],
      equipmentId: 'EQP-003',
      equipmentName: 'Free-Fall Lifeboat #1',
    });
    expect(getRenewalMessage('expired', document, equipmentSet)).toContain('as the Equipment Provider of Free-Fall Lifeboat #1');
  });

  it('takes the requirement submitter before the set submitter', () => {
    expect(getRenewalSubmitterLabel({ assignedSubmitter: 'Set Submitter' }, { assignedSubmitter: 'Requirement Submitter' })).toBe(
      'Requirement Submitter',
    );
    expect(getRenewalSubmitterLabel({ assignedSubmitter: 'Set Submitter' }, { assignedSubmitter: ' ' })).toBe('Set Submitter');
    expect(getRenewalSubmitterLabel({ assignedSubmitter: undefined })).toBeUndefined();
  });
});

describe('document renewal: metadata and row action', () => {
  const notification = {
    id: 'MAP-NTF-2026-DOCR-00900',
    type: 'document_renewal',
    status: 'unread',
    documentId: DOC_ID,
    assuranceSetId: SET_ID,
  } as AppNotification;
  const ctx = {
    assuranceSets: [{ id: SET_ID, vesselName: 'MV Pacific Endeavour' }],
    documents: [{ id: DOC_ID }],
    capaItems: [],
    projects: [],
    canAccessView: () => true,
  };

  it('files the type under the Document Renewal category with the DOCR id code', () => {
    expect(NOTIFICATION_CATEGORIES).toContain('Document Renewal');
    expect(getNotificationCategory(notification)).toBe('Document Renewal');
    expect(NOTIFICATION_TYPE_META.document_renewal.actionLabel).toBe('Reupload Document');
    expect(generateNotificationId([], 'document_renewal')).toMatch(/^MAP-NTF-\d{4}-DOCR-00001$/);
  });

  it('opens the document, and is disabled when the document is gone', () => {
    expect(getNotificationAction(notification, ctx)).toMatchObject({
      label: 'Reupload Document',
      view: 'documents',
      entityId: DOC_ID,
    });
    expect(getNotificationAction(notification, { ...ctx, documents: [] }).disabledReason).toBe(
      'This document no longer exists.',
    );
  });

  it('stays open when the recipient opens the document', () => {
    expect(isNotificationActionedOnOpen(notification)).toBe(false);
  });
});

describe('store: document renewal notifications', () => {
  const renewalsOf = (setId: string) =>
    useMapStore.getState().notifications.filter((n) => n.type === 'document_renewal' && n.assuranceSetId === setId);

  beforeEach(() => {
    useMapStore.setState({ notifications: [], activePersona: 'Administrator' });
  });

  it('raises each due renewal once, from the system, to the submitter of the set', () => {
    const raised = useMapStore.getState().raiseDocumentRenewalNotifications([SET_ID]);
    const renewals = renewalsOf(SET_ID);
    expect(raised).toBeGreaterThan(0);
    expect(renewals).toHaveLength(raised);
    expect(renewals.every((n) => n.senderName === 'MAP System' && !n.senderUserId)).toBe(true);
    expect(renewals.every((n) => n.recipientUserId === 'USR-102')).toBe(true);
    expect(renewals.every((n) => Boolean(n.renewalReason) && Boolean(n.documentId) && n.status === 'unread')).toBe(true);
    expect(new Set(renewals.map((n) => n.documentId)).size).toBe(raised);

    expect(useMapStore.getState().raiseDocumentRenewalNotifications([SET_ID])).toBe(0);
    expect(renewalsOf(SET_ID)).toHaveLength(raised);
  });

  it('reaches the submitter even when the submitter is the signed-in user', () => {
    useMapStore.setState({ activePersona: 'Submitter' });
    expect(useMapStore.getState().raiseDocumentRenewalNotifications([SET_ID])).toBeGreaterThan(0);
  });

  it('sends a reviewer request to the submitter and leaves the document status as it is', () => {
    const before = useMapStore.getState().documents.find((d) => d.id === DOC_ID)!.verificationStatus;
    const raised = useMapStore.getState().requestDocumentReupload(DOC_ID, 'Scan is of the 2024 certificate. Upload the 2026 renewal.');
    expect(raised).toBeGreaterThan(0);

    const request = renewalsOf(SET_ID).find((n) => n.renewalReason === 'reupload_requested')!;
    expect(request.recipientUserId).toBe('USR-102');
    expect(request.documentId).toBe(DOC_ID);
    expect(request.message).toBe('Scan is of the 2024 certificate. Upload the 2026 renewal.');
    expect(request.subject.startsWith('Reupload requested: ')).toBe(true);
    expect(useMapStore.getState().documents.find((d) => d.id === DOC_ID)!.verificationStatus).toBe(before);
  });

  it('sends nothing without a reason', () => {
    expect(useMapStore.getState().requestDocumentReupload(DOC_ID, '   ')).toBe(0);
    expect(useMapStore.getState().notifications).toHaveLength(0);
  });

  it('keeps the notification open when it is opened, and closes it when a new version is uploaded', () => {
    useMapStore.getState().requestDocumentReupload(DOC_ID, 'Certificate is outdated.');
    const request = renewalsOf(SET_ID)[0];

    useMapStore.getState().openNotification(request.id);
    expect(useMapStore.getState().notifications.find((n) => n.id === request.id)?.status).toBe('read');

    useMapStore.getState().addDocumentVersion(DOC_ID, 'v9.0', 'renewed.pdf', 1024, 'Renewed certificate.');
    const closed = useMapStore.getState().notifications.find((n) => n.id === request.id);
    expect(closed?.status).toBe('actioned');
    expect(closed?.actionedAt).toBeTruthy();
  });

  it('falls back to the set creator when no submitter is named', () => {
    const state = useMapStore.getState();
    const source = state.assuranceSets.find((s) => s.id === SET_ID)!;
    const orphan: AssuranceSet = {
      ...source,
      id: 'AS-DOCR-TEST-001',
      assignedSubmitter: 'Pending Admin Assignment',
      createdByName: 'K. Osei',
      requirements: source.requirements.map((r) => ({ ...r, assignedSubmitter: undefined })),
    };
    useMapStore.setState({ assuranceSets: [...state.assuranceSets, orphan] });

    expect(useMapStore.getState().raiseDocumentRenewalNotifications([orphan.id])).toBeGreaterThan(0);
    expect(renewalsOf(orphan.id).every((n) => n.recipientUserId === 'USR-101')).toBe(true);

    useMapStore.setState({ assuranceSets: state.assuranceSets });
  });

  it('raises renewals on the seeded data without flooding the inbox', () => {
    const raised = useMapStore.getState().raiseDocumentRenewalNotifications();
    expect(raised).toBeGreaterThan(0);
    expect(raised).toBeLessThan(useMapStore.getState().documents.length);
  });
});
