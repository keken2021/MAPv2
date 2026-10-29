/* 
  file summary: rbac stakeholder assignment helpers for filtering assurance sets and vessels by active user persona.
  responsibilities: determines if an assurance set or vessel is assigned to the current user persona.
  role in system: consumed by AssuranceTable, VerifierWorkspaceView, InspectorWorkspaceView, ApproverDashboardView, and FleetRegistryView.
*/

import { AssuranceSet, DatePermissionGrant } from "../types/assurance";
import { AuditTrailEvent, UserRolePersona } from "../types/audit";
import { MasterDocument } from "../types/document";
import { VesselInformation } from "../types/vessel";
import { EquipmentAsset } from "../types/equipment";
import { userMatchesAnyRole } from "./userRoleHelpers";
import { isDatePermissionActive } from "./validation";
import { VIEW_TO_SCOPE, canPerform, isUserOverride, getEffectiveUserScopeFlags, getRoleScopeFlags } from "./permissionHelpers";
import { RolePermissionMatrix, UserPermissionOverrides } from "../types/permissions";
import { UserProfile } from "../types/user";
import { MOCK_PERSONA_SESSION_USER_IDS } from "../store/mockData";
import { documentClientOrganizations } from "./documentVersionSnapshot";

/**
  what: checks if an assurance set is assigned to the specified user persona role.
  how: evaluates assignedSubmitter, assignedVerifier, assignedInspector, assignedApprover, and initiatorRole against active persona.
  with what file: src/utils/rbacHelpers.ts used by views and tables.
*/
function pilotPartyMatches(organization: string, ...fields: Array<string | undefined>): boolean {
  const org = organization.trim().toLowerCase();
  if (!org) return false;
  return fields.some((field) => Boolean(field) && field!.toLowerCase().includes(org));
}

/** Matches an assigned stakeholder against a user by name, ignoring case and organization suffix. */
export function assigneeMatchesUser(
  assigned: string | undefined,
  user?: { name?: string } | null,
): boolean {
  if (!assigned || !user?.name) return false;
  const userName = user.name.trim().toLowerCase();
  if (!userName) return false;
  const namePart = assigned.replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase();
  return namePart === userName;
}

export function isAssuranceSetAssignedToPersona(
  set: AssuranceSet,
  persona: UserRolePersona,
  organization?: string,
  user?: Pick<UserProfile, "id" | "name" | "organization" | "roles">,
): boolean {
  if (persona === "Administrator") {
    if (organization) {
      const orgMatches = pilotPartyMatches(
        organization,
        set.serviceProviderOrg,
        set.initiatorOrg,
        set.assignedSubmitter,
        set.stakeholders?.submitterOrg,
        set.assignedStakeholders?.submitterOrg,
      );
      const isOwnerVessel =
        (organization.toLowerCase().includes("northwind") || organization.toLowerCase().includes("pacific")) &&
        (set.vesselId === "VESSEL-005" || Boolean(set.vesselName?.toLowerCase().includes("atlantic ocean")));
      const isMadeByThisOrgAdmin =
        set.createdByPersona === "Administrator" &&
        pilotPartyMatches(organization, set.initiatorOrg, set.serviceProviderOrg);
      return orgMatches || isOwnerVessel || isMadeByThisOrgAdmin;
    }
    /* administrator only sees assurance sets they made (northwind marine) or made by c admin for the admin's vessels (VESSEL-005 MV Atlantic Ocean) */
    const isNorthwindVessel =
      set.vesselId === "VESSEL-005" ||
      Boolean(set.vesselName?.toLowerCase().includes("atlantic ocean"));

    const isNorthwindStakeholder =
      Boolean(set.initiatorOrg?.toLowerCase().includes("northwind")) ||
      Boolean(set.assignedSubmitter?.toLowerCase().includes("northwind")) ||
      Boolean(set.stakeholders?.submitterOrg?.toLowerCase().includes("northwind")) ||
      Boolean(set.assignedStakeholders?.submitterOrg?.toLowerCase().includes("northwind")) ||
      Boolean(set.assignedStakeholders?.verifierOrg?.toLowerCase().includes("northwind")) ||
      Boolean(set.assignedStakeholders?.inspectorOrg?.toLowerCase().includes("northwind")) ||
      Boolean(set.assignedStakeholders?.approverOrg?.toLowerCase().includes("northwind"));

    const isMadeByAdmin =
      Boolean(set.createdByPersona === "Administrator") ||
      Boolean(set.initiatorRole?.toLowerCase().includes("northwind"));

    return isNorthwindVessel || isNorthwindStakeholder || isMadeByAdmin;
  }
  if (persona === "Submitter") {
    if (user) {
      return assigneeMatchesUser(set.assignedSubmitter, user);
    }
    /* submitter / vessel admin can only access assurance sets for their own organization */
    const isAssignedToOrg = Boolean(
      (set.assignedSubmitter &&
        (set.assignedSubmitter.includes("M. Chen") ||
          set.assignedSubmitter.includes("E. Ramirez") ||
          set.assignedSubmitter.includes("Pacific Ocean") ||
          set.assignedSubmitter.includes("Northwind Marine"))) ||
      (set.initiatorOrg &&
        (set.initiatorOrg.includes("Pacific Ocean") ||
          set.initiatorOrg.includes("Northwind Marine")))
    );

    if (organization) {
      return pilotPartyMatches(
        organization,
        set.assignedSubmitter,
        set.serviceProviderOrg,
        set.stakeholders?.submitterOrg,
      );
    }
    return isAssignedToOrg;
  }
  if (persona === "Verifier") {
    if (user) {
      return assigneeMatchesUser(set.assignedVerifier, user);
    }
    if (organization) {
      return pilotPartyMatches(organization, set.assignedVerifier, set.stakeholders?.verifierOrg);
    }
    return Boolean(set.assignedVerifier);
  }
  if (persona === "Inspector") {
    const assigned = Boolean(set.mandatoryInspectionRequired && set.assignedInspector);
    if (!assigned) return false;
    if (user) {
      return assigneeMatchesUser(set.assignedInspector, user);
    }
    if (!organization) return assigned;
    return assigned && pilotPartyMatches(organization, set.assignedInspector, set.stakeholders?.inspectorOrg);
  }
  if (persona === "Approver") {
    /* approver persona can only see assurance sets that are already verified and awaiting approval or certified */
    const isVerifiedAndAwaitingApproval =
      set.stage === "Approval" ||
      set.stage === "Approved" ||
      set.approverDecision !== "Pending" ||
      (set.requirements.length > 0 &&
        set.requirements.every(
          (r) => !r.isMandatory || r.verifierStatus === "Verified" || r.isFulfilled,
        ));
    const awaiting = Boolean(set.assignedApprover && isVerifiedAndAwaitingApproval);
    if (!awaiting) return false;
    if (user) {
      return assigneeMatchesUser(set.assignedApprover, user);
    }
    if (!organization) return awaiting;
    return awaiting && pilotPartyMatches(organization, set.assignedApprover, set.stakeholders?.approverOrg);
  }
  if (persona === "C Admin") {
    const legacy =
      set.initiatorRole === "C Admin · Client Created" ||
      set.initiatorOrg === "Chevron Australia Pty Ltd" ||
      set.charterer === "Chevron Australia Pty Ltd" ||
      set.charterer === "Southern Basin Energy Pty Ltd" ||
      set.initiatorOrg === "Southern Basin Energy Pty Ltd" ||
      set.initiatorOrg === "Woodside Energy Ltd" ||
      set.charterer === "Woodside Energy Ltd" ||
      set.initiatorOrg === "Inpex Operations Australia" ||
      set.charterer === "Inpex Operations Australia";
    if (!organization) return legacy;
    return pilotPartyMatches(organization, set.clientOrg, set.charterer, set.initiatorOrg);
  }
  return true;
}

