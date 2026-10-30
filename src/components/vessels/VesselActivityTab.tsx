/*
  file summary: vessel detail Activity tab.
  responsibilities: shows one dated timeline, newest first, with a filter chip for each kind of entry.
  role in system: mounted by VesselDetailView.
*/

import React, { useMemo, useState } from 'react';
import { AlertCircle, ClipboardCheck, History, Stamp } from 'lucide-react';
import { EmptyState } from '../common/EmptyState';
import { formatMaritimeDate } from '../../utils/formatters';
import {
  buildVesselActivity,
  filterVesselActivity,
  VesselActivityEntry,
  VesselActivityKind,
  VesselActivitySources,
} from '../../utils/vesselActivityHelpers';

const KIND_CHIPS: { key: VesselActivityKind | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'status', label: 'Status' },
  { key: 'inspection', label: 'Inspections' },
  { key: 'capa', label: 'CAPA' },
  { key: 'decision', label: 'Decisions' },
];

const KIND_ICON = {
  status: History,
  inspection: ClipboardCheck,
  capa: AlertCircle,
  decision: Stamp,
} as const;

interface VesselActivityTabProps extends VesselActivitySources {
  onOpen: (entry: VesselActivityEntry) => void;
}

export const VesselActivityTab: React.FC<VesselActivityTabProps> = ({
  onOpen,
  vesselId,
  statusHistory,
  inspections,
  capaItems,
  assuranceSets,
}) => {
  const [kind, setKind] = useState<VesselActivityKind | 'all'>('all');
  const entries = useMemo(
    () => buildVesselActivity({ vesselId, statusHistory, inspections, capaItems, assuranceSets }),
    [vesselId, statusHistory, inspections, capaItems, assuranceSets],
  );
  const visible = filterVesselActivity(entries, kind);

  return (
    <div className="card map-card-custom" data-testid="vessel-activity">
      <div className="card-header bg-white border-bottom py-3 px-3 d-flex flex-wrap align-items-center gap-2">
        <div className="fw-bold text-dark me-2">Activity</div>
        {KIND_CHIPS.map((chip) => {
          const selected = kind === chip.key;
          const count = filterVesselActivity(entries, chip.key).length;
          return (
            <button
              key={chip.key}
              type="button"
              className={`btn btn-sm rounded-pill ${selected ? 'btn-primary' : 'btn-outline-secondary'}`}
              aria-pressed={selected}
              onClick={() => setKind(chip.key)}
            >
              {chip.label} ({count})
            </button>
          );
        })}
      </div>
      {visible.length === 0 ? (
        <EmptyState title="No activity" description="Nothing in this vessel's timeline matches this filter." />
      ) : (
        <ol className="list-unstyled mb-0">
          {visible.map((entry) => {
            const Icon = KIND_ICON[entry.kind];
            return (
              <li key={entry.id} className="d-flex align-items-start gap-3 px-3 py-3 border-bottom" data-kind={entry.kind}>
                <div className="text-secondary small" style={{ width: '7.5rem', flexShrink: 0 }}>
                  {formatMaritimeDate(entry.at)}
                </div>
                <Icon size={16} className="text-secondary mt-1" aria-hidden="true" />
                <button
                  type="button"
                  className="btn btn-link p-0 text-start text-decoration-none"
                  onClick={() => onOpen(entry)}
                >
                  {entry.text}
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
};
