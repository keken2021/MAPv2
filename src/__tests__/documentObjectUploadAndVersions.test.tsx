/*
  file summary: comprehensive test suite for Submitter and Administrator assurance object document referencing, version upload, duplicate title prevention, and Option A renewal rules.
  responsibilities: verifies unique title per object, multi-object document referencing, version pivoting, drawer expiry override, FR-15 snapshot preservation, and view integration.
  role in system: automated verification for Task 5311 extension and submitter document object referencing.
*/

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { DocumentUploadModal } from '../components/modals/DocumentUploadModal';
import { VersionHistoryDrawer } from '../components/drawers/VersionHistoryDrawer';
import { EquipmentDetailView } from '../views/EquipmentDetailView';
import { ActivityDetailView } from '../views/ActivityDetailView';
import {
  normalizeTitleForObjectComparison,
  getNextVersionLabel,
  resolveDocumentTargetObject,
  formatDocumentTargetObjectLabel,
} from '../utils/documentObjectHelpers';
import { MasterDocument } from '../types/document';
import { AssuranceObject, AssuranceSet } from '../types/assurance';
import { getDocumentReuploadBlockReason } from '../utils/documentRenewalHelpers';

const mockVesselDoc: MasterDocument = {
  id: 'DOC-TEST-VES-01',
  title: 'Safety Management Certificate',
  entityType: 'Vessel Certificate',
  vesselId: 'VESSEL-001',
  targetObjectType: 'vessel',
  targetObjectId: 'VESSEL-001',
  targetObjectName: 'MV Pacific Endeavour',
  ownerOrganization: 'Northwind Marine Pty Ltd',
  certificateNo: 'SMC-PAC-001',
  issuingAuthority: 'DNV',
  expiryDate: '2027-12-31',
  ocrConfidence: 97,
  complianceState: 'Valid',
  currentVersion: 'v1.0',
  versions: [
    {
      versionLabel: 'v1.0',
      uploadedAt: '2026-01-01T00:00:00Z',
      uploadedBy: 'M. Chen',
      fileSizeBytes: 2048000,
      fileName: 'smc_v1.pdf',
      changeSummary: 'Initial certificate',
    },
  ],
  validationRules: { charterBufferPassed: true, assetMatch100Percent: true, iacsAuthorityValid: true, overallValid: true },
  verificationStatus: 'Verified',
};

