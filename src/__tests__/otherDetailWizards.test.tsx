import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { RolesAndPermissionsView } from '../views/RolesAndPermissionsView';
import { CreateAssuranceSetView } from '../views/CreateAssuranceSetView';
import { CreateProjectView } from '../views/CreateProjectView';
import { ProjectDetailView } from '../views/ProjectDetailView';
import { getRoleDisplayLabel } from '../utils/userRoleHelpers';

describe('other detail pages and wizards', () => {
  beforeEach(() => {
    useMapStore.setState({ activePersona: 'Administrator', isAuthenticated: true });
  });

  it('uses the shared role label on the roles alert', () => {
    useMapStore.setState({ activePersona: 'Verifier' });
    render(<RolesAndPermissionsView />);
    expect(
      screen.getByText(`Read-only. Only the ${getRoleDisplayLabel('Administrator')} role can save changes.`),
    ).toBeInTheDocument();
  });

  it('keeps the assurance stepper and drops the progress bar', () => {
    const { container } = render(<CreateAssuranceSetView />);
    expect(screen.getByRole('button', { name: /^1\s*General/ })).toBeInTheDocument();
    expect(container.querySelector('[role="progressbar"]')).toBeNull();
    expect(screen.queryByText(/1\. Assurance Set Identification/)).toBeNull();
    expect(screen.queryByText(/Template Privacy &/)).toBeNull();
  });

  it('uses the same stepper on create project', () => {
    render(<CreateProjectView />);
    expect(screen.getByRole('button', { name: /^1\s*Details/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^2\s*Assurance Sets/ })).toBeInTheDocument();
    expect(screen.queryByText(/Step 1 of 3/)).toBeNull();
    expect(screen.queryByText('Charterer')).toBeNull();
    expect(screen.getByRole('button', { name: 'Next: Choose Assurance Set' })).toBeInTheDocument();
  });

  it('puts project identity in one header and says Service Provider', () => {
    const project = useMapStore.getState().projects[0];
    const { container } = render(<ProjectDetailView projectId={project.id} />);
    const header = container.querySelector('.map-detail-header') as HTMLElement;
    expect(header.querySelectorAll('.map-status-badge')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    expect(screen.queryByText(/Charterer/)).toBeNull();
    if (project.serviceProvider) {
      expect(header.textContent).toMatch(/Service Provider:/);
    }
  });
});
