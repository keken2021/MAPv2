/*
  file summary: Oil Company LNG Field Development pilot seed for BRD v4.1 section 8. SS-01, SS-02 and SS-03 are seeded. SS-04 and SS-05 are left unseeded so they can be created live.
  responsibilities: fictional organizations, vessels, evidence tasks, documents, audit events and notifications for a live localhost demonstration.
  role in system: spread into mockData, projectMockData and notificationMockData, then loaded by useMapStore.
*/

import {
  AssuranceRequirement,
  AssuranceSet,
  ThreePillarsCategory,
} from "../types/assurance";
import { AuditTrailEvent } from "../types/audit";
import { MasterDocument } from "../types/document";
import { AppNotification } from "../types/notification";
import { Project } from "../types/project";
import { UserProfile } from "../types/user";
import { Vessel } from "../types/vessel";

export const OIL_CO_ORG = "Oil Company";
export const NORTHWIND_ORG = "Northwind Marine Pty Ltd";
export const XY_MARINE_ORG = "XY Marine Assurance";
export const MERIDIAN_ORG = "Meridian Shipyards";
export const AUSTRAL_ORG = "Austral Classification Society";
export const HARBOURLINE_ORG = "Harbourline Terminals";
export const COASTAL_ORG = "Coastal Fuel Testing";
export const KESTREL_ORG = "Kestrel Control Systems";
export const SENTINEL_ORG = "Sentinel Cyber Assurance";

export const OIL_CO_LNG_PROJECT_ID = "MAP-PROJ-2026-MARINE-017";
export const OIL_CO_SS01_ID = "AS-2026-101";
export const OIL_CO_SS02_ID = "AS-2026-102";
export const OIL_CO_SS03_ID = "AS-2026-103";

export const OIL_CO_AURORA_ID = "VESSEL-013";
export const OIL_CO_ENDEAVOUR_ID = "VESSEL-014";

const OIL_CO_ADMIN = "A. Okonkwo";
const NORTHWIND_SUBMITTER = "M. Chen";
const XY_VERIFIER = "L. Ferreira";
const XY_APPROVER = "S. Rahman";
const XY_INSPECTOR = "H. Blake";
const MERIDIAN_SUBMITTER = "R. Sato";
const AUSTRAL_VERIFIER = "P. Nguyen";
const HARBOURLINE_SUBMITTER = "D. Walsh";
const NORTHWIND_CLIENT = "T. Okada";
const OIL_CO_SUBMITTER = "J. Hale";
const OIL_CO_APPROVER = "K. Adeyemi";
const COASTAL_VERIFIER = "N. Brooks";
const COASTAL_APPROVER = "C. Almeida";
const COASTAL_INSPECTOR = "F. Ibarra";
const KESTREL_SUBMITTER = "A. Petrov";
const SENTINEL_VERIFIER = "R. Singh";
const SENTINEL_INSPECTOR = "M. Laurent";

const label = (name: string, org: string) => `${name} (${org})`;

type EvidenceState = "missing" | "pending" | "verified" | "correction";

type EvidenceRow = {
  id: string;
  pillar: ThreePillarsCategory;
  title: string;
  source: string;
  check: string;
  state: EvidenceState;
  issuingAuthority?: boolean;
};

function evidenceDocument(
  row: EvidenceRow,
  seq: number,
  vesselId: string,
  vesselName: string,
  imo: string,
  uploadedBy: string,
): MasterDocument {
  const people = row.pillar === "People";
  const correction = row.state === "correction";
  const id = people
    ? `MAP-CRW-2026-STCW-${String(seq).padStart(5, "0")}`
    : row.pillar === "Process"
      ? `MAP-DOC-2026-STAT-${String(seq).padStart(5, "0")}`
      : `MAP-VES-2026-STAT-${String(seq).padStart(5, "0")}`;
  const expiryDate = correction ? "2027-03-01" : "2028-11-30";
  return {
    id,
    title: row.title,
    entityType: people ? "Crew Certificate" : "Vessel Certificate",
    vesselId,
    certificateNo: `LNG-${seq}`,
    issuingAuthority: row.source,
    expiryDate,
    ocrConfidence: correction ? 91 : 97,
    complianceState: correction ? "Expiring < 6 Mos" : "Valid",
    currentVersion: "v1.0",
    versions: [
      {
        versionLabel: "v1.0",
        uploadedAt: "2026-10-08T02:00:00Z",
        uploadedBy,
        fileSizeBytes: 1800000,
        fileName: `${row.title.replace(/[^A-Za-z0-9]+/g, "_")}.pdf`,
        changeSummary: "Submitted for Oil Company LNG Field Development.",
      },
    ],
    vesselAttributes: people
      ? undefined
      : {
          title: row.title,
          certificateNumber: `LNG-${seq}`,
          certType: row.pillar,
          issuingBody: row.source,
          issueDate: "2026-04-01",
          expiryDate,
          vesselName,
          imoNumber: imo,
          flagState: "Australia",
          assetMatchFlag: true,
          lastSurveyDate: "2026-04-01",
          ocrConfidence: correction ? 91 : 97,
          status: correction ? "Expiring < 6 Mos" : "Valid",
        },
    crewAttributes: people
      ? {
          crewName: "Capt. Elena Voss",
          passportId: "PA-441290",
          rank: "Master",
          certType: row.title,
          issuingCenter: row.source,
          issueDate: "2024-06-01",
          expiryDate,
          assignedVessel: vesselName,
          nationality: "Australian",
          trainingDate: "2025-09-12",
          ocrConfidence: 97,
        }
      : undefined,
    validationRules: {
      charterBufferPassed: !correction,
      assetMatch100Percent: true,
      iacsAuthorityValid: true,
      overallValid: !correction,
      exceptionDetails: correction
        ? "Expires within 6 months of the SS-01 charter date (15 Nov 2026). An approved extension is required."
        : undefined,
    },
    verificationStatus:
      row.state === "verified"
        ? "Verified"
        : correction
          ? "Correction Requested"
          : "Pending",
    verificationNotes: correction
      ? "Expires within 6 months of the charter date. Return to Northwind for an extension or renewal."
      : undefined,
  };
}

