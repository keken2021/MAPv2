/* 
  file summary: sleek enterprise thumbnail preview card for vessels, equipment, crew, and services in the marketplace.
  responsibilities: presents an unboxed, high-hierarchy preview with photo, floating status indicator badge, category eyebrow, tabular metrics, and listing organization callout.
  role in system: rendered in the MarketplaceView grid.
*/

import React from 'react';
import { Camera, MoreHorizontal } from 'lucide-react';
import { MarketplaceItem } from '../../types/marketplace';
import { getOrganizationLogo } from '../../utils/vesselImageHelpers';

interface MarketplaceCardProps {
  item: MarketplaceItem;
  onSelect: (item: MarketplaceItem) => void;
}

export const MarketplaceCard: React.FC<MarketplaceCardProps> = ({ item, onSelect }) => {
  const orgInfo = getOrganizationLogo(item.providerOrg);

  // Derive metric values with fallbacks
  const metric1Label = item.metrics?.[0]?.label || (item.category === 'vessel' ? 'Capacity (DWT)' : item.category === 'crew' ? 'Experience' : 'Capacity / Output');
  const metric1Value = item.metrics?.[0]?.value || (item.category === 'vessel' ? '4,400 MT' : item.category === 'crew' ? '12+ Years' : 'Standard');

  const metric2Label = item.metrics?.[1]?.label || (item.category === 'vessel' ? 'Assurance / Class' : 'Assurance / Readiness');
  const metric2Value = item.metrics?.[1]?.value || `ABS · ${item.complianceReadinessScore}%`;

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
        borderRadius: '16px',
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
      {/* 1. Header (Visual): Image with Floating Top-Left Status Pill Badge */}
      <div
        className="position-relative overflow-hidden w-100"
        style={{
          height: '190px',
          backgroundColor: '#0B1B2B',
        }}
      >
        <img
          src={item.imageUrl}
          alt={item.name}
          className="w-100 h-100 object-fit-cover"
          loading="lazy"
          style={{
            objectPosition: item.category === 'crew' ? 'center 15%' : 'center',
            transition: 'transform 0.35s ease',
          }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src =
              item.category === 'crew'
                ? 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80'
                : 'https://images.unsplash.com/photo-1583857671904-a716bf4ee5d8?q=80&w=880&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D';
          }}
        />

        {/* Floating Top-Left Status Badge Pill (White with Colored Dot) */}
        <div
          className="position-absolute d-inline-flex align-items-center rounded-pill shadow-sm"
          style={{
            top: '12px',
            left: '12px',
            backgroundColor: '#FFFFFF',
            padding: '5px 12px',
            zIndex: 3,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
            maxWidth: '85%',
          }}
        >
          <span
            className="rounded-circle flex-shrink-0"
            style={{
              width: '8px',
              height: '8px',
              backgroundColor: item.availabilityTagColor || '#F97316',
              marginRight: '7px',
            }}
          />
          <span
            className="fw-semibold text-truncate"
            style={{
              fontSize: '0.78rem',
              color: '#0B1B2B',
              letterSpacing: '0.01em',
            }}
            title={item.availabilityStatus}
          >
            {item.availabilityStatus}
          </span>
        </div>

        {/* Photo Gallery Count (Top-Right if multiple photos exist) */}
        {item.photos && item.photos.length > 1 && (
          <div
            className="position-absolute d-inline-flex align-items-center gap-1"
            style={{
              top: '12px',
              right: '14px',
              zIndex: 3,
              filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.8)) drop-shadow(0 1px 2px rgba(0, 0, 0, 0.9))',
            }}
          >
            <Camera size={15} className="text-white" />
            <span
              className="text-white font-mono-code fw-bold"
              style={{
                fontSize: '0.82rem',
                textShadow: '0 1px 3px rgba(0, 0, 0, 0.85)',
              }}
            >
              {item.photos.length}
            </span>
          </div>
        )}
      </div>

      {/* 2. Card Content Body */}
      <div className="p-4 d-flex flex-column flex-grow-1 justify-content-between">
        <div>
          {/* Title Row with More Options */}
          <div className="d-flex align-items-start justify-content-between gap-2">
            <h5
              className="mb-0 fw-bold text-truncate"
              style={{
                fontSize: '1.12rem',
                lineHeight: '1.3',
                color: '#0B1B2B',
                fontFamily: "'IBM Plex Sans', sans-serif",
              }}
              title={item.name}
            >
              {item.name}
            </h5>
            <button
              type="button"
              className="btn btn-link p-0 text-secondary opacity-60 border-0 flex-shrink-0 d-inline-flex align-items-center justify-content-center"
              style={{ width: '24px', height: '24px', color: '#64748B' }}
              title="More options"
              aria-label="More options"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(item);
              }}
            >
              <MoreHorizontal size={18} />
            </button>
          </div>

          {/* Subtitle / Subcategory */}
          <div
            className="text-truncate mt-1 mb-3"
            style={{
              fontSize: '0.88rem',
              color: '#64748B',
              fontWeight: 400,
            }}
            title={item.subcategory}
          >
            {item.subcategory}
          </div>

          {/* Key Metrics Row */}
          <div className="d-flex align-items-center justify-content-between gap-3 mb-3">
            {/* Metric 1 */}
            <div className="d-flex flex-column min-w-0">
              <span
                className="text-secondary text-truncate mb-0.5"
                style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 500 }}
                title={metric1Label}
              >
                {metric1Label}
              </span>
              <span
                className="fw-bold text-truncate"
                style={{ fontSize: '1.05rem', color: '#0B1B2B', fontFamily: "'IBM Plex Sans', sans-serif" }}
                title={metric1Value}
              >
                {metric1Value}
              </span>
            </div>

            {/* Metric 2 */}
            <div className="d-flex flex-column min-w-0 text-end ms-auto">
              <span
                className="text-secondary text-truncate mb-0.5"
                style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 500 }}
                title={metric2Label}
              >
                {metric2Label}
              </span>
              <span
                className="fw-bold text-truncate"
                style={{ fontSize: '1.05rem', color: '#0B1B2B', fontFamily: "'IBM Plex Sans', sans-serif" }}
                title={metric2Value}
              >
                {metric2Value}
              </span>
            </div>
          </div>
        </div>

        {/* 3. Listing Organization Nested Card Box */}
        <div
          className="p-3 rounded-3 mt-2 d-flex flex-column gap-2"
          style={{
            backgroundColor: '#F8FAFC',
            border: '1px solid #F1F5F9',
            borderRadius: '12px',
          }}
        >
          <div
            className="text-uppercase fw-bold"
            style={{
              fontSize: '0.68rem',
              letterSpacing: '0.05em',
              color: '#8E9BAE',
            }}
          >
            Listing Organization
          </div>
          <div className="d-flex align-items-center gap-2.5 min-w-0">
            {orgInfo.logoUrl ? (
              <img
                src={orgInfo.logoUrl}
                alt={orgInfo.name}
                className="rounded-2 flex-shrink-0 border"
                style={{
                  width: '36px',
                  height: '36px',
                  objectFit: 'contain',
                  backgroundColor: '#FFFFFF',
                  borderColor: '#E2E8F0',
                  padding: '2px',
                }}
              />
            ) : (
              <div
                className="rounded-2 flex-shrink-0 d-flex align-items-center justify-content-center fw-bold shadow-2xs"
                style={{
                  width: '36px',
                  height: '36px',
                  background: orgInfo.badgeBg,
                  color: orgInfo.badgeColor,
                  fontSize: '0.82rem',
                  letterSpacing: '0.02em',
                }}
              >
                {orgInfo.initials}
              </div>
            )}
            <div className="min-w-0 d-flex flex-column">
              <span
                className="fw-bold text-truncate"
                style={{ fontSize: '0.88rem', color: '#0B1B2B', lineHeight: '1.25' }}
                title={item.providerOrg}
              >
                {item.providerOrg}
              </span>
              <span
                className="text-secondary text-truncate"
                style={{ fontSize: '0.76rem', color: '#64748B' }}
              >
                Verified Maritime Provider
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

