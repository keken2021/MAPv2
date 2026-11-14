/*
  file summary: tests for LinkedObjectDatasheetDrawer and eye button RBAC in AssuranceDetailView.
  responsibilities: verifies read-only live datasheets per object type, absence of contact details for crew, change notes against sign-off snapshots, and assigned vs unassigned vs admin eye button behavior.
  role in system: validates acceptance criteria for Task 5483.
*/

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { LinkedObjectDatasheetDrawer } from '../components/drawers/LinkedObjectDatasheetDrawer';
import { AssuranceDetailView } from '../views/AssuranceDetailView';
import { useMapStore } from '../store/useMapStore';
import { AssuranceSet, DatasheetSnapshot } from '../types/assurance';
import { VesselInformation } from '../types/vessel';
import { EquipmentAsset } from '../types/equipment';
import { CrewMember } from '../types/crew';

const mockVessel: VesselInformation = {
  id: 'VES-101',
  name: 'Ocean Pioneer',
  imoNumber: '9123456',
  flagState: 'Marshall Islands',
  vesselType: 'Offshore Support',
  vesselSubtype: 'Platform Supply Vessel',
  classificationSociety: 'DNV',
  yearBuilt: 2018,
  registeredOwner: 'Pioneer Offshore Ltd',
  lengthOverallMeters: 85.5,
  beamMeters: 18.2,
  draftMeters: 6.4,
} as unknown as VesselInformation;

const mockEquipment: EquipmentAsset = {
  id: 'EQ-201',
  name: 'Hydraulic Winch A1',
  equipmentIdentifier: 'WINCH-TAG-99',
  serialNumber: 'SN-778899',
  category: 'Deck Machinery',
  manufacturer: 'Rolls-Royce Marine',
  model: 'HW-500',
  owningOrganization: 'Subsea Solutions',
  parentVesselId: 'VES-101',
} as unknown as EquipmentAsset;

const mockCrew: CrewMember = {
  id: 'CREW-301',
  fullName: 'Captain Jane Smith',
  rank: 'Master',
  organization: 'Global Crewing Services',
  nationality: 'British',
  email: 'jane.smith@secret-crewing.com',
  phoneNumber: '+44 7700 900077',
} as unknown as CrewMember;

const baseSet: AssuranceSet = {
  id: 'SET-TEST-01',
  title: 'Pioneer North Sea Campaign',
  vesselId: 'VES-101',
  vesselName: 'Ocean Pioneer',
  imoNumber: '9123456',
  stage: 'Approval',
  status: 'In Progress',
  serviceProviderOrg: 'Pioneer Offshore Ltd',
  createdByUserId: 'USR-ADMIN',
  createdByName: 'Creishen Ayuman',
  createdByPersona: 'Administrator',
  assignedSubmitter: 'J. Submitter (Pioneer Offshore Ltd)',
  assignedVerifier: 'V. Verifier (DNV)',
  assignedInspector: 'I. Inspector (Bureau Veritas)',
  assignedApprover: 'A. Approver (Chevron Australia Pty Ltd)',
  clientOrganization: 'Chevron Australia Pty Ltd',
  mandatoryInspectionRequired: true,
  inspectionCompleted: true,
  formalApprovalRequired: true,
  approverDecision: 'Pending',
  assuranceObjects: [
    {
      id: 'VES-101',
      name: 'Ocean Pioneer',
      type: 'vessel',
      identifier: 'IMO: 9123456',
      ownerOrganization: 'Pioneer Offshore Ltd',
    },
    {
      id: 'EQ-201',
      name: 'Hydraulic Winch A1',
      type: 'equipment',
      identifier: 'WINCH-TAG-99',
      ownerOrganization: 'Subsea Solutions',
    },
    {
      id: 'CREW-301',
      name: 'Captain Jane Smith',
      type: 'person',
      ownerOrganization: 'Global Crewing Services',
    },
  ],
  requirements: [
    {
      id: 'REQ-1',
      title: 'Class Certificate',
      verifierStatus: 'Verified',
      isFulfilled: true,
      targetObjectId: 'VES-101',
    },
  ],
} as unknown as AssuranceSet;

