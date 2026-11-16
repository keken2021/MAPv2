/* Unit and regression tests for document preview and missing-document messaging in ApproverDecisionDrawer. */
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ApproverDecisionDrawer } from '../components/drawers/ApproverDecisionDrawer';
import { useMapStore } from '../store/useMapStore';
import { AssuranceSet, AssuranceRequirement } from '../types/assurance';
import { MasterDocument } from '../types/document';
import { UserProfile } from '../types/user';

describe('ApproverDecisionDrawer document display (Task 4)', () => {
  const initialStore = useMapStore.getState();

  const mockApprover: UserProfile = {
    id: 'USR-217',
    name: 'G. Hallworth',
    email: 'g.hallworth@inpex.com.au',
    roles: ['Approver'],
    userType: 'Organization',
    organization: 'Inpex Operations Australia',
    departmentOrScope: 'Marine Operations Sign-Off',
    status: 'Active',
    lastActive: '2026-09-16 05:30 UTC',
  };

  const baseSet: AssuranceSet = {
    id: 'AS-TEST-001',
    title: 'MV Atlantic Ocean — Test Set',
    parties: [
      { organization: 'Inpex Operations Australia', role: 'Requesting party' },
      { organization: 'Northwind Marine Pty Ltd', role: 'Responding party' },
    ],
    assuranceObjects: [
      {
        id: 'VESSEL-005',
        type: 'vessel',
        name: 'MV Atlantic Ocean',
        identifier: '9712046',
        ownerOrganization: 'Northwind Marine Pty Ltd',
      },
    ],
    startDate: '2026-12-01',
    deadline: '2026-12-01',
    endDate: '2027-12-01',
    dateHistory: [],
    stage: 'Approval',
    approverDecision: 'Pending',
    readinessScore: 80,
    mandatoryInspectionRequired: false,
    inspectionCompleted: false,
    createdBy: { userId: 'USR-101', name: 'K. Osei', persona: 'Administrator' },
    submitters: [{ organization: 'Northwind Marine Pty Ltd', assignee: 'M. Chen (Northwind Marine Pty Ltd)' }],
    stakeholders: {
      submitterOrg: 'Northwind Marine Pty Ltd',
      submitterName: 'M. Chen (Northwind Marine Pty Ltd)',
      verifierOrg: 'Inpex Operations Australia',
      verifierName: 'K. Tanabe (Inpex Operations Australia)',
      approverOrg: 'Inpex Operations Australia',
      approverName: 'G. Hallworth (Inpex Operations Australia)',
    },
    requirements: [],
  };

  const mockDoc: MasterDocument = {
    id: 'DOC-TEST-1',
    title: 'Safety Radio Certificate',
    entityType: 'Vessel Certificate',
    certificateNo: 'ABS-STAT-2026-01',
    issuingAuthority: 'American Bureau of Shipping',
    issueDate: '2025-01-01',
    expiryDate: '2027-01-01',
    ocrConfidence: 96,
    complianceState: 'Valid',
    currentVersion: 'v1.0',
    verificationStatus: 'Verified',
    validationRules: {
      charterBufferPassed: true,
      assetMatch100Percent: true,
      iacsAuthorityValid: true,
      overallValid: true,
    },
    versions: [
      {
        versionLabel: 'v1.0',
        uploadedAt: '2026-01-01 10:00 UTC',
        uploadedBy: 'M. Chen',
        fileSizeBytes: 1200000,
        fileName: 'Safety_Radio_Cert.pdf',
        changeSummary: 'Initial upload',
      },
    ],
  };

  beforeEach(() => {
    useMapStore.setState({
      ...initialStore,
      users: [mockApprover],
      activePersona: 'Approver',
      activeDemoOrganization: 'Inpex Operations Australia',
      activeSessionUserId: 'USR-217',
    });
  });

  it('renders preview and enables Approve button without requiring preview interaction for verified reused document', () => {
    const requirement: AssuranceRequirement = {
      id: 'REQ-1',
      category: 'Statutory Certificate',
      title: 'Safety Radio Certificate',
      isMandatory: true,
      isFulfilled: true,
      ocrConfidence: 96,
      verifierStatus: 'Verified',
      reusedDocument: true,
      documentId: 'DOC-TEST-1',
    };

    render(
      <ApproverDecisionDrawer
        assuranceSet={{ ...baseSet, requirements: [requirement] }}
        requirement={requirement}
        linkedDoc={mockDoc}
        openFindingsCount={0}
        onClose={() => {}}
      />,
    );

    expect(screen.getAllByText('Safety Radio Certificate').length).toBeGreaterThan(0);
    const approveBtn = screen.getByRole('button', { name: /^approve$/i });
    expect(approveBtn).toBeInTheDocument();
    expect(approveBtn).toBeEnabled();
  });

  it('renders preview and hides decision buttons when assurance set is already approved', () => {
    const requirement: AssuranceRequirement = {
      id: 'REQ-1',
      category: 'Statutory Certificate',
      title: 'Safety Radio Certificate',
      isMandatory: true,
      isFulfilled: true,
      ocrConfidence: 96,
      verifierStatus: 'Verified',
      reusedDocument: true,
      documentId: 'DOC-TEST-1',
    };

    const approvedSet: AssuranceSet = {
      ...baseSet,
      stage: 'Approved',
      approverDecision: 'Approved',
      requirements: [requirement],
    };

    render(
      <ApproverDecisionDrawer
        assuranceSet={approvedSet}
        requirement={requirement}
        linkedDoc={mockDoc}
        openFindingsCount={0}
        onClose={() => {}}
      />,
    );

    expect(screen.getAllByText('Safety Radio Certificate').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /^approve$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /return task for correction/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reject task/i })).not.toBeInTheDocument();
  });

  it('shows missing document message when requirement has documentId or linkedDocumentId but linkedDoc is undefined', () => {
    const requirement: AssuranceRequirement = {
      id: 'REQ-1',
      category: 'Statutory Certificate',
      title: 'Safety Radio Certificate',
      isMandatory: true,
      isFulfilled: true,
      ocrConfidence: 96,
      verifierStatus: 'Verified',
      documentId: 'DOC-MISSING-1',
    };

    render(
      <ApproverDecisionDrawer
        assuranceSet={{ ...baseSet, requirements: [requirement] }}
        requirement={requirement}
        linkedDoc={undefined}
        openFindingsCount={0}
        onClose={() => {}}
      />,
    );

    expect(screen.getByText('The attached document could not be found.')).toBeInTheDocument();
    expect(screen.queryByText('No document attached to this requirement yet.')).not.toBeInTheDocument();
  });

  it('shows no document attached message when requirement has neither documentId nor linkedDocumentId', () => {
    const requirement: AssuranceRequirement = {
      id: 'REQ-2',
      category: 'Statutory Certificate',
      title: 'General Declaration',
      isMandatory: true,
      isFulfilled: false,
      ocrConfidence: 0,
      verifierStatus: 'Pending',
    };

    render(
      <ApproverDecisionDrawer
        assuranceSet={{ ...baseSet, requirements: [requirement] }}
        requirement={requirement}
        linkedDoc={undefined}
        openFindingsCount={0}
        onClose={() => {}}
      />,
    );

    expect(screen.getByText('No document attached to this requirement yet.')).toBeInTheDocument();
  });
});
