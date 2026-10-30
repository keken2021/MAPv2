import React from 'react';
import { formatMaritimeDate } from '../../utils/formatters';
import { EXPIRY_WARNING_DAYS } from '../../utils/expiryPolicy';
import { toIsoLocalDate } from '../../utils/validation';

export type DueState = 'late' | 'expired' | 'expiring_soon' | 'future' | 'closed' | 'none';

export interface DueStatus {
  state: DueState;
  daysLate?: number;
  daysRemaining?: number;
  formattedDate: string;
  label: string;
  textClass: string;
}

export interface DueCellOptions {
  isClosed?: boolean;
  status?: string;
  isExpiry?: boolean;
  today?: Date | string;
  expiryWarningDays?: number;
}

export function getDueStatus(dateStr: string | undefined, options: DueCellOptions = {}): DueStatus {
  if (!dateStr) {
    return {
      state: 'none',
      formattedDate: '',
      label: '—',
      textClass: 'text-muted',
    };
  }

  const parsedDate = new Date(dateStr);
  if (Number.isNaN(parsedDate.getTime())) {
    return {
      state: 'none',
      formattedDate: dateStr,
      label: dateStr,
      textClass: 'text-muted',
    };
  }

  const formattedDate = formatMaritimeDate(dateStr);
  const todayDate = options.today ? (options.today instanceof Date ? options.today : new Date(options.today)) : new Date();
  const todayIso = toIsoLocalDate(todayDate);
  const todayMs = new Date(todayIso).getTime();
  const targetMs = new Date(toIsoLocalDate(parsedDate)).getTime();
  const diffDays = Math.round((todayMs - targetMs) / (1000 * 60 * 60 * 24));

  const isClosed = options.isClosed ?? (
    options.status === 'Verified & Closed' ||
    options.status === 'Closed' ||
    options.status === 'Approved' ||
    options.status === 'Certified'
  );

  if (options.isExpiry) {
    const warningDays = options.expiryWarningDays ?? EXPIRY_WARNING_DAYS;
    if (diffDays > 0) {
      return {
        state: 'expired',
        daysLate: diffDays,
        formattedDate,
        label: 'Expired',
        textClass: 'text-danger fw-semibold',
      };
    }

    const daysRemaining = Math.max(0, -diffDays);
    if (daysRemaining <= warningDays) {
      return {
        state: 'expiring_soon',
        daysRemaining,
        formattedDate,
        label: formattedDate,
        textClass: 'text-warning-emphasis text-warning fw-semibold',
      };
    }

    return {
      state: 'future',
      daysRemaining,
      formattedDate,
      label: formattedDate,
      textClass: 'text-secondary',
    };
  }

  if (isClosed) {
    return {
      state: 'closed',
      formattedDate,
      label: formattedDate,
      textClass: 'text-secondary',
    };
  }

  if (diffDays > 0) {
    const daysLate = Math.max(1, diffDays);
    return {
      state: 'late',
      daysLate,
      formattedDate,
      label: `${daysLate} ${daysLate === 1 ? 'day' : 'days'} late`,
      textClass: 'text-danger fw-semibold',
    };
  }

  return {
    state: 'future',
    formattedDate,
    label: formattedDate,
    textClass: 'text-secondary',
  };
}

export interface DueCellProps extends DueCellOptions {
  date?: string;
  className?: string;
  as?: 'span' | 'td';
}

export const DueCell: React.FC<DueCellProps> = ({
  date,
  isClosed,
  status,
  isExpiry,
  today,
  expiryWarningDays,
  className = '',
  as = 'span',
}) => {
  const statusInfo = getDueStatus(date, {
    isClosed,
    status,
    isExpiry,
    today,
    expiryWarningDays,
  });

  const titleText = statusInfo.state === 'expired'
    ? `Expired (${statusInfo.formattedDate})`
    : statusInfo.state === 'expiring_soon' && statusInfo.daysRemaining !== undefined
    ? `Expires in ${statusInfo.daysRemaining} days`
    : undefined;

  const content = (
    <span className={`${statusInfo.textClass} ${className}`.trim()} title={titleText}>
      {statusInfo.label}
    </span>
  );

  if (as === 'td') {
    return (
      <td className={`small due-cell ${className}`.trim()}>
        {content}
      </td>
    );
  }

  return content;
};
