/* 
  file summary: visual vessel physical inspection checklist and capa logger page view in light theme.
  responsibilities: displays interactive physical survey checklist items, direct file evidence uploads, inline finding comments, capa creation, and inspection outcome submission.
  role in system: full page view rendered when clicking a vessel survey row in InspectorWorkspaceView (/inspector/vesselName).
*/

import React, { useState, useRef } from 'react';
import { useMapStore } from '../store/useMapStore';
import { exportToCsv, exportToPdf } from '../utils/exportHelpers';
import { CapaItem } from '../types/capa';
import { CapaReinspectionDrawer } from '../components/drawers/CapaReinspectionDrawer';
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

interface InspectionChecklistViewProps {
  vesselName?: string;
}

/**
  what: renders visual vessel inspection full-page view with zero-friction workflow.
  how: manages state for 5 checklist items with direct file evidence uploads, real-time photo capture, inline finding comments, CAPA creation, and smart inspection outcome submission.
  with what file: src/views/InspectionChecklistView.tsx loaded by App.tsx when hash is /inspector/:vesselName or /inspection/:vesselName.
*/
export const InspectionChecklistView: React.FC<InspectionChecklistViewProps> = ({ vesselName = 'MV Pacific Endeavour' }) => {
  const cleanVesselName = decodeURIComponent(vesselName || 'MV Pacific Endeavour');
  const { capaItems, addCapaItem, logAuditEvent, activePersona, setCurrentHashView } = useMapStore();

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

  const [capas, setCapas] = useState<CapaActionItem[]>([
    {
      id: 'CAPA-118',
      title: 'Replace port-side liferaft HRU & update service log',
      owner: 'Northwind Marine Technical Dept',
      dueDate: '25 Sep 2026',
      status: 'Open',
    },
  ]);

  const [editingCommentItemId, setEditingCommentItemId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');

  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* photo capture state & refs for native mobile camera and live stream modal */
  const [activePhotoItemId, setActivePhotoItemId] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  /* drawer state for inspecting capa details directly inside physical inspection view */
  const [selectedCapaForDrawer, setSelectedCapaForDrawer] = useState<CapaItem | null>(null);

  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedPhotoDataUrl, setCapturedPhotoDataUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [raisingCapaItemId, setRaisingCapaItemId] = useState<string | null>(null);
  const [itemCapaTitle, setItemCapaTitle] = useState('');
  const [itemCapaOwner, setItemCapaOwner] = useState('Northwind Marine');

  const [showAddCapa, setShowAddCapa] = useState(false);
  const [newCapaTitle, setNewCapaTitle] = useState('');
  const [newCapaOwner, setNewCapaOwner] = useState('Northwind Marine Technical');
  const [newCapaDueDate, setNewCapaDueDate] = useState('30 Sep 2026');
  const [isExportOpen, setIsExportOpen] = useState(false);

  const isInspector = activePersona === 'Inspector';

  /* calculate recommended outcome dynamically */
  const observationCount = items.filter((i) => i.status === 'Observation').length;
  const deficiencyCount = items.filter((i) => i.status === 'Deficiency').length;

  const getRecommendedOutcome = (): 'Pass' | 'Pass with observations' | 'Fail' => {
    if (deficiencyCount > 0) return 'Fail';
    if (observationCount > 0) return 'Pass with observations';
    return 'Pass';
  };

  const recommendedOutcome = getRecommendedOutcome();

  const handleExportCsv = () => {
    const summaryRow = {
      Category: 'INSPECTION SUMMARY',
      TitleOrAction: `Vessel: ${vesselName} | Location: Berth 4, Fremantle | Outcome: ${selectedResult}`,
      StatusOrOwner: recommendedOutcome,
      Details: `${observationCount} Observation(s), ${deficiencyCount} Deficiency(ies)`,
    };

    const itemRows = items.map((item) => ({
      Category: 'CHECKLIST ITEM',
      TitleOrAction: `${item.id}: ${item.title} (${item.subtitle})`,
      StatusOrOwner: item.status,
      Details: `Finding: ${item.findingNotes || 'None'} | Evidence: ${item.evidences.map((e) => e.fileName || e.title).join(', ') || 'None'}`,
    }));

    const capaRows = capas.map((c) => ({
      Category: 'CORRECTIVE ACTION (CAPA)',
      TitleOrAction: `${c.id}: ${c.title}`,
      StatusOrOwner: `Owner: ${c.owner} (${c.status})`,
      Details: `Due: ${c.dueDate}`,
    }));

    exportToCsv(`${vesselName.replace(/\s+/g, '_')}_Complete_Inspection_Report`, [summaryRow, ...itemRows, ...capaRows]);
    setIsExportOpen(false);
  };

  const handleExportPdf = () => {
    const headers = ['Category', 'Item / Action Title', 'Status / Owner', 'Notes & Details'];
    const summaryRow = [
      'INSPECTION SUMMARY',
      `Visual Physical Inspection — ${vesselName}\nLocation: Berth 4, Fremantle · Date: 18 Sep 2026`,
      `Final Outcome: ${selectedResult}`,
      `Auto Recommended: ${recommendedOutcome}\nRecorded: ${observationCount} Observation(s), ${deficiencyCount} Deficiency(ies)`,
    ];

    const itemRows: (string | number)[][] = items.map((item) => [
      'CHECKLIST ITEM',
      `${item.id} — ${item.title}\n(${item.subtitle})`,
      item.status,
      `Notes: ${item.findingNotes || 'Satisfactory'}\nEvidence: ${item.evidences.map((e) => e.title).join(', ') || 'None'}`,
    ]);

    const capaRows: (string | number)[][] = capas.map((c) => [
      'CORRECTIVE ACTION (CAPA)',
      `${c.id} — ${c.title}`,
      `${c.status} (Owner: ${c.owner})`,
      `Target Completion: ${c.dueDate}`,
    ]);

    exportToPdf(`${vesselName} Complete Visual Physical Inspection Report`, headers, [summaryRow, ...itemRows, ...capaRows]);
    setIsExportOpen(false);
  };

  const handleStatusChange = (id: string, newStatus: 'Satisfactory' | 'Observation' | 'Deficiency') => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        return {
          ...item,
          status: newStatus,
        };
      })
    );
  };

  const handleTriggerUpload = (itemId: string) => {
    setUploadingItemId(itemId);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  /* trigger native mobile device camera capture input */
  const handleTriggerCameraCapture = (itemId: string) => {
    setActivePhotoItemId(itemId);
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
      cameraInputRef.current.click();
    }
  };

  /* process camera photo file input from mobile camera */
  const handleCameraFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activePhotoItemId) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const timeStamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const newEvidence: EvidenceItem = {
        id: `EV-${Date.now().toString().slice(-4)}`,
        title: `Real-time Photo (${timeStamp})`,
        type: 'Photo',
        fileName: file.name || `photo_${Date.now()}.jpg`,
        fileSize: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        previewUrl: dataUrl,
      };

      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== activePhotoItemId) return item;
          return {
            ...item,
            evidences: [...item.evidences, newEvidence],
          };
        })
      );

      logAuditEvent({
        userId: 'USR-INSPEC-01',
        userRole: activePersona,
        organization: 'Meridian Marine Surveyors',
        action: 'Captured Real-Life Inspection Photo',
        targetAsset: `${vesselName} · ${file.name || 'Camera Photo'}`,
        justificationNotes: `Attached live camera photo evidence for checklist item ${activePhotoItemId}`,
      });

      setActivePhotoItemId(null);
    };
    reader.readAsDataURL(file);
  };

  /* open interactive live webcam stream modal */
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
      /* camera stream unavailable or blocked by browser permission */
      console.warn('live camera video stream unaccessible, falling back to direct input');
    }
  };

  /* capture snapshot from live video stream */
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

  /* attach captured live webcam photo */
  const attachLiveSnapshot = () => {
    if (!capturedPhotoDataUrl || !activePhotoItemId) return;
    const timeStamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newEvidence: EvidenceItem = {
      id: `EV-${Date.now().toString().slice(-4)}`,
      title: `On-Site Photo (${timeStamp})`,
      type: 'Photo',
      fileName: `realtime_photo_${Date.now().toString().slice(-4)}.jpg`,
      fileSize: '1.4 MB',
      previewUrl: capturedPhotoDataUrl,
    };

    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== activePhotoItemId) return item;
        return {
          ...item,
          evidences: [...item.evidences, newEvidence],
        };
      })
    );

    logAuditEvent({
      userId: 'USR-INSPEC-01',
      userRole: activePersona,
      organization: 'Meridian Marine Surveyors',
      action: 'Captured Live Camera Photo Evidence',
      targetAsset: `${vesselName} · Checklist Item ${activePhotoItemId}`,
      justificationNotes: `Attached live webcam photo for item ${activePhotoItemId}`,
    });

    closeCameraModal();
  };

  /* stop video stream and close camera modal */
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
    if (!file || !uploadingItemId) return;

    const isImage = file.type.startsWith('image/') || file.name.match(/\.(jpg|jpeg|png|webp)$/i);
    const newEvidence: EvidenceItem = {
      id: `EV-${Date.now().toString().slice(-4)}`,
      title: file.name.split('.')[0] || 'Uploaded Evidence',
      type: isImage ? 'Photo' : 'Document',
      fileName: file.name,
      fileSize: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
    };

    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== uploadingItemId) return item;
        return {
          ...item,
          evidences: [...item.evidences, newEvidence],
        };
      })
    );

    logAuditEvent({
      userId: 'USR-INSPEC-01',
      userRole: activePersona,
      organization: 'Meridian Marine Surveyors',
      action: 'Uploaded Physical Evidence File',
      targetAsset: `${vesselName} · ${file.name}`,
      justificationNotes: `Attached ${newEvidence.type} evidence for checklist item ${uploadingItemId}`,
    });

    setUploadingItemId(null);
  };


  const handleRemoveEvidence = (itemId: string, evId: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          evidences: item.evidences.filter((ev) => ev.id !== evId),
        };
      })
    );
  };

  const handleSaveComment = (itemId: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          findingNotes: commentText.trim() ? commentText : undefined,
        };
      })
    );
    setEditingCommentItemId(null);
    setCommentText('');
  };

  const handleRaiseItemCapa = (item: InspectionItem) => {
    if (!itemCapaTitle.trim()) return;
    const nextCapaNum = 118 + capas.length;
    const capaId = `CAPA-${nextCapaNum}`;

    const newCapa: CapaActionItem = {
      id: capaId,
      title: itemCapaTitle,
      owner: itemCapaOwner || 'Northwind Marine',
      dueDate: '30 Sep 2026',
      status: 'Open',
    };

    const newCapaStoreItem: CapaItem = {
      id: capaId,
      vesselName: vesselName,
      checklistId: item.id,
      checklistItemTitle: item.title,
      title: itemCapaTitle,
      findingDescription: item.findingNotes || `Finding observation logged during visual inspection of ${item.title}`,
      owner: itemCapaOwner || 'Northwind Marine Technical',
      dueDate: '30 Sep 2026',
      status: 'Open',
      evidences: [],
      createdDate: '18 Sep 2026',
    };

    addCapaItem(newCapaStoreItem);
    setCapas((prev) => [...prev, newCapa]);
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, capaCode: capaId } : i))
    );

    logAuditEvent({
      userId: 'USR-INSPEC-01',
      userRole: activePersona,
      organization: 'Meridian Marine Surveyors',
      action: `Created Corrective Action (${capaId})`,
      targetAsset: `${vesselName} · ${item.title}`,
      justificationNotes: `Raised ${capaId}: ${itemCapaTitle}`,
    });

    setRaisingCapaItemId(null);
    setItemCapaTitle('');
  };

  const handleAddGlobalCapa = () => {
    if (!newCapaTitle.trim()) return;
    const nextCapaNum = 118 + capas.length;
    const capaId = `CAPA-${nextCapaNum}`;

    const newCapa: CapaActionItem = {
      id: capaId,
      title: newCapaTitle,
      owner: newCapaOwner || 'Northwind Marine Technical',
      dueDate: newCapaDueDate || '30 Sep 2026',
      status: 'Open',
    };

    const newCapaStoreItem: CapaItem = {
      id: capaId,
      vesselName: vesselName,
      checklistItemTitle: 'General Inspection Finding',
      title: newCapaTitle,
      findingDescription: 'General survey corrective action logged during physical inspection.',
      owner: newCapaOwner || 'Northwind Marine Technical',
      dueDate: newCapaDueDate || '30 Sep 2026',
      status: 'Open',
      evidences: [],
      createdDate: '18 Sep 2026',
    };

    addCapaItem(newCapaStoreItem);
    setCapas((prev) => [...prev, newCapa]);
    setNewCapaTitle('');
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
    setCurrentHashView('inspector');
  };

  return (
    <div className="d-flex flex-column gap-4">
      {/* hidden inputs for direct file attachments and native mobile camera capture */}
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

      {/* Top Navigation & Context Header Banner */}
      <div className="card map-card-custom map-checklist-card bg-white">
        <div className="d-flex flex-wrap align-items-center justify-between gap-3">
          <div className="d-flex align-items-center gap-3">
            <div>
              <h5 className="fw-bold text-dark m-0" style={{ fontSize: '1.25rem' }}>
                Visual Vessel Inspection & CAPA Logger
              </h5>
              <div className="font-mono-code small text-muted" style={{ fontSize: '0.75rem' }}>
                AS-2041 · {vesselName} · Berth 4, Fremantle · 18 Sep 2026
              </div>
            </div>
          </div>

          {/* Opposite Corner Controls: Status Badge + CAPA link + Export Data Button */}
          <div className="d-flex align-items-center gap-3 ms-auto">
            <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle font-mono-code px-3 py-2" style={{ fontSize: '0.8rem' }}>
              Audit In Progress
            </span>

            {isInspector && (
              <button
                type="button"
                className="btn btn-sm btn-outline-primary fw-bold"
                onClick={() => setCurrentHashView('capa', vesselName)}
              >
                Manage & Re-Inspect CAPAs
              </button>
            )}

            {/* Export Data Button in opposite corner */}
            <div className="dropdown position-relative">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary text-dark dropdown-toggle"
                onClick={() => setIsExportOpen(!isExportOpen)}
              >
                Export Data
              </button>
              {isExportOpen && (
                <ul className="dropdown-menu dropdown-menu-light show position-absolute end-0 mt-1 shadow border" style={{ zIndex: 1050 }}>
                  <li>
                    <button type="button" className="dropdown-item small" onClick={handleExportCsv}>
                      Export as CSV (.csv)
                    </button>
                  </li>
                  <li>
                    <button type="button" className="dropdown-item small" onClick={handleExportPdf}>
                      Export as PDF (.pdf)
                    </button>
                  </li>
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Left side Checklist Items, Right side Outcome & CAPA Logger */}
      <div className="row g-4">
        {/* Left Column: Statutory Checklist Items */}
        <div className="col-lg-7 d-flex flex-column gap-3">
          <div className="card map-card-custom map-checklist-card">
            <div className="d-flex align-items-center justify-between mb-3 border-bottom pb-2">
              <h6 className="fw-bold text-primary m-0">Physical Inspection Checklist</h6>
              <span className="text-secondary small">5 SOLAS / ISM Verification Points</span>
            </div>

            <div className="d-flex flex-column gap-3.5">
              {items.map((item) => (
                <div key={item.id} className="map-checklist-item-container">
                  {/* Item Header (Title + Rating Status) */}
                  <div className="d-flex align-items-start justify-content-between gap-2 mb-3 flex-wrap">
                    <div>
                      <div className="fw-bold text-dark" style={{ fontSize: '0.95rem' }}>{item.title}</div>
                      <div className="font-mono-code small text-muted" style={{ fontSize: '0.75rem' }}>{item.subtitle}</div>
                      {item.capaCode && (
                        <span
                          className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle mt-1 cursor-pointer"
                          style={{ fontSize: '0.675rem', cursor: 'pointer' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            const matched = capaItems.find((c) => c.id === item.capaCode);
                            if (matched) setSelectedCapaForDrawer(matched);
                          }}
                          title={`Click to view ${item.capaCode} in drawer`}
                        >
                          Linked {item.capaCode}
                        </span>
                      )}
                    </div>
                    {/* Rating Status Pill Buttons or Read-Only Rating Badge */}
                    {isInspector ? (
                      <div className="d-flex align-items-center gap-1.5 flex-wrap">
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
                    ) : (
                      <div>
                        <span
                          className={`badge font-mono-code px-3 py-1.5 border ${item.status === 'Satisfactory'
                            ? 'bg-success-subtle text-success-emphasis border-success-subtle'
                            : item.status === 'Observation'
                              ? 'bg-info-subtle text-info-emphasis border-info-subtle'
                              : 'bg-danger-subtle text-danger-emphasis border-danger-subtle'
                            }`}
                          style={{ fontSize: '0.775rem' }}
                        >
                          {item.status}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Finding Comment Callout */}
                  {item.findingNotes && editingCommentItemId !== item.id && (
                    <div className="p-3 rounded-2 mb-3" style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a' }}>
                      <div className="d-flex align-items-center justify-between mb-1">
                        <span className="fw-bold" style={{ fontSize: '0.8rem', color: '#b45309' }}>
                          Finding Recorded
                        </span>
                        {isInspector && (
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
                        )}
                      </div>
                      <div style={{ fontSize: '0.775rem', color: '#92400e', lineHeight: '1.4' }}>
                        {item.findingNotes}
                      </div>
                    </div>
                  )}

                  {/* Inline Comment Editor */}
                  {isInspector && editingCommentItemId === item.id && (
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

                  {/* Inline Raise CAPA Form */}
                  {isInspector && raisingCapaItemId === item.id && (
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

                  {/* Supporting Evidence List */}
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

                          {isInspector && (
                            <button
                              type="button"
                              className="btn-close ms-auto flex-shrink-0 align-self-start"
                              style={{ fontSize: '0.6rem' }}
                              aria-label="Remove"
                              onClick={() => handleRemoveEvidence(item.id, ev.id)}
                            />
                          )}
                        </div>
                      ))}
                      {item.evidences.length === 0 && (
                        <span className="text-muted small fst-italic" style={{ fontSize: '0.725rem' }}>
                          No supporting evidence attached.
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Frictionless Action Toolbar - only visible for Inspectors */}
                  {isInspector && (
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
                        className="btn btn-sm btn-light border text-secondary d-flex align-items-center gap-1.5"
                        style={{ backgroundColor: '#f8fafc' }}
                        onClick={() => handleTriggerUpload(item.id)}
                      >
                        Attach File
                      </button>

                      <button
                        type="button"
                        className="btn btn-sm btn-light border text-secondary"
                        style={{ backgroundColor: '#f8fafc' }}
                        onClick={() => {
                          setEditingCommentItemId(item.id);
                          setCommentText(item.findingNotes || '');
                        }}
                      >
                        Add Note
                      </button>
                      {!item.capaCode && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-warning text-dark"
                          onClick={() => {
                            setRaisingCapaItemId(item.id);
                            setItemCapaTitle(`Corrective action for ${item.title}`);
                          }}
                        >
                          Raise CAPA
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Inspection Outcome & CAPA Action Plan */}
        <div className="col-lg-5 d-flex flex-column gap-3">
          {/* Executive Summary Card */}
          <div className="card map-card-custom map-checklist-card">
            <div className="d-flex align-items-center justify-between mb-3 border-bottom pb-2">
              <h6 className="fw-bold text-primary m-0">Survey Outcome Summary</h6>
            </div>

            <div className="d-flex flex-column gap-3">
              <div className="p-3 rounded-3" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <div className="d-flex justify-between align-items-center mb-1">
                  <span className="text-secondary small fw-semibold">Auto-Recommended Result:</span>
                  <span
                    className={`badge ${recommendedOutcome === 'Pass'
                      ? 'bg-success-subtle text-success-emphasis border border-success-subtle'
                      : recommendedOutcome === 'Pass with observations'
                        ? 'bg-warning-subtle text-warning-emphasis border border-warning-subtle'
                        : 'bg-danger-subtle text-danger-emphasis border border-danger-subtle'
                      } font-mono-code px-2.5 py-1`}
                    style={{ fontSize: '0.8rem' }}
                  >
                    {recommendedOutcome}
                  </span>
                </div>
                <div className="small text-muted" style={{ fontSize: '0.75rem' }}>
                  Based on {observationCount} observation(s) and {deficiencyCount} deficiency(ies) recorded.
                </div>
              </div>

              {/* Selector for final outcome */}
              <div>
                <label className="form-label fw-bold text-dark small mb-1">Final Inspection Outcome</label>
                {isInspector ? (
                  <select
                    className="form-select form-select-sm fw-semibold"
                    value={selectedResult}
                    onChange={(e) => setSelectedResult(e.target.value as any)}
                    style={{ fontSize: '0.85rem' }}
                  >
                    <option value="Pass">Pass — Fully Compliant</option>
                    <option value="Pass with observations">Pass with Observations — CAPA Tracked</option>
                    <option value="Fail">Fail — Critical Deficiencies</option>
                  </select>
                ) : (
                  <div className="p-2 border rounded bg-white fw-bold font-mono-code text-primary small">
                    {selectedResult}
                  </div>
                )}
              </div>

              {isInspector && (
                <button
                  type="button"
                  className="btn btn-warning font-weight-500 w-100 py-2.5 shadow-sm mt-1"
                  onClick={handleSubmitOutcome}
                  style={{ fontSize: '0.9rem' }}
                >
                  Submit Inspection Outcome & Log CAPA
                </button>
              )}
            </div>
          </div>

          {/* CAPA Action Plan Logger */}
          <div className="card map-card-custom map-checklist-card">
            <div className="d-flex align-items-center justify-between mb-3 border-bottom pb-2">
              <h6 className="fw-bold text-primary m-0">Corrective Action Plan (CAPA)</h6>
              {isInspector && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-warning text-dark font-weight-500"
                  onClick={() => setShowAddCapa(!showAddCapa)}
                  style={{ fontSize: '0.75rem' }}
                >
                  {showAddCapa ? 'Cancel' : 'New CAPA Item'}
                </button>
              )}
            </div>

            {/* Add CAPA form */}
            {showAddCapa && (
              <div className="p-3 border rounded-3 bg-light mb-3">
                <div className="fw-bold text-dark small mb-2">Create General CAPA Action</div>
                <input
                  type="text"
                  className="form-control form-control-sm mb-2"
                  placeholder="CAPA Action title..."
                  value={newCapaTitle}
                  onChange={(e) => setNewCapaTitle(e.target.value)}
                  style={{ fontSize: '0.775rem' }}
                />
                <input
                  type="text"
                  className="form-control form-control-sm mb-2"
                  placeholder="Responsible Owner..."
                  value={newCapaOwner}
                  onChange={(e) => setNewCapaOwner(e.target.value)}
                  style={{ fontSize: '0.775rem' }}
                />
                <input
                  type="text"
                  className="form-control form-control-sm mb-2"
                  placeholder="Target Completion Date (e.g. 30 Sep 2026)..."
                  value={newCapaDueDate}
                  onChange={(e) => setNewCapaDueDate(e.target.value)}
                  style={{ fontSize: '0.775rem' }}
                />
                <button
                  type="button"
                  className="btn btn-sm btn-warning w-100 fw-bold"
                  style={{ fontSize: '0.775rem' }}
                  onClick={handleAddGlobalCapa}
                >
                  Save Action Item
                </button>
              </div>
            )}

            {/* List of active CAPAs */}
            <div className="d-flex flex-column gap-2.5">
              {(() => {
                const storeCapas = capaItems.filter(
                  (c) =>
                    c.vesselName.toLowerCase() === cleanVesselName.toLowerCase() ||
                    c.vesselId === cleanVesselName ||
                    c.vesselName.toLowerCase().includes(cleanVesselName.toLowerCase()) ||
                    cleanVesselName.toLowerCase().includes(c.vesselName.toLowerCase())
                );
                const displayList = storeCapas.length > 0
                  ? storeCapas
                  : capas.map((c) => ({
                    id: c.id,
                    vesselName: cleanVesselName,
                    checklistItemTitle: 'Inspection Finding',
                    title: c.title,
                    findingDescription: 'Corrective action item logged during visual survey.',
                    owner: c.owner,
                    dueDate: c.dueDate,
                    status: (c.status === 'Closed' ? 'Verified & Closed' : 'Open') as any,
                    evidences: [],
                    createdDate: '18 Sep 2026',
                  }));

                if (displayList.length === 0) {
                  return (
                    <div className="text-muted small text-center py-3 fst-italic">
                      No open corrective actions logged for this survey.
                    </div>
                  );
                }

                return displayList.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 border rounded-3 bg-white shadow-2xs cursor-pointer"
                    onClick={() => setSelectedCapaForDrawer(c as CapaItem)}
                    style={{ cursor: 'pointer', transition: 'all 0.15s ease-in-out' }}
                    title="Click to view details, upload evidence, and re-inspect this CAPA"
                  >
                    <div className="d-flex align-items-center justify-between mb-1.5 gap-2">
                      <div className="d-flex align-items-center gap-2">
                        <span className="font-mono-code fw-bold text-primary small">{c.id}</span>
                        {c.checklistItemTitle && (
                          <span className="text-secondary small font-mono-code" style={{ fontSize: '0.675rem' }}>
                            {c.checklistItemTitle}
                          </span>
                        )}
                      </div>
                      <span
                        className="badge border font-mono-code"
                        style={{
                          fontSize: '0.675rem',
                          backgroundColor:
                            c.status === 'Verified & Closed'
                              ? '#f0fdf4'
                              : c.status === 'Under Re-Inspection'
                                ? '#e0f2fe'
                                : c.status === 'Rectification Required'
                                  ? '#fef2f2'
                                  : '#fffbe6',
                          color:
                            c.status === 'Verified & Closed'
                              ? '#166534'
                              : c.status === 'Under Re-Inspection'
                                ? '#0369a1'
                                : c.status === 'Rectification Required'
                                  ? '#991b1b'
                                  : '#854d0e',
                        }}
                      >
                        {c.status}
                      </span>
                    </div>

                    <div className="fw-bold text-dark mb-1" style={{ fontSize: '0.85rem' }}>
                      {c.title}
                    </div>

                    <div className="d-flex align-items-center justify-between small text-secondary mb-2" style={{ fontSize: '0.725rem' }}>
                      <span>Owner: {c.owner}</span>
                      <span className="font-mono-code">Due: {c.dueDate}</span>
                    </div>

                    <div className="d-flex align-items-center justify-between pt-2 border-top mt-1" style={{ fontSize: '0.725rem' }}>
                      <span className="text-muted font-mono-code inline-flex items-center gap-1">
                        <Camera className="w-3.5 h-3.5" />
                        {c.evidences?.length || 0} Evidence File(s)
                      </span>
                      <span className="fw-bold text-primary">
                        View Details
                      </span>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* interactive live camera snapshot modal dialog */}
      {isCameraModalOpen && (
        <div className="map-modal-backdrop d-flex align-items-center justify-content-center p-3">
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

      {/* Capa Re-Inspection Drawer inside Physical Inspection Detail page */}
      {selectedCapaForDrawer && (
        <CapaReinspectionDrawer
          capa={selectedCapaForDrawer}
          onClose={() => setSelectedCapaForDrawer(null)}
        />
      )}
    </div>
  );
};

