/* 
  file summary: assurance set command center deep-dive view presenting stage pipeline stepper and requirements register in light theme.
  responsibilities: manages requirement verification statuses, displays pipeline stage progress, and enforces C Admin read-only rules.
  role in system: deep-dive view rendered when an assurance set row is selected.
*/

import React, { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, FolderOpen, FileCheck, RefreshCw, Upload } from 'lucide-react';
import { useMapStore } from '../store/useMapStore';
import { PipelineStepper } from '../components/common/PipelineStepper';
import { ReadinessGauge } from '../components/common/ReadinessGauge';
import { ConfidenceBadge } from '../components/common/ConfidenceBadge';
import { DocumentReviewDrawer } from '../components/drawers/DocumentReviewDrawer';
import { formatMaritimeDate, formatReviewChannel, getStatusDisplayLabel } from '../utils/formatters';
import { toIsoLocalDate, validateCharterWindow } from '../utils/validation';
import { MasterDocument } from '../types/document';
import { AssuranceRequirement } from '../types/assurance';
import { filterProjectsForPersona, getProjectForAssuranceSet, isAssuranceSetOrphaned } from '../utils/projectHelpers';

import { VersionHistoryDrawer } from '../components/drawers/VersionHistoryDrawer';
import { exportToCsv, exportToPdf } from '../utils/exportHelpers';
import { DocumentUploadModal } from '../components/drawers/DocumentUploadModal';
import {
  userHasRole,
  filterCandidatesByReviewMode,
  filterEligibleApproversForScope,
} from '../utils/userRoleHelpers';
import { calculateAssuranceSetReadiness } from '../utils/readinessHelpers';
import {
  canEditAssuranceSetStakeholders,
  getAssuranceSetRoleActions,
  getAssuranceSetCreator,
  getAssuranceSetStakeholderLockReason,
} from '../utils/rbacHelpers';
import { usePagination } from '../utils/usePagination';
import { TablePagination } from '../components/common/TablePagination';

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
    updateAssuranceSet,
    documents,
    activePersona,
    users,
    projects,
    attachAssuranceSetToProject,
    setCurrentHashView,
    activeDemoOrganization,
  } = useMapStore();
  const [stakeholderError, setStakeholderError] = useState<string | null>(null);
  const [isAddToProjectOpen, setIsAddToProjectOpen] = useState(false);
  const [isEditingCharterWindow, setIsEditingCharterWindow] = useState(false);
  const [charterStartDraft, setCharterStartDraft] = useState('');
  const [charterEndDraft, setCharterEndDraft] = useState('');
  const [charterWindowErrors, setCharterWindowErrors] = useState<{ start?: string; end?: string }>({});
  const [targetProjectId, setTargetProjectId] = useState('');
  const [addToProjectError, setAddToProjectError] = useState<string | null>(null);
  const [projectToast, setProjectToast] = useState<string | null>(null);
  const [selectedDocForReview, setSelectedDocForReview] = useState<{ doc: MasterDocument; notes?: string } | null>(null);
  const [selectedDocForVersionHistory, setSelectedDocForVersionHistory] = useState<MasterDocument | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadTargetRequirement, setUploadTargetRequirement] = useState<AssuranceRequirement | null>(null);
  const [replaceExistingDoc, setReplaceExistingDoc] = useState<MasterDocument | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<'Submitter' | 'Verifier' | 'Inspector' | 'Approver' | null>(null);

  type ReqSortField = 'title' | 'ocrConfidence' | 'status';
  const [reqSortField, setReqSortField] = useState<ReqSortField>('title');
  const [reqSortDirection, setReqSortDirection] = useState<'asc' | 'desc'>('asc');

  const renderSortIndicator = (field: ReqSortField) => {
    if (reqSortField !== field) {
      return <ArrowUpDown size={14} className="text-muted ms-1 opacity-50 inline-block align-middle" />;
    }
    return reqSortDirection === 'asc' ? (
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

  const assuranceSet = assuranceSets.find((s) => s.id === setId) || assuranceSets[0];
  const sortedRequirements = useMemo(() => {
    if (!assuranceSet?.requirements) return [];
    return [...assuranceSet.requirements].sort((a, b) => {
      let comp = 0;
      if (reqSortField === 'title') {
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

  const isCAdminPersona = activePersona === 'C Admin';
  const clientOwnerOrg =
    assuranceSet?.clientOrg || assuranceSet?.charterer || assuranceSet?.initiatorOrg || '';
  const serviceProviderOrg = assuranceSet?.serviceProviderOrg;

  const verifierCandidates = useMemo(
    () =>
      filterCandidatesByReviewMode(
        users,
        assuranceSet?.reviewMode || 'third_party',
        'Verifier',
        { clientOrg: clientOwnerOrg, serviceProviderOrg },
      ),
    [users, assuranceSet?.reviewMode, clientOwnerOrg, serviceProviderOrg],
  );

  const approverCandidates = useMemo(
    () =>
      filterEligibleApproversForScope(users, {
        serviceProviderOrg,
        isClientAdmin: isCAdminPersona,
        isCharteringOtherServices: true,
      }),
    [users, serviceProviderOrg, isCAdminPersona],
  );

  const mainRequirements = sortedRequirements.filter((r) => !r.isOtherDocument);
  const otherRequirements = sortedRequirements.filter((r) => r.isOtherDocument);
  /* one page sequence for the whole table: requirements first, then other documents */
  const requirementsPagination = usePagination(
    [...mainRequirements, ...otherRequirements],
    [assuranceSet?.id, reqSortField, reqSortDirection],
  );
  const pageMainRequirements = requirementsPagination.pageItems.filter((r) => !r.isOtherDocument);
  const pageOtherRequirements = requirementsPagination.pageItems.filter((r) => r.isOtherDocument);
  const isLastRequirementsPage =
    requirementsPagination.controls.page === requirementsPagination.controls.totalPages;

  if (!assuranceSet) return <div>Assurance Set not found.</div>;

  if (assuranceSet.visibility === 'draft') {
    return (
      <div className="card map-card-custom p-4 text-center my-4">
        <div className="py-4">
          <div className="badge bg-warning-subtle text-dark border border-warning-subtle px-3 py-1.5 mb-3 font-mono-code">
            Draft
          </div>
          <h4 className="fw-bold text-dark">{assuranceSet.title}</h4>
          <p className="text-secondary mx-auto mb-4" style={{ maxWidth: '550px' }}>
            This assurance set is a draft. Finish setup to create it.
          </p>
          <div className="d-flex align-items-center justify-content-center gap-3">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => setCurrentHashView('assurance-sets')}
            >
              Back to Assurance Sets
            </button>
            {getAssuranceSetRoleActions(assuranceSet, activePersona).canManage && (
              <button
                type="button"
                className="btn btn-primary px-4 fw-semibold"
                onClick={() => setCurrentHashView('create-assurance-set', assuranceSet.id)}
              >
                Continue Setup
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const isCAdmin = isCAdminPersona;
  const roleActions = getAssuranceSetRoleActions(assuranceSet, activePersona);

  /* asset under assurance: its type, display name and the registry page it opens */
  const assuredAsset = ((): { typeLabel: string; name: string; view?: string; entityId?: string } => {
    if (assuranceSet.assuranceType === 'Crew') {
      return {
        typeLabel: 'Crew',
        name: assuranceSet.crewName || assuranceSet.vesselName,
        view: assuranceSet.crewId ? 'crew' : undefined,
        entityId: assuranceSet.crewId,
      };
    }
    if (assuranceSet.assuranceType === 'Equipment') {
      return {
        typeLabel: 'Equipment',
        name: assuranceSet.equipmentName || assuranceSet.vesselName,
        view: assuranceSet.equipmentId ? 'equipment' : undefined,
        entityId: assuranceSet.equipmentId,
      };
    }
    if (assuranceSet.assuranceType === 'Activity') {
      return { typeLabel: 'Activity', name: assuranceSet.activityName || assuranceSet.vesselName };
    }
    const targetVessel = vessels.find(
      (v) => v.id === assuranceSet.vesselId || v.name.toLowerCase() === assuranceSet.vesselName.toLowerCase(),
    );
    return {
      typeLabel: 'Vessel',
      name: `${assuranceSet.vesselName} (IMO ${assuranceSet.imoNumber})`,
      view: targetVessel || assuranceSet.vesselId ? 'vessels' : undefined,
      entityId: targetVessel?.id || assuranceSet.vesselId,
    };
  })();

  /* project side of the set: zero or one project per set */
  const linkedProject = getProjectForAssuranceSet(assuranceSet, projects);
  const canAddToProject = roleActions.canManage && isAssuranceSetOrphaned(assuranceSet, projects);
  const attachableProjects = canAddToProject
    ? filterProjectsForPersona(
        projects,
        activePersona,
        users,
        assuranceSets,
        activePersona === 'C Admin' ? activeDemoOrganization : undefined,
      )
    : [];
  const creator = getAssuranceSetCreator(assuranceSet, users);

  /* the charter window stays editable for managers until the set is approved or certified */
  const isCharterWindowLocked = assuranceSet.stage === 'Approved' || assuranceSet.stage === 'Certified';
  const canEditCharterWindow = roleActions.canManage && !isCharterWindowLocked;

  /* earliest selectable day: tomorrow, since today and earlier are not allowed */
  const minCharterDate = (() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return toIsoLocalDate(tomorrow);
  })();

  const startCharterWindowEdit = () => {
    setCharterStartDraft(assuranceSet.charterWindowStart || '');
    setCharterEndDraft(assuranceSet.charterWindowEnd || '');
    setCharterWindowErrors({});
    setIsEditingCharterWindow(true);
  };

  const cancelCharterWindowEdit = () => {
    setIsEditingCharterWindow(false);
    setCharterWindowErrors({});
  };

  const saveCharterWindow = () => {
    const errors = validateCharterWindow(charterStartDraft, charterEndDraft);
    setCharterWindowErrors(errors);
    if (errors.start || errors.end) return;

    updateAssuranceSet({
      ...assuranceSet,
      charterWindowStart: charterStartDraft,
      charterWindowEnd: charterEndDraft,
    });
    setIsEditingCharterWindow(false);
    setProjectToast('Contract Period updated.');
    setTimeout(() => setProjectToast(null), 3500);
  };

  const closeAddToProject = () => {
    setIsAddToProjectOpen(false);
    setTargetProjectId('');
    setAddToProjectError(null);
  };

  const handleAddToProject = () => {
    const result = attachAssuranceSetToProject(assuranceSet.id, targetProjectId);
    if (!result.success) {
      setAddToProjectError(result.message || 'The assurance set could not be added to the project.');
      return;
    }
    const projectName = projects.find((p) => p.id === targetProjectId)?.name || targetProjectId;
    closeAddToProject();
    setProjectToast(`Added to project ${projectName}.`);
    setTimeout(() => setProjectToast(null), 3500);
  };
  const canUpload = roleActions.canUpload;
  const stakeholderLockReason = getAssuranceSetStakeholderLockReason(assuranceSet);
  const canEditStakeholders = canEditAssuranceSetStakeholders(assuranceSet, activePersona);
  const isLinkedSubSet = (req: AssuranceRequirement) =>
    req.fulfillmentType === 'assurance_set' || Boolean(req.linkedAssuranceSetId);

  const assignStakeholder = (
    role: 'Submitter' | 'Verifier' | 'Inspector' | 'Approver',
    assigneeName: string,
  ) => {
    const result = updateAssuranceStakeholder(assuranceSet.id, role, assigneeName);
    if (!result.success) {
      setStakeholderError(result.message || 'The stakeholder could not be assigned.');
      return;
    }
    setStakeholderError(null);
    setEditingRole(null);
  };

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
      return <span className="badge bg-warning text-dark font-mono-code px-2.5 py-1.5" style={{ fontSize: '0.75rem' }}>Returned for Correction</span>;
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
        Requirement: req.title,
        OcrConfidence: `${effectiveOcr}%`,
        Status: getStatusDisplayLabel(req.verifierStatus || (req.isFulfilled ? 'Approved' : 'Pending')),
        Notes: req.notes || '',
      };
    });
    exportToCsv(`${assuranceSet.id}_Requirements`, exportData);
    setIsExportOpen(false);
  };

  const handleExportPdf = () => {
    const headers = ['Requirement', 'OCR Confidence', 'Status', 'Notes'];
    const rows = assuranceSet.requirements.map((req) => {
      const linkedDoc = documents.find((d) => d.id === req.documentId || (req.linkedDocumentId && d.id === req.linkedDocumentId));
      const hasAttachedDoc = Boolean(linkedDoc || req.documentId || req.linkedDocumentId);
      const effectiveOcr = hasAttachedDoc ? (req.ocrConfidence || linkedDoc?.ocrConfidence || 0) : 0;
      return [
        req.title,
        `${effectiveOcr}%`,
        getStatusDisplayLabel(req.verifierStatus || (req.isFulfilled ? 'Approved' : 'Pending')),
        req.notes || '-',
      ];
    });
    exportToPdf(`${assuranceSet.id} Requirements`, headers, rows);
    setIsExportOpen(false);
  };

  return (
    <div className="d-flex flex-column gap-4">
      {projectToast && (
        <div className="alert alert-success py-2 mb-0" role="status">{projectToast}</div>
      )}

      {/* Top Row: Campaign Summary Information Card + Compact Stage Pipeline */}
      <div className="row g-4 align-items-stretch">
        {/* Left: Assurance Set Information & Stakeholder Role Assignments Card */}
        <div className="col-lg-8 col-md-7">
          <div className="card map-card-custom p-4 h-100">
            <div className="d-flex flex-wrap align-items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="fw-bold mb-0 text-primary">{assuranceSet.title}</h3>
               
              </div>
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
                {roleActions.canInspect && (
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={() => setCurrentHashView('inspector', assuranceSet.vesselName)}
                  >
                    Open Inspection
                  </button>
                )}
                {roleActions.canApprove && (
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={() => setCurrentHashView('approver', assuranceSet.id)}
                  >
                    Open Approval
                  </button>
                )}
                <div className="dropdown position-relative">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary text-dark dropdown-toggle"
                    onClick={() => setIsExportOpen(!isExportOpen)}
                  >
                    Export
                  </button>
                  {isExportOpen && (
                    <ul className="dropdown-menu dropdown-menu-light show position-absolute end-0 mt-1 shadow border" style={{ zIndex: 1050 }}>
                      <li>
                        <button type="button" className="dropdown-item small" onClick={handleExportCsv}>
                          CSV
                        </button>
                      </li>
                      <li>
                        <button type="button" className="dropdown-item small" onClick={handleExportPdf}>
                          PDF
                        </button>
                      </li>
                    </ul>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 bg-light border rounded-3 font-mono-code small">
              <div className="row g-4">
                {/* Assurance Set Information */}
                <div className="col-md-6 d-flex flex-column gap-3">
                  <div className="d-flex align-items-center justify-content-between mb-1">
                    <span className="text-uppercase fw-bold text-secondary" style={{ fontSize: '0.725rem', letterSpacing: '0.05em' }}>
                      Details
                    </span>
                  </div>
                  <div className="map-detail-row border-bottom pb-2">
                    <div className="text-secondary" style={{ fontSize: '0.725rem' }}>Set ID:</div>
                    <div className="fw-bold text-dark">{assuranceSet.id}</div>
                  </div>
                  <div className="map-detail-row border-bottom pb-2">
                    <div className="d-flex align-items-center justify-content-between">
                      <div className="text-secondary" style={{ fontSize: '0.725rem' }}>Project:</div>
                      {canAddToProject && (
                        <button
                          type="button"
                          className="btn btn-link p-0 text-decoration-none small font-mono-code ms-auto"
                          style={{ fontSize: '0.7rem', color: '#0284c7' }}
                          onClick={() => setIsAddToProjectOpen(true)}
                        >
                          Add to Project
                        </button>
                      )}
                    </div>
                    {linkedProject ? (
                      <button
                        type="button"
                        className="d-block w-100 p-0 border-0 bg-transparent fw-bold text-dark text-start"
                        style={{ fontSize: 'inherit', lineHeight: 'inherit', fontFamily: 'inherit', cursor: 'pointer' }}
                        onClick={() => setCurrentHashView('project', linkedProject.id)}
                      >
                        {linkedProject.name} ({linkedProject.id})
                      </button>
                    ) : (
                      <div className="fw-bold text-dark">No project</div>
                    )}
                  </div>
                  <div className="map-detail-row border-bottom pb-2">
                    <div className="text-secondary" style={{ fontSize: '0.725rem' }}>Created By:</div>
                    <div className="fw-bold text-dark">
                      {creator.name
                        ? creator.organization && creator.organization !== clientOwnerOrg
                          ? `${creator.name} (${creator.organization})`
                          : creator.name
                        : creator.organization}
                    </div>
                  </div>
                  <div className="map-detail-row border-bottom pb-2">
                    <div className="text-secondary" style={{ fontSize: '0.725rem' }}>Client:</div>
                    <div className="fw-bold text-dark">{clientOwnerOrg}</div>
                  </div>
                  {serviceProviderOrg && (
                    <div className="map-detail-row border-bottom pb-2">
                      <div className="text-secondary" style={{ fontSize: '0.725rem' }}>Service Provider:</div>
                      <div className="fw-bold text-dark">{serviceProviderOrg}</div>
                    </div>
                  )}
                  <div className="map-detail-row border-bottom pb-2">
                    <div className="text-secondary" style={{ fontSize: '0.725rem' }}>Scope:</div>
                    <div className="fw-bold text-dark">{assuredAsset.typeLabel}</div>
                  </div>
                  <div className="map-detail-row border-bottom pb-2">
                    <div className="text-secondary" style={{ fontSize: '0.725rem' }}>Asset:</div>
                    {assuredAsset.view ? (
                      <button
                        type="button"
                        className="d-block w-100 p-0 border-0 bg-transparent fw-bold text-dark text-start"
                        style={{ fontSize: 'inherit', lineHeight: 'inherit', fontFamily: 'inherit', cursor: 'pointer' }}
                        onClick={() => setCurrentHashView(assuredAsset.view as string, assuredAsset.entityId)}
                      >
                        {assuredAsset.name}
                      </button>
                    ) : (
                      <div className="fw-bold text-dark">{assuredAsset.name}</div>
                    )}
                  </div>
                  <div className="map-detail-row">
                    <div className="d-flex align-items-center justify-content-between">
                      <div className="text-secondary" style={{ fontSize: '0.725rem' }}>Contract Period:</div>
                      {canEditCharterWindow && (
                        <button
                          type="button"
                          className="btn btn-link p-0 text-decoration-none small font-mono-code ms-auto"
                          style={{ fontSize: '0.7rem', color: '#0284c7' }}
                          onClick={isEditingCharterWindow ? cancelCharterWindowEdit : startCharterWindowEdit}
                        >
                          {isEditingCharterWindow ? 'Cancel' : 'Edit'}
                        </button>
                      )}
                    </div>
                    {isEditingCharterWindow ? (
                      <div className="mt-1 d-flex flex-column gap-2">
                        <div>
                          <label className="form-label text-secondary small mb-1" htmlFor="charter-window-start">
                            Start <span className="text-danger">*</span>
                          </label>
                          <input
                            id="charter-window-start"
                            type="date"
                            className={`form-control form-control-sm bg-white text-dark${charterWindowErrors.start ? ' is-invalid border-danger' : ''}`}
                            value={charterStartDraft}
                            min={minCharterDate}
                            onChange={(e) => {
                              setCharterStartDraft(e.target.value);
                              setCharterWindowErrors((prev) => ({ ...prev, start: undefined }));
                            }}
                          />
                          {charterWindowErrors.start && (
                            <div className="invalid-feedback d-block small">{charterWindowErrors.start}</div>
                          )}
                        </div>
                        <div>
                          <label className="form-label text-secondary small mb-1" htmlFor="charter-window-end">
                            End <span className="text-danger">*</span>
                          </label>
                          <input
                            id="charter-window-end"
                            type="date"
                            className={`form-control form-control-sm bg-white text-dark${charterWindowErrors.end ? ' is-invalid border-danger' : ''}`}
                            value={charterEndDraft}
                            min={charterStartDraft && charterStartDraft > minCharterDate ? charterStartDraft : minCharterDate}
                            onChange={(e) => {
                              setCharterEndDraft(e.target.value);
                              setCharterWindowErrors((prev) => ({ ...prev, end: undefined }));
                            }}
                          />
                          {charterWindowErrors.end && (
                            <div className="invalid-feedback d-block small">{charterWindowErrors.end}</div>
                          )}
                        </div>
                        <div>
                          <button type="button" className="btn btn-sm btn-primary" onClick={saveCharterWindow}>
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="fw-bold text-dark">{formatMaritimeDate(assuranceSet.charterWindowStart)} - {formatMaritimeDate(assuranceSet.charterWindowEnd)}</div>
                    )}
                    {roleActions.canManage && isCharterWindowLocked && (
                      <div className="text-secondary mt-1" style={{ fontSize: '0.7rem' }}>
                        Locked once the set is approved or certified.
                      </div>
                    )}
                  </div>
                </div>

                {/* Stakeholder Role Assignments */}
                <div className="col-md-6 d-flex flex-column gap-3">
                  <div className="text-uppercase fw-bold text-secondary mb-1" style={{ fontSize: '0.725rem', letterSpacing: '0.05em' }}>
                    Stakeholders
                  </div>
                  {stakeholderError && (
                    <div className="alert alert-danger py-2 small mb-0">{stakeholderError}</div>
                  )}
                  {!canEditStakeholders && stakeholderLockReason && (isCAdmin || activePersona === 'Administrator') && (
                    <div className="alert alert-light border py-2 small mb-0 text-secondary">
                      {stakeholderLockReason}
                    </div>
                  )}

                  {/* Review Channel: who may verify and approve this set */}
                  <div className="map-detail-row border-bottom pb-2">
                    <div className="text-secondary" style={{ fontSize: '0.725rem' }}>Review Channel:</div>
                    <div className="fw-bold text-dark">{formatReviewChannel(assuranceSet)}</div>
                  </div>

                  {/* Submitter */}
                  <div className="map-detail-row border-bottom pb-2">
                    <div className="d-flex align-items-center justify-content-between">
                      <div className="text-secondary" style={{ fontSize: '0.725rem' }}>Submitter:</div>
                      {canEditStakeholders && (
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
                            if (e.target.value) assignStakeholder('Submitter', e.target.value);
                          }}
                        >
                          <option value="">Select submitter</option>
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
                          Add a submitter in User Management
                        </button>
                      </div>
                    ) : (
                      <div className="fw-bold text-dark">{assuranceSet.assignedSubmitter || 'M. Chen (Northwind Marine Pty Ltd)'}</div>
                    )}
                  </div>

                  {/* Verifier */}
                  <div className="map-detail-row border-bottom pb-2">
                    <div className="d-flex align-items-center justify-content-between">
                      <div className="text-secondary" style={{ fontSize: '0.725rem' }}>Verifier:</div>
                      {canEditStakeholders && (
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
                            if (e.target.value) assignStakeholder('Verifier', e.target.value);
                          }}
                        >
                          <option value="">Select verifier</option>
                          {verifierCandidates.map((u) => (
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
                          Add a verifier in User Management
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
                  <div className="map-detail-row border-bottom pb-2">
                    <div className="d-flex align-items-center justify-content-between">
                      <div className="text-secondary" style={{ fontSize: '0.725rem' }}>Inspector:</div>
                      {canEditStakeholders && (
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
                            if (e.target.value) assignStakeholder('Inspector', e.target.value);
                          }}
                        >
                          <option value="">Select inspector</option>
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
                          Add an inspector in User Management
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
                  <div className="map-detail-row">
                    <div className="d-flex align-items-center justify-content-between">
                      <div className="text-secondary" style={{ fontSize: '0.725rem' }}>Approver:</div>
                      {canEditStakeholders && (
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
                            if (e.target.value) assignStakeholder('Approver', e.target.value);
                          }}
                        >
                          <option value="">Select approver</option>
                          {approverCandidates.map((u) => (
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
                          Add an approver in User Management
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
          <div className="card map-card-custom p-4 h-100">
            <div className="p-4 bg-light border rounded-3 h-100 d-flex flex-column gap-4">
              <div>
                <div className="text-uppercase font-mono-code fw-bold text-secondary mb-3" style={{ fontSize: '0.725rem', letterSpacing: '0.05em' }}>
                  Stage
                </div>
                <PipelineStepper
                  currentStage={assuranceSet.stage}
                  readinessScore={calculateAssuranceSetReadiness(assuranceSet)}
                  assuranceSet={assuranceSet}
                  orientation="vertical"
                />
              </div>

              {/* readiness index sits inside the pipeline panel, pinned to its bottom edge */}
              <div className="mt-auto pt-3 border-top">
                <div className="text-secondary text-uppercase font-mono-code fw-bold mb-2" style={{ fontSize: '0.725rem', letterSpacing: '0.05em' }}>
                  Readiness
                </div>
                <ReadinessGauge score={calculateAssuranceSetReadiness(assuranceSet)} size="md" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row: Requirements Register Table taking full 100% width across two columns */}
      <div className="card map-card-custom">
        <div className="card-header border-bottom p-3">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
            <div>
              <div className="fw-bold text-dark fs-6">
                Requirements
              </div>
            </div>
            <div className="d-flex align-items-center gap-2 ms-auto">
              <div className="dropdown position-relative">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary text-dark dropdown-toggle"
                  onClick={() => setIsExportOpen(!isExportOpen)}
                >
                  Export
                </button>
                {isExportOpen && (
                  <ul className="dropdown-menu dropdown-menu-light show position-absolute end-0 mt-1 shadow border" style={{ zIndex: 1050 }}>
                    <li>
                      <button type="button" className="dropdown-item small" onClick={handleExportCsv}>
                        CSV
                      </button>
                    </li>
                    <li>
                      <button type="button" className="dropdown-item small" onClick={handleExportPdf}>
                        PDF
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
                  Upload Document
                </button>
              )}
            </div>
          </div>

        </div>
        <div className="table-responsive">
          <table className="table map-table-custom align-middle mb-0">
            <thead>
              <tr>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => handleReqSort('title')}
                >
                  Requirement {renderSortIndicator('title')}
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
              {pageMainRequirements.map((req: AssuranceRequirement) => {
                const linkedDoc = documents.find((d) => d.id === req.documentId || (req.linkedDocumentId && d.id === req.linkedDocumentId));
                const linkedChildSet = req.linkedAssuranceSetId
                  ? assuranceSets.find((s) => s.id === req.linkedAssuranceSetId)
                  : undefined;
                const hasAttachedDoc = Boolean(linkedDoc || req.documentId || req.linkedDocumentId);
                const effectiveOcr = hasAttachedDoc ? (req.ocrConfidence || linkedDoc?.ocrConfidence || 0) : 0;

                if (isLinkedSubSet(req) && linkedChildSet) {
                  return (
                    <tr key={req.id} className="table-light">
                      <td>
                        <div className="fw-semibold text-dark">{req.title}</div>
                        <div className="d-flex align-items-center gap-1.5 flex-wrap">
                          <span className="font-mono-code small text-primary">{linkedChildSet.id}</span>
                          <span className="badge bg-info text-dark font-mono-code" style={{ fontSize: '0.7rem' }}>
                            Linked Sub-Set
                          </span>
                        </div>
                        {req.description && (
                          <div className="text-secondary small mt-0.5">{req.description}</div>
                        )}
                      </td>
                      <td>
                        <span className="text-muted small">—</span>
                      </td>
                      <td>
                        <span className={`badge ${linkedChildSet.stage === 'Approved' || linkedChildSet.stage === 'Certified' ? 'bg-success' : 'bg-secondary'} font-mono-code`}>
                          {linkedChildSet.stage}
                        </span>
                      </td>
                      <td className="text-end">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center p-0"
                          style={{ width: '32px', height: '32px' }}
                          onClick={() => setCurrentHashView('assurance-sets', linkedChildSet.id)}
                          title="View"
                          aria-label="View"
                        >
                          <FolderOpen size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={req.id}>
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
                            Custom
                          </span>
                        )}
                      </div>
                      {req.description && (
                        <div className="text-secondary small mt-0.5" style={{ fontSize: '0.78rem', lineHeight: '1.4' }}>
                          {req.description}
                        </div>
                      )}
                      {(req.assignedSubmitter || req.assignedVerifier) && (
                        <div className="font-mono-code text-muted mt-1 d-flex align-items-center gap-2 flex-wrap" style={{ fontSize: '0.7rem' }}>
                          {req.assignedSubmitter && (
                            <span><span className="text-secondary fw-semibold">Submitter:</span> {req.assignedSubmitter.split(' (')[0]}</span>
                          )}
                          {req.assignedSubmitter && req.assignedVerifier && <span>·</span>}
                          {req.assignedVerifier && (
                            <span><span className="text-secondary fw-semibold">Verifier:</span> {req.assignedVerifier.split(' (')[0]}</span>
                          )}
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
                      <div className="d-flex align-items-center justify-content-end gap-1.5 flex-wrap">
                        {linkedDoc ? (
                          <>
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
                            {canUpload && linkedDoc.verificationStatus !== 'Verified' && (
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center justify-content-center p-0"
                                style={{ width: '32px', height: '32px' }}
                                onClick={() => openRequirementUpload(req, linkedDoc)}
                                title="Upload new version"
                                aria-label="Upload new version"
                              >
                                <RefreshCw size={16} />
                              </button>
                            )}
                          </>
                        ) : canUpload ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-primary text-white d-inline-flex align-items-center justify-content-center p-0"
                            style={{ width: '32px', height: '32px' }}
                            onClick={() => openRequirementUpload(req)}
                            title="Upload document"
                            aria-label="Upload document"
                          >
                            <Upload size={16} />
                          </button>
                        ) : (
                          <span className="text-secondary small font-mono-code">No Document</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* Other Documents Section Title: shown on the page that holds other documents, or on the last page */}
              {(pageOtherRequirements.length > 0 || isLastRequirementsPage) && (
                <tr className="bg-light border-top border-bottom">
                  <td colSpan={4} className="py-2.5 px-3">
                    <div className="d-flex align-items-center justify-content-between">
                      <span className="fw-bold text-secondary text-uppercase font-mono-code" style={{ fontSize: '0.75rem', letterSpacing: '0.05em' }}>
                        Other Documents
                      </span>
                    </div>
                  </td>
                </tr>
              )}

              {/* Other Documents Rows */}
              {otherRequirements.length > 0 ? (
                pageOtherRequirements.map((req: AssuranceRequirement) => {
                  const linkedDoc = documents.find((d) => d.id === req.documentId || (req.linkedDocumentId && d.id === req.linkedDocumentId));
                  const hasAttachedDoc = Boolean(linkedDoc || req.documentId || req.linkedDocumentId);
                  const effectiveOcr = hasAttachedDoc ? (req.ocrConfidence || linkedDoc?.ocrConfidence || 0) : 0;

                  return (
                    <tr key={req.id}>
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
                        <div className="d-flex align-items-center justify-content-end gap-1.5 flex-wrap">
                          {linkedDoc ? (
                            <>
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
                              {canUpload && linkedDoc.verificationStatus !== 'Verified' && (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center justify-content-center p-0"
                                  style={{ width: '32px', height: '32px' }}
                                  onClick={() => openRequirementUpload(req, linkedDoc)}
                                  title="Upload new version"
                                  aria-label="Upload new version"
                                >
                                  <RefreshCw size={16} />
                                </button>
                              )}
                            </>
                          ) : canUpload ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-primary text-white d-inline-flex align-items-center justify-content-center p-0"
                              style={{ width: '32px', height: '32px' }}
                              onClick={() => openRequirementUpload(req)}
                              title="Upload document"
                              aria-label="Upload document"
                            >
                              <Upload size={16} />
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
                isLastRequirementsPage && (
                  <tr>
                    <td colSpan={4} className="text-center text-muted py-3 small font-mono-code">
                      No other documents yet.
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
        <TablePagination {...requirementsPagination.controls} />
      </div>

      {/* Document Review Drawer */}
      <DocumentReviewDrawer
        document={selectedDocForReview?.doc || null}
        requirementNotes={selectedDocForReview?.notes}
        onClose={() => setSelectedDocForReview(null)}
        allowSubmit={roleActions.canUpload}
        allowVerify={roleActions.canVerify}
      />

      {/* add an orphaned set to one existing project */}
      {isAddToProjectOpen && (
        <div
          className="modal fade show d-block"
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-to-project-title"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 1055 }}
        >
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '480px' }}>
            <div className="modal-content border-0 rounded-3">
              <div className="modal-header border-bottom px-4 py-3">
                <h5 id="add-to-project-title" className="modal-title fw-bold text-dark fs-6">Add to Project</h5>
                <button type="button" className="btn-close" onClick={closeAddToProject} aria-label="Close" />
              </div>
              <div className="modal-body px-4 py-4">
                {attachableProjects.length === 0 ? (
                  <p className="text-secondary small mb-0">
                    No projects yet. Create a project first.
                  </p>
                ) : (
                  <>
                    <label className="form-label text-secondary small fw-semibold" htmlFor="add-to-project-select">
                      Project <span className="text-danger">*</span>
                    </label>
                    <select
                      id="add-to-project-select"
                      className={`form-select bg-white text-dark border-secondary-subtle${addToProjectError ? ' is-invalid border-danger' : ''}`}
                      value={targetProjectId}
                      onChange={(e) => {
                        setTargetProjectId(e.target.value);
                        setAddToProjectError(null);
                      }}
                    >
                      <option value="">Select a project</option>
                      {attachableProjects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.id} &mdash; {p.name}
                        </option>
                      ))}
                    </select>
                    {addToProjectError && (
                      <div className="invalid-feedback d-block small mt-1">{addToProjectError}</div>
                    )}
                    <div className="form-text small">An assurance set can belong to one project only.</div>
                  </>
                )}
              </div>
              <div className="modal-footer border-top px-4 py-3">
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={closeAddToProject}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  disabled={!targetProjectId}
                  onClick={handleAddToProject}
                >
                  Add to Project
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
