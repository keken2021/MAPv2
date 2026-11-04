import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AssuranceSet } from '../types/assurance';
import { CapaItem } from '../types/capa';
import { AuditTrailEvent } from '../types/audit';
import { SharedDashboardFrame } from '../components/dashboard/SharedDashboardFrame';
import { getApproverDashboardConfig } from '../utils/roleDashboardConfigs';

describe('Approver dashboard config (Task 5389)', () => {
  const fixedNow = new Date('2026-11-05T00:00:00Z');

  it('builds KPI tiles with correct tones and labels', () => {
    const mockSets: AssuranceSet[] = [
      {
        id: 'AS-READY',
        title: 'Q4 survey',
        vesselName: 'MV Aurora',
        stage: 'Approval',
        assignedApprover: 'J. Richardson',
        waitingDays: 3,
        isReadyToDecide: true,
      } as unknown as AssuranceSet,
      {
        id: 'AS-FINDINGS',
        title: 'Annual',
        vesselName: 'MV Celeste',
        stage: 'Approval',
        assignedApprover: 'J. Richardson',
        waitingDays: 6,
        openFindingsCount: 2,
      } as unknown as AssuranceSet,
      {
        id: 'AS-APPROVED',
        title: 'Q3 survey',
        vesselName: 'MV Delta',
        stage: 'Approved',
        assignedApprover: 'J. Richardson',
      } as unknown as AssuranceSet,
    ];

    const config = getApproverDashboardConfig({
      assuranceSets: mockSets,
      capaItems: [],
      auditEvents: [],
      setCurrentHashView: vi.fn(),
      now: fixedNow,
    });

    expect(config.roleTitle).toBe('Approver');
    expect(config.subtitle).toBe('Decisions waiting');

    const readyTile = config.tiles.find((t) => t.id === 'ready_to_decide');
    expect(readyTile?.value).toBe(1);
    expect(readyTile?.tone).toBe('ok');
    expect(readyTile?.label).toBe('Ready to decide');

    const findingsTile = config.tiles.find((t) => t.id === 'with_open_findings');
    expect(findingsTile?.value).toBe(1);
    expect(findingsTile?.tone).toBe('warn');
    expect(findingsTile?.label).toBe('With open findings');

    const waiting5Tile = config.tiles.find((t) => t.id === 'waiting_over_5');
    expect(waiting5Tile?.value).toBe(1); // Celeste has waitingDays: 6
    expect(waiting5Tile?.tone).toBe('bad');
    expect(waiting5Tile?.label).toBe('Waiting over 5 days');

    const approvedTile = config.tiles.find((t) => t.id === 'approved_this_month');
    expect(approvedTile?.value).toBe(1);
    expect(approvedTile?.tone).toBe('neutral');
    expect(approvedTile?.label).toBe('Approved this month');
  });

  it('sorts rows longest wait first and assigns Decide vs Review button matching state', () => {
    // 1 ready set (waiting 3 days)
    const readySet: AssuranceSet = {
      id: 'AS-READY',
      title: 'Q4 survey',
      vesselName: 'MV Aurora',
      stage: 'Approval',
      assignedApprover: 'J. Richardson',
      waitingDays: 3,
      isReadyToDecide: true,
      readinessBar: { submission: true, verification: true, inspection: true },
    } as unknown as AssuranceSet;

    // 1 set with open findings (waiting 6 days) -> must sort first!
    const findingsSet: AssuranceSet = {
      id: 'AS-FINDINGS',
      title: 'Annual',
      vesselName: 'MV Celeste',
      stage: 'Approval',
      assignedApprover: 'J. Richardson',
      waitingDays: 6,
      openFindingsCount: 2,
      readinessBar: { submission: true, verification: true, inspection: true },
    } as unknown as AssuranceSet;

    // 1 set with inspection pending (waiting 1 day)
    const pendingInspSet: AssuranceSet = {
      id: 'AS-INSP-PENDING',
      title: 'Crew',
      vesselName: 'MV Delta',
      stage: 'Approval',
      assignedApprover: 'J. Richardson',
      waitingDays: 1,
      readinessBar: { submission: true, verification: true, inspection: false },
    } as unknown as AssuranceSet;

    const setCurrentHashView = vi.fn();
    const config = getApproverDashboardConfig({
      assuranceSets: [readySet, pendingInspSet, findingsSet], // unsorted order
      capaItems: [],
      auditEvents: [],
      setCurrentHashView,
      now: fixedNow,
    });

    expect(config.actionItems).toHaveLength(3);

    // 1st (longest wait: 6 days, findings open)
    expect(config.actionItems[0].title).toBe('MV Celeste · Annual');
    expect(config.actionItems[0].subtitle).toBe('Waiting 6 days · 2 open findings');
    expect(config.actionItems[0].buttonLabel).toBe('Review');
    expect(config.actionItems[0].readinessBar).toEqual({
      submission: true,
      verification: true,
      inspection: true,
    });

    // 2nd (wait 3 days, ready to decide)
    expect(config.actionItems[1].title).toBe('MV Aurora · Q4 survey');
    expect(config.actionItems[1].subtitle).toBe('Waiting 3 days · all verified');
    expect(config.actionItems[1].buttonLabel).toBe('Decide');
    expect(config.actionItems[1].readinessBar).toEqual({
      submission: true,
      verification: true,
      inspection: true,
    });

    // 3rd (wait 1 day, inspection pending)
    expect(config.actionItems[2].title).toBe('MV Delta · Crew');
    expect(config.actionItems[2].subtitle).toBe('Waiting 1 day · inspection pending');
    expect(config.actionItems[2].buttonLabel).toBe('Review');
    expect(config.actionItems[2].readinessBar).toEqual({
      submission: true,
      verification: true,
      inspection: false,
    });
  });

  it('renders SharedDashboardFrame with mini readiness bar and button actions', () => {
    const readySet: AssuranceSet = {
      id: 'AS-READY',
      title: 'Q4 survey',
      vesselName: 'MV Aurora',
      stage: 'Approval',
      assignedApprover: 'J. Richardson',
      waitingDays: 3,
      isReadyToDecide: true,
      readinessBar: { submission: true, verification: true, inspection: true },
    } as unknown as AssuranceSet;

    const findingsSet: AssuranceSet = {
      id: 'AS-FINDINGS',
      title: 'Annual',
      vesselName: 'MV Celeste',
      stage: 'Approval',
      assignedApprover: 'J. Richardson',
      waitingDays: 6,
      openFindingsCount: 2,
      readinessBar: { submission: true, verification: true, inspection: true },
    } as unknown as AssuranceSet;

    const mockAudit: AuditTrailEvent[] = [
      {
        id: 'AUD-1',
        timestampUtc: '2026-11-02T10:00:00Z',
        userId: 'USR-201',
        userRole: 'Approver',
        organization: 'Chevron Australia',
        action: 'Reviewed set',
        targetAsset: 'MV Aurora',
        target: { kind: 'set', setId: 'AS-READY' },
      },
    ];

    const setCurrentHashView = vi.fn();
    const config = getApproverDashboardConfig({
      assuranceSets: [findingsSet, readySet],
      capaItems: [],
      auditEvents: mockAudit,
      setCurrentHashView,
      now: fixedNow,
    });

    render(<SharedDashboardFrame config={config} />);

    expect(screen.getByText('Approver')).toBeInTheDocument();
    expect(screen.getByText('Decisions waiting')).toBeInTheDocument();

    // Verify readiness bars are rendered
    const readinessBars = screen.getAllByTestId('readiness-bar');
    expect(readinessBars).toHaveLength(2);

    // Verify buttons
    const reviewBtn = screen.getByRole('button', { name: 'Review' });
    const decideBtn = screen.getByRole('button', { name: 'Decide' });
    expect(reviewBtn).toBeInTheDocument();
    expect(decideBtn).toBeInTheDocument();

    fireEvent.click(decideBtn);
    expect(setCurrentHashView).toHaveBeenCalledWith('assurance-sets', 'AS-READY');

    fireEvent.click(reviewBtn);
    expect(setCurrentHashView).toHaveBeenCalledWith('assurance-sets', 'AS-FINDINGS');
  });

  it('renders empty action message when there are no sets waiting for approval', () => {
    const config = getApproverDashboardConfig({
      assuranceSets: [],
      capaItems: [],
      auditEvents: [],
      setCurrentHashView: vi.fn(),
      now: fixedNow,
    });

    render(<SharedDashboardFrame config={config} />);
    expect(screen.getByText('Nothing needs you today')).toBeInTheDocument();
  });
});
