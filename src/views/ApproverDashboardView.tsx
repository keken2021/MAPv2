/* 
  file summary: executive approval gate view presenting approval requests table and deep-dive approval detail page.
  responsibilities: renders assigned vetting campaigns in a responsive table, displays 2-column assurance set information with vertically stacked executive readiness dial and certification controls, and enforces sign-off blocking logic.
  role in system: primary operational workspace for Approvers (/approver and /approver/:setId).
*/

import React, { useState } from 'react';
import { useMapStore } from '../store/useMapStore';
import { ReadinessGauge } from '../components/common/ReadinessGauge';
import { ConfidenceBadge } from '../components/common/ConfidenceBadge';
import { formatMaritimeDate } from '../utils/formatters';
import { isAssuranceSetAssignedToPersona } from '../utils/rbacHelpers';
import { canPerform } from '../utils/permissionHelpers';
import { MasterDocument } from '../types/document';
import { DocumentReviewDrawer } from '../components/drawers/DocumentReviewDrawer';
import { calculateAssuranceSetReadiness } from '../utils/readinessHelpers';
import { Ship, Camera, ShieldCheck, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

/**
  what: renders approval requests table list view or approval detail page.
  how: checks store currentEntityId to switch between table list and 2-column detail page with stacked readiness dial and controls.
  with what file: src/views/ApproverDashboardView.tsx loaded by App.tsx.
*/
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
  } = useMapStore();

  const matchingUser = users.find((u) => u.roles.includes(activePersona)) ?? null;

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

  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('All');
  const [approverNotes, setApproverNotes] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [selectedDocForReview, setSelectedDocForReview] = useState<{ doc: MasterDocument; notes?: string } | null>(null);

  type ReqSortField = 'category' | 'title' | 'ocrConfidence' | 'status';
  const [reqSortField, setReqSortField] = useState<ReqSortField>('category');
  const [reqSortDirection, setReqSortDirection] = useState<'asc' | 'desc'>('asc');

  type PipelineSortField = 'id' | 'title' | 'vesselName' | 'initiator' | 'status';
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
    const isAssigned = usesApproverAssignment
      ? isAssuranceSetAssignedToPersona(s, 'Approver')
      : isAssuranceSetAssignedToPersona(s, activePersona);
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
        setFeedbackMessage('Approval Blocked: Mandatory physical vessel inspection has not been completed.');
      } else {
        setFeedbackMessage('Approval Blocked: Mandatory statutory requirements remain unverified or expired.');
      }
      return;
    }

    setApproverDecision(selectedSet.id, decision, approverNotes || `Executive Decision: ${decision}`);
    setFeedbackMessage(`Assurance Set ${selectedSet.id} updated to ${decision}.`);
    setApproverNotes('');
  };

  /* filtered assurance sets for table view */
  const filteredSets = assignedSets.filter((set) => {
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
    else if (pipelineSortField === 'status') comp = (a.approverDecision || a.stage).localeCompare(b.approverDecision || b.stage);
    return pipelineSortDirection === 'asc' ? comp : -comp;
  });

  /* calculation of top summary stats */
  const totalCampaigns = assignedSets.length;
  const pendingApprovals = assignedSets.filter((s) => s.approverDecision === 'Pending' || s.stage === 'Approval').length;
  const approvedCount = assignedSets.filter((s) => s.approverDecision === 'Approved' || s.stage === 'Approved').length;
  const returnedCount = assignedSets.filter((s) => s.approverDecision === 'Returned for Correction' || s.approverDecision === 'Rejected').length;

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
          </div>
          <div className="d-flex align-items-center gap-2">
            <span className="badge bg-light text-dark border font-mono-code">
              Stage: {selectedSet.stage}
            </span>
            {selectedSet.approverDecision && (
              <span
                className={`badge font-mono-code ${selectedSet.approverDecision === 'Approved'
                  ? 'bg-success text-white'
                  : selectedSet.approverDecision === 'Returned for Correction'
                    ? 'bg-warning text-dark'
                    : 'bg-danger text-white'
                  }`}
              >
                {selectedSet.approverDecision}
              </span>
            )}
          </div>
        </div>

        {/* two-column layout: first column assurance set information, second column readiness dial & certification controls vertical stack */}
        <div className="row g-4">
          {/* first column (left): information of the assurance set */}
          <div className="col-lg-6">
            <div className="d-flex flex-column gap-4">
              {/* campaign Information & stakeholder role assignments card */}
              <div className="card map-card-custom p-4">
                <div className="text-uppercase font-mono-code fw-bold text-secondary mb-3 small">
                  Campaign Information & Stakeholders — {selectedSet.id}
                </div>
                <div className="row g-3 font-mono-code small mb-3">
                  <div className="col-md-6 border-end pr-3">
                    <div className="text-secondary mb-1">Initiator Organisation:</div>
                    <div className="fw-bold text-dark mb-2">{selectedSet.initiatorOrg}</div>

                    <div className="text-secondary mb-1">Initiator Role:</div>
                    <div className="fw-bold text-dark mb-2">{selectedSet.initiatorRole}</div>

                    <div className="text-secondary mb-1">Charter Window:</div>
                    <div className="fw-bold text-dark">
                      {formatMaritimeDate(selectedSet.charterWindowStart)} - {formatMaritimeDate(selectedSet.charterWindowEnd)}
                    </div>
                  </div>

                  <div className="col-md-6 pl-3">
                    <div className="text-secondary mb-1">Vessel Type & Classification:</div>
                    <div className="fw-bold text-dark mb-2">
                      {vessel?.vesselType || 'Offshore Support Vessel'} ({vessel?.classificationSociety || 'DNV'})
                    </div>

                    <div className="text-secondary mb-1">Dynamic Positioning:</div>
                    <div className="fw-bold text-dark mb-2">{vessel?.dynamicPositioningClass || 'DP2'}</div>

                    <div className="text-secondary mb-1">Mandatory Inspection:</div>
                    <div className="fw-bold text-dark">
                      {selectedSet.mandatoryInspectionRequired ? 'Required & Verified' : 'Not Required'}
                    </div>
                  </div>
                </div>

                <div className="border-top pt-3">
                  <div className="text-uppercase font-mono-code fw-bold text-secondary mb-2 small">
                    Stakeholder Role Assignments
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
                              Requirement Title {renderSortIndicator(reqSortField, 'title', reqSortDirection)}
                            </th>
                            <th
                              style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                              onClick={() => handleReqSort('ocrConfidence')}
                            >
                              OCR Conf {renderSortIndicator(reqSortField, 'ocrConfidence', reqSortDirection)}
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
                                No verified documents available for executive approval yet.
                              </td>
                            </tr>
                          ) : (
                            verifiedRequirements.map((req) => {
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
                                          className="btn btn-sm btn-outline-primary font-mono-code"
                                          onClick={() => setSelectedDocForReview({ doc: linkedDoc, notes: req.notes })}
                                        >
                                          Review
                                        </button>
                                      ) : (
                                        <span className="text-secondary small font-mono-code">No Document</span>
                                      )}
                                      {!isAlreadyApproved && canDecideRequirements && (
                                        <>
                                          <button
                                            type="button"
                                            className="btn btn-sm btn-outline-warning text-dark font-mono-code"
                                            title="Return for Correction"
                                            onClick={() => {
                                              const reason = window.prompt(`Enter return reason for "${req.title}":`, approverNotes || 'Approver requested revision and correction.');
                                              if (reason && reason.trim()) {
                                                denyRequirementByApprover(selectedSet.id, req.id, 'Correction Requested', reason.trim());
                                                setFeedbackMessage(`Requirement "${req.title}" returned for correction. Submitter has been pinged.`);
                                              }
                                            }}
                                          >
                                            Return
                                          </button>
                                          <button
                                            type="button"
                                            className="btn btn-sm btn-outline-danger font-mono-code"
                                            title="Reject Document"
                                            onClick={() => {
                                              const reason = window.prompt(`Enter rejection reason for "${req.title}":`, approverNotes || 'Document does not satisfy executive statutory criteria.');
                                              if (reason && reason.trim()) {
                                                denyRequirementByApprover(selectedSet.id, req.id, 'Rejected', reason.trim());
                                                setFeedbackMessage(`Requirement "${req.title}" rejected. Submitter has been pinged.`);
                                              }
                                            }}
                                          >
                                            Reject
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
                  </div>
                );
              })()}
            </div>
          </div>

          {/* second column (right): vertical stack containing executive readiness dial and certification controls */}
          <div className="col-lg-6">
            <div className="d-flex flex-column gap-4">
              {/* card 1: executive compliance readiness dial */}
              <div className="card map-card-custom p-4 text-center">
                <h5 className="fw-semibold mb-3 text-slate-900">Executive Compliance Readiness Dial</h5>
                <ReadinessGauge score={calculateAssuranceSetReadiness(selectedSet)} size="lg" />

                <div className="mt-4 p-3 bg-light border border-secondary rounded text-start small">
                  <h6 className="fw-bold text-uppercase text-secondary mb-2">
                    Approval Blocking Rule Engine Status
                  </h6>
                  {isApprovalBlocked ? (
                    <div className="text-danger fw-semibold">
                      {unfulfilledMandatory.length > 0 ? (
                        <span>{unfulfilledMandatory.length} mandatory requirement(s) pending verification or expired.</span>
                      ) : (
                        <span>Mandatory physical vessel inspection is pending completion.</span>
                      )}
                    </div>
                  ) : selectedSet?.verificationRequired === false ? (
                    <div className="text-success fw-semibold">
                      Mandatory verification bypassed by workflow configuration. Ready for final certification sign-off.
                    </div>
                  ) : (
                    <div className="text-success fw-semibold">
                      Ready for final certification sign-off.
                    </div>
                  )}
                </div>
              </div>

              {/* card 2: charter certification controls */}
              <div className="card map-card-custom p-4">
                <h5 className="fw-semibold mb-3 text-slate-900">Charter Certification Controls</h5>

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
                          ? 'Assurance set approved. Decision notes locked.'
                          : 'Enter justification notes or return feedback...'
                        : 'Read-only view for non-approver personas...'
                    }
                    value={approverNotes}
                    onChange={(e) => setApproverNotes(e.target.value)}
                    disabled={!canCertifyAssuranceSet || isAlreadyApproved}
                  />
                </div>

                {canCertifyAssuranceSet && (
                  isAlreadyApproved ? (
                    <div className="alert alert-success py-2.5 px-3 small font-mono-code fw-semibold mb-0 d-flex align-items-center gap-2">
                      <span className="badge bg-success text-white font-mono-code">Approved</span>
                      <span>Assurance set and verified documents have already been approved and certified.</span>
                    </div>
                  ) : (
                    <div className="d-flex flex-column gap-2">
                      <button
                        type="button"
                        className="btn btn-success text-white py-2 fw-semibold"
                        onClick={() => handleDecision('Approved')}
                        disabled={isApprovalBlocked}
                      >
                        Approve Charter Readiness
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
                        Reject Assurance Set
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
                  High-Resolution Reference Photo — {selectedSet.vesselName} ({selectedSet.id})
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
                    <ShieldCheck className="w-3.5 h-3.5" /> STATUTORY VERIFIED ASSET PHOTO
                  </span>
                </div>
              </div>
              <div className="p-3 bg-light border-top d-flex align-items-center justify-between">
                <span className="small text-secondary font-mono-code">
                  Resolution: 1920x1080 HD · Verification Seal: AMSA Marine Audit Division
                </span>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary font-mono-code"
                  onClick={() => setIsLightboxOpen(false)}
                >
                  Close Photo Preview
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
      {/* top statistics summary row */}
      <div className="row g-3">
        <div className="col-md-3 col-6">
          <div className="card map-kpi-card shadow-2xs">
            <div className="map-kpi-label">
              Total Approval Requests
            </div>
            <div className="map-kpi-value text-primary mt-1">{totalCampaigns}</div>
            <div className="map-kpi-subtitle mt-1">Assigned Campaigns</div>
          </div>
        </div>
        <div className="col-md-3 col-6">
          <div className="card map-kpi-card shadow-2xs">
            <div className="map-kpi-label">
              Pending Sign-off
            </div>
            <div className="map-kpi-value text-warning mt-1">{pendingApprovals}</div>
            <div className="map-kpi-subtitle mt-1">Awaiting Final Decision</div>
          </div>
        </div>
        <div className="col-md-3 col-6">
          <div className="card map-kpi-card shadow-2xs">
            <div className="map-kpi-label">
              Approved &amp; Certified
            </div>
            <div className="map-kpi-value text-success mt-1">{approvedCount}</div>
            <div className="map-kpi-subtitle mt-1">Issued Assurance Certificates</div>
          </div>
        </div>
        <div className="col-md-3 col-6">
          <div className="card map-kpi-card shadow-2xs">
            <div className="map-kpi-label">
              Returned / Rejected
            </div>
            <div className="map-kpi-value text-danger mt-1">{returnedCount}</div>
            <div className="map-kpi-subtitle mt-1">Sent Back for Correction</div>
          </div>
        </div>
      </div>

      {/* main approval requests table card */}
      <div className="card map-card-custom">
        <div className="card-header d-flex flex-wrap align-items-center justify-between gap-3">
          {/* filter controls inline row */}
          <div className="d-flex align-items-center gap-2 flex-nowrap">
            <input
              type="text"
              className="form-control form-control-sm font-mono-code"
              style={{ width: '260px' }}
              placeholder="Search ID, Vessel, Submitter..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select
              className="form-select form-select-sm font-mono-code"
              style={{ width: '190px' }}
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

        <div className="table-responsive">
          <table className="table map-table-custom align-middle mb-0">
            <thead>
              <tr>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => handlePipelineSort('id')}
                >
                  Assurance Set ID {renderSortIndicator(pipelineSortField, 'id', pipelineSortDirection)}
                </th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => handlePipelineSort('title')}
                >
                  Campaign Title {renderSortIndicator(pipelineSortField, 'title', pipelineSortDirection)}
                </th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => handlePipelineSort('vesselName')}
                >
                  Vessel Name & IMO {renderSortIndicator(pipelineSortField, 'vesselName', pipelineSortDirection)}
                </th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => handlePipelineSort('initiator')}
                >
                  Initiator / Submitter {renderSortIndicator(pipelineSortField, 'initiator', pipelineSortDirection)}
                </th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => handlePipelineSort('status')}
                >
                  Sign-off Status {renderSortIndicator(pipelineSortField, 'status', pipelineSortDirection)}
                </th>
                <th className="text-end" style={{ whiteSpace: 'nowrap' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedSets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-4 text-secondary font-mono-code">
                    No matching approval requests found.
                  </td>
                </tr>
              ) : (
                sortedSets.map((set) => {
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
                      <td>
                        {set.approverDecision === 'Approved' ? (
                          <span className="badge bg-success text-white font-mono-code">Approved</span>
                        ) : set.approverDecision === 'Returned for Correction' ? (
                          <span className="badge bg-warning text-dark font-mono-code">Correction</span>
                        ) : set.approverDecision === 'Rejected' ? (
                          <span className="badge bg-danger text-white font-mono-code">Rejected</span>
                        ) : (
                          <span className="badge bg-info text-dark font-mono-code">Pending</span>
                        )}
                      </td>
                      <td className="text-end" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="btn btn-sm btn-primary text-white font-mono-code"
                          onClick={() => setCurrentHashView('approver', set.id)}
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