function buildEvidence(
  rows: EvidenceRow[],
  seqStart: number,
  vesselId: string,
  vesselName: string,
  imo: string,
  uploadedBy: string,
  scope: "Vessel" | "Activity",
): { requirements: AssuranceRequirement[]; documents: MasterDocument[] } {
  const documents: MasterDocument[] = [];
  const requirements = rows.map((row, index) => {
    const attached = row.state !== "missing";
    const document = attached
      ? evidenceDocument(
          row,
          seqStart + index,
          vesselId,
          vesselName,
          imo,
          uploadedBy,
        )
      : undefined;
    if (document) documents.push(document);
    const subtype =
      scope === "Vessel" && row.pillar === "Plant"
        ? "Vessel"
        : scope === "Activity" && row.pillar === "Process"
          ? "Activity"
          : undefined;
    const category =
      row.pillar === "People"
        ? "Crew Credential"
        : row.pillar === "Plant"
          ? "Statutory Certificate"
          : "Operational Plan";
    return {
      id: row.id,
      subtype,
      category,
      title: row.title,
      description: `${row.check} Source: ${row.source}.${
        row.issuingAuthority
          ? " Issuing-authority review: the verifier records the Port Authority confirmation."
          : ""
      }`,
      isMandatory: true,
      isFulfilled: row.state === "verified",
      ocrConfidence: document?.ocrConfidence ?? 0,
      documentId: document?.id,
      verifierStatus:
        row.state === "verified"
          ? "Verified"
          : row.state === "correction"
            ? "Correction Requested"
            : "Pending",
      notes: row.issuingAuthority ? "Issuing-authority review" : undefined,
    } satisfies AssuranceRequirement;
  });
  return { requirements, documents };
}

const ss01Rows: EvidenceRow[] = [
  {
    id: "REQ-SS01-01",
    pillar: "People",
    title:
      "Certificates of Competency and endorsements for Master and officers (STCW II/1, II/2, III/1, III/2)",
    source: "Flag State administration",
    check: "Valid; rank matches crew list; endorsement for flag.",
    state: "verified",
  },
  {
    id: "REQ-SS01-02",
    pillar: "People",
    title:
      "Advanced liquefied gas tanker cargo operations training (STCW V/1-2)",
    source: "Flag State / approved training center",
    check: "Held by Master, officers and cargo crew as required.",
    state: "pending",
  },
  {
    id: "REQ-SS01-03",
    pillar: "People",
    title: "Medical fitness certificates for all crew",
    source: "Approved medical examiner",
    check: "Valid for the full charter period.",
    state: "pending",
  },
  {
    id: "REQ-SS01-04",
    pillar: "People",
    title: "Basic Safety Training and other mandatory STCW training",
    source: "Approved training center",
    check: "Valid; matches crew list.",
    state: "pending",
  },
  {
    id: "REQ-SS01-05",
    pillar: "People",
    title: "Crew list and minimum safe manning",
    source: NORTHWIND_ORG,
    check: "Manning meets the Minimum Safe Manning Document.",
    state: "verified",
  },
  {
    id: "REQ-SS01-06",
    pillar: "People",
    title: "Designated Person Ashore and Company Security Officer appointments",
    source: NORTHWIND_ORG,
    check: "Named, current and contactable.",
    state: "pending",
  },
  {
    id: "REQ-SS01-07",
    pillar: "Plant",
    title: "Certificate of Registry",
    source: "Flag State",
    check: "Vessel identity matches IMO, name and flag.",
    state: "verified",
  },
  {
    id: "REQ-SS01-08",
    pillar: "Plant",
    title: "Certificate of Class",
    source: "DNV (IACS member)",
    check: "Valid; no overdue conditions of class.",
    state: "verified",
  },
  {
    id: "REQ-SS01-09",
    pillar: "Plant",
    title:
      "International Certificate of Fitness for the Carriage of Liquefied Gases in Bulk (IGC)",
    source: "Flag State / class on its behalf",
    check: "Valid; covers LNG cargo.",
    state: "pending",
  },
  {
    id: "REQ-SS01-10",
    pillar: "Plant",
    title: "SOLAS safety certificates (Construction, Equipment, Radio)",
    source: "Flag State / class",
    check: "Valid; not expiring within 6 months of the charter date.",
    state: "correction",
  },
  {
    id: "REQ-SS01-11",
    pillar: "Plant",
    title: "International Ship Security Certificate (ISSC)",
    source: "Flag State / RSO",
    check: "Valid.",
    state: "pending",
  },
  {
    id: "REQ-SS01-12",
    pillar: "Plant",
    title: "IOPP, IAPP and Ballast Water Management certificates",
    source: "Flag State / class",
    check: "Valid.",
    state: "pending",
  },
  {
    id: "REQ-SS01-13",
    pillar: "Plant",
    title: "Maritime Labour Certificate",
    source: "Flag State / RO",
    check: "Valid.",
    state: "pending",
  },
  {
    id: "REQ-SS01-14",
    pillar: "Process",
    title: "Document of Compliance and Safety Management Certificate (ISM)",
    source: "Flag State / RO",
    check: "Valid; company name matches the operator.",
    state: "verified",
  },
  {
    id: "REQ-SS01-15",
    pillar: "Process",
    title: "HSE plan for the charter",
    source: NORTHWIND_ORG,
    check: "Covers LNG cargo operations and emergency response.",
    state: "pending",
  },
  {
    id: "REQ-SS01-16",
    pillar: "Process",
    title: "Safety statistics (LTIF, TRCF) for the last 3 years",
    source: NORTHWIND_ORG,
    check: "Within the client threshold.",
    state: "pending",
  },
  {
    id: "REQ-SS01-17",
    pillar: "Process",
    title: "P&I certificate of entry and Hull & Machinery insurance",
    source: "Gard P&I / insurer",
    check: "Valid for the charter period; cover meets the client minimum.",
    state: "pending",
  },
  {
    id: "REQ-SS01-18",
    pillar: "Process",
    title: "Management of change procedure",
    source: NORTHWIND_ORG,
    check: "Current revision; approved.",
    state: "pending",
  },
  {
    id: "REQ-SS01-19",
    pillar: "Process",
    title: "Fremantle Port procedures",
    source: "Port / Northwind subcontractor",
    check: "Current edition; acknowledged by the Master.",
    state: "pending",
  },
  {
    id: "REQ-SS01-20",
    pillar: "Process",
    title: "Most recent third-party vetting inspection report (OCIMF SIRE 2.0)",
    source: "Inspection program",
    check: "Within the client age limit; observations closed.",
    state: "pending",
  },
];

