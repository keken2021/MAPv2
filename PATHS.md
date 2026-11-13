# PATHS.md: Project Path Directory

> Read this before searching the filesystem. One line per entry: `path` : purpose.
> Paths are relative to the project root unless they start with `~` or a drive letter.
> NEVER put secret values here, only where they are configured.

Last verified: 2026-10-29 ("Where new files go" section added; `.autopilot/` sorted by path-directory `organize.py`: Task folders 5193 to 5206 under story 5207, reports, state, scratch; BRD V4.2 PDF moved to `docs/brd/`; before that, 2026-10-13: `task-branch` Task notes added: `note` command, `--notes` argument, `.task-notes/` in the MAP-1 clone; same day, `task-branch` skill added: skill folder, ADR 0006, plan record, Skill Spec, MAP-1 clone entries; before that, 2026-10-12: Document Renewal notifications, one asset per set and provider terms added: plan, ADR 0004, glossary, 3 new source files; before that: `docs/` sorted into folders and 13 implemented records removed; colleague setup docs split into connection and comments-uploads sets; the rest as verified on 2026-10-10: docs, glossary, ADR, Marketplace and Vessels entries, Task list .docx files, board-comment skill)
Last verified: 2026-10-13 (Task list check against the MAP branch documents and the local MAP clone added; before that: Document Renewal notifications, one asset per set and provider terms added: plan, ADR 0004, glossary, 3 new source files; before that: `docs/` sorted into folders and 13 implemented records removed; colleague setup docs split into connection and comments-uploads sets; the rest as verified on 2026-10-10: docs, glossary, ADR, Marketplace and Vessels entries, Task list .docx files, board-comment skill)
Root: `C:\mapFiles\MAPv2`

## Start here
- `README.md` : product overview of the Marine Assurance Platform prototype
- `CLAUDE.local.md` : private Claude instructions (Azure Boards defaults, vocabulary). Not checked in. There is no `CLAUDE.md`.
- `src/main.tsx` : app entry
- `src/App.tsx` : hash-view router; maps each view name to a component in `src/views/`

## Run / build / test
- Install: `npm install`
- Dev: `npm run dev` (Vite)
- Test: `npm test` (`vitest run`; tests live in `src/__tests__/`)
- Build: `npm run build` (`tsc && vite build`); output in `dist/` (generated, do not edit)
- Build & Test: `npm run build:test` (`npm run build && npm test`)
- There is no lint script.

## Source map
- `src/views/` : one file per screen
- `src/components/tables/` : data tables used by the list screens
- `src/components/drawers/` : drawers (open from the right edge); `Drawer.tsx` is the shared shell every drawer uses
- `src/components/dashboard/` : role dashboard components (`SharedDashboardFrame.tsx` shared frame)
- `src/components/modals/` : modals (centered); `Modal.tsx` is the shared shell, `ConfirmDialog.tsx` is the shared confirmation dialog, `EditParticipatingOrganizationsModal.tsx` manages participating vendor/third-party orgs on a project, `RequestRecipientSelect.tsx` recipient picker with direction link and participating organizations shortcut, `ContractChainFields.tsx` read-only client and clearable head contractor and vendor inputs for Organizations & Contract Chain modal
- `src/components/wizards/` : multi-step wizards; `Wizard.tsx` is the shared numbered stepper shell
- `src/utils/useOverlayBehavior.ts` : escape, focus and tab handling for a drawer or a dialog opened from one
- `src/utils/useDeferredFilters.ts` : modal draft filter state hook (`useDeferredFilters`) isolating `FilterModal` edits and resets until Apply is clicked; tests `src/__tests__/deferredTableFilters.test.tsx`
- `src/components/common/` : shared controls (filters, pagination, readiness gauge, pipeline stepper, CountTabs, StatusBadge, ListToolbar, SearchInput, Modal, ConfirmDialog, Wizard, DetailHeader, SearchableSelect, EmptyState, DueCell, ApproverDecisionBar)
- `src/components/layout/` : sidebar, header, notification panel, organization switcher; `SidebarViewingAsMenu.tsx` displays active organization person switcher for the active role
- `src/utils/userRoleHelpers.ts` : user role entitlement helpers, `getSessionUsersForOrgPersona` for active users holding role in organization
- `src/utils/headerNavigation.tsx` : reusable header back navigation helper, hook (`useHeaderBackNavigation`), and back button component (`HeaderBackButton`) preserving contextual return to originating entities (e.g. Assurance Set from CAPA open findings)
- `src/store/useMapStore.ts` : the single app store; `setActiveSessionUser` switches active user within role
- `src/store/*MockData.ts` : mock data, one file per domain
- `src/types/` : TypeScript types per domain (`dashboard.ts` role dashboard configuration types)
- `src/utils/rbacHelpers.ts` : which role sees which set, asset and action
- `src/utils/useSessionUser.ts` : hook returning the active demo session user profile for the current persona and organization
- `src/utils/permissionHelpers.ts`, `src/utils/permissionDefaults.ts` : role permission matrix
- `src/utils/issuerVerificationProfiles.ts` : confirmed digital verification portals and procedures for ROs and Flag Administrations (gap review R2-G4, R2-S8)
- `src/config/featureFlags.ts` : feature flags
- `src/config/readinessScale.ts` : unified readiness scale cut-offs, tones, and CSS class helpers
- `src/config/thresholds.ts` : centralized reminder, expiry, OCR, and at-risk thresholds (Task 5524 / A17)
- `src/__tests__/projectOwnerSubSetVisibility.test.ts` : unit tests for master-project owner sub-set visibility and document restriction rule (Task 5529 / A37)
- `src/__tests__/editParticipatingOrganizations.test.tsx` : unit and integration tests for participating organizations editing and auto-sync
- `src/__tests__/requestAssuranceSetRecipients.test.ts` : tests for request recipients (all submitters or fallback administrators)
- `src/__tests__/defaultOrganizationVerifierAndInspector.test.tsx` : tests for defaulting active verifiers and inspectors when organization is chosen (Sentinel Cyber Assurance and others)
- `src/__tests__/singleAdministratorPerOrganization.test.ts` : tests for enforcing at most one active Administrator and C Admin per organization, helper tests, and UserModal validation
- `src/utils/organizationRegistry.ts` : canonical list of 23 kept organizations, classification of clients (`C Admin`) vs operators/third-parties (`Administrator`), name canonicalization aliases, and validators
- `src/__tests__/organizationRegistry.test.ts` : unit tests for canonical organization registry, aliases, and mock data consistency
- `src/__tests__/allOrganizationsHaveAdministrator.test.ts` : tests that every kept organization has at least one active Administrator or C Admin
- `src/__tests__/oilProjectWalkthrough.test.ts` : walk-through tests for Oil Company LNG Field Development project organizations
- `src/__tests__/loginAndSetActivePersonaFallbacks.test.ts` : tests for login and setActivePersona fallback to first user holding the role
- `src/__tests__/viewingAsUserSwitcher.test.tsx` : unit and component tests for Viewing as user switcher, helper filtering, store session user switching, and sidebar menu
- `src/utils/formatters.ts` : dates, status labels, and `getProviderLabel` (Vessel Provider, Crew Provider, Equipment Provider, or Provider)
- `src/utils/dashboardTileNavigation.ts` : KPI tile navigation and list filtering for role dashboards
- `src/utils/recentActivityFeed.ts` : Recent activity feed formatting and role relevance filtering for role dashboards
- `src/utils/roleDashboardConfigs.ts` : Role-specific dashboard configuration builders for shared dashboard frame
- `src/__tests__/needsYourActionRedirects.test.tsx` : tests for dashboard "Needs your action" redirects and end-to-end task actions across all 6 personas

