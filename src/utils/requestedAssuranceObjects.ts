import type { AssuranceObject } from '../types/assurance';
import type { SuggestedAssuranceAsset } from '../types/notification';
import {
  crewToAssuranceObject,
  equipmentToAssuranceObject,
  vesselToAssuranceObject,
} from './assuranceTemplates';

type VesselInput = Parameters<typeof vesselToAssuranceObject>[0];
type CrewInput = Parameters<typeof crewToAssuranceObject>[0];
type EquipmentInput = Parameters<typeof equipmentToAssuranceObject>[0];

function toAssuranceObject(
  asset: SuggestedAssuranceAsset,
  vessels: VesselInput[],
  crew: CrewInput[],
  equipment: EquipmentInput[],
): AssuranceObject | undefined {
  if (asset.assetType === 'Vessel') {
    const vessel = vessels.find((v) => v.id === asset.assetId);
    return vessel ? vesselToAssuranceObject(vessel) : undefined;
  }
  if (asset.assetType === 'Crew') {
    const member = crew.find((c) => c.id === asset.assetId);
    return member ? crewToAssuranceObject(member) : undefined;
  }
  const item = equipment.find((e) => e.id === asset.assetId);
  return item ? equipmentToAssuranceObject(item) : undefined;
}

/**
 * Covered assurance objects for every object named in an assurance set request, in request order.
 * Objects that no longer exist are skipped.
 */
export function resolveRequestedAssuranceObjects(
  suggestedAssets: SuggestedAssuranceAsset[] | undefined,
  vessels: VesselInput[],
  crew: CrewInput[],
  equipment: EquipmentInput[],
): AssuranceObject[] {
  return (suggestedAssets ?? [])
    .map((asset) => toAssuranceObject(asset, vessels, crew, equipment))
    .filter((object): object is AssuranceObject => Boolean(object));
}
