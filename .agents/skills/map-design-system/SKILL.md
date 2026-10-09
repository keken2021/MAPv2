---
name: map-design-system
description: UI/UX design tokens, layout rules, typography, color palette, container padding, edge clearance, interactive buttons, modal architecture, dropdown chevron protection, Lucide icons, required field indicators, concise UI copy, and NN/g usability heuristics for MAPv2 workspace. Use whenever designing, creating, editing, or refactoring UI components, cards, modals, forms, and page layouts.
---

# MAPv2 UI/UX Design System & Architectural Specification

This skill governs the visual styling, spacing tokens, responsive typography, modal layouts, interactive controls, and UI heuristics across the MAPv2 application.

---

## 1. Core Visual Principles

1. **Strict No-Emoji Policy**: Never use emojis in the UI, code, mock data, or documentation files under any circumstances. Use professional Lucide SVG icons or clean semantic typography.
2. **Mandatory & Required Indicators (*)**: All mandatory field indicators, asterisks (`*`), mandatory requirement tags/badges, and warning indicators signifying required inputs or required assurance items MUST strictly be colored in high-contrast semantic red (`text-danger` / `#DC2626` / `rgb(220, 38, 38)`). Never use muted, gray, or neutral colors for required or mandatory indicators.
3. **No Label Duplication**: Never repeat the same label, title, or descriptor on a single screen. If a heading already declares a context (e.g. "Plant"), do not add a badge, sub-label, or tag that restates it. Each piece of information must appear exactly once.
4. **Scope Inheritance — No Redundant Scope Labels**: If the assurance scope has already been declared (e.g. the page title, step header, or card title already says "Project" or "Vessel"), do not add the same scope identifier again in child elements, badges, or sub-labels within the same view.
5. **Concise UI Naming Convention**: All UI labels, button text, step names, card titles, and modal headings must be short and direct. Avoid conversational filler words (`"Section"`, `"Pillar"`, `"Please"`, `"Click to"`). Prefer: `"Plant"` over `"Plant Section"`, `"Vessels"` over `"Chartered Vessels"`, `"Documents"` over `"Required Documents & Information (Statutory)"`.
6. **Badge Minimalism**: Badges are reserved exclusively for: (a) status indicators with semantic color meaning, (b) numeric counts, (c) short codes or IDs (e.g. IMO numbers, MAP IDs). Do not use badges to repeat text that is already visible in a nearby heading, label, or title on the same screen.

---

## 2. Typography & Font Mappings

The system utilizes **IBM Plex Sans** as the primary font family across all user interfaces, paired with **IBM Plex Mono** specifically for numerical data, system codes, and identifiers to ensure tabular alignment and legibility.

### Global Font Stack

* **Primary Sans Family:** `'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`
* **Monospace / Tabular Family:** `'IBM Plex Mono', SFMono-Regular, Menlo, Monaco, Consolas, monospace`

### Component-Specific Typography Tokens

* **Page Titles (H1):**
  * Font: IBM Plex Sans | Weight: Bold (700) | Size: 24px (Leading: 32px) | Color: `rgb(11, 27, 43)` (`#0B1B2B`)
* **Section Headers (H2):**
  * Font: IBM Plex Sans | Weight: Semi-Bold (600) | Size: 18px (Leading: 26px) | Color: `rgb(51, 65, 85)` (`#334155`)
* **Card & Modal Headers (H3):**
  * Font: IBM Plex Sans | Weight: Semi-Bold (600) | Size: 16px (Leading: 24px)
* **Body Text & Paragraphs:**
  * Font: IBM Plex Sans | Weight: Regular (400) | Size: 14px (Leading: 20px) | Color: `rgb(51, 65, 85)` (`#334155`)
* **Form Labels:**
  * Font: IBM Plex Sans | Weight: Medium (500) | Size: 13px (Leading: 18px) | Color: `rgb(100, 116, 139)` (`#64748B`)
* **Buttons & Interactive Controls:**
  * Font: IBM Plex Sans | Weight: Medium (500) | Size: 14px (Leading: 20px)
