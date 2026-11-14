/* 
  file summary: centralized mock dataset for service provider marketplace offerings.
  responsibilities: aggregates marketplace vessels, equipment, and crew offerings for chartering and leasing.
  role in system: loaded by marketplaceHelpers.ts and useMapStore.ts.
*/

import { MarketplaceItem } from '../types/marketplace';
import { MOCK_MARKETPLACE_VESSELS } from './marketplaceVesselsMockData';
import { MOCK_MARKETPLACE_EQUIPMENT } from './marketplaceEquipmentMockData';
import { MOCK_MARKETPLACE_CREW } from './marketplaceCrewMockData';
import { MOCK_MARKETPLACE_CREW_SPECIALISTS } from './marketplaceCrewSpecialistsMockData';

export { MOCK_MARKETPLACE_VESSELS } from './marketplaceVesselsMockData';
export { MOCK_MARKETPLACE_EQUIPMENT } from './marketplaceEquipmentMockData';
export { MOCK_MARKETPLACE_CREW } from './marketplaceCrewMockData';
export { MOCK_MARKETPLACE_CREW_SPECIALISTS } from './marketplaceCrewSpecialistsMockData';

export const MOCK_MARKETPLACE_ITEMS: MarketplaceItem[] = [
  ...MOCK_MARKETPLACE_VESSELS,
  ...MOCK_MARKETPLACE_EQUIPMENT,
  ...MOCK_MARKETPLACE_CREW,
  ...MOCK_MARKETPLACE_CREW_SPECIALISTS,
];
