/*
  file summary: pure functions for reading and validating assurance set parties and party roles.
  responsibilities: extracts requesting, responding, third parties, internal deployment status, project client check, and validates parties invariants.
  role in system: single source of truth for assurance set party derivation under ADR 0042.
*/

import type { UserProfile } from '../types/user';
import type { Project } from '../types/project';
import { sameOrganization } from './organizationMatch';

export type AssuranceSetPartyRole = 'Requesting party' | 'Responding party' | 'Third party';

export interface AssuranceSetParty {
  organization: string;
  role: AssuranceSetPartyRole;
}

export interface SetPartiesInput {
  parties?: Array<{
    organization: string;
    role?: string;
    partyRole?: string;
  }> | null;
  /* legacy fallbacks during migration */
  requestingParty?: string;
  respondingParty?: string;
  clientOrg?: string;
  charterer?: string;
  initiatorOrg?: string;
  serviceProviderOrg?: string;
  organizations?: string[];
}

/**
 * Returns the organization holding the 'Requesting party' role on the assurance set.
 * Reads from the parties array where role is 'Requesting party'.
 */
export function getRequestingParty(set?: SetPartiesInput | null): string | undefined {
  if (!set) return undefined;
  if (Array.isArray(set.parties)) {
    const found = set.parties.find(
      (p) => p.role === 'Requesting party' || p.partyRole === 'Requesting party',
    );
    if (found?.organization?.trim()) return found.organization.trim();
  }
  const legacy =
    set.requestingParty?.trim() ||
    set.clientOrg?.trim() ||
    set.charterer?.trim() ||
    set.initiatorOrg?.trim();
  if (legacy) return legacy;
  return undefined;
}

/**
 * Returns the organization holding the 'Responding party' role on the assurance set.
 * Reads from the parties array where role is 'Responding party'.
 */
export function getRespondingParty(set?: SetPartiesInput | null): string | undefined {
  if (!set) return undefined;
  if (Array.isArray(set.parties)) {
    const found = set.parties.find(
      (p) => p.role === 'Responding party' || p.partyRole === 'Responding party',
    );
    if (found?.organization?.trim()) return found.organization.trim();
  }
  const legacy = set.respondingParty?.trim() || set.serviceProviderOrg?.trim();
  if (legacy) return legacy;
  return undefined;
}

/**
 * Returns all organizations participating as 'Third party' on the assurance set.
 * Third parties represent independent reviewer, verifier, or inspector organizations.
 */
export function getThirdParties(set?: SetPartiesInput | null): string[] {
  if (!set) return [];
  if (Array.isArray(set.parties)) {
    const result: string[] = [];
    for (const p of set.parties) {
      const org = p.organization?.trim();
      if (!org) continue;
      const role = p.role || p.partyRole;
      if (role === 'Third party' || (role !== 'Requesting party' && role !== 'Responding party')) {
        if (!result.some((existing) => sameOrganization(existing, org))) {
          result.push(org);
        }
      }
    }
    return result;
  }
  return [];
}

/**
 * Returns an ordered unique list of all organizations participating in the assurance set.
 * Preserves the order declared in the parties array.
 */
export function getSetOrganizations(set?: SetPartiesInput | null): string[] {
  if (!set) return [];
  if (Array.isArray(set.parties) && set.parties.length > 0) {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const p of set.parties) {
      const org = p.organization?.trim();
      if (!org) continue;
      const key = org.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        list.push(org);
      }
    }
    return list;
  }
  if (Array.isArray(set.organizations) && set.organizations.length > 0) {
    return Array.from(new Set(set.organizations.map((o) => o.trim()).filter(Boolean)));
  }
  const fallback = [
    getRequestingParty(set),
    getRespondingParty(set),
    ...(getThirdParties(set)),
  ].filter((o): o is string => Boolean(o));
  return Array.from(new Set(fallback));
}

/**
 * Returns true if the assurance set is an internal deployment where Requesting party equals Responding party.
 * Internal deployments represent owner/operator self-assurance campaigns without an external counterparty.
 */
export function isInternalDeployment(set?: SetPartiesInput | null): boolean {
  const req = getRequestingParty(set);
  const res = getRespondingParty(set);
  return Boolean(req && res && sameOrganization(req, res));
}

/**
 * Returns true if the user belongs to the project's owning client organization.
 * Client is a project-level role and determines authority to manage project roster assets.
 */
export function isProjectClient(
  user: Pick<UserProfile, 'organization'> | string | undefined | null,
  project: Pick<Project, 'ownerOrganization' | 'clientOperator' | 'requestingOrganization' | 'charterer'> | undefined | null,
): boolean {
  if (!user || !project) return false;
  const userOrg = typeof user === 'string' ? user.trim() : user.organization?.trim();
  if (!userOrg) return false;
  const clientOrg = (
    project.ownerOrganization ||
    project.charterer ||
    project.clientOperator ||
    project.requestingOrganization ||
    ''
  ).trim();
  if (!clientOrg) return false;
  return sameOrganization(userOrg, clientOrg);
}

/**
 * Returns a dictionary mapping organization name to its party role on the set.
 * Reads directly from the parties array.
 */
export function getPartyRolesMap(set?: SetPartiesInput | null): Record<string, string> {
  const map: Record<string, string> = {};
  if (!set || !Array.isArray(set.parties)) return map;
  for (const p of set.parties) {
    if (p.organization) {
      const role = p.role || p.partyRole;
      if (role) {
        map[p.organization] = role;
      }
    }
  }
  return map;
}

export interface PartiesValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates that an assurance set party list adheres to MAPv2 party segregation rules.
 * Requires exactly one Requesting party, exactly one Responding party, and all other parties as Third party.
 */
export function validateAssuranceSetParties(parties: unknown): PartiesValidationResult {
  const errors: string[] = [];
  if (!Array.isArray(parties) || parties.length === 0) {
    return { valid: false, errors: ['Parties must be a non-empty array.'] };
  }

  let requestingCount = 0;
  let respondingCount = 0;

  parties.forEach((item, index) => {
    if (!item || typeof item !== 'object') {
      errors.push(`Party at index ${index} must be an object.`);
      return;
    }
    const party = item as { organization?: unknown; role?: unknown; partyRole?: unknown };
    const org = typeof party.organization === 'string' ? party.organization.trim() : '';
    if (!org) {
      errors.push(`Party at index ${index} must have a non-empty organization name.`);
    }

    const role = (party.role || party.partyRole) as string | undefined;
    if (role === 'Requesting party') {
      requestingCount += 1;
    } else if (role === 'Responding party') {
      respondingCount += 1;
    } else if (role === 'Third party') {
      // valid third party
    } else {
      errors.push(
        `Party "${org || index}" has invalid role "${String(role)}". Must be 'Requesting party', 'Responding party', or 'Third party'.`,
      );
    }
  });

  if (requestingCount !== 1) {
    errors.push(`Assurance set must have exactly one Requesting party (found ${requestingCount}).`);
  }
  if (respondingCount !== 1) {
    errors.push(`Assurance set must have exactly one Responding party (found ${respondingCount}).`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
