/* 
  file summary: stcw crew member drill-down detail view presenting historical sea service vessel assignments and layered stcw compliance registers.
  responsibilities: renders stcw layer 1 core documents, layer 2 vessel-specific endorsements, historical sea service assignments, and enforces admin/submitter document viewing, uploading, and updating permissions.
  role in system: deep-dive view rendered when a crew directory row is selected or navigated to (/crew/CREW-101).
*/

import React, { useEffect, useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useMapStore } from '../store/useMapStore';
import { STCWDocumentItem, CrewVesselAssignment } from '../types/crew';
import { ReadinessGauge } from '../components/common/ReadinessGauge';
import { formatMaritimeDate } from '../utils/formatters';
import { exportToCsv, exportToPdf } from '../utils/exportHelpers';
import { CrewDocumentUploadModal } from '../components/drawers/CrewDocumentUploadModal';
import { CrewDocumentViewerModal } from '../components/drawers/CrewDocumentViewerModal';
import { AddToProjectModal } from '../components/drawers/AddToProjectModal';

interface CrewDetailViewProps {
  crewId: string;
}

/**
  what: renders STCW crew member drill-down detail view in light theme.
  how: displays crew Information, sea service vessel history, layer 1 core STCW documents, layer 2 endorsements, document viewer modal, and handles document uploads/reuploads/updates.
  with what file: src/views/CrewDetailView.tsx loaded by App.tsx router.
*/
export const CrewDetailView: React.FC<CrewDetailViewProps> = ({ crewId }) => {
  const { crew, activePersona, setCurrentHashView, previousHashView, previousEntityId, deleteCrewDocument } = useMapStore();

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadLayer, setUploadLayer] = useState<import('../types/crew').STCWLayer | undefined>(undefined);
  const [editingDoc, setEditingDoc] = useState<STCWDocumentItem | null>(null);

  const [isViewerModalOpen, setIsViewerModalOpen] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<STCWDocumentItem | null>(null);

  const [isExportOpen, setIsExportOpen] = useState(false);
  const [showAddToProjectModal, setShowAddToProjectModal] = useState(false);

  /* triggers one-shot shimmer on all crew attribute value cells on mount or crewId change */
  const [isJustLoaded, setIsJustLoaded] = useState(true);
  useEffect(() => {
    setIsJustLoaded(true);
    const timer = setTimeout(() => setIsJustLoaded(false), 800);
    return () => clearTimeout(timer);
  }, [crewId]);

  const canManageDocuments = activePersona === 'Administrator' || activePersona === 'Submitter';
  const canAddToProject = activePersona === 'Administrator' || activePersona === 'C Admin';

  const crewMember = crew.find((c) => c.id === crewId) || crew[0];

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

    exportToPdf(`${crewMember.fullName} STCW Layered Compliance Dossier`, headers, [...coreRows, ...endorsementRows]);
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
      {/* Main Profile Information & STCW Compliance Header Card */}
      <div className="card map-card-custom p-4">
        <div className="d-flex flex-wrap align-items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="fw-bold mb-1 text-primary">{crewMember.fullName}</h3>
            <div className="text-secondary small font-mono-code d-flex align-items-center gap-2 flex-wrap">
              <span>Current Vessel:</span>
              {crewMember.currentVesselId ? (
                <button
                  type="button"
                  className="btn btn-link p-0 text-primary fw-bold border-0 bg-transparent text-decoration-underline font-mono-code align-baseline"
                  onClick={() => setCurrentHashView('vessels', crewMember.currentVesselId)}
                  title={`View ${crewMember.currentVesselName} details`}
                >
                  {crewMember.currentVesselName}
                </button>
              ) : (
                <strong>{crewMember.currentVesselName || 'Unassigned / Ashore'}</strong>
              )}
            </div>
          </div>

          {/* Opposite Corner Controls: STCW Score Gauge + Export Data Button */}
          <div className="d-flex align-items-center gap-4 ms-auto">
            {canAddToProject && (
              <button
                type="button"
                className="btn btn-sm btn-outline-primary fw-semibold"
                onClick={() => setShowAddToProjectModal(true)}
              >
                Add to Project
              </button>
            )}
            <div className="d-flex flex-column align-items-center">
              <div className="text-secondary small fw-bold text-uppercase" style={{ fontSize: '0.65rem', letterSpacing: '0.05em' }}>
                STCW Readiness Score
              </div>
              <ReadinessGauge score={crewMember.overallComplianceScore} size="sm" />
            </div>

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

        {/* Information Summary Box */}
        <div className="p-3 bg-light border rounded-3 font-mono-code small">
          <div className="row g-3">
            <div className="col-md-3 col-6">
              <span className="text-secondary d-block" style={{ fontSize: '0.7rem' }}>Crew ID</span>
              <strong className={`text-dark${isJustLoaded ? ' map-autofill-animate' : ''}`}>{crewMember.id}</strong>
            </div>
            <div className="col-md-3 col-6">
              <span className="text-secondary d-block" style={{ fontSize: '0.7rem' }}>Rank</span>
              <strong className={`text-dark${isJustLoaded ? ' map-autofill-animate' : ''}`}>{crewMember.rank}</strong>
            </div>
            <div className="col-md-3 col-6">
              <span className="text-secondary d-block" style={{ fontSize: '0.7rem' }}>Compliance Status</span>
              <span className={`badge ${crewMember.complianceStatus === 'Fully Compliant' ? 'bg-success text-white' : crewMember.complianceStatus === 'Expiring < 60 Days' ? 'bg-warning text-dark' : 'bg-danger text-white'}`}>
                {crewMember.complianceStatus}
              </span>
            </div>
            <div className="col-md-3 col-6">
              <span className="text-secondary d-block" style={{ fontSize: '0.7rem' }}>Organization</span>
              <strong className={`text-dark text-truncate d-block${isJustLoaded ? ' map-autofill-animate' : ''}`}>{crewMember.organization || 'Northwind Marine Pty Ltd'}</strong>
            </div>
            <div className="col-md-3 col-6">
              <span className="text-secondary d-block" style={{ fontSize: '0.7rem' }}>Nationality</span>
              <strong className={`text-dark${isJustLoaded ? ' map-autofill-animate' : ''}`}>{crewMember.nationality}</strong>
            </div>
            <div className="col-md-3 col-6">
              <span className="text-secondary d-block" style={{ fontSize: '0.7rem' }}>Seaman's Book No</span>
              <strong className={`text-dark${isJustLoaded ? ' map-autofill-animate' : ''}`}>{crewMember.seamansBookNo}</strong>
            </div>
            <div className="col-md-3 col-6">
              <span className="text-secondary d-block" style={{ fontSize: '0.7rem' }}>Passport No</span>
              <strong className={`text-dark${isJustLoaded ? ' map-autofill-animate' : ''}`}>{crewMember.passportNo}</strong>
            </div>
            <div className="col-md-3 col-6">
              <span className="text-secondary d-block" style={{ fontSize: '0.7rem' }}>Date of Birth</span>
              <strong className={`text-dark${isJustLoaded ? ' map-autofill-animate' : ''}`}>{crewMember.dateOfBirth}</strong>
            </div>
            <div className="col-md-3 col-6">
              <span className="text-secondary d-block" style={{ fontSize: '0.7rem' }}>Emergency Contact</span>
              <strong className={`text-dark text-truncate d-block${isJustLoaded ? ' map-autofill-animate' : ''}`}>{crewMember.emergencyContact}</strong>
            </div>
            <div className="col-md-3 col-6">
              <span className="text-secondary d-block" style={{ fontSize: '0.7rem' }}>Last Compliance Audit</span>
              <strong className={`text-dark${isJustLoaded ? ' map-autofill-animate' : ''}`}>{formatMaritimeDate(crewMember.lastAuditedDate)}</strong>
            </div>
            <div className="col-md-3 col-6">
              <span className="text-secondary d-block" style={{ fontSize: '0.7rem' }}>Management Permissions</span>
              <span className={`badge ${canManageDocuments ? 'bg-info text-dark' : 'bg-secondary text-white'}`}>
                {canManageDocuments ? 'Admin / Submitter Full Access' : 'Read-Only Mode'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 1: Historical Sea Service & Vessel Assignments Register */}
      <div className="card map-card-custom">
        <div className="card-header p-3 border-bottom d-flex align-items-center justify-between">
          <div className="fw-bold text-dark fs-6">
            Assigned Vessels and Roles History
          </div>
        </div>
        <div className="table-responsive">
          <table className="table map-table-custom align-middle mb-0">
            <thead>
              <tr>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => {
                    if (assignmentSortField === 'vesselName') setAssignmentSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                    else { setAssignmentSortField('vesselName'); setAssignmentSortDirection('asc'); }
                  }}
                >
                  Vessel Name {renderSortIndicator(assignmentSortField, 'vesselName', assignmentSortDirection)}
                </th>
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
                    if (assignmentSortField === 'vesselType') setAssignmentSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                    else { setAssignmentSortField('vesselType'); setAssignmentSortDirection('asc'); }
                  }}
                >
                  Vessel Type {renderSortIndicator(assignmentSortField, 'vesselType', assignmentSortDirection)}
                </th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => {
                    if (assignmentSortField === 'rankHeld') setAssignmentSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                    else { setAssignmentSortField('rankHeld'); setAssignmentSortDirection('asc'); }
                  }}
                >
                  Rank Held {renderSortIndicator(assignmentSortField, 'rankHeld', assignmentSortDirection)}
                </th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => {
                    if (assignmentSortField === 'embarkDate') setAssignmentSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                    else { setAssignmentSortField('embarkDate'); setAssignmentSortDirection('desc'); }
                  }}
                >
                  Embarkation Date {renderSortIndicator(assignmentSortField, 'embarkDate', assignmentSortDirection)}
                </th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => {
                    if (assignmentSortField === 'disembarkDate') setAssignmentSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                    else { setAssignmentSortField('disembarkDate'); setAssignmentSortDirection('desc'); }
                  }}
                >
                  Disembarkation Date {renderSortIndicator(assignmentSortField, 'disembarkDate', assignmentSortDirection)}
                </th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => {
                    if (assignmentSortField === 'isCurrent') setAssignmentSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                    else { setAssignmentSortField('isCurrent'); setAssignmentSortDirection('desc'); }
                  }}
                >
                  Assignment Status {renderSortIndicator(assignmentSortField, 'isCurrent', assignmentSortDirection)}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedAssignments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-4 text-muted">
                    No historical assignments recorded.
                  </td>
                </tr>
              ) : (
                sortedAssignments.map((asg: CrewVesselAssignment) => (
                  <tr key={asg.id}>
                    <td className="fw-semibold text-primary">
                      <button
                        type="button"
                        className="btn btn-link p-0 text-primary text-start fw-semibold text-decoration-underline border-0 bg-transparent align-baseline"
                        onClick={() => setCurrentHashView('vessels', asg.vesselId)}
                        title={`Click to view ${asg.vesselName} vessel details`}
                      >
                        {asg.vesselName}
                      </button>
                    </td>
                    <td className="font-mono-code">{asg.imoNumber}</td>
                    <td>
                      <span className="badge bg-light text-dark border">{asg.vesselType}</span>
                    </td>
                    <td>{asg.rankHeld}</td>
                    <td className="font-mono-code small">{formatMaritimeDate(asg.embarkDate)}</td>
                    <td className="font-mono-code small">
                      {asg.disembarkDate ? formatMaritimeDate(asg.disembarkDate) : <span className="text-success fw-bold">Active On Board</span>}
                    </td>
                    <td>
                      <span className={`badge ${asg.isCurrent ? 'bg-success text-white' : 'bg-secondary text-white'}`}>
                        {asg.isCurrent ? 'Current Assignment' : 'Completed Tour'}
                      </span>
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
              Layer 1 — Universal STCW Core Documents Register
            </div>
            <div className="text-secondary small">
              Mandatory universal credentials required for all crew members (Passport, Seaman's Book, BST, ENG1 Medical, Security Awareness)
            </div>
          </div>
          {canManageDocuments && (
            <button
              type="button"
              className="btn btn-sm btn-primary ms-auto"
              onClick={() => handleOpenUploadNew('Layer 1 - Universal Core')}
            >
              Upload Core Certificate
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
                    if (layer1SortField === 'title') setLayer1SortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                    else { setLayer1SortField('title'); setLayer1SortDirection('asc'); }
                  }}
                >
                  Document Title {renderSortIndicator(layer1SortField, 'title', layer1SortDirection)}
                </th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => {
                    if (layer1SortField === 'stcwRegulation') setLayer1SortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                    else { setLayer1SortField('stcwRegulation'); setLayer1SortDirection('asc'); }
                  }}
                >
                  STCW Regulation {renderSortIndicator(layer1SortField, 'stcwRegulation', layer1SortDirection)}
                </th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => {
                    if (layer1SortField === 'certificateNo') setLayer1SortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                    else { setLayer1SortField('certificateNo'); setLayer1SortDirection('asc'); }
                  }}
                >
                  Certificate No {renderSortIndicator(layer1SortField, 'certificateNo', layer1SortDirection)}
                </th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => {
                    if (layer1SortField === 'issuingAuthority') setLayer1SortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                    else { setLayer1SortField('issuingAuthority'); setLayer1SortDirection('asc'); }
                  }}
                >
                  Issuing Authority &amp; Flag {renderSortIndicator(layer1SortField, 'issuingAuthority', layer1SortDirection)}
                </th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => {
                    if (layer1SortField === 'issueDate') setLayer1SortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                    else { setLayer1SortField('issueDate'); setLayer1SortDirection('desc'); }
                  }}
                >
                  Issue Date {renderSortIndicator(layer1SortField, 'issueDate', layer1SortDirection)}
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
                  Status {renderSortIndicator(layer1SortField, 'verificationStatus', layer1SortDirection)}
                </th>
                <th className="text-end" style={{ whiteSpace: 'nowrap' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedLayer1Docs.map((doc: STCWDocumentItem) => (
                <tr key={doc.id}>
                  <td className="fw-semibold text-primary">{doc.title}</td>
                  <td className="font-mono-code small">{doc.stcwRegulation}</td>
                  <td className="font-mono-code">{doc.certificateNo}</td>
                  <td className="small">
                    <div>{doc.issuingAuthority}</div>
                    {doc.flagState && <span className="text-muted">Flag: {doc.flagState}</span>}
                  </td>
                  <td className="font-mono-code small">{formatMaritimeDate(doc.issueDate)}</td>
                  <td className="font-mono-code small">{formatMaritimeDate(doc.expiryDate)}</td>
                  <td>{renderStatusBadge(doc.verificationStatus)}</td>
                  <td className="text-end">
                    <div className="d-flex align-items-center justify-content-end gap-1">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary py-1 px-2"
                        style={{ fontSize: '0.75rem' }}
                        onClick={() => handleOpenViewDoc(doc)}
                      >
                        View
                      </button>
                      {canManageDocuments && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger py-1 px-2"
                          style={{ fontSize: '0.75rem' }}
                          onClick={() => handleDeleteDoc(doc.id)}
                        >
                          Delete
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
              Layer 2 — Vessel-Specific Certificates & Advanced Endorsements Register
            </div>
            <div className="text-secondary small">
              Vessel, propulsion & cargo-specific credentials (CoC, Flag Endorsement, Advanced Tanker, IGF Code, DP Operator, Crowd Management)
            </div>
          </div>
          {canManageDocuments && (
            <button
              type="button"
              className="btn btn-sm btn-primary ms-auto"
              onClick={() => handleOpenUploadNew('Layer 2 - Vessel Specific & Endorsements')}
            >
              Add Layer 2 Endorsement
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
                    if (layer2SortField === 'title') setLayer2SortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                    else { setLayer2SortField('title'); setLayer2SortDirection('asc'); }
                  }}
                >
                  Endorsement / Certificate Title {renderSortIndicator(layer2SortField, 'title', layer2SortDirection)}
                </th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => {
                    if (layer2SortField === 'stcwRegulation') setLayer2SortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                    else { setLayer2SortField('stcwRegulation'); setLayer2SortDirection('asc'); }
                  }}
                >
                  STCW Layer 2 Scope {renderSortIndicator(layer2SortField, 'stcwRegulation', layer2SortDirection)}
                </th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => {
                    if (layer2SortField === 'certificateNo') setLayer2SortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                    else { setLayer2SortField('certificateNo'); setLayer2SortDirection('asc'); }
                  }}
                >
                  Certificate No {renderSortIndicator(layer2SortField, 'certificateNo', layer2SortDirection)}
                </th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => {
                    if (layer2SortField === 'issuingAuthority') setLayer2SortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                    else { setLayer2SortField('issuingAuthority'); setLayer2SortDirection('asc'); }
                  }}
                >
                  Issuing Body {renderSortIndicator(layer2SortField, 'issuingAuthority', layer2SortDirection)}
                </th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => {
                    if (layer2SortField === 'flagState') setLayer2SortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
                    else { setLayer2SortField('flagState'); setLayer2SortDirection('asc'); }
                  }}
                >
                  Flag State {renderSortIndicator(layer2SortField, 'flagState', layer2SortDirection)}
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
                  Status {renderSortIndicator(layer2SortField, 'verificationStatus', layer2SortDirection)}
                </th>
                <th className="text-end" style={{ whiteSpace: 'nowrap' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedLayer2Docs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-4 text-muted">
                    No Layer 2 vessel-specific endorsements uploaded.
                  </td>
                </tr>
              ) : (
                sortedLayer2Docs.map((doc: STCWDocumentItem) => (
                  <tr key={doc.id}>
                    <td className="fw-semibold text-primary">{doc.title}</td>
                    <td className="font-mono-code small">{doc.stcwRegulation}</td>
                    <td className="font-mono-code">{doc.certificateNo}</td>
                    <td className="small">{doc.issuingAuthority}</td>
                    <td>
                      <span className="badge bg-light text-dark border">{doc.flagState || 'Universal'}</span>
                    </td>
                    <td className="font-mono-code small">{formatMaritimeDate(doc.expiryDate)}</td>
                    <td>{renderStatusBadge(doc.verificationStatus)}</td>
                    <td className="text-end">
                      <div className="d-flex align-items-center justify-content-end gap-1">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary py-1 px-2"
                          style={{ fontSize: '0.75rem' }}
                          onClick={() => handleOpenViewDoc(doc)}
                        >
                          View
                        </button>
                        {canManageDocuments && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger py-1 px-2"
                            style={{ fontSize: '0.75rem' }}
                            onClick={() => handleDeleteDoc(doc.id)}
                          >
                            Delete
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

      <AddToProjectModal
        isOpen={showAddToProjectModal}
        onClose={() => setShowAddToProjectModal(false)}
        assetType="Crew"
        assetId={crewMember.id}
        assetName={crewMember.fullName}
        providerOrganization={crewMember.organization || 'Northwind Marine Pty Ltd'}
      />
    </div>
  );
};
