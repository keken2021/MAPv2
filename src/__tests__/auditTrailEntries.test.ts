import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SEEDED_AUDIT_EVENTS } from '../store/auditMockData';
import { useMapStore } from '../store/useMapStore';
import { AuditTrailView } from '../views/AuditTrailView';

describe('audit trail entries', () => {
  beforeEach(() => {
    useMapStore.setState({
      isAuthenticated: true,
      activePersona: 'Administrator',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
      activeSessionUserId: 'USR-101',
    });
  });

  it('adds no entry when the persona or organization switches', () => {
    const before = useMapStore.getState().auditEvents.length;
    useMapStore.getState().setActiveDemoOrganization('Chevron Australia Pty Ltd');
    useMapStore.getState().setActivePersona('C Admin');
    useMapStore.getState().setActivePersona('Verifier');

    const events = useMapStore.getState().auditEvents;
    expect(events).toHaveLength(before);
    expect(events.some((event) => event.action === 'Switched Active User Persona' || event.action === 'Switched Demo Organization')).toBe(false);
  });

  it('records both values when a target date changes', () => {
    const store = useMapStore.getState();
    const set = store.assuranceSets.find((item) => item.id === 'AS-2026-001');
    expect(set).toBeDefined();
    store.updateAssuranceSet({ ...set!, targetDate: '2026-12-01' });
    store.updateAssuranceSet({
      ...useMapStore.getState().assuranceSets.find((item) => item.id === 'AS-2026-001')!,
      targetDate: '2026-12-15',
    });

    const change = useMapStore.getState().auditEvents.find(
      (event) => event.fieldDelta?.fieldName === 'Target date' && event.fieldDelta.newValue === '2026-12-15',
    );
    expect(change?.fieldDelta).toEqual({
      fieldName: 'Target date',
      oldValue: '2026-12-01',
      newValue: '2026-12-15',
    });
  });

  it('shows UTC time, before and after values, and no unscoped set label', () => {
    expect(SEEDED_AUDIT_EVENTS.length).toBeGreaterThanOrEqual(12);
    useMapStore.setState({ auditEvents: SEEDED_AUDIT_EVENTS });
    render(React.createElement(AuditTrailView));

    expect(screen.getByText('28 OCT 2026 06:40 UTC')).toBeInTheDocument();
    expect(screen.getByText('Target date: 01 DEC 2026 to 15 DEC 2026')).toBeInTheDocument();
    expect(screen.getAllByText('No assurance set').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Set unscoped/)).toBeNull();
    expect(screen.queryByText(/Switched Active User Persona/)).toBeNull();
  });
});
