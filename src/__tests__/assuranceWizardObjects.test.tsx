import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { CreateAssuranceSetView } from '../views/CreateAssuranceSetView';
import { clickNext, objectRowIds } from './assuranceWizardTestHelpers';

function setupStep1(container: HTMLElement) {
  const clientSelect = container.querySelector('select[aria-label^="Party role:"]') as HTMLSelectElement | null;
  if (clientSelect) {
    fireEvent.change(clientSelect, { target: { value: 'Requesting party' } });
  }

  const input = container.querySelector('#grid-add-organization') as HTMLInputElement | null;
  if (input) {
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Northwind Marine Pty Ltd' } });
    const option = container.querySelector('#grid-add-organization-listbox [data-item-id="Northwind Marine Pty Ltd"]');
    if (option) fireEvent.click(option);
  }

  const northwindSelect = container.querySelector('select[aria-label="Party role: Northwind Marine Pty Ltd"]') as HTMLSelectElement | null;
  if (northwindSelect) {
    fireEvent.change(northwindSelect, { target: { value: 'Responding party' } });
  }

  if (input) {
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Bureau Veritas Inspectorate' } });
    const option = container.querySelector('#grid-add-organization-listbox [data-item-id="Bureau Veritas Inspectorate"]');
    if (option) fireEvent.click(option);
  }

  const verifierBox = container.querySelector('input[aria-label="Verifier: Bureau Veritas Inspectorate"]') as HTMLInputElement | null;
  if (verifierBox) fireEvent.click(verifierBox);

  const inspectorBox = container.querySelector('input[aria-label="Inspector: Bureau Veritas Inspectorate"]') as HTMLInputElement | null;
  if (inspectorBox) fireEvent.click(inspectorBox);

  const approverBox = container.querySelector('input[aria-label="Approver: Bureau Veritas Inspectorate"]') as HTMLInputElement | null;
  if (approverBox) fireEvent.click(approverBox);
}

