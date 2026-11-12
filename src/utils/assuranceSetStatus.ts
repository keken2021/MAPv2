/*
  file summary: the status-first reading of an assurance set: Go, Conditional or No-go, what blocks it, its next expiry and the viewer's part in it.
  responsibilities: holds the status thresholds in one block, derives every value from a set's tasks, documents and findings, and orders sets worst first. Stores nothing.
  role in system: used by ProjectAssuranceStatusTable.tsx; ADR 0033.
*/

import type { AssuranceRequirement, AssuranceSet, AssuranceStage } from '../types/assurance';
import type { CapaItem } from '../types/capa';
import type { MasterDocument } from '../types/document';
import { getAssuranceSetObjects } from './assuranceTemplates';
import { findRequirementDocument, isClosedAssuranceSet } from './documentVersionSnapshot';
import { EXPIRY_WARNING_DAYS, getValidityInContractPeriod } from './expiryPolicy';
import { assigneeMatchesUser, orgFieldMatches } from './rbacHelpers';
import { doFindingsBlockSet, getAssuranceSetOpenFindings, isRequirementLate } from './readinessHelpers';
import { isComplianceDeadlineOverdue } from './validation';

/* every threshold of the status rule; findings have no severity field, so status and due date decide which ones block. On a set with no inspection, no finding blocks (doFindingsBlockSet) */
export const ASSURANCE_SET_STATUS_RULES = {
  expirySoonDays: EXPIRY_WARNING_DAYS,
  blockingTaskStatuses: ['Rejected', 'Correction Requested'] as readonly string[],
  blockingApproverDecisions: ['Rejected', 'Returned for Correction'] as readonly string[],
  blockingFindingStatuses: ['Rectification Required'] as readonly string[],
};

export type AssuranceSetStatus = 'No-go' | 'Conditional' | 'Go';
export type AssuranceSetAttention = 'needs_attention' | 'on_track' | 'done';
export type PartyRole = 'client' | 'provider' | 'reviewing';

export interface NextExpiry {
  date: string;
  label: string;
}

export interface AssuranceSetStatusResult {
  /** null for a cancelled set */
  status: AssuranceSetStatus | null;
  attention: AssuranceSetAttention | null;
  /** blocking tasks and set-level blocks, findings not included */
  blockingItems: number;
  openFindings: number;
  blockingFindings: number;
  /** plain words for each red or amber area */
  reasons: string[];
}

/* tasks the rule holds a set to: required, on the set's own list, and not exempted */
const isRequiredTask = (task: AssuranceRequirement) => task.isMandatory && !task.isOtherDocument && !task.exemption;

const countLabel = (count: number, unit: string) => `${count} ${unit}${count === 1 ? '' : 's'}`;

function isBeforeToday(dateStr: string | undefined, today: Date): boolean {
  if (!dateStr) return false;
  const time = new Date(dateStr).getTime();
  if (Number.isNaN(time)) return false;
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return time < startOfToday;
}

/* the date an inspection report stops being valid, or undefined without a readable report date */
function inspectionExpiry(task: AssuranceRequirement): string | undefined {
  const report = task.inspectionReport;
  if (!report?.reportDate) return undefined;
  const expiry = new Date(report.reportDate);
  if (Number.isNaN(expiry.getTime())) return undefined;
  expiry.setMonth(expiry.getMonth() + report.validityMonths);
  return expiry.toISOString().slice(0, 10);
}

/* every expiry a set depends on, with the task it belongs to; exempted tasks do not count */
function listTaskExpiries(
  set: Pick<AssuranceSet, 'requirements'>,
  documents: MasterDocument[],
): { task: AssuranceRequirement; date: string }[] {
  return (set.requirements ?? []).flatMap((task) => {
    if (task.exemption) return [];
    const dates = [findRequirementDocument(task, documents)?.expiryDate, inspectionExpiry(task)];
    return dates.filter((date): date is string => Boolean(date)).map((date) => ({ task, date }));
  });
}

