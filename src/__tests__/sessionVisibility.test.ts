import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  assigneeMatchesUser,
  isAssuranceSetAssignedToPersona,
  filterAssuranceSetsForSession,
  getVerifierQueueDocumentIds,
  filterDocumentsForVerifierQueue,
} from '../utils/rbacHelpers';
import { useSessionUser } from '../utils/useSessionUser';
import { useMapStore } from '../store/useMapStore';
import { AssuranceSet } from '../types/assurance';
import { MasterDocument } from '../types/document';
import { MOCK_ASSURANCE_SETS } from '../store/mockData';

describe('assigneeMatchesUser', () => {
  it('matches assignee name ignoring trailing organization suffix and case', () => {
    expect(
      assigneeMatchesUser('A. Fontaine (Bureau Veritas Inspectorate)', { name: 'A. Fontaine' }),
    ).toBe(true);
    expect(
      assigneeMatchesUser('a. fontaine (Bureau Veritas Inspectorate)', { name: 'A. FONTAINE' }),
    ).toBe(true);
    expect(
      assigneeMatchesUser('  A. Fontaine  (Southern Basin Energy Pty Ltd) ', { name: ' A. Fontaine ' }),
    ).toBe(true);
    expect(
      assigneeMatchesUser('A. Fontaine', { name: 'A. Fontaine' }),
    ).toBe(true);
  });

  it('rejects partial matches or extended names', () => {
    expect(
      assigneeMatchesUser('A. Fontaineau (Bureau Veritas Inspectorate)', { name: 'A. Fontaine' }),
    ).toBe(false);
    expect(
      assigneeMatchesUser('A. Fontaine (Bureau Veritas Inspectorate)', { name: 'Fontaine' }),
    ).toBe(false);
    expect(
      assigneeMatchesUser('Fontaine (Bureau Veritas Inspectorate)', { name: 'A. Fontaine' }),
    ).toBe(false);
  });

  it('returns false for missing or empty values', () => {
    expect(assigneeMatchesUser(undefined, { name: 'A. Fontaine' })).toBe(false);
    expect(assigneeMatchesUser('A. Fontaine (Bureau Veritas Inspectorate)', undefined)).toBe(false);
    expect(assigneeMatchesUser('A. Fontaine (Bureau Veritas Inspectorate)', { name: '' })).toBe(false);
    expect(assigneeMatchesUser('', { name: 'A. Fontaine' })).toBe(false);
  });
});

