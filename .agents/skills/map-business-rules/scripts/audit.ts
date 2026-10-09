/*
  file summary: read-only audit of the client / service provider / assurance group rules across the mock data.
  responsibilities: resolves the parties and assignees of every assurance set, project, marketplace offering, audit event and notification, and reports each record that breaks a party, segregation or approval-gate rule.
  role in system: run by the map-business-rules skill with `npx vite-node`; reuses the validators in src/utils/userRoleHelpers.ts and src/utils/projectHelpers.ts and writes nothing.
*/

import {
  MOCK_ASSURANCE_SETS,
  MOCK_AUDIT_TRAIL,
  MOCK_PERSONA_SESSION_USER_IDS,
  MOCK_USERS,
  MOCK_VESSELS,
} from '../../../../src/store/mockData';
import { MOCK_PROJECTS, PROJECT_SEED_ASSURANCE_SETS } from '../../../../src/store/projectMockData';
import { MOCK_EQUIPMENT } from '../../../../src/store/equipmentMockData';
import { MOCK_CREW } from '../../../../src/store/crewMockData';
import { MOCK_MARKETPLACE_ITEMS } from '../../../../src/store/marketplaceMockData';
import { MOCK_NOTIFICATIONS } from '../../../../src/store/notificationMockData';
import {
  findUserByAssigneeLabel,
  getReviewChannelForUser,
  parseAssigneeOrganization,
  userHasRole,
  validateStakeholderAssignmentForSet,
} from '../../../../src/utils/userRoleHelpers';
import {
  getProjectClientOrganization,
  isAssetOwnedByOrganization,
  isOrganizationMatch,
  requiresAssuranceSetForAssetLink,
} from '../../../../src/utils/projectHelpers';
import type { AssuranceSet } from '../../../../src/types/assurance';
import type { UserRolePersona } from '../../../../src/types/audit';
import type { RoleName } from '../../../../src/types/permissions';
import type { UserProfile } from '../../../../src/types/user';

type Severity = 'error' | 'warning';
type RuleId = 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'R7' | 'R8' | 'R9' | 'R10' | 'R11' | 'R12' | 'R13';
type WorkflowRole = 'Submitter' | 'Verifier' | 'Inspector' | 'Approver';

interface Finding {
  rule: RuleId;
  severity: Severity;
  recordId: string;
  message: string;
}

interface Parties {
  client: string;
  provider: string;
  assetOwner: string;
}

interface Assignee {
  role: WorkflowRole;
  label: string;
  labelOrg: string;
  user: UserProfile | undefined;
  /* organization used for group membership: the registry user's when resolved, otherwise the label's */
  org: string;
}

/* one line per rule; the skill file documents each in full */
const RULE_TITLES: Record<RuleId, string> = {
  R1: 'client and service provider are different organizations',
  R2: 'every set names its client and its service provider',
  R3: 'the submitter belongs to the service provider',
  R4: 'the verifier and approver never belong to the service provider',
  R5: 'reviewers belong to the client or the assurance group',
  R6: 'one person holds one role per set',
  R7: 'an inspector is assigned if and only if inspection is mandatory',
  R8: 'assignee labels resolve to an active user who holds the role',
  R9: 'reviewers match the review mode',
  R10: 'project client differs from asset providers, and providers own their assets',
  R11: 'marketplace providers own the asset they offer',
  R12: 'audit and notification actors exist and hold the role they act in',
  R13: 'approval gates are respected',
};

/* roles that may fill each workflow slot, matching the candidate filters in userRoleHelpers.ts */
const ROLE_HOLDERS: Record<WorkflowRole, RoleName[]> = {
  Submitter: ['Submitter', 'Administrator'],
  Verifier: ['Verifier', 'C Admin'],
  Inspector: ['Inspector'],
  Approver: ['Approver', 'C Admin'],
};

