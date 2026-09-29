/*
  file summary: unit test suite verifying unique unassigned mock certificates in document library across all vessel registration stages.
  responsibilities: validates certificate uniqueness, stage availability, and prevents duplicate document assignments.
  role in system: ensures maritime certificate integrity and compliance rules during vessel onboarding.
*/

import { describe, it, expect } from 'vitest';
import { MOCK_DOCUMENTS, MOCK_VESSELS } from '../store/mockData';
import { MasterDocument } from '../types/document';

describe('unassigned certificates in document library for vessel registration', () => {
  it('ensures all mock documents have unique certificate numbers and unique IDs', () => {
    const ids = MOCK_DOCUMENTS.map((d) => d.id);
    const certNos = MOCK_DOCUMENTS.map((d) => d.certificateNo);

    const uniqueIds = new Set(ids);
    const uniqueCertNos = new Set(certNos);

    expect(uniqueIds.size).toBe(ids.length);
    expect(uniqueCertNos.size).toBe(certNos.length);
  });

  it('provides unassigned mock certificates for all 4 vessel registration stages', () => {
    const unassignedDocs = MOCK_DOCUMENTS.filter(
      (d) => d.entityType === 'Vessel Certificate' && (!d.vesselId || d.vesselId === '')
    );

    expect(unassignedDocs.length).toBeGreaterThanOrEqual(4);

    /* stage 1: registry and class certificates */
    const stage1Docs = unassignedDocs.filter(
      (d) => d.title.includes('Registry') || d.title.includes('Class')
    );
    expect(stage1Docs.length).toBeGreaterThanOrEqual(1);

    /* stage 2: tonnage and construction certificates */
    const stage2Docs = unassignedDocs.filter(
      (d) => d.title.includes('Tonnage') || d.title.includes('Shipbuilder')
    );
    expect(stage2Docs.length).toBeGreaterThanOrEqual(1);

    /* stage 3: doc ism and csr certificates */
    const stage3Docs = unassignedDocs.filter(
      (d) => d.title.includes('ISM') || d.title.includes('Continuous Synopsis')
    );
    expect(stage3Docs.length).toBeGreaterThanOrEqual(1);

    /* stage 4: manning, p&i, and iopp certificates */
    const stage4Docs = unassignedDocs.filter(
      (d) => d.title.includes('Manning') || d.title.includes('P&I') || d.title.includes('IOPP')
    );
    expect(stage4Docs.length).toBeGreaterThanOrEqual(1);
  });

  it('filters out already assigned vessel documents from unassigned intake', () => {
    const isDocumentAttachedToVessel = (doc: MasterDocument): boolean => {
      if (doc.vesselId && doc.vesselId !== '' && doc.vesselId !== 'UNASSIGNED' && doc.vesselId !== 'UNLINKED' && !doc.vesselId.startsWith('VESSEL-PENDING')) {
        if (MOCK_VESSELS.some((v) => v.id === doc.vesselId)) {
          return true;
        }
      }
      if (doc.vesselAttributes?.vesselName) {
        const vName = doc.vesselAttributes.vesselName.trim().toLowerCase();
        if (vName && vName !== 'unassigned' && vName !== 'pending' && MOCK_VESSELS.some((v) => v.name.trim().toLowerCase() === vName)) {
          return true;
        }
      }
      return false;
    };

    const unassignedDocuments = MOCK_DOCUMENTS.filter((d) => {
      if (d.entityType !== 'Vessel Certificate') return false;
      return !isDocumentAttachedToVessel(d);
    });

    /* assigned documents like MAP-VES-2026-STAT-00001 (VESSEL-001) must be excluded */
    const doc001 = unassignedDocuments.find((d) => d.id === 'MAP-VES-2026-STAT-00001');
    expect(doc001).toBeUndefined();

    /* unassigned documents like MAP-DOC-2026-UNAS-00001 must be included */
    const unassigned01 = unassignedDocuments.find((d) => d.id === 'MAP-DOC-2026-UNAS-00001');
    expect(unassigned01).toBeDefined();
  });

  it('prevents selecting the same document more than once across registration stages in a session', () => {
    const unassignedDocuments = MOCK_DOCUMENTS.filter(
      (d) => d.entityType === 'Vessel Certificate' && (!d.vesselId || d.vesselId === '')
    );

    const selectedDocIds: Record<number, string> = {
      1: 'MAP-DOC-2026-UNAS-00001',
    };

    const getAvailableDocsForStep = (stepNumber: number) => {
      return unassignedDocuments.filter((doc) => {
        const isSelectedInOtherStep = Object.entries(selectedDocIds).some(
          ([step, id]) => Number(step) !== stepNumber && id === doc.id
        );
        return !isSelectedInOtherStep;
      });
    };

    /* step 1 can re-select its own selected doc */
    const step1Docs = getAvailableDocsForStep(1);
    expect(step1Docs.some((d) => d.id === 'MAP-DOC-2026-UNAS-00001')).toBe(true);

    /* step 2 must NOT see MAP-DOC-2026-UNAS-00001 because it is already selected in step 1 */
    const step2Docs = getAvailableDocsForStep(2);
    expect(step2Docs.some((d) => d.id === 'MAP-DOC-2026-UNAS-00001')).toBe(false);
  });
});
