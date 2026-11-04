/*
  file summary: Role-specific dashboard configuration builders for MAPv2 shared dashboard frame.
  responsibilities: constructs DashboardConfig objects for all 5 roles (Administrator as client, Submitter, Verifier, Inspector, Approver) mapping store state into KPI tiles, prioritized action rows, and recent activity items.
  role in system: consumed by DashboardView, ApproverDashboardView, VerifierWorkspaceView, and InspectorWorkspaceView.
*/

import { AssuranceSet } from '../types/assurance';
import { CapaItem } from '../types/capa';
import { AuditTrailEvent } from '../types/audit';
import { Project } from '../types/project';
import { DashboardConfig, DashboardActionItem, DashboardKpiTile } from '../types/dashboard';
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
