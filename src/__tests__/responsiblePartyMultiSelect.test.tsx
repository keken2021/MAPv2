import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { CreateAssuranceSetView } from '../views/CreateAssuranceSetView';
import { clickNext, pickReviewerRoles, renderWizardWithDefaultVessel } from './assuranceWizardTestHelpers';
import { AssuranceRequirement } from '../types/assurance';

const initialState = useMapStore.getState();

describe('Assurance Wizard Step 3 Responsible Party Declutter (Task 5355 superseding 5304)', () => {
  beforeEach(() => {
    useMapStore.setState(initialState, true);
    useMapStore.setState({
      isAuthenticated: true,
      activePersona: 'Administrator',
      activeDemoOrganization: 'Chevron Australia Pty Ltd',
      activeSessionUserId: 'USR-CHEV-01',
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
          lastActive: '2026-11-03 08:00 UTC',
        },
        {
          id: 'USR-TOTAL-01',
          name: 'T. Admin',
          email: 'admin@totalenergies.com',
          roles: ['Administrator'],
          userType: 'Organization',
          organization: 'TotalEnergies',
          departmentOrScope: 'Logistics',
          status: 'Active',
          lastActive: '2026-11-03 08:00 UTC',
        },
      ],
    });
  });

  it('removes the party checklist from Step 3 requirements', () => {
    const { container } = renderWizardWithDefaultVessel();

    // Step 1: Verify Involved Organizations card displays Step 1 chosen organizations
    const involvedCard = container.querySelector('[data-testid="card-involved-organizations"]');
    expect(involvedCard).not.toBeNull();
    expect(involvedCard?.textContent).toContain('Chevron Australia Pty Ltd');

    // Step 1 -> Step 2 (Objects)
    clickNext();
    // Step 2 -> Step 3 (Requirements)
    clickNext();

    // In Step 3: verify NO checklist on requirement
    const checklist = container.querySelector('[data-testid="responsible-party-checklist-vessel-class-cert"]');
    expect(checklist).toBeNull();

    const ohlCheckbox = container.querySelector('[data-testid="chk-party-vessel-class-cert-oceanic-horizon-logistics-pty-ltd"]');
    expect(ohlCheckbox).toBeNull();
  });

  it('saves requirements with the Responding party agreed in Step 1', () => {
    const { container } = renderWizardWithDefaultVessel();

    // Step 1
    const titleInput = container.querySelector('#grid-campaign-title') as HTMLInputElement;
    if (titleInput) {
      fireEvent.change(titleInput, { target: { value: 'Task 5355 Persist Party Test' } });
    }

    pickReviewerRoles(container);

    // Step 1 -> Step 2 -> Step 3 -> Step 4
    clickNext();
    clickNext();
    clickNext();

    const createBtn = screen.getByRole('button', { name: /create assurance set/i });
    expect(createBtn).not.toBeNull();
    fireEvent.click(createBtn);

    const store = useMapStore.getState();
    const createdSet = store.assuranceSets.find((s) => s.title === 'Task 5355 Persist Party Test');
    expect(createdSet).toBeDefined();

    const classTask = createdSet?.requirements.find((r: AssuranceRequirement) => r.title.includes('Certificate of Class'));
    expect(classTask).toBeDefined();
    expect(classTask?.responsibleParty).toBe('Northwind Marine Pty Ltd');
    expect(classTask?.responsibleParties).toContain('Northwind Marine Pty Ltd');
  });
});
