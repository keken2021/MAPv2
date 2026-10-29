import React from 'react';
import { getStatusDisplayLabel } from '../../utils/formatters';

export type StatusTone = 'success' | 'warning' | 'danger' | 'neutral';

export const STATUS_TONE_MAP: Record<string, StatusTone> = {
  // Success
  'Available': 'success',
  'Available Immediately': 'success',
  'Available Next Week': 'success',
  'Available for Campaign': 'success',
  'Available for Charter': 'success',
  'Available for Lease': 'success',
  'Available for Mobilization': 'success',
  'Available on Call': 'success',
  'Compliant': 'success',
  'Fully Compliant': 'success',
  'Completed': 'success',
  'Verified': 'success',
  'Verified & Closed': 'success',
  'Satisfactory': 'success',
  'Approved': 'success',
  'Certified': 'success',
  'Active': 'success',
  'Valid': 'success',
  'In Operations': 'success',
  'In Stock / Ready': 'success',
  'Mobilization Ready': 'success',
  'Ready for Charter': 'success',
  'Tested externally': 'success',
  'Used and tested by several entities over time': 'success',
  'actioned': 'success',

  // Warning
  'In Progress': 'warning',
  'Assurance In Progress': 'warning',
  'Composing': 'warning',
  'Draft': 'warning',
  'Pending': 'warning',
  'Pending Invitation': 'warning',
  'Initiated': 'warning',
  'Validation': 'warning',
  'Verification': 'warning',
  'Inspection': 'warning',
  'Approval': 'warning',
  'Expiring': 'warning',
  'Expiring Soon': 'warning',
  'Expiring < 60 Days': 'warning',
  'Expiring < 6 Mos': 'warning',
  'Under Re-Inspection': 'warning',
  'Re-Inspection': 'warning',
  'Partially Compliant': 'warning',
  'Partially Closed': 'warning',
  'Overdue': 'warning',
  'Under Maintenance': 'warning',
  'In Transit': 'warning',
  'Standby': 'warning',
  'Correction Requested': 'warning',
  'Returned for Correction': 'warning',
  'Observation': 'warning',
  'Submitted and tested': 'warning',
  'unread': 'warning',

  // Danger
  'Non-Compliant': 'danger',
  'Document Deficient': 'danger',
  'Expired': 'danger',
  'Rejected': 'danger',
  'Cancelled': 'danger',
  'Rectification Required': 'danger',
  'Unavailable': 'danger',
  'Mismatch': 'danger',
  'Mismatch/Exception': 'danger',
  'Suspended': 'danger',
  'Withdrawn': 'danger',

  // Neutral
  'Closed': 'neutral',
  'Unknown': 'neutral',
  'Not assessed': 'neutral',
  'On Charter': 'neutral',
  'Under Charter': 'neutral',
  'Port Stay': 'neutral',
  'Dry Docking': 'neutral',
  'Lay-up': 'neutral',
  'Decommissioned': 'neutral',
  'Inactive': 'neutral',
  'Superseded': 'neutral',
  'Uploaded, not externally verified': 'neutral',
  'read': 'neutral',
};

export function getStatusTone(value: string): StatusTone {
  if (!value) return 'neutral';
  if (STATUS_TONE_MAP[value]) {
    return STATUS_TONE_MAP[value];
  }

  const display = getStatusDisplayLabel(value);
  if (STATUS_TONE_MAP[display]) {
    return STATUS_TONE_MAP[display];
  }

  const lower = value.toLowerCase();
  if (
    lower.includes('non-compliant') ||
    lower.includes('deficient') ||
    lower.includes('reject') ||
    lower.includes('cancel') ||
    lower.includes('expired') ||
    lower.includes('fail')
  ) {
    return 'danger';
  }

  if (
    lower.includes('compliant') ||
    lower.includes('verif') ||
    lower.includes('approv') ||
    lower.includes('ready') ||
    lower.includes('active') ||
    lower.includes('avail')
  ) {
    return 'success';
  }

  if (
    lower.includes('pend') ||
    lower.includes('progress') ||
    lower.includes('expir') ||
    lower.includes('warn') ||
    lower.includes('draft') ||
    lower.includes('correct')
  ) {
    return 'warning';
  }

  return 'neutral';
}

export interface StatusBadgeProps {
  value: string;
  tone?: StatusTone;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  value,
  tone,
  className = '',
}) => {
  const displayLabel = getStatusDisplayLabel(value);
  const resolvedTone = tone ?? getStatusTone(value);

  return (
    <span
      className={`map-status-badge map-status-badge--${resolvedTone} ${className}`}
      data-tone={resolvedTone}
      data-status={value}
    >
      {displayLabel}
    </span>
  );
};