## Notifications
- `src/views/NotificationsView.tsx`, `src/components/layout/NotificationPanel.tsx`, `src/components/modals/NotificationDetailModal.tsx` : inbox page, header bell panel, detail modal (with mock email channel line for re-upload and expiry notices per Task 5527 / FR-35; tests `src/__tests__/reuploadNoticeEmailChannel.test.tsx`)
- `src/types/notification.ts`, `src/store/notificationMockData.ts` : types, categories and their id codes, seeded inbox
- `src/utils/notificationHelpers.ts` : inbox filters, ids, the row action of each type
- `src/utils/documentRenewalHelpers.ts` : Document Renewal category: reason of a document on a set, renewals due, wording. Raised by `raiseDocumentRenewalNotifications` and `requestDocumentReupload` in the store
- `src/__tests__/notifications.test.ts`, `src/__tests__/documentRenewal.test.ts` : notification and renewal rules

## Assurance Sets screens
- `src/views/AssuranceSetsView.tsx` : list screen wrapper
- `src/components/tables/AssuranceTable.tsx` : list screen body (pills, toolbar, filters, table, row actions)
- `src/views/CreateAssuranceSetView.tsx` : create wizard
- `src/components/wizards/AssuranceContractPeriodFields.tsx` : wizard component for assurance set Contract Period dates, Planned Charter Date, Compliance Deadline, project window clamping notice, and window hint (Map Design System §12)
- `src/utils/assuranceTemplates.ts` : wizard steps, scopes and standard documents; `getAssuranceSetAsset` and `toSingleAssetSet` keep a set to one asset (ADR 0004)
- `src/views/AssuranceDetailView.tsx` : detail screen
- `src/components/assurance/AssuranceDetailTasksTab.tsx` : assurance set detail Tasks tab pane component extracted per Map Design System §12
- `src/utils/stageTasks.ts` : stage-derived task rows (inspection and approval) shared rules (`getInspectionTaskStatus`, `getApprovalTaskStatus`, `isStageTaskActionableForViewer`, `isInspectionDue`); tests `src/__tests__/inspectionTask.test.ts`
- `src/utils/inspectionTask.ts` : re-exports `stageTasks.ts` for backward compatibility
- `src/components/drawers/DocumentReviewDrawer.tsx` : document review drawer opened from the detail screen
- `src/components/drawers/ApproverDecisionDrawer.tsx` : approver decision drawer opened in-place from the detail screen Tasks tab
- `src/types/assurance.ts` : assurance set types
- `src/__tests__/assuranceSetsRoleAccess.test.ts` : role access rules for these screens
- `src/__tests__/assuranceTableTailoredTabs.test.tsx` : tailored status tabs (To do, In progress, Completed) for workflow roles vs universal tabs for Admins and notification-assigned set visibility
- `src/__tests__/oneAssetPerSet.test.ts` : one scope and one covered asset per set, provider terms (a crew set may list several crew members, ADR 0023)
- `src/utils/assuranceOverlap.ts` : contract period overlap check between sets on the same asset (half-open periods, drafts skipped); used by the create wizard's Scope tab (asset picked next to the dates) and the detail Contract Period edit; tests `src/__tests__/assuranceOverlap.test.ts`
- `src/utils/documentVersionSnapshot.ts` : `isClosedAssuranceSet`, version snapshot on verify (`verifiedVersion`), lock on approval (`lockedAt`), seed freeze, `getRequirementDocumentView` (version-pinned document for an approved set), `isRequirementOnOlderVersion`, `countOutdatedVersionRequirements` (FR-15); tests `src/__tests__/documentVersionSnapshot.test.tsx` and `src/__tests__/outdatedDocumentVersion.test.tsx`
- `getAssuranceSetCrewIds`, `getAssuranceSetCrewNames`, `getAssuranceSetAssets` in `src/utils/assuranceTemplates.ts` : every crew member of a crew set (`crewIds`, ADR 0023); tests `src/__tests__/multiCrewScope.test.tsx` (includes the wizard checkbox list)
- `src/__tests__/assuranceDetailTabs.test.tsx` : tests for assurance set detail tab layout and audit trail integration (Task 5269)
- `src/__tests__/workflowRejectionAndRemediation.test.ts` : automated integration tests for approver rejection, correction requested pings, multi-party task status, document version remediation, scoped re-verification, and final approval locking (Task 5508)
- `src/__tests__/workflowClientDisruptions.test.ts` : automated integration tests for client cancellation, charter window date shifts, contract overlap collisions, and certificate expiry cascades (Task 5509)
- `src/__tests__/workflowSystemGuardrailsAndFallbacks.test.ts` : automated integration tests for terminal hard rejection, segregation of duties RBAC enforcement, and post-approval snapshot immutability (Task 5510)
- `src/__tests__/assuranceDetailTaskModals.test.tsx` : tests for add and edit task dialog section and predecessor selects on assurance set detail (Task 5287)
- `src/__tests__/assuranceDetailPartyVisibility.test.tsx` : tests for assurance set detail document visibility per party (Task 5309)
- `src/__tests__/assuranceContractDateGating.test.tsx` : component tests for assurance set Contract Period date gating across CreateAssuranceSetView, AssuranceDetailView inline edit, and AttachAssuranceSetPreviewModal
- `src/utils/assuranceSetStatus.ts` : Set status rule (Go, Conditional, No-go), `ASSURANCE_SET_STATUS_RULES` thresholds, next expiry, party roles, worst-first order (ADR 0033); tests `src/__tests__/assuranceSetStatus.test.ts`
- `src/components/tables/ProjectAssuranceStatusTable.tsx` : status-first assurance set table on project detail; tests `src/__tests__/projectAssuranceStatusTable.test.tsx`
- `src/components/tables/ProjectTasksTable.tsx` : read-only tasks roll-up table on project detail; tests `src/__tests__/projectTasksTable.test.tsx` (Task 5329)
- `src/components/tables/ProjectTaskRow.tsx` : single task row component for `ProjectTasksTable` (Map Design System §12)
- `src/components/projects/ProjectOverviewTab.tsx` : Overview tab on project detail showing Overall Project Readiness (gauge and Object, Assurance Set, Provider counts), Approved % tile (Task 5526), delivery efficiency metrics, Active Bottlenecks, and Participating Providers summary table (Task 5498); tests `src/__tests__/projectDetailHeader.test.tsx` and `src/__tests__/projectApprovedPercentage.test.tsx`
- `.autopilot/.task-notes/5483-prototype-demo-relevant-alignment-items/` : Task notes (`plan.md`, `plan.docx`, `changes.md`, `next-steps.md`) for Sprint 3 demo-relevant alignment Tasks 5484, 5487, 5488, 5489, 5494, 5495, 5497, and 5498
- `src/views/AssuranceObjectsView.tsx` : assurance objects catalog view with 6 target tabs (All, Vessels, Crew Directory, Equipment, Procedures, Methods); tests `src/__tests__/assuranceObjectTabs.test.tsx`
- `src/__tests__/assuranceWizardObjects.test.tsx` : tests for assurance set wizard object type picker (5 target types) and port-entry bundle objects (Task 5300)
- `src/__tests__/assuranceWizardRequirementsStep.test.tsx` : tests for assurance set wizard Step 3 General documents pinned section and sub-type accordions (Task 5301)
- `src/__tests__/assuranceWizardStep3TitlesAndOtherDocs.test.tsx` : tests for assurance set wizard Step 3 in-place editable section titles and Add other document action (Task 5302)
- `src/__tests__/tenantCustomSections.test.tsx` : tests for assurance set wizard Step 3 tenant custom sections creation, in-place title editing, document addition, and per-tenant scoping (Task 5303)
- `src/__tests__/responsiblePartyMultiSelect.test.tsx` : tests for assurance set wizard Step 3 requirement responsible party multi-select checklist limited to Step 1 organizations (Task 5304 / finding 5c-01)
- `src/__tests__/partyUploadTasks.test.tsx` : tests for independent upload tasks per party and requirement completion when all are done (Task 5305 / finding 5c-02)
- `src/__tests__/assuranceDetailRequirementsGrouping.test.tsx` : tests for assurance set detail Requirements tab Step 3 grouping (General first, object types, sub-types, edited & custom section titles, other docs marked client-added; Task 5306 / findings 5d-01, 5d-02, 5d-03)
- `src/__tests__/assuranceObjectsSidebar.test.tsx` : tests for assurance objects sidebar items (All Objects, Vessels, Equipment, Crew Directory, Procedures, Methods) and Settings Organization profile (Task 5307 / findings 4b-01, 4b-02, 4b-03)
- `src/__tests__/assuranceDetailPartyRowsAndExports.test.tsx` : tests for assurance set detail shared requirement party sub-rows, completion gate, and CSV/PDF export Responsible party column (Task 5308 / finding 5d-04)
- `src/__tests__/inspectionChecklistAndDrawerRecords.test.tsx` : tests for inspection checklist and drawer dynamic set ID, location, date, checklist length, and seeded records (Task 5310 / findings 1a-12, 1a-13, 1b-06, 1b-07)
- `src/__tests__/documentRecordsAndUpload.test.tsx` : tests for document upload real file size, version numbering from versions.length, certificate layout vessel/crew record lookups, DocumentReviewDrawer version meta, and CrewDocumentViewerModal record reads (Task 5311 / findings 1a-20, 1b-01, 1b-03, 1b-04, 1b-05, 1c-09)
- `src/utils/documentObjectHelpers.ts` : assurance object referencing for documents (vessel, crew/person, equipment, activity), title normalization, object label formatting, duplicate title detection per object, and uploadable target objects resolution
- `src/components/modals/DocumentObjectReferenceFields.tsx` : assurance object type and target object selectors, upload mode toggle (New Document vs Upload New Version), candidate version selector, and duplicate title alert with 1-click version pivot
- `src/__tests__/documentObjectUploadAndVersions.test.tsx` : unit and integration tests for document object referencing, version upload, unique title per object, Option A re-upload policy, drawer expiry override, FR-15 snapshot preservation, and detail view upload triggers
- `docs/plans/submitter-document-object-reference-and-version-upload.md` : architecture and execution plan for Submitter and Administrator document object referencing, version upload, and unique title per object enforcement
- `src/__tests__/organizationsInGeneral.test.tsx` : tests for organizations in general, wizard Step 1 Organizations table and role checkboxes, Step 2 unlisted object owner auto-addition, and multi-provider submitters (Task 5326)
- `src/__tests__/assuranceWizardOneVendor.test.tsx` : tests for assurance wizard one vendor and one client per set, vendor locking from first object, filtered pickers, mixed object types from same vendor, and saved set party rules (Task 5332)
- `src/__tests__/scenario1VesselProviderStarts.test.ts` : tests Scenario 1 from architecture diagram (Administrator registers vessel, creates project and set, segregation of duties, external party verifies and approves)
- `src/__tests__/scenario2ClientCreates.test.ts` : tests Scenario 2 from architecture diagram (Client C Admin creates master project and multiple assurance sets SS-01, SS-02, SS-03, SS-05, independent entity integrity)
- `src/__tests__/scenario3MultiPartyProject.test.ts` : tests Scenario 3 and Master Project roll-up from architecture diagram (other parties add sets, SS-04 role reversal, ownership isolation, 5-set aggregate progress roll-up)

