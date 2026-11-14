/**
 * Canonical registry of organizations in MAPv2 mock data.
 * Built from the audit of core records (projects, assurance sets, vessels, equipment, crew, users).
 *
 * Rules:
 * - Keep an organization only if a project, assurance set, vessel, equipment or crew record uses it.
 * - Merge near-duplicates into one canonical name.
 * - Drop unused ones.
 * - Operators, owners, vendors, and third-party firms get 'Administrator'.
 * - Clients and charterers get 'C Admin' (the "Administrator as client" per ADR 0002).
 */

export const CANONICAL_ORGANIZATIONS = [
  'ABS',
  'AMSA',
  'Austral Classification Society',
  'Australian Register of Ships',
  'Beach Energy Ltd',
  'Bureau Veritas Inspectorate',
  'Chevron Australia Pty Ltd',
  'Coastal Fuel Testing',
  'DNV',
  'Fremantle Port Authority',
  'Gard P&I Club',
  'Global Maritime Audits',
  'Gulf Security Services Pty Ltd',
  'Harbourline Terminals',
  'Inpex Operations Australia',
  'Kestrel Control Systems',
  "Lloyd's Register",
  'Marine Assurance Authority',
  'Meridian Marine Services Pty Ltd',
  'Meridian Shipyards',
  'NOPSEMA',
  'Northwind Marine Pty Ltd',
  'Oil Company',
  'RINA',
  'Santos Ltd',
  'Sentinel Cyber Assurance',
  'Shell Australia Pty Ltd',
  'Southern Basin Energy Pty Ltd',
  'Woodside Energy Ltd',
  'XY Marine Assurance',
] as const;

export type CanonicalOrganization = (typeof CANONICAL_ORGANIZATIONS)[number];

const CANONICAL_SET = new Set<string>(CANONICAL_ORGANIZATIONS);

/** Clients and charterers whose administrator persona key is 'C Admin' (ADR 0002). */
export const CLIENT_ORGANIZATIONS = new Set<string>([
  'Beach Energy Ltd',
  'Chevron Australia Pty Ltd',
  'Inpex Operations Australia',
  'Oil Company',
  'Santos Ltd',
  'Shell Australia Pty Ltd',
  'Southern Basin Energy Pty Ltd',
  'Woodside Energy Ltd',
]);

/**
 * Returns the administrator persona role appropriate for the given organization type:
 * 'C Admin' for clients/charterers; 'Administrator' for all others.
 */
export function getAdminRoleForOrganization(organization: string): 'Administrator' | 'C Admin' {
  return CLIENT_ORGANIZATIONS.has(organization.trim()) ? 'C Admin' : 'Administrator';
}

/**
 * Checks whether an organization name is one of the kept canonical organizations.
 */
export function isCanonicalOrganization(organization: string): boolean {
  return CANONICAL_SET.has(organization.trim());
}

/**
 * Normalization map for near-duplicates and legacy aliases.
 */
const ORG_ALIASES: Record<string, CanonicalOrganization> = {
  'southern basin energy': 'Southern Basin Energy Pty Ltd',
  'southern basin energy pty ltd': 'Southern Basin Energy Pty Ltd',
  'chevron australia': 'Chevron Australia Pty Ltd',
  'chevron australia vetting': 'Chevron Australia Pty Ltd',
  'chevron australia pty ltd': 'Chevron Australia Pty Ltd',
  'meridian marine services': 'Meridian Marine Services Pty Ltd',
  'meridian marine services pty ltd': 'Meridian Marine Services Pty Ltd',
  'gulf security services': 'Gulf Security Services Pty Ltd',
  'gulf security services pty ltd': 'Gulf Security Services Pty Ltd',
  'shell australia': 'Shell Australia Pty Ltd',
  'shell australia pty ltd': 'Shell Australia Pty Ltd',
  'woodside energy': 'Woodside Energy Ltd',
  'woodside energy ltd': 'Woodside Energy Ltd',
  'northwind marine': 'Northwind Marine Pty Ltd',
  'northwind marine pty ltd': 'Northwind Marine Pty Ltd',
  'bureau veritas': 'Bureau Veritas Inspectorate',
  'dnv technical assurance': 'DNV',
  'dnv (iacs member)': 'DNV',
};

/**
 * Normalizes an organization string to its canonical name if known.
 */
export function canonicalizeOrganization(name: string): string | undefined {
  const trimmed = name.trim();
  if (CANONICAL_SET.has(trimmed)) return trimmed;
  const lower = trimmed.toLowerCase();
  return ORG_ALIASES[lower];
}