/* workflow roles that get the assurance sets page read-only, with role actions on assigned sets only */
export const ASSURANCE_SETS_READ_ONLY_ROLES: UserRolePersona[] = [
  "Submitter",
  "Verifier",
  "Inspector",
  "Approver",
];

/* admin roles that may open the marketplace: vessel admin (administrator) and client admin (c admin) */
export const MARKETPLACE_ROLES: UserRolePersona[] = ["Administrator", "C Admin"];

/**
  what: true when the persona may see and open the marketplace; input is the active persona.
  how: checks the persona against MARKETPLACE_ROLES.
  with what file: src/utils/rbacHelpers.ts used by isViewAccessibleToPersona here and AppSidebar.tsx.
*/
export function isMarketplacePersona(persona: UserRolePersona): boolean {
  return MARKETPLACE_ROLES.includes(persona);
}

export interface AssuranceSetRoleActions {
  canManage: boolean;
  canUpload: boolean;
  canVerify: boolean;
  canInspect: boolean;
  canApprove: boolean;
  canChangeDates: boolean;
}

/**
  what: true when the persona may only read the assurance sets page (no create, template, or draft editing).
  how: checks the persona against ASSURANCE_SETS_READ_ONLY_ROLES.
  with what file: src/utils/rbacHelpers.ts used by AssuranceTable.tsx and AssuranceDetailView.tsx.
*/
export function isAssuranceSetsReadOnlyPersona(persona: UserRolePersona): boolean {
  return ASSURANCE_SETS_READ_ONLY_ROLES.includes(persona);
}

/**
  what: true when a client admin created the assurance set; input is the set.
  how: reads createdByPersona when it is recorded, otherwise the initiating role.
  with what file: src/utils/rbacHelpers.ts used by getAssuranceSetRoleActions here and DocumentReviewDrawer.tsx.
*/
export function isAssuranceSetCreatedByCAdmin(
  set: Pick<AssuranceSet, "createdByPersona" | "initiatorRole">,
): boolean {
  if (set.createdByPersona === "C Admin") return true;
  if (set.createdByPersona === "Administrator") return false;
  return (
    set.initiatorRole === "C Admin · Client Created" ||
    set.initiatorRole === "Client Admin"
  );
}

/**
  what: resolves which actions the persona may take on one assurance set; input is the set and the active persona.
  how: administrator and c admin keep manage rights on assigned sets; submitter and administrator can upload on assigned sets; c admin also verifies sets a c admin created; verifier verifies assigned sets; service providers (Administrator, Submitter) never verify.
  with what file: src/utils/rbacHelpers.ts used by AssuranceDetailView.tsx; segregation checks stay in DocumentReviewDrawer.tsx and ApproverDashboardView.tsx.
*/
export function getAssuranceSetRoleActions(
  set: AssuranceSet,
  persona: UserRolePersona,
  organization?: string,
  user?: Pick<UserProfile, "id" | "name" | "organization" | "roles">,
): AssuranceSetRoleActions {
  const isAssigned = isAssuranceSetAssignedToPersona(set, persona, organization, user);

  /* administrators and client admins may only manage sets they are assigned stakeholders in */
  const canManage = (persona === "Administrator" || persona === "C Admin") && isAssigned;

  /* service providers (Administrator, Submitter) may upload on their assigned sets; clients and reviewers never upload */
  const canUpload = (persona === "Administrator" || persona === "Submitter") && isAssigned;

  /* the client admin verifies the documents the provider uploads on a set the client admin created */
  const isClientVerifier =
    persona === "C Admin" &&
    isAssuranceSetCreatedByCAdmin(set) &&
    isAssigned;

  /* verifier verifies on assigned sets; service providers (Administrator, Submitter) never verify */
  const canVerify = isClientVerifier || (persona === "Verifier" && isAssigned);

  /* inspector inspects on assigned sets */
  const canInspect = persona === "Inspector" && isAssigned;

  /* approver approves on assigned sets */
  const canApprove = persona === "Approver" && isAssigned;

  /* short-term permission given to named client users to change dates (BRD V4.2 change 6) */
  const canChangeDates = canUserChangeAssuranceDates(user, set, persona);

  return {
    canManage,
    canUpload,
    canVerify,
    canInspect,
    canApprove,
    canChangeDates,
  };
}

