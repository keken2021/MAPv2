import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { VerifierWorkspaceView } from '../views/VerifierWorkspaceView';
import { InspectorWorkspaceView } from '../views/InspectorWorkspaceView';
import { useMapStore } from '../store/useMapStore';
import { AssuranceSet } from '../types/assurance';
import { MasterDocument } from '../types/document';
import { VesselInformation } from '../types/vessel';

describe('Verifier & Inspector Workspaces UI Declutter', () => {
  const mockAssuranceSets: AssuranceSet[] = [
    {
      id: 'AS-VERIF-01',
      title: 'Active Verification Set 1',
      vesselId: 'VESSEL-01',
      vesselName: 'Pacific Horn',
      imoNumber: '9234567',
      initiatorOrg: 'Oceanic Logistics',
      initiatorRole: 'Vessel Provider',
      charterWindowStart: '2026-11-01',
      charterWindowEnd: '2026-12-01',
      complianceDeadline: '2026-11-15',
      stage: 'Verification',
      approverDecision: 'Pending',
      verificationRequired: true,
      requirements: [
        {
          id: 'REQ-DOC-01',
          category: 'Statutory Certificate',
          title: 'Safety Management Certificate',
          documentId: 'DOC-PENDING-01',
          isMandatory: true,
          isFulfilled: false,
          verifierStatus: 'Pending',
          ocrConfidence: 95,
          targetDate: '2026-11-12',
        },
        {
          id: 'REQ-DOC-02',
          category: 'Statutory Certificate',
          title: 'Class Certificate',
          documentId: 'DOC-VERIFIED-01',
          isMandatory: true,
          isFulfilled: true,
          verifierStatus: 'Verified',
          ocrConfidence: 98,
          targetDate: '2026-11-12',
        },
      ],
      assignedVerifier: 'A. Fontaine',
      assignedInspector: 'N. Technical',
      readinessScore: 75,
      mandatoryInspectionRequired: true,
      inspectionCompleted: false,
    },
    {
      id: 'AS-OVERDUE-01',
      title: 'Overdue Verification Set',
      vesselId: 'VESSEL-02',
      vesselName: 'Atlantic Wave',
      imoNumber: '9234568',
      initiatorOrg: 'Maritime Corp',
      initiatorRole: 'Vessel Provider',
      charterWindowStart: '2026-10-01',
      charterWindowEnd: '2026-11-01',
      complianceDeadline: '2026-10-15', // overdue relative to current date (Oct 29, 2026)
      stage: 'Verification',
      approverDecision: 'Pending',
      verificationRequired: true,
      requirements: [
        {
          id: 'REQ-DOC-03',
          category: 'Statutory Certificate',
          title: 'Document of Compliance',
          documentId: 'DOC-OVERDUE-01',
          isMandatory: true,
          isFulfilled: false,
          verifierStatus: 'Pending',
          ocrConfidence: 92,
          targetDate: '2026-10-14',
        },
      ],
      assignedVerifier: 'A. Fontaine',
      assignedInspector: 'N. Technical',
      readinessScore: 60,
      mandatoryInspectionRequired: true,
      inspectionCompleted: false,
    },
    {
      id: 'AS-CORRECTION-01',
      title: 'Returned Set',
      vesselId: 'VESSEL-03',
      vesselName: 'Nordic Star',
      imoNumber: '9234569',
      initiatorOrg: 'Global Shipping',
      initiatorRole: 'Vessel Provider',
      charterWindowStart: '2026-11-01',
      charterWindowEnd: '2026-12-01',
      complianceDeadline: '2026-11-20',
      stage: 'Verification',
      approverDecision: 'Pending',
      verificationRequired: true,
      requirements: [
        {
          id: 'REQ-DOC-04',
          category: 'Statutory Certificate',
          title: 'Load Line Certificate',
          documentId: 'DOC-CORRECTION-01',
          isMandatory: true,
          isFulfilled: false,
          verifierStatus: 'Correction Requested',
          ocrConfidence: 90,
          targetDate: '2026-11-18',
        },
      ],
      assignedVerifier: 'A. Fontaine',
      assignedInspector: 'N. Technical',
      readinessScore: 50,
      mandatoryInspectionRequired: true,
      inspectionCompleted: true,
    },
    {
      id: 'AS-CERTIFIED-01',
      title: 'Completed Inspection Set',
      vesselId: 'VESSEL-04',
      vesselName: 'Southern Cross',
      imoNumber: '9234570',
      initiatorOrg: 'Pacific Marine',
      initiatorRole: 'Vessel Provider',
      charterWindowStart: '2026-09-01',
      charterWindowEnd: '2026-10-01',
      complianceDeadline: '2026-09-15',
      stage: 'Certified',
      approverDecision: 'Approved',
      verificationRequired: true,
      requirements: [],
      assignedVerifier: 'A. Fontaine',
      assignedInspector: 'N. Technical',
      readinessScore: 100,
      mandatoryInspectionRequired: true,
      inspectionCompleted: true,
    },
    {
      id: 'AS-OTHER-01',
      title: 'Another Person Set',
      vesselId: 'VESSEL-05',
      vesselName: 'Shaw Vessel',
      imoNumber: '9234571',
      initiatorOrg: 'Other Org',
      initiatorRole: 'Vessel Provider',
      charterWindowStart: '2026-11-01',
      charterWindowEnd: '2026-12-01',
      complianceDeadline: '2026-11-20',
      stage: 'Verification',
      approverDecision: 'Pending',
      verificationRequired: true,
      requirements: [
        {
          id: 'REQ-DOC-05',
          category: 'Statutory Certificate',
          title: 'Other Person Certificate',
          documentId: 'DOC-OTHER-01',
          isMandatory: true,
          isFulfilled: false,
          verifierStatus: 'Pending',
          ocrConfidence: 90,
          targetDate: '2026-11-18',
        },
      ],
      assignedVerifier: 'D. Harrison',
      assignedInspector: 'Capt. Robert Shaw',
      readinessScore: 40,
      mandatoryInspectionRequired: true,
      inspectionCompleted: false,
    },
  ];

  const mockDocuments: MasterDocument[] = [
    {
      id: 'DOC-PENDING-01',
      title: 'Safety Management Certificate',
      entityType: 'Vessel Certificate',
      vesselId: 'VESSEL-01',
      certificateNo: 'SMC-2026-001',
      issuingAuthority: 'DNV',
      expiryDate: '2027-01-01',
      verificationStatus: 'Pending',
      ocrConfidence: 95,
      complianceState: 'Valid',
      currentVersion: 'v1.0',
      versions: [],
      validationRules: { charterBufferPassed: true, assetMatch100Percent: true, iacsAuthorityValid: true, overallValid: true },
    },
    {
      id: 'DOC-VERIFIED-01',
      title: 'Class Certificate',
      entityType: 'Vessel Certificate',
      vesselId: 'VESSEL-01',
      certificateNo: 'CLS-2026-002',
      issuingAuthority: 'DNV',
      expiryDate: '2027-06-01',
      verificationStatus: 'Verified',
      ocrConfidence: 98,
      complianceState: 'Valid',
      currentVersion: 'v1.0',
      versions: [],
      validationRules: { charterBufferPassed: true, assetMatch100Percent: true, iacsAuthorityValid: true, overallValid: true },
    },
    {
      id: 'DOC-OVERDUE-01',
      title: 'Document of Compliance',
      entityType: 'Vessel Certificate',
      vesselId: 'VESSEL-02',
      certificateNo: 'DOC-2026-003',
      issuingAuthority: 'ABS',
      expiryDate: '2027-02-01',
      verificationStatus: 'Pending',
      ocrConfidence: 92,
      complianceState: 'Valid',
      currentVersion: 'v1.0',
      versions: [],
      validationRules: { charterBufferPassed: true, assetMatch100Percent: true, iacsAuthorityValid: true, overallValid: true },
    },
    {
      id: 'DOC-CORRECTION-01',
      title: 'Load Line Certificate',
      entityType: 'Vessel Certificate',
      vesselId: 'VESSEL-03',
      certificateNo: 'LLC-2026-004',
      issuingAuthority: 'Lloyds',
      expiryDate: '2027-03-01',
      verificationStatus: 'Correction Requested',
      ocrConfidence: 90,
      complianceState: 'Valid',
      currentVersion: 'v1.0',
      versions: [],
      validationRules: { charterBufferPassed: true, assetMatch100Percent: true, iacsAuthorityValid: true, overallValid: true },
    },
    {
      id: 'DOC-OTHER-01',
      title: 'Other Person Certificate',
      entityType: 'Vessel Certificate',
      vesselId: 'VESSEL-05',
      certificateNo: 'OTH-2026-005',
      issuingAuthority: 'DNV',
      expiryDate: '2027-04-01',
      verificationStatus: 'Pending',
      ocrConfidence: 90,
      complianceState: 'Valid',
      currentVersion: 'v1.0',
      versions: [],
      validationRules: { charterBufferPassed: true, assetMatch100Percent: true, iacsAuthorityValid: true, overallValid: true },
    },
  ];

  const mockVessels: VesselInformation[] = [
    {
      id: 'VESSEL-01',
      name: 'Pacific Horn',
      imoNumber: '9234567',
      vesselType: 'Anchor Handling Tug',
      classificationSociety: 'DNV',
      dynamicPositioningClass: 'DP2',
      flagState: 'Singapore',
      portOfRegistry: 'Singapore',
      yearBuilt: 2020,
      grossTonnageGT: 3500,
      deadweightTonnageDWT: 4200,
      officialRegNumber: 'SG-12345',
      status: 'Active',
    } as unknown as VesselInformation,
    {
      id: 'VESSEL-02',
      name: 'Atlantic Wave',
      imoNumber: '9234568',
      vesselType: 'Platform Supply Vessel',
      classificationSociety: 'ABS',
      dynamicPositioningClass: 'DP2',
      flagState: 'Liberia',
      portOfRegistry: 'Monrovia',
      yearBuilt: 2019,
      grossTonnageGT: 4000,
      deadweightTonnageDWT: 4800,
      officialRegNumber: 'LR-54321',
      status: 'In Operations',
    } as unknown as VesselInformation,
    {
      id: 'VESSEL-03',
      name: 'Nordic Star',
      imoNumber: '9234569',
      vesselType: 'Crew Boat',
      classificationSociety: 'Lloyds',
      dynamicPositioningClass: 'DP1',
      flagState: 'Marshall Islands',
      portOfRegistry: 'Majuro',
      yearBuilt: 2021,
      grossTonnageGT: 1200,
      deadweightTonnageDWT: 1500,
      officialRegNumber: 'MI-98765',
      status: 'Standby',
    } as unknown as VesselInformation,
    {
      id: 'VESSEL-04',
      name: 'Southern Cross',
      imoNumber: '9234570',
      vesselType: 'Anchor Handling Tug',
      classificationSociety: 'DNV',
      dynamicPositioningClass: 'DP2',
      flagState: 'Panama',
      portOfRegistry: 'Panama City',
      yearBuilt: 2018,
      grossTonnageGT: 3600,
      deadweightTonnageDWT: 4300,
      officialRegNumber: 'PA-11223',
      status: 'Mobilization Ready',
    } as unknown as VesselInformation,
    {
      id: 'VESSEL-05',
      name: 'Shaw Vessel',
      imoNumber: '9234571',
      vesselType: 'Anchor Handling Tug',
      classificationSociety: 'DNV',
      dynamicPositioningClass: 'DP2',
      flagState: 'Panama',
      portOfRegistry: 'Panama City',
      yearBuilt: 2019,
      grossTonnageGT: 3000,
      deadweightTonnageDWT: 3600,
      officialRegNumber: 'PA-55667',
      status: 'Active',
    } as unknown as VesselInformation,
  ];

  beforeEach(() => {
    useMapStore.setState({
      activePersona: 'Verifier',
      activeDemoOrganization: '',
      currentEntityId: undefined,
      assuranceSets: mockAssuranceSets,
      documents: mockDocuments,
      vessels: mockVessels,
    });
  });

  describe('VerifierWorkspaceView', () => {
    it('defaults to To Verify tab with 5 CountTabs', () => {
      render(<VerifierWorkspaceView />);

      const tablist = screen.getByRole('tablist', { name: /verifier queue tabs/i });
      expect(tablist).toBeInTheDocument();

      const tabs = within(tablist).getAllByRole('tab');
      expect(tabs).toHaveLength(5);

      const toVerifyTab = within(tablist).getByRole('tab', { name: /to verify/i });
      expect(toVerifyTab).toHaveClass('is-active');
      expect(toVerifyTab).toHaveAttribute('aria-selected', 'true');

      const overdueTab = within(tablist).getByRole('tab', { name: /overdue/i });
      expect(overdueTab.querySelector('.is-warn')).not.toBeNull();
    });

    it('ensures tab counts equal filtered list lengths for all tabs', () => {
      render(<VerifierWorkspaceView />);

      const tablist = screen.getByRole('tablist', { name: /verifier queue tabs/i });

      // 1. To Verify tab (default): DOC-PENDING-01 and DOC-OVERDUE-01 (count = 2)
      const toVerifyTab = within(tablist).getByRole('tab', { name: /to verify/i });
      expect(toVerifyTab.textContent).toContain('(2)');
      let rows = screen.getAllByRole('row').slice(1);
      expect(rows).toHaveLength(2);

      // 2. Overdue tab: DOC-OVERDUE-01 (count = 1)
      const overdueTab = within(tablist).getByRole('tab', { name: /overdue/i });
      expect(overdueTab.textContent).toContain('(1)');
      fireEvent.click(overdueTab);
      rows = screen.getAllByRole('row').slice(1);
      expect(rows).toHaveLength(1);
      expect(screen.getByText('Document of Compliance')).toBeInTheDocument();

      // 3. Verified tab: DOC-VERIFIED-01 (count = 1)
      const verifiedTab = within(tablist).getByRole('tab', { name: /verified/i });
      expect(verifiedTab.textContent).toContain('(1)');
      fireEvent.click(verifiedTab);
      rows = screen.getAllByRole('row').slice(1);
      expect(rows).toHaveLength(1);
      expect(screen.getByText('Class Certificate')).toBeInTheDocument();

      // 4. Returned tab: DOC-CORRECTION-01 (count = 1)
      const returnedTab = within(tablist).getByRole('tab', { name: /returned/i });
      expect(returnedTab.textContent).toContain('(1)');
      fireEvent.click(returnedTab);
      rows = screen.getAllByRole('row').slice(1);
      expect(rows).toHaveLength(1);
      expect(screen.getByText('Load Line Certificate')).toBeInTheDocument();

      // 5. All tab: the session verifier's 4 docs; the other person's document stays out
      const allTab = within(tablist).getByRole('tab', { name: /all/i });
      expect(allTab.textContent).toContain('(4)');
      fireEvent.click(allTab);
      rows = screen.getAllByRole('row').slice(1);
      expect(rows).toHaveLength(4);
      expect(screen.queryByText('Other Person Certificate')).toBeNull();
    });

    it('displays Due column with lateness in red text for overdue items', () => {
      render(<VerifierWorkspaceView />);

      const tablist = screen.getByRole('tablist', { name: /verifier queue tabs/i });
      fireEvent.click(within(tablist).getByRole('tab', { name: /overdue/i }));

      const dueCell = screen.getByText(/late/i);
      expect(dueCell).toHaveClass('text-danger');
      expect(dueCell.textContent).toMatch(/\d+ days late/);
    });

    it('enforces at most 1 badge per row (only status) and 1 View action per row', () => {
      render(<VerifierWorkspaceView />);

      const tablist = screen.getByRole('tablist', { name: /verifier queue tabs/i });
      fireEvent.click(within(tablist).getByRole('tab', { name: /all/i }));

      const rows = screen.getAllByRole('row').slice(1);
      rows.forEach((row) => {
        // At most 1 badge in the entire row
        const badges = row.querySelectorAll('.badge');
        expect(badges.length).toBeLessThanOrEqual(1);

        // Exactly 1 action button
        const actionButtons = row.querySelectorAll('td:last-child button');
        expect(actionButtons).toHaveLength(1);
        expect(actionButtons[0]).toHaveAttribute('title', 'View');
      });
    });
  });

  describe('InspectorWorkspaceView', () => {
    beforeEach(() => {
      useMapStore.setState({
        activePersona: 'Inspector',
      });
    });

    it('removes all 4 KPI cards so nothing sits between title and table card', () => {
      const { container } = render(<InspectorWorkspaceView />);
      expect(container.querySelector('.map-kpi-card')).toBeNull();
      expect(container.querySelector('.row.g-3')).toBeNull();
    });

    it('defaults to To Inspect tab with 4 CountTabs', () => {
      render(<InspectorWorkspaceView />);

      const tablist = screen.getByRole('tablist', { name: /inspector queue tabs/i });
      expect(tablist).toBeInTheDocument();

      const tabs = within(tablist).getAllByRole('tab');
      expect(tabs).toHaveLength(4);

      const toInspectTab = within(tablist).getByRole('tab', { name: /to inspect/i });
      expect(toInspectTab).toHaveClass('is-active');
      expect(toInspectTab).toHaveAttribute('aria-selected', 'true');

      const overdueTab = within(tablist).getByRole('tab', { name: /overdue/i });
      expect(overdueTab.querySelector('.is-warn')).not.toBeNull();
    });

    it('ensures tab counts equal filtered list lengths for all tabs', () => {
      render(<InspectorWorkspaceView />);

      const tablist = screen.getByRole('tablist', { name: /inspector queue tabs/i });

      // 1. To Inspect tab (default): VESSEL-01 and VESSEL-02 (count = 2)
      const toInspectTab = within(tablist).getByRole('tab', { name: /to inspect/i });
      expect(toInspectTab.textContent).toContain('(2)');
      let rows = screen.getAllByRole('row').slice(1);
      expect(rows).toHaveLength(2);

      // 2. Overdue tab: VESSEL-02 (count = 1)
      const overdueTab = within(tablist).getByRole('tab', { name: /overdue/i });
      expect(overdueTab.textContent).toContain('(1)');
      fireEvent.click(overdueTab);
      rows = screen.getAllByRole('row').slice(1);
      expect(rows).toHaveLength(1);
      expect(screen.getByText('Atlantic Wave')).toBeInTheDocument();

      // 3. Completed tab: VESSEL-03 and VESSEL-04 (count = 2)
      const completedTab = within(tablist).getByRole('tab', { name: /completed/i });
      expect(completedTab.textContent).toContain('(2)');
      fireEvent.click(completedTab);
      rows = screen.getAllByRole('row').slice(1);
      expect(rows).toHaveLength(2);

      // 4. All tab: the session inspector's 4 vessels; the other inspector's vessel stays out
      const allTab = within(tablist).getByRole('tab', { name: /all/i });
      expect(allTab.textContent).toContain('(4)');
      fireEvent.click(allTab);
      rows = screen.getAllByRole('row').slice(1);
      expect(rows).toHaveLength(4);
      expect(screen.queryByText('Shaw Vessel')).toBeNull();
    });

    it('displays Due column with lateness in red text for overdue vessels', () => {
      render(<InspectorWorkspaceView />);

      const tablist = screen.getByRole('tablist', { name: /inspector queue tabs/i });
      fireEvent.click(within(tablist).getByRole('tab', { name: /overdue/i }));

      const dueCell = screen.getByText(/late/i);
      expect(dueCell).toHaveClass('text-danger');
      expect(dueCell.textContent).toMatch(/\d+ days late/);
    });

    it('enforces at most 1 badge per row (operating status) and strictly 1 View action per row', () => {
      render(<InspectorWorkspaceView />);

      const tablist = screen.getByRole('tablist', { name: /inspector queue tabs/i });
      fireEvent.click(within(tablist).getByRole('tab', { name: /all/i }));

      const rows = screen.getAllByRole('row').slice(1);
      rows.forEach((row) => {
        // At most 1 badge in the entire row (operating status)
        const badges = row.querySelectorAll('.badge');
        expect(badges.length).toBeLessThanOrEqual(1);

        // Exactly 1 action button (the extra CAPA button was removed)
        const actionButtons = row.querySelectorAll('td:last-child button');
        expect(actionButtons).toHaveLength(1);
        expect(actionButtons[0]).toHaveAttribute('title', 'View');
      });
    });
  });
});
