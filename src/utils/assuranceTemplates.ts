/* 
  file summary: predefined subtype document definitions, descriptions, public templates, and organization templates for assurance sets.
  responsibilities: provides maritime-accurate standard requirements for Vessel, Crew, Activity, and Equipment subtypes with complete operational descriptions.
  role in system: consumed by CreateAssuranceSetView.tsx during assurance set initiation; a set covers one asset, or one or more crew members on a crew set (ADR 0004, amended by ADR 0023).
*/

import { AssuranceSet, AssuranceRequirement, AssuranceSubtype, AssuranceRequirementCategory, ThreePillarsCategory, AssuranceObject, AssuranceObjectType, ObjectAssignment, TaskSection } from '../types/assurance';
import { CrewVesselAssignment } from '../types/crew';
import { VesselPersonLink } from '../types/vessel';

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

/* the primary scope of a saved set: Vessel, Crew, Activity, or Equipment */
export function getAssuranceSetScope(set: Pick<AssuranceSet, 'assuranceType' | 'subtypes'>): AssuranceSubtype {
  return getAssuranceSetScopes(set)[0];
}

/**
 * Derives the specific asset or operational category (e.g. Barge, Captain, Tanker, Lifeboat).
 * Uses set.scopeType when explicitly assigned, falling back to asset records or title heuristics.
 */
export function getAssuranceSetScopeType(
  set: Pick<AssuranceSet, 'scopeType' | 'assuranceType' | 'subtypes' | 'crewId' | 'equipmentId' | 'vesselId' | 'title'>,
  vessels?: { id: string; vesselType?: string; subtype?: string }[],
  crew?: { id: string; rank?: string }[],
  equipment?: { id: string; type?: string }[],
): string {
  if (set.scopeType) return set.scopeType;

  const scope = getAssuranceSetScope(set);

  if (scope === 'Crew') {
    if (set.crewId && crew) {
      const member = crew.find((c) => c.id === set.crewId);
      if (member?.rank) return member.rank;
    }
    const t = set.title.toLowerCase();
    if (t.includes('capt') || t.includes('master')) return 'Captain';
    if (t.includes('chief engineer')) return 'Chief Engineer';
    if (t.includes('officer')) return 'Officer';
    if (t.includes('deck') || t.includes('seafarer') || t.includes('bosun')) return 'Able Seafarer';
    return 'Crew';
  }

  if (scope === 'Equipment') {
    if (set.equipmentId && equipment) {
      const eq = equipment.find((e) => e.id === set.equipmentId);
      if (eq?.type) return eq.type;
    }
    const t = set.title.toLowerCase();
    if (t.includes('crane')) return 'Crane';
    if (t.includes('lifeboat')) return 'Lifeboat';
    if (t.includes('rov')) return 'ROV System';
    return 'Equipment';
  }

  if (scope === 'Vessel') {
    if (set.vesselId && vessels) {
      const vessel = vessels.find((v) => v.id === set.vesselId);
      if (vessel?.vesselType) return vessel.vesselType;
      if (vessel?.subtype) return vessel.subtype;
    }
    const t = set.title.toLowerCase();
    if (t.includes('tanker')) return 'Tanker';
    if (t.includes('barge') || t.includes('subsea')) return 'Barge';
    if (t.includes('ahts')) return 'AHTS';
    if (t.includes('tug')) return 'Tug';
    return 'Vessel';
  }

  return scope;
}

/** converts a vessel to an assurance object (ADR 0029) */
export function vesselToAssuranceObject(vessel: {
  id: string;
  name: string;
  imoNumber?: string;
  ownerOrg?: string;
  operator?: string;
  clientOrganization?: string;
}): AssuranceObject {
  return {
    id: vessel.id,
    type: 'vessel',
    name: vessel.name,
    ownerOrganization: vessel.ownerOrg || vessel.operator || 'Vessel Provider',
    identifier: vessel.imoNumber ? 'IMO: ' + vessel.imoNumber : undefined,
  };
}

/** a crew vessel rotation kept as an assignment on the person object */
export function vesselAssignmentToObject(assignment: CrewVesselAssignment): ObjectAssignment {
  return {
    id: assignment.id,
    targetObjectId: assignment.vesselId,
    targetObjectType: 'vessel',
    targetName: assignment.vesselName,
    startDate: assignment.embarkDate,
    endDate: assignment.disembarkDate,
    isCurrent: assignment.isCurrent,
    role: assignment.rankHeld,
  };
}

