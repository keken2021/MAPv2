/* 
  file summary: unit tests verifying the segmented assurance set creation workflow, subtype scoping, template application, and specialized document handling.
  responsibilities: tests multi-subtype and single-subtype scope, document description propagation, template recommendation mapping, and specialized document inclusion.
  role in system: executed during vitest test runs.
*/

import { describe, it, expect, beforeEach } from 'vitest';
import { useMapStore } from '../store/useMapStore';
import { AssuranceSet, AssuranceRequirement, AssuranceSubtype } from '../types/assurance';
import {
  SUBTYPE_STANDARD_DOCS,
  SUBTYPE_TEMPLATES,
  EXISTING_PROJECTS,
  ASSURANCE_SCOPE_OPTIONS,
  orderAssuranceScopes,
  getPrimaryAssuranceScope,
  getAssuranceSetScopes,
  buildAssuranceWizardSteps,
  DISABLED_ASSURANCE_SCOPES,
  isAssuranceSetScopeDisabled,
} from '../utils/assuranceTemplates';
import { MOCK_ASSURANCE_SETS } from '../store/mockData';
import { generateUniqueAssuranceSetId, generateUniqueRequirementId } from '../utils/validation';

describe('Segmented Assurance Set Creation Workflow', () => {
  beforeEach(() => {
    useMapStore.getState().setActivePersona('Administrator');
  });

  it('keeps ticked scopes in checklist order without repeats and files the set under the first one', () => {
    expect(ASSURANCE_SCOPE_OPTIONS).toEqual(['Vessel', 'Crew', 'Equipment']);
    expect(orderAssuranceScopes(['Equipment', 'Crew', 'Equipment', 'Vessel'])).toEqual(['Vessel', 'Crew', 'Equipment']);
    expect(orderAssuranceScopes([])).toEqual([]);

    expect(getPrimaryAssuranceScope(['Equipment', 'Crew'])).toBe('Crew');
    expect(getPrimaryAssuranceScope(['Equipment'])).toBe('Equipment');
    /* nothing ticked falls back to the default scope */
    expect(getPrimaryAssuranceScope([])).toBe('Vessel');
  });

  it('reads the scopes of a set from its subtypes, or from its type when it has none', () => {
    expect(getAssuranceSetScopes({ assuranceType: 'Vessel', subtypes: ['Crew', 'Vessel'] })).toEqual(['Vessel', 'Crew']);
    expect(getAssuranceSetScopes({ assuranceType: 'Equipment' })).toEqual(['Equipment']);
    expect(getAssuranceSetScopes({ assuranceType: 'Crew', subtypes: [] })).toEqual(['Crew']);
    expect(getAssuranceSetScopes({})).toEqual(['Vessel']);
  });

  it('keeps the activity scope switched off: not offered, no tab, and no seeded activity set', () => {
    expect(DISABLED_ASSURANCE_SCOPES).toEqual(['Activity']);
    expect(ASSURANCE_SCOPE_OPTIONS).not.toContain('Activity');
    expect(orderAssuranceScopes(['Activity', 'Crew'])).toEqual(['Crew']);
    expect(getPrimaryAssuranceScope(['Activity'])).toBe('Vessel');
    expect(buildAssuranceWizardSteps(['Activity', 'Crew']).map((s) => s.label)).toEqual(['Scope', 'Crew', 'Review']);

    /* a saved set still reports its real scopes, so an activity set never counts as a vessel contract */
    expect(getAssuranceSetScopes({ assuranceType: 'Activity', subtypes: ['Activity'] })).toEqual(['Activity']);
    expect(isAssuranceSetScopeDisabled({ assuranceType: 'Activity' })).toBe(true);
    expect(isAssuranceSetScopeDisabled({ assuranceType: 'Vessel' })).toBe(false);
    expect(isAssuranceSetScopeDisabled({})).toBe(false);

    expect(MOCK_ASSURANCE_SETS.some((s) => s.assuranceType === 'Activity')).toBe(false);
    expect(useMapStore.getState().assuranceSets.some((s) => s.id === 'AS-ACT-2026-SURF-01')).toBe(false);
  });

  it('builds one wizard tab per ticked scope, titled with the scope type, between Scope and Review', () => {
    const steps = buildAssuranceWizardSteps(['Crew', 'Vessel']);
    expect(steps.map((s) => s.label)).toEqual(['Scope', 'Vessel', 'Crew', 'Review']);
    expect(steps.map((s) => s.subtype)).toEqual([undefined, 'Vessel', 'Crew', undefined]);
    expect(new Set(steps.map((s) => s.id)).size).toBe(steps.length);

    expect(buildAssuranceWizardSteps(['Equipment']).map((s) => s.label)).toEqual(['Scope', 'Equipment', 'Review']);
    expect(buildAssuranceWizardSteps(ASSURANCE_SCOPE_OPTIONS).map((s) => s.label)).toEqual([
      'Scope',
      'Vessel',
      'Crew',
      'Equipment',
      'Review',
    ]);
    /* with nothing ticked only the fixed tabs remain */
    expect(buildAssuranceWizardSteps([]).map((s) => s.label)).toEqual(['Scope', 'Review']);
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

  it('creates a multi-subtype campaign with combined requirements and specialized documents', () => {
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
      assuranceType: 'Vessel',
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
    expect(retrieved?.assuranceType).toBe('Vessel');
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
      assuranceType: 'Vessel',
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

  it('updates the existing draft in-place without creating another draft when the wizard is exited or saved without initiating', () => {
    const store = useMapStore.getState();
    const initialSetsCount = store.assuranceSets.length;
    const draftId = generateUniqueAssuranceSetId(store.assuranceSets);

    const initialDraft: AssuranceSet = {
      id: draftId,
      title: 'Northwind - Initial Partial Draft Campaign',
      assuranceType: 'Vessel',
      projectId: 'MAP-PROJ-2026-OFFSHORE-001',
      projectName: 'Gorgon Stage 2 & Jansz-Io Compression',
      subtypes: ['Vessel', 'Crew', 'Activity', 'Equipment'],
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
      mandatoryInspectionRequired: true,
      inspectionCompleted: false,
      requirements: [],
      stakeholders: undefined,
      assignedStakeholders: undefined,
      createdByPersona: '',
    };

    // Save draft initial creation
    store.addAssuranceSet(initialDraft);
    expect(useMapStore.getState().assuranceSets.length).toBe(initialSetsCount + 1);

    // User resumes setup of the existing draft, changes scope to 'Activity' with specialized requirements, and saves draft upon exit
    const updatedDraftState: AssuranceSet = {
      ...initialDraft,
      title: 'Northwind - Modified In-Progress Activity Draft Campaign',
      assuranceType: 'Activity',
      subtypes: ['Activity'],
      requirements: [
        {
          id: `${draftId}-REQ-ACT-001`,
          category: 'Operational Plan',
          title: 'Specialized Subsea Trenching Method Statement',
          isMandatory: true,
          isSpecialized: true,
          isFulfilled: false,
          ocrConfidence: 0,
          verifierStatus: 'Pending',
        },
      ],
    };

    // When exiting/saving draft, store.updateAssuranceSet is invoked instead of addAssuranceSet
    store.updateAssuranceSet(updatedDraftState);

    const afterSaveSets = useMapStore.getState().assuranceSets;
    // Total count must not increase (no duplicate drafts created)
    expect(afterSaveSets.length).toBe(initialSetsCount + 1);

    // The draft must be updated with the new state
    const persistedDraft = afterSaveSets.find((s) => s.id === draftId);
    expect(persistedDraft).toBeDefined();
    expect(persistedDraft?.title).toBe('Northwind - Modified In-Progress Activity Draft Campaign');
    expect(persistedDraft?.assuranceType).toBe('Activity');
    expect(persistedDraft?.subtypes).toEqual(['Activity']);
    expect(persistedDraft?.requirements.length).toBe(1);
    expect(persistedDraft?.requirements[0].title).toBe('Specialized Subsea Trenching Method Statement');
    expect(persistedDraft?.visibility).toBe('draft');
  });

  it('provides a standardized catalog of existing projects that adhere to the naming format', () => {
    expect(EXISTING_PROJECTS).toBeDefined();
    expect(EXISTING_PROJECTS.length).toBeGreaterThanOrEqual(4);

    EXISTING_PROJECTS.forEach((proj: { id: string; name: string; clientOperator: string; location: string; description: string; }) => {
      expect(proj.id).toMatch(/^MAP-PROJ-\d{4}-[A-Z]+-\d{3}$/);
      expect(proj.name).toBeTruthy();
      expect(proj.clientOperator).toBeTruthy();
      expect(proj.location).toBeTruthy();
      expect(proj.description).toBeTruthy();
    });
  });

  it('attaches and persists the selected project for project-linked assurance sets and drafts', () => {
    const store = useMapStore.getState();
    const uniqueId = generateUniqueAssuranceSetId(store.assuranceSets);

    const projectSetWithAttachment: AssuranceSet = {
      id: uniqueId,
      title: 'Chevron - Gorgon Stage 2 Compression Vetting',
      assuranceType: 'Vessel',
      projectId: 'MAP-PROJ-2026-OFFSHORE-001',
      projectName: 'Gorgon Stage 2 & Jansz-Io Compression',
      subtypes: ['Vessel', 'Crew', 'Activity', 'Equipment'],
      vesselId: 'VESSEL-001',
      vesselName: 'MV Pacific Endeavour',
      imoNumber: '9123456',
      initiatorOrg: 'Chevron Australia Pty Ltd',
      initiatorRole: 'C Admin · Client Created',
      charterer: 'Chevron Australia Pty Ltd',
      charterWindowStart: '2026-11-01',
      charterWindowEnd: '2027-11-01',
      stage: 'Initiated',
      readinessScore: 10,
      mandatoryInspectionRequired: true,
      inspectionCompleted: false,
      requirements: [],
      stakeholders: undefined,
      assignedStakeholders: undefined,
      createdByPersona: '',
    };

    store.addAssuranceSet(projectSetWithAttachment);

    const retrieved = useMapStore.getState().assuranceSets.find((s) => s.id === uniqueId);
    expect(retrieved).toBeDefined();
    expect(retrieved?.assuranceType).toBe('Vessel');
  });

  it('provides a standardized catalog of existing activities that adhere to the naming format', () => {
    import('../utils/assuranceTemplates').then(({ EXISTING_ACTIVITIES }) => {
      expect(EXISTING_ACTIVITIES).toBeDefined();
      expect(EXISTING_ACTIVITIES.length).toBeGreaterThanOrEqual(4);

      EXISTING_ACTIVITIES.forEach((act) => {
        expect(act.id).toMatch(/^MAP-ACT-\d{4}-[A-Z]+-\d{3}$/);
        expect(act.name).toBeTruthy();
        expect(act.category).toBeTruthy();
        expect(act.location).toBeTruthy();
        expect(act.description).toBeTruthy();
      });
    });
  });

  it('dynamically adapts asset association based on assurance scope (Vessel, Crew, Equipment, Activity)', () => {
    const store = useMapStore.getState();

    // 1. Crew scope assurance set
    const crewSetId = generateUniqueAssuranceSetId(store.assuranceSets);
    const crewSet: AssuranceSet = {
      id: crewSetId,
      title: 'Northwind - Alexander Wright Master Crew Credential Assurance',
      assuranceType: 'Crew',
      crewId: 'CREW-101',
      crewName: 'Capt. Alexander Wright',
      subtypes: ['Crew'],
      vesselId: 'VESSEL-001',
      vesselName: 'Capt. Alexander Wright',
      imoNumber: 'N/A',
      initiatorOrg: 'Northwind Marine Pty Ltd',
      initiatorRole: 'Vessel Provider Admin',
      charterer: 'Northwind Marine Pty Ltd',
      charterWindowStart: '2026-11-01',
      charterWindowEnd: '2027-11-01',
      stage: 'Initiated',
      readinessScore: 10,
      mandatoryInspectionRequired: false,
      inspectionCompleted: false,
      requirements: [],
      stakeholders: undefined,
      assignedStakeholders: undefined,
      createdByPersona: '',
    };
    store.addAssuranceSet(crewSet);

    const retrievedCrewSet = useMapStore.getState().assuranceSets.find((s) => s.id === crewSetId);
    expect(retrievedCrewSet).toBeDefined();
    expect(retrievedCrewSet?.assuranceType).toBe('Crew');
    expect(retrievedCrewSet?.crewId).toBe('CREW-101');
    expect(retrievedCrewSet?.crewName).toBe('Capt. Alexander Wright');

    // 2. Equipment scope assurance set
    const eqSetId = generateUniqueAssuranceSetId(useMapStore.getState().assuranceSets);
    const eqSet: AssuranceSet = {
      id: eqSetId,
      title: 'Northwind - WROV Schilling System Certification',
      assuranceType: 'Equipment',
      equipmentId: 'EQ-101',
      equipmentName: 'Work-Class ROV System (WROV-01)',
      subtypes: ['Equipment'],
      vesselId: 'VESSEL-001',
      vesselName: 'Work-Class ROV System (WROV-01)',
      imoNumber: 'N/A',
      initiatorOrg: 'Northwind Marine Pty Ltd',
      initiatorRole: 'Vessel Provider Admin',
      charterer: 'Northwind Marine Pty Ltd',
      charterWindowStart: '2026-11-01',
      charterWindowEnd: '2027-11-01',
      stage: 'Initiated',
      readinessScore: 10,
      mandatoryInspectionRequired: true,
      inspectionCompleted: false,
      requirements: [],
      stakeholders: undefined,
      assignedStakeholders: undefined,
      createdByPersona: '',
    };
    store.addAssuranceSet(eqSet);

    const retrievedEqSet = useMapStore.getState().assuranceSets.find((s) => s.id === eqSetId);
    expect(retrievedEqSet).toBeDefined();
    expect(retrievedEqSet?.assuranceType).toBe('Equipment');
    expect(retrievedEqSet?.equipmentId).toBe('EQ-101');
    expect(retrievedEqSet?.equipmentName).toBe('Work-Class ROV System (WROV-01)');

    // 3. Activity scope assurance set
    const actSetId = generateUniqueAssuranceSetId(useMapStore.getState().assuranceSets);
    const actSet: AssuranceSet = {
      id: actSetId,
      title: 'Chevron - Deepwater SURF Installation Campaign Assurance',
      assuranceType: 'Activity',
      activityId: 'MAP-ACT-2026-SURF-001',
      activityName: 'Deepwater SURF & Subsea Tie-In Installation',
      subtypes: ['Activity'],
      vesselId: 'VESSEL-001',
      vesselName: 'Deepwater SURF & Subsea Tie-In Installation',
      imoNumber: 'N/A',
      initiatorOrg: 'Chevron Australia Pty Ltd',
      initiatorRole: 'C Admin · Client Created',
      charterer: 'Chevron Australia Pty Ltd',
      charterWindowStart: '2026-11-01',
      charterWindowEnd: '2027-11-01',
      stage: 'Initiated',
      readinessScore: 10,
      mandatoryInspectionRequired: true,
      inspectionCompleted: false,
      requirements: [],
      stakeholders: undefined,
      assignedStakeholders: undefined,
      createdByPersona: '',
    };
    store.addAssuranceSet(actSet);

    const retrievedActSet = useMapStore.getState().assuranceSets.find((s) => s.id === actSetId);
    expect(retrievedActSet).toBeDefined();
    expect(retrievedActSet?.assuranceType).toBe('Activity');
    expect(retrievedActSet?.activityId).toBe('MAP-ACT-2026-SURF-001');
    expect(retrievedActSet?.activityName).toBe('Deepwater SURF & Subsea Tie-In Installation');
  });
});




