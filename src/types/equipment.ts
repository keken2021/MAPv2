/*
  file summary: equipment asset data models for fleet equipment registry.
  responsibilities: defines equipment records linked optionally to a parent vessel.
  role in system: consumed by equipment views, store, and asset hierarchy tree.
*/

import { AssetStatusFields, AvailabilityStatus } from './asset';

export type EquipmentCategory =
  | 'Fire-Fighting Equipment (FFE)'
  | 'Navigation & Bridge Equipment'
  | 'Life-Saving Appliances'
  | 'Machinery & Propulsion'
  | 'Other';

export interface EquipmentAsset extends AssetStatusFields {
  id: string;
  name: string;
  equipmentIdentifier: string;
  category: EquipmentCategory;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  parentVesselId?: string;
  owningOrganization: string;
  complianceReadinessScore: number;
}

export function getEquipmentAssetStatus(equipment: EquipmentAsset): AssetStatusFields {
  return {
    availabilityStatus: equipment.availabilityStatus,
    availabilityUpdatedAt: equipment.availabilityUpdatedAt,
    registrationStatus: equipment.registrationStatus,
    registrationUpdatedAt: equipment.registrationUpdatedAt,
    classStatus: equipment.classStatus,
    classStatusUpdatedAt: equipment.classStatusUpdatedAt,
    complianceStatus: equipment.complianceStatus,
    complianceUpdatedAt: equipment.complianceUpdatedAt,
  };
}
