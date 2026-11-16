/* AS-04 / AS-05 demo preseed behaviour for Oil Co walkthroughs and all templates. */
import { beforeEach, describe, expect, it } from 'vitest';
import { useMapStore } from '../store/useMapStore';
import { AssuranceRequirement, AssuranceSet } from '../types/assurance';
import { MasterDocument } from '../types/document';
import { getSetVessel } from '../utils/setObjects';
import { SUBTYPE_STANDARD_DOCS, SUBTYPE_TEMPLATES } from '../utils/assuranceTemplates';
import {
  DEMO_OPEN_UPLOAD_COUNT,
  attachDemoDocumentsToRequirements,
  autoVerifyDemoPreseededRequirements,
  filterNewDemoDocuments,
  rebuildMissingDemoDocuments,
} from '../utils/oilCoDemoPreseed';
import { derivePipelineStage } from '../utils/readinessHelpers';

const initialState = useMapStore.getState();

function buildPreseededSet(templateId: string): {
  set: AssuranceSet;
  documents: MasterDocument[];
  openTitles: string[];
  preseededTitles: string[];
} {
  const template = SUBTYPE_TEMPLATES.find((item) => item.id === templateId)!;
  const tasks = template.customRequirements ?? [];
  const rawRequirements: AssuranceRequirement[] = tasks.map((task, index) => ({
    id: `req-${index}`,
    category: 'Process',
    title: task.title,
    isMandatory: true,
    isFulfilled: false,
    ocrConfidence: 0,
    verifierStatus: 'Pending',
  }));

  const { requirements, demoDocuments } = attachDemoDocumentsToRequirements(rawRequirements, {
    setId: 'AS-DEMO-PRESEED',
    respondingParty: 'Oil Company',
    targetObject: { type: 'vessel', id: 'VES-DEMO', name: 'Demo Vessel' },
  });

  return {
    set: {
      id: 'AS-DEMO-PRESEED',
      title: template.name,
      parties: [
        { organization: 'Northwind Marine Pty Ltd', role: 'Requesting party' },
        { organization: 'Oil Company', role: 'Responding party' },
        { organization: 'Coastal Fuel Testing', role: 'Third party' },
      ],
      assuranceObjects: [
        {
          id: 'VES-DEMO',
          type: 'vessel',
          name: 'Demo Vessel',
          identifier: '1234567',
          ownerOrganization: 'Oil Company',
        },
      ],
      startDate: '2026-11-18',
      deadline: '2026-11-18',
      endDate: '2026-11-20',
      dateHistory: [],
      stage: 'Validation',
      readinessScore: 10,
      verificationRequired: true,
      formalApprovalRequired: true,
      mandatoryInspectionRequired: false,
      inspectionCompleted: false,
      requirements,
      createdBy: { userId: 'USR-101', name: 'K. Osei', persona: 'Administrator' },
      submitters: [{ organization: 'Oil Company', assignee: 'J. Hale (Oil Company)' }],
      stakeholders: {
        submitterOrg: 'Oil Company',
        submitterName: 'J. Hale (Oil Company)',
        verifierOrg: 'Coastal Fuel Testing',
        verifierName: 'N. Brooks (Coastal Fuel Testing)',
      },
    },
    documents: demoDocuments,
    openTitles: tasks.slice(0, DEMO_OPEN_UPLOAD_COUNT).map((task) => task.title),
    preseededTitles: tasks.slice(DEMO_OPEN_UPLOAD_COUNT).map((task) => task.title),
  };
}

