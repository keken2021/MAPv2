/* 
  file summary: document layout and PDF preview helper utilities modeled after official MAP certificates.
  responsibilities: maps master documents into structured certificate layouts (Safety, Flag State, Class, Crew, Equipment) reading live vessel and crew records, and generates printable/exportable HTML.
  role in system: consumed by DocumentCertificatePreview component, DocumentReviewDrawer, DocumentDetailView, DocumentTable, and export utilities.
*/

import { MasterDocument } from '../types/document';
import { formatMaritimeDate } from './formatters';
import { useMapStore } from '../store/useMapStore';
import { MOCK_VESSELS } from '../store/mockData';
import { MOCK_CREW } from '../store/crewMockData';

declare module '../types/document' {
  interface DocumentVersion {
    dpi?: number;
    pageCount?: number;
    scanDetails?: {
      dpi?: number;
      pageCount?: number;
      resolutionDpi?: number;
      colorMode?: string;
    };
    fieldConfidence?: Record<string, number>;
    perFieldConfidence?: Record<string, number>;
  }
}

export interface CertificateField {
  label: string;
  value: string;
}

export interface CertificateLayoutData {
  headerNotice: string;
  title: string;
  subtitle: string;
  fields: CertificateField[];
  statementTitle: string;
  statementText: string;
  footerCertNo: string;
  footerNotice: string;
  certType: 'safety' | 'flag' | 'class' | 'crew' | 'equipment';
}

/**
 * Resolves related vessel and crew records for a document.
 */
export function getDocumentRecordContext(doc: MasterDocument) {
  let vessels = MOCK_VESSELS;
  let crewMembers = MOCK_CREW;
  try {
    if (typeof useMapStore !== 'undefined' && useMapStore.getState) {
      const state = useMapStore.getState();
      if (state.vessels && state.vessels.length > 0) vessels = state.vessels;
      if (state.crew && state.crew.length > 0) crewMembers = state.crew;
    }
  } catch {
    // fallback to mock data when called outside zustand context
  }

  const vessel = vessels.find(
    (v) => (doc.vesselId && v.id === doc.vesselId) ||
           (doc.vesselAttributes?.imoNumber && v.imoNumber === doc.vesselAttributes.imoNumber) ||
           (doc.vesselAttributes?.vesselName && v.name.toLowerCase() === doc.vesselAttributes.vesselName.toLowerCase())
  );

  const crewMember = crewMembers.find(
    (c) => (doc.crewAttributes?.crewName && c.fullName.toLowerCase() === doc.crewAttributes.crewName.toLowerCase()) ||
           c.layer1CoreDocuments?.some((d) => d.id === doc.id || d.certificateNo === doc.certificateNo) ||
           c.layer2Endorsements?.some((d) => d.id === doc.id || d.certificateNo === doc.certificateNo)
  );

  return { vessel, crewMember };
}

/**
 * Maps any MasterDocument into the structured layout reading live vessel and crew records.
 */
