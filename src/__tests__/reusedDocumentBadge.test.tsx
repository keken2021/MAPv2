/* 
  file summary: component test verifying ReusedDocumentBadge and its presentation on requirement rows.
  responsibilities: verifies that ReusedDocumentBadge renders 'Reused from vault' when reusedDocument is true and renders nothing when false, and that requirement rows display the badge only for reused documents.
  role in system: executed during vitest test runs for Task 6 / story 5483.
*/

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReusedDocumentBadge } from '../components/common/ReusedDocumentBadge';
import { AssuranceRequirementRow } from '../components/assurance/AssuranceRequirementRow';
import { AssuranceRequirement, AssuranceSet } from '../types/assurance';
import { useMapStore } from '../store/useMapStore';

describe('ReusedDocumentBadge component', () => {
  it('renders "Reused from vault" badge when reusedDocument is true or omitted', () => {
    const { rerender } = render(<ReusedDocumentBadge />);
    expect(screen.getByTestId('reused-document-badge')).toBeInTheDocument();
    expect(screen.getByText('Reused from vault')).toBeInTheDocument();

    rerender(<ReusedDocumentBadge reusedDocument={true} />);
    expect(screen.getByTestId('reused-document-badge')).toBeInTheDocument();
    expect(screen.getByText('Reused from vault')).toBeInTheDocument();
  });

  it('renders nothing when reusedDocument is false', () => {
    const { container } = render(<ReusedDocumentBadge reusedDocument={false} />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('reused-document-badge')).not.toBeInTheDocument();
    expect(screen.queryByText('Reused from vault')).not.toBeInTheDocument();
  });

  it('displays the badge on AssuranceRequirementRow when req.reusedDocument is true and hides it when false', () => {
    const store = useMapStore.getState();
    const sampleSet: AssuranceSet = store.assuranceSets[0];

    const reusedReq: AssuranceRequirement = {
      id: 'REQ-REUSED-001',
      docTypeId: 'vessel-class-cert',
      title: 'Certificate of Class',
      category: 'Statutory Certificate',
      isMandatory: true,
      isFulfilled: true,
      verifierStatus: 'Verified',
      ocrConfidence: 98,
      reusedDocument: true,
      documentId: 'DOC-123',
    };

    const normalReq: AssuranceRequirement = {
      id: 'REQ-NORMAL-002',
      docTypeId: 'vessel-loadline-cert',
      title: 'Load Line Certificate',
      category: 'Statutory Certificate',
      isMandatory: true,
      isFulfilled: false,
      verifierStatus: 'Pending',
      ocrConfidence: 0,
      reusedDocument: false,
    };

    const commonProps = {
      assuranceSet: sampleSet,
      documents: store.documents,
      users: store.users,
      isSubmitter: false,
      isVerifier: false,
      isApproverOrInspector: false,
      isClientViewer: false,
      isAssignedReviewer: false,
      canEditTasks: false,
      reqTableColSpan: 5,
      isReqExpanded: false,
      toggleReqExpand: () => {},
      openEditTask: () => {},
      setTaskToDelete: () => {},
      setSelectedDocForReview: () => {},
      canViewDoc: true,
      effectiveOcr: 98,
      renderRowStatusBadge: () => null,
      renderVersionBadge: () => null,
      renderValidityBadge: () => null,
      renderRequirementStatus: () => <span>Status</span>,
      renderContractShortWarning: () => null,
      resolveRequirementTargetObject: () => ({ name: 'Target Object' }),
    };

    const { rerender } = render(
      <table>
        <tbody>
          <AssuranceRequirementRow req={reusedReq} {...commonProps} />
        </tbody>
      </table>
    );

    expect(screen.getByText('Reused from vault')).toBeInTheDocument();
    expect(screen.getByTestId('reused-document-badge')).toBeInTheDocument();

    rerender(
      <table>
        <tbody>
          <AssuranceRequirementRow req={normalReq} {...commonProps} />
        </tbody>
      </table>
    );

    expect(screen.queryByText('Reused from vault')).not.toBeInTheDocument();
    expect(screen.queryByTestId('reused-document-badge')).not.toBeInTheDocument();
  });
});
