import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { CreateAssuranceSetView } from '../views/CreateAssuranceSetView';
import { clickNext, pickReviewerRoles } from './assuranceWizardTestHelpers';

const initialState = useMapStore.getState();

describe('Task 5354: Requirements Declutter - Flat List per Type (Layout A)', () => {
  beforeEach(() => {
    useMapStore.setState(initialState, true);
    useMapStore.setState({
      isAuthenticated: true,
      activePersona: 'Administrator',
      activeDemoOrganization: 'Marine Assurance Platform',
      tenantCustomSections: [],
    });
  });

  const setupWizardAtRequirementsStep = () => {
    const rendered = render(<CreateAssuranceSetView />);
    pickReviewerRoles(rendered.container);
    // Step 1 -> Step 2
    clickNext();
    // Step 2 -> Step 3
    clickNext();
    return rendered;
  };

  it('renders each object type with one line containing template select and document count', () => {
    const { container } = setupWizardAtRequirementsStep();

    const templateLine = container.querySelector('[data-testid="template-line-vessel"]');
    expect(templateLine).not.toBeNull();

    const select = templateLine?.querySelector('#template-select-Vessel') as HTMLSelectElement;
    expect(select).not.toBeNull();
    expect(select.tagName.toLowerCase()).toBe('select');

    const count = templateLine?.querySelector('[data-testid="docs-count-vessel"]');
    expect(count).not.toBeNull();
    expect(count?.textContent).toMatch(/\d+ documents/);
  });

  it('renders searchable document picker directly under the template line', () => {
    const { container } = setupWizardAtRequirementsStep();

    const vesselSection = container.querySelector('[data-testid="section-object-vessel"]');
    expect(vesselSection).not.toBeNull();

    const searchInput = vesselSection?.querySelector('#search-docs-Vessel');
    expect(searchInput).not.toBeNull();
  });

  it('renders every document in one flat list with no category accordions', () => {
    const { container } = setupWizardAtRequirementsStep();

    const vesselSection = container.querySelector('[data-testid="section-object-vessel"]');
    expect(vesselSection).not.toBeNull();

    // Verify category accordions are NOT present
    const accordions = vesselSection?.querySelectorAll('[data-testid^="subtype-accordion-"]');
    expect(accordions?.length ?? 0).toBe(0);

    // Verify flat list container exists
    const docsList = vesselSection?.querySelector('[data-testid="docs-list-vessel"]');
    expect(docsList).not.toBeNull();

    // Verify individual requirement rows are rendered directly in the flat list
    const reqRows = docsList?.querySelectorAll('[data-testid^="requirement-row-"]');
    expect(reqRows?.length).toBeGreaterThan(5);

    // Check sample standard vessel documents are present in the flat list
    expect(docsList?.textContent).toContain('Certificate of Class');
    expect(docsList?.textContent).toContain('Cargo Ship Safety Certificate (SOLAS Combined)');
  });

  it('renders a single Add other document button at the bottom of the flat list', () => {
    const { container } = setupWizardAtRequirementsStep();

    const vesselSection = container.querySelector('[data-testid="section-object-vessel"]');
    expect(vesselSection).not.toBeNull();

    // Exactly one Add other document button in the vessel section
    const addOtherBtn = vesselSection?.querySelector('[data-testid="btn-add-other-doc-vessel"]') as HTMLButtonElement;
    expect(addOtherBtn).not.toBeNull();
    expect(addOtherBtn.textContent).toContain('Add other document');

    // Click it to add an other document
    fireEvent.click(addOtherBtn);

    const docsList = vesselSection?.querySelector('[data-testid="docs-list-vessel"]');
    expect(docsList?.textContent).toContain('Other Statutory Certificate Document');
  });

  it('allows selecting a template to update the active requirements and count', () => {
    const { container } = setupWizardAtRequirementsStep();

    const select = container.querySelector('#template-select-Vessel') as HTMLSelectElement;
    expect(select).not.toBeNull();

    // Find a template option
    const options = Array.from(select.querySelectorAll('option')).filter((o) => o.value !== '');
    expect(options.length).toBeGreaterThan(0);

    const templateToSelect = options[0].value;
    fireEvent.change(select, { target: { value: templateToSelect } });

    expect(select.value).toBe(templateToSelect);

    // Verify Clear button is shown
    const clearBtn = container.querySelector('[data-testid="template-line-vessel"] button[title="Clear template"]');
    expect(clearBtn).not.toBeNull();

    // Click Clear
    fireEvent.click(clearBtn!);
    expect(select.value).toBe('');
  });

  it('removes repeated badge, paragraph, and inner header from the organization block', () => {
    const { container } = setupWizardAtRequirementsStep();

    const generalSection = container.querySelector('[data-testid="section-general-documents"]');
    expect(generalSection).not.toBeNull();

    // No repeated badge (e.g. "Organization-wide docs")
    expect(generalSection?.textContent).not.toContain('Organization-wide docs');
    expect(generalSection?.textContent).not.toContain('Organization-wide doc');

    // No descriptive paragraph
    expect(generalSection?.textContent).not.toContain('Organization-wide files (DOC, NDA, MSA)');

    // No inner card header
    const innerHeader = generalSection?.querySelector('.card .card-header');
    expect(innerHeader).toBeNull();

    // Documents list is directly in the card body
    const docsList = generalSection?.querySelector('[data-testid="general-docs-list"]');
    expect(docsList).not.toBeNull();
    expect(docsList?.textContent).toContain('Company ISM Document of Compliance (DOC)');
  });

  it('removes repeated badge, paragraph, and inner header from custom sections', () => {
    const { container } = setupWizardAtRequirementsStep();

    // Create a tenant custom section
    const createSecBtn = container.querySelector('[data-testid="btn-create-custom-section"]') as HTMLButtonElement;
    fireEvent.click(createSecBtn);

    const nameInput = container.querySelector('[data-testid="input-custom-section-name"]') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Bunkering Clearance' } });
    const descInput = container.querySelector('[data-testid="input-custom-section-description"]') as HTMLInputElement;
    fireEvent.change(descInput, { target: { value: 'Bunkering safety checks' } });
    const saveSecBtn = container.querySelector('[data-testid="btn-save-custom-section"]') as HTMLButtonElement;
    fireEvent.click(saveSecBtn);

    const customSection = container.querySelector('[data-testid^="section-custom-sec-tenant-"]');
    expect(customSection).not.toBeNull();

    // No repeated badge (e.g. "Tenant Section")
    expect(customSection?.textContent).not.toContain('Tenant Section');

    // No inner card header
    const innerHeader = customSection?.querySelector('.card .card-header');
    expect(innerHeader).toBeNull();

    // Card body directly renders custom-section-body
    const body = customSection?.querySelector('[data-testid^="custom-section-body-"]');
    expect(body).not.toBeNull();
  });
});
