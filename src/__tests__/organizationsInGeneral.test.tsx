/*
  file summary: the organization list on General that objects and stakeholders come from.
  responsibilities: covers the five organization rules, the object picker that shows listed organizations first, the submitter found in the library, pending roles, and the admin who chooses the person.
  role in system: covers projectHelpers.ts, userRoleHelpers.ts, SearchableSelect.tsx, CreateAssuranceSetView.tsx and updateAssuranceStakeholder in useMapStore.ts.
*/

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { CreateAssuranceSetView } from '../views/CreateAssuranceSetView';
import { SearchableSelect } from '../components/common/SearchableSelect';
import {
  crewToAssuranceObject,
  equipmentToAssuranceObject,
  SEEDED_OPERATIONAL_OBJECTS,
  vesselToAssuranceObject,
} from '../utils/assuranceTemplates';
import {
  addObjectOwners,
  eligibleReviewers,
  objectOwnerOrganizations,
  organizationInUse,
  setOrganizations,
  setProviders,
  taskProvider,
} from '../utils/projectHelpers';
import {
  canAssignStakeholderRole,
  findObjectSubmitter,
  getOrganizationRoleCandidates,
  getStakeholderRoleOrganization,
  PENDING_ASSIGNMENT,
  setSubmitters,
  validateStakeholderAssignmentForSet,
} from '../utils/userRoleHelpers';
import { UserProfile } from '../types/user';
import { isAssuranceSetAssignedToPersona } from '../utils/rbacHelpers';
import { AssuranceSet } from '../types/assurance';
import { addObject, clickNext, objectItemSelect, objectPickerOptions, objectRowIds, pickReviewerRoles, removeObjectRow, renderWizardWithDefaultVessel } from './assuranceWizardTestHelpers';

const initialState = useMapStore.getState();

const CLIENT = 'Chevron Australia Pty Ltd';
const PROVIDER = 'Northwind Marine Pty Ltd';
const THIRD_PARTY = 'Bureau Veritas Inspectorate';

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
    lastActive: '2026-10-29 08:00 UTC',
    ...overrides,
  }) as UserProfile;

