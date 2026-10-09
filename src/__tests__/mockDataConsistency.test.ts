/*
  file summary: guard tests proving every seeded score and pipeline stage equals its calculation.
  responsibilities: recomputes set, vessel, project, equipment, crew and marketplace values from the records below them and fails when a stored literal drifts from its basis.
  role in system: keeps src/store mock modules consistent with src/utils/readinessHelpers.ts and projectHelpers.ts; mirrors the map-mock-data-consistency audit.
*/

import { describe, it, expect } from 'vitest';
import { MOCK_ASSURANCE_SETS, MOCK_DOCUMENTS, MOCK_VESSELS } from '../store/mockData';
import { MOCK_PROJECTS, PROJECT_SEED_ASSURANCE_SETS } from '../store/projectMockData';
import { MOCK_EQUIPMENT } from '../store/equipmentMockData';
import { MOCK_CREW } from '../store/crewMockData';
import { MOCK_MARKETPLACE_ITEMS } from '../store/marketplaceMockData';
import {
  calculateAssuranceSetReadiness,
  calculateCrewComplianceScore,
  calculateEquipmentReadiness,
  calculateVesselReadiness,
  deriveCrewComplianceStatus,
  derivePipelineStage,
  isVesselStatusPermitted,
  requirementHasDocument,
} from '../utils/readinessHelpers';
import { calculateProjectReadiness, deriveProjectStatus } from '../utils/projectHelpers';
import { AssuranceSet, AssuranceStage } from '../types/assurance';

const ALL_SETS: AssuranceSet[] = [...MOCK_ASSURANCE_SETS, ...PROJECT_SEED_ASSURANCE_SETS];
const TERMINAL_STAGES: AssuranceStage[] = ['Approved', 'Certified'];

/* approved and certified are the same terminal position on the stepper */
const sameStage = (a: AssuranceStage, b: AssuranceStage) =>
  a === b || (TERMINAL_STAGES.includes(a) && TERMINAL_STAGES.includes(b));

describe('Seeded assurance sets have a calculated basis', () => {
  it('stores the readiness index the helper calculates', () => {
    ALL_SETS.forEach((set) => {
      expect(set.readinessScore, set.id).toBe(calculateAssuranceSetReadiness(set, ALL_SETS));
    });
  });

  it('stores the first pipeline stage not cleared by every mandatory requirement', () => {
    ALL_SETS.forEach((set) => {
      expect(set.requirements.length, `${set.id} has requirements`).toBeGreaterThan(0);
      const derived = derivePipelineStage(set);
      expect(sameStage(set.stage, derived), `${set.id}: stored ${set.stage}, derived ${derived}`).toBe(true);
    });
  });

  it('marks a requirement fulfilled only when it is verified', () => {
    ALL_SETS.filter((set) => set.verificationRequired !== false).forEach((set) => {
      set.requirements
        .filter((r) => r.fulfillmentType !== 'assurance_set')
        .forEach((r) => {
          expect(r.isFulfilled, `${set.id} ${r.id}`).toBe(r.verifierStatus === 'Verified');
        });
    });
  });

  it('references evidence that exists, and gives every verified requirement a reference', () => {
    const documentIds = new Set<string>(MOCK_DOCUMENTS.map((d) => d.id));
    MOCK_CREW.forEach((c) =>
      [...c.layer1CoreDocuments, ...c.layer2Endorsements].forEach((d) => documentIds.add(d.id)),
    );
    MOCK_VESSELS.forEach((v) => (v.statutoryCertificates ?? []).forEach((c) => documentIds.add(c.id)));

    ALL_SETS.forEach((set) => {
      set.requirements.forEach((r) => {
        if (r.documentId) expect(documentIds.has(r.documentId), `${set.id} ${r.id} documentId`).toBe(true);
        if (r.linkedDocumentId) expect(documentIds.has(r.linkedDocumentId), `${set.id} ${r.id} linkedDocumentId`).toBe(true);
        if (r.linkedAssuranceSetId) {
          expect(ALL_SETS.some((s) => s.id === r.linkedAssuranceSetId), `${set.id} ${r.id} linked set`).toBe(true);
        }
        if (r.verifierStatus === 'Verified') {
          expect(requirementHasDocument(r), `${set.id} ${r.id} verified without evidence`).toBe(true);
        }
      });
    });
  });

  it('gives a requirement the same status as its library document', () => {
    ALL_SETS.forEach((set) => {
      set.requirements.forEach((r) => {
        const document = MOCK_DOCUMENTS.find((d) => d.id === (r.documentId || r.linkedDocumentId));
        if (document) {
          expect(r.verifierStatus, `${set.id} ${r.id} against ${document.id}`).toBe(document.verificationStatus);
        }
      });
    });
  });

  it('copies vessel and project names exactly', () => {
    ALL_SETS.forEach((set) => {
      const vessel = MOCK_VESSELS.find((v) => v.id === set.vesselId);
      if (set.vesselId) expect(vessel, `${set.id} vessel ${set.vesselId}`).toBeDefined();
      if (vessel) {
        expect(set.vesselName, set.id).toBe(vessel.name);
        expect(set.imoNumber, set.id).toBe(vessel.imoNumber);
      }
      if (set.projectId) {
        const project = MOCK_PROJECTS.find((p) => p.id === set.projectId);
        expect(project, `${set.id} project ${set.projectId}`).toBeDefined();
        if (set.projectName) expect(set.projectName, set.id).toBe(project?.name);
      }
    });
  });
});

