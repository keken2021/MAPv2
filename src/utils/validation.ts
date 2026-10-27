/* 
  file summary: validation utilities for maritime identifiers, statutory expiry buffers, and duplicate check validations.
  responsibilities: provides validation routines for imo numbers, official registration numbers, charter buffer checks, and contact inputs.
  role in system: used by vessel registration modal, document verification pipeline, and store actions to enforce data integrity.
*/

import { EXPIRY_WARNING_DAYS } from './expiryPolicy';
import { VesselInformation } from '../types/vessel';
import { AssuranceSet } from '../types/assurance';
import { EquipmentAsset } from '../types/equipment';

/**
  what: calculates the 7th check digit for a 6-digit IMO number prefix under IMO A.1117(30).
  how: weights [7, 6, 5, 4, 3, 2] on digits 1 to 6; check digit is sum modulo 10.
  with what file: src/utils/validation.ts used by validateImoNumber and documentChecks.ts.
*/
export function calculateImoCheckDigit(sixDigits: string): number {
  const digits = (sixDigits || '').replace(/\D/g, '');
  if (digits.length < 6) return -1;
  const weights = [7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((acc, weight, i) => acc + parseInt(digits[i], 10) * weight, 0);
  return sum % 10;
}

/**
  what: validates if a string is a valid 7-digit maritime imo number under IMO A.1117(30).
  how: checks 7 numerical digits and verifies that the 7th digit matches the weighted modulo 10 check digit of the first 6 digits.
  with what file: src/utils/validation.ts used by VesselModal.tsx and useMapStore.ts.
*/
export function validateImoNumber(imo: string): boolean {
  const clean = (imo || '').trim();
  const imoRegex = /^\d{7}$/;
  if (!imoRegex.test(clean)) return false;
  const expectedCheckDigit = calculateImoCheckDigit(clean.slice(0, 6));
  return parseInt(clean[6], 10) === expectedCheckDigit;
}

/**
  what: checks if an imo number or official registration number already exists in the registered fleet.
  how: iterates over active vessels and compares normalized imo and official registration numbers.
  with what file: src/utils/validation.ts used by VesselModal.tsx and useMapStore.ts.
*/
export function isDuplicateVessel(
  imoNumber: string,
  officialRegNumber: string,
  existingVessels: VesselInformation[]
): { isDuplicate: boolean; reason?: string } {
  const cleanImo = imoNumber.trim();
  const cleanReg = officialRegNumber.trim().toUpperCase();

  const imoMatch = existingVessels.find((v) => v.imoNumber === cleanImo);
  if (imoMatch) {
    return {
      isDuplicate: true,
      reason: `A vessel with IMO number ${cleanImo} (${imoMatch.name}) is already registered in MAP.`,
    };
  }

  const regMatch = existingVessels.find((v) => v.officialRegNumber.toUpperCase() === cleanReg);
  if (regMatch) {
    return {
      isDuplicate: true,
      reason: `A vessel with Official Registration Number ${cleanReg} (${regMatch.name}) is already registered in MAP.`,
    };
  }

  return { isDuplicate: false };
}

/**
  what: checks if an assurance campaign title already exists in active assurance sets to prevent duplicate campaigns.
  how: compares normalized, trimmed, case-insensitive campaign titles against existing sets.
  with what file: src/utils/validation.ts used by CreateAssuranceSetView.tsx and useMapStore.ts.
*/
export function isDuplicateCampaignTitle(
  title: string,
  existingSets: AssuranceSet[],
  excludeSetId?: string
): { isDuplicate: boolean; reason?: string } {
  const cleanTitle = title.trim().toLowerCase();
  if (!cleanTitle) {
    return { isDuplicate: false };
  }

  const match = existingSets.find(
    (s) => s.title.trim().toLowerCase() === cleanTitle && s.id !== excludeSetId
  );

  if (match) {
    return {
      isDuplicate: true,
      reason: `An assurance set titled "${match.title}" already exists (${match.id}). Titles must be unique.`,
    };
  }

  return { isDuplicate: false };
}

/**
  what: checks if an equipment identifier already exists within the fleet registry.
  how: compares normalized equipment identifier against existing equipment records.
  with what file: src/utils/validation.ts used by EquipmentModal.tsx and useMapStore.ts.
*/
export function isDuplicateEquipment(
  equipmentIdentifier: string,
  existingEquipment: EquipmentAsset[],
): { isDuplicate: boolean; reason?: string } {
  const cleanId = equipmentIdentifier.trim().toUpperCase();
  const match = existingEquipment.find((e) => e.equipmentIdentifier.toUpperCase() === cleanId);
  if (match) {
    return {
      isDuplicate: true,
      reason: `Equipment identifier ${cleanId} is already registered (${match.name}).`,
    };
  }
  return { isDuplicate: false };
}

/**
  what: generates a unique equipment record id.
  how: finds the maximum EQ-XXX sequence and increments.
  with what file: src/utils/validation.ts used by EquipmentModal.tsx.
*/
export function generateUniqueEquipmentId(existingEquipment: EquipmentAsset[]): string {
  const existingIds = new Set(existingEquipment.map((e) => e.id));
  let maxIndex = 0;
  existingEquipment.forEach((item) => {
    const numPart = parseInt(item.id.replace(/^EQ-/, ''), 10);
    if (!isNaN(numPart) && numPart > maxIndex) maxIndex = numPart;
  });
  let nextIndex = maxIndex + 1;
  let candidateId = `EQ-${String(nextIndex).padStart(3, '0')}`;
  while (existingIds.has(candidateId)) {
    nextIndex++;
    candidateId = `EQ-${String(nextIndex).padStart(3, '0')}`;
  }
  return candidateId;
}

/**
  what: generates a guaranteed unique, collision-proof transactional assurance set id.
  how: inspects existing assurance set ids, finds the maximum numeric sequence for the current year, and formats as AS-YYYY-XXX with collision check.
  with what file: src/utils/validation.ts used by CreateAssuranceSetView.tsx and useMapStore.ts.
*/
export function generateUniqueAssuranceSetId(existingSets: AssuranceSet[]): string {
  const currentYear = new Date().getFullYear();
  const yearPrefix = `AS-${currentYear}-`;
  const existingIds = new Set(existingSets.map((s) => s.id));

  let maxIndex = 0;
  existingSets.forEach((set) => {
    if (set.id && set.id.startsWith(yearPrefix)) {
      const numPart = parseInt(set.id.replace(yearPrefix, ''), 10);
      if (!isNaN(numPart) && numPart > maxIndex) {
        maxIndex = numPart;
      }
    }
  });

  let nextIndex = maxIndex + 1;
  let candidateId = `${yearPrefix}${String(nextIndex).padStart(3, '0')}`;

  /* collision safety loop to ensure transaction uniqueness */
  while (existingIds.has(candidateId)) {
    nextIndex++;
    candidateId = `${yearPrefix}${String(nextIndex).padStart(3, '0')}`;
  }

  return candidateId;
}

/**
  what: generates a unique transactional requirement identifier scoped to the parent assurance set.
  how: formats requirement code using set numerical suffix and requirement index.
  with what file: src/utils/validation.ts used by CreateAssuranceSetView.tsx.
*/
export function generateUniqueRequirementId(setId: string, index: number): string {
  const numericSuffix = setId.replace(/^AS-\d{4}-/, '').replace(/^AS-/, '');
  return `REQ-${numericSuffix}-${String(index + 1).padStart(2, '0')}`;
}

/**
  what: checks if a certificate stays valid for the warning period after the contract period ends.
  how: calculates the difference in days between expiry date and contract period end date; the buffer is EXPIRY_WARNING_DAYS (pending supervisor Q3, was 180).
  with what file: src/utils/validation.ts used by its tests.
*/
export function checkCharterBufferPassed(expiryDateStr: string, charterEndStr: string): boolean {
  const expiry = new Date(expiryDateStr);
  const charterEnd = new Date(charterEndStr);
  const bufferMs = EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000;
  return expiry.getTime() - charterEnd.getTime() >= bufferMs;
}

/**
  what: validates contact phone number format to prevent duplicate or malformed operational contacts.
  how: evaluates international phone number regex format.
  with what file: src/utils/validation.ts used by forms and user contact inputs.
*/
export function validatePhoneNumber(phone: string): boolean {
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phone.replace(/[\s-]/g, ''));
}

