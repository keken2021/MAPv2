import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ProjectTasksTable } from '../components/tables/ProjectTasksTable';
import { getApproverTasksCount } from '../utils/stageTasks';
import * as rbac from '../utils/rbacHelpers';
import type { AssuranceSet } from '../types/assurance';

function approvalStageSet(): AssuranceSet {
  return {
    id: 'AS-ORDER',
    title: 'Order test set',
    vesselId: 'V-1',
    vesselName: 'MV Test',
    imoNumber: '9456789',
    clientOrg: 'Chevron Australia',
    requestingParty: 'Chevron Australia',
    respondingParty: 'Northwind Marine',
    charterWindowStart: '2026-01-01',
    charterWindowEnd: '2026-12-31',
    complianceDeadline: '2026-11-30',
    stage: 'Approval',
    readinessScore: 100,
    requirements: [],
    mandatoryInspectionRequired: true,
    inspectionCompleted: true,
  } as unknown as AssuranceSet;
}

describe('Approver turn on the Tasks tab', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('lists the Approval row above the finished Inspection row', () => {
    render(<ProjectTasksTable sets={[approvalStageSet()]} scope={{ type: 'set', id: 'AS-ORDER' }} today={new Date('2026-11-04T12:00:00Z')} />);
    const rows = screen.getAllByRole('row').map((r) => r.textContent ?? '');
    const approval = rows.findIndex((t) => t.includes('Approval'));
    const inspection = rows.findIndex((t) => t.includes('Inspection'));
    expect(approval).toBeGreaterThan(0);
    expect(inspection).toBeGreaterThan(0);
    expect(approval).toBeLessThan(inspection);
  });

  it('counts the Approval task when no requirements are open', () => {
    vi.spyOn(rbac, 'getAssuranceSetRoleActions').mockReturnValue({ canApprove: true } as ReturnType<typeof rbac.getAssuranceSetRoleActions>);
    expect(getApproverTasksCount(approvalStageSet(), 0, 'Approver')).toBe(1);
  });

  it('adds nothing when the approver cannot act on the Approval task', () => {
    vi.spyOn(rbac, 'getAssuranceSetRoleActions').mockReturnValue({ canApprove: false } as ReturnType<typeof rbac.getAssuranceSetRoleActions>);
    expect(getApproverTasksCount(approvalStageSet(), 2, 'Approver')).toBe(2);
  });
});