describe('Seeded rollups are averages of the level below', () => {
  it('stores the vessel score the helper calculates, and a status that score permits', () => {
    MOCK_VESSELS.forEach((vessel) => {
      expect(vessel.complianceReadinessScore, vessel.id).toBe(
        calculateVesselReadiness(vessel, ALL_SETS, MOCK_DOCUMENTS),
      );
      expect(
        isVesselStatusPermitted(vessel.status, vessel, ALL_SETS, MOCK_DOCUMENTS).isPermitted,
        `${vessel.id} status ${vessel.status}`,
      ).toBe(true);
    });
  });

  it('stores the project score and status its sets derive', () => {
    MOCK_PROJECTS.forEach((project) => {
      expect(project.readinessScore ?? 0, project.id).toBe(calculateProjectReadiness(project, ALL_SETS));
      /* draft and closed are lifecycle states a person sets by hand */
      if (project.status !== 'Draft' && project.status !== 'Closed') {
        expect(project.status, project.id).toBe(deriveProjectStatus(project, ALL_SETS));
      }
    });
  });

  it('stores an equipment score only when an assurance set covers the equipment', () => {
    MOCK_EQUIPMENT.forEach((equipment) => {
      expect(equipment.complianceReadinessScore, equipment.id).toBe(
        calculateEquipmentReadiness(equipment, ALL_SETS),
      );
    });
  });

  it('stores the crew score and label their own documents derive', () => {
    MOCK_CREW.forEach((crew) => {
      expect(crew.overallComplianceScore, crew.id).toBe(calculateCrewComplianceScore(crew));
      expect(crew.complianceStatus, crew.id).toBe(deriveCrewComplianceStatus(crew));
    });
  });

  it('gives a marketplace offering the score of its linked asset, or none', () => {
    MOCK_MARKETPLACE_ITEMS.forEach((item) => {
      if (!item.linkedEntityId) {
        expect(item.complianceReadinessScore, `${item.id} links to no asset`).toBeNull();
        return;
      }
      const vessel = MOCK_VESSELS.find((v) => v.id === item.linkedEntityId);
      const equipment = MOCK_EQUIPMENT.find((e) => e.id === item.linkedEntityId);
      const crew = MOCK_CREW.find((c) => c.id === item.linkedEntityId);
      const expected = vessel
        ? calculateVesselReadiness(vessel, ALL_SETS, MOCK_DOCUMENTS)
        : equipment
          ? calculateEquipmentReadiness(equipment, ALL_SETS)
          : crew
            ? calculateCrewComplianceScore(crew)
            : undefined;
      expect(expected, `${item.id} linked asset ${item.linkedEntityId}`).not.toBeUndefined();
      expect(item.complianceReadinessScore, item.id).toBe(expected);

      /* a metric that quotes "nn% ready" repeats the same number */
      item.metrics.forEach((metric) => {
        const quoted = metric.value.match(/(\d+)\s*%\s*ready/i);
        if (quoted) expect(Number(quoted[1]), `${item.id} metric "${metric.value}"`).toBe(item.complianceReadinessScore);
      });
    });
  });
});
