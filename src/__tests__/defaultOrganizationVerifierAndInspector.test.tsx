// Verifier and Inspector default to existing users of chosen organization (Sentinel Cyber Assurance and others).
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { AssuranceDetailView } from '../views/AssuranceDetailView';
import {
  defaultOrganizationVerifier,
  defaultOrganizationInspector,
  defaultOrganizationApprover,
  PENDING_ASSIGNMENT,
} from '../utils/userRoleHelpers';
import { isAssuranceSetAssignedToPersona } from '../utils/rbacHelpers';
import { UserProfile } from '../types/user';
import {
  clickNext,
  defaultWizardVesselId,
  renderWizardWithDefaultVessel,
} from './assuranceWizardTestHelpers';

const initialState = useMapStore.getState();
const SENTINEL = 'Sentinel Cyber Assurance';
const BUREAU_VERITAS = 'Bureau Veritas Inspectorate';
const COASTAL_FUEL = 'Coastal Fuel Testing';
const NO_REVIEWER_ORG = 'Harbourline Terminals';

const user = (overrides: Partial<UserProfile>): UserProfile =>
  ({
    id: 'USR-TEST-1',
    name: 'Test Person',
    email: 'test@example.com',
    roles: ['Verifier'],
    userType: 'Third-Party',
    organization: SENTINEL,
    departmentOrScope: 'Assurance',
    status: 'Active',
    lastActive: '2026-11-12 08:00 UTC',
    ...overrides,
  }) as UserProfile;

