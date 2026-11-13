/* 
  file summary: row component rendering a single requirement within AssuranceDetailView.
  responsibilities: renders the primary requirement table row, expansion toggle, title, 'Reused from vault' badge, version badge, target object, verification status, action buttons, and expanded requirement details.
  role in system: extracted from AssuranceDetailView.tsx to comply with Map Design System §12 file modularity standards.
*/

import React from 'react';
import { ChevronDown, ChevronRight, FileText, Pencil, Trash2 } from 'lucide-react';
import { AssuranceRequirement, AssuranceSet } from '../../types/assurance';
import { MasterDocument } from '../../types/document';
import { UserProfile } from '../../types/user';
import { ReusedDocumentBadge } from '../common/ReusedDocumentBadge';
import { ConfidenceBadge } from '../common/ConfidenceBadge';
import { formatMaritimeDate, formatMaritimeDateTime } from '../../utils/formatters';
import {
  RequirementDocumentView,
  isRequirementOnOlderVersion,
} from '../../utils/documentVersionSnapshot';
import { getValidityInContractPeriod } from '../../utils/expiryPolicy';

export interface AssuranceRequirementRowProps {
  req: AssuranceRequirement;
  assuranceSet: AssuranceSet;
  documents: MasterDocument[];
  users: UserProfile[];
  setObjects?: any;
  isSubmitter: boolean;
  isVerifier: boolean;
  isApproverOrInspector: boolean;
  isClientViewer: boolean;
  viewerPartyOrg?: string;
  isAssignedReviewer: boolean;
  canEditTasks: boolean;
  reqTableColSpan: number;
  isReqExpanded: boolean;
  toggleReqExpand: (id: string) => void;
  openEditTask: (req: AssuranceRequirement) => void;
  setTaskToDelete: (req: AssuranceRequirement) => void;
  setSelectedDocForReview: (info: {
    doc: MasterDocument;
    notes?: string;
    requirementId?: string;
    verifierStatus?: string;
    isVersionLocked?: boolean;
  }) => void;
  canViewDoc: boolean;
  effectiveLinkedDoc?: MasterDocument;
  docView?: RequirementDocumentView;
  effectiveOcr: number;
  renderRowStatusBadge: (
    req: AssuranceRequirement,
    docView?: RequirementDocumentView,
    canViewDoc?: boolean,
    isShared?: boolean,
    sharedCount?: number,
  ) => React.ReactNode;
  renderVersionBadge: (
    req: AssuranceRequirement,
    docView?: RequirementDocumentView,
    canViewDoc?: boolean,
  ) => React.ReactNode;
  renderValidityBadge: (
    req: AssuranceRequirement,
    docView?: RequirementDocumentView,
    canViewDoc?: boolean,
  ) => React.ReactNode;
  renderRequirementStatus: (req: AssuranceRequirement, canViewDoc: boolean) => React.ReactNode;
  renderContractShortWarning: (doc?: MasterDocument, canViewDoc?: boolean) => React.ReactNode;
  resolveRequirementTargetObject: (req: AssuranceRequirement) => { name: string; identifier?: string };
}

