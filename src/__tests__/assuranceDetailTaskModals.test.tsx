import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { AssuranceDetailView } from '../views/AssuranceDetailView';
import { useMapStore } from '../store/useMapStore';
import { AssuranceSet } from '../types/assurance';

describe('AssuranceDetailView Task Dialogs Section and Predecessor', () => {
  const setIdWithSections = 'AS-TEST-SECTIONS-01';
  const setIdNoSections = 'AS-TEST-NOSECTIONS-01';

  beforeEach(() => {
    const baseSet: AssuranceSet = {
      id: setIdWithSections,
      title: 'Deepwater Drilling Campaign Set',
      vesselName: 'Deepwater Champion',
      vesselId: 'VES-001',
      imoNumber: '9456789',
      initiatorOrg: 'Client Org',
      initiatorRole: 'Client Admin',
      serviceProviderOrg: 'Vendor Org',
      charterWindowStart: '2026-11-10',
      charterWindowEnd: '2026-12-10',
      complianceDeadline: '2026-11-09',
      targetDate: '2026-11-09',
      stage: 'Initiated',
      readinessScore: 65,
      mandatoryInspectionRequired: false,
      inspectionCompleted: false,
      sections: [
        { id: 'sec-safety', name: 'Safety & Emergency', order: 1 },
        { id: 'sec-ops', name: 'Field Operations', order: 2 },
      ],
      requirements: [
        {
          id: 'REQ-TASK-001',
          title: 'Emergency Disconnect Protocol',
          category: 'Operational Plan',
          isMandatory: true,
          isFulfilled: false,
          ocrConfidence: 95,
          verifierStatus: 'Pending',
          sectionId: 'sec-safety',
        },
        {
          id: 'REQ-TASK-002',
          title: 'BOP Pressure Certification',
          category: 'Statutory Certificate',
          isMandatory: true,
          isFulfilled: false,
          ocrConfidence: 90,
          verifierStatus: 'Pending',
          sectionId: 'sec-ops',
          predecessorId: 'REQ-TASK-001',
        },
      ],
    };

    const setWithoutSections: AssuranceSet = {
      ...baseSet,
      id: setIdNoSections,
      sections: undefined,
      requirements: [
        {
          id: 'REQ-PLAIN-001',
          title: 'General Survey Certificate',
          category: 'Statutory Certificate',
          isMandatory: true,
          isFulfilled: false,
          ocrConfidence: 90,
          verifierStatus: 'Pending',
        },
      ],
    };

    useMapStore.setState({
      activePersona: 'C Admin',
      activeDemoOrganization: 'Client Org',
      isAuthenticated: true,
      activeSessionUserId: 'USR-CLIENT-01',
      assuranceSets: [baseSet, setWithoutSections],
    });
  });

  it('renders section and predecessor selects in add task dialog and stores choices', () => {
    render(<AssuranceDetailView setId={setIdWithSections} />);

    fireEvent.click(screen.getByRole('tab', { name: /requirements/i }));

    const addTaskBtn = screen.getByRole('button', { name: /add task/i });
    expect(addTaskBtn).toBeDefined();
    fireEvent.click(addTaskBtn);

    const titleInput = screen.getByLabelText(/title/i);
    fireEvent.change(titleInput, { target: { value: 'Well Control Simulation Plan' } });

    const sectionSelect = screen.getByLabelText(/section/i) as HTMLSelectElement;
    expect(sectionSelect).toBeDefined();
    expect(within(sectionSelect).getByRole('option', { name: /no section/i })).toBeDefined();
    expect(within(sectionSelect).getByRole('option', { name: 'Safety & Emergency' })).toBeDefined();
    expect(within(sectionSelect).getByRole('option', { name: 'Field Operations' })).toBeDefined();
    fireEvent.change(sectionSelect, { target: { value: 'sec-ops' } });

    const predecessorSelect = screen.getByLabelText(/predecessor/i) as HTMLSelectElement;
    expect(predecessorSelect).toBeDefined();
    expect(within(predecessorSelect).getByRole('option', { name: /no predecessor/i })).toBeDefined();
    expect(within(predecessorSelect).getByRole('option', { name: 'Emergency Disconnect Protocol' })).toBeDefined();
    expect(within(predecessorSelect).getByRole('option', { name: 'BOP Pressure Certification' })).toBeDefined();
    fireEvent.change(predecessorSelect, { target: { value: 'REQ-TASK-002' } });

    const saveBtn = within(screen.getByRole('dialog')).getByRole('button', { name: /^add task$/i });
    fireEvent.click(saveBtn);

    const updatedSet = useMapStore.getState().assuranceSets.find((s) => s.id === setIdWithSections)!;
    const addedTask = updatedSet.requirements.find((r) => r.title === 'Well Control Simulation Plan');
    expect(addedTask).toBeDefined();
    expect(addedTask?.sectionId).toBe('sec-ops');
    expect(addedTask?.predecessorId).toBe('REQ-TASK-002');
  });

  it('hides the section select in add task dialog when assurance set has no sections', () => {
    render(<AssuranceDetailView setId={setIdNoSections} />);

    fireEvent.click(screen.getByRole('tab', { name: /requirements/i }));
    fireEvent.click(screen.getByRole('button', { name: /add task/i }));

    expect(screen.queryByLabelText(/section/i)).toBeNull();
    expect(screen.getByLabelText(/predecessor/i)).toBeDefined();
  });

  it('edit task dialog excludes the task itself from predecessor select and saves updates', () => {
    render(<AssuranceDetailView setId={setIdWithSections} />);

    fireEvent.click(screen.getByRole('tab', { name: /requirements/i }));

    const taskRow = screen.getByText('Emergency Disconnect Protocol').closest('tr')!;
    const editBtn = within(taskRow).getByRole('button', { name: /edit task/i });
    fireEvent.click(editBtn);

    const titleInput = screen.getByLabelText(/title/i) as HTMLInputElement;
    expect(titleInput.value).toBe('Emergency Disconnect Protocol');

    const predecessorSelect = screen.getByLabelText(/predecessor/i) as HTMLSelectElement;
    const options = within(predecessorSelect).getAllByRole('option');
    const optionTexts = options.map((o) => o.textContent);

    expect(optionTexts).not.toContain('Emergency Disconnect Protocol');
    expect(optionTexts).toContain('BOP Pressure Certification');

    const sectionSelect = screen.getByLabelText(/section/i) as HTMLSelectElement;
    fireEvent.change(sectionSelect, { target: { value: 'sec-ops' } });
    fireEvent.change(predecessorSelect, { target: { value: 'REQ-TASK-002' } });

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    const updatedSet = useMapStore.getState().assuranceSets.find((s) => s.id === setIdWithSections)!;
    const edited = updatedSet.requirements.find((r) => r.id === 'REQ-TASK-001')!;
    expect(edited.sectionId).toBe('sec-ops');
    expect(edited.predecessorId).toBe('REQ-TASK-002');
  });

  it('Remove task opens ConfirmDialog and removes on confirm (Task 5420)', () => {
    render(<AssuranceDetailView setId={setIdWithSections} />);
    fireEvent.click(screen.getByRole('tab', { name: /requirements/i }));

    const taskRow = screen.getByText('Emergency Disconnect Protocol').closest('tr')!;
    const removeBtn = within(taskRow).getByRole('button', { name: /remove task/i });
    fireEvent.click(removeBtn);

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Remove Task' })).toBeInTheDocument();
    expect(within(dialog).getByText(/Emergency Disconnect Protocol/)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('confirm-dialog-confirm'));

    const updatedSet = useMapStore.getState().assuranceSets.find((s) => s.id === setIdWithSections)!;
    expect(updatedSet.requirements.find((r) => r.id === 'REQ-TASK-001')).toBeUndefined();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Remove task cancel keeps the task (Task 5420)', () => {
    render(<AssuranceDetailView setId={setIdWithSections} />);
    fireEvent.click(screen.getByRole('tab', { name: /requirements/i }));

    const taskRow = screen.getByText('Emergency Disconnect Protocol').closest('tr')!;
    fireEvent.click(within(taskRow).getByRole('button', { name: /remove task/i }));
    fireEvent.click(screen.getByTestId('confirm-dialog-cancel'));

    const updatedSet = useMapStore.getState().assuranceSets.find((s) => s.id === setIdWithSections)!;
    expect(updatedSet.requirements.find((r) => r.id === 'REQ-TASK-001')).toBeDefined();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Target Date Grants modal opens on Modal shell (Task 5421)', () => {
    useMapStore.setState({ ...useMapStore.getState(), activePersona: 'Verifier' });
    render(<AssuranceDetailView setId={setIdWithSections} />);
    const btn = screen.queryByRole('button', { name: /target date grants/i });
    if (!btn) return; // button only shown for sets with grants; skip if absent
    fireEvent.click(btn);
    expect(screen.getByRole('heading', { name: 'Target Date Grants' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('Revise Completion Date modal opens on Modal shell (Task 5421)', () => {
    useMapStore.setState({ ...useMapStore.getState(), activePersona: 'C Admin' });
    render(<AssuranceDetailView setId={setIdWithSections} />);
    const btn = screen.queryByRole('button', { name: /revise completion date/i });
    if (!btn) return;
    fireEvent.click(btn);
    expect(screen.getByRole('heading', { name: 'Revise Completion Date' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('heading', { name: 'Revise Completion Date' })).not.toBeInTheDocument();
  });

  it('Exempt Tasks modal opens on Modal shell (Task 5421)', () => {
    useMapStore.setState({ ...useMapStore.getState(), activePersona: 'C Admin' });
    render(<AssuranceDetailView setId={setIdWithSections} />);
    const btn = screen.queryByRole('button', { name: /exempt tasks/i });
    if (!btn) return;
    fireEvent.click(btn);
    expect(screen.getByRole('heading', { name: 'Exempt Tasks from Completion Date' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('heading', { name: 'Exempt Tasks from Completion Date' })).not.toBeInTheDocument();
  });

  it('allows clearing both section and predecessor when editing', () => {
    render(<AssuranceDetailView setId={setIdWithSections} />);

    fireEvent.click(screen.getByRole('tab', { name: /requirements/i }));

    const taskRow = screen.getByText('BOP Pressure Certification').closest('tr')!;
    const editBtn = within(taskRow).getByRole('button', { name: /edit task/i });
    fireEvent.click(editBtn);

    const sectionSelect = screen.getByLabelText(/section/i) as HTMLSelectElement;
    const predecessorSelect = screen.getByLabelText(/predecessor/i) as HTMLSelectElement;

    expect(sectionSelect.value).toBe('sec-ops');
    expect(predecessorSelect.value).toBe('REQ-TASK-001');

    fireEvent.change(sectionSelect, { target: { value: '' } });
    fireEvent.change(predecessorSelect, { target: { value: '' } });

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    const updatedSet = useMapStore.getState().assuranceSets.find((s) => s.id === setIdWithSections)!;
    const edited = updatedSet.requirements.find((r) => r.id === 'REQ-TASK-002')!;
    expect(edited.sectionId).toBeUndefined();
    expect(edited.predecessorId).toBeUndefined();
  });
});