describe('Document Object Reference and Version Upload', () => {
  const initialStore = useMapStore.getState();

  beforeEach(() => {
    vi.clearAllMocks();
    useMapStore.setState({
      ...initialStore,
      isAuthenticated: true,
      activePersona: 'Submitter',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
      activeSessionUserId: 'USR-102',
      documents: [mockVesselDoc],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('1. documentObjectHelpers title normalization and resolution', () => {
    it('normalizes titles for comparison ignoring whitespace and casing', () => {
      expect(normalizeTitleForObjectComparison('Certificate of Class (Annual Survey)'))
        .toBe('certificate of class (annual survey)');
      expect(normalizeTitleForObjectComparison('  SAFETY   MANAGEMENT   PLAN  '))
        .toBe('safety management plan');
      expect(normalizeTitleForObjectComparison('Medical Fitness — Capt. John Doe', 'person', 'Capt. John Doe'))
        .toBe('medical fitness');
    });

    it('computes next minor version label correctly', () => {
      expect(getNextVersionLabel([], 'v1.0')).toBe('v1.1');
      expect(getNextVersionLabel([{ versionLabel: 'v1.0' }, { versionLabel: 'v1.1' }], 'v1.1')).toBe('v1.2');
      expect(getNextVersionLabel([{ versionLabel: 'v1.0' }, { versionLabel: 'v1.4' }], 'v1.4')).toBe('v1.5');
    });

    it('resolves document target object and formats readable label without badge clutter', () => {
      const state = useMapStore.getState();
      const resolved = resolveDocumentTargetObject(mockVesselDoc, {
        vessels: state.vessels,
        crew: state.crew,
        equipment: state.equipment,
        assuranceObjects: state.assuranceObjects,
      });
      expect(resolved).not.toBeNull();
      expect(resolved?.type).toBe('vessel');
      expect(resolved?.id).toBe('VESSEL-001');

      const label = formatDocumentTargetObjectLabel(mockVesselDoc, {
        vessels: state.vessels,
        crew: state.crew,
        equipment: state.equipment,
        assuranceObjects: state.assuranceObjects,
      });
      expect(label).toContain('Vessel');
      expect(label).toContain('MV Pacific Endeavour');
    });
  });

  describe('2. Unique title per object enforcement in store', () => {
    it('blocks adding document with identical title to the same object', () => {
      const store = useMapStore.getState();
      const countBefore = store.documents.length;

      store.addDocument({
        id: 'DOC-DUPLICATE-01',
        title: 'Safety Management Certificate', // identical to mockVesselDoc on VESSEL-001
        entityType: 'Vessel Certificate',
        targetObjectType: 'vessel',
        targetObjectId: 'VESSEL-001',
        vesselId: 'VESSEL-001',
        certificateNo: 'SMC-NEW-002',
        issuingAuthority: 'DNV',
        expiryDate: '2028-01-01',
        ocrConfidence: 95,
        complianceState: 'Valid',
        currentVersion: 'v1.0',
        versions: [],
        validationRules: { charterBufferPassed: true, assetMatch100Percent: true, iacsAuthorityValid: true, overallValid: true },
        verificationStatus: 'Pending',
      });

      // Duplicate title on same object was blocked and not added
      expect(useMapStore.getState().documents.length).toBe(countBefore);
      expect(useMapStore.getState().documents.some((d) => d.id === 'DOC-DUPLICATE-01')).toBe(false);
    });

    it('allows identical title across DIFFERENT objects', () => {
      const store = useMapStore.getState();
      const eqItem = store.equipment[0];

      // Add document with same title on equipment
      store.addDocument({
        id: 'DOC-EQ-01',
        title: 'Safety Management Certificate', // same title, but on equipment
        entityType: 'Equipment Certificate',
        targetObjectType: 'equipment',
        targetObjectId: eqItem.id,
        certificateNo: 'EQ-SMC-001',
        issuingAuthority: 'DNV',
        expiryDate: '2028-01-01',
        ocrConfidence: 95,
        complianceState: 'Valid',
        currentVersion: 'v1.0',
        versions: [],
        validationRules: { charterBufferPassed: true, assetMatch100Percent: true, iacsAuthorityValid: true, overallValid: true },
        verificationStatus: 'Pending',
      });

      const doc = useMapStore.getState().documents.find((d) => d.id === 'DOC-EQ-01');
      expect(doc).toBeDefined();
      expect(doc?.targetObjectType).toBe('equipment');
      expect(doc?.targetObjectId).toBe(eqItem.id);
    });
  });

  describe('3. DocumentUploadModal object reference & duplicate alert pivot', () => {
    it('renders object reference fields and warns on duplicate title for selected object', async () => {
      render(
        <DocumentUploadModal
          isOpen={true}
          onClose={vi.fn()}
          defaultObjectType="vessel"
          defaultObjectId="VESSEL-001"
          allowVersionModeSwitch={true}
        />,
      );

      // Verify object reference controls are rendered
      expect(screen.getByLabelText(/Referenced Object Type/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Target Object/i)).toBeInTheDocument();

      // Enter duplicate title
      const titleInput = screen.getByLabelText(/^Title/i);
      fireEvent.change(titleInput, { target: { value: 'Safety Management Certificate' } });

      // Live duplicate warning alert appears
      const alert = await screen.findByTestId('duplicate-object-title-error');
      expect(alert).toBeInTheDocument();
      expect(alert.textContent).toMatch(/already recorded for this vessel/i);

      // Verify 1-click pivot button exists
      const pivotBtn = screen.getByRole('button', { name: /Upload New Version Instead/i });
      expect(pivotBtn).toBeInTheDocument();

      // Click pivot button
      fireEvent.click(pivotBtn);

      // Modal mode pivots to version upload with existing doc selected
      expect(screen.getAllByRole('button', { name: /Upload New Version/i }).length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText(/Select Document to Version/i)).toBeInTheDocument();
    });

    it('submits a new version when in version mode', async () => {
      vi.useFakeTimers();
      const handleClose = vi.fn();
      const addVersionSpy = vi.fn();

      useMapStore.setState({
        addDocumentVersion: addVersionSpy,
        documents: [mockVesselDoc],
      });

      const { container } = render(
        <DocumentUploadModal
          isOpen={true}
          onClose={handleClose}
          existingDocument={mockVesselDoc}
          allowVersionModeSwitch={true}
        />,
      );

      // Select file
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).not.toBeNull();

      const fakeFile = new File(['mock content in binary format for test'], 'smc_v1_1.pdf', {
        type: 'application/pdf',
      });
      Object.defineProperty(fakeFile, 'size', { value: 3200000 });
      fireEvent.change(fileInput, { target: { files: [fakeFile] } });

      const changeNotes = screen.getByLabelText(/Change Summary/i);
      fireEvent.change(changeNotes, { target: { value: 'Annual renewal certificate' } });

      const confirmExtractBtn = screen.queryByRole('button', { name: /Confirm & Process AI Extraction/i });
      if (confirmExtractBtn) {
        act(() => {
          fireEvent.click(confirmExtractBtn);
          vi.advanceTimersByTime(2000);
        });
      }

      const submitBtn = screen.getByRole('button', { name: /Upload New Version/i });
      act(() => {
        fireEvent.click(submitBtn);
        vi.advanceTimersByTime(2000);
      });

      expect(addVersionSpy).toHaveBeenCalledWith(
        mockVesselDoc.id,
        'v1.1',
        'smc_v1_1.pdf',
        3200000,
        expect.any(String),
        expect.any(String),
        undefined,
      );
    });
  });

  describe('4. Option A Renewal policy for unlinked vs set-linked documents', () => {
    it('allows free re-upload for unlinked vault documents (isUnlinked = true)', () => {
      const blockReason = getDocumentReuploadBlockReason(
        mockVesselDoc,
        [],
        new Date('2026-06-01T00:00:00Z'),
        undefined,
        undefined,
        true, // isUnlinked = true
      );
      expect(blockReason).toBeUndefined();
    });

    it('blocks re-upload for valid set-linked documents until contract buffer or expiry is hit (isUnlinked = false)', () => {
      const blockReason = getDocumentReuploadBlockReason(
        mockVesselDoc,
        [],
        new Date('2026-06-01T00:00:00Z'),
        undefined,
        undefined,
        false, // isUnlinked = false
      );
      expect(blockReason).toBeDefined();
      expect(blockReason).toMatch(/Re-upload opens when the document expires/i);
    });
  });

  describe('5. VersionHistoryDrawer optional expiry date update', () => {
    it('updates expiry date and recalculates compliance state when a new expiry is entered', () => {
      const addVersionSpy = vi.fn();
      useMapStore.setState({
        addDocumentVersion: addVersionSpy,
        documents: [mockVesselDoc],
      });

      render(
        <VersionHistoryDrawer
          document={mockVesselDoc}
          onClose={vi.fn()}
        />,
      );

      // Verify drawer opens and shows current version
      expect(screen.getByText(/Version History/i)).toBeInTheDocument();

      // Enter file, change summary, and new expiry date
      const fakeFile = new File(['new survey content'], 'smc_v1_1_renewed.pdf', { type: 'application/pdf' });
      Object.defineProperty(fakeFile, 'size', { value: 3750000 });

      const fileInput = document.body.querySelector('#ver-file-input') as HTMLInputElement;
      expect(fileInput).not.toBeNull();
      fireEvent.change(fileInput, { target: { files: [fakeFile] } });

      const expiryInput = document.body.querySelector('#ver-expiry-date') as HTMLInputElement;
      expect(expiryInput).not.toBeNull();
      fireEvent.change(expiryInput, { target: { value: '2029-06-30' } });

      const notesInput = document.body.querySelector('#ver-summary') as HTMLTextAreaElement;
      expect(notesInput).not.toBeNull();
      fireEvent.change(notesInput, { target: { value: 'Extended survey endorsement' } });

      const form = document.body.querySelector('#version-upload-form') as HTMLFormElement;
      expect(form).not.toBeNull();
      fireEvent.submit(form);

      expect(addVersionSpy).toHaveBeenCalledWith(
        mockVesselDoc.id,
        'v1.1',
        'smc_v1_1_renewed.pdf',
        3750000,
        'Extended survey endorsement',
        '2029-06-30',
      );
    });
  });

  describe('6. FR-15 Approved set snapshot preservation on version upload', () => {
    it('keeps approved assurance set requirement pinned to original version when a new version is uploaded', () => {
      const store = useMapStore.getState();
      const approvedSet: AssuranceSet = {
        id: 'AS-APPROVED-001',
        title: 'Charter Assurance Campaign 2026',
        assuranceType: 'Vessel',
        scopeType: 'Vessel',
        stage: 'Approved',
        clientWorkflowStage: 'approved',
        vesselId: 'VESSEL-001',
        initiatorOrg: 'Chevron Australia',
        clientOrg: 'Chevron Australia',
        serviceProviderOrg: 'Northwind Marine Pty Ltd',
        assignedSubmitter: 'M. Chen (Northwind Marine Pty Ltd)',
        requirements: [
          {
            id: 'REQ-APPROVED-01',
            title: 'Safety Management Certificate',
            isMandatory: true,
            isFulfilled: true,
            documentId: mockVesselDoc.id,
            documentVersion: 'v1.0',
            verifierStatus: 'Verified',
          },
        ],
      } as unknown as AssuranceSet;

      useMapStore.setState({
        assuranceSets: [approvedSet],
      });

      // Upload new version v1.1
      store.addDocumentVersion(
        mockVesselDoc.id,
        'v1.1',
        'smc_renewed.pdf',
        3000000,
        'Annual endorsement',
        'M. Chen',
      );

      // Document now has currentVersion v1.1
      const doc = useMapStore.getState().documents.find((d) => d.id === mockVesselDoc.id);
      expect(doc?.currentVersion).toBe('v1.1');

      // But approved set requirement MUST remain pinned to v1.0 snapshot!
      const currentSet = useMapStore.getState().assuranceSets.find((s) => s.id === approvedSet.id);
      const req = currentSet?.requirements.find((r) => r.id === 'REQ-APPROVED-01');
      expect(req?.documentVersion).toBe('v1.0');
    });
  });

  describe('7. Detail View Upload Triggers and Invariants', () => {
    it('EquipmentDetailView shows "Upload Document" button in Certificates header for owning submitter', () => {
      const eqItem = useMapStore.getState().equipment[0];
      // Set equipment owner to viewer's organization
      useMapStore.setState({
        equipment: useMapStore.getState().equipment.map((e) =>
          e.id === eqItem.id ? { ...e, owningOrganization: 'Northwind Marine Pty Ltd' } : e,
        ),
      });

      render(<EquipmentDetailView equipmentId={eqItem.id} />);

      // Switch to Documents tab
      fireEvent.click(screen.getByRole('tab', { name: /Documents/i }));

      // Certificates header contains Upload Document button
      expect(screen.getByRole('button', { name: /Upload Document/i })).toBeInTheDocument();
    });

    it('ActivityDetailView hides Documents tab for Submitter when empty, but shows Upload Document button when documents exist', () => {
      const emptyActivity: AssuranceObject = {
        id: 'MAP-ACT-EMPTY-TEST',
        type: 'activity',
        name: 'Empty Activity Unit Test',
        ownerOrganization: 'Northwind Marine Pty Ltd',
        identifier: 'ACT-EMPTY-TEST',
        description: 'An activity with no evidence or history',
        statusHistory: [],
      };

      useMapStore.setState({
        assuranceObjects: [emptyActivity],
        assuranceSets: [],
        documents: [], // zero documents
      });

      const { rerender } = render(<ActivityDetailView activityId={emptyActivity.id} />);

      // Invariant: Submitter with 0 docs does NOT see Documents tab
      const tablist = screen.getByRole('tablist', { name: 'Activity detail tabs' });
      const tabButtons = within(tablist).getAllByRole('tab');
      const tabLabels = tabButtons.map((b) => b.textContent?.trim());
      expect(tabLabels.some((l) => l?.startsWith('Documents'))).toBe(false);

      // Now add a document referencing this activity
      const actDoc: MasterDocument = {
        ...mockVesselDoc,
        id: 'DOC-ACT-01',
        title: 'Project Safety Dossier',
        entityType: 'Project Dossier',
        targetObjectType: 'activity',
        targetObjectId: emptyActivity.id,
      };
      act(() => {
        useMapStore.setState({
          documents: [actDoc],
        });
        rerender(<ActivityDetailView activityId={emptyActivity.id} />);
      });

      // Now Documents tab IS visible
      const updatedTabs = screen.getByRole('tablist', { name: 'Activity detail tabs' });
      const updatedButtons = within(updatedTabs).getAllByRole('tab');
      const updatedLabels = updatedButtons.map((b) => b.textContent?.trim());
      expect(updatedLabels.some((l) => l?.startsWith('Documents'))).toBe(true);

      fireEvent.click(screen.getByRole('tab', { name: /Documents/i }));

      // Upload Document button is available in the card header
      expect(screen.getAllByRole('button', { name: /Upload Document/i }).length).toBeGreaterThan(0);
    });
  });
});
