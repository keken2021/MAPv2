import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ProjectTasksTable, getTaskRowActionLabel } from '../components/tables/ProjectTasksTable';
import type { AssuranceRequirement, AssuranceSet } from '../types/assurance';

const TEST_TODAY = new Date('2026-11-04T12:00:00Z');

function createRequirement(overrides: Partial<AssuranceRequirement> = {}): AssuranceRequirement {
  return {
    id: 'REQ-101',
    category: 'Statutory Certificate',
    title: 'Cargo Ship Safety Construction Certificate',
    isMandatory: true,
    isFulfilled: false,
    ocrConfidence: 95,
    verifierStatus: 'Pending',
    targetDate: '2026-11-20',
    assignedSubmitter: 'M. Chen (Northwind Marine)',
    ...overrides,
  } as AssuranceRequirement;
}

function createSet(id: string, title: string, reqs: AssuranceRequirement[]): AssuranceSet {
  return {
    id,
    title,
    vesselId: `V-${id}`,
    vesselName: 'MV Pacific Supporter',
    imoNumber: '9456789',
    initiatorOrg: 'Chevron Australia',
    initiatorRole: 'Client Admin',
    clientOrg: 'Chevron Australia',
    requestingParty: 'Chevron Australia',
    serviceProviderOrg: 'Northwind Marine',
    respondingParty: 'Northwind Marine',
    charterWindowStart: '2026-01-01',
    charterWindowEnd: '2026-12-31',
    complianceDeadline: '2026-11-30',
    stage: 'Verification',
    readinessScore: 60,
    requirements: reqs,
    mandatoryInspectionRequired: false,
    inspectionCompleted: false,
  } as AssuranceSet;
}

