/*
  file summary: Overview briefing tab for ProjectDetailView.tsx showing Overall Project Readiness, delivery efficiency metrics, active bottlenecks, and participating providers.
  responsibilities: computes Overall Project Readiness and linked counts, renders the 4 efficiency KPI cards from valueMetrics.ts, highlights Conditional or No-go sets with late tasks or review bottlenecks, and lists participating Providers with Assurance Set counts and Readiness percentages.
  role in system: rendered by ProjectDetailView.tsx as the default Overview tab (ADR 0033, docs/GLOSSARY.md).
*/

import React, { useMemo } from 'react';
import { AlertTriangle, Eye } from 'lucide-react';
import type { AssuranceSet } from '../../types/assurance';
import type { CapaItem } from '../../types/capa';
import type { MasterDocument } from '../../types/document';
import type { Project } from '../../types/project';
import { getAssuranceSetStatus } from '../../utils/assuranceSetStatus';
import { getAssuranceSetObjects } from '../../utils/assuranceTemplates';
import { calculateProjectReadiness } from '../../utils/projectHelpers';
import { calculateAssuranceSetReadiness, isRequirementLate } from '../../utils/readinessHelpers';
import { usePagination } from '../../utils/usePagination';
import {
  averageDaysToClearance,
  countReusedDocuments,
  countReVerifications,
  countSubmissionAttempts,
} from '../../utils/valueMetrics';
import { ReadinessGauge } from '../common/ReadinessGauge';
import { StatusBadge } from '../common/StatusBadge';
import { TablePagination } from '../common/TablePagination';
import { isAssuranceSetAtRisk } from '../../config/thresholds';

interface ProjectOverviewTabProps {
  project: Project;
  sets: AssuranceSet[];
  allSets: AssuranceSet[];
  documents: MasterDocument[];
  capaItems: CapaItem[];
  canOpenSet: (set: AssuranceSet) => boolean;
  onOpenSet: (set: AssuranceSet) => void;
}

interface ProviderSummaryRow {
  provider: string;
  setCount: number;
  readiness: number;
  statusLabel: string;
  primarySet?: AssuranceSet;
}

