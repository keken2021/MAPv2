---
name: map-table-standards
description: Enterprise data table standards for MAPv2: standardized 6-column ID-first column sequence, 32x32px icon-only action buttons with tooltips, table cell breathing room padding, sort/filter control uniqueness, and mandatory pagination. Use whenever creating, editing, or refactoring data tables, column headers, table actions, or list views.
---

# MAPv2 Enterprise Table Architecture & Standards

This skill governs the structure, column ordering, action controls, and spacing for all enterprise data tables across the application.

---

## 1. Universal Table Column Sequence (ID-First Architecture)

To guarantee predictable data scannability, vertical alignment, and cognitive ease, every data table across MAPv2 must strictly follow the standardized 5–6 column sequence:

| Column | Purpose | Formatting & Conventions | Examples |
| :--- | :--- | :--- | :--- |
| **Col 1** | **Identifier / Code (`ID`)** | **IBM Plex Mono** (`font-mono-code fw-semibold text-primary`) | Crew ID (`c.id`), IMO / Vessel ID (`v.imoNumber`), Certificate No / ID (`doc.certificateNo`), CAPA ID (`capa.id`), Set ID (`s.id`), Equipment Identifier (`item.equipmentIdentifier`), Offering ID (`item.id`), User ID (`u.id`), Timestamp (`ev.timestampUtc`). |
| **Col 2** | **Name / Title / Profile / Asset** | Primary human-readable title or entity label | Seafarer Profile (Photo + Full Name + Rank), Document Title, Vessel Name, CAPA Finding / Title, Equipment Name, Campaign Title, Offering Title & Media, User Name & Email. |
| **Col 3** | **Context / Category / Type / Scope** | Contextual classification, entity subtype, or issuing body | Current Vessel Assignment, Type & Issuing Authority, Class Notation & Vessel Type, Assigned Role & Organization, Equipment Category, Vessel Scope & Owner. |
| **Col 4** | **Validity / Date / Period / Metric** | Temporal milestones or key metric readouts | Expiry Date, Service Period, Due Date, Charter Window, Parent Vessel, Readiness Score. |
| **Col 5** | **Status / Compliance State** | Standardized semantic status badge | STCW Compliance Status, Compliance State, Operational Status, Workflow Stage, Availability Status, Sign-off Status. |
| **Col 6** | **Actions (Pinned Right)** | Pinned right (`text-end`) containing compact icon-only action buttons | View Details, Edit, Remove, Upload, Review, CAPA actions. |

---

## 2. Universal Table Action Icon Button Standard (Icon-Only + Tooltip)

All action buttons inside table rows must adhere strictly to the **Icon-Only Standard**:

1. **No Text Labels**: Action buttons inside table rows must not contain written words or text labels (e.g., never write `"View Details"` or `"Edit"` inside the button).
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

## 3. Table Cell Spacing & Breathing Room

- **Table Cell Padding:** Table cells (`<td>` and `<th>`) must maintain a minimum horizontal padding of **16px** (`px-4`) and vertical padding of **12px** (`py-3`).
- **Anti-Crowding:** Text, IDs, and status pills must never touch cell edges or divider lines.

---

## 4. Sort & Filter Control Uniqueness

- If a table column already has a built-in sort control (header click with `<ArrowUpDown size={14} />`, `<ArrowUp size={14} />`, or `<ArrowDown size={14} />`), do not add a separate sort button in the toolbar or filter row for the same column.
- One control per function per context.

---

## 5. Pagination (Mandatory)

- Every table that lists records is paginated: 10 rows per page by default, with 10, 25, and 50 offered. No infinite scroll and no scrolling table body.
- Use `usePagination` (`src/utils/usePagination.ts`) for the rows and render `<TablePagination />` (`src/components/common/TablePagination.tsx`) directly under the table. Never build a one-off pager.
- Pass every search, filter, sort, and tab value of the table as reset keys so a change returns to page 1.
- Export, counts, and empty states use the full filtered list, not the current page.
- Full rules, footer layout, and exceptions: `map-design-system`, section 10 (Table Pagination Standard).
