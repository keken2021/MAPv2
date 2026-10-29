import React, { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Eye } from 'lucide-react';
import { useMapStore } from '../store/useMapStore';
import { DocumentReviewDrawer } from '../components/drawers/DocumentReviewDrawer';
import { MasterDocument } from '../types/document';
import { formatMaritimeDate, getStatusDisplayLabel } from '../utils/formatters';
import { FilterModal } from '../components/common/FilterModal';
import { ActiveFilterChips, FilterChip } from '../components/common/ActiveFilterChips';
import { CountTabs, CountTab } from '../components/common/CountTabs';
import { StatusBadge } from '../components/common/StatusBadge';
import { ListToolbar } from '../components/common/ListToolbar';
import { filterDocumentsForVerifierQueue, filterDocumentsVisibleToOrganization } from '../utils/rbacHelpers';
import { exportToCsv, exportToPdf } from '../utils/exportHelpers';
import { usePagination } from '../utils/usePagination';
import { TablePagination } from '../components/common/TablePagination';
import { isComplianceDeadlineOverdue, toIsoLocalDate } from '../utils/validation';

export type VerifierTabKey = 'to-verify' | 'overdue' | 'verified' | 'returned' | 'all';

type SortField =
  | 'assuranceSet'
  | 'title'
  | 'vesselName'
  | 'expiryDate'
  | 'due'
  | 'verificationStatus';

