# Plan 001: Send Prototype Tasks to MAPv2 `v3` and comment the discussion

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git -C "C:\Users\Kurt\Documents\MAP-v2\MAPv2" diff --stat ac8386b..HEAD -- plans/001-prototype-v3-autopilot.md plans/README.md`
> Expected before you start: no output (those files are new at `ac8386b` and are not in that commit). The skill files are **not** in this git repo. Drift for them is the excerpts in "Current state". If a cited excerpt is not in the live file, STOP.
>
> Do not `git pull`, `git switch`, or `git push` in the MAPv2 clone as part of this plan. Local `v3` was **behind `origin/v3` by 1 commit** when this plan was written, and the worktree had an untracked `.cursorignore`. Leave both alone.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `ac8386b`, 2026-10-28

## Why this matters

`/autopilot` always starts a new `feature/<story id>-<task name>` or `bugfix/...` branch, pushes that branch, and later drafts `pr.md`. Prototype work for this product does not get its own branch. It is committed on the existing `v3` branch of the MAPv2 repository (`https://github.com/keken2021/MAPv2.git`, local clone `C:\Users\Kurt\Documents\MAP-v2\MAPv2`) and explained in the Task discussion after the push.

If this stays as it is, a Prototype Task gets a branch nobody asked for, and the discussion never gets a single comment that says what the Task changed.

## Current state

The live skill package (not inside the MAPv2 git repo):

- `C:\Users\Kurt\.cursor\skills\autopilot\skills\autopilot\SKILL.md` — instructions the agent follows for `/autopilot`.
- `C:\Users\Kurt\.cursor\skills\autopilot\rules\map-task-lifecycle.mdc` — start, commit and push, done (comments + close), pr.
- `C:\Users\Kurt\.cursor\skills\autopilot\autopilot\gate.mjs` — hook. With autopilot on, it allows ordinary pushes and denies push to `main`, `master`, or `development`.
- `C:\Users\Kurt\.cursor\skills\autopilot\autopilot\gate.test.mjs` — `node --test` tests for the gate.
- `C:\Users\Kurt\.cursor\skills\autopilot\autopilot\autopilot.mjs` — prints on/off/task status. The gate, not this file, stores state.
- `C:\Users\Kurt\.cursor\skills\autopilot\autopilot\branch-name.mjs` — builds `feature/<parent>-<slug>`. Leave it. Prototype Tasks do not call it for a branch name. Still use it with `--notes` for the notes folder.
- `C:\Users\Kurt\.cursor\skills\autopilot\hooks.json` — points the hook at `node .cursor/autopilot/gate.mjs`. Do not change it.

There is no second copy. These paths are missing: `C:\Users\Kurt\Documents\MAP-v2\MAPv2\.cursor`, `C:\Users\Kurt\Documents\MAP-v2\.cursor`. The skill text tells the agent to run `node .cursor/autopilot/...` from the workspace, so the MAPv2 clone needs a `.cursor` runtime copy or Step 0 of `/autopilot` cannot start the gate.

MAPv2 git facts at plan time:

- Root: `C:\Users\Kurt\Documents\MAP-v2\MAPv2`
- HEAD: `ac8386b` on branch `v3`
- Remotes: `origin` = `https://github.com/keken2021/MAPv2.git` (HEAD → `origin/main`); `duplicate` = `https://github.com/keken2021/MAPv3.git`
- Branches: `main`, `v3`, `set-2`, `backup/pre-org-demo-switcher`. There is no `development` branch and no `integration/assurance-sets` branch.
- `origin/v3` exists. That is the branch Prototype Tasks push to.

### How a Task branch starts today