/**
  what: checks if a user is a client user (C Admin or member of the client organization).
  how: checks user role and organization against the set client organization and charterer.
  with what file: src/utils/rbacHelpers.ts used by date permission gating.
*/
export function isClientUser(
  user: Pick<UserProfile, "id" | "name" | "organization" | "roles"> | undefined,
  set?: Pick<AssuranceSet, "clientOrg" | "charterer" | "initiatorOrg" | "serviceProviderOrg">,
  persona?: UserRolePersona,
): boolean {
  if (persona === "C Admin") return true;
  if (user?.roles?.includes("C Admin")) return true;
  if (!user?.organization) return false;

  /* vendor roles or service provider organizations are never client users */
  if (persona === "Administrator" || persona === "Submitter") return false;
  if (set?.serviceProviderOrg && orgFieldMatches(user.organization, set.serviceProviderOrg)) {
    return false;
  }

  const clientOrg = set?.clientOrg || set?.charterer;
  if (clientOrg && orgFieldMatches(user.organization, clientOrg)) {
    return true;
  }
  if (set?.initiatorOrg && orgFieldMatches(user.organization, set.initiatorOrg)) {
    return true;
  }
  return false;
}

/**
  what: retrieves the active date change permission grant for a user on an assurance set, if valid.
  how: matches the user by id or name and ensures the grant is not expired.
  with what file: src/utils/rbacHelpers.ts used by AssuranceDetailView.tsx and validation checks.
*/
export function getUserActiveDatePermission(
  user: Pick<UserProfile, "id" | "name" | "organization" | "roles"> | undefined,
  set: AssuranceSet,
  now: Date = new Date(),
): DatePermissionGrant | undefined {
  if (!user || !set.datePermissionGrants?.length) return undefined;
  return set.datePermissionGrants.find((grant) => {
    const matchesUser =
      (user.id && grant.userId === user.id) ||
      (user.name && grant.userName.toLowerCase() === user.name.toLowerCase());
    return Boolean(matchesUser && isDatePermissionActive(grant, now));
  });
}

/**
  what: checks if a client user is authorized to modify target dates on an assurance set.
  how: user must be a client user and have an active, non-expired date permission grant.
  with what file: src/utils/rbacHelpers.ts used by AssuranceDetailView.tsx and useMapStore.ts.
*/
export function canUserChangeAssuranceDates(
  user: Pick<UserProfile, "id" | "name" | "organization" | "roles"> | undefined,
  set: AssuranceSet,
  persona?: UserRolePersona,
  now: Date = new Date(),
): boolean {
  if (!isClientUser(user, set, persona)) return false;
  return Boolean(getUserActiveDatePermission(user, set, now));
}

/**
  what: collects document IDs linked to assurance requirements on sets assigned to the persona.
  how: filters assurance sets by stakeholder assignment and gathers requirement documentId values.
  with what file: src/utils/rbacHelpers.ts used by VerifierWorkspaceView.tsx.
*/
export function getVerifierQueueDocumentIds(
  assuranceSets: AssuranceSet[],
  persona: UserRolePersona,
  organization?: string,
): Set<string> {
  const assignedSets = assuranceSets.filter((set) =>
    isAssuranceSetAssignedToPersona(set, persona, organization),
  );
  const ids = new Set<string>();
  assignedSets.forEach((set) => {
    set.requirements.forEach((req) => {
      if (req.documentId) ids.add(req.documentId);
    });
  });
  return ids;
}

/**
  what: filters master documents to those in the verifier's assigned assurance-set work queue.
  how: keeps only documents whose IDs appear on requirements for persona-assigned assurance sets.
  with what file: src/utils/rbacHelpers.ts used by VerifierWorkspaceView.tsx.
*/
export function filterDocumentsForVerifierQueue(
  documents: MasterDocument[],
  assuranceSets: AssuranceSet[],
  persona: UserRolePersona,
  organization?: string,
): MasterDocument[] {
  const allowedIds = getVerifierQueueDocumentIds(assuranceSets, persona, organization);
  return documents.filter((d) => allowedIds.has(d.id));
}

/**
  what: whether this organization may see a document that sits on an assurance object.
  how: another client does not see it. The client who owns the set does, and so does that set's provider. A viewer who is not a client of any set is left to the existing assignment filter.
  with what file: src/utils/rbacHelpers.ts used by the object list and VerifierWorkspaceView.tsx.
*/
export function isDocumentVisibleToOrganization(
  documentId: string,
  sets: AssuranceSet[],
  viewerOrganization: string,
): boolean {
  const owners = documentClientOrganizations(documentId, sets);
  if (owners.length === 0 || !viewerOrganization.trim()) return true;
  if (owners.some((owner) => orgFieldMatches(viewerOrganization, owner))) return true;
  const viewerIsClient = sets.some((set) => orgFieldMatches(viewerOrganization, set.clientOrg || set.charterer || ''));
  if (!viewerIsClient) return true;
  const viewerIsProvider = sets.some(
    (set) =>
      owners.some((owner) => orgFieldMatches(owner, set.clientOrg || set.charterer || '')) &&
      orgFieldMatches(viewerOrganization, set.serviceProviderOrg || ''),
  );
  return viewerIsProvider;
}

export function filterDocumentsVisibleToOrganization(
  documents: MasterDocument[],
  sets: AssuranceSet[],
  viewerOrganization: string,
): MasterDocument[] {
  return documents.filter((document) => isDocumentVisibleToOrganization(document.id, sets, viewerOrganization));
}

export type AssuranceSetStakeholderLockInput = Pick<
  AssuranceSet,
  'stage' | 'approverDecision' | 'clientWorkflowStage'
>;

/**
  what: human-readable reason stakeholder reassignment is blocked, or null when edits are allowed.
  how: locks finalized campaigns (Approved/Certified, client-approved) and sets sent for review; allows edits during Returned for Correction.
*/
export function getAssuranceSetStakeholderLockReason(
  assuranceSet: AssuranceSetStakeholderLockInput,
): string | null {
  if (assuranceSet.approverDecision === 'Returned for Correction') {
    return null;
  }
  if (assuranceSet.stage === 'Approved' || assuranceSet.stage === 'Certified') {
    return 'Stakeholders are locked once the assurance set is approved or certified.';
  }
  if (assuranceSet.approverDecision === 'Approved') {
    return 'Stakeholder assignments are locked after formal approval.';
  }
  const clientStage = assuranceSet.clientWorkflowStage;
  if (clientStage === 'in_review') {
    return 'Stakeholders are locked while the assurance set is under review.';
  }
  if (clientStage === 'pending_approval') {
    return 'Stakeholder assignments are locked while awaiting client approval.';
  }
  if (clientStage === 'approved') {
    return 'Stakeholder assignments are locked after client workflow approval.';
  }
  return null;
}