describe('CreateAssuranceSetView Objects Step', () => {
  beforeEach(() => {
    useMapStore.setState({
      assuranceSets: [],
      isAuthenticated: true,
      activePersona: 'Administrator',
      activeDemoOrganization: 'Marine Assurance Platform',
    });
  });

  it('offers only the 4 canonical target object types in #grid-add-object-type', () => {
    const { container } = render(<CreateAssuranceSetView />);
    setupStep1(container);
    clickNext();

    const typeSelect = container.querySelector('#grid-add-object-type') as HTMLSelectElement;
    expect(typeSelect).not.toBeNull();

    const optionValues = Array.from(typeSelect.options).map((opt) => opt.value);
    expect(optionValues).toEqual(['vessel', 'person', 'equipment', 'activity']);

    const optionLabels = Array.from(typeSelect.options).map((opt) => opt.text.trim());
    expect(optionLabels).toEqual(['Vessel', 'Person / Crew', 'Equipment', 'Activity']);

    expect(optionValues).not.toContain('procedure');
    expect(optionValues).not.toContain('method');
    expect(optionValues).not.toContain('document');
    expect(optionValues).not.toContain('organization');
  });

  it('attaches only the target object types when loading port-entry bundle', () => {
    const { container } = render(<CreateAssuranceSetView />);
    setupStep1(container);
    clickNext();

    const bundleBtn = container.querySelector('#btn-load-port-entry-bundle') as HTMLButtonElement;
    expect(bundleBtn).not.toBeNull();
    fireEvent.click(bundleBtn);

    const rowIds = objectRowIds(container);
    expect(rowIds).toContain('OBJ-PROC-PORT-01');
    expect(rowIds).toContain('OBJ-METH-TOW-01');
    expect(rowIds).not.toContain('OBJ-DOC-CLR-01');
    expect(rowIds).not.toContain('OBJ-ORG-PPA-01');

    const badges = Array.from(container.querySelectorAll('[data-testid^="assurance-object-row-"] td:first-child span.badge'))
      .map((b) => b.textContent?.trim().toLowerCase());

    const validTypes = new Set(['vessel', 'person', 'equipment', 'activity']);
    for (const badge of badges) {
      expect(validTypes.has(badge || '')).toBe(true);
      expect(badge).not.toBe('procedure');
      expect(badge).not.toBe('method');
      expect(badge).not.toBe('document');
      expect(badge).not.toBe('organization');
    }
  });

  it('shows one Activities section in Step 3 when an activity is attached', () => {
    const { container } = render(<CreateAssuranceSetView />);
    setupStep1(container);
    clickNext();

    const bundleBtn = container.querySelector('#btn-load-port-entry-bundle') as HTMLButtonElement;
    expect(bundleBtn).not.toBeNull();
    fireEvent.click(bundleBtn);

    clickNext();

    expect(container.querySelector('[data-testid="section-object-activity"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="section-object-procedure"]')).toBeNull();
    expect(container.querySelector('[data-testid="section-object-method"]')).toBeNull();
  });

  it('renders grid-add-object-type, grid-add-object-item, and grid-pick-crew-group once without duplicated objects block', () => {
    const { container } = render(<CreateAssuranceSetView />);
    setupStep1(container);
    clickNext();

    const removeBtn1 = container.querySelector('[data-testid^="assurance-object-row-"] button[title="Remove object"]') as HTMLButtonElement | null;
    if (removeBtn1) fireEvent.click(removeBtn1);

    expect(container.querySelectorAll('#grid-add-object-type')).toHaveLength(1);
    expect(container.querySelectorAll('#grid-add-object-item')).toHaveLength(1);

    const emptyStates = Array.from(container.querySelectorAll('.text-muted.small'))
      .filter((el) => el.textContent?.includes('No assurance objects attached yet.'));
    expect(emptyStates).toHaveLength(1);

    expect(container.textContent).toContain('Your own vessels are not listed. You become the client of the vessel you select.');

    const typeSelect = container.querySelector('#grid-add-object-type') as HTMLSelectElement;
    fireEvent.change(typeSelect, { target: { value: 'person' } });
    expect(container.querySelectorAll('#grid-pick-crew-group')).toHaveLength(1);
  });

  it('renders a single objects table and adding an object adds one row', () => {
    const { container } = render(<CreateAssuranceSetView />);
    setupStep1(container);
    clickNext();

    const removeBtn2 = container.querySelector('[data-testid^="assurance-object-row-"] button[title="Remove object"]') as HTMLButtonElement | null;
    if (removeBtn2) fireEvent.click(removeBtn2);

    expect(container.querySelectorAll('[data-testid^="assurance-object-row-"]')).toHaveLength(0);

    const input = container.querySelector('#grid-add-object-item') as HTMLInputElement;
    fireEvent.focus(input);
    const firstOption = container.querySelector('#grid-add-object-item-listbox [data-item-id]') as HTMLElement;
    expect(firstOption).not.toBeNull();
    fireEvent.click(firstOption);

    expect(container.querySelectorAll('table')).toHaveLength(1);
    expect(container.querySelectorAll('[data-testid^="assurance-object-row-"]')).toHaveLength(1);
  });

  it('offers SS-01 to SS-05 starting templates in Step 1 and selecting SS-04 Bunkering pre-fills scope and pre-checks bunkering requirements in Step 3', () => {
    const { container } = render(<CreateAssuranceSetView />);

    const pilotCard = container.querySelector('[data-testid="step1-pilot-templates"]');
    expect(pilotCard).not.toBeNull();

    const templateIds = ['tmpl-pub-ss01', 'tmpl-pub-ss02', 'tmpl-pub-ss03', 'tmpl-pub-ss04', 'tmpl-pub-ss05'];
    for (const id of templateIds) {
      expect(container.querySelector(`[data-testid="pilot-template-${id}"]`)).not.toBeNull();
    }

    const ss04Btn = container.querySelector('[data-testid="pilot-template-tmpl-pub-ss04"]') as HTMLButtonElement;
    expect(ss04Btn).not.toBeNull();
    fireEvent.click(ss04Btn);

    const titleInput = container.querySelector('#grid-campaign-title') as HTMLInputElement;
    expect(titleInput.value).toContain('SS-04 Bunkering / Fuel Supply');

    setupStep1(container);
    clickNext();

    const vesselRows = container.querySelectorAll('[data-testid^="assurance-object-row-"]');
    expect(vesselRows.length).toBeGreaterThanOrEqual(1);

    clickNext();

    const vesselSelect = container.querySelector('#template-select-Vessel') as HTMLSelectElement;
    expect(vesselSelect).not.toBeNull();
    expect(vesselSelect.value).toBe('tmpl-pub-ss04');

    const docsList = container.querySelector('[data-testid="docs-list-vessel"]');
    expect(docsList).not.toBeNull();
    expect(docsList?.textContent).toContain('Bunker barge crew competency certificates');
    expect(docsList?.textContent).toContain('Fuel certificate of analysis (ISO 8217)');
    expect(docsList?.textContent).toContain('Bunker Delivery Note and MARPOL sample record');
  });
});
