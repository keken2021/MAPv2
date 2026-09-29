# Marine Assurance Platform (MAP) — Data Creation Input Specifications and Validations

/* 
  file summary: comprehensive data input specifications, parameter bounds, validation rules, and ui controls for map data creation across all operational modules.
  responsibilities: defines exact payload schemas, field types, duplicate-check algorithms, extraction attributes, and authorized personas for all input forms.
  role in system: specification reference ensuring strict input validation, data integrity, and compliance with the brd and rbac permission engine.
*/

## 1. Vessel Registration Data Creation (UC-02)

- **Target UI Screen**: Vessel Registration Form (`/vessels/register` or `VesselDetailView.tsx` Add Modal)
- **Authorized Role**: Platform Administrator (`Administrator` ONLY)
- **Duplicate Prevention Validations**:
  - `imoNumber`: Exactly 7 digits. Checked against registered vessels in `state.vessels`. Duplicate values immediately halt registration with an error alert.
  - `officialRegNumber`: Alphanumeric string. Checked against existing fleet records.
  - `mmsiNumber`: Exactly 9 digits. Checked for uniqueness.
  - `callSign`: Unique radio call sign.
- **Unassigned Certificate Linking**: When registering a vessel or uploading statutory certificates, certificates must be drawn from unassigned unique certificates in the Document Library or uploaded as a new unique document (`DOC-XXX`). No certificate may be assigned to multiple vessels simultaneously.

### 11 Information Categories & Detailed Input Schema:

1. **Category 1 — Vessel Identification**:
   - `name`: String (e.g. `MV Torrens Supporter`) — *Required*
   - `previousNames`: String — *Optional*
   - `imoNumber`: 7-digit numeric string (e.g. `9634721`) — *Required / Unique*
   - `officialRegNumber`: Alphanumeric string (e.g. `OSV-44-2019`) — *Required / Unique*
   - `mmsiNumber`: 9-digit numeric string (e.g. `503728940`) — *Required / Unique*
   - `callSign`: Alphanumeric string (e.g. `VJQ4821`) — *Required / Unique*
   - `flagState`: Country name dropdown (e.g. `Australia`, `Singapore`, `United Kingdom`) — *Required*
   - `portOfRegistry`: Port city and state (e.g. `Fremantle, WA`) — *Required*
   - `status`: Select dropdown (`In Operations`, `In Transit`, `Dry Docking`, `Lay-up`, `Port Stay`, `Under Charter`) — *Default: 'Port Stay'*

2. **Category 2 — Classification & Notation**:
   - `classificationSociety`: Select dropdown (`DNV`, `ABS`, `Lloyd's Register`, `Bureau Veritas`, `RINA`) — *Required*
   - `classNotation`: String (e.g. `+100A1 Offshore Support Vessel, DP2`) — *Required*
   - `hullType`: String (e.g. `Double Bottom / Double Side Steel`) — *Required*
   - `vesselType`: Select dropdown (e.g. `Offshore Support Vessel (OSV)`, `Anchor Handling Tug Supply (AHTS)`, `Platform Supply Vessel (PSV)`) — *Required*
   - `vesselSubtype`: String (e.g. `AHTS / PSV Dynamic Positioning`) — *Required*
   - `intendedUse`: String (e.g. `Offshore Supply & Deepwater Towing`) — *Required*
   - `tradingArea`: String (e.g. `International / Australian Waters`) — *Required*
   - `ispsSolasStatus`: String (e.g. `Fully Compliant / Certified`) — *Required*

3. **Category 3 — Construction & Dimensions**:
   - `yearBuilt`: 4-digit integer (e.g. `2019`) — *Required*
   - `shipyardBuilder`: String (e.g. `Damen Shipyards Group`) — *Required*
   - `lengthOverallMeters`: Float in meters (e.g. `83.4`) — *Required*
   - `beamMeters`: Float in meters (e.g. `18.0`) — *Required*
   - `draftMeters`: Float in meters (e.g. `5.8`) — *Required*

4. **Category 4 — Tonnage & Propulsion**:
   - `grossTonnageGT`: Integer in Gross Tons (e.g. `3250`) — *Required*
   - `deadweightTonnageDWT`: Integer in Deadweight Tons (e.g. `4100`) — *Required*
   - `dynamicPositioningClass`: Select dropdown (e.g. `DP2 (Kongsberg K-Pos)`) — *Required*
   - `mainEnginePowerKW`: String (e.g. `2x 2400 kW Wärtsilä 6L26`) — *Required*

