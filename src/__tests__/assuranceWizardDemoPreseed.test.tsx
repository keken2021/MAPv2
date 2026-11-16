/*
  file summary: wizard tests for automatic demo document attachment across all templates.
  responsibilities: verifies that creating an assurance set from a non-SS-04/05 template in the wizard
  leaves the first 3 requirements awaiting upload, attaches demo documents to all other requirements,
  and adds matching documents to the store.
  role in system: vitest component test for CreateAssuranceSetView.
*/

import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import {
  clickNext,
  pickReviewerRoles,
  renderWizardWithDefaultVessel,
} from './assuranceWizardTestHelpers';

const initialState = useMapStore.getState();

describe('Assurance wizard - Demo documents auto-attachment for all templates', () => {
  beforeEach(() => {
    useMapStore.setState(initialState, true);
    useMapStore.setState({
      assuranceSets: [],
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
    });
  });

  it('creates an assurance set from a non-SS-04/05 template leaving the first 3 open and attaching the rest', () => {
    const { container } = renderWizardWithDefaultVessel();

    // Step 1: General & Scope
    const titleInput = screen.getByLabelText(/title/i);
    fireEvent.change(titleInput, { target: { value: 'IMCA Baseline Demo Set' } });
    pickReviewerRoles(container);

    // Navigate to Step 2: Objects
    clickNext();

    // Navigate to Step 3: Requirements
    clickNext();

    // Select a non-SS-04/05 template (IMCA Offshore Support Vessel Baseline)
    const templateSelect = container.querySelector('#template-select-Vessel') as HTMLSelectElement;
    expect(templateSelect).toBeDefined();
    fireEvent.change(templateSelect, { target: { value: 'tmpl-pub-imca-vessel' } });

    // Navigate to Step 4: Review
    clickNext();

    // Submit wizard
    const createBtn = screen.getByRole('button', { name: /create assurance set/i });
    fireEvent.click(createBtn);

    const store = useMapStore.getState();
    const createdSet = store.assuranceSets.find((s) => s.title === 'IMCA Baseline Demo Set');
    expect(createdSet).toBeDefined();
    expect(createdSet?.requirements.length).toBeGreaterThan(3);

    // First 3 requirements stay open
    const first3 = createdSet!.requirements.slice(0, 3);
    first3.forEach((req) => {
      expect(req.documentId).toBeUndefined();
      expect(req.verifierStatus).toBe('Pending');
      expect(req.isFulfilled).toBe(false);
      expect(req.demoPreseeded).toBeUndefined();
    });

    // All remaining requirements get attached with demo documents
    const remaining = createdSet!.requirements.slice(3);
    expect(remaining.length).toBeGreaterThan(0);
    remaining.forEach((req) => {
      expect(req.documentId).toBeDefined();
      expect(req.ocrConfidence).toBe(96);
      expect(req.demoPreseeded).toBe(true);
      expect(req.notes).toBe('Demo pre-seeded upload');
      expect(req.verifierStatus).toBe('Pending');
      expect(req.isFulfilled).toBe(false);

      // Verify the matching document is in the store
      const matchingDoc = store.documents.find((d) => d.id === req.documentId);
      expect(matchingDoc).toBeDefined();
      expect(matchingDoc?.title).toBe(req.title);
      expect(req.documentVersion).toBe(matchingDoc?.currentVersion);
      expect(matchingDoc?.verificationStatus).toMatch(/^(Pending|Verified)$/);
    });
  });

  it('saves draft from a template leaving the first 3 open and adding documents to store', () => {
    const { container } = renderWizardWithDefaultVessel();

    // Step 1: General & Scope
    const titleInput = screen.getByLabelText(/title/i);
    fireEvent.change(titleInput, { target: { value: 'Draft Demo Set' } });
    pickReviewerRoles(container);

    clickNext(); // Step 2: Objects
    clickNext(); // Step 3: Requirements

    // Select template
    const templateSelect = container.querySelector('#template-select-Vessel') as HTMLSelectElement;
    fireEvent.change(templateSelect, { target: { value: 'tmpl-pub-imca-vessel' } });

    // Save as draft
    const saveDraftBtn = screen.getByRole('button', { name: /save as draft/i });
    fireEvent.click(saveDraftBtn);

    const store = useMapStore.getState();
    const draftSet = store.assuranceSets.find((s) => s.title === 'Draft Demo Set');
    expect(draftSet).toBeDefined();
    expect(draftSet?.requirements.length).toBeGreaterThan(3);

    // First 3 open
    draftSet!.requirements.slice(0, 3).forEach((req) => {
      expect(req.documentId).toBeUndefined();
      expect(req.verifierStatus).toBe('Pending');
      expect(req.isFulfilled).toBe(false);
    });

    // All remaining attached
    draftSet!.requirements.slice(3).forEach((req) => {
      expect(req.documentId).toBeDefined();
      expect(req.demoPreseeded).toBe(true);
      expect(store.documents.some((d) => d.id === req.documentId)).toBe(true);
    });
  });
});
