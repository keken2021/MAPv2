/* 
  file summary: unit tests for zustand state store actions and rbac persona switching.
  responsibilities: tests active persona updates, vessel registration duplicate protection, and document verification state transitions.
  role in system: executed during vitest unit test suite runs.
*/

import { describe, it, expect, beforeEach } from 'vitest';
import { useMapStore } from '../store/useMapStore';
import { UserRolePersona } from '../types/audit';
import { isViewAccessibleToPersona, filterDocumentsForVerifierQueue } from '../utils/rbacHelpers';
import { formatDocumentId, isValidDocumentId } from '../utils/formatters';

describe('Map Store State Management', () => {
  beforeEach(() => {
    // reset persona to Administrator before test execution
    useMapStore.getState().setActivePersona('Administrator');
  });

  it('should switch active persona and log audit trail event', () => {
    const store = useMapStore.getState();
    store.setActivePersona('C Admin');

    expect(useMapStore.getState().activePersona).toBe('C Admin');
    const latestAudit = useMapStore.getState().auditEvents[0];
    expect(latestAudit.action).toBe('Switched Active User Persona');
    expect(latestAudit.justificationNotes).toContain('C Admin');
  });

  it('should block duplicate vessel registration', () => {
    const store = useMapStore.getState();
    const existingImo = store.vessels[0].imoNumber;

    const dupVessel = {
      ...store.vessels[0],
      id: 'VESSEL-NEW',
      name: 'Duplicate Vessel',
      imoNumber: existingImo,
      officialRegNumber: 'UNIQUE-REG-99',
    };

    const result = store.addVessel(dupVessel);
    expect(result.success).toBe(false);
    expect(result.message).toContain('already registered');
  });

  it('should return vesselId on successful registration', () => {
    const store = useMapStore.getState();
    const initialCount = store.vessels.length;

    const newVessel = {
      ...store.vessels[0],
      id: 'VESSEL-UNIT-TEST',
      name: 'MV Unit Test Vessel',
      imoNumber: '9999999',
      officialRegNumber: 'UNIT-REG-001',
    };

    const result = store.addVessel(newVessel);
    expect(result.success).toBe(true);
    expect(result.vesselId).toBe('VESSEL-UNIT-TEST');
    expect(useMapStore.getState().vessels.length).toBe(initialCount + 1);
  });


  it('should update document verification status', () => {
    const store = useMapStore.getState();
    const targetDocId = store.documents[0].id;

    store.verifyDocument(targetDocId, 'Verified', 'Unit test verification check', 'Approver');

    const updatedDoc = useMapStore.getState().documents.find((d) => d.id === targetDocId);
    expect(updatedDoc?.verificationStatus).toBe('Verified');
    expect(updatedDoc?.verificationNotes).toBe('Unit test verification check');
  });

  it('should route assurance set to Inspection when all requirements verified with Inspector route', () => {
    const store = useMapStore.getState();
    const targetSet = store.assuranceSets.find((s) => s.mandatoryInspectionRequired);
    expect(targetSet).toBeDefined();
    if (!targetSet) return;

    targetSet.requirements.forEach((req) => {
      if (req.documentId) {
        store.verifyDocument(req.documentId, 'Verified', 'Verified for inspection routing test', 'Inspector');
      }
    });

    const updatedSet = useMapStore.getState().assuranceSets.find((s) => s.id === targetSet.id);
    expect(updatedSet?.stage).toBe('Inspection');
  });

  it('should link uploaded document to assurance requirement for verifier queue demo flow', () => {
    const store = useMapStore.getState();
    store.setActivePersona('Submitter');

    const targetSet = store.assuranceSets.find((s) =>
      s.requirements.some((r) => !r.documentId),
    );
    if (!targetSet) {
      const customSet = store.assuranceSets[0];
      const targetReq = customSet.requirements[0];
      const mockDoc = {
        ...store.documents[0],
        id: 'MAP-DOC-2026-STAT-00999',
        title: targetReq.title,
        verificationStatus: 'Pending' as const,
      };
      store.uploadDocumentForRequirement(customSet.id, targetReq.id, mockDoc);
      const updatedSet = useMapStore.getState().assuranceSets.find((s) => s.id === customSet.id);
      const updatedReq = updatedSet?.requirements.find((r) => r.id === targetReq.id);
      expect(updatedReq?.documentId).toBe('MAP-DOC-2026-STAT-00999');
      expect(updatedReq?.verifierStatus).toBe('Pending');
      expect(useMapStore.getState().documents.some((d) => d.id === 'MAP-DOC-2026-STAT-00999')).toBe(true);
      return;
    }

    const targetReq = targetSet.requirements.find((r) => !r.documentId)!;
    const mockDoc = {
      ...store.documents[0],
      id: 'MAP-DOC-2026-STAT-00999',
      title: targetReq.title,
      vesselId: targetSet.vesselId,
      verificationStatus: 'Pending' as const,
    };

    store.uploadDocumentForRequirement(targetSet.id, targetReq.id, mockDoc);

    const updatedSet = useMapStore.getState().assuranceSets.find((s) => s.id === targetSet.id);
    const updatedReq = updatedSet?.requirements.find((r) => r.id === targetReq.id);
    expect(updatedReq?.documentId).toBe('MAP-DOC-2026-STAT-00999');
    expect(updatedReq?.verifierStatus).toBe('Pending');

    const scoped = filterDocumentsForVerifierQueue(
      useMapStore.getState().documents,
      useMapStore.getState().assuranceSets,
      'Verifier',
    );
    expect(scoped.some((d) => d.id === 'MAP-DOC-2026-STAT-00999')).toBe(true);
  });

  it('should scope verifier queue documents to assigned assurance set requirements', () => {
    const store = useMapStore.getState();
    store.setActivePersona('Verifier');

    const scoped = filterDocumentsForVerifierQueue(
      useMapStore.getState().documents,
      useMapStore.getState().assuranceSets,
      'Verifier',
    );

    expect(scoped.length).toBeGreaterThan(0);
    scoped.forEach((doc) => {
      const inAssignedQueue = useMapStore.getState().assuranceSets.some(
        (set) =>
          set.assignedVerifier &&
          set.requirements.some((req) => req.documentId === doc.id),
      );
      expect(inAssignedQueue).toBe(true);
    });
  });

  it('should update user profile details and record audit log event', () => {
    const store = useMapStore.getState();
    const targetUser = store.users[0];

    const updatedUser = {
      ...targetUser,
      name: 'Captain Updated Name',
      roles: ['Approver'] as UserRolePersona[],
    };

    store.updateUser(updatedUser);

    const userInStore = useMapStore.getState().users.find((u) => u.id === targetUser.id);
    expect(userInStore?.name).toBe('Captain Updated Name');
    expect(userInStore?.roles).toEqual(['Approver']);

    const latestAudit = useMapStore.getState().auditEvents[0];
    expect(latestAudit.action).toBe('Updated User Profile');
    expect(latestAudit.targetAsset).toContain('Captain Updated Name');
  });

  it('should allow Administrator and C Admin access to users management view while restricting operational roles', () => {
    expect(isViewAccessibleToPersona('users', undefined, 'Administrator')).toBe(true);
    expect(isViewAccessibleToPersona('users', undefined, 'C Admin')).toBe(true);
    expect(isViewAccessibleToPersona('users', undefined, 'Submitter')).toBe(false);
    expect(isViewAccessibleToPersona('users', undefined, 'Verifier')).toBe(false);
    expect(isViewAccessibleToPersona('users', undefined, 'Inspector')).toBe(false);
    expect(isViewAccessibleToPersona('users', undefined, 'Approver')).toBe(false);
  });

  it('should add STCW Layer 1 and Layer 2 certificates to crew members and record audit log', () => {
    const store = useMapStore.getState();
    const targetCrew = store.crew[0];

    const layer1Doc = {
      id: 'MAP-CRW-2026-STCW-00901',
      title: 'ENG1 Medical Certificate',
      layer: 'Layer 1 - Universal Core' as const,
      stcwRegulation: 'STCW Reg I/9',
      certificateNo: 'ENG1-AU-99120',
      issuingAuthority: 'AMSA Medical Examiner',
      issueDate: '2026-01-01',
      expiryDate: '2028-01-01',
      verificationStatus: 'Verified' as const,
    };

    store.addCrewDocument(targetCrew.id, layer1Doc);

    let updatedCrew = useMapStore.getState().crew.find((c) => c.id === targetCrew.id);
    expect(updatedCrew?.layer1CoreDocuments.some((d) => d.id === 'MAP-CRW-2026-STCW-00901')).toBe(true);

    const layer2Doc = {
      id: 'MAP-CRW-2026-STCW-00902',
      title: 'Advanced Oil Tanker Endorsement',
      layer: 'Layer 2 - Vessel Specific & Endorsements' as const,
      stcwRegulation: 'STCW Reg V/1-1',
      certificateNo: 'TANK-AU-8871',
      issuingAuthority: 'AMSA Australia',
      issueDate: '2026-01-01',
      expiryDate: '2031-01-01',
      verificationStatus: 'Verified' as const,
    };

    store.addCrewDocument(targetCrew.id, layer2Doc);

    updatedCrew = useMapStore.getState().crew.find((c) => c.id === targetCrew.id);
    expect(updatedCrew?.layer2Endorsements.some((d) => d.id === 'MAP-CRW-2026-STCW-00902')).toBe(true);

    const latestAudit = useMapStore.getState().auditEvents[0];
    expect(latestAudit.action).toContain('Uploaded Crew STCW Document');
  });

  it('should allow Approver access to approver view, dashboard, and audit trail', () => {
    expect(isViewAccessibleToPersona('dashboard', undefined, 'Approver')).toBe(true);
    expect(isViewAccessibleToPersona('audit', undefined, 'Approver')).toBe(true);
    expect(isViewAccessibleToPersona('approver', undefined, 'Approver')).toBe(true);
    expect(isViewAccessibleToPersona('approver', undefined, 'Administrator')).toBe(true);
    expect(isViewAccessibleToPersona('approver', undefined, 'Submitter')).toBe(false);
    expect(isViewAccessibleToPersona('approver', undefined, 'C Admin')).toBe(false);
  });

  it('should certify assurance set when approver approves campaign', () => {
    const store = useMapStore.getState();
    store.setActivePersona('Approver');

    const targetSet = store.assuranceSets.find(
      (s) => s.stage === 'Approval' || s.approverDecision === 'Pending',
    ) || store.assuranceSets[0];

    const fulfilledSet = {
      ...targetSet,
      requirements: targetSet.requirements.map((r) => ({
        ...r,
        isFulfilled: true,
        verifierStatus: 'Verified' as const,
      })),
      stage: 'Approval' as const,
      approverDecision: 'Pending' as const,
    };

    useMapStore.setState({
      assuranceSets: store.assuranceSets.map((s) =>
        s.id === targetSet.id ? fulfilledSet : s,
      ),
    });

    useMapStore.getState().setApproverDecision(targetSet.id, 'Approved', 'Demo charter sign-off');

    const updated = useMapStore.getState().assuranceSets.find((s) => s.id === targetSet.id);
    expect(updated?.stage).toBe('Approved');
    expect(updated?.approverDecision).toBe('Approved');
    expect(updated?.readinessScore).toBe(100);
  });

  it('should allow C Admin (Client Admin) to access create-assurance-set view', () => {
    expect(isViewAccessibleToPersona('create-assurance-set', undefined, 'C Admin')).toBe(true);
    expect(isViewAccessibleToPersona('create-assurance-set', undefined, 'Administrator')).toBe(true);
    expect(isViewAccessibleToPersona('create-assurance-set', undefined, 'Submitter')).toBe(false);
    expect(isViewAccessibleToPersona('create-assurance-set', undefined, 'Verifier')).toBe(false);
  });

  it('should update document version, version history, linked assurance set requirements, and audit log on upload of new version', () => {
    const store = useMapStore.getState();
    const targetDoc = store.documents[0];

    store.addDocumentVersion(
      targetDoc.id,
      'v1.2',
      'Certificate_of_Class_v1.2.pdf',
      2450000,
      'Uploaded renewed Certificate of Class v1.2'
    );

    const updatedDoc = useMapStore.getState().documents.find((d) => d.id === targetDoc.id);
    expect(updatedDoc?.currentVersion).toBe('v1.2');
    expect(updatedDoc?.verificationStatus).toBe('Pending');
    expect(updatedDoc?.versions.length).toBe((targetDoc.versions?.length || 1) + 1);

    const linkedAssuranceSets = useMapStore.getState().assuranceSets.filter((s) =>
      s.requirements.some((r) => r.documentId === targetDoc.id)
    );

    linkedAssuranceSets.forEach((s) => {
      const matchingReq = s.requirements.find((r) => r.documentId === targetDoc.id);
      expect(matchingReq?.documentVersion).toBe('v1.2');
      expect(matchingReq?.verifierStatus).toBe('Pending');
    });

    const latestAudit = useMapStore.getState().auditEvents[0];
    expect(latestAudit.action).toContain('Uploaded Document Revision');
    expect(latestAudit.targetAsset).toContain(targetDoc.id);
  });

  it('should add an Other Documents requirement to assurance set when uploaded without pre-existing requirementId', () => {
    const store = useMapStore.getState();
    const targetSet = store.assuranceSets[0];
    const initialReqCount = targetSet.requirements.length;

    const adHocDoc = {
      id: 'MAP-VES-2026-STAT-00888',
      title: 'Supplemental Bunkering Audit Certificate',
      entityType: 'Vessel Certificate' as const,
      vesselId: targetSet.vesselId,
      certificateNo: 'DNV-BUNK-2026-991',
      issuingAuthority: 'DNV Classification Society',
      expiryDate: '2029-06-30',
      ocrConfidence: 98,
      complianceState: 'Valid' as const,
      currentVersion: 'v1.0',
      versions: [
        {
          versionLabel: 'v1.0',
          uploadedAt: new Date().toISOString(),
          uploadedBy: 'Ops Submitter',
          fileSizeBytes: 1800000,
          fileName: 'Supplemental_Bunkering_Audit_Certificate.pdf',
          changeSummary: 'Ad-hoc supplemental document upload.',
        },
      ],
      validationRules: {
        charterBufferPassed: true,
        assetMatch100Percent: true,
        iacsAuthorityValid: true,
        overallValid: true,
      },
      verificationStatus: 'Pending' as const,
    };

    store.uploadDocumentForRequirement(targetSet.id, undefined, adHocDoc);

    const updatedSet = useMapStore.getState().assuranceSets.find((s) => s.id === targetSet.id);
    expect(updatedSet?.requirements.length).toBe(initialReqCount + 1);

    const otherReq = updatedSet?.requirements.find((r) => r.documentId === adHocDoc.id);
    expect(otherReq).toBeDefined();
    expect(otherReq?.isOtherDocument).toBe(true);
    expect(otherReq?.title).toBe('Supplemental Bunkering Audit Certificate');
    expect(otherReq?.verifierStatus).toBe('Pending');
  });

  it('should update stakeholder role assignments (Submitter, Verifier, Inspector, Approver) and log audit events', () => {
    const store = useMapStore.getState();
    const targetSet = store.assuranceSets[0];

    // Test Submitter update
    store.updateAssuranceStakeholder(targetSet.id, 'Submitter', 'E. Ramirez (Pacific Ocean Shipping)');
    let currentSet = useMapStore.getState().assuranceSets.find((s) => s.id === targetSet.id);
    expect(currentSet?.assignedSubmitter).toBe('E. Ramirez (Pacific Ocean Shipping)');

    // Test Verifier update
    store.updateAssuranceStakeholder(targetSet.id, 'Verifier', 'S. Basin (Southern Basin Energy Pty Ltd)');
    currentSet = useMapStore.getState().assuranceSets.find((s) => s.id === targetSet.id);
    expect(currentSet?.assignedVerifier).toBe('S. Basin (Southern Basin Energy Pty Ltd)');
    expect(currentSet?.verificationRequired).toBe(true);

    // Test Inspector update
    store.updateAssuranceStakeholder(targetSet.id, 'Inspector', 'N. Technical (Meridian Marine Surveyors)');
    currentSet = useMapStore.getState().assuranceSets.find((s) => s.id === targetSet.id);
    expect(currentSet?.assignedInspector).toBe('N. Technical (Meridian Marine Surveyors)');
    expect(currentSet?.mandatoryInspectionRequired).toBe(true);

    // Test Approver update
    store.updateAssuranceStakeholder(targetSet.id, 'Approver', 'P. Nardelli (Marine Assurance Authority)');
    currentSet = useMapStore.getState().assuranceSets.find((s) => s.id === targetSet.id);
    expect(currentSet?.assignedApprover).toBe('P. Nardelli (Marine Assurance Authority)');
    expect(currentSet?.formalApprovalRequired).toBe(true);

    // Verify audit logs
    const latestAudit = useMapStore.getState().auditEvents[0];
    expect(latestAudit.action).toBe('Assigned Vessel Approver');
    expect(latestAudit.targetAsset).toContain(targetSet.id);
  });

  it('should support uploading an image during vessel registration and updating/deleting it in vessel details', () => {
    const store = useMapStore.getState();
    const customImg = 'https://images.unsplash.com/photo-custom-test-12345';

    // 1. Register new vessel with uploaded image
    const newVessel = {
      ...store.vessels[0],
      id: 'VESSEL-PHOTO-TEST',
      name: 'MV Photo Test Carrier',
      imoNumber: '9988776',
      officialRegNumber: 'PHOTO-REG-01',
      imageUrl: customImg,
    };

    const regResult = store.addVessel(newVessel);
    expect(regResult.success).toBe(true);

    const created = useMapStore.getState().vessels.find((v) => v.id === 'VESSEL-PHOTO-TEST');
    expect(created?.imageUrl).toBe(customImg);

    // 2. Update image in vessel details
    const updatedImg = 'https://images.unsplash.com/photo-custom-updated-99999';
    store.updateVessel({
      ...created!,
      imageUrl: updatedImg,
    });

    const afterUpdate = useMapStore.getState().vessels.find((v) => v.id === 'VESSEL-PHOTO-TEST');
    expect(afterUpdate?.imageUrl).toBe(updatedImg);

    // 3. Delete / Reset image
    store.updateVessel({
      ...afterUpdate!,
      imageUrl: undefined,
    });

    const afterDelete = useMapStore.getState().vessels.find((v) => v.id === 'VESSEL-PHOTO-TEST');
    expect(afterDelete?.imageUrl).toBeUndefined();
  });

  it('should support uploading and managing multiple vessel photos (gallery array)', () => {
    const store = useMapStore.getState();
    const photo1 = 'https://images.unsplash.com/photo-1';
    const photo2 = 'https://images.unsplash.com/photo-2';
    const photo3 = 'https://images.unsplash.com/photo-3';

    // 1. Register vessel with multiple photos
    const newVessel = {
      ...store.vessels[0],
      id: 'VESSEL-MULTI-PHOTO-TEST',
      name: 'MV Multi Photo Explorer',
      imoNumber: '9988775',
      officialRegNumber: 'MULTI-PHOTO-REG-01',
      imageUrl: photo1,
      photos: [photo1, photo2, photo3],
    };

    const regResult = store.addVessel(newVessel);
    expect(regResult.success).toBe(true);

    const created = useMapStore.getState().vessels.find((v) => v.id === 'VESSEL-MULTI-PHOTO-TEST');
    expect(created?.imageUrl).toBe(photo1);
    expect(created?.photos?.length).toBe(3);
    expect(created?.photos).toEqual([photo1, photo2, photo3]);

    // 2. Change primary cover photo to photo2
    store.updateVessel({
      ...created!,
      imageUrl: photo2,
    });
    const afterCoverChange = useMapStore.getState().vessels.find((v) => v.id === 'VESSEL-MULTI-PHOTO-TEST');
    expect(afterCoverChange?.imageUrl).toBe(photo2);
    expect(afterCoverChange?.photos?.length).toBe(3);

    // 3. Remove photo1 from gallery
    store.updateVessel({
      ...afterCoverChange!,
      photos: [photo2, photo3],
    });
    const afterDeletePhoto = useMapStore.getState().vessels.find((v) => v.id === 'VESSEL-MULTI-PHOTO-TEST');
    expect(afterDeletePhoto?.photos).toEqual([photo2, photo3]);
  });

  it('should strictly format and validate Document IDs to MAP-[ENTITY]-[YYYY]-[CATEGORY]-[SEQ]', () => {
    // 1. Check generated document IDs
    const id1 = formatDocumentId('VES', 2026, 'STAT', '00412');
    expect(id1).toBe('MAP-VES-2026-STAT-00412');
    expect(isValidDocumentId(id1)).toBe(true);

    const id2 = formatDocumentId('CRW', 2026, 'STCW', 101);
    expect(id2).toBe('MAP-CRW-2026-STCW-00101');
    expect(isValidDocumentId(id2)).toBe(true);

    const id3 = formatDocumentId('DOC', 2026, 'UNAS', 1);
    expect(id3).toBe('MAP-DOC-2026-UNAS-00001');
    expect(isValidDocumentId(id3)).toBe(true);

    // 2. Validate format checker
    expect(isValidDocumentId('MAP-VES-2026-STAT-00412')).toBe(true);
    expect(isValidDocumentId('MAP-CRW-2026-STCW-00101')).toBe(true);
    expect(isValidDocumentId('MAP-DOC-2026-UNAS-00001')).toBe(true);
    expect(isValidDocumentId('DOC-2026-001')).toBe(false);
    expect(isValidDocumentId('DOC-UNASSIGNED-01')).toBe(false);

    // 3. Ensure ALL documents in mockData strictly conform to MAP-[ENTITY]-[YYYY]-[CATEGORY]-[SEQ]
    const storeDocs = useMapStore.getState().documents;
    storeDocs.forEach((doc) => {
      expect(isValidDocumentId(doc.id)).toBe(true);
    });
  });
});




