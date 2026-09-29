# Marine Assurance Platform (MAP) — Comprehensive Use Case Specifications

/* 
  file summary: exhaustive specification of all 12 core use cases (uc-01 to uc-12) for the marine assurance platform (map).
  responsibilities: defines actors, preconditions, step-by-step workflows, screens involved, affected data entities, matrix permissions, expected outputs, and exception flows.
  role in system: primary system specification blueprint aligning business requirements, architectural workflows, and testing suites.
*/

## 1. Use Case Summary Table

| Use Case ID | Name | Primary Actor | Screens Involved | Data Affected | Matrix Scope |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **UC-01** | User Login & Authentication | All Personas | `LoginView` | `UserProfile`, `AuditTrailEvent` | `dashboard` |
| **UC-02** | Register Vessel | Administrator | `VesselDetailView` / Register Modal | `VesselInformation`, `MasterDocument` | `vessels`, `vessel_status` |
| **UC-03** | Create Assurance Set (Provider) | Administrator | `CreateAssuranceSetView` | `AssuranceSet`, `AssuranceRequirement` | `assurance_sets`, `assurance_requirements` |
| **UC-04** | Assign Workflow Roles | Administrator | `UserManagementView`, `AssuranceDetailView` | `AssuranceSet.stakeholders`, `UserProfile` | `workflow_assignment`, `third_party_delegation` |
| **UC-05** | Upload Vessel & Crew Documents | Submitter | `DocumentLibraryView`, `CrewView` | `MasterDocument`, `DocumentVersion`, `CrewMember` | `documents`, `document_vault`, `crew_certificates` |
| **UC-06** | Extract & Validate Document Data | System / OCR | Background Service / OCR Engine | `MasterDocument`, `ValidationRuleStatus` | `ocr_results`, `validation_thresholds` |
| **UC-07** | Notify & Resolve Issues | System & Submitter | Notification Drawer, `DocumentDetailView` | `MasterDocument.complianceState`, `AuditTrailEvent` | `document_exceptions` |
| **UC-08** | Verify Document | Verifier | `VerifierWorkspaceView` | `MasterDocument`, `AssuranceRequirement` | `verification_queue`, `verification_decisions` |
| **UC-09** | Physical Inspection & CAPA | Inspector | `InspectorWorkspaceView`, `InspectionChecklistView` | `CapaItem`, `AssuranceSet.inspectionCompleted` | `inspection_workspace`, `inspection_findings`, `capa` |
| **UC-10** | Approve Assurance Set | Approver | `ApproverDashboardView` | `AssuranceSet.stage`, `Vessel.status` | `approval_gate`, `approval_decisions`, `assurance_completion` |
| **UC-11** | C Admin Create Set & Review | C Admin | `CreateAssuranceSetView`, `CapaManagementView` | `AssuranceSet`, `CapaItem.cadminFlagReason` | `assurance_sets`, `post_inspection_review` |
| **UC-12** | RBAC Matrix & Overrides | Administrator | `RolesAndPermissionsView` | `RolePermissionMatrix`, `UserPermissionOverrides` | `role_rights` |

---

## 2. Detailed Use Case Breakdown

### UC-01: User Login & Role Routing
- **Primary Actor(s)**: Administrator, C Admin, Submitter, Verifier, Inspector, Approver.
- **Preconditions**: User account exists in `state.users` with active status.
- **Workflow Steps**:
  1. User navigates to `#/login` and enters credentials or selects persona quick-switcher.
  2. System verifies credentials against `state.users`.
  3. System resolves user's primary persona and calculates effective CRUD permissions.
  4. System redirects user to their designated dashboard (`/dashboard` for Admin/Submitter, `/verifier` for Verifier, `/inspector` for Inspector, `/approver` for Approver).
  5. Session start is logged to `AuditTrailEvent`.
- **Expected Output**: Authenticated session established; role-specific sidebar navigation items rendered.
- **Exceptions**: Invalid credentials display error alert; suspended user blocked; unassigned role redirected to access-denied state.

---

### UC-02: Register Vessel
- **Primary Actor(s)**: Administrator (Vessel Provider Admin ONLY).
- **Preconditions**: Admin is authenticated; asset data is available.
- **Workflow Steps**:
  1. Admin opens Vessel Registration Modal from Fleet Registry (`#/vessels`).
  2. Admin enters data across 11 Information categories (identification, classification, construction, tonnage, ownership, statutory certificates, insurance, crew, environmental).
  3. System validates IMO Number (7 digits) and Official Registration Number against existing vessels in `state.vessels`.
  4. Admin selects unassigned statutory certificates from the Master Document Library or uploads new unique files.
  5. Admin submits registration form.
  6. System creates `VesselInformation` object in `state.vessels` and logs `AuditTrailEvent`.
