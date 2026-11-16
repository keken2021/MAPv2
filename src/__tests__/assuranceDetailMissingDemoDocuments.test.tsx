/* View test verifying that missing demo documents are rebuilt and viewable in the detail view. */
import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { AssuranceRequirement, AssuranceSet } from '../types/assurance';
import { AssuranceDetailView } from '../views/AssuranceDetailView';

const initialState = useMapStore.getState();

describe('AssuranceDetailView - Missing demo documents repair', () => {
  beforeEach(() => {
    useMapStore.setState(initialState, true);
  });

  it('shows the View document button for a pre-seeded row whose document was never stored', () => {
    const req: AssuranceRequirement = {
      id: 'REQ-REPAIR-03',
      category: 'Statutory Certificate',
      title: 'Safety Radio Certificate',
      isMandatory: true,
      isFulfilled: true,
      verifierStatus: 'Verified',
      ocrConfidence: 96,
      demoPreseeded: true,
      documentId: 'DOC-DEMO-AS-2026-REPAIR-3',
      sectionId: 'sec-vessel',
    };

    const repairSet: AssuranceSet = {
      id: 'AS-2026-REPAIR',
      title: 'Approval Repair Set',
      visibility: 'organization',
      assuranceType: 'Vessel',
      scopeType: 'Vessel',
      stage: 'Approval',
      readinessScore: 90,
      mandatoryInspectionRequired: false,
      inspectionCompleted: false,
      formalApprovalRequired: true,
      verificationRequired: true,
      parties: [
        {
          organization: 'Chevron Australia Pty Ltd',
          group: 'Client',
          role: 'Requesting party',
          partyRole: 'Requesting party',
        },
        {
          organization: 'Northwind Marine Pty Ltd',
          group: 'Vendor',
          role: 'Responding party',
          partyRole: 'Responding party',
        },
      ],
      assuranceObjects: [
        {
          id: 'VES-001',
          type: 'vessel',
          name: 'Pacific Osprey',
          ownerOrganization: 'Northwind Marine Pty Ltd',
        },
      ],
      stakeholders: {
        submitterOrg: 'Northwind Marine Pty Ltd',
        submitterName: 'M. Chen (Northwind Marine Pty Ltd)',
        verifierOrg: 'Bureau Veritas Inspectorate',
        verifierName: 'D. Harrison (Bureau Veritas Inspectorate)',
        approverOrg: 'Marine Assurance Authority',
        approverName: 'P. Nardelli (Marine Assurance Authority)',
      },
      requirements: [req],
      createdBy: {
        userId: 'USR-MAP-ADMIN',
        name: 'M. Platform',
        persona: 'Administrator',
      },
    };

    useMapStore.setState({
      assuranceSets: [repairSet],
      documents: [], // Document was never stored!
      activePersona: 'Approver',
      activeDemoOrganization: 'Marine Assurance Authority',
      activeSessionUserId: 'USR-204',
    });

    render(
      React.createElement(AssuranceDetailView, {
        setId: repairSet.id,
        initialTab: 'requirements',
      }),
    );

    // The button must exist (named "PDF Review" in Task 2 or "View document" in Task 3)
    const viewBtn = screen.getByRole('button', {
      name: /view document|pdf review/i,
    });
    expect(viewBtn).toBeDefined();

    // Clicking it opens the review drawer
    fireEvent.click(viewBtn);

    expect(
      screen.getByRole('dialog', { name: /safety radio certificate/i }),
    ).toBeDefined();
  });
});