const ss02Rows: EvidenceRow[] = [
  {
    id: "REQ-SS02-01",
    pillar: "People",
    title:
      "Seller's authorized signatories, with identity and power of attorney",
    source: MERIDIAN_ORG,
    check: "Signatory authorized to sell; identity verified.",
    state: "verified",
  },
  {
    id: "REQ-SS02-02",
    pillar: "People",
    title: "Buyer's delivery representative appointment",
    source: OIL_CO_ORG,
    check: "Named before delivery. Client-provided reference, read-only.",
    state: "verified",
  },
  {
    id: "REQ-SS02-03",
    pillar: "People",
    title: "Qualifications of the shipyard's QA / commissioning lead",
    source: MERIDIAN_ORG,
    check: "Relevant qualification and experience.",
    state: "verified",
  },
  {
    id: "REQ-SS02-04",
    pillar: "Plant",
    title: "Builder's certificate",
    source: MERIDIAN_ORG,
    check: "Hull number and particulars match the contract.",
    state: "verified",
  },
  {
    id: "REQ-SS02-05",
    pillar: "Plant",
    title: "Certificate of Class and class status report",
    source: AUSTRAL_ORG,
    check: "Valid; no outstanding conditions.",
    state: "verified",
  },
  {
    id: "REQ-SS02-06",
    pillar: "Plant",
    title: "Statutory certificates (Tonnage, Load Line, SOLAS, MARPOL, ISSC)",
    source: "Flag State / class",
    check: "Issued or provisional; valid at delivery.",
    state: "verified",
  },
  {
    id: "REQ-SS02-07",
    pillar: "Plant",
    title: "Sea trial and harbour acceptance test reports",
    source: `${MERIDIAN_ORG} / class`,
    check: "Completed; deficiencies closed.",
    state: "verified",
  },
  {
    id: "REQ-SS02-08",
    pillar: "Plant",
    title: "General arrangement plan and vessel photographs",
    source: MERIDIAN_ORG,
    check: "Matches the specification.",
    state: "verified",
  },
  {
    id: "REQ-SS02-09",
    pillar: "Plant",
    title: "Delivery condition survey report",
    source: XY_MARINE_ORG,
    check: "No significant findings.",
    state: "verified",
  },
  {
    id: "REQ-SS02-10",
    pillar: "Process",
    title: "Shipbuilding contract / memorandum of agreement",
    source: "Both parties, uploaded by the seller",
    check: "Parties, vessel and price match.",
    state: "verified",
  },
  {
    id: "REQ-SS02-11",
    pillar: "Process",
    title: "Bill of sale and protocol of delivery and acceptance",
    source: MERIDIAN_ORG,
    check: "Signed by an authorized signatory.",
    state: "verified",
  },
  {
    id: "REQ-SS02-12",
    pillar: "Process",
    title: "Certificate free of encumbrances (mortgage / lien)",
    source: "Registry / seller",
    check: "No registered encumbrances.",
    state: "verified",
  },
  {
    id: "REQ-SS02-13",
    pillar: "Process",
    title: "Deletion certificate or confirmation of no prior registration",
    source: "Registry",
    check: "Confirms the vessel is free to register.",
    state: "verified",
  },
  {
    id: "REQ-SS02-14",
    pillar: "Process",
    title: "Warranty terms and guarantee engineer arrangements",
    source: MERIDIAN_ORG,
    check: "Meet the contract terms.",
    state: "verified",
  },
];

const ss03Rows: EvidenceRow[] = [
  {
    id: "REQ-SS03-01",
    pillar: "People",
    title: "Loading master and terminal operator competency records",
    source: `${HARBOURLINE_ORG} / training providers`,
    check: "Current; cover LNG transfer operations.",
    state: "pending",
  },
  {
    id: "REQ-SS03-02",
    pillar: "People",
    title: "Mooring team and emergency response team training records",
    source: HARBOURLINE_ORG,
    check: "Current; team size meets the procedure.",
    state: "missing",
  },
  {
    id: "REQ-SS03-03",
    pillar: "People",
    title: "Port Facility Security Officer appointment",
    source: HARBOURLINE_ORG,
    check: "Named and current.",
    state: "pending",
  },
  {
    id: "REQ-SS03-04",
    pillar: "Plant",
    title: "Marine loading arm inspection and test certificates",
    source: "Manufacturer / inspection body",
    check: "Within the inspection interval.",
    state: "pending",
  },
  {
    id: "REQ-SS03-05",
    pillar: "Plant",
    title: "Emergency shutdown (ESD) system test records",
    source: HARBOURLINE_ORG,
    check: "Tested within the required interval; pass.",
    state: "missing",
  },
  {
    id: "REQ-SS03-06",
    pillar: "Plant",
    title: "Fire-fighting system inspection certificates",
    source: "Approved inspection body",
    check: "Valid.",
    state: "pending",
  },
  {
    id: "REQ-SS03-07",
    pillar: "Plant",
    title: "Mooring equipment and quick-release hook test records",
    source: HARBOURLINE_ORG,
    check: "Within the test interval.",
    state: "missing",
  },
  {
    id: "REQ-SS03-08",
    pillar: "Plant",
    title: "Gas detection calibration certificates",
    source: "Calibration provider",
    check: "Within the calibration date.",
    state: "missing",
  },
  {
    id: "REQ-SS03-09",
    pillar: "Plant",
    title: "Jetty structural inspection report",
    source: "Engineering consultant",
    check: "Within the inspection interval; no critical findings.",
    state: "missing",
  },
  {
    id: "REQ-SS03-10",
    pillar: "Process",
    title: "Terminal information booklet / port and terminal regulations",
    source: `${HARBOURLINE_ORG} / Port Authority`,
    check: "Current edition.",
    state: "pending",
    issuingAuthority: true,
  },
  {
    id: "REQ-SS03-11",
    pillar: "Process",
    title: "Ship-shore compatibility assessment for Northwind Aurora",
    source: HARBOURLINE_ORG,
    check: "Completed and accepted for LNGC Northwind Aurora.",
    state: "missing",
  },
  {
    id: "REQ-SS03-12",
    pillar: "Process",
    title: "Ship-shore safety checklist procedure",
    source: HARBOURLINE_ORG,
    check: "Approved; aligned with industry guidance.",
    state: "missing",
  },
  {
    id: "REQ-SS03-13",
    pillar: "Process",
    title: "Port facility security plan statement of compliance",
    source: "Port Authority / designated authority",
    check: "Valid; confirmed by the issuing authority.",
    state: "missing",
    issuingAuthority: true,
  },
  {
    id: "REQ-SS03-14",
    pillar: "Process",
    title: "Emergency response and spill response plans",
    source: HARBOURLINE_ORG,
    check: "Current; exercised within the last 12 months.",
    state: "missing",
  },
  {
    id: "REQ-SS03-15",
    pillar: "Process",
    title:
      "HSE statistics, insurance certificates and management of change procedure",
    source: `${HARBOURLINE_ORG} / insurer`,
    check: "Within thresholds; cover meets the client minimum.",
    state: "missing",
  },
];

