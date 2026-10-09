/* 
  file summary: comprehensive detail modal component for marketplace asset offerings.
  responsibilities: presents detailed technical specifications, operational capabilities, compliance certifications, and provider contact actions.
  role in system: opened when a user clicks any MarketplaceCard in MarketplaceView.
*/

import React, { useState, useEffect } from 'react';
import {
  X,
  Ship,
  Wrench,
  Users,
  Briefcase,
  CheckCircle2,
  ShieldCheck,
  MapPin,
  Clock,
  DollarSign,
  Phone,
  Mail,
  ExternalLink,
  Download,
  Camera,
} from 'lucide-react';
import { MarketplaceItem } from '../../types/marketplace';
import { getOrganizationLogo } from '../../utils/vesselImageHelpers';
import { exportToPdf } from '../../utils/exportHelpers';
import { formatReadinessScore } from '../../utils/formatters';
import { getMarketplaceCharterLabel } from '../../utils/marketplaceHelpers';

interface MarketplaceDetailModalProps {
  item: MarketplaceItem | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigateToEntity?: (view: string, entityId: string) => void;
  /* opens create assurance set for the asset behind the listing */
  onCharter?: (item: MarketplaceItem) => void;
  /* when set, the charter action is disabled and this text explains why */
  charterDisabledReason?: string;
}

