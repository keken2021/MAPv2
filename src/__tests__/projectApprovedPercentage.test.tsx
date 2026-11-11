import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { calculateProjectApprovedPercentage } from '../utils/projectHelpers';
import { ProjectOverviewTab } from '../components/projects/ProjectOverviewTab';
import { MOCK_PROJECTS, PROJECT_SEED_ASSURANCE_SETS } from '../store/projectMockData';
import { Project } from '../types/project';
import { AssuranceSet } from '../types/assurance';

describe('Project Approved Percentage (FR-25)', () => {
  const dummyProject: Project = {
    ...MOCK_PROJECTS[0],
    id: 'PROJ-TEST-FR25',
    name: 'FR-25 Test Project',
    assetLinks: [],
  };

  const createTestSet = (
    id: string,
    overrides: Partial<AssuranceSet>,
  ): AssuranceSet => ({
    ...PROJECT_SEED_ASSURANCE_SETS[0],
    id,
    projectId: dummyProject.id,
    title: `Sub-set ${id}`,
    stage: 'Verification',
    approverDecision: undefined,
    readinessScore: 50,
    requirements: [],
    ...overrides,
  });

  describe('calculateProjectApprovedPercentage unit tests', () => {
    it('returns 0 when project has no assurance sets', () => {
      expect(calculateProjectApprovedPercentage(dummyProject, [])).toBe(0);
    });

    it('returns 0 when project has sub-sets with required tasks but none are approved', () => {
      const sets: AssuranceSet[] = [
        createTestSet('AS-1', {
          requirements: [
            {
              id: 'REQ-1',
              category: 'Statutory Certificate',
              title: 'Class Cert',
              isMandatory: true,
              isFulfilled: false,
              ocrConfidence: 90,
              verifierStatus: 'Pending',
            },
            {
              id: 'REQ-2',
              category: 'Statutory Certificate',
              title: 'Safety Cert',
              isMandatory: true,
              isFulfilled: false,
              ocrConfidence: 90,
              verifierStatus: 'Correction Requested',
            },
          ],
        }),
      ];
      expect(calculateProjectApprovedPercentage(dummyProject, sets)).toBe(0);
    });

    it('computes percentage across multiple sub-sets correctly', () => {
      const sets: AssuranceSet[] = [
        createTestSet('AS-1', {
          stage: 'Verification',
          approverDecision: undefined,
          readinessScore: 50,
          requirements: [
            {
              id: 'REQ-1',
              category: 'Statutory Certificate',
              title: 'Class Cert',
              isMandatory: true,
              isFulfilled: true, // Approved / fulfilled
              ocrConfidence: 95,
              verifierStatus: 'Verified',
            },
            {
              id: 'REQ-2',
              category: 'Statutory Certificate',
              title: 'Safety Cert',
              isMandatory: true,
              isFulfilled: false, // Not approved
              ocrConfidence: 90,
              verifierStatus: 'Pending',
            },
            {
              id: 'REQ-OPT',
              category: 'Custom Requirement',
              title: 'Optional Document',
              isMandatory: false, // Optional, skipped from calculation
              isFulfilled: false,
              ocrConfidence: 0,
              verifierStatus: 'Pending',
            },
          ],
        }),
        createTestSet('AS-2', {
          stage: 'Approved', // Entire set is approved
          approverDecision: 'Approved',
          readinessScore: 100,
          requirements: [
            {
              id: 'REQ-3',
              category: 'Statutory Certificate',
              title: 'Load Line Cert',
              isMandatory: true,
              isFulfilled: true,
              ocrConfidence: 98,
              verifierStatus: 'Verified',
            },
            {
              id: 'REQ-4',
              category: 'Statutory Certificate',
              title: 'IOPP Cert',
              isMandatory: true,
              isFulfilled: true,
              ocrConfidence: 95,
              verifierStatus: 'Verified',
            },
          ],
        }),
      ];

      // Total mandatory required tasks: REQ-1, REQ-2, REQ-3, REQ-4 = 4
      // Approved required tasks: REQ-1 (Verified), REQ-3 (Approved set), REQ-4 (Approved set) = 3
      // Expected %: 3 / 4 = 75%
      expect(calculateProjectApprovedPercentage(dummyProject, sets)).toBe(75);
    });

    it('treats all tasks in closed or approved sub-sets as approved', () => {
      const sets: AssuranceSet[] = [
        createTestSet('AS-1', {
          stage: 'Approved',
          approverDecision: 'Approved',
          readinessScore: 100,
          requirements: [
            {
              id: 'REQ-1',
              category: 'Statutory Certificate',
              title: 'Class Cert',
              isMandatory: true,
              isFulfilled: true,
              ocrConfidence: 95,
              verifierStatus: 'Verified',
            },
          ],
        }),
      ];
      expect(calculateProjectApprovedPercentage(dummyProject, sets)).toBe(100);
    });

    it('skips exempted requirements from required tasks count', () => {
      const sets: AssuranceSet[] = [
        createTestSet('AS-1', {
          stage: 'Verification',
          approverDecision: undefined,
          readinessScore: 50,
          requirements: [
            {
              id: 'REQ-1',
              category: 'Statutory Certificate',
              title: 'Class Cert',
              isMandatory: true,
              isFulfilled: true,
              ocrConfidence: 95,
              verifierStatus: 'Verified',
            },
            {
              id: 'REQ-2',
              category: 'Statutory Certificate',
              title: 'Exempted Cert',
              isMandatory: true,
              exemption: {
                grantedBy: 'Admin',
                reason: 'Exempted for transit',
                newDate: '2026-12-31',
              },
              isFulfilled: false,
              ocrConfidence: 0,
              verifierStatus: 'Pending',
            },
          ],
        }),
      ];
      // Only REQ-1 is evaluated, which is approved -> 100%
      expect(calculateProjectApprovedPercentage(dummyProject, sets)).toBe(100);
    });
  });

  describe('ProjectOverviewTab render tests', () => {
    it('renders Approved % tile next to Overall Project Readiness', () => {
      const testSets: AssuranceSet[] = [
        createTestSet('AS-1', {
          stage: 'Verification',
          approverDecision: undefined,
          readinessScore: 50,
          requirements: [
            {
              id: 'REQ-1',
              category: 'Statutory Certificate',
              title: 'Class Cert',
              isMandatory: true,
              isFulfilled: true,
              ocrConfidence: 95,
              verifierStatus: 'Verified',
            },
            {
              id: 'REQ-2',
              category: 'Statutory Certificate',
              title: 'Safety Cert',
              isMandatory: true,
              isFulfilled: false,
              ocrConfidence: 90,
              verifierStatus: 'Pending',
            },
          ],
        }),
      ];

      render(
        <ProjectOverviewTab
          project={dummyProject}
          sets={testSets}
          allSets={testSets}
          documents={[]}
          capaItems={[]}
          canOpenSet={() => true}
          onOpenSet={() => {}}
        />,
      );

      // Verify label is rendered
      expect(screen.getByTestId('tile-approved-percentage-label')).toHaveTextContent('Approved %');
      // 1 of 2 tasks approved = 50%
      expect(screen.getByTestId('tile-approved-percentage')).toHaveTextContent('50%');
    });
  });
});