describe('defaultOrganizationVerifier and defaultOrganizationInspector unit helpers', () => {
  it('defaults Sentinel Cyber Assurance verifier to R. Singh', () => {
    const verifier = defaultOrganizationVerifier(initialState.users, SENTINEL);
    expect(verifier).toBeDefined();
    expect(verifier?.name).toBe('R. Singh');
    expect(verifier?.id).toBe('USR-241');
  });

  it('defaults Sentinel Cyber Assurance inspector to M. Laurent', () => {
    const inspector = defaultOrganizationInspector(initialState.users, SENTINEL);
    expect(inspector).toBeDefined();
    expect(inspector?.name).toBe('M. Laurent');
    expect(inspector?.id).toBe('USR-242');
  });

  it('defaults Bureau Veritas Inspectorate verifier to S. Girard', () => {
    const verifier = defaultOrganizationVerifier(initialState.users, BUREAU_VERITAS);
    expect(verifier).toBeDefined();
    expect(verifier?.name).toBe('S. Girard');
  });

  it('defaults Bureau Veritas Inspectorate inspector to N. Technical and avoids assigning verifier', () => {
    const verifier = defaultOrganizationVerifier(initialState.users, BUREAU_VERITAS);
    const inspector = defaultOrganizationInspector(initialState.users, BUREAU_VERITAS, {
      excludeUserId: verifier?.id,
      excludeUserName: verifier?.name,
    });
    expect(inspector).toBeDefined();
    expect(inspector?.name).toBe('N. Technical');
    expect(inspector?.id).not.toBe(verifier?.id);
  });

  it('defaults Coastal Fuel Testing verifier and inspector', () => {
    const verifier = defaultOrganizationVerifier(initialState.users, COASTAL_FUEL);
    expect(verifier?.name).toBe('N. Brooks');
    const inspector = defaultOrganizationInspector(initialState.users, COASTAL_FUEL);
    expect(inspector?.name).toBe('F. Ibarra');
  });

  it('returns undefined when organization has no eligible reviewer users', () => {
    expect(defaultOrganizationVerifier(initialState.users, NO_REVIEWER_ORG)).toBeUndefined();
    expect(defaultOrganizationInspector(initialState.users, NO_REVIEWER_ORG)).toBeUndefined();
    expect(defaultOrganizationVerifier([], SENTINEL)).toBeUndefined();
  });

  it('skips inactive users and picks active users', () => {
    const inactiveVerifier = user({ id: 'USR-INACT', name: 'Inactive Verifier', status: 'Inactive', roles: ['Verifier'] });
    const activeAdmin = user({ id: 'USR-ACT-ADM', name: 'Active Admin', status: 'Active', roles: ['Administrator'] });
    const verifier = defaultOrganizationVerifier([inactiveVerifier, activeAdmin], SENTINEL);
    expect(verifier?.id).toBe('USR-ACT-ADM');
  });

  describe('defaultOrganizationApprover cases', () => {
    it('defaults Marine Assurance Authority to its Approver (P. Nardelli)', () => {
      const approver = defaultOrganizationApprover(initialState.users, 'Marine Assurance Authority');
      expect(approver).toBeDefined();
      expect(approver?.name).toBe('P. Nardelli');
      expect(approver?.id).toBe('USR-204');
    });

    it('returns C Admin when an organization has only a C Admin', () => {
      const cAdminOnly = user({
        id: 'USR-CADM-ONLY',
        name: 'C. Administrator',
        roles: ['C Admin'],
        organization: 'C Admin Only Org',
      });
      const approver = defaultOrganizationApprover([cAdminOnly], 'C Admin Only Org');
      expect(approver).toBeDefined();
      expect(approver?.name).toBe('C. Administrator');
      expect(approver?.id).toBe('USR-CADM-ONLY');
    });

    it('returns undefined when an organization has an Administrator only', () => {
      const adminOnly = user({
        id: 'USR-ADMIN-ONLY',
        name: 'A. Administrator',
        roles: ['Administrator'],
        organization: 'Admin Only Org',
      });
      const approver = defaultOrganizationApprover([adminOnly], 'Admin Only Org');
      expect(approver).toBeUndefined();
    });

    it('skips the excluded Verifier unless no one else is left', () => {
      const verifierAndApprover = user({
        id: 'USR-DUAL-1',
        name: 'V. Verifier',
        roles: ['Verifier', 'Approver'],
        organization: 'Dual Role Org',
      });
      const secondApprover = user({
        id: 'USR-DUAL-2',
        name: 'S. Approver',
        roles: ['Approver'],
        organization: 'Dual Role Org',
      });

      // Excluded verifier is skipped when second approver is available
      const approverWithAlternative = defaultOrganizationApprover(
        [verifierAndApprover, secondApprover],
        'Dual Role Org',
        { excludeUserId: 'USR-DUAL-1', excludeUserName: 'V. Verifier' },
      );
      expect(approverWithAlternative?.id).toBe('USR-DUAL-2');
      expect(approverWithAlternative?.name).toBe('S. Approver');

      // Excluded verifier is chosen when no one else is left
      const approverSolo = defaultOrganizationApprover(
        [verifierAndApprover],
        'Dual Role Org',
        { excludeUserId: 'USR-DUAL-1', excludeUserName: 'V. Verifier' },
      );
      expect(approverSolo?.id).toBe('USR-DUAL-1');
    });

    it('returns the new user for Austral Classification Society', () => {
      const users = useMapStore.getState().users;
      const approver = defaultOrganizationApprover(users, 'Austral Classification Society');
      expect(approver).toBeDefined();
      expect(approver?.id).toBe('USR-251');
      expect(approver?.organization).toBe('Austral Classification Society');
      expect(approver?.roles).toContain('Approver');
    });
  });

  describe('isAssuranceSetAssignedToPersona for third-party Approver', () => {
    it('is true for verified set and false while not yet verified', () => {
      const approverUser: UserProfile = {
        id: 'USR-204',
        name: 'P. Nardelli',
        email: 'p.nardelli@marine-assurance.gov.au',
        roles: ['Approver'],
        userType: 'Third-Party',
        organization: 'Marine Assurance Authority',
        departmentOrScope: 'Executive Vetting & Sign-Off',
        status: 'Active',
        lastActive: '2026-09-19 14:00 UTC',
      };
      const org = 'Marine Assurance Authority';

      const baseSet = {
        ...initialState.assuranceSets[0],
        id: 'AS-TEST-APPROVER-VISIBILITY',
        assignedApprover: 'P. Nardelli (Marine Assurance Authority)',
        stakeholders: {
          approverId: 'USR-204',
          approverName: 'P. Nardelli',
          approverOrg: 'Marine Assurance Authority',
        },
      };

      // 1. Not yet verified (Initiated stage with pending mandatory requirement)
      const unverifiedSet = {
        ...baseSet,
        stage: 'Initiated' as const,
        approverDecision: 'Pending' as const,
        requirements: [
          {
            ...initialState.assuranceSets[0].requirements[0],
            isMandatory: true,
            verifierStatus: 'Pending' as const,
            isFulfilled: false,
          },
        ],
      };
      expect(isAssuranceSetAssignedToPersona(unverifiedSet, 'Approver', org, approverUser)).toBe(false);

      // 2. Verified (stage is Approval or all requirements verified)
      const verifiedSet = {
        ...baseSet,
        stage: 'Approval' as const,
        approverDecision: 'Pending' as const,
        requirements: [
          {
            ...initialState.assuranceSets[0].requirements[0],
            isMandatory: true,
            verifierStatus: 'Verified' as const,
            isFulfilled: true,
          },
        ],
      };
      expect(isAssuranceSetAssignedToPersona(verifiedSet, 'Approver', org, approverUser)).toBe(true);
    });
  });
});

