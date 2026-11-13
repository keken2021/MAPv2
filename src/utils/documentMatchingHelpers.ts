/* 
  file summary: intelligent document auto-attachment and matching engine for chartered assets and assurance sets.
  responsibilities: automatically matches and attaches existing statutory, crew, and equipment documents linked to chartered assets into newly requested assurance campaign requirements.
  role in system: consumed by CreateAssuranceSetView, useMapStore (addAssuranceSet), and project composition services.
*/

import { AssuranceRequirement, AssuranceSet, AssuranceSubtype } from '../types/assurance';
import { MasterDocument } from '../types/document';
import { VesselInformation, StatutoryCertificateSummary } from '../types/vessel';
import { CrewMember, STCWDocumentItem } from '../types/crew';
import { EquipmentAsset } from '../types/equipment';
import { isReusableLibraryDocument } from './documentOwnershipHelpers';

export interface AssetMatchingContext {
  documents: MasterDocument[];
  vessel?: VesselInformation;
  vessels?: VesselInformation[];
  crew?: CrewMember[];
  selectedCrewId?: string;
  /** every crew member of a crew set (ADR 0023); a requirement takes the first member's matching document */
  selectedCrewIds?: string[];
  equipment?: EquipmentAsset[];
  selectedEquipmentId?: string;
  selectedVesselId?: string;
  targetSubtype?: AssuranceSubtype;
  /** when set, vault library reuse follows A16 (Vendor-owned evidence only) */
  reuseSet?: Pick<
    AssuranceSet,
    'clientOrg' | 'charterer' | 'serviceProviderOrg' | 'respondingParty' | 'parties'
  >;
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

interface CandidateDocumentResult extends MatchedDocumentResult {
  expiryDate: string;
}

/**
 * Finds the best matching document for a single requirement from the provided asset context.
 * Matches by exact document type key (docTypeId), scoped to the target object (vessel, crew, equipment),
 * and selects the valid candidate with the latest expiry date.
 */
export function findMatchingDocumentForRequirement(
  req: AssuranceRequirement,
  context: AssetMatchingContext
): MatchedDocumentResult | null {
  if (!req.docTypeId) return null;

  const subtype: AssuranceSubtype =
    req.subtype ||
    (req.docTypeId.startsWith('vessel-')
      ? 'Vessel'
      : req.docTypeId.startsWith('crew-')
        ? 'Crew'
        : req.docTypeId.startsWith('eq-')
          ? 'Equipment'
          : (context.targetSubtype as AssuranceSubtype) || 'Vessel');

  const effectiveVessel =
    context.vessel ||
    (context.selectedVesselId ? context.vessels?.find((v) => v.id === context.selectedVesselId) : undefined);
  const now = Date.now();

  const isValidVaultDoc = (d: MasterDocument): boolean => {
    if (d.docTypeId !== req.docTypeId) return false;
    if (d.verificationStatus !== 'Verified') return false;
    if (d.complianceState === 'Expired') return false;
    if (new Date(d.expiryDate).getTime() <= now) return false;
    if (context.reuseSet) {
      if (!isReusableLibraryDocument(d, context.reuseSet, context.vessels || [], [])) {
        return false;
      }
    }
    return true;
  };

  const isValidCrewCert = (c: STCWDocumentItem): boolean => {
    if (c.docTypeId !== req.docTypeId) return false;
    if (c.verificationStatus !== 'Verified' && c.verificationStatus !== 'Expiring') return false;
    if (new Date(c.expiryDate).getTime() <= now) return false;
    return true;
  };

  const candidates: CandidateDocumentResult[] = [];

  // -------------------------------------------------------------
  // 1. VESSEL SUBTYPE MATCHING
  // -------------------------------------------------------------
  if (subtype === 'Vessel') {
    const targetVesselId = req.targetObjectId || effectiveVessel?.id;
    if (targetVesselId) {
      const vesselVaultDocs = context.documents.filter(
        (d) =>
          (d.vesselId === targetVesselId ||
            (d.targetObjectType?.toLowerCase() === 'vessel' && d.targetObjectId === targetVesselId)) &&
          isValidVaultDoc(d)
      );

      for (const doc of vesselVaultDocs) {
        candidates.push({
          documentId: doc.id,
          linkedDocumentId: doc.id,
          documentTitle: doc.title,
          documentVersion: doc.currentVersion || 'v1.0',
          ocrConfidence: doc.ocrConfidence || 98,
          matchedFrom: 'vault_document',
          expiryDate: doc.expiryDate,
        });
      }
    }
  }

  // -------------------------------------------------------------
  // 2. CREW SUBTYPE MATCHING
  // -------------------------------------------------------------
  if (subtype === 'Crew') {
    const targetCrewIds = req.targetObjectId
      ? [req.targetObjectId]
      : context.selectedCrewIds && context.selectedCrewIds.length > 0
        ? context.selectedCrewIds
        : context.selectedCrewId
          ? [context.selectedCrewId]
          : [];
    const targetCrews: CrewMember[] =
      targetCrewIds.length > 0
        ? targetCrewIds
            .map((id) => context.crew?.find((c) => c.id === id))
            .filter((c): c is CrewMember => Boolean(c))
        : context.crew && context.crew[0]
          ? [context.crew[0]]
          : [];

    const targetCrewIdSet = new Set(targetCrews.map((c) => c.id));

    // 2a. Search in MasterDocument Vault for crew documents targeting these crew members
    const crewVaultDocs = context.documents.filter(
      (d) =>
        ((d.targetObjectType?.toLowerCase() === 'crew' &&
          d.targetObjectId &&
          targetCrewIdSet.has(d.targetObjectId)) ||
          (d.entityType === 'Crew Certificate' &&
            targetCrews.some(
              (c) =>
                d.crewAttributes?.crewName?.toLowerCase() === c.fullName.toLowerCase() ||
                (c.passportNo && d.crewAttributes?.passportId === c.passportNo)
            ))) &&
        isValidVaultDoc(d)
    );

    for (const doc of crewVaultDocs) {
      candidates.push({
        documentId: doc.id,
        linkedDocumentId: doc.id,
        documentTitle: doc.title,
        documentVersion: doc.currentVersion || 'v1.0',
        ocrConfidence: doc.ocrConfidence || 98,
        matchedFrom: 'vault_document',
        expiryDate: doc.expiryDate,
      });
    }

    // 2b. Search in Crew's STCW Layer 1 & 2 certificates (ADR 0023)
    for (const targetCrew of targetCrews) {
      const allCrewCerts: STCWDocumentItem[] = [
        ...(targetCrew.layer1CoreDocuments || []),
        ...(targetCrew.layer2Endorsements || []),
      ];

      for (const cert of allCrewCerts) {
        if (isValidCrewCert(cert)) {
          const vaultDoc = context.documents.find(
            (d) =>
              (d.id === cert.id || (cert.certificateNo && d.certificateNo === cert.certificateNo)) &&
              isValidVaultDoc(d)
          );

          candidates.push({
            documentId: vaultDoc ? vaultDoc.id : cert.id,
            linkedDocumentId: vaultDoc ? vaultDoc.id : cert.id,
            documentTitle: cert.title,
            documentVersion: vaultDoc?.currentVersion || 'v1.0',
            ocrConfidence: vaultDoc?.ocrConfidence || 97,
            matchedFrom: vaultDoc ? 'vault_document' : 'crew_stcw',
            expiryDate: cert.expiryDate,
          });
        }
      }
    }
  }

  // -------------------------------------------------------------
  // 3. EQUIPMENT SUBTYPE MATCHING
  // -------------------------------------------------------------
  if (subtype === 'Equipment') {
    const targetEqId =
      req.targetObjectId || context.selectedEquipmentId || context.equipment?.[0]?.id;

    if (targetEqId) {
      const eqDocs = context.documents.filter(
        (d) =>
          d.targetObjectType?.toLowerCase() === 'equipment' &&
          d.targetObjectId === targetEqId &&
          isValidVaultDoc(d)
      );

      for (const doc of eqDocs) {
        candidates.push({
          documentId: doc.id,
          linkedDocumentId: doc.id,
          documentTitle: doc.title,
          documentVersion: doc.currentVersion || 'v1.0',
          ocrConfidence: doc.ocrConfidence || 95,
          matchedFrom: 'vault_document',
          expiryDate: doc.expiryDate,
        });
      }
    }
  }

  if (candidates.length === 0) return null;

  // Deduplicate candidates by documentId before sorting
  const uniqueCandidates = Array.from(
    new Map(candidates.map((c) => [c.documentId, c])).values()
  );

  // Latest expiry date wins
  uniqueCandidates.sort(
    (a, b) => new Date(b.expiryDate).getTime() - new Date(a.expiryDate).getTime()
  );

  const { expiryDate, ...result } = uniqueCandidates[0];
  return result;
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
    /* a slot that already held a document keeps the E3 rule (Pending until a Verifier decides) */
    if (req.documentId || req.linkedDocumentId) {
      return {
        ...req,
        isFulfilled: req.reusedDocument ? true : req.verifierStatus === 'Verified',
        verifierStatus: req.reusedDocument ? (req.verifierStatus || 'Verified') : (req.verifierStatus || 'Pending'),
        ocrConfidence: req.ocrConfidence || 95,
      };
    }

    const matched = findMatchingDocumentForRequirement(req, context);
    if (matched) {
      /* A16: vault library auto-attach only reuses Vendor-owned evidence */
      if (matched.matchedFrom === 'vault_document' && context.reuseSet) {
        const vaultDoc = context.documents.find((d) => d.id === matched.documentId);
        if (
          vaultDoc &&
          !isReusableLibraryDocument(vaultDoc, context.reuseSet, context.vessels || [], [])
        ) {
          return req;
        }
      }
      return {
        ...req,
        documentId: matched.documentId,
        linkedDocumentId: matched.linkedDocumentId,
        documentVersion: matched.documentVersion,
        ocrConfidence: matched.ocrConfidence,
        /* reused verified document counts as done (overrides E3 for reused documents only) */
        isFulfilled: true,
        verifierStatus: 'Verified',
        reusedDocument: true,
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
