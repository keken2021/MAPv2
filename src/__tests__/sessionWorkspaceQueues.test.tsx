import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { InspectorWorkspaceView } from '../views/InspectorWorkspaceView';
import { MOCK_ASSURANCE_SETS, MOCK_DOCUMENTS, MOCK_VESSELS } from '../store/mockData';
import { PROJECT_SEED_ASSURANCE_SETS } from '../store/projectMockData';
import { isAssuranceSetAssignedToPersona } from '../utils/rbacHelpers';

describe('session workspace queues', () => {
  it('shows Bureau Veritas inspector N. Technical named sets instead of every inspector set', () => {
    const sets = [...MOCK_ASSURANCE_SETS, ...PROJECT_SEED_ASSURANCE_SETS];
    const orgWide = sets.filter((set) =>
      isAssuranceSetAssignedToPersona(set, 'Inspector', 'Bureau Veritas Inspectorate'),
    );
    const named = sets.filter(
      (set) =>
        isAssuranceSetAssignedToPersona(set, 'Inspector', 'Bureau Veritas Inspectorate', {
          id: 'USR-203',
          name: 'N. Technical',
          organization: 'Bureau Veritas Inspectorate',
          roles: ['Inspector'],
        }) &&
        Boolean(set.assignedInspector?.includes('N. Technical')),
    );
    expect(orgWide.length).toBe(13);
    expect(named.length).toBe(7);

    useMapStore.setState({
      activePersona: 'Inspector',
      activeDemoOrganization: 'Bureau Veritas Inspectorate',
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
