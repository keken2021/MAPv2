/*
  file summary: pure helpers for document renewal notifications.
  responsibilities: decides why a document on an assurance set must be renewed, lists the renewals that still need a notification, and words the notification.
  role in system: consumed by useMapStore.ts and NotificationDetailModal.tsx.
*/

import { AssuranceRequirement, AssuranceSet } from '../types/assurance';
import { MasterDocument } from '../types/document';
import { AppNotification, DocumentRenewalReason } from '../types/notification';
import { getAssuranceSetAsset } from './assuranceTemplates';
import { formatMaritimeDate, getProviderLabel } from './formatters';
import { EXPIRY_WARNING_DAYS } from './expiryPolicy';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/* on-screen names for the stored renewal reasons */
export const DOCUMENT_RENEWAL_REASON_LABELS: Record<DocumentRenewalReason, string> = {
  expired: 'Expired',
  charter_window: 'Expires before the charter ends',
  expiring: 'Expiring soon',
  reupload_requested: 'Reupload requested by a reviewer',
};

/* whole days from today to a date; negative once the date has passed, undefined for an unreadable date */
function getDaysUntil(dateStr: string | undefined, today: Date): number | undefined {
  if (!dateStr) return undefined;
  const time = new Date(dateStr).getTime();
  if (Number.isNaN(time)) return undefined;
  return Math.ceil((time - today.getTime()) / MS_PER_DAY);
}

/**
  what: why a document on an assurance set must be renewed, or undefined when it need not be; inputs are the document, the set and today's date.
  how: one reason per document per set, the most urgent first: expired, then an expiry date before the end of the set's charter window, then the expiring state.
  with what file: src/utils/documentRenewalHelpers.ts used by findDocumentRenewalsDue.
*/
export function getDocumentRenewalReason(
  document: Pick<MasterDocument, 'expiryDate' | 'complianceState'>,
  set: Pick<AssuranceSet, 'charterWindowEnd'>,
  today: Date = new Date(),
): Exclude<DocumentRenewalReason, 'reupload_requested'> | undefined {
  const daysLeft = getDaysUntil(document.expiryDate, today);
  if (document.complianceState === 'Expired' || (daysLeft !== undefined && daysLeft < 0)) {
    return 'expired';
  }

  const expiry = new Date(document.expiryDate).getTime();
  const charterEnd = new Date(set.charterWindowEnd).getTime();
  if (!Number.isNaN(expiry) && !Number.isNaN(charterEnd) && expiry < charterEnd) {
    return 'charter_window';
  }

  return document.complianceState === 'Expiring < 6 Mos' ? 'expiring' : undefined;
}

/* shown on a re-upload control that is not open yet */
export const DOCUMENT_REUPLOAD_BLOCK_REASON =
  'Re-upload opens when the document expires or a reviewer sends it back.';

/**
  what: true when a document's expiry date has passed or its state is expired; inputs are the document and today's date.
  how: reads complianceState, then compares expiryDate with today.
  with what file: src/utils/documentRenewalHelpers.ts used by getDocumentReuploadBlockReason here.
*/
export function isDocumentExpired(
  document: Pick<MasterDocument, 'expiryDate' | 'complianceState'>,
  today: Date = new Date(),
): boolean {
  const daysLeft = getDaysUntil(document.expiryDate, today);
  return document.complianceState === 'Expired' || (daysLeft !== undefined && daysLeft < 0);
}

/**
  what: compliance state a document takes from its expiry date; inputs are the expiry date and today's date.
  how: expired once the date has passed, expiring within the warning period (EXPIRY_WARNING_DAYS), otherwise valid.
  with what file: src/utils/documentRenewalHelpers.ts used by useMapStore.ts when a new version carries a new expiry date.
*/
export function getComplianceStateForExpiry(
  expiryDate: string,
  today: Date = new Date(),
): MasterDocument['complianceState'] {
  const daysLeft = getDaysUntil(expiryDate, today);
  if (daysLeft === undefined) return 'Valid';
  if (daysLeft < 0) return 'Expired';
  /* the stored state keeps its name; the period is the one warning period (pending supervisor Q3) */
  return daysLeft <= EXPIRY_WARNING_DAYS ? 'Expiring < 6 Mos' : 'Valid';
}

