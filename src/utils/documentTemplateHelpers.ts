/* 
  file summary: document layout and PDF preview helper utilities modeled after official MAP sample certificates.
  responsibilities: maps master documents into structured certificate layouts (Safety, Flag State, Class, Crew, Equipment) matching sample PDFs, and generates printable/exportable HTML.
  role in system: consumed by DocumentCertificatePreview component, DocumentReviewDrawer, DocumentDetailView, DocumentTable, and export utilities.
*/

import { MasterDocument } from '../types/document';
import { formatMaritimeDate } from './formatters';

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
 * Maps any MasterDocument into the exact layout and structure of the MAP sample certificates.
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

  const vesselName = doc.vesselAttributes?.vesselName || doc.crewAttributes?.assignedVessel || 'MAP Demo Vessel AUSP1';
  const imoNumber = doc.vesselAttributes?.imoNumber || (vesselName.includes('Pacific') ? '9123453' : 'AUSP1VSR619');
  const flagState = doc.vesselAttributes?.flagState || 'Australia (Sample)';
  const issueDateFormatted = doc.vesselAttributes?.issueDate
    ? formatMaritimeDate(doc.vesselAttributes.issueDate)
    : doc.crewAttributes?.issueDate
      ? formatMaritimeDate(doc.crewAttributes.issueDate)
      : '13 October 2026';
  const expiryDateFormatted = doc.expiryDate ? formatMaritimeDate(doc.expiryDate) : '13 April 2027';

  // 1. CLASS CERTIFICATE LAYOUT (Matching CERTIFICATE OF CLASS sample)
  if (isClassCert) {
    return {
      headerNotice: 'SAMPLE - NOT VALID FOR OFFICIAL USE',
      title: 'CERTIFICATE OF CLASS',
      subtitle: 'Demo Classification Record for MAP Application Testing',
      certType: 'class',
      fields: [
        { label: 'Certificate No.', value: certNo },
        { label: 'Vessel Name', value: vesselName },
        { label: 'Vessel ID / Registration No.', value: doc.vesselId || 'AUSP1VSR619' },
        { label: 'IMO Number', value: imoNumber.length >= 7 ? imoNumber : 'N/A - Demo Vessel ID used' },
        { label: 'Call Sign', value: 'AUSP1 (Sample)' },
        { label: 'Flag', value: flagState },
        { label: 'Port of Registry', value: 'Sydney (Sample)' },
        { label: 'Registered Owner', value: 'Vessel Owner - MAP Demo' },
        { label: 'Year Built', value: '2021 (Sample)' },
        { label: 'Gross Tonnage', value: '8,750 GT (Sample)' },
        { label: 'Net Tonnage', value: '3,210 NT (Sample)' },
        { label: 'Classification Society', value: doc.issuingAuthority || 'Demo Classification Society (Sample)' },
        { label: 'Class Notation', value: doc.vesselAttributes?.certType || '100A1 General Cargo Ship + LMC (Sample)' },
        { label: 'Survey Status', value: 'Annual / Intermediate survey requirements satisfied for demo record' },
        { label: 'Issue Date', value: issueDateFormatted },
        { label: 'Expiry Date', value: expiryDateFormatted },
        { label: 'Certificate Status', value: 'VALID FOR DEMONSTRATION ONLY' },
      ],
      statementTitle: 'Certification Statement',
      statementText:
        'This sample certifies that the vessel identified above has been entered in the demo classification register and, for MAP testing purposes only, is shown as meeting the stated class requirements subject to continued compliance and periodic surveys.',
      footerCertNo: `Demo Certificate No.: ${certNo}`,
      footerNotice: 'Generated for MAP application testing',
    };
  }

  // 2. FLAG STATE / REGISTRY CERTIFICATE LAYOUT (Matching FLAG STATE CERTIFICATE sample)
  if (isFlagCert) {
    return {
      headerNotice: 'SAMPLE - NOT VALID FOR OFFICIAL USE',
      title: 'FLAG STATE CERTIFICATE',
      subtitle: 'Sample Flag Administration Registration / Compliance Record',
      certType: 'flag',
      fields: [
        { label: 'Certificate No.', value: certNo },
        { label: 'Vessel Name', value: vesselName },
        { label: 'Vessel ID / Registration No.', value: doc.vesselId || 'AUSP1VSR619' },
        { label: 'Flag State', value: flagState },
        { label: 'Port of Registry', value: 'Sydney (Sample)' },
        { label: 'Call Sign', value: 'AUSP1 (Sample)' },
        { label: 'Registered Owner', value: 'Vessel Owner - MAP Demo' },
        { label: 'IMO Number', value: imoNumber.length >= 7 ? imoNumber : 'N/A - Demo Vessel ID used' },
        { label: 'Vessel Type', value: 'General Cargo Vessel (Sample)' },
        { label: 'Year Built', value: '2021 (Sample)' },
        { label: 'Gross Tonnage', value: '8,750 GT (Sample)' },
        { label: 'Net Tonnage', value: '3,210 NT (Sample)' },
        { label: 'Issuing Administration', value: doc.issuingAuthority || 'Demo Maritime Administration (Sample)' },
        { label: 'Registration Status', value: 'Registered / Active - Sample' },
        { label: 'Issue Date', value: issueDateFormatted },
        { label: 'Expiry Date', value: expiryDateFormatted },
        { label: 'Certificate Status', value: 'VALID FOR DEMONSTRATION ONLY' },
      ],
      statementTitle: 'Certification Statement',
      statementText:
        'This sample flag-state record is created solely for MAP workflow and certificate-expiry testing. It is not issued by, endorsed by, or valid with any maritime administration and must not be used for navigation, port-state-control, insurance, commercial, legal, or regulatory purposes.',
      footerCertNo: `Demo Certificate No.: ${certNo}`,
      footerNotice: 'Generated for MAP application testing',
    };
  }

  // 3. CREW CERTIFICATE LAYOUT
  if (isCrewCert) {
    const crewName = doc.crewAttributes?.crewName || 'Capt. Alexander Wright';
    const passportNo = doc.crewAttributes?.passportId || 'PA-AU-7739102';
    const rank = doc.crewAttributes?.rank || 'Master / Ship Captain';
    const nationality = doc.crewAttributes?.nationality || 'Australian';
    const certType = doc.crewAttributes?.certType || doc.title;

    return {
      headerNotice: 'SAMPLE - NOT VALID FOR OFFICIAL USE',
      title: 'SEAFARER COMPETENCY & COMPLIANCE CERTIFICATE',
      subtitle: 'Sample STCW / Maritime Labor Compliance Record for MAP Application Testing',
      certType: 'crew',
      fields: [
        { label: 'Certificate No.', value: certNo },
        { label: 'Seafarer Name', value: crewName },
        { label: 'Passport No. / ID', value: passportNo },
        { label: 'Rank / Capacity', value: rank },
        { label: 'Nationality', value: nationality },
        { label: 'Assigned Vessel', value: vesselName },
        { label: 'Qualification / Endorsement', value: certType },
        { label: 'Issuing Administration', value: doc.issuingAuthority || 'Australian Maritime Safety Authority (AMSA)' },
        { label: 'Compliance Regime', value: 'STCW 1978 as amended / MLC 2006' },
        { label: 'Physical Fitness / Medical Status', value: 'Fit for Seagoing Service - Sample' },
        { label: 'Issue Date', value: issueDateFormatted },
        { label: 'Expiry Date', value: expiryDateFormatted },
        { label: 'Certificate Status', value: 'VALID FOR DEMONSTRATION ONLY' },
      ],
      statementTitle: 'Certification Statement',
      statementText:
        'For MAP application testing only, this sample record indicates that the seafarer credentials and statutory STCW items listed above were verified on the issue date. It does not replace any official Flag State endorsement or statutory Certificate of Competency.',
      footerCertNo: `Demo Certificate No.: ${certNo}`,
      footerNotice: 'Generated for MAP application testing',
    };
  }

  // 4. EQUIPMENT OR ACTIVITY CERTIFICATE LAYOUT
  if (isEquipmentCert) {
    return {
      headerNotice: 'SAMPLE - NOT VALID FOR OFFICIAL USE',
      title: 'EQUIPMENT SAFETY & COMPLIANCE CERTIFICATE',
      subtitle: 'Sample Technical Asset Proof Test & Inspection Record for MAP Application Testing',
      certType: 'equipment',
      fields: [
        { label: 'Certificate No.', value: certNo },
        { label: 'Asset / Equipment Item', value: doc.title },
        { label: 'Assigned Vessel', value: vesselName },
        { label: 'Vessel ID / Registration No.', value: doc.vesselId || 'AUSP1VSR619' },
        { label: 'Issuing Body', value: doc.issuingAuthority || 'DNV Subsea Survey' },
        { label: 'Standard / Regime', value: 'DNV-ST-E272 / CAP 437 / Statutory Proof Load' },
        { label: 'Proof Load / Safe Working Load', value: 'Compliant to Operating Limits - Sample' },
        { label: 'NDT / Calibration Status', value: 'Calibrated & Satisfactory - Sample' },
        { label: 'Last Safety Inspection', value: issueDateFormatted },
        { label: 'Issue Date', value: issueDateFormatted },
        { label: 'Expiry Date', value: expiryDateFormatted },
        { label: 'Certificate Status', value: 'VALID FOR DEMONSTRATION ONLY' },
      ],
      statementTitle: 'Certification Statement',
      statementText:
        'For MAP application testing only, this sample record indicates that the technical equipment and safety specifications listed above were inspected on the issue date. It does not replace any manufacturer warranty or statutory survey cert.',
      footerCertNo: `Demo Certificate No.: ${certNo}`,
      footerNotice: 'Generated for MAP application testing',
    };
  }

  // 5. VESSEL SAFETY CERTIFICATE (Default matching VESSEL SAFETY CERTIFICATE sample)
  return {
    headerNotice: 'SAMPLE - NOT VALID FOR OFFICIAL USE',
    title: 'VESSEL SAFETY CERTIFICATE',
    subtitle: 'Sample Safety Compliance Certificate for MAP Application Testing',
    certType: 'safety',
    fields: [
      { label: 'Certificate No.', value: certNo },
      { label: 'Vessel Name', value: vesselName },
      { label: 'Vessel ID / Registration No.', value: doc.vesselId || 'AUSP1VSR619' },
      { label: 'Flag', value: flagState },
      { label: 'Port of Registry', value: 'Sydney (Sample)' },
      { label: 'Registered Owner', value: 'Vessel Owner - MAP Demo' },
      { label: 'Vessel Type', value: 'General Cargo Vessel (Sample)' },
      { label: 'Safety Regime', value: 'SOLAS-style demo safety compliance record' },
      { label: 'Life-Saving Appliances', value: 'Compliant - Sample' },
      { label: 'Fire Safety Systems', value: 'Compliant - Sample' },
      { label: 'Radio / GMDSS', value: 'Compliant - Sample' },
      { label: 'Navigation Equipment', value: 'Compliant - Sample' },
      { label: 'Emergency Preparedness', value: 'Drills and emergency plans recorded - Sample' },
      { label: 'Last Safety Inspection', value: issueDateFormatted },
      { label: 'Issue Date', value: issueDateFormatted },
      { label: 'Expiry Date', value: expiryDateFormatted },
      { label: 'Certificate Status', value: 'VALID FOR DEMONSTRATION ONLY' },
    ],
    statementTitle: 'Certification Statement',
    statementText:
      'For MAP application testing only, this sample record indicates that the vessel safety items listed above were recorded as satisfactory on the issue date. It does not replace any statutory Cargo Ship Safety Construction, Equipment, Radio, Passenger Ship Safety, or other certificate required by the actual flag administration.',
    footerCertNo: `Demo Certificate No.: ${certNo}`,
    footerNotice: 'Generated for MAP application testing',
  };
}

/**
 * Generates standalone HTML matching the official sample PDF format.
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
            color: #b91c1c;
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
