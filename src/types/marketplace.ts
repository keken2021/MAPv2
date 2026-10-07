/* 
  file summary: typescript types and interfaces for the maritime marketplace module.
  responsibilities: defines data models for service provider vessels, equipment, crew, and services in the marketplace.
  role in system: consumed by marketplaceMockData, marketplaceHelpers, MarketplaceCard, MarketplaceDetailModal, and MarketplaceView.
*/

export type MarketplaceCategory = 'all' | 'vessel' | 'equipment' | 'crew' | 'service';

export interface MarketplaceMetric {
  label: string;
  value: string;
}

export interface MarketplaceContact {
  name: string;
  role: string;
  avatarUrl: string;
  email?: string;
  phone?: string;
}

export interface MarketplaceDetailSpec {
  label: string;
  value: string;
}

export interface MarketplaceItem {
  id: string;
  name: string;
  category: 'vessel' | 'equipment' | 'crew' | 'service';
  subcategory: string;
  providerOrg: string;
  location: string;
  availabilityStatus: string;
  availabilityTagColor: string;
  imageUrl: string;
  shortDescription: string;
  metrics: MarketplaceMetric[];
  complianceReadinessScore: number;
  rateEstimate?: string;
  mobilizationLeadTime?: string;
  certifications: string[];
  operationalCapabilities: string[];
  detailedSpecs: MarketplaceDetailSpec[];
  contact: MarketplaceContact;
  linkedEntityId?: string;
  linkedEntityType?: 'vessel' | 'equipment' | 'crew';
}

export interface MarketplaceFilterState {
  category: MarketplaceCategory;
  searchTerm: string;
  providerFilter: string;
  locationFilter: string;
  statusFilter: string;
  sortBy: 'name' | 'readiness' | 'provider' | 'category';
  sortOrder: 'asc' | 'desc';
}
