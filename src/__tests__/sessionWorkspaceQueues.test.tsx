import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { InspectorWorkspaceView } from '../views/InspectorWorkspaceView';
import { MOCK_ASSURANCE_SETS, MOCK_DOCUMENTS, MOCK_VESSELS } from '../store/mockData';
import { PROJECT_SEED_ASSURANCE_SETS } from '../store/projectMockData';
import { isAssuranceSetAssignedToPersona } from '../utils/rbacHelpers';

describe('session workspace queues', () => {
  it('shows Meridian inspector N. Technical 9 sets instead of every inspector set', () => {
    const sets = [...MOCK_ASSURANCE_SETS, ...PROJECT_SEED_ASSURANCE_SETS];
    const orgWide = sets.filter((set) =>
      isAssuranceSetAssignedToPersona(set, 'Inspector', 'Meridian Marine Surveyors'),
    );
    const named = sets.filter(
      (set) =>
        isAssuranceSetAssignedToPersona(set, 'Inspector', 'Meridian Marine Surveyors', {
          id: 'USR-203',
          name: 'N. Technical',
          organization: 'Meridian Marine Surveyors',
          roles: ['Inspector'],
        }) &&
        Boolean(set.assignedInspector?.includes('N. Technical')),
    );
    expect(orgWide.length).toBe(16);
    expect(named.length).toBe(9);

    useMapStore.setState({
      activePersona: 'Inspector',
      activeDemoOrganization: 'Meridian Marine Surveyors',
      activeSessionUserId: 'USR-203',
      assuranceSets: sets,
      vessels: MOCK_VESSELS,
      documents: MOCK_DOCUMENTS,
    });
    render(<InspectorWorkspaceView />);
    const allTab = within(screen.getByRole('tablist', { name: /inspector queue tabs/i })).getByRole('tab', { name: /all/i });
    expect(allTab.textContent).toContain(`(${named.length})`);
  });
});
