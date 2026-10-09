---
name: map-mock-data-schema
description: Relational data schema, entity ID naming taxonomy, canonical status enums, fleet invariants, and foreign key integrity rules for MAPv2 mock data and stores. Use whenever creating, editing, or validating entity models, records, and store relationships in src/store/*MockData.ts and src/types/*.
---

# MAPv2 Mock Data Schema, Taxonomy & Relational Invariants

This skill governs entity models, foreign key relationships, ID taxonomies, and canonical states across the MAPv2 data store.

---

## 1. Strict ID Naming Taxonomy

All mock records and runtime-generated IDs must strictly follow the canonical format:
`MAP-[ENTITY]-[YYYY]-[CATEGORY]-[SEQ]`

### Canonical ID Allocations

* **Vessel IDs:** `VESSEL-001` through `VESSEL-011` (11 vessels total; strictly enforced by fleet isolation tests). Runtime generated: `MAP-VES-2026-ASST-[SEQ]`.
* **Equipment IDs:** `EQ-001` through `EQ-013`. Runtime generated: `MAP-EQP-2026-EQPT-[SEQ]`.
* **Project IDs:** `MAP-PROJ-2026-MARINE-001` through `MAP-PROJ-2026-MARINE-015`.
* **Crew IDs:** `CREW-101` through `CREW-105` (5 seafarers total). Runtime generated: `MAP-CRW-2026-PERS-[SEQ]`.
* **Assurance Set IDs:** `AS-2026-[SEQ]`, `AS-02-P[SEQ]-MASTER`, `AS-EQP-[SEQ]`, `AS-CRW-[SEQ]`, `AS-ACT-[SEQ]`.
* **User IDs:** `USR-101` through `USR-104` and `USR-201` through `USR-220`. Runtime generated: `MAP-USR-2026-USER-[SEQ]`.
* **Document IDs:** `MAP-[VES|CRW|EQP|DOC]-2026-[STAT|STCW|LIFT]-[SEQ]`.
* **Audit Trail Event IDs:** `MAP-AUD-2026-EVNT-[SEQ]`.

---

## 2. Canonical Entity State & Taxonomy Mappings (100% Coverage)

### A. Vessels (`MOCK_VESSELS`)
* **Operational Statuses (Set 1 Taxonomy - Exactly 10 valid states):**
  - `In Operations`
  - `In Transit`
  - `Dry Docking`
  - `Lay-up`
  - `Port Stay`
  - `Under Charter`
  - `Active`
  - `Standby`
  - `Maintenance`
  - `Decommissioned`
* **Classification Societies:** `DNV`, `ABS`, `Bureau Veritas`, `RINA`, `Lloyd's Register`.
* **Fleet Isolation Invariant:** `VESSEL-001`..`007` owned by `Northwind Marine Pty Ltd`; `VESSEL-008` (Meridian), `VESSEL-009` (Austral), `VESSEL-010` (Oceanic Horizon), `VESSEL-011` (Southern Basin). Do NOT expand array length beyond 11 without updating test invariants.

### B. Equipment (`MOCK_EQUIPMENT_DATA`)
* **Categories:** `Fire-Fighting Equipment`, `Navigation & Bridge Equipment`, `Life-Saving Appliances`, `Machinery & Propulsion`, `Other`.
* **Availability States:** `Available`, `On Charter`, `Under Maintenance`, `Unavailable`, `Pending`, `Unknown`.
* **Compliance States:** `Compliant`, `Partially Compliant`, `Non-Compliant`, `Under Review`.
* **Classification Statuses:** `Surveyed`, `In Progress`, `Overdue`, `Uncertified`.

### C. Projects (`PROJECT_SEED_DATA`)
* **Operational Statuses:** `Draft`, `Composing`, `Assurance In Progress`, `Ready for Charter`, `Closed`.
* **Project Types:** `Charter / Voyage`, `Service Engagement`, `Crew Provision`, `Equipment Rental`, `Assurance Campaign`, `Mixed / Composite`.
* **Work Locations:** `Onboard`, `Shoreside`, `Offshore`, `Mixed`.
* **Risk Profiles:** `Standard`, `Elevated`, `High-Risk`, `Armed Escort Required`.

### D. Assurance Sets (`MOCK_ASSURANCE_SETS` & `PROJECT_SEED_ASSURANCE_SETS`)
* **Scopes / Types:** `Project`, `Vessel`, `Crew`, `Equipment`, `Activity`.
* **Workflow Stages:** `Initiated`, `Validation`, `Verification`, `Inspection`, `Approval`, `Certified`, `Approved`.
* **Approver Decisions:** `Approved`, `Returned for Correction`, `Rejected`, `Pending`.

### E. Users & Crew (`MOCK_USERS`, `MOCK_CREW`)
* **User Statuses:** `Active`, `Pending Invitation`, `Inactive`.
* **Crew Compliance:** `Fully Compliant`, `Expiring < 60 Days`, `Document Deficient`.

---

## 3. Relational Foreign Key Integrity Rules

1. **Assurance Set -> Vessel Linkage:** Any assurance set defining a `vesselId` MUST link to an existing `vessel.id` in `MOCK_VESSELS`, and MUST synchronize matching `set.vesselName === vessel.name` and `set.imoNumber === vessel.imoNumber`. Never create orphan vessel IDs in assurance sets.
2. **Project Master -> Sub-Set Linkage:** Every master assurance set (`isProjectMaster: true`) MUST have a valid `parentProjectId`, and all IDs in `aggregatedFromSetIds` MUST resolve to existing child assurance sets.
3. **Equipment -> Vessel Linkage:** Equipment records with `parentVesselId` MUST reference a valid vessel ID or `null`.
4. **Crew -> Vessel Linkage:** Crew records with `currentVesselId` MUST reference a valid vessel ID or `null`.
5. **Document -> Asset Linkage:** Certificates in `MOCK_DOCUMENTS` must match corresponding statutory/STCW certificates defined in parent entities.

---

## 4. Strict Data Sourcing Policy (Zero Inline Hardcoding)

* **Mandatory Centralized Store Rule:** All data presented across views, tables, cards, modals, and charts **must** be sourced exclusively from centralized store files and mock data modules (`mockData.ts`, `crewMockData.ts`, `equipmentMockData.ts`, `projectMockData.ts`, `capaMockData.ts`, etc.).
* **Prohibition of Inline Arrays:** Hardcoding mock records, static lists, status enums, or mock user objects directly inside React component files (`.tsx`) is strictly forbidden.

