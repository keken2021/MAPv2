import React, { useState, useMemo } from 'react';
import { useMapStore } from '../store/useMapStore';
import { ReadinessGauge } from '../components/common/ReadinessGauge';
import { ConfidenceBadge } from '../components/common/ConfidenceBadge';
import { CountTabs, CountTab } from '../components/common/CountTabs';
import { StatusBadge } from '../components/common/StatusBadge';
import { ListToolbar } from '../components/common/ListToolbar';
import { formatMaritimeDate } from '../utils/formatters';
import { getDemoSessionContext, getRoleDisplayLabel, getSessionUserForPersona } from '../utils/userRoleHelpers';
import { isAssuranceSetAssignedToPersona } from '../utils/rbacHelpers';
import { deriveObjectVerification } from '../utils/documentVersionSnapshot';
import { getAssuranceSetObjects } from '../utils/assuranceTemplates';
import { ObjectVerificationBadge } from '../components/common/ObjectVerificationBadge';
import { canPerform } from '../utils/permissionHelpers';
import { MasterDocument } from '../types/document';
import { DocumentReviewDrawer } from '../components/drawers/DocumentReviewDrawer';
import { calculateAssuranceSetReadiness } from '../utils/readinessHelpers';
import { isComplianceDeadlineOverdue, toIsoLocalDate } from '../utils/validation';
import { AssuranceSet } from '../types/assurance';
import { Ship, Camera, ShieldCheck, ArrowUpDown, ArrowUp, ArrowDown, FileCheck, RotateCcw, XCircle, Eye } from 'lucide-react';
import { FilterModal } from '../components/common/FilterModal';
import { ActiveFilterChips, FilterChip } from '../components/common/ActiveFilterChips';
import { usePagination } from '../utils/usePagination';
import { Paginated, TablePagination } from '../components/common/TablePagination';

export type ApproverTabKey = 'needs-decision' | 'overdue' | 'approved' | 'returned' | 'all';

