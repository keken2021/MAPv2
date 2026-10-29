import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { CreateAssuranceSetView } from '../views/CreateAssuranceSetView';
import { addObject, clickNext } from './assuranceWizardTestHelpers';

const initialState = useMapStore.getState();

describe('Requirements Tab: Compact Document Lists and Searchable Picker', () => {
  beforeEach(() => {
    useMapStore.setState(initialState, true);
    useMapStore.setState({
      isAuthenticated: true,
      activePersona: 'Administrator',
      users: [
        ...initialState.users,
        {
          id: 'USR-OHL-01',
          name: 'J. Ocean',
          email: 'j.ocean@oceanic.com',
          roles: ['Submitter'],
          userType: 'Organization',
          organization: 'Oceanic Horizon Logistics Pty Ltd',
          departmentOrScope: 'Operations',
          status: 'Active',
          lastActive: '2026-10-29 08:00 UTC',
        },
      ],
    });
  });

  it('has no Scope dropdown field on General tab', () => {
    const { container } = render(<CreateAssuranceSetView />);
    expect(container.querySelector('#grid-assurance-scope')).toBeNull();
    expect(screen.queryByLabelText(/Assurance Scope/i)).toBeNull();
  });

  it('lists the 16 usual vessel documents without descriptions by default', () => {
    const { container } = render(<CreateAssuranceSetView />);
    // Step 1: General -> Step 2: Objects
    clickNext();
    // Step 2: Objects -> Step 3: Requirements
    clickNext();

    expect(screen.getByRole('heading', { name: /Vessel documents/i })).toBeInTheDocument();

    const vesselDocsList = container.querySelector('#docs-list-Vessel');
    expect(vesselDocsList).not.toBeNull();

    const docRows = vesselDocsList?.children;
    expect(docRows?.length).toBe(16);

    // Verify row shows title but no descriptions
    expect(screen.getByText('Certificate of Class')).toBeInTheDocument();
    expect(
      screen.queryByText(/Classification society certificate issued by an IACS recognized organization/i)
    ).toBeNull();
  });

  it('removes a document and allows finding and re-adding it through the search', () => {
    const { container } = render(<CreateAssuranceSetView />);
    clickNext(); // To Objects
    clickNext(); // To Requirements

    const vesselDocsList = container.querySelector('#docs-list-Vessel');
    expect(vesselDocsList?.children.length).toBe(16);

    // Remove "Certificate of Class"
    const removeBtn = screen.getByRole('button', { name: 'Remove Certificate of Class' });
    fireEvent.click(removeBtn);

    // Now 15 documents remain in the list
    expect(vesselDocsList?.children.length).toBe(15);
    expect(vesselDocsList?.textContent).not.toContain('Certificate of Class');

    // Use search to find and re-add
    const searchInput = container.querySelector('#search-docs-Vessel') as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: 'Certificate of Class' } });

    // Click the found option in the listbox
    const option = screen.getByRole('option', { name: /Certificate of Class/i });
    fireEvent.click(option);

    // Document is restored back in the list
    expect(vesselDocsList?.children.length).toBe(16);
    expect(vesselDocsList?.textContent).toContain('Certificate of Class');
  });

  it('saves an Optional document with isMandatory: false', () => {
    const { container } = render(<CreateAssuranceSetView />);
    // Set unique title on General tab
    const titleInput = container.querySelector('#grid-campaign-title') as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: 'Optional Document Vetting Campaign' } });

    // Ensure submitter is selected if needed
    const subSelect = container.querySelector('#assign-sub') as HTMLSelectElement;
    if (subSelect && subSelect.options.length > 1) {
      fireEvent.change(subSelect, { target: { value: subSelect.options[1].value } });
    }

    clickNext(); // To Objects
    clickNext(); // To Requirements

    // Switch Certificate of Class to Optional
    const toggle = container.querySelector('#req-toggle-vessel-class-cert') as HTMLInputElement;
    expect(toggle.checked).toBe(true); // Initially Required

    fireEvent.click(toggle);
    expect(toggle.checked).toBe(false);

    // Step 3: Requirements -> Step 4: Review
    clickNext();

    // Verify Review tab shows Optional and initiate
    const submitBtn = screen.getByRole('button', { name: /Create Assurance Set/i });
    fireEvent.click(submitBtn);

    const savedSets = useMapStore.getState().assuranceSets;
    const newSet = savedSets[savedSets.length - 1];
    expect(newSet).toBeDefined();

    const classReq = newSet.requirements.find((r) => r.title === 'Certificate of Class');
    expect(classReq).toBeDefined();
    expect(classReq?.isMandatory).toBe(false);
  });

  it('adds a custom document from the search', () => {
    const { container } = render(<CreateAssuranceSetView />);
    // Set unique title on General tab
    const titleInput = container.querySelector('#grid-campaign-title') as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: 'Custom Search Document Vetting Campaign' } });

    // Ensure submitter is selected if needed
    const subSelect = container.querySelector('#assign-sub') as HTMLSelectElement;
    if (subSelect && subSelect.options.length > 1) {
      fireEvent.change(subSelect, { target: { value: subSelect.options[1].value } });
    }

    clickNext(); // To Objects
    clickNext(); // To Requirements

    const searchInput = container.querySelector('#search-docs-Vessel') as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: 'Ice Class Winterization Certificate' } });

    const createOption = screen.getByRole('option', {
      name: /Add 'Ice Class Winterization Certificate' as a custom document/i,
    });
    fireEvent.click(createOption);

    const vesselDocsList = container.querySelector('#docs-list-Vessel');
    expect(vesselDocsList?.textContent).toContain('Ice Class Winterization Certificate');

    // Step 3: Requirements -> Step 4: Review
    clickNext();

    // Initiate set
    const submitBtn = screen.getByRole('button', { name: /Create Assurance Set/i });
    fireEvent.click(submitBtn);

    const savedSets = useMapStore.getState().assuranceSets;
    const newSet = savedSets[savedSets.length - 1];
    const customReq = newSet.requirements.find((r) => r.title === 'Ice Class Winterization Certificate');
    expect(customReq).toBeDefined();
    expect(customReq?.isSpecialized).toBe(true);
    expect(customReq?.isMandatory).toBe(true);
  });

  it('renders exactly one Crew documents section when two crew members are added', () => {
    const { container } = render(<CreateAssuranceSetView />);
    clickNext(); // To Objects

    // Add first crew member
    addObject(container, 'person', 'CREW-101');
    // Add second crew member
    addObject(container, 'person', 'CREW-105');

    clickNext(); // To Requirements

    // Check headings
    const crewHeadings = screen.getAllByRole('heading', { name: /Crew documents/i });
    expect(crewHeadings.length).toBe(1);

    const crewContainer = container.querySelector('#subtype-docs-container-Crew');
    expect(crewContainer).toBeInTheDocument();
  });

  it('shows empty state when all documents of a type are removed', () => {
    const { container } = render(<CreateAssuranceSetView />);
    clickNext(); // To Objects
    clickNext(); // To Requirements

    // Remove all 16 vessel docs
    const removeButtons = container.querySelectorAll('#docs-list-Vessel button[title="Remove document"]');
    removeButtons.forEach((btn) => fireEvent.click(btn));

    expect(screen.getByText('No Vessel documents. Search to add one.')).toBeInTheDocument();
  });
});
