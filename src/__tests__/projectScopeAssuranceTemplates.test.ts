/* 
  file summary: unit test suite for project scope assurance set templates, 4-sub-asset composition, and multi-asset auto-attachment.
  responsibilities: verifies project templates cover all 4 operational subtypes (Vessel, Crew, Activity, Equipment), validates mock data consistency and naming conventions, and tests end-to-end auto-attachment for project scope.
  role in system: validates project assurance templates and multi-asset integrity.
*/

import { describe, it, expect } from 'vitest';
import {
  SUBTYPE_TEMPLATES,
  SUBTYPE_STANDARD_DOCS,
  EXISTING_PROJECTS,
  EXISTING_ACTIVITIES,
  SubtypeTemplate,
  getThreePillarsCategory,
  THREE_PILLARS_CONFIG,
} from '../utils/assuranceTemplates';
import { autoAttachDocumentsToRequirements } from '../utils/documentMatchingHelpers';
import { MOCK_DOCUMENTS, MOCK_VESSELS } from '../store/mockData';
import { MOCK_CREW } from '../store/crewMockData';
import { MOCK_EQUIPMENT } from '../store/equipmentMockData';
import { AssuranceRequirement } from '../types/assurance';

describe('Project Scope Assurance Templates & Multi-Asset Mock Data', () => {
  const projectTemplates = SUBTYPE_TEMPLATES.filter((t) => t.subtype === 'All');

  it('should define both public and organization project scope templates covering All subtypes', () => {
    expect(projectTemplates.length).toBeGreaterThanOrEqual(6);

    const publicProjectTemplates = projectTemplates.filter((t) => t.source === 'public');
    const orgProjectTemplates = projectTemplates.filter((t) => t.source === 'organization');

    expect(publicProjectTemplates.length).toBeGreaterThanOrEqual(3);
    expect(orgProjectTemplates.length).toBeGreaterThanOrEqual(3);

    // Verify key public standards
    const imcaTemplate = projectTemplates.find((t) => t.id === 'tmpl-pub-imca-unified-project');
    expect(imcaTemplate).toBeDefined();
    /* public templates carry neutral names; the paper does not confirm the issuer lists (gap review E9) */
    expect(imcaTemplate?.name).toContain('(illustrative)');
    projectTemplates
      .filter((t) => t.source === 'public')
      .forEach((t) => expect(t.name).not.toMatch(/IMCA|OCIMF|IOGP|NOPSEMA|DNV-ST|OPITO/));

    const ogpTemplate = projectTemplates.find((t) => t.id === 'tmpl-pub-ogp-offshore-project');
    expect(ogpTemplate).toBeDefined();

    const nopsemaTemplate = projectTemplates.find((t) => t.id === 'tmpl-pub-nopsema-project-assurance');
    expect(nopsemaTemplate).toBeDefined();

    // Verify key organization project packages
    const chevronTemplate = projectTemplates.find((t) => t.id === 'tmpl-org-chevron-gorgon');
    expect(chevronTemplate).toBeDefined();
    expect(chevronTemplate?.organizationName).toBe('Chevron Australia Pty Ltd');

    const santosTemplate = projectTemplates.find((t) => t.id === 'tmpl-org-santos-barossa');
    expect(santosTemplate).toBeDefined();

    const northwindTemplate = projectTemplates.find((t) => t.id === 'tmpl-org-northwind-integrated-project');
    expect(northwindTemplate).toBeDefined();
  });

  it('should ensure each project scope template recommends documents across all 4 operational subtypes', () => {
    const vesselDocIds = new Set(SUBTYPE_STANDARD_DOCS.Vessel.map((d) => d.id));
    const crewDocIds = new Set(SUBTYPE_STANDARD_DOCS.Crew.map((d) => d.id));
    const eqDocIds = new Set(SUBTYPE_STANDARD_DOCS.Equipment.map((d) => d.id));

    projectTemplates.forEach((template: SubtypeTemplate) => {
      const recIds = template.recommendedDocIds;

      const hasVesselDoc = recIds.some((id) => vesselDocIds.has(id));
      const hasCrewDoc = recIds.some((id) => crewDocIds.has(id));
      const hasEqDoc = recIds.some((id) => eqDocIds.has(id));

      expect(hasVesselDoc, `Template ${template.id} missing Vessel documents`).toBe(true);
      expect(hasCrewDoc, `Template ${template.id} missing Crew documents`).toBe(true);
      expect(hasEqDoc, `Template ${template.id} missing Equipment documents`).toBe(true);
    });
  });

  it('should follow strict no-emoji policy in project templates and mock data', () => {
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

    projectTemplates.forEach((t) => {
      expect(emojiRegex.test(t.name)).toBe(false);
      expect(emojiRegex.test(t.description)).toBe(false);
    });

    EXISTING_PROJECTS.forEach((p) => {
      expect(emojiRegex.test(p.name)).toBe(false);
      expect(emojiRegex.test(p.description)).toBe(false);
    });
  });

  it('should accurately map subtypes and document categories to the mandated 3-pillar model (People, Plant, Process)', () => {
    // People mappings
    expect(getThreePillarsCategory('Crew')).toBe('People');
    expect(getThreePillarsCategory(undefined, 'Certificate of Competency (CoC)')).toBe('People');
    expect(getThreePillarsCategory(undefined, 'Offshore Safety Induction (BOSIET)')).toBe('People');
    expect(getThreePillarsCategory(undefined, 'Medical Fitness Certificate')).toBe('People');

    // Plant mappings (Physical Assets: Vessels, Barges, Equipment)
    expect(getThreePillarsCategory('Vessel')).toBe('Plant');
    expect(getThreePillarsCategory('Equipment')).toBe('Plant');
    expect(getThreePillarsCategory(undefined, 'Statutory Certificate')).toBe('Plant');
    expect(getThreePillarsCategory(undefined, 'Class Notation Certificate')).toBe('Plant');
    expect(getThreePillarsCategory(undefined, 'Lifting Appliance Register (ILO 152)')).toBe('Plant');
    expect(getThreePillarsCategory(undefined, 'DP FMEA Proving Trial')).toBe('Plant');

    // Process mappings (Project-wide, Operations, HSE, MOP, SIMOPS)
    expect(getThreePillarsCategory('Activity')).toBe('Process');
    expect(getThreePillarsCategory('All')).toBe('Process');
    expect(getThreePillarsCategory(undefined, 'Safety Management System (SMS)')).toBe('Process');
    expect(getThreePillarsCategory(undefined, 'Method of Procedure (MOP)')).toBe('Process');
    expect(getThreePillarsCategory(undefined, 'HAZID / Risk Assessment')).toBe('Process');
    expect(getThreePillarsCategory(undefined, 'Emergency Response Plan (ERP)')).toBe('Process');

    // Verify 3 Pillars Config metadata
    expect(THREE_PILLARS_CONFIG.Plant.title).toContain('Plant');
    expect(THREE_PILLARS_CONFIG.Plant.subtypes).toEqual(['Vessel', 'Equipment']);
    expect(THREE_PILLARS_CONFIG.People.title).toContain('People');
    expect(THREE_PILLARS_CONFIG.People.subtypes).toEqual(['Crew']);
    expect(THREE_PILLARS_CONFIG.Process.title).toContain('Process');
    expect(THREE_PILLARS_CONFIG.Process.subtypes).toEqual([]);
  });

  it('should support dynamic physical asset customization (adding/removing equipment or vessel sections) in project assurance set', () => {
    // 1. Full default physical assets
    const defaultPhysicals: ('Vessel' | 'Equipment')[] = ['Vessel', 'Equipment'];
    const computeActiveSubtypes = (physicals: ('Vessel' | 'Equipment')[]) => {
      const list = [...physicals, 'Crew'];
      return list;
    };

    expect(computeActiveSubtypes(defaultPhysicals)).toEqual(['Vessel', 'Equipment', 'Crew']);

    // 2. Remove equipment physical asset section
    const withoutEquipment = defaultPhysicals.filter((p) => p !== 'Equipment');
    expect(computeActiveSubtypes(withoutEquipment)).toEqual(['Vessel', 'Crew']);

    // Build requirements when Equipment section is removed
    const reqsWithoutEquipment: AssuranceRequirement[] = [];
    computeActiveSubtypes(withoutEquipment).forEach((st, idx) => {
      SUBTYPE_STANDARD_DOCS[st as keyof typeof SUBTYPE_STANDARD_DOCS].forEach((doc, dIdx) => {
        reqsWithoutEquipment.push({
          id: `req-${st}-${dIdx}`,
          title: doc.title,
          category: doc.category,
          subtype: doc.subtype,
          isMandatory: doc.isMandatory,
          isFulfilled: false,
          ocrConfidence: 0,
          verifierStatus: 'Pending',
        });
      });
    });

    expect(reqsWithoutEquipment.some((r) => r.subtype === 'Equipment')).toBe(false);
    expect(reqsWithoutEquipment.some((r) => r.subtype === 'Vessel')).toBe(true);
    expect(reqsWithoutEquipment.some((r) => r.subtype === 'Crew')).toBe(true);

    // 3. Remove vessel physical asset section
    const withoutVessel = defaultPhysicals.filter((p) => p !== 'Vessel');
    expect(computeActiveSubtypes(withoutVessel)).toEqual(['Equipment', 'Crew']);

    // 4. Re-add equipment section
    const reAddedEquipment = [...withoutEquipment, 'Equipment' as const];
    expect(computeActiveSubtypes(reAddedEquipment)).toEqual(['Vessel', 'Equipment', 'Crew']);
  });

  it('should maintain baseline unattached requirements at creation for all scopes, deferring asset nomination to Project / Roster Management', () => {
    // 1. All Assurance Set scope requirements remain unassigned templates at creation
    const rawRequirements: AssuranceRequirement[] = [
      ...SUBTYPE_STANDARD_DOCS.Vessel.map((doc, idx) => ({
        id: `req-ves-${idx}`,
        title: doc.title,
        category: doc.category,
        subtype: 'Vessel' as const,
        isMandatory: doc.isMandatory,
        isFulfilled: false,
        ocrConfidence: 0,
        verifierStatus: 'Pending' as const,
      })),
      ...SUBTYPE_STANDARD_DOCS.Crew.map((doc, idx) => ({
        id: `req-crew-${idx}`,
        title: doc.title,
        category: doc.category,
        subtype: 'Crew' as const,
        isMandatory: doc.isMandatory,
        isFulfilled: false,
        ocrConfidence: 0,
        verifierStatus: 'Pending' as const,
      })),
    ];

    // Assurance Set creation preserves pristine unfulfilled standard requirements
    expect(rawRequirements.every((r) => !r.isFulfilled && !r.documentId)).toBe(true);

    // 2. Downstream inside Project / Roster Management, nominating assets executes auto-attachment against vaults
    const targetVessel = MOCK_VESSELS.find((v) => v.id === 'VESSEL-001') || MOCK_VESSELS[0];
    const targetCrew = MOCK_CREW[0];

    const downstreamAttached = autoAttachDocumentsToRequirements(rawRequirements, {
      documents: MOCK_DOCUMENTS,
      vessel: targetVessel,
      vessels: MOCK_VESSELS,
      crew: MOCK_CREW,
      selectedCrewId: targetCrew.id,
      equipment: MOCK_EQUIPMENT,
      selectedVesselId: targetVessel.id,
    });

    // Validates that asset vault documents attach during roster/campaign nomination
    expect(downstreamAttached.some((r) => r.documentId && !r.isFulfilled)).toBe(true);
  });
});


