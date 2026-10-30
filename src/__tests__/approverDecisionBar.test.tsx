import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ApproverDecisionBar } from '../components/common/ApproverDecisionBar';
import { AssuranceDetailView } from '../views/AssuranceDetailView';
import { useMapStore } from '../store/useMapStore';
import { AssuranceSet } from '../types/assurance';
import { UserProfile } from '../types/user';

describe('ApproverDecisionBar', () => {
  const initialStore = useMapStore.getState();

  const mockApproverUser: UserProfile = {
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

  const mockOtherApproverUser: UserProfile = {
    id: 'USR-220',
    name: 'P. Nardelli',
    email: 'p.nardelli@chevron.com',
    roles: ['Approver'],
    userType: 'Organization',
    organization: 'Chevron Australia Pty Ltd',
    departmentOrScope: 'Marine Approvals',
    status: 'Active',
    lastActive: '2026-09-18 08:45 UTC',
  };

  const mockSubmitterUser: UserProfile = {
    id: 'USR-102',
    name: 'M. Chen',
    email: 'm.chen@northwindmarine.com.au',
    roles: ['Submitter'],
    userType: 'Organization',
    organization: 'Northwind Marine Pty Ltd',
    departmentOrScope: 'Operations',
    status: 'Active',
    lastActive: '2026-09-20 10:00 UTC',
  };

  const mockAssuranceSet: AssuranceSet = {
    id: 'AS-TEST-001',
    title: 'MV Atlantic Ocean — Test Approval Set',
    vesselId: 'VESSEL-005',
    vesselName: 'MV Atlantic Ocean',
    imoNumber: '9712046',
    initiatorOrg: 'Northwind Marine Pty Ltd',
    initiatorRole: 'Service Provider Admin',
    charterer: 'Inpex Operations Australia',
    clientOrg: 'Inpex Operations Australia',
    serviceProviderOrg: 'Northwind Marine Pty Ltd',
    charterWindowStart: '2026-12-01',
    complianceDeadline: '2026-12-01',
    charterWindowEnd: '2027-12-01',
    stage: 'Approval',
    approverDecision: 'Pending',
    readinessScore: 70,
    mandatoryInspectionRequired: false,
    inspectionCompleted: false,
    assignedSubmitter: 'M. Chen (Northwind Marine Pty Ltd)',
    assignedVerifier: 'K. Tanabe (Inpex Operations Australia)',
    assignedApprover: 'G. Hallworth (Inpex Operations Australia)',
    requirements: [
      {
        id: 'REQ-1',
        category: 'Class & Statutory',
        title: 'ABS Classification Certificate',
        isMandatory: true,
        isFulfilled: true,
        ocrConfidence: 96,
        verifierStatus: 'Verified',
      },
    ],
  };

  beforeEach(() => {
    useMapStore.setState({
      ...initialStore,
      users: [mockApproverUser, mockOtherApproverUser, mockSubmitterUser],
      assuranceSets: [mockAssuranceSet],
      activePersona: 'Approver',
      activeDemoOrganization: 'Inpex Operations Australia',
      activeSessionUserId: 'USR-217',
      currentEntityId: 'AS-TEST-001',
    });
  });

  describe('Component rendering & actions', () => {
    it('renders Approve, Return for correction, and Reject buttons', () => {
      render(
        <ApproverDecisionBar
          assuranceSet={mockAssuranceSet}
          openFindingsCount={0}
        />,
      );

      expect(screen.getByTestId('approver-decision-bar')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /return for correction/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument();
    });

    it('disables Approve and displays warning when open findings remain', () => {
      render(
        <ApproverDecisionBar
          assuranceSet={mockAssuranceSet}
          openFindingsCount={2}
        />,
      );

      const approveBtn = screen.getByRole('button', { name: /approve/i });
      expect(approveBtn).toBeDisabled();
      expect(screen.getByText(/cannot approve: 2 open findings remain/i)).toBeInTheDocument();
    });

    it('enables Approve when there are zero open findings and executes decision on click', () => {
      let callbackDecision: string | undefined;
      render(
        <ApproverDecisionBar
          assuranceSet={mockAssuranceSet}
          openFindingsCount={0}
          onDecisionSubmitted={(decision) => {
            callbackDecision = decision;
          }}
        />,
      );

      const approveBtn = screen.getByRole('button', { name: /approve/i });
      expect(approveBtn).not.toBeDisabled();
      fireEvent.click(approveBtn);

      expect(callbackDecision).toBe('Approved');
      const updatedSet = useMapStore.getState().assuranceSets.find((s) => s.id === mockAssuranceSet.id);
      expect(updatedSet?.approverDecision).toBe('Approved');
    });

    it('requires a reason before submitting Return for correction', () => {
      render(
        <ApproverDecisionBar
          assuranceSet={mockAssuranceSet}
          openFindingsCount={0}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /return for correction/i }));

      // Modal is open
      const modal = screen.getByRole('dialog');
      expect(within(modal).getByRole('heading', { name: 'Return for Correction' })).toBeInTheDocument();

      const submitBtn = within(modal).getByRole('button', { name: 'Return for Correction' });
      expect(submitBtn).toBeDisabled();

      const textarea = within(modal).getByRole('textbox', { name: /reason/i });
      // Typing only whitespace keeps button disabled
      fireEvent.change(textarea, { target: { value: '    ' } });
      expect(submitBtn).toBeDisabled();

      // Entering valid text enables submit button
      fireEvent.change(textarea, { target: { value: 'Missing statutory load line annex.' } });
      expect(submitBtn).not.toBeDisabled();

      fireEvent.click(submitBtn);

      const updatedSet = useMapStore.getState().assuranceSets.find((s) => s.id === mockAssuranceSet.id);
      expect(updatedSet?.approverDecision).toBe('Returned for Correction');
      expect(updatedSet?.approverNotes).toBe('Missing statutory load line annex.');
    });

    it('requires a reason before submitting Reject', () => {
      render(
        <ApproverDecisionBar
          assuranceSet={mockAssuranceSet}
          openFindingsCount={0}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /reject/i }));

      const modal = screen.getByRole('dialog');
      expect(within(modal).getByText('Reject Assurance Set')).toBeInTheDocument();

      const submitBtn = within(modal).getByRole('button', { name: 'Reject' });
      expect(submitBtn).toBeDisabled();

      const textarea = within(modal).getByRole('textbox', { name: /reason/i });
      fireEvent.change(textarea, { target: { value: 'Vessel fails structural compliance standards.' } });
      expect(submitBtn).not.toBeDisabled();

      fireEvent.click(submitBtn);

      const updatedSet = useMapStore.getState().assuranceSets.find((s) => s.id === mockAssuranceSet.id);
      expect(updatedSet?.approverDecision).toBe('Rejected');
      expect(updatedSet?.approverNotes).toBe('Vessel fails structural compliance standards.');
    });

    it('closes modal on cancel without updating set', () => {
      render(
        <ApproverDecisionBar
          assuranceSet={mockAssuranceSet}
          openFindingsCount={0}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /reject/i }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      const setInStore = useMapStore.getState().assuranceSets.find((s) => s.id === mockAssuranceSet.id);
      expect(setInStore?.approverDecision).toBe('Pending');
    });
  });

  describe('AssuranceDetailView integration & role gating', () => {
    it('shows decision bar for named approver when stage is Approval', () => {
      useMapStore.setState({
        activePersona: 'Approver',
        activeSessionUserId: 'USR-217',
        activeDemoOrganization: 'Inpex Operations Australia',
      });

      render(<AssuranceDetailView setId="AS-TEST-001" />);

      expect(screen.getByTestId('approver-decision-bar')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument();
    });

    it('does NOT show decision bar for other approvers from different org/name', () => {
      useMapStore.setState({
        activePersona: 'Approver',
        activeSessionUserId: 'USR-220', // P. Nardelli
        activeDemoOrganization: 'Chevron Australia Pty Ltd',
      });

      render(<AssuranceDetailView setId="AS-TEST-001" />);

      expect(screen.queryByTestId('approver-decision-bar')).not.toBeInTheDocument();
    });

    it('does NOT show decision bar for other roles (Submitter, Verifier, Inspector, Administrator, C Admin)', () => {
      const nonApproverRoles: ('Submitter' | 'Verifier' | 'Inspector' | 'Administrator' | 'C Admin')[] = [
        'Submitter',
        'Verifier',
        'Inspector',
        'Administrator',
        'C Admin',
      ];

      for (const role of nonApproverRoles) {
        useMapStore.setState({
          activePersona: role,
        });

        const { unmount } = render(<AssuranceDetailView setId="AS-TEST-001" />);
        expect(screen.queryByTestId('approver-decision-bar')).not.toBeInTheDocument();
        unmount();
      }
    });

    it('does NOT show decision bar when stage is not Approval (e.g. Verification)', () => {
      useMapStore.setState({
        activePersona: 'Approver',
        activeSessionUserId: 'USR-217',
        activeDemoOrganization: 'Inpex Operations Australia',
        assuranceSets: [
          {
            ...mockAssuranceSet,
            stage: 'Verification',
          },
        ],
      });

      render(<AssuranceDetailView setId="AS-TEST-001" />);

      expect(screen.queryByTestId('approver-decision-bar')).not.toBeInTheDocument();
    });

    it('does NOT show decision bar once set is already Approved', () => {
      useMapStore.setState({
        activePersona: 'Approver',
        activeSessionUserId: 'USR-217',
        activeDemoOrganization: 'Inpex Operations Australia',
        assuranceSets: [
          {
            ...mockAssuranceSet,
            stage: 'Approved',
            approverDecision: 'Approved',
          },
        ],
      });

      render(<AssuranceDetailView setId="AS-TEST-001" />);

      expect(screen.queryByTestId('approver-decision-bar')).not.toBeInTheDocument();
    });
  });
});