/* actions each persona is hard-denied in Context Files/Roles.md section 5.2, matched on the leading verb */
const DENIED_ACTIONS: Partial<Record<UserRolePersona, RegExp>> = {
  'C Admin': /^(Uploaded|Replaced|Deleted Document)/i,
  Submitter: /^(Verified|Rejected|Approved|Certified|Requested Correction|Logged CAPA|Completed On-Site)/i,
  Verifier: /^(Uploaded|Approved|Certified|Logged CAPA|Completed On-Site)/i,
  Inspector: /^(Verified|Approved|Certified)/i,
  Approver: /^(Uploaded|Verified|Logged CAPA|Completed On-Site)/i,
};

const ALL_SETS: AssuranceSet[] = [...MOCK_ASSURANCE_SETS, ...PROJECT_SEED_ASSURANCE_SETS];
const findings: Finding[] = [];

/**
  what: records one audit finding; inputs are the rule id, severity, record id and message.
  how: pushes onto the module-level findings list that the report prints at the end.
  with what file: .agents/skills/map-business-rules/scripts/audit.ts only.
*/
function report(rule: RuleId, severity: Severity, recordId: string, message: string): void {
  findings.push({ rule, severity, recordId, message });
}

/* organization comparison used everywhere in the app; empty values never match */
function sameOrg(a: string | undefined, b: string | undefined): boolean {
  return Boolean(a && b && isOrganizationMatch(a, b));
}

/**
  what: resolves the client, service provider and asset owner of a set; input is the set.
  how: client is clientOrg, then charterer, then the initiator of a client-created set; provider is serviceProviderOrg, then the owner of the subject asset for the set's scope.
  with what file: .agents/skills/map-business-rules/scripts/audit.ts; reads the vessel, crew and equipment mock modules.
*/
function resolveParties(set: AssuranceSet): Parties {
  const scope = set.assuranceType ?? 'Vessel';
  let assetOwner = '';
  if (scope === 'Crew' && set.crewId) {
    assetOwner = MOCK_CREW.find((c) => c.id === set.crewId)?.organization ?? '';
  } else if (scope === 'Equipment' && set.equipmentId) {
    assetOwner = MOCK_EQUIPMENT.find((e) => e.id === set.equipmentId)?.owningOrganization ?? '';
  }
  if (!assetOwner) {
    assetOwner = MOCK_VESSELS.find((v) => v.id === set.vesselId)?.registeredOwner ?? '';
  }

  const clientCreated = set.initiatorRole.includes('Client');
  const client = set.clientOrg || set.charterer || (clientCreated ? set.initiatorOrg : '');
  const provider = set.serviceProviderOrg || assetOwner;
  return { client, provider, assetOwner };
}

/**
  what: resolves the four workflow assignees of a set to registry users; input is the set.
  how: reads each assigned label, parses its "(Organization)" suffix and looks the person up in MOCK_USERS with findUserByAssigneeLabel.
  with what file: .agents/skills/map-business-rules/scripts/audit.ts; reuses src/utils/userRoleHelpers.ts.
*/
function resolveAssignees(set: AssuranceSet): Assignee[] {
  const slots: [WorkflowRole, string | undefined][] = [
    ['Submitter', set.assignedSubmitter],
    ['Verifier', set.assignedVerifier],
    ['Inspector', set.assignedInspector],
    ['Approver', set.assignedApprover],
  ];
  return slots
    .filter((slot): slot is [WorkflowRole, string] => Boolean(slot[1]?.trim()))
    .map(([role, label]) => {
      const user = findUserByAssigneeLabel(MOCK_USERS, label);
      const labelOrg = parseAssigneeOrganization(label) ?? '';
      return { role, label, labelOrg, user, org: user?.organization || labelOrg };
    });
}

/* assurance group: an independent third party or an issuing authority, never the client's own staff */
function isAssuranceGroup(assignee: Assignee, client: string): boolean {
  if (!assignee.user) return false;
  return assignee.user.userType === 'Third-Party' || getReviewChannelForUser(assignee.user, client) !== 'internal';
}

