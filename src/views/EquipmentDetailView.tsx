/*
  file summary: equipment asset detail view with status card, photo gallery, parent vessel link, and metadata.
  responsibilities: displays equipment particulars, store-backed certificates, photo gallery, and this equipment's assurance sets.
  role in system: rendered when equipment row is selected from hierarchy or equipment list.
*/

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AssetStatusCard } from '../components/assets/AssetStatusCard';
import { AccessDeniedState } from '../components/common/AccessDeniedState';
import { DetailHeader } from '../components/common/DetailHeader';
import { StatusBadge } from '../components/common/StatusBadge';
import { EmptyState } from '../components/common/EmptyState';
import { Tabs } from '../components/common/Tabs';
import { isEquipmentOwnedByOrganization } from '../utils/projectHelpers';
import {
  filterVesselsForPersona,
  isAssuranceSetAssignedToPersona,
  isMarketplacePersona,
} from '../utils/rbacHelpers';
import { useSessionUser } from '../utils/useSessionUser';
import { getEquipmentAssetStatus, EquipmentAsset } from '../types/equipment';
import { useMapStore } from '../store/useMapStore';
import { calculateEquipmentReadiness } from '../utils/readinessHelpers';
import { formatMaritimeDate, formatReadinessScore } from '../utils/formatters';
import {
  CURATED_EQUIPMENT_PHOTOS,
  getEquipmentStockPhoto,
} from '../utils/vesselImageHelpers';
import { ImageCropModal } from '../components/modals/VesselImageCropModal';
import { AssetPhotosModal } from '../components/modals/AssetPhotosModal';
import {
  Camera,
  Crop,
  Eye,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { MasterDocument } from '../types/document';
import { UniversalDocumentPreviewModal } from '../components/modals/UniversalDocumentPreviewModal';
import { DocumentUploadModal } from '../components/modals/DocumentUploadModal';

type EquipmentDetailTab = 'overview' | 'documents' | 'assurance';

/** store documents that name this equipment id/identifier (excluding docs exclusive to unassigned sets), or that its accessible sets already attach */
function getEquipmentStoreDocuments(
  documents: MasterDocument[],
  item: EquipmentAsset,
  linkedSetDocumentIds: Set<string>,
  anySetDocumentIds: Set<string>,
  allowUnlinkedStoreDocs: boolean,
): MasterDocument[] {
  const idLower = item.id.toLowerCase();
  const tagLower = item.equipmentIdentifier.toLowerCase();
  return documents.filter((doc) => {
    if (linkedSetDocumentIds.has(doc.id)) return true;
    if (!allowUnlinkedStoreDocs || anySetDocumentIds.has(doc.id)) return false;
    if (doc.targetObjectType === 'equipment' && doc.targetObjectId === item.id) return true;
    const haystack = `${doc.id} ${doc.title} ${doc.certificateNo}`.toLowerCase();
    return haystack.includes(idLower) || haystack.includes(tagLower);
  });
}

interface EquipmentDetailViewProps {
  equipmentId: string;
}

export const EquipmentDetailView: React.FC<EquipmentDetailViewProps> = ({ equipmentId }) => {
  const {
    equipment,
    vessels,
    assuranceSets,
    documents,
    activePersona,
    activeDemoOrganization,
    setCurrentHashView,
    updateEquipment,
    updateEquipmentAvailability,
    users,
    setCreateAssuranceForAsset,
  } = useMapStore();
  const sessionUser = useSessionUser();
  const viewerOrg = activeDemoOrganization?.trim() || sessionUser?.organization?.trim() || '';

  const item = equipment.find((e) => e.id === equipmentId);
  const parentVessel = item?.parentVesselId
    ? vessels.find((v) => v.id === item.parentVesselId)
    : undefined;

  const isOwnedEquipment = Boolean(
    sessionUser && item && viewerOrg && isEquipmentOwnedByOrganization(item, viewerOrg),
  );
  const isVisibleParentVessel = Boolean(
    sessionUser &&
      item?.parentVesselId &&
      filterVesselsForPersona(
        vessels,
        assuranceSets,
        activePersona,
        activeDemoOrganization,
        sessionUser,
      ).some((v) => v.id === item.parentVesselId),
  );

  /* only sets that name this equipment AND are assigned/created by this user */
  const linkedSets = useMemo(
    () =>
      item && sessionUser
        ? assuranceSets.filter(
            (s) =>
              s.equipmentId === item.id &&
              isAssuranceSetAssignedToPersona(
                s,
                activePersona,
                activeDemoOrganization,
                sessionUser,
                users,
              ),
          )
        : [],
    [assuranceSets, item, sessionUser, activePersona, activeDemoOrganization, users],
  );

  const anySetDocumentIds = useMemo(() => {
    const ids = new Set<string>();
    assuranceSets.forEach((set) => {
      set.requirements?.forEach((req) => {
        if (req.documentId) ids.add(req.documentId);
        if (req.linkedDocumentId) ids.add(req.linkedDocumentId);
      });
    });
    return ids;
  }, [assuranceSets]);

  const linkedSetDocumentIds = useMemo(() => {
    const ids = new Set<string>();
    linkedSets.forEach((set) => {
      set.requirements?.forEach((req) => {
        if (req.documentId) ids.add(req.documentId);
        if (req.linkedDocumentId) ids.add(req.linkedDocumentId);
      });
    });
    return ids;
  }, [linkedSets]);

  const equipmentDocs = useMemo(
    () =>
      item && sessionUser
        ? getEquipmentStoreDocuments(
            documents,
            item,
            linkedSetDocumentIds,
            anySetDocumentIds,
            isOwnedEquipment || isVisibleParentVessel,
          )
        : [],
    [documents, item, sessionUser, linkedSetDocumentIds, anySetDocumentIds, isOwnedEquipment, isVisibleParentVessel],
  );

  const isAdmin = activePersona === 'Administrator';
  const isCAdmin = activePersona === 'C Admin';
  const isSubmitter = activePersona === 'Submitter';
  const canEditAvailability = isOwnedEquipment && (isAdmin || isSubmitter);
  const canManagePhotos = isOwnedEquipment && (isAdmin || isSubmitter);
  const canManageDocuments = isOwnedEquipment && (isAdmin || isSubmitter);
  /* rent is offered to admins for equipment from other organizations only */
  const canRentEquipment = Boolean(
    sessionUser &&
      item &&
      (isAdmin || isCAdmin) &&
      viewerOrg &&
      !isEquipmentOwnedByOrganization(item, viewerOrg),
  );
  const canOpenAssurance = Boolean(sessionUser && (isAdmin || isCAdmin));

  const showDocumentsTab = equipmentDocs.length > 0 || canManageDocuments;
  const showAssuranceTab = linkedSets.length > 0 || canOpenAssurance;

  const [activeTab, setActiveTab] = useState<EquipmentDetailTab>('overview');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<MasterDocument | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [versionTargetDoc, setVersionTargetDoc] = useState<MasterDocument | null>(null);

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
    const allowed: EquipmentDetailTab[] = ['overview'];
    if (showDocumentsTab) allowed.push('documents');
    if (showAssuranceTab) allowed.push('assurance');
    if (!allowed.includes(activeTab)) setActiveTab('overview');
  }, [activeTab, showDocumentsTab, showAssuranceTab]);

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
        Equipment not found.
      </div>
    );
  }

  const isAccessibleEquipment = Boolean(
    sessionUser &&
      (isOwnedEquipment ||
        linkedSets.length > 0 ||
        isVisibleParentVessel ||
        isMarketplacePersona(activePersona)),
  );
  if (!isAccessibleEquipment) {
    return <AccessDeniedState onBack={() => setCurrentHashView('equipment')} />;
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

      <DetailHeader
        title={item.name}
        status={status.complianceStatus}
        metaItems={[
          item.equipmentIdentifier,
          item.category,
          `Readiness: ${formatReadinessScore(calculateEquipmentReadiness(item, assuranceSets))}`,
        ]}
        mainAction={
          canRentEquipment ? (
            <button
              type="button"
              className="btn btn-sm btn-primary fw-semibold"
              onClick={() => {
                setCreateAssuranceForAsset({ scope: 'Equipment', assetId: item.id });
                setCurrentHashView('create-assurance-set');
              }}
            >
              Rent Equipment
            </button>
          ) : undefined
        }
      />

      <AssetStatusCard
        assetType="Equipment"
        status={status}
        canEditAvailability={canEditAvailability}
        onAvailabilityChange={(value) => updateEquipmentAvailability(item.id, value)}
      />

      <Tabs
        variant="section"
        aria-label="Equipment detail tabs"
        active={activeTab}
        onChange={(key) => setActiveTab(key as EquipmentDetailTab)}
        tabs={[
          { key: 'overview', label: 'Overview' },
          {
            key: 'documents',
            label: 'Documents',
            count: equipmentDocs.length,
            hidden: !showDocumentsTab,
          },
          {
            key: 'assurance',
            label: 'Assurance',
            count: linkedSets.length,
            hidden: !showAssuranceTab,
          },
        ]}
      />

      {/* Overview — photo and particulars only */}
      {activeTab === 'overview' && (
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
                Manage photos
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

          {canManagePhotos && (
            <div className="d-flex align-items-center justify-content-between gap-1 mb-3">
              <button
                type="button"
                className="btn btn-sm btn-outline-primary flex-fill d-flex flex-column align-items-center py-1.5 px-1 map-quick-action-btn"
                onClick={() => setShowPhotoUploadModal(true)}
                title="Manage photos"
              >
                <Camera className="w-3.5 h-3.5" />
                <span style={{ fontSize: '0.68rem' }}>{modalPhotos.length > 1 ? 'Gallery' : 'Add Photo'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Particulars & Assurance */}
        <div className="col-12 col-lg-7 col-xl-7 d-flex flex-column gap-3">
          <div className="card map-card-custom">
            <div className="card-header fw-bold bg-white">
              <span>Details</span>
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
                  <div className="text-secondary small">Organization</div>
                  <div className="fw-semibold">{item.owningOrganization}</div>
                </div>
                <div className="col-md-6">
                  <div className="text-secondary small">Vessel</div>
                  <div className="fw-semibold">
                    {parentVessel ? (
                      <button
                        type="button"
                        className="btn btn-link p-0 fw-semibold align-baseline"
                        onClick={() => setCurrentHashView('vessels', parentVessel.id)}
                      >
                        {parentVessel.name}
                      </button>
                    ) : (
                      'Unassigned'
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Documents — store certificates only */}
      {activeTab === 'documents' && (
        <div className="card map-card-custom">
          <div className="card-header fw-bold bg-white d-flex align-items-center justify-content-between">
            <span>Certificates ({equipmentDocs.length})</span>
            {canManageDocuments && (
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => {
                  setVersionTargetDoc(null);
                  setIsUploadModalOpen(true);
                }}
              >
                Upload Document
              </button>
            )}
          </div>
          <div className="table-responsive">
            <table className="table map-table-custom align-middle mb-0">
              <thead>
                <tr>
                  <th>Certificate No</th>
                  <th>Title</th>
                  <th>Issuing Authority</th>
                  <th>Expiry</th>
                  <th>Status</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {equipmentDocs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-0">
                      <EmptyState title="No document on file" />
                    </td>
                  </tr>
                ) : (
                  equipmentDocs.map((doc) => (
                    <tr key={doc.id}>
                      <td className="font-mono-code small fw-semibold text-primary">{doc.certificateNo}</td>
                      <td>{doc.title}</td>
                      <td className="small">{doc.issuingAuthority}</td>
                      <td className="font-mono-code small">{formatMaritimeDate(doc.expiryDate)}</td>
                      <td>
                        <StatusBadge value={doc.verificationStatus} />
                      </td>
                      <td className="text-end">
                        <div className="d-flex align-items-center justify-content-end gap-1">
                          {canManageDocuments && (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary"
                              onClick={() => {
                                setVersionTargetDoc(doc);
                                setIsUploadModalOpen(true);
                              }}
                              title="Upload New Version"
                            >
                              New Version
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center justify-content-center p-0"
                            style={{ width: '32px', height: '32px' }}
                            onClick={() => setPreviewDoc(doc)}
                            title="View certificate"
                            aria-label={`View ${doc.title}`}
                          >
                            <Eye size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Assurance — sets that name this equipment */}
      {activeTab === 'assurance' && (
        <div className="card map-card-custom">
          <div className="card-header p-3 border-bottom d-flex align-items-center justify-between">
            <div className="fw-bold text-dark fs-6">
              Assurance Sets ({linkedSets.length})
            </div>
            {canRentEquipment && (
              <button
                type="button"
                className="btn btn-sm btn-primary fw-semibold"
                onClick={() => {
                  setCreateAssuranceForAsset({ scope: 'Equipment', assetId: item.id });
                  setCurrentHashView('create-assurance-set');
                }}
              >
                Rent Equipment
              </button>
            )}
          </div>
          <div className="table-responsive">
            <table className="table map-table-custom align-middle mb-0">
              <thead>
                <tr>
                  <th>Set ID</th>
                  <th>Title</th>
                  <th>Stage</th>
                  <th>Created By</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {linkedSets.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-0">
                      <EmptyState title="No assurance sets for this equipment" />
                    </td>
                  </tr>
                ) : (
                  linkedSets.map((set) => (
                    <tr key={set.id}>
                      <td className="font-mono-code small">{set.id}</td>
                      <td>{set.title}</td>
                      <td>
                        <StatusBadge value={set.stage} />
                      </td>
                      <td className="small">{set.initiatorOrg}</td>
                      <td className="text-end">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => setCurrentHashView('assurance-sets', set.id)}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Equipment Photo Upload & Gallery Manager Modal                            */}
      {/* ========================================================================= */}
      <AssetPhotosModal
        isOpen={showPhotoUploadModal && canManagePhotos}
        onClose={() => setShowPhotoUploadModal(false)}
        view="manage"
        title="Manage Photos"
        subtitle={`${item.name} · ${item.category}`}
        icon={<Camera className="w-4.5 h-4.5" />}
        headerVariant="dark"
        scrollable
      >
                <div className="card border p-3 shadow-2xs mb-3 bg-white rounded-3">
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <div>
                      <div className="fw-bold text-dark small">Photos ({modalPhotos.length})</div>
                      <div className="text-secondary" style={{ fontSize: '0.72rem' }}>
                        Click a photo to set it as the cover.
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1.5 fw-semibold"
                      onClick={() => setShowAddPhotoModal(true)}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Photo</span>
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
                            title="Set as cover photo"
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
                      <span>Reset to Default</span>
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
      </AssetPhotosModal>

      {/* ========================================================================= */}
      {/* Add Photo Options Modal                                                  */}
      {/* ========================================================================= */}
      <AssetPhotosModal
        isOpen={showAddPhotoModal && canManagePhotos}
        onClose={() => setShowAddPhotoModal(false)}
        view="add"
        title="Add Photo"
        subtitle={`${item.name} · Choose upload, curated stock, or image link`}
        icon={<Camera className="w-4.5 h-4.5" />}
        zIndex={1065}
        footer={
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => setShowAddPhotoModal(false)}
          >
            Close
          </button>
        }
      >
                {/* Option A: Upload & Crop */}
                <div className="p-3 bg-light border rounded shadow-2xs mb-3">
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <span className="fw-bold text-dark small">Upload a Photo</span>
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
                      You can crop the photo before it is added.
                    </span>
                  </div>
                </div>

                {/* Option B: Curated Equipment Stock */}
                <div className="p-3 bg-light border rounded shadow-2xs mb-3">
                  <div className="fw-bold text-dark small mb-2">Choose a Preset</div>
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
                          title={`Add ${p.title}`}
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
                    Image URL
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
                      Add
                    </button>
                  </div>
                </div>

      </AssetPhotosModal>

      {/* Interactive Universal Equipment Image Crop Modal */}
      {isCropModalOpen && cropModalImageSrc && (
        <ImageCropModal
          isOpen={isCropModalOpen}
          imageSrc={cropModalImageSrc}
          title="Crop Photo"
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

      <UniversalDocumentPreviewModal
        isOpen={Boolean(previewDoc)}
        document={previewDoc}
        onClose={() => setPreviewDoc(null)}
        title={previewDoc?.title || 'Certificate'}
        subtitle={
          previewDoc
            ? `${previewDoc.certificateNo} · ${item.name} · PDF Preview`
            : undefined
        }
        extraAction={
          previewDoc && canManageDocuments ? (
            <button
              type="button"
              className="btn btn-sm btn-outline-light text-nowrap"
              onClick={() => {
                const target = previewDoc;
                setPreviewDoc(null);
                setVersionTargetDoc(target);
                setIsUploadModalOpen(true);
              }}
            >
              Upload New Version
            </button>
          ) : undefined
        }
      />

      {isUploadModalOpen && item && (
        <DocumentUploadModal
          isOpen={isUploadModalOpen}
          onClose={() => {
            setIsUploadModalOpen(false);
            setVersionTargetDoc(null);
          }}
          existingDocument={versionTargetDoc ?? undefined}
          defaultObjectType="equipment"
          defaultObjectId={item.id}
          allowVersionModeSwitch={true}
          modalTitle={
            versionTargetDoc
              ? `Upload New Version: ${versionTargetDoc.title}`
              : `Upload Document for ${item.name}`
          }
          onUploadComplete={() => {
            setIsUploadModalOpen(false);
            setVersionTargetDoc(null);
            setToastMessage('Document uploaded.');
            setTimeout(() => setToastMessage(null), 3500);
          }}
        />
      )}

    </div>
  );
};
