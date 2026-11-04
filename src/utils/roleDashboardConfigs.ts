/*
  file summary: Role-specific dashboard configuration builders for MAPv2 shared dashboard frame.
  responsibilities: constructs DashboardConfig objects for all 5 roles (Administrator as client, Submitter, Verifier, Inspector, Approver) mapping store state into KPI tiles, prioritized action rows, and recent activity items.
  role in system: consumed by DashboardView, ApproverDashboardView, VerifierWorkspaceView, and InspectorWorkspaceView.
*/

import { AssuranceSet } from '../types/assurance';
import { CapaItem } from '../types/capa';
import { AuditTrailEvent } from '../types/audit';
import { Project } from '../types/project';
import { MasterDocument } from '../types/document';
import { UserProfile, RoleName } from '../types/user';
import { DashboardConfig, DashboardActionItem, DashboardKpiTile } from '../types/dashboard';
import { isAssuranceSetAssignedToPersona } from './rbacHelpers';
import {
  isSetNeedingPeople,
  isSetOverdue,
  isSetDueThisWeek,
  navigateToFilteredList,
} from './dashboardTileNavigation';
import { getRoleRecentActivity } from './recentActivityFeed';

/**
 * Returns missing roles for an assurance set (submitter, verifier, inspector, approver).
 */
export function getMissingRolesForSet(set: AssuranceSet): string[] {
  const missing: string[] = [];
  if (!set.assignedSubmitter || set.assignedSubmitter === 'Unassigned' || set.assignedSubmitter.toLowerCase().includes('pending')) {
    missing.push('submitter');
  }
  if (!set.assignedVerifier || set.assignedVerifier === 'Unassigned' || set.assignedVerifier.toLowerCase().includes('pending')) {
    missing.push('verifier');
  }
  if (!set.assignedInspector || set.assignedInspector === 'Unassigned' || set.assignedInspector.toLowerCase().includes('pending')) {
    missing.push('inspector');
  }
  if (!set.assignedApprover || set.assignedApprover === 'Unassigned' || set.assignedApprover.toLowerCase().includes('pending')) {
    missing.push('approver');
  }
  return missing;
}

/**
 * Formats missing roles into a plain sentence snippet, e.g.:
 * ["verifier", "inspector"] -> "No verifier, no inspector"
 * ["approver"] -> "No approver"
 */
export function formatMissingRolesSnippet(missing: string[]): string {
  if (missing.length === 0) return '';
  return missing.map((r) => `no ${r}`).join(', ').replace(/^no /, 'No ');
}

/**
 * Formats start date into "starts <day> <Mon>" (e.g. "starts 10 Nov").
 */
export function formatStartDateSnippet(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  const day = d.getUTCDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mon = months[d.getUTCMonth()];
  return `starts ${day} ${mon}`;
}

/**
 * Returns the effective start date for sorting and displaying a set.
 */
export function getSetStartDate(set: AssuranceSet): string | undefined {
  return set.charterWindowStart || set.projectWindowStart || set.complianceDeadline || set.targetDate;
}

export interface AdministratorClientConfigParams {
  assuranceSets: AssuranceSet[];
  capaItems: CapaItem[];
  auditEvents: AuditTrailEvent[];
  projects?: Project[];
  activeOrganization?: string;
  setCurrentHashView: (view: string, entityId?: string) => void;
  now?: Date;
}

/**
 * Builds the DashboardConfig for the Administrator as client role.
 */
