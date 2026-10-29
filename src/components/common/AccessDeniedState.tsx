import React from 'react';
import { Lock } from 'lucide-react';

interface AccessDeniedStateProps {
  onBack: () => void;
}

/**
  what: the content shown when the signed-in role opens a route it may not see.
  how: a lock, one sentence, and a button back to the dashboard. It renders none of the blocked page.
  with what file: src/components/common/AccessDeniedState.tsx used by App.tsx.
*/
export const AccessDeniedState: React.FC<AccessDeniedStateProps> = ({ onBack }) => (
  <div className="d-flex flex-column align-items-center justify-content-center text-center py-5 gap-3">
    <Lock size={40} className="text-secondary" aria-hidden="true" />
    <h1 className="h4 fw-semibold text-dark mb-0">You don't have access to this page</h1>
    <button type="button" className="btn btn-primary" onClick={onBack}>
      Back to Dashboard
    </button>
  </div>
);
