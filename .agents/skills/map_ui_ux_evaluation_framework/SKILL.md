---
name: map_ui_ux_evaluation_framework
description: Evaluates a MAPv2 prototype screen, flow or view file against Marine Assurance Platform UI/UX criteria (roles, Assurance Set status, navigation, density, accessibility) and returns a findings table. Use for "evaluate this screen", "UX audit of <view>", "review the UX of the assurance wizard", "does this screen work for the Administrator", or any UI/UX review of a MAPv2 view, wireframe or flow.
---

# MAPv2 UI/UX evaluation

Reviews one screen or flow of the MAPv2 prototype at a time and reports where it breaks the criteria in [references/checklist.md](references/checklist.md). It finds problems; it does not edit code.

## Precedence

- Project tokens and `docs/adr/` decisions outrank this skill. A recorded ADR tradeoff is not a finding.
- This skill owns the domain and context criteria. Token, spacing and component rules defer to the `design-system` skill; do not restate them here.
- Words come from `docs/GLOSSARY.md`. Write "Administrator", never Vessel Administrator, Client Administrator or C Admin (ADR 0002).

## How to evaluate

1. **Name the target.** The screen, its view file under `src/views/`, and the role it is viewed as. If no role is given, evaluate as Administrator and say so.
2. **Read before judging.** The view file and the components it renders, the glossary entries for the terms on screen, and the screen's prototype pack in `docs/prototype-packs/<screen-id>/` when one exists (screen ids from `board-comment/projects/MAPv2.json`): `pack.md` for states and roles, `shots/` for screenshots. With no pack, say so under Not checked.
3. **Walk the checklist.** Every section in `references/checklist.md`. Skip a criterion only when it is marked out of prototype scope, and do not report those as violations.
4. **Check each role difference.** The prototype has no role switcher; list what changes on this screen per role (Administrator, Client, Provider, Submitter) and flag any that is missing or wrong.
5. **Report** in the format below. Evidence is `file:line`, never a guess.

## Output

```
Screen: <name> (<view file>) - viewed as <role>

| # | Severity | Criterion | Finding | Evidence | Fix |
|---|---|---|---|---|---|
| 1 | High | 2.3 Blocking findings visible | ... | src/views/X.tsx:120 | ... |

Role differences: <one line per role>
Not checked: <criteria skipped and why>
```

Severity: **High** blocks the task or misstates Set status, Readiness or Compliance; **Medium** adds friction or breaks a convention; **Low** is polish. Sort High first. Keep it to real findings; "no issues" in a section is a valid result.
