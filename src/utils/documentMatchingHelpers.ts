/* 
  file summary: intelligent document auto-attachment and matching engine for chartered assets and assurance sets.
  responsibilities: automatically matches and attaches existing statutory, crew, and equipment documents linked to chartered assets into newly requested assurance campaign requirements.
  role in system: consumed by CreateAssuranceSetView, AssuranceModal, useMapStore (addAssuranceSet), and project composition services.
*/

import { AssuranceRequirement, AssuranceSubtype } from '../types/assurance';
import { MasterDocument } from '../types/document';
import { VesselInformation, StatutoryCertificateSummary } from '../types/vessel';
import { CrewMember, STCWDocumentItem } from '../types/crew';
import { EquipmentAsset } from '../types/equipment';

export interface AssetMatchingContext {
  documents: MasterDocument[];
  vessel?: VesselInformation;
  vessels?: VesselInformation[];
  crew?: CrewMember[];
  selectedCrewId?: string;
  equipment?: EquipmentAsset[];
  selectedEquipmentId?: string;
  selectedVesselId?: string;
  selectedActivityId?: string;
  targetSubtype?: AssuranceSubtype;
}

export interface MatchedDocumentResult {
  documentId: string;
  linkedDocumentId: string;
  documentTitle: string;
  documentVersion: string;
  ocrConfidence: number;
  matchedFrom: 'vault_document' | 'vessel_statutory' | 'crew_stcw' | 'equipment_cert';
}

/**
 * Normalizes text for robust fuzzy comparison (lowercased, alphanumeric tokens only).
 */
