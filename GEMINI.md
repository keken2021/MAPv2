---
name: mapv2-directives-and-design-system
description: Single consolidated operational directives, business rules, and UI/UX design system for MAPv2 workspace.
---

# Workspace Directives & Enterprise Standards

## 1. Core Operational Rules

1. **Strict No-Emoji Policy**: Never use emojis in the UI, code, mock data, or documentation files under any circumstances. Use professional SVG icons or clean semantic typography.
2. **Vessel Registration & Operational Statuses**: Always align vessel operational statuses with the standardized Set 1 taxonomy:
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
3. **Mock Data Naming Convention**: Always strictly follow the format: `MAP-[ENTITY]-[YYYY]-[CATEGORY]-[SEQ]`.
4. **No Label Duplication**: Never repeat the same label, title, or descriptor on a single screen. If a heading already declares a context (e.g. "Plant"), do not add a badge, sub-label, or tag that restates it. Each piece of information must appear exactly once.
5. **Scope Inheritance — No Redundant Scope Labels**: If the assurance scope has already been declared (e.g. the page title, step header, or card title already says "Project" or "Vessel"), do not add the same scope identifier again in child elements, badges, or sub-labels within the same view.
6. **Sort / Filter Control Uniqueness**: If a table column already has a built-in sort control (header click or inline arrow), do not add a separate sort button in the toolbar or filter row for the same column. One control per function per context.
7. **Concise Naming Convention**: All UI labels, button text, column headers, step names, card titles, and modal headings must be short and direct. Avoid filler words (e.g. "Section", "Pillar", "Please", "Click to"). Prefer: "Plant" over "Plant Section", "Vessels" over "Chartered Vessels", "Documents" over "Required Documents & Information (Statutory)".
8. **Badge Minimalism**: Badges are reserved exclusively for: (a) status indicators with semantic color meaning, (b) numeric counts, (c) short codes or IDs (e.g. IMO numbers, MAP IDs). Do not use badges to repeat text that is already visible in a nearby heading, label, or title on the same screen.
9. **Mandatory & Required Indicators (*)**: All mandatory field indicators, asterisks (`*`), mandatory requirement tags/badges, and warning indicators signifying required inputs or required assurance items MUST strictly be colored in high-contrast semantic red (`text-danger` / `#DC2626` / `rgb(220, 38, 38)`). Never use muted, gray, or neutral colors for required or mandatory indicators.

---

# Universal UI/UX Design System & Architecture Specification

This document serves as the mandatory design system, layout specification, and data architecture context file for all frontend components, views, and interface implementations across the application. All development and agent actions must strictly adhere to these tokens, principles, and rules to maintain visual consistency, high usability standards, and strict separation of concerns.

---

## 2. Typography & Component Font Mappings

The system utilizes **IBM Plex Sans** as the primary font family across all user interfaces, paired with **IBM Plex Mono** specifically for numerical data, system codes, and identifiers to ensure tabular alignment and legibility.

### Global Font Stack

* **Primary Sans Family:** `'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`
* **Monospace / Tabular Family:** `'IBM Plex Mono', SFMono-Regular, Menlo, Monaco, Consolas, monospace`

### Component-Specific Typography Rules

* **Page Titles (H1):**
  * Font: IBM Plex Sans
  * Weight: Bold (700)
  * Size: 24px (Leading: 32px)
  * Color: `rgb(11, 27, 43)` (`#0B1B2B`)

* **Section Headers (H2):**
  * Font: IBM Plex Sans
  * Weight: Semi-Bold (600)
  * Size: 18px (Leading: 26px)
  * Color: `rgb(51, 65, 85)` (`#334155`)

* **Card & Modal Headers (H3):**
  * Font: IBM Plex Sans
  * Weight: Semi-Bold (600)
  * Size: 16px (Leading: 24px)

* **Body Text & Paragraphs:**
  * Font: IBM Plex Sans
  * Weight: Regular (400)
  * Size: 14px (Leading: 20px)
  * Color: `rgb(51, 65, 85)` (`#334155`)

