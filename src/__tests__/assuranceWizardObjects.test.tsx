import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { CreateAssuranceSetView } from '../views/CreateAssuranceSetView';
import { clickNext, objectRowIds } from './assuranceWizardTestHelpers';

describe('CreateAssuranceSetView Objects Step', () => {
  beforeEach(() => {
    useMapStore.setState({
      isAuthenticated: true,
      activePersona: 'Administrator',
      activeDemoOrganization: 'Marine Assurance Platform',
    });
  });

  it('offers only the 5 canonical target object types in #grid-add-object-type', () => {
    const { container } = render(<CreateAssuranceSetView />);
    clickNext();

    const typeSelect = container.querySelector('#grid-add-object-type') as HTMLSelectElement;
    expect(typeSelect).not.toBeNull();

    const optionValues = Array.from(typeSelect.options).map((opt) => opt.value);
    expect(optionValues).toEqual(['vessel', 'person', 'equipment', 'procedure', 'method']);

    const optionLabels = Array.from(typeSelect.options).map((opt) => opt.text.trim());
    expect(optionLabels).toEqual(['Vessel', 'Person / Crew', 'Equipment', 'Procedure', 'Method']);

    expect(optionValues).not.toContain('document');
    expect(optionValues).not.toContain('organization');
  });

  it('attaches only the 5 target object types when loading port-entry bundle', () => {
    const { container } = render(<CreateAssuranceSetView />);
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

    const validTypes = new Set(['vessel', 'person', 'equipment', 'procedure', 'method']);
    for (const badge of badges) {
      expect(validTypes.has(badge || '')).toBe(true);
      expect(badge).not.toBe('document');
      expect(badge).not.toBe('organization');
    }
  });
});