/**
  what: audits the parties and assignees of every assurance set (rules 1 to 9 and 13).
  how: resolves parties and assignees once per set, then applies each rule in order, reusing validateStakeholderAssignmentForSet for the provider conflict check.
  with what file: .agents/skills/map-business-rules/scripts/audit.ts; reads src/store/mockData.ts and src/store/projectMockData.ts.
*/
function auditSets(): void {
  ALL_SETS.forEach((set) => {
    const { client, provider, assetOwner } = resolveParties(set);
    const assignees = resolveAssignees(set);
    const internal = set.internalDeployment === true;
    const byRole = (role: WorkflowRole) => assignees.find((a) => a.role === role);

    /* rule 2: both parties named, and the charterer is the client */
    const implied: string[] = [];
    if (!client) {
      report('R2', 'error', set.id, `no client: initiated by ${set.initiatorOrg} (${set.initiatorRole}) with no clientOrg or charterer`);
    } else if (!set.clientOrg) {
      implied.push(`clientOrg not set, resolved to "${client}" from ${set.charterer ? 'charterer' : 'initiatorOrg'}`);
    }
    if (!provider) {
      report('R2', 'error', set.id, 'no service provider: serviceProviderOrg not set and the subject asset has no recorded owner');
    } else if (!set.serviceProviderOrg) {
      implied.push(`serviceProviderOrg not set, resolved to asset owner "${provider}"`);
    } else if (assetOwner && !sameOrg(set.serviceProviderOrg, assetOwner)) {
      report('R2', 'warning', set.id, `serviceProviderOrg "${set.serviceProviderOrg}" is not the subject asset owner "${assetOwner}"`);
    }
    if (implied.length > 0) report('R2', 'warning', set.id, implied.join('; '));
    if (set.clientOrg && set.charterer && !sameOrg(set.clientOrg, set.charterer)) {
      report('R2', 'error', set.id, `charterer "${set.charterer}" differs from clientOrg "${set.clientOrg}"`);
    }

    /* rule 1: an organization is not its own client unless the set is flagged internal */
    if (client && provider && sameOrg(client, provider) && !internal) {
      report('R1', 'error', set.id, `client "${client}" is also the service provider "${provider}" and internalDeployment is not true`);
    }

    /* rule 3: documents are submitted by the provider's own staff */
    const submitter = byRole('Submitter');
    if (submitter && provider && !sameOrg(provider, submitter.org)) {
      report('R3', 'error', set.id, `submitter ${submitter.label} is not from the service provider "${provider}"`);
    }

    /* rule 4: provider staff never verify or approve their own documents */
    (['Verifier', 'Approver'] as const).forEach((role) => {
      const assignee = byRole(role);
      if (!assignee) return;
      const result = validateStakeholderAssignmentForSet(
        {
          serviceProviderOrg: provider,
          assignedSubmitter: set.assignedSubmitter,
          internalDeployment: set.internalDeployment,
          reviewMode: set.reviewMode,
          clientOrg: client,
        },
        role,
        assignee.label,
        MOCK_USERS,
      );
      if (!result.ok && result.message.startsWith('Service provider conflict')) {
        report('R4', 'error', set.id, `${role} ${assignee.label}: ${result.message}`);
      }
    });

    /* rule 5: each reviewer is client staff or an independent third party; skipped when rule 2 found no client to compare with */
    assignees
      .filter((a) => a.role !== 'Submitter' && a.user && client)
      .forEach((a) => {
        const fromProvider = !internal && sameOrg(provider, a.org);
        if (fromProvider) {
          /* verifier and approver from the provider are already reported by rule 4 */
          if (a.role === 'Inspector') report('R5', 'error', set.id, `inspector ${a.label} belongs to the service provider "${provider}"`);
          return;
        }
        if (!sameOrg(client, a.org) && !isAssuranceGroup(a, client)) {
          report('R5', 'error', set.id, `${a.role.toLowerCase()} ${a.label} is neither the client (${client}) nor an independent third party`);
        }
      });

    /* rule 6: no person appears in two roles on one set */
    for (let i = 0; i < assignees.length; i += 1) {
      for (let j = i + 1; j < assignees.length; j += 1) {
        const a = assignees[i];
        const b = assignees[j];
        const samePerson = a.user && b.user ? a.user.id === b.user.id : a.label.trim().toLowerCase() === b.label.trim().toLowerCase();
        if (samePerson) report('R6', 'error', set.id, `${a.label} is both ${a.role} and ${b.role}`);
      }
    }

    /* rule 7: the inspector slot follows the inspection requirement */
    if (set.mandatoryInspectionRequired && !byRole('Inspector')) {
      report('R7', 'error', set.id, 'inspection is mandatory but no inspector is assigned');
    }
    if (!set.mandatoryInspectionRequired && byRole('Inspector')) {
      report('R7', 'warning', set.id, `inspector ${byRole('Inspector')?.label} is assigned but inspection is not mandatory`);
    }
    if (!set.mandatoryInspectionRequired && set.inspectionCompleted) {
      report('R7', 'warning', set.id, 'inspectionCompleted is true but inspection is not mandatory');
    }

    /* rule 8: each label is a real, active user in the right role and organization */
    assignees.forEach((a) => {
      if (!a.user) {
        report('R8', 'error', set.id, `${a.role} "${a.label}" does not match any user in MOCK_USERS`);
        return;
      }
      if (a.user.status !== 'Active') {
        report('R8', 'error', set.id, `${a.role} ${a.label} is ${a.user.status} (${a.user.id})`);
      }
      if (!ROLE_HOLDERS[a.role].some((role) => userHasRole(a.user as UserProfile, role))) {
        report('R8', 'error', set.id, `${a.role} ${a.label} holds ${a.user.roles.join(', ')} (${a.user.id}), not ${ROLE_HOLDERS[a.role].join(' or ')}`);
      }
      if (a.labelOrg && !sameOrg(a.labelOrg, a.user.organization)) {
        report('R8', 'error', set.id, `${a.role} label says "${a.labelOrg}" but ${a.user.id} belongs to "${a.user.organization}"`);
      } else if (a.labelOrg && a.labelOrg !== a.user.organization) {
        report('R8', 'warning', set.id, `${a.role} label spells the organization "${a.labelOrg}"; ${a.user.id} has "${a.user.organization}"`);
      }
    });
    const unassigned: string[] = [];
    if (!byRole('Submitter')) unassigned.push('submitter');
    if (set.verificationRequired !== false && !byRole('Verifier')) unassigned.push('verifier');
    if (set.formalApprovalRequired !== false && !byRole('Approver')) unassigned.push('approver');
    if (unassigned.length > 0) report('R8', 'warning', set.id, `required role(s) unassigned: ${unassigned.join(', ')}`);

    /* rule 9: the chosen review mode limits who may review */
    if (set.reviewMode && set.reviewMode !== 'mixed') {
      (['Verifier', 'Approver'] as const).forEach((role) => {
        const assignee = byRole(role);
        if (!assignee?.user) return;
        const channel = getReviewChannelForUser(assignee.user, client);
        const fromClient = sameOrg(client, assignee.org);
        if (set.reviewMode === 'internal' && !fromClient) {
          report('R9', 'error', set.id, `review mode internal but ${role.toLowerCase()} ${assignee.label} is not client staff`);
        }
        if (set.reviewMode === 'third_party' && (fromClient || channel !== 'third_party')) {
          report('R9', 'error', set.id, `review mode third_party but ${role.toLowerCase()} ${assignee.label} is ${fromClient ? 'client staff' : channel}`);
        }
        if (set.reviewMode === 'issuing_authority' && role === 'Verifier' && channel !== 'issuing_authority') {
          report('R9', 'error', set.id, `review mode issuing_authority but verifier ${assignee.label} is ${channel}`);
        }
      });
    }

    /* rule 13: nothing reaches approval ahead of verification, inspection and a recorded decision */
    const approved = set.stage === 'Approved' || set.stage === 'Certified' || set.approverDecision === 'Approved';
    if (approved) {
      const unverified = set.requirements.filter(
        (r) =>
          r.isMandatory !== false &&
          set.verificationRequired !== false &&
          r.verifierStatus !== 'Verified' &&
          !(r.fulfillmentType === 'assurance_set' && r.isFulfilled),
      );
      if (unverified.length > 0) {
        report('R13', 'error', set.id, `approved with ${unverified.length} mandatory requirement(s) not verified: ${unverified.map((r) => r.id).join(', ')}`);
      }
      if (set.mandatoryInspectionRequired && !set.inspectionCompleted) {
        report('R13', 'error', set.id, 'approved while the mandatory inspection is not completed');
      }
      if (set.formalApprovalRequired !== false && set.approverDecision !== 'Approved') {
        report('R13', 'error', set.id, `stage ${set.stage} but approverDecision is ${set.approverDecision ?? 'not recorded'}`);
      }
      if (set.formalApprovalRequired !== false && !byRole('Approver')) {
        report('R13', 'error', set.id, 'approved with no approver assigned');
      }
    }
    if ((set.approverDecision === 'Rejected' || set.approverDecision === 'Returned for Correction') && !set.approverNotes?.trim()) {
      report('R13', 'warning', set.id, `approverDecision ${set.approverDecision} has no approverNotes giving the reason`);
    }
  });
}

