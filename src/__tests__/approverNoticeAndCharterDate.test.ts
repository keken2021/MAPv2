import { describe, it, expect, beforeEach } from 'vitest';
import { useMapStore } from '../store/useMapStore';
import { AssuranceSet } from '../types/assurance';
import { filterNotificationsForUser, resolveNotificationRecipient } from '../utils/notificationHelpers';
import { generateUniqueAssuranceSetId } from '../utils/validation';

const initialState = useMapStore.getState();

const inboxOf = (userId: string) =>
  filterNotificationsForUser(useMapStore.getState().notifications, userId);

describe('Task 5530 (A64): Approver sent-back notice and optional charter date', () => {
  beforeEach(() => {
    useMapStore.setState(initialState, true);
    useMapStore.setState({ notifications: [] });
  });

  describe('Approver sent-back notice', () => {
    it('notifies the approver when a task is sent back for correction by verifier', () => {
      const { assuranceSets, users } = useMapStore.getState();
      const targetSet = assuranceSets.find(
        (s) => s.requirements.length > 0 && resolveNotificationRecipient(s.assignedApprover, users),
      );
      expect(targetSet).toBeDefined();
      const approver = resolveNotificationRecipient(targetSet!.assignedApprover, users)!;
      const req = targetSet!.requirements[0];

      useMapStore.setState({
        activePersona: 'Verifier',
        activeDemoOrganization: 'Bureau Veritas Inspectorate',
        activeSessionUserId: 'USR-202',
      });

      useMapStore.getState().updateRequirementStatus(targetSet!.id, req.id, 'Correction Requested', 'Missing endorsement signature.');

      const approverNotice = inboxOf(approver.id).find(
        (n) => n.type === 'document_correction' && n.assuranceSetId === targetSet!.id && n.subject.startsWith('Task sent back for review'),
      );

      expect(approverNotice).toBeDefined();
      expect(approverNotice?.subject).toBe(`Task sent back for review: ${req.title}`);
      expect(approverNotice?.message).toBe('Missing endorsement signature.');
    });

    it('notifies the approver when a task is denied by reviewer with notes', () => {
      const { assuranceSets, users } = useMapStore.getState();
      const targetSet = assuranceSets.find(
        (s) => s.requirements.length > 0 && resolveNotificationRecipient(s.assignedApprover, users),
      );
      expect(targetSet).toBeDefined();
      const approver = resolveNotificationRecipient(targetSet!.assignedApprover, users)!;
      const req = targetSet!.requirements[0];

      useMapStore.setState({
        activePersona: 'Approver',
        activeDemoOrganization: approver.organization,
        activeSessionUserId: approver.id,
      });

      useMapStore.getState().denyRequirementByApprover(targetSet!.id, req.id, 'Correction Requested', 'Expired certificate.');

      const approverNotice = inboxOf(approver.id).find(
        (n) => n.type === 'document_correction' && n.assuranceSetId === targetSet!.id && n.subject.startsWith('Task sent back for review'),
      );

      expect(approverNotice).toBeDefined();
      expect(approverNotice?.subject).toBe(`Task sent back for review: ${req.title}`);
      expect(approverNotice?.message).toBe('Expired certificate.');
    });
  });

  describe('Optional planned charter date on assurance set', () => {
    it('saves assurance set cleanly without a planned charter date (optional)', () => {
      useMapStore.setState({
        activePersona: 'C Admin',
        activeDemoOrganization: 'Chevron Australia Pty Ltd',
        activeSessionUserId: 'USR-221',
      });
      const store = useMapStore.getState();
      const uniqueId = generateUniqueAssuranceSetId(store.assuranceSets);

      const setWithoutCharterDate: AssuranceSet = {
        id: uniqueId,
        title: 'Assurance Set Without Planned Charter Date',
        vesselId: 'VESSEL-001',
        vesselName: 'MV Northern Endeavour',
        imoNumber: '9123453',
        initiatorOrg: 'Chevron Australia Pty Ltd',
        initiatorRole: 'C Admin · Client Created',
        charterer: 'Chevron Australia Pty Ltd',
        createdByUserId: 'USR-221',
        createdByName: 'C. Henderson',
        createdByPersona: 'C Admin',
        charterWindowStart: '2026-11-01',
        charterWindowEnd: '2027-11-01',
        complianceDeadline: '2026-11-01',
        stage: 'Initiated',
        readinessScore: 0,
        mandatoryInspectionRequired: false,
        inspectionCompleted: false,
        requirements: [],
      };

      store.addAssuranceSet(setWithoutCharterDate);

      const savedSet = useMapStore.getState().assuranceSets.find((s) => s.id === uniqueId);
      expect(savedSet).toBeDefined();
      expect(savedSet?.plannedCharterDate).toBeUndefined();
    });

    it('saves and updates assurance set with planned charter date when provided', () => {
      useMapStore.setState({
        activePersona: 'C Admin',
        activeDemoOrganization: 'Chevron Australia Pty Ltd',
        activeSessionUserId: 'USR-221',
      });
      const store = useMapStore.getState();
      const uniqueId = generateUniqueAssuranceSetId(store.assuranceSets);

      const setWithCharterDate: AssuranceSet = {
        id: uniqueId,
        title: 'Assurance Set With Planned Charter Date',
        vesselId: 'VESSEL-001',
        vesselName: 'MV Northern Endeavour',
        imoNumber: '9123453',
        initiatorOrg: 'Chevron Australia Pty Ltd',
        initiatorRole: 'C Admin · Client Created',
        charterer: 'Chevron Australia Pty Ltd',
        createdByUserId: 'USR-221',
        createdByName: 'C. Henderson',
        createdByPersona: 'C Admin',
        charterWindowStart: '2026-11-01',
        charterWindowEnd: '2027-11-01',
        plannedCharterDate: '2026-11-15',
        complianceDeadline: '2026-11-01',
        stage: 'Initiated',
        readinessScore: 0,
        mandatoryInspectionRequired: false,
        inspectionCompleted: false,
        requirements: [],
      };

      store.addAssuranceSet(setWithCharterDate);

      let savedSet = useMapStore.getState().assuranceSets.find((s) => s.id === uniqueId);
      expect(savedSet).toBeDefined();
      expect(savedSet?.plannedCharterDate).toBe('2026-11-15');

      // Update planned charter date
      store.updateAssuranceSet({
        ...savedSet!,
        plannedCharterDate: '2026-12-01',
      });

      savedSet = useMapStore.getState().assuranceSets.find((s) => s.id === uniqueId);
      expect(savedSet?.plannedCharterDate).toBe('2026-12-01');
    });
  });
});
