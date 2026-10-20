/* 
  file summary: predefined subtype document definitions, descriptions, public templates, and organization templates for assurance sets.
  responsibilities: provides maritime-accurate standard requirements for Vessel, Crew, Activity, and Equipment subtypes with complete operational descriptions.
  role in system: consumed by CreateAssuranceSetView.tsx during assurance set initiation; a set covers one asset, or one or more crew members on a crew set (ADR 0004, amended by ADR 0023).
*/

import { AssuranceSet, AssuranceSubtype, AssuranceRequirementCategory, ThreePillarsCategory } from '../types/assurance';

/* every scope the data model knows, in display order */
const ALL_ASSURANCE_SCOPES: AssuranceSubtype[] = ['Vessel', 'Crew', 'Activity', 'Equipment'];

/* scopes switched off for now: not offered, not shown as tabs, and their demo sets are not seeded; empty this list to bring them back */
export const DISABLED_ASSURANCE_SCOPES: AssuranceSubtype[] = ['Activity'];

/* scopes a set can be created or filtered with, in the order they are offered and shown as wizard tabs */
export const ASSURANCE_SCOPE_OPTIONS: AssuranceSubtype[] = ALL_ASSURANCE_SCOPES.filter(
  (scope) => !DISABLED_ASSURANCE_SCOPES.includes(scope),
);

/* returns the offered scopes among the given ones, without repeats, in the order of ASSURANCE_SCOPE_OPTIONS */
export function orderAssuranceScopes(scopes: readonly AssuranceSubtype[]): AssuranceSubtype[] {
  return ASSURANCE_SCOPE_OPTIONS.filter((scope) => scopes.includes(scope));
}

/* the one scope a set is filed under (its assuranceType): the first offered scope among the given ones; Vessel when none is given */
export function getPrimaryAssuranceScope(scopes: readonly AssuranceSubtype[]): AssuranceSubtype {
  return orderAssuranceScopes(scopes)[0] || 'Vessel';
}

/* the scope of a saved set as a one-entry list, including a scope no longer offered: its assuranceType, or its first subtype for a set saved without one; a set covers exactly one asset (ADR 0004) */
export function getAssuranceSetScopes(set: Pick<AssuranceSet, 'assuranceType' | 'subtypes'>): AssuranceSubtype[] {
  if (set.assuranceType) return [set.assuranceType];
  const subtypes = set.subtypes || [];
  return [ALL_ASSURANCE_SCOPES.find((scope) => subtypes.includes(scope)) || 'Vessel'];
}

export interface AssuranceSetAsset {
  type: AssuranceSubtype;
  id: string;
  name: string;
}

/* the one asset a set covers, from its assuranceType: the vessel, the crew member or the equipment item; on a crew or equipment set the vessel fields name the host vessel only */
export function getAssuranceSetAsset(
  set: Pick<
    AssuranceSet,
    'assuranceType' | 'subtypes' | 'vesselId' | 'vesselName' | 'crewId' | 'crewName' | 'equipmentId' | 'equipmentName'
  >,
): AssuranceSetAsset {
  const type = getAssuranceSetScopes(set)[0];
  if (type === 'Crew' && set.crewId) {
    return { type, id: set.crewId, name: set.crewName || set.crewId };
  }
  if (type === 'Equipment' && set.equipmentId) {
    return { type, id: set.equipmentId, name: set.equipmentName || set.equipmentId };
  }
  return { type, id: set.vesselId, name: set.vesselName || set.vesselId };
}

/* every crew member id a set covers: crewIds when saved, else its single crewId; empty for a set with no crew (ADR 0023) */
export function getAssuranceSetCrewIds(set: Pick<AssuranceSet, 'crewId' | 'crewIds'>): string[] {
  if (set.crewIds && set.crewIds.length > 0) return set.crewIds;
  return set.crewId ? [set.crewId] : [];
}

/* every crew member name a set covers, in the order of getAssuranceSetCrewIds */
export function getAssuranceSetCrewNames(set: Pick<AssuranceSet, 'crewId' | 'crewIds' | 'crewName' | 'crewNames'>): string[] {
  return getAssuranceSetCrewIds(set).map((id, i) => set.crewNames?.[i] || (i === 0 ? set.crewName : undefined) || id);
}

/* every asset a set covers: one vessel or equipment item, or one or more crew members on a crew set (ADR 0023) */
export function getAssuranceSetAssets(
  set: Pick<
    AssuranceSet,
    | 'assuranceType'
    | 'subtypes'
    | 'vesselId'
    | 'vesselName'
    | 'crewId'
    | 'crewName'
    | 'crewIds'
    | 'crewNames'
    | 'equipmentId'
    | 'equipmentName'
  >,
): AssuranceSetAsset[] {
  const first = getAssuranceSetAsset(set);
  if (first.type !== 'Crew') return [first];
  const ids = getAssuranceSetCrewIds(set);
  if (ids.length === 0) return [first];
  const names = getAssuranceSetCrewNames(set);
  return ids.map((id, i) => ({ type: 'Crew' as AssuranceSubtype, id, name: names[i] }));
}