/**
  what: audits project parties and asset links (rule 10).
  how: resolves the project client, then checks each link's provider against the asset's real owner, the client, and the client of the linked assurance set.
  with what file: .agents/skills/map-business-rules/scripts/audit.ts; reuses src/utils/projectHelpers.ts.
*/
function auditProjects(): void {
  MOCK_PROJECTS.forEach((project) => {
    const client = getProjectClientOrganization(project);

    if (project.serviceProvider && sameOrg(client, project.serviceProvider)) {
      report('R10', 'error', project.id, `service provider "${project.serviceProvider}" is also the client`);
    }

    project.assetLinks.forEach((link) => {
      const vessel = link.assetType === 'Vessel' ? MOCK_VESSELS.find((v) => v.id === link.assetId) : undefined;
      const crew = link.assetType === 'Crew' ? MOCK_CREW.find((c) => c.id === link.assetId) : undefined;
      const equipment = link.assetType === 'Equipment' ? MOCK_EQUIPMENT.find((e) => e.id === link.assetId) : undefined;

      if (!vessel && !crew && !equipment) {
        report('R10', 'error', project.id, `link ${link.id}: ${link.assetType} ${link.assetId} does not exist`);
        return;
      }

      const owner = vessel?.registeredOwner || crew?.organization || equipment?.owningOrganization || 'not recorded';
      if (!isAssetOwnedByOrganization(link.assetType, link.providerOrganization, vessel, crew, equipment)) {
        report('R10', 'error', project.id, `link ${link.id}: provider "${link.providerOrganization}" does not own ${link.assetId} (owner: ${owner})`);
      }

      const linkedSet = link.assuranceSetId ? ALL_SETS.find((s) => s.id === link.assuranceSetId) : undefined;
      if (link.assuranceSetId && !linkedSet) {
        report('R10', 'error', project.id, `link ${link.id}: assurance set ${link.assuranceSetId} does not exist`);
      }

      if (sameOrg(client, link.providerOrganization)) {
        if (!linkedSet?.internalDeployment) {
          report('R10', 'error', project.id, `link ${link.id}: client "${client}" supplies its own ${link.assetType.toLowerCase()} ${link.assetId} and the linked set is not flagged internalDeployment`);
        }
      } else if (!link.assuranceSetId && requiresAssuranceSetForAssetLink(client, link.providerOrganization)) {
        report('R10', 'error', project.id, `link ${link.id}: asset from "${link.providerOrganization}" has no assurance set`);
      }

      if (linkedSet) {
        const setClient = resolveParties(linkedSet).client;
        if (setClient && !sameOrg(client, setClient)) {
          report('R10', 'error', project.id, `link ${link.id}: set ${linkedSet.id} names client "${setClient}" but the project client is "${client}"`);
        }
      }
    });
  });
}