/**
  what: counts of documents expiring within six months and documents already expired; input is the document list.
  how: reads complianceState, the same states the library table badges.
  with what file: src/utils/documentRenewalHelpers.ts used by DocumentLibraryView.tsx and DashboardView.tsx.
*/
export function countDocumentsByExpiry(
  documents: Pick<MasterDocument, 'complianceState'>[],
): { expiring: number; expired: number } {
  return {
    expiring: documents.filter((d) => d.complianceState === 'Expiring < 6 Mos').length,
    expired: documents.filter((d) => d.complianceState === 'Expired').length,
  };
}

/**
  what: true when a certificate's expiry date falls before the contract end; inputs are the document and the contract end.
  how: compares the two dates, and treats an equal date as still covering the contract.
  with what file: src/utils/documentRenewalHelpers.ts used by AssuranceDetailView.tsx and ProjectDetailView.tsx.
*/
export function documentExpiresBeforeContractEnd(
  document: Pick<MasterDocument, 'expiryDate'>,
  charterWindowEnd: string,
): boolean {
  const expiry = new Date(document.expiryDate).getTime();
  const charterEnd = new Date(charterWindowEnd).getTime();
  return !Number.isNaN(expiry) && !Number.isNaN(charterEnd) && expiry < charterEnd;
}

/**
  what: attached certificates that expire before a contract end, each document once; inputs are the set, the library and the contract end.
  how: walks the set's requirements, keeps the first requirement that points at each document, and keeps the document when its expiry is before the end.
  with what file: src/utils/documentRenewalHelpers.ts used by AssuranceDetailView.tsx and ProjectDetailView.tsx.
*/
export function listCertificatesShortOfContract(
  set: Pick<AssuranceSet, 'requirements'>,
  documents: MasterDocument[],
  charterWindowEnd: string,
): MasterDocument[] {
  const seen = new Set<string>();
  const short: MasterDocument[] = [];
  set.requirements.forEach((requirement) => {
    const documentId = requirement.documentId || requirement.linkedDocumentId;
    if (!documentId || seen.has(documentId)) return;
    seen.add(documentId);
    const document = documents.find((d) => d.id === documentId);
    if (!document || !documentExpiresBeforeContractEnd(document, charterWindowEnd)) return;
    short.push(document);
  });
  return short;
}

/**
  what: why a document already on record cannot be re-uploaded yet, or undefined when it can; inputs are the document, all notifications, today's date and an optional contract end.
  how: re-upload is open when the document is expired, when it expires before the contract end, when a reviewer returned or rejected it, or while a reviewer's reupload request is still open.
  with what file: src/utils/documentRenewalHelpers.ts used by AssuranceDetailView.tsx, DocumentReviewDrawer.tsx, DocumentDetailView.tsx, VersionHistoryDrawer.tsx and DocumentUploadModal.tsx.
*/
export function getDocumentReuploadBlockReason(
  document: Pick<MasterDocument, 'id' | 'expiryDate' | 'complianceState' | 'verificationStatus'>,
  notifications: Pick<AppNotification, 'type' | 'documentId' | 'renewalReason' | 'status'>[],
  today: Date = new Date(),
  charterWindowEnd?: string,
): string | undefined {
  if (isDocumentExpired(document, today)) return undefined;
  if (charterWindowEnd && documentExpiresBeforeContractEnd(document, charterWindowEnd)) return undefined;
  if (
    document.verificationStatus === 'Correction Requested' ||
    document.verificationStatus === 'Rejected'
  ) {
    return undefined;
  }
  const hasOpenReuploadRequest = notifications.some(
    (n) =>
      n.type === 'document_renewal' &&
      n.renewalReason === 'reupload_requested' &&
      n.documentId === document.id &&
      n.status !== 'actioned',
  );
  return hasOpenReuploadRequest ? undefined : DOCUMENT_REUPLOAD_BLOCK_REASON;
}

export interface DocumentRenewalDue {
  set: AssuranceSet;
  requirement: AssuranceRequirement;
  document: MasterDocument;
  reason: Exclude<DocumentRenewalReason, 'reupload_requested'>;
}

/**
  what: true when a renewal notification was already raised for this set, document and reason, whatever its status.
  how: a reason is notified once per document per set; a later, more urgent reason raises a new notification.
  with what file: src/utils/documentRenewalHelpers.ts used by findDocumentRenewalsDue.
*/
export function hasDocumentRenewal(
  notifications: Pick<AppNotification, 'type' | 'assuranceSetId' | 'documentId' | 'renewalReason'>[],
  assuranceSetId: string,
  documentId: string,
  reason: DocumentRenewalReason,
): boolean {
  return notifications.some(
    (n) =>
      n.type === 'document_renewal' &&
      n.assuranceSetId === assuranceSetId &&
      n.documentId === documentId &&
      n.renewalReason === reason,
  );
}