* **Badges, Tags & Pills:**
  * Font: IBM Plex Sans | Weight: Medium (500) | Size: 12px (Leading: 16px)
* **Document IDs, IMO Numbers & Tabular Numeric Cells:**
  * Font: IBM Plex Mono | Weight: Regular (400) or Medium (500) | Size: 13px (Leading: 18px)
* **Audit Logs, JSON Payloads & System Code:**
  * Font: IBM Plex Mono | Weight: Regular (400) | Size: 12px (Leading: 16px)

---

## 3. Color Palette & Brand Identity

* **Primary Brand Base:** `rgb(11, 27, 43)` (`#0B1B2B`) — Primary navigation bars, dark headers, structural containers, and solid primary buttons on light backgrounds.
* **Primary Interactive & Hover States:**
  * **Default State:** `rgb(11, 27, 43)` (`#0B1B2B`) with text `rgb(255, 255, 255)` (`#FFFFFF`).
  * **Hover State:** `rgb(30, 58, 95)` (`#1E3A5F`) — Calibrated, elevated navy tone ensuring clear visual feedback without breaking brand affinity.
  * **Active / Pressed State:** `rgb(8, 19, 31)` (`#08131F`).
  * **Focus Ring:** `rgb(56, 189, 248)` (`#38BDF8` / Sky 400) with a 2px offset for high-contrast keyboard navigation.
* **Surface & Neutral Scale:**
  * **App Background:** `rgb(248, 250, 252)` (`#F8FAFC` / Slate 50)
  * **Container / Card Background:** `rgb(255, 255, 255)` (`#FFFFFF`)
  * **Borders & Dividers:** `rgb(226, 232, 240)` (`#E2E8F0` / Slate 200)
  * **Muted / Secondary Text:** `rgb(100, 116, 139)` (`#64748B` / Slate 500)
  * **Primary Text:** `rgb(51, 65, 85)` (`#334155` / Slate 700)

---

## 4. Iconography Standards

* **Mandatory Icon Library:** **Lucide Icons** (`lucide-react`) must be used exclusively across the entire system. Do not mix icon packs or use raw Unicode glyphs.
* **Icon Sizing Rules:**
  * Inline text icons: `16px` (`w-4 h-4` or `size={16}`)
  * Button and action icons: `18px` (`w-[18px] h-[18px]` or `size={18}`)
  * Header and navigation icons: `20px` (`w-5 h-5` or `size={20}`)
  * Empty state / Hero illustrations: `32px` to `48px` (`w-8 h-8` to `w-12 h-12`)
* **Icon Colors:** Default to `rgb(100, 116, 139)` (`#64748B`), changing to active brand states (`rgb(11, 27, 43)`) or semantic colors (success green, error red) based on context.

---

## 5. Layout, Margins & Spacing (Edge Clearance & Anti-Crowding)

* **Spacing Scale:**
  * `xs`: 4px (`space-1` / `p-1`) — Tight badge padding, inline icon-to-text gaps.
  * `sm`: 8px (`space-2` / `p-2`) — Form field internal gaps, compact chip spacing.
  * `md`: 16px (`space-4` / `p-4`) — Standard card internal padding, component container gutters.
  * `lg`: 24px (`space-6` / `p-6`) — Section spacing, modal inner padding, drawer body padding.
  * `xl`: 32px (`space-8` / `p-8`) — Major layout block separators, page headers.

* **Mandatory Container Padding & Edge Clearance Rules:**
  * **Card & Panel Inner Padding:** All cards, widgets, sub-panels, and summary boxes must maintain a mandatory minimum internal padding of **16px** (`p-4` or `16px` to `20px`). Never use `0px`, `p-1`, or `p-2` on parent container cards.
  * **Modal & Drawer Inner Body Padding:** Modals and slide-out drawers must maintain a minimum internal body padding of **20px to 24px** (`p-5` to `p-6`).
  * **Nested Sub-Boxes & Highlight Strips:** Any nested alert box, key-metric strip, or callout container must have at least **12px to 16px** (`p-3` to `p-4`) internal padding so content never touches the bounding border.
  * **Form Input Inset:** Text inputs, dropdowns, and search fields must provide at least **12px to 14px** horizontal padding (`px-3.5 py-2`) so typed text, placeholders, and prefix/suffix icons do not collide with input borders.
  * **Anti-Border Crowding Rule:** Text lines, headings, badges, and interactive controls must never sit flush against a border. Always enforce at least **12px to 16px** of clear whitespace between content and any enclosing border.

