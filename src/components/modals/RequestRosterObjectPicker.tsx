import React from 'react';
import type { ProjectAssetLink } from '../../types/project';

interface RequestRosterObjectPickerProps {
  /** roster objects the chosen recipient's organization provides */
  objects: ProjectAssetLink[];
  selectedIds: string[];
  onToggle: (assetId: string) => void;
  /** false until a recipient is chosen */
  enabled: boolean;
}

/** Optional checklist of project roster objects for an assurance set request. */
export const RequestRosterObjectPicker: React.FC<RequestRosterObjectPickerProps> = ({
  objects,
  selectedIds,
  onToggle,
  enabled,
}) => (
  <div className="mb-3" data-testid="request-roster-objects">
    <div className="form-label small fw-semibold" id="request-roster-objects-label">
      Objects (optional)
    </div>
    {!enabled && <div className="text-muted small">Choose a recipient first.</div>}
    {enabled && objects.length === 0 && (
      <div className="text-muted small">No objects from this party on the project roster.</div>
    )}
    {enabled && objects.length > 0 && (
      <div role="group" aria-labelledby="request-roster-objects-label" className="border rounded bg-white p-2">
        {objects.map((object) => (
          <div className="form-check" key={`${object.assetType}:${object.assetId}`}>
            <input
              className="form-check-input"
              type="checkbox"
              id={`request-object-${object.assetId}`}
              checked={selectedIds.includes(object.assetId)}
              onChange={() => onToggle(object.assetId)}
            />
            <label className="form-check-label small" htmlFor={`request-object-${object.assetId}`}>
              {object.assetName} · {object.assetType}
            </label>
          </div>
        ))}
      </div>
    )}
  </div>
);
