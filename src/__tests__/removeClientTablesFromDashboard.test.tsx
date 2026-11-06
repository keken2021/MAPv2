import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardView } from '../views/DashboardView';
import { ProjectView } from '../views/ProjectView';
import { AssuranceSetsView } from '../views/AssuranceSetsView';
import { ProjectTasksTable } from '../components/tables/ProjectTasksTable';
import { useMapStore } from '../store/useMapStore';

describe('Remove client tables from dashboard (Task 5385)', () => {
  beforeEach(() => {
    useMapStore.setState({
      isAuthenticated: true,
      activePersona: 'Administrator',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
      activeSessionUserId: 'USR-101',
    });
  });

  it('renders shared dashboard frame with no tables, search, or pagination on Administrator dashboard', () => {
    useMapStore.setState({ activePersona: 'Administrator' });
    render(<DashboardView />);

    // Shared dashboard frame is rendered
    expect(screen.getByText('Sets needing people')).toBeInTheDocument();

    // No tables are rendered on the dashboard
    expect(screen.queryAllByRole('table')).toHaveLength(0);

    // No search inputs for projects or assurance sets
    expect(screen.queryByPlaceholderText('Search projects...')).toBeNull();
    expect(screen.queryByPlaceholderText('Search assurance sets...')).toBeNull();

    // No table pagination text
    expect(screen.queryByText(/Showing \d+-\d+ of \d+/)).toBeNull();
  });

  it('renders shared dashboard frame with no tables on C Admin dashboard', () => {
    useMapStore.setState({ activePersona: 'C Admin' });
    render(<DashboardView />);

    // No tables are rendered
    expect(screen.queryAllByRole('table')).toHaveLength(0);
    expect(screen.queryByPlaceholderText('Search projects...')).toBeNull();
    expect(screen.queryByPlaceholderText('Search assurance sets...')).toBeNull();
  });

  it('verifies that the three list screens still work independently', () => {
    // 1. Projects list screen renders
    const { unmount: unmountProjects } = render(<ProjectView />);
    expect(screen.getByPlaceholderText('Search projects...')).toBeInTheDocument();
    unmountProjects();

    // 2. Assurance Sets list screen renders
    const { unmount: unmountAssurance } = render(<AssuranceSetsView />);
    expect(screen.getByPlaceholderText('Search assurance sets...')).toBeInTheDocument();
    unmountAssurance();

    // 3. Tasks table renders
    const { unmount: unmountTasks } = render(
      <ProjectTasksTable title="Tasks" today={new Date()} />,
    );
    expect(screen.getByText('Tasks')).toBeInTheDocument();
    unmountTasks();
  });
});
