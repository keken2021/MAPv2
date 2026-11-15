/*
  file summary: pure functions and constants for enabled/disabled assurance scopes.
  responsibilities: provides DISABLED_ASSURANCE_SCOPES, ASSURANCE_SCOPE_OPTIONS, orderAssuranceScopes, and isAssuranceSetScopeDisabled.
  role in system: lightweight leaf module with zero runtime dependencies to avoid circular module cycles.
*/

import type { AssuranceSet, AssuranceSubtype } from '../types/assurance';

/* every scope the data model knows, in display order */
export const ALL_ASSURANCE_SCOPES: AssuranceSubtype[] = ['Vessel', 'Crew', 'Equipment'];

/* scopes switched off for now: not offered, not shown as tabs, and their demo sets are not seeded; empty this list to bring them back */
export const DISABLED_ASSURANCE_SCOPES: AssuranceSubtype[] = [];

/* scopes a set can be created or filtered with, in the order they are offered and shown as wizard tabs */
export const ASSURANCE_SCOPE_OPTIONS: AssuranceSubtype[] = ALL_ASSURANCE_SCOPES.filter(
  (scope) => !DISABLED_ASSURANCE_SCOPES.includes(scope),
);

/* returns the offered scopes among the given ones, without repeats, in the order of ASSURANCE_SCOPE_OPTIONS */
export function orderAssuranceScopes(scopes: readonly AssuranceSubtype[]): AssuranceSubtype[] {
  return ASSURANCE_SCOPE_OPTIONS.filter((scope) => scopes.includes(scope));
}

/* true when a set is filed under a scope that is switched off */
export function isAssuranceSetScopeDisabled(set: Pick<AssuranceSet, 'assuranceType'>): boolean {
  return Boolean(set.assuranceType && DISABLED_ASSURANCE_SCOPES.includes(set.assuranceType));
}