/**
  what: a set reduced to the asset it covers (one or more crew members on a crew set, ADR 0023); input is a set as a caller built it.
  how: keeps the scope the set is filed under as its only subtype, clears the crew and equipment links of other scopes, and drops requirements that belong to another scope; the vessel stays as the covered vessel or the host vessel.
  with what file: src/utils/assuranceTemplates.ts used by useMapStore.ts when a set is added or updated.
*/
export function toSingleAssetSet<T extends AssuranceSet>(set: T): T {
  const scope = getAssuranceSetScopes(set)[0];
  return {
    ...set,
    assuranceType: scope,
    subtypes: [scope],
    crewId: scope === 'Crew' ? (set.crewIds?.[0] ?? set.crewId) : undefined,
    crewName: scope === 'Crew' ? (set.crewNames?.[0] ?? set.crewName) : undefined,
    crewIds: scope === 'Crew' && set.crewIds && set.crewIds.length > 0 ? set.crewIds : undefined,
    crewNames: scope === 'Crew' && set.crewIds && set.crewIds.length > 0 ? set.crewNames : undefined,
    equipmentId: scope === 'Equipment' ? set.equipmentId : undefined,
    equipmentName: scope === 'Equipment' ? set.equipmentName : undefined,
    activityId: scope === 'Activity' ? set.activityId : undefined,
    activityName: scope === 'Activity' ? set.activityName : undefined,
    requirements: (set.requirements || []).filter((r) => !r.subtype || r.subtype === scope),
  };
}

/* true when a set is filed under a scope that is switched off */
export function isAssuranceSetScopeDisabled(set: Pick<AssuranceSet, 'assuranceType'>): boolean {
  return Boolean(set.assuranceType && DISABLED_ASSURANCE_SCOPES.includes(set.assuranceType));
}

export interface AssuranceWizardStep {
  id: string;
  label: string;
  subtype?: AssuranceSubtype;
}

/* wizard tabs: Scope, then the tab of the one chosen scope titled with the scope type, then Review */
export function buildAssuranceWizardSteps(scopes: readonly AssuranceSubtype[]): AssuranceWizardStep[] {
  return [
    { id: 'step-scope', label: 'Scope' },
    ...orderAssuranceScopes(scopes).slice(0, 1).map((scope) => ({
      id: `step-${scope.toLowerCase()}`,
      label: scope,
      subtype: scope,
    })),
    { id: 'step-review', label: 'Review' },
  ];
}

export function getThreePillarsCategory(subtype?: AssuranceSubtype | string, category?: string): ThreePillarsCategory {
  if (
    subtype === 'Crew' ||
    (category && [
      'Crew Credential',
      'Certificate of Competency (CoC)',
      'Medical Fitness Certificate',
      'Offshore Safety Induction (BOSIET)',
      'Specialized Training Endorsement',
      'Crew Custom Requirement',
    ].includes(category))
  ) {
    return 'People';
  }
  if (
    subtype === 'Vessel' ||
    subtype === 'Equipment' ||
    (category && [
      'Statutory Certificate',
      'Class Notation Certificate',
      'Flag Administration Registry',
      'Environmental Certificate',
      'Safety & Lifesaving Equipment',
      'Vessel Custom Requirement',
      'Equipment Register',
      'Lifting Appliance Register (ILO 152)',
      'DP FMEA Proving Trial',
      'Pull & Load Test Certificate',
      'Helideck Safety Certificate',
      'Equipment Custom Requirement',
    ].includes(category))
  ) {
    return 'Plant';
  }
  return 'Process';
}

export const THREE_PILLARS_CONFIG: Record<
  ThreePillarsCategory,
  {
    title: string;
    description: string;
    subtypes: AssuranceSubtype[];
    iconName: string;
  }
> = {
  Plant: {
    title: 'Plant (Physical Assets)',
    description: 'Physical vessel hulls, barges, and mission-critical deck equipment with flat checklists of statutory and specialized requirements.',
    subtypes: ['Vessel', 'Equipment'],
    iconName: 'Ship',
  },
  People: {
    title: 'People (Key Seafarers & Crew)',
    description: 'Seafarer qualifications, STCW Certificates of Competency, BOSIET inductions, and medical fitness credentials.',
    subtypes: ['Crew'],
    iconName: 'Users',
  },
  Process: {
    title: 'Process (Operational & HSE Plans)',
    description: 'Project-wide HSE management, Field Method Statements (MOP), HAZID/HAZOP risk mitigations, SIMOPS protocols, and insurance.',
    subtypes: ['Activity'],
    iconName: 'Activity',
  },
};

export interface StandardSubtypeDocument {
  id: string;
  subtype: AssuranceSubtype;
  title: string;
  category: AssuranceRequirementCategory;
  description: string;
  defaultEnabled: boolean;
  isMandatory: boolean;
}

export interface TemplateCustomRequirement {
  title: string;
  description: string;
  pillar: ThreePillarsCategory;
}

export interface SubtypeTemplate {
  id: string;
  subtype: AssuranceSubtype | 'All';
  name: string;
  source: 'public' | 'organization';
  organizationName?: string;
  description: string;
  recommendedDocIds: string[];
  customRequirements?: TemplateCustomRequirement[];
}

/** People and Process omit the vessel subtype so the category sets the pillar. Plant stays on the vessel. */
export function customRequirementFields(task: TemplateCustomRequirement): {
  category: AssuranceRequirementCategory;
  requirementSubtype: AssuranceSubtype | null;
} {
  if (task.pillar === 'People') {
    return { category: 'Crew Credential', requirementSubtype: null };
  }
  if (task.pillar === 'Plant') {
    return { category: 'Vessel Custom Requirement', requirementSubtype: 'Vessel' };
  }
  return { category: 'Operational Plan', requirementSubtype: null };
}