describe('session visibility person-only matching per workflow role', () => {
  const baseSet = MOCK_ASSURANCE_SETS[0];
  const testSet: AssuranceSet = {
    ...baseSet,
    serviceProviderOrg: 'Northwind Marine Pty Ltd',
    initiatorOrg: 'Northwind Marine Pty Ltd',
    assignedSubmitter: 'M. Chen (Northwind Marine Pty Ltd)',
    assignedVerifier: 'A. Fontaine (Bureau Veritas Inspectorate)',
    assignedInspector: 'N. Technical (Bureau Veritas Inspectorate)',
    assignedApprover: 'P. Nardelli (Chevron Australia Pty Ltd)',
    mandatoryInspectionRequired: true,
    stage: 'Approval',
    stakeholders: {
      submitterOrg: 'Northwind Marine Pty Ltd',
      verifierOrg: 'Bureau Veritas Inspectorate',
      inspectorOrg: 'Bureau Veritas Inspectorate',
      approverOrg: 'Chevron Australia Pty Ltd',
    },
  };

  describe('Submitter', () => {
    it('matches the assigned person and rejects another submitter from the same org', () => {
      const assignedUser = {
        id: 'USR-SUB-1',
        name: 'M. Chen',
        organization: 'Northwind Marine Pty Ltd',
        roles: ['Submitter' as const],
      };
      const coworkerUser = {
        id: 'USR-SUB-2',
        name: 'E. Ramirez',
        organization: 'Northwind Marine Pty Ltd',
        roles: ['Submitter' as const],
      };

      expect(isAssuranceSetAssignedToPersona(testSet, 'Submitter', undefined, assignedUser)).toBe(true);
      expect(isAssuranceSetAssignedToPersona(testSet, 'Submitter', testSet.initiatorOrg, coworkerUser)).toBe(false);
    });

    it('falls back to organization match when no user is provided', () => {
      expect(isAssuranceSetAssignedToPersona(testSet, 'Submitter', 'Northwind Marine Pty Ltd')).toBe(true);
      expect(isAssuranceSetAssignedToPersona(testSet, 'Submitter', 'Unrelated Corp')).toBe(false);
    });
  });

  describe('Verifier', () => {
    it('matches the assigned person and rejects another verifier from the same org', () => {
      const assignedUser = {
        id: 'USR-VER-1',
        name: 'A. Fontaine',
        organization: 'Bureau Veritas Inspectorate',
        roles: ['Verifier' as const],
      };
      const coworkerUser = {
        id: 'USR-VER-2',
        name: 'J. Dupont',
        organization: 'Bureau Veritas Inspectorate',
        roles: ['Verifier' as const],
      };

      expect(isAssuranceSetAssignedToPersona(testSet, 'Verifier', undefined, assignedUser)).toBe(true);
      expect(isAssuranceSetAssignedToPersona(testSet, 'Verifier', coworkerUser.organization, coworkerUser)).toBe(false);
    });

    it('falls back to organization match when no user is provided', () => {
      expect(isAssuranceSetAssignedToPersona(testSet, 'Verifier', 'Bureau Veritas Inspectorate')).toBe(true);
      expect(isAssuranceSetAssignedToPersona(testSet, 'Verifier', 'Unrelated Corp')).toBe(false);
    });
  });

  describe('Inspector', () => {
    it('matches the assigned person when inspection is required and rejects another inspector from the same org', () => {
      const assignedUser = {
        id: 'USR-INS-1',
        name: 'N. Technical',
        organization: 'Bureau Veritas Inspectorate',
        roles: ['Inspector' as const],
      };
      const coworkerUser = {
        id: 'USR-INS-2',
        name: 'R. Surveyor',
        organization: 'Bureau Veritas Inspectorate',
        roles: ['Inspector' as const],
      };

      expect(isAssuranceSetAssignedToPersona(testSet, 'Inspector', undefined, assignedUser)).toBe(true);
      expect(isAssuranceSetAssignedToPersona(testSet, 'Inspector', coworkerUser.organization, coworkerUser)).toBe(false);
    });

    it('denies access when mandatory inspection is not required, even for the named inspector', () => {
      const noInspectionSet: AssuranceSet = {
        ...testSet,
        mandatoryInspectionRequired: false,
      };
      const assignedUser = {
        id: 'USR-INS-1',
        name: 'N. Technical',
        organization: 'Bureau Veritas Inspectorate',
        roles: ['Inspector' as const],
      };

      expect(isAssuranceSetAssignedToPersona(noInspectionSet, 'Inspector', undefined, assignedUser)).toBe(false);
    });

    it('falls back to organization match when no user is provided', () => {
      expect(isAssuranceSetAssignedToPersona(testSet, 'Inspector', 'Bureau Veritas Inspectorate')).toBe(true);
      expect(isAssuranceSetAssignedToPersona(testSet, 'Inspector', 'Unrelated Corp')).toBe(false);
    });
  });

  describe('Approver', () => {
    it('matches the assigned person when set is awaiting approval and rejects another approver from the same org', () => {
      const assignedUser = {
        id: 'USR-APP-1',
        name: 'P. Nardelli',
        organization: 'Chevron Australia Pty Ltd',
        roles: ['Approver' as const],
      };
      const coworkerUser = {
        id: 'USR-APP-2',
        name: 'K. Decision',
        organization: 'Chevron Australia Pty Ltd',
        roles: ['Approver' as const],
      };

      expect(isAssuranceSetAssignedToPersona(testSet, 'Approver', undefined, assignedUser)).toBe(true);
      expect(isAssuranceSetAssignedToPersona(testSet, 'Approver', coworkerUser.organization, coworkerUser)).toBe(false);
    });

    it('denies access when set is not awaiting approval, even for the named approver', () => {
      const draftSet: AssuranceSet = {
        ...testSet,
        stage: 'Initiated',
        approverDecision: 'Pending',
        requirements: [{
          id: 'REQ-1',
          title: 'Req 1',
          category: 'Vessel',
          isMandatory: true,
          ocrConfidence: 95,
          verifierStatus: 'Pending',
          isFulfilled: false,
        }],
      };
      const assignedUser = {
        id: 'USR-APP-1',
        name: 'P. Nardelli',
        organization: 'Chevron Australia Pty Ltd',
        roles: ['Approver' as const],
      };

      expect(isAssuranceSetAssignedToPersona(draftSet, 'Approver', undefined, assignedUser)).toBe(false);
    });

    it('falls back to organization match when no user is provided', () => {
      expect(isAssuranceSetAssignedToPersona(testSet, 'Approver', 'Chevron Australia Pty Ltd')).toBe(true);
      expect(isAssuranceSetAssignedToPersona(testSet, 'Approver', 'Unrelated Corp')).toBe(false);
    });
  });
});

