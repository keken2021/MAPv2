/*
  file summary: detail drawer for an assurance object that has no page of its own.
  responsibilities: shows owner, description, the viewer's own client verifications, person assignments, and the sets that use the object.
  role in system: opened from organization, person, procedure, document and method rows on AssuranceObjectsView.
*/

import React from 'react';
import { AssuranceObject, AssuranceSet, ObjectVerification } from '../../types/assurance';
import { UserRolePersona } from '../../types/audit';
import { UserProfile } from '../../types/user';
import { objectVerifications } from '../../store/assuranceObjectMockData';
import { getAssuranceSetObjects } from '../../utils/assuranceTemplates';
import { deriveObjectVerification } from '../../utils/documentVersionSnapshot';
import { isAssuranceSetAssignedToPersona } from '../../utils/rbacHelpers';
import { ObjectVerificationBadge } from '../common/ObjectVerificationBadge';
import { StatusBadge } from '../common/StatusBadge';
import { Drawer } from './Drawer';

const DRAWER_TYPES = ['organization', 'person', 'procedure', 'document', 'method'] as const;

const TYPE_LABEL: Record<(typeof DRAWER_TYPES)[number], string> = {
  organization: 'Organization',
  person: 'Person',
  procedure: 'Procedure',
  document: 'Document',
  method: 'Method',
};

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const sameOrganization = (left?: string, right?: string) => {
  if (!left?.trim() || !right?.trim()) return false;
  const a = left.trim().toLowerCase();
  const b = right.trim().toLowerCase();
  return a === b || a.includes(b) || b.includes(a);
};

/** a date-only value, shown as 01 SEP 2026 without a timezone shift. */
function formatAssignmentDate(value?: string): string {
  if (!value) return '—';
  const [year, month, day] = value.slice(0, 10).split('-');
  const monthIndex = Number(month) - 1;
  if (!year || !day || monthIndex < 0 || monthIndex > 11) return value;
  return `${day} ${MONTHS[monthIndex]} ${year}`;
}

/**
  what: the verification rows this viewer is allowed to read.
  how: a client admin, and the other workflow roles, see only their own client's check. An administrator sees each client's status, channel, verifier and date. No client's documents are included.
*/
export function verificationsForViewer(
  object: AssuranceObject,
  sets: AssuranceSet[],
  persona: UserRolePersona,
  organization: string,
): ObjectVerification[] {
  const derived = deriveObjectVerification(object.id, sets, organization);
  const combined = [...objectVerifications(object)];
  if (derived && !combined.some((item) => sameOrganization(item.clientOrganization, derived.clientOrganization))) {
    combined.push(derived);
  }

  const visible = persona === 'Administrator'
    ? combined
    : combined.filter((item) => sameOrganization(item.clientOrganization, organization));

  return visible.sort((left, right) => {
    const leftOwn = sameOrganization(left.clientOrganization, organization) ? 0 : 1;
    const rightOwn = sameOrganization(right.clientOrganization, organization) ? 0 : 1;
    if (leftOwn !== rightOwn) return leftOwn - rightOwn;
    return left.clientOrganization.localeCompare(right.clientOrganization);
  });
}

/** sets that include the object and that this role is allowed to open. */
export function setsForObjectDrawer(
  objectId: string,
  sets: AssuranceSet[],
  persona: UserRolePersona,
  organization: string,
  user?: Pick<UserProfile, 'id' | 'name' | 'organization' | 'roles'> | null,
): AssuranceSet[] {
  return sets.filter(
    (set) =>
      getAssuranceSetObjects(set).some((item) => item.id === objectId) &&
      isAssuranceSetAssignedToPersona(set, persona, organization, user),
  );
}

export function objectOpensInDrawer(type: AssuranceObject['type'], isCrewMember: boolean): boolean {
  if (type === 'person' && isCrewMember) return false;
  return (DRAWER_TYPES as readonly string[]).includes(type);
}

interface AssuranceObjectDrawerProps {
  object: AssuranceObject;
  verifications: ObjectVerification[];
  sets: AssuranceSet[];
  onClose: () => void;
  onOpenSet: (setId: string) => void;
}

export const AssuranceObjectDrawer: React.FC<AssuranceObjectDrawerProps> = ({
  object,
  verifications,
  sets,
  onClose,
  onOpenSet,
}) => {
  const typeLabel = TYPE_LABEL[object.type as (typeof DRAWER_TYPES)[number]] || object.type;
  const assignments = object.type === 'person' ? object.assignments || [] : [];

  return (
    <Drawer
      title={object.name}
      meta={`${typeLabel}${object.identifier ? ` · ${object.identifier}` : ''}`}
      size="lg"
      onClose={onClose}
    >
      <div className="map-drawer-stack" data-testid="assurance-object-drawer">
        <section className="map-drawer-card">
          <h3 className="h6 mb-2">Owner</h3>
          <div>{object.ownerOrganization}</div>
        </section>

        <section className="map-drawer-card">
          <h3 className="h6 mb-2">Description</h3>
          <div>{object.description || 'No description.'}</div>
        </section>

        <section className="map-drawer-card" aria-label="Verification">
          <h3 className="h6 mb-2">Verification</h3>
          {verifications.length === 0 && <div className="text-muted">No verification for your organization.</div>}
          {verifications.map((verification) => (
            <div key={verification.clientOrganization} className="mb-3" data-testid="object-verification">
              <div className="fw-semibold">{verification.clientOrganization}</div>
              <ObjectVerificationBadge verification={verification} />
            </div>
          ))}
        </section>

        {object.type === 'person' && (
          <section className="map-drawer-card" aria-label="Assignments">
            <h3 className="h6 mb-2">Assignments</h3>
            {assignments.length === 0 && <div className="text-muted">No assignments.</div>}
            {assignments.map((assignment) => (
              <div key={assignment.id} className="mb-2" data-testid="object-assignment">
                <div className="fw-semibold">{assignment.targetName}</div>
                <div className="text-muted small">
                  {assignment.role ? `${assignment.role} · ` : ''}
                  {formatAssignmentDate(assignment.startDate)} to {formatAssignmentDate(assignment.endDate)}
                </div>
              </div>
            ))}
          </section>
        )}

        <section className="map-drawer-card" aria-label="Used in">
          <h3 className="h6 mb-2">Used in</h3>
          {sets.length === 0 && <div className="text-muted">Not used in an assurance set you can open.</div>}
          {sets.map((set) => (
            <div key={set.id} className="d-flex align-items-center justify-content-between gap-2 mb-2">
              <button
                type="button"
                className="btn btn-link p-0 text-start"
                onClick={() => onOpenSet(set.id)}
              >
                {set.title}
              </button>
              <StatusBadge value={set.stage} />
            </div>
          ))}
        </section>
      </div>
    </Drawer>
  );
};
