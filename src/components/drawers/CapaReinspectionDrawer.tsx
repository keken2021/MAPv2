/* 
  file summary: interactive vessel capa re-inspection drawer supporting role-scoped read-only governance for c admin and full re-inspection sign-off for inspectors.
  responsibilities: presents capa finding details, role-based status decisions, evidence attachments, camera capture, and c admin re-inspection flagging.
  role in system: drawer overlay rendered in VesselDetailView and CapaManagementView.
*/

import React, { useState, useRef } from 'react';
import { Camera, FileText, Flag, X, Plus } from 'lucide-react';
import { useMapStore } from '../../store/useMapStore';
import { getStatusDisplayLabel } from '../../utils/formatters';
import { CapaItem, CapaStatus, CapaEvidenceItem } from '../../types/capa';

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

  /* live camera modal state */
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedPhotoDataUrl, setCapturedPhotoDataUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  /* inspector save re-inspection endorsement */
  const handleSaveReInspection = () => {
    updateCapaStatus(capa.id, reInspectStatus, reInspectNotes.trim() ? reInspectNotes.trim() : undefined);

    logAuditEvent({
      userId: 'USR-INSPEC-01',
      userRole: activePersona,
      organization: 'Meridian Marine Surveyors',
      action: `Re-Inspected CAPA (${capa.id})`,
      targetAsset: `${capa.vesselName} · ${capa.title}`,
      justificationNotes: `Updated CAPA ${capa.id} status to ${reInspectStatus}. Notes: ${reInspectNotes || 'Endorsed'}`,
    });

    alert(`Saved Re-Inspection status (${reInspectStatus}) for ${capa.id}.`);
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

  /* open live camera video stream modal */
  const openLiveCameraModal = async () => {
    setCapturedPhotoDataUrl(null);
    setIsCameraModalOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      closeCameraModal();
      handleTriggerCameraInput();
    }
  };

  /* take camera snapshot from live stream */
  const takeCameraSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setCapturedPhotoDataUrl(dataUrl);
    }
  };

  /* attach snapshot captured from live stream */
  const attachLiveSnapshot = () => {
    if (!capturedPhotoDataUrl) return;
    const timeStamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newEv: CapaEvidenceItem = {
      id: `EV-${Date.now().toString().slice(-4)}`,
      title: `On-Site Photo (${timeStamp})`,
      type: 'Photo',
      fileName: `capa_photo_${Date.now().toString().slice(-4)}.jpg`,
      fileSize: '1.4 MB',
      previewUrl: capturedPhotoDataUrl,
      uploadedAt: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      uploadedBy: 'Inspector Marcus Vance',
    };

    addCapaEvidence(capa.id, newEv);
    closeCameraModal();
  };

  const closeCameraModal = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
    }
    setCameraStream(null);
    setCapturedPhotoDataUrl(null);
    setIsCameraModalOpen(false);
  };

  return (
    <>
      {/* hidden input triggers for file attachments and native camera capture */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={handleDocumentFileChange}
        accept="image/*,.pdf,.doc,.docx"
      />
      <input
        type="file"
        ref={cameraInputRef}
        className="hidden"
        accept="image/*"
        capture="environment"
        onChange={handleCameraFileChange}
      />

      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40" onClick={onClose} />
      <div
        className="fixed top-0 right-0 h-full w-[92vw] max-w-[850px] bg-white border-l border-slate-200 shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out"
        tabIndex={-1}
      >
        <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between">
          <div>
            <div className="font-mono text-xs uppercase tracking-wider text-slate-400 font-semibold">
              {isInspector ? 'INSPECTOR RE-INSPECTION WORKFLOW' : 'CAPA MONITORING'} · {capa.id}
            </div>
            <h5 className="font-sans text-lg font-bold text-slate-900 mt-0.5">
              {capa.title}
            </h5>
            <div className="font-mono text-xs text-slate-500 mt-0.5">
              Vessel: {capa.vesselName} · Checklist Item: {capa.checklistItemTitle}
            </div>
          </div>
          <button
            type="button"
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 p-5 overflow-y-auto bg-slate-50">
          <div className="flex flex-col gap-4">

            {/* Flagged Alert Banner if C Admin requested re-inspection */}
            {capa.flaggedForReinspection && (
              <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 flex items-start gap-3 text-red-900">
                <Flag size={18} className="text-red-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-sans font-bold text-sm text-red-900">
                    Flagged for Re-Inspection by Client Admin
                  </div>
                  <div className="text-xs text-red-800 mt-1 leading-relaxed">
                    {capa.cadminFlagReason || 'Re-inspection requested by C Admin charterer.'}
                  </div>
                  {capa.flaggedByCAdminDate && (
                    <div className="font-mono text-xs text-red-600 mt-1.5">
                      Flagged: {capa.flaggedByCAdminDate}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Initial Finding Summary Box */}
            <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-xs">
              <div className="font-sans font-semibold text-sm text-slate-800 mb-1">Original Finding:</div>
              <div className="text-sm text-slate-600 mb-3 leading-relaxed">
                {capa.findingDescription}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 text-xs text-slate-500">
                <span>Owner: <strong className="text-slate-800">{capa.owner}</strong></span>
                <span>Due Date: <span className="font-mono font-bold text-slate-800">{capa.dueDate}</span></span>
              </div>
            </div>

            {/* Inspector Status Evaluation Selector (Editable for Inspector, Read-only for C Admin) */}
            <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-2.5">
                <label className="font-sans font-semibold text-sm text-slate-800">
                  Re-Inspection Status
                </label>
              </div>

              {isInspector ? (
                <div className="flex flex-wrap gap-2 mb-4">
                  {(['Open', 'Under Re-Inspection', 'Verified & Closed', 'Rectification Required'] as CapaStatus[]).map((statusChoice) => {
                    const isSelected = reInspectStatus === statusChoice;
                    return (
                      <button
                        key={statusChoice}
                        type="button"
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                          isSelected
                            ? statusChoice === 'Verified & Closed'
                              ? 'bg-emerald-600 text-white font-semibold'
                              : 'bg-[rgb(11,27,43)] text-white font-semibold'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                        }`}
                        onClick={() => setReInspectStatus(statusChoice)}
                      >
                        {getStatusDisplayLabel(statusChoice)}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="mb-4">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-mono font-semibold ${
                      capa.status === 'Verified & Closed'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : capa.status === 'Under Re-Inspection'
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-red-100 text-red-800 border border-red-200'
                    }`}
                  >
                    {getStatusDisplayLabel(capa.status)}
                  </span>
                </div>
              )}

              {/* Re-inspection notes text area (Editable for Inspector, Read-only for C Admin) */}
              <div>
                <label className="block font-sans font-semibold text-xs text-slate-700 mb-1.5">
                  Re-Inspection Notes
                </label>
                {isInspector ? (
                  <textarea
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[rgb(56,189,248)] focus:border-[rgb(56,189,248)]"
                    rows={3}
                    placeholder="What you found on re-inspection"
                    value={reInspectNotes}
                    onChange={(e) => setReInspectNotes(e.target.value)}
                  />
                ) : (
                  <div className="p-3 rounded-md bg-slate-50 border border-slate-200 text-slate-600 text-sm leading-relaxed">
                    {capa.inspectorNotes || 'No inspector verification notes recorded yet.'}
                  </div>
                )}
              </div>
            </div>

            {/* Supporting Evidence List & Camera Capture Section */}
            <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2.5">
                <div>
                  <h6 className="font-sans font-bold text-sm text-slate-800">
                    Evidence
                  </h6>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {isInspector ? 'Attach real-life photos or documents endorsing CAPA status' : 'Inspect evidence photos and documents uploaded by inspector'}
                  </div>
                </div>

                {/* Hide Upload & Camera buttons for C Admin */}
                {isInspector && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="px-2.5 py-1.5 rounded-md text-xs font-medium border border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 transition-colors"
                      onClick={openLiveCameraModal}
                    >
                      <Camera size={14} className="text-slate-600" />
                      <span>Take Photo</span>
                    </button>

                    <button
                      type="button"
                      className="px-2.5 py-1.5 rounded-md text-xs font-medium border border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 transition-colors"
                      onClick={handleTriggerFileInput}
                    >
                      <Plus size={14} className="text-slate-600" />
                      <span>Attach File</span>
                    </button>
                  </div>
                )}
              </div>

              {/* List of Evidence Items */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {capa.evidences.map((ev) => (
                  <div key={ev.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 flex items-start gap-3 relative group">
                    {ev.previewUrl ? (
                      <img src={ev.previewUrl} alt={ev.title} className="w-12 h-12 rounded object-cover border border-slate-200 shrink-0" />
                    ) : (
                      <div
                        className={`w-12 h-12 rounded flex items-center justify-center shrink-0 border ${
                          ev.type === 'Photo' ? 'bg-sky-50 border-sky-200 text-sky-600' : 'bg-slate-100 border-slate-200 text-slate-600'
                        }`}
                      >
                        {ev.type === 'Photo' ? (
                          <Camera size={20} />
                        ) : (
                          <FileText size={20} />
                        )}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded font-mono text-[10px] font-semibold uppercase tracking-wider mb-1 ${
                          ev.type === 'Photo' ? 'bg-sky-100 text-sky-700' : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {ev.type}
                      </span>
                      <div className="font-sans font-medium text-xs text-slate-900 truncate">
                        {ev.title}
                      </div>
                      <div className="font-mono text-[11px] text-slate-500 truncate mt-0.5">
                        {ev.fileName || ev.title}
                      </div>
                    </div>

                    {/* Remove button ONLY for Inspector */}
                    {isInspector && (
                      <button
                        type="button"
                        className="text-slate-400 hover:text-red-500 p-1 rounded transition-colors"
                        aria-label="Remove"
                        onClick={() => removeCapaEvidence(capa.id, ev.id)}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}

                {capa.evidences.length === 0 && (
                  <div className="col-span-2 text-slate-400 text-xs italic py-3 text-center">
                    No evidence attached.
                  </div>
                )}
              </div>
            </div>

            {/* Action Footer: Endorse for Inspector vs Flag for Admin */}
            {isInspector ? (
              <button
                type="button"
                className="w-full py-2.5 rounded-md font-sans font-semibold text-sm bg-amber-500 hover:bg-amber-600 text-white shadow-sm transition-colors cursor-pointer"
                onClick={handleSaveReInspection}
              >
                Save
              </button>
            ) : isAdminPersona ? (
              <div className="p-4 bg-white rounded-lg border border-sky-200 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <h6 className="font-sans font-bold text-sm text-[rgb(11,27,43)]">
                    Mark CAPA as Addressed
                  </h6>
                  {flagSuccessToast && (
                    <span className="px-2 py-0.5 bg-emerald-600 text-white text-xs font-mono rounded">
                      Marked as addressed. Inspector notified.
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-600 mb-3 leading-relaxed">
                  Mark this CAPA as addressed to notify the inspector for re-inspection.
                </div>
                <textarea
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[rgb(56,189,248)] focus:border-[rgb(56,189,248)] mb-3"
                  rows={2}
                  placeholder="How this finding was addressed"
                  value={cAdminReason}
                  onChange={(e) => setCAdminReason(e.target.value)}
                />
                <button
                  type="button"
                  className="w-full py-2 rounded-md font-sans font-semibold text-sm text-white bg-[rgb(2,132,199)] hover:bg-[rgb(3,105,161)] transition-colors cursor-pointer"
                  onClick={handleFlagForReinspection}
                >
                  {capa.flaggedForReinspection ? 'Update Addressed Notes & Notify Inspector' : 'Flag CAPA as Addressed (Notify Inspector)'}
                </button>
              </div>
            ) : null}

          </div>
        </div>
      </div>

      {/* Camera Live Stream Snapshot Modal */}
      {isCameraModalOpen && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl p-4 w-full max-w-lg">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h6 className="font-sans font-bold text-base text-slate-900">Take Photo</h6>
              <button
                type="button"
                className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
                onClick={closeCameraModal}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col items-center gap-4">
              {!capturedPhotoDataUrl ? (
                <>
                  <video ref={videoRef} autoPlay playsInline className="w-full h-64 bg-black rounded-lg object-cover" />
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="flex justify-center flex-wrap gap-2 w-full">
                    <button
                      type="button"
                      className="px-3.5 py-2 text-sm font-medium border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 transition-colors"
                      onClick={closeCameraModal}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="px-3.5 py-2 text-sm font-medium border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 transition-colors"
                      onClick={() => {
                        closeCameraModal();
                        handleTriggerCameraInput();
                      }}
                    >
                      Use Camera
                    </button>
                    <button
                      type="button"
                      className="px-4 py-2 text-sm font-medium rounded-md text-white bg-[rgb(11,27,43)] hover:bg-[rgb(30,58,95)] transition-colors"
                      onClick={takeCameraSnapshot}
                    >
                      Take Photo
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <img src={capturedPhotoDataUrl} alt="Captured preview" className="w-full h-64 bg-black rounded-lg object-cover" />
                  <div className="flex justify-center gap-2 w-full">
                    <button
                      type="button"
                      className="px-3.5 py-2 text-sm font-medium border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 transition-colors"
                      onClick={() => setCapturedPhotoDataUrl(null)}
                    >
                      Retake
                    </button>
                    <button
                      type="button"
                      className="px-4 py-2 text-sm font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
                      onClick={attachLiveSnapshot}
                    >
                      Attach Photo
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
