/*
  file summary: status-first assurance set table of one project.
  responsibilities: shows whether each set is OK and what blocks it, worst first, with sorting, search, filter tabs with counts and pagination.
  role in system: body of the Assurance Sets tab in ProjectDetailView.tsx; the rule itself is in assuranceSetStatus.ts (ADR 0033).
*/

import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Search, X } from 'lucide-react';
import { ActiveFilterChips, FilterChip } from '../common/ActiveFilterChips';
import { CountTab, CountTabs } from '../common/CountTabs';
import { ReadinessGauge } from '../common/ReadinessGauge';
import { StatusBadge } from '../common/StatusBadge';
import { TablePagination } from '../common/TablePagination';
import type { AssuranceSet } from '../../types/assurance';
import type { CapaItem } from '../../types/capa';
import type { MasterDocument } from '../../types/document';
import {
  AssuranceSetAttention,
  compareAssuranceSetStage,
  compareWorstFirst,
  getAssuranceSetStatus,
} from '../../utils/assuranceSetStatus';
import { getAssuranceSetObjects } from '../../utils/assuranceTemplates';
import { calculateAssuranceSetReadiness } from '../../utils/readinessHelpers';
import { usePagination } from '../../utils/usePagination';

type SortField = 'name' | 'stage';
type AttentionFilter = 'all' | AssuranceSetAttention;

const ATTENTION_LABELS: Record<AssuranceSetAttention, string> = {
  needs_attention: 'Needs attention',
  on_track: 'On track',
  done: 'Done',
};

interface ProjectAssuranceStatusTableProps {
  sets: AssuranceSet[];
  /** every set in the app, so a linked set counts toward readiness */
  allSets: AssuranceSet[];
  documents: MasterDocument[];
  capaItems: CapaItem[];
  viewer?: { organization?: string; name?: string };
  canOpenSet: (set: AssuranceSet) => boolean;
  onOpenSet: (set: AssuranceSet) => void;
  today?: Date;
}

/**
  what: renders the assurance sets of a project around their status.
  how: reads each set once through assuranceSetStatus.ts, filters by status and search, sorts worst first or by the chosen column, and pages the result.
  with what file: src/components/tables/ProjectAssuranceStatusTable.tsx loaded by ProjectDetailView.tsx.
*/
export const ProjectAssuranceStatusTable: React.FC<ProjectAssuranceStatusTableProps> = ({
  sets,
  allSets,
  documents,
  capaItems,
  canOpenSet,
  onOpenSet,
  today,
}) => {
  const [attentionFilter, setAttentionFilter] = useState<AttentionFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const rows = useMemo(
    () =>
      sets.map((set) => ({
        set,
        ...getAssuranceSetStatus(set, documents, capaItems, today),
        readiness: calculateAssuranceSetReadiness(set, allSets),
      })),
    [sets, allSets, documents, capaItems, today],
  );

  type Row = (typeof rows)[number];

  const matchesAttention = (row: Row) => attentionFilter === 'all' || row.attention === attentionFilter;

  const matchesSearch = (row: Row) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.trim().toLowerCase();
    const { set } = row;
    const objectNames = getAssuranceSetObjects(set).map((o) => `${o.name} ${o.id}`).join(' ');
    const haystack = [
      set.title,
      set.id,
      set.stage,
      set.vesselName,
      set.serviceProviderOrg,
      set.clientOrg,
      set.initiatorOrg,
      objectNames,
      ...row.reasons,
      ...(set.requirements ?? []).map((r) => `${r.title} ${r.category}`),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  };

  const attentionTabs: CountTab[] = [
    { key: 'all', label: 'All', count: rows.length },
    ...(Object.keys(ATTENTION_LABELS) as AssuranceSetAttention[]).map((key) => ({
      key,
      label: ATTENTION_LABELS[key],
      count: rows.filter((row) => row.attention === key).length,
      tone: key === 'needs_attention' ? ('warn' as const) : undefined,
    })),
  ];

  const activeChips: FilterChip[] = [
    ...(attentionFilter !== 'all'
      ? [{ id: 'attention', label: 'Status', value: ATTENTION_LABELS[attentionFilter], onRemove: () => setAttentionFilter('all') }]
      : []),
    ...(searchTerm.trim()
      ? [{ id: 'search', label: 'Search', value: searchTerm.trim(), onRemove: () => setSearchTerm('') }]
      : []),
  ];

  const sortedRows = useMemo(() => {
    const direction = sortDirection === 'asc' ? 1 : -1;

    return rows
      .filter((r) => matchesAttention(r) && matchesSearch(r))
      .sort((a, b) => {
        if (sortField === 'name') return direction * a.set.title.localeCompare(b.set.title) || compareWorstFirst(a, b);
        if (sortField === 'stage') return direction * compareAssuranceSetStage(a.set.stage, b.set.stage) || compareWorstFirst(a, b);
        return compareWorstFirst(a, b);
      });
  }, [rows, attentionFilter, searchTerm, sortField, sortDirection]);

  const pagination = usePagination(sortedRows, [attentionFilter, searchTerm, sortField, sortDirection]);

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
      aria-sort={sortField === field ? (sortDirection === 'asc' ? 'descending' : 'ascending') : undefined}
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

  const hasFilter = attentionFilter !== 'all' || Boolean(searchTerm.trim());

  return (
    <>
      <div className="card-header d-flex flex-column gap-2 p-3">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
          <CountTabs
            tabs={attentionTabs}
            active={attentionFilter}
            onChange={(key) => setAttentionFilter(key as AttentionFilter)}
            aria-label="Filter by status"
          />
          <div
            className="position-relative"
            style={{ minWidth: '220px', maxWidth: '360px', flex: '1 1 auto' }}
          >
            <Search
              size={16}
              aria-hidden="true"
              className="position-absolute top-50 translate-middle-y text-muted"
              style={{ left: '12px', pointerEvents: 'none' }}
            />
            <input
              type="text"
              className="form-control form-control-sm"
              style={{
                paddingLeft: '36px',
                paddingRight: searchTerm ? '32px' : '12px',
                height: '36px',
                fontSize: '0.875rem',
              }}
              placeholder="Search assurance sets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search assurance sets"
            />
            {searchTerm && (
              <button
                type="button"
                className="btn btn-link btn-sm position-absolute top-50 translate-middle-y text-muted p-0"
                style={{ right: '10px', textDecoration: 'none' }}
                onClick={() => setSearchTerm('')}
                aria-label="Clear search"
              >
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
        {activeChips.length > 0 && (
          <ActiveFilterChips
            chips={activeChips}
            onClearAll={() => {
              setAttentionFilter('all');
              setSearchTerm('');
            }}
          />
        )}
      </div>
      <div className="table-responsive">
        <table className="table map-table-custom mb-0">
          <thead>
            <tr>
              {renderSortHeader('name', 'Assurance set')}
              {renderSortHeader('stage', 'Readiness')}
              <th style={{ whiteSpace: 'nowrap' }}>Blocking</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 ? (
              <tr>
                <td colSpan={3} className="text-center py-4 text-muted">
                  {hasFilter ? 'No assurance sets match these filters.' : 'No assurance sets yet.'}
                </td>
              </tr>
            ) : (
              pagination.pageItems.map((row) => {
                const { set } = row;
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
                      {!canOpenSet(set) && <span className="badge bg-light text-muted border ms-2">Read-only</span>}
                    </td>
                    <td style={{ minWidth: '9rem' }} title={row.reasons.join('; ') || undefined}>
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