5. **Category 5 — Ownership & Management**:
   - `registeredOwner`: String (e.g. `Pacific Ocean Logistics Pty Ltd`) — *Required*
   - `ownerType`: String (e.g. `Corporate Entity / Vessel Operator`) — *Required*
   - `corporateRegistryNo`: String (e.g. `ACN 894 123 765`) — *Required*
   - `ismCompany`: String (e.g. `Ocean Fleet Management Services`) — *Required*
   - `technicalManager`: String (e.g. `Pacific Ship Management Ltd`) — *Required*
   - `docNumber`: String (Document of Compliance Number) — *Required*
   - `contact247`: Phone string (e.g. `+61 8 9234 5678 (24/7 Ops)`) — *Required*

6. **Category 6 — Statutory Certificates & Expiries**:
   - `statutoryCertificates`: Array of statutory certificates (Certificate of Class, Cargo Ship Safety Equipment, Load Line, Marpol Annex I-VI).
   - Fields per certificate: `certificateNumber`, `issuingBody`, `issueDate`, `expiryDate`, `status` (`Valid` | `Expiring Soon` | `Expired`).

7. **Category 7 — Insurance & P&I Coverage**:
   - `hmInsurer`: String (Hull & Machinery Insurer) — *Required*
   - `piClubName`: Select / String (e.g. `Gard P&I Club`, `NorthStandard`, `Skuld`) — *Required*
   - `policyNumber`: String (e.g. `PI-2026-88492`) — *Required*
   - `policyExpiryDate`: ISO Date string — *Required*

8. **Category 8 — Crew & Safety Information**:
   - `safeManningComplement`: Integer (e.g. `14`) — *Required*
   - `certifiedOfficersRatings`: String (e.g. `6 Officers / 8 Ratings`) — *Required*
   - `masterName`: String (e.g. `Capt. Alexander Wright`) — *Must match registered Master in Crew Directory*
   - `lifeboatCapacity`: Integer total capacity (e.g. `30 persons`) — *Required*

9. **Category 9 — Environmental & Energy Efficiency**:
   - `fuelType`: String (e.g. `MGO / VLSFO Low Sulphur`) — *Required*
   - `lowSulphurCompliant`: Boolean toggle — *Required*
   - `bwtsSpec`: String (Ballast Water Treatment System specification) — *Required*
   - `owCalibrationDate`: ISO Date string (15ppm Oil-Water Separator calibration date) — *Required*

10. **Category 10 — Operating Status & Readiness Gating**:
    - Status changes to `In Transit` or `Under Charter` require `complianceReadinessScore === 100` and `stage === 'Approved'`.

11. **Category 11 — Document Attachments**:
    - PDF/ZIP file uploads linked to `MasterDocument` entries.

---

## 2. Assurance Set Creation Data Creation (UC-03 / UC-11)

- **Target UI Screen**: Create Assurance Set View (`/assurance-sets/create` or `CreateAssuranceSetView.tsx`)
- **Authorized Roles**: Administrator (`Administrator`) & C Admin (`C Admin`)
- **Input Fields**:
  1. `vesselId`: Dropdown select from registered vessels in `state.vessels` — *Required*
  2. `title`: Campaign title string (e.g. `Southern Basin Offshore Charter 2026`) — *Required*
  3. `charterer`: Chartering organization name (e.g. `Chevron Gorgon Project`, `Woodside Energy`) — *Required*
  4. `charterWindowStart`: ISO Date picker — *Required*
  5. `charterWindowEnd`: ISO Date picker (must be after `charterWindowStart`) — *Required*
  6. `mandatoryInspectionRequired`: Boolean toggle (Mandatory On-Site Physical Survey vs Document-Only) — *Required*
  7. `requirements`: Matrix checklist selection with individual toggles:
     - Certificate of Class (Statutory)
     - Cargo Ship Safety Equipment (Statutory SOLAS)
     - International Load Line Certificate (Statutory)
     - Safe Manning Document & Master STCW CoC (Crew)
     - Chief Engineer STCW Reg III/2 CoC (Crew)
     - Dynamic Positioning DP Log Book (Crew)
     - OVID / IMCA Inspection Report (Inspection)
     - MARPOL Annex I-VI Prevention Certificate (Environmental)
  8. `assignedStakeholders`: Selection of Submitter, Verifier, Inspector, and Approver personas.

---

## 3. Crew Profile & STCW Credential Data Creation (Crew Directory)

