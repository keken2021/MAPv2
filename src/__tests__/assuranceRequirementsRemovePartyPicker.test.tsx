import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { CreateAssuranceSetView } from '../views/CreateAssuranceSetView';
import { clickNext, pickReviewerRoles } from './assuranceWizardTestHelpers';
import { AssuranceRequirement } from '../types/assurance';

const initialState = useMapStore.getState();

describe('Assurance Requirements - Remove Per-Requirement Party Picker (Task 5355)', () => {
  beforeEach(() => {
    useMapStore.setState(initialState, true);
    useMapStore.setState({
      isAuthenticated: true,
      activePersona: 'Administrator',
      activeDemoOrganization: 'Chevron Australia Pty Ltd',
      users: [
        ...initialState.users,
        {
          id: 'USR-OHL-01',
          name: 'J. Ocean',
          email: 'j.ocean@oceanic.com',
          roles: ['Submitter'],
          userType: 'Organization',
          organization: 'Oceanic Horizon Logistics Pty Ltd',
          departmentOrScope: 'Operations',
          status: 'Active',
          lastActive: '2026-10-29 08:00 UTC',
        },
        {
          id: 'USR-CHEV-01',
          name: 'C. Administrator',
          email: 'admin@chevron.com',
          roles: ['Administrator', 'C Admin'],
          userType: 'Organization',
          organization: 'Chevron Australia Pty Ltd',
          departmentOrScope: 'Operations',
          status: 'Active',
          lastActive: '2026-11-04 08:00 UTC',
        },
      ],
    });
  });

  it('does not display any responsible party checklist or party picker on Step 3 requirements', () => {
    const { container } = render(<CreateAssuranceSetView />);

    // Step 1 -> Step 2 -> Step 3
    clickNext();
    clickNext();

    // Verify step 3 is active
    expect(screen.getByRole('button', { name: /3\s+Requirements/i })).toBeInTheDocument();

    // 1. General documents: no party checklist or container
    expect(container.querySelector('[data-testid^="responsible-party-container-gen-doc"]')).toBeNull();
    expect(container.querySelector('[data-testid^="responsible-party-checklist-gen-doc"]')).toBeNull();

    // 2. Standard documents: no party checklist or container
    expect(container.querySelector('[data-testid="responsible-party-container-vessel-class-cert"]')).toBeNull();
    expect(container.querySelector('[data-testid="responsible-party-checklist-vessel-class-cert"]')).toBeNull();
    expect(container.querySelector('[data-testid="chk-party-vessel-class-cert-oceanic-horizon-logistics-pty-ltd"]')).toBeNull();
    expect(container.querySelector('[data-testid="chk-party-vessel-class-cert-chevron-australia-pty-ltd"]')).toBeNull();

    // 3. No party checkboxes anywhere in the document list
    const partyCheckboxes = container.querySelectorAll('input[data-testid^="chk-party-"]');
    expect(partyCheckboxes.length).toBe(0);

    // 4. No party count badges
    const partyCountBadges = container.querySelectorAll('[data-testid^="party-count-"]');
    expect(partyCountBadges.length).toBe(0);
  });

  it('saves every requirement with responsibleParty set to the Responding party', () => {
    const { container } = render(<CreateAssuranceSetView />);

    // Step 1: fill required fields
    const titleInput = container.querySelector('#grid-campaign-title') as HTMLInputElement;
    if (titleInput) {
      fireEvent.change(titleInput, { target: { value: 'Task 5355 Responding Party Set' } });
    }

    // Configure reviewers in Step 1
    pickReviewerRoles(container);

    // Step 1 -> Step 2
    clickNext();

    // Step 2 -> Step 3
    clickNext();

    // Step 3 -> Step 4 (Review)
    clickNext();

    // Step 4: Click Create Assurance Set
    const createBtn = screen.getByRole('button', { name: /create assurance set/i });
    expect(createBtn).toBeInTheDocument();
    fireEvent.click(createBtn);

    // Inspect created set in store
    const store = useMapStore.getState();
    const createdSet = store.assuranceSets.find((s) => s.title === 'Task 5355 Responding Party Set');
    expect(createdSet).toBeDefined();

    const expectedRespondingParty = 'Northwind Marine Pty Ltd';
    expect(createdSet?.requirements.length).toBeGreaterThan(0);

    // Every single saved requirement must carry responsibleParty = Responding party
    createdSet?.requirements.forEach((req: AssuranceRequirement) => {
      expect(req.responsibleParty).toBe(expectedRespondingParty);
      expect(req.responsibleParties).toContain(expectedRespondingParty);
    });
  });

  it('updates saved requirements responsibleParty when a different Responding party is selected in Step 1', () => {
    const { container } = render(<CreateAssuranceSetView />);

    const titleInput = container.querySelector('#grid-campaign-title') as HTMLInputElement;
    if (titleInput) {
      fireEvent.change(titleInput, { target: { value: 'Task 5355 Custom Party Set' } });
    }

    pickReviewerRoles(container);

    // In Step 1: Change Responding party to Oceanic Horizon Logistics Pty Ltd
    // First, add Oceanic Horizon Logistics Pty Ltd if not already listed
    const addOrgSelect = container.querySelector('#grid-add-organization') as HTMLInputElement | null;
    if (addOrgSelect) {
      fireEvent.focus(addOrgSelect);
      fireEvent.change(addOrgSelect, { target: { value: 'Oceanic Horizon Logistics Pty Ltd' } });
      const opt = container.querySelector('#grid-add-organization-listbox [data-item-id="Oceanic Horizon Logistics Pty Ltd"]');
      if (opt) fireEvent.click(opt);
    }

    const ohlRoleSelect = container.querySelector('[id="party-role-Oceanic Horizon Logistics Pty Ltd"]') as HTMLSelectElement | null;
    if (ohlRoleSelect) {
      fireEvent.change(ohlRoleSelect, { target: { value: 'Responding party' } });
    }

    // Step 1 -> Step 2 -> Step 3 -> Step 4
    clickNext();
    clickNext();
    clickNext();

    const createBtn = screen.getByRole('button', { name: /create assurance set/i });
    expect(createBtn).toBeInTheDocument();
    fireEvent.click(createBtn);

    const store = useMapStore.getState();
    const createdSet = store.assuranceSets.find((s) => s.title === 'Task 5355 Custom Party Set');
    expect(createdSet).toBeDefined();

    const targetParty = ohlRoleSelect ? 'Oceanic Horizon Logistics Pty Ltd' : 'Northwind Marine Pty Ltd';
    createdSet?.requirements.forEach((req: AssuranceRequirement) => {
      expect(req.responsibleParty).toBe(targetParty);
    });
  });
});
