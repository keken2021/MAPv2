import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { CreateAssuranceSetView } from '../views/CreateAssuranceSetView';
import { clickNext, addObject } from './assuranceWizardTestHelpers';

describe('CreateAssuranceSetView Requirements Step (Step 3)', () => {
  beforeEach(() => {
    useMapStore.setState({
      assuranceSets: [],
      isAuthenticated: true,
      activePersona: 'Administrator',
      activeDemoOrganization: 'Marine Assurance Platform',
      tenantCustomSections: [],
    });
  });

  it('renders General documents as the first pinned section before object type sections with no blank sections on load', () => {
    const { container } = render(<CreateAssuranceSetView />);
    // Step 1 -> Step 2
    clickNext();
    // Step 2 -> Step 3
    clickNext();

    // Verify Step 3 heading and pinned section
    const generalSection = container.querySelector('[data-testid="section-general-documents"]');
    expect(generalSection).not.toBeNull();
    expect(generalSection?.textContent).toContain('General documents');
    expect(generalSection?.textContent).toContain('Pinned');

    // Verify organization-wide files (DOC, NDA, MSA) exist in General documents
    expect(generalSection?.textContent).toContain('Document of Compliance (DOC)');
    expect(generalSection?.textContent).toContain('Non-Disclosure Agreement (NDA)');
    expect(generalSection?.textContent).toContain('Master Service Agreement (MSA)');

    // Verify assigned to organizations, not an asset
    expect(generalSection?.textContent).toContain('Assigned:');
    expect(generalSection?.textContent).not.toContain('VESSEL-');

    // Verify General documents section appears before object type sections
    const objectSections = container.querySelectorAll('section[data-testid^="section-object-"]');
    expect(objectSections.length).toBeGreaterThan(0);

    const allSections = Array.from(container.querySelectorAll('section[data-testid]'));
    const sectionTestIds = allSections.map((s) => s.getAttribute('data-testid'));
    expect(sectionTestIds[0]).toBe('section-general-documents');

    // Verify no blank, empty or unnamed section rendered on load
    expect(allSections.length).toBe(1 + objectSections.length);
    allSections.forEach((sec) => {
      const heading = sec.querySelector('h4, [data-testid^="section-title"]');
      expect(heading?.textContent?.trim()).toBeTruthy();
      expect(sec.textContent?.trim().length).toBeGreaterThan(10);
    });
  });

  it('nests requirements under object type with sub-type accordions', () => {
    const { container } = render(<CreateAssuranceSetView />);
    clickNext();
    clickNext();

    const vesselSection = container.querySelector('[data-testid="section-object-vessel"]');
    expect(vesselSection).not.toBeNull();
    expect(vesselSection?.textContent).toContain('Vessel documents');

    // Verify sub-type accordions under Vessel
    const statutoryAccordion = container.querySelector('[data-testid="subtype-accordion-vessel-statutory-certificate"]');
    expect(statutoryAccordion).not.toBeNull();
    expect(statutoryAccordion?.textContent).toContain('Statutory Certificate');

    const classAccordion = container.querySelector('[data-testid="subtype-accordion-vessel-class-notation-certificate"]');
    expect(classAccordion).not.toBeNull();
    expect(classAccordion?.textContent).toContain('Class Notation Certificate');

    const envAccordion = container.querySelector('[data-testid="subtype-accordion-vessel-environmental-certificate"]');
    expect(envAccordion).not.toBeNull();
    expect(envAccordion?.textContent).toContain('Environmental Certificate');

    // Verify accordion header toggles collapse
    const statutoryHeader = container.querySelector('[data-testid="accordion-header-vessel-statutory-certificate"]') as HTMLButtonElement;
    expect(statutoryHeader).not.toBeNull();
    expect(statutoryHeader.getAttribute('aria-expanded')).toBe('true');

    // Click to collapse
    fireEvent.click(statutoryHeader);
    expect(statutoryHeader.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('[data-testid="accordion-body-vessel-statutory-certificate"]')).toBeNull();

    // Click to expand
    fireEvent.click(statutoryHeader);
    expect(statutoryHeader.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('[data-testid="accordion-body-vessel-statutory-certificate"]')).not.toBeNull();

    // Verify Add other document button exists in each accordion
    const addOtherBtn = container.querySelector('[data-testid="btn-add-other-doc-vessel-statutory-certificate"]');
    expect(addOtherBtn).not.toBeNull();
    expect(addOtherBtn?.textContent).toContain('Add other document');
  });

  it('renders sections for each covered object type with their respective sub-type accordions and sentence case titles', () => {
    const { container } = render(<CreateAssuranceSetView />);
    clickNext(); // To Step 2

    // Add a crew member and equipment
    addObject(container, 'person', 'CREW-101');
    addObject(container, 'equipment', 'EQ-001');

    clickNext(); // To Step 3

    // Section 1: General documents
    const generalSection = container.querySelector('[data-testid="section-general-documents"]');
    expect(generalSection).not.toBeNull();
    expect(generalSection?.textContent).toContain('General documents');

    // Section 2: Vessel documents
    const vesselSection = container.querySelector('[data-testid="section-object-vessel"]');
    expect(vesselSection).not.toBeNull();
    expect(vesselSection?.textContent).toContain('Vessel documents');

    // Section 3: Crew directory documents in sentence case
    const crewSection = container.querySelector('[data-testid="section-object-crew"]');
    expect(crewSection).not.toBeNull();
    expect(crewSection?.textContent).toContain('Crew directory documents');
    expect(container.querySelector('[data-testid="subtype-accordion-crew-crew-credential"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="subtype-accordion-crew-medical-fitness-certificate"]')).not.toBeNull();

    // Section 4: Equipment documents in sentence case
    const equipSection = container.querySelector('[data-testid="section-object-equipment"]');
    expect(equipSection).not.toBeNull();
    expect(equipSection?.textContent).toContain('Equipment documents');
    expect(container.querySelector('[data-testid="subtype-accordion-equipment-equipment-register"]')).not.toBeNull();
  });

  it('rejects blank section name when adding a custom section', () => {
    const { container } = render(<CreateAssuranceSetView />);
    clickNext();
    clickNext();

    const sectionsBefore = container.querySelectorAll('section[data-testid]');

    // Click "Add custom section"
    const addSectionBtn = (container.querySelector('[data-testid="btn-add-custom-section"]') ||
      container.querySelector('[data-testid="btn-create-custom-section"]')) as HTMLButtonElement;
    expect(addSectionBtn).not.toBeNull();
    fireEvent.click(addSectionBtn);

    // Form appears
    const nameInput = container.querySelector('[data-testid="input-custom-section-name"]') as HTMLInputElement;
    expect(nameInput).not.toBeNull();
    const saveBtn = container.querySelector('[data-testid="btn-save-custom-section"]') as HTMLButtonElement;
    expect(saveBtn).not.toBeNull();

    // Try blank / whitespace name
    fireEvent.change(nameInput, { target: { value: '   ' } });
    expect(saveBtn.disabled).toBe(true);

    // Trigger save attempt
    fireEvent.click(saveBtn);

    // No custom section added
    const sectionsAfter = container.querySelectorAll('section[data-testid]');
    expect(sectionsAfter.length).toBe(sectionsBefore.length);
    expect(container.querySelector('[data-testid^="section-custom-"]')).toBeNull();
  });

  it('adds custom section below defaults, shows title in sentence case, and saves to set sections', () => {
    const { container } = render(<CreateAssuranceSetView />);
    clickNext(); // Step 1 -> Step 2
    clickNext(); // Step 2 -> Step 3

    // Default sections: General and Vessel
    const defaultSections = Array.from(container.querySelectorAll('section[data-testid]'));
    expect(defaultSections.length).toBe(2);
    expect(defaultSections[0].getAttribute('data-testid')).toBe('section-general-documents');
    expect(defaultSections[1].getAttribute('data-testid')).toBe('section-object-vessel');

    // Add custom section
    const addSectionBtn = (container.querySelector('[data-testid="btn-add-custom-section"]') ||
      container.querySelector('[data-testid="btn-create-custom-section"]')) as HTMLButtonElement;
    fireEvent.click(addSectionBtn);

    const nameInput = container.querySelector('[data-testid="input-custom-section-name"]') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Navigational equipment' } });

    const saveBtn = container.querySelector('[data-testid="btn-save-custom-section"]') as HTMLButtonElement;
    fireEvent.click(saveBtn);

    // Section appears below the defaults
    const customSection = container.querySelector('[data-testid^="section-custom-"]');
    expect(customSection).not.toBeNull();
    expect(customSection?.textContent).toContain('Navigational equipment');

    // Verify section order: custom section comes after defaults
    const allSections = Array.from(container.querySelectorAll('section[data-testid]'));
    expect(allSections.length).toBe(3);
    expect(allSections[0].getAttribute('data-testid')).toBe('section-general-documents');
    expect(allSections[1].getAttribute('data-testid')).toBe('section-object-vessel');
    expect(allSections[2].getAttribute('data-testid')).toMatch(/^section-custom-/);

    // Step 3 -> Step 4 (Review)
    clickNext();

    // Verify custom section displayed in review
    expect(screen.getByText('Navigational equipment')).toBeInTheDocument();

    // Initiate the assurance set
    const initiateBtn = screen.getByRole('button', { name: /Create Assurance Set/i });
    fireEvent.click(initiateBtn);

    // Verify sections saved on created set
    const assuranceSets = useMapStore.getState().assuranceSets;
    const latestSet = assuranceSets[assuranceSets.length - 1];
    expect(latestSet).toBeDefined();
    expect(latestSet.sections).toBeDefined();

    const sectionNames = latestSet.sections?.map((s) => s.name);
    expect(sectionNames).toContain('General documents');
    expect(sectionNames).toContain('Vessel documents');
    expect(sectionNames).toContain('Navigational equipment');
  });
});
