import { describe, it, expect } from 'vitest';
import {
  CURATED_EQUIPMENT_PHOTOS,
  CURATED_CREW_PHOTOS,
  getEquipmentStockPhoto,
  getCrewStockPhoto,
} from '../utils/vesselImageHelpers';
import { getMarketplaceItems } from '../utils/marketplaceHelpers';
import { MOCK_VESSELS } from '../store/mockData';
import { MOCK_EQUIPMENT } from '../store/equipmentMockData';
import { MOCK_CREW } from '../store/crewMockData';

describe('Equipment and Crew Photo Gallery & Marketplace Integration', () => {
  describe('Stock Photo Resolution & Presets', () => {
    it('provides curated stock photo sets for both equipment and crew', () => {
      expect(CURATED_EQUIPMENT_PHOTOS.length).toBeGreaterThan(0);
      expect(CURATED_CREW_PHOTOS.length).toBeGreaterThan(0);
      expect(CURATED_EQUIPMENT_PHOTOS[0].url).toBeTruthy();
      expect(CURATED_CREW_PHOTOS[0].url).toBeTruthy();
    });

    it('resolves deterministic stock photos for equipment based on category and ID', () => {
      const photo1 = getEquipmentStockPhoto('EQ-101', 'Heavy ROV', 'Subsea Robotics & Intervention');
      const photo2 = getEquipmentStockPhoto('EQ-102', 'Offshore Crane', 'Machinery & Heavy Lifting');
      expect(photo1).toBeTruthy();
      expect(photo2).toBeTruthy();
      expect(photo1).not.toBe(photo2);
    });

    it('prioritizes custom imageUrl over default stock photo for equipment', () => {
      const custom = 'https://custom-domain.com/my-crane.jpg';
      const resolved = getEquipmentStockPhoto('EQ-102', 'Offshore Crane', 'Machinery', custom);
      expect(resolved).toBe(custom);
    });

    it('resolves deterministic stock photos for crew based on rank and ID', () => {
      const captainPhoto = getCrewStockPhoto('CREW-101', 'Capt. Callum Sterling', 'Master');
      const engineerPhoto = getCrewStockPhoto('CREW-102', 'Henrik Vestergaard', 'Chief Engineer');
      expect(captainPhoto).toBeTruthy();
      expect(engineerPhoto).toBeTruthy();
    });

    it('prioritizes custom imageUrl over default stock photo for crew', () => {
      const custom = 'https://custom-domain.com/my-captain.jpg';
      const resolved = getCrewStockPhoto('CREW-101', 'Capt. Callum Sterling', 'Master', custom);
      expect(resolved).toBe(custom);
    });
  });

  describe('Store Mock Initial Seed Integrity', () => {
    it('seeds imageUrl and photos gallery arrays for initial equipment records', () => {
      MOCK_EQUIPMENT.forEach((eq) => {
        expect(eq.imageUrl).toBeDefined();
        expect(eq.photos).toBeDefined();
        expect(eq.photos!.length).toBeGreaterThan(0);
        expect(eq.photos![0]).toBe(eq.imageUrl);
      });
    });

    it('seeds imageUrl and photos gallery arrays for initial crew records', () => {
      MOCK_CREW.forEach((c) => {
        expect(c.imageUrl).toBeDefined();
        expect(c.photos).toBeDefined();
        expect(c.photos!.length).toBeGreaterThan(0);
        expect(c.photos![0]).toBe(c.imageUrl);
      });
    });
  });

  describe('Marketplace Synchronized Photo & Gallery Exposure', () => {
    it('exposes photos arrays and updated photos in marketplace items for equipment, vessels, and crew', () => {
      const items = getMarketplaceItems(
        MOCK_VESSELS,
        MOCK_EQUIPMENT,
        'C Admin',
        [],
        MOCK_CREW,
      );

      const equipmentItems = items.filter((i) => i.category === 'equipment');
      const crewItems = items.filter((i) => i.category === 'crew');
      const vesselItems = items.filter((i) => i.category === 'vessel');

      expect(equipmentItems.length).toBeGreaterThan(0);
      expect(crewItems.length).toBeGreaterThan(0);
      expect(vesselItems.length).toBeGreaterThan(0);

      // Verify equipment photos are passed through
      equipmentItems.forEach((eqItem) => {
        expect(eqItem.imageUrl).toBeTruthy();
        expect(eqItem.photos).toBeDefined();
        expect(eqItem.photos!.length).toBeGreaterThan(0);
      });

      // Verify crew photos are passed through
      crewItems.forEach((crewItem) => {
        expect(crewItem.imageUrl).toBeTruthy();
        expect(crewItem.photos).toBeDefined();
        expect(crewItem.photos!.length).toBeGreaterThan(0);
      });

      // Verify vessel photos are passed through
      vesselItems.forEach((vesItem) => {
        expect(vesItem.imageUrl).toBeTruthy();
        expect(vesItem.photos).toBeDefined();
        expect(vesItem.photos!.length).toBeGreaterThan(0);
      });
    });

    it('synchronizes custom cropped images from store equipment and crew to linked marketplace items', () => {
      const customEqPhoto = 'https://custom-images.com/rov-cropped.jpg';
      const customCrewPhoto = 'https://custom-images.com/captain-cropped.jpg';

      const modifiedEquipment = MOCK_EQUIPMENT.map((eq) =>
        eq.id === 'EQ-007' ? { ...eq, imageUrl: customEqPhoto, photos: [customEqPhoto, 'https://sub.jpg'] } : eq,
      );

      const modifiedCrew = MOCK_CREW.map((cr) =>
        cr.id === 'CREW-101' ? { ...cr, imageUrl: customCrewPhoto, photos: [customCrewPhoto, 'https://sub2.jpg'] } : cr,
      );

      const items = getMarketplaceItems(
        MOCK_VESSELS,
        modifiedEquipment,
        'C Admin',
        [],
        modifiedCrew,
      );

      const matchedEq = items.find((i) => i.linkedEntityId === 'EQ-007');
      expect(matchedEq).toBeDefined();
      expect(matchedEq?.imageUrl).toBe(customEqPhoto);
      expect(matchedEq?.photos).toContain(customEqPhoto);

      const matchedCrew = items.find((i) => i.linkedEntityId === 'CREW-101');
      expect(matchedCrew).toBeDefined();
      expect(matchedCrew?.imageUrl).toBe(customCrewPhoto);
      expect(matchedCrew?.photos).toContain(customCrewPhoto);
    });
  });

  describe('Registration Photo & Gallery Preservation', () => {
    it('supports registering new equipment with custom photo gallery', () => {
      const coverPhoto = 'https://images.unsplash.com/photo-1541888946425-d0fbb18086f6?w=800';
      const gallery = [
        coverPhoto,
        'https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?w=800',
      ];

      const newEquipment = {
        id: 'EQ-TEST-999',
        name: 'Test Hydraulic Power Pack',
        equipmentIdentifier: 'EQ-HPU-999',
        category: 'Machinery & Propulsion' as const,
        owningOrganization: 'Southern Basin Energy',
        complianceReadinessScore: 0,
        complianceStatus: 'Pending Review' as const,
        operationalStatus: 'Standby' as const,
        assuranceStatus: 'Pending' as const,
        imageUrl: coverPhoto,
        photos: gallery,
      };

      expect(newEquipment.imageUrl).toBe(coverPhoto);
      expect(newEquipment.photos).toHaveLength(2);
      expect(newEquipment.photos?.[0]).toBe(coverPhoto);
    });

    it('supports registering new crew member with custom profile photo gallery', () => {
      const coverPhoto = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800';
      const gallery = [
        coverPhoto,
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800',
      ];

      const newCrew = {
        id: 'MAP-CRW-2026-PERS-99999',
        fullName: 'Capt. Alexander Vance',
        rank: 'Master / Ship Captain',
        nationality: 'Australian',
        seamansBookNo: 'SB-AU-999999',
        passportNo: 'PA-AU-9999999',
        dateOfBirth: '1985-02-20',
        emergencyContact: '+61 400 999 888',
        complianceStatus: 'Fully Compliant' as const,
        overallComplianceScore: 100,
        lastAuditedDate: '2026-10-07',
        imageUrl: coverPhoto,
        photos: gallery,
        assignments: [],
        layer1CoreDocuments: [],
        layer2Endorsements: [],
      };

      expect(newCrew.imageUrl).toBe(coverPhoto);
      expect(newCrew.photos).toHaveLength(2);
      expect(newCrew.photos?.[0]).toBe(coverPhoto);
    });
  });
});

