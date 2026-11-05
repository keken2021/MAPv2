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
});
