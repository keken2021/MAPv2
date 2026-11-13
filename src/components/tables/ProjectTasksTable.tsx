/*
  file summary: shared tasks table scoped by user, project, or assurance set.
  responsibilities: aggregates tasks across scoped assurance sets, provides status count tabs (All, Pending, On-going, Done), search with active filter chips, overdue row flags, sorting, and 20-row pagination.
  role in system: shared Tasks table component used on ProjectDetailView, DashboardView, and AssuranceDetailView.
*/

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { ActiveFilterChips, FilterChip } from '../common/ActiveFilterChips';
import { CountTab, CountTabs } from '../common/CountTabs';
import { ListToolbar } from '../common/ListToolbar';
import { TablePagination } from '../common/TablePagination';
import { StatusBadge } from '../common/StatusBadge';
import { useMapStore } from '../../store/useMapStore';
import type { AssuranceObject, AssuranceRequirement, AssuranceSet } from '../../types/assurance';
import type { MasterDocument } from '../../types/document';
import type { UserProfile } from '../../types/user';
import { DEFAULT_PAGE_SIZE, paginate } from '../../utils/paginationHelpers';
import { RbacSessionUser } from '../../utils/rbacHelpers';
import { getDemoSessionContext, getSessionUserForPersona } from '../../utils/userRoleHelpers';
import {
  ProjectTaskRow,
  getTaskRowActionLabel,
  resolveViewerPartyForRow,
} from './ProjectTaskRow';
export {
  ProjectTaskRow,
  getTaskRowActionLabel,
  resolveViewerPartyForRow,
};
export type {
  ProjectTaskRowData,
  ProjectTaskRowProps,
} from './ProjectTaskRow';
import {
  getInspectionTaskStatus,
  getApprovalTaskStatus,
  INSPECTION_TASK_TITLE,
  INSPECTION_TASK_STATUS,
  APPROVAL_TASK_TITLE,
  APPROVAL_TASK_STATUS,
} from '../../utils/stageTasks';

export type TaskStatus = 'Pending' | 'On-going' | 'Done' | 'To Inspect' | 'To Approve';

export type TaskTableScopeType = 'user' | 'project' | 'set';

export interface TaskTableScope {
  type: TaskTableScopeType;
  id?: string;
  userId?: string;
  projectId?: string;
  setId?: string;
}

export type TaskFilterChipKey = 'overdue' | 'blocking' | 'pending_approval' | 'my_org';

export const TASK_FILTER_CHIP_LABELS: Record<TaskFilterChipKey, string> = {
  overdue: 'Overdue',
  blocking: 'Blocking',
  pending_approval: 'Pending approval',
  my_org: 'My organization',
};

type SortField = 'title' | 'set' | 'object' | 'assignee' | 'status';


export interface ProjectTasksTableProps {
  title?: string;
  sets?: AssuranceSet[];
  scope?: TaskTableScope | TaskTableScopeType;
  projectId?: string;
  setId?: string;
  userId?: string;
  documents?: MasterDocument[];
  assuranceObjects?: AssuranceObject[];
  users?: UserProfile[];
  activeDemoOrganization?: string;
  sessionUser?: Partial<Pick<UserProfile, 'id' | 'name' | 'organization' | 'roles'>> | null;
  onOpenSet?: (set: AssuranceSet) => void;
  onOpenRequirement?: (requirement: AssuranceRequirement, set: AssuranceSet) => void;
  onTaskAction?: (requirement: AssuranceRequirement, set: AssuranceSet) => void;
  today?: Date;
  /** When true, renders an action column per row (Upload, Review, View) */
  showActions?: boolean;
  showActionColumn?: boolean;
  /** Optional explicit permissions; when omitted while authenticated, derived per set from RBAC. */
  canUpload?: boolean;
  canVerify?: boolean;
  /** Viewer's party perspective: 'requesting' (client/approver/verifier) or 'responding' (service provider/submitter) */
  viewerParty?: 'requesting' | 'responding' | 'other' | string;
  party?: 'requesting' | 'responding' | 'other' | string;
  /** Optional requirement ID to highlight and paginate into view when routed from Dashboard */
  highlightedTaskId?: string;

