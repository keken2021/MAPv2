---
name: map-business-rules
description: Enforces MAPv2 business process and party segregation rules in mock data and in the wizards that create it. Use whenever creating, editing, or reviewing assurance sets, projects, users, stakeholder assignments, marketplace offerings, audit trail events, or notifications, or any form that assigns a client, service provider, submitter, verifier, inspector, or approver. Covers client / service provider / assurance group separation, role eligibility, approval gates, and the audit script.
---

# MAP Business Rules & Party Governance

An assurance set exists because independent parties must verify and approve each other. A record where one organization sits on both sides describes a process that violates compliance segregation of duties.

---

## 1. The Three Groups

Each organization on an assurance set belongs to exactly one group. Membership must be clear from the record alone.

| Group | Who | May | May Never |
| :--- | :--- | :--- | :--- |
| **Client** | The charterer or buyer who needs the assurance | Own the set, choose reviewers, verify, approve | Submit documents |
| **Service Provider** | The owner of the vessel, crew, or equipment, and its appointees | Submit and correct documents | Verify or approve |
| **Assurance** | Independent third parties and issuing authorities outside the commercial contract | Verify, inspect, approve | Submit documents |

Whoever needs the assurance is the client, whatever kind of company it is. A vessel owner buying bunker fuel is the client of that set. A set prepared by the provider still belongs to the client.

---

## 2. Core Party & Segregation Rules

| Rule | Requirement | Checked Fields |
| :--- | :--- | :--- |
| **R1** | The client and the service provider are different organizations, unless `internalDeployment: true`. | `clientOrg`, `serviceProviderOrg`, `charterer`, `initiatorOrg` |
| **R2** | Every set names both parties. `charterer` equals `clientOrg`. `serviceProviderOrg` is the owner of the subject asset. | same, plus `registeredOwner`, `owningOrganization`, crew `organization` |
| **R3** | The submitter belongs to the service provider. | `assignedSubmitter` |
| **R4** | The verifier and the approver never belong to the service provider. | `assignedVerifier`, `assignedApprover` |
| **R5** | The verifier, inspector, and approver each belong to the client or to the assurance group. Staff of an unrelated client are neither. | plus `assignedInspector` |
| **R6** | One person holds one role per set. This applies to internal deployments too. | all four assignees |
| **R7** | An inspector is assigned if and only if `mandatoryInspectionRequired` is true. | `assignedInspector`, `inspectionCompleted` |
| **R8** | Each assignee label resolves to an Active user in `MOCK_USERS` who holds the role, with the same organization. One organization has one spelling everywhere. | `MOCK_USERS` |
| **R9** | Reviewers match `reviewMode`: `internal` is client staff, `third_party` is assurance group, `issuing_authority` has an authority verifier, `mixed` allows client and assurance. | `reviewMode`, `reviewChannels` |
| **R10** | A project's client differs from each asset link's provider. The link's provider owns the asset. The linked set names the same client as the project. | `requestingOrganization`, `ownerOrganization`, `assetLinks[]` |
| **R11** | A marketplace offering's provider owns the asset it links to. An organization never sees or charters its own offering. | `providerOrg`, `linkedEntityId` |
| **R12** | Every audit event, notification, and persona session points at a real user who holds the role recorded, in the organization recorded. | `userId`, `userRole`, `organization`, `recipientUserId` |
| **R13** | A set is approved only after every mandatory requirement is verified, any mandatory inspection is completed, an approver is assigned, and `approverDecision` is `Approved`. A rejection or return carries `approverNotes`. | `stage`, `approverDecision`, `approverNotes` |

---

## 3. Role Eligibility (R8)

| Slot | Roles Permitted to Fill Slot |
| :--- | :--- |
| **Submitter** | `Submitter`, `Administrator` |
| **Verifier** | `Verifier`, `C Admin` |
| **Inspector** | `Inspector` |
| **Approver** | `Approver`, `C Admin` |

---

## 4. Hard-Denied Persona Actions (R12)

| Persona | Hard-Denied Actions |
| :--- | :--- |
| **C Admin** | Upload, replace, or delete a provider document |
| **Submitter** | Verify, reject, request correction, approve, or record inspection findings |
| **Verifier** | Upload a document, approve, or record inspection findings |
| **Inspector** | Verify a document or approve |
| **Approver** | Upload a document, verify, or record inspection findings |

---

## 5. Internal Deployments

`internalDeployment: true` is the only scenario where one organization may be both client and provider (assuring its own asset for internal use without a commercial counterparty). Rule R6 still strictly applies: the individual who submits a document cannot verify or approve it.

---

## 6. Validator Helpers

Reuse the centralized validators in `src/utils/userRoleHelpers.ts` and `src/utils/projectHelpers.ts`:
- `validateStakeholderAssignmentForSet`
- `filterCandidatesByReviewMode`
- `hasBlockingAssuranceAssignmentConflict`
- `getAssuranceAssignmentWarnings`
- `findUserByAssigneeLabel`
- `getReviewChannelForUser`
- `isOrganizationMatch`
- `isAssetOwnedByOrganization`
- `getProjectClientOrganization`

---

## 7. Running the Business Rules Audit

```bash
# Audit all mock records
npx vite-node .agents/skills/map-business-rules/scripts/audit.ts

# Audit a specific assurance set
npx vite-node .agents/skills/map-business-rules/scripts/audit.ts AS-2026-004
```

