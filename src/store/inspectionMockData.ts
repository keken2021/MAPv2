/* 
  file summary: centralized mock data module for physical vessel inspections, survey checklists, and evidence attachments.
  responsibilities: exports deterministic inspection checklists, initial evidence structures, and inspection records.
  role in system: single source of truth for physical inspection workflows across VesselDetailView, InspectionChecklistView, and InspectorWorkspaceView.
*/

export interface EvidenceItem {
  id: string;
  title: string;
  type: 'Photo' | 'Document';
  fileName?: string;
  fileSize?: string;
  previewUrl?: string;
}

export interface InspectionChecklistTemplateItem {
  id: string;
  category?: string;
  ref?: string;
  title: string;
  subtitle: string;
  status: 'Satisfactory' | 'Observation' | 'Deficiency';
  findingNotes?: string;
  capaCode?: string;
  evidences: EvidenceItem[];
}

export interface InspectionCapaActionItem {
  id: string;
  title: string;
  owner: string;
  dueDate: string;
  status: 'Open' | 'Closed';
}

export interface PhysicalInspectionRecord {
  id: string;
  assuranceSetId: string;
  title: string;
  inspector: string;
  inspectorRole: string;
  date: string;
  location: string;
  client: string;
  status: 'Completed' | 'Scheduled' | 'In Progress';
  findingsSummary: {
    satisfactory: number;
    observations: number;
    deficiencies: number;
    capaCode?: string;
  };
  checklists: {
    id: string;
    category: string;
    ref: string;
    status: 'Satisfactory' | 'Observation' | 'Deficiency';
    notes: string;
    evidence: string[];
    capaId?: string;
  }[];
  auditTrail: {
    time: string;
    action: string;
    user: string;
    notes: string;
  }[];
}

export const DEFAULT_INSPECTION_CHECKLIST_ITEMS: InspectionChecklistTemplateItem[] = [
  {
    id: 'INS-01',
    category: 'Life-Saving Appliances (LSA)',
    ref: 'SOLAS Reg III/20',
    title: 'Life-saving appliances — stowage and condition',
    subtitle: 'SOLAS III · LSA record',
    status: 'Satisfactory',
    evidences: [
      { id: 'EV-101', title: 'LSA locker photo', type: 'Photo', fileName: 'lsa_locker_01.jpg', fileSize: '2.4 MB' },
    ],
  },
  {
    id: 'INS-02',
    category: 'Fire-Fighting Equipment (FFE)',
    ref: 'SOLAS Reg II-2/10',
    title: 'Fire-fighting equipment and fixed systems',
    subtitle: 'SOLAS II-2 · FFE plan',
    status: 'Satisfactory',
    evidences: [
      { id: 'EV-102', title: 'FFE station 3 tag', type: 'Photo', fileName: 'ffe_station3.jpg', fileSize: '1.8 MB' },
    ],
  },
  {
    id: 'INS-03',
    category: 'Liferaft HRU Serviceability',
    ref: 'LSA Code IV/4.1',
    title: 'Liferaft hydrostatic release units',
    subtitle: 'Service due check',
    status: 'Observation',
    findingNotes: 'Port-side liferaft HRU service date exceeded by 3 weeks. Replacement unit on order; corrective action CAPA-118 raised.',
    capaCode: 'CAPA-118',
    evidences: [
      { id: 'EV-103', title: 'Liferaft HRU tag', type: 'Photo', fileName: 'hru_tag_port.jpg', fileSize: '3.1 MB' },
      { id: 'EV-104', title: 'Service cert scan', type: 'Document', fileName: 'hru_cert_2026.pdf', fileSize: '450 KB' },
    ],
  },
  {
    id: 'INS-04',
    category: 'Deck Cargo Securing Arrangement',
    ref: 'IMO Cargo Securing Manual',
    title: 'Deck cargo securing arrangements',
    subtitle: 'Cargo securing manual',
    status: 'Satisfactory',
    evidences: [
      { id: 'EV-105', title: 'Deck securing photo', type: 'Photo', fileName: 'deck_securing_aft.jpg', fileSize: '2.9 MB' },
    ],
  },
  {
    id: 'INS-05',
    category: 'Crew Familiarity & Safety Drills',
    ref: 'ISM Code / SOLAS III',
    title: 'Crew familiarity — muster and abandon ship',
    subtitle: 'ISM · drill records',
    status: 'Satisfactory',
    evidences: [
      { id: 'EV-106', title: 'Muster drill log sheet', type: 'Document', fileName: 'muster_log_sep2026.pdf', fileSize: '620 KB' },
    ],
  },
  {
    id: 'INS-06',
    category: 'Pollution Prevention (MARPOL Annex I)',
    ref: 'MARPOL Annex I',
    title: 'MARPOL Annex I · Pollution Prevention',
    subtitle: 'OWS / bilge discharge monitoring',
    status: 'Observation',
    findingNotes: 'OWS 15 ppm monitor calibration certificate due for annual renewal.',
    capaCode: 'CAPA-115',
    evidences: [
      { id: 'EV-115', title: 'OWS monitor sensor calibration test sheet', type: 'Document', fileName: 'ows_calibration_report_2026.pdf', fileSize: '620 KB' },
    ],
  },
  {
    id: 'INS-07',
    category: 'Sewage Treatment (MARPOL Annex IV)',
    ref: 'MARPOL Annex IV',
    title: 'MARPOL Annex IV · Sewage Treatment Plant',
    subtitle: 'STP aeration / discharge',
    status: 'Observation',
    findingNotes: 'Sewage plant blower inlet filter clogged, causing mild pressure drop.',
    capaCode: 'CAPA-124',
    evidences: [
      { id: 'EV-124', title: 'Sewage plant blower inlet photo', type: 'Photo', fileName: 'sewage_blower_filter.jpg', fileSize: '1.9 MB' },
    ],
  },
];

