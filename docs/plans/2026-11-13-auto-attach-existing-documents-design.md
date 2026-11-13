# Reuse existing documents in new assurance sets (design)

> Written against the `v4` code in `C:\mapFiles\MAPv2`. This file sits in worktree `kind-chatterjee-a09d6e` because the session can't write to the base checkout. Move it to `v4` `docs/plans/` before building.

## Context

The platform is meant to reuse data that is already on file. When a new assurance set is created, any document already held for the set's object should fill the slot that needs it, with nothing left for the Submitter to do.

`v4` already tries this. `autoAttachDocumentsToRequirements` in `src/utils/documentMatchingHelpers.ts` runs when the wizard saves (`CreateAssuranceSetView`) and again in `addAssuranceSet` in `src/store/useMapStore.ts`. The requester does not see it, for two reasons.

1. **An attached slot still looks like open work.** The helper links the document but sets `isFulfilled: false` and `verifierStatus: 'Pending'` (gap review finding E3, guarded by `src/__tests__/noAutomaticVerification.test.ts`). The slot still reads as waiting for someone.
2. **Name matching attaches the wrong documents.** A probe on the `v4` mock data (2026-11-13) found the following:
   - **Wrong document types.** The Flag State Certificate of Registry slot took a crew STCW certificate on MV Pacific Endeavour and an equipment rigging document on MV Coral Titan.
   - **One document filling several slots.** On MV Pacific Endeavour, document `MAP-VES-2026-STAT-00002` filled five different slots: SOLAS, CSSC, CSSEC, ISSC and SMC.
   - **Crew certificates swapped.** A crew Certificate of Competency slot took a medical certificate.
   - **Equipment barely matched.** Two of five equipment items matched nothing. A lifeboat took a crane register. No document in the mock data has `targetObjectType: 'Equipment'`.

**Outcome:** a new set's slot is filled only by the right document for that object, and it starts done.

## Decisions made with the requester (2026-11-13)

1. **A reused document counts as done.** The slot starts fulfilled and Verified. The Submitter has nothing to do, and the Verifier does not re-check it. **This overrides gap review finding E3 for reused documents.**
2. **All object types:** vessels, crew and equipment.
3. **Match by a document type key, not by name.** The key is the catalog id in `SUBTYPE_STANDARD_DOCS` (`src/utils/assuranceTemplates.ts`), for example `vessel-class-cert`. It is stored on the slot and on the document, and only an exact match counts.

## My calls (the requester may correct these)

- **Reuse needs a verified, valid document.**
  - A vault document qualifies when `verificationStatus === 'Verified'`, `complianceState !== 'Expired'` and `expiryDate` is after today.
  - A crew certificate qualifies when its `verificationStatus` is `Verified` or `Expiring` and its `expiryDate` is after today. `Expiring` is a crew certificate's word for "verified, expiring soon".
  - Anything else leaves the slot empty for the Submitter, as today.
- **If several documents match, the latest `expiryDate` wins.**
- **The slot is marked `reusedDocument: true`**, and the set detail shows a "Reused from vault" label on it, so a reviewer can tell it was not uploaded for this set.
- **E3 still holds for everything else.** An upload made for the set, or a document linked by hand, still waits for the Verifier.
- **A16 still holds.** Vault library reuse stays limited to Vendor-owned evidence (`isReusableLibraryDocument` in `src/utils/documentOwnershipHelpers.ts`).
- **Reuse runs once, at creation**, including a saved draft. Existing sets are not backfilled.
- **Each reused slot writes one audit event**, "Auto-attached existing document", naming the set, the slot and the document.

## Goals, non-goals, anti-goals

**Goals**
- A new set starts with every slot filled that a verified, valid document on file can cover, for vessel, crew and equipment sets.
- Those slots count toward readiness as done.

**Non-goals**
- Re-checking a reused document if it expires after the set is created.
- Backfilling sets created before this change.
- Custom requirements (`isSpecialized`) and other slots with no catalog id. They stay manual.

**Anti-goals**
- A wrong document marked as done. This is why name matching goes: once a reused document counts as done, a false match passes a set silently.
- An expired or unverified document counting as done.

