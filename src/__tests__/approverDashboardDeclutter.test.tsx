import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ApproverDashboardView } from '../views/ApproverDashboardView';
import { useMapStore } from '../store/useMapStore';
import { AssuranceSet } from '../types/assurance';

describe('ApproverDashboardView UI Declutter', () => {
  const initialStore = useMapStore.getState();

  const mockAssuranceSets: AssuranceSet[] = [
    {
      id: 'AS-PENDING-01',
      title: 'Active Approval Campaign 1',
      vesselId: 'VESSEL-01',
      vesselName: 'Pacific Horn',
      imoNumber: '9234567',
      initiatorOrg: 'Oceanic Logistics',
      initiatorRole: 'Vessel Provider',
      charterWindowStart: '2026-11-01',
      charterWindowEnd: '2026-12-01',
      complianceDeadline: '2026-11-15',
      stage: 'Approval',
      approverDecision: 'Pending',
      verificationRequired: true,
      requirements: [
        {
          id: 'REQ-1',
          category: 'Statutory Certificate',
          title: 'Safety Management Certificate',
          isMandatory: true,
          isFulfilled: true,
          verifierStatus: 'Verified',
        },
      ],
      assignedApprover: 'Approver User',
    },
    {
      id: 'AS-OVERDUE-01',
      title: 'Overdue Approval Campaign',
      vesselId: 'VESSEL-02',
      vesselName: 'Atlantic Wave',
      imoNumber: '9234568',
      initiatorOrg: 'Maritime Corp',
      initiatorRole: 'Vessel Provider',
      charterWindowStart: '2026-10-01',
      charterWindowEnd: '2026-11-01',
      complianceDeadline: '2026-10-15', // overdue relative to current date (Oct 29, 2026)
      stage: 'Approval',
      approverDecision: 'Pending',
      verificationRequired: true,
      requirements: [
        {
          id: 'REQ-2',
          category: 'Statutory Certificate',
          title: 'Document of Compliance',
          isMandatory: true,
          isFulfilled: true,
          verifierStatus: 'Verified',
        },
      ],
      assignedApprover: 'Approver User',
    },
    {
      id: 'AS-APPROVED-01',
      title: 'Approved Campaign 1',
      vesselId: 'VESSEL-01',
      vesselName: 'Pacific Horn',
      imoNumber: '9234567',
      initiatorOrg: 'Oceanic Logistics',
      initiatorRole: 'Vessel Provider',
      charterWindowStart: '2026-09-01',
      charterWindowEnd: '2026-10-01',
      complianceDeadline: '2026-09-15',
      stage: 'Approved',
      approverDecision: 'Approved',
      verificationRequired: true,
      requirements: [],
      assignedApprover: 'Approver User',
    },
    {
      id: 'AS-RETURNED-01',
      title: 'Returned Campaign 1',
      vesselId: 'VESSEL-03',
      vesselName: 'Nordic Star',
      imoNumber: '9234569',
      initiatorOrg: 'Global Shipping',
      initiatorRole: 'Vessel Provider',
      charterWindowStart: '2026-11-01',
      charterWindowEnd: '2026-12-01',
      complianceDeadline: '2026-11-10',
      stage: 'Approval',
      approverDecision: 'Returned for Correction',
      verificationRequired: true,
      requirements: [],
      assignedApprover: 'Approver User',
    },
  ];

  beforeEach(() => {
    useMapStore.setState({
      activePersona: 'Approver',
      isAuthenticated: true,
      activeDemoOrganization: '',
      currentEntityId: null,
      assuranceSets: mockAssuranceSets,
      vessels: [
        {
          id: 'VESSEL-01',
          name: 'Pacific Horn',
          imoNumber: '9234567',
          vesselType: 'Anchor Handling Tug',
          classificationSociety: 'DNV',
          dynamicPositioningClass: 'DP2',
          flagState: 'Singapore',
          yearBuilt: 2020,
          grossTonnage: 3500,
          deadweightTonnage: 4200,
          officialRegNumber: 'SG-12345',
          status: 'Active',
          complianceScore: 98,
        },
      ],
    });
  });

  it('removes the 4 KPI cards so nothing sits between title and table card', () => {
    const { container } = render(<ApproverDashboardView />);
    expect(container.querySelector('.map-kpi-card')).toBeNull();
    expect(container.querySelector('.row.g-3')).toBeNull();
  });

  it('renders CountTabs with Needs Decision, Overdue (warn), Approved, Returned, All, defaulting to Needs Decision', () => {
    render(<ApproverDashboardView />);

    const countTabsContainer = screen.getByRole('tablist', { name: /approver queue tabs/i });
    expect(countTabsContainer).toBeInTheDocument();

    const tabs = within(countTabsContainer).getAllByRole('tab');
    expect(tabs).toHaveLength(5);

    const needsDecisionTab = within(countTabsContainer).getByRole('tab', { name: /needs decision/i });
    expect(needsDecisionTab).toHaveClass('is-active');
    expect(needsDecisionTab).toHaveAttribute('aria-selected', 'true');

    const overdueTab = within(countTabsContainer).getByRole('tab', { name: /overdue/i });
    const overdueCount = overdueTab.querySelector('.is-warn');
    expect(overdueCount).not.toBeNull();
  });

  it('ensures tab counts equal the filtered list lengths for all tabs', () => {
    render(<ApproverDashboardView />);

    const countTabsContainer = screen.getByRole('tablist', { name: /approver queue tabs/i });

    // 1. Needs Decision tab (default): AS-PENDING-01 and AS-OVERDUE-01 (count = 2)
    const needsDecisionTab = within(countTabsContainer).getByRole('tab', { name: /needs decision/i });
    expect(needsDecisionTab.textContent).toContain('(2)');
    let rows = screen.getAllByRole('row').slice(1); // exclude header row
    expect(rows).toHaveLength(2);

    // 2. Overdue tab: AS-OVERDUE-01 (count = 1)
    const overdueTab = within(countTabsContainer).getByRole('tab', { name: /overdue/i });
    expect(overdueTab.textContent).toContain('(1)');
    fireEvent.click(overdueTab);
    rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(1);
    expect(screen.getByText('AS-OVERDUE-01')).toBeInTheDocument();

    // 3. Approved tab: AS-APPROVED-01 (count = 1)
    const approvedTab = within(countTabsContainer).getByRole('tab', { name: /approved/i });
    expect(approvedTab.textContent).toContain('(1)');
    fireEvent.click(approvedTab);
    rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(1);
    expect(screen.getByText('AS-APPROVED-01')).toBeInTheDocument();

    // 4. Returned tab: AS-RETURNED-01 (count = 1)
    const returnedTab = within(countTabsContainer).getByRole('tab', { name: /returned/i });
    expect(returnedTab.textContent).toContain('(1)');
    fireEvent.click(returnedTab);
    rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(1);
    expect(screen.getByText('AS-RETURNED-01')).toBeInTheDocument();

    // 5. All tab: all 4 sets (count = 4)
    const allTab = within(countTabsContainer).getByRole('tab', { name: /all/i });
    expect(allTab.textContent).toContain('(4)');
    fireEvent.click(allTab);
    rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(4);
  });

  it('renders Due column with red mono lateness text for overdue sets', () => {
    render(<ApproverDashboardView />);

    // On default Needs Decision tab, AS-OVERDUE-01 is present
    expect(screen.getByText('AS-OVERDUE-01')).toBeInTheDocument();

    // Check Due header is present
    expect(screen.getByRole('columnheader', { name: /due/i })).toBeInTheDocument();

    // Check overdue lateness text
    const lateText = screen.getByText(/late/i);
    expect(lateText).toBeInTheDocument();
    expect(lateText).toHaveClass('text-danger');
    expect(lateText.parentElement).toHaveClass('font-mono-code');
  });

  it('renders exactly 1 badge and 1 action per row', () => {
    render(<ApproverDashboardView />);

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows.length).toBeGreaterThan(0);

    for (const row of rows) {
      // Exactly 1 status badge in the row
      const badges = row.querySelectorAll('.map-status-badge');
      expect(badges).toHaveLength(1);

      // Exactly 1 action button in the actions cell
      const actionsCell = row.querySelector('td.text-end');
      expect(actionsCell).not.toBeNull();
      const buttons = actionsCell!.querySelectorAll('button');
      expect(buttons).toHaveLength(1);
      expect(buttons[0]).toHaveAttribute('title', 'View');
      expect(buttons[0]).toHaveAttribute('aria-label', 'View');
    }
  });

  it('renders ListToolbar inside the card with search and export', () => {
    const { container } = render(<ApproverDashboardView />);

    const card = container.querySelector('.card.map-card-custom');
    expect(card).not.toBeNull();

    const toolbar = card!.querySelector('.map-list-toolbar');
    expect(toolbar).not.toBeNull();

    const searchInput = screen.getByPlaceholderText('Search assurance sets...');
    expect(searchInput).toBeInTheDocument();
  });

  it('cleans up detail view: Set ID once, Approved once, and splits Vessel Type and Class Society', () => {
    useMapStore.setState({ currentEntityId: 'AS-APPROVED-01' });

    const { container } = render(<ApproverDashboardView />);

    // 1. Set ID shows once
    const idMatches = screen.getAllByText((content) => content.includes('AS-APPROVED-01'));
    // Exactly 1 occurrence on page
    expect(idMatches).toHaveLength(1);

    // Card heading should simply be "Details", not "Details — AS-APPROVED-01"
    expect(screen.getByText('Details')).toBeInTheDocument();
    expect(screen.queryByText(/Details — AS-APPROVED-01/i)).toBeNull();

    // 2. Approved status shows once in header
    // The header StatusBadge shows "Approved"
    const approvedBadges = container.querySelectorAll('.map-status-badge');
    expect(approvedBadges).toHaveLength(1);
    expect(approvedBadges[0].textContent).toBe('Approved');

    // The Decision alert should NOT have another badge inside it
    const successAlert = container.querySelector('.alert.alert-success');
    expect(successAlert).not.toBeNull();
    expect(successAlert!.querySelector('.badge')).toBeNull();
    expect(successAlert!.textContent).toContain('This assurance set is already approved.');

    // 3. Combined Vessel Type and Class Society label is split
    expect(screen.getByText('Vessel Type:')).toBeInTheDocument();
    expect(screen.getByText('Class Society:')).toBeInTheDocument();
    expect(screen.queryByText(/Vessel Type & Class Society:/i)).toBeNull();
  });
});
