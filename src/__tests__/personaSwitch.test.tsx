import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, act } from '@testing-library/react';
import { DashboardView } from '../views/DashboardView';
import { useMapStore } from '../store/useMapStore';

describe('Persona switch on DashboardView', () => {
  it('does not throw when switching persona between Administrator, Verifier, Inspector, and Approver', () => {
    useMapStore.setState({ activePersona: 'Administrator', isAuthenticated: true });
    const { rerender } = render(<DashboardView />);

    const personas = ['Verifier', 'Inspector', 'Approver', 'Submitter', 'C Admin', 'Administrator'] as const;

    for (const persona of personas) {
      expect(() => {
        act(() => {
          useMapStore.setState({ activePersona: persona });
        });
        rerender(<DashboardView />);
      }).not.toThrow();
    }
  });
});
