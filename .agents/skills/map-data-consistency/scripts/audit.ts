/*
  file summary: read-only audit proving every seeded readiness index and pipeline stage has a calculation behind it.
  responsibilities: recomputes set, vessel, project, equipment, crew and marketplace scores from the records below them, derives the pipeline stage per set, and reports each stored value that disagrees with its basis.
  role in system: run by the map-data-consistency skill with `npx vite-node`; imports the mock data modules and the helpers in src/utils and writes nothing.
*/

import { MOCK_VESSELS, MOCK_ASSURANCE_SETS, MOCK_DOCUMENTS } from '../../../../src/store/mockData';
import { MOCK_PROJECTS, PROJECT_SEED_ASSURANCE_SETS } from '../../../../src/store/projectMockData';
import { MOCK_EQUIPMENT } from '../../../../src/store/equipmentMockData';
import { MOCK_CREW } from '../../../../src/store/crewMockData';
import { MOCK_MARKETPLACE_ITEMS } from '../../../../src/store/marketplaceMockData';
import {
  calculateAssuranceSetReadiness,
  calculateCrewComplianceScore,
  calculateDocumentReadiness,
  calculateEquipmentReadiness,
  calculateVesselReadiness,
  deriveCrewComplianceStatus,
  derivePipelineStage,
  getPipelineStageBasis,
  getRequirementReadinessPercentage,
  isVesselStatusPermitted,
  requirementHasDocument,
  STAGE_READINESS_WEIGHTS,
} from '../../../../src/utils/readinessHelpers';
import {
  calculateProjectReadiness,
  deriveProjectStatus,
  getProjectAssuranceSets,
} from '../../../../src/utils/projectHelpers';
import { deriveComplianceStatus } from '../../../../src/types/asset';
import type { AssuranceSet, AssuranceStage } from '../../../../src/types/assurance';
import type { Vessel } from '../../../../src/types/vessel';
import type { Project } from '../../../../src/types/project';

type Severity = 'error' | 'warning';

interface Finding {
  check: CheckId;
  severity: Severity;
  recordId: string;
  message: string;
}

type CheckId = 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'C6' | 'C7' | 'C8' | 'C9' | 'C10' | 'C11' | 'C12';

/* one line per check; the skill file documents the rule behind each */
const CHECK_TITLES: Record<CheckId, string> = {
  C1: 'set readiness index equals the requirement average',
  C2: 'set pipeline stage equals the first incomplete stage',
  C3: 'isFulfilled agrees with verifierStatus',
  C4: 'requirement document references resolve',
  C5: 'vessel score equals the average of its linked sets',
  C6: 'project score equals the average of its sets',
  C7: 'equipment score equals its set average; crew score equals its own document share',
  C8: 'marketplace score equals the linked asset and its own metric text',
  C9: 'denormalized names and ids match their source record',
  C10: 'vessel status agrees with its readiness',
  C11: 'requirement status equals the linked document status',
  C12: 'project status agrees with its sets',
};

const ALL_SETS: AssuranceSet[] = [...MOCK_ASSURANCE_SETS, ...PROJECT_SEED_ASSURANCE_SETS];
const TERMINAL_STAGES: AssuranceStage[] = ['Approved', 'Certified'];
/* lifecycle states a person sets by hand; the sets cannot contradict them */
const MANUAL_PROJECT_STATUSES: Project['status'][] = ['Draft', 'Closed'];
const findings: Finding[] = [];
const divergences: string[] = [];

/**
  what: records one audit finding; inputs are the check id, severity, record id and message.
  how: pushes onto the module-level findings list that the report prints at the end.
  with what file: .agents/skills/map-data-consistency/scripts/audit.ts only.
*/
function report(check: CheckId, severity: Severity, recordId: string, message: string): void {
  findings.push({ check, severity, recordId, message });
}

/**
  what: rounded mean of a list of scores; input is the list.
  how: sums and divides by the count, returning 0 for an empty list.
  with what file: .agents/skills/map-data-consistency/scripts/audit.ts only.
*/
function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

