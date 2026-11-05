/*
  file summary: shared type-filter + search + asset list for project composition pickers.
  responsibilities: filter LinkableProjectAsset rows; optional assurance-set select; custom row actions.
  role in system: used by CreateProjectView step 3 and ProjectAddAssetModal catalog view.
*/

import React, { useMemo, useState, type ReactNode } from 'react';
import { Layers } from 'lucide-react';
import type { LinkableProjectAsset } from '../../utils/projectHelpers';
import { PROJECT_ASSET_LINK_HINT } from '../../utils/projectHelpers';
import { SearchInput } from './SearchInput';

export type ProjectAssetTypeFilter = 'All' | 'Vessel' | 'Crew' | 'Equipment';

export type ProjectAssetPickerAsset = LinkableProjectAsset & {
  /** Extra searchable text (subtype, role, etc.) */
  searchExtra?: string;
};

export function filterProjectPickerAssets<T extends ProjectAssetPickerAsset>(
  assets: T[],
  typeFilter: ProjectAssetTypeFilter,
  searchQuery: string,
): T[] {
  const q = searchQuery.trim().toLowerCase();
  return assets.filter((asset) => {
    if (typeFilter !== 'All' && asset.assetType !== typeFilter) return false;
    if (!q) return true;
    const haystack = [
      asset.assetName,
      asset.assetId,
      asset.providerOrganization,
      asset.assetType,
      asset.searchExtra ?? '',
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function countProjectPickerAssetsByType(
  assets: ProjectAssetPickerAsset[],
): Record<ProjectAssetTypeFilter, number> {
  return {
    All: assets.length,
    Vessel: assets.filter((a) => a.assetType === 'Vessel').length,
    Crew: assets.filter((a) => a.assetType === 'Crew').length,
    Equipment: assets.filter((a) => a.assetType === 'Equipment').length,
  };
}

export interface ProjectAssetPickerProps<T extends ProjectAssetPickerAsset = ProjectAssetPickerAsset> {
  assets: T[];
  typeFilter?: ProjectAssetTypeFilter;
  onTypeFilterChange?: (filter: ProjectAssetTypeFilter) => void;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  showSearch?: boolean;
  showCounts?: boolean;
  maxHeight?: number | string;
  emptyTitle?: string;
  emptyHint?: string;
  assuranceSetByKey?: Record<string, string>;
  onAssuranceSetChange?: (assetKey: string, setId: string) => void;
  showAssuranceSetSelect?: boolean;
  showExternalBadge?: boolean;
  /** Compact list (create wizard) vs card list (add-asset modal) */
  variant?: 'compact' | 'card';
  renderAssetMeta?: (asset: T) => ReactNode;
  renderActions?: (asset: T, selectedSetId: string) => ReactNode;
  onAdd?: (asset: T, selectedSetId: string) => void;
  addLabel?: string;
  className?: string;
}

export function ProjectAssetPicker<T extends ProjectAssetPickerAsset = ProjectAssetPickerAsset>({
  assets,
  typeFilter: controlledFilter,
  onTypeFilterChange,
  searchQuery: controlledSearch,
  onSearchQueryChange,
  showSearch = true,
  showCounts = true,
  maxHeight = 320,
  emptyTitle = 'No assets available.',
  emptyHint = PROJECT_ASSET_LINK_HINT,
  assuranceSetByKey,
  onAssuranceSetChange,
  showAssuranceSetSelect = true,
  showExternalBadge = false,
  variant = 'compact',
  renderAssetMeta,
  renderActions,
  onAdd,
  addLabel = 'Add',
  className = '',
}: ProjectAssetPickerProps<T>) {
  const [internalFilter, setInternalFilter] = useState<ProjectAssetTypeFilter>('All');
  const [internalSearch, setInternalSearch] = useState('');

  const typeFilter = controlledFilter ?? internalFilter;
  const searchQuery = controlledSearch ?? internalSearch;

  const setTypeFilter = (next: ProjectAssetTypeFilter) => {
    onTypeFilterChange?.(next);
    if (controlledFilter === undefined) setInternalFilter(next);
  };

  const setSearchQuery = (next: string) => {
    onSearchQueryChange?.(next);
    if (controlledSearch === undefined) setInternalSearch(next);
  };

  const counts = useMemo(() => countProjectPickerAssetsByType(assets), [assets]);
  const filtered = useMemo(
    () => filterProjectPickerAssets(assets, typeFilter, searchQuery),
    [assets, typeFilter, searchQuery],
  );

  const filterOptions: { key: ProjectAssetTypeFilter; label: string }[] = [
    { key: 'All', label: showCounts ? `All (${counts.All})` : 'All' },
    { key: 'Vessel', label: showCounts ? `Vessels (${counts.Vessel})` : 'Vessel' },
    { key: 'Crew', label: showCounts ? `Crew (${counts.Crew})` : 'Crew' },
    { key: 'Equipment', label: showCounts ? `Equipment (${counts.Equipment})` : 'Equipment' },
  ];

  const resolveSetId = (asset: T): string => {
    const key = `${asset.assetType}:${asset.assetId}`;
    return assuranceSetByKey?.[key] || asset.eligibleAssuranceSets[0]?.id || '';
  };

  return (
    <div
      className={`project-asset-picker d-flex flex-column gap-2 ${className}`.trim()}
      data-testid="project-asset-picker"
    >
      <div
        className={`d-flex flex-column ${variant === 'card' ? 'flex-md-row align-items-md-center justify-content-between gap-3 card p-3 border shadow-sm bg-white' : 'gap-2'}`}
        style={variant === 'card' ? { borderColor: '#E2E8F0' } : undefined}
      >
        <div className="d-flex flex-wrap align-items-center gap-1.5" role="group" aria-label="Asset type filter">
          {filterOptions.map((opt) => {
            const active = typeFilter === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                className={
                  variant === 'card'
                    ? 'btn btn-sm rounded-pill font-mono-code px-3 py-1.5'
                    : `btn btn-sm ${active ? 'btn-primary' : 'btn-outline-secondary'}`
                }
                style={
                  variant === 'card'
                    ? {
                        fontSize: '0.8rem',
                        backgroundColor: active ? '#0B1B2B' : 'transparent',
                        color: active ? '#FFFFFF' : '#64748B',
                        border: active ? '1px solid #0B1B2B' : '1px solid #E2E8F0',
                        fontWeight: active ? 600 : 400,
                      }
                    : undefined
                }
                aria-pressed={active}
                onClick={() => setTypeFilter(opt.key)}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {showSearch && (
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search assets..."
            aria-label="Search assets"
            wrapperStyle={{ minWidth: variant === 'card' ? 240 : undefined }}
          />
        )}
      </div>

      <div
        className={
          variant === 'card'
            ? 'd-flex flex-column gap-2.5 pe-1'
            : 'border rounded'
        }
        style={{ maxHeight, overflowY: 'auto' }}
        data-testid="project-asset-picker-list"
      >
        {filtered.length === 0 ? (
          variant === 'card' ? (
            <div className="card p-5 text-center bg-white border" style={{ borderColor: '#E2E8F0' }}>
              <Layers size={36} className="text-muted mx-auto mb-2 opacity-50" />
              <h6 className="fw-semibold text-dark mb-1">{emptyTitle}</h6>
              <p className="text-muted small mb-0 fst-italic">{emptyHint}</p>
            </div>
          ) : (
            <div className="p-3 text-muted small text-center">
              <p className="mb-1">{emptyTitle}</p>
              <p className="mb-0 fst-italic">{emptyHint}</p>
            </div>
          )
        ) : (
          filtered.map((asset) => {
            const assetKey = `${asset.assetType}:${asset.assetId}`;
            const selectedSetId = resolveSetId(asset);
            const actions =
              renderActions?.(asset, selectedSetId) ??
              (onAdd ? (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary flex-shrink-0"
                  disabled={!selectedSetId}
                  onClick={() => onAdd(asset, selectedSetId)}
                >
                  {addLabel}
                </button>
              ) : null);

            if (variant === 'card') {
              return (
                <div
                  key={assetKey}
                  className="card p-3 border shadow-sm bg-white"
                  style={{ borderRadius: '8px', borderColor: '#E2E8F0' }}
                  data-testid="project-asset-picker-row"
                >
                  <div className="d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-3">
                    <div className="d-flex flex-column min-w-0">
                      <div className="d-flex align-items-center gap-2 flex-wrap">
                        <span className="fw-bold text-dark font-mono-code" style={{ fontSize: '0.95rem' }}>
                          {asset.assetId}
                        </span>
                        <h6 className="fw-bold text-dark mb-0 text-truncate" style={{ fontSize: '0.95rem' }}>
                          {asset.assetName}
                        </h6>
                        <span
                          className="badge rounded-pill font-mono-code px-2 py-0.5"
                          style={{
                            fontSize: '0.7rem',
                            backgroundColor: 'rgba(11, 27, 43, 0.08)',
                            color: '#0B1B2B',
                            fontWeight: 600,
                          }}
                        >
                          {asset.assetType}
                        </span>
                      </div>
                      {renderAssetMeta ? (
                        renderAssetMeta(asset)
                      ) : (
                        <div className="text-muted small mt-1">{asset.providerOrganization}</div>
                      )}
                    </div>
                    {actions}
                  </div>
                </div>
              );
            }

            return (
              <div
                key={assetKey}
                className="d-flex align-items-center justify-content-between gap-2 p-2 border-bottom small"
                data-testid="project-asset-picker-row"
              >
                <div className="flex-grow-1 min-w-0">
                  <div className="fw-semibold d-flex align-items-center gap-1 flex-wrap">
                    {asset.assetName}
                    {showExternalBadge && (
                      <span className="badge bg-warning text-dark" style={{ fontSize: '0.6rem' }}>
                        External
                      </span>
                    )}
                  </div>
                  <div className="text-muted">
                    {asset.assetType} · {asset.providerOrganization}
                  </div>
                  {showAssuranceSetSelect &&
                    (asset.eligibleAssuranceSets.length > 1 ? (
                      <select
                        className="form-select form-select-sm mt-1 font-mono-code"
                        style={{ fontSize: '0.7rem', maxWidth: '280px' }}
                        value={selectedSetId}
                        onChange={(e) => onAssuranceSetChange?.(assetKey, e.target.value)}
                        aria-label={`Assurance set for ${asset.assetName}`}
                      >
                        {asset.eligibleAssuranceSets.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.id} — {s.title}
                          </option>
                        ))}
                      </select>
                    ) : (
                      selectedSetId && (
                        <div className="font-mono-code text-primary" style={{ fontSize: '0.7rem' }}>
                          {selectedSetId}
                        </div>
                      )
                    ))}
                  {renderAssetMeta?.(asset)}
                </div>
                {actions}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