/** True when verifier/inspector/approver/submitter cannot be reassigned on this set. */
export function isAssuranceSetStakeholderAssignmentLocked(
  assuranceSet: AssuranceSetStakeholderLockInput,
): boolean {
  return getAssuranceSetStakeholderLockReason(assuranceSet) !== null;
}

/** Administrator and C Admin may reassign stakeholders only on sets they are assigned stakeholders in and while the campaign is still editable. */
export function canEditAssuranceSetStakeholders(
  assuranceSet: AssuranceSetStakeholderLockInput,
  persona: UserRolePersona,
  organization?: string,
  user?: Pick<UserProfile, "id" | "name" | "organization" | "roles">,
): boolean {
  if (persona !== 'Administrator' && persona !== 'C Admin') {
    return false;
  }
  if (isAssuranceSetStakeholderAssignmentLocked(assuranceSet)) {
    return false;
  }
  if (organization && ('requirements' in assuranceSet || 'initiatorOrg' in assuranceSet || 'vesselId' in assuranceSet)) {
    return isAssuranceSetAssignedToPersona(assuranceSet as AssuranceSet, persona, organization, user);
  }
  return true;
}

/**
  what: checks if a vessel is owned or managed by the current administrator organization.
  how: inspects registeredOwner, technicalManager, and ismCompany for organization keywords.
  with what file: src/utils/rbacHelpers.ts used by VesselDetailView.tsx, FleetRegistryView.tsx, and VesselTable.tsx.
*/
export function isVesselOwnedByAdmin(v?: VesselInformation): boolean {
  if (!v) return false;
  const ownerLower = (v.registeredOwner || '').toLowerCase();
  const techManagerLower = (v.technicalManager || '').toLowerCase();
  const ismLower = (v.ismCompany || '').toLowerCase();

  return (
    ownerLower.includes('northwind') ||
    ownerLower.includes('pacific ocean') ||
    techManagerLower.includes('northwind') ||
    techManagerLower.includes('pacific') ||
    ismLower.includes('northwind') ||
    ismLower.includes('pacific')
  );
}

export type FleetRegistryTab = 'available' | 'chartered' | 'all' | 'owned';

const ORG_MATCH_STOP_WORDS = new Set(['pty', 'ltd', 'pl', 'inc', 'corp', 'the', 'and']);

/**
  what: extracts significant tokens from an organization name for fuzzy ownership matching.
*/
function getOrgMatchTokens(org: string): string[] {
  return org
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2 && !ORG_MATCH_STOP_WORDS.has(token));
}

/**
  what: true when a vessel ownership/management field matches the client organization name.
  how: uses substring match first, then requires enough distinctive token overlap.
*/
export function orgFieldMatches(org: string, fieldValue: string): boolean {
  if (!org.trim() || !fieldValue.trim()) return false;

  const orgLower = org.toLowerCase();
  const fieldLower = fieldValue.toLowerCase();
  if (fieldLower.includes(orgLower) || orgLower.includes(fieldLower)) return true;

  const tokens = getOrgMatchTokens(org);
  if (tokens.length === 0) return false;

  const matched = tokens.filter((token) => fieldLower.includes(token));
  const requiredMatches = tokens.length === 1 ? 1 : Math.min(2, tokens.length);
  return matched.length >= requiredMatches;
}

/**
  what: resolves the logged-in client admin's organization from mock user profiles.
*/
export function getClientAdminOrganization(
  users: Pick<import('../types/user').UserProfile, 'roles' | 'organization'>[],
  preferredOrganization?: string,
): string {
  if (preferredOrganization?.trim()) return preferredOrganization.trim();
  const cAdmin = users.find((user) => user.roles.includes('C Admin'));
  return cAdmin?.organization || 'Southern Basin Energy Pty Ltd';
}

/**
  what: true when the vessel is owned or managed by the client admin organization.
*/
export function isVesselOwnedByClientOrg(
  vessel: VesselInformation | undefined,
  clientOrg: string,
): boolean {
  if (!vessel || !clientOrg.trim()) return false;

  return [vessel.registeredOwner, vessel.technicalManager, vessel.ismCompany].some(
    (field) => field && orgFieldMatches(clientOrg, field),
  );
}

/**
  what: true when a vessel is linked to an active C Admin assurance campaign or under charter.
*/
export function isVesselCharteredByCAdmin(
  vessel: VesselInformation,
  assuranceSets: AssuranceSet[],
): boolean {
  return (
    vessel.status === 'Under Charter' ||
    assuranceSets.some(
      (set) =>
        set.vesselId === vessel.id &&
        isAssuranceSetAssignedToPersona(set, 'C Admin'),
    )
  );
}

/**
  what: third-party vessels available for external charter vetting (excludes own fleet and active charters).
*/
export function filterCAdminAvailableToCharter(
  vessels: VesselInformation[],
  assuranceSets: AssuranceSet[],
  clientOrg: string,
): VesselInformation[] {
  return vessels.filter(
    (vessel) =>
      vessel.status !== 'Under Charter' &&
      !isVesselCharteredByCAdmin(vessel, assuranceSets) &&
      !isVesselOwnedByClientOrg(vessel, clientOrg),
  );
}

/**
  what: vessels a vessel admin may place on a new assurance set.
  how: drops vessels owned or managed by the vessel admin organization, and vessels already under charter. Creating the set makes the vessel admin the client of another organization's vessel.
*/
export function filterVesselAdminAvailableToCharter(
  vessels: VesselInformation[],
): VesselInformation[] {
  return vessels.filter(
    (vessel) => !isVesselOwnedByAdmin(vessel) && vessel.status !== 'Under Charter',
  );
}

/**
  what: vessels owned or managed by the client admin organization.
*/
export function filterCAdminOwnFleet(
  vessels: VesselInformation[],
  clientOrg: string,
): VesselInformation[] {
  return vessels.filter(
    (vessel) =>
      vessel.status !== 'Under Charter' && isVesselOwnedByClientOrg(vessel, clientOrg),
  );
}

/**
  what: vessels already linked to C Admin assurance campaigns.
*/
export function filterCAdminActiveCharters(
  vessels: VesselInformation[],
  assuranceSets: AssuranceSet[],
): VesselInformation[] {
  return vessels.filter(
    (vessel) =>
      isVesselCharteredByCAdmin(vessel, assuranceSets) && vessel.status !== 'Under Charter',
  );
}

