import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { CreateAssuranceSetView } from '../views/CreateAssuranceSetView';
import { clickNext } from './assuranceWizardTestHelpers';

const initialState = useMapStore.getState();

describe('Assurance Wizard Step 3 Responsible Party Multi-Select (Task 5304 / 5c-01)', () => {
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

  it('offers only Step 1 organizations as checklist options on Step 3 requirements', () => {
    const { container } = render(<CreateAssuranceSetView />);

    // Step 1: Verify Involved Organizations card displays Step 1 chosen organizations
    const involvedCard = container.querySelector('[data-testid="card-involved-organizations"]');
    expect(involvedCard).not.toBeNull();
    expect(involvedCard?.textContent).toContain('Chevron Australia Pty Ltd');
    expect(involvedCard?.textContent).toContain('Oceanic Horizon Logistics Pty Ltd');

    // Step 1 -> Step 2 (Objects)
    clickNext();
    // Step 2 -> Step 3 (Requirements)
    clickNext();

    // In Step 3: verify checklist on standard requirement vessel-class-cert
    const checklist = container.querySelector('[data-testid="responsible-party-checklist-vessel-class-cert"]');
    expect(checklist).not.toBeNull();

    // Step 1 organizations are present as checklist options
    const ohlCheckbox = container.querySelector('[data-testid="chk-party-vessel-class-cert-oceanic-horizon-logistics-pty-ltd"]') as HTMLInputElement;
    const chevCheckbox = container.querySelector('[data-testid="chk-party-vessel-class-cert-chevron-australia-pty-ltd"]') as HTMLInputElement;
    expect(ohlCheckbox).not.toBeNull();
    expect(chevCheckbox).not.toBeNull();

    // Organizations NOT chosen in Step 1 (e.g. TotalEnergies) must NOT be offered
    const totalCheckbox = container.querySelector('[data-testid="chk-party-vessel-class-cert-totalenergies"]');
    expect(totalCheckbox).toBeNull();

    const bpCheckbox = container.querySelector('[data-testid="chk-party-vessel-class-cert-bp-exploration"]');
    expect(bpCheckbox).toBeNull();
  });

  it('selects two parties on one requirement and reads them back (finding 5c-01 check)', () => {
    const { container } = render(<CreateAssuranceSetView />);

    // Navigate to Step 3
    clickNext();
    clickNext();

    const ohlCheckbox = container.querySelector('[data-testid="chk-party-vessel-class-cert-oceanic-horizon-logistics-pty-ltd"]') as HTMLInputElement;
    const chevCheckbox = container.querySelector('[data-testid="chk-party-vessel-class-cert-chevron-australia-pty-ltd"]') as HTMLInputElement;

    // Service provider starts selected by default
    expect(ohlCheckbox.checked).toBe(true);
    expect(chevCheckbox.checked).toBe(false);

    // Select second party: Chevron Australia Pty Ltd
    fireEvent.click(chevCheckbox);

    // Read them back: both are selected
    expect(ohlCheckbox.checked).toBe(true);
    expect(chevCheckbox.checked).toBe(true);

    // Counter badge confirms 2 parties selected
    const countBadge = container.querySelector('[data-testid="party-count-vessel-class-cert"]');
    expect(countBadge?.textContent).toBe('2 parties selected');
  });

  it('preserves multiple responsible parties across step navigation (Next and Back)', () => {
    const { container } = render(<CreateAssuranceSetView />);

    // Navigate to Step 3
    clickNext();
    clickNext();

    const chevCheckbox = container.querySelector('[data-testid="chk-party-vessel-class-cert-chevron-australia-pty-ltd"]') as HTMLInputElement;
    fireEvent.click(chevCheckbox);
    expect(chevCheckbox.checked).toBe(true);

    // Navigate to Step 4 (Review)
    clickNext();

    // Verify Review step displays both responsible parties for the document
    const reviewList = container.querySelector('.map-assurance-wizard');
    expect(reviewList?.textContent).toContain('Oceanic Horizon Logistics Pty Ltd');
    expect(reviewList?.textContent).toContain('Chevron Australia Pty Ltd');

    // Navigate Back to Step 3
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    // Re-verify both checkboxes remain checked
    const ohlCheckboxBack = container.querySelector('[data-testid="chk-party-vessel-class-cert-oceanic-horizon-logistics-pty-ltd"]') as HTMLInputElement;
    const chevCheckboxBack = container.querySelector('[data-testid="chk-party-vessel-class-cert-chevron-australia-pty-ltd"]') as HTMLInputElement;
    expect(ohlCheckboxBack.checked).toBe(true);
    expect(chevCheckboxBack.checked).toBe(true);
  });

  it('persists multiple responsible parties on created assurance set requirements', () => {
    const { container } = render(<CreateAssuranceSetView />);

    // Set unique title in Step 1
    const titleInput = container.querySelector('#grid-campaign-title') as HTMLInputElement;
    if (titleInput) {
      fireEvent.change(titleInput, { target: { value: 'Task 5304 Multi Party Campaign' } });
    }

    // Step 1 -> Step 2
    clickNext();
    // Step 2 -> Step 3
    clickNext();

    // Select second party on vessel-class-cert
    const chevCheckbox = container.querySelector('[data-testid="chk-party-vessel-class-cert-chevron-australia-pty-ltd"]') as HTMLInputElement;
    fireEvent.click(chevCheckbox);

    // Step 3 -> Step 4 (Review)
    clickNext();

    // Click "Create Assurance Set" button
    const createBtn = screen.getByRole('button', { name: /create assurance set/i });
    expect(createBtn).not.toBeNull();
    fireEvent.click(createBtn);

    // Inspect created set in store
    const sets = useMapStore.getState().assuranceSets;
    const createdSet = sets.find((s) => s.title === 'Task 5304 Multi Party Campaign');
    expect(createdSet).toBeDefined();

    // Find requirement corresponding to vessel-class-cert (Certificate of Class)
    const targetReq = createdSet?.requirements.find((r) => r.title.includes('Certificate of Class'));
    expect(targetReq).toBeDefined();
    expect(targetReq?.responsibleParties).toBeDefined();
    expect(targetReq?.responsibleParties).toHaveLength(2);
    expect(targetReq?.responsibleParties).toContain('Oceanic Horizon Logistics Pty Ltd');
    expect(targetReq?.responsibleParties).toContain('Chevron Australia Pty Ltd');
  });

  it('allows adding an organization in Step 1 which is then offered in Step 3', () => {
    const { container } = render(<CreateAssuranceSetView />);

    // In Step 1: select TotalEnergies from the additional orgs dropdown
    const addOrgSelect = container.querySelector('[data-testid="select-add-step1-org"]') as HTMLSelectElement;
    expect(addOrgSelect).not.toBeNull();
    fireEvent.change(addOrgSelect, { target: { value: 'TotalEnergies' } });

    const addOrgBtn = container.querySelector('[data-testid="btn-add-step1-org"]') as HTMLButtonElement;
    expect(addOrgBtn).not.toBeNull();
    fireEvent.click(addOrgBtn);

    // Verify TotalEnergies badge now exists in Step 1
    const totalBadge = container.querySelector('[data-testid="badge-step1-org-totalenergies"]');
    expect(totalBadge).not.toBeNull();

    // Navigate to Step 3
    clickNext();
    clickNext();

    // TotalEnergies is now offered in the checklist!
    const totalCheckbox = container.querySelector('[data-testid="chk-party-vessel-class-cert-totalenergies"]') as HTMLInputElement;
    expect(totalCheckbox).not.toBeNull();
    expect(totalCheckbox.checked).toBe(false);

    // Can check TotalEnergies as well
    fireEvent.click(totalCheckbox);
    expect(totalCheckbox.checked).toBe(true);
  });
});
