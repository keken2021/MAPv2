/*
  file summary: AS-04 / AS-05 demo preseed behaviour for Oil Co walkthroughs.
  responsibilities: first 3 template docs stay open; the rest start Submitted; entering Verification auto-verifies pre-seeded rows.
  role in system: vitest coverage for oilCoDemoPreseed helpers and the upload stage flip in useMapStore.
*/

import { beforeEach, describe, expect, it } from 'vitest';
import { useMapStore } from '../store/useMapStore';
import { AssuranceRequirement, AssuranceSet } from '../types/assurance';
import { MasterDocument } from '../types/document';
import { SUBTYPE_TEMPLATES } from '../utils/assuranceTemplates';
import {
  DEMO_OPEN_UPLOAD_COUNT,
  DEMO_PRESEED_TEMPLATE_IDS,
  autoVerifyDemoPreseededRequirements,
  isDemoOpenUploadSlot,
  isDemoPreseedTemplate,
} from '../utils/oilCoDemoPreseed';
import { derivePipelineStage } from '../utils/readinessHelpers';

const initialState = useMapStore.getState();

function buildPreseededSet(templateId: string): {
  set: AssuranceSet;
  documents: MasterDocument[];
  openTitles: string[];
  preseededTitles: string[];
} {
  const template = SUBTYPE_TEMPLATES.find((item) => item.id === templateId)!;
  const tasks = template.customRequirements ?? [];
  const documents: MasterDocument[] = [];
  const requirements: AssuranceRequirement[] = tasks.map((task, index) => {
    const open = isDemoOpenUploadSlot(index);
    if (open) {
      return {
        id: `req-open-${index}`,
        category: 'Process',
        title: task.title,
        isMandatory: true,
        isFulfilled: false,
        ocrConfidence: 0,
        verifierStatus: 'Pending',
      };
    }
    const docId = `DOC-DEMO-TEST-${index}`;
    documents.push({
      id: docId,
      title: task.title,
      entityType: 'Vessel Certificate',
      vesselId: 'VES-DEMO',
      certificateNo: `DEMO-${index}`,
      issuingAuthority: 'Oil Company',
      expiryDate: '2027-11-15',
      ocrConfidence: 96,
      complianceState: 'Valid',
      currentVersion: 'v1.0',
      versions: [
        {
          versionLabel: 'v1.0',
          uploadedAt: '2026-11-15T00:00:00.000Z',
          uploadedBy: 'Oil Company',
          fileSizeBytes: 1000,
          fileName: 'demo.pdf',
          changeSummary: 'Demo document, already submitted',
        },
      ],
      validationRules: {
        charterBufferPassed: true,
        assetMatch100Percent: true,
        iacsAuthorityValid: true,
        overallValid: true,
      },
      verificationStatus: 'Pending',
    });
    return {
      id: `req-pre-${index}`,
      category: 'Process',
      title: task.title,
      isMandatory: true,
      isFulfilled: false,
      ocrConfidence: 96,
      verifierStatus: 'Pending',
      documentId: docId,
      documentVersion: 'v1.0',
      demoPreseeded: true,
      notes: 'Demo pre-seeded upload',
    };
  });

  return {
    set: {
      id: 'AS-DEMO-PRESEED',
      title: template.name,
      assuranceType: 'Vessel',
      vesselId: 'VES-DEMO',
      vesselName: 'Demo Vessel',
      imoNumber: '1234567',
      initiatorOrg: 'Oil Company',
      initiatorRole: 'Vessel Provider Admin',
      charterWindowStart: '2026-11-18',
      complianceDeadline: '2026-11-18',
      charterWindowEnd: '2026-11-20',
      stage: 'Validation',
      readinessScore: 10,
      verificationRequired: true,
      formalApprovalRequired: true,
      mandatoryInspectionRequired: false,
      inspectionCompleted: false,
      requirements,
      assignedSubmitter: 'J. Hale (Oil Company)',
      assignedVerifier: 'N. Brooks (Coastal Fuel Testing)',
      clientOrg: 'Northwind Marine Pty Ltd',
      serviceProviderOrg: 'Oil Company',
    },
    documents,
    openTitles: tasks.slice(0, DEMO_OPEN_UPLOAD_COUNT).map((task) => task.title),
    preseededTitles: tasks.slice(DEMO_OPEN_UPLOAD_COUNT).map((task) => task.title),
  };
}

