/*
  file summary: modal for Client/Vessel Admin to request a colleague create an assurance set for a project.
  responsibilities: recipient picker, optional scope and message, dispatches in-app notification.
  role in system: opened from ProjectDetailView.
*/

import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useMapStore } from '../../store/useMapStore';
import { Project, ProjectAssetType } from '../../types/project';
import {
  getAssuranceSetCreatorsInOrganization,
  getProjectOrganizationForPersona,
} from '../../utils/projectHelpers';

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
  const { users, activePersona, requestAssuranceSet } = useMapStore();
  const senderOrg = getProjectOrganizationForPersona(activePersona, users);
  const senderUser = useMemo(
    () =>
      users.find(
        (u) =>
          u.status === 'Active' &&
          u.roles.includes(activePersona) &&
          u.organization === senderOrg,
      ) || users.find((u) => u.roles.includes(activePersona)),
    [users, activePersona, senderOrg],
  );

  const recipients = useMemo(
    () =>
      getAssuranceSetCreatorsInOrganization(users, senderOrg).filter(
        (u) => u.id !== senderUser?.id,
      ),
    [users, senderOrg, senderUser],
  );

  const [recipientUserId, setRecipientUserId] = useState('');
  const [suggestedScope, setSuggestedScope] = useState<'' | ProjectAssetType>('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!recipientUserId) {
      setError('Select a recipient.');
      return;
    }
    if (!senderUser) {
      setError('Could not resolve sender profile.');
      return;
    }

    const result = requestAssuranceSet({
      projectId: project.id,
      recipientUserId,
      suggestedScope: suggestedScope || undefined,
      message: message.trim() || undefined,
      senderUserId: senderUser.id,
      senderName: senderUser.name,
    });

    if (result.success) {
      onSuccess(`Assurance set request sent to ${recipients.find((r) => r.id === recipientUserId)?.name || 'recipient'}.`);
      setRecipientUserId('');
      setSuggestedScope('');
      setMessage('');
      setError('');
      onClose();
    } else {
      setError(result.message || 'Failed to send request.');
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
                <option value="">Select recipient…</option>
                {recipients.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} — {u.roles.join(', ')}
                  </option>
                ))}
              </select>
              {recipients.length === 0 && (
                <div className="text-muted small mt-1">
                  No eligible assurance set creators found in your organization.
                </div>
              )}
            </div>
            <div className="mb-3">
              <label className="form-label small fw-semibold">Suggested scope (optional)</label>
              <select
                className="form-select form-select-sm"
                value={suggestedScope}
                onChange={(e) => setSuggestedScope(e.target.value as '' | ProjectAssetType)}
              >
                <option value="">No preference</option>
                <option value="Vessel">Vessel</option>
                <option value="Equipment">Equipment</option>
                <option value="Crew">Crew</option>
              </select>
            </div>
            <div className="mb-0">
              <label className="form-label small fw-semibold">Message (optional)</label>
              <textarea
                className="form-control form-control-sm"
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="e.g. Please create a vessel assurance set for the platform supply campaign."
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
