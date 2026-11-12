/* 
  file summary: visual vessel physical inspection checklist and capa logger page view in light theme.
  responsibilities: displays interactive physical survey checklist items, direct file evidence uploads, inline finding comments, capa creation, and inspection outcome submission.
  role in system: full page view rendered when clicking a vessel survey row in InspectorWorkspaceView (/inspector/vesselName).
*/

import React, { useState, useRef } from 'react';
import { useMapStore } from '../store/useMapStore';
import { DetailHeader } from '../components/common/DetailHeader';
import { AccessDeniedState } from '../components/common/AccessDeniedState';
import { exportToCsv, exportToPdf } from '../utils/exportHelpers';
import { getStatusDisplayLabel } from '../utils/formatters';
import { getAssuranceSetRoleActions, isAssuranceSetAssignedToPersona } from '../utils/rbacHelpers';
import { useSessionUser } from '../utils/useSessionUser';
import { CapaItem } from '../types/capa';
import { CapaReinspectionDrawer } from '../components/drawers/CapaReinspectionDrawer';
import { Camera, FileText } from 'lucide-react';
import { CameraCaptureModal } from '../components/modals/CameraCaptureModal';

import {
  DEFAULT_INSPECTION_CHECKLIST_ITEMS,
  EvidenceItem,
  InspectionChecklistTemplateItem as InspectionItem,
  InspectionCapaActionItem as CapaActionItem,
  PHYSICAL_INSPECTIONS,
  inspectionProgressForSet,
} from '../store/inspectionMockData';

interface InspectionChecklistViewProps {
  vesselName?: string;
  setId?: string;
  inspectionLocation?: string;
  inspectionDate?: string;
}

