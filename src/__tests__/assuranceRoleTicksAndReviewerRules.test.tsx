import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { CreateAssuranceSetView } from '../views/CreateAssuranceSetView';
import { clickNext, renderWizardWithDefaultVessel } from './assuranceWizardTestHelpers';

const initialState = useMapStore.getState();

const CLIENT = 'Chevron Australia Pty Ltd';
const VENDOR = 'Northwind Marine Pty Ltd';
const THIRD_PARTY_1 = 'Bureau Veritas Inspectorate';
const THIRD_PARTY_2 = 'DNV Maritime Inspection';

const roleBox = (role: string, organization: string) =>
  screen.getByRole('checkbox', { name: `${role}: ${organization}` }) as HTMLInputElement;

const addOrganization = (container: HTMLElement, name: string) => {
  const input = container.querySelector('#grid-add-organization') as HTMLInputElement;
  if (!input) return;
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: name } });
  const option = container.querySelector(
    `#grid-add-organization-listbox [data-item-id="${name}"]`,
  );
  if (option) {
    fireEvent.click(option);
  } else {
    const select = container.querySelector('#select-add-step1-org') as HTMLSelectElement | null;
    if (select) {
      fireEvent.change(select, { target: { value: name } });
    }
  }
};

describe('Assurance set parties - Role ticks start empty and reviewer segregation rules (Task 5351)', () => {
  beforeEach(() => {
    useMapStore.setState(initialState, true);
    useMapStore.setState({
      assuranceSets: [],
      isAuthenticated: true,
      activePersona: 'Administrator',
      activeDemoOrganization: CLIENT,
    });
  });

  it('verifier, inspector and approver start unticked by default', () => {
    const { container } = renderWizardWithDefaultVessel();

    addOrganization(container, THIRD_PARTY_1);

    expect(roleBox('Verifier', CLIENT).checked).toBe(false);
    expect(roleBox('Inspector', CLIENT).checked).toBe(false);
    expect(roleBox('Approver', CLIENT).checked).toBe(false);

    expect(roleBox('Verifier', THIRD_PARTY_1).checked).toBe(false);
    expect(roleBox('Inspector', THIRD_PARTY_1).checked).toBe(false);
    expect(roleBox('Approver', THIRD_PARTY_1).checked).toBe(false);
  });

  it('unticking clears the role instead of returning it to the client', () => {
    const { container } = renderWizardWithDefaultVessel();
    addOrganization(container, THIRD_PARTY_1);

    const verifierThirdParty = roleBox('Verifier', THIRD_PARTY_1);
    const verifierClient = roleBox('Verifier', CLIENT);

    // Tick THIRD_PARTY_1 as Verifier
    fireEvent.click(verifierThirdParty);
    expect(verifierThirdParty.checked).toBe(true);
    expect(verifierClient.checked).toBe(false);

    // Untick THIRD_PARTY_1 as Verifier
    fireEvent.click(verifierThirdParty);
    expect(verifierThirdParty.checked).toBe(false);
    expect(verifierClient.checked).toBe(false);
  });

  it('the responding party cannot be verifier, inspector or approver and shows tooltips', () => {
    renderWizardWithDefaultVessel();

    const responderVerifier = roleBox('Verifier', VENDOR);
    const responderInspector = roleBox('Inspector', VENDOR);
    const responderApprover = roleBox('Approver', VENDOR);

    expect(responderVerifier.disabled).toBe(true);
    expect(responderVerifier.title).toBe('The responding party cannot be verifier.');

    expect(responderInspector.disabled).toBe(true);
    expect(responderInspector.title).toBe('The responding party cannot be inspector.');

    expect(responderApprover.disabled).toBe(true);
    expect(responderApprover.title).toBe('The provider cannot approve its own set. Choose the client or a third party.');
  });

  it('segregation of duties: an object owner cannot verify or approve its own objects', () => {
    const { container } = renderWizardWithDefaultVessel();

    // Add an object owner organization to the set
    addOrganization(container, 'Tidewater Marine');

    // Northwind Marine owns the default vessel on the set
    const ownerVerifier = roleBox('Verifier', VENDOR);
    const ownerApprover = roleBox('Approver', VENDOR);

    expect(ownerVerifier.disabled).toBe(true);
    expect(ownerApprover.disabled).toBe(true);
  });

  it('segregation of duties: a third party may be Verifier and Approver, only the client cannot be both', () => {
    const { container } = renderWizardWithDefaultVessel();
    addOrganization(container, THIRD_PARTY_1);

    const verifierBox = roleBox('Verifier', THIRD_PARTY_1);
    const approverBox = roleBox('Approver', THIRD_PARTY_1);
    expect(verifierBox.disabled).toBe(false);
    expect(approverBox.disabled).toBe(false);

    // A third party holds both reviewer roles
    fireEvent.click(verifierBox);
    expect(verifierBox.checked).toBe(true);
    expect(approverBox.disabled).toBe(false);
    fireEvent.click(approverBox);
    expect(roleBox('Verifier', THIRD_PARTY_1).checked).toBe(true);
    expect(roleBox('Approver', THIRD_PARTY_1).checked).toBe(true);

    // The client verifying cannot also approve
    fireEvent.click(roleBox('Approver', THIRD_PARTY_1));
    fireEvent.click(roleBox('Verifier', CLIENT));
    expect(roleBox('Verifier', CLIENT).checked).toBe(true);
    expect(roleBox('Approver', CLIENT).disabled).toBe(true);
    expect(roleBox('Approver', CLIENT).title).toBe('One organization cannot be both Verifier and Approver.');
  });

  it('each required role must be ticked before step 3 is left', () => {
    const { container } = renderWizardWithDefaultVessel();
    addOrganization(container, THIRD_PARTY_1);
    addOrganization(container, THIRD_PARTY_2);

    // Can leave Step 1 without ticking roles
    clickNext();
    expect(screen.queryByTestId('error-verifier')).toBeNull();

    // Can leave Step 2 without ticking roles
    clickNext();
    expect(screen.queryByTestId('error-verifier')).toBeNull();

    // Now on Step 3 (Requirements). Attempt to advance to Step 4 without roles:
    clickNext();

    // Blocked on Step 3 with field errors
    expect(screen.getByTestId('error-verifier')).toBeDefined();
    expect(screen.getByTestId('error-verifier').textContent).toContain('Select a verifier organization.');
    expect(screen.getByTestId('error-inspector')).toBeDefined();
    expect(screen.getByTestId('error-inspector').textContent).toContain('Select an inspector organization.');
    expect(screen.getByTestId('error-approver')).toBeDefined();
    expect(screen.getByTestId('error-approver').textContent).toContain('Select an approver organization.');

    // Go back to Step 1 and tick all required roles
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    // Tick Verifier as THIRD_PARTY_1, Approver as CLIENT, Inspector as THIRD_PARTY_2
    fireEvent.click(roleBox('Verifier', THIRD_PARTY_1));
    fireEvent.click(roleBox('Approver', CLIENT));
    fireEvent.click(roleBox('Inspector', THIRD_PARTY_2));

    // Now advance through Step 1, Step 2, and Step 3
    clickNext();
    clickNext();
    clickNext();

    // Successfully reaches Step 4 (Review)
    expect(screen.getByRole('heading', { name: 'Review' })).toBeDefined();
    expect(screen.getByTestId('review-client')).toBeDefined();
  });
});