/* SS-02 and SS-03 are already approved, so every task has a verified document. SS-01 stays with the verifier. */
function finishedRows(rows: EvidenceRow[]): EvidenceRow[] {
  return rows.map((row) => ({ ...row, state: "verified" }));
}

const ss01Evidence = buildEvidence(
  ss01Rows,
  10101,
  OIL_CO_AURORA_ID,
  "LNGC Northwind Aurora",
  "9694417",
  NORTHWIND_SUBMITTER,
  "Vessel",
);
const ss02Evidence = buildEvidence(
  finishedRows(ss02Rows),
  10201,
  OIL_CO_ENDEAVOUR_ID,
  "OSV Meridian Endeavour",
  "9941186",
  MERIDIAN_SUBMITTER,
  "Vessel",
);
const ss03Evidence = buildEvidence(
  finishedRows(ss03Rows),
  10301,
  OIL_CO_AURORA_ID,
  "LNGC Northwind Aurora",
  "9694417",
  HARBOURLINE_SUBMITTER,
  "Activity",
);

export const OIL_CO_PILOT_DOCUMENTS: MasterDocument[] = [
  ...ss01Evidence.documents,
  ...ss02Evidence.documents,
  ...ss03Evidence.documents,
];

export const OIL_CO_PILOT_USERS: UserProfile[] = [
  {
    id: "USR-228",
    name: OIL_CO_ADMIN,
    email: "a.okonkwo@oilco.example",
    roles: ["C Admin"],
    userType: "Organization",
    organization: OIL_CO_ORG,
    departmentOrScope: "Marine assurance for LNG field development",
    status: "Active",
    lastActive: "2026-10-12 01:10 UTC",
  },
  {
    id: "USR-229",
    name: XY_VERIFIER,
    email: "l.ferreira@xymarine.example",
    roles: ["Verifier"],
    userType: "Third-Party",
    organization: XY_MARINE_ORG,
    departmentOrScope: "LNG charter and terminal verification",
    status: "Active",
    lastActive: "2026-10-12 03:40 UTC",
  },
  {
    id: "USR-230",
    name: XY_APPROVER,
    email: "s.rahman@xymarine.example",
    roles: ["Approver"],
    userType: "Third-Party",
    organization: XY_MARINE_ORG,
    departmentOrScope: "Assurance approval",
    status: "Active",
    lastActive: "2026-10-12 04:05 UTC",
  },
  {
    id: "USR-231",
    name: XY_INSPECTOR,
    email: "h.blake@xymarine.example",
    roles: ["Inspector"],
    userType: "Third-Party",
    organization: XY_MARINE_ORG,
    departmentOrScope: "Pre-charter and delivery surveys",
    status: "Active",
    lastActive: "2026-10-11 22:15 UTC",
  },
  {
    id: "USR-232",
    name: MERIDIAN_SUBMITTER,
    email: "r.sato@meridianshipyards.example",
    roles: ["Submitter"],
    userType: "Organization",
    organization: MERIDIAN_ORG,
    departmentOrScope: "Newbuild delivery dossier",
    status: "Active",
    lastActive: "2026-10-11 06:20 UTC",
  },
  {
    id: "USR-233",
    name: AUSTRAL_VERIFIER,
    email: "p.nguyen@australclass.example",
    roles: ["Verifier"],
    userType: "Third-Party",
    organization: AUSTRAL_ORG,
    departmentOrScope: "Class status and survey records",
    status: "Active",
    lastActive: "2026-10-10 09:00 UTC",
  },
  {
    id: "USR-234",
    name: HARBOURLINE_SUBMITTER,
    email: "d.walsh@harbourline.example",
    roles: ["Submitter"],
    userType: "Organization",
    organization: HARBOURLINE_ORG,
    departmentOrScope: "LNG export terminal operations",
    status: "Active",
    lastActive: "2026-10-12 00:30 UTC",
  },
  {
    id: "USR-235",
    name: NORTHWIND_CLIENT,
    email: "t.okada@northwindmarine.com",
    roles: ["C Admin"],
    userType: "Organization",
    organization: NORTHWIND_ORG,
    departmentOrScope: "LNG bunker buying",
    status: "Active",
    lastActive: "2026-10-13 01:10 UTC",
  },
  {
    id: "USR-236",
    name: OIL_CO_SUBMITTER,
    email: "j.hale@oilco.example",
    roles: ["Submitter"],
    userType: "Organization",
    organization: OIL_CO_ORG,
    departmentOrScope: "Bunker fuel supply",
    status: "Active",
    lastActive: "2026-10-13 02:00 UTC",
  },
  {
    id: "USR-237",
    name: COASTAL_VERIFIER,
    email: "n.brooks@coastalfuel.example",
    roles: ["Verifier"],
    userType: "Third-Party",
    organization: COASTAL_ORG,
    departmentOrScope: "Independent fuel testing",
    status: "Active",
    lastActive: "2026-10-13 03:20 UTC",
  },
  {
    id: "USR-238",
    name: COASTAL_APPROVER,
    email: "c.almeida@coastalfuel.example",
    roles: ["Approver"],
    userType: "Third-Party",
    organization: COASTAL_ORG,
    departmentOrScope: "Bunker survey sign-off",
    status: "Active",
    lastActive: "2026-10-13 03:40 UTC",
  },
  {
    id: "USR-239",
    name: COASTAL_INSPECTOR,
    email: "f.ibarra@coastalfuel.example",
    roles: ["Inspector"],
    userType: "Third-Party",
    organization: COASTAL_ORG,
    departmentOrScope: "Bunker barge survey",
    status: "Active",
    lastActive: "2026-10-13 04:00 UTC",
  },
  {
    id: "USR-240",
    name: KESTREL_SUBMITTER,
    email: "a.petrov@kestrelcontrols.example",
    roles: ["Submitter"],
    userType: "Organization",
    organization: KESTREL_ORG,
    departmentOrScope: "Field control and safety systems",
    status: "Active",
    lastActive: "2026-10-12 08:15 UTC",
  },
  {
    id: "USR-241",
    name: SENTINEL_VERIFIER,
    email: "r.singh@sentinelcyber.example",
    roles: ["Verifier"],
    userType: "Third-Party",
    organization: SENTINEL_ORG,
    departmentOrScope: "IEC 62443 verification",
    status: "Active",
    lastActive: "2026-10-12 09:00 UTC",
  },
  {
    id: "USR-242",
    name: SENTINEL_INSPECTOR,
    email: "m.laurent@sentinelcyber.example",
    roles: ["Inspector"],
    userType: "Third-Party",
    organization: SENTINEL_ORG,
    departmentOrScope: "Site witness of control systems",
    status: "Active",
    lastActive: "2026-10-12 09:30 UTC",
  },
  {
    id: "USR-243",
    name: OIL_CO_APPROVER,
    email: "k.adeyemi@oilco.example",
    roles: ["Approver"],
    userType: "Organization",
    organization: OIL_CO_ORG,
    departmentOrScope: "OT security",
    status: "Active",
    lastActive: "2026-10-13 05:10 UTC",
  },
];