describe('oil Co AS-04 / AS-05 demo preseed', () => {
  beforeEach(() => {
    useMapStore.setState(initialState, true);
  });

  it('renames the public templates to AS-04 and AS-05', () => {
    expect(SUBTYPE_TEMPLATES.find((t) => t.id === 'tmpl-pub-ss04-bunkering')?.name).toBe(
      'AS-04 Bunkering / Fuel Supply',
    );
    expect(SUBTYPE_TEMPLATES.find((t) => t.id === 'tmpl-pub-ss05-control-systems')?.name).toBe(
      'AS-05 IT / Control Systems',
    );
  });

  it('treats only the AS-04 and AS-05 public templates as demo preseed targets', () => {
    expect(DEMO_PRESEED_TEMPLATE_IDS).toEqual([
      'tmpl-pub-ss04-bunkering',
      'tmpl-pub-ss05-control-systems',
    ]);
    expect(isDemoPreseedTemplate('tmpl-pub-ss04-bunkering')).toBe(true);
    expect(isDemoPreseedTemplate('tmpl-pub-imca-vessel')).toBe(false);
    expect(isDemoOpenUploadSlot(0)).toBe(true);
    expect(isDemoOpenUploadSlot(2)).toBe(true);
    expect(isDemoOpenUploadSlot(3)).toBe(false);
  });

  it('starts with first 3 awaiting upload and the rest Submitted (not Verified)', () => {
    const { set, openTitles, preseededTitles } = buildPreseededSet('tmpl-pub-ss04-bunkering');
    expect(openTitles).toHaveLength(3);
    expect(preseededTitles).toHaveLength(8);
    expect(derivePipelineStage(set)).toBe('Validation');

    const open = set.requirements.filter((req) => openTitles.includes(req.title));
    const preseeded = set.requirements.filter((req) => preseededTitles.includes(req.title));

    expect(open.every((req) => !req.documentId && req.verifierStatus === 'Pending')).toBe(true);
    expect(
      preseeded.every(
        (req) =>
          Boolean(req.documentId) &&
          req.demoPreseeded === true &&
          req.verifierStatus === 'Pending' &&
          req.isFulfilled === false,
      ),
    ).toBe(true);
  });

  it('auto-verifies only pre-seeded rows when Verification begins, leaving live uploads Pending', () => {
    const { set, documents, openTitles, preseededTitles } = buildPreseededSet(
      'tmpl-pub-ss05-control-systems',
    );

    const afterSubmit: AssuranceSet = {
      ...set,
      stage: 'Verification',
      requirements: set.requirements.map((req) =>
        openTitles.includes(req.title)
          ? {
              ...req,
              documentId: `DOC-LIVE-${req.id}`,
              documentVersion: 'v1.0',
              ocrConfidence: 90,
              verifierStatus: 'Pending' as const,
              isFulfilled: false,
            }
          : req,
      ),
    };

    const { set: verifiedSet, documents: verifiedDocs } = autoVerifyDemoPreseededRequirements(
      afterSubmit,
      documents,
    );

    expect(derivePipelineStage(verifiedSet)).toBe('Verification');
    expect(
      verifiedSet.requirements
        .filter((req) => preseededTitles.includes(req.title))
        .every((req) => req.verifierStatus === 'Verified' && req.isFulfilled),
    ).toBe(true);
    expect(
      verifiedSet.requirements
        .filter((req) => openTitles.includes(req.title))
        .every((req) => req.verifierStatus === 'Pending' && !req.demoPreseeded),
    ).toBe(true);
    expect(
      verifiedDocs
        .filter((doc) => preseededTitles.includes(doc.title))
        .every((doc) => doc.verificationStatus === 'Verified'),
    ).toBe(true);
  });

  it('flips pre-seeded uploads to Verified in the store when the last open upload enters Verification', () => {
    const { set, documents, openTitles } = buildPreseededSet('tmpl-pub-ss04-bunkering');
    useMapStore.setState({
      ...initialState,
      documents: [...initialState.documents, ...documents],
      assuranceSets: [...initialState.assuranceSets, set],
      activePersona: 'Submitter',
      activeDemoOrganization: 'Oil Company',
      activeSessionUserId: initialState.users.find(
        (user) => user.organization === 'Oil Company' && user.roles.includes('Submitter'),
      )?.id,
    });

    const openReqs = set.requirements.filter((req) => openTitles.includes(req.title));
    openReqs.forEach((req, index) => {
      useMapStore.getState().uploadDocumentForRequirement(set.id, req.id, {
        id: `DOC-LIVE-${index}`,
        title: req.title,
        entityType: 'Vessel Certificate',
        vesselId: set.vesselId,
        certificateNo: `LIVE-${index}`,
        issuingAuthority: 'Oil Company',
        expiryDate: '2027-11-15',
        ocrConfidence: 92,
        complianceState: 'Valid',
        currentVersion: 'v1.0',
        versions: [
          {
            versionLabel: 'v1.0',
            uploadedAt: '2026-11-15T00:00:00.000Z',
            uploadedBy: 'Oil Company',
            fileSizeBytes: 1000,
            fileName: 'live.pdf',
            changeSummary: 'Live demo upload',
          },
        ],
        validationRules: {
          charterBufferPassed: true,
          assetMatch100Percent: true,
          iacsAuthorityValid: true,
          overallValid: true,
        },
        verificationStatus: 'Pending',
      });
    });

    const after = useMapStore.getState().assuranceSets.find((item) => item.id === set.id)!;
    expect(after.stage).toBe('Verification');
    expect(after.requirements.filter((req) => req.demoPreseeded).every((req) => req.verifierStatus === 'Verified')).toBe(
      true,
    );
    expect(
      after.requirements
        .filter((req) => openTitles.includes(req.title))
        .every((req) => req.verifierStatus === 'Pending' && Boolean(req.documentId)),
    ).toBe(true);
    expect(after.requirements.filter((req) => req.verifierStatus === 'Pending')).toHaveLength(3);
  });
});
