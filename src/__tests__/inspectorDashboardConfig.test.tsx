import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AssuranceSet } from '../types/assurance';
import { CapaItem } from '../types/capa';
import { AuditTrailEvent } from '../types/audit';
import { SharedDashboardFrame } from '../components/dashboard/SharedDashboardFrame';
import { getInspectorDashboardConfig } from '../utils/roleDashboardConfigs';

describe('Inspector dashboard config (Task 5388)', () => {
  const fixedNow = new Date('2026-11-05T00:00:00Z');

  it('builds KPI tiles with correct tones and labels', () => {
    const mockSets: AssuranceSet[] = [
      {
        id: 'AS-OVERDUE',
        title: 'Borealis Survey',
        vesselName: 'MV Borealis',
        stage: 'Inspection',
        assignedInspector: 'K. Tanaka',
        complianceDeadline: '2026-11-01T00:00:00Z', // 4 days ago -> overdue
      } as unknown as AssuranceSet,
      {
        id: 'AS-UPCOMING',
        title: 'Aurora Inspection',
        vesselName: 'MV Aurora',
        stage: 'Inspection',
        assignedInspector: 'K. Tanaka',
        complianceDeadline: '2026-11-08T00:00:00Z', // 3 days away -> next 7 days
      } as unknown as AssuranceSet,
    ];

    const mockCapas: CapaItem[] = [
      {
        id: 'CAPA-REINSPECT',
        title: 'Fire pump finding',
        vesselName: 'MV Celeste',
        status: 'Under Re-Inspection',
        flaggedForReinspection: true,
      } as unknown as CapaItem,
      {
        id: 'CAPA-FIX',
        title: 'Lifeboat davit',
        vesselName: 'MV Delta',
        status: 'Open',
        evidences: [{ id: 'EVID-1', fileName: 'davit_fix.jpg' }],
      } as unknown as CapaItem,
    ];

    const config = getInspectorDashboardConfig({
      assuranceSets: mockSets,
      capaItems: mockCapas,
      auditEvents: [],
      setCurrentHashView: vi.fn(),
      now: fixedNow,
    });

    expect(config.roleTitle).toBe('Inspector');
    expect(config.subtitle).toBe('Your inspections');

    const reportsOverdueTile = config.tiles.find((t) => t.id === 'reports_overdue');
    expect(reportsOverdueTile?.value).toBe(1);
    expect(reportsOverdueTile?.tone).toBe('bad');
    expect(reportsOverdueTile?.label).toBe('Reports overdue');

    const reinspectionsTile = config.tiles.find((t) => t.id === 'reinspections');
    expect(reinspectionsTile?.value).toBe(1);
    expect(reinspectionsTile?.tone).toBe('warn');
    expect(reinspectionsTile?.label).toBe('Re-inspections');

    const next7DaysTile = config.tiles.find((t) => t.id === 'next_7_days');
    expect(next7DaysTile?.value).toBe(1);
    expect(next7DaysTile?.tone).toBe('neutral');
    expect(next7DaysTile?.label).toBe('Next 7 days');

    const fixesToCheckTile = config.tiles.find((t) => t.id === 'fixes_to_check');
    expect(fixesToCheckTile?.value).toBe(1);
    expect(fixesToCheckTile?.tone).toBe('neutral');
    expect(fixesToCheckTile?.label).toBe('Fixes to check');
  });

  it('orders action items strictly and places flagged re-inspection second', () => {
    // 1. Report to finish
    const reportSet: AssuranceSet = {
      id: 'AS-REPORT',
      title: 'Borealis Survey',
      vesselName: 'MV Borealis',
      stage: 'Inspection',
      assignedInspector: 'K. Tanaka',
      hasInspectionReportToFinish: true,
      inspectedDate: '2026-10-31T00:00:00Z',
      checklistDone: 9,
      checklistTotal: 12,
    } as unknown as AssuranceSet;

    // 2. Re-inspection from CAPA flaggedForReinspection
    const reinspectCapa: CapaItem = {
      id: 'CAPA-101',
      title: 'Fire pump finding',
      vesselName: 'MV Celeste',
      status: 'Open',
      flaggedForReinspection: true,
      flaggedDate: '2026-11-03T00:00:00Z',
    } as unknown as CapaItem;

    // 3. Inspection in the next 7 days
    const upcomingSet: AssuranceSet = {
      id: 'AS-UPCOMING',
      title: 'Aurora Inspection',
      vesselName: 'MV Aurora',
      stage: 'Inspection',
      assignedInspector: 'K. Tanaka',
      complianceDeadline: '2026-11-06T00:00:00Z',
      port: 'Rotterdam',
      scheduledTime: 'Tomorrow 09:00',
    } as unknown as AssuranceSet;

    // 4. Fixes to check
    const fixCapa: CapaItem = {
      id: 'CAPA-102',
      title: 'Lifeboat davit',
      vesselName: 'MV Delta',
      status: 'Pending Verification',
      hasFixEvidence: true,
    } as unknown as CapaItem;

    const setCurrentHashView = vi.fn();
    const config = getInspectorDashboardConfig({
      assuranceSets: [upcomingSet, reportSet], // out of order input
      capaItems: [fixCapa, reinspectCapa], // out of order input
      auditEvents: [],
      setCurrentHashView,
      now: fixedNow,
    });

    expect(config.actionItems).toHaveLength(4);

    // 1st: Report to finish
    expect(config.actionItems[0].tag).toBe('Report');
    expect(config.actionItems[0].tagTone).toBe('bad');
    expect(config.actionItems[0].title).toBe('MV Borealis · inspected 31 Oct');
    expect(config.actionItems[0].subtitle).toBe('Checklist 9 of 12 done');
    expect(config.actionItems[0].buttonLabel).toBe('Finish report');

    // 2nd: Re-inspection flagged
    expect(config.actionItems[1].tag).toBe('Re-inspect');
    expect(config.actionItems[1].tagTone).toBe('warn');
    expect(config.actionItems[1].title).toBe('Fire pump finding · MV Celeste');
    expect(config.actionItems[1].subtitle).toBe('Flagged by client 3 Nov');
    expect(config.actionItems[1].buttonLabel).toBe('Schedule');

    // 3rd: Upcoming inspection
    expect(config.actionItems[2].tag).toBe('Upcoming');
    expect(config.actionItems[2].tagTone).toBe('neutral');
    expect(config.actionItems[2].title).toBe('MV Aurora · Rotterdam');
    expect(config.actionItems[2].subtitle).toBe('Tomorrow 09:00');
    expect(config.actionItems[2].buttonLabel).toBe('Prepare');

    // 4th: Fixes to check
    expect(config.actionItems[3].tag).toBe('Fix');
    expect(config.actionItems[3].tagTone).toBe('neutral');
    expect(config.actionItems[3].title).toBe('Lifeboat davit · MV Delta');
    expect(config.actionItems[3].subtitle).toBe('Fix evidence uploaded');
    expect(config.actionItems[3].buttonLabel).toBe('Review fix');
  });

  it('renders SharedDashboardFrame with Inspector config and button interactions', () => {
    const reportSet: AssuranceSet = {
      id: 'AS-REPORT',
      title: 'Borealis Survey',
      vesselName: 'MV Borealis',
      stage: 'Inspection',
      assignedInspector: 'K. Tanaka',
      hasInspectionReportToFinish: true,
      inspectedDate: '2026-10-31T00:00:00Z',
    } as unknown as AssuranceSet;

    const reinspectCapa: CapaItem = {
      id: 'CAPA-101',
      title: 'Fire pump finding',
      vesselName: 'MV Celeste',
      flaggedForReinspection: true,
    } as unknown as CapaItem;

    const mockAudit: AuditTrailEvent[] = [
      {
        id: 'AUD-1',
        timestampUtc: '2026-11-03T10:00:00Z',
        userId: 'USR-301',
        userRole: 'Inspector',
        organization: 'DNV',
        action: 'Completed Inspection',
        targetAsset: 'MV Borealis',
        target: { kind: 'set', setId: 'AS-REPORT' },
      },
    ];

    const setCurrentHashView = vi.fn();
    const config = getInspectorDashboardConfig({
      assuranceSets: [reportSet],
      capaItems: [reinspectCapa],
      auditEvents: mockAudit,
      setCurrentHashView,
      now: fixedNow,
    });

    render(<SharedDashboardFrame config={config} />);

    expect(screen.getByText('Inspector')).toBeInTheDocument();
    expect(screen.getByText('Your inspections')).toBeInTheDocument();

    const finishBtn = screen.getByRole('button', { name: 'Finish report' });
    const scheduleBtn = screen.getByRole('button', { name: 'Schedule' });

    fireEvent.click(finishBtn);
    expect(setCurrentHashView).toHaveBeenCalledWith('inspector-workspace', 'AS-REPORT');

    fireEvent.click(scheduleBtn);
    expect(setCurrentHashView).toHaveBeenCalledWith('capa', 'CAPA-101');
  });

  it('renders empty action message when there are no inspector action items', () => {
    const config = getInspectorDashboardConfig({
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
