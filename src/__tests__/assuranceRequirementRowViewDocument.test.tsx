/* Tests for labelled View document button on requirement rows across all roles. */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AssuranceRequirementRow, AssuranceRequirementRowProps } from '../components/assurance/AssuranceRequirementRow';
import { AssuranceRequirement, AssuranceSet } from '../types/assurance';
import { MasterDocument } from '../types/document';

describe('AssuranceRequirementRow - View document button', () => {
  const mockDoc: MasterDocument = {
    id: 'DOC-ATTACHED-01',
    title: 'Safety Radio Certificate',
    entityType: 'Vessel Certificate',
    certificateNo: 'CERT-01',
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
    verificationStatus: 'Verified',
  };

  const mockReq: AssuranceRequirement = {
    id: 'REQ-RADIO-01',
    category: 'Statutory Certificate',
    title: 'Safety Radio Certificate',
    isMandatory: true,
    isFulfilled: true,
    verifierStatus: 'Verified',
    documentId: mockDoc.id,
    ocrConfidence: 96,
  };

  const mockSet: AssuranceSet = {
    id: 'AS-TEST-SET-01',
    title: 'Test Set',
    visibility: 'organization',
    assuranceType: 'Vessel',
    scopeType: 'Vessel',
    stage: 'Approval',
    readinessScore: 90,
    mandatoryInspectionRequired: false,
    inspectionCompleted: false,
    parties: [],
    requirements: [mockReq],
    createdBy: { userId: 'USR-01', name: 'User', persona: 'Administrator' },
  };

  const defaultProps: AssuranceRequirementRowProps = {
    req: mockReq,
    assuranceSet: mockSet,
    documents: [mockDoc],
    users: [],
    isSubmitter: false,
    isVerifier: false,
    isApproverOrInspector: false,
    isClientViewer: false,
    isAssignedReviewer: false,
    canEditTasks: false,
    reqTableColSpan: 4,
    isReqExpanded: false,
    toggleReqExpand: vi.fn(),
    openEditTask: vi.fn(),
    setTaskToDelete: vi.fn(),
    setSelectedDocForReview: vi.fn(),
    canViewDoc: true,
    effectiveLinkedDoc: mockDoc,
    effectiveOcr: 96,
    renderRowStatusBadge: () => null,
    renderVersionBadge: () => null,
    renderValidityBadge: () => null,
    renderRequirementStatus: () => null,
    renderContractShortWarning: () => null,
    resolveRequirementTargetObject: () => ({ name: 'Target Vessel' }),
  };

  const renderRow = (props: Partial<AssuranceRequirementRowProps>) =>
    render(
      <table>
        <tbody>
          <AssuranceRequirementRow {...defaultProps} {...props} />
        </tbody>
      </table>,
    );

  it('shows View document for submitter, verifier and approver rows with an attached document', () => {
    const roles: Array<{ name: string; props: Partial<AssuranceRequirementRowProps> }> = [
      { name: 'Submitter', props: { isSubmitter: true } },
      { name: 'Verifier', props: { isVerifier: true } },
      { name: 'Approver', props: { isApproverOrInspector: true } },
    ];

    roles.forEach(({ name, props }) => {
      const setSelectedDocForReview = vi.fn();
      const { unmount } = renderRow({
        ...props,
        canViewDoc: true,
        effectiveLinkedDoc: mockDoc,
        setSelectedDocForReview,
      });

      const button = screen.getByRole('button', { name: 'View document' });
      expect(button).toBeDefined();

      fireEvent.click(button);
      expect(setSelectedDocForReview).toHaveBeenCalledTimes(1);
      expect(setSelectedDocForReview).toHaveBeenCalledWith(
        expect.objectContaining({
          requirementId: mockReq.id,
        }),
      );

      unmount();
    });
  });

  it('does not show View document button when canViewDoc is false', () => {
    renderRow({
      canViewDoc: false,
      effectiveLinkedDoc: undefined,
    });

    expect(screen.queryByRole('button', { name: 'View document' })).toBeNull();
  });
});