function pilotVessel(
  overrides: Partial<Vessel> &
    Pick<Vessel, "id" | "name" | "imoNumber" | "registeredOwner">,
): Vessel {
  return {
    officialRegNumber: "LNG-01-2024",
    mmsiNumber: "503812201",
    callSign: "VJQ7701",
    flagState: "Australia",
    portOfRegistry: "Fremantle, WA",
    status: "Active",
    complianceReadinessScore: 100,
    vesselType: "LNG Carrier",
    vesselSubtype: "Membrane LNGC",
    intendedUse: "LNG export from the Aurora field terminal",
    tradingArea: "Australian Continental Shelf",
    classificationSociety: "DNV",
    classNotation: "+100A1 Liquefied Gas Carrier",
    hullType: "Double Hull Membrane",
    ispsSolasStatus: "Fully Certified SOLAS/ISPS",
    yearBuilt: 2021,
    shipyardBuilder: "Hyundai Samho Heavy Industries",
    lengthOverallMeters: 290.0,
    beamMeters: 46.0,
    draftMeters: 11.8,
    grossTonnageGT: 114000,
    deadweightTonnageDWT: 96000,
    dynamicPositioningClass: "Not fitted",
    mainEnginePowerKW: "2x WinGD X-DF 12,400 kW",
    ownerType: "Corporate Entity",
    corporateRegistryNo: "ACN 661 220 418",
    ismCompany: overrides.registeredOwner,
    technicalManager: overrides.registeredOwner,
    docNumber: "DOC-DNV-2025-14",
    contact247: "+61 8 9100 2200 (24/7 Ops)",
    statutoryCertificates: [],
    hmInsurer: "NorthStandard",
    piClubName: "Gard P&I",
    policyNumber: "PI-LNG-2026-014",
    policyExpiryDate: "2027-10-31",
    safeManningComplement: 28,
    certifiedOfficersRatings: "10 Officers / 18 Ratings",
    masterName: "Capt. Elena Voss",
    lifeboatCapacity: 40,
    fuelType: "LNG / MGO",
    lowSulphurCompliant: true,
    bwtsSpec: "Alfa Laval PureBallast 3.2",
    owCalibrationDate: "2026-05-02",
    masterCertificateUploadCount: 8,
    clientHistory: [],
    ...overrides,
  };
}

