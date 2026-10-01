/* 
  file summary: streamlined physical vessel inspection checklist modal drawer with zero-friction workflow.
  responsibilities: presents split-screen visual survey checklist, one-click file upload attachment, inline finding comments, direct CAPA creation per item, and smart inspection outcome submission.
  role in system: used by inspector workspace view.
*/

import React, { useState, useRef } from 'react';
import { useMapStore } from '../../store/useMapStore';
import { Camera, FileText } from 'lucide-react';

interface EvidenceItem {
  id: string;
  title: string;
  type: 'Photo' | 'Document';
  fileName?: string;
  fileSize?: string;
  previewUrl?: string;
}

interface InspectionItem {
  id: string;
  title: string;
  subtitle: string;
  status: 'Satisfactory' | 'Observation' | 'Deficiency';
  findingNotes?: string;
  capaCode?: string;
  evidences: EvidenceItem[];
}

interface CapaActionItem {
  id: string;
  title: string;
  owner: string;
  dueDate: string;
  status: 'Open' | 'Closed';
}

interface InspectionDrawerProps {
  vesselName: string;
  onClose: () => void;
}

/**
  what: renders visual vessel inspection split-screen modal drawer with frictionless workflow.
  how: manages local state for 5 inspection items with direct evidence uploads, real-time camera photo capture, automatic status-finding triggers, and smart inspection outcome recommendations.
  with what file: src/components/drawers/InspectionDrawer.tsx loaded by InspectorWorkspaceView.tsx.
*/
export const InspectionDrawer: React.FC<InspectionDrawerProps> = ({ vesselName, onClose }) => {
  const { logAuditEvent, activePersona } = useMapStore();

  const [items, setItems] = useState<InspectionItem[]>([
    {
      id: 'INS-01',
      title: 'Life-saving appliances — stowage and condition',
      subtitle: 'SOLAS III · LSA record',
      status: 'Satisfactory',
      evidences: [
        { id: 'EV-101', title: 'LSA locker photo', type: 'Photo', fileName: 'lsa_locker_01.jpg', fileSize: '2.4 MB' },
      ],
    },
    {
      id: 'INS-02',
      title: 'Fire-fighting equipment and fixed systems',
      subtitle: 'SOLAS II-2 · FFE plan',
      status: 'Satisfactory',
      evidences: [
        { id: 'EV-102', title: 'FFE station 3 tag', type: 'Photo', fileName: 'ffe_station3.jpg', fileSize: '1.8 MB' },
      ],
    },
    {
      id: 'INS-03',
      title: 'Liferaft hydrostatic release units',
      subtitle: 'Service due check',
      status: 'Observation',
      findingNotes: 'Port-side liferaft HRU service date exceeded by 3 weeks. Replacement unit on order; corrective action CAPA-118 raised.',
      capaCode: 'CAPA-118',
      evidences: [
        { id: 'EV-103', title: 'Liferaft HRU tag', type: 'Photo', fileName: 'hru_tag_port.jpg', fileSize: '3.1 MB' },
        { id: 'EV-104', title: 'Service cert scan', type: 'Document', fileName: 'hru_cert_2026.pdf', fileSize: '450 KB' },
      ],
    },
    {
      id: 'INS-04',
      title: 'Deck cargo securing arrangements',
      subtitle: 'Cargo securing manual',
      status: 'Satisfactory',
      evidences: [
        { id: 'EV-105', title: 'Deck securing photo', type: 'Photo', fileName: 'deck_securing_aft.jpg', fileSize: '2.9 MB' },
      ],
    },
    {
      id: 'INS-05',
      title: 'Crew familiarity — muster and abandon ship',
      subtitle: 'ISM · drill records',
      status: 'Satisfactory',
      evidences: [
        { id: 'EV-106', title: 'Muster drill log sheet', type: 'Document', fileName: 'muster_log_sep2026.pdf', fileSize: '620 KB' },
      ],
    },
  ]);

  const [selectedResult, setSelectedResult] = useState<'Pass' | 'Pass with observations' | 'Fail'>('Pass with observations');

  /* state for corrective actions */
  const [capaActions, setCapaActions] = useState<CapaActionItem[]>([
    {
      id: 'CAPA-118',
      title: 'Replace port liferaft HRU',
      owner: 'Northwind Technical Services',
      dueDate: '30 Sep 2026',
      status: 'Open',
    },
    {
      id: 'CAPA-114',
      title: 'Update cargo securing manual revision',
      owner: 'Northwind Marine',
      dueDate: '12 Sep 2026',
      status: 'Closed',
    },
  ]);

  /* active item state for inline comment editor */
  const [editingCommentItemId, setEditingCommentItemId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');

  /* active item state for raising capa */
  const [raisingCapaItemId, setRaisingCapaItemId] = useState<string | null>(null);
  const [itemCapaTitle, setItemCapaTitle] = useState('');
  const [itemCapaOwner, setItemCapaOwner] = useState('');

  /* active item for direct file input trigger */
  const [activeUploadItemId, setActiveUploadItemId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  /* photo capture refs & state */
  const [activePhotoItemId, setActivePhotoItemId] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedPhotoDataUrl, setCapturedPhotoDataUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /* state for general new capa form */
  const [showAddCapa, setShowAddCapa] = useState(false);
  const [newCapaTitle, setNewCapaTitle] = useState('');
  const [newCapaOwner, setNewCapaOwner] = useState('');
  const [newCapaDueDate, setNewCapaDueDate] = useState('');

  /* status change automatically prompts for notes when observation or deficiency is set */
  const handleStatusChange = (id: string, newStatus: 'Satisfactory' | 'Observation' | 'Deficiency') => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updated = { ...item, status: newStatus };
          if (newStatus !== 'Satisfactory' && !item.findingNotes) {
            setEditingCommentItemId(id);
            setCommentText('');
          }
          return updated;
        }
        return item;
      })
    );
  };

  /* one-click file upload handler */
  const triggerDirectUpload = (itemId: string) => {
    setActiveUploadItemId(itemId);
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  /* trigger native camera input on mobile */
  const handleTriggerCameraCapture = (itemId: string) => {
    setActivePhotoItemId(itemId);
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
      cameraInputRef.current.click();
    }
  };

  /* handle file captured from camera input */
  const handleCameraFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activePhotoItemId) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const timeStamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const newEv: EvidenceItem = {
        id: `EV-${Date.now().toString().slice(-4)}`,
        title: `Real-time Photo (${timeStamp})`,
        type: 'Photo',
        fileName: file.name || `photo_${Date.now()}.jpg`,
        fileSize: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        previewUrl: dataUrl,
      };

      setItems((prev) =>
        prev.map((item) =>
          item.id === activePhotoItemId
            ? { ...item, evidences: [...item.evidences, newEv] }
            : item
        )
      );

      logAuditEvent({
        userId: 'USR-INSPEC-01',
        userRole: activePersona,
        organization: 'Meridian Marine Surveyors',
        action: `Captured Real-Life Photo Evidence for ${activePhotoItemId}`,
        targetAsset: vesselName,
        justificationNotes: `Attached camera photo: ${newEv.fileName}`,
      });

      setActivePhotoItemId(null);
      e.target.value = '';
    };
    reader.readAsDataURL(file);
  };

  /* open live camera video stream modal */
  const openLiveCameraModal = async (itemId: string) => {
    setActivePhotoItemId(itemId);
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
      console.warn('live camera video stream unavailable, falling back to direct input');
    }
  };

  /* snap photo from video stream */
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

  /* attach live webcam photo snapshot */
  const attachLiveSnapshot = () => {
    if (!capturedPhotoDataUrl || !activePhotoItemId) return;
    const timeStamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newEv: EvidenceItem = {
      id: `EV-${Date.now().toString().slice(-4)}`,
      title: `On-Site Photo (${timeStamp})`,
      type: 'Photo',
      fileName: `realtime_photo_${Date.now().toString().slice(-4)}.jpg`,
      fileSize: '1.4 MB',
      previewUrl: capturedPhotoDataUrl,
    };

    setItems((prev) =>
      prev.map((item) =>
        item.id === activePhotoItemId
          ? { ...item, evidences: [...item.evidences, newEv] }
          : item
      )
    );

    logAuditEvent({
      userId: 'USR-INSPEC-01',
      userRole: activePersona,
      organization: 'Meridian Marine Surveyors',
      action: `Captured Live Camera Photo Evidence for ${activePhotoItemId}`,
      targetAsset: vesselName,
      justificationNotes: `Attached live camera photo for item ${activePhotoItemId}`,
    });

    closeCameraModal();
  };

  /* stop stream and close modal */
  const closeCameraModal = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
    }
    setCameraStream(null);
    setCapturedPhotoDataUrl(null);
    setIsCameraModalOpen(false);
    setActivePhotoItemId(null);
  };


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeUploadItemId) return;

    const isPhoto = file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(file.name);
    const evType: 'Photo' | 'Document' = isPhoto ? 'Photo' : 'Document';
    const formattedSize = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;

    const newEv: EvidenceItem = {
      id: `EV-${Date.now().toString().slice(-4)}`,
      title: file.name.replace(/\.[^/.]+$/, ''),
      type: evType,
      fileName: file.name,
      fileSize: formattedSize,
    };

    setItems((prev) =>
      prev.map((item) =>
        item.id === activeUploadItemId
          ? { ...item, evidences: [...item.evidences, newEv] }
          : item
      )
    );

    logAuditEvent({
      userId: 'USR-INSPEC-01',
      userRole: activePersona,
      organization: 'Meridian Marine Surveyors',
      action: `Uploaded ${evType} Evidence for ${activeUploadItemId}`,
      targetAsset: vesselName,
      justificationNotes: `Attached file: ${newEv.fileName} (${newEv.fileSize})`,
    });

    setActiveUploadItemId(null);
    e.target.value = '';
  };

  /* Remove item */
  const handleRemoveEvidence = (itemId: string, evidenceId: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, evidences: item.evidences.filter((ev) => ev.id !== evidenceId) }
          : item
      )
    );
  };

  /* save comment / finding note for an item */
  const handleSaveComment = (itemId: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, findingNotes: commentText.trim() || undefined } : item
      )
    );

    logAuditEvent({
      userId: 'USR-INSPEC-01',
      userRole: activePersona,
      organization: 'Meridian Marine Surveyors',
      action: `Updated Finding Comment for ${itemId}`,
      targetAsset: vesselName,
      justificationNotes: `Finding comment saved for ${itemId}`,
    });

    setEditingCommentItemId(null);
    setCommentText('');
  };

  /* raise corrective action directly for a checklist item */
  const handleRaiseItemCapa = (item: InspectionItem) => {
    if (!itemCapaTitle.trim()) return;

    const nextCapaNum = 119 + capaActions.length;
    const capaCode = `CAPA-${nextCapaNum}`;
    const newCapa: CapaActionItem = {
      id: capaCode,
      title: itemCapaTitle.trim(),
      owner: itemCapaOwner.trim() || 'Northwind Marine',
      dueDate: '30 Oct 2026',
      status: 'Open',
    };

    setCapaActions((prev) => [newCapa, ...prev]);
    setItems((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, capaCode: capaCode } : it))
    );

    logAuditEvent({
      userId: 'USR-INSPEC-01',
      userRole: activePersona,
      organization: 'Meridian Marine Surveyors',
      action: `Raised ${capaCode} for ${item.id}`,
      targetAsset: vesselName,
      justificationNotes: `CAPA ${capaCode} linked to ${item.title}`,
    });

    setRaisingCapaItemId(null);
    setItemCapaTitle('');
    setItemCapaOwner('');
  };

  /* add a general new corrective action item */
  const handleAddCapaItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCapaTitle.trim()) return;

    const nextCapaNum = 119 + capaActions.length;
    const newCapa: CapaActionItem = {
      id: `CAPA-${nextCapaNum}`,
      title: newCapaTitle.trim(),
      owner: newCapaOwner.trim() || 'Northwind Technical Services',
      dueDate: newCapaDueDate || '30 Oct 2026',
      status: 'Open',
    };

    setCapaActions((prev) => [newCapa, ...prev]);

    logAuditEvent({
      userId: 'USR-INSPEC-01',
      userRole: activePersona,
      organization: 'Meridian Marine Surveyors',
      action: `Created Corrective Action ${newCapa.id}`,
      targetAsset: vesselName,
      justificationNotes: `CAPA raised: ${newCapa.title} (Owner: ${newCapa.owner})`,
    });

    setNewCapaTitle('');
    setNewCapaOwner('');
    setNewCapaDueDate('');
    setShowAddCapa(false);
  };

  const handleSubmitOutcome = () => {
    logAuditEvent({
      userId: 'USR-INSPEC-01',
      userRole: activePersona,
      organization: 'Meridian Marine Surveyors',
      action: `Submitted Visual Survey Outcome (${selectedResult})`,
      targetAsset: vesselName,
      justificationNotes: `Inspection outcome submitted: ${selectedResult}`,
    });
    alert(`Submitted Inspection Outcome: ${selectedResult} for ${vesselName}.`);
    onClose();
  };

  return (

    <>
      {/* hidden global file inputs for direct uploads and native mobile camera capture */}
      <input
        type="file"
        ref={fileInputRef}
        className="d-none"
        onChange={handleFileChange}
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

      <div className="map-modal-backdrop" onClick={onClose} style={{ zIndex: 1040 }} />
      <div
        className="offcanvas offcanvas-end show bg-light text-dark border-start shadow-lg"
        style={{ width: '92vw', maxWidth: '1260px', visibility: 'visible', zIndex: 1050 }}
        tabIndex={-1}
      >
        {/* modal header */}
        <div className="offcanvas-header border-bottom p-3 bg-white d-flex align-items-center justify-content-between">
          <div>
            <h5 className="offcanvas-title fw-bold text-dark m-0" style={{ fontSize: '1.25rem' }}>
              Visual vessel inspection
            </h5>
            <div className="font-mono-code small text-muted" style={{ fontSize: '0.75rem' }}>
              AS-2041 · {vesselName} · Berth 4, Fremantle · 18 Sep 2026
            </div>
          </div>
          <button type="button" className="btn-close ms-auto" onClick={onClose} aria-label="Close" />
        </div>

        <div className="offcanvas-body p-3 p-md-4" style={{ backgroundColor: '#f1f5f9' }}>
          <div className="row g-4">
            {/* left column: checklist items */}
            <div className="col-lg-7 d-flex flex-column gap-3">
              <div className="card map-card-custom map-checklist-card">
                <div className="d-flex flex-column gap-3.5">
                  {items.map((item) => (
                    <div key={item.id} className="map-checklist-item-container">
                      {/* item header */}
                      <div className="d-flex align-items-start justify-content-between gap-2 mb-2">
                        <div>
                          <div className="fw-bold text-dark" style={{ fontSize: '0.95rem' }}>{item.title}</div>
                          <div className="font-mono-code small" style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{item.subtitle}</div>
                        </div>
                        {item.capaCode && (
                          <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle" style={{ fontSize: '0.675rem' }}>
                            Linked {item.capaCode}
                          </span>
                        )}
                      </div>

                      {/* rating status pill buttons */}
                      <div className="d-flex align-items-center gap-1.5 mb-3 flex-wrap">
                        <button
                          type="button"
                          className={`btn btn-sm rounded-pill px-3 py-1 ${item.status === 'Satisfactory'
                            ? 'btn-outline-primary fw-semibold active'
                            : 'btn-light text-secondary border'
                            }`}
                          style={{
                            fontSize: '0.775rem',
                            borderColor: item.status === 'Satisfactory' ? '#0d9488' : '#e2e8f0',
                            color: item.status === 'Satisfactory' ? '#0d9488' : '#64748b',
                            backgroundColor: item.status === 'Satisfactory' ? '#f0fdf4' : '#f8fafc',
                          }}
                          onClick={() => handleStatusChange(item.id, 'Satisfactory')}
                        >
                          Satisfactory
                        </button>
                        <button
                          type="button"
                          className={`btn btn-sm rounded-pill px-3 py-1 ${item.status === 'Observation'
                            ? 'btn-outline-info fw-semibold active'
                            : 'btn-light text-secondary border'
                            }`}
                          style={{
                            fontSize: '0.775rem',
                            borderColor: item.status === 'Observation' ? '#0284c7' : '#e2e8f0',
                            color: item.status === 'Observation' ? '#0369a1' : '#64748b',
                            backgroundColor: item.status === 'Observation' ? '#e0f2fe' : '#f8fafc',
                          }}
                          onClick={() => handleStatusChange(item.id, 'Observation')}
                        >
                          Observation
                        </button>
                        <button
                          type="button"
                          className={`btn btn-sm rounded-pill px-3 py-1 ${item.status === 'Deficiency'
                            ? 'btn-outline-danger fw-semibold active'
                            : 'btn-light text-secondary border'
                            }`}
                          style={{
                            fontSize: '0.775rem',
                            borderColor: item.status === 'Deficiency' ? '#b91c1c' : '#e2e8f0',
                            color: item.status === 'Deficiency' ? '#b91c1c' : '#64748b',
                            backgroundColor: item.status === 'Deficiency' ? '#fee2e2' : '#f8fafc',
                          }}
                          onClick={() => handleStatusChange(item.id, 'Deficiency')}
                        >
                          Deficiency
                        </button>
                      </div>

                      {/* finding comment callout */}
                      {item.findingNotes && editingCommentItemId !== item.id && (
                        <div className="p-3 rounded-2 mb-3" style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a' }}>
                          <div className="d-flex align-items-center justify-content-between mb-1">
                            <span className="fw-bold" style={{ fontSize: '0.8rem', color: '#b45309' }}>
                              Finding recorded
                            </span>
                            <button
                              type="button"
                              className="btn btn-link btn-sm p-0 text-decoration-none"
                              style={{ fontSize: '0.725rem', color: '#b45309' }}
                              onClick={() => {
                                setEditingCommentItemId(item.id);
                                setCommentText(item.findingNotes || '');
                              }}
                            >
                              Edit Note
                            </button>
                          </div>
                          <div style={{ fontSize: '0.775rem', color: '#92400e', lineHeight: '1.4' }}>
                            {item.findingNotes}
                          </div>
                        </div>
                      )}

                      {/* inline finding comment editor */}
                      {editingCommentItemId === item.id && (
                        <div className="p-3 border rounded-2 bg-light mb-3">
                          <div className="fw-bold text-dark small mb-2" style={{ fontSize: '0.8rem' }}>
                            Finding Note for {item.title}
                          </div>
                          <textarea
                            className="form-control form-control-sm mb-2"
                            rows={2}
                            placeholder="Enter detailed observation notes..."
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            style={{ fontSize: '0.775rem' }}
                          />
                          <div className="d-flex justify-content-end gap-2">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-secondary"
                              style={{ fontSize: '0.725rem' }}
                              onClick={() => setEditingCommentItemId(null)}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              style={{ fontSize: '0.725rem', backgroundColor: '#0284c7', borderColor: '#0284c7' }}
                              onClick={() => handleSaveComment(item.id)}
                            >
                              Save Note
                            </button>
                          </div>
                        </div>
                      )}

                      {/* inline raise CAPA form */}
                      {raisingCapaItemId === item.id && (
                        <div className="p-3 border rounded-2 bg-light mb-3">
                          <div className="fw-bold text-dark small mb-2" style={{ fontSize: '0.8rem' }}>
                            Raise Corrective Action (CAPA) for {item.title}
                          </div>
                          <input
                            type="text"
                            className="form-control form-control-sm mb-2"
                            placeholder="Action required description..."
                            value={itemCapaTitle}
                            onChange={(e) => setItemCapaTitle(e.target.value)}
                            style={{ fontSize: '0.775rem' }}
                          />
                          <input
                            type="text"
                            className="form-control form-control-sm mb-2"
                            placeholder="Assigned Owner (e.g. Northwind Marine)..."
                            value={itemCapaOwner}
                            onChange={(e) => setItemCapaOwner(e.target.value)}
                            style={{ fontSize: '0.775rem' }}
                          />
                          <div className="d-flex justify-content-end gap-2">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-secondary"
                              style={{ fontSize: '0.725rem' }}
                              onClick={() => setRaisingCapaItemId(null)}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-warning fw-bold"
                              style={{ fontSize: '0.725rem' }}
                              onClick={() => handleRaiseItemCapa(item)}
                            >
                              Raise CAPA
                            </button>
                          </div>
                        </div>
                      )}

                      {/* item evidence list with generous padding and thumbnail rendering */}
                      <div className="mb-3">
                        <div className="font-mono-code text-uppercase small mb-2" style={{ fontSize: '0.65rem', color: '#64748b', letterSpacing: '0.05em' }}>
                          Supporting Evidence ({item.evidences.length})
                        </div>

                        <div className="d-flex flex-wrap gap-2.5">
                          {item.evidences.map((ev) => (
                            <div key={ev.id} className="map-checklist-evidence-item shadow-2xs position-relative">
                              {ev.previewUrl ? (
                                <img src={ev.previewUrl} alt={ev.title} className="map-checklist-evidence-thumb" />
                              ) : (
                                <div
                                  className="d-flex align-items-center justify-content-center rounded-2 flex-shrink-0"
                                  style={{
                                    width: '48px',
                                    height: '48px',
                                    backgroundColor: ev.type === 'Photo' ? '#e0f2fe' : '#f1f5f9',
                                    border: '1px solid',
                                    borderColor: ev.type === 'Photo' ? '#bae6fd' : '#cbd5e1',
                                  }}
                                >
                                  {ev.type === 'Photo' ? (
                                    <Camera className="w-5 h-5 text-sky-600" />
                                  ) : (
                                    <FileText className="w-5 h-5 text-slate-600" />
                                  )}
                                </div>
                              )}

                              <div className="d-flex flex-column flex-grow-1 overflow-hidden">
                                <span
                                  className="font-mono-code fw-bold text-uppercase px-2 py-0.5 rounded align-self-start mb-0.5"
                                  style={{
                                    fontSize: '0.625rem',
                                    backgroundColor: ev.type === 'Photo' ? '#e0f2fe' : '#f1f5f9',
                                    color: ev.type === 'Photo' ? '#0369a1' : '#475569',
                                  }}
                                >
                                  {ev.type}
                                </span>
                                <div className="fw-bold text-dark text-truncate" style={{ fontSize: '0.85rem' }}>
                                  {ev.title}
                                </div>
                                {ev.fileName && (
                                  <div className="font-mono-code text-muted small text-truncate mt-0.5" style={{ fontSize: '0.675rem' }}>
                                    {ev.fileName} {ev.fileSize ? `(${ev.fileSize})` : ''}
                                  </div>
                                )}
                              </div>

                              <button
                                type="button"
                                className="btn-close ms-auto flex-shrink-0 align-self-start"
                                style={{ fontSize: '0.6rem' }}
                                aria-label="Remove"
                                onClick={() => handleRemoveEvidence(item.id, ev.id)}
                              />
                            </div>
                          ))}
                          {item.evidences.length === 0 && (
                            <span className="text-muted small fst-italic" style={{ fontSize: '0.725rem' }}>
                              No supporting evidence attached.
                            </span>
                          )}
                        </div>
                      </div>

                      {/* frictionless item action toolbar */}
                      <div className="map-checklist-action-toolbar">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1.5"
                          onClick={() => openLiveCameraModal(item.id)}
                        >
                          <Camera className="w-3.5 h-3.5" />
                          Take Photo
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-light border text-secondary px-2.5 py-1"
                          style={{ fontSize: '0.725rem' }}
                          onClick={() => {
                            setEditingCommentItemId(editingCommentItemId === item.id ? null : item.id);
                            setCommentText(item.findingNotes || '');
                          }}
                        >
                          {item.findingNotes ? 'Edit Note' : 'Add Note'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-light border text-secondary px-2.5 py-1"
                          style={{ fontSize: '0.725rem' }}
                          onClick={() => {
                            setRaisingCapaItemId(raisingCapaItemId === item.id ? null : item.id);
                            setItemCapaTitle(`Corrective action for ${item.title}`);
                          }}
                        >
                          Raise CAPA
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary px-2.5 py-1 ms-auto"
                          style={{ fontSize: '0.725rem' }}
                          onClick={() => triggerDirectUpload(item.id)}
                        >
                          Attach File
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* right column: inspection result & corrective actions */}
            <div className="col-lg-5 d-flex flex-column gap-3">
              {/* inspection result card */}
              <div
                className="card map-card-custom map-checklist-card text-white"
                style={{
                  backgroundColor: 'rgb(11, 27, 43)',
                }}
              >
                <div className="font-mono-code text-uppercase small mb-3" style={{ fontSize: '0.7rem', color: '#94a3b8', letterSpacing: '0.08em' }}>
                  INSPECTION RESULT
                </div>

                <div className="d-flex flex-column gap-2 mb-3">
                  {/* option 1: pass */}
                  <div
                    className="px-3 py-2 rounded cursor-pointer border"
                    style={{
                      backgroundColor: selectedResult === 'Pass' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                      borderColor: selectedResult === 'Pass' ? '#38bdf8' : 'rgba(255, 255, 255, 0.08)',
                      cursor: 'pointer',
                    }}
                    onClick={() => setSelectedResult('Pass')}
                  >
                    <div className="fw-bold text-white mb-0.5" style={{ fontSize: '0.875rem' }}>Pass</div>
                    <div style={{ fontSize: '0.725rem', color: '#94a3b8' }}>
                      No findings. Requirement routes straight to the Approver.
                    </div>
                  </div>

                  {/* option 2: pass with observations */}
                  <div
                    className="px-3 py-2 rounded cursor-pointer border"
                    style={{
                      backgroundColor: selectedResult === 'Pass with observations' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                      borderColor: selectedResult === 'Pass with observations' ? '#38bdf8' : 'rgba(255, 255, 255, 0.08)',
                      cursor: 'pointer',
                    }}
                    onClick={() => setSelectedResult('Pass with observations')}
                  >
                    <div className="fw-bold text-white mb-0.5" style={{ fontSize: '0.875rem' }}>Pass with observations</div>
                    <div style={{ fontSize: '0.725rem', color: '#cbd5e1' }}>
                      Routes to the Approver with corrective actions tracked.
                    </div>
                  </div>

                  {/* option 3: fail */}
                  <div
                    className="px-3 py-2 rounded cursor-pointer border"
                    style={{
                      backgroundColor: selectedResult === 'Fail' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                      borderColor: selectedResult === 'Fail' ? '#ef4444' : 'rgba(255, 255, 255, 0.08)',
                      cursor: 'pointer',
                    }}
                    onClick={() => setSelectedResult('Fail')}
                  >
                    <div className="fw-bold text-white mb-0.5" style={{ fontSize: '0.875rem' }}>Fail</div>
                    <div style={{ fontSize: '0.725rem', color: '#94a3b8' }}>
                      Returns the requirement for rectification and re-inspection.
                    </div>
                  </div>
                </div>

                {/* submit outcome button */}
                {(activePersona === 'Inspector' || activePersona === 'Administrator') && (
                  <button
                    type="button"
                    className="btn btn-success w-100 py-2.5 fw-bold shadow-sm mb-3"
                    style={{
                      backgroundColor: '#059669',
                      borderColor: '#059669',
                      fontSize: '0.9rem',
                      borderRadius: '8px',
                    }}
                    onClick={handleSubmitOutcome}
                  >
                    Submit inspection outcome
                  </button>
                )}

                <div className="small lh-sm" style={{ fontSize: '0.725rem', color: '#64748b' }}>
                  The Inspector role covers visual and vessel inspection only — it does not replace the Verifier for routine document verification.
                </div>
              </div>

              {/* corrective actions list card */}
              <div className="card map-card-custom map-checklist-card">
                <div className="d-flex align-items-center justify-between mb-3">
                  <h6 className="fw-bold text-dark m-0" style={{ fontSize: '1rem' }}>
                    Corrective actions ({capaActions.length})
                  </h6>
                  {(activePersona === 'Inspector' || activePersona === 'Administrator') && (
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm px-2.5 py-1 fw-semibold"
                      style={{ fontSize: '0.75rem', borderRadius: '6px', borderColor: '#0284c7', color: '#0284c7' }}
                      onClick={() => setShowAddCapa(!showAddCapa)}
                    >
                      {showAddCapa ? 'Cancel' : 'Add CAPA Item'}
                    </button>
                  )}
                </div>

                {/* general new CAPA creation form */}
                {showAddCapa && (
                  <form onSubmit={handleAddCapaItem} className="p-3 border rounded bg-light mb-3">
                    <div className="fw-bold text-dark small mb-2" style={{ fontSize: '0.8rem' }}>
                      New Corrective Action (CAPA)
                    </div>
                    <div className="mb-2">
                      <label className="form-label small text-muted m-0" style={{ fontSize: '0.725rem' }}>Action Title</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="e.g. Replace damaged fire hose nozzle"
                        required
                        value={newCapaTitle}
                        onChange={(e) => setNewCapaTitle(e.target.value)}
                        style={{ fontSize: '0.775rem' }}
                      />
                    </div>
                    <div className="row g-2 mb-2">
                      <div className="col-6">
                        <label className="form-label small text-muted m-0" style={{ fontSize: '0.725rem' }}>Assigned Owner</label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="e.g. Northwind Marine"
                          value={newCapaOwner}
                          onChange={(e) => setNewCapaOwner(e.target.value)}
                          style={{ fontSize: '0.775rem' }}
                        />
                      </div>
                      <div className="col-6">
                        <label className="form-label small text-muted m-0" style={{ fontSize: '0.725rem' }}>Due Date</label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="e.g. 15 Oct 2026"
                          value={newCapaDueDate}
                          onChange={(e) => setNewCapaDueDate(e.target.value)}
                          style={{ fontSize: '0.775rem' }}
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="btn btn-primary btn-sm w-100 fw-bold mt-1"
                      style={{ backgroundColor: 'rgb(11, 27, 43)', borderColor: 'rgb(11, 27, 43)', fontSize: '0.775rem' }}
                    >
                      Save Corrective Action
                    </button>
                  </form>
                )}

                <div className="d-flex flex-column gap-3">
                  {capaActions.map((capa) => (
                    <div key={capa.id} className="border-bottom pb-3">
                      <div className="d-flex align-items-center justify-between mb-1">
                        <div className="d-flex align-items-center gap-2">
                          <span className="font-mono-code text-uppercase small" style={{ fontSize: '0.725rem', color: '#94a3b8' }}>
                            {capa.id}
                          </span>
                          <span className="fw-bold text-dark" style={{ fontSize: '0.875rem' }}>
                            {capa.title}
                          </span>
                        </div>
                        <span
                          className={`badge rounded-pill ${capa.status === 'Open'
                            ? 'bg-warning-subtle text-warning-emphasis border border-warning-subtle'
                            : 'bg-success-subtle text-success-emphasis border border-success-subtle'
                            }`}
                          style={{ fontSize: '0.675rem' }}
                        >
                          {capa.status}
                        </span>
                      </div>
                      <div className="small" style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        Owner: {capa.owner} · Due {capa.dueDate}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* live camera modal snapshot dialog */}
      {isCameraModalOpen && (
        <div className="map-modal-backdrop d-flex align-items-center justify-content-center p-3" style={{ zIndex: 1060 }}>
          <div className="map-camera-modal-dialog card p-3">
            <div className="d-flex align-items-center justify-content-between pb-2 border-bottom mb-3">
              <h6 className="fw-bold text-dark m-0">Live Camera Photo Capture</h6>
              <button type="button" className="btn-close" onClick={closeCameraModal} aria-label="Close modal" />
            </div>

            <div className="d-flex flex-column align-items-center gap-3">
              {!capturedPhotoDataUrl ? (
                <>
                  <video ref={videoRef} autoPlay playsInline className="map-camera-video-preview" />
                  <canvas ref={canvasRef} className="d-none" />
                  <div className="d-flex justify-content-center flex-wrap gap-2 w-100">
                    <button type="button" className="btn btn-outline-secondary btn-sm" onClick={closeCameraModal}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm"
                      onClick={() => {
                        const targetId = activePhotoItemId;
                        closeCameraModal();
                        if (targetId) handleTriggerCameraCapture(targetId);
                      }}
                    >
                      Use Device Camera
                    </button>
                    <button type="button" className="btn btn-primary btn-sm px-4" onClick={takeCameraSnapshot}>
                      Snap Photo
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <img src={capturedPhotoDataUrl} alt="Captured preview" className="map-camera-video-preview" />
                  <div className="d-flex justify-content-center gap-2 w-100">
                    <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setCapturedPhotoDataUrl(null)}>
                      Retake
                    </button>
                    <button type="button" className="btn btn-success btn-sm px-4" onClick={attachLiveSnapshot}>
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