export function getAdministratorClientDashboardConfig({
  assuranceSets,
  capaItems,
  auditEvents,
  projects = [],
  activeOrganization = 'Northwind Shipping',
  setCurrentHashView,
  now = new Date(),
}: AdministratorClientConfigParams): DashboardConfig {
  const needingPeopleSets = assuranceSets
    .filter(isSetNeedingPeople)
    .sort((a, b) => {
      const dateA = Date.parse(getSetStartDate(a) || '9999-12-31');
      const dateB = Date.parse(getSetStartDate(b) || '9999-12-31');
      return dateA - dateB;
    });

  const overdueSetsCount = assuranceSets.filter((s) => isSetOverdue(s, now)).length;
  const dueThisWeekCount = assuranceSets.filter((s) => isSetDueThisWeek(s, now)).length;
  const openFindingsCount = capaItems.filter((c) => c.status !== 'Verified & Closed').length;

  const tiles: DashboardKpiTile[] = [
    {
      id: 'needing_people',
      label: 'Sets needing people',
      value: needingPeopleSets.length,
      tone: 'neutral',
      onClick: () => navigateToFilteredList('assurance-sets', 'filter', 'needing_people', setCurrentHashView),
    },
    {
      id: 'overdue',
      label: 'Overdue',
      value: overdueSetsCount,
      tone: 'neutral',
      onClick: () => navigateToFilteredList('assurance-sets', 'filter', 'overdue', setCurrentHashView),
    },
    {
      id: 'due_this_week',
      label: 'Due this week',
      value: dueThisWeekCount,
      tone: 'neutral',
      onClick: () => navigateToFilteredList('assurance-sets', 'filter', 'due_this_week', setCurrentHashView),
    },
    {
      id: 'open_findings',
      label: 'Open findings',
      value: openFindingsCount,
      tone: 'neutral',
      onClick: () => navigateToFilteredList('capa', 'filter', 'open_findings', setCurrentHashView),
    },
  ];

  const actionItems: DashboardActionItem[] = needingPeopleSets.slice(0, 5).map((set) => {
    const missing = getMissingRolesForSet(set);
    const missingSnippet = formatMissingRolesSnippet(missing);
    const startSnippet = formatStartDateSnippet(getSetStartDate(set));
    const subtitle = [missingSnippet, startSnippet].filter(Boolean).join(' · ');

    const vessel = set.vesselName?.trim();
    const title = set.title?.trim() || set.id;
    const itemTitle = vessel && !title.includes(vessel) ? `${vessel} · ${title}` : title;

    return {
      id: set.id,
      title: itemTitle,
      subtitle,
      buttonLabel: 'Assign',
      onAction: () => {
        setCurrentHashView('assurance-sets', set.id);
      },
    };
  });

  const activityItems = getRoleRecentActivity('Administrator as client', auditEvents, 5, now);
  const projectsCount = projects.length > 0 ? projects.length : 3;

  return {
    roleTitle: 'Administrator as client',
    subtitle: `${activeOrganization} · ${projectsCount} projects`,
    tiles,
    actionItems,
    activityItems,
    seeAllText: needingPeopleSets.length > 0 ? `See all ${needingPeopleSets.length}` : undefined,
    onSeeAll: () => navigateToFilteredList('assurance-sets', 'filter', 'needing_people', setCurrentHashView),
    emptyActionMessage: 'Nothing needs you today',
  };
}

/**
 * Formats a date into "<day> <Mon>" (e.g. "8 Nov", "28 Nov").
 */
export function formatShortDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  const day = d.getUTCDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mon = months[d.getUTCMonth()];
  return `${day} ${mon}`;
}

/**
 * Returns true if the document expires within 30 days of now.
 */
export function isDocumentExpiringIn30Days(doc: MasterDocument, now = new Date()): boolean {
  if (!doc.expiryDate) return false;
  const expiry = new Date(doc.expiryDate);
  if (Number.isNaN(expiry.getTime())) return false;
  const diffDays = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= 30;
}

export interface SubmitterConfigParams {
  assuranceSets: AssuranceSet[];
  documents: MasterDocument[];
  capaItems: CapaItem[];
  auditEvents: AuditTrailEvent[];
  sessionUser?: Pick<UserProfile, 'id' | 'name' | 'organization' | 'roles'> | { id?: string; name?: string; organization?: string; roles?: RoleName[] } | null;
  activeOrganization?: string;
  setCurrentHashView: (view: string, entityId?: string) => void;
  now?: Date;
}

/**
 * Builds the DashboardConfig for the Submitter role.
 */
