/*
  file summary: contract period overlap check between assurance sets that cover the same asset.
  responsibilities: finds saved sets whose contract period overlaps a candidate period on the same vessel, crew member or equipment item, and words the field error.
  role in system: used by CreateAssuranceSetView.tsx (Scope step and submit) and AssuranceDetailView.tsx (inline Contract Period edit).
*/

import { AssuranceSet, AssuranceSubtype } from '../types/assurance';
import { getAssuranceSetCrewIds, getAssuranceSetCrewNames, getAssuranceSetScopes } from './assuranceTemplates';
import { formatMaritimeDate } from './formatters';

export interface ContractPeriodCandidate {
  /** id of the set being edited, so it does not conflict with itself */
  id?: string;
  scope: AssuranceSubtype;
  vesselId?: string;
  crewIds?: string[];
  equipmentId?: string;
  start: string;
  end: string;
}

export interface ContractPeriodConflict {
  set: AssuranceSet;
  /** name of the asset both sets cover */
  assetName: string;
}

/* half-open periods: a set may start on the day another ends, matching isMarketplaceItemAvailableOnDate */
export function contractPeriodsOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
  what: saved sets whose contract period overlaps the candidate's on the same asset.
  how: skips drafts and the candidate itself; a vessel matches only between two Vessel-scope sets (every set carries a host vessel), crew sets match on any shared crew member, equipment on the equipment id; Activity sets are not checked. Approved and Certified sets still count, since their contract still holds the asset.
  with what file: src/utils/assuranceOverlap.ts used by CreateAssuranceSetView.tsx and AssuranceDetailView.tsx.
*/
export function findOverlappingAssuranceSets(
  candidate: ContractPeriodCandidate,
  sets: AssuranceSet[],
): ContractPeriodConflict[] {
  const { scope, start, end } = candidate;
  if (!start || !end || start >= end || scope === 'Activity') return [];

  const conflicts: ContractPeriodConflict[] = [];
  sets.forEach((set) => {
    if (set.id === candidate.id) return;
    if (set.visibility === 'draft') return;
    if (!set.charterWindowStart || !set.charterWindowEnd) return;
    if (getAssuranceSetScopes(set)[0] !== scope) return;
    if (!contractPeriodsOverlap(start, end, set.charterWindowStart, set.charterWindowEnd)) return;

    if (scope === 'Vessel' && candidate.vesselId && set.vesselId === candidate.vesselId) {
      conflicts.push({ set, assetName: set.vesselName || set.vesselId });
    } else if (scope === 'Crew') {
      const setCrewIds = getAssuranceSetCrewIds(set);
      const setCrewNames = getAssuranceSetCrewNames(set);
      const sharedIndex = setCrewIds.findIndex((id) => (candidate.crewIds || []).includes(id));
      if (sharedIndex >= 0) conflicts.push({ set, assetName: setCrewNames[sharedIndex] });
    } else if (scope === 'Equipment' && candidate.equipmentId && set.equipmentId === candidate.equipmentId) {
      conflicts.push({ set, assetName: set.equipmentName || set.equipmentId });
    }
  });
  return conflicts;
}

/* field error for the first conflict, with a count of the rest; empty string when there is none */
export function formatOverlapError(conflicts: ContractPeriodConflict[]): string {
  if (conflicts.length === 0) return '';
  const [{ set, assetName }] = conflicts;
  const period = `${formatMaritimeDate(set.charterWindowStart)} – ${formatMaritimeDate(set.charterWindowEnd)}`;
  const more = conflicts.length > 1 ? ` and ${conflicts.length - 1} more` : '';
  return `Contract period overlaps ${set.id} (${period}) for ${assetName}${more}.`;
}