* **Form Labels & Table Headers:**
  * Font: IBM Plex Sans
  * Weight: Medium (500)
  * Size: 13px (Leading: 18px)
  * Color: `rgb(100, 116, 139)` (`#64748B`)

* **Buttons & Interactive Controls:**
  * Font: IBM Plex Sans
  * Weight: Medium (500)
  * Size: 14px (Leading: 20px)

* **Badges, Tags & Pills:**
  * Font: IBM Plex Sans
  * Weight: Medium (500)
  * Size: 12px (Leading: 16px)

* **Document IDs, IMO Numbers & Numeric Data Cells:**
  * Font: IBM Plex Mono
  * Weight: Regular (400) or Medium (500)
  * Size: 13px (Leading: 18px)
  * Usage: Applied to table cells displaying MAP document IDs (e.g., `MAP-VES-2026-STAT-00412`), IMO numbers, timestamps, and metric readouts to guarantee clean vertical alignment.

* **Audit Logs, JSON Payloads & System Code:**
  * Font: IBM Plex Mono
  * Weight: Regular (400)
  * Size: 12px (Leading: 16px)

---

## 3. Color Palette & Brand Identity

* **Primary Brand Base:** `rgb(11, 27, 43)` (`#0B1B2B`) — Used for primary navigation bars, dark headers, structural containers, and solid primary buttons on light backgrounds.
* **Primary Interactive & Hover States:**
  * **Default State:** `rgb(11, 27, 43)` (`#0B1B2B`) with text `rgb(255, 255, 255)` (`#FFFFFF`).
  * **Hover State:** `rgb(30, 58, 95)` (`#1E3A5F`) — A calibrated, elevated navy tone ensuring clear visual feedback without breaking brand affinity.
  * **Active / Pressed State:** `rgb(8, 19, 31)` (`#08131F`).
  * **Focus Ring:** `rgb(56, 189, 248)` (`#38BDF8` / Sky 400) with a 2px offset for high-contrast keyboard navigation.

* **Surface & Neutral Scale:**
  * **App Background:** `rgb(248, 250, 252)` (`#F8FAFC` / Slate 50)
  * **Container / Card Background:** `rgb(255, 255, 255)` (`#FFFFFF`)
  * **Borders & Dividers:** `rgb(226, 232, 240)` (`#E2E8F0` / Slate 200)
  * **Muted / Secondary Text:** `rgb(100, 116, 139)` (`#64748B` / Slate 500)
  * **Primary Text:** `rgb(51, 65, 85)` (`#334155` / Slate 700)

---

## 4. Iconography

* **Mandatory Icon Library:** **Lucide Icons** (`lucide-react`) must be used exclusively across the entire system. Do not mix icon packs (e.g., FontAwesome, Material Icons).
* **Icon Sizing Rules:**
  * Inline text icons: `16px` (`w-4 h-4`)
  * Button and table action icons: `18px` (`w-[18px] h-[18px]`)
  * Header and navigation icons: `20px` (`w-5 h-5`)
  * Empty state / Hero illustrations: `32px` to `48px` (`w-8 h-8` to `w-12 h-12`)

* **Icon Colors:** Default to `rgb(100, 116, 139)` (`#64748B`), changing to active brand states (`rgb(11, 27, 43)`) or semantic colors (success green, error red) based on context.
* **Mandatory Field & Requirement Indicators (*):** All mandatory field asterisks (`*`), required field icons, and "Mandatory" requirement tags must strictly use semantic red (`text-danger` / `#DC2626`). Never render required asterisks or mandatory labels in gray or neutral colors.

---

## 5. Layout, Margins & Spacing (Edge Clearance & Anti-Crowding)

To prevent visual clutter, cramped typography, and text colliding with container borders, a strict 4px/8px baseline grid scale and container boundary rules must be strictly followed:

