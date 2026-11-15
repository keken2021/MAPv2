import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  getRequirementStatusLabel,
  getInspectionTaskStatus,
  INSPECTION_TASK_STATUS,
} from '../utils/stageTasks';
import { InspectionChecklistView } from '../views/InspectionChecklistView';
import { useMapStore } from '../store/useMapStore';
import { AssuranceRequirement, AssuranceSet } from '../types/assurance';

const initialStoreState = useMapStore.getState();

describe('SS-01 Inspection Status & Guard (Task 1 / Adversarial Review S3-03, S3-04)', () => {
  describe('getRequirementStatusLabel unit tests', () => {
    it('labels document requirements awaiting review with verification status, never To Inspect', () => {
      // SIRE 2.0 report requirement from SS-01
      const sireReportReq: Partial<AssuranceRequirement> = {
        id: 'REQ-SS01-20',
        category: 'Operational Plan',
        title: 'Most recent third-party vetting inspection report (OCIMF SIRE 2.0)',
        documentId: 'DOC-10120',
        verifierStatus: 'Pending',
        assignedVerifier: 'L. Ferreira (XY Marine Assurance)',
      };

      const setInVerification: Partial<AssuranceSet> = {
        id: 'AS-2026-101',
        stage: 'Verification',
        stakeholders: {
          verifierName: 'L. Ferreira (XY Marine Assurance)',
        },
      };

      // With assigned verifier -> Awaiting Verifier
      const label = getRequirementStatusLabel(sireReportReq, setInVerification);
      expect(label).toBe('Awaiting Verifier');
      expect(label).not.toBe('To Inspect');

      // Without assigned verifier -> Submitted
      const unassignedSireReq = { ...sireReportReq, assignedVerifier: undefined };
      const setWithoutVerifier = { ...setInVerification, stakeholders: undefined };
      const unassignedLabel = getRequirementStatusLabel(unassignedSireReq, setWithoutVerifier);
      expect(unassignedLabel).toBe('Submitted');
      expect(unassignedLabel).not.toBe('To Inspect');
    });

    it('keeps To Inspect strictly for checklist tasks and never document requirements with inspection in title or category', () => {
      // Document requirements with inspection or audit in title or category
      const inspectionDocReq: Partial<AssuranceRequirement> = {
        id: 'REQ-INSP-01',
        category: 'Inspection Report',
        title: 'Annual Statutory Inspection Certificate & Audit Summary',
        documentId: 'DOC-INSP-001',
        verifierStatus: 'Pending',
      };

      const status = getRequirementStatusLabel(inspectionDocReq);
      expect(status).toBe('Submitted');
      expect(status).not.toBe('To Inspect');

      // In contrast, checklist stage task returns To Inspect when stage is Inspection
      const checklistStatus = getInspectionTaskStatus({
        stage: 'Inspection',
        mandatoryInspectionRequired: true,
        inspectionCompleted: false,
      });
      expect(checklistStatus?.status).toBe(INSPECTION_TASK_STATUS);
      expect(checklistStatus?.status).toBe('To Inspect');
    });

    it('derives accurate verification status across all document lifecycle states', () => {
      const baseReq: Partial<AssuranceRequirement> = {
        id: 'REQ-DOC-01',
        title: 'Vessel Safety Management Certificate',
      };

      // 1. Missing document or cannot view -> Awaiting Upload
      expect(getRequirementStatusLabel(baseReq)).toBe('Awaiting Upload');
      expect(getRequirementStatusLabel({ ...baseReq, documentId: 'DOC-1' }, null, { canViewDoc: false })).toBe('Awaiting Upload');

      // 2. Verified on non-approved set -> Verified
      expect(
        getRequirementStatusLabel(
          { ...baseReq, documentId: 'DOC-1', verifierStatus: 'Verified' },
          { stage: 'Verification' },
        ),
      ).toBe('Verified');

      // 3. Verified on approved set -> Approved
      expect(
        getRequirementStatusLabel(
          { ...baseReq, documentId: 'DOC-1', verifierStatus: 'Verified' },
          { stage: 'Approved' },
        ),
      ).toBe('Approved');

      // 4. Correction Requested -> Returned for Correction
      expect(
        getRequirementStatusLabel(
          { ...baseReq, documentId: 'DOC-1', verifierStatus: 'Correction Requested' },
        ),
      ).toBe('Returned for Correction');

      // 5. Rejected -> Rejected
      expect(
        getRequirementStatusLabel(
          { ...baseReq, documentId: 'DOC-1', verifierStatus: 'Rejected' },
        ),
      ).toBe('Rejected');

      // 6. Waived -> Waived
      expect(
        getRequirementStatusLabel(
          { ...baseReq, documentId: 'DOC-1', verifierStatus: 'Waived' },
        ),
      ).toBe('Waived');
    });
  });

  describe('InspectionChecklistView Submit Outcome Guard component tests', () => {
    const testSetId = 'AS-GUARD-TEST-01';
    const testVesselName = 'MV Guard Aurora';

    beforeEach(() => {
      vi.clearAllMocks();
      useMapStore.setState(initialStoreState, true);

      // Seed mock set for test
      const testSet: AssuranceSet = {
        id: testSetId,
        title: 'SS-01 LNG Transport Charter Guard Test',
        assuranceType: 'Vessel',
        subtypes: ['Vessel'],
        vesselId: 'VESSEL-GUARD-01',
        vesselName: testVesselName,
        stage: 'Verification',
        mandatoryInspectionRequired: true,
        inspectionCompleted: false,
        clientOrg: 'Oil Company',
        serviceProviderOrg: 'Northwind Marine Pty Ltd',
        assignedInspector: 'H. Blake (XY Marine Assurance)',
        requirements: [],
      } as unknown as AssuranceSet;

      useMapStore.setState({
        assuranceSets: [testSet],
        isAuthenticated: true,
        activePersona: 'Inspector',
        activeDemoOrganization: 'XY Marine Assurance',
        activeSessionUserId: 'USR-INSP-XY',
        users: [
          {
            id: 'USR-INSP-XY',
            name: 'H. Blake',
            organization: 'XY Marine Assurance',
            roles: ['Inspector'],
            status: 'Active',
            email: 'h.blake@xy.example',
            userType: 'Organization',
            departmentOrScope: 'Operations',
            lastActive: '2026-11-14 10:00 UTC',
          },
        ],
      });
    });

    it('disables Submit Outcome when set.stage !== "Inspection" with explanatory tooltip', () => {
      // In Verification stage
      render(<InspectionChecklistView setId={testSetId} vesselName={testVesselName} />);

      const submitBtn = screen.getByTestId('submit-inspection-outcome-btn');
      expect(submitBtn).toBeDisabled();
      expect(submitBtn).toHaveAttribute('title', 'Available once verification stage completes');

      const helpText = screen.getByTestId('submit-inspection-outcome-help');
      expect(helpText).toHaveTextContent('Available once verification stage completes');

      // Clicking disabled button does not invoke completeVesselInspection
      const completeSpy = vi.spyOn(useMapStore.getState(), 'completeVesselInspection');
      fireEvent.click(submitBtn);
      expect(completeSpy).not.toHaveBeenCalled();
    });

    it('enables Submit Outcome when set.stage === "Inspection" and allows submission', () => {
      // Advance stage to Inspection
      const currentSets = useMapStore.getState().assuranceSets;
      useMapStore.setState({
        assuranceSets: currentSets.map((s) => (s.id === testSetId ? { ...s, stage: 'Inspection' as const } : s)),
      });

      window.alert = vi.fn();

      render(<InspectionChecklistView setId={testSetId} vesselName={testVesselName} />);

      const submitBtn = screen.getByTestId('submit-inspection-outcome-btn');
      expect(submitBtn).not.toBeDisabled();
      expect(submitBtn).not.toHaveAttribute('title');
      expect(screen.queryByTestId('submit-inspection-outcome-help')).toBeNull();

      fireEvent.click(submitBtn);

      // Successfully completes inspection for the vessel's sets
      const updatedSet = useMapStore.getState().assuranceSets.find((s) => s.id === testSetId);
      expect(updatedSet?.inspectionCompleted).toBe(true);
    });
  });
});