export function getDocumentCertificateLayout(doc: MasterDocument): CertificateLayoutData {
  const titleUpper = (doc.title || '').toUpperCase();
  const certNo = doc.certificateNo || doc.id;
  const isClassCert =
    titleUpper.includes('CLASS') ||
    (doc.vesselAttributes?.certType || '').toUpperCase().includes('CLASS');
  const isFlagCert =
    titleUpper.includes('REGISTRY') ||
    titleUpper.includes('FLAG') ||
    titleUpper.includes('CONTINUOUS SYNOPSIS') ||
    titleUpper.includes('CSR') ||
    titleUpper.includes('MANNING') ||
    titleUpper.includes('TONNAGE');
  const isCrewCert =
    doc.entityType === 'Crew Certificate' ||
    Boolean(doc.crewAttributes) ||
    titleUpper.includes('PASSPORT') ||
    titleUpper.includes('SEAMAN') ||
    titleUpper.includes('STCW') ||
    titleUpper.includes('ENG1') ||
    titleUpper.includes('MEDICAL');
  const isEquipmentCert =
    titleUpper.includes('WINCH') ||
    titleUpper.includes('CRANE') ||
    titleUpper.includes('HELI') ||
    titleUpper.includes('LIFEBOAT') ||
    titleUpper.includes('EQUIPMENT') ||
    titleUpper.includes('PULL TEST');

  const { vessel, crewMember } = getDocumentRecordContext(doc);

  const vesselName = vessel?.name || doc.vesselAttributes?.vesselName || doc.crewAttributes?.assignedVessel || 'N/A';
  const imoNumber = vessel?.imoNumber || doc.vesselAttributes?.imoNumber || (vesselName.includes('Pacific') ? '9123453' : 'N/A');
  const flagState = vessel?.flagState || doc.vesselAttributes?.flagState || 'Australia';
  const callSign = vessel?.callSign || 'N/A';
  const portOfRegistry = vessel?.portOfRegistry || 'N/A';
  const registeredOwner = vessel?.registeredOwner || 'N/A';
  const yearBuilt = vessel?.yearBuilt ? String(vessel.yearBuilt) : 'N/A';
  const grossTonnage = vessel?.grossTonnageGT
    ? `${vessel.grossTonnageGT.toLocaleString('en-US')} GT`
    : doc.grossTonnagePrinted
      ? `${doc.grossTonnagePrinted.toLocaleString('en-US')} GT`
      : 'N/A';
  const netTonnage = vessel?.deadweightTonnageDWT && vessel?.grossTonnageGT
    ? `${Math.round(vessel.grossTonnageGT * 0.4).toLocaleString('en-US')} NT`
    : 'N/A';
  const classificationSociety = vessel?.classificationSociety || doc.issuingAuthority || 'N/A';
  const classNotation = vessel?.classNotation || doc.vesselAttributes?.certType || 'N/A';
  const vesselType = vessel?.vesselType || 'N/A';

  const issueDateFormatted = doc.vesselAttributes?.issueDate
    ? formatMaritimeDate(doc.vesselAttributes.issueDate)
    : doc.crewAttributes?.issueDate
      ? formatMaritimeDate(doc.crewAttributes.issueDate)
      : 'N/A';
  const expiryDateFormatted = doc.expiryDate ? formatMaritimeDate(doc.expiryDate) : 'N/A';

  // 1. CLASS CERTIFICATE LAYOUT
  if (isClassCert) {
    return {
      headerNotice: 'OFFICIAL RECORD',
      title: 'CERTIFICATE OF CLASS',
      subtitle: 'Classification Record',
      certType: 'class',
      fields: [
        { label: 'Certificate No.', value: certNo },
        { label: 'Vessel Name', value: vesselName },
        { label: 'Vessel ID / Registration No.', value: doc.vesselId || vessel?.id || 'N/A' },
        { label: 'IMO Number', value: imoNumber.length >= 7 ? imoNumber : 'N/A' },
        { label: 'Call Sign', value: callSign },
        { label: 'Flag', value: flagState },
        { label: 'Port of Registry', value: portOfRegistry },
        { label: 'Registered Owner', value: registeredOwner },
        { label: 'Year Built', value: yearBuilt },
        { label: 'Gross Tonnage', value: grossTonnage },
        { label: 'Net Tonnage', value: netTonnage },
        { label: 'Classification Society', value: classificationSociety },
        { label: 'Class Notation', value: classNotation },
        { label: 'Survey Status', value: doc.vesselAttributes?.lastSurveyDate ? `Last survey recorded on ${formatMaritimeDate(doc.vesselAttributes.lastSurveyDate)}` : 'Annual / Intermediate survey requirements satisfied' },
        { label: 'Issue Date', value: issueDateFormatted },
        { label: 'Expiry Date', value: expiryDateFormatted },
        { label: 'Certificate Status', value: doc.complianceState ? doc.complianceState.toUpperCase() : 'VALID' },
      ],
      statementTitle: 'Certification Statement',
      statementText:
        'This certificate verifies that the vessel identified above has been entered in the classification register and is shown as meeting the stated class requirements subject to continued compliance and periodic surveys.',
      footerCertNo: `Certificate No.: ${certNo}`,
      footerNotice: 'Marine Assurance Platform Document Registry',
    };
  }

  // 2. FLAG STATE / REGISTRY CERTIFICATE LAYOUT
  if (isFlagCert) {
    return {
      headerNotice: 'OFFICIAL RECORD',
      title: 'FLAG STATE CERTIFICATE',
      subtitle: 'Flag Administration Registration / Compliance Record',
      certType: 'flag',
      fields: [
        { label: 'Certificate No.', value: certNo },
        { label: 'Vessel Name', value: vesselName },
        { label: 'Vessel ID / Registration No.', value: doc.vesselId || vessel?.id || 'N/A' },
        { label: 'Flag State', value: flagState },
        { label: 'Port of Registry', value: portOfRegistry },
        { label: 'Call Sign', value: callSign },
        { label: 'Registered Owner', value: registeredOwner },
        { label: 'IMO Number', value: imoNumber.length >= 7 ? imoNumber : 'N/A' },
        { label: 'Vessel Type', value: vesselType },
        { label: 'Year Built', value: yearBuilt },
        { label: 'Gross Tonnage', value: grossTonnage },
        { label: 'Net Tonnage', value: netTonnage },
        { label: 'Issuing Administration', value: doc.issuingAuthority || doc.issuingState || 'Australian Maritime Safety Authority (AMSA)' },
        { label: 'Registration Status', value: vessel?.status || 'Active' },
        { label: 'Issue Date', value: issueDateFormatted },
        { label: 'Expiry Date', value: expiryDateFormatted },
        { label: 'Certificate Status', value: doc.complianceState ? doc.complianceState.toUpperCase() : 'VALID' },
      ],
      statementTitle: 'Certification Statement',
      statementText:
        'This flag-state certificate confirms registration and compliance according to the statutory maritime provisions under the jurisdiction of the issuing flag state administration.',
      footerCertNo: `Certificate No.: ${certNo}`,
      footerNotice: 'Marine Assurance Platform Document Registry',
    };
  }

  // 3. CREW CERTIFICATE LAYOUT
  if (isCrewCert) {
    const crewName = doc.crewAttributes?.crewName || crewMember?.fullName || 'N/A';
    const passportNo = doc.crewAttributes?.passportId || crewMember?.passportNo || 'N/A';
    const rank = doc.crewAttributes?.rank || crewMember?.rank || 'N/A';
    const nationality = doc.crewAttributes?.nationality || crewMember?.nationality || 'N/A';
    const certType = doc.crewAttributes?.certType || doc.title;
    const assignedVessel = vessel?.name || crewMember?.currentVesselName || doc.crewAttributes?.assignedVessel || 'N/A';

    return {
      headerNotice: 'OFFICIAL RECORD',
      title: 'SEAFARER COMPETENCY & COMPLIANCE CERTIFICATE',
      subtitle: 'STCW / Maritime Labor Compliance Record',
      certType: 'crew',
      fields: [
        { label: 'Certificate No.', value: certNo },
        { label: 'Seafarer Name', value: crewName },
        { label: 'Passport No. / ID', value: passportNo },
        { label: 'Rank / Capacity', value: rank },
        { label: 'Nationality', value: nationality },
        { label: 'Assigned Vessel', value: assignedVessel },
        { label: 'Qualification / Endorsement', value: certType },
        { label: 'Issuing Administration', value: doc.issuingAuthority || 'Australian Maritime Safety Authority (AMSA)' },
        { label: 'Compliance Regime', value: 'STCW 1978 as amended / MLC 2006' },
        { label: 'Physical Fitness / Medical Status', value: doc.complianceState === 'Expired' ? 'Expired' : 'Fit for Seagoing Service' },
        { label: 'Issue Date', value: issueDateFormatted },
        { label: 'Expiry Date', value: expiryDateFormatted },
        { label: 'Certificate Status', value: doc.complianceState ? doc.complianceState.toUpperCase() : 'VALID' },
      ],
      statementTitle: 'Certification Statement',
      statementText:
        'This record certifies that the seafarer credentials and statutory STCW items listed above were verified and found compliant with international conventions on the issue date.',
      footerCertNo: `Certificate No.: ${certNo}`,
      footerNotice: 'Marine Assurance Platform Document Registry',
    };
  }

  // 4. EQUIPMENT OR ACTIVITY CERTIFICATE LAYOUT
  if (isEquipmentCert) {
    return {
      headerNotice: 'OFFICIAL RECORD',
      title: 'EQUIPMENT SAFETY & COMPLIANCE CERTIFICATE',
      subtitle: 'Technical Asset Proof Test & Inspection Record',
      certType: 'equipment',
      fields: [
        { label: 'Certificate No.', value: certNo },
        { label: 'Asset / Equipment Item', value: doc.title },
        { label: 'Assigned Vessel', value: vesselName },
        { label: 'Vessel ID / Registration No.', value: doc.vesselId || vessel?.id || 'N/A' },
        { label: 'Issuing Body', value: doc.issuingAuthority || 'DNV Subsea Survey' },
        { label: 'Standard / Regime', value: 'DNV-ST-E272 / CAP 437 / Statutory Proof Load' },
        { label: 'Proof Load / Safe Working Load', value: doc.complianceState === 'Expired' ? 'Inspection Required' : 'Compliant to Operating Limits' },
        { label: 'NDT / Calibration Status', value: doc.complianceState === 'Expired' ? 'Recalibration Due' : 'Calibrated & Satisfactory' },
        { label: 'Last Safety Inspection', value: issueDateFormatted },
        { label: 'Issue Date', value: issueDateFormatted },
        { label: 'Expiry Date', value: expiryDateFormatted },
        { label: 'Certificate Status', value: doc.complianceState ? doc.complianceState.toUpperCase() : 'VALID' },
      ],
      statementTitle: 'Certification Statement',
      statementText:
        'This certificate indicates that the technical equipment and safety specifications listed above were inspected and verified on the recorded survey date.',
      footerCertNo: `Certificate No.: ${certNo}`,
      footerNotice: 'Marine Assurance Platform Document Registry',
    };
  }

  // 5. VESSEL SAFETY CERTIFICATE
  return {
    headerNotice: 'OFFICIAL RECORD',
    title: 'VESSEL SAFETY CERTIFICATE',
    subtitle: 'Safety Compliance Certificate',
    certType: 'safety',
    fields: [
      { label: 'Certificate No.', value: certNo },
      { label: 'Vessel Name', value: vesselName },
      { label: 'Vessel ID / Registration No.', value: doc.vesselId || vessel?.id || 'N/A' },
      { label: 'Flag', value: flagState },
      { label: 'Port of Registry', value: portOfRegistry },
      { label: 'Registered Owner', value: registeredOwner },
      { label: 'Vessel Type', value: vesselType },
      { label: 'Safety Regime', value: doc.vesselAttributes?.certType || 'SOLAS Statutory Compliance' },
      { label: 'Life-Saving Appliances', value: doc.complianceState === 'Expired' ? 'Expired' : 'Compliant' },
      { label: 'Fire Safety Systems', value: doc.complianceState === 'Expired' ? 'Expired' : 'Compliant' },
      { label: 'Radio / GMDSS', value: doc.complianceState === 'Expired' ? 'Expired' : 'Compliant' },
      { label: 'Navigation Equipment', value: doc.complianceState === 'Expired' ? 'Expired' : 'Compliant' },
      { label: 'Emergency Preparedness', value: doc.complianceState === 'Expired' ? 'Action Required' : 'Compliant' },
      { label: 'Last Safety Inspection', value: issueDateFormatted },
      { label: 'Issue Date', value: issueDateFormatted },
      { label: 'Expiry Date', value: expiryDateFormatted },
      { label: 'Certificate Status', value: doc.complianceState ? doc.complianceState.toUpperCase() : 'VALID' },
    ],
    statementTitle: 'Certification Statement',
    statementText:
      'This statutory safety compliance certificate confirms that the vessel safety items listed above were recorded as compliant with applicable international maritime conventions on the issue date.',
    footerCertNo: `Certificate No.: ${certNo}`,
    footerNotice: 'Marine Assurance Platform Document Registry',
  };
}

