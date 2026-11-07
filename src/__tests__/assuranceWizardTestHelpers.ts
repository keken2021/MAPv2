/*
  file summary: shared helpers for tests that drive the Create Assurance Set wizard.
  responsibilities: moves to the next tab, and reads, adds and removes rows on the Objects tab.
  role in system: used by the wizard tests in src/__tests__.
*/

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { CreateAssuranceSetView } from '../views/CreateAssuranceSetView';
import { filterCAdminAvailableToCharter, getClientAdminOrganization } from '../utils/rbacHelpers';

/* wizard helpers: the Objects tab is the only place a set's assets are picked */
export const clickNext = () => fireEvent.click(screen.getByRole('button', { name: 'Next' }));
export const objectRowIds = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('[data-testid^="assurance-object-row-"]')).map((row) =>
    (row.getAttribute('data-testid') || '').replace('assurance-object-row-', ''),
  );
/* the object picker's options after a search; every id holds a dash, so a dash reaches every object of the type */
export const objectPickerOptions = (container: HTMLElement, type: string, query = '-') => {
  fireEvent.change(container.querySelector('#grid-add-object-type') as HTMLSelectElement, { target: { value: type } });
  const input = container.querySelector('#grid-add-object-item') as HTMLInputElement;
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: query } });
  return Array.from(container.querySelectorAll<HTMLElement>('#grid-add-object-item-listbox [role="option"]'));
};
export const objectItemSelect = (container: HTMLElement, type: string) => ({
  options: objectPickerOptions(container, type).map((option) => ({
    value: option.getAttribute('data-item-id') || '',
    text: option.textContent || '',
    disabled: option.getAttribute('aria-disabled') === 'true',
  })),
});
export const addObject = (container: HTMLElement, type: string, id: string) => {
  const option = objectPickerOptions(container, type, id).find((item) => item.getAttribute('data-item-id') === id);
  fireEvent.click(option as HTMLElement);
};
export const removeObjectRow = (container: HTMLElement, id: string) =>
  fireEvent.click(container.querySelector(`[data-testid="assurance-object-row-${id}"] button[title="Remove object"]`) as HTMLButtonElement);

export const pickReviewerRoles = (container: HTMLElement, thirdParty = 'Bureau Veritas Inspectorate') => {
  const input = container.querySelector('#grid-add-organization') as HTMLInputElement | null;
  if (input) {
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: thirdParty } });
    const option = container.querySelector(`#grid-add-organization-listbox [data-item-id="${thirdParty}"]`);
    if (option) fireEvent.click(option);
  }
  const thirdPartyVerifier = screen.queryByRole('checkbox', { name: `Verifier: ${thirdParty}` }) as HTMLInputElement | null;
  if (thirdPartyVerifier && !thirdPartyVerifier.disabled && !thirdPartyVerifier.checked) {
    fireEvent.click(thirdPartyVerifier);
  } else {
    const verifierBoxes = screen.queryAllByRole('checkbox', { name: /^Verifier: / }) as HTMLInputElement[];
    const enabledVerifier = verifierBoxes.find((b) => !b.disabled && !b.checked);
    if (enabledVerifier) fireEvent.click(enabledVerifier);
  }

  const approverBoxes = screen.queryAllByRole('checkbox', { name: /^Approver: / }) as HTMLInputElement[];
  const enabledApprover = approverBoxes.find((b) => !b.disabled && !b.checked);
  if (enabledApprover) fireEvent.click(enabledApprover);

  const thirdPartyInspector = screen.queryByRole('checkbox', { name: `Inspector: ${thirdParty}` }) as HTMLInputElement | null;
  if (thirdPartyInspector && !thirdPartyInspector.disabled && !thirdPartyInspector.checked) {
    fireEvent.click(thirdPartyInspector);
  } else {
    const inspectorBoxes = screen.queryAllByRole('checkbox', { name: /^Inspector: / }) as HTMLInputElement[];
    const enabledInspector = inspectorBoxes.find((b) => !b.disabled && !b.checked);
    if (enabledInspector) fireEvent.click(enabledInspector);
  }
};

/* the Objects tab starts empty unless an object is handed over; these tests open the wizard from the vessel it used to preselect: the first vessel the client may charter */
export const defaultWizardVesselId = (): string => {
  const { vessels, assuranceSets, users, activePersona, activeDemoOrganization } = useMapStore.getState();
  const clientOrgHint = activePersona === 'C Admin' || activePersona === 'Administrator' ? activeDemoOrganization : undefined;
  const clientOrg = getClientAdminOrganization(users, clientOrgHint);
  return filterCAdminAvailableToCharter(vessels, assuranceSets, clientOrg)[0]?.id || '';
};
export const renderWizardWithDefaultVessel = (vesselId: string = defaultWizardVesselId()) => {
  if (vesselId) useMapStore.setState({ createAssuranceForAsset: { scope: 'Vessel', assetId: vesselId } });
  return render(React.createElement(CreateAssuranceSetView));
};
