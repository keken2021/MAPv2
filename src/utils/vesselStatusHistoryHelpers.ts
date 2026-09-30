/*
  file summary: helpers for vessel status history logging, diffing, and display.
  responsibilities: tracks status dimension changes, computes durations, and resolves current status per dimension.
  role in system: consumed by useMapStore and VesselDetailView status history tab.
*/

import { UserRolePersona } from '../types/audit';
import { deriveComplianceStatus, getVesselAssetStatus } from '../types/asset';
import {
  VesselInformation,
  VesselStatusDimension,
  VesselStatusHistoryEntry,
  VESSEL_STATUS_DIMENSION_LABELS,
} from '../types/vessel';

export type TrackedVesselStatusValues = Record<VesselStatusDimension, string>;

export function getTrackedVesselStatusValues(vessel: VesselInformation): TrackedVesselStatusValues {
  const status = getVesselAssetStatus(vessel);
  return {
    availability: status.availabilityStatus,
    registration: status.registrationStatus,
    class: status.classStatus,
    compliance: status.complianceStatus,
  };
}

export function generateVesselStatusHistoryId(): string {
  return `VSH-${Math.floor(10000 + Math.random() * 90000)}`;
}

export function formatStatusDuration(from: string, to?: string): string {
  const start = new Date(from);
  const end = to ? new Date(to) : new Date();
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return '—';
  const days = Math.max(0, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  if (!to) {
    return days === 0 ? 'ongoing' : `${days} day${days === 1 ? '' : 's'} (ongoing)`;
  }
  return `${days} day${days === 1 ? '' : 's'}`;
}

export function getCurrentStatusByDimension(
  history: VesselStatusHistoryEntry[],
  vesselId: string,
): Partial<Record<VesselStatusDimension, VesselStatusHistoryEntry>> {
  const current: Partial<Record<VesselStatusDimension, VesselStatusHistoryEntry>> = {};
  history
    .filter((entry) => entry.vesselId === vesselId && !entry.effectiveTo)
    .forEach((entry) => {
      current[entry.dimension] = entry;
    });
  return current;
}

export function diffVesselStatusChanges(
  previous: VesselInformation,
  next: VesselInformation,
): Array<{ dimension: VesselStatusDimension; previousValue: string; newValue: string }> {
  const prevValues = getTrackedVesselStatusValues(previous);
  const nextValues = getTrackedVesselStatusValues(next);
  const changes: Array<{ dimension: VesselStatusDimension; previousValue: string; newValue: string }> = [];

  (Object.keys(prevValues) as VesselStatusDimension[]).forEach((dimension) => {
    if (prevValues[dimension] !== nextValues[dimension]) {
      changes.push({
        dimension,
        previousValue: prevValues[dimension],
        newValue: nextValues[dimension],
      });
    }
  });

  const prevCompliance = deriveComplianceStatus(previous.complianceReadinessScore);
  const nextCompliance = deriveComplianceStatus(next.complianceReadinessScore);
  if (
    prevCompliance !== nextCompliance &&
    !changes.some((c) => c.dimension === 'compliance')
  ) {
    changes.push({
      dimension: 'compliance',
      previousValue: prevCompliance,
      newValue: nextCompliance,
    });
  }

  return changes;
}

export function buildInitialVesselStatusHistoryEntries(
  vessel: VesselInformation,
  changedBy: string,
  changedByRole: UserRolePersona,
  effectiveFrom: string,
): VesselStatusHistoryEntry[] {
  const values = getTrackedVesselStatusValues(vessel);
  const registrationNotes = `Initial vessel registration under ${vessel.flagState} flag (${vessel.portOfRegistry}).`;

  return (Object.keys(values) as VesselStatusDimension[]).map((dimension) => ({
    id: generateVesselStatusHistoryId(),
    vesselId: vessel.id,
    dimension,
    previousValue: null,
    newValue: values[dimension],
    effectiveFrom,
    changedAt: effectiveFrom,
    changedBy,
    changedByRole,
    notes:
      dimension === 'registration'
        ? registrationNotes
        : dimension === 'compliance'
          ? `Initial compliance derived from readiness score (${vessel.complianceReadinessScore}%).`
          : undefined,
    source: dimension === 'registration' ? 'registration' : 'system',
  }));
}

export function dimensionLabel(dimension: VesselStatusDimension): string {
  return VESSEL_STATUS_DIMENSION_LABELS[dimension];
}

export function statusHistoryBadgeClass(value: string): string {
  const lower = value.toLowerCase();
  if (lower.includes('compliant') && !lower.includes('non') && !lower.includes('partial')) {
    return 'bg-success text-white';
  }
  if (lower.includes('partial') || lower.includes('progress')) return 'bg-warning text-dark';
  if (lower.includes('non') || lower.includes('unavailable') || lower.includes('expired')) {
    return 'bg-danger text-white';
  }
  if (lower.includes('available') || lower.includes('in class') || lower.includes('registered')) {
    return 'bg-success text-white';
  }
  if (lower.includes('charter') || lower.includes('maintenance') || lower.includes('pending')) {
    return 'bg-warning text-dark';
  }
  return 'bg-secondary text-white';
}