* **Spacing Scale:**
  * `xs`: 4px (`space-1` / `p-1`) — Tight badge padding, inline icon-to-text gaps.
  * `sm`: 8px (`space-2` / `p-2`) — Form field internal gaps, compact chip spacing.
  * `md`: 16px (`space-4` / `p-4`) — Standard card internal padding, component container gutters.
  * `lg`: 24px (`space-6` / `p-6`) — Section spacing, modal inner padding, drawer body padding.
  * `xl`: 32px (`space-8` / `p-8`) — Major layout block separators, page headers.

* **Mandatory Container Padding & Edge Clearance Rules:**
  * **Card & Panel Inner Padding:** All cards, widgets, sub-panels, and summary boxes must have a mandatory minimum internal padding of **16px** (`p-4` or `16px` to `20px`). Never use `0px`, `p-1`, or `p-2` on parent container cards.
  * **Modal & Drawer Inner Padding:** Modals and slide-out drawers must maintain a minimum internal body padding of **20px to 24px** (`p-5` to `p-6`).
  * **Nested Sub-Boxes & Highlight Strips:** Any nested alert box, key-metric strip, or callout container must have at least **12px to 16px** (`p-3` to `p-4`) internal padding so content never touches the bounding border.
  * **Table Cell Breathing Room:** Table cells (`<td>` and `<th>`) must maintain a minimum horizontal padding of **16px** (`px-4`) and vertical padding of **12px** (`py-3`). Text, IDs, and status pills must never touch cell edges or divider lines.
  * **Form Input Inset:** Text inputs, dropdowns, and search fields must provide at least **12px to 14px** horizontal padding (`px-3.5 py-2`) so typed text, placeholders, and prefix/suffix icons do not collide with input borders.
  * **Anti-Border Crowding Rule:** Text lines, headings, badges, and interactive controls must never sit flush against a border. Always enforce at least **12px to 16px** of clear whitespace between content and any enclosing border.

* **Margin & Gutters:**
  * Never use arbitrary hardcoded margins (e.g., `margin: 13px`). Stick strictly to the scaling tokens.
  * Maintain consistent container gutters (`24px` or `32px`) across viewports to prevent edge-to-edge screen crowding.

---

## 6. Interactive Elements & Buttons

* **Border Radius:** Buttons must have a clean, modern rounded corner (`rounded-md` or `6px` radius). Fully pill-shaped (`rounded-full`) buttons are strictly reserved for status badges and tags, not primary interactive controls.
* **Padding (Compact & Balanced):** Avoid bulky padding. Buttons must maintain a streamlined, professional enterprise footprint:
  * *Medium (Standard):* `px-3.5 py-2` (Horizontal: 14px, Vertical: 8px)
  * *Small (Dense Tables/Toolbars):* `px-2.5 py-1.5` (Horizontal: 10px, Vertical: 6px)

* **Button Component Variations:**
  * **Primary Solid:** Background `rgb(11, 27, 43)`, text white. On hover, shifts to `rgb(30, 58, 95)`.
  * **Secondary / Outline:** Transparent background, `1px solid` border (`#E2E8F0`), text `#334155`. On hover, background shifts to `#F8FAFC`.
  * **Destructive:** Background `#DC2626`, text white. On hover, shifts to `#B91C1C`.

---

## 7. Strict Data Sourcing Policy (Zero Inline Hardcoding)

* **Mandatory Source Rule:** All data presented across views, tables, cards, modals, and charts **must** be sourced exclusively from centralized store files and mock data modules (`mockData.ts`, `crewMockData.ts`, `equipmentMockData.ts`, `projectMockData.ts`, `capaMockData.ts`, etc.).
* **Prohibition of Inline Arrays:** Hardcoding mock records, static lists, status enums, or mock user objects directly inside React component files (`.tsx`) is strictly forbidden.
* **State Management Integration:** Components must consume data via hooks, store selectors, or imported repository functions to ensure relational integrity, correct foreign key mappings, and consistent ID generation across the system.

---

## 8. UI/UX Principles (Nielsen Norman Group Alignment)

All interfaces generated by the agent must adhere to core Nielsen Norman Group (NN/g) usability heuristics:

