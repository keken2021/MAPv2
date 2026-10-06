/* 
  file summary: assurance sets data table component with grouped search box/filters on left, interactive column sorting, and grouped export/initiate buttons on right.
  responsibilities: presents set ids, target vessels, stage badges, readiness gauges, multi-column sorting by header clicks, and action controls.
  role in system: main data table for AssuranceSetsView.tsx.
*/

import React, { useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useMapStore } from '../../store/useMapStore';
import { AssuranceSet, AssuranceStage } from '../../types/assurance';
import { ReadinessGauge } from '../common/ReadinessGauge';
import { formatMaritimeDate } from '../../utils/formatters';
import { exportToCsv, exportToPdf } from '../../utils/exportHelpers';

import { isAssuranceSetAssignedToPersona } from '../../utils/rbacHelpers';
import { canPerform } from '../../utils/permissionHelpers';
import { calculateAssuranceSetReadiness } from '../../utils/readinessHelpers';

type AssuranceSortField =
  | 'id'
  | 'title'
  | 'vesselName'
  | 'initiatorOrg'
  | 'stage'
  | 'readinessScore';

export type AssuranceViewTab = 'public' | 'organization' | 'drafts';

interface AssuranceTableProps {
  onSelectSet: (set: AssuranceSet) => void;
  onInitiateSet?: () => void;
  defaultTab?: AssuranceViewTab;
}

