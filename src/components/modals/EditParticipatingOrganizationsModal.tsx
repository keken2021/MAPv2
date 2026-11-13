/*
  file summary: Organizations & Contract Chain modal for managing project contract parties.
  responsibilities: Edits head contractor, vendor, and participating organizations on a project. Client is read-only.
  role in system: Consumed by ProjectDetailView.tsx and RequestAssuranceSetModal.tsx (Map Design System §12).
*/

import React, { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Modal } from './Modal';
import { ContractChainFields } from './ContractChainFields';
import { useMapStore } from '../../store/useMapStore';
import { ContractParty, OrganizationGroup, Project } from '../../types/project';
import {
  contractPartyByRole,
  replaceChainParty,
  sameOrganization,
  syncInvitedOrganizationsToParties,
} from '../../utils/projectHelpers';
import { MOCK_ORGANIZATION_PROFILES } from '../../store/organizationMockData';

export interface EditParticipatingOrganizationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  onSuccess?: (message: string) => void;
  zIndex?: number;
}

/** Modal allowing client Administrator to edit the contract chain and participating organizations on a project. */
export const EditParticipatingOrganizationsModal: React.FC<EditParticipatingOrganizationsModalProps> = ({
  isOpen,
  onClose,
  project,
  onSuccess,
  zIndex,
}) => {
  const { users, updateProject } = useMapStore();

  const clientOrg = useMemo(() => {
    return (
      contractPartyByRole(project.contractParties, 'client')?.organization ||
      project.ownerOrganization?.trim() ||
      project.requestingOrganization?.trim() ||
      project.charterer?.trim() ||
      ''
    );
  }, [project]);

  const [headContractor, setHeadContractor] = useState('');
  const [vendor, setVendor] = useState('');

  const knownOrgOptions = useMemo(() => {
    const set = new Set<string>();
    (MOCK_ORGANIZATION_PROFILES ?? []).forEach((p) => p.name && set.add(p.name));
    (users ?? []).forEach((u) => u.organization && set.add(u.organization));
    (project.invitedOrganizations ?? []).forEach((o) => o && set.add(o));
    (project.contractParties ?? []).forEach((p) => p.organization && set.add(p.organization));
    if (clientOrg) set.add(clientOrg);
    if (headContractor.trim()) set.add(headContractor.trim());
    if (vendor.trim()) set.add(vendor.trim());
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [users, project, clientOrg, headContractor, vendor]);

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
      setHeadContractor(contractPartyByRole(synced.contractParties, 'head_contractor')?.organization || '');
      setVendor(contractPartyByRole(synced.contractParties, 'vendor')?.organization || '');
      setNewOrgName('');
      setNewOrgGroup('Vendor');
      setError('');
    }
  }, [isOpen, project]);

  const handleAddParty = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newOrgName.trim();
    if (!trimmed) { setError('Enter an organization name.'); return; }
    const chainOrgs = [clientOrg, headContractor.trim(), vendor.trim()].filter(Boolean);
    if (
      parties.some((p) => sameOrganization(p.organization, trimmed)) ||
      chainOrgs.some((org) => sameOrganization(org, trimmed))
    ) {
      setError(`${trimmed} is already in the project's organizations.`);
      return;
    }
    setParties([...parties, { organization: trimmed, group: newOrgGroup }]);
    setNewOrgName('');
    setNewOrgGroup('Vendor');
    setError('');
  };

  const handleRemoveParty = (idx: number) => {
    setParties(parties.filter((_, i) => i !== idx));
    setError('');
  };

  const handleGroupChange = (idx: number, newGroup: OrganizationGroup) => {
    setParties(parties.map((p, i) => (i === idx ? { ...p, group: newGroup } : p)));
  };

  const handleSave = () => {
    const trimmedHead = headContractor.trim();
    const trimmedVendor = vendor.trim();

    if (trimmedHead && clientOrg && sameOrganization(trimmedHead, clientOrg)) {
      setError('Head contractor cannot be the client organization.');
      return;
    }
    if (trimmedVendor && clientOrg && sameOrganization(trimmedVendor, clientOrg)) {
      setError('Vendor cannot be the client organization.');
      return;
    }
    if (trimmedHead && trimmedVendor && sameOrganization(trimmedHead, trimmedVendor)) {
      setError('Head contractor and vendor cannot be the same organization.');
      return;
    }

    const baseParties = project.contractParties ?? [];
    let updatedParties = replaceChainParty(baseParties, 'head_contractor', trimmedHead);
    updatedParties = replaceChainParty(updatedParties, 'vendor', trimmedVendor);

    const chainWithRoles = updatedParties.filter((p) => Boolean(p.chainRole));
    const demotedParties = updatedParties.filter((p) => !p.chainRole);

    const removedOrgNames = initialOtherParties
      .filter((init) => !parties.some((p) => sameOrganization(p.organization, init.organization)))
      .map((p) => p.organization.toLowerCase());

    const cleanParticipating = parties.filter(
      (p) => !chainWithRoles.some((c) => sameOrganization(c.organization, p.organization)),
    );

    for (const demoted of demotedParties) {
      const isRemoved = removedOrgNames.includes(demoted.organization.toLowerCase());
      const isAlreadyInChain = chainWithRoles.some((c) => sameOrganization(c.organization, demoted.organization));
      const isAlreadyInParticipating = cleanParticipating.some((p) => sameOrganization(p.organization, demoted.organization));
      if (!isRemoved && !isAlreadyInChain && !isAlreadyInParticipating) {
        cleanParticipating.push(demoted);
      }
    }

    const allCombined = [...chainWithRoles, ...cleanParticipating];
    const currentInvited = project.invitedOrganizations ?? [];
    const partyOrgNames = allCombined.map((p) => p.organization);
    const filteredInvited = currentInvited.filter((inv) => !removedOrgNames.some((rem) => rem === inv.trim().toLowerCase()));
    const updatedInvited = Array.from(new Set([...filteredInvited, ...partyOrgNames]));

    updateProject({ ...project, contractParties: allCombined, invitedOrganizations: updatedInvited });
    onSuccess?.('Organizations updated.');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Organizations & Contract Chain"
      size="lg"
      zIndex={zIndex ?? 1060}
      footer={
        <>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-sm btn-primary" onClick={handleSave} data-testid="btn-save-participating-orgs">
            Save Changes
          </button>
        </>
      }
    >
      <p className="text-muted small mb-3">
        Manage the contract chain and participating organizations for <strong>{project.name}</strong>.
      </p>

      {error && (
        <div className="alert alert-danger py-2 small mb-3" role="alert" data-testid="edit-orgs-error">{error}</div>
      )}

      <ContractChainFields
        client={clientOrg}
        headContractor={headContractor}
        vendor={vendor}
        onHeadContractorChange={(val) => { setHeadContractor(val); if (error) setError(''); }}
        onVendorChange={(val) => { setVendor(val); if (error) setError(''); }}
      />

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
                  onChange={(e) => { setNewOrgName(e.target.value); if (error) setError(''); }}
                  data-testid="input-new-org-name"
                />
                <datalist id="known-org-list">
                  {knownOrgOptions.map((org) => (<option key={org} value={org} />))}
                </datalist>
              </div>

              <div className="col-12 col-md-4">
                <label className="form-label text-secondary small fw-medium mb-1" htmlFor="select-new-org-group">Group</label>
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
              <th className="text-end" style={{ width: '80px' }}>Actions</th>
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
                  <td><span className="fw-semibold text-dark small">{party.organization}</span></td>
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
