# MAPv2 UI/UX checklist

Numbered so findings can cite a criterion. Terms are from `docs/GLOSSARY.md`.

## 1. Roles and context

1.1 **Right role, right view.** The screen shows what the viewing role needs: the Administrator manages one organization; on an Assurance Set an organization is the Client or a Provider; the Submitter uploads Evidence. Superadmin is planned, not built.
1.2 **Party is clear.** On an Assurance Set screen the viewer can tell which part their organization plays (Client, Vessel Provider, Crew Provider, Equipment Provider).
1.3 **Own vs chartered.** Vessel lists say whether a vessel is an Own vessel or a Chartered vessel.
1.4 **No switcher dependence.** The screen does not rely on the role, organization or user switchers; they are prototype-only and will be removed.

## 2. Status, safety and trust

2.1 **Set status is the headline.** Go, Conditional or No-go is shown with the theme's status tokens, with a text label, never colour alone. Any red area means No-go, whatever the Readiness.
2.2 **Readiness and Compliance are not mixed up.** Readiness is a percentage of requirements met; Compliance is the read-only standing derived from it. Neither is called a score.
2.3 **Blocking findings visible.** A Blocking finding (Rectification Required or past due) is visible without opening a row or a tab.
2.4 **Glanceable status.** A list row shows its status without opening it.
2.5 **Destructive actions confirm.** Delete, revoke and remove ask for confirmation and name what is lost.
2.6 **Feedback.** Every action acknowledges itself (toast, inline validation, disabled-while-saving).
2.7 **Evidence provenance.** Evidence shows who uploaded it and when, and its expiry when it has one (Document Renewal).

## 3. Navigation and wayfinding

3.1 **Three clicks.** A daily task (open a set, upload Evidence, review a finding) is three clicks or fewer from the landing screen.
3.2 **Where am I.** The header names the current entity and its parent (organization > asset > Assurance Set).
3.3 **Back returns to the referrer.** The HeaderBanner back button returns to the screen the user came from (for example the Assurance Set when opened from CAPA open findings), not a fixed parent.
3.4 **One list, one control row.** Search, filters, sorting and pagination of a list sit together (ADR 0005).

## 4. Density and consistency

4.1 **Declutter.** Every element serves a task for the viewing role; no duplicate counts, decorative KPIs or repeated labels.
4.2 **Tables for the Administrator.** Lists the Administrator works across are dense, sortable tables with sort direction announced on headers.
4.3 **Shared components.** KPI tiles, status chips and headers use the Shared Components, not one-off copies.

## 5. Accessibility and language

5.1 **Contrast.** Text and status chips meet WCAG 2.1 AA (4.5:1 text, 3:1 large text and UI parts).
5.2 **Targets.** Pointer targets at least 24x24 px (WCAG 2.2 2.5.8); touch layouts 44 px.
5.3 **Keyboard and names.** Every control is reachable by keyboard, has a visible focus ring and an accessible name; icon-only buttons have a label.
5.4 **Resize and expansion.** Layout holds at 200% zoom (WCAG 1.4.4) and with labels 30 to 40% longer for translation.
5.5 **Icons have text.** Icons carry a text label wherever space allows.

## Out of prototype scope

Do not report these as violations of the prototype. Mention one only as a production note when the user asks. How each one could be added later is in `docs/plans/future-integration-roadmap.md`.

- Offline-first sync status and offline task completion.
- Bridge night mode (red/black).
- Cryptographic authenticity of documents (hashes, QR verification, watermarks).
- Read-only portals for external authorities and auditors, and API developer UX.
- Shipboard crew tablet flows and a Comfortable/Compact density toggle.