/**
  what: renewals that still need a notification; inputs are the assurance sets to check, all documents, all notifications and today's date.
  how: takes each requirement's document once per set, keeps it when it has a renewal reason, and skips it when a renewal notification was already raised for the same set, document and reason.
  with what file: src/utils/documentRenewalHelpers.ts used by useMapStore.ts.
*/
export function findDocumentRenewalsDue(
  sets: AssuranceSet[],
  documents: MasterDocument[],
  notifications: AppNotification[],
  today: Date = new Date(),
): DocumentRenewalDue[] {
  const due: DocumentRenewalDue[] = [];
  sets.forEach((set) => {
    const seenDocumentIds = new Set<string>();
    set.requirements.forEach((requirement) => {
      const documentId = requirement.documentId || requirement.linkedDocumentId;
      if (!documentId || seenDocumentIds.has(documentId)) return;
      seenDocumentIds.add(documentId);

      const document = documents.find((d) => d.id === documentId);
      if (!document) return;
      const reason = getDocumentRenewalReason(document, set, today);
      if (!reason || hasDocumentRenewal(notifications, set.id, documentId, reason)) return;
      due.push({ set, requirement, document, reason });
    });
  });
  return due;
}

/**
  what: stakeholder label of the submitter a renewal goes to: the requirement's submitter, then the set's submitter.
  how: returns undefined when neither is named, so the caller falls back to the set creator.
  with what file: src/utils/documentRenewalHelpers.ts used by useMapStore.ts.
*/
export function getRenewalSubmitterLabel(
  set: Pick<AssuranceSet, 'assignedSubmitter'>,
  requirement?: Pick<AssuranceRequirement, 'assignedSubmitter'>,
): string | undefined {
  return requirement?.assignedSubmitter?.trim() || set.assignedSubmitter?.trim() || undefined;
}

/**
  what: subject line of a renewal notification; inputs are the reason, the document, the set and today's date.
  how: names the reason with its date or day count, then the document and the asset the set covers.
  with what file: src/utils/documentRenewalHelpers.ts used by useMapStore.ts.
*/
export function getRenewalSubject(
  reason: DocumentRenewalReason,
  document: Pick<MasterDocument, 'title' | 'expiryDate'>,
  set: Parameters<typeof getAssuranceSetAsset>[0] & Pick<AssuranceSet, 'charterWindowEnd'>,
  today: Date = new Date(),
): string {
  /* a crew or equipment document title often carries the asset name already */
  const assetName = getAssuranceSetAsset(set).name;
  const target = document.title.includes(assetName) ? document.title : `${document.title} (${assetName})`;
  const daysLeft = getDaysUntil(document.expiryDate, today);
  switch (reason) {
    case 'expired':
      return `${target} is expired please re-upload`;
    case 'charter_window':
      return `Expires before charter end ${formatMaritimeDate(set.charterWindowEnd)}: ${target}`;
    case 'expiring':
      return daysLeft !== undefined && daysLeft >= 0
        ? `Expires in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}: ${target}`
        : `Expiring soon: ${target}`;
    case 'reupload_requested':
    default:
      return `Reupload requested: ${target}`;
  }
}

/**
  what: message of a renewal notification raised by the system; inputs are the reason, the document and the set.
  how: states the dates behind the reason and what the submitter must upload, and names the provider by the asset type the set covers.
  with what file: src/utils/documentRenewalHelpers.ts used by useMapStore.ts.
*/
export function getRenewalMessage(
  reason: Exclude<DocumentRenewalReason, 'reupload_requested'>,
  document: Pick<MasterDocument, 'certificateNo' | 'expiryDate'>,
  set: Parameters<typeof getAssuranceSetAsset>[0] & Pick<AssuranceSet, 'title' | 'charterWindowEnd'>,
): string {
  const asset = getAssuranceSetAsset(set);
  const certificate = `Certificate ${document.certificateNo}`;
  const expiry = formatMaritimeDate(document.expiryDate);
  const upload = `Upload the renewed certificate as the ${getProviderLabel(asset.type)} of ${asset.name} on ${set.title}.`;
  switch (reason) {
    case 'expired':
      return `${certificate} expired on ${expiry}. ${upload}`;
    case 'charter_window':
      return `${certificate} expires on ${expiry}, before the charter ends on ${formatMaritimeDate(set.charterWindowEnd)}. ${upload}`;
    case 'expiring':
    default:
      return `${certificate} expires on ${expiry}. ${upload}`;
  }
}
