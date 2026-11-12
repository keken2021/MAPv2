/*
  file summary: FR-16 evidence ownership and A16 vendor-only reuse.
  responsibilities: unit coverage for documentOwnershipHelpers and related store guards.
  role in system: Sprint 3 tasks 5533 and 5534.
*/

import { describe, expect, it } from 'vitest';
import { useMapStore } from '../store/useMapStore';
import type { MasterDocument } from '../types/document';
import type { AssuranceSet } from '../types/assurance';
import {
  canEditOwnedEvidence,
  canOfferEvidenceReuse,
  getDocumentOwnerOrganization,
  isReusableLibraryDocument,
  isViewerVendorOnSet,
} from '../utils/documentOwnershipHelpers';

const initialState = useMapStore.getState();

const baseDoc = (overrides: Partial<MasterDocument> = {}): MasterDocument => ({
  id: 'DOC-OWN-1',
  title: 'Certificate of Class',
  entityType: 'Vessel Certificate',
  vesselId: 'VES-1',
  certificateNo: 'CLS-1',
  issuingAuthority: 'DNV',
  expiryDate: '2028-01-01',
  ocrConfidence: 95,
  complianceState: 'Valid',
  currentVersion: 'v1.0',
  versions: [
    {
      versionLabel: 'v1.0',
      uploadedAt: '2026-01-01T00:00:00Z',
      uploadedBy: 'USR-VENDOR',
      fileSizeBytes: 1000,
      fileName: 'class.pdf',
      changeSummary: 'initial',
    },
  ],
  validationRules: {
    charterBufferPassed: true,
    assetMatch100Percent: true,
    iacsAuthorityValid: true,
    overallValid: true,
  },
  verificationStatus: 'Verified',
  ownerOrganization: 'Oil Company',
  ...overrides,
});

const bunkerSet = (overrides: Partial<AssuranceSet> = {}): AssuranceSet =>
  ({
    id: 'AS-BUNKER',
    title: 'SS-04 Fuel Supply and Bunkering',
    assuranceType: 'Vessel',
    subtypes: ['Vessel'],
    vesselId: 'VES-OILCO-BUNKER-BARGE',
    vesselName: 'BB Oilco Bunker Barge 01',
    charterWindowStart: '2026-11-18',
    charterWindowEnd: '2027-11-18',
    complianceDeadline: '2026-11-18',
    stage: 'Verification',
    readinessScore: 50,
    mandatoryInspectionRequired: true,
    inspectionCompleted: false,
    verificationRequired: true,
    formalApprovalRequired: true,
    requirements: [],
    visibility: 'organization',
    clientOrg: 'Northwind Marine Pty Ltd',
    serviceProviderOrg: 'Oil Company',
    respondingParty: 'Oil Company',
    requestingParty: 'Northwind Marine Pty Ltd',
    parties: [
      { organization: 'Northwind Marine Pty Ltd', group: 'Client' },
      { organization: 'Oil Company', group: 'Vendor' },
      { organization: 'Coastal Fuel Testing', group: 'Third party' },
    ],
    organizations: ['Northwind Marine Pty Ltd', 'Oil Company', 'Coastal Fuel Testing'],
    ...overrides,
  }) as AssuranceSet;

describe('FR-16 evidence ownership', () => {
  it('resolves ownerOrganization when recorded', () => {
    expect(getDocumentOwnerOrganization(baseDoc())).toBe('Oil Company');
  });

  it('allows the owning organization to edit and blocks another client or third party', () => {
    const doc = baseDoc();
    expect(canEditOwnedEvidence(doc, 'Oil Company')).toBe(true);
    expect(canEditOwnedEvidence(doc, 'Northwind Marine Pty Ltd')).toBe(false);
    expect(canEditOwnedEvidence(doc, 'Coastal Fuel Testing')).toBe(false);
    expect(canEditOwnedEvidence(doc, 'Northwind Marine Pty Ltd', { persona: 'Administrator' })).toBe(false);
    expect(canEditOwnedEvidence(doc, 'Oil Company', { persona: 'Administrator' })).toBe(true);
  });

  it('blocks addDocumentVersion when the active org does not own the evidence', () => {
    useMapStore.setState(initialState, true);
    const doc = baseDoc({ id: 'DOC-FR16-GUARD' });
    useMapStore.setState((s) => ({
      documents: [...s.documents, doc],
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
      activePersona: 'Submitter',
    }));

    const before = useMapStore.getState().documents.find((d) => d.id === doc.id)!;
    expect(before.versions).toHaveLength(1);

    useMapStore.getState().addDocumentVersion(doc.id, 'v1.1', 'new.pdf', 2000, 'attempt');

    const after = useMapStore.getState().documents.find((d) => d.id === doc.id)!;
    expect(after.versions).toHaveLength(1);
    expect(after.currentVersion).toBe('v1.0');
  });
});

describe('A16 evidence reuse vendor-only', () => {
  it('offers reuse only when the viewer is the Vendor on the set', () => {
    const set = bunkerSet();
    expect(isViewerVendorOnSet(set, 'Oil Company')).toBe(true);
    expect(canOfferEvidenceReuse(set, 'Oil Company')).toBe(true);
    expect(canOfferEvidenceReuse(set, 'Northwind Marine Pty Ltd')).toBe(false);
    expect(canOfferEvidenceReuse(set, 'Coastal Fuel Testing')).toBe(false);
  });

  it('reuses Vendor-owned docs and rejects Client or Third party owned docs', () => {
    const set = bunkerSet();
    expect(isReusableLibraryDocument(baseDoc({ ownerOrganization: 'Oil Company' }), set)).toBe(true);
    expect(
      isReusableLibraryDocument(baseDoc({ ownerOrganization: 'Northwind Marine Pty Ltd' }), set),
    ).toBe(false);
    expect(
      isReusableLibraryDocument(baseDoc({ ownerOrganization: 'Coastal Fuel Testing' }), set),
    ).toBe(false);
  });

  it('allows reuse when the client is also the Vendor', () => {
    const set = bunkerSet({
      clientOrg: 'Oil Company',
      requestingParty: 'Oil Company',
      serviceProviderOrg: 'Oil Company',
      respondingParty: 'Oil Company',
      parties: [{ organization: 'Oil Company', group: 'Vendor' }],
    });
    expect(canOfferEvidenceReuse(set, 'Oil Company')).toBe(true);
    expect(isReusableLibraryDocument(baseDoc({ ownerOrganization: 'Oil Company' }), set)).toBe(true);
  });
});
