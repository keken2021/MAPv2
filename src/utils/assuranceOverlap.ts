/*
  file summary: contract period overlap check between assurance sets that cover the same asset.
  responsibilities: finds saved sets whose contract period overlaps a candidate period on the same vessel, crew member or equipment item, and words the field error.
  role in system: used by CreateAssuranceSetView.tsx (Scope tab, where the asset is picked next to the dates, and submit) and AssuranceDetailView.tsx (inline Contract Period edit).
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

/**
  what: find contract period conflicts for a specific single asset.
  how: wraps findOverlappingAssuranceSets for a vessel id, crew id, or equipment id.
  with what file: src/utils/assuranceOverlap.ts used by CreateAssuranceSetView.tsx.
*/
export function getAssetPeriodConflicts(
  scope: AssuranceSubtype,
  assetId: string,
  start: string,
  end: string,
  sets: AssuranceSet[],
  excludeId?: string,
): ContractPeriodConflict[] {
  if (!assetId || !start || !end || scope === 'Activity') return [];
  return findOverlappingAssuranceSets(
    {
      id: excludeId,
      scope,
      vesselId: scope === 'Vessel' ? assetId : undefined,
      crewIds: scope === 'Crew' ? [assetId] : undefined,
      equipmentId: scope === 'Equipment' ? assetId : undefined,
      start,
      end,
    },
    sets,
  );
}

/**
  what: checks if an asset is free of overlapping contracts for the specified period.
*/
export function isAssetAvailableForPeriod(
  scope: AssuranceSubtype,
  assetId: string,
  start: string,
  end: string,
  sets: AssuranceSet[],
  excludeId?: string,
): boolean {
  return getAssetPeriodConflicts(scope, assetId, start, end, sets, excludeId).length === 0;
}

/**
  what: calculates a demo-friendly, non-conflicting default contract period (start and end).
  how: checks existing non-draft assurance sets for the candidate asset (or across all sets if unassigned).
       Finds the latest charterWindowEnd and defaults to a non-conflicting 1-year window (2028-01-01 to 2028-12-31,
       or the day after the latest existing contract if contracts already extend beyond 2027).
  with what file: src/utils/assuranceOverlap.ts used by CreateAssuranceSetView.tsx.
*/
export function getDefaultNonConflictingContractPeriod(
  sets: AssuranceSet[],
  candidate?: Partial<ContractPeriodCandidate>,
): { start: string; end: string } {
  const relevantSets = sets.filter((set) => {
    if (set.id === candidate?.id) return false;
    if (set.visibility === 'draft') return false;
    if (!set.charterWindowStart || !set.charterWindowEnd) return false;
    if (candidate?.scope && candidate.scope !== 'Activity' && getAssuranceSetScopes(set)[0] !== candidate.scope) {
      return false;
    }
    if (candidate?.scope === 'Vessel' && candidate.vesselId && set.vesselId !== candidate.vesselId) {
      return false;
    }
    if (candidate?.scope === 'Crew' && candidate.crewIds?.length) {
      const setCrewIds = getAssuranceSetCrewIds(set);
      if (!candidate.crewIds.some((id) => setCrewIds.includes(id))) return false;
    }
    if (candidate?.scope === 'Equipment' && candidate.equipmentId && set.equipmentId !== candidate.equipmentId) {
      return false;
    }
    return true;
  });

  /* If no relevant sets exist, default to 2028-01-01 – 2028-12-31 */
  if (relevantSets.length === 0) {
    return { start: '2028-01-01', end: '2028-12-31' };
  }

  let latestEnd = '2027-12-31';
  relevantSets.forEach((s) => {
    if (s.charterWindowEnd && s.charterWindowEnd > latestEnd) {
      latestEnd = s.charterWindowEnd;
    }
  });

  if (latestEnd <= '2027-12-31') {
    return { start: '2028-01-01', end: '2028-12-31' };
  }

  /* Compute start date after latestEnd */
  const [yearStr, monthStr, dayStr] = latestEnd.split('-');
  const endDateObj = new Date(Date.UTC(Number(yearStr), Number(monthStr) - 1, Number(dayStr)));
  endDateObj.setUTCDate(endDateObj.getUTCDate() + 1);

  const startYear = endDateObj.getUTCFullYear();
  const startMonth = String(endDateObj.getUTCMonth() + 1).padStart(2, '0');
  const startDay = String(endDateObj.getUTCDate()).padStart(2, '0');
  const computedStart = `${startYear}-${startMonth}-${startDay}`;

  const computedEndDateObj = new Date(endDateObj.getTime());
  computedEndDateObj.setUTCFullYear(computedEndDateObj.getUTCFullYear() + 1);
  const endYear = computedEndDateObj.getUTCFullYear();
  const endMonth = String(computedEndDateObj.getUTCMonth() + 1).padStart(2, '0');
  const endDay = String(computedEndDateObj.getUTCDate()).padStart(2, '0');
  const computedEnd = `${endYear}-${endMonth}-${endDay}`;

  return { start: computedStart, end: computedEnd };
}
