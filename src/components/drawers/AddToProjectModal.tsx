/*
  file summary: modal to link a vessel, crew, or equipment asset into an existing project charter.
  responsibilities: project picker, assurance set dropdown, and addAssetToProject store action.
  role in system: used from VesselDetailView, CrewDetailView, and EquipmentDetailView.
*/

import React, { useMemo, useState } from 'react';
import { useMapStore } from '../../store/useMapStore';
import { ProjectAssetType } from '../../types/project';
import {
  filterProjectsForPersona,
  getEligibleAssuranceSetsForAsset,
  getProjectOrganizationForPersona,
  requiresAssuranceSetForAssetLink,
} from '../../utils/projectHelpers';

interface AddToProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  assetType: ProjectAssetType;
  assetId: string;
  assetName: string;
  providerOrganization: string;
}

export const AddToProjectModal: React.FC<AddToProjectModalProps> = ({
  isOpen,
  onClose,
  assetType,
  assetId,
  assetName,
  providerOrganization,
}) => {
  const {
    projects,
    assuranceSets,
    activePersona,
    users,
    addAssetToProject,
    setCurrentHashView,
  } = useMapStore();

  const visibleProjects = useMemo(
    () => filterProjectsForPersona(projects, activePersona, users),
    [projects, activePersona, users],
  );

  const [selectedProjectId, setSelectedProjectId] = useState(visibleProjects[0]?.id || '');
  const [selectedAssuranceSetId, setSelectedAssuranceSetId] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const selectedProject = visibleProjects.find((p) => p.id === selectedProjectId);
  const effectiveProviderOrg = providerOrganization || getProjectOrganizationForPersona(activePersona, users);

  const eligibleSets = useMemo(
    () =>
      getEligibleAssuranceSetsForAsset(assetType, assetId, assuranceSets, {
        requestingOrganization: selectedProject?.requestingOrganization,
        providerOrganization: effectiveProviderOrg,
      }),
    [assetType, assetId, assuranceSets, selectedProject?.requestingOrganization, effectiveProviderOrg],
  );

  const needsAssuranceSet = selectedProject
    ? requiresAssuranceSetForAssetLink(selectedProject.requestingOrganization, effectiveProviderOrg)
    : true;

  React.useEffect(() => {
    if (!isOpen) return;
    setError('');
    if (visibleProjects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(visibleProjects[0].id);
    }
    if (eligibleSets.length > 0) {
      setSelectedAssuranceSetId(eligibleSets[0].id);
    } else {
      setSelectedAssuranceSetId('');
    }
  }, [isOpen, visibleProjects, eligibleSets, selectedProjectId]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!selectedProjectId) {
      setError('Select a project.');
      return;
    }
    if (needsAssuranceSet && !selectedAssuranceSetId) {
      setError('Cross-organization assets require an assurance set.');
      return;
    }

    const result = addAssetToProject(selectedProjectId, {
      assetType,
      assetId,
      assetName,
      providerOrganization: effectiveProviderOrg,
      assuranceSetId: selectedAssuranceSetId,
      notes: notes.trim() || undefined,
    });

    if (!result.success) {
      setError(result.message || 'Could not add asset to project.');
      return;
    }

    onClose();
    setCurrentHashView('project', selectedProjectId);
  };

  const defaultOrg = getProjectOrganizationForPersona(activePersona, users);

  return (
    <div
      className="modal show d-block map-modal-backdrop"
      tabIndex={-1}
      style={{ zIndex: 1060 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-dialog modal-md modal-dialog-centered">
        <div className="modal-content bg-white text-dark border shadow-lg">
          <div className="modal-header border-bottom bg-light">
            <h5 className="modal-title fw-bold m-0">Add to Project</h5>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
          </div>
          <div className="modal-body p-4">
            <div className="mb-3 p-2 bg-light border rounded small">
              <strong>{assetName}</strong>
              <div className="text-muted">
                {assetType} · {providerOrganization || defaultOrg}
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label small fw-semibold">Project</label>
              <select
                className="form-select form-select-sm"
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
              >
                {visibleProjects.length === 0 ? (
                  <option value="">No projects available — create one first</option>
                ) : (
                  visibleProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.id} — {p.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="mb-3">
              <label className="form-label small fw-semibold">
                Assurance Set{needsAssuranceSet ? ' *' : ' (optional for same-org)'}
              </label>
              <select
                className="form-select form-select-sm"
                value={selectedAssuranceSetId}
                onChange={(e) => setSelectedAssuranceSetId(e.target.value)}
                disabled={eligibleSets.length === 0}
              >
                {eligibleSets.length === 0 ? (
                  <option value="">
                    {needsAssuranceSet
                      ? 'No assurance sets linked to this asset'
                      : 'No assurance sets — optional for same-org asset'}
                  </option>
                ) : (
                  eligibleSets.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.id} — {s.title}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="mb-2">
              <label className="form-label small fw-semibold">Notes (optional)</label>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="e.g. Primary transit vessel"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {error && <div className="alert alert-danger py-2 small mb-0">{error}</div>}
          </div>
          <div className="modal-footer border-top bg-light">
            <button type="button" className="btn btn-sm btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-sm btn-primary fw-semibold"
              disabled={visibleProjects.length === 0 || !selectedAssuranceSetId}
              onClick={handleSubmit}
            >
              Add to Project
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