export const OIL_CO_PILOT_VESSELS: Vessel[] = [
  pilotVessel({
    id: OIL_CO_AURORA_ID,
    name: "LNGC Northwind Aurora",
    imoNumber: "9694417",
    officialRegNumber: "LNGC-17-2021",
    mmsiNumber: "503812201",
    callSign: "VJQ7701",
    registeredOwner: NORTHWIND_ORG,
    ismCompany: NORTHWIND_ORG,
    technicalManager: NORTHWIND_ORG,
    masterName: "Capt. Elena Voss",
    complianceReadinessScore: 74,
    statutoryCertificates: [
      {
        id: "MAP-VES-2026-STAT-10107",
        name: "Certificate of Registry",
        certificateNumber: "LNG-10107",
        issuingBody: "Flag State",
        issueDate: "2026-04-01",
        expiryDate: "2028-11-30",
        status: "Valid",
      },
      {
        id: "MAP-VES-2026-STAT-10108",
        name: "Certificate of Class",
        certificateNumber: "LNG-10108",
        issuingBody: "DNV",
        issueDate: "2026-04-01",
        expiryDate: "2028-11-30",
        status: "Valid",
      },
    ],
    clientHistory: [
      {
        id: "CH-AURORA-01",
        clientOrganization: OIL_CO_ORG,
        charterTitle: "LNG Transport Charter",
        assuranceSetId: OIL_CO_SS01_ID,
        charterStart: "2026-11-15",
        charterEnd: "2027-05-14",
        outcome: "In Progress",
        notes: "Oil Company charter of LNGC Northwind Aurora.",
      },
    ],
  }),
  pilotVessel({
    id: OIL_CO_ENDEAVOUR_ID,
    name: "OSV Meridian Endeavour",
    imoNumber: "9941186",
    officialRegNumber: "OSV-ME-2026",
    mmsiNumber: "503812214",
    callSign: "VJQ7714",
    status: "Standby",
    registeredOwner: MERIDIAN_ORG,
    ismCompany: MERIDIAN_ORG,
    technicalManager: MERIDIAN_ORG,
    corporateRegistryNo: "ACN 774 018 332",
    vesselType: "Offshore Support Vessel (OSV)",
    vesselSubtype: "PSV / Field Support",
    intendedUse: "Field support for Oil Company LNG development",
    classificationSociety: "Austral Classification Society",
    classNotation: "+100A1 Offshore Supply, delivery class",
    yearBuilt: 2026,
    shipyardBuilder: MERIDIAN_ORG,
    lengthOverallMeters: 88.0,
    beamMeters: 19.0,
    draftMeters: 6.2,
    grossTonnageGT: 3900,
    deadweightTonnageDWT: 4200,
    dynamicPositioningClass: "DP2",
    mainEnginePowerKW: "2x 2,600 kW",
    safeManningComplement: 16,
    certifiedOfficersRatings: "6 Officers / 10 Ratings",
    masterName: "Delivery crew, not yet named",
    docNumber: "DOC-ACS-2026-02",
    contact247: "+61 8 9330 1400 (Meridian delivery desk)",
    complianceReadinessScore: 100,
    statutoryCertificates: [
      {
        id: "MAP-VES-2026-STAT-10205",
        name: "Certificate of Class and class status report",
        certificateNumber: "LNG-10205",
        issuingBody: "Austral Classification Society",
        issueDate: "2026-08-01",
        expiryDate: "2028-11-30",
        status: "Valid",
      },
      {
        id: "MAP-VES-2026-STAT-10204",
        name: "Builder's certificate",
        certificateNumber: "LNG-10204",
        issuingBody: "Meridian Shipyards",
        issueDate: "2026-08-01",
        expiryDate: "2028-11-30",
        status: "Valid",
      },
    ],
  }),
];