/**
  what: renders assurance projects data table with universal tabs (Public, Organization, Drafts), search filters, column sorting, and export/initiate actions.
  how: filters assuranceSets array by active persona role assignment, tab view mode, and search parameters, then sorts by sortField.
  with what file: src/components/tables/AssuranceTable.tsx loaded by AssuranceSetsView.tsx.
*/
export const AssuranceTable: React.FC<AssuranceTableProps> = ({ onSelectSet, onInitiateSet, defaultTab = 'organization' }) => {
  const {
    assuranceSets,
    activePersona,
    setCurrentHashView,
    rolePermissionDefaults,
    userPermissionOverrides,
    customScopes,
    users,
  } = useMapStore();
  const [activeTab, setActiveTab] = useState<AssuranceViewTab>(defaultTab);
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('ALL');
  const [sortField, setSortField] = useState<AssuranceSortField>('id');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isExportOpen, setIsExportOpen] = useState(false);

  const matchingUser = users.find((u) => u.roles.includes(activePersona)) ?? null;
  const canInitiate =
    activePersona === 'Administrator' ||
    canPerform(
      rolePermissionDefaults,
      userPermissionOverrides,
      matchingUser,
      activePersona,
      'assurance_sets',
      'create',
      customScopes,
    );

  const accessibleSets = assuranceSets.filter((s) => isAssuranceSetAssignedToPersona(s, activePersona));

  const isPublicSet = (s: AssuranceSet) =>
    s.visibility === 'public' || s.templateSource === 'public' || s.stage === 'Approved' || s.stage === 'Certified';

  const isDraftSet = (s: AssuranceSet) =>
    s.visibility === 'draft' || s.stage === 'Initiated';

  const isOrgSet = (s: AssuranceSet) =>
    s.visibility === 'organization' || (!isDraftSet(s) && !isPublicSet(s)) || (s.stage !== 'Initiated' && s.visibility !== 'public');

  const publicCount = accessibleSets.filter(isPublicSet).length;
  const orgCount = accessibleSets.filter(isOrgSet).length;
  const draftsCount = accessibleSets.filter(isDraftSet).length;

  const filteredSets = accessibleSets.filter((s) => {
    let matchesTab = true;
    if (activeTab === 'public') {
      matchesTab = isPublicSet(s);
    } else if (activeTab === 'organization') {
      matchesTab = isOrgSet(s);
    } else if (activeTab === 'drafts') {
      matchesTab = isDraftSet(s);
    }

    const matchesSearch =
      s.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.vesselName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStage = stageFilter === 'ALL' || s.stage === stageFilter;
    return matchesTab && matchesSearch && matchesStage;
  });

  const handleSort = (field: AssuranceSortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const renderSortIndicator = (field: AssuranceSortField) => {
    if (sortField !== field) {
      return <ArrowUpDown size={14} className="text-muted ms-1 opacity-50 inline-block align-middle" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp size={14} className="text-primary ms-1 inline-block align-middle" />
    ) : (
      <ArrowDown size={14} className="text-primary ms-1 inline-block align-middle" />
    );
  };

  const sortedSets = [...filteredSets].sort((a, b) => {
    let valA: any = a[sortField] ?? '';
    let valB: any = b[sortField] ?? '';

    if (sortField === 'readinessScore') {
      valA = calculateAssuranceSetReadiness(a);
      valB = calculateAssuranceSetReadiness(b);
    } else if (typeof valA === 'string') {
      valA = valA.toLowerCase();
      valB = (valB as string).toLowerCase();
    }

    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const getStageBadgeClass = (stage: AssuranceStage) => {
    switch (stage) {
      case 'Approved':
      case 'Certified': return 'bg-success text-white';
      case 'Approval': return 'bg-info text-dark';
      case 'Inspection': return 'bg-primary text-white';
      case 'Verification': return 'bg-warning text-dark';
      case 'Validation': return 'bg-secondary text-white';
      default: return 'bg-light text-dark border';
    }
  };

  const handleExportCsv = () => {
    const exportData = sortedSets.map((s) => ({
      SetID: s.id,
      CampaignTitle: s.title,
      VesselName: s.vesselName,
      ImoNumber: s.imoNumber,
      InitiatorOrg: s.initiatorOrg,
      Stage: s.stage,
      ReadinessScore: `${calculateAssuranceSetReadiness(s)}%`,
      CharterStart: s.charterWindowStart,
      CharterEnd: s.charterWindowEnd,
    }));
    exportToCsv('Assurance_Sets_Campaigns', exportData);
    setIsExportOpen(false);
  };

  const handleExportPdf = () => {
    const headers = ['Set ID', 'Campaign Title', 'Vessel Name', 'Initiator Org', 'Stage', 'Readiness'];
    const rows = sortedSets.map((s) => [
      s.id,
      s.title,
      s.vesselName,
      s.initiatorOrg,
      s.stage,
      `${calculateAssuranceSetReadiness(s)}%`,
    ]);
    exportToPdf('Assurance Sets & Vetting Campaigns', headers, rows);
    setIsExportOpen(false);
  };

  return (
    <div className="d-flex flex-column gap-3">
      {/* Universal Design Tabs: Public, Organization, and Drafts (Placed above card, matching Vessels layout) */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
        <div className="nav nav-pills bg-light p-1 rounded-3 border">
          <button
            type="button"
            className={`nav-link btn-sm font-mono-code px-3 py-1.5 ${
              activeTab === 'public' ? 'active bg-primary text-white fw-semibold' : 'text-secondary'
            }`}
            style={{ fontSize: '0.8rem' }}
            onClick={() => setActiveTab('public')}
          >
            Public ({publicCount})
          </button>
          <button
            type="button"
            className={`nav-link btn-sm font-mono-code px-3 py-1.5 ${
              activeTab === 'organization' ? 'active bg-primary text-white fw-semibold' : 'text-secondary'
            }`}
            style={{ fontSize: '0.8rem' }}
            onClick={() => setActiveTab('organization')}
          >
            Organization ({orgCount})
          </button>
          <button
            type="button"
            className={`nav-link btn-sm font-mono-code px-3 py-1.5 ${
              activeTab === 'drafts' ? 'active bg-primary text-white fw-semibold' : 'text-secondary'
            }`}
            style={{ fontSize: '0.8rem' }}
            onClick={() => setActiveTab('drafts')}
          >
            Drafts ({draftsCount})
          </button>
        </div>
      </div>

      <div className="card map-card-custom">
        {/* Table Header Controls Row: Search/Filter on Left, Export & Initiate on Right */}
        <div className="card-header d-flex flex-wrap align-items-center justify-content-between gap-3 p-3">
          <div className="d-flex flex-wrap align-items-center gap-2 flex-grow-1">
            <input
              type="text"
              className="form-control form-control-sm bg-white text-dark border-secondary"
              placeholder="Search Set ID, Title, Vessel..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '260px' }}
            />
            <select
              className="form-select form-select-sm bg-white text-dark border-secondary"
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              style={{ width: '150px' }}
            >
              <option value="ALL">All Stages</option>
              <option value="Initiated">Initiated</option>
              <option value="Validation">Validation</option>
              <option value="Verification">Verification</option>
              <option value="Inspection">Inspection</option>
              <option value="Approval">Approval</option>
              <option value="Certified">Certified</option>
            </select>
          </div>

          {/* Right Side: Export & Initiate Buttons */}
          <div className="d-flex align-items-center gap-2 ms-auto">
            {/* Export Dropdown */}
            <div className="dropdown position-relative">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary text-dark dropdown-toggle"
                onClick={() => setIsExportOpen(!isExportOpen)}
              >
                Export Data
              </button>
              {isExportOpen && (
                <ul className="dropdown-menu dropdown-menu-light show position-absolute end-0 mt-1 shadow border">
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

            {/* Initiate Action Button */}
            {canInitiate && onInitiateSet && (
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={onInitiateSet}
              >
                Create Assurance Set
              </button>
            )}
          </div>
        </div>

      <div className="table-responsive">
        <table className="table map-table-custom align-middle mb-0">
          <thead>
            <tr>
              <th onClick={() => handleSort('id')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                Set ID {renderSortIndicator('id')}
              </th>
              <th onClick={() => handleSort('title')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                Campaign / Set Title {renderSortIndicator('title')}
              </th>
              <th onClick={() => handleSort('vesselName')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                Vessel Name {renderSortIndicator('vesselName')}
              </th>
              <th onClick={() => handleSort('initiatorOrg')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                Initiating Organization {renderSortIndicator('initiatorOrg')}
              </th>
              <th onClick={() => handleSort('stage')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                Stage {renderSortIndicator('stage')}
              </th>
              <th onClick={() => handleSort('readinessScore')} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                Readiness Score {renderSortIndicator('readinessScore')}
              </th>
              <th className="text-end" style={{ whiteSpace: 'nowrap' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedSets.map((s) => {
              const isDraft = isDraftSet(s);
              return (
                <tr
                  key={s.id}
                  onClick={() => {
                    if (isDraft) {
                      setCurrentHashView('create-assurance-set', s.id);
                    } else {
                      onSelectSet(s);
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <td className="font-mono-code fw-bold text-primary">{s.id}</td>
                  <td className="fw-semibold">
                    <div className="d-flex align-items-center gap-2">
                      <span>{s.title}</span>
                      {isDraft && (
                        <span className="badge bg-warning-subtle text-dark border border-warning-subtle font-mono-code" style={{ fontSize: '0.65rem' }}>
                          Draft
                        </span>
                      )}
                    </div>
                  </td>
                  <td>{s.vesselName}</td>
                  <td>
                    <span className="badge bg-light text-dark border" style={{ fontSize: '0.75rem' }}>
                      {s.initiatorOrg}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${getStageBadgeClass(s.stage)}`}>{s.stage}</span>
                  </td>
                  <td>
                    <ReadinessGauge score={calculateAssuranceSetReadiness(s)} size="sm" />
                  </td>
                  <td className="text-end">
                    <div className="d-flex align-items-center justify-content-end gap-1">
                      {!isDraft && canInitiate && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          title="Use this Assurance Set as template to auto-fill new campaign"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCurrentHashView('create-assurance-set', s.id);
                          }}
                        >
                          Use as Template
                        </button>
                      )}
                      {isDraft ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-primary fw-semibold"
                          title="Continue and finalize wizard setup for this draft"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCurrentHashView('create-assurance-set', s.id);
                          }}
                        >
                          Continue Setup
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectSet(s);
                          }}
                        >
                          View Details
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);
};

