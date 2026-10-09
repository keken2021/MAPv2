/*
  file summary: modal for Client/Vessel Admin to request a colleague create an assurance set for a project.
  responsibilities: recipient picker, optional multi-select suggested scope, optional message, dispatches in-app notification.
  role in system: opened from ProjectDetailView.
*/

import React, { useMemo, useState } from 'react';
import { useMapStore } from '../../store/useMapStore';
import { Project, ProjectAssetType } from '../../types/project';
import {
  getAssuranceSetCreatorsInOrganization,
  getProjectOrganizationForPersona,
} from '../../utils/projectHelpers';
import { formatUserRoles, getSessionUserForPersona } from '../../utils/userRoleHelpers';
import { ScopeChecklist } from '../common/ScopeChecklist';

const SCOPE_OPTIONS: ProjectAssetType[] = ['Vessel', 'Equipment', 'Crew'];

interface RequestAssuranceSetModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  onSuccess: (message: string) => void;
}

export const RequestAssuranceSetModal: React.FC<RequestAssuranceSetModalProps> = ({
  isOpen,
  onClose,
  project,
  onSuccess,
}) => {
  const { users, activePersona, activeDemoOrganization, activeSessionUserId, requestAssuranceSet } =
    useMapStore();
  const senderOrg = getProjectOrganizationForPersona(
    activePersona,
    users,
    activeDemoOrganization,
  );
  const senderUser = useMemo(
    () =>
      getSessionUserForPersona(activePersona, users, {
        organization: activeDemoOrganization,
        sessionUserId: activeSessionUserId,
      }),
    [users, activePersona, activeDemoOrganization, activeSessionUserId],
  );

  const recipients = useMemo(
    () =>
      getAssuranceSetCreatorsInOrganization(users, senderOrg).filter(
        (u) => u.id !== senderUser?.id,
      ),
    [users, senderOrg, senderUser],
  );

  const [recipientUserId, setRecipientUserId] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<ProjectAssetType[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const toggleScope = (scope: ProjectAssetType) => {
    setSelectedScopes((current) =>
      current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope],
    );
  };

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!recipientUserId) {
      setError('Select a recipient.');
      return;
    }
    if (!senderUser) {
      setError('Your user profile could not be found.');
      return;
    }

    const result = requestAssuranceSet({
      projectId: project.id,
      recipientUserId,
      suggestedScopes: selectedScopes.length > 0 ? selectedScopes : undefined,
      message: message.trim() || undefined,
      senderUserId: senderUser.id,
      senderName: senderUser.name,
    });

    if (result.success) {
      onSuccess(`Assurance set request sent to ${recipients.find((r) => r.id === recipientUserId)?.name || 'recipient'}.`);
      setRecipientUserId('');
      setSelectedScopes([]);
      setMessage('');
      setError('');
      onClose();
    } else {
      setError(result.message || 'The request could not be sent.');
    }
  };

  return (
    <div
      className="modal show d-block map-modal-backdrop"
      tabIndex={-1}
      role="dialog"
      style={{ zIndex: 1060 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-dialog modal-dialog-centered" role="document">
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h5 className="modal-title fw-bold">Request Assurance Set</h5>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
          </div>
          <div className="modal-body">
            <p className="text-muted small mb-3">
              Ask a colleague in <strong>{senderOrg}</strong> to create an assurance set for{' '}
              <strong>{project.name}</strong>.
            </p>
            {error && <div className="alert alert-danger py-2 small">{error}</div>}
            <div className="mb-3">
              <label className="form-label small fw-semibold">
                Recipient <span className="text-danger">*</span>
              </label>
              <select
                className="form-select form-select-sm"
                value={recipientUserId}
                onChange={(e) => setRecipientUserId(e.target.value)}
              >
                <option value="">Select recipient</option>
                {recipients.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} — {formatUserRoles(u.roles)}
                  </option>
                ))}
              </select>
              {recipients.length === 0 && (
                <div className="text-muted small mt-1">
                  No one in your organization can create assurance sets.
                </div>
              )}
            </div>
            <div className="mb-3">
              <label className="form-label small fw-semibold" id="request-suggested-scope-label">
                Scope (optional)
              </label>
              <ScopeChecklist
                id="request-suggested-scope"
                labelId="request-suggested-scope-label"
                className="form-select-sm"
                options={SCOPE_OPTIONS}
                selected={selectedScopes}
                onToggle={toggleScope}
                emptyLabel="No preference"
              />
              <div className="text-muted small mt-1">
                Choose one or more, or leave as no preference.
              </div>
            </div>
            <div className="mb-0">
              <label className="form-label small fw-semibold">Message (optional)</label>
              <textarea
                className="form-control form-control-sm"
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="e.g. Please create a vessel assurance set for the platform supply charter."
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={handleSubmit}
              disabled={!recipientUserId}
            >
              Send Request
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
