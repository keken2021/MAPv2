/* 
  file summary: mock dataset for service provider marketplace vessel offerings.
  responsibilities: provides verified third-party maritime vessels for chartering and leasing.
*/

import { MarketplaceItem } from '../types/marketplace';

export const MOCK_MARKETPLACE_VESSELS: MarketplaceItem[] = [
  {
    id: 'MAP-VES-2026-MKT-00008',
    name: 'MV Meridian Pioneer',
    category: 'vessel',
    subcategory: 'PSV / Multipurpose',
    providerOrg: 'Meridian Marine Services Pty Ltd',
    location: 'Darwin, NT',
    availableFrom: '2026-11-01',
    availableTo: '2027-02-28',
    availabilityStatus: 'Available for Charter',
    availabilityTagColor: '#059669',
    imageUrl: 'https://plus.unsplash.com/premium_photo-1661879449050-069f67e200bd?q=80&w=1122&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    shortDescription: 'High-capacity DP2 platform supply vessel fitted for bulk mud, deck cargo, and offshore support.',
    metrics: [
      { label: 'Capacity (DWT)', value: '4,200 MT' },
      { label: 'Assurance / Class', value: 'DNV · 70% Ready' },
    ],
    complianceReadinessScore: 70,
    rateEstimate: 'AUD 28,500 / day',
    mobilizationLeadTime: '48 Hours',
    certifications: ['DNV 1A1 DP2', 'AMSA Statutory Pack', 'SOLAS / ISPS Fully Certified'],
    operationalCapabilities: [
      'Deck cargo area 850 m2 with 10t/m2 loading strength',
      'Dynamic Positioning DP2 (Kongsberg K-Pos 22)',
      'Dual fuel low-sulphur compliant propulsion (2x 2,600 kW)',
      'Liquid mud and dry bulk pneumatic discharge systems',
    ],
    detailedSpecs: [
      { label: 'IMO Number', value: '9845128' },
      { label: 'Classification', value: 'DNV 1A1 PSV DP2' },
      { label: 'Year Built', value: '2022 (Vard Marine Norway)' },
      { label: 'Length Overall (LOA)', value: '84.5 m' },
      { label: 'Beam / Draft', value: '19.0 m / 5.9 m' },
      { label: 'Gross Tonnage', value: '3,400 GT' },
      { label: 'Deadweight Tonnage', value: '4,200 MT' },
      { label: 'Clear Deck Area', value: '850 m2' },
      { label: 'DP Capability', value: 'DP Class 2 (Kongsberg)' },
      { label: 'Accommodation', value: '32 Berths (Fully Air-Conditioned)' },
    ],
    contact: {
      name: 'Jonathan Briggs',
      role: 'Fleet Commercial Director · Meridian Marine',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
      email: 'chartering@meridianmarine.com.au',
      phone: '+61 8 8981 4455',
    },
    linkedEntityId: 'VESSEL-008',
    linkedEntityType: 'vessel',
    photos: [
      'https://plus.unsplash.com/premium_photo-1661879449050-069f67e200bd?q=80&w=1122&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
      'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1000&q=80',
    ],
  },
];
