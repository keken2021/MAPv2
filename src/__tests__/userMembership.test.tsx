import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { UserModal } from '../components/modals/UserModal';
import { useMapStore } from '../store/useMapStore';
import { checkEmailForMembership, personIdFor } from '../utils/membershipHelpers';
import { MOCK_USERS } from '../store/mockData';

const NW = 'Northwind Marine Pty Ltd';
const BV = 'Bureau Veritas Inspectorate';

describe('checkEmailForMembership (ADR 0037)', () => {
  it('rejects an email already used in this organization', () => {
    expect(checkEmailForMembership(MOCK_USERS, 's.girard@bureauveritas.com', BV).kind).toBe('same-organization');
  });

  it('offers a person from another organization as a new member', () => {
    const chen = MOCK_USERS.find((u) => u.id === 'USR-102')!;
    const check = checkEmailForMembership(MOCK_USERS, chen.email, BV);
    expect(check).toMatchObject({ kind: 'other-organization', person: { id: 'USR-102' } });
  });

  it('ignores the edited person and their other memberships', () => {
    const girardNw = MOCK_USERS.find((u) => u.id === 'USR-250')!;
    expect(checkEmailForMembership(MOCK_USERS, girardNw.email, NW, girardNw).kind).toBe('free');
  });

  it('reuses an existing person id', () => {
    expect(personIdFor({ id: 'USR-1', personId: 'PER-X' })).toBe('PER-X');
    expect(personIdFor({ id: 'USR-1' })).toBe('PER-USR-1');
  });
});

const initialState = useMapStore.getState();

describe('Users screen adds an existing person as a member', () => {
  beforeEach(() => {
    useMapStore.setState(initialState, true);
    useMapStore.setState({ activePersona: 'Administrator', activeDemoOrganization: NW });
  });

  const fillAndSubmit = (name: string, email: string) => {
    render(<UserModal isOpen={true} onClose={vi.fn()} mode="add" />);
    fireEvent.click(screen.getByLabelText(/Organization Member/));
    fireEvent.change(screen.getByPlaceholderText('e.g. Captain H. Vance'), { target: { value: name } });
    fireEvent.change(screen.getByPlaceholderText('name@organization.com'), { target: { value: email } });
    fireEvent.submit(screen.getByPlaceholderText('name@organization.com').closest('form')!);
  };

  it('asks before linking, then creates a linked record and leaves the other membership as it was', () => {
    const before = useMapStore.getState().users.length;
    fillAndSubmit('A. Fontaine', 'a.fontaine@bureauveritas.com');
    expect(screen.getByTestId('existing-person-membership')).toBeInTheDocument();
    expect(useMapStore.getState().users).toHaveLength(before);

    fireEvent.click(screen.getByRole('button', { name: 'Add as member' }));
    const users = useMapStore.getState().users;
    expect(users).toHaveLength(before + 1);
    const fontaine = users.find((u) => u.email === 'a.fontaine@bureauveritas.com' && u.organization === BV)!;
    const added = users.find((u) => u.email === 'a.fontaine@bureauveritas.com' && u.organization === NW)!;
    expect(added.personId).toBeTruthy();
    expect(added.personId).toBe(fontaine.personId);
    expect(fontaine.status).toBe('Active');
    expect(fontaine.roles).toEqual(MOCK_USERS.find((u) => u.id === fontaine.id)!.roles);
  });

  it('still rejects an email already used in this organization', () => {
    const chen = MOCK_USERS.find((u) => u.id === 'USR-102')!;
    fillAndSubmit('Someone', chen.email);
    expect(screen.getByText(/already exists in the system/)).toBeInTheDocument();
    expect(screen.queryByTestId('existing-person-membership')).toBeNull();
  });

  it('deactivating one membership leaves the other active', () => {
    const girardBv = useMapStore.getState().users.find((u) => u.id === 'USR-244')!;
    useMapStore.getState().updateUser({ ...girardBv, status: 'Inactive' });
    expect(useMapStore.getState().users.find((u) => u.id === 'USR-250')?.status).toBe('Active');
  });
});
