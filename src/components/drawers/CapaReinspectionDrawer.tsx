/* 
  file summary: interactive vessel capa re-inspection drawer supporting role-scoped read-only governance for c admin and full re-inspection sign-off for inspectors.
  responsibilities: presents capa finding details, role-based status decisions, evidence attachments, camera capture, and c admin re-inspection flagging.
  role in system: drawer overlay rendered in VesselDetailView and CapaManagementView.
*/

import React, { useState, useRef } from 'react';
import { Camera, FileText, Flag, Plus, X } from 'lucide-react';
import { useMapStore } from '../../store/useMapStore';
import { getStatusDisplayLabel } from '../../utils/formatters';
import { CapaItem, CapaStatus, CapaEvidenceItem } from '../../types/capa';
import { Drawer } from './Drawer';
import { CameraCaptureModal } from '../modals/CameraCaptureModal';

interface CapaReinspectionDrawerProps {
  capa: CapaItem;
  onClose: () => void;
}

/**
  what: renders interactive capa re-inspection drawer for inspectors (editable) and c admins (read-only with flag action).
  how: checks activePersona context; inspectors can edit status, notes, evidence & endorse; c admins get read-only view with flag for re-inspection workflow.
  with what file: src/components/drawers/CapaReinspectionDrawer.tsx loaded by VesselDetailView.tsx and CapaManagementView.tsx.
*/
export const CapaReinspectionDrawer: React.FC<CapaReinspectionDrawerProps> = ({ capa, onClose }) => {
  const {
    activePersona,
    updateCapaStatus,
    addCapaEvidence,
    removeCapaEvidence,
    flagCapaForReinspection,
    logAuditEvent,
  } = useMapStore();

  const isInspector = activePersona === 'Inspector';
  const isAdminPersona = activePersona === 'C Admin' || activePersona === 'Administrator';

  /* local state for inspector edit controls */
  const [reInspectStatus, setReInspectStatus] = useState<CapaStatus>(capa.status);
  const [reInspectNotes, setReInspectNotes] = useState(capa.inspectorNotes || '');

  /* local state for admin flag workflow */
  const [cAdminReason, setCAdminReason] = useState(capa.cadminFlagReason || '');
  const [flagSuccessToast, setFlagSuccessToast] = useState(false);

  /* photo & file upload input refs */
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);

  /* inspector save re-inspection endorsement */
  const handleSaveReInspection = () => {
    updateCapaStatus(capa.id, reInspectStatus, reInspectNotes.trim() ? reInspectNotes.trim() : undefined);

    logAuditEvent({
      action: `Re-Inspected CAPA (${capa.id})`,
      targetAsset: `${capa.vesselName} · ${capa.title}`,
      justificationNotes: `Updated CAPA ${capa.id} status to ${reInspectStatus}. Notes: ${reInspectNotes || 'Endorsed'}`,
    });

    onClose();
  };

  /* admin flag for re-inspection handler */
  const handleFlagForReinspection = () => {
    flagCapaForReinspection(capa.id, cAdminReason);
    setFlagSuccessToast(true);
    setTimeout(() => setFlagSuccessToast(false), 3000);
  };

  /* trigger native mobile camera input */
  const handleTriggerCameraInput = () => {
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
      cameraInputRef.current.click();
    }
  };

  /* process camera photo upload */
  const handleCameraFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const timeStamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const newEv: CapaEvidenceItem = {
        id: `EV-${Date.now().toString().slice(-4)}`,
        title: `Re-Inspection Photo (${timeStamp})`,
        type: 'Photo',
        fileName: file.name || `capa_photo_${Date.now()}.jpg`,
        fileSize: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        previewUrl: dataUrl,
        uploadedAt: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        uploadedBy: activePersona === 'Inspector' ? 'Inspector Marcus Vance' : 'User Operations',
      };

      addCapaEvidence(capa.id, newEv);
      e.target.value = '';
    };
    reader.readAsDataURL(file);
  };

  /* trigger general document file upload input */
  const handleTriggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleDocumentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(file.name);
    const newEv: CapaEvidenceItem = {
      id: `EV-${Date.now().toString().slice(-4)}`,
      title: file.name.replace(/\.[^/.]+$/, ''),
      type: isImage ? 'Photo' : 'Document',
      fileName: file.name,
      fileSize: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
      uploadedAt: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      uploadedBy: activePersona === 'Inspector' ? 'Inspector Marcus Vance' : 'User Operations',
    };

    addCapaEvidence(capa.id, newEv);
    e.target.value = '';
  };

  const openLiveCameraModal = () => setIsCameraModalOpen(true);

  /* attach captured photo from camera modal */
  const handleCameraCapture = (dataUrl: string) => {
    const timeStamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newEv: CapaEvidenceItem = {
      id: `EV-${Date.now().toString().slice(-4)}`,
      title: `On-Site Photo (${timeStamp})`,
      type: 'Photo',
      fileName: `capa_photo_${Date.now().toString().slice(-4)}.jpg`,
      fileSize: '1.4 MB',
      previewUrl: dataUrl,
      uploadedAt: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      uploadedBy: 'Inspector Marcus Vance',
    };
    addCapaEvidence(capa.id, newEv);
    setIsCameraModalOpen(false);
  };

  return (
    <>
      {/* hidden input triggers for file attachments and native camera capture */}
      <input
        type="file"
        ref={fileInputRef}
        className="d-none"
        onChange={handleDocumentFileChange}
        accept="image/*,.pdf,.doc,.docx"
      />
      <input
        type="file"
        ref={cameraInputRef}
        className="d-none"
        accept="image/*"
        capture="environment"
        onChange={handleCameraFileChange}
      />

      <Drawer
        title={capa.title}
        meta={`${capa.id} · ${capa.vesselName} · ${capa.checklistItemTitle}`}
        size="lg"
        onClose={onClose}
        footer={
          isInspector ? (
            <>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSaveReInspection}>
                Save
              </button>
            </>
          ) : isAdminPersona ? (
            <>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Close
              </button>
              <button type="button" className="btn btn-primary" onClick={handleFlagForReinspection}>
                {capa.flaggedForReinspection ? 'Update Notes' : 'Mark as Addressed'}
              </button>
            </>
          ) : undefined
        }
      >
        <div className="map-drawer-stack">
          {/* Flagged Alert Banner if C Admin requested re-inspection */}
          {capa.flaggedForReinspection && (
            <div className="alert alert-danger d-flex align-items-start gap-3 mb-0">
              <Flag size={18} className="flex-shrink-0 mt-1" />
              <div>
                <div className="fw-bold">Flagged for Re-Inspection by Client Admin</div>
                <div className="small mt-1">
                  {capa.cadminFlagReason || 'Re-inspection requested by C Admin charterer.'}
                </div>
                {capa.flaggedByCAdminDate && (
                  <div className="font-mono-code small mt-1">Flagged: {capa.flaggedByCAdminDate}</div>
                )}
              </div>
            </div>
          )}

          {/* Initial Finding Summary Box */}
          <div className="map-drawer-card">
            <h3 className="map-drawer-section-title">Original Finding</h3>
            <div className="mb-3" style={{ fontSize: '0.875rem' }}>
              {capa.findingDescription}
            </div>
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 pt-3 border-top small text-secondary">
              <span>Owner: <strong className="text-dark">{capa.owner}</strong></span>
              <span>Due Date: <span className="font-mono-code fw-bold text-dark">{capa.dueDate}</span></span>
            </div>
          </div>

          {/* Inspector Status Evaluation Selector (Editable for Inspector, Read-only for C Admin) */}
          <div className="map-drawer-card">
            <h3 className="map-drawer-section-title">Re-Inspection Status</h3>

            {isInspector ? (
              <div className="d-flex flex-wrap gap-2 mb-3" role="group" aria-label="Re-Inspection Status">
                {(['Open', 'Under Re-Inspection', 'Verified & Closed', 'Rectification Required'] as CapaStatus[]).map((statusChoice) => {
                  const isSelected = reInspectStatus === statusChoice;
                  return (
                    <button
                      key={statusChoice}
                      type="button"
                      className={`map-drawer-choice ${isSelected ? 'is-selected' : ''}`}
                      aria-pressed={isSelected}
                      onClick={() => setReInspectStatus(statusChoice)}
                    >
                      {getStatusDisplayLabel(statusChoice)}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mb-3">
                <span
                  className={`badge rounded-pill font-mono-code border ${
                    capa.status === 'Verified & Closed'
                      ? 'bg-success-subtle text-success-emphasis border-success-subtle'
                      : capa.status === 'Under Re-Inspection'
                      ? 'bg-warning-subtle text-warning-emphasis border-warning-subtle'
                      : 'bg-danger-subtle text-danger-emphasis border-danger-subtle'
                  }`}
                  style={{ fontSize: '0.75rem' }}
                >
                  {getStatusDisplayLabel(capa.status)}
                </span>
              </div>
            )}

            {/* Re-inspection notes text area (Editable for Inspector, Read-only for C Admin) */}
            {isInspector ? (
              <>
                <label className="map-drawer-label" htmlFor="capa-reinspection-notes">
                  Re-Inspection Notes
                </label>
                <textarea
                  id="capa-reinspection-notes"
                  className="form-control bg-white text-dark"
                  rows={3}
                  placeholder="What you found on re-inspection"
                  value={reInspectNotes}
                  onChange={(e) => setReInspectNotes(e.target.value)}
                />
              </>
            ) : (
              <>
                <div className="map-drawer-label">Re-Inspection Notes</div>
                <div className="map-drawer-inset">
                  {capa.inspectorNotes || 'No inspector verification notes recorded yet.'}
                </div>
              </>
            )}
          </div>

          {/* Supporting Evidence List & Camera Capture Section */}
          <div className="map-drawer-card">
            <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-3">
              <div>
                <h3 className="map-drawer-section-title mb-1">Evidence</h3>
                <div className="small text-secondary">
                  {isInspector ? 'Attach real-life photos or documents endorsing CAPA status' : 'Inspect evidence photos and documents uploaded by inspector'}
                </div>
              </div>

              {/* Hide Upload & Camera buttons for C Admin */}
              {isInspector && (
                <div className="d-flex align-items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
                    onClick={openLiveCameraModal}
                  >
                    <Camera size={14} />
                    <span>Take Photo</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
                    onClick={handleTriggerFileInput}
                  >
                    <Plus size={14} />
                    <span>Attach File</span>
                  </button>
                </div>
              )}
            </div>

            {/* List of Evidence Items */}
            <div className="row g-3">
              {capa.evidences.map((ev) => (
                <div key={ev.id} className="col-sm-6">
                  <div className="map-drawer-inset d-flex align-items-start gap-3 h-100">
                    {ev.previewUrl ? (
                      <img
                        src={ev.previewUrl}
                        alt={ev.title}
                        className="rounded border flex-shrink-0"
                        style={{ width: '48px', height: '48px', objectFit: 'cover' }}
                      />
                    ) : (
                      <div
                        className="rounded border bg-white text-secondary d-flex align-items-center justify-content-center flex-shrink-0"
                        style={{ width: '48px', height: '48px' }}
                      >
                        {ev.type === 'Photo' ? (
                          <Camera size={20} />
                        ) : (
                          <FileText size={20} />
                        )}
                      </div>
                    )}

                    <div className="flex-grow-1" style={{ minWidth: 0 }}>
                      <span
                        className={`badge font-mono-code text-uppercase mb-1 ${
                          ev.type === 'Photo' ? 'bg-info-subtle text-info-emphasis' : 'bg-secondary-subtle text-secondary-emphasis'
                        }`}
                        style={{ fontSize: '0.75rem' }}
                      >
                        {ev.type}
                      </span>
                      <div className="fw-medium text-dark text-truncate">{ev.title}</div>
                      <div className="font-mono-code text-secondary text-truncate" style={{ fontSize: '0.75rem' }}>
                        {ev.fileName || ev.title}
                      </div>
                    </div>

                    {/* Remove button ONLY for Inspector */}
                    {isInspector && (
                      <button
                        type="button"
                        className="map-drawer-close"
                        aria-label="Remove"
                        onClick={() => removeCapaEvidence(capa.id, ev.id)}
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {capa.evidences.length === 0 && (
                <div className="col-12 text-secondary small fst-italic text-center py-3">
                  No evidence attached.
                </div>
              )}
            </div>
          </div>

          {/* Client Admin and Administrator: notes for marking the CAPA as addressed; the action is in the drawer footer */}
          {!isInspector && isAdminPersona && (
            <div className="map-drawer-card">
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
                <h3 className="map-drawer-section-title mb-0">Mark CAPA as Addressed</h3>
                {flagSuccessToast && (
                  <span className="badge bg-success font-mono-code" style={{ fontSize: '0.75rem' }}>
                    Marked as addressed. Inspector notified.
                  </span>
                )}
              </div>
              <label className="map-drawer-label" htmlFor="capa-addressed-notes">
                Mark this CAPA as addressed to notify the inspector for re-inspection.
              </label>
              <textarea
                id="capa-addressed-notes"
                className="form-control bg-white text-dark"
                rows={2}
                placeholder="How this finding was addressed"
                value={cAdminReason}
                onChange={(e) => setCAdminReason(e.target.value)}
              />
            </div>
          )}
        </div>
      </Drawer>

      <CameraCaptureModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onCapture={handleCameraCapture}
        onUseCameraInput={() => { setIsCameraModalOpen(false); handleTriggerCameraInput(); }}
      />
    </>
  );
};