export function normalizeText(str?: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Token overlap scoring between requirement title and document title/metadata.
 */
function hasKeywordMatch(reqNorm: string, targetNorm: string, minKeywordLength = 3): boolean {
  if (!reqNorm || !targetNorm) return false;
  if (reqNorm === targetNorm) return true;
  if (targetNorm.includes(reqNorm) || reqNorm.includes(targetNorm)) return true;

  const reqTokens = reqNorm.split(' ').filter((t) => t.length >= minKeywordLength);
  const targetTokens = new Set(targetNorm.split(' ').filter((t) => t.length >= minKeywordLength));

  let matched = 0;
  for (const token of reqTokens) {
    if (targetTokens.has(token)) {
      matched++;
    }
  }

  // If at least 2 significant tokens match, or 1 token if only 1 exists
  return reqTokens.length > 0 && (matched >= 2 || (reqTokens.length === 1 && matched === 1));
}

/**
 * Evaluates whether a candidate vessel document/cert matches a vessel statutory requirement.
 */
export function matchesVesselRequirement(
  reqTitle: string,
  docTitle: string,
  docCertType?: string,
  certNo?: string
): boolean {
  const rNorm = normalizeText(reqTitle);
  const dNorm = normalizeText(docTitle);
  const typeNorm = normalizeText(docCertType);
  const certNorm = normalizeText(certNo);

  // Direct keyword matching
  if (hasKeywordMatch(rNorm, dNorm) || (typeNorm && hasKeywordMatch(rNorm, typeNorm))) {
    return true;
  }

  // Synonym mappings for standard maritime statutory certificates
  // 1. Certificate of Class
  if (rNorm.includes('class') || rNorm.includes('classification')) {
    if (dNorm.includes('class') || typeNorm.includes('class') || certNorm.includes('class') || certNorm.includes('dnv stat')) {
      return true;
    }
  }

  // 2. SOLAS / Safety Construction & Equipment / Cargo Ship Safety
  if (rNorm.includes('solas') || rNorm.includes('safety construction') || rNorm.includes('safety equipment')) {
    if (
      dNorm.includes('safety equipment') ||
      dNorm.includes('safety construction') ||
      dNorm.includes('solas') ||
      dNorm.includes('cargo ship safety') ||
      typeNorm.includes('safety') ||
      certNorm.includes('dnv se')
    ) {
      return true;
    }
  }

  // 3. Flag State Registry
  if (rNorm.includes('registry') || rNorm.includes('flag state')) {
    if (
      dNorm.includes('registry') ||
      dNorm.includes('register') ||
      dNorm.includes('flag state') ||
      certNorm.includes('reg amsa') ||
      typeNorm.includes('registry')
    ) {
      return true;
    }
  }

  // 4. Safe Manning
  if (rNorm.includes('safe manning') || rNorm.includes('manning')) {
    if (dNorm.includes('safe manning') || dNorm.includes('manning') || typeNorm.includes('manning')) {
      return true;
    }
  }

  // 5. IOPP / MARPOL
  if (rNorm.includes('iopp') || rNorm.includes('oil pollution') || rNorm.includes('marpol')) {
    if (
      dNorm.includes('iopp') ||
      dNorm.includes('oil pollution') ||
      dNorm.includes('marpol') ||
      certNorm.includes('iopp') ||
      typeNorm.includes('iopp')
    ) {
      return true;
    }
  }

  // 6. Ballast Water Management (BWM)
  if (rNorm.includes('bwm') || rNorm.includes('ballast water')) {
    if (dNorm.includes('bwm') || dNorm.includes('ballast water') || typeNorm.includes('bwm')) {
      return true;
    }
  }

  // 7. Load Line
  if (rNorm.includes('load line')) {
    if (dNorm.includes('load line') || certNorm.includes('loadline')) {
      return true;
    }
  }

  // 8. DOC ISM / SMC / ISSC
  if (rNorm.includes('doc') || rNorm.includes('ism') || rNorm.includes('safety management')) {
    if (dNorm.includes('document of compliance') || dNorm.includes('doc ism') || dNorm.includes('smc') || dNorm.includes('safety management')) {
      return true;
    }
  }

  // 9. MLC
  if (rNorm.includes('mlc') || rNorm.includes('maritime labour')) {
    if (dNorm.includes('mlc') || dNorm.includes('maritime labour') || dNorm.includes('labour')) {
      return true;
    }
  }

  return false;
}

/**
 * Evaluates whether a crew document/STCW cert matches a crew assurance requirement.
 */
export function matchesCrewRequirement(
  reqTitle: string,
  docTitle: string,
  stcwRegulation?: string,
  certNo?: string
): boolean {
  const rNorm = normalizeText(reqTitle);
  const dNorm = normalizeText(docTitle);
  const regNorm = normalizeText(stcwRegulation);
  const certNorm = normalizeText(certNo);

  if (hasKeywordMatch(rNorm, dNorm) || (regNorm && hasKeywordMatch(rNorm, regNorm))) {
    return true;
  }

  // 1. STCW CoC / Master & Officer
  if (rNorm.includes('coc') || rNorm.includes('competency') || rNorm.includes('master') || rNorm.includes('officer')) {
    if (
      dNorm.includes('coc') ||
      dNorm.includes('competency') ||
      dNorm.includes('master') ||
      dNorm.includes('officer') ||
      regNorm.includes('ii 2') ||
      regNorm.includes('iii 2')
    ) {
      return true;
    }
  }

  // 2. ENG1 / Medical Fitness
  if (rNorm.includes('eng1') || rNorm.includes('medical') || rNorm.includes('fitness')) {
    if (
      dNorm.includes('eng1') ||
      dNorm.includes('medical') ||
      dNorm.includes('fitness') ||
      certNorm.includes('eng1') ||
      regNorm.includes('mlc 2006')
    ) {
      return true;
    }
  }

  // 3. BOSIET / Safety Induction / BST
  if (rNorm.includes('bosiet') || rNorm.includes('safety induction') || rNorm.includes('basic safety') || rNorm.includes('bst')) {
    if (
      dNorm.includes('bosiet') ||
      dNorm.includes('basic safety') ||
      dNorm.includes('bst') ||
      dNorm.includes('huet') ||
      dNorm.includes('safety training') ||
      certNorm.includes('bst')
    ) {
      return true;
    }
  }

  // 4. Dynamic Positioning (DP) Logs & Certs
  if (rNorm.includes('dp') || rNorm.includes('dynamic positioning') || rNorm.includes('logbook')) {
    if (dNorm.includes('dp') || dNorm.includes('dynamic positioning') || dNorm.includes('logbook') || dNorm.includes('dpo')) {
      return true;
    }
  }

  // 5. Dangerous Goods / Chemical Handling
  if (rNorm.includes('dangerous goods') || rNorm.includes('chemical') || rNorm.includes('dg')) {
    if (dNorm.includes('dangerous goods') || dNorm.includes('chemical') || dNorm.includes('hazmat') || regNorm.includes('v 1 1')) {
      return true;
    }
  }

  // 6. Passport / Identification
  if (rNorm.includes('passport') || rNorm.includes('identification')) {
    if (dNorm.includes('passport') || certNorm.includes('pa')) {
      return true;
    }
  }

  // 7. Seaman's Book / CDC
  if (rNorm.includes('seaman') || rNorm.includes('discharge certificate')) {
    if (dNorm.includes('seaman') || dNorm.includes('discharge') || certNorm.includes('sb')) {
      return true;
    }
  }

  return false;
}

/**
 * Evaluates whether an equipment certificate matches an equipment requirement.
 */
export function matchesEquipmentRequirement(
  reqTitle: string,
  docTitle: string,
  eqName?: string
): boolean {
  const rNorm = normalizeText(reqTitle);
  const dNorm = normalizeText(docTitle);
  const eqNorm = normalizeText(eqName);

  if (hasKeywordMatch(rNorm, dNorm) || (eqNorm && hasKeywordMatch(rNorm, eqNorm))) {
    return true;
  }

  // 1. Lifting Appliances / Crane / ILO 152
  if (rNorm.includes('lifting') || rNorm.includes('crane') || rNorm.includes('ilo 152') || rNorm.includes('load test')) {
    if (
      dNorm.includes('lifting') ||
      dNorm.includes('crane') ||
      dNorm.includes('ilo 152') ||
      dNorm.includes('load test') ||
      dNorm.includes('pedestal')
    ) {
      return true;
    }
  }

  // 2. DP FMEA Proving Trial
  if (rNorm.includes('fmea') || (rNorm.includes('dp') && rNorm.includes('trial'))) {
    if (dNorm.includes('fmea') || dNorm.includes('proving trial') || dNorm.includes('dp trial')) {
      return true;
    }
  }

  // 3. Subsea ROV / Winch Pull Test
  if (rNorm.includes('rov') || rNorm.includes('winch') || rNorm.includes('pull test')) {
    if (dNorm.includes('rov') || dNorm.includes('winch') || dNorm.includes('pull test') || dNorm.includes('brake holding')) {
      return true;
    }
  }

  // 4. Helideck Safety
  if (rNorm.includes('helideck') || rNorm.includes('friction test')) {
    if (dNorm.includes('helideck') || dNorm.includes('friction test') || dNorm.includes('aviation')) {
      return true;
    }
  }

  // 5. Rigging Slings / Pad-Eye Load Test
  if (rNorm.includes('rigging') || rNorm.includes('slings') || rNorm.includes('pad eye')) {
    if (dNorm.includes('rigging') || dNorm.includes('slings') || dNorm.includes('pad eye') || dNorm.includes('spreader')) {
      return true;
    }
  }

  return false;
}

/**
 * Evaluates whether an activity document matches an activity operational requirement.
 */
export function matchesActivityRequirement(
  reqTitle: string,
  docTitle: string
): boolean {
  const rNorm = normalizeText(reqTitle);
  const dNorm = normalizeText(docTitle);

  if (hasKeywordMatch(rNorm, dNorm)) return true;

  // 1. Marine Operations Plan (MOP)
  if (rNorm.includes('mop') || rNorm.includes('marine operations plan') || rNorm.includes('method statement')) {
    if (dNorm.includes('mop') || dNorm.includes('marine operations') || dNorm.includes('method statement')) {
      return true;
    }
  }

  // 2. Risk Assessment / HAZID / HAZOP
  if (rNorm.includes('hazid') || rNorm.includes('hazop') || rNorm.includes('risk assessment')) {
    if (dNorm.includes('hazid') || dNorm.includes('hazop') || dNorm.includes('risk assessment') || dNorm.includes('task risk')) {
      return true;
    }
  }

  // 3. Dynamic Mooring & Towage
  if (rNorm.includes('mooring') || rNorm.includes('towage')) {
    if (dNorm.includes('mooring') || dNorm.includes('towage') || dNorm.includes('catenary')) {
      return true;
    }
  }

  // 4. Emergency Response / ERP / Oil Spill
  if (rNorm.includes('emergency') || rNorm.includes('oil spill') || rNorm.includes('contingency')) {
    if (dNorm.includes('emergency') || dNorm.includes('oil spill') || dNorm.includes('contingency') || dNorm.includes('erp')) {
      return true;
    }
  }

  // 5. SIMOPS Matrix
  if (rNorm.includes('simops') || rNorm.includes('simultaneous operations')) {
    if (dNorm.includes('simops') || dNorm.includes('simultaneous operations')) {
      return true;
    }
  }

  return false;
}

/**
 * Finds the best matching document for a single requirement from the provided asset context.
 */
export function findMatchingDocumentForRequirement(
  req: AssuranceRequirement,
  context: AssetMatchingContext
): MatchedDocumentResult | null {
  const subtype = req.subtype || (context.targetSubtype as AssuranceSubtype) || 'Vessel';
  const effectiveVessel = context.vessel || (context.selectedVesselId && context.vessels?.find((v) => v.id === context.selectedVesselId));

  // -------------------------------------------------------------
  // 1. VESSEL SUBTYPE MATCHING
  // -------------------------------------------------------------
  if (subtype === 'Vessel' && effectiveVessel) {
    // 1a. Search in MasterDocument Vault linked to this vessel
    const linkedVaultDocs = context.documents.filter(
      (d) =>
        d.vesselId === effectiveVessel.id ||
        (d.vesselAttributes?.vesselName &&
          d.vesselAttributes.vesselName.toLowerCase() === effectiveVessel.name.toLowerCase()) ||
        (effectiveVessel.imoNumber && d.vesselAttributes?.imoNumber === effectiveVessel.imoNumber)
    );

    for (const doc of linkedVaultDocs) {
      if (
        matchesVesselRequirement(
          req.title,
          doc.title,
          doc.vesselAttributes?.certType,
          doc.certificateNo || doc.vesselAttributes?.certificateNumber
        )
      ) {
        return {
          documentId: doc.id,
          linkedDocumentId: doc.id,
          documentTitle: doc.title,
          documentVersion: doc.currentVersion || 'v1.0',
          ocrConfidence: doc.ocrConfidence || 98,
          matchedFrom: 'vault_document',
        };
      }
    }

    // 1b. Search in Vessel's embedded statutory certificates
    if (effectiveVessel.statutoryCertificates && effectiveVessel.statutoryCertificates.length > 0) {
      for (const cert of effectiveVessel.statutoryCertificates) {
        if (matchesVesselRequirement(req.title, cert.name, undefined, cert.certificateNumber)) {
          // Check if there's a corresponding MasterDocument in vault
          const vaultDoc = context.documents.find(
            (d) =>
              d.certificateNo === cert.certificateNumber ||
              d.title.toLowerCase() === cert.name.toLowerCase()
          );

          return {
            documentId: vaultDoc ? vaultDoc.id : cert.id,
            linkedDocumentId: vaultDoc ? vaultDoc.id : cert.id,
            documentTitle: cert.name,
            documentVersion: vaultDoc?.currentVersion || 'v1.0',
            ocrConfidence: vaultDoc?.ocrConfidence || 96,
            matchedFrom: 'vessel_statutory',
          };
        }
      }
    }
  }

  // -------------------------------------------------------------
  // 2. CREW SUBTYPE MATCHING
  // -------------------------------------------------------------
  if (subtype === 'Crew') {
    const targetCrew = context.selectedCrewId
      ? context.crew?.find((c) => c.id === context.selectedCrewId)
      : (context.crew && context.crew[0]);

    if (targetCrew) {
      // 2a. Search in MasterDocument Vault for crew documents
      const crewVaultDocs = context.documents.filter(
        (d) =>
          d.entityType === 'Crew Certificate' &&
          (d.crewAttributes?.crewName?.toLowerCase() === targetCrew.fullName.toLowerCase() ||
            d.crewAttributes?.passportId === targetCrew.passportNo ||
            (effectiveVessel && d.vesselId === effectiveVessel.id))
      );

      for (const doc of crewVaultDocs) {
        if (
          matchesCrewRequirement(
            req.title,
            doc.title,
            doc.crewAttributes?.certType,
            doc.certificateNo
          )
        ) {
          return {
            documentId: doc.id,
            linkedDocumentId: doc.id,
            documentTitle: doc.title,
            documentVersion: doc.currentVersion || 'v1.0',
            ocrConfidence: doc.ocrConfidence || 98,
            matchedFrom: 'vault_document',
          };
        }
      }

      // 2b. Search in Crew's STCW Layer 1 & 2 certificates
      const allCrewCerts: STCWDocumentItem[] = [
        ...(targetCrew.layer1CoreDocuments || []),
        ...(targetCrew.layer2Endorsements || []),
      ];

      for (const cert of allCrewCerts) {
        if (matchesCrewRequirement(req.title, cert.title, cert.stcwRegulation, cert.certificateNo)) {
          const vaultDoc = context.documents.find((d) => d.id === cert.id || d.certificateNo === cert.certificateNo);

          return {
            documentId: vaultDoc ? vaultDoc.id : cert.id,
            linkedDocumentId: vaultDoc ? vaultDoc.id : cert.id,
            documentTitle: cert.title,
            documentVersion: vaultDoc?.currentVersion || 'v1.0',
            ocrConfidence: vaultDoc?.ocrConfidence || 97,
            matchedFrom: 'crew_stcw',
          };
        }
      }
    }
  }

  // -------------------------------------------------------------
  // 3. EQUIPMENT SUBTYPE MATCHING
  // -------------------------------------------------------------
  if (subtype === 'Equipment') {
    const targetEquipment = context.selectedEquipmentId
      ? context.equipment?.find((e) => e.id === context.selectedEquipmentId)
      : (context.equipment && context.equipment[0]);

    if (targetEquipment) {
      // Search in MasterDocument Vault for matching equipment registers
      const eqDocs = context.documents.filter(
        (d) =>
          (effectiveVessel && d.vesselId === effectiveVessel.id) ||
          d.title.toLowerCase().includes(targetEquipment.name.toLowerCase()) ||
          d.title.toLowerCase().includes(targetEquipment.equipmentIdentifier.toLowerCase())
      );

      for (const doc of eqDocs) {
        if (matchesEquipmentRequirement(req.title, doc.title, targetEquipment.name)) {
          return {
            documentId: doc.id,
            linkedDocumentId: doc.id,
            documentTitle: doc.title,
            documentVersion: doc.currentVersion || 'v1.0',
            ocrConfidence: doc.ocrConfidence || 95,
            matchedFrom: 'equipment_cert',
          };
        }
      }
    }
  }

  // -------------------------------------------------------------
  // 4. ACTIVITY SUBTYPE MATCHING
  // -------------------------------------------------------------
  if (subtype === 'Activity') {
    const actDocs = context.documents.filter((d) => matchesActivityRequirement(req.title, d.title));
    for (const doc of actDocs) {
      return {
        documentId: doc.id,
        linkedDocumentId: doc.id,
        documentTitle: doc.title,
        documentVersion: doc.currentVersion || 'v1.0',
        ocrConfidence: doc.ocrConfidence || 95,
        matchedFrom: 'vault_document',
      };
    }
  }

  return null;
}

/**
 * Iterates over assurance set requirements and automatically attaches matching documents from chartered assets.
 */
export function autoAttachDocumentsToRequirements(
  requirements: AssuranceRequirement[],
  context: AssetMatchingContext
): AssuranceRequirement[] {
  if (!requirements || requirements.length === 0) return [];

  return requirements.map((req) => {
    // If the requirement already has an attached document and is fulfilled, keep it intact
    if (req.documentId || req.linkedDocumentId) {
      return {
        ...req,
        isFulfilled: true,
        ocrConfidence: req.ocrConfidence || 95,
      };
    }

    const matched = findMatchingDocumentForRequirement(req, context);
    if (matched) {
      return {
        ...req,
        documentId: matched.documentId,
        linkedDocumentId: matched.linkedDocumentId,
        documentVersion: matched.documentVersion,
        ocrConfidence: matched.ocrConfidence,
        isFulfilled: true,
        verifierStatus: req.verifierStatus || 'Pending',
      };
    }

    return req;
  });
}

/**
 * Returns a summary breakdown of auto-attached documents for presentation in the UI.
 */
export function getAssetAutoAttachSummary(
  requirements: AssuranceRequirement[],
  context: AssetMatchingContext
) {
  const attachedDetails: Array<{ reqTitle: string; docTitle: string; docId: string; ocrConfidence: number }> = [];

  requirements.forEach((req) => {
    const matched = findMatchingDocumentForRequirement(req, context);
    if (matched) {
      attachedDetails.push({
        reqTitle: req.title,
        docTitle: matched.documentTitle,
        docId: matched.documentId,
        ocrConfidence: matched.ocrConfidence,
      });
    } else if (req.documentId || req.linkedDocumentId) {
      attachedDetails.push({
        reqTitle: req.title,
        docTitle: req.title,
        docId: req.documentId || req.linkedDocumentId || '',
        ocrConfidence: req.ocrConfidence || 95,
      });
    }
  });

  return {
    autoAttachedCount: attachedDetails.length,
    totalCount: requirements.length,
    attachedDetails,
  };
}