describe('useSessionUser hook', () => {
  it('returns the active session user and switches when organization changes', () => {
    useMapStore.setState({
      activePersona: 'Submitter',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
      activeSessionUserId: undefined,
    });

    const { result } = renderHook(() => useSessionUser());
    expect(result.current?.name).toBe('M. Chen');
    expect(result.current?.organization).toBe('Northwind Marine Pty Ltd');

    act(() => {
      useMapStore.setState({
        activeDemoOrganization: 'Meridian Marine Services Pty Ltd',
      });
    });

    expect(result.current?.name).toBe('C. Sterling');
    expect(result.current?.organization).toBe('Meridian Marine Services Pty Ltd');
  });
});

describe('filterAssuranceSetsForSession', () => {
  const setA: AssuranceSet = {
    ...MOCK_ASSURANCE_SETS[0],
    id: 'AS-TEST-1',
    assignedSubmitter: 'M. Chen (Northwind Marine Pty Ltd)',
    serviceProviderOrg: 'Northwind Marine Pty Ltd',
    initiatorOrg: 'Northwind Marine Pty Ltd',
  };
  const setB: AssuranceSet = {
    ...MOCK_ASSURANCE_SETS[0],
    id: 'AS-TEST-2',
    assignedSubmitter: 'E. Ramirez (Northwind Marine Pty Ltd)',
    serviceProviderOrg: 'Northwind Marine Pty Ltd',
    initiatorOrg: 'Northwind Marine Pty Ltd',
  };

  it('filters sets for workflow role by matching person when user is given', () => {
    const user = {
      id: 'USR-102',
      name: 'M. Chen',
      organization: 'Northwind Marine Pty Ltd',
      roles: ['Submitter' as const],
    };

    const filtered = filterAssuranceSetsForSession([setA, setB], 'Submitter', 'Northwind Marine Pty Ltd', user);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('AS-TEST-1');
  });

  it('falls back to organization matching when no user is given', () => {
    const filtered = filterAssuranceSetsForSession([setA, setB], 'Submitter', 'Northwind Marine Pty Ltd', null);
    expect(filtered).toHaveLength(2);
  });
});

describe('verifier queue helpers with session user', () => {
  const set1: AssuranceSet = {
    ...MOCK_ASSURANCE_SETS[0],
    id: 'AS-V1',
    assignedVerifier: 'A. Fontaine (Bureau Veritas Inspectorate)',
    stakeholders: { verifierOrg: 'Bureau Veritas Inspectorate' },
    requirements: [
      {
        id: 'REQ-1',
        title: 'Req 1',
        category: 'Vessel',
        isMandatory: true,
        ocrConfidence: 95,
        verifierStatus: 'Pending',
        isFulfilled: false,
        documentId: 'DOC-1',
      },
    ],
  };
  const set2: AssuranceSet = {
    ...MOCK_ASSURANCE_SETS[0],
    id: 'AS-V2',
    assignedVerifier: 'Other Verifier (Bureau Veritas Inspectorate)',
    stakeholders: { verifierOrg: 'Bureau Veritas Inspectorate' },
    requirements: [
      {
        id: 'REQ-2',
        title: 'Req 2',
        category: 'Vessel',
        isMandatory: true,
        ocrConfidence: 95,
        verifierStatus: 'Pending',
        isFulfilled: false,
        documentId: 'DOC-2',
      },
    ],
  };

  const docs = [
    { id: 'DOC-1', title: 'Doc 1' },
    { id: 'DOC-2', title: 'Doc 2' },
  ] as MasterDocument[];

  const userFontaine = {
    id: 'USR-VER-1',
    name: 'A. Fontaine',
    organization: 'Bureau Veritas Inspectorate',
    roles: ['Verifier' as const],
  };

  it('getVerifierQueueDocumentIds narrows IDs to the person when user is given', () => {
    const ids = getVerifierQueueDocumentIds([set1, set2], 'Verifier', 'Bureau Veritas Inspectorate', userFontaine);
    expect(ids.has('DOC-1')).toBe(true);
    expect(ids.has('DOC-2')).toBe(false);
  });

  it('filterDocumentsForVerifierQueue returns only documents for the person when user is given', () => {
    const filtered = filterDocumentsForVerifierQueue(docs, [set1, set2], 'Verifier', 'Bureau Veritas Inspectorate', userFontaine);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('DOC-1');
  });

  it('returns documents for all sets of the organization when no user is given', () => {
    const filtered = filterDocumentsForVerifierQueue(docs, [set1, set2], 'Verifier', 'Bureau Veritas Inspectorate');
    expect(filtered).toHaveLength(2);
  });
});