/**
  what: true when the charterer organization matches the vessel owner/manager (self-charter risk).
*/
export function isChartererMatchingVesselOwner(
  charterer: string,
  vessel: VesselInformation | undefined,
): boolean {
  if (!charterer.trim() || !vessel) return false;
  return isVesselOwnedByClientOrg(vessel, charterer);
}

/**
  what: filters a list of vessels based on active stakeholder assignments and ownership.
  how: for administrator, restricts to vessels owned/managed by northwind marine pty ltd; for submitter / vessel admin, matches vessels owned/managed by their company; for c admin, allows full access to all vessels under the platform; for other non-admin personas, matches assigned assurance sets.
  with what file: src/utils/rbacHelpers.ts used by FleetRegistryView.tsx, VesselTable.tsx, DashboardView.tsx, and InspectorWorkspaceView.tsx.
*/
export function filterEquipmentForPersona(
  equipment: EquipmentAsset[],
  vessels: VesselInformation[],
  assuranceSets: AssuranceSet[],
  persona: UserRolePersona,
): EquipmentAsset[] {
  const visibleVesselIds = new Set(
    filterVesselsForPersona(vessels, assuranceSets, persona).map((v) => v.id),
  );
  return equipment.filter(
    (item) => !item.parentVesselId || visibleVesselIds.has(item.parentVesselId),
  );
}

export function filterVesselsForPersona(
  vessels: VesselInformation[],
  assuranceSets: AssuranceSet[],
  persona: UserRolePersona,
): VesselInformation[] {
  if (persona === "C Admin") return vessels;

  if (persona === "Administrator") {
    /* administrator only sees vessels owned/managed by their organization (northwind marine pty ltd) */
    return vessels.filter((v) => {
      const ownerLower = (v.registeredOwner || "").toLowerCase();
      const techManagerLower = (v.technicalManager || "").toLowerCase();
      const ismLower = (v.ismCompany || "").toLowerCase();

      return (
        ownerLower.includes("northwind") ||
        techManagerLower.includes("northwind") ||
        ismLower.includes("northwind")
      );
    });
  }

  if (persona === "Submitter") {
    /* vessel admin / submitter can only see their own vessels (owned/managed by their organization) */
    return vessels.filter((v) => {
      const ownerLower = (v.registeredOwner || "").toLowerCase();
      const techManagerLower = (v.technicalManager || "").toLowerCase();
      const ismLower = (v.ismCompany || "").toLowerCase();

      return (
        ownerLower.includes("pacific ocean") ||
        ownerLower.includes("northwind") ||
        techManagerLower.includes("pacific") ||
        techManagerLower.includes("northwind") ||
        ismLower.includes("pacific") ||
        ismLower.includes("northwind")
      );
    });
  }

  const assignedSetVesselIds = new Set(
    assuranceSets
      .filter((set) => isAssuranceSetAssignedToPersona(set, persona))
      .map((set) => set.vesselId),
  );

  return vessels.filter((v) => assignedSetVesselIds.has(v.id));
}

/**
  what: filters list of users based on active user persona rbac rules.
  how: c admin sees their own user profile details (c admin role / matching persona) plus any users they created/invited; vessel admin (administrator / submitter) sees their own details (administrator role / vessel provider admin) plus any users they created/invited; other personas have no user management access.
  with what file: src/utils/rbacHelpers.ts consumed by UserManagementView.tsx and UserTable.tsx.
*/
export function filterUsersForPersona(
  users: import("../types/user").UserProfile[],
  persona: UserRolePersona,
): import("../types/user").UserProfile[] {
  if (persona === "Administrator" || persona === "Submitter") {
    /* vessel admin sees their own details (and internal organization members) plus users they created or invited */
    return users.filter(
      (u) =>
        u.roles.includes("Administrator") ||
        u.roles.includes("Submitter") ||
        u.name === "K. Osei" ||
        u.organization === "Northwind Marine Pty Ltd" ||
        u.createdBy === "Administrator" ||
        u.invitedBy === "Administrator" ||
        u.createdBy === "Vessel Provider Admin" ||
        u.createdBy === "Submitter"
    );
  }

  if (persona === "C Admin") {
    /* c admin sees their own details plus any users they created or invited */
    return users.filter(
      (u) =>
        u.roles.includes("C Admin") ||
        u.name === "S. Basin" ||
        u.createdBy === "C Admin" ||
        u.invitedBy === "C Admin"
    );
  }

  /* verifier, inspector, approver — no access to user list */
  return [];
}

/**
  what: filters audit trail event logs to return only the user's activities.
  how: returns events where ev.userId matches the user's id (session user ID or persona fallback).
  with what file: src/utils/rbacHelpers.ts consumed by AuditTrailView, AuditTrailDrawer, and VesselDetailView.
*/
export function filterAuditTrailForUser(
  events: AuditTrailEvent[],
  userId?: string,
  persona?: UserRolePersona,
): AuditTrailEvent[] {
  const effectiveUserId = userId || (persona ? MOCK_PERSONA_SESSION_USER_IDS[persona] : undefined);
  if (!effectiveUserId && !persona) return [];

  return events.filter((ev) => {
    if (effectiveUserId && ev.userId === effectiveUserId) {
      return true;
    }
    if (persona && (ev.userId === persona || ev.userId === `${persona} (no user record)`)) {
      return true;
    }
    return false;
  });
}

/**
  what: filters audit trail event logs based on active user persona and session user RBAC rules.
  how: ensures the audit trail displays only the active user's activities.
  with what file: src/utils/rbacHelpers.ts consumed by AuditTrailView, AuditTrailDrawer, and VesselDetailView.
*/
export function filterAuditTrailForPersona(
  events: AuditTrailEvent[],
  persona: UserRolePersona,
  assuranceSets?: AssuranceSet[],
  vessels?: VesselInformation[],
  userId?: string,
): AuditTrailEvent[] {
  return filterAuditTrailForUser(events, userId, persona);
}

