/* 
  file summary: single unified verifier workspace table view displaying all statutory evidence (pending & verified) with assurance set context, sortable headers, and filter controls in light theme.
  responsibilities: combines assurance set details and verification queue into a single sortable, filterable master table and launches DocumentReviewDrawer split-screen viewer.
  role in system: primary operational workspace for Verifiers (/verifier).
*/

import React, { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Search, FileCheck } from 'lucide-react';
import { useMapStore } from '../store/useMapStore';
import { DocumentReviewDrawer } from '../components/drawers/DocumentReviewDrawer';
import { MasterDocument } from '../types/document';
import { ConfidenceBadge } from '../components/common/ConfidenceBadge';
import { formatMaritimeDate, getStatusDisplayLabel } from '../utils/formatters';
import { FilterModal } from '../components/common/FilterModal';
import { FilterButton } from '../components/common/FilterButton';
import { ActiveFilterChips, FilterChip } from '../components/common/ActiveFilterChips';

import { filterDocumentsForVerifierQueue } from '../utils/rbacHelpers';
import { exportToCsv, exportToPdf } from '../utils/exportHelpers';
import { usePagination } from '../utils/usePagination';
import { TablePagination } from '../components/common/TablePagination';

type SortField =
  | 'assuranceSet'
  | 'vesselName'
  | 'title'
  | 'entityType'
  | 'certificateNo'
  | 'issuingAuthority'
  | 'expiryDate'
  | 'ocrConfidence'
  | 'verificationStatus';

