import { DashboardKpiTile } from '../types/dashboard';
import { AssuranceSet } from '../types/assurance';
import { CapaItem } from '../types/capa';
import { MasterDocument } from '../types/document';

export type DashboardRole = 'Administrator as client' | 'Submitter' | 'Verifier' | 'Inspector' | 'Approver';

export interface AssuranceDetailPreselect {
  setId?: string;
  tab?: 'details' | 'tasks' | 'requirements' | 'documents' | 'checklist' | 'audit';
  reqId?: string;
  capaId?: string;
  section?: string;
}

export const setAssuranceDetailPreselect = (preselect: AssuranceDetailPreselect): void => {
  if (typeof sessionStorage === 'undefined') return;
  if (preselect.setId) {
    sessionStorage.setItem('map_assurance_preselect_set_id', preselect.setId);
  } else {
    sessionStorage.removeItem('map_assurance_preselect_set_id');
  }
  if (preselect.tab) {
    sessionStorage.setItem('map_assurance_detail_tab_preselect', preselect.tab);
  }
  if (preselect.reqId) {
    sessionStorage.setItem('map_assurance_focus_req_id', preselect.reqId);
  }
  if (preselect.capaId) {
    sessionStorage.setItem('map_assurance_focus_capa_id', preselect.capaId);
  }
  if (preselect.section) {
    sessionStorage.setItem('map_assurance_focus_section', preselect.section);
  }
};

export const peekAssuranceDetailPreselect = (currentSetId?: string): AssuranceDetailPreselect => {
  if (typeof sessionStorage === 'undefined') return {};
  const targetSetId = sessionStorage.getItem('map_assurance_preselect_set_id');
  if (targetSetId && currentSetId && targetSetId !== currentSetId) {
    return {};
  }
  const tab = sessionStorage.getItem('map_assurance_detail_tab_preselect') as AssuranceDetailPreselect['tab'] | null;
  const reqId = sessionStorage.getItem('map_assurance_focus_req_id');
  const capaId = sessionStorage.getItem('map_assurance_focus_capa_id');
  const section = sessionStorage.getItem('map_assurance_focus_section');
  return {
    setId: targetSetId || undefined,
    tab: tab || undefined,
    reqId: reqId || undefined,
    capaId: capaId || undefined,
    section: section || undefined,
  };
};

export const clearAssuranceDetailPreselect = (): void => {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem('map_assurance_preselect_set_id');
  sessionStorage.removeItem('map_assurance_detail_tab_preselect');
  sessionStorage.removeItem('map_assurance_focus_req_id');
  sessionStorage.removeItem('map_assurance_focus_capa_id');
  sessionStorage.removeItem('map_assurance_focus_section');
};

export const navigateToFilteredList = (
  targetView: string,
  filterKey: string,
  filterValue: string,
  setCurrentHashView: (view: string, entityId?: string) => void,
) => {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem('map_dashboard_filter_view', targetView);
    sessionStorage.setItem('map_dashboard_filter_key', filterKey);
    sessionStorage.setItem('map_dashboard_filter_val', filterValue);

    if (targetView === 'assurance-sets') {
      sessionStorage.setItem('map_assurance_filter', filterValue);
    } else if (targetView === 'documents') {
      sessionStorage.setItem('map_doc_tab_preselect', filterValue || 'Expiring < 6 Mos');
    } else if (targetView === 'capa' || targetView === 'capas') {
      sessionStorage.setItem('map_capa_tab_preselect', filterValue === 'open' ? 'Open' : 'All');
      sessionStorage.setItem('map_capa_subfilter', filterValue);
    } else if (targetView === 'verifier' || targetView === 'verifier-workspace') {
      sessionStorage.setItem('map_verifier_tab_preselect', filterValue);
    } else if (targetView === 'inspector' || targetView === 'inspector-workspace') {
      sessionStorage.setItem('map_inspector_tab_preselect', filterValue);
    } else if (targetView === 'approver' || targetView === 'approver-dashboard') {
      sessionStorage.setItem('map_approver_tab_preselect', filterValue);
    }
  }

  setCurrentHashView(targetView);
};

export const isSetNeedingPeople = (set: AssuranceSet): boolean => {
  const needsInspector = set.mandatoryInspectionRequired !== false && !set.assignedInspector;
  const needsApprover = set.formalApprovalRequired !== false && !set.assignedApprover;
  return (
    !set.assignedSubmitter ||
    !set.assignedVerifier ||
    needsInspector ||
    needsApprover
  );
};

export const isSetOverdue = (set: AssuranceSet, now = new Date()): boolean => {
  if (set.stage === 'Certified' || set.stage === 'Cancelled') return false;
  const raw = set.targetDate || set.complianceDeadline || set.charterWindowEnd || '';
  if (!raw) return false;
  const deadline = new Date(raw);
  return !Number.isNaN(deadline.getTime()) && deadline.getTime() < now.getTime();
};

