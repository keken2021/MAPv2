/* 
  file summary: dedicated vessel capa tracking and re-inspection management table view in light theme.
  responsibilities: presents vessel corrective actions (capa) queue as a clean, neat, sortable master table and launches CapaReinspectionDrawer for detailed findings and evidence.
  role in system: full-page view rendered when clicking capa tracker in sidebar or inspector workspace (/capa or /capa/vesselName).
*/

import React from 'react';
import { CapaTable } from '../components/tables/CapaTable';

interface CapaManagementViewProps {
  vesselName?: string;
}

/**
  what: renders clean vessel capa master table.
  how: delegates to shared CapaTable.
  with what file: src/views/CapaManagementView.tsx loaded by App.tsx when currentHashView is capa or capas.
*/
export const CapaManagementView: React.FC<CapaManagementViewProps> = ({ vesselName }) => (
  <CapaTable vesselName={vesselName} />
);
