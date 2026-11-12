import React from 'react';
import { AlertCircle, Info } from 'lucide-react';

export interface FindingsApprovalNoticeProps {
  openFindingsCount: number;
  /** false on a set with no inspection: the findings are only flagged */
  blocking: boolean;
}

/** Tells the approver whether open findings block approval or are only flagged; renders nothing with no findings. */
export const FindingsApprovalNotice: React.FC<FindingsApprovalNoticeProps> = ({ openFindingsCount, blocking }) => {
  if (openFindingsCount <= 0) return null;
  const plural = openFindingsCount !== 1;

  if (blocking) {
    return (
      <div
        className="alert alert-warning p-3 mb-0 small text-danger fw-semibold d-flex align-items-center gap-2"
        role="alert"
      >
        <AlertCircle size={15} className="flex-shrink-0" />
        <span>
          Cannot approve: {openFindingsCount} open {plural ? 'findings remain' : 'finding remains'}. Resolve findings
          before approval.
        </span>
      </div>
    );
  }

  return (
    <div className="alert alert-secondary p-3 mb-0 small d-flex align-items-center gap-2" role="status">
      <Info size={15} className="flex-shrink-0" />
      <span>
        {openFindingsCount} open {plural ? 'findings' : 'finding'} flagged. Not blocking: this set has no inspection.
      </span>
    </div>
  );
};

export default FindingsApprovalNotice;
