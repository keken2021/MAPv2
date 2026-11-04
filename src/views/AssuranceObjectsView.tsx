/*
  file summary: assurance objects list for every object type in the catalogue.
  responsibilities: scopes rows to the signed-in role, then filters them by type, name, identifier, owner and verification status.
  role in system: full-page view at #/objects, opened from All Objects in the Assurance Objects sidebar group.
*/

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Download, Eye, FileSpreadsheet, FileText, Search } from 'lucide-react';
import { useMapStore } from '../store/useMapStore';
import { AssuranceObject, AssuranceObjectType, AssuranceSet, ObjectVerificationStatus } from '../types/assurance';
import { UserRolePersona } from '../types/audit';
import { UserProfile } from '../types/user';
import { getAssuranceSetObjects } from '../utils/assuranceTemplates';
import { deriveObjectVerification } from '../utils/documentVersionSnapshot';
import { exportToCsv, exportToPdf } from '../utils/exportHelpers';
import { isAssuranceSetAssignedToPersona } from '../utils/rbacHelpers';
import { usePagination } from '../utils/usePagination';
import { getDemoSessionContext, getSessionUserForPersona } from '../utils/userRoleHelpers';
import { ObjectVerificationBadge } from '../components/common/ObjectVerificationBadge';
import { ListToolbar } from '../components/common/ListToolbar';
import { EmptyState } from '../components/common/EmptyState';
import { TablePagination } from '../components/common/TablePagination';
import {
  AssuranceObjectDrawer,
  objectOpensInDrawer,
  setsForObjectDrawer,
  verificationsForViewer,
} from '../components/drawers/AssuranceObjectDrawer';

export const OBJECTS_LIST_PERSONAS: UserRolePersona[] = [
  'Administrator',
  'C Admin',
  'Submitter',
  'Verifier',
  'Inspector',
  'Approver',
];

/** the objects list is open to the six working roles. Other routes keep their own access rules. */
export function canOpenObjectsList(persona: UserRolePersona): boolean {
  return OBJECTS_LIST_PERSONAS.includes(persona);
}

export const TYPE_OPTIONS: { key: 'all' | AssuranceObjectType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'vessel', label: 'Vessel' },
  { key: 'person', label: 'Person' },
  { key: 'equipment', label: 'Equipment' },
  { key: 'procedure', label: 'Procedure' },
  { key: 'method', label: 'Method' },
];

const TYPE_LABEL: Record<string, string> = {
  vessel: 'Vessel',
  person: 'Person',
  equipment: 'Equipment',
  procedure: 'Procedure',
  method: 'Method',
};

const VERIFICATION_STATUSES: ObjectVerificationStatus[] = [
  'Uploaded',
  'Internally verified',
  'Externally verified',
  'Verified by several entities',
];

export interface ObjectListFilters {
  type: 'all' | AssuranceObjectType;
  search: string;
  owner: string;
  verificationStatus: string;
}

/**
  what: uses the vessel's registered owner on the list.
  how: the catalogue copy of a vessel has no owner field, so the list reads registeredOwner from the vessel record.
*/
export function objectsWithKnownOwners(
  objects: AssuranceObject[],
  vessels: { id: string; registeredOwner?: string }[],
): AssuranceObject[] {
  const owners = new Map(vessels.map((vessel) => [vessel.id, vessel.registeredOwner]));
  return objects.map((object) => {
    const registered = object.type === 'vessel' ? owners.get(object.id) : undefined;
    if (!registered || registered === object.ownerOrganization) return object;
    return { ...object, ownerOrganization: registered };
  });
}

const sameOrganization = (left?: string, right?: string) => {
  if (!left?.trim() || !right?.trim()) return false;
  const a = left.trim().toLowerCase();
  const b = right.trim().toLowerCase();
  return a === b || a.includes(b) || b.includes(a);
};

const objectIdsOnSets = (sets: AssuranceSet[]) => {
  const ids = new Set<string>();
  sets.forEach((set) => {
    getAssuranceSetObjects(set).forEach((object) => ids.add(object.id));
  });
  return ids;
};