  // Optional controlled/initial state props for state lifting/persistence
  initialSearch?: string;
  initialStatusTab?: string;
  initialSortField?: SortField;
  initialSortDirection?: 'asc' | 'desc';
  initialPage?: number;
  initialPageSize?: number;

  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  statusTab?: string;
  onStatusTabChange?: (tab: string) => void;
  sortField?: SortField | null;
  sortDirection?: 'asc' | 'desc';
  onSortChange?: (field: SortField, direction: 'asc' | 'desc') => void;
  page?: number;
  onPageChange?: (page: number) => void;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
}


function resolveTargetObject(
  req: AssuranceRequirement,
  set: AssuranceSet,
  assuranceObjects: AssuranceObject[] = [],
): { name: string; identifier?: string; type?: string } {
  if (req.targetObjectId) {
    const matched =
      (set.assuranceObjects || []).find((o) => o.id === req.targetObjectId) ||
      assuranceObjects.find((o) => o.id === req.targetObjectId);
    if (matched) {
      return { name: matched.name, identifier: matched.identifier, type: matched.type };
    }
  }
  if (set.assuranceObjects && set.assuranceObjects.length === 1) {
    const obj = set.assuranceObjects[0];
    return { name: obj.name, identifier: obj.identifier, type: obj.type };
  }
  if (set.vesselName) {
    return {
      name: set.vesselName,
      identifier: set.imoNumber ? `IMO ${set.imoNumber}` : undefined,
      type: 'Vessel',
    };
  }
  if (set.crewName) {
    return { name: set.crewName, type: 'Crew' };
  }
  if (set.equipmentName) {
    return { name: set.equipmentName, type: 'Equipment' };
  }
  return { name: 'General' };
}

function resolveAssignee(
  req: AssuranceRequirement,
  set: AssuranceSet,
): string {
  if (req.assignedSubmitter?.trim()) {
    return req.assignedSubmitter.trim();
  }
  if (req.responsibleParty?.trim()) {
    return req.responsibleParty.trim();
  }
  if (req.assignedVerifier?.trim()) {
    return req.assignedVerifier.trim();
  }
  if (set.assignedSubmitter?.trim()) {
    return set.assignedSubmitter.trim();
  }
  if (set.serviceProviderOrg?.trim()) {
    return set.serviceProviderOrg.trim();
  }
  return 'Unassigned';
}

function resolveStatusAndDates(
  req: AssuranceRequirement,
  set: AssuranceSet,
  today: Date,
) {
  if (req.reuploadRequested) {
    const targetDate = req.targetDate || set.targetDate || set.complianceDeadline;
    const todayIso = today.toISOString().split('T')[0];
    const isOverdue = Boolean(targetDate) && targetDate! < todayIso;
    const isBlocking = true;
    return {
      status: 'Pending' as TaskStatus,
      targetDate,
      isOverdue,
      isBlocking,
      isCompleted: false,
    };
  }

  const isCompleted =
    req.verifierStatus === 'Verified' ||
    Boolean(req.isFulfilled) ||
    set.stage === 'Approved' ||
    set.stage === 'Certified';

  const targetDate = req.targetDate || set.targetDate || set.complianceDeadline;
  const todayIso = today.toISOString().split('T')[0];
  const isOverdue = !isCompleted && Boolean(targetDate) && targetDate! < todayIso;
  const isBlocking =
    req.verifierStatus === 'Rejected' ||
    req.verifierStatus === 'Correction Requested' ||
    (Boolean(req.isMandatory) && isOverdue);

  const hasDocument = Boolean(
    req.documentId ||
      req.linkedDocumentId ||
      req.fulfillmentType === 'assurance_set' ||
      req.isFulfilled,
  );

  let status: TaskStatus;
  if (isCompleted) {
    status = 'Done';
  } else if (
    hasDocument ||
    req.verifierStatus === 'Correction Requested' ||
    req.verifierStatus === 'Rejected'
  ) {
    status = 'On-going';
  } else {
    status = 'Pending';
  }

  return {
    status,
    targetDate,
    isOverdue,
    isBlocking,
    isCompleted,
  };
}