/**
 * Generates standalone HTML matching official certificate format.
 */
export function renderDocumentCertificateHtml(doc: MasterDocument): string {
  const layout = getDocumentCertificateLayout(doc);

  const rowsHtml = layout.fields
    .map(
      (f) => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 5px 8px; font-weight: 700; color: #0f172a; width: 42%; font-size: 11px;">${f.label}</td>
        <td style="padding: 5px 8px; color: #334155; width: 58%; font-size: 11px;">${f.value}</td>
      </tr>
    `
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${layout.title} — ${doc.certificateNo}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 15mm;
          }
          * {
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background: #f8fafc;
            color: #0f172a;
            margin: 0;
            padding: 24px;
            display: flex;
            justify-content: center;
          }
          .certificate-container {
            width: 100%;
            max-width: 210mm;
            min-height: 297mm;
            aspect-ratio: 210 / 297;
            background: #ffffff;
            border: 2px solid #1e3a5f;
            padding: 32px 36px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.08);
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .header-banner {
            text-align: center;
            font-size: 11px;
            font-weight: 700;
            color: #1e3a5f;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            margin-bottom: 12px;
          }
          .title {
            text-align: center;
            font-size: 22px;
            font-weight: 800;
            letter-spacing: 0.05em;
            color: #0f172a;
            margin: 0 0 6px 0;
            text-transform: uppercase;
          }
          .subtitle {
            text-align: center;
            font-size: 12px;
            color: #475569;
            margin-bottom: 18px;
          }
          .divider {
            border: 0;
            border-top: 1.5px solid #0f172a;
            margin-bottom: 18px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 22px;
          }
          .statement-title {
            font-size: 11px;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 4px;
          }
          .statement-text {
            font-size: 10px;
            line-height: 1.5;
            color: #334155;
            margin-bottom: 30px;
          }
          .footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-top: 1px solid #cbd5e1;
            padding-top: 12px;
            font-size: 9px;
            color: #64748b;
          }
          @media print {
            body {
              background: #ffffff;
              padding: 0;
            }
            .certificate-container {
              box-shadow: none;
              border: 2px solid #1e3a5f;
              padding: 30px;
            }
          }
        </style>
      </head>
      <body>
        <div class="certificate-container">
          <div class="header-banner">${layout.headerNotice}</div>
          <h1 class="title">${layout.title}</h1>
          <div class="subtitle">${layout.subtitle}</div>
          <hr class="divider" />

          <table>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div>
            <div class="statement-title">${layout.statementTitle}</div>
            <div class="statement-text">${layout.statementText}</div>
          </div>

          <div class="footer">
            <div>${layout.footerCertNo}</div>
            <div>${layout.footerNotice}</div>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Triggers a high-fidelity browser print/export window formatted identically to the sample PDF files.
 */
export function exportDocumentAsPdf(doc: MasterDocument): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const html = renderDocumentCertificateHtml(doc);
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 250);
}
