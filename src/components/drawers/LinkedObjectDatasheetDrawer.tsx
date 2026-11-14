/*
  file summary: read-only live datasheet drawer for linked assurance objects (vessels, equipment, crew, activities).
  responsibilities: displays real-time specifications for linked objects without routing non-admin users to object pages, and highlights changes against sign-off snapshots.
  role in system: opened from the eye button in AssuranceDetailView for assigned non-admin personas (Submitter, Verifier, Inspector, Approver).
*/

import React, { useMemo } from 'react';
import { AlertTriangle, FileText, Info } from 'lucide-react';
import { AssuranceObjectType, AssuranceSet } from '../../types/assurance';
import { useMapStore } from '../../store/useMapStore';
import { formatMaritimeDate } from '../../utils/formatters';
import { getObjectDatasheet } from '../../utils/objectDatasheetFields';
import { Drawer } from './Drawer';

export interface LinkedObjectDatasheetDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  objectId?: string;
  objectType?: AssuranceObjectType;
  assuranceSet?: AssuranceSet;
}

function normalizeDatasheetValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

/**
  what: read-only live datasheet drawer for an assurance set's linked object.
  how: extracts live specifications from store, evaluates differences against sign-off snapshots, and renders map-datasheet grid cells.
  with what file: src/components/drawers/LinkedObjectDatasheetDrawer.tsx used by AssuranceDetailView.tsx.
*/
export const LinkedObjectDatasheetDrawer: React.FC<LinkedObjectDatasheetDrawerProps> = ({
  isOpen,
  onClose,
  objectId,
  objectType,
  assuranceSet,
}) => {
  const vessels = useMapStore((s) => s.vessels);
  const equipment = useMapStore((s) => s.equipment);
  const crew = useMapStore((s) => s.crew);
  const assuranceObjects = useMapStore((s) => s.assuranceObjects);

  const datasheet = useMemo(() => {
    if (!objectId || !objectType) return null;
    return getObjectDatasheet(objectId, objectType, {
      vessels,
      equipment,
      crew,
      assuranceObjects,
    });
  }, [objectId, objectType, vessels, equipment, crew, assuranceObjects]);

  const latestSnapshot = useMemo(() => {
    if (!objectId || !assuranceSet?.datasheetSnapshots) return null;
    const matching = assuranceSet.datasheetSnapshots.filter((s) => s.objectId === objectId);
    if (matching.length === 0) return null;
    return [...matching].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())[0];
  }, [objectId, assuranceSet]);

  const changedFields = useMemo(() => {
    if (!datasheet || !latestSnapshot?.fields) return new Set<string>();
    const changed = new Set<string>();
    datasheet.fields.forEach((field) => {
      if (field.key in latestSnapshot.fields) {
        const signedRaw = latestSnapshot.fields[field.key];
        const liveRaw = field.value;
        if (normalizeDatasheetValue(signedRaw) !== normalizeDatasheetValue(liveRaw)) {
          changed.add(field.key);
        }
      }
    });
    return changed;
  }, [datasheet, latestSnapshot]);

  if (!isOpen) return null;

  const titleNode = datasheet?.title || 'Object Datasheet';
  const metaNode = (
    <div className="d-flex align-items-center gap-2 text-muted" style={{ fontSize: '0.8rem' }}>
      {datasheet?.type && (
        <span className="badge bg-light text-secondary border text-uppercase" data-testid="datasheet-object-type-badge">
          {datasheet.type}
        </span>
      )}
      {datasheet?.subtitle && <span>{datasheet.subtitle}</span>}
      <span className="text-secondary bg-light px-2 py-0.5 rounded border border-secondary-subtle" style={{ fontSize: '0.72rem' }}>
        Read-only live datasheet
      </span>
    </div>
  );

  return (
    <Drawer
      title={titleNode}
      meta={metaNode}
      size="lg"
      onClose={onClose}
      footer={
        <div className="d-flex justify-content-end w-100">
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={onClose}
            data-testid="datasheet-close-btn"
          >
            Close
          </button>
        </div>
      }
    >
      <div className="p-3" data-testid="linked-object-datasheet-drawer">
        {!datasheet ? (
          <div className="p-4 text-center text-muted" data-testid="datasheet-not-found">
            Datasheet details are not available for this object.
          </div>
        ) : (
          <>
            {changedFields.size > 0 && latestSnapshot && (
              <div
                className="mb-3 p-2.5 bg-amber-50 border border-amber-300 rounded text-xs text-amber-900 d-flex align-items-center gap-2"
                data-testid="datasheet-changed-banner"
              >
                <AlertTriangle size={16} className="text-amber-600 flex-shrink-0" />
                <div>
                  One or more specifications have changed since <strong>{latestSnapshot.role}</strong> sign-off on <strong>{formatMaritimeDate(latestSnapshot.at)}</strong>.
                </div>
              </div>
            )}

            <div className="map-datasheet-card" data-testid="datasheet-card">
              <div className="map-datasheet-card-header is-open">
                <div className="map-datasheet-card-title">
                  <FileText size={16} />
                  <span>Specification Details</span>
                </div>
              </div>
              <div className="map-datasheet-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                {datasheet.fields.map((field) => {
                  const isChanged = changedFields.has(field.key);
                  const signedRaw = latestSnapshot?.fields[field.key];
                  const signedDisplay = signedRaw !== undefined && signedRaw !== null && String(signedRaw).trim() !== ''
                    ? String(signedRaw)
                    : '—';

                  return (
                    <div
                      key={field.key}
                      className="map-datasheet-cell"
                      data-testid={`datasheet-field-${field.key}`}
                    >
                      <span className="map-datasheet-label">{field.label}</span>
                      <span className={`map-datasheet-val ${field.isMono ? 'font-mono-code' : ''}`}>
                        {field.displayValue}
                      </span>
                      {isChanged && latestSnapshot && (
                        <div
                          className="mt-1 text-xs text-amber-800 bg-amber-50 px-2 py-1 rounded border border-amber-200"
                          data-testid="datasheet-change-note"
                        >
                          Changed since {latestSnapshot.role} sign-off on {formatMaritimeDate(latestSnapshot.at)}{' '}
                          <span className="font-mono-code font-semibold">(signed: {signedDisplay})</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-3 p-2.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600 d-flex align-items-start gap-2">
              <Info size={15} className="text-slate-400 mt-0.5 flex-shrink-0" />
              <div>
                This datasheet displays live specifications as recorded in the platform. Non-admin roles do not have direct access to modify underlying registry records.
              </div>
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
};