---

## 6. Interactive Elements & Buttons

* **Border Radius:** Buttons must have a clean, modern rounded corner (`rounded-md` or `6px` radius). Fully pill-shaped (`rounded-full`) buttons are strictly reserved for status badges and tags, not primary interactive controls.
* **Padding (Compact & Balanced):**
  * *Medium (Standard):* `px-3.5 py-2` (Horizontal: 14px, Vertical: 8px)
  * *Small (Dense Toolbars):* `px-2.5 py-1.5` (Horizontal: 10px, Vertical: 6px)
* **Button Component Variations:**
  * **Primary Solid:** Background `rgb(11, 27, 43)`, text white. On hover, shifts to `rgb(30, 58, 95)`.
  * **Secondary / Outline:** Transparent background, `1px solid` border (`#E2E8F0`), text `#334155`. On hover, background shifts to `#F8FAFC`.
  * **Destructive:** Background `#DC2626`, text white. On hover, shifts to `#B91C1C`.

---

## 7. Universal Modal Architecture & Dropdown Standards

* **Dropdown Chevron Fade Protection:**
  - All `<select>` controls and dropdown inputs must enforce generous right padding (`padding: 9px 42px 9px 14px` or `padding-right: 2.5rem`), `text-overflow: ellipsis`, and `overflow: hidden`.
  - When option text can be long, implement an overlay fade gradient mask (`linear-gradient(to right, rgba(255, 255, 255, 0), rgba(255, 255, 255, 1))`) positioned at `right: 28px` with `pointer-events: none` directly before the chevron icon to prevent text collision.

* **Unified Modal Layout Architecture:**
  - **Modal Header:** `#0B1B2B` navy background, white title (`IBM Plex Sans` 700), subtitle (`#94A3B8`), semantic Lucide icon badge, and close button (`<X size={18} />`).
  - **Modal Body:** `#F8FAFC` slate surface background with mandatory **20px to 24px** (`p-4` to `p-5`) internal body padding. All nested cards must maintain minimum **16px to 20px** internal padding.
  - **Modal Footer:** `#FFFFFF` background with `border-top: 1px solid #E2E8F0`, `px-4 py-3`, and **space-between layout** (`justify-content-between`): Secondary / Cancel button pinned to the left, and primary submit / action button on the right.

* **Category Navigation Pills:**
  - Filter pills and tab switchers must use **IBM Plex Mono** (`font-mono-code` / `fontSize: 0.8rem`) with numerical counters formatted in parentheses (e.g., `All (13)`, `Vessels (4)`, `Equipment (4)`).
  - Active pill: `#0B1B2B` background with bold white text. Inactive pill: transparent background with `#64748B` text.

---

## 8. UI/UX Heuristics (NN/g Alignment)

1. **Visibility of System Status:** Keep users informed through clear loading indicators, active pipeline steppers, breadcrumbs, and success/error notifications.
2. **Match Between System and Real World:** Use standard maritime and assurance domain terminology. Avoid raw internal database terms in user-facing labels.
3. **User Control and Freedom:** Provide clear "Cancel", "Back", and "Close" mechanisms on all drawers, modals, and multi-step wizards. Support safe exits from destructive workflows.
4. **Consistency and Standards:** Follow unified patterns across all views.
5. **Error Prevention & Inline Feedback:** Design robust form validations, disable submit actions until required fields are met, and provide clear inline error messages.
6. **Recognition Rather than Recall:** Make options and filters visible. Use searchable dropdowns and clear helper text instead of expecting users to remember complex identifiers.
7. **Aesthetic and Minimalist Design:** Eliminate extraneous visual clutter. Prioritize whitespace, clean typography, and legible data density.

