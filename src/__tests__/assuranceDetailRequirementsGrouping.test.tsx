import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { AssuranceDetailView } from '../views/AssuranceDetailView';
import { AssuranceSet } from '../types/assurance';

const initialState = useMapStore.getState();

describe('AssuranceDetailView Requirements Tab Step 3 Grouping (Findings 5d-01, 5d-02, 5d-03)', () => {
  beforeEach(() => {
    useMapStore.setState(initialState, true);
    useMapStore.setState({
      isAuthenticated: true,
      activePersona: 'Administrator',
      activeDemoOrganization: 'Marine Assurance Platform',
    });
  });

  it('5d-01: groups requirements like Step 3 with General documents first, then object type, then sub-type', () => {
    const testSetId = 'AS-TEST-STEP3-GROUPING';
    const testSet: AssuranceSet = {
      ...initialState.assuranceSets[0],
      id: testSetId,
      title: 'Step 3 Grouping Test Set',
      sections: [
        { id: 'sec-general', name: 'General documents', order: 1 },
        { id: 'sec-vessel', name: 'Vessel documents', order: 2 },
        { id: 'sec-crew', name: 'Crew documents', order: 3 },
      ],
      requirements: [
        {
          id: 'REQ-CREW-01',
          title: 'Master Certificate of Competency',
          category: 'Certificate of Competency (CoC)',
          subtype: 'Crew',
          sectionId: 'sec-crew',
          isMandatory: true,
          isFulfilled: false,
          ocrConfidence: 90,
          verifierStatus: 'Pending',
        },
        {
          id: 'REQ-GEN-01',
          title: 'Company ISM Document of Compliance (DOC)',
          category: 'Statutory Certificate',
          sectionId: 'sec-general',
          isMandatory: true,
          isFulfilled: false,
          ocrConfidence: 95,
          verifierStatus: 'Pending',
        },
        {
          id: 'REQ-VESSEL-01',
          title: 'Certificate of Registry',
          category: 'Statutory Certificate',
          subtype: 'Vessel',
          sectionId: 'sec-vessel',
          isMandatory: true,
          isFulfilled: false,
          ocrConfidence: 92,
          verifierStatus: 'Pending',
        },
        {
          id: 'REQ-VESSEL-02',
          title: 'Hull & Machinery Classification Certificate',
          category: 'Class Notation Certificate',
          subtype: 'Vessel',
          sectionId: 'sec-vessel',
          isMandatory: true,
          isFulfilled: false,
          ocrConfidence: 88,
          verifierStatus: 'Pending',
        },
      ],
    };

    useMapStore.setState({
      assuranceSets: [testSet, ...initialState.assuranceSets],
    });

    const { container } = render(<AssuranceDetailView setId={testSetId} />);

    // Switch to Requirements tab
    fireEvent.click(screen.getByRole('tab', { name: /requirements/i }));

    // Verify section group headers exist
    const sectionHeaders = container.querySelectorAll('[data-testid="section-group-header"]');
    expect(sectionHeaders.length).toBe(3);

    // Order: General documents first, then Vessel documents, then Crew documents
    expect(sectionHeaders[0].textContent?.trim()).toBe('General documents');
    expect(sectionHeaders[1].textContent?.trim()).toBe('Vessel documents');
    expect(sectionHeaders[2].textContent?.trim()).toBe('Crew documents');

    // Verify sub-type group headers exist under object type sections
    const subtypeHeaders = container.querySelectorAll('[data-testid="subtype-group-header"]');
    const subtypeTexts = Array.from(subtypeHeaders).map((el) => el.textContent?.trim());
    expect(subtypeTexts).toContain('Statutory Certificate');
    expect(subtypeTexts).toContain('Class Notation Certificate');
    expect(subtypeTexts).toContain('Certificate of Competency (CoC)');

    // Verify requirements appear under their corresponding headers
    const table = screen.getByRole('table');
    expect(within(table).getByText('Company ISM Document of Compliance (DOC)')).toBeInTheDocument();
    expect(within(table).getByText('Certificate of Registry')).toBeInTheDocument();
    expect(within(table).getByText('Hull & Machinery Classification Certificate')).toBeInTheDocument();
    expect(within(table).getByText('Master Certificate of Competency')).toBeInTheDocument();

    // Verify NO "People", "Plant", "Process", or "Other Documents" group headers exist
    expect(screen.queryByText('People', { selector: '[data-testid="section-group-header"]' })).toBeNull();
    expect(screen.queryByText('Plant', { selector: '[data-testid="section-group-header"]' })).toBeNull();
    expect(screen.queryByText('Process', { selector: '[data-testid="section-group-header"]' })).toBeNull();
    expect(screen.queryByText('Other Documents', { selector: '[data-testid="section-group-header"]' })).toBeNull();
  });

  it('5d-02: displays edited section titles and custom tenant sections as their own groups', () => {
    const testSetId = 'AS-TEST-CUSTOM-EDITED-SECTIONS';
    const testSet: AssuranceSet = {
      ...initialState.assuranceSets[0],
      id: testSetId,
      title: 'Edited and Custom Sections Test Set',
      sections: [
        { id: 'sec-general', name: 'Corporate Compliance Requirements', order: 1 },
        { id: 'sec-vessel', name: 'Main Fleet Vessel Compliance', order: 2 },
        { id: 'sec-tenant-berth', name: 'Berth Clearance', order: 3 },
      ],
      requirements: [
        {
          id: 'REQ-GEN-01',
          title: 'Master Service Agreement (MSA)',
          category: 'Statutory Certificate',
          sectionId: 'sec-general',
          isMandatory: true,
          isFulfilled: false,
          ocrConfidence: 90,
          verifierStatus: 'Pending',
        },
        {
          id: 'REQ-VESSEL-01',
          title: 'Safety Equipment Certificate',
          category: 'Safety & Lifesaving Equipment',
          subtype: 'Vessel',
          sectionId: 'sec-vessel',
          isMandatory: true,
          isFulfilled: false,
          ocrConfidence: 94,
          verifierStatus: 'Pending',
        },
        {
          id: 'REQ-CUSTOM-01',
          title: 'Berth Mooring Analysis',
          category: 'Custom Requirement',
          sectionId: 'sec-tenant-berth',
          isMandatory: true,
          isSpecialized: true,
          isFulfilled: false,
          ocrConfidence: 85,
          verifierStatus: 'Pending',
        },
      ],
    };

    useMapStore.setState({
      assuranceSets: [testSet, ...initialState.assuranceSets],
    });

    const { container } = render(<AssuranceDetailView setId={testSetId} />);

    // Switch to Requirements tab
    fireEvent.click(screen.getByRole('tab', { name: /requirements/i }));

    // Verify section group headers match edited titles and custom section
    const sectionHeaders = container.querySelectorAll('[data-testid="section-group-header"]');
    expect(sectionHeaders.length).toBe(3);
    expect(sectionHeaders[0].textContent?.trim()).toBe('Corporate Compliance Requirements');
    expect(sectionHeaders[1].textContent?.trim()).toBe('Main Fleet Vessel Compliance');
    expect(sectionHeaders[2].textContent?.trim()).toBe('Berth Clearance');

    // Verify custom requirement appears in Berth Clearance section
    expect(screen.getByText('Berth Mooring Analysis')).toBeInTheDocument();
  });

  it('5d-03: shows other documents in their sub-type group, marked as added by the client', () => {
    const testSetId = 'AS-TEST-OTHER-DOCUMENTS';
    const testSet: AssuranceSet = {
      ...initialState.assuranceSets[0],
      id: testSetId,
      title: 'Other Documents Test Set',
      sections: [
        { id: 'sec-vessel', name: 'Vessel documents', order: 1 },
      ],
      requirements: [
        {
          id: 'REQ-STD-01',
          title: 'Cargo Ship Safety Construction Certificate',
          category: 'Statutory Certificate',
          subtype: 'Vessel',
          sectionId: 'sec-vessel',
          isMandatory: true,
          isFulfilled: false,
          ocrConfidence: 96,
          verifierStatus: 'Pending',
        },
        {
          id: 'REQ-OTHER-01',
          title: 'Specialized Port State Inspection Waiver',
          category: 'Statutory Certificate',
          subtype: 'Vessel',
          sectionId: 'sec-vessel',
          isMandatory: false,
          isSpecialized: true,
          isOtherDocument: true,
          isFulfilled: false,
          ocrConfidence: 0,
          verifierStatus: 'Pending',
        },
      ],
    };

    useMapStore.setState({
      assuranceSets: [testSet, ...initialState.assuranceSets],
    });

    const { container } = render(<AssuranceDetailView setId={testSetId} />);

    // Switch to Requirements tab
    fireEvent.click(screen.getByRole('tab', { name: /requirements/i }));

    // Verify both requirements appear under Statutory Certificate sub-type
    expect(screen.getByText('Statutory Certificate')).toBeInTheDocument();
    expect(screen.getByText('Cargo Ship Safety Construction Certificate')).toBeInTheDocument();
    expect(screen.getByText('Specialized Port State Inspection Waiver')).toBeInTheDocument();

    // Verify other document has "Added by client" badge
    const otherDocBadge = container.querySelector('[data-testid="badge-other-doc-REQ-OTHER-01"]');
    expect(otherDocBadge).not.toBeNull();
    expect(otherDocBadge?.textContent).toBe('Added by client');

    // Verify other document does NOT get segregated into a separate "Other Documents" section
    expect(screen.queryByText('Other Documents')).toBeNull();
  });
});
