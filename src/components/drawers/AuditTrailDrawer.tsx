/* 
  file summary: Audit Trail offcanvas drawer displaying searchable event logs in minimalist light theme.
  responsibilities: presents chronological audit history with user roles, field deltas, and search filters with high contrast text.
  role in system: global offcanvas drawer triggered from header banner button.
*/

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useMapStore } from '../../store/useMapStore';
import { formatMaritimeDate } from '../../utils/formatters';
import { filterAuditTrailForPersona } from '../../utils/rbacHelpers';
import { getRoleDisplayLabel } from '../../utils/userRoleHelpers';

/**
  what: renders the offcanvas audit trail drawer in clean light theme.
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
    <div
      className="offcanvas offcanvas-end show bg-white text-dark border-start shadow-lg"
      style={{ width: '480px', visibility: 'visible', zIndex: 1050 }}
      tabIndex={-1}
    >
      <div className="offcanvas-header border-bottom p-3 bg-light">
        <h5 className="offcanvas-title d-flex align-items-center gap-2 fw-bold text-slate-900">
          <span>Audit Trail</span>
          <span className="badge bg-secondary font-mono-code" style={{ fontSize: '0.75rem' }}>
            {visibleEvents.length} Events
          </span>
        </h5>
        <button
          type="button"
          className="btn btn-sm btn-icon border-0 bg-transparent text-secondary p-1"
          onClick={() => setAuditDrawerOpen(false)}
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </div>

      <div className="offcanvas-body p-3">
        <div className="mb-3">
          <input
            type="text"
            className="form-control form-control-sm bg-white text-dark border-secondary"
            placeholder="Search audit trail..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="d-flex flex-column gap-3">
          {filteredEvents.map((ev) => (
            <div key={ev.id} className="p-3 bg-light border border-secondary rounded shadow-sm" style={{ fontSize: '0.875rem' }}>
              <div className="d-flex align-items-center justify-between mb-1">
                <span className="fw-bold text-primary">{ev.action}</span>
                <span className="text-secondary font-mono-code small">
                  {formatMaritimeDate(ev.timestampUtc)}
                </span>
              </div>

              <div className="text-dark mb-1">
                Asset: <strong className="text-slate-900">{ev.targetAsset}</strong>
              </div>

              <div className="d-flex align-items-center gap-2 mb-2">
                <span className="badge bg-info text-dark font-mono-code" style={{ fontSize: '0.7rem' }}>
                  {getRoleDisplayLabel(ev.userRole)}
                </span>
                <span className="text-secondary small">{ev.organization}</span>
              </div>

              {ev.fieldDelta && (
                <div className="p-2 mb-2 bg-white rounded font-mono-code small text-warning border border-secondary">
                  <div>Change: {ev.fieldDelta.fieldName}</div>
                  <div>Old: {ev.fieldDelta.oldValue}</div>
                  <div>New: {ev.fieldDelta.newValue}</div>
                </div>
              )}

              {ev.justificationNotes && (
                <div className="text-secondary small fst-italic">
                  Notes: "{ev.justificationNotes}"
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