/** vessel rotations plus any assignment to another object */
export function personObjectAssignments(member: {
  assignments?: CrewVesselAssignment[];
  objectAssignments?: ObjectAssignment[];
}): ObjectAssignment[] {
  const fromVessels = (member.assignments ?? []).map(vesselAssignmentToObject);
  const known = new Set(fromVessels.map((assignment) => assignment.id));
  const extra = (member.objectAssignments ?? []).filter((assignment) => !known.has(assignment.id));
  return [...fromVessels, ...extra];
}

export function currentObjectAssignment(assignments?: ObjectAssignment[]): ObjectAssignment | undefined {
  return assignments?.find((assignment) => assignment.isCurrent);
}

/** people assigned to a vessel, read from person objects */
export function personLinksForVessel(objects: AssuranceObject[], vesselId: string): VesselPersonLink[] {
  return objects.flatMap((object) => {
    if (object.type !== 'person') return [];
    return (object.assignments ?? [])
      .filter((assignment) => assignment.targetObjectType === 'vessel' && assignment.targetObjectId === vesselId)
      .map((assignment) => ({
        personObjectId: object.id,
        personName: object.name,
        startDate: assignment.startDate,
        endDate: assignment.endDate,
        isCurrent: assignment.isCurrent,
        role: assignment.role,
      }));
  });
}

/** converts a crew member to an assurance object (ADR 0029) */
export function crewToAssuranceObject(member: {
  id: string;
  fullName: string;
  rank?: string;
  organization?: string;
  manningAgency?: string;
  seamansBookNo?: string;
  passportNo?: string;
  assignments?: CrewVesselAssignment[];
  objectAssignments?: ObjectAssignment[];
}): AssuranceObject {
  return {
    id: member.id,
    type: 'person',
    name: member.fullName,
    ownerOrganization: member.organization || member.manningAgency || 'Crew Provider',
    identifier: member.seamansBookNo || member.passportNo || member.rank,
    description: member.rank,
    assignments: personObjectAssignments(member),
  };
}

/** converts an equipment asset to an assurance object (ADR 0029) */
export function equipmentToAssuranceObject(item: {
  id: string;
  name: string;
  category?: string;
  owningOrganization?: string;
  serialNumber?: string;
  equipmentIdentifier?: string;
}): AssuranceObject {
  return {
    id: item.id,
    type: 'equipment',
    name: item.name,
    ownerOrganization: item.owningOrganization || 'Equipment Provider',
    identifier: item.equipmentIdentifier || item.serialNumber,
    description: item.category,
  };
}

/** seeded operational procedures, methods, documents and organizations for multi-object sets (ADR 0029) */
export const SEEDED_OPERATIONAL_OBJECTS: AssuranceObject[] = [
  {
    id: 'OBJ-PROC-PORT-01',
    type: 'procedure',
    name: 'Port Entry & Berthing Procedure',
    ownerOrganization: 'Fremantle Port Authority',
    identifier: 'SOP-PORT-2026',
    description: 'Navigation, pilot boarding and tug escort operating procedure for port arrival',
  },
  {
    id: 'OBJ-METH-TOW-01',
    type: 'method',
    name: 'Mooring & Towage Method Statement (MOP)',
    ownerOrganization: 'Tidewater Marine',
    identifier: 'MOP-TOW-004',
    description: 'Detailed operational method for tandem mooring and harbour towage assistance',
  },
  {
    id: 'OBJ-DOC-CLR-01',
    type: 'document',
    name: 'Port Clearance & Customs Declaration',
    ownerOrganization: 'Australian Border Force',
    identifier: 'PCD-WA-8812',
    description: 'Statutory vessel border entry clearance and bio-security verification documentation',
  },
  {
    id: 'OBJ-ORG-PPA-01',
    type: 'organization',
    name: 'Pilbara Ports Authority',
    ownerOrganization: 'Pilbara Ports Authority',
    identifier: 'PPA-PORT-AUTH',
    description: 'Regional port authority and harbour master oversight organization',
  },
];

