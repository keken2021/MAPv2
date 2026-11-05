/*
  file summary: asset status card showing availability, registration, class, and compliance dimensions.
  responsibilities: displays four status fields with last-updated dates; owner can edit availability.
  role in system: used on vessel and equipment detail pages (FE-5).
*/

import React from 'react';
import { AssetStatusFields, AVAILABILITY_STATUS_OPTIONS, AvailabilityStatus } from '../../types/asset';
import { formatMaritimeDate } from '../../utils/formatters';
import { StatusBadge } from '../common/StatusBadge';

interface AssetStatusCardProps {
  assetType: 'Vessel' | 'Equipment';
  status: AssetStatusFields;
  canEditAvailability: boolean;
  onAvailabilityChange?: (value: AvailabilityStatus) => void;
  /** flag and port of registry, shown in place of the operating status */
  registrationFact?: string;
}

export const AssetStatusCard: React.FC<AssetStatusCardProps> = ({
  assetType,
  status,
  canEditAvailability,
  onAvailabilityChange,
  registrationFact,
}) => {
  const fields: {
    label: string;
    value: string;
    updatedAt: string;
    readOnly: boolean;
    isAvailability?: boolean;
  }[] = [
    {
      label: assetType === 'Vessel' ? 'Charter availability' : 'Availability',
      value: status.availabilityStatus,
      updatedAt: status.availabilityUpdatedAt,
      readOnly: !canEditAvailability,
      isAvailability: true,
    },
    {
      label: 'Registration',
      value: registrationFact || status.registrationStatus,
      updatedAt: status.registrationUpdatedAt,
      readOnly: !canEditAvailability,
    },
    {
      label: 'Class',
      value: status.classStatus,
      updatedAt: status.classStatusUpdatedAt,
      readOnly: !canEditAvailability,
    },
    {
      label: 'Compliance',
      value: status.complianceStatus,
      updatedAt: status.complianceUpdatedAt,
      readOnly: true,
    },
  ];

  return (
    <div className="card map-card-custom mb-3">
      <div className="card-header bg-white border-bottom py-2 px-3">
        <span className="fw-bold text-dark small text-uppercase" style={{ letterSpacing: '0.05em' }}>
          {assetType} Status
        </span>
      </div>
      <div className="card-body p-3">
        <div className="row g-3">
          {fields.map((field) => (
            <div key={field.label} className="col-md-6 col-lg-3">
              <div className="text-secondary small text-uppercase fw-bold mb-1" style={{ fontSize: '0.65rem' }}>
                {field.label}
              </div>
              {field.isAvailability && canEditAvailability && onAvailabilityChange ? (
                <select
                  className="form-select form-select-sm mb-1"
                  aria-label={field.label}
                  value={status.availabilityStatus}
                  onChange={(e) => onAvailabilityChange(e.target.value as AvailabilityStatus)}
                >
                  {AVAILABILITY_STATUS_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : (
                <StatusBadge value={field.value} className="mb-1" />
              )}
              <div className="text-muted" style={{ fontSize: '0.7rem' }}>
                Updated {formatMaritimeDate(field.updatedAt)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
