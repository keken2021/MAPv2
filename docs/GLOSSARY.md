# Marine Assurance Platform

The Marine Assurance Platform lets organizations register marine assets and prove, through Assurance Sets, that an asset is fit for the work it is taken on for. This glossary fixes the words used on the Azure board, in the Task lists and in the code.

## Language

### Organizations and roles

**Organization**:
A company on the platform that owns assets, takes part in Assurance Sets, or both.
_Avoid_: Tenant, company, account

**Membership**:
One person's place in one organization, with the roles they hold there. A person in two organizations has two memberships, each stored as its own user record and linked by a person id. What a person sees and does follows the membership that is active (ADR 0037).
_Avoid_: Multi-org user, shared user, secondary organization

**Current user**:
The user profile currently selected in the sidebar user switcher, scoped to the active persona role picked in the header. Determines stakeholder assignment scoping on assurance sets, vessels, equipment, documents, and audit logs.
_Avoid_: Logged-in user, active persona (persona is the role; current user is the person holding that role)

**Administrator**:
The role that manages one organization. Every organization has it, and what its holder may do is configured for that organization.
_Avoid_: Vessel Administrator, Client Administrator, C Admin, Service Provider Admin, Vessel Provider Admin, Charterer Admin

**Superadmin**:
A planned role above organizations that sets what each organization's Administrator may do.
_Avoid_: Super Administrator, platform admin

**Client**:
The part an organization plays on an Assurance Set when the set is carried out for it.
_Avoid_: Charterer, client organization as a fixed type of organization

**Vessel Provider**:
The part an organization plays on an Assurance Set when it provides the vessel the set covers.
_Avoid_: Service Provider, vessel owner, provider organization as a fixed type of organization

**Crew Provider**:
The part an organization plays on an Assurance Set when it provides the crew members the set covers.
_Avoid_: Service Provider, manning agent

**Equipment Provider**:
The part an organization plays on an Assurance Set when it provides the equipment item the set covers.
_Avoid_: Service Provider, equipment supplier

**Provider**:
The Vessel Provider, Crew Provider or Equipment Provider, where a list mixes asset types.
_Avoid_: Service Provider, supplier, vendor

**Party**:
An organization taking part in an Assurance Set (client, provider, verifier, inspector, or approver) that holds responsibilities or upload tasks.
_Avoid_: Participant, stakeholder organization, tenant

**Organization list**:
Every organization involved in an Assurance Set, listed on its General step. Objects and stakeholders come only from this list. An organization has no type on it: an owner of an object on the set is a Provider, and is the Submitter for its objects (ADR 0032).
_Avoid_: Review channel, participant list

**Scope**:
A named permission that a user holds, written as the thing, the action and the reach, for example `assurance-set:view:own-org`.
_Avoid_: Permission, right, privilege, scope for the asset type of an Assurance Set

**Effective scopes**:
The Scopes a user holds now: those of the user's role, plus active Grants, minus active Revocations.
_Avoid_: Permissions, access rights, role permissions

**Role assignment**:
A time-limited assignment of a role to a user on one Assurance Set or one asset.
_Avoid_: Grant for this meaning, role grant

**Assurance set party role**:
The commercial or contractual relationship an organization holds on a requested assurance set: Requesting party (the organization asking for the assurance set) or Responding party (the organization requested to create and fulfill the set). Held by an organization, not a Role assignment.
_Avoid_: Platform role, workflow role, stakeholder role

**Grant**:
A Scope given to one user for a time, on top of the Scopes of the user's role.
_Avoid_: Role assignment, access share, individual permission

**Revocation**:
A Scope taken from one user for a time, although the user's role holds it.
_Avoid_: Removal, block, denial

### Vessels

**Own vessel**:
A vessel owned by the viewer's organization.
_Avoid_: Owned vessel, fleet vessel

**Chartered vessel**:
A vessel owned by another organization that the viewer reaches through an Assurance Set their organization takes part in, or through an active Grant.
_Avoid_: Vessel under charter, charter vessel

**Availability**:
Whether a vessel can be taken on for work now. It is the value on the vessel card's chip.
_Avoid_: Operating status, status, charter status

**Class**:
The classification society that classes a vessel.
_Avoid_: Class society as a second term, class standing

**Class Status**:
Whether a vessel is in class with its society.
_Avoid_: Class (alone) for this meaning

### Assurance

**Assurance object**:
The target of an assurance audit: a vessel, crew member, equipment item, activity, or tenant custom section that an Assurance Set proves fit for purpose.
_Avoid_: Audited entity, requirement object, asset (when referring to activities)

