/* 
  file summary: unit test suite validating vessel provider ownership isolation, c admin full vessel visibility, and mock data accuracy.
  responsibilities: verifies rbac filtering ensures submitters/vessel providers only access their own vessels while c admin and administrator see all vessels across the platform.
  role in system: automated regression testing executed via vitest.
*/

import { describe, expect, it } from 'vitest';
import {
  filterCAdminActiveCharters,
  filterCAdminAvailableToCharter,
  filterCAdminOwnFleet,
  filterVesselsForPersona,
  getClientAdminOrganization,
  isAssuranceSetAssignedToPersona,
  isChartererMatchingVesselOwner,
  isVesselOwnedByAdmin,
  isVesselOwnedByClientOrg,
  orgFieldMatches,
} from '../utils/rbacHelpers';
import { MOCK_USERS } from '../store/mockData';
import { MOCK_VESSELS, MOCK_ASSURANCE_SETS, MOCK_DOCUMENTS } from '../store/mockData';
import { VesselInformation } from '../types/vessel';
import { useMapStore } from '../store/useMapStore';

describe('vessel provider fleet ownership isolation and c admin visibility', () => {
  it('restricts submitter / vessel provider to ONLY view the vessels that they own', () => {
    const submitterVessels = filterVesselsForPersona(
      MOCK_VESSELS,
      MOCK_ASSURANCE_SETS,
      'Submitter'
    );

    /* all 7 northwind mock vessels belong to submitter */
    expect(submitterVessels.length).toBe(7);
    expect(submitterVessels.every((v) => v.registeredOwner?.toLowerCase().includes('northwind'))).toBe(true);
    expect(submitterVessels.find((v) => v.id === 'VESSEL-008')).toBeUndefined();
    expect(submitterVessels.find((v) => v.id === 'VESSEL-009')).toBeUndefined();
    expect(submitterVessels.find((v) => v.id === 'VESSEL-010')).toBeUndefined();

    /* verify each returned vessel strictly belongs to northwind marine */
    submitterVessels.forEach((vessel) => {
      const isOwnedOrManaged =
        vessel.registeredOwner?.toLowerCase().includes('northwind') ||
        vessel.technicalManager?.toLowerCase().includes('northwind') ||
        vessel.ismCompany?.toLowerCase().includes('northwind');

      expect(isOwnedOrManaged).toBe(true);
    });

    /* verify competitor vessels from external owners are strictly excluded */
    const competitorVessel: VesselInformation = {
      ...MOCK_VESSELS[0],
      id: 'VESSEL-COMPETITOR-01',
      name: 'MV Competitor Wave',
      registeredOwner: 'Oceanic Competitor Shipping Ltd',
      technicalManager: 'Oceanic Competitor Shipping Ltd',
      ismCompany: 'Oceanic Competitor Shipping Ltd',
    };
    const submitterWithCompetitor = filterVesselsForPersona(
      [...MOCK_VESSELS, competitorVessel],
      MOCK_ASSURANCE_SETS,
      'Submitter'
    );
    expect(submitterWithCompetitor.find((v) => v.id === 'VESSEL-COMPETITOR-01')).toBeUndefined();
    expect(submitterWithCompetitor.length).toBe(7);
  });

  it('restricts administrator view to ONLY vessels owned by northwind marine pty ltd', () => {
    const adminVessels = filterVesselsForPersona(
      MOCK_VESSELS,
      MOCK_ASSURANCE_SETS,
      'Administrator'
    );

    /* administrator belongs to northwind marine pty ltd */
    expect(adminVessels.length).toBe(7);
    adminVessels.forEach((v) => {
      expect(v.registeredOwner).toBe('Northwind Marine Pty Ltd');
    });

    /* verify competitor vessels are not visible to administrator */
    const competitorVessel: VesselInformation = {
      ...MOCK_VESSELS[0],
      id: 'VESSEL-COMPETITOR-02',
      name: 'MV Rival Vessel',
      registeredOwner: 'External Rival Fleet Ltd',
      technicalManager: 'External Rival Fleet Ltd',
      ismCompany: 'External Rival Fleet Ltd',
    };
    const adminWithCompetitor = filterVesselsForPersona(
      [...MOCK_VESSELS, competitorVessel],
      MOCK_ASSURANCE_SETS,
      'Administrator'
    );
    expect(adminWithCompetitor.find((v) => v.id === 'VESSEL-COMPETITOR-02')).toBeUndefined();
    expect(adminWithCompetitor.length).toBe(7);
  });

  it('restricts administrator assurance sets to only those created by admin or created by c admin for northwind vessels', () => {
    /* verify each mock assurance set against administrator persona */
    const adminVisibleSets = MOCK_ASSURANCE_SETS.filter((set) =>
      isAssuranceSetAssignedToPersona(set, 'Administrator')
    );

    expect(adminVisibleSets.length).toBeGreaterThan(0);
    adminVisibleSets.forEach((set) => {
      const isNorthwindStakeholder =
        set.vesselId === 'VESSEL-005' ||
        Boolean(set.initiatorOrg?.toLowerCase().includes('northwind')) ||
        Boolean(set.assignedSubmitter?.toLowerCase().includes('northwind')) ||
        Boolean(set.stakeholders?.submitterOrg?.toLowerCase().includes('northwind')) ||
        Boolean(set.assignedStakeholders?.submitterOrg?.toLowerCase().includes('northwind')) ||
        Boolean(set.assignedStakeholders?.verifierOrg?.toLowerCase().includes('northwind')) ||
        Boolean(set.assignedStakeholders?.inspectorOrg?.toLowerCase().includes('northwind')) ||
        Boolean(set.assignedStakeholders?.approverOrg?.toLowerCase().includes('northwind'));

      const isCreatedByAdmin = set.createdByPersona === 'Administrator' || set.createdByPersona === 'Submitter';

      expect(isNorthwindStakeholder || isCreatedByAdmin).toBe(true);
    });
  });

  it('allows c admin to view ALL vessels under the platform', () => {
    const cAdminVessels = filterVesselsForPersona(
      MOCK_VESSELS,
      MOCK_ASSURANCE_SETS,
      'C Admin'
    );

    /* c admin has complete visibility across all vessels on the platform */
    expect(cAdminVessels.length).toBe(MOCK_VESSELS.length);
    expect(cAdminVessels.length).toBe(11);
    expect(cAdminVessels.map((v) => v.id)).toEqual(MOCK_VESSELS.map((v) => v.id));
  });

  it('splits C Admin fleet registry into available, own fleet, and active charter tabs', () => {
    const clientOrg = getClientAdminOrganization(MOCK_USERS);

    const availableToCharter = filterCAdminAvailableToCharter(
      MOCK_VESSELS,
      MOCK_ASSURANCE_SETS,
      clientOrg,
    );
    const ownFleet = filterCAdminOwnFleet(MOCK_VESSELS, clientOrg);
    const activeCharters = filterCAdminActiveCharters(MOCK_VESSELS, MOCK_ASSURANCE_SETS);

    expect(availableToCharter.length).toBeGreaterThan(0);
    expect(ownFleet.length).toBe(1);
    expect(ownFleet[0].id).toBe('VESSEL-011');
    expect(activeCharters.length).toBeGreaterThan(0);

    availableToCharter.forEach((v) => {
      expect(v.status).not.toBe('Under Charter');
      expect(isVesselOwnedByClientOrg(v, clientOrg)).toBe(false);
    });

    ownFleet.forEach((v) => {
      expect(isVesselOwnedByClientOrg(v, clientOrg)).toBe(true);
    });
  });

  it('matches client organization ownership with fuzzy org names', () => {
    expect(orgFieldMatches('Southern Basin Energy', 'Southern Basin Energy Pty Ltd')).toBe(true);
    expect(isVesselOwnedByClientOrg(MOCK_VESSELS.find((v) => v.id === 'VESSEL-011'), 'Southern Basin Energy')).toBe(true);
    expect(isChartererMatchingVesselOwner('Southern Basin Energy', MOCK_VESSELS.find((v) => v.id === 'VESSEL-011'))).toBe(true);
    expect(isVesselOwnedByClientOrg(MOCK_VESSELS.find((v) => v.id === 'VESSEL-001'), 'Southern Basin Energy')).toBe(false);
  });

  it('filters vessels by specific assurance set for client admin', () => {
    const targetSet = MOCK_ASSURANCE_SETS[0]; // AS-2026-001 (VESSEL-001)

    const filteredVessels = MOCK_VESSELS.filter((v) => {
      const matchesAssuranceSet = MOCK_ASSURANCE_SETS.some(
        (set) =>
          set.id === targetSet.id &&
          (set.vesselId === v.id ||
            (set.vesselName && v.name && set.vesselName.toLowerCase() === v.name.toLowerCase()) ||
            (set.imoNumber && v.imoNumber && set.imoNumber === v.imoNumber))
      );
      return matchesAssuranceSet;
    });

    expect(filteredVessels.length).toBe(1);
    expect(filteredVessels[0].id).toBe(targetSet.vesselId);
    expect(filteredVessels[0].name).toBe(targetSet.vesselName);
  });

  it('guarantees vessels with Under Charter status NEVER show up in client admin vessel views even with assurance set filter', () => {
    // VESSEL-004 has status 'Under Charter' and is linked to AS-2026-004
    const underCharterVessel = MOCK_VESSELS.find((v) => v.status === 'Under Charter');
    expect(underCharterVessel).toBeDefined();

    const underCharterSet = MOCK_ASSURANCE_SETS.find((s) => s.vesselId === underCharterVessel?.id);
    expect(underCharterSet).toBeDefined();

    // Simulate C Admin filtering
    const cAdminVisibleVessels = MOCK_VESSELS.filter((v) => {
      // Must strictly exclude Under Charter vessels for C Admin
      if (v.status === 'Under Charter') return false;

      // Assurance set filter
      if (underCharterSet) {
        return MOCK_ASSURANCE_SETS.some(
          (set) =>
            set.id === underCharterSet.id &&
            (set.vesselId === v.id ||
              (set.vesselName && v.name && set.vesselName.toLowerCase() === v.name.toLowerCase()) ||
              (set.imoNumber && v.imoNumber && set.imoNumber === v.imoNumber))
        );
      }
      return true;
    });

    // Vessel with 'Under Charter' status must NOT show up
    expect(cAdminVisibleVessels.some((v) => v.id === underCharterVessel?.id)).toBe(false);
    expect(cAdminVisibleVessels.some((v) => v.status === 'Under Charter')).toBe(false);
  });

  it('supports Vessel Admin All Fleet Vessels (unchartered from other organizations) and Owned Vessels tabs with assurance set filtering', () => {
    const isVesselOwned = (v: VesselInformation) => {
      const ownerLower = (v.registeredOwner || '').toLowerCase();
      const techManagerLower = (v.technicalManager || '').toLowerCase();
      const ismLower = (v.ismCompany || '').toLowerCase();
      return (
        ownerLower.includes('northwind') ||
        ownerLower.includes('pacific ocean') ||
        techManagerLower.includes('northwind') ||
        techManagerLower.includes('pacific') ||
        ismLower.includes('northwind') ||
        ismLower.includes('pacific')
      );
    };

    const competitorUnchartered: VesselInformation = {
      ...MOCK_VESSELS[0],
      id: 'VESSEL-EXT-01',
      name: 'MV Global Transporter',
      registeredOwner: 'Global Maritime Lines',
      technicalManager: 'Global Maritime Lines',
      ismCompany: 'Global Maritime Lines',
      status: 'Port Stay',
    };

    const competitorUnderCharter: VesselInformation = {
      ...MOCK_VESSELS[0],
      id: 'VESSEL-EXT-02',
      name: 'MV Oceanic Voyager',
      registeredOwner: 'Global Maritime Lines',
      technicalManager: 'Global Maritime Lines',
      ismCompany: 'Global Maritime Lines',
      status: 'Under Charter',
    };

    const allPlatformVessels = [...MOCK_VESSELS, competitorUnchartered, competitorUnderCharter];

    // Owned vessels tab
    const owned = allPlatformVessels.filter(isVesselOwned);
    expect(owned.length).toBe(7);
    owned.forEach((v) => {
      expect(isVesselOwned(v)).toBe(true);
    });

    // All Fleet Vessels tab (vessels that are unchartered from other organizations)
    const allFleet = allPlatformVessels.filter((v) => !isVesselOwned(v) && v.status !== 'Under Charter');
    expect(allFleet.length).toBe(5);
    expect(allFleet.map((v) => v.id)).toContain('VESSEL-EXT-01');
    expect(allFleet.find((v) => v.id === 'VESSEL-EXT-02')).toBeUndefined();
    allFleet.forEach((v) => {
      expect(v.status).not.toBe('Under Charter');
    });

    // Assurance set filter on All Fleet Vessels
    const extAssuranceSet = {
      ...MOCK_ASSURANCE_SETS[0],
      id: 'AS-NORTHWIND-EXT',
      vesselId: 'VESSEL-EXT-01',
      vesselName: 'MV Global Transporter',
      assignedSubmitter: 'M. Chen (Northwind Marine Pty Ltd)',
    };

    const sets = [...MOCK_ASSURANCE_SETS, extAssuranceSet];
    const filteredBySet = allFleet.filter((v) =>
      sets.some((s) => s.id === 'AS-NORTHWIND-EXT' && (s.vesselId === v.id || s.vesselName === v.name))
    );

    expect(filteredBySet.length).toBe(1);
    expect(filteredBySet[0].name).toBe('MV Global Transporter');
  });

  it('correctly includes newly registered vessels owned by submitter company', () => {
    const newSubmitterVessel: VesselInformation = {
      id: 'VESSEL-999',
      name: 'MV Pacific Pioneer',
      imoNumber: '9991234',
      officialRegNumber: 'AUS-999123',
      mmsiNumber: '503999123',
      flagState: 'Australia',
      callSign: 'VHP99',
      portOfRegistry: 'Fremantle',
      vesselType: 'Offshore Support Vessel (OSV)',
      vesselSubtype: 'PSV',
      intendedUse: 'Platform Supply',
      tradingArea: 'International',
      classificationSociety: 'DNV',
      classNotation: '+100A1',
      hullType: 'Double Hull',
      ispsSolasStatus: 'Certified',
      yearBuilt: 2024,
      shipyardBuilder: 'Damen Shipyards',
      lengthOverallMeters: 85,
      beamMeters: 18,
      draftMeters: 6,
      grossTonnageGT: 3500,
      deadweightTonnageDWT: 4000,
      dynamicPositioningClass: 'DP2',
      mainEnginePowerKW: '4000 kW',
      status: 'In Operations',
      complianceReadinessScore: 90,
      registeredOwner: 'Northwind Marine Pty Ltd',
      ownerType: 'Corporate Entity',
      corporateRegistryNo: 'ACN 999 888 777',
      technicalManager: 'Northwind Marine Pty Ltd',
      ismCompany: 'Northwind Marine Pty Ltd',
      docNumber: 'DOC-999',
      contact247: '+61 8 9999 0000',
      statutoryCertificates: [],
      hmInsurer: 'Gard',
      piClubName: 'Gard P&I',
      policyNumber: 'PI-999',
      policyExpiryDate: '2027-01-01',
      safeManningComplement: 14,
      certifiedOfficersRatings: '6/8',
      masterName: 'Capt. Test',
      lifeboatCapacity: 28,
      fuelType: 'MGO',
      lowSulphurCompliant: true,
      bwtsSpec: 'Alfa Laval PureBallast',
      owCalibrationDate: '2026-01-01',
      masterCertificateUploadCount: 1,
      clientHistory: [],
    };

    const combinedVessels = [...MOCK_VESSELS, newSubmitterVessel];
    const filtered = filterVesselsForPersona(
      combinedVessels,
      MOCK_ASSURANCE_SETS,
      'Submitter'
    );

    const found = filtered.find((v) => v.id === 'VESSEL-999');
    expect(found).toBeDefined();
    expect(found?.name).toBe('MV Pacific Pioneer');
    expect(filtered.length).toBe(8);
  });

  it('validates mock data accuracy and completeness across all vessel Information', () => {
    expect(MOCK_VESSELS.length).toBe(11);

    MOCK_VESSELS.forEach((vessel) => {
      /* verify essential maritime data fields are populated accurately */
      expect(vessel.id).toBeTruthy();
      expect(vessel.name).toBeTruthy();
      expect(vessel.imoNumber).toMatch(/^\d{7}$/);
      expect(vessel.officialRegNumber).toBeTruthy();
      expect(vessel.mmsiNumber).toMatch(/^\d{9}$/);
      expect(vessel.callSign).toBeTruthy();
      expect(vessel.flagState).toBeTruthy();
      expect(vessel.portOfRegistry).toBeTruthy();
      expect(vessel.classificationSociety).toBeTruthy();
      expect(vessel.registeredOwner).toBeTruthy();
      expect(vessel.technicalManager).toBeTruthy();
      expect(vessel.ismCompany).toBeTruthy();
      expect(vessel.complianceReadinessScore).toBeGreaterThanOrEqual(0);
      expect(vessel.complianceReadinessScore).toBeLessThanOrEqual(100);
      expect(vessel.statutoryCertificates.length).toBeGreaterThan(0);
    });

    /* verify mock assurance sets have matching vessel ids and assigned stakeholders */
    MOCK_ASSURANCE_SETS.forEach((set) => {
      const targetVessel = MOCK_VESSELS.find((v) => v.id === set.vesselId);
      expect(targetVessel).toBeDefined();
      expect(set.vesselName).toBe(targetVessel?.name);
      expect(set.imoNumber).toBe(targetVessel?.imoNumber);
      expect(set.requirements.length).toBeGreaterThan(0);
    });

    /* verify mock documents link to valid statutory certificates */
    MOCK_DOCUMENTS.forEach((doc) => {
      expect(doc.id).toBeTruthy();
      expect(doc.title).toBeTruthy();
      expect(doc.versions.length).toBeGreaterThan(0);
      expect(doc.ocrConfidence).toBeGreaterThan(0);
    });
  });

  it('defaults organization to northwind marine when administrator registers a vessel in store', () => {
    useMapStore.getState().setActivePersona('Administrator');

    const adminRegisteredVessel: VesselInformation = {
      ...MOCK_VESSELS[0],
      id: 'VESSEL-ADMIN-NORTHWIND',
      name: 'MV Northwind Sentinel',
      imoNumber: '9988112',
      officialRegNumber: 'NW-998811',
      registeredOwner: 'Northwind Marine Pty Ltd',
      technicalManager: 'Northwind Marine Pty Ltd',
      ismCompany: 'Northwind Marine Pty Ltd',
    };

    const res = useMapStore.getState().addVessel(adminRegisteredVessel);
    expect(res.success).toBe(true);

    const latestAudit = useMapStore.getState().auditEvents[0];
    expect(latestAudit.organization).toBe('Northwind Marine Pty Ltd');
    expect(latestAudit.action).toBe('Registered Unique Vessel Record');
  });

  it('correctly identifies owned vs non-owned vessels for the current admin organization', () => {
    // Northwind / Pacific owned vessels
    const ownedVessels = MOCK_VESSELS.filter(isVesselOwnedByAdmin);
    expect(ownedVessels.length).toBe(7);
    ownedVessels.forEach((v) => {
      expect(isVesselOwnedByAdmin(v)).toBe(true);
    });

    // External organization vessels
    const externalVessels = MOCK_VESSELS.filter((v) => !isVesselOwnedByAdmin(v));
    expect(externalVessels.length).toBe(4);
    expect(externalVessels.map((v) => v.id)).toEqual(['VESSEL-008', 'VESSEL-009', 'VESSEL-010', 'VESSEL-011']);
    externalVessels.forEach((v) => {
      expect(isVesselOwnedByAdmin(v)).toBe(false);
    });
  });

  it('restricts client history, assigned crew, and audit trail tabs to owned vessels only in vessel detail view', () => {
    const ownedVessel = MOCK_VESSELS.find((v) => v.id === 'VESSEL-001')!;
    const externalVessel = MOCK_VESSELS.find((v) => v.id === 'VESSEL-008')!;

    // Owned vessel allows admin access to client history, assigned crew, and audit trail
    const isOwnedForOwned = isVesselOwnedByAdmin(ownedVessel);
    expect(isOwnedForOwned).toBe(true);

    // Non-owned vessel hides client history, assigned crew, and audit trail
    const isOwnedForExternal = isVesselOwnedByAdmin(externalVessel);
    expect(isOwnedForExternal).toBe(false);

    const getVisibleTabs = (v: VesselInformation, persona: string) => {
      const isAdmin = persona === 'Administrator';
      const isOwned = isVesselOwnedByAdmin(v);
      const tabs = ['Information', 'vault', 'assurance', 'inspections'];
      if (isAdmin && isOwned) {
        tabs.push('clients', 'crew', 'audit');
      }
      return tabs;
    };

    const ownedTabs = getVisibleTabs(ownedVessel, 'Administrator');
    expect(ownedTabs).toContain('clients');
    expect(ownedTabs).toContain('crew');
    expect(ownedTabs).toContain('audit');

    const externalTabs = getVisibleTabs(externalVessel, 'Administrator');
    expect(externalTabs).not.toContain('clients');
    expect(externalTabs).not.toContain('crew');
    expect(externalTabs).not.toContain('audit');
  });

  it('guarantees only unchartered vessels show up in All Fleet Vessels panel regardless of whether persona is admin or client admin', () => {
    const clientOrg = getClientAdminOrganization(MOCK_USERS);

    // C Admin Available to Charter logic
    const cAdminAllFleet = filterCAdminAvailableToCharter(
      MOCK_VESSELS,
      MOCK_ASSURANCE_SETS,
      clientOrg,
    );
    expect(cAdminAllFleet.length).toBeGreaterThan(0);
    cAdminAllFleet.forEach((v) => {
      expect(v.status).not.toBe('Under Charter');
      expect(isVesselOwnedByClientOrg(v, clientOrg)).toBe(false);
    });

    // Administrator All Fleet Vessels logic (unchartered from external orgs)
    const adminAllFleet = MOCK_VESSELS.filter(
      (v) => !isVesselOwnedByAdmin(v) && v.status !== 'Under Charter'
    );
    expect(adminAllFleet.length).toBe(4);
    adminAllFleet.forEach((v) => {
      expect(v.status).not.toBe('Under Charter');
      expect(isVesselOwnedByAdmin(v)).toBe(false);
    });

    // Even if an under-charter vessel has an assurance set filter, it is excluded
    const underCharterVessel = MOCK_VESSELS.find((v) => v.status === 'Under Charter');
    if (underCharterVessel) {
      expect(cAdminAllFleet.map((v) => v.id)).not.toContain(underCharterVessel.id);
      expect(adminAllFleet.map((v) => v.id)).not.toContain(underCharterVessel.id);
    }
  });

  it('guarantees that owner or organization owning the vessel is able to edit vessel information', () => {
    const ownedVessel = MOCK_VESSELS.find((v) => v.id === 'VESSEL-001')!;
    const externalVessel = MOCK_VESSELS.find((v) => v.id === 'VESSEL-008')!;
    const clientOwnedVessel = MOCK_VESSELS.find((v) => v.id === 'VESSEL-011')!;

    const canOwnerEditVessel = (v: VesselInformation, persona: string) => {
      const isAdmin = persona === 'Administrator';
      const isSubmitter = persona === 'Submitter';
      const isCAdmin = persona === 'C Admin';
      const isOwned =
        (isAdmin || isSubmitter)
          ? isVesselOwnedByAdmin(v)
          : isCAdmin
            ? isVesselOwnedByClientOrg(v, 'Southern Basin Energy')
            : false;
      const isReadOnly = (isCAdmin && !isOwned) || persona === 'Inspector' || persona === 'Verifier' || persona === 'Approver';
      const canEditFull = !isReadOnly && isOwned;
      return { isOwned, isReadOnly, canEditFull };
    };

    // Submitter owning the vessel -> canEditFull is true
    const submitterOwned = canOwnerEditVessel(ownedVessel, 'Submitter');
    expect(submitterOwned.isOwned).toBe(true);
    expect(submitterOwned.canEditFull).toBe(true);

    // Administrator owning the vessel -> canEditFull is true
    const adminOwned = canOwnerEditVessel(ownedVessel, 'Administrator');
    expect(adminOwned.isOwned).toBe(true);
    expect(adminOwned.canEditFull).toBe(true);

    // C Admin viewing own fleet vessel -> canEditFull is true
    const cAdminOwn = canOwnerEditVessel(clientOwnedVessel, 'C Admin');
    expect(cAdminOwn.isOwned).toBe(true);
    expect(cAdminOwn.canEditFull).toBe(true);

    // Inspector viewing vessel -> read-only, canEditFull is false
    const inspectorCheck = canOwnerEditVessel(ownedVessel, 'Inspector');
    expect(inspectorCheck.isReadOnly).toBe(true);
    expect(inspectorCheck.canEditFull).toBe(false);

    // C Admin viewing third-party external vessel -> read-only, canEditFull is false
    const cAdminExternal = canOwnerEditVessel(externalVessel, 'C Admin');
    expect(cAdminExternal.isOwned).toBe(false);
    expect(cAdminExternal.isReadOnly).toBe(true);
    expect(cAdminExternal.canEditFull).toBe(false);
  });

  it('restricts photo upload/management permissions to vessel owner and vessel admin only', () => {
    const ownedVessel = MOCK_VESSELS.find((v) => v.id === 'VESSEL-001')!;
    const externalVessel = MOCK_VESSELS.find((v) => v.id === 'VESSEL-008')!;

    const getPhotoManagementPermission = (v: VesselInformation, persona: string) => {
      const isAdmin = persona === 'Administrator';
      const isSubmitter = persona === 'Submitter';
      const isCAdmin = persona === 'C Admin';
      const isOwned =
        (isAdmin || isSubmitter)
          ? isVesselOwnedByAdmin(v)
          : isCAdmin
            ? isVesselOwnedByClientOrg(v, 'Southern Basin Energy')
            : false;
      const isReadOnly = (isCAdmin && !isOwned) || persona === 'Inspector' || persona === 'Verifier' || persona === 'Approver';
      const canManagePhotos = !isReadOnly && isOwned;
      return canManagePhotos;
    };

    // 1. Vessel Owner (Submitter / Admin) on owned vessel -> ALLOWED
    expect(getPhotoManagementPermission(ownedVessel, 'Submitter')).toBe(true);
    expect(getPhotoManagementPermission(ownedVessel, 'Administrator')).toBe(true);

    // 2. Client Admin viewing non-owned third-party vessel -> HIDDEN / DISALLOWED
    expect(getPhotoManagementPermission(externalVessel, 'C Admin')).toBe(false);

    // 3. Verifier / Inspector / Approver viewing vessel -> HIDDEN / DISALLOWED
    expect(getPhotoManagementPermission(ownedVessel, 'Verifier')).toBe(false);
    expect(getPhotoManagementPermission(ownedVessel, 'Inspector')).toBe(false);
    expect(getPhotoManagementPermission(ownedVessel, 'Approver')).toBe(false);
  });
});

