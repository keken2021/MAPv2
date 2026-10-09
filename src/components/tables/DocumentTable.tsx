/* 
  file summary: Document Library data table component with grouped search box/filters/sort controls on left and grouped export/upload buttons on right.
  responsibilities: presents certificate numbers, issuing authorities, ocr confidence scores, multi-column sorting, and action controls.
  role in system: main data table for DocumentLibraryView.tsx.
*/

import React, { useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Eye } from 'lucide-react';
import { useMapStore } from '../../store/useMapStore';
import { MasterDocument, ComplianceState } from '../../types/document';
import { ConfidenceBadge } from '../common/ConfidenceBadge';
import { FilterModal } from '../common/FilterModal';
import { FilterButton } from '../common/FilterButton';
import { ActiveFilterChips, FilterChip } from '../common/ActiveFilterChips';
import { formatMaritimeDate, getStatusDisplayLabel } from '../../utils/formatters';
import { exportToCsv, exportToPdf } from '../../utils/exportHelpers';
import { canPerform } from '../../utils/permissionHelpers';

type SortField =
  | 'title'
  | 'entityType'
  | 'certificateNo'
  | 'issuingAuthority'
  | 'expiryDate'
  | 'ocrConfidence'
  | 'complianceState'
  | 'currentVersion';

interface DocumentTableProps {
  onSelectDocument: (doc: MasterDocument) => void;
  onOpenVersionHistory?: (doc: MasterDocument) => void;
  onUploadDocument?: () => void;
}

