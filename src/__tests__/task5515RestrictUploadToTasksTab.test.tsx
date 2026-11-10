import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import React from 'react';
import { AssuranceDetailView } from '../views/AssuranceDetailView';
import { useMapStore } from '../store/useMapStore';
import { MOCK_ASSURANCE_SETS } from '../store/mockData';

describe('Task 5515: Restrict document submission and reupload to tasks tab', () => {
  const testSetId = 'AS-2026-001';

  beforeEach(() => {
    // Reset store state and configure a pending requirement for responding party
    const sets = JSON.parse(JSON.stringify(MOCK_ASSURANCE_SETS));
    const targetSet = sets.find((s: any) => s.id === testSetId);
    if (targetSet && targetSet.requirements && targetSet.requirements.length > 0) {
      targetSet.requirements[0].documentId = undefined;
      targetSet.requirements[0].linkedDocumentId = undefined;
      targetSet.requirements[0].verifierStatus = 'Pending';
      targetSet.requirements[0].responsibleParty = 'Northwind Marine Pty Ltd';
    }

    useMapStore.setState({
      assuranceSets: sets,
      activePersona: 'Submitter',
      activeSessionUserId: 'USR-102',
      activeDemoOrganization: 'Northwind Marine Pty Ltd',
    });
  });

  it('does NOT render upload document or reupload buttons on the Requirements tab', () => {
    render(<AssuranceDetailView setId={testSetId} />);
    fireEvent.click(screen.getByRole('tab', { name: /requirements/i }));

    // Primary header upload button must not exist
    expect(screen.queryByRole('button', { name: /upload document/i })).toBeNull();

    // Table rows must not contain any upload or upload new version buttons
    const uploadButtons = screen.queryAllByRole('button', { name: /upload/i });
    expect(uploadButtons.length).toBe(0);
  });

  it('renders Upload/Reupload actions on the Tasks tab and opens upload modal directly in-place', () => {
    render(<AssuranceDetailView setId={testSetId} />);
    
    // Switch to Tasks tab
    const tasksTab = screen.getByRole('tab', { name: /tasks/i });
    fireEvent.click(tasksTab);

    // Verify Tasks pane is visible
    const tasksPane = screen.getByTestId('assurance-detail-tasks-tab-pane');
    expect(tasksPane).toBeInTheDocument();

    // Find task action buttons inside the tasks pane
    const actionButtons = within(tasksPane).getAllByRole('button', { name: /upload requirement/i });
    expect(actionButtons.length).toBeGreaterThan(0);

    // Clicking Upload button triggers the upload modal in-place without leaving Tasks tab
    fireEvent.click(actionButtons[0]);

    // Modal title should appear in DocumentUploadModal
    expect(screen.getByRole('heading', { name: /upload document — certificate of class/i })).toBeInTheDocument();
  });
});
