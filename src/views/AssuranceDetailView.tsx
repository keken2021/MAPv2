/* 
  file summary: assurance set command center deep-dive view presenting stage pipeline stepper and requirements register in light theme.
  responsibilities: manages requirement verification statuses, displays pipeline stage progress, and enforces C Admin read-only rules.
  role in system: deep-dive view rendered when an assurance set row is selected.
*/

import React, { useState, useMemo } from 'react';
import { useMapStore } from '../store/useMapStore';
import { PipelineStepper } from '../components/common/PipelineStepper';
import { ReadinessGauge } from '../components/common/ReadinessGauge';
import { ConfidenceBadge } from '../components/common/ConfidenceBadge';
import { DocumentReviewDrawer } from '../components/drawers/DocumentReviewDrawer';
import { formatMaritimeDate } from '../utils/formatters';
import { MasterDocument } from '../types/document';
import { AssuranceRequirement } from '../types/assurance';

import { VersionHistoryDrawer } from '../components/drawers/VersionHistoryDrawer';
import { exportToCsv, exportToPdf } from '../utils/exportHelpers';
import { DocumentUploadModal } from '../components/drawers/DocumentUploadModal';
import { userHasRole, getEligibleVerifiers } from '../utils/userRoleHelpers';
import { calculateAssuranceSetReadiness } from '../utils/readinessHelpers';

interface AssuranceDetailViewProps {
  setId: string;
}