describe('organization list', () => {
  it('adds an unlisted object owner once and skips owner placeholders', () => {
    const listed = [CLIENT];
    const next = addObjectOwners(listed, [
      { ownerOrganization: PROVIDER },
      { ownerOrganization: PROVIDER.toUpperCase() },
      { ownerOrganization: 'Vessel Provider' },
    ]);
    expect(next).toEqual([CLIENT, PROVIDER]);
    expect(objectOwnerOrganizations([{ ownerOrganization: 'Crew Provider' }])).toEqual([]);
  });

  it('returns the same list when no owner is new', () => {
    const listed = [CLIENT, PROVIDER];
    expect(addObjectOwners(listed, [{ ownerOrganization: PROVIDER }])).toBe(listed);
  });

  it('reads a vessel owner from its registered owner, not a placeholder', () => {
    const object = vesselToAssuranceObject({ id: 'V-1', name: 'MV Test', registeredOwner: PROVIDER });
    expect(object.ownerOrganization).toBe(PROVIDER);
  });

  it('builds the list of a seeded set from what it already stores', () => {
    const organizations = setOrganizations({
      clientOrg: CLIENT,
      serviceProviderOrg: PROVIDER,
      assignedVerifier: `A. Fontaine (${THIRD_PARTY})`,
      assignedInspector: PENDING_ASSIGNMENT,
      assuranceObjects: [{ ownerOrganization: 'Tidewater Marine' }],
    } as AssuranceSet);
    expect(organizations).toEqual([CLIENT, PROVIDER, THIRD_PARTY, 'Tidewater Marine']);
  });

  it('prefers the recorded list', () => {
    expect(setOrganizations({ organizations: [CLIENT], serviceProviderOrg: PROVIDER } as AssuranceSet)).toEqual([CLIENT]);
  });

  it('makes every object owner a provider, with non-client owners first', () => {
    expect(setProviders([{ ownerOrganization: CLIENT }, { ownerOrganization: PROVIDER }], CLIENT)).toEqual([PROVIDER, CLIENT]);
    expect(setProviders([{ ownerOrganization: PROVIDER }], CLIENT)).toEqual([PROVIDER]);
    expect(setProviders([], CLIENT)).toEqual([CLIENT]);
    expect(setProviders([], CLIENT, THIRD_PARTY)).toEqual([THIRD_PARTY]);
  });

  it('gives a task to the owner of its object, then of its type', () => {
    const objects = [
      { id: 'V-1', type: 'vessel' as const, ownerOrganization: PROVIDER },
      { id: 'E-1', type: 'equipment' as const, ownerOrganization: THIRD_PARTY },
    ];
    const providers = [PROVIDER, THIRD_PARTY];
    expect(taskProvider(objects, providers, 'Vessel', 'E-1')).toBe(THIRD_PARTY);
    expect(taskProvider(objects, providers, 'Equipment')).toBe(THIRD_PARTY);
    expect(taskProvider(objects, providers, 'Crew')).toBe(PROVIDER);
  });

  it('names why an organization in use cannot leave, and lets it go when free', () => {
    const objects = [{ name: 'MV Test', ownerOrganization: PROVIDER }];
    expect(organizationInUse(PROVIDER, objects, {})).toContain('MV Test');
    expect(organizationInUse(THIRD_PARTY, objects, { Verifier: THIRD_PARTY })).toContain('Verifier');
    expect(organizationInUse(THIRD_PARTY, objects, { Verifier: CLIENT })).toBeNull();
  });

  it('keeps an object owner off verifier and approver, except the client', () => {
    const organizations = [CLIENT, PROVIDER, THIRD_PARTY];
    const objects = [{ ownerOrganization: PROVIDER }, { ownerOrganization: CLIENT }];
    expect(eligibleReviewers(organizations, objects, CLIENT)).toEqual([CLIENT, THIRD_PARTY]);
  });
});