---

## 9. UI Terminology

One term per concept. Use the left column in every label, heading, button, tooltip, placeholder, and message. Never introduce a variant from the right column.

### Concepts

| Use | Never |
| :--- | :--- |
| Assurance Set ("Set" only in "Set ID") | Campaign, Vetting Campaign, Assurance Campaign, Charter / Campaign |
| Organization | Organisation, Org |
| Crew | Seafarer, Personnel, Crew Member Profile |
| Inspection | Physical Survey, Visual Audit, Physical Audit, Survey |
| CAPA | Corrective Action (CAPA), Corrective Action Plan, Action Item |
| Version | Revision |
| Change Summary | Reason for Revision |
| Role | Persona, Persona Role, User Role |
| User Type | Classification (for users) |
| Class Society | Classification Society |
| Flag State | Flag, Flag State / Country, Flag State Jurisdiction |
| Issuing Authority | Issuing Body, Issuing Center |
| Certificate No. | Cert No, Cert #, Certificate Number |
| Client | Charterer / Client, Client Organization |
| Service Provider | Provider, Provider Organization, Listing Organization |
| Stakeholders | Assigned Assurance Set Stakeholders, Stakeholder Role Assignments |
| Charter Period (sets), Project Period (projects) | Charter Window, Project Window, Validity Window, Contract Start/End Date |
| Readiness (the percentage) | Readiness Score, Readiness Index, Compliance Index, STCW Score |
| Stage (set pipeline) | Workflow Stage, Stage Pipeline |
| Compliance | Compliance State, Compliance Status |
| Verification | Verification Status |
| Availability | Availability Status |
| Operating Status (vessels) | Operational Status, Fleet Status, Current Status |
| Pending Approval | Pending Sign-Off, Awaiting Final Decision |
| Returned for Correction (status), Return for Correction (action) | Correction Requested, Sent Back for Correction, Revisions Requested |

### Actions

| Use | Never |
| :--- | :--- |
| Create (sets, projects, roles) | Initiate |
| Add (vessels, crew, equipment, users, photos) | Register, Provision, Invite, Add / Upload |
| Upload Document, Upload New Version | Reupload, Re-upload / Change File, Replace Revision |
| Back, Next | Previous Step, Next Step |
| Save | Save changes, Save User Changes, Save Action Item |
| Close (read-only), Cancel (discard a form), Done | Close Viewer, Close modal, Close Detail Modal |
| Clear All | Reset All, Clear All Filters |
| Export, with items CSV and PDF | Export Data, Export as CSV (.csv) |
| View (row action tooltips) | Open, View Details, View Dossier |

### Patterns

1. **Scope inheritance in tables:** inside a table or page about X, columns drop the X prefix (`Name`, `Status`, `Category`, `Title`). ID columns keep it (`Set ID`, `Crew ID`).
2. **No slash labels:** pick one word (`Rank`, not `Rank / Position`).
3. **Filter options:** `All Statuses`, `All Roles`, `All Types`. The filter modal title is always `Filters`, with no subtitle.
4. **Search placeholder:** `Search vessels...`. Never a list of searchable fields.
5. **Empty states:** `No vessels found.` when filters hide everything, `No assurance sets yet.` when the list is empty.
6. **Casing:** Title Case for buttons, headings, field labels, and columns. Sentence case for helper text, empty states, and tooltips.
7. **Qualifiers:** drop `Assigned`, `Target`, `Active`, `Registered`, `Total`, `Overall`, `Formal` where the context already says it.
8. **No internal wording:** never show build or spec references (`MVP`, `BRD`, `UC-04`, `Option A`, `Sidepanel`) or decorative claims.

### Stored values

Role and status values in types and mock data are never renamed. Show them through `getRoleDisplayLabel` (`src/utils/userRoleHelpers.ts`) and `getStatusDisplayLabel` (`src/utils/formatters.ts`), which hold the on-screen names (for example `Administrator` shows as `Service Provider`, `C Admin` as `Client Admin`).

