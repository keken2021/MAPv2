/* 
  file summary: sleek enterprise thumbnail preview card for vessels, equipment, crew, and services in the marketplace.
  responsibilities: presents an unboxed, high-hierarchy preview with photo, status indicator, category eyebrow, tabular metrics, and provider footer.
  role in system: rendered in the MarketplaceView grid.
*/

import React from 'react';
import { ArrowUpRight, MapPin, ShieldCheck } from 'lucide-react';
import { MarketplaceItem } from '../../types/marketplace';
import { getOrganizationLogo } from '../../utils/vesselImageHelpers';

interface MarketplaceCardProps {
  item: MarketplaceItem;
  onSelect: (item: MarketplaceItem) => void;
}

export const MarketplaceCard: React.FC<MarketplaceCardProps> = ({ item, onSelect }) => {
  const orgInfo = getOrganizationLogo(item.providerOrg);

  return (
    <div
      className="card map-card-custom h-100 d-flex flex-column border overflow-hidden shadow-2xs"
      onClick={() => onSelect(item)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(item);
        }
      }}
      aria-label={`View details for ${item.name}`}
      style={{
        borderRadius: '8px',
        borderColor: '#E2E8F0',
        backgroundColor: '#FFFFFF',
        cursor: 'pointer',
        transition: 'transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.18s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.18s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 12px 24px -4px rgba(11, 27, 43, 0.08), 0 4px 6px -2px rgba(11, 27, 43, 0.03)';
        e.currentTarget.style.borderColor = '#CBD5E1';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '';
        e.currentTarget.style.borderColor = '#E2E8F0';
      }}
    >
      {/* 1. Header (Visual): Fixed 16:9 Aspect Ratio with Subtle Gradient & Single Status Pill */}
      <div
        className="position-relative overflow-hidden w-100"
        style={{
          height: '175px',
          backgroundColor: '#0B1B2B',
        }}
      >
        <img
          src={item.imageUrl}
          alt={item.name}
          className="w-100 h-100 object-fit-cover"
          loading="lazy"
          style={{ transition: 'transform 0.35s ease' }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src =
              'https://images.unsplash.com/photo-1583857671904-a716bf4ee5d8?q=80&w=880&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D';
          }}
        />

        {/* Subtle Bottom Dark Gradient Overlay */}
        <div
          className="position-absolute bottom-0 start-0 end-0"
          style={{
            height: '40%',
            background: 'linear-gradient(to top, rgba(11, 27, 43, 0.45) 0%, transparent 100%)',
            pointerEvents: 'none',
          }}
        />

        {/* Single Integrated Status Indicator Pill */}
        <div
          className="position-absolute d-inline-flex align-items-center gap-1.5 px-2.5 py-1 rounded-pill shadow-sm"
          style={{
            top: '10px',
            right: '10px',
            maxWidth: '75%',
            backgroundColor: 'rgba(11, 27, 43, 0.82)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            zIndex: 2,
          }}
        >
          <span
            className="flex-shrink-0"
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: item.availabilityTagColor || '#10B981',
              boxShadow: `0 0 6px ${item.availabilityTagColor || '#10B981'}`,
            }}
          />
          <span
            className="text-truncate text-white"
            style={{
              fontSize: '0.72rem',
              fontWeight: 500,
              letterSpacing: '0.01em',
            }}
            title={item.availabilityStatus}
          >
            {item.availabilityStatus}
          </span>
        </div>
      </div>

      {/* Card Content Body */}
      <div className="p-3.5 d-flex flex-column flex-grow-1" style={{ padding: '16px' }}>
        {/* 2. Identity Zone: Subcategory Eyebrow -> Asset Name */}
        <div className="mb-2.5">
          <div
            className="text-uppercase fw-semibold mb-1 text-truncate"
            style={{
              fontSize: '0.68rem',
              color: '#64748B',
              letterSpacing: '0.05em',
            }}
            title={item.subcategory}
          >
            {item.subcategory}
          </div>
          <div className="d-flex align-items-start justify-content-between gap-2">
            <h6
              className="mb-0 fw-bold text-truncate"
              style={{
                fontSize: '0.98rem',
                lineHeight: '1.3',
                color: '#0B1B2B',
                fontFamily: "'IBM Plex Sans', sans-serif",
              }}
              title={item.name}
            >
              {item.name}
            </h6>
            <span className="text-secondary flex-shrink-0 pt-0.5 opacity-60">
              <ArrowUpRight size={16} />
            </span>
          </div>
        </div>

        {/* 3. Specs Strip: Borderless Clean Key-Value Row with Hairline Top Divider */}
        <div
          className="pt-2.5 pb-2 mb-auto border-top"
          style={{
            borderColor: '#F1F5F9',
          }}
        >
          <div className="d-flex align-items-center justify-content-between gap-2">
            {/* Metric 1 */}
            {item.metrics[0] && (
              <div className="d-flex flex-column min-w-0 pe-2">
                <span
                  className="text-secondary text-uppercase fw-medium text-truncate"
                  style={{ fontSize: '0.65rem', color: '#64748B', letterSpacing: '0.04em' }}
                  title={item.metrics[0].label}
                >
                  {item.metrics[0].label}
                </span>
                <span
                  className="fw-semibold font-mono-code text-truncate"
                  style={{ fontSize: '0.85rem', color: '#1E293B' }}
                  title={item.metrics[0].value}
                >
                  {item.metrics[0].value}
                </span>
              </div>
            )}

            {/* Metric 2 or Readiness */}
            <div className="d-flex flex-column min-w-0 text-end ps-2 ms-auto">
              <span
                className="text-secondary text-uppercase fw-medium text-truncate d-flex align-items-center justify-content-end gap-1"
                style={{ fontSize: '0.65rem', color: '#64748B', letterSpacing: '0.04em' }}
              >
                <ShieldCheck size={11} className="text-primary" />
                <span>Readiness</span>
              </span>
              <span
                className="fw-semibold font-mono-code text-truncate text-primary"
                style={{ fontSize: '0.85rem' }}
              >
                {item.complianceReadinessScore}%
              </span>
            </div>
          </div>
        </div>

        {/* 4. Footer (Commercial Context): Streamlined Logo + Provider Name + Location */}
        <div
          className="pt-2.5 mt-2 border-top d-flex align-items-center justify-content-between gap-2 min-w-0"
          style={{
            borderColor: '#F1F5F9',
          }}
        >
          {/* Provider Identity */}
          <div className="d-flex align-items-center gap-2 min-w-0">
            {orgInfo.logoUrl ? (
              <img
                src={orgInfo.logoUrl}
                alt={orgInfo.name}
                className="rounded-2 flex-shrink-0 border"
                style={{ width: '28px', height: '28px', objectFit: 'cover', borderColor: '#E2E8F0' }}
              />
            ) : (
              <div
                className="rounded-2 flex-shrink-0 d-flex align-items-center justify-content-center fw-bold shadow-2xs"
                style={{
                  width: '28px',
                  height: '28px',
                  background: orgInfo.badgeBg,
                  color: orgInfo.badgeColor,
                  fontSize: '0.72rem',
                  letterSpacing: '0.02em',
                }}
              >
                {orgInfo.initials}
              </div>
            )}
            <span
              className="fw-medium text-dark text-truncate"
              style={{ fontSize: '0.82rem', color: '#1E293B' }}
              title={item.providerOrg}
            >
              {item.providerOrg}
            </span>
          </div>

          {/* Location Pin */}
          <div
            className="text-secondary text-truncate d-flex align-items-center gap-1 flex-shrink-0 ps-2"
            style={{ fontSize: '0.75rem', color: '#64748B' }}
            title={item.location}
          >
            <MapPin size={12} className="flex-shrink-0 text-muted" />
            <span className="text-truncate" style={{ maxWidth: '100px' }}>
              {item.location.split(',')[0]}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