describe('Task 5378: Role-aware Upload, Review or View button per row on Tasks tab', () => {
  beforeEach(() => {
    cleanup();
  });

  describe('getTaskRowActionLabel helper unit tests', () => {
    it('returns Upload for responding party while pending or reupload requested', () => {
      // Pending without document
      const pendingReq = createRequirement({ documentId: undefined, verifierStatus: 'Pending' });
      expect(getTaskRowActionLabel({ requirement: pendingReq, status: 'Pending' }, 'responding')).toBe('Upload');

      // Reupload requested
      const reuploadReq = createRequirement({
        documentId: 'DOC-1',
        verifierStatus: 'Correction Requested',
        reuploadRequested: { reason: 'Blurred image', date: '2026-11-04' },
      });
      expect(getTaskRowActionLabel({ requirement: reuploadReq, status: 'Pending' }, 'responding')).toBe('Upload');
      expect(getTaskRowActionLabel({ requirement: reuploadReq, status: 'reupload_requested' }, 'responding')).toBe('Upload');
    });

    it('returns Review for requesting party while submitted', () => {
      // Submitted with document uploaded and awaiting verification
      const submittedReq = createRequirement({
        documentId: 'DOC-2',
        verifierStatus: 'Pending',
      });
      expect(getTaskRowActionLabel({ requirement: submittedReq, status: 'On-going' }, 'requesting')).toBe('Review');
      expect(getTaskRowActionLabel({ requirement: submittedReq, status: 'submitted' }, 'requesting')).toBe('Review');
    });

    it('returns View for all other combinations', () => {
      const verifiedReq = createRequirement({
        documentId: 'DOC-3',
        verifierStatus: 'Verified',
        isFulfilled: true,
      });

      // Done/verified returns View for both
      expect(getTaskRowActionLabel({ requirement: verifiedReq, status: 'Done' }, 'responding')).toBe('View');
      expect(getTaskRowActionLabel({ requirement: verifiedReq, status: 'Done' }, 'requesting')).toBe('View');

      // Responding party on submitted requirement returns View (upload already completed)
      const submittedReq = createRequirement({
        documentId: 'DOC-2',
        verifierStatus: 'Pending',
      });
      expect(getTaskRowActionLabel({ requirement: submittedReq, status: 'On-going' }, 'responding')).toBe('View');

      // Requesting party on pending requirement returns View (waiting for responder to upload)
      const pendingReq = createRequirement({ documentId: undefined, verifierStatus: 'Pending' });
      expect(getTaskRowActionLabel({ requirement: pendingReq, status: 'Pending' }, 'requesting')).toBe('View');

      // Neutral/other party returns View
      expect(getTaskRowActionLabel({ requirement: pendingReq, status: 'Pending' }, 'other')).toBe('View');
      expect(getTaskRowActionLabel({ requirement: submittedReq, status: 'On-going' }, 'other')).toBe('View');
    });
  });

  describe('ProjectTasksTable table component with action column', () => {
    it('omits Actions column when showActions prop is not passed', () => {
      const set = createSet('AS-1', 'Standard Set', [createRequirement()]);
      render(<ProjectTasksTable sets={[set]} today={TEST_TODAY} />);

      expect(screen.queryByRole('columnheader', { name: /Actions/i })).toBeNull();
      expect(screen.queryByTestId(/^task-action-btn-/)).toBeNull();
    });

    it('renders Actions column and displays Upload for responding party on pending task', () => {
      const onOpenRequirement = vi.fn();
      const req = createRequirement({
        id: 'REQ-PENDING',
        title: 'Safety Radio Certificate',
        documentId: undefined,
        verifierStatus: 'Pending',
      });
      const set = createSet('AS-1', 'Standard Set', [req]);

      render(
        <ProjectTasksTable
          sets={[set]}
          today={TEST_TODAY}
          showActions
          viewerParty="responding"
          onOpenRequirement={onOpenRequirement}
        />
      );

      expect(screen.getByRole('columnheader', { name: /Actions/i })).toBeInTheDocument();
      const actionBtn = screen.getByTestId('task-action-btn-REQ-PENDING');
      expect(actionBtn).toBeInTheDocument();
      expect(actionBtn).toHaveTextContent('Upload');

      // Clicking calls onOpenRequirement
      fireEvent.click(actionBtn);
      expect(onOpenRequirement).toHaveBeenCalledTimes(1);
      expect(onOpenRequirement).toHaveBeenCalledWith(req, set);
    });

    it('renders Review for requesting party on submitted task and calls onOpenRequirement on click', () => {
      const onOpenRequirement = vi.fn();
      const req = createRequirement({
        id: 'REQ-SUBMITTED',
        title: 'Classification Hull Certificate',
        documentId: 'DOC-100',
        verifierStatus: 'Pending',
      });
      const set = createSet('AS-2', 'Review Set', [req]);

      render(
        <ProjectTasksTable
          sets={[set]}
          today={TEST_TODAY}
          showActions
          viewerParty="requesting"
          onOpenRequirement={onOpenRequirement}
        />
      );

      expect(screen.getByRole('columnheader', { name: /Actions/i })).toBeInTheDocument();
      const actionBtn = screen.getByTestId('task-action-btn-REQ-SUBMITTED');
      expect(actionBtn).toBeInTheDocument();
      expect(actionBtn).toHaveTextContent('Review');

      // Clicking calls onOpenRequirement
      fireEvent.click(actionBtn);
      expect(onOpenRequirement).toHaveBeenCalledTimes(1);
      expect(onOpenRequirement).toHaveBeenCalledWith(req, set);
    });

    it('renders View for verified task and calls onOpenRequirement on click', () => {
      const onOpenRequirement = vi.fn();
      const req = createRequirement({
        id: 'REQ-VERIFIED',
        title: 'Load Line Certificate',
        documentId: 'DOC-200',
        verifierStatus: 'Verified',
        isFulfilled: true,
      });
      const set = createSet('AS-3', 'Verified Set', [req]);

      render(
        <ProjectTasksTable
          sets={[set]}
          today={TEST_TODAY}
          showActions
          viewerParty="requesting"
          onOpenRequirement={onOpenRequirement}
        />
      );

      const actionBtn = screen.getByTestId('task-action-btn-REQ-VERIFIED');
      expect(actionBtn).toBeInTheDocument();
      expect(actionBtn).toHaveTextContent('View');

      fireEvent.click(actionBtn);
      expect(onOpenRequirement).toHaveBeenCalledTimes(1);
      expect(onOpenRequirement).toHaveBeenCalledWith(req, set);
    });

    it('renders Reupload for responding party on reupload_requested task', () => {
      const req = createRequirement({
        id: 'REQ-REUPLOAD',
        title: 'IOPP Certificate',
        documentId: 'DOC-300',
        verifierStatus: 'Correction Requested',
        reuploadRequested: { reason: 'Page 2 missing', date: '2026-11-04' },
      });
      const set = createSet('AS-4', 'Correction Set', [req]);

      render(
        <ProjectTasksTable
          sets={[set]}
          today={TEST_TODAY}
          showActions
          viewerParty="responding"
          onOpenRequirement={vi.fn()}
        />
      );

      const actionBtn = screen.getByTestId('task-action-btn-REQ-REUPLOAD');
      expect(actionBtn).toBeInTheDocument();
      /* action kind stays Upload; label shows Reupload when a reupload was requested */
      expect(actionBtn).toHaveTextContent('Reupload');
    });
  });
});

