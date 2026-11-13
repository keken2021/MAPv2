/*
  file summary: tests assurance set Contract Period date gating to the project window across all MAPv2 screens.
  responsibilities: verifies CreateAssuranceSetView, AssuranceDetailView inline edit, and AttachAssuranceSetPreviewModal respect project date bounds.
  role in system: covers design decisions in docs/plans/2026-11-13-assurance-contract-date-gating.md.
*/

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { CreateAssuranceSetView } from '../views/CreateAssuranceSetView';
import { AssuranceDetailView } from '../views/AssuranceDetailView';
import { AttachAssuranceSetPreviewModal } from '../components/modals/AttachAssuranceSetPreviewModal';
import { AssuranceSet, DatePermissionGrant } from '../types/assurance';
import { Project } from '../types/project';
import { UserProfile } from '../types/user';

const initialState = useMapStore.getState();

const testAdminUser: UserProfile = {
  id: 'USR-ADMIN-01',
  name: 'A. Admin',
  email: 'admin@northwindmarine.com.au',
  roles: ['Administrator'],
  userType: 'Organization',
  organization: 'Northwind Marine Pty Ltd',
  departmentOrScope: 'Operations',
  status: 'Active',
  lastActive: '2026-11-13 08:00 UTC',
};

const testProject: Project = {
  id: 'MAP-PROJ-TEST-001',
  name: 'Test Offshore Campaign',
  description: 'Test Offshore Campaign description',
  projectType: 'Charter / Voyage',
  requestingOrganization: 'Northwind Marine Pty Ltd',
  clientOperator: 'Northwind Marine Pty Ltd',
  operatorOrganization: 'Northwind Marine Pty Ltd',
  charterer: 'Northwind Marine Pty Ltd',
  location: 'Dampier',
  charterWindowStart: '2026-12-01',
  charterWindowEnd: '2027-02-28',
  status: 'Composing',
  assetLinks: [],
};

const expiredProject: Project = {
  id: 'MAP-PROJ-TEST-EXPIRED',
  name: 'Past Offshore Campaign',
  description: 'Past Offshore Campaign description',
  projectType: 'Charter / Voyage',
  requestingOrganization: 'Northwind Marine Pty Ltd',
  clientOperator: 'Northwind Marine Pty Ltd',
  operatorOrganization: 'Northwind Marine Pty Ltd',
  charterer: 'Northwind Marine Pty Ltd',
  location: 'Dampier',
  charterWindowStart: '2025-01-01',
  charterWindowEnd: '2025-06-30',
  status: 'Composing',
  assetLinks: [],
};

const baseSet: AssuranceSet = {
  id: 'AS-TEST-GATING-01',
  title: 'Test Gating Vessel Set',
  vesselId: 'VESSEL-001',
  vesselName: 'MV Pacific Endeavour',
  imoNumber: '9123453',
  assuranceType: 'Vessel',
  subtypes: ['Vessel'],
  initiatorOrg: 'Northwind Marine Pty Ltd',
  initiatorRole: 'Vessel Provider Admin',
  charterer: 'Northwind Marine Pty Ltd',
  clientOrg: 'Northwind Marine Pty Ltd',
  serviceProviderOrg: 'Northwind Marine Pty Ltd',
  charterWindowStart: '2026-12-01',
  complianceDeadline: '2026-12-01',
  charterWindowEnd: '2027-02-15',
  stage: 'Initiated',
  readinessScore: 20,
  mandatoryInspectionRequired: false,
  inspectionCompleted: false,
  verificationRequired: true,
  formalApprovalRequired: true,
  assignedSubmitter: 'M. Chen (Northwind Marine Pty Ltd)',
  assignedVerifier: 'L. Ferreira (XY Marine Services)',
  assignedApprover: 'S. Rahman (XY Marine Services)',
  reviewMode: 'third_party',
  requirements: [],
  visibility: 'organization',
};

