/*
  file summary: equipment asset detail view with status card, photo gallery, parent vessel link, and metadata.
  responsibilities: displays equipment particulars, photo gallery with cropping tool, and linked assurance context.
  role in system: rendered when equipment row is selected from hierarchy or equipment list.
*/

import React, { useState, useEffect, useRef } from 'react';
import { AssetStatusCard } from '../components/assets/AssetStatusCard';
import { AddToProjectModal } from '../components/drawers/AddToProjectModal';
import { getEquipmentAssetStatus, EquipmentAsset } from '../types/equipment';
import { useMapStore } from '../store/useMapStore';
import {
  CURATED_EQUIPMENT_PHOTOS,
  getEquipmentStockPhoto,
} from '../utils/vesselImageHelpers';
import { ImageCropModal } from '../components/drawers/VesselImageCropModal';
import {
  Camera,
  Crop,
  Download,
  Edit2,
  Image as ImageIcon,
  Info,
  Plus,
  RotateCcw,
  Save,
  Shield,
  Trash2,
  Upload,
  Wrench,
  X,
} from 'lucide-react';

interface EquipmentDetailViewProps {
  equipmentId: string;
}

export const EquipmentDetailView: React.FC<EquipmentDetailViewProps> = ({ equipmentId }) => {
  const {
    equipment,
    vessels,
    assuranceSets,
    activePersona,
    setCurrentHashView,
    previousHashView,
    previousEntityId,
    updateEquipment,
    updateEquipmentAvailability,
  } = useMapStore();

  const item = equipment.find((e) => e.id === equipmentId);
  const parentVessel = item?.parentVesselId
    ? vessels.find((v) => v.id === item.parentVesselId)
    : undefined;

  const linkedSets = assuranceSets.filter((s) => s.vesselId === item?.parentVesselId);

  const isAdmin = activePersona === 'Administrator';
  const isCAdmin = activePersona === 'C Admin';
  const isSubmitter = activePersona === 'Submitter';
  const canEditAvailability = isAdmin || isSubmitter;
  const canManagePhotos = isAdmin || isSubmitter;
  const canAddToProject = isAdmin || isCAdmin;

  const [showAddToProjectModal, setShowAddToProjectModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  /* Photo gallery & cropping modal states */
  const [showPhotoUploadModal, setShowPhotoUploadModal] = useState(false);
  const [showAddPhotoModal, setShowAddPhotoModal] = useState(false);
  const [customPhotoUrl, setCustomPhotoUrl] = useState('');
  const [photoModalUrl, setPhotoModalUrl] = useState('');
  const [modalPhotos, setModalPhotos] = useState<string[]>([]);
  const [selectedViewPhotoUrl, setSelectedViewPhotoUrl] = useState<string>('');
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [cropModalImageSrc, setCropModalImageSrc] = useState('');
  const [cropTargetIdx, setCropTargetIdx] = useState<number | null>(null);
  const [draggedPhotoIdx, setDraggedPhotoIdx] = useState<number | null>(null);
  const [dragOverPhotoIdx, setDragOverPhotoIdx] = useState<number | null>(null);
  const photoFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (item) {
      const stockUrl = getEquipmentStockPhoto(item.id, item.name, item.category);
      const coverUrl = item.imageUrl || (item.photos && item.photos.length > 0 ? item.photos[0] : stockUrl);
      setPhotoModalUrl(coverUrl);
      setSelectedViewPhotoUrl(coverUrl);
      let initialPhotos = item.photos && item.photos.length > 0 ? [...item.photos] : [coverUrl];
      if (coverUrl && !initialPhotos.includes(coverUrl)) {
        initialPhotos = [coverUrl, ...initialPhotos];
      }
      setModalPhotos(initialPhotos);
    }
  }, [item, showPhotoUploadModal]);

  if (!item) {
    return (
      <div className="alert alert-warning">
        Equipment record not found.
        <button
          type="button"
          className="btn btn-sm btn-link"
          onClick={() => setCurrentHashView('equipment')}
        >
          Back to Equipment
        </button>
      </div>
    );
  }

  const status = getEquipmentAssetStatus(item);
  const activeDisplayPhoto = selectedViewPhotoUrl || item.imageUrl || getEquipmentStockPhoto(item.id, item.name, item.category);

  return (
    <div className="d-flex flex-column gap-3">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="alert alert-success d-flex align-items-center justify-between shadow-sm p-2 mb-0">
          <span>{toastMessage}</span>
          <button type="button" className="btn-close" onClick={() => setToastMessage(null)} />
        </div>
      )}

      {/* Top Header Card */}
      <div className="card map-card-custom p-3">
        <div className="d-flex flex-wrap justify-between align-items-start gap-3">
          <div className="d-flex align-items-center gap-3">
            <div>
              <div className="text-uppercase text-secondary small fw-bold mb-0.5">Equipment Asset Profile</div>
              <h2 className="h4 fw-bold text-dark mb-0.5">{item.name}</h2>
              <div className="text-muted small font-mono-code">
                {item.category} · ID {item.equipmentIdentifier}
              </div>
            </div>
          </div>

          <div className="d-flex align-items-center gap-2 ms-auto">
            {parentVessel && (
              <button
                type="button"
                className="btn btn-sm btn-outline-primary"
                onClick={() => setCurrentHashView('vessels', parentVessel.id)}
              >
                Parent Vessel: {parentVessel.name}
              </button>
            )}
            {canAddToProject && (
              <button
                type="button"
                className="btn btn-sm btn-primary fw-semibold d-inline-flex align-items-center gap-1.5"
                onClick={() => setShowAddToProjectModal(true)}
              >
                <Plus size={15} />
                <span>Add to Project</span>
              </button>
            )}
            <button
              type="button"
              className="btn btn-sm btn-light border d-flex align-items-center justify-content-center"
              style={{ width: '32px', height: '32px', borderRadius: '50%' }}
              onClick={() => setCurrentHashView(previousHashView || 'equipment', previousEntityId)}
              title="Close and Return"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <AssetStatusCard
        assetType="Equipment"
        status={status}
        canEditAvailability={canEditAvailability}
        onAvailabilityChange={(value) => updateEquipmentAvailability(item.id, value)}
      />

      {/* Main Content Layout: Photo Gallery (Left) + Particulars (Right) */}
      <div className="row g-3">
        {/* Left Column: Equipment Photo Gallery & Quick Actions */}
        <div className="col-12 col-lg-5 col-xl-5">
          {/* 1. Large 16:9 Cover Image */}
          <div
            className={`position-relative overflow-hidden rounded-3 shadow-sm mb-2 ${canManagePhotos ? 'cursor-pointer group-photo-container' : ''}`}
            style={{ width: '100%', aspectRatio: '16 / 9', backgroundColor: '#0B1B2B' }}
            onClick={() => {
              if (canManagePhotos) setShowPhotoUploadModal(true);
            }}
            title={canManagePhotos ? 'Click to add, update or crop equipment images' : item.name}
          >
            <img
              src={activeDisplayPhoto}
              alt={item.name}
              className="w-100 h-100 object-fit-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src =
                  'https://images.unsplash.com/photo-1541888946425-d0fbb18086f6?auto=format&fit=crop&w=1000&q=80';
              }}
            />

            {/* Photo Badges */}
            <div
              className="position-absolute top-0 end-0 m-2 d-flex align-items-center gap-1.5"
              style={{ zIndex: 3 }}
              onClick={(e) => e.stopPropagation()}
            >
              {item.photos && item.photos.length > 1 ? (
                <span
                  className="badge bg-primary text-white shadow-2xs font-mono-code"
                  style={{ fontSize: '0.65rem' }}
                >
                  {item.photos.length} Photos
                </span>
              ) : item.imageUrl ? (
                <span
                  className="badge bg-success text-white shadow-2xs font-mono-code"
                  style={{ fontSize: '0.65rem' }}
                >
                  Custom Photo
                </span>
              ) : null}
            </div>

            {canManagePhotos && (
              <div
                className="position-absolute bottom-0 start-0 end-0 p-2 text-center text-white small"
                style={{
                  background: 'linear-gradient(to top, rgba(11, 27, 43, 0.85) 0%, transparent 100%)',
                  fontSize: '0.75rem',
                }}
              >
                Click to manage equipment photo gallery &amp; crop
              </div>
            )}
          </div>

          {/* Thumbnail Preview Strip */}
          {modalPhotos.length > 1 && (
            <div className="d-flex align-items-center gap-1.5 mb-2 overflow-x-auto pb-1">
              {modalPhotos.map((pUrl, pIdx) => {
                const isSelected = pUrl === activeDisplayPhoto;
                return (
                  <button
                    key={pIdx}
                    type="button"
                    className={`border rounded-2 p-0 overflow-hidden flex-shrink-0 transition-all ${
                      isSelected ? 'border-primary shadow-xs ring-2 ring-primary' : 'border-secondary-subtle opacity-75 hover-opacity-100'
                    }`}
                    style={{ width: '64px', height: '42px', backgroundColor: '#0B1B2B' }}
                    onClick={() => setSelectedViewPhotoUrl(pUrl)}
                    title={`View photo #${pIdx + 1}`}
                  >
                    <img src={pUrl} alt="" className="w-100 h-100 object-fit-cover" />
                  </button>
                );
              })}
            </div>
          )}

          {/* Quick Action Buttons Row */}
          <div className="d-flex align-items-center justify-content-between gap-1 mb-3">
            {canManagePhotos && (
              <button
                type="button"
                className="btn btn-sm btn-outline-primary flex-fill d-flex flex-column align-items-center py-1.5 px-1 map-quick-action-btn"
                onClick={() => setShowPhotoUploadModal(true)}
                title="Manage equipment photo gallery"
              >
                <Camera className="w-3.5 h-3.5" />
                <span style={{ fontSize: '0.68rem' }}>{modalPhotos.length > 1 ? 'Gallery' : 'Add Photo'}</span>
              </button>
            )}
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary flex-fill d-flex flex-column align-items-center py-1.5 px-1 map-quick-action-btn"
              onClick={() => {
                setToastMessage(`${item.name} is verified and certified under ${item.category}.`);
                setTimeout(() => setToastMessage(null), 3500);
              }}
              title="Verify equipment status"
            >
              <Shield className="w-3.5 h-3.5" />
              <span style={{ fontSize: '0.68rem' }}>Certified</span>
            </button>
          </div>
        </div>

        {/* Right Column: Particulars & Assurance */}
        <div className="col-12 col-lg-7 col-xl-7 d-flex flex-column gap-3">
          <div className="card map-card-custom">
            <div className="card-header fw-bold bg-white d-flex align-items-center justify-between">
              <span>Equipment Particulars</span>
              <span className="badge bg-light text-primary border font-mono-code">
                Score: {item.complianceReadinessScore}%
              </span>
            </div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-4">
                  <div className="text-secondary small">Manufacturer</div>
                  <div className="fw-semibold">{item.manufacturer || '—'}</div>
                </div>
                <div className="col-md-4">
                  <div className="text-secondary small">Model</div>
                  <div className="fw-semibold">{item.model || '—'}</div>
                </div>
                <div className="col-md-4">
                  <div className="text-secondary small">Serial Number</div>
                  <div className="fw-semibold font-mono-code">{item.serialNumber || '—'}</div>
                </div>
                <div className="col-md-6">
                  <div className="text-secondary small">Owning Organization</div>
                  <div className="fw-semibold">{item.owningOrganization}</div>
                </div>
                <div className="col-md-6">
                  <div className="text-secondary small">Parent Vessel</div>
                  <div className="fw-semibold">{parentVessel?.name ?? 'Unassigned'}</div>
                </div>
                <div className="col-md-6">
                  <div className="text-secondary small">Class Status</div>
                  <div className="fw-semibold">{item.classStatus || 'In Class'}</div>
                </div>
                <div className="col-md-6">
                  <div className="text-secondary small">Compliance Status</div>
                  <div className="fw-semibold">{item.complianceStatus || 'Compliant'}</div>
                </div>
              </div>
            </div>
          </div>

          {linkedSets.length > 0 && (
            <div className="card map-card-custom">
              <div className="card-header fw-bold bg-white">Linked Assurance Sets (via parent vessel)</div>
              <div className="list-group list-group-flush">
                {linkedSets.map((set) => (
                  <button
                    key={set.id}
                    type="button"
                    className="list-group-item list-group-item-action d-flex justify-between align-items-center"
                    onClick={() => setCurrentHashView('assurance-sets', set.id)}
                  >
                    <span>{set.title}</span>
                    <span className="badge bg-light text-dark border">{set.stage}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* Equipment Photo Upload & Gallery Manager Modal                            */}
      {/* ========================================================================= */}
      {showPhotoUploadModal && canManagePhotos && (
        <div
          className="modal show d-block map-modal-backdrop"
          tabIndex={-1}
          style={{ zIndex: 1060 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPhotoUploadModal(false);
          }}
        >
          <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content bg-white text-dark border shadow-lg overflow-hidden">
              {/* Header */}
              <div
                className="modal-header d-flex align-items-center justify-content-between px-4 py-3"
                style={{ backgroundColor: '#0B1B2B', color: '#FFFFFF' }}
              >
                <div className="d-flex align-items-center gap-2">
                  <div className="p-2 bg-primary-subtle text-primary rounded-3">
                    <Camera className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h5 className="modal-title fw-bold text-white m-0" style={{ fontSize: '1.05rem' }}>
                      Manage Equipment Photography
                    </h5>
                    <div className="small font-mono-code" style={{ color: '#94A3B8' }}>
                      {item.name} · {item.category}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-sm text-white p-2 border-0 bg-transparent opacity-75 hover-opacity-100"
                  onClick={() => setShowPhotoUploadModal(false)}
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="modal-body p-4" style={{ backgroundColor: '#F8FAFC' }}>
                <div className="card border p-3 shadow-2xs mb-3 bg-white rounded-3">
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <div>
                      <div className="fw-bold text-dark small">Equipment Photo Gallery ({modalPhotos.length})</div>
                      <div className="text-secondary" style={{ fontSize: '0.72rem' }}>
                        Click a photo to set as cover. Use crop or delete buttons on each image.
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1.5 fw-semibold"
                      onClick={() => setShowAddPhotoModal(true)}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add / Upload Photo</span>
                    </button>
                  </div>

                  {/* Photo Grid */}
                  <div className="row g-2.5">
                    {modalPhotos.map((pUrl, pIdx) => {
                      const isCover = photoModalUrl === pUrl || (!photoModalUrl && pIdx === 0);
                      const isDragged = draggedPhotoIdx === pIdx;
                      const isDragOver = dragOverPhotoIdx === pIdx;

                      return (
                        <div
                          key={pIdx}
                          className="col-6 col-md-4 col-lg-3"
                          draggable
                          onDragStart={() => setDraggedPhotoIdx(pIdx)}
                          onDragOver={(e) => {
                            e.preventDefault();
                            setDragOverPhotoIdx(pIdx);
                          }}
                          onDragEnd={() => {
                            if (draggedPhotoIdx !== null && dragOverPhotoIdx !== null && draggedPhotoIdx !== dragOverPhotoIdx) {
                              const updated = [...modalPhotos];
                              const [moved] = updated.splice(draggedPhotoIdx, 1);
                              updated.splice(dragOverPhotoIdx, 0, moved);
                              setModalPhotos(updated);
                            }
                            setDraggedPhotoIdx(null);
                            setDragOverPhotoIdx(null);
                          }}
                        >
                          <div
                            className={`position-relative border rounded-2 overflow-hidden cursor-pointer transition-all ${
                              isCover ? 'border-primary ring-2 ring-primary shadow-xs' : 'border-secondary-subtle'
                            } ${isDragged ? 'opacity-50' : ''} ${isDragOver ? 'border-warning ring-2 ring-warning' : ''}`}
                            style={{ height: '95px', backgroundColor: '#0B1B2B' }}
                            onClick={() => setPhotoModalUrl(pUrl)}
                            title="Click to select as primary cover photo"
                          >
                            <img src={pUrl} alt="" className="w-100 h-100 object-fit-cover" />

                            {/* Cover Badge */}
                            {isCover && (
                              <div
                                className="position-absolute top-0 start-0 px-1.5 py-0.5 text-white fw-bold"
                                style={{ background: '#0B1B2B', fontSize: '0.62rem', borderBottomRightRadius: '4px' }}
                              >
                                Cover
                              </div>
                            )}

                            {/* Index badge */}
                            <div
                              className="position-absolute bottom-0 start-0 px-1 py-0.5 text-white font-mono-code"
                              style={{ background: 'rgba(0,0,0,0.65)', fontSize: '0.55rem', borderTopRightRadius: '3px' }}
                            >
                              #{pIdx + 1}
                            </div>

                            {/* Action Buttons */}
                            <div className="position-absolute top-0 end-0 d-flex align-items-center gap-1 m-1">
                              <button
                                type="button"
                                className="btn btn-xs btn-primary p-0 d-flex align-items-center justify-content-center rounded-circle border border-white shadow-sm"
                                style={{ width: '22px', height: '22px' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCropTargetIdx(pIdx);
                                  setCropModalImageSrc(pUrl);
                                  setIsCropModalOpen(true);
                                }}
                                title="Crop photo"
                              >
                                <Crop className="w-3 h-3 text-white" strokeWidth={2.2} />
                              </button>
                              {modalPhotos.length > 1 && (
                                <button
                                  type="button"
                                  className="btn btn-xs btn-danger p-0 d-flex align-items-center justify-content-center rounded-circle border border-white shadow-sm"
                                  style={{ width: '22px', height: '22px' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const updated = modalPhotos.filter((_, i) => i !== pIdx);
                                    setModalPhotos(updated);
                                    if (isCover) {
                                      setPhotoModalUrl(updated.length > 0 ? updated[0] : '');
                                    }
                                  }}
                                  title="Delete photo"
                                >
                                  <X className="w-3 h-3 text-white" strokeWidth={2.2} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="modal-footer border-top bg-white d-flex align-items-center justify-content-between p-3">
                <div>
                  {(item.imageUrl || modalPhotos.length > 0) && (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1.5"
                      onClick={() => {
                        const updated: EquipmentAsset = {
                          ...item,
                          imageUrl: undefined,
                          photos: undefined,
                        };
                        updateEquipment(updated);
                        const defaultStock = getEquipmentStockPhoto(item.id, item.name, item.category);
                        setPhotoModalUrl(defaultStock);
                        setModalPhotos([defaultStock]);
                        setSelectedViewPhotoUrl(defaultStock);
                        setShowPhotoUploadModal(false);
                        setToastMessage(`Photos for ${item.name} reset to default stock.`);
                        setTimeout(() => setToastMessage(null), 3500);
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Reset to Default Stock</span>
                    </button>
                  )}
                </div>

                <div className="d-flex align-items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => setShowPhotoUploadModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary fw-semibold d-inline-flex align-items-center gap-1.5"
                    onClick={() => {
                      const finalCover = photoModalUrl.trim() || (modalPhotos.length > 0 ? modalPhotos[0] : '');
                      const updated: EquipmentAsset = {
                        ...item,
                        imageUrl: finalCover || undefined,
                        photos: modalPhotos.length > 0 ? modalPhotos : undefined,
                      };
                      updateEquipment(updated);
                      setSelectedViewPhotoUrl(finalCover);
                      setShowPhotoUploadModal(false);
                      setToastMessage(`Photos for ${item.name} successfully updated.`);
                      setTimeout(() => setToastMessage(null), 3500);
                    }}
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Photos ({modalPhotos.length})</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Add Photo Options Modal                                                  */}
      {/* ========================================================================= */}
      {showAddPhotoModal && canManagePhotos && (
        <div
          className="modal show d-block map-modal-backdrop"
          tabIndex={-1}
          style={{ zIndex: 1065 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAddPhotoModal(false);
          }}
        >
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content bg-white text-dark border shadow-lg">
              <div className="modal-header border-bottom bg-light d-flex align-items-center justify-content-between p-3">
                <div className="d-flex align-items-center gap-2">
                  <div className="p-2 bg-primary-subtle text-primary rounded-3">
                    <Camera className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h5 className="modal-title fw-bold text-dark m-0" style={{ fontSize: '1.05rem' }}>
                      Add Equipment Photo
                    </h5>
                    <div className="text-secondary small font-mono-code">
                      {item.name} · Choose upload, curated stock, or image link
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowAddPhotoModal(false)}
                  aria-label="Close"
                />
              </div>

              <div className="modal-body p-4">
                {/* Option A: Upload & Crop */}
                <div className="p-3 bg-light border rounded shadow-2xs mb-3">
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <span className="fw-bold text-dark small">Option A: Upload &amp; Crop New Equipment Image</span>
                    <span className="text-secondary" style={{ fontSize: '0.75rem' }}>JPEG, PNG, WEBP</span>
                  </div>

                  <input
                    type="file"
                    ref={photoFileInputRef}
                    className="d-none"
                    accept="image/png,image/jpeg,image/webp,image/jpg"
                    onChange={(e) => {
                      const files = e.target.files;
                      if (files && files.length > 0) {
                        const file = files[0];
                        const reader = new FileReader();
                        reader.onload = () => {
                          if (typeof reader.result === 'string') {
                            setShowAddPhotoModal(false);
                            setCropTargetIdx(null);
                            setCropModalImageSrc(reader.result);
                            setIsCropModalOpen(true);
                          }
                        };
                        reader.readAsDataURL(file);
                        e.target.value = '';
                      }
                    }}
                  />

                  <div
                    className="border border-dashed border-primary rounded bg-white p-3 text-center cursor-pointer hover-bg-light transition-all d-flex flex-column align-items-center justify-content-center gap-1.5"
                    style={{ borderStyle: 'dashed', borderWidth: '1.5px' }}
                    onClick={() => photoFileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const files = e.dataTransfer.files;
                      if (files && files.length > 0) {
                        const file = files[0];
                        const reader = new FileReader();
                        reader.onload = () => {
                          if (typeof reader.result === 'string') {
                            setShowAddPhotoModal(false);
                            setCropTargetIdx(null);
                            setCropModalImageSrc(reader.result);
                            setIsCropModalOpen(true);
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  >
                    <Upload className="w-6 h-6 text-primary" />
                    <span className="small text-dark fw-semibold">
                      Drag &amp; drop equipment image here or <span className="text-primary text-decoration-underline">browse files</span>
                    </span>
                    <span className="text-secondary" style={{ fontSize: '0.72rem' }}>
                      Picks image and opens universal 16:9 sizing &amp; crop tool before adding to gallery.
                    </span>
                  </div>
                </div>

                {/* Option B: Curated Equipment Stock */}
                <div className="p-3 bg-light border rounded shadow-2xs mb-3">
                  <div className="fw-bold text-dark small mb-2">Option B: Select &amp; Crop from Equipment Stock Presets</div>
                  <div className="row g-2">
                    {CURATED_EQUIPMENT_PHOTOS.map((p, idx) => (
                      <div key={idx} className="col-6 col-md-3">
                        <div
                          className="position-relative border rounded overflow-hidden cursor-pointer transition-all border-secondary-subtle opacity-90 hover-opacity-100 hover:shadow-xs"
                          style={{ height: '75px' }}
                          onClick={() => {
                            setShowAddPhotoModal(false);
                            setCropTargetIdx(null);
                            setCropModalImageSrc(p.url);
                            setIsCropModalOpen(true);
                          }}
                          title={`Crop and add ${p.title}`}
                        >
                          <img src={p.url} alt={p.title} className="w-100 h-100 object-fit-cover" />
                          <div
                            className="position-absolute bottom-0 start-0 w-100 px-1 py-0.5 text-truncate text-white fw-semibold"
                            style={{ background: 'rgba(0,0,0,0.65)', fontSize: '0.62rem' }}
                          >
                            {p.title}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Option C: Direct URL */}
                <div className="p-3 bg-light border rounded shadow-2xs">
                  <label className="form-label fw-bold text-dark small mb-1" htmlFor="custom-equipment-image-url">
                    Option C: Direct Image URL
                  </label>
                  <div className="input-group input-group-sm">
                    <input
                      id="custom-equipment-image-url"
                      type="url"
                      className="form-control font-mono-code"
                      placeholder="https://images.unsplash.com/photo-..."
                      value={customPhotoUrl}
                      onChange={(e) => setCustomPhotoUrl(e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn btn-outline-primary"
                      onClick={() => {
                        const url = customPhotoUrl.trim();
                        if (url) {
                          setShowAddPhotoModal(false);
                          setCropTargetIdx(null);
                          setCropModalImageSrc(url);
                          setIsCropModalOpen(true);
                          setCustomPhotoUrl('');
                        }
                      }}
                    >
                      Crop &amp; Add
                    </button>
                  </div>
                </div>
              </div>

              <div className="modal-footer border-top bg-light d-flex justify-content-end p-3">
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => setShowAddPhotoModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Universal Equipment Image Crop Modal */}
      {isCropModalOpen && cropModalImageSrc && (
        <ImageCropModal
          isOpen={isCropModalOpen}
          imageSrc={cropModalImageSrc}
          title="Equipment Image Framing & Sizing"
          assetName={item.name}
          initialPreset="16:9"
          onSave={(croppedUrl) => {
            if (cropTargetIdx !== null && cropTargetIdx >= 0 && cropTargetIdx < modalPhotos.length) {
              const updated = [...modalPhotos];
              const oldUrl = updated[cropTargetIdx];
              updated[cropTargetIdx] = croppedUrl;
              setModalPhotos(updated);
              if (photoModalUrl === oldUrl || !photoModalUrl) {
                setPhotoModalUrl(croppedUrl);
              }
            } else {
              setModalPhotos((prev) => (!prev.includes(croppedUrl) ? [...prev, croppedUrl] : prev));
              if (!photoModalUrl) {
                setPhotoModalUrl(croppedUrl);
              }
            }
            setIsCropModalOpen(false);
            setToastMessage(`Universal image crop applied to ${item.name} gallery.`);
            setTimeout(() => setToastMessage(null), 3500);
          }}
          onClose={() => setIsCropModalOpen(false)}
        />
      )}

      <AddToProjectModal
        isOpen={showAddToProjectModal}
        onClose={() => setShowAddToProjectModal(false)}
        assetType="Equipment"
        assetId={item.id}
        assetName={item.name}
        providerOrganization={item.owningOrganization}
      />
    </div>
  );
};
