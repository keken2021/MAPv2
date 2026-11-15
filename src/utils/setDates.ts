/*
  file summary: pure functions for reading assurance set dates, deadline history, and project window timings.
  responsibilities: provides single source of truth for startDate, endDate, deadline, dateHistory, and project window derivations.
  role in system: replaces retired date and project window duplicate fields under ADR 0042.
*/

import type { Project } from '../types/project';
import type { TargetDateChangeRecord } from '../types/assurance';
import { getProjectClientOrganization } from './projectHelpers';

export interface SetDatesInput {
  startDate?: string;
  endDate?: string;
  deadline?: string;
  dateHistory?: TargetDateChangeRecord[];
  /* legacy fields during migration */
  charterWindowStart?: string;
  charterWindowEnd?: string;
  complianceDeadline?: string;
  targetDate?: string;
  targetDateHistory?: TargetDateChangeRecord[];
  projectId?: string;
  projectName?: string;
  projectWindowStart?: string;
  projectWindowEnd?: string;
}

/**
 * Returns the start date of the assurance set contract period.
 */
export function getSetStartDate(set?: SetDatesInput | null): string {
  if (!set) return '';
  return set.startDate || set.charterWindowStart || '';
}

/**
 * Returns the end date of the assurance set contract period.
 */
export function getSetEndDate(set?: SetDatesInput | null): string {
  if (!set) return '';
  return set.endDate || set.charterWindowEnd || '';
}

/**
 * Returns the compliance deadline of the assurance set (on or before startDate).
 */
export function getSetDeadline(set?: SetDatesInput | null): string {
  if (!set) return '';
  return set.deadline || set.targetDate || set.complianceDeadline || '';
}

/**
 * Returns the ledger of historical date adjustments on the assurance set and its tasks.
 */
export function getSetDateHistory(set?: SetDatesInput | null): TargetDateChangeRecord[] {
  if (!set) return [];
  if (Array.isArray(set.targetDateHistory) && set.targetDateHistory.length > 0) {
    return set.targetDateHistory;
  }
  return set.dateHistory || [];
}

/**
 * Returns the project name for an assurance set by reading from the linked project.
 */
export function getSetProjectName(set?: SetDatesInput | null, projects?: Project[]): string {
  if (!set) return '';
  if (set.projectId && projects) {
    const project = projects.find((p) => p.id === set.projectId);
    if (project?.name) return project.name;
  }
  return set.projectName || '';
}

/**
 * Returns the active field operations window of the project linked to the assurance set.
 */
export function getSetProjectWindow(
  set?: SetDatesInput | null,
  projects?: Project[],
): { start?: string; end?: string } {
  if (!set) return {};
  if (set.projectId && projects) {
    const project = projects.find((p) => p.id === set.projectId);
    if (project) {
      return {
        start: project.charterWindowStart,
        end: project.charterWindowEnd,
      };
    }
  }
  return {
    start: set.projectWindowStart,
    end: set.projectWindowEnd,
  };
}

/**
 * Returns the owning client organization of the project linked to the assurance set.
 */
export function getSetProjectClient(
  set?: SetDatesInput | null,
  projects?: Project[],
): string | undefined {
  if (!set?.projectId || !projects) return undefined;
  const project = projects.find((p) => p.id === set.projectId);
  if (!project) return undefined;
  return getProjectClientOrganization(project);
}
