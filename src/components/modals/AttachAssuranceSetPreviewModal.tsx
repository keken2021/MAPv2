/*
  file summary: preview and confirmation modal for attaching an existing standalone assurance set to a project charter.
  responsibilities: previews assurance set metadata, target asset details, statutory requirements, matched vault documents, and confirmation workflow.
  role in system: invoked when selecting or attaching a standalone assurance set in ProjectDetailView or CreateProjectView.
*/

import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  FileCheck,
  Ship,
  Wrench,
  Users,
  Building2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Clock,
  ExternalLink,
  ShieldCheck,
  Calendar,
  Layers,
  ChevronRight,
  Plus,
} from 'lucide-react';
import { useMapStore } from '../../store/useMapStore';
import { AssuranceRequirement, AssuranceSet } from '../../types/assurance';
import { Project, ProjectAssetType } from '../../types/project';
import { MasterDocument } from '../../types/document';
import { normalizeText } from '../../utils/documentMatchingHelpers';
import { calculateAssuranceSetReadiness } from '../../utils/readinessHelpers';
import { usePagination } from '../../utils/usePagination';
import { TablePagination } from '../common/TablePagination';

export interface AttachAssuranceSetPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  assuranceSet: AssuranceSet | null;
  project: Pick<Project, 'name'> & Partial<Project>;
  onConfirm: (
    roleInProject: string,
    charterWindowStart: string,
    charterWindowEnd: string,
    notes?: string,
  ) => void;
}