describe('roles and people', () => {
  const set = {
    clientOrg: CLIENT,
    assuranceObjects: [{ ownerOrganization: PROVIDER }],
    stakeholders: { submitterOrg: PROVIDER, verifierOrg: THIRD_PARTY },
    assignedVerifier: PENDING_ASSIGNMENT,
  };

  it('finds the organization of a role, from the stored value or the label', () => {
    expect(getStakeholderRoleOrganization(set, 'Verifier')).toBe(THIRD_PARTY);
    expect(getStakeholderRoleOrganization({ assignedApprover: 'P. Nardelli (Marine Assurance Authority)' }, 'Approver')).toBe('Marine Assurance Authority');
    expect(getStakeholderRoleOrganization({ serviceProviderOrg: PROVIDER }, 'Submitter')).toBe(PROVIDER);
  });

  it('lets only the admin of the role organization choose the person', () => {
    expect(canAssignStakeholderRole(set, 'Verifier', THIRD_PARTY)).toBe(true);
    expect(canAssignStakeholderRole(set, 'Verifier', CLIENT)).toBe(false);
  });

  it('reads every submitter, and builds one for an older set', () => {
    const submitters = [
      { organization: PROVIDER, assignee: 'M. Chen' },
      { organization: THIRD_PARTY, assignee: PENDING_ASSIGNMENT },
    ];
    expect(setSubmitters({ submitters })).toBe(submitters);
    expect(setSubmitters({ assignedSubmitter: `M. Chen (${PROVIDER})` })).toEqual([
      { organization: PROVIDER, assignee: `M. Chen (${PROVIDER})` },
    ]);
    expect(setSubmitters({})).toEqual([]);
  });

  it('lets each provider admin choose only its own submitter', () => {
    const shared = { submitters: [{ organization: PROVIDER, assignee: PENDING_ASSIGNMENT }, { organization: THIRD_PARTY, assignee: PENDING_ASSIGNMENT }] };
    expect(canAssignStakeholderRole(shared, 'Submitter', THIRD_PARTY, THIRD_PARTY)).toBe(true);
    expect(canAssignStakeholderRole(shared, 'Submitter', THIRD_PARTY, PROVIDER)).toBe(false);
  });

  it('keeps a submitter off verifier on every provider, not only the first', () => {
    const label = `A. Fontaine (${THIRD_PARTY})`;
    const result = validateStakeholderAssignmentForSet(
      { stakeholders: { verifierOrg: THIRD_PARTY }, submitters: [{ organization: PROVIDER, assignee: 'M. Chen' }, { organization: THIRD_PARTY, assignee: label }] },
      'Verifier',
      label,
      [],
    );
    expect(result.ok).toBe(false);
  });

  it('shows a set to any submitter on it', () => {
    const set = {
      submitters: [{ organization: PROVIDER, assignee: `M. Chen (${PROVIDER})` }, { organization: THIRD_PARTY, assignee: `A. Fontaine (${THIRD_PARTY})` }],
      assignedSubmitter: `M. Chen (${PROVIDER})`,
      requirements: [],
    } as unknown as AssuranceSet;
    expect(isAssuranceSetAssignedToPersona(set, 'Submitter', THIRD_PARTY, { id: 'U', name: 'A. Fontaine', organization: THIRD_PARTY, roles: ['Submitter'] })).toBe(true);
    expect(isAssuranceSetAssignedToPersona(set, 'Submitter', THIRD_PARTY, { id: 'U', name: 'S. Girard', organization: THIRD_PARTY, roles: ['Submitter'] })).toBe(false);
  });

  it('refuses a person from another organization, and an object owner as reviewer', () => {
    const wrong = validateStakeholderAssignmentForSet(set, 'Verifier', `M. Chen (${PROVIDER})`, []);
    expect(wrong).toEqual({ ok: false, message: expect.stringContaining('is not in') });
    const owner = validateStakeholderAssignmentForSet(
      { ...set, stakeholders: { verifierOrg: PROVIDER } },
      'Verifier',
      `M. Chen (${PROVIDER})`,
      [],
    );
    expect(owner).toEqual({ ok: false, message: expect.stringContaining('Object owner conflict') });
  });

  it('assigns the newest uploader in the library when they submit for the owner', () => {
    const chen = user({ id: 'USR-1', name: 'M. Chen' });
    const outsider = user({ id: 'USR-2', name: 'R. Sato', organization: 'Another Org' });
    const documents = [
      {
        vesselId: 'V-1',
        versions: [
          { uploadedBy: 'M. Chen', uploadedAt: '2026-01-01' },
          { uploadedBy: 'R. Sato', uploadedAt: '2026-02-01' },
          { uploadedBy: 'Document Vault Submitter', uploadedAt: '2026-03-01' },
        ],
      },
    ] as never[];
    const object = { id: 'V-1', ownerOrganization: PROVIDER };
    expect(findObjectSubmitter(object, documents, [chen, outsider])?.id).toBe('USR-1');
    expect(findObjectSubmitter({ ...object, id: 'V-2' }, documents, [chen])).toBeUndefined();
    expect(findObjectSubmitter(object, documents, [{ ...chen, status: 'Inactive' }])).toBeUndefined();
  });

  it('gives every organization an admin, so no pending role can stall', () => {
    const adminOrganizations = new Set(
      initialState.users
        .filter((u) => u.roles.includes('Administrator') || u.roles.includes('C Admin'))
        .map((u) => u.organization)
        .filter(Boolean),
    );
    expect(adminOrganizations.size).toBeGreaterThan(0);
    adminOrganizations.forEach((organization) => {
      const admins = initialState.users.filter(
        (u) => u.organization === organization && (u.roles.includes('Administrator') || u.roles.includes('C Admin')),
      );
      expect(admins.length, organization).toBeGreaterThan(0);
    });
  });

  it('lists only the people of the chosen organization', () => {
    const verifiers = getOrganizationRoleCandidates(initialState.users, THIRD_PARTY, 'Verifier');
    expect(verifiers.length).toBeGreaterThan(0);
    expect(verifiers.every((u) => u.organization === THIRD_PARTY)).toBe(true);
  });
});

