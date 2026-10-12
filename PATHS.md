# PATHS.md: Project Path Directory

> Read this before searching the filesystem. One line per entry: `path` : purpose.
> Paths are relative to the project root unless they start with `~` or a drive letter.
> NEVER put secret values here, only where they are configured.

Last verified: 2026-10-11 (Projects, User Management and Audit Trail entries; the rest 2026-10-10)
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
- There is no lint script.

## Source map
- `src/views/` : one file per screen
- `src/components/tables/` : data tables used by the list screens
- `src/components/drawers/` : drawers (open from the right edge); `Drawer.tsx` is the shared shell every drawer uses
- `src/components/modals/` : modals (centered)
- `src/utils/useOverlayBehavior.ts` : escape, focus and tab handling for a drawer or a dialog opened from one
- `src/components/common/` : shared controls (filters, pagination, readiness gauge, pipeline stepper)
- `src/components/layout/` : sidebar, header, notification panel, organization switcher
- `src/store/useMapStore.ts` : the single app store
- `src/store/*MockData.ts` : mock data, one file per domain
- `src/types/` : TypeScript types per domain
- `src/utils/rbacHelpers.ts` : which role sees which set, asset and action
- `src/utils/permissionHelpers.ts`, `src/utils/permissionDefaults.ts` : role permission matrix
- `src/config/featureFlags.ts` : feature flags

## Assurance Sets screens
- `src/views/AssuranceSetsView.tsx` : list screen wrapper
- `src/components/tables/AssuranceTable.tsx` : list screen body (pills, toolbar, filters, table, row actions)
- `src/views/CreateAssuranceSetView.tsx` : create wizard
- `src/utils/assuranceTemplates.ts` : wizard steps, scopes and standard documents
- `src/views/AssuranceDetailView.tsx` : detail screen
- `src/components/drawers/DocumentReviewDrawer.tsx` : document review drawer opened from the detail screen
- `src/types/assurance.ts` : assurance set types
- `src/__tests__/assuranceSetsRoleAccess.test.ts` : role access rules for these screens

## Marketplace screens
- `src/views/MarketplaceView.tsx` : browse page (pills, view toggle, export, toolbar, filter modal, card grid, table view)
- `src/components/marketplace/MarketplaceCard.tsx` : listing card
- `src/components/marketplace/MarketplaceDetailModal.tsx` : offering detail modal (hero, tabs, charter action)
- `src/utils/marketplaceHelpers.ts` : listing build, filter, sort, charter target
- `src/store/marketplaceMockData.ts`, `src/types/marketplace.ts` : mock listings and types
- `src/__tests__/marketplace.test.ts` : listing, filter and role access rules
- `src/components/layout/HeaderBanner.tsx` : header, with the prototype-only "Viewing as" role buttons
- `src/components/layout/AppSidebar.tsx`, `src/components/layout/OrganizationSwitcher.tsx` : side panel, with the prototype-only organization and user switchers

## Projects screens
- `src/views/ProjectView.tsx` : list screen (toolbar, filter modal, chips, table, row action)
- `src/views/CreateProjectView.tsx` : three-step create wizard (details, assurance sets, assets)
- `src/views/ProjectDetailView.tsx` : detail screen (header, actions, Assurance Sets and Asset Roster tabs, attach section)
- `src/components/modals/ProjectAddAssetModal.tsx`, `AttachAssuranceSetPreviewModal.tsx`, `RequestAssuranceSetModal.tsx` : modals opened from the detail screen and the wizard
- `src/utils/projectHelpers.ts` : which projects each role sees (`filterProjectsForPersona`), offered sets and assets, readiness
- `src/types/project.ts`, `src/store/projectMockData.ts` : project types and mock projects

## User Management screens
- `src/views/UserManagementView.tsx` : list screen wrapper (KPI tiles, table, add modal)
- `src/components/tables/UserTable.tsx` : list screen body (toolbar, filter modal, chips, table, row actions, export, deactivate)
- `src/components/modals/AddUserModal.tsx`, `EditUserModal.tsx` : add and edit modals
- `src/components/common/UserRoleChecklist.tsx`, `src/utils/userRoleHelpers.ts` : role checklist and segregation of duties warnings
- `src/utils/rbacHelpers.ts` : which users each persona sees (`filterUsersForPersona`)
- `src/__tests__/cAdminUserManagement.test.ts` : user visibility and role rules
- `src/views/RolesAndPermissionsView.tsx` : Roles & Permissions screen, behind `ENABLE_ROLES_AND_PERMISSIONS`