describe('Assurance wizard - Sentinel Cyber Assurance and other organizations default stakeholders', () => {
  beforeEach(() => {
    useMapStore.setState(initialState, true);
  });

  it('defaults Sentinel Cyber Assurance verifier and inspector upon organization selection in wizard', () => {
    const vesselId = defaultWizardVesselId();
    const { container } = renderWizardWithDefaultVessel(vesselId);

    fireEvent.change(container.querySelector('#grid-campaign-title') as HTMLInputElement, {
      target: { value: 'Sentinel Cyber Assurance Campaign' },
    });

    // Add Sentinel Cyber Assurance
    const addOrgInput = container.querySelector('#grid-add-organization') as HTMLInputElement;
    fireEvent.focus(addOrgInput);
    fireEvent.change(addOrgInput, { target: { value: SENTINEL } });
    const option = container.querySelector(`#grid-add-organization-listbox [data-item-id="${SENTINEL}"]`);
    if (option) fireEvent.click(option);

    // Tick Verifier and Inspector for Sentinel, and Approver for Chevron (Client)
    const sentinelVerifier = screen.getByRole('checkbox', { name: `Verifier: ${SENTINEL}` });
    fireEvent.click(sentinelVerifier);

    const sentinelInspector = screen.getByRole('checkbox', { name: `Inspector: ${SENTINEL}` });
    fireEvent.click(sentinelInspector);

    const approverBoxes = screen.getAllByRole('checkbox', { name: /^Approver: / }) as HTMLInputElement[];
    const enabledApprover = approverBoxes.find((b) => !b.disabled && !b.checked)!;
    fireEvent.click(enabledApprover);

    // Step 1 table displays defaulted verifier and inspector for Sentinel
    expect(container.textContent).toContain('Verifier: R. Singh');
    expect(container.textContent).toContain('Inspector: M. Laurent');

    // Proceed to Step 4 Review
    clickNext();
    clickNext();
    clickNext();

    // Review step shows full labels with organization
    expect(container.textContent).toContain(`Verifier: R. Singh (${SENTINEL})`);
    expect(container.textContent).toContain(`Inspector: M. Laurent (${SENTINEL})`);

    // Submit and verify created assurance set
    fireEvent.click(screen.getByRole('button', { name: /Create Assurance Set/i }));

    const created = useMapStore
      .getState()
      .assuranceSets.find((s) => s.title === 'Sentinel Cyber Assurance Campaign')!;
    expect(created).toBeDefined();

    expect(created.assignedVerifier).toBe(`R. Singh (${SENTINEL})`);
    expect(created.assignedInspector).toBe(`M. Laurent (${SENTINEL})`);
    expect(created.stakeholders?.verifierOrg).toBe(SENTINEL);
    expect(created.stakeholders?.verifierId).toBe('USR-241');
    expect(created.stakeholders?.verifierName).toBe('R. Singh');
    expect(created.stakeholders?.inspectorOrg).toBe(SENTINEL);
    expect(created.stakeholders?.inspectorId).toBe('USR-242');
    expect(created.stakeholders?.inspectorName).toBe('M. Laurent');

    // Requirements carry the assigned verifier
    expect(created.requirements.length).toBeGreaterThan(0);
    expect(created.requirements.every((r) => r.assignedVerifier === `R. Singh (${SENTINEL})`)).toBe(true);
    expect(created.requirements.every((r) => r.verifierId === 'USR-241')).toBe(true);
  });

  it('leaves organization with no reviewer users as Pending Assignment', () => {
    const vesselId = defaultWizardVesselId();
    const { container } = renderWizardWithDefaultVessel(vesselId);

    fireEvent.change(container.querySelector('#grid-campaign-title') as HTMLInputElement, {
      target: { value: 'Harbourline Reviewer Campaign' },
    });

    // Add Harbourline Terminals
    const addOrgInput = container.querySelector('#grid-add-organization') as HTMLInputElement;
    fireEvent.focus(addOrgInput);
    fireEvent.change(addOrgInput, { target: { value: NO_REVIEWER_ORG } });
    const option = container.querySelector(`#grid-add-organization-listbox [data-item-id="${NO_REVIEWER_ORG}"]`);
    if (option) fireEvent.click(option);

    // Tick Verifier and Inspector for Harbourline, and Approver for Chevron (Client)
    const verifierBox = screen.getByRole('checkbox', { name: `Verifier: ${NO_REVIEWER_ORG}` });
    fireEvent.click(verifierBox);

    const inspectorBox = screen.getByRole('checkbox', { name: `Inspector: ${NO_REVIEWER_ORG}` });
    fireEvent.click(inspectorBox);

    const approverBoxes = screen.getAllByRole('checkbox', { name: /^Approver: / }) as HTMLInputElement[];
    const enabledApprover = approverBoxes.find((b) => !b.disabled && !b.checked)!;
    fireEvent.click(enabledApprover);

    // Step 1 table displays pending
    expect(container.textContent).toContain('Verifier: pending');
    expect(container.textContent).toContain('Inspector: pending');

    // Proceed to Step 4 Review
    clickNext();
    clickNext();
    clickNext();

    expect(container.textContent).toContain(`Pending, ${NO_REVIEWER_ORG}`);

    // Submit and verify created assurance set
    fireEvent.click(screen.getByRole('button', { name: /Create Assurance Set/i }));

    const created = useMapStore
      .getState()
      .assuranceSets.find((s) => s.title === 'Harbourline Reviewer Campaign')!;
    expect(created).toBeDefined();
    expect(created.assignedVerifier).toBe(PENDING_ASSIGNMENT);
    expect(created.assignedInspector).toBe(PENDING_ASSIGNMENT);
    expect(created.requirements.every((r) => r.assignedVerifier === PENDING_ASSIGNMENT)).toBe(true);
  });

  it('defaults ABS verifier to H. Vance when chosen as verifier organization in wizard Step 1', () => {
    const vesselId = defaultWizardVesselId();
    const { container } = renderWizardWithDefaultVessel(vesselId);

    const addOrgInput = container.querySelector('#grid-add-organization') as HTMLInputElement;
    fireEvent.focus(addOrgInput);
    fireEvent.change(addOrgInput, { target: { value: 'ABS' } });
    const option = container.querySelector('#grid-add-organization-listbox [data-item-id="ABS"]');
    if (option) fireEvent.click(option);

    const absVerifier = screen.getByRole('checkbox', { name: 'Verifier: ABS' });
    fireEvent.click(absVerifier);

    expect(container.textContent).toContain('Verifier: H. Vance');
  });

  it('AssuranceDetailView resolves pending stakeholder label to existing user for Sentinel Cyber Assurance', () => {
    const template = useMapStore.getState().assuranceSets[0];
    useMapStore.setState((state) => ({
      activePersona: 'C Admin',
      activeDemoOrganization: template.clientOrg || 'Chevron Australia Pty Ltd',
      activeSessionUserId: 'USR-221',
      assuranceSets: [
        {
          ...template,
          id: 'AS-SENTINEL-PENDING',
          title: 'Sentinel Pending Detail Test',
          stakeholders: {
            verifierOrg: SENTINEL,
            inspectorOrg: SENTINEL,
          },
          assignedVerifier: PENDING_ASSIGNMENT,
          assignedInspector: PENDING_ASSIGNMENT,
        },
        ...state.assuranceSets,
      ],
    }));

    const { container } = render(<AssuranceDetailView setId="AS-SENTINEL-PENDING" />);

    expect(container.textContent).toContain(`R. Singh (${SENTINEL})`);
    expect(container.textContent).toContain(`M. Laurent (${SENTINEL})`);
  });

  it('defaults Marine Assurance Authority approver to P. Nardelli and shows set to approver after verification', () => {
    const vesselId = defaultWizardVesselId();
    const { container } = renderWizardWithDefaultVessel(vesselId);

    fireEvent.change(container.querySelector('#grid-campaign-title') as HTMLInputElement, {
      target: { value: 'MAA Approver Campaign' },
    });

    const MAA = 'Marine Assurance Authority';
    const addOrgInput = container.querySelector('#grid-add-organization') as HTMLInputElement;
    fireEvent.focus(addOrgInput);
    fireEvent.change(addOrgInput, { target: { value: MAA } });
    const option = container.querySelector(`#grid-add-organization-listbox [data-item-id="${MAA}"]`);
    if (option) fireEvent.click(option);

    const verifierBox = screen.getByRole('checkbox', { name: /Verifier: Northwind Marine/ });
    fireEvent.click(verifierBox);

    const inspectorBox = screen.getByRole('checkbox', { name: /Inspector: Northwind Marine/ });
    fireEvent.click(inspectorBox);

    const maaApprover = screen.getByRole('checkbox', { name: `Approver: ${MAA}` });
    fireEvent.click(maaApprover);

    clickNext();
    clickNext();
    clickNext();

    expect(container.textContent).toContain(`Approver: P. Nardelli (${MAA})`);
    expect(container.textContent).not.toContain(`Pending, ${MAA}`);

    fireEvent.click(screen.getByRole('button', { name: /Create Assurance Set/i }));

    const created = useMapStore
      .getState()
      .assuranceSets.find((s) => s.title === 'MAA Approver Campaign')!;
    expect(created).toBeDefined();
    expect(created.assignedApprover).toBe(`P. Nardelli (${MAA})`);
    expect(created.stakeholders?.approverOrg).toBe(MAA);
    expect(created.stakeholders?.approverName).toBe('P. Nardelli');
    expect(created.stakeholders?.approverId).toBe('USR-204');

    const approverUser = useMapStore.getState().users.find((u) => u.id === 'USR-204')!;
    const unverifiedSet = {
      ...created,
      stage: 'Initiated' as const,
      requirements: [
        {
          ...created.requirements[0],
          isMandatory: true,
          verifierStatus: 'Pending' as const,
          isFulfilled: false,
        },
      ],
    };
    expect(isAssuranceSetAssignedToPersona(unverifiedSet, 'Approver', MAA, approverUser)).toBe(false);

    const verifiedSet = {
      ...created,
      stage: 'Approval' as const,
      requirements: created.requirements.map((r) => ({ ...r, verifierStatus: 'Verified' as const, isFulfilled: true })),
    };
    expect(isAssuranceSetAssignedToPersona(verifiedSet, 'Approver', MAA, approverUser)).toBe(true);
  });

  it('AssuranceDetailView resolves pending stakeholder label to existing user for Marine Assurance Authority Approver', () => {
    const template = useMapStore.getState().assuranceSets[0];
    useMapStore.setState((state) => ({
      activePersona: 'C Admin',
      activeDemoOrganization: template.clientOrg || 'Chevron Australia Pty Ltd',
      activeSessionUserId: 'USR-221',
      assuranceSets: [
        {
          ...template,
          id: 'AS-MAA-APPROVER-PENDING',
          title: 'MAA Pending Detail Test',
          stakeholders: {
            approverOrg: 'Marine Assurance Authority',
          },
          assignedApprover: PENDING_ASSIGNMENT,
        },
        ...state.assuranceSets,
      ],
    }));

    const { container } = render(<AssuranceDetailView setId="AS-MAA-APPROVER-PENDING" />);

    expect(container.textContent).toContain('P. Nardelli (Marine Assurance Authority)');
  });
});
