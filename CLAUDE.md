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
10. **Initial Project Folder Scanning**: Before planning or implementing changes, always scan the whole folder structure of the project first and systematically take note of all top-level folders, nested subfolders, and what they contain for faster lookup, effortless navigation, and complete structural awareness.

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

## 9. Design Precedence & Workflow

* **Precedence Order:** The user's request, then Sections 1-8 of this document, then the rules below. Existing components, tokens, and views always outrank a new idea. Extend the system only where the requested work needs something that does not exist yet.
* **Read Before Designing:** Inspect the target view, its sibling views, and the shared components before writing markup. Reuse an existing component before creating a variant of it.
* **One Mode per Task:** Classify the request before starting and stay inside that mode:
  * *New view or major redesign:* Identify the primary user, their main task, and the one action that matters most. Reading order is orientation, primary content, primary action, then secondary detail.
  * *Product or dashboard work:* Make the current location, primary task, and next action obvious. Prefer standard navigation, forms, tables, tabs, menus, and dialogs over novel replacements.
  * *Polish:* Improve the interface that exists. Preserve its visual language, content, behavior, and scope. Polish is not a concealed redesign.
  * *Simplify:* Remove repeated copy, duplicate actions, decorative noise, and containers that do not clarify grouping. Never remove labels, focus states, error messages, or recovery paths.
  * *Audit:* Report only what is observable. Return at most three findings ordered by user impact, each with its evidence and the smallest concrete correction. An audit does not modify code unless fixes were also requested.
* **Scope Discipline:** Do not redesign working areas outside the requested scope. Leave areas that already work alone.

---

## 10. Surface, Depth & Elevation

* **Flat by Default:** No gradients, glows, neon or over-saturated colors, glassmorphism, bevels, embossing, or 3D effects.
* **Shadows:** Separation comes from the `1px solid #E2E8F0` border, not from elevation. `shadow-md`, `shadow-lg`, `shadow-xl`, and `shadow-2xl` are not used on cards, tables, or panels. Overlays that float above the page (modals, drawers, menus, popovers, toasts) may use a single diffuse shadow at 5% opacity or less.
* **Grouping Order:** Group with spacing and alignment first, a divider second, a bordered card last. Do not nest cards inside cards.
* **Cards Communicate Grouping:** A card exists to mark a distinct object or group. Do not wrap every block in a card, and do not add cards to fill a grid.
* **Radius:** Controls and inputs `6px`, cards and modals `8px`, `12px` maximum for any container. Nested surfaces are concentric: outer radius equals inner radius plus padding. `rounded-full` remains reserved for status badges, dots, and switches.
* **Color Is Scarce:** Large surfaces stay white or `#F8FAFC`. No brand-colored or semantic-colored section backgrounds. Color appears only for status meaning, the primary action, and focus.

---

## 11. Status Color Pairs

Status badges use a desaturated tint with a dark text tone of the same hue. Each status maps to exactly one pair, and the mapping lives in the centralized store files, never in a component.

| Meaning | Background | Text |
| :--- | :--- | :--- |
| Success / compliant | `#EDF3EC` | `#346538` |
| Warning / expiring | `#FBF3DB` | `#956400` |
| Critical / overdue | `#FDEBEC` | `#9F2F2D` |
| Informational / in progress | `#E1F3FE` | `#1F6C9F` |
| Neutral / inactive | `#F8FAFC` | `#64748B` |

* **Never Hue Alone:** A status is always carried by its text label as well as its color.
* **No Random Accents:** Do not choose a color per component. A color is justified only when it encodes a real category or state.

---

## 12. Required States

Every view, table, form, drawer, and modal covers the states it can actually reach before it is considered complete:

* **Loading:** A skeleton or indicator that occupies the final layout dimensions.
* **Empty:** States what belongs here and offers the action that creates the first record.
* **Error:** States what went wrong and how to recover, inline and next to the cause.
* **Success:** Confirmation through a toast or inline state change.
* **Disabled:** Visibly inactive, with the reason discoverable.
* **Selected / Expanded:** Distinguishable without relying on color alone.
* **Overlays:** Menus, popovers, and dropdowns must never be clipped by a scroll or `overflow` container.

