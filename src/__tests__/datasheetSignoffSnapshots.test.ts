/*
  file summary: store tests for datasheet snapshots captured at verification, inspection, and approval sign-off.
  responsibilities: verifies snapshot persistence in assuranceSet.datasheetSnapshots, audit trail event naming objects, and snapshot immutability on subsequent live edits.
  role in system: validates acceptance criteria for Task 5483 (Step 4).
*/

import { describe, it, expect, beforeEach } from 'vitest';
import { useMapStore } from '../store/useMapStore';
import { AssuranceSet } from '../types/assurance';
import { VesselInformation } from '../types/vessel';
import { EquipmentAsset } from '../types/equipment';
import { CrewMember } from '../types/crew';
import { MasterDocument } from '../types/document';

const testVessel: VesselInformation = {
  id: 'VES-SNAP-01',
  name: 'Seaspan Falcon',
  imoNumber: '9876543',
  flagState: 'Panama',
  vesselType: 'Tug',
  vesselSubtype: 'Escort Tug',
  classificationSociety: 'DNV',
  yearBuilt: 2020,
  registeredOwner: 'Seaspan Marine',
  lengthOverallMeters: 32.0,
  beamMeters: 12.0,
  draftMeters: 5.2,
} as unknown as VesselInformation;

const testEquipment: EquipmentAsset = {
  id: 'EQ-SNAP-01',
  name: 'Towing Winch Primary',
  equipmentIdentifier: 'TW-01',
  serialNumber: 'SN-TW-100',
  category: 'Deck Machinery',
  manufacturer: 'Markey',
  model: 'DESM-36',
  owningOrganization: 'Seaspan Marine',
  parentVesselId: 'VES-SNAP-01',
} as unknown as EquipmentAsset;

const testCrew: CrewMember = {
  id: 'CREW-SNAP-01',
  fullName: 'John Masterson',
  rank: 'Chief Engineer',
  organization: 'Seaspan Marine',
  nationality: 'Canadian',
} as unknown as CrewMember;

const testDoc: MasterDocument = {
  id: 'DOC-SNAP-01',
  title: 'Towing Winch Test Certificate',
  documentType: 'Certificate',
  category: 'Equipment Certificate',
  currentVersion: 'v1.0',
  versions: [
    {
      versionLabel: 'v1.0',
      uploadDate: '2026-11-01',
      uploadedBy: 'J. Submitter',
      fileName: 'winch-cert.pdf',
      fileSize: '1.0MB',
    },
  ],
  status: 'Pending',
  uploadDate: '2026-11-01',
  expiryDate: '2027-11-01',
  issuingAuthority: 'DNV',
  ocrConfidence: 98,
} as unknown as MasterDocument;

const testUsers = [
  {
    id: 'USR-VERIFIER',
    name: 'V. Verifier',
    roles: ['Verifier'],
    organization: 'DNV Verification Services',
    status: 'Active' as const,
  },
  {
    id: 'USR-INSPECTOR',
    name: 'I. Inspector',
    roles: ['Inspector'],
    organization: 'Bureau Veritas',
    status: 'Active' as const,
  },
  {
    id: 'USR-APPROVER',
    name: 'A. Approver',
    roles: ['Approver'],
    organization: 'Chevron Australia Pty Ltd',
    status: 'Active' as const,
  },
];

