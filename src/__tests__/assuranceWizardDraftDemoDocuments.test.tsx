/* Wizard tests verifying demo documents are stored when a resumed draft is created. */
import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { AssuranceSet } from '../types/assurance';
import { CreateAssuranceSetView } from '../views/CreateAssuranceSetView';
import { vesselToAssuranceObject } from '../utils/assuranceTemplates';
import {
  clickNext,
  defaultWizardVesselId,
  pickReviewerRoles,
} from './assuranceWizardTestHelpers';

const initialState = useMapStore.getState();

describe('Assurance wizard - Draft demo documents persistence', () => {
  beforeEach(() => {
    useMapStore.setState(initialState, true);
    useMapStore.setState({
      assuranceSets: [],
      documents: [],
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

  it('stores every demo document when a resumed draft is created', () => {
    const vesselId = defaultWizardVesselId();
    const vessel = initialState.vessels.find((v) => v.id === vesselId) || initialState.vessels[0];
    const draftId = 'AS-DRAFT-2026-101';
    const draftSet: AssuranceSet = {
      id: draftId,
      title: 'Resumed Draft Set',
      visibility: 'draft',
      assuranceType: 'Vessel',
      scopeType: 'Vessel',
      stage: 'Initiated',
      readinessScore: 0,
      mandatoryInspectionRequired: false,
      inspectionCompleted: false,
      deadline: '2026-10-31',
      startDate: '2026-11-01',
      endDate: '2026-12-31',
      assuranceObjects: [vesselToAssuranceObject(vessel)],
      parties: [
        {
          organization: 'Marine Assurance Platform',
          group: 'Client',
          role: 'Requesting party',
          partyRole: 'Requesting party',
        },
        {
          organization: vessel.registeredOwner || 'Northwind Marine Pty Ltd',
          group: 'Vendor',
          role: 'Responding party',
          partyRole: 'Responding party',
        },
      ],
      stakeholders: {},
      requirements: [],
      createdBy: {
        userId: 'USR-MAP-ADMIN',
        name: 'M. Platform',
        persona: 'Administrator',
      },
    };

    useMapStore.setState({
      assuranceSets: [draftSet],
      createAssuranceForAsset: { scope: 'Vessel', assetId: vessel.id },
    });

    const { container } = render(
      React.createElement(CreateAssuranceSetView, { templateSetId: draftId }),
    );

    // Step 1: General & Scope
    pickReviewerRoles(container);

    // Step 2: Objects
    clickNext();

    // Step 3: Requirements
    clickNext();

    const templateSelect = container.querySelector(
      '#template-select-Vessel',
    ) as HTMLSelectElement;
    expect(templateSelect).toBeTruthy();
    fireEvent.change(templateSelect, {
      target: { value: 'tmpl-pub-imca-vessel' },
    });

    // Step 4: Review
    clickNext();

    // Submit wizard
    const createBtn = screen.getByRole('button', {
      name: /create assurance set/i,
    });
    fireEvent.click(createBtn);

    const store = useMapStore.getState();
    const createdSet =
      store.assuranceSets.find((s) => s.id === draftId) ||
      store.assuranceSets.find((s) => s.title === 'Resumed Draft Set');
    expect(createdSet).toBeDefined();

    const preseeded = createdSet!.requirements.filter((r) => r.demoPreseeded);
    expect(preseeded.length).toBeGreaterThan(0);

    preseeded.forEach((req) => {
      const matching = store.documents.filter((d) => d.id === req.documentId);
      expect(matching).toHaveLength(1);
    });
  });
});
