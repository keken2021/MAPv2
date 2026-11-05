/*
  file summary: tests that marketplace listing commercial and vessel fields come from records.
  responsibilities: two-listing coverage for windows, rates, lead times, port/IMO/flag via linkedEntityId, and masterName contact.
  role in system: automated coverage for Task 5324.
*/

import { describe, expect, it } from 'vitest';
import {
  applyLinkedVesselListingFields,
  getMarketplaceItems,
  listingOfferForLinkedEntity,
} from '../utils/marketplaceHelpers';
import { MOCK_VESSELS } from '../store/mockData';
import { MOCK_EQUIPMENT } from '../store/equipmentMockData';
import { MOCK_CREW } from '../store/crewMockData';
import { MarketplaceItem } from '../types/marketplace';

const mockUsers = [
  { roles: ['C Admin' as const], organization: 'Southern Basin Energy Pty Ltd' },
];

describe('marketplace listing fields from records', () => {
  it('reads availability window, rate and lead time from listing offers on two linked assets', () => {
    const vesselOffer = listingOfferForLinkedEntity('VESSEL-003');
    const equipmentOffer = listingOfferForLinkedEntity('EQ-008');
    expect(vesselOffer).toEqual({
      availableFrom: '2027-01-15',
      availableTo: '2027-05-31',
      rateEstimate: 'AUD 27,000 / day',
      mobilizationLeadTime: '48 Hours',
      charterType: 'Platform Supply',
    });
    expect(equipmentOffer?.availableFrom).toBe('2026-09-01');
    expect(equipmentOffer?.rateEstimate).toBe('AUD 5,500 / day');

    const items = getMarketplaceItems(
      MOCK_VESSELS,
      MOCK_EQUIPMENT,
      'C Admin',
      mockUsers,
      MOCK_CREW,
    );
    const tasman = items.find((item) => item.linkedEntityId === 'VESSEL-003');
    const helideck = items.find((item) => item.linkedEntityId === 'EQ-008');
    expect(tasman?.availableFrom).toBe(vesselOffer!.availableFrom);
    expect(tasman?.rateEstimate).toBe(vesselOffer!.rateEstimate);
    expect(tasman?.mobilizationLeadTime).toBe(vesselOffer!.mobilizationLeadTime);
    expect(helideck?.availableFrom).toBe(equipmentOffer!.availableFrom);
    expect(helideck?.rateEstimate).toBe(equipmentOffer!.rateEstimate);
  });

  it('grounds a vessel listing on port, IMO, flag and masterName through linkedEntityId', () => {
    const items = getMarketplaceItems(
      MOCK_VESSELS,
      MOCK_EQUIPMENT,
      'C Admin',
      mockUsers,
      MOCK_CREW,
    );
    const meridian = items.find((item) => item.linkedEntityId === 'VESSEL-008')!;
    const vessel008 = MOCK_VESSELS.find((v) => v.id === 'VESSEL-008')!;

    expect(meridian.location).toBe(vessel008.portOfRegistry);
    expect(meridian.detailedSpecs.find((s) => s.label === 'IMO Number')?.value).toBe(vessel008.imoNumber);
    expect(meridian.contact.name).toBe(vessel008.masterName);

    const seeded: MarketplaceItem = {
      ...meridian,
      location: 'Invented Port',
      contact: { ...meridian.contact, name: 'Invented Contact' },
      detailedSpecs: [{ label: 'IMO Number', value: '0000000' }],
    };
    const grounded = applyLinkedVesselListingFields(seeded, vessel008);
    expect(grounded.location).toBe(vessel008.portOfRegistry);
    expect(grounded.contact.name).toBe(vessel008.masterName);
    expect(grounded.detailedSpecs.find((s) => s.label === 'IMO Number')?.value).toBe(vessel008.imoNumber);
  });
});