export const SUBTYPE_CATEGORIES: Record<AssuranceSubtype, AssuranceRequirementCategory[]> = {
  Vessel: [
    'Statutory Certificate',
    'Class Notation Certificate',
    'Flag Administration Registry',
    'Environmental Certificate',
    'Safety & Lifesaving Equipment',
    'Vessel Custom Requirement',
  ],
  Crew: [
    'Crew Credential',
    'Certificate of Competency (CoC)',
    'Medical Fitness Certificate',
    'Offshore Safety Induction (BOSIET)',
    'Specialized Training Endorsement',
    'Crew Custom Requirement',
  ],
  Activity: [
    'Operational Plan',
    'Method Statement (MOP)',
    'Risk Assessment (HAZID/HAZOP)',
    'Mooring & Towage Analysis',
    'Emergency Contingency Protocol',
    'SIMOPS Agreement',
    'Activity Custom Requirement',
  ],
  Equipment: [
    'Equipment Register',
    'Lifting Appliance Register (ILO 152)',
    'DP FMEA Proving Trial',
    'Pull & Load Test Certificate',
    'Helideck Safety Certificate',
    'Equipment Custom Requirement',
  ],
};

export const SUBTYPE_STANDARD_DOCS: Record<AssuranceSubtype, StandardSubtypeDocument[]> = {
  Vessel: [
    {
      id: 'vessel-class-cert',
      subtype: 'Vessel',
      title: 'Certificate of Class',
      category: 'Statutory Certificate',
      description: 'Classification society certificate issued by an IACS recognized organization confirming structural hull integrity, main propulsion, and auxiliary machinery compliance with class notations.',
      defaultEnabled: true,
      isMandatory: true,
    },
    {
      id: 'vessel-solas-safety',
      subtype: 'Vessel',
      title: 'Safety Construction & Equipment (SOLAS)',
      category: 'Statutory Certificate',
      description: 'Mandatory SOLAS certification confirming compliance of lifesaving appliances, fire prevention, detection and extinction systems, and hull structural safety arrangements.',
      defaultEnabled: true,
      isMandatory: true,
    },
    {
      id: 'vessel-flag-registry',
      subtype: 'Vessel',
      title: 'Flag State Certificate of Registry',
      category: 'Statutory Certificate',
      description: 'Official government flag administration certificate verifying legal nationality, ownership registration, port of registry, and maritime trading entitlement.',
      defaultEnabled: true,
      isMandatory: true,
    },
    {
      id: 'vessel-safe-manning',
      subtype: 'Vessel',
      title: 'Minimum Safe Manning Document',
      category: 'Statutory Certificate',
      description: 'Flag administration statutory determination establishing the minimum number and grades of certified deck and engineering seafarers required on board.',
      defaultEnabled: true,
      isMandatory: true,
    },
    {
      id: 'vessel-iopp-cert',
      subtype: 'Vessel',
      title: 'International Oil Pollution Prevention (IOPP)',
      category: 'Environmental',
      description: 'MARPOL Annex I statutory certificate verifying oily water separation, bilge holding capacity, 15 ppm oily discharge monitoring, and oil record book compliance.',
      defaultEnabled: true,
      isMandatory: true,
    },
    {
      id: 'vessel-bwm-cert',
      subtype: 'Vessel',
      title: 'Ballast Water Management Certificate (BWM)',
      category: 'Environmental',
      description: 'IMO BWM Convention certification confirming treatment system commissioning, UV or electrolysis calibration, and aquatic bio-security management.',
      defaultEnabled: false,
      isMandatory: false,
    },
  ],
  Crew: [
    {
      id: 'crew-stcw-coc',
      subtype: 'Crew',
      title: 'STCW Master & Officer Certificates of Competency (CoC)',
      category: 'Crew Credential',
      description: 'Flag state authenticated STCW II/2 (Master) and III/2 (Chief Engineer) certificates verifying competency for offshore command and propulsion management.',
      defaultEnabled: true,
      isMandatory: true,
    },
    {
      id: 'crew-eng1-medical',
      subtype: 'Crew',
      title: 'ENG1 / Seafarer Medical Fitness Certificates',
      category: 'Crew Credential',
      description: 'MLC 2006 compliant medical certificates issued by authorized marine medical practitioners verifying physical fitness, eyesight, and hearing standards.',
      defaultEnabled: true,
      isMandatory: true,
    },
    {
      id: 'crew-bosiet-training',
      subtype: 'Crew',
      title: 'Offshore Safety Induction & Emergency Training (BOSIET)',
      category: 'Crew Credential',
      description: 'OPITO-accredited safety induction with Helicopter Underwater Escape Training (HUET), Compressed Air Emergency Breathing Systems (CA-EBS), and fire response.',
      defaultEnabled: true,
      isMandatory: true,
    },
    {
      id: 'crew-dp-logbook',
      subtype: 'Crew',
      title: 'Dynamic Positioning (DP) Operator Logs & Certificates',
      category: 'Crew Credential',
      description: 'Nautical Institute or DNV accredited DP operator certificates with verified offshore dynamic positioning logbook hours and watchkeeping credentials.',
      defaultEnabled: true,
      isMandatory: true,
    },
    {
      id: 'crew-dg-endorsement',
      subtype: 'Crew',
      title: 'Dangerous Goods & Bulk Chemical Handling Endorsement',
      category: 'Crew Credential',
      description: 'Certified qualifications for hazardous materials handling, deck cargo securing, chemical containment, and bulk fluid transfer operations.',
      defaultEnabled: false,
      isMandatory: false,
    },
  ],
  Activity: [
    {
      id: 'act-mop-method',
      subtype: 'Activity',
      title: 'Marine Operations Plan & Method Statement (MOP)',
      category: 'Operational Plan',
      description: 'Comprehensive engineering method statement detailing transit routing, dynamic positioning station keeping, subsea operations, and weather criteria.',
      defaultEnabled: true,
      isMandatory: true,
    },
    {
      id: 'act-hazid-hazop',
      subtype: 'Activity',
      title: 'Activity Risk Assessment & HAZID/HAZOP Register',
      category: 'Operational Plan',
      description: 'Detailed hazard identification register, task risk assessments, mitigation barriers, and stop-work authority protocols for scheduled activity.',
      defaultEnabled: true,
      isMandatory: true,
    },
    {
      id: 'act-mooring-analysis',
      subtype: 'Activity',
      title: 'Dynamic Mooring & Towage Feasibility Analysis',
      category: 'Operational Plan',
      description: 'Naval architectural tension calculations, catenary analysis, and bollard pull verification for anchoring, positioning, or tandem towing.',
      defaultEnabled: true,
      isMandatory: true,
    },
    {
      id: 'act-emergency-response',
      subtype: 'Activity',
      title: 'Field Emergency Response & Oil Spill Contingency Plan',
      category: 'Operational Plan',
      description: 'Tier 1/2 response readiness protocols, offshore medical evacuation routes, communication channels, and oil spill containment readiness.',
      defaultEnabled: true,
      isMandatory: true,
    },
    {
      id: 'act-simops-matrix',
      subtype: 'Activity',
      title: 'Simultaneous Operations (SIMOPS) Protocol',
      category: 'Operational Plan',
      description: 'Coordinated operational matrix governing concurrent multi-vessel and platform activities, safety zones, and shared radio frequencies.',
      defaultEnabled: false,
      isMandatory: false,
    },
  ],
  Equipment: [
    {
      id: 'eq-lifting-register',
      subtype: 'Equipment',
      title: 'Lifting Appliances & Crane Annual Inspection Register',
      category: 'Equipment Register',
      description: 'ILO 152 certified statutory register for offshore pedestal cranes, deck davits, anchor winches, and running wire ropes with proof load tests.',
      defaultEnabled: true,
      isMandatory: true,
    },
    {
      id: 'eq-dp-fmea-trials',
      subtype: 'Equipment',
      title: 'Dynamic Positioning FMEA Proving Trial Report',
      category: 'Equipment Register',
      description: 'Annual Failure Mode and Effects Analysis (FMEA) proving trials verifying DP system electrical, hydraulic, and thruster redundancy.',
      defaultEnabled: true,
      isMandatory: true,
    },
    {
      id: 'eq-rov-winch-test',
      subtype: 'Equipment',
      title: 'Subsea ROV & Deck Winch Pull Test Certificates',
      category: 'Equipment Register',
      description: 'Proof load test documentation, winch brake holding certificates, and umbilical high-voltage insulation tests for subsea handling systems.',
      defaultEnabled: true,
      isMandatory: true,
    },
    {
      id: 'eq-helideck-cert',
      subtype: 'Equipment',
      title: 'Helideck Friction & Safety Inspection Certificate',
      category: 'Equipment Register',
      description: 'CAP 437 / ICAO compliance inspection report covering landing surface micro-texture friction, perimeter netting, lighting, and foam monitors.',
      defaultEnabled: false,
      isMandatory: false,
    },
    {
      id: 'eq-rigging-slings',
      subtype: 'Equipment',
      title: 'Offshore Rigging, Slings & Pad-Eye Load Test Register',
      category: 'Equipment Register',
      description: 'Non-destructive testing (NDT), magnetic particle inspection, and proof load test records for cargo baskets, spreader bars, and pad-eyes.',
      defaultEnabled: true,
      isMandatory: true,
    },
  ],
};

