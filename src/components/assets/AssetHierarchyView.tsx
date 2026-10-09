/*
  file summary: asset hierarchy tree view showing vessels and linked equipment.
  responsibilities: renders expandable tree with filters for asset type, owner, availability, and compliance.
  role in system: used by FleetRegistryView and EquipmentView (FE-3).
*/

import React, { useMemo, useState } from 'react';
import { useMapStore } from '../../store/useMapStore';
import { filterEquipmentForPersona, filterVesselsForPersona } from '../../utils/rbacHelpers';
import { deriveComplianceStatus, getVesselAssetStatus } from '../../types/asset';
import { calculateVesselReadiness } from '../../utils/readinessHelpers';
import { EquipmentAsset } from '../../types/equipment';
import { Wrench, Ship, ChevronDown, ChevronRight } from 'lucide-react';

type AssetTypeFilter = 'all' | 'vessel' | 'equipment';

interface AssetHierarchyViewProps {
  defaultAssetTypeFilter?: AssetTypeFilter;
  onSelectVessel: (vesselId: string) => void;
  onSelectEquipment: (equipmentId: string) => void;
}

export const AssetHierarchyView: React.FC<AssetHierarchyViewProps> = ({
  defaultAssetTypeFilter = 'all',
  onSelectVessel,
  onSelectEquipment,
}) => {
  const { vessels, equipment, assuranceSets, documents, activePersona } = useMapStore();
  const [expandedVessels, setExpandedVessels] = useState<Set<string>>(new Set(['VESSEL-001']));
  const [assetTypeFilter, setAssetTypeFilter] = useState<AssetTypeFilter>(defaultAssetTypeFilter);
  const [ownerFilter, setOwnerFilter] = useState('All');
  const [availabilityFilter, setAvailabilityFilter] = useState('All');
  const [complianceFilter, setComplianceFilter] = useState('All');

  const visibleVessels = useMemo(
    () => filterVesselsForPersona(vessels, assuranceSets, activePersona),
    [vessels, assuranceSets, activePersona],
  );

  const visibleEquipment = useMemo(
    () => filterEquipmentForPersona(equipment, vessels, assuranceSets, activePersona),
    [equipment, vessels, assuranceSets, activePersona],
  );

  const ownerOptions = useMemo(() => {
    const owners = new Set<string>();
    visibleVessels.forEach((v) => owners.add(v.registeredOwner));
    visibleEquipment.forEach((e) => owners.add(e.owningOrganization));
    return ['All', ...Array.from(owners).sort()];
  }, [visibleVessels, visibleEquipment]);

  const equipmentByVessel = useMemo(() => {
    const map = new Map<string, EquipmentAsset[]>();
    visibleEquipment.forEach((item) => {
      if (!item.parentVesselId) return;
      const list = map.get(item.parentVesselId) ?? [];
      list.push(item);
      map.set(item.parentVesselId, list);
    });
    return map;
  }, [visibleEquipment]);

  const equipmentMatchesFilters = (item: EquipmentAsset) => {
    if (ownerFilter !== 'All' && item.owningOrganization !== ownerFilter) return false;
    if (availabilityFilter !== 'All' && item.availabilityStatus !== availabilityFilter) return false;
    if (complianceFilter !== 'All' && item.complianceStatus !== complianceFilter) return false;
    return true;
  };

  /* compliance label of a vessel: the recorded one, else derived from its calculated readiness */
  const getVesselCompliance = (vessel: (typeof vessels)[number]): string =>
    vessel.complianceStatus || deriveComplianceStatus(calculateVesselReadiness(vessel, assuranceSets, documents));

  const filteredVessels = useMemo(() => {
    return visibleVessels.filter((vessel) => {
      if (assetTypeFilter === 'equipment') {
        return (equipmentByVessel.get(vessel.id) ?? []).some(equipmentMatchesFilters);
      }
      const status = getVesselAssetStatus(vessel);
      const compliance = getVesselCompliance(vessel);
      if (ownerFilter !== 'All' && vessel.registeredOwner !== ownerFilter) return false;
      if (availabilityFilter !== 'All' && status.availabilityStatus !== availabilityFilter) return false;
      if (complianceFilter !== 'All' && compliance !== complianceFilter) return false;
      return true;
    });
  }, [visibleVessels, assetTypeFilter, ownerFilter, availabilityFilter, complianceFilter, equipmentByVessel, assuranceSets, documents]);

  const filteredStandaloneEquipment = useMemo(() => {
    if (assetTypeFilter === 'vessel') return [];
    return visibleEquipment.filter((item) => {
      if (item.parentVesselId) return false;
      if (ownerFilter !== 'All' && item.owningOrganization !== ownerFilter) return false;
      if (availabilityFilter !== 'All' && item.availabilityStatus !== availabilityFilter) return false;
      if (complianceFilter !== 'All' && item.complianceStatus !== complianceFilter) return false;
      return true;
    });
  }, [visibleEquipment, assetTypeFilter, ownerFilter, availabilityFilter, complianceFilter]);

  const toggleVessel = (vesselId: string) => {
    setExpandedVessels((prev) => {
      const next = new Set(prev);
      if (next.has(vesselId)) next.delete(vesselId);
      else next.add(vesselId);
      return next;
    });
  };

  const renderEquipmentNode = (item: EquipmentAsset, depth: number) => {
    if (assetTypeFilter === 'vessel') return null;
    if (ownerFilter !== 'All' && item.owningOrganization !== ownerFilter) return null;
    if (availabilityFilter !== 'All' && item.availabilityStatus !== availabilityFilter) return null;
    if (complianceFilter !== 'All' && item.complianceStatus !== complianceFilter) return null;

    return (
      <div
        key={item.id}
        className="d-flex align-items-center justify-between py-2 border-bottom"
        style={{ paddingLeft: `${depth * 24}px`, cursor: 'pointer' }}
        onClick={() => onSelectEquipment(item.id)}
      >
        <div className="d-flex align-items-center gap-2">
          <Wrench className="w-4 h-4 text-slate-500 shrink-0" />
          <div>
            <div className="fw-semibold text-dark small">{item.name}</div>
            <div className="text-muted" style={{ fontSize: '0.72rem' }}>
              {item.category} · {item.equipmentIdentifier}
            </div>
          </div>
        </div>
        <div className="d-flex gap-2 align-items-center">
          <span className="badge bg-light text-dark border">{item.availabilityStatus}</span>
          <span className="badge bg-light text-dark border">{item.complianceStatus}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="card map-card-custom">
      <div className="card-header d-flex flex-wrap align-items-center gap-2 p-3 bg-white">
        <select
          className="form-select form-select-sm"
          style={{ width: '140px' }}
          value={assetTypeFilter}
          onChange={(e) => setAssetTypeFilter(e.target.value as AssetTypeFilter)}
        >
          <option value="all">All Assets</option>
          <option value="vessel">Vessels</option>
          <option value="equipment">Equipment</option>
        </select>
        <select
          className="form-select form-select-sm"
          style={{ width: '200px' }}
          value={ownerFilter}
          onChange={(e) => setOwnerFilter(e.target.value)}
        >
          {ownerOptions.map((o) => (
            <option key={o} value={o}>
              {o === 'All' ? 'All Owners' : o}
            </option>
          ))}
        </select>
        <select
          className="form-select form-select-sm"
          style={{ width: '160px' }}
          value={availabilityFilter}
          onChange={(e) => setAvailabilityFilter(e.target.value)}
        >
          <option value="All">All Availability</option>
          {['Available', 'On Charter', 'Under Maintenance', 'Unavailable', 'Pending', 'Unknown'].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          className="form-select form-select-sm"
          style={{ width: '180px' }}
          value={complianceFilter}
          onChange={(e) => setComplianceFilter(e.target.value)}
        >
          <option value="All">All Compliance</option>
          {['Compliant', 'Partially Compliant', 'In Progress', 'Non-Compliant'].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="card-body p-0">
        {filteredVessels.length === 0 && filteredStandaloneEquipment.length === 0 && (
          <div className="p-4 text-muted text-center">No assets match the selected filters.</div>
        )}

        {filteredVessels.map((vessel) => {
          const status = getVesselAssetStatus(vessel);
          const childEquipment = (equipmentByVessel.get(vessel.id) ?? []).filter((item) => {
            if (availabilityFilter !== 'All' && item.availabilityStatus !== availabilityFilter) return false;
            if (complianceFilter !== 'All' && item.complianceStatus !== complianceFilter) return false;
            return true;
          });
          const isExpanded = expandedVessels.has(vessel.id);
          const compliance = getVesselCompliance(vessel);

          return (
            <div key={vessel.id} className="border-bottom">
              <div
                className="d-flex align-items-center justify-between py-3 px-3 bg-light"
                style={{ cursor: 'pointer' }}
              >
                <div className="d-flex align-items-center gap-2 flex-grow-1" onClick={() => onSelectVessel(vessel.id)}>
                  <button
                    type="button"
                    className="btn btn-sm btn-link text-secondary p-0"
                    style={{ width: '20px' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleVessel(vessel.id);
                    }}
                  >
                    {childEquipment.length > 0 ? (
                      isExpanded ? <ChevronDown className="w-3.5 h-3.5 inline" /> : <ChevronRight className="w-3.5 h-3.5 inline" />
                    ) : (
                      <span className="text-slate-400">•</span>
                    )}
                  </button>
                  <Ship className="w-4 h-4 text-sky-600 shrink-0" />
                  <div>
                    <div className="fw-bold text-dark">{vessel.name}</div>
                    <div className="text-muted small">
                      IMO {vessel.imoNumber} · {vessel.registeredOwner}
                    </div>
                  </div>
                </div>
                <div className="d-flex gap-2">
                  <span className="badge bg-light text-dark border">{status.availabilityStatus}</span>
                  <span className="badge bg-light text-dark border">{compliance}</span>
                </div>
              </div>
              {isExpanded &&
                childEquipment.map((item) => renderEquipmentNode(item, 2))}
            </div>
          );
        })}

        {filteredStandaloneEquipment.length > 0 && (
          <div className="border-top">
            <div className="px-3 py-2 text-uppercase fw-bold text-secondary small bg-light">Unassigned Equipment</div>
            {filteredStandaloneEquipment.map((item) => renderEquipmentNode(item, 1))}
          </div>
        )}
      </div>
    </div>
  );
};
