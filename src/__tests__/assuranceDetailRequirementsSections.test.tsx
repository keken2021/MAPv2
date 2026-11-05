import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { AssuranceDetailView } from '../views/AssuranceDetailView';
import { AssuranceSet } from '../types/assurance';

const initialState = useMapStore.getState();

describe('AssuranceDetailView Requirements Tab Default and Custom Sections', () => {
  beforeEach(() => {
    useMapStore.setState(initialState, true);
    useMapStore.setState({
      isAuthenticated: true,
      activePersona: 'Administrator',
      activeDemoOrganization: 'Marine Assurance Platform',
    });
  });

  it('renders no blank, empty or unnamed section on load', () => {
    const testSetId = 'AS-TEST-NO-BLANK-SECTIONS';
    const testSet: AssuranceSet = {
      ...initialState.assuranceSets[0],
      id: testSetId,
      title: 'No Blank Sections Test',
      subtypes: ['Vessel'],
      sections: [
        { id: 'sec-general', name: 'General documents', order: 1 },
        { id: 'sec-vessel', name: 'Vessel documents', order: 2 },
        { id: 'sec-blank', name: '   ', order: 99 },
      ],
      requirements: [
        {
          id: 'REQ-GEN-01',
          title: 'Document of Compliance (DOC)',
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
      ],
    };

    useMapStore.setState({
      assuranceSets: [testSet, ...initialState.assuranceSets],
    });

    const { container } = render(<AssuranceDetailView setId={testSetId} initialTab="requirements" />);

    const headers = container.querySelectorAll('[data-testid="section-group-header"]');
    expect(headers.length).toBe(2);

    headers.forEach((h) => {
      const text = h.textContent?.trim();
      expect(text).toBeTruthy();
      expect(text).not.toBe('');
      expect(text).not.toBe('   ');
    });

    expect(screen.queryByTestId('group-section-blank')).toBeNull();
  });

  it('renders sections in default order: pinned General first, then object sections', () => {
    const testSetId = 'AS-TEST-DEFAULT-ORDER';
    const testSet: AssuranceSet = {
      ...initialState.assuranceSets[0],
      id: testSetId,
      title: 'Default Order Test',
      subtypes: ['Vessel', 'Crew'],
      requirements: [
        {
          id: 'REQ-GEN-01',
          title: 'Non-Disclosure Agreement (NDA)',
          category: 'Statutory Certificate',
          sectionId: 'sec-general',
          isMandatory: true,
          isFulfilled: false,
          ocrConfidence: 95,
          verifierStatus: 'Pending',
        },
        {
          id: 'REQ-VESSEL-01',
          title: 'Vessel Certificate',
          category: 'Statutory Certificate',
          subtype: 'Vessel',
          sectionId: 'sec-vessel',
          isMandatory: true,
          isFulfilled: false,
          ocrConfidence: 90,
          verifierStatus: 'Pending',
        },
        {
          id: 'REQ-CREW-01',
          title: 'Crew Medical Fitness',
          category: 'Crew Credential',
          subtype: 'Crew',
          sectionId: 'sec-crew',
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

    const { container } = render(<AssuranceDetailView setId={testSetId} initialTab="requirements" />);

    const headers = container.querySelectorAll('[data-testid="section-group-header"]');
    expect(headers.length).toBe(3);
    expect(headers[0].textContent?.trim()).toBe('General documents');
    expect(headers[1].textContent?.trim()).toBe('Vessel documents');
    expect(headers[2].textContent?.trim()).toBe('Crew directory documents');
  });

  it('displays a custom section saved from the wizard below defaults in sentence case', () => {
    const testSetId = 'AS-TEST-WIZARD-CUSTOM-SECTION';
    const testSet: AssuranceSet = {
      ...initialState.assuranceSets[0],
      id: testSetId,
      title: 'Wizard Custom Section Test',
      subtypes: ['Vessel'],
      sections: [
        { id: 'sec-general', name: 'General documents', order: 1 },
        { id: 'sec-vessel', name: 'Vessel documents', order: 2 },
        { id: 'csec-nav', name: 'Navigational equipment', order: 3 },
      ],
      requirements: [
        {
          id: 'REQ-GEN-01',
          title: 'Master Service Agreement (MSA)',
          category: 'Statutory Certificate',
          sectionId: 'sec-general',
          isMandatory: true,
          isFulfilled: false,
          ocrConfidence: 95,
          verifierStatus: 'Pending',
        },
        {
          id: 'REQ-VESSEL-01',
          title: 'Certificate of Fitness',
          category: 'Statutory Certificate',
          subtype: 'Vessel',
          sectionId: 'sec-vessel',
          isMandatory: true,
          isFulfilled: false,
          ocrConfidence: 92,
          verifierStatus: 'Pending',
        },
      ],
    };

    useMapStore.setState({
      assuranceSets: [testSet, ...initialState.assuranceSets],
    });

    const { container } = render(<AssuranceDetailView setId={testSetId} initialTab="requirements" />);

    const headers = container.querySelectorAll('[data-testid="section-group-header"]');
    expect(headers.length).toBe(2);
    expect(headers[0].textContent?.trim()).toBe('General documents');
    expect(headers[1].textContent?.trim()).toBe('Vessel documents');

    expect(screen.getByText('1 empty section')).toBeInTheDocument();
    expect(screen.queryByTestId('empty-section-navigational-equipment')).toBeNull();

    fireEvent.click(screen.getByTestId('toggle-empty-sections'));
    expect(screen.getByTestId('empty-section-navigational-equipment')).toBeInTheDocument();
    expect(screen.getByTestId('empty-section-navigational-equipment')).toHaveTextContent('Navigational equipment');
  });

  it('adds a new custom section on the tab, displays it in sentence case, and saves to assuranceSet.sections', () => {
    const testSetId = 'AS-TEST-ADD-CUSTOM-SECTION';
    const testSet: AssuranceSet = {
      ...initialState.assuranceSets[0],
      id: testSetId,
      title: 'Add Custom Section Test',
      stage: 'Validation',
      approverDecision: undefined,
      subtypes: ['Vessel'],
      sections: [
        { id: 'sec-general', name: 'General documents', order: 1 },
        { id: 'sec-vessel', name: 'Vessel documents', order: 2 },
      ],
      requirements: [],
    };

    useMapStore.setState({
      assuranceSets: [testSet, ...initialState.assuranceSets],
    });

    const { container } = render(<AssuranceDetailView setId={testSetId} initialTab="requirements" />);

    const addBtn = screen.getByTestId('btn-add-custom-section');
    fireEvent.click(addBtn);

    const input = screen.getByTestId('input-custom-section-name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Environmental compliance' } });

    const saveBtn = screen.getByTestId('btn-save-custom-section');
    fireEvent.click(saveBtn);

    expect(screen.getByText('3 empty sections')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('toggle-empty-sections'));
    expect(screen.getByTestId('empty-section-environmental-compliance')).toBeInTheDocument();
    expect(screen.getByTestId('empty-section-environmental-compliance')).toHaveTextContent('Environmental compliance');

    const updatedSet = useMapStore.getState().assuranceSets.find((s) => s.id === testSetId);
    expect(updatedSet).toBeDefined();
    expect(updatedSet?.sections?.some((s) => s.name === 'Environmental compliance')).toBe(true);

    const addTaskBtn = screen.getByRole('button', { name: /Add Task/i });
    fireEvent.click(addTaskBtn);

    const sectionSelect = screen.getByLabelText(/Section/i) as HTMLSelectElement;
    const optionTexts = Array.from(sectionSelect.options).map((o) => o.textContent?.trim());
    expect(optionTexts).toContain('Environmental compliance');
  });

  it('rejects a blank or whitespace section name when adding a custom section', () => {
    const testSetId = 'AS-TEST-REJECT-BLANK';
    const testSet: AssuranceSet = {
      ...initialState.assuranceSets[0],
      id: testSetId,
      title: 'Reject Blank Section Test',
      subtypes: ['Vessel'],
      sections: [
        { id: 'sec-general', name: 'General documents', order: 1 },
        { id: 'sec-vessel', name: 'Vessel documents', order: 2 },
      ],
      requirements: [],
    };

    useMapStore.setState({
      assuranceSets: [testSet, ...initialState.assuranceSets],
    });

    const { container } = render(<AssuranceDetailView setId={testSetId} initialTab="requirements" />);

    const headersBefore = container.querySelectorAll('[data-testid="section-group-header"]').length;

    const addBtn = screen.getByTestId('btn-add-custom-section');
    fireEvent.click(addBtn);

    const input = screen.getByTestId('input-custom-section-name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '   ' } });

    const saveBtn = screen.getByTestId('btn-save-custom-section') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);

    fireEvent.click(saveBtn);

    const error = screen.getByTestId('error-custom-section-name');
    expect(error.textContent).toContain('required');

    const headersAfter = container.querySelectorAll('[data-testid="section-group-header"]').length;
    expect(headersAfter).toBe(headersBefore);
  });

  it('renders all section titles in sentence case without CSS uppercase transformation', () => {
    const testSetId = 'AS-TEST-SENTENCE-CASE';
    const testSet: AssuranceSet = {
      ...initialState.assuranceSets[0],
      id: testSetId,
      title: 'Sentence Case Test',
      subtypes: ['Vessel', 'Crew'],
      sections: [
        { id: 'sec-general', name: 'General documents', order: 1 },
        { id: 'sec-vessel', name: 'Vessel documents', order: 2 },
        { id: 'sec-crew', name: 'Crew directory documents', order: 3 },
      ],
      requirements: [
        {
          id: 'REQ-01',
          title: 'Safety Certificate',
          category: 'Statutory Certificate',
          sectionId: 'sec-vessel',
          isMandatory: true,
          isFulfilled: false,
          ocrConfidence: 90,
          verifierStatus: 'Pending',
        },
      ],
    };

    useMapStore.setState({
      assuranceSets: [testSet, ...initialState.assuranceSets],
    });

    const { container } = render(<AssuranceDetailView setId={testSetId} initialTab="requirements" />);

    const headers = container.querySelectorAll('[data-testid="section-group-header"]');
    headers.forEach((h) => {
      expect(h.className).not.toContain('text-uppercase');
    });

    expect(headers.length).toBe(1);
    expect(headers[0].textContent?.trim()).toBe('Vessel documents');

    expect(screen.getByText('2 empty sections')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('toggle-empty-sections'));

    const emptyGeneral = screen.getByTestId('empty-section-general-documents');
    const emptyCrew = screen.getByTestId('empty-section-crew-directory-documents');
    expect(emptyGeneral).toHaveTextContent('General documents');
    expect(emptyCrew).toHaveTextContent('Crew directory documents');

  });

  it('Task 5367: groups all empty sections at the end into one line that expands to list their names', () => {
    const testSetId = 'AS-TEST-EMPTY-SECTIONS-COLLAPSE';
    const testSet: AssuranceSet = {
      ...initialState.assuranceSets[0],
      id: testSetId,
      title: 'Empty Sections Collapse Test',
      subtypes: ['Vessel', 'Crew'],
      sections: [
        { id: 'sec-general', name: 'General documents', order: 1 },
        { id: 'sec-vessel', name: 'Vessel documents', order: 2 },
        { id: 'sec-crew', name: 'Crew directory documents', order: 3 },
      ],
      requirements: [
        {
          id: 'REQ-GEN-01',
          title: 'Document of Compliance (DOC)',
          category: 'Statutory Certificate',
          sectionId: 'sec-general',
          isMandatory: true,
          isFulfilled: false,
          ocrConfidence: 95,
          verifierStatus: 'Pending',
        },
      ],
    };

    useMapStore.setState({
      assuranceSets: [testSet, ...initialState.assuranceSets],
    });

    const { container } = render(<AssuranceDetailView setId={testSetId} initialTab="requirements" />);

    // Non-empty section (General documents) has regular section header
    const headers = container.querySelectorAll('[data-testid="section-group-header"]');
    expect(headers.length).toBe(1);
    expect(headers[0].textContent?.trim()).toBe('General documents');

    // The two empty sections (Vessel documents and Crew directory documents) are collapsed into one line
    const emptyToggle = screen.getByTestId('toggle-empty-sections');
    expect(emptyToggle).toBeInTheDocument();
    expect(emptyToggle.textContent).toContain('2 empty sections');

    // Before expanding, individual empty section rows are not in document
    expect(screen.queryByTestId('empty-section-vessel-documents')).toBeNull();
    expect(screen.queryByTestId('empty-section-crew-directory-documents')).toBeNull();

    // Expanding lists both empty section names
    fireEvent.click(emptyToggle);
    const vesselEmpty = screen.getByTestId('empty-section-vessel-documents');
    const crewEmpty = screen.getByTestId('empty-section-crew-directory-documents');
    expect(vesselEmpty).toBeInTheDocument();
    expect(vesselEmpty).toHaveTextContent('Vessel documents');
    expect(crewEmpty).toBeInTheDocument();
    expect(crewEmpty).toHaveTextContent('Crew directory documents');

    // Collapsing hides them again
    fireEvent.click(emptyToggle);
    expect(screen.queryByTestId('empty-section-vessel-documents')).toBeNull();
    expect(screen.queryByTestId('empty-section-crew-directory-documents')).toBeNull();
  });
});