/**
  what: audits marketplace offerings (rule 11).
  how: resolves the registry asset behind each offering and checks that the offering's provider is that asset's owner.
  with what file: .agents/skills/map-business-rules/scripts/audit.ts; reads src/store/marketplaceMockData.ts.
*/
function auditMarketplace(): void {
  MOCK_MARKETPLACE_ITEMS.forEach((item) => {
    if (!item.linkedEntityId || !item.linkedEntityType) return;

    const vessel = item.linkedEntityType === 'vessel' ? MOCK_VESSELS.find((v) => v.id === item.linkedEntityId) : undefined;
    const crew = item.linkedEntityType === 'crew' ? MOCK_CREW.find((c) => c.id === item.linkedEntityId) : undefined;
    const equipment = item.linkedEntityType === 'equipment' ? MOCK_EQUIPMENT.find((e) => e.id === item.linkedEntityId) : undefined;

    if (!vessel && !crew && !equipment) {
      report('R11', 'error', item.id, `linked ${item.linkedEntityType} ${item.linkedEntityId} does not exist`);
      return;
    }

    const assetType = vessel ? 'Vessel' : crew ? 'Crew' : 'Equipment';
    const owner = vessel?.registeredOwner || crew?.organization || equipment?.owningOrganization || 'not recorded';
    if (!isAssetOwnedByOrganization(assetType, item.providerOrg, vessel, crew, equipment)) {
      report('R11', 'error', item.id, `provider "${item.providerOrg}" offers ${item.linkedEntityId}, which is owned by ${owner}`);
    }
  });
}

