/* 
  file summary: readiness gauge component rendering visual compliance percentage indicators.
  responsibilities: presents circular or bar readiness meters with color thresholds.
  role in system: used in dashboard, vessel cards, assurance set detail, and approver dashboard.
*/

import React from 'react';
import { getReadinessTone, getReadinessBgClass, getReadinessTextClass } from '../../config/readinessScale';

interface ReadinessGaugeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}

export const ReadinessGauge: React.FC<ReadinessGaugeProps> = ({ score, size = 'md' }) => {
  const tone = getReadinessTone(score);
  const bgClass = getReadinessBgClass(score);
  const textClass = getReadinessTextClass(score);

  if (size === 'lg') {
    return (
      <div className="text-center p-4 bg-light border border-secondary rounded shadow-sm" data-tone={tone}>
        <div className={`display-4 fw-bold ${textClass} font-mono-code`}>
          {score}%
        </div>
        <div className="progress mt-3" style={{ height: '8px', backgroundColor: '#e2e8f0' }}>
          <div
            className={`progress-bar ${bgClass}`}
            role="progressbar"
            style={{ width: `${score}%` }}
            aria-valuenow={score}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="d-flex align-items-center gap-3 w-100" data-tone={tone}>
      <div className="progress flex-grow-1" style={{ height: '8px', backgroundColor: '#e2e8f0' }}>
        <div
          className={`progress-bar ${bgClass}`}
          role="progressbar"
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={`fw-bold font-mono-code small ${textClass}`}>
        {score}%
      </span>
    </div>
  );
};