export const DEFAULT_INSPECTION_CAPA_ITEMS: InspectionCapaActionItem[] = [
  {
    id: 'CAPA-118',
    title: 'Replace port-side liferaft HRU & update service log',
    owner: 'Northwind Marine Technical Dept',
    dueDate: '25 Sep 2026',
    status: 'Open',
  },
];

export interface InspectionListProgress {
  assuranceSetId: string;
  location: string;
  checklistCompleted: number;
  checklistTotal: number;
}

/** one location and one checklist count for each inspection on the Meridian surveyor's list */
export const INSPECTION_LIST_PROGRESS: InspectionListProgress[] = [
  { assuranceSetId: 'AS-2026-001', location: 'Fremantle, WA', checklistCompleted: 30, checklistTotal: 30 },
  { assuranceSetId: 'AS-2026-004', location: 'Dampier, WA', checklistCompleted: 30, checklistTotal: 30 },
  { assuranceSetId: 'AS-2026-005', location: 'Port Hedland, WA', checklistCompleted: 30, checklistTotal: 30 },
  { assuranceSetId: 'AS-2026-008', location: 'Henderson, WA', checklistCompleted: 12, checklistTotal: 30 },
  { assuranceSetId: 'AS-2026-011', location: 'Fremantle, WA', checklistCompleted: 30, checklistTotal: 30 },
  { assuranceSetId: 'AS-ACT-2026-SURF-01', location: 'Wheatstone field', checklistCompleted: 18, checklistTotal: 30 },
  { assuranceSetId: 'AS-EQP-005-01', location: 'Australian Marine Complex', checklistCompleted: 30, checklistTotal: 30 },
  { assuranceSetId: 'AS-01-V001', location: 'Fremantle Berth 2', checklistCompleted: 4, checklistTotal: 30 },
  { assuranceSetId: 'AS-SBE-011-V001', location: 'Geographe field', checklistCompleted: 0, checklistTotal: 30 },
  { assuranceSetId: 'AS-EQP-007-01', location: 'Gorgon field', checklistCompleted: 30, checklistTotal: 30 },
];

