# 001 - Contract card on Project detail: show the chain once

Status: TODO
Written against: `ProjectDetailView.tsx` as of 2026-10-28 (file mtime 1793182144674). No git hash available.
Effort: S. Risk: low (view-only change, no data model change).
Related ADO task: 5200 (Project - Organizations and contract chain).

## Why
BRD V4.2 BR-19 / FR-47 only require that MAP records the contract chain (client, head contractor, vendor) and each organization's group, so linked accounts can be added later. The data is needed; the current card shows the same organizations twice, and does not read as a chain.

Current problems in the "Contract" card:
1. Duplicate display: the three role cells (Client / Head contractor / Vendor) and the party list below repeat the same organizations.
2. The party list shows the group (Client / Vendor / Third party) but not the chain role, so a head contractor appears as just "Vendor".
3. The three cells sit side by side with no order or connection, so they do not read as a chain.
4. "Not recorded" appears three times in one row for a project with no data.
5. The pending on-hire date takes a full block with a long sentence.
6. Project value, currency and multi-year dates are in a separate row of loose labels. Project value is a key complexity driver in the stakeholder summary (value and duration rank first), so it deserves a clear place, but it must be one summary row, not repeated elsewhere.

## Scope
Edit only: `src/views/ProjectDetailView.tsx` (the block that starts `{(project.contractParties?.length ||` and ends before `<ul className="nav nav-tabs">`).
Do not touch: `types/project.ts`, `utils/projectHelpers.ts`, `CreateProjectView.tsx`, mock data, any other view. The helpers `CONTRACT_CHAIN_LABELS`, `contractPartyByRole`, `formatProjectValue` already exist and are already imported.

## Target design
One card titled "Contract", three parts:
1. **Chain row**: Client -> Head contractor -> Vendor, left to right, each as a small box with the label on top, the organization name, and its group as a badge. Arrows (text "->" or a chevron icon) between boxes. A missing role shows one muted "Not recorded" in its own box only.
2. **Other parties**: only parties with no `chainRole` (for example Third party). Hidden when there are none. One line each: organization plus group badge.
3. **Summary row**: Project value (formatted), Multi-year term (start -> end), and On-hire date. The on-hire date stays labeled Pending, with the one-line note "Not confirmed with the client. Not applied to the project's sets."

Keep the empty-card rule: show the card only when any of contractParties, projectValue, multiYearStart or onHireDate exists (unchanged).

## Steps
1. Open `src/views/ProjectDetailView.tsx`. Keep the existing outer condition and card wrapper.
2. Replace the `row g-3 mb-3` block (three `col-md-4` cells) with a flex row: for each role in `["client", "head_contractor", "vendor"]`, render a bordered box with the label, `party?.organization || "Not recorded"` (muted when empty), and `party?.group` as a `badge bg-light text-dark border`. Put a `ChevronRight` icon (lucide-react, already used in this codebase) or the text "->" between boxes. On screens under the `md` breakpoint the boxes may stack.
3. Replace the party `<ul>` with a list filtered to `!party.chainRole`. Render nothing when the filtered list is empty.
4. Keep the Project value, Multi-year dates and On-hire fields, but put them in one `d-flex flex-wrap gap-4 small` row. Shorten the on-hire note to one line. Keep the Pending badge.
5. Do not change any data, type or helper.

## Verify
- `npm run build` (or `npx tsc --noEmit`) passes.
- `npm test` passes unchanged. Do not edit existing tests.
- Manual, in `npm run dev`: open the Oil Co LNG project. The chain shows once, with group badges. Open a project with no chain data: the card hides. Open a project with a chain but no head contractor: only that box says "Not recorded". Check the project in a narrow window: no horizontal scroll.

## Stop and report instead of improvising if
- The block text does not match the excerpt (someone already changed it).
- You feel you need to change a type, helper or mock data. That is out of scope.

## Maintenance note
When linked group accounts or the CRM view are built after the MVP, they extend the Other parties section and the chain row. The shared on-hire date (A-02) stays pending until Peter confirms. When it is confirmed, remove the Pending badge and decide whether it copies to sets.
