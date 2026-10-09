/* 
  file summary: stcw crew member drill-down detail view presenting historical sea service vessel assignments and layered stcw compliance registers.
  responsibilities: renders stcw layer 1 core documents, layer 2 vessel-specific endorsements, historical sea service assignments, photo gallery with cropping tool, and enforces admin/submitter document viewing, uploading, and updating permissions.
  role in system: deep-dive view rendered when a crew directory row is selected or navigated to (/crew/CREW-101).
*/

import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Camera,
  Crop,
  Eye,
  ExternalLink,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useMapStore } from '../store/useMapStore';
import { STCWDocumentItem, CrewVesselAssignment, CrewMember } from '../types/crew';
import { ReadinessGauge } from '../components/common/ReadinessGauge';
import { formatMaritimeDate, getStatusDisplayLabel } from '../utils/formatters';
import { exportToCsv, exportToPdf } from '../utils/exportHelpers';
import { CrewDocumentUploadModal } from '../components/drawers/CrewDocumentUploadModal';
import { CrewDocumentViewerModal } from '../components/drawers/CrewDocumentViewerModal';
import { getProjectOrganizationForPersona, isCrewOwnedByOrganization } from '../utils/projectHelpers';
import { ImageCropModal } from '../components/drawers/VesselImageCropModal';
import { CURATED_CREW_PHOTOS, getCrewStockPhoto } from '../utils/vesselImageHelpers';

interface CrewDetailViewProps {
  crewId: string;
}