## Audit Trail screens
- `src/views/AuditTrailView.tsx` : the Audit Trail page (toolbar, Role filter modal, chips, table, export, pagination)
- `src/components/drawers/AuditTrailDrawer.tsx` : audit drawer mounted in `App.tsx`; no control opens it
- `src/views/VesselDetailView.tsx` : holds a separate Audit Trail tab for one vessel
- `src/utils/rbacHelpers.ts` : `filterAuditTrailForPersona`, which entries each role sees
- `src/types/audit.ts` : audit entry type and the role names
- `src/utils/exportHelpers.ts` : CSV and PDF export used by the list screens

## Docs (`docs/` is gitignored, so these are local only)
- `docs/audit-trail-ui-tasks.md`, `.csv`, `.docx` : 22 Tasks for User Stories 4629 to 4633 under Feature 4627 (3 remove the prototype switchers), with flags and import steps
- `docs/audit-trail-ui-tasks.build.py` : writes those three files and checks them. Run `python docs/audit-trail-ui-tasks.build.py "<UTC time of board check>" "<docx check note>"`
- `docs/user-management-ui-tasks.md`, `.csv`, `.docx` : 27 Tasks for User Stories 4634 to 4638 under Feature 4628 (3 remove the prototype switchers), with flags and import steps
- `docs/user-management-ui-tasks.build.py` : writes those three files from one Task list and checks them. Run `python docs/user-management-ui-tasks.build.py "<UTC time of board check>" "<docx check note>"`. Standard library only
- `docs/projects-ui-tasks.md`, `.csv`, `.docx` : 42 Tasks for User Stories 4592 to 4596 under Feature 4578 (3 remove the prototype switchers), with flags and import steps
- `docs/projects-ui-tasks.build.py` : writes those three files from one Task list and checks them. Run `python docs/projects-ui-tasks.build.py "<UTC time of board check>"`. Standard library only: `lxml` is blocked on Kurt's laptop, so `python-docx` does not load there
- On Kurt's laptop (`C:\Users\Kurt\Documents\MAP-v2\MAPv2`) `docs/` is flat: `assurance-sets-ui-tasks.md` sits in `docs/`, and there is no `work items docs/` folder
- `docs/work items docs/` : Task lists written for Azure Boards, one `.md` and one import `.csv` per Feature
- `docs/work items docs/assurance-sets-ui-tasks.md`, `.csv` : 43 Tasks for User Stories 4617 to 4621 under Feature 4583 (3 remove the prototype switchers), with flags and import steps
- `docs/work items docs/marketplace-ui-tasks.md`, `.csv` : 33 Tasks for User Stories 4612 to 4616 under Feature 4582, with flags and import steps
- `docs/drawer-modal-audit.md` : audit of drawers and modals, the drawer standard, and the record of the drawer shell change
- `docs/azure-boards-colleague-setup-guide.md`, `.docx` : step-by-step guide for connecting Claude Code to the AIUN board through the `azure-devops` MCP server
- `docs/MAP_Assurance_Project_Asset_Architecture.md` : how assurance sets, projects and assets relate
- `docs/multi-org-multi-user-architecture.md` : multi-organization and multi-user model
- `docs/MAP_Continuation_Meeting_Highlights_2026-10-05.md` : latest meeting decisions
- `docs/Tasks.txt`, `docs/Questions.txt`, `docs/Notes.txt` : working notes
- Other `docs/*.md` : one plan or change summary per feature, named by topic

## Project skills and context
- `.agents/skills/map-documentation/SKILL.md` : required format for every file written to `docs/`
- `.agents/skills/map-design-system/` : UI tokens and interaction rules
- `.agents/skills/map-table-standards/` : table layout rules
- `.agents/skills/map-business-rules/` : segregation of duties and approval gates
- `.agents/skills/map-mock-data-schema/`, `.agents/skills/map-data-consistency/` : mock data keys and readiness arithmetic
- `Context Files/` : source requirements (roles, use cases, UI guidelines, data schema)

## Config
- `package.json` : scripts and dependencies
- `tsconfig.json`, `vite.config.ts`, `postcss.config.js` : build config
- `.gitignore` : ignores `docs/`, `dist/`, `node_modules/` and `.env*`
- `.claude/settings.local.json` : local Claude Code permissions, including the deny rules for Azure Boards write tools

## Credentials & tokens (locations only, never values)
- Azure DevOps (AIUN) : no token in the repo. The `azure-devops` MCP server signs in through the browser with the Entra work account. Setup: `docs/azure-boards-colleague-setup-guide.md`
- `.env`, `.env.local` : gitignored. None exists in the repo today.

## Outside the repo
- `C:\mapFiles\MAP` : sibling app with the same package name and layout
- `C:\mapFiles\CoreUI` : CoreUI PRO React admin template (TypeScript)
- `~/.claude/projects/c--mapFiles-MAPv2/memory/` : Claude's project memory
- `~/.claude/plans/` : Claude plan-mode files

## Generated / ignore
- `dist/`, `node_modules/` : generated or vendored, skip when searching