---

## 13. Motion & Layout Stability

* **Purpose:** Motion explains a state change or gives feedback. Do not choreograph routine page loads, and do not add scroll-entry or ambient animation to product views.
* **Animatable Properties:** `transform` and `opacity` only. Never animate `top`, `left`, `margin`, `width`, or `height`. Never use `transition: all` / `transition-all`; name the property.
* **Duration:** 150ms to 200ms for hover, press, and toggle feedback.
* **Press Feedback:** `scale(0.98)` on `:active` for buttons.
* **Stable Geometry:** Padding, border width, font size, font weight, and line height do not change on hover or state change. Swapped labels and icons (copied, loading, success) occupy one fixed slot.
* **Reserved Dimensions:** Every image, video, and asynchronously populated region declares `width` and `height` or `aspect-ratio`, or has a fixed or minimum height.
* **Hover Gating:** Hover-only effects sit behind `@media (hover: hover) and (pointer: fine)`.
* **Reduced Motion:** Nonessential animation is disabled under `prefers-reduced-motion: reduce`, and the view stays fully usable.

---

## 14. Responsive Behavior, Accessibility & Performance

* **Structural Responsiveness:** Decide what stacks, collapses, scrolls, or stays fixed. Do not shrink the desktop layout. Below `768px`, complex layouts reduce to one intentional column with DOM reading order preserved.
* **Fluid Containers:** Use `clamp()`, `min()`, and `max()` for container widths and gutters (for example `clamp(24px, 3vw, 32px)`). Type sizes stay on the fixed scale in Section 2.
* **No Horizontal Page Scroll:** Only tables and code blocks may scroll sideways, each inside its own `overflow-x: auto` container.
* **Hit Targets:** Every interactive control has at least a `40px` hit area, extended with padding or a pseudo-element when the visual size is smaller.
* **Focus:** Every interactive element shows the `:focus-visible` ring from Section 3. Never remove an outline without replacing it.
* **Contrast:** Text meets 4.5:1 against its background; large text, icons, and control borders meet 3:1.
* **Numerals:** `font-variant-numeric: tabular-nums` wherever digits change or align in columns.
* **Headings:** `text-wrap: balance` on short headings.
* **Images:** The primary above-the-fold image uses `fetchpriority="high"` and is not lazy-loaded. Images below the fold use `loading="lazy"`.
* **Code Splitting:** Route-level views are lazy-loaded. Do not add a dependency for an effect CSS or the current stack can already produce.
* **Event Handlers:** Debounce or throttle scroll, resize, and keyup handlers. Keep click and submit handlers lean.

---

## 15. Content & Copy

* **Plain Language:** Write specific, direct copy. Banned filler: "Elevate", "Seamless", "Unleash", "Next-Gen", "Game-changer", "Delve".
* **Realistic Content:** No "John Doe", "Acme Corp", or lorem ipsum. Mock records follow Section 1 naming and read like real maritime operations data.
* **One Primary Action:** Each view has one obvious primary button and a small number of clearly subordinate actions.
* **Progressive Disclosure:** Advanced or infrequent controls may be tucked away. Required actions are never hidden behind an unlabelled interaction.
* **No AI-Styled Badges:** No "powered by AI" banners, gradient badges, or decorative shields.
* **Code Comments:** Lowercase only.
* **Function Documentation:** State what the function does and its inputs, how it works, and which file holds it and which files it interacts with.

---

## 16. Finish Gate

Before handing off any UI change:

1. Render the changed view once at desktop and mobile width when the environment supports it.
2. Fix observable breakage: clipping, overlap, overflow, distorted media, awkward wrapping, inaccessible controls, broken focus, inert interactions.
3. Confirm the states in Section 12 exist for what was touched.
4. Confirm no label, scope identifier, or sort control was duplicated (Section 1, rules 4-6).
5. Keep the handoff short: what changed, what was verified, what was not.
