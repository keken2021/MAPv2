/* 
  file summary: high-fidelity document certificate preview component matching the exact layout and formatting of official MAP sample certificates.
  responsibilities: renders sample certificate border, red sample banner, document title, attributes table, legal certification statement, and test footer.
  role in system: used in DocumentReviewDrawer, DocumentDetailView, DocumentTable preview modal, and VesselDetailView certificate inspection.
*/

import React, { useState } from 'react';
import { MasterDocument } from '../../types/document';
import { getDocumentCertificateLayout, exportDocumentAsPdf } from '../../utils/documentTemplateHelpers';
import { Printer, ZoomIn, ZoomOut, Maximize2, Minimize2, X } from 'lucide-react';

interface DocumentCertificatePreviewProps {
  document: MasterDocument;
  compact?: boolean;
  showToolbar?: boolean;
  maxHeight?: string | number;
  height?: string | number;
  scale?: number;
  showOuterCard?: boolean;
}

/**
 * what: renders a pixel-accurate visual replica of the MAP sample certificates (Safety, Flag State, Class, STCW).
 * how: consumes getDocumentCertificateLayout to build the framed navy-bordered document layout with printable export capabilities.
 * with what file: src/components/common/DocumentCertificatePreview.tsx.
 */
export const DocumentCertificatePreview: React.FC<DocumentCertificatePreviewProps> = ({
  document,
  compact = false,
  showToolbar = true,
  maxHeight,
  height,
  scale: externalScale,
  showOuterCard = true,
}) => {
  const layout = getDocumentCertificateLayout(document);
  const [internalScale, setInternalScale] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const activeScale = externalScale !== undefined ? externalScale : internalScale;

  const handleZoomIn = () => setInternalScale((prev) => Math.min(Number((prev + 0.1).toFixed(2)), 1.3));
  const handleZoomOut = () => setInternalScale((prev) => Math.max(Number((prev - 0.1).toFixed(2)), 0.5));
  const handlePrint = () => exportDocumentAsPdf(document);

  const content = (
    <div
      className="bg-white text-dark shadow position-relative mx-auto transition-all"
      style={{
        border: '2px solid #1e3a5f',
        padding: compact ? '12px 14px' : '36px 32px',
        width: compact ? '340px' : '580px',
        maxWidth: isFullscreen ? '850px' : '100%',
        minHeight: compact ? '480px' : '820px',
        aspectRatio: '210 / 297',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        transform: activeScale !== 1 && !isFullscreen ? `scale(${activeScale})` : undefined,
        transformOrigin: 'top center',
        alignSelf: 'flex-start',
      }}
    >
      {/* Top Banner */}
      <div
        className="text-center fw-bold text-uppercase"
        style={{
          color: '#b91c1c',
          fontSize: compact ? '0.60rem' : '0.8rem',
          letterSpacing: '0.06em',
          marginBottom: compact ? '4px' : '14px',
          lineHeight: 1.2,
        }}
      >
        {layout.headerNotice}
      </div>

      {/* Main Document Title */}
      <h2
        className="text-center fw-bolder text-uppercase mb-1"
        style={{
          color: '#0f172a',
          fontSize: compact ? '0.90rem' : '1.5rem',
          letterSpacing: '0.03em',
          fontWeight: 800,
          lineHeight: 1.2,
        }}
      >
        {layout.title}
      </h2>

      {/* Subtitle */}
      <div
        className="text-center text-muted"
        style={{
          fontSize: compact ? '0.62rem' : '0.825rem',
          marginBottom: compact ? '4px' : '12px',
          lineHeight: 1.2,
        }}
      >
        {layout.subtitle}
      </div>

      {/* Divider */}
      <hr
        className="border-0"
        style={{
          borderTop: '1.5px solid #0f172a',
          opacity: 0.9,
          margin: compact ? '3px 0 6px 0' : '12px 0 16px 0',
        }}
      />

      {/* Attributes Table */}
      <table
        className="w-100"
        style={{
          borderCollapse: 'collapse',
          fontSize: compact ? '0.62rem' : '0.825rem',
          marginBottom: compact ? '6px' : '16px',
        }}
      >
        <tbody>
          {layout.fields.map((f, idx) => (
            <tr
              key={idx}
              style={{
                borderBottom: '1px solid #e2e8f0',
                backgroundColor: idx % 2 === 1 ? '#fafbfd' : '#ffffff',
              }}
            >
              <td
                className="fw-bold text-dark align-top text-truncate"
                style={{
                  width: '42%',
                  padding: compact ? '1.5px 5px' : '4px 8px',
                  lineHeight: 1.25,
                }}
              >
                {f.label}
              </td>
              <td
                className="text-secondary align-top"
                style={{
                  width: '58%',
                  color: '#334155',
                  padding: compact ? '1.5px 5px' : '4px 8px',
                  lineHeight: 1.25,
                  wordBreak: 'break-word',
                }}
              >
                {f.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Certification Statement Section */}
      <div style={{ marginBottom: compact ? '6px' : '16px' }}>
        <div
          className="fw-bold text-dark mb-0.5"
          style={{
            fontSize: compact ? '0.62rem' : '0.825rem',
            lineHeight: 1.2,
          }}
        >
          {layout.statementTitle}
        </div>
        <div
          className="text-secondary"
          style={{
            fontSize: compact ? '0.56rem' : '0.75rem',
            lineHeight: 1.25,
            color: '#475569',
          }}
        >
          {layout.statementText}
        </div>
      </div>

      {/* Bottom Footer */}
      <div
        className="d-flex justify-content-between align-items-center border-top text-muted"
        style={{
          fontSize: compact ? '0.56rem' : '0.7rem',
          borderColor: '#cbd5e1',
          color: '#64748b',
          paddingTop: compact ? '3px' : '8px',
        }}
      >
        <span className="font-mono-code">{layout.footerCertNo}</span>
        <span>{layout.footerNotice}</span>
      </div>
    </div>
  );

  return (
    <div className="d-flex flex-column gap-2 w-100">
      {/* Optional Preview Toolbar */}
      {showToolbar && (
        <div className="d-flex align-items-center justify-content-between bg-light border rounded px-3 py-1.5 shadow-2xs">
          <div className="d-flex align-items-center gap-2">
            <span
              className="badge bg-secondary-subtle text-secondary border font-mono-code"
              style={{ fontSize: '0.7rem' }}
            >
              PDF Review
            </span>
            <span className="small text-muted d-none d-sm-inline" style={{ fontSize: '0.75rem' }}>
              {document.certificateNo}
            </span>
          </div>

          <div className="d-flex align-items-center gap-1">
            <button
              type="button"
              className="btn btn-sm btn-link text-secondary p-1"
              onClick={handleZoomOut}
              title="Zoom Out"
              aria-label="Zoom Out"
            >
              <ZoomOut size={15} />
            </button>
            <span className="small text-muted font-mono-code px-1" style={{ fontSize: '0.7rem' }}>
              {Math.round(activeScale * 100)}%
            </span>
            <button
              type="button"
              className="btn btn-sm btn-link text-secondary p-1"
              onClick={handleZoomIn}
              title="Zoom In"
              aria-label="Zoom In"
            >
              <ZoomIn size={15} />
            </button>
            <div className="vr mx-1" style={{ height: '14px' }} />
            <button
              type="button"
              className="btn btn-sm btn-link text-secondary p-1"
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              aria-label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-link text-secondary p-1"
              onClick={handlePrint}
              title="Print or Save PDF"
              aria-label="Print or Save PDF"
            >
              <Printer size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Main Document Preview Scroller */}
      {isFullscreen ? (
        <div
          className="modal show d-block map-modal-backdrop"
          tabIndex={-1}
          style={{ zIndex: 1070 }}
          onClick={() => setIsFullscreen(false)}
        >
          <div
            className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content bg-white text-dark border shadow-lg overflow-hidden">
              <div
                className="modal-header d-flex align-items-center justify-content-between px-4 py-3"
                style={{ backgroundColor: '#0B1B2B', color: '#FFFFFF' }}
              >
                <div className="d-flex align-items-center gap-2.5 min-w-0">
                  <div className="p-2 bg-primary-subtle text-primary rounded-3 flex-shrink-0">
                    <Printer size={16} className="text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h5 className="modal-title fw-bold text-white m-0 text-truncate" style={{ fontSize: '1.05rem' }}>
                      PDF Review — {document.title}
                    </h5>
                    <div className="small font-mono-code text-truncate" style={{ color: '#94A3B8', fontSize: '0.78rem' }}>
                      {document.certificateNo} · {document.entityType} · {document.issuingAuthority}
                    </div>
                  </div>
                </div>
                <div className="d-flex align-items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    className="btn btn-sm text-white p-2 border-0 bg-transparent opacity-75 hover-opacity-100"
                    onClick={() => setIsFullscreen(false)}
                    aria-label="Close"
                    title="Close"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
              <div className="modal-body p-4 d-flex justify-content-center bg-slate-50" style={{ minHeight: '620px' }}>
                {content}
              </div>
            </div>
          </div>
        </div>
      ) : showOuterCard ? (
        <div
          className="w-100 overflow-auto bg-slate-100 p-2.5 border rounded-3 d-flex justify-content-center"
          style={{
            maxHeight: height || maxHeight || (compact ? '530px' : '860px'),
            minHeight: compact ? '260px' : '400px',
            alignItems: 'flex-start',
          }}
        >
          {content}
        </div>
      ) : (
        <div
          className="w-100 d-flex justify-content-center"
          style={{
            maxHeight: height || maxHeight,
            overflow: maxHeight || height ? 'auto' : 'visible',
            alignItems: 'flex-start',
          }}
        >
          {content}
        </div>
      )}
    </div>
  );
};