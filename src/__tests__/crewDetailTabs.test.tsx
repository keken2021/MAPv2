/*
  file summary: tests crew detail tabs, unknown-id not found, and that Save lives on Assignments.
  responsibilities: covers CrewDetailView tab order and the unknown-id guard from audit findings 3f-01..3f-08.
  role in system: automated coverage for Task 5322.
*/

import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { CrewDetailView } from '../views/CrewDetailView';

const initialState = useMapStore.getState();

describe('crew detail tabs', () => {
  beforeEach(() => {
    useMapStore.setState({ ...initialState, activePersona: 'Administrator', isAuthenticated: true }, true);
  });
  afterEach(cleanup);

  it('shows Overview, Documents, Assurance, Assignments in vessel tab order', () => {
    const crew = useMapStore.getState().crew[0];
    render(<CrewDetailView crewId={crew.id} />);

    const tabs = screen.getAllByRole('tab').map((tab) => tab.textContent || '');
    expect(tabs[0]).toBe('Overview');
    expect(tabs.some((label) => label.startsWith('Documents'))).toBe(true);
    expect(tabs.some((label) => label.startsWith('Assurance'))).toBe(true);
    expect(tabs.some((label) => label.startsWith('Assignments'))).toBe(true);

    const tablist = screen.getByRole('tablist', { name: 'Crew detail tabs' });
    const labels = Array.from(tablist.querySelectorAll('[role="tab"]')).map((el) => el.textContent || '');
    const overviewIdx = labels.findIndex((l) => l === 'Overview');
    const documentsIdx = labels.findIndex((l) => l.startsWith('Documents'));
    const assuranceIdx = labels.findIndex((l) => l.startsWith('Assurance'));
    const assignmentsIdx = labels.findIndex((l) => l.startsWith('Assignments'));
    expect(overviewIdx).toBeLessThan(documentsIdx);
    expect(documentsIdx).toBeLessThan(assuranceIdx);
    expect(assuranceIdx).toBeLessThan(assignmentsIdx);
  });

  it('shows not found for an unknown crew id', () => {
    render(<CrewDetailView crewId="CREW-DOES-NOT-EXIST" />);
    expect(screen.getByText('Crew profile not found.')).toBeInTheDocument();
    expect(screen.queryByRole('tablist', { name: 'Crew detail tabs' })).toBeNull();
  });

  it('keeps Save on the Assignments tab', () => {
    const crew = useMapStore.getState().crew[0];
    render(<CrewDetailView crewId={crew.id} />);

    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: /Assignments/ }));
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });
});