/**
  what: computes dynamic back button label and target route based on previous hash view and active persona RBAC sidepanel access.
  how: returns 'Back to Dashboard' if opened from dashboard or if the active persona has no sidepanel button for the parent view.
  with what file: src/utils/rbacHelpers.ts consumed by HeaderBanner, VesselDetailView, DocumentDetailView, InspectionChecklistView, and CreateAssuranceSetView.
*/
export function getBackButtonInfo(
  parentView: "assurance-sets" | "vessels" | "equipment" | "project" | "documents" | "inspector" | "crew" | "capa" | "approver" | "roles-permissions" | "users" | "marketplace",
  parentLabel: string,
  previousHashView: string | undefined,
  activePersona: UserRolePersona,
  previousEntityId?: string,
): { label: string; targetView: string; targetEntityId?: string } {
  let isParentAllowedInSidepanel = true;

  if (parentView === "vessels" || parentView === "equipment" || parentView === "project") {
    isParentAllowedInSidepanel = [
      "Administrator",
      "C Admin",
      "Submitter",
    ].includes(activePersona);
  } else if (parentView === "assurance-sets") {
    isParentAllowedInSidepanel = [
      "Administrator",
      "C Admin",
      "Submitter",
      "Verifier",
      "Inspector",
      "Approver",
    ].includes(activePersona);
  } else if (parentView === "documents") {
    isParentAllowedInSidepanel = ["Administrator", "Submitter"].includes(
      activePersona,
    );
  } else if (parentView === "inspector") {
    isParentAllowedInSidepanel = ["Administrator"].includes(activePersona);
  } else if (parentView === "crew") {
    isParentAllowedInSidepanel = ["Administrator", "Submitter"].includes(
      activePersona,
    );
  } else if (parentView === "capa") {
    isParentAllowedInSidepanel = [
      "Administrator",
      "Inspector",
      "Verifier",
      "Approver",
    ].includes(activePersona);
  } else if (parentView === "approver") {
    isParentAllowedInSidepanel = ["Administrator", "Approver"].includes(activePersona);
  } else if (parentView === "roles-permissions") {
    isParentAllowedInSidepanel = ["Administrator"].includes(activePersona);
  } else if (parentView === "users") {
    isParentAllowedInSidepanel = ["Administrator", "C Admin"].includes(activePersona);
  } else if (parentView === "marketplace") {
    isParentAllowedInSidepanel = isMarketplacePersona(activePersona);
  }

  /* notifications is in every persona's sidepanel, so a record opened from it always returns there */
  if (previousHashView === "notifications") {
    return {
      label: "Back to Notifications",
      targetView: "notifications",
      targetEntityId: undefined,
    };
  }

  if (previousHashView === "dashboard" || !isParentAllowedInSidepanel) {
    return {
      label: "Back to Dashboard",
      targetView: "dashboard",
    };
  }

  if (previousHashView === "marketplace") {
    return {
      label: "Back to Marketplace",
      targetView: "marketplace",
      targetEntityId: undefined,
    };
  }
  if (previousHashView === "crew") {
    return {
      label: previousEntityId
        ? "Back to Seafarer Profile"
        : "Back to Crew Directory",
      targetView: "crew",
      targetEntityId: previousEntityId,
    };
  }

  if (previousHashView === "vessels") {
    return {
      label: previousEntityId
        ? "Back to Vessel Detail"
        : "Back to Fleet Registry",
      targetView: "vessels",
      targetEntityId: previousEntityId,
    };
  }

  if (previousHashView === "equipment") {
    return {
      label: previousEntityId
        ? "Back to Equipment Detail"
        : "Back to Equipment Registry",
      targetView: "equipment",
      targetEntityId: previousEntityId,
    };
  }

  if (previousHashView === "project") {
    return {
      label: previousEntityId && previousEntityId !== "new"
        ? "Back to Project Detail"
        : "Back to Projects",
      targetView: "project",
      targetEntityId: previousEntityId,
    };
  }

  if (previousHashView === "assurance-sets") {
    return {
      label: previousEntityId
        ? "Back to Assurance Set"
        : "Back to Assurance Sets",
      targetView: "assurance-sets",
      targetEntityId: previousEntityId,
    };
  }

  if (previousHashView === "documents") {
    return {
      label: previousEntityId
        ? "Back to Document Detail"
        : "Back to Document Library",
      targetView: "documents",
      targetEntityId: previousEntityId,
    };
  }

  if (previousHashView === "approver") {
    return {
      label: previousEntityId
        ? "Back to Approval Detail"
        : "Back to Approval Requests",
      targetView: "approver",
      targetEntityId: previousEntityId,
    };
  }

  if (previousHashView === "inspector" || previousHashView === "inspection") {
    return {
      label: previousEntityId
        ? "Back to Inspection Checklist"
        : "Back to Physical Inspections",
      targetView: "inspector",
      targetEntityId: previousEntityId,
    };
  }

  return {
    label: `Back to ${parentLabel}`,
    targetView: parentView,
    targetEntityId: undefined,
  };
}