const createTestSet = (): AssuranceSet => ({
  id: 'SET-SNAP-100',
  title: 'Seaspan Escort Campaign',
  vesselId: 'VES-SNAP-01',
  vesselName: 'Seaspan Falcon',
  imoNumber: '9876543',
  stage: 'Verification',
  status: 'In Progress',
  serviceProviderOrg: 'Seaspan Marine',
  assignedSubmitter: 'M. Submitter (Seaspan Marine)',
  assignedVerifier: 'V. Verifier (DNV Verification Services)',
  assignedInspector: 'I. Inspector (Bureau Veritas)',
  assignedApprover: 'A. Approver (Chevron Australia Pty Ltd)',
  clientOrganization: 'Chevron Australia Pty Ltd',
  mandatoryInspectionRequired: true,
  inspectionCompleted: false,
  formalApprovalRequired: true,
  approverDecision: 'Pending',
  assuranceObjects: [
    {
      id: 'VES-SNAP-01',
      name: 'Seaspan Falcon',
      type: 'vessel',
      identifier: 'IMO: 9876543',
      ownerOrganization: 'Seaspan Marine',
    },
    {
      id: 'EQ-SNAP-01',
      name: 'Towing Winch Primary',
      type: 'equipment',
      identifier: 'TW-01',
      ownerOrganization: 'Seaspan Marine',
    },
    {
      id: 'CREW-SNAP-01',
      name: 'John Masterson',
      type: 'person',
      ownerOrganization: 'Seaspan Marine',
    },
  ],
  requirements: [
    {
      id: 'REQ-SNAP-1',
      title: 'Towing Winch Certificate',
      category: 'Equipment Certificate',
      subtype: 'Equipment',
      sectionId: 'sec-equipment',
      isMandatory: true,
      isFulfilled: false,
      documentId: 'DOC-SNAP-01',
      verifierStatus: 'Pending',
      targetObjectId: 'EQ-SNAP-01',
    },
  ],
  datasheetSnapshots: [],
} as unknown as AssuranceSet);

