import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AssuranceSet } from '../types/assurance';
import { MasterDocument } from '../types/document';
import { AuditTrailEvent } from '../types/audit';
import { SharedDashboardFrame } from '../components/dashboard/SharedDashboardFrame';
import {
  formatOrdinal,
  getVerifierDashboardConfig,
} from '../utils/roleDashboardConfigs';

describe('Verifier dashboard config (Task 5387)', () => {
  const fixedNow = new Date('2026-11-05T00:00:00Z');

  it('formats ordinal numbers correctly', () => {
    expect(formatOrdinal(1)).toBe('1st');
    expect(formatOrdinal(2)).toBe('2nd');
    expect(formatOrdinal(3)).toBe('3rd');
    expect(formatOrdinal(4)).toBe('4th');
    expect(formatOrdinal(10)).toBe('10th');
  });

  it('counts only sets with an active escalation notice for the Escalated tile', () => {
    const mockSets: AssuranceSet[] = [
      {
        id: 'AS-1',
        title: 'Borealis Survey',
        vesselName: 'MV Borealis',
        stage: 'Verification',
        assignedVerifier: 'A. Fontaine',
        hasActiveEscalationNotice: true,
        requirements: [
          { id: 'REQ-1', title: 'Load Line Certificate', verifierStatus: 'Pending' },
        ],
      } as unknown as AssuranceSet,
      {
        id: 'AS-2',
        title: 'Celeste Survey',
        vesselName: 'MV Celeste',
        stage: 'Verification',
        assignedVerifier: 'A. Fontaine',
        hasActiveEscalationNotice: false,
        requirements: [
          { id: 'REQ-2', title: 'Class Certificate', verifierStatus: 'Pending' },
        ],
      } as unknown as AssuranceSet,
    ];

    const config = getVerifierDashboardConfig({
      assuranceSets: mockSets,
      documents: [],
      auditEvents: [],
      setCurrentHashView: vi.fn(),
      now: fixedNow,
    });

    const escalatedTile = config.tiles.find((t) => t.id === 'escalated');
    expect(escalatedTile).toBeDefined();
    expect(escalatedTile?.value).toBe(1);
    expect(escalatedTile?.tone).toBe('bad');
    expect(escalatedTile?.label).toBe('Escalated');
  });

  it('orders action rows strictly: escalated -> due soon -> re-submitted -> oldest', () => {
    const mockSets: AssuranceSet[] = [
      {
        id: 'AS-NORMAL',
        title: 'Delta Survey',
        vesselName: 'MV Delta',
        stage: 'Verification',
        assignedVerifier: 'A. Fontaine',
        targetDate: '2026-11-30T00:00:00Z',
      } as unknown as AssuranceSet,
      {
        id: 'AS-DUE-SOON',
        title: 'Aurora Survey',
        vesselName: 'MV Aurora',
        stage: 'Verification',
        assignedVerifier: 'A. Fontaine',
        targetDate: '2026-11-07T00:00:00Z', // 2 days away -> Due soon
      } as unknown as AssuranceSet,
      {
        id: 'AS-ESCALATED',
        title: 'Borealis Survey',
        vesselName: 'MV Borealis',
        stage: 'Verification',
        assignedVerifier: 'A. Fontaine',
        notices: [{ kind: 'escalation', active: true }],
        targetDate: '2026-11-20T00:00:00Z',
      } as unknown as AssuranceSet,
    ];

    const mockDocs: MasterDocument[] = [
      {
        id: 'DOC-OLDEST',
        title: 'Radio License',
        vesselName: 'MV Delta',
        assuranceSetId: 'AS-NORMAL',
        verificationStatus: 'Pending',
        uploadedAt: '2026-11-01T00:00:00Z', // 4 days waiting
      } as unknown as MasterDocument,
      {
        id: 'DOC-RESUBMITTED',
        title: 'Crew Certificate',
        vesselName: 'MV Delta',
        assuranceSetId: 'AS-NORMAL',
        verificationStatus: 'Pending',
        attemptNumber: 2,
        uploadedAt: '2026-11-04T00:00:00Z', // 1 day waiting, but re-submitted!
      } as unknown as MasterDocument,
      {
        id: 'DOC-DUE-SOON',
        title: 'Safety Management Cert',
        vesselName: 'MV Aurora',
        assuranceSetId: 'AS-DUE-SOON',
        verificationStatus: 'Pending',
        uploadedAt: '2026-11-03T00:00:00Z',
      } as unknown as MasterDocument,
      {
        id: 'DOC-ESCALATED',
        title: 'Load Line Certificate',
        vesselName: 'MV Borealis',
        assuranceSetId: 'AS-ESCALATED',
        verificationStatus: 'Pending',
        uploadedAt: '2026-11-04T00:00:00Z',
      } as unknown as MasterDocument,
    ];

    const setCurrentHashView = vi.fn();
    const config = getVerifierDashboardConfig({
      assuranceSets: mockSets,
      documents: mockDocs,
      auditEvents: [],
      setCurrentHashView,
      now: fixedNow,
    });

    expect(config.actionItems).toHaveLength(4);

    // 1st item: Escalated
    expect(config.actionItems[0].tag).toBe('Escalated');
    expect(config.actionItems[0].tagTone).toBe('bad');
    expect(config.actionItems[0].title).toBe('Load Line Certificate · MV Borealis');
    expect(config.actionItems[0].subtitle).toBe('Set target date at risk');
    expect(config.actionItems[0].buttonLabel).toBe('Verify');

    // 2nd item: Due soon
    expect(config.actionItems[1].tag).toBe('Due soon');
    expect(config.actionItems[1].tagTone).toBe('warn');
    expect(config.actionItems[1].title).toBe('Safety Management Cert · MV Aurora');
    expect(config.actionItems[1].subtitle).toBe('Set due 7 Nov');
    expect(config.actionItems[1].buttonLabel).toBe('Verify');

    // 3rd item: Re-submitted
    expect(config.actionItems[2].tag).toBe('Re-submitted');
    expect(config.actionItems[2].tagTone).toBe('neutral');
    expect(config.actionItems[2].title).toBe('Crew Certificate · MV Delta');
    expect(config.actionItems[2].subtitle).toBe('2nd attempt');
    expect(config.actionItems[2].buttonLabel).toBe('Verify');

    // 4th item: Oldest in queue
    expect(config.actionItems[3].tag).toBe('In queue');
    expect(config.actionItems[3].tagTone).toBe('neutral');
    expect(config.actionItems[3].title).toBe('Radio License · MV Delta');
    expect(config.actionItems[3].subtitle).toBe('Waiting 4 days');
    expect(config.actionItems[3].buttonLabel).toBe('Verify');

    // In queue tile should reflect oldest wait days
    const inQueueTile = config.tiles.find((t) => t.id === 'in_queue');
    expect(inQueueTile?.label).toBe('In queue · oldest 4 days');
    expect(inQueueTile?.value).toBe(4);
  });

  it('renders SharedDashboardFrame with Verifier config and all interactions', () => {
    const mockSets: AssuranceSet[] = [
      {
        id: 'AS-1',
        title: 'Aurora Survey',
        vesselName: 'MV Aurora',
        stage: 'Verification',
        assignedVerifier: 'A. Fontaine',
        targetDate: '2026-11-07T00:00:00Z',
      } as unknown as AssuranceSet,
    ];

    const mockDocs: MasterDocument[] = [
      {
        id: 'DOC-1',
        title: 'Safety Equipment Certificate',
        vesselName: 'MV Aurora',
        assuranceSetId: 'AS-1',
        verificationStatus: 'Pending',
        uploadedAt: '2026-11-03T00:00:00Z',
      } as unknown as MasterDocument,
    ];

    const mockAudit: AuditTrailEvent[] = [
      {
        id: 'AUD-1',
        timestampUtc: '2026-11-05T02:00:00Z',
        userId: 'USR-101',
        userRole: 'Submitter',
        organization: 'Northwind Marine Pty Ltd',
        action: 'Re-uploaded document',
        targetAsset: 'Crew certificate',
        target: { kind: 'document', setId: 'AS-1', documentId: 'DOC-1' },
      },
    ];

    const setCurrentHashView = vi.fn();
    const config = getVerifierDashboardConfig({
      assuranceSets: mockSets,
      documents: mockDocs,
      auditEvents: mockAudit,
      setCurrentHashView,
      now: fixedNow,
    });

    render(<SharedDashboardFrame config={config} />);

    expect(screen.getByText('Verifier')).toBeInTheDocument();
    expect(screen.getByText('Verification queue')).toBeInTheDocument();

    // Action button
    const verifyBtn = screen.getByRole('button', { name: 'Verify' });
    expect(verifyBtn).toBeInTheDocument();
    fireEvent.click(verifyBtn);
    expect(setCurrentHashView).toHaveBeenCalledWith('verifier-workspace', 'DOC-1');

    // See all / open queue link
    const openQueueLink = screen.getByRole('button', { name: /Open queue \(1\)/i });
    expect(openQueueLink).toBeInTheDocument();
    fireEvent.click(openQueueLink);
    expect(setCurrentHashView).toHaveBeenCalledWith('verifier-workspace');
  });

  it('renders empty action message when queue is empty', () => {
    const config = getVerifierDashboardConfig({
      assuranceSets: [],
      documents: [],
      auditEvents: [],
      setCurrentHashView: vi.fn(),
      now: fixedNow,
    });

    render(<SharedDashboardFrame config={config} />);
    expect(screen.getByText('Nothing needs you today')).toBeInTheDocument();
  });
});
