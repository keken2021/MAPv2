/*
  file summary: verification suite for deferred FilterModal behavior across all 14 table components and list views.
  responsibilities: verifies useDeferredFilters hook contract and that FilterModal edits/resets stay in draft until Apply is clicked.
  role in system: automated regression suite guarding deferred filter semantics across MAPv2 tables and views.
*/

import React, { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { AssuranceTable } from '../components/tables/AssuranceTable';
import { AuditTrailTable } from '../components/tables/AuditTrailTable';
import { CapaTable } from '../components/tables/CapaTable';
import { CrewTable } from '../components/tables/CrewTable';
import { DocumentTable } from '../components/tables/DocumentTable';
import { UserTable } from '../components/tables/UserTable';
import { VesselTable } from '../components/tables/VesselTable';
import { ApproverDashboardView } from '../views/ApproverDashboardView';
import { EquipmentView } from '../views/EquipmentView';
import { InspectorWorkspaceView } from '../views/InspectorWorkspaceView';
import { MarketplaceView } from '../views/MarketplaceView';
import { NotificationsView } from '../views/NotificationsView';
import { ProjectView } from '../views/ProjectView';
import { VerifierWorkspaceView } from '../views/VerifierWorkspaceView';
import { useMapStore } from '../store/useMapStore';
import { useDeferredFilters } from '../utils/useDeferredFilters';
import type { AssuranceSet, AssuranceTemplate } from '../types/assurance';
import type { AuditTrailEvent } from '../types/audit';
import type { CapaItem } from '../types/capa';
import type { CrewGroup, CrewMember } from '../types/crew';
import type { MasterDocument } from '../types/document';
import type { EquipmentAsset } from '../types/equipment';
import type { AppNotification } from '../types/notification';
import type { Project } from '../types/project';
import type { UserProfile } from '../types/user';
import type { VesselInformation } from '../types/vessel';

const initialStoreState = useMapStore.getState();

afterEach(() => {
  cleanup();
  useMapStore.setState(initialStoreState, true);
  vi.restoreAllMocks();
});

function getSelectByLabel(container: HTMLElement, labelText: string): HTMLSelectElement {
  const labels = Array.from(container.querySelectorAll('label'));
  const label = labels.find((el) => el.textContent?.trim() === labelText);
  if (!label) {
    throw new Error(`Label "${labelText}" not found inside dialog`);
  }
  const wrapper = label.parentElement;
  if (!wrapper) {
    throw new Error(`Wrapper element missing for label "${labelText}"`);
  }
  const select = wrapper.querySelector('select');
  if (!select) {
    throw new Error(`Select element missing for label "${labelText}"`);
  }
  return select;
}

function openFiltersModal(expectedActive = 0): HTMLElement {
  fireEvent.click(screen.getByRole('button', { name: `Filters (${expectedActive} active)` }));
  return screen.getByRole('dialog');
}

function clickModalApply(dialog: HTMLElement): void {
  fireEvent.click(within(dialog).getByRole('button', { name: 'Apply' }));
  expect(screen.queryByRole('dialog')).toBeNull();
}

function clickModalCancel(dialog: HTMLElement): void {
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('dialog')).toBeNull();
}

function clickModalCloseX(dialog: HTMLElement): void {
  fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
  expect(screen.queryByRole('dialog')).toBeNull();
}

function clickModalClearAll(dialog: HTMLElement): void {
  fireEvent.click(within(dialog).getByRole('button', { name: 'Clear All' }));
}

function pressEscapeToClose(): void {
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
}

function clickBackdropToClose(): void {
  fireEvent.click(screen.getByTestId('modal-backdrop'));
  expect(screen.queryByRole('dialog')).toBeNull();
}

function assertToolbarFilterCount(expectedCount: number): void {
  expect(screen.getByRole('button', { name: `Filters (${expectedCount} active)` })).toBeInTheDocument();
}

function assertModalDraftCount(dialog: HTMLElement, expectedCount: number): void {
  if (expectedCount > 0) {
    expect(within(dialog).getByText(`${expectedCount} Active`)).toBeInTheDocument();
  } else {
    expect(within(dialog).queryByText(/\d+ Active/)).toBeNull();
  }
}

function makeVessel(overrides: Partial<VesselInformation> & Pick<VesselInformation, 'id' | 'name'>): VesselInformation {
  return {
    imoNumber: '9123453',
    officialRegNumber: `REG-${overrides.id}`,
    mmsiNumber: '503728940',
    callSign: 'VJQ4821',
    flagState: 'Australia',
    portOfRegistry: 'Fremantle, WA',
    status: 'In Operations',
    complianceReadinessScore: 85,
    vesselType: 'OSV',
    vesselSubtype: 'AHTS',
    intendedUse: 'Offshore Supply',
    tradingArea: 'International',
    classificationSociety: 'DNV',
    classNotation: '+100A1 OSV',
    hullType: 'Steel',
    ispsSolasStatus: 'Fully Compliant',
    yearBuilt: 2020,
    shipyardBuilder: 'Damen',
    lengthOverallMeters: 80,
    beamMeters: 18,
    draftMeters: 5.5,
    grossTonnageGT: 3200,
    deadweightTonnageDWT: 4100,
    dynamicPositioningClass: 'DP2',
    mainEnginePowerKW: '2x 2400 kW',
    registeredOwner: 'Northwind Marine Pty Ltd',
    ownerType: 'Corporate',
    corporateRegistryNo: 'ACN-100',
    ismCompany: 'Northwind ISM',
    technicalManager: 'Northwind Tech',
    docNumber: 'DOC-001',
    contact247: '+61 8 9000 0000',
    statutoryCertificates: [],
    hmInsurer: 'Gard',
    piClubName: 'Gard P&I',
    policyNumber: 'PI-001',
    policyExpiryDate: '2027-06-01',
    safeManningComplement: 14,
    certifiedOfficersRatings: '6 Officers / 8 Ratings',
    masterName: 'Capt. James Stirling',
    lifeboatCapacity: 30,
    fuelType: 'MGO',
    lowSulphurCompliant: true,
    bwtsSpec: 'Alfa Laval',
    owCalibrationDate: '2026-06-01',
    masterCertificateUploadCount: 0,
    clientHistory: [],
    ...overrides,
  };
}

function makeSet(overrides: Partial<AssuranceSet> & Pick<AssuranceSet, 'id' | 'title'>): AssuranceSet {
  return {
    vesselId: 'VESSEL-1',
    vesselName: 'MV Pacific Horn',
    imoNumber: '9123453',
    initiatorOrg: 'Northwind Marine Pty Ltd',
    initiatorRole: 'Vessel Provider',
    serviceProviderOrg: 'Northwind Marine Pty Ltd',
    charterWindowStart: '2026-11-01',
    charterWindowEnd: '2026-12-01',
    complianceDeadline: '2026-11-15',
    stage: 'Verification',
    readinessScore: 80,
    requirements: [],
    mandatoryInspectionRequired: false,
    inspectionCompleted: false,
    visibility: 'organization',
    assuranceType: 'Vessel',
    ...overrides,
  };
}

function makeDoc(overrides: Partial<MasterDocument> & Pick<MasterDocument, 'id' | 'title'>): MasterDocument {
  return {
    entityType: 'Vessel Certificate',
    vesselId: 'VESSEL-1',
    certificateNo: `CERT-${overrides.id}`,
    issuingAuthority: 'DNV',
    expiryDate: '2027-06-01',
    ocrConfidence: 96,
    complianceState: 'Valid',
    currentVersion: 'v1.0',
    versions: [],
    validationRules: {
      charterBufferPassed: true,
      assetMatch100Percent: true,
      iacsAuthorityValid: true,
      overallValid: true,
    },
    verificationStatus: 'Pending',
    ...overrides,
  };
}

