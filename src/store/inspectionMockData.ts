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

export const getFallbackPhysicalInspections = (vesselName: string): PhysicalInspectionRecord[] => [
  {
    id: 'INSP-2026-001',
    assuranceSetId: 'AS-2026-001',
    title: `Annual Statutory Vetting & Safety Audit — ${vesselName}`,
    inspector: 'N. Technical (AMSA Marine Audit Division)',
    inspectorRole: 'Senior Offshore Surveyor',
    date: '10 Sep 2026',
    location: 'Fremantle Port Outer Anchorage, WA',
    client: 'Northwind Marine Pty Ltd',
    status: 'Completed',
    findingsSummary: {
      satisfactory: 14,
      observations: 1,
      deficiencies: 0,
      capaCode: 'CAPA-114',
    },
    checklists: [
      {
        id: 'CHK-01',
        category: 'Life-Saving Appliances (LSA)',
        ref: 'SOLAS Reg III/20',
        status: 'Satisfactory',
        notes: 'All lifeboats, davits, and hydrostatic release units in good working condition.',
        evidence: ['lsa_locker_01.jpg', 'davits_test_cert.pdf'],
      },
      {
        id: 'CHK-02',
        category: 'Fire-Fighting Equipment (FFE)',
        ref: 'SOLAS Reg II-2/10',
        status: 'Satisfactory',
        notes: 'Fixed CO2 system pressure gauges verified within operational green zone.',
        evidence: ['ffe_station3.jpg'],
      },
      {
        id: 'CHK-03',
        category: 'Liferaft HRU Serviceability',
        ref: 'LSA Code IV/4.1',
        status: 'Observation',
        notes: 'Port-side liferaft HRU service date exceeded by 3 weeks. Replacement on order; CAPA-114 raised.',
        evidence: ['hru_tag_port.jpg', 'hru_cert_2026.pdf'],
        capaId: 'CAPA-114',
      },
      {
        id: 'CHK-04',
        category: 'Deck Cargo Securing Arrangement',
        ref: 'IMO Cargo Securing Manual',
        status: 'Satisfactory',
        notes: 'Turnbuckles and D-rings inspected with 0% heavy corrosion.',
        evidence: ['deck_securing_aft.jpg'],
      },
      {
        id: 'CHK-05',
        category: 'Navigation & Bridge Equipment',
        ref: 'SOLAS Reg V/19',
        status: 'Satisfactory',
        notes: 'ECDIS dual redundancy verified with latest ENC chart vector packs.',
        evidence: ['ecdis_log_oct2026.pdf'],
      },
    ],
    auditTrail: [
      { time: '2026-09-10 08:30 UTC', action: 'INSPECTION_INITIATED', user: 'N. Technical', notes: 'Inspector boarded vessel at Fremantle Berth 2.' },
      { time: '2026-09-10 11:45 UTC', action: 'FINDING_LOGGED', user: 'N. Technical', notes: 'Observation logged for Port Liferaft HRU expiration date.' },
      { time: '2026-09-10 14:15 UTC', action: 'CAPA_RAISED', user: 'N. Technical', notes: 'Corrective Action CAPA-114 automatically generated.' },
      { time: '2026-09-10 16:00 UTC', action: 'INSPECTION_COMPLETED', user: 'N. Technical', notes: 'Visual inspection completed with score 94%. Report signed off.' },
    ],
  },
];
