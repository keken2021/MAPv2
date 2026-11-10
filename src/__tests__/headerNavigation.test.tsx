/*
  file summary: unit tests for reusable header back navigation utilities and component.
  responsibilities: verifies contextual return to referring entities across screens and clean fallback to parent lists.
  role in system: covers src/utils/headerNavigation.tsx.
*/

import React from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import {
  getHeaderBackNavigation,
  HeaderBackButton,
  detailSection,
} from '../utils/headerNavigation';

describe('Reusable Header Navigation', () => {
  beforeEach(() => {
    cleanup();
    useMapStore.setState({
      currentHashView: 'dashboard',
      previousHashView: undefined,
      currentEntityId: undefined,
      previousEntityId: undefined,
      navigationSource: undefined,
    });
  });

  describe('detailSection mapping', () => {
    it('maps known views to their corresponding parent section and list route', () => {
      expect(detailSection('vessels')).toEqual({ label: 'Vessels', listView: 'vessels' });
      expect(detailSection('equipment')).toEqual({ label: 'Equipment', listView: 'equipment' });
      expect(detailSection('project')).toEqual({ label: 'Projects', listView: 'project' });
      expect(detailSection('documents')).toEqual({ label: 'Document Library', listView: 'documents' });
      expect(detailSection('crew')).toEqual({ label: 'Crew Directory', listView: 'crew' });
      expect(detailSection('inspector')).toEqual({ label: 'Inspections', listView: 'inspector' });
      expect(detailSection('capa')).toEqual({ label: 'CAPA', listView: 'capa' });
      expect(detailSection('approver')).toEqual({ label: 'Approvals', listView: 'approver' });
      expect(detailSection('assurance-sets')).toEqual({ label: 'Assurance Sets', listView: 'assurance-sets' });
    });
  });

  describe('getHeaderBackNavigation pure function', () => {
    it('returns to originating assurance set when viewing CAPA findings from assurance set', () => {
      const nav = getHeaderBackNavigation('capa', 'MV Ocean Pioneer', 'assurance-sets', 'AS-2026-001');
      expect(nav.isDetailPage).toBe(true);
      expect(nav.label).toBe('Back to Assurance Set');
      expect(nav.targetView).toBe('assurance-sets');
      expect(nav.targetEntityId).toBe('AS-2026-001');
    });

    it('returns to originating vessel when viewing CAPA findings from vessel detail', () => {
      const nav = getHeaderBackNavigation('capa', 'MV Ocean Pioneer', 'vessels', 'VESSEL-001');
      expect(nav.isDetailPage).toBe(true);
      expect(nav.label).toBe('Back to Vessel Detail');
      expect(nav.targetView).toBe('vessels');
      expect(nav.targetEntityId).toBe('VESSEL-001');
    });

    it('returns to originating assurance set when viewing document detail from assurance set', () => {
      const nav = getHeaderBackNavigation('documents', 'DOC-001', 'assurance-sets', 'AS-2026-002');
      expect(nav.isDetailPage).toBe(true);
      expect(nav.label).toBe('Back to Assurance Set');
      expect(nav.targetView).toBe('assurance-sets');
      expect(nav.targetEntityId).toBe('AS-2026-002');
    });

    it('returns to originating project when viewing assurance set from project detail', () => {
      const nav = getHeaderBackNavigation('assurance-sets', 'AS-2026-003', 'project', 'PROJ-001');
      expect(nav.isDetailPage).toBe(true);
      expect(nav.label).toBe('Back to Project Detail');
      expect(nav.targetView).toBe('project');
      expect(nav.targetEntityId).toBe('PROJ-001');
    });

    it('falls back to parent list and does not return to dashboard when previous view was dashboard', () => {
      const nav = getHeaderBackNavigation('assurance-sets', 'AS-2026-001', 'dashboard', undefined);
      expect(nav.isDetailPage).toBe(true);
      expect(nav.label).toBe('Back to Assurance Sets');
      expect(nav.targetView).toBe('assurance-sets');
      expect(nav.targetEntityId).toBeUndefined();
    });

    it('falls back to parent list when viewing detail inside same section', () => {
      const nav = getHeaderBackNavigation('crew', 'CREW-001', 'crew', 'CREW-001');
      expect(nav.isDetailPage).toBe(true);
      expect(nav.label).toBe('Back to Crew Directory');
      expect(nav.targetView).toBe('crew');
      expect(nav.targetEntityId).toBeUndefined();
    });

    it('hides breadcrumbs when navigation came from the sidebar even if prior referring state is passed', () => {
      const nav = getHeaderBackNavigation('capa', undefined, 'assurance-sets', 'AS-2026-001', 'sidebar');
      expect(nav.isDetailPage).toBe(false);
    });

    it('hides breadcrumbs on dashboard even if previous view was notifications or marketplace', () => {
      expect(getHeaderBackNavigation('dashboard', undefined, 'notifications', undefined).isDetailPage).toBe(false);
      expect(getHeaderBackNavigation('dashboard', undefined, 'marketplace', undefined).isDetailPage).toBe(false);
    });

    it('hides breadcrumbs on objects view with activity filter key', () => {
      expect(getHeaderBackNavigation('objects', 'activity', 'assurance-sets', 'AS-2026-001').isDetailPage).toBe(false);
    });

    it('preserves breadcrumbs for in-screen cross-view navigation from notifications and marketplace', () => {
      const fromNotifications = getHeaderBackNavigation('assurance-sets', 'AS-2026-001', 'notifications', undefined, 'in-screen');
      expect(fromNotifications.isDetailPage).toBe(true);
      expect(fromNotifications.label).toBe('Back to Notifications');

      const fromMarketplace = getHeaderBackNavigation('create-assurance-set', undefined, 'marketplace', undefined, 'in-screen');
      expect(fromMarketplace.isDetailPage).toBe(true);
      expect(fromMarketplace.label).toBe('Back to Marketplace');
    });
  });

  describe('HeaderBackButton component', () => {
    it('renders accessible back button and executes navigation on click', () => {
      useMapStore.setState({
        currentHashView: 'capa',
        currentEntityId: 'MV Ocean Pioneer',
        previousHashView: 'assurance-sets',
        previousEntityId: 'AS-2026-001',
      });

      render(<HeaderBackButton />);
      const btn = screen.getByRole('button', { name: 'Back to Assurance Set' });
      expect(btn).toBeInTheDocument();

      fireEvent.click(btn);
      expect(useMapStore.getState().currentHashView).toBe('assurance-sets');
      expect(useMapStore.getState().currentEntityId).toBe('AS-2026-001');
    });

    it('renders null when not on a detail or contextual return page', () => {
      useMapStore.setState({
        currentHashView: 'dashboard',
        currentEntityId: undefined,
        previousHashView: undefined,
        previousEntityId: undefined,
      });

      const { container } = render(<HeaderBackButton />);
      expect(container.firstChild).toBeNull();
    });

    it('clears referring context when navigating from sidebar and restores breadcrumbs for in-screen navigation', () => {
      const store = useMapStore.getState();
      store.setCurrentHashView('assurance-sets', 'AS-2026-001');
      store.setCurrentHashView('capa', undefined, { source: 'sidebar' });

      expect(useMapStore.getState().previousHashView).toBeUndefined();
      expect(useMapStore.getState().previousEntityId).toBeUndefined();
      expect(useMapStore.getState().navigationSource).toBe('sidebar');

      const { container } = render(<HeaderBackButton />);
      expect(container.firstChild).toBeNull();

      act(() => {
        useMapStore.getState().setCurrentHashView('assurance-sets', 'AS-2026-001');
      });
      expect(screen.getByRole('button', { name: 'Back to Assurance Sets' })).toBeInTheDocument();
    });
  });
});