/** returns all assurance objects for a set, synthesizing from legacy fields if unpopulated (ADR 0029) */
export function getAssuranceSetObjects(
  set: Pick<
    AssuranceSet,
    | 'assuranceObjects'
    | 'assuranceType'
    | 'subtypes'
    | 'vesselId'
    | 'vesselName'
    | 'imoNumber'
    | 'crewId'
    | 'crewName'
    | 'crewIds'
    | 'crewNames'
    | 'equipmentId'
    | 'equipmentName'
    | 'serviceProviderOrg'
  >,
): AssuranceObject[] {
  if (set.assuranceObjects && set.assuranceObjects.length > 0) {
    return set.assuranceObjects;
  }
  const objects: AssuranceObject[] = [];
  if (set.vesselId) {
    objects.push({
      id: set.vesselId,
      type: 'vessel',
      name: set.vesselName || set.vesselId,
      ownerOrganization: set.serviceProviderOrg || 'Vessel Provider',
      identifier: set.imoNumber ? 'IMO: ' + set.imoNumber : undefined,
    });
  }
  const crewIds = set.crewIds && set.crewIds.length > 0 ? set.crewIds : set.crewId ? [set.crewId] : [];
  crewIds.forEach((id, idx) => {
    const name = set.crewNames?.[idx] || (idx === 0 ? set.crewName : undefined) || id;
    objects.push({
      id,
      type: 'person',
      name,
      ownerOrganization: set.serviceProviderOrg || 'Crew Provider',
    });
  });
  if (set.equipmentId) {
    objects.push({
      id: set.equipmentId,
      type: 'equipment',
      name: set.equipmentName || set.equipmentId,
      ownerOrganization: set.serviceProviderOrg || 'Equipment Provider',
    });
  }
  return objects;
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
/** normalizes set assets and assurance objects (ADR 0029: multi-object sets preserve all objects) */
export function toSingleAssetSet<T extends AssuranceSet>(set: T): T {
  // If the set specifies explicit assuranceObjects (ADR 0029 multi-object model), preserve all of them
  if (set.assuranceObjects && set.assuranceObjects.length > 0) {
    const hasCrew = set.assuranceObjects.some((o) => o.type === 'person');
    const hasEquipment = set.assuranceObjects.some((o) => o.type === 'equipment');
    return {
      ...set,
      assuranceObjects: set.assuranceObjects,
      crewId: hasCrew ? (set.crewIds?.[0] ?? set.crewId) : undefined,
      crewName: hasCrew ? (set.crewNames?.[0] ?? set.crewName) : undefined,
      crewIds: hasCrew ? set.crewIds : undefined,
      crewNames: hasCrew ? set.crewNames : undefined,
      equipmentId: hasEquipment ? set.equipmentId : undefined,
      equipmentName: hasEquipment ? set.equipmentName : undefined,
    };
  }
  // Legacy single-asset clamping (ADR 0004 compatibility when assuranceObjects is not set)
  const scope = getAssuranceSetScopes(set)[0];
  return {
    ...set,
    assuranceType: scope,
    subtypes: [scope],
    assuranceObjects: getAssuranceSetObjects({ ...set, assuranceType: scope, subtypes: [scope] }),
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
const CATEGORY_SECTIONS: { match: RegExp; name: string }[] = [
  { match: /class/i, name: 'Class' },
  { match: /safety|lifesaving|equipment/i, name: 'Safety equipment' },
  { match: /environment|iopp|marpol/i, name: 'Environmental' },
  { match: /crew|competency|medical/i, name: 'Crew certificates' },
  { match: /insurance/i, name: 'Insurance' },
  { match: /emergency|contingency/i, name: 'Emergency' },
  { match: /mooring|berth|towage/i, name: 'Berthing' },
  { match: /operational|method|risk|simops|activity|plan/i, name: 'Operations' },
  { match: /registry|statutory/i, name: 'Registry' },
];

/**
  what: returns the section name for a task category.
  how: matches the category against the section list and otherwise uses General.
  with what file: src/utils/assuranceTemplates.ts used by placeTasksInSections.
*/
export function sectionNameForCategory(category: string): string {
  return CATEGORY_SECTIONS.find((row) => row.match.test(category))?.name ?? 'General';
}

function sectionIdForName(name: string): string {
  return `sec-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

/**
  what: places each task in a section and gives it one predecessor inside that section.
  how: keeps a section and predecessor already stored on the task, and otherwise groups by category and points each later task at the previous one in the same section.
  with what file: src/utils/assuranceTemplates.ts used by the create wizard.
*/
export function placeTasksInSections(requirements: AssuranceRequirement[]): {
  requirements: AssuranceRequirement[];
  sections: TaskSection[];
} {
  const sectionOrder: string[] = [];
  const sectionNames = new Map<string, string>();
  const drafted = requirements.map((task) => {
    const name = task.sectionId
      ? (sectionNames.get(task.sectionId) ?? task.sectionId)
      : sectionNameForCategory(task.category);
    const sectionId = task.sectionId ?? sectionIdForName(name);
    if (!sectionNames.has(sectionId)) {
      sectionNames.set(sectionId, task.sectionId ? name : sectionNameForCategory(task.category));
      if (!task.sectionId) sectionNames.set(sectionId, name);
      sectionOrder.push(sectionId);
    }
    return { ...task, sectionId };
  });
  const previousInSection = new Map<string, string>();
  const placed = drafted.map((task) => {
    const sectionId = task.sectionId as string;
    const predecessorId = task.predecessorId ?? previousInSection.get(sectionId);
    previousInSection.set(sectionId, task.id);
    return predecessorId ? { ...task, predecessorId } : task;
  });
  const sections: TaskSection[] = sectionOrder.map((id, index) => ({
    id,
    name: sectionNames.get(id) ?? id,
    order: index + 1,
  }));
  return { requirements: placed, sections };
}

/** ten sections for the Inpex inspection set, three of them heavy */
export const INPEX_TASK_SECTIONS: TaskSection[] = [
  { id: 'sec-registry', name: 'Registry', order: 1 },
  { id: 'sec-class', name: 'Class', order: 2 },
  { id: 'sec-safety', name: 'Safety equipment', order: 3 },
  { id: 'sec-environmental', name: 'Environmental', order: 4 },
  { id: 'sec-crew', name: 'Crew certificates', order: 5 },
  { id: 'sec-medical', name: 'Medical', order: 6 },
  { id: 'sec-insurance', name: 'Insurance', order: 7 },
  { id: 'sec-operations', name: 'Operations', order: 8 },
  { id: 'sec-emergency', name: 'Emergency', order: 9 },
  { id: 'sec-berthing', name: 'Berthing', order: 10 },
];

/**
  what: returns the extra tasks for the ten-section Inpex inspection set.
  how: builds open tasks, three to a heavy section, and stores one predecessor on each task after the first in its section.
  with what file: src/utils/assuranceTemplates.ts used by mockData.ts.
*/
export function inpexSectionTasks(): AssuranceRequirement[] {
  const groups: { sectionId: string; category: AssuranceRequirementCategory; titles: string[] }[] = [
    { sectionId: 'sec-class', category: 'Class Notation Certificate', titles: ['Class status report', 'Class notation endorsement', 'Machinery class survey'] },
    { sectionId: 'sec-safety', category: 'Safety & Lifesaving Equipment', titles: ['Safety equipment certificate', 'Liferaft certificate', 'Fire appliance certificate'] },
    { sectionId: 'sec-environmental', category: 'Environmental Certificate', titles: ['IOPP certificate'] },
    { sectionId: 'sec-crew', category: 'Crew Credential', titles: ['Crew certificate list'] },
    { sectionId: 'sec-medical', category: 'Medical Fitness Certificate', titles: ['Medical fitness certificate'] },
    { sectionId: 'sec-insurance', category: 'Operational Plan', titles: ['P&I insurance cover'] },
    { sectionId: 'sec-operations', category: 'Operational Plan', titles: ['Field method statement', 'Risk assessment', 'SIMOPS agreement'] },
    { sectionId: 'sec-emergency', category: 'Emergency Contingency Protocol', titles: ['Emergency response plan'] },
    { sectionId: 'sec-berthing', category: 'Mooring & Towage Analysis', titles: ['Berthing procedure'] },
  ];
  const tasks: AssuranceRequirement[] = [];
  for (const group of groups) {
    group.titles.forEach((title, index) => {
      const id = `REQ-${group.sectionId}-${index + 1}`;
      tasks.push({
        id,
        category: group.category,
        title,
        sectionId: group.sectionId,
        predecessorId: index === 0 ? undefined : `REQ-${group.sectionId}-${index}`,
        isMandatory: true,
        isFulfilled: false,
        ocrConfidence: 0,
        verifierStatus: 'Pending',
      });
    });
  }
  const berthing = tasks.find((task) => task.id === 'REQ-sec-berthing-1');
  if (berthing) berthing.predecessorId = 'REQ-sec-emergency-1';
  return tasks;
}

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
      title: 'Cargo Ship Safety Certificate (SOLAS Combined)',
      category: 'Statutory Certificate',
      description: 'Single combined SOLAS certificate covering safety construction, safety equipment, and radio installations as an alternative to separate CSSC and CSSEC.',
      defaultEnabled: true,
      isMandatory: true,
    },
    {
      id: 'vessel-solas-cssc',
      subtype: 'Vessel',
      title: 'Cargo Ship Safety Construction Certificate (CSSC)',
      category: 'Statutory Certificate',
      description: 'SOLAS Reg I/12 certification confirming structural hull strength, watertight arrangements, machinery, and electrical installations.',
      defaultEnabled: true,
      isMandatory: true,
    },
    {
      id: 'vessel-solas-cssec',
      subtype: 'Vessel',
      title: 'Cargo Ship Safety Equipment Certificate (CSSEC)',
      category: 'Statutory Certificate',
      description: 'SOLAS Reg I/12 certification confirming lifesaving appliances, fire safety systems, navigation arrangements, and onboard safety equipment.',
      defaultEnabled: true,
      isMandatory: true,
    },
    {
      id: 'vessel-loadline-cert',
      subtype: 'Vessel',
      title: 'International Load Line Certificate (ILLC)',
      category: 'Statutory Certificate',
      description: 'International Convention on Load Lines 1966 statutory certificate establishing maximum permissible draft and seasonal freeboards.',
      defaultEnabled: true,
      isMandatory: true,
    },
    {
      id: 'vessel-tonnage-cert',
      subtype: 'Vessel',
      title: 'International Tonnage Certificate (ITC 1969)',
      category: 'Statutory Certificate',
      description: 'Statutory determination of vessel gross and net tonnage under the International Convention on Tonnage Measurement of Ships 1969.',
      defaultEnabled: true,
      isMandatory: true,
    },
    {
      id: 'vessel-issc-cert',
      subtype: 'Vessel',
      title: 'International Ship Security Certificate (ISSC)',
      category: 'Statutory Certificate',
      description: 'ISPS Code statutory certificate confirming verified onboard ship security system, security equipment, and security plan compliance.',
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
    {
      id: 'vessel-ism-doc',
      subtype: 'Vessel',
      title: 'ISM Document of Compliance (DOC)',
      category: 'Statutory Certificate',
      description: 'Issued to the operating company under the ISM Code, showing its safety management system is approved. Company-level evidence: covers the company\'s vessels of the ship types listed on it.',
      defaultEnabled: true,
      isMandatory: true,
    },
    {
      id: 'vessel-ism-smc',
      subtype: 'Vessel',
      title: 'Safety Management Certificate (SMC)',
      category: 'Statutory Certificate',
      description: 'Issued to the vessel under the ISM Code after the company holds its DOC. Five-year term with an intermediate verification; endorsement dates are the expiry events to watch.',
      defaultEnabled: true,
      isMandatory: true,
    },
    {
      id: 'vessel-pi-entry',
      subtype: 'Vessel',
      title: 'P&I Certificate of Entry',
      category: 'Insurance & Financial Security',
      description: 'Evidence the vessel is entered with a P&I club for third-party liabilities. Blue Cards and bunker certificates evidence the pollution cover behind State certificates.',
      defaultEnabled: true,
      isMandatory: true,
    },
    {
      id: 'vessel-clc-cert',
      subtype: 'Vessel',
      title: 'Civil Liability Convention Certificate (CLC 92)',
      category: 'Statutory Certificate',
      description: 'State-issued statutory certificate under the 1992 Civil Liability Convention for oil pollution damage, issued on the basis of insurer Blue Card.',
      defaultEnabled: false,
      isMandatory: false,
    },
    {
      id: 'vessel-bunkers-cert',
      subtype: 'Vessel',
      title: 'Bunkers Convention Certificate',
      category: 'Statutory Certificate',
      description: 'State-issued statutory certificate under the 2001 International Convention on Civil Liability for Bunker Oil Pollution Damage.',
      defaultEnabled: false,
      isMandatory: false,
    },
    {
      id: 'vessel-wrc-cert',
      subtype: 'Vessel',
      title: 'Wreck Removal Convention Certificate (WRC)',
      category: 'Statutory Certificate',
      description: 'State-issued statutory certificate under the 2007 Nairobi International Convention on the Removal of Wrecks.',
      defaultEnabled: false,
      isMandatory: false,
    },
    {
      id: 'vessel-mlc-cert',
      subtype: 'Vessel',
      title: 'Maritime Labour Certificate (MLC)',
      category: 'Statutory Certificate',
      description: 'Confirms compliance with the Maritime Labour Convention 2006 on seafarer working and living conditions, including financial security for repatriation.',
      defaultEnabled: true,
      isMandatory: true,
    },
    {
      id: 'vessel-questionnaire',
      subtype: 'Vessel',
      title: 'Vessel Questionnaire',
      category: 'Vessel Custom Requirement',
      description: 'Operator-declared vessel particulars for screening. A declaration, not verified evidence: the facts it states are checked against the certificates.',
      defaultEnabled: true,
      isMandatory: false,
    },
    {
      id: 'vessel-inspection-report',
      subtype: 'Vessel',
      title: 'Vessel Inspection Report',
      category: 'Inspection Report',
      description: 'A shared inspection report (OVID, eCMID) or the client\'s own. Record its source, date, validity and the inspector\'s accreditation.',
      defaultEnabled: true,
      isMandatory: true,
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
      title: 'Seafarer Medical Certificate (STCW I/9, MLC 1.2)',
      category: 'Crew Credential',
      description: 'MLC 2006 and STCW I/9 compliant medical certificates issued by authorized marine medical practitioners verifying physical fitness, eyesight, and hearing standards.',
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

const GENERIC_ASSURANCE_CUSTOM_TASKS: TemplateCustomRequirement[] = [
  { pillar: 'Plant', title: 'Cargo Ship Safety Radio Certificate (SOLAS)', description: 'GMDSS radio installation and emergency beacon compliance for [Vessel Type].' },
  { pillar: 'Plant', title: 'International Air Pollution Prevention Certificate (IAPP)', description: 'MARPOL Annex VI compliance for exhaust emissions and fuel oil quality for [Vessel Type].' },
  { pillar: 'Plant', title: 'International Ship Security Certificate (ISSC)', description: 'ISPS Code compliance and verified Ship Security Plan for [Vessel Type].' },
  { pillar: 'Plant', title: 'Lifeboat & Rescue Boat Release Mechanism Inspection Certificate', description: 'Annual and five-yearly thorough examination and dynamic brake test compliant with IMO MSC.402(96).' },
  { pillar: 'People', title: 'High Voltage Safety Endorsement', description: 'Certified electrical safety qualification for high-voltage marine installations for [Crew Type].' },
  { pillar: 'People', title: 'Able Seafarer Deck Certificate (STCW II/5)', description: 'Certified qualifications for navigational watchkeeping and deck safety operations for [Crew Type].' },
  { pillar: 'People', title: 'Key Personnel Appointments (DPA & CSO)', description: 'Formal appointment and 24/7 contact records for shore-based safety and security management.' },
  { pillar: 'Process', title: 'Project HSE Management Plan & Safety Statistics', description: 'Health, Safety, and Environment plan with trailing safety performance statistics (LTIF/TRCF).' },
  { pillar: 'Process', title: 'Management of Change (MOC) Procedure', description: 'Formal procedure for assessing, approving, and documenting technical and operational alterations.' },
  { pillar: 'Process', title: 'Port & Terminal Regulations Acknowledgment', description: 'Written acknowledgment of port limits, navigation channels, and local maritime safety directions.' },
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
    name: 'Offshore Support Vessel Baseline (illustrative)',
    source: 'public',
    description: 'Vessel evidence commonly asked for offshore support and DP vessels. Illustrative, not the issuer\'s list: confirm against the client\'s own requirements.',
    recommendedDocIds: ['vessel-class-cert', 'vessel-solas-safety', 'vessel-flag-registry', 'vessel-safe-manning', 'vessel-iopp-cert', 'vessel-bwm-cert', 'vessel-ism-doc', 'vessel-ism-smc', 'vessel-pi-entry', 'vessel-mlc-cert', 'vessel-questionnaire', 'vessel-inspection-report'],
  },
  {
    id: 'tmpl-pub-ocimf-vessel',
    subtype: 'Vessel',
    name: 'Vessel Inspection Baseline (illustrative)',
    source: 'public',
    description: 'An inspection report with the statutory certificates it is read against. Illustrative, not the issuer\'s list: confirm against the client\'s own requirements.',
    recommendedDocIds: ['vessel-class-cert', 'vessel-solas-safety', 'vessel-flag-registry', 'vessel-safe-manning', 'vessel-iopp-cert', 'vessel-ism-smc', 'vessel-inspection-report'],
  },
  {
    id: 'tmpl-pub-opito-crew',
    subtype: 'Crew',
    name: 'Offshore Crew Baseline (illustrative)',
    source: 'public',
    description: 'Deck and engine officer competency, emergency survival training and medical fitness. Illustrative, not the issuer\'s list: confirm against the client\'s own requirements.',
    recommendedDocIds: ['crew-stcw-coc', 'crew-eng1-medical', 'crew-bosiet-training', 'crew-dp-logbook'],
  },
  {
    id: 'tmpl-pub-imca-activity',
    subtype: 'Activity',
    name: 'Marine Operations Baseline (illustrative)',
    source: 'public',
    description: 'Method statement, risk assessment, station keeping and contingency plans. Illustrative, not the issuer\'s list: confirm against the client\'s own requirements.',
    recommendedDocIds: ['act-mop-method', 'act-hazid-hazop', 'act-mooring-analysis', 'act-emergency-response'],
  },
  {
    id: 'tmpl-pub-dnv-equipment',
    subtype: 'Equipment',
    name: 'Marine Warranty Equipment Baseline (illustrative)',
    source: 'public',
    description: 'Lifting appliances, DP redundancy FMEA and subsea deployment winch systems. Illustrative, not the issuer\'s list: confirm against the client\'s own requirements.',
    recommendedDocIds: ['eq-lifting-register', 'eq-dp-fmea-trials', 'eq-rov-winch-test', 'eq-rigging-slings'],
  },

  // Public Unified Project Scope Templates (Covering All 4 Sub-Assets: Vessel, Crew, Activity, Equipment)
  {
    id: 'tmpl-pub-imca-unified-project',
    subtype: 'All',
    name: 'Unified Marine Project Baseline (illustrative)',
    source: 'public',
    description: 'Vessel, crew, marine operations and lifting equipment evidence for one offshore project. Illustrative, not the issuer\'s list: confirm against the client\'s own requirements.',
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
    name: 'Offshore Marine Project Baseline (illustrative)',
    source: 'public',
    description: 'Field logistics, marine operations and critical asset evidence for an offshore project. Illustrative, not the issuer\'s list: confirm against the client\'s own requirements.',
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
    name: 'Australian Offshore Project Baseline (illustrative)',
    source: 'public',
    description: 'Vessel, crew, operations and equipment evidence for an Australian offshore project; AMSA or NOPSEMA may ask for it. Illustrative, not the issuer\'s list: confirm against the client\'s own requirements.',
    recommendedDocIds: [
      'vessel-class-cert', 'vessel-solas-safety', 'vessel-flag-registry', 'vessel-safe-manning', 'vessel-iopp-cert', 'vessel-bwm-cert',
      'crew-stcw-coc', 'crew-eng1-medical', 'crew-bosiet-training',
      'act-mop-method', 'act-hazid-hazop', 'act-emergency-response', 'act-simops-matrix',
      'eq-lifting-register', 'eq-dp-fmea-trials', 'eq-helideck-cert', 'eq-rigging-slings',
    ],
  },
  {
    id: 'tmpl-pub-generic-assurance',
    subtype: 'All',
    name: 'Generic Offshore Marine Assurance Template (illustrative)',
    source: 'public',
    description: 'Clean, generalized assurance template covering generic [Vessel Type], [Crew Type], [Activity Type], and [Equipment Type] statutory and operational requirements. Template by: [Organization Name].',
    recommendedDocIds: [
      'vessel-class-cert',
      'vessel-solas-safety',
      'vessel-flag-registry',
      'vessel-safe-manning',
      'vessel-iopp-cert',
      'vessel-bwm-cert',
      'vessel-ism-doc',
      'vessel-ism-smc',
      'vessel-pi-entry',
      'vessel-mlc-cert',
      'vessel-inspection-report',
      'crew-stcw-coc',
      'crew-eng1-medical',
      'crew-bosiet-training',
      'crew-dp-logbook',
      'crew-dg-endorsement',
      'act-mop-method',
      'act-hazid-hazop',
      'act-mooring-analysis',
      'act-emergency-response',
      'act-simops-matrix',
      'eq-lifting-register',
      'eq-dp-fmea-trials',
      'eq-rov-winch-test',
      'eq-helideck-cert',
      'eq-rigging-slings',
    ],
    customRequirements: GENERIC_ASSURANCE_CUSTOM_TASKS,
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


