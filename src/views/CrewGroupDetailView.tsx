/* 
  file summary: crew group detail view with details/specializations and roster tabs.
  responsibilities: displays group particulars, specializations list, roster management (add/remove members; crew provider only), and updates master group in store.
  role in system: rendered when a crew group is selected from CrewTable (/crew-group?id=...).
*/

import React, { useState } from 'react';
import {
  Users,
  Shield,
  Briefcase,
  UserPlus,
  Trash2,
  Edit2,
  Check,
  X,
  Calendar,
  Building2,
  ArrowLeft,
} from 'lucide-react';
import { useMapStore } from '../store/useMapStore';
import { DetailHeader } from '../components/common/DetailHeader';
import { StatusBadge } from '../components/common/StatusBadge';
import { Tabs } from '../components/common/Tabs';
import { formatMaritimeDate } from '../utils/formatters';

interface CrewGroupDetailViewProps {
  groupId: string;
}

export const CrewGroupDetailView: React.FC<CrewGroupDetailViewProps> = ({ groupId }) => {
  const {
    crewGroups,
    crew,
    activePersona,
    setCurrentHashView,
    updateCrewGroup,
    addMemberToCrewGroup,
    removeMemberFromCrewGroup,
  } = useMapStore();

  const [activeTab, setActiveTab] = useState<'details' | 'roster'>('details');
  const [selectedMemberToAdd, setSelectedMemberToAdd] = useState<string>('');
  const [isEditingDetails, setIsEditingDetails] = useState(false);

  const group = crewGroups.find((g) => g.id === groupId);

  // Editable details form state
  const [editName, setEditName] = useState(group?.name || '');
  const [editDescription, setEditDescription] = useState(group?.description || '');
  const [editSpecialization, setEditSpecialization] = useState(group?.specialization || '');
  const [editSpecializationsText, setEditSpecializationsText] = useState(
    (group?.specializations || []).join(', ')
  );

  if (!group) {
    return (
      <div className="card map-card-custom p-5 text-center">
        <Users size={48} className="text-secondary mx-auto mb-3 opacity-50" />
        <h4 className="fw-bold text-dark">Crew Group Not Found</h4>
        <p className="text-secondary mb-4">
          The requested crew group ID ({groupId}) does not exist in the fleet registry.
        </p>
        <div>
          <button
            type="button"
            className="btn btn-primary btn-sm d-inline-flex align-items-center gap-1.5"
            onClick={() => setCurrentHashView('crew')}
          >
            <ArrowLeft size={16} /> Back to Crew Directory
          </button>
        </div>
      </div>
    );
  }

  // Permission: Crew Provider (Administrator or Submitter persona)
  const isCrewProvider = activePersona === 'Administrator' || activePersona === 'Submitter';

  // Roster members resolved from crew state
  const rosterMembers = group.memberIds
    .map((id) => crew.find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  // Available crew members eligible to be added
  const availableCrew = crew.filter((c) => !group.memberIds.includes(c.id));

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberToAdd) return;
    addMemberToCrewGroup(group.id, selectedMemberToAdd);
    setSelectedMemberToAdd('');
  };

  const handleRemoveMember = (memberId: string) => {
    removeMemberFromCrewGroup(group.id, memberId);
  };

  const handleSaveDetails = (e: React.FormEvent) => {
    e.preventDefault();
    const specs = editSpecializationsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    updateCrewGroup({
      id: group.id,
      name: editName.trim() || group.name,
      description: editDescription.trim(),
      specialization: editSpecialization.trim() || group.specialization,
      specializations: specs.length > 0 ? specs : [editSpecialization.trim() || group.specialization],
    });
    setIsEditingDetails(false);
  };

  const allSpecializations = group.specializations && group.specializations.length > 0
    ? group.specializations
    : [group.specialization];

  return (
    <div className="d-flex flex-column gap-4">
      {/* Detail Header */}
      <DetailHeader
        title={group.name}
        metaItems={[
          { label: 'Group ID', value: group.id },
          { label: 'Specialization', value: group.specialization },
          { label: 'Members', value: `${group.memberIds.length} seafarers` },
          { label: 'Provider', value: group.organization || 'Northwind Marine Pty Ltd' },
        ]}
        backLink={{
          label: 'Crew Directory',
          onClick: () => setCurrentHashView('crew'),
        }}
        mainAction={
          isCrewProvider && !isEditingDetails && activeTab === 'details' ? (
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1.5"
              onClick={() => {
                setEditName(group.name);
                setEditDescription(group.description || '');
                setEditSpecialization(group.specialization);
                setEditSpecializationsText((group.specializations || []).join(', '));
                setIsEditingDetails(true);
              }}
            >
              <Edit2 size={14} /> Edit Details
            </button>
          ) : undefined
        }
      />

      {/* Tabs Row */}
      <div className="card map-card-custom">
        <div className="border-bottom px-3 pt-2">
          <Tabs
            variant="section"
            aria-label="Crew group detail tabs"
            active={activeTab}
            onChange={(key) => setActiveTab(key as 'details' | 'roster')}
            tabs={[
              { key: 'details', label: 'Details and specializations' },
              { key: 'roster', label: 'Roster', count: group.memberIds.length },
            ]}
          />
        </div>

        {/* Tab 1: Details and specializations */}
        {activeTab === 'details' && (
          <div className="p-4">
            {isEditingDetails ? (
              <form onSubmit={handleSaveDetails} className="d-flex flex-column gap-3" style={{ maxWidth: '640px' }}>
                <div>
                  <label className="form-label small fw-semibold text-dark mb-1" htmlFor="edit-group-name">Group Name</label>
                  <input
                    id="edit-group-name"
                    type="text"
                    className="form-control form-control-sm"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="form-label small fw-semibold text-dark mb-1" htmlFor="edit-group-spec">Primary Specialization</label>
                  <input
                    id="edit-group-spec"
                    type="text"
                    className="form-control form-control-sm"
                    value={editSpecialization}
                    onChange={(e) => setEditSpecialization(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="form-label small fw-semibold text-dark mb-1" htmlFor="edit-group-all-specs">
                    All Specializations (comma-separated)
                  </label>
                  <input
                    id="edit-group-all-specs"
                    type="text"
                    className="form-control form-control-sm"
                    value={editSpecializationsText}
                    onChange={(e) => setEditSpecializationsText(e.target.value)}
                    placeholder="e.g. Subsea & Diving Operations, Underwater Inspection, Hyperbaric Safety"
                  />
                </div>

                <div>
                  <label className="form-label small fw-semibold text-dark mb-1" htmlFor="edit-group-desc">Description</label>
                  <textarea
                    id="edit-group-desc"
                    className="form-control form-control-sm"
                    rows={3}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                  />
                </div>

                <div className="d-flex align-items-center gap-2 pt-2">
                  <button type="submit" className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1.5">
                    <Check size={15} /> Save Changes
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1.5"
                    onClick={() => setIsEditingDetails(false)}
                  >
                    <X size={15} /> Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="row g-4">
                <div className="col-lg-7">
                  <div className="mb-4">
                    <h6 className="text-secondary small fw-bold text-uppercase mb-2">Description</h6>
                    <p className="text-dark mb-0">
                      {group.description || 'No description provided for this crew group.'}
                    </p>
                  </div>

                  <div className="mb-4">
                    <h6 className="text-secondary small fw-bold text-uppercase mb-2">Specializations</h6>
                    <div className="d-flex flex-wrap gap-2">
                      {allSpecializations.map((spec) => (
                        <span key={spec} className="badge bg-light text-dark border px-2.5 py-1.5">
                          {spec}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h6 className="text-secondary small fw-bold text-uppercase mb-2">Provider Governance</h6>
                    <div className="d-flex align-items-center gap-2 text-dark">
                      <Building2 size={16} className="text-secondary" />
                      <span className="fw-medium">{group.organization || 'Northwind Marine Pty Ltd'}</span>
                    </div>
                  </div>
                </div>

                <div className="col-lg-5">
                  <div className="p-3 bg-light rounded border">
                    <h6 className="fw-bold text-dark mb-3">Group Information</h6>
                    <div className="d-flex flex-column gap-2 small">
                      <div className="d-flex justify-content-between py-1 border-bottom">
                        <span className="text-secondary">Identifier:</span>
                        <span className="font-mono-code fw-semibold text-dark">{group.id}</span>
                      </div>
                      <div className="d-flex justify-content-between py-1 border-bottom">
                        <span className="text-secondary">Primary Specialization:</span>
                        <span className="fw-semibold text-dark">{group.specialization}</span>
                      </div>
                      <div className="d-flex justify-content-between py-1 border-bottom">
                        <span className="text-secondary">Total Roster Count:</span>
                        <span className="fw-semibold text-dark">{group.memberIds.length} seafarers</span>
                      </div>
                      <div className="d-flex justify-content-between py-1 border-bottom">
                        <span className="text-secondary">Created:</span>
                        <span className="text-dark">{group.createdAt ? formatMaritimeDate(group.createdAt) : '—'}</span>
                      </div>
                      <div className="d-flex justify-content-between py-1">
                        <span className="text-secondary">Last Modified:</span>
                        <span className="text-dark">{group.updatedAt ? formatMaritimeDate(group.updatedAt) : '—'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Roster */}
        {activeTab === 'roster' && (
          <div>
            {/* Add Member Bar (Crew Provider Only) */}
            {isCrewProvider ? (
              <div className="p-3 bg-light border-bottom">
                <form onSubmit={handleAddMember} className="d-flex flex-wrap align-items-center gap-2">
                  <label htmlFor="select-crew-member" className="small fw-semibold text-secondary mb-0">
                    Add Seafarer to Roster:
                  </label>
                  <select
                    id="select-crew-member"
                    className="form-select form-select-sm"
                    style={{ maxWidth: '320px' }}
                    value={selectedMemberToAdd}
                    onChange={(e) => setSelectedMemberToAdd(e.target.value)}
                  >
                    <option value="">-- Choose available crew member --</option>
                    {availableCrew.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName} ({c.rank}) - {c.id}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1.5"
                    disabled={!selectedMemberToAdd}
                  >
                    <UserPlus size={15} /> Add to Roster
                  </button>
                </form>
              </div>
            ) : (
              <div className="px-3 py-2 bg-light border-bottom small text-secondary">
                Roster editing is restricted to Crew Provider role. Viewing in read-only mode.
              </div>
            )}

            {/* Roster Table */}
            <div className="table-responsive">
              <table className="table map-table-custom align-middle mb-0" data-testid="crew-group-roster-table">
                <thead>
                  <tr>
                    <th style={{ whiteSpace: 'nowrap' }}>Crew ID</th>
                    <th style={{ whiteSpace: 'nowrap' }}>Name</th>
                    <th style={{ whiteSpace: 'nowrap' }}>Rank</th>
                    <th style={{ whiteSpace: 'nowrap' }}>Current Vessel</th>
                    <th style={{ whiteSpace: 'nowrap' }}>Nationality</th>
                    <th style={{ whiteSpace: 'nowrap' }}>Compliance</th>
                    {isCrewProvider && <th className="text-end" style={{ whiteSpace: 'nowrap' }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {rosterMembers.length === 0 ? (
                    <tr>
                      <td colSpan={isCrewProvider ? 7 : 6} className="text-center py-4 text-muted">
                        No crew members assigned to this group yet.
                      </td>
                    </tr>
                  ) : (
                    rosterMembers.map((member) => (
                      <tr key={member.id}>
                        <td className="font-mono-code fw-semibold text-primary">{member.id}</td>
                        <td className="fw-semibold text-dark text-nowrap">{member.fullName}</td>
                        <td className="text-nowrap">{member.rank}</td>
                        <td className="text-nowrap">{member.currentVesselName || 'Unassigned'}</td>
                        <td className="text-nowrap">{member.nationality}</td>
                        <td>
                          <StatusBadge value={member.complianceStatus} />
                        </td>
                        {isCrewProvider && (
                          <td className="text-end">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger d-inline-flex align-items-center justify-content-center p-0"
                              style={{ width: '32px', height: '32px' }}
                              title={`Remove ${member.fullName} from group`}
                              aria-label={`Remove ${member.fullName}`}
                              onClick={() => handleRemoveMember(member.id)}
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
