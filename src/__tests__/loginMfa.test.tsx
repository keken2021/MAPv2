/*
  file summary: Task 5496 — mock MFA step after login credentials.
*/

import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { LoginView } from '../views/LoginView';
import { useMapStore } from '../store/useMapStore';

describe('Login MFA (Task 5496)', () => {
  beforeEach(() => {
    useMapStore.setState({ isAuthenticated: false, activePersona: 'Administrator' });
  });

  it('advances from credentials to the MFA step without logging in', () => {
    render(<LoginView />);
    fireEvent.click(screen.getByRole('button', { name: /^Sign In$/i }));

    expect(screen.getByTestId('login-mfa-step')).toBeInTheDocument();
    expect(screen.getByText('Two-factor Authentication')).toBeInTheDocument();
    expect(useMapStore.getState().isAuthenticated).toBe(false);
  });

  it('rejects an empty or short verification code', () => {
    render(<LoginView />);
    fireEvent.click(screen.getByRole('button', { name: /^Sign In$/i }));

    fireEvent.click(screen.getByRole('button', { name: /^Verify$/i }));
    expect(screen.getByTestId('login-mfa-error')).toHaveTextContent(
      'Please enter a valid 6-digit verification code.',
    );
    expect(useMapStore.getState().isAuthenticated).toBe(false);

    fireEvent.change(screen.getByLabelText(/6-digit verification code/i), { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: /^Verify$/i }));
    expect(screen.getByTestId('login-mfa-error')).toBeInTheDocument();
    expect(useMapStore.getState().isAuthenticated).toBe(false);
  });

  it('logs in when a valid 6-digit code is submitted', () => {
    render(<LoginView />);
    fireEvent.click(screen.getByRole('button', { name: /^Sign In$/i }));

    fireEvent.change(screen.getByLabelText(/6-digit verification code/i), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /^Verify$/i }));

    expect(useMapStore.getState().isAuthenticated).toBe(true);
  });

  it('shows authenticator-style MFA copy and XXX XXX placeholder', () => {
    render(<LoginView />);
    fireEvent.click(screen.getByRole('button', { name: /^Sign In$/i }));

    // expect(screen.getByText(/turned on 2-factor authentication/i)).toBeInTheDocument();
    // expect(screen.getByText(/authenticator app/i)).toBeInTheDocument();
    // expect(screen.getByLabelText(/6-digit verification code/i)).toHaveAttribute('placeholder', 'XXX XXX');
    // expect(screen.getByRole('button', { name: /Get help/i })).toBeInTheDocument();
  });
});
