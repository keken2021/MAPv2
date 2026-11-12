import React, { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Modal } from './Modal';
import { useMapStore } from '../../store/useMapStore';
import { ContractParty, OrganizationGroup, Project } from '../../types/project';
import { sameOrganization, syncInvitedOrganizationsToParties } from '../../utils/projectHelpers';
import { MOCK_ORGANIZATION_PROFILES } from '../../store/organizationMockData';

export interface EditParticipatingOrganizationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  onSuccess?: (message: string) => void;
  zIndex?: number;
}

/** Modal allowing client/administrator to edit participating vendor and third-party organizations on a project. */
export const EditParticipatingOrganizationsModal: React.FC<EditParticipatingOrganizationsModalProps> = ({
  isOpen,
  onClose,
  project,
  onSuccess,
  zIndex,
}) => {
  const { users, updateProject } = useMapStore();

  // Known organization options to suggest in the input
  const knownOrgOptions = useMemo(() => {
    const set = new Set<string>();
    (MOCK_ORGANIZATION_PROFILES ?? []).forEach((p) => p.name && set.add(p.name));
    (users ?? []).forEach((u) => u.organization && set.add(u.organization));
    (project.invitedOrganizations ?? []).forEach((o) => o && set.add(o));
    (project.contractParties ?? []).forEach((p) => p.organization && set.add(p.organization));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [users, project]);

  const initialOtherParties = useMemo(() => {
    const synced = syncInvitedOrganizationsToParties(project);
    return (synced.contractParties ?? []).filter((p) => !p.chainRole);
  }, [project]);

  const [parties, setParties] = useState<ContractParty[]>(initialOtherParties);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgGroup, setNewOrgGroup] = useState<OrganizationGroup>('Vendor');
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (isOpen) {
      const synced = syncInvitedOrganizationsToParties(project);
      setParties((synced.contractParties ?? []).filter((p) => !p.chainRole));
      setNewOrgName('');
      setNewOrgGroup('Vendor');
      setError('');
    }
  }, [isOpen, project]);

  const handleAddParty = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newOrgName.trim();
    if (!trimmed) {
      setError('Enter an organization name.');
      return;
    }
    const chainParties = (project.contractParties ?? []).filter((p) => Boolean(p.chainRole));
    if (
      parties.some((p) => sameOrganization(p.organization, trimmed)) ||
      chainParties.some((p) => sameOrganization(p.organization, trimmed))
    ) {
      setError(`${trimmed} is already in the project's organizations.`);
      return;
    }

    setParties([...parties, { organization: trimmed, group: newOrgGroup }]);
    setNewOrgName('');
    setNewOrgGroup('Vendor');
    setError('');
  };

  const handleRemoveParty = (indexToRemove: number) => {
    setParties(parties.filter((_, idx) => idx !== indexToRemove));
    setError('');
  };

  const handleGroupChange = (index: number, newGroup: OrganizationGroup) => {
    setParties(
      parties.map((p, idx) => (idx === index ? { ...p, group: newGroup } : p)),
    );
  };

  const handleSave = () => {
    const chainParties = (project.contractParties ?? []).filter((p) => Boolean(p.chainRole));
    const allCombined = [...chainParties, ...parties];

    // Exclude any participating organization that was explicitly removed
    const removedOrgNames = initialOtherParties
      .filter((init) => !parties.some((p) => sameOrganization(p.organization, init.organization)))
      .map((p) => p.organization.toLowerCase());

    const currentInvited = project.invitedOrganizations ?? [];
    const partyOrgNames = parties.map((p) => p.organization);
    const filteredInvited = currentInvited.filter(
      (inv) => !removedOrgNames.some((rem) => rem === inv.trim().toLowerCase()),
    );
    const updatedInvited = Array.from(new Set([...filteredInvited, ...partyOrgNames]));

    const updatedProject: Project = {
      ...project,
      contractParties: allCombined,
      invitedOrganizations: updatedInvited,
    };

    updateProject(updatedProject);
    onSuccess?.('Participating organizations updated.');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Participating Organizations"
      size="lg"
      zIndex={zIndex ?? 1060}
      footer={
        <>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={handleSave}
            data-testid="btn-save-participating-orgs"
          >
            Save Changes
          </button>
        </>
      }
    >
      <p className="text-muted small mb-3">
        Manage participating vendor and third-party organizations for <strong>{project.name}</strong>.
      </p>

      {error && (
        <div className="alert alert-danger py-2 small mb-3" role="alert" data-testid="edit-orgs-error">
          {error}
        </div>
      )}

      <div className="card border mb-3">
        <div className="card-header bg-light py-2 px-3">
          <span className="fw-semibold text-dark small">Add Organization</span>
        </div>
        <div className="card-body p-3">
          <form onSubmit={handleAddParty}>
            <div className="row g-2 align-items-end">
              <div className="col-12 col-md-6">
                <label className="form-label text-secondary small fw-medium mb-1" htmlFor="input-new-org">
                  Organization name <span className="text-danger">*</span>
                </label>
                <input
                  id="input-new-org"
                  type="text"
                  className="form-control form-control-sm"
                  list="known-org-list"
                  placeholder="e.g. Harbourline Terminals"
                  value={newOrgName}
                  onChange={(e) => {
                    setNewOrgName(e.target.value);
                    if (error) setError('');
                  }}
                  data-testid="input-new-org-name"
                />
                <datalist id="known-org-list">
                  {knownOrgOptions.map((org) => (
                    <option key={org} value={org} />
                  ))}
                </datalist>
              </div>

              <div className="col-12 col-md-4">
                <label className="form-label text-secondary small fw-medium mb-1" htmlFor="select-new-org-group">
                  Group
                </label>
                <select
                  id="select-new-org-group"
                  className="form-select form-select-sm"
                  value={newOrgGroup}
                  onChange={(e) => setNewOrgGroup(e.target.value as OrganizationGroup)}
                  data-testid="select-new-org-group"
                >
                  <option value="Vendor">Vendor</option>
                  <option value="Third party">Third party</option>
                  <option value="Client">Client</option>
                </select>
              </div>

              <div className="col-12 col-md-2">
                <button
                  type="submit"
                  className="btn btn-sm btn-outline-primary w-100 d-inline-flex align-items-center justify-content-center gap-1"
                  data-testid="btn-add-org-to-list"
                >
                  <Plus size={14} />
                  <span>Add</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <div className="table-responsive border rounded">
        <table className="table map-table-custom align-middle mb-0" data-testid="participating-orgs-table">
          <thead>
            <tr>
              <th>Organization</th>
              <th>Group</th>
              <th className="text-end" style={{ width: '80px' }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {parties.length === 0 ? (
              <tr>
                <td colSpan={3} className="text-center text-muted py-3 small">
                  No participating organizations added. Add one above.
                </td>
              </tr>
            ) : (
              parties.map((party, idx) => (
                <tr key={`${party.organization}-${idx}`} data-testid={`participating-org-row-${idx}`}>
                  <td>
                    <span className="fw-semibold text-dark small">{party.organization}</span>
                  </td>
                  <td>
                    <select
                      className="form-select form-select-sm py-0"
                      style={{ width: '130px', fontSize: '0.8rem' }}
                      value={party.group || 'Vendor'}
                      onChange={(e) => handleGroupChange(idx, e.target.value as OrganizationGroup)}
                      data-testid={`select-org-group-${idx}`}
                    >
                      <option value="Vendor">Vendor</option>
                      <option value="Third party">Third party</option>
                      <option value="Client">Client</option>
                    </select>
                  </td>
                  <td className="text-end">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger p-1"
                      onClick={() => handleRemoveParty(idx)}
                      title={`Remove ${party.organization}`}
                      aria-label={`Remove ${party.organization}`}
                      data-testid={`btn-remove-org-${idx}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Modal>
  );
};
