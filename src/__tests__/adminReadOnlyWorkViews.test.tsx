import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { AssuranceSet } from '../types/assurance';
import { MasterDocument } from '../types/document';
import { useMapStore } from '../store/useMapStore';
import { buildBrdRolePermissionDefaults } from '../utils/permissionDefaults';
import { getRoleScopeFlags } from '../utils/permissionHelpers';
import {
  getAssuranceSetRoleActions,
  isAdminReadOnlyWorkView,
  isViewAccessibleToPersona,
} from '../utils/rbacHelpers';
import { InspectorWorkspaceView } from '../views/InspectorWorkspaceView';
import { VerifierWorkspaceView } from '../views/VerifierWorkspaceView';

const document = (id: string): MasterDocument =>
  ({
    id,
    title: `${id} certificate`,
    entityType: 'Vessel Certificate',
    vesselId: 'VESSEL-001',
    certificateNo: id,
    issuingAuthority: 'DNV',
    expiryDate: '2027-01-01',
    ocrConfidence: 96,
    currentVersion: '1.0',
    versions: [],
    complianceState: 'Valid',
    validationRules: {
      charterBufferPassed: true,
      assetMatch100Percent: true,
      iacsAuthorityValid: true,
      overallValid: true,
    },
    verificationStatus: 'Pending',
  }) as MasterDocument;

const inspectionSet = (id: string, initiatorOrg: string): AssuranceSet =>
  ({
    id,
    title: id,
    vesselId: `V-${id}`,
    vesselName: `Vessel ${id}`,
    imoNumber: '9123453',
    initiatorOrg,
    initiatorRole: 'Vessel Provider',
    charterWindowStart: '2026-11-01',
    charterWindowEnd: '2027-02-28',
    complianceDeadline: '2026-11-01',
    stage: 'Inspection',
    mandatoryInspectionRequired: true,
    inspectionCompleted: false,
    assignedInspector: 'N. Technical (Meridian Marine Surveyors)',
    requirements: [],
  }) as unknown as AssuranceSet;

describe('administrator read-only verification and inspection screens', () => {
  const matrix = buildBrdRolePermissionDefaults();

  it('keeps both screens open for an administrator without a queue read right', () => {
    expect(isAdminReadOnlyWorkView('verifier', 'Administrator')).toBe(true);
    expect(isAdminReadOnlyWorkView('inspector', 'Administrator')).toBe(true);
    expect(isAdminReadOnlyWorkView('inspection', 'Administrator')).toBe(true);
    expect(isAdminReadOnlyWorkView('verifier', 'Verifier')).toBe(false);
    expect(getRoleScopeFlags(matrix, 'Administrator', 'verification_queue').read).toBe(false);
    expect(isViewAccessibleToPersona('verifier', null, 'Administrator', matrix)).toBe(true);
    expect(isViewAccessibleToPersona('inspector', null, 'Administrator', matrix)).toBe(true);
  });

  describe('rendered screens', () => {
    const mine = inspectionSet('AS-ORG', 'Northwind Marine Pty Ltd');
    const other = inspectionSet('AS-OTHER', 'Harrison Marine Vetting Services');

    beforeEach(() => {
      useMapStore.setState({
        isAuthenticated: true,
        activePersona: 'Administrator',
        activeDemoOrganization: 'Northwind Marine Pty Ltd',
        activeSessionUserId: 'USR-101',
        documents: [document('DOC-ORG'), document('DOC-OTHER')],
        assuranceSets: [
          {
            ...mine,
            requirements: [
              {
                id: 'REQ-ORG',
                documentId: 'DOC-ORG',
                isMandatory: true,
                isFulfilled: false,
                verifierStatus: 'Pending',
              },
            ],
          } as AssuranceSet,
          {
            ...other,
            requirements: [
              {
                id: 'REQ-OTHER',
                documentId: 'DOC-OTHER',
                isMandatory: true,
                isFulfilled: false,
                verifierStatus: 'Pending',
              },
            ],
          } as AssuranceSet,
        ],
        vessels: [],
      });
    });

    it('shows the organization verification queue with view as the only row action', () => {
      const set = useMapStore.getState().assuranceSets[0];
      expect(getAssuranceSetRoleActions(set, 'Administrator', 'Northwind Marine Pty Ltd').canVerify).toBe(false);

      render(<VerifierWorkspaceView />);
      expect(screen.getByText("Read-only view of your organization's verification work")).toBeTruthy();
      expect(screen.getByText('DOC-ORG certificate')).toBeTruthy();
      expect(screen.queryByText('DOC-OTHER certificate')).toBeNull();

      const table = screen.getByRole('table');
      const rowButtons = within(table).getAllByRole('button');
      expect(rowButtons.every((button) => button.getAttribute('aria-label') === 'View')).toBe(true);

      fireEvent.click(rowButtons[0]);
      expect(screen.queryByRole('button', { name: 'Verify' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Reject' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Return for Correction' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Upload New Version' })).toBeNull();
    });

    it('shows the organization inspection list with view as the only row action', () => {
      const set = useMapStore.getState().assuranceSets[0];
      expect(getAssuranceSetRoleActions(set, 'Administrator', 'Northwind Marine Pty Ltd').canInspect).toBe(false);

      render(<InspectorWorkspaceView />);
      expect(screen.getByText("Read-only view of your organization's inspection work")).toBeTruthy();
      expect(screen.getByText(/AS-ORG · AS-ORG/)).toBeTruthy();
      expect(screen.queryByText(/AS-OTHER/)).toBeNull();

      const table = screen.getByRole('table');
      const rowButtons = within(table).getAllByRole('button');
      expect(rowButtons.every((button) => button.getAttribute('aria-label') === 'View')).toBe(true);
      expect(screen.queryByRole('button', { name: /submit inspection/i })).toBeNull();
    });
  });
});