describe('oil Co AS-04 / AS-05 demo preseed', () => {
  beforeEach(() => {
    useMapStore.setState(initialState, true);
  });

  it('renames the public templates to AS-04 and AS-05', () => {
    expect(SUBTYPE_TEMPLATES.find((t) => t.id === 'tmpl-pub-ss04-bunkering')?.name).toBe(
      'AS-04 Bunkering / Fuel Supply',
    );
    expect(SUBTYPE_TEMPLATES.find((t) => t.id === 'tmpl-pub-ss05-control-systems')?.name).toBe(
      'AS-05 IT / Control Systems',
    );
  });

  it('starts with first 3 awaiting upload and the rest Submitted (not Verified)', () => {
    const { set, openTitles, preseededTitles } = buildPreseededSet('tmpl-pub-ss04-bunkering');
    expect(openTitles).toHaveLength(3);
    expect(preseededTitles).toHaveLength(8);
    expect(derivePipelineStage(set)).toBe('Validation');

    const open = set.requirements.filter((req) => openTitles.includes(req.title));
    const preseeded = set.requirements.filter((req) => preseededTitles.includes(req.title));

    expect(open.every((req) => !req.documentId && req.verifierStatus === 'Pending')).toBe(true);
    expect(
      preseeded.every(
        (req) =>
          Boolean(req.documentId) &&
          req.demoPreseeded === true &&
          req.verifierStatus === 'Pending' &&
          req.isFulfilled === false,
      ),
    ).toBe(true);
  });

  it('attaches demo documents for a non-SS-04/05 template leaving the first 3 open', () => {
    const standardDocs = SUBTYPE_STANDARD_DOCS.Vessel.slice(0, 7);
    const rawRequirements: AssuranceRequirement[] = standardDocs.map((doc, idx) => ({
      id: `req-imca-${idx}`,
      category: doc.category,
      title: doc.title,
      docTypeId: doc.id,
      isMandatory: doc.isMandatory,
      isFulfilled: false,
      ocrConfidence: 0,
      verifierStatus: 'Pending',
    }));

    const { requirements, demoDocuments } = attachDemoDocumentsToRequirements(rawRequirements, {
      setId: 'AS-IMCA-DEMO',
      respondingParty: 'Northwind Marine Pty Ltd',
      targetObject: { type: 'vessel', id: 'VESSEL-001', name: 'Pacific Sentinel' },
    });

    expect(requirements).toHaveLength(7);
    // First 3 open
    expect(requirements.slice(0, 3).every((r) => !r.documentId && r.verifierStatus === 'Pending')).toBe(true);
    // Next 4 attached
    expect(
      requirements.slice(3).every(
        (r) =>
          Boolean(r.documentId) &&
          r.demoPreseeded === true &&
          r.verifierStatus === 'Pending' &&
          !r.isFulfilled &&
          r.ocrConfidence === 96 &&
          r.notes === 'Demo pre-seeded upload',
      ),
    ).toBe(true);
    expect(demoDocuments).toHaveLength(4);
    expect(demoDocuments.every((d) => d.verificationStatus === 'Pending' && d.ocrConfidence === 96)).toBe(true);
  });

  it('attaches demo documents to general and standard documents beyond the first 3', () => {
    const rawRequirements: AssuranceRequirement[] = [
      { id: 'req-gen-1', category: 'Statutory Certificate', title: 'Company ISM DOC', isMandatory: true, isFulfilled: false, ocrConfidence: 0, verifierStatus: 'Pending' },
      { id: 'req-gen-2', category: 'Commercial & Legal', title: 'Mutual NDA', isMandatory: true, isFulfilled: false, ocrConfidence: 0, verifierStatus: 'Pending' },
      { id: 'req-gen-3', category: 'Commercial & Legal', title: 'Master Service Agreement', isMandatory: true, isFulfilled: false, ocrConfidence: 0, verifierStatus: 'Pending' },
      { id: 'req-gen-4', category: 'Commercial & Legal', title: 'Additional General Policy', isMandatory: true, isFulfilled: false, ocrConfidence: 0, verifierStatus: 'Pending' },
      { id: 'req-std-1', category: 'Statutory Certificate', title: 'Certificate of Class', isMandatory: true, isFulfilled: false, ocrConfidence: 0, verifierStatus: 'Pending' },
    ];

    const { requirements, demoDocuments } = attachDemoDocumentsToRequirements(rawRequirements, {
      setId: 'AS-GEN-STD-DEMO',
      respondingParty: 'Northwind Marine Pty Ltd',
      targetObject: { type: 'vessel', id: 'VESSEL-001', name: 'Pacific Sentinel' },
    });

    expect(requirements).toHaveLength(5);
    // First 3 stay open
    expect(requirements[0].documentId).toBeUndefined();
    expect(requirements[1].documentId).toBeUndefined();
    expect(requirements[2].documentId).toBeUndefined();
    // 4th (general doc) and 5th (standard doc) get attached
    expect(requirements[3].documentId).toBeDefined();
    expect(requirements[3].demoPreseeded).toBe(true);
    expect(requirements[3].notes).toBe('Demo pre-seeded upload');
    expect(requirements[4].documentId).toBeDefined();
    expect(requirements[4].demoPreseeded).toBe(true);
    expect(requirements[4].notes).toBe('Demo pre-seeded upload');
    expect(demoDocuments).toHaveLength(2);
  });

  it('leaves all documents open for a set with 3 or fewer documents', () => {
    const rawRequirements: AssuranceRequirement[] = [
      { id: 'req-1', category: 'Statutory Certificate', title: 'DOC', isMandatory: true, isFulfilled: false, ocrConfidence: 0, verifierStatus: 'Pending' },
      { id: 'req-2', category: 'Commercial & Legal', title: 'NDA', isMandatory: true, isFulfilled: false, ocrConfidence: 0, verifierStatus: 'Pending' },
      { id: 'req-3', category: 'Commercial & Legal', title: 'MSA', isMandatory: true, isFulfilled: false, ocrConfidence: 0, verifierStatus: 'Pending' },
    ];

    const { requirements, demoDocuments } = attachDemoDocumentsToRequirements(rawRequirements, {
      setId: 'AS-SMALL-SET',
      respondingParty: 'Northwind Marine Pty Ltd',
      targetObject: { type: 'vessel', id: 'VESSEL-001', name: 'Pacific Sentinel' },
    });

    expect(requirements).toHaveLength(3);
    expect(requirements.every((r) => !r.documentId && r.verifierStatus === 'Pending' && !r.isFulfilled)).toBe(true);
    expect(demoDocuments).toEqual([]);
  });

  it('links an existing document when duplicate title is found on target object without creating another', () => {
    const existingDoc: MasterDocument = {
      id: 'DOC-EXISTING-001',
      title: 'Safety Equipment Certificate',
      entityType: 'Vessel Certificate',
      vesselId: 'VESSEL-001',
      targetObjectType: 'vessel',
      targetObjectId: 'VESSEL-001',
      targetObjectName: 'Pacific Sentinel',
      certificateNo: 'SEC-2026-99',
      issuingAuthority: 'DNV',
      expiryDate: '2028-01-01',
      ocrConfidence: 98,
      complianceState: 'Valid',
      currentVersion: 'v2.1',
      versions: [
        {
          versionLabel: 'v2.1',
          uploadedAt: '2026-10-01T00:00:00.000Z',
          uploadedBy: 'Northwind Marine Pty Ltd',
          fileSizeBytes: 420000,
          fileName: 'safety-equipment-certificate.pdf',
          changeSummary: 'Existing uploaded version',
        },
      ],
      validationRules: { charterBufferPassed: true, assetMatch100Percent: true, iacsAuthorityValid: true, overallValid: true },
      verificationStatus: 'Pending',
    };

    const rawRequirements: AssuranceRequirement[] = [
      { id: 'req-1', category: 'Statutory Certificate', title: 'DOC', isMandatory: true, isFulfilled: false, ocrConfidence: 0, verifierStatus: 'Pending' },
      { id: 'req-2', category: 'Commercial & Legal', title: 'NDA', isMandatory: true, isFulfilled: false, ocrConfidence: 0, verifierStatus: 'Pending' },
      { id: 'req-3', category: 'Commercial & Legal', title: 'MSA', isMandatory: true, isFulfilled: false, ocrConfidence: 0, verifierStatus: 'Pending' },
      { id: 'req-4', category: 'Statutory Certificate', title: 'Safety Equipment Certificate', isMandatory: true, isFulfilled: false, ocrConfidence: 0, verifierStatus: 'Pending' },
    ];

    const { requirements, demoDocuments } = attachDemoDocumentsToRequirements(rawRequirements, {
      setId: 'AS-DUP-CHECK',
      respondingParty: 'Northwind Marine Pty Ltd',
      targetObject: { type: 'vessel', id: 'VESSEL-001', name: 'Pacific Sentinel' },
      existingDocuments: [existingDoc],
    });

    expect(requirements[3].documentId).toBe('DOC-EXISTING-001');
    expect(requirements[3].documentVersion).toBe('v2.1');
    expect(requirements[3].demoPreseeded).toBe(true);
    expect(requirements[3].notes).toBe('Demo pre-seeded upload');
    expect(demoDocuments).toHaveLength(0);
  });

  it('creates demo files and performs duplicate title checks for crew and equipment targets', () => {
    const existingCrewDoc: MasterDocument = {
      id: 'DOC-CREW-EXISTING',
      title: 'STCW Basic Safety Training',
      entityType: 'Crew Certificate',
      targetObjectType: 'person',
      targetObjectId: 'CREW-101',
      targetObjectName: 'Capt. James Cook',
      certificateNo: 'BST-2026',
      issuingAuthority: 'AMSA',
      expiryDate: '2028-01-01',
      ocrConfidence: 96,
      complianceState: 'Valid',
      currentVersion: 'v1.5',
      versions: [
        {
          versionLabel: 'v1.5',
          uploadedAt: '2026-10-01T00:00:00.000Z',
          uploadedBy: 'Crew Provider',
          fileSizeBytes: 420000,
          fileName: 'stcw.pdf',
          changeSummary: 'Initial',
        },
      ],
      validationRules: { charterBufferPassed: true, assetMatch100Percent: true, iacsAuthorityValid: true, overallValid: true },
      verificationStatus: 'Pending',
    };

    const crewReqs: AssuranceRequirement[] = [
      { id: 'c-1', category: 'People', title: 'DOC', isMandatory: true, isFulfilled: false, ocrConfidence: 0, verifierStatus: 'Pending' },
      { id: 'c-2', category: 'People', title: 'NDA', isMandatory: true, isFulfilled: false, ocrConfidence: 0, verifierStatus: 'Pending' },
      { id: 'c-3', category: 'People', title: 'MSA', isMandatory: true, isFulfilled: false, ocrConfidence: 0, verifierStatus: 'Pending' },
      { id: 'c-4', category: 'People', title: 'STCW Basic Safety Training', isMandatory: true, isFulfilled: false, ocrConfidence: 0, verifierStatus: 'Pending' },
      { id: 'c-5', category: 'People', title: 'Seafarer Medical Fitness Certificate (ENG1)', isMandatory: true, isFulfilled: false, ocrConfidence: 0, verifierStatus: 'Pending' },
    ];

    const { requirements: updatedCrewReqs, demoDocuments: crewDemoDocs } = attachDemoDocumentsToRequirements(crewReqs, {
      setId: 'AS-CREW-DEMO',
      respondingParty: 'Crew Provider',
      targetObject: { type: 'person', id: 'CREW-101', name: 'Capt. James Cook' },
      existingDocuments: [existingCrewDoc],
    });

    expect(updatedCrewReqs[3].documentId).toBe('DOC-CREW-EXISTING');
    expect(updatedCrewReqs[3].documentVersion).toBe('v1.5');
    expect(updatedCrewReqs[4].documentId).toBe('DOC-DEMO-AS-CREW-DEMO-5');
    expect(crewDemoDocs).toHaveLength(1);
    expect(crewDemoDocs[0].entityType).toBe('Crew Certificate');
    expect(crewDemoDocs[0].targetObjectType).toBe('person');
    expect(crewDemoDocs[0].targetObjectId).toBe('CREW-101');

    const eqReqs: AssuranceRequirement[] = [
      { id: 'e-1', category: 'Plant', title: 'DOC', isMandatory: true, isFulfilled: false, ocrConfidence: 0, verifierStatus: 'Pending' },
      { id: 'e-2', category: 'Plant', title: 'NDA', isMandatory: true, isFulfilled: false, ocrConfidence: 0, verifierStatus: 'Pending' },
      { id: 'e-3', category: 'Plant', title: 'MSA', isMandatory: true, isFulfilled: false, ocrConfidence: 0, verifierStatus: 'Pending' },
      { id: 'e-4', category: 'Plant', title: 'Offshore Pedestal Crane Annual Inspection', isMandatory: true, isFulfilled: false, ocrConfidence: 0, verifierStatus: 'Pending' },
    ];

    const { requirements: updatedEqReqs, demoDocuments: eqDemoDocs } = attachDemoDocumentsToRequirements(eqReqs, {
      setId: 'AS-EQ-DEMO',
      respondingParty: 'Equipment Provider',
      targetObject: { type: 'equipment', id: 'EQ-CRANE-01', name: 'Heavy Lift Crane #1' },
    });

    expect(updatedEqReqs[3].documentId).toBe('DOC-DEMO-AS-EQ-DEMO-4');
    expect(eqDemoDocs).toHaveLength(1);
    expect(eqDemoDocs[0].entityType).toBe('Equipment Certificate');
    expect(eqDemoDocs[0].targetObjectType).toBe('equipment');
    expect(eqDemoDocs[0].targetObjectId).toBe('EQ-CRANE-01');
  });

  it('auto-verifies only pre-seeded rows when Verification begins, leaving live uploads Pending', () => {
    const { set, documents, openTitles, preseededTitles } = buildPreseededSet(
      'tmpl-pub-ss05-control-systems',
    );

    const afterSubmit: AssuranceSet = {
      ...set,
      stage: 'Verification',
      requirements: set.requirements.map((req) =>
        openTitles.includes(req.title)
          ? {
            ...req,
            documentId: `DOC-LIVE-${req.id}`,
            documentVersion: 'v1.0',
            ocrConfidence: 90,
            verifierStatus: 'Pending' as const,
            isFulfilled: false,
          }
          : req,
      ),
    };

    const { set: verifiedSet, documents: verifiedDocs } = autoVerifyDemoPreseededRequirements(
      afterSubmit,
      documents,
    );

    expect(derivePipelineStage(verifiedSet)).toBe('Verification');
    expect(
      verifiedSet.requirements
        .filter((req) => preseededTitles.includes(req.title))
        .every((req) => req.verifierStatus === 'Verified' && req.isFulfilled),
    ).toBe(true);
    expect(
      verifiedSet.requirements
        .filter((req) => openTitles.includes(req.title))
        .every((req) => req.verifierStatus === 'Pending' && !req.demoPreseeded),
    ).toBe(true);
    expect(
      verifiedDocs
        .filter((doc) => preseededTitles.includes(doc.title))
        .every((doc) => doc.verificationStatus === 'Verified'),
    ).toBe(true);
  });

  it('flips pre-seeded uploads to Verified in the store when the last open upload enters Verification', () => {
    const { set, documents, openTitles } = buildPreseededSet('tmpl-pub-ss04-bunkering');
    useMapStore.setState({
      ...initialState,
      documents: [...initialState.documents, ...documents],
      assuranceSets: [...initialState.assuranceSets, set],
      activePersona: 'Submitter',
      activeDemoOrganization: 'Oil Company',
      activeSessionUserId: initialState.users.find(
        (user) => user.organization === 'Oil Company' && user.roles.includes('Submitter'),
      )?.id,
    });

    const openReqs = set.requirements.filter((req) => openTitles.includes(req.title));
    openReqs.forEach((req, index) => {
      useMapStore.getState().uploadDocumentForRequirement(set.id, req.id, {
        id: `DOC-LIVE-${index}`,
        title: req.title,
        entityType: 'Vessel Certificate',
        vesselId: getSetVessel(set)?.id || 'VES-DEMO',
        certificateNo: `LIVE-${index}`,
        issuingAuthority: 'Oil Company',
        expiryDate: '2027-11-15',
        ocrConfidence: 92,
        complianceState: 'Valid',
        currentVersion: 'v1.0',
        versions: [
          {
            versionLabel: 'v1.0',
            uploadedAt: '2026-11-15T00:00:00.000Z',
            uploadedBy: 'Oil Company',
            fileSizeBytes: 1000,
            fileName: 'live.pdf',
            changeSummary: 'Live demo upload',
          },
        ],
        validationRules: {
          charterBufferPassed: true,
          assetMatch100Percent: true,
          iacsAuthorityValid: true,
          overallValid: true,
        },
        verificationStatus: 'Pending',
      });
    });

    expect(useMapStore.getState().assuranceSets.find((item) => item.id === set.id)!.stage).toBe('Verification');
    /* pre-seeded uploads are marked Verified when the verifier opens the set */
    useMapStore.getState().verifyDemoPreseededUploads(set.id);
    const after = useMapStore.getState().assuranceSets.find((item) => item.id === set.id)!;
    expect(after.requirements.filter((req) => req.demoPreseeded).every((req) => req.verifierStatus === 'Verified')).toBe(
      true,
    );
    expect(
      after.requirements
        .filter((req) => openTitles.includes(req.title))
        .every((req) => req.verifierStatus === 'Pending' && Boolean(req.documentId)),
    ).toBe(true);
    expect(after.requirements.filter((req) => req.verifierStatus === 'Pending')).toHaveLength(3);
  });

  describe('filterNewDemoDocuments', () => {
    const makeDoc = (id: string, title = 'Doc'): MasterDocument => ({
      id,
      title,
      entityType: 'Vessel Certificate',
      certificateNo: `CERT-${id}`,
      issuingAuthority: 'Authority',
      expiryDate: '2027-01-01',
      ocrConfidence: 96,
      complianceState: 'Valid',
      currentVersion: 'v1.0',
      versions: [],
      validationRules: {
        charterBufferPassed: true,
        assetMatch100Percent: true,
        iacsAuthorityValid: true,
        overallValid: true,
      },
      verificationStatus: 'Pending',
    });

    it('returns only documents whose id is not in existing', () => {
      const doc1 = makeDoc('DOC-1');
      const doc2 = makeDoc('DOC-2');
      const doc3 = makeDoc('DOC-3');

      const existing = [doc1];
      const result = filterNewDemoDocuments([doc1, doc2, doc3], existing);

      expect(result.map((d) => d.id)).toEqual(['DOC-2', 'DOC-3']);
    });

    it('returns empty array for an empty list or when template has fewer than 4 requirements', () => {
      const existing = [makeDoc('DOC-1')];
      expect(filterNewDemoDocuments([], existing)).toEqual([]);
    });

    it('returns empty array when saved twice and all documents already exist', () => {
      const doc1 = makeDoc('DOC-1');
      const doc2 = makeDoc('DOC-2');
      const existing = [doc1, doc2];

      const result = filterNewDemoDocuments([doc1, doc2], existing);
      expect(result).toEqual([]);
    });
  });

  describe('rebuildMissingDemoDocuments', () => {
    const makeSet = (requirements: AssuranceRequirement[]): AssuranceSet => ({
      id: 'AS-REPAIR-01',
      title: 'Repair Test Set',
      visibility: 'organization',
      assuranceType: 'Vessel',
      scopeType: 'Vessel',
      stage: 'Approval',
      readinessScore: 80,
      mandatoryInspectionRequired: false,
      inspectionCompleted: false,
      parties: [
        { organization: 'Client Org', role: 'Requesting party' },
        { organization: 'Service Provider', role: 'Responding party' },
      ],
      assuranceObjects: [
        { id: 'VES-01', type: 'vessel', name: 'Test Vessel', ownerOrganization: 'Service Provider' },
      ],
      requirements,
      createdBy: { userId: 'USR-01', name: 'User 1', persona: 'Administrator' },
    });

    it('(a) a demoPreseeded requirement with a missing document yields one document whose id equals req.documentId and title equals req.title', () => {
      const req: AssuranceRequirement = {
        id: 'REQ-01',
        category: 'Statutory Certificate',
        title: 'Safety Equipment Certificate',
        isMandatory: true,
        isFulfilled: true,
        verifierStatus: 'Verified',
        documentId: 'DOC-DEMO-AS-REPAIR-01-4',
        demoPreseeded: true,
        ocrConfidence: 96,
      };
      const set = makeSet([req]);
      const documents: MasterDocument[] = [];

      const restored = rebuildMissingDemoDocuments(set, documents);
      expect(restored).toHaveLength(1);
      expect(restored[0].id).toBe(req.documentId);
      expect(restored[0].title).toBe(req.title);
      expect(restored[0].verificationStatus).toBe('Verified');
    });

    it('(b) a requirement with a document already in the list yields none', () => {
      const req: AssuranceRequirement = {
        id: 'REQ-01',
        category: 'Statutory Certificate',
        title: 'Safety Equipment Certificate',
        isMandatory: true,
        isFulfilled: true,
        verifierStatus: 'Verified',
        documentId: 'DOC-DEMO-AS-REPAIR-01-4',
        demoPreseeded: true,
        ocrConfidence: 96,
      };
      const set = makeSet([req]);
      const existingDoc: MasterDocument = {
        id: 'DOC-DEMO-AS-REPAIR-01-4',
        title: req.title,
        entityType: 'Vessel Certificate',
        certificateNo: 'DEMO-4',
        issuingAuthority: 'Service Provider',
        expiryDate: '2027-01-01',
        ocrConfidence: 96,
        complianceState: 'Valid',
        currentVersion: 'v1.0',
        versions: [],
        validationRules: {
          charterBufferPassed: true,
          assetMatch100Percent: true,
          iacsAuthorityValid: true,
          overallValid: true,
        },
        verificationStatus: 'Verified',
      };

      const restored = rebuildMissingDemoDocuments(set, [existingDoc]);
      expect(restored).toEqual([]);
    });

    it('(c) a non-demoPreseeded requirement with a missing documentId yields none', () => {
      const req: AssuranceRequirement = {
        id: 'REQ-VAULT-01',
        category: 'Statutory Certificate',
        title: 'Vault Missing Certificate',
        isMandatory: true,
        isFulfilled: false,
        verifierStatus: 'Pending',
        documentId: 'DOC-REAL-VAULT-999',
        demoPreseeded: undefined,
        ocrConfidence: 0,
      };
      const set = makeSet([req]);

      const restored = rebuildMissingDemoDocuments(set, []);
      expect(restored).toEqual([]);
    });
  });
});