/**
  what: the nearest certificate or inspection expiry of a set; inputs are the set and all documents.
  how: takes the earliest readable date across the documents and inspection reports of its tasks, an expired one included.
  with what file: src/utils/assuranceSetStatus.ts used by ProjectAssuranceStatusTable.tsx.
*/
export function getNextExpiry(
  set: Pick<AssuranceSet, 'requirements'>,
  documents: MasterDocument[],
): NextExpiry | undefined {
  const dated = listTaskExpiries(set, documents)
    .map((expiry) => ({ ...expiry, time: new Date(expiry.date).getTime() }))
    .filter((expiry) => !Number.isNaN(expiry.time))
    .sort((a, b) => a.time - b.time);
  return dated[0] ? { date: dated[0].date, label: dated[0].task.title } : undefined;
}

/**
  what: reads one set as Go, Conditional or No-go, and how many things block it; inputs are the set, all documents, all findings and today.
  how: any red area gives No-go. With none, any amber area gives Conditional and Needs attention, and an open set with nothing else is Conditional and On track. Only a fully closed set with neither is Go. A cancelled set has no status.
  with what file: src/utils/assuranceSetStatus.ts used by ProjectAssuranceStatusTable.tsx.
*/
export function getAssuranceSetStatus(
  set: AssuranceSet,
  documents: MasterDocument[],
  capaItems: CapaItem[],
  today: Date = new Date(),
): AssuranceSetStatusResult {
  const rules = ASSURANCE_SET_STATUS_RULES;
  const findings = getAssuranceSetOpenFindings(set, capaItems);
  const blockingFindings = doFindingsBlockSet(set)
    ? findings.filter(
        (finding) => rules.blockingFindingStatuses.includes(finding.status) || isBeforeToday(finding.dueDate, today),
      ).length
    : 0;

  if (set.stage === 'Cancelled') {
    return {
      status: null,
      attention: null,
      blockingItems: 0,
      openFindings: findings.length,
      blockingFindings,
      reasons: [],
    };
  }

  const closed = isClosedAssuranceSet(set);
  const requiredTasks = (set.requirements ?? []).filter(isRequiredTask);
  const reviewBlocked = requiredTasks.filter((task) => rules.blockingTaskStatuses.includes(task.verifierStatus));
  const lateTasks = closed ? [] : requiredTasks.filter((task) => isRequirementLate(task, today));

  const expiries = listTaskExpiries(set, documents).map((expiry) => ({
    ...expiry,
    validity: getValidityInContractPeriod(expiry.date, set, today).state,
  }));
  const lapsed = expiries.filter((expiry) => expiry.validity === 'lapsed');
  const lapsedRequired = lapsed.filter((expiry) => isRequiredTask(expiry.task));
  const expiringCount = expiries.filter(
    (expiry) => expiry.validity === 'expiring_soon' || expiry.validity === 'expires_in_period',
  ).length;

  const deadlinePassed = !closed && isComplianceDeadlineOverdue(set, today);
  const approverBlocked = Boolean(set.approverDecision) && rules.blockingApproverDecisions.includes(set.approverDecision as string);

  /* a task can fail more than one check; it still counts once */
  const blockedTaskIds = new Set(
    [...reviewBlocked, ...lateTasks, ...lapsedRequired.map((expiry) => expiry.task)].map((task) => task.id),
  );
  const blockingItems = blockedTaskIds.size + (deadlinePassed ? 1 : 0) + (approverBlocked ? 1 : 0);

  const redReasons = [
    reviewBlocked.length > 0 && `${countLabel(reviewBlocked.length, 'required task')} rejected or sent back`,
    lateTasks.length > 0 && `${countLabel(lateTasks.length, 'required task')} late`,
    lapsedRequired.length > 0 && `${countLabel(lapsedRequired.length, 'required certificate')} expired`,
    deadlinePassed && 'Compliance deadline passed',
    approverBlocked && `Approver: ${set.approverDecision}`,
    blockingFindings > 0 && countLabel(blockingFindings, 'blocking finding'),
  ].filter((reason): reason is string => Boolean(reason));

  const otherFindings = findings.length - blockingFindings;
  const lapsedOptional = lapsed.length - lapsedRequired.length;
  const amberReasons = [
    otherFindings > 0 && countLabel(otherFindings, 'open finding'),
    expiringCount > 0 && `${countLabel(expiringCount, 'certificate')} expiring within ${rules.expirySoonDays} days or before the contract ends`,
    lapsedOptional > 0 && `${countLabel(lapsedOptional, 'optional certificate')} expired`,
    set.closureType === 'partial' && 'Partly closed',
  ].filter((reason): reason is string => Boolean(reason));

  const counts = { blockingItems, openFindings: findings.length, blockingFindings };

  if (redReasons.length > 0) {
    return { status: 'No-go', attention: 'needs_attention', ...counts, reasons: [...redReasons, ...amberReasons] };
  }
  if (amberReasons.length > 0) {
    return { status: 'Conditional', attention: 'needs_attention', ...counts, reasons: amberReasons };
  }
  if (!closed) {
    return { status: 'Conditional', attention: 'on_track', ...counts, reasons: [`Awaiting ${set.stage}`] };
  }
  return { status: 'Go', attention: 'done', ...counts, reasons: [] };
}