- **Target UI Screen**: Crew Directory (`/crew`) & Crew Modal (`CrewModal.tsx` / `CrewDocumentUploadModal.tsx`)
- **Authorized Roles**: Administrator (`Administrator`) & Submitter (`Submitter`)
- **Input Fields**:
  1. `fullName`: Text string (e.g. `Capt. Alexander Wright`) — *Required*
  2. `rank`: Select dropdown (`Master / Ship Captain`, `Chief Engineer`, `Chief Officer`, `2nd Engineer`, `Bosun`, `AB Seaman`) — *Required*
  3. `nationality`: Country name string — *Required*
  4. `seamansBookNo`: Unique Seaman's Discharge Book number (e.g. `SB-UK-904128`) — *Required / Unique*
  5. `passportNo`: Unique Passport number (e.g. `UK-PP-78291044`) — *Required / Unique*
  6. `dateOfBirth`: ISO Date string — *Required*
  7. `emergencyContact`: Phone & relationship string — *Required*
  8. `currentVesselId`: Optional vessel assignment select.
  9. **Layer 1 Core Documents & Layer 2 Endorsements**:
     - `title`: Certificate title string — *Required*
     - `layer`: Select (`Layer 1 - Universal Core` vs `Layer 2 - Vessel Specific & Endorsements`)
     - `stcwRegulation`: STCW Regulation reference (e.g. `STCW II/2`, `STCW VI/1`, `STCW V/1-1`)
     - `certificateNo`: Unique certificate reference string (e.g. `UK-MCA-2021-9941`)
     - `issuingAuthority`: Authority name (e.g. `UK Maritime and Coastguard Agency (MCA)`)
     - `issueDate`: ISO Date string
     - `expiryDate`: ISO Date string
     - `file`: Attachment upload (PDF, PNG, JPG)
- **Automatic Synchronization**: Creating or adding a crew certificate immediately triggers `useMapStore.addCrewDocument()`, which constructs and prepends a matching `MasterDocument` record with 11 `crewAttributes` to `state.documents` in the Document Library.

---

## 4. Document Upload & Metadata Extraction Data Creation (UC-05 / BR-5)

- **Target UI Screen**: Document Library (`/documents`), Document Upload Drawer (`#mapAddDocModal`), and Vessel Detail Attachments.
- **Authorized Roles**: Administrator (`Administrator`) & Submitter (`Submitter`)
- **Prohibited Role**: C Admin (`C Admin`) is strictly blocked from uploading, editing, or deleting provider documents.
- **Input Fields**:
  1. `title`: Document title string — *Required*
  2. `entityType`: Radio selector (`Vessel Certificate` vs `Crew Certificate`) — *Required*
  3. `vesselId`: Target vessel selector — *Required*
  4. `certificateNo`: Alphanumeric certificate string — *Auto-extracted via OCR / Editable*
  5. `issuingAuthority`: Issuing body string (DNV, ABS, AMSA, MCA) — *Auto-extracted / Editable*
  6. `expiryDate`: Expiry calendar picker — *Auto-extracted / Editable*
  7. `file`: Digital document attachment ($\ge 200\text{ DPI}$ PDF/PNG/JPG/ZIP) — *Required*
  8. `versionLabel`: Automatically assigned (`v1.0` on creation, `v1.1+` on re-submission).
  9. `changeSummary`: Description of update or rectification notes on re-uploads.

---

## 5. Physical Survey Findings & CAPA Data Creation (UC-09)

- **Target UI Screen**: Inspector Workspace (`/inspector`) & Inspection Checklist View (`/inspections/:id`)
- **Authorized Role**: Inspector (`Inspector` ONLY)
- **Input Fields**:
  1. `overallOutcome`: Select (`Satisfactory`, `Pass with Observations`, `Deficiency Flagged`, `Pending Inspection`)
  2. `inspectionDate`: ISO Date string
  3. `summaryNotes`: Multiline text summary of physical survey findings.
  4. `checklistItemFindings`:
     - `section`: Hull, Machinery, LSA/FFA, Navigation Bridge, Environmental, Cargo Gear.
     - `status`: Select (`Satisfactory`, `Observation`, `Deficiency`).
     - `findingsText`: Detailed survey notes and observations.
     - `evidencePhotos`: Multi-file upload for photographic evidence and test reports.
  5. `capaItem`:
     - `title`: Non-conformance title string (e.g. `Lifeboat Release Hook Annual Servicing Overdue`)
     - `findingDescription`: Detailed finding description and regulatory standard breach.
     - `owner`: Responsible entity (e.g. `Vessel Technical Superintendent`)
     - `dueDate`: ISO Date for mandatory corrective closeout.

---

## 6. Verification & Approval Gate Input Specifications (UC-08 / UC-10)

- **Target UI Screens**: Verifier Workspace (`/verifier`) & Approver Dashboard (`/approver`)
- **Authorized Roles**: Verifier (`Verifier`) for verification; Approver (`Approver`) for executive gate sign-off.
- **Input Fields**:
  1. **Verifier Decision**:
     - `decision`: Select (`Verify & Route to Approval`, `Verify & Route to Inspector`, `Request Correction`, `Reject`)
     - `comments`: Mandatory multiline text when requesting correction or rejecting.
     - `metadataValidation`: Confirmation checkboxes for 13 vessel / 11 crew attributes.
  2. **Approver Gate Decision**:
     - `decision`: Select (`Approve Assurance Set`, `Return for Correction`, `Reject Campaign`)
     - `executiveNotes`: Formal sign-off rationale, authorization comments, and charter certification notes.