export function getSubmitterDashboardConfig({
  assuranceSets,
  documents,
  capaItems,
  auditEvents,
  sessionUser,
  activeOrganization = 'Northwind Marine Pty Ltd',
  setCurrentHashView,
  now = new Date(),
}: SubmitterConfigParams): DashboardConfig {
  const userForRbac: Pick<UserProfile, 'id' | 'name' | 'organization' | 'roles'> | null = sessionUser
    ? {
        id: sessionUser.id || '',
        name: sessionUser.name || '',
        organization: sessionUser.organization || '',
        roles: sessionUser.roles || ['Submitter'],
      }
    : null;

  const assignedSets = assuranceSets.filter((set) =>
    isAssuranceSetAssignedToPersona(set, 'Submitter', activeOrganization, userForRbac),
  );

  const assignedSetIds = new Set(assignedSets.map((s) => s.id));
  const assignedVesselIds = new Set(assignedSets.map((s) => s.vesselId).filter(Boolean));

  const docIdToSetId = new Map<string, string>();
  for (const set of assignedSets) {
    for (const r of set.requirements || []) {
      if (r.documentId) docIdToSetId.set(r.documentId, set.id);
      if (r.linkedDocumentId) docIdToSetId.set(r.linkedDocumentId, set.id);
    }
  }

  // 1. Returned documents
  const returnedItems: DashboardActionItem[] = [];
  for (const set of assignedSets) {
    for (const req of set.requirements || []) {
      if (req.verifierStatus === 'Correction Requested') {
        const vessel = set.vesselName || set.title;
        returnedItems.push({
          id: `returned-${req.id}`,
          tag: 'Returned',
          tagTone: 'bad',
          title: `${req.title} · ${vessel}`,
          subtitle: req.notes || req.verificationResultSummary || 'Expired date on scan',
          buttonLabel: 'Re-upload',
          onAction: () => {
            setCurrentHashView('assurance-sets', set.id);
          },
        });
      }
    }
  }

  // Also check documents directly
  for (const doc of documents) {
    if (doc.verificationStatus === 'Correction Requested' || doc.verificationStatus === 'Rejected') {
      const anyDoc = doc as any;
      const linkedSetId = docIdToSetId.get(doc.id) || (anyDoc.assuranceSetId as string | undefined);
      const isAssigned = Boolean(linkedSetId) ||
        Boolean(doc.vesselId && assignedVesselIds.has(doc.vesselId)) ||
        Boolean(anyDoc.organization && anyDoc.organization.includes(activeOrganization));
      if (isAssigned && !returnedItems.some((item) => item.id.includes(doc.id))) {
        const entity = doc.vesselAttributes?.vesselName || anyDoc.vesselName || anyDoc.organization || 'Vessel';
        const docTitle = doc.title || anyDoc.name || 'Document';
        returnedItems.push({
          id: `returned-doc-${doc.id}`,
          tag: 'Returned',
          tagTone: 'bad',
          title: `${docTitle} · ${entity}`,
          subtitle: doc.verificationNotes || anyDoc.rejectionReason || 'Correction requested by verifier',
          buttonLabel: 'Re-upload',
          onAction: () => {
            if (linkedSetId) {
              setCurrentHashView('assurance-sets', linkedSetId);
            } else {
              setCurrentHashView('documents');
            }
          },
        });
      }
    }
  }

  // 2. Open findings
  const findingItems: DashboardActionItem[] = [];
  const assignedCapas = capaItems.filter((c) => {
    if (c.status === 'Verified & Closed') return false;
    if (c.assuranceSetId && assignedSetIds.has(c.assuranceSetId)) return true;
    if (c.vesselId && assignedVesselIds.has(c.vesselId)) return true;
    return assignedSets.some((s) => s.vesselName && c.vesselName && s.vesselName.toLowerCase() === c.vesselName.toLowerCase());
  });

  for (const capa of assignedCapas) {
    findingItems.push({
      id: `finding-${capa.id}`,
      tag: 'Finding',
      tagTone: 'warn',
      title: `${capa.title} · ${capa.vesselName || 'Assigned set'}`,
      subtitle: capa.dueDate ? `Response due ${formatShortDate(capa.dueDate)}` : 'Response required',
      buttonLabel: 'Respond',
      onAction: () => {
        setCurrentHashView('capa');
      },
    });
  }

  // 3. Missing documents sorted by nearest set due date
  const missingItems: DashboardActionItem[] = [];
  const sortedSetsByDueDate = [...assignedSets].sort((a, b) => {
    const dateA = Date.parse(a.targetDate || a.complianceDeadline || a.charterWindowStart || '9999-12-31');
    const dateB = Date.parse(b.targetDate || b.complianceDeadline || b.charterWindowStart || '9999-12-31');
    return dateA - dateB;
  });

  for (const set of sortedSetsByDueDate) {
    const unfulfilled = (set.requirements || []).filter((r) => !r.isFulfilled && !r.documentId);
    if (unfulfilled.length > 0) {
      const setDueDate = set.targetDate || set.complianceDeadline || set.charterWindowStart;
      const dueSnippet = setDueDate ? `Set due ${formatShortDate(setDueDate)}` : 'Set due soon';
      const vessel = set.vesselName || set.title;

      missingItems.push({
        id: `missing-${set.id}`,
        tag: 'Missing',
        tagTone: 'warn',
        title: `${unfulfilled.length} document${unfulfilled.length === 1 ? '' : 's'} · ${vessel}`,
        subtitle: dueSnippet,
        buttonLabel: 'Upload',
        onAction: () => {
          setCurrentHashView('assurance-sets', set.id);
        },
      });
    }
  }

  // 4. Certificates expiring in 30 days
  const expiringItems: DashboardActionItem[] = [];
  for (const doc of documents) {
    if (isDocumentExpiringIn30Days(doc, now)) {
      const anyDoc = doc as any;
      const linkedSetId = docIdToSetId.get(doc.id) || (anyDoc.assuranceSetId as string | undefined);
      const isAssigned = Boolean(linkedSetId) ||
        Boolean(doc.vesselId && assignedVesselIds.has(doc.vesselId)) ||
        Boolean(anyDoc.organization && anyDoc.organization.includes(activeOrganization));
      if (isAssigned) {
        const entity = doc.vesselAttributes?.vesselName || anyDoc.vesselName || anyDoc.organization || 'Vessel';
        const docTitle = doc.title || anyDoc.name || 'Document';
        expiringItems.push({
          id: `expiring-${doc.id}`,
          tag: 'Expiring',
          tagTone: 'warn',
          title: `${docTitle} · ${entity}`,
          subtitle: `Expires ${formatShortDate(doc.expiryDate)}`,
          buttonLabel: 'Renew',
          onAction: () => {
            setCurrentHashView('documents');
          },
        });
      }
    }
  }

  // Combined in strict order: Returned -> Findings -> Missing -> Expiring
  const actionItems: DashboardActionItem[] = [
    ...returnedItems,
    ...findingItems,
    ...missingItems,
    ...expiringItems,
  ].slice(0, 5);

  const totalActions = returnedItems.length + findingItems.length + missingItems.length + expiringItems.length;

  const tiles: DashboardKpiTile[] = [
    {
      id: 'returned',
      label: 'Returned',
      value: returnedItems.length,
      tone: 'bad',
      onClick: () => navigateToFilteredList('assurance-sets', 'filter', 'returned', setCurrentHashView),
    },
    {
      id: 'missing',
      label: 'Missing',
      value: missingItems.length,
      tone: 'warn',
      onClick: () => navigateToFilteredList('assurance-sets', 'filter', 'missing', setCurrentHashView),
    },
    {
      id: 'expiring',
      label: 'Expiring in 30 days',
      value: expiringItems.length,
      tone: 'warn',
      onClick: () => navigateToFilteredList('documents', 'filter', 'Expiring in 30 Days', setCurrentHashView),
    },
    {
      id: 'open_findings',
      label: 'Open findings',
      value: findingItems.length,
      tone: 'neutral',
      onClick: () => navigateToFilteredList('capa', 'filter', 'open', setCurrentHashView),
    },
  ];

  const activityItems = getRoleRecentActivity('Submitter', auditEvents, 5, now);

  return {
    roleTitle: 'Submitter',
    subtitle: `${assignedSets.length} assigned assurance sets`,
    tiles,
    actionItems,
    activityItems,
    seeAllText: totalActions > 0 ? `See all ${totalActions}` : undefined,
    onSeeAll: () => navigateToFilteredList('assurance-sets', 'filter', 'ALL', setCurrentHashView),
    emptyActionMessage: 'Nothing needs you today',
  };
}
