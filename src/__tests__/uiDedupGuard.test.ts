/*
  file summary: source guard for UI declutter leftovers from shared shells.
  responsibilities: Task 5450 — no input-group-text search chrome, no repeated wizard ids,
  and map-modal-backdrop stays out of list/table screens (lives on Modal and overlay shells).
  role in system: fails when a decluttered anti-pattern is reintroduced.
*/

import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const SRC_ROOT = path.resolve(__dirname, '..');

function walkTsx(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      out.push(...walkTsx(full));
    } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

function rel(file: string): string {
  return path.relative(SRC_ROOT, file).replace(/\\/g, '/');
}

const LIST_SCREENS = [
  'components/tables/CrewTable.tsx',
  'components/tables/UserTable.tsx',
  'components/tables/AuditTrailTable.tsx',
  'views/EquipmentView.tsx',
  'views/ProjectView.tsx',
  'views/MarketplaceView.tsx',
  'views/NotificationsView.tsx',
  'views/CreateProjectView.tsx',
  'views/AuditTrailView.tsx',
];

const WIZARD_VIEWS = [
  'views/CreateProjectView.tsx',
  'views/CreateAssuranceSetView.tsx',
];

const BACKDROP_ALLOWED_PREFIXES = [
  'components/modals/',
  'components/drawers/',
  'components/marketplace/',
  'components/common/FilterModal.tsx',
  'components/common/DocumentCertificatePreview.tsx',
];

describe('UI dedup guard', () => {
  const files = walkTsx(SRC_ROOT);

  it('has no input-group-text search chrome under src', () => {
    const hits = files
      .filter((file) => fs.readFileSync(file, 'utf8').includes('input-group-text'))
      .map(rel);
    expect(hits).toEqual([]);
  });

  it('keeps map-modal-backdrop out of list/table screens and on Modal shells', () => {
    const modalShell = path.join(SRC_ROOT, 'components/modals/Modal.tsx');
    expect(fs.readFileSync(modalShell, 'utf8')).toContain('map-modal-backdrop');

    const listHits = LIST_SCREENS.filter((relative) => {
      const full = path.join(SRC_ROOT, relative);
      return fs.existsSync(full) && fs.readFileSync(full, 'utf8').includes('map-modal-backdrop');
    });
    expect(listHits).toEqual([]);

    const stray = files
      .filter((file) => fs.readFileSync(file, 'utf8').includes('map-modal-backdrop'))
      .map(rel)
      .filter((relative) => !BACKDROP_ALLOWED_PREFIXES.some((prefix) => relative.startsWith(prefix)));

    /* detail/checklist screens still host local overlay markup; list screens must not */
    const unexpected = stray.filter(
      (relative) =>
        !relative.endsWith('VesselDetailView.tsx') &&
        !relative.endsWith('CrewDetailView.tsx') &&
        !relative.endsWith('EquipmentDetailView.tsx') &&
        !relative.endsWith('InspectionChecklistView.tsx'),
    );
    expect(unexpected).toEqual([]);
  });

  it('wizard views do not repeat static id attributes', () => {
    for (const relative of WIZARD_VIEWS) {
      const text = fs.readFileSync(path.join(SRC_ROOT, relative), 'utf8');
      const ids = [...text.matchAll(/\bid=["']([^"']+)["']/g)].map((m) => m[1]);
      const counts = new Map<string, number>();
      for (const id of ids) counts.set(id, (counts.get(id) || 0) + 1);
      const dups = [...counts.entries()].filter(([, n]) => n > 1).map(([id]) => id);
      expect(dups, relative).toEqual([]);
    }
  });
});
