/* 
  file summary: modal dialog component for registering new crew members into the organization directory.
  responsibilities: captures full name, rank, nationality, seaman book, passport, vessel assignment, and photo/s upload with cropping tool, updating zustand store and audit log.
  role in system: launched by CrewView.tsx or CrewTable.tsx when admin or submitter clicks register crew member.
*/

import React, { useState, useEffect, useRef } from 'react';
import { Camera, Crop, Upload, UserPlus, X } from 'lucide-react';
import { useMapStore } from '../../store/useMapStore';
import { CrewMember, STCWLayer } from '../../types/crew';
import { filterVesselsForPersona } from '../../utils/rbacHelpers';
import { ImageCropModal } from './VesselImageCropModal';
import { CURATED_CREW_PHOTOS, getCrewStockPhoto } from '../../utils/vesselImageHelpers';

interface AddCrewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenUploadDoc?: (crew: CrewMember, initialLayer?: STCWLayer) => void;
  onViewCrewDetail?: (crewId: string) => void;
  initialVesselId?: string;
}

/**
  what: renders modal for registering new organization crew members.
  how: captures crew information, optional photo/s upload with cropping tool, assigns initial stcw core documents, provides post-registration layered document upload options, updates zustand store, and logs audit event.
  with what file: src/components/drawers/AddCrewModal.tsx loaded by CrewView.tsx.
*/
export const AddCrewModal: React.FC<AddCrewModalProps> = ({
  isOpen,
  onClose,
  onOpenUploadDoc,
  onViewCrewDetail,
  initialVesselId,
}) => {
  const { vessels, assuranceSets, addCrewMember, activePersona } = useMapStore();
  const availableVessels =
    activePersona === 'Administrator'
      ? vessels
      : filterVesselsForPersona(vessels, assuranceSets, activePersona);

  const [fullName, setFullName] = useState('');
  const [rank, setRank] = useState('Chief Officer');
  const [nationality, setNationality] = useState('Australian');
  const [seamansBookNo, setSeamansBookNo] = useState('');
  const [passportNo, setPassportNo] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('1988-05-15');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [currentVesselId, setCurrentVesselId] = useState(availableVessels[0]?.id || '');
  const [errorMessage, setErrorMessage] = useState('');
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [registeredCrew, setRegisteredCrew] = useState<CrewMember | null>(null);

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

  useEffect(() => {
    if (isOpen) {
      if (initialVesselId) {
        setCurrentVesselId(initialVesselId);
      } else if (vessels.length > 0) {
        setCurrentVesselId(vessels[0].id);
      }
    } else {
      setRegisteredCrew(null);
      setErrorMessage('');
      setHasAttemptedSubmit(false);
      setImageUrl('');
      setPhotos([]);
      setCustomPhotoInput('');
    }
  }, [isOpen, initialVesselId, vessels]);

  if (!isOpen) return null;

  const canManage = activePersona === 'Administrator' || activePersona === 'Submitter';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setHasAttemptedSubmit(true);

    if (!canManage) {
      setErrorMessage('Permission Denied: Registering new crew members is restricted exclusively to Administrator or Submitter roles.');
      return;
    }

    if (!fullName.trim() || !seamansBookNo.trim() || !passportNo.trim()) {
      setErrorMessage("Full Name, Seaman's Book No, and Passport No are required.");
      return;
    }

    const selectedVessel = vessels.find((v) => v.id === currentVesselId);
    const newCrewId = `MAP-CRW-2026-PERS-${String(Math.floor(100 + Math.random() * 90000)).padStart(5, '0')}`;

    const finalCover = imageUrl.trim() || (photos.length > 0 ? photos[0] : undefined);
    const finalPhotos = photos.length > 0 ? photos : (imageUrl.trim() ? [imageUrl.trim()] : undefined);

    const newCrew: CrewMember = {
      id: newCrewId,
      fullName: fullName.trim(),
      rank,
      nationality: nationality.trim() || 'Australian',
      seamansBookNo: seamansBookNo.trim(),
      passportNo: passportNo.trim(),
      dateOfBirth,
      emergencyContact: emergencyContact.trim() || '+61 400 123 456 (Next of Kin)',
      currentVesselId: selectedVessel?.id,
      currentVesselName: selectedVessel ? `${selectedVessel.name} (IMO ${selectedVessel.imoNumber})` : undefined,
      imageUrl: finalCover,
      photos: finalPhotos,
      complianceStatus: 'Fully Compliant',
      overallComplianceScore: 100,
      lastAuditedDate: new Date().toISOString().split('T')[0],
      assignments: selectedVessel
        ? [
          {
            id: `MAP-ASG-2026-ASGN-${String(Math.floor(100 + Math.random() * 90000)).padStart(5, '0')}`,
            vesselId: selectedVessel.id,
            vesselName: selectedVessel.name,
            imoNumber: selectedVessel.imoNumber,
            vesselType: selectedVessel.classificationSociety ? `${selectedVessel.classificationSociety} Vessel` : 'Offshore Support Vessel',
            rankHeld: rank,
            embarkDate: new Date().toISOString().split('T')[0],
            isCurrent: true,
          },
        ]
        : [],
      layer1CoreDocuments: [
        {
          id: `MAP-CRW-2026-STCW-${String(Math.floor(100 + Math.random() * 90000)).padStart(5, '0')}`,
          title: 'Valid International Passport',
          layer: 'Layer 1 - Universal Core',
          stcwRegulation: 'SOLAS / National Regs',
          certificateNo: passportNo.trim(),
          issuingAuthority: 'Australian Passport Office',
          issueDate: '2023-01-01',
          expiryDate: '2033-01-01',
          verificationStatus: 'Verified',
          fileName: 'passport_scan.pdf',
          fileSizeBytes: 1400000,
        },
        {
          id: `MAP-CRW-2026-STCW-${String(Math.floor(100 + Math.random() * 90000)).padStart(5, '0')}`,
          title: "National Seaman's Book (Continuous Discharge Certificate)",
          layer: 'Layer 1 - Universal Core',
          stcwRegulation: 'STCW Reg I/9',
          certificateNo: seamansBookNo.trim(),
          issuingAuthority: 'AMSA Australia',
          issueDate: '2023-01-01',
          expiryDate: '2033-01-01',
          verificationStatus: 'Verified',
          fileName: 'seamans_book_scan.pdf',
          fileSizeBytes: 2000000,
        },
      ],
      layer2Endorsements: []
    };

    addCrewMember(newCrew);

    /* reset input state and present post-registration action panel */
    setFullName('');
    setRank('Chief Officer');
    setNationality('Australian');
    setSeamansBookNo('');
    setPassportNo('');
    setDateOfBirth('1988-05-15');
    setEmergencyContact('');
    setImageUrl('');
    setPhotos([]);
    setCustomPhotoInput('');
    setErrorMessage('');
    setRegisteredCrew(newCrew);
  };

  if (registeredCrew) {
    return (
      <div className="modal fade show d-block map-modal-backdrop" tabIndex={-1} role="dialog">
        <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '620px' }}>
          <div className="modal-content shadow-lg border-0 overflow-hidden">
            <div className="modal-header bg-success text-white p-3 d-flex align-items-center justify-content-between">
              <div className="fw-bold fs-6">
                Crew Member Added
              </div>
              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={() => {
                  setRegisteredCrew(null);
                  onClose();
                }}
                aria-label="Close"
              />
            </div>
            <div className="modal-body p-4 d-flex flex-column gap-3" style={{ backgroundColor: '#F8FAFC' }}>
              <div className="alert alert-success py-2 px-3 small mb-0 font-mono-code">
                Registered <strong>{registeredCrew.fullName}</strong> ({registeredCrew.rank}) — Seaman's Book #: <strong>{registeredCrew.seamansBookNo}</strong>
              </div>

              <p className="small text-secondary mb-0">
                The crew member is added. You can now upload their documents:
              </p>

              <div className="d-flex flex-column gap-2.5">
                <button
                  type="button"
                  className="map-action-card p-3 d-flex align-items-center justify-content-between"
                  onClick={() => {
                    const target = registeredCrew;
                    setRegisteredCrew(null);
                    onClose();
                    if (onOpenUploadDoc) {
                      onOpenUploadDoc(target, 'Layer 1 - Universal Core');
                    }
                  }}
                >
                  <div>
                    <div className="fw-bold text-dark mb-0.5">Upload Core Document</div>
                    <div className="small text-secondary">Passport, Seaman's Book, BST, ENG1 Medical, Security Awareness</div>
                  </div>
                  <span className="btn btn-sm btn-primary ms-3 flex-shrink-0">Add Core Document</span>
                </button>

                <button
                  type="button"
                  className="map-action-card p-3 d-flex align-items-center justify-content-between"
                  onClick={() => {
                    const target = registeredCrew;
                    setRegisteredCrew(null);
                    onClose();
                    if (onOpenUploadDoc) {
                      onOpenUploadDoc(target, 'Layer 2 - Vessel Specific & Endorsements');
                    }
                  }}
                >
                  <div>
                    <div className="fw-bold text-dark mb-0.5">Upload Endorsement</div>
                    <div className="small text-secondary">CoC, Flag Endorsement, Advanced Tanker, IGF, DP Operator</div>
                  </div>
                  <span className="btn btn-sm btn-primary ms-3 flex-shrink-0">Add Endorsement</span>
                </button>
              </div>
            </div>
            <div className="modal-footer d-flex align-items-center justify-content-between p-3 border-top bg-white">
              {onViewCrewDetail && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => {
                    const targetId = registeredCrew.id;
                    setRegisteredCrew(null);
                    onClose();
                    onViewCrewDetail(targetId);
                  }}
                >
                  View Details
                </button>
              )}
              <button
                type="button"
                className="btn btn-sm btn-primary ms-auto"
                onClick={() => {
                  setRegisteredCrew(null);
                  onClose();
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const activeDisplayPhoto = imageUrl.trim() || (photos.length > 0 ? photos[0] : getCrewStockPhoto('PREVIEW', fullName || 'Crew Member', rank));

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
                  <UserPlus size={18} />
                </div>
                <div>
                  <h5 className="modal-title fw-bold m-0 text-white" style={{ fontSize: '1.05rem' }}>
                    Add Crew
                  </h5>
                  <p className="m-0 text-slate-400 small" style={{ fontSize: '0.78rem', color: '#94A3B8' }}>
                    Enter the crew member's details and photo.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={onClose}
                aria-label="Close"
              />
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSubmit}>
              <div className="modal-body p-4 d-flex flex-column gap-3" style={{ backgroundColor: '#F8FAFC' }}>
                {errorMessage && (
                  <div className="alert alert-danger py-2 small mb-0">
                    {errorMessage}
                  </div>
                )}

                {/* SECTION 1: Identity & Credentials */}
                <div className="card p-3 border rounded-3 bg-white shadow-2xs">
                  <div className="text-uppercase text-primary small fw-bold mb-2 pb-2 border-bottom" style={{ fontSize: '0.72rem', letterSpacing: '0.04em' }}>
                    Identity &amp; Rank
                  </div>

                  <div className="row g-3">
                    {/* Full Name & Rank */}
                    <div className="col-md-7">
                      <label className="form-label small fw-semibold text-secondary mb-1" htmlFor="crew-fullname">
                        Full Name <span className="text-danger">*</span>
                      </label>
                      <input
                        id="crew-fullname"
                        type="text"
                        className={`form-control form-control-sm bg-white text-dark border-secondary ${hasAttemptedSubmit && !fullName.trim() ? 'is-invalid' : ''}`}
                        placeholder="e.g. Capt. James Cook"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                      />
                    </div>

                    <div className="col-md-5">
                      <label className="form-label small fw-semibold text-secondary mb-1" htmlFor="crew-rank">
                        Rank <span className="text-danger">*</span>
                      </label>
                      <select
                        id="crew-rank"
                        className="form-select form-select-sm bg-white text-dark border-secondary"
                        value={rank}
                        onChange={(e) => setRank(e.target.value)}
                      >
                        <option value="Master / Ship Captain">Master</option>
                        <option value="Chief Officer">Chief Officer</option>
                        <option value="Second Officer">Second Officer</option>
                        <option value="Chief Engineer">Chief Engineer</option>
                        <option value="Second Engineer">Second Engineer</option>
                        <option value="Bosun / Deck Foreman">Bosun</option>
                        <option value="Able Seaman (AB)">Able Seaman (AB)</option>
                      </select>
                    </div>

                    {/* Nationality & Seaman's Book No */}
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold text-secondary mb-1" htmlFor="crew-nat">
                        Nationality <span className="text-danger">*</span>
                      </label>
                      <input
                        id="crew-nat"
                        type="text"
                        className={`form-control form-control-sm bg-white text-dark border-secondary ${hasAttemptedSubmit && !nationality.trim() ? 'is-invalid' : ''}`}
                        placeholder="e.g. Australian"
                        value={nationality}
                        onChange={(e) => setNationality(e.target.value)}
                        required
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-semibold text-secondary mb-1" htmlFor="crew-sb">
                        Seaman's Book No. <span className="text-danger">*</span>
                      </label>
                      <input
                        id="crew-sb"
                        type="text"
                        className={`form-control form-control-sm bg-white text-dark border-secondary font-mono-code ${hasAttemptedSubmit && !seamansBookNo.trim() ? 'is-invalid' : ''}`}
                        placeholder="e.g. SB-AU-990412"
                        value={seamansBookNo}
                        onChange={(e) => setSeamansBookNo(e.target.value)}
                        required
                      />
                    </div>

                    {/* Passport No & Date of Birth */}
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold text-secondary mb-1" htmlFor="crew-passport">
                        Passport No. <span className="text-danger">*</span>
                      </label>
                      <input
                        id="crew-passport"
                        type="text"
                        className={`form-control form-control-sm bg-white text-dark border-secondary font-mono-code ${hasAttemptedSubmit && !passportNo.trim() ? 'is-invalid' : ''}`}
                        placeholder="e.g. PA-AU-8819023"
                        value={passportNo}
                        onChange={(e) => setPassportNo(e.target.value)}
                        required
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-semibold text-secondary mb-1" htmlFor="crew-dob">
                        Date of Birth <span className="text-danger">*</span>
                      </label>
                      <input
                        id="crew-dob"
                        type="date"
                        className={`form-control form-control-sm bg-white text-dark border-secondary font-mono-code ${hasAttemptedSubmit && !dateOfBirth.trim() ? 'is-invalid' : ''}`}
                        value={dateOfBirth}
                        onChange={(e) => setDateOfBirth(e.target.value)}
                        required
                      />
                    </div>

                    {/* Vessel Assignment Dropdown */}
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold text-secondary mb-1" htmlFor="crew-vessel">
                        Vessel
                      </label>
                      <select
                        id="crew-vessel"
                        className="form-select form-select-sm bg-white text-dark border-secondary"
                        value={currentVesselId}
                        onChange={(e) => setCurrentVesselId(e.target.value)}
                      >
                        <option value="">Unassigned</option>
                        {availableVessels.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name} (IMO {v.imoNumber}) — {v.flagState}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Emergency Contact Info */}
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold text-secondary mb-1" htmlFor="crew-emergency">
                        Emergency Contact
                      </label>
                      <input
                        id="crew-emergency"
                        type="text"
                        className="form-control form-control-sm bg-white text-dark border-secondary"
                        placeholder="e.g. +61 400 123 456 (Next of Kin - Jane Cook)"
                        value={emergencyContact}
                        onChange={(e) => setEmergencyContact(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION 2: Crew Member Photos & Profile Gallery Upload */}
                <div className="card p-3 border rounded-3 bg-white shadow-2xs">
                  <div className="d-flex align-items-center justify-content-between mb-2 pb-2 border-bottom">
                    <div className="text-uppercase text-primary small fw-bold" style={{ fontSize: '0.72rem', letterSpacing: '0.04em' }}>
                      Photos
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
                    {/* Left Column: Primary Cover Preview (Square 1:1) */}
                    <div className="col-12 col-md-4 d-flex flex-column align-items-center justify-content-start">
                      <label className="form-label text-secondary small fw-semibold mb-1 align-self-start">Profile Photo</label>
                      <div
                        className="position-relative border rounded-3 overflow-hidden shadow-2xs w-100"
                        style={{ maxWidth: '140px', aspectRatio: '1 / 1', backgroundColor: '#0B1B2B' }}
                      >
                        <img
                          src={activeDisplayPhoto}
                          alt="Crew Cover Preview"
                          className="w-100 h-100 object-fit-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src =
                              'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80';
                          }}
                        />
                        <div
                          className="position-absolute bottom-0 start-0 end-0 p-1 text-center text-white font-mono-code"
                          style={{
                            background: 'linear-gradient(to top, rgba(11, 27, 43, 0.9) 0%, transparent 100%)',
                            fontSize: '0.62rem',
                          }}
                        >
                          {imageUrl ? 'Custom Photo' : photos.length > 0 ? 'Primary' : 'Stock'}
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Upload, Gallery Management & Stock Presets */}
                    <div className="col-12 col-md-8 d-flex flex-column justify-content-between">
                      <div>
                        <div className="d-flex flex-wrap align-items-center gap-2 mb-2.5">
                          <button
                            type="button"
                            className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1.5 fw-semibold"
                            style={{ fontSize: '0.78rem' }}
                            onClick={() => photoFileInputRef.current?.click()}
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>Upload Photo</span>
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
                                  style={{ width: '48px', height: '48px', aspectRatio: '1 / 1', backgroundColor: '#0B1B2B' }}
                                  onClick={() => setImageUrl(photo)}
                                  title="Click to set as cover. Drag to reorder."
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
                            Presets:
                          </div>
                          <div className="d-flex flex-wrap align-items-center gap-1.5">
                            {CURATED_CREW_PHOTOS.slice(0, 4).map((p, idx) => (
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
                                title={`Add ${p.title}`}
                              >
                                + {p.title.split('/')[0].trim()}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Custom Image URL with Crop & Add */}
                        <div>
                          <div className="input-group input-group-sm">
                            <input
                              type="url"
                              className="form-control font-mono-code"
                              placeholder="Paste a photo URL"
                              value={customPhotoInput}
                              onChange={(e) => setCustomPhotoInput(e.target.value)}
                              style={{ fontSize: '0.78rem' }}
                            />
                            <button
                              type="button"
                              className="btn btn-outline-primary fw-semibold"
                              style={{ fontSize: '0.78rem' }}
                              disabled={!customPhotoInput.trim()}
                              onClick={() => {
                                if (customPhotoInput.trim()) {
                                  setCropTargetIndex(null);
                                  setCropModalImageSrc(customPhotoInput.trim());
                                  setIsCropModalOpen(true);
                                  setCustomPhotoInput('');
                                }
                              }}
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer Controls */}
              <div className="modal-footer d-flex align-items-center justify-content-between p-3 border-top bg-white">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={onClose}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-sm btn-primary"
                  disabled={!canManage}
                >
                  Add Crew
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Image Cropping Modal */}
      <ImageCropModal
        isOpen={isCropModalOpen}
        onClose={() => {
          setIsCropModalOpen(false);
          setCropModalImageSrc('');
          setCropTargetIndex(null);
        }}
        title="Crop Photo"
        assetName={fullName || rank || 'Crew Member'}
        imageSrc={cropModalImageSrc}
        initialPreset="1:1"
        onSave={(croppedUrl) => {
          if (cropTargetIndex !== null && cropTargetIndex >= 0 && cropTargetIndex < photos.length) {
            const updated = [...photos];
            updated[cropTargetIndex] = croppedUrl;
            setPhotos(updated);
            if (cropTargetIndex === 0 || imageUrl === photos[cropTargetIndex]) {
              setImageUrl(croppedUrl);
            }
          } else {
            const updated = [...photos, croppedUrl];
            setPhotos(updated);
            if (!imageUrl || photos.length === 0) {
              setImageUrl(croppedUrl);
            }
          }
          setIsCropModalOpen(false);
          setCropModalImageSrc('');
          setCropTargetIndex(null);
        }}
      />
    </>
  );
};
