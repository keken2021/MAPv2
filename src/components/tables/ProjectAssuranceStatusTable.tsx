/*
  file summary: status-first assurance set table of one project.
  responsibilities: shows whether each set is OK and what blocks it, worst first, with sorting, filter tabs with counts and pagination.
  role in system: body of the Assurance Sets tab in ProjectDetailView.tsx; the rule itself is in assuranceSetStatus.ts (ADR 0033).
*/

import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { ActiveFilterChips, FilterChip } from '../common/ActiveFilterChips';
import { CountTab, CountTabs } from '../common/CountTabs';
import { DueCell } from '../common/DueCell';
import { ReadinessGauge } from '../common/ReadinessGauge';
import { StatusBadge, StatusTone } from '../common/StatusBadge';
import { TablePagination } from '../common/TablePagination';
import type { AssuranceSet } from '../../types/assurance';
import type { CapaItem } from '../../types/capa';
import type { MasterDocument } from '../../types/document';
import {
  ASSURANCE_SET_STATUS_RULES,
  AssuranceSetAttention,
  AssuranceSetStatus,
  compareAssuranceSetStage,
  compareWorstFirst,
  getAssuranceSetStatus,
  getNextExpiry,
  getPartyRoles,
  PartyRole,
} from '../../utils/assuranceSetStatus';
import { getAssuranceSetObjects } from '../../utils/assuranceTemplates';
import { calculateAssuranceSetReadiness } from '../../utils/readinessHelpers';
import { usePagination } from '../../utils/usePagination';

type SortField = 'status' | 'name' | 'stage' | 'expiry';
type AttentionFilter = 'all' | AssuranceSetAttention;
type RoleFilter = 'all' | PartyRole;

const STATUS_TONES: Record<AssuranceSetStatus, StatusTone> = {
  'No-go': 'danger',
  Conditional: 'warning',
  Go: 'success',
};

const ATTENTION_LABELS: Record<AssuranceSetAttention, string> = {
  needs_attention: 'Needs attention',
  on_track: 'On track',
  done: 'Done',
};

const ROLE_LABELS: Record<PartyRole, string> = {
  client: 'As client',
  provider: 'As provider',
  reviewing: 'Reviewing',
};

interface ProjectAssuranceStatusTableProps {
  sets: AssuranceSet[];
  /** every set in the app, so a linked set counts toward readiness */
  allSets: AssuranceSet[];
  documents: MasterDocument[];
  capaItems: CapaItem[];
  viewer: { organization?: string; name?: string };
  canOpenSet: (set: AssuranceSet) => boolean;
  onOpenSet: (set: AssuranceSet) => void;
  today?: Date;
}

/* the objects a set covers as one short line: the first name, then how many more */
function coveredLabel(set: AssuranceSet): string {
  const names = getAssuranceSetObjects(set).map((object) => object.name).filter(Boolean);
  if (names.length === 0) return set.vesselName || '';
  return names.length === 1 ? names[0] : `${names[0]} +${names.length - 1} more`;
}