/**
  what: returns the local calendar date as an iso yyyy-mm-dd string; input is the date, defaulting to now.
  how: reads the local year, month and day so the result does not shift across time zones.
  with what file: src/utils/validation.ts used by validateCharterWindow and AssuranceDetailView.tsx.
*/
export function toIsoLocalDate(date: Date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
  what: validates an edited charter window; inputs are the iso start and end dates and the current date.
  how: both dates are required and must fall after today, and the end may not precede the start; returns one message per invalid field, empty when valid.
  with what file: src/utils/validation.ts used by AssuranceDetailView.tsx.
*/
export function validateCharterWindow(
  start: string,
  end: string,
  today: Date = new Date(),
): { start?: string; end?: string } {
  const errors: { start?: string; end?: string } = {};
  const todayIso = toIsoLocalDate(today);

  if (!start) {
    errors.start = 'Start date is required.';
  } else if (start <= todayIso) {
    errors.start = 'Start date must be after today.';
  }

  if (!end) {
    errors.end = 'End date is required.';
  } else if (end <= todayIso) {
    errors.end = 'End date must be after today.';
  } else if (start && end < start) {
    errors.end = 'End date cannot be before the start date.';
  }

  return errors;
}

export const COMPLIANCE_DEADLINE_REQUIRED = 'Compliance deadline is required.';
export const COMPLIANCE_DEADLINE_BEFORE_START =
  'Compliance deadline must be on or before the contract start.';

/**
  what: validates an assurance set's compliance deadline against its contract start; inputs are the two iso dates.
  how: the deadline is required, and it must fall on or before the contract start so the set is complete before the asset goes on hire.
  with what file: src/utils/validation.ts used by CreateAssuranceSetView.tsx and AssuranceDetailView.tsx.
*/
export function validateComplianceDeadline(
  deadline: string,
  contractStart: string,
): string | undefined {
  if (!deadline) return COMPLIANCE_DEADLINE_REQUIRED;
  if (contractStart && deadline > contractStart) return COMPLIANCE_DEADLINE_BEFORE_START;
  return undefined;
}

/**
  what: true when an assurance set is past its compliance deadline and is not yet approved; inputs are the set and today's date.
  how: approved and certified sets are finished, so a passed deadline is overdue only while the set is still open.
  with what file: src/utils/validation.ts used by AssuranceDetailView.tsx.
*/
export function isComplianceDeadlineOverdue(
  set: { complianceDeadline?: string; stage: string },
  today: Date = new Date(),
): boolean {
  if (set.stage === 'Approved' || set.stage === 'Certified') return false;
  if (!set.complianceDeadline) return false;
  return set.complianceDeadline < toIsoLocalDate(today);
}
