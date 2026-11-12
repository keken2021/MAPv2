import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { CreateAssuranceSetView } from '../views/CreateAssuranceSetView';
import { clickNext, pickReviewerRoles, renderWizardWithDefaultVessel } from './assuranceWizardTestHelpers';

const initialState = useMapStore.getState();

describe('Task 5353: Requirements Declutter - Compact Rows', () => {
  beforeEach(() => {
    useMapStore.setState(initialState, true);
    useMapStore.setState({
      isAuthenticated: true,
      activePersona: 'Administrator',
      activeDemoOrganization: 'Marine Assurance Platform',
      activeSessionUserId: 'USR-MAP-ADMIN',
      users: [
        ...initialState.users,
        {
          id: 'USR-MAP-ADMIN',
          name: 'M. Platform',
          email: 'admin@marineassurance.io',
          roles: ['Administrator'],
          userType: 'Organization',
          organization: 'Marine Assurance Platform',
          departmentOrScope: 'Operations',
          status: 'Active',
          lastActive: '2026-10-29 08:00 UTC',
        },
      ],
      tenantCustomSections: [],
    });
  });

  const setupWizardAtRequirementsStep = () => {
    const rendered = renderWizardWithDefaultVessel();
    pickReviewerRoles(rendered.container);
    // Step 1 -> Step 2
    clickNext();
    // Step 2 -> Step 3
    clickNext();
    return rendered;
  };

  it('renders organization requirement rows as compact single line with title, toggle and remove, without badges or description', () => {
    const { container } = setupWizardAtRequirementsStep();

    const ismRow = container.querySelector('[data-testid="general-doc-row-gen-doc-ism"]');
    expect(ismRow).not.toBeNull();

    // Verify title is rendered
    expect(ismRow?.textContent).toContain('Company ISM Document of Compliance (DOC)');

    // Verify toggle switch exists and is checked
    const toggle = ismRow?.querySelector('#gen-req-toggle-gen-doc-ism') as HTMLInputElement;
    expect(toggle).not.toBeNull();
    expect(toggle.checked).toBe(true);

    // Verify remove button exists with proper aria-label
    const removeBtn = ismRow?.querySelector('button[aria-label="Remove Company ISM Document of Compliance (DOC)"]');
    expect(removeBtn).not.toBeNull();

    // Verify badges (code badge, Assigned badge) and description are NOT present
    expect(ismRow?.querySelector('.badge')).toBeNull();
    expect(ismRow?.textContent).not.toContain('Assigned:');
    expect(ismRow?.textContent).not.toContain('Document of Compliance issued to the operating company');
  });

  it('renders standard object requirement rows with title, toggle, and remove button', () => {
    const { container } = setupWizardAtRequirementsStep();

    const classCertRow = container.querySelector('[data-testid="requirement-row-vessel-class-cert"]');
    expect(classCertRow).not.toBeNull();

    expect(classCertRow?.textContent).toContain('Certificate of Class');

    const toggle = classCertRow?.querySelector('#req-toggle-vessel-class-cert') as HTMLInputElement;
    expect(toggle).not.toBeNull();
    expect(toggle.checked).toBe(true);

    const removeBtn = classCertRow?.querySelector('button[aria-label="Remove Certificate of Class"]');
    expect(removeBtn).not.toBeNull();

    // Verify no badge on the requirement row header
    const rowHeader = classCertRow?.firstElementChild;
    expect(rowHeader?.querySelector('.badge')).toBeNull();
  });

  it('renders specialized / other document rows as compact single line without Custom or Other Document badges', () => {
    const { container } = setupWizardAtRequirementsStep();

    // Add an other document under Statutory Certificate
    const addOtherBtn = container.querySelector('[data-testid^="btn-add-other-doc-vessel"]') as HTMLButtonElement;
    expect(addOtherBtn).not.toBeNull();
    fireEvent.click(addOtherBtn);

    // Find the newly added specialized requirement row
    const specializedRows = container.querySelectorAll('[data-testid^="requirement-row-custom-doc-"]');
    expect(specializedRows.length).toBeGreaterThan(0);

    const newRow = specializedRows[specializedRows.length - 1];
    expect(newRow.textContent).toContain('Other Statutory Certificate Document');

    const rowHeader = newRow.firstElementChild;
    expect(rowHeader?.querySelector('.badge')).toBeNull();
    expect(newRow.textContent).not.toContain('Other Document');
    expect(newRow.textContent).not.toContain('Custom');

    // Has toggle and remove button
    const toggle = newRow.querySelector('input[type="checkbox"][id^="req-toggle-"]') as HTMLInputElement;
    expect(toggle).not.toBeNull();
    const removeBtn = newRow.querySelector('button[aria-label^="Remove "]');
    expect(removeBtn).not.toBeNull();
  });

  it('renders custom section requirement rows as compact single line without badges', () => {
    const { container } = setupWizardAtRequirementsStep();

    // Create a tenant custom section
    const createSecBtn = container.querySelector('[data-testid="btn-create-custom-section"]') as HTMLButtonElement;
    expect(createSecBtn).not.toBeNull();
    fireEvent.click(createSecBtn);

    const nameInput = container.querySelector('[data-testid="input-custom-section-name"]') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Site Induction' } });
    const saveSecBtn = container.querySelector('[data-testid="btn-save-custom-section"]') as HTMLButtonElement;
    fireEvent.click(saveSecBtn);

    // Add a document to the custom section
    const customSection = container.querySelector('[data-testid^="section-custom-sec-tenant-"]');
    expect(customSection).not.toBeNull();
    const addDocBtn = customSection?.querySelector('[data-testid^="btn-add-doc-to-section-"]') as HTMLButtonElement;
    expect(addDocBtn).not.toBeNull();
    fireEvent.click(addDocBtn);

    // Check requirement row inside custom section
    const customDocRow = customSection?.querySelector('[data-testid^="requirement-row-custom-doc-sec-"]');
    expect(customDocRow).not.toBeNull();
    expect(customDocRow?.textContent).toContain('Custom Requirement 1');

    const rowHeader = customDocRow?.firstElementChild;
    expect(rowHeader?.querySelector('.badge')).toBeNull();
    expect(customDocRow?.querySelector('.badge')).toBeNull();

    const toggle = customDocRow?.querySelector('input[type="checkbox"][id^="req-toggle-"]') as HTMLInputElement;
    expect(toggle).not.toBeNull();
    const removeBtn = customDocRow?.querySelector('button[aria-label^="Remove "]');
    expect(removeBtn).not.toBeNull();
  });

  it('toggles requirement between Required and Optional across organization, standard, and custom rows', () => {
    const { container } = setupWizardAtRequirementsStep();

    // 1. Organization doc toggle
    const genToggle = container.querySelector('#gen-req-toggle-gen-doc-ism') as HTMLInputElement;
    expect(genToggle.checked).toBe(true);
    expect(container.querySelector('label[for="gen-req-toggle-gen-doc-ism"]')?.textContent?.trim()).toBe('Required');

    fireEvent.click(genToggle);
    expect(genToggle.checked).toBe(false);
    expect(container.querySelector('label[for="gen-req-toggle-gen-doc-ism"]')?.textContent?.trim()).toBe('Optional');

    fireEvent.click(genToggle);
    expect(genToggle.checked).toBe(true);
    expect(container.querySelector('label[for="gen-req-toggle-gen-doc-ism"]')?.textContent?.trim()).toBe('Required');

    // 2. Standard doc toggle
    const stdToggle = container.querySelector('#req-toggle-vessel-class-cert') as HTMLInputElement;
    expect(stdToggle.checked).toBe(true);
    expect(container.querySelector('label[for="req-toggle-vessel-class-cert"]')?.textContent?.trim()).toBe('Required');

    fireEvent.click(stdToggle);
    expect(stdToggle.checked).toBe(false);
    expect(container.querySelector('label[for="req-toggle-vessel-class-cert"]')?.textContent?.trim()).toBe('Optional');

    // 3. Custom / Other doc toggle
    const addOtherBtn = container.querySelector('[data-testid^="btn-add-other-doc-vessel"]') as HTMLButtonElement;
    fireEvent.click(addOtherBtn);
    const specializedRow = container.querySelector('[data-testid^="requirement-row-custom-doc-"]');
    const specToggle = specializedRow?.querySelector('input[type="checkbox"][id^="req-toggle-"]') as HTMLInputElement;
    expect(specToggle.checked).toBe(true);

    fireEvent.click(specToggle);
    expect(specToggle.checked).toBe(false);
  });

  it('removes requirement row when remove button is clicked across organization, standard, and custom rows', () => {
    const { container } = setupWizardAtRequirementsStep();

    // 1. Remove organization doc
    expect(container.querySelector('[data-testid="general-doc-row-gen-doc-msa"]')).not.toBeNull();
    const removeGenBtn = container.querySelector('button[aria-label="Remove Master Service Agreement (MSA)"]') as HTMLButtonElement;
    fireEvent.click(removeGenBtn);
    expect(container.querySelector('[data-testid="general-doc-row-gen-doc-msa"]')).toBeNull();

    // 2. Remove standard doc
    expect(container.querySelector('[data-testid="requirement-row-vessel-class-cert"]')).not.toBeNull();
    const removeStdBtn = container.querySelector('button[aria-label="Remove Certificate of Class"]') as HTMLButtonElement;
    fireEvent.click(removeStdBtn);
    expect(container.querySelector('[data-testid="requirement-row-vessel-class-cert"]')).toBeNull();

    // 3. Remove specialized doc
    const addOtherBtn = container.querySelector('[data-testid^="btn-add-other-doc-vessel"]') as HTMLButtonElement;
    fireEvent.click(addOtherBtn);
    const specRow = container.querySelector('[data-testid^="requirement-row-custom-doc-"]');
    expect(specRow).not.toBeNull();
    const removeSpecBtn = specRow?.querySelector('button[aria-label^="Remove "]') as HTMLButtonElement;
    fireEvent.click(removeSpecBtn);
    expect(container.querySelector('[data-testid^="requirement-row-custom-doc-"]')).toBeNull();
  });
});
