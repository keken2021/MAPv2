/*
  file summary: Roles & Permissions user picker uses SearchableSelect with keyboard selection.
  role in system: automated coverage for Task 5444.
*/

import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RolesAndPermissionsView } from '../views/RolesAndPermissionsView';
import { useMapStore } from '../store/useMapStore';
import { MOCK_USERS } from '../store/mockData';

const initialState = useMapStore.getState();

describe('roles user searchable select', () => {
  beforeEach(() => {
    useMapStore.setState(
      {
        ...initialState,
        isAuthenticated: true,
        activePersona: 'Administrator',
        activeDemoOrganization: 'Northwind Marine Pty Ltd',
        users: MOCK_USERS,
      },
      true,
    );
  });
  afterEach(cleanup);

  it('picks a user by keyboard from SearchableSelect', () => {
    render(<RolesAndPermissionsView />);
    fireEvent.click(screen.getByRole('button', { name: /user permissions/i }));

    const input = screen.getByRole('combobox', { name: /search users/i });
    expect(input).toBeInTheDocument();

    const target =
      MOCK_USERS.find((u) => u.name && u.name.length > 5) || MOCK_USERS[0];
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: target.name } });
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getByText(new RegExp(`selected ${target.name}`, 'i'))).toBeInTheDocument();
  });
});
