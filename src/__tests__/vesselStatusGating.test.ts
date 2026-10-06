/*
  file summary: unit test suite verifying vessel registration status gating rules based on assurance set readiness and approval state.
  responsibilities: tests isvesselassuranceapproved and isvesselstatuspermitted helper routines across multiple scenarios.
  role in system: validates compliance enforcement preventing vessels from holding 'under charter', 'in operations', or 'in transit' without 100% approved assurance.
*/

import { describe, it, expect } from 'vitest';
import { isVesselAssuranceApproved, isVesselStatusPermitted } from '../utils/readinessHelpers';
import { getVesselStatusBadgeClass } from '../utils/formatters';
import { Vessel } from '../types/vessel';
import { AssuranceSet } from '../types/assurance';
import { MasterDocument } from '../types/document';

describe('vessel status assurance gating', () => {
  /* mock vessel template for testing */
  const mockVessel: Vessel = {
    id: 'VESSEL-TEST-01',
    name: 'MV Ocean Test',
    imoNumber: '9999991',
    officialRegNumber: 'REG-991',
    mmsiNumber: '503000001',
    callSign: 'TEST1',
    flagState: 'Australia',
    portOfRegistry: 'Fremantle, WA',
    status: 'Port Stay',
    complianceReadinessScore: 50,
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

  const emptyDocs: MasterDocument[] = [];

  it('permits non-operational statuses (port stay, dry docking, lay-up) when assurance is not approved', () => {
    const assuranceSets: AssuranceSet[] = [];

    expect(isVesselStatusPermitted('Port Stay', mockVessel, assuranceSets, emptyDocs).isPermitted).toBe(true);
    expect(isVesselStatusPermitted('Dry Docking', mockVessel, assuranceSets, emptyDocs).isPermitted).toBe(true);
    expect(isVesselStatusPermitted('Lay-up', mockVessel, assuranceSets, emptyDocs).isPermitted).toBe(true);
  });

  it('rejects in transit, under charter and in operations when vessel has no assurance sets', () => {
    const assuranceSets: AssuranceSet[] = [];

    expect(isVesselAssuranceApproved(mockVessel, assuranceSets, emptyDocs)).toBe(false);
    expect(isVesselStatusPermitted('In Transit', mockVessel, assuranceSets, emptyDocs).isPermitted).toBe(false);
    expect(isVesselStatusPermitted('Under Charter', mockVessel, assuranceSets, emptyDocs).isPermitted).toBe(false);
    expect(isVesselStatusPermitted('In Operations', mockVessel, assuranceSets, emptyDocs).isPermitted).toBe(false);
  });

  it('rejects in transit, under charter and in operations when assurance set is in draft or validation stage (<100% ready)', () => {
    const unapprovedSet: AssuranceSet = {
      id: 'AS-TEST-01',
      title: 'In-Progress Assurance',
      vesselId: mockVessel.id,
      vesselName: mockVessel.name,
      imoNumber: mockVessel.imoNumber,
      initiatorOrg: 'Test Org',
      initiatorRole: 'C Admin · Client Created',
      charterWindowStart: '2026-10-01',
      charterWindowEnd: '2027-10-01',
      stage: 'Validation',
      readinessScore: 40,
      mandatoryInspectionRequired: false,
      inspectionCompleted: false,
      assignedSubmitter: 'Tester',
      assignedVerifier: 'Verifier',
      assignedApprover: 'Approver',
      requirements: [],
      stakeholders: undefined,
      assignedStakeholders: undefined,
      createdByPersona: ''
    };

    expect(isVesselAssuranceApproved(mockVessel, [unapprovedSet], emptyDocs)).toBe(false);
    expect(isVesselStatusPermitted('In Transit', mockVessel, [unapprovedSet], emptyDocs).isPermitted).toBe(false);
    expect(isVesselStatusPermitted('Under Charter', mockVessel, [unapprovedSet], emptyDocs).isPermitted).toBe(false);
    expect(isVesselStatusPermitted('In Operations', mockVessel, [unapprovedSet], emptyDocs).isPermitted).toBe(false);
  });

  it('permits in transit, under charter and in operations when assurance set is in approved stage', () => {
    const approvedSet: AssuranceSet = {
      id: 'AS-TEST-02',
      title: 'Approved Assurance Campaign',
      vesselId: mockVessel.id,
      vesselName: mockVessel.name,
      imoNumber: mockVessel.imoNumber,
      initiatorOrg: 'Woodside Energy Ltd',
      initiatorRole: 'C Admin · Client Created',
      charterWindowStart: '2026-10-01',
      charterWindowEnd: '2027-10-01',
      stage: 'Approved',
      readinessScore: 100,
      mandatoryInspectionRequired: false,
      inspectionCompleted: true,
      assignedSubmitter: 'Tester',
      assignedVerifier: 'Verifier',
      assignedApprover: 'Approver',
      requirements: [],
      stakeholders: undefined,
      assignedStakeholders: undefined,
      createdByPersona: ''
    };

    expect(isVesselAssuranceApproved(mockVessel, [approvedSet], emptyDocs)).toBe(true);
    expect(isVesselStatusPermitted('In Transit', mockVessel, [approvedSet], emptyDocs).isPermitted).toBe(true);
    expect(isVesselStatusPermitted('Under Charter', mockVessel, [approvedSet], emptyDocs).isPermitted).toBe(true);
    expect(isVesselStatusPermitted('In Operations', mockVessel, [approvedSet], emptyDocs).isPermitted).toBe(true);
  });

  it('permits in transit, under charter and in operations when assurance set readiness score is 100%', () => {
    const readySet: AssuranceSet = {
      id: 'AS-TEST-03',
      title: '100% Ready Assurance Campaign',
      vesselId: mockVessel.id,
      vesselName: mockVessel.name,
      imoNumber: mockVessel.imoNumber,
      initiatorOrg: 'Woodside Energy Ltd',
      initiatorRole: 'C Admin · Client Created',
      charterWindowStart: '2026-10-01',
      charterWindowEnd: '2027-10-01',
      stage: 'Approval',
      readinessScore: 100,
      mandatoryInspectionRequired: false,
      inspectionCompleted: true,
      assignedSubmitter: 'Tester',
      assignedVerifier: 'Verifier',
      assignedApprover: 'Approver',
      requirements: [],
      stakeholders: undefined,
      assignedStakeholders: undefined,
      createdByPersona: ''
    };

    expect(isVesselAssuranceApproved(mockVessel, [readySet], emptyDocs)).toBe(true);
    expect(isVesselStatusPermitted('In Transit', mockVessel, [readySet], emptyDocs).isPermitted).toBe(true);
    expect(isVesselStatusPermitted('Under Charter', mockVessel, [readySet], emptyDocs).isPermitted).toBe(true);
    expect(isVesselStatusPermitted('In Operations', mockVessel, [readySet], emptyDocs).isPermitted).toBe(true);
  });

  it('maps vessel statuses to correct color badge classes (green, yellow, blue, red, grey)', () => {
    // In Operations / Active -> Green
    expect(getVesselStatusBadgeClass('In Operations')).toBe('bg-success text-white');
    expect(getVesselStatusBadgeClass('Active')).toBe('bg-success text-white');

    // In Transit -> Yellow
    expect(getVesselStatusBadgeClass('In Transit')).toBe('bg-warning text-dark');

    // Port Stay -> Blue
    expect(getVesselStatusBadgeClass('Port Stay')).toBe('bg-primary text-white');

    // Under Charter -> Red
    expect(getVesselStatusBadgeClass('Under Charter')).toBe('bg-danger text-white');

    // Dry Docking / Lay-up -> Grey
    expect(getVesselStatusBadgeClass('Dry Docking')).toBe('bg-secondary text-white');
    expect(getVesselStatusBadgeClass('Lay-up')).toBe('bg-secondary text-white');
  });
});
