/*
  file summary: guard tests proving every seeded score and pipeline stage equals its calculation.
  responsibilities: recomputes set, vessel, project, equipment, crew and marketplace values from the records below them and fails when a stored literal drifts from its basis.
  role in system: keeps src/store mock modules consistent with src/utils/readinessHelpers.ts and projectHelpers.ts; mirrors the map-mock-data-consistency audit.
*/

import { describe, it, expect } from 'vitest';
import { SEEDED_AUDIT_EVENTS } from '../store/auditMockData';
import { MOCK_CAPA_ITEMS } from '../store/capaMockData';
import { DEFAULT_INSPECTION_CHECKLIST_ITEMS } from '../store/inspectionMockData';
import { MOCK_ASSURANCE_SETS, MOCK_AUDIT_TRAIL, MOCK_DOCUMENTS, MOCK_VESSELS } from '../store/mockData';
import { MOCK_PROJECTS, PROJECT_SEED_ASSURANCE_SETS } from '../store/projectMockData';
import { MOCK_EQUIPMENT } from '../store/equipmentMockData';
import { MOCK_CREW } from '../store/crewMockData';
import { MOCK_MARKETPLACE_ITEMS } from '../store/marketplaceMockData';
import { MOCK_VESSEL_STATUS_HISTORY } from '../store/vesselStatusHistoryMockData';
import {
  calculateAssuranceSetReadiness,
  getAssuranceSetRemainingItems,
  calculateCrewComplianceScore,
  calculateEquipmentReadiness,
  calculateVesselReadiness,
  deriveCrewComplianceStatus,
  derivePipelineStage,
  isVesselStatusPermitted,
  requirementHasDocument,
} from '../utils/readinessHelpers';
import { calculateProjectReadiness, deriveProjectStatus } from '../utils/projectHelpers';
import { initialComplianceHistoryNote } from '../utils/vesselStatusHistoryHelpers';
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

  /* 2b: every project↔set link is two-way (project lists the set; set.projectId matches) */
  it('lists every set a project names, and every set names the project that lists it', () => {
    const setById = new Map(ALL_SETS.map((s) => [s.id, s]));

    MOCK_PROJECTS.forEach((project) => {
      project.assetLinks.forEach((link) => {
        if (!link.assuranceSetId) return;
        const set = setById.get(link.assuranceSetId);
        expect(set, `${project.id} ${link.id} → ${link.assuranceSetId}`).toBeDefined();
        expect(
          set?.projectId,
          `${link.assuranceSetId} must set projectId to ${project.id}`,
        ).toBe(project.id);
      });
    });

    ALL_SETS.forEach((set) => {
      if (!set.projectId) return;
      const project = MOCK_PROJECTS.find((p) => p.id === set.projectId);
      expect(project, `${set.id} project ${set.projectId}`).toBeDefined();
      const listed = project?.assetLinks.some((l) => l.assuranceSetId === set.id);
      expect(listed, `${set.id} must appear on ${set.projectId} assetLinks`).toBe(true);
    });
  });
});

describe('Seeded audit, CAPA and history links resolve (2a / 2c)', () => {
  const setIds = new Set(ALL_SETS.map((s) => s.id));
  const checklistIds = new Set(DEFAULT_INSPECTION_CHECKLIST_ITEMS.map((i) => i.id));

  it('points every structured audit task and set target at a real record', () => {
    [...SEEDED_AUDIT_EVENTS, ...MOCK_AUDIT_TRAIL].forEach((event) => {
      const target = event.target;
      expect(target, event.id).toBeDefined();
      if (!target) return;

      if (target.kind === 'task') {
        const set = ALL_SETS.find((s) => s.id === target.setId);
        expect(set, `${event.id} set ${target.setId}`).toBeDefined();
        expect(
          set?.requirements.some((r) => r.id === target.taskId),
          `${event.id} task ${target.taskId} on ${target.setId}`,
        ).toBe(true);
        return;
      }

      if (target.setId && !['unscoped', 'multiple'].includes(target.setId)) {
        expect(setIds.has(target.setId), `${event.id} set ${target.setId}`).toBe(true);
      }
    });
  });

  it('gives every vessel client-history set and CAPA checklist item a real record', () => {
    MOCK_VESSELS.forEach((vessel) => {
      (vessel.clientHistory ?? []).forEach((entry) => {
        if (!entry.assuranceSetId) return;
        expect(setIds.has(entry.assuranceSetId), `${vessel.id} ${entry.id} → ${entry.assuranceSetId}`).toBe(
          true,
        );
      });
    });

    MOCK_CAPA_ITEMS.forEach((capa) => {
      if (!capa.checklistId) return;
      expect(checklistIds.has(capa.checklistId), `${capa.id} checklist ${capa.checklistId}`).toBe(true);
    });
  });

  it('quotes readiness on the first compliance status-history note', () => {
    const vesselsWithCompliance = new Set(
      MOCK_VESSEL_STATUS_HISTORY.filter((e) => e.dimension === 'compliance').map((e) => e.vesselId),
    );

    vesselsWithCompliance.forEach((vesselId) => {
      const first = MOCK_VESSEL_STATUS_HISTORY.filter(
        (e) => e.vesselId === vesselId && e.dimension === 'compliance',
      ).sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))[0];
      expect(first?.notes, `${vesselId} ${first?.id}`).toMatch(/readiness score \(\d+%\)/);
    });

    expect(initialComplianceHistoryNote(65)).toBe(
      'Initial compliance derived from readiness score (65%).',
    );
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

  it('ensures readiness index and remaining tasks summary agree across all sets', () => {
    ALL_SETS.forEach((set) => {
      const readiness = calculateAssuranceSetReadiness(set, ALL_SETS);
      const remaining = getAssuranceSetRemainingItems(set, readiness);

      if (remaining.remainingTasks === 0) {
        if (readiness >= 100) {
          expect(remaining.missingShare, `${set.id} 100% ready has no missing share`).toBeUndefined();
          expect(remaining.label, `${set.id} 100% ready label`).toBe('0 remaining tasks (0 certs)');
        } else {
          expect(remaining.missingShare, `${set.id} readiness ${readiness}% with 0 tasks must name missing share`).toBeDefined();
          expect(remaining.label, `${set.id} label`).toContain(remaining.missingShare);
          expect(remaining.label, `${set.id} label`).not.toBe('0 remaining tasks (0 certs)');
        }
      } else {
        expect(readiness, `${set.id} with ${remaining.remainingTasks} remaining tasks cannot be 100%`).toBeLessThan(100);
        expect(remaining.label, `${set.id} label`).toMatch(/remaining task/);
      }
    });

    const as001 = ALL_SETS.find((s) => s.id === 'AS-2026-001')!;
    const as001Remaining = getAssuranceSetRemainingItems(as001);
    expect(as001.readinessScore).toBe(70);
    expect(as001Remaining.remainingTasks).toBe(0);
    expect(as001Remaining.missingShare).toBe('awaiting approval');
    expect(as001Remaining.label).toBe('0 remaining tasks (awaiting approval)');
  });
});
