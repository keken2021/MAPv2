import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { AssuranceTable } from '../components/tables/AssuranceTable';
import { VesselTable } from '../components/tables/VesselTable';
import { AssuranceSet } from '../types/assurance';
import { VesselInformation } from '../types/vessel';
import { UserProfile } from '../types/user';
import { MOCK_ASSURANCE_SETS } from '../store/mockData';

describe('AssuranceTable and VesselTable per-person session filtering', () => {
  const baseSet = MOCK_ASSURANCE_SETS[0];

  const mockUserVerifier1: UserProfile = {
    id: 'USR-V1',
    name: 'A. Fontaine',
    email: 'a.fontaine@bureauveritas.com',
    roles: ['Verifier'],
    userType: 'Third-Party',
    organization: 'Bureau Veritas Inspectorate',
    status: 'Active',
    departmentOrScope: 'Statutory Verification & Audit',
    lastActive: '2026-10-29 12:00 UTC',
  };

  const mockUserVerifier2: UserProfile = {
    id: 'USR-V2',
    name: 'J. Dupont',
    email: 'j.dupont@bureauveritas.com',
    roles: ['Verifier'],
    userType: 'Third-Party',
    organization: 'Bureau Veritas Inspectorate',
    status: 'Active',
    departmentOrScope: 'Statutory Verification & Audit',
    lastActive: '2026-10-29 12:00 UTC',
  };

  const mockSubmitterChen: UserProfile = {
    id: 'USR-SUB-1',
    name: 'M. Chen',
    email: 'm.chen@northwind.com',
    roles: ['Submitter'],
    userType: 'Organization',
    organization: 'Northwind Marine Pty Ltd',
    status: 'Active',
    departmentOrScope: 'Vessel Operations & Logistics',
    lastActive: '2026-10-29 12:00 UTC',
  };

  const mockSubmitterRamirez: UserProfile = {
    id: 'USR-SUB-2',
    name: 'E. Ramirez',
    email: 'e.ramirez@northwind.com',
    roles: ['Submitter'],
    userType: 'Organization',
    organization: 'Northwind Marine Pty Ltd',
    status: 'Active',
    departmentOrScope: 'Vessel Operations & Logistics',
    lastActive: '2026-10-29 12:00 UTC',
  };

  const setA: AssuranceSet = {
    ...baseSet,
    id: 'AS-TEST-001',
    title: 'Fontaine Inspection Campaign',
    visibility: 'public',
    stage: 'Verification',
    serviceProviderOrg: 'Northwind Marine Pty Ltd',
    clientOrg: 'Bureau Veritas Inspectorate',
    assignedSubmitter: undefined,
    assignedVerifier: 'A. Fontaine (Bureau Veritas Inspectorate)',
    vesselId: 'VESSEL-001',
    vesselName: 'MV Northwind Alpha',
    stakeholders: {
      verifierOrg: 'Bureau Veritas Inspectorate',
    },
  };

  const setB: AssuranceSet = {
    ...baseSet,
    id: 'AS-TEST-002',
    title: 'Dupont Verification Campaign',
    visibility: 'public',
    stage: 'Verification',
    serviceProviderOrg: 'Northwind Marine Pty Ltd',
    clientOrg: 'Bureau Veritas Inspectorate',
    assignedSubmitter: undefined,
    assignedVerifier: 'J. Dupont (Bureau Veritas Inspectorate)',
    vesselId: 'VESSEL-002',
    vesselName: 'MV Northwind Beta',
    stakeholders: {
      verifierOrg: 'Bureau Veritas Inspectorate',
    },
  };

  const setChen: AssuranceSet = {
    ...baseSet,
    id: 'AS-SUB-001',
    title: 'Chen Submitter Campaign',
    visibility: 'public',
    stage: 'Verification',
    serviceProviderOrg: 'Northwind Marine Pty Ltd',
    assignedSubmitter: 'M. Chen (Northwind Marine Pty Ltd)',
    assignedVerifier: undefined,
    vesselId: 'VESSEL-001',
    vesselName: 'MV Northwind Alpha',
  };

  const setRamirez: AssuranceSet = {
    ...baseSet,
    id: 'AS-SUB-002',
    title: 'Ramirez Submitter Campaign',
    visibility: 'public',
    stage: 'Verification',
    serviceProviderOrg: 'Northwind Marine Pty Ltd',
    assignedSubmitter: 'E. Ramirez (Northwind Marine Pty Ltd)',
    assignedVerifier: undefined,
    vesselId: 'VESSEL-002',
    vesselName: 'MV Northwind Beta',
  };

  const vessel1: VesselInformation = {
    id: 'VESSEL-001',
    name: 'MV Northwind Alpha',
    imoNumber: '9111111',
    registeredOwner: 'Northwind Marine Pty Ltd',
    status: 'Active',
    vesselType: 'AHTS',
  } as VesselInformation;

  const vessel2: VesselInformation = {
    id: 'VESSEL-002',
    name: 'MV Northwind Beta',
    imoNumber: '9222222',
    registeredOwner: 'Northwind Marine Pty Ltd',
    status: 'Active',
    vesselType: 'PSV',
  } as VesselInformation;

  beforeEach(() => {
    useMapStore.setState({
      users: [mockUserVerifier1, mockUserVerifier2, mockSubmitterChen, mockSubmitterRamirez],
      vessels: [vessel1, vessel2],
      assuranceSets: [setA, setB, setChen, setRamirez],
      projects: [],
      documents: [],
      activeDemoOrganization: 'Bureau Veritas Inspectorate',
      activePersona: 'Verifier',
      activeSessionUserId: 'USR-V1',
      isAuthenticated: true,
    });
  });

  it('renders different Assurance Sets lists for two Verifiers in the same organization', () => {
    // Verifier 1 (A. Fontaine)
    const { unmount } = render(<AssuranceTable onSelectSet={() => {}} defaultTab="organization" />);
    expect(screen.getByText('Fontaine Inspection Campaign')).toBeInTheDocument();
    expect(screen.queryByText('Dupont Verification Campaign')).toBeNull();
    unmount();

    // Switch to Verifier 2 (J. Dupont)
    useMapStore.setState({
      activeSessionUserId: 'USR-V2',
    });
    render(<AssuranceTable onSelectSet={() => {}} defaultTab="organization" />);
    expect(screen.queryByText('Fontaine Inspection Campaign')).toBeNull();
    expect(screen.getByText('Dupont Verification Campaign')).toBeInTheDocument();
  });

  it('renders only vessels from their own sets for Submitter', () => {
    // Submitter M. Chen
    useMapStore.setState({
      activePersona: 'Submitter',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
      activeSessionUserId: 'USR-SUB-1',
    });

    const { unmount } = render(<VesselTable onSelectVessel={() => {}} />);
    expect(screen.getByText('MV Northwind Alpha')).toBeInTheDocument();
    expect(screen.queryByText('MV Northwind Beta')).toBeNull();
    unmount();

    // Submitter E. Ramirez
    useMapStore.setState({
      activeSessionUserId: 'USR-SUB-2',
    });
    render(<VesselTable onSelectVessel={() => {}} />);
    expect(screen.queryByText('MV Northwind Alpha')).toBeNull();
    expect(screen.getByText('MV Northwind Beta')).toBeInTheDocument();
  });
});