/**
  what: renders the arithmetic behind an average; input is the list of scores.
  how: joins the values with plus signs and appends the divisor and the rounded result.
  with what file: .agents/skills/map-data-consistency/scripts/audit.ts only.
*/
function showAverage(values: number[]): string {
  if (values.length === 0) return 'no values';
  if (values.length === 1) return `${values[0]} / 1 = ${values[0]}`;
  return `(${values.join(' + ')}) / ${values.length} = ${average(values)}`;
}

/* a stored score of null is the agreed "not assessed" value */
function showScore(score: number | null | undefined): string {
  return score === null || score === undefined ? 'not assessed' : String(score);
}

function resolveSet(setId: string): AssuranceSet | undefined {
  return ALL_SETS.find((s) => s.id === setId);
}

/* approved and certified are the same terminal position on the stepper */
function sameStage(a: AssuranceStage, b: AssuranceStage): boolean {
  return a === b || (TERMINAL_STAGES.includes(a) && TERMINAL_STAGES.includes(b));
}

function requirementWeights(set: AssuranceSet): number[] {
  return set.requirements.map((r) => getRequirementReadinessPercentage(r, set, resolveSet));
}

/**
  what: explains a set score; input is the set.
  how: prints the requirement weights and their average, and names the helper result when a helper override makes it differ from the plain average.
  with what file: .agents/skills/map-data-consistency/scripts/audit.ts; reads src/utils/readinessHelpers.ts.
*/
function showSetScore(set: AssuranceSet): string {
  const weights = requirementWeights(set);
  const helper = calculateAssuranceSetReadiness(set, ALL_SETS);
  if (weights.length === 0) return `no requirements; helper returns ${helper} from the stage alone`;
  const plain = showAverage(weights);
  return average(weights) === helper ? plain : `${plain}; helper override returns ${helper}`;
}

