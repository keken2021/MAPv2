/* 
  file summary: unit test verifying the generic public assurance template definition and multi-scope coverage.
  responsibilities: validates that tmpl-pub-generic-assurance is registered in SUBTYPE_TEMPLATES, covers all operational pillars, and adheres to public naming standards.
  role in system: executed during vitest test runs.
*/

import { describe, it, expect } from 'vitest';
import {
  SUBTYPE_TEMPLATES,
  SUBTYPE_STANDARD_DOCS,
  customRequirementFields,
} from '../utils/assuranceTemplates';

describe('Generic Public Assurance Template', () => {
  const genericTemplate = SUBTYPE_TEMPLATES.find((t) => t.id === 'tmpl-pub-generic-assurance');

  it('is registered as a public multi-scope template in SUBTYPE_TEMPLATES', () => {
    expect(genericTemplate).toBeDefined();
    expect(genericTemplate?.source).toBe('public');
    expect(genericTemplate?.subtype).toBe('All');
    expect(genericTemplate?.name).toContain('(illustrative)');
    expect(genericTemplate?.description).toContain('Template by: [Organization Name]');
  });

  it('recommends standard documents across Vessel, Crew, Activity, and Equipment', () => {
    expect(genericTemplate).toBeDefined();
    const recIds = genericTemplate!.recommendedDocIds;

    const vesselIds = new Set(SUBTYPE_STANDARD_DOCS.Vessel.map((d) => d.id));
    const crewIds = new Set(SUBTYPE_STANDARD_DOCS.Crew.map((d) => d.id));
    const activityIds = new Set(SUBTYPE_STANDARD_DOCS.Activity.map((d) => d.id));
    const equipmentIds = new Set(SUBTYPE_STANDARD_DOCS.Equipment.map((d) => d.id));

    expect(recIds.some((id) => vesselIds.has(id))).toBe(true);
    expect(recIds.some((id) => crewIds.has(id))).toBe(true);
    expect(recIds.some((id) => activityIds.has(id))).toBe(true);
    expect(recIds.some((id) => equipmentIds.has(id))).toBe(true);
  });

  it('defines custom requirements covering People, Plant, and Process pillars', () => {
    expect(genericTemplate?.customRequirements).toBeDefined();
    const tasks = genericTemplate!.customRequirements!;
    expect(tasks.length).toBeGreaterThanOrEqual(8);

    const pillars = new Set(tasks.map((t) => t.pillar));
    expect(pillars.has('Plant')).toBe(true);
    expect(pillars.has('People')).toBe(true);
    expect(pillars.has('Process')).toBe(true);

    tasks.forEach((task) => {
      const fields = customRequirementFields(task);
      expect(fields.category).toBeTruthy();
      expect(task.title.trim().length).toBeGreaterThan(0);
      expect(task.description.trim().length).toBeGreaterThan(0);
    });
  });
});
