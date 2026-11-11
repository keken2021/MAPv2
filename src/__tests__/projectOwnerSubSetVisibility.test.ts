import { describe, it, expect } from 'vitest';
import { isProjectOwnerWithoutSubSetGroup } from '../utils/rbacHelpers';
import type { AssuranceSet } from '../types/assurance';
import type { Project } from '../types/project';

describe('isProjectOwnerWithoutSubSetGroup', () => {
  const mockProject: Project = {
    id: 'PROJECT-001',
    name: 'Gorgon Stage 2 Deepwater Pipeline',
    ownerOrganization: 'Chevron Australia Pty Ltd',
    requestingOrganization: 'Chevron Australia Pty Ltd',
    charterer: 'Chevron Australia Pty Ltd',
    status: 'Active',
    assetLinks: [],
    contractParties: [],
    createdDate: '2025-01-01',
    lastModifiedDate: '2025-01-01',
  };

  const mockSubSetWithoutOwnerGroup: AssuranceSet = {
    id: 'SET-SUB-001',
    title: 'Offshore Tug Support Set',
    status: 'In Progress',
    stage: 'Verification',
    vesselName: 'Pacific Valour',
    vesselId: 'VESSEL-002',
    clientOrg: 'Woodside Energy Ltd',
    charterer: 'Woodside Energy Ltd',
    initiatorOrg: 'Tug Services International',
    serviceProviderOrg: 'Tug Services International',
    parties: [
      { organization: 'Woodside Energy Ltd', group: 'Client' },
      { organization: 'Tug Services International', group: 'Vendor' },
    ],
    stakeholders: {
      submitterOrg: 'Tug Services International',
      verifierOrg: 'Bureau Veritas Inspectorate',
      approverOrg: 'Woodside Energy Ltd',
    },
    assignedStakeholders: {
      submitterOrg: 'Tug Services International',
      verifierOrg: 'Bureau Veritas Inspectorate',
      approverOrg: 'Woodside Energy Ltd',
    },
    requirements: [],
  };

  const mockSubSetWithOwnerGroup: AssuranceSet = {
    id: 'SET-SUB-002',
    title: 'Chevron Direct Subsea Set',
    status: 'In Progress',
    stage: 'Verification',
    vesselName: 'Pacific Raven',
    vesselId: 'VESSEL-001',
    clientOrg: 'Chevron Australia Pty Ltd',
    charterer: 'Chevron Australia Pty Ltd',
    initiatorOrg: 'Northwind Marine Pty Ltd',
    serviceProviderOrg: 'Northwind Marine Pty Ltd',
    parties: [
      { organization: 'Chevron Australia Pty Ltd', group: 'Client' },
      { organization: 'Northwind Marine Pty Ltd', group: 'Vendor' },
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
      assignedVerifier: 'John Chevron (Chevron Australia Pty Ltd)',
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