- **Expected Output**: Unique master vessel record created; visible across Fleet Registry and Vessel Details.
- **Exceptions**: Duplicate IMO or Official Registration Number halts creation with error notification.

---

### UC-03: Create Assurance Set (Provider Initiated)
- **Primary Actor(s)**: Administrator (Vessel Provider).
- **Preconditions**: Target vessel exists in `state.vessels`.
- **Workflow Steps**:
  1. Admin opens Create Assurance Set View (`#/assurance-sets/create`).
  2. Admin selects target vessel and enters campaign title and charter window dates.
  3. Admin toggles required statutory, crew, environmental, and inspection criteria.
  4. Admin assigns participating stakeholders (Submitter, Verifier, Inspector, Approver).
  5. Admin submits set creation.
  6. System creates `AssuranceSet` in `state.assuranceSets` with stage `'Initiated'` and 0% readiness.
- **Expected Output**: New assurance campaign created with customized requirement checklist.
- **Exceptions**: Unassociated vessel or empty requirements scope blocks creation.

---

### UC-04: Assign Workflow Roles & Third-Party Delegation
- **Primary Actor(s)**: Administrator.
- **Preconditions**: Active Assurance Set exists; user accounts configured.
- **Workflow Steps**:
  1. Admin opens Assurance Detail View (`#/assurance-sets/:id`) or User Management (`#/users`).
  2. Admin selects internal staff or third-party service provider.
  3. Admin assigns operational role (Submitter, Verifier, Inspector, Approver).
  4. For third parties, Admin sets delegated vessel scope, organization, and access expiry date.
  5. System verifies segregation of duties (e.g. Verifier cannot approve their own items).
  6. Role assignment is updated and logged in the audit trail.
- **Expected Output**: Stakeholder assignments populated in `AssuranceSet.assignedStakeholders`.
- **Exceptions**: Segregation-of-duties conflict or expired delegation rejected.

---

### UC-05: Upload and Maintain Vessel and Crew Documents
- **Primary Actor(s)**: Submitter (or Administrator).
- **Preconditions**: Submitter authenticated; document file ($\ge 200\text{ DPI}$) available.
- **Workflow Steps**:
  1. Submitter opens Document Library (`#/documents`), Vessel Detail, or Crew Directory (`#/crew`).
  2. Submitter uploads certificate file and enters metadata (title, cert number, issuing authority, expiry date).
  3. If crew certificate, system executes `addCrewDocument()`, adding to `CrewMember` and creating a linked `MasterDocument` record in `state.documents`.
  4. Document is versioned (`v1.0` or `v1.1+` on re-upload) and queued for automated OCR validation.
- **Expected Output**: Certificate stored, versioned, and synced with master document directory.
- **Exceptions**: C Admin attempting to upload/modify documents is strictly blocked by RBAC hard locks.

---

### UC-06: Extract and Validate Document Data
- **Primary Actor(s)**: System Automated OCR Engine.
- **Preconditions**: Valid document uploaded by Submitter.
- **Workflow Steps**:
  1. System extracts structured attributes (13 vessel fields or 11 crew fields).
  2. System compares extracted IMO, vessel name, flag state, and expiry against master records.
  3. System checks 6-month charter validity buffer and IACS authority accreditation.
  4. System computes confidence score ($0-100\%$) and populates `ValidationRuleStatus`.
  5. Clean records advance to Verifier Queue; defective records generate exception alerts.
- **Expected Output**: Extracted metadata populated; document status updated to `'Pending Verification'`.
- **Exceptions**: Extraction confidence $<95\%$ (vessel) / $<90\%$ (crew) flags exception for human audit.

---

### UC-07: Notify and Resolve Document Issues
- **Primary Actor(s)**: System & Submitter.
- **Preconditions**: Validation rule failure or Verifier correction request.
- **Workflow Steps**:
  1. System sets `MasterDocument.complianceState` to `'Mismatch/Exception'` or `verificationStatus` to `'Correction Requested'`.
  2. System dispatches in-app notification and alert banner to Submitter detailing defect reason.
  3. Submitter reviews defect notes in Document Detail View (`#/documents/:id`).
  4. Submitter uploads rectified file version (`v1.1`) with change summary.
  5. System re-triggers automated OCR validation and clears exception flag.
- **Expected Output**: Corrected document version registered; requirement returned to Verifier Queue.

---

