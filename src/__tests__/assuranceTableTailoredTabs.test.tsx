/*
  file summary: tests tailored status tabs (To do, In progress, Completed) for workflow roles vs default tabs for admins in AssuranceTable.
  responsibilities: verifies tab structure, default active tab, role-tailored set bucketing, and notification set visibility.
  role in system: tests AssuranceTable.tsx and getAssuranceSetWorkflowTab / isUserStakeholderOnSet in rbacHelpers.ts.
*/

import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { AssuranceTable } from '../components/tables/AssuranceTable';
import { useMapStore } from '../store/useMapStore';
import { getAssuranceSetWorkflowTab, isUserStakeholderOnSet } from '../utils/rbacHelpers';
import { MOCK_ASSURANCE_SETS, MOCK_USERS } from '../store/mockData';
import { MOCK_NOTIFICATIONS } from '../store/notificationMockData';
import { AssuranceSet } from '../types/assurance';

describe('AssuranceTable tailored status tabs and role visibility', () => {
  it('renders default tabs (Public, Organization, Drafts) for C Admin and Administrator', () => {
    // 1. C Admin
    act(() => {
      useMapStore.setState({
        activePersona: 'C Admin',
        activeDemoOrganization: 'Southern Basin Energy Pty Ltd',
        activeSessionUserId: 'USR-201',
      });
    });

    const { rerender } = render(<AssuranceTable onSelectSet={() => {}} />);
    expect(screen.getByRole('tab', { name: /Public/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Organization/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Drafts/i })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /To do/i })).not.toBeInTheDocument();

    // 2. Administrator
    act(() => {
      useMapStore.setState({
        activePersona: 'Administrator',
        activeDemoOrganization: 'Northwind Marine Pty Ltd',
        activeSessionUserId: 'USR-101',
      });
    });

    rerender(<AssuranceTable onSelectSet={() => {}} />);
    expect(screen.getByRole('tab', { name: /Public/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Organization/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Drafts/i })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /To do/i })).not.toBeInTheDocument();
  });

  it('renders tailored workflow tabs (To do, In progress, Completed) for Submitter, Verifier, Inspector, Approver', () => {
    const workflowRoles = [
      { persona: 'Submitter' as const, org: 'Northwind Marine Pty Ltd', user: 'USR-102' },
      { persona: 'Verifier' as const, org: 'Bureau Veritas Inspectorate', user: 'USR-202' },
      { persona: 'Inspector' as const, org: 'Bureau Veritas Inspectorate', user: 'USR-203' },
      { persona: 'Approver' as const, org: 'Marine Assurance Authority', user: 'USR-204' },
    ];

    for (const { persona, org, user } of workflowRoles) {
      useMapStore.setState({
        activePersona: persona,
        activeDemoOrganization: org,
        activeSessionUserId: user,
      });

      const { unmount } = render(<AssuranceTable onSelectSet={() => {}} />);
      expect(screen.getByRole('tab', { name: /To do/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /In progress/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Completed/i })).toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: /Public/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: /Drafts/i })).not.toBeInTheDocument();
      unmount();
    }
  });

  it('defaults to To do tab for workflow roles', () => {
    useMapStore.setState({
      activePersona: 'Approver',
      activeDemoOrganization: 'Marine Assurance Authority',
      activeSessionUserId: 'USR-204',
    });

    render(<AssuranceTable onSelectSet={() => {}} />);
    const todoTab = screen.getByRole('tab', { name: /To do/i });
    expect(todoTab).toHaveClass('is-active');
  });

  it('categorizes assurance sets into todo, in_progress, and completed correctly', () => {
    const approverUser = MOCK_USERS.find((u) => u.id === 'USR-204')!;
    
    // Approved set -> completed
    const approvedSet: AssuranceSet = {
      ...MOCK_ASSURANCE_SETS[0],
      stage: 'Approved',
      approverDecision: 'Approved',
      assignedApprover: 'P. Nardelli (Marine Assurance Authority)',
    };
    expect(getAssuranceSetWorkflowTab(approvedSet, 'Approver', approverUser)).toBe('completed');

    // Set awaiting approval -> todo
    const awaitingSet: AssuranceSet = {
      ...MOCK_ASSURANCE_SETS[0],
      stage: 'Approval',
      approverDecision: 'Pending',
      assignedApprover: 'P. Nardelli (Marine Assurance Authority)',
      requirements: [{
        id: 'REQ-1',
        category: 'Class & Statutory',
        title: 'Cert 1',
        isMandatory: true,
        isFulfilled: true,
        ocrConfidence: 100,
        verifierStatus: 'Verified',
      }],
    };
    expect(getAssuranceSetWorkflowTab(awaitingSet, 'Approver', approverUser)).toBe('todo');

    // Initiated set -> in_progress for Approver
    const initiatedSet: AssuranceSet = {
      ...MOCK_ASSURANCE_SETS[0],
      stage: 'Initiated',
      approverDecision: 'Pending',
      assignedApprover: 'P. Nardelli (Marine Assurance Authority)',
      requirements: [{
        id: 'REQ-1',
        category: 'Class & Statutory',
        title: 'Cert 1',
        isMandatory: true,
        isFulfilled: false,
        ocrConfidence: 0,
        verifierStatus: 'Pending',
      }],
    };
    expect(getAssuranceSetWorkflowTab(initiatedSet, 'Approver', approverUser)).toBe('in_progress');
  });

  it('allows Approvers to see assigned sets across all stages via isUserStakeholderOnSet', () => {
    const approverUser = MOCK_USERS.find((u) => u.id === 'USR-204')!;
    const earlyStageSet: AssuranceSet = {
      ...MOCK_ASSURANCE_SETS[0],
      id: 'AS-EARLY-001',
      stage: 'Initiated',
      approverDecision: 'Pending',
      assignedApprover: 'P. Nardelli (Marine Assurance Authority)',
    };

    expect(isUserStakeholderOnSet(earlyStageSet, 'Approver', approverUser)).toBe(true);
  });

  it('ensures notification-assigned sets reflect in the table for Approver and Inspector', () => {
    // Check Approver's notification set AS-2026-003
    useMapStore.setState({
      activePersona: 'Approver',
      activeDemoOrganization: 'Marine Assurance Authority',
      activeSessionUserId: 'USR-204',
    });

    const { unmount } = render(<AssuranceTable onSelectSet={() => {}} />);
    // Switch to In progress tab where AS-2026-003 is located
    const inProgressTab = screen.getByRole('tab', { name: /In progress/i });
    fireEvent.click(inProgressTab);
    expect(screen.getByText('AS-2026-003')).toBeInTheDocument();
    unmount();

    // Check Inspector's notification set AS-2026-005 (inspection completed, so in progress towards approval)
    useMapStore.setState({
      activePersona: 'Inspector',
      activeDemoOrganization: 'Bureau Veritas Inspectorate',
      activeSessionUserId: 'USR-203',
    });

    render(<AssuranceTable onSelectSet={() => {}} />);
    const inspectorInProgressTab = screen.getByRole('tab', { name: /In progress/i });
    fireEvent.click(inspectorInProgressTab);
    expect(screen.getByText('AS-2026-005')).toBeInTheDocument();
  });
});
