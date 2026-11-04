/*
  file summary: shared tasks table scoped by user, project, or assurance set.
  responsibilities: aggregates tasks across scoped assurance sets, provides status count tabs (All, Pending, On-going, Done), search with active filter chips, overdue row flags, sorting, and 20-row pagination.
  role in system: shared Tasks table component used on ProjectDetailView, DashboardView, and AssuranceDetailView.
*/

import React, { useId, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { ActiveFilterChips, FilterChip } from '../common/ActiveFilterChips';
import { CountTab, CountTabs } from '../common/CountTabs';
import { ListToolbar } from '../common/ListToolbar';
import { useMapStore } from '../../store/useMapStore';
import type { AssuranceObject, AssuranceRequirement, AssuranceSet } from '../../types/assurance';
import type { MasterDocument } from '../../types/document';
import type { UserProfile } from '../../types/user';
import { paginate } from '../../utils/paginationHelpers';

export type TaskStatus = 'Pending' | 'On-going' | 'Done';

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

export interface ProjectTaskRow {
  id: string;
  requirement: AssuranceRequirement;
  parentSet: AssuranceSet;
  targetObject: { name: string; identifier?: string; type?: string };
  assignee: string;
  status: TaskStatus;
  targetDate?: string;
  isOverdue: boolean;
  isBlocking: boolean;
  isCompleted: boolean;
  isMyOrg: boolean;
}

interface ProjectTasksTableProps {
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
  sessionUser?: { organization?: string; name?: string; id?: string } | null;
  onOpenSet?: (set: AssuranceSet) => void;
  onOpenRequirement?: (requirement: AssuranceRequirement, set: AssuranceSet) => void;
  today?: Date;
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
  today = new Date(),
}) => {
  const store = useMapStore();
  const rawSets = sets ?? store.assuranceSets ?? [];
  const allUsers = users ?? store.users ?? [];
  const handleOpenSet = onOpenSet ?? ((set: AssuranceSet) => store.setCurrentHashView?.('assurance-sets', set.id));

  const [activeTabKey, setActiveTabKey] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const pageSizeSelectId = useId();

  const viewerOrg = activeDemoOrganization || sessionUser?.organization || '';

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
      const matched = rawSets.filter((s) => s.projectId === resolvedScopeId);
      return matched.length > 0 ? matched : rawSets;
    }
    if (resolvedScopeType === 'set') {
      return rawSets.filter((s) => s.id === resolvedScopeId);
    }
    return rawSets;
  }, [rawSets, resolvedScopeType, resolvedScopeId]);

  const allRows: ProjectTaskRow[] = useMemo(() => {
    const list: ProjectTaskRow[] = [];
    for (const set of scopedSets) {
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
  }, [scopedSets, assuranceObjects, today, viewerOrg, resolvedScopeType, resolvedScopeId, allUsers]);

  const countTotals = useMemo(() => {
    return {
      all: allRows.length,
      pending: allRows.filter((r) => r.status === 'Pending').length,
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

  const handleCountTabChange = (key: string) => {
    setActiveTabKey(key);
    setPage(1);
  };

  const filteredRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    return allRows.filter((row) => {
      if (activeTabKey === 'pending' && row.status !== 'Pending') return false;
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

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

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
          setSearchTerm('');
          setPage(1);
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
        onSearchChange={(val) => {
          setSearchTerm(val);
          setPage(1);
        }}
        searchPlaceholder="Search task name, assurance set, assignee..."
      />

      {activeFilterChips.length > 0 && (
        <div className="px-3 py-2 bg-light border-bottom">
          <ActiveFilterChips
            chips={activeFilterChips}
            onClearAll={() => {
              setSearchTerm('');
              setPage(1);
            }}
          />
        </div>
      )}

      <div className="table-responsive">
        <table className="table map-table-custom align-middle mb-0">
          <thead>
            <tr>
              <th
                style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                onClick={() => handleSort('title')}
              >
                Task / requirement {renderSortIndicator('title')}
              </th>
              <th
                style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                onClick={() => handleSort('set')}
              >
                Parent assurance set {renderSortIndicator('set')}
              </th>
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
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-4 text-muted">
                  {activeTabKey !== 'all' || searchTerm.trim()
                    ? 'No tasks match these filters.'
                    : 'No tasks found across linked assurance sets.'}
                </td>
              </tr>
            ) : (
              pagination.pageItems.map((row) => {
                const { requirement, parentSet, targetObject, assignee, status, targetDate } = row;
                return (
                  <tr key={row.id} data-task-id={requirement.id} data-set-id={parentSet.id}>
                    <td>
                      {onOpenRequirement ? (
                        <button
                          type="button"
                          className="btn btn-link p-0 text-start fw-semibold text-decoration-none"
                          onClick={() => onOpenRequirement(requirement, parentSet)}
                          title={`Open ${requirement.title}`}
                          data-testid={`task-open-req-${requirement.id}`}
                        >
                          {requirement.title}
                        </button>
                      ) : (
                        <div className="fw-semibold text-dark">{requirement.title}</div>
                      )}
                      {requirement.category && (
                        <div className="text-secondary small mt-0.5" style={{ fontSize: '0.75rem' }}>
                          {requirement.category}
                        </div>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-link p-0 text-start fw-semibold text-decoration-none"
                        onClick={() => handleOpenSet(parentSet)}
                        title={`Open ${parentSet.title}`}
                      >
                        {parentSet.title}
                      </button>
                      <div className="font-mono-code text-muted small" style={{ fontSize: '0.72rem' }}>
                        {parentSet.id}
                      </div>
                    </td>
                    <td>
                      <div className="fw-semibold text-dark">{targetObject.name}</div>
                      {targetObject.identifier && (
                        <div className="font-mono-code text-muted small" style={{ fontSize: '0.72rem' }}>
                          {targetObject.identifier}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="text-dark small fw-medium">{assignee}</div>
                    </td>
                    <td>
                      <div className="d-flex flex-column align-items-start gap-1">
                        <div className="d-flex align-items-center gap-1.5 flex-wrap">
                          <span
                            className={`badge ${
                              status === 'Done'
                                ? 'bg-success text-white'
                                : status === 'On-going'
                                  ? 'bg-info text-dark'
                                  : 'bg-secondary text-white'
                            }`}
                            style={{ fontSize: '0.75rem' }}
                            data-testid="task-status-badge"
                          >
                            {status}
                          </span>
                          {row.isOverdue && (
                            <span
                              className="badge bg-danger text-white"
                              style={{ fontSize: '0.7rem' }}
                              data-testid="task-overdue-flag"
                            >
                              Overdue
                            </span>
                          )}
                        </div>
                        {targetDate ? (
                          <span
                            className={`small font-mono-code ${
                              row.isOverdue ? 'text-danger fw-semibold' : 'text-muted'
                            }`}
                            style={{ fontSize: '0.72rem' }}
                          >
                            Due: {targetDate}
                          </span>
                        ) : (
                          <span className="text-muted small" style={{ fontSize: '0.72rem' }}>
                            —
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {sortedRows.length > 0 && (
        <nav className="map-table-pagination" aria-label="Table pagination">
          <div className="map-table-pagination-range" aria-live="polite">
            Showing {pagination.rangeStart}-{pagination.rangeEnd} of {pagination.total}
          </div>
          <div className="map-table-pagination-controls">
            <label className="map-table-pagination-size" htmlFor={pageSizeSelectId}>
              Rows per page
            </label>
            <select
              id={pageSizeSelectId}
              className="form-select form-select-sm map-table-pagination-select"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              {[10, 20, 25, 50].map((sz) => (
                <option key={sz} value={sz}>
                  {sz}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="map-table-pagination-btn"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pagination.page <= 1}
              title="Previous page"
              aria-label="Previous page"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="map-table-pagination-page">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              type="button"
              className="map-table-pagination-btn"
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={pagination.page >= pagination.totalPages}
              title="Next page"
              aria-label="Next page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </nav>
      )}
    </div>
  );
};