/**
  what: renders the executive Overview briefing panel for a project.
  how: aggregates turnaround days, submission attempts, reused documents, and re-verifications avoided from valueMetrics.ts, identifies bottleneck sets with late tasks or review holds, and summarizes participating Providers with Readiness scores.
  with what file: src/components/projects/ProjectOverviewTab.tsx used by ProjectDetailView.tsx.
*/
export const ProjectOverviewTab: React.FC<ProjectOverviewTabProps> = ({
  project,
  sets,
  allSets,
  documents,
  capaItems,
  canOpenSet,
  onOpenSet,
}) => {
  const projectReadiness = useMemo(
    () => calculateProjectReadiness(project, allSets),
    [project, allSets],
  );
  const avgTurnaround = useMemo(() => averageDaysToClearance(sets), [sets]);
  const submissionAttempts = useMemo(() => countSubmissionAttempts(sets), [sets]);
  const reusedDocs = useMemo(() => countReusedDocuments(sets), [sets]);
  const reVerificationsAvoided = useMemo(
    () => Math.max(countReVerifications(sets), reusedDocs),
    [sets, reusedDocs],
  );

  const bottleneckSets = useMemo(() => {
    const now = new Date();
    return sets
      .map((set) => {
        const statusResult = getAssuranceSetStatus(set, documents, capaItems, now);
        const lateTaskCount = (set.requirements ?? []).filter(
          (req) => req.isMandatory && !req.exemption && isRequirementLate(req, now),
        ).length;
        const inReviewStage =
          set.stage === 'Verification' ||
          set.stage === 'Inspection' ||
          set.stage === 'Approval' ||
          set.stage === 'Validation';
        const isBottleneck =
          statusResult.status === 'No-go' ||
          (statusResult.status === 'Conditional' &&
            (lateTaskCount > 0 || statusResult.blockingItems > 0 || inReviewStage));
        return {
          set,
          status: statusResult.status,
          lateTaskCount,
          reasons: statusResult.reasons,
          isBottleneck,
        };
      })
      .filter((item) => item.isBottleneck);
  }, [sets, documents, capaItems]);

  const providerRows = useMemo<ProviderSummaryRow[]>(() => {
    const setsByProvider = new Map<string, AssuranceSet[]>();
    const addProviderSet = (org: string | undefined, set: AssuranceSet) => {
      const trimmed = org?.trim();
      if (!trimmed) return;
      if (!setsByProvider.has(trimmed)) setsByProvider.set(trimmed, []);
      const existing = setsByProvider.get(trimmed)!;
      if (!existing.some((s) => s.id === set.id)) {
        existing.push(set);
      }
    };

    sets.forEach((set) => {
      addProviderSet(set.serviceProviderOrg, set);
      getAssuranceSetObjects(set).forEach((obj) => addProviderSet(obj.ownerOrganization, set));
      (set.parties ?? [])
        .filter((p) => p.group === 'Vendor')
        .forEach((p) => addProviderSet(p.organization, set));
    });

    if (setsByProvider.size === 0 && project.serviceProvider) {
      setsByProvider.set(project.serviceProvider, sets);
    }

    return [...setsByProvider.entries()].map(([provider, providerSets]) => {
      const readinessScores = providerSets.map((s) => calculateAssuranceSetReadiness(s, allSets));
      const avgReadiness =
        readinessScores.length > 0
          ? Math.round(readinessScores.reduce((a, b) => a + b, 0) / readinessScores.length)
          : 0;
      const statuses = providerSets.map((s) => getAssuranceSetStatus(s, documents, capaItems).status);
      const worstStatus = statuses.includes('No-go')
        ? 'No-go'
        : statuses.includes('Conditional')
          ? 'Conditional'
          : 'Go';
      return {
        provider,
        setCount: providerSets.length,
        readiness: avgReadiness,
        statusLabel: worstStatus,
        primarySet: providerSets[0],
      };
    });
  }, [sets, allSets, documents, capaItems, project.serviceProvider]);

  const providerPagination = usePagination(providerRows, [project.id, sets.length]);

  const efficiencyTiles = [
    {
      id: 'turnaround-days',
      label: 'Turnaround Days',
      value: avgTurnaround !== undefined ? `${avgTurnaround}d` : '—',
      caption: 'Average days from review submission to approval lock',
    },
    {
      id: 'submission-attempts',
      label: 'Submission Attempts',
      value: String(submissionAttempts),
      caption: `Across ${sets.length} ${sets.length === 1 ? 'Assurance Set' : 'Assurance Sets'}`,
    },
    {
      id: 'reused-documents',
      label: 'Reused Documents',
      value: String(reusedDocs),
      caption: 'Evidence documents shared across multiple Assurance Sets',
    },
    {
      id: 'reverifications-avoided',
      label: 'Re-verifications Avoided',
      value: String(reVerificationsAvoided),
      caption: 'Repeated verification checks saved by shared Evidence',
    },
  ];

  return (
    <div className="d-flex flex-column gap-3" data-testid="project-overview-tab">
      <div className="card map-card-custom p-4" data-testid="project-overview-readiness">
        <div className="row g-3 align-items-center">
          <div className="col-12 col-md-5">
            <div className="text-secondary small fw-semibold mb-2">
              Overall Project Readiness
            </div>
            <ReadinessGauge score={projectReadiness} size="md" />
          </div>
          <div className="col-12 col-md-7">
            <div className="row g-3 ps-md-4">
              <div className="col-6 col-sm-4">
                <div className="text-secondary small fw-medium mb-1">Objects</div>
                <div className="fs-4 fw-bold text-dark font-mono-code">
                  {project.assetLinks.length}
                </div>
              </div>
              <div className="col-6 col-sm-4">
                <div className="text-secondary small fw-medium mb-1">Assurance Sets</div>
                <div className="fs-4 fw-bold text-dark font-mono-code">{sets.length}</div>
              </div>
              <div className="col-6 col-sm-4">
                <div className="text-secondary small fw-medium mb-1">Providers</div>
                <div className="fs-4 fw-bold text-dark font-mono-code">
                  {providerRows.length}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3" data-testid="project-efficiency-metrics">
        {efficiencyTiles.map((tile) => (
          <div key={tile.id} className="col-12 col-sm-6 col-xl-3">
            <div className="card map-card-custom p-4 h-100 d-flex flex-column justify-content-between">
              <div className="text-secondary small fw-semibold">{tile.label}</div>
              <div className="fs-3 fw-bold text-dark font-mono-code my-1">{tile.value}</div>
              <div className="text-muted small">{tile.caption}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card map-card-custom p-4" data-testid="project-active-bottlenecks">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div className="d-flex align-items-center gap-2">
            <AlertTriangle size={18} className="text-warning" />
            <h3 className="h6 fw-semibold mb-0 text-dark">Active Bottlenecks</h3>
          </div>
          <span className="font-mono-code small text-secondary">
            {bottleneckSets.length} {bottleneckSets.length === 1 ? 'Assurance Set' : 'Assurance Sets'}
          </span>
        </div>
        {bottleneckSets.length === 0 ? (
          <div className="text-muted small">
            No Assurance Sets have late Tasks or blocking review items.
          </div>
        ) : (
          <div className="d-flex flex-column gap-2">
            {bottleneckSets.map(({ set, status, lateTaskCount, reasons }) => (
              <div
                key={set.id}
                className="d-flex flex-wrap align-items-center justify-content-between gap-2 p-3 border rounded"
              >
                <div className="d-flex flex-column gap-1">
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <span className="font-mono-code fw-semibold text-primary small">{set.id}</span>
                    <span className="fw-semibold text-dark small">{set.title}</span>
                    {status && (
                      <StatusBadge
                        value={status}
                        tone={status === 'No-go' ? 'danger' : status === 'Conditional' ? 'warning' : 'success'}
                      />
                    )}
                    {isAssuranceSetAtRisk(set) && (
                      <StatusBadge value="At risk" tone="danger" />
                    )}
                  </div>
                  <div className="text-secondary small">
                    Stage: {set.stage}
                    {lateTaskCount > 0 && (
                      <span className="text-danger font-mono-code ms-2">
                        · {lateTaskCount} late {lateTaskCount === 1 ? 'Task' : 'Tasks'}
                      </span>
                    )}
                    {reasons.length > 0 && ` · ${reasons.join(' · ')}`}
                  </div>
                </div>
                {canOpenSet(set) && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center p-0"
                    style={{ width: '32px', height: '32px' }}
                    onClick={() => onOpenSet(set)}
                    title="View"
                    aria-label={`View ${set.id}`}
                  >
                    <Eye size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card map-card-custom" data-testid="project-participating-providers">
        <div className="p-4 border-bottom d-flex align-items-center justify-content-between">
          <h3 className="h6 fw-semibold mb-0 text-dark">Participating Providers</h3>
          <span className="font-mono-code small text-secondary">
            {providerRows.length} {providerRows.length === 1 ? 'Provider' : 'Providers'}
          </span>
        </div>
        <div className="table-responsive">
          <table className="table map-table-custom align-middle mb-0">
            <thead>
              <tr>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Assurance Sets</th>
                <th className="px-4 py-3">Readiness</th>
                <th className="px-4 py-3">Set Status</th>
                <th className="px-4 py-3 text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {providerRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-4 text-muted">
                    No participating Providers yet.
                  </td>
                </tr>
              ) : (
                providerPagination.pageItems.map((row) => (
                  <tr key={row.provider}>
                    <td className="px-4 py-3 fw-semibold text-dark">{row.provider}</td>
                    <td className="px-4 py-3 font-mono-code">{row.setCount}</td>
                    <td className="px-4 py-3" style={{ minWidth: '160px' }}>
                      <ReadinessGauge score={row.readiness} size="sm" />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        value={row.statusLabel}
                        tone={
                          row.statusLabel === 'No-go'
                            ? 'danger'
                            : row.statusLabel === 'Conditional'
                              ? 'warning'
                              : 'success'
                        }
                      />
                    </td>
                    <td className="px-4 py-3 text-end">
                      {row.primarySet && canOpenSet(row.primarySet) && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center p-0"
                          style={{ width: '32px', height: '32px' }}
                          onClick={() => onOpenSet(row.primarySet!)}
                          title="View"
                          aria-label={`View ${row.provider}`}
                        >
                          <Eye size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <TablePagination {...providerPagination.controls} />
      </div>
    </div>
  );
};
