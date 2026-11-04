import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  getRoleDashboardTiles,
  filterAssuranceSetsByDashboardFilter,
  filterCapaItemsByDashboardFilter,
  DashboardRole,
} from '../utils/dashboardTileNavigation';
import { SharedDashboardFrame } from '../components/dashboard/SharedDashboardFrame';
import { AssuranceTable } from '../components/tables/AssuranceTable';
import { CapaManagementView } from '../views/CapaManagementView';
import { VerifierWorkspaceView } from '../views/VerifierWorkspaceView';
import { InspectorWorkspaceView } from '../views/InspectorWorkspaceView';
import { ApproverDashboardView } from '../views/ApproverDashboardView';
import { useMapStore } from '../store/useMapStore';

describe('Dashboard KPI Tiles Navigation & Filtered Lists', () => {
  const fixedNow = new Date('2026-11-05T12:00:00Z');

  const mockAssuranceSets: any[] = [
    {
      id: 'AS-01',
      title: 'Alpha Vessel Survey',
      stage: 'Verification',
      initiatorOrg: 'Woodside Energy Ltd',
      assignedSubmitter: 'USR-1',
      assignedVerifier: '',
      assignedInspector: 'USR-3',
      assignedApprover: 'USR-4',
      targetDate: '2026-11-02T00:00:00Z', // overdue
      requirements: [{ id: 'R1', verifierStatus: 'Correction Requested', isFulfilled: false }],
    },
    {
      id: 'AS-02',
      title: 'Beta Rig Inspection',
      stage: 'Verification',
      initiatorOrg: 'Woodside Energy Ltd',
      assignedSubmitter: 'USR-1',
      assignedVerifier: 'USR-2',
      assignedInspector: 'USR-3',
      assignedApprover: 'USR-4',
      targetDate: '2026-11-08T00:00:00Z', // due this week (3 days)
      requirements: [{ id: 'R2', verifierStatus: 'Pending Review', isFulfilled: false, isResubmitted: true }],
      hasActiveEscalationNotice: true,
      openFindingsCount: 2,
      waitingDays: 6,
    },
    {
      id: 'AS-03',
      title: 'Gamma Anchor Review',
      stage: 'Approval',
      initiatorOrg: 'Woodside Energy Ltd',
      assignedSubmitter: '',
      assignedVerifier: 'USR-2',
      assignedInspector: '',
      assignedApprover: 'USR-4',
      targetDate: '2026-12-01T00:00:00Z',
      requirements: [{ id: 'R3', verifierStatus: 'Verified', isFulfilled: true }],
    },
    {
      id: 'AS-04',
      title: 'Delta Tugboat Certification',
      stage: 'Approved',
      initiatorOrg: 'Woodside Energy Ltd',
      assignedSubmitter: 'USR-1',
      assignedVerifier: 'USR-2',
      assignedInspector: 'USR-3',
      assignedApprover: 'USR-4',
      targetDate: '2026-11-01T00:00:00Z',
      requirements: [{ id: 'R4', verifierStatus: 'Verified', isFulfilled: true }],
    },
  ];

  const mockCapaItems: any[] = [
    {
      id: 'CAPA-01',
      vesselName: 'MV Borealis',
      title: 'Fire pump pressure low',
      owner: 'Chief Engineer',
      status: 'Open',
      findingDescription: 'Emergency pump test failed',
      checklistItemTitle: 'Safety drill',
    },
    {
      id: 'CAPA-02',
      vesselName: 'MV Celeste',
      title: 'Lifeboat davit corrosion',
      owner: 'Deck Officer',
      status: 'Under Re-Inspection',
      flaggedForReinspection: true,
      findingDescription: 'Corrosion observed',
      checklistItemTitle: 'Deck inspection',
      evidences: [{ id: 'E1', title: 'Photo' }],
    },
    {
      id: 'CAPA-03',
      vesselName: 'MV Aurora',
      title: 'Oily water separator log gap',
      owner: '2nd Engineer',
      status: 'Verified & Closed',
      findingDescription: 'Log gap closed',
      checklistItemTitle: 'Environmental check',
    },
  ];

  const mockDocuments: any[] = [
    {
      id: 'DOC-01',
      title: 'Safety Equipment Certificate',
      expiryDate: '2026-11-20T00:00:00Z', // 15 days, within 30 days
      status: 'Current',
    },
    {
      id: 'DOC-02',
      title: 'Load Line Certificate',
      expiryDate: '2027-05-01T00:00:00Z',
      status: 'Current',
    },
  ];

  beforeEach(() => {
    sessionStorage.clear();
    useMapStore.setState({
      assuranceSets: mockAssuranceSets,
      capaItems: mockCapaItems,
      documents: mockDocuments,
      activeDemoOrganization: 'Woodside Energy Ltd',
      activePersona: 'Administrator',
    });
  });

  const roles: DashboardRole[] = [
    'Administrator as client',
    'Submitter',
    'Verifier',
    'Inspector',
    'Approver',
  ];

  roles.forEach((role) => {
    it(`renders 4 tiles for ${role} where clicking each opens list and filtered count equals tile number`, () => {
      const setCurrentHashView = vi.fn();
      const tiles = getRoleDashboardTiles(
        role,
        {
          assuranceSets: mockAssuranceSets,
          capaItems: mockCapaItems,
          documents: mockDocuments,
        },
        setCurrentHashView,
        fixedNow,
      );

      expect(tiles).toHaveLength(4);

      // Render shared frame with these tiles
      const config = {
        roleTitle: role,
        tiles,
        actionItems: [],
        activityItems: [],
      };

      const { unmount } = render(<SharedDashboardFrame config={config} />);

      tiles.forEach((tile) => {
        expect(screen.getByTestId(`kpi-tile-${tile.id}`)).toBeInTheDocument();

        // Click tile
        const tileElement = screen.getByTestId(`kpi-tile-${tile.id}`);
        fireEvent.click(tileElement);

        expect(setCurrentHashView).toHaveBeenCalled();

        // Check list count based on tile destination and filter
        const targetView = sessionStorage.getItem('map_dashboard_filter_view');
        const filterVal = sessionStorage.getItem('map_dashboard_filter_val');

        if (targetView === 'assurance-sets') {
          const filtered = filterAssuranceSetsByDashboardFilter(mockAssuranceSets, filterVal || '', fixedNow);
          expect(filtered.length).toBe(tile.value);
        } else if (targetView === 'capa') {
          const filtered = filterCapaItemsByDashboardFilter(mockCapaItems, filterVal || '');
          expect(filtered.length).toBe(tile.value);
        }
      });

      unmount();
    });
  });

  it('AssuranceTable correctly applies preselected filter from sessionStorage and resets', () => {
    sessionStorage.setItem('map_assurance_filter', 'needing_people');
    render(<AssuranceTable onSelectSet={vi.fn()} />);

    // Needing people filter chip should be visible
    expect(screen.getByText('needing_people')).toBeInTheDocument();

    // Reset filter
    const removeBtn = screen.getByRole('button', { name: /remove filter filter/i });
    fireEvent.click(removeBtn);
    expect(screen.queryByText('needing_people')).toBeNull();
  });

  it('CapaManagementView preselects open tab from sessionStorage', () => {
    sessionStorage.setItem('map_capa_tab_preselect', 'Open');
    render(<CapaManagementView />);

    const openTab = screen.getByRole('tab', { name: /open/i });
    expect(openTab).toHaveAttribute('aria-selected', 'true');
  });

  it('VerifierWorkspaceView preselects tab from sessionStorage', () => {
    sessionStorage.setItem('map_verifier_tab_preselect', 'overdue');
    render(<VerifierWorkspaceView />);

    const overdueTab = screen.getByRole('tab', { name: /overdue/i });
    expect(overdueTab).toHaveAttribute('aria-selected', 'true');
  });

  it('InspectorWorkspaceView preselects tab from sessionStorage', () => {
    sessionStorage.setItem('map_inspector_tab_preselect', 'overdue');
    render(<InspectorWorkspaceView />);

    const overdueTab = screen.getByRole('tab', { name: /overdue/i });
    expect(overdueTab).toHaveAttribute('aria-selected', 'true');
  });

  it('ApproverDashboardView preselects tab from sessionStorage', () => {
    sessionStorage.setItem('map_approver_tab_preselect', 'overdue');
    render(<ApproverDashboardView />);

    const overdueTab = screen.getByRole('tab', { name: /overdue/i });
    expect(overdueTab).toHaveAttribute('aria-selected', 'true');
  });
});
