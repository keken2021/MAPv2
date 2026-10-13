# PATHS.md: Project Path Directory

> Read this before searching the filesystem. One line per entry: `path` : purpose.
> Paths are relative to the project root unless they start with `~` or a drive letter.
> NEVER put secret values here, only where they are configured.

Last verified: 2026-10-13 (`task-branch` Task notes added: `note` command, `--notes` argument, `.task-notes/` in the MAP-1 clone; same day, `task-branch` skill added: skill folder, ADR 0006, plan record, Skill Spec, MAP-1 clone entries; before that, 2026-10-12: Document Renewal notifications, one asset per set and provider terms added: plan, ADR 0004, glossary, 3 new source files; before that: `docs/` sorted into folders and 13 implemented records removed; colleague setup docs split into connection and comments-uploads sets; the rest as verified on 2026-10-10: docs, glossary, ADR, Marketplace and Vessels entries, Task list .docx files, board-comment skill)
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
- `src/utils/formatters.ts` : dates, status labels, and `getProviderLabel` (Vessel Provider, Crew Provider, Equipment Provider, or Provider)

## Notifications
- `src/views/NotificationsView.tsx`, `src/components/layout/NotificationPanel.tsx`, `src/components/modals/NotificationDetailModal.tsx` : inbox page, header bell panel, detail modal
- `src/types/notification.ts`, `src/store/notificationMockData.ts` : types, categories and their id codes, seeded inbox
- `src/utils/notificationHelpers.ts` : inbox filters, ids, the row action of each type
- `src/utils/documentRenewalHelpers.ts` : Document Renewal category: reason of a document on a set, renewals due, wording. Raised by `raiseDocumentRenewalNotifications` and `requestDocumentReupload` in the store
- `src/__tests__/notifications.test.ts`, `src/__tests__/documentRenewal.test.ts` : notification and renewal rules

## Assurance Sets screens
- `src/views/AssuranceSetsView.tsx` : list screen wrapper
- `src/components/tables/AssuranceTable.tsx` : list screen body (pills, toolbar, filters, table, row actions)
- `src/views/CreateAssuranceSetView.tsx` : create wizard
- `src/utils/assuranceTemplates.ts` : wizard steps, scopes and standard documents; `getAssuranceSetAsset` and `toSingleAssetSet` keep a set to one asset (ADR 0004)
- `src/views/AssuranceDetailView.tsx` : detail screen
- `src/components/drawers/DocumentReviewDrawer.tsx` : document review drawer opened from the detail screen
- `src/types/assurance.ts` : assurance set types
- `src/__tests__/assuranceSetsRoleAccess.test.ts` : role access rules for these screens
- `src/__tests__/oneAssetPerSet.test.ts` : one scope and one covered asset per set, provider terms

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
- `src/components/modals/VesselModal.tsx` : 4-step register modal; `VesselImageCropModal.tsx` is its crop dialog
- `src/views/VesselDetailView.tsx` : detail screen (header, 8 tabs, modals; permission flags by role near L262)
- `src/components/assets/AssetStatusCard.tsx` : availability, registration, class and compliance card on the detail screen
- `src/utils/vesselImageHelpers.ts`, `src/utils/vesselStatusHistoryHelpers.ts` : photo and status chip helpers, status history helpers
- `src/types/vessel.ts`, `src/types/asset.ts` : vessel and asset status types

## Unit tests named in the Task lists
- `src/__tests__/` : all prototype tests. Run a subset with `npx vitest run src/__tests__/<file>`
- Projects: `createProjectWizardOrganization.test.tsx`, `projectComposition.test.ts`, `projectNestedSets.test.ts`, `assuranceSetProjectRelationship.test.ts`, `mockDataConsistency.test.ts`, `notifications.test.ts`
- User Management: `cAdminUserManagement.test.ts`, `userRoleHelpers.test.ts`, `store.test.ts`
- Audit Trail: `permissionHelpers.test.ts`, `notifications.test.ts`, `mockDataBusinessRules.test.ts`, `store.test.ts`
- Switchers and side panel: `demoSessionHelpers.test.ts`, `approverAndSidebar.test.ts`, `store.test.ts`

