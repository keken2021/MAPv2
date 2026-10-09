/*
  file summary: equipment registration modal for registering fleet equipment assets.
  responsibilities: captures equipment fields, optional parent vessel, photo/s upload with cropping tool, and duplicate check before confirm.
  role in system: invoked from EquipmentView when clicking Register Equipment (FE-2).
*/

import React, { useState, useRef } from 'react';
import { Camera, Crop, Upload, X } from 'lucide-react';
import { useMapStore } from '../../store/useMapStore';
import { EquipmentAsset, EquipmentCategory } from '../../types/equipment';
import { getDefaultAssetStatus, deriveComplianceStatus } from '../../types/asset';
import { isDuplicateEquipment, generateUniqueEquipmentId } from '../../utils/validation';
import { filterVesselsForPersona } from '../../utils/rbacHelpers';
import { ImageCropModal } from './VesselImageCropModal';
import { CURATED_EQUIPMENT_PHOTOS, getEquipmentStockPhoto } from '../../utils/vesselImageHelpers';

interface EquipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegistered?: (equipmentId: string) => void;
}

const CATEGORIES: EquipmentCategory[] = [
  'Fire-Fighting Equipment (FFE)',
  'Navigation & Bridge Equipment',
  'Life-Saving Appliances',
  'Machinery & Propulsion',
  'Other',
];

