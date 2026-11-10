import React from 'react';

export const PartyRoleErrors: React.FC<{ requestingParty?: string; respondingParty?: string }> = ({
  requestingParty,
  respondingParty,
}) => (
  <>
    {requestingParty && (
      <div className="text-danger small mb-1 font-mono-code" role="alert" data-testid="error-requesting-party" style={{ fontSize: '0.725rem' }}>
        {requestingParty}
      </div>
    )}
    {respondingParty && (
      <div className="text-danger small mb-1 font-mono-code" role="alert" data-testid="error-responding-party" style={{ fontSize: '0.725rem' }}>
        {respondingParty}
      </div>
    )}
  </>
);
