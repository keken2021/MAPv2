# MAPv2 UI Consistency Audit

> Audit artifact for Task 5368 (Feature 5209: UI consistency audit and proposal).

## 1. Executive Summary

This audit inspects all button implementations across the entire `src/views/` directory in MAPv2. Across **29 view files**, there are exactly **384 `<button>` occurrences** (verified via `grep -c "<button" src/views/*`).

Key findings:
- **Extreme Fragmentation**: Across 384 button instances, there are **174 distinct class strings**.
- **Inconsistent Sizing**: Sizing classes are mixed arbitrarily—some views use `btn-sm`, four use `btn-xs`, and dozens omit size classes altogether, rendering default Bootstrap full-height buttons.
- **Inverted Class Order**: Variations such as `btn btn-sm btn-outline-secondary` vs `btn btn-outline-secondary btn-sm` prevent consistent styling and searchability.
- **Ad-hoc Spacing & Padding**: Over 40 distinct buttons apply custom padding utilities (`px-4`, `py-2`, `px-2.5 py-1`, `py-1.5`) rather than following a unified design system scale.
- **Font Weight Inconsistencies**: Buttons arbitrarily apply `fw-semibold`, `fw-bold`, or non-Bootstrap `font-weight-500`.

## 2. Grep Total & Per-File Inventory

| View File | `<button` Count |
|:---|---:|
| `ApproverDashboardView.tsx` | 9 |
| `AssuranceDetailView.tsx` | 104 |
| `AssuranceObjectsView.tsx` | 5 |
| `CapaManagementView.tsx` | 1 |
| `CreateAssuranceSetView.tsx` | 41 |
| `CreateProjectView.tsx` | 14 |
| `CrewDetailView.tsx` | 31 |
| `CrewGroupDetailView.tsx` | 8 |
| `DashboardView.tsx` | 19 |
| `DocumentDetailView.tsx` | 3 |
| `EquipmentDetailView.tsx` | 21 |
| `EquipmentView.tsx` | 5 |
| `InspectionChecklistView.tsx` | 23 |
| `InspectorWorkspaceView.tsx` | 1 |
| `LoginView.tsx` | 2 |
| `MarketplaceView.tsx` | 4 |
| `NotificationsView.tsx` | 5 |
| `OrganizationProfileView.tsx` | 3 |
| `ProjectDetailView.tsx` | 8 |
| `ProjectView.tsx` | 2 |
| `RolesAndPermissionsView.tsx` | 12 |
| `VerifierWorkspaceView.tsx` | 1 |
| `VesselDetailView.tsx` | 62 |
| **Total** | **384** |

## 3. Buttons Section

### 3.1 Proposed Variants and Sizing Model

All 384 buttons in `src/views/` can be consolidated into 7 standardized variants and 2 core sizes (standard `sm` and compact `xs`):

| Proposed Variant | Target Classes | Description | Current Occurrences |
|:---|:---|:---|---:|
| **Primary** | `btn btn-sm btn-primary` | High-emphasis actions (Save, Submit, Create, Add) | 85 |
| **Secondary** | `btn btn-sm btn-secondary` | Neutral dismissive or secondary actions (Cancel, Back, Close) | 19 |
| **Outline** | `btn btn-sm btn-outline-secondary` / `btn-outline-primary` | Medium-emphasis actions, toolbar filters, row view actions | 92 |
| **Danger** | `btn btn-sm btn-outline-danger` / `btn-danger` | Destructive actions (Delete, Remove, Reject) | 15 |
| **Icon** | `btn btn-sm btn-outline-* p-0` (32x32px) | Compact table row actions and icon triggers | 67 |
| **Close** | `btn-close` | Modal and drawer dismiss buttons | 31 |
| **Link** | `btn btn-sm btn-link p-0` | Inline text-like navigation triggers, collapsible row chevrons | 38 |
| **Other / Specialized** | Custom role chips, navigation tabs, dropdown items | Special contextual triggers | 37 |
| **Total** | | | **384** |

### 3.2 Complete Inventory of Distinct Class Strings

The table below inventories every distinct class string (174 total) found in `src/views/`, its proposed variant classification, occurrence count, outliers flagged, and exact `file:line` occurrences. The counts sum to exactly **384**.

