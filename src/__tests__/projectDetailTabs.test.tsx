/*
  file summary: asserts ProjectDetailView section Tabs switch content (Task 5452).
  responsibilities: navy underline tab bar; Objects / Tasks selection.
  role in system: automated coverage for project detail tab migration.
*/

import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ProjectDetailView } from '../views/ProjectDetailView';
import { useMapStore } from '../store/useMapStore';

describe('project detail tabs', () => {
  beforeEach(() => {
    useMapStore.setState({
      activePersona: 'Administrator',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
      isAuthenticated: true,
    });
  });

  it('switches section tabs with aria-selected and no purple nav-link class', () => {
    const project = useMapStore.getState().projects[0];
    render(<ProjectDetailView projectId={project.id} />);

    const tablist = screen.getByRole('tablist', { name: /project detail tabs/i });
    const assurance = within(tablist).getByRole('tab', { name: /Assurance Sets/i });
    expect(assurance).toHaveAttribute('aria-selected', 'true');
    expect(assurance.className).not.toMatch(/nav-link/);

    fireEvent.click(within(tablist).getByRole('tab', { name: /^Tasks$/i }));
    expect(within(tablist).getByRole('tab', { name: /^Tasks$/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(assurance).toHaveAttribute('aria-selected', 'false');
  });
});

