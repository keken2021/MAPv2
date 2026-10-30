import { describe, expect, it } from 'vitest';
import { MOCK_ASSURANCE_SETS, MOCK_DOCUMENTS, MOCK_USERS } from '../store/mockData';
import { getPersonasForOrganization, pickSessionUserForOrgPersona } from '../utils/demoSessionHelpers';
import { documentsForSessionVerifier } from '../views/VerifierWorkspaceView';
import { isComplianceDeadlineOverdue, toIsoLocalDate } from '../utils/validation';
import { MasterDocument } from '../types/document';

describe('Northwind Marine Verifier UI Declutter', () => {
  it('switches person when changing from Submitter to Verifier in Northwind Marine', () => {
    const org = 'Northwind Marine Pty Ltd';
    const personas = getPersonasForOrganization(MOCK_USERS, org);
    expect(personas).toContain('Verifier');
    expect(personas).toContain('Submitter');

    const submitter = pickSessionUserForOrgPersona(MOCK_USERS, org, 'Submitter');
    const verifier = pickSessionUserForOrgPersona(MOCK_USERS, org, 'Verifier');

    expect(submitter).toBeDefined();
    expect(verifier).toBeDefined();
    expect(submitter?.name).toBe('M. Chen');
    expect(verifier?.name).toBe('S. Girard');
    expect(verifier?.id).toBe('USR-244');
    expect(verifier?.id).not.toBe(submitter?.id);
  });

  it('assigns S. Girard as verifier on at least 4 seeded sets with uploaded unverified documents', () => {
    const girardSets = MOCK_ASSURANCE_SETS.filter((set) =>
      set.assignedVerifier?.toLowerCase().includes('s. girard'),
    );
    expect(girardSets.length).toBeGreaterThanOrEqual(4);
    for (const set of girardSets) {
      const hasUnverifiedUploaded = set.requirements?.some(
        (r) => Boolean(r.documentId) && r.verifierStatus !== 'Verified',
      );
      expect(hasUnverifiedUploaded, `${set.id} has unverified uploaded doc`).toBe(true);
    }
  });

  it('populates Verifier queue with at least 4 To Verify items and exactly 1 Overdue item', () => {
    const org = 'Northwind Marine Pty Ltd';
    const verifier = pickSessionUserForOrgPersona(MOCK_USERS, org, 'Verifier');
    expect(verifier).toBeDefined();

    const scopedDocs = documentsForSessionVerifier(
      MOCK_DOCUMENTS,
      MOCK_ASSURANCE_SETS,
      'Verifier',
      org,
      verifier,
    );

    const isToVerify = (d: MasterDocument) => d.verificationStatus === 'Pending';
    const toVerifyDocs = scopedDocs.filter(isToVerify);

    expect(toVerifyDocs.length).toBeGreaterThanOrEqual(4);

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

    const overdueDocs = scopedDocs.filter(isDocOverdue);
    expect(overdueDocs).toHaveLength(1);
    expect(overdueDocs[0].id).toBe('MAP-VES-2026-STAT-00005');
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
