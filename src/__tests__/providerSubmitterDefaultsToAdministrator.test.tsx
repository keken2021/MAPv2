// A Provider always has a submitter: its Submitter, else its Administrator (ADR 0038).
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { defaultProviderSubmitter, PENDING_ASSIGNMENT, userHasRole } from '../utils/userRoleHelpers';
import { UserProfile } from '../types/user';
import {
  clickNext,
  defaultWizardVesselId,
  pickReviewerRoles,
  renderWizardWithDefaultVessel,
} from './assuranceWizardTestHelpers';

const initialState = useMapStore.getState();
const PROVIDER = 'Northwind Marine Pty Ltd';

const user = (overrides: Partial<UserProfile>): UserProfile =>
  ({
    id: 'USR-T',
    name: 'T. User',
    email: 't@example.com',
    roles: ['Submitter'],
    userType: 'Organization',
    organization: PROVIDER,
    departmentOrScope: 'Operations',
    status: 'Active',
    lastActive: '2026-11-12 08:00 UTC',
    ...overrides,
  }) as UserProfile;

describe('defaultProviderSubmitter', () => {
  const admin = user({ id: 'USR-A', name: 'A. Admin', roles: ['Administrator'] });
  const submitter = user({ id: 'USR-S', name: 'S. Submitter' });

  it('picks the Submitter before the Administrator', () => {
    expect(defaultProviderSubmitter([admin, submitter], PROVIDER)?.id).toBe('USR-S');
  });

  it('falls back to the Administrator when the organization has no Submitter', () => {
    expect(defaultProviderSubmitter([admin], PROVIDER)?.id).toBe('USR-A');
  });

  it('skips inactive users and users of other organizations', () => {
    const inactive = user({ id: 'USR-I', status: 'Inactive' });
    const other = user({ id: 'USR-O', organization: 'Other Org Pty Ltd' });
    expect(defaultProviderSubmitter([inactive, other, admin], PROVIDER)?.id).toBe('USR-A');
    expect(defaultProviderSubmitter([inactive, other], PROVIDER)).toBeUndefined();
  });
});

describe('Assurance wizard - Provider with no Submitter', () => {
  /* the wizard's default vessel belongs to Meridian, whose Administrator is D. Vance */
  const VESSEL_OWNER = 'Meridian Marine Services Pty Ltd';

  beforeEach(() => {
    useMapStore.setState(initialState, true);
    const users = initialState.users.map((u) =>
      u.organization === VESSEL_OWNER && userHasRole(u, 'Submitter') ? { ...u, status: 'Inactive' as const } : u,
    );
    useMapStore.setState({ assuranceSets: [], users });
  });

  it('names the Provider Administrator as submitter instead of leaving it pending', () => {
    const vesselId = defaultWizardVesselId();
    expect(useMapStore.getState().vessels.find((v) => v.id === vesselId)?.registeredOwner).toBe(VESSEL_OWNER);
    const { container } = renderWizardWithDefaultVessel(vesselId);
    fireEvent.change(container.querySelector('#grid-campaign-title') as HTMLInputElement, {
      target: { value: 'Admin Submitter Vetting' },
    });
    pickReviewerRoles(container);
    clickNext();
    clickNext();
    clickNext();
    fireEvent.click(screen.getByRole('button', { name: /Create Assurance Set/i }));

    const created = useMapStore.getState().assuranceSets.find((set) => set.title === 'Admin Submitter Vetting')!;
    const provider = created.submitters?.find((s) => s.organization === VESSEL_OWNER);
    expect(provider?.assignee).toBe(`D. Vance (${VESSEL_OWNER})`);
    expect(created.assignedSubmitter).not.toBe(PENDING_ASSIGNMENT);
    expect(created.requirements.some((r) => r.assignedSubmitter === PENDING_ASSIGNMENT)).toBe(false);
  });
});