/**
  what: renders the assurance sets of a project around their status.
  how: reads each set once through assuranceSetStatus.ts, applies the two filter rows, sorts worst first or by the chosen column, and pages the result. Each row of tabs counts within the other row's choice.
  with what file: src/components/tables/ProjectAssuranceStatusTable.tsx loaded by ProjectDetailView.tsx.
*/
export const ProjectAssuranceStatusTable: React.FC<ProjectAssuranceStatusTableProps> = ({
  sets,
  allSets,
  documents,
  capaItems,
  viewer,
  canOpenSet,
  onOpenSet,
  today,
}) => {
  const [attentionFilter, setAttentionFilter] = useState<AttentionFilter>('all');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [sortField, setSortField] = useState<SortField>('status');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const rows = useMemo(
    () =>
      sets.map((set) => ({
        set,
        ...getAssuranceSetStatus(set, documents, capaItems, today),
        readiness: calculateAssuranceSetReadiness(set, allSets),
        nextExpiry: getNextExpiry(set, documents),
        ...getPartyRoles(set, viewer),
      })),
    [sets, allSets, documents, capaItems, viewer, today],
  );

  type Row = (typeof rows)[number];

  const matchesAttention = (row: Row) => attentionFilter === 'all' || row.attention === attentionFilter;
  const matchesRole = (row: Row) => roleFilter === 'all' || row.roles.includes(roleFilter);

  const attentionTabs: CountTab[] = [
    { key: 'all', label: 'All', count: rows.filter(matchesRole).length },
    ...(Object.keys(ATTENTION_LABELS) as AssuranceSetAttention[]).map((key) => ({
      key,
      label: ATTENTION_LABELS[key],
      count: rows.filter((row) => row.attention === key && matchesRole(row)).length,
      tone: key === 'needs_attention' ? ('warn' as const) : undefined,
    })),
  ];

  const roleTabs: CountTab[] = [
    { key: 'all', label: 'All roles', count: rows.filter(matchesAttention).length },
    ...(Object.keys(ROLE_LABELS) as PartyRole[]).map((key) => ({
      key,
      label: ROLE_LABELS[key],
      count: rows.filter((row) => row.roles.includes(key) && matchesAttention(row)).length,
    })),
  ];

  const activeChips: FilterChip[] = [
    ...(attentionFilter !== 'all'
      ? [{ id: 'attention', label: 'Status', value: ATTENTION_LABELS[attentionFilter], onRemove: () => setAttentionFilter('all') }]
      : []),
    ...(roleFilter !== 'all'
      ? [{ id: 'role', label: 'Role', value: ROLE_LABELS[roleFilter], onRemove: () => setRoleFilter('all') }]
      : []),
  ];

  const sortedRows = useMemo(() => {
    const direction = sortDirection === 'asc' ? 1 : -1;
    const expiryTime = (row: Row) => (row.nextExpiry ? new Date(row.nextExpiry.date).getTime() : Number.NaN);

    return rows
      .filter((row) => matchesAttention(row) && matchesRole(row))
      .sort((a, b) => {
        if (sortField === 'name') return direction * a.set.title.localeCompare(b.set.title) || compareWorstFirst(a, b);
        if (sortField === 'stage') return direction * compareAssuranceSetStage(a.set.stage, b.set.stage) || compareWorstFirst(a, b);
        if (sortField === 'expiry') {
          /* a set with no expiry stays last in either direction */
          const [left, right] = [expiryTime(a), expiryTime(b)];
          if (Number.isNaN(left) || Number.isNaN(right)) {
            return Number(Number.isNaN(left)) - Number(Number.isNaN(right)) || compareWorstFirst(a, b);
          }
          return direction * (left - right) || compareWorstFirst(a, b);
        }
        return direction * compareWorstFirst(a, b);
      });
  }, [rows, attentionFilter, roleFilter, sortField, sortDirection]);

  const pagination = usePagination(sortedRows, [attentionFilter, roleFilter, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const renderSortHeader = (field: SortField, label: string) => (
    <th
      onClick={() => handleSort(field)}
      aria-sort={sortField === field ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}
      style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
    >
      {label}
      {sortField !== field ? (
        <ArrowUpDown size={14} className="text-muted ms-1 opacity-50 inline-block align-middle" />
      ) : sortDirection === 'asc' ? (
        <ArrowUp size={14} className="text-primary ms-1 inline-block align-middle" />
      ) : (
        <ArrowDown size={14} className="text-primary ms-1 inline-block align-middle" />
      )}
    </th>
  );

  const hasFilter = attentionFilter !== 'all' || roleFilter !== 'all';

  return (
    <>
      <div className="card-header d-flex flex-column gap-2 p-3">
        <CountTabs
          tabs={attentionTabs}
          active={attentionFilter}
          onChange={(key) => setAttentionFilter(key as AttentionFilter)}
          aria-label="Filter by status"
        />
        <CountTabs
          tabs={roleTabs}
          active={roleFilter}
          onChange={(key) => setRoleFilter(key as RoleFilter)}
          aria-label="Filter by your role"
        />
        <ActiveFilterChips
          chips={activeChips}
          onClearAll={() => {
            setAttentionFilter('all');
            setRoleFilter('all');
          }}
        />
      </div>
      <div className="table-responsive">
        <table className="table map-table-custom mb-0">
          <thead>
            <tr>
              {renderSortHeader('name', 'Assurance set')}
              {renderSortHeader('status', 'Status')}
              {renderSortHeader('stage', 'Readiness')}
              <th style={{ whiteSpace: 'nowrap' }}>Blocking</th>
              {renderSortHeader('expiry', 'Next expiry')}
              <th style={{ whiteSpace: 'nowrap' }}>Your role</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-4 text-muted">
                  {hasFilter ? 'No assurance sets match these filters.' : 'No assurance sets yet.'}
                </td>
              </tr>
            ) : (
              pagination.pageItems.map((row) => {
                const { set } = row;
                const covered = coveredLabel(set);
                return (
                  <tr key={set.id} data-set-id={set.id}>
                    <td>
                      {canOpenSet(set) ? (
                        <button
                          type="button"
                          className="btn btn-link p-0 text-start fw-semibold text-decoration-none"
                          onClick={() => onOpenSet(set)}
                        >
                          {set.title}
                        </button>
                      ) : (
                        <span className="fw-semibold text-dark">{set.title}</span>
                      )}
                      <div className="small text-muted">
                        <span className="font-mono-code">{set.id}</span>
                        {covered ? ` · ${covered}` : ''}
                      </div>
                      {!canOpenSet(set) && <span className="badge bg-light text-muted border">Read-only</span>}
                    </td>
                    <td title={row.reasons.join('; ') || undefined}>
                      {row.status ? (
                        <StatusBadge value={row.status} tone={STATUS_TONES[row.status]} />
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td style={{ minWidth: '9rem' }}>
                      <ReadinessGauge score={row.readiness} size="sm" />
                      <div className="mt-1">
                        <StatusBadge value={set.stage} />
                      </div>
                    </td>
                    <td className="small" style={{ whiteSpace: 'nowrap' }}>
                      {row.blockingItems === 0 && row.openFindings === 0 ? (
                        <span className="text-muted">None</span>
                      ) : (
                        <>
                          <div className={row.blockingItems > 0 ? 'text-danger fw-semibold' : 'text-muted'}>
                            {row.blockingItems} blocking
                          </div>
                          <div className={row.blockingFindings > 0 ? 'text-danger fw-semibold' : 'text-muted'}>
                            {row.openFindings} open {row.openFindings === 1 ? 'finding' : 'findings'}
                          </div>
                        </>
                      )}
                    </td>
                    <td className="small">
                      <DueCell
                        date={row.nextExpiry?.date}
                        isExpiry
                        expiryWarningDays={ASSURANCE_SET_STATUS_RULES.expirySoonDays}
                        today={today}
                      />
                      {row.nextExpiry && <div className="text-muted">{row.nextExpiry.label}</div>}
                    </td>
                    <td className="small">
                      {row.roles.length > 0 ? (
                        <div className="d-flex flex-wrap gap-1">
                          {row.roles.map((role) => (
                            <span key={role} className="badge bg-light text-dark border">
                              {ROLE_LABELS[role]}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                      {row.otherParties.length > 0 && (
                        <div className="text-muted mt-1">{row.otherParties.join(', ')}</div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <TablePagination {...pagination.controls} />
    </>
  );
};