export const OIL_CO_PILOT_ASSURANCE_SETS: AssuranceSet[] = [
  {
    id: OIL_CO_SS01_ID,
    title: "LNG Transport Charter",
    assuranceType: "Vessel",
    subtypes: ["Vessel"],
    projectId: OIL_CO_LNG_PROJECT_ID,
    projectName: "Oil Company LNG Field Development",
    vesselId: OIL_CO_AURORA_ID,
    vesselName: "LNGC Northwind Aurora",
    imoNumber: "9694417",
    visibility: "organization",
    initiatorOrg: OIL_CO_ORG,
    initiatorRole: "C Admin · Client Created",
    createdByPersona: "C Admin",
    createdByName: OIL_CO_ADMIN,
    charterer: OIL_CO_ORG,
    clientOrg: OIL_CO_ORG,
    serviceProviderOrg: NORTHWIND_ORG,
    charterWindowStart: "2026-11-15",
    complianceDeadline: "2026-11-15",
    charterWindowEnd: "2027-05-14",
    stage: "Verification",
    readinessScore: 48,
    mandatoryInspectionRequired: true,
    inspectionCompleted: false,
    verificationRequired: true,
    formalApprovalRequired: true,
    assignedSubmitter: label(NORTHWIND_SUBMITTER, NORTHWIND_ORG),
    assignedVerifier: label(XY_VERIFIER, XY_MARINE_ORG),
    assignedInspector: label(XY_INSPECTOR, XY_MARINE_ORG),
    assignedApprover: label(XY_APPROVER, XY_MARINE_ORG),
    approverDecision: "Pending",
    reviewMode: "third_party",
    reviewChannels: ["third_party"],
    requirements: ss01Evidence.requirements,
    stakeholders: {
      submitterId: "USR-102",
      submitterName: NORTHWIND_SUBMITTER,
      submitterOrg: NORTHWIND_ORG,
      verifierId: "USR-229",
      verifierName: XY_VERIFIER,
      verifierOrg: XY_MARINE_ORG,
      inspectorId: "USR-231",
      inspectorName: XY_INSPECTOR,
      inspectorOrg: XY_MARINE_ORG,
      approverId: "USR-230",
      approverName: XY_APPROVER,
      approverOrg: XY_MARINE_ORG,
    },
  },
  {
    id: OIL_CO_SS02_ID,
    title: "Vessel Purchase (OSV)",
    assuranceType: "Vessel",
    subtypes: ["Vessel"],
    projectId: OIL_CO_LNG_PROJECT_ID,
    projectName: "Oil Company LNG Field Development",
    vesselId: OIL_CO_ENDEAVOUR_ID,
    vesselName: "OSV Meridian Endeavour",
    imoNumber: "9941186",
    visibility: "organization",
    initiatorOrg: OIL_CO_ORG,
    initiatorRole: "C Admin · Client Created",
    createdByPersona: "C Admin",
    createdByName: OIL_CO_ADMIN,
    charterer: OIL_CO_ORG,
    clientOrg: OIL_CO_ORG,
    serviceProviderOrg: MERIDIAN_ORG,
    charterWindowStart: "2027-03-01",
    complianceDeadline: "2027-03-01",
    charterWindowEnd: "2027-03-31",
    stage: "Approved",
    readinessScore: 100,
    mandatoryInspectionRequired: true,
    inspectionCompleted: true,
    verificationRequired: true,
    formalApprovalRequired: true,
    assignedSubmitter: label(MERIDIAN_SUBMITTER, MERIDIAN_ORG),
    assignedVerifier: label(AUSTRAL_VERIFIER, AUSTRAL_ORG),
    assignedInspector: label(XY_INSPECTOR, XY_MARINE_ORG),
    assignedApprover: label(XY_APPROVER, XY_MARINE_ORG),
    approverDecision: "Approved",
    reviewMode: "third_party",
    reviewChannels: ["third_party"],
    requirements: ss02Evidence.requirements,
    stakeholders: {
      submitterId: "USR-232",
      submitterName: MERIDIAN_SUBMITTER,
      submitterOrg: MERIDIAN_ORG,
      verifierId: "USR-233",
      verifierName: AUSTRAL_VERIFIER,
      verifierOrg: AUSTRAL_ORG,
      inspectorId: "USR-231",
      inspectorName: XY_INSPECTOR,
      inspectorOrg: XY_MARINE_ORG,
      approverId: "USR-230",
      approverName: XY_APPROVER,
      approverOrg: XY_MARINE_ORG,
    },
  },
  {
    id: OIL_CO_SS03_ID,
    title: "Terminal / Loading Operations",
    assuranceType: "Activity",
    subtypes: ["Activity"],
    projectId: OIL_CO_LNG_PROJECT_ID,
    projectName: "Oil Company LNG Field Development",
    activityId: "MAP-ACT-2026-LNG-001",
    activityName: "Harbourline LNG export terminal loading",
    vesselId: OIL_CO_AURORA_ID,
    vesselName: "LNGC Northwind Aurora",
    imoNumber: "9694417",
    visibility: "organization",
    initiatorOrg: OIL_CO_ORG,
    initiatorRole: "C Admin · Client Created",
    createdByPersona: "C Admin",
    createdByName: OIL_CO_ADMIN,
    charterer: OIL_CO_ORG,
    clientOrg: OIL_CO_ORG,
    serviceProviderOrg: HARBOURLINE_ORG,
    charterWindowStart: "2026-11-01",
    complianceDeadline: "2026-11-01",
    charterWindowEnd: "2027-06-30",
    stage: "Approved",
    readinessScore: 100,
    mandatoryInspectionRequired: false,
    inspectionCompleted: false,
    verificationRequired: true,
    formalApprovalRequired: true,
    assignedSubmitter: label(HARBOURLINE_SUBMITTER, HARBOURLINE_ORG),
    assignedVerifier: label(XY_VERIFIER, XY_MARINE_ORG),
    assignedApprover: label(XY_APPROVER, XY_MARINE_ORG),
    approverDecision: "Approved",
    reviewMode: "mixed",
    reviewChannels: ["third_party", "issuing_authority"],
    authorityValidationMethod: "manual",
    requirements: ss03Evidence.requirements,
    stakeholders: {
      submitterId: "USR-234",
      submitterName: HARBOURLINE_SUBMITTER,
      submitterOrg: HARBOURLINE_ORG,
      verifierId: "USR-229",
      verifierName: XY_VERIFIER,
      verifierOrg: XY_MARINE_ORG,
      approverId: "USR-230",
      approverName: XY_APPROVER,
      approverOrg: XY_MARINE_ORG,
    },
  },
];

export const OIL_CO_PILOT_PROJECT: Project = {
  id: OIL_CO_LNG_PROJECT_ID,
  name: "Oil Company LNG Field Development",
  projectType: "Mixed / Composite",
  requestingOrganization: OIL_CO_ORG,
  clientOperator: OIL_CO_ORG,
  ownerOrganization: OIL_CO_ORG,
  operatorOrganization: OIL_CO_ORG,
  charterer: OIL_CO_ORG,
  invitedOrganizations: [NORTHWIND_ORG, OIL_CO_ORG],
  location: "Aurora LNG Field, offshore Western Australia",
  description:
    "Master project for the Oil Company LNG field development. SS-01 charters LNGC Northwind Aurora from Northwind Marine. SS-02 buys OSV Meridian Endeavour from Meridian Shipyards. SS-03 assures Harbourline Terminals can load that carrier. SS-04 and SS-05 are not seeded: Northwind creates the bunker set after Oil Company requests it, and Oil Company creates the control-systems set.",
  primaryVesselId: OIL_CO_AURORA_ID,
  riskProfile: "Elevated",
  workLocationType: "Mixed",
  charterWindowStart: "2026-11-01",
  charterWindowEnd: "2027-12-31",
  status: "Assurance In Progress",
  readinessScore: 83,
  assetLinks: [
    {
      id: "PAL-017A",
      projectId: OIL_CO_LNG_PROJECT_ID,
      assetType: "Vessel",
      assetId: OIL_CO_AURORA_ID,
      assetName: "LNGC Northwind Aurora",
      providerOrganization: NORTHWIND_ORG,
      assuranceSetId: OIL_CO_SS01_ID,
      roleInProject: "LNG export carrier",
      addedAt: "2026-10-01T00:00:00Z",
      addedByPersona: "C Admin",
      notes: "LNG Transport Charter",
    },
    {
      id: "PAL-017B",
      projectId: OIL_CO_LNG_PROJECT_ID,
      assetType: "Vessel",
      assetId: OIL_CO_ENDEAVOUR_ID,
      assetName: "OSV Meridian Endeavour",
      providerOrganization: MERIDIAN_ORG,
      assuranceSetId: OIL_CO_SS02_ID,
      roleInProject: "Newbuild field support vessel",
      addedAt: "2026-10-01T00:00:00Z",
      addedByPersona: "C Admin",
      notes: "Vessel Purchase (OSV)",
    },
  ],
};

