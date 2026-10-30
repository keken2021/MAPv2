/* 
  file summary: Document Library data table component with grouped search box/filters/sort controls on left and grouped export/upload buttons on right.
  responsibilities: presents certificate numbers, issuing authorities, ocr confidence scores, multi-column sorting, and action controls.
  role in system: main data table for DocumentLibraryView.tsx.
*/

import React, { useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Eye } from 'lucide-react';
import { useMapStore } from '../../store/useMapStore';
import { MasterDocument, ComplianceState } from '../../types/document';
import { FilterModal } from '../common/FilterModal';
import { CountTabs } from '../common/CountTabs';
import { ListToolbar } from '../common/ListToolbar';
import { DueCell } from '../common/DueCell';
import { ActiveFilterChips, FilterChip } from '../common/ActiveFilterChips';
import { formatMaritimeDate, getStatusDisplayLabel } from '../../utils/formatters';
import { exportToCsv, exportToPdf } from '../../utils/exportHelpers';
import { canPerform } from '../../utils/permissionHelpers';
import { usePagination } from '../../utils/usePagination';
import { TablePagination } from '../common/TablePagination';

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
  statusFilter?: string;
  onStatusFilterChange?: (value: string) => void;
  documents?: MasterDocument[];
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
  statusFilter: statusFilterProp,
  onStatusFilterChange,
  documents: documentsProp,
}) => {
  const {
    documents: storeDocuments,
    activePersona,
    rolePermissionDefaults,
    userPermissionOverrides,
    customScopes,
    users,
  } = useMapStore();
  const documents = documentsProp ?? storeDocuments;
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [internalStatusFilter, setInternalStatusFilter] = useState('ALL');
  const statusFilter = statusFilterProp ?? internalStatusFilter;
  const setStatusFilter = onStatusFilterChange ?? setInternalStatusFilter;
  const [verificationFilter, setVerificationFilter] = useState('ALL');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [sortField, setSortField] = useState<SortField>('title');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

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
  };

  const docsPagination = usePagination(sortedDocs, [searchTerm, typeFilter, statusFilter, verificationFilter, sortField, sortDirection]);

  const documentTabs = [
    { key: 'ALL', label: 'All', count: documents.length },
    {
      key: 'Expiring < 6 Mos',
      label: 'Expiring Soon',
      count: documents.filter((d) => d.complianceState === 'Expiring < 6 Mos').length,
      tone: 'warn' as const,
    },
    {
      key: 'Expired',
      label: 'Expired',
      count: documents.filter((d) => d.complianceState === 'Expired').length,
    },
  ];
  const activeDocumentTab = documentTabs.some((tab) => tab.key === statusFilter) ? statusFilter : '';

  return (
    <div className="card map-card-custom">
      <div className="p-3 border-bottom">
        <CountTabs
          tabs={documentTabs}
          active={activeDocumentTab}
          onChange={setStatusFilter}
          aria-label="Document tabs"
        />
      </div>
      <ListToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search documents..."
        onFilterClick={() => setIsFilterModalOpen(true)}
        activeFilterCount={activeFilterCount}
        onExportCsv={handleExportCsv}
        onExportPdf={handleExportPdf}
        primaryAction={
          canUpload && onUploadDocument ? (
            <button type="button" className="btn btn-sm btn-primary" onClick={onUploadDocument}>
              Upload Document
            </button>
          ) : undefined
        }
      />

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
            {docsPagination.pageItems.map((doc) => (
              <tr
                key={doc.id}
                onClick={() => onSelectDocument(doc)}
                style={{ cursor: 'pointer' }}
              >
                <td className="font-mono-code fw-semibold text-primary text-nowrap">{doc.certificateNo}</td>
                <td>
                  <div className="fw-semibold text-dark text-nowrap">{doc.title}</div>
                  <div className="text-secondary small">{doc.entityType}</div>
                </td>
                <td className="font-mono-code small text-nowrap due-cell">
                  <DueCell date={doc.expiryDate} isExpiry />
                </td>
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
      <TablePagination {...docsPagination.controls} />

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

