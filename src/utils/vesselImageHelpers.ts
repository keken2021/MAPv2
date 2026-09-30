/* 
  file summary: realistic marine stock photo and listing avatar resolution utilities for vessel marketplace tiles.
  responsibilities: maps vessel identifiers and types to high-quality maritime stock photography with reliable fallback rendering.
  role in system: consumed by VesselTable marketplace grid view and vessel detail headers.
*/

export * from './imageCropHelpers';

export interface VesselListingContact {
  name: string;
  role: string;
  avatarUrl: string;
}

export interface VesselCharterBadgeInfo {
  label: string;
  dotColor: string;
}

export interface OrganizationLogoInfo {
  name: string;
  initials: string;
  badgeBg: string;
  badgeColor: string;
  logoUrl?: string;
}

/* Curated maritime vessel stock photography — verified authentic ships, boats & offshore vessels */
const VESSEL_STOCK_PHOTOS: Record<string, string> = {
  'VESSEL-001': 'https://plus.unsplash.com/premium_photo-1661880889658-6c3ac991146f?q=80&w=1074&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D', // MV Pacific Endeavour
  'VESSEL-002': 'https://images.unsplash.com/photo-1583857671904-a716bf4ee5d8?q=80&w=880&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D', // MV Coral Titan
  'VESSEL-003': 'https://images.unsplash.com/photo-1713127563314-5163b052cf8b?q=80&w=1171&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D', // MV Tasman Pioneer
  'VESSEL-004': 'https://images.unsplash.com/photo-1658684276903-d01b7974ca90?q=80&w=735&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D', // MV Southern Cross
  'VESSEL-005': 'https://images.unsplash.com/photo-1703977883249-d959f2b0c1ae?q=80&w=2071&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D', // MV Atlantic Ocean
  'VESSEL-006': 'https://images.unsplash.com/photo-1732515742827-b46fba760ff1?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D', // MV Kimberley Guardian
  'VESSEL-007': 'https://plus.unsplash.com/premium_photo-1661881151268-8c3ee3de4c38?q=80&w=1332&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D', // MV Ningaloo Voyager
  'VESSEL-008': 'https://plus.unsplash.com/premium_photo-1661879449050-069f67e200bd?q=80&w=1122&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D', // MV Meridian Pioneer
  'VESSEL-009': 'https://plus.unsplash.com/premium_photo-1661962278758-d529030366fb?q=80&w=1228&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D', // MV Austral Horizon
  'VESSEL-010': 'https://plus.unsplash.com/premium_photo-1664298003939-e93f37196118?q=80&w=1333&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D', // MV Oceanic Sentinel
  'VESSEL-011': 'https://plus.unsplash.com/premium_photo-1661880889658-6c3ac991146f?q=80&w=1074&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D', // MV Southern Basin Pioneer
};

const TYPE_ACCURATE_PHOTOS: Record<string, string> = {
  AHTS: 'https://plus.unsplash.com/premium_photo-1661880889658-6c3ac991146f?q=80&w=1074&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  PSV: 'https://images.unsplash.com/photo-1583857671904-a716bf4ee5d8?q=80&w=880&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  SSV: 'https://images.unsplash.com/photo-1713127563314-5163b052cf8b?q=80&w=1171&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  ERRV: 'https://images.unsplash.com/photo-1732515742827-b46fba760ff1?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  RESCUE: 'https://images.unsplash.com/photo-1732515742827-b46fba760ff1?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  TOWING: 'https://images.unsplash.com/photo-1703977883249-d959f2b0c1ae?q=80&w=2071&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  TUG: 'https://images.unsplash.com/photo-1703977883249-d959f2b0c1ae?q=80&w=2071&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  CARRIER: 'https://plus.unsplash.com/premium_photo-1661879449050-069f67e200bd?q=80&w=1122&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  TANKER: 'https://plus.unsplash.com/premium_photo-1661879449050-069f67e200bd?q=80&w=1122&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  LNG: 'https://plus.unsplash.com/premium_photo-1661879449050-069f67e200bd?q=80&w=1122&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  OSV: 'https://images.unsplash.com/photo-1658684276903-d01b7974ca90?q=80&w=735&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  CARGO: 'https://plus.unsplash.com/premium_photo-1661962278758-d529030366fb?q=80&w=1228&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  BARGE: 'https://images.unsplash.com/photo-1703977883249-d959f2b0c1ae?q=80&w=2071&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  CREW: 'https://plus.unsplash.com/premium_photo-1661881151268-8c3ee3de4c38?q=80&w=1332&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  OFFSHORE: 'https://plus.unsplash.com/premium_photo-1664298003939-e93f37196118?q=80&w=1333&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
};