export const OIL_CO_PILOT_AUDIT: AuditTrailEvent[] = [
  {
    id: "AUD-90510",
    timestampUtc: "2026-10-01T01:00:00Z",
    userId: "USR-228",
    userRole: "C Admin",
    organization: OIL_CO_ORG,
    action: "Created Master Project",
    targetAsset: "MAP-PROJ-2026-MARINE-017 (Oil Company LNG Field Development)",
    justificationNotes:
      "Opened the LNG field development master project with SS-01, SS-02 and SS-03. SS-04 and SS-05 are left open so they can be created in the demonstration.",
  },
  {
    id: "AUD-90511",
    timestampUtc: "2026-10-08T02:10:00Z",
    userId: "USR-102",
    userRole: "Submitter",
    organization: NORTHWIND_ORG,
    action: "Submitted Charter Evidence",
    targetAsset: "AS-2026-101 (LNG Transport Charter)",
    justificationNotes:
      "Uploaded class, registry, ISM, crew list and certificates of competency for LNGC Northwind Aurora.",
  },
  {
    id: "AUD-90512",
    timestampUtc: "2026-10-09T06:20:00Z",
    userId: "USR-229",
    userRole: "Verifier",
    organization: XY_MARINE_ORG,
    action: "Returned SOLAS Radio Certificate",
    targetAsset: "MAP-VES-2026-STAT-10110 (SOLAS safety certificates)",
    documentStatusDelta: {
      documentId: "MAP-VES-2026-STAT-10110",
      oldStatus: "Pending Verification",
      newStatus: "Correction Requested",
    },
    justificationNotes:
      "SOLAS certificates expire inside the charter buffer and were returned for correction. The rest of the charter evidence is still with the verifier.",
  },
  {
    id: "AUD-90513",
    timestampUtc: "2026-10-10T04:00:00Z",
    userId: "USR-233",
    userRole: "Verifier",
    organization: AUSTRAL_ORG,
    action: "Verified Class and Statutory Dossier",
    targetAsset: "AS-2026-102 (Vessel Purchase (OSV))",
    justificationNotes:
      "Class status, statutory certificates and the delivery survey for OSV Meridian Endeavour are verified, and SS-02 is approved.",
  },
  {
    id: "AUD-90514",
    timestampUtc: "2026-10-12T00:40:00Z",
    userId: "USR-234",
    userRole: "Submitter",
    organization: HARBOURLINE_ORG,
    action: "Submitted Terminal Evidence",
    targetAsset: "AS-2026-103 (Terminal / Loading Operations)",
    justificationNotes:
      "Harbourline submitted the remaining terminal evidence, XY Marine verified it, and SS-03 is approved.",
  },
];

export const OIL_CO_PILOT_NOTIFICATIONS: AppNotification[] = [
  {
    id: "MAP-NTF-2026-VERF-00031",
    type: "review_requested",
    subject: "Verify LNG Transport Charter",
    message:
      "Northwind has submitted vessel, crew and ISM evidence for LNGC Northwind Aurora. SOLAS radio is already back for correction.",
    recipientUserId: "USR-229",
    senderUserId: "USR-228",
    senderName: OIL_CO_ADMIN,
    projectId: OIL_CO_LNG_PROJECT_ID,
    projectName: "Oil Company LNG Field Development",
    status: "unread",
    createdAt: "2026-10-09T06:30:00.000Z",
    assuranceSetId: OIL_CO_SS01_ID,
    vesselName: "LNGC Northwind Aurora",
    assignedRole: "Verifier",
  },
  {
    id: "MAP-NTF-2026-VERF-00032",
    type: "document_correction",
    subject: "SOLAS certificates expire inside the charter buffer",
    message:
      "Renew or extend the SOLAS radio certificate. It expires on 1 Mar 2027, inside six months of the 15 Nov 2026 laycan.",
    recipientUserId: "USR-102",
    senderUserId: "USR-229",
    senderName: XY_VERIFIER,
    projectId: OIL_CO_LNG_PROJECT_ID,
    projectName: "Oil Company LNG Field Development",
    status: "unread",
    createdAt: "2026-10-09T06:25:00.000Z",
    assuranceSetId: OIL_CO_SS01_ID,
    documentId: "MAP-VES-2026-STAT-10110",
    vesselName: "LNGC Northwind Aurora",
    assignedRole: "Submitter",
  },
  {
    id: "MAP-NTF-2026-APRV-00033",
    type: "approval_requested",
    subject: "Approve Vessel Purchase (OSV)",
    message:
      "Austral Classification Society has verified the Meridian Endeavour delivery dossier. Delivery survey is complete.",
    recipientUserId: "USR-230",
    senderUserId: "USR-233",
    senderName: AUSTRAL_VERIFIER,
    projectId: OIL_CO_LNG_PROJECT_ID,
    projectName: "Oil Company LNG Field Development",
    status: "actioned",
    readAt: "2026-10-14T02:00:00.000Z",
    actionedAt: "2026-10-14T02:00:00.000Z",
    createdAt: "2026-10-10T04:10:00.000Z",
    assuranceSetId: OIL_CO_SS02_ID,
    vesselName: "OSV Meridian Endeavour",
    assignedRole: "Approver",
  },
  {
    id: "MAP-NTF-2026-ASGN-00034",
    type: "stakeholder_assigned",
    subject: "Submit remaining terminal evidence",
    message:
      "Oil Company is waiting on ESD tests, mooring records, ship-shore compatibility for Northwind Aurora, and the port facility security statement.",
    recipientUserId: "USR-234",
    senderUserId: "USR-228",
    senderName: OIL_CO_ADMIN,
    projectId: OIL_CO_LNG_PROJECT_ID,
    projectName: "Oil Company LNG Field Development",
    status: "actioned",
    readAt: "2026-10-14T02:00:00.000Z",
    actionedAt: "2026-10-14T02:00:00.000Z",
    createdAt: "2026-10-12T00:45:00.000Z",
    assuranceSetId: OIL_CO_SS03_ID,
    vesselName: "LNGC Northwind Aurora",
    assignedRole: "Submitter",
  },
];