const SS04_BUNKER_TASKS: TemplateCustomRequirement[] = [
  { pillar: 'People', title: 'Bunker barge crew competency certificates', description: 'Valid certificates that match the barge crew list. Flag State or training center.' },
  { pillar: 'People', title: 'Supplier person-in-charge qualification', description: 'Current qualification naming the person in charge of the bunker transfer. Oil Company.' },
  { pillar: 'Plant', title: 'Bunker barge statutory and class certificates', description: 'Valid flag and class certificates for the bunker barge.' },
  { pillar: 'Plant', title: 'Mass flow meter calibration certificate', description: 'Accredited calibration, within its calibration date.' },
  { pillar: 'Plant', title: 'Bunker hose pressure test certificates', description: 'Pressure test within its test date.' },
  { pillar: 'Process', title: 'Supplier bunker license or port approval', description: 'Valid for the delivery port. Port Authority.' },
  { pillar: 'Process', title: 'Fuel certificate of analysis (ISO 8217)', description: 'Oil Company laboratory result that meets the ordered grade.' },
  { pillar: 'Process', title: 'Independent fuel test result', description: 'Coastal Fuel Testing result that confirms the supplier analysis.' },
  { pillar: 'Process', title: 'Bunker Delivery Note and MARPOL sample record', description: 'Meets MARPOL Annex VI. Sulphur is within the limit.' },
  { pillar: 'Process', title: 'Bunkering safety checklist and spill response plan', description: 'Current and signed.' },
  { pillar: 'Process', title: 'Supplier liability insurance', description: 'Valid cover that meets the client minimum.' },
];

