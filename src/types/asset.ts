/*
  file summary: shared asset status types and helpers for vessels and equipment.
  responsibilities: defines availability status enum, asset status field shape, and derivation helpers.
  role in system: consumed by AssetStatusCard, vessel/equipment detail views, and asset hierarchy tree.
*/

import { VesselParticulars, VesselRegistrationStatus } from './vessel';

export type AvailabilityStatus =
  | 'Available'
  | 'On Charter'
  | 'Under Maintenance'
  | 'Unavailable'
  | 'Pending'
  | 'Unknown';

export const AVAILABILITY_STATUS_OPTIONS: AvailabilityStatus[] = [
  'Available',
  'On Charter',
  'Under Maintenance',
  'Unavailable',
  'Pending',
  'Unknown',
];

export interface AssetStatusFields {
  availabilityStatus: AvailabilityStatus;
  availabilityUpdatedAt: string;
  registrationStatus: string;
  registrationUpdatedAt: string;
  classStatus: string;
  classStatusUpdatedAt: string;
  complianceStatus: string;
  complianceUpdatedAt: string;
}

export function mapVesselOperatingStatusToAvailability(status: VesselRegistrationStatus): AvailabilityStatus {
  switch (status) {
    case 'Under Charter':
      return 'On Charter';
    case 'Dry-Docking':
    case 'Dry Docking':
      return 'Under Maintenance';
    case 'Lay-up':
      return 'Unavailable';
    case 'Awaiting Orders':
    case 'Port Stay':
    case 'In Operations':
      return 'Available';
    case 'In-Transit':
    case 'In Transit':
      return 'Pending';
    default:
      return 'Unknown';
  }
}

export function deriveComplianceStatus(readinessScore: number): string {
  if (readinessScore >= 100) return 'Compliant';
  if (readinessScore >= 70) return 'Partially Compliant';
  if (readinessScore >= 40) return 'In Progress';
  return 'Non-Compliant';
}

export function getDefaultAssetStatus(now = new Date().toISOString()): AssetStatusFields {
  return {
    availabilityStatus: 'Unknown',
    availabilityUpdatedAt: now,
    registrationStatus: 'Registered',
    registrationUpdatedAt: now,
    classStatus: 'In Class',
    classStatusUpdatedAt: now,
    complianceStatus: 'Non-Compliant',
    complianceUpdatedAt: now,
  };
}

export function getVesselAssetStatus(vessel: VesselParticulars): AssetStatusFields {
  const now = new Date().toISOString();
  return {
    availabilityStatus: vessel.availabilityStatus ?? mapVesselOperatingStatusToAvailability(vessel.status),
    availabilityUpdatedAt: vessel.availabilityUpdatedAt ?? now,
    registrationStatus: vessel.registrationStatus ?? vessel.status,
    registrationUpdatedAt: vessel.registrationUpdatedAt ?? now,
    classStatus: vessel.classStatus ?? 'In Class',
    classStatusUpdatedAt: vessel.classStatusUpdatedAt ?? now,
    complianceStatus:
      vessel.complianceStatus ?? deriveComplianceStatus(vessel.complianceReadinessScore),
    complianceUpdatedAt: vessel.complianceUpdatedAt ?? now,
  };
}