/**
  what: checks if a view route is accessible to persona evaluating initial baseline rules overridden by matrix flags.
  how: computes baseline persona route accessibility and overrides with per-user or role matrix read permission if present.
  with what file: src/utils/rbacHelpers.ts used by App.tsx and useMapStore.ts.
*/
export function isViewAccessibleToPersona(
  view: string,
  _entityId: string | undefined | null,
  persona: UserRolePersona,
  matrix?: RolePermissionMatrix,
  overrides?: UserPermissionOverrides,
  user?: Pick<UserProfile, 'id' | 'roles'> | null,
): boolean {
  /* roles & permissions settings page — administrator only (brd role_rights row is blank) */
  if (view === "roles-permissions") {
    return persona === "Administrator";
  }

  /* creation wizard is client-only: requires create right on assurance_sets; workflow roles and vendors cannot access */
  if (view === "create-assurance-set") {
    if (isAssuranceSetsReadOnlyPersona(persona)) {
      return false;
    }
    if (matrix) {
      if (user && isUserOverride(overrides || {}, user.id, "assurance_sets", "create")) {
        return getEffectiveUserScopeFlags(matrix, overrides || {}, user, "assurance_sets").create;
      }
      return getRoleScopeFlags(matrix, persona, "assurance_sets").create;
    }
    return persona === "C Admin";
  }

  /* marketplace is for vessel admin and client admin only, whatever the matrix grants */
  if (view === "marketplace" && !isMarketplacePersona(persona)) {
    return false;
  }

  /* baseline initial persona route checks (matrix overrides when supplied) */
  const getInitialAllowed = (): boolean => {
    if (view === "users") {
      return persona === "Administrator" || persona === "C Admin";
    }
    if (view === "crew") {
      return persona === "Administrator";
    }
    if (view === "capa" || view === "capas") {
      return (
        persona === "Administrator" ||
        persona === "C Admin" ||
        persona === "Inspector"
      );
    }
    if (
      view === "dashboard" ||
      view === "audit" ||
      view === "marketplace" ||
      view === "notifications"
    )
      return true;

    if (persona === "Administrator") {
      return true;
    }

    if (persona === "C Admin") {
      if (
        [
          "documents",
          "crew",
          "verifier",
          "approver",
          "inspector",
          "inspection",
        ].includes(view)
      ) {
        return false;
      }
      return true;
    }

    if (persona === "Submitter") {
      if (
        [
          "inspector",
          "inspection",
          "approver",
          "users",
          "crew",
          "capa",
          "capas",
        ].includes(view)
      ) {
        return false;
      }
      return true;
    }

    if (persona === "Verifier") {
      if (
        [
          "vessels",
          "equipment",
          "create-assurance-set",
          "inspector",
          "inspection",
          "approver",
          "users",
          "crew",
          "capa",
          "capas",
        ].includes(view)
      ) {
        return false;
      }
      return true;
    }

    if (persona === "Inspector") {
      return (
        view === "dashboard" ||
        view === "audit" ||
        view === "capa" ||
        view === "capas" ||
        view === "inspector" ||
        view === "inspection" ||
        view === "assurance-sets"
      );
    }

    if (persona === "Approver") {
      return (
        view === "dashboard" ||
        view === "audit" ||
        view === "approver" ||
        view === "assurance-sets"
      );
    }

    return true;
  };

  const initialAllowed = getInitialAllowed();

  /* if permission matrix is supplied, check for user override or role matrix override */
  if (matrix) {
    const scopeKey = VIEW_TO_SCOPE[view];
    if (scopeKey) {
      if (user && isUserOverride(overrides || {}, user.id, scopeKey, "read")) {
        return getEffectiveUserScopeFlags(matrix, overrides || {}, user, scopeKey).read;
      }
      return getRoleScopeFlags(matrix, persona, scopeKey).read;
    }
  }

  return initialAllowed;
}

/**
  what: checks if a vessel matches a search query across vessel attributes, linked assurance sets, and associated documents.
  how: checks vessel properties, linked assurance sets (ID, title, charterer, requirements, stage), linked master documents (IDs, titles, cert numbers, issuers, crew info), and statutory certs.
  with what file: src/utils/rbacHelpers.ts consumed by VesselTable.tsx.
*/
export function matchesVesselSearch(
  vessel: VesselInformation,
  searchTerm: string,
  assuranceSets: AssuranceSet[] = [],
  documents: MasterDocument[] = []
): boolean {
  const term = searchTerm.trim().toLowerCase();
  if (!term) return true;

  // 1. Vessel Core Attributes
  if (
    vessel.name?.toLowerCase().includes(term) ||
    vessel.imoNumber?.includes(term) ||
    vessel.mmsiNumber?.includes(term) ||
    vessel.officialRegNumber?.toLowerCase().includes(term) ||
    vessel.callSign?.toLowerCase().includes(term) ||
    vessel.registeredOwner?.toLowerCase().includes(term) ||
    vessel.ismCompany?.toLowerCase().includes(term) ||
    vessel.technicalManager?.toLowerCase().includes(term) ||
    vessel.docNumber?.toLowerCase().includes(term) ||
    vessel.vesselType?.toLowerCase().includes(term) ||
    vessel.vesselSubtype?.toLowerCase().includes(term) ||
    vessel.classificationSociety?.toLowerCase().includes(term) ||
    vessel.classNotation?.toLowerCase().includes(term) ||
    vessel.flagState?.toLowerCase().includes(term) ||
    vessel.portOfRegistry?.toLowerCase().includes(term) ||
    vessel.intendedUse?.toLowerCase().includes(term) ||
    vessel.shipyardBuilder?.toLowerCase().includes(term) ||
    vessel.status?.toLowerCase().includes(term)
  ) {
    return true;
  }

  // 2. Direct Statutory Certificates on Vessel Record
  if (
    vessel.statutoryCertificates?.some(
      (c) =>
        c.id?.toLowerCase().includes(term) ||
        c.name?.toLowerCase().includes(term) ||
        c.certificateNumber?.toLowerCase().includes(term) ||
        c.issuingBody?.toLowerCase().includes(term) ||
        c.status?.toLowerCase().includes(term)
    )
  ) {
    return true;
  }

  // 3. Linked Assurance Sets & Requirements
  const linkedSets = assuranceSets.filter(
    (s) =>
      s.vesselId === vessel.id ||
      (vessel.name && s.vesselName?.toLowerCase() === vessel.name.toLowerCase()) ||
      (vessel.imoNumber && s.imoNumber === vessel.imoNumber)
  );

  const matchesAssuranceSets = linkedSets.some((s) => {
    if (
      s.id?.toLowerCase().includes(term) ||
      s.title?.toLowerCase().includes(term) ||
      s.charterer?.toLowerCase().includes(term) ||
      s.stage?.toLowerCase().includes(term) ||
      s.initiatorOrg?.toLowerCase().includes(term) ||
      s.initiatorRole?.toLowerCase().includes(term) ||
      s.assignedSubmitter?.toLowerCase().includes(term) ||
      s.assignedVerifier?.toLowerCase().includes(term) ||
      s.assignedInspector?.toLowerCase().includes(term) ||
      s.assignedApprover?.toLowerCase().includes(term) ||
      s.approverNotes?.toLowerCase().includes(term)
    ) {
      return true;
    }

    if (
      s.requirements?.some(
        (r) =>
          r.title?.toLowerCase().includes(term) ||
          r.category?.toLowerCase().includes(term) ||
          r.documentId?.toLowerCase().includes(term) ||
          r.linkedDocumentId?.toLowerCase().includes(term) ||
          r.verifierStatus?.toLowerCase().includes(term) ||
          r.notes?.toLowerCase().includes(term)
      )
    ) {
      return true;
    }

    return false;
  });

  if (matchesAssuranceSets) return true;

  // 4. Linked Master Documents (Vessel / Crew / Statutory / Uploaded)
  const linkedDocs = documents.filter(
    (d) =>
      d.vesselId === vessel.id ||
      (vessel.imoNumber && d.vesselAttributes?.imoNumber === vessel.imoNumber) ||
      (vessel.name && d.vesselAttributes?.vesselName?.toLowerCase() === vessel.name.toLowerCase()) ||
      (vessel.name && d.crewAttributes?.assignedVessel?.toLowerCase() === vessel.name.toLowerCase()) ||
      linkedSets.some((s) =>
        s.requirements?.some((r) => r.documentId === d.id || r.linkedDocumentId === d.id)
      )
  );

  const matchesDocuments = linkedDocs.some((d) => {
    if (
      d.id?.toLowerCase().includes(term) ||
      d.title?.toLowerCase().includes(term) ||
      d.certificateNo?.toLowerCase().includes(term) ||
      d.issuingAuthority?.toLowerCase().includes(term) ||
      d.entityType?.toLowerCase().includes(term) ||
      d.complianceState?.toLowerCase().includes(term) ||
      d.verificationStatus?.toLowerCase().includes(term) ||
      d.verificationNotes?.toLowerCase().includes(term)
    ) {
      return true;
    }

    if (
      d.vesselAttributes &&
      (d.vesselAttributes.certificateNumber?.toLowerCase().includes(term) ||
        d.vesselAttributes.issuingBody?.toLowerCase().includes(term) ||
        d.vesselAttributes.certType?.toLowerCase().includes(term) ||
        d.vesselAttributes.flagState?.toLowerCase().includes(term) ||
        d.vesselAttributes.title?.toLowerCase().includes(term))
    ) {
      return true;
    }

    if (
      d.crewAttributes &&
      (d.crewAttributes.crewName?.toLowerCase().includes(term) ||
        d.crewAttributes.rank?.toLowerCase().includes(term) ||
        d.crewAttributes.passportId?.toLowerCase().includes(term) ||
        d.crewAttributes.certType?.toLowerCase().includes(term) ||
        d.crewAttributes.issuingCenter?.toLowerCase().includes(term) ||
        d.crewAttributes.nationality?.toLowerCase().includes(term))
    ) {
      return true;
    }

    return false;
  });

  if (matchesDocuments) return true;

  return false;
}

