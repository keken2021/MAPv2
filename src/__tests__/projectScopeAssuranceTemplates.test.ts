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
    expect(imcaTemplate?.name).toContain('IMCA');

    const ogpTemplate = projectTemplates.find((t) => t.id === 'tmpl-pub-ogp-offshore-project');
    expect(ogpTemplate).toBeDefined();

    const nopsemaTemplate = projectTemplates.find((t) => t.id === 'tmpl-pub-nopsema-project-assurance');
    expect(nopsemaTemplate).toBeDefined();

    // Verify key organization project packages
    const chevronTemplate = projectTemplates.find((t) => t.id === 'tmpl-org-chevron-gorgon');
    expect(chevronTemplate).toBeDefined();
    expect(chevronTemplate?.organizationName).toBe('Chevron Australia Pty Ltd');

    const woodsideTemplate = projectTemplates.find((t) => t.id === 'tmpl-org-woodside-scarborough');
    expect(woodsideTemplate).toBeDefined();

    const northwindTemplate = projectTemplates.find((t) => t.id === 'tmpl-org-northwind-integrated-project');
    expect(northwindTemplate).toBeDefined();
  });

  it('should ensure each project scope template recommends documents across all 4 operational subtypes', () => {
    const vesselDocIds = new Set(SUBTYPE_STANDARD_DOCS.Vessel.map((d) => d.id));
    const crewDocIds = new Set(SUBTYPE_STANDARD_DOCS.Crew.map((d) => d.id));
    const actDocIds = new Set(SUBTYPE_STANDARD_DOCS.Activity.map((d) => d.id));
    const eqDocIds = new Set(SUBTYPE_STANDARD_DOCS.Equipment.map((d) => d.id));

    projectTemplates.forEach((template: SubtypeTemplate) => {
      const recIds = template.recommendedDocIds;

      const hasVesselDoc = recIds.some((id) => vesselDocIds.has(id));
      const hasCrewDoc = recIds.some((id) => crewDocIds.has(id));
      const hasActDoc = recIds.some((id) => actDocIds.has(id));
      const hasEqDoc = recIds.some((id) => eqDocIds.has(id));

      expect(hasVesselDoc, `Template ${template.id} missing Vessel documents`).toBe(true);
      expect(hasCrewDoc, `Template ${template.id} missing Crew documents`).toBe(true);
      expect(hasActDoc, `Template ${template.id} missing Activity documents`).toBe(true);
      expect(hasEqDoc, `Template ${template.id} missing Equipment documents`).toBe(true);
    });
  });

  it('should ensure EXISTING_PROJECTS have accurate and consistent sub-asset references', () => {
    expect(EXISTING_PROJECTS.length).toBeGreaterThanOrEqual(6);

    EXISTING_PROJECTS.forEach((project) => {
      expect(project.id).toMatch(/^MAP-PROJ-\d{4}-[A-Z]+-\d{3,5}$/);
      expect(project.name.trim().length).toBeGreaterThan(0);
      expect(project.clientOperator.trim().length).toBeGreaterThan(0);

      // Verify sub-assets are defined
      expect(project.primaryVesselId).toBeDefined();
      expect(project.primaryCrewId).toBeDefined();
      expect(project.primaryEquipmentId).toBeDefined();
      expect(project.primaryActivityId).toBeDefined();
      expect(project.defaultTemplateId).toBeDefined();

      // Verify referenced vessel exists in mock vessels
      const matchingVessel = MOCK_VESSELS.find((v) => v.id === project.primaryVesselId);
      expect(matchingVessel, `Vessel ${project.primaryVesselId} referenced in project ${project.id} not found`).toBeDefined();

      // Verify referenced crew exists in mock crew
      const matchingCrew = MOCK_CREW.find((c) => c.id === project.primaryCrewId);
      expect(matchingCrew, `Crew ${project.primaryCrewId} referenced in project ${project.id} not found`).toBeDefined();

      // Verify referenced equipment exists in mock equipment
      const matchingEquipment = MOCK_EQUIPMENT.find((e) => e.id === project.primaryEquipmentId);
      expect(matchingEquipment, `Equipment ${project.primaryEquipmentId} referenced in project ${project.id} not found`).toBeDefined();

      // Verify referenced activity exists in mock activities
      const matchingActivity = EXISTING_ACTIVITIES.find((a) => a.id === project.primaryActivityId);
      expect(matchingActivity, `Activity ${project.primaryActivityId} referenced in project ${project.id} not found`).toBeDefined();

      // Verify default template exists in SUBTYPE_TEMPLATES
      const matchingTemplate = SUBTYPE_TEMPLATES.find((t) => t.id === project.defaultTemplateId);
      expect(matchingTemplate, `Template ${project.defaultTemplateId} referenced in project ${project.id} not found`).toBeDefined();
    });
  });

  it('should auto-attach documents across all 4 sub-assets for a Project Scope campaign', () => {
    const targetProject = EXISTING_PROJECTS[0]; // Gorgon Project
    const targetVessel = MOCK_VESSELS.find((v) => v.id === targetProject.primaryVesselId)!;
    const targetCrew = MOCK_CREW.find((c) => c.id === targetProject.primaryCrewId)!;
    const targetEquipment = MOCK_EQUIPMENT.find((e) => e.id === targetProject.primaryEquipmentId)!;

    // Build raw requirements from template
    const template = SUBTYPE_TEMPLATES.find((t) => t.id === targetProject.defaultTemplateId)!;
    const rawRequirements: AssuranceRequirement[] = [];

    // Add Vessel requirements
    SUBTYPE_STANDARD_DOCS.Vessel.forEach((doc, idx) => {
      if (template.recommendedDocIds.includes(doc.id)) {
        rawRequirements.push({
          id: `req-ves-${idx}`,
          title: doc.title,
          category: doc.category,
          subtype: 'Vessel',
          isMandatory: doc.isMandatory,
          isFulfilled: false,
          ocrConfidence: 0,
          verifierStatus: 'Pending',
        });
      }
    });

    // Add Crew requirements
    SUBTYPE_STANDARD_DOCS.Crew.forEach((doc, idx) => {
      if (template.recommendedDocIds.includes(doc.id)) {
        rawRequirements.push({
          id: `req-crew-${idx}`,
          title: doc.title,
          category: doc.category,
          subtype: 'Crew',
          isMandatory: doc.isMandatory,
          isFulfilled: false,
          ocrConfidence: 0,
          verifierStatus: 'Pending',
        });
      }
    });

    // Add Activity requirements
    SUBTYPE_STANDARD_DOCS.Activity.forEach((doc, idx) => {
      if (template.recommendedDocIds.includes(doc.id)) {
        rawRequirements.push({
          id: `req-act-${idx}`,
          title: doc.title,
          category: doc.category,
          subtype: 'Activity',
          isMandatory: doc.isMandatory,
          isFulfilled: false,
          ocrConfidence: 0,
          verifierStatus: 'Pending',
        });
      }
    });

    // Add Equipment requirements
    SUBTYPE_STANDARD_DOCS.Equipment.forEach((doc, idx) => {
      if (template.recommendedDocIds.includes(doc.id)) {
        rawRequirements.push({
          id: `req-eq-${idx}`,
          title: doc.title,
          category: doc.category,
          subtype: 'Equipment',
          isMandatory: doc.isMandatory,
          isFulfilled: false,
          ocrConfidence: 0,
          verifierStatus: 'Pending',
        });
      }
    });

    const attached = autoAttachDocumentsToRequirements(rawRequirements, {
      documents: MOCK_DOCUMENTS,
      vessel: targetVessel,
      vessels: MOCK_VESSELS,
      crew: MOCK_CREW,
      selectedCrewId: targetCrew.id,
      equipment: MOCK_EQUIPMENT,
      selectedEquipmentId: targetEquipment.id,
      selectedVesselId: targetVessel.id,
      selectedActivityId: targetProject.primaryActivityId,
    });

    // Verify Vessel docs attached
    const vesselAttached = attached.filter((r) => r.subtype === 'Vessel' && r.isFulfilled);
    expect(vesselAttached.length).toBeGreaterThan(0);

    // Verify Crew docs attached
    const crewAttached = attached.filter((r) => r.subtype === 'Crew' && r.isFulfilled);
    expect(crewAttached.length).toBeGreaterThan(0);

    // Verify Activity docs attached
    const actAttached = attached.filter((r) => r.subtype === 'Activity' && r.isFulfilled);
    expect(actAttached.length).toBeGreaterThan(0);

    // Verify Equipment docs attached
    const eqAttached = attached.filter((r) => r.subtype === 'Equipment' && r.isFulfilled);
    expect(eqAttached.length).toBeGreaterThan(0);
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
    expect(THREE_PILLARS_CONFIG.Process.subtypes).toEqual(['Activity']);
  });
});
