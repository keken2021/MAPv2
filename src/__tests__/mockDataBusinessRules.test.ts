/*
  file summary: guard tests proving the seeded mock data respects the client / service provider / assurance group rules.
  responsibilities: checks the parties, assignees and approval gates of every assurance set, the ownership behind project links and marketplace offerings, and the users behind audit events and notifications.
  role in system: keeps src/store mock modules consistent with the validators in src/utils/userRoleHelpers.ts and projectHelpers.ts; mirrors the map-business-rules audit.
*/

import { describe, it, expect } from 'vitest';
import {
  MOCK_ASSURANCE_SETS,
  MOCK_AUDIT_TRAIL,
  MOCK_PERSONA_SESSION_USER_IDS,
  MOCK_USERS,
  MOCK_VESSELS,
} from '../store/mockData';
import { MOCK_PROJECTS, PROJECT_SEED_ASSURANCE_SETS } from '../store/projectMockData';
import { MOCK_EQUIPMENT } from '../store/equipmentMockData';
import { MOCK_CREW } from '../store/crewMockData';
import { MOCK_MARKETPLACE_ITEMS } from '../store/marketplaceMockData';
import { MOCK_NOTIFICATIONS } from '../store/notificationMockData';
import {
  findUserByAssigneeLabel,
  getReviewChannelForUser,
  parseAssigneeOrganization,
  userHasRole,
  validateStakeholderAssignmentForSet,
} from '../utils/userRoleHelpers';
import {
  getProjectClientOrganization,
  isAssetOwnedByOrganization,
  isOrganizationMatch,
} from '../utils/projectHelpers';
import { AssuranceSet } from '../types/assurance';
import { UserRolePersona } from '../types/audit';
import { RoleName } from '../types/permissions';
import { UserProfile } from '../types/user';

type WorkflowRole = 'Submitter' | 'Verifier' | 'Inspector' | 'Approver';

const ALL_SETS: AssuranceSet[] = [...MOCK_ASSURANCE_SETS, ...PROJECT_SEED_ASSURANCE_SETS];

/* roles that may fill each workflow slot, matching the candidate filters in userRoleHelpers.ts */
const ROLE_HOLDERS: Record<WorkflowRole, RoleName[]> = {
  Submitter: ['Submitter', 'Administrator'],
  Verifier: ['Verifier', 'C Admin'],
  Inspector: ['Inspector'],
  Approver: ['Approver', 'C Admin'],
};

/**
  what: resolves the assigned workflow labels of a set to registry users; input is the set.
  how: reads each assigned label and looks the person up in MOCK_USERS with findUserByAssigneeLabel.
  with what file: src/__tests__/mockDataBusinessRules.test.ts; reuses src/utils/userRoleHelpers.ts.
*/
function getAssignees(set: AssuranceSet): { role: WorkflowRole; label: string; user: UserProfile | undefined }[] {
  const slots: [WorkflowRole, string | undefined][] = [
    ['Submitter', set.assignedSubmitter],
    ['Verifier', set.assignedVerifier],
    ['Inspector', set.assignedInspector],
    ['Approver', set.assignedApprover],
  ];
  return slots
    .filter((slot): slot is [WorkflowRole, string] => Boolean(slot[1]?.trim()))
    .map(([role, label]) => ({ role, label, user: findUserByAssigneeLabel(MOCK_USERS, label) }));
}

