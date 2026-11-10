import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FleetRegistryView } from '../views/FleetRegistryView';
import { useMapStore } from '../store/useMapStore';
import { UserRolePersona } from '../types/audit';

const personas: UserRolePersona[] = ['Administrator', 'C Admin', 'Submitter', 'Verifier', 'Inspector', 'Approver'];

describe('FleetRegistryView Add Vessel action (Task 5516)', () => {
  beforeEach(() => {
    useMapStore.setState({ isAuthenticated: true });
  });

  personas.forEach((persona) => {
    it(`opens vessel registration modal safely without white screen crash as ${persona}`, () => {
      useMapStore.setState({ activePersona: persona });
      render(<FleetRegistryView />);
      const btn = screen.queryByRole('button', { name: 'Add Vessel' });
      if (btn) {
        fireEvent.click(btn);
        expect(screen.getByRole('heading', { name: 'Add Vessel' })).toBeInTheDocument();
        expect(screen.getByText('Complete each section to add the vessel.')).toBeInTheDocument();
      }
    });
  });
});