const SS05_CONTROL_TASKS: TemplateCustomRequirement[] = [
  { pillar: 'People', title: 'Vendor engineer cyber security certifications', description: 'Current IEC 62443 or GICSP certificates held by the named engineers.' },
  { pillar: 'People', title: 'Background screening confirmation', description: 'Completed within the client period for engineers with system access.' },
  { pillar: 'People', title: 'Site induction records', description: 'Completed before site access.' },
  { pillar: 'Plant', title: 'System architecture and asset inventory', description: 'Hardware and software versions are complete and supported.' },
  { pillar: 'Plant', title: 'SIL certificates', description: 'Valid safety integrity certificates that meet the required rating.' },
  { pillar: 'Plant', title: 'FAT and SAT reports', description: 'Factory and site acceptance tests passed, with punch items closed.' },
  { pillar: 'Plant', title: 'Vulnerability scan and penetration test report', description: 'No unresolved critical or high findings.' },
  { pillar: 'Process', title: 'Cyber security management plan', description: 'Aligned with IEC 62443-2-4 and covers remote access.' },
  { pillar: 'Process', title: 'Patch management and backup procedures', description: 'Current, and the restore has been tested.' },
  { pillar: 'Process', title: 'Incident response plan', description: 'Current, with contact points named.' },
  { pillar: 'Process', title: 'ISO/IEC 27001 certificate', description: 'Valid, and the scope covers the service.' },
  { pillar: 'Process', title: 'Management of change procedure', description: 'Current and aligned with the Oil Company management of change.' },
  { pillar: 'Process', title: 'Professional indemnity and cyber insurance', description: 'Valid cover that meets the client minimum.' },
];