/**
  what: resolves the user who created an assurance set; inputs are the set and the user registry.
  how: uses createdByName when stored, otherwise matches the creating role (createdByPersona or initiatorRole) to a user in the initiating organization; name is undefined when no user matches.
  with what file: src/utils/rbacHelpers.ts used by AssuranceTable.tsx and AssuranceDetailView.tsx.
*/
export function getAssuranceSetCreator(
  set: Pick<AssuranceSet, 'createdByName' | 'createdByPersona' | 'initiatorRole' | 'initiatorOrg'>,
  users: Pick<UserProfile, 'name' | 'roles' | 'organization'>[],
): { name?: string; organization: string } {
  const organization = set.initiatorOrg || '';
  if (set.createdByName) return { name: set.createdByName, organization };

  const role: UserRolePersona | undefined =
    set.createdByPersona === 'Administrator' || set.createdByPersona === 'C Admin'
      ? set.createdByPersona
      : set.initiatorRole === 'C Admin · Client Created' || set.initiatorRole === 'Client Admin'
        ? 'C Admin'
        : set.initiatorRole === 'Vessel Provider Admin' || set.initiatorRole === 'Vessel Provider'
          ? 'Administrator'
          : undefined;

  const creator = role
    ? users.find(
        (u) =>
          u.roles.includes(role) &&
          Boolean(u.organization) &&
          Boolean(organization) &&
          orgFieldMatches(u.organization as string, organization),
      )
    : undefined;

  return { name: creator?.name, organization };
}

/**
  what: label for the created-by column; inputs are the set, the user registry and the active persona.
  how: shows the creator name when the set was created inside the viewer organization and the creator is known, otherwise the initiating organization.
  with what file: src/utils/rbacHelpers.ts used by AssuranceTable.tsx.
*/
export function getAssuranceSetCreatedByLabel(
  set: Pick<AssuranceSet, 'createdByName' | 'createdByPersona' | 'initiatorRole' | 'initiatorOrg'>,
  users: Pick<UserProfile, 'name' | 'roles' | 'organization'>[],
  persona: UserRolePersona,
): string {
  const creator = getAssuranceSetCreator(set, users);
  const viewerOrg = users.find((u) => u.roles.includes(persona))?.organization;
  const isWithinOrganization = Boolean(
    viewerOrg && creator.organization && orgFieldMatches(viewerOrg, creator.organization),
  );
  return isWithinOrganization && creator.name ? creator.name : creator.organization;
}

/**
  what: true when an assurance set is owned or was initiated by the given organization; inputs are the set and the organization name.
  how: matches the organization against initiatorOrg and clientOrg, using charterer as the owner when clientOrg is not recorded.
  with what file: src/utils/rbacHelpers.ts used by AssuranceTable.tsx for the organization tab.
*/
export function isAssuranceSetOwnedOrInitiatedByOrganization(
  set: Pick<AssuranceSet, 'initiatorOrg' | 'clientOrg' | 'charterer'>,
  organization: string | undefined,
): boolean {
  if (!organization || !organization.trim()) return false;
  const ownerOrg = set.clientOrg || set.charterer;
  return [set.initiatorOrg, ownerOrg].some(
    (field) => Boolean(field) && orgFieldMatches(organization, field as string),
  );
}

/**
  what: vessels a vessel admin organization has chartered; inputs are the fleet, all assurance sets and the organization name.
  how: keeps vessels the organization does not own that have a vessel assurance set whose client (clientOrg, or charterer when no client is recorded) is that organization.
  with what file: src/utils/rbacHelpers.ts used by FleetRegistryView.tsx and VesselTable.tsx for the chartered tab.
*/
export function filterVesselAdminChartered(
  vessels: VesselInformation[],
  assuranceSets: AssuranceSet[],
  organization: string | undefined,
): VesselInformation[] {
  if (!organization || !organization.trim()) return [];
  return vessels.filter(
    (vessel) =>
      !isVesselOwnedByAdmin(vessel) &&
      assuranceSets.some((set) => {
        const client = set.clientOrg || set.charterer;
        return (
          set.vesselId === vessel.id &&
          (!set.assuranceType || set.assuranceType === 'Vessel') &&
          Boolean(client) &&
          orgFieldMatches(organization, client as string)
        );
      }),
  );
}