export const AssuranceRequirementRow: React.FC<AssuranceRequirementRowProps> = ({
  req,
  assuranceSet,
  documents,
  isSubmitter,
  isVerifier,
  isApproverOrInspector,
  canEditTasks,
  reqTableColSpan,
  isReqExpanded,
  toggleReqExpand,
  openEditTask,
  setTaskToDelete,
  setSelectedDocForReview,
  canViewDoc,
  effectiveLinkedDoc,
  docView,
  effectiveOcr,
  renderRowStatusBadge,
  renderVersionBadge,
  renderValidityBadge,
  renderRequirementStatus,
  renderContractShortWarning,
  resolveRequirementTargetObject,
}) => {
  return (
    <>
      <tr data-requirement-id={req.id}>
        <td>
          <div className="d-flex align-items-center">
            <button
              type="button"
              className="btn btn-sm btn-link p-0 me-2 text-dark text-decoration-none d-inline-flex align-items-center"
              onClick={() => toggleReqExpand(req.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  toggleReqExpand(req.id);
                }
              }}
              aria-expanded={isReqExpanded}
              aria-label={isReqExpanded ? `Collapse ${req.title}` : `Expand ${req.title}`}
              data-testid={`toggle-req-${req.id}`}
            >
              {isReqExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            <div>
              <div className="fw-semibold text-dark d-flex align-items-center gap-1.5 flex-wrap">
                <span>{req.title}</span>
                {req.reusedDocument && <ReusedDocumentBadge />}
                {renderRowStatusBadge(req, docView, canViewDoc, false, 0)}
                {(docView?.isLocked || isRequirementOnOlderVersion(req, assuranceSet, documents)) &&
                  renderVersionBadge(req, docView, canViewDoc)}
              </div>
            </div>
          </div>
        </td>
        {isVerifier ? (
          <td style={{ whiteSpace: 'nowrap' }}>
            {renderVersionBadge(req, docView, canViewDoc) || (
              <span className="text-muted small">—</span>
            )}
          </td>
        ) : isApproverOrInspector ? (
          <td style={{ whiteSpace: 'nowrap' }}>
            {renderValidityBadge(req, docView, canViewDoc)}
          </td>
        ) : !isSubmitter ? (
          <td style={{ whiteSpace: 'nowrap' }}>
            {(() => {
              const targetObj = resolveRequirementTargetObject(req);
              return (
                <div>
                  <div className="fw-semibold text-dark">{targetObj.name}</div>
                  {targetObj.identifier && (
                    <div className="text-muted font-mono-code" style={{ fontSize: '0.72rem' }}>
                      {targetObj.identifier}
                    </div>
                  )}
                </div>
              );
            })()}
          </td>
        ) : null}
        <td>{renderRequirementStatus(req, canViewDoc)}</td>
        <td className="text-end">
          <div className="d-flex align-items-center justify-content-end gap-1.5 flex-wrap">
            {canEditTasks && !isApproverOrInspector && !isSubmitter && !isVerifier && (
              <>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center justify-content-center p-0"
                  style={{ width: '32px', height: '32px' }}
                  onClick={() => openEditTask(req)}
                  title="Edit task"
                  aria-label="Edit task"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger d-inline-flex align-items-center justify-content-center p-0"
                  style={{ width: '32px', height: '32px' }}
                  onClick={() => setTaskToDelete(req)}
                  title="Remove task"
                  aria-label="Remove task"
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
            {effectiveLinkedDoc && canViewDoc ? (
              !isSubmitter ? (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center p-0"
                  style={{ width: '32px', height: '32px' }}
                  onClick={() =>
                    setSelectedDocForReview({
                      doc: docView?.doc || effectiveLinkedDoc,
                      notes: req.notes,
                      requirementId: req.id,
                      verifierStatus: req.verifierStatus,
                      isVersionLocked: docView?.isLocked,
                    })
                  }
                  title="PDF Review"
                  aria-label="PDF Review"
                >
                  <FileText size={16} />
                </button>
              ) : null
            ) : (
              <span className="text-secondary small">No Document</span>
            )}
          </div>
        </td>
      </tr>
      {isReqExpanded && (
        <tr data-testid={`req-detail-${req.id}`} className="bg-light-subtle">
          <td colSpan={reqTableColSpan} className="py-2.5 px-4">
            <div className="d-flex flex-column gap-2" style={{ fontSize: '0.78rem' }}>
              {(renderVersionBadge(req, docView, canViewDoc) ||
                req.attemptNumber ||
                req.isOtherDocument ||
                req.isSpecialized) && (
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  {renderVersionBadge(req, docView, canViewDoc)}
                  {req.attemptNumber && (
                    <span
                      className="badge bg-light text-secondary border"
                      style={{ fontSize: '0.65rem' }}
                    >
                      Attempt {req.attemptNumber}
                    </span>
                  )}
                  {req.isOtherDocument && (
                    <span
                      className="badge bg-secondary-subtle text-dark border"
                      style={{ fontSize: '0.65rem' }}
                      data-testid={`badge-other-doc-${req.id}`}
                      title="Added by client"
                    >
                      Added by client
                    </span>
                  )}
                  {req.isSpecialized && (
                    <span
                      className="badge bg-info-subtle text-info-emphasis border border-info-subtle"
                      style={{ fontSize: '0.65rem' }}
                    >
                      Custom
                    </span>
                  )}
                </div>
              )}
              {(isSubmitter || isVerifier || isApproverOrInspector) && (() => {
                const targetObj = resolveRequirementTargetObject(req);
                return (
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <span className="text-secondary fw-semibold">Target Object:</span>
                    <span className="text-dark">{targetObj.name}</span>
                    {targetObj.identifier && (
                      <span className="text-muted font-mono-code small">
                        ({targetObj.identifier})
                      </span>
                    )}
                  </div>
                );
              })()}
              {req.description && (
                <div className="text-secondary" style={{ lineHeight: '1.4' }}>
                  {req.description}
                </div>
              )}
              {isSubmitter && effectiveLinkedDoc && canViewDoc && (
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1.5 px-2.5 py-1"
                    onClick={() =>
                      setSelectedDocForReview({
                        doc: docView?.doc || effectiveLinkedDoc,
                        notes: req.notes,
                        requirementId: req.id,
                        verifierStatus: req.verifierStatus,
                        isVersionLocked: docView?.isLocked,
                      })
                    }
                    title="PDF Review"
                    aria-label="PDF Review"
                  >
                    <FileText size={14} />
                    <span>PDF Review</span>
                  </button>
                </div>
              )}
              <div className="d-flex align-items-center gap-3 flex-wrap">
                <div className="d-flex align-items-center gap-1.5">
                  <span className="text-secondary fw-semibold">OCR Confidence:</span>
                  <ConfidenceBadge score={effectiveOcr} />
                </div>
                {(req.assignedSubmitter || req.assignedVerifier) && (
                  <div className="text-muted d-flex align-items-center gap-2 flex-wrap">
                    {req.assignedSubmitter && (
                      <span>
                        <span className="text-secondary fw-semibold">Submitter:</span>{' '}
                        {req.assignedSubmitter.split(' (')[0]}
                      </span>
                    )}
                    {req.assignedSubmitter && req.assignedVerifier && <span>·</span>}
                    {req.assignedVerifier && (
                      <span>
                        <span className="text-secondary fw-semibold">Verifier:</span>{' '}
                        {req.assignedVerifier.split(' (')[0]}
                      </span>
                    )}
                  </div>
                )}
                {req.decisionTime && (
                  <div className="text-muted">
                    <span className="text-secondary fw-semibold">Decision:</span>{' '}
                    {formatMaritimeDateTime(req.decisionTime)}
                  </div>
                )}
                {req.verifierStatus === 'Verified' && (
                  <div className="text-muted">
                    <span className="text-secondary fw-semibold">Method:</span>{' '}
                    {req.verificationMethod || 'Not recorded'}
                    {req.overrideReason && (
                      <span className="ms-2 text-warning-emphasis" title={req.overrideReason}>
                        · Override
                      </span>
                    )}
                  </div>
                )}
              </div>
              {renderContractShortWarning(docView?.doc || effectiveLinkedDoc, canViewDoc)}
              {docView &&
                canViewDoc &&
                (() => {
                  const validity = getValidityInContractPeriod(docView.doc.expiryDate, assuranceSet);
                  if (validity.state === 'unknown') return null;
                  const tone =
                    validity.state === 'valid_through_period'
                      ? 'bg-success-subtle text-success-emphasis border-success-subtle'
                      : validity.state === 'lapsed'
                        ? 'bg-danger-subtle text-danger-emphasis border-danger-subtle'
                        : 'bg-warning-subtle text-warning-emphasis border-warning-subtle';
                  return (
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      <span className={`badge border ${tone}`}>{validity.label}</span>
                      {validity.state !== 'valid_through_period' && validity.expiryDate && (
                        <span className="text-muted">
                          {formatMaritimeDate(validity.expiryDate)}
                          {validity.state === 'lapsed' && (
                            <>
                              {' '}· {docView.doc.issuingAuthority || 'Issuing authority not recorded'}
                              {' '}· Responsible:{' '}
                              {assuranceSet.serviceProviderOrg || 'Service provider not recorded'}
                            </>
                          )}
                        </span>
                      )}
                    </div>
                  );
                })()}
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

export default AssuranceRequirementRow;
