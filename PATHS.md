# PATHS.md: Project Path Directory

> Read this before searching the filesystem. One line per entry: `path` : purpose.
> Paths are relative to the project root unless they start with `~` or a drive letter.
> NEVER put secret values here, only where they are configured.

Last verified: 2026-10-10
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
- `src/components/drawers/` : drawers and modals
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

## Docs (`docs/` is gitignored, so these are local only)
- `docs/assurance-sets-ui-tasks.md` : 40 Tasks for User Stories 4617 to 4621 under Feature 4583, with flags and import steps
- `docs/assurance-sets-ui-tasks.csv` : the same Tasks as an Azure Boards CSV import
- `docs/azure-boards-claude-code-integration.md` : setup record for the `azure-devops` MCP server and its read-only rules
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
- Azure DevOps (AIUN) : no token in the repo. The `azure-devops` MCP server signs in through the browser with the Entra work account. Setup: `docs/azure-boards-claude-code-integration.md`
- `.env`, `.env.local` : gitignored. None exists in the repo today.

## Outside the repo
- `C:\mapFiles\MAP` : sibling app with the same package name and layout
- `C:\mapFiles\CoreUI` : CoreUI PRO React admin template (TypeScript)
- `~/.claude/projects/c--mapFiles-MAPv2/memory/` : Claude's project memory
- `~/.claude/plans/` : Claude plan-mode files

## Generated / ignore
- `dist/`, `node_modules/` : generated or vendored, skip when searching
