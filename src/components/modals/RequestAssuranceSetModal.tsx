import React, { useMemo, useState } from 'react';
import { useMapStore } from '../../store/useMapStore';
import { Project } from '../../types/project';
import {
  getProjectOrganizationForPersona,
  canEditProjectOrganizations,
} from '../../utils/projectHelpers';
import {
  getAssuranceSetRequestRecipients,
  getRequestRosterObjects,
  toSuggestedAsset,
} from '../../utils/assuranceRequestHelpers';
import { getSessionUserForPersona } from '../../utils/userRoleHelpers';
import { Modal } from './Modal';
import { RequestRecipientSelect } from './RequestRecipientSelect';
import { RequestRosterObjectPicker } from './RequestRosterObjectPicker';
import { EditParticipatingOrganizationsModal } from './EditParticipatingOrganizationsModal';

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
  const {
    users,
    activePersona,
    activeDemoOrganization,
    activeSessionUserId,
    requestAssuranceSet,
  } = useMapStore();

  const [isEditPartiesModalOpen, setIsEditPartiesModalOpen] = useState(false);

  const senderOrg = getProjectOrganizationForPersona(
    activePersona,
    users,
    activeDemoOrganization,
  );

  const canEditOrganizations = canEditProjectOrganizations(
    project,
    activePersona,
    senderOrg,
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
    () => getAssuranceSetRequestRecipients(users, project, senderOrg, senderUser?.id),
    [users, project, senderOrg, senderUser],
  );

  const [recipientUserId, setRecipientUserId] = useState('');
  const [selectedObjectIds, setSelectedObjectIds] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const recipient = recipients.find((r) => r.id === recipientUserId);
  const rosterObjects = useMemo(
    () => getRequestRosterObjects(project, recipient?.organization),
    [project, recipient?.organization],
  );

  const chooseRecipient = (userId: string) => {
    setRecipientUserId(userId);
    /* objects belong to the recipient's organization, so a new recipient starts with none */
    setSelectedObjectIds([]);
  };

  const toggleObject = (assetId: string) => {
    setSelectedObjectIds((current) =>
      current.includes(assetId) ? current.filter((id) => id !== assetId) : [...current, assetId],
    );
  };

  const resetAndClose = () => {
    setRecipientUserId('');
    setSelectedObjectIds([]);
    setMessage('');
    setError('');
    onClose();
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

    const suggestedAssets = rosterObjects
      .filter((object) => selectedObjectIds.includes(object.assetId))
      .map(toSuggestedAsset);
    const result = requestAssuranceSet({
      projectId: project.id,
      recipientUserId,
      suggestedAssets: suggestedAssets.length > 0 ? suggestedAssets : undefined,
      message: message.trim() || undefined,
      senderUserId: senderUser.id,
      senderName: senderUser.name,
    });

    if (!result.success) {
      setError(result.message || 'The request could not be sent.');
      return;
    }
    onSuccess(`Assurance set request sent to ${recipient?.name || 'recipient'}.`);
    resetAndClose();
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={resetAndClose}
        title="Request Assurance Set"
        size="md"
        paused={isEditPartiesModalOpen}
        footer={
          <>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={resetAndClose}>
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
          Ask an organization invited to <strong>{project.name}</strong> to create an assurance set for{' '}
          <strong>{senderOrg}</strong>.
        </p>
        {error && <div className="alert alert-danger py-2 small">{error}</div>}
        <RequestRecipientSelect
          recipients={recipients}
          value={recipientUserId}
          onChange={chooseRecipient}
          canEditOrganizations={canEditOrganizations}
          onEditOrganizations={() => setIsEditPartiesModalOpen(true)}
        />
        <RequestRosterObjectPicker
          objects={rosterObjects}
          selectedIds={selectedObjectIds}
          onToggle={toggleObject}
          enabled={Boolean(recipient)}
        />
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

      <EditParticipatingOrganizationsModal
        isOpen={isEditPartiesModalOpen}
        onClose={() => setIsEditPartiesModalOpen(false)}
        project={project}
        zIndex={1080}
      />
    </>
  );
};