/**
  what: audits every assurance set for score, stage, fulfilment flags and references (checks c1 to c4, c11, part of c9).
  how: compares each stored literal with the helper output and the derived pipeline, grouping requirement-level defects into one finding per set.
  with what file: .agents/skills/map-data-consistency/scripts/audit.ts; reads src/store/mockData.ts and src/store/projectMockData.ts.
*/
function auditSets(): void {
  const documentIds = new Set<string>(MOCK_DOCUMENTS.map((d) => d.id));
  MOCK_CREW.forEach((c) =>
    [...c.layer1CoreDocuments, ...c.layer2Endorsements].forEach((d) => documentIds.add(d.id)),
  );
  MOCK_VESSELS.forEach((v) => (v.statutoryCertificates ?? []).forEach((c) => documentIds.add(c.id)));

  ALL_SETS.forEach((set) => {
    /* c1: stored index against the helper every screen is meant to call */
    const calculated = calculateAssuranceSetReadiness(set, ALL_SETS);
    if (set.readinessScore !== calculated) {
      report('C1', 'error', set.id, `stored ${set.readinessScore}, calculates ${calculated}: ${showSetScore(set)}`);
    }

    /* c2: stored stage against the first incomplete stage */
    if (set.requirements.length === 0) {
      report('C2', 'warning', set.id, `stage ${set.stage} has no basis: the set has no requirements`);
    } else {
      const derived = derivePipelineStage(set);
      if (!sameStage(set.stage, derived)) {
        const blocking = getPipelineStageBasis(set).find((b) => b.cleared < b.total);
        const why = blocking ? `${blocking.stage} ${blocking.cleared}/${blocking.total} ${blocking.criterion}` : 'all stages cleared';
        const corrected = calculateAssuranceSetReadiness({ ...set, stage: derived }, ALL_SETS);
        report('C2', 'error', set.id, `stored ${set.stage}, derived ${derived}: ${why}; index is ${corrected} at the derived stage`);
      }
    }

    /* c3: a fulfilled flag scores 70 in the formula, so it must follow the verifier status */
    if (set.verificationRequired !== false) {
      const contradictory = set.requirements.filter(
        (r) => r.fulfillmentType !== 'assurance_set' && r.isFulfilled !== (r.verifierStatus === 'Verified'),
      );
      if (contradictory.length > 0) {
        const detail = contradictory.map((r) => `${r.id} isFulfilled ${r.isFulfilled} / ${r.verifierStatus}`).join(', ');
        report('C3', 'error', set.id, `${contradictory.length} of ${set.requirements.length} requirements: ${detail}`);
      }
    }

    /* c4: references must resolve, and a verified requirement must point at its evidence */
    const broken: string[] = [];
    const unreferenced: string[] = [];
    /* c11: the requirement row and the document library must tell the same story */
    const disagreeing: string[] = [];
    set.requirements.forEach((r) => {
      if (r.documentId && !documentIds.has(r.documentId)) broken.push(`${r.id} documentId ${r.documentId}`);
      if (r.linkedDocumentId && !documentIds.has(r.linkedDocumentId)) broken.push(`${r.id} linkedDocumentId ${r.linkedDocumentId}`);
      if (r.linkedAssuranceSetId && !resolveSet(r.linkedAssuranceSetId)) broken.push(`${r.id} linkedAssuranceSetId ${r.linkedAssuranceSetId}`);
      if (r.verifierStatus === 'Verified' && !requirementHasDocument(r)) unreferenced.push(r.id);

      const document = MOCK_DOCUMENTS.find((d) => d.id === (r.documentId || r.linkedDocumentId));
      if (document && document.verificationStatus !== r.verifierStatus) {
        disagreeing.push(`${r.id} ${r.verifierStatus} but ${document.id} is ${document.verificationStatus}`);
      }
    });
    if (broken.length > 0) report('C4', 'error', set.id, `unresolved reference: ${broken.join(', ')}`);
    if (unreferenced.length > 0) {
      report('C4', 'error', set.id, `${unreferenced.length} verified with no document reference: ${unreferenced.join(', ')}`);
    }
    if (disagreeing.length > 0) report('C11', 'error', set.id, disagreeing.join(', '));

    /* c9: fields copied from the vessel, project, equipment and crew records */
    const vessel = MOCK_VESSELS.find((v) => v.id === set.vesselId);
    if (set.vesselId && !vessel) {
      report('C9', 'error', set.id, `vesselId ${set.vesselId} does not exist`);
    } else if (vessel) {
      if (set.vesselName !== vessel.name) report('C9', 'error', set.id, `vesselName "${set.vesselName}" but ${vessel.id} is "${vessel.name}"`);
      if (set.imoNumber !== vessel.imoNumber) report('C9', 'error', set.id, `imoNumber ${set.imoNumber} but ${vessel.id} is ${vessel.imoNumber}`);
    }
    if (set.projectId) {
      const project = MOCK_PROJECTS.find((p) => p.id === set.projectId);
      if (!project) report('C9', 'error', set.id, `projectId ${set.projectId} does not exist`);
      else if (set.projectName && set.projectName !== project.name) {
        report('C9', 'error', set.id, `projectName "${set.projectName}" but ${project.id} is "${project.name}"`);
      }
    }
    if (set.equipmentId) {
      const equipment = MOCK_EQUIPMENT.find((e) => e.id === set.equipmentId);
      if (!equipment) report('C9', 'error', set.id, `equipmentId ${set.equipmentId} does not exist`);
      else if (set.equipmentName && set.equipmentName !== equipment.name) {
        report('C9', 'warning', set.id, `equipmentName "${set.equipmentName}" but ${equipment.id} is "${equipment.name}"`);
      }
    }
    if (set.crewId) {
      const crew = MOCK_CREW.find((c) => c.id === set.crewId);
      if (!crew) report('C9', 'error', set.id, `crewId ${set.crewId} does not exist`);
      else if (set.crewName && set.crewName !== crew.fullName) {
        report('C9', 'warning', set.id, `crewName "${set.crewName}" but ${crew.id} is "${crew.fullName}"`);
      }
    }
  });
}