export const VerifierWorkspaceView: React.FC = () => {
  const { documents, assuranceSets, activePersona, activeDemoOrganization } = useMapStore();
  const [selectedDoc, setSelectedDoc] = useState<MasterDocument | null>(null);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<VerifierTabKey>('to-verify');
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

  const scopedDocs = filterDocumentsVisibleToOrganization(
    filterDocumentsForVerifierQueue(documents, assuranceSets, activePersona, activeDemoOrganization),
    assuranceSets,
    activeDemoOrganization,
  );

  const getAssuranceSetInfo = (docId: string) => {
    for (const set of assuranceSets) {
      const requirement = set.requirements?.find((r) => r.documentId === docId || r.linkedDocumentId === docId);
      if (requirement) {
        return {
          setId: set.id,
          requirementId: requirement.id,
          requirementVerifierStatus: requirement.verifierStatus,
          setTitle: set.title,
          vesselName: set.vesselName,
          stage: set.stage,
        };
      }
    }
    return null;
  };

  const selectedDocSetInfo = selectedDoc ? getAssuranceSetInfo(selectedDoc.id) : null;

  const isToVerify = (d: MasterDocument) => {
    return d.verificationStatus === 'Pending';
  };

  const isDocOverdue = (d: MasterDocument) => {
    if (d.verificationStatus === 'Verified') return false;
    const info = getAssuranceSetInfo(d.id);
    const linkedSet = info ? assuranceSets.find((s) => s.id === info.setId) : undefined;
    if (!linkedSet) return false;
    if (linkedSet.stage === 'Approved' || linkedSet.stage === 'Certified' || linkedSet.stage === 'Cancelled') return false;
    if (isComplianceDeadlineOverdue(linkedSet)) return true;
    const req = linkedSet.requirements?.find((r) => r.documentId === d.id || r.linkedDocumentId === d.id);
    const deadline = req?.targetDate || linkedSet.revisedCompletionDate || linkedSet.complianceDeadline || linkedSet.targetDate;
    if (!deadline) return false;
    return deadline < toIsoLocalDate();
  };

  const isVerified = (d: MasterDocument) => {
    return d.verificationStatus === 'Verified';
  };

  const isReturned = (d: MasterDocument) => {
    return (
      d.verificationStatus === 'Correction Requested' ||
      d.verificationStatus === 'Rejected'
    );
  };

  const toVerifyCount = useMemo(() => scopedDocs.filter(isToVerify).length, [scopedDocs]);
  const overdueCount = useMemo(() => scopedDocs.filter(isDocOverdue).length, [scopedDocs, assuranceSets]);
  const verifiedCount = useMemo(() => scopedDocs.filter(isVerified).length, [scopedDocs]);
  const returnedCount = useMemo(() => scopedDocs.filter(isReturned).length, [scopedDocs]);
  const allCount = scopedDocs.length;

  const tabs: CountTab[] = useMemo(
    () => [
      { key: 'to-verify', label: 'To Verify', count: toVerifyCount },
      { key: 'overdue', label: 'Overdue', count: overdueCount, tone: 'warn' },
      { key: 'verified', label: 'Verified', count: verifiedCount },
      { key: 'returned', label: 'Returned', count: returnedCount },
      { key: 'all', label: 'All', count: allCount },
    ],
    [toVerifyCount, overdueCount, verifiedCount, returnedCount, allCount],
  );

  const filteredDocs = scopedDocs.filter((d) => {
    if (activeTab === 'to-verify' && !isToVerify(d)) return false;
    if (activeTab === 'overdue' && !isDocOverdue(d)) return false;
    if (activeTab === 'verified' && !isVerified(d)) return false;
    if (activeTab === 'returned' && !isReturned(d)) return false;

    const setInfo = getAssuranceSetInfo(d.id);
    const setContext = setInfo ? `${setInfo.setId} ${setInfo.setTitle} ${setInfo.vesselName}` : '';
    const searchTarget = `${d.title} ${d.certificateNo} ${d.issuingAuthority} ${d.entityType} ${setContext}`.toLowerCase();

    const matchesSearch = !searchTerm || searchTarget.includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'ALL' || d.entityType === typeFilter;
    const matchesStatus = statusFilter === 'ALL' || d.verificationStatus === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const sortedDocs = [...filteredDocs].sort((a, b) => {
    let valA: string = '';
    let valB: string = '';

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
    } else if (sortField === 'due') {
      const getDueDeadline = (doc: MasterDocument) => {
        const info = getAssuranceSetInfo(doc.id);
        const linkedSet = info ? assuranceSets.find((s) => s.id === info.setId) : undefined;
        const req = linkedSet?.requirements?.find((r) => r.documentId === doc.id || r.linkedDocumentId === doc.id);
        return req?.targetDate || linkedSet?.revisedCompletionDate || linkedSet?.complianceDeadline || linkedSet?.targetDate || '';
      };
      valA = getDueDeadline(a);
      valB = getDueDeadline(b);
    } else {
      valA = (a[sortField as keyof MasterDocument] ?? '') as string;
      valB = (b[sortField as keyof MasterDocument] ?? '') as string;
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
      const linkedSet = info ? assuranceSets.find((s) => s.id === info.setId) : undefined;
      const req = linkedSet?.requirements?.find((r) => r.documentId === d.id || r.linkedDocumentId === d.id);
      const effectiveDeadline = req?.targetDate || linkedSet?.revisedCompletionDate || linkedSet?.complianceDeadline || linkedSet?.targetDate || '';
      return {
        SetID: info ? info.setId : 'N/A',
        Title: d.title,
        Vessel: info ? info.vesselName : 'N/A',
        ExpiryDate: d.expiryDate,
        Due: effectiveDeadline,
        Status: getStatusDisplayLabel(d.verificationStatus),
      };
    });
    exportToCsv('Verification_Queue', exportData);
  };

  const handleExportPdf = () => {
    const headers = ['Set ID', 'Title', 'Vessel', 'Expiry Date', 'Due', 'Status'];
    const rows = sortedDocs.map((d) => {
      const info = getAssuranceSetInfo(d.id);
      const linkedSet = info ? assuranceSets.find((s) => s.id === info.setId) : undefined;
      const req = linkedSet?.requirements?.find((r) => r.documentId === d.id || r.linkedDocumentId === d.id);
      const effectiveDeadline = req?.targetDate || linkedSet?.revisedCompletionDate || linkedSet?.complianceDeadline || linkedSet?.targetDate || '—';
      return [
        info ? info.setId : 'N/A',
        d.title,
        info ? info.vesselName : 'N/A',
        d.expiryDate,
        effectiveDeadline,
        getStatusDisplayLabel(d.verificationStatus),
      ];
    });
    exportToPdf('Verification Queue', headers, rows);
  };

  const docsPagination = usePagination(sortedDocs, [activeTab, searchTerm, typeFilter, statusFilter, sortField, sortOrder]);

  return (
    <div className="d-flex flex-column gap-4">
      <div className="card map-card-custom">
        <div className="p-3 border-bottom">
          <CountTabs
            tabs={tabs}
            active={activeTab}
            onChange={(key) => setActiveTab(key as VerifierTabKey)}
            aria-label="Verifier queue tabs"
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
        />

        {activeChips.length > 0 && (
          <div className="px-3 py-2 bg-white border-bottom">
            <ActiveFilterChips chips={activeChips} onClearAll={handleResetFilters} />
          </div>
        )}

        <div className="table-responsive">
          <table className="table map-table-custom align-middle mb-0">
            <thead>
              <tr>
                {renderSortHeader('Set ID', 'assuranceSet')}
                {renderSortHeader('Title', 'title')}
                {renderSortHeader('Vessel', 'vesselName')}
                {renderSortHeader('Expiry Date', 'expiryDate')}
                {renderSortHeader('Due', 'due')}
                {renderSortHeader('Verification', 'verificationStatus')}
                <th className="text-end" style={{ whiteSpace: 'nowrap' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {docsPagination.pageItems.map((doc) => {
                const info = getAssuranceSetInfo(doc.id);
                const linkedSet = info ? assuranceSets.find((s) => s.id === info.setId) : undefined;
                const req = linkedSet?.requirements?.find((r) => r.documentId === doc.id || r.linkedDocumentId === doc.id);
                const effectiveDeadline = req?.targetDate || linkedSet?.revisedCompletionDate || linkedSet?.complianceDeadline || linkedSet?.targetDate;
                const overdue = isDocOverdue(doc);
                let daysLate = 0;
                if (overdue && effectiveDeadline) {
                  const deadlineMs = new Date(effectiveDeadline).getTime();
                  const nowMs = new Date(toIsoLocalDate()).getTime();
                  const diff = Math.round((nowMs - deadlineMs) / (1000 * 60 * 60 * 24));
                  daysLate = Math.max(1, diff);
                }

                return (
                  <tr key={doc.id} onClick={() => setSelectedDoc(doc)} style={{ cursor: 'pointer' }}>
                    <td>
                      <span className="font-mono-code text-primary fw-semibold small">
                        {info ? info.setId : doc.certificateNo}
                      </span>
                    </td>
                    <td>
                      <span className="fw-semibold text-dark">{doc.title}</span>
                    </td>
                    <td>
                      <span className="font-mono-code text-secondary small">
                        {info?.vesselName || 'Unlinked'}
                      </span>
                    </td>
                    <td className="font-mono-code small">{formatMaritimeDate(doc.expiryDate)}</td>
                    <td className="font-mono-code small due-cell">
                      {overdue ? (
                        <span className="text-danger fw-semibold">
                          {daysLate} {daysLate === 1 ? 'day' : 'days'} late
                        </span>
                      ) : effectiveDeadline ? (
                        <span className="text-secondary">
                          {formatMaritimeDate(effectiveDeadline)}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td>
                      <StatusBadge
                        value={
                          doc.verificationStatus === 'Verified' &&
                          (linkedSet?.stage === 'Approved' || linkedSet?.approverDecision === 'Approved')
                            ? 'Approved'
                            : doc.verificationStatus === 'Pending'
                            ? 'Submitted'
                            : (doc.verificationStatus || 'Pending')
                        }
                      />
                    </td>
                    <td className="text-end" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center p-0"
                        style={{ width: '32px', height: '32px' }}
                        onClick={() => setSelectedDoc(doc)}
                        title="View"
                        aria-label="View"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {sortedDocs.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-muted py-4 fst-italic">
                    No documents found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <TablePagination {...docsPagination.controls} />
      </div>

      <DocumentReviewDrawer
        document={selectedDoc}
        onClose={() => setSelectedDoc(null)}
        assuranceSetId={selectedDocSetInfo?.setId}
        requirementId={selectedDocSetInfo?.requirementId}
        requirementVerifierStatus={selectedDocSetInfo?.requirementVerifierStatus}
      />

      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        onReset={handleResetFilters}
        title="Filters"
        activeCount={activeFilterCount}
      >
        <div className="d-flex flex-column gap-3">
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
