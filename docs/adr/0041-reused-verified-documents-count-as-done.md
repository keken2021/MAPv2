---
status: accepted
---

# Reused verified documents count as done

## Context and Decision

The platform is designed to reuse evidence already on file. When an Assurance Set is created, existing verified documents for the set's target object (vessel, crew member, or equipment item) should satisfy matching requirement slots so the Submitter has nothing to upload and the Verifier does not re-verify the same valid certificate.

Previously, `autoAttachDocumentsToRequirements` linked matching documents but left the requirement unfulfilled (`isFulfilled: false`, `verifierStatus: 'Pending'`), in accordance with gap review finding E3 ("attaching or uploading a document never counts as verifying it"). As a result, newly created sets appeared to have open upload/review tasks even when fully valid evidence existed in the vault. Furthermore, matching was performed using fuzzy name comparison, which resulted in mismatched documents (such as crew certificates attached to vessel registry slots).

On 2026-11-13, the requester decided to narrow gap review finding E3 for reused documents:

1. **Reused verified documents start fulfilled and Verified:**
   - A vault document qualifies if `verificationStatus === 'Verified'`, `complianceState !== 'Expired'`, and `expiryDate` is after today.
   - A crew STCW certificate qualifies if `verificationStatus` is `Verified` or `Expiring` and `expiryDate` is after today.
   - When multiple candidates qualify, the candidate with the latest `expiryDate` wins.
   - Reused slots are set to `isFulfilled: true`, `verifierStatus: 'Verified'`, and `reusedDocument: true`.
   - Readiness immediately reflects the verified status (70% requirement weight).
2. **Matching is by exact document type key only:**
   - The key is the catalog ID from `SUBTYPE_STANDARD_DOCS` (e.g. `'vessel-class-cert'`), stored as `docTypeId` on `AssuranceRequirement`, `MasterDocument`, and `STCWDocumentItem`.
   - Slots without `docTypeId` (such as custom/specialized slots) are never auto-attached.
3. **E3 remains strictly in force for non-reused documents:**
   - Any document attached by hand, linked from an existing set, or uploaded during the campaign starts as `Pending` (`isFulfilled: false`) and requires an explicit decision from an assigned Verifier.
4. **Audit and transparency:**
   - `addAssuranceSet` logs one audit event per reused slot with action `"Auto-attached existing document"`, naming the set, the slot, and the document.
   - The requirement row in `AssuranceDetailView` displays a `"Reused from vault"` badge (`ReusedDocumentBadge`).
5. **Vendor-owned evidence rule (A16):**
   - Vault library reuse remains restricted to Vendor-owned evidence via `isReusableLibraryDocument`.

## Considered Options

- **Retain E3 for all attachments (previous behavior):** rejected. Re-verifying every existing valid statutory document imposes redundant work on submitters and verifiers.
- **Match by name with fuzzy fallback:** rejected. False matches allow incorrect certificates to count as done without verification.
- **Backfill existing sets:** rejected. Reuse runs strictly at set creation (including draft saves) to avoid mutating in-flight campaigns.

## Consequences

- Narrows gap review finding E3: reused verified documents count as done, while hand attachments and uploads wait for a Verifier.
- Added `docTypeId` and `reusedDocument` to `AssuranceRequirement`, `MasterDocument`, and `STCWDocumentItem`.
- New UI component `ReusedDocumentBadge` (`src/components/common/ReusedDocumentBadge.tsx`) and extracted row `AssuranceRequirementRow` (`src/components/assurance/AssuranceRequirementRow.tsx`).
- Unit and store tests: `noAutomaticVerification.test.ts` updated to specify the narrowed E3 scope; `reusedDocumentDoneAudit.test.ts` and `reusedDocumentBadge.test.tsx` added.