export const isSetDueThisWeek = (set: AssuranceSet, now = new Date()): boolean => {
  if (set.stage === 'Certified' || set.stage === 'Cancelled') return false;
  const raw = set.targetDate || set.complianceDeadline || set.charterWindowEnd || '';
  if (!raw) return false;
  const deadline = new Date(raw);
  if (Number.isNaN(deadline.getTime())) return false;
  const diffDays = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= 7;
};

export const isSetEscalated = (set: AssuranceSet, notifications?: any[] | unknown): boolean => {
  if ((set as any).hasActiveEscalationNotice) return true;
  if (Array.isArray((set as any).notices)) {
    return (set as any).notices.some(
      (n: any) =>
        (n.kind === 'escalation' || n.targetDateKind === 'escalation') &&
        (n.active !== false && n.status !== 'resolved'),
    );
  }
  if (Array.isArray((set as any).targetDateNotices)) {
    return (set as any).targetDateNotices.some(
      (n: any) =>
        (n.kind === 'escalation' || n.targetDateKind === 'escalation') &&
        (n.active !== false),
    );
  }
  if (Array.isArray(notifications)) {
    return notifications.some(
      (n: any) =>
        (n.target?.setId === set.id || n.assuranceSetId === set.id || n.setId === set.id) &&
        (n.type === 'target_date' || n.kind === 'target_date' || n.category === 'target_date') &&
        (n.targetDateKind === 'escalation' || n.kind === 'escalation') &&
        !n.isRead,
    );
  }
  return false;
};

export const filterAssuranceSetsByDashboardFilter = (
  sets: AssuranceSet[],
  filter?: string,
  now = new Date(),
  capaItems?: CapaItem[],
): AssuranceSet[] => {
  if (!filter || filter === 'ALL') return sets;
  switch (filter) {
    case 'needing_people':
      return sets.filter(isSetNeedingPeople);
    case 'overdue':
      return sets.filter((s) => isSetOverdue(s, now));
    case 'due_this_week':
      return sets.filter((s) => isSetDueThisWeek(s, now));
    case 'returned':
      return sets.filter(
        (s) =>
          s.requirements?.some((r) => r.verifierStatus === 'Correction Requested') ||
          (s as any).status === 'Returned',
      );
    case 'missing':
      return sets.filter(
        (s) =>
          s.requirements?.some(
            (r) =>
              !r.isFulfilled &&
              !r.documentId &&
              !r.linkedDocumentId &&
              r.verifierStatus !== 'Correction Requested' &&
              r.verifierStatus !== 'Rejected',
          ) ||
          (s as any).status === 'Missing',
      );
    case 'escalated':
      return sets.filter((s) => isSetEscalated(s));
    case 'ready_to_decide':
      return sets.filter(
        (s) =>
          s.stage === 'Approval' ||
          (s.stage as string) === 'Ready for Approval' ||
          (s.requirements && s.requirements.every((r) => r.isFulfilled || r.verifierStatus === 'Verified')),
      );
    case 'with_open_findings':
      return sets.filter(
        (s) =>
          (s as any).openFindingsCount > 0 ||
          (s as any).hasOpenFindings ||
          (Array.isArray(capaItems) &&
            capaItems.some(
              (c) =>
                c.status !== 'Verified & Closed' &&
                (c.assuranceSetId === s.id || (!c.assuranceSetId && c.vesselId && c.vesselId === s.vesselId)),
            )),
      );
    case 'in_progress':
      return sets.filter(
        (s) => s.stage !== 'Certified' && s.stage !== 'Approved' && s.stage !== 'Cancelled',
      );
    case 'approved':
      return sets.filter((s) => s.stage === 'Approved');
    default:
      return sets;
  }
};

export const filterCapaItemsByDashboardFilter = (
  items: CapaItem[],
  filter?: string,
): CapaItem[] => {
  if (!filter || filter === 'ALL') return items;
  switch (filter) {
    case 'open':
      return items.filter((item) => item.status === 'Open');
    case 'reinspections':
      return items.filter(
        (item) => item.status === 'Under Re-Inspection' || Boolean((item as any).flaggedForReinspection),
      );
    case 'fixes_to_check':
      return items.filter(
        (item) =>
          item.status === 'Under Re-Inspection' ||
          (Array.isArray(item.evidences) && item.evidences.length > 0 && item.status !== 'Verified & Closed'),
      );
    default:
      return items;
  }
};