/* same linkage rule as calculateVesselReadiness, repeated only to name the sets in the report */
function setsForVessel(vessel: Vessel): AssuranceSet[] {
  return ALL_SETS.filter(
    (s) => s.vesselId === vessel.id || (vessel.name && s.vesselName?.toLowerCase() === vessel.name.toLowerCase()),
  );
}

/**
  what: explains a vessel score; input is the vessel.
  how: follows the basis order of calculateVesselReadiness (linked sets, then linked documents, then statutory certificates) and prints the arithmetic of the first one that applies.
  with what file: .agents/skills/map-data-consistency/scripts/audit.ts; reads src/utils/readinessHelpers.ts.
*/
function describeVesselBasis(vessel: Vessel): { basis: 'sets' | 'documents' | 'certificates' | 'none'; text: string } {
  const sets = setsForVessel(vessel);
  if (sets.length > 0) {
    const scores = sets.map((s) => calculateAssuranceSetReadiness(s));
    return { basis: 'sets', text: `${sets.length} set(s) ${sets.map((s) => s.id).join(', ')}: ${showAverage(scores)}` };
  }
  const docs = MOCK_DOCUMENTS.filter(
    (d) => d.vesselId === vessel.id || (vessel.imoNumber && d.vesselAttributes?.imoNumber === vessel.imoNumber),
  );
  if (docs.length > 0) {
    return { basis: 'documents', text: `${docs.length} document(s): ${showAverage(docs.map((d) => calculateDocumentReadiness(d)))}` };
  }
  const certs = vessel.statutoryCertificates ?? [];
  if (certs.length > 0) {
    const scores = certs.map((c) =>
      c.status === 'Valid'
        ? STAGE_READINESS_WEIGHTS.approved
        : c.status === 'Expiring Soon'
          ? STAGE_READINESS_WEIGHTS.verified
          : STAGE_READINESS_WEIGHTS.submitted,
    );
    return { basis: 'certificates', text: `${certs.length} certificate(s): ${showAverage(scores)}` };
  }
  return { basis: 'none', text: 'no linked sets, documents or certificates' };
}

/**
  what: audits every vessel score and its status gates (checks c5 and c10).
  how: compares the stored score with calculateVesselReadiness, then checks the operating status gate and the compliance label against the calculated score.
  with what file: .agents/skills/map-data-consistency/scripts/audit.ts; reads src/store/mockData.ts and src/types/asset.ts.
*/
function auditVessels(): void {
  MOCK_VESSELS.forEach((vessel) => {
    const calculated = calculateVesselReadiness(vessel, ALL_SETS, MOCK_DOCUMENTS);
    const { basis, text } = describeVesselBasis(vessel);

    if (basis === 'none') {
      report('C5', 'warning', vessel.id, `stored ${vessel.complianceReadinessScore} has no basis: ${text}`);
    } else if (vessel.complianceReadinessScore !== calculated) {
      report('C5', 'error', vessel.id, `stored ${vessel.complianceReadinessScore}, calculates ${calculated}: ${text}`);
    }

    const gate = isVesselStatusPermitted(vessel.status, vessel, ALL_SETS, MOCK_DOCUMENTS);
    if (!gate.isPermitted) {
      report('C10', 'error', vessel.id, `status "${vessel.status}" needs an approved set or 100 readiness; calculates ${calculated}`);
    }
    const expectedLabel = deriveComplianceStatus(calculated);
    if (vessel.complianceStatus && vessel.complianceStatus !== expectedLabel) {
      report('C10', 'warning', vessel.id, `complianceStatus "${vessel.complianceStatus}" but a score of ${calculated} derives "${expectedLabel}"`);
    }
  });
}

