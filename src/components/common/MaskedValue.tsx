/*
  file summary: a restricted crew value shown masked, with a Reveal for the owning organization's administrators.
  responsibilities: masks the value by default, offers Reveal only to a permitted role, and writes an audit record on every reveal.
  role in system: used by CrewDetailView.tsx; gap review finding G12.
*/

import React, { useState } from 'react';
import { Eye } from 'lucide-react';
import { useMapStore } from '../../store/useMapStore';
import { canRevealCrewData, maskRestrictedValue } from '../../utils/restrictedData';

interface MaskedValueProps {
  value: string | undefined;
  /* what the value is, for the audit record, e.g. "Passport No." */
  label: string;
  /* the organization that owns the crew record */
  ownerOrganization: string | undefined;
  /* the record named in the audit trail, e.g. "Crew CREW-101" */
  targetAsset: string;
  className?: string;
}

/**
  what: renders a restricted value masked, with an audited Reveal for the owning organization's administrators.
  how: reads the role and organization from the store; Reveal logs "Revealed Restricted Crew Data" before showing the value.
  with what file: src/components/common/MaskedValue.tsx used by CrewDetailView.tsx.
*/
export const MaskedValue: React.FC<MaskedValueProps> = ({ value, label, ownerOrganization, targetAsset, className }) => {
  const { activePersona, activeDemoOrganization, logAuditEvent } = useMapStore();
  const [isRevealed, setIsRevealed] = useState(false);
  const canReveal = canRevealCrewData(activePersona, activeDemoOrganization, ownerOrganization);

  if (!value) return <span className={className}>Not recorded</span>;

  const handleReveal = () => {
    logAuditEvent({
      action: 'Revealed Restricted Crew Data',
      targetAsset,
      justificationNotes: `${label} revealed.`,
    });
    setIsRevealed(true);
  };

  return (
    <span className={`d-inline-flex align-items-center gap-2 ${className ?? ''}`}>
      <span className="font-mono-code" aria-label={isRevealed ? undefined : `${label} masked`}>
        {isRevealed ? value : maskRestrictedValue(value)}
      </span>
      {canReveal && !isRevealed && (
        <button
          type="button"
          className="btn btn-link btn-sm p-0 d-inline-flex align-items-center gap-1"
          style={{ fontSize: '0.75rem' }}
          onClick={handleReveal}
          aria-label={`Reveal ${label}`}
        >
          <Eye size={12} /> Reveal
        </button>
      )}
    </span>
  );
};
