import { describe, expect, it } from 'vitest';
import { MOCK_ASSURANCE_SETS, MOCK_DOCUMENTS, MOCK_USERS } from '../store/mockData';
import { getPersonasForOrganization, pickSessionUserForOrgPersona } from '../utils/demoSessionHelpers';
import { documentsForSessionVerifier } from '../views/VerifierWorkspaceView';
import { isComplianceDeadlineOverdue, toIsoLocalDate } from '../utils/validation';
import { MasterDocument } from '../types/document';

const NORTHWIND = 'Northwind Marine Pty Ltd';
const BUREAU_VERITAS = 'Bureau Veritas Inspectorate';

const getAssuranceSetInfo = (docId: string) => {
  for (const set of MOCK_ASSURANCE_SETS) {
    const req = set.requirements?.find((r) => r.documentId === docId || r.linkedDocumentId === docId);
    if (req) return { set, req };
  }
  return null;
};

const isDocOverdue = (d: MasterDocument) => {
  if (d.verificationStatus === 'Verified') return false;
  const info = getAssuranceSetInfo(d.id);
  if (!info) return false;
  const { set, req } = info;
  if (set.stage === 'Approved' || set.stage === 'Certified' || set.stage === 'Cancelled') return false;
  if (isComplianceDeadlineOverdue(set)) return true;
  const deadline = req.targetDate || set.revisedCompletionDate || set.complianceDeadline || set.targetDate;
  if (!deadline) return false;
  return deadline < toIsoLocalDate();
};

const verifierQueue = (organization: string) => {
  const verifier = pickSessionUserForOrgPersona(MOCK_USERS, organization, 'Verifier');
  return {
    verifier,
    docs: documentsForSessionVerifier(MOCK_DOCUMENTS, MOCK_ASSURANCE_SETS, 'Verifier', organization, verifier),
  };
};

const girardSets = MOCK_ASSURANCE_SETS.filter((set) =>
  set.assignedVerifier?.toLowerCase().includes('s. girard'),
);

/* ADR 0037: S. Girard verifies for Bureau Veritas only; the Northwind Verifier is M. Chen */
describe('Northwind and Bureau Veritas Verifier queues', () => {
  it('makes M. Chen the Northwind Verifier, with no special case for S. Girard', () => {
    expect(getPersonasForOrganization(MOCK_USERS, NORTHWIND)).toContain('Verifier');
    const verifier = pickSessionUserForOrgPersona(MOCK_USERS, NORTHWIND, 'Verifier');
    expect(verifier?.name).toBe('M. Chen');
    expect(verifier?.organization).toBe(NORTHWIND);
  });

  it('makes S. Girard the Bureau Veritas Verifier, as the person in two organizations', () => {
    const verifier = pickSessionUserForOrgPersona(MOCK_USERS, BUREAU_VERITAS, 'Verifier');
    expect(verifier?.id).toBe('USR-244');
    expect(verifier?.organization).toBe(BUREAU_VERITAS);
  });

  it('assigns S. Girard as Bureau Veritas verifier on at least 4 seeded sets with uploaded unverified documents', () => {
    expect(girardSets.length).toBeGreaterThanOrEqual(4);
    for (const set of girardSets) {
      expect(set.assignedVerifier).toBe('S. Girard (Bureau Veritas Inspectorate)');
      const hasUnverifiedUploaded = set.requirements?.some(
        (r) => Boolean(r.documentId) && r.verifierStatus !== 'Verified',
      );
      expect(hasUnverifiedUploaded, `${set.id} has unverified uploaded doc`).toBe(true);
    }
  });

  it('populates the Bureau Veritas Verifier queue with at least 4 To Verify items and exactly 1 Overdue item', () => {
    const { docs } = verifierQueue(BUREAU_VERITAS);
    expect(docs.filter((d) => d.verificationStatus === 'Pending').length).toBeGreaterThanOrEqual(4);
    const overdueDocs = docs.filter(isDocOverdue);
    expect(overdueDocs).toHaveLength(1);
    expect(overdueDocs[0].id).toBe('MAP-VES-2026-STAT-00005');
  });

  it("keeps S. Girard's Bureau Veritas documents out of the Northwind Verifier queue", () => {
    const { docs } = verifierQueue(NORTHWIND);
    const girardSetIds = new Set(girardSets.map((set) => set.id));
    const leaked = docs.filter((d) => {
      const info = getAssuranceSetInfo(d.id);
      return Boolean(info && girardSetIds.has(info.set.id));
    });
    expect(leaked).toEqual([]);
    expect(docs.map((d) => d.id)).not.toContain('MAP-VES-2026-STAT-00005');
  });

  it('ensures no assurance set has the same user as submitter and verifier', () => {
    MOCK_ASSURANCE_SETS.forEach((set) => {
      if (set.assignedSubmitter && set.assignedVerifier) {
        const subName = set.assignedSubmitter.replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase();
        const verName = set.assignedVerifier.replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase();
        expect(subName, `${set.id} submitter !== verifier`).not.toBe(verName);
      }
    });
  });
});