function resolveTaskOrganization(
  req: AssuranceRequirement,
  set: AssuranceSet,
): string {
  if (req.responsibleParty?.trim()) return req.responsibleParty.trim();
  if (req.responsibleParties && req.responsibleParties.length === 1 && req.responsibleParties[0]?.trim()) {
    return req.responsibleParties[0].trim();
  }
  if (req.assignedSubmitter) {
    const parenMatch = req.assignedSubmitter.match(/\(([^)]+)\)/);
    if (parenMatch && parenMatch[1].trim()) return parenMatch[1].trim();
    return req.assignedSubmitter.trim();
  }
  if (req.assignedVerifier) {
    const parenMatch = req.assignedVerifier.match(/\(([^)]+)\)/);
    if (parenMatch && parenMatch[1].trim()) return parenMatch[1].trim();
    return req.assignedVerifier.trim();
  }
  if (set.assignedSubmitter) {
    const parenMatch = set.assignedSubmitter.match(/\(([^)]+)\)/);
    if (parenMatch && parenMatch[1].trim()) return parenMatch[1].trim();
  }
  return set.serviceProviderOrg || set.clientOrg || '';
}

function checkMatchesMyOrg(
  req: AssuranceRequirement,
  set: AssuranceSet,
  viewerOrg?: string,
): boolean {
  if (!viewerOrg?.trim()) return true;
  const v = viewerOrg.trim().toLowerCase();
  const taskOrg = resolveTaskOrganization(req, set).toLowerCase();
  return taskOrg.includes(v) || v.includes(taskOrg);
}