function makeCapa(overrides: Partial<CapaItem> & Pick<CapaItem, 'id' | 'status'>): CapaItem {
  return {
    vesselName: 'MV Pacific Horn',
    vesselId: 'VESSEL-1',
    checklistItemTitle: 'Safety Equipment',
    title: `${overrides.id} Finding`,
    findingDescription: 'Finding detail',
    owner: 'Northwind Marine Pty Ltd',
    dueDate: '2026-11-20',
    evidences: [],
    createdDate: '2026-10-01',
    ...overrides,
  };
}

function makeCrew(overrides: Partial<CrewMember> & Pick<CrewMember, 'id' | 'fullName'>): CrewMember {
  return {
    rank: 'Master',
    nationality: 'Australian',
    organization: 'Northwind Marine Pty Ltd',
    seamansBookNo: `SB-${overrides.id}`,
    passportNo: `PA-${overrides.id}`,
    dateOfBirth: '1985-05-10',
    emergencyContact: '+61 400 000 000',
    complianceStatus: 'Fully Compliant',
    overallComplianceScore: 95,
    lastAuditedDate: '2026-09-15',
    assignments: [],
    layer1CoreDocuments: [],
    layer2Endorsements: [],
    ...overrides,
  };
}

function makeCrewGroup(overrides: Partial<CrewGroup> & Pick<CrewGroup, 'id' | 'name' | 'specialization'>): CrewGroup {
  return {
    memberIds: ['CREW-1'],
    organization: 'Northwind Marine Pty Ltd',
    ...overrides,
  };
}

function makeEquipment(overrides: Partial<EquipmentAsset> & Pick<EquipmentAsset, 'id' | 'name'>): EquipmentAsset {
  return {
    equipmentIdentifier: overrides.id,
    category: 'Fire-Fighting Equipment (FFE)',
    owningOrganization: 'Northwind Marine Pty Ltd',
    complianceReadinessScore: 90,
    availabilityStatus: 'Available',
    availabilityUpdatedAt: '2026-10-01',
    registrationStatus: 'Registered',
    registrationUpdatedAt: '2026-10-01',
    classStatus: 'In Class',
    classStatusUpdatedAt: '2026-10-01',
    complianceStatus: 'Compliant',
    complianceUpdatedAt: '2026-10-01',
    ...overrides,
  };
}

function makeUser(overrides: Partial<UserProfile> & Pick<UserProfile, 'id' | 'name'>): UserProfile {
  return {
    email: `${overrides.id.toLowerCase()}@northwind.example`,
    roles: ['Submitter'],
    userType: 'Organization',
    organization: 'Northwind Marine Pty Ltd',
    departmentOrScope: 'Operations',
    status: 'Active',
    lastActive: '2026-10-28',
    createdBy: 'Administrator',
    ...overrides,
  };
}

function makeProject(overrides: Partial<Project> & Pick<Project, 'id' | 'name'>): Project {
  return {
    clientOperator: 'Chevron Australia Pty Ltd',
    location: 'Dampier, WA',
    description: 'Project scope description',
    projectType: 'Charter / Voyage',
    requestingOrganization: 'Northwind Marine Pty Ltd',
    charterWindowStart: '2026-11-01',
    charterWindowEnd: '2026-12-31',
    status: 'Draft',
    operatorOrganization: 'Northwind Marine Pty Ltd',
    assetLinks: [],
    ...overrides,
  };
}

function makeAuditEvent(overrides: Partial<AuditTrailEvent> & Pick<AuditTrailEvent, 'id' | 'action'>): AuditTrailEvent {
  return {
    timestampUtc: '2026-10-15T10:00:00.000Z',
    userId: 'USR-201',
    userRole: 'Verifier',
    organization: 'BV Maritime',
    targetAsset: 'MV Pacific Horn / AS-2026-001',
    target: { kind: 'document', setId: 'AS-2026-001', documentId: 'DOC-1' },
    ...overrides,
  };
}

function makeNotification(
  overrides: Partial<AppNotification> & Pick<AppNotification, 'id' | 'type' | 'subject'>,
): AppNotification {
  return {
    message: 'Notification body',
    recipientUserId: 'USR-101',
    senderUserId: 'USR-204',
    senderName: 'P. Nardelli',
    projectId: 'PRJ-01',
    projectName: 'Gorgon Support',
    status: 'unread',
    createdAt: '2026-10-15T08:00:00.000Z',
    ...overrides,
  };
}

