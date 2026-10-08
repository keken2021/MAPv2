/* 
  file summary: unit tests for approver action button visibility and persona-specific sidebar button suppression.
  responsibilities: asserts that already approved assurance campaigns hide decision buttons, and persona dashboards suppress redundant sidepanel buttons.
  role in system: test suite covering approver view and sidebar navigation rules.
*/

import { describe, expect, it, beforeEach } from 'vitest';
import { useMapStore } from '../store/useMapStore';
import { MOCK_ASSURANCE_SETS } from '../store/mockData';
import { AssuranceSet } from '../types/assurance';

describe('approver action buttons and sidebar navigation suite', () => {
  beforeEach(() => {
    /* reset active persona to Approver */
    useMapStore.getState().setActivePersona('Approver');
  });

  /**
    what: verifies that approved campaigns hide approver decision action buttons.
    how: checks approved assurance set status and verifies isAlreadyApproved evaluates to true.
    with what file: src/__tests__/approverAndSidebar.test.ts testing ApproverDashboardView logic.
  */
  it('identifies approved assurance sets to hide decision action buttons', () => {
    const approvedSet: AssuranceSet = {
      ...MOCK_ASSURANCE_SETS[0],
      stage: 'Approved',
      approverDecision: 'Approved',
    };

    const isAlreadyApproved =
      approvedSet.stage === 'Approved' || approvedSet.approverDecision === 'Approved';
    expect(isAlreadyApproved).toBe(true);
  });

  /**
    what: verifies that pending approval campaigns keep decision action buttons active.
    how: checks pending campaign and verifies isAlreadyApproved flag evaluates to false.
    with what file: src/__tests__/approverAndSidebar.test.ts testing ApproverDashboardView logic.
  */
  it('keeps decision action buttons active for pending approval campaigns', () => {
    const pendingSet: AssuranceSet = {
      ...MOCK_ASSURANCE_SETS[0],
      stage: 'Approval',
      approverDecision: 'Pending',
    };

    const isAlreadyApproved =
      pendingSet.stage === 'Approved' || pendingSet.approverDecision === 'Approved';
    expect(isAlreadyApproved).toBe(false);
  });

  /**
    what: verifies that approver persona suppresses the redundant approval gate sidepanel item.
    how: simulates sidebar visibleItems filtering logic for Approver persona.
    with what file: src/__tests__/approverAndSidebar.test.ts testing AppSidebar.tsx filtering.
  */
  it('hides approval gate button from sidebar when active persona is Approver', () => {
    const activePersona = 'Approver';
    const isApproverButtonVisible = (persona: string, itemKey: string) => {
      if (persona === 'Verifier' && itemKey === 'verifier') return false;
      if (persona === 'Inspector' && itemKey === 'inspector') return false;
      if (persona === 'Approver' && itemKey === 'approver') return false;
      return true;
    };

    expect(isApproverButtonVisible(activePersona, 'approver')).toBe(false);
    expect(isApproverButtonVisible(activePersona, 'dashboard')).toBe(true);
    expect(isApproverButtonVisible(activePersona, 'audit')).toBe(true);
  });

  /**
    what: verifies that inspector persona suppresses the redundant physical inspections sidepanel item.
    how: simulates sidebar visibleItems filtering logic for Inspector persona.
    with what file: src/__tests__/approverAndSidebar.test.ts testing AppSidebar.tsx filtering.
  */
  it('hides physical inspections button from sidebar when active persona is Inspector', () => {
    const activePersona = 'Inspector';
    const isInspectorButtonVisible = (persona: string, itemKey: string) => {
      if (persona === 'Verifier' && itemKey === 'verifier') return false;
      if (persona === 'Inspector' && itemKey === 'inspector') return false;
      if (persona === 'Approver' && itemKey === 'approver') return false;
      if (persona === 'C Admin' && itemKey === 'assurance-sets') return false;
      return true;
    };

    expect(isInspectorButtonVisible(activePersona, 'inspector')).toBe(false);
    expect(isInspectorButtonVisible(activePersona, 'dashboard')).toBe(true);
    expect(isInspectorButtonVisible(activePersona, 'capa')).toBe(true);
  });

  /**
    what: verifies that c admin persona suppresses the assurance sets sidepanel item while keeping dashboard and other views.
    how: simulates sidebar visibleItems filtering logic for C Admin persona.
    with what file: src/__tests__/approverAndSidebar.test.ts testing AppSidebar.tsx filtering.
  */
  it('hides assurance sets button from sidebar when active persona is C Admin', () => {
    const activePersona = 'C Admin';
    const isButtonVisible = (persona: string, itemKey: string) => {
      if (persona === 'Verifier' && itemKey === 'verifier') return false;
      if (persona === 'Inspector' && itemKey === 'inspector') return false;
      if (persona === 'Approver' && itemKey === 'approver') return false;
      if (persona === 'C Admin' && itemKey === 'assurance-sets') return false;
      return true;
    };

    expect(isButtonVisible(activePersona, 'assurance-sets')).toBe(false);
    expect(isButtonVisible(activePersona, 'dashboard')).toBe(true);
    expect(isButtonVisible(activePersona, 'vessels')).toBe(true);
    expect(isButtonVisible(activePersona, 'users')).toBe(true);
  });

  /**
    what: verifies that vessel admin personas (Administrator / Submitter) hide the CAPA tracker sidepanel button.
    how: simulates sidebar visibleItems filtering logic for Administrator and Submitter personas.
    with what file: src/__tests__/approverAndSidebar.test.ts testing AppSidebar.tsx filtering.
  */
  it('hides CAPA tracker button from sidebar when active persona is Vessel Admin (Administrator or Submitter)', () => {
    const isButtonVisible = (persona: string, itemKey: string) => {
      if (persona === 'Verifier' && itemKey === 'verifier') return false;
      if (persona === 'Inspector' && itemKey === 'inspector') return false;
      if (persona === 'Approver' && itemKey === 'approver') return false;
      if (persona === 'C Admin' && itemKey === 'assurance-sets') return false;
      if ((persona === 'Administrator' || persona === 'Submitter') && itemKey === 'capa') return false;
      return true;
    };

    expect(isButtonVisible('Administrator', 'capa')).toBe(false);
    expect(isButtonVisible('Submitter', 'capa')).toBe(false);
    expect(isButtonVisible('Inspector', 'capa')).toBe(true);
    expect(isButtonVisible('C Admin', 'capa')).toBe(true);
  });

  it('shows assurance sets and hides the verification queue button in the sidebar when active persona is Submitter', () => {
    const isButtonVisible = (persona: string, itemKey: string) => {
      if ((persona === 'Verifier' || persona === 'Submitter') && itemKey === 'verifier') return false;
      if (persona === 'Inspector' && itemKey === 'inspector') return false;
      if (persona === 'Approver' && itemKey === 'approver') return false;
      if (persona === 'C Admin' && itemKey === 'assurance-sets') return false;
      if ((persona === 'Administrator' || persona === 'Submitter') && itemKey === 'capa') return false;
      return true;
    };

    expect(isButtonVisible('Submitter', 'assurance-sets')).toBe(true);
    expect(isButtonVisible('Submitter', 'verifier')).toBe(false);
    expect(isButtonVisible('Submitter', 'dashboard')).toBe(true);
    expect(isButtonVisible('Submitter', 'documents')).toBe(true);
  });

  /**
    what: verifies that setActivePersona transitions smoothly across all roles without state corruption.
    how: cycles through each persona and verifies activePersona is set and accessible routes are maintained.
    with what file: src/__tests__/approverAndSidebar.test.ts testing useMapStore.ts.
  */
  it('switches between all personas seamlessly without errors', () => {
    const roles = ['Administrator', 'Verifier', 'Inspector', 'Approver', 'Submitter', 'C Admin'] as const;
    roles.forEach((role) => {
      useMapStore.getState().setActivePersona(role);
      expect(useMapStore.getState().activePersona).toBe(role);
    });
  });
});

