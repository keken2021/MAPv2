import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import TaskSectionCards from '../components/common/TaskSectionCards';
import { useMapStore } from '../store/useMapStore';
import { AssuranceRequirement, AssuranceSet } from '../types/assurance';

function task(partial: Partial<AssuranceRequirement> & Pick<AssuranceRequirement, 'id' | 'title' | 'category'>): AssuranceRequirement {
  return {
    isMandatory: true,
    isFulfilled: false,
    ocrConfidence: 0,
    verifierStatus: 'Pending',
    sectionId: 'sec-certs',
    ...partial,
  };
}

const set: Pick<AssuranceSet, 'requirements' | 'sections'> = {
  sections: [{ id: 'sec-certs', name: 'Certificates', order: 0 }],
  requirements: [
    task({
      id: 'CERT-LINKED',
      title: 'Certificate of Class',
      category: 'Statutory Certificate',
      documentId: 'MAP-VES-2026-STAT-00007',
    }),
    task({
      id: 'CERT-EMPTY',
      title: 'Certificate of Registry',
      category: 'Statutory Certificate',
      linkedDocumentId: '',
    }),
    task({
      id: 'TASK-PLAN',
      title: 'Drill log',
      category: 'Operational Plan',
      documentId: 'MAP-DOC-PLAN',
    }),
  ],
};

describe('task section certificate links', () => {
  it('opens the document page for a certificate that has a document', () => {
    const setCurrentHashView = vi.fn();
    useMapStore.setState({ setCurrentHashView });
    render(<TaskSectionCards set={set} />);

    fireEvent.click(screen.getByRole('button', { name: /Certificates/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Certificate of Class' }));

    expect(setCurrentHashView).toHaveBeenCalledWith('documents', 'MAP-VES-2026-STAT-00007');
    expect(screen.queryByRole('button', { name: 'Certificate of Registry' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Drill log' })).toBeNull();
    expect(screen.getByText('Certificate of Registry')).toBeInTheDocument();
  });
});
