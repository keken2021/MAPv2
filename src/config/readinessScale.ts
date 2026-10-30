export type ReadinessTone = 'danger' | 'warning' | 'success';

export interface ReadinessCutoffs {
  readonly warning: number;
  readonly success: number;
}

// Proposed readiness thresholds: red below 50, amber 50 to 84, green 85+
export const READINESS_CUTOFFS: ReadinessCutoffs = {
  warning: 50,
  success: 85,
};

export function getReadinessTone(score: number): ReadinessTone {
  if (score >= READINESS_CUTOFFS.success) return 'success';
  if (score >= READINESS_CUTOFFS.warning) return 'warning';
  return 'danger';
}

export function getReadinessBgClass(score: number): string {
  const tone = getReadinessTone(score);
  return `bg-${tone}`;
}

export function getReadinessTextClass(score: number): string {
  const tone = getReadinessTone(score);
  return `text-${tone}`;
}