/**
  what: renders single master verification table for verifiers in light theme with search, filters, sorting, and export capabilities.
  how: aggregates scoped documents (pending and verified) with assurance set context into one unified sortable table.
  with what file: src/views/VerifierWorkspaceView.tsx loaded by App.tsx.
*/
export const VerifierWorkspaceView: React.FC = () => {
  const { documents, assuranceSets, activePersona } = useMapStore();
  const [selectedDoc, setSelectedDoc] = useState<MasterDocument | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  /* Search, Filter & Sort State for Single Master Table */
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortField, setSortField] = useState<SortField>('title');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const handleResetFilters = () => {
    setTypeFilter('ALL');
    setStatusFilter('ALL');
    setSearchTerm('');
  };

  const activeChips = useMemo<FilterChip[]>(() => {
    const chips: FilterChip[] = [];
    if (typeFilter !== 'ALL') {
      chips.push({
        id: 'type',
        label: 'Type',
        value: typeFilter,
        onRemove: () => setTypeFilter('ALL'),
      });
    }
    if (statusFilter !== 'ALL') {
      chips.push({
        id: 'status',
        label: 'Verification',
        value: statusFilter === 'Pending' ? 'Submitted' : getStatusDisplayLabel(statusFilter),
        onRemove: () => setStatusFilter('ALL'),
      });
    }
    return chips;
  }, [typeFilter, statusFilter]);

  const activeFilterCount = activeChips.length;

  /* All documents in Verifier's queue (Pending, Correction Requested, Verified) */
  const scopedDocs = filterDocumentsForVerifierQueue(documents, assuranceSets, activePersona);

  /* Map each document to its associated Assurance Set & Vessel */
  const getAssuranceSetInfo = (docId: string) => {
    for (const set of assuranceSets) {
      const hasDoc = set.requirements?.some((r) => r.documentId === docId || r.linkedDocumentId === docId);
      if (hasDoc) {
        return {
          setId: set.id,
          setTitle: set.title,
          vesselName: set.vesselName,
          stage: set.stage,
        };
      }
    }
    return null;
  };

  /* Filter Logic */
  const filteredDocs = scopedDocs.filter((d) => {
    const setInfo = getAssuranceSetInfo(d.id);
    const setContext = setInfo ? `${setInfo.setId} ${setInfo.setTitle} ${setInfo.vesselName}` : '';
    const searchTarget = `${d.title} ${d.certificateNo} ${d.issuingAuthority} ${d.entityType} ${setContext}`.toLowerCase();

    const matchesSearch = searchTarget.includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'ALL' || d.entityType === typeFilter;
    const matchesStatus = statusFilter === 'ALL' || d.verificationStatus === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  /* Sort Logic */
  const sortedDocs = [...filteredDocs].sort((a, b) => {
    let valA: any = '';
    let valB: any = '';

    if (sortField === 'assuranceSet') {
      const infoA = getAssuranceSetInfo(a.id);
      const infoB = getAssuranceSetInfo(b.id);
      valA = infoA ? infoA.setId : '';
      valB = infoB ? infoB.setId : '';
    } else if (sortField === 'vesselName') {
      const infoA = getAssuranceSetInfo(a.id);
      const infoB = getAssuranceSetInfo(b.id);
      valA = infoA ? infoA.vesselName : '';
      valB = infoB ? infoB.vesselName : '';
    } else if (sortField === 'ocrConfidence') {
      valA = Number(a.ocrConfidence) || 0;
      valB = Number(b.ocrConfidence) || 0;
    } else {
      valA = a[sortField as keyof MasterDocument] ?? '';
      valB = b[sortField as keyof MasterDocument] ?? '';
    }

    if (typeof valA === 'string') {
      valA = valA.toLowerCase();
      valB = (valB as string).toLowerCase();
    }

    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const renderSortHeader = (label: string, field: SortField) => (
    <th
      style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
      onClick={() => handleSort(field)}
    >
      {label}{' '}
      {sortField !== field ? (
        <ArrowUpDown size={14} className="text-muted ms-1 opacity-50 inline-block align-middle" />
      ) : sortOrder === 'asc' ? (
        <ArrowUp size={14} className="text-primary ms-1 inline-block align-middle" />
      ) : (
        <ArrowDown size={14} className="text-primary ms-1 inline-block align-middle" />
      )}
    </th>
  );

  const handleExportCsv = () => {
    const exportData = sortedDocs.map((d) => {
      const info = getAssuranceSetInfo(d.id);
      return {
        SetID: info ? info.setId : 'N/A',
        Vessel: info ? info.vesselName : 'N/A',
        Title: d.title,
        IssuingAuthority: d.issuingAuthority,
        ExpiryDate: d.expiryDate,
        OcrConfidence: `${d.ocrConfidence}%`,
        Status: getStatusDisplayLabel(d.verificationStatus),
      };
    });
    exportToCsv('Verification_Queue', exportData);
    setIsExportOpen(false);
  };

  const handleExportPdf = () => {
    const headers = ['Set ID', 'Vessel', 'Title', 'Issuing Authority', 'Expiry Date', 'OCR Confidence', 'Status'];
    const rows = sortedDocs.map((d) => {
      const info = getAssuranceSetInfo(d.id);
      return [
        info ? info.setId : 'N/A',
        info ? info.vesselName : 'N/A',
        d.title,
        d.issuingAuthority,
        d.expiryDate,
        `${d.ocrConfidence}%`,
        getStatusDisplayLabel(d.verificationStatus),
      ];
    });
    exportToPdf('Verification Queue', headers, rows);
    setIsExportOpen(false);
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Verified':
        return 'bg-success text-white';
      case 'Correction Requested':
        return 'bg-warning text-dark';
      case 'Rejected':
        return 'bg-danger text-white';
      case 'Pending':
      default:
        return 'bg-info text-dark';
    }
  };

  const docsPagination = usePagination(sortedDocs, [searchTerm, typeFilter, statusFilter, sortField, sortOrder]);

  return (
    <div className="d-flex flex-column gap-4">
      {/* Single Master Verification Table */}
      <div className="card map-card-custom">
        {/* Table Header Controls: Search & Filters Left, Export Button Right */}
        <div className="card-header d-flex flex-column gap-2.5 p-3">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
            <div className="d-flex flex-wrap align-items-center gap-2.5 flex-grow-1">
              <div className="position-relative" style={{ minWidth: '240px', maxWidth: '320px' }}>
                <input
                  type="text"
                  className="form-control form-control-sm bg-white text-dark ps-4 font-sans"
                  style={{ borderColor: '#E2E8F0', fontSize: '0.82rem', height: '34px' }}
                  placeholder="Search documents..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Search size={14} className="position-absolute top-50 start-0 translate-middle-y ms-2.5 text-muted" />
              </div>

              <FilterButton
                onClick={() => setIsFilterModalOpen(true)}
                activeCount={activeFilterCount}
              />
            </div>

            <div className="dropdown position-relative ms-auto">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary text-dark dropdown-toggle"
                style={{ fontSize: '0.82rem', height: '34px', borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' }}
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

          {activeChips.length > 0 && (
            <ActiveFilterChips chips={activeChips} onClearAll={handleResetFilters} />
          )}
        </div>

        <div className="table-responsive">
          <table className="table map-table-custom align-middle mb-0">
            <thead>
              <tr>
                {renderSortHeader('Set ID', 'assuranceSet')}
                {renderSortHeader('Title', 'title')}
                {renderSortHeader('Vessel', 'issuingAuthority')}
                {renderSortHeader('Expiry Date', 'expiryDate')}
                {renderSortHeader('Verification', 'verificationStatus')}
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {docsPagination.pageItems.map((doc) => {
                const info = getAssuranceSetInfo(doc.id);
                const linkedSet = info ? assuranceSets.find((s) => s.id === info.setId) : undefined;
                const isSetApproved = linkedSet?.stage === 'Approved' || linkedSet?.approverDecision === 'Approved';

                return (
                  <tr key={doc.id} onClick={() => setSelectedDoc(doc)} style={{ cursor: 'pointer' }}>
                    <td>
                      {info ? (
                        <span className="badge bg-light text-primary border font-mono-code fw-bold" style={{ fontSize: '0.725rem' }}>
                          {info.setId}
                        </span>
                      ) : (
                        <span className="font-mono-code text-primary fw-semibold small">{doc.certificateNo}</span>
                      )}
                    </td>
                    <td>
                      <div className="fw-semibold text-dark">{doc.title}</div>
                      <div className="small font-mono-code text-secondary">
                        {doc.certificateNo} &middot; {doc.entityType}
                      </div>
                    </td>
                    <td>
                      <div className="fw-semibold text-dark font-mono-code small">{info?.vesselName || 'Unlinked'}</div>
                      <div className="text-muted small">{doc.issuingAuthority}</div>
                    </td>
                    <td className="font-mono-code small">{formatMaritimeDate(doc.expiryDate)}</td>
                    <td>
                      {(() => {
                        if (doc.verificationStatus === 'Verified') {
                          if (isSetApproved) {
                            return <span className="badge bg-success text-white">Approved</span>;
                          }
                          return <span className="badge bg-info text-dark">Verified</span>;
                        }
                        if (doc.verificationStatus === 'Correction Requested') {
                          return <span className="badge bg-warning text-dark">Returned for Correction</span>;
                        }
                        if (doc.verificationStatus === 'Rejected') {
                          return <span className="badge bg-danger text-white">Rejected</span>;
                        }
                        return <span className="badge bg-primary text-white">Submitted</span>;
                      })()}
                    </td>
                    <td className="text-end">
                      <button
                        type="button"
                        className="btn btn-sm btn-primary d-inline-flex align-items-center justify-content-center p-0 text-white"
                        style={{ width: '32px', height: '32px' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDoc(doc);
                        }}
                        title="Review"
                        aria-label="Review"
                      >
                        <FileCheck size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {sortedDocs.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-4 fst-italic">
                    No documents found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <TablePagination {...docsPagination.controls} />
      </div>

      {/* Split-Screen Review Drawer */}
      <DocumentReviewDrawer document={selectedDoc} onClose={() => setSelectedDoc(null)} />

      {/* Dedicated Filter Modal */}
      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        onReset={handleResetFilters}
        title="Filters"
        activeCount={activeFilterCount}
      >
        <div className="d-flex flex-column gap-3">
          {/* Entity Type Filter */}
          <div>
            <label className="form-label text-secondary fw-semibold small mb-1" style={{ fontSize: '0.8rem' }}>
              Type
            </label>
            <select
              className="form-select form-select-sm bg-white text-dark font-sans"
              style={{ borderColor: '#E2E8F0', fontSize: '0.84rem' }}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="ALL">All Types</option>
              <option value="Vessel Certificate">Vessel Certificate</option>
              <option value="Crew Certificate">Crew Certificate</option>
            </select>
          </div>

          {/* Verification Status Filter */}
          <div>
            <label className="form-label text-secondary fw-semibold small mb-1" style={{ fontSize: '0.8rem' }}>
              Verification
            </label>
            <select
              className="form-select form-select-sm bg-white text-dark font-sans"
              style={{ borderColor: '#E2E8F0', fontSize: '0.84rem' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="Pending">Submitted</option>
              <option value="Correction Requested">Returned for Correction</option>
              <option value="Rejected">Rejected</option>
              <option value="Verified">Verified</option>
            </select>
          </div>
        </div>
      </FilterModal>
    </div>
  );
};
