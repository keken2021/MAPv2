/* 
  file summary: Audit Trail page view displaying searchable regulatory event logs in minimalist light theme.
  responsibilities: presents chronological audit history with user roles, field deltas, event statistics, and search filters with high contrast text.
  role in system: primary audit workspace accessible via sidebar (/audit).
*/

import React from 'react';
import { AuditTrailTable } from '../components/tables/AuditTrailTable';

/**
  what: renders the full-page Audit Trail view.
  how: delegates to shared AuditTrailTable.
  with what file: src/views/AuditTrailView.tsx loaded by App.tsx router.
*/
export const AuditTrailView: React.FC = () => <AuditTrailTable />;
