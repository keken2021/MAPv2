/*
  file summary: object verification status and client evidence separation.
  responsibilities: verifies the four statuses, an internal self-check, an external review, and that one client does not see another client's documents.
  role in system: covers documentVersionSnapshot.ts and rbacHelpers.ts.
*/

import { describe, expect, it } from 'vitest';
import { AssuranceSet } from '../types/assurance';
import { MasterDocument } from '../types/document';
import { deriveObjectVerification } from '../utils/documentVersionSnapshot';
import { filterDocumentsVisibleToOrganization } from '../utils/rbacHelpers';

const baseSet = (overrides: Partial<AssuranceSet>): AssuranceSet =>
  ({
    id: 'AS-OBJ-1',
    title: 'Object verification',
    vesselId: 'VESSEL-OBJ',
    vesselName: 'Test Vessel',
    imoNumber: '1000001',
    initiatorOrg: 'Oil Company',
    initiatorRole: 'C Admin · Client Created',
    clientOrg: 'Oil Company',
    charterer: 'Oil Company',
    charterWindowStart: '2026-11-01',
    complianceDeadline: '2026-11-01',
    charterWindowEnd: '2027-06-01',
    stage: 'Verification',
    readinessScore: 10,
    mandatoryInspectionRequired: false,
    inspectionCompleted: false,
    requirements: [
      {
        id: 'REQ-OBJ-1',
        category: 'Statutory Certificate',
        title: 'Certificate of Class',
        isMandatory: true,
        isFulfilled: true,
        ocrConfidence: 90,
        documentId: 'DOC-CLIENT-A',
        verifierStatus: 'Pending',
      },
    ],
    ...overrides,
  }) as AssuranceSet;

const document = (id: string): MasterDocument =>
  ({
    id,
    title: id,
    vesselId: 'VESSEL-OBJ',
  }) as MasterDocument;

describe('object verification status', () => {
  it('moves from uploaded, to an internal self-check, to an external review', () => {
    const uploaded = deriveObjectVerification('VESSEL-OBJ', [baseSet({})], 'Oil Company');
    expect(uploaded?.status).toBe('Uploaded, not externally verified');
    expect(uploaded?.channel).toBeUndefined();

    const selfCheck = deriveObjectVerification(
      'VESSEL-OBJ',
      [
        baseSet({
          reviewMode: 'internal',
          assignedVerifier: 'A. Okonkwo (Oil Company)',
          sentForReviewAt: '2026-11-02T00:00:00.000Z',
          requirements: [
            {
              id: 'REQ-OBJ-1',
              category: 'Statutory Certificate',
              title: 'Certificate of Class',
              isMandatory: true,
              isFulfilled: true,
              ocrConfidence: 90,
              documentId: 'DOC-CLIENT-A',
              verifierStatus: 'Verified',
            },
          ],
        }),
      ],
      'Oil Company',
    );
    expect(selfCheck?.status).toBe('Submitted and tested');
    expect(selfCheck?.channel).toBe('internal');
    expect(selfCheck?.verifiedBy).toBe('A. Okonkwo (Oil Company)');
    expect(selfCheck?.verifiedAt).toBe('2026-11-02T00:00:00.000Z');

    const external = deriveObjectVerification(
      'VESSEL-OBJ',
      [
        baseSet({
          reviewMode: 'third_party',
          assignedVerifier: 'L. Ferreira (XY Marine Assurance)',
          requirements: [
            {
              id: 'REQ-OBJ-1',
              category: 'Statutory Certificate',
              title: 'Certificate of Class',
              isMandatory: true,
              isFulfilled: true,
              ocrConfidence: 90,
              documentId: 'DOC-CLIENT-A',
              verifierStatus: 'Verified',
            },
          ],
        }),
      ],
      'Oil Company',
    );
    expect(external?.status).toBe('Tested externally');
    expect(external?.channel).toBe('external');
    expect(external?.verifiedBy).toBe('L. Ferreira (XY Marine Assurance)');
  });

  it('marks several entities and hides the other client documents', () => {
    const oil = baseSet({
      reviewMode: 'third_party',
      assignedVerifier: 'L. Ferreira (XY Marine Assurance)',
      requirements: [
        {
          id: 'REQ-OBJ-1',
          category: 'Statutory Certificate',
          title: 'Certificate of Class',
          isMandatory: true,
          isFulfilled: true,
          ocrConfidence: 90,
          documentId: 'DOC-CLIENT-A',
          verifierStatus: 'Verified',
        },
      ],
    });
    const shell = baseSet({
      id: 'AS-OBJ-2',
      clientOrg: 'Shell Australia Pty Ltd',
      charterer: 'Shell Australia Pty Ltd',
      initiatorOrg: 'Shell Australia Pty Ltd',
      reviewMode: 'internal',
      assignedVerifier: 'T. Marlowe (Shell Australia Pty Ltd)',
      serviceProviderOrg: 'Gulf Security Services Pty Ltd',
      requirements: [
        {
          id: 'REQ-OBJ-2',
          category: 'Crew Credential',
          title: 'Able Seafarer Deck Certificate',
          isMandatory: true,
          isFulfilled: true,
          ocrConfidence: 90,
          documentId: 'DOC-CLIENT-B',
          verifierStatus: 'Verified',
        },
      ],
    });

    const seenByOil = deriveObjectVerification('VESSEL-OBJ', [oil, shell], 'Oil Company');
    expect(seenByOil?.status).toBe('Used and tested by several entities over time');
    expect(seenByOil?.channel).toBe('external');
    expect(seenByOil?.verifiedBy).toContain('XY Marine Assurance');

    const seenByShell = deriveObjectVerification('VESSEL-OBJ', [oil, shell], 'Shell Australia Pty Ltd');
    expect(seenByShell?.channel).toBe('internal');
    expect(seenByShell?.verifiedBy).toContain('Shell Australia Pty Ltd');

    const documents = [document('DOC-CLIENT-A'), document('DOC-CLIENT-B')];
    expect(filterDocumentsVisibleToOrganization(documents, [oil, shell], 'Oil Company').map((item) => item.id)).toEqual([
      'DOC-CLIENT-A',
    ]);
    expect(filterDocumentsVisibleToOrganization(documents, [oil, shell], 'Shell Australia Pty Ltd').map((item) => item.id)).toEqual([
      'DOC-CLIENT-B',
    ]);
  });
});
