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

---

## 5. Layout, Margins & Spacing

To avoid cluttered layouts and visual noise, a strict 4px/8px baseline grid scale must be followed:

* **Spacing Scale:**
  * `xs`: 4px (`space-1` / `p-1`) — Tight grouping (e.g., badge padding, icon-to-text gaps).
  * `sm`: 8px (`space-2` / `p-2`) — Component internal padding, form field gaps.
  * `md`: 16px (`space-4` / `p-4`) — Standard card padding, container gutters.
  * `lg`: 24px (`space-6` / `p-6`) — Section spacing, modal inner padding.
  * `xl`: 32px (`space-8` / `p-8`) — Major layout block separators.

* **Margin Rules:**
  * Never use arbitrary hardcoded margins (e.g., `margin: 13px`). Stick strictly to the scaling tokens.
  * Maintain consistent container gutters (`24px` or `32px`) across viewports to prevent edge-to-edge crowding.

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