export const MarketplaceDetailModal: React.FC<MarketplaceDetailModalProps> = ({
  item,
  isOpen,
  onClose,
  onNavigateToEntity,
  onCharter,
  charterDisabledReason,
}) => {
  const [activeTab, setActiveTab] = useState<'specs' | 'capabilities' | 'compliance' | 'provider'>('specs');
  const [inquirySent, setInquirySent] = useState(false);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string>('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab('specs');
      setInquirySent(false);
      setSelectedPhotoUrl(item?.imageUrl || (item?.photos && item.photos.length > 0 ? item.photos[0] : ''));
    }
  }, [isOpen, item]);

  if (!isOpen || !item) return null;

  const orgInfo = getOrganizationLogo(item.providerOrg);
  const activePhoto = selectedPhotoUrl || item.imageUrl;

  const getCategoryIcon = () => {
    switch (item.category) {
      case 'vessel':
        return <Ship size={18} className="text-primary" />;
      case 'equipment':
        return <Wrench size={18} className="text-warning" />;
      case 'crew':
        return <Users size={18} className="text-info" />;
      case 'service':
        return <Briefcase size={18} className="text-success" />;
      default:
        return <Ship size={18} />;
    }
  };

  const handleExportDossierPdf = () => {
    const headers = ['Specification', 'Detail'];
    const rows = [
      ['Offering Title', item.name],
      ['Category', item.category.toUpperCase()],
      ['Subcategory', item.subcategory],
      ['Service Provider', item.providerOrg],
      ['Location / Base', item.location],
      ['Availability Status', item.availabilityStatus],
      ['Compliance Readiness', formatReadinessScore(item.complianceReadinessScore)],
      ['Rate Estimate', item.rateEstimate || 'Contact for Quote'],
      ['Mobilization Time', item.mobilizationLeadTime || 'Standard Lead'],
      ...item.detailedSpecs.map((s) => [s.label, s.value]),
    ];
    exportToPdf(`Marketplace_Dossier_${item.name.replace(/\s+/g, '_')}`, headers, rows);
  };

  const handleSendInquiry = () => {
    setInquirySent(true);
    setTimeout(() => {
      setInquirySent(false);
    }, 4000);
  };

  return (
    <div
      className="modal show d-block map-modal-backdrop"
      tabIndex={-1}
      role="dialog"
      style={{
        zIndex: 1055,
        overflowY: 'auto',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-dialog modal-dialog-centered modal-dialog-scrollable"
        role="document"
        style={{ maxWidth: '860px', width: '92%', margin: '1.75rem auto' }}
      >
        <div
          className="modal-content border-0 shadow-lg overflow-hidden w-100"
          style={{
            borderRadius: '10px',
            backgroundColor: '#FFFFFF',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div
            className="modal-header d-flex align-items-center justify-content-between px-4 py-3 border-bottom flex-shrink-0"
            style={{
              backgroundColor: '#0B1B2B',
              color: '#FFFFFF',
              borderBottomColor: 'rgba(255, 255, 255, 0.12)',
            }}
          >
            <div className="d-flex align-items-center gap-3 min-w-0">
              <div
                className="d-flex align-items-center justify-content-center bg-white rounded-2 p-1.5 shadow-sm flex-shrink-0"
                style={{ width: '38px', height: '38px' }}
              >
                {getCategoryIcon()}
              </div>
              <div className="d-flex flex-column min-w-0">
                <h5
                  className="modal-title fw-bold text-white mb-0 text-truncate"
                  style={{ fontSize: '1.15rem', letterSpacing: '0.01em', fontFamily: "'IBM Plex Sans', sans-serif" }}
                  title={item.name}
                >
                  {item.name}
                </h5>
                <span
                  className="small text-truncate mt-0.5"
                  style={{ fontSize: '0.8rem', color: '#94A3B8' }}
                >
                  {item.subcategory} · Listed by <strong className="text-white fw-semibold">{item.providerOrg}</strong>
                </span>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-sm text-white p-2 rounded-2 border-0 bg-transparent opacity-75 hover-opacity-100 ms-3 flex-shrink-0"
              onClick={onClose}
              aria-label="Close modal"
              style={{ cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Modal Body */}
          <div className="modal-body p-0">
            {/* Hero Image & Overlay Banner */}
            {item.category === 'crew' ? (
              /* Dedicated Square 1:1 Portrait Layout for Crew Members */
              <div
                className="p-4 d-flex flex-column flex-sm-row align-items-center gap-4 text-white position-relative"
                style={{
                  backgroundColor: '#0B1B2B',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
                }}
              >
                {/* Square 1:1 Portrait Photo Container */}
                <div
                  className="position-relative overflow-hidden rounded-3 border flex-shrink-0 shadow-md"
                  style={{
                    width: '180px',
                    height: '180px',
                    aspectRatio: '1 / 1',
                    backgroundColor: '#08131F',
                    borderColor: 'rgba(255, 255, 255, 0.25)',
                  }}
                >
                  <img
                    src={activePhoto}
                    alt={item.name}
                    className="w-100 h-100 object-fit-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80';
                    }}
                  />
                  {item.photos && item.photos.length > 1 && (
                    <div
                      className="position-absolute d-inline-flex align-items-center gap-1.5 px-2 py-0.5 rounded-pill shadow-sm"
                      style={{
                        bottom: '8px',
                        right: '8px',
                        backgroundColor: 'rgba(11, 27, 43, 0.88)',
                        backdropFilter: 'blur(6px)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        zIndex: 3,
                      }}
                    >
                      <Camera size={11} className="text-white" />
                      <span className="text-white font-mono-code fw-semibold" style={{ fontSize: '0.65rem' }}>
                        {item.photos.length} Photos
                      </span>
                    </div>
                  )}
                </div>

                {/* Crew Key Badges & Parameters */}
                <div className="d-flex flex-column justify-content-center gap-2.5 flex-grow-1 min-w-0 w-100">
                  <div className="d-flex flex-wrap align-items-center gap-2">
                    <span
                      className="badge rounded-pill d-inline-flex align-items-center gap-1.5 px-3 py-1.5 shadow-sm"
                      style={{
                        backgroundColor: item.availabilityTagColor || '#059669',
                        color: '#FFFFFF',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                      }}
                    >
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#FFFFFF' }} />
                      {item.availabilityStatus}
                    </span>
                    <span
                      className="small d-flex align-items-center gap-1.5 text-slate-200"
                      style={{ fontSize: '0.82rem' }}
                    >
                      <MapPin size={15} className="text-warning flex-shrink-0" />
                      <span>{item.location}</span>
                    </span>
                  </div>

                  <div className="d-flex flex-wrap align-items-center gap-3 mt-1">
                    {item.rateEstimate && (
                      <div
                        className="d-flex align-items-center gap-1.5 font-mono-code fw-semibold"
                        style={{ color: '#38BDF8', fontSize: '0.9rem' }}
                      >
                        <DollarSign size={16} className="flex-shrink-0" />
                        <span>{item.rateEstimate}</span>
                      </div>
                    )}
                    {item.mobilizationLeadTime && (
                      <div className="d-flex align-items-center gap-1.5 small text-slate-300" style={{ fontSize: '0.82rem' }}>
                        <Clock size={15} className="flex-shrink-0 text-slate-400" />
                        <span>Lead: {item.mobilizationLeadTime}</span>
                      </div>
                    )}
                  </div>

                  <div className="d-flex align-items-center gap-2 mt-1">
                    <span className="badge bg-slate-800 text-slate-200 border border-slate-700 font-mono-code px-2.5 py-1" style={{ fontSize: '0.75rem' }}>
                      STCW Compliance Readiness:{' '}
                      <strong className={item.complianceReadinessScore === null ? 'text-slate-200' : 'text-success'}>
                        {formatReadinessScore(item.complianceReadinessScore)}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* Standard 16:9 Banner for Vessels & Equipment */
              <div
                className="position-relative overflow-hidden w-100 bg-slate-900"
                style={{ height: '220px' }}
              >
                <img
                  src={activePhoto}
                  alt={item.name}
                  className="w-100 h-100 object-fit-cover opacity-90"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src =
                      'https://images.unsplash.com/photo-1583857671904-a716bf4ee5d8?q=80&w=880&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D';
                  }}
                />

                {/* Photo Count Badge */}
                {item.photos && item.photos.length > 1 && (
                  <div
                    className="position-absolute d-inline-flex align-items-center gap-1.5 px-2.5 py-1 rounded-pill shadow-sm"
                    style={{
                      top: '12px',
                      left: '16px',
                      backgroundColor: 'rgba(11, 27, 43, 0.85)',
                      backdropFilter: 'blur(8px)',
                      border: '1px solid rgba(255, 255, 255, 0.18)',
                      zIndex: 3,
                    }}
                  >
                    <Camera size={13} className="text-white" />
                    <span className="text-white font-mono-code fw-semibold" style={{ fontSize: '0.72rem' }}>
                      {item.photos.length} Photos
                    </span>
                  </div>
                )}

                <div
                  className="position-absolute bottom-0 start-0 end-0 px-4 py-3"
                  style={{
                    background: 'linear-gradient(to top, rgba(11, 27, 43, 0.96) 0%, rgba(11, 27, 43, 0.5) 65%, transparent 100%)',
                  }}
                >
                  <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 text-white">
                    <div className="d-flex align-items-center gap-3">
                      <span
                        className="badge rounded-pill d-inline-flex align-items-center gap-1.5 px-3 py-1.5 shadow-sm"
                        style={{
                          backgroundColor: item.availabilityTagColor || '#059669',
                          color: '#FFFFFF',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                        }}
                      >
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#FFFFFF' }} />
                        {item.availabilityStatus}
                      </span>
                      <span
                        className="small d-flex align-items-center gap-1.5"
                        style={{ color: '#E2E8F0', fontSize: '0.82rem' }}
                      >
                        <MapPin size={15} className="text-warning flex-shrink-0" />
                        <span>{item.location}</span>
                      </span>
                    </div>

                    <div className="d-flex align-items-center gap-3.5">
                      {item.rateEstimate && (
                        <span
                          className="small d-flex align-items-center gap-1.5 font-mono-code fw-semibold"
                          style={{ color: '#38BDF8', fontSize: '0.85rem' }}
                        >
                          <DollarSign size={15} className="flex-shrink-0" />
                          <span>{item.rateEstimate}</span>
                        </span>
                      )}
                      {item.mobilizationLeadTime && (
                        <span
                          className="small d-flex align-items-center gap-1.5"
                          style={{ color: '#CBD5E1', fontSize: '0.82rem' }}
                        >
                          <Clock size={15} className="flex-shrink-0" />
                          <span>Lead: {item.mobilizationLeadTime}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Thumbnail Gallery Switcher Strip (if multiple photos exist) */}
            {item.photos && item.photos.length > 1 && (
              <div
                className="px-4 py-2 border-bottom d-flex align-items-center gap-2 overflow-x-auto"
                style={{ backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' }}
              >
                <span className="text-secondary small fw-medium me-1" style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                  Photos:
                </span>
                {item.photos.map((pUrl, pIdx) => {
                  const isSelected = pUrl === activePhoto;
                  const isCrew = item.category === 'crew';
                  return (
                    <button
                      key={pIdx}
                      type="button"
                      className={`border rounded-2 p-0 overflow-hidden flex-shrink-0 transition-all ${isSelected ? 'border-primary ring-2 ring-primary shadow-xs' : 'border-secondary-subtle opacity-75 hover-opacity-100'
                        }`}
                      style={{
                        width: isCrew ? '42px' : '56px',
                        height: isCrew ? '42px' : '36px',
                        aspectRatio: isCrew ? '1 / 1' : '16 / 9',
                        backgroundColor: '#0B1B2B',
                      }}
                      onClick={() => setSelectedPhotoUrl(pUrl)}
                      title={`View photo #${pIdx + 1}`}
                    >
                      <img src={pUrl} alt="" className="w-100 h-100 object-fit-cover" />
                    </button>
                  );
                })}
              </div>
            )}

            {/* Description & KPI Metrics Section */}
            <div
              className="p-4 border-bottom"
              style={{
                backgroundColor: '#F8FAFC',
                borderBottomColor: '#E2E8F0',
              }}
            >
              <p
                className="text-secondary mb-3.5"
                style={{ color: '#334155', lineHeight: '1.6', fontSize: '0.88rem' }}
              >
                {item.shortDescription}
              </p>

              <div className="row g-3">
                <div className="col-12 col-sm-4">
                  <div
                    className="p-3 bg-white border h-100 shadow-2xs rounded-2"
                    style={{ borderColor: '#E2E8F0' }}
                  >
                    <div
                      className="text-secondary text-uppercase fw-semibold mb-1"
                      style={{ fontSize: '0.68rem', color: '#64748B', letterSpacing: '0.04em' }}
                    >
                      Compliance Score
                    </div>
                    <div
                      className="fw-bold font-mono-code"
                      style={{ fontSize: '0.95rem', color: '#0B1B2B' }}
                    >
                      {item.complianceReadinessScore === null
                        ? formatReadinessScore(null)
                        : `${formatReadinessScore(item.complianceReadinessScore)} Verified`}
                    </div>
                  </div>
                </div>

                {item.metrics.slice(0, 2).map((m, idx) => (
                  <div key={idx} className="col-12 col-sm-4">
                    <div
                      className="p-3 bg-white border h-100 shadow-2xs rounded-2"
                      style={{ borderColor: '#E2E8F0' }}
                    >
                      <div
                        className="text-secondary text-uppercase fw-semibold mb-1"
                        style={{ fontSize: '0.68rem', color: '#64748B', letterSpacing: '0.04em' }}
                      >
                        {m.label}
                      </div>
                      <div
                        className="fw-bold font-mono-code"
                        style={{ fontSize: '0.95rem', color: '#0B1B2B', wordBreak: 'break-word' }}
                      >
                        {m.value}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Nav Tabs Navigation Bar */}
            <div
              className="px-4 pt-2.5 border-bottom bg-white"
              style={{ borderBottomColor: '#E2E8F0' }}
            >
              <ul className="nav nav-tabs border-0 gap-2">
                <li className="nav-item">
                  <button
                    type="button"
                    className={`nav-link border-0 px-3.5 py-2.5 small fw-medium ${activeTab === 'specs'
                      ? 'active border-bottom border-primary border-3 fw-bold text-primary'
                      : 'text-secondary'
                      }`}
                    style={{
                      fontSize: '0.84rem',
                      color: activeTab === 'specs' ? '#0B1B2B' : '#64748B',
                      borderBottomColor: activeTab === 'specs' ? '#0B1B2B' : 'transparent',
                    }}
                    onClick={() => setActiveTab('specs')}
                  >
                    Specifications
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    type="button"
                    className={`nav-link border-0 px-3.5 py-2.5 small fw-medium ${activeTab === 'capabilities'
                      ? 'active border-bottom border-primary border-3 fw-bold text-primary'
                      : 'text-secondary'
                      }`}
                    style={{
                      fontSize: '0.84rem',
                      color: activeTab === 'capabilities' ? '#0B1B2B' : '#64748B',
                      borderBottomColor: activeTab === 'capabilities' ? '#0B1B2B' : 'transparent',
                    }}
                    onClick={() => setActiveTab('capabilities')}
                  >
                    Capabilities
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    type="button"
                    className={`nav-link border-0 px-3.5 py-2.5 small fw-medium ${activeTab === 'compliance'
                      ? 'active border-bottom border-primary border-3 fw-bold text-primary'
                      : 'text-secondary'
                      }`}
                    style={{
                      fontSize: '0.84rem',
                      color: activeTab === 'compliance' ? '#0B1B2B' : '#64748B',
                      borderBottomColor: activeTab === 'compliance' ? '#0B1B2B' : 'transparent',
                    }}
                    onClick={() => setActiveTab('compliance')}
                  >
                    Compliance
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    type="button"
                    className={`nav-link border-0 px-3.5 py-2.5 small fw-medium ${activeTab === 'provider'
                      ? 'active border-bottom border-primary border-3 fw-bold text-primary'
                      : 'text-secondary'
                      }`}
                    style={{
                      fontSize: '0.84rem',
                      color: activeTab === 'provider' ? '#0B1B2B' : '#64748B',
                      borderBottomColor: activeTab === 'provider' ? '#0B1B2B' : 'transparent',
                    }}
                    onClick={() => setActiveTab('provider')}
                  >
                    Provider
                  </button>
                </li>
              </ul>
            </div>

            {/* Tab Contents Area */}
            <div className="p-3" style={{ minHeight: '240px' }}>
              {activeTab === 'specs' && (
                <div>
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <h6 className="fw-bold mb-0" style={{ fontSize: '0.92rem', color: '#0B1B2B' }}>
                      Technical Specifications
                    </h6>
                    <span className="text-muted small" style={{ fontSize: '0.78rem' }}>
                      {item.detailedSpecs.length} Verified Parameters
                    </span>
                  </div>
                  <div className="row g-3">
                    {item.detailedSpecs.map((spec, i) => (
                      <div key={i} className="col-12 col-md-6">
                        <div
                          className="rounded-2 border h-100"
                          style={{
                            backgroundColor: '#F8FAFC',
                            borderColor: '#E2E8F0',
                            padding: '14px 18px',
                          }}
                        >
                          <div
                            className="text-secondary small fw-medium mb-1"
                            style={{ fontSize: '0.78rem', color: '#64748B' }}
                          >
                            {spec.label}
                          </div>
                          <div
                            className="fw-semibold font-mono-code"
                            style={{ fontSize: '0.88rem', color: '#0F172A', wordBreak: 'break-word' }}
                          >
                            {spec.value}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'capabilities' && (
                <div>
                  <h6 className="fw-bold mb-3" style={{ fontSize: '0.92rem', color: '#0B1B2B' }}>
                    Operational Capabilities & Scope
                  </h6>
                  <div className="d-flex flex-column gap-3">
                    {item.operationalCapabilities.map((cap, i) => (
                      <div
                        key={i}
                        className="d-flex align-items-start gap-3.5 p-4 rounded-2 border"
                        style={{
                          backgroundColor: '#F8FAFC',
                          borderColor: '#E2E8F0',
                          padding: '16px 20px',
                        }}
                      >
                        <CheckCircle2 size={18} className="text-success flex-shrink-0 mt-0.5" />
                        <span className="small text-dark" style={{ fontSize: '0.88rem', lineHeight: '1.5', color: '#334155' }}>
                          {cap}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'compliance' && (
                <div>
                  <h6 className="fw-bold mb-3" style={{ fontSize: '0.92rem', color: '#0B1B2B' }}>
                    Statutory & Class Compliance Accreditations
                  </h6>
                  <div className="d-flex flex-column gap-3 mb-3.5">
                    {item.certifications.map((cert, i) => (
                      <div
                        key={i}
                        className="d-flex align-items-center justify-content-between rounded-2 border"
                        style={{
                          backgroundColor: '#F8FAFC',
                          borderColor: '#E2E8F0',
                          padding: '16px 20px',
                        }}
                      >
                        <div className="d-flex align-items-center gap-3.5 min-w-0 pe-3">
                          <ShieldCheck size={20} className="text-primary flex-shrink-0" />
                          <span className="fw-semibold text-dark text-truncate" style={{ fontSize: '0.88rem', color: '#0B1B2B' }}>
                            {cert}
                          </span>
                        </div>
                        <span
                          className="badge rounded-pill px-3 py-1.5 flex-shrink-0"
                          style={{
                            backgroundColor: '#DCFCE7',
                            color: '#15803D',
                            border: '1px solid #BBF7D0',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                          }}
                        >
                          Verified
                        </span>
                      </div>
                    ))}
                  </div>
                  <div
                    className="text-muted small mt-3"
                    style={{
                      fontSize: '0.82rem',
                      lineHeight: '1.5',
                      color: '#64748B',
                    }}
                  >
                    All listed certificates and documentation are subject to MAP automated verification against IACS standards.
                  </div>
                </div>
              )}

              {activeTab === 'provider' && (
                <div>
                  <h6 className="fw-bold mb-3" style={{ fontSize: '0.92rem', color: '#0B1B2B' }}>
                    Service Provider Organization & Operations Desk
                  </h6>
                  <div
                    className="card p-4 border mb-3 rounded-2 shadow-2xs"
                    style={{ borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' }}
                  >
                    <div className="d-flex align-items-center gap-3.5 mb-3.5">
                      {orgInfo.logoUrl ? (
                        <img
                          src={orgInfo.logoUrl}
                          alt={orgInfo.name}
                          className="rounded-2 border flex-shrink-0"
                          style={{ width: '48px', height: '48px', objectFit: 'cover', borderColor: '#E2E8F0' }}
                        />
                      ) : (
                        <div
                          className="rounded-2 d-flex align-items-center justify-content-center fw-bold shadow-2xs flex-shrink-0"
                          style={{
                            width: '48px',
                            height: '48px',
                            background: orgInfo.badgeBg,
                            color: orgInfo.badgeColor,
                            fontSize: '1rem',
                          }}
                        >
                          {orgInfo.initials}
                        </div>
                      )}
                      <div className="d-flex flex-column min-w-0">
                        <span
                          className="fw-bold text-dark text-truncate"
                          style={{ fontSize: '1.05rem', color: '#0B1B2B' }}
                        >
                          {item.providerOrg}
                        </span>
                        <span className="text-secondary small mt-0.5" style={{ color: '#64748B', fontSize: '0.8rem' }}>
                          Verified Regional Marine Services Provider
                        </span>
                      </div>
                    </div>

                    <hr className="my-2.5 border-secondary opacity-25" />

                    <div className="d-flex align-items-center gap-3 pt-2">
                      <img
                        src={item.contact.avatarUrl}
                        alt={item.contact.name}
                        className="rounded-circle border flex-shrink-0"
                        style={{ width: '42px', height: '42px', objectFit: 'cover', borderColor: '#E2E8F0' }}
                      />
                      <div className="d-flex flex-column min-w-0">
                        <span className="fw-semibold text-dark" style={{ fontSize: '0.88rem', color: '#0B1B2B' }}>
                          {item.contact.name}
                        </span>
                        <span className="text-secondary small mt-0.5" style={{ fontSize: '0.78rem', color: '#64748B' }}>
                          {item.contact.role}
                        </span>
                      </div>
                    </div>

                    <div className="row g-2.5 mt-3.5">
                      {item.contact.email && (
                        <div className="col-12 col-md-6">
                          <a
                            href={`mailto:${item.contact.email}`}
                            className="btn btn-sm btn-outline-secondary d-flex align-items-center justify-content-center gap-2 w-100 font-mono-code text-truncate px-3"
                            style={{ fontSize: '0.82rem', height: '38px' }}
                          >
                            <Mail size={15} className="flex-shrink-0" />
                            <span className="text-truncate">{item.contact.email}</span>
                          </a>
                        </div>
                      )}
                      {item.contact.phone && (
                        <div className="col-12 col-md-6">
                          <a
                            href={`tel:${item.contact.phone}`}
                            className="btn btn-sm btn-outline-secondary d-flex align-items-center justify-content-center gap-2 w-100 font-mono-code text-truncate px-3"
                            style={{ fontSize: '0.82rem', height: '38px' }}
                          >
                            <Phone size={15} className="flex-shrink-0" />
                            <span className="text-truncate">{item.contact.phone}</span>
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {inquirySent && (
              <div
                className="mx-4 mb-3 p-3 rounded-2 d-flex align-items-center gap-2 text-success small border"
                style={{
                  backgroundColor: '#F0FDF4',
                  borderColor: '#BBF7D0',
                  color: '#15803D',
                  fontSize: '0.82rem',
                }}
              >
                <CheckCircle2 size={16} className="flex-shrink-0" />
                <span>Your request has been dispatched to {item.providerOrg}. They will contact you shortly.</span>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div
            className="modal-footer d-flex flex-wrap align-items-center justify-content-between px-4 py-3 border-top flex-shrink-0"
            style={{
              backgroundColor: '#F8FAFC',
              borderColor: '#E2E8F0',
            }}
          >
            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1.5 px-3 py-1.5"
                onClick={handleExportDossierPdf}
                title="Download technical asset dossier as PDF"
                style={{ fontSize: '0.82rem', height: '34px' }}
              >
                <Download size={14} />
                <span>Export Dossier</span>
              </button>
            </div>

            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary px-3 py-1.5"
                onClick={onClose}
                style={{ fontSize: '0.82rem', height: '34px' }}
              >
                Close
              </button>
              {/* wrapper carries the tooltip because a disabled button does not fire hover events */}
              <span
                className="d-inline-flex"
                title={charterDisabledReason}
                tabIndex={charterDisabledReason ? 0 : undefined}
              >
                <button
                  type="button"
                  className="btn btn-sm btn-primary px-3.5 py-1.5 fw-medium text-white"
                  disabled={Boolean(charterDisabledReason)}
                  aria-describedby={charterDisabledReason ? 'marketplace-charter-reason' : undefined}
                  onClick={() => {
                    if (onCharter) {
                      onCharter(item);
                    } else {
                      handleSendInquiry();
                    }
                  }}
                  style={{
                    backgroundColor: '#0B1B2B',
                    borderColor: '#0B1B2B',
                    fontSize: '0.82rem',
                    height: '34px',
                    pointerEvents: charterDisabledReason ? 'none' : undefined,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#1E3A5F';
                    e.currentTarget.style.borderColor = '#1E3A5F';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#0B1B2B';
                    e.currentTarget.style.borderColor = '#0B1B2B';
                  }}
                >
                  {getMarketplaceCharterLabel(item)}
                </button>
                {charterDisabledReason && (
                  <span id="marketplace-charter-reason" className="visually-hidden">
                    {charterDisabledReason}
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