describe('Assurance Set Contract Period Date Gating', () => {
  beforeEach(() => {
    useMapStore.setState(initialState, true);
    useMapStore.setState({
      isAuthenticated: true,
      activePersona: 'Administrator',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
      activeSessionUserId: 'USR-ADMIN-01',
      users: [...initialState.users, testAdminUser],
      projects: [...initialState.projects, testProject, expiredProject],
    });
  });

  describe('CreateAssuranceSetView', () => {
    it('sets min and max from the selected project and shows the project window hint', async () => {
      render(<CreateAssuranceSetView />);

      const projectSelect = screen.getByLabelText(/Project/i);
      fireEvent.change(projectSelect, { target: { value: 'MAP-PROJ-TEST-001' } });

      const startInput = screen.getByLabelText(/Contract Period Start/i) as HTMLInputElement;
      const endInput = screen.getByLabelText(/Contract Period End/i) as HTMLInputElement;

      expect(startInput.min).toBe('2026-12-01');
      expect(startInput.max).toBe('2027-02-28');
      expect(endInput.max).toBe('2027-02-28');

      expect(screen.getByTestId('project-window-hint')).toHaveTextContent(
        'Project window: 2026-12-01 to 2027-02-28',
      );
    });

    it('clamps dates and triggers setDateNotice when switching project with dates outside the window', async () => {
      render(<CreateAssuranceSetView />);

      const startInput = screen.getByLabelText(/Contract Period Start/i);
      const endInput = screen.getByLabelText(/Contract Period End/i);

      fireEvent.change(startInput, { target: { value: '2026-10-01' } });
      fireEvent.change(endInput, { target: { value: '2027-05-01' } });

      const projectSelect = screen.getByLabelText(/Project/i);
      fireEvent.change(projectSelect, { target: { value: 'MAP-PROJ-TEST-001' } });

      expect(startInput).toHaveValue('2026-12-01');
      expect(endInput).toHaveValue('2027-02-28');

      expect(screen.getByTestId('date-change-notice')).toHaveTextContent(
        'Contract Period moved to 2026-12-01 – 2027-02-28 to fit inside the project window.',
      );
    });

    it('blocks an out-of-window submit with a field error', async () => {
      render(<CreateAssuranceSetView />);

      const titleInput = screen.getByLabelText(/Title/i);
      fireEvent.change(titleInput, { target: { value: 'Gating Out of Window Test Title' } });

      const projectSelect = screen.getByLabelText(/Project/i);
      fireEvent.change(projectSelect, { target: { value: 'MAP-PROJ-TEST-001' } });

      const startInput = screen.getByLabelText(/Contract Period Start/i);
      fireEvent.change(startInput, { target: { value: '2026-10-01' } });

      const nextButton = screen.getByRole('button', { name: /^Next$/i });
      fireEvent.click(nextButton);

      expect(
        screen.getByText(/Contract Period must be inside the project window \(2026-12-01 to 2027-02-28\)\./i),
      ).toBeInTheDocument();
    });

    it('shows message and blocks submit when the project window has already ended', async () => {
      render(<CreateAssuranceSetView />);

      const titleInput = screen.getByLabelText(/Title/i);
      fireEvent.change(titleInput, { target: { value: 'Gating Expired Window Test' } });

      const projectSelect = screen.getByLabelText(/Project/i);
      fireEvent.change(projectSelect, { target: { value: 'MAP-PROJ-TEST-EXPIRED' } });

      expect(screen.getByTestId('project-window-ended-notice')).toHaveTextContent(
        "This project's window has ended. Change the project dates first.",
      );

      const nextButton = screen.getByRole('button', { name: /^Next$/i });
      fireEvent.click(nextButton);

      expect(
        screen.getAllByText("This project's window has ended. Change the project dates first.").length,
      ).toBeGreaterThanOrEqual(1);
    });
  });

  describe('AssuranceDetailView inline Contract Period edit', () => {
    const cAdminUser: UserProfile = {
      id: 'USR-228',
      name: 'A. Okonkwo',
      email: 'a.okonkwo@oilcompany.com',
      roles: ['C Admin'],
      userType: 'Organization',
      organization: 'Oil Company',
      departmentOrScope: 'Operations',
      status: 'Active',
      lastActive: '2026-11-13 08:00 UTC',
    };

    const oilCoProject: Project = {
      id: 'MAP-PROJ-TEST-OILCO',
      name: 'Oil Company Field Campaign',
      description: 'Oil Company Field Campaign description',
      projectType: 'Charter / Voyage',
      requestingOrganization: 'Oil Company',
      clientOperator: 'Oil Company',
      operatorOrganization: 'Oil Company',
      charterer: 'Oil Company',
      location: 'Browse Basin',
      charterWindowStart: '2026-12-01',
      charterWindowEnd: '2027-02-28',
      status: 'Composing',
      assetLinks: [],
    };

    const dateGrant: DatePermissionGrant = {
      id: 'GRANT-01',
      userId: 'USR-228',
      userName: 'A. Okonkwo',
      grantedBy: 'USR-228',
      grantedAt: '2026-11-01T00:00:00Z',
      expiresAt: '2027-11-01T00:00:00Z',
      reason: 'Authorized for date changes',
    };

    beforeEach(() => {
      useMapStore.setState({
        activePersona: 'C Admin',
        activeDemoOrganization: 'Oil Company',
        activeSessionUserId: 'USR-228',
        users: [...initialState.users, cAdminUser],
        projects: [...initialState.projects, oilCoProject],
      });
    });

    it('combines minCharterDate with project bounds and displays project window hint', async () => {
      const setWithProject: AssuranceSet = {
        ...baseSet,
        id: 'AS-TEST-DETAIL-01',
        clientOrg: 'Oil Company',
        charterer: 'Oil Company',
        serviceProviderOrg: 'Northwind Marine Pty Ltd',
        projectId: 'MAP-PROJ-TEST-OILCO',
        projectName: 'Oil Company Field Campaign',
        datePermissionGrants: [dateGrant],
      };

      useMapStore.setState((state) => ({
        assuranceSets: [...state.assuranceSets, setWithProject],
      }));

      render(<AssuranceDetailView setId={setWithProject.id} />);

      const editButton = screen.getByRole('button', { name: 'Edit' });
      fireEvent.click(editButton);

      const startInput = screen.getByLabelText(/^Start/i) as HTMLInputElement;
      const endInput = screen.getByLabelText(/^End/i) as HTMLInputElement;

      expect(startInput.min).toBe('2026-12-01');
      expect(startInput.max).toBe('2027-02-28');
      expect(endInput.max).toBe('2027-02-28');

      expect(screen.getByTestId('detail-project-window-hint')).toHaveTextContent(
        'Project window: 2026-12-01 to 2027-02-28',
      );
    });

    it('blocks an out-of-window save with an error message', async () => {
      const setWithProject: AssuranceSet = {
        ...baseSet,
        id: 'AS-TEST-DETAIL-02',
        clientOrg: 'Oil Company',
        charterer: 'Oil Company',
        serviceProviderOrg: 'Northwind Marine Pty Ltd',
        projectId: 'MAP-PROJ-TEST-OILCO',
        projectName: 'Oil Company Field Campaign',
        datePermissionGrants: [dateGrant],
      };

      useMapStore.setState((state) => ({
        assuranceSets: [...state.assuranceSets, setWithProject],
      }));

      render(<AssuranceDetailView setId={setWithProject.id} />);

      const editButton = screen.getByRole('button', { name: 'Edit' });
      fireEvent.click(editButton);

      const endInput = screen.getByLabelText(/^End/i);
      fireEvent.change(endInput, { target: { value: '2027-04-01' } });

      const reasonInput = screen.getByLabelText(/Reason for Date Change/i);
      fireEvent.change(reasonInput, { target: { value: 'Operational scope extension' } });

      const saveButton = screen.getByRole('button', { name: 'Save' });
      fireEvent.click(saveButton);

      expect(
        screen.getByText('Contract Period must be inside the project window (2026-12-01 to 2027-02-28).'),
      ).toBeInTheDocument();
    });
  });

  describe('AttachAssuranceSetPreviewModal', () => {
    it('sets min/max and hint from the target project, and disables Confirm while dates are outside', () => {
      const onConfirm = vi.fn();
      const onClose = vi.fn();

      render(
        <AttachAssuranceSetPreviewModal
          isOpen={true}
          onClose={onClose}
          assuranceSet={baseSet}
          project={testProject}
          onConfirm={onConfirm}
        />,
      );

      const startInput = screen.getByLabelText(/Contract Period Start/i) as HTMLInputElement;
      const endInput = screen.getByLabelText(/Contract Period End/i) as HTMLInputElement;

      expect(startInput.min).toBe('2026-12-01');
      expect(startInput.max).toBe('2027-02-28');
      expect(endInput.max).toBe('2027-02-28');

      expect(screen.getByTestId('attach-project-window-hint')).toHaveTextContent(
        'Project window: 2026-12-01 to 2027-02-28',
      );

      const confirmButton = screen.getByRole('button', { name: /Attach Assurance Set/i });
      expect(confirmButton).not.toBeDisabled();

      fireEvent.change(startInput, { target: { value: '2026-10-01' } });
      expect(confirmButton).toBeDisabled();

      fireEvent.change(startInput, { target: { value: '2026-12-05' } });
      expect(confirmButton).not.toBeDisabled();

      fireEvent.change(endInput, { target: { value: '2027-05-01' } });
      expect(confirmButton).toBeDisabled();
    });
  });
});