export const SUBTYPE_TEMPLATES: SubtypeTemplate[] = [
  {
    id: 'tmpl-pub-ss04-bunkering',
    subtype: 'Vessel',
    name: 'SS-04 Bunkering / Fuel Supply',
    source: 'public',
    description: 'BRD 8.6 evidence for a bunker delivery. Standard vessel certificates stay off. The 11 tasks cover People, Plant and Process.',
    recommendedDocIds: [],
    customRequirements: SS04_BUNKER_TASKS,
  },
  {
    id: 'tmpl-pub-ss05-control-systems',
    subtype: 'Vessel',
    name: 'SS-05 IT / Control Systems',
    source: 'public',
    description: 'BRD 8.7 evidence for field control and safety systems. Standard vessel certificates stay off. The 13 tasks cover People, Plant and Process.',
    recommendedDocIds: [],
    customRequirements: SS05_CONTROL_TASKS,
  },
  // Public Subtype Templates
  {
    id: 'tmpl-pub-imca-vessel',
    subtype: 'Vessel',
    name: 'IMCA Marine Assurance Standard (OSV/DP2 Baseline)',
    source: 'public',
    description: 'International Marine Contractors Association baseline requirements for offshore support vessels and dynamic positioning systems.',
    recommendedDocIds: ['vessel-class-cert', 'vessel-solas-safety', 'vessel-flag-registry', 'vessel-safe-manning', 'vessel-iopp-cert', 'vessel-bwm-cert'],
  },
  {
    id: 'tmpl-pub-ocimf-vessel',
    subtype: 'Vessel',
    name: 'OCIMF OVID Vessel Inspection Baseline',
    source: 'public',
    description: 'Oil Companies International Marine Forum Offshore Vessel Inspection Database statutory compliance pack.',
    recommendedDocIds: ['vessel-class-cert', 'vessel-solas-safety', 'vessel-flag-registry', 'vessel-safe-manning', 'vessel-iopp-cert'],
  },
  {
    id: 'tmpl-pub-opito-crew',
    subtype: 'Crew',
    name: 'OPITO & STCW Offshore Manning Standard',
    source: 'public',
    description: 'Global offshore industry standard for certified deck/engine officer competency, emergency survival (BOSIET), and medical fitness.',
    recommendedDocIds: ['crew-stcw-coc', 'crew-eng1-medical', 'crew-bosiet-training', 'crew-dp-logbook'],
  },
  {
    id: 'tmpl-pub-imca-activity',
    subtype: 'Activity',
    name: 'IMCA M 220 Marine Operations Standard',
    source: 'public',
    description: 'Industry-standard guidelines for marine operations execution, risk assessment, station keeping, and contingency mitigation.',
    recommendedDocIds: ['act-mop-method', 'act-hazid-hazop', 'act-mooring-analysis', 'act-emergency-response'],
  },
  {
    id: 'tmpl-pub-dnv-equipment',
    subtype: 'Equipment',
    name: 'DNV-ST-N001 Marine Warranty Equipment Standard',
    source: 'public',
    description: 'Marine warranty surveyor baseline for critical lifting appliances, DP redundancy FMEA, and subsea deployment winch systems.',
    recommendedDocIds: ['eq-lifting-register', 'eq-dp-fmea-trials', 'eq-rov-winch-test', 'eq-rigging-slings'],
  },

  // Public Unified Project Scope Templates (Covering All 4 Sub-Assets: Vessel, Crew, Activity, Equipment)
  {
    id: 'tmpl-pub-imca-unified-project',
    subtype: 'All',
    name: 'IMCA M 149 / M 220 Unified Marine Project Standard',
    source: 'public',
    description: 'Unified industry standard for turnkey offshore marine campaigns covering DP2/DP3 vessel certification, STCW/OPITO crew qualifications, marine operations risk mitigation, and certified subsea lifting equipment.',
    recommendedDocIds: [
      'vessel-class-cert', 'vessel-solas-safety', 'vessel-flag-registry', 'vessel-safe-manning', 'vessel-iopp-cert', 'vessel-bwm-cert',
      'crew-stcw-coc', 'crew-eng1-medical', 'crew-bosiet-training', 'crew-dp-logbook', 'crew-dg-endorsement',
      'act-mop-method', 'act-hazid-hazop', 'act-mooring-analysis', 'act-emergency-response', 'act-simops-matrix',
      'eq-lifting-register', 'eq-dp-fmea-trials', 'eq-rov-winch-test', 'eq-helideck-cert', 'eq-rigging-slings',
    ],
  },
  {
    id: 'tmpl-pub-ogp-offshore-project',
    subtype: 'All',
    name: 'IOGP Report 390 Offshore Marine Project Baseline',
    source: 'public',
    description: 'International Oil & Gas Producers recommended practice for offshore exploration, field logistics, marine operations safety cases, and critical asset assurance governance.',
    recommendedDocIds: [
      'vessel-class-cert', 'vessel-solas-safety', 'vessel-flag-registry', 'vessel-safe-manning', 'vessel-iopp-cert',
      'crew-stcw-coc', 'crew-eng1-medical', 'crew-bosiet-training', 'crew-dp-logbook',
      'act-mop-method', 'act-hazid-hazop', 'act-emergency-response',
      'eq-lifting-register', 'eq-dp-fmea-trials', 'eq-rov-winch-test', 'eq-rigging-slings',
    ],
  },
  {
    id: 'tmpl-pub-nopsema-project-assurance',
    subtype: 'All',
    name: 'NOPSEMA Safety Case & Marine Project Baseline',
    source: 'public',
    description: 'Australian National Offshore Petroleum Safety and Environmental Management Authority statutory compliance baseline for offshore facilities, chartered vessels, seafarer credentials, and well activity registers.',
    recommendedDocIds: [
      'vessel-class-cert', 'vessel-solas-safety', 'vessel-flag-registry', 'vessel-safe-manning', 'vessel-iopp-cert', 'vessel-bwm-cert',
      'crew-stcw-coc', 'crew-eng1-medical', 'crew-bosiet-training',
      'act-mop-method', 'act-hazid-hazop', 'act-emergency-response', 'act-simops-matrix',
      'eq-lifting-register', 'eq-dp-fmea-trials', 'eq-helideck-cert', 'eq-rigging-slings',
    ],
  },

  // Organization Single-Subtype Templates
  {
    id: 'tmpl-org-northwind-fleet',
    subtype: 'Vessel',
    name: 'Northwind Marine Corporate Fleet Standard',
    source: 'organization',
    organizationName: 'Northwind Marine Pty Ltd',
    description: 'Standard internal fleet statutory vetting and environmental management requirements.',
    recommendedDocIds: ['vessel-class-cert', 'vessel-solas-safety', 'vessel-flag-registry', 'vessel-safe-manning', 'vessel-iopp-cert'],
  },

  // Organization Full Project Scope Templates (Covering All 4 Sub-Assets: Vessel, Crew, Activity, Equipment)
  {
    id: 'tmpl-org-chevron-gorgon',
    subtype: 'All',
    name: 'Chevron Gorgon Project Assurance Package',
    source: 'organization',
    organizationName: 'Chevron Australia Pty Ltd',
    description: 'Comprehensive offshore project vetting criteria covering DP2 vessel integrity, STCW crew certification, SURF subsea operations, and deck crane lifting gear.',
    recommendedDocIds: [
      'vessel-class-cert', 'vessel-solas-safety', 'vessel-flag-registry', 'vessel-safe-manning', 'vessel-iopp-cert', 'vessel-bwm-cert',
      'crew-stcw-coc', 'crew-eng1-medical', 'crew-bosiet-training', 'crew-dp-logbook', 'crew-dg-endorsement',
      'act-mop-method', 'act-hazid-hazop', 'act-mooring-analysis', 'act-emergency-response', 'act-simops-matrix',
      'eq-lifting-register', 'eq-dp-fmea-trials', 'eq-rov-winch-test', 'eq-helideck-cert', 'eq-rigging-slings',
    ],
  },
  {
    id: 'tmpl-org-woodside-scarborough',
    subtype: 'All',
    name: 'Woodside Scarborough Project Standard',
    source: 'organization',
    organizationName: 'Woodside Energy Ltd',
    description: 'Offshore project assurance package covering full DP2/DP3 subsea intervention, heavy lift, drilling support, and crew safety compliance.',
    recommendedDocIds: [
      'vessel-class-cert', 'vessel-solas-safety', 'vessel-flag-registry', 'vessel-safe-manning', 'vessel-iopp-cert',
      'crew-stcw-coc', 'crew-eng1-medical', 'crew-bosiet-training', 'crew-dp-logbook',
      'act-mop-method', 'act-hazid-hazop', 'act-emergency-response',
      'eq-lifting-register', 'eq-dp-fmea-trials', 'eq-rov-winch-test', 'eq-rigging-slings',
    ],
  },
  {
    id: 'tmpl-org-inpex-ichthys',
    subtype: 'All',
    name: 'Inpex Ichthys Field Operations Standard',
    source: 'organization',
    organizationName: 'Inpex Operations Australia',
    description: 'Operational compliance standard for Darwin offshore field supply, topside heavy lift, and marine support campaigns.',
    recommendedDocIds: [
      'vessel-class-cert', 'vessel-solas-safety', 'vessel-flag-registry', 'vessel-safe-manning', 'vessel-iopp-cert',
      'crew-stcw-coc', 'crew-eng1-medical', 'crew-bosiet-training',
      'act-mop-method', 'act-hazid-hazop', 'act-emergency-response',
      'eq-lifting-register', 'eq-dp-fmea-trials', 'eq-rigging-slings',
    ],
  },
  {
    id: 'tmpl-org-santos-barossa',
    subtype: 'All',
    name: 'Santos Barossa Subsea Installation Project Standard',
    source: 'organization',
    organizationName: 'Santos Ltd',
    description: 'SURF gas pipeline installation, offshore towing, winch proof test certificates, and marine construction assurance package.',
    recommendedDocIds: [
      'vessel-class-cert', 'vessel-solas-safety', 'vessel-flag-registry', 'vessel-safe-manning', 'vessel-iopp-cert', 'vessel-bwm-cert',
      'crew-stcw-coc', 'crew-eng1-medical', 'crew-bosiet-training', 'crew-dp-logbook',
      'act-mop-method', 'act-hazid-hazop', 'act-mooring-analysis', 'act-emergency-response',
      'eq-lifting-register', 'eq-dp-fmea-trials', 'eq-rov-winch-test', 'eq-rigging-slings',
    ],
  },
  {
    id: 'tmpl-org-shell-prelude',
    subtype: 'All',
    name: 'Shell Prelude FLNG Marine Project Assurance Pack',
    source: 'organization',
    organizationName: 'Shell Australia Pty Ltd',
    description: 'FLNG exclusion boundary escort, emergency standby, crew survival certification, and offshore lifting appliance verification package.',
    recommendedDocIds: [
      'vessel-class-cert', 'vessel-solas-safety', 'vessel-flag-registry', 'vessel-safe-manning', 'vessel-iopp-cert',
      'crew-stcw-coc', 'crew-eng1-medical', 'crew-bosiet-training', 'crew-dp-logbook',
      'act-mop-method', 'act-hazid-hazop', 'act-emergency-response', 'act-simops-matrix',
      'eq-lifting-register', 'eq-dp-fmea-trials', 'eq-helideck-cert', 'eq-rigging-slings',
    ],
  },
  {
    id: 'tmpl-org-northwind-integrated-project',
    subtype: 'All',
    name: 'Northwind Integrated Turnkey Marine Campaign Standard',
    source: 'organization',
    organizationName: 'Northwind Marine Pty Ltd',
    description: 'Internal turnkey standard for multi-asset project charters across AHTS/OSV vessels, certified seafarers, and certified deck equipment.',
    recommendedDocIds: [
      'vessel-class-cert', 'vessel-solas-safety', 'vessel-flag-registry', 'vessel-safe-manning', 'vessel-iopp-cert', 'vessel-bwm-cert',
      'crew-stcw-coc', 'crew-eng1-medical', 'crew-bosiet-training', 'crew-dp-logbook', 'crew-dg-endorsement',
      'act-mop-method', 'act-hazid-hazop', 'act-mooring-analysis', 'act-emergency-response', 'act-simops-matrix',
      'eq-lifting-register', 'eq-dp-fmea-trials', 'eq-rov-winch-test', 'eq-helideck-cert', 'eq-rigging-slings',
    ],
  },
];

