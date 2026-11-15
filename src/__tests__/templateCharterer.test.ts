/* 
  file summary: unit tests for verifying charterer inclusion in assurance sets created from templates.
  responsibilities: tests that assurance sets created from existing templates carry over charterer information correctly.
  role in system: executed during vitest unit test runs.
*/

import { describe, it, expect, beforeEach } from 'vitest';
import { useMapStore } from '../store/useMapStore';
import { AssuranceSet } from '../types/assurance';
import { getRequestingParty, getRespondingParty } from '../utils/setParties';
import { getSetVesselName } from '../utils/setObjects';
import { getSetStartDate, getSetEndDate, getSetDeadline } from '../utils/setDates';

/**
  what: test suite verifying that template-based assurance set creation includes charterer details.
  how: initializes an assurance set based on a template with charterer info and asserts persistence in map store.
  with what file: src/__tests__/templateCharterer.test.ts testing src/store/useMapStore.ts and assurance models.
*/
describe('Assurance Set Template Charterer Inclusion', () => {
  beforeEach(() => {
    /* reset store persona before test */
    useMapStore.getState().setActivePersona('Administrator');
  });

  it('should include the template charterer in a newly created assurance set', () => {
    const store = useMapStore.getState();
    const templateSet = store.assuranceSets[0];
    const templateCharterer = getRequestingParty(templateSet);

    expect(templateCharterer).toBeDefined();

    /* construct new assurance set from template with Charterer org in title and Northwind Marine initiator org for admin */
    const newSetFromTemplate: AssuranceSet = {
      id: 'AS-2026-999',
      title: `${templateCharterer} - ${getSetVesselName(templateSet)} Charter Vetting`,
      parties: [
        { organization: templateCharterer || '', role: 'Requesting party' },
        { organization: 'Northwind Marine Pty Ltd', role: 'Responding party' },
      ],
      assuranceObjects: templateSet.assuranceObjects,
      startDate: getSetStartDate(templateSet),
      endDate: getSetEndDate(templateSet),
      deadline: getSetDeadline(templateSet),
      dateHistory: [],
      stage: 'Initiated',
      readinessScore: 10,
      mandatoryInspectionRequired: templateSet.mandatoryInspectionRequired,
      inspectionCompleted: false,
      requirements: templateSet.requirements,
      createdBy: {
        userId: 'USR-ADMIN-01',
        name: 'Vessel Provider Admin',
        persona: 'Administrator',
      },
    };

    store.addAssuranceSet(newSetFromTemplate);

    const addedSet = useMapStore.getState().assuranceSets.find((s) => s.id === 'AS-2026-999');
    expect(addedSet).toBeDefined();
    expect(getRequestingParty(addedSet)).toBe(templateCharterer);
    expect(getRespondingParty(addedSet)).toBe('Northwind Marine Pty Ltd');
    expect(addedSet?.title).toBe(`${templateCharterer} - ${getSetVesselName(templateSet)} Charter Vetting`);
    expect(addedSet?.title).not.toContain('(C Admin Charter Vetting)');
  });
});
