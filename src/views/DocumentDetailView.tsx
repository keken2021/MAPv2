/* 
  file summary: master document deep-dive view presenting complete 13 vessel or 11 crew attributes and versioning timeline in light theme.
  responsibilities: displays extracted metadata fields, charter buffer validation rules, and file version history.
  role in system: deep-dive view rendered when a document row is selected.
*/

import React, { useState, useEffect, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useMapStore } from '../store/useMapStore';
import { ConfidenceBadge } from '../components/common/ConfidenceBadge';
import { formatMaritimeDate, getStatusDisplayLabel } from '../utils/formatters';
import { exportToCsv, exportToPdf } from '../utils/exportHelpers';
import { DocumentUploadModal } from '../components/drawers/DocumentUploadModal';
import { DocumentVersion } from '../types/document';
import { usePagination } from '../utils/usePagination';
import { TablePagination } from '../components/common/TablePagination';

interface DocumentDetailViewProps {
  documentId: string;
}

/**
  what: renders document deep-dive detail view in light theme with version history export controls and submitter version upload triggers.
  how: fetches document from store by documentId, displays 13 vessel or 11 crew extracted attributes, and handles new version uploads for Submitter role.
  with what file: src/views/DocumentDetailView.tsx loaded by App.tsx.
*/
export const DocumentDetailView: React.FC<DocumentDetailViewProps> = ({ documentId }) => {
  const { documents, setCurrentHashView, previousHashView, previousEntityId, activePersona } = useMapStore();
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  /* triggers one-shot shimmer on all extracted attribute value cells on mount */
  const [isJustLoaded, setIsJustLoaded] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setIsJustLoaded(false), 800);
    return () => clearTimeout(timer);
  }, [documentId]);

  const canUpload = activePersona === 'Submitter' || activePersona === 'Administrator';

  const doc = documents.find((d) => d.id === documentId) || documents[0];

  type VersionSortField = 'versionLabel' | 'fileName' | 'uploadedAt' | 'uploadedBy' | 'fileSizeBytes' | 'changeSummary';
  const [versionSortField, setVersionSortField] = useState<VersionSortField>('uploadedAt');
  const [versionSortDirection, setVersionSortDirection] = useState<'asc' | 'desc'>('desc');

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

  const sortedVersions = useMemo(() => {
    if (!doc?.versions) return [];
    return [...doc.versions].sort((a, b) => {
      let comp = 0;
      if (versionSortField === 'versionLabel') comp = a.versionLabel.localeCompare(b.versionLabel);
      else if (versionSortField === 'fileName') comp = a.fileName.localeCompare(b.fileName);
      else if (versionSortField === 'uploadedAt') comp = new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
      else if (versionSortField === 'uploadedBy') comp = a.uploadedBy.localeCompare(b.uploadedBy);
      else if (versionSortField === 'fileSizeBytes') comp = a.fileSizeBytes - b.fileSizeBytes;
      else if (versionSortField === 'changeSummary') comp = a.changeSummary.localeCompare(b.changeSummary);
      return versionSortDirection === 'asc' ? comp : -comp;
    });
  }, [doc, versionSortField, versionSortDirection]);

  const handleVersionSort = (field: VersionSortField) => {
    if (versionSortField === field) {
      setVersionSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
    } else {
      setVersionSortField(field);
      setVersionSortDirection('asc');
    }
  };

  const versionsPagination = usePagination(sortedVersions, [versionSortField, versionSortDirection]);

  if (!doc) return <div>Document not found.</div>;

  const handleExportCsv = () => {
    const metaRows: Record<string, string>[] = [
      {
        Section: 'DOCUMENT SUMMARY',
        AttributeOrFile: 'Title & Cert No',
        ValueOrTimestamp: `${doc.title} (${doc.certificateNo})`,
        AuthorityOrUploader: doc.issuingAuthority,
        StatusOrSize: doc.verificationStatus,
        Details: `Entity: ${doc.entityType} | Expiry: ${doc.expiryDate} | OCR Conf: ${doc.ocrConfidence}% | Version: ${doc.currentVersion}`,
      },
    ];

    if (doc.vesselAttributes) {
      Object.entries(doc.vesselAttributes).forEach(([key, val]) => {
        metaRows.push({
          Section: 'EXTRACTED ATTRIBUTES',
          AttributeOrFile: key,
          ValueOrTimestamp: String(val),
          AuthorityOrUploader: 'OCR Extracted',
          StatusOrSize: 'Valid',
          Details: 'Vessel Particular Attribute',
        });
      });
    } else if (doc.crewAttributes) {
      Object.entries(doc.crewAttributes).forEach(([key, val]) => {
        metaRows.push({
          Section: 'EXTRACTED ATTRIBUTES',
          AttributeOrFile: key,
          ValueOrTimestamp: String(val),
          AuthorityOrUploader: 'OCR Extracted',
          StatusOrSize: 'Valid',
          Details: 'Crew Attribute',
        });
      });
    }

    const versionRows = doc.versions.map((v) => ({
      Section: 'VERSION HISTORY',
      AttributeOrFile: v.fileName,
      ValueOrTimestamp: v.uploadedAt,
      AuthorityOrUploader: v.uploadedBy,
      StatusOrSize: `${(v.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB`,
      Details: `Version: ${v.versionLabel} | ${v.changeSummary}`,
    }));

    exportToCsv(`${doc.certificateNo}_Complete_Document_Detail`, [...metaRows, ...versionRows]);
    setIsExportOpen(false);
  };

  const handleExportPdf = () => {
    const headers = ['Section', 'Attribute / File Name', 'Value / Timestamp', 'Authority / Uploader', 'Status / Size', 'Details'];
    const metaRows: (string | number)[][] = [
      [
        'DOCUMENT SUMMARY',
        `${doc.title} (${doc.certificateNo})`,
        `Expiry: ${doc.expiryDate}`,
        doc.issuingAuthority,
        doc.verificationStatus,
        `Type: ${doc.entityType} | OCR: ${doc.ocrConfidence}% | Version: ${doc.currentVersion}`,
      ],
    ];

    if (doc.vesselAttributes) {
      Object.entries(doc.vesselAttributes).forEach(([key, val]) => {
        metaRows.push(['EXTRACTED ATTRIBUTES', key, String(val), 'OCR System', 'Verified', 'Vessel Attribute']);
      });
    } else if (doc.crewAttributes) {
      Object.entries(doc.crewAttributes).forEach(([key, val]) => {
        metaRows.push(['EXTRACTED ATTRIBUTES', key, String(val), 'OCR System', 'Verified', 'Crew Attribute']);
      });
    }

    const versionRows: (string | number)[][] = doc.versions.map((v) => [
      'VERSION HISTORY',
      v.fileName,
      v.uploadedAt,
      v.uploadedBy,
      `${(v.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB`,
      `Version ${v.versionLabel}: ${v.changeSummary}`,
    ]);

    exportToPdf(`${doc.title} Complete Detail Report`, headers, [...metaRows, ...versionRows]);
    setIsExportOpen(false);
  };

  return (
    <div className="d-flex flex-column gap-4">
      {/* Unified Main Info & Extracted Attributes Card */}
      <div className="card map-card-custom">
        {/* Card Header / Title Row */}
        <div className="card-header p-4 bg-white border-bottom d-flex flex-wrap align-items-center justify-between gap-3">
          <div className="d-flex align-items-center gap-3">
            <h3 className="fw-bold mb-0 text-primary">{doc.title}</h3>
            <span
              className={`badge p-2 ${doc.verificationStatus === 'Verified'
                ? 'bg-success text-white'
                : doc.verificationStatus === 'Correction Requested'
                  ? 'bg-warning text-dark'
                  : doc.verificationStatus === 'Rejected'
                    ? 'bg-danger text-white'
                    : 'bg-secondary text-white'
                }`}
              style={{ fontSize: '0.825rem' }}
            >
              {getStatusDisplayLabel(doc.verificationStatus)}
            </span>
          </div>

          {/* Export Data Button */}
          <div className="dropdown position-relative ms-auto">
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

        {/* Card Body: Extracted Metadata Attributes Grid */}
        <div className="card-body p-4">
          {/* Validation exception alert if any */}
          {!doc.validationRules.overallValid && (
            <div className="alert alert-warning p-3 mb-3 border-warning">
              <h6 className="fw-bold mb-1">Validation Exception</h6>
              <div>{doc.validationRules.exceptionDetails || 'Document requires attention prior to charter verification.'}</div>
            </div>
          )}

          {doc.vesselAttributes && (
            <div className="row g-3 small">
              <div className="col-md-4">
                <span className="text-secondary">Certificate No.:</span> <div className="font-mono-code"><strong className={`text-dark${isJustLoaded ? ' map-autofill-animate' : ''}`}>{doc.vesselAttributes.certificateNumber}</strong></div>
              </div>
              <div className="col-md-4">
                <span className="text-secondary">Type:</span> <div><strong className={`text-dark${isJustLoaded ? ' map-autofill-animate' : ''}`}>{doc.vesselAttributes.certType}</strong></div>
              </div>
              <div className="col-md-4">
                <span className="text-secondary">Issuing Authority:</span> <div><strong className={`text-dark${isJustLoaded ? ' map-autofill-animate' : ''}`}>{doc.vesselAttributes.issuingBody}</strong></div>
              </div>
              <div className="col-md-4">
                <span className="text-secondary">Issue Date:</span> <div className="font-mono-code"><strong className={`text-dark${isJustLoaded ? ' map-autofill-animate' : ''}`}>{formatMaritimeDate(doc.vesselAttributes.issueDate)}</strong></div>
              </div>
              <div className="col-md-4">
                <span className="text-secondary">Expiry Date:</span> <div className="font-mono-code"><strong className={`text-dark${isJustLoaded ? ' map-autofill-animate' : ''}`}>{formatMaritimeDate(doc.vesselAttributes.expiryDate)}</strong></div>
              </div>
              <div className="col-md-4">
                <span className="text-secondary">Vessel:</span> <div><strong className={`text-dark${isJustLoaded ? ' map-autofill-animate' : ''}`}>{doc.vesselAttributes.vesselName}</strong></div>
              </div>
              <div className="col-md-4">
                <span className="text-secondary">IMO Number:</span> <div className="font-mono-code"><strong className={`text-dark${isJustLoaded ? ' map-autofill-animate' : ''}`}>{doc.vesselAttributes.imoNumber}</strong></div>
              </div>
              <div className="col-md-4">
                <span className="text-secondary">Flag State:</span> <div><strong className={`text-dark${isJustLoaded ? ' map-autofill-animate' : ''}`}>{doc.vesselAttributes.flagState}</strong></div>
              </div>
              <div className="col-md-4">
                <span className="text-secondary">100% Asset Match:</span> <div><span className="badge bg-success text-white">Match Verified</span></div>
              </div>
              <div className="col-md-4">
                <span className="text-secondary">Last Survey Date:</span> <div className="font-mono-code"><strong className={`text-dark${isJustLoaded ? ' map-autofill-animate' : ''}`}>{formatMaritimeDate(doc.vesselAttributes.lastSurveyDate)}</strong></div>
              </div>
              <div className="col-md-4">
                <span className="text-secondary">OCR Confidence:</span> <div><ConfidenceBadge score={doc.vesselAttributes.ocrConfidence} /></div>
              </div>
            </div>
          )}

          {doc.crewAttributes && (
            <div className="row g-3 small">
              <div className="col-md-4">
                <span className="text-secondary">Crew:</span> <div><strong className={`text-dark${isJustLoaded ? ' map-autofill-animate' : ''}`}>{doc.crewAttributes.crewName}</strong></div>
              </div>
              <div className="col-md-4">
                <span className="text-secondary">Passport No.:</span> <div className="font-mono-code"><strong className={`text-dark${isJustLoaded ? ' map-autofill-animate' : ''}`}>{doc.crewAttributes.passportId}</strong></div>
              </div>
              <div className="col-md-4">
                <span className="text-secondary">Rank:</span> <div><strong className={`text-dark${isJustLoaded ? ' map-autofill-animate' : ''}`}>{doc.crewAttributes.rank}</strong></div>
              </div>
              <div className="col-md-4">
                <span className="text-secondary">Type:</span> <div><strong className={`text-dark${isJustLoaded ? ' map-autofill-animate' : ''}`}>{doc.crewAttributes.certType}</strong></div>
              </div>
              <div className="col-md-4">
                <span className="text-secondary">Issuing Authority:</span> <div><strong className={`text-dark${isJustLoaded ? ' map-autofill-animate' : ''}`}>{doc.crewAttributes.issuingCenter}</strong></div>
              </div>
              <div className="col-md-4">
                <span className="text-secondary">Issue Date:</span> <div className="font-mono-code"><strong className={`text-dark${isJustLoaded ? ' map-autofill-animate' : ''}`}>{formatMaritimeDate(doc.crewAttributes.issueDate)}</strong></div>
              </div>
              <div className="col-md-4">
                <span className="text-secondary">Expiry Date:</span> <div className="font-mono-code"><strong className={`text-dark${isJustLoaded ? ' map-autofill-animate' : ''}`}>{formatMaritimeDate(doc.crewAttributes.expiryDate)}</strong></div>
              </div>
              <div className="col-md-4">
                <span className="text-secondary">Vessel:</span> <div><strong className={`text-dark${isJustLoaded ? ' map-autofill-animate' : ''}`}>{doc.crewAttributes.assignedVessel}</strong></div>
              </div>
              <div className="col-md-4">
                <span className="text-secondary">Nationality:</span> <div><strong className={`text-dark${isJustLoaded ? ' map-autofill-animate' : ''}`}>{doc.crewAttributes.nationality}</strong></div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Version History Table */}
      <div className="card map-card-custom">
        <div className="card-header p-3 d-flex align-items-center justify-between fw-bold text-dark">
          <div>
            Version History ({doc.versions.length})
          </div>
          {canUpload && (
            <button
              type="button"
              className="btn btn-sm btn-primary text-white font-mono-code ms-auto"
              onClick={() => setIsUploadModalOpen(true)}
            >
              Upload New Version
            </button>
          )}
        </div>
        <div className="table-responsive">
          <table className="table map-table-custom align-middle mb-0">
            <thead>
              <tr>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => handleVersionSort('versionLabel')}
                >
                  Version {renderSortIndicator(versionSortField, 'versionLabel', versionSortDirection)}
                </th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => handleVersionSort('fileName')}
                >
                  File Name {renderSortIndicator(versionSortField, 'fileName', versionSortDirection)}
                </th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => handleVersionSort('uploadedAt')}
                >
                  Uploaded (UTC) {renderSortIndicator(versionSortField, 'uploadedAt', versionSortDirection)}
                </th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => handleVersionSort('uploadedBy')}
                >
                  Uploaded By {renderSortIndicator(versionSortField, 'uploadedBy', versionSortDirection)}
                </th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => handleVersionSort('fileSizeBytes')}
                >
                  File Size {renderSortIndicator(versionSortField, 'fileSizeBytes', versionSortDirection)}
                </th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => handleVersionSort('changeSummary')}
                >
                  Change Summary {renderSortIndicator(versionSortField, 'changeSummary', versionSortDirection)}
                </th>
              </tr>
            </thead>
            <tbody>
              {versionsPagination.pageItems.map((ver: DocumentVersion) => (
                <tr key={ver.versionLabel}>
                  <td>
                    <span className="badge bg-info text-dark font-mono-code">{ver.versionLabel}</span>
                  </td>
                  <td className="fw-semibold text-primary">{ver.fileName}</td>
                  <td className="font-mono-code small">{formatMaritimeDate(ver.uploadedAt)}</td>
                  <td>{ver.uploadedBy}</td>
                  <td className="font-mono-code small">{Math.round(ver.fileSizeBytes / 1024 / 1024 * 10) / 10} MB</td>
                  <td className="small text-secondary">{ver.changeSummary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TablePagination {...versionsPagination.controls} />
      </div>

      {/* Upload New Version Modal */}
      <DocumentUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        existingDocument={doc}
      />
    </div>
  );
};
