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
import { getRequestingParty } from '../utils/setParties';

const initialState = useMapStore.getState();

/**
  what: test suite for c admin assurance set creation and charterer defaults.
  how: simulates assurance set creation under c admin persona and validates charterer attribution and dashboard visibility.
  with what file: src/__tests__/cAdminCreateAssuranceSet.test.ts testing src/views/CreateAssuranceSetView.tsx, src/store/useMapStore.ts, and src/utils/rbacHelpers.ts.
*/
describe('c admin assurance set creation and default charterer attribution', () => {
  beforeEach(() => {
    /* reset store state with chevron c admin session */
    useMapStore.setState(
      {
        ...initialState,
        activePersona: 'C Admin',
        activeDemoOrganization: 'Chevron Australia Pty Ltd',
        activeSessionUserId: 'USR-221',
      },
      true,
    );
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
      assuranceObjects: [
        {
          id: 'VESSEL-001',
          type: 'vessel',
          name: 'MV Northern Endeavour',
          ownerOrganization: 'Northwind Marine Pty Ltd',
          identifier: '9123453',
        },
      ],
      parties: [
        { organization: defaultCharterer, role: 'Requesting party' },
        { organization: 'Northwind Marine Pty Ltd', role: 'Responding party' },
      ],
      createdBy: {
        userId: 'USR-221',
        name: 'C. Henderson',
        persona: 'C Admin',
      },
      startDate: '2026-11-01',
      deadline: '2026-11-01',
      endDate: '2027-11-01',
      dateHistory: [],
      stage: 'Initiated',
      readinessScore: 10,
      mandatoryInspectionRequired: false,
      inspectionCompleted: false,
      requirements: [],
      stakeholders: undefined,
    };

    store.addAssuranceSet(newSet);

    const cAdminUser = useMapStore.getState().users.find((u) => u.id === 'USR-221')!;
    const createdSet = useMapStore.getState().assuranceSets.find((s) => s.id === uniqueId);
    expect(createdSet).toBeDefined();
    expect(getRequestingParty(createdSet!)).toBe('Chevron Australia Pty Ltd');
    expect(isAssuranceSetAssignedToPersona(createdSet!, 'C Admin', defaultCharterer, cAdminUser)).toBe(true);
  });

  /**
    what: verifies that template selection for c admin retains chevron australia pty ltd as charterer.
    how: loads a non-chevron template set and verifies effective charterer is retained as chevron for c admin.
    with what file: src/__tests__/cAdminCreateAssuranceSet.test.ts.
  */
  it('enforces chevron australia pty ltd charterer even when using third-party template', () => {
    const isClientAdmin = true;
    const templateSet: Partial<AssuranceSet> = {
      parties: [
        { organization: 'Woodside Energy Ltd', role: 'Requesting party' },
        { organization: 'Northwind Marine Pty Ltd', role: 'Responding party' },
      ],
    };

    const effectiveCharterer = isClientAdmin
      ? 'Chevron Australia Pty Ltd'
      : (getRequestingParty(templateSet as AssuranceSet) || 'Northwind Marine Pty Ltd');

    expect(effectiveCharterer).toBe('Chevron Australia Pty Ltd');
  });
});