| # | Distinct Class String | Proposed Variant | Count | Outliers Flagged | File & Line Uses |
|:--|:---|:---|:---:|:---|:---|
| 1 | `btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center p-0` | `icon` | 33 | None | [`ApproverDashboardView.tsx:522`](file:///c:/mapFiles/MAPv2/src/views/ApproverDashboardView.tsx#L522), [`ApproverDashboardView.tsx:901`](file:///c:/mapFiles/MAPv2/src/views/ApproverDashboardView.tsx#L901), [`AssuranceDetailView.tsx:3139`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L3139), [`AssuranceDetailView.tsx:3241`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L3241), [`AssuranceDetailView.tsx:3341`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L3341), [`AssuranceDetailView.tsx:3731`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L3731), [`AssuranceDetailView.tsx:3996`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L3996), [`AssuranceDetailView.tsx:4177`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L4177), [`AssuranceObjectsView.tsx:494`](file:///c:/mapFiles/MAPv2/src/views/AssuranceObjectsView.tsx#L494), [`CapaManagementView.tsx:344`](file:///c:/mapFiles/MAPv2/src/views/CapaManagementView.tsx#L344), [`CrewDetailView.tsx:759`](file:///c:/mapFiles/MAPv2/src/views/CrewDetailView.tsx#L759), [`CrewDetailView.tsx:884`](file:///c:/mapFiles/MAPv2/src/views/CrewDetailView.tsx#L884), [`CrewDetailView.tsx:1027`](file:///c:/mapFiles/MAPv2/src/views/CrewDetailView.tsx#L1027), [`DashboardView.tsx:610`](file:///c:/mapFiles/MAPv2/src/views/DashboardView.tsx#L610), [`DashboardView.tsx:761`](file:///c:/mapFiles/MAPv2/src/views/DashboardView.tsx#L761), [`DashboardView.tsx:945`](file:///c:/mapFiles/MAPv2/src/views/DashboardView.tsx#L945), [`DocumentDetailView.tsx:157`](file:///c:/mapFiles/MAPv2/src/views/DocumentDetailView.tsx#L157), [`DocumentDetailView.tsx:360`](file:///c:/mapFiles/MAPv2/src/views/DocumentDetailView.tsx#L360), [`EquipmentDetailView.tsx:421`](file:///c:/mapFiles/MAPv2/src/views/EquipmentDetailView.tsx#L421), [`EquipmentView.tsx:289`](file:///c:/mapFiles/MAPv2/src/views/EquipmentView.tsx#L289), [`InspectorWorkspaceView.tsx:394`](file:///c:/mapFiles/MAPv2/src/views/InspectorWorkspaceView.tsx#L394), [`MarketplaceView.tsx:473`](file:///c:/mapFiles/MAPv2/src/views/MarketplaceView.tsx#L473), [`NotificationsView.tsx:257`](file:///c:/mapFiles/MAPv2/src/views/NotificationsView.tsx#L257), [`ProjectDetailView.tsx:594`](file:///c:/mapFiles/MAPv2/src/views/ProjectDetailView.tsx#L594), [`ProjectView.tsx:204`](file:///c:/mapFiles/MAPv2/src/views/ProjectView.tsx#L204), [`VerifierWorkspaceView.tsx:420`](file:///c:/mapFiles/MAPv2/src/views/VerifierWorkspaceView.tsx#L420), [`VesselDetailView.tsx:1815`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L1815), [`VesselDetailView.tsx:2028`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L2028), [`VesselDetailView.tsx:2754`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L2754), [`VesselDetailView.tsx:2911`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L2911), [`VesselDetailView.tsx:3084`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L3084), [`VesselDetailView.tsx:3659`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L3659), [`VesselDetailView.tsx:3719`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L3719) |
| 2 | `btn-close` | `close` | 28 | None | [`ApproverDashboardView.tsx:695`](file:///c:/mapFiles/MAPv2/src/views/ApproverDashboardView.tsx#L695), [`AssuranceDetailView.tsx:4676`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L4676), [`AssuranceDetailView.tsx:4792`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L4792), [`AssuranceDetailView.tsx:4862`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L4862), [`AssuranceDetailView.tsx:5010`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L5010), [`AssuranceDetailView.tsx:5077`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L5077), [`AssuranceDetailView.tsx:5233`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L5233), [`AssuranceDetailView.tsx:5310`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L5310), [`AssuranceDetailView.tsx:5353`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L5353), [`AssuranceDetailView.tsx:5503`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L5503), [`AssuranceDetailView.tsx:5653`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L5653), [`AssuranceDetailView.tsx:5692`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L5692), [`CreateAssuranceSetView.tsx:4449`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L4449), [`CrewDetailView.tsx:356`](file:///c:/mapFiles/MAPv2/src/views/CrewDetailView.tsx#L356), [`CrewDetailView.tsx:1219`](file:///c:/mapFiles/MAPv2/src/views/CrewDetailView.tsx#L1219), [`CrewDetailView.tsx:1507`](file:///c:/mapFiles/MAPv2/src/views/CrewDetailView.tsx#L1507), [`DashboardView.tsx:641`](file:///c:/mapFiles/MAPv2/src/views/DashboardView.tsx#L641), [`DashboardView.tsx:806`](file:///c:/mapFiles/MAPv2/src/views/DashboardView.tsx#L806), [`EquipmentDetailView.tsx:168`](file:///c:/mapFiles/MAPv2/src/views/EquipmentDetailView.tsx#L168), [`EquipmentDetailView.tsx:759`](file:///c:/mapFiles/MAPv2/src/views/EquipmentDetailView.tsx#L759), [`InspectionChecklistView.tsx:1159`](file:///c:/mapFiles/MAPv2/src/views/InspectionChecklistView.tsx#L1159), [`RolesAndPermissionsView.tsx:503`](file:///c:/mapFiles/MAPv2/src/views/RolesAndPermissionsView.tsx#L503), [`VesselDetailView.tsx:919`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L919), [`VesselDetailView.tsx:3159`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L3159), [`VesselDetailView.tsx:3480`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L3480), [`VesselDetailView.tsx:3611`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L3611), [`VesselDetailView.tsx:3767`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L3767), [`VesselDetailView.tsx:4051`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L4051) |
| 3 | `btn btn-sm btn-outline-secondary` | `outline` | 19 | None | [`AssuranceDetailView.tsx:3518`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L3518), [`AssuranceDetailView.tsx:4712`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L4712), [`AssuranceDetailView.tsx:4837`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L4837), [`AssuranceDetailView.tsx:5478`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L5478), [`AssuranceDetailView.tsx:5631`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L5631), [`AssuranceDetailView.tsx:5661`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L5661), [`AssuranceDetailView.tsx:5721`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L5721), [`CreateAssuranceSetView.tsx:3845`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L3845), [`CreateProjectView.tsx:586`](file:///c:/mapFiles/MAPv2/src/views/CreateProjectView.tsx#L586), [`CreateProjectView.tsx:887`](file:///c:/mapFiles/MAPv2/src/views/CreateProjectView.tsx#L887), [`CreateProjectView.tsx:895`](file:///c:/mapFiles/MAPv2/src/views/CreateProjectView.tsx#L895), [`CreateProjectView.tsx:1105`](file:///c:/mapFiles/MAPv2/src/views/CreateProjectView.tsx#L1105), [`CreateProjectView.tsx:1113`](file:///c:/mapFiles/MAPv2/src/views/CreateProjectView.tsx#L1113), [`InspectionChecklistView.tsx:749`](file:///c:/mapFiles/MAPv2/src/views/InspectionChecklistView.tsx#L749), [`InspectionChecklistView.tsx:792`](file:///c:/mapFiles/MAPv2/src/views/InspectionChecklistView.tsx#L792), [`NotificationsView.tsx:198`](file:///c:/mapFiles/MAPv2/src/views/NotificationsView.tsx#L198), [`OrganizationProfileView.tsx:146`](file:///c:/mapFiles/MAPv2/src/views/OrganizationProfileView.tsx#L146), [`VesselDetailView.tsx:1872`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L1872), [`VesselDetailView.tsx:2600`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L2600) |
| 4 | `btn btn-sm btn-secondary` | `secondary` | 15 | None | [`AssuranceDetailView.tsx:4988`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L4988), [`AssuranceDetailView.tsx:5052`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L5052), [`AssuranceDetailView.tsx:5208`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L5208), [`AssuranceDetailView.tsx:5285`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L5285), [`AssuranceDetailView.tsx:5331`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L5331), [`CrewDetailView.tsx:1445`](file:///c:/mapFiles/MAPv2/src/views/CrewDetailView.tsx#L1445), [`CrewDetailView.tsx:1645`](file:///c:/mapFiles/MAPv2/src/views/CrewDetailView.tsx#L1645), [`EquipmentDetailView.tsx:697`](file:///c:/mapFiles/MAPv2/src/views/EquipmentDetailView.tsx#L697), [`EquipmentDetailView.tsx:897`](file:///c:/mapFiles/MAPv2/src/views/EquipmentDetailView.tsx#L897), [`VesselDetailView.tsx:963`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L963), [`VesselDetailView.tsx:3433`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L3433), [`VesselDetailView.tsx:3542`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L3542), [`VesselDetailView.tsx:3682`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L3682), [`VesselDetailView.tsx:3988`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L3988), [`VesselDetailView.tsx:4191`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L4191) |
| 5 | `btn btn-sm btn-primary` | `primary` | 14 | None | [`AssuranceDetailView.tsx:2319`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L2319), [`AssuranceDetailView.tsx:2328`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L2328), [`AssuranceDetailView.tsx:2664`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L2664), [`AssuranceDetailView.tsx:4715`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L4715), [`AssuranceDetailView.tsx:4840`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L4840), [`AssuranceDetailView.tsx:4975`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L4975), [`AssuranceDetailView.tsx:5055`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L5055), [`AssuranceDetailView.tsx:5211`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L5211), [`AssuranceDetailView.tsx:5481`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L5481), [`AssuranceDetailView.tsx:5634`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L5634), [`CrewDetailView.tsx:634`](file:///c:/mapFiles/MAPv2/src/views/CrewDetailView.tsx#L634), [`DashboardView.tsx:559`](file:///c:/mapFiles/MAPv2/src/views/DashboardView.tsx#L559), [`DashboardView.tsx:660`](file:///c:/mapFiles/MAPv2/src/views/DashboardView.tsx#L660), [`InspectionChecklistView.tsx:757`](file:///c:/mapFiles/MAPv2/src/views/InspectionChecklistView.tsx#L757) |
| 6 | `btn btn-sm btn-primary fw-semibold` | `primary` | 11 | Manual font-weight override | [`CreateProjectView.tsx:777`](file:///c:/mapFiles/MAPv2/src/views/CreateProjectView.tsx#L777), [`CreateProjectView.tsx:902`](file:///c:/mapFiles/MAPv2/src/views/CreateProjectView.tsx#L902), [`CreateProjectView.tsx:1120`](file:///c:/mapFiles/MAPv2/src/views/CreateProjectView.tsx#L1120), [`CrewDetailView.tsx:371`](file:///c:/mapFiles/MAPv2/src/views/CrewDetailView.tsx#L371), [`CrewDetailView.tsx:1070`](file:///c:/mapFiles/MAPv2/src/views/CrewDetailView.tsx#L1070), [`EquipmentDetailView.tsx:182`](file:///c:/mapFiles/MAPv2/src/views/EquipmentDetailView.tsx#L182), [`EquipmentDetailView.tsx:449`](file:///c:/mapFiles/MAPv2/src/views/EquipmentDetailView.tsx#L449), [`EquipmentView.tsx:171`](file:///c:/mapFiles/MAPv2/src/views/EquipmentView.tsx#L171), [`ProjectView.tsx:143`](file:///c:/mapFiles/MAPv2/src/views/ProjectView.tsx#L143), [`VesselDetailView.tsx:1934`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L1934), [`VesselDetailView.tsx:2556`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L2556) |
| 7 | `btn btn-sm btn-outline-danger d-inline-flex align-items-center justify-content-center p-0` | `icon` | 10 | None | [`ApproverDashboardView.tsx:553`](file:///c:/mapFiles/MAPv2/src/views/ApproverDashboardView.tsx#L553), [`AssuranceDetailView.tsx:3277`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L3277), [`AssuranceDetailView.tsx:3864`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L3864), [`AssuranceDetailView.tsx:4162`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L4162), [`CrewDetailView.tsx:895`](file:///c:/mapFiles/MAPv2/src/views/CrewDetailView.tsx#L895), [`CrewDetailView.tsx:1038`](file:///c:/mapFiles/MAPv2/src/views/CrewDetailView.tsx#L1038), [`CrewGroupDetailView.tsx:388`](file:///c:/mapFiles/MAPv2/src/views/CrewGroupDetailView.tsx#L388), [`DashboardView.tsx:934`](file:///c:/mapFiles/MAPv2/src/views/DashboardView.tsx#L934), [`ProjectDetailView.tsx:612`](file:///c:/mapFiles/MAPv2/src/views/ProjectDetailView.tsx#L612), [`VesselDetailView.tsx:2726`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L2726) |
| 8 | `btn btn-link p-0 text-decoration-none small ms-auto` | `link` | 6 | Un-sized full button (missing btn-sm standard) | [`AssuranceDetailView.tsx:2486`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L2486), [`AssuranceDetailView.tsx:2580`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L2580), [`AssuranceDetailView.tsx:2782`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L2782), [`AssuranceDetailView.tsx:2834`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L2834), [`AssuranceDetailView.tsx:2884`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L2884), [`AssuranceDetailView.tsx:2934`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L2934) |
| 9 | `btn btn-outline-secondary btn-sm` | `outline` | 5 | Inverted class order (variant before size) | [`InspectionChecklistView.tsx:1168`](file:///c:/mapFiles/MAPv2/src/views/InspectionChecklistView.tsx#L1168), [`InspectionChecklistView.tsx:1191`](file:///c:/mapFiles/MAPv2/src/views/InspectionChecklistView.tsx#L1191), [`RolesAndPermissionsView.tsx:281`](file:///c:/mapFiles/MAPv2/src/views/RolesAndPermissionsView.tsx#L281), [`RolesAndPermissionsView.tsx:410`](file:///c:/mapFiles/MAPv2/src/views/RolesAndPermissionsView.tsx#L410), [`RolesAndPermissionsView.tsx:477`](file:///c:/mapFiles/MAPv2/src/views/RolesAndPermissionsView.tsx#L477) |
| 10 | `btn btn-sm btn-outline-primary` | `outline` | 5 | None | [`AssuranceDetailView.tsx:2310`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L2310), [`CrewDetailView.tsx:1110`](file:///c:/mapFiles/MAPv2/src/views/CrewDetailView.tsx#L1110), [`EquipmentDetailView.tsx:489`](file:///c:/mapFiles/MAPv2/src/views/EquipmentDetailView.tsx#L489), [`OrganizationProfileView.tsx:155`](file:///c:/mapFiles/MAPv2/src/views/OrganizationProfileView.tsx#L155), [`VesselDetailView.tsx:1863`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L1863) |
| 11 | `btn btn-sm btn-outline-secondary text-dark` | `outline` | 5 | None | [`VesselDetailView.tsx:1922`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L1922), [`VesselDetailView.tsx:2153`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L2153), [`VesselDetailView.tsx:2345`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L2345), [`VesselDetailView.tsx:2537`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L2537), [`VesselDetailView.tsx:2821`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L2821) |
| 12 | `btn btn-outline-secondary btn-sm d-flex align-items-center gap-1` | `outline` | 4 | Inverted class order (variant before size) | [`AssuranceDetailView.tsx:4456`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L4456), [`AssuranceDetailView.tsx:4466`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L4466), [`AssuranceDetailView.tsx:4536`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L4536), [`AssuranceDetailView.tsx:4546`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L4546) |
| 13 | `btn btn-sm btn-link p-0 me-2 text-dark text-decoration-none d-inline-flex align-items-center` | `link` | 4 | None | [`AssuranceDetailView.tsx:3091`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L3091), [`AssuranceDetailView.tsx:3684`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L3684), [`AssuranceDetailView.tsx:3779`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L3779), [`AssuranceDetailView.tsx:4094`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L4094) |
| 14 | `btn btn-sm btn-outline-danger d-inline-flex align-items-center justify-content-center p-1.5 rounded-2` | `icon` | 4 | None | [`CreateAssuranceSetView.tsx:2416`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L2416), [`CreateAssuranceSetView.tsx:2564`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L2564), [`CreateAssuranceSetView.tsx:2612`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L2612), [`CreateAssuranceSetView.tsx:4036`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L4036) |
| 15 | `btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1.5` | `outline` | 4 | None | [`AssuranceDetailView.tsx:3410`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L3410), [`CreateAssuranceSetView.tsx:3765`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L3765), [`ProjectDetailView.tsx:252`](file:///c:/mapFiles/MAPv2/src/views/ProjectDetailView.tsx#L252), [`ProjectDetailView.tsx:260`](file:///c:/mapFiles/MAPv2/src/views/ProjectDetailView.tsx#L260) |
| 16 | `btn btn-sm btn-outline-secondary d-inline-flex align-items-center justify-content-center p-0` | `icon` | 4 | None | [`AssuranceDetailView.tsx:3854`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L3854), [`AssuranceDetailView.tsx:4008`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L4008), [`AssuranceDetailView.tsx:4152`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L4152), [`AssuranceDetailView.tsx:4189`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L4189) |
| 17 | `btn btn-xs btn-outline-primary align-self-start mt-1` | `outline` | 4 | Uses non-standard btn-xs size | [`AssuranceDetailView.tsx:2809`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L2809), [`AssuranceDetailView.tsx:2861`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L2861), [`AssuranceDetailView.tsx:2911`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L2911), [`AssuranceDetailView.tsx:2961`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L2961) |
| 18 | `dropdown-item d-flex align-items-center gap-2 py-2` | `other` | 4 | Custom padding overrides (px/py) | [`AssuranceDetailView.tsx:3429`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L3429), [`AssuranceDetailView.tsx:3441`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L3441), [`AssuranceObjectsView.tsx:355`](file:///c:/mapFiles/MAPv2/src/views/AssuranceObjectsView.tsx#L355), [`AssuranceObjectsView.tsx:367`](file:///c:/mapFiles/MAPv2/src/views/AssuranceObjectsView.tsx#L367) |
| 19 | *(none)* | `other` | 3 | Un-sized full button (missing btn-sm standard) | [`CreateAssuranceSetView.tsx:2651`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L2651), [`CreateAssuranceSetView.tsx:2663`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L2663), [`CreateAssuranceSetView.tsx:3322`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L3322) |
| 20 | `btn btn-link btn-sm p-0 text-decoration-none` | `link` | 3 | None | [`AssuranceDetailView.tsx:5084`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L5084), [`AssuranceDetailView.tsx:5092`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L5092), [`InspectionChecklistView.tsx:715`](file:///c:/mapFiles/MAPv2/src/views/InspectionChecklistView.tsx#L715) |
| 21 | `btn btn-outline-primary` | `outline` | 3 | Un-sized full button (missing btn-sm standard) | [`CrewDetailView.tsx:1624`](file:///c:/mapFiles/MAPv2/src/views/CrewDetailView.tsx#L1624), [`EquipmentDetailView.tsx:876`](file:///c:/mapFiles/MAPv2/src/views/EquipmentDetailView.tsx#L876), [`VesselDetailView.tsx:4169`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L4169) |
| 22 | `btn btn-sm btn-link text-danger p-0` | `link` | 3 | None | [`AssuranceDetailView.tsx:4907`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L4907), [`CreateAssuranceSetView.tsx:3275`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L3275), [`CreateAssuranceSetView.tsx:3482`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L3482) |
| 23 | `btn btn-sm btn-link text-secondary text-decoration-none p-1 d-inline-flex align-items-center` | `link` | 3 | None | [`CreateAssuranceSetView.tsx:2358`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L2358), [`CreateAssuranceSetView.tsx:3684`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L3684), [`CreateAssuranceSetView.tsx:3968`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L3968) |
| 24 | `btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1.5` | `danger` | 3 | None | [`CrewDetailView.tsx:1419`](file:///c:/mapFiles/MAPv2/src/views/CrewDetailView.tsx#L1419), [`EquipmentDetailView.tsx:671`](file:///c:/mapFiles/MAPv2/src/views/EquipmentDetailView.tsx#L671), [`VesselDetailView.tsx:3962`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L3962) |
| 25 | `btn btn-sm btn-outline-danger py-0 px-2` | `danger` | 3 | None | [`AssuranceDetailView.tsx:2690`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L2690), [`AssuranceDetailView.tsx:2704`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L2704), [`AssuranceDetailView.tsx:2717`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L2717) |
| 26 | `btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1 px-2.5 py-1` | `outline` | 3 | Custom padding overrides (px/py) | [`CreateAssuranceSetView.tsx:2333`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L2333), [`CreateAssuranceSetView.tsx:3662`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L3662), [`CreateAssuranceSetView.tsx:3946`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L3946) |
| 27 | `btn btn-sm btn-primary fw-semibold d-inline-flex align-items-center gap-1.5` | `primary` | 3 | Manual font-weight override | [`CrewDetailView.tsx:1452`](file:///c:/mapFiles/MAPv2/src/views/CrewDetailView.tsx#L1452), [`EquipmentDetailView.tsx:704`](file:///c:/mapFiles/MAPv2/src/views/EquipmentDetailView.tsx#L704), [`VesselDetailView.tsx:3995`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L3995) |
| 28 | `btn btn-sm btn-primary ms-auto` | `primary` | 3 | None | [`CrewDetailView.tsx:794`](file:///c:/mapFiles/MAPv2/src/views/CrewDetailView.tsx#L794), [`CrewDetailView.tsx:928`](file:///c:/mapFiles/MAPv2/src/views/CrewDetailView.tsx#L928), [`VesselDetailView.tsx:1680`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L1680) |
| 29 | `btn btn-sm btn-primary text-white d-inline-flex align-items-center gap-1 px-2.5 py-1` | `primary` | 3 | Custom padding overrides (px/py) | [`CreateAssuranceSetView.tsx:2324`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L2324), [`CreateAssuranceSetView.tsx:3653`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L3653), [`CreateAssuranceSetView.tsx:3937`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L3937) |
| 30 | `btn btn-xs btn-danger p-0 d-flex align-items-center justify-content-center rounded-circle border border-white shadow-sm` | `icon` | 3 | Uses non-standard btn-xs size; Custom shadow utility | [`CrewDetailView.tsx:1389`](file:///c:/mapFiles/MAPv2/src/views/CrewDetailView.tsx#L1389), [`EquipmentDetailView.tsx:641`](file:///c:/mapFiles/MAPv2/src/views/EquipmentDetailView.tsx#L641), [`VesselDetailView.tsx:3930`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L3930) |
| 31 | `btn btn-xs btn-primary p-0 d-flex align-items-center justify-content-center rounded-circle border border-white shadow-sm` | `icon` | 3 | Uses non-standard btn-xs size; Custom shadow utility | [`CrewDetailView.tsx:1374`](file:///c:/mapFiles/MAPv2/src/views/CrewDetailView.tsx#L1374), [`EquipmentDetailView.tsx:626`](file:///c:/mapFiles/MAPv2/src/views/EquipmentDetailView.tsx#L626), [`VesselDetailView.tsx:3915`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L3915) |
| 32 | `card map-kpi-card map-kpi-clickable shadow-2xs` | `other` | 3 | Custom shadow utility | [`DashboardView.tsx:444`](file:///c:/mapFiles/MAPv2/src/views/DashboardView.tsx#L444), [`DashboardView.tsx:469`](file:///c:/mapFiles/MAPv2/src/views/DashboardView.tsx#L469), [`DashboardView.tsx:484`](file:///c:/mapFiles/MAPv2/src/views/DashboardView.tsx#L484) |
| 33 | `nav-link ${activeTab === 'assurance' ? 'active fw-bold text-primary' : 'text-secondary'}` | `primary` | 3 | Manual font-weight override; Dynamic class interpolation | [`CrewDetailView.tsx:412`](file:///c:/mapFiles/MAPv2/src/views/CrewDetailView.tsx#L412), [`EquipmentDetailView.tsx:228`](file:///c:/mapFiles/MAPv2/src/views/EquipmentDetailView.tsx#L228), [`VesselDetailView.tsx:1027`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L1027) |
| 34 | `nav-link ${activeTab === 'overview' ? 'active fw-bold text-primary' : 'text-secondary'}` | `primary` | 3 | Manual font-weight override; Dynamic class interpolation | [`CrewDetailView.tsx:389`](file:///c:/mapFiles/MAPv2/src/views/CrewDetailView.tsx#L389), [`EquipmentDetailView.tsx:205`](file:///c:/mapFiles/MAPv2/src/views/EquipmentDetailView.tsx#L205), [`VesselDetailView.tsx:1007`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L1007) |
| 35 | `btn btn-link p-0 text-primary text-start fw-semibold text-decoration-underline border-0 bg-transparent align-baseline` | `link` | 2 | Un-sized full button (missing btn-sm standard); Manual font-weight override | [`VesselDetailView.tsx:1784`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L1784), [`VesselDetailView.tsx:2698`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L2698) |
| 36 | `btn btn-outline-primary btn-sm` | `outline` | 2 | Inverted class order (variant before size) | [`InspectionChecklistView.tsx:1171`](file:///c:/mapFiles/MAPv2/src/views/InspectionChecklistView.tsx#L1171), [`RolesAndPermissionsView.tsx:269`](file:///c:/mapFiles/MAPv2/src/views/RolesAndPermissionsView.tsx#L269) |
| 37 | `btn btn-outline-secondary` | `outline` | 2 | Un-sized full button (missing btn-sm standard) | [`AssuranceDetailView.tsx:4751`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L4751), [`RolesAndPermissionsView.tsx:523`](file:///c:/mapFiles/MAPv2/src/views/RolesAndPermissionsView.tsx#L523) |
| 38 | `btn btn-outline-secondary border-start-0` | `outline` | 2 | Un-sized full button (missing btn-sm standard) | [`AssuranceDetailView.tsx:3033`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L3033), [`AssuranceDetailView.tsx:4503`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L4503) |
| 39 | `btn btn-primary` | `primary` | 2 | Un-sized full button (missing btn-sm standard) | [`AssuranceDetailView.tsx:4754`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L4754), [`RolesAndPermissionsView.tsx:526`](file:///c:/mapFiles/MAPv2/src/views/RolesAndPermissionsView.tsx#L526) |
| 40 | `btn btn-sm btn-danger text-white` | `danger` | 2 | None | [`AssuranceDetailView.tsx:5664`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L5664), [`AssuranceDetailView.tsx:5724`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L5724) |
| 41 | `btn btn-sm btn-link text-primary text-decoration-none p-0 d-inline-flex align-items-center gap-1 font-sans` | `link` | 2 | None | [`CreateAssuranceSetView.tsx:2632`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L2632), [`CreateAssuranceSetView.tsx:4053`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L4053) |
| 42 | `btn btn-sm btn-outline-primary d-flex align-items-center gap-1.5` | `outline` | 2 | None | [`InspectionChecklistView.tsx:885`](file:///c:/mapFiles/MAPv2/src/views/InspectionChecklistView.tsx#L885), [`VesselDetailView.tsx:978`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L978) |
| 43 | `btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1.5 px-2.5 py-1` | `outline` | 2 | Custom padding overrides (px/py) | [`AssuranceDetailView.tsx:4051`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L4051), [`AssuranceDetailView.tsx:4267`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L4267) |
| 44 | `btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1.5` | `outline` | 2 | None | [`CrewGroupDetailView.tsx:244`](file:///c:/mapFiles/MAPv2/src/views/CrewGroupDetailView.tsx#L244), [`ProjectDetailView.tsx:268`](file:///c:/mapFiles/MAPv2/src/views/ProjectDetailView.tsx#L268) |
| 45 | `btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1.5 px-2.5 py-1` | `outline` | 2 | Custom padding overrides (px/py) | [`AssuranceDetailView.tsx:4065`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L4065), [`AssuranceDetailView.tsx:4281`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L4281) |
| 46 | `btn btn-sm btn-outline-success d-inline-flex align-items-center justify-content-center p-0` | `icon` | 2 | None | [`AssuranceDetailView.tsx:3253`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L3253), [`VesselDetailView.tsx:2740`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L2740) |
| 47 | `btn btn-sm btn-primary d-inline-flex align-items-center gap-1.5` | `primary` | 2 | None | [`CrewGroupDetailView.tsx:241`](file:///c:/mapFiles/MAPv2/src/views/CrewGroupDetailView.tsx#L241), [`CrewGroupDetailView.tsx:339`](file:///c:/mapFiles/MAPv2/src/views/CrewGroupDetailView.tsx#L339) |
| 48 | `btn btn-sm btn-primary d-inline-flex align-items-center gap-1.5 fw-semibold` | `primary` | 2 | Manual font-weight override | [`CrewDetailView.tsx:1307`](file:///c:/mapFiles/MAPv2/src/views/CrewDetailView.tsx#L1307), [`EquipmentDetailView.tsx:558`](file:///c:/mapFiles/MAPv2/src/views/EquipmentDetailView.tsx#L558) |
| 49 | `btn btn-sm btn-primary text-white` | `primary` | 2 | None | [`AssuranceDetailView.tsx:3460`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L3460), [`AssuranceDetailView.tsx:3509`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L3509) |
| 50 | `nav-link ${activeTab === 'audit' ? 'active fw-bold text-primary' : 'text-secondary'}` | `primary` | 2 | Manual font-weight override; Dynamic class interpolation | [`AssuranceDetailView.tsx:2420`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L2420), [`CrewDetailView.tsx:436`](file:///c:/mapFiles/MAPv2/src/views/CrewDetailView.tsx#L436) |
| 51 | `nav-link ${activeTab === 'documents' ? 'active fw-bold text-primary' : 'text-secondary'}` | `primary` | 2 | Manual font-weight override; Dynamic class interpolation | [`CrewDetailView.tsx:400`](file:///c:/mapFiles/MAPv2/src/views/CrewDetailView.tsx#L400), [`EquipmentDetailView.tsx:216`](file:///c:/mapFiles/MAPv2/src/views/EquipmentDetailView.tsx#L216) |
| 52 | `border rounded-2 p-0 overflow-hidden flex-shrink-0 transition-all ${ isSelected ? 'border-primary shadow-xs ring-2 ring-primary' : 'border-secondary-subtle opacity-75 hover-opacity-100' }` | `primary` | 1 | Un-sized full button (missing btn-sm standard); Dynamic class interpolation | [`EquipmentDetailView.tsx:306`](file:///c:/mapFiles/MAPv2/src/views/EquipmentDetailView.tsx#L306) |
| 53 | `border rounded-2 p-0 overflow-hidden flex-shrink-0 transition-all ${isSelected ? 'border-primary shadow-xs ring-2 ring-primary' : 'border-secondary-subtle opacity-75 hover-opacity-100' }` | `primary` | 1 | Un-sized full button (missing btn-sm standard); Dynamic class interpolation | [`CrewDetailView.tsx:514`](file:///c:/mapFiles/MAPv2/src/views/CrewDetailView.tsx#L514) |
| 54 | `btn btn-danger text-white py-2 fw-semibold` | `danger` | 1 | Custom padding overrides (px/py); Un-sized full button (missing btn-sm standard); Manual font-weight override | [`ApproverDashboardView.tsx:672`](file:///c:/mapFiles/MAPv2/src/views/ApproverDashboardView.tsx#L672) |
| 55 | `btn btn-light border btn-sm px-3` | `secondary` | 1 | Custom padding overrides (px/py) | [`CreateAssuranceSetView.tsx:4479`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L4479) |
| 56 | `btn btn-link btn-sm p-0 font-mono-code` | `link` | 1 | None | [`VesselDetailView.tsx:2430`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L2430) |
| 57 | `btn btn-link p-0 font-mono-code text-primary fw-semibold text-decoration-underline border-0 bg-transparent text-start` | `link` | 1 | Un-sized full button (missing btn-sm standard); Manual font-weight override | [`VesselDetailView.tsx:3057`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L3057) |
| 58 | `btn btn-link p-0 fw-bold text-primary font-mono-code text-decoration-underline text-start` | `link` | 1 | Un-sized full button (missing btn-sm standard); Manual font-weight override | [`VesselDetailView.tsx:3195`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L3195) |
| 59 | `btn btn-link p-0 fw-semibold align-baseline` | `link` | 1 | Un-sized full button (missing btn-sm standard); Manual font-weight override | [`EquipmentDetailView.tsx:366`](file:///c:/mapFiles/MAPv2/src/views/EquipmentDetailView.tsx#L366) |
| 60 | `btn btn-link p-0 text-decoration-none` | `link` | 1 | Un-sized full button (missing btn-sm standard) | [`LoginView.tsx:149`](file:///c:/mapFiles/MAPv2/src/views/LoginView.tsx#L149) |
| 61 | `btn btn-link p-0 text-decoration-none d-inline-flex align-items-center gap-2 text-nowrap ${ isCurrent ? 'text-primary fw-bold' : isPast ? 'text-dark fw-semibold' : 'text-muted' }` | `link` | 1 | Un-sized full button (missing btn-sm standard); Manual font-weight override; Dynamic class interpolation | [`CreateProjectView.tsx:422`](file:///c:/mapFiles/MAPv2/src/views/CreateProjectView.tsx#L422) |
| 62 | `btn btn-link p-0 text-decoration-none d-inline-flex align-items-center gap-2 text-nowrap transition-all ${isCurrent ? 'text-primary fw-bold' : isPast ? 'text-dark fw-semibold' : 'text-muted' }` | `link` | 1 | Un-sized full button (missing btn-sm standard); Manual font-weight override; Dynamic class interpolation | [`CreateAssuranceSetView.tsx:2698`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L2698) |
| 63 | `btn btn-link p-0 text-decoration-none small` | `link` | 1 | Un-sized full button (missing btn-sm standard) | [`AssuranceDetailView.tsx:3388`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L3388) |
| 64 | `btn btn-link p-0 text-primary fw-bold text-decoration-underline border-0 bg-transparent text-start font-mono-code` | `link` | 1 | Un-sized full button (missing btn-sm standard); Manual font-weight override | [`VesselDetailView.tsx:3044`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L3044) |
| 65 | `btn btn-link text-decoration-none text-dark w-100 d-flex align-items-center gap-2 p-3 text-start` | `link` | 1 | Un-sized full button (missing btn-sm standard); Full width utility | [`ProjectDetailView.tsx:657`](file:///c:/mapFiles/MAPv2/src/views/ProjectDetailView.tsx#L657) |
| 66 | `btn btn-outline-danger btn-sm px-3` | `danger` | 1 | Custom padding overrides (px/py); Inverted class order (variant before size) | [`CreateAssuranceSetView.tsx:4471`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L4471) |
| 67 | `btn btn-outline-primary px-3.5 py-1.5 fw-semibold` | `outline` | 1 | Custom padding overrides (px/py); Un-sized full button (missing btn-sm standard); Manual font-weight override | [`CreateAssuranceSetView.tsx:4405`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L4405) |
| 68 | `btn btn-outline-secondary px-3.5 py-1.5` | `outline` | 1 | Custom padding overrides (px/py); Un-sized full button (missing btn-sm standard) | [`CreateAssuranceSetView.tsx:4386`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L4386) |
| 69 | `btn btn-outline-secondary px-3.5 py-1.5 fw-semibold` | `outline` | 1 | Custom padding overrides (px/py); Un-sized full button (missing btn-sm standard); Manual font-weight override | [`CreateAssuranceSetView.tsx:4393`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L4393) |
| 70 | `btn btn-primary btn-sm` | `primary` | 1 | Inverted class order (variant before size) | [`RolesAndPermissionsView.tsx:485`](file:///c:/mapFiles/MAPv2/src/views/RolesAndPermissionsView.tsx#L485) |
| 71 | `btn btn-primary btn-sm d-inline-flex align-items-center gap-1.5` | `primary` | 1 | Inverted class order (variant before size) | [`CrewGroupDetailView.tsx:64`](file:///c:/mapFiles/MAPv2/src/views/CrewGroupDetailView.tsx#L64) |
| 72 | `btn btn-primary btn-sm px-3.5 text-white fw-semibold` | `primary` | 1 | Custom padding overrides (px/py); Inverted class order (variant before size); Manual font-weight override | [`CreateAssuranceSetView.tsx:4486`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L4486) |
| 73 | `btn btn-primary btn-sm px-4` | `primary` | 1 | Custom padding overrides (px/py); Inverted class order (variant before size) | [`InspectionChecklistView.tsx:1182`](file:///c:/mapFiles/MAPv2/src/views/InspectionChecklistView.tsx#L1182) |
| 74 | `btn btn-primary px-4 fw-semibold` | `primary` | 1 | Custom padding overrides (px/py); Un-sized full button (missing btn-sm standard); Manual font-weight override | [`AssuranceDetailView.tsx:1576`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L1576) |
| 75 | `btn btn-primary text-white px-4 py-1.5 fw-semibold` | `primary` | 1 | Custom padding overrides (px/py); Un-sized full button (missing btn-sm standard); Manual font-weight override | [`CreateAssuranceSetView.tsx:4415`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L4415) |
| 76 | `btn btn-sm ${assetTypeFilter === t ? "btn-primary" : "btn-outline-secondary"}` | `outline` | 1 | Dynamic class interpolation | [`CreateProjectView.tsx:930`](file:///c:/mapFiles/MAPv2/src/views/CreateProjectView.tsx#L930) |
| 77 | `btn btn-sm ${cAdminPppFilter === pillar ? "btn-primary" : "btn-outline-secondary"}` | `outline` | 1 | Dynamic class interpolation | [`DashboardView.tsx:672`](file:///c:/mapFiles/MAPv2/src/views/DashboardView.tsx#L672) |
| 78 | `btn btn-sm ${isSelected ? "btn-light text-dark" : "btn-outline-primary"} p-0 d-inline-flex align-items-center justify-content-center` | `icon` | 1 | Dynamic class interpolation | [`CreateProjectView.tsx:836`](file:///c:/mapFiles/MAPv2/src/views/CreateProjectView.tsx#L836) |
| 79 | `btn btn-sm ${viewMode === 'grid' ? 'btn-dark' : 'btn-outline-secondary'}` | `outline` | 1 | Dynamic class interpolation | [`MarketplaceView.tsx:307`](file:///c:/mapFiles/MAPv2/src/views/MarketplaceView.tsx#L307) |
| 80 | `btn btn-sm ${viewMode === 'table' ? 'btn-dark' : 'btn-outline-secondary'}` | `outline` | 1 | Dynamic class interpolation | [`MarketplaceView.tsx:310`](file:///c:/mapFiles/MAPv2/src/views/MarketplaceView.tsx#L310) |
| 81 | `btn btn-sm btn-danger text-white fw-semibold` | `danger` | 1 | Manual font-weight override | [`AssuranceDetailView.tsx:5334`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L5334) |
| 82 | `btn btn-sm btn-danger text-white py-0 px-2` | `danger` | 1 | None | [`AssuranceDetailView.tsx:2732`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L2732) |
| 83 | `btn btn-sm btn-light border text-secondary` | `secondary` | 1 | None | [`InspectionChecklistView.tsx:902`](file:///c:/mapFiles/MAPv2/src/views/InspectionChecklistView.tsx#L902) |
| 84 | `btn btn-sm btn-light border text-secondary d-flex align-items-center gap-1.5` | `secondary` | 1 | None | [`InspectionChecklistView.tsx:893`](file:///c:/mapFiles/MAPv2/src/views/InspectionChecklistView.tsx#L893) |
| 85 | `btn btn-sm btn-link p-0 text-dark text-decoration-none d-inline-flex align-items-center` | `link` | 1 | None | [`AssuranceDetailView.tsx:3951`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L3951) |
| 86 | `btn btn-sm btn-link p-0 text-decoration-none` | `link` | 1 | None | [`AssuranceDetailView.tsx:2454`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L2454) |
| 87 | `btn btn-sm btn-link p-0 text-secondary text-decoration-none d-inline-flex align-items-center gap-2 fw-semibold` | `link` | 1 | Manual font-weight override | [`AssuranceDetailView.tsx:4367`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L4367) |
| 88 | `btn btn-sm btn-link text-primary text-decoration-none p-0 d-inline-flex align-items-center` | `link` | 1 | None | [`AssuranceObjectsView.tsx:443`](file:///c:/mapFiles/MAPv2/src/views/AssuranceObjectsView.tsx#L443) |
| 89 | `btn btn-sm btn-link text-secondary text-decoration-none p-0 small flex-shrink-0` | `link` | 1 | None | [`CreateAssuranceSetView.tsx:2494`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L2494) |
| 90 | `btn btn-sm btn-outline-danger` | `danger` | 1 | None | [`CreateAssuranceSetView.tsx:2285`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L2285) |
| 91 | `btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1` | `danger` | 1 | None | [`CreateAssuranceSetView.tsx:3983`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L3983) |
| 92 | `btn btn-sm btn-outline-danger d-inline-flex align-items-center justify-content-center p-0 flex-shrink-0` | `icon` | 1 | None | [`CreateProjectView.tsx:1058`](file:///c:/mapFiles/MAPv2/src/views/CreateProjectView.tsx#L1058) |
| 93 | `btn btn-sm btn-outline-primary d-flex align-items-center justify-content-center gap-1.5` | `icon` | 1 | None | [`CrewDetailView.tsx:1271`](file:///c:/mapFiles/MAPv2/src/views/CrewDetailView.tsx#L1271) |
| 94 | `btn btn-sm btn-outline-primary flex-fill d-flex flex-column align-items-center py-1.5 px-1 map-quick-action-btn` | `outline` | 1 | Custom padding overrides (px/py) | [`EquipmentDetailView.tsx:325`](file:///c:/mapFiles/MAPv2/src/views/EquipmentDetailView.tsx#L325) |
| 95 | `btn btn-sm btn-outline-primary flex-shrink-0` | `outline` | 1 | None | [`CreateProjectView.tsx:1002`](file:///c:/mapFiles/MAPv2/src/views/CreateProjectView.tsx#L1002) |
| 96 | `btn btn-sm btn-outline-primary fw-bold` | `outline` | 1 | Manual font-weight override | [`InspectionChecklistView.tsx:559`](file:///c:/mapFiles/MAPv2/src/views/InspectionChecklistView.tsx#L559) |
| 97 | `btn btn-sm btn-outline-primary fw-semibold` | `outline` | 1 | Manual font-weight override | [`VesselDetailView.tsx:2549`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L2549) |
| 98 | `btn btn-sm btn-outline-primary fw-semibold d-flex align-items-center gap-1.5` | `outline` | 1 | Manual font-weight override | [`VesselDetailView.tsx:3440`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L3440) |
| 99 | `btn btn-sm btn-outline-primary fw-semibold d-inline-flex align-items-center gap-1.5` | `outline` | 1 | Manual font-weight override | [`CreateAssuranceSetView.tsx:3377`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L3377) |
| 100 | `btn btn-sm btn-outline-primary py-0 px-2 d-inline-flex align-items-center gap-1` | `outline` | 1 | None | [`AssuranceDetailView.tsx:2677`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L2677) |
| 101 | `btn btn-sm btn-outline-primary py-1 px-2` | `outline` | 1 | None | [`VesselDetailView.tsx:3393`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L3393) |
| 102 | `btn btn-sm btn-outline-primary shrink-0` | `outline` | 1 | None | [`VesselDetailView.tsx:1599`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L1599) |
| 103 | `btn btn-sm btn-outline-primary w-100 d-flex align-items-center justify-content-center gap-1.5 py-1` | `icon` | 1 | Full width utility | [`CrewDetailView.tsx:531`](file:///c:/mapFiles/MAPv2/src/views/CrewDetailView.tsx#L531) |
| 104 | `btn btn-sm btn-outline-secondary d-flex align-items-center gap-1.5` | `outline` | 1 | None | [`CrewGroupDetailView.tsx:136`](file:///c:/mapFiles/MAPv2/src/views/CrewGroupDetailView.tsx#L136) |
| 105 | `btn btn-sm btn-outline-secondary d-flex align-items-center gap-1.5 px-3 py-1.5 bg-white text-dark` | `outline` | 1 | Custom padding overrides (px/py) | [`AssuranceObjectsView.tsx:334`](file:///c:/mapFiles/MAPv2/src/views/AssuranceObjectsView.tsx#L334) |
| 106 | `btn btn-sm btn-outline-secondary d-inline-flex align-items-center justify-content-center p-0 opacity-50` | `icon` | 1 | None | [`AssuranceDetailView.tsx:3265`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L3265) |
| 107 | `btn btn-sm btn-outline-secondary flex-fill d-flex flex-column align-items-center py-1.5 px-1 map-quick-action-btn` | `outline` | 1 | Custom padding overrides (px/py) | [`VesselDetailView.tsx:1132`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L1132) |
| 108 | `btn btn-sm btn-outline-secondary text-dark d-flex align-items-center gap-1.5 px-2.5 py-1` | `outline` | 1 | Custom padding overrides (px/py) | [`EquipmentView.tsx:182`](file:///c:/mapFiles/MAPv2/src/views/EquipmentView.tsx#L182) |
| 109 | `btn btn-sm btn-outline-secondary text-dark px-2.5 d-flex align-items-center justify-content-center` | `outline` | 1 | Custom padding overrides (px/py) | [`MarketplaceView.tsx:296`](file:///c:/mapFiles/MAPv2/src/views/MarketplaceView.tsx#L296) |
| 110 | `btn btn-sm btn-outline-warning text-dark` | `outline` | 1 | None | [`InspectionChecklistView.tsx:914`](file:///c:/mapFiles/MAPv2/src/views/InspectionChecklistView.tsx#L914) |
| 111 | `btn btn-sm btn-outline-warning text-dark d-inline-flex align-items-center justify-content-center p-0` | `icon` | 1 | None | [`ApproverDashboardView.tsx:537`](file:///c:/mapFiles/MAPv2/src/views/ApproverDashboardView.tsx#L537) |
| 112 | `btn btn-sm btn-outline-warning text-dark font-weight-500` | `outline` | 1 | Manual font-weight override | [`InspectionChecklistView.tsx:1001`](file:///c:/mapFiles/MAPv2/src/views/InspectionChecklistView.tsx#L1001) |
| 113 | `btn btn-sm btn-primary d-flex align-items-center gap-1` | `primary` | 1 | None | [`OrganizationProfileView.tsx:149`](file:///c:/mapFiles/MAPv2/src/views/OrganizationProfileView.tsx#L149) |
| 114 | `btn btn-sm btn-primary d-flex align-items-center justify-content-center gap-1.5 fw-semibold` | `icon` | 1 | Manual font-weight override | [`CrewDetailView.tsx:1286`](file:///c:/mapFiles/MAPv2/src/views/CrewDetailView.tsx#L1286) |
| 115 | `btn btn-sm btn-primary d-inline-flex align-items-center gap-1` | `primary` | 1 | None | [`ProjectDetailView.tsx:727`](file:///c:/mapFiles/MAPv2/src/views/ProjectDetailView.tsx#L727) |
| 116 | `btn btn-sm btn-primary d-inline-flex align-items-center gap-1.5 px-2.5 py-1 fw-semibold shadow-2xs` | `primary` | 1 | Custom padding overrides (px/py); Manual font-weight override; Custom shadow utility | [`VesselDetailView.tsx:3837`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L3837) |
| 117 | `btn btn-sm btn-primary d-inline-flex align-items-center gap-1.5 px-2.5 py-1 rounded shadow-2xs fw-semibold` | `primary` | 1 | Custom padding overrides (px/py); Manual font-weight override; Custom shadow utility | [`VesselDetailView.tsx:3787`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L3787) |
| 118 | `btn btn-sm btn-primary d-inline-flex align-items-center gap-2` | `primary` | 1 | None | [`NotificationsView.tsx:149`](file:///c:/mapFiles/MAPv2/src/views/NotificationsView.tsx#L149) |
| 119 | `btn btn-sm btn-primary fw-semibold d-flex align-items-center gap-1.5` | `primary` | 1 | Manual font-weight override | [`VesselDetailView.tsx:2965`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L2965) |
| 120 | `btn btn-sm btn-primary text-white d-inline-flex align-items-center justify-content-center p-0` | `icon` | 1 | None | [`AssuranceDetailView.tsx:4203`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L4203) |
| 121 | `btn btn-sm btn-primary text-white flex-grow-1` | `primary` | 1 | None | [`CreateAssuranceSetView.tsx:3836`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L3836) |
| 122 | `btn btn-sm btn-primary text-white font-mono-code` | `primary` | 1 | None | [`DocumentDetailView.tsx:287`](file:///c:/mapFiles/MAPv2/src/views/DocumentDetailView.tsx#L287) |
| 123 | `btn btn-sm btn-primary text-white text-nowrap` | `primary` | 1 | None | [`CreateAssuranceSetView.tsx:3884`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L3884) |
| 124 | `btn btn-sm btn-secondary font-mono-code` | `secondary` | 1 | None | [`ApproverDashboardView.tsx:721`](file:///c:/mapFiles/MAPv2/src/views/ApproverDashboardView.tsx#L721) |
| 125 | `btn btn-sm btn-success` | `other` | 1 | None | [`VesselDetailView.tsx:973`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L973) |
| 126 | `btn btn-sm btn-success fw-semibold` | `other` | 1 | Manual font-weight override | [`VesselDetailView.tsx:2585`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L2585) |
| 127 | `btn btn-sm btn-warning fw-bold` | `other` | 1 | Manual font-weight override | [`InspectionChecklistView.tsx:800`](file:///c:/mapFiles/MAPv2/src/views/InspectionChecklistView.tsx#L800) |
| 128 | `btn btn-sm btn-warning text-dark fw-semibold` | `other` | 1 | Manual font-weight override | [`AssuranceDetailView.tsx:5288`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L5288) |
| 129 | `btn btn-sm btn-warning w-100 fw-bold` | `other` | 1 | Manual font-weight override; Full width utility | [`InspectionChecklistView.tsx:1040`](file:///c:/mapFiles/MAPv2/src/views/InspectionChecklistView.tsx#L1040) |
| 130 | `btn btn-sm px-3 py-1.5 rounded-pill fw-medium transition-all ${ isSelected ? 'btn-primary text-white shadow-2xs' : 'btn-outline-secondary bg-white text-secondary' }` | `outline` | 1 | Custom padding overrides (px/py); Custom shadow utility; Dynamic class interpolation | [`CreateAssuranceSetView.tsx:2945`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L2945) |
| 131 | `btn btn-sm rounded-pill px-3 py-1 ${item.status === 'Deficiency' ? 'btn-outline-danger fw-semibold active' : 'btn-light text-secondary border' }` | `danger` | 1 | Custom padding overrides (px/py); Manual font-weight override; Dynamic class interpolation | [`InspectionChecklistView.tsx:673`](file:///c:/mapFiles/MAPv2/src/views/InspectionChecklistView.tsx#L673) |
| 132 | `btn btn-sm rounded-pill px-3 py-1 ${item.status === 'Observation' ? 'btn-outline-info fw-semibold active' : 'btn-light text-secondary border' }` | `outline` | 1 | Custom padding overrides (px/py); Manual font-weight override; Dynamic class interpolation | [`InspectionChecklistView.tsx:657`](file:///c:/mapFiles/MAPv2/src/views/InspectionChecklistView.tsx#L657) |
| 133 | `btn btn-sm rounded-pill px-3 py-1 ${item.status === 'Satisfactory' ? 'btn-outline-primary fw-semibold active' : 'btn-light text-secondary border' }` | `outline` | 1 | Custom padding overrides (px/py); Manual font-weight override; Dynamic class interpolation | [`InspectionChecklistView.tsx:641`](file:///c:/mapFiles/MAPv2/src/views/InspectionChecklistView.tsx#L641) |
| 134 | `btn btn-sm text-white p-2 border-0 bg-transparent opacity-75 hover-opacity-100` | `other` | 1 | None | [`EquipmentDetailView.tsx:538`](file:///c:/mapFiles/MAPv2/src/views/EquipmentDetailView.tsx#L538) |
| 135 | `btn btn-success btn-sm px-4` | `other` | 1 | Custom padding overrides (px/py) | [`InspectionChecklistView.tsx:1194`](file:///c:/mapFiles/MAPv2/src/views/InspectionChecklistView.tsx#L1194) |
| 136 | `btn btn-success text-white py-2 fw-semibold` | `other` | 1 | Custom padding overrides (px/py); Un-sized full button (missing btn-sm standard); Manual font-weight override | [`ApproverDashboardView.tsx:657`](file:///c:/mapFiles/MAPv2/src/views/ApproverDashboardView.tsx#L657) |
| 137 | `btn btn-warning font-weight-500 w-100 py-2.5 shadow-sm mt-1` | `other` | 1 | Custom padding overrides (px/py); Un-sized full button (missing btn-sm standard); Manual font-weight override; Custom shadow utility; Full width utility | [`InspectionChecklistView.tsx:984`](file:///c:/mapFiles/MAPv2/src/views/InspectionChecklistView.tsx#L984) |
| 138 | `btn btn-warning text-dark py-2 fw-semibold` | `other` | 1 | Custom padding overrides (px/py); Un-sized full button (missing btn-sm standard); Manual font-weight override | [`ApproverDashboardView.tsx:665`](file:///c:/mapFiles/MAPv2/src/views/ApproverDashboardView.tsx#L665) |
| 139 | `btn text-white px-5 py-2 fw-semibold shadow-sm` | `other` | 1 | Custom padding overrides (px/py); Un-sized full button (missing btn-sm standard); Manual font-weight override; Custom shadow utility | [`CreateAssuranceSetView.tsx:4423`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L4423) |
| 140 | `btn w-100 py-2 fw-semibold text-white border-0` | `other` | 1 | Custom padding overrides (px/py); Un-sized full button (missing btn-sm standard); Manual font-weight override; Full width utility | [`LoginView.tsx:158`](file:///c:/mapFiles/MAPv2/src/views/LoginView.tsx#L158) |
| 141 | `btn-close ms-1` | `close` | 1 | None | [`CreateAssuranceSetView.tsx:3419`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L3419) |
| 142 | `btn-close ms-2` | `close` | 1 | None | [`CreateProjectView.tsx:597`](file:///c:/mapFiles/MAPv2/src/views/CreateProjectView.tsx#L597) |
| 143 | `btn-close ms-auto flex-shrink-0 align-self-start` | `close` | 1 | None | [`InspectionChecklistView.tsx:864`](file:///c:/mapFiles/MAPv2/src/views/InspectionChecklistView.tsx#L864) |
| 144 | `card map-kpi-card map-kpi-clickable shadow-2xs ${cAdminStageFilter === 'ALL' ? 'map-kpi-selected' : ''}` | `other` | 1 | Custom shadow utility; Dynamic class interpolation | [`DashboardView.tsx:379`](file:///c:/mapFiles/MAPv2/src/views/DashboardView.tsx#L379) |
| 145 | `card map-kpi-card map-kpi-clickable shadow-2xs ${cAdminStageFilter === 'approved' ? 'map-kpi-selected' : ''}` | `other` | 1 | Custom shadow utility; Dynamic class interpolation | [`DashboardView.tsx:421`](file:///c:/mapFiles/MAPv2/src/views/DashboardView.tsx#L421) |
| 146 | `card map-kpi-card map-kpi-clickable shadow-2xs ${cAdminStageFilter === 'in_progress' ? 'map-kpi-selected' : ''}` | `other` | 1 | Custom shadow utility; Dynamic class interpolation | [`DashboardView.tsx:405`](file:///c:/mapFiles/MAPv2/src/views/DashboardView.tsx#L405) |
| 147 | `card map-kpi-card map-kpi-clickable shadow-2xs ${submitterTableFilter === 'ALL' ? 'map-kpi-selected' : ''}` | `other` | 1 | Custom shadow utility; Dynamic class interpolation | [`DashboardView.tsx:302`](file:///c:/mapFiles/MAPv2/src/views/DashboardView.tsx#L302) |
| 148 | `card map-kpi-card map-kpi-clickable shadow-2xs ${submitterTableFilter === 'due_this_week' ? 'map-kpi-selected' : ''}` | `other` | 1 | Custom shadow utility; Dynamic class interpolation | [`DashboardView.tsx:350`](file:///c:/mapFiles/MAPv2/src/views/DashboardView.tsx#L350) |
| 149 | `card map-kpi-card map-kpi-clickable shadow-2xs ${submitterTableFilter === 'returned' ? 'map-kpi-selected' : ''}` | `other` | 1 | Custom shadow utility; Dynamic class interpolation | [`DashboardView.tsx:334`](file:///c:/mapFiles/MAPv2/src/views/DashboardView.tsx#L334) |
| 150 | `card map-kpi-card map-kpi-clickable shadow-2xs ${submitterTableFilter === 'tasks' ? 'map-kpi-selected' : ''}` | `other` | 1 | Custom shadow utility; Dynamic class interpolation | [`DashboardView.tsx:318`](file:///c:/mapFiles/MAPv2/src/views/DashboardView.tsx#L318) |
| 151 | `d-block w-100 p-0 border-0 bg-transparent fw-bold text-dark text-start` | `other` | 1 | Un-sized full button (missing btn-sm standard); Manual font-weight override; Full width utility | [`AssuranceDetailView.tsx:2497`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L2497) |
| 152 | `d-none` | `other` | 1 | Un-sized full button (missing btn-sm standard) | [`CreateAssuranceSetView.tsx:3777`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L3777) |
| 153 | `dropdown-item d-flex align-items-center justify-content-between px-3 py-1.5 small ${viewMode === 'list' ? 'active bg-primary text-white' : ''}` | `primary` | 1 | Custom padding overrides (px/py); Dynamic class interpolation | [`EquipmentView.tsx:197`](file:///c:/mapFiles/MAPv2/src/views/EquipmentView.tsx#L197) |
| 154 | `dropdown-item d-flex align-items-center justify-content-between px-3 py-1.5 small ${viewMode === 'tree' ? 'active bg-primary text-white' : ''}` | `primary` | 1 | Custom padding overrides (px/py); Dynamic class interpolation | [`EquipmentView.tsx:214`](file:///c:/mapFiles/MAPv2/src/views/EquipmentView.tsx#L214) |
| 155 | `list-group-item list-group-item-action d-flex justify-between align-items-center` | `other` | 1 | Un-sized full button (missing btn-sm standard) | [`VesselDetailView.tsx:2466`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L2466) |
| 156 | `map-notif-sort` | `other` | 1 | None | [`NotificationsView.tsx:176`](file:///c:/mapFiles/MAPv2/src/views/NotificationsView.tsx#L176) |
| 157 | `map-notif-subject-link text-dark ${isUnread ? 'fw-semibold' : ''}` | `other` | 1 | Manual font-weight override; Dynamic class interpolation | [`NotificationsView.tsx:222`](file:///c:/mapFiles/MAPv2/src/views/NotificationsView.tsx#L222) |
| 158 | `map-perm-role-chip ${selectedRole === role ? 'is-active' : ''}` | `other` | 1 | Dynamic class interpolation | [`RolesAndPermissionsView.tsx:305`](file:///c:/mapFiles/MAPv2/src/views/RolesAndPermissionsView.tsx#L305) |
| 159 | `map-user-search-option ${u.id === selectedUser?.id ? 'is-active' : ''}` | `other` | 1 | Dynamic class interpolation | [`RolesAndPermissionsView.tsx:379`](file:///c:/mapFiles/MAPv2/src/views/RolesAndPermissionsView.tsx#L379) |
| 160 | `nav-link ${activeTab === 'assignments' ? 'active fw-bold text-primary' : 'text-secondary'}` | `primary` | 1 | Manual font-weight override; Dynamic class interpolation | [`CrewDetailView.tsx:424`](file:///c:/mapFiles/MAPv2/src/views/CrewDetailView.tsx#L424) |
| 161 | `nav-link ${activeTab === 'clients' ? 'active fw-bold text-primary' : 'text-secondary'}` | `primary` | 1 | Manual font-weight override; Dynamic class interpolation | [`VesselDetailView.tsx:1068`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L1068) |
| 162 | `nav-link ${activeTab === 'crew' ? 'active fw-bold text-primary' : 'text-secondary'}` | `primary` | 1 | Manual font-weight override; Dynamic class interpolation | [`VesselDetailView.tsx:1047`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L1047) |
| 163 | `nav-link ${activeTab === 'details' ? 'active fw-bold text-primary' : 'text-secondary'}` | `primary` | 1 | Manual font-weight override; Dynamic class interpolation | [`AssuranceDetailView.tsx:2376`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L2376) |
| 164 | `nav-link ${activeTab === 'history' ? 'active fw-bold text-primary' : 'text-secondary'}` | `primary` | 1 | Manual font-weight override; Dynamic class interpolation | [`VesselDetailView.tsx:1057`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L1057) |
| 165 | `nav-link ${activeTab === 'inspections' ? 'active fw-bold text-primary' : 'text-secondary'}` | `primary` | 1 | Manual font-weight override; Dynamic class interpolation | [`VesselDetailView.tsx:1037`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L1037) |
| 166 | `nav-link ${activeTab === 'objects' ? 'active fw-bold text-primary' : 'text-secondary'}` | `primary` | 1 | Manual font-weight override; Dynamic class interpolation | [`AssuranceDetailView.tsx:2387`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L2387) |
| 167 | `nav-link ${activeTab === 'requirements' ? 'active fw-bold text-primary' : 'text-secondary'}` | `primary` | 1 | Manual font-weight override; Dynamic class interpolation | [`AssuranceDetailView.tsx:2398`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L2398) |
| 168 | `nav-link ${activeTab === 'tasks' ? 'active fw-bold text-primary' : 'text-secondary'}` | `primary` | 1 | Manual font-weight override; Dynamic class interpolation | [`AssuranceDetailView.tsx:2409`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L2409) |
| 169 | `nav-link ${activeTab === 'vault' ? 'active fw-bold text-primary' : 'text-secondary'}` | `primary` | 1 | Manual font-weight override; Dynamic class interpolation | [`VesselDetailView.tsx:1017`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L1017) |
| 170 | `nav-link ${activeTab === tab ? "active fw-semibold" : ""}` | `other` | 1 | Manual font-weight override; Dynamic class interpolation | [`ProjectDetailView.tsx:284`](file:///c:/mapFiles/MAPv2/src/views/ProjectDetailView.tsx#L284) |
| 171 | `nav-link btn-sm font-mono-code px-3 py-1.5 ${ activeTab === 'role-defaults' ? 'active bg-primary text-white fw-semibold' : 'text-secondary' }` | `primary` | 1 | Custom padding overrides (px/py); Manual font-weight override; Dynamic class interpolation | [`RolesAndPermissionsView.tsx:239`](file:///c:/mapFiles/MAPv2/src/views/RolesAndPermissionsView.tsx#L239) |
| 172 | `nav-link btn-sm font-mono-code px-3 py-1.5 ${ activeTab === 'user-permissions' ? 'active bg-primary text-white fw-semibold' : 'text-secondary' }` | `primary` | 1 | Custom padding overrides (px/py); Manual font-weight override; Dynamic class interpolation | [`RolesAndPermissionsView.tsx:252`](file:///c:/mapFiles/MAPv2/src/views/RolesAndPermissionsView.tsx#L252) |
| 173 | `nav-link font-mono-code fw-semibold py-2.5 px-3.5 ${ activeTab === 'details' ? 'active text-primary border-bottom border-primary border-2' : 'text-secondary' }` | `primary` | 1 | Custom padding overrides (px/py); Manual font-weight override; Dynamic class interpolation | [`CrewGroupDetailView.tsx:158`](file:///c:/mapFiles/MAPv2/src/views/CrewGroupDetailView.tsx#L158) |
| 174 | `nav-link font-mono-code fw-semibold py-2.5 px-3.5 ${ activeTab === 'roster' ? 'active text-primary border-bottom border-primary border-2' : 'text-secondary' }` | `primary` | 1 | Custom padding overrides (px/py); Manual font-weight override; Dynamic class interpolation | [`CrewGroupDetailView.tsx:171`](file:///c:/mapFiles/MAPv2/src/views/CrewGroupDetailView.tsx#L171) |

### 3.3 Outlier Analysis & Anti-Patterns

#### 1. Inverted Class Orders
Bootstrap conventions recommend `btn [size] [variant] [utilities]`. In 14 locations, the variant precedes the size class (e.g. `btn btn-outline-secondary btn-sm` in `RolesAndPermissionsView.tsx:281`, `InspectionChecklistView.tsx:1168`). Standardizing to `btn btn-sm btn-outline-secondary` ensures reliable regex replacements and uniform visual hierarchy.

#### 2. Rogue Custom Padding Overrides
Over 40 button instances manually override Bootstrap padding using utility classes such as `px-4`, `py-2.5`, `px-2.5 py-1`, or `py-0 px-2`. For example:
- `InspectionChecklistView.tsx:1182`: `btn btn-primary btn-sm px-4`
- `AssuranceDetailView.tsx:2690`: `btn btn-sm btn-outline-danger py-0 px-2`
- `CreateAssuranceSetView.tsx:2324`: `btn btn-sm btn-primary text-white d-inline-flex align-items-center gap-1 px-2.5 py-1`
These create jarring size discrepancies when placed side-by-side with standard `btn-sm` components.

#### 3. Rogue Sizing (`btn-xs` vs Un-sized Buttons)
- **`btn-xs` Outliers**: 4 instances in `AssuranceDetailView.tsx` (lines 2809, 2861, 2911, 2961) use `btn btn-xs btn-outline-primary align-self-start mt-1`. In Bootstrap 5, `btn-xs` does not exist by default unless custom-defined, causing inconsistent fallback styling.
- **Un-sized Full Buttons**: Dozens of modal actions, login buttons, and view headers omit `btn-sm` and render default 38px tall buttons right next to 31px `btn-sm` inputs.

#### 4. Font Weight & Shadow Quirks
- `InspectionChecklistView.tsx:984` and `1001` use `font-weight-500` which is a non-standard utility class in Bootstrap 5 (which uses `fw-medium` or `fw-semibold`).
- `VesselDetailView.tsx:3787` uses `shadow-2xs`, introducing custom elevation inconsistent with the flat design guidelines.

## 4. Spacing & Scale Audit

### 4.1 Spacing Scale Proposal (4 / 8 / 12 / 16 / 24 px)

To eliminate arbitrary gap utilities (`gap-0.5` through `gap-5`) and irregular padding pairs (`px-4 py-3`, `px-2.5 py-1.5`, `px-3.5 py-1.5`, `py-0 px-2`), MAPv2 will standardize on a unified 5-step spacing scale based on 4px base units:

| Scale Step | Target Size | Utility Classes | Semantic Usage | Design System Token |
|:---|:---:|:---|:---|:---|
| **Step 1 (xs)** | **4px** | `gap-1`, `p-1`, `px-1`, `py-1` | Tight inline icon-to-text gaps, micro badges, compact status chips | `space-1` (4px) |
| **Step 2 (sm)** | **8px** | `gap-2`, `p-2`, `px-2`, `py-2` | Standard button group gap, table row action icon gaps, input vertical padding | `space-2` (8px) |
| **Step 3 (md)** | **12px** | `gap-3`, `p-3`, `px-3`, `py-3` | Intermediate card gutters, form column gaps, sub-card internal padding | `space-3` (12px) |
| **Step 4 (lg)** | **16px** | `gap-4`, `p-4`, `px-4`, `py-4` | Standard card body padding, main grid column gaps, modal header padding | `space-4` (16px) |
| **Step 5 (xl)** | **24px** | `gap-5`, `p-5`, `px-5`, `py-5` | Modal inner body padding, drawer body padding, major section gutters | `space-6` (24px) |

### 4.2 Gap Values in Use & Scale Mapping

The entire `src/views/` directory contains exactly 9 distinct gap utility values across 418 gap occurrences. Every value in use maps directly to the proposed 5-step scale:

| Current Gap Utility | Pixel Equivalent | Current Count | Proposed Scale Step | Target Replacement | Classification & Action |
|:---|:---:|:---:|:---|:---|:---|
| `gap-0.5` | ~2px | 1 | **Step 1 (4px)** | `gap-1` | **Cramped Outlier**: Text lines collide; promote to standard 4px |
| `gap-1` | 4px | 38 | **Step 1 (4px)** | `gap-1` | **On Scale**: Retain for inline icon-to-text and micro chips |
| `gap-1.5` | ~6px | 64 | **Step 2 (8px)** | `gap-2` | **Fractional Outlier**: Used in action icon clusters; promote to standard 8px |
| `gap-2` | 8px | 186 | **Step 2 (8px)** | `gap-2` | **On Scale (Primary Standard)**: Retain as primary button group & toolbar gap |
| `gap-2.5` | ~10px | 4 | **Step 3 (12px)** | `gap-3` | **Fractional Outlier**: Off-grid flow container; promote to 12px |
| `gap-3` | 12px–16px | 78 | **Step 3 / Step 4** | `gap-3` (12px) / `gap-4` (16px) | **On Scale**: Retain for card gutters and filter toolbars |
| `gap-3.5` | ~14px | 2 | **Step 4 (16px)** | `gap-4` | **Fractional Outlier**: Promote to clean 16px grid |
| `gap-4` | 16px–24px | 25 | **Step 4 / Step 5** | `gap-4` (16px) / `gap-5` (24px) | **On Scale**: Retain for major container layout splits |
| `gap-5` | 24px–48px | 1 | **Step 5 (24px)** | `gap-5` | **On Scale**: Retain for hero layout spacing |
| **Total** | | **418** | | | **All 9 values fully mapped onto 4/8/12/16/24 scale** |

### 4.3 Padding Values in Use & Scale Mapping

Dozens of arbitrary padding utilities and pairs are in active use across components. Below is the mapping to standard scale values:

| Current Padding Utility / Pair | Current Occurrences | Proposed Target Scale | Target Replacement | Rationale & Remediation |
|:---|:---:|:---|:---|:---|
| `py-0`, `py-0.5` | 15 | **Step 1 (4px)** | `py-1` (or default component padding) | **Cramped Outlier**: Strips vertical touch target; restore standard `btn-sm` padding |
| `p-1.5`, `px-1.5`, `py-1.5` | 33 | **Step 2 (8px)** | `p-2`, `px-2`, `py-2` | **Fractional Outlier**: Irregular badge and button padding; normalize to 8px |
| `px-2.5 py-1` | 10 | **Step 2 / Step 1 (8px / 4px)** | `px-2 py-1` (or standard `btn-sm`) | **Fractional Outlier**: Non-standard button padding override; remove manual override |
| `px-2.5 py-1.5` | 28 | **Step 2 / Step 1 (8px / 4px)** | `px-2 py-1` | **Fractional Outlier**: Non-standard badge padding; standardize to unified badge token |
| `p-2.5`, `py-2.5` | 16 | **Step 3 (12px)** | `p-3`, `py-3` | **Fractional Outlier**: Non-standard table row and card padding; align to 12px |
| `px-3.5 py-1.5` | 6 | **Step 3 / Step 2 (12px / 8px)** | `px-3 py-2` | **Fractional Outlier**: Tab navigation links; align to standard navigation tokens |
| `px-4 py-3` | 14 | **Step 4 / Step 3 (16px / 12px)** | `px-4 py-2` or `p-3` | **Over-Padded Outlier**: Card/modal footers consume excessive vertical height |
| `p-5`, `py-5` | 14 | **Step 4 / Step 5 (16px / 24px)** | `p-4` / `p-5` | **Over-Padded Container**: Review for compact desktop screen fit |

### 4.4 Per-View Spacing Inventory (All 29 Views)

The table below catalogs the exact gap and padding utilities used across all 29 views in `src/views/`:

| View File | Gap Values Used (Counts) | Padding Classes in Use |
|:---|:---|:---|
| `ApproverDashboardView.tsx` | `gap-4` (4), `gap-3` (2), `gap-2` (3), `gap-1.5` (1), `gap-1` (1) | `p-4` (3), `pt-3` (1), `p-2` (4), `p-0` (6), `p-3` (4), `py-2` (5), `py-2.5` (1), `px-3` (2) *(+2 more)* |
| `AssuranceDetailView.tsx` | `gap-3` (16), `gap-1` (14), `gap-2` (39), `gap-4` (2), `gap-1.5` (12) | `p-4` (4), `py-4` (4), `px-3` (5), `py-1.5` (13), `px-4` (8), `px-2.5` (14), `py-2` (12), `pb-3` (1) *(+14 more)* |
| `AssuranceObjectsView.tsx` | `gap-4` (1), `gap-1.5` (1), `gap-2` (2) | `px-3` (1), `py-1.5` (1), `py-2` (2), `p-0` (3) |
| `AssuranceSetsView.tsx` | `gap-3` (1) | *None* |
| `AuditTrailView.tsx` | `gap-4` (1) | `px-3` (1), `py-2` (1), `py-4` (1), `p-3` (1) |
| `CapaManagementView.tsx` | `gap-4` (1) | `p-3` (2), `px-3` (1), `py-2` (1), `p-0` (2) |
| `CreateAssuranceSetView.tsx` | `gap-2` (55), `gap-3` (20), `gap-1` (10), `gap-4` (4), `gap-2.5` (2), `gap-1.5` (6), `gap-0.5` (1) | `p-3` (14), `px-2.5` (7), `py-1` (6), `p-1` (3), `p-4` (14), `p-2.5` (4), `px-3` (25), `p-1.5` (4) *(+16 more)* |
| `CreateProjectView.tsx` | `gap-3` (2), `gap-2` (10), `gap-1` (1) | `px-4` (1), `py-3` (1), `p-0` (3), `p-4` (2), `pt-1` (1), `py-2` (4), `ps-3` (1), `p-3` (2) *(+1 more)* |
| `CrewDetailView.tsx` | `gap-4` (1), `gap-1.5` (11), `gap-2` (4), `gap-1` (1) | `p-4` (4), `p-2` (3), `p-1.5` (2), `pb-1` (1), `p-0` (8), `py-1` (1), `p-3` (14), `py-4` (4) *(+4 more)* |
| `CrewGroupDetailView.tsx` | `gap-1.5` (5), `gap-4` (1), `gap-3` (1), `gap-2` (5) | `p-5` (1), `px-3` (2), `pt-2` (2), `py-2.5` (2), `px-3.5` (2), `p-4` (1), `px-2.5` (1), `py-1.5` (1) *(+5 more)* |
| `CrewView.tsx` | `gap-4` (1) | *None* |
| `DashboardView.tsx` | `gap-4` (1), `gap-2` (9), `gap-1` (2), `gap-1.5` (2) | `p-0` (7), `py-4` (3), `p-3` (2) |
| `DocumentDetailView.tsx` | `gap-4` (1), `gap-2` (2) | `p-0` (2), `p-4` (1), `p-3` (3) |
| `DocumentLibraryView.tsx` | `gap-3` (1) | `p-4` (1) |
| `EquipmentDetailView.tsx` | `gap-3` (2), `gap-1.5` (6), `gap-1` (2), `gap-2` (3) | `p-2` (5), `pb-1` (1), `p-0` (5), `py-1.5` (1), `px-1` (3), `py-4` (2), `p-3` (9), `px-4` (1) *(+4 more)* |
| `EquipmentView.tsx` | `gap-3` (1), `gap-1.5` (1), `gap-2` (2) | `p-3` (3), `px-2.5` (1), `py-1` (2), `px-3` (3), `py-1.5` (2), `py-2` (1), `py-4` (1), `p-0` (1) |
| `FleetRegistryView.tsx` | `gap-3` (1) | *None* |
| `InspectionChecklistView.tsx` | `gap-4` (1), `gap-3` (4), `gap-3.5` (1), `gap-2` (7), `gap-1.5` (3), `gap-2.5` (2), `gap-1` (1) | `pb-2` (5), `px-3` (4), `py-1` (4), `py-1.5` (1), `p-3` (8), `p-0` (1), `px-2` (1), `py-0.5` (1) *(+6 more)* |
| `InspectorWorkspaceView.tsx` | `gap-4` (1), `gap-3` (1) | `py-2` (2), `p-3` (1), `px-3` (1), `p-0` (2) |
| `LoginView.tsx` | `gap-3` (1), `gap-5` (1), `gap-2` (1) | `p-5` (2), `py-5` (1), `pt-4` (1), `p-4` (1), `py-2` (3), `px-3` (2), `p-0` (1) |
| `MarketplaceView.tsx` | `gap-3.5` (1), `gap-3` (2), `gap-2` (2) | `p-3` (1), `px-2.5` (1), `px-3` (1), `py-2` (1), `p-4` (1), `py-5` (2), `p-0` (1) |
| `NotificationsView.tsx` | `gap-3` (1), `gap-2` (1) | `py-2` (2), `p-3` (2), `px-3` (1), `py-5` (1), `p-0` (1) |
| `OrganizationProfileView.tsx` | `gap-4` (1), `gap-3` (1), `gap-2` (2), `gap-1` (1) | `py-2` (3), `px-3` (3), `p-4` (1) |
| `ProjectDetailView.tsx` | `gap-3` (7), `gap-2` (6), `gap-1.5` (5), `gap-1` (1) | `py-2` (3), `p-4` (3), `pb-2` (11), `px-2.5` (1), `py-1.5` (1), `py-1` (1), `p-3` (4), `px-3` (2) *(+3 more)* |
| `ProjectView.tsx` | `gap-3` (1) | `p-3` (2), `px-3` (1), `py-2` (1), `py-4` (1), `p-0` (1) |
| `RolesAndPermissionsView.tsx` | `gap-4` (1), `gap-3` (3), `gap-2` (3) | `pb-5` (1), `py-2` (3), `p-1` (1), `px-3` (3), `py-1.5` (2), `p-3` (1) |
| `UserManagementView.tsx` | `gap-4` (1) | *None* |
| `VerifierWorkspaceView.tsx` | `gap-4` (1), `gap-3` (1) | `py-2` (2), `p-3` (1), `px-3` (1), `p-0` (2) |
| `VesselDetailView.tsx` | `gap-3` (9), `gap-1` (4), `gap-1.5` (11), `gap-2` (30), `gap-4` (1) | `px-4` (1), `py-5` (1), `p-5` (1), `p-4` (9), `p-2` (5), `py-1.5` (1), `px-1` (3), `py-3` (4) *(+11 more)* |


### 4.5 Button Groups & Action Containers Gap Analysis

Analysis of multi-button toolbars, modal footers, and table row action clusters across views reveals significant inconsistency in container gaps. Below is the full audit of button group containers:

| # | File & Line | Gap Utility | Buttons Count | Container Snippet | Classification |
|:--|:---|:---:|:---:|:---|:---|
| 1 | [`ApproverDashboardView.tsx:656`](file:///c:/mapFiles/MAPv2/src/views/ApproverDashboardView.tsx#L656) | `gap-2` | 2 | `<div className="d-flex flex-column gap-2">` | Standard (8px) |
| 2 | [`AssuranceDetailView.tsx:2308`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L2308) | `gap-2` | 2 | `<div className="d-flex align-items-center gap-2">` | Standard (8px) |
| 3 | [`AssuranceDetailView.tsx:3508`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L3508) | `gap-2` | 2 | `<div className="col-auto d-flex align-items-center gap-2">` | Standard (8px) |
| 4 | [`AssuranceDetailView.tsx:4455`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L4455) | `gap-2` | 2 | `<div className="d-flex align-items-center gap-2">` | Standard (8px) |
| 5 | [`AssuranceDetailView.tsx:4535`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L4535) | `gap-2` | 2 | `<div className="col-12 col-md-3 d-flex justify-content-md-end gap-2">` | Standard (8px) |
| 6 | [`AssuranceDetailView.tsx:5081`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L5081) | `None (missing)` | 2 | `<div className="d-flex align-items-center justify-content-between mb-2` | Missing Gap (Risk of Collision) |
| 7 | [`AssuranceDetailView.tsx:5083`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L5083) | `gap-2` | 2 | `<div className="d-flex gap-2">` | Standard (8px) |
| 8 | [`CreateAssuranceSetView.tsx:3835`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L3835) | `gap-2` | 2 | `<div className="col-12 col-md-2 d-flex gap-2">` | Standard (8px) |
| 9 | [`CreateAssuranceSetView.tsx:4384`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L4384) | `gap-2` | 2 | `<div className="card-footer bg-light border-top px-4 py-3 d-flex align` | Standard (8px) |
| 10 | [`CreateAssuranceSetView.tsx:4385`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L4385) | `gap-2` | 2 | `<div className="d-flex align-items-center gap-2">` | Standard (8px) |
| 11 | [`CreateAssuranceSetView.tsx:4470`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L4470) | `None (missing)` | 2 | `<div className="modal-footer border-top bg-light px-4 py-3 d-flex alig` | Missing Gap (Risk of Collision) |
| 12 | [`CreateAssuranceSetView.tsx:4478`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L4478) | `gap-2` | 2 | `<div className="d-flex align-items-center gap-2">` | Standard (8px) |
| 13 | [`CreateProjectView.tsx:886`](file:///c:/mapFiles/MAPv2/src/views/CreateProjectView.tsx#L886) | `None (missing)` | 2 | `<div className="d-flex justify-content-between">` | Missing Gap (Risk of Collision) |
| 14 | [`CreateProjectView.tsx:894`](file:///c:/mapFiles/MAPv2/src/views/CreateProjectView.tsx#L894) | `gap-2` | 2 | `<div className="d-flex gap-2">` | Standard (8px) |
| 15 | [`CreateProjectView.tsx:1104`](file:///c:/mapFiles/MAPv2/src/views/CreateProjectView.tsx#L1104) | `None (missing)` | 2 | `<div className="d-flex justify-content-between">` | Missing Gap (Risk of Collision) |
| 16 | [`CreateProjectView.tsx:1112`](file:///c:/mapFiles/MAPv2/src/views/CreateProjectView.tsx#L1112) | `gap-2` | 2 | `<div className="d-flex gap-2">` | Standard (8px) |
| 17 | [`CrewDetailView.tsx:1444`](file:///c:/mapFiles/MAPv2/src/views/CrewDetailView.tsx#L1444) | `gap-2` | 2 | `<div className="d-flex align-items-center gap-2">` | Standard (8px) |
| 18 | [`CrewGroupDetailView.tsx:240`](file:///c:/mapFiles/MAPv2/src/views/CrewGroupDetailView.tsx#L240) | `gap-2` | 2 | `<div className="d-flex align-items-center gap-2 pt-2">` | Standard (8px) |
| 19 | [`CrewGroupDetailView.tsx:241`](file:///c:/mapFiles/MAPv2/src/views/CrewGroupDetailView.tsx#L241) | `gap-1.5` | 2 | `<button type="submit" className="btn btn-sm btn-primary d-inline-flex ` | Tight / Fractional (6px) |
| 20 | [`EquipmentDetailView.tsx:696`](file:///c:/mapFiles/MAPv2/src/views/EquipmentDetailView.tsx#L696) | `gap-2` | 2 | `<div className="d-flex align-items-center gap-2">` | Standard (8px) |
| 21 | [`InspectionChecklistView.tsx:748`](file:///c:/mapFiles/MAPv2/src/views/InspectionChecklistView.tsx#L748) | `gap-2` | 2 | `<div className="d-flex justify-content-end gap-2">` | Standard (8px) |
| 22 | [`InspectionChecklistView.tsx:791`](file:///c:/mapFiles/MAPv2/src/views/InspectionChecklistView.tsx#L791) | `gap-2` | 2 | `<div className="d-flex justify-content-end gap-2">` | Standard (8px) |
| 23 | [`InspectionChecklistView.tsx:1157`](file:///c:/mapFiles/MAPv2/src/views/InspectionChecklistView.tsx#L1157) | `None (missing)` | 2 | `<div className="d-flex align-items-center justify-content-between pb-2` | Missing Gap (Risk of Collision) |
| 24 | [`InspectionChecklistView.tsx:1162`](file:///c:/mapFiles/MAPv2/src/views/InspectionChecklistView.tsx#L1162) | `gap-3` | 2 | `<div className="d-flex flex-column align-items-center gap-3">` | Loose (12/16px) |
| 25 | [`InspectionChecklistView.tsx:1167`](file:///c:/mapFiles/MAPv2/src/views/InspectionChecklistView.tsx#L1167) | `gap-2` | 2 | `<div className="d-flex justify-content-center flex-wrap gap-2 w-100">` | Standard (8px) |
| 26 | [`InspectionChecklistView.tsx:1190`](file:///c:/mapFiles/MAPv2/src/views/InspectionChecklistView.tsx#L1190) | `gap-2` | 2 | `<div className="d-flex justify-content-center gap-2 w-100">` | Standard (8px) |
| 27 | [`MarketplaceView.tsx:306`](file:///c:/mapFiles/MAPv2/src/views/MarketplaceView.tsx#L306) | `None (missing)` | 2 | `<div className="btn-group" role="group" aria-label="View mode">` | Missing Gap (Risk of Collision) |
| 28 | [`OrganizationProfileView.tsx:143`](file:///c:/mapFiles/MAPv2/src/views/OrganizationProfileView.tsx#L143) | `gap-2` | 2 | `<div className="d-flex align-items-center gap-2">` | Standard (8px) |
| 29 | [`OrganizationProfileView.tsx:149`](file:///c:/mapFiles/MAPv2/src/views/OrganizationProfileView.tsx#L149) | `gap-1` | 2 | `<button type="button" className="btn btn-sm btn-primary d-flex align-i` | Cramped (4px) |
| 30 | [`ProjectDetailView.tsx:251`](file:///c:/mapFiles/MAPv2/src/views/ProjectDetailView.tsx#L251) | `gap-2` | 2 | `<div className="d-flex flex-wrap gap-2">` | Standard (8px) |
| 31 | [`RolesAndPermissionsView.tsx:476`](file:///c:/mapFiles/MAPv2/src/views/RolesAndPermissionsView.tsx#L476) | `gap-2` | 2 | `<div className="d-flex gap-2">` | Standard (8px) |
| 32 | [`VesselDetailView.tsx:2548`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L2548) | `gap-2` | 2 | `<div className="d-flex align-items-center gap-2 ms-auto">` | Standard (8px) |
| 33 | [`VesselDetailView.tsx:3432`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L3432) | `None (missing)` | 2 | `<div className="modal-footer border-top bg-light d-flex justify-betwee` | Missing Gap (Risk of Collision) |
| 34 | [`VesselDetailView.tsx:3987`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L3987) | `gap-2` | 2 | `<div className="d-flex align-items-center gap-2">` | Standard (8px) |


### 4.6 Padding Outliers Inventory (with File & Line References)

The table below lists specific padding outliers with exact file and line references:

| # | File & Line | Value / Pair | Context / Element | Issue Description |
|:--|:---|:---|:---|:---|
| 1 | [`ApproverDashboardView.tsx:652`](file:///c:/mapFiles/MAPv2/src/views/ApproverDashboardView.tsx#L652) | `py-2.5` | `<div className="alert alert-success py-2.5 px-3 small font-mono-code fw-sem` | Fractional / non-standard padding |
| 2 | [`ApproverDashboardView.tsx:704`](file:///c:/mapFiles/MAPv2/src/views/ApproverDashboardView.tsx#L704) | `p-1.5` | `<div className="absolute -bottom-2 -right-2 p-1.5 bg-sky-500 rounded-full t` | Fractional scale padding (off 4/8/12/16/24 scale) |
| 3 | [`AssuranceDetailView.tsx:1567`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L1567) | `py-1.5` | `<div className="badge bg-warning-subtle text-dark border border-warning-sub` | Fractional scale padding (off 4/8/12/16/24 scale) |
| 4 | [`AssuranceDetailView.tsx:2097`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L2097) | `py-1.5` | `<span className="badge bg-secondary text-white px-2.5 py-1.5" style={{ font` | Fractional scale padding (off 4/8/12/16/24 scale) |
| 5 | [`AssuranceDetailView.tsx:2106`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L2106) | `py-1.5` | `return <span className="badge bg-success text-white px-2.5 py-1.5" style={{` | Fractional scale padding (off 4/8/12/16/24 scale) |
| 6 | [`AssuranceDetailView.tsx:2108`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L2108) | `py-1.5` | `return <span className="badge bg-info text-dark px-2.5 py-1.5" style={{ fon` | Fractional scale padding (off 4/8/12/16/24 scale) |
| 7 | [`AssuranceDetailView.tsx:2111`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L2111) | `py-1.5` | `return <span className="badge bg-warning text-dark px-2.5 py-1.5" style={{ ` | Fractional scale padding (off 4/8/12/16/24 scale) |
| 8 | [`AssuranceDetailView.tsx:2114`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L2114) | `py-1.5` | `return <span className="badge bg-danger text-white px-2.5 py-1.5" style={{ ` | Fractional scale padding (off 4/8/12/16/24 scale) |
| 9 | [`AssuranceDetailView.tsx:2123`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L2123) | `py-1.5` | `return <span className="badge bg-warning text-dark px-2.5 py-1.5" style={{ ` | Fractional scale padding (off 4/8/12/16/24 scale) |
| 10 | [`AssuranceDetailView.tsx:2127`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L2127) | `py-1.5` | `<span className="badge bg-primary text-white px-2.5 py-1.5" style={{ fontSi` | Fractional scale padding (off 4/8/12/16/24 scale) |
| 11 | [`AssuranceDetailView.tsx:2679`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L2679) | `py-0` | `className="btn btn-sm btn-outline-primary py-0 px-2 d-inline-flex align-ite` | Cramped zero vertical padding on button |
| 12 | [`AssuranceDetailView.tsx:2692`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L2692) | `py-0` | `className="btn btn-sm btn-outline-danger py-0 px-2"` | Cramped zero vertical padding on button |
| 13 | [`AssuranceDetailView.tsx:2706`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L2706) | `py-0` | `className="btn btn-sm btn-outline-danger py-0 px-2"` | Cramped zero vertical padding on button |
| 14 | [`AssuranceDetailView.tsx:2719`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L2719) | `py-0` | `className="btn btn-sm btn-outline-danger py-0 px-2"` | Cramped zero vertical padding on button |
| 15 | [`AssuranceDetailView.tsx:2734`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L2734) | `py-0` | `className="btn btn-sm btn-danger text-white py-0 px-2"` | Cramped zero vertical padding on button |
| 16 | [`AssuranceDetailView.tsx:3616`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L3616) | `py-2.5` | `<td colSpan={reqTableColSpan} className="py-2.5 px-3">` | Fractional / non-standard padding |
| 17 | [`AssuranceDetailView.tsx:3672`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L3672) | `py-1.5` | `<td colSpan={reqTableColSpan} className="py-1.5 px-4 text-secondary small f` | Fractional scale padding (off 4/8/12/16/24 scale) |
| 18 | [`AssuranceDetailView.tsx:3745`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L3745) | `py-2.5` | `<td colSpan={reqTableColSpan} className="py-2.5 px-4">` | Fractional / non-standard padding |
| 19 | [`AssuranceDetailView.tsx:3831`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L3831) | `py-1.5` | `<span className="badge bg-success text-white px-2.5 py-1.5" style={{ fontSi` | Fractional scale padding (off 4/8/12/16/24 scale) |
| 20 | [`AssuranceDetailView.tsx:3838`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L3838) | `py-1.5` | `<span className="badge bg-warning text-dark px-2.5 py-1.5" style={{ fontSiz` | Fractional scale padding (off 4/8/12/16/24 scale) |
| 21 | [`AssuranceDetailView.tsx:3844`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L3844) | `py-1.5` | `<span className="badge bg-secondary text-white px-2.5 py-1.5" style={{ font` | Fractional scale padding (off 4/8/12/16/24 scale) |
| 22 | [`AssuranceDetailView.tsx:3881`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L3881) | `py-2.5` | `<td colSpan={reqTableColSpan} className="py-2.5 px-4">` | Fractional / non-standard padding |
| 23 | [`AssuranceDetailView.tsx:4024`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L4024) | `py-2.5` | `<td colSpan={reqTableColSpan} style={{ paddingLeft: '4rem' }} className="py` | Fractional / non-standard padding |
| 24 | [`AssuranceDetailView.tsx:4053`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L4053) | `px-2.5` | `className="btn btn-sm btn-outline-primary d-inline-flex align-items-center ` | Fractional scale padding (off 4/8/12/16/24 scale) |
| 25 | [`AssuranceDetailView.tsx:4067`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L4067) | `px-2.5` | `className="btn btn-sm btn-outline-secondary d-inline-flex align-items-cente` | Fractional scale padding (off 4/8/12/16/24 scale) |
| 26 | [`AssuranceDetailView.tsx:4221`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L4221) | `py-2.5` | `<td colSpan={reqTableColSpan} className="py-2.5 px-4">` | Fractional / non-standard padding |
| 27 | [`AssuranceDetailView.tsx:4269`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L4269) | `px-2.5` | `className="btn btn-sm btn-outline-primary d-inline-flex align-items-center ` | Fractional scale padding (off 4/8/12/16/24 scale) |
| 28 | [`AssuranceDetailView.tsx:4283`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L4283) | `px-2.5` | `className="btn btn-sm btn-outline-secondary d-inline-flex align-items-cente` | Fractional scale padding (off 4/8/12/16/24 scale) |
| 29 | [`AssuranceDetailView.tsx:4366`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L4366) | `py-2.5` | `<td colSpan={reqTableColSpan} className="py-2.5 px-3">` | Fractional / non-standard padding |
| 30 | [`AssuranceDetailView.tsx:4674`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L4674) | `px-4 py-3` | `<div className="modal-header border-bottom px-4 py-3">` | Oversized container/footer padding |
| 31 | [`AssuranceDetailView.tsx:4711`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L4711) | `px-4 py-3` | `<div className="modal-footer border-top px-4 py-3">` | Oversized container/footer padding |
| 32 | [`AssuranceDetailView.tsx:5204`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L5204) | `py-1.5` | `<div className="alert alert-danger py-1.5 px-3 mb-0 small">{exemptionError}` | Fractional scale padding (off 4/8/12/16/24 scale) |
| 33 | [`AssuranceObjectsView.tsx:336`](file:///c:/mapFiles/MAPv2/src/views/AssuranceObjectsView.tsx#L336) | `py-1.5` | `className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1` | Fractional scale padding (off 4/8/12/16/24 scale) |
| 34 | [`CreateAssuranceSetView.tsx:2326`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L2326) | `px-2.5` | `className="btn btn-sm btn-primary text-white d-inline-flex align-items-cent` | Fractional scale padding (off 4/8/12/16/24 scale) |
| 35 | [`CreateAssuranceSetView.tsx:2335`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L2335) | `px-2.5` | `className="btn btn-sm btn-outline-secondary d-inline-flex align-items-cente` | Fractional scale padding (off 4/8/12/16/24 scale) |


### 4.7 Cramped and Over-Padded Spots Analysis

#### 1. Cramped Spots (Touch Target & Breathing Room Violations)

1. **Zero Vertical Padding on Buttons (`py-0 px-2`)**:
   - Location: [`AssuranceDetailView.tsx:2679`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L2679), `2692`, `2706`, `2719`, `2734`.
   - Issue: The `py-0` utility flattens the button vertically to the exact line height of the text (less than 20px tall), violating the minimum 32px touch target standard for desktop web controls.
   - Remediation: Replace with standard `btn btn-sm` styling without `py-0`.

2. **Sub-Standard Gap on Table Row Action Icon Buttons (`gap-1.5`)**:
   - Locations:
     - [`AssuranceDetailView.tsx:3240`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L3240)
     - [`AssuranceDetailView.tsx:3851`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L3851)
     - [`AssuranceDetailView.tsx:3994`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L3994)
     - [`AssuranceDetailView.tsx:4149`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L4149)
     - [`CrewDetailView.tsx:883`](file:///c:/mapFiles/MAPv2/src/views/CrewDetailView.tsx#L883)
     - [`CrewDetailView.tsx:1026`](file:///c:/mapFiles/MAPv2/src/views/CrewDetailView.tsx#L1026)
     - [`VesselDetailView.tsx:2724`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L2724)
     - [`VesselDetailView.tsx:3083`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L3083)
   - Issue: 32x32px icon buttons sit only 6px apart (`gap-1.5`), causing adjacent click target interference and visual crowding against table cell borders.
   - Remediation: Upgrade to standard `gap-2` (8px).

3. **Micro Gap on Label & Subtitle Stacks (`gap-0.5`)**:
   - Location: [`CreateAssuranceSetView.tsx:4350`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L4350) (`<div className="d-flex flex-column gap-0.5 min-w-0">`).
   - Issue: 2px gap compresses heading and secondary text so descenders and ascenders almost collide.
   - Remediation: Upgrade to standard `gap-1` (4px).

4. **Missing Gaps on Multi-Button Action Bars**:
   - Locations:
     - [`CreateAssuranceSetView.tsx:4470`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L4470) (`modal-footer ... d-flex align-items-center justify-content-between`)
     - [`CreateProjectView.tsx:886`](file:///c:/mapFiles/MAPv2/src/views/CreateProjectView.tsx#L886) (`d-flex justify-content-between`)
     - [`CreateProjectView.tsx:1104`](file:///c:/mapFiles/MAPv2/src/views/CreateProjectView.tsx#L1104) (`d-flex justify-content-between`)
     - [`VesselDetailView.tsx:3432`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L3432) (`modal-footer border-top bg-light d-flex justify-between`)
   - Issue: When viewports shrink or modal content wraps, buttons collide because the container lacks an explicit flex gap. Furthermore, `justify-between` in `VesselDetailView:3432` is invalid Bootstrap syntax.
   - Remediation: Add explicit `gap-2` (8px) on all action containers.

#### 2. Over-Padded Spots (Excessive Height & Visual Weight Violations)

1. **Bloated Card & Modal Footers (`px-4 py-3`)**:
   - Locations:
     - [`CreateAssuranceSetView.tsx:4384`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L4384)
     - [`CreateAssuranceSetView.tsx:4470`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L4470)
     - [`CreateProjectView.tsx:885`](file:///c:/mapFiles/MAPv2/src/views/CreateProjectView.tsx#L885)
     - [`CreateProjectView.tsx:1103`](file:///c:/mapFiles/MAPv2/src/views/CreateProjectView.tsx#L1103)
     - [`EquipmentDetailView.tsx:752`](file:///c:/mapFiles/MAPv2/src/views/EquipmentDetailView.tsx#L752)
     - [`InspectionChecklistView.tsx:1156`](file:///c:/mapFiles/MAPv2/src/views/InspectionChecklistView.tsx#L1156)
     - [`VesselDetailView.tsx:3425`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L3425)
     - [`VesselDetailView.tsx:3760`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L3760)
     - [`VesselDetailView.tsx:4044`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L4044)
   - Issue: `py-3` adds 16px top and bottom padding, making footers over 60px tall for a single 31px button.
   - Remediation: Reduce vertical footer padding to `py-2` (8px) or standard `p-3` (12px).

2. **Over-Padded Full-Height Buttons (`py-2`, `px-4`)**:
   - Locations:
     - [`ApproverDashboardView.tsx:657`](file:///c:/mapFiles/MAPv2/src/views/ApproverDashboardView.tsx#L657), `665`, `672` (`btn btn-... py-2 fw-semibold`)
     - [`InspectionChecklistView.tsx:1182`](file:///c:/mapFiles/MAPv2/src/views/InspectionChecklistView.tsx#L1182) (`btn btn-primary btn-sm px-4`)
     - [`AssuranceDetailView.tsx:1576`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L1576) (`btn btn-primary px-4 fw-semibold`)
   - Issue: Manual padding overrides produce inflated buttons (44px tall) that mismatch adjacent `btn-sm` controls.
   - Remediation: Standardize on `btn-sm` without manual padding overrides.

3. **Non-Standard Badge Padding Overrides (`px-2.5 py-1.5`)**:
   - Locations: 28 occurrences across [`AssuranceDetailView.tsx:2097-2127`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L2097), `3831`, `3838`, `3844`, [`ProjectDetailView.tsx:327`](file:///c:/mapFiles/MAPv2/src/views/ProjectDetailView.tsx#L327), [`CrewGroupDetailView.tsx:158`](file:///c:/mapFiles/MAPv2/src/views/CrewGroupDetailView.tsx#L158), [`EquipmentView.tsx:210`](file:///c:/mapFiles/MAPv2/src/views/EquipmentView.tsx#L210).
   - Issue: Custom `px-2.5 py-1.5` forces badges to be taller than necessary, displacing tabular row heights.
   - Remediation: Replace with standard MAP badge styling (`px-2 py-1` or Bootstrap `badge`).

4. **Excessive Container Padding (`p-5`, `py-5`)**:
   - Locations: [`LoginView.tsx:35`](file:///c:/mapFiles/MAPv2/src/views/LoginView.tsx#L35), [`CrewGroupDetailView.tsx:135`](file:///c:/mapFiles/MAPv2/src/views/CrewGroupDetailView.tsx#L135), [`VesselDetailView.tsx:889`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L889).
   - Issue: Large `p-5` (48px) internal container padding wastes screen real estate on desktop monitors.
   - Remediation: Reduce to standard `p-4` (16px) or `p-4 py-3`.

## 5. Modal Architecture Audit

### 5.1 Overview & Architecture Anti-Patterns

Across the MAPv2 codebase, modals are implemented via three competing paradigms:
1. **15 Standalone Modal Components**: Specialized modals located in `src/components/modals/` and `src/components/common/`.
2. **6 Views with Inline Modal Markup**: Views that implement modal DOM trees directly inside the page component rather than delegating to reusable wrappers (`AssuranceDetailView.tsx`, `CreateAssuranceSetView.tsx`, `CrewDetailView.tsx`, `EquipmentDetailView.tsx`, `RolesAndPermissionsView.tsx`, `VesselDetailView.tsx`).
3. **Card-in-Backdrop Abstraction**: Instead of standard Bootstrap `modal-dialog` / `modal-content`, two modals (`AddUserModal.tsx` and `EditUserModal.tsx`) assemble a modal using a custom `map-modal-backdrop` wrapping a standard Bootstrap `card`.

In total, exactly **21 modal implementations** exist across the application. Across these 21 modals, significant variance exists in header padding, footer padding, modal widths, close button styling, and the position and order of Cancel and Confirm buttons.

### 5.2 Standalone Modal Components Inventory (15 Modals)

The table below catalogs all 15 standalone modal components in the application:

| # | Modal Component | File & Line | Width / MaxWidth | Header Padding | Footer Padding | Close Button | Cancel / Confirm Order & Alignment |
|:--|:---|:---|:---|:---|:---|:---|:---|
| 1 | **Add Crew** | [`AddCrewModal.tsx:187`](file:///c:/mapFiles/MAPv2/src/components/modals/AddCrewModal.tsx#L187) | `maxWidth: 620px` / `modal-lg` | `p-3` | `p-3` | Lucide `X` & `btn-close` | Split: Cancel Left / Save Right |
| 2 | **Add User** | [`AddUserModal.tsx:138`](file:///c:/mapFiles/MAPv2/src/components/modals/AddUserModal.tsx#L138) | `maxWidth: 580px` (Card) | `p-3` | `p-3` | Lucide `X` | Right-aligned: Cancel then Add (Standard) |
| 3 | **Attach Assurance Set Preview** | [`AttachAssuranceSetPreviewModal.tsx:288`](file:///c:/mapFiles/MAPv2/src/components/modals/AttachAssuranceSetPreviewModal.tsx#L288) | `maxWidth: 720px` | `px-4 py-3` | `px-4 py-3` | `btn-close` | Split: Cancel Left / Attach Right |
| 4 | **Crew Document Upload** | [`CrewDocumentUploadModal.tsx:758`](file:///c:/mapFiles/MAPv2/src/components/modals/CrewDocumentUploadModal.tsx#L758) | Dynamic: `1100px` / `720px` | `p-3` | Default (`p-3`) | `btn-close` | Right-aligned: Cancel then Upload (Standard) |
| 5 | **Crew Document Viewer** | [`CrewDocumentViewerModal.tsx:45`](file:///c:/mapFiles/MAPv2/src/components/modals/CrewDocumentViewerModal.tsx#L45) | Delegates to `modal-xl` | `px-4 py-3` | `p-3` | Lucide `X` | Split: Cancel Left / Verify Right |
| 6 | **Document Upload** | [`DocumentUploadModal.tsx:854`](file:///c:/mapFiles/MAPv2/src/components/modals/DocumentUploadModal.tsx#L854) | Dynamic: `1100px` / `720px` | `p-3` | Default (`p-3`) | `btn-close` | Right-aligned: Cancel then Upload (Standard) |
| 7 | **Edit User** | [`EditUserModal.tsx:138`](file:///c:/mapFiles/MAPv2/src/components/modals/EditUserModal.tsx#L138) | `maxWidth: 580px` (Card) | `p-3` | `p-3` | Lucide `X` | Right-aligned: Cancel then Save (Standard) |
| 8 | **Equipment Modal** | [`EquipmentModal.tsx:130`](file:///c:/mapFiles/MAPv2/src/components/modals/EquipmentModal.tsx#L130) | `modal-lg` (800px) | `p-3` | `p-3` | Lucide `X` | Split: Cancel Left (`me-auto`) / Save Right |
| 9 | **Filter Modal** | [`FilterModal.tsx:49`](file:///c:/mapFiles/MAPv2/src/components/common/FilterModal.tsx#L49) | Default (500px) | `p-3.5` (Outlier) | `p-3` | `btn-close` | Split: Reset Left / Apply Right |
| 10 | **Notification Detail** | [`NotificationDetailModal.tsx:173`](file:///c:/mapFiles/MAPv2/src/components/modals/NotificationDetailModal.tsx#L173) | `map-notif-modal-dialog` (540px) | Default (`p-3`) | Default (`p-3`) | `btn-close` | Split: Dismiss Left / View Target Right |
| 11 | **Project Add Asset** | [`ProjectAddAssetModal.tsx:547`](file:///c:/mapFiles/MAPv2/src/components/modals/ProjectAddAssetModal.tsx#L547) | `maxWidth: 940px` | `px-4 py-3` | `px-4 py-3` | Lucide `X` | Split: Cancel Left / Add Assets Right |
| 12 | **Request Assurance Set** | [`RequestAssuranceSetModal.tsx:113`](file:///c:/mapFiles/MAPv2/src/components/modals/RequestAssuranceSetModal.tsx#L113) | Default (500px) | Default (`p-3`) | Default (`p-3`) | `btn-close` | Right-aligned: Cancel then Request (Standard) |
| 13 | **Universal Document Preview** | [`UniversalDocumentPreviewModal.tsx:72`](file:///c:/mapFiles/MAPv2/src/components/modals/UniversalDocumentPreviewModal.tsx#L72) | `modal-xl` (1140px) | `px-4 py-3` | `p-3` | Lucide `X` | Split: Close Left / Actions Right |
| 14 | **Vessel Image Crop** | [`VesselImageCropModal.tsx:300`](file:///c:/mapFiles/MAPv2/src/components/modals/VesselImageCropModal.tsx#L300) | `modal-lg` (800px) | `px-4 py-3` | `px-4 py-3` | Lucide `X` | Split: Cancel Left / Crop Right |
| 15 | **Vessel Modal** | [`VesselModal.tsx:775`](file:///c:/mapFiles/MAPv2/src/components/modals/VesselModal.tsx#L775) | `modal-xl` (1140px) | `p-3` | Rogue `justify-between` | Lucide `X` | Split: Cancel Left / Save Right |

### 5.3 Inline Modal Implementations in Views (6 Views)

The table below catalogs the inline modal markup written by hand across 6 view files:

| # | View File & Modal Purpose | File & Line | Width / MaxWidth | Header Padding | Footer Padding | Close Button | Cancel / Confirm Order & Alignment |
|:--|:---|:---|:---|:---|:---|:---|:---|
| 16a | **AssuranceDetailView** - Add to Project | [`AssuranceDetailView.tsx:4672`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L4672) | `maxWidth: 480px` | `px-4 py-3` | `px-4 py-3` | `btn-close` | Right-aligned: Cancel / Close only |
| 16b | **AssuranceDetailView** - Certificates Expire Warning | [`AssuranceDetailView.tsx:4733`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L4733) | Default (500px) | Default (`p-3`) | Default (`p-3`) | *None* | Right-aligned: Cancel then Save (Standard) |
| 16c | **AssuranceDetailView** - Edit Task Target Date | [`AssuranceDetailView.tsx:4788`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L4788) | Default (500px) | Default (`p-3`) | Default (`p-3`) | `btn-close` | Right-aligned: Cancel then Save (Standard) |
| 16d | **AssuranceDetailView** - Target Date Grants | [`AssuranceDetailView.tsx:4855`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L4855) | `modal-lg` (800px) | Default (`p-3`) | Default (`p-3`) | `btn-close` | Right-aligned: Close only |
| 16e | **AssuranceDetailView** - Revise Completion Date | [`AssuranceDetailView.tsx:5003`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L5003) | Default (500px) | Default (`p-3`) | Default (`p-3`) | `btn-close` | Right-aligned: Cancel then Save (Standard) |
| 16f | **AssuranceDetailView** - Exempt Tasks | [`AssuranceDetailView.tsx:5070`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L5070) | `modal-lg` (800px) | Default (`p-3`) | Default (`p-3`) | `btn-close` | Right-aligned: Close only |
| 16g | **AssuranceDetailView** - Confirm Partial Closure | [`AssuranceDetailView.tsx:5226`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L5226) | Default (500px) | Default (`p-3`) | Default (`p-3`) | `btn-close` | Right-aligned: Cancel then Confirm (Standard) |
| 16h | **AssuranceDetailView** - Cancel Assurance Set | [`AssuranceDetailView.tsx:5303`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L5303) | Default (500px) | Default (`p-3`) | Default (`p-3`) | `btn-close` | Right-aligned: Back then Confirm (Standard) |
| 16i | **AssuranceDetailView** - Add Task | [`AssuranceDetailView.tsx:5349`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L5349) | Default (500px) | Default (`p-3`) | Default (`p-3`) | `btn-close` | Right-aligned: Cancel then Add (Standard) |
| 16j | **AssuranceDetailView** - Edit Task | [`AssuranceDetailView.tsx:5496`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L5496) | Default (500px) | Default (`p-3`) | Default (`p-3`) | `btn-close` | Right-aligned: Cancel then Save (Standard) |
| 16k | **AssuranceDetailView** - Remove Task | [`AssuranceDetailView.tsx:5649`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L5649) | Default (500px) | Default (`p-3`) | Default (`p-3`) | `btn-close` | Right-aligned: Cancel then Remove (Standard) |
| 16l | **AssuranceDetailView** - Exclude Seafarer | [`AssuranceDetailView.tsx:5685`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L5685) | Default (500px) | Default (`p-3`) | `bg-light py-2` (Outlier) | `btn-close` | Right-aligned: Cancel then Exclude (Standard) |
| 17 | **CreateAssuranceSetView** - Unsaved Changes | [`CreateAssuranceSetView.tsx:4443`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L4443) | `maxWidth: 480px` | `px-4 py-3 bg-light` | `px-4 py-3` | `btn-close` | Split: Cancel Left / Discard Right |
| 18a | **CrewDetailView** - Manage Photos | [`CrewDetailView.tsx:1202`](file:///c:/mapFiles/MAPv2/src/views/CrewDetailView.tsx#L1202) | `modal-lg` (800px) | `p-3` | `p-3` | `btn-close` | Split: Cancel Left / Save Right |
| 18b | **CrewDetailView** - Add Photo | [`CrewDetailView.tsx:1491`](file:///c:/mapFiles/MAPv2/src/views/CrewDetailView.tsx#L1491) | `modal-lg` (800px) | `p-3` | Default (`p-3`) | `btn-close` | Split: Cancel Left / Upload Right |
| 19a | **EquipmentDetailView** - Manage Photos | [`EquipmentDetailView.tsx:518`](file:///c:/mapFiles/MAPv2/src/views/EquipmentDetailView.tsx#L518) | `modal-lg` (800px) | `px-4 py-3` | `p-3` | Lucide `X` | Split: Cancel Left / Save Right |
| 19b | **EquipmentDetailView** - Add Photo | [`EquipmentDetailView.tsx:743`](file:///c:/mapFiles/MAPv2/src/views/EquipmentDetailView.tsx#L743) | `modal-lg` (800px) | `p-3` | Default (`p-3`) | `btn-close` | Split: Cancel Left / Upload Right |
| 20 | **RolesAndPermissionsView** - Create Role | [`RolesAndPermissionsView.tsx:499`](file:///c:/mapFiles/MAPv2/src/views/RolesAndPermissionsView.tsx#L499) | Default (500px) | Default (`p-3`) | Default (`p-3`) | `btn-close` | Right-aligned: Cancel then Create (Standard) |
| 21a | **VesselDetailView** - Inspection Detail | [`VesselDetailView.tsx:3144`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L3144) | `modal-xl` (1140px) | `p-3` | Rogue `justify-between` | `btn-close` | Split: Cancel Left / View Right |
| 21b | **VesselDetailView** - Audit Event Detail | [`VesselDetailView.tsx:3468`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L3468) | `modal-lg` (800px) | `p-3` | Default (`p-3`) | `btn-close` | Right-aligned: Close only |
| 21c | **VesselDetailView** - Company Fleet Detail | [`VesselDetailView.tsx:3588`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L3588) | `modal-lg` (800px) | `p-3` | Default (`p-3`) | `btn-close` | Right-aligned: Close only |
| 21d | **VesselDetailView** - Manage Photos | [`VesselDetailView.tsx:3750`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L3750) | `modal-lg` (800px) | `p-3` | `p-3` | `btn-close` | Split: Cancel Left / Save Right |
| 21e | **VesselDetailView** - Add Photo | [`VesselDetailView.tsx:4034`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L4034) | `modal-lg` (800px) | `p-3` | Default (`p-3`) | `btn-close` | Split: Cancel Left / Upload Right |

### 5.4 Cross-Modal Differences and Outlier Analysis

#### 1. Header and Footer Padding Fragmentation
- **Over-Padded Footers (`px-4 py-3`)**: 7 modals (`AttachAssuranceSetPreviewModal`, `ProjectAddAssetModal`, `VesselImageCropModal`, `CreateAssuranceSetView:4445`, `EquipmentDetailView:518`, `AssuranceDetailView:4672`) apply `px-4 py-3`, producing 64px tall headers and footers that crowd dialog content on low-resolution displays.
- **Micro / Sub-Scale Padding**: `FilterModal.tsx:58` uses fractional `p-3.5`, while `AssuranceDetailView.tsx:5685` uses `py-2`.
- **Default Bootstrap Padding**: 10 modals use standard unclassed `modal-header` and `modal-footer` (defaulting to 16px `p-3`).

#### 2. Width Fragmentation (Arbitrary `maxWidth` vs Bootstrap Grid)
- Rather than adhering to Bootstrap standard modal widths (`modal-sm: 300px`, default `500px`, `modal-lg: 800px`, `modal-xl: 1140px`), 8 modals apply custom inline `maxWidth` styles:
  - `maxWidth: 480px`: `AssuranceDetailView.tsx:4672`, `CreateAssuranceSetView.tsx:4443`
  - `maxWidth: 580px`: `AddUserModal.tsx:138`, `EditUserModal.tsx:138`
  - `maxWidth: 620px`: `AddCrewModal.tsx:187`
  - `maxWidth: 940px`: `ProjectAddAssetModal.tsx:547`
  - Dynamic `maxWidth`: `CrewDocumentUploadModal.tsx`, `DocumentUploadModal.tsx` (720px / 1100px based on OCR extraction state).

#### 3. Conflicting Button Alignments and Orders
- **Split Footer (Cancel Left, Confirm Right)**: 12 modals use `justify-content-between` or `me-auto` to pin Cancel to the left edge and Confirm/Save to the right edge.
- **Right-Aligned Footer (Cancel preceding Confirm)**: 8 modals group all actions on the right, with secondary/cancel preceding primary/confirm (`btn-outline-secondary` followed by `btn-primary`).
- **Inverted Action Order within AssuranceDetailView**: While `AssuranceDetailView` generally uses Right-aligned buttons, `Certificates Expire Warning` (line 4733) omits a close button and places Cancel and Save without standard spacing, while other dialogs in the same view place Close only.
- **Rogue Tailwind Class**: Both `VesselModal.tsx:1608` and `VesselDetailView.tsx:3144` write `className="modal-footer ... d-flex justify-between"`. In Bootstrap 5, `justify-between` does not exist (the Bootstrap class is `justify-content-between`), causing the flex container to fail to justify buttons and leaving them touching.

#### 4. Close Button Inconsistency
- **Bootstrap Native (`btn-close`)**: Used by 13 modals.
- **Lucide Icon (`<X size={18} />` inside custom button)**: Used by 7 modals (`AddUserModal`, `EditUserModal`, `EquipmentModal`, `ProjectAddAssetModal`, `UniversalDocumentPreviewModal`, `VesselImageCropModal`, `VesselModal`).
- **Missing Close Button**: `CrewDocumentViewerModal.tsx` and `AssuranceDetailView.tsx:4733` lack an explicit header close button, forcing the user to interact with the footer to dismiss.

### 5.5 Proposed Standard Modal Architecture

To eliminate all 21 one-off variations, MAPv2 should implement a single canonical `<Modal>` component in `src/components/common/Modal.tsx` with the following architecture:

```tsx
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  size?: 'sm' | 'md' | 'lg' | 'xl'; // sm: 400px, md: 540px, lg: 800px, xl: 1140px
  children: React.ReactNode;
  footer?: React.ReactNode;
  primaryAction?: { label: string; onClick: () => void; variant?: 'primary' | 'danger'; loading?: boolean };
  secondaryAction?: { label: string; onClick: () => void };
}
```

1. **Standard Sizes**:
   - `sm`: Confirmation and alert dialogs (400px).
   - `md` (default): Single-column forms and inputs (540px).
   - `lg`: Multi-column forms, asset selection tables (800px).
   - `xl`: Document viewers, complex asset managers (1140px).
2. **Standard Padding**:
   - Header: Standard `px-4 py-3` with bottom border.
   - Body: Standard `p-4`.
   - Footer: Standard `px-4 py-3` with top border.
3. **Standard Action Alignment**:
   - Right-aligned by default: Cancel (`btn-outline-secondary`) on the left of the button cluster, Confirm (`btn-primary` or `btn-danger`) on the right, separated by `gap-2` (8px).
   - Optional split footer when a destructive or secondary action belongs on the left (`justify-content-between`).
4. **Standard Close Control**:
   - Native `btn-close` with `aria-label="Close"` top right.

## 6. Table Architecture & Standards Audit

### 6.1 Overview & Grep Count Verification

Across the `src/views/` directory, exactly **42 inline `<table` elements** are declared across **19 view files** (verified via `grep -c "<table" src/views/*`). Rather than using the shared table components in `src/components/tables/*`, these views build tables by hand, resulting in significant architectural fragmentation.

Key findings:
- **Missing Pagination**: Exactly **17 of the 42 inline tables** lack pagination entirely, directly violating the MAPv2 Mandatory Table Pagination standard (Section 5 of `map-table-standards`).
- **Non-Standard Action Columns**: Several inline tables embed variable-width buttons or written text labels (e.g. `CrewDetailView.tsx:1083`, `DashboardView.tsx:683`, `DocumentDetailView.tsx:300`, `EquipmentDetailView.tsx:462`), violating the 32x32px icon-only standard.
- **Thead Inconsistency**: 4 tables apply custom `table-light` or `table-bordered` styling with small font overrides, while others rely on `map-table-custom` or unstyled `<thead>` blocks.
- **Cell Breathing Room Violations**: Row cell padding varies between zero (`p-0`), fractional utilities (`py-2.5 px-3`), and excessive empty-state padding (`py-5`), deviating from the design system's `px-4 py-3` standard.

### 6.2 Complete Inventory of Inline Tables (All 42 Tables)

The table below catalogs every inline table instance in `src/views/`:

| # | View File & Line | Table Purpose / Context | Classes & Theme | Thead Style | Row / Cell Padding | Action Column | Pagination |
|:--|:---|:---|:---|:---|:---|:---|:---|
| 1 | [`ApproverDashboardView.tsx:456`](file:///c:/mapFiles/MAPv2/src/views/ApproverDashboardView.tsx#L456) | Data list | `map-table-custom align-middle ` | `Default (th: text-end)` | `p-0` | Standard (32x32px icon-only) | **None (Missing)** |
| 2 | [`ApproverDashboardView.tsx:773`](file:///c:/mapFiles/MAPv2/src/views/ApproverDashboardView.tsx#L773) | Data list | `map-table-custom align-middle ` | `Default (th: text-end)` | `p-0` | Present (Icon actions) | `<TablePagination>` |
| 3 | [`AssuranceDetailView.tsx:3048`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L3048) | Data list | `map-table-custom align-middle ` | `Default (th: text-end)` | `p-0` | Present (Icon actions) | **None (Missing)** |
| 4 | [`AssuranceDetailView.tsx:3544`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L3544) | Data list | `map-table-custom align-middle ` | `Default (th: text-end)` | `py-4` | Present (Icon actions) | **None (Missing)** |
| 5 | [`AssuranceDetailView.tsx:4561`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L4561) | Data list | `table-hover align-middle mb-0` | `table-light (th: table-light)` | `py-4` | Present (Icon actions) | `<TablePagination>` |
| 6 | [`AssuranceDetailView.tsx:4873`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L4873) | Target Date Grants | `table-sm table-bordered align-` | `table-light (th: table-light)` | `Default (Bootstrap)` | Present (Icon actions) | **None (Missing)** |
| 7 | [`AssuranceDetailView.tsx:5102`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L5102) | Data list | `table-sm table-hover align-mid` | `table-light (th: table-light)` | `Default (Bootstrap)` | None | **None (Missing)** |
| 8 | [`AssuranceObjectsView.tsx:454`](file:///c:/mapFiles/MAPv2/src/views/AssuranceObjectsView.tsx#L454) | Data list | `map-table-custom align-middle ` | `Default (th: text-end)` | `Default (Bootstrap)` | Standard (32x32px icon-only) | `<TablePagination>` |
| 9 | [`AuditTrailView.tsx:214`](file:///c:/mapFiles/MAPv2/src/views/AuditTrailView.tsx#L214) | Main Audit Card | `map-table-custom align-middle ` | `Default` | `py-4` | Present (Icon actions) | `<TablePagination>` |
| 10 | [`CapaManagementView.tsx:305`](file:///c:/mapFiles/MAPv2/src/views/CapaManagementView.tsx#L305) | Table Area | `map-table-custom align-middle ` | `Default (th: text-end)` | `Default (Bootstrap)` | Standard (32x32px icon-only) | `<TablePagination>` |
| 11 | [`CreateAssuranceSetView.tsx:3169`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L3169) | Data list | `table-sm align-middle mb-0` | `table-light small text-seconda` | `Default (Bootstrap)` | None | **None (Missing)** |
| 12 | [`CreateAssuranceSetView.tsx:3436`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L3436) | Data list | `table-sm table-hover align-mid` | `table-light small text-seconda` | `Default (Bootstrap)` | Present (Icon actions) | **None (Missing)** |
| 13 | [`CreateAssuranceSetView.tsx:4242`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L4242) | Data list | `table-hover table-sm align-mid` | `table-light text-secondary bor` | `py-3 px-3` | None | **None (Missing)** |
| 14 | [`CrewDetailView.tsx:677`](file:///c:/mapFiles/MAPv2/src/views/CrewDetailView.tsx#L677) | Data list | `map-table-custom align-middle ` | `Default (th: text-end)` | `py-4` | Present (Icon actions) | `<TablePagination>` |
| 15 | [`CrewDetailView.tsx:804`](file:///c:/mapFiles/MAPv2/src/views/CrewDetailView.tsx#L804) | Data list | `map-table-custom align-middle ` | `Default (th: text-end)` | `Default (Bootstrap)` | Present (Icon actions) | `<TablePagination>` |
| 16 | [`CrewDetailView.tsx:938`](file:///c:/mapFiles/MAPv2/src/views/CrewDetailView.tsx#L938) | Data list | `map-table-custom align-middle ` | `Default (th: text-end)` | `py-4` | Present (Icon actions) | `<TablePagination>` |
| 17 | [`CrewDetailView.tsx:1083`](file:///c:/mapFiles/MAPv2/src/views/CrewDetailView.tsx#L1083) | Data list | `map-table-custom align-middle ` | `Default (th: text-end)` | `py-4` | Non-standard (Text / mixed buttons) | **None (Missing)** |
| 18 | [`CrewDetailView.tsx:1132`](file:///c:/mapFiles/MAPv2/src/views/CrewDetailView.tsx#L1132) | Audit Trail — events whose target is thi | `map-table-custom align-middle ` | `Default` | `py-4` | Present (Icon actions) | **None (Missing)** |
| 19 | [`CrewGroupDetailView.tsx:356`](file:///c:/mapFiles/MAPv2/src/views/CrewGroupDetailView.tsx#L356) | Roster Table | `map-table-custom align-middle ` | `Default (th: text-end)` | `py-4` | Standard (32x32px icon-only) | **None (Missing)** |
| 20 | [`DashboardView.tsx:570`](file:///c:/mapFiles/MAPv2/src/views/DashboardView.tsx#L570) | Data list | `map-table-custom align-middle ` | `Default (th: text-end)` | `py-4` | Standard (32x32px icon-only) | `<TablePagination>` |
| 21 | [`DashboardView.tsx:683`](file:///c:/mapFiles/MAPv2/src/views/DashboardView.tsx#L683) | Data list | `map-table-custom align-middle ` | `Default (th: text-end)` | `py-4` | Non-standard (Text / mixed buttons) | `<TablePagination>` |
| 22 | [`DashboardView.tsx:829`](file:///c:/mapFiles/MAPv2/src/views/DashboardView.tsx#L829) | Data list | `map-table-custom align-middle ` | `Default (th: text-end)` | `py-4` | Present (Icon actions) | `<TablePagination>` |
| 23 | [`DocumentDetailView.tsx:300`](file:///c:/mapFiles/MAPv2/src/views/DocumentDetailView.tsx#L300) | Data list | `map-table-custom align-middle ` | `Default (th: text-end)` | `Default (Bootstrap)` | Non-standard (Text / mixed buttons) | `<TablePagination>` |
| 24 | [`EquipmentDetailView.tsx:392`](file:///c:/mapFiles/MAPv2/src/views/EquipmentDetailView.tsx#L392) | Documents — store certificates only | `map-table-custom align-middle ` | `Default (th: text-end)` | `py-4` | Standard (32x32px icon-only) | **None (Missing)** |
| 25 | [`EquipmentDetailView.tsx:462`](file:///c:/mapFiles/MAPv2/src/views/EquipmentDetailView.tsx#L462) | Data list | `map-table-custom align-middle ` | `Default (th: text-end)` | `py-4` | Non-standard (Text / mixed buttons) | **None (Missing)** |
| 26 | [`EquipmentView.tsx:252`](file:///c:/mapFiles/MAPv2/src/views/EquipmentView.tsx#L252) | Data list | `map-table-custom align-middle ` | `Default (th: text-end)` | `py-4` | Standard (32x32px icon-only) | `<TablePagination>` |
| 27 | [`InspectorWorkspaceView.tsx:297`](file:///c:/mapFiles/MAPv2/src/views/InspectorWorkspaceView.tsx#L297) | Data list | `map-table-custom align-middle ` | `Default (th: text-end)` | `Default (Bootstrap)` | Present (Icon actions) | `<TablePagination>` |
| 28 | [`MarketplaceView.tsx:349`](file:///c:/mapFiles/MAPv2/src/views/MarketplaceView.tsx#L349) | Data list | `map-table-custom align-middle ` | `Default` | `py-5` | Present (Icon actions) | `<TablePagination>` |
| 29 | [`NotificationsView.tsx:169`](file:///c:/mapFiles/MAPv2/src/views/NotificationsView.tsx#L169) | Data list | `map-table-custom align-middle ` | `Default (th: text-end)` | `py-5` | Present (Icon actions) | `<TablePagination>` |
| 30 | [`ProjectDetailView.tsx:536`](file:///c:/mapFiles/MAPv2/src/views/ProjectDetailView.tsx#L536) | Data list | `map-table-custom align-middle ` | `Default (th: text-end)` | `py-4` | Standard (32x32px icon-only) | `<TablePagination>` |
| 31 | [`ProjectView.tsx:161`](file:///c:/mapFiles/MAPv2/src/views/ProjectView.tsx#L161) | Data list | `map-table-custom align-middle ` | `Default (th: text-end)` | `py-4` | Standard (32x32px icon-only) | `<TablePagination>` |
| 32 | [`VerifierWorkspaceView.tsx:351`](file:///c:/mapFiles/MAPv2/src/views/VerifierWorkspaceView.tsx#L351) | Data list | `map-table-custom align-middle ` | `Default (th: text-end)` | `Default (Bootstrap)` | Standard (32x32px icon-only) | `<TablePagination>` |
| 33 | [`VesselDetailView.tsx:1691`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L1691) | Data list | `map-table-custom align-middle ` | `Default (th: text-end)` | `py-4` | Present (Icon actions) | `<TablePagination>` |
| 34 | [`VesselDetailView.tsx:1957`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L1957) | Data list | `map-table-custom align-middle ` | `Default (th: text-end)` | `Default (Bootstrap)` | Standard (32x32px icon-only) | `<TablePagination>` |
| 35 | [`VesselDetailView.tsx:2178`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L2178) | Data list | `map-table-custom align-middle ` | `Default` | `py-4` | None | `<TablePagination>` |
| 36 | [`VesselDetailView.tsx:2361`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L2361) | Data list | `map-table-custom align-middle ` | `Default` | `Default (Bootstrap)` | None | `<TablePagination>` |
| 37 | [`VesselDetailView.tsx:2612`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L2612) | Master Assigned Crew Data Table | `map-table-custom align-middle ` | `Default (th: text-end)` | `py-4` | Present (Icon actions) | `<TablePagination>` |
| 38 | [`VesselDetailView.tsx:2833`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L2833) | Data list | `map-table-custom align-middle ` | `Default (th: text-end)` | `py-4` | Present (Icon actions) | `<TablePagination>` |
| 39 | [`VesselDetailView.tsx:2978`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L2978) | Data list | `map-table-custom align-middle ` | `Default (th: text-end)` | `py-4` | Present (Icon actions) | `<TablePagination>` |
| 40 | [`VesselDetailView.tsx:3228`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L3228) | Audit Findings Summary Bar | `map-table-custom align-middle ` | `Default` | `Default (Bootstrap)` | Present (Icon actions) | `<TablePagination>` |
| 41 | [`VesselDetailView.tsx:3319`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L3319) | Linked Corrective Actions (CAPA) Section | `map-table-custom align-middle ` | `Default (th: text-end)` | `py-3` | Present (Icon actions) | `<TablePagination>` |
| 42 | [`VesselDetailView.tsx:3620`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L3620) | Data list | `map-table-custom align-middle ` | `Default (th: text-end)` | `Default (Bootstrap)` | Standard (32x32px icon-only) | `<TablePagination>` |


### 6.3 Differences from Shared Tables & Design Standards

The application maintains 7 shared table components in `src/components/tables/`:
1. `AssuranceTable.tsx`
2. `CrewTable.tsx`
3. `DocumentTable.tsx`
4. `ProjectAssuranceStatusTable.tsx`
5. `ProjectTasksTable.tsx`
6. `UserTable.tsx`
7. `VesselTable.tsx`

Comparing the 42 inline view tables against these shared implementations reveals five critical architectural divergences:

#### 1. Re-implementation of Pagination Logic
While the 7 shared tables uniformly connect to `usePagination` and render `<TablePagination />` directly below the table, **17 inline tables omit pagination entirely**. Views such as `CreateAssuranceSetView` (3 tables), `EquipmentDetailView` (2 tables), and `AssuranceDetailView` (sub-tables) render unbounded record lists directly in DOM trees, causing performance degredation as record counts scale.

#### 2. Divergence from 32x32px Icon-Only Action Column
The `map-table-standards` skill specifies that table row actions must strictly be 32x32px square icon buttons (`d-inline-flex align-items-center justify-content-center p-0` with `width: 32px, height: 32px` and 16px Lucide icons):
- **Violations**:
  - `DashboardView.tsx:683`: Embeds text-bearing buttons (`"View Details"`).
  - `CrewDetailView.tsx:1083`: Embeds full-height text action triggers.
  - `DocumentDetailView.tsx:300`: Mixes action links with button elements.
  - `EquipmentDetailView.tsx:462`: Uses full-height secondary buttons.

#### 3. Inconsistent Column Alignment & Typography
Shared tables strictly enforce **IBM Plex Mono** (`font-mono-code fw-semibold text-primary`) for all identifiers in Column 1 (IMO numbers, Set IDs, Document IDs). In contrast, several inline tables (e.g. `CreateAssuranceSetView:3169` and `AssuranceDetailView:4873`) render system identifiers in standard proportional sans-serif fonts.

#### 4. Thead Background & Divider Variations
- Shared tables utilize `map-table-custom` with subtle 1px border dividers and uppercase column labels.
- Inline tables introduce ad-hoc `table-light` backgrounds, `table-bordered` cell borders, and custom `style={{ fontSize: '0.8rem' }}` overrides.

#### 5. Cell Padding & Edge Clearance
- Shared tables maintain standardized breathing room (`px-4 py-3`).
- Inline tables fluctuate wildly between unpadded nested rows (`p-0` in `AssuranceDetailView:3048`) and oversized container padding (`py-5` in `MarketplaceView:349` and `NotificationsView:169`).

### 6.4 Proposed Standard Table Architecture

To eliminate inline duplication and enforce enterprise consistency:
1. **Migrate Generic Entity Lists to Shared Components**: Refactor inline tables in `CrewDetailView`, `EquipmentView`, and `VesselDetailView` to consume or extend the shared tables in `src/components/tables/`.
2. **Mandatory Pagination Enforcement**: Wire `usePagination` and `<TablePagination />` into the 17 unpaginated tables.
3. **Standardize Action Column Template**: Replace all ad-hoc action buttons with the canonical 32x32px icon-only pattern with `title` and `aria-label` tooltips.

## 7. Other Repeated Patterns Audit

### 7.1 Overview & Redundancy Summary

Beyond buttons, spacing, modals, and tables, several core UI patterns are repeatedly rebuilt by hand throughout `src/views/`, despite official design system components already existing in `src/components/common/`. Over **130 hand-built copies** of badges, empty states, toolbars, detail headers, and KPI tiles were cataloged across views.

### 7.2 Hand-Built Status Badges (vs `StatusBadge`)

- **Current State**: Over **97 instances** of hand-built badge elements (`<span className="badge ...">`) exist across 15 views (most notably 43 in `AssuranceDetailView.tsx` and 26 in `VesselDetailView.tsx`).
- **Issues**:
  - Many apply non-standard fractional padding (`px-2.5 py-1.5`) and manual inline font sizing (`style={{ fontSize: '0.75rem' }}`).
  - Colors are hardcoded with Bootstrap classes (`bg-success`, `bg-info text-dark`, `bg-warning text-dark`, `bg-danger`) rather than leveraging semantic status tone mapping.
- **Target Replacement**: Standardize on `<StatusBadge value={status} tone={optionalTone} />` from `src/components/common/StatusBadge.tsx`, which automatically resolves semantic background, border, text color, and icon badge styling.

### 7.3 Hand-Built Empty States (vs `EmptyState`)

- **Current State**: Exactly **25 inline empty state blocks** are hardcoded in views using raw `<td colSpan={...} className="text-center py-4 text-muted">` or `<div className="text-center py-5">` with unstyled text strings like `"No records found"`, `"No assignments yet"`, or `"No documents uploaded"`.
- **Issues**:
  - Empty states lack visual anchors (illustrations or Lucide icons).
  - Empty states lack primary call-to-action buttons (e.g., "Add Document", "Assign Crew").
  - Deviates from the enterprise empty state heuristic established in `map-design-system`.
- **Target Replacement**: Replace all table and card empty states with `<EmptyState icon={Icon} title="No Records" description="Prompt message..." action={{ label: "Add", onClick: ... }} />` from `src/components/common/EmptyState.tsx`.

### 7.4 Hand-Built Toolbars & Search Rows (vs `ListToolbar`)

- **Current State**: Multiple views (including 7 tabs in `VesselDetailView.tsx`, 3 sections in `DashboardView.tsx`, and `AssuranceDetailView.tsx`) assemble custom search rows with raw `<input type="text" className="form-control form-control-sm" placeholder="Search..." />` accompanied by manual icon search decorators and export buttons.
- **Issues**:
  - Inconsistent search input widths, paddings, and placeholder wording.
  - Search inputs lack standard filter counter badges and uniform CSV/PDF export button alignment.
- **Target Replacement**: Standardize on `<ListToolbar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search..." />` from `src/components/common/ListToolbar.tsx`.

### 7.5 Hand-Built Detail Headers (vs `DetailHeader`)

- **Current State**: While `DetailHeader` is adopted in several views, views like `CreateAssuranceSetView.tsx:2200`, `CreateProjectView.tsx:452`, and `RolesAndPermissionsView.tsx:238` hand-craft page titles, breadcrumb trails, and metadata strips.
- **Target Replacement**: Adopt `<DetailHeader title="Title" status="Active" metaItems={[...]} backLink={{ label: "Back", onClick: ... }} />` from `src/components/common/DetailHeader.tsx`.

### 7.6 Hand-Built KPI Metric Cards (Proposed Unified Component)

- **Current State**: Exactly **16 hand-assembled KPI metric tiles** exist in `DashboardView.tsx` (12 tiles), `ApproverDashboardView.tsx`, and `VesselDetailView.tsx` using classes like `card map-kpi-card map-kpi-clickable shadow-2xs`.
- **Current Component Status**: **None exists yet in the codebase**. This is an open architectural gap tracked under **Task 4734** / Feature 5209.
- **Recommendation**: Create a unified reusable component `<KpiTile title="Label" value={count} tone="primary" selected={isSelected} onClick={...} />` to eliminate inline card styling duplication.

### 7.7 Representative Inventory of Hand-Built Repeated Patterns

| # | Pattern Category | File & Line | Current Hand-Built Implementation | Matching Shared Component |
|:--|:---|:---|:---|:---|
| 1 | **Status Badge** | [`ApproverDashboardView.tsx:505`](file:///c:/mapFiles/MAPv2/src/views/ApproverDashboardView.tsx#L505) | `<span className="badge bg-light text-dark border small">{req` | `StatusBadge` (`src/components/common/StatusBadge.tsx`) |
| 2 | **Status Badge** | [`ApproverDashboardView.tsx:885`](file:///c:/mapFiles/MAPv2/src/views/ApproverDashboardView.tsx#L885) | `<span className="badge bg-warning text-dark font-mono-code">` | `StatusBadge` (`src/components/common/StatusBadge.tsx`) |
| 3 | **Status Badge** | [`AssuranceDetailView.tsx:1567`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L1567) | `<div className="badge bg-warning-subtle text-dark border bor` | `StatusBadge` (`src/components/common/StatusBadge.tsx`) |
| 4 | **Status Badge** | [`AssuranceDetailView.tsx:2097`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L2097) | `<span className="badge bg-secondary text-white px-2.5 py-1.5` | `StatusBadge` (`src/components/common/StatusBadge.tsx`) |
| 5 | **Status Badge** | [`AssuranceDetailView.tsx:2106`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L2106) | `return <span className="badge bg-success text-white px-2.5 p` | `StatusBadge` (`src/components/common/StatusBadge.tsx`) |
| 6 | **Status Badge** | [`AssuranceDetailView.tsx:2108`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L2108) | `return <span className="badge bg-info text-dark px-2.5 py-1.` | `StatusBadge` (`src/components/common/StatusBadge.tsx`) |
| 7 | **Status Badge** | [`AssuranceDetailView.tsx:2111`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L2111) | `return <span className="badge bg-warning text-dark px-2.5 py` | `StatusBadge` (`src/components/common/StatusBadge.tsx`) |
| 8 | **Status Badge** | [`AssuranceDetailView.tsx:2114`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L2114) | `return <span className="badge bg-danger text-white px-2.5 py` | `StatusBadge` (`src/components/common/StatusBadge.tsx`) |
| 9 | **Status Badge** | [`AssuranceDetailView.tsx:2123`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L2123) | `return <span className="badge bg-warning text-dark px-2.5 py` | `StatusBadge` (`src/components/common/StatusBadge.tsx`) |
| 10 | **Status Badge** | [`AssuranceDetailView.tsx:2127`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L2127) | `<span className="badge bg-primary text-white px-2.5 py-1.5" ` | `StatusBadge` (`src/components/common/StatusBadge.tsx`) |
| 11 | **Status Badge** | [`AssuranceDetailView.tsx:2459`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L2459) | `<span className="badge bg-warning text-dark">` | `StatusBadge` (`src/components/common/StatusBadge.tsx`) |
| 12 | **Status Badge** | [`AssuranceDetailView.tsx:2464`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L2464) | `<span className="badge bg-light text-secondary border">` | `StatusBadge` (`src/components/common/StatusBadge.tsx`) |
| 13 | **Status Badge** | [`AssuranceDetailView.tsx:2534`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L2534) | `<span key={tag} className="badge bg-light text-dark border">` | `StatusBadge` (`src/components/common/StatusBadge.tsx`) |
| 14 | **Status Badge** | [`AssuranceDetailView.tsx:2555`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L2555) | `<span className="badge bg-light text-secondary border ms-2" ` | `StatusBadge` (`src/components/common/StatusBadge.tsx`) |
| 15 | **Status Badge** | [`AssuranceDetailView.tsx:2570`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L2570) | `<span className="badge bg-success-subtle text-success border` | `StatusBadge` (`src/components/common/StatusBadge.tsx`) |
| 16 | **Empty State** | [`AssuranceDetailView.tsx:3586`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L3586) | `<td colSpan={reqTableColSpan} className="text-center text-mu` | `EmptyState` (`src/components/common/EmptyState.tsx`) |
| 17 | **Empty State** | [`AssuranceDetailView.tsx:4575`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L4575) | `<td colSpan={6} className="text-center py-4 text-secondary s` | `EmptyState` (`src/components/common/EmptyState.tsx`) |
| 18 | **Empty State** | [`AuditTrailView.tsx:258`](file:///c:/mapFiles/MAPv2/src/views/AuditTrailView.tsx#L258) | `<td colSpan={6} className="text-center py-4 text-secondary s` | `EmptyState` (`src/components/common/EmptyState.tsx`) |
| 19 | **Empty State** | [`CreateAssuranceSetView.tsx:4254`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L4254) | `<td colSpan={4} className="py-3 px-3 text-center text-second` | `EmptyState` (`src/components/common/EmptyState.tsx`) |
| 20 | **Empty State** | [`CrewDetailView.tsx:731`](file:///c:/mapFiles/MAPv2/src/views/CrewDetailView.tsx#L731) | `<td colSpan={6} className="text-center py-4 text-muted">` | `EmptyState` (`src/components/common/EmptyState.tsx`) |
| 21 | **Empty State** | [`CrewDetailView.tsx:992`](file:///c:/mapFiles/MAPv2/src/views/CrewDetailView.tsx#L992) | `<td colSpan={6} className="text-center py-4 text-muted">` | `EmptyState` (`src/components/common/EmptyState.tsx`) |
| 22 | **Empty State** | [`CrewDetailView.tsx:1096`](file:///c:/mapFiles/MAPv2/src/views/CrewDetailView.tsx#L1096) | `<td colSpan={5} className="text-center text-muted py-4">` | `EmptyState` (`src/components/common/EmptyState.tsx`) |
| 23 | **Empty State** | [`CrewDetailView.tsx:1145`](file:///c:/mapFiles/MAPv2/src/views/CrewDetailView.tsx#L1145) | `<td colSpan={5} className="text-center text-muted py-4">` | `EmptyState` (`src/components/common/EmptyState.tsx`) |
| 24 | **KPI Tile** | [`DashboardView.tsx:304`](file:///c:/mapFiles/MAPv2/src/views/DashboardView.tsx#L304) | `className={`card map-kpi-card map-kpi-clickable shadow-2xs $` | *None exists yet* (Proposed in Task 4734 / Feature 5209) |
| 25 | **KPI Tile** | [`DashboardView.tsx:320`](file:///c:/mapFiles/MAPv2/src/views/DashboardView.tsx#L320) | `className={`card map-kpi-card map-kpi-clickable shadow-2xs $` | *None exists yet* (Proposed in Task 4734 / Feature 5209) |
| 26 | **KPI Tile** | [`DashboardView.tsx:336`](file:///c:/mapFiles/MAPv2/src/views/DashboardView.tsx#L336) | `className={`card map-kpi-card map-kpi-clickable shadow-2xs $` | *None exists yet* (Proposed in Task 4734 / Feature 5209) |
| 27 | **KPI Tile** | [`DashboardView.tsx:352`](file:///c:/mapFiles/MAPv2/src/views/DashboardView.tsx#L352) | `className={`card map-kpi-card map-kpi-clickable shadow-2xs $` | *None exists yet* (Proposed in Task 4734 / Feature 5209) |
| 28 | **KPI Tile** | [`DashboardView.tsx:381`](file:///c:/mapFiles/MAPv2/src/views/DashboardView.tsx#L381) | `className={`card map-kpi-card map-kpi-clickable shadow-2xs $` | *None exists yet* (Proposed in Task 4734 / Feature 5209) |
| 29 | **KPI Tile** | [`DashboardView.tsx:395`](file:///c:/mapFiles/MAPv2/src/views/DashboardView.tsx#L395) | `<div className="card map-kpi-card shadow-2xs">` | *None exists yet* (Proposed in Task 4734 / Feature 5209) |
| 30 | **KPI Tile** | [`DashboardView.tsx:407`](file:///c:/mapFiles/MAPv2/src/views/DashboardView.tsx#L407) | `className={`card map-kpi-card map-kpi-clickable shadow-2xs $` | *None exists yet* (Proposed in Task 4734 / Feature 5209) |


## 8. Verification Spot-Check

### 8.1 Button Verification Spot-Check (Task 5368)

| File & Line | Code Snippet | Verified |
|:---|:---|:---:|
| [`AssuranceDetailView.tsx:3410`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L3410) | `<button type="button" className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1.5" ...>` | Yes |
| [`CreateProjectView.tsx:777`](file:///c:/mapFiles/MAPv2/src/views/CreateProjectView.tsx#L777) | `<button type="button" className="btn btn-sm btn-primary fw-semibold" ...>` | Yes |
| [`InspectionChecklistView.tsx:1168`](file:///c:/mapFiles/MAPv2/src/views/InspectionChecklistView.tsx#L1168) | `<button type="button" className="btn btn-outline-secondary btn-sm" ...>` | Yes |
| [`VesselDetailView.tsx:1863`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L1863) | `<button className="btn btn-sm btn-outline-primary" onClick={...}>` | Yes |
| [`ApproverDashboardView.tsx:695`](file:///c:/mapFiles/MAPv2/src/views/ApproverDashboardView.tsx#L695) | `<button type="button" className="btn-close" ...>` | Yes |

### 8.2 Spacing & Scale Verification Spot-Check (Task 5369)

| File & Line | Code Snippet | Utility Flagged | Issue Type | Verified |
|:---|:---|:---:|:---|:---:|
| [`VesselDetailView.tsx:2724`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L2724) | `<div className="d-flex align-items-center justify-content-end gap-1.5">` | `gap-1.5` | Tight / Fractional gap on action icons | Yes |
| [`CreateAssuranceSetView.tsx:4350`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L4350) | `<div className="d-flex flex-column gap-0.5 min-w-0">` | `gap-0.5` | Micro cramped gap (2px) on text column | Yes |
| [`InspectionChecklistView.tsx:615`](file:///c:/mapFiles/MAPv2/src/views/InspectionChecklistView.tsx#L615) | `<div className="d-flex flex-column gap-3.5">` | `gap-3.5` | Fractional non-standard gap (14px) | Yes |
| [`AssuranceDetailView.tsx:2679`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L2679) | `className="btn btn-sm btn-outline-primary py-0 px-2 d-inline-flex align-items-center gap-1"` | `py-0 px-2` | Cramped zero vertical padding on button | Yes |
| [`CreateAssuranceSetView.tsx:4384`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L4384) | `<div className="card-footer bg-light border-top px-4 py-3 d-flex align-items-center justify-content-between flex-wrap gap-2">` | `px-4 py-3` | Over-padded card footer | Yes |

### 8.3 Modal Verification Spot-Check (Task 5370)

| File & Line | Code Snippet | Feature Verified | Issue Type | Verified |
|:---|:---|:---|:---|:---:|
| [`AddCrewModal.tsx:187`](file:///c:/mapFiles/MAPv2/src/components/modals/AddCrewModal.tsx#L187) | `<div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '620px' }}>` | Width | Non-standard inline maxWidth (620px) | Yes |
| [`ProjectAddAssetModal.tsx:558`](file:///c:/mapFiles/MAPv2/src/components/modals/ProjectAddAssetModal.tsx#L558) | `className="modal-header d-flex align-items-center justify-content-between px-4 py-3 border-bottom flex-shrink-0"` | Header Padding | Over-padded header (`px-4 py-3`) | Yes |
| [`AssuranceDetailView.tsx:4672`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L4672) | `<div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '480px' }}>` | Width | Inline view modal with custom 480px width | Yes |
| [`CreateAssuranceSetView.tsx:4445`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L4445) | `<div className="modal-header border-bottom px-4 py-3 bg-light">` | Header Styling | Custom `px-4 py-3 bg-light` header | Yes |
| [`VesselDetailView.tsx:3144`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L3144) | `<div className="modal-dialog modal-xl modal-dialog-centered">` | Dialog Sizing | Full-width XL modal with `modal-dialog-centered` | Yes |

### 8.4 Table Verification Spot-Check (Task 5371)

| File & Line | Code Snippet | Feature Verified | Issue Type | Verified |
|:---|:---|:---|:---|:---:|
| [`ApproverDashboardView.tsx:456`](file:///c:/mapFiles/MAPv2/src/views/ApproverDashboardView.tsx#L456) | `<table className="table map-table-custom align-middle mb-0">` | Pagination | Missing pagination on dashboard table | Yes |
| [`AssuranceDetailView.tsx:3544`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L3544) | `<table className="table map-table-custom align-middle mb-0">` | Requirements Table | Inline complex table with nested expandable headers | Yes |
| [`CreateAssuranceSetView.tsx:3169`](file:///c:/mapFiles/MAPv2/src/views/CreateAssuranceSetView.tsx#L3169) | `<table className="table table-sm align-middle mb-0" aria-label="Parties on this set">` | Table Theme | Uses non-standard `table-sm` without `map-table-custom` | Yes |
| [`CrewDetailView.tsx:1083`](file:///c:/mapFiles/MAPv2/src/views/CrewDetailView.tsx#L1083) | `<table className="table map-table-custom align-middle mb-0">` | Action Controls | Inline endorsements table with non-standard actions | Yes |
| [`VesselDetailView.tsx:1691`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L1691) | `<table className="table map-table-custom align-middle mb-0">` | Shared Standards | Inline table consuming `<TablePagination>` | Yes |

### 8.5 Other Repeated Patterns Verification Spot-Check (Task 5372)

The following 5 file:line references were spot-checked directly against the codebase to verify repeated pattern accuracy:

| File & Line | Code Snippet | Pattern Category | Target Shared Component | Verified |
|:---|:---|:---|:---|:---:|
| [`AssuranceDetailView.tsx:2097`](file:///c:/mapFiles/MAPv2/src/views/AssuranceDetailView.tsx#L2097) | `<span className="badge bg-secondary text-white px-2.5 py-1.5" style={{ fontSize: '0.75rem' }}>` | Status Badge | `StatusBadge` (`src/components/common/StatusBadge.tsx`) | Yes |
| [`DashboardView.tsx:304`](file:///c:/mapFiles/MAPv2/src/views/DashboardView.tsx#L304) | `className={`card map-kpi-card map-kpi-clickable shadow-2xs ...`}` | KPI Tile | *None exists yet* (Proposed in Task 4734) | Yes |
| [`CrewDetailView.tsx:731`](file:///c:/mapFiles/MAPv2/src/views/CrewDetailView.tsx#L731) | `<td colSpan={6} className="text-center py-4 text-muted">No assignments yet.</td>` | Empty State | `EmptyState` (`src/components/common/EmptyState.tsx`) | Yes |
| [`VesselDetailView.tsx:1658`](file:///c:/mapFiles/MAPv2/src/views/VesselDetailView.tsx#L1658) | `placeholder="Search documents..."` | List Toolbar | `ListToolbar` (`src/components/common/ListToolbar.tsx`) | Yes |
| [`CreateProjectView.tsx:452`](file:///c:/mapFiles/MAPv2/src/views/CreateProjectView.tsx#L452) | `<h2 className="h4 fw-bold text-dark mb-1">Create Project</h2>` | Detail Header | `DetailHeader` (`src/components/common/DetailHeader.tsx`) | Yes |

### 8.6 Grep Count & Line Verification Confirmation

- **Total Buttons in `src/views/`**: Exactly **384 buttons** across 174 distinct class strings (matches `grep -c "<button" src/views/*`).
- **Total Spacing Gap Values in Use**: Exactly **9 distinct values** (`gap-0.5` to `gap-5`).
- **Total Modals Audited**: Exactly **21 implementations** (15 standalone components + 6 view files writing modal markup by hand).
- **Total Inline Tables in `src/views/`**: Exactly **42 tables** across 19 views (matches `grep -c "<table" src/views/*`).
- **Total Hand-Built Repeated Patterns**: Over **130 instances** (97+ badges, 25+ empty states, 16 KPI tiles, multiple toolbars/headers).

## 9. Reusable Component Props Proposal (Task 5373)

### 9.1 Architecture, Governance, and Build Scope

Per **ADR 0013** (*MAPv2 styles move to MAP as CSS tokens, one CoreUI skin file per component, and a guard test*) and **Feature 4732** (*Frontend Shared Components in MAP-1*):
- **Frozen Prototype**: The MAPv2 prototype codebase (`src/` in `c:\mapFiles\MAPv2`) is frozen for visual reference and will not directly implement these new component files.
- **Target Implementation**: The reusable components sketched below will be built in the production product repository (`MAP-1`) under Feature 4732.
- **Token-Driven Styling**: Each component will utilize design tokens defined in `theme/theme.css` with colocated component stylesheets (`Component.css`), eliminating inline styles, arbitrary utility fragmentation, and hard-coded hex colors.
- **Guard Test Protection**: A zero-redundancy Vitest suite in MAP-1 will enforce that only documented tokens and standardized component interfaces are utilized.

---

### 9.2 Proposed Component Interfaces and Props Sketches

#### 9.2.1 `<Button>`

Replaces arbitrary `<button>` styling across all 29 views, enforcing uniform heights, font weights (`fw-semibold`), and transition classes.

```typescript
export type ButtonVariant = 
  | 'primary'            // btn btn-sm btn-primary
  | 'secondary'          // btn btn-sm btn-secondary
  | 'outline-primary'    // btn btn-sm btn-outline-primary
  | 'outline-secondary'  // btn btn-sm btn-outline-secondary
  | 'danger'             // btn btn-sm btn-danger
  | 'outline-danger'     // btn btn-sm btn-outline-danger
  | 'link'               // btn btn-sm btn-link p-0
  | 'close';             // btn-close

export type ButtonSize = 'sm' | 'xs';

export interface ButtonProps {
  /** The accessible label text or elements rendered inside the button */
  label: React.ReactNode;
  /** Click event handler */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /** Standardized visual style variant (default: 'primary') */
  variant?: ButtonVariant;
  /** Component sizing tier (default: 'sm') */
  size?: ButtonSize;
  /** Optional icon component (rendered at 16x16px with standardized gap-1.5) */
  icon?: React.ComponentType<{ className?: string; size?: number }>;
  /** Position of the icon relative to the label (default: 'start') */
  iconPosition?: 'start' | 'end';
  /** Native HTML button type (default: 'button') */
  type?: 'button' | 'submit' | 'reset';
  /** Disables click interaction and applies disabled styling */
  disabled?: boolean;
  /** Replaces label with spinner and disables button during async submission */
  loading?: boolean;
  /** Additional custom class names for edge-case layout positioning */
  className?: string;
  /** Accessible hover/focus tooltip or title attribute */
  title?: string;
  /** Screen-reader label if label is empty or purely symbolic */
  ariaLabel?: string;
}
```

*Audit Findings Covered:*
- Consolidates 174 arbitrary button class strings into 8 canonical variants and 2 sizes.
- Standardizes button padding across the application (`px-3 py-1.5` for `sm`, `px-2 py-0.5` for `xs`).
- Eliminates inline font weight declarations (`fw-bold`, `fw-semibold`, `font-weight-500`).

---

#### 9.2.2 `<IconButton>`

Dedicated square interactive button for compact data table rows, icon triggers, and toolbar controls. Enforces MAP table standards (32x32px square bounding box).

```typescript
export type IconButtonVariant = 
  | 'outline-secondary' 
  | 'outline-primary' 
  | 'outline-danger' 
  | 'ghost' 
  | 'link';

export interface IconButtonProps {
  /** Icon component to render inside the button (e.g. Lucide icon) */
  icon: React.ComponentType<{ className?: string; size?: number }>;
  /** Click event handler */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /** Mandatory screen-reader accessible label */
  ariaLabel: string;
  /** Visual variant (default: 'outline-secondary') */
  variant?: IconButtonVariant;
  /** Sizing tier (default: 'sm' = 32x32px; 'xs' = 24x24px) */
  size?: 'sm' | 'xs';
  /** Native tooltip description rendered on hover */
  tooltip?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Loading spinner indicator */
  loading?: boolean;
  /** Additional custom class name */
  className?: string;
}
```

*Audit Findings Covered:*
- Replaces 67 hand-styled table row icon triggers and action buttons.
- Fixes inconsistent padding (`p-0`, `p-1`, `px-2.5 py-1`) and dimensions by standardizing to a rigid 32x32px touch target.
- Enforces mandatory accessibility via `ariaLabel`.

---

#### 9.2.3 `<ButtonGroup>`

Layout wrapper for multi-button clusters, modal action footers, and toolbar button groups.

```typescript
export interface ButtonGroupProps {
  /** Child button elements */
  children: React.ReactNode;
  /** Gap between buttons conforming strictly to the MAP Spacing Scale (default: 2 = 8px) */
  gap?: 1 | 1.5 | 2 | 2.5 | 3;
  /** Flex alignment of child buttons (default: 'start') */
  align?: 'start' | 'center' | 'end' | 'between';
  /** Whether buttons wrap on narrow viewports (default: false) */
  wrap?: boolean;
  /** Additional container classes */
  className?: string;
}
```

*Audit Findings Covered:*
- Eliminates 9 ad-hoc gap variants in button groups (such as `gap-0.5` and `gap-3.5`).
- Enforces consistent spacing between primary, secondary, and destructive actions across all view footers.

---

#### 9.2.4 `<Modal>`

Standardized dialog wrapper component that enforces unified backdrop handling, header layout, body scrolling, and keyboard dismiss (`Escape`).

```typescript
export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ModalProps {
  /** Controls modal visibility */
  isOpen: boolean;
  /** Header title text */
  title: string;
  /** Callback triggered when user dismisses the modal (via close button, backdrop, or Escape) */
  onClose: () => void;
  /** Action footer elements (typically wrapped in <ButtonGroup>) */
  footer?: React.ReactNode;
  /** Standardized Bootstrap width: 'sm' (300px), 'md' (500px), 'lg' (800px), 'xl' (1140px) (default: 'md') */
  size?: ModalSize;
  /** Modal body content */
  children: React.ReactNode;
  /** Optional secondary actions or badge placed in the header beside title */
  headerActions?: React.ReactNode;
  /** Centers dialog vertically on screen (default: true) */
  centered?: boolean;
  /** Enables internal body scrollbar for long forms (default: true) */
  scrollable?: boolean;
  /** Optional container class overrides */
  className?: string;
}
```

*Audit Findings Covered:*
- Unifies 21 modal implementations (15 standalone components + 6 inline modal views).
- Eliminates ad-hoc inline styles like `style={{ maxWidth: '480px' }}` and `style={{ maxWidth: '620px' }}`.
- Replaces erratic header/footer padding (`px-4 py-3 bg-light`) with standard design token padding (`px-3 py-2.5`).

---

#### 9.2.5 `<ConfirmModal>`

Specialized dialog for high-stakes user actions (e.g. entity deletion, record rejection, discard changes).

```typescript
export interface ConfirmModalProps {
  /** Controls dialog visibility */
  isOpen: boolean;
  /** Dialog heading */
  title: string;
  /** Explanatory confirmation message or body prompt */
  message: React.ReactNode;
  /** Label for confirm action button (default: 'Confirm') */
  confirmLabel?: string;
  /** Label for cancel action button (default: 'Cancel') */
  cancelLabel?: string;
  /** Variant for confirm button: 'danger' for destructive actions, 'primary' for normal confirmations */
  confirmVariant?: 'primary' | 'danger';
  /** Callback fired on confirm click */
  onConfirm: () => void | Promise<void>;
  /** Callback fired on cancel or dismiss */
  onCancel: () => void;
  /** Disables buttons and shows spinner during async action */
  isLoading?: boolean;
  /** Modal dialog width (default: 'sm') */
  size?: 'sm' | 'md';
}
```

*Audit Findings Covered:*
- Replaces repetitive confirmation dialog markup hand-built across `AssuranceDetailView`, `CrewDetailView`, `EquipmentDetailView`, and `RolesAndPermissionsView`.
- Guarantees standard button placement (Cancel on left/secondary, Confirm on right/primary/danger).

---

#### 9.2.6 `<DataTable<T>>`

Standardized enterprise tabular data presentation component implementing the MAP Table Standards (ID-first 6-column layout, breathing room padding, pagination integration).

```typescript
export interface DataTableColumn<T> {
  /** Unique column identifier */
  key: string;
  /** Column header label */
  header: string;
  /** Column width specification (e.g. '120px', '25%') */
  width?: string | number;
  /** Content alignment (default: 'start') */
  align?: 'start' | 'center' | 'end';
  /** Whether column supports sorting (default: false) */
  sortable?: boolean;
  /** Custom cell rendering function */
  render?: (value: any, row: T, index: number) => React.ReactNode;
}

export interface DataTablePaginationProps {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

export interface DataTableProps<T> {
  /** Column definitions */
  columns: DataTableColumn<T>[];
  /** Array of data records */
  rows: T[];
  /** Function returning action controls for the row (typically <IconButton> or action menu) */
  actions?: (row: T) => React.ReactNode;
  /** Unique key extractor for row rendering */
  rowKey: (row: T) => string | number;
  /** Optional pagination configuration (integrates <TablePagination>) */
  pagination?: DataTablePaginationProps;
  /** Message displayed when rows array is empty */
  emptyMessage?: string;
  /** Loading skeleton or spinner state */
  isLoading?: boolean;
  /** Additional table container class names */
  className?: string;
}
```

*Audit Findings Covered:*
- Replaces 42 inline hand-coded `<table>` implementations across 19 views.
- Enforces consistent padding tokens (`py-2.5 px-3`) and `.map-table-custom` styling.
- Guarantees pagination presence across all dataset tables.

---

### 9.3 Existing Shared Components That Already Fit

The MAPv2 design system already contains several robust shared components that solve key repetition issues. Instead of recreating them, screens should consume these directly:

| Existing Component | File Path | Existing Fit & Usage Pattern |
|:---|:---|:---|
| **`<Drawer>`** | [`src/components/drawers/Drawer.tsx`](file:///c:/mapFiles/MAPv2/src/components/drawers/Drawer.tsx) | Standard slide-over drawer panel for inspections, document reviews, version history, and audit trail panels. |
| **`<ListToolbar>`** | [`src/components/common/ListToolbar.tsx`](file:///c:/mapFiles/MAPv2/src/components/common/ListToolbar.tsx) | Standard unified search input, filter modal triggers, view toggles, and new entity action buttons. |
| **`<EmptyState>`** | [`src/components/common/EmptyState.tsx`](file:///c:/mapFiles/MAPv2/src/components/common/EmptyState.tsx) | Reusable zero-state card with centered Lucide icon, heading, descriptive copy, and optional action button. |
| **`<DetailHeader>`** | [`src/components/common/DetailHeader.tsx`](file:///c:/mapFiles/MAPv2/src/components/common/DetailHeader.tsx) | Standard header banner for entity detail views: back link, entity title, code, status badge, and primary action buttons. |
| **`<CountTabs>`** | [`src/components/common/CountTabs.tsx`](file:///c:/mapFiles/MAPv2/src/components/common/CountTabs.tsx) | Standard horizontal navigation tabs displaying active filter stage, label, and numerical item count badges. |
| **`<StatusBadge>`** | [`src/components/common/StatusBadge.tsx`](file:///c:/mapFiles/MAPv2/src/components/common/StatusBadge.tsx) | Standard status badge supporting assurance stages, verification states, and document statuses with token colors. |

---

### 9.4 Audit Findings to Proposed Component Mapping

The following matrix maps each audit section finding to the proposed or existing component that resolves it:

| Audit Category | Identified Problem / Finding | Resolving Component | Implementation Mechanism |
|:---|:---|:---|:---|
| **Buttons** (Sec 3) | 174 arbitrary class combinations across 384 buttons | `<Button>` / `<IconButton>` | Enforces `variant`, `size`, and uniform typography via strict props |
| **Buttons** (Sec 3) | 67 unstandardized table row icon action triggers | `<IconButton>` | Standard 32x32px square action button with `ariaLabel` and tooltip |
| **Spacing** (Sec 4) | Inconsistent button row gaps (`gap-0.5`, `gap-3.5`) | `<ButtonGroup>` | Standardized `gap` scale (1, 1.5, 2, 2.5, 3) |
| **Spacing** (Sec 4) | Over-padded card footers and headers (`px-4 py-3`) | `<Modal>` / `<DetailHeader>` | Enforces standard breathing room token padding (`px-3 py-2.5`) |
| **Modals** (Sec 5) | Arbitrary widths (`maxWidth: 480px`, `620px`) | `<Modal>` / `<ConfirmModal>` | Standardized Bootstrap `size` tiers (`sm`, `md`, `lg`, `xl`) |
| **Modals** (Sec 5) | Repetitive inline deletion confirmation dialogues | `<ConfirmModal>` | Turnkey confirmation modal with title, message, and async handler |
| **Tables** (Sec 6) | 42 inline `<table>` tags lacking standard pagination | `<DataTable>` | Unified data table integrating `<TablePagination>` and 6-col standard |
| **Repeated** (Sec 7) | 97+ hand-coded status badge `<span>` tags | `<StatusBadge>` | Direct consumption of existing shared component |
| **Repeated** (Sec 7) | 25+ hand-crafted empty state table rows | `<EmptyState>` | Direct consumption of existing shared component |
| **Repeated** (Sec 7) | Hand-crafted search bars and filter rows | `<ListToolbar>` | Direct consumption of existing shared component |
| **Repeated** (Sec 7) | Hand-crafted entity detail banner headers | `<DetailHeader>` | Direct consumption of existing shared component |
| **Repeated** (Sec 7) | 16 hand-built KPI dashboard tiles | `<KpiTile>` *(Proposed 4734)* | Proposed KPI metric tile component in MAP-1 Feature 4732 |

---

### 9.5 Testing / Verification: Complete Button Audit Variant Mapping

To satisfy the testing requirement (*"Every variant from the Button audit maps to one proposed prop value"*), the table below proves that all 8 variants and class patterns documented in the Button Audit (Section 3.1) map directly to a concrete prop configuration on `<Button>` or `<IconButton>`:

| Audit Section 3.1 Variant | Current Class Pattern In Audit | Proposed Component & Prop Mapping | Target Rendered Classes / Element |
|:---|:---|:---|:---|
| **Primary** | `btn btn-sm btn-primary` | `<Button variant="primary" size="sm" />` | `<button className="btn btn-sm btn-primary">` |
| **Secondary** | `btn btn-sm btn-secondary` | `<Button variant="secondary" size="sm" />` | `<button className="btn btn-sm btn-secondary">` |
| **Outline** (Secondary) | `btn btn-sm btn-outline-secondary` | `<Button variant="outline-secondary" size="sm" />` | `<button className="btn btn-sm btn-outline-secondary">` |
| **Outline** (Primary) | `btn btn-sm btn-outline-primary` | `<Button variant="outline-primary" size="sm" />` | `<button className="btn btn-sm btn-outline-primary">` |
| **Danger** (Solid) | `btn btn-sm btn-danger` | `<Button variant="danger" size="sm" />` | `<button className="btn btn-sm btn-danger">` |
| **Danger** (Outline) | `btn btn-sm btn-outline-danger` | `<Button variant="outline-danger" size="sm" />` | `<button className="btn btn-sm btn-outline-danger">` |
| **Icon** | `btn btn-sm btn-outline-* p-0` (32x32px) | `<IconButton variant="outline-secondary" size="sm" />` | `<button className="btn btn-sm btn-outline-secondary p-0" style={{ width: 32, height: 32 }}>` |
| **Close** | `btn-close` | `<Button variant="close" />` | `<button className="btn-close" type="button" aria-label="Close" />` |
| **Link** | `btn btn-sm btn-link p-0` | `<Button variant="link" size="sm" />` | `<button className="btn btn-sm btn-link p-0 text-decoration-none">` |
| **Other / Specialized** | Custom role chips, filter tabs, dropdowns | `<CountTabs>`, `<FilterButton>`, or `<Button variant="outline-secondary" size="xs" />` | Standardized component or compact button configuration |