/**
  what: audits the actors behind audit events, notifications and persona sessions (rule 12).
  how: resolves each user id in MOCK_USERS, checks the role and organization recorded on the event, and flags actions a persona is hard-denied.
  with what file: .agents/skills/map-business-rules/scripts/audit.ts; reads src/store/mockData.ts and src/store/notificationMockData.ts.
*/
function auditActors(): void {
  const findUser = (id: string | undefined) => MOCK_USERS.find((u) => u.id === id);

  (Object.entries(MOCK_PERSONA_SESSION_USER_IDS) as [UserRolePersona, string][]).forEach(([persona, userId]) => {
    const user = findUser(userId);
    if (!user) report('R12', 'error', `session:${persona}`, `session user ${userId} does not exist`);
    else if (!userHasRole(user, persona)) report('R12', 'error', `session:${persona}`, `${userId} holds ${user.roles.join(', ')}, not ${persona}`);
  });

  MOCK_AUDIT_TRAIL.forEach((event) => {
    const user = findUser(event.userId);
    if (!user) {
      report('R12', 'error', event.id, `userId ${event.userId} does not exist in MOCK_USERS`);
    } else {
      if (!userHasRole(user, event.userRole)) {
        report('R12', 'error', event.id, `${event.userId} acted as ${event.userRole} but holds ${user.roles.join(', ')}`);
      }
      if (!sameOrg(event.organization, user.organization)) {
        report('R12', 'error', event.id, `organization "${event.organization}" but ${event.userId} belongs to "${user.organization}"`);
      }
    }
    const denied = DENIED_ACTIONS[event.userRole];
    if (denied && denied.test(event.action)) {
      report('R12', 'warning', event.id, `${event.userRole} recorded "${event.action}", an action that role is denied`);
    }
  });

  MOCK_NOTIFICATIONS.forEach((notification) => {
    const recipient = findUser(notification.recipientUserId);
    if (!recipient) {
      report('R12', 'error', notification.id, `recipientUserId ${notification.recipientUserId} does not exist`);
    }
    if (notification.senderUserId && !findUser(notification.senderUserId)) {
      report('R12', 'error', notification.id, `senderUserId ${notification.senderUserId} does not exist`);
    }
    if (recipient && notification.assignedRole) {
      const allowed = ROLE_HOLDERS[notification.assignedRole as WorkflowRole] ?? [notification.assignedRole];
      if (!allowed.some((role) => userHasRole(recipient, role))) {
        report('R12', 'error', notification.id, `${recipient.id} was assigned ${notification.assignedRole} but holds ${recipient.roles.join(', ')}`);
      }
    }
    if (notification.request && !findUser(notification.request.assigneeUserId)) {
      report('R12', 'error', notification.id, `request assignee ${notification.request.assigneeUserId} does not exist`);
    }
    if (notification.assuranceSetId && !ALL_SETS.some((s) => s.id === notification.assuranceSetId)) {
      report('R12', 'error', notification.id, `assuranceSetId ${notification.assuranceSetId} does not exist`);
    }
  });
}