export const ApproverDashboardView: React.FC = () => {
  const {
    assuranceSets,
    setApproverDecision,
    denyRequirementByApprover,
    activePersona,
    vessels,
    documents,
    currentEntityId,
    setCurrentHashView,
    rolePermissionDefaults,
    userPermissionOverrides,
    users,
    customScopes,
    activeDemoOrganization,
    activeSessionUserId,
  } = useMapStore();

  const sessionUser = useMemo(
    () =>
      getSessionUserForPersona(
        activePersona,
        users,
        getDemoSessionContext({ activeDemoOrganization, activeSessionUserId }),
      ),
    [activePersona, users, activeDemoOrganization, activeSessionUserId],
  );

  const matchingUser = sessionUser ?? users.find((u) => u.roles.includes(activePersona)) ?? null;

  const canDecideRequirements = canPerform(
    rolePermissionDefaults,
    userPermissionOverrides,
    matchingUser,
    activePersona,
    'approval_decisions',
    'update',
    customScopes,
  );

  const canCertifyAssuranceSet = canPerform(
    rolePermissionDefaults,
    userPermissionOverrides,
    matchingUser,
    activePersona,
    'assurance_completion',
    'update',
    customScopes,
  );

  const canAccessApprovalGate = canPerform(
    rolePermissionDefaults,
    userPermissionOverrides,
    matchingUser,
    activePersona,
    'approval_gate',
    'read',
    customScopes,
  );

  const usesApproverAssignment =
    activePersona === 'Approver' || (activePersona === 'Verifier' && canAccessApprovalGate);

  const [activeTab, setActiveTab] = useState<ApproverTabKey>('needs-decision');
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('All');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [approverNotes, setApproverNotes] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [selectedDocForReview, setSelectedDocForReview] = useState<{ doc: MasterDocument; notes?: string } | null>(null);

  const handleResetFilters = () => {
    setStageFilter('All');
    setSearchTerm('');
  };

  const activeChips = useMemo<FilterChip[]>(() => {
    const chips: FilterChip[] = [];
    if (stageFilter !== 'All') {
      chips.push({
        id: 'stage',
        label: 'Stage',
        value: stageFilter,
        onRemove: () => setStageFilter('All'),
      });
    }
    return chips;
  }, [stageFilter]);

  const activeFilterCount = activeChips.length;

  type ReqSortField = 'category' | 'title' | 'ocrConfidence' | 'status';
  const [reqSortField, setReqSortField] = useState<ReqSortField>('category');
  const [reqSortDirection, setReqSortDirection] = useState<'asc' | 'desc'>('asc');

  type PipelineSortField = 'id' | 'title' | 'vesselName' | 'initiator' | 'due' | 'status';
  const [pipelineSortField, setPipelineSortField] = useState<PipelineSortField>('id');
  const [pipelineSortDirection, setPipelineSortDirection] = useState<'asc' | 'desc'>('asc');

  const renderSortIndicator = (currentField: string, field: string, direction: 'asc' | 'desc') => {
    if (currentField !== field) {
      return <ArrowUpDown size={14} className="text-muted ms-1 opacity-50 inline-block align-middle" />;
    }
    return direction === 'asc' ? (
      <ArrowUp size={14} className="text-primary ms-1 inline-block align-middle" />
    ) : (
      <ArrowDown size={14} className="text-primary ms-1 inline-block align-middle" />
    );
  };

  const handleReqSort = (field: ReqSortField) => {
    if (reqSortField === field) {
      setReqSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
    } else {
      setReqSortField(field);
      setReqSortDirection('asc');
    }
  };

  const handlePipelineSort = (field: PipelineSortField) => {
    if (pipelineSortField === field) {
      setPipelineSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
    } else {
      setPipelineSortField(field);
      setPipelineSortDirection('asc');
    }
  };

  /* filter assigned sets that are verified and awaiting approval */
  const assignedSets = assuranceSets.filter((s) => {
    const assignmentUser = activePersona === 'Approver' ? sessionUser : undefined;
    const isAssigned = usesApproverAssignment
      ? isAssuranceSetAssignedToPersona(s, 'Approver', activeDemoOrganization, assignmentUser) &&
        (!assignmentUser?.name || Boolean(s.assignedApprover?.toLowerCase().includes(assignmentUser.name.toLowerCase())))
      : isAssuranceSetAssignedToPersona(s, activePersona, activeDemoOrganization, assignmentUser);
    if (usesApproverAssignment) {
      const isVerificationReq = s.verificationRequired !== false;
      const isVerifiedAndReady =
        s.stage === 'Approval' ||
        s.stage === 'Approved' ||
        s.approverDecision !== 'Pending' ||
        !isVerificationReq ||
        (s.requirements.length > 0 &&
          s.requirements.every((r) => !r.isMandatory || r.verifierStatus === 'Verified' || r.isFulfilled));
      return isAssigned && isVerifiedAndReady;
    }
    return isAssigned;
  });

  /* active selected set from currentEntityId route parameter or state fallback */
  const selectedSet = currentEntityId
    ? assuranceSets.find((s) => s.id === currentEntityId)
    : undefined;

  /* check approval blocking logic: workflow requirements override verifier check if verificationRequired is false */
  const isVerificationRequired = selectedSet ? selectedSet.verificationRequired !== false : true;
  const isInspectionRequired = selectedSet ? Boolean(selectedSet.mandatoryInspectionRequired) : false;

  const unfulfilledMandatory = selectedSet
    ? selectedSet.requirements.filter((r) => {
      if (!r.isMandatory) return false;
      if (!isVerificationRequired) {
        /* verification overridden by workflow requirements */
        return false;
      }
      return !r.isFulfilled && r.verifierStatus !== 'Verified';
    })
    : [];

  const isInspectionBlocked = Boolean(isInspectionRequired && selectedSet && !selectedSet.inspectionCompleted);
  const isApprovalBlocked = unfulfilledMandatory.length > 0 || isInspectionBlocked;

  const handleDecision = (decision: 'Approved' | 'Returned for Correction' | 'Rejected') => {
    if (!selectedSet) return;

    if (decision === 'Approved' && isApprovalBlocked) {
      if (isInspectionBlocked) {
        setFeedbackMessage('Cannot approve: the mandatory inspection is not complete.');
      } else {
        setFeedbackMessage('Cannot approve: some mandatory requirements are not verified or have expired.');
      }
      return;
    }

    setApproverDecision(selectedSet.id, decision, approverNotes || `Executive Decision: ${decision}`);
    setFeedbackMessage(`Assurance Set ${selectedSet.id} updated to ${decision}.`);
    setApproverNotes('');
  };

  const isNeedsDecision = (s: AssuranceSet) => {
    if (s.stage === 'Approved' || s.stage === 'Certified' || s.stage === 'Cancelled') return false;
    if (s.approverDecision === 'Approved' || s.approverDecision === 'Returned for Correction' || s.approverDecision === 'Rejected') {
      return false;
    }
    return s.approverDecision === 'Pending' || s.stage === 'Approval';
  };

  const isOverdue = (s: AssuranceSet) => isComplianceDeadlineOverdue(s);
  const isApproved = (s: AssuranceSet) => s.approverDecision === 'Approved' || s.stage === 'Approved' || s.stage === 'Certified';
  const isReturned = (s: AssuranceSet) => s.approverDecision === 'Returned for Correction' || s.approverDecision === 'Rejected';

  const needsDecisionCount = useMemo(() => assignedSets.filter(isNeedsDecision).length, [assignedSets]);
  const overdueCount = useMemo(() => assignedSets.filter(isOverdue).length, [assignedSets]);
  const approvedCount = useMemo(() => assignedSets.filter(isApproved).length, [assignedSets]);
  const returnedCount = useMemo(() => assignedSets.filter(isReturned).length, [assignedSets]);
  const allCount = assignedSets.length;

  const tabs: CountTab[] = useMemo(() => [
    { key: 'needs-decision', label: 'Needs Decision', count: needsDecisionCount },
    { key: 'overdue', label: 'Overdue', count: overdueCount, tone: 'warn' },
    { key: 'approved', label: 'Approved', count: approvedCount },
    { key: 'returned', label: 'Returned', count: returnedCount },
    { key: 'all', label: 'All', count: allCount },
  ], [needsDecisionCount, overdueCount, approvedCount, returnedCount, allCount]);

  const handleExportCsv = () => {
    const headers = ['Set ID', 'Title', 'Vessel', 'IMO', 'Created By', 'Due', 'Decision'];
    const rows = sortedSets.map((s) => {
      const due = s.revisedCompletionDate || s.complianceDeadline || '';
      return [
        s.id,
        `"${(s.title || '').replace(/"/g, '""')}"`,
        `"${(s.vesselName || '').replace(/"/g, '""')}"`,
        s.imoNumber || '',
        `"${(s.assignedSubmitter || s.initiatorOrg || '').replace(/"/g, '""')}"`,
        due,
        s.approverDecision || s.stage,
      ].join(',');
    });
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `approver-queue-${toIsoLocalDate()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filteredSets = assignedSets.filter((set) => {
    if (activeTab === 'needs-decision' && !isNeedsDecision(set)) return false;
    if (activeTab === 'overdue' && !isOverdue(set)) return false;
    if (activeTab === 'approved' && !isApproved(set)) return false;
    if (activeTab === 'returned' && !isReturned(set)) return false;

    const matchesSearch =
      set.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      set.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      set.vesselName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      set.imoNumber.includes(searchTerm) ||
      (set.assignedSubmitter && set.assignedSubmitter.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStage = stageFilter === 'All' || set.stage === stageFilter;

    return matchesSearch && matchesStage;
  });

  const sortedSets = [...filteredSets].sort((a, b) => {
    let comp = 0;
    if (pipelineSortField === 'id') comp = a.id.localeCompare(b.id);
    else if (pipelineSortField === 'title') comp = a.title.localeCompare(b.title);
    else if (pipelineSortField === 'vesselName') comp = a.vesselName.localeCompare(b.vesselName);
    else if (pipelineSortField === 'initiator') comp = (a.assignedSubmitter || a.initiatorOrg || '').localeCompare(b.assignedSubmitter || b.initiatorOrg || '');
    else if (pipelineSortField === 'due') {
      const deadlineA = a.revisedCompletionDate || a.complianceDeadline || '';
      const deadlineB = b.revisedCompletionDate || b.complianceDeadline || '';
      comp = deadlineA.localeCompare(deadlineB);
    }
    else if (pipelineSortField === 'status') comp = (a.approverDecision || a.stage).localeCompare(b.approverDecision || b.stage);
    return pipelineSortDirection === 'asc' ? comp : -comp;
  });

  const setsPagination = usePagination(sortedSets, [activeTab, searchTerm, stageFilter, pipelineSortField, pipelineSortDirection]);

  /* render detail page if currentEntityId is present */
  if (selectedSet) {
    const vessel = vessels.find((v) => v.id === selectedSet.vesselId || v.name === selectedSet.vesselName);
    const isAlreadyApproved = selectedSet.stage === 'Approved' || selectedSet.approverDecision === 'Approved';

    return (
      <div className="d-flex flex-column gap-4">

        {/* top header banner for detail page */}
        <div className="d-flex flex-wrap align-items-center justify-between gap-3">
          <div>
            <h3 className="fw-bold mb-0 text-primary">{selectedSet.title}</h3>
            <span className="small text-secondary font-mono-code">
              {selectedSet.id} · {selectedSet.vesselName} (IMO {selectedSet.imoNumber})
            </span>
            <ObjectVerificationBadge
              verification={deriveObjectVerification(
                getAssuranceSetObjects(selectedSet)[0]?.id || selectedSet.vesselId,
                assuranceSets,
                selectedSet.clientOrg || selectedSet.charterer || activeDemoOrganization,
              )}
            />
          </div>
          <div className="d-flex align-items-center gap-2">
            <StatusBadge value={selectedSet.approverDecision || selectedSet.stage} />
          </div>
        </div>

        {/* two-column layout: first column assurance set information, second column readiness dial & certification controls vertical stack */}
        <div className="row g-4">
          {/* first column (left): information of the assurance set */}
          <div className="col-lg-6">
            <div className="d-flex flex-column gap-4">
              {/* Assurance Set Information & stakeholder role assignments card */}
              <div className="card map-card-custom p-4">
                <div className="text-uppercase font-mono-code fw-bold text-secondary mb-3 small">
                  Details
                </div>
                <div className="row g-3 font-mono-code small mb-3">
                  <div className="col-md-6 border-end pr-3">
                    <div className="text-secondary mb-1">Created By:</div>
                    <div className="fw-bold text-dark mb-2">{selectedSet.initiatorOrg}</div>

                    <div className="text-secondary mb-1">Role:</div>
                    <div className="fw-bold text-dark mb-2">{getRoleDisplayLabel(selectedSet.initiatorRole)}</div>

                    <div className="text-secondary mb-1">Contract Period:</div>
                    <div className="fw-bold text-dark">
                      {formatMaritimeDate(selectedSet.charterWindowStart)} - {formatMaritimeDate(selectedSet.charterWindowEnd)}
                    </div>
                  </div>

                  <div className="col-md-6 pl-3">
                    <div className="text-secondary mb-1">Vessel Type:</div>
                    <div className="fw-bold text-dark mb-2">
                      {vessel?.vesselType || 'Offshore Support Vessel'}
                    </div>

                    <div className="text-secondary mb-1">Class Society:</div>
                    <div className="fw-bold text-dark mb-2">
                      {vessel?.classificationSociety || 'DNV'}
                    </div>

                    <div className="text-secondary mb-1">Dynamic Positioning:</div>
                    <div className="fw-bold text-dark mb-2">{vessel?.dynamicPositioningClass || 'DP2'}</div>

                    <div className="text-secondary mb-1">Inspection:</div>
                    <div className="fw-bold text-dark">
                      {selectedSet.mandatoryInspectionRequired ? 'Required' : 'Not Required'}
                    </div>
                  </div>
                </div>

                <div className="border-top pt-3">
                  <div className="text-uppercase font-mono-code fw-bold text-secondary mb-2 small">
                    Stakeholders
                  </div>
                  <div className="row g-2">
                    <div className="col-md-3 col-6">
                      <div className="p-2 rounded bg-light border">
                        <div className="text-secondary small">Submitter</div>
                        <div className="fw-bold text-dark text-truncate small">{selectedSet.assignedSubmitter || 'Unassigned'}</div>
                      </div>
                    </div>
                    <div className="col-md-3 col-6">
                      <div className="p-2 rounded bg-light border">
                        <div className="text-secondary small">Verifier</div>
                        <div className="fw-bold text-dark text-truncate small">{selectedSet.assignedVerifier || 'Unassigned'}</div>
                      </div>
                    </div>
                    <div className="col-md-3 col-6">
                      <div className="p-2 rounded bg-light border">
                        <div className="text-secondary small">Inspector</div>
                        <div className="fw-bold text-dark text-truncate small">
                          {selectedSet.mandatoryInspectionRequired
                            ? (selectedSet.assignedInspector || 'Unassigned')
                            : 'N/A'}
                        </div>
                      </div>
                    </div>
                    <div className="col-md-3 col-6">
                      <div className="p-2 rounded bg-light border">
                        <div className="text-secondary small">Approver</div>
                        <div className="fw-bold text-dark text-truncate small">{selectedSet.assignedApprover || 'Unassigned'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* statutory requirements register table displaying verified documents only */}
              {(() => {
                const verifiedRequirements = selectedSet.requirements
                  .filter((req) => req.verifierStatus === 'Verified' || req.isFulfilled)
                  .sort((a, b) => {
                    let comp = 0;
                    if (reqSortField === 'category') {
                      comp = a.category.localeCompare(b.category);
                    } else if (reqSortField === 'title') {
                      comp = a.title.localeCompare(b.title);
                    } else if (reqSortField === 'ocrConfidence') {
                      const docA = documents.find((d) => d.id === a.documentId || (a.linkedDocumentId && d.id === a.linkedDocumentId));
                      const docB = documents.find((d) => d.id === b.documentId || (b.linkedDocumentId && d.id === b.linkedDocumentId));
                      const scoreA = a.ocrConfidence || docA?.ocrConfidence || 0;
                      const scoreB = b.ocrConfidence || docB?.ocrConfidence || 0;
                      comp = scoreA - scoreB;
                    } else if (reqSortField === 'status') {
                      const statusA = a.verifierStatus || (a.isFulfilled ? 'Verified' : 'Pending');
                      const statusB = b.verifierStatus || (b.isFulfilled ? 'Verified' : 'Pending');
                      comp = statusA.localeCompare(statusB);
                    }
                    return reqSortDirection === 'asc' ? comp : -comp;
                  });

                return (
                  <Paginated
                    items={verifiedRequirements}
                    resetKeys={[selectedSet.id, reqSortField, reqSortDirection]}
                  >
                    {(pageRequirements, paginationFooter) => (
                      <div className="card map-card-custom">
                        <div className="table-responsive">
                          <table className="table map-table-custom align-middle mb-0">
                            <thead>
                              <tr>
                                <th
                                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                                  onClick={() => handleReqSort('category')}
                                >
                                  Category {renderSortIndicator(reqSortField, 'category', reqSortDirection)}
                                </th>
                                <th
                                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                                  onClick={() => handleReqSort('title')}
                                >
                                  Requirement {renderSortIndicator(reqSortField, 'title', reqSortDirection)}
                                </th>
                                <th
                                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                                  onClick={() => handleReqSort('ocrConfidence')}
                                >
                                  OCR Confidence {renderSortIndicator(reqSortField, 'ocrConfidence', reqSortDirection)}
                                </th>
                                <th
                                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                                  onClick={() => handleReqSort('status')}
                                >
                                  Status {renderSortIndicator(reqSortField, 'status', reqSortDirection)}
                                </th>
                                <th className="text-end" style={{ whiteSpace: 'nowrap' }}>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {verifiedRequirements.length === 0 ? (
                                <tr>
                                  <td colSpan={5} className="text-center text-secondary py-4 font-mono-code">
                                    No verified documents yet.
                                  </td>
                                </tr>
                              ) : (
                                pageRequirements.map((req) => {
                                  const linkedDoc = documents.find((d) => d.id === req.documentId || (req.linkedDocumentId && d.id === req.linkedDocumentId));
                                  const hasAttachedDoc = Boolean(linkedDoc || req.documentId || req.linkedDocumentId);
                                  const effectiveOcr = hasAttachedDoc ? (req.ocrConfidence || linkedDoc?.ocrConfidence || 0) : 0;
                                  return (
                                    <tr key={req.id}>
                                      <td>
                                        <span className="badge bg-light text-dark border small">{req.category}</span>
                                      </td>
                                      <td className="fw-semibold text-dark">
                                        {req.title}
                                        {req.isMandatory && <span className="text-danger ms-1">*</span>}
                                      </td>
                                      <td>
                                        <ConfidenceBadge score={effectiveOcr} />
                                      </td>
                                      <td>
                                        <span className={`badge font-mono-code ${isAlreadyApproved ? 'bg-success text-white' : 'bg-info text-dark'}`}>
                                          {isAlreadyApproved ? 'Approved' : 'Verified'}
                                        </span>
                                      </td>
                                      <td className="text-end">
                                        <div className="d-flex align-items-center justify-content-end gap-1.5 flex-nowrap">
                                          {linkedDoc ? (
                                            <button
                                              type="button"
                                              className="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center p-0"
                                              style={{ width: '32px', height: '32px' }}
                                              onClick={() => setSelectedDocForReview({ doc: linkedDoc, notes: req.notes })}
                                              title="Review"
                                              aria-label="Review"
                                            >
                                              <FileCheck size={16} />
                                            </button>
                                          ) : (
                                            <span className="text-secondary small font-mono-code">No Document</span>
                                          )}
                                          {!isAlreadyApproved && canDecideRequirements && (
                                            <>
                                              <button
                                                type="button"
                                                className="btn btn-sm btn-outline-warning text-dark d-inline-flex align-items-center justify-content-center p-0"
                                                style={{ width: '32px', height: '32px' }}
                                                title="Return for correction"
                                                aria-label="Return for correction"
                                                onClick={() => {
                                                  const reason = window.prompt(`Reason for returning "${req.title}":`, approverNotes || 'Returned for correction by the approver.');
                                                  if (reason && reason.trim()) {
                                                    denyRequirementByApprover(selectedSet.id, req.id, 'Correction Requested', reason.trim());
                                                    setFeedbackMessage(`Requirement "${req.title}" returned for correction. Submitter has been pinged.`);
                                                  }
                                                }}
                                              >
                                                <RotateCcw size={16} />
                                              </button>
                                              <button
                                                type="button"
                                                className="btn btn-sm btn-outline-danger d-inline-flex align-items-center justify-content-center p-0"
                                                style={{ width: '32px', height: '32px' }}
                                                title="Reject"
                                                aria-label="Reject"
                                                onClick={() => {
                                                  const reason = window.prompt(`Reason for rejecting "${req.title}":`, approverNotes || 'Document does not meet the requirement.');
                                                  if (reason && reason.trim()) {
                                                    denyRequirementByApprover(selectedSet.id, req.id, 'Rejected', reason.trim());
                                                    setFeedbackMessage(`Requirement "${req.title}" rejected. Submitter has been pinged.`);
                                                  }
                                                }}
                                              >
                                                <XCircle size={16} />
                                              </button>
                                            </>
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
                        {paginationFooter}
                      </div>
                    )}
                  </Paginated>
                );
              })()}
            </div>
          </div>

          {/* second column (right): vertical stack containing executive readiness dial and certification controls */}
          <div className="col-lg-6">
            <div className="d-flex flex-column gap-4">
              {/* card 1: executive compliance readiness dial */}
              <div className="card map-card-custom p-4 text-center">
                <h5 className="fw-semibold mb-3 text-slate-900">Readiness</h5>
                <ReadinessGauge score={calculateAssuranceSetReadiness(selectedSet)} size="lg" />

                <div className="mt-4 p-3 bg-light border border-secondary rounded text-start small">
                  <h6 className="fw-bold text-uppercase text-secondary mb-2">
                    Approval Checks
                  </h6>
                  {isApprovalBlocked ? (
                    <div className="text-danger fw-semibold">
                      {unfulfilledMandatory.length > 0 ? (
                        <span>{unfulfilledMandatory.length} mandatory requirement(s) not verified or expired.</span>
                      ) : (
                        <span>The mandatory inspection is not complete.</span>
                      )}
                    </div>
                  ) : selectedSet?.verificationRequired === false ? (
                    <div className="text-success fw-semibold">
                      Verification is not required for this set. Ready for approval.
                    </div>
                  ) : (
                    <div className="text-success fw-semibold">
                      Ready for approval.
                    </div>
                  )}
                </div>
              </div>

              {/* card 2: charter certification controls */}
              <div className="card map-card-custom p-4">
                <h5 className="fw-semibold mb-3 text-slate-900">Decision</h5>

                {feedbackMessage && (
                  <div className="alert alert-info py-2 small mb-3">{feedbackMessage}</div>
                )}

                <div className="mb-3">
                  <label className="form-label text-secondary small fw-semibold" htmlFor="approver-notes">
                    Notes:
                  </label>
                  <textarea
                    id="approver-notes"
                    className="form-control form-control-sm bg-white text-dark border-secondary"
                    rows={3}
                    placeholder={
                      canCertifyAssuranceSet
                        ? isAlreadyApproved
                          ? 'Approved. Notes are locked.'
                          : 'Add notes for your decision'
                        : 'Read-only'
                    }
                    value={approverNotes}
                    onChange={(e) => setApproverNotes(e.target.value)}
                    disabled={!canCertifyAssuranceSet || isAlreadyApproved}
                  />
                </div>

                {canCertifyAssuranceSet && (
                  isAlreadyApproved ? (
                    <div className="alert alert-success py-2.5 px-3 small font-mono-code fw-semibold mb-0">
                      This assurance set is already approved.
                    </div>
                  ) : (
                    <div className="d-flex flex-column gap-2">
                      <button
                        type="button"
                        className="btn btn-success text-white py-2 fw-semibold"
                        onClick={() => handleDecision('Approved')}
                        disabled={isApprovalBlocked}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="btn btn-warning text-dark py-2 fw-semibold"
                        onClick={() => handleDecision('Returned for Correction')}
                      >
                        Return for Correction
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger text-white py-2 fw-semibold"
                        onClick={() => handleDecision('Rejected')}
                      >
                        Reject
                      </button>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </div>

        {/* reference photo lightbox modal */}
        {isLightboxOpen && (
          <div className="map-photo-lightbox-backdrop" onClick={() => setIsLightboxOpen(false)}>
            <div className="map-photo-lightbox-content" onClick={(e) => e.stopPropagation()}>
              <div className="p-3 border-bottom d-flex align-items-center justify-between">
                <h6 className="fw-bold mb-0 text-dark">
                  Photo — {selectedSet.vesselName}
                </h6>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setIsLightboxOpen(false)}
                />
              </div>
              <div className="p-8 bg-slate-900 text-center rounded-b flex flex-col items-center justify-center min-h-[300px] border border-slate-800">
                <div className="relative mb-4 flex items-center justify-center w-24 h-24 rounded-2xl bg-slate-800/80 border border-slate-700 shadow-inner">
                  <Ship className="w-12 h-12 text-sky-400" />
                  <div className="absolute -bottom-2 -right-2 p-1.5 bg-sky-500 rounded-full text-white shadow">
                    <Camera className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-xl font-bold font-mono text-white tracking-wide mb-1">
                  {selectedSet.vesselName.toUpperCase()}
                </div>
                <div className="text-xs text-slate-400 font-mono flex items-center gap-2">
                  <span>IMO {selectedSet.imoNumber}</span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1 text-emerald-400">
                    <ShieldCheck className="w-3.5 h-3.5" /> VERIFIED PHOTO
                  </span>
                </div>
              </div>
              <div className="p-3 bg-light border-top d-flex align-items-center justify-between">
                <span />
                <button
                  type="button"
                  className="btn btn-sm btn-secondary font-mono-code"
                  onClick={() => setIsLightboxOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* document review drawer */}
        <DocumentReviewDrawer
          document={selectedDocForReview?.doc || null}
          requirementNotes={selectedDocForReview?.notes}
          onClose={() => setSelectedDocForReview(null)}
        />
      </div>
    );
  }

  /* render main approval requests list table view */
  return (
    <div className="d-flex flex-column gap-4">
      {/* main approval requests table card */}
      <div className="card map-card-custom">
        <div className="p-3 border-bottom">
          <CountTabs
            tabs={tabs}
            active={activeTab}
            onChange={(key) => setActiveTab(key as ApproverTabKey)}
            aria-label="Approver queue tabs"
          />
        </div>

        <ListToolbar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Search assurance sets..."
          onFilterClick={() => setIsFilterModalOpen(true)}
          activeFilterCount={activeFilterCount}
          onExportCsv={handleExportCsv}
        />

        {activeChips.length > 0 && (
          <div className="px-3 py-2 bg-white border-bottom">
            <ActiveFilterChips chips={activeChips} onClearAll={handleResetFilters} />
          </div>
        )}

        <div className="table-responsive">
          <table className="table map-table-custom align-middle mb-0">
            <thead>
              <tr>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => handlePipelineSort('id')}
                >
                  Set ID {renderSortIndicator(pipelineSortField, 'id', pipelineSortDirection)}
                </th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => handlePipelineSort('title')}
                >
                  Title {renderSortIndicator(pipelineSortField, 'title', pipelineSortDirection)}
                </th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => handlePipelineSort('vesselName')}
                >
                  Vessel {renderSortIndicator(pipelineSortField, 'vesselName', pipelineSortDirection)}
                </th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => handlePipelineSort('initiator')}
                >
                  Created By {renderSortIndicator(pipelineSortField, 'initiator', pipelineSortDirection)}
                </th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => handlePipelineSort('due')}
                >
                  Due {renderSortIndicator(pipelineSortField, 'due', pipelineSortDirection)}
                </th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => handlePipelineSort('status')}
                >
                  Decision {renderSortIndicator(pipelineSortField, 'status', pipelineSortDirection)}
                </th>
                <th className="text-end" style={{ whiteSpace: 'nowrap' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedSets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-4 text-secondary font-mono-code">
                    No approval requests found.
                  </td>
                </tr>
              ) : (
                setsPagination.pageItems.map((set) => {
                  const effectiveDeadline = set.revisedCompletionDate || set.complianceDeadline;
                  const overdue = isComplianceDeadlineOverdue(set);
                  let daysLate = 0;
                  if (overdue && effectiveDeadline) {
                    const deadlineMs = new Date(effectiveDeadline).getTime();
                    const nowMs = new Date(toIsoLocalDate()).getTime();
                    const diff = Math.round((nowMs - deadlineMs) / (1000 * 60 * 60 * 24));
                    daysLate = Math.max(1, diff);
                  }

                  return (
                    <tr
                      key={set.id}
                      className="map-approval-table-row"
                      onClick={() => setCurrentHashView('approver', set.id)}
                    >
                      <td>
                        <span className="fw-bold text-primary font-mono-code">{set.id}</span>
                      </td>
                      <td className="fw-semibold text-dark">{set.title}</td>
                      <td>
                        <div className="fw-semibold text-dark">{set.vesselName}</div>
                        <div className="text-secondary small font-mono-code">IMO {set.imoNumber}</div>
                      </td>
                      <td className="small font-mono-code text-secondary">
                        {set.assignedSubmitter || set.initiatorOrg}
                      </td>
                      <td className="font-mono-code small due-cell">
                        {overdue ? (
                          <span className="text-danger fw-semibold">
                            {daysLate} {daysLate === 1 ? 'day' : 'days'} late
                          </span>
                        ) : effectiveDeadline ? (
                          <span className="text-secondary">
                            {formatMaritimeDate(effectiveDeadline)}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td>
                        <StatusBadge value={set.approverDecision || set.stage} />
                      </td>
                      <td className="text-end" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center p-0"
                          style={{ width: '32px', height: '32px' }}
                          onClick={() => setCurrentHashView('approver', set.id)}
                          title="View"
                          aria-label="View"
                        >
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <TablePagination {...setsPagination.controls} />
      </div>

      {/* Dedicated Filter Modal */}
      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        onReset={handleResetFilters}
        title="Filters"
        activeCount={activeFilterCount}
      >
        <div className="d-flex flex-column gap-3">
          {/* Stage Filter */}
          <div>
            <label className="form-label text-secondary fw-semibold small mb-1" style={{ fontSize: '0.8rem' }}>
              Stage
            </label>
            <select
              className="form-select form-select-sm bg-white text-dark font-sans"
              style={{ borderColor: '#E2E8F0', fontSize: '0.84rem' }}
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
            >
              <option value="All">All Stages</option>
              <option value="Initiated">Initiated</option>
              <option value="Validation">Validation</option>
              <option value="Verification">Verification</option>
              <option value="Approval">Approval</option>
              <option value="Approved">Approved</option>
            </select>
          </div>
        </div>
      </FilterModal>
    </div>
  );
};
