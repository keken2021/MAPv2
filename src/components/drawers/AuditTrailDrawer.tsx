/* 
  file summary: Audit Trail drawer displaying searchable event logs in minimalist light theme.
  responsibilities: presents chronological audit history with user roles, field deltas, and search filters with high contrast text.
  role in system: global drawer triggered from header banner button.
*/

import React, { useState } from 'react';
import { useMapStore } from '../../store/useMapStore';
import { formatMaritimeDate } from '../../utils/formatters';
import { filterAuditTrailForPersona } from '../../utils/rbacHelpers';
import { getRoleDisplayLabel } from '../../utils/userRoleHelpers';
import { Drawer } from './Drawer';

/**
  what: renders the audit trail drawer in clean light theme.
  how: fetches auditEvents array from zustand store and filters items based on persona RBAC rules and search query.
  with what file: src/components/drawers/AuditTrailDrawer.tsx loaded by App.tsx.
*/
export const AuditTrailDrawer: React.FC = () => {
  const { isAuditDrawerOpen, setAuditDrawerOpen, auditEvents, activePersona, assuranceSets, vessels } = useMapStore();
  const [searchTerm, setSearchTerm] = useState('');

  if (!isAuditDrawerOpen) return null;

  const visibleEvents = filterAuditTrailForPersona(auditEvents, activePersona, assuranceSets, vessels);

  const filteredEvents = visibleEvents.filter((ev) =>
    ev.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ev.targetAsset.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ev.userRole.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (ev.justificationNotes && ev.justificationNotes.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <Drawer
      title="Audit Trail"
      meta={`${visibleEvents.length} events`}
      onClose={() => setAuditDrawerOpen(false)}
    >
      <input
        type="text"
        className="form-control bg-white text-dark mb-3"
        placeholder="Search audit trail..."
        aria-label="Search audit trail"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      <div className="map-drawer-stack">
        {filteredEvents.length === 0 && (
          <div className="text-secondary small text-center py-3">No events found.</div>
        )}

        {filteredEvents.map((ev) => (
          <div key={ev.id} className="map-drawer-card" style={{ fontSize: '0.875rem' }}>
            <div className="d-flex align-items-start justify-content-between gap-3 mb-1">
              <span className="fw-bold text-primary">{ev.action}</span>
              <span className="text-secondary font-mono-code small flex-shrink-0">
                {formatMaritimeDate(ev.timestampUtc)}
              </span>
            </div>

            <div className="text-dark mb-1">
              Asset: <strong className="text-slate-900">{ev.targetAsset}</strong>
            </div>

            <div className="d-flex align-items-center gap-2">
              <span className="badge bg-info text-dark font-mono-code" style={{ fontSize: '0.75rem' }}>
                {getRoleDisplayLabel(ev.userRole)}
              </span>
              <span className="text-secondary small">{ev.organization}</span>
            </div>

            {ev.fieldDelta && (
              <div className="map-drawer-inset font-mono-code mt-2">
                <div>Change: {ev.fieldDelta.fieldName}</div>
                <div>Old: {ev.fieldDelta.oldValue}</div>
                <div>New: {ev.fieldDelta.newValue}</div>
              </div>
            )}

            {ev.justificationNotes && (
              <div className="text-secondary small fst-italic mt-2">
                Notes: "{ev.justificationNotes}"
              </div>
            )}
          </div>
        ))}
      </div>
    </Drawer>
  );
};
