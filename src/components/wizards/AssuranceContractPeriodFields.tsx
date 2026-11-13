/*
  file summary: Contract Period and Compliance Deadline fields for the assurance set wizard.
  responsibilities: renders Contract Period Start, End, Planned Charter Date, and Compliance Deadline inputs with project bounds, project window hint, and window ended feedback.
  role in system: extracted from CreateAssuranceSetView per Map Design System §12.
*/

import React from 'react';
import type { ProjectDateBounds } from '../../utils/projectHelpers';

export interface AssuranceContractPeriodFieldsProps {
  startDate: string;
  endDate: string;
  plannedCharterDate: string;
  complianceDeadline: string;
  fieldErrors: Record<string, string>;
  initialPeriod: { start: string; end: string };
  projectBounds: ProjectDateBounds;
  projectWindow?: { start?: string; end?: string };
  isWindowEnded?: boolean;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onPlannedCharterDateChange: (value: string) => void;
  onComplianceDeadlineChange: (value: string) => void;
}

export const AssuranceContractPeriodFields: React.FC<AssuranceContractPeriodFieldsProps> = ({
  startDate,
  endDate,
  plannedCharterDate,
  complianceDeadline,
  fieldErrors,
  initialPeriod,
  projectBounds,
  projectWindow,
  isWindowEnded,
  onStartDateChange,
  onEndDateChange,
  onPlannedCharterDateChange,
  onComplianceDeadlineChange,
}) => {
  return (
    <>
      <div className="col-12 col-md-3">
        <label className="form-label text-secondary small fw-semibold" htmlFor="grid-charter-start">
          Contract Period Start <span className="text-danger">*</span>
        </label>
        <input
          id="grid-charter-start"
          type="date"
          placeholder={initialPeriod.start}
          className={`form-control bg-white text-dark border-secondary-subtle font-mono-code${fieldErrors.startDate ? ' is-invalid border-danger' : ''}`}
          value={startDate}
          min={projectBounds.min || undefined}
          max={projectBounds.max || undefined}
          onChange={(e) => onStartDateChange(e.target.value)}
          required
        />
        {fieldErrors.startDate && (
          <div className="invalid-feedback d-block small mt-1 font-mono-code" style={{ fontSize: '0.75rem' }}>
            {fieldErrors.startDate}
          </div>
        )}
      </div>

      <div className="col-12 col-md-3">
        <label className="form-label text-secondary small fw-semibold" htmlFor="grid-charter-end">
          Contract Period End <span className="text-danger">*</span>
        </label>
        <input
          id="grid-charter-end"
          type="date"
          placeholder={initialPeriod.end}
          className={`form-control bg-white text-dark border-secondary-subtle font-mono-code${fieldErrors.endDate ? ' is-invalid border-danger' : ''}`}
          value={endDate}
          min={startDate || projectBounds.min || undefined}
          max={projectBounds.max || undefined}
          onChange={(e) => onEndDateChange(e.target.value)}
          required
        />
        {fieldErrors.endDate && (
          <div className="invalid-feedback d-block small mt-1 font-mono-code" style={{ fontSize: '0.75rem' }}>
            {fieldErrors.endDate}
          </div>
        )}
      </div>

      <div className="col-12 col-md-3">
        <label className="form-label text-secondary small fw-semibold" htmlFor="grid-planned-charter-date">
          Planned Charter Date <span className="text-secondary fw-normal fs-7">(Optional)</span>
        </label>
        <input
          id="grid-planned-charter-date"
          type="date"
          className="form-control bg-white text-dark border-secondary-subtle font-mono-code"
          value={plannedCharterDate}
          min={projectBounds.min || undefined}
          max={projectBounds.max || undefined}
          onChange={(e) => onPlannedCharterDateChange(e.target.value)}
          aria-describedby="grid-planned-charter-date-help"
        />
        <div id="grid-planned-charter-date-help" className="form-text small">
          Optional planned commencement date for asset chartering.
        </div>
      </div>

      <div className="col-12 col-md-3">
        <label className="form-label text-secondary small fw-semibold" htmlFor="grid-compliance-deadline">
          Compliance Deadline <span className="text-danger">*</span>
        </label>
        <input
          id="grid-compliance-deadline"
          type="date"
          className={`form-control bg-white text-dark border-secondary-subtle font-mono-code${fieldErrors.complianceDeadline ? ' is-invalid border-danger' : ''}`}
          value={complianceDeadline}
          max={startDate || undefined}
          onChange={(e) => onComplianceDeadlineChange(e.target.value)}
          required
          aria-describedby="grid-compliance-deadline-help"
        />
        <div id="grid-compliance-deadline-help" className="form-text small">
          When this assurance set must be complete. On or before the contract start.
        </div>
        {fieldErrors.complianceDeadline && (
          <div className="invalid-feedback d-block small mt-1 font-mono-code" style={{ fontSize: '0.75rem' }}>
            {fieldErrors.complianceDeadline}
          </div>
        )}
      </div>

      {projectWindow?.start && projectWindow?.end && (
        <div className="col-12 pt-0 mt-1">
          <div className="form-text small" data-testid="project-window-hint">
            Project window: {projectWindow.start} to {projectWindow.end}
          </div>
        </div>
      )}

      {isWindowEnded && (
        <div className="col-12 pt-0 mt-1">
          <div className="text-danger small font-mono-code" role="alert" data-testid="project-window-ended-notice">
            This project&apos;s window has ended. Change the project dates first.
          </div>
        </div>
      )}
    </>
  );
};

