import React, { useMemo, useState } from 'react';
import { useMapStore } from '../../store/useMapStore';
import { Project, ProjectAssetType } from '../../types/project';
import {
  getAssuranceSetRequestRecipients,
  getProjectOrganizationForPersona,
} from '../../utils/projectHelpers';
import { getSessionUserForPersona } from '../../utils/userRoleHelpers';
import { ScopeChecklist } from '../common/ScopeChecklist';
import { Modal } from './Modal';

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
      getAssuranceSetRequestRecipients(
        users,
        senderOrg,
        project.invitedOrganizations,
        senderUser?.id,
      ),
    [users, senderOrg, senderUser, project.invitedOrganizations],
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Request Assurance Set"
      size="md"
      footer={
        <>
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
        </>
      }
    >
      <p className="text-muted small mb-2">
        Ask an organization invited to <strong>{project.name}</strong> to create an assurance set for <strong>{senderOrg}</strong>.
      </p>
      <div className="mb-3 p-2 bg-light rounded border small" data-testid="requesting-party-banner">
        <div className="text-secondary" style={{ fontSize: '0.725rem' }}>Requesting party</div>
        <div className="fw-semibold text-dark">{senderOrg}</div>
      </div>
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
              {u.name} — {u.organization} — Responding party
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
    </Modal>
  );
};