## Docs (`docs/` is gitignored, so these are local only)
- The `docs/` root holds only `GLOSSARY.md` and folders. Do not save a file at the root. Layout set on 2026-10-12; record: `docs/plans/docs-declutter.md`
- `docs/GLOSSARY.md` : domain terms (Administrator, Client, Vessel Provider, Crew Provider, Equipment Provider, Asset, Assurance Set, Document Renewal, Readiness and others; "Service Provider" is retired). Read it before wording a Task or a doc. It lives here, not at the repo root
- `docs/adr/` : decision records, numbered `0001-...`. 0001 is the Task list layout, 0002 is the one Administrator role, 0003 limits board writes to discussion comments, 0004 is one asset per Assurance Set and the provider terms by asset type, 0005 is one Task for list controls and a Testing entry in each Task, 0006 lets the `task-branch` skill write a Task state and its Branch link (amends 0003)
- `docs/plans/` : plans and audits of work not yet done. New plans go here
- `docs/plans/assurance-sets-tasks-flow-plan.md`, `.docx` : Tasks execution flow plan, 6 hrs/day daily schedule (12 days), and task-branch planning for the 43 Tasks assigned to Creishen Ayuman under Feature 4583; starts at Task 4655
- `docs/plans/document-renewal-and-one-asset-sets.md`, `.docx` : Document Renewal notification category, provider terms by asset type, one asset per set. Built on 2026-10-12, not committed; move to `docs/changes/` once merged. Rebuild the `.docx` with `docs/plans/document-renewal-and-one-asset-sets.build.py` (needs python-docx, which no installed Python has: use a venv; arguments: `docs/azure-boards/board-comment-skill-spec.docx` as style base, then the output path)
- `docs/plans/asset-detail-uniform-layout.md` : shared layout for the vessel, crew and equipment detail screens. Not built (was `docs/plan.md`)
- `docs/plans/australian-maritime-regulatory-gap-analysis.md` : AMSA, DAFF and research fields missing from the modals. Not built
- `docs/changes/` : change summaries of work already done. New ones go here; remove one when nobody needs it
- `docs/changes/EXPLANATION_OF_V3_CHANGES.html` : export that explains the v3 changes (2.9 MB; its `.md` source is gone)
- `docs/architecture/MAP_Assurance_Project_Asset_Architecture.md` : how assurance sets, projects and assets relate
- `docs/architecture/multi-org-multi-user-architecture.md` : multi-organization and multi-user model
- `docs/architecture/drawer-modal-audit.md` : audit of drawers and modals, the drawer standard, and the record of the drawer shell change
- `docs/meetings/MAP_Continuation_Meeting_Highlights_2026-10-05.md`, `.pdf` : latest meeting decisions
- `docs/meetings/Tasks.txt`, `Questions.txt`, `Notes.txt` : working notes
- `docs/work-items/` : Task lists written for Azure Boards, one `.md`, one import `.csv` and one Word `.docx` per Feature (the `.docx` is the Task list in the documentation-docx house style, built from the `.md`; edit the `.md`, then rebuild). Was `docs/work items docs/`
- `docs/work-items/assurance-sets-ui-tasks.md`, `.csv`, `.docx` : 43 Tasks for User Stories 4617 to 4621 under Feature 4583 (3 remove the prototype switchers), with flags and import steps
- `docs/work-items/marketplace-ui-tasks.md`, `.csv`, `.docx` : 33 Tasks for User Stories 4612 to 4616 under Feature 4582, with flags and import steps
- `docs/work-items/vessels-ui-tasks.md`, `.csv`, `.docx` : 44 Tasks for User Stories 4597 to 4601 under Feature 4579 (3 remove the prototype switchers, the same 3 as in the other two files), with flags and import steps
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
- `C:\mapFiles\MAP` : sibling app with the same package name and layout
- `C:\mapFiles\CoreUI` : CoreUI PRO React admin template (TypeScript)
- `~/.claude/skills/board-comment/SKILL.md` : skill that posts branch changes to a work item discussion (`/board-comment [id]`, `/board-comment pr [number] [id]`, `dry` posts nothing)
- `~/.claude/skills/board-comment/scripts/before-after.mjs` : before-and-after screenshots between 2 commits; `shoot.mjs` beside it shoots a running app; `upload.mjs` uploads the PNG files to the board (`--check` tells whether the token is set). First use: `npm install` in that folder
- `~/.claude/skills/board-comment/projects/MAPv2.json` : screen recipe (serve, login, role, 13 screens and their source files). Add a screen here when a new view is built
- `~/.claude/skills/sprint/SKILL.md` : read-only sprint status and standup skill
- `~/.claude/projects/c--mapFiles-MAPv2/memory/` : Claude's project memory
- `~/.claude/plans/` : Claude plan-mode files

## Generated / ignore
- `dist/`, `node_modules/` : generated or vendored, skip when searching