describe('Seeded assurance sets keep client, service provider and assurance group apart', () => {
  it('names a client and a service provider, with the charterer as the client', () => {
    ALL_SETS.forEach((set) => {
      expect(set.clientOrg, `${set.id} clientOrg`).toBeTruthy();
      expect(set.serviceProviderOrg, `${set.id} serviceProviderOrg`).toBeTruthy();
      expect(set.charterer, `${set.id} charterer`).toBe(set.clientOrg);
    });
  });

  it('never makes an organization its own client unless the set is an internal deployment', () => {
    ALL_SETS.forEach((set) => {
      const sameOrganization = isOrganizationMatch(set.clientOrg ?? '', set.serviceProviderOrg ?? '');
      expect(sameOrganization, `${set.id}: ${set.clientOrg} / ${set.serviceProviderOrg}`).toBe(
        set.internalDeployment === true,
      );
    });
  });

  it('assigns every required role to an active user who holds it, labelled with the registry organization', () => {
    ALL_SETS.forEach((set) => {
      const assignees = getAssignees(set);
      const assignedRoles = assignees.map((a) => a.role);
      expect(assignedRoles, `${set.id} submitter`).toContain('Submitter');
      if (set.verificationRequired !== false) expect(assignedRoles, `${set.id} verifier`).toContain('Verifier');
      if (set.formalApprovalRequired !== false) expect(assignedRoles, `${set.id} approver`).toContain('Approver');
      expect(assignedRoles.includes('Inspector'), `${set.id} inspector follows mandatory inspection`).toBe(
        set.mandatoryInspectionRequired === true,
      );

      assignees.forEach(({ role, label, user }) => {
        expect(user, `${set.id} ${role} "${label}"`).toBeDefined();
        if (!user) return;
        expect(user.status, `${set.id} ${role} ${label}`).toBe('Active');
        expect(ROLE_HOLDERS[role].some((r) => userHasRole(user, r)), `${set.id} ${role} ${label} holds the role`).toBe(true);
        expect(parseAssigneeOrganization(label), `${set.id} ${role} label organization`).toBe(user.organization);
      });
    });
  });

  it('takes the submitter from the service provider and the reviewers from the client or an independent third party', () => {
    ALL_SETS.forEach((set) => {
      const client = set.clientOrg ?? '';
      const provider = set.serviceProviderOrg ?? '';

      getAssignees(set).forEach(({ role, label, user }) => {
        if (!user) return;
        if (role === 'Submitter') {
          expect(isOrganizationMatch(provider, user.organization), `${set.id} submitter ${label}`).toBe(true);
          return;
        }
        if (role !== 'Inspector') {
          const result = validateStakeholderAssignmentForSet(
            { ...set, serviceProviderOrg: provider, clientOrg: client },
            role,
            label,
            MOCK_USERS,
          );
          expect(result.ok, `${set.id} ${role} ${label}`).toBe(true);
        }
        const fromClient = isOrganizationMatch(client, user.organization);
        const independent = user.userType === 'Third-Party' || getReviewChannelForUser(user, client) === 'issuing_authority';
        expect(fromClient || independent, `${set.id} ${role} ${label} is client staff or independent`).toBe(true);
        if (!set.internalDeployment) {
          expect(isOrganizationMatch(provider, user.organization), `${set.id} ${role} ${label} is not provider staff`).toBe(false);
        }
      });
    });
  });

  it('gives one person one role per set', () => {
    ALL_SETS.forEach((set) => {
      const people = getAssignees(set).map((a) => a.user?.id ?? a.label.trim().toLowerCase());
      expect(new Set(people).size, `${set.id} assignees`).toBe(people.length);
    });
  });

  it('approves a set only after verification, inspection and a recorded decision', () => {
    ALL_SETS.filter(
      (set) => set.stage === 'Approved' || set.stage === 'Certified' || set.approverDecision === 'Approved',
    ).forEach((set) => {
      if (set.verificationRequired !== false) {
        set.requirements
          .filter((r) => r.isMandatory !== false && r.fulfillmentType !== 'assurance_set')
          .forEach((r) => expect(r.verifierStatus, `${set.id} ${r.id}`).toBe('Verified'));
      }
      if (set.mandatoryInspectionRequired) expect(set.inspectionCompleted, `${set.id} inspection`).toBe(true);
      if (set.formalApprovalRequired !== false) expect(set.approverDecision, `${set.id} decision`).toBe('Approved');
    });

    ALL_SETS.filter(
      (set) => set.approverDecision === 'Rejected' || set.approverDecision === 'Returned for Correction',
    ).forEach((set) => expect(set.approverNotes?.trim(), `${set.id} decision reason`).toBeTruthy());
  });
});