describe('LinkedObjectDatasheetDrawer', () => {
  beforeEach(() => {
    useMapStore.setState({
      vessels: [mockVessel],
      equipment: [mockEquipment],
      crew: [mockCrew],
      assuranceObjects: baseSet.assuranceObjects,
    });
  });

  it('renders vessel datasheet with A6 public fields and dimensions', () => {
    render(
      <LinkedObjectDatasheetDrawer
        isOpen={true}
        onClose={vi.fn()}
        objectId="VES-101"
        objectType="vessel"
        assuranceSet={baseSet}
      />,
    );

    expect(screen.getByTestId('linked-object-datasheet-drawer')).toBeInTheDocument();
    expect(screen.getAllByText('Ocean Pioneer').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('9123456')).toBeInTheDocument();
    expect(screen.getByText('Marshall Islands')).toBeInTheDocument();
    expect(screen.getByText('Platform Supply Vessel')).toBeInTheDocument();
    expect(screen.getByText('DNV')).toBeInTheDocument();
    expect(screen.getByText('2018')).toBeInTheDocument();
    expect(screen.getByText('Pioneer Offshore Ltd')).toBeInTheDocument();
    expect(screen.getByText('85.5 m')).toBeInTheDocument();
    expect(screen.getByText('18.2 m')).toBeInTheDocument();
    expect(screen.getByText('6.4 m')).toBeInTheDocument();
  });

  it('renders equipment datasheet with tag, type, manufacturer, model, owning org, and parent vessel as plain text without links', () => {
    render(
      <LinkedObjectDatasheetDrawer
        isOpen={true}
        onClose={vi.fn()}
        objectId="EQ-201"
        objectType="equipment"
        assuranceSet={baseSet}
      />,
    );

    expect(screen.getAllByText('Hydraulic Winch A1').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('SN-778899')).toBeInTheDocument();
    expect(screen.getByText('Deck Machinery')).toBeInTheDocument();
    expect(screen.getByText('Rolls-Royce Marine')).toBeInTheDocument();
    expect(screen.getByText('HW-500')).toBeInTheDocument();
    expect(screen.getByText('Subsea Solutions')).toBeInTheDocument();

    const parentVesselCell = screen.getByTestId('datasheet-field-parentVesselName');
    expect(parentVesselCell).toHaveTextContent('Ocean Pioneer');
    expect(parentVesselCell.querySelector('a')).toBeNull();
    expect(parentVesselCell.querySelector('button')).toBeNull();
  });

  it('renders person datasheet with rank, employer, nationality, and strictly NO contact details', () => {
    render(
      <LinkedObjectDatasheetDrawer
        isOpen={true}
        onClose={vi.fn()}
        objectId="CREW-301"
        objectType="person"
        assuranceSet={baseSet}
      />,
    );

    expect(screen.getAllByText('Captain Jane Smith').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Master').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Global Crewing Services')).toBeInTheDocument();
    expect(screen.getByText('British')).toBeInTheDocument();

    // Must not expose email or phone number
    expect(screen.queryByText('jane.smith@secret-crewing.com')).not.toBeInTheDocument();
    expect(screen.queryByText('+44 7700 900077')).not.toBeInTheDocument();
  });

  it('displays change note when live field differs from sign-off snapshot', () => {
    const snapshot: DatasheetSnapshot = {
      objectId: 'VES-101',
      role: 'Approver',
      userId: 'USER-APPROVER-1',
      at: '2026-11-10T12:00:00Z',
      fields: {
        name: 'Ocean Pioneer',
        imoNumber: '9123456',
        classificationSociety: 'ABS', // Signed as ABS
      },
    };

    const setWithSnapshot: AssuranceSet = {
      ...baseSet,
      datasheetSnapshots: [snapshot],
    };

    // Live vessel has classificationSociety: 'DNV'
    render(
      <LinkedObjectDatasheetDrawer
        isOpen={true}
        onClose={vi.fn()}
        objectId="VES-101"
        objectType="vessel"
        assuranceSet={setWithSnapshot}
      />,
    );

    // Live value is displayed
    expect(screen.getByText('DNV')).toBeInTheDocument();

    // Change note is displayed
    const changeNote = screen.getByTestId('datasheet-change-note');
    expect(changeNote).toBeInTheDocument();
    expect(changeNote).toHaveTextContent(/Changed since Approver sign-off on 10 NOV 2026/);
    expect(changeNote).toHaveTextContent(/signed: ABS/);

    expect(screen.getByTestId('datasheet-changed-banner')).toBeInTheDocument();
  });

  it('does not display change note when live fields match sign-off snapshot', () => {
    const snapshot: DatasheetSnapshot = {
      objectId: 'VES-101',
      role: 'Approver',
      userId: 'USER-APPROVER-1',
      at: '2026-11-10T12:00:00Z',
      fields: {
        name: 'Ocean Pioneer',
        imoNumber: '9123456',
        classificationSociety: 'DNV', // Matches live
      },
    };

    const setWithSnapshot: AssuranceSet = {
      ...baseSet,
      datasheetSnapshots: [snapshot],
    };

    render(
      <LinkedObjectDatasheetDrawer
        isOpen={true}
        onClose={vi.fn()}
        objectId="VES-101"
        objectType="vessel"
        assuranceSet={setWithSnapshot}
      />,
    );

    expect(screen.queryByTestId('datasheet-change-note')).not.toBeInTheDocument();
    expect(screen.queryByTestId('datasheet-changed-banner')).not.toBeInTheDocument();
  });
});

