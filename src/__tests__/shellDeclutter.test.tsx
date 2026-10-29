import React from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { HeaderBanner } from '../components/layout/HeaderBanner';
import { AppSidebar } from '../components/layout/AppSidebar';
import { useMapStore } from '../store/useMapStore';
import { filterDocumentsForVerifierQueue } from '../utils/rbacHelpers';
import { documentsForSessionVerifier } from '../views/VerifierWorkspaceView';
import { UserRolePersona } from '../types/audit';
import { AssuranceSet } from '../types/assurance';
import { MOCK_ASSURANCE_SETS } from '../store/mockData';

describe('Shell header and sidebar declutter suite', () => {
  beforeEach(() => {
    cleanup();
    useMapStore.setState({
      activePersona: 'Administrator',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
      isAuthenticated: true,
      currentHashView: 'dashboard',
      previousHashView: undefined,
      currentEntityId: undefined,
      previousEntityId: undefined,
    });
  });

  it('renders sidebar labels as Inspections, CAPA, Approvals for eligible roles without old labels', () => {
    // Administrator sees Inspections
    useMapStore.setState({ activePersona: 'Administrator' });
    const { unmount: unmountAdmin } = render(<AppSidebar />);
    expect(screen.getByText('Inspections')).toBeDefined();
    expect(screen.queryByText('Physical Inspections')).toBeNull();
    unmountAdmin();

    // Verifier no longer sees Approvals
    cleanup();
    useMapStore.setState({ activePersona: 'Verifier' });
    const { unmount: unmountVerifier } = render(<AppSidebar />);
    expect(screen.queryByText('Approvals')).toBeNull();
    expect(screen.queryByText('Approval Gate')).toBeNull();
    unmountVerifier();

    // Inspector sees CAPA
    cleanup();
    useMapStore.setState({ activePersona: 'Inspector' });
    render(<AppSidebar />);
    expect(screen.getByText('CAPA')).toBeDefined();
    expect(screen.queryByText('CAPA Tracker')).toBeNull();
  });

  it('displays real dynamic count on Verification Queue badge when > 0 and hides when 0', () => {
    const testSet: AssuranceSet = {
      ...MOCK_ASSURANCE_SETS[0],
      serviceProviderOrg: 'Northwind Marine Pty Ltd',
      initiatorOrg: 'Northwind Marine Pty Ltd',
      requirements: [
        {
          id: 'REQ-VQ-1',
          documentId: 'DOC-VQ-1',
          category: 'Statutory Certificate',
          title: 'Safety Management Certificate',
          isMandatory: true,
          isFulfilled: true,
          verifierStatus: 'Verified',
          ocrConfidence: 95,
        },
        {
          id: 'REQ-VQ-2',
          documentId: 'DOC-VQ-2',
          category: 'Statutory Certificate',
          title: 'Document of Compliance',
          isMandatory: true,
          isFulfilled: true,
          verifierStatus: 'Verified',
          ocrConfidence: 90,
        },
      ],
    };

    const currentDefaults = useMapStore.getState().rolePermissionDefaults;
    useMapStore.setState({
      activePersona: 'C Admin',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
      rolePermissionDefaults: {
        ...currentDefaults,
        'C Admin': {
          ...currentDefaults['C Admin'],
          verification_queue: { create: false, read: true, update: false, delete: false },
        },
      },
      assuranceSets: [testSet],
      documents: [
        { id: 'DOC-VQ-1', title: 'Doc 1' } as any,
        { id: 'DOC-VQ-2', title: 'Doc 2' } as any,
      ],
    });

    const { container, unmount } = render(<AppSidebar />);
    const badge = container.querySelector('.badge.rounded-pill');
    expect(badge).not.toBeNull();
    expect(badge?.textContent?.trim()).toBe('2');

    unmount();
    cleanup();

    // Now test with 0 documents
    useMapStore.setState({ documents: [] });
    const { container: emptyContainer } = render(<AppSidebar />);
    const emptyBadge = emptyContainer.querySelector('.badge.rounded-pill');
    expect(emptyBadge).toBeNull();
  });

  it('sets the verification queue badge to the session verifier document count', () => {
    const fontaineSet: AssuranceSet = {
      ...MOCK_ASSURANCE_SETS[0],
      id: 'AS-FONTAINE',
      assignedVerifier: 'A. Fontaine (Bureau Veritas Inspectorate)',
      requirements: [
        {
          id: 'REQ-F',
          documentId: 'DOC-F',
          category: 'Statutory Certificate',
          title: 'Fontaine Certificate',
          isMandatory: true,
          isFulfilled: false,
          verifierStatus: 'Pending',
          ocrConfidence: 90,
        },
      ],
    };
    const otherSet: AssuranceSet = {
      ...MOCK_ASSURANCE_SETS[0],
      id: 'AS-OTHER',
      assignedVerifier: 'M. Chen (Bureau Veritas Inspectorate)',
      requirements: [
        {
          id: 'REQ-O',
          documentId: 'DOC-O',
          category: 'Statutory Certificate',
          title: 'Other Certificate',
          isMandatory: true,
          isFulfilled: false,
          verifierStatus: 'Pending',
          ocrConfidence: 90,
        },
      ],
    };
    const documents = [
      { id: 'DOC-F', title: 'Fontaine Certificate' },
      { id: 'DOC-O', title: 'Other Certificate' },
    ] as any;
    useMapStore.setState({
      activePersona: 'Verifier',
      activeDemoOrganization: 'Bureau Veritas Inspectorate',
      activeSessionUserId: 'USR-202',
      assuranceSets: [fontaineSet, otherSet],
      documents,
    });

    const queueLength = documentsForSessionVerifier(
      documents,
      [fontaineSet, otherSet],
      'Verifier',
      'Bureau Veritas Inspectorate',
      { id: 'USR-202', name: 'A. Fontaine', organization: 'Bureau Veritas Inspectorate', roles: ['Verifier'] },
    ).length;
    expect(queueLength).toBe(1);

    const { container } = render(<AppSidebar />);
    const badge = container.querySelector('.badge.rounded-pill');
    /* the verifier opens this queue from the dashboard, so the sidebar link stays hidden */
    expect(badge).toBeNull();
    expect(filterDocumentsForVerifierQueue(documents, [fontaineSet, otherSet], 'Verifier', 'Bureau Veritas Inspectorate').length).toBeGreaterThan(queueLength);
  });

  it('shows title only on list screens without breadcrumb element repeating page title', () => {
    const listViews = [
      { view: 'assurance-sets', expectedTitle: 'Assurance Sets' },
      { view: 'vessels', expectedTitle: 'Vessels' },
      { view: 'equipment', expectedTitle: 'Equipment' },
      { view: 'project', expectedTitle: 'Projects' },
      { view: 'documents', expectedTitle: 'Document Library' },
      { view: 'crew', expectedTitle: 'Crew Directory' },
      { view: 'inspector', expectedTitle: 'Inspections' },
      { view: 'approver', expectedTitle: 'Approvals' },
      { view: 'capa', expectedTitle: 'CAPA' },
      { view: 'dashboard', expectedTitle: 'Dashboard' },
    ];

    listViews.forEach(({ view, expectedTitle }) => {
      cleanup();
      useMapStore.setState({ currentHashView: view, currentEntityId: undefined });
      const { container } = render(<HeaderBanner />);

      const titleEl = container.querySelector('h1.map-page-title');
      expect(titleEl?.textContent?.trim()).toBe(expectedTitle);
      expect(container.querySelector('.font-mono-code')).toBeNull();
    });
  });

  it('keeps one link back to parent list on detail pages with clean labels', () => {
    const detailViews = [
      { view: 'vessels', entityId: 'VESSEL-001', expectedText: 'Back to Vessels' },
      { view: 'inspector', entityId: 'INSP-001', expectedText: 'Back to Inspections' },
      { view: 'capa', entityId: 'CAPA-001', expectedText: 'Back to CAPA' },
      { view: 'approver', entityId: 'APP-001', expectedText: 'Back to Approvals' },
      { view: 'create-assurance-set', entityId: undefined, expectedText: 'Back to Assurance Sets' },
    ];

    detailViews.forEach(({ view, entityId, expectedText }) => {
      cleanup();
      useMapStore.setState({
        currentHashView: view,
        currentEntityId: entityId,
        previousHashView: undefined,
      });
      render(<HeaderBanner />);

      const backBtn = screen.getByRole('button', { name: new RegExp(expectedText, 'i') });
      expect(backBtn).toBeDefined();
    });
  });

  it('sanitizes seafarer profile back link to crew detail without banned words', () => {
    useMapStore.setState({
      currentHashView: 'crew',
      currentEntityId: 'CREW-001',
      previousHashView: 'crew',
      previousEntityId: 'CREW-001',
    });
    const { container } = render(<HeaderBanner />);
    const text = container.textContent || '';
    expect(text).not.toMatch(/seafarer/i);
    expect(text).toMatch(/crew/i);
  });

  it('ensures rendered header and sidebar hold no Campaign, Seafarer, Tracker, or Physical Audit across personas', () => {
    const personas: UserRolePersona[] = [
      'Submitter',
      'Verifier',
      'Administrator',
      'Approver',
      'Inspector',
      'C Admin',
    ];

    personas.forEach((persona) => {
      cleanup();
      useMapStore.setState({
        activePersona: persona,
        currentHashView: 'dashboard',
        currentEntityId: undefined,
      });

      const { container: headerContainer } = render(<HeaderBanner />);
      const { container: sidebarContainer } = render(<AppSidebar />);

      const headerText = headerContainer.textContent || '';
      const sidebarText = sidebarContainer.textContent || '';

      [headerText, sidebarText].forEach((text) => {
        expect(text).not.toMatch(/\bCampaign\b/i);
        expect(text).not.toMatch(/\bSeafarer\b/i);
        expect(text).not.toMatch(/\bTracker\b/i);
        expect(text).not.toMatch(/Physical Audit/i);
        expect(text).not.toMatch(/Visual Survey/i);
        expect(text).not.toMatch(/Physical Inspection/i);
        expect(text).not.toMatch(/Approval Gate/i);
      });
    });
  });

  it('matches per-role sidebar navigation against design table', () => {
    const getSidebarLabels = (persona: UserRolePersona): string[] => {
      cleanup();
      useMapStore.setState({
        activePersona: persona,
        currentHashView: 'dashboard',
        currentEntityId: undefined,
      });
      const { container } = render(<AppSidebar />);
      return Array.from(
        container.querySelectorAll('.nav.flex-column button.nav-link .d-flex.align-items-center span:last-child')
      ).map((s) => s.textContent?.trim() || '');
    };

    // Verifier: Dashboard (its queue), Notifications, Projects, Assurance Sets, Document Library, Audit Trail
    // Note: No Approvals and no Verification Queue duplicate
    const verifierLabels = getSidebarLabels('Verifier');
    expect(verifierLabels).toContain('Dashboard');
    expect(verifierLabels).toContain('Notifications');
    expect(verifierLabels).toContain('Projects');
    expect(verifierLabels).toContain('Assurance Sets');
    expect(verifierLabels).toContain('Document Library');
    expect(verifierLabels).toContain('Audit Trail');
    expect(verifierLabels).not.toContain('Approvals');
    expect(verifierLabels).not.toContain('Verification Queue');

    // Inspector: Dashboard (its inspections), Notifications, Projects, Assurance Sets, CAPA, Audit Trail
    // Note: No Inspections duplicate
    const inspectorLabels = getSidebarLabels('Inspector');
    expect(inspectorLabels).toContain('Dashboard');
    expect(inspectorLabels).toContain('Notifications');
    expect(inspectorLabels).toContain('Projects');
    expect(inspectorLabels).toContain('Assurance Sets');
    expect(inspectorLabels).toContain('CAPA');
    expect(inspectorLabels).toContain('Audit Trail');
    expect(inspectorLabels).not.toContain('Inspections');
    expect(inspectorLabels).not.toContain('Approvals');

    // Approver: Dashboard (its approvals), Notifications, Projects, Assurance Sets, Audit Trail
    // Note: No Approvals duplicate
    const approverLabels = getSidebarLabels('Approver');
    expect(approverLabels).toContain('Dashboard');
    expect(approverLabels).toContain('Notifications');
    expect(approverLabels).toContain('Projects');
    expect(approverLabels).toContain('Assurance Sets');
    expect(approverLabels).toContain('Audit Trail');
    expect(approverLabels).not.toContain('Approvals');

    // Submitter: Dashboard, Notifications, Projects, Assurance Objects (Vessels, Equipment), Assurance Sets, Document Library, Audit Trail
    const submitterLabels = getSidebarLabels('Submitter');
    expect(submitterLabels).toContain('Dashboard');
    expect(submitterLabels).toContain('Notifications');
    expect(submitterLabels).toContain('Projects');
    expect(submitterLabels).toContain('Vessels');
    expect(submitterLabels).toContain('Assurance Sets');
    expect(submitterLabels).toContain('Document Library');
    expect(submitterLabels).toContain('Audit Trail');
    expect(submitterLabels).not.toContain('Approvals');

    // Administrator as client (C Admin): Dashboard, Notifications, Projects, Marketplace, Assurance Objects, CAPA, Audit Trail, User Management
    // Note: Assurance Sets suppressed as duplicate of client dashboard
    const cAdminLabels = getSidebarLabels('C Admin');
    expect(cAdminLabels).toContain('Dashboard');
    expect(cAdminLabels).toContain('Notifications');
    expect(cAdminLabels).toContain('Projects');
    expect(cAdminLabels).toContain('Marketplace');
    expect(cAdminLabels).toContain('CAPA');
    expect(cAdminLabels).toContain('Audit Trail');
    expect(cAdminLabels).toContain('User Management');
    expect(cAdminLabels).not.toContain('Assurance Sets');

    // Administrator: Dashboard, Notifications, Projects, Marketplace, Assurance Objects, Assurance Sets, Document Library, Inspections, Audit Trail, User Management, Roles & Permissions
    const adminLabels = getSidebarLabels('Administrator');
    expect(adminLabels).toContain('Dashboard');
    expect(adminLabels).toContain('Notifications');
    expect(adminLabels).toContain('Projects');
    expect(adminLabels).toContain('Marketplace');
    expect(adminLabels).toContain('Assurance Sets');
    expect(adminLabels).toContain('Document Library');
    expect(adminLabels).toContain('Inspections');
    expect(adminLabels).toContain('Audit Trail');
    expect(adminLabels).toContain('User Management');
    expect(adminLabels).toContain('Roles & Permissions');
  });
});