describe('assigning a pending role', () => {
  const addPendingSet = () => {
    const template = useMapStore.getState().assuranceSets.find((s) => s.id === 'AS-2026-001')!;
    useMapStore.getState().addAssuranceSet({
      ...template,
      id: 'AS-ORG-TEST',
      title: 'Organization Pending Test',
      projectId: undefined,
      projectName: undefined,
      initiatorOrg: THIRD_PARTY,
      createdByPersona: 'Administrator',
      createdByUserId: 'USR-202',
      createdByName: 'A. Fontaine',
      visibility: 'organization',
      stage: 'Initiated',
      approverDecision: 'Pending',
      clientWorkflowStage: undefined,
      assignedVerifier: PENDING_ASSIGNMENT,
      stakeholders: { verifierOrg: THIRD_PARTY },
      requirements: template.requirements.map((r) => ({ ...r, assignedVerifier: PENDING_ASSIGNMENT })),
    });
  };

  beforeEach(() => {
    useMapStore.setState(initialState, true);
    useMapStore.setState({
      isAuthenticated: true,
      activePersona: 'Administrator',
      activeDemoOrganization: THIRD_PARTY,
      activeSessionUserId: 'USR-202',
    });
    addPendingSet();
  });

  it('tells only the assigned person and never broadcasts a pending role org-wide', () => {
    const admin = useMapStore.getState().users.find((u) => u.id === 'USR-202')!;
    const verifierCandidate = useMapStore.getState().users.find((u) => u.id === 'USR-244')!;
    const unassignedColleague = useMapStore.getState().users.find((u) => u.id === 'USR-205')!;

    // Pending role does not trigger a self-notification or an org-wide broadcast to unassigned colleagues.
    expect(
      useMapStore.getState().notifications.filter(
        (n) => n.assuranceSetId === 'AS-ORG-TEST' && n.recipientUserId === admin.id,
      ),
    ).toHaveLength(0);
    expect(
      useMapStore.getState().notifications.filter(
        (n) => n.assuranceSetId === 'AS-ORG-TEST' && n.recipientUserId === verifierCandidate.id,
      ),
    ).toHaveLength(0);

    // Explicitly assigning the verifier notifies only that assigned recipient, leaving unassigned colleagues untouched.
    const label = `${verifierCandidate.name} (${verifierCandidate.organization})`;
    const assignResult = useMapStore.getState().updateAssuranceStakeholder('AS-ORG-TEST', 'Verifier', label);
    expect(assignResult.success, assignResult.message).toBe(true);

    const assigneeInbox = useMapStore
      .getState()
      .notifications.filter((n) => n.assuranceSetId === 'AS-ORG-TEST' && n.recipientUserId === verifierCandidate.id);
    const colleagueInbox = useMapStore
      .getState()
      .notifications.filter((n) => n.assuranceSetId === 'AS-ORG-TEST' && n.recipientUserId === unassignedColleague.id);
    expect(assigneeInbox.length).toBeGreaterThan(0);
    expect(colleagueInbox).toHaveLength(0);
  });

  it('fills the set and its pending tasks, and reaches the chosen person', () => {
    const verifier = getOrganizationRoleCandidates(useMapStore.getState().users, THIRD_PARTY, 'Verifier')[0];
    const label = `${verifier.name} (${verifier.organization})`;
    const result = useMapStore.getState().updateAssuranceStakeholder('AS-ORG-TEST', 'Verifier', label);
    expect(result.success, result.message).toBe(true);
    const saved = useMapStore.getState().assuranceSets.find((s) => s.id === 'AS-ORG-TEST')!;
    expect(saved.assignedVerifier).toBe(label);
    expect(saved.requirements.every((r) => r.assignedVerifier === label)).toBe(true);
  });

  it('fills only the second provider, and keeps the first in the older field', () => {
    useMapStore.setState((state) => ({
      assuranceSets: state.assuranceSets.map((set) =>
        set.id === 'AS-ORG-TEST'
          ? {
              ...set,
              assignedSubmitter: PENDING_ASSIGNMENT,
              submitters: [
                { organization: PROVIDER, assignee: PENDING_ASSIGNMENT },
                { organization: THIRD_PARTY, assignee: PENDING_ASSIGNMENT },
              ],
            }
          : set,
      ),
    }));
    const label = `A. Fontaine (${THIRD_PARTY})`;
    const result = useMapStore.getState().updateAssuranceStakeholder('AS-ORG-TEST', 'Submitter', label, THIRD_PARTY);
    expect(result.success, result.message).toBe(true);
    const saved = useMapStore.getState().assuranceSets.find((s) => s.id === 'AS-ORG-TEST')!;
    expect(saved.submitters).toEqual([
      { organization: PROVIDER, assignee: PENDING_ASSIGNMENT },
      { organization: THIRD_PARTY, assignee: label },
    ]);
    expect(saved.assignedSubmitter).toBe(PENDING_ASSIGNMENT);

    const blocked = useMapStore.getState().updateAssuranceStakeholder('AS-ORG-TEST', 'Submitter', `M. Chen (${PROVIDER})`, PROVIDER);
    expect(blocked.success).toBe(false);
  });

  it('refuses the admin of another organization', () => {
    const template = useMapStore.getState().assuranceSets.find((s) => s.id === 'AS-2026-001')!;
    useMapStore.setState({
      activePersona: 'C Admin',
      activeDemoOrganization: CLIENT,
      activeSessionUserId: 'USR-221',
    });
    const verifier = getOrganizationRoleCandidates(useMapStore.getState().users, THIRD_PARTY, 'Verifier')[0];
    const blockedForeignSet = useMapStore
      .getState()
      .updateAssuranceStakeholder('AS-ORG-TEST', 'Verifier', `${verifier.name} (${verifier.organization})`);
    expect(blockedForeignSet.success).toBe(false);

    useMapStore.getState().addAssuranceSet({
      ...template,
      id: 'AS-CLIENT-PENDING',
      title: 'Client Pending Verifier Test',
      projectId: undefined,
      projectName: undefined,
      initiatorOrg: CLIENT,
      createdByPersona: 'C Admin',
      createdByUserId: 'USR-221',
      createdByName: 'C. Henderson',
      visibility: 'organization',
      stage: 'Initiated',
      approverDecision: 'Pending',
      clientWorkflowStage: undefined,
      assignedVerifier: PENDING_ASSIGNMENT,
      stakeholders: { verifierOrg: THIRD_PARTY },
      requirements: template.requirements.map((r) => ({ ...r, assignedVerifier: PENDING_ASSIGNMENT })),
    });
    const result = useMapStore
      .getState()
      .updateAssuranceStakeholder('AS-CLIENT-PENDING', 'Verifier', `${verifier.name} (${verifier.organization})`);
    expect(result.success).toBe(false);
    expect(result.message).toContain(THIRD_PARTY);
  });
});

