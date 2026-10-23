/*
  file summary: tests that restricted crew data is masked by default and revealed only by the owning organization's administrator, with an audit record.
  responsibilities: verifies the masked passport, that a verifier gets no Reveal, that the owning admin's Reveal shows the value and writes an audit event, and the masking rules.
  role in system: covers MaskedValue.tsx, restrictedData.ts and CrewDetailView.tsx; gap review finding G12.
*/

import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { CrewDetailView } from '../views/CrewDetailView';
import { canRevealCrewData, isRestrictedCrewDocument, maskRestrictedValue } from '../utils/restrictedData';

const initialState = useMapStore.getState();

describe('crew masking', () => {
  beforeEach(() => {
    useMapStore.setState(initialState, true);
  });
  afterEach(cleanup);

  it('masks a value except its last two characters', () => {
    expect(maskRestrictedValue('PA9831421')).toBe('••••••21');
    expect(maskRestrictedValue('')).toBe('');
    expect(isRestrictedCrewDocument('National Passport')).toBe(true);
    expect(isRestrictedCrewDocument('Basic Safety Training')).toBe(false);
  });

  it('lets only the owning organization administrator reveal', () => {
    expect(canRevealCrewData('Administrator', 'Northwind Marine Pty Ltd', 'Northwind Marine Pty Ltd')).toBe(true);
    expect(canRevealCrewData('Administrator', 'Other Org', 'Northwind Marine Pty Ltd')).toBe(false);
    expect(canRevealCrewData('Verifier', 'Northwind Marine Pty Ltd', 'Northwind Marine Pty Ltd')).toBe(false);
  });

  it('shows the passport masked to a verifier, with no Reveal', () => {
    const crew = useMapStore.getState().crew.find((c) => c.passportNo && c.organization)!;
    useMapStore.setState({ activePersona: 'Verifier' });
    render(<CrewDetailView crewId={crew.id} />);

    expect(screen.queryByText(crew.passportNo)).toBeNull();
    /* the profile and the passport document both show it masked */
    expect(screen.getAllByText(maskRestrictedValue(crew.passportNo)).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Reveal Passport No.' })).toBeNull();
  });

  it('reveals the passport to the owning administrator and records it', () => {
    const crew = useMapStore.getState().crew.find((c) => c.passportNo && c.organization)!;
    useMapStore.setState({ activePersona: 'Administrator', activeDemoOrganization: crew.organization! });
    render(<CrewDetailView crewId={crew.id} />);

    fireEvent.click(screen.getByRole('button', { name: 'Reveal Passport No.' }));

    expect(screen.getByText(crew.passportNo)).toBeInTheDocument();
    const [latest] = useMapStore.getState().auditEvents;
    expect(latest.action).toBe('Revealed Restricted Crew Data');
    expect(latest.targetAsset).toBe(`Crew ${crew.id}`);
  });
});
