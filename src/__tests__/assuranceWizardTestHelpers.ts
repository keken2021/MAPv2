/*
  file summary: shared helpers for tests that drive the Create Assurance Set wizard.
  responsibilities: moves to the next tab, and reads, adds and removes rows on the Objects tab.
  role in system: used by the wizard tests in src/__tests__.
*/

import { fireEvent, screen } from '@testing-library/react';

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
  const verifierBoxes = screen.queryAllByRole('checkbox', { name: /^Verifier: / }) as HTMLInputElement[];
  const enabledVerifier = verifierBoxes.find((b) => !b.disabled && !b.checked);
  if (enabledVerifier) fireEvent.click(enabledVerifier);

  const approverBoxes = screen.queryAllByRole('checkbox', { name: /^Approver: / }) as HTMLInputElement[];
  const enabledApprover = approverBoxes.find((b) => !b.disabled && !b.checked);
  if (enabledApprover) fireEvent.click(enabledApprover);

  const inspectorBoxes = screen.queryAllByRole('checkbox', { name: /^Inspector: / }) as HTMLInputElement[];
  const enabledInspector = inspectorBoxes.find((b) => !b.disabled && !b.checked);
  if (enabledInspector) fireEvent.click(enabledInspector);
};