export const EXISTING_PROJECTS: import('../types/assurance').AssuranceProject[] = [
  {
    id: 'MAP-PROJ-2026-OFFSHORE-001',
    name: 'Gorgon Stage 2 & Jansz-Io Compression',
    clientOperator: 'Chevron Australia Pty Ltd',
    location: 'Barrow Island / Greater Gorgon Area, WA',
    description: 'Offshore subsea compression and pipeline tie-in campaign supporting Gorgon LNG operations.',
    primaryVesselId: 'VESSEL-001',
    primaryCrewId: 'CREW-101',
    primaryEquipmentId: 'EQ-001',
    primaryActivityId: 'MAP-ACT-2026-SURF-001',
    defaultTemplateId: 'tmpl-org-chevron-gorgon',
  },
  {
    id: 'MAP-PROJ-2026-DRILL-002',
    name: 'Scarborough Gas Field Development',
    clientOperator: 'Woodside Energy Ltd',
    location: 'Carnarvon Basin, Offshore WA',
    description: 'Deepwater drilling support and floating production unit (FPU) installation campaign.',
    primaryVesselId: 'VESSEL-002',
    primaryCrewId: 'CREW-102',
    primaryEquipmentId: 'EQ-002',
    primaryActivityId: 'MAP-ACT-2026-DRILL-002',
    defaultTemplateId: 'tmpl-org-woodside-scarborough',
  },
  {
    id: 'MAP-PROJ-2026-LOGISTICS-003',
    name: 'Ichthys LNG Offshore Supply Support',
    clientOperator: 'INPEX Operations Australia',
    location: 'Browse Basin, Timor Sea, WA',
    description: 'Long-term PSV / AHTS supply and subsea maintenance logistics for Ichthys Explorer and Venturer.',
    primaryVesselId: 'VESSEL-003',
    primaryCrewId: 'CREW-103',
    primaryEquipmentId: 'EQ-003',
    primaryActivityId: 'MAP-ACT-2026-LIFT-003',
    defaultTemplateId: 'tmpl-org-inpex-ichthys',
  },
  {
    id: 'MAP-PROJ-2026-SUBSEA-004',
    name: 'Barossa Subsea Installation Campaign',
    clientOperator: 'Santos Ltd',
    location: 'Bonaparte Basin, Northern Territory',
    description: 'Gas pipeline fabrication, subsea SURF infrastructure installation, and umbilical lay operations.',
    primaryVesselId: 'VESSEL-004',
    primaryCrewId: 'CREW-104',
    primaryEquipmentId: 'EQ-004',
    primaryActivityId: 'MAP-ACT-2026-PIPE-005',
    defaultTemplateId: 'tmpl-org-santos-barossa',
  },
  {
    id: 'MAP-PROJ-2026-OFFSHORE-005',
    name: 'Wheatstone Platform Maintenance & Operations',
    clientOperator: 'Chevron Australia Pty Ltd',
    location: 'Ashburton North / Offshore Onslow, WA',
    description: 'Offshore platform maintenance, diving support, and supply shuttle vessel operations.',
    primaryVesselId: 'VESSEL-005',
    primaryCrewId: 'CREW-105',
    primaryEquipmentId: 'EQ-005',
    primaryActivityId: 'MAP-ACT-2026-HULL-007',
    defaultTemplateId: 'tmpl-pub-imca-unified-project',
  },
  {
    id: 'MAP-PROJ-2026-MARINE-006',
    name: 'Prelude FLNG Facility Marine Services',
    clientOperator: 'Shell Australia Pty Ltd',
    location: 'Browse Basin, Western Australia',
    description: 'Offshore LNG carrier escort, bunker assistance, emergency standby, and marine supply.',
    primaryVesselId: 'VESSEL-006',
    primaryCrewId: 'CREW-101',
    primaryEquipmentId: 'EQ-006',
    primaryActivityId: 'MAP-ACT-2026-TOW-004',
    defaultTemplateId: 'tmpl-org-shell-prelude',
  },
];