const DEFAULT_VESSEL_PHOTOS = [
  'https://plus.unsplash.com/premium_photo-1661880889658-6c3ac991146f?q=80&w=1074&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  'https://images.unsplash.com/photo-1583857671904-a716bf4ee5d8?q=80&w=880&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  'https://images.unsplash.com/photo-1713127563314-5163b052cf8b?q=80&w=1171&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  'https://images.unsplash.com/photo-1658684276903-d01b7974ca90?q=80&w=735&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  'https://images.unsplash.com/photo-1703977883249-d959f2b0c1ae?q=80&w=2071&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  'https://images.unsplash.com/photo-1732515742827-b46fba760ff1?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  'https://plus.unsplash.com/premium_photo-1661881151268-8c3ee3de4c38?q=80&w=1332&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  'https://plus.unsplash.com/premium_photo-1661879449050-069f67e200bd?q=80&w=1122&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  'https://plus.unsplash.com/premium_photo-1661962278758-d529030366fb?q=80&w=1228&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  'https://plus.unsplash.com/premium_photo-1664298003939-e93f37196118?q=80&w=1333&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
];

const CONTACT_AVATARS = [
  {
    name: 'Capt. Alexander Wright',
    role: 'Master Mariner · Northwind Marine',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
  },
  {
    name: 'Capt. Sarah Jenkins',
    role: 'Operations Lead · Northwind Marine',
    avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=150&q=80',
  },
  {
    name: 'Marcus Chen',
    role: 'Chartering Manager · Northwind Marine',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
  },
  {
    name: 'Elena Rostova',
    role: 'Fleet Manager · Southern Basin',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80',
  },
  {
    name: 'Justin Franci',
    role: 'Offshore Broker · Marine Exchange',
    avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=150&q=80',
  },
  {
    name: 'Kadin Siphron',
    role: 'Chartering Director · PT Jaya Tambang',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80',
  },
];

