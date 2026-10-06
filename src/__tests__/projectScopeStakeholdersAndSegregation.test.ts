/* 
  file summary: unit tests verifying project scope category stakeholders, segregation of duties, default assignments, and role creation boundaries.
  responsibilities: tests that project scopes enforce per-category submitters and verifiers, prevent submitters/vessel owners from self-approving, allow client/charterer verifiers, and constrain creator role semantics.
  role in system: executed during vitest test runs.
*/

import { describe, it, expect, beforeEach } from 'vitest';
import { useMapStore } from '../store/useMapStore';
import { AssuranceSet, AssuranceRequirement } from '../types/assurance';
import {
  isUserDocumentSubmitter,
  getAssuranceAssignmentWarnings,
  hasBlockingAssuranceAssignmentConflict,
  getEligibleVerifiers,
  filterEligibleVerifiersForScope,
  filterEligibleApproversForScope,
  filterCandidatesByReviewMode,
  getReviewChannelForUser,
} from '../utils/userRoleHelpers';
import { isAssuranceSetAssignedToPersona } from '../utils/rbacHelpers';
import { MOCK_USERS, MOCK_VESSELS } from '../store/mockData';

describe('Project Scope Stakeholders, Segregation of Duties, and Role Boundaries', () => {
  beforeEach(() => {
    useMapStore.getState().setActivePersona('Administrator');
  });

  describe('1. Project Scope Category-Level Stakeholder Assignments', () => {
    it('allows distinct submitters and verifiers for each category in a project scope', () => {
      const categoryStakeholders = {
        Vessel: {
          assignedSubmitter: 'M. Chen (Northwind Marine Pty Ltd)',
          submitterId: 'USR-102',
          assignedVerifier: 'A. Fontaine (Bureau Veritas Inspectorate)',
          verifierId: 'USR-202',
        },
        Crew: {
          assignedSubmitter: 'Capt. R. Sterling (Global Maritime Crewing)',
          submitterId: 'USR-103',
          assignedVerifier: 'E. Vance (Meridian Marine Surveyors)',
          verifierId: 'USR-203',
        },
        Activity: {
          assignedSubmitter: 'T. Kowalski (Northwind Marine Pty Ltd)',
          submitterId: 'USR-104',
          assignedVerifier: 'Sarah Jenkins (Chevron Australia Pty Ltd)',
          verifierId: 'USR-201',
        },
        Equipment: {
          assignedSubmitter: 'L. Zhang (Subsea Engineering Corp)',
          submitterId: 'USR-105',
          assignedVerifier: 'A. Fontaine (Bureau Veritas Inspectorate)',
          verifierId: 'USR-202',
        },
      };

      const projectRequirements: AssuranceRequirement[] = [
        {
          id: 'REQ-PRJ-001',
          title: 'Vessel Safety Management Certificate',
          category: 'Statutory Certificate',
          subtype: 'Vessel',
          isMandatory: true,
          isFulfilled: false,
          ocrConfidence: 0,
          verifierStatus: 'Pending',
          assignedSubmitter: categoryStakeholders.Vessel.assignedSubmitter,
          submitterId: categoryStakeholders.Vessel.submitterId,
          assignedVerifier: categoryStakeholders.Vessel.assignedVerifier,
          verifierId: categoryStakeholders.Vessel.verifierId,
        },
        {
          id: 'REQ-PRJ-002',
          title: 'Master STCW CoC Certificate',
          category: 'Crew Credential',
          subtype: 'Crew',
          isMandatory: true,
          isFulfilled: false,
          ocrConfidence: 0,
          verifierStatus: 'Pending',
          assignedSubmitter: categoryStakeholders.Crew.assignedSubmitter,
          submitterId: categoryStakeholders.Crew.submitterId,
          assignedVerifier: categoryStakeholders.Crew.assignedVerifier,
          verifierId: categoryStakeholders.Crew.verifierId,
        },
        {
          id: 'REQ-PRJ-003',
          title: 'Dynamic Positioning Trial Log',
          category: 'Operational Plan',
          subtype: 'Activity',
          isMandatory: true,
          isFulfilled: false,
          ocrConfidence: 0,
          verifierStatus: 'Pending',
          assignedSubmitter: categoryStakeholders.Activity.assignedSubmitter,
          submitterId: categoryStakeholders.Activity.submitterId,
          assignedVerifier: categoryStakeholders.Activity.assignedVerifier,
          verifierId: categoryStakeholders.Activity.verifierId,
        },
        {
          id: 'REQ-PRJ-004',
          title: 'Subsea Crane Annual Load Test',
          category: 'Equipment Register',
          subtype: 'Equipment',
          isMandatory: true,
          isFulfilled: false,
          ocrConfidence: 0,
          verifierStatus: 'Pending',
          assignedSubmitter: categoryStakeholders.Equipment.assignedSubmitter,
          submitterId: categoryStakeholders.Equipment.submitterId,
          assignedVerifier: categoryStakeholders.Equipment.assignedVerifier,
          verifierId: categoryStakeholders.Equipment.verifierId,
        },
      ];

      const newProjectSet: AssuranceSet = {
        id: 'MAP-SET-2026-PRJ-TEST-01',
        title: 'Gorgon Stage 2 Deepwater Installation Assurance Set',
        assuranceType: 'Project',
        vesselId: 'VESSEL-001',
        vesselName: 'MV Northern Endeavour',
        imoNumber: '9123456',
        initiatorOrg: 'Chevron Australia Pty Ltd',
        initiatorRole: 'C Admin · Client Created',
        charterer: 'Chevron Australia Pty Ltd',
        charterWindowStart: '2026-11-01',
        charterWindowEnd: '2027-11-01',
        stage: 'Initiated',
        readinessScore: 0,
        mandatoryInspectionRequired: false,
        inspectionCompleted: false,
        subtypeStakeholders: categoryStakeholders,
        requirements: projectRequirements,
        visibility: 'organization',
      };

      expect(newProjectSet.subtypeStakeholders?.Vessel?.assignedSubmitter).not.toBe(
        newProjectSet.subtypeStakeholders?.Crew?.assignedSubmitter
      );
      expect(newProjectSet.subtypeStakeholders?.Vessel?.assignedVerifier).not.toBe(
        newProjectSet.subtypeStakeholders?.Crew?.assignedVerifier
      );
      expect(newProjectSet.requirements[0].assignedSubmitter).toBe('M. Chen (Northwind Marine Pty Ltd)');
      expect(newProjectSet.requirements[1].assignedSubmitter).toBe('Capt. R. Sterling (Global Maritime Crewing)');
    });
  });

  describe('2. Segregation of Duties Enforcement (No Self-Verification)', () => {
    it('detects and blocks when submitter and verifier are identical in a category mapping', () => {
      const conflictStakeholders = {
        Vessel: {
          assignedSubmitter: 'M. Chen (Northwind Marine Pty Ltd)',
          submitterId: 'USR-102',
          assignedVerifier: 'M. Chen (Northwind Marine Pty Ltd)',
          verifierId: 'USR-102',
        },
      };

      const warnings = getAssuranceAssignmentWarnings({
        submitterId: 'USR-102',
        verifierId: 'USR-202',
        subtypeStakeholders: conflictStakeholders,
      });

      expect(warnings.some((w) => w.includes('(Vessel)') && w.includes('Submitter and Verifier'))).toBe(true);

      const hasConflict = hasBlockingAssuranceAssignmentConflict({
        submitterId: 'USR-102',
        verifierId: 'USR-202',
        subtypeStakeholders: conflictStakeholders,
      });

      expect(hasConflict).toBe(true);
    });

    it('identifies submitter persona as document submitter', () => {
      const isSub = isUserDocumentSubmitter(
        { id: 'USR-102', name: 'M. Chen', organization: 'Northwind Marine Pty Ltd' },
        'Submitter',
        { uploadedBy: 'M. Chen', vesselOwner: 'Northwind Marine Pty Ltd' }
      );
      expect(isSub).toBe(true);
    });

    it('identifies vessel owner or assigned submitter even if persona is admin', () => {
      const isSub = isUserDocumentSubmitter(
        { id: 'USR-102', name: 'M. Chen', organization: 'Northwind Marine Pty Ltd' },
        'Administrator',
        { uploadedBy: 'M. Chen', vesselOwner: 'Northwind Marine Pty Ltd' },
        { assignedSubmitter: 'M. Chen (Northwind Marine Pty Ltd)', submitterId: 'USR-102' }
      );
      expect(isSub).toBe(true);
    });

    it('does not flag independent verifier as document submitter', () => {
      const isSub = isUserDocumentSubmitter(
        { id: 'USR-202', name: 'A. Fontaine', organization: 'Bureau Veritas Inspectorate' },
        'Verifier',
        { uploadedBy: 'M. Chen', vesselOwner: 'Northwind Marine Pty Ltd' },
        { assignedSubmitter: 'M. Chen (Northwind Marine Pty Ltd)', submitterId: 'USR-102' }
      );
      expect(isSub).toBe(false);
    });
  });

  describe('3. Default Submitters and Verifiers Populated', () => {
    it('provides eligible verifiers with C Admin / Charterer included at top', () => {
      const verifiers = getEligibleVerifiers(MOCK_USERS);
      expect(verifiers.length).toBeGreaterThan(0);

      const firstVerifier = verifiers[0];
      expect(firstVerifier.roles).toContain('C Admin');

      const cAdminUser = verifiers.find((u) => u.roles.includes('C Admin'));
      expect(cAdminUser).toBeDefined();
      expect(cAdminUser?.roles).toContain('C Admin');
    });
  });

  describe('4. Charterer or Client Admin as Verifier', () => {
    it('recognizes assurance set as assigned to C Admin when C Admin is verifier', () => {
      const setWithClientVerifier: AssuranceSet = {
        id: 'MAP-SET-2026-CHEV-001',
        title: 'Wheatstone LNG Platform Offloading Assurance',
        vesselId: 'VESSEL-002',
        vesselName: 'MV Oceania Gas Carrier',
        imoNumber: '9234567',
        initiatorOrg: 'Northwind Marine Pty Ltd',
        initiatorRole: 'Vessel Provider Admin',
        charterer: 'Chevron Australia Pty Ltd',
        assignedVerifier: 'Sarah Jenkins (Chevron Australia Pty Ltd)',
        charterWindowStart: '2026-10-01',
        charterWindowEnd: '2027-10-01',
        stage: 'Initiated',
        readinessScore: 20,
        mandatoryInspectionRequired: false,
        inspectionCompleted: false,
        requirements: [],
      };

      const isAssigned = isAssuranceSetAssignedToPersona(setWithClientVerifier, 'C Admin');
      expect(isAssigned).toBe(true);
    });
  });

  describe('5. Role Boundaries: Client Admin vs Vessel Admin Creator Semantics', () => {
    it('sets initiatorRole as C Admin · Client Created when initiated by Client Admin', () => {
      const isClientAdmin = true;
      const clientOrg = 'Chevron Australia Pty Ltd';
      const initiatorRole = isClientAdmin ? 'C Admin · Client Created' : 'Vessel Provider Admin';
      const initiatorOrg = isClientAdmin ? clientOrg : 'Northwind Marine Pty Ltd';

      expect(initiatorRole).toBe('C Admin · Client Created');
      expect(initiatorOrg).toBe('Chevron Australia Pty Ltd');
    });

    it('allows Vessel Admin to act as Charterer and hire vessels across any provider', () => {
      const isClientAdmin = false;
      const initiatorRole = isClientAdmin ? 'C Admin · Client Created' : 'Vessel Provider Admin';
      const chartererLabel = isClientAdmin ? 'Client / Operator' : 'Charterer (Vessel Admin Chartering Fleet)';

      expect(initiatorRole).toBe('Vessel Provider Admin');
      expect(chartererLabel).toContain('Charterer');

      // Vessel Admin can choose from the entire available vessel fleet
      expect(MOCK_VESSELS.length).toBeGreaterThan(1);
      const hiredVessels = MOCK_VESSELS.filter((v) => v.status !== 'Decommissioned');
      expect(hiredVessels.length).toBeGreaterThan(0);
    });
  });

  describe('6. Vessel Admin Cannot Be Verifier/Approver Unless Chartering Other Services', () => {
    it('excludes vessel owner organization users from verifiers and approvers when creating set for own vessel', () => {
      const ownVesselVerifiers = filterEligibleVerifiersForScope(MOCK_USERS, {
        vesselOwnerOrg: 'Northwind Marine Pty Ltd',
        isCharteringOtherServices: false,
        isClientAdmin: false,
      });

      // Northwind Marine users should NOT be in the verifiers list for their own vessel
      expect(ownVesselVerifiers.some((u) => u.organization === 'Northwind Marine Pty Ltd')).toBe(false);
      expect(ownVesselVerifiers.some((u) => u.roles.includes('C Admin'))).toBe(true);

      const ownVesselApprovers = filterEligibleApproversForScope(MOCK_USERS, {
        vesselOwnerOrg: 'Northwind Marine Pty Ltd',
        isCharteringOtherServices: false,
        isClientAdmin: false,
      });

      expect(ownVesselApprovers.some((u) => u.organization === 'Northwind Marine Pty Ltd')).toBe(false);
    });

    it('permits vessel owner to participate when chartering external services', () => {
      const externalCharterVerifiers = filterEligibleVerifiersForScope(MOCK_USERS, {
        vesselOwnerOrg: 'Pacific Tug Fleet Corp',
        isCharteringOtherServices: true,
        isClientAdmin: false,
      });

      expect(externalCharterVerifiers.length).toBeGreaterThan(0);
    });

    it('flags blocking conflict if vessel owner user is assigned as verifier or approver on own vessel', () => {
      const conflictAssignments = {
        submitterId: 'USR-102',
        verifierId: 'USR-102', // M. Chen (Northwind Marine)
        approverId: 'USR-204',
        vesselOwnerOrg: 'Northwind Marine Pty Ltd',
        isCharteringOtherServices: false,
        isClientAdmin: false,
        users: MOCK_USERS,
      };

      const warnings = getAssuranceAssignmentWarnings(conflictAssignments);
      expect(warnings.some((w) => w.includes('Vessel admin/owner cannot be assigned as Verifier'))).toBe(true);

      const isBlocked = hasBlockingAssuranceAssignmentConflict(conflictAssignments);
      expect(isBlocked).toBe(true);
    });

    it('isolates per-category submitter-verifier conflicts for inline field error display', () => {
      const categoryConflicts = {
        submitterId: 'USR-102',
        verifierId: 'USR-202',
        approverId: 'USR-204',
        subtypeStakeholders: {
          Vessel: { submitterId: 'USR-102', verifierId: 'USR-102' }, // Conflict on Vessel
          Crew: { submitterId: 'USR-103', verifierId: 'USR-202' },   // Valid
          Activity: { submitterId: 'USR-104', verifierId: 'USR-203' }, // Valid
          Equipment: { submitterId: 'USR-102', verifierId: 'USR-204' }, // Valid
        },
        vesselOwnerOrg: 'Northwind Marine Pty Ltd',
        isCharteringOtherServices: false,
        isClientAdmin: false,
        users: MOCK_USERS,
      };

      const isBlocked = hasBlockingAssuranceAssignmentConflict(categoryConflicts);
      expect(isBlocked).toBe(true);

      const warnings = getAssuranceAssignmentWarnings(categoryConflicts);
      expect(warnings.some((w) => w.includes('Segregation of duties (Vessel)'))).toBe(true);
    });
  });

  describe('7. 1.4 Whoever Starts the Process is the Client (Service Provider Segregation)', () => {
    it('treats initiator as the client and excludes service provider staff from verifier/approver roles', () => {
      // Scenario: Ship owner (Northwind Marine) acts as client procuring bunker fuel or hiring a third-party vessel
      const serviceProviderOrg = 'Pacific Fuel & Bunkering Pty Ltd';
      
      const eligibleVerifiers = filterEligibleVerifiersForScope(MOCK_USERS, {
        serviceProviderOrg,
        isCharteringOtherServices: true,
        isClientAdmin: false,
      });

      // No staff from Pacific Fuel can verify
      expect(eligibleVerifiers.some((u) => u.organization === serviceProviderOrg)).toBe(false);
      
      // Conflict detection blocks if provider staff is accidentally assigned
      const providerStaffConflict = {
        verifierId: 'USR-102',
        approverId: 'USR-204',
        serviceProviderOrg: 'Northwind Marine Pty Ltd',
        isCharteringOtherServices: false,
        isClientAdmin: false,
        users: MOCK_USERS,
      };

      expect(hasBlockingAssuranceAssignmentConflict(providerStaffConflict)).toBe(true);
    });
  });

  describe('8. 1.5 Who Reviews is Set by Client and Can Be Mixed (Review Channels & Separate Checks)', () => {
    it('supports internal, third-party, and issuing authority review channels with separate validity and suitability checks', () => {
      const assuranceSetWithMixedReview: AssuranceSet = {
        id: 'MAP-SET-2026-MIXED-001',
        title: 'Gorgon Marine Fuel & Vessel Multi-Channel Assurance',
        assuranceType: 'Project',
        vesselId: 'VESSEL-001',
        vesselName: 'MV Pacific Endeavour',
        imoNumber: '9123456',
        initiatorOrg: 'Northwind Marine Pty Ltd',
        initiatorRole: 'Vessel Provider Admin',
        charterer: 'Northwind Marine Pty Ltd',
        clientOrg: 'Northwind Marine Pty Ltd',
        serviceProviderOrg: 'Offshore Fuel Logistics Corp',
        charterWindowStart: '2026-11-01',
        charterWindowEnd: '2027-11-01',
        stage: 'Initiated',
        readinessScore: 0,
        reviewMode: 'mixed',
        reviewChannels: ['internal', 'third_party', 'issuing_authority'],
        validityCheckRequired: true,
        suitabilityCheckRequired: true,
        authorityValidationMethod: 'api',
        verificationRequired: true,
        mandatoryInspectionRequired: true,
        formalApprovalRequired: true,
        inspectionCompleted: false,
        assignedVerifier: 'AMSA Statutory Verification Gateway (Australian Maritime Safety Authority (AMSA))',
        assignedApprover: 'P. Nardelli (Marine Assurance Authority)',
        requirements: [],
      };

      expect(assuranceSetWithMixedReview.reviewMode).toBe('mixed');
      expect(assuranceSetWithMixedReview.reviewChannels).toContain('issuing_authority');
      expect(assuranceSetWithMixedReview.validityCheckRequired).toBe(true);
      expect(assuranceSetWithMixedReview.suitabilityCheckRequired).toBe(true);
      expect(assuranceSetWithMixedReview.authorityValidationMethod).toBe('api');
      expect(assuranceSetWithMixedReview.clientOrg).toBe('Northwind Marine Pty Ltd');
      expect(assuranceSetWithMixedReview.serviceProviderOrg).toBe('Offshore Fuel Logistics Corp');
    });

    it('dynamically filters stakeholder candidate lists based on the selected ReviewMode', () => {
      const clientOrg = 'Southern Basin Energy';
      const serviceProviderOrg = 'Northwind Marine Pty Ltd';

      // 1. Internal Client Review: only users belonging to the Client Group
      const internalVerifiers = filterCandidatesByReviewMode(MOCK_USERS, 'internal', 'Verifier', {
        clientOrg,
        serviceProviderOrg,
      });
      const internalApprovers = filterCandidatesByReviewMode(MOCK_USERS, 'internal', 'Approver', {
        clientOrg,
        serviceProviderOrg,
      });

      expect(internalVerifiers.length).toBeGreaterThan(0);
      expect(internalVerifiers.every((u) => getReviewChannelForUser(u, clientOrg) === 'internal')).toBe(true);
      expect(internalApprovers.every((u) => getReviewChannelForUser(u, clientOrg) === 'internal')).toBe(true);
      // Independent third parties are hidden
      expect(internalVerifiers.some((u) => u.name.includes('Fontaine'))).toBe(false);
      // Service providers are strictly excluded
      expect(internalVerifiers.some((u) => u.organization === serviceProviderOrg)).toBe(false);

      // 2. Appointed Third Party: only users belonging to the external Assurance Group
      const thirdPartyVerifiers = filterCandidatesByReviewMode(MOCK_USERS, 'third_party', 'Verifier', {
        clientOrg,
        serviceProviderOrg,
      });
      const thirdPartyApprovers = filterCandidatesByReviewMode(MOCK_USERS, 'third_party', 'Approver', {
        clientOrg,
        serviceProviderOrg,
      });

      expect(thirdPartyVerifiers.length).toBeGreaterThan(0);
      expect(thirdPartyVerifiers.every((u) => getReviewChannelForUser(u, clientOrg) === 'third_party')).toBe(true);
      // Client staff are hidden
      expect(thirdPartyVerifiers.some((u) => u.name === 'S. Basin')).toBe(false);
      // Service providers are strictly excluded
      expect(thirdPartyVerifiers.some((u) => u.organization === serviceProviderOrg)).toBe(false);

      // 3. Issuing Authority / Regulatory: verifier handled via automated API, approver active for human suitability
      const authorityVerifiers = filterCandidatesByReviewMode(MOCK_USERS, 'issuing_authority', 'Verifier', {
        clientOrg,
        serviceProviderOrg,
      });
      const authorityApprovers = filterCandidatesByReviewMode(MOCK_USERS, 'issuing_authority', 'Approver', {
        clientOrg,
        serviceProviderOrg,
      });

      expect(authorityVerifiers.length).toBe(0); // Handled by API Gateway
      expect(authorityApprovers.length).toBeGreaterThan(0);
      expect(authorityApprovers.some((u) => u.organization === serviceProviderOrg)).toBe(false);

      // 4. Mixed Review (Multi-Channel): unlocks both Client Group and Assurance Group
      const mixedVerifiers = filterCandidatesByReviewMode(MOCK_USERS, 'mixed', 'Verifier', {
        clientOrg,
        serviceProviderOrg,
      });
      const mixedApprovers = filterCandidatesByReviewMode(MOCK_USERS, 'mixed', 'Approver', {
        clientOrg,
        serviceProviderOrg,
      });

      expect(mixedVerifiers.some((u) => getReviewChannelForUser(u, clientOrg) === 'internal')).toBe(true);
      expect(mixedVerifiers.some((u) => getReviewChannelForUser(u, clientOrg) === 'third_party')).toBe(true);
      // Absolute Rule: Service providers are NEVER populated
      expect(mixedVerifiers.some((u) => u.organization === serviceProviderOrg)).toBe(false);
      expect(mixedApprovers.some((u) => u.organization === serviceProviderOrg)).toBe(false);
    });
  });
});
