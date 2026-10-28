/*
  file summary: tests that a task keeps its section and predecessor, and that section counts flag heavy sections.
  responsibilities: covers placeTasksInSections and summarizeTaskSections, including the ten-section inspection set.
  role in system: covers src/utils/assuranceTemplates.ts and src/utils/readinessHelpers.ts.
*/

import { describe, expect, it } from 'vitest';
import { AssuranceRequirement } from '../types/assurance';
import { placeTasksInSections } from '../utils/assuranceTemplates';
import { listOpenTasksInSection, openTaskStatusLabel, summarizeTaskSections } from '../utils/readinessHelpers';
import { MOCK_ASSURANCE_SETS } from '../store/mockData';

function task(id: string, category: string): AssuranceRequirement {
  return {
    id,
    category,
    title: id,
    isMandatory: true,
    isFulfilled: false,
    ocrConfidence: 0,
    verifierStatus: 'Pending',
  };
}

describe('task sections and predecessors', () => {
  it('keeps a section and predecessor already stored on a task', () => {
    const placed = placeTasksInSections([
      {
        ...task('TASK-2', 'Statutory Certificate'),
        sectionId: 'sec-class',
        predecessorId: 'TASK-1',
      },
    ]);

    expect(placed.requirements[0].sectionId).toBe('sec-class');
    expect(placed.requirements[0].predecessorId).toBe('TASK-1');
    expect(placed.sections.map((section) => section.id)).toEqual(['sec-class']);
  });

  it('places tasks that share a category in one section and chains one predecessor', () => {
    const placed = placeTasksInSections([
      task('TASK-A', 'Statutory Certificate'),
      task('TASK-B', 'Statutory Certificate'),
    ]);

    expect(placed.sections).toHaveLength(1);
    expect(placed.requirements[0].sectionId).toBe(placed.requirements[1].sectionId);
    expect(placed.requirements[0].predecessorId).toBeUndefined();
    expect(placed.requirements[1].predecessorId).toBe('TASK-A');
  });

  it('counts remaining tasks and certificates and flags only the heavy sections', () => {
    const set = MOCK_ASSURANCE_SETS.find((item) => item.id === 'AS-2026-003');
    expect(set?.sections).toHaveLength(10);

    const summary = summarizeTaskSections(set!);
    expect(summary).toHaveLength(10);
    expect(summary.filter((section) => section.heavy).map((section) => section.name)).toEqual([
      'Class',
      'Safety equipment',
      'Operations',
    ]);

    const classSection = summary.find((section) => section.name === 'Class');
    expect(classSection?.remainingTasks).toBe(3);
    expect(classSection?.remainingCertificates).toBe(3);

    const registry = summary.find((section) => section.name === 'Registry');
    expect(registry?.remainingTasks).toBe(1);
    expect(registry?.remainingCertificates).toBe(1);
    expect(registry?.heavy).toBe(false);

    const berthing = set?.requirements.find((item) => item.id === 'REQ-sec-berthing-1');
    expect(berthing?.sectionId).toBe('sec-berthing');
    expect(berthing?.predecessorId).toBe('REQ-sec-emergency-1');
  });

  it('lists the open tasks behind a section count, with a plain status', () => {
    const set = MOCK_ASSURANCE_SETS.find((item) => item.id === 'AS-2026-003')!;
    const summary = summarizeTaskSections(set);

    for (const section of summary) {
      const open = listOpenTasksInSection(set, section.id);
      expect(open).toHaveLength(section.remainingTasks);
    }

    const registryTask = listOpenTasksInSection(set, summary.find((s) => s.name === 'Registry')!.id)[0];
    expect(['Not submitted', 'Awaiting verification', 'Correction requested', 'Rejected']).toContain(
      openTaskStatusLabel(registryTask),
    );
  });
});
