import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  isRequirementOnOlderVersion,
  countOutdatedVersionRequirements,
} from '../utils/documentVersionSnapshot';
import { AssuranceDetailView } from '../views/AssuranceDetailView';
import { useMapStore } from '../store/useMapStore';
import { AssuranceSet, AssuranceRequirement } from '../types/assurance';
import { MasterDocument } from '../types/document';

describe('Outdated Document Version on Open Sets (FR-15)', () => {
  const sampleDocs: MasterDocument[] = [
    {
      id: 'DOC-001',
      title: 'Safety Management Certificate',
      entityType: 'Vessel Certificate',
      vesselId: 'VESSEL-001',
      certificateNo: 'SMC-001',
      issuingAuthority: 'DNV',
      expiryDate: '2027-01-01',
      ocrConfidence: 98,
      complianceState: 'Valid',
      currentVersion: 'v2.0',
      versions: [
        {
          versionLabel: 'v2.0',
          uploadedAt: '2026-03-01T00:00:00Z',
          uploadedBy: 'USR-001',
          fileSizeBytes: 1024,
          fileName: 'smc-v2.pdf',
          changeSummary: 'Updated version',
        },
        {
          versionLabel: 'v1.0',
          uploadedAt: '2026-01-01T00:00:00Z',
          uploadedBy: 'USR-001',
          fileSizeBytes: 1024,
          fileName: 'smc-v1.pdf',
          changeSummary: 'Initial version',
        },
      ],
      validationRules: {
        charterBufferPassed: true,
        assetMatch100Percent: true,
        iacsAuthorityValid: true,
        overallValid: true,
      },
      verificationStatus: 'Verified',
    },
    {
      id: 'DOC-002',
      title: 'Crew List',
      entityType: 'Vessel Certificate',
      vesselId: 'VESSEL-001',
      certificateNo: 'CREW-001',
      issuingAuthority: 'Flag State',
      expiryDate: '2027-01-01',
      ocrConfidence: 95,
      complianceState: 'Valid',
      currentVersion: 'v1.0',
      versions: [
        {
          versionLabel: 'v1.0',
          uploadedAt: '2026-01-01T00:00:00Z',
          uploadedBy: 'USR-001',
          fileSizeBytes: 1024,
          fileName: 'crew-v1.pdf',
          changeSummary: 'Initial version',
        },
      ],
      validationRules: {
        charterBufferPassed: true,
        assetMatch100Percent: true,
        iacsAuthorityValid: true,
        overallValid: true,
      },
      verificationStatus: 'Verified',
    },
  ];

  describe('isRequirementOnOlderVersion unit tests', () => {
    it('returns true when an open set requirement is pinned to an older version', () => {
      const openSet: Pick<AssuranceSet, 'stage' | 'approverDecision'> = {
        stage: 'Verification',
        approverDecision: undefined,
      };
      const req = {
        documentId: 'DOC-001',
        documentVersion: 'v1.0',
      };
      expect(isRequirementOnOlderVersion(req, openSet, sampleDocs)).toBe(true);
    });

    it('returns false when requirement is on the latest version', () => {
      const openSet: Pick<AssuranceSet, 'stage' | 'approverDecision'> = {
        stage: 'Verification',
        approverDecision: undefined,
      };
      const req = {
        documentId: 'DOC-001',
        documentVersion: 'v2.0',
      };
      expect(isRequirementOnOlderVersion(req, openSet, sampleDocs)).toBe(false);
    });

    it('returns false when the set is closed or approved even if an older version is pinned', () => {
      const closedSet: Pick<AssuranceSet, 'stage' | 'approverDecision'> = {
        stage: 'Approved',
        approverDecision: 'Approved',
      };
      const req = {
        documentId: 'DOC-001',
        documentVersion: 'v1.0',
      };
      expect(isRequirementOnOlderVersion(req, closedSet, sampleDocs)).toBe(false);
    });

    it('returns false when document is not in library or requirement has no pinned version', () => {
      const openSet: Pick<AssuranceSet, 'stage' | 'approverDecision'> = {
        stage: 'Initiated',
        approverDecision: undefined,
      };
      const reqNoVer = {
        documentId: 'DOC-001',
      };
      const reqUnknownDoc = {
        documentId: 'DOC-NONEXISTENT',
        documentVersion: 'v1.0',
      };
      expect(isRequirementOnOlderVersion(reqNoVer, openSet, sampleDocs)).toBe(false);
      expect(isRequirementOnOlderVersion(reqUnknownDoc, openSet, sampleDocs)).toBe(false);
    });
  });

  describe('countOutdatedVersionRequirements unit tests', () => {
    it('counts outdated requirements in an open set correctly', () => {
      const openSet: Pick<AssuranceSet, 'stage' | 'approverDecision' | 'requirements'> = {
        stage: 'Verification',
        approverDecision: undefined,
        requirements: [
          {
            id: 'REQ-1',
            category: 'Statutory Certificate',
            title: 'SMC',
            isMandatory: true,
            isFulfilled: true,
            ocrConfidence: 95,
            verifierStatus: 'Verified',
            documentId: 'DOC-001',
            documentVersion: 'v1.0', // outdated (doc is v2.0)
          },
          {
            id: 'REQ-2',
            category: 'Statutory Certificate',
            title: 'Crew List',
            isMandatory: true,
            isFulfilled: true,
            ocrConfidence: 95,
            verifierStatus: 'Verified',
            documentId: 'DOC-002',
            documentVersion: 'v1.0', // up-to-date (doc is v1.0)
          },
        ],
      };
      expect(countOutdatedVersionRequirements(openSet, sampleDocs)).toBe(1);
    });

    it('returns 0 for closed/approved sets', () => {
      const approvedSet: Pick<AssuranceSet, 'stage' | 'approverDecision' | 'requirements'> = {
        stage: 'Approved',
        approverDecision: 'Approved',
        requirements: [
          {
            id: 'REQ-1',
            category: 'Statutory Certificate',
            title: 'SMC',
            isMandatory: true,
            isFulfilled: true,
            ocrConfidence: 95,
            verifierStatus: 'Verified',
            documentId: 'DOC-001',
            documentVersion: 'v1.0',
          },
        ],
      };
      expect(countOutdatedVersionRequirements(approvedSet, sampleDocs)).toBe(0);
    });
  });

  describe('AssuranceDetailView render tests', () => {
    beforeEach(() => {
      const store = useMapStore.getState();
      useMapStore.setState({
        activePersona: 'C Admin',
        activeDemoOrganization: 'Chevron Shipping',
        activeSessionUserId: 'USR-CS-01',
        users: [
          ...store.users.filter((u) => u.id !== 'USR-CS-01'),
          {
            id: 'USR-CS-01',
            name: 'C. Shipping Admin',
            email: 'c.admin@chevronshipping.example',
            roles: ['C Admin'],
            organization: 'Chevron Shipping',
            status: 'Active',
            userType: 'Organization',
            departmentOrScope: 'Assurance',
            lastActive: 'Just now',
          },
        ],
      });
    });

    it('renders "Newer version available" badge on requirement and header count for open set', () => {
      const store = useMapStore.getState();
      const testSetId = 'AS-TEST-OUTDATED-OPEN';
      const openSet: AssuranceSet = {
        ...store.assuranceSets[0],
        id: testSetId,
        title: 'Open Set with Outdated Doc',
        assuranceType: 'Vessel',
        subtypes: ['Vessel'],
        stage: 'Verification',
        readinessScore: 75,
        targetDate: '2026-12-01',
        initiatorOrg: 'Chevron Shipping',
        createdByUserId: 'USR-CS-01',
        createdByName: 'C. Shipping Admin',
        createdByPersona: 'C Admin',
        clientOrg: 'Chevron Shipping',
        requestingParty: 'Chevron Shipping',
        respondingParty: 'Alpha Shipping',
        serviceProviderOrg: 'Alpha Shipping',
        vesselName: 'Pacific Valour',
        imoNumber: '9234567',
        sections: [
          { id: 'sec-vessel', name: 'Vessel documents', order: 1 },
        ],
        requirements: [
          {
            id: 'REQ-OUTDATED-1',
            subtype: 'Vessel',
            category: 'Statutory Certificate',
            title: 'Safety Certificate Test',
            isMandatory: true,
            isFulfilled: false,
            ocrConfidence: 90,
            verifierStatus: 'Pending',
            documentId: 'DOC-001',
            documentVersion: 'v1.0', // older than DOC-001 currentVersion v2.0
            sectionId: 'sec-vessel',
          },
        ],
      };

      useMapStore.setState({
        assuranceSets: [openSet, ...store.assuranceSets],
        documents: [...store.documents.filter((d) => d.id !== 'DOC-001'), sampleDocs[0]],
      });

      render(<AssuranceDetailView setId={testSetId} initialTab="requirements" />);

      // Check header count metadata
      expect(screen.getByText(/1 newer version available/i)).toBeInTheDocument();

      // Check requirement row badge
      const badge = screen.getByTestId('badge-newer-version-REQ-OUTDATED-1');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('Newer version available');
    });

    it('does not flag requirement or count in header when set is approved/closed', () => {
      const store = useMapStore.getState();
      const closedSetId = 'AS-TEST-OUTDATED-CLOSED';
      const closedSet: AssuranceSet = {
        ...store.assuranceSets[0],
        id: closedSetId,
        title: 'Closed Set with Older Doc',
        stage: 'Approved',
        approverDecision: 'Approved',
        readinessScore: 100,
        targetDate: '2026-12-01',
        initiatorOrg: 'Chevron Shipping',
        createdByUserId: 'USR-CS-01',
        createdByName: 'C. Shipping Admin',
        createdByPersona: 'C Admin',
        clientOrg: 'Chevron Shipping',
        requestingParty: 'Chevron Shipping',
        respondingParty: 'Alpha Shipping',
        serviceProviderOrg: 'Alpha Shipping',
        vesselName: 'Pacific Valour',
        imoNumber: '9234567',
        sections: [
          { id: 'sec-vessel', name: 'Vessel documents', order: 1 },
        ],
        requirements: [
          {
            id: 'REQ-OUTDATED-2',
            subtype: 'Vessel',
            category: 'Statutory Certificate',
            title: 'Safety Certificate Test Closed',
            isMandatory: true,
            isFulfilled: true,
            ocrConfidence: 98,
            verifierStatus: 'Verified',
            documentId: 'DOC-001',
            documentVersion: 'v1.0',
            sectionId: 'sec-vessel',
          },
        ],
      };

      useMapStore.setState({
        assuranceSets: [closedSet, ...store.assuranceSets],
        documents: [...store.documents.filter((d) => d.id !== 'DOC-001'), sampleDocs[0]],
      });

      render(<AssuranceDetailView setId={closedSetId} initialTab="requirements" />);

      // Header should NOT show outdated versions count
      expect(screen.queryByText(/newer version.*available/i)).not.toBeInTheDocument();

      // Requirement row should NOT have open-set newer version available badge
      expect(screen.queryByTestId('badge-newer-version-REQ-OUTDATED-2')).not.toBeInTheDocument();
    });
  });
});
