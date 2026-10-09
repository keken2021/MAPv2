/* 
  file summary: validation utilities for maritime identifiers, statutory expiry buffers, and duplicate check validations.
  responsibilities: provides validation routines for imo numbers, official registration numbers, charter buffer checks, and contact inputs.
  role in system: used by vessel registration modal, document verification pipeline, and store actions to enforce data integrity.
*/

import { VesselInformation } from '../types/vessel';
import { AssuranceSet } from '../types/assurance';
import { EquipmentAsset } from '../types/equipment';

/**
  what: validates if a string is a valid 7-digit maritime imo number.
  how: checks regex pattern matching exactly 7 numerical digits.
  with what file: src/utils/validation.ts used by VesselModal.tsx and useMapStore.ts.
*/
export function validateImoNumber(imo: string): boolean {
  const imoRegex = /^\d{7}$/;
  return imoRegex.test(imo.trim());
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
      reason: `A campaign with the title "${match.title}" already exists (Assurance Set ID: ${match.id}). Campaign titles must be unique.`,
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
  what: checks if a certificate expiry date satisfies the mandatory 6-month (180 days) charter buffer rule.
  how: calculates the difference in days between expiry date and charter window end date.
  with what file: src/utils/validation.ts used by DocumentTable.tsx, DocumentDetailView.tsx, and AssuranceDetailView.tsx.
*/
export function checkCharterBufferPassed(expiryDateStr: string, charterEndStr: string): boolean {
  const expiry = new Date(expiryDateStr);
  const charterEnd = new Date(charterEndStr);
  const bufferMs = 180 * 24 * 60 * 60 * 1000; // 180 days buffer
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
