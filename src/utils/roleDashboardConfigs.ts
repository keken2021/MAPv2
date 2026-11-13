/*
  file summary: Role-specific dashboard configuration builders for MAPv2 shared dashboard frame.
  responsibilities: constructs DashboardConfig objects for all 6 role configs (Administrator, Administrator as client, Submitter, Verifier, Inspector, Approver) mapping store state into KPI tiles, prioritized action rows, and recent activity items.
  role in system: consumed by DashboardView, ApproverDashboardView, VerifierWorkspaceView, and InspectorWorkspaceView.
*/

import { AssuranceSet } from '../types/assurance';
import { CapaItem } from '../types/capa';
import { AuditTrailEvent } from '../types/audit';
import { Project } from '../types/project';
import { MasterDocument } from '../types/document';
import { AppNotification } from '../types/notification';
import { UserProfile, RoleName } from '../types/user';
import { VesselInformation } from '../types/vessel';
import {
  DashboardConfig,
  DashboardActionItem,
  DashboardKpiTile,
  DashboardReadinessBar,
} from '../types/dashboard';
import {
  canSessionUserAccessCapa,
  filterAssuranceSetsForSession,
  isAssuranceSetAssignedToPersona,
  isVesselOwnedByClientOrg,
} from './rbacHelpers';
import { filterProjectsForPersona } from './projectHelpers';
import { calculateVesselReadiness } from './readinessHelpers';
import { isExpiringWithinWarning } from './expiryPolicy';
import {
  isSetNeedingPeople,
  isSetOverdue,
  isSetDueThisWeek,
  isSetEscalated,
  navigateToFilteredList,
  setAssuranceDetailPreselect,
} from './dashboardTileNavigation';
import { getRoleRecentActivity } from './recentActivityFeed';
import { isInspectionDue } from './inspectionTask';
import {
  averageDaysToClearance,
  countReusedDocuments,
  countReVerifications,
} from './valueMetrics';

function resolveCapaSetId(capa: CapaItem, candidateSets: AssuranceSet[]): string | undefined {
  if (capa.assuranceSetId && candidateSets.some((s) => s.id === capa.assuranceSetId)) {
    return capa.assuranceSetId;
  }
  const byVesselId = capa.vesselId
    ? candidateSets.find((s) => s.vesselId === capa.vesselId)
    : undefined;
  if (byVesselId) return byVesselId.id;
  const byVesselName = capa.vesselName
    ? candidateSets.find(
        (s) => s.vesselName && s.vesselName.toLowerCase() === capa.vesselName.toLowerCase(),
      )
    : undefined;
  return byVesselName?.id;
}

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
  if (
    set.mandatoryInspectionRequired !== false &&
    (!set.assignedInspector || set.assignedInspector === 'Unassigned' || set.assignedInspector.toLowerCase().includes('pending'))
  ) {
    missing.push('inspector');
  }
  if (
    set.formalApprovalRequired !== false &&
    (!set.assignedApprover || set.assignedApprover === 'Unassigned' || set.assignedApprover.toLowerCase().includes('pending'))
  ) {
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
  users?: UserProfile[];
  notifications?: AppNotification[];
  sessionUser?: Pick<UserProfile, 'id' | 'name' | 'organization' | 'roles'> | { id?: string; name?: string; organization?: string; roles?: RoleName[] } | null;
  activeOrganization?: string;
  setCurrentHashView: (view: string, entityId?: string) => void;
  now?: Date;
}

/**
 * Builds the DashboardConfig for the Administrator as client (C Admin) role.
 */
export function getAdministratorClientDashboardConfig({
  assuranceSets,
  capaItems,
  auditEvents,
  projects = [],
  users = [],
  notifications = [],
  sessionUser,
  activeOrganization,
  setCurrentHashView,
  now = new Date(),
}: AdministratorClientConfigParams): DashboardConfig {
  const scopedOrg = activeOrganization?.trim() || sessionUser?.organization?.trim() || '';
  const userForRbac: Pick<UserProfile, 'id' | 'name' | 'organization' | 'roles'> | null = sessionUser
    ? {
        id: sessionUser.id || '',
        name: sessionUser.name || '',
        organization: sessionUser.organization || '',
        roles: sessionUser.roles || ['C Admin'],
      }
    : null;

  const orgSets = userForRbac
    ? filterAssuranceSetsForSession(assuranceSets, 'C Admin', scopedOrg || undefined, userForRbac, users.length > 0 ? users : undefined)
    : [];

  const orgSetIds = new Set(orgSets.map((s) => s.id));
  const orgVesselIds = new Set(orgSets.map((s) => s.vesselId).filter(Boolean));
  const orgVesselNames = new Set(
    orgSets.map((s) => s.vesselName?.toLowerCase()).filter(Boolean) as string[],
  );

  const orgCapas = !userForRbac
    ? []
    : capaItems.filter((c) => {
        if (
          !canSessionUserAccessCapa(
            c,
            assuranceSets,
            'C Admin',
            scopedOrg || undefined,
            userForRbac,
          )
        ) {
          return false;
        }
        if (c.assuranceSetId) return orgSetIds.has(c.assuranceSetId);
        return Boolean(
          (c.vesselId && orgVesselIds.has(c.vesselId)) ||
            (c.vesselName && orgVesselNames.has(c.vesselName.toLowerCase())),
        );
      });

  const orgProjects =
    users.length > 0 && userForRbac
      ? filterProjectsForPersona(
          projects,
          'C Admin',
          users,
          assuranceSets,
          scopedOrg || undefined,
          userForRbac,
          notifications,
        )
      : [];

  const needingPeopleSets = orgSets
    .filter(isSetNeedingPeople)
    .sort((a, b) => {
      const dateA = Date.parse(getSetStartDate(a) || '9999-12-31');
      const dateB = Date.parse(getSetStartDate(b) || '9999-12-31');
      return dateA - dateB;
    });

  const openFindingsCount = orgCapas.filter((c) => c.status !== 'Verified & Closed').length;

  const activeSets = orgSets.filter((s) => s.stage !== 'Cancelled');
  const onTimeCount = activeSets.filter((s) => !isSetOverdue(s, now)).length;
  const onTimeCompletionPct =
    activeSets.length > 0 ? Math.round((onTimeCount / activeSets.length) * 100) : 100;

  const extraAttemptsCount = orgSets.reduce(
    (sum, s) =>
      sum +
      (s.requirements || []).reduce(
        (rSum, r) =>
          rSum +
          Math.max(
            0,
            (r.attemptNumber ?? (r.verifierStatus === 'Correction Requested' ? 2 : 1)) - 1,
          ),
        0,
      ),
    0,
  );
  const reVerificationsCount = countReVerifications(orgSets);
  const reusedDocsCount = countReusedDocuments(orgSets);
  const resubmissionsCount =
    extraAttemptsCount > 0
      ? extraAttemptsCount
      : reVerificationsCount > 0
        ? reVerificationsCount
        : reusedDocsCount;

  const avgCycleDays = averageDaysToClearance(orgSets);
  const cycleTimeDisplay = avgCycleDays !== undefined ? `${avgCycleDays}d` : '—';

  const tiles: DashboardKpiTile[] = [
    {
      id: 'perf_on_time',
      label: 'On-time completion',
      value: `${onTimeCompletionPct}%`,
      tone: 'neutral',
      onClick: () => navigateToFilteredList('assurance-sets', 'filter', 'ALL', setCurrentHashView),
    },
    {
      id: 'perf_resubmissions',
      label: 'Resubmissions',
      value: resubmissionsCount,
      tone: 'neutral',
      onClick: () => navigateToFilteredList('assurance-sets', 'filter', 'returned', setCurrentHashView),
    },
    {
      id: 'perf_cycle_time',
      label: 'Average review cycle time',
      value: cycleTimeDisplay,
      tone: 'neutral',
      onClick: () => navigateToFilteredList('assurance-sets', 'filter', 'approved', setCurrentHashView),
    },
    {
      id: 'perf_findings',
      label: 'Findings',
      value: openFindingsCount,
      tone: 'neutral',
      onClick: () => navigateToFilteredList('capa', 'filter', 'open', setCurrentHashView),
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
        setAssuranceDetailPreselect({
          setId: set.id,
          tab: 'details',
          section: 'stakeholders',
        });
        setCurrentHashView('assurance-sets', set.id);
      },
    };
  });

  const activityItems = getRoleRecentActivity('Administrator as client', auditEvents, 5, now);
  const displayOrg = scopedOrg || 'Northwind Shipping';
  const projectsCount = orgProjects.length;

  return {
    roleTitle: 'Administrator as client',
    subtitle: `${displayOrg} · ${projectsCount} projects`,
    tiles,
    actionItems,
    activityItems,
    seeAllText: needingPeopleSets.length > 0 ? `See all ${needingPeopleSets.length}` : undefined,
    onSeeAll: () => navigateToFilteredList('assurance-sets', 'filter', 'needing_people', setCurrentHashView),
    emptyActionMessage: 'Nothing needs you today',
  };
}

