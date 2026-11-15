import { describe, it, expect } from 'vitest';
import { isProjectOwnerWithoutSubSetGroup } from '../utils/rbacHelpers';
import type { AssuranceSet } from '../types/assurance';
import type { Project } from '../types/project';

describe('isProjectOwnerWithoutSubSetGroup', () => {
  const mockProject: Project = {
    id: 'PROJECT-001',
    name: 'Gorgon Stage 2 Deepwater Pipeline',
    clientOperator: 'Chevron Australia Pty Ltd',
    location: 'Barrow Island / Greater Gorgon Area, WA',
    description: 'Deepwater SURF & Subsea Tie-In Installation',
    projectType: 'Charter / Voyage',
    operatorOrganization: 'Chevron Australia Pty Ltd',
    ownerOrganization: 'Chevron Australia Pty Ltd',
    requestingOrganization: 'Chevron Australia Pty Ltd',
    charterer: 'Chevron Australia Pty Ltd',
    charterWindowStart: '2026-11-01',
    charterWindowEnd: '2027-02-01',
    status: 'Assurance In Progress',
    assetLinks: [],
    contractParties: [],
  };

  const mockSubSetWithoutOwnerGroup: AssuranceSet = {
    id: 'SET-SUB-001',
    title: 'Offshore Tug Support Set',
    stage: 'Verification',
    assuranceObjects: [
      { id: 'VESSEL-002', type: 'vessel', name: 'Pacific Valour', identifier: '9000002', ownerOrganization: 'Tug Services International' },
    ],
    startDate: '2026-11-01',
    endDate: '2027-02-01',
    deadline: '2026-11-01',
    dateHistory: [],
    createdBy: { userId: 'USR-101', name: 'User', persona: 'Administrator' },
    readinessScore: 0,
    mandatoryInspectionRequired: false,
    inspectionCompleted: false,
    parties: [
      { organization: 'Woodside Energy Ltd', role: 'Requesting party' },
      { organization: 'Tug Services International', role: 'Responding party' },
    ],
    stakeholders: {
      submitterOrg: 'Tug Services International',
      verifierOrg: 'Bureau Veritas Inspectorate',
      approverOrg: 'Woodside Energy Ltd',
    },
    requirements: [],
  };

  const mockSubSetWithOwnerGroup: AssuranceSet = {
    id: 'SET-SUB-002',
    title: 'Chevron Direct Subsea Set',
    stage: 'Verification',
    assuranceObjects: [
      { id: 'VESSEL-001', type: 'vessel', name: 'Pacific Raven', identifier: '9000001', ownerOrganization: 'Northwind Marine Pty Ltd' },
    ],
    startDate: '2026-11-01',
    endDate: '2027-02-01',
    deadline: '2026-11-01',
    dateHistory: [],
    createdBy: { userId: 'USR-101', name: 'User', persona: 'Administrator' },
    readinessScore: 0,
    mandatoryInspectionRequired: false,
    inspectionCompleted: false,
    parties: [
      { organization: 'Chevron Australia Pty Ltd', role: 'Requesting party' },
      { organization: 'Northwind Marine Pty Ltd', role: 'Responding party' },
    ],
    stakeholders: {
      submitterOrg: 'Northwind Marine Pty Ltd',
      verifierOrg: 'Bureau Veritas Inspectorate',
      approverOrg: 'Chevron Australia Pty Ltd',
    },
    requirements: [],
  };

  it('returns true when viewer matches master project owner and has no group or stakeholder role on sub-set', () => {
    const isRestricted = isProjectOwnerWithoutSubSetGroup(
      mockSubSetWithoutOwnerGroup,
      mockProject,
      'Chevron Australia Pty Ltd',
      { id: 'USER-1', name: 'John Chevron', organization: 'Chevron Australia Pty Ltd', roles: ['C Admin'] },
    );
    expect(isRestricted).toBe(true);
  });

  it('returns false when viewer is part of the sub-set participating parties (e.g. client)', () => {
    const isRestricted = isProjectOwnerWithoutSubSetGroup(
      mockSubSetWithOwnerGroup,
      mockProject,
      'Chevron Australia Pty Ltd',
      { id: 'USER-1', name: 'John Chevron', organization: 'Chevron Australia Pty Ltd', roles: ['C Admin'] },
    );
    expect(isRestricted).toBe(false);
  });

  it('returns false when viewer organization does not match project owner organization', () => {
    const isRestricted = isProjectOwnerWithoutSubSetGroup(
      mockSubSetWithoutOwnerGroup,
      mockProject,
      'Unrelated Third Party Ltd',
      { id: 'USER-2', name: 'Other User', organization: 'Unrelated Third Party Ltd', roles: ['C Admin'] },
    );
    expect(isRestricted).toBe(false);
  });

  it('returns false when viewer is assigned as a named reviewer in the set', () => {
    const setWithNamedReviewer: AssuranceSet = {
      ...mockSubSetWithoutOwnerGroup,
      stakeholders: {
        ...mockSubSetWithoutOwnerGroup.stakeholders,
        verifierName: 'John Chevron',
        verifierOrg: 'Chevron Australia Pty Ltd',
      },
    };
    const isRestricted = isProjectOwnerWithoutSubSetGroup(
      setWithNamedReviewer,
      mockProject,
      'Chevron Australia Pty Ltd',
      { id: 'USER-1', name: 'John Chevron', organization: 'Chevron Australia Pty Ltd', roles: ['Verifier'] },
    );
    expect(isRestricted).toBe(false);
  });

  it('returns false if project or set is missing or viewerOrg is empty', () => {
    expect(isProjectOwnerWithoutSubSetGroup(null, mockProject, 'Chevron Australia Pty Ltd')).toBe(false);
    expect(isProjectOwnerWithoutSubSetGroup(mockSubSetWithoutOwnerGroup, null, 'Chevron Australia Pty Ltd')).toBe(false);
    expect(isProjectOwnerWithoutSubSetGroup(mockSubSetWithoutOwnerGroup, mockProject, '')).toBe(false);
  });
});
