/*
  file summary: equipment asset detail view with status card, parent vessel link, and metadata.
  responsibilities: displays equipment particulars and linked assurance context (FE-4).
  role in system: rendered when equipment row is selected from hierarchy or equipment list.
*/

import React from 'react';
import { AssetStatusCard } from '../components/assets/AssetStatusCard';
import { getEquipmentAssetStatus } from '../types/equipment';
import { getBackButtonInfo } from '../utils/rbacHelpers';
import { useMapStore } from '../store/useMapStore';

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
    updateEquipmentAvailability,
  } = useMapStore();

  const item = equipment.find((e) => e.id === equipmentId);
  const parentVessel = item?.parentVesselId
    ? vessels.find((v) => v.id === item.parentVesselId)
    : undefined;

  const linkedSets = assuranceSets.filter((s) => s.vesselId === item?.parentVesselId);

  const isAdmin = activePersona === 'Administrator';
  const isSubmitter = activePersona === 'Submitter';
  const canEditAvailability = isAdmin || isSubmitter;

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
  const backInfo = getBackButtonInfo('equipment', 'Equipment Registry', previousHashView, activePersona, previousEntityId);

  return (
    <div className="d-flex flex-column gap-3">
      <div className="d-flex align-items-center justify-between">
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={() => setCurrentHashView(backInfo.targetView, backInfo.targetEntityId)}
        >
          {backInfo.label}
        </button>
      </div>

      <div className="card map-card-custom p-3">
        <div className="d-flex flex-wrap justify-between align-items-start gap-3">
          <div>
            <div className="text-uppercase text-secondary small fw-bold mb-1">Equipment Asset</div>
            <h2 className="h4 fw-bold text-dark mb-1">{item.name}</h2>
            <div className="text-muted small">
              {item.category} · ID {item.equipmentIdentifier}
            </div>
          </div>
          {parentVessel && (
            <button
              type="button"
              className="btn btn-sm btn-outline-primary"
              onClick={() => setCurrentHashView('vessels', parentVessel.id)}
            >
              Parent Vessel: {parentVessel.name}
            </button>
          )}
        </div>
      </div>

      <AssetStatusCard
        assetType="Equipment"
        status={status}
        canEditAvailability={canEditAvailability}
        onAvailabilityChange={(value) => updateEquipmentAvailability(item.id, value)}
      />

      <div className="card map-card-custom">
        <div className="card-header fw-bold bg-white">Equipment Particulars</div>
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
              <div className="fw-semibold">{item.serialNumber || '—'}</div>
            </div>
            <div className="col-md-6">
              <div className="text-secondary small">Owning Organization</div>
              <div className="fw-semibold">{item.owningOrganization}</div>
            </div>
            <div className="col-md-6">
              <div className="text-secondary small">Parent Vessel</div>
              <div className="fw-semibold">{parentVessel?.name ?? 'Unassigned'}</div>
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
  );
};