/**
  what: the objects this role is allowed to see.
  how: an administrator sees objects their organization owns. A client admin sees those plus the objects on their sets. Submitter, verifier, inspector and approver see the objects on sets assigned to them.
*/
export function assuranceObjectsForSession(
  objects: AssuranceObject[],
  sets: AssuranceSet[],
  persona: UserRolePersona,
  organization: string,
  user?: Pick<UserProfile, 'id' | 'name' | 'organization' | 'roles'> | null,
): AssuranceObject[] {
  const byId = new Map<string, AssuranceObject>();
  objects.forEach((object) => byId.set(object.id, object));

  if (persona === 'Administrator') {
    return [...byId.values()].filter((object) => sameOrganization(object.ownerOrganization, organization));
  }

  const assigned = sets.filter((set) =>
    isAssuranceSetAssignedToPersona(set, persona, organization, user),
  );
  assigned.forEach((set) => {
    getAssuranceSetObjects(set).forEach((object) => {
      if (!byId.has(object.id)) byId.set(object.id, object);
    });
  });
  const onAssignedSets = objectIdsOnSets(assigned);

  if (persona === 'C Admin') {
    return [...byId.values()].filter(
      (object) => sameOrganization(object.ownerOrganization, organization) || onAssignedSets.has(object.id),
    );
  }

  if (persona === 'Submitter' || persona === 'Verifier' || persona === 'Inspector' || persona === 'Approver') {
    return [...byId.values()].filter((object) => onAssignedSets.has(object.id));
  }

  return [];
}

/** how many assurance sets include this object. */
export function setsUsingObject(objectId: string, sets: AssuranceSet[]): number {
  return sets.filter((set) => getAssuranceSetObjects(set).some((object) => object.id === objectId)).length;
}

/** tabs, search, owner and verification status apply together. */
export function filterAssuranceObjectRows(
  rows: { object: AssuranceObject; verificationStatus: string }[],
  filters: ObjectListFilters,
) {
  const query = filters.search.trim().toLowerCase();
  return rows.filter(({ object, verificationStatus }) => {
    if (filters.type !== 'all' && object.type !== filters.type) return false;
    if (filters.owner && object.ownerOrganization !== filters.owner) return false;
    if (filters.verificationStatus && verificationStatus !== filters.verificationStatus) return false;
    if (!query) return true;
    return (
      object.name.toLowerCase().includes(query) ||
      (object.identifier || '').toLowerCase().includes(query)
    );
  });
}

interface ObjectRow {
  object: AssuranceObject;
  verificationStatus: string;
  usedIn: number;
  detailView: 'vessels' | 'crew' | 'equipment' | null;
}

