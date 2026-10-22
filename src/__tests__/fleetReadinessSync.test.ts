/*
  file summary: unit test suite verifying fleet overview readiness index calculations and bi-directional vessel/assurance set data synchronization.
  responsibilities: validates that calculatevesselreadiness accurately reflects assurance set readiness scores and store actions maintain data parity.
  role in system: ensures data integrity between vessel records and linked assurance campaigns across fleet master and dashboard views.
*/

import { describe, it, expect, beforeEach } from 'vitest';
import { calculateVesselReadiness, calculateAssuranceSetReadiness } from '../utils/readinessHelpers';
import { useMapStore } from '../store/useMapStore';
import { Vessel } from '../types/vessel';
import { AssuranceSet } from '../types/assurance';

describe('fleet overview readiness index and data synchronization', () => {
  const testVessel: Vessel = {
    id: 'VESSEL-SYNC-01',
    name: 'MV Sync Pioneer',
    imoNumber: '9998881',
    officialRegNumber: 'REG-881',
    mmsiNumber: '503000881',
    callSign: 'SYNC1',
    flagState: 'Australia',
    portOfRegistry: 'Fremantle, WA',
    status: 'Port Stay',
    complianceReadinessScore: 40,
    vesselType: 'Offshore Support Vessel (OSV)',
    vesselSubtype: 'PSV',
    intendedUse: 'Platform Supply',
    tradingArea: 'Domestic',
    classificationSociety: 'DNV',
    classNotation: '+100A1 OSV',
    hullType: 'Double Hull',
    ispsSolasStatus: 'Certified',
    yearBuilt: 2022,
    shipyardBuilder: 'Damen',
    lengthOverallMeters: 80,
    beamMeters: 18,
    draftMeters: 5.5,
    grossTonnageGT: 3000,
    deadweightTonnageDWT: 4000,
    dynamicPositioningClass: 'DP2',
    mainEnginePowerKW: '2x 2000 kW',
    registeredOwner: 'Northwind Marine Pty Ltd',
    ownerType: 'Corporate Entity',
    corporateRegistryNo: 'ACN 000 000 000',
    ismCompany: 'Northwind Marine Pty Ltd',
    technicalManager: 'Northwind Marine Pty Ltd',
    docNumber: 'DOC-001',
    contact247: '+61 8 0000 0000',
    statutoryCertificates: [],
    hmInsurer: 'Gard',
    piClubName: 'Gard',
    policyNumber: 'POL-01',
    policyExpiryDate: '2027-01-01',
    safeManningComplement: 10,
    certifiedOfficersRatings: '4 Officers / 6 Ratings',
    masterName: 'Capt. Tester',
    lifeboatCapacity: 20,
    fuelType: 'MGO',
    lowSulphurCompliant: true,
    bwtsSpec: 'Alfa Laval',
    owCalibrationDate: '2026-01-01',
    masterCertificateUploadCount: 5,
    clientHistory: [],
  };

  const testAssuranceSet: AssuranceSet = {
    id: 'AS-SYNC-01',
    title: 'Sync Campaign Vetting',
    vesselId: 'VESSEL-SYNC-01',
    vesselName: 'MV Sync Pioneer',
    imoNumber: '9998881',
    initiatorOrg: 'Chevron Australia',
    initiatorRole: 'C Admin · Client Created',
    charterWindowStart: '2026-10-01',
    complianceDeadline: '2026-10-01',
    charterWindowEnd: '2027-10-01',
    stage: 'Validation',
    readinessScore: 40,
    mandatoryInspectionRequired: false,
    inspectionCompleted: false,
    assignedSubmitter: 'Tester',
    assignedVerifier: 'Verifier',
    assignedApprover: 'Approver',
    requirements: [
      {
        id: 'REQ-1',
        category: 'Statutory Certificate',
        title: 'Class Certificate',
        isMandatory: true,
        isFulfilled: false,
        verifierStatus: 'Pending',
        ocrConfidence: 95,
        documentId: 'DOC-1',
        linkedDocumentId: '',
      },
    ],
    stakeholders: undefined,
    assignedStakeholders: undefined,
    createdByPersona: '',
  };

  it('calculates vessel readiness accurately matching the linked assurance set score', () => {
    const setReadiness = calculateAssuranceSetReadiness(testAssuranceSet);
    const vesselReadiness = calculateVesselReadiness(testVessel, [testAssuranceSet], []);

    expect(setReadiness).toBe(40);
    expect(vesselReadiness).toBe(40);
  });

  it('updates vessel readiness to 100% when the assurance set is approved', () => {
    const approvedSet: AssuranceSet = {
      ...testAssuranceSet,
      stage: 'Approved',
      readinessScore: 100,
    };

    const setReadiness = calculateAssuranceSetReadiness(approvedSet);
    const vesselReadiness = calculateVesselReadiness(testVessel, [approvedSet], []);

    expect(setReadiness).toBe(100);
    expect(vesselReadiness).toBe(100);
  });

  it('synchronizes vessel name and imo across linked assurance sets when vessel is updated', () => {
    const store = useMapStore.getState();
    const initialVessel = store.vessels[0];
    expect(initialVessel).toBeDefined();

    const newName = 'MV Pacific Endeavour Renovated';
    const newImo = '9123499';

    store.updateVessel({
      ...initialVessel,
      name: newName,
      imoNumber: newImo,
    });

    const updatedStore = useMapStore.getState();
    const linkedSet = updatedStore.assuranceSets.find((s) => s.vesselId === initialVessel.id);

    if (linkedSet) {
      expect(linkedSet.vesselName).toBe(newName);
      expect(linkedSet.imoNumber).toBe(newImo);
    }
  });

  it('recalculates assurance set readiness score when stage is updated', () => {
    const store = useMapStore.getState();
    const targetSet = store.assuranceSets[0];
    expect(targetSet).toBeDefined();

    store.updateAssuranceStage(targetSet.id, 'Approved');

    const updatedStore = useMapStore.getState();
    const updatedSet = updatedStore.assuranceSets.find((s) => s.id === targetSet.id);

    expect(updatedSet?.stage).toBe('Approved');
    expect(updatedSet?.readinessScore).toBe(100);
  });
});
