import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { CreateAssuranceSetView } from '../views/CreateAssuranceSetView';
import { clickNext, pickReviewerRoles, renderWizardWithDefaultVessel } from './assuranceWizardTestHelpers';

const initialState = useMapStore.getState();

describe('CreateAssuranceSetView Step 3 Editable Section Titles and Add Other Document', () => {
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

  it('allows client to edit section titles in place, add other document, survives Next and Back, and appears on created set', () => {
    const { container } = renderWizardWithDefaultVessel();

    // Step 1: Set unique title
    const titleInput = container.querySelector('#grid-campaign-title') as HTMLInputElement;
    if (titleInput) {
      fireEvent.change(titleInput, { target: { value: 'Task 5302 Unique Vetting Campaign' } });
    }

    pickReviewerRoles(container);
    // Step 1 -> Step 2 (Covered Objects)
    clickNext();
    // Step 2 -> Step 3 (Requirements)
    clickNext();

    // 1. Verify default section titles in Step 3
    const vesselTitleSpan = container.querySelector('[data-testid="section-title-vessel"]');
    expect(vesselTitleSpan).not.toBeNull();
    expect(vesselTitleSpan?.textContent).toBe('Vessel documents');

    const generalTitleSpan = container.querySelector('[data-testid="section-title-general"]');
    expect(generalTitleSpan).not.toBeNull();
    expect(generalTitleSpan?.textContent).toBe('General documents');

    // 2. Edit section title in place for Vessel
    const editVesselBtn = container.querySelector('[data-testid="btn-edit-section-title-vessel"]') as HTMLButtonElement;
    expect(editVesselBtn).not.toBeNull();
    fireEvent.click(editVesselBtn);

    const vesselInput = container.querySelector('[data-testid="input-section-title-vessel"]') as HTMLInputElement;
    expect(vesselInput).not.toBeNull();
    fireEvent.change(vesselInput, { target: { value: 'Main Fleet Vessel Compliance' } });

    const saveVesselBtn = container.querySelector('[data-testid="btn-save-section-title-vessel"]') as HTMLButtonElement;
    expect(saveVesselBtn).not.toBeNull();
    fireEvent.click(saveVesselBtn);

    // Verify title updated in place
    expect(container.querySelector('[data-testid="section-title-vessel"]')?.textContent).toBe('Main Fleet Vessel Compliance');

    // 3. Edit General documents title in place
    const editGeneralBtn = container.querySelector('[data-testid="btn-edit-section-title-general"]') as HTMLButtonElement;
    expect(editGeneralBtn).not.toBeNull();
    fireEvent.click(editGeneralBtn);

    const generalInput = container.querySelector('[data-testid="input-section-title-general"]') as HTMLInputElement;
    expect(generalInput).not.toBeNull();
    fireEvent.change(generalInput, { target: { value: 'Corporate Compliance Requirements' } });

    const saveGeneralBtn = container.querySelector('[data-testid="btn-save-section-title-general"]') as HTMLButtonElement;
    expect(saveGeneralBtn).not.toBeNull();
    fireEvent.click(saveGeneralBtn);

    // Verify General title updated in place
    expect(container.querySelector('[data-testid="section-title-general"]')?.textContent).toBe('Corporate Compliance Requirements');

    // 4. Add other document action in flat document list
    const addOtherBtn = container.querySelector('[data-testid^="btn-add-other-doc-vessel"]') as HTMLButtonElement;
    expect(addOtherBtn).not.toBeNull();
    fireEvent.click(addOtherBtn);

    // Verify added document appears in vessel documents list
    const vesselDocsList = container.querySelector('[data-testid="docs-list-vessel"]');
    expect(vesselDocsList).not.toBeNull();
    expect(vesselDocsList?.textContent).toContain('Other Statutory Certificate Document');
    // 5. Test survival across Next and Back
    // Step 3 -> Step 4 (Review)
    clickNext();

    // Verify Step 4 review scope cards reflect the edited section title
    expect(screen.getByText('Main Fleet Vessel Compliance')).toBeInTheDocument();

    // Click Back: Step 4 -> Step 3 (Requirements)
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    // Verify edited titles and added document survived navigation
    expect(container.querySelector('[data-testid="section-title-vessel"]')?.textContent).toBe('Main Fleet Vessel Compliance');
    expect(container.querySelector('[data-testid="section-title-general"]')?.textContent).toBe('Corporate Compliance Requirements');
    expect(container.querySelector('[data-testid="docs-list-vessel"]')?.textContent).toContain(
      'Other Statutory Certificate Document',
    );

    // 6. Complete wizard: Step 3 -> Step 4 -> Create Assurance Set
    clickNext();
    const createBtn = screen.getByRole('button', { name: 'Create Assurance Set' });
    expect(createBtn).toBeInTheDocument();
    fireEvent.click(createBtn);

    // 7. Read back created set from the store
    const storeSets = useMapStore.getState().assuranceSets;
    const createdSet = storeSets.find((s) => s.title === 'Task 5302 Unique Vetting Campaign');
    expect(createdSet).toBeDefined();

    // Verify sections have edited titles and matching sectionId
    expect(createdSet?.sections).toBeDefined();
    const vesselSection = createdSet?.sections?.find((s) => s.id === 'sec-vessel');
    expect(vesselSection).toBeDefined();
    expect(vesselSection?.name).toBe('Main Fleet Vessel Compliance');

    const generalSection = createdSet?.sections?.find((s) => s.id === 'sec-general');
    expect(generalSection).toBeDefined();
    expect(generalSection?.name).toBe('Corporate Compliance Requirements');

    // Verify added document saved with isOtherDocument: true, subtype: 'Vessel', sectionId: 'sec-vessel'
    const otherDocReq = createdSet?.requirements?.find((r) => r.isOtherDocument);
    expect(otherDocReq).toBeDefined();
    expect(otherDocReq?.isOtherDocument).toBe(true);
    expect(otherDocReq?.subtype).toBe('Vessel');
    expect(otherDocReq?.sectionId).toBe('sec-vessel');
    expect(otherDocReq?.title).toBe('Other Statutory Certificate Document');
  });
});
