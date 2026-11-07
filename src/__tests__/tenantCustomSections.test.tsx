import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { CreateAssuranceSetView } from '../views/CreateAssuranceSetView';
import { clickNext, pickReviewerRoles, renderWizardWithDefaultVessel } from './assuranceWizardTestHelpers';

const initialState = useMapStore.getState();

describe('Tenant Custom Sections (Task 5303 / 5b-01, 5b-02, ADR 0034)', () => {
  beforeEach(() => {
    useMapStore.setState(initialState, true);
    useMapStore.setState({
      isAuthenticated: true,
      activePersona: 'Administrator',
      activeDemoOrganization: 'Chevron',
      tenantCustomSections: [],
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
        {
          id: 'USR-CHEV-01',
          name: 'C. Administrator',
          email: 'admin@chevron.com',
          roles: ['Administrator', 'C Admin'],
          userType: 'Organization',
          organization: 'Chevron',
          departmentOrScope: 'Operations',
          status: 'Active',
          lastActive: '2026-11-03 08:00 UTC',
        },
        {
          id: 'USR-TOTAL-01',
          name: 'T. Administrator',
          email: 'admin@totalenergies.com',
          roles: ['Administrator', 'C Admin'],
          userType: 'Organization',
          organization: 'TotalEnergies',
          departmentOrScope: 'Operations',
          status: 'Active',
          lastActive: '2026-11-03 08:00 UTC',
        },
      ],
    });
  });

  describe('Store: addTenantCustomSection and getTenantCustomSections', () => {
    it('saves custom sections against tenant organization and scopes retrieval strictly per tenant', () => {
      const store = useMapStore.getState();

      // Initially empty
      expect(store.getTenantCustomSections('Chevron')).toEqual([]);
      expect(store.getTenantCustomSections('TotalEnergies')).toEqual([]);

      // Add section for Chevron
      const sec1 = store.addTenantCustomSection({
        name: 'Berth Clearance',
        organization: 'Chevron',
        description: 'Vessel berth clearance envelope and mooring specifications',
      });

      expect(sec1).toBeDefined();
      expect(sec1.id).toContain('sec-tenant-');
      expect(sec1.name).toBe('Berth Clearance');
      expect(sec1.organization).toBe('Chevron');
      expect(sec1.description).toBe('Vessel berth clearance envelope and mooring specifications');

      // Add another section for Chevron
      const sec2 = store.addTenantCustomSection({
        name: 'Environmental Contingency',
        organization: 'Chevron',
      });

      // Add section for TotalEnergies
      const secTotal = store.addTenantCustomSection({
        name: 'Deepwater Pre-entry Check',
        organization: 'TotalEnergies',
      });

      // Verify Chevron retrieves only Chevron sections
      const chevronSections = useMapStore.getState().getTenantCustomSections('Chevron');
      expect(chevronSections).toHaveLength(2);
      expect(chevronSections.map((s) => s.name)).toEqual(['Berth Clearance', 'Environmental Contingency']);

      // Verify TotalEnergies retrieves only TotalEnergies sections
      const totalSections = useMapStore.getState().getTenantCustomSections('TotalEnergies');
      expect(totalSections).toHaveLength(1);
      expect(totalSections[0].name).toBe('Deepwater Pre-entry Check');

      // Verify an uninvolved organization retrieves nothing
      const bpSections = useMapStore.getState().getTenantCustomSections('BP Exploration');
      expect(bpSections).toEqual([]);
    });

    it('updates an existing section if added again with the same name and organization', () => {
      const store = useMapStore.getState();
      const first = store.addTenantCustomSection({
        name: 'DP Capability Envelope',
        organization: 'Chevron',
        description: 'Initial description',
      });

      const second = store.addTenantCustomSection({
        name: 'DP Capability Envelope',
        organization: 'Chevron',
        description: 'Updated criteria description',
      });

      expect(second.id).toBe(first.id);
      expect(second.description).toBe('Updated criteria description');

      const all = useMapStore.getState().getTenantCustomSections('Chevron');
      expect(all).toHaveLength(1);
      expect(all[0].description).toBe('Updated criteria description');
    });
  });

  describe('Wizard Step 3: Create section, in-place edit, and add document', () => {
    it('creates a custom section in Step 3, edits title, adds document, and persists on created set', () => {
      const { container } = renderWizardWithDefaultVessel();

      // Step 1: Set unique title
      const titleInput = container.querySelector('#grid-campaign-title') as HTMLInputElement;
      if (titleInput) {
        fireEvent.change(titleInput, { target: { value: 'Task 5303 Chevron Campaign' } });
      }

      pickReviewerRoles(container);
      // Step 1 -> Step 2 (Objects)
      clickNext();
      // Step 2 -> Step 3 (Requirements)
      clickNext();

      // Verify Tenant Custom Sections card rendered
      const tenantCard = container.querySelector('[data-testid="tenant-custom-sections-container"]');
      expect(tenantCard).not.toBeNull();
      expect(tenantCard?.textContent).toContain('Tenant Custom Sections');

      // Click "Create Section" button
      const createSecBtn = container.querySelector('[data-testid="btn-create-custom-section"]') as HTMLButtonElement;
      expect(createSecBtn).not.toBeNull();
      fireEvent.click(createSecBtn);

      // Verify section creation form appears
      const nameInput = container.querySelector('[data-testid="input-custom-section-name"]') as HTMLInputElement;
      expect(nameInput).not.toBeNull();
      const descInput = container.querySelector('[data-testid="input-custom-section-description"]') as HTMLInputElement;
      expect(descInput).not.toBeNull();

      fireEvent.change(nameInput, { target: { value: 'Berth Clearance' } });
      fireEvent.change(descInput, { target: { value: 'Site-specific clearance criteria' } });

      const saveSecBtn = container.querySelector('[data-testid="btn-save-custom-section"]') as HTMLButtonElement;
      expect(saveSecBtn).not.toBeNull();
      fireEvent.click(saveSecBtn);

      // Verify section now appears in the active custom sections list
      const customSection = container.querySelector('[data-testid^="section-custom-sec-tenant-"]');
      expect(customSection).not.toBeNull();
      expect(customSection?.textContent).toContain('Berth Clearance');

      // Verify saved in store for Chevron
      const savedInStore = useMapStore.getState().getTenantCustomSections('Chevron');
      expect(savedInStore.some((s) => s.name === 'Berth Clearance')).toBe(true);

      // In-place edit section title
      const editTitleBtn = customSection?.querySelector('[data-testid^="btn-edit-section-title-"]') as HTMLButtonElement;
      expect(editTitleBtn).not.toBeNull();
      fireEvent.click(editTitleBtn);

      const titleEditInput = customSection?.querySelector('[data-testid^="input-section-title-"]') as HTMLInputElement;
      expect(titleEditInput).not.toBeNull();
      fireEvent.change(titleEditInput, { target: { value: 'Berth & Mooring Clearance' } });

      const saveTitleBtn = customSection?.querySelector('[data-testid^="btn-save-section-title-"]') as HTMLButtonElement;
      expect(saveTitleBtn).not.toBeNull();
      fireEvent.click(saveTitleBtn);

      // Verify edited title rendered
      expect(customSection?.textContent).toContain('Berth & Mooring Clearance');

      // Add document to the custom section
      const addDocBtn = customSection?.querySelector('[data-testid^="btn-add-doc-to-section-"]') as HTMLButtonElement;
      expect(addDocBtn).not.toBeNull();
      fireEvent.click(addDocBtn);

      // Verify added document appears in custom section
      expect(customSection?.textContent).toContain('Custom Requirement 1');
            // Step 3 -> Step 4 (Review)
      clickNext();

      // Verify Step 4 review displays the custom section title
      expect(screen.getByText('Berth & Mooring Clearance')).toBeInTheDocument();

      // Back -> Step 3
      fireEvent.click(screen.getByRole('button', { name: 'Back' }));

      // Verify survived Back navigation
      expect(container.querySelector('[data-testid^="section-custom-sec-tenant-"]')?.textContent).toContain(
        'Berth & Mooring Clearance',
      );

      // Step 3 -> Step 4 -> Create Assurance Set
      clickNext();
      const createBtn = screen.getByRole('button', { name: 'Create Assurance Set' });
      expect(createBtn).toBeInTheDocument();
      fireEvent.click(createBtn);

      // Verify created set in store has the custom section and requirement
      const createdSet = useMapStore.getState().assuranceSets.find((s) => s.title === 'Task 5303 Chevron Campaign');
      expect(createdSet).toBeDefined();

      const customSecOnSet = createdSet?.sections?.find((s) => s.id.startsWith('sec-tenant-'));
      expect(customSecOnSet).toBeDefined();
      expect(customSecOnSet?.name).toBe('Berth & Mooring Clearance');

      const customReq = createdSet?.requirements?.find((r) => r.sectionId === customSecOnSet?.id);
      expect(customReq).toBeDefined();
      expect(customReq?.title).toBe('Custom Requirement 1');
    });

    it('offers previously created custom sections in the next set of the same organization, and NOT in another organization', () => {
      // 1. Pre-seed a custom section for Chevron in the store
      useMapStore.getState().addTenantCustomSection({
        id: 'sec-tenant-chev-berth',
        name: 'Chevron Offshore Mooring Envelope',
        organization: 'Chevron',
        description: 'Mandatory mooring calculations',
      });

      // 2. Open wizard as Chevron
      useMapStore.setState({
        activeDemoOrganization: 'Chevron',
      });

      const { container, unmount } = renderWizardWithDefaultVessel();

      clickNext(); // Step 1 -> Step 2
      clickNext(); // Step 2 -> Step 3

      // Verify that Chevron's saved section is offered in the saved sections dropdown
      const savedSelect = container.querySelector('[data-testid="select-saved-tenant-section"]') as HTMLSelectElement;
      expect(savedSelect).not.toBeNull();
      expect(savedSelect.textContent).toContain('Chevron Offshore Mooring Envelope');

      // Select it and click "Add to Set"
      fireEvent.change(savedSelect, { target: { value: 'sec-tenant-chev-berth' } });
      const addSavedBtn = container.querySelector('[data-testid="btn-add-saved-section"]') as HTMLButtonElement;
      expect(addSavedBtn).not.toBeNull();
      fireEvent.click(addSavedBtn);

      // Verify the section is now active in the set
      expect(container.querySelector('[data-testid="section-custom-sec-tenant-chev-berth"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="section-custom-sec-tenant-chev-berth"]')?.textContent).toContain(
        'Chevron Offshore Mooring Envelope',
      );

      unmount();

      // 3. Now open wizard as a DIFFERENT organization (TotalEnergies)
      useMapStore.setState({
        activeDemoOrganization: 'TotalEnergies',
      });

      const { container: totalContainer } = renderWizardWithDefaultVessel();

      clickNext(); // Step 1 -> Step 2
      clickNext(); // Step 2 -> Step 3

      // Verify that TotalEnergies does NOT see or get offered Chevron's custom section
      const totalSavedSelect = totalContainer.querySelector('[data-testid="select-saved-tenant-section"]');
      if (totalSavedSelect) {
        expect(totalSavedSelect.textContent).not.toContain('Chevron Offshore Mooring Envelope');
      }

      const totalCustomSection = totalContainer.querySelector('[data-testid="section-custom-sec-tenant-chev-berth"]');
      expect(totalCustomSection).toBeNull();

      expect(totalContainer.textContent).not.toContain('Chevron Offshore Mooring Envelope');
    });
  });
});
