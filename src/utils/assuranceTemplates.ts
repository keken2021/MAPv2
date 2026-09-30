/* 
  file summary: predefined subtype document definitions, descriptions, public templates, and organization templates for assurance sets.
  responsibilities: provides maritime-accurate standard requirements for Vessel, Crew, Activity, and Equipment subtypes with complete operational descriptions.
  role in system: consumed by CreateAssuranceSetView.tsx and AssuranceModal.tsx during segmented assurance set initiation.
*/

import { AssuranceSubtype, AssuranceRequirementCategory } from '../types/assurance';

export interface StandardSubtypeDocument {
  id: string;
  subtype: AssuranceSubtype;
  title: string;
  category: AssuranceRequirementCategory;
  description: string;
  defaultEnabled: boolean;
  isMandatory: boolean;
}

export interface SubtypeTemplate {
  id: string;
  subtype: AssuranceSubtype | 'All';
  name: string;
  source: 'public' | 'organization';
  organizationName?: string;
  description: string;
  recommendedDocIds: string[];
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

export const SUBTYPE_TEMPLATES: SubtypeTemplate[] = [
  // Public Templates
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

  // Organization Templates
  {
    id: 'tmpl-org-northwind-fleet',
    subtype: 'Vessel',
    name: 'Northwind Marine Corporate Fleet Standard',
    source: 'organization',
    organizationName: 'Northwind Marine Pty Ltd',
    description: 'Standard internal fleet statutory vetting and environmental management requirements.',
    recommendedDocIds: ['vessel-class-cert', 'vessel-solas-safety', 'vessel-flag-registry', 'vessel-safe-manning', 'vessel-iopp-cert'],
  },
  {
    id: 'tmpl-org-chevron-gorgon',
    subtype: 'All',
    name: 'Chevron Gorgon Project Assurance Package',
    source: 'organization',
    organizationName: 'Chevron Australia Pty Ltd',
    description: 'Comprehensive offshore project vetting criteria covering vessel, certified crew, marine operations, and equipment.',
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
    description: 'Offshore project assurance package covering full DP2/DP3 subsea intervention, heavy lift, and crew safety compliance.',
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
    description: 'Operational compliance standard for Darwin offshore field supply and marine support campaigns.',
    recommendedDocIds: [
      'vessel-class-cert', 'vessel-solas-safety', 'vessel-flag-registry', 'vessel-safe-manning', 'vessel-iopp-cert',
      'crew-stcw-coc', 'crew-eng1-medical', 'crew-bosiet-training',
      'act-mop-method', 'act-hazid-hazop', 'act-emergency-response',
      'eq-lifting-register', 'eq-dp-fmea-trials', 'eq-rigging-slings',
    ],
  },
];
