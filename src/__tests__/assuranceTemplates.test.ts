/* 
  file summary: unit test verifying generalized public assurance templates and store separation.
  responsibilities: validates that public templates are prefixed with AST-, stripped of specific asset data, and stored in assuranceTemplates.
  role in system: executed during vitest test runs.
*/

import { describe, it, expect } from 'vitest';
import { MOCK_ASSURANCE_TEMPLATES, MOCK_ASSURANCE_SETS } from '../store/mockData';
import { useMapStore } from '../store/useMapStore';
import { AssuranceTemplate } from '../types/assurance';

describe('Public Assurance Set Templates Separation', () => {
  it('ensures all mock assurance templates use AST- prefix for IDs', () => {
    expect(MOCK_ASSURANCE_TEMPLATES.length).toBeGreaterThanOrEqual(4);
    MOCK_ASSURANCE_TEMPLATES.forEach((tmpl) => {
      expect(tmpl.id).toMatch(/^AST-\d{4}-\d{3}$/);
    });
  });

  it('guarantees that public templates have generalized info without specific asset bindings', () => {
    MOCK_ASSURANCE_TEMPLATES.forEach((tmpl: any) => {
      // Must not possess specific asset IDs or specific asset identifiers
      expect(tmpl.vesselId).toBeUndefined();
      expect(tmpl.vesselName).toBeUndefined();
      expect(tmpl.imoNumber).toBeUndefined();
      expect(tmpl.crewId).toBeUndefined();
      expect(tmpl.crewName).toBeUndefined();
      expect(tmpl.crewIds).toBeUndefined();
      expect(tmpl.crewNames).toBeUndefined();
      expect(tmpl.equipmentId).toBeUndefined();
      expect(tmpl.equipmentName).toBeUndefined();
      expect(tmpl.projectId).toBeUndefined();
      expect(tmpl.projectName).toBeUndefined();

      // Must be marked public
      expect(tmpl.visibility).toBe('public');
      expect(tmpl.title.trim().length).toBeGreaterThan(0);
      expect(tmpl.scope).toBeDefined();
      expect(tmpl.scopeType).toBeDefined();
      expect(tmpl.requirements.length).toBeGreaterThan(0);
    });
  });

  it('provides diverse scopes and scope types across Vessel, Crew, and Equipment', () => {
    const scopes = new Set(MOCK_ASSURANCE_TEMPLATES.map((t) => t.scope));
    expect(scopes.has('Vessel')).toBe(true);
    expect(scopes.has('Crew')).toBe(true);
    expect(scopes.has('Equipment')).toBe(true);

    const scopeTypes = new Set(MOCK_ASSURANCE_TEMPLATES.map((t) => t.scopeType));
    expect(scopeTypes.has('Tanker')).toBe(true);
    expect(scopeTypes.has('Barge')).toBe(true);
    expect(scopeTypes.has('Captain')).toBe(true);
    expect(scopeTypes.has('Crane')).toBe(true);
  });

  it('ensures active execution sets in MOCK_ASSURANCE_SETS do not have public template visibility', () => {
    MOCK_ASSURANCE_SETS.forEach((set) => {
      // Private execution sets bound to specific vessels must not leak as public templates
      if (set.vesselName || set.crewName || set.equipmentName) {
        expect(set.visibility).not.toBe('public');
      }
    });
  });

  it('verifies useMapStore integration for adding public assurance templates', () => {
    const store = useMapStore.getState();
    expect(store.assuranceTemplates).toBeDefined();
    expect(store.assuranceTemplates.length).toBeGreaterThanOrEqual(4);

    const customTemplate: AssuranceTemplate = {
      id: 'AST-2026-999',
      title: 'Custom Fast Rescue Craft Standard Template',
      scope: 'Equipment',
      assuranceType: 'Equipment',
      scopeType: 'Lifeboat',
      visibility: 'public',
      templateSource: 'public',
      initiatorOrg: 'Chevron Australia Pty Ltd',
      requirements: [
        {
          id: 'AST-REQ-999-1',
          category: 'Safety & Lifesaving Equipment',
          title: 'SOLAS Fast Rescue Boat Launch & Release Test',
          isMandatory: true,
          isFulfilled: false,
          ocrConfidence: 0,
          verifierStatus: 'Pending',
        },
      ],
    };

    store.addAssuranceTemplate(customTemplate);
    const updatedStore = useMapStore.getState();
    const found = updatedStore.assuranceTemplates.find((t) => t.id === 'AST-2026-999');
    expect(found).toBeDefined();
    expect(found?.title).toBe('Custom Fast Rescue Craft Standard Template');
    expect(found?.scopeType).toBe('Lifeboat');
  });
});