/**
  what: renders Document Library table with search filters, column sorting, and export/upload actions.
  how: filters and sorts documents array and triggers csv/pdf exports or opens upload modal on button clicks.
  with what file: src/components/tables/DocumentTable.tsx loaded by DocumentLibraryView.tsx.
*/
export const DocumentTable: React.FC<DocumentTableProps> = ({
  onSelectDocument,
  onOpenVersionHistory,
  onUploadDocument,
}) => {
  const {
    documents,
    activePersona,
    rolePermissionDefaults,
    userPermissionOverrides,
    customScopes,
    users,
  } = useMapStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [verificationFilter, setVerificationFilter] = useState('ALL');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [sortField, setSortField] = useState<SortField>('title');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isExportOpen, setIsExportOpen] = useState(false);

  const matchingUser = users.find((u) => u.roles.includes(activePersona)) ?? null;
  const canUpload =
    activePersona === 'Administrator' ||
    canPerform(
      rolePermissionDefaults,
      userPermissionOverrides,
      matchingUser,
      activePersona,
      'documents',
      'create',
      customScopes,
    );

  const filteredDocs = documents.filter((d) => {
    const matchesSearch =
      d.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.certificateNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.issuingAuthority.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'ALL' || d.entityType === typeFilter;
    const matchesStatus = statusFilter === 'ALL' || d.complianceState === statusFilter;
    const matchesVerification = verificationFilter === 'ALL' || d.verificationStatus === verificationFilter;
    return matchesSearch && matchesType && matchesStatus && matchesVerification;
  });

  const activeFilterCount =
    (typeFilter !== 'ALL' ? 1 : 0) +
    (statusFilter !== 'ALL' ? 1 : 0) +
    (verificationFilter !== 'ALL' ? 1 : 0);

  const activeChips: FilterChip[] = [
    ...(typeFilter !== 'ALL' ? [{ id: 'type', label: 'Type', value: typeFilter, onRemove: () => setTypeFilter('ALL') }] : []),
    ...(statusFilter !== 'ALL' ? [{ id: 'status', label: 'Compliance', value: getStatusDisplayLabel(statusFilter), onRemove: () => setStatusFilter('ALL') }] : []),
    ...(verificationFilter !== 'ALL' ? [{ id: 'verif', label: 'Verification', value: getStatusDisplayLabel(verificationFilter), onRemove: () => setVerificationFilter('ALL') }] : []),
  ];

  const handleResetFilters = () => {
    setTypeFilter('ALL');
    setStatusFilter('ALL');
    setVerificationFilter('ALL');
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown size={13} className="text-muted ms-1 opacity-50 d-inline-block" />;
    return sortDirection === 'asc' ? <ArrowUp size={13} className="text-primary ms-1 d-inline-block" /> : <ArrowDown size={13} className="text-primary ms-1 d-inline-block" />;
  };

  const sortedDocs = [...filteredDocs].sort((a, b) => {
    let valA: any = a[sortField] ?? '';
    let valB: any = b[sortField] ?? '';

    if (sortField === 'ocrConfidence') {
      valA = Number(valA) || 0;
      valB = Number(valB) || 0;
    } else if (sortField === 'expiryDate') {
      valA = new Date(valA).getTime() || 0;
      valB = new Date(valB).getTime() || 0;
    } else if (typeof valA === 'string') {
      valA = valA.toLowerCase();
      valB = (valB as string).toLowerCase();
    }

    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const getComplianceBadgeClass = (state: ComplianceState) => {
    switch (state) {
      case 'Valid': return 'bg-success text-white';
      case 'Expiring < 6 Mos': return 'bg-warning text-dark';
      case 'Mismatch/Exception': return 'bg-danger text-white';
      case 'Expired': return 'bg-danger text-white';
      default: return 'bg-secondary text-white';
    }
  };

  const handleExportCsv = () => {
    const exportData = sortedDocs.map((d) => ({
      Title: d.title,
      Type: d.entityType,
      CertificateNo: d.certificateNo,
      IssuingAuthority: d.issuingAuthority,
      ExpiryDate: d.expiryDate,
      OcrConfidence: `${d.ocrConfidence}%`,
      Compliance: getStatusDisplayLabel(d.complianceState),
      Version: d.currentVersion,
      Verification: getStatusDisplayLabel(d.verificationStatus),
    }));
    exportToCsv('Document_Library', exportData);
    setIsExportOpen(false);
  };

  const handleExportPdf = () => {
    const headers = ['Title', 'Type', 'Issuing Authority', 'Expiry Date', 'OCR Confidence', 'Compliance', 'Version'];
    const rows = sortedDocs.map((d) => [
      d.title,
      d.entityType,
      d.issuingAuthority,
      d.expiryDate,
      `${d.ocrConfidence}%`,
      getStatusDisplayLabel(d.complianceState),
      d.currentVersion,
    ]);
    exportToPdf('Document Library', headers, rows);
    setIsExportOpen(false);
  };

  return (
    <div className="card map-card-custom">
      {/* Table Header Controls Row: Grouped Search/Filter/Sort Left, Grouped Export/Upload Right */}
      <div className="card-header d-flex flex-wrap align-items-center justify-between gap-3 p-3">
        {/* Group 1 (Left): Search Box & Filter Button */}
        <div className="d-flex flex-wrap align-items-center gap-2">
          <input
            type="text"
            className="form-control form-control-sm bg-white text-dark border-secondary"
            placeholder="Search documents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '240px' }}
          />
          <FilterButton
            onClick={() => setIsFilterModalOpen(true)}
            activeCount={activeFilterCount}
          />
        </div>

        {/* Group 2 (Right): Export & Upload Action Buttons on corner right of the row */}
        <div className="d-flex align-items-center gap-2 ms-auto">
          {/* Export Dropdown */}
          <div className="dropdown position-relative">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary text-dark dropdown-toggle"
              onClick={() => setIsExportOpen(!isExportOpen)}
            >
              Export
            </button>
            {isExportOpen && (
              <ul className="dropdown-menu dropdown-menu-light show position-absolute end-0 mt-1 shadow border">
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

          {/* Upload Document Action Button */}
          {canUpload && onUploadDocument && (
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={onUploadDocument}
            >
              Upload Document
            </button>
          )}
        </div>
      </div>

      {activeChips.length > 0 && (
        <div className="px-3 py-2 bg-light border-bottom">
          <ActiveFilterChips chips={activeChips} onClearAll={handleResetFilters} />
        </div>
      )}

      <div className="table-responsive">
        <table className="table map-table-custom align-middle mb-0">
          <thead>
            <tr>
              <th onClick={() => handleSort('certificateNo')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                Certificate No. {renderSortIndicator('certificateNo')}
              </th>
              <th onClick={() => handleSort('title')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                Title {renderSortIndicator('title')}
              </th>
              <th onClick={() => handleSort('entityType')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                Type {renderSortIndicator('entityType')}
              </th>
              <th onClick={() => handleSort('expiryDate')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                Expiry Date {renderSortIndicator('expiryDate')}
              </th>
              <th onClick={() => handleSort('complianceState')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                Compliance {renderSortIndicator('complianceState')}
              </th>
              <th className="text-end" style={{ whiteSpace: 'nowrap' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedDocs.map((doc) => (
              <tr
                key={doc.id}
                onClick={() => onSelectDocument(doc)}
                style={{ cursor: 'pointer' }}
              >
                <td className="font-mono-code fw-semibold text-primary">{doc.certificateNo}</td>
                <td>
                  <div className="fw-semibold text-dark">{doc.title}</div>
                  <div className="small font-mono-code text-secondary">
                    v{doc.currentVersion}
                  </div>
                </td>
                <td>
                  <span className="badge bg-light text-dark border" style={{ fontSize: '0.75rem' }}>
                    {doc.entityType}
                  </span>
                  <div className="small text-muted mt-0.5">{doc.issuingAuthority}</div>
                </td>
                <td className="font-mono-code small">{formatMaritimeDate(doc.expiryDate)}</td>
                <td>
                  <span className={`badge ${getComplianceBadgeClass(doc.complianceState)}`}>
                    {getStatusDisplayLabel(doc.complianceState)}
                  </span>
                </td>
                <td className="text-end">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center p-0"
                    style={{ width: '32px', height: '32px' }}
                    title="View"
                    aria-label="View"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectDocument(doc);
                    }}
                  >
                    <Eye size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Document Filter Modal */}
      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        onReset={handleResetFilters}
        title="Filters"
        activeCount={activeFilterCount}
      >
        <div className="card p-3 bg-white border rounded">
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label small fw-semibold text-secondary mb-1">Type</label>
              <select
                className="form-select form-select-sm bg-white text-dark border-secondary"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="ALL">All Types</option>
                <option value="Vessel Certificate">Vessel Certificate</option>
                <option value="Crew Certificate">Crew Certificate</option>
                <option value="Equipment Certificate">Equipment Certificate</option>
                <option value="Project Dossier">Project Document</option>
              </select>
            </div>

            <div className="col-md-6">
              <label className="form-label small fw-semibold text-secondary mb-1">Compliance</label>
              <select
                className="form-select form-select-sm bg-white text-dark border-secondary"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="Valid">Valid</option>
                <option value="Expiring < 6 Mos">Expiring Soon</option>
                <option value="Mismatch/Exception">Mismatch</option>
                <option value="Expired">Expired</option>
              </select>
            </div>

            <div className="col-12">
              <label className="form-label small fw-semibold text-secondary mb-1">Verification</label>
              <select
                className="form-select form-select-sm bg-white text-dark border-secondary"
                value={verificationFilter}
                onChange={(e) => setVerificationFilter(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="Verified">Verified</option>
                <option value="Pending">Pending</option>
                <option value="Correction Requested">Returned for Correction</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
          </div>
        </div>
      </FilterModal>
    </div>
  );
};