**Activity**:
An assurance object that is either a procedure or a method (ADR 0036). A procedure is a defined sequence of routine steps to carry out a broader activity in an organization; it lays down a set of instructions for repetitive work, so the work is structured and ambiguity is removed. A method is a prescribed technique or process applied to achieve one specific objective or task; it is narrower in scope, often confined to a single step of a procedure, and gives a standard way to perform that task.
_Avoid_: Procedure or Method as separate object types, Activity scope (retired), activity as a kind of asset

**Asset**:
A vessel, a crew member or an equipment item that an organization registers on the platform.
_Avoid_: Resource, unit, activity as a kind of asset

**Assurance Set**:
The set of requirements that proves one asset is fit for the work it is taken on for. It covers exactly one asset, except a Crew set, which covers one or more crew members (ADR 0023).
_Avoid_: Campaign, vetting, combined set

**Submitter**:
The user who uploads the documents that meet the requirements of an Assurance Set. When a Provider has no Submitter, its Administrator is the Submitter (ADR 0038).
_Avoid_: Uploader, document owner

**Evidence**:
A document or compliance artifact uploaded to meet an Assurance Set requirement.
_Avoid_: Proof file, document object, compliance attachment

**Document Renewal**:
The notification category that tells the Submitter a document on an Assurance Set is expired, expiring, short of the charter window, or that a reviewer asked for a new version.
_Avoid_: Reupload notice, expiry alert, outdated document notification

**Reused document**:
A verified, valid document already on file for a vessel, crew member, or equipment item that automatically fulfills a matching slot when a new Assurance Set is created (ADR 0041). The slot starts Verified and fulfilled, marked with a "Reused from vault" label, and contributes immediately to Readiness. Gap review finding E3 is narrowed: hand-attached documents and newly uploaded evidence still require a Verifier's decision.
_Avoid_: Auto-verified document, pre-approved evidence, inherited document

**Readiness**:
The percentage of requirements met on an Assurance Set, and for a vessel the figure rolled up from its Assurance Sets.
_Avoid_: Assurance percentage, assurance level, readiness index, compliance score

**Compliance**:
The read-only standing derived from Readiness.
_Avoid_: Compliance score, compliance percentage

**Set status**:
Whether an Assurance Set is OK right now, derived and never stored: Go, Conditional or No-go. No-go means something is blocking it, Conditional means it is not there yet or something needs watching, and Go means it is fully closed with nothing outstanding. Any red area means No-go, whatever the Readiness (ADR 0033, proposed).
_Avoid_: Pillar status, traffic light, overall compliance

**Blocking finding**:
An unresolved finding on an Assurance Set that is Rectification Required or past its due date. Findings have no severity, so these two facts decide it.
_Avoid_: Critical finding, major finding

**Task (assurance set)**:
One requirement of an Assurance Set that a user must act on: upload, correct or approve. Tasks are listed in the Tasks table, on the Dashboard, the project Tasks tab and the Assurance Set Tasks tab. Each Task is Pending (no document uploaded yet), On-going (submitted, in review, Correction Requested or Rejected) or Done (completed). Overdue is a flag on the row, not a status. It is not the Azure board work item type Task.
_Avoid_: Needs action, action required, awaiting upload, action item, to-do

**Pillar**:
People, Plant or Process, the platform's own way of organizing requirements. It is not a tag on an Assurance Set and not a filter (ADR 0033, proposed).
_Avoid_: Pillar tag, pillar filter, category tag

### Board work

**Shared Components**:
The Feature "Shared Components UI" (4732) and its User Stories, which build, once, the page parts every screen uses. Story 4617, Page shell and navigation: the page shell, the page states, the header, the side panel and the access helper. List controls and table: the list controls, the modal shell, the table shell, badges and the readiness bar. Overlays and display parts: the drawer shell and the KPI tile row. Theme tokens and component styles (added 2026-10-14, ADR 0013): the tokens in `theme/theme.css` and one CoreUI skin file per component.
_Avoid_: Common build, foundation story, base components

**Shared part**:
One of the page parts that Shared Components builds. A screen Task sets a shared part for its screen and does not build it again.
_Avoid_: Common component, generic component

**Theme token**:
A named design value (a colour, size, radius, shadow, z-index or timing) defined once in `theme/theme.css` as a CSS custom property, for example `--map-color-primary`. Primitive tokens hold raw values; semantic tokens name a role and point at a primitive.
_Avoid_: CSS variable, style constant, hard-coded value

**CoreUI skin file**:
The one file per CoreUI component, `theme/components/<component>.css`, that sets only that component's `--cui-*` variables from semantic Theme tokens. MAP-only patterns go in the `Component.css` beside their React component instead.
_Avoid_: Component stylesheet, override file