export interface AdministratorConfigParams {
  vessels: VesselInformation[];
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
 * Builds the DashboardConfig for the Administrator (Vessel Admin / Provider Admin) role.
 */
export function getAdministratorDashboardConfig({
  vessels,
  assuranceSets,
  documents,
  capaItems,
  auditEvents,
  sessionUser,
  activeOrganization,
  setCurrentHashView,
  now = new Date(),
}: AdministratorConfigParams): DashboardConfig {
  const scopedOrg = activeOrganization?.trim() || sessionUser?.organization?.trim() || '';
  const userForRbac: Pick<UserProfile, 'id' | 'name' | 'organization' | 'roles'> | null = sessionUser
    ? {
        id: sessionUser.id || '',
        name: sessionUser.name || '',
        organization: sessionUser.organization || '',
        roles: sessionUser.roles || ['Administrator'],
      }
    : null;

  const orgSets = userForRbac
    ? filterAssuranceSetsForSession(assuranceSets, 'Administrator', scopedOrg || undefined, userForRbac)
    : [];

  const orgVessels =
    userForRbac && scopedOrg
      ? vessels.filter((v) => isVesselOwnedByClientOrg(v, scopedOrg))
      : [];

  const orgSetIds = new Set(orgSets.map((s) => s.id));
  const orgVesselIds = new Set([
    ...orgVessels.map((v) => v.id),
    ...orgSets.map((s) => s.vesselId).filter(Boolean),
  ]);
  const orgVesselNames = new Set(
    [
      ...orgVessels.map((v) => v.name?.toLowerCase()),
      ...orgSets.map((s) => s.vesselName?.toLowerCase()),
    ].filter(Boolean) as string[],
  );
  const orgVesselImos = new Set(orgVessels.map((v) => v.imoNumber).filter(Boolean));

  const docIdToSetId = new Map<string, string>();
  const orgSetDocIds = new Set<string>();
  const otherSetDocIds = new Set<string>();
  for (const set of orgSets) {
    for (const r of set.requirements || []) {
      if (r.documentId) {
        orgSetDocIds.add(r.documentId);
        docIdToSetId.set(r.documentId, set.id);
      }
      if (r.linkedDocumentId) {
        orgSetDocIds.add(r.linkedDocumentId);
        docIdToSetId.set(r.linkedDocumentId, set.id);
      }
    }
  }
  for (const set of assuranceSets) {
    if (orgSetIds.has(set.id)) continue;
    for (const r of set.requirements || []) {
      if (r.documentId) otherSetDocIds.add(r.documentId);
      if (r.linkedDocumentId) otherSetDocIds.add(r.linkedDocumentId);
    }
  }

  const orgDocs = !userForRbac
    ? []
    : documents.filter((doc) => {
        const docExt = doc as MasterDocument & { organization?: string; vesselName?: string; assuranceSetId?: string };
        const docVesselName =
          doc.vesselAttributes?.vesselName ||
          doc.crewAttributes?.assignedVessel ||
          docExt.vesselName;
        const docImo = doc.vesselAttributes?.imoNumber;
        if (orgSetDocIds.has(doc.id)) return true;
        if (docExt.assuranceSetId) return orgSetIds.has(docExt.assuranceSetId);
        if (otherSetDocIds.has(doc.id)) return false;
        return Boolean(
          (doc.vesselId && orgVesselIds.has(doc.vesselId)) ||
            (docVesselName && orgVesselNames.has(docVesselName.toLowerCase())) ||
            (docImo && orgVesselImos.has(docImo)),
        );
      });

  const orgCapas = !userForRbac
    ? []
    : capaItems.filter((c) => {
        if (
          !canSessionUserAccessCapa(
            c,
            assuranceSets,
            'Administrator',
            scopedOrg || undefined,
            userForRbac,
          )
        ) {
          return false;
        }
        if (c.assuranceSetId) return orgSetIds.has(c.assuranceSetId);
        return Boolean(
          (c.vesselId && orgVesselIds.has(c.vesselId)) ||
            (c.vesselName && orgVesselNames.has(c.vesselName.toLowerCase())),
        );
      });

  const avgReadiness =
    orgVessels.length > 0
      ? Math.round(
          orgVessels.reduce((sum, v) => sum + calculateVesselReadiness(v, orgSets, orgDocs), 0) /
            orgVessels.length,
        )
      : 0;

  const activeSetsCount = orgSets.filter(
    (s) => s.stage !== 'Certified' && s.stage !== 'Approved' && s.stage !== 'Cancelled',
  ).length;

  const expiringDocs = orgDocs
    .filter((d) => isExpiringWithinWarning(d.expiryDate, now))
    .sort((a, b) => Date.parse(a.expiryDate || '9999-12-31') - Date.parse(b.expiryDate || '9999-12-31'));

  const tiles: DashboardKpiTile[] = [
    {
      id: 'vessels',
      label: 'Vessels',
      value: orgVessels.length,
      tone: 'neutral',
      onClick: () => setCurrentHashView('vessels'),
    },
    {
      id: 'average_readiness',
      label: 'Average readiness',
      value: `${avgReadiness}%`,
      tone: 'neutral',
      onClick: () => setCurrentHashView('vessels'),
    },
    {
      id: 'assurance_sets',
      label: 'Assurance sets',
      value: activeSetsCount,
      tone: 'neutral',
      onClick: () => navigateToFilteredList('assurance-sets', 'filter', 'in_progress', setCurrentHashView),
    },
    {
      id: 'expiring_soon',
      label: 'Expiring soon',
      value: expiringDocs.length,
      tone: 'neutral',
      onClick: () => navigateToFilteredList('documents', 'filter', 'Expiring < 6 Mos', setCurrentHashView),
    },
  ];

  // 1. Org assurance sets missing a Submitter
  const needingSubmitterSets = orgSets
    .filter(
      (s) =>
        s.stage !== 'Certified' &&
        s.stage !== 'Approved' &&
        s.stage !== 'Cancelled' &&
        (!s.assignedSubmitter ||
          s.assignedSubmitter === 'Unassigned' ||
          s.assignedSubmitter.toLowerCase().includes('pending')),
    )
    .sort((a, b) => {
      const dateA = Date.parse(getSetStartDate(a) || '9999-12-31');
      const dateB = Date.parse(getSetStartDate(b) || '9999-12-31');
      return dateA - dateB;
    });

  const needingSubmitterItems: DashboardActionItem[] = needingSubmitterSets.map((set) => {
    const startSnippet = formatStartDateSnippet(getSetStartDate(set));
    const vessel = set.vesselName?.trim();
    const title = set.title?.trim() || set.id;
    const itemTitle = vessel && !title.includes(vessel) ? `${vessel} · ${title}` : title;

    return {
      id: `assign-submitter-${set.id}`,
      tag: 'Missing role',
      tagTone: 'warn',
      title: itemTitle,
      subtitle: ['No submitter', startSnippet].filter(Boolean).join(' · '),
      buttonLabel: 'Assign',
      onAction: () => {
        setAssuranceDetailPreselect({
          setId: set.id,
          tab: 'details',
          section: 'stakeholders',
        });
        setCurrentHashView('assurance-sets', set.id);
      },
    };
  });

  // 2. Returned requirements/documents across org sets and docs
  const returnedItems: DashboardActionItem[] = [];
  const returnedDocIds = new Set<string>();
  for (const set of orgSets) {
    if (set.stage === 'Cancelled') continue;
    for (const req of set.requirements || []) {
      if (req.verifierStatus === 'Correction Requested' || req.verifierStatus === 'Rejected') {
        if (req.documentId) returnedDocIds.add(req.documentId);
        if (req.linkedDocumentId) returnedDocIds.add(req.linkedDocumentId);
        const vessel = set.vesselName || set.title;
        returnedItems.push({
          id: `returned-req-${set.id}-${req.id}`,
          tag: 'Returned',
          tagTone: 'bad',
          title: `${req.title} · ${vessel}`,
          subtitle: req.notes || req.verificationResultSummary || 'Correction requested by verifier',
          buttonLabel: 'Re-upload',
          onAction: () => {
            setAssuranceDetailPreselect({
              setId: set.id,
              tab: 'tasks',
              reqId: req.id,
            });
            setCurrentHashView('assurance-sets', set.id);
          },
        });
      }
    }
  }

  for (const doc of orgDocs) {
    if (
      (doc.verificationStatus === 'Correction Requested' || doc.verificationStatus === 'Rejected') &&
      !returnedDocIds.has(doc.id)
    ) {
      returnedDocIds.add(doc.id);
      const docExt = doc as MasterDocument & { vesselName?: string; assuranceSetId?: string; organization?: string; rejectionReason?: string };
      const linkedSetId = docIdToSetId.get(doc.id) || docExt.assuranceSetId;
      const entity =
        doc.vesselAttributes?.vesselName ||
        doc.crewAttributes?.assignedVessel ||
        docExt.vesselName ||
        docExt.organization ||
        'Vessel';
      returnedItems.push({
        id: `returned-doc-${doc.id}`,
        tag: 'Returned',
        tagTone: 'bad',
        title: `${doc.title} · ${entity}`,
        subtitle: doc.verificationNotes || docExt.rejectionReason || 'Correction requested by verifier',
        buttonLabel: 'Re-upload',
        onAction: () => {
          if (linkedSetId) {
            const linkedSet = orgSets.find((s) => s.id === linkedSetId);
            const linkedReq = linkedSet?.requirements?.find(
              (r) => r.documentId === doc.id || r.linkedDocumentId === doc.id,
            );
            setAssuranceDetailPreselect({
              setId: linkedSetId,
              tab: 'tasks',
              reqId: linkedReq?.id,
            });
            setCurrentHashView('assurance-sets', linkedSetId);
          } else {
            setCurrentHashView('documents', doc.id);
          }
        },
      });
    }
  }

  // 3. Expiring documents within warning period (deduped against returned items)
  const expiringItems: DashboardActionItem[] = expiringDocs
    .filter((doc) => !returnedDocIds.has(doc.id))
    .map((doc) => {
      const docExt = doc as MasterDocument & { vesselName?: string; organization?: string };
      const entity =
        doc.vesselAttributes?.vesselName ||
        doc.crewAttributes?.assignedVessel ||
        docExt.vesselName ||
        docExt.organization ||
        scopedOrg ||
        'Vessel';
      return {
        id: `expiring-${doc.id}`,
        tag: 'Expiring',
        tagTone: 'warn',
        title: `${doc.title} · ${entity}`,
        subtitle: `Expires ${formatShortDate(doc.expiryDate)}`,
        buttonLabel: 'Renew',
        onAction: () => setCurrentHashView('documents', doc.id),
      };
    });

  // 4. Open CAPA findings on org vessels/sets
  const capaActionItems: DashboardActionItem[] = orgCapas
    .filter((c) => c.status !== 'Verified & Closed')
    .map((capa) => ({
      id: `capa-${capa.id}`,
      tag: 'CAPA',
      tagTone: capa.status === 'Rectification Required' ? 'bad' : 'warn',
      title: `${capa.title} · ${capa.vesselName || 'Fleet vessel'}`,
      subtitle: capa.dueDate ? `Due ${formatShortDate(capa.dueDate)}` : capa.status,
      buttonLabel: 'Respond',
      onAction: () => {
        setCurrentHashView('capa', capa.id);
      },
    }));

  const allActions = [
    ...needingSubmitterItems,
    ...returnedItems,
    ...expiringItems,
    ...capaActionItems,
  ];
  const actionItems = allActions.slice(0, 5);

  const onSeeAll = () => {
    if (needingSubmitterItems.length > 0 || returnedItems.length > 0) {
      navigateToFilteredList('assurance-sets', 'filter', 'in_progress', setCurrentHashView);
    } else if (expiringItems.length > 0) {
      navigateToFilteredList('documents', 'filter', 'Expiring < 6 Mos', setCurrentHashView);
    } else {
      navigateToFilteredList('capa', 'filter', 'open', setCurrentHashView);
    }
  };

  const activityItems = getRoleRecentActivity('Administrator', auditEvents, 5, now);
  const displayOrg = scopedOrg || 'Northwind Marine Pty Ltd';

  return {
    roleTitle: 'Administrator',
    subtitle: `${displayOrg} · ${orgVessels.length} vessels`,
    tiles,
    actionItems,
    activityItems,
    seeAllText: allActions.length > 0 ? `See all ${allActions.length}` : undefined,
    onSeeAll,
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

  const assignedSets = userForRbac
    ? assuranceSets.filter((set) =>
        isAssuranceSetAssignedToPersona(set, 'Submitter', activeOrganization, userForRbac),
      )
    : [];

  const assignedSetIds = new Set(assignedSets.map((s) => s.id));
  const assignedVesselIds = new Set(assignedSets.map((s) => s.vesselId).filter(Boolean));

  const docIdToSetId = new Map<string, string>();
  const otherSetDocIds = new Set<string>();
  for (const set of assignedSets) {
    for (const r of set.requirements || []) {
      if (r.documentId) docIdToSetId.set(r.documentId, set.id);
      if (r.linkedDocumentId) docIdToSetId.set(r.linkedDocumentId, set.id);
    }
  }
  for (const set of assuranceSets) {
    if (assignedSetIds.has(set.id)) continue;
    for (const r of set.requirements || []) {
      if (r.documentId) otherSetDocIds.add(r.documentId);
      if (r.linkedDocumentId) otherSetDocIds.add(r.linkedDocumentId);
    }
  }

  // 1. Returned documents
  const returnedItems: DashboardActionItem[] = [];
  for (const set of assignedSets) {
    if (set.stage === 'Cancelled') continue;
    for (const req of set.requirements || []) {
      if (req.verifierStatus === 'Correction Requested' || req.verifierStatus === 'Rejected') {
        const vessel = set.vesselName || set.title;
        returnedItems.push({
          id: `returned-${req.id}`,
          tag: 'Returned',
          tagTone: 'bad',
          title: `${req.title} · ${vessel}`,
          subtitle: req.notes || req.verificationResultSummary || 'Expired date on scan',
          buttonLabel: 'Re-upload',
          onAction: () => {
            setAssuranceDetailPreselect({
              setId: set.id,
              tab: 'tasks',
              reqId: req.id,
            });
            setCurrentHashView('assurance-sets', set.id);
          },
        });
      }
    }
  }

  // Also check documents directly linked to assigned sets
  for (const doc of documents) {
    if (doc.verificationStatus === 'Correction Requested' || doc.verificationStatus === 'Rejected') {
      const docExt = doc as MasterDocument & {
        assuranceSetId?: string;
        vesselName?: string;
        organization?: string;
        name?: string;
        rejectionReason?: string;
      };
      const resolvedSetId =
        docIdToSetId.get(doc.id) ||
        (docExt.assuranceSetId && assignedSetIds.has(docExt.assuranceSetId) ? docExt.assuranceSetId : undefined);
      const isAssigned = docIdToSetId.has(doc.id)
        ? true
        : docExt.assuranceSetId
          ? assignedSetIds.has(docExt.assuranceSetId)
          : !otherSetDocIds.has(doc.id) && Boolean(doc.vesselId && assignedVesselIds.has(doc.vesselId));
      if (isAssigned && !returnedItems.some((item) => item.id.includes(doc.id))) {
        const entity = doc.vesselAttributes?.vesselName || docExt.vesselName || docExt.organization || 'Vessel';
        const docTitle = doc.title || docExt.name || 'Document';
        returnedItems.push({
          id: `returned-doc-${doc.id}`,
          tag: 'Returned',
          tagTone: 'bad',
          title: `${docTitle} · ${entity}`,
          subtitle: doc.verificationNotes || docExt.rejectionReason || 'Correction requested by verifier',
          buttonLabel: 'Re-upload',
          onAction: () => {
            if (resolvedSetId) {
              const resolvedSet = assignedSets.find((s) => s.id === resolvedSetId);
              const linkedReq = resolvedSet?.requirements?.find(
                (r) => r.documentId === doc.id || r.linkedDocumentId === doc.id,
              );
              setAssuranceDetailPreselect({
                setId: resolvedSetId,
                tab: 'tasks',
                reqId: linkedReq?.id,
              });
              setCurrentHashView('assurance-sets', resolvedSetId);
            } else {
              setCurrentHashView('documents', doc.id);
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
    if (
      userForRbac &&
      !canSessionUserAccessCapa(c, assuranceSets, 'Submitter', activeOrganization, userForRbac)
    ) {
      return false;
    }
    if (c.assuranceSetId) return assignedSetIds.has(c.assuranceSetId);
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
        const targetSetId = resolveCapaSetId(capa, assignedSets);
        if (targetSetId) {
          setAssuranceDetailPreselect({
            setId: targetSetId,
            tab: 'tasks',
            capaId: capa.id,
          });
          setCurrentHashView('assurance-sets', targetSetId);
        } else {
          navigateToFilteredList('assurance-sets', 'filter', 'with_open_findings', setCurrentHashView);
        }
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
    const unfulfilled = (set.requirements || []).filter(
      (r) =>
        !r.isFulfilled &&
        !r.documentId &&
        !r.linkedDocumentId &&
        r.verifierStatus !== 'Correction Requested' &&
        r.verifierStatus !== 'Rejected',
    );
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
          setAssuranceDetailPreselect({
            setId: set.id,
            tab: 'tasks',
            reqId: unfulfilled[0]?.id,
          });
          setCurrentHashView('assurance-sets', set.id);
        },
      });
    }
  }

  // 4. Certificates expiring in 30 days
  const expiringItems: DashboardActionItem[] = [];
  for (const doc of documents) {
    if (isDocumentExpiringIn30Days(doc, now)) {
      const docExt = doc as MasterDocument & {
        assuranceSetId?: string;
        vesselName?: string;
        organization?: string;
        name?: string;
      };
      const isAssigned = docIdToSetId.has(doc.id)
        ? true
        : docExt.assuranceSetId
          ? assignedSetIds.has(docExt.assuranceSetId)
          : !otherSetDocIds.has(doc.id) && Boolean(doc.vesselId && assignedVesselIds.has(doc.vesselId));
      if (isAssigned) {
        const entity = doc.vesselAttributes?.vesselName || docExt.vesselName || docExt.organization || 'Vessel';
        const docTitle = doc.title || docExt.name || 'Document';
        expiringItems.push({
          id: `expiring-${doc.id}`,
          tag: 'Expiring',
          tagTone: 'warn',
          title: `${docTitle} · ${entity}`,
          subtitle: `Expires ${formatShortDate(doc.expiryDate)}`,
          buttonLabel: 'Renew',
          onAction: () => {
            setCurrentHashView('documents', doc.id);
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
      onClick: () => {
        const findingSetIds = Array.from(
          new Set(
            assignedCapas
              .map((c) => resolveCapaSetId(c, assignedSets))
              .filter((id): id is string => Boolean(id)),
          ),
        );
        if (findingSetIds.length === 1) {
          setAssuranceDetailPreselect({ setId: findingSetIds[0], tab: 'tasks' });
          setCurrentHashView('assurance-sets', findingSetIds[0]);
        } else {
          navigateToFilteredList('assurance-sets', 'filter', 'with_open_findings', setCurrentHashView);
        }
      },
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

/**
 * Formats a cardinal number to an ordinal string (1st, 2nd, 3rd, 4th, etc.).
 */
export function formatOrdinal(n: number): string {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}

export interface VerifierConfigParams {
  assuranceSets: AssuranceSet[];
  documents: MasterDocument[];
  auditEvents: AuditTrailEvent[];
  notifications?: AppNotification[];
  sessionUser?: Pick<UserProfile, 'id' | 'name' | 'organization' | 'roles'> | { id?: string; name?: string; organization?: string; roles?: RoleName[] } | null;
  activeOrganization?: string;
  setCurrentHashView: (view: string, entityId?: string) => void;
  now?: Date;
}

/**
 * Builds the DashboardConfig for the Verifier role.
 */
export function getVerifierDashboardConfig({
  assuranceSets,
  documents,
  auditEvents,
  notifications,
  sessionUser,
  activeOrganization = 'Northwind Marine Pty Ltd',
  setCurrentHashView,
  now = new Date(),
}: VerifierConfigParams): DashboardConfig {
  const userForRbac: Pick<UserProfile, 'id' | 'name' | 'organization' | 'roles'> | null = sessionUser
    ? {
        id: sessionUser.id || '',
        name: sessionUser.name || '',
        organization: sessionUser.organization || '',
        roles: sessionUser.roles || ['Verifier'],
      }
    : null;

  // Filter strictly to assurance sets personally assigned to this verifier
  const assignedSets = userForRbac
    ? assuranceSets.filter((set) =>
        isAssuranceSetAssignedToPersona(set, 'Verifier', activeOrganization, userForRbac),
      )
    : [];

  const effectiveSets = assignedSets;

  const effectiveSetIds = new Set(effectiveSets.map((s) => s.id));
  const effectiveVesselIds = new Set(effectiveSets.map((s) => s.vesselId).filter(Boolean));

  const docIdToSet = new Map<string, AssuranceSet>();
  for (const set of effectiveSets) {
    for (const r of set.requirements || []) {
      if (r.documentId) docIdToSet.set(r.documentId, set);
      if (r.linkedDocumentId) docIdToSet.set(r.linkedDocumentId, set);
    }
  }

  interface QueueCandidate {
    id: string;
    docId?: string;
    setId?: string;
    title: string;
    vesselName: string;
    attemptNumber: number;
    isResubmitted: boolean;
    isEscalated: boolean;
    isDueSoon: boolean;
    setDueDate?: string;
    daysWaiting: number;
  }

  const queueCandidates: QueueCandidate[] = [];
  const seenIds = new Set<string>();

  // 1. Gather pending items from documents belonging to assigned sets
  for (const doc of documents) {
    if (doc.verificationStatus === 'Pending') {
      const anyDoc = doc as any;
      const explicitSet = anyDoc.assuranceSetId
        ? effectiveSets.find((s) => s.id === anyDoc.assuranceSetId)
        : undefined;
      const linkedSet =
        docIdToSet.get(doc.id) ||
        explicitSet ||
        (!anyDoc.assuranceSetId && doc.vesselId
          ? effectiveSets.find((s) => s.vesselId === doc.vesselId)
          : undefined);

      const isAssigned = Boolean(linkedSet) ||
        (!anyDoc.assuranceSetId && Boolean(doc.vesselId && effectiveVesselIds.has(doc.vesselId)));

      if (isAssigned) {
        seenIds.add(doc.id);
        const setForDoc = linkedSet || effectiveSets.find((s) => s.id === anyDoc.assuranceSetId);
        const vesselName = doc.vesselAttributes?.vesselName || anyDoc.vesselName || setForDoc?.vesselName || setForDoc?.title || 'Vessel';
        const docTitle = doc.title || anyDoc.name || 'Document';
        const attempt = anyDoc.attemptNumber || doc.versions?.length || 1;
        const isResubmitted = attempt > 1 || Boolean(anyDoc.isResubmitted);
        const isEscalated = Boolean(setForDoc && isSetEscalated(setForDoc, notifications)) || Boolean(anyDoc.isEscalated);
        const isDueSoon = Boolean(setForDoc && (isSetDueThisWeek(setForDoc, now) || isSetOverdue(setForDoc, now))) || Boolean(anyDoc.isDueSoon);
        const setDueDate = setForDoc?.targetDate || setForDoc?.complianceDeadline || setForDoc?.charterWindowStart || anyDoc.setDueDate;

        let daysWaiting = 0;
        if (anyDoc.daysWaiting != null) {
          daysWaiting = anyDoc.daysWaiting;
        } else if (doc.versions && doc.versions.length > 0) {
          const lastVersion = doc.versions[doc.versions.length - 1];
          if (lastVersion.uploadedAt) {
            const time = new Date(lastVersion.uploadedAt).getTime();
            if (!Number.isNaN(time)) {
              daysWaiting = Math.max(0, Math.floor((now.getTime() - time) / (1000 * 60 * 60 * 24)));
            }
          }
        } else if (anyDoc.uploadedAt) {
          const time = new Date(anyDoc.uploadedAt).getTime();
          if (!Number.isNaN(time)) {
            daysWaiting = Math.max(0, Math.floor((now.getTime() - time) / (1000 * 60 * 60 * 24)));
          }
        }

        queueCandidates.push({
          id: doc.id,
          docId: doc.id,
          setId: setForDoc?.id,
          title: docTitle,
          vesselName,
          attemptNumber: attempt,
          isResubmitted,
          isEscalated,
          isDueSoon,
          setDueDate,
          daysWaiting,
        });
      }
    }
  }

  // 2. Also check pending requirements directly in effectiveSets
  for (const set of effectiveSets) {
    for (const req of set.requirements || []) {
      if (req.verifierStatus === 'Pending' && !seenIds.has(req.id) && (!req.documentId || !seenIds.has(req.documentId))) {
        const anyReq = req as any;
        const attempt = anyReq.attemptNumber || 1;
        const isResubmitted = attempt > 1 || Boolean(anyReq.isResubmitted);
        const isEscalated = isSetEscalated(set, notifications) || Boolean(anyReq.isEscalated);
        const isDueSoon = isSetDueThisWeek(set, now) || isSetOverdue(set, now) || Boolean(anyReq.isDueSoon);
        const setDueDate = set.targetDate || set.complianceDeadline || set.charterWindowStart;

        let daysWaiting = 0;
        if (anyReq.daysWaiting != null) {
          daysWaiting = anyReq.daysWaiting;
        } else if (anyReq.submittedAt) {
          const time = new Date(anyReq.submittedAt).getTime();
          if (!Number.isNaN(time)) {
            daysWaiting = Math.max(0, Math.floor((now.getTime() - time) / (1000 * 60 * 60 * 24)));
          }
        }

        queueCandidates.push({
          id: req.id,
          docId: req.documentId,
          setId: set.id,
          title: req.title,
          vesselName: set.vesselName || set.title,
          attemptNumber: attempt,
          isResubmitted,
          isEscalated,
          isDueSoon,
          setDueDate,
          daysWaiting,
        });
      }
    }
  }

  // Calculate max waiting days
  const maxWaitingDays = queueCandidates.length > 0
    ? Math.max(...queueCandidates.map((c) => c.daysWaiting), 0)
    : 0;

  // Escalated sets: "Escalated counts only sets with an active escalation notice"
  const escalatedSets = effectiveSets.filter((s) => isSetEscalated(s, notifications));
  const dueThisWeekSets = effectiveSets.filter((s) => isSetDueThisWeek(s, now));
  const resubmittedItems = queueCandidates.filter((c) => c.isResubmitted);

  const inQueueLabel = maxWaitingDays > 0
    ? `In queue · oldest ${maxWaitingDays} day${maxWaitingDays === 1 ? '' : 's'}`
    : 'In queue';

  const tiles: DashboardKpiTile[] = [
    {
      id: 'escalated',
      label: 'Escalated',
      value: escalatedSets.length,
      tone: 'bad',
      linkText: 'View →',
      onClick: () =>
        navigateToFilteredList('verifier', 'map_verifier_tab_preselect', 'overdue', setCurrentHashView),
    },
    {
      id: 'due_this_week',
      label: 'Due this week',
      value: dueThisWeekSets.length,
      tone: 'warn',
      linkText: 'View →',
      onClick: () =>
        navigateToFilteredList('verifier', 'map_verifier_tab_preselect', 'to-verify', setCurrentHashView),
    },
    {
      id: 'resubmitted',
      label: 'Re-submitted',
      value: resubmittedItems.length,
      tone: 'neutral',
      linkText: 'View →',
      onClick: () =>
        navigateToFilteredList('verifier', 'map_verifier_tab_preselect', 'to-verify', setCurrentHashView),
    },
    {
      id: 'in_queue',
      label: inQueueLabel,
      value: queueCandidates.length,
      tone: 'neutral',
      linkText: 'View →',
      onClick: () =>
        navigateToFilteredList('verifier', 'map_verifier_tab_preselect', 'to-verify', setCurrentHashView),
    },
  ];

  // Needs your action: sorted in strict 4-tier urgency:
  // 1. Escalated
  // 2. Near due date (Due soon)
  // 3. Re-submissions
  // 4. Oldest first
  const tier1Escalated = queueCandidates.filter((c) => c.isEscalated);
  const tier2DueSoon = queueCandidates.filter((c) => !c.isEscalated && c.isDueSoon);
  const tier3Resubmitted = queueCandidates.filter((c) => !c.isEscalated && !c.isDueSoon && c.isResubmitted);
  const tier4Oldest = queueCandidates
    .filter((c) => !c.isEscalated && !c.isDueSoon && !c.isResubmitted)
    .sort((a, b) => b.daysWaiting - a.daysWaiting);

  const actionItems: DashboardActionItem[] = [];

  for (const item of tier1Escalated) {
    actionItems.push({
      id: `escalated-${item.id}`,
      tag: 'Escalated',
      tagTone: 'bad',
      title: `${item.title} · ${item.vesselName}`,
      subtitle: 'Set target date at risk',
      buttonLabel: 'Verify',
      onAction: () => {
        setCurrentHashView('verifier', item.docId || item.setId);
      },
    });
  }

  for (const item of tier2DueSoon) {
    const dueSnippet = item.setDueDate ? `Set due ${formatShortDate(item.setDueDate)}` : 'Set due soon';
    actionItems.push({
      id: `due-soon-${item.id}`,
      tag: 'Due soon',
      tagTone: 'warn',
      title: `${item.title} · ${item.vesselName}`,
      subtitle: dueSnippet,
      buttonLabel: 'Verify',
      onAction: () => {
        setCurrentHashView('verifier', item.docId || item.setId);
      },
    });
  }

  for (const item of tier3Resubmitted) {
    const attemptSnippet = item.attemptNumber > 1 ? `${formatOrdinal(item.attemptNumber)} attempt` : '2nd attempt';
    actionItems.push({
      id: `resubmitted-${item.id}`,
      tag: 'Re-submitted',
      tagTone: 'neutral',
      title: `${item.title} · ${item.vesselName}`,
      subtitle: attemptSnippet,
      buttonLabel: 'Verify',
      onAction: () => {
        setCurrentHashView('verifier', item.docId || item.setId);
      },
    });
  }

  for (const item of tier4Oldest) {
    const waitSnippet = item.daysWaiting > 0
      ? `Waiting ${item.daysWaiting} day${item.daysWaiting === 1 ? '' : 's'}`
      : 'Pending review';
    actionItems.push({
      id: `queue-${item.id}`,
      tag: 'In queue',
      tagTone: 'neutral',
      title: `${item.title} · ${item.vesselName}`,
      subtitle: waitSnippet,
      buttonLabel: 'Verify',
      onAction: () => {
        setCurrentHashView('verifier', item.docId || item.setId);
      },
    });
  }

  const displayedActionItems = actionItems.slice(0, 5);
  const totalQueue = queueCandidates.length;

  return {
    roleTitle: 'Verifier',
    subtitle: 'Verification queue',
    tiles,
    actionItems: displayedActionItems,
    activityItems: getRoleRecentActivity('Verifier', auditEvents, 5, now),
    seeAllText: totalQueue > 0 ? `Open queue (${totalQueue})` : undefined,
    onSeeAll: () =>
      navigateToFilteredList('verifier', 'map_verifier_tab_preselect', 'to-verify', setCurrentHashView),
    emptyActionMessage: 'Nothing needs you today',
  };
}

export interface InspectorConfigParams {
  assuranceSets: AssuranceSet[];
  capaItems: CapaItem[];
  auditEvents: AuditTrailEvent[];
  sessionUser?: Pick<UserProfile, 'id' | 'name' | 'organization' | 'roles'> | { id?: string; name?: string; organization?: string; roles?: RoleName[] } | null;
  activeOrganization?: string;
  setCurrentHashView: (view: string, entityId?: string) => void;
  now?: Date;
}

/**
 * Builds the DashboardConfig for the Inspector role.
 */
export function getInspectorDashboardConfig({
  assuranceSets,
  capaItems,
  auditEvents,
  sessionUser,
  activeOrganization = 'Northwind Marine Pty Ltd',
  setCurrentHashView,
  now = new Date(),
}: InspectorConfigParams): DashboardConfig {
  const userForRbac: Pick<UserProfile, 'id' | 'name' | 'organization' | 'roles'> | null = sessionUser
    ? {
        id: sessionUser.id || '',
        name: sessionUser.name || '',
        organization: sessionUser.organization || '',
        roles: sessionUser.roles || ['Inspector'],
      }
    : null;

  // Assigned sets strictly scoped to this inspector
  const assignedSets = userForRbac
    ? assuranceSets.filter((set) =>
        isAssuranceSetAssignedToPersona(set, 'Inspector', activeOrganization, userForRbac),
      )
    : [];

  const effectiveSets = assignedSets;

  const assignedSetIds = new Set(effectiveSets.map((s) => s.id));
  const assignedVesselIds = new Set(effectiveSets.map((s) => s.vesselId).filter(Boolean));

  const relevantCapas = !userForRbac
    ? []
    : capaItems.filter((c) => {
        if (c.status === 'Verified & Closed') return false;
        if (
          !canSessionUserAccessCapa(
            c,
            assuranceSets,
            'Inspector',
            activeOrganization,
            userForRbac,
          )
        ) {
          return false;
        }
        if (c.assuranceSetId) return assignedSetIds.has(c.assuranceSetId);
        if (c.vesselId && assignedVesselIds.has(c.vesselId)) return true;
        return effectiveSets.some((s) => s.vesselName && c.vesselName && s.vesselName.toLowerCase() === c.vesselName.toLowerCase());
      });

  // 1. Reports overdue / reports to finish
  const overdueReports = effectiveSets.filter((s) => isSetOverdue(s, now) || Boolean((s as any).hasInspectionReportToFinish) || Boolean((s as any).isReportOverdue));

  // 2. Re-inspections from CAPA flaggedForReinspection
  const reinspections = relevantCapas.filter(
    (c) => c.status === 'Under Re-Inspection' || Boolean((c as any).flaggedForReinspection),
  );

  // 3. Inspections in next 7 days
  const next7Days = effectiveSets.filter((s) => isSetDueThisWeek(s, now) || Boolean((s as any).isNext7Days));

  // 4. Fixes to check
  const fixesToCheck = relevantCapas.filter(
    (c) =>
      Boolean((c as any).hasFixEvidence) ||
      (Array.isArray(c.evidences) && c.evidences.length > 0 && c.status !== 'Verified & Closed') ||
      (c as any).status === 'Pending Verification',
  );

  const tiles: DashboardKpiTile[] = [
    {
      id: 'reports_overdue',
      label: 'Reports overdue',
      value: overdueReports.length,
      tone: 'bad',
      linkText: 'View →',
      onClick: () =>
        navigateToFilteredList('inspector', 'map_inspector_tab_preselect', 'overdue', setCurrentHashView),
    },
    {
      id: 'reinspections',
      label: 'Re-inspections',
      value: reinspections.length,
      tone: 'warn',
      linkText: 'View →',
      onClick: () =>
        navigateToFilteredList('capa', 'map_capa_subfilter', 'reinspections', setCurrentHashView),
    },
    {
      id: 'next_7_days',
      label: 'Next 7 days',
      value: next7Days.length,
      tone: 'neutral',
      linkText: 'View →',
      onClick: () =>
        navigateToFilteredList('inspector', 'map_inspector_tab_preselect', 'to-inspect', setCurrentHashView),
    },
    {
      id: 'fixes_to_check',
      label: 'Fixes to check',
      value: fixesToCheck.length,
      tone: 'neutral',
      linkText: 'View →',
      onClick: () =>
        navigateToFilteredList('capa', 'map_capa_subfilter', 'fixes_to_check', setCurrentHashView),
    },
  ];

  // Needs your action: sorted in strict 4-tier urgency:
  // 1. Reports to finish (Finish report)
  // 2. Re-inspections from CAPA flaggedForReinspection (Schedule)
  // 3. Inspections in the next 7 days (Prepare)
  // 4. Fixes to check (Review fix)
  const reportItems: DashboardActionItem[] = [];
  const reinspectionItems: DashboardActionItem[] = [];
  const upcomingItems: DashboardActionItem[] = [];
  const fixItems: DashboardActionItem[] = [];

  // Tier 1: Reports to finish
  const candidateReportSets = effectiveSets.filter(
    (s) =>
      Boolean((s as any).hasInspectionReportToFinish) ||
      Boolean((s as any).reportStatus) ||
      (s as any).checklistDone != null ||
      (isInspectionDue(s) && (isSetOverdue(s, now) || !isSetDueThisWeek(s, now))) ||
      Boolean((s as any).isReportOverdue),
  );

  for (const set of candidateReportSets) {
    const vessel = set.vesselName || set.title;
    const anySet = set as any;
    const inspectedDateSnippet = anySet.inspectedDate ? `inspected ${formatShortDate(anySet.inspectedDate)}` : 'inspection report';
    const checklistSnippet = anySet.checklistDone != null && anySet.checklistTotal != null
      ? `Checklist ${anySet.checklistDone} of ${anySet.checklistTotal} done`
      : (anySet.checklistSnippet || 'Checklist pending completion');
    const hasReport = Boolean(
      anySet.hasInspectionReportToFinish ||
      anySet.reportStatus ||
      anySet.checklistDone != null ||
      anySet.isReportOverdue,
    );

    reportItems.push({
      id: `report-${set.id}`,
      tag: 'Report',
      tagTone: 'bad',
      title: `${vessel} · ${inspectedDateSnippet}`,
      subtitle: checklistSnippet,
      buttonLabel: 'Finish report',
      onAction: () => {
        if (isInspectionDue(set) && !hasReport) {
          setAssuranceDetailPreselect({ setId: set.id, tab: 'tasks' });
          setCurrentHashView('assurance-sets', set.id);
        } else {
          setCurrentHashView('inspector', set.id);
        }
      },
    });
  }

  // Tier 2: Re-inspections from CAPA flaggedForReinspection
  for (const capa of reinspections) {
    const anyCapa = capa as any;
    const vessel = capa.vesselName || 'Assigned vessel';
    const flaggedSnippet = anyCapa.flaggedDate
      ? `Flagged by client ${formatShortDate(anyCapa.flaggedDate)}`
      : (anyCapa.flaggedSnippet || (capa.dueDate ? `Response due ${formatShortDate(capa.dueDate)}` : 'Flagged for re-inspection'));

    reinspectionItems.push({
      id: `reinspect-${capa.id}`,
      tag: 'Re-inspect',
      tagTone: 'warn',
      title: `${capa.title} · ${vessel}`,
      subtitle: flaggedSnippet,
      buttonLabel: 'Schedule',
      onAction: () => {
        setCurrentHashView('capa', capa.id);
      },
    });
  }

  // Tier 3: Inspections in next 7 days
  const candidateUpcomingSets = next7Days.filter((s) => !candidateReportSets.some((r) => r.id === s.id));
  for (const set of candidateUpcomingSets) {
    const vessel = set.vesselName || set.title;
    const anySet = set as any;
    const locationSnippet = anySet.port || anySet.location || (set.targetDate ? formatShortDate(set.targetDate) : 'Upcoming inspection');
    const timeSnippet = anySet.scheduledTime || (set.targetDate ? `Due ${formatShortDate(set.targetDate)}` : 'Inspection scheduled');

    upcomingItems.push({
      id: `upcoming-${set.id}`,
      tag: 'Upcoming',
      tagTone: 'neutral',
      title: `${vessel} · ${locationSnippet}`,
      subtitle: timeSnippet,
      buttonLabel: 'Prepare',
      onAction: () => {
        setCurrentHashView('inspector', set.id);
      },
    });
  }

  // Tier 4: Fixes to check
  const candidateFixes = fixesToCheck.filter((c) => !reinspections.some((r) => r.id === c.id));
  for (const capa of candidateFixes) {
    const vessel = capa.vesselName || 'Assigned vessel';
    const anyCapa = capa as any;
    const fixSnippet = anyCapa.fixSnippet || (anyCapa.updatedAt ? `Uploaded ${formatShortDate(anyCapa.updatedAt)}` : 'Fix evidence uploaded');

    fixItems.push({
      id: `fix-${capa.id}`,
      tag: 'Fix',
      tagTone: 'neutral',
      title: `${capa.title} · ${vessel}`,
      subtitle: fixSnippet,
      buttonLabel: 'Review fix',
      onAction: () => {
        setCurrentHashView('capa', capa.id);
      },
    });
  }

  const actionItems: DashboardActionItem[] = [
    ...reportItems,
    ...reinspectionItems,
    ...upcomingItems,
    ...fixItems,
  ].slice(0, 5);

  const totalActions = reportItems.length + reinspectionItems.length + upcomingItems.length + fixItems.length;

  return {
    roleTitle: 'Inspector',
    subtitle: 'Your inspections',
    tiles,
    actionItems,
    activityItems: getRoleRecentActivity('Inspector', auditEvents, 5, now),
    seeAllText: totalActions > 0 ? `See all ${totalActions}` : undefined,
    onSeeAll: () =>
      navigateToFilteredList('inspector', 'map_inspector_tab_preselect', 'all', setCurrentHashView),
    emptyActionMessage: 'Nothing needs you today',
  };
}

export interface ApproverConfigParams {
  assuranceSets: AssuranceSet[];
  capaItems: CapaItem[];
  auditEvents: AuditTrailEvent[];
  sessionUser?: Pick<UserProfile, 'id' | 'name' | 'organization' | 'roles'> | { id?: string; name?: string; organization?: string; roles?: RoleName[] } | null;
  activeOrganization?: string;
  setCurrentHashView: (view: string, entityId?: string) => void;
  now?: Date;
}

/**
 * Builds the DashboardConfig for the Approver role.
 */
export function getApproverDashboardConfig({
  assuranceSets,
  capaItems,
  auditEvents,
  sessionUser,
  activeOrganization = 'Northwind Marine Pty Ltd',
  setCurrentHashView,
  now = new Date(),
}: ApproverConfigParams): DashboardConfig {
  const userForRbac: Pick<UserProfile, 'id' | 'name' | 'organization' | 'roles'> | null = sessionUser
    ? {
        id: sessionUser.id || '',
        name: sessionUser.name || '',
        organization: sessionUser.organization || '',
        roles: sessionUser.roles || ['Approver'],
      }
    : null;

  const assignedSets = userForRbac
    ? assuranceSets.filter((set) =>
        isAssuranceSetAssignedToPersona(set, 'Approver', activeOrganization, userForRbac),
      )
    : [];

  const effectiveSets = assignedSets;

  interface ApproverCandidate {
    set: AssuranceSet;
    waitDays: number;
    hasOpenFindings: boolean;
    openFindingsCount: number;
    isReady: boolean;
    readinessBar: DashboardReadinessBar;
    buttonLabel: 'Decide' | 'Review';
    subtitle: string;
  }

  const candidates: ApproverCandidate[] = [];

  for (const set of effectiveSets) {
    if (set.stage === 'Approved' || set.stage === 'Certified' || set.stage === 'Cancelled') {
      continue;
    }

    const anySet = set as any;

    // 1. Wait days
    let waitDays = 0;
    if (anySet.waitingDays != null) {
      waitDays = anySet.waitingDays;
    } else if (anySet.waitingSince) {
      const time = new Date(anySet.waitingSince).getTime();
      if (!Number.isNaN(time)) {
        waitDays = Math.max(0, Math.floor((now.getTime() - time) / (1000 * 60 * 60 * 24)));
      }
    } else if (anySet.reachedApprovalDate) {
      const time = new Date(anySet.reachedApprovalDate).getTime();
      if (!Number.isNaN(time)) {
        waitDays = Math.max(0, Math.floor((now.getTime() - time) / (1000 * 60 * 60 * 24)));
      }
    }

    // 2. Open findings
    const openCapas = capaItems.filter(
      (c) =>
        c.status !== 'Verified & Closed' &&
        (c.assuranceSetId
          ? c.assuranceSetId === set.id
          : Boolean(c.vesselId && c.vesselId === set.vesselId)),
    );
    const openFindingsCount = anySet.openFindingsCount != null ? anySet.openFindingsCount : openCapas.length;
    const hasOpenFindings = openFindingsCount > 0 || Boolean(anySet.hasOpenFindings);

    // 3. Readiness bar
    let readinessBar: DashboardReadinessBar = {
      submission: true,
      verification: true,
      inspection: true,
    };

    if (anySet.readinessBar) {
      readinessBar = {
        submission: anySet.readinessBar.submission !== false,
        verification: anySet.readinessBar.verification !== false,
        inspection: anySet.readinessBar.inspection !== false,
      };
    } else if (anySet.readiness) {
      readinessBar = {
        submission: anySet.readiness.submission !== false,
        verification: anySet.readiness.verification !== false,
        inspection: anySet.readiness.inspection !== false,
      };
    } else {
      const sub = (set.requirements || []).length === 0 || (set.requirements || []).every((r) => r.isFulfilled || Boolean(r.documentId));
      const ver = (set.requirements || []).length === 0 || (set.requirements || []).every((r) => r.verifierStatus === 'Verified');
      const insp = !anySet.inspectionPending && set.stage !== 'Inspection';
      readinessBar = { submission: sub, verification: ver, inspection: insp };
    }

    // 4. Ready to decide vs review
    const isReady = !hasOpenFindings && (anySet.isReadyToDecide || (set.stage === 'Approval' && readinessBar.submission && readinessBar.verification && readinessBar.inspection !== false));
    const buttonLabel: 'Decide' | 'Review' = isReady && !hasOpenFindings ? 'Decide' : 'Review';

    // 5. Subtitle
    let statusSnippet = 'decision pending';
    if (hasOpenFindings) {
      statusSnippet = `${openFindingsCount} open finding${openFindingsCount === 1 ? '' : 's'}`;
    } else if (readinessBar.inspection === false || anySet.inspectionPending) {
      statusSnippet = 'inspection pending';
    } else if (isReady) {
      statusSnippet = 'all verified';
    }

    const subtitle = `Waiting ${waitDays} day${waitDays === 1 ? '' : 's'} · ${statusSnippet}`;

    candidates.push({
      set,
      waitDays,
      hasOpenFindings,
      openFindingsCount,
      isReady,
      readinessBar,
      buttonLabel,
      subtitle,
    });
  }

  // Sort: longest wait first (descending waitDays)
  candidates.sort((a, b) => b.waitDays - a.waitDays);

  // Tiles:
  // 1. Ready to decide (ok)
  // 2. With open findings (warn)
  // 3. Waiting over 5 days (bad)
  // 4. Approved this month (neutral)
  const readyToDecideCount = candidates.filter((c) => c.isReady && !c.hasOpenFindings).length;
  const withFindingsCount = candidates.filter((c) => c.hasOpenFindings).length;
  const waitingOver5Count = candidates.filter((c) => c.waitDays >= 5).length;
  const approvedThisMonthCount = effectiveSets.filter((s) => s.stage === 'Approved').length;

  const tiles: DashboardKpiTile[] = [
    {
      id: 'ready_to_decide',
      label: 'Ready to decide',
      value: readyToDecideCount,
      tone: 'ok',
      linkText: 'View →',
      onClick: () =>
        navigateToFilteredList('approver', 'map_approver_tab_preselect', 'needs-decision', setCurrentHashView),
    },
    {
      id: 'with_open_findings',
      label: 'With open findings',
      value: withFindingsCount,
      tone: 'warn',
      linkText: 'View →',
      onClick: () =>
        navigateToFilteredList('approver', 'map_approver_tab_preselect', 'all', setCurrentHashView),
    },
    {
      id: 'waiting_over_5',
      label: 'Waiting over 5 days',
      value: waitingOver5Count,
      tone: 'bad',
      linkText: 'View →',
      onClick: () =>
        navigateToFilteredList('approver', 'map_approver_tab_preselect', 'overdue', setCurrentHashView),
    },
    {
      id: 'approved_this_month',
      label: 'Approved this month',
      value: approvedThisMonthCount,
      tone: 'neutral',
      linkText: 'View →',
      onClick: () =>
        navigateToFilteredList('approver', 'map_approver_tab_preselect', 'approved', setCurrentHashView),
    },
  ];

  const actionItems: DashboardActionItem[] = candidates.slice(0, 5).map((c) => {
    const vessel = c.set.vesselName;
    const title = c.set.title;
    const displayTitle = vessel && title && vessel !== title ? `${vessel} · ${title}` : (vessel || title || 'Assurance Set');

    return {
      id: `approver-action-${c.set.id}`,
      title: displayTitle,
      subtitle: c.subtitle,
      readinessBar: c.readinessBar,
      buttonLabel: c.buttonLabel,
      onAction: () => {
        setAssuranceDetailPreselect({
          setId: c.set.id,
          tab: 'details',
        });
        setCurrentHashView('assurance-sets', c.set.id);
      },
    };
  });

  const totalActions = candidates.length;

  return {
    roleTitle: 'Approver',
    subtitle: 'Decisions waiting',
    tiles,
    actionItems,
    activityItems: getRoleRecentActivity('Approver', auditEvents, 5, now),
    seeAllText: totalActions > 0 ? `See all ${totalActions}` : undefined,
    onSeeAll: () =>
      navigateToFilteredList('approver', 'map_approver_tab_preselect', 'all', setCurrentHashView),
    emptyActionMessage: 'Nothing needs you today',
  };
}