describe('Seeded projects and marketplace offerings respect asset ownership', () => {
  it('links project assets through the organization that owns them, under the project client', () => {
    MOCK_PROJECTS.forEach((project) => {
      const client = getProjectClientOrganization(project);
      if (project.serviceProvider) {
        expect(isOrganizationMatch(client, project.serviceProvider), `${project.id} service provider`).toBe(false);
      }

      project.assetLinks.forEach((link) => {
        const vessel = link.assetType === 'Vessel' ? MOCK_VESSELS.find((v) => v.id === link.assetId) : undefined;
        const crew = link.assetType === 'Crew' ? MOCK_CREW.find((c) => c.id === link.assetId) : undefined;
        const equipment = link.assetType === 'Equipment' ? MOCK_EQUIPMENT.find((e) => e.id === link.assetId) : undefined;
        expect(vessel || crew || equipment, `${project.id} ${link.id} asset ${link.assetId}`).toBeDefined();
        expect(
          isAssetOwnedByOrganization(link.assetType, link.providerOrganization, vessel, crew, equipment),
          `${project.id} ${link.id} provider owns ${link.assetId}`,
        ).toBe(true);

        const linkedSet = ALL_SETS.find((s) => s.id === link.assuranceSetId);
        expect(linkedSet, `${project.id} ${link.id} set ${link.assuranceSetId}`).toBeDefined();
        if (!linkedSet) return;
        expect(isOrganizationMatch(client, linkedSet.clientOrg ?? ''), `${project.id} ${link.id} set client`).toBe(true);
        /* a client supplying its own asset is an internal deployment */
        if (isOrganizationMatch(client, link.providerOrganization)) {
          expect(linkedSet.internalDeployment, `${project.id} ${link.id} own asset`).toBe(true);
        }
      });
    });
  });

  it('links a marketplace offering only to an asset its provider owns', () => {
    MOCK_MARKETPLACE_ITEMS.filter((item) => item.linkedEntityId).forEach((item) => {
      const vessel = MOCK_VESSELS.find((v) => v.id === item.linkedEntityId);
      const crew = MOCK_CREW.find((c) => c.id === item.linkedEntityId);
      const equipment = MOCK_EQUIPMENT.find((e) => e.id === item.linkedEntityId);
      const assetType = vessel ? 'Vessel' : crew ? 'Crew' : 'Equipment';
      expect(
        isAssetOwnedByOrganization(assetType, item.providerOrg, vessel, crew, equipment),
        `${item.id} provider ${item.providerOrg} owns ${item.linkedEntityId}`,
      ).toBe(true);
    });
  });
});

describe('Seeded actors are real users acting in a role they hold', () => {
  const findUser = (id: string | undefined) => MOCK_USERS.find((u) => u.id === id);

  it('signs each persona in as a user who holds that persona', () => {
    (Object.entries(MOCK_PERSONA_SESSION_USER_IDS) as [UserRolePersona, string][]).forEach(([persona, userId]) => {
      const user = findUser(userId);
      expect(user, `${persona} session user ${userId}`).toBeDefined();
      if (user) expect(userHasRole(user, persona), `${userId} holds ${persona}`).toBe(true);
    });
  });

  it('records audit events against an existing user, role and organization', () => {
    MOCK_AUDIT_TRAIL.forEach((event) => {
      const user = findUser(event.userId);
      expect(user, `${event.id} user ${event.userId}`).toBeDefined();
      if (!user) return;
      expect(userHasRole(user, event.userRole), `${event.id} ${event.userId} holds ${event.userRole}`).toBe(true);
      expect(isOrganizationMatch(event.organization, user.organization), `${event.id} organization`).toBe(true);
    });
  });

  it('addresses notifications to existing users, sets and roles', () => {
    MOCK_NOTIFICATIONS.forEach((notification) => {
      const recipient = findUser(notification.recipientUserId);
      expect(recipient, `${notification.id} recipient`).toBeDefined();
      if (notification.senderUserId) expect(findUser(notification.senderUserId), `${notification.id} sender`).toBeDefined();
      if (notification.assuranceSetId) {
        expect(ALL_SETS.some((s) => s.id === notification.assuranceSetId), `${notification.id} set`).toBe(true);
      }
      if (recipient && notification.assignedRole) {
        const allowed = ROLE_HOLDERS[notification.assignedRole as WorkflowRole] ?? [notification.assignedRole];
        expect(allowed.some((r) => userHasRole(recipient, r)), `${notification.id} assigned role`).toBe(true);
      }
    });
  });
});