From `map-task-lifecycle.mdc` **start**, step 5 (the file's lines 26–27):

```
Act, in order, stop at the first failure: `git fetch origin <base>`; `git switch -c <name> --no-track origin/<base>`; `git push -u origin <name>`; ...
```

**Values** (line 16) still say the development branch is `development` and the pull-request target is `integration/assurance-sets` while it is on `origin`, else `development`. That stays the path for a Task that is not Prototype. Do not retarget those Tasks onto `v3`.

### What the skill tells the agent to push

`SKILL.md` lines 50–63 and 69–71:

```
## Phase 3: execute

- A Task is in play (an ID in the request, or the branch is `feature/<id>-…` / `bugfix/<id>-…`): apply the rule `map-task-lifecycle` now, section **start**, before any code.
...
## Phase 4: verify
...
On a Task branch, once checks pass: `map-task-lifecycle` sections **commit and push**, **done**, then **pr**.

## Hard limits
- `git push --force`, `-f`, `--force-with-lease`, `+refspec`; any push to `main`, `master` or `development`; pushing anything but the current Task branch
```

The hook does **not** implement "pushing anything but the current Task branch". `gate.mjs` `COMMAND_RULES` (lines 42–44) only deny force-push and a push whose ref is `main`, `master`, or `development`. `git push origin v3` is allowed when autopilot is on. `git push origin feature/1-x` is also allowed (see `gate.test.mjs` lines 58–61). Prototype mode has to add a deny, or an agent can still open a feature branch while the hook is on.

### Comments today

**done**, step 3 (`map-task-lifecycle.mdc` lines 37–43) posts one comment per new commit on the Task:

```
`<short>` · `<branch>` · <subject as written>[ (<author> when mine is false)]

<1 to 3 sentences, 50 words max: what is different for the user or the system, glossary words>
```

Lowercase every word the agent writes. Capitals stay only on glossary terms, acronyms, and text copied from git (hash, branch, subject, author). No file path, file name, or code identifier in the body. Board writes allowed on the scoped Task only: state Active or Closed, one Branch link, comment `add` (`map-task-lifecycle.mdc` lines 100–102). `gate.mjs` `scopedBoardWrite` (lines 126–142) allows `wit_work_item_comment_write` only when `action` is `add`, `workItemId` is the scoped Task, and `text` is a non-empty string.

### Gate activation

`gate.mjs` line 32:

```
const ACTIVATION = /^\s*node(?:\.exe)?\s+["']?[^"'\s;|&]*\.cursor[\\/]autopilot[\\/]autopilot\.mjs["']?\s+(on|off|status|task\s+(?:\d+|none))\s*$/i;
```

`applyActivation` (lines 213–217) stores `task` from `task <id>` and does not store a prototype flag.

### Repo conventions the edits must match

- Scripts are plain Node ESM (`.mjs`), no TypeScript, no new dependencies. Tests use `node:test` and `node:assert/strict`, same as `gate.test.mjs`.
- Comments in these scripts are short and lowercase-leaning, matching `branch-name.mjs` and `gate.mjs`.
- Skill prose is imperative and short, matching `SKILL.md`. Do not add a Task id, a badge, or a model name to the skill text.
- Discussion comments that `/autopilot` will write later stay in the style already in **done**. This plan does not post a comment itself.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Gate + prototype tests | `node --test "C:\Users\Kurt\.cursor\skills\autopilot\autopilot\gate.test.mjs" "C:\Users\Kurt\.cursor\skills\autopilot\autopilot\prototype.test.mjs"` | exit 0, all tests pass |
| Existing auth tests (no behavior change expected) | `node --test "C:\Users\Kurt\.cursor\skills\autopilot\autopilot\az-auth.test.mjs"` | exit 0 |
| Classifier smoke | `node "C:\Users\Kurt\.cursor\skills\autopilot\autopilot\prototype.mjs" --title "Prototype row" --parent-title "List" --feature-title "Shell" --tags "" --remote "https://github.com/keken2021/MAP.git"` | stdout exactly `prototype` and exit 0 |
| Non-match smoke | `node "C:\Users\Kurt\.cursor\skills\autopilot\autopilot\prototype.mjs" --title "List - Row actions" --parent-title "Assurance Sets" --feature-title "Shell" --tags "" --remote "https://github.com/keken2021/MAP.git"` | stdout exactly `task-branch` and exit 0 |

Run the tests from any cwd. They import sibling files by relative path; they do not need the MAPv2 `node_modules`. Do not run `npm test` in MAPv2 for this plan. That suite does not cover the skill.

## Scope

**In scope** (the only files you should modify or create):

- `C:\Users\Kurt\.cursor\skills\autopilot\skills\autopilot\SKILL.md`
- `C:\Users\Kurt\.cursor\skills\autopilot\rules\map-task-lifecycle.mdc`
- `C:\Users\Kurt\.cursor\skills\autopilot\autopilot\gate.mjs`
- `C:\Users\Kurt\.cursor\skills\autopilot\autopilot\gate.test.mjs`
- `C:\Users\Kurt\.cursor\skills\autopilot\autopilot\autopilot.mjs`
- `C:\Users\Kurt\.cursor\skills\autopilot\autopilot\prototype.mjs` (create)
- `C:\Users\Kurt\.cursor\skills\autopilot\autopilot\prototype.test.mjs` (create)
- `C:\Users\Kurt\Documents\MAP-v2\MAPv2\.cursor\hooks.json` (create; same JSON as the skill package `hooks.json`)
- `C:\Users\Kurt\Documents\MAP-v2\MAPv2\.cursor\autopilot\` (create; copy of every `.mjs` in the skill `autopilot` folder, including tests, after those files are updated)
- `C:\Users\Kurt\Documents\MAP-v2\MAPv2\.cursor\rules\map-task-lifecycle.mdc` (create; copy of the updated rule)
- `C:\Users\Kurt\Documents\MAP-v2\MAPv2\plans\README.md` (status row only)

**Out of scope** (do NOT touch):

- `branch-name.mjs`, `builds-on.mjs`, `git-facts.mjs`, `az-auth.mjs`, `hooks.json` inside the skill package. `git-facts.mjs` already accepts `--base` and `--target`. The lifecycle text tells the agent which flags to pass. No script change.
- Any application file under `MAPv2\src\`, `package.json`, or `docs\`.
- `.gitignore`, `.cursorignore`, `PATHS.md`.
- The MAP product repository and its Task-branch flow (`development`, `integration/assurance-sets`, `feature/`, `bugfix/`).
- Git state of `v3`: no commit, no pull, no push, no switch.
- Azure Boards. Do not post a comment, change a state, or add a link while executing this plan.

## Git workflow

- The skill package is not a git repo. Leave those edits uncommitted in the user profile. That is the live `/autopilot`.
- The new `MAPv2\.cursor\` tree is untracked. Do not `git add` it. Do not commit `plans/` either unless the operator asked for a commit in the same request that dispatched you. This plan does not ask for a commit.
- Do not create a branch. Stay on whatever branch is already checked out (`v3` at plan time).
- Do not push.

## Steps

### Step 1: Add the Prototype classifier

Create `C:\Users\Kurt\.cursor\skills\autopilot\autopilot\prototype.mjs`.

Export `isPrototype({ title, parentTitle, featureTitle, tags, remote })`. Return true when any of these is true:

- `title`, `parentTitle`, or `featureTitle` matches `/\bprototype\b/i`
- any tag matches that same pattern, after splitting `tags` on `;` or `,` and trimming each piece
The `remote` argument is accepted so the CLI stays stable. It never makes the result true. A Task is Prototype only from its title, its parent User Story title, its parent Feature title, or its tags.

Word boundary matters: `Prototype row` matches; `Prototyping` does not; `prototype's` matches.

CLI, same argument style as `branch-name.mjs` (`--key value` pairs):

```
node prototype.mjs --title "..." --parent-title "..." --feature-title "..." --tags "..." --remote "..."
```

Print `prototype` or `task-branch` and exit 0. Missing `--title` is an error: message on stderr, exit 2. The other flags may be omitted and default to `""`.

Create `prototype.test.mjs` next to it. Cover at least:

- title `Prototype drawer` → true
- title `List - Row actions` → false
- title `Prototyping notes` → false
- parent title `Prototype shell`, task title `List` → true
- feature title `the Prototype`, both others ordinary → true
- tags `ui; Prototype` → true
- tags `prototype-only` → false (hyphen is a word character, so this is one word)
- remote `https://github.com/keken2021/MAPv2.git` with ordinary titles and empty tags → false
- CLI: the two smoke commands in the table above

**Verify**: `node --test "C:\Users\Kurt\.cursor\skills\autopilot\autopilot\prototype.test.mjs"` → exit 0, all pass.

### Step 2: Teach the gate a prototype mode

In `gate.mjs`:

1. Extend `ACTIVATION` so `task <id> prototype` and `task none` still match the whole command, and a chained command still fails the match (the existing test `node .cursor/autopilot/autopilot.mjs on; rm -rf /` must stay `null`). `activationOf` should return `task 4700 prototype` for that command, with the internal whitespace collapsed the way it already collapses `task 4700`.
2. In `applyActivation`, when the activation starts with `task `:
   - `task none` → `task: null`, `prototype: false`
   - `task <id> prototype` → `task: <id>`, `prototype: true`
   - `task <id>` → `task: <id>`, `prototype: false` (a later plain `task` command clears a previous prototype flag)
3. Add `export function prototypePushDenied(command)` used from `shellDenyReason` only when `state?.prototype === true` (add a `state` argument to `shellDenyReason`, or check prototype inside `decide` before returning allow). When the flag is absent or false, every existing allow/deny result stays the same.
4. With the flag true, deny a segment that matches any of:
   - `git switch -c` or `git checkout -b` (creating a branch)
   - `git push` whose command names a ref that is not `v3`. Allow only a push that names `v3` and does not name another branch: `git push origin v3`, `git push -u origin v3`, `git push origin HEAD:v3`. Deny `git push` with no ref, `git push origin`, `git push origin feature/1-x`, `git push origin HEAD:main`, `git push origin v3 feature/1-x`, and `git push --force origin v3` (force is already denied by the earlier rule; keep that order so the reason stays `force push`).
   - Reason strings, so tests can assert them: `prototype tasks do not get a new branch` and `prototype tasks push only v3`.
5. Do not deny `git switch v3`, `git status`, or `git commit` under the prototype flag.

In `autopilot.mjs`, when the action is `task` and `process.argv[3]` is an id and `process.argv[4]` is `prototype`, print one extra clause that board writes are scoped to that Task and pushes are only `v3`. Do not change the `on` / `off` / plain `task <id>` sentences except that plain `task <id>` must keep working.

Extend `gate.test.mjs`:

- `activationOf('node .cursor/autopilot/autopilot.mjs task 4700 prototype')` equals `task 4700 prototype`
- with state `{ on: true, since: new Date().toISOString(), task: '4700', prototype: true }`:
  - deny `git switch -c feature/4617-page-shell`
  - deny `git checkout -b bugfix/1-x`
  - deny `git push origin feature/4617-page-shell`
  - deny `git push origin`
  - allow `git push origin v3`
  - allow `git push -u origin v3`
  - allow `git switch v3`
- with the existing `ON` state (no prototype flag), `git push -u origin feature/4617-page-shell` stays `allow`
- existing deny list and board-write tests stay as they are

**Verify**: the combined `node --test` command in the table → exit 0. Then `node --test` on `az-auth.test.mjs` → exit 0.

### Step 3: Rewrite the lifecycle Prototype path

Edit `map-task-lifecycle.mdc` only. Add a section **Prototype** immediately after **Values**, and point **start** / **commit and push** / **done** / **pr** at it. Keep the non-Prototype steps word for word apart from the one-line pointers below.

**Prototype** section, this decision and these actions:

A Task is Prototype when this prints `prototype`:

```
node .cursor/autopilot/prototype.mjs --title "<Task title>" --parent-title "<User Story title>" --feature-title "<Feature title or empty>" --tags "<System.Tags or empty>" --remote "<git remote get-url origin>"
```

Read the Task with `wit_work_item` `get`, `expand: Relations`, then the parent, then the parent's parent when that item is a Feature. Tags are the Task's `System.Tags` field (empty string when missing). Do not read the description for the word Prototype. A `Prototype:` line in a description is a source pointer, not this signal.

When the result is `task-branch`, follow the existing **start** / **commit and push** / **done** / **pr** path with no other change.

When the result is `prototype`:

1. **Repo.** `git remote get-url origin` must be `https://github.com/keken2021/MAPv2.git` (with or without a trailing `.git`, case-insensitive host). If it is not, **Blocked**: prototype commits go only in `C:\Users\Kurt\Documents\MAP-v2\MAPv2`. Do not create a branch in the other repo. Do not copy files across repos in this step.
2. **Clean tree.** `git status --porcelain` must be empty. If it is not, **Blocked**. Do not stash, do not delete untracked files.
3. **Checkout `v3`, do not create a named Task branch.** `git fetch origin v3`. If `origin/v3` is missing, **Blocked**. If the current branch is not `v3`, `git switch v3`. If local `v3` does not exist, `git switch -c v3 --track origin/v3` is allowed for this one case: it only attaches local `v3` to the existing remote branch. Never `git switch -c feature/...` or `bugfix/...`. Then `git pull --ff-only origin v3`. If fast-forward fails, **Blocked**. Do not merge and do not rebase.
4. **Record the base.** The base hash is `git rev-parse --short HEAD` after the fast-forward, before any new commit. Notes folder still comes from `branch-name.mjs --notes <task id> --title "<Task title>"`. In `changes.md` the branch line is exactly `- Branch: \`v3\`, from \`origin/v3\` at \`<base hash>\``.
5. **Board start.** `node .cursor/autopilot/autopilot.mjs task <task id> prototype`. If the Task has no Branch relation (`url` starting `vstfs:///Git/Ref/`), add one Branch artifact link whose branch name is `v3` (same `wit_work_item_link_write` `add_artifact_link` fields as step 5 of **start**). If a Branch link is already present, do not add another. If state is New, set Active with the same two-op `/rev` update as **start**. Do not push a new branch name.
6. **Commit and push.** After Phase 4 checks pass, commit on `v3` (same staging rules: plan files only, never `.autopilot/`). Push with `git push origin v3` only. No `-u` to another name, no force. Then post the discussion comment in step 7 before **done** closes the Task. A failed check, commit, or push → close stays **Blocked**, Task stays Active.
7. **One discussion comment** on the Task (`wit_work_item_comment_write` `add`, `format: Markdown`), after the push succeeds and before the state moves to Closed. This replaces the per-commit loop in **done** step 3 for a Prototype Task. Do not also post one comment per commit. Body:

```
`<short>` · `v3` · <subject as written>

<1 to 3 sentences, 50 words max, lowercase, what is different for the user or the system>
```

Use the new commits from `node .cursor/autopilot/git-facts.mjs --base <base hash> --target v3 --no-fetch` (`commits` only). One commit: the layout above. Two to 10 commits: one comment, oldest first, each hash line then its sentence, same lowercase rules. More than 10: post the 10 oldest inside that one comment and list the rest as owed in the report. Skip a commit whose 7-character hash is already in `list_comments`. No file path, file name, or code identifier. No screenshots. A failed comment does not block the close; list it as owed.

8. **Close.** The rest of **done** still applies, with these facts required from `git-facts.mjs --base <base hash> --target v3`: `branch` is `v3`, `onOrigin` true, `unpushed` 0, `dirty` empty, `ahead` > 0. `behindTarget` against `integration/assurance-sets` or `development` is not a gate on this path, because those branches are not the destination.
9. **No pull request draft.** Skip **pr**. Do not write `pr.md`. The report says the pull-request draft was skipped because the Task was pushed to `v3`.

Add one sentence at the top of **start**: "If `prototype.mjs` prints `prototype`, follow **Prototype** and skip the rest of this section." Add one sentence at the top of **commit and push**, **done**, and **pr**: "A Prototype Task uses **Prototype** steps 6–9 instead of this section."

**Verify**: `Select-String -Path "C:\Users\Kurt\.cursor\skills\autopilot\rules\map-task-lifecycle.mdc" -Pattern "prototype.mjs","git push origin v3","Skip \*\*pr\*\*"` → at least one hit for each pattern. `Select-String -Path "C:\Users\Kurt\.cursor\skills\autopilot\rules\map-task-lifecycle.mdc" -Pattern "git switch -c <name>"` → still one hit (the non-Prototype path remains).

### Step 4: Point the skill at that path

Edit `SKILL.md`:

- Phase 3 bullet: a Task is in play when an ID is in the request, or the branch is `feature/<id>-…`, `bugfix/<id>-…`, or `v3` during a Prototype Task. Apply `map-task-lifecycle` **start** before any code. **start** either creates the Task branch or, when `prototype.mjs` prints `prototype`, checks out existing `v3` and does not create a branch.
- Phase 4: when `prototype.mjs` printed `prototype`, run **Prototype** steps 6–9 (commit, `git push origin v3`, one discussion comment, close). Do not run **pr**. Otherwise keep "commit and push, done, then pr".
- Phase 5: for a Prototype Task, report the `v3` push, the discussion comment (or that it is owed), and that `pr.md` was not written. Drop the `pr.md` path from that sentence only for this case.
- Hard limits bullet: replace the push clause with: force-push flags stay forbidden; push to `main`, `master`, or `development` stays forbidden; a non-Prototype Task pushes only its Task branch; a Prototype Task pushes only `v3` on the MAPv2 repository (`git push origin v3`) and never creates `feature/` or `bugfix/`.

Do not weaken the other hard-limit bullets.

**Verify**: `Select-String -Path "C:\Users\Kurt\.cursor\skills\autopilot\skills\autopilot\SKILL.md" -Pattern "git push origin v3","prototype.mjs"` → at least one hit each. `Select-String -Path "C:\Users\Kurt\.cursor\skills\autopilot\skills\autopilot\SKILL.md" -Pattern "pushing anything but the current Task branch"` → no hits.

### Step 5: Install the runtime copy in the MAPv2 clone

Copy, after steps 1–4, so the copy includes `prototype.mjs` and the edited gate:

- Skill `hooks.json` → `C:\Users\Kurt\Documents\MAP-v2\MAPv2\.cursor\hooks.json`
- Every file in `C:\Users\Kurt\.cursor\skills\autopilot\autopilot\` → `C:\Users\Kurt\Documents\MAP-v2\MAPv2\.cursor\autopilot\`
- Updated `map-task-lifecycle.mdc` → `C:\Users\Kurt\Documents\MAP-v2\MAPv2\.cursor\rules\map-task-lifecycle.mdc`

Do not copy `SKILL.md` into the repo. Cursor already loads it from `C:\Users\Kurt\.cursor\skills\autopilot\skills\autopilot\SKILL.md`.

**Verify**:

- `node --test "C:\Users\Kurt\Documents\MAP-v2\MAPv2\.cursor\autopilot\gate.test.mjs" "C:\Users\Kurt\Documents\MAP-v2\MAPv2\.cursor\autopilot\prototype.test.mjs"` → exit 0
- `git -C "C:\Users\Kurt\Documents\MAP-v2\MAPv2" status --short -- .cursor plans` → untracked `.cursor` files and the plan files only. No staged files. Branch still `v3`.

### Step 6: Mark the index

Set the 001 row in `plans/README.md` to `DONE`.

**Verify**: `Select-String -Path "C:\Users\Kurt\Documents\MAP-v2\MAPv2\plans\README.md" -Pattern "001"` → the status cell is `DONE`.

## Test plan

- New: `prototype.test.mjs` as listed in step 1, modeled on the `node:test` style of `gate.test.mjs` (no fixtures, no network).
- Extended: `gate.test.mjs` prototype allow/deny cases in step 2. The existing "ordinary commands" and "hard limits" tests must still pass without adding `prototype: true` to `ON`.
- No MAPv2 Vitest test. This change does not touch the app.
- No live Azure call and no live `git push`.

## Done criteria

ALL must hold:

- [ ] `node --test` on the skill-package `gate.test.mjs`, `prototype.test.mjs`, and `az-auth.test.mjs` exits 0
- [ ] The same `node --test` on the copied `.cursor\autopilot` gate and prototype tests exits 0
- [ ] `node ...\prototype.mjs` smoke commands print `prototype` and `task-branch` as in the command table
- [ ] `SKILL.md` no longer contains `pushing anything but the current Task branch`
- [ ] `map-task-lifecycle.mdc` still contains `git switch -c <name>` and also contains `git push origin v3` and an instruction to skip **pr** for a Prototype Task
- [ ] `git -C "C:\Users\Kurt\Documents\MAP-v2\MAPv2" status --short` does not show staged files and does not show modifications under `src\`
- [ ] `git -C "C:\Users\Kurt\Documents\MAP-v2\MAPv2" branch --show-current` is still `v3`
- [ ] `plans/README.md` status row for 001 is `DONE`

## STOP conditions

Stop and report back (do not improvise) if:

- An excerpt in "Current state" is not in the live file (the skill moved).
- `C:\Users\Kurt\.cursor\skills\autopilot\autopilot\gate.mjs` is missing.
- `MAPv2\.cursor` already exists and is not a copy you just wrote. Do not overwrite someone else's hook.
- Making the prototype push rule pass tests would require denying `git push origin v3` or allowing `git push origin feature/1-x` while `prototype` is true.
- The non-Prototype phrase `git switch -c <name>` would have to be removed from `map-task-lifecycle.mdc`.
- A test fails twice after a real fix attempt.
- You believe the remote URL alone should force Prototype mode. It must not. That was rejected on purpose.
- The worktree is not on `v3`, or a command you ran changed HEAD. Do not "fix" that with pull, reset, or push.

## Maintenance notes

- A new place that means "this Task is Prototype" (a custom field, an area path) needs a new argument on `prototype.mjs` plus a test. Do not scan the description for the word. Product Tasks cite prototype files and must keep their `feature/` branches.
- The gate flag is per conversation and turns on only after `node .cursor/autopilot/autopilot.mjs task <id> prototype`. Until that command runs, the hook still allows a feature-branch push. The skill text has to send the agent through **Prototype** before any `git switch -c`.
- Reviewer check: a title `Prototype` matches; a description-only `Prototype:` line does not; `pr.md` is not written; the one comment is on the Task, not the parent; the push command is `git push origin v3`.
- Copying `.cursor` into the clone does not commit it. The next person who commits on `v3` should leave `.cursor/` unstaged unless the team decides to share the hook. `docs/` is gitignored; `.cursor/` is not.
- `git-facts.mjs` on a Prototype close must be called with `--base <hash recorded at checkout>` and `--target v3`. The default merge-base against `integration/assurance-sets` or `development` is wrong here: those refs are absent, and a default range would try to describe every commit on `v3`.
- Local `v3` was behind `origin/v3` by 1, with untracked `.cursorignore`, when this plan was written. The first real `/autopilot` Prototype run will stop at the clean-tree and fast-forward checks until a person updates that clone. The skill must not stash or delete those files.
