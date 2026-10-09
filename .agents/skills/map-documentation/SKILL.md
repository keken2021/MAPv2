---
name: map-documentation
description: Documentation protocol for planning, auditing, architectural reporting, and codebase change summaries in MAPv2. Enforces .md document creation saved in the docs/ folder, structured tables using filename basenames only (never paths), lines changed, rationales, mandatory Mermaid relationship diagrams, and activated skill lists.
---

# MAPv2 Documentation Protocol & Reporting Standard

This skill establishes the standardized documentation format across MAPv2. Whenever the user requests planning, auditing, architectural overviews, refactoring summaries, or feature documentation, you must generate a structured Markdown (`.md`) document adhering strictly to this protocol.

---

## 1. Storage Location & File Format

* **Directory:** All generated documentation files must be saved directly inside the `docs/` directory: `docs/<topic-in-kebab-case>.md`.
* **File Format:** Markdown (`.md`) only. Use GitHub Flavored Markdown (GFM).

---

## 2. Mandatory Document Structure

Every document generated under this skill must contain the following standardized sections in exact order:

```markdown
# [Descriptive Title]

## Summary
[Concise executive summary of the document, objective, architectural changes, or audit findings.]

## User Request & Scope
[Exact user request or problem statement being addressed, requirements, and target boundaries.]

## Changed Files & Rationale
[Markdown Table mapping modified files. MUST use filename basenames only — NEVER include directory paths.]

## System Architecture & Relationships
[Mandatory Mermaid diagram visualizing entity relationships, state progression, or multi-organization connections.]

## Activated Skills
[Bulleted list of skills referenced and activated during investigation and execution.]

## Verification & Validation Results
[Evidence of automated testing, TypeScript verification, and business rules audit compliance.]
```

---

## 3. Strict Rules & Formatting Guidelines

### Rule 1: Basename-Only File References in Tables
In the `Changed Files & Rationale` table, you must **NEVER** include directory paths or absolute paths. Use only the file's basename.

| File Name | Lines Changed | Rationale / Purpose |
| :--- | :--- | :--- |
| `mockData.ts` | L1506–L1705, L4750–L5168 | Added specialized Service Providers, multi-org Client Admins, and unique assurance sets. |
| `projectMockData.ts` | L735–L768 | Added Inpex Ichthys Maintenance campaign project linked to new assurance set. |
| `notificationMockData.ts` | L350–L485 | Added personalized inbox notifications for new service provider and client admin users. |
| `equipmentMockData.ts` | L60–L85 | Updated equipment readiness score to reflect linked assurance set. |
| `assurance.ts` | L16–L22 | Added `Service Provider Admin` to `InitiatingRoleType` union. |

> [!WARNING]
> Writing paths like `src/store/mockData.ts` or `c:/mapFiles/MAPv2/src/...` inside the table is strictly prohibited. Only use `mockData.ts`.

### Rule 2: Mandatory Mermaid Diagram for Relationships & Connections
Whenever documenting system architecture, multi-role interactions, audit flows, or entity dependencies, you **MUST** include a valid Mermaid diagram.

Supported diagram types:
- **Flowcharts:** `flowchart TD` / `flowchart LR`
- **Sequence Diagrams:** `sequenceDiagram`
- **State Diagrams:** `stateDiagram-v2`
- **Entity Relationship Diagrams:** `erDiagram`

*Syntax Safety:* Always quote node labels that contain special characters (e.g., `["Meridian Marine (Vessel-Only)"]`).

### Rule 3: Explicit Skill Activation Register
Explicitly document all system and domain skills activated during the task:
- `@map-business-rules`: Segregation of duties, approval gates, R1–R13 checks.
- `@map-mock-data-schema`: Foreign key invariants, canonical ID taxonomies.
- `@map-data-consistency`: Readiness index arithmetic and rollup derivations.
- `@map-table-standards`: 6-column ID-first enterprise table architecture.
- `@map-design-system`: UI tokens, color palettes, and interaction standards.
- `@investigate-first`: Root cause analysis and log inspection before edits.
- `@verify-and-stop`: Automated testing and verification protocol.

---

## 4. Verification Check Before Saving

Before finalizing any document in `docs/`:
1. Check that the file is in `docs/` and ends with `.md`.
2. Check that the changed files table contains **only basenames** in the `File Name` column.
3. Verify that the Mermaid diagram renders valid syntax without HTML tags.
4. Verify that the activated skills list accurately lists all tools and skills used.