## Marketplace screens
- `src/views/MarketplaceView.tsx` : browse page (pills, view toggle, export, toolbar, filter modal, card grid, table view)
- `src/components/marketplace/MarketplaceCard.tsx` : listing card
- `src/components/marketplace/MarketplaceDetailModal.tsx` : offering detail modal (hero, tabs, charter action)
- `src/utils/marketplaceHelpers.ts` : listing build, filter, sort, charter target
- `src/store/marketplaceMockData.ts`, `src/types/marketplace.ts` : mock listings and types
- `src/__tests__/marketplace.test.ts` : listing, filter and role access rules
- `src/components/layout/HeaderBanner.tsx` : header, with the prototype-only "Viewing as" role buttons
- `src/components/layout/AppSidebar.tsx`, `src/components/layout/OrganizationSwitcher.tsx` : side panel, with the prototype-only organization and user switchers

## Vessels screens
- `src/views/FleetRegistryView.tsx` : list screen wrapper (Own and Chartered pills, register modal trigger)
- `src/components/tables/VesselTable.tsx` : list screen body (toolbar, filter modal, card grid, table view, role data scope)
- `src/components/modals/VesselModal.tsx` : 4-step register modal; `VesselImageCropModal.tsx` is its crop dialog; tests `src/__tests__/vesselAddModalCrash.test.tsx` (Task 5516)
- `src/views/VesselDetailView.tsx` : detail screen (header, 8 tabs, modals; permission flags by role near L262)
- `src/components/assets/AssetStatusCard.tsx` : availability, registration, class and compliance card on the detail screen
- `src/utils/vesselImageHelpers.ts`, `src/utils/vesselStatusHistoryHelpers.ts` : photo and status chip helpers, status history helpers
- `src/types/vessel.ts`, `src/types/asset.ts` : vessel and asset status types

## Crew screens and groups
- `src/views/CrewView.tsx` : crew directory view with Individuals and Groups toggle
- `src/components/tables/CrewTable.tsx` : crew directory table and groups table with shared search/filter/pagination
- `src/views/CrewGroupDetailView.tsx` : crew group detail view (Details & Specializations, Roster tabs, master group editing)
- `src/__tests__/crewGroupsStore.test.ts` : tests for crew groups store actions (Task 5338)
- `src/__tests__/crewGroupsToggle.test.tsx` : tests for CrewTable groups toggle (Task 5339)
- `src/__tests__/crewGroupDetailView.test.tsx` : tests for CrewGroupDetailView (Task 5340)
- `src/__tests__/crewGroupsWizardPick.test.tsx` : tests for picking crew groups in assurance set wizard and member snapshot (Task 5341)

