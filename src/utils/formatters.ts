/* 
  file summary: formatting utilities for dates, monetary figures, status badges, and maritime identifiers.
  responsibilities: converts raw dates to clean readable strings, maps ocr confidence levels to badge CSS classes, and formats IMO/MMSI numbers.
  role in system: used by table cells, details views, header banners, and drawer components.
*/

/**
  what: formats an ISO date string into a standard maritime date format (e.g. "15 SEP 2026").
  how: parses date object and outputs uppercase month abbreviation with day and 4-digit year.
  with what file: src/utils/formatters.ts used by DocumentTable.tsx, VesselDetailView.tsx, etc.
*/
export function formatMaritimeDate(dateStr: string): string {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).toUpperCase();
}

/**
  what: formats an ISO timestamp as a maritime date with UTC time (e.g. "08 OCT 2026 03:15 UTC").
  how: reuses formatMaritimeDate for the date part and appends zero-padded UTC hours and minutes.
  with what file: src/utils/formatters.ts used by NotificationPanel.tsx and NotificationsView.tsx.
*/
export function formatMaritimeDateTime(dateStr: string): string {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const day = date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).toUpperCase();
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  return `${day} ${hours}:${minutes} UTC`;
}

/**
  what: returns the css badge class for ocr confidence percentage scores.
  how: evaluates score against >=95% high, >=90% medium, <90% low thresholds.
  with what file: src/utils/formatters.ts used by ConfidenceBadge.tsx and DocumentTable.tsx.
*/
export function getOcrConfidenceBadgeClass(confidenceScore: number): string {
  if (confidenceScore >= 95) return 'badge-conf-high';
  if (confidenceScore >= 90) return 'badge-conf-med';
  return 'badge-conf-low';
}

/**
  what: calculates remaining days until certificate expiration date.
  how: computes difference between target expiry date and current date in days.
  with what file: src/utils/formatters.ts used by VesselDetailView.tsx and DocumentTable.tsx.
*/
export function getDaysUntilExpiry(expiryDateStr: string): number {
  const expiry = new Date(expiryDateStr);
  const now = new Date();
  const diffTime = expiry.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
  what: returns the css badge class and color styling for vessel operational registration status.
  how: maps awaiting orders to green, in-transit to yellow, port stay to blue, under charter to red, dry docking to grey.
  with what file: src/utils/formatters.ts used by VesselTable.tsx, VesselDetailView.tsx, etc.
*/
export function getVesselStatusBadgeClass(status: string): string {
  switch (status) {
    case 'In Operations':
    case 'Active':
      return 'bg-success text-white';
    case 'In Transit':
      return 'bg-warning text-dark';
    case 'Port Stay':
      return 'bg-primary text-white';
    case 'Under Charter':
      return 'bg-danger text-white';
    case 'Standby':
      return 'bg-info text-dark';
    case 'Maintenance':
      return 'bg-warning text-dark';
    case 'Dry Docking':
    case 'Lay-up':
      return 'bg-secondary text-white';
    case 'Decommissioned':
      return 'bg-dark text-white';
    default:
      return 'bg-secondary text-white';
  }
}

/**
  what: generates a standard-compliant Document ID following the format: MAP-[ENTITY]-[YYYY]-[CATEGORY]-[SEQ]
  example: MAP-VES-2026-STAT-00412 or MAP-CRW-2026-STCW-00101
*/
export function formatDocumentId(
  entity: 'VES' | 'CRW' | 'DOC' | 'INS' = 'VES',
  year: number | string = 2026,
  category: 'STAT' | 'CLAS' | 'SAFE' | 'IOPP' | 'LLIN' | 'TONN' | 'SECR' | 'STCW' | 'IDNT' | 'MEDC' | 'UNAS' | 'INSP' = 'STAT',
  seq?: number | string
): string {
  const seqStr = seq !== undefined
    ? String(seq).replace(/[^0-9]/g, '').padStart(5, '0')
    : String(Math.floor(100 + Math.random() * 90000)).padStart(5, '0');
  return `MAP-${entity}-${year}-${category}-${seqStr}`;
}

/* label shown for an asset or offering that no assurance evidence covers */
export const NOT_ASSESSED_LABEL = 'Not assessed';

/**
  what: formats a readiness or compliance score for display; input is the score, or null when the record has no assurance basis.
  how: returns the whole-number percentage, or the not assessed label for null and undefined.
  with what file: src/utils/formatters.ts used by equipment and marketplace views, cards, modals, exports and marketplaceHelpers.ts.
*/
export function formatReadinessScore(score: number | null | undefined): string {
  return score === null || score === undefined ? NOT_ASSESSED_LABEL : `${score}%`;
}

/**
  what: validates whether a string matches the MAP standard document ID format: MAP-[ENTITY]-[YYYY]-[CATEGORY]-[SEQ]
*/
export function isValidDocumentId(id: string): boolean {
  return /^MAP-[A-Z0-9]{3,4}-\d{4}-[A-Z0-9]{3,5}-\d{4,5}$/.test(id);
}

