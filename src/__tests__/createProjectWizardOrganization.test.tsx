/*
  file summary: tests that a project created in the wizard is visible to the organization that created it.
  responsibilities: walks the create project wizard as a client admin of a non-default organization and checks the new project passes the project detail filter.
  role in system: covers CreateProjectView.tsx together with filterProjectsForPersona in projectHelpers.ts.
*/

import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CreateProjectView } from '../views/CreateProjectView';
import { useMapStore } from '../store/useMapStore';
import { filterProjectsForPersona } from '../utils/projectHelpers';

const initialState = useMapStore.getState();

/* skips the optional steps and saves, returning the id the wizard navigated to */
const createProjectThroughWizard = (): string | undefined => {
  render(<CreateProjectView />);
  fireEvent.click(screen.getByRole('button', { name: 'Next: Choose Assurance Set' }));
  fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
  fireEvent.click(screen.getByRole('button', { name: 'Create Project' }));
  return useMapStore.getState().currentEntityId;
};

describe('create project wizard organization', () => {
  beforeEach(() => {
    useMapStore.setState(initialState, true);
  });

  it('opens the new project for a client admin outside the first client organization', () => {
    const organization = 'Chevron Australia Pty Ltd';
    useMapStore.setState({
      isAuthenticated: true,
      activePersona: 'C Admin',
      activeDemoOrganization: organization,
      activeSessionUserId: 'USR-221',
    });

    const projectId = createProjectThroughWizard();
    const state = useMapStore.getState();

    expect(state.currentHashView).toBe('project');
    expect(projectId).toBeDefined();
    expect(state.projects.find((p) => p.id === projectId)?.operatorOrganization).toBe(organization);

    const visible = filterProjectsForPersona(
      state.projects,
      'C Admin',
      state.users,
      state.assuranceSets,
      organization,
    );
    expect(visible.some((p) => p.id === projectId)).toBe(true);
  });
});