## Unit tests named in the Task lists
- `src/__tests__/` : all prototype tests. Run a subset with `npx vitest run src/__tests__/<file>`
- Unit tests for UI declutter shared pieces: `src/__tests__/sharedPieces.test.tsx` (CountTabs, StatusBadge, ListToolbar, DetailHeader)
- Unit tests for SearchInput: `src/__tests__/searchInput.test.tsx` (typing, clear button, aria-label, leading icon, pass-through props, ref forwarding)
- Unit tests for Modal: `src/__tests__/modal.test.tsx` (sizes sm/md/lg/xl, Escape key, backdrop click, dismissible flag, focus return, aria-labelledby)
- Unit tests for deferred FilterModal behavior: `src/__tests__/deferredTableFilters.test.tsx` (`useDeferredFilters` contract and all 14 table/view `FilterModal` callers: draft isolation, Cancel/X/Escape/backdrop discard, Clear All, Apply commit, pagination reset, CountTabs sync)
- Unit tests for ConfirmDialog: `src/__tests__/confirmDialog.test.tsx` (default tone, danger tone, reason requirement, cancel, submit)
- Unit tests for Wizard: `src/__tests__/wizard.test.tsx` (numbered stepper, Next check blocking, canJumpTo rules, Back, Submit, Save Draft)
- Unit tests for UI declutter Approver Dashboard: `src/__tests__/approverDashboardDeclutter.test.tsx` (CountTabs, Due column, 1 badge/action per row, detail view cleanup)
- Unit tests for UI declutter Submitter Dashboard: `src/__tests__/dashboardSubmitterSession.test.tsx` (per-person filtering with useSessionUser, 13 sets for M. Chen)
- Unit tests for shared dashboard frame: `src/__tests__/sharedDashboardFrame.test.tsx` (role dashboard shared frame layout, KPI tiles, responsive stacking below 900px, empty action state, zero raw Tailwind palette colors, outer card removal, system spacing)
- Unit tests for KPI tile navigation: `src/__tests__/dashboardTileNavigation.test.tsx` (KPI tiles open filtered list screens with matching counts across all 5 roles)
- Unit tests for recent activity feed: `src/__tests__/recentActivityFeed.test.tsx` (plain sentences, relative times, and role relevance filtering across all 5 roles)
- Unit tests for Administrator as client dashboard: `src/__tests__/administratorClientDashboard.test.tsx` (4 neutral KPI tiles, needs action list sorted soonest start first, missing roles naming, Assign button)
- Unit tests for client tables removal: `src/__tests__/removeClientTablesFromDashboard.test.tsx` (client dashboard has no tables, search, or pagination; three list screens remain functional)
- Unit tests for Submitter dashboard config: `src/__tests__/submitterDashboardConfig.test.tsx` (Submitter KPI tiles, 4-tier action urgency sort, tags, button labels and view routing)
- Unit tests for Verifier dashboard config: `src/__tests__/verifierDashboardConfig.test.tsx` (Verifier KPI tiles, escalation check, 4-tier urgency action sorting, oldest wait days calculation, Verify buttons)
- Unit tests for Inspector dashboard config: `src/__tests__/inspectorDashboardConfig.test.tsx` (Inspector KPI tiles, 4-tier action urgency sort, flagged CAPA re-inspections second, button interactions)
- Unit tests for Inspection task: `src/__tests__/inspectionTask.test.ts` (stage, required/completed flags, assigned inspector viewer permissions)
- Unit tests for Approver dashboard config: `src/__tests__/approverDashboardConfig.test.tsx` (Approver KPI tiles, longest wait first sorting, mini readiness bar on rows, Decide vs Review button matching state)
- Unit tests for role dashboards routing: `src/__tests__/roleDashboardsRouting.test.tsx` (routes Administrator, Submitter, Verifier, Inspector, Approver to SharedDashboardFrame, verifies all old dashboard views retired from DashboardView)
- Unit tests for UI declutter dashboard KPI tiles: `src/__tests__/dashboardTiles.test.tsx` (tile navigation to filtered lists and table filtering for Administrator, Submitter, and C Admin)
- Unit tests for UI declutter shell header and sidebar: `src/__tests__/shellDeclutter.test.tsx` (title-only list views, detail back links, sidebar labels Inspections, CAPA, Approvals, dynamic verification queue count badge)
- Unit tests for reusable header back navigation: `src/__tests__/headerNavigation.test.tsx` (contextual return across screens, CAPA findings return to assurance set, parent list fallbacks)
- Unit tests for UI declutter Verifier and Inspector workspaces: `src/__tests__/workspacesDeclutter.test.tsx` (CountTabs default tabs and counts, Due column with late calculation, 1 badge/action per row, removed KPI cards, Document Library 1440 px header count)
- Unit tests for DueCell and getDueStatus: `src/__tests__/dueCell.test.tsx` (open past due, closed past due, future, expiring window, expired status)
- Unit tests for UI declutter Assurance Sets list and detail: `src/__tests__/assuranceSetsDeclutter.test.tsx` (CountTabs and ListToolbar in card, Draft badge removed beside title, Public tab merged scope column, DetailHeader single badge, cancelled alert only, overdue badge only, info card badges, single Export, removed inner boxes)
- Unit tests for UI declutter Assurance Set detail tabs and audit trail: `src/__tests__/assuranceDetailTabs.test.tsx` (Details, Requirements, Tasks, and Audit Trail tabs, URL sync, date event deduplication, empty state)
- Unit tests for UI declutter Assurance Sets and Vessels per person: `src/__tests__/tablesPerPersonSession.test.tsx` (per-person filtering with useSessionUser for AssuranceTable and VesselTable)
- Unit tests for UI declutter role access check across organizations: `src/__tests__/roleAccessAcrossOrganizations.test.ts` (walks every organization and persona, checks sidebar links, workflow role scoping, admin org scoping)
- Unit tests for UI declutter Northwind Verifier persona and queue: `src/__tests__/northwindVerifierQueue.test.tsx` (sidebar persona switch, at least 4 To Verify items, 1 Overdue item, no submitter == verifier)
- Unit tests for Approver decision bar on set detail: `src/__tests__/approverDecisionBar.test.tsx` (bar shown only for named approver at Approval, reason required for Return and Reject, Approve disabled with open findings)
- Unit tests for Task 5530 (A64): `src/__tests__/approverNoticeAndCharterDate.test.ts` (approver sent-back notification on correction/rejection, optional planned charter date)
- Projects: `createProjectWizardOrganization.test.tsx`, `projectComposition.test.ts`, `projectDetailHeader.test.tsx`, `projectNestedSets.test.ts`, `assuranceSetProjectRelationship.test.ts`, `mockDataConsistency.test.ts`, `notifications.test.ts`
- User Management: `cAdminUserManagement.test.ts`, `userRoleHelpers.test.ts`, `store.test.ts`
- Audit Trail: `permissionHelpers.test.ts`, `notifications.test.ts`, `mockDataBusinessRules.test.ts`, `store.test.ts`
- Switchers and side panel: `demoSessionHelpers.test.ts`, `approverAndSidebar.test.ts`, `store.test.ts`

## Where new files go (path-directory `references/layout.md`; this section wins here)
- One Task: `.autopilot/.task-notes/<story id>-<story name>/<task id>-<task name>/` : `plan.md` (+ `.docx`), `changes.md`, `next-steps.md`, `screens/`, other Task records as `<topic>.md`. Prototype Tasks 5193 to 5206 are under `.autopilot/.task-notes/5207-prototype-brd-v4-2-changes/`; Tasks 5242 to 5251 under `.autopilot/.task-notes/5209-prototype-ui-declutter/`
- One story: `.autopilot/.task-notes/<story id>-<story name>/story-recap-<date>.md`
- Work with no Task: `.autopilot/plans/<yyyy-mm-dd>-<topic>/plan.md`
- Reports: `.autopilot/reports/daily/`, `.autopilot/reports/weekly/`; script state: `.autopilot/state/`; loose or duplicate files: `.autopilot/scratch/`
- Documents across Tasks: `docs/plans/` (not done yet), `docs/changes/` (done), `docs/architecture/`, `docs/adr/`, `docs/meetings/`, `docs/work-items/`, `docs/azure-boards/`, `docs/prototype-packs/`, `docs/brd/` (source documents from others). A `.docx`, `.html` or `.build.py` keeps the basename of its `.md` and sits beside it
- Never at the `.autopilot/` or `docs/` root (only `docs/GLOSSARY.md`), and no `*.new.*` copies beside a real file
- Tidy: `py ~/.claude/skills/path-directory/scripts/organize.py . --task-repo C:/mapFiles/MAP-1` (dry), then `--apply`

