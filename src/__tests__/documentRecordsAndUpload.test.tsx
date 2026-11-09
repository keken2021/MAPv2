import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { getDocumentCertificateLayout } from '../utils/documentTemplateHelpers';
import { DocumentReviewDrawer } from '../components/drawers/DocumentReviewDrawer';
import { DocumentUploadModal } from '../components/modals/DocumentUploadModal';
import { VersionHistoryDrawer } from '../components/drawers/VersionHistoryDrawer';
import { CrewDocumentViewerModal } from '../components/modals/CrewDocumentViewerModal';
import { useMapStore } from '../store/useMapStore';
import { MasterDocument } from '../types/document';
import { STCWDocumentItem, CrewMember } from '../types/crew';

describe('Document Records, Upload, Review and Preview (Task 5311)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMapStore.setState({
      activePersona: 'Administrator',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('1b-01: Certificate previews read genuine vessel and crew records', () => {
    it('populates class certificate fields from the vessel behind doc.vesselId without sample literals', () => {
      const mockDoc: MasterDocument = {
        id: 'MAP-VES-2026-STAT-001',
        title: 'Certificate of Class',
        entityType: 'Vessel Certificate',
        vesselId: 'VESSEL-001',
        certificateNo: 'DNV-STAT-2026-001',
        issuingAuthority: 'DNV',
        expiryDate: '2027-10-14',
        ocrConfidence: 98,
        complianceState: 'Valid',
        currentVersion: 'v1.0',
        versions: [{
          versionLabel: 'v1.0',
          uploadedAt: '2026-10-14T00:00:00Z',
          uploadedBy: 'Administrator',
          fileSizeBytes: 2150000,
          fileName: 'dnv_cert.pdf',
          changeSummary: 'Initial version',
        }],
        vesselAttributes: {
          title: 'Certificate of Class',
          certificateNumber: 'DNV-STAT-2026-001',
          certType: '+100A1 Offshore Support Vessel',
          issuingBody: 'DNV',
          issueDate: '2026-10-14',
          expiryDate: '2027-10-14',
          vesselName: 'MV Pacific Endeavour',
          imoNumber: '9123453',
          flagState: 'Australia',
          assetMatchFlag: true,
          lastSurveyDate: '2026-04-10',
          ocrConfidence: 98,
          status: 'Valid',
        },
        validationRules: {
          charterBufferPassed: true,
          assetMatch100Percent: true,
          iacsAuthorityValid: true,
          overallValid: true,
        },
        verificationStatus: 'Verified',
      };

      const layout = getDocumentCertificateLayout(mockDoc);
      expect(layout.title).toBe('CERTIFICATE OF CLASS');

      // Verify fields derived from VESSEL-001 record
      const fieldsMap = Object.fromEntries(layout.fields.map((f) => [f.label, f.value]));
      expect(fieldsMap['Vessel Name']).toBe('MV Pacific Endeavour');
      expect(fieldsMap['Port of Registry']).toBe('Fremantle, WA');
      expect(fieldsMap['Registered Owner']).toBe('Northwind Marine Pty Ltd');
      expect(fieldsMap['Gross Tonnage']).toBe('3,250 GT');
      expect(fieldsMap['Year Built']).toBe('2019');
      expect(fieldsMap['Classification Society']).toBe('DNV');

      // Ensure no "(Sample)" literal exists in any field
      layout.fields.forEach((f) => {
        expect(f.value).not.toContain('(Sample)');
      });
    });

    it('populates flag state certificate fields from the vessel record without sample literals', () => {
      const mockDoc: MasterDocument = {
        id: 'MAP-VES-2026-STAT-002',
        title: 'Flag State Certificate of Registry',
        entityType: 'Vessel Certificate',
        vesselId: 'VESSEL-001',
        certificateNo: 'AMSA-REG-2026-001',
        issuingAuthority: 'Australian Maritime Safety Authority',
        expiryDate: '2028-06-30',
        ocrConfidence: 99,
        complianceState: 'Valid',
        currentVersion: 'v1.0',
        versions: [{
          versionLabel: 'v1.0',
          uploadedAt: '2026-06-30T00:00:00Z',
          uploadedBy: 'Administrator',
          fileSizeBytes: 1800000,
          fileName: 'flag_cert.pdf',
          changeSummary: 'Initial version',
        }],
        validationRules: {
          charterBufferPassed: true,
          assetMatch100Percent: true,
          iacsAuthorityValid: true,
          overallValid: true,
        },
        verificationStatus: 'Verified',
      };

      const layout = getDocumentCertificateLayout(mockDoc);
      expect(layout.title).toBe('FLAG STATE CERTIFICATE');

      const fieldsMap = Object.fromEntries(layout.fields.map((f) => [f.label, f.value]));
      expect(fieldsMap['Port of Registry']).toBe('Fremantle, WA');
      expect(fieldsMap['Registered Owner']).toBe('Northwind Marine Pty Ltd');
      expect(fieldsMap['Vessel Type']).toBe('Offshore Support Vessel (OSV)');

      layout.fields.forEach((f) => {
        expect(f.value).not.toContain('(Sample)');
      });
    });

    it('populates crew certificate preview from crew member record without sample literals', () => {
      const mockDoc: MasterDocument = {
        id: 'MAP-CRW-2026-STCW-001',
        title: 'STCW Certificate of Competency',
        entityType: 'Crew Certificate',
        vesselId: '',
        certificateNo: 'AMSA-STCW-9834',
        issuingAuthority: 'AMSA',
        expiryDate: '2029-01-15',
        ocrConfidence: 98,
        complianceState: 'Valid',
        currentVersion: 'v1.0',
        versions: [{
          versionLabel: 'v1.0',
          uploadedAt: '2026-01-15T00:00:00Z',
          uploadedBy: 'Submitter',
          fileSizeBytes: 1420000,
          fileName: 'coc_wright.pdf',
          changeSummary: 'Initial upload',
        }],
        crewAttributes: {
          crewName: 'Capt. Alexander Wright',
          passportId: 'PA-AU-7739102',
          rank: 'Master / Ship Captain',
          certType: 'STCW Reg II/2 Master CoC',
          issuingCenter: 'Australian Maritime Safety Authority (AMSA)',
          issueDate: '2024-01-15',
          expiryDate: '2029-01-15',
          assignedVessel: 'MV Pacific Endeavour',
          nationality: 'Australian',
          trainingDate: '2024-01-15',
          ocrConfidence: 98,
        },
        validationRules: {
          charterBufferPassed: true,
          assetMatch100Percent: true,
          iacsAuthorityValid: true,
          overallValid: true,
        },
        verificationStatus: 'Verified',
      };

      const layout = getDocumentCertificateLayout(mockDoc);
      expect(layout.title).toBe('SEAFARER COMPETENCY & COMPLIANCE CERTIFICATE');

      const fieldsMap = Object.fromEntries(layout.fields.map((f) => [f.label, f.value]));
      expect(fieldsMap['Seafarer Name']).toBe('Capt. Alexander Wright');
      expect(fieldsMap['Passport No. / ID']).toBe('PA-AU-7739102');
      expect(fieldsMap['Rank / Capacity']).toBe('Master / Ship Captain');
      expect(fieldsMap['Assigned Vessel']).toContain('MV Pacific Endeavour');

      layout.fields.forEach((f) => {
        expect(f.value).not.toContain('(Sample)');
      });
    });
  });

  describe('1a-20 & 1b-03: DocumentReviewDrawer displays current version meta and scan details', () => {
    it('shows current version file name, formatted size, page count and resolution DPI', () => {
      const mockDoc: MasterDocument = {
        id: 'MAP-VES-2026-STAT-009',
        title: 'Safety Management Certificate',
        entityType: 'Vessel Certificate',
        vesselId: 'VESSEL-001',
        certificateNo: 'DNV-SMC-9921',
        issuingAuthority: 'DNV',
        expiryDate: '2027-11-20',
        ocrConfidence: 96,
        complianceState: 'Valid',
        currentVersion: 'v1.1',
        versions: [
          {
            versionLabel: 'v1.1',
            uploadedAt: '2026-11-01T00:00:00Z',
            uploadedBy: 'Administrator',
            fileSizeBytes: 3145728, // 3 MB
            fileName: 'smc_v1_1_scan.pdf',
            changeSummary: 'Second revision after survey',
            scanDetails: {
              dpi: 300,
              pageCount: 2,
              resolutionDpi: 300,
            },
            perFieldConfidence: {
              certificateNo: 99,
              vesselName: 97,
              issuingAuthority: 95,
            },
          },
          {
            versionLabel: 'v1.0',
            uploadedAt: '2026-10-14T00:00:00Z',
            uploadedBy: 'Submitter',
            fileSizeBytes: 1048576,
            fileName: 'smc_v1_0.pdf',
            changeSummary: 'First revision',
          },
        ],
        validationRules: {
          charterBufferPassed: true,
          assetMatch100Percent: true,
          iacsAuthorityValid: true,
          overallValid: true,
        },
        verificationStatus: 'Pending',
      };

      render(<DocumentReviewDrawer document={mockDoc} onClose={vi.fn()} />);

      // Drawer meta must show the current version's fileName, formatted size (3 MB), page count (2 pages)
      expect(screen.getByText(/smc_v1_1_scan\.pdf/)).toBeInTheDocument();
      expect(screen.getByText(/3 MB/)).toBeInTheDocument();
      expect(screen.getByText(/2 pages/)).toBeInTheDocument();

      // Resolution must reflect scanDetails.dpi (300 DPI), not the literal 240 DPI
      expect(screen.getByText('Resolution 300 DPI')).toBeInTheDocument();
      expect(screen.queryByText('Resolution 240 DPI')).toBeNull();
      expect(screen.queryByText(/640 KB/)).toBeNull();
    });
  });

  describe('1b-04 & 1a-20: DocumentUploadModal saves real file size and numbers version from versions.length', () => {
    it('numbers next version as v1.1 when 1 version exists and passes real file size', () => {
      vi.useFakeTimers();

      const existingDoc: MasterDocument = {
        id: 'MAP-VES-2026-STAT-010',
        title: 'Load Line Certificate',
        entityType: 'Vessel Certificate',
        vesselId: 'VESSEL-001',
        certificateNo: 'LL-2026-88',
        issuingAuthority: 'Lloyds Register',
        expiryDate: '2026-01-01',
        ocrConfidence: 95,
        complianceState: 'Expired',
        currentVersion: 'v1.0',
        versions: [{
          versionLabel: 'v1.0',
          uploadedAt: '2026-01-01T00:00:00Z',
          uploadedBy: 'Submitter',
          fileSizeBytes: 1200000,
          fileName: 'load_line_v1.pdf',
          changeSummary: 'Initial',
        }],
        validationRules: {
          charterBufferPassed: true,
          assetMatch100Percent: true,
          iacsAuthorityValid: true,
          overallValid: false,
        },
        verificationStatus: 'Correction Requested',
      };

      const addVersionSpy = vi.fn();
      useMapStore.setState({
        addDocumentVersion: addVersionSpy,
        documents: [existingDoc],
        notifications: [],
      });

      const { container } = render(
        <DocumentUploadModal
          isOpen={true}
          existingDocument={existingDoc}
          onClose={vi.fn()}
        />
      );

      // Simulate file selection with real size 4,500,000 bytes
      const fakeFile = new File(['mock content in binary format for test'], 'new_survey_cert.pdf', {
        type: 'application/pdf',
      });
      Object.defineProperty(fakeFile, 'size', { value: 4500000 });

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).not.toBeNull();

      fireEvent.change(fileInput, { target: { files: [fakeFile] } });

      // If verification popup appears, confirm and process AI extraction
      const confirmExtractBtn = screen.queryByRole('button', { name: /Confirm & Process AI Extraction/i });
      if (confirmExtractBtn) {
        act(() => {
          fireEvent.click(confirmExtractBtn);
          vi.advanceTimersByTime(2000);
        });
      }

      // Click upload new version button
      const submitBtn = screen.getByRole('button', { name: /Upload New Version/i });
      act(() => {
        fireEvent.click(submitBtn);
        vi.advanceTimersByTime(2000);
      });

      // Verify addDocumentVersion is called with:
      // - versionLabel derived from versions.length (1 existing -> 'v1.1', NOT 'v1.2')
      // - real file size 4500000 (NOT hardcoded 2400000)
      expect(addVersionSpy).toHaveBeenCalledWith(
        'MAP-VES-2026-STAT-010',
        'v1.1',
        'new_survey_cert.pdf',
        4500000,
        expect.any(String),
        expect.any(String),
        undefined
      );
    });
  });

  describe('1b-05: VersionHistoryDrawer numbers next version from versions.length and saves real file size', () => {
    it('initializes next version as v1.1 when document has 1 version, and saves uploaded file size', () => {
      const mockDoc: MasterDocument = {
        id: 'MAP-VES-2026-STAT-020',
        title: 'International Anti-Fouling System Certificate',
        entityType: 'Vessel Certificate',
        vesselId: 'VESSEL-001',
        certificateNo: 'AFS-2026-01',
        issuingAuthority: 'DNV',
        expiryDate: '2026-05-10',
        ocrConfidence: 97,
        complianceState: 'Expired',
        currentVersion: 'v1.0',
        versions: [{
          versionLabel: 'v1.0',
          uploadedAt: '2026-05-10T00:00:00Z',
          uploadedBy: 'Submitter',
          fileSizeBytes: 1500000,
          fileName: 'afs_cert.pdf',
          changeSummary: 'Initial file',
        }],
        validationRules: {
          charterBufferPassed: true,
          assetMatch100Percent: true,
          iacsAuthorityValid: true,
          overallValid: false,
        },
        verificationStatus: 'Correction Requested',
      };

      const addVersionSpy = vi.fn();
      useMapStore.setState({
        addDocumentVersion: addVersionSpy,
        documents: [mockDoc],
        notifications: [],
      });

      render(<VersionHistoryDrawer document={mockDoc} onClose={vi.fn()} />);

      // Version input must be initialized to 'v1.1' from versions.length, not literal 'v1.2'
      const versionInput = screen.getByLabelText(/Version/i) as HTMLInputElement;
      expect(versionInput.value).toBe('v1.1');

      // Provide a file to verify real file size is passed (drawer rendered in document.body via portal)
      const fakeFile = new File(['test file bytes'], 'afs_revised.pdf', { type: 'application/pdf' });
      Object.defineProperty(fakeFile, 'size', { value: 3750000 });

      const fileInput = document.body.querySelector('#ver-file-input') as HTMLInputElement;
      expect(fileInput).not.toBeNull();
      fireEvent.change(fileInput, { target: { files: [fakeFile] } });

      const form = document.body.querySelector('#version-upload-form') as HTMLFormElement;
      expect(form).not.toBeNull();
      fireEvent.submit(form);

      expect(addVersionSpy).toHaveBeenCalledWith(
        'MAP-VES-2026-STAT-020',
        'v1.1',
        'afs_revised.pdf',
        3750000,
        expect.any(String)
      );
    });
  });

  describe('5490: Evidence upload accepts TIFF with a 25 MB limit', () => {
    it('accepts a TIFF under 25 MB and refuses oversized or Word files', () => {
      render(<DocumentUploadModal isOpen onClose={() => {}} />);
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(input.accept).toBe('.pdf,.png,.jpg,.jpeg,.tif,.tiff');

      const tiff = new File([new Uint8Array(1024)], 'class-cert.tiff', { type: 'image/tiff' });
      fireEvent.change(input, { target: { files: [tiff] } });
      expect(screen.queryByTestId('upload-file-error')).toBeNull();
      expect(screen.getByText(/class-cert\.tiff/i)).toBeInTheDocument();

      const oversized = new File([new Uint8Array(26 * 1024 * 1024)], 'too-big.pdf', { type: 'application/pdf' });
      Object.defineProperty(oversized, 'size', { value: 26 * 1024 * 1024 });
      fireEvent.change(input, { target: { files: [oversized] } });
      expect(screen.getByTestId('upload-file-error')).toHaveTextContent(
        'File size exceeds the maximum allowed limit of 25 MB.',
      );

      const word = new File([new Uint8Array(2048)], 'notes.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      fireEvent.change(input, { target: { files: [word] } });
      expect(screen.getByTestId('upload-file-error')).toHaveTextContent(
        'Word documents (.doc, .docx) are not accepted. Please upload PDF, TIFF, or image files.',
      );
    });
  });

  describe('5492: Hand-entry fallback after a failed extraction', () => {
    it('shows Retry and Enter by Hand when extraction fails, then shows the manual fallback badge', async () => {
      vi.useFakeTimers();
      useMapStore.setState({ activePersona: 'Administrator' });

      render(<DocumentUploadModal isOpen onClose={() => {}} defaultVesselId="VESSEL-001" />);
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const failFile = new File([new Uint8Array(2048)], 'fail-scan.pdf', { type: 'application/pdf' });
      fireEvent.change(input, { target: { files: [failFile] } });

      fireEvent.click(screen.getByRole('button', { name: /Read Document/i }));
      await act(async () => {
        vi.advanceTimersByTime(1200);
      });

      expect(screen.getByTestId('extraction-failed-alert')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Retry Extraction/i })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Enter by Hand/i }));
      expect(screen.getByTestId('hand-entered-badge')).toBeInTheDocument();
    });
  });

  describe('1c-09: CrewDocumentViewerModal reads crew member and document records', () => {
    it('reads rank, nationality, and vessel from CrewMember and file details from record', () => {
      const mockStcwDoc: STCWDocumentItem = {
        id: 'MAP-CRW-2026-STCW-011',
        title: 'Master Unlimited CoC',
        layer: 'Layer 1 - Universal Core',
        stcwRegulation: 'STCW II/2',
        certificateNo: 'AMSA-COC-8849',
        issuingAuthority: 'AMSA',
        issueDate: '2024-03-01',
        expiryDate: '2029-03-01',
        verificationStatus: 'Verified',
        fileName: 'capt_wright_coc.pdf',
        fileSizeBytes: 2450000,
      };

      const testCrewMember: CrewMember = {
        id: 'CREW-001',
        fullName: 'Capt. Alexander Wright',
        rank: 'Master / Ship Captain',
        nationality: 'Australian',
        seamansBookNo: 'SB-88214',
        passportNo: 'PA-AU-7739102',
        dateOfBirth: '1982-04-12',
        emergencyContact: '+61 400 111 222',
        currentVesselName: 'MV Pacific Endeavour',
        complianceStatus: 'Fully Compliant',
        overallComplianceScore: 100,
        lastAuditedDate: '2026-10-01',
        assignments: [],
        layer1CoreDocuments: [mockStcwDoc],
        layer2Endorsements: [],
      };

      useMapStore.setState({
        crew: [testCrewMember],
      });

      render(
        <CrewDocumentViewerModal
          isOpen={true}
          crewName="Capt. Alexander Wright"
          document={mockStcwDoc}
          canManage={true}
          onClose={vi.fn()}
          onOpenReupload={vi.fn()}
        />
      );

      // Modal title and subtitles must reflect document and crew details
      expect(screen.getByText(/Master Unlimited CoC · STCW Reg: STCW II\/2 · Crew: Capt\. Alexander Wright/)).toBeInTheDocument();

      // Look up inside preview: seafarer details must be derived from crew member record
      expect(screen.getByText('Capt. Alexander Wright')).toBeInTheDocument();
      expect(screen.getByText('Master / Ship Captain')).toBeInTheDocument();
      expect(screen.getAllByText('MV Pacific Endeavour').length).toBeGreaterThanOrEqual(1);

      // Ensure no invented placeholder value 'Seafarer' is shown in any field
      expect(screen.queryByText('Seafarer')).toBeNull();
    });
  });
});
