// Verifier and Inspector default to existing users of chosen organization (Sentinel Cyber Assurance and others).
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { AssuranceDetailView } from '../views/AssuranceDetailView';
import {
  defaultOrganizationVerifier,
  defaultOrganizationInspector,
  PENDING_ASSIGNMENT,
} from '../utils/userRoleHelpers';
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
});
