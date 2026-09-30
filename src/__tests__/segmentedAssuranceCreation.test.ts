/* 
  file summary: unit tests verifying the segmented assurance set creation workflow, subtype scoping, template application, and specialized document handling.
  responsibilities: tests Project scope vs standalone Subtype scope, document description propagation, template recommendation mapping, and specialized document inclusion.
  role in system: executed during vitest test runs.
*/

import { describe, it, expect, beforeEach } from 'vitest';
import { useMapStore } from '../store/useMapStore';
import { AssuranceSet, AssuranceRequirement, AssuranceSubtype } from '../types/assurance';
import { SUBTYPE_STANDARD_DOCS, SUBTYPE_TEMPLATES } from '../utils/assuranceTemplates';
import { generateUniqueAssuranceSetId, generateUniqueRequirementId } from '../utils/validation';

describe('Segmented Assurance Set Creation Workflow', () => {
  beforeEach(() => {
    useMapStore.getState().setActivePersona('Administrator');
  });

  it('provides all 4 standard operational subtypes with complete descriptions', () => {
    const subtypes: AssuranceSubtype[] = ['Vessel', 'Crew', 'Activity', 'Equipment'];

    subtypes.forEach((subtype) => {
      const docList = SUBTYPE_STANDARD_DOCS[subtype];
      expect(docList).toBeDefined();
      expect(docList.length).toBeGreaterThan(0);

      docList.forEach((doc) => {
        expect(doc.title).toBeTruthy();
        expect(doc.description).toBeTruthy();
        expect(doc.description.length).toBeGreaterThan(15);
        expect(doc.subtype).toBe(subtype);
      });
    });
  });

  it('creates a multi-subtype Project campaign with combined requirements and specialized documents', () => {
    const store = useMapStore.getState();
    const uniqueId = generateUniqueAssuranceSetId(store.assuranceSets);

    const projectRequirements: AssuranceRequirement[] = [];
    let reqIndex = 0;

    const subtypes: AssuranceSubtype[] = ['Vessel', 'Crew', 'Activity', 'Equipment'];
    subtypes.forEach((subtype) => {
      const defaultDocs = SUBTYPE_STANDARD_DOCS[subtype].filter((d) => d.defaultEnabled);
      defaultDocs.forEach((d) => {
        projectRequirements.push({
          id: generateUniqueRequirementId(uniqueId, reqIndex++),
          category: d.category,
          title: d.title,
          description: d.description,
          subtype: d.subtype,
          isMandatory: d.isMandatory,
          isFulfilled: false,
          ocrConfidence: 0,
          verifierStatus: 'Pending',
        });
      });
    });

    // Add a specialized custom document
    projectRequirements.push({
      id: generateUniqueRequirementId(uniqueId, reqIndex++),
      category: 'Custom Requirement',
      title: 'Subsea Umbilical Insulation Test',
      description: 'Engineering high-voltage insulation test report verifying insulation resistance under operating tension.',
      subtype: 'Equipment',
      isMandatory: true,
      isSpecialized: true,
      isFulfilled: false,
      ocrConfidence: 0,
      verifierStatus: 'Pending',
    });

    const newProjectSet: AssuranceSet = {
      id: uniqueId,
      title: 'Northwind - Scarborough Subsea Engineering Campaign',
      assuranceType: 'Project',
      subtypes: ['Vessel', 'Crew', 'Activity', 'Equipment'],
      vesselId: 'VESSEL-001',
      vesselName: 'MV Pacific Endeavour',
      imoNumber: '9123456',
      initiatorOrg: 'Northwind Marine Pty Ltd',
      initiatorRole: 'Vessel Provider Admin',
      charterer: 'Woodside Energy Ltd',
      charterWindowStart: '2026-12-01',
      charterWindowEnd: '2027-12-01',
      stage: 'Initiated',
      readinessScore: 10,
      mandatoryInspectionRequired: true,
      inspectionCompleted: false,
      requirements: projectRequirements,
      stakeholders: undefined,
      assignedStakeholders: undefined,
      createdByPersona: '',
    };

    store.addAssuranceSet(newProjectSet);

    const retrieved = useMapStore.getState().assuranceSets.find((s) => s.id === uniqueId);
    expect(retrieved).toBeDefined();
    expect(retrieved?.assuranceType).toBe('Project');
    expect(retrieved?.subtypes).toEqual(['Vessel', 'Crew', 'Activity', 'Equipment']);
    expect(retrieved?.requirements.length).toBeGreaterThan(10);

    const specializedReq = retrieved?.requirements.find((r) => r.isSpecialized);
    expect(specializedReq).toBeDefined();
    expect(specializedReq?.title).toBe('Subsea Umbilical Insulation Test');
    expect(specializedReq?.subtype).toBe('Equipment');
  });

  it('creates a standalone single subtype assurance set (e.g. Crew only)', () => {
    const store = useMapStore.getState();
    const uniqueId = generateUniqueAssuranceSetId(store.assuranceSets);

    const crewDocs = SUBTYPE_STANDARD_DOCS.Crew.filter((d) => d.defaultEnabled);
    const requirements: AssuranceRequirement[] = crewDocs.map((d, idx) => ({
      id: generateUniqueRequirementId(uniqueId, idx),
      category: d.category,
      title: d.title,
      description: d.description,
      subtype: 'Crew',
      isMandatory: d.isMandatory,
      isFulfilled: false,
      ocrConfidence: 0,
      verifierStatus: 'Pending',
    }));

    const newCrewSet: AssuranceSet = {
      id: uniqueId,
      title: 'Northwind - Annual Crew Competency Audit',
      assuranceType: 'Crew',
      subtypes: ['Crew'],
      vesselId: 'VESSEL-002',
      vesselName: 'MV Coral Titan',
      imoNumber: '9284710',
      initiatorOrg: 'Northwind Marine Pty Ltd',
      initiatorRole: 'Vessel Provider Admin',
      charterer: 'Shell Australia Pty Ltd',
      charterWindowStart: '2026-11-01',
      charterWindowEnd: '2027-05-01',
      stage: 'Initiated',
      readinessScore: 10,
      mandatoryInspectionRequired: false,
      inspectionCompleted: false,
      requirements,
      stakeholders: undefined,
      assignedStakeholders: undefined,
      createdByPersona: '',
    };

    store.addAssuranceSet(newCrewSet);

    const retrieved = useMapStore.getState().assuranceSets.find((s) => s.id === uniqueId);
    expect(retrieved).toBeDefined();
    expect(retrieved?.assuranceType).toBe('Crew');
    expect(retrieved?.subtypes).toEqual(['Crew']);
    expect(retrieved?.requirements.every((r) => r.subtype === 'Crew')).toBe(true);
  });

  it('maps public and organization templates to recommended document sets', () => {
    const imcaTemplate = SUBTYPE_TEMPLATES.find((t) => t.id === 'tmpl-pub-imca-vessel');
    expect(imcaTemplate).toBeDefined();
    expect(imcaTemplate?.source).toBe('public');
    expect(imcaTemplate?.recommendedDocIds).toContain('vessel-class-cert');
    expect(imcaTemplate?.recommendedDocIds).toContain('vessel-solas-safety');

    const chevronTemplate = SUBTYPE_TEMPLATES.find((t) => t.id === 'tmpl-org-chevron-gorgon');
    expect(chevronTemplate).toBeDefined();
    expect(chevronTemplate?.source).toBe('organization');
    expect(chevronTemplate?.organizationName).toBe('Chevron Australia Pty Ltd');
    expect(chevronTemplate?.recommendedDocIds.length).toBeGreaterThan(10);
  });

  it('strictly adheres document categories to the specific asset subtype rather than a general list', () => {
    import('../utils/assuranceTemplates').then(({ SUBTYPE_CATEGORIES }) => {
      expect(SUBTYPE_CATEGORIES.Vessel).toContain('Statutory Certificate');
      expect(SUBTYPE_CATEGORIES.Vessel).toContain('Class Notation Certificate');
      expect(SUBTYPE_CATEGORIES.Vessel).not.toContain('Crew Credential');
      expect(SUBTYPE_CATEGORIES.Vessel).not.toContain('Operational Plan');

      expect(SUBTYPE_CATEGORIES.Crew).toContain('Crew Credential');
      expect(SUBTYPE_CATEGORIES.Crew).toContain('Certificate of Competency (CoC)');
      expect(SUBTYPE_CATEGORIES.Crew).not.toContain('Statutory Certificate');
      expect(SUBTYPE_CATEGORIES.Crew).not.toContain('Lifting Appliance Register (ILO 152)');

      expect(SUBTYPE_CATEGORIES.Activity).toContain('Operational Plan');
      expect(SUBTYPE_CATEGORIES.Activity).toContain('Method Statement (MOP)');
      expect(SUBTYPE_CATEGORIES.Activity).not.toContain('Crew Credential');

      expect(SUBTYPE_CATEGORIES.Equipment).toContain('Equipment Register');
      expect(SUBTYPE_CATEGORIES.Equipment).toContain('Lifting Appliance Register (ILO 152)');
      expect(SUBTYPE_CATEGORIES.Equipment).toContain('DP FMEA Proving Trial');
      expect(SUBTYPE_CATEGORIES.Equipment).not.toContain('Certificate of Competency (CoC)');
    });
  });

  it('correctly categorizes assurance sets into Public, Organization, and Draft tabs', () => {
    const sets = useMapStore.getState().assuranceSets;
    expect(sets.length).toBeGreaterThan(0);

    const isPublicSet = (s: AssuranceSet) =>
      s.visibility === 'public' || s.templateSource === 'public' || s.stage === 'Approved' || s.stage === 'Certified';

    const isDraftSet = (s: AssuranceSet) =>
      s.visibility === 'draft' || s.stage === 'Initiated';

    const isOrgSet = (s: AssuranceSet) =>
      s.visibility === 'organization' || (!isDraftSet(s) && !isPublicSet(s)) || (s.stage !== 'Initiated' && s.visibility !== 'public');

    const publicSets = sets.filter(isPublicSet);
    const orgSets = sets.filter(isOrgSet);
    const draftSets = sets.filter(isDraftSet);

    expect(publicSets.length).toBeGreaterThanOrEqual(1);
    expect(orgSets.length).toBeGreaterThanOrEqual(1);
    expect(draftSets.length).toBeGreaterThanOrEqual(1);
  });

  it('supports configuring template privacy (public vs organization) and saving as draft', () => {
    const store = useMapStore.getState();
    const draftId = generateUniqueAssuranceSetId(store.assuranceSets);

    const draftSet: AssuranceSet = {
      id: draftId,
      title: 'Northwind - Draft Equipment Certification Baseline',
      assuranceType: 'Equipment',
      subtypes: ['Equipment'],
      visibility: 'draft',
      templateSource: 'organization',
      vesselId: 'VESSEL-001',
      vesselName: 'MV Pacific Endeavour',
      imoNumber: '9123456',
      initiatorOrg: 'Northwind Marine Pty Ltd',
      initiatorRole: 'Vessel Provider Admin',
      charterer: 'Northwind Marine Pty Ltd',
      charterWindowStart: '2026-11-01',
      charterWindowEnd: '2027-11-01',
      stage: 'Initiated',
      readinessScore: 0,
      mandatoryInspectionRequired: false,
      inspectionCompleted: false,
      requirements: [],
      stakeholders: undefined,
      assignedStakeholders: undefined,
      createdByPersona: '',
    };

    store.addAssuranceSet(draftSet);

    const retrievedDraft = useMapStore.getState().assuranceSets.find((s) => s.id === draftId);
    expect(retrievedDraft).toBeDefined();
    expect(retrievedDraft?.visibility).toBe('draft');
    expect(retrievedDraft?.stage).toBe('Initiated');
    expect(retrievedDraft?.templateSource).toBe('organization');

    // Create a public template campaign
    const publicId = generateUniqueAssuranceSetId(useMapStore.getState().assuranceSets);
    const publicSet: AssuranceSet = {
      ...draftSet,
      id: publicId,
      title: 'Global IMCA DP Proving Trial Standard 2026',
      visibility: 'public',
      templateSource: 'public',
    };

    store.addAssuranceSet(publicSet);

    const retrievedPublic = useMapStore.getState().assuranceSets.find((s) => s.id === publicId);
    expect(retrievedPublic).toBeDefined();
    expect(retrievedPublic?.visibility).toBe('public');
    expect(retrievedPublic?.templateSource).toBe('public');
  });

  it('ensures draft assurance sets resume in wizard setup and graduate to registered sets without duplication', () => {
    const store = useMapStore.getState();
    const draftId = generateUniqueAssuranceSetId(store.assuranceSets);

    // 1. Initial draft creation
    const draftSet: AssuranceSet = {
      id: draftId,
      title: 'Woodside - Unfinished Scarborough Vetting Draft',
      assuranceType: 'Project',
      subtypes: ['Vessel', 'Crew', 'Activity', 'Equipment'],
      visibility: 'draft',
      templateSource: 'organization',
      vesselId: 'VESSEL-001',
      vesselName: 'MV Pacific Endeavour',
      imoNumber: '9123456',
      initiatorOrg: 'Northwind Marine Pty Ltd',
      initiatorRole: 'Vessel Provider Admin',
      charterer: 'Woodside Energy Ltd',
      charterWindowStart: '2026-11-01',
      charterWindowEnd: '2027-11-01',
      stage: 'Initiated',
      readinessScore: 0,
      mandatoryInspectionRequired: true,
      inspectionCompleted: false,
      requirements: [],
      stakeholders: undefined,
      assignedStakeholders: undefined,
      createdByPersona: '',
    };

    store.addAssuranceSet(draftSet);

    const initialDraft = useMapStore.getState().assuranceSets.find((s) => s.id === draftId);
    expect(initialDraft).toBeDefined();
    expect(initialDraft?.visibility).toBe('draft');

    // 2. Resume in wizard and complete initiation (graduates from draft to registered set)
    const graduatedSet: AssuranceSet = {
      ...initialDraft!,
      visibility: 'organization',
      stage: 'Initiated',
      requirements: [
        {
          id: `${draftId}-REQ-001`,
          category: 'Statutory Certificate',
          title: 'International Load Line Certificate',
          isMandatory: true,
          isFulfilled: false,
          ocrConfidence: 0,
          verifierStatus: 'Pending',
        },
      ],
    };

    store.updateAssuranceSet(graduatedSet);

    const activeSet = useMapStore.getState().assuranceSets.find((s) => s.id === draftId);
    expect(activeSet).toBeDefined();
    expect(activeSet?.visibility).toBe('organization');
    expect(activeSet?.requirements.length).toBe(1);

    // Verify no duplicate set was created with the same ID
    const matchingSets = useMapStore.getState().assuranceSets.filter((s) => s.id === draftId);
    expect(matchingSets.length).toBe(1);
  });
});