describe('SearchableSelect additions', () => {
  const open = () => fireEvent.focus(screen.getByRole('combobox'));
  const type = (value: string) => fireEvent.change(screen.getByRole('combobox'), { target: { value } });

  it('shows search-only items after a query, following the matching items', () => {
    render(
      <SearchableSelect
        items={[{ id: 'a', label: 'Alpha one' }]}
        searchOnlyItems={[{ id: 'b', label: 'Alpha two' }]}
        onSelect={() => undefined}
      />,
    );
    open();
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Alpha one']);
    type('alpha');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Alpha one', 'Alpha two']);
  });

  it('matches search text and shows a custom empty label', () => {
    render(<SearchableSelect items={[{ id: 'a', label: 'Alpha', searchText: 'IMO 123' }]} emptyLabel="Nothing here" onSelect={() => undefined} />);
    open();
    type('imo 123');
    expect(screen.getByRole('option').textContent).toBe('Alpha');
    type('zzz');
    expect(screen.getByText('Nothing here')).toBeTruthy();
  });

  it('does not pick a disabled item by click or Enter', () => {
    const onSelect = vi.fn();
    render(<SearchableSelect items={[{ id: 'a', label: 'Alpha', disabled: true }]} onSelect={onSelect} />);
    open();
    fireEvent.click(screen.getByRole('option'));
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' });
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe('wizard', () => {
  beforeEach(() => {
    useMapStore.setState(initialState, true);
    useMapStore.setState({
      isAuthenticated: true,
      activePersona: 'C Admin',
      activeDemoOrganization: CLIENT,
      activeSessionUserId: 'USR-221',
    });
  });

  const listed = (container: HTMLElement) =>
    Array.from(container.querySelectorAll('[data-testid^="set-organization-"]')).map((row) =>
      (row.getAttribute('data-testid') || '').replace('set-organization-', ''),
    );
  const openPicker = (container: HTMLElement, type: string) => {
    fireEvent.change(container.querySelector('#grid-add-object-type') as HTMLSelectElement, { target: { value: type } });
    fireEvent.focus(container.querySelector('#grid-add-object-item') as HTMLInputElement);
    return Array.from(container.querySelectorAll<HTMLElement>('#grid-add-object-item-listbox [role="option"]'));
  };
  const roleBox = (role: string, organization: string) =>
    screen.getByRole('checkbox', { name: `${role}: ${organization}` }) as HTMLInputElement;
  const hint = (option: HTMLElement) => option.querySelectorAll('span')[1]?.textContent || '';
  const addOrganization = (container: HTMLElement, name: string) => {
    const input = container.querySelector('#grid-add-organization') as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: name } });
    fireEvent.click(screen.getByRole('option', { name }));
  };

  it('has no review channel and lists the client, locked, with the first object owner', () => {
    const { container } = renderWizardWithDefaultVessel();
    expect(container.textContent).not.toMatch(/Review Channel|Authority Validation|Appointed 3rd Party/);
    const organizations = listed(container);
    expect(organizations[0]).toBe(CLIENT);
    expect(organizations.length).toBeGreaterThan(1);
    const clientRow = within(container.querySelector(`[data-testid="set-organization-${CLIENT}"]`) as HTMLElement);
    expect(clientRow.queryByRole('button')).toBeNull();
  });

  it('has one role column per role, and no stakeholder dropdowns', () => {
    const { container } = renderWizardWithDefaultVessel();
    addOrganization(container, THIRD_PARTY);
    expect(container.querySelector('#assign-ver')).toBeNull();
    expect(container.querySelector('#assign-app')).toBeNull();
    expect(container.querySelector('#assign-ins')).toBeNull();
    expect(container.querySelector('#chk-same-as-verifier')).toBeNull();
    expect(roleBox('Verifier', CLIENT).checked).toBe(false);
    expect(roleBox('Verifier', THIRD_PARTY).checked).toBe(false);
  });

  it('marks an object owner Submitter, and locks its verifier, inspector and approver boxes', () => {
    const { container } = renderWizardWithDefaultVessel();
    const owner = listed(container)[1];
    const row = within(container.querySelector(`[data-testid="set-organization-${owner}"]`) as HTMLElement);
    expect(row.getByText(/Submitter:/)).toBeTruthy();
    expect(roleBox('Verifier', owner).disabled).toBe(true);
    expect(roleBox('Approver', owner).disabled).toBe(true);
    expect(roleBox('Inspector', owner).disabled).toBe(true);
  });

  it('moves a role on tick, and clears it on untick', () => {
    const { container } = renderWizardWithDefaultVessel();
    addOrganization(container, THIRD_PARTY);
    addOrganization(container, 'Marine Assurance Authority');

    fireEvent.click(roleBox('Verifier', THIRD_PARTY));
    expect(roleBox('Verifier', THIRD_PARTY).checked).toBe(true);
    expect(roleBox('Verifier', CLIENT).checked).toBe(false);

    fireEvent.click(roleBox('Verifier', 'Marine Assurance Authority'));
    expect(roleBox('Verifier', THIRD_PARTY).checked).toBe(false);
    expect(roleBox('Verifier', 'Marine Assurance Authority').checked).toBe(true);

    fireEvent.click(roleBox('Verifier', 'Marine Assurance Authority'));
    expect(roleBox('Verifier', 'Marine Assurance Authority').checked).toBe(false);
  });

  it('enforces segregation of duties between verifier and approver for the client only', () => {
    const { container } = renderWizardWithDefaultVessel();
    addOrganization(container, THIRD_PARTY);
    fireEvent.click(roleBox('Verifier', THIRD_PARTY));
    /* a third party may verify and approve; only the client cannot hold both */
    expect(roleBox('Approver', THIRD_PARTY).disabled).toBe(false);
    expect(roleBox('Inspector', THIRD_PARTY).disabled).toBe(false);
    fireEvent.click(roleBox('Inspector', THIRD_PARTY));
    expect(roleBox('Verifier', THIRD_PARTY).checked).toBe(true);
    expect(roleBox('Inspector', THIRD_PARTY).checked).toBe(true);
  });

  it('hides a role column when its stage is switched off', () => {
    const { container } = renderWizardWithDefaultVessel();
    fireEvent.click(container.querySelector('#wf-inspect') as HTMLInputElement);
    expect(screen.queryByRole('checkbox', { name: `Inspector: ${CLIENT}` })).toBeNull();
    expect(roleBox('Verifier', CLIENT)).toBeTruthy();
  });

  it('blocks removing an organization in use, and removes a free one', () => {
    const { container } = renderWizardWithDefaultVessel();
    const owner = listed(container)[1];
    fireEvent.click(screen.getByRole('button', { name: `Remove ${owner}` }));
    expect(listed(container)).toContain(owner);
    expect(screen.getByRole('alert').textContent).toContain('Remove that object first');

    addOrganization(container, THIRD_PARTY);
    fireEvent.click(roleBox('Verifier', THIRD_PARTY));
    fireEvent.click(screen.getByRole('button', { name: `Remove ${THIRD_PARTY}` }));
    expect(listed(container)).toContain(THIRD_PARTY);

    fireEvent.click(roleBox('Verifier', THIRD_PARTY));
    fireEvent.click(screen.getByRole('button', { name: `Remove ${THIRD_PARTY}` }));
    expect(listed(container)).not.toContain(THIRD_PARTY);
  });

  it('offers only the vendor objects when a vendor is set, and finds others when freed', () => {
    const { container } = renderWizardWithDefaultVessel();
    const organizations = listed(container);
    pickReviewerRoles(container);
    clickNext();

    const searchedBefore = objectPickerOptions(container, 'equipment');
    searchedBefore.forEach((option) => expect(organizations).toContain(hint(option)));

    removeObjectRow(container, objectRowIds(container)[0]);
    const searchedAfter = objectPickerOptions(container, 'equipment');
    const firstOther = searchedAfter.findIndex((option) => !organizations.includes(hint(option)));
    expect(firstOther).toBeGreaterThanOrEqual(0);
  });

  it('adds the owner of an object found by search to the list, with a notice', () => {
    const { container } = renderWizardWithDefaultVessel();
    const before = listed(container);
    pickReviewerRoles(container);
    clickNext();

    removeObjectRow(container, objectRowIds(container)[0]);
    const other = objectPickerOptions(container, 'equipment').find(
      (option) => !before.includes(hint(option)) && option.getAttribute('aria-disabled') !== 'true',
    )!;
    const owner = hint(other);
    fireEvent.click(other);

    expect(screen.getByRole('status').textContent).toContain(`${owner} added to Organizations.`);
    expect(objectRowIds(container)).toContain(other.getAttribute('data-item-id'));

    /* removing the object leaves the owner listed, and free to remove */
    removeObjectRow(container, other.getAttribute('data-item-id') as string);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(listed(container)).toContain(owner);
    fireEvent.click(screen.getByRole('button', { name: `Remove ${owner}` }));
    expect(listed(container)).not.toContain(owner);
  });

  it('keeps an added object from being picked twice', () => {
    const { container } = renderWizardWithDefaultVessel();
    pickReviewerRoles(container);
    clickNext();
    const added = objectRowIds(container)[0];
    const option = objectItemSelect(container, 'vessel').options.find((o) => o.value === added);
    expect(option?.disabled).toBe(true);
    expect(option?.text).toContain('added');
  });

  it('moves a role back to the client when its organization becomes an object owner', () => {
    const { container } = renderWizardWithDefaultVessel();
    const before = listed(container);
    pickReviewerRoles(container);
    clickNext();
    removeObjectRow(container, objectRowIds(container)[0]);
    const free = objectPickerOptions(container, 'equipment').find(
      (option) => option.getAttribute('aria-disabled') !== 'true' && !before.includes(hint(option)),
    )!;
    const owner = hint(free);
    const objectId = free.getAttribute('data-item-id') as string;

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    addOrganization(container, owner);
    fireEvent.click(roleBox('Verifier', owner));
    expect(roleBox('Verifier', owner).checked).toBe(true);

    clickNext();
    addObject(container, 'equipment', objectId);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(roleBox('Verifier', owner).checked).toBe(false);
    expect(roleBox('Verifier', owner).disabled).toBe(true);
  });

  it('stores one submitter for the vendor organization and gives each task to its owner', () => {
    const { container } = renderWizardWithDefaultVessel();
    const before = listed(container);
    fireEvent.change(container.querySelector('#grid-campaign-title') as HTMLInputElement, {
      target: { value: 'One Vendor Vetting' },
    });
    pickReviewerRoles(container);
    clickNext();
    clickNext();
    clickNext();
    fireEvent.click(screen.getByRole('button', { name: /Create Assurance Set/i }));

    const created = useMapStore.getState().assuranceSets.find((set) => set.title === 'One Vendor Vetting')!;
    expect(created.submitters?.map((submitter) => submitter.organization)).toEqual([before[1]]);
    expect(created.serviceProviderOrg).toBe(before[1]);
    expect(created.clientOrg).toBe(before[0]);
    expect(created.assignedSubmitter).toBe(created.submitters?.[0].assignee);
  });

  it('creates a set that names organizations and defaults existing users as stakeholders', () => {
    const { container } = renderWizardWithDefaultVessel();
    fireEvent.change(container.querySelector('#grid-campaign-title') as HTMLInputElement, {
      target: { value: 'Organizations In General Vetting' },
    });
    addOrganization(container, THIRD_PARTY);
    fireEvent.click(roleBox('Verifier', THIRD_PARTY));
    fireEvent.click(roleBox('Approver', CLIENT));
    fireEvent.click(roleBox('Inspector', THIRD_PARTY));
    clickNext();
    clickNext();
    clickNext();
    expect(container.textContent).toContain(`Verifier: S. Girard (${THIRD_PARTY})`);
    expect(container.textContent).toContain(`Inspector: N. Technical (${THIRD_PARTY})`);

    const before = useMapStore.getState().assuranceSets.length;
    fireEvent.click(screen.getByRole('button', { name: /Create Assurance Set/i }));
    const sets = useMapStore.getState().assuranceSets;
    expect(sets.length).toBe(before + 1);
    const created = sets.find((s) => s.title === 'Organizations In General Vetting')!;

    expect(created.organizations).toContain(CLIENT);
    expect(created.organizations).toContain(THIRD_PARTY);
    expect(created.stakeholders?.verifierOrg).toBe(THIRD_PARTY);
    expect(created.assignedVerifier).toBe(`S. Girard (${THIRD_PARTY})`);
    expect(created.assignedInspector).toBe(`N. Technical (${THIRD_PARTY})`);
    expect(created.assignedApprover).toBe(`H. Okafor (${CLIENT})`);
    expect(created.requirements.every((r) => r.assignedVerifier === `S. Girard (${THIRD_PARTY})`)).toBe(true);
  });
});