export const AttachAssuranceSetPreviewModal: React.FC<AttachAssuranceSetPreviewModalProps> = ({
  isOpen,
  onClose,
  assuranceSet,
  project,
  onConfirm,
}) => {
  const { vessels, crew, equipment, documents, assuranceSets } = useMapStore();
  /* the previewed set shows the same calculated index as every other screen */
  const readiness = assuranceSet ? calculateAssuranceSetReadiness(assuranceSet, assuranceSets) : 0;

  const [roleInProject, setRoleInProject] = useState('');
  const [charterWindowStart, setCharterWindowStart] = useState('');
  const [charterWindowEnd, setCharterWindowEnd] = useState('');
  const [notes, setNotes] = useState('');
  const [activeTab, setActiveTab] = useState<'requirements' | 'details'>('requirements');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Determine asset type and target asset details
  const assetType: ProjectAssetType = useMemo(() => {
    if (!assuranceSet) return 'Vessel';
    /* a combined set is filed under its assuranceType even when it also carries a crew or equipment id */
    if (
      assuranceSet.assuranceType === 'Vessel' ||
      assuranceSet.assuranceType === 'Crew' ||
      assuranceSet.assuranceType === 'Equipment'
    ) {
      return assuranceSet.assuranceType;
    }
    if (assuranceSet.crewId) return 'Crew';
    if (assuranceSet.equipmentId) return 'Equipment';
    return 'Vessel';
  }, [assuranceSet]);

  const assetDetails = useMemo(() => {
    if (!assuranceSet) return { id: '', name: '', org: '', extra: '' };

    if (assetType === 'Crew') {
      const c = crew.find((item) => item.id === assuranceSet.crewId);
      return {
        id: assuranceSet.crewId || 'CREW-N/A',
        name: assuranceSet.crewName || c?.fullName || 'Crew Member',
        org: c?.organization || assuranceSet.initiatorOrg || assuranceSet.serviceProviderOrg || 'Crew Provider',
        extra: c ? `${c.rank} · ${c.nationality}` : 'Crew',
      };
    }

    if (assetType === 'Equipment') {
      const eq = equipment.find((item) => item.id === assuranceSet.equipmentId);
      return {
        id: assuranceSet.equipmentId || 'EQ-N/A',
        name: assuranceSet.equipmentName || eq?.name || 'Equipment',
        org: eq?.owningOrganization || assuranceSet.initiatorOrg || assuranceSet.serviceProviderOrg || 'Equipment Owner',
        extra: eq ? `${eq.category} · ${eq.model || eq.equipmentIdentifier}` : 'Equipment Asset',
      };
    }

    const v = vessels.find((item) => item.id === assuranceSet.vesselId);
    return {
      id: assuranceSet.vesselId || (v ? v.id : 'VESSEL-N/A'),
      name: assuranceSet.vesselName || v?.name || 'Assigned Vessel',
      org: v?.registeredOwner || assuranceSet.initiatorOrg || assuranceSet.serviceProviderOrg || 'Vessel Owner',
      extra: v ? `IMO ${v.imoNumber || assuranceSet.imoNumber} · ${v.vesselType}` : `IMO ${assuranceSet.imoNumber || 'N/A'}`,
    };
  }, [assuranceSet, assetType, vessels, crew, equipment]);

  // Set default role and charter dates when assurance set changes
  useEffect(() => {
    if (assuranceSet) {
      if (assetType === 'Vessel') setRoleInProject('Subject vessel');
      else if (assetType === 'Crew') setRoleInProject('Service crew');
      else if (assetType === 'Equipment') setRoleInProject('Rented equipment');
      else setRoleInProject('Attached standalone set');

      setCharterWindowStart(
        project.charterWindowStart || assuranceSet.charterWindowStart || '2026-11-01',
      );
      setCharterWindowEnd(
        project.charterWindowEnd || assuranceSet.charterWindowEnd || '2027-02-28',
      );
      setNotes('');
      setActiveTab('requirements');
    }
  }, [assuranceSet, assetType, project.charterWindowStart, project.charterWindowEnd]);

  // Document matching helper for previewing attached certificates
  const requirementRows = useMemo(() => {
    if (!assuranceSet || !assuranceSet.requirements) return [];

    return assuranceSet.requirements.map((req: AssuranceRequirement) => {
      // 1. Direct document ID link
      let matchedDoc: MasterDocument | undefined;
      if (req.documentId || req.linkedDocumentId) {
        matchedDoc = documents.find(
          (d) => d.id === req.documentId || d.id === req.linkedDocumentId,
        );
      }

      // 2. Fallback fuzzy match across documents matching asset
      if (!matchedDoc) {
        const reqNorm = normalizeText(req.title);
        matchedDoc = documents.find((d) => {
          if (assetType === 'Vessel' && d.vesselId === assuranceSet.vesselId) {
            return normalizeText(d.title).includes(reqNorm) || reqNorm.includes(normalizeText(d.title));
          }
          return false;
        });
      }

      return {
        requirement: req,
        matchedDoc,
      };
    });
  }, [assuranceSet, documents, assetType]);

  const mandatoryCount = useMemo(() => {
    if (!assuranceSet || !assuranceSet.requirements) return 0;
    return assuranceSet.requirements.filter((r) => r.isMandatory).length;
  }, [assuranceSet]);

  const verifiedCount = useMemo(() => {
    if (!assuranceSet || !assuranceSet.requirements) return 0;
    return assuranceSet.requirements.filter(
      (r) => r.verifierStatus === 'Verified' || r.isFulfilled,
    ).length;
  }, [assuranceSet]);

  const requirementsPagination = usePagination(requirementRows, [assuranceSet?.id]);

  if (!isOpen || !assuranceSet) return null;

  const handleConfirm = () => {
    setIsSubmitting(true);
    onConfirm(
      roleInProject || 'Attached standalone set',
      charterWindowStart || project.charterWindowStart || '2026-11-01',
      charterWindowEnd || project.charterWindowEnd || '2027-02-28',
      notes,
    );
    setIsSubmitting(false);
  };

  const getAssetIcon = () => {
    if (assetType === 'Crew') return <Users size={20} className="text-primary" />;
    if (assetType === 'Equipment') return <Wrench size={20} className="text-primary" />;
    return <Ship size={20} className="text-primary" />;
  };

  return (
    <div
      className="modal fade show d-block"
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      style={{ backgroundColor: 'rgba(11, 27, 43, 0.65)', backdropFilter: 'blur(3px)', zIndex: 1060 }}
    >
      <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '8px', overflow: 'hidden' }}>
          {/* Modal Header */}
          <div
            className="modal-header text-white px-4 py-3 align-items-center"
            style={{ backgroundColor: '#0B1B2B' }}
          >
            <div className="d-flex align-items-center gap-2 flex-grow-1">
              <div
                className="d-inline-flex align-items-center justify-content-center bg-white bg-opacity-10 rounded p-2"
                style={{ width: '36px', height: '36px' }}
              >
                <Layers size={20} className="text-white" />
              </div>
              <div>
                <h5 className="modal-title h6 fw-bold mb-0 text-white d-flex align-items-center gap-2">
                  Preview Assurance Set
                  <span className="badge bg-light text-dark font-mono-code" style={{ fontSize: '0.75rem' }}>
                    {assuranceSet.id}
                  </span>
                </h5>
                <div className="small text-white-50" style={{ fontSize: '0.8rem' }}>
                  Review before attaching to {project.name}.
                </div>
              </div>
            </div>
            <button
              type="button"
              className="btn-close btn-close-white"
              aria-label="Close"
              onClick={onClose}
              disabled={isSubmitting}
            />
          </div>

          {/* Modal Body */}
          <div className="modal-body p-4" style={{ backgroundColor: '#F8FAFC' }}>
            {/* Top Info Banner / Metadata Card */}
            <div className="card map-card-custom p-3 mb-3 bg-white">
              <div className="row g-3 align-items-center">
                <div className="col-lg-6">
                  <div className="d-flex align-items-start gap-3">
                    <div
                      className="p-3 rounded bg-light border d-flex align-items-center justify-content-center"
                      style={{ width: '48px', height: '48px' }}
                    >
                      {getAssetIcon()}
                    </div>
                    <div>
                      <div className="d-flex align-items-center gap-2 flex-wrap">
                        <span className="badge bg-primary font-mono-code">
                          {assetDetails.id}
                        </span>
                        <span className="badge bg-secondary">
                          {assetType}
                        </span>
                        <span className="badge bg-info text-dark">
                          {assuranceSet.stage}
                        </span>
                      </div>
                      <h6 className="fw-bold text-dark mt-1 mb-0">{assetDetails.name}</h6>
                      <div className="small text-muted">{assetDetails.extra}</div>
                    </div>
                  </div>
                </div>

                <div className="col-lg-6">
                  <div className="row g-2 text-sm">
                    <div className="col-sm-6">
                      <div className="small text-muted">Created By</div>
                      <div className="fw-semibold text-dark text-truncate" title={assuranceSet.initiatorOrg}>
                        {assuranceSet.initiatorOrg || 'N/A'}
                      </div>
                    </div>
                    <div className="col-sm-6">
                      <div className="small text-muted">Client</div>
                      <div className="fw-semibold text-dark text-truncate" title={assuranceSet.charterer || assuranceSet.clientOrg}>
                        {assuranceSet.charterer || assuranceSet.clientOrg || project.clientOperator}
                      </div>
                    </div>
                    <div className="col-sm-6">
                      <div className="small text-muted">Charter Period</div>
                      <div className="fw-semibold text-dark font-mono-code" style={{ fontSize: '0.8rem' }}>
                        {assuranceSet.charterWindowStart || '2026-11-01'} to {assuranceSet.charterWindowEnd || '2027-02-28'}
                      </div>
                    </div>
                    <div className="col-sm-6">
                      <div className="small text-muted">Readiness</div>
                      <div className="d-flex align-items-center gap-2">
                        <div className="progress flex-grow-1" style={{ height: '8px' }}>
                          <div
                            className={`progress-bar ${
                              readiness >= 80
                                ? 'bg-success'
                                : readiness >= 50
                                ? 'bg-warning'
                                : 'bg-danger'
                            }`}
                            role="progressbar"
                            style={{ width: `${readiness}%` }}
                            aria-valuenow={readiness}
                            aria-valuemin={0}
                            aria-valuemax={100}
                          />
                        </div>
                        <span className="fw-bold font-mono-code text-dark" style={{ fontSize: '0.85rem' }}>
                          {readiness}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sub-tab Navigation */}
            <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className={`btn btn-sm ${
                    activeTab === 'requirements'
                      ? 'btn-primary text-white fw-semibold'
                      : 'btn-light border text-muted'
                  }`}
                  onClick={() => setActiveTab('requirements')}
                >
                  <FileCheck size={14} className="me-1 inline" />
                  Requirements ({requirementRows.length})
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${
                    activeTab === 'details'
                      ? 'btn-primary text-white fw-semibold'
                      : 'btn-light border text-muted'
                  }`}
                  onClick={() => setActiveTab('details')}
                >
                  <Building2 size={14} className="me-1 inline" />
                  Stakeholders
                </button>
              </div>

              <div className="d-flex align-items-center gap-2 small">
                <span className="text-muted">
                  Mandatory Requirements:{' '}
                  <strong className="text-danger">{mandatoryCount}</strong>
                </span>
                <span className="text-muted">·</span>
                <span className="text-muted">
                  Verified:{' '}
                  <strong className="text-success">{verifiedCount}</strong> / {requirementRows.length}
                </span>
              </div>
            </div>

            {/* Tab 1: Requirements & Documents Preview Table */}
            {activeTab === 'requirements' && (
              <div className="card map-card-custom mb-3 overflow-hidden">
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.85rem' }}>
                    <thead className="table-light">
                      <tr>
                        <th style={{ width: '130px', padding: '10px 16px' }}>Requirement ID</th>
                        <th style={{ minWidth: '220px', padding: '10px 16px' }}>Requirement</th>
                        <th style={{ width: '160px', padding: '10px 16px' }}>Category</th>
                        <th style={{ minWidth: '200px', padding: '10px 16px' }}>Document</th>
                        <th style={{ width: '140px', padding: '10px 16px' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {requirementRows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-4 text-muted">
                            No requirements yet.
                          </td>
                        </tr>
                      ) : (
                        requirementsPagination.pageItems.map(({ requirement: req, matchedDoc }) => {
                          const isMandatory = req.isMandatory;
                          const isVerified = req.verifierStatus === 'Verified' || req.isFulfilled;

                          return (
                            <tr key={req.id}>
                              {/* Column 1: ID */}
                              <td style={{ padding: '10px 16px' }}>
                                <span className="font-mono-code fw-semibold text-primary">
                                  {req.id}
                                </span>
                              </td>

                              {/* Column 2: Title & Mandatory Indicator */}
                              <td style={{ padding: '10px 16px' }}>
                                <div className="fw-semibold text-dark">
                                  {req.title}
                                  {isMandatory && (
                                    <span
                                      className="text-danger ms-1 fw-bold"
                                      title="Mandatory"
                                    >
                                      *
                                    </span>
                                  )}
                                </div>
                                <div className="d-flex align-items-center gap-2 mt-0.5">
                                  {isMandatory ? (
                                    <span
                                      className="badge bg-danger-subtle text-danger border border-danger-subtle"
                                      style={{ fontSize: '0.7rem' }}
                                    >
                                      Mandatory
                                    </span>
                                  ) : (
                                    <span
                                      className="badge bg-light text-muted border"
                                      style={{ fontSize: '0.7rem' }}
                                    >
                                      Optional
                                    </span>
                                  )}
                                  {req.subtype && (
                                    <span className="badge bg-secondary-subtle text-secondary" style={{ fontSize: '0.7rem' }}>
                                      {req.subtype}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Column 3: Category */}
                              <td style={{ padding: '10px 16px' }}>
                                <span className="text-muted">{req.category}</span>
                              </td>

                              {/* Column 4: Matched Document */}
                              <td style={{ padding: '10px 16px' }}>
                                {matchedDoc ? (
                                  <div>
                                    <div className="fw-medium text-dark text-truncate" style={{ maxWidth: '240px' }} title={matchedDoc.title}>
                                      {matchedDoc.title}
                                    </div>
                                    <div className="d-flex align-items-center gap-2 small text-muted font-mono-code" style={{ fontSize: '0.75rem' }}>
                                      <span>Cert: {matchedDoc.certificateNo || matchedDoc.id}</span>
                                      {matchedDoc.expiryDate && (
                                        <span>· Exp: {matchedDoc.expiryDate}</span>
                                      )}
                                    </div>
                                  </div>
                                ) : req.documentId ? (
                                  <div>
                                    <div className="fw-medium text-dark font-mono-code" style={{ fontSize: '0.8rem' }}>
                                      {req.documentId}
                                    </div>
                                    <div className="small text-muted">
                                      OCR: {req.ocrConfidence || 95}% confidence
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-muted fst-italic">
                                    Awaiting Upload
                                  </span>
                                )}
                              </td>

                              {/* Column 5: Status */}
                              <td style={{ padding: '10px 16px' }}>
                                {isVerified ? (
                                  <span className="badge bg-success d-inline-flex align-items-center gap-1">
                                    <CheckCircle2 size={12} />
                                    Verified
                                  </span>
                                ) : req.verifierStatus === 'Correction Requested' ? (
                                  <span className="badge bg-warning text-dark d-inline-flex align-items-center gap-1">
                                    <AlertTriangle size={12} />
                                    Returned for Correction
                                  </span>
                                ) : req.verifierStatus === 'Rejected' ? (
                                  <span className="badge bg-danger d-inline-flex align-items-center gap-1">
                                    <AlertCircle size={12} />
                                    Rejected
                                  </span>
                                ) : (
                                  <span className="badge bg-secondary d-inline-flex align-items-center gap-1">
                                    <Clock size={12} />
                                    Pending Review
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                <TablePagination {...requirementsPagination.controls} />
              </div>
            )}

            {/* Tab 2: Governance & Stakeholders */}
            {activeTab === 'details' && (
              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <div className="card map-card-custom p-3 h-100 bg-white">
                    <h6 className="fw-bold text-dark mb-3">Details</h6>
                    <div className="d-flex flex-column gap-2 small">
                      <div className="d-flex justify-content-between border-bottom pb-1">
                        <span className="text-muted">Set ID:</span>
                        <span className="font-mono-code fw-semibold text-dark">{assuranceSet.id}</span>
                      </div>
                      <div className="d-flex justify-content-between border-bottom pb-1">
                        <span className="text-muted">Title:</span>
                        <span className="fw-semibold text-dark">{assuranceSet.title}</span>
                      </div>
                      <div className="d-flex justify-content-between border-bottom pb-1">
                        <span className="text-muted">Scope:</span>
                        <span className="fw-semibold text-dark">{assuranceSet.assuranceType || assetType}</span>
                      </div>
                      <div className="d-flex justify-content-between border-bottom pb-1">
                        <span className="text-muted">Stage:</span>
                        <span className="badge bg-info text-dark">{assuranceSet.stage}</span>
                      </div>
                      <div className="d-flex justify-content-between border-bottom pb-1">
                        <span className="text-muted">Decision:</span>
                        <span className="fw-semibold text-dark">{assuranceSet.approverDecision || 'Pending Review'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="card map-card-custom p-3 h-100 bg-white">
                    <h6 className="fw-bold text-dark mb-3">Stakeholders</h6>
                    <div className="d-flex flex-column gap-2 small">
                      <div className="d-flex justify-content-between border-bottom pb-1">
                        <span className="text-muted">Submitter:</span>
                        <span className="fw-semibold text-dark">
                          {assuranceSet.assignedSubmitter || assuranceSet.stakeholders?.submitterName || 'Provider Admin'}
                        </span>
                      </div>
                      <div className="d-flex justify-content-between border-bottom pb-1">
                        <span className="text-muted">Verifier:</span>
                        <span className="fw-semibold text-dark">
                          {assuranceSet.assignedVerifier || assuranceSet.stakeholders?.verifierName || 'Assurance Verifier'}
                        </span>
                      </div>
                      <div className="d-flex justify-content-between border-bottom pb-1">
                        <span className="text-muted">Inspector:</span>
                        <span className="fw-semibold text-dark">
                          {assuranceSet.assignedInspector || assuranceSet.stakeholders?.inspectorName || 'Not assigned'}
                        </span>
                      </div>
                      <div className="d-flex justify-content-between border-bottom pb-1">
                        <span className="text-muted">Approver:</span>
                        <span className="fw-semibold text-dark">
                          {assuranceSet.assignedApprover || assuranceSet.stakeholders?.approverName || 'Not assigned'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Template Instance & Contract Period Configuration */}
            <div className="card map-card-custom p-3 bg-white">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <h6 className="fw-bold text-dark mb-0">
                  Contract Period &amp; Role
                </h6>
                <span className="badge bg-primary-subtle text-primary border border-primary-subtle font-mono-code" style={{ fontSize: '0.75rem' }}>
                  {assuranceSet.visibility === 'public' ? 'Public Template' : 'Organization Template'}
                </span>
              </div>
              <p className="text-muted small mb-3">
                Set the Contract Period and this set's role in the project.
              </p>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label small fw-semibold text-muted">
                    Contract Period Start <span className="text-danger">*</span>
                  </label>
                  <input
                    type="date"
                    className="form-control form-control-sm font-mono-code"
                    value={charterWindowStart}
                    onChange={(e) => setCharterWindowStart(e.target.value)}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-semibold text-muted">
                    Contract Period End <span className="text-danger">*</span>
                  </label>
                  <input
                    type="date"
                    className="form-control form-control-sm font-mono-code"
                    value={charterWindowEnd}
                    onChange={(e) => setCharterWindowEnd(e.target.value)}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-semibold text-muted">
                    Role in Project <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={roleInProject}
                    onChange={(e) => setRoleInProject(e.target.value)}
                    placeholder="e.g. Subject vessel, Service crew, Primary crane"
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-semibold text-muted">
                    Notes (optional)
                  </label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Reused from an earlier charter"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div
            className="modal-footer d-flex justify-content-between align-items-center px-4 py-3 bg-white"
            style={{ borderTop: '1px solid #E2E8F0' }}
          >
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary px-3"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-sm btn-primary px-4 fw-semibold d-inline-flex align-items-center gap-2"
              onClick={handleConfirm}
              disabled={isSubmitting || !roleInProject.trim()}
            >
              <Plus size={16} />
              Attach Assurance Set
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
