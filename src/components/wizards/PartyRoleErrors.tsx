import React from 'react';

export const PartyRoleErrors: React.FC<{ requestingParty?: string; respondingParty?: string }> = ({
  requestingParty,
  respondingParty,
}) => (
  <>
    {requestingParty && (
      <div className="alert alert-danger py-2 px-3 small mb-3" role="alert" data-testid="error-requesting-party">
        {requestingParty}
      </div>
    )}
    {respondingParty && (
      <div className="alert alert-danger py-2 px-3 small mb-3" role="alert" data-testid="error-responding-party">
        {respondingParty}
      </div>
    )}
  </>
);