/**
  what: lists organizations that appear under more than one spelling (reported under rule 8).
  how: collects every organization string in the mock data and pairs any two where one contains the other but the text differs.
  with what file: .agents/skills/map-business-rules/scripts/audit.ts only.
*/
function auditOrganizationSpellings(): void {
  const names = new Set<string>();
  const add = (value: string | undefined) => {
    if (value?.trim()) names.add(value.trim());
  };

  MOCK_USERS.forEach((u) => add(u.organization));
  MOCK_VESSELS.forEach((v) => add(v.registeredOwner));
  MOCK_EQUIPMENT.forEach((e) => add(e.owningOrganization));
  MOCK_CREW.forEach((c) => add(c.organization));
  MOCK_MARKETPLACE_ITEMS.forEach((m) => add(m.providerOrg));
  ALL_SETS.forEach((s) => [s.clientOrg, s.serviceProviderOrg, s.charterer, s.initiatorOrg].forEach(add));
  MOCK_PROJECTS.forEach((p) => {
    [p.requestingOrganization, p.clientOperator, p.ownerOrganization, p.operatorOrganization, p.charterer, p.serviceProvider].forEach(add);
    p.assetLinks.forEach((l) => add(l.providerOrganization));
  });

  const sorted = [...names].sort();
  sorted.forEach((shorter) => {
    sorted.forEach((longer) => {
      if (shorter !== longer && longer.toLowerCase().includes(shorter.toLowerCase())) {
        report('R8', 'warning', 'organizations', `one organization, two spellings: "${shorter}" and "${longer}"`);
      }
    });
  });
}

/**
  what: prints the grouped findings and totals, and sets the exit code.
  how: lists each rule with its error and warning counts followed by one line per finding; exits 1 when any error exists.
  with what file: .agents/skills/map-business-rules/scripts/audit.ts only.
*/
function printReport(): void {
  console.log('MAP business rules audit');
  console.log(
    `records: ${ALL_SETS.length} sets, ${MOCK_PROJECTS.length} projects, ${MOCK_USERS.length} users, ` +
      `${MOCK_MARKETPLACE_ITEMS.length} marketplace offerings, ${MOCK_AUDIT_TRAIL.length} audit events, ${MOCK_NOTIFICATIONS.length} notifications`,
  );

  (Object.keys(RULE_TITLES) as RuleId[]).forEach((rule) => {
    const rows = findings.filter((f) => f.rule === rule);
    const errors = rows.filter((f) => f.severity === 'error').length;
    const warnings = rows.length - errors;
    console.log(`\n[${rule}] ${RULE_TITLES[rule]}: ${errors} error(s), ${warnings} warning(s)`);
    rows.forEach((f) => console.log(`  ${f.severity === 'error' ? 'ERROR' : 'WARN '}  ${f.recordId.padEnd(26)} ${f.message}`));
  });

  const errorCount = findings.filter((f) => f.severity === 'error').length;
  console.log(`\nTotal: ${errorCount} error(s), ${findings.length - errorCount} warning(s)`);
  process.exitCode = errorCount > 0 ? 1 : 0;
}

const recordArg = process.argv.slice(2).find((arg) => !arg.startsWith('-') && !arg.endsWith('.ts'));

auditSets();
auditProjects();
auditMarketplace();
auditActors();
auditOrganizationSpellings();

if (recordArg) {
  /* a record id narrows the report to that record's findings */
  const kept = findings.filter((f) => f.recordId === recordArg);
  findings.length = 0;
  findings.push(...kept);
}
printReport();