/**
  what: renders assurance set command center deep-dive view in light theme.
  how: displays pipeline stepper header, requirement register table with export controls, and opens DocumentReviewDrawer, VersionHistoryDrawer, or DocumentUploadModal based on persona RBAC.
  with what file: src/views/AssuranceDetailView.tsx loaded by App.tsx.
*/
export const AssuranceDetailView: React.FC<AssuranceDetailViewProps> = ({ setId }) => {
  const {
    assuranceSets,
    vessels,
    updateRequirementStatus,
    updateAssuranceStakeholder,
    updateAssuranceInspector,
    documents,
    activePersona,
    users,
    setCurrentHashView,
  } = useMapStore();
  const [selectedDocForReview, setSelectedDocForReview] = useState<{ doc: MasterDocument; notes?: string } | null>(null);
  const [selectedDocForVersionHistory, setSelectedDocForVersionHistory] = useState<MasterDocument | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadTargetRequirement, setUploadTargetRequirement] = useState<AssuranceRequirement | null>(null);
  const [replaceExistingDoc, setReplaceExistingDoc] = useState<MasterDocument | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<'Submitter' | 'Verifier' | 'Inspector' | 'Approver' | null>(null);

  type ReqSortField = 'category' | 'title' | 'ocrConfidence' | 'status';
  const [reqSortField, setReqSortField] = useState<ReqSortField>('category');
  const [reqSortDirection, setReqSortDirection] = useState<'asc' | 'desc'>('asc');

  const renderSortIndicator = (field: ReqSortField) => {
    if (reqSortField !== field) return <span className="text-muted ms-1 small opacity-50">↕</span>;
    return <span className="text-primary ms-1 small fw-bold">{reqSortDirection === 'asc' ? '▲' : '▼'}</span>;
  };

  const handleReqSort = (field: ReqSortField) => {
    if (reqSortField === field) {
      setReqSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
    } else {
      setReqSortField(field);
      setReqSortDirection('asc');
    }
  };

  const assuranceSet = assuranceSets.find((s) => s.id === setId) || assuranceSets[0];

  const sortedRequirements = useMemo(() => {
    if (!assuranceSet?.requirements) return [];
    return [...assuranceSet.requirements].sort((a, b) => {
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
        const statusA = a.verifierStatus || (a.isFulfilled ? 'Verified' : 'Awaiting Upload');
        const statusB = b.verifierStatus || (b.isFulfilled ? 'Verified' : 'Awaiting Upload');
        comp = statusA.localeCompare(statusB);
      }
      return reqSortDirection === 'asc' ? comp : -comp;
    });
  }, [assuranceSet, reqSortField, reqSortDirection, documents]);

  if (!assuranceSet) return <div>Assurance Set not found.</div>;

  const isCAdmin = activePersona === 'C Admin';
  const canUpload = activePersona === 'Submitter' || activePersona === 'Administrator';

  const verifiedCount = assuranceSet.requirements.filter((r) => r.verifierStatus === 'Verified').length;
  const totalCount = assuranceSet.requirements.length;

  const renderRequirementStatus = (req: AssuranceRequirement) => {
    if (!req.documentId) {
      return (
        <span className="badge bg-secondary text-white font-mono-code px-2.5 py-1.5" style={{ fontSize: '0.75rem' }}>
          Awaiting Upload
        </span>
      );
    }
    const isSetApproved = assuranceSet.stage === 'Approved' || assuranceSet.approverDecision === 'Approved';

    if (req.verifierStatus === 'Verified' || req.isFulfilled) {
      if (isSetApproved) {
        return <span className="badge bg-success text-white font-mono-code px-2.5 py-1.5" style={{ fontSize: '0.75rem' }}>Approved</span>;
      }
      return <span className="badge bg-info text-dark font-mono-code px-2.5 py-1.5" style={{ fontSize: '0.75rem' }}>Verified</span>;
    }
    if (req.verifierStatus === 'Correction Requested') {
      return <span className="badge bg-warning text-dark font-mono-code px-2.5 py-1.5" style={{ fontSize: '0.75rem' }}>Correction Requested</span>;
    }
    if (req.verifierStatus === 'Rejected') {
      return <span className="badge bg-danger text-white font-mono-code px-2.5 py-1.5" style={{ fontSize: '0.75rem' }}>Rejected</span>;
    }
    const isInspectionDoc =
      (req.category as string).toLowerCase().includes('inspection') ||
      (req.category as string).toLowerCase().includes('audit') ||
      req.title.toLowerCase().includes('inspection') ||
      req.title.toLowerCase().includes('audit');

    if (isInspectionDoc) {
      return <span className="badge bg-warning text-dark font-mono-code px-2.5 py-1.5" style={{ fontSize: '0.75rem' }}>To Inspect</span>;
    }

    return (
      <span className="badge bg-primary text-white font-mono-code px-2.5 py-1.5" style={{ fontSize: '0.75rem' }}>
        Submitted
      </span>
    );
  };

  const closeUploadModal = () => {
    setIsUploadModalOpen(false);
    setUploadTargetRequirement(null);
    setReplaceExistingDoc(null);
  };

  const openRequirementUpload = (req: AssuranceRequirement, existingDoc?: MasterDocument) => {
    setUploadTargetRequirement(req);
    setReplaceExistingDoc(existingDoc || null);
    setIsUploadModalOpen(true);
  };

  const handleExportCsv = () => {
    const exportData = assuranceSet.requirements.map((req) => {
      const linkedDoc = documents.find((d) => d.id === req.documentId || (req.linkedDocumentId && d.id === req.linkedDocumentId));
      const hasAttachedDoc = Boolean(linkedDoc || req.documentId || req.linkedDocumentId);
      const effectiveOcr = hasAttachedDoc ? (req.ocrConfidence || linkedDoc?.ocrConfidence || 0) : 0;
      return {
        Category: req.category,
        RequirementTitle: req.title,
        OcrConfidence: `${effectiveOcr}%`,
        VerifierStatus: req.verifierStatus || (req.isFulfilled ? 'Approved' : 'Pending'),
        Notes: req.notes || '',
      };
    });
    exportToCsv(`${assuranceSet.id}_Requirements_Register`, exportData);
    setIsExportOpen(false);
  };

  const handleExportPdf = () => {
    const headers = ['Category', 'Requirement Title', 'OCR Conf', 'Status', 'Notes'];
    const rows = assuranceSet.requirements.map((req) => {
      const linkedDoc = documents.find((d) => d.id === req.documentId || (req.linkedDocumentId && d.id === req.linkedDocumentId));
      const hasAttachedDoc = Boolean(linkedDoc || req.documentId || req.linkedDocumentId);
      const effectiveOcr = hasAttachedDoc ? (req.ocrConfidence || linkedDoc?.ocrConfidence || 0) : 0;
      return [
        req.category,
        req.title,
        `${effectiveOcr}%`,
        req.verifierStatus || (req.isFulfilled ? 'Approved' : 'Pending'),
        req.notes || '-',
      ];
    });
    exportToPdf(`${assuranceSet.id} Statutory Requirements Register`, headers, rows);
    setIsExportOpen(false);
  };

  return (
    <div className="d-flex flex-column gap-4">

      {/* Top Row: Campaign Summary Information Card + Compact Stage Pipeline */}
      <div className="row g-4 align-items-stretch">
        {/* Left: Campaign Information & Stakeholder Role Assignments Card */}
        <div className="col-lg-8 col-md-7">
          <div className="card map-card-custom p-4 h-100">
            <div className="d-flex flex-wrap align-items-center justify-between gap-3 mb-3">
              <h3 className="fw-bold mb-0 text-primary">{assuranceSet.title}</h3>
              {/* Top header action controls: Use as Template button & Export Data dropdown */}
              <div className="d-flex align-items-center gap-2 ms-auto">
                {(isCAdmin || activePersona === 'Administrator') && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => setCurrentHashView('create-assurance-set', assuranceSet.id)}
                  >
                    Use as Template
                  </button>
                )}
                <div className="dropdown position-relative">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary text-dark dropdown-toggle"
                    onClick={() => setIsExportOpen(!isExportOpen)}
                  >
                    Export Data
                  </button>
                  {isExportOpen && (
                    <ul className="dropdown-menu dropdown-menu-light show position-absolute end-0 mt-1 shadow border" style={{ zIndex: 1050 }}>
                      <li>
                        <button type="button" className="dropdown-item small" onClick={handleExportCsv}>
                          Export as CSV (.csv)
                        </button>
                      </li>
                      <li>
                        <button type="button" className="dropdown-item small" onClick={handleExportPdf}>
                          Export as PDF (.pdf)
                        </button>
                      </li>
                    </ul>
                  )}
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-light border rounded-3 font-mono-code small">
              <div className="row g-4">
                {/* Campaign Information */}
                <div className="col-md-6 d-flex flex-column gap-2.5">
                  <div className="d-flex align-items-center justify-content-between mb-1">
                    <span className="text-uppercase fw-bold text-secondary" style={{ fontSize: '0.725rem', letterSpacing: '0.05em' }}>
                      Campaign Information
                    </span>
                  </div>
                  <div className="border-bottom pb-1.5">
                    <div className="text-secondary" style={{ fontSize: '0.725rem' }}>Set ID:</div>
                    <div className="fw-bold text-dark">{assuranceSet.id}</div>
                  </div>
                  <div className="border-bottom pb-1.5">
                    <div className="text-secondary" style={{ fontSize: '0.725rem' }}>Initiator:</div>
                    <div className="fw-bold text-dark">{assuranceSet.initiatorOrg}</div>
                  </div>
                  <div className="border-bottom pb-1.5">
                    <div className="text-secondary" style={{ fontSize: '0.725rem' }}>Charterer:</div>
                    <div className="fw-bold text-dark">{assuranceSet.charterer || assuranceSet.initiatorOrg}</div>
                  </div>
                  <div className="border-bottom pb-1.5">
                    <div className="text-secondary" style={{ fontSize: '0.725rem' }}>Vessel:</div>
                    <div
                      className="fw-bold text-primary text-decoration-underline-hover"
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        const targetVessel = vessels.find(
                          (v) => v.id === assuranceSet.vesselId || v.name.toLowerCase() === assuranceSet.vesselName.toLowerCase()
                        );
                        const targetId = targetVessel ? targetVessel.id : assuranceSet.vesselId || assuranceSet.vesselName;
                        setCurrentHashView('vessels', targetId);
                      }}
                      title={`Click to open vessel detail page for ${assuranceSet.vesselName}`}
                    >
                      {assuranceSet.vesselName} (IMO {assuranceSet.imoNumber})
                    </div>
                  </div>
                  <div>
                    <div className="text-secondary" style={{ fontSize: '0.725rem' }}>Charter Window:</div>
                    <div className="fw-bold text-dark">{formatMaritimeDate(assuranceSet.charterWindowStart)} - {formatMaritimeDate(assuranceSet.charterWindowEnd)}</div>
                  </div>
                </div>

                {/* Stakeholder Role Assignments */}
                <div className="col-md-6 d-flex flex-column gap-2.5">
                  <div className="text-uppercase fw-bold text-secondary mb-1" style={{ fontSize: '0.725rem', letterSpacing: '0.05em' }}>
                    Stakeholder Role Assignments
                  </div>

                  {/* Submitter */}
                  <div className="border-bottom pb-1.5">
                    <div className="d-flex align-items-center justify-content-between">
                      <div className="text-secondary" style={{ fontSize: '0.725rem' }}>Submitter:</div>
                      {(isCAdmin || activePersona === 'Administrator') && (
                        <button
                          type="button"
                          className="btn btn-link p-0 text-decoration-none small font-mono-code ms-auto"
                          style={{ fontSize: '0.7rem', color: '#0284c7' }}
                          onClick={() => setEditingRole(editingRole === 'Submitter' ? null : 'Submitter')}
                        >
                          {editingRole === 'Submitter' ? 'Cancel' : 'Assign / Change'}
                        </button>
                      )}
                    </div>
                    {editingRole === 'Submitter' ? (
                      <div className="mt-1 d-flex flex-column gap-1">
                        <select
                          className="form-select form-select-sm font-mono-code"
                          style={{ fontSize: '0.75rem' }}
                          value={assuranceSet.assignedSubmitter || ''}
                          onChange={(e) => {
                            if (e.target.value) {
                              updateAssuranceStakeholder(assuranceSet.id, 'Submitter', e.target.value);
                              setEditingRole(null);
                            }
                          }}
                        >
                          <option value="">Select Submitter...</option>
                          {users
                            .filter((u) => userHasRole(u, 'Submitter') || userHasRole(u, 'Administrator'))
                            .map((u) => (
                              <option key={u.id} value={`${u.name} (${u.organization})`}>
                                {u.name} - {u.organization}
                              </option>
                            ))}
                        </select>
                        <button
                          type="button"
                          className="btn btn-xs btn-outline-primary font-mono-code align-self-start mt-1"
                          style={{ fontSize: '0.675rem' }}
                          onClick={() => setCurrentHashView('users')}
                        >
                          + Invite New Submitter in User Management
                        </button>
                      </div>
                    ) : (
                      <div className="fw-bold text-dark">{assuranceSet.assignedSubmitter || 'M. Chen (Northwind Marine Pty Ltd)'}</div>
                    )}
                  </div>

                  {/* Verifier */}
                  <div className="border-bottom pb-1.5">
                    <div className="d-flex align-items-center justify-content-between">
                      <div className="text-secondary" style={{ fontSize: '0.725rem' }}>Verifier:</div>
                      {(isCAdmin || activePersona === 'Administrator') && (
                        <button
                          type="button"
                          className="btn btn-link p-0 text-decoration-none small font-mono-code ms-auto"
                          style={{ fontSize: '0.7rem', color: '#0284c7' }}
                          onClick={() => setEditingRole(editingRole === 'Verifier' ? null : 'Verifier')}
                        >
                          {editingRole === 'Verifier' ? 'Cancel' : 'Assign / Change'}
                        </button>
                      )}
                    </div>
                    {editingRole === 'Verifier' ? (
                      <div className="mt-1 d-flex flex-column gap-1">
                        <select
                          className="form-select form-select-sm font-mono-code"
                          style={{ fontSize: '0.75rem' }}
                          value={assuranceSet.assignedVerifier || ''}
                          onChange={(e) => {
                            if (e.target.value) {
                              updateAssuranceStakeholder(assuranceSet.id, 'Verifier', e.target.value);
                              setEditingRole(null);
                            }
                          }}
                        >
                          <option value="">Select Verifier...</option>
                          {getEligibleVerifiers(users).map((u) => (
                            <option key={u.id} value={`${u.name} (${u.organization})`}>
                              {u.name} - {u.organization}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="btn btn-xs btn-outline-primary font-mono-code align-self-start mt-1"
                          style={{ fontSize: '0.675rem' }}
                          onClick={() => setCurrentHashView('users')}
                        >
                          + Invite New Verifier in User Management
                        </button>
                      </div>
                    ) : (
                      <div className="fw-bold text-dark">
                        {assuranceSet.verificationRequired === false
                          ? 'N/A (Verification Bypassed)'
                          : (assuranceSet.assignedVerifier || 'A. Fontaine (Bureau Veritas Inspectorate)')}
                      </div>
                    )}
                  </div>

                  {/* Inspector */}
                  <div className="border-bottom pb-1.5">
                    <div className="d-flex align-items-center justify-content-between">
                      <div className="text-secondary" style={{ fontSize: '0.725rem' }}>Inspector:</div>
                      {(isCAdmin || activePersona === 'Administrator') && (
                        <button
                          type="button"
                          className="btn btn-link p-0 text-decoration-none small font-mono-code ms-auto"
                          style={{ fontSize: '0.7rem', color: '#0284c7' }}
                          onClick={() => setEditingRole(editingRole === 'Inspector' ? null : 'Inspector')}
                        >
                          {editingRole === 'Inspector' ? 'Cancel' : 'Assign / Change'}
                        </button>
                      )}
                    </div>
                    {editingRole === 'Inspector' ? (
                      <div className="mt-1 d-flex flex-column gap-1">
                        <select
                          className="form-select form-select-sm font-mono-code"
                          style={{ fontSize: '0.75rem' }}
                          value={assuranceSet.assignedInspector || ''}
                          onChange={(e) => {
                            if (e.target.value) {
                              updateAssuranceStakeholder(assuranceSet.id, 'Inspector', e.target.value);
                              setEditingRole(null);
                            }
                          }}
                        >
                          <option value="">Select Inspector...</option>
                          {users
                            .filter((u) => userHasRole(u, 'Inspector'))
                            .map((u) => (
                              <option key={u.id} value={`${u.name} (${u.organization})`}>
                                {u.name} - {u.organization}
                              </option>
                            ))}
                        </select>
                        <button
                          type="button"
                          className="btn btn-xs btn-outline-primary font-mono-code align-self-start mt-1"
                          style={{ fontSize: '0.675rem' }}
                          onClick={() => setCurrentHashView('users')}
                        >
                          + Invite New Inspector in User Management
                        </button>
                      </div>
                    ) : (
                      <div className="fw-bold text-dark">
                        {assuranceSet.mandatoryInspectionRequired
                          ? (assuranceSet.assignedInspector || 'N. Technical (Meridian Marine Surveyors)')
                          : (assuranceSet.assignedInspector || 'N/A (Not Required)')}
                      </div>
                    )}
                  </div>

                  {/* Approver */}
                  <div>
                    <div className="d-flex align-items-center justify-content-between">
                      <div className="text-secondary" style={{ fontSize: '0.725rem' }}>Approver:</div>
                      {(isCAdmin || activePersona === 'Administrator') && (
                        <button
                          type="button"
                          className="btn btn-link p-0 text-decoration-none small font-mono-code ms-auto"
                          style={{ fontSize: '0.7rem', color: '#0284c7' }}
                          onClick={() => setEditingRole(editingRole === 'Approver' ? null : 'Approver')}
                        >
                          {editingRole === 'Approver' ? 'Cancel' : 'Assign / Change'}
                        </button>
                      )}
                    </div>
                    {editingRole === 'Approver' ? (
                      <div className="mt-1 d-flex flex-column gap-1">
                        <select
                          className="form-select form-select-sm font-mono-code"
                          style={{ fontSize: '0.75rem' }}
                          value={assuranceSet.assignedApprover || ''}
                          onChange={(e) => {
                            if (e.target.value) {
                              updateAssuranceStakeholder(assuranceSet.id, 'Approver', e.target.value);
                              setEditingRole(null);
                            }
                          }}
                        >
                          <option value="">Select Approver...</option>
                          {users
                            .filter((u) => userHasRole(u, 'Approver') || userHasRole(u, 'C Admin'))
                            .map((u) => (
                              <option key={u.id} value={`${u.name} (${u.organization})`}>
                                {u.name} - {u.organization}
                              </option>
                            ))}
                        </select>
                        <button
                          type="button"
                          className="btn btn-xs btn-outline-primary font-mono-code align-self-start mt-1"
                          style={{ fontSize: '0.675rem' }}
                          onClick={() => setCurrentHashView('users')}
                        >
                          + Invite New Approver in User Management
                        </button>
                      </div>
                    ) : (
                      <div className="fw-bold text-dark">
                        {assuranceSet.formalApprovalRequired === false
                          ? 'N/A (Direct Sign-Off)'
                          : (assuranceSet.assignedApprover || 'P. Nardelli (Marine Assurance Authority)')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Compact Stage Pipeline Stepper & Readiness Gauge */}
        <div className="col-lg-4 col-md-5">
          <div className="card map-card-custom p-3.5 h-100 d-flex flex-column justify-content-between gap-3">
            <div className="p-3 bg-light border rounded-3 flex-grow-1">
              <div className="text-uppercase font-mono-code fw-bold text-secondary mb-2" style={{ fontSize: '0.725rem', letterSpacing: '0.05em' }}>
                Assurance Campaign Stage Pipeline
              </div>
              <PipelineStepper
                currentStage={assuranceSet.stage}
                readinessScore={calculateAssuranceSetReadiness(assuranceSet)}
                assuranceSet={assuranceSet}
                orientation="vertical"
              />
            </div>

            <div className="p-3 bg-light border rounded-3">
              <div className="text-secondary small text-uppercase font-mono-code fw-bold mb-1.5" style={{ fontSize: '0.725rem', letterSpacing: '0.05em' }}>
                Assurance Readiness Index
              </div>
              <div className="d-flex align-items-center justify-content-center p-2 bg-white border rounded-2">
                <ReadinessGauge score={calculateAssuranceSetReadiness(assuranceSet)} size="md" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row: Requirements Register Table taking full 100% width across two columns */}
      <div className="card map-card-custom">
        <div className="card-header d-flex flex-wrap align-items-center justify-between gap-3 p-3">
          <div className="fw-bold text-dark">
            Statutory Requirements Register
          </div>
          <div className="d-flex align-items-center gap-2 ms-auto">
            <div className="dropdown position-relative">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary text-dark dropdown-toggle"
                onClick={() => setIsExportOpen(!isExportOpen)}
              >
                Export Data
              </button>
              {isExportOpen && (
                <ul className="dropdown-menu dropdown-menu-light show position-absolute end-0 mt-1 shadow border" style={{ zIndex: 1050 }}>
                  <li>
                    <button type="button" className="dropdown-item small" onClick={handleExportCsv}>
                      Export as CSV (.csv)
                    </button>
                  </li>
                  <li>
                    <button type="button" className="dropdown-item small" onClick={handleExportPdf}>
                      Export as PDF (.pdf)
                    </button>
                  </li>
                </ul>
              )}
            </div>
            {canUpload && (
              <button
                type="button"
                className="btn btn-sm btn-primary text-white font-mono-code"
                onClick={() => {
                  setUploadTargetRequirement(null);
                  setReplaceExistingDoc(null);
                  setIsUploadModalOpen(true);
                }}
              >
                Upload Other Document
              </button>
            )}
          </div>
        </div>
        <div className="table-responsive">
          <table className="table map-table-custom align-middle mb-0">
            <thead>
              <tr>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => handleReqSort('category')}
                >
                  Category {renderSortIndicator('category')}
                </th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => handleReqSort('title')}
                >
                  Requirement Title {renderSortIndicator('title')}
                </th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => handleReqSort('ocrConfidence')}
                >
                  OCR Confidence {renderSortIndicator('ocrConfidence')}
                </th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => handleReqSort('status')}
                >
                  Status {renderSortIndicator('status')}
                </th>
                <th className="text-end" style={{ whiteSpace: 'nowrap' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {/* Main Files (Toggled Statutory Requirements during campaign creation) */}
              {sortedRequirements.filter((r) => !r.isOtherDocument).map((req: AssuranceRequirement) => {
                const linkedDoc = documents.find((d) => d.id === req.documentId || (req.linkedDocumentId && d.id === req.linkedDocumentId));
                const hasAttachedDoc = Boolean(linkedDoc || req.documentId || req.linkedDocumentId);
                const effectiveOcr = hasAttachedDoc ? (req.ocrConfidence || linkedDoc?.ocrConfidence || 0) : 0;

                return (
                  <tr key={req.id}>
                    <td>
                      <div className="d-flex align-items-center gap-1.5 flex-wrap">
                        {req.subtype && (
                          <span className="badge bg-primary-subtle text-primary border border-primary-subtle font-mono-code" style={{ fontSize: '0.7rem' }}>
                            {req.subtype}
                          </span>
                        )}
                        <span className="badge bg-light text-dark border" style={{ fontSize: '0.75rem' }}>
                          {req.category}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="fw-semibold text-dark">
                        {req.title}
                        {(linkedDoc?.currentVersion || req.documentVersion) && (
                          <span className="badge bg-light text-secondary border font-mono-code ms-2" style={{ fontSize: '0.7rem' }}>
                            {linkedDoc?.currentVersion || req.documentVersion}
                          </span>
                        )}
                        {req.isSpecialized && (
                          <span className="badge bg-info-subtle text-info-emphasis border border-info-subtle font-mono-code ms-1.5" style={{ fontSize: '0.65rem' }}>
                            Specialized
                          </span>
                        )}
                      </div>
                      {req.description && (
                        <div className="text-secondary small mt-0.5" style={{ fontSize: '0.78rem', lineHeight: '1.4' }}>
                          {req.description}
                        </div>
                      )}
                    </td>
                    <td>
                      <ConfidenceBadge score={effectiveOcr} />
                    </td>
                    <td>
                      {renderRequirementStatus(req)}
                    </td>
                    <td className="text-end">
                      <div className="d-flex align-items-center justify-content-end gap-2 flex-wrap">
                        {linkedDoc ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary font-mono-code"
                              onClick={() => setSelectedDocForReview({ doc: linkedDoc, notes: req.notes })}
                            >
                              Review Document
                            </button>
                            {canUpload && linkedDoc.verificationStatus !== 'Verified' && (
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary font-mono-code"
                                onClick={() => openRequirementUpload(req, linkedDoc)}
                              >
                                Replace Revision
                              </button>
                            )}
                          </>
                        ) : canUpload ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-primary text-white font-mono-code"
                            onClick={() => openRequirementUpload(req)}
                          >
                            Upload Document
                          </button>
                        ) : (
                          <span className="text-secondary small font-mono-code">No Document</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* Other Documents Section Title */}
              <tr className="bg-light border-top border-bottom">
                <td colSpan={5} className="py-2.5 px-3">
                  <div className="d-flex align-items-center justify-content-between">
                    <span className="fw-bold text-secondary text-uppercase font-mono-code" style={{ fontSize: '0.75rem', letterSpacing: '0.05em' }}>
                      Other Documents
                    </span>
                  </div>
                </td>
              </tr>

              {/* Other Documents Rows */}
              {sortedRequirements.filter((r) => r.isOtherDocument).length > 0 ? (
                sortedRequirements.filter((r) => r.isOtherDocument).map((req: AssuranceRequirement) => {
                  const linkedDoc = documents.find((d) => d.id === req.documentId || (req.linkedDocumentId && d.id === req.linkedDocumentId));
                  const hasAttachedDoc = Boolean(linkedDoc || req.documentId || req.linkedDocumentId);
                  const effectiveOcr = hasAttachedDoc ? (req.ocrConfidence || linkedDoc?.ocrConfidence || 0) : 0;

                  return (
                    <tr key={req.id}>
                      <td>
                        <span className="badge bg-light text-dark border" style={{ fontSize: '0.75rem' }}>
                          {req.category}
                        </span>
                      </td>
                      <td className="fw-semibold text-dark">
                        {req.title}
                        {(linkedDoc?.currentVersion || req.documentVersion) && (
                          <span className="badge bg-light text-secondary border font-mono-code ms-2" style={{ fontSize: '0.7rem' }}>
                            {linkedDoc?.currentVersion || req.documentVersion}
                          </span>
                        )}
                      </td>
                      <td>
                        <ConfidenceBadge score={effectiveOcr} />
                      </td>
                      <td>
                        {renderRequirementStatus(req)}
                      </td>
                      <td className="text-end">
                        <div className="d-flex align-items-center justify-content-end gap-2 flex-wrap">
                          {linkedDoc ? (
                            <>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary font-mono-code"
                                onClick={() => setSelectedDocForReview({ doc: linkedDoc, notes: req.notes })}
                              >
                                Review Document
                              </button>
                              {canUpload && linkedDoc.verificationStatus !== 'Verified' && (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-secondary font-mono-code"
                                  onClick={() => openRequirementUpload(req, linkedDoc)}
                                >
                                  Replace Revision
                                </button>
                              )}
                            </>
                          ) : canUpload ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-primary text-white font-mono-code"
                              onClick={() => openRequirementUpload(req)}
                            >
                              Upload Document
                            </button>
                          ) : (
                            <span className="text-secondary small font-mono-code">No Document</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-3 small font-mono-code">
                    No other documents uploaded. Click 'Upload Document' above to attach additional certificates or reports.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Document Review Drawer */}
      <DocumentReviewDrawer
        document={selectedDocForReview?.doc || null}
        requirementNotes={selectedDocForReview?.notes}
        onClose={() => setSelectedDocForReview(null)}
      />

      {/* Version History Drawer for Submitter / Admin Reupload */}
      <VersionHistoryDrawer
        document={selectedDocForVersionHistory}
        onClose={() => setSelectedDocForVersionHistory(null)}
      />

      {/* Document Upload Modal */}
      <DocumentUploadModal
        isOpen={isUploadModalOpen}
        onClose={closeUploadModal}
        existingDocument={replaceExistingDoc}
        assuranceSetId={assuranceSet.id}
        requirementId={uploadTargetRequirement?.id}
        requirementTitle={uploadTargetRequirement?.title}
        defaultVesselId={assuranceSet.vesselId}
        onUploadComplete={closeUploadModal}
      />
    </div>
  );
};