### UC-08: Verify Document
- **Primary Actor(s)**: Verifier.
- **Preconditions**: Document in queue with status `'Pending Verification'`.
- **Workflow Steps**:
  1. Verifier opens Verifier Workspace (`#/verifier`) and selects pending item.
  2. Verifier reviews original certificate preview side-by-side with OCR metadata and validation flags.
  3. Verifier checks compliance with 13 vessel / 11 crew attributes.
  4. Verifier selects decision:
     - **Verify**: Marks document `'Verified'`. Routes to Inspector (if visual survey required) or Approver Gate.
     - **Request Correction**: Enters mandatory defect notes; returns document to Submitter.
     - **Reject**: Enters formal rejection rationale; marks requirement `'Rejected'`.
  5. Decision is saved to `MasterDocument` and `AssuranceRequirement` and logged in audit trail.
- **Expected Output**: Requirement verification status updated; readiness index re-calculated.
- **Exceptions**: Submitting correction/rejection without mandatory comments is blocked.

---

### UC-09: Perform Visual / Vessel Inspection & CAPA Management
- **Primary Actor(s)**: Inspector.
- **Preconditions**: Assurance Set requires physical survey; Inspector assigned.
- **Workflow Steps**:
  1. Inspector accesses Inspector Workspace (`#/inspector`) and opens Inspection Checklist (`#/inspections/:id`).
  2. Inspector evaluates physical condition across Hull, Machinery, LSA/FFA, Bridge, and Environmental systems.
  3. Inspector marks items as Satisfactory, Observation, or Deficiency, and uploads photo evidence.
  4. For deficiencies, Inspector creates a `CapaItem` with description, owner, and due date.
  5. Inspector submits completed survey report; sets `AssuranceSet.inspectionCompleted = true`.
- **Expected Output**: Physical inspection completed; CAPA non-conformances logged; dossier routed to Approver.
- **Exceptions**: Incomplete survey checklist or missing mandatory defect descriptions blocked.

---

### UC-10: Approve Document and Assurance Set
- **Primary Actor(s)**: Approver.
- **Preconditions**: All statutory requirements verified; inspection completed; readiness score evaluated.
- **Workflow Steps**:
  1. Approver opens Approver Dashboard (`#/approver`) and reviews campaign dossier.
  2. Approver inspects verified certificates, survey findings, and closed CAPA items.
  3. When all mandatory requirements are fulfilled and verified ($100\%$ readiness), Approver executes **Approve Assurance Set**.
  4. System updates `AssuranceSet.stage` to `'Approved'`, sets all Pipeline Stepper stages to completed/checked, and unlocks vessel operational status (`In Operations`, `In Transit`, `Under Charter`).
  5. Formal sign-off notes, timestamp, and user ID are recorded in the audit trail.
- **Expected Output**: Campaign marked `'Approved' / 'Certified'`; vessel cleared for charter operations.
- **Exceptions**: Approver cannot approve a campaign with unfulfilled or expired statutory requirements.

---

### UC-11: C Admin – Create Assurance Set & Review Assurance Status
- **Primary Actor(s)**: C Admin (Client / Charterer Admin).
- **Preconditions**: C Admin authenticated and associated with charterer organization.
- **Workflow Steps**:
  1. C Admin logs in and opens Create Assurance Set View (`#/assurance-sets/create`).
  2. C Admin selects vessel, enters charter window, and defines mandatory chartering criteria.
  3. C Admin monitors real-time compliance readiness index, verification progress, and survey results.
  4. In CAPA Management (`#/capa`), C Admin reviews resolved deficiencies and flags critical items for on-site physical re-inspection with `cadminFlagReason`.
- **Expected Output**: Client campaign initiated; real-time read-only visibility into provider assurance dossier.
- **Exceptions**: C Admin is strictly prevented from uploading, modifying, replacing, or deleting provider documents.

---

### UC-12: RBAC Matrix & User Permission Overrides Management
- **Primary Actor(s)**: Administrator.
- **Preconditions**: Admin authenticated; feature flag `ENABLE_ROLES_AND_PERMISSIONS` is enabled.
- **Workflow Steps**:
  1. Admin opens Roles & Permissions View (`#/roles-permissions`).
  2. Admin switches between **Role Defaults** and **User Overrides** tabs.
  3. Admin adjusts CRUD check-boxes across 28 permission scopes (or creates custom scopes/roles).
  4. Hard-deny BRD rules (e.g. C Admin document mutation locks) remain permanently locked.
  5. Admin clicks **Save Changes**; store updates `rolePermissionDefaults` and `userPermissionOverrides`.
  6. Admin can click **Reset to BRD Defaults** to restore factory baseline settings.
- **Expected Output**: Updated authorization rules take immediate effect across sidebar, routes, and action buttons.