/* Oil Co demo helpers for assurance set template walkthroughs. */

import { AssuranceRequirement, AssuranceSet } from '../types/assurance';
import { DocumentEntityType, MasterDocument } from '../types/document';
import {
  DocumentObjectLookupContext,
  DocumentTargetObject,
  findDuplicateObjectDocumentTitle,
  getEntityTypeForObjectType,
} from './documentObjectHelpers';
import { recalculateSetReadiness } from './projectHelpers';
import { getSetAssignedSubmitter } from './setStakeholders';

/** first N requirements stay awaiting upload; the rest start as Submitted */
export const DEMO_OPEN_UPLOAD_COUNT = 3;

export interface AttachDemoDocumentsOptions {
  setId: string;
  respondingParty?: string;
  targetObject?: Pick<DocumentTargetObject, 'type' | 'id'> & { name?: string };
  vesselId?: string;
  selectedVesselName?: string;
  selectedCrewId?: string;
  selectedCrewName?: string;
  selectedEquipmentId?: string;
  selectedEquipmentName?: string;
  selectedAssuranceObjects?: Pick<DocumentTargetObject, 'type' | 'id' | 'name'>[];
  existingDocuments?: MasterDocument[];
  lookupContext?: DocumentObjectLookupContext;
}

/* resolves the target object from options for duplicate checks and document metadata */
function resolveTargetObject(
  options: AttachDemoDocumentsOptions,
): (Pick<DocumentTargetObject, 'type' | 'id'> & { name?: string }) | undefined {
  if (options.targetObject?.type && options.targetObject?.id) {
    return options.targetObject;
  }
  if (options.vesselId) {
    return { type: 'vessel', id: options.vesselId, name: options.selectedVesselName };
  }
  if (options.selectedCrewId) {
    return { type: 'person', id: options.selectedCrewId, name: options.selectedCrewName };
  }
  if (options.selectedEquipmentId) {
    return { type: 'equipment', id: options.selectedEquipmentId, name: options.selectedEquipmentName };
  }
  if (options.selectedAssuranceObjects && options.selectedAssuranceObjects.length > 0) {
    const first = options.selectedAssuranceObjects[0];
    return { type: first.type, id: first.id, name: first.name };
  }
  return undefined;
}

/* constructs a single demo MasterDocument for an attached requirement slot */
export function buildDemoMasterDocument(
  req: AssuranceRequirement,
  index: number,
  setId: string,
  respondingParty: string,
  target?: Pick<DocumentTargetObject, 'type' | 'id'> & { name?: string },
): MasterDocument {
  const now = new Date().toISOString();
  const demoDocId = `DOC-DEMO-${setId}-${index + 1}`;
  const fileName = `${req.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`;
  const entityType: DocumentEntityType = target?.type
    ? getEntityTypeForObjectType(target.type)
    : 'Vessel Certificate';

  return {
    id: demoDocId,
    title: req.title,
    entityType,
    vesselId: target?.type === 'vessel' ? target.id : '',
    targetObjectType: target?.type,
    targetObjectId: target?.id,
    targetObjectName: target?.name,
    certificateNo: `DEMO-${index + 1}`,
    issuingAuthority: respondingParty,
    expiryDate: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
    ocrConfidence: 96,
    complianceState: 'Valid',
    currentVersion: 'v1.0',
    versions: [
      {
        versionLabel: 'v1.0',
        uploadedAt: now,
        uploadedBy: respondingParty,
        fileSizeBytes: 420000,
        fileName,
        changeSummary: 'Demo document, already submitted',
      },
    ],
    validationRules: {
      charterBufferPassed: true,
      assetMatch100Percent: true,
      iacsAuthorityValid: true,
      overallValid: true,
    },
    verificationStatus: 'Pending',
  };
}

/**
 * Returns only demo documents whose id is not already present in the existing documents list.
 * Returns an empty array when given an empty list or when all documents exist.
 */
export function filterNewDemoDocuments(
  docs: MasterDocument[],
  existing: MasterDocument[],
): MasterDocument[] {
  if (!docs || docs.length === 0) {
    return [];
  }
  const existingIds = new Set((existing || []).map((d) => d.id));
  return docs.filter((doc) => !existingIds.has(doc.id));
}

/**
 * Rebuilds missing demo documents for requirements marked as demoPreseeded whose documentId is absent from the documents store.
 * Leaves non-demoPreseeded requirements untouched.
 */
export function rebuildMissingDemoDocuments(
  set?: AssuranceSet | null,
  documents: MasterDocument[] = [],
): MasterDocument[] {
  if (!set || !set.requirements || set.requirements.length === 0) {
    return [];
  }
  const existingIds = new Set((documents || []).map((d) => d.id));
  const respondingParty = getSetAssignedSubmitter(set) || 'Service Provider';
  const target =
    set.assuranceObjects && set.assuranceObjects.length > 0
      ? {
          type: set.assuranceObjects[0].type,
          id: set.assuranceObjects[0].id,
          name: set.assuranceObjects[0].name,
        }
      : undefined;

  const restored: MasterDocument[] = [];
  set.requirements.forEach((req, index) => {
    if (!req.demoPreseeded || !req.documentId) {
      return;
    }
    if (existingIds.has(req.documentId)) {
      return;
    }
    const doc = buildDemoMasterDocument(req, index, set.id, respondingParty, target);
    doc.id = req.documentId;
    if (req.verifierStatus === 'Verified') {
      doc.verificationStatus = 'Verified';
    }
    existingIds.add(doc.id);
    restored.push(doc);
  });

  return restored;
}

/* attaches demo documents to all requirements beyond the first 3 */
export function attachDemoDocumentsToRequirements(
  requirements: AssuranceRequirement[],
  options: AttachDemoDocumentsOptions,
): { requirements: AssuranceRequirement[]; demoDocuments: MasterDocument[] } {
  const demoDocuments: MasterDocument[] = [];
  const respondingParty = options.respondingParty || 'Service Provider';
  const target = resolveTargetObject(options);

  const updatedRequirements = requirements.map((req, index) => {
    if (index < DEMO_OPEN_UPLOAD_COUNT) {
      return {
        ...req,
        documentId: undefined,
        documentVersion: undefined,
        demoPreseeded: undefined,
        isFulfilled: false,
        verifierStatus: 'Pending' as const,
      };
    }

    const duplicate = target?.type && target?.id
      ? findDuplicateObjectDocumentTitle(
          [...(options.existingDocuments || []), ...demoDocuments],
          { type: target.type, id: target.id, name: target.name },
          req.title,
          options.lookupContext || {},
        )
      : null;

    let attachedDocId = duplicate?.id;
    let attachedVersion = duplicate?.document?.currentVersion || 'v1.0';

    if (!attachedDocId) {
      const demoDoc = buildDemoMasterDocument(req, index, options.setId, respondingParty, target);
      demoDocuments.push(demoDoc);
      attachedDocId = demoDoc.id;
      attachedVersion = 'v1.0';
    }

    return {
      ...req,
      documentId: attachedDocId,
      documentVersion: attachedVersion,
      ocrConfidence: 96,
      demoPreseeded: true,
      notes: 'Demo pre-seeded upload',
      verifierStatus: 'Pending' as const,
      isFulfilled: false,
    };
  });

  return { requirements: updatedRequirements, demoDocuments };
}

/**
  what: marks demo pre-seeded uploads Verified when submission finishes (stage enters Verification).
  how: only requirements flagged demoPreseeded that are still Pending are flipped; live uploads stay Pending.
*/
export function autoVerifyDemoPreseededRequirements(
  set: AssuranceSet,
  documents: MasterDocument[],
): { set: AssuranceSet; documents: MasterDocument[] } {
  const preseededDocIds = new Set<string>();
  const reviewedAt = new Date().toISOString();
  const requirements: AssuranceRequirement[] = set.requirements.map((req) => {
    if (!req.demoPreseeded || req.verifierStatus === 'Verified' || !req.documentId) {
      return req;
    }
    preseededDocIds.add(req.documentId);
    return {
      ...req,
      verifierStatus: 'Verified',
      isFulfilled: true,
      ocrConfidence: req.ocrConfidence || 96,
      decisionTime: reviewedAt,
      notes: req.notes || 'Demo pre-seeded upload, auto-verified when submission completed',
    };
  });

  if (preseededDocIds.size === 0) {
    return { set, documents };
  }

  const nextDocuments = documents.map((doc) =>
    preseededDocIds.has(doc.id)
      ? { ...doc, verificationStatus: 'Verified' as const }
      : doc,
  );

  return {
    set: recalculateSetReadiness({ ...set, requirements }),
    documents: nextDocuments,
  };
}