export const inspectionProgressForSet = (assuranceSetId: string): InspectionListProgress | undefined =>
  INSPECTION_LIST_PROGRESS.find((row) => row.assuranceSetId === assuranceSetId);

/** checklist rows reused by seeded physical inspection records */
function checklistFromDefaults(
  items: InspectionChecklistTemplateItem[] = DEFAULT_INSPECTION_CHECKLIST_ITEMS.slice(0, 5),
): PhysicalInspectionRecord['checklists'] {
  return items.map((item, idx) => ({
    id: `CHK-${String(idx + 1).padStart(2, '0')}`,
    category: item.category || item.title,
    ref: item.ref || '',
    status: item.status,
    notes: item.findingNotes || item.subtitle,
    evidence: item.evidences.map((e) => e.fileName || e.title),
    capaId: item.capaCode,
  }));
}

/**
  what: seeded physical inspections keyed by assurance set — never invented in the vessel detail view.
  how: one record per inspected set; VesselDetailView overlays the set's inspector and client at read time.
*/
export const PHYSICAL_INSPECTIONS: PhysicalInspectionRecord[] = [
  {
    id: 'INSP-2026-001',
    assuranceSetId: 'AS-2026-001',
    title: 'Visual Vessel Inspection & Safety Audit — Chevron Gorgon Charter Vetting',
    inspector: 'N. Technical (Meridian Marine Surveyors)',
    inspectorRole: 'Inspector',
    date: '14 Oct 2026',
    location: 'Dampier Port Facility, WA',
    client: 'Chevron Australia Pty Ltd',
    status: 'Completed',
    findingsSummary: {
      satisfactory: 12,
      observations: 2,
      deficiencies: 1,
      capaCode: 'CAPA-118',
    },
    checklists: checklistFromDefaults(),
    auditTrail: [
      { time: '2026-10-14 08:30 UTC', action: 'INSPECTION_INITIATED', user: 'N. Technical', notes: 'Inspector boarded vessel at Dampier Berth 3.' },
      { time: '2026-10-14 11:45 UTC', action: 'FINDING_LOGGED', user: 'N. Technical', notes: 'Observation logged for Port Liferaft HRU expiration date.' },
      { time: '2026-10-14 14:15 UTC', action: 'CAPA_RAISED', user: 'N. Technical', notes: 'Corrective Action CAPA-118 automatically generated.' },
      { time: '2026-10-14 16:00 UTC', action: 'INSPECTION_COMPLETED', user: 'N. Technical', notes: 'Visual inspection completed. Report signed off.' },
    ],
  },
  {
    id: 'INSP-2026-004',
    assuranceSetId: 'AS-2026-004',
    title: 'Visual Vessel Inspection & Safety Audit — Woodside Scarborough Subsea Charter',
    inspector: 'Capt. Robert Shaw (Meridian Marine Surveyors)',
    inspectorRole: 'Inspector',
    date: '02 Sep 2026',
    location: 'Dampier, WA',
    client: 'Woodside Energy Ltd',
    status: 'Completed',
    findingsSummary: {
      satisfactory: 14,
      observations: 1,
      deficiencies: 0,
      capaCode: 'CAPA-118',
    },
    checklists: checklistFromDefaults(),
    auditTrail: [
      { time: '2026-09-02 09:00 UTC', action: 'INSPECTION_INITIATED', user: 'Capt. Robert Shaw', notes: 'Inspector boarded at Dampier.' },
      { time: '2026-09-02 15:30 UTC', action: 'INSPECTION_COMPLETED', user: 'Capt. Robert Shaw', notes: 'Inspection completed.' },
    ],
  },
  {
    id: 'INSP-2026-005',
    assuranceSetId: 'AS-2026-005',
    title: 'Visual Vessel Inspection & Safety Audit — Southern Basin Platform Support Charter',
    inspector: 'N. Technical (Meridian Marine Surveyors)',
    inspectorRole: 'Inspector',
    date: '18 Aug 2026',
    location: 'Port Hedland, WA',
    client: 'Southern Basin Energy Pty Ltd',
    status: 'Completed',
    findingsSummary: {
      satisfactory: 13,
      observations: 2,
      deficiencies: 0,
      capaCode: 'CAPA-118',
    },
    checklists: checklistFromDefaults(),
    auditTrail: [
      { time: '2026-08-18 08:15 UTC', action: 'INSPECTION_INITIATED', user: 'N. Technical', notes: 'Inspector boarded at Port Hedland.' },
      { time: '2026-08-18 16:40 UTC', action: 'INSPECTION_COMPLETED', user: 'N. Technical', notes: 'Inspection completed.' },
    ],
  },
  {
    id: 'INSP-2026-008',
    assuranceSetId: 'AS-2026-008',
    title: 'Visual Vessel Inspection & Safety Audit — Schilling ROV System Mobilization Assurance',
    inspector: 'N. Technical (Meridian Marine Surveyors)',
    inspectorRole: 'Inspector',
    date: '22 Oct 2026',
    location: 'Henderson, WA',
    client: 'Northwind Marine Pty Ltd',
    status: 'In Progress',
    findingsSummary: {
      satisfactory: 4,
      observations: 1,
      deficiencies: 0,
    },
    checklists: checklistFromDefaults(DEFAULT_INSPECTION_CHECKLIST_ITEMS.slice(0, 3)),
    auditTrail: [
      { time: '2026-10-22 09:00 UTC', action: 'INSPECTION_INITIATED', user: 'N. Technical', notes: 'Inspection started at Henderson.' },
    ],
  },
];