export const AssuranceObjectsView: React.FC = () => {
  const {
    assuranceObjects,
    assuranceSets,
    vessels,
    crew,
    activePersona,
    activeDemoOrganization,
    activeSessionUserId,
    users,
    setCurrentHashView,
  } = useMapStore();

  const [activeType, setActiveType] = useState<ObjectListFilters['type']>('all');
  const [search, setSearch] = useState('');
  const [owner, setOwner] = useState('');
  const [verificationStatus, setVerificationStatus] = useState('');
  const [drawerObjectId, setDrawerObjectId] = useState<string | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(event.target as Node)) {
        setIsExportOpen(false);
      }
    };
    if (isExportOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExportOpen]);

  const sessionUser = useMemo(
    () =>
      getSessionUserForPersona(
        activePersona,
        users,
        getDemoSessionContext({ activeDemoOrganization, activeSessionUserId }),
      ),
    [activePersona, users, activeDemoOrganization, activeSessionUserId],
  );
  const organization = sessionUser?.organization || activeDemoOrganization;

  const crewIds = useMemo(() => new Set(crew.map((member) => member.id)), [crew]);

  const rows = useMemo<ObjectRow[]>(() => {
    const visible = assuranceObjectsForSession(
      objectsWithKnownOwners(assuranceObjects, vessels),
      assuranceSets,
      activePersona,
      organization,
      sessionUser,
    );
    return visible
      .map((object) => {
        const verification = deriveObjectVerification(object.id, assuranceSets, organization);
        const detailView =
          object.type === 'vessel'
            ? 'vessels'
            : object.type === 'equipment'
              ? 'equipment'
              : object.type === 'person' && crewIds.has(object.id)
                ? 'crew'
                : null;
        return {
          object,
          verificationStatus: verification?.status || '',
          usedIn: setsUsingObject(object.id, assuranceSets),
          detailView,
        } as ObjectRow;
      })
      .sort((left, right) => {
        const typeDelta = TYPE_OPTIONS.findIndex((tab) => tab.key === left.object.type)
          - TYPE_OPTIONS.findIndex((tab) => tab.key === right.object.type);
        if (typeDelta !== 0) return typeDelta;
        return left.object.name.localeCompare(right.object.name);
      });
  }, [assuranceObjects, vessels, assuranceSets, activePersona, organization, sessionUser, crewIds]);

  const verificationById = useMemo(() => {
    const lookup = new Map<string, ReturnType<typeof deriveObjectVerification>>();
    rows.forEach((row) => {
      lookup.set(row.object.id, deriveObjectVerification(row.object.id, assuranceSets, organization));
    });
    return lookup;
  }, [rows, assuranceSets, organization]);

  const owners = useMemo(
    () => [...new Set(rows.map((row) => row.object.ownerOrganization).filter(Boolean))].sort(),
    [rows],
  );

  const filters: ObjectListFilters = { type: 'all', search, owner, verificationStatus };
  const matched = filterAssuranceObjectRows(
    rows.map((row) => ({ object: row.object, verificationStatus: row.verificationStatus })),
    filters,
  );
  const matchedIds = new Set(matched.map((row) => row.object.id));
  const matchedRows = rows.filter((row) => matchedIds.has(row.object.id));
  const visibleRows = matchedRows.filter((row) => activeType === 'all' || row.object.type === activeType);

  const typeOptions = TYPE_OPTIONS.map((opt) => ({
    ...opt,
    count: opt.key === 'all'
      ? matchedRows.length
      : matchedRows.filter((row) => row.object.type === opt.key).length,
  }));

  const pagination = usePagination(visibleRows, [activeType, search, owner, verificationStatus]);
  const isFiltered = Boolean(search.trim() || owner || verificationStatus || activeType !== 'all');

  const clearFilters = () => {
    setSearch('');
    setOwner('');
    setVerificationStatus('');
    setActiveType('all');
  };

  const openDetail = (row: ObjectRow, rowElement?: HTMLElement | null) => {
    if (row.detailView) {
      setCurrentHashView(row.detailView, row.object.id);
      return;
    }
    if (!objectOpensInDrawer(row.object.type, crewIds.has(row.object.id))) return;
    rowElement?.focus();
    setDrawerObjectId(row.object.id);
  };

  const drawerObject = rows.find((row) => row.object.id === drawerObjectId)?.object || null;
  const drawerVerifications = drawerObject
    ? verificationsForViewer(drawerObject, assuranceSets, activePersona, organization)
    : [];
  const drawerSets = drawerObject
    ? setsForObjectDrawer(drawerObject.id, assuranceSets, activePersona, organization, sessionUser)
    : [];

  const exportRows = visibleRows.map((row) => ({
    Type: TYPE_LABEL[row.object.type] || row.object.type,
    Name: row.object.name,
    Identifier: row.object.identifier || '',
    Owner: row.object.ownerOrganization,
    Verification: row.verificationStatus || 'Not verified',
    'Used in': row.usedIn,
  }));

  return (
    <div className="d-flex flex-column gap-4">
      <div className="card map-card-custom">
        <ListToolbar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search name or identifier..."
          primaryAction={
            <div className="position-relative" ref={exportRef}>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1.5 px-3 py-1.5 bg-white text-dark"
                style={{ height: '36px' }}
                disabled={visibleRows.length === 0}
                onClick={() => setIsExportOpen(!isExportOpen)}
                aria-expanded={isExportOpen}
                aria-haspopup="true"
                aria-label="Export options"
              >
                <Download size={15} className="text-secondary" />
                <span className="fw-medium">Export</span>
                <ChevronDown size={14} className="text-muted ms-0.5" />
              </button>

              {isExportOpen && (
                <div
                  className="dropdown-menu show shadow-sm position-absolute mt-1 end-0"
                  style={{ zIndex: 1050, minWidth: '150px' }}
                  role="menu"
                >
                  <button
                    type="button"
                    className="dropdown-item d-flex align-items-center gap-2 py-2"
                    onClick={() => {
                      setIsExportOpen(false);
                      exportToCsv('assurance-objects', exportRows);
                    }}
                    role="menuitem"
                  >
                    <FileSpreadsheet size={15} className="text-success" />
                    <span>CSV</span>
                  </button>
                  <button
                    type="button"
                    className="dropdown-item d-flex align-items-center gap-2 py-2"
                    onClick={() => {
                      setIsExportOpen(false);
                      exportToPdf(
                        'Assurance objects',
                        ['Type', 'Name', 'Identifier', 'Owner', 'Verification', 'Used in'],
                        exportRows.map((row) => [
                          row.Type,
                          row.Name,
                          row.Identifier,
                          row.Owner,
                          row.Verification,
                          row['Used in'],
                        ]),
                      );
                    }}
                    role="menuitem"
                  >
                    <FileText size={15} className="text-danger" />
                    <span>PDF</span>
                  </button>
                </div>
              )}
            </div>
          }
        >
          <select
            id="objects-type-filter"
            className="form-select form-select-sm"
            style={{ order: -1, width: 'auto', minWidth: '140px', height: '36px' }}
            value={activeType}
            onChange={(event) => setActiveType(event.target.value as ObjectListFilters['type'])}
            aria-label="Filter by type"
          >
            {typeOptions.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label} ({opt.count})
              </option>
            ))}
          </select>

          <select
            id="objects-owner-filter"
            className="form-select form-select-sm"
            style={{ width: 'auto', minWidth: '150px', height: '36px' }}
            value={owner}
            onChange={(event) => setOwner(event.target.value)}
            aria-label="Filter by owner"
          >
            <option value="">All owners</option>
            {owners.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>

          <select
            id="objects-verification-filter"
            className="form-select form-select-sm"
            style={{ width: 'auto', minWidth: '160px', height: '36px' }}
            value={verificationStatus}
            onChange={(event) => setVerificationStatus(event.target.value)}
            aria-label="Filter by verification"
          >
            <option value="">All statuses</option>
            {VERIFICATION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          {isFiltered && (
            <button
              type="button"
              className="btn btn-sm btn-link text-primary text-decoration-none p-0 d-inline-flex align-items-center"
              onClick={clearFilters}
            >
              Clear
            </button>
          )}
        </ListToolbar>

        <div className="table-responsive">
          <table className="table map-table-custom align-middle mb-0" data-testid="assurance-objects-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Name</th>
                <th>Owner</th>
                <th>Verification</th>
                <th>Used in</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagination.pageItems.map((row) => (
                <tr
                  key={row.object.id}
                  data-testid="assurance-object-row"
                  tabIndex={objectOpensInDrawer(row.object.type, crewIds.has(row.object.id)) ? 0 : undefined}
                  aria-label={row.object.name}
                  onClick={(event) => openDetail(row, event.currentTarget)}
                  style={{ cursor: row.detailView || objectOpensInDrawer(row.object.type, crewIds.has(row.object.id)) ? 'pointer' : 'default' }}
                >
                  <td className="small">{TYPE_LABEL[row.object.type] || row.object.type}</td>
                  <td>
                    <div className="fw-semibold text-dark" style={{ fontSize: '0.88rem' }}>
                      {row.object.name}
                    </div>
                    {row.object.identifier && (
                      <div className="text-muted font-mono-code" style={{ fontSize: '0.75rem' }}>
                        {row.object.identifier}
                      </div>
                    )}
                  </td>
                  <td className="small">{row.object.ownerOrganization}</td>
                  <td>
                    <ObjectVerificationBadge verification={verificationById.get(row.object.id) || null} />
                    {!row.verificationStatus && <span className="text-muted small">—</span>}
                  </td>
                  <td className="small">{row.usedIn}</td>
                  <td className="text-end">
                    {(row.detailView || objectOpensInDrawer(row.object.type, crewIds.has(row.object.id))) && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center p-0"
                        style={{ width: '32px', height: '32px' }}
                        onClick={(event) => {
                          event.stopPropagation();
                          openDetail(row, event.currentTarget.closest('tr'));
                        }}
                        title="View"
                        aria-label={`View ${row.object.name}`}
                      >
                        <Eye size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-0">
                    <EmptyState
                      icon={Search}
                      title={isFiltered ? 'No matches' : 'No assurance objects'}
                      description={
                        isFiltered
                          ? 'No objects match these filters.'
                          : 'Objects your role can see will appear here.'
                      }
                      action={isFiltered ? { label: 'Clear filters', onClick: clearFilters } : undefined}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <TablePagination {...pagination.controls} />
      </div>

      {drawerObject && (
        <AssuranceObjectDrawer
          object={drawerObject}
          verifications={drawerVerifications}
          sets={drawerSets}
          onClose={() => setDrawerObjectId(null)}
          onOpenSet={(setId) => {
            setDrawerObjectId(null);
            setCurrentHashView('assurance-sets', setId);
          }}
        />
      )}
    </div>
  );
};