export const EquipmentModal: React.FC<EquipmentModalProps> = ({ isOpen, onClose, onRegistered }) => {
  const { addEquipment, equipment, vessels, assuranceSets, activePersona } = useMapStore();
  const [name, setName] = useState('');
  const [equipmentIdentifier, setEquipmentIdentifier] = useState('');
  const [category, setCategory] = useState<EquipmentCategory>('Fire-Fighting Equipment (FFE)');
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [parentVesselId, setParentVesselId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState('');

  /* Photo upload & cropping states */
  const [imageUrl, setImageUrl] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [customPhotoInput, setCustomPhotoInput] = useState('');
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [cropModalImageSrc, setCropModalImageSrc] = useState('');
  const [cropTargetIndex, setCropTargetIndex] = useState<number | null>(null);
  const [draggedPhotoIdx, setDraggedPhotoIdx] = useState<number | null>(null);
  const [dragOverPhotoIdx, setDragOverPhotoIdx] = useState<number | null>(null);
  const photoFileInputRef = useRef<HTMLInputElement>(null);

  const availableVessels = filterVesselsForPersona(vessels, assuranceSets, activePersona);
  const owningOrganization =
    activePersona === 'C Admin' ? 'Southern Basin Energy' : 'Northwind Marine Pty Ltd';

  if (!isOpen) return null;

  const runDuplicateCheck = (identifier: string) => {
    const result = isDuplicateEquipment(identifier, equipment);
    setDuplicateWarning(result.isDuplicate ? result.reason ?? 'Duplicate identifier.' : '');
    return !result.isDuplicate;
  };

  const handleResetForm = () => {
    setName('');
    setEquipmentIdentifier('');
    setManufacturer('');
    setModel('');
    setSerialNumber('');
    setParentVesselId('');
    setDuplicateWarning('');
    setErrorMessage('');
    setImageUrl('');
    setPhotos([]);
    setCustomPhotoInput('');
  };

  const handleSubmit = () => {
    setErrorMessage('');
    if (!name.trim()) {
      setErrorMessage('Equipment name is required.');
      return;
    }
    if (!equipmentIdentifier.trim()) {
      setErrorMessage('Equipment identifier is required.');
      return;
    }
    if (!runDuplicateCheck(equipmentIdentifier)) return;

    const statusDefaults = getDefaultAssetStatus();
    const finalCover = imageUrl.trim() || (photos.length > 0 ? photos[0] : undefined);
    const finalPhotos = photos.length > 0 ? photos : (imageUrl.trim() ? [imageUrl.trim()] : undefined);

    const newEquipment: EquipmentAsset = {
      id: generateUniqueEquipmentId(equipment),
      name: name.trim(),
      equipmentIdentifier: equipmentIdentifier.trim().toUpperCase(),
      category,
      manufacturer: manufacturer.trim() || undefined,
      model: model.trim() || undefined,
      serialNumber: serialNumber.trim() || undefined,
      parentVesselId: parentVesselId || undefined,
      owningOrganization,
      /* a new asset has no assurance set yet, so it is not assessed */
      complianceReadinessScore: null,
      imageUrl: finalCover,
      photos: finalPhotos,
      ...statusDefaults,
      complianceStatus: deriveComplianceStatus(0),
    };

    const result = addEquipment(newEquipment);
    if (!result.success) {
      setErrorMessage(result.message ?? 'Registration failed.');
      return;
    }

    onRegistered?.(newEquipment.id);
    onClose();
    handleResetForm();
  };

  const activeDisplayPhoto = imageUrl.trim() || (photos.length > 0 ? photos[0] : getEquipmentStockPhoto('PREVIEW', name || 'Equipment', category));

  return (
    <>
      <div className="modal fade show d-block map-modal-backdrop" tabIndex={-1} role="dialog">
        <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content shadow-lg border-0 overflow-hidden">
            {/* Modal Header */}
            <div
              className="modal-header d-flex align-items-center justify-content-between p-3 border-bottom"
              style={{ backgroundColor: '#0B1B2B', color: '#FFFFFF' }}
            >
              <div className="d-flex align-items-center gap-2">
                <div className="p-1.5 bg-primary-subtle text-primary rounded-2">
                  <Camera size={18} />
                </div>
                <h5 className="modal-title fw-bold m-0 text-white" style={{ fontSize: '1.05rem' }}>
                  Register Equipment Asset
                </h5>
              </div>
              <button
                type="button"
                className="btn btn-sm text-white border-0 bg-transparent p-1 opacity-75 hover-opacity-100"
                onClick={() => {
                  handleResetForm();
                  onClose();
                }}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="modal-body p-4" style={{ backgroundColor: '#F8FAFC' }}>
              {errorMessage && <div className="alert alert-danger py-2 small mb-3">{errorMessage}</div>}
              {duplicateWarning && <div className="alert alert-warning py-2 small mb-3">{duplicateWarning}</div>}

              {/* SECTION 1: Asset Core Details */}
              <div className="card p-3 border rounded-3 mb-3 bg-white shadow-2xs">
                <div className="text-uppercase text-primary small fw-bold mb-2.5" style={{ fontSize: '0.72rem', letterSpacing: '0.04em' }}>
                  Core Identification &amp; Classification
                </div>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold text-dark">Equipment Name <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="e.g. Fixed CO2 Fire Suppression System"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold text-dark">Equipment Identifier <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className="form-control form-control-sm font-mono-code"
                      placeholder="e.g. FFE-PE-001"
                      value={equipmentIdentifier}
                      onChange={(e) => {
                        setEquipmentIdentifier(e.target.value);
                        if (e.target.value.trim()) runDuplicateCheck(e.target.value);
                        else setDuplicateWarning('');
                      }}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold text-dark">Category <span className="text-danger">*</span></label>
                    <select
                      className="form-select form-select-sm"
                      value={category}
                      onChange={(e) => setCategory(e.target.value as EquipmentCategory)}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold text-dark">Parent Vessel (optional)</label>
                    <select
                      className="form-select form-select-sm"
                      value={parentVesselId}
                      onChange={(e) => setParentVesselId(e.target.value)}
                    >
                      <option value="">— None (Standalone / Ashore Base) —</option>
                      {availableVessels.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} (IMO {v.imoNumber})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small fw-semibold text-dark">Manufacturer</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="e.g. Novec / Minimax"
                      value={manufacturer}
                      onChange={(e) => setManufacturer(e.target.value)}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small fw-semibold text-dark">Model</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="e.g. MX-240 CO2 Bank"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small fw-semibold text-dark">Serial Number</label>
                    <input
                      type="text"
                      className="form-control form-control-sm font-mono-code"
                      placeholder="e.g. SN-99812-B"
                      value={serialNumber}
                      onChange={(e) => setSerialNumber(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: Equipment Photos & Gallery Upload */}
              <div className="card p-3 border rounded-3 bg-white shadow-2xs">
                <div className="d-flex align-items-center justify-content-between mb-2 pb-2 border-bottom">
                  <div className="text-uppercase text-primary small fw-bold" style={{ fontSize: '0.72rem', letterSpacing: '0.04em' }}>
                    Equipment Photo &amp; Gallery Upload
                  </div>
                  <span className="badge bg-light text-secondary border font-mono-code" style={{ fontSize: '0.68rem' }}>
                    {photos.length} {photos.length === 1 ? 'Photo' : 'Photos'} Queued
                  </span>
                </div>

                {/* Hidden File Input for Upload & Crop */}
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
                          setCropTargetIndex(null);
                          setCropModalImageSrc(reader.result);
                          setIsCropModalOpen(true);
                        }
                      };
                      reader.readAsDataURL(file);
                      e.target.value = '';
                    }
                  }}
                />

                <div className="row g-3">
                  {/* Left Column: Primary Cover Preview */}
                  <div className="col-12 col-md-5">
                    <label className="form-label text-secondary small fw-semibold mb-1">Cover Preview</label>
                    <div
                      className="position-relative border rounded-3 overflow-hidden shadow-2xs"
                      style={{ width: '100%', aspectRatio: '16 / 9', backgroundColor: '#0B1B2B' }}
                    >
                      <img
                        src={activeDisplayPhoto}
                        alt="Equipment Cover Preview"
                        className="w-100 h-100 object-fit-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src =
                            'https://images.unsplash.com/photo-1541888946425-d0fbb18086f6?auto=format&fit=crop&w=1000&q=80';
                        }}
                      />
                      <div
                        className="position-absolute bottom-0 start-0 end-0 p-1.5 text-center text-white font-mono-code"
                        style={{
                          background: 'linear-gradient(to top, rgba(11, 27, 43, 0.9) 0%, transparent 100%)',
                          fontSize: '0.68rem',
                        }}
                      >
                        {imageUrl ? 'Custom Cover Image' : photos.length > 0 ? 'Gallery Primary' : 'Default Category Stock'}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Upload, Gallery Management & Stock Presets */}
                  <div className="col-12 col-md-7 d-flex flex-column justify-content-between">
                    <div>
                      <div className="d-flex flex-wrap align-items-center gap-2 mb-2.5">
                        <button
                          type="button"
                          className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1.5 fw-semibold"
                          style={{ fontSize: '0.78rem' }}
                          onClick={() => photoFileInputRef.current?.click()}
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Upload &amp; Crop Image</span>
                        </button>
                        {(photos.length > 0 || imageUrl) && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            style={{ fontSize: '0.78rem' }}
                            onClick={() => {
                              setImageUrl('');
                              setPhotos([]);
                            }}
                          >
                            Clear Photos
                          </button>
                        )}
                      </div>

                      {/* Uploaded Gallery Thumbnails Strip */}
                      {photos.length > 0 && (
                        <div className="d-flex align-items-center gap-2 overflow-x-auto p-2 bg-light border rounded-3 mb-2.5">
                          {photos.map((photo, pIdx) => {
                            const isCover = photo === (imageUrl || photos[0]);
                            const isDragging = draggedPhotoIdx === pIdx;
                            const isDragOver = dragOverPhotoIdx === pIdx;
                            return (
                              <div
                                key={pIdx}
                                draggable
                                onDragStart={(e) => {
                                  setDraggedPhotoIdx(pIdx);
                                  e.dataTransfer.setData('text/plain', pIdx.toString());
                                }}
                                onDragOver={(e) => {
                                  e.preventDefault();
                                }}
                                onDragEnter={() => setDragOverPhotoIdx(pIdx)}
                                onDragEnd={() => {
                                  setDraggedPhotoIdx(null);
                                  setDragOverPhotoIdx(null);
                                }}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  if (draggedPhotoIdx !== null && draggedPhotoIdx !== pIdx) {
                                    const updated = [...photos];
                                    const [moved] = updated.splice(draggedPhotoIdx, 1);
                                    updated.splice(pIdx, 0, moved);
                                    setPhotos(updated);
                                    if (isCover || draggedPhotoIdx === 0 || pIdx === 0) {
                                      setImageUrl(updated[0]);
                                    }
                                  }
                                  setDraggedPhotoIdx(null);
                                  setDragOverPhotoIdx(null);
                                }}
                                className={`position-relative border rounded-2 overflow-hidden flex-shrink-0 cursor-pointer transition-all ${isCover ? 'border-primary ring-2 ring-primary shadow-xs' : 'border-secondary-subtle'
                                  } ${isDragging ? 'opacity-40' : ''} ${isDragOver ? 'border-warning ring-2 ring-warning' : ''}`}
                                style={{ width: '64px', height: '40px', backgroundColor: '#0B1B2B' }}
                                onClick={() => setImageUrl(photo)}
                                title="Click to set cover · Drag to reorder"
                              >
                                <img src={photo} alt="" className="w-100 h-100 object-fit-cover" />
                                {isCover && (
                                  <div
                                    className="position-absolute top-0 start-0 bg-primary text-white font-mono-code fw-bold px-1"
                                    style={{ fontSize: '0.5rem', borderBottomRightRadius: '3px' }}
                                  >
                                    Cover
                                  </div>
                                )}
                                <div className="position-absolute top-0 end-0 d-flex align-items-center gap-0.5 m-0.5">
                                  <button
                                    type="button"
                                    className="btn btn-xs btn-primary p-0 d-flex align-items-center justify-content-center rounded-circle border border-white"
                                    style={{ width: '16px', height: '16px' }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCropTargetIndex(pIdx);
                                      setCropModalImageSrc(photo);
                                      setIsCropModalOpen(true);
                                    }}
                                    title="Crop photo"
                                  >
                                    <Crop size={9} className="text-white" />
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-xs btn-danger p-0 d-flex align-items-center justify-content-center rounded-circle border border-white"
                                    style={{ width: '16px', height: '16px' }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const updated = photos.filter((_, i) => i !== pIdx);
                                      setPhotos(updated);
                                      if (isCover) {
                                        setImageUrl(updated.length > 0 ? updated[0] : '');
                                      }
                                    }}
                                    title="Remove photo"
                                  >
                                    <X size={9} className="text-white" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Stock Presets with Instant Crop */}
                      <div className="mb-2">
                        <div className="small text-secondary fw-semibold mb-1" style={{ fontSize: '0.72rem' }}>
                          Add &amp; Crop Stock Presets:
                        </div>
                        <div className="d-flex flex-wrap align-items-center gap-1.5">
                          {CURATED_EQUIPMENT_PHOTOS.slice(0, 4).map((p, idx) => (
                            <button
                              key={idx}
                              type="button"
                              className="btn btn-xs btn-outline-secondary py-0.5 px-2 rounded-pill font-mono-code"
                              style={{ fontSize: '0.68rem' }}
                              onClick={() => {
                                setCropTargetIndex(null);
                                setCropModalImageSrc(p.url);
                                setIsCropModalOpen(true);
                              }}
                              title={`Crop and add ${p.title}`}
                            >
                              + {p.title}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Direct Image URL input */}
                      <div className="d-flex align-items-center gap-2">
                        <input
                          type="url"
                          className="form-control form-control-sm font-mono-code flex-grow-1"
                          style={{ fontSize: '0.75rem' }}
                          placeholder="Or paste image URL (https://...)"
                          value={customPhotoInput}
                          onChange={(e) => setCustomPhotoInput(e.target.value)}
                        />
                        {customPhotoInput.trim() && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary py-1 px-2 flex-shrink-0"
                            style={{ fontSize: '0.75rem' }}
                            onClick={() => {
                              const url = customPhotoInput.trim();
                              if (url) {
                                setCropTargetIndex(null);
                                setCropModalImageSrc(url);
                                setIsCropModalOpen(true);
                                setCustomPhotoInput('');
                              }
                            }}
                          >
                            Crop &amp; Add
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="modal-footer border-top bg-white d-flex align-items-center justify-content-between p-3">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => {
                  handleResetForm();
                  onClose();
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm fw-semibold px-3"
                onClick={handleSubmit}
                style={{ backgroundColor: '#0B1B2B', borderColor: '#0B1B2B' }}
              >
                Confirm Registration
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Universal Image Crop & Sizing Modal */}
      {isCropModalOpen && cropModalImageSrc && (
        <ImageCropModal
          isOpen={isCropModalOpen}
          imageSrc={cropModalImageSrc}
          title="Equipment Photo Framing & Sizing"
          assetName={name.trim() || 'New Equipment Asset'}
          initialPreset="16:9"
          onSave={(croppedUrl) => {
            if (cropTargetIndex !== null && cropTargetIndex >= 0 && cropTargetIndex < photos.length) {
              const updated = [...photos];
              const oldUrl = updated[cropTargetIndex];
              updated[cropTargetIndex] = croppedUrl;
              setPhotos(updated);
              if (imageUrl === oldUrl || !imageUrl) {
                setImageUrl(croppedUrl);
              }
            } else {
              setImageUrl(croppedUrl);
              setPhotos((prev) => (!prev.includes(croppedUrl) ? [croppedUrl, ...prev] : prev));
            }
            setIsCropModalOpen(false);
          }}
          onClose={() => setIsCropModalOpen(false)}
        />
      )}
    </>
  );
};