export const CURATED_VESSEL_PHOTOS = [
  {
    title: 'AHTS / Offshore Support',
    url: 'https://plus.unsplash.com/premium_photo-1661880889658-6c3ac991146f?q=80&w=1074&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  },
  {
    title: 'Platform Supply Vessel (PSV)',
    url: 'https://images.unsplash.com/photo-1583857671904-a716bf4ee5d8?q=80&w=880&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  },
  {
    title: 'Subsea Support Vessel (SSV)',
    url: 'https://images.unsplash.com/photo-1713127563314-5163b052cf8b?q=80&w=1171&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  },
  {
    title: 'Offshore Tug & Towing',
    url: 'https://images.unsplash.com/photo-1703977883249-d959f2b0c1ae?q=80&w=2071&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  },
  {
    title: 'Emergency Response / ERRV',
    url: 'https://images.unsplash.com/photo-1732515742827-b46fba760ff1?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  },
  {
    title: 'Heavy Tanker & Cargo',
    url: 'https://plus.unsplash.com/premium_photo-1661879449050-069f67e200bd?q=80&w=1122&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  },
  {
    title: 'Commercial Freighter',
    url: 'https://plus.unsplash.com/premium_photo-1661962278758-d529030366fb?q=80&w=1228&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  },
  {
    title: 'Offshore Industrial Craft',
    url: 'https://plus.unsplash.com/premium_photo-1664298003939-e93f37196118?q=80&w=1333&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  },
];

/**
  what: returns a maritime stock photography URL for a vessel.
  how: checks custom user image first, then exact vessel ID map, then checks vessel type/subtype, then picks a deterministic boat photo from standard pool.
*/
export const getVesselStockPhoto = (
  vesselId?: string,
  vesselName?: string,
  vesselType?: string,
  vesselSubtype?: string,
  customImageUrl?: string,
): string => {
  if (customImageUrl && customImageUrl.trim().length > 0) {
    return customImageUrl;
  }

  if (vesselId && VESSEL_STOCK_PHOTOS[vesselId]) {
    return VESSEL_STOCK_PHOTOS[vesselId];
  }

  const typeKey = (vesselSubtype || vesselType || '').toUpperCase();
  for (const [key, url] of Object.entries(TYPE_ACCURATE_PHOTOS)) {
    if (typeKey.includes(key)) {
      return url;
    }
  }

  const hash = (vesselName || vesselId || 'vessel')
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return DEFAULT_VESSEL_PHOTOS[hash % DEFAULT_VESSEL_PHOTOS.length];
};

/**
  what: returns listing contact details with photo avatar based on vessel owner/master.
*/
export const getVesselListingContact = (
  registeredOwner?: string,
  masterName?: string,
  vesselId?: string,
): VesselListingContact => {
  if (masterName) {
    const matched = CONTACT_AVATARS.find((c) => c.name.toLowerCase() === masterName.toLowerCase());
    if (matched) {
      return {
        name: matched.name,
        role: registeredOwner || matched.role,
        avatarUrl: matched.avatarUrl,
      };
    }
  }

  const hash = (vesselId || registeredOwner || 'contact')
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const selected = CONTACT_AVATARS[hash % CONTACT_AVATARS.length];

  return {
    name: masterName || selected.name,
    role: registeredOwner || selected.role,
    avatarUrl: selected.avatarUrl,
  };
};

/**
  what: returns the top-left floating charter badge configuration matching the mockup style.
*/
export const getVesselCharterBadge = (
  status?: string,
  intendedUse?: string,
): VesselCharterBadgeInfo => {
  switch (status) {
    case 'Under Charter':
      return { label: 'Time Charter', dotColor: '#ef4444' }; // Red dot
    case 'In Transit':
    case 'In-Transit':
      return { label: 'Freight Charter', dotColor: '#8b5cf6' }; // Purple dot
    case 'Awaiting Orders':
    case 'Standby':
      return { label: 'Standby / Available', dotColor: '#eab308' }; // Yellow/Amber dot
    case 'Port Stay':
      return { label: 'Spot Charter', dotColor: '#3b82f6' }; // Blue dot
    case 'In Operations':
    case 'Active':
      return { label: 'Active Campaign', dotColor: '#10b981' }; // Green dot
    case 'Maintenance':
    case 'Dry Docking':
    case 'Dry-Docking':
      return { label: 'Maintenance Yard', dotColor: '#f97316' }; // Orange dot
    case 'Lay-up':
    case 'Decommissioned':
      return { label: 'Laid Up', dotColor: '#64748b' }; // Slate dot
    default:
      return {
        label: intendedUse ? intendedUse.split('&')[0].trim() : 'Charter Ready',
        dotColor: '#0ea5e9',
      };
  }
};

/**
  what: returns structured branding and logo information for maritime organizations.
  how: maps recognized company names to branded color palettes, initials, and corporate logo assets.
*/
export const getOrganizationLogo = (orgName?: string): OrganizationLogoInfo => {
  const cleanName = (orgName || 'Maritime Organization').trim();
  const lower = cleanName.toLowerCase();

  if (lower.includes('northwind')) {
    return {
      name: cleanName,
      initials: 'NM',
      badgeBg: 'linear-gradient(135deg, #0284c7, #0369a1)',
      badgeColor: '#ffffff',
      logoUrl: 'https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?auto=format&fit=crop&w=120&q=80',
    };
  }
  if (lower.includes('southern basin') || lower.includes('southern')) {
    return {
      name: cleanName,
      initials: 'SB',
      badgeBg: 'linear-gradient(135deg, #0f766e, #115e59)',
      badgeColor: '#ffffff',
      logoUrl: 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?auto=format&fit=crop&w=120&q=80',
    };
  }
  if (lower.includes('pacific offshore') || lower.includes('pacific')) {
    return {
      name: cleanName,
      initials: 'PO',
      badgeBg: 'linear-gradient(135deg, #1e3a8a, #172554)',
      badgeColor: '#ffffff',
      logoUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=120&q=80',
    };
  }
  if (lower.includes('al seer') || lower.includes('seer')) {
    return {
      name: cleanName,
      initials: 'AS',
      badgeBg: 'linear-gradient(135deg, #0284c7, #0e7490)',
      badgeColor: '#ffffff',
    };
  }
  if (lower.includes('anglo-eastern') || lower.includes('anglo')) {
    return {
      name: cleanName,
      initials: 'AE',
      badgeBg: 'linear-gradient(135deg, #15803d, #166534)',
      badgeColor: '#ffffff',
    };
  }
  if (lower.includes('alkaid')) {
    return {
      name: cleanName,
      initials: 'AL',
      badgeBg: 'linear-gradient(135deg, #b91c1c, #991b1b)',
      badgeColor: '#ffffff',
    };
  }
  if (lower.includes('jaya tambang') || lower.includes('tambang')) {
    return {
      name: cleanName,
      initials: 'JT',
      badgeBg: 'linear-gradient(135deg, #c2410c, #9a3412)',
      badgeColor: '#ffffff',
    };
  }

  // Derive initials from words
  const words = cleanName.split(/\s+/).filter(Boolean);
  const initials = words.length >= 2
    ? (words[0][0] + words[1][0]).toUpperCase()
    : cleanName.slice(0, 2).toUpperCase();

  const colorPool = [
    'linear-gradient(135deg, #2563eb, #1d4ed8)',
    'linear-gradient(135deg, #0d9488, #0f766e)',
    'linear-gradient(135deg, #4f46e5, #4338ca)',
    'linear-gradient(135deg, #7c3aed, #6d28d9)',
    'linear-gradient(135deg, #0891b2, #0e7490)',
    'linear-gradient(135deg, #334155, #1e293b)',
  ];
  const hash = cleanName.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);

  return {
    name: cleanName,
    initials,
    badgeBg: colorPool[hash % colorPool.length],
    badgeColor: '#ffffff',
  };
};

