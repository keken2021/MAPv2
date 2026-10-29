import React from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { AssuranceSet } from '../types/assurance';
import { MasterDocument } from '../types/document';
import { useMapStore } from '../store/useMapStore';
import { DocumentLibraryView, documentsForSessionLibrary } from '../views/DocumentLibraryView';

const document = (id: string): MasterDocument =>
  ({
    id,
    title: `${id} certificate`,
    entityType: 'Vessel Certificate',
    vesselId: 'VESSEL-001',
    certificateNo: id,
    issuingAuthority: 'DNV',
    expiryDate: '2027-01-01',
    ocrConfidence: 96,
    currentVersion: '1.0',
    versions: [],
    complianceState: 'Valid',
    validationRules: {
      charterBufferPassed: true,
      assetMatch100Percent: true,
      iacsAuthorityValid: true,
      overallValid: true,
    },
    verificationStatus: 'Verified',
  }) as MasterDocument;

const setFor = (
  id: string,
  assigneeField: 'assignedVerifier' | 'assignedSubmitter',
  assignee: string,
  documentId: string,
): AssuranceSet =>
  ({
    id,
    title: id,
    [assigneeField]: assignee,
    requirements: [{ id: `REQ-${id}`, documentId, isMandatory: true, isFulfilled: true }],
  }) as unknown as AssuranceSet;

const fontaine = {
  id: 'USR-202',
  name: 'A. Fontaine',
  organization: 'Bureau Veritas Inspectorate',
  roles: ['Verifier' as const],
};

describe('document library per person', () => {
  const mine = document('DOC-MINE');
  const other = document('DOC-OTHER');
  const loose = document('DOC-LOOSE');
  const sets = [
    setFor('AS-MINE', 'assignedVerifier', 'A. Fontaine (Bureau Veritas Inspectorate)', 'DOC-MINE'),
    setFor('AS-OTHER', 'assignedVerifier', 'D. Harrison (Harrison Marine Vetting Services)', 'DOC-OTHER'),
  ];

  it('keeps a verifier library to documents on sets that name them', () => {
    const visible = documentsForSessionLibrary(
      [mine, other, loose],
      sets,
      'Verifier',
      'Bureau Veritas Inspectorate',
      fontaine,
    );
    expect(visible.map((doc) => doc.id)).toEqual(['DOC-MINE']);
  });

  it('keeps a submitter library to documents on sets that name them', () => {
    const visible = documentsForSessionLibrary(
      [mine, other],
      [
        setFor('AS-CHEN', 'assignedSubmitter', 'M. Chen (Northwind Marine Pty Ltd)', 'DOC-MINE'),
        setFor('AS-OTHER', 'assignedSubmitter', 'E. Ramirez (Pacific Ocean Logistics Pty Ltd)', 'DOC-OTHER'),
      ],
      'Submitter',
      'Northwind Marine Pty Ltd',
      { id: 'USR-102', name: 'M. Chen', organization: 'Northwind Marine Pty Ltd', roles: ['Submitter'] },
    );
    expect(visible.map((doc) => doc.id)).toEqual(['DOC-MINE']);
  });

  it('leaves the administrator library unchanged', () => {
    const docs = [mine, other, loose];
    expect(documentsForSessionLibrary(docs, sets, 'Administrator', 'Northwind Marine Pty Ltd', null)).toEqual(docs);
  });

  describe('rendered library', () => {
    beforeEach(() => {
      useMapStore.setState({
        isAuthenticated: true,
        activePersona: 'Verifier',
        activeDemoOrganization: 'Bureau Veritas Inspectorate',
        activeSessionUserId: 'USR-202',
        documents: [mine, other, loose],
        assuranceSets: sets,
      });
    });

    it('shows only the session verifier documents in the library', () => {
      const { container } = render(<DocumentLibraryView />);
      const card = container.querySelector('.map-card-custom') as HTMLElement;
      const tabs = within(card).getByRole('tablist', { name: /document tabs/i });
      expect(within(tabs).getByRole('tab', { name: /all \(1\)/i })).toBeTruthy();
      expect(screen.getByText('DOC-MINE certificate')).toBeTruthy();
      expect(screen.queryByText('DOC-OTHER certificate')).toBeNull();
      expect(screen.queryByText('DOC-LOOSE certificate')).toBeNull();
    });
  });
});