/**
  what: renders visual vessel inspection full-page view with zero-friction workflow.
  how: manages state for 5 checklist items with direct file evidence uploads, real-time photo capture, inline finding comments, CAPA creation, and smart inspection outcome submission.
  with what file: src/views/InspectionChecklistView.tsx loaded by App.tsx when hash is /inspector/:vesselName or /inspection/:vesselName.
*/
export const InspectionChecklistView: React.FC<InspectionChecklistViewProps> = ({
  vesselName,
  setId: propSetId,
  inspectionLocation: propLocation,
  inspectionDate: propDate,
}) => {
  const {
    currentEntityId,
    assuranceSets,
    vessels,
    capaItems,
    addCapaItem,
    logAuditEvent,
    activePersona,
    activeDemoOrganization,
    users,
    setCurrentHashView,
    completeVesselInspection,
  } = useMapStore();

  const sessionUser = useSessionUser();
  const targetIdentifier = propSetId || vesselName || currentEntityId || '';
  const decodedTarget = targetIdentifier ? decodeURIComponent(targetIdentifier) : '';

  const candidateSets = assuranceSets.filter(
    (s) =>
      s.id === targetIdentifier ||
      s.id === decodedTarget ||
      s.vesselName === targetIdentifier ||
      s.vesselName === decodedTarget ||
      s.vesselId === targetIdentifier ||
      s.vesselId === decodedTarget,
  );

  const accessibleCandidateSets = sessionUser
    ? candidateSets.filter(
        (s) =>
          Boolean(s.mandatoryInspectionRequired) &&
          isAssuranceSetAssignedToPersona(
            s,
            activePersona,
            activeDemoOrganization,
            sessionUser,
            users,
          ),
      )
    : [];

  const matchedSet = accessibleCandidateSets[0];

  const matchedVessel =
    matchedSet
      ? vessels.find((v) => v.id === matchedSet.vesselId || v.name === matchedSet.vesselName)
      : undefined;

  const resolvedSetId = matchedSet?.id || '';

  const cleanVesselName =
    matchedSet?.vesselName ||
    matchedVessel?.name ||
    (!targetIdentifier.startsWith('AS-') && decodedTarget ? decodedTarget : '') ||
    '';

  const physicalInspection = PHYSICAL_INSPECTIONS.find((p) => p.assuranceSetId === resolvedSetId);
  const progressRecord = resolvedSetId ? inspectionProgressForSet(resolvedSetId) : undefined;

  const initialLocation =
    propLocation ||
    physicalInspection?.location ||
    progressRecord?.location ||
    (matchedVessel ? matchedVessel.portOfRegistry || 'Fremantle, WA' : '') ||
    'Not recorded';

  const initialDate =
    propDate ||
    physicalInspection?.date ||
    matchedSet?.targetDate ||
    matchedSet?.complianceDeadline ||
    new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const [inspectionLocation, setInspectionLocation] = useState<string>(initialLocation);
  const [inspectionDate, setInspectionDate] = useState<string>(initialDate);

  React.useEffect(() => {
    if (propLocation) {
      setInspectionLocation(propLocation);
    } else if (physicalInspection?.location) {
      setInspectionLocation(physicalInspection.location);
    } else if (progressRecord?.location) {
      setInspectionLocation(progressRecord.location);
    }
  }, [propLocation, physicalInspection?.location, progressRecord?.location]);

  React.useEffect(() => {
    if (propDate) {
      setInspectionDate(propDate);
    } else if (physicalInspection?.date) {
      setInspectionDate(physicalInspection.date);
    } else if (matchedSet?.targetDate) {
      setInspectionDate(matchedSet.targetDate);
    }
  }, [propDate, physicalInspection?.date, matchedSet?.targetDate]);

  const initialItems = React.useMemo(() => {
    if (physicalInspection?.checklists && physicalInspection.checklists.length > 0) {
      return DEFAULT_INSPECTION_CHECKLIST_ITEMS.slice(0, physicalInspection.checklists.length);
    }
    return DEFAULT_INSPECTION_CHECKLIST_ITEMS;
  }, [physicalInspection]);

  const [items, setItems] = useState<InspectionItem[]>(initialItems);

  React.useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const [selectedResult, setSelectedResult] = useState<'Pass' | 'Pass with observations' | 'Fail'>('Pass with observations');

  const vesselCapas = matchedSet
    ? capaItems.filter((c) =>
        c.assuranceSetId
          ? c.assuranceSetId === matchedSet.id
          : c.vesselName.toLowerCase() === cleanVesselName.toLowerCase() ||
            (matchedVessel && c.vesselId === matchedVessel.id),
      )
    : [];

  const initialCapas: CapaActionItem[] = vesselCapas.map((c) => ({
    id: c.id,
    title: c.title,
    owner: c.owner,
    dueDate: c.dueDate,
    status: (c.status === 'Verified & Closed' ? 'Closed' : 'Open') as 'Open' | 'Closed',
  }));

  const [capas, setCapas] = useState<CapaActionItem[]>(initialCapas);

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

  const [raisingCapaItemId, setRaisingCapaItemId] = useState<string | null>(null);
  const [itemCapaTitle, setItemCapaTitle] = useState('');
  const [itemCapaOwner, setItemCapaOwner] = useState('Northwind Marine');

  const [showAddCapa, setShowAddCapa] = useState(false);
  const [newCapaTitle, setNewCapaTitle] = useState('');
  const [newCapaOwner, setNewCapaOwner] = useState('Northwind Marine Technical');
  const [newCapaDueDate, setNewCapaDueDate] = useState(initialDate);
  const canInspect = Boolean(
    sessionUser &&
      matchedSet &&
      activePersona === 'Inspector' &&
      getAssuranceSetRoleActions(
        matchedSet,
        activePersona,
        activeDemoOrganization,
        sessionUser,
      ).canInspect,
  );
  const isInspector = canInspect;

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
      TitleOrAction: `Vessel: ${cleanVesselName}${resolvedSetId ? ` (${resolvedSetId})` : ''} | Location: ${inspectionLocation} | Date: ${inspectionDate} | Outcome: ${selectedResult}`,
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

    exportToCsv(`${cleanVesselName.replace(/\s+/g, '_')}_Complete_Inspection_Report`, [summaryRow, ...itemRows, ...capaRows]);
  };

  const handleExportPdf = () => {
    const headers = ['Category', 'Item', 'Status', 'Notes'];
    const summaryRow = [
      'INSPECTION SUMMARY',
      `Visual Physical Inspection — ${cleanVesselName}${resolvedSetId ? ` (${resolvedSetId})` : ''}\nLocation: ${inspectionLocation} · Date: ${inspectionDate}`,
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

    exportToPdf(`${cleanVesselName} Complete Visual Physical Inspection Report`, headers, [summaryRow, ...itemRows, ...capaRows]);
  };

  const handleStatusChange = (id: string, newStatus: 'Satisfactory' | 'Observation' | 'Deficiency') => {
    if (!canInspect) return;
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
    if (!canInspect) return;
    setUploadingItemId(itemId);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  /* trigger native mobile device camera capture input */
  const handleTriggerCameraCapture = (itemId: string) => {
    if (!canInspect) return;
    setActivePhotoItemId(itemId);
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
      cameraInputRef.current.click();
    }
  };

  /* process camera photo file input from mobile camera */
  const handleCameraFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canInspect) return;
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
        action: 'Captured Real-Life Inspection Photo',
        targetAsset: `${vesselName} · ${file.name || 'Camera Photo'}`,
        justificationNotes: `Attached live camera photo evidence for checklist item ${activePhotoItemId}`,
      });

      setActivePhotoItemId(null);
    };
    reader.readAsDataURL(file);
  };

  const openLiveCameraModal = (itemId: string) => {
    if (!canInspect) return;
    setActivePhotoItemId(itemId);
    setIsCameraModalOpen(true);
  };

  const handleCameraCapture = (dataUrl: string) => {
    if (!canInspect || !activePhotoItemId) return;
    const timeStamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newEvidence: EvidenceItem = {
      id: `EV-${Date.now().toString().slice(-4)}`,
      title: `On-Site Photo (${timeStamp})`,
      type: 'Photo',
      fileName: `realtime_photo_${Date.now().toString().slice(-4)}.jpg`,
      fileSize: '1.4 MB',
      previewUrl: dataUrl,
    };
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== activePhotoItemId) return item;
        return { ...item, evidences: [...item.evidences, newEvidence] };
      })
    );
    logAuditEvent({
      action: 'Captured Live Camera Photo Evidence',
      targetAsset: `${vesselName} · Checklist Item ${activePhotoItemId}`,
      justificationNotes: `Attached live webcam photo for item ${activePhotoItemId}`,
    });
    setIsCameraModalOpen(false);
    setActivePhotoItemId(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canInspect) return;
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
      action: 'Uploaded Physical Evidence File',
      targetAsset: `${vesselName} · ${file.name}`,
      justificationNotes: `Attached ${newEvidence.type} evidence for checklist item ${uploadingItemId}`,
    });

    setUploadingItemId(null);
  };


  const handleRemoveEvidence = (itemId: string, evId: string) => {
    if (!canInspect) return;
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
    if (!canInspect) return;
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
    if (!canInspect || !itemCapaTitle.trim()) return;
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
      vesselName: cleanVesselName,
      checklistId: item.id,
      checklistItemTitle: item.title,
      title: itemCapaTitle,
      findingDescription: item.findingNotes || `Finding observation logged during visual inspection of ${item.title}`,
      owner: itemCapaOwner || 'Northwind Marine Technical',
      dueDate: newCapaDueDate || inspectionDate,
      status: 'Open',
      evidences: [],
      createdDate: inspectionDate,
    };

    addCapaItem(newCapaStoreItem);
    setCapas((prev) => [...prev, newCapa]);
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, capaCode: capaId } : i))
    );

    logAuditEvent({
      action: `Created Corrective Action (${capaId})`,
      targetAsset: `${cleanVesselName}${resolvedSetId ? ` (${resolvedSetId})` : ''} · ${item.title}`,
      justificationNotes: `Raised ${capaId}: ${itemCapaTitle}`,
    });

    setRaisingCapaItemId(null);
    setItemCapaTitle('');
  };

  const handleAddGlobalCapa = () => {
    if (!canInspect || !newCapaTitle.trim()) return;
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
      assuranceSetId: resolvedSetId || undefined,
      vesselId: matchedSet?.vesselId || matchedVessel?.id,
      vesselName: cleanVesselName,
      checklistItemTitle: 'General Inspection Finding',
      title: newCapaTitle,
      findingDescription: 'General survey corrective action logged during physical inspection.',
      owner: newCapaOwner || 'Northwind Marine Technical',
      dueDate: newCapaDueDate || inspectionDate,
      status: 'Open',
      evidences: [],
      createdDate: inspectionDate,
    };

    addCapaItem(newCapaStoreItem);
    setCapas((prev) => [...prev, newCapa]);
    setNewCapaTitle('');
    setShowAddCapa(false);
  };

  const handleSubmitOutcome = () => {
    if (!canInspect) return;
    logAuditEvent({
      action: `Submitted Visual Survey Outcome (${selectedResult})`,
      targetAsset: `${cleanVesselName}${resolvedSetId ? ` (${resolvedSetId})` : ''}`,
      justificationNotes: `Inspection outcome submitted: ${selectedResult}`,
    });
    /* a passed inspection completes the inspection stage of the vessel's sets that are waiting on it */
    completeVesselInspection(cleanVesselName, selectedResult);
    alert(`Submitted Inspection Outcome: ${selectedResult} for ${cleanVesselName}.`);
    setCurrentHashView('inspector');
  };

  if (!sessionUser || !matchedSet) {
    return <AccessDeniedState onBack={() => setCurrentHashView('inspector')} />;
  }

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

      <DetailHeader
        title={cleanVesselName}
        status="Inspection In Progress"
        metaItems={[resolvedSetId, inspectionLocation, inspectionDate].filter(Boolean)}
        mainAction={
          isInspector ? (
            <button
              type="button"
              className="btn btn-sm btn-outline-primary fw-bold"
              onClick={() => setCurrentHashView('capa', cleanVesselName)}
            >
              Manage CAPAs
            </button>
          ) : undefined
        }
        onExportCsv={handleExportCsv}
        onExportPdf={handleExportPdf}
      />

      {/* Main Grid: Left side Checklist Items, Right side Outcome & CAPA Logger */}
      <div className="row g-4">
        {/* Left Column: Statutory Checklist Items */}
        <div className="col-lg-7 d-flex flex-column gap-3">
          <div className="card map-card-custom map-checklist-card">
            <div className="d-flex align-items-center justify-between mb-3 border-bottom pb-2">
              <h6 className="fw-bold text-primary m-0">Inspection Checklist</h6>
              <span className="text-secondary small" data-testid="checklist-count">
                {items.length} SOLAS / ISM Verification Points
              </span>
            </div>

            <div className="row g-2 mb-3 pb-2 border-bottom">
              <div className="col-sm-6">
                <label className="form-label small text-muted mb-1" htmlFor="inspection-location-input">
                  Inspection Location
                </label>
                <input
                  id="inspection-location-input"
                  data-testid="inspection-location-input"
                  type="text"
                  className="form-control form-control-sm"
                  value={inspectionLocation}
                  onChange={(e) => setInspectionLocation(e.target.value)}
                  disabled={!canInspect}
                  placeholder="Inspection Location"
                />
              </div>
              <div className="col-sm-6">
                <label className="form-label small text-muted mb-1" htmlFor="inspection-date-input">
                  Inspection Date
                </label>
                <input
                  id="inspection-date-input"
                  data-testid="inspection-date-input"
                  type="text"
                  className="form-control form-control-sm"
                  value={inspectionDate}
                  onChange={(e) => setInspectionDate(e.target.value)}
                  disabled={!canInspect}
                  placeholder="Inspection Date"
                />
              </div>
            </div>

            <div className="d-flex flex-column gap-3.5">
              {items.map((item) => (
                <div key={item.id} className="map-checklist-item-container" data-testid="checklist-item-row">
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
                          title={`View ${item.capaCode}`}
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
                        Note for {item.title}
                      </div>
                      <textarea
                        className="form-control form-control-sm mb-2"
                        rows={2}
                        placeholder="Notes"
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
                        Raise CAPA for {item.title}
                      </div>
                      <input
                        type="text"
                        className="form-control form-control-sm mb-2"
                        placeholder="What needs to be done"
                        value={itemCapaTitle}
                        onChange={(e) => setItemCapaTitle(e.target.value)}
                        style={{ fontSize: '0.775rem' }}
                      />
                      <input
                        type="text"
                        className="form-control form-control-sm mb-2"
                        placeholder="Owner (e.g. Northwind Marine)"
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
                      Evidence ({item.evidences.length})
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
                          No evidence attached.
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
              <h6 className="fw-bold text-primary m-0">Outcome</h6>
            </div>

            <div className="d-flex flex-column gap-3">
              <div className="p-3 rounded-3" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <div className="d-flex justify-between align-items-center mb-1">
                  <span className="text-secondary small fw-semibold">Suggested Result:</span>
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
                <label className="form-label fw-bold text-dark small mb-1">Inspection Outcome</label>
                {isInspector ? (
                  <select
                    className="form-select form-select-sm fw-semibold"
                    value={selectedResult}
                    onChange={(e) => setSelectedResult(e.target.value as any)}
                    style={{ fontSize: '0.85rem' }}
                  >
                    <option value="Pass">Pass</option>
                    <option value="Pass with observations">Pass with Observations</option>
                    <option value="Fail">Fail</option>
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
                  Submit Outcome
                </button>
              )}
            </div>
          </div>

          {/* CAPA Action Plan Logger */}
          <div className="card map-card-custom map-checklist-card">
            <div className="d-flex align-items-center justify-between mb-3 border-bottom pb-2">
              <h6 className="fw-bold text-primary m-0">CAPA</h6>
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
                <div className="fw-bold text-dark small mb-2">Add CAPA</div>
                <input
                  type="text"
                  className="form-control form-control-sm mb-2"
                  placeholder="Title"
                  value={newCapaTitle}
                  onChange={(e) => setNewCapaTitle(e.target.value)}
                  style={{ fontSize: '0.775rem' }}
                />
                <input
                  type="text"
                  className="form-control form-control-sm mb-2"
                  placeholder="Owner"
                  value={newCapaOwner}
                  onChange={(e) => setNewCapaOwner(e.target.value)}
                  style={{ fontSize: '0.775rem' }}
                />
                <input
                  type="text"
                  className="form-control form-control-sm mb-2"
                  placeholder="Due date (e.g. 30 Sep 2026)"
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
                  Save
                </button>
              </div>
            )}

            {/* List of active CAPAs */}
            <div className="d-flex flex-column gap-2.5">
              {(() => {
                const storeCapas = capaItems.filter((c) =>
                  c.assuranceSetId
                    ? c.assuranceSetId === matchedSet.id
                    : c.vesselName.toLowerCase() === cleanVesselName.toLowerCase() ||
                      (matchedVessel && c.vesselId === matchedVessel.id),
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
                    createdDate: inspectionDate,
                  }));

                if (displayList.length === 0) {
                  return (
                    <div className="text-muted small text-center py-3 fst-italic">
                      No open CAPAs.
                    </div>
                  );
                }

                return displayList.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 border rounded-3 bg-white shadow-2xs cursor-pointer"
                    onClick={() => setSelectedCapaForDrawer(c as CapaItem)}
                    style={{ cursor: 'pointer', transition: 'all 0.15s ease-in-out' }}
                    title="View"
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
                        {getStatusDisplayLabel(c.status)}
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

      <CameraCaptureModal
        isOpen={isCameraModalOpen}
        onClose={() => { setIsCameraModalOpen(false); setActivePhotoItemId(null); }}
        onCapture={handleCameraCapture}
        onUseCameraInput={() => {
          const targetId = activePhotoItemId;
          setIsCameraModalOpen(false);
          if (targetId) handleTriggerCameraCapture(targetId);
        }}
      />

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