export const CrewDetailView: React.FC<CrewDetailViewProps> = ({ crewId }) => {
  const {
    crew,
    activePersona,
    setCurrentHashView,
    previousHashView,
    previousEntityId,
    deleteCrewDocument,
    updateCrewMember,
    users,
    setCreateAssuranceForAsset,
  } = useMapStore();

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadLayer, setUploadLayer] = useState<import('../types/crew').STCWLayer | undefined>(undefined);
  const [editingDoc, setEditingDoc] = useState<STCWDocumentItem | null>(null);

  const [isViewerModalOpen, setIsViewerModalOpen] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<STCWDocumentItem | null>(null);

  const [isExportOpen, setIsExportOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  /* Photo gallery & cropping modal states */
  const [showPhotoUploadModal, setShowPhotoUploadModal] = useState(false);
  const [showAddPhotoModal, setShowAddPhotoModal] = useState(false);
  const [customPhotoUrl, setCustomPhotoUrl] = useState('');
  const [photoModalUrl, setPhotoModalUrl] = useState('');
  const [modalPhotos, setModalPhotos] = useState<string[]>([]);
  const [selectedViewPhotoUrl, setSelectedViewPhotoUrl] = useState<string>('');
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [cropModalImageSrc, setCropModalImageSrc] = useState('');
  const [cropTargetIdx, setCropTargetIdx] = useState<number | null>(null);
  const [draggedPhotoIdx, setDraggedPhotoIdx] = useState<number | null>(null);
  const [dragOverPhotoIdx, setDragOverPhotoIdx] = useState<number | null>(null);
  const photoFileInputRef = useRef<HTMLInputElement>(null);

  const crewMember = crew.find((c) => c.id === crewId) || crew[0];
  const canManageDocuments = activePersona === 'Administrator' || activePersona === 'Submitter';
  const canManagePhotos = activePersona === 'Administrator' || activePersona === 'Submitter';
  /* hire is offered to admins for crew from other organizations only */
  const canHireCrew = Boolean(
    crewMember &&
    (activePersona === 'Administrator' || activePersona === 'C Admin') &&
    !isCrewOwnedByOrganization(crewMember, getProjectOrganizationForPersona(activePersona, users)),
  );

  useEffect(() => {
    if (crewMember) {
      const stockUrl = getCrewStockPhoto(crewMember.id, crewMember.fullName, crewMember.rank);
      const coverUrl = crewMember.imageUrl || (crewMember.photos && crewMember.photos.length > 0 ? crewMember.photos[0] : stockUrl);
      setPhotoModalUrl(coverUrl);
      setSelectedViewPhotoUrl(coverUrl);
      let initialPhotos = crewMember.photos && crewMember.photos.length > 0 ? [...crewMember.photos] : [coverUrl];
      if (coverUrl && !initialPhotos.includes(coverUrl)) {
        initialPhotos = [coverUrl, ...initialPhotos];
      }
      setModalPhotos(initialPhotos);
    }
  }, [crewMember, showPhotoUploadModal]);

  /* triggers one-shot shimmer on all crew attribute value cells on mount or crewId change */
  const [isJustLoaded, setIsJustLoaded] = useState(true);
  useEffect(() => {
    setIsJustLoaded(true);
    const timer = setTimeout(() => setIsJustLoaded(false), 800);
    return () => clearTimeout(timer);
  }, [crewId]);

  const activeDisplayPhoto = selectedViewPhotoUrl || crewMember?.imageUrl || getCrewStockPhoto(crewMember?.id, crewMember?.fullName, crewMember?.rank);

  /* Assignment table sorting */
  type AssignmentSortField = 'vesselName' | 'imoNumber' | 'vesselType' | 'rankHeld' | 'embarkDate' | 'disembarkDate' | 'isCurrent';
  const [assignmentSortField, setAssignmentSortField] = useState<AssignmentSortField>('embarkDate');
  const [assignmentSortDirection, setAssignmentSortDirection] = useState<'asc' | 'desc'>('desc');

  /* Layer 1 table sorting */
  type Layer1SortField = 'title' | 'stcwRegulation' | 'certificateNo' | 'issuingAuthority' | 'issueDate' | 'expiryDate' | 'verificationStatus';
  const [layer1SortField, setLayer1SortField] = useState<Layer1SortField>('title');
  const [layer1SortDirection, setLayer1SortDirection] = useState<'asc' | 'desc'>('asc');

  /* Layer 2 table sorting */
  type Layer2SortField = 'title' | 'stcwRegulation' | 'certificateNo' | 'issuingAuthority' | 'flagState' | 'expiryDate' | 'verificationStatus';
  const [layer2SortField, setLayer2SortField] = useState<Layer2SortField>('title');
  const [layer2SortDirection, setLayer2SortDirection] = useState<'asc' | 'desc'>('asc');

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

  const sortedAssignments = useMemo(() => {
    if (!crewMember?.assignments) return [];
    return [...crewMember.assignments].sort((a, b) => {
      let comp = 0;
      if (assignmentSortField === 'vesselName') comp = a.vesselName.localeCompare(b.vesselName);
      else if (assignmentSortField === 'imoNumber') comp = a.imoNumber.localeCompare(b.imoNumber);
      else if (assignmentSortField === 'vesselType') comp = a.vesselType.localeCompare(b.vesselType);
      else if (assignmentSortField === 'rankHeld') comp = a.rankHeld.localeCompare(b.rankHeld);
      else if (assignmentSortField === 'embarkDate') comp = new Date(a.embarkDate).getTime() - new Date(b.embarkDate).getTime();
      else if (assignmentSortField === 'disembarkDate') comp = new Date(a.disembarkDate || '').getTime() - new Date(b.disembarkDate || '').getTime();
      else if (assignmentSortField === 'isCurrent') comp = (a.isCurrent ? 1 : 0) - (b.isCurrent ? 1 : 0);
      return assignmentSortDirection === 'asc' ? comp : -comp;
    });
  }, [crewMember, assignmentSortField, assignmentSortDirection]);

  const sortedLayer1Docs = useMemo(() => {
    if (!crewMember?.layer1CoreDocuments) return [];
    return [...crewMember.layer1CoreDocuments].sort((a, b) => {
      let comp = 0;
      if (layer1SortField === 'title') comp = a.title.localeCompare(b.title);
      else if (layer1SortField === 'stcwRegulation') comp = a.stcwRegulation.localeCompare(b.stcwRegulation);
      else if (layer1SortField === 'certificateNo') comp = a.certificateNo.localeCompare(b.certificateNo);
      else if (layer1SortField === 'issuingAuthority') comp = a.issuingAuthority.localeCompare(b.issuingAuthority);
      else if (layer1SortField === 'issueDate') comp = new Date(a.issueDate || '').getTime() - new Date(b.issueDate || '').getTime();
      else if (layer1SortField === 'expiryDate') comp = new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
      else if (layer1SortField === 'verificationStatus') comp = a.verificationStatus.localeCompare(b.verificationStatus);
      return layer1SortDirection === 'asc' ? comp : -comp;
    });
  }, [crewMember, layer1SortField, layer1SortDirection]);

  const sortedLayer2Docs = useMemo(() => {
    if (!crewMember?.layer2Endorsements) return [];
    return [...crewMember.layer2Endorsements].sort((a, b) => {
      let comp = 0;
      if (layer2SortField === 'title') comp = a.title.localeCompare(b.title);
      else if (layer2SortField === 'stcwRegulation') comp = a.stcwRegulation.localeCompare(b.stcwRegulation);
      else if (layer2SortField === 'certificateNo') comp = a.certificateNo.localeCompare(b.certificateNo);
      else if (layer2SortField === 'issuingAuthority') comp = a.issuingAuthority.localeCompare(b.issuingAuthority);
      else if (layer2SortField === 'flagState') comp = (a.flagState || '').localeCompare(b.flagState || '');
      else if (layer2SortField === 'expiryDate') comp = new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
      else if (layer2SortField === 'verificationStatus') comp = a.verificationStatus.localeCompare(b.verificationStatus);
      return layer2SortDirection === 'asc' ? comp : -comp;
    });
  }, [crewMember, layer2SortField, layer2SortDirection]);

  if (!crewMember) return <div className="p-4">Crew profile not found.</div>;

  const handleExportCsv = () => {
    const coreData = crewMember.layer1CoreDocuments.map((d) => ({
      Category: 'Layer 1 Universal Core',
      DocumentTitle: d.title,
      STCWRegulation: d.stcwRegulation,
      CertificateNo: d.certificateNo,
      IssuingAuthority: d.issuingAuthority,
      ExpiryDate: d.expiryDate,
      VerificationStatus: d.verificationStatus,
    }));

    const endorsementData = crewMember.layer2Endorsements.map((d) => ({
      Category: 'Layer 2 Vessel Specific & Endorsement',
      DocumentTitle: d.title,
      STCWRegulation: d.stcwRegulation,
      CertificateNo: d.certificateNo,
      IssuingAuthority: d.issuingAuthority,
      ExpiryDate: d.expiryDate,
      VerificationStatus: d.verificationStatus,
    }));

    exportToCsv(`${crewMember.id}_${crewMember.fullName.replace(/\s+/g, '_')}_STCW_Profile`, [...coreData, ...endorsementData]);
    setIsExportOpen(false);
  };

  const handleExportPdf = () => {
    const headers = ['Category', 'Document Title', 'STCW Regulation', 'Certificate No', 'Issuing Body', 'Expiry Date', 'Status'];

    const coreRows = crewMember.layer1CoreDocuments.map((d) => [
      'Layer 1 Core',
      d.title,
      d.stcwRegulation,
      d.certificateNo,
      d.issuingAuthority,
      d.expiryDate,
      d.verificationStatus,
    ]);

    const endorsementRows = crewMember.layer2Endorsements.map((d) => [
      'Layer 2 Endorsement',
      d.title,
      d.stcwRegulation,
      d.certificateNo,
      d.issuingAuthority,
      d.expiryDate,
      d.verificationStatus,
    ]);

    exportToPdf(`${crewMember.fullName} Crew Documents`, headers, [...coreRows, ...endorsementRows]);
    setIsExportOpen(false);
  };

  const handleOpenUploadNew = (preferredLayer?: import('../types/crew').STCWLayer) => {
    setEditingDoc(null);
    setUploadLayer(preferredLayer);
    setIsUploadModalOpen(true);
  };

  const handleOpenUpdateDoc = (doc: STCWDocumentItem) => {
    setEditingDoc(doc);
    setUploadLayer(doc.layer);
    setIsUploadModalOpen(true);
  };

  const handleOpenViewDoc = (doc: STCWDocumentItem) => {
    setViewingDoc(doc);
    setIsViewerModalOpen(true);
  };

  const handleDeleteDoc = (docId: string) => {
    if (!canManageDocuments) return;
    deleteCrewDocument(crewMember.id, docId);
  };

  const renderStatusBadge = (status: STCWDocumentItem['verificationStatus']) => {
    switch (status) {
      case 'Verified': return <span className="badge bg-success text-white">Verified</span>;
      case 'Expiring': return <span className="badge bg-warning text-dark">Expiring Soon</span>;
      case 'Expired': return <span className="badge bg-danger text-white">Expired</span>;
      case 'Pending':
      default: return <span className="badge bg-secondary text-white">Pending Audit</span>;
    }
  };

  return (
    <div className="d-flex flex-column gap-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="alert alert-success d-flex align-items-center justify-between shadow-sm p-2 mb-0">
          <span>{toastMessage}</span>
          <button type="button" className="btn-close" onClick={() => setToastMessage(null)} />
        </div>
      )}

      {/* Main Profile Information & STCW Compliance Header Card */}
      <div className="card map-card-custom p-4">
        <div className="d-flex flex-wrap align-items-center justify-between gap-3 mb-3">
          <div className="d-flex align-items-center gap-3">
            <div>
              <h3 className="fw-bold mb-0.5 text-primary">{crewMember.fullName}</h3>
              <div className="text-secondary small font-mono-code d-flex align-items-center gap-2 flex-wrap">
                <span>Vessel:</span>
                {crewMember.currentVesselId ? (
                  <button
                    type="button"
                    className="btn btn-link p-0 text-primary fw-bold border-0 bg-transparent text-decoration-underline font-mono-code align-baseline"
                    onClick={() => setCurrentHashView('vessels', crewMember.currentVesselId)}
                    title={`View ${crewMember.currentVesselName}`}
                  >
                    {crewMember.currentVesselName}
                  </button>
                ) : (
                  <strong>{crewMember.currentVesselName || 'Unassigned / Ashore'}</strong>
                )}
              </div>
            </div>
          </div>

          {/* Opposite Corner Controls: STCW Score Gauge + Export Data Button + Close Button */}
          <div className="d-flex align-items-center gap-3 ms-auto">
            {canHireCrew && (
              <button
                type="button"
                className="btn btn-sm btn-primary fw-semibold"
                onClick={() => {
                  /* charter hand-off: lock the wizard to crew scope and this seafarer */
                  setCreateAssuranceForAsset({ scope: 'Crew', assetId: crewMember.id });
                  setCurrentHashView('create-assurance-set');
                }}
              >
                Hire Crew
              </button>
            )}
            <div className="d-flex flex-column align-items-center">
              <div className="text-secondary small fw-bold text-uppercase" style={{ fontSize: '0.65rem', letterSpacing: '0.05em' }}>
                Readiness
              </div>
              <ReadinessGauge score={crewMember.overallComplianceScore} size="sm" />
            </div>

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

            <button
              type="button"
              className="btn btn-sm btn-light border d-flex align-items-center justify-content-center"
              style={{ width: '32px', height: '32px', borderRadius: '50%' }}
              onClick={() => setCurrentHashView(previousHashView || 'crew', previousEntityId)}
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Section: Photo & Gallery Controls (Left) + Information Summary Box (Right) */}
        <div className="row g-3">
          <div className="col-12 col-lg-4 col-xl-3">
            {/* Seafarer Photo Card with Square 1:1 Aspect Ratio Container */}
            <div
              className={`position-relative overflow-hidden rounded-3 shadow-sm mb-2 mx-auto ${canManagePhotos ? 'cursor-pointer group-photo-container' : ''}`}
              style={{ width: '100%', maxWidth: '240px', aspectRatio: '1 / 1', backgroundColor: '#0B1B2B' }}
              onClick={() => {
                if (canManagePhotos) setShowPhotoUploadModal(true);
              }}
              title={canManagePhotos ? 'Click to manage crew member photos and cropping' : crewMember.fullName}
            >
              <img
                src={activeDisplayPhoto}
                alt={crewMember.fullName}
                className="w-100 h-100 object-fit-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src =
                    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80';
                }}
              />

              {/* Photo Badges */}
              <div
                className="position-absolute top-0 end-0 m-2 d-flex align-items-center gap-1.5"
                style={{ zIndex: 3 }}
                onClick={(e) => e.stopPropagation()}
              >
                {crewMember.photos && crewMember.photos.length > 1 ? (
                  <span
                    className="badge bg-primary text-white shadow-2xs font-mono-code"
                    style={{ fontSize: '0.65rem' }}
                  >
                    {crewMember.photos.length} Photos
                  </span>
                ) : crewMember.imageUrl ? (
                  <span
                    className="badge bg-success text-white shadow-2xs font-mono-code"
                    style={{ fontSize: '0.65rem' }}
                  >
                    Custom Photo
                  </span>
                ) : null}
              </div>

              {canManagePhotos && (
                <div
                  className="position-absolute bottom-0 start-0 end-0 p-1.5 text-center text-white small"
                  style={{
                    background: 'linear-gradient(to top, rgba(11, 27, 43, 0.85) 0%, transparent 100%)',
                    fontSize: '0.72rem',
                  }}
                >
                  Manage photos
                </div>
              )}
            </div>

            {/* Thumbnail Preview Strip */}
            {modalPhotos.length > 1 && (
              <div className="d-flex align-items-center gap-1.5 mb-2 overflow-x-auto pb-1">
                {modalPhotos.map((pUrl, pIdx) => {
                  const isSelected = pUrl === activeDisplayPhoto;
                  return (
                    <button
                      key={pIdx}
                      type="button"
                      className={`border rounded-2 p-0 overflow-hidden flex-shrink-0 transition-all ${isSelected ? 'border-primary shadow-xs ring-2 ring-primary' : 'border-secondary-subtle opacity-75 hover-opacity-100'
                        }`}
                      style={{ width: '56px', height: '36px', backgroundColor: '#0B1B2B' }}
                      onClick={() => setSelectedViewPhotoUrl(pUrl)}
                      title={`View photo #${pIdx + 1}`}
                    >
                      <img src={pUrl} alt="" className="w-100 h-100 object-fit-cover" />
                    </button>
                  );
                })}
              </div>
            )}

            {canManagePhotos && (
              <button
                type="button"
                className="btn btn-sm btn-outline-primary w-100 d-flex align-items-center justify-content-center gap-1.5 py-1"
                onClick={() => setShowPhotoUploadModal(true)}
              >
                <Camera className="w-3.5 h-3.5" />
                <span style={{ fontSize: '0.75rem' }}>{modalPhotos.length > 1 ? 'Manage Gallery' : 'Add Photo'}</span>
              </button>
            )}
          </div>

          <div className="col-12 col-lg-8 col-xl-9">
            {/* Information Summary Box */}
            <div className="p-3 bg-light border rounded-3 font-mono-code small h-100">
              <div className="row g-2.5">
                <div className="col-md-4 col-6">
                  <span className="text-secondary d-block" style={{ fontSize: '0.7rem' }}>Crew ID</span>
                  <strong className={`text-dark${isJustLoaded ? ' map-autofill-animate' : ''}`}>{crewMember.id}</strong>
                </div>
                <div className="col-md-4 col-6">
                  <span className="text-secondary d-block" style={{ fontSize: '0.7rem' }}>Rank</span>
                  <strong className={`text-dark${isJustLoaded ? ' map-autofill-animate' : ''}`}>{crewMember.rank}</strong>
                </div>
                <div className="col-md-4 col-6">
                  <span className="text-secondary d-block" style={{ fontSize: '0.7rem' }}>Compliance</span>
                  <span className={`badge ${crewMember.complianceStatus === 'Fully Compliant' ? 'bg-success text-white' : crewMember.complianceStatus === 'Expiring < 60 Days' ? 'bg-warning text-dark' : 'bg-danger text-white'}`}>
                    {getStatusDisplayLabel(crewMember.complianceStatus)}
                  </span>
                </div>
                <div className="col-md-4 col-6">
                  <span className="text-secondary d-block" style={{ fontSize: '0.7rem' }}>Organization</span>
                  <strong className={`text-dark text-truncate d-block${isJustLoaded ? ' map-autofill-animate' : ''}`}>{crewMember.organization || 'Northwind Marine Pty Ltd'}</strong>
                </div>
                <div className="col-md-4 col-6">
                  <span className="text-secondary d-block" style={{ fontSize: '0.7rem' }}>Nationality</span>
                  <strong className={`text-dark${isJustLoaded ? ' map-autofill-animate' : ''}`}>{crewMember.nationality}</strong>
                </div>
                <div className="col-md-4 col-6">
                  <span className="text-secondary d-block" style={{ fontSize: '0.7rem' }}>Seaman's Book No.</span>
                  <strong className={`text-dark${isJustLoaded ? ' map-autofill-animate' : ''}`}>{crewMember.seamansBookNo}</strong>
                </div>
                <div className="col-md-4 col-6">
                  <span className="text-secondary d-block" style={{ fontSize: '0.7rem' }}>Passport No.</span>
                  <strong className={`text-dark${isJustLoaded ? ' map-autofill-animate' : ''}`}>{crewMember.passportNo}</strong>
                </div>
                <div className="col-md-4 col-6">
                  <span className="text-secondary d-block" style={{ fontSize: '0.7rem' }}>Date of Birth</span>
                  <strong className={`text-dark${isJustLoaded ? ' map-autofill-animate' : ''}`}>{crewMember.dateOfBirth}</strong>
                </div>
                <div className="col-md-4 col-6">
                  <span className="text-secondary d-block" style={{ fontSize: '0.7rem' }}>Emergency Contact</span>
                  <strong className={`text-dark text-truncate d-block${isJustLoaded ? ' map-autofill-animate' : ''}`}>{crewMember.emergencyContact}</strong>
                </div>
                <div className="col-md-4 col-6">
                  <span className="text-secondary d-block" style={{ fontSize: '0.7rem' }}>Last Audit</span>
                  <strong className={`text-dark${isJustLoaded ? ' map-autofill-animate' : ''}`}>{formatMaritimeDate(crewMember.lastAuditedDate)}</strong>
                </div>
                <div className="col-md-4 col-6">
                  <span className="text-secondary d-block" style={{ fontSize: '0.7rem' }}>Permissions</span>
                  <span className={`badge ${canManageDocuments ? 'bg-info text-dark' : 'bg-secondary text-white'}`}>
                    {canManageDocuments ? 'Admin / Submitter Full Access' : 'Read-Only Mode'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 1: Historical Sea Service & Vessel Assignments Register */}
      <div className="card map-card-custom">
        <div className="card-header p-3 border-bottom d-flex align-items-center justify-between">
          <div className="fw-bold text-dark fs-6">
            Assignment History
          </div>
        </div>
        <div className="table-responsive">
          <table className="table map-table-custom align-middle mb-0">
            <thead>
              <tr>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => {
                    if (assignmentSortField === 'imoNumber') setAssignmentSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                    else { setAssignmentSortField('imoNumber'); setAssignmentSortDirection('asc'); }
                  }}
                >
                  IMO Number {renderSortIndicator(assignmentSortField, 'imoNumber', assignmentSortDirection)}
                </th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => {
                    if (assignmentSortField === 'vesselName') setAssignmentSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                    else { setAssignmentSortField('vesselName'); setAssignmentSortDirection('asc'); }
                  }}
                >
                  Vessel {renderSortIndicator(assignmentSortField, 'vesselName', assignmentSortDirection)}
                </th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => {
                    if (assignmentSortField === 'rankHeld') setAssignmentSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                    else { setAssignmentSortField('rankHeld'); setAssignmentSortDirection('asc'); }
                  }}
                >
                  Rank {renderSortIndicator(assignmentSortField, 'rankHeld', assignmentSortDirection)}
                </th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => {
                    if (assignmentSortField === 'embarkDate') setAssignmentSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                    else { setAssignmentSortField('embarkDate'); setAssignmentSortDirection('desc'); }
                  }}
                >
                  Service Period {renderSortIndicator(assignmentSortField, 'embarkDate', assignmentSortDirection)}
                </th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => {
                    if (assignmentSortField === 'isCurrent') setAssignmentSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                    else { setAssignmentSortField('isCurrent'); setAssignmentSortDirection('desc'); }
                  }}
                >
                  Status {renderSortIndicator(assignmentSortField, 'isCurrent', assignmentSortDirection)}
                </th>
                <th className="text-end" style={{ whiteSpace: 'nowrap' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedAssignments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-4 text-muted">
                    No assignments yet.
                  </td>
                </tr>
              ) : (
                sortedAssignments.map((asg: CrewVesselAssignment) => (
                  <tr key={asg.id}>
                    <td className="font-mono-code fw-semibold text-primary">{asg.imoNumber}</td>
                    <td>
                      <div className="fw-semibold text-dark">{asg.vesselName}</div>
                    </td>
                    <td>
                      <div className="fw-semibold text-dark">{asg.rankHeld}</div>
                      <span className="badge bg-light text-secondary border font-mono-code" style={{ fontSize: '0.7rem' }}>
                        {asg.vesselType}
                      </span>
                    </td>
                    <td className="font-mono-code small">
                      {formatMaritimeDate(asg.embarkDate)} &rarr; {asg.disembarkDate ? formatMaritimeDate(asg.disembarkDate) : <span className="text-success fw-bold">Present</span>}
                    </td>
                    <td>
                      {asg.isCurrent ? (
                        <span className="badge bg-success text-white">On Board</span>
                      ) : (
                        <span className="badge bg-light text-dark border">Completed</span>
                      )}
                    </td>
                    <td className="text-end">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center p-0"
                        style={{ width: '32px', height: '32px' }}
                        onClick={() => setCurrentHashView('vessels', asg.vesselId)}
                        title={`View ${asg.vesselName}`}
                        aria-label={`View ${asg.vesselName}`}
                      >
                        <ExternalLink size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 2: Layer 1 — Universal STCW Core Documents Register */}
      <div className="card map-card-custom">
        <div className="card-header p-3 border-bottom d-flex align-items-center justify-between">
          <div>
            <div className="fw-bold text-dark fs-6">
              Core Documents
            </div>
            <div className="text-secondary small">
              Required for all crew: Passport, Seaman's Book, BST, ENG1 Medical, Security Awareness.
            </div>
          </div>
          {canManageDocuments && (
            <button
              type="button"
              className="btn btn-sm btn-primary ms-auto"
              onClick={() => handleOpenUploadNew('Layer 1 - Universal Core')}
            >
              Upload Core Document
            </button>
          )}
        </div>
        <div className="table-responsive">
          <table className="table map-table-custom align-middle mb-0">
            <thead>
              <tr>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => {
                    if (layer1SortField === 'certificateNo') setLayer1SortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                    else { setLayer1SortField('certificateNo'); setLayer1SortDirection('asc'); }
                  }}
                >
                  Certificate No. {renderSortIndicator(layer1SortField, 'certificateNo', layer1SortDirection)}
                </th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => {
                    if (layer1SortField === 'title') setLayer1SortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                    else { setLayer1SortField('title'); setLayer1SortDirection('asc'); }
                  }}
                >
                  Title {renderSortIndicator(layer1SortField, 'title', layer1SortDirection)}
                </th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => {
                    if (layer1SortField === 'issuingAuthority') setLayer1SortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                    else { setLayer1SortField('issuingAuthority'); setLayer1SortDirection('asc'); }
                  }}
                >
                  Issuing Authority {renderSortIndicator(layer1SortField, 'issuingAuthority', layer1SortDirection)}
                </th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => {
                    if (layer1SortField === 'expiryDate') setLayer1SortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                    else { setLayer1SortField('expiryDate'); setLayer1SortDirection('asc'); }
                  }}
                >
                  Expiry Date {renderSortIndicator(layer1SortField, 'expiryDate', layer1SortDirection)}
                </th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => {
                    if (layer1SortField === 'verificationStatus') setLayer1SortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                    else { setLayer1SortField('verificationStatus'); setLayer1SortDirection('asc'); }
                  }}
                >
                  Verification {renderSortIndicator(layer1SortField, 'verificationStatus', layer1SortDirection)}
                </th>
                <th className="text-end" style={{ whiteSpace: 'nowrap' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedLayer1Docs.map((doc: STCWDocumentItem) => (
                <tr key={doc.id}>
                  <td>
                    <div className="font-mono-code fw-semibold text-primary">{doc.certificateNo}</div>
                    <div className="small font-mono-code text-secondary">{doc.stcwRegulation}</div>
                  </td>
                  <td>
                    <div className="fw-semibold text-dark">{doc.title}</div>
                  </td>
                  <td className="small">
                    <div className="fw-medium text-dark">{doc.issuingAuthority}</div>
                    {doc.flagState && <span className="text-muted font-mono-code" style={{ fontSize: '0.72rem' }}>Flag State: {doc.flagState}</span>}
                  </td>
                  <td className="font-mono-code small">{formatMaritimeDate(doc.expiryDate)}</td>
                  <td>{renderStatusBadge(doc.verificationStatus)}</td>
                  <td className="text-end">
                    <div className="d-flex align-items-center justify-content-end gap-1.5">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center p-0"
                        style={{ width: '32px', height: '32px' }}
                        onClick={() => handleOpenViewDoc(doc)}
                        title="View"
                        aria-label={`View details for ${doc.title}`}
                      >
                        <Eye size={16} />
                      </button>
                      {canManageDocuments && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger d-inline-flex align-items-center justify-content-center p-0"
                          style={{ width: '32px', height: '32px' }}
                          onClick={() => handleDeleteDoc(doc.id)}
                          title="Delete"
                          aria-label={`Delete ${doc.title}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 3: Layer 2 — Vessel-Specific Certificates & Advanced Endorsements Register */}
      <div className="card map-card-custom">
        <div className="card-header p-3 border-bottom d-flex align-items-center justify-between">
          <div>
            <div className="fw-bold text-dark fs-6">
              Vessel-Specific Endorsements
            </div>
            <div className="text-secondary small">
              CoC, Flag Endorsement, Advanced Tanker, IGF Code, DP Operator, Crowd Management.
            </div>
          </div>
          {canManageDocuments && (
            <button
              type="button"
              className="btn btn-sm btn-primary ms-auto"
              onClick={() => handleOpenUploadNew('Layer 2 - Vessel Specific & Endorsements')}
            >
              Add Endorsement
            </button>
          )}
        </div>
        <div className="table-responsive">
          <table className="table map-table-custom align-middle mb-0">
            <thead>
              <tr>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => {
                    if (layer2SortField === 'certificateNo') setLayer2SortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                    else { setLayer2SortField('certificateNo'); setLayer2SortDirection('asc'); }
                  }}
                >
                  Certificate No. {renderSortIndicator(layer2SortField, 'certificateNo', layer2SortDirection)}
                </th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => {
                    if (layer2SortField === 'title') setLayer2SortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                    else { setLayer2SortField('title'); setLayer2SortDirection('asc'); }
                  }}
                >
                  Title {renderSortIndicator(layer2SortField, 'title', layer2SortDirection)}
                </th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => {
                    if (layer2SortField === 'issuingAuthority') setLayer2SortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                    else { setLayer2SortField('issuingAuthority'); setLayer2SortDirection('asc'); }
                  }}
                >
                  Issuing Authority {renderSortIndicator(layer2SortField, 'issuingAuthority', layer2SortDirection)}
                </th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => {
                    if (layer2SortField === 'expiryDate') setLayer2SortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                    else { setLayer2SortField('expiryDate'); setLayer2SortDirection('asc'); }
                  }}
                >
                  Expiry Date {renderSortIndicator(layer2SortField, 'expiryDate', layer2SortDirection)}
                </th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => {
                    if (layer2SortField === 'verificationStatus') setLayer2SortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                    else { setLayer2SortField('verificationStatus'); setLayer2SortDirection('asc'); }
                  }}
                >
                  Verification {renderSortIndicator(layer2SortField, 'verificationStatus', layer2SortDirection)}
                </th>
                <th className="text-end" style={{ whiteSpace: 'nowrap' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedLayer2Docs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-4 text-muted">
                    No endorsements yet.
                  </td>
                </tr>
              ) : (
                sortedLayer2Docs.map((doc: STCWDocumentItem) => (
                  <tr key={doc.id}>
                    <td>
                      <div className="font-mono-code fw-semibold text-primary">{doc.certificateNo}</div>
                      <div className="small font-mono-code text-secondary">{doc.stcwRegulation}</div>
                    </td>
                    <td>
                      <div className="fw-semibold text-dark">{doc.title}</div>
                    </td>
                    <td className="small">
                      <div className="fw-medium text-dark">{doc.issuingAuthority}</div>
                      <span className="badge bg-light text-secondary border font-mono-code mt-0.5" style={{ fontSize: '0.68rem' }}>
                        {doc.flagState || 'Universal Flag'}
                      </span>
                    </td>
                    <td className="font-mono-code small">{formatMaritimeDate(doc.expiryDate)}</td>
                    <td>{renderStatusBadge(doc.verificationStatus)}</td>
                    <td className="text-end">
                      <div className="d-flex align-items-center justify-content-end gap-1.5">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center p-0"
                          style={{ width: '32px', height: '32px' }}
                          onClick={() => handleOpenViewDoc(doc)}
                          title="View"
                          aria-label={`View details for ${doc.title}`}
                        >
                          <Eye size={16} />
                        </button>
                        {canManageDocuments && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger d-inline-flex align-items-center justify-content-center p-0"
                            style={{ width: '32px', height: '32px' }}
                            onClick={() => handleDeleteDoc(doc.id)}
                            title="Delete"
                            aria-label={`Delete ${doc.title}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* STCW Document Viewer Modal */}
      <CrewDocumentViewerModal
        isOpen={isViewerModalOpen}
        crewName={crewMember.fullName}
        document={viewingDoc}
        canManage={canManageDocuments}
        onClose={() => setIsViewerModalOpen(false)}
        onOpenReupload={(doc) => handleOpenUpdateDoc(doc)}
      />

      {/* STCW Document Upload / Reupload / Renewal Modal */}
      <CrewDocumentUploadModal
        isOpen={isUploadModalOpen}
        crewId={crewMember.id}
        crewName={crewMember.fullName}
        existingDocument={editingDoc}
        initialLayer={uploadLayer}
        onClose={() => {
          setIsUploadModalOpen(false);
          setEditingDoc(null);
          setUploadLayer(undefined);
        }}
      />

      {/* ========================================================================= */}
      {/* Photo Gallery Manager Modal                                              */}
      {/* ========================================================================= */}
      {showPhotoUploadModal && canManagePhotos && (
        <div
          className="modal show d-block map-modal-backdrop"
          tabIndex={-1}
          style={{ zIndex: 1060 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPhotoUploadModal(false);
          }}
        >
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content bg-white text-dark border shadow-lg">
              {/* Header */}
              <div className="modal-header border-bottom bg-light d-flex align-items-center justify-content-between p-3">
                <div className="d-flex align-items-center gap-2">
                  <div className="p-2 bg-primary-subtle text-primary rounded-3">
                    <Camera className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h5 className="modal-title fw-bold text-dark m-0" style={{ fontSize: '1.05rem' }}>
                      Manage Photos
                    </h5>
                    <div className="text-secondary small font-mono-code">
                      {crewMember.fullName} · Rank: {crewMember.rank}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowPhotoUploadModal(false)}
                  aria-label="Close"
                />
              </div>

              {/* Body */}
              <div className="modal-body p-4">
                {/* 1. Primary Cover Preview & Actions */}
                <div className="row g-3 mb-4">
                  <div className="col-12 col-md-5">
                    <label className="form-label fw-bold text-dark small mb-1">
                      Cover Photo
                    </label>
                    <div
                      className="position-relative border rounded-3 overflow-hidden shadow-xs"
                      style={{ width: '100%', aspectRatio: '16 / 9', backgroundColor: '#0B1B2B' }}
                    >
                      <img
                        src={photoModalUrl || getCrewStockPhoto(crewMember.id, crewMember.fullName, crewMember.rank)}
                        alt={crewMember.fullName}
                        className="w-100 h-100 object-fit-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src =
                            'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=1000&q=80';
                        }}
                      />
                      <div
                        className="position-absolute bottom-0 start-0 end-0 p-1.5 text-center text-white small"
                        style={{
                          background: 'linear-gradient(to top, rgba(11, 27, 43, 0.9) 0%, transparent 100%)',
                          fontSize: '0.72rem',
                        }}
                      >
                        Shown on the crew page and marketplace card.
                      </div>
                    </div>
                  </div>

                  <div className="col-12 col-md-7 d-flex flex-column justify-content-between">
                    <div>
                      <label className="form-label fw-bold text-dark small mb-1">
                        Crop Cover Photo
                      </label>
                      <p className="text-secondary small mb-3">
                        Crop, rotate, or flip the cover photo.
                      </p>
                    </div>

                    <div className="d-flex flex-column gap-2">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary d-flex align-items-center justify-content-center gap-1.5"
                        onClick={() => {
                          const targetSrc = photoModalUrl || getCrewStockPhoto(crewMember.id, crewMember.fullName, crewMember.rank);
                          const idx = modalPhotos.indexOf(targetSrc);
                          setCropTargetIdx(idx >= 0 ? idx : null);
                          setCropModalImageSrc(targetSrc);
                          setIsCropModalOpen(true);
                        }}
                      >
                        <Crop className="w-3.5 h-3.5" />
                        <span>Crop Cover Photo</span>
                      </button>

                      <button
                        type="button"
                        className="btn btn-sm btn-primary d-flex align-items-center justify-content-center gap-1.5 fw-semibold"
                        onClick={() => setShowAddPhotoModal(true)}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Photo</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2. Gallery Photos Manager Grid */}
                <div className="border-top pt-3">
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <div>
                      <span className="fw-bold text-dark small">Photos ({modalPhotos.length})</span>
                      <div className="text-secondary" style={{ fontSize: '0.72rem' }}>
                        Click a photo to set it as the cover.
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1.5 fw-semibold"
                      onClick={() => setShowAddPhotoModal(true)}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Photo</span>
                    </button>
                  </div>

                  {/* Photo Grid */}
                  <div className="row g-2.5">
                    {modalPhotos.map((pUrl, pIdx) => {
                      const isCover = photoModalUrl === pUrl || (!photoModalUrl && pIdx === 0);
                      const isDragged = draggedPhotoIdx === pIdx;
                      const isDragOver = dragOverPhotoIdx === pIdx;

                      return (
                        <div
                          key={pIdx}
                          className="col-6 col-md-4 col-lg-3"
                          draggable
                          onDragStart={() => setDraggedPhotoIdx(pIdx)}
                          onDragOver={(e) => {
                            e.preventDefault();
                            setDragOverPhotoIdx(pIdx);
                          }}
                          onDragEnd={() => {
                            if (draggedPhotoIdx !== null && dragOverPhotoIdx !== null && draggedPhotoIdx !== dragOverPhotoIdx) {
                              const updated = [...modalPhotos];
                              const [moved] = updated.splice(draggedPhotoIdx, 1);
                              updated.splice(dragOverPhotoIdx, 0, moved);
                              setModalPhotos(updated);
                            }
                            setDraggedPhotoIdx(null);
                            setDragOverPhotoIdx(null);
                          }}
                        >
                          <div
                            className={`position-relative border rounded-2 overflow-hidden cursor-pointer transition-all ${isCover ? 'border-primary ring-2 ring-primary shadow-xs' : 'border-secondary-subtle'
                              } ${isDragged ? 'opacity-50' : ''} ${isDragOver ? 'border-warning ring-2 ring-warning' : ''}`}
                            style={{ height: '95px', backgroundColor: '#0B1B2B' }}
                            onClick={() => setPhotoModalUrl(pUrl)}
                            title="Set as cover photo"
                          >
                            <img src={pUrl} alt="" className="w-100 h-100 object-fit-cover" />

                            {/* Cover Badge */}
                            {isCover && (
                              <div
                                className="position-absolute top-0 start-0 px-1.5 py-0.5 text-white fw-bold"
                                style={{ background: '#0B1B2B', fontSize: '0.62rem', borderBottomRightRadius: '4px' }}
                              >
                                Cover
                              </div>
                            )}

                            {/* Index badge */}
                            <div
                              className="position-absolute bottom-0 start-0 px-1 py-0.5 text-white font-mono-code"
                              style={{ background: 'rgba(0,0,0,0.65)', fontSize: '0.55rem', borderTopRightRadius: '3px' }}
                            >
                              #{pIdx + 1}
                            </div>

                            {/* Action Buttons */}
                            <div className="position-absolute top-0 end-0 d-flex align-items-center gap-1 m-1">
                              <button
                                type="button"
                                className="btn btn-xs btn-primary p-0 d-flex align-items-center justify-content-center rounded-circle border border-white shadow-sm"
                                style={{ width: '22px', height: '22px' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCropTargetIdx(pIdx);
                                  setCropModalImageSrc(pUrl);
                                  setIsCropModalOpen(true);
                                }}
                                title="Crop photo"
                              >
                                <Crop className="w-3 h-3 text-white" strokeWidth={2.2} />
                              </button>
                              {modalPhotos.length > 1 && (
                                <button
                                  type="button"
                                  className="btn btn-xs btn-danger p-0 d-flex align-items-center justify-content-center rounded-circle border border-white shadow-sm"
                                  style={{ width: '22px', height: '22px' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const updated = modalPhotos.filter((_, i) => i !== pIdx);
                                    setModalPhotos(updated);
                                    if (isCover) {
                                      setPhotoModalUrl(updated.length > 0 ? updated[0] : '');
                                    }
                                  }}
                                  title="Delete photo"
                                >
                                  <X className="w-3 h-3 text-white" strokeWidth={2.2} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="modal-footer border-top bg-white d-flex align-items-center justify-content-between p-3">
                <div>
                  {(crewMember.imageUrl || modalPhotos.length > 0) && (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1.5"
                      onClick={() => {
                        const updated: CrewMember = {
                          ...crewMember,
                          imageUrl: undefined,
                          photos: undefined,
                        };
                        updateCrewMember(updated);
                        const defaultStock = getCrewStockPhoto(crewMember.id, crewMember.fullName, crewMember.rank);
                        setPhotoModalUrl(defaultStock);
                        setModalPhotos([defaultStock]);
                        setSelectedViewPhotoUrl(defaultStock);
                        setShowPhotoUploadModal(false);
                        setToastMessage(`Photos for ${crewMember.fullName} reset to default stock.`);
                        setTimeout(() => setToastMessage(null), 3500);
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Reset to Default</span>
                    </button>
                  )}
                </div>

                <div className="d-flex align-items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => setShowPhotoUploadModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary fw-semibold d-inline-flex align-items-center gap-1.5"
                    onClick={() => {
                      const finalCover = photoModalUrl.trim() || (modalPhotos.length > 0 ? modalPhotos[0] : '');
                      const updated: CrewMember = {
                        ...crewMember,
                        imageUrl: finalCover || undefined,
                        photos: modalPhotos.length > 0 ? modalPhotos : undefined,
                      };
                      updateCrewMember(updated);
                      setSelectedViewPhotoUrl(finalCover);
                      setShowPhotoUploadModal(false);
                      setToastMessage(`Photos for ${crewMember.fullName} successfully updated.`);
                      setTimeout(() => setToastMessage(null), 3500);
                    }}
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Photos ({modalPhotos.length})</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Add Photo Options Modal                                                  */}
      {/* ========================================================================= */}
      {showAddPhotoModal && canManagePhotos && (
        <div
          className="modal show d-block map-modal-backdrop"
          tabIndex={-1}
          style={{ zIndex: 1065 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAddPhotoModal(false);
          }}
        >
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content bg-white text-dark border shadow-lg">
              <div className="modal-header border-bottom bg-light d-flex align-items-center justify-content-between p-3">
                <div className="d-flex align-items-center gap-2">
                  <div className="p-2 bg-primary-subtle text-primary rounded-3">
                    <Camera className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h5 className="modal-title fw-bold text-dark m-0" style={{ fontSize: '1.05rem' }}>
                      Add Photo
                    </h5>
                    <div className="text-secondary small font-mono-code">
                      {crewMember.fullName} · Choose upload, curated stock, or image link
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowAddPhotoModal(false)}
                  aria-label="Close"
                />
              </div>

              <div className="modal-body p-4">
                {/* Option A: Upload & Crop */}
                <div className="p-3 bg-light border rounded shadow-2xs mb-3">
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <span className="fw-bold text-dark small">Upload a Photo</span>
                    <span className="text-secondary" style={{ fontSize: '0.75rem' }}>JPEG, PNG, WEBP</span>
                  </div>

                  <input
                    type="file"
                    ref={photoFileInputRef}
                    className="d-none"
                    accept="image/png,image/jpeg,image/webp,image/jpg"
                    onChange={(e) => {
                      const files = e.target.files;
                      if (files && files.length > 0) {
                        const file = files[0];
                        const reader = new FileReader();
                        reader.onload = () => {
                          if (typeof reader.result === 'string') {
                            setShowAddPhotoModal(false);
                            setCropTargetIdx(null);
                            setCropModalImageSrc(reader.result);
                            setIsCropModalOpen(true);
                          }
                        };
                        reader.readAsDataURL(file);
                        e.target.value = '';
                      }
                    }}
                  />

                  <div
                    className="border border-dashed border-primary rounded bg-white p-3 text-center cursor-pointer hover-bg-light transition-all d-flex flex-column align-items-center justify-content-center gap-1.5"
                    style={{ borderStyle: 'dashed', borderWidth: '1.5px' }}
                    onClick={() => photoFileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const files = e.dataTransfer.files;
                      if (files && files.length > 0) {
                        const file = files[0];
                        const reader = new FileReader();
                        reader.onload = () => {
                          if (typeof reader.result === 'string') {
                            setShowAddPhotoModal(false);
                            setCropTargetIdx(null);
                            setCropModalImageSrc(reader.result);
                            setIsCropModalOpen(true);
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  >
                    <Upload className="w-6 h-6 text-primary" />
                    <span className="small text-dark fw-semibold">
                      Drag &amp; drop crew photo here or <span className="text-primary text-decoration-underline">browse files</span>
                    </span>
                    <span className="text-secondary" style={{ fontSize: '0.72rem' }}>
                      You can crop the photo before it is added.
                    </span>
                  </div>
                </div>

                {/* Option B: Curated Crew Stock */}
                <div className="p-3 bg-light border rounded shadow-2xs mb-3">
                  <div className="fw-bold text-dark small mb-2">Choose a Preset</div>
                  <div className="row g-2">
                    {CURATED_CREW_PHOTOS.map((p, idx) => (
                      <div key={idx} className="col-6 col-md-3">
                        <div
                          className="position-relative border rounded overflow-hidden cursor-pointer transition-all border-secondary-subtle opacity-90 hover-opacity-100 hover:shadow-xs"
                          style={{ height: '75px' }}
                          onClick={() => {
                            setShowAddPhotoModal(false);
                            setCropTargetIdx(null);
                            setCropModalImageSrc(p.url);
                            setIsCropModalOpen(true);
                          }}
                          title={`Add ${p.title}`}
                        >
                          <img src={p.url} alt={p.title} className="w-100 h-100 object-fit-cover" />
                          <div
                            className="position-absolute bottom-0 start-0 w-100 px-1 py-0.5 text-truncate text-white fw-semibold"
                            style={{ background: 'rgba(0,0,0,0.65)', fontSize: '0.62rem' }}
                          >
                            {p.title}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Option C: Direct URL */}
                <div className="p-3 bg-light border rounded shadow-2xs">
                  <label className="form-label fw-bold text-dark small mb-1" htmlFor="custom-crew-image-url">
                    Image URL
                  </label>
                  <div className="input-group input-group-sm">
                    <input
                      id="custom-crew-image-url"
                      type="url"
                      className="form-control font-mono-code"
                      placeholder="https://images.unsplash.com/photo-..."
                      value={customPhotoUrl}
                      onChange={(e) => setCustomPhotoUrl(e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn btn-outline-primary"
                      onClick={() => {
                        const url = customPhotoUrl.trim();
                        if (url) {
                          setShowAddPhotoModal(false);
                          setCropTargetIdx(null);
                          setCropModalImageSrc(url);
                          setIsCropModalOpen(true);
                          setCustomPhotoUrl('');
                        }
                      }}
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>

              <div className="modal-footer border-top bg-light d-flex justify-content-end p-3">
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => setShowAddPhotoModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Universal Crew Image Crop Modal */}
      {isCropModalOpen && cropModalImageSrc && (
        <ImageCropModal
          isOpen={isCropModalOpen}
          imageSrc={cropModalImageSrc}
          title="Crop Photo"
          assetName={crewMember.fullName}
          initialPreset="1:1"
          onSave={(croppedUrl) => {
            if (cropTargetIdx !== null && cropTargetIdx >= 0 && cropTargetIdx < modalPhotos.length) {
              const updated = [...modalPhotos];
              const oldUrl = updated[cropTargetIdx];
              updated[cropTargetIdx] = croppedUrl;
              setModalPhotos(updated);
              if (photoModalUrl === oldUrl || !photoModalUrl) {
                setPhotoModalUrl(croppedUrl);
              }
            } else {
              setModalPhotos((prev) => (!prev.includes(croppedUrl) ? [...prev, croppedUrl] : prev));
              if (!photoModalUrl) {
                setPhotoModalUrl(croppedUrl);
              }
            }
            setIsCropModalOpen(false);
            setToastMessage(`Universal image crop applied to ${crewMember.fullName} gallery.`);
            setTimeout(() => setToastMessage(null), 3500);
          }}
          onClose={() => setIsCropModalOpen(false)}
        />
      )}

    </div>
  );
};