describe('Datasheet Sign-off Snapshots and Immutability', () => {
  beforeEach(() => {
    useMapStore.setState({
      vessels: [testVessel],
      equipment: [testEquipment],
      crew: [testCrew],
      documents: [testDoc],
      users: testUsers as unknown as any,
      assuranceSets: [createTestSet()],
      auditEvents: [],
      projects: [],
      notifications: [],
    });
  });

  it('verifyDocument with Verified status captures snapshots and names objects in audit log', () => {
    useMapStore.setState({
      activePersona: 'Verifier',
      activeSessionUserId: 'USR-VERIFIER',
      activeDemoOrganization: 'DNV Verification Services',
    });

    const store = useMapStore.getState();
    store.verifyDocument(
      'DOC-SNAP-01',
      'Verified',
      'All parameters conform to class rules.',
      undefined,
      'REQ-SNAP-1',
      'SET-SNAP-100',
    );

    const updatedSet = useMapStore.getState().assuranceSets.find((s) => s.id === 'SET-SNAP-100');
    expect(updatedSet).toBeDefined();
    expect(updatedSet?.datasheetSnapshots).toBeDefined();
    expect(updatedSet?.datasheetSnapshots?.length).toBeGreaterThan(0);

    const vesselSnapshot = updatedSet?.datasheetSnapshots?.find((s) => s.objectId === 'VES-SNAP-01');
    expect(vesselSnapshot).toBeDefined();
    expect(vesselSnapshot?.role).toBe('Verifier');
    expect(vesselSnapshot?.userId).toBe('USR-VERIFIER');
    expect(vesselSnapshot?.fields['classificationSociety']).toBe('DNV');

    // Audit log should name the snapshotted objects
    const auditEvents = useMapStore.getState().auditEvents;
    const verifyAudit = auditEvents.find((e) => e.action.includes('Verifier Document Action: Verified'));
    expect(verifyAudit).toBeDefined();
    expect(verifyAudit?.justificationNotes).toContain('Datasheet snapshots saved for:');
    expect(verifyAudit?.justificationNotes).toContain('Seaspan Falcon');
  });

  it('completeVesselInspection with Pass captures snapshots and names objects in audit log', () => {
    // Put set into Inspection stage
    useMapStore.setState((state) => ({
      activePersona: 'Inspector',
      activeSessionUserId: 'USR-INSPECTOR',
      activeDemoOrganization: 'Bureau Veritas',
      assuranceSets: state.assuranceSets.map((s) =>
        s.id === 'SET-SNAP-100'
          ? { ...s, stage: 'Inspection', mandatoryInspectionRequired: true, inspectionCompleted: false }
          : s,
      ),
    }));

    const store = useMapStore.getState();
    const completed = store.completeVesselInspection('Seaspan Falcon', 'Pass');
    expect(completed).toContain('SET-SNAP-100');

    const updatedSet = useMapStore.getState().assuranceSets.find((s) => s.id === 'SET-SNAP-100');
    expect(updatedSet?.inspectionCompleted).toBe(true);

    const inspectorSnapshot = updatedSet?.datasheetSnapshots?.find((s) => s.role === 'Inspector');
    expect(inspectorSnapshot).toBeDefined();
    expect(inspectorSnapshot?.userId).toBe('USR-INSPECTOR');

    const auditEvents = useMapStore.getState().auditEvents;
    const inspectAudit = auditEvents.find((e) => e.action.includes('Inspection Complete: Pass'));
    expect(inspectAudit).toBeDefined();
    expect(inspectAudit?.justificationNotes).toContain('Datasheet snapshots saved for:');
    expect(inspectAudit?.justificationNotes).toContain('Seaspan Falcon');
  });

  it('setApproverDecision with Approved captures snapshots, names objects in audit log, and editing vessel later leaves snapshot intact', () => {
    // Put set into Approval stage with fulfilled requirements
    useMapStore.setState((state) => ({
      activePersona: 'Approver',
      activeSessionUserId: 'USR-APPROVER',
      activeDemoOrganization: 'Chevron Australia Pty Ltd',
      assuranceSets: state.assuranceSets.map((s) =>
        s.id === 'SET-SNAP-100'
          ? {
              ...s,
              stage: 'Approval',
              requirements: s.requirements.map((r) => ({ ...r, verifierStatus: 'Verified', isFulfilled: true })),
            }
          : s,
      ),
    }));

    const store = useMapStore.getState();
    store.setApproverDecision('SET-SNAP-100', 'Approved', 'Approved for offshore operations.');

    const updatedSet = useMapStore.getState().assuranceSets.find((s) => s.id === 'SET-SNAP-100');
    expect(updatedSet?.approverDecision).toBe('Approved');

    const approverSnapshot = updatedSet?.datasheetSnapshots?.find((s) => s.role === 'Approver' && s.objectId === 'VES-SNAP-01');
    expect(approverSnapshot).toBeDefined();
    expect(approverSnapshot?.fields['classificationSociety']).toBe('DNV');

    // Audit log contains object names
    const auditEvents = useMapStore.getState().auditEvents;
    const approverAudit = auditEvents.find((e) => e.action.includes('Approver Final Decision: Approved'));
    expect(approverAudit).toBeDefined();
    expect(approverAudit?.justificationNotes).toContain('Datasheet snapshots saved for:');
    expect(approverAudit?.justificationNotes).toContain('Seaspan Falcon');

    // Now Administrator edits the vessel's classification society in the store
    useMapStore.setState((state) => ({
      vessels: state.vessels.map((v) =>
        v.id === 'VES-SNAP-01' ? { ...v, classificationSociety: 'ABS' } : v,
      ),
    }));

    // The live vessel now has classificationSociety 'ABS'
    const liveVessel = useMapStore.getState().vessels.find((v) => v.id === 'VES-SNAP-01');
    expect(liveVessel?.classificationSociety).toBe('ABS');

    // But the signed-off snapshot on the set remains strictly unchanged with 'DNV'
    const setAfterEdit = useMapStore.getState().assuranceSets.find((s) => s.id === 'SET-SNAP-100');
    const snapshotAfterEdit = setAfterEdit?.datasheetSnapshots?.find((s) => s.role === 'Approver' && s.objectId === 'VES-SNAP-01');
    expect(snapshotAfterEdit?.fields['classificationSociety']).toBe('DNV');
  });
});