1. **Visibility of System Status:** Keep users informed about what is going on through clear loading indicators, active pipeline steppers, breadcrumbs, and success/error toast notifications.
2. **Match Between System and the Real World:** Use standard maritime, assurance, and enterprise terminology familiar to the users. Avoid internal database jargon in user-facing UI labels.
3. **User Control and Freedom:** Provide clear "Cancel", "Back", and "Close" mechanisms on all drawers, modals, and multi-step wizards. Support safe exits from destructive workflows.
4. **Consistency and Standards:** Follow established patterns across all views. If a table has pagination, sorting, and search filters in the Fleet view, it must function identically in the Equipment, Crew, and Project views.
5. **Error Prevention:** Design robust form validations, disable submit actions until required fields are met, and provide clear inline error messaging before users commit changes.
6. **Recognition Rather than Recall:** Make options, filters, and navigational paths visible. Use searchable dropdowns and clear helper text instead of expecting users to remember complex identifiers.
7. **Aesthetic and Minimalist Design:** Eliminate extraneous visual clutter. Every element on a screen must serve a direct informational or functional purpose. Prioritize whitespace and legible data density.

---

## 9. Universal Modal Architecture & Dropdown Standards

To guarantee visual consistency and eliminate interface defects across all modal dialogs and form controls:

* **Dropdown Chevron Fade Protection:**
  - All `<select>` controls and dropdown inputs must enforce generous right padding (`padding: 9px 42px 9px 14px` or `padding-right: 2.5rem`), `text-overflow: ellipsis`, and `overflow: hidden`.
  - When option text can be long, implement an overlay fade gradient mask (`linear-gradient(to right, rgba(255, 255, 255, 0), rgba(255, 255, 255, 1))`) positioned at `right: 28px` with `pointer-events: none` directly before the chevron icon to prevent text collision.

* **Unified Modal Layout Architecture:**
  - **Modal Header:** `#0B1B2B` navy background, white title (`IBM Plex Sans` 700), subtitle (`#94A3B8`), semantic Lucide icon badge, and close button (`X`).
  - **Modal Body:** `#F8FAFC` slate surface background with mandatory **20px to 24px** (`p-4` to `p-5`) internal body padding. All nested cards must maintain minimum **16px to 20px** internal padding.
  - **Modal Footer:** `#FFFFFF` background with `border-top: 1px solid #E2E8F0`, `px-4 py-3`, and **space-between layout** (`justify-content-between`): Secondary / Cancel button pinned to the left, and primary submit / action button on the right.

* **Category Navigation Pills:**
  - Filter pills and tab switchers must use **IBM Plex Mono** (`font-mono-code` / `fontSize: 0.8rem`) with numerical counters formatted in parentheses (e.g., `All (13)`, `Vessels (4)`, `Equipment (4)`).
  - Active pill: `#0B1B2B` background with bold white text. Inactive pill: transparent background with `#64748B` text.

---

## 10. Universal Enterprise Table Column Sequence Standard (ID-First Architecture)

To guarantee predictable data scannability, vertical alignment, and cognitive ease across all enterprise views and tabs, every data table across the MAPv2 application must strictly follow the standardized 5–6 column sequence:

1. **Column 1: Identifier / Code (`ID`)** — Formatted in **IBM Plex Mono** (`font-mono-code fw-semibold text-primary`).
   - Examples: `Crew ID` (`c.id`), `IMO / Vessel ID` (`v.imoNumber`), `Certificate No / ID` (`doc.certificateNo`), `CAPA ID` (`capa.id`), `Set ID` (`s.id`), `Equipment Identifier` (`item.equipmentIdentifier`), `Offering ID` (`item.id`), `User ID` (`u.id`), `Timestamp (UTC)` (`ev.timestampUtc`).
2. **Column 2: Name / Title / Profile / Asset** — Primary human-readable title or entity label.
   - Examples: `Seafarer Profile` (Photo + Full Name + Rank), `Document Title`, `Vessel Name`, `CAPA Finding / Title`, `Equipment Name`, `Campaign Title`, `Offering Title & Media`, `User Name & Email`.
