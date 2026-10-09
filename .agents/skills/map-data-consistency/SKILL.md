---
name: map-data-consistency
description: Numerical consistency and calculation derivations for MAPv2 readiness indexes, pipeline stages, compliance scores, and KPI counts. Use whenever creating, editing, or reviewing anything in src/store/*MockData.ts, or any view, table, card, or dashboard displaying a readiness score, compliance percentage, or stage. Defines requirement weights, index arithmetic, rollup hierarchy averages, and the mock data audit tool.
---

# MAP Mock Data Consistency & Readiness Calculations

Every number a user sees across MAPv2 must come directly from a verifiable calculation over the records below it. Hardcoded scores and manual estimates are strictly prohibited.

---

## 1. Readiness Index & Pipeline Calculation

### Requirement Weights (`STAGE_READINESS_WEIGHTS`)

Defined centrally in `src/utils/readinessHelpers.ts`:

| Requirement State | Weight |
| :--- | :--- |
| No document attached | **10** |
| Document attached, `verifierStatus` `Pending` or `Correction Requested` | **40** |
| `verifierStatus` `Verified` | **70** |
| Parent set approved or certified | **100** |

### Readiness Index Formula

```
readinessScore = Math.round(sum of requirement weights / number of requirements)
```

The single source of truth is `calculateAssuranceSetReadiness(set, allSets)` in `src/utils/readinessHelpers.ts`. Any stored `readinessScore` literal must equal its computed output.

### Pipeline Stage Derivation

The stage is the first stage that not every mandatory requirement has cleared:

| Stage | Cleared When | Skipped When |
| :--- | :--- | :--- |
| **Initiated** | Set exists (current stage only while no requirement has a document) | Never |
| **Validation** | A document is attached: `documentId`, `linkedDocumentId`, or `linkedAssuranceSetId` | Never |
| **Verification** | `verifierStatus` is `Verified` | `verificationRequired === false` |
| **Inspection** | Set has `inspectionCompleted: true` | `mandatoryInspectionRequired === false` |
| **Approval** | Set has `approverDecision: 'Approved'` | `formalApprovalRequired === false` (ends at `Certified`) |

### Calculation Example

A set with 4 mandatory requirements: 2 verified, 1 submitted, 1 with no document.
```
Initiated      4/4
Validation     3/4   <- Current Stage
Verification   2/4
Approval       0/4

Index = (70 + 70 + 40 + 10) / 4 = 47.5 -> 48
```
Stage is `Validation`, Index is `48`.

---

## 2. Numerical Invariants

- `isFulfilled: true` is set ONLY together with `verifierStatus: 'Verified'`.
- A verified requirement carries a valid document reference that resolves in `MOCK_DOCUMENTS`, a crew STCW record, or a vessel statutory certificate.
- `Approved` and `Certified` require `approverDecision: 'Approved'` when formal approval applies.
- `Rejected` and `Returned for Correction` are recorded on `approverDecision` with `approverNotes`. The stage is derived from requirements.
- A set with no requirements has no basis for a stage or score.

---

## 3. Rollup Hierarchies (Average Rule)

| Entity Record | Calculated Field | Calculation Basis |
| :--- | :--- | :--- |
| **Vessel** | `complianceReadinessScore` | Average of every set where `vesselId === vessel.id` (`calculateVesselReadiness`) |
| **Project** | `readinessScore` | Average of the sets returned by `getProjectAssuranceSets` (0 if no sets) |
| **Equipment** | `complianceReadinessScore` | Average of the sets where `equipmentId === equipment.id` |
| **Crew** | `overallComplianceScore` | Average of the sets where `crewId === crew.id` |
| **Marketplace Offering** | `complianceReadinessScore` | The calculated score of the asset referenced in `linkedEntityId` |
| **Dashboard & KPI Cards** | Computed in view | Dynamic average or count over the filtered records from the store |

---

## 4. Single Source of Truth Across Screens

- Views must call utility helpers (`src/utils/readinessHelpers.ts`, `src/utils/projectHelpers.ts`). Never hardcode fallback constants (e.g. `|| 2` or `|| 80`).
- Copied / denormalized fields must match their source entity: `vesselName` and `imoNumber` match `MOCK_VESSELS`; `projectName` matches `MOCK_PROJECTS`.
- Status follows score: `complianceStatus = deriveComplianceStatus(score)`.

---

## 5. Audit Checks (C1 through C12)

| Check | Validated Invariant |
| :--- | :--- |
| **C1** | Set `readinessScore` equals requirement average |
| **C2** | Set `stage` equals first incomplete stage |
| **C3** | `isFulfilled` agrees with `verifierStatus` |
| **C4** | Requirement document references resolve |
| **C5** | Vessel score equals average of its linked sets |
| **C6** | Project score equals average of its sets |
| **C7** | Equipment score equals set average; Crew score equals document share |
| **C8** | Marketplace score equals linked asset and metric text |
| **C9** | Denormalized names and IDs match source record |
| **C10** | Vessel status agrees with readiness |
| **C11** | Requirement status equals linked document status |
| **C12** | Project status agrees with its sets |

---

## 6. Running the Data Consistency Audit

```bash
# Audit all mock records
npx vite-node .agents/skills/map-data-consistency/scripts/audit.ts

# Inspect the basis of a specific entity
npx vite-node .agents/skills/map-data-consistency/scripts/audit.ts AS-2026-010
```

