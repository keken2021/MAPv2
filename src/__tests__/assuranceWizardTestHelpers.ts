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
export const objectItemSelect = (container: HTMLElement, type: string) => {
  fireEvent.change(container.querySelector('#grid-add-object-type') as HTMLSelectElement, { target: { value: type } });
  return container.querySelector('#grid-add-object-item') as HTMLSelectElement;
};
export const addObject = (container: HTMLElement, type: string, id: string) => {
  fireEvent.change(objectItemSelect(container, type), { target: { value: id } });
  fireEvent.click(screen.getByRole('button', { name: /Add Object/ }));
};
export const removeObjectRow = (container: HTMLElement, id: string) =>
  fireEvent.click(container.querySelector(`[data-testid="assurance-object-row-${id}"] button[title="Remove object"]`) as HTMLButtonElement);