export const ProjectTasksTable: React.FC<ProjectTasksTableProps> = ({
  title,
  sets,
  scope,
  projectId,
  setId,
  userId,
  assuranceObjects = [],
  documents = [],
  users,
  activeDemoOrganization,
  sessionUser,
  onOpenSet,
  onOpenRequirement,
  onTaskAction,
  today = new Date(),
  showActions,
  showActionColumn,
  canUpload: canUploadProp,
  canVerify: canVerifyProp,
  viewerParty,
  party,
  highlightedTaskId,
  initialSearch,
  initialStatusTab,
  initialSortField,
  initialSortDirection,
  initialPage,
  initialPageSize,
  searchTerm: controlledSearchTerm,
  onSearchChange,
  statusTab: controlledStatusTab,
  onStatusTabChange,
  sortField: controlledSortField,
  sortDirection: controlledSortDirection,
  onSortChange,
  page: controlledPage,
  onPageChange,
  pageSize: controlledPageSize,
  onPageSizeChange,
}) => {
  const hasActions = Boolean(showActions ?? showActionColumn);
  const explicitParty = viewerParty ?? party;
  const store = useMapStore();
  const rawSets = sets ?? store.assuranceSets ?? [];
  const allUsers = users ?? store.users ?? [];
  const resolvedOrg = activeDemoOrganization ?? store.activeDemoOrganization;
  const rawSessionUser =
    sessionUser !== undefined
      ? sessionUser
      : getSessionUserForPersona(
          store.activePersona,
          allUsers,
          getDemoSessionContext({
            activeDemoOrganization: resolvedOrg,
            activeSessionUserId: store.activeSessionUserId,
          }),
        ) ?? null;
  const resolvedSessionUser: RbacSessionUser | null = rawSessionUser
    ? ((rawSessionUser.id ? allUsers.find((u) => u.id === rawSessionUser.id) : undefined) ?? {
        id: rawSessionUser.id ?? '',
        name: rawSessionUser.name ?? '',
        organization: rawSessionUser.organization ?? resolvedOrg ?? '',
        roles:
          rawSessionUser.roles && rawSessionUser.roles.length > 0
            ? rawSessionUser.roles
            : [store.activePersona],
      })
    : null;
  const handleOpenSet = onOpenSet ?? ((set: AssuranceSet) => store.setCurrentHashView?.('assurance-sets', set.id));

  const [internalActiveTabKey, setInternalActiveTabKey] = useState<string>(initialStatusTab ?? 'all');
  const activeTabKey = controlledStatusTab ?? internalActiveTabKey;
  const handleCountTabChange = (key: string) => {
    setInternalActiveTabKey(key);
    onStatusTabChange?.(key);
    setPage(1);
  };

  const [internalSearchTerm, setInternalSearchTerm] = useState(initialSearch ?? '');
  const searchTerm = controlledSearchTerm ?? internalSearchTerm;
  const handleSearchChange = (val: string) => {
    setInternalSearchTerm(val);
    onSearchChange?.(val);
    setPage(1);
  };

  const [internalSortField, setInternalSortField] = useState<SortField | null>(initialSortField ?? null);
  const sortField = controlledSortField !== undefined ? controlledSortField : internalSortField;

  const [internalSortDirection, setInternalSortDirection] = useState<'asc' | 'desc'>(initialSortDirection ?? 'asc');
  const sortDirection = controlledSortDirection ?? internalSortDirection;

  const [internalPageSize, setInternalPageSize] = useState(initialPageSize ?? DEFAULT_PAGE_SIZE);
  const pageSize = controlledPageSize ?? internalPageSize;

  const [internalPage, setInternalPage] = useState(initialPage ?? 1);
  const page = controlledPage ?? internalPage;
  const setPage = (p: number | ((prev: number) => number)) => {
    if (typeof p === 'function') {
      setInternalPage((prev) => {
        const next = p(prev);
        onPageChange?.(next);
        return next;
      });
    } else {
      setInternalPage(p);
      onPageChange?.(p);
    }
  };

  const handleSort = (field: SortField) => {
    let nextDirection: 'asc' | 'desc' = 'asc';
    if (sortField === field) {
      nextDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    }
    setInternalSortField(field);
    setInternalSortDirection(nextDirection);
    onSortChange?.(field, nextDirection);
  };

  const viewerOrg = resolvedOrg || resolvedSessionUser?.organization || '';

  const resolvedScopeType = typeof scope === 'string' ? scope : scope?.type;
  const resolvedScopeId =
    (typeof scope === 'object'
      ? scope.id || scope.projectId || scope.setId || scope.userId
      : undefined) ||
    projectId ||
    setId ||
    userId;

  const scopedSets = useMemo(() => {
    if (!resolvedScopeType || !resolvedScopeId) return rawSets;
    if (resolvedScopeType === 'project') {
      return rawSets.filter((s) => s.projectId === resolvedScopeId);
    }
    if (resolvedScopeType === 'set') {
      return rawSets.filter((s) => s.id === resolvedScopeId);
    }
    return rawSets;
  }, [rawSets, resolvedScopeType, resolvedScopeId]);

  const allRows: ProjectTaskRow[] = useMemo(() => {
    const list: ProjectTaskRow[] = [];
    for (const set of scopedSets) {
      // 1. Stage Task: Inspection
      const inspectionStatusInfo = getInspectionTaskStatus(set);
      if (inspectionStatusInfo) {
        let matchesUser = true;
        if (resolvedScopeType === 'user' && resolvedScopeId) {
          const target = resolvedScopeId.toLowerCase().trim();
          const targetUser = allUsers.find(
            (u) =>
              u.id.toLowerCase() === target ||
              u.name.toLowerCase() === target ||
              u.email.toLowerCase() === target,
          );
          const needles = [target];
          if (targetUser) {
            needles.push(targetUser.id.toLowerCase(), targetUser.name.toLowerCase(), targetUser.email.toLowerCase());
          }
          const haystacks = [set.assignedInspector].filter(Boolean).map((h) => String(h).toLowerCase());
          matchesUser = needles.some((needle) => haystacks.some((h) => h.includes(needle)));
        }

        if (matchesUser) {
          const targetObject = resolveTargetObject(
            { id: `${set.id}-INSPECTION`, title: INSPECTION_TASK_TITLE } as AssuranceRequirement,
            set,
            assuranceObjects,
          );
          const assignee = set.assignedInspector?.trim() || 'Unassigned';
          const targetDate = set.targetDate || set.complianceDeadline;
          const todayIso = today.toISOString().split('T')[0];
          const isOverdue = Boolean(targetDate && targetDate < todayIso);
          const isDone = inspectionStatusInfo.status === 'Done';
          const inspectionReq: AssuranceRequirement = {
            id: `${set.id}-INSPECTION`,
            category: 'Inspection',
            title: INSPECTION_TASK_TITLE,
            description: 'Mandatory physical or remote inspection required before assurance set sign-off.',
            isMandatory: true,
            isFulfilled: isDone,
            ocrConfidence: 100,
            verifierStatus: isDone ? 'Verified' : 'Pending',
            targetDate,
            responsibleParty: set.assignedInspector,
          };
          list.push({
            id: `${set.id}-INSPECTION`,
            requirement: inspectionReq,
            parentSet: set,
            targetObject,
            assignee,
            status: inspectionStatusInfo.status,
            targetDate,
            isOverdue,
            isBlocking: !isDone,
            isCompleted: isDone,
            isMyOrg: true,
            outcomeLabel: inspectionStatusInfo.outcomeLabel,
            note: inspectionStatusInfo.note,
          });
        }
      }

      // 2. Stage Task: Approval
      const approvalStatusInfo = getApprovalTaskStatus(set);
      if (approvalStatusInfo) {
        let matchesUser = true;
        if (resolvedScopeType === 'user' && resolvedScopeId) {
          const target = resolvedScopeId.toLowerCase().trim();
          const targetUser = allUsers.find(
            (u) =>
              u.id.toLowerCase() === target ||
              u.name.toLowerCase() === target ||
              u.email.toLowerCase() === target,
          );
          const needles = [target];
          if (targetUser) {
            needles.push(targetUser.id.toLowerCase(), targetUser.name.toLowerCase(), targetUser.email.toLowerCase());
          }
          const haystacks = [set.assignedApprover].filter(Boolean).map((h) => String(h).toLowerCase());
          matchesUser = needles.some((needle) => haystacks.some((h) => h.includes(needle)));
        }

        if (matchesUser) {
          const targetObject = resolveTargetObject(
            { id: `${set.id}-APPROVAL`, title: APPROVAL_TASK_TITLE } as AssuranceRequirement,
            set,
            assuranceObjects,
          );
          const assignee = set.assignedApprover?.trim() || 'Unassigned';
          const targetDate = set.targetDate || set.complianceDeadline;
          const todayIso = today.toISOString().split('T')[0];
          const isOverdue = Boolean(targetDate && targetDate < todayIso);
          const isDone = approvalStatusInfo.status === 'Done';
          const approvalReq: AssuranceRequirement = {
            id: `${set.id}-APPROVAL`,
            category: 'Approval',
            title: APPROVAL_TASK_TITLE,
            description: 'Formal assurance sign-off and charter approval.',
            isMandatory: true,
            isFulfilled: isDone,
            ocrConfidence: 100,
            verifierStatus: isDone ? 'Verified' : 'Pending',
            targetDate,
            responsibleParty: set.assignedApprover,
          };
          list.push({
            id: `${set.id}-APPROVAL`,
            requirement: approvalReq,
            parentSet: set,
            targetObject,
            assignee,
            status: approvalStatusInfo.status,
            targetDate,
            isOverdue,
            isBlocking: !isDone,
            isCompleted: isDone,
            isMyOrg: true,
            outcomeLabel: approvalStatusInfo.outcomeLabel,
            note: approvalStatusInfo.note,
          });
        }
      }

      const reqs = set.requirements || [];
      for (const req of reqs) {
        const targetObject = resolveTargetObject(req, set, assuranceObjects);
        const assignee = resolveAssignee(req, set);

        if (resolvedScopeType === 'user' && resolvedScopeId) {
          const target = resolvedScopeId.toLowerCase().trim();
          const targetUser = allUsers.find(
            (u) =>
              u.id.toLowerCase() === target ||
              u.name.toLowerCase() === target ||
              u.email.toLowerCase() === target,
          );
          const needles = [target];
          if (targetUser) {
            needles.push(targetUser.id.toLowerCase(), targetUser.name.toLowerCase(), targetUser.email.toLowerCase());
          }
          const haystacks = [
            req.assignedSubmitter,
            req.assignedVerifier,
            req.responsibleParty,
            ...(req.responsibleParties || []),
            set.assignedSubmitter,
            assignee,
          ]
            .filter(Boolean)
            .map((h) => String(h).toLowerCase());

          const matches = needles.some((needle) => haystacks.some((h) => h.includes(needle)));
          if (!matches) {
            continue;
          }
        }

        const { status, targetDate, isOverdue, isBlocking, isCompleted } =
          resolveStatusAndDates(req, set, today);
        const isMyOrg = checkMatchesMyOrg(req, set, viewerOrg);

        list.push({
          id: `${set.id}-${req.id}`,
          requirement: req,
          parentSet: set,
          targetObject,
          assignee,
          status,
          targetDate,
          isOverdue,
          isBlocking,
          isCompleted,
          isMyOrg,
        });
      }
    }
    return list;
  }, [scopedSets, assuranceObjects, today, viewerOrg, resolvedScopeType, resolvedScopeId, allUsers, store.activePersona, resolvedOrg, resolvedSessionUser]);

  const countTotals = useMemo(() => {
    return {
      all: allRows.length,
      pending: allRows.filter((r) => r.status === 'Pending' || r.status === INSPECTION_TASK_STATUS || r.status === APPROVAL_TASK_STATUS).length,
      on_going: allRows.filter((r) => r.status === 'On-going').length,
      done: allRows.filter((r) => r.status === 'Done').length,
    };
  }, [allRows]);

  const countTabs: CountTab[] = useMemo(
    () => [
      { key: 'all', label: 'All', count: countTotals.all },
      { key: 'pending', label: 'Pending', count: countTotals.pending },
      { key: 'on_going', label: 'On-going', count: countTotals.on_going },
      { key: 'done', label: 'Done', count: countTotals.done },
    ],
    [countTotals],
  );

  const filteredRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    return allRows.filter((row) => {
      if (activeTabKey === 'pending' && row.status !== 'Pending' && row.status !== INSPECTION_TASK_STATUS && row.status !== APPROVAL_TASK_STATUS) return false;
      if ((activeTabKey === 'on_going' || activeTabKey === 'on-going') && row.status !== 'On-going') return false;
      if (activeTabKey === 'done' && row.status !== 'Done') return false;

      if (q) {
        const haystack = [
          row.requirement.title,
          row.requirement.category,
          row.requirement.id,
          row.parentSet.title,
          row.parentSet.id,
          row.assignee,
          row.targetObject.name,
          row.targetObject.identifier,
          row.requirement.reuploadRequested?.reason,
          row.requirement.reuploadRequested ? 'reupload requested' : '',
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [allRows, activeTabKey, searchTerm]);

  const sortedRows = useMemo(() => {
    if (!sortField) return filteredRows;
    const direction = sortDirection === 'asc' ? 1 : -1;

    return [...filteredRows].sort((a, b) => {
      let comparison = 0;
      if (sortField === 'title') {
        comparison = a.requirement.title.localeCompare(b.requirement.title);
      } else if (sortField === 'set') {
        comparison = a.parentSet.title.localeCompare(b.parentSet.title);
      } else if (sortField === 'object') {
        comparison = a.targetObject.name.localeCompare(b.targetObject.name);
      } else if (sortField === 'assignee') {
        comparison = a.assignee.localeCompare(b.assignee);
      } else if (sortField === 'status') {
        comparison = a.status.localeCompare(b.status);
      }
      return comparison * direction;
    });
  }, [filteredRows, sortField, sortDirection]);

  const pagination = useMemo(() => {
    return paginate(sortedRows, page, pageSize);
  }, [sortedRows, page, pageSize]);

  const resolvedDocuments = documents.length > 0 ? documents : (store.documents ?? []);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const lastHighlightedRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!highlightedTaskId) {
      lastHighlightedRef.current = undefined;
      return;
    }
    const matchingRow = allRows.find((r) => r.requirement.id === highlightedTaskId);
    if (!matchingRow) return;

    if (lastHighlightedRef.current !== highlightedTaskId) {
      if (activeTabKey !== 'all') {
        const visibleInSorted = sortedRows.some((r) => r.requirement.id === highlightedTaskId);
        if (!visibleInSorted) {
          setInternalActiveTabKey('all');
          onStatusTabChange?.('all');
          return;
        }
      }
      const idx = sortedRows.findIndex((r) => r.requirement.id === highlightedTaskId);
      if (idx >= 0) {
        const targetPage = Math.floor(idx / pageSize) + 1;
        if (targetPage !== page) {
          setPage(targetPage);
        }
        lastHighlightedRef.current = highlightedTaskId;
        const rowEl = tableContainerRef.current?.querySelector(`tr[data-task-id="${highlightedTaskId}"]`);
        if (rowEl && typeof (rowEl as HTMLElement).scrollIntoView === 'function') {
          (rowEl as HTMLElement).scrollIntoView({ block: 'nearest' });
        }
      }
    }
  }, [highlightedTaskId, allRows, sortedRows, activeTabKey, page, pageSize]);

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown size={14} className="text-muted ms-1 opacity-50 inline-block align-middle" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp size={14} className="text-primary ms-1 inline-block align-middle" />
    ) : (
      <ArrowDown size={14} className="text-primary ms-1 inline-block align-middle" />
    );
  };

  const activeFilterChips: FilterChip[] = useMemo(() => {
    if (!searchTerm.trim()) {
      return [];
    }

    return [
      {
        id: 'search',
        label: 'Search',
        value: searchTerm.trim(),
        onRemove: () => {
          handleSearchChange('');
        },
      },
    ];
  }, [searchTerm]);

  return (
    <div className="card map-card-custom" data-testid="project-tasks-tab">
      {title && (
        <div className="card-header p-3 border-bottom d-flex align-items-center justify-content-between">
          <span className="fw-bold text-dark fs-6">{title}</span>
        </div>
      )}
      <div className="p-3 border-bottom">
        <CountTabs
          tabs={countTabs}
          active={activeTabKey}
          onChange={handleCountTabChange}
          aria-label="Filter tasks by status"
        />
      </div>

      <ListToolbar
        searchValue={searchTerm}
        onSearchChange={handleSearchChange}
        searchPlaceholder="Search task name, assurance set, assignee..."
      />

      {activeFilterChips.length > 0 && (
        <div className="px-3 py-2 bg-light border-bottom">
          <ActiveFilterChips
            chips={activeFilterChips}
            onClearAll={() => {
              handleSearchChange('');
            }}
          />
        </div>
      )}

      <div className="table-responsive" ref={tableContainerRef}>
        <table className="table map-table-custom align-middle mb-0">
          <thead>
            <tr>
              <th
                style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                onClick={() => handleSort('title')}
              >
                Task / requirement {renderSortIndicator('title')}
              </th>
              {resolvedScopeType !== 'set' && (
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => handleSort('set')}
                >
                  Parent assurance set {renderSortIndicator('set')}
                </th>
              )}
              <th
                style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                onClick={() => handleSort('object')}
              >
                Target object {renderSortIndicator('object')}
              </th>
              <th
                style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                onClick={() => handleSort('assignee')}
              >
                Assignee {renderSortIndicator('assignee')}
              </th>
              <th
                style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                onClick={() => handleSort('status')}
              >
                Status {renderSortIndicator('status')}
              </th>
              {hasActions && (
                <th style={{ whiteSpace: 'nowrap', textAlign: 'end' }}>
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 ? (
              <tr>
                <td colSpan={resolvedScopeType === 'set' ? (hasActions ? 5 : 4) : (hasActions ? 6 : 5)} className="text-center py-4 text-muted">
                  {activeTabKey !== 'all' || searchTerm.trim()
                    ? 'No tasks match these filters.'
                    : 'No tasks found across linked assurance sets.'}
                </td>
              </tr>
            ) : (
              pagination.pageItems.map((row) => (
                <ProjectTaskRow
                  key={row.id}
                  row={row}
                  hasActions={hasActions}
                  showParentSet={resolvedScopeType !== 'set'}
                  isHighlighted={highlightedTaskId === row.requirement.id}
                  explicitParty={explicitParty}
                  canUploadProp={canUploadProp}
                  canVerifyProp={canVerifyProp}
                  resolvedOrg={resolvedOrg}
                  resolvedSessionUser={resolvedSessionUser}
                  resolvedDocuments={resolvedDocuments}
                  today={today}
                  onOpenSet={handleOpenSet}
                  onOpenRequirement={onOpenRequirement}
                  onTaskAction={onTaskAction}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <TablePagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        total={pagination.total}
        rangeStart={pagination.rangeStart}
        rangeEnd={pagination.rangeEnd}
        pageSize={pageSize}
        onPageChange={(nextPage) => setPage(nextPage)}
        onPageSizeChange={(nextSize) => {
          setInternalPageSize(nextSize);
          onPageSizeChange?.(nextSize);
          setPage(1);
        }}
      />
    </div>
  );
};
