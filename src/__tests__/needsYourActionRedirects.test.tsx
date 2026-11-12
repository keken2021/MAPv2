import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../App';
import { useMapStore } from '../store/useMapStore';
import { AssuranceSet } from '../types/assurance';
import { CapaItem } from '../types/capa';
import { MasterDocument } from '../types/document';
import { UserRolePersona } from '../types/audit';

const FIXED_NOW = new Date('2026-11-05T12:00:00Z');

const initialStoreSnapshot = {
  assuranceSets: useMapStore.getState().assuranceSets,
  documents: useMapStore.getState().documents,
  capaItems: useMapStore.getState().capaItems,
  notifications: useMapStore.getState().notifications,
  projects: useMapStore.getState().projects,
  auditEvents: useMapStore.getState().auditEvents,
  activePersona: useMapStore.getState().activePersona,
  activeDemoOrganization: useMapStore.getState().activeDemoOrganization,
  activeSessionUserId: useMapStore.getState().activeSessionUserId,
  currentHashView: useMapStore.getState().currentHashView,
  currentEntityId: useMapStore.getState().currentEntityId,
  previousHashView: useMapStore.getState().previousHashView,
  previousEntityId: useMapStore.getState().previousEntityId,
  isAuthenticated: useMapStore.getState().isAuthenticated,
};

function makeDoc(overrides: Partial<MasterDocument>): MasterDocument {
  return {
    id: 'DOC-E2E-1',
    title: 'Safety Equipment Certificate',
    certificateNo: 'CERT-E2E-100',
    entityType: 'Vessel Certificate',
    vesselId: 'VESSEL-001',
    issuingAuthority: 'DNV',
    expiryDate: '2027-11-01',
    ocrConfidence: 99,
    currentVersion: 'v1.0',
    verificationStatus: 'Verified',
    complianceState: 'Valid',
    ownerOrganization: 'Northwind Marine Pty Ltd',
    versions: [
      {
        versionLabel: 'v1.0',
        fileName: 'safety-cert-v1.pdf',
        uploadedAt: '2026-10-01T10:00:00Z',
        uploadedBy: 'M. Chen',
        fileSizeBytes: 1500000,
        changeSummary: 'Initial upload',
      },
    ],
    validationRules: {
      charterBufferPassed: true,
      assetMatch100Percent: true,
      iacsAuthorityValid: true,
      overallValid: true,
      rulesNotChecked: false,
    },
    vesselAttributes: {
      title: 'Safety Equipment Certificate',
      status: 'Valid',
      certificateNumber: 'CERT-E2E-100',
      certType: 'Vessel Certificate',
      issuingBody: 'DNV',
      issueDate: '2025-11-01',
      expiryDate: '2027-11-01',
      vesselName: 'MV Pacific Endeavour',
      imoNumber: '9123453',
      flagState: 'Australia',
      lastSurveyDate: '2026-01-10',
      ocrConfidence: 99,
      assetMatchFlag: true,
    },
    ...overrides,
  };
}

function makeReq(overrides: Partial<import('../types/assurance').AssuranceRequirement>): import('../types/assurance').AssuranceRequirement {
  return {
    id: 'REQ-E2E-DEFAULT',
    title: 'Default Requirement',
    category: 'Class & Statutory',
    isMandatory: true,
    isFulfilled: false,
    ocrConfidence: 99,
    verifierStatus: 'Pending',
    ...overrides,
  };
}

function makeSet(overrides: Partial<AssuranceSet>): AssuranceSet {
  return {
    id: 'AS-E2E-1',
    title: 'Gorgon OSV Compliance',
    vesselId: 'VESSEL-001',
    vesselName: 'MV Pacific Endeavour',
    imoNumber: '9123453',
    clientOrg: 'Southern Basin Energy Pty Ltd',
    initiatorOrg: 'Southern Basin Energy Pty Ltd',
    initiatorRole: 'Client Admin',
    requestingParty: 'Southern Basin Energy Pty Ltd',
    serviceProviderOrg: 'Northwind Marine Pty Ltd',
    respondingParty: 'Northwind Marine Pty Ltd',
    stage: 'Verification',
    readinessScore: 70,
    approverDecision: 'Pending',
    mandatoryInspectionRequired: false,
    inspectionCompleted: false,
    assignedSubmitter: 'M. Chen (Northwind Marine Pty Ltd)',
    assignedVerifier: 'A. Fontaine (Bureau Veritas Inspectorate)',
    assignedApprover: 'P. Nardelli (Marine Assurance Authority)',
    targetDate: '2026-11-10T00:00:00Z',
    complianceDeadline: '2026-11-10T00:00:00Z',
    charterWindowStart: '2026-11-01',
    charterWindowEnd: '2027-11-01',
    requirements: [],
    ...overrides,
  };
}

