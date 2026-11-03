import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { CreateAssuranceSetView } from '../views/CreateAssuranceSetView';
import { clickNext, addObject } from './assuranceWizardTestHelpers';

describe('CreateAssuranceSetView Requirements Step (Step 3)', () => {
  beforeEach(() => {
    useMapStore.setState({
      isAuthenticated: true,
      activePersona: 'Administrator',
      activeDemoOrganization: 'Marine Assurance Platform',
    });
  });

  it('renders General documents as the first pinned section before object type sections', () => {
    const { container } = render(<CreateAssuranceSetView />);
    // Step 1 -> Step 2
    clickNext();
    // Step 2 -> Step 3
    clickNext();

    // Verify Step 3 heading
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

  it('renders sections for each covered object type with their respective sub-type accordions', () => {
    const { container } = render(<CreateAssuranceSetView />);
    clickNext(); // To Step 2

    // Add a crew member and equipment
    addObject(container, 'person', 'CREW-101');
    addObject(container, 'equipment', 'EQ-001');

    clickNext(); // To Step 3

    // Section 1: General documents
    const generalSection = container.querySelector('[data-testid="section-general-documents"]');
    expect(generalSection).not.toBeNull();

    // Section 2: Vessel documents
    const vesselSection = container.querySelector('[data-testid="section-object-vessel"]');
    expect(vesselSection).not.toBeNull();

    // Section 3: Crew documents
    const crewSection = container.querySelector('[data-testid="section-object-crew"]');
    expect(crewSection).not.toBeNull();
    expect(crewSection?.textContent).toContain('Crew documents');
    expect(container.querySelector('[data-testid="subtype-accordion-crew-crew-credential"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="subtype-accordion-crew-medical-fitness-certificate"]')).not.toBeNull();

    // Section 4: Equipment documents
    const equipSection = container.querySelector('[data-testid="section-object-equipment"]');
    expect(equipSection).not.toBeNull();
    expect(equipSection?.textContent).toContain('Equipment documents');
    expect(container.querySelector('[data-testid="subtype-accordion-equipment-equipment-register"]')).not.toBeNull();
  });
});
