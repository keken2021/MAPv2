import React from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { InspectorWorkspaceView } from '../views/InspectorWorkspaceView';
import { INSPECTION_LIST_PROGRESS } from '../store/inspectionMockData';

const dataRows = () => screen.getAllByRole('row').slice(1);

describe('Inspections list location and checklist', () => {
  beforeEach(() => {
    useMapStore.setState({
      activePersona: 'Inspector',
      activeDemoOrganization: 'Meridian Marine Surveyors',
      isAuthenticated: true,
    });
  });

  it('shows Location and Checklist, and keeps mono on identifiers only', () => {
    const { container } = render(<InspectorWorkspaceView />);
    expect(screen.getByRole('columnheader', { name: /location/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /checklist/i })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /operating status/i })).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: /all/i }));
    const rows = dataRows();
    expect(rows.length).toBeGreaterThan(0);
    expect(INSPECTION_LIST_PROGRESS).toHaveLength(10);

    rows.forEach((row) => {
      const cells = within(row).getAllByRole('cell');
      expect(cells[4].textContent?.trim()).not.toBe('—');
      expect(cells[5].textContent?.trim()).toMatch(/^\d+ \/ \d+$/);
    });

    container.querySelectorAll('tbody .font-mono-code').forEach((node) => {
      const text = node.textContent?.trim() || '';
      expect(text).toMatch(/^(AS-|AS$|\d{7})/);
    });
    expect(container.querySelector('.due-cell.font-mono-code')).toBeNull();
  });

  it('shows full checklist progress on completed rows', () => {
    render(<InspectorWorkspaceView />);
    fireEvent.click(screen.getByRole('tab', { name: /completed/i }));
    const rows = dataRows();
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach((row) => {
      const checklist = within(row).getAllByRole('cell')[5].textContent?.trim() || '';
      const [done, total] = checklist.split(' / ').map(Number);
      expect(done).toBe(total);
      expect(total).toBeGreaterThan(0);
    });
  });

  it('uses the empty state when the queue has no rows', () => {
    useMapStore.setState({ assuranceSets: [] });
    render(<InspectorWorkspaceView />);
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByText('No inspections')).toBeInTheDocument();
  });
});
