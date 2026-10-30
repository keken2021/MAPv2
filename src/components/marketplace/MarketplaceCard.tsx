/* 
  file summary: sleek enterprise thumbnail preview card for vessels, equipment, crew, and services in the marketplace.
  responsibilities: presents an unboxed, high-hierarchy preview with photo, floating status indicator badge, category eyebrow, tabular metrics, and listing organization callout.
  role in system: rendered in the MarketplaceView grid.
*/

import React from 'react';
import { Camera, MoreHorizontal } from 'lucide-react';
import { MarketplaceItem } from '../../types/marketplace';
import { getOrganizationLogo } from '../../utils/vesselImageHelpers';
import { formatReadinessScore, getFieldDisplayLabel, getProviderLabel } from '../../utils/formatters';

interface MarketplaceCardProps {
  item: MarketplaceItem;
  onSelect: (item: MarketplaceItem) => void;
}

/* vessel and crew photos that must not appear on an equipment listing, including the container-ship photo stored against the helideck */
const OTHER_ASSET_PHOTO_IDS = [
  'premium_photo-1661879449050',
  'premium_photo-1661962278758',
  'premium_photo-1664298003939',
  'premium_photo-1661880889658',
  'premium_photo-1661881151268',
  'photo-1583857671904',
  'photo-1519074069444',
  'photo-1507003211169',
  'photo-1560250097',
  'photo-1500648767791',
  'photo-1573496359142',
  'photo-1506794778202',
  'photo-1522075469751',
  'photo-1537368910025',
  'photo-1573497019940',
  'photo-1566492031773',
  'photo-1539571696357',
  'photo-1508214751196',
  'photo-1580489944761',
  'photo-1472099645785',
];

const EQUIPMENT_PHOTO_SET = [
  'photo-1682687220063',
  'photo-1541888946425',
  'photo-1550751827',
  'photo-1559136555',
  'photo-1517524008697',
  'photo-1581092335397',
  'photo-1509228468518',
  'photo-1581092580497',
  'photo-1504307651254',
  'photo-1544551763',
  'photo-1581092162384',
  'photo-1526374965328',
];

const NEUTRAL_EQUIPMENT_PLACEHOLDER =
  'https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=1000&q=80';

const EQUIPMENT_PLACEHOLDERS: { test: RegExp; url: string }[] = [
  { test: /helideck|foam|fire|ffe/i, url: 'https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?auto=format&fit=crop&w=1000&q=80' },
  { test: /life-saving|lifesaving|rescue/i, url: 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?auto=format&fit=crop&w=1000&q=80' },
  { test: /navigation|bridge|ecdis/i, url: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=1000&q=80' },
  { test: /rov|robot/i, url: 'https://images.unsplash.com/photo-1682687220063-4742bd7fd538?auto=format&fit=crop&w=1000&q=80' },
  { test: /crane|lifting|machinery|rigging|winch/i, url: 'https://images.unsplash.com/photo-1541888946425-d0fbb18086f6?auto=format&fit=crop&w=1000&q=80' },
];

const CREW_PLACEHOLDER =
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80';

const VESSEL_PLACEHOLDER =
  'https://images.unsplash.com/photo-1583857671904-a716bf4ee5d8?q=80&w=880&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D';

export const equipmentCardPhoto = (item: Pick<MarketplaceItem, 'name' | 'subcategory'>): string => {
  const haystack = `${item.subcategory} ${item.name}`;
  return EQUIPMENT_PLACEHOLDERS.find((entry) => entry.test.test(haystack))?.url ?? NEUTRAL_EQUIPMENT_PLACEHOLDER;
};

export const resolveMarketplaceCardImage = (
  item: Pick<MarketplaceItem, 'category' | 'imageUrl' | 'name' | 'subcategory'>,
): string => {
  if (item.category !== 'equipment') return item.imageUrl;
  const fromEquipmentSet = EQUIPMENT_PHOTO_SET.some((id) => item.imageUrl?.includes(id));
  const fromAnotherAsset = OTHER_ASSET_PHOTO_IDS.some((id) => item.imageUrl?.includes(id));
  if (fromEquipmentSet && !fromAnotherAsset) return item.imageUrl;
  return equipmentCardPhoto(item);
};

export const marketplaceCardStats = (
  item: MarketplaceItem,
): { label: string; value: string }[] => {
  let metric1Label = getFieldDisplayLabel(item.metrics?.[0]?.label || (item.category === 'vessel' ? 'Capacity (DWT)' : item.category === 'crew' ? 'Experience' : 'Capacity'));
  let metric1Value = item.metrics?.[0]?.value || (item.category === 'vessel' ? '4,400 MT' : item.category === 'crew' ? '12+ Years' : 'Standard');
  const metric2Label = getFieldDisplayLabel(item.metrics?.[1]?.label || (item.category === 'vessel' ? 'Assurance / Class' : 'Assurance / Readiness'));
  const metric2Value = item.metrics?.[1]?.value || formatReadinessScore(item.complianceReadinessScore);

  const repeatsRank = item.category === 'crew' && (/rank/i.test(metric1Label) || metric1Value === item.subcategory);
  if (repeatsRank) {
    const nationality = item.detailedSpecs?.find((spec) => /nationality/i.test(spec.label))?.value;
    const yearsAtSea = item.detailedSpecs?.find((spec) => /sea service|years at sea/i.test(spec.label))?.value;
    if (nationality) {
      metric1Label = 'Nationality';
      metric1Value = nationality;
    } else {
      metric1Label = 'Years at sea';
      metric1Value = yearsAtSea || '—';
    }
  }

  return [
    { label: metric1Label, value: metric1Value },
    { label: metric2Label, value: metric2Value },
  ];
};

const statValueStyle: React.CSSProperties = {
  fontSize: '1.05rem',
  color: '#0B1B2B',
  fontFamily: "'IBM Plex Sans', sans-serif",
  lineHeight: 1.25,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
};

export const MarketplaceCard: React.FC<MarketplaceCardProps> = ({ item, onSelect }) => {
  const orgInfo = getOrganizationLogo(item.providerOrg);
  const imageSrc = resolveMarketplaceCardImage(item);
  const [metric1, metric2] = marketplaceCardStats(item);
  const imageFallback = item.category === 'crew'
    ? CREW_PLACEHOLDER
    : item.category === 'equipment'
      ? equipmentCardPhoto(item)
      : VESSEL_PLACEHOLDER;

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
      aria-label={`View ${item.name}`}
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
          src={imageSrc}
          alt={item.name}
          className="w-100 h-100 object-fit-cover"
          loading="lazy"
          style={{
            objectPosition: item.category === 'crew' ? 'center 15%' : 'center',
            transition: 'transform 0.35s ease',
          }}
          onError={(e) => {
            const image = e.currentTarget as HTMLImageElement;
            if (image.src !== imageFallback) image.src = imageFallback;
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
                title={metric1.label}
              >
                {metric1.label}
              </span>
              <span className="fw-bold" data-stat-value style={statValueStyle}>
                {metric1.value}
              </span>
            </div>

            {/* Metric 2 */}
            <div className="d-flex flex-column min-w-0 text-end ms-auto">
              <span
                className="text-secondary text-truncate mb-0.5"
                style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 500 }}
                title={metric2.label}
              >
                {metric2.label}
              </span>
              <span className="fw-bold" data-stat-value style={statValueStyle}>
                {metric2.value}
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
            {getProviderLabel(item.category)}
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
                Verified {getProviderLabel(item.category)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