/**
  what: audits every project score and status (checks c6 and c12).
  how: averages the calculated score of the project's sets and compares it with the stored score, compares the stored status with deriveProjectStatus, and notes where the project helper disagrees with the average rule.
  with what file: .agents/skills/map-data-consistency/scripts/audit.ts; reads src/store/projectMockData.ts and src/utils/projectHelpers.ts.
*/
function auditProjects(): void {
  MOCK_PROJECTS.forEach((project: Project) => {
    project.assetLinks.forEach((link) => {
      if (link.assuranceSetId && !resolveSet(link.assuranceSetId)) {
        report('C9', 'error', project.id, `asset link ${link.id} points at missing set ${link.assuranceSetId}`);
      }
    });

    const sets = getProjectAssuranceSets(project, ALL_SETS);
    const scores = sets.map((s) => calculateAssuranceSetReadiness(s, ALL_SETS));
    const expected = average(scores);
    const stored = project.readinessScore ?? 0;
    const text = sets.length > 0 ? `${sets.map((s) => s.id).join(', ')}: ${showAverage(scores)}` : 'no sets, so 0';

    if (stored !== expected) report('C6', 'error', project.id, `stored ${stored}, average ${expected}: ${text}`);

    const helper = calculateProjectReadiness(project, ALL_SETS);
    if (helper !== expected) {
      divergences.push(`${project.id}: calculateProjectReadiness returns ${helper}; the average rule gives ${expected}`);
    }

    const derivedStatus = deriveProjectStatus(project, ALL_SETS);
    if (!MANUAL_PROJECT_STATUSES.includes(project.status) && project.status !== derivedStatus) {
      report('C12', 'error', project.id, `status "${project.status}" but its ${sets.length} set(s) derive "${derivedStatus}"`);
    }
  });
}

/**
  what: audits equipment and crew scores (check c7).
  how: equipment must equal calculateEquipmentReadiness, which is null when no set names it; crew must equal calculateCrewComplianceScore over the crew member's own documents, with the matching compliance label.
  with what file: .agents/skills/map-data-consistency/scripts/audit.ts; reads src/store/equipmentMockData.ts and src/store/crewMockData.ts.
*/
function auditAssets(): void {
  MOCK_EQUIPMENT.forEach((equipment) => {
    const expected = calculateEquipmentReadiness(equipment, ALL_SETS);
    if (equipment.complianceReadinessScore === expected) return;

    const sets = ALL_SETS.filter((s) => s.equipmentId === equipment.id);
    const basis = sets.length > 0
      ? `${sets.map((s) => s.id).join(', ')}: ${showAverage(sets.map((s) => calculateAssuranceSetReadiness(s, ALL_SETS)))}`
      : 'no assurance set names this equipment, so it is not assessed (null)';
    report('C7', 'error', equipment.id, `stored ${showScore(equipment.complianceReadinessScore)}, expected ${showScore(expected)}: ${basis}`);
  });

  MOCK_CREW.forEach((crew) => {
    const documents = [...crew.layer1CoreDocuments, ...crew.layer2Endorsements];
    const verified = documents.filter((d) => d.verificationStatus === 'Verified').length;
    const expected = calculateCrewComplianceScore(crew);
    if (crew.overallComplianceScore !== expected) {
      report('C7', 'error', crew.id, `stored ${crew.overallComplianceScore}, calculates ${expected}: ${verified} of ${documents.length} own documents verified`);
    }
    const expectedStatus = deriveCrewComplianceStatus(crew);
    if (crew.complianceStatus !== expectedStatus) {
      report('C7', 'error', crew.id, `complianceStatus "${crew.complianceStatus}" but its documents derive "${expectedStatus}"`);
    }
  });
}