3. **Column 3: Context / Category / Type / Authority / Scope** — Contextual classification, entity subtype, or issuing body.
   - Examples: `Current Vessel Assignment`, `Type & Issuing Authority`, `Class Notation & Vessel Type`, `Assigned Role & Organization`, `Equipment Category`, `Vessel Scope & Owner`.
4. **Column 4: Validity / Date / Window / Period / Metric** — Temporal milestones or key metric readouts.
   - Examples: `Expiry Date`, `Service Period`, `Due Date`, `Charter Window`, `Parent Vessel`, `Readiness Score`.
5. **Column 5: Status / Compliance State** — Standardized semantic status badge with appropriate background and high-contrast text.
   - Examples: `STCW Compliance Status`, `Compliance State`, `Operational Status`, `Workflow Stage`, `Availability Status`, `Sign-off Status`.
6. **Column 6: Actions (Pinned Right)** — Aligned to `text-end` containing compact icon-only action buttons.
   - Standard: Use icon-only buttons with explicit tooltips (`title` attribute) and universal sizing (32×32px).

---

## 11. Universal Table Action Icon Button Standard (Icon-Only + Tooltip)

To maintain clean horizontal scannability and avoid visual clutter across data-dense enterprise tables, all table action buttons in action columns must adhere strictly to the **Icon-Only Standard**:

1. **No Text Labels**: Action buttons inside table rows must not contain written words or text labels (e.g., replace "View Details" or "Edit" with pure icons).
2. **Universal Sizing & Footprint**:
   - Every action button must share identical dimensions: `32px` × `32px` square footprint (`d-inline-flex align-items-center justify-content-center p-0` with `style={{ width: '32px', height: '32px' }}`).
   - Icon sizing must strictly be **16px** (`size={16}`).
3. **Mandatory Tooltip & Accessibility**:
   - Every action button must include a descriptive `title` and `aria-label` attribute clearly stating the exact action performed (e.g., `title="View Details"`, `title="Review Document"`, `title="Edit Vessel"`, `title="Remove Item"`).
4. **Standardized Semantic Icon Mappings (Lucide Icons)**:
   - **View / Inspect Details:** `<Eye size={16} />`
   - **Open Asset / External Workspace:** `<ExternalLink size={16} />` or `<FolderOpen size={16} />`
   - **Review Document / Verify:** `<FileCheck size={16} />` or `<FileText size={16} />`
   - **Edit / Modify Record:** `<Pencil size={16} />`
   - **Remove / Delete / Detach:** `<Trash2 size={16} />` (Destructive: `btn-outline-danger`)
   - **CAPA / Corrective Actions:** `<AlertTriangle size={16} />` or `<ShieldAlert size={16} />`
   - **Upload / Replace Version:** `<Upload size={16} />`
   - **Download Asset / Certificate:** `<Download size={16} />`

---

## 12. Bulletproof Enterprise Mock Data Schema, Taxonomy & Relational Invariants

To eliminate data corruption, broken foreign keys, and test suite regressions, all AI agents and developers must strictly follow this canonical relational schema and taxonomy architecture across all mock data modules (`mockData.ts`, `projectMockData.ts`, `equipmentMockData.ts`, `crewMockData.ts`):

### A. Strict ID Naming Taxonomy
* **General Format:** `MAP-[ENTITY]-[YYYY]-[CATEGORY]-[SEQ]`
* **Vessel IDs:** `VESSEL-001` through `VESSEL-011` (11 vessels total; strictly enforced by fleet isolation tests).
* **Equipment IDs:** `EQ-001` through `EQ-013`.
* **Project IDs:** `MAP-PROJ-2026-MARINE-001` through `MAP-PROJ-2026-MARINE-015`.
* **Crew IDs:** `CREW-101` through `CREW-105` (5 seafarers total; mapped 1:1 with MOCK_DOCUMENTS).
* **Assurance Set IDs:** `AS-2026-[SEQ]`, `AS-02-P[SEQ]-MASTER`, `AS-EQP-[SEQ]`, `AS-CRW-[SEQ]`, `AS-ACT-[SEQ]`.
* **User IDs:** `USR-201` through `USR-211`.
* **Document IDs:** `MAP-[VES|CRW|EQP|DOC]-2026-[STAT|STCW|LIFT]-[SEQ]`.