/**
  what: the viewer's part in a set and the other organizations on it; inputs are the set and the viewer's organization and name.
  how: reads the set's parties, then its client, provider, object owner and reviewer fields, because most sets have no party list. One organization can hold several parts. The account persona plays no part.
  with what file: src/utils/assuranceSetStatus.ts used by ProjectAssuranceStatusTable.tsx.
*/
export function getPartyRoles(
  set: AssuranceSet,
  viewer: { organization?: string; name?: string },
): { roles: PartyRole[]; otherParties: string[] } {
  const parties = set.parties ?? [];
  const inGroup = (group: string) => parties.filter((party) => party.group === group).map((party) => party.organization);
  const stakeholders = [set.stakeholders, set.assignedStakeholders];

  const orgsByRole: Record<PartyRole, (string | undefined)[]> = {
    client: [...inGroup('Client'), set.clientOrg || set.charterer],
    provider: [
      ...inGroup('Vendor'),
      set.serviceProviderOrg,
      ...getAssuranceSetObjects(set).map((object) => object.ownerOrganization),
    ],
    reviewing: [
      ...inGroup('Third party'),
      ...stakeholders.flatMap((mapping) => [mapping?.verifierOrg, mapping?.inspectorOrg, mapping?.approverOrg]),
    ],
  };

  const organization = viewer.organization?.trim() ?? '';
  const matchesViewer = (org: string) => Boolean(organization) && orgFieldMatches(organization, org);
  const holdsRole = (role: PartyRole) => orgsByRole[role].some((org) => Boolean(org) && matchesViewer(org as string));
  const isNamedReviewer = [set.assignedVerifier, set.assignedInspector, set.assignedApprover].some((assigned) =>
    assigneeMatchesUser(assigned, viewer),
  );

  const roles = (['client', 'provider', 'reviewing'] as PartyRole[]).filter(
    (role) => holdsRole(role) || (role === 'reviewing' && isNamedReviewer),
  );

  const otherParties = [...new Set(Object.values(orgsByRole).flat().filter((org): org is string => Boolean(org?.trim())))].filter(
    (org) => !matchesViewer(org),
  );

  return { roles, otherParties };
}

const STATUS_RANK: Record<AssuranceSetStatus, number> = { 'No-go': 0, Conditional: 1, Go: 2 };

const STAGE_ORDER: AssuranceStage[] = [
  'Initiated',
  'Validation',
  'Verification',
  'Inspection',
  'Approval',
  'Certified',
  'Approved',
  'Cancelled',
];

/* orders two stages along the pipeline */
export function compareAssuranceSetStage(a: AssuranceStage, b: AssuranceStage): number {
  return STAGE_ORDER.indexOf(a) - STAGE_ORDER.indexOf(b);
}

/**
  what: the default order of a status table: worst first; inputs are two rows.
  how: No-go, Conditional, Go, then a set with no status; within a group the least ready comes first, then by set ID.
  with what file: src/utils/assuranceSetStatus.ts used by ProjectAssuranceStatusTable.tsx.
*/
export function compareWorstFirst(
  a: { set: Pick<AssuranceSet, 'id'>; status: AssuranceSetStatus | null; readiness: number },
  b: { set: Pick<AssuranceSet, 'id'>; status: AssuranceSetStatus | null; readiness: number },
): number {
  const rank = (status: AssuranceSetStatus | null) => (status ? STATUS_RANK[status] : Object.keys(STATUS_RANK).length);
  return rank(a.status) - rank(b.status) || a.readiness - b.readiness || a.set.id.localeCompare(b.set.id);
}