export type AssuranceSetInspectionFields = {
  id: string;
  title?: string;
  assignedInspector?: string;
  initiatorOrg?: string;
  clientOrg?: string;
  charterer?: string;
  inspectionCompleted?: boolean;
};

/**
  what: physical inspections recorded for the given assurance sets, with each set's inspector and client.
  how: looks up PHYSICAL_INSPECTIONS by assuranceSetId; returns [] when none are recorded (no stand-in invent).
*/
export function getPhysicalInspectionsForAssuranceSets(
  sets: AssuranceSetInspectionFields[],
): PhysicalInspectionRecord[] {
  if (!sets.length) return [];

  const results: PhysicalInspectionRecord[] = [];
  for (const set of sets) {
    const seeded = PHYSICAL_INSPECTIONS.filter((row) => row.assuranceSetId === set.id);
    for (const insp of seeded) {
      const client =
        (set.clientOrg || '').trim() ||
        (set.charterer || '').trim() ||
        (set.initiatorOrg || '').trim() ||
        insp.client;
      let status = insp.status;
      if (set.inspectionCompleted === false && status === 'Completed') {
        status = 'Scheduled';
      } else if (set.inspectionCompleted === true && status === 'Scheduled') {
        status = 'Completed';
      }
      results.push({
        ...insp,
        title: insp.title.includes(set.title || '') || !set.title
          ? insp.title
          : `Visual Vessel Inspection & Safety Audit — ${set.title}`,
        inspector: (set.assignedInspector || '').trim() || insp.inspector,
        client,
        status,
      });
    }
  }
  return results;
}

/**
  what: legacy helper kept for activity tests — returns the AS-2026-001 seed with the vessel name in the title.
  how: clones PHYSICAL_INSPECTIONS[0]; does not invent new checklist content.
*/
export const getFallbackPhysicalInspections = (vesselName: string): PhysicalInspectionRecord[] => {
  const base = PHYSICAL_INSPECTIONS.find((row) => row.assuranceSetId === 'AS-2026-001') || PHYSICAL_INSPECTIONS[0];
  if (!base) return [];
  return [
    {
      ...base,
      title: `Annual Statutory Vetting & Safety Audit — ${vesselName}`,
    },
  ];
};