describe('useDeferredFilters hook contract', () => {
  interface DemoFilterState {
    stage: string;
    scope: string;
  }

  const DeferredFilterHarness: React.FC<{ onCommitSpy: (next: DemoFilterState) => void }> = ({ onCommitSpy }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [applied, setApplied] = useState<DemoFilterState>({ stage: 'Verification', scope: 'ALL' });

    const { draft, setField, resetDraft, applyDraft } = useDeferredFilters<DemoFilterState>({
      isOpen,
      applied,
      defaults: { stage: 'ALL', scope: 'ALL' },
      onCommit: (next) => {
        setApplied(next);
        onCommitSpy(next);
      },
    });

    return (
      <div>
        <div data-testid="applied-stage">{applied.stage}</div>
        <div data-testid="applied-scope">{applied.scope}</div>
        <div data-testid="draft-stage">{draft.stage}</div>
        <div data-testid="draft-scope">{draft.scope}</div>
        <button type="button" onClick={() => setIsOpen(true)}>
          Open
        </button>
        <button type="button" onClick={() => setIsOpen(false)}>
          Dismiss
        </button>
        <button type="button" onClick={() => setField('stage', 'Approval')}>
          Draft Approval
        </button>
        <button type="button" onClick={() => setField('scope', 'Crew')}>
          Draft Crew
        </button>
        <button type="button" onClick={() => setApplied({ stage: 'Certified', scope: 'Equipment' })}>
          External Change
        </button>
        <button type="button" onClick={resetDraft}>
          Reset Draft
        </button>
        <button
          type="button"
          onClick={() => {
            applyDraft();
            setIsOpen(false);
          }}
        >
          Apply Draft
        </button>
      </div>
    );
  };

  it('keeps edits and resets local until applyDraft and resyncs from applied when reopened', () => {
    const onCommitSpy = vi.fn();
    render(<DeferredFilterHarness onCommitSpy={onCommitSpy} />);

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByTestId('draft-stage')).toHaveTextContent('Verification');

    // Editing draft does not call onCommit
    fireEvent.click(screen.getByRole('button', { name: 'Draft Approval' }));
    expect(screen.getByTestId('draft-stage')).toHaveTextContent('Approval');
    expect(screen.getByTestId('applied-stage')).toHaveTextContent('Verification');
    expect(onCommitSpy).not.toHaveBeenCalled();

    // Resetting draft sets defaults locally without committing
    fireEvent.click(screen.getByRole('button', { name: 'Reset Draft' }));
    expect(screen.getByTestId('draft-stage')).toHaveTextContent('ALL');
    expect(screen.getByTestId('applied-stage')).toHaveTextContent('Verification');
    expect(onCommitSpy).not.toHaveBeenCalled();

    // Dismissing and reopening discards draft and restores latest applied
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByTestId('draft-stage')).toHaveTextContent('Verification');

    // External applied change while closed syncs into draft on next open
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    fireEvent.click(screen.getByRole('button', { name: 'External Change' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByTestId('draft-stage')).toHaveTextContent('Certified');
    expect(screen.getByTestId('draft-scope')).toHaveTextContent('Equipment');

    // Editing then calling applyDraft commits once
    fireEvent.click(screen.getByRole('button', { name: 'Draft Crew' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply Draft' }));
    expect(onCommitSpy).toHaveBeenCalledTimes(1);
    expect(onCommitSpy).toHaveBeenCalledWith({ stage: 'Certified', scope: 'Crew' });
    expect(screen.getByTestId('applied-scope')).toHaveTextContent('Crew');
  });
});

describe('Deferred FilterModal across all 14 table components and list views', () => {
  it('1. AssuranceTable: defers stage/scope/project, resets pagination on apply, and keeps public tab draft count scoped to scope', () => {
    const sets: AssuranceSet[] = Array.from({ length: 12 }, (_, idx) =>
      makeSet({
        id: `AS-2026-${String(idx + 1).padStart(3, '0')}`,
        title: `Assurance Item ${idx + 1}`,
        stage: idx < 11 ? 'Approval' : 'Verification',
        assuranceType: idx < 2 ? 'Equipment' : 'Vessel',
        projectId: idx === 0 ? 'PRJ-01' : undefined,
      }),
    );

    const templates: AssuranceTemplate[] = [
      {
        id: 'AST-2026-001',
        title: 'Vessel Vetting Blueprint',
        scope: 'Vessel',
        scopeType: 'OSV',
        visibility: 'public',
        requirements: [],
        initiatorOrg: 'Global',
      },
      {
        id: 'AST-2026-002',
        title: 'Equipment Mobilization Blueprint',
        scope: 'Equipment',
        scopeType: 'ROV',
        visibility: 'public',
        requirements: [],
        initiatorOrg: 'Global',
      },
    ];

    useMapStore.setState({
      activePersona: 'Administrator',
      assuranceSets: sets,
      assuranceTemplates: templates,
      projects: [makeProject({ id: 'PRJ-01', name: 'Gorgon Support' })],
    });

    render(<AssuranceTable onSelectSet={vi.fn()} />);

    // Navigate to page 2
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
    expect(screen.getByText('Assurance Item 11')).toBeInTheDocument();

    // Open modal, edit draft without applying -> rows, badge, chips, and page 2 remain untouched
    let dialog = openFiltersModal(0);
    fireEvent.change(getSelectByLabel(dialog, 'Stage'), { target: { value: 'Approval' } });
    fireEvent.change(getSelectByLabel(dialog, 'Scope'), { target: { value: 'Equipment' } });
    assertModalDraftCount(dialog, 2);
    assertToolbarFilterCount(0);
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
    expect(screen.getByText('Assurance Item 11')).toBeInTheDocument();

    // Cancel discards draft
    clickModalCancel(dialog);
    dialog = openFiltersModal(0);
    expect(getSelectByLabel(dialog, 'Stage').value).toBe('ALL');
    expect(getSelectByLabel(dialog, 'Scope').value).toBe('ALL');

    // Close button (X), Escape, and Backdrop all discard draft
    fireEvent.change(getSelectByLabel(dialog, 'Stage'), { target: { value: 'Approval' } });
    clickModalCloseX(dialog);
    dialog = openFiltersModal(0);
    expect(getSelectByLabel(dialog, 'Stage').value).toBe('ALL');

    fireEvent.change(getSelectByLabel(dialog, 'Stage'), { target: { value: 'Approval' } });
    pressEscapeToClose();
    dialog = openFiltersModal(0);
    expect(getSelectByLabel(dialog, 'Stage').value).toBe('ALL');

    fireEvent.change(getSelectByLabel(dialog, 'Stage'), { target: { value: 'Approval' } });
    clickBackdropToClose();
    dialog = openFiltersModal(0);
    expect(getSelectByLabel(dialog, 'Stage').value).toBe('ALL');

    // Apply Stage=Approval alone (11 matching sets) -> updates badge/chip and resets pagination from Page 2 to Page 1
    fireEvent.change(getSelectByLabel(dialog, 'Stage'), { target: { value: 'Approval' } });
    clickModalApply(dialog);

    assertToolbarFilterCount(1);
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    expect(screen.getByText('Showing 1-10 of 11')).toBeInTheDocument();
    expect(screen.getByText('Assurance Item 1')).toBeInTheDocument();
    expect(screen.queryByText('Assurance Item 12')).toBeNull();

    // Narrow further with Scope=Equipment & Project=PRJ-01 -> shows only matching set and chips
    dialog = openFiltersModal(1);
    fireEvent.change(getSelectByLabel(dialog, 'Scope'), { target: { value: 'Equipment' } });
    fireEvent.change(getSelectByLabel(dialog, 'Project'), { target: { value: 'PRJ-01' } });
    clickModalApply(dialog);

    assertToolbarFilterCount(3);
    expect(screen.getByText('Assurance Item 1')).toBeInTheDocument();
    expect(screen.queryByText('Assurance Item 11')).toBeNull();
    expect(screen.getByTitle('Remove Stage filter')).toBeInTheDocument();
    expect(screen.getByTitle('Remove Scope filter')).toBeInTheDocument();
    expect(screen.getByTitle('Remove Project filter')).toBeInTheDocument();

    // Public tab activeCount & draftActiveFilterCount count only Scope
    fireEvent.click(screen.getByRole('tab', { name: /public/i }));
    assertToolbarFilterCount(1);
    dialog = openFiltersModal(1);
    assertModalDraftCount(dialog, 1);
    clickModalCancel(dialog);

    // Back to Organization tab: Clear All stays draft until Apply
    fireEvent.click(screen.getByRole('tab', { name: /organization/i }));
    dialog = openFiltersModal(3);
    clickModalClearAll(dialog);
    expect(getSelectByLabel(dialog, 'Stage').value).toBe('ALL');
    assertModalDraftCount(dialog, 0);
    assertToolbarFilterCount(3);
    expect(screen.getByText('Assurance Item 1')).toBeInTheDocument();
    clickModalCancel(dialog);

    // Confirm Cancel preserved committed filters; then Clear All + Apply restores all 12 items
    assertToolbarFilterCount(3);
    dialog = openFiltersModal(3);
    clickModalClearAll(dialog);
    clickModalApply(dialog);
    assertToolbarFilterCount(0);
    expect(screen.getByText(/Showing \d+-\d+ of 12/)).toBeInTheDocument();
    expect(screen.queryByTitle('Remove Stage filter')).toBeNull();
  });

  it('2. AuditTrailTable: defers Role and Target filters until Apply and discards Cancel/unapplied Clear All', () => {
    const events: AuditTrailEvent[] = Array.from({ length: 12 }, (_, idx) =>
      makeAuditEvent({
        id: `AUD-${idx + 1}`,
        timestampUtc: `2026-10-${String(idx + 10).padStart(2, '0')}T10:00:00.000Z`,
        action: `Audit Action ${idx + 1}`,
        userRole: idx < 11 ? 'Inspector' : 'Verifier',
        target:
          idx === 0
            ? { kind: 'finding', setId: 'AS-2026-001', findingId: 'CAPA-1' }
            : { kind: 'document', setId: 'AS-2026-001', documentId: `DOC-${idx + 1}` },
      }),
    );

    useMapStore.setState({
      activePersona: 'Approver',
      auditEvents: events,
    });

    render(<AuditTrailTable />);
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();

    let dialog = openFiltersModal(0);
    fireEvent.change(getSelectByLabel(dialog, 'Role'), { target: { value: 'Inspector' } });
    fireEvent.change(getSelectByLabel(dialog, 'Target'), { target: { value: 'finding' } });
    assertModalDraftCount(dialog, 2);
    assertToolbarFilterCount(0);
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();

    clickModalCancel(dialog);
    dialog = openFiltersModal(0);
    expect(getSelectByLabel(dialog, 'Role').value).toBe('ALL');

    // Apply Role=Inspector (11 matching events) -> resets pagination from Page 2 to Page 1
    fireEvent.change(getSelectByLabel(dialog, 'Role'), { target: { value: 'Inspector' } });
    clickModalApply(dialog);
    assertToolbarFilterCount(1);
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    expect(screen.getByText('Showing 1-10 of 11')).toBeInTheDocument();

    // Narrow to Target=finding -> shows 1 event and both filter chips
    dialog = openFiltersModal(1);
    fireEvent.change(getSelectByLabel(dialog, 'Target'), { target: { value: 'finding' } });
    clickModalApply(dialog);

    assertToolbarFilterCount(2);
    expect(screen.getByText('Audit Action 1')).toBeInTheDocument();
    expect(screen.queryByText('Audit Action 12')).toBeNull();
    expect(screen.getByTitle('Remove Role filter')).toBeInTheDocument();
    expect(screen.getByTitle('Remove Target filter')).toBeInTheDocument();

    dialog = openFiltersModal(2);
    clickModalClearAll(dialog);
    assertToolbarFilterCount(2);
    clickModalCancel(dialog);
    assertToolbarFilterCount(2);

    dialog = openFiltersModal(2);
    clickModalClearAll(dialog);
    clickModalApply(dialog);
    assertToolbarFilterCount(0);
    expect(screen.getByText(/Showing \d+-\d+ of 12/)).toBeInTheDocument();
  });

  it('3. CapaTable: defers Vessel (setCurrentHashView) and Status until Apply, supports Clear All and locked vesselId', () => {
    const hashSpy = vi.fn();
    const vessels = [
      makeVessel({ id: 'VESSEL-1', name: 'MV Pacific Horn' }),
      makeVessel({ id: 'VESSEL-2', name: 'MV Coral Star' }),
    ];
    const capas: CapaItem[] = Array.from({ length: 12 }, (_, idx) =>
      makeCapa({
        id: `CAPA-${String(idx + 1).padStart(3, '0')}`,
        vesselName: idx === 11 ? 'MV Coral Star' : 'MV Pacific Horn',
        vesselId: idx === 11 ? 'VESSEL-2' : 'VESSEL-1',
        status: idx === 11 ? 'Open' : 'Rectification Required',
      }),
    );

    useMapStore.setState({
      activePersona: 'Administrator',
      vessels,
      capaItems: capas,
      setCurrentHashView: hashSpy,
    });

    const { unmount } = render(<CapaTable />);
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();

    // Editing Vessel & Status must NOT invoke setCurrentHashView or alter filters until Apply
    let dialog = openFiltersModal(0);
    fireEvent.change(getSelectByLabel(dialog, 'Vessel'), { target: { value: 'MV Coral Star' } });
    fireEvent.change(getSelectByLabel(dialog, 'Status'), { target: { value: 'Open' } });
    assertModalDraftCount(dialog, 2);
    assertToolbarFilterCount(0);
    expect(hashSpy).not.toHaveBeenCalled();
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();

    clickModalCancel(dialog);
    expect(hashSpy).not.toHaveBeenCalled();

    dialog = openFiltersModal(0);
    fireEvent.change(getSelectByLabel(dialog, 'Vessel'), { target: { value: 'MV Coral Star' } });
    fireEvent.change(getSelectByLabel(dialog, 'Status'), { target: { value: 'Open' } });
    clickModalApply(dialog);

    expect(hashSpy).toHaveBeenCalledTimes(1);
    expect(hashSpy).toHaveBeenCalledWith('capas', 'MV Coral Star');
    assertToolbarFilterCount(1);
    unmount();

    // Scoped via vesselName prop: Clear All only commits ALL_FLEET hash navigation on Apply
    hashSpy.mockClear();
    const scopedRender = render(<CapaTable vesselName="MV Coral Star" />);
    assertToolbarFilterCount(1);
    dialog = openFiltersModal(1);
    clickModalClearAll(dialog);
    expect(hashSpy).not.toHaveBeenCalled();
    assertToolbarFilterCount(1);
    clickModalApply(dialog);
    expect(hashSpy).toHaveBeenCalledTimes(1);
    expect(hashSpy).toHaveBeenCalledWith('capas', 'ALL_FLEET');
    scopedRender.unmount();

    // Locked by vesselId: Vessel dropdown hidden, Status filter still deferred
    render(<CapaTable vesselId="VESSEL-1" />);
    dialog = openFiltersModal(0);
    expect(within(dialog).queryByText('Vessel')).toBeNull();
    fireEvent.change(getSelectByLabel(dialog, 'Status'), { target: { value: 'Rectification Required' } });
    assertToolbarFilterCount(0);
    clickModalApply(dialog);
    assertToolbarFilterCount(1);
    expect(screen.getByText('CAPA-001 Finding')).toBeInTheDocument();
  });

  it('4. CrewTable: defers filters in Individuals and Groups modes and syncs external CountTabs into draft', () => {
    const vessels = [makeVessel({ id: 'VESSEL-1', name: 'MV Pacific Horn' })];
    const crewMembers: CrewMember[] = [
      makeCrew({
        id: 'CREW-1',
        fullName: 'Capt. Morgan Reed',
        rank: 'Master',
        complianceStatus: 'Fully Compliant',
        currentVesselId: 'VESSEL-1',
        currentVesselName: 'MV Pacific Horn',
      }),
      makeCrew({
        id: 'CREW-2',
        fullName: 'Chief Eng. Dana Hayes',
        rank: 'Chief Engineer',
        complianceStatus: 'Expiring < 60 Days',
      }),
    ];
    const crewGroups: CrewGroup[] = [
      makeCrewGroup({ id: 'GRP-1', name: 'DP Team Alpha', specialization: 'DP Operations' }),
      makeCrewGroup({ id: 'GRP-2', name: 'ROV Crew Beta', specialization: 'Subsea ROV' }),
    ];

    useMapStore.setState({
      activePersona: 'Administrator',
      vessels,
      crew: crewMembers,
      crewGroups,
    });

    render(<CrewTable onSelectCrew={vi.fn()} onSelectGroup={vi.fn()} />);

    // Individuals mode deferred filtering
    let dialog = openFiltersModal(0);
    fireEvent.change(getSelectByLabel(dialog, 'Rank'), { target: { value: 'Engineer' } });
    fireEvent.change(getSelectByLabel(dialog, 'Compliance'), { target: { value: 'Expiring < 60 Days' } });
    fireEvent.change(getSelectByLabel(dialog, 'Vessel'), { target: { value: 'UNASSIGNED' } });
    assertModalDraftCount(dialog, 3);
    assertToolbarFilterCount(0);
    expect(screen.getByText('Capt. Morgan Reed')).toBeInTheDocument();

    clickModalCancel(dialog);
    expect(screen.getByText('Capt. Morgan Reed')).toBeInTheDocument();

    dialog = openFiltersModal(0);
    fireEvent.change(getSelectByLabel(dialog, 'Rank'), { target: { value: 'Engineer' } });
    clickModalApply(dialog);
    assertToolbarFilterCount(1);
    expect(screen.queryByText('Capt. Morgan Reed')).toBeNull();
    expect(screen.getByText('Chief Eng. Dana Hayes')).toBeInTheDocument();

    // External CountTab updates Compliance immediately and syncs into modal draft on reopen
    const crewTabs = screen.getByRole('tablist', { name: /crew tabs/i });
    fireEvent.click(within(crewTabs).getByRole('tab', { name: /^compliant/i }));
    assertToolbarFilterCount(2);
    dialog = openFiltersModal(2);
    expect(getSelectByLabel(dialog, 'Compliance').value).toBe('Fully Compliant');
    clickModalClearAll(dialog);
    clickModalApply(dialog);
    assertToolbarFilterCount(0);

    // Groups mode deferred Specialization filter
    const modeToggle = screen.getByRole('group', { name: /crew view mode/i });
    fireEvent.click(within(modeToggle).getByRole('button', { name: 'Groups' }));

    dialog = openFiltersModal(0);
    fireEvent.change(getSelectByLabel(dialog, 'Specialization'), { target: { value: 'Subsea ROV' } });
    assertToolbarFilterCount(0);
    expect(screen.getByText('DP Team Alpha')).toBeInTheDocument();

    clickModalCancel(dialog);
    expect(screen.getByText('DP Team Alpha')).toBeInTheDocument();

    dialog = openFiltersModal(0);
    fireEvent.change(getSelectByLabel(dialog, 'Specialization'), { target: { value: 'Subsea ROV' } });
    clickModalApply(dialog);
    assertToolbarFilterCount(1);
    expect(screen.queryByText('DP Team Alpha')).toBeNull();
    expect(screen.getByText('ROV Crew Beta')).toBeInTheDocument();
  });

  it('5. DocumentTable: defers Type/Compliance/Verification and controlled onStatusFilterChange until Apply', () => {
    const docs: MasterDocument[] = [
      makeDoc({
        id: 'DOC-1',
        title: 'Safety Management Cert',
        entityType: 'Vessel Certificate',
        complianceState: 'Valid',
        verificationStatus: 'Verified',
      }),
      makeDoc({
        id: 'DOC-2',
        title: 'STCW Officer CoC',
        entityType: 'Crew Certificate',
        complianceState: 'Expired',
        verificationStatus: 'Rejected',
      }),
    ];

    useMapStore.setState({
      activePersona: 'Administrator',
      documents: docs,
    });

    const onStatusSpy = vi.fn();
    const ControlledHost: React.FC = () => {
      const [status, setStatus] = useState('ALL');
      return (
        <DocumentTable
          documents={docs}
          onSelectDocument={vi.fn()}
          statusFilter={status}
          onStatusFilterChange={(next) => {
            onStatusSpy(next);
            setStatus(next);
          }}
        />
      );
    };

    render(<ControlledHost />);

    let dialog = openFiltersModal(0);
    fireEvent.change(getSelectByLabel(dialog, 'Type'), { target: { value: 'Crew Certificate' } });
    fireEvent.change(getSelectByLabel(dialog, 'Compliance'), { target: { value: 'Expired' } });
    fireEvent.change(getSelectByLabel(dialog, 'Verification'), { target: { value: 'Rejected' } });
    assertModalDraftCount(dialog, 3);
    assertToolbarFilterCount(0);
    expect(onStatusSpy).not.toHaveBeenCalled();
    expect(screen.getByText('Safety Management Cert')).toBeInTheDocument();

    clickModalCancel(dialog);
    expect(onStatusSpy).not.toHaveBeenCalled();
    expect(screen.getByText('Safety Management Cert')).toBeInTheDocument();

    dialog = openFiltersModal(0);
    fireEvent.change(getSelectByLabel(dialog, 'Type'), { target: { value: 'Crew Certificate' } });
    fireEvent.change(getSelectByLabel(dialog, 'Compliance'), { target: { value: 'Expired' } });
    fireEvent.change(getSelectByLabel(dialog, 'Verification'), { target: { value: 'Rejected' } });
    clickModalApply(dialog);

    expect(onStatusSpy).toHaveBeenCalledTimes(1);
    expect(onStatusSpy).toHaveBeenCalledWith('Expired');
    assertToolbarFilterCount(3);
    expect(screen.queryByText('Safety Management Cert')).toBeNull();
    expect(screen.getByText('STCW Officer CoC')).toBeInTheDocument();

    // Clear All inside modal stays deferred; Apply triggers onStatusSpy('ALL')
    dialog = openFiltersModal(3);
    clickModalClearAll(dialog);
    expect(onStatusSpy).toHaveBeenCalledTimes(1);
    assertToolbarFilterCount(3);
    clickModalApply(dialog);
    expect(onStatusSpy).toHaveBeenLastCalledWith('ALL');
    assertToolbarFilterCount(0);

    // External Document tab triggers immediate callback & syncs modal draft on open
    const docTabs = screen.getByRole('tablist', { name: /document tabs/i });
    fireEvent.click(within(docTabs).getByRole('tab', { name: /expired/i }));
    expect(onStatusSpy).toHaveBeenLastCalledWith('Expired');
    dialog = openFiltersModal(1);
    expect(getSelectByLabel(dialog, 'Compliance').value).toBe('Expired');
    clickModalCancel(dialog);
  });

  it('6. UserTable: defers Role/User Type/Status filters until Apply and syncs User tabs into draft', () => {
    const users: UserProfile[] = [
      makeUser({
        id: 'USR-1',
        name: 'Alice Admin',
        roles: ['Submitter'],
        userType: 'Organization',
        status: 'Active',
      }),
      makeUser({
        id: 'USR-2',
        name: 'Bob ThirdParty',
        roles: ['Verifier'],
        userType: 'Third-Party',
        status: 'Inactive',
      }),
    ];

    useMapStore.setState({
      activePersona: 'Administrator',
      users,
    });

    render(<UserTable />);

    let dialog = openFiltersModal(0);
    fireEvent.change(getSelectByLabel(dialog, 'Role'), { target: { value: 'Verifier' } });
    fireEvent.change(getSelectByLabel(dialog, 'User Type'), { target: { value: 'Third-Party' } });
    fireEvent.change(getSelectByLabel(dialog, 'Status'), { target: { value: 'Inactive' } });
    assertModalDraftCount(dialog, 3);
    assertToolbarFilterCount(0);
    expect(screen.getByText('Alice Admin')).toBeInTheDocument();

    clickModalCancel(dialog);
    expect(screen.getByText('Alice Admin')).toBeInTheDocument();

    dialog = openFiltersModal(0);
    fireEvent.change(getSelectByLabel(dialog, 'Role'), { target: { value: 'Verifier' } });
    fireEvent.change(getSelectByLabel(dialog, 'User Type'), { target: { value: 'Third-Party' } });
    fireEvent.change(getSelectByLabel(dialog, 'Status'), { target: { value: 'Inactive' } });
    clickModalApply(dialog);

    assertToolbarFilterCount(3);
    expect(screen.queryByText('Alice Admin')).toBeNull();
    expect(screen.getByText('Bob ThirdParty')).toBeInTheDocument();

    dialog = openFiltersModal(3);
    clickModalClearAll(dialog);
    assertToolbarFilterCount(3);
    clickModalApply(dialog);
    assertToolbarFilterCount(0);
    expect(screen.getByText('Alice Admin')).toBeInTheDocument();

    // External User tab syncs into User Type select when modal opens
    const userTabs = screen.getByRole('tablist', { name: /user tabs/i });
    fireEvent.click(within(userTabs).getByRole('tab', { name: /third-party/i }));
    dialog = openFiltersModal(1);
    expect(getSelectByLabel(dialog, 'User Type').value).toBe('Third-Party');
    clickModalCancel(dialog);
  });

  it('7. VesselTable: defers Flag State/Class Society/Operating Status/Assurance Set in Table and Grid views', () => {
    const vessels = [
      makeVessel({
        id: 'VESSEL-1',
        name: 'MV Aussie Spirit',
        imoNumber: '9123453',
        flagState: 'Australia',
        classificationSociety: 'DNV',
        status: 'In Operations',
      }),
      makeVessel({
        id: 'VESSEL-2',
        name: 'MV Meridian Explorer',
        imoNumber: '9123454',
        flagState: 'Singapore',
        classificationSociety: 'ABS',
        status: 'Standby',
      }),
    ];
    const sets = [
      makeSet({
        id: 'AS-2026-V2',
        title: 'Meridian Vetting',
        vesselId: 'VESSEL-2',
        vesselName: 'MV Meridian Explorer',
        imoNumber: '9123454',
      }),
    ];

    useMapStore.setState({
      activePersona: 'Administrator',
      vessels,
      assuranceSets: sets,
      documents: [],
    });

    render(<VesselTable onSelectVessel={vi.fn()} />);

    // Switch to Table View for crisp row checks
    fireEvent.click(screen.getByRole('button', { name: 'View mode' }));
    fireEvent.click(screen.getByRole('button', { name: /^table$/i }));

    let dialog = openFiltersModal(0);
    fireEvent.change(getSelectByLabel(dialog, 'Flag State'), { target: { value: 'Australia' } });
    fireEvent.change(getSelectByLabel(dialog, 'Class Society'), { target: { value: 'DNV' } });
    fireEvent.change(getSelectByLabel(dialog, 'Operating Status'), { target: { value: 'In Operations' } });
    assertModalDraftCount(dialog, 3);
    assertToolbarFilterCount(0);
    expect(screen.getByText('MV Meridian Explorer')).toBeInTheDocument();

    clickModalCancel(dialog);
    expect(screen.getByText('MV Meridian Explorer')).toBeInTheDocument();

    dialog = openFiltersModal(0);
    fireEvent.change(getSelectByLabel(dialog, 'Assurance Set'), { target: { value: 'AS-2026-V2' } });
    clickModalApply(dialog);

    assertToolbarFilterCount(1);
    expect(screen.queryByText('MV Aussie Spirit')).toBeNull();
    expect(screen.getByText('MV Meridian Explorer')).toBeInTheDocument();

    dialog = openFiltersModal(1);
    clickModalClearAll(dialog);
    assertToolbarFilterCount(1);
    clickModalApply(dialog);
    assertToolbarFilterCount(0);
    expect(screen.getByText('MV Aussie Spirit')).toBeInTheDocument();
  });

  it('8. ApproverDashboardView: defers Stage filter until Apply and preserves existing Clear All behavior', () => {
    useMapStore.setState({
      activePersona: 'Approver',
      activeSessionUserId: 'USR-204',
      users: [
        makeUser({
          id: 'USR-204',
          name: 'P. Nardelli',
          roles: ['Approver'],
          organization: 'Chevron Australia Pty Ltd',
        }),
      ],
      assuranceSets: [
        makeSet({
          id: 'AS-APPR-1',
          title: 'Pending Approval Campaign',
          stage: 'Approval',
          approverDecision: 'Pending',
          assignedApprover: 'P. Nardelli',
        }),
        makeSet({
          id: 'AS-APPR-2',
          title: 'Completed Approval Campaign',
          stage: 'Approved',
          approverDecision: 'Approved',
          assignedApprover: 'P. Nardelli',
        }),
      ],
    });

    render(<ApproverDashboardView />);
    const tabs = screen.getByRole('tablist', { name: /approver queue tabs/i });
    fireEvent.click(within(tabs).getByRole('tab', { name: /^all/i }));

    let dialog = openFiltersModal(0);
    fireEvent.change(getSelectByLabel(dialog, 'Stage'), { target: { value: 'Approved' } });
    assertModalDraftCount(dialog, 1);
    assertToolbarFilterCount(0);
    expect(screen.getByText('AS-APPR-1')).toBeInTheDocument();

    clickModalCancel(dialog);
    expect(screen.getByText('AS-APPR-1')).toBeInTheDocument();

    dialog = openFiltersModal(0);
    fireEvent.change(getSelectByLabel(dialog, 'Stage'), { target: { value: 'Approved' } });
    clickModalApply(dialog);

    assertToolbarFilterCount(1);
    expect(screen.queryByText('AS-APPR-1')).toBeNull();
    expect(screen.getByText('AS-APPR-2')).toBeInTheDocument();

    dialog = openFiltersModal(1);
    clickModalClearAll(dialog);
    assertToolbarFilterCount(1);
    clickModalApply(dialog);
    assertToolbarFilterCount(0);
    expect(screen.getByText('AS-APPR-1')).toBeInTheDocument();
  });

  it('9. EquipmentView: defers Category/Vessel/Availability/Compliance filters until Apply and syncs tabs', () => {
    const vessels = [makeVessel({ id: 'VESSEL-1', name: 'MV Pacific Horn' })];
    const equipment: EquipmentAsset[] = [
      makeEquipment({
        id: 'EQ-1',
        name: 'Deluge Pump Unit',
        category: 'Fire-Fighting Equipment (FFE)',
        parentVesselId: 'VESSEL-1',
        availabilityStatus: 'Available',
        complianceStatus: 'Compliant',
      }),
      makeEquipment({
        id: 'EQ-2',
        name: 'Radar X-Band',
        category: 'Navigation & Bridge Equipment',
        availabilityStatus: 'Under Maintenance',
        complianceStatus: 'Non-Compliant',
      }),
    ];

    useMapStore.setState({
      activePersona: 'Administrator',
      vessels,
      equipment,
      assuranceSets: [],
    });

    render(<EquipmentView />);

    let dialog = openFiltersModal(0);
    fireEvent.change(getSelectByLabel(dialog, 'Category'), { target: { value: 'Navigation & Bridge Equipment' } });
    fireEvent.change(getSelectByLabel(dialog, 'Vessel'), { target: { value: 'UNASSIGNED' } });
    fireEvent.change(getSelectByLabel(dialog, 'Availability'), { target: { value: 'Under Maintenance' } });
    fireEvent.change(getSelectByLabel(dialog, 'Compliance'), { target: { value: 'Non-Compliant' } });
    assertModalDraftCount(dialog, 4);
    assertToolbarFilterCount(0);
    expect(screen.getByText('Deluge Pump Unit')).toBeInTheDocument();

    clickModalCancel(dialog);
    expect(screen.getByText('Deluge Pump Unit')).toBeInTheDocument();

    dialog = openFiltersModal(0);
    fireEvent.change(getSelectByLabel(dialog, 'Category'), { target: { value: 'Navigation & Bridge Equipment' } });
    fireEvent.change(getSelectByLabel(dialog, 'Availability'), { target: { value: 'Under Maintenance' } });
    clickModalApply(dialog);

    assertToolbarFilterCount(2);
    expect(screen.queryByText('Deluge Pump Unit')).toBeNull();
    expect(screen.getByText('Radar X-Band')).toBeInTheDocument();

    // Equipment tabs update immediately and sync into modal draft
    const eqTabs = screen.getByRole('tablist', { name: /equipment tabs/i });
    fireEvent.click(within(eqTabs).getByRole('tab', { name: /^non-compliant/i }));
    dialog = openFiltersModal(3);
    expect(getSelectByLabel(dialog, 'Compliance').value).toBe('Non-Compliant');
    clickModalClearAll(dialog);
    clickModalApply(dialog);
    assertToolbarFilterCount(0);
    expect(screen.getByText('Deluge Pump Unit')).toBeInTheDocument();
  });

  it('10. InspectorWorkspaceView: defers Location filter until Apply across Queue rows', () => {
    useMapStore.setState({
      activePersona: 'Inspector',
      activeSessionUserId: 'USR-301',
      users: [
        makeUser({
          id: 'USR-301',
          name: 'N. Technical',
          roles: ['Inspector'],
          organization: 'Bureau Veritas',
        }),
      ],
      vessels: [
        makeVessel({ id: 'VESSEL-1', name: 'MV Pacific Horn', imoNumber: '9123453' }),
        makeVessel({ id: 'VESSEL-4', name: 'MV Northern Tide', imoNumber: '9123454' }),
      ],
      assuranceSets: [
        makeSet({
          id: 'AS-2026-001',
          title: 'Fremantle Campaign',
          vesselId: 'VESSEL-1',
          vesselName: 'MV Pacific Horn',
          assignedInspector: 'N. Technical',
          mandatoryInspectionRequired: true,
          inspectionCompleted: false,
        }),
        makeSet({
          id: 'AS-2026-004',
          title: 'Dampier Campaign',
          vesselId: 'VESSEL-4',
          vesselName: 'MV Northern Tide',
          assignedInspector: 'N. Technical',
          mandatoryInspectionRequired: true,
          inspectionCompleted: false,
        }),
      ],
    });

    render(<InspectorWorkspaceView />);

    let dialog = openFiltersModal(0);
    fireEvent.change(getSelectByLabel(dialog, 'Location'), { target: { value: 'Dampier, WA' } });
    assertModalDraftCount(dialog, 1);
    assertToolbarFilterCount(0);
    expect(screen.getByText('MV Pacific Horn')).toBeInTheDocument();

    clickModalCancel(dialog);
    expect(screen.getByText('MV Pacific Horn')).toBeInTheDocument();

    dialog = openFiltersModal(0);
    fireEvent.change(getSelectByLabel(dialog, 'Location'), { target: { value: 'Dampier, WA' } });
    clickModalApply(dialog);

    assertToolbarFilterCount(1);
    expect(screen.queryByText('MV Pacific Horn')).toBeNull();
    expect(screen.getByText('MV Northern Tide')).toBeInTheDocument();

    dialog = openFiltersModal(1);
    clickModalClearAll(dialog);
    assertToolbarFilterCount(1);
    clickModalApply(dialog);
    assertToolbarFilterCount(0);
    expect(screen.getByText('MV Pacific Horn')).toBeInTheDocument();
  });

  it('11. MarketplaceView: defers Category/Provider/Location/Availability/Dates and guards past availableOn dates', () => {
    const thirdPartyCrew = makeCrew({
      id: 'CREW-101',
      fullName: 'Capt. Henrik Solberg',
      organization: 'Meridian Marine Services Pty Ltd',
      currentVesselId: 'VESSEL-008',
      currentVesselName: 'MV Meridian Pioneer',
    });

    useMapStore.setState({
      activePersona: 'Administrator',
      users: [makeUser({ id: 'USR-101', name: 'K. Osei', roles: ['Administrator'] })],
      vessels: [],
      equipment: [],
      crew: [thirdPartyCrew],
      assuranceSets: [
        makeSet({
          id: 'AS-MKT-LOCK',
          title: 'Contracted Vessel Window',
          vesselId: 'VESSEL-008',
          vesselName: 'MV Meridian Pioneer',
          assuranceType: 'Vessel',
          charterWindowStart: '2099-06-01',
          charterWindowEnd: '2099-07-01',
          visibility: 'organization',
        }),
      ],
      documents: [],
    });

    render(<MarketplaceView />);
    expect(screen.getByText('MV Meridian Pioneer')).toBeInTheDocument();
    expect(screen.getByText('Capt. Henrik Solberg')).toBeInTheDocument();

    let dialog = openFiltersModal(0);

    // Past availableOn date before todayIso is rejected by onChange guard
    const availableOnInput = within(dialog).getByLabelText('Available date') as HTMLInputElement;
    fireEvent.change(availableOnInput, { target: { value: '2020-01-01' } });
    expect(availableOnInput.value).toBe('');
    assertModalDraftCount(dialog, 0);

    // Valid future availableOn, window (counts as 1), provider, location, status, and category stay in draft (6 Active)
    fireEvent.change(availableOnInput, { target: { value: '2099-06-15' } });
    fireEvent.change(within(dialog).getByLabelText('Available from'), { target: { value: '2027-01-01' } });
    fireEvent.change(within(dialog).getByLabelText('Available to'), { target: { value: '2027-06-01' } });
    fireEvent.change(getSelectByLabel(dialog, 'Category'), { target: { value: 'crew' } });
    fireEvent.change(getSelectByLabel(dialog, 'Provider'), { target: { value: 'Meridian Marine Services Pty Ltd' } });
    fireEvent.change(getSelectByLabel(dialog, 'Location'), { target: { value: 'Darwin' } });
    fireEvent.change(getSelectByLabel(dialog, 'Availability'), { target: { value: 'On Assignment' } });
    assertModalDraftCount(dialog, 6);
    assertToolbarFilterCount(0);
    expect(screen.getByText('MV Meridian Pioneer')).toBeInTheDocument();

    clickModalCancel(dialog);
    expect(screen.getByText('MV Meridian Pioneer')).toBeInTheDocument();

    // Applying availableOn=2099-06-15 excludes contracted MV Meridian Pioneer
    dialog = openFiltersModal(0);
    fireEvent.change(within(dialog).getByLabelText('Available date'), { target: { value: '2099-06-15' } });
    clickModalApply(dialog);
    assertToolbarFilterCount(1);
    expect(screen.queryByText('MV Meridian Pioneer')).toBeNull();
    expect(screen.getByText('Capt. Henrik Solberg')).toBeInTheDocument();

    // Clear All inside modal stays deferred until Apply
    dialog = openFiltersModal(1);
    clickModalClearAll(dialog);
    assertToolbarFilterCount(1);
    clickModalApply(dialog);
    assertToolbarFilterCount(0);
    expect(screen.getByText('MV Meridian Pioneer')).toBeInTheDocument();

    // External Marketplace tab updates Category immediately and syncs into modal draft
    const mktTabs = screen.getByRole('tablist', { name: /marketplace tabs/i });
    fireEvent.click(within(mktTabs).getByRole('tab', { name: /^crew/i }));
    dialog = openFiltersModal(1);
    expect(getSelectByLabel(dialog, 'Category').value).toBe('crew');
    clickModalCancel(dialog);
  });

  it('12. NotificationsView: defers Category filter until Apply and discards Cancel/unapplied Clear All', () => {
    useMapStore.setState({
      activePersona: 'Administrator',
      activeSessionUserId: 'USR-101',
      users: [makeUser({ id: 'USR-101', name: 'K. Osei', roles: ['Administrator'] })],
      notifications: [
        makeNotification({
          id: 'NTF-1',
          type: 'assurance_set_request',
          subject: 'Requesting Assurance Set',
        }),
        makeNotification({
          id: 'NTF-2',
          type: 'approval_decision',
          subject: 'Approval Signed Off',
        }),
      ],
    });

    render(<NotificationsView />);
    expect(screen.getByText('Requesting Assurance Set')).toBeInTheDocument();
    expect(screen.getByText('Approval Signed Off')).toBeInTheDocument();

    let dialog = openFiltersModal(0);
    fireEvent.change(getSelectByLabel(dialog, 'Category'), { target: { value: 'Approval' } });
    assertModalDraftCount(dialog, 1);
    assertToolbarFilterCount(0);
    expect(screen.getByText('Requesting Assurance Set')).toBeInTheDocument();

    clickModalCancel(dialog);
    expect(screen.getByText('Requesting Assurance Set')).toBeInTheDocument();

    dialog = openFiltersModal(0);
    fireEvent.change(getSelectByLabel(dialog, 'Category'), { target: { value: 'Approval' } });
    clickModalApply(dialog);

    assertToolbarFilterCount(1);
    expect(screen.queryByText('Requesting Assurance Set')).toBeNull();
    expect(screen.getByText('Approval Signed Off')).toBeInTheDocument();

    dialog = openFiltersModal(1);
    clickModalClearAll(dialog);
    assertToolbarFilterCount(1);
    clickModalApply(dialog);
    assertToolbarFilterCount(0);
    expect(screen.getByText('Requesting Assurance Set')).toBeInTheDocument();
  });

  it('13. ProjectView: defers Status and Type filters until Apply and syncs Project tabs into draft', () => {
    useMapStore.setState({
      activePersona: 'Administrator',
      projects: [
        makeProject({ id: 'PRJ-1', name: 'Offshore Campaign Alpha', status: 'Draft', projectType: 'Charter / Voyage' }),
        makeProject({
          id: 'PRJ-2',
          name: 'ROV Lease Beta',
          status: 'Ready for Charter',
          projectType: 'Equipment Rental',
        }),
      ],
      assuranceSets: [],
    });

    render(<ProjectView />);

    let dialog = openFiltersModal(0);
    fireEvent.change(getSelectByLabel(dialog, 'Status'), { target: { value: 'Ready for Charter' } });
    fireEvent.change(getSelectByLabel(dialog, 'Type'), { target: { value: 'Equipment Rental' } });
    assertModalDraftCount(dialog, 2);
    assertToolbarFilterCount(0);
    expect(screen.getByText('Offshore Campaign Alpha')).toBeInTheDocument();

    clickModalCancel(dialog);
    expect(screen.getByText('Offshore Campaign Alpha')).toBeInTheDocument();

    dialog = openFiltersModal(0);
    fireEvent.change(getSelectByLabel(dialog, 'Status'), { target: { value: 'Ready for Charter' } });
    fireEvent.change(getSelectByLabel(dialog, 'Type'), { target: { value: 'Equipment Rental' } });
    clickModalApply(dialog);

    assertToolbarFilterCount(2);
    expect(screen.queryByText('Offshore Campaign Alpha')).toBeNull();
    expect(screen.getByText('ROV Lease Beta')).toBeInTheDocument();

    dialog = openFiltersModal(2);
    clickModalClearAll(dialog);
    assertToolbarFilterCount(2);
    clickModalApply(dialog);
    assertToolbarFilterCount(0);

    // External Project tab syncs into Status select when reopened
    const projectTabs = screen.getByRole('tablist', { name: /project tabs/i });
    fireEvent.click(within(projectTabs).getByRole('tab', { name: /^draft/i }));
    dialog = openFiltersModal(1);
    expect(getSelectByLabel(dialog, 'Status').value).toBe('Draft');
    clickModalCancel(dialog);
  });

  it('14. VerifierWorkspaceView: defers Type and Verification filters until Apply and discards Cancel/Clear All', () => {
    useMapStore.setState({
      activePersona: 'Verifier',
      activeSessionUserId: 'USR-201',
      users: [
        makeUser({
          id: 'USR-201',
          name: 'A. Fontaine',
          roles: ['Verifier'],
          organization: 'Bureau Veritas',
        }),
      ],
      documents: [
        makeDoc({
          id: 'DOC-V1',
          title: 'Hull Integrity Cert',
          entityType: 'Vessel Certificate',
          verificationStatus: 'Pending',
        }),
        makeDoc({
          id: 'DOC-V2',
          title: 'STCW Engineer Endorsement',
          entityType: 'Crew Certificate',
          verificationStatus: 'Correction Requested',
        }),
      ],
      assuranceSets: [
        makeSet({
          id: 'AS-VER-1',
          title: 'Verification Set 1',
          assignedVerifier: 'A. Fontaine',
          stage: 'Verification',
          requirements: [
            {
              id: 'REQ-1',
              category: 'Statutory Certificate',
              title: 'Hull Integrity Cert',
              documentId: 'DOC-V1',
              isMandatory: true,
              isFulfilled: false,
              ocrConfidence: 95,
              verifierStatus: 'Pending',
            },
            {
              id: 'REQ-2',
              category: 'Crew Certificate',
              title: 'STCW Engineer Endorsement',
              documentId: 'DOC-V2',
              isMandatory: true,
              isFulfilled: false,
              ocrConfidence: 93,
              verifierStatus: 'Correction Requested',
            },
          ],
        }),
      ],
    });

    render(<VerifierWorkspaceView />);
    const verifTabs = screen.getByRole('tablist', { name: /verifier queue tabs/i });
    fireEvent.click(within(verifTabs).getByRole('tab', { name: /^all/i }));

    let dialog = openFiltersModal(0);
    fireEvent.change(getSelectByLabel(dialog, 'Type'), { target: { value: 'Crew Certificate' } });
    fireEvent.change(getSelectByLabel(dialog, 'Verification'), { target: { value: 'Correction Requested' } });
    assertModalDraftCount(dialog, 2);
    assertToolbarFilterCount(0);
    expect(screen.getByText('Hull Integrity Cert')).toBeInTheDocument();

    clickModalCancel(dialog);
    expect(screen.getByText('Hull Integrity Cert')).toBeInTheDocument();

    dialog = openFiltersModal(0);
    fireEvent.change(getSelectByLabel(dialog, 'Type'), { target: { value: 'Crew Certificate' } });
    fireEvent.change(getSelectByLabel(dialog, 'Verification'), { target: { value: 'Correction Requested' } });
    clickModalApply(dialog);

    assertToolbarFilterCount(2);
    expect(screen.queryByText('Hull Integrity Cert')).toBeNull();
    expect(screen.getByText('STCW Engineer Endorsement')).toBeInTheDocument();

    dialog = openFiltersModal(2);
    clickModalClearAll(dialog);
    assertToolbarFilterCount(2);
    clickModalApply(dialog);
    assertToolbarFilterCount(0);
    expect(screen.getByText('Hull Integrity Cert')).toBeInTheDocument();
  });
});

