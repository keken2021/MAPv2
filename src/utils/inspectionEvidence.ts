/*
  file summary: rules for inspection report evidence on a requirement.
  responsibilities: names the report sources, gives the default validity for a vessel's age, and works out the date a report stops being accepted.
  role in system: used by DocumentUploadModal.tsx and DocumentReviewDrawer.tsx; gap review finding G4.
*/

import type { AssuranceRequirement, InspectionReportSource } from '../types/assurance';

/* the shared inspection databases and other origins of a report (paper Table 2) */
export const INSPECTION_REPORT_SOURCES: readonly InspectionReportSource[] = ['OVID', 'eCMID', 'SIRE 2.0', 'Charterer', 'Other'];

/* illustrative acceptance periods from one charterer's published procedure (Repsol 2022), not a rule for every client */
export const INSPECTION_VALIDITY_MONTHS = 12;
export const INSPECTION_VALIDITY_MONTHS_AGED = 6;
export const INSPECTION_AGED_VESSEL_YEARS = 15;

/**
  what: true when a requirement asks for an inspection report; input is the requirement.
  how: reads its category.
  with what file: src/utils/inspectionEvidence.ts used by AssuranceDetailView.tsx and DashboardView.tsx.
*/
export function isInspectionRequirement(req: Pick<AssuranceRequirement, 'category'> | undefined | null): boolean {
  return req?.category === 'Inspection Report';
}

/**
  what: the default months an inspection is accepted for; inputs are the vessel's build year and today.
  how: 6 months for a vessel aged 15 years or more, otherwise 12.
  with what file: src/utils/inspectionEvidence.ts used by DocumentUploadModal.tsx.
*/
export function getDefaultInspectionValidityMonths(yearBuilt: number | undefined, today: Date = new Date()): number {
  if (!yearBuilt) return INSPECTION_VALIDITY_MONTHS;
  return today.getFullYear() - yearBuilt >= INSPECTION_AGED_VESSEL_YEARS
    ? INSPECTION_VALIDITY_MONTHS_AGED
    : INSPECTION_VALIDITY_MONTHS;
}

/**
  what: the ISO date an inspection report stops being accepted; inputs are the report date and the months it is valid for.
  how: adds the months to the report date; empty for an unreadable date.
  with what file: src/utils/inspectionEvidence.ts used by DocumentUploadModal.tsx and DocumentReviewDrawer.tsx.
*/
export function getInspectionValidUntil(reportDate: string, validityMonths: number): string {
  const date = new Date(reportDate);
  if (!reportDate || Number.isNaN(date.getTime()) || !validityMonths) return '';
  date.setMonth(date.getMonth() + validityMonths);
  return date.toISOString().slice(0, 10);
}
