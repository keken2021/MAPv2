import React from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { HeaderBanner } from '../components/layout/HeaderBanner';
import { AppSidebar } from '../components/layout/AppSidebar';
import { useMapStore } from '../store/useMapStore';
import { filterDocumentsForVerifierQueue } from '../utils/rbacHelpers';
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

    // Verifier sees Approvals (under allowedRoles: ["Approver", "Verifier"], Approver suppresses approver route)
    cleanup();
    useMapStore.setState({ activePersona: 'Verifier' });
    const { unmount: unmountVerifier } = render(<AppSidebar />);
    expect(screen.getByText('Approvals')).toBeDefined();
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
      activePersona: 'Administrator',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
      rolePermissionDefaults: {
        ...currentDefaults,
        Administrator: {
          ...currentDefaults.Administrator,
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
});