export const getRoleDashboardTiles = (
  role: DashboardRole,
  state: {
    assuranceSets: AssuranceSet[];
    documents: MasterDocument[];
    capaItems: CapaItem[];
    activeDemoOrganization?: string;
  },
  setCurrentHashView: (view: string, entityId?: string) => void,
  now = new Date(),
): DashboardKpiTile[] => {
  const sets = state.assuranceSets || [];
  const capas = state.capaItems || [];
  const docs = state.documents || [];

  switch (role) {
    case 'Administrator as client': {
      const needingPeople = sets.filter(isSetNeedingPeople);
      const overdue = sets.filter((s) => isSetOverdue(s, now));
      const dueThisWeek = sets.filter((s) => isSetDueThisWeek(s, now));
      const openFindings = capas.filter((c) => c.status === 'Open');

      return [
        {
          id: 'client-needing-people',
          label: 'Sets needing people',
          value: needingPeople.length,
          tone: 'neutral',
          linkText: 'View →',
          onClick: () =>
            navigateToFilteredList('assurance-sets', 'map_assurance_filter', 'needing_people', setCurrentHashView),
        },
        {
          id: 'client-overdue',
          label: 'Overdue sets',
          value: overdue.length,
          tone: 'neutral',
          linkText: 'View →',
          onClick: () =>
            navigateToFilteredList('assurance-sets', 'map_assurance_filter', 'overdue', setCurrentHashView),
        },
        {
          id: 'client-due-this-week',
          label: 'Due this week',
          value: dueThisWeek.length,
          tone: 'neutral',
          linkText: 'View →',
          onClick: () =>
            navigateToFilteredList('assurance-sets', 'map_assurance_filter', 'due_this_week', setCurrentHashView),
        },
        {
          id: 'client-open-findings',
          label: 'Open findings',
          value: openFindings.length,
          tone: 'neutral',
          linkText: 'View →',
          onClick: () => navigateToFilteredList('capa', 'map_capa_tab_preselect', 'open', setCurrentHashView),
        },
      ];
    }

    case 'Submitter': {
      const returned = sets.filter(
        (s) =>
          s.requirements?.some((r) => r.verifierStatus === 'Correction Requested') ||
          (s as any).status === 'Returned',
      );
      const missing = sets.filter(
        (s) =>
          s.requirements?.some(
            (r) =>
              !r.isFulfilled &&
              !r.documentId &&
              !r.linkedDocumentId &&
              r.verifierStatus !== 'Correction Requested' &&
              r.verifierStatus !== 'Rejected',
          ) ||
          (s as any).status === 'Missing',
      );
      const expiring30 = docs.filter((d) => {
        if (!d.expiryDate) return false;
        const exp = new Date(d.expiryDate).getTime();
        const diffDays = (exp - now.getTime()) / (1000 * 60 * 60 * 24);
        return diffDays >= 0 && diffDays <= 30;
      });
      const openFindingsSets = filterAssuranceSetsByDashboardFilter(sets, 'with_open_findings', now, capas);

      return [
        {
          id: 'submitter-returned',
          label: 'Returned',
          value: returned.length,
          tone: 'bad',
          linkText: 'View →',
          onClick: () =>
            navigateToFilteredList('assurance-sets', 'map_assurance_filter', 'returned', setCurrentHashView),
        },
        {
          id: 'submitter-missing',
          label: 'Missing',
          value: missing.length,
          tone: 'warn',
          linkText: 'View →',
          onClick: () =>
            navigateToFilteredList('assurance-sets', 'map_assurance_filter', 'missing', setCurrentHashView),
        },
        {
          id: 'submitter-expiring',
          label: 'Expiring in 30 days',
          value: expiring30.length,
          tone: 'warn',
          linkText: 'View →',
          onClick: () =>
            navigateToFilteredList('documents', 'map_doc_tab_preselect', 'Expiring < 6 Mos', setCurrentHashView),
        },
        {
          id: 'submitter-open-findings',
          label: 'Open findings',
          value: openFindingsSets.length,
          tone: 'neutral',
          linkText: 'View →',
          onClick: () =>
            navigateToFilteredList('assurance-sets', 'map_assurance_filter', 'with_open_findings', setCurrentHashView),
        },
      ];
    }

    case 'Verifier': {
      const escalated = sets.filter((s) => isSetEscalated(s));
      const dueThisWeek = sets.filter((s) => isSetDueThisWeek(s, now));
      const resubmitted = sets.filter((s) =>
        s.requirements?.some((r) => (r as any).isResubmitted || r.verifierStatus === 'Pending'),
      );
      const inQueue = sets.filter(
        (s) => s.stage === 'Verification' || s.requirements?.some((r) => r.verifierStatus === 'Pending'),
      );

      return [
        {
          id: 'verifier-escalated',
          label: 'Escalated',
          value: escalated.length,
          tone: 'bad',
          linkText: 'View →',
          onClick: () =>
            navigateToFilteredList('verifier', 'map_verifier_tab_preselect', 'overdue', setCurrentHashView),
        },
        {
          id: 'verifier-due-this-week',
          label: 'Due this week',
          value: dueThisWeek.length,
          tone: 'warn',
          linkText: 'View →',
          onClick: () =>
            navigateToFilteredList('verifier', 'map_verifier_tab_preselect', 'to-verify', setCurrentHashView),
        },
        {
          id: 'verifier-resubmitted',
          label: 'Re-submitted',
          value: resubmitted.length,
          tone: 'neutral',
          linkText: 'View →',
          onClick: () =>
            navigateToFilteredList('verifier', 'map_verifier_tab_preselect', 'to-verify', setCurrentHashView),
        },
        {
          id: 'verifier-in-queue',
          label: 'In queue',
          value: inQueue.length,
          tone: 'neutral',
          linkText: 'View →',
          onClick: () =>
            navigateToFilteredList('verifier', 'map_verifier_tab_preselect', 'all', setCurrentHashView),
        },
      ];
    }

    case 'Inspector': {
      const overdueReports = sets.filter((s) => isSetOverdue(s, now));
      const reinspections = capas.filter(
        (c) => c.status === 'Under Re-Inspection' || Boolean((c as any).flaggedForReinspection),
      );
      const next7Days = sets.filter((s) => isSetDueThisWeek(s, now));
      const fixesToCheck = capas.filter(
        (c) =>
          c.status === 'Under Re-Inspection' ||
          (Array.isArray(c.evidences) && c.evidences.length > 0 && c.status !== 'Verified & Closed'),
      );

      return [
        {
          id: 'inspector-reports-overdue',
          label: 'Reports overdue',
          value: overdueReports.length,
          tone: 'bad',
          linkText: 'View →',
          onClick: () =>
            navigateToFilteredList('inspector', 'map_inspector_tab_preselect', 'overdue', setCurrentHashView),
        },
        {
          id: 'inspector-reinspections',
          label: 'Re-inspections',
          value: reinspections.length,
          tone: 'warn',
          linkText: 'View →',
          onClick: () =>
            navigateToFilteredList('capa', 'map_capa_subfilter', 'reinspections', setCurrentHashView),
        },
        {
          id: 'inspector-next-7-days',
          label: 'Next 7 days',
          value: next7Days.length,
          tone: 'neutral',
          linkText: 'View →',
          onClick: () =>
            navigateToFilteredList('inspector', 'map_inspector_tab_preselect', 'to-inspect', setCurrentHashView),
        },
        {
          id: 'inspector-fixes-to-check',
          label: 'Fixes to check',
          value: fixesToCheck.length,
          tone: 'neutral',
          linkText: 'View →',
          onClick: () =>
            navigateToFilteredList('capa', 'map_capa_subfilter', 'fixes_to_check', setCurrentHashView),
        },
      ];
    }

    case 'Approver': {
      const readyToDecide = sets.filter(
        (s) =>
          s.stage === 'Approval' ||
          (s.stage as string) === 'Ready for Approval' ||
          (s.requirements && s.requirements.every((r) => r.isFulfilled || r.verifierStatus === 'Verified')),
      );
      const withFindings = sets.filter((s) => (s as any).openFindingsCount > 0 || (s as any).hasOpenFindings);
      const waitingOver5 = sets.filter((s) => {
        const days = (s as any).waitingDays || 0;
        return days >= 5;
      });
      const approvedThisMonth = sets.filter((s) => s.stage === 'Approved');

      return [
        {
          id: 'approver-ready-to-decide',
          label: 'Ready to decide',
          value: readyToDecide.length,
          tone: 'ok',
          linkText: 'View →',
          onClick: () =>
            navigateToFilteredList('approver', 'map_approver_tab_preselect', 'needs-decision', setCurrentHashView),
        },
        {
          id: 'approver-with-findings',
          label: 'With open findings',
          value: withFindings.length,
          tone: 'warn',
          linkText: 'View →',
          onClick: () =>
            navigateToFilteredList('approver', 'map_approver_tab_preselect', 'all', setCurrentHashView),
        },
        {
          id: 'approver-waiting-over-5',
          label: 'Waiting over 5 days',
          value: waitingOver5.length,
          tone: 'bad',
          linkText: 'View →',
          onClick: () =>
            navigateToFilteredList('approver', 'map_approver_tab_preselect', 'overdue', setCurrentHashView),
        },
        {
          id: 'approver-approved-this-month',
          label: 'Approved this month',
          value: approvedThisMonth.length,
          tone: 'neutral',
          linkText: 'View →',
          onClick: () =>
            navigateToFilteredList('approver', 'map_approver_tab_preselect', 'approved', setCurrentHashView),
        },
      ];
    }
  }
};