describe('Eye button behavior in AssuranceDetailView for non-admins vs admins', () => {
  const submitterUser = {
    id: 'USR-SUB',
    name: 'J. Submitter',
    roles: ['Submitter'],
    organization: 'Pioneer Offshore Ltd',
    status: 'Active' as const,
  };

  const unassignedUser = {
    id: 'USR-UNASSIGNED',
    name: 'Unassigned Stranger',
    roles: ['Submitter'],
    organization: 'Other Random Firm',
    status: 'Active' as const,
  };

  const adminUser = {
    id: 'USR-ADMIN',
    name: 'Creishen Ayuman',
    roles: ['Administrator'],
    organization: 'Marine Assurance Platform Admin',
    status: 'Active' as const,
  };

  beforeEach(() => {
    useMapStore.setState({
      vessels: [mockVessel],
      equipment: [mockEquipment],
      crew: [mockCrew],
      assuranceSets: [baseSet],
      documents: [],
      auditEvents: [],
      users: [submitterUser, unassignedUser, adminUser] as unknown as any,
    });
  });

  it('assigned Submitter sees the eye button and clicking opens LinkedObjectDatasheetDrawer', () => {
    const setCurrentHashView = vi.fn();
    useMapStore.setState({
      activePersona: 'Submitter',
      activeSessionUserId: submitterUser.id,
      activeDemoOrganization: 'Pioneer Offshore Ltd',
      setCurrentHashView,
    });

    render(<AssuranceDetailView setId="SET-TEST-01" initialTab="objects" />);

    // Eye button for vessel should exist
    const eyeBtn = screen.getByTestId('view-object-btn-VES-101');
    expect(eyeBtn).toBeInTheDocument();

    // Click it
    fireEvent.click(eyeBtn);

    // Drawer should open
    expect(screen.getByTestId('linked-object-datasheet-drawer')).toBeInTheDocument();
    expect(screen.getByText('Specification Details')).toBeInTheDocument();

    // Non-admin must NOT have triggered route navigation to object page
    expect(setCurrentHashView).not.toHaveBeenCalled();
  });

  it('unassigned Submitter does NOT see the eye button on linked objects', () => {
    useMapStore.setState({
      activePersona: 'Submitter',
      activeSessionUserId: unassignedUser.id,
      activeDemoOrganization: 'Other Random Firm',
    });

    render(<AssuranceDetailView setId="SET-TEST-01" initialTab="objects" />);

    // Eye button should NOT be rendered
    expect(screen.queryByTestId('view-object-btn-VES-101')).toBeNull();
    expect(screen.queryByTestId('view-object-btn-EQ-201')).toBeNull();
  });

  it('Administrator sees the eye button and clicking navigates to object page route', () => {
    const setCurrentHashView = vi.fn();
    useMapStore.setState({
      activePersona: 'Administrator',
      activeSessionUserId: adminUser.id,
      activeDemoOrganization: 'Marine Assurance Platform Admin',
      setCurrentHashView,
    });

    render(<AssuranceDetailView setId="SET-TEST-01" initialTab="objects" />);

    const eyeBtn = screen.getByTestId('view-object-btn-VES-101');
    expect(eyeBtn).toBeInTheDocument();

    fireEvent.click(eyeBtn);

    // Administrator keeps router navigation to vessels page
    expect(setCurrentHashView).toHaveBeenCalledWith('vessels', 'VES-101');
    // Drawer should NOT open
    expect(screen.queryByTestId('linked-object-datasheet-drawer')).toBeNull();
  });
});
