import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { CreateAssuranceSetView } from '../views/CreateAssuranceSetView';

const initialState = useMapStore.getState();

const CLIENT = 'Chevron Australia Pty Ltd';

describe('Assurance set parties - Rename to Parties, stages on top (Task 5352)', () => {
  beforeEach(() => {
    useMapStore.setState(initialState, true);
    useMapStore.setState({
      assuranceSets: [],
      isAuthenticated: true,
      activePersona: 'Administrator',
      activeDemoOrganization: CLIENT,
    });
  });

  it('renames card to 3. Parties with updated help text and Add party input', () => {
    const { container } = render(<CreateAssuranceSetView />);

    // Header is "3. Parties"
    expect(screen.getByRole('heading', { name: '3. Parties' })).toBeDefined();

    // Help text updated
    expect(
      screen.getByText(
        /List every party in this set, configure verification and governance stages, and assign reviewer roles\./i,
      ),
    ).toBeDefined();

    // "Add party" searchable select placeholder / aria-label
    const addPartyInput = container.querySelector('#grid-add-organization');
    expect(addPartyInput?.getAttribute('aria-label')).toBe('Add party');
    expect(addPartyInput?.getAttribute('placeholder')).toBe('Search parties...');

    // "4. Governance & Checks" card is removed
    expect(screen.queryByText(/4\. Governance & Checks/i)).toBeNull();
  });

  it('renders stages section above the parties table inside the Parties card', () => {
    const { container } = render(<CreateAssuranceSetView />);

    const partiesCard = container.querySelector('[data-testid="card-involved-organizations"]');
    expect(partiesCard).not.toBeNull();

    const stagesSection = partiesCard?.querySelector('[data-testid="card-governance-stages"]');
    expect(stagesSection).not.toBeNull();
    expect(stagesSection?.textContent).toContain('Verification & Governance Stages');

    // Table is also inside parties card and comes after the stages section
    const table = partiesCard?.querySelector('table[aria-label="Parties on this set"]');
    expect(table).not.toBeNull();

    // Verify ordering in DOM: stages section appears before table
    expect(stagesSection?.compareDocumentPosition(table!)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('switches show or hide Verifier, Inspector, and Approver columns in the table', () => {
    const { container } = render(<CreateAssuranceSetView />);

    const verifySwitch = container.querySelector('#wf-verify') as HTMLInputElement;
    const inspectSwitch = container.querySelector('#wf-inspect') as HTMLInputElement;
    const approveSwitch = container.querySelector('#wf-approve') as HTMLInputElement;

    expect(verifySwitch).not.toBeNull();
    expect(inspectSwitch).not.toBeNull();
    expect(approveSwitch).not.toBeNull();

    // Initially all 3 switches are on and their columns are present
    expect(verifySwitch.checked).toBe(true);
    expect(inspectSwitch.checked).toBe(true);
    expect(approveSwitch.checked).toBe(true);

    expect(screen.getByRole('columnheader', { name: 'Verifier' })).toBeDefined();
    expect(screen.getByRole('columnheader', { name: 'Inspector' })).toBeDefined();
    expect(screen.getByRole('columnheader', { name: 'Approver' })).toBeDefined();

    // Toggle Verifier off -> Verifier column disappears
    fireEvent.click(verifySwitch);
    expect(verifySwitch.checked).toBe(false);
    expect(screen.queryByRole('columnheader', { name: 'Verifier' })).toBeNull();
    expect(screen.getByRole('columnheader', { name: 'Inspector' })).toBeDefined();
    expect(screen.getByRole('columnheader', { name: 'Approver' })).toBeDefined();

    // Toggle Inspector off -> Inspector column disappears
    fireEvent.click(inspectSwitch);
    expect(inspectSwitch.checked).toBe(false);
    expect(screen.queryByRole('columnheader', { name: 'Inspector' })).toBeNull();

    // Toggle Approver off -> Approver column disappears
    fireEvent.click(approveSwitch);
    expect(approveSwitch.checked).toBe(false);
    expect(screen.queryByRole('columnheader', { name: 'Approver' })).toBeNull();

    // Toggle back on
    fireEvent.click(verifySwitch);
    expect(screen.getByRole('columnheader', { name: 'Verifier' })).toBeDefined();

    fireEvent.click(inspectSwitch);
    expect(screen.getByRole('columnheader', { name: 'Inspector' })).toBeDefined();

    fireEvent.click(approveSwitch);
    expect(screen.getByRole('columnheader', { name: 'Approver' })).toBeDefined();
  });
});