export const EXISTING_ACTIVITIES: import('../types/assurance').AssuranceActivity[] = [
  {
    id: 'MAP-ACT-2026-SURF-001',
    name: 'Deepwater SURF & Subsea Tie-In Installation',
    category: 'Subsea Installation',
    location: 'Greater Gorgon Field, WA',
    description: 'Subsea umbilical, riser, and flowline (SURF) installation and acoustic metrology tie-ins.',
  },
  {
    id: 'MAP-ACT-2026-DRILL-002',
    name: 'Offshore Exploration Well Spud & Drilling Operations',
    category: 'Drilling & Intervention',
    location: 'Scarborough Basin, Offshore WA',
    description: 'Deepwater exploratory drilling, BOP deployment, and casing cementing operations.',
  },
  {
    id: 'MAP-ACT-2026-LIFT-003',
    name: 'Topside Module Heavy Lift & Float-over Integration',
    category: 'Heavy Lift & Transport',
    location: 'Timor Sea / Darwin Sector',
    description: 'Dynamic positioning dual-vessel tandem lift and module floatover installation.',
  },
  {
    id: 'MAP-ACT-2026-TOW-004',
    name: 'Semi-Submersible Rig Ocean Towage & Pre-Mooring',
    category: 'Towage & Positioning',
    location: 'Browse Basin, WA',
    description: 'Multi-tug ocean transit, 12-point anchor pre-lay, and catenary tension proofing.',
  },
  {
    id: 'MAP-ACT-2026-PIPE-005',
    name: 'Subsea Gas Export Pipeline S-Lay & Trenching Campaign',
    category: 'Pipelay Operations',
    location: 'Bonaparte Basin, NT',
    description: 'Continuous 36-inch trunkline S-lay installation with post-lay plough trenching.',
  },
  {
    id: 'MAP-ACT-2026-DECOM-006',
    name: 'Offshore Well P&A and Subsea Infrastructure Decommissioning',
    category: 'Decommissioning',
    location: 'Bass Strait / Gippsland Basin, VIC',
    description: 'Plug and abandonment operations, subsea manifold recovery, and seabed clearance.',
  },
  {
    id: 'MAP-ACT-2026-HULL-007',
    name: 'Hull Fouling Removal & Antifouling Surface Prep',
    category: 'Vessel Maintenance Service',
    location: 'Port / Alongside Vessel',
    description: 'Underwater hull cleaning, rust removal, and barnacle clearing for dry-dock or alongside prep.',
  },
];


