/* Unit tests verifying that demo pre-seeded documents render a certificate preview. */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DocumentCertificatePreview } from '../components/common/DocumentCertificatePreview';
import { SUBTYPE_TEMPLATES } from '../utils/assuranceTemplates';
import { attachDemoDocumentsToRequirements } from '../utils/oilCoDemoPreseed';
import { AssuranceRequirement } from '../types/assurance';

describe('DocumentCertificatePreview for demo documents (Task 5)', () => {
  it('renders the title and issuing authority for every document built by attachDemoDocumentsToRequirements', () => {
    const template = SUBTYPE_TEMPLATES[0];
    const tasks = template.customRequirements ?? [];
    expect(tasks.length).toBeGreaterThan(0);

    const rawRequirements: AssuranceRequirement[] = tasks.map((task, index) => ({
      id: `req-${index}`,
      category: 'Statutory Certificate',
      title: task.title,
      isMandatory: true,
      isFulfilled: false,
      ocrConfidence: 0,
      verifierStatus: 'Pending',
    }));

    const respondingParty = 'Northwind Marine Pty Ltd';
    const { demoDocuments } = attachDemoDocumentsToRequirements(rawRequirements, {
      setId: 'AS-DEMO-PREVIEW',
      respondingParty,
      targetObject: { type: 'vessel', id: 'VES-001', name: 'Pacific Responder' },
    });

    expect(demoDocuments.length).toBeGreaterThan(0);

    for (const doc of demoDocuments) {
      const { container, unmount } = render(<DocumentCertificatePreview document={doc} />);

      expect(container.firstChild).not.toBeNull();
      expect(screen.getAllByText(doc.title).length).toBeGreaterThan(0);
      expect(screen.getAllByText(respondingParty).length).toBeGreaterThan(0);

      unmount();
    }
  });
});