### B. Canonical Entity State & Taxonomy Mappings (100% Coverage Requirement)
1. **Vessels (`MOCK_VESSELS`)**:
   - **Operational Statuses (Set 1 Taxonomy):** `In Operations`, `In Transit`, `Dry Docking`, `Lay-up`, `Port Stay`, `Under Charter`, `Active`, `Standby`, `Maintenance`, `Decommissioned`.
   - **Classification Societies:** `DNV`, `ABS`, `Bureau Veritas`, `RINA`, `Lloyd's Register`.
   - **Fleet Isolation Invariant:** `VESSEL-001`..`007` owned by `Northwind Marine Pty Ltd`; `VESSEL-008` (Meridian), `VESSEL-009` (Austral), `VESSEL-010` (Oceanic Horizon), `VESSEL-011` (Southern Basin). Do NOT expand array length beyond 11 without updating test invariants.

2. **Equipments (`MOCK_EQUIPMENT_DATA`)**:
   - **Categories:** `Fire-Fighting Equipment`, `Navigation & Bridge Equipment`, `Life-Saving Appliances`, `Machinery & Propulsion`, `Other`.
   - **Availability States:** `Available`, `On Charter`, `Under Maintenance`, `Unavailable`, `Pending`, `Unknown`.
   - **Compliance States:** `Compliant`, `Partially Compliant`, `Non-Compliant`, `Under Review`.
   - **Classification Statuses:** `Surveyed`, `In Progress`, `Overdue`, `Uncertified`.

3. **Projects (`PROJECT_SEED_DATA`)**:
   - **Operational Statuses:** `Draft`, `Composing`, `Assurance In Progress`, `Ready for Charter`, `Closed`.
   - **Project Types:** `Charter / Voyage`, `Service Engagement`, `Crew Provision`, `Equipment Rental`, `Assurance Campaign`, `Mixed / Composite`.
   - **Work Locations:** `Onboard`, `Shoreside`, `Offshore`, `Mixed`.
   - **Risk Profiles:** `Standard`, `Elevated`, `High-Risk`, `Armed Escort Required`.

4. **Assurance Sets (`MOCK_ASSURANCE_SETS` & `PROJECT_SEED_ASSURANCE_SETS`)**:
   - **Scopes / Types:** `Project`, `Vessel`, `Crew`, `Equipment`, `Activity`.
   - **Workflow Stages:** `Initiated`, `Validation`, `Verification`, `Inspection`, `Approval`, `Certified`, `Approved`.
   - **Approver Decisions:** `Approved`, `Returned for Correction`, `Rejected`, `Pending`.

5. **Users & Crew (`MOCK_USERS`, `MOCK_CREW`)**:
   - **User Statuses:** `Active`, `Pending Invitation`, `Inactive`.
   - **Crew Compliance:** `Fully Compliant`, `Expiring < 60 Days`, `Document Deficient`.

### C. Relational Foreign Key Integrity Rules
1. **Assurance Set -> Vessel Linkage:** Any assurance set defining a `vesselId` MUST link to an existing `vessel.id` in `MOCK_VESSELS`, and MUST synchronize matching `set.vesselName === vessel.name` and `set.imoNumber === vessel.imoNumber`. Never invent orphan vessel IDs in assurance sets.
2. **Project Master -> Sub-Set Linkage:** Every master assurance set (`isProjectMaster: true`) MUST have a valid `parentProjectId`, and all IDs in `aggregatedFromSetIds` MUST resolve to existing child assurance sets.
3. **Equipment -> Vessel Linkage:** Equipment records with `parentVesselId` MUST reference a valid vessel ID or `null`.
4. **Crew -> Vessel Linkage:** Crew records with `currentVesselId` MUST reference a valid vessel ID or `null`.
5. **Document -> Asset Linkage:** Certificates in `MOCK_DOCUMENTS` must match corresponding statutory/STCW certificates defined in parent entities.