/**
  what: audits marketplace offering scores (check c8).
  how: an offering linked to a registry asset must carry that asset's calculated score; an unlinked offering must be null; any percentage a readiness or compliance metric quotes must repeat the score.
  with what file: .agents/skills/map-data-consistency/scripts/audit.ts; reads src/store/marketplaceMockData.ts.
*/
function auditMarketplace(): void {
  MOCK_MARKETPLACE_ITEMS.forEach((item) => {
    const stored = item.complianceReadinessScore;

    /* a metric restates the score when it says "nn% ready" or is labelled as compliance, readiness or assurance */
    item.metrics.forEach((metric) => {
      const restatesScore = /%\s*ready/i.test(metric.value) || /compliance|readiness|assurance/i.test(metric.label);
      const quoted = metric.value.match(/(\d+)\s*%/);
      if (restatesScore && quoted && Number(quoted[1]) !== stored) {
        report('C8', 'error', item.id, `metric "${metric.label}: ${metric.value}" quotes ${quoted[1]} but complianceReadinessScore is ${showScore(stored)}`);
      }
    });

    if (!item.linkedEntityId) {
      if (stored !== null) {
        report('C8', 'error', item.id, `stored ${showScore(stored)} has no basis: the offering links to no registry asset, so it is not assessed (null)`);
      }
      return;
    }

    let expected: number | null | undefined;
    if (item.linkedEntityType === 'vessel') {
      const vessel = MOCK_VESSELS.find((v) => v.id === item.linkedEntityId);
      if (vessel) expected = calculateVesselReadiness(vessel, ALL_SETS, MOCK_DOCUMENTS);
    } else if (item.linkedEntityType === 'equipment') {
      const equipment = MOCK_EQUIPMENT.find((e) => e.id === item.linkedEntityId);
      if (equipment) expected = calculateEquipmentReadiness(equipment, ALL_SETS);
    } else if (item.linkedEntityType === 'crew') {
      const crew = MOCK_CREW.find((c) => c.id === item.linkedEntityId);
      if (crew) expected = calculateCrewComplianceScore(crew);
    }

    if (expected === undefined) {
      report('C9', 'error', item.id, `linkedEntityId ${item.linkedEntityId} (${item.linkedEntityType}) does not exist`);
    } else if (stored !== expected) {
      report('C8', 'error', item.id, `stored ${showScore(stored)}, linked ${item.linkedEntityType} ${item.linkedEntityId} is ${showScore(expected)}`);
    }
  });
}

/**
  what: prints the full basis of one record; input is a set, vessel, project or crew id.
  how: for a set lists each requirement weight, the index arithmetic and the per-stage counts; for a vessel or project lists the child sets and their average; for a crew member lists the document share.
  with what file: .agents/skills/map-data-consistency/scripts/audit.ts only.
*/
function printRecordBasis(recordId: string): boolean {
  const set = resolveSet(recordId);
  if (set) {
    const derived = derivePipelineStage(set);
    console.log(`\n${set.id}  ${set.title}`);
    console.log('\nRequirements');
    set.requirements.forEach((r) => {
      const weight = getRequirementReadinessPercentage(r, set, resolveSet);
      const doc = r.documentId || r.linkedDocumentId || r.linkedAssuranceSetId || 'no document';
      console.log(`  ${r.id.padEnd(18)} ${String(weight).padStart(3)}  ${r.verifierStatus.padEnd(20)} ${doc}`);
    });
    console.log('\nReadiness index');
    console.log(`  ${showSetScore(set)}`);
    console.log(`  stored ${set.readinessScore}, calculates ${calculateAssuranceSetReadiness(set, ALL_SETS)}`);
    console.log('\nPipeline');
    getPipelineStageBasis(set).forEach((b) => {
      const marker = b.stage === derived || (b.stage === 'Approval' && derived === 'Approved') ? '  <- derived stage' : '';
      console.log(`  ${b.stage.padEnd(13)} ${`${b.cleared}/${b.total}`.padEnd(6)} ${b.criterion}${marker}`);
    });
    console.log(`  stored ${set.stage}, derived ${derived}`);
    return true;
  }

  const vessel = MOCK_VESSELS.find((v) => v.id === recordId);
  if (vessel) {
    console.log(`\n${vessel.id}  ${vessel.name}`);
    setsForVessel(vessel).forEach((s) => console.log(`  ${s.id.padEnd(22)} ${calculateAssuranceSetReadiness(s)}`));
    console.log(`  ${describeVesselBasis(vessel).text}`);
    console.log(`  stored ${vessel.complianceReadinessScore}, calculates ${calculateVesselReadiness(vessel, ALL_SETS, MOCK_DOCUMENTS)}`);
    return true;
  }

  const project = MOCK_PROJECTS.find((p) => p.id === recordId);
  if (project) {
    const sets = getProjectAssuranceSets(project, ALL_SETS);
    const scores = sets.map((s) => calculateAssuranceSetReadiness(s, ALL_SETS));
    console.log(`\n${project.id}  ${project.name}`);
    sets.forEach((s, i) => console.log(`  ${s.id.padEnd(22)} ${scores[i]}`));
    console.log(`  ${showAverage(scores)}`);
    console.log(`  stored ${project.readinessScore ?? 0}, average ${average(scores)}, helper ${calculateProjectReadiness(project, ALL_SETS)}`);
    console.log(`  status "${project.status}", derived "${deriveProjectStatus(project, ALL_SETS)}"`);
    return true;
  }

  const crew = MOCK_CREW.find((c) => c.id === recordId);
  if (crew) {
    const documents = [...crew.layer1CoreDocuments, ...crew.layer2Endorsements];
    console.log(`\n${crew.id}  ${crew.fullName}`);
    documents.forEach((d) => console.log(`  ${d.id.padEnd(26)} ${d.verificationStatus}`));
    console.log(`  stored ${crew.overallComplianceScore}, calculates ${calculateCrewComplianceScore(crew)}`);
    console.log(`  status "${crew.complianceStatus}", derived "${deriveCrewComplianceStatus(crew)}"`);
    return true;
  }

  return false;
}

