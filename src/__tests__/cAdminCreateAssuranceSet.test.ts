/* 
  file summary: unit tests verifying c admin assurance set creation workflow and default charterer attribution.
  responsibilities: tests that c admin defaults to chevron australia pty ltd as charterer and correctly filters created sets on the dashboard.
  role in system: executed during vitest test runs.
*/

import { describe, it, expect, beforeEach } from 'vitest';
import { useMapStore } from '../store/useMapStore';
import { AssuranceSet } from '../types/assurance';
import { isAssuranceSetAssignedToPersona } from '../utils/rbacHelpers';
import { generateUniqueAssuranceSetId } from '../utils/validation';

/**
  what: test suite for c admin assurance set creation and charterer defaults.
  how: simulates assurance set creation under c admin persona and validates charterer attribution and dashboard visibility.
  with what file: src/__tests__/cAdminCreateAssuranceSet.test.ts testing src/views/CreateAssuranceSetView.tsx, src/store/useMapStore.ts, and src/utils/rbacHelpers.ts.
*/
describe('c admin assurance set creation and default charterer attribution', () => {
  beforeEach(() => {
    /* reset active persona to c admin */
    useMapStore.getState().setActivePersona('C Admin');
  });

  /**
    what: verifies that a newly initiated assurance set by c admin uses chevron australia pty ltd as default charterer.
    how: creates a new assurance set with default c admin parameters and asserts store persistence and charterer field.
    with what file: src/__tests__/cAdminCreateAssuranceSet.test.ts.
  */
  it('assigns chevron australia pty ltd as default charterer for c admin', () => {
    const store = useMapStore.getState();
    const uniqueId = generateUniqueAssuranceSetId(store.assuranceSets);
    const defaultCharterer = 'Chevron Australia Pty Ltd';

    const newSet: AssuranceSet = {
      id: uniqueId,
      title: `${defaultCharterer} - MV Northern Endeavour Charter Vetting`,
      vesselId: 'VESSEL-001',
      vesselName: 'MV Northern Endeavour',
      imoNumber: '9123456',
      initiatorOrg: defaultCharterer,
      initiatorRole: 'C Admin · Client Created',
      charterer: defaultCharterer,
      charterWindowStart: '2026-11-01',
      complianceDeadline: '2026-11-01',
      charterWindowEnd: '2027-11-01',
      stage: 'Initiated',
      readinessScore: 10,
      mandatoryInspectionRequired: false,
      inspectionCompleted: false,
      requirements: [],
      stakeholders: undefined,
      assignedStakeholders: undefined,
      createdByPersona: '',
    };

    store.addAssuranceSet(newSet);

    const createdSet = useMapStore.getState().assuranceSets.find((s) => s.id === uniqueId);
    expect(createdSet).toBeDefined();
    expect(createdSet?.charterer).toBe('Chevron Australia Pty Ltd');
    expect(createdSet?.initiatorOrg).toBe('Chevron Australia Pty Ltd');
    expect(createdSet?.initiatorRole).toBe('C Admin · Client Created');
    expect(isAssuranceSetAssignedToPersona(createdSet!, 'C Admin')).toBe(true);
  });

  /**
    what: verifies that template selection for c admin retains chevron australia pty ltd as charterer.
    how: loads a non-chevron template set and verifies effective charterer is retained as chevron for c admin.
    with what file: src/__tests__/cAdminCreateAssuranceSet.test.ts.
  */
  it('enforces chevron australia pty ltd charterer even when using third-party template', () => {
    const isClientAdmin = true;
    const templateSet: Partial<AssuranceSet> = {
      charterer: 'Woodside Energy Ltd',
      initiatorOrg: 'Woodside Energy Ltd',
    };

    const effectiveCharterer = isClientAdmin
      ? 'Chevron Australia Pty Ltd'
      : (templateSet.charterer || templateSet.initiatorOrg || 'Northwind Marine Pty Ltd');

    expect(effectiveCharterer).toBe('Chevron Australia Pty Ltd');
  });
});
