/*
  file summary: merges a vessel's status changes, inspections, CAPA, and assurance decisions into one timeline.
  responsibilities: builds dated activity entries, newest first, and filters them by kind.
  role in system: consumed by the vessel detail Activity tab.
*/

import { AssuranceSet } from '../types/assurance';
import { CapaItem } from '../types/capa';
import { VesselStatusHistoryEntry } from '../types/vessel';
import { dimensionLabel } from './vesselStatusHistoryHelpers';

export type VesselActivityKind = 'status' | 'inspection' | 'capa' | 'decision';

export interface VesselActivityEntry {
  id: string;
  kind: VesselActivityKind;
  at: string;
  text: string;
  recordId: string;
}

export interface VesselActivitySources {
  vesselId: string;
  statusHistory: VesselStatusHistoryEntry[];
  inspections: { id: string; title: string; date: string; status: string }[];
  capaItems: CapaItem[];
  assuranceSets: Pick<
    AssuranceSet,
    | 'id'
    | 'title'
    | 'vesselId'
    | 'stage'
    | 'approverDecision'
    | 'lockedAt'
    | 'cancelledAt'
    | 'partiallyClosedAt'
    | 'complianceDeadline'
    | 'cancellationReason'
  >[];
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** Parses an ISO timestamp, an ISO day, or a "18 Sep 2026" day into UTC milliseconds. */
export function activityTime(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const raw = value.trim();
  const isoDay = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (isoDay) return Date.UTC(Number(isoDay[1]), Number(isoDay[2]) - 1, Number(isoDay[3]));
  const written = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(raw);
  if (written) {
    const month = MONTHS.indexOf(written[2].slice(0, 3).toLowerCase());
    if (month >= 0) return Date.UTC(Number(written[3]), month, Number(written[1]));
  }
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? null : parsed;
}

function isoAt(value: string | undefined): string | null {
  const time = activityTime(value);
  return time === null ? null : new Date(time).toISOString();
}

function statusText(entry: VesselStatusHistoryEntry): string {
  const label = dimensionLabel(entry.dimension);
  if (entry.previousValue) {
    return `${label} changed from ${entry.previousValue} to ${entry.newValue}`;
  }
  return `${label} set to ${entry.newValue}`;
}

function inspectionText(inspection: VesselActivitySources['inspections'][number]): string {
  const verb =
    inspection.status === 'Completed'
      ? 'completed'
      : inspection.status === 'In Progress'
        ? 'in progress'
        : 'scheduled';
  return `Inspection ${verb} — ${inspection.title}`;
}

function decisionOf(set: VesselActivitySources['assuranceSets'][number]): { at: string; text: string } | null {
  const fallback = set.lockedAt || set.cancelledAt || set.partiallyClosedAt || set.complianceDeadline;
  if (set.stage === 'Cancelled' || set.cancellationReason) {
    const at = isoAt(set.cancelledAt || fallback);
    return at ? { at, text: `Cancelled — ${set.title}` } : null;
  }
  if (set.approverDecision && set.approverDecision !== 'Pending') {
    const at = isoAt(set.lockedAt || set.partiallyClosedAt || fallback);
    const label =
      set.approverDecision === 'Returned for Correction' ? 'Returned for correction' : set.approverDecision;
    return at ? { at, text: `${label} — ${set.title}` } : null;
  }
  if (set.stage === 'Certified' || set.stage === 'Approved') {
    const at = isoAt(set.lockedAt || fallback);
    return at ? { at, text: `${set.stage} — ${set.title}` } : null;
  }
  return null;
}

/**
  what: builds one timeline for a vessel from status history, inspections, CAPA, and set decisions.
  how: keeps rows for this vessel, turns each source into a dated line, and sorts newest first.
  with what file: src/utils/vesselActivityHelpers.ts used by VesselActivityTab.tsx.
*/
export function buildVesselActivity(sources: VesselActivitySources): VesselActivityEntry[] {
  const entries: VesselActivityEntry[] = [];

  sources.statusHistory
    .filter((entry) => entry.vesselId === sources.vesselId)
    .forEach((entry) => {
      const at = isoAt(entry.changedAt);
      if (!at) return;
      entries.push({
        id: `status:${entry.id}`,
        kind: 'status',
        at,
        text: statusText(entry),
        recordId: entry.id,
      });
    });

  sources.inspections.forEach((inspection) => {
    const at = isoAt(inspection.date);
    if (!at) return;
    entries.push({
      id: `inspection:${inspection.id}`,
      kind: 'inspection',
      at,
      text: inspectionText(inspection),
      recordId: inspection.id,
    });
  });

  sources.capaItems
    .filter((item) => item.vesselId === sources.vesselId)
    .forEach((item) => {
      const raisedAt = isoAt(item.createdDate);
      if (raisedAt) {
        entries.push({
          id: `capa-raised:${item.id}`,
          kind: 'capa',
          at: raisedAt,
          text: `${item.id} raised — ${item.title}`,
          recordId: item.id,
        });
      }
      const closed = item.status === 'Verified & Closed' || Boolean(item.closedDate);
      const closedAt = isoAt(item.closedDate || (closed ? item.lastInspectedDate : undefined));
      if (closed && closedAt) {
        entries.push({
          id: `capa-closed:${item.id}`,
          kind: 'capa',
          at: closedAt,
          text: `${item.id} closed — ${item.title}`,
          recordId: item.id,
        });
      }
    });

  sources.assuranceSets
    .filter((set) => set.vesselId === sources.vesselId)
    .forEach((set) => {
      const decision = decisionOf(set);
      if (!decision) return;
      entries.push({
        id: `decision:${set.id}`,
        kind: 'decision',
        at: decision.at,
        text: decision.text,
        recordId: set.id,
      });
    });

  return entries.sort((a, b) => {
    const diff = Date.parse(b.at) - Date.parse(a.at);
    if (diff !== 0) return diff;
    return a.id.localeCompare(b.id);
  });
}

/**
  what: keeps activity entries of one kind, or every entry when the kind is all.
  how: returns the same newest-first list, narrowed to the selected kind.
  with what file: src/utils/vesselActivityHelpers.ts used by VesselActivityTab.tsx.
*/
export function filterVesselActivity(
  entries: VesselActivityEntry[],
  kind: VesselActivityKind | 'all',
): VesselActivityEntry[] {
  if (kind === 'all') return entries;
  return entries.filter((entry) => entry.kind === kind);
}