/**
  what: prints the grouped findings and the summary table, and sets the exit code.
  how: lists each check with its error and warning counts followed by one line per finding, then any helper divergence; exits 1 when any error exists.
  with what file: .agents/skills/map-data-consistency/scripts/audit.ts only.
*/
function printReport(): void {
  console.log('MAP mock data consistency audit');
  console.log(
    `records: ${ALL_SETS.length} sets, ${MOCK_VESSELS.length} vessels, ${MOCK_PROJECTS.length} projects, ` +
      `${MOCK_EQUIPMENT.length} equipment, ${MOCK_CREW.length} crew, ${MOCK_MARKETPLACE_ITEMS.length} marketplace offerings`,
  );

  (Object.keys(CHECK_TITLES) as CheckId[]).forEach((check) => {
    const rows = findings.filter((f) => f.check === check);
    const errors = rows.filter((f) => f.severity === 'error').length;
    const warnings = rows.length - errors;
    console.log(`\n[${check}] ${CHECK_TITLES[check]}: ${errors} error(s), ${warnings} warning(s)`);
    rows.forEach((f) => console.log(`  ${f.severity === 'error' ? 'ERROR' : 'WARN '}  ${f.recordId.padEnd(26)} ${f.message}`));
  });

  if (divergences.length > 0) {
    console.log('\nCode divergence (project helper disagrees with the average rule; not a data error)');
    divergences.forEach((d) => console.log(`  ${d}`));
  }

  const errorCount = findings.filter((f) => f.severity === 'error').length;
  console.log(`\nTotal: ${errorCount} error(s), ${findings.length - errorCount} warning(s)`);
  process.exitCode = errorCount > 0 ? 1 : 0;
}

const recordArg = process.argv.slice(2).find((arg) => !arg.startsWith('-') && !arg.endsWith('.ts'));

if (recordArg) {
  if (!printRecordBasis(recordArg)) {
    console.log(`No assurance set, vessel, project or crew member with id ${recordArg}`);
    process.exitCode = 1;
  }
} else {
  auditSets();
  auditVessels();
  auditProjects();
  auditAssets();
  auditMarketplace();
  printReport();
}