function makeCapa(overrides: Partial<CapaItem>): CapaItem {
  return {
    id: 'CAPA-E2E-1',
    assuranceSetId: 'AS-E2E-1',
    vesselId: 'VESSEL-001',
    vesselName: 'MV Pacific Endeavour',
    title: 'Emergency fire pump pressure low',
    checklistItemTitle: 'Fire Fighting Appliances',
    findingDescription: 'Tested discharge pressure below minimum SOLAS requirement.',
    owner: 'Chief Engineer',
    dueDate: '2026-11-08T00:00:00Z',
    createdDate: '2026-11-01T00:00:00Z',
    status: 'Open',
    evidences: [],
    ...overrides,
  };
}

function mountDashboardAs(
  persona: UserRolePersona,
  organization: string,
  sessionUserId: string,
  overrides: Partial<ReturnType<typeof useMapStore.getState>>,
) {
  sessionStorage.clear();
  window.location.hash = '#/dashboard';
  useMapStore.setState({
    ...initialStoreSnapshot,
    ...overrides,
    isAuthenticated: true,
    activePersona: persona,
    activeDemoOrganization: organization,
    activeSessionUserId: sessionUserId,
    currentHashView: 'dashboard',
    currentEntityId: undefined,
  });
  return render(<App />);
}

function clickNeedsActionButtonForRow(rowText: RegExp, buttonName: string | RegExp) {
  const section = screen.getByTestId('needs-your-action-section');
  const rows = within(section).getAllByTestId('action-item-row');
  const targetRow = rows.find((row) => rowText.test(row.textContent || ''));
  expect(targetRow).toBeDefined();
  const btn = within(targetRow!).getByRole('button', { name: buttonName });
  fireEvent.click(btn);
}