## Approaches

1. **Document type key. Picked.** The slot and the document share the catalog id, and the match is exact. It is reliable and easy to test. The cost is tagging the mock documents once.
2. **Name matching, as today.** No data changes are needed, but the probe shows wrong matches. Combined with "counts as done", that would pass sets on the wrong evidence.
3. **Key first, name as fallback.** This would catch more documents, but it keeps the false matches of approach 2 and leaves two rules to maintain.

## How (the builder's guide)

- **Types**
  - `AssuranceRequirement` (`src/types/assurance.ts`): add `docTypeId?: string` and `reusedDocument?: boolean`.
  - `MasterDocument` (`src/types/document.ts`): add `docTypeId?: string`. The object link already exists as `vesselId`, plus `targetObjectType` and `targetObjectId`.
  - `STCWDocumentItem` (`src/types/crew.ts`): add `docTypeId?: string`.
- **Wizard:** every place in `src/views/CreateAssuranceSetView.tsx` that builds a slot from a catalog document sets `docTypeId: doc.id`. Project templates that build slots from the catalog do the same.
- **Matching:** rewrite `findMatchingDocumentForRequirement` in `src/utils/documentMatchingHelpers.ts` to match on `docTypeId`.
  - **Finding the object's documents:**
    - Vessel: vault documents with `vesselId`, or `targetObjectType: 'Vessel'` and `targetObjectId`.
    - Crew: vault documents with `targetObjectType: 'Crew'` and `targetObjectId`, plus the crew member's `layer1CoreDocuments` and `layer2Endorsements`. Every crew member of the set counts (ADR 0023).
    - Equipment: vault documents with `targetObjectType: 'Equipment'` and `targetObjectId`.
  - **Choosing one:** apply the qualifying rules above, then take the latest expiry.
  - **What stays:** keep `matchesVesselRequirement` and `normalizeText`, which `ProjectAddAssetModal` and `AttachAssuranceSetPreviewModal` still use.
- **Counting as done:** in `autoAttachDocumentsToRequirements`, a match sets `documentId`, `linkedDocumentId`, `documentVersion`, `isFulfilled: true`, `verifierStatus: 'Verified'` and `reusedDocument: true`. Slots that already held a document keep the E3 rule.
  - Update `noAutomaticVerification.test.ts`: its first case becomes "a slot with a document attached by hand stays submitted", and a new case covers "a reused document is verified".
- **Audit:** `addAssuranceSet` logs one event per slot with `reusedDocument`.
- **Mock data**
  - Tag vessel vault documents in `src/store/mockData.ts`, and crew certificates in `src/store/crewMockData.ts`, with their `docTypeId`.
  - Add a few verified equipment documents (`targetObjectType: 'Equipment'`) for equipment in `src/store/equipmentMockData.ts`.
  - Keep at least one expired and one pending document, so the demo shows a slot that is not reused.
- **UI:** a `ReusedDocumentBadge` component file, placed on the requirement row of `src/views/AssuranceDetailView.tsx`. Read `.agents/skills/map-design-system/SKILL.md` §12 first. Extract the row if it is inline.
- **Decision record:** a new ADR, "Reused verified documents count as done", that narrows E3, plus a glossary entry for "Reused document" in `docs/GLOSSARY.md`.

## Left to the builder

- Which mock documents get which `docTypeId`.
- The badge's exact look, within the design system.
- Whether `getAssetAutoAttachSummary` shows only reused slots or all attached ones in the wizard.

## Verification

- **`npm test`**
  - The rewritten matching tests: exact key, expired, pending, latest expiry wins, and each object type.
  - The updated E3 test.
  - `assetDocumentAutoAttachment.test.ts` updated to the key rule.
  - A new end-to-end test that creates a vessel set, a crew set and an equipment set and checks the filled slots.
- **`npm run build`:** the type check passes.
- **In the app:**
  - Create a set for a vessel with a verified Certificate of Class. The slot shows Verified with "Reused from vault", and readiness goes up.
  - A slot whose document on file is expired stays empty, for the Submitter.