## Docs (`docs/` is gitignored, so these are local only)
- The `docs/` root holds only `GLOSSARY.md` and folders. Do not save a file at the root. Layout set on 2026-10-12; record: `docs/plans/docs-declutter.md`
- `docs/GLOSSARY.md` : domain terms (Administrator, Client, Vessel Provider, Crew Provider, Equipment Provider, Asset, Assurance Set, Document Renewal, Readiness and others; "Service Provider" is retired). Read it before wording a Task or a doc. It lives here, not at the repo root
- `docs/adr/` : decision records, numbered `0001-...`. 0001 is the Task list layout, 0002 is the one Administrator role, 0003 limits board writes to discussion comments, 0004 is one asset per Assurance Set and the provider terms by asset type (amended by 0023: a Crew set may cover several crew members; reversed by 0029: assurance object model across multiple types), 0005 is one Task for list controls and a Testing entry in each Task, 0006 lets the `task-branch` skill write a Task state and its Branch link (amends 0003), 0027 lets autopilot's story mode post one story summary comment on a scoped User Story and then close it, each after the hook's prompt (amends 0003, 0015), 0028 is prototype tasks direct commit on v3, 0029 replaces single-asset scope with generic assurance objects (vessel, person, equipment, organization, procedure, document, method), 0033 is the status-first project table replacing pillar tags and filters on project detail, 0034 amends 0029 to keep 5 assurance object target types (vessel, crew, equipment, procedure, method), moving organizations to parties and documents to evidence, and recording custom section types saved per tenant organization, 0035 is the autopilot sprint queue (every Task assigned to me until none is New or Active; 2 retry passes), 0041 is reused verified documents counting as done (narrows E3, key-only matching)
- `docs/plans/` : plans and audits of work not yet done. New plans go here
- `docs/plans/2026-11-13-auto-attach-existing-documents-design.md` : design specification for automatic reuse of verified vault documents and crew certificates on new assurance sets, matching by exact docTypeId, counting reused documents as done with audit events and 'Reused from vault' badge (story 5483)
- `docs/work-items/2026-11-13-auto-attach-existing-documents-tasks.csv` : work items for auto-attaching existing documents across vessels, crew, and equipment (8 Tasks under User Story 5483)
- `docs/plans/submitter-document-object-reference-and-version-upload.md` : plan for `Submitter` and `Administrator` object-referenced document uploads (`vessel`, `person`, `equipment`, `activity`), unique normalized document titles per referenced object with 1-click duplicate-to-version transition, and end-to-end version uploads preserving §11 R7 single-action rows (2026-11-12)
- `docs/plans/2026-11-12-tasks-tab-role-actions-separation-design.md` : design specification separating all Assurance Set workflow actions (`Upload Document`, remediation `Reupload`, `Review`, in-place `View`, `ApproverDecisionBar`, `Open Inspection`, `Open Approval`) exclusively into the Tasks tab while keeping Requirements (admin CRUD + read-only specification register) and Details clean (Approach 1 + Option A for remediation re-upload, multi-party task filtering, and linked sub-set exclusion)
- `docs/plans/submitter-document-library-upload-visibility.md` : investigation and fix plan for organization Submitter uploads not reflecting in DocumentLibraryView, empty-state upload CTA, and detail/drawer org fallback alignment (2026-11-12)
- `docs/plans/2026-11-10-real-world-workflow-tests-design.md` : architecture design and specification for automated real-world operational workflow, client disruption, and fallback test suites outside the demo flow
- `docs/plans/2026-11-10-real-world-workflow-tests-plan.md` : implementation plan for Tasks 5508, 5509, and 5510 establishing automated full-stack integration test coverage for real-world operational workflows, disruptions, fallbacks, and security guardrails
- `docs/plans/2026-11-10-deferred-table-filters.md` : plan to defer table and view `FilterModal` selections to modal-local draft state until Apply is clicked across all 14 callers, with Vitest coverage
- `docs/plans/2026-11-10-project-details-specs-overview-kpis.md` : design plan separating Project Detail Overview metrics (Readiness gauge, Object/Set/Provider counts, KPI cards) from written-spec-only Details tab (`Scope & Particulars`, conditional `Organizations & Contract Chain`, confidential `Project Value` omitted)
- `docs/plans/ui-consistency-audit.md` : UI consistency audit (Task 5368) listing button class strings, counts, and file:line uses across all 29 views in `src/views/`
- `docs/plans/ui-dedup-shared-shells.md` : de-duplication design (2026-11-05): one `Modal`, `ConfirmDialog` and `Wizard` shell, merged same-job modals, wizard search in the list-screen look, full inventory of duplicates (F1 to F7) with file:line; Tasks in `docs/work-items/ui-dedup-shared-shells-tasks.csv` (Tasks 5407 to 5450 under User Story 5209)
- `docs/plans/tabs-consistency.md` : tabs consistency design (2026-11-05): one `Tabs` component with section (navy underline), filter and toggle (navy pill) variants, inventory of the 13 tab looks with file:line; Tasks in `docs/work-items/tabs-consistency-tasks.csv` and the 5436 update
- `docs/plans/future-integration-roadmap.md` : roadmap (2026-11-03) for the six items out of prototype scope in the UI/UX evaluation checklist, in three phases (display, new users, infrastructure), with open decisions per phase
- `docs/plans/autopilot-sprint-queue.md` : autopilot Queue mode design (ADR 0035). Scripts: `~/.claude/skills/autopilot/scripts/queue.mjs` (same file in `~/.agents/skills/autopilot/scripts/`), Claude hooks `queue-stop.mjs pre|stop` in `~/.claude/settings.json`, Gemini through `gate.mjs`; queue state `~/.autopilot/queue.json`
- `docs/plans/autopilot-story-recap-plan.md` : autopilot `story` mode (ADR 0027). References: `~/.claude/skills/autopilot/references/story-recap.md`, `~/.agents/skills/autopilot/references/story-recap-gemini.md`; drafts land in the story folder, `<repo>/.autopilot/.task-notes/<story id>-<story name>/story-recap-<date>.md`
- `docs/plans/autopilot-prototype-parity.md` : approved design (2026-10-27) for autopilot prototype packs (`docs/prototype-packs/<screen-id>/`, local only), the Phase 4 parity check (`pack.mjs`, `parity.mjs`, `board-comment/projects/MAP-1.json`), the context digest and plan-by-slice-size; both autopilot copies
- `docs/plans/board-comment-teacher-voice.md` : approved design (2026-10-29) for board comments in a teacher's voice and the shared format check `comment-format.mjs` in both autopilot `scripts/` folders (used by Claude's `board-gate.mjs` and Gemini's `rules.mjs`); ADR 0030
- `docs/plans/gemini-comment-before-closed.md` : built design (2026-10-30) for Gemini autopilot: the board comment comes before Closed (the hook in `~/.agents/skills/autopilot/scripts/rules.mjs` refuses Closed until the Task's comment has posted, and gives a retry hint when the body is not in `text`). Gemini copies only
- `docs/plans/autopilot-prototype-mode.md` : autopilot prototype mode (ADR 0028, `docs/adr/0028-prototype-tasks-commit-to-mapv2-v3.md`): `Prototype - ` Tasks build in MAPv2 straight on `v3`, `task-branch` Direct mode. References: `~/.claude/skills/autopilot/references/prototype-task.md`, `~/.agents/skills/autopilot/references/prototype-task-gemini.md`
- `docs/prototype-packs/create-assurance-set/` : wizard pack (local only): `pack.json` (15 slices by text anchor for Tasks 4662 to 4695, 6 states, curated copy, glossary substitutions), `pack.md` (slices, states, roles, component map), `shots/proto-<state>.png` and `.text.json`
- `docs/plans/assurance-sets-tasks-flow-plan.md`, `.docx` : Tasks execution flow plan, 6 hrs/day daily schedule (12 days), and task-branch planning for the 43 Tasks assigned to Creishen Ayuman under Feature 4583; starts at Task 4655
- `docs/plans/document-renewal-and-one-asset-sets.md`, `.docx` : Document Renewal notification category, provider terms by asset type, one asset per set. Built on 2026-10-12, not committed; move to `docs/changes/` once merged. Rebuild the `.docx` with `docs/plans/document-renewal-and-one-asset-sets.build.py` (needs python-docx, which no installed Python has: use a venv; arguments: `docs/azure-boards/board-comment-skill-spec.docx` as style base, then the output path)
- `docs/plans/asset-detail-uniform-layout.md` : shared layout for the vessel, crew and equipment detail screens. Not built (was `docs/plan.md`)
- `docs/plans/map-paper-gap-review-round-2.md` : second review against the paper (Ed. 2) and the certificate data-fields note (23 Oct 2026): status of E1 to G12, new R2-E/G/I/S findings, parked items. Round 1 is `docs/meetings/map-paper-gap-review-2026-10-23.md`
- `docs/plans/brd-v4.2-gap-review.md` : gap review of the prototype against the BRD refinement session of 26 Oct 2026 (`docs/meetings/MAP_BRD_Refinement_Session_Summary_2026-10-26.docx`): 15 BRD V4.2 changes, schema entities, glossary and ADR conflicts, open stakeholder questions; checked against Peter Bengtsson's notes of the same session (P1 to P7, source differences)
- `docs/plans/brd-gap-status-2026-11-02.md` : status of every gap in `docs/brd/` against `v3` at `bcfb738`: patched briefing Tasks, G1 to G13, new gaps N1 to N8, G-01 to G-45 rows, decisions needed, and the 7 failing tests. BRD V4.2 itself is at MAP-1 `origin/development:docs/MAP_BRD_V4.2.md`
- `docs/plans/sprint-1-1-backlog-reuse-plan.md` : approved plan (29 Oct 2026) to reuse the Sprint 1.1 Features and User Stories for the v3 to MAP-1 migration, aligned to BRD V4.2: trace table, updates U1 to U9, per-Feature and per-story changes, 7 new Features and 25 new stories, Creishen 32 / Kurt 33 split. No board write made yet
- `docs/plans/v3-prototype-ux-and-migration-gap-review.md` : v3 UX and visual critique (Part A), MAP-1 migration checklist (Part B), stakeholder questions (Part C); screenshots in `docs/plans/assets/v3-gap-review/`
- `docs/work-items/v3-gap-fixes-prototype-tasks.md` : Part A prototype Tasks 5242 to 5268, split Creishen 14 / Kurt 13 with file ownership, 0.25 or 0.5 h each
- `docs/plans/map-paper-gap-fixes-modular-plan.md` : modular execution plan and verification results for round 2 gap review fixes (Modules 1 to 5)
- `docs/plans/australian-maritime-regulatory-gap-analysis.md` : AMSA, DAFF and research fields missing from the modals. Not built
- `docs/changes/` : change summaries of work already done. New ones go here; remove one when nobody needs it
- `docs/changes/path-directory-file-layout.md` : the file layout, `organize.py`, the skills changed to follow it, and the cleanup of 2026-10-29
- `docs/changes/EXPLANATION_OF_V3_CHANGES.html` : export that explains the v3 changes (2.9 MB; its `.md` source is gone)
- `docs/architecture/MAP_Assurance_Project_Asset_Architecture.md` : how assurance sets, projects and assets relate
- `docs/architecture/multi-org-multi-user-architecture.md` : multi-organization and multi-user model
- `docs/architecture/drawer-modal-audit.md` : audit of drawers and modals, the drawer standard, and the record of the drawer shell change
- `docs/architecture/prototype-scope-users-routes-workflow.md`, `.docx` : prototype reference (2026-11-13, `v4` at `458a57b`): Part A for stakeholders (scope, limitations, 6 roles, end-to-end workflow, Scenarios 1 to 3), Part B for MAP-1 (route table with record checks, role-by-route matrix, sidebar per persona, stage machine, side paths, roll-up, demo orgs, what MAP-1 must make real, known issues K1 to K9 and decisions D1 to D3). Rebuild the `.docx` with `py docs/architecture/prototype-scope-users-routes-workflow.build.py` (python-docx; Mermaid stays in the `.md`)
- `docs/work-items/prototype-known-issues-tasks.csv` : 9 Tasks (K1 to K9, 3.25 h) under User Story 5483 in `MAP\Sprint 3`, assigned to Creishen Ayuman, State New; not yet on the board
- `docs/meetings/MAP_Continuation_Meeting_Highlights_2026-10-05.md`, `.pdf` : latest meeting decisions
- `docs/meetings/Tasks.txt`, `Questions.txt`, `Notes.txt` : working notes
- `docs/work-items/` : Task lists written for Azure Boards, one `.md`, one import `.csv` and one Word `.docx` per Feature (the `.docx` is the Task list in the documentation-docx house style, built from the `.md`; edit the `.md`, then rebuild). Was `docs/work items docs/`
- `docs/work-items/assurance-sets-ui-tasks.md`, `.csv`, `.docx` : 43 Tasks for User Stories 4617 to 4621 under Feature 4583 (3 remove the prototype switchers), with flags and import steps
- `docs/work-items/marketplace-ui-tasks.md`, `.csv`, `.docx` : 33 Tasks for User Stories 4612 to 4616 under Feature 4582, with flags and import steps
- `docs/work-items/vessels-ui-tasks.md`, `.csv`, `.docx` : 44 Tasks for User Stories 4597 to 4601 under Feature 4579 (3 remove the prototype switchers, the same 3 as in the other two files), with flags and import steps
- `docs/plans/shown-data-without-basis-audit.md` : audit (2026-11-03, `bd8f04b`) of shown data with no basis (1a no field, 1b record ignored, 1c invented records in code) and broken or one-way links in seeded data (2a to 2c, fixed by linking); one table and one checklist per section, 61 findings
- `docs/plans/status-first-project-table.md` : status-first project table and the client Assurance Sets link (Task 5294, ADR 0033 proposed): status rule, thresholds, filters
- `docs/plans/tasks-viewer-scope-and-off-stages.md` : design (2026-11-05) for tasks tables and dashboards scoped to the viewer (own tasks; Administrator sees own organization), switched-off stages reading Not required with no Assign, and the role dashboard heading removed; one shared rule file `src/utils/viewerScope.ts` (not built)
- `docs/work-items/tasks-viewer-scope-and-off-stages-tasks.csv` : 9 Tasks under User Story 5209 for that design (not yet on the board), assigned to Creishen Ayuman, 0.5 h each
- `docs/work-items/status-first-project-table-task.csv` : Task 5294 under User Story 5207
- `docs/work-items/project-detail-tabs-tasks.csv` : Tasks 5295 to 5297 under User Story 5207 for the project detail tabs (table columns, search and filter toolbar, Details tab), assigned to Creishen Ayuman, 0.5 h each
- `docs/work-items/organizations-in-general-port-task.csv` : Task 5326 under User Story 5207, port `feature/organizations-in-general` onto v4 (v4 wins over 5299/5300) and fix the High findings of the UI/UX evaluation, assigned to Creishen Ayuman, 0.5 h
- `docs/work-items/requirements-custom-sections-tasks.csv` : 2 Tasks under User Story 5207 (not yet on the board), wizard Define requirements step and detail Requirements tab: no blank sections, General plus object sections, Add custom section saved to the set, sentence case titles, assigned to Creishen Ayuman, 0.5 h each
- `docs/work-items/audit-fixes-tasks.csv` : 28 Tasks under User Story 5207 from `docs/plans/shown-data-without-basis-audit.md` Part 7, 14 each for Creishen Ayuman (assurance sets) and Kurt Grava (projects, assets, others), 0.5 h each
- `docs/work-items/brd-v4.2-gap-tasks.csv` : 6 Tasks (5285 to 5290) under User Story 5207 for the BRD V4.2 gaps that wait on nothing (G3, G4, G6, G7, G12), assigned to Creishen Ayuman, 0.25 or 0.5 h each. Source: `docs/plans/brd-gap-status-2026-11-02.md`
- `docs/plans/2026-11-09-demo-relevant-items.md` : 10 demo items consolidated from the 9 Nov alignment report and Gregg's 60 answers, built as 14 Tasks (6.25 h) plus 4 talk track topics
- `docs/work-items/2026-11-09-demo-relevant-items-tasks.csv` : 1 User Story + 15 Tasks in MAP\Sprint 3 under Feature 4749 for demo-relevant alignment items and the project detail Overview success metrics tab, divided between Creishen Ayuman (8 Tasks, 3.5 h) and Kurt Grava (7 Tasks, 3.25 h), 6.75 h total
- `docs/work-items/success-metrics-tasks.csv`, `success-metrics-task-flat.csv` : Standalone import CSVs for the success metrics task (Project detail Overview tab - Commercial and delivery efficiency metrics, 0.5 h, assigned to Creishen Ayuman) in MAP\Sprint 3 (tree-linked to 5483 or flat task import)
- `docs/work-items/2026-11-10-recent-commits-tasks.csv`, `2026-11-10-recent-commits-tasks-flat.csv` : Tasks 5500 to 5503 (1.75 h total: 5500 0.5h, 5501 0.25h, 5502 0.5h, 5503 0.5h) under User Story 5483 in `MAP\Sprint 3`, assigned to Creishen Ayuman, covering unticketed `v4` commits `f182c98` and `ce0a6d4`
- `docs/work-items/2026-11-10-real-world-workflow-tests-tasks.csv`, `2026-11-10-real-world-workflow-tests-tasks-flat.csv` : 3 Tasks (1.5 h total, 0.5 h each) under User Story 5483 in `MAP\Sprint 3`, assigned to Creishen Ayuman, covering automated test suites for real-world operational workflows outside demo path (rejection & remediation, client disruptions & date shifts, system guardrails & fallbacks)
- `docs/work-items/2026-11-10-wizard-governance-tasks.csv`, `2026-11-10-wizard-governance-tasks-flat.csv` : 3 Tasks (1.0 h total: revert 0.25h, fix 0.25h, feature 0.5h) under User Story 5483 in `MAP\Sprint 3`, assigned to Creishen Ayuman, covering recent `v4` commits `9ff12c4` (revert pilot templates), `72a65be` (suppress redundant error banners), and `7fa73e7` (enforce party assignment gate for active governance stages on step 1)
- `docs/work-items/2026-11-10-task-5515-requirements-tasks-separation.csv`, `2026-11-10-task-5515-requirements-tasks-separation-flat.csv` : Task 5515 (0.5 h) under User Story 5483 in `MAP\Sprint 3`, assigned to Creishen Ayuman, restricting document submission, reupload, and replacement to the tasks tab while keeping requirements register actions intact
- `docs/work-items/2026-11-10-vessel-project-wizard-object-tasks.csv`, `2026-11-10-vessel-project-wizard-object-tasks-flat.csv` : 4 Tasks (2.5 h total) under User Story 5483 in `MAP\Sprint 3`: Task 5516 (fix white screen clicking Add Vessel, 0.5h, Creishen Ayuman), Task 5514 (Project Wizard Step 2 orphaned sets only, 1.0h, Kurt Grava), Task 5517 (Project Wizard align assurance set contract period within project window, 0.5h, Kurt Grava), and Task 5518 (remove All Objects view and retain individual category pages, 0.5h, Creishen Ayuman)
- `docs/work-items/assurance-set-audit-trail-tasks.csv` : 3 Tasks under User Story 5207 for assurance set audit trail movement logging (target kinds, condition-met stage transitions, Audit tab search/filter/pagination/export), assigned to Creishen Ayuman, 0.5 h each
- `docs/work-items/ui-dedup-shared-shells-tasks.csv` : 44 Tasks (5407 to 5450) under User Story 5209 from `docs/plans/ui-dedup-shared-shells.md`, in 4 parts (wizard search, shells, merges, repeated UI), assigned to Creishen Ayuman, 0.25 or 0.5 h each (20 h)
- `docs/work-items/tabs-consistency-tasks.csv` : 8 Tasks (5451 to 5458) under User Story 5209 from `docs/plans/tabs-consistency.md`, assigned to Creishen Ayuman, 0.25 or 0.5 h each; `tabs-consistency-5436-update.csv` widens Task 5436 by ID
- `docs/work-items/role-views-tasks.csv` : 11 Tasks (5231 to 5241, under User Story 5209) for per-person views and the sidebar, split between Creishen Ayuman and Kurt Grava, 0.75 or 1 h each. Design: `docs/plans/per-person-views-and-sidebar.md`
- `docs/work-items/v4-test-baseline-5-failures-task.csv` : Task under User Story 5209 to resolve the 5 test failures on v4
- `docs/work-items/multi-party-scenarios-tests-task.csv` : Task under User Story 5207 for automated test suites covering Scenarios 1, 2, and 3 from the architecture diagram across wizard, confirm dialog, mock seed and queue, assigned to Creishen Ayuman, 0.5 h
- `docs/azure-boards/` : everything for the Azure Boards connection and the `board-comment` and `task-branch` skills (12 files)
- `docs/azure-boards/task-branch-skill.md` : plan and build record of the `task-branch` skill and of its Task notes (decisions 1 to 20, files, what is tested and what is not)
- `docs/azure-boards/task-branch-skill-spec.docx` : Skill Spec for `task-branch`. Rebuild with `docs/azure-boards/task-branch-skill-spec.build.py` (needs python-docx in a venv; arguments: `docs/azure-boards/board-comment-skill-spec.docx` as style base, then the output path)
- `docs/azure-boards/board-comment-skill.md` : plan and build record of the `board-comment` skill
- `docs/azure-boards/board-comment-skill-spec.docx` : Skill Spec for `board-comment` in the documentation-docx house style. "Created by" on Word documents is Creishen
- Colleague setup, set 1 (connection, read-only): `docs/azure-boards/azure-boards-connection-setup-guide.docx` (Word guide the person follows) and `docs/azure-boards/azure-boards-connection-runbook.md` (runbook their Claude Code runs: prerequisites, `sprint` skill, `azure-devops` MCP server, 8 deny rules, sign-in, checks)
- Colleague setup, set 2 (comments and screenshot uploads; needs set 1): `docs/azure-boards/azure-boards-comments-uploads-setup-guide.docx` and `docs/azure-boards/azure-boards-comments-uploads-runbook.md` (`board-comment` skill, 2 write tools opened, screenshot check, optional token)
- `docs/azure-boards/azure-boards-skills.zip` : the `sprint`, `board-comment` and `task-branch` skill folders without `node_modules`. Send it with either set. Rebuild it when a skill file changes
- `docs/azure-boards/azure-boards-setup-docs.md` : plan and build record of both sets. Rebuild a guide with `docs/azure-boards/azure-boards-setup-guides.build.py` (needs python-docx; arguments: `docs/azure-boards/board-comment-skill-spec.docx` as style base, `connection` or `comments-uploads`, then the output path)
- Old names, gone since 2026-10-12: `azure-devops-mcp-colleague-setup.md`, `azure-boards-colleague-setup-guide.*`, `azure-boards-claude-code-integration.md`
- Removed on 2026-10-12 (implemented; in the Recycle Bin until it is emptied): the change records for the organization switcher, table pagination, client dashboard columns, review channel, multi-scope filter, UI terminology, master-set purge, and the two skill and mock data audits

- On Kurt's laptop (root `C:\Users\Kurt\Documents\MAP-v2\MAPv2`, verified 2026-10-13) `docs/` is flat: the Task lists sit at `docs/<name>-ui-tasks.md`, not in `docs/work-items/`. It holds `audit-trail-ui-tasks.*` (22 Tasks, stories 4629 to 4633), `projects-ui-tasks.*` (42, stories 4592 to 4596), `user-management-ui-tasks.*` (27, stories 4634 to 4638) and `assurance-sets-ui-tasks.md`. `GLOSSARY.md` and `docs/adr/` are not on it
- `docs/task-lists-vs-map-repo-audit-projects-users.md` : check of the audit trail, projects and user management Task lists (91 Tasks) against the MAP repository documents, written for Hussein Abang on 2026-10-13. Same layout as `task-lists-vs-map-1-documents.md` (Creishen's check of the other three lists; a copy is in `~/Downloads`)

- `docs/task-lists-vs-map-branch-documents.md` : check of all four Task lists on this laptop (134 Tasks) against commit `35cb4c4` of the MAP repository, read from the local clone on 2026-10-13. Supersedes the 91-Task check for verdict counts and corrects its `check_docs.py` statement (finding 13). The Assurance Sets list here is an earlier revision than the one on the board
- `docs/audit-trail-vs-map-branch-check.md` : check of Kurt's 22 Audit Trail Tasks (4699 to 4720) against branch `planning/create-context-documents` (`35cb4c4`) and against their stories as revised on the board, written 2026-10-13. 11 findings, per-Task verdicts
- `docs/audit-trail-tasks-flow-plan.md`, `.html` : 6-day flow plan for those 22 Tasks (35.5 h, 6.0 h cap, Tue 13 to Tue 20 Oct 2026), one branch per Task. Both are written by `docs/audit-trail-tasks-flow-plan.build.mjs` (`node` it; it fails if a day is over the cap or a Task precedes one it builds on). Edit the script, not the outputs
- `docs/task-lists-vs-scoped-permission-criteria.md` : check of the 134 Tasks against the scope criteria added to Features 4578, 4583, 4627, 4628 and their 20 stories on 2026-10-13 (impact per Task, 7 new Tasks proposed), and of those criteria against the MAP branch documents. Rerun it when the scope catalogue is pushed

## Project skills and context
- `.agents/skills/map-documentation/SKILL.md` : required format for every plan, audit and change summary, and the `docs/` folder each one goes in (the glossary and the ADRs use the `domain-modeling` skill's formats)
- `.agents/skills/map-design-system/` : UI tokens and interaction rules
- `.agents/skills/map-table-standards/` : table layout rules
- `.agents/skills/map-business-rules/` : segregation of duties and approval gates
- `.agents/skills/map-mock-data-schema/`, `.agents/skills/map-data-consistency/` : mock data keys and readiness arithmetic
- `Context Files/` : source requirements (roles, use cases, UI guidelines, data schema)

## Config
- `package.json` : scripts and dependencies
- `tsconfig.json`, `vite.config.ts`, `postcss.config.js` : build config
- `.gitignore` : ignores `docs/`, `dist/`, `node_modules/` and `.env*`
- `.claude/settings.local.json` : local Claude Code permissions. Allows the Azure Boards comment tool, denies the other 6 write tools (ADR 0003)
- `~/.gemini/config/mcp_config.json` : Antigravity global MCP server configuration (includes `azure-devops` for AIUN)
- `~/.gemini/GEMINI.md` : Gemini (Antigravity) global profile; `GEMINI.md.bak3` is the copy before the context and memory rules (2026-10-29). The old `~/.agents/gemini.md` is retired as `gemini.md.bak`
- `~/.agents/skills/using-superpowers/references/memory-gemini.md` : shared memory rules, imported by `~/.gemini/GEMINI.md`. Gemini and Claude both read and write `~/.claude/projects/<slug>/memory/` (MAPv2: `c--mapFiles-MAPv2`)

## Credentials & tokens (locations only, never values)
- Azure DevOps (AIUN) : no token in the repo. The `azure-devops` MCP server signs in through the browser with the Entra work account. Registered at local scope for MAPv2 and for `C:\mapFiles\MAP-1`, both drive-letter spellings each. Setup: `docs/azure-boards/azure-boards-connection-runbook.md`
- `AZURE_DEVOPS_PAT` : user environment variable (set with `setx`, not in any file) : create and revoke at https://dev.azure.com/AIUN/_usersSettings/tokens, scope Work Items: Read & write : used only by `~/.claude/skills/board-comment/scripts/upload.mjs`. Setup: `docs/azure-boards/azure-boards-comments-uploads-runbook.md`, step 10
- `ADO_MCP_AUTH_TOKEN` / `PERSONAL_ACCESS_TOKEN` : user environment variables (set with `setx`, not in any file) : optional PAT variables for `@azure-devops/mcp` non-interactive token authentication
- `.env`, `.env.local` : gitignored. None exists in the repo today.

## Outside the repo
- `C:\mapFiles\MAP-1` : clone of the MAP repository on Azure Repos (`https://dev.azure.com/AIUN/MAP/_git/MAP`; default branch `master`, development branch `development`). The team build happens here; MAPv2 is the prototype. Its `CLAUDE.local.md` (Azure Boards section) and `.claude/settings.local.json` (board permissions, ADR 0006) are personal and not committed
- `~/.claude/skills/task-branch/SKILL.md` : skill that starts, records and closes a Task from git (`/task-branch start <task id> [bugfix] [dry]`, `/task-branch note [task id] [dry]`, `/task-branch done [task id] [dry]`). Runs in the MAP-1 clone only
- `~/.claude/skills/task-branch/scripts/branch-name.mjs` : builds `feature/<user story id>-<task name>`, and with `--notes <task id>` the notes folder name; test with `node --test branch-name.test.mjs` in that folder
- `C:\mapFiles\MAP-1\.task-notes\<task id>-<task name>\` : Task notes of one Task, `changes.md` (what it changed) and `next-steps.md` (how to continue). Written by `task-branch`; ignored through `C:\mapFiles\MAP-1\.git\info\exclude`, never committed. Read `next-steps.md` before continuing a Task. None exists until the first live `start` or `note`
- `https://dev.azure.com/AIUN/MAP/_git/MAP` : the MAP repository (Hussein Abang's context documents; no application code yet). Branches `task-comparison`, `planning/task-comparison` and `planning/create-context-documents` are at commit `35cb4c4`; `master` holds `references/` only. Local clone on Kurt's laptop since 2026-10-13: `C:\Users\Kurt\Documents\MAP-v1\MAP`, checked out on `master`, so the documents are not in the working tree. Read them with `git show origin/task-comparison:<path>` or check the branch out. On 2026-10-13 the remote lost branch `task-comparison` (use `planning/task-comparison`; the clone is checked out on it), and the documents the board stories cite are on no branch: `docs/superpowers/specs/2026-10-13-scoped-permissions-design.md`, `docs/domain/scope-catalogue-proposal.md`, `mock/me-access.json`, `docs/design/page-patterns.md`, `theme/theme.css`. Start at `docs/requirements/index.md` and `docs/architecture/schema/index.md`
- `~/Downloads/MAP_Business_Requirements_Document_2026-10-12_V4.1_1.pdf` : BRD V4.1 (dated 13 Oct 2026), the baseline the board stories cite. Not in the MAP repository. Read it with `pdftotext -layout` (the Read tool cannot render it: no poppler). Audit trail: 5.4 matrix row "View audit trail", BR-11, FR-27 (trail), FR-28 (export to PDF and Excel)
- MAP remote on 2026-10-13 (later fetch): `planning/create-context-documents` still `35cb4c4`; new branch `feature/4617-list-page-shell-and-loading-empty-error-access` adds the first application scaffold (`package.json`, `vite.config.mts`, `src/App.tsx`, `src/views/assurance-sets/`)
- `~/AppData/Roaming/Claude/claude_desktop_config.json` : `mcpServers.ado.env.PERSONAL_ACCESS_TOKEN` (value never copied here). Lists projects; has no Code (Read) scope, so it cannot read the repository
- `C:\mapFiles\MAP` : sibling app with the same package name and layout
- `C:\mapFiles\CoreUI` : CoreUI PRO React admin template (TypeScript)
- `~/.claude/skills/board-comment/SKILL.md` : skill that posts branch changes to a work item discussion (`/board-comment [id]`, `/board-comment pr [number] [id]`, `dry` posts nothing)
- `~/.claude/skills/board-comment/scripts/before-after.mjs` : before-and-after screenshots between 2 commits; `shoot.mjs` beside it shoots a running app; `upload.mjs` uploads the PNG files to the board (`--check` tells whether the token is set). First use: `npm install` in that folder
- `~/.claude/skills/board-comment/projects/MAPv2.json` : screen recipe (serve, login, role, 13 screens and their source files). Add a screen here when a new view is built
- `~/.claude/skills/task-branch/SKILL.md` : branch lifecycle of one Task (`/task-branch start|note|done <id>`), run in the MAP clone, base `development`. Rebuilt on 2026-10-13 from Creishen's Assurance Sets flow plan; compare with her copy. `scripts/branch-name.mjs <story-id> "<title>"` prints `feature/<story-id>-<task-name>` (slug cut at a whole word, 50 characters)
- `~/.claude/skills/sprint/SKILL.md` : read-only sprint status and standup skill
- `~/.claude/projects/c--mapFiles-MAPv2/memory/` : Claude's project memory
- `~/.claude/plans/` : Claude plan-mode files

## Generated / ignore
- `dist/`, `node_modules/` : generated or vendored, skip when searching
