import React from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { VesselDetailView } from '../views/VesselDetailView';
import { ObjectVerificationBadge } from '../components/common/ObjectVerificationBadge';
import { ObjectVerification } from '../types/assurance';

const LONG_STATUS = 'Used and tested by several entities over time';

describe('vessel detail status shown once', () => {
  beforeEach(() => {
    useMapStore.setState({
      activePersona: 'Administrator',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
      isAuthenticated: true,
    });
  });

  it('shows Port Stay once and registration as flag and port', () => {
    const { container } = render(<VesselDetailView vesselId="VESSEL-001" />);
    expect(screen.getAllByText('Port Stay')).toHaveLength(1);

    const statusCard = [...container.querySelectorAll('.card')].find((card) =>
      card.textContent?.includes('Vessel Status'),
    ) as HTMLElement;
    expect(statusCard.textContent).toContain('Charter availability');
    expect(statusCard.textContent).toContain('Australia · Fremantle, WA');
    expect(statusCard.textContent).not.toContain('Port Stay');
    expect(screen.getByRole('combobox', { name: 'Charter availability' })).toHaveValue('Available');
  });

  it('shows a short verification label and keeps the long status as the tooltip', () => {
    const verification = {
      objectId: 'VESSEL-001',
      objectType: 'vessel',
      status: LONG_STATUS,
      channel: 'external',
      verifiedBy: 'XY Marine Assurance',
      verifiedAt: '2026-06-01T00:00:00.000Z',
    } as unknown as ObjectVerification;

    render(<ObjectVerificationBadge verification={verification} />);
    expect(screen.getByText('Proven')).toBeInTheDocument();
    expect(screen.getByTitle(LONG_STATUS)).toBeInTheDocument();
    expect(screen.queryByText(LONG_STATUS)).toBeNull();
  });
});