describe('Dashboard "Needs your action" end-to-end redirects across all personas', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(FIXED_NOW);
    sessionStorage.clear();
    window.location.hash = '#/dashboard';
  });

  afterEach(() => {
    vi.useRealTimers();
    sessionStorage.clear();
    window.location.hash = '#/dashboard';
    useMapStore.setState(initialStoreSnapshot);
  });

  it('C Admin: Assign routes to Details tab and highlights Stakeholders section without access denied', () => {
    const cAdminSet = makeSet({
      id: 'AS-CADMIN-E2E',
      title: 'Basin Charter Setup',
      createdByUserId: 'USR-201',
      createdByName: 'S. Basin',
      assignedVerifier: '',
      assignedApprover: '',
      mandatoryInspectionRequired: false,
    });

    mountDashboardAs('C Admin', 'Southern Basin Energy Pty Ltd', 'USR-201', {
      assuranceSets: [cAdminSet],
      documents: [],
      capaItems: [],
      notifications: [],
    });

    clickNeedsActionButtonForRow(/Basin Charter Setup/i, 'Assign');

    expect(screen.queryByRole('heading', { name: /you don't have access/i })).toBeNull();
    expect(useMapStore.getState().currentHashView).toBe('assurance-sets');
    expect(useMapStore.getState().currentEntityId).toBe('AS-CADMIN-E2E');

    const detailsTab = screen.getByRole('tab', { name: /^Details/i });
    expect(detailsTab).toHaveAttribute('aria-selected', 'true');

    const stakeholdersSection = screen.getByTestId('assurance-stakeholders-section');
    expect(stakeholdersSection.className).toContain('border-primary');
  });

  it('Administrator: Assign, Re-upload (unblocked returned verified doc), Renew (DocumentDetailView), and Respond (CapaReinspectionDrawer) all land on actionable targets', () => {
    const returnedVerifiedDoc = makeDoc({
      id: 'DOC-ADM-RET',
      title: 'Load Line Certificate',
      verificationStatus: 'Verified',
      expiryDate: '2027-08-01',
    });
    const expiringDoc = makeDoc({
      id: 'DOC-ADM-EXP',
      title: 'Radio Station License',
      certificateNo: 'RAD-2026-99',
      verificationStatus: 'Verified',
      expiryDate: '2026-12-01',
    });
    const assignSet = makeSet({
      id: 'AS-ADM-ASSIGN',
      title: 'Anchor Charter Prep',
      createdByUserId: 'USR-101',
      createdByName: 'K. Osei',
      assignedSubmitter: '',
      stage: 'Validation',
    });
    const workSet = makeSet({
      id: 'AS-ADM-WORK',
      title: 'Primary Compliance Set',
      createdByUserId: 'USR-101',
      createdByName: 'K. Osei',
      requirements: [
        makeReq({
          id: 'REQ-ADM-RET',
          title: 'Load Line Certificate',
          category: 'Class & Statutory',
          isFulfilled: false,
          verifierStatus: 'Correction Requested',
          documentId: 'DOC-ADM-RET',
          notes: 'Scan blurry on stamp',
        }),
        makeReq({
          id: 'REQ-ADM-EXP',
          title: 'Radio Station License',
          category: 'Class & Statutory',
          isFulfilled: true,
          verifierStatus: 'Verified',
          documentId: 'DOC-ADM-EXP',
        }),
      ],
    });
    const adminCapa = makeCapa({
      id: 'CAPA-ADM-1',
      assuranceSetId: 'AS-ADM-WORK',
      title: 'Rescue boat davit hook worn',
    });

    const storePayload = {
      assuranceSets: [assignSet, workSet],
      documents: [returnedVerifiedDoc, expiringDoc],
      capaItems: [adminCapa],
      notifications: [],
    };

    // 1. Assign -> Details tab + Stakeholders section
    const { unmount: unmount1 } = mountDashboardAs('Administrator', 'Northwind Marine Pty Ltd', 'USR-101', storePayload);
    clickNeedsActionButtonForRow(/Anchor Charter Prep/i, 'Assign');
    expect(screen.queryByRole('heading', { name: /you don't have access/i })).toBeNull();
    expect(screen.getByRole('tab', { name: /^Details/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('assurance-stakeholders-section').className).toContain('border-primary');
    unmount1();

    // 2. Re-upload -> Tasks tab, Reupload button opens DocumentUploadModal without reupload block
    const { unmount: unmount2 } = mountDashboardAs('Administrator', 'Northwind Marine Pty Ltd', 'USR-101', storePayload);
    clickNeedsActionButtonForRow(/Load Line Certificate/i, 'Re-upload');
    expect(screen.queryByRole('heading', { name: /you don't have access/i })).toBeNull();
    expect(screen.getByRole('tab', { name: /^Tasks/i })).toHaveAttribute('aria-selected', 'true');
    const reuploadActionBtn = screen.getByTestId('task-action-btn-REQ-ADM-RET');
    expect(reuploadActionBtn).toHaveTextContent('Reupload');
    fireEvent.click(reuploadActionBtn);
    expect(screen.getByRole('heading', { name: /upload new version/i })).toBeInTheDocument();
    expect(screen.queryByTestId('reupload-blocked-alert')).toBeNull();
    unmount2();

    // 3. Renew -> DocumentDetailView directly for DOC-ADM-EXP
    const { unmount: unmount3 } = mountDashboardAs('Administrator', 'Northwind Marine Pty Ltd', 'USR-101', storePayload);
    clickNeedsActionButtonForRow(/Radio Station License/i, 'Renew');
    expect(screen.queryByRole('heading', { name: /you don't have access/i })).toBeNull();
    expect(useMapStore.getState().currentHashView).toBe('documents');
    expect(useMapStore.getState().currentEntityId).toBe('DOC-ADM-EXP');
    expect(screen.getByRole('heading', { name: /Radio Station License/i })).toBeInTheDocument();
    expect(screen.getByText('RAD-2026-99')).toBeInTheDocument();
    unmount3();

    // 4. Respond -> CapaManagementView with CapaReinspectionDrawer auto-opened
    mountDashboardAs('Administrator', 'Northwind Marine Pty Ltd', 'USR-101', storePayload);
    clickNeedsActionButtonForRow(/Rescue boat davit hook worn/i, 'Respond');
    expect(screen.queryByRole('heading', { name: /you don't have access/i })).toBeNull();
    expect(useMapStore.getState().currentHashView).toBe('capa');
    expect(useMapStore.getState().currentEntityId).toBe('CAPA-ADM-1');
    expect(screen.getByTestId('capa-reinspection-drawer')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Rescue boat davit hook worn/i })).toBeInTheDocument();
  });

  it('Submitter: Re-upload, Finding Respond (straight to set tasks tab + drawer + response submit), Missing Upload, and Expiring Renew all complete end-to-end', () => {
    const returnedVerifiedDoc = makeDoc({
      id: 'DOC-SUB-RET',
      title: 'Safety Management Certificate',
      verificationStatus: 'Verified',
      expiryDate: '2027-06-01',
    });
    const expiringDoc = makeDoc({
      id: 'DOC-SUB-EXP',
      title: 'Cargo Ship Safety Radio',
      certificateNo: 'CSR-2026-55',
      verificationStatus: 'Verified',
      expiryDate: '2026-11-28',
    });
    const subSet = makeSet({
      id: 'AS-SUB-E2E',
      title: 'Northwind Charter Package',
      mandatoryInspectionRequired: true,
      assignedInspector: 'N. Technical (Bureau Veritas Inspectorate)',
      requirements: [
        makeReq({
          id: 'REQ-SUB-RET',
          title: 'Safety Management Certificate',
          category: 'Class & Statutory',
          isFulfilled: false,
          verifierStatus: 'Correction Requested',
          documentId: 'DOC-SUB-RET',
          notes: 'Missing master signature page',
        }),
        makeReq({
          id: 'REQ-SUB-MISS',
          title: 'Dynamic Positioning FMEA',
          category: 'DP & Technical',
          isFulfilled: false,
          verifierStatus: 'Pending',
          documentId: '',
        }),
        makeReq({
          id: 'REQ-SUB-EXP',
          title: 'Cargo Ship Safety Radio',
          category: 'Class & Statutory',
          isFulfilled: true,
          verifierStatus: 'Verified',
          documentId: 'DOC-SUB-EXP',
        }),
      ],
    });
    const subCapa = makeCapa({
      id: 'CAPA-SUB-1',
      assuranceSetId: 'AS-SUB-E2E',
      title: 'Fire drill log unsigned',
    });

    const storePayload = {
      assuranceSets: [subSet],
      documents: [returnedVerifiedDoc, expiringDoc],
      capaItems: [subCapa],
      notifications: [],
    };

    // 1. Returned -> Re-upload -> Tasks tab + unblocked reupload modal
    const { unmount: unmount1 } = mountDashboardAs('Submitter', 'Northwind Marine Pty Ltd', 'USR-102', storePayload);
    clickNeedsActionButtonForRow(/Safety Management Certificate/i, 'Re-upload');
    expect(screen.queryByRole('heading', { name: /you don't have access/i })).toBeNull();
    expect(screen.getByRole('tab', { name: /^Tasks/i })).toHaveAttribute('aria-selected', 'true');
    const retActionBtn = screen.getByTestId('task-action-btn-REQ-SUB-RET');
    expect(retActionBtn).toHaveTextContent('Reupload');
    fireEvent.click(retActionBtn);
    expect(screen.getByRole('heading', { name: /upload new version/i })).toBeInTheDocument();
    expect(screen.queryByTestId('reupload-blocked-alert')).toBeNull();
    unmount1();

    // 2. Finding -> Respond -> straight to AS-SUB-E2E Tasks tab + Open Findings card + CapaReinspectionDrawer open + Submit response
    const { unmount: unmount2 } = mountDashboardAs('Submitter', 'Northwind Marine Pty Ltd', 'USR-102', storePayload);
    clickNeedsActionButtonForRow(/Fire drill log unsigned/i, 'Respond');
    expect(screen.queryByRole('heading', { name: /you don't have access/i })).toBeNull();
    expect(useMapStore.getState().currentHashView).toBe('assurance-sets');
    expect(useMapStore.getState().currentEntityId).toBe('AS-SUB-E2E');
    expect(screen.getByRole('tab', { name: /^Tasks/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('tasks-open-findings-card')).toBeInTheDocument();
    expect(screen.getByTestId('capa-reinspection-drawer')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('capa-submitter-response'), {
      target: { value: 'Completed drill and uploaded Master endorsement.' },
    });
    fireEvent.click(screen.getByTestId('capa-submit-response-btn'));

    const updatedCapa = useMapStore.getState().capaItems.find((c) => c.id === 'CAPA-SUB-1');
    expect(updatedCapa?.status).toBe('Under Re-Inspection');
    expect(updatedCapa?.submitterResponse).toBe('Completed drill and uploaded Master endorsement.');
    const inspectorNotif = useMapStore
      .getState()
      .notifications.find(
        (n) =>
          n.recipientUserId === 'USR-203' &&
          n.type === 'capa_reinspection' &&
          n.capaId === 'CAPA-SUB-1',
      );
    expect(inspectorNotif).toBeDefined();
    unmount2();

    // 3. Missing -> Upload -> Tasks tab + Upload modal
    const { unmount: unmount3 } = mountDashboardAs('Submitter', 'Northwind Marine Pty Ltd', 'USR-102', storePayload);
    clickNeedsActionButtonForRow(/1 document/i, 'Upload');
    expect(screen.queryByRole('heading', { name: /you don't have access/i })).toBeNull();
    expect(screen.getByRole('tab', { name: /^Tasks/i })).toHaveAttribute('aria-selected', 'true');
    const missActionBtn = screen.getByTestId('task-action-btn-REQ-SUB-MISS');
    expect(missActionBtn).toHaveTextContent('Upload');
    fireEvent.click(missActionBtn);
    expect(screen.getByRole('heading', { name: /upload document/i })).toBeInTheDocument();
    unmount3();

    // 4. Expiring -> Renew -> DocumentDetailView with Upload New Version button
    mountDashboardAs('Submitter', 'Northwind Marine Pty Ltd', 'USR-102', storePayload);
    clickNeedsActionButtonForRow(/Cargo Ship Safety Radio/i, 'Renew');
    expect(screen.queryByRole('heading', { name: /you don't have access/i })).toBeNull();
    expect(useMapStore.getState().currentHashView).toBe('documents');
    expect(useMapStore.getState().currentEntityId).toBe('DOC-SUB-EXP');
    expect(screen.getByRole('heading', { name: /Cargo Ship Safety Radio/i })).toBeInTheDocument();
    const renewBtn = screen.getByRole('button', { name: 'Upload New Version' });
    expect(renewBtn).toBeInTheDocument();
    expect(renewBtn).not.toBeDisabled();
  });

  it('Verifier: Verify opens VerifierWorkspaceView with DocumentReviewDrawer for uploaded doc, and falls back to assurance-sets Tasks tab when no doc is uploaded', () => {
    const pendingDoc = makeDoc({
      id: 'DOC-VER-PEND',
      title: 'IOPP Certificate',
      certificateNo: 'IOPP-2026-10',
      verificationStatus: 'Pending',
    });
    const setWithDoc = makeSet({
      id: 'AS-VER-WITH-DOC',
      title: 'Verification Ready Set',
      targetDate: '2026-11-08T00:00:00Z',
      requirements: [
        makeReq({
          id: 'REQ-VER-DOC',
          title: 'IOPP Certificate',
          category: 'Class & Statutory',
          isFulfilled: false,
          verifierStatus: 'Pending',
          documentId: 'DOC-VER-PEND',
        }),
      ],
    });

    // Case A: uploaded doc -> VerifierWorkspaceView auto-opens DocumentReviewDrawer
    const { unmount: unmount1 } = mountDashboardAs('Verifier', 'Bureau Veritas Inspectorate', 'USR-202', {
      assuranceSets: [setWithDoc],
      documents: [pendingDoc],
      capaItems: [],
      notifications: [],
    });

    clickNeedsActionButtonForRow(/IOPP Certificate/i, 'Verify');
    expect(screen.queryByRole('heading', { name: /you don't have access/i })).toBeNull();
    expect(useMapStore.getState().currentHashView).toBe('verifier');
    expect(useMapStore.getState().currentEntityId).toBe('DOC-VER-PEND');
    const drawerDialog = screen.getByRole('dialog', { name: /IOPP Certificate/i });
    expect(drawerDialog).toBeInTheDocument();
    expect(within(drawerDialog).getAllByText('IOPP-2026-10').length).toBeGreaterThan(0);
    unmount1();

    // Case B: pending requirement with no uploaded doc -> Verifier redirects gracefully to AssuranceDetailView Tasks tab
    const setWithoutDoc = makeSet({
      id: 'AS-VER-NO-DOC',
      title: 'Unuploaded Pending Set',
      targetDate: '2026-11-12T00:00:00Z',
      requirements: [
        makeReq({
          id: 'REQ-VER-NODOC',
          title: 'Pending Hull Survey',
          category: 'Class & Statutory',
          isFulfilled: false,
          verifierStatus: 'Pending',
          documentId: '',
        }),
      ],
    });

    mountDashboardAs('Verifier', 'Bureau Veritas Inspectorate', 'USR-202', {
      assuranceSets: [setWithoutDoc],
      documents: [],
      capaItems: [],
      notifications: [],
    });

    clickNeedsActionButtonForRow(/Pending Hull Survey/i, 'Verify');
    expect(screen.queryByRole('heading', { name: /you don't have access/i })).toBeNull();
    expect(useMapStore.getState().currentHashView).toBe('assurance-sets');
    expect(useMapStore.getState().currentEntityId).toBe('AS-VER-NO-DOC');
    expect(screen.getByRole('tab', { name: /^Tasks/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('Inspector: Prepare opens InspectionChecklistView and Schedule opens CapaManagementView with CapaReinspectionDrawer', () => {
    const inspectionSet = makeSet({
      id: 'AS-INSP-E2E',
      title: 'Damper Field Inspection',
      stage: 'Inspection',
      mandatoryInspectionRequired: true,
      assignedInspector: 'N. Technical (Bureau Veritas Inspectorate)',
      targetDate: '2026-11-08T00:00:00Z',
    });
    const flaggedCapa = makeCapa({
      id: 'CAPA-INSP-1',
      assuranceSetId: 'AS-INSP-E2E',
      title: 'Ballast valve actuator leak',
      status: 'Under Re-Inspection',
      flaggedForReinspection: true,
    });

    const storePayload = {
      assuranceSets: [inspectionSet],
      documents: [],
      capaItems: [flaggedCapa],
      notifications: [],
    };

    // 1. Prepare -> InspectionChecklistView
    const { unmount: unmount1 } = mountDashboardAs('Inspector', 'Bureau Veritas Inspectorate', 'USR-203', storePayload);
    clickNeedsActionButtonForRow(/Upcoming.*Due 8 Nov/i, 'Prepare');
    expect(screen.queryByRole('heading', { name: /you don't have access/i })).toBeNull();
    expect(useMapStore.getState().currentHashView).toBe('inspector');
    expect(useMapStore.getState().currentEntityId).toBe('AS-INSP-E2E');
    expect(screen.getByRole('heading', { name: /Physical Vessel Inspection|Inspection Checklist/i })).toBeInTheDocument();
    unmount1();

    // 2. Schedule -> CapaManagementView with CapaReinspectionDrawer open
    mountDashboardAs('Inspector', 'Bureau Veritas Inspectorate', 'USR-203', storePayload);
    clickNeedsActionButtonForRow(/Ballast valve actuator leak/i, 'Schedule');
    expect(screen.queryByRole('heading', { name: /you don't have access/i })).toBeNull();
    expect(useMapStore.getState().currentHashView).toBe('capa');
    expect(useMapStore.getState().currentEntityId).toBe('CAPA-INSP-1');
    expect(screen.getByTestId('capa-reinspection-drawer')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Ballast valve actuator leak/i })).toBeInTheDocument();
  });

  it('Approver: Decide lands on Details tab with ApproverDecisionBar, and clicking View on Tasks tab opens ApproverDecisionDrawer in-place without redirecting to Requirements', () => {
    const verifiedDoc = makeDoc({
      id: 'DOC-APPR-1',
      title: 'ABS Classification Certificate',
      certificateNo: 'ABS-2026-777',
      verificationStatus: 'Verified',
    });
    const approverSet = makeSet({
      id: 'AS-APPR-E2E',
      title: 'Ichthys Executive Sign-Off',
      stage: 'Approval',
      approverDecision: 'Pending',
      mandatoryInspectionRequired: false,
      assignedApprover: 'P. Nardelli (Marine Assurance Authority)',
      requirements: [
        makeReq({
          id: 'REQ-APPR-1',
          title: 'ABS Classification Certificate',
          category: 'Class & Statutory',
          isFulfilled: true,
          verifierStatus: 'Verified',
          documentId: 'DOC-APPR-1',
          verificationMethod: 'Manual review',
          verificationReference: 'REF-882',
          verifiedVersion: {
            documentId: 'DOC-APPR-1',
            versionLabel: 'v1.0',
            fileName: 'abs-cert-v1.pdf',
            uploadedAt: '2026-10-01T10:00:00Z',
            verifiedAt: '2026-11-04T12:00:00Z',
            verifiedBy: 'A. Fontaine',
            verificationStatus: 'Verified',
          },
        }),
      ],
    });

    mountDashboardAs('Approver', 'Marine Assurance Authority', 'USR-204', {
      assuranceSets: [approverSet],
      documents: [verifiedDoc],
      capaItems: [],
      notifications: [],
    });

    clickNeedsActionButtonForRow(/Ichthys Executive Sign-Off/i, 'Decide');

    expect(screen.queryByRole('heading', { name: /you don't have access/i })).toBeNull();
    expect(useMapStore.getState().currentHashView).toBe('assurance-sets');
    expect(useMapStore.getState().currentEntityId).toBe('AS-APPR-E2E');

    // Mandatory decision: Approver Decision bar stays in the Details tab
    const detailsTab = screen.getByRole('tab', { name: /^Details/i });
    expect(detailsTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('approver-decision-bar')).toBeInTheDocument();

    // Switch to Tasks tab and click View -> opens ApproverDecisionDrawer WITHOUT switching to Requirements tab
    const tasksTab = screen.getByRole('tab', { name: /^Tasks/i });
    fireEvent.click(tasksTab);
    expect(tasksTab).toHaveAttribute('aria-selected', 'true');

    const viewBtn = screen.getByTestId('task-action-btn-REQ-APPR-1');
    expect(viewBtn).toHaveTextContent('View');
    fireEvent.click(viewBtn);

    expect(tasksTab).toHaveAttribute('aria-selected', 'true');
    const requirementsTab = screen.queryByRole('tab', { name: /^Requirements/i });
    if (requirementsTab) {
      expect(requirementsTab).toHaveAttribute('aria-selected', 'false');
    }

    const drawer = screen.getByTestId('approver-decision-drawer');
    expect(drawer).toBeInTheDocument();
    expect(within(drawer).getAllByText('ABS-2026-777').length).toBeGreaterThan(0);
    expect(screen.getByTestId('approver-drawer-decision-section')).toBeInTheDocument();
    expect(screen.getByTestId('approver-drawer-return-req-btn')).toBeInTheDocument();
    expect(screen.getByTestId('approver-drawer-reject-req-btn')).toBeInTheDocument();
  });

  it('Default mock store: every rendered "Needs your action" CTA across all 6 personas navigates away from dashboard without AccessDeniedState', () => {
    const personas: { persona: UserRolePersona; org: string; userId: string }[] = [
      { persona: 'C Admin', org: 'Southern Basin Energy Pty Ltd', userId: 'USR-201' },
      { persona: 'Administrator', org: 'Northwind Marine Pty Ltd', userId: 'USR-101' },
      { persona: 'Submitter', org: 'Northwind Marine Pty Ltd', userId: 'USR-102' },
      { persona: 'Verifier', org: 'Bureau Veritas Inspectorate', userId: 'USR-202' },
      { persona: 'Inspector', org: 'Bureau Veritas Inspectorate', userId: 'USR-203' },
      { persona: 'Approver', org: 'Marine Assurance Authority', userId: 'USR-204' },
    ];

    for (const entry of personas) {
      const { unmount } = mountDashboardAs(entry.persona, entry.org, entry.userId, {});
      const section = screen.getByTestId('needs-your-action-section');
      const rows = within(section).queryAllByTestId('action-item-row');
      unmount();

      for (let idx = 0; idx < rows.length; idx++) {
        const rendered = mountDashboardAs(entry.persona, entry.org, entry.userId, {});
        const currentRows = within(screen.getByTestId('needs-your-action-section')).getAllByTestId('action-item-row');
        const btn = within(currentRows[idx]).getByRole('button');
        fireEvent.click(btn);

        expect(screen.queryByRole('heading', { name: /you don't have access/i })).toBeNull();
        expect(useMapStore.getState().currentHashView).not.toBe('dashboard');
        rendered.unmount();
      }
    }
  });
});
