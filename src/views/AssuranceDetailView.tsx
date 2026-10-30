/* 
  file summary: assurance set command center deep-dive view presenting stage pipeline stepper and requirements register in light theme.
  responsibilities: manages requirement verification statuses, displays pipeline stage progress, and enforces C Admin read-only rules.
  role in system: deep-dive view rendered when an assurance set row is selected.
*/

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, FolderOpen, FileCheck, FileText, Lock, RefreshCw, Upload, Pencil, Calendar, Key, ShieldCheck, Plus, Trash2 } from 'lucide-react';
import { useMapStore } from '../store/useMapStore';
import { PipelineStepper } from '../components/common/PipelineStepper';
import { ReadinessGauge } from '../components/common/ReadinessGauge';
import { DetailHeader } from '../components/common/DetailHeader';
import { ConfidenceBadge } from '../components/common/ConfidenceBadge';
import { DocumentReviewDrawer } from '../components/drawers/DocumentReviewDrawer';
import { formatMaritimeDate, formatMaritimeDateTime, formatReviewChannel, getProviderLabel, getStatusDisplayLabel } from '../utils/formatters';
import { setOrganizationParties } from '../utils/projectHelpers';
import {
  toIsoLocalDate,
  validateCharterWindow,
  validateComplianceDeadline,
  isComplianceDeadlineOverdue,
  validateTaskTargetDate,
  TASK_DATE_AFTER_SET_DATE,
  DATE_PERMISSION_REQUIRED,
  DATE_PERMISSION_EXPIRED,
  isDatePermissionActive,
} from '../utils/validation';
import { MasterDocument } from '../types/document';
import { AssuranceRequirement, DatePermissionGrant, TargetDateChangeRecord } from '../types/assurance';
import { filterProjectsForPersona, getProjectForAssuranceSet, isAssuranceSetOrphaned } from '../utils/projectHelpers';

import { VersionHistoryDrawer } from '../components/drawers/VersionHistoryDrawer';
import { exportToCsv, exportToPdf } from '../utils/exportHelpers';
import { DocumentUploadModal } from '../components/modals/DocumentUploadModal';
import {
  userHasRole,
  filterCandidatesByReviewMode,
  filterEligibleApproversForScope,
  getSessionUserForPersona,
} from '../utils/userRoleHelpers';
import {
  calculateAssuranceSetReadiness,
  summarizeTaskSections,
  getAssuranceSetOnTimeStatus,
  getAssuranceSetOpenFindings,
  getAssuranceSetRemainingItems,
} from '../utils/readinessHelpers';
import TaskSectionCards from '../components/common/TaskSectionCards';
import {
  canEditAssuranceSetStakeholders,
  getAssuranceSetRoleActions,
  getAssuranceSetCreator,
  getAssuranceSetStakeholderLockReason,
  isClientUser,
  getUserActiveDatePermission,
  assigneeMatchesUser,
  filterAuditTrailForPersona,
} from '../utils/rbacHelpers';
import { useSessionUser } from '../utils/useSessionUser';
import { ApproverDecisionBar } from '../components/common/ApproverDecisionBar';
import { getDocumentReuploadBlockReason, documentExpiresBeforeContractEnd, listCertificatesShortOfContract } from '../utils/documentRenewalHelpers';
import { useOverlayBehavior } from '../utils/useOverlayBehavior';
import { getAssuranceSetAssets, getAssuranceSetCrewIds, getAssuranceSetScopes } from '../utils/assuranceTemplates';
import { findOverlappingAssuranceSets, formatOverlapError } from '../utils/assuranceOverlap';
import {
  getRequirementDocumentView,
  isClosedAssuranceSet,
  RequirementDocumentView,
} from '../utils/documentVersionSnapshot';
import { usePagination } from '../utils/usePagination';
import { TablePagination } from '../components/common/TablePagination';
import { getValidityInContractPeriod } from '../utils/expiryPolicy';
import { EmptyState } from '../components/common/EmptyState';
import { AuditTrailEvent } from '../types/audit';
import { getRoleDisplayLabel } from '../utils/userRoleHelpers';

export type AssuranceDetailTab = 'details' | 'requirements' | 'tasks' | 'audit';

function parseTabFromUrl(): AssuranceDetailTab {
  if (typeof window === 'undefined') return 'details';
  const hash = window.location.hash || '';
  const search = window.location.search || '';

  let tabParam: string | null = null;
  if (hash.includes('?')) {
    const params = new URLSearchParams(hash.split('?')[1]);
    tabParam = params.get('tab');
  }
  if (!tabParam && search) {
    const params = new URLSearchParams(search);
    tabParam = params.get('tab');
  }
  if (!tabParam) {
    const clean = hash.replace(/^#\/?/, '').split('?')[0];
    const parts = clean.split('/');
    if (parts.length >= 3) {
      tabParam = parts[2];
    }
  }
  if (tabParam) {
    const lower = tabParam.toLowerCase();
    if (lower === 'requirements') return 'requirements';
    if (lower === 'tasks') return 'tasks';
    if (lower === 'audit' || lower === 'audit-trail' || lower === 'audittrail') return 'audit';
    if (lower === 'details') return 'details';
  }
  return 'details';
}

function displayAuditValue(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(value)) return value;
  const formatted = formatMaritimeDate(value);
  return formatted === 'N/A' ? value : formatted;
}

function displayAuditChange(event: AuditTrailEvent): string {
  if (event.fieldDelta) {
    return `${event.fieldDelta.fieldName}: ${displayAuditValue(event.fieldDelta.oldValue)} to ${displayAuditValue(event.fieldDelta.newValue)}`;
  }
  if (event.documentStatusDelta) {
    return `Status: ${event.documentStatusDelta.oldStatus} to ${event.documentStatusDelta.newStatus}`;
  }
  return 'No change';
}

interface AssuranceDetailViewProps {
  setId: string;
}

/**
  what: renders assurance set command center deep-dive view in light theme.
  how: displays pipeline stepper header, requirement register table with export controls, and opens DocumentReviewDrawer, VersionHistoryDrawer, or DocumentUploadModal based on persona RBAC.
  with what file: src/views/AssuranceDetailView.tsx loaded by App.tsx.
*/
export const AssuranceDetailView: React.FC<AssuranceDetailViewProps> = ({ setId }) => {
  const {
    assuranceSets,
    vessels,
    auditEvents,
    updateRequirementStatus,
    updateAssuranceStakeholder,
    updateAssuranceInspector,
    updateAssuranceSet,
    raiseDocumentRenewalNotifications,
    documents,
    capaItems,
    activePersona,
    activeDemoOrganization,
    activeSessionUserId,
    users,
    projects,
    attachAssuranceSetToProject,
    setCurrentHashView,
    notifications,
    grantDatePermission,
    revokeDatePermission,
    updateTaskTargetDate,
    reviseAssuranceSetDeadline,
    focusedRequirementId,
    setFocusedRequirementId,
    exemptAssuranceTasks,
    partiallyCloseAssuranceSet,
    cancelAssuranceSet,
    addAssuranceTask,
    editAssuranceTask,
    removeAssuranceTask,
  } = useMapStore();
  const [stakeholderError, setStakeholderError] = useState<string | null>(null);
  const [isAddToProjectOpen, setIsAddToProjectOpen] = useState(false);
  const [isEditingCharterWindow, setIsEditingCharterWindow] = useState(false);
  const [charterStartDraft, setCharterStartDraft] = useState('');
  const [charterEndDraft, setCharterEndDraft] = useState('');
  const [deadlineDraft, setDeadlineDraft] = useState('');
  const [deadlineReasonDraft, setDeadlineReasonDraft] = useState('');
  const [isDatePermissionsModalOpen, setIsDatePermissionsModalOpen] = useState(false);
  const [selectedGranteeId, setSelectedGranteeId] = useState('');
  const [grantDurationHours, setGrantDurationHours] = useState('24');
  const [grantReasonDraft, setGrantReasonDraft] = useState('');
  // Date history moved to Audit Trail tab
  const [editingTaskDate, setEditingTaskDate] = useState<{ reqId: string; title: string; currentDate: string } | null>(null);
  const [taskDateDraft, setTaskDateDraft] = useState('');
  const [taskDateReasonDraft, setTaskDateReasonDraft] = useState('');
  const [taskDateError, setTaskDateError] = useState<string | null>(null);
  const [charterWindowErrors, setCharterWindowErrors] = useState<{ start?: string; end?: string; deadline?: string }>({});
  const [isReviseDeadlineModalOpen, setIsReviseDeadlineModalOpen] = useState(false);
  const [revisedDateDraft, setRevisedDateDraft] = useState('');
  const [revisedDateReason, setRevisedDateReason] = useState('');
  const [revisedDateError, setRevisedDateError] = useState<string | null>(null);

  const [isExemptTasksModalOpen, setIsExemptTasksModalOpen] = useState(false);
  const [selectedExemptTaskIds, setSelectedExemptTaskIds] = useState<string[]>([]);
  const [exemptionReasonDraft, setExemptionReasonDraft] = useState('');
  const [exemptionGrantedByDraft, setExemptionGrantedByDraft] = useState('');
  const [exemptionNewDateDraft, setExemptionNewDateDraft] = useState('');
  const [exemptionError, setExemptionError] = useState<string | null>(null);

  const [isPartialCloseModalOpen, setIsPartialCloseModalOpen] = useState(false);
  const [partialCloseNotes, setPartialCloseNotes] = useState('');

  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancellationReasonDraft, setCancellationReasonDraft] = useState('');

  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [newTaskDraft, setNewTaskDraft] = useState({
    title: '',
    category: 'Statutory Certificate',
    description: '',
    isMandatory: true,
    targetDate: '',
    assignedSubmitter: '',
    assignedVerifier: '',
  });
  const [newTaskError, setNewTaskError] = useState<string | null>(null);

  const [editingTask, setEditingTask] = useState<AssuranceRequirement | null>(null);
  const [editTaskDraft, setEditTaskDraft] = useState({
    title: '',
    category: 'Statutory Certificate',
    description: '',
    isMandatory: true,
    targetDate: '',
    assignedSubmitter: '',
    assignedVerifier: '',
  });
  const [editTaskError, setEditTaskError] = useState<string | null>(null);

  const [taskToDelete, setTaskToDelete] = useState<AssuranceRequirement | null>(null);
  const [shortCertificateConfirm, setShortCertificateConfirm] = useState<MasterDocument[] | null>(null);
  const confirmDialogRef = useRef<HTMLDivElement>(null);
  const [targetProjectId, setTargetProjectId] = useState('');
  const [addToProjectError, setAddToProjectError] = useState<string | null>(null);
  const [projectToast, setProjectToast] = useState<string | null>(null);
  const [selectedDocForReview, setSelectedDocForReview] = useState<{ doc: MasterDocument; notes?: string; requirementId?: string; verifierStatus?: string; isVersionLocked?: boolean } | null>(null);
  const [selectedDocForVersionHistory, setSelectedDocForVersionHistory] = useState<MasterDocument | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadTargetRequirement, setUploadTargetRequirement] = useState<AssuranceRequirement | null>(null);
  const [replaceExistingDoc, setReplaceExistingDoc] = useState<MasterDocument | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [sectionsOpen, setSectionsOpen] = useState(true);
  const [editingRole, setEditingRole] = useState<'Submitter' | 'Verifier' | 'Inspector' | 'Approver' | null>(null);

  type ReqSortField = 'title' | 'targetDate' | 'ocrConfidence' | 'status';
  useOverlayBehavior(confirmDialogRef, () => setShortCertificateConfirm(null), {
    active: shortCertificateConfirm !== null,
  });

  const [reqSortField, setReqSortField] = useState<ReqSortField>('title');
  const [reqSortDirection, setReqSortDirection] = useState<'asc' | 'desc'>('asc');

  const renderSortIndicator = (field: ReqSortField) => {
    if (reqSortField !== field) {
      return <ArrowUpDown size={14} className="text-muted ms-1 opacity-50 inline-block align-middle" />;
    }
    return reqSortDirection === 'asc' ? (
      <ArrowUp size={14} className="text-primary ms-1 inline-block align-middle" />
    ) : (
      <ArrowDown size={14} className="text-primary ms-1 inline-block align-middle" />
    );
  };

  const handleReqSort = (field: ReqSortField) => {
    if (reqSortField === field) {
      setReqSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
    } else {
      setReqSortField(field);
      setReqSortDirection('asc');
    }
  };

  const cleanSetId = setId ? setId.split('?')[0].split('/')[0] : '';
  const assuranceSet = assuranceSets.find((s) => s.id === cleanSetId || s.id === setId) || assuranceSets[0];

  const [activeTab, setActiveTab] = useState<AssuranceDetailTab>(() => parseTabFromUrl());

  const handleTabChange = (tab: AssuranceDetailTab) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const baseHash = `#/assurance-sets/${assuranceSet.id}`;
      const tabParam = tab === 'audit' ? 'audit-trail' : tab;
      const targetHash = tab === 'details' ? baseHash : `${baseHash}?tab=${tabParam}`;
      if (window.location.hash !== targetHash) {
        window.location.hash = targetHash;
      }
    }
  };

  useEffect(() => {
    const onHashChange = () => {
      const tabFromUrl = parseTabFromUrl();
      setActiveTab((prev) => (prev !== tabFromUrl ? tabFromUrl : prev));
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    if (focusedRequirementId) {
      setActiveTab('requirements');
    }
  }, [focusedRequirementId]);
  const sortedRequirements = useMemo(() => {
    if (!assuranceSet?.requirements) return [];
    return [...assuranceSet.requirements].sort((a, b) => {
      let comp = 0;
      if (reqSortField === 'title') {
        comp = a.title.localeCompare(b.title);
      } else if (reqSortField === 'targetDate') {
        const dateA = a.targetDate || assuranceSet.targetDate || assuranceSet.complianceDeadline || '';
        const dateB = b.targetDate || assuranceSet.targetDate || assuranceSet.complianceDeadline || '';
        comp = dateA.localeCompare(dateB);
      } else if (reqSortField === 'ocrConfidence') {
        const docA = documents.find((d) => d.id === a.documentId || (a.linkedDocumentId && d.id === a.linkedDocumentId));
        const docB = documents.find((d) => d.id === b.documentId || (b.linkedDocumentId && d.id === b.linkedDocumentId));
        const scoreA = a.ocrConfidence || docA?.ocrConfidence || 0;
        const scoreB = b.ocrConfidence || docB?.ocrConfidence || 0;
        comp = scoreA - scoreB;
      } else if (reqSortField === 'status') {
        const statusA = a.verifierStatus || (a.isFulfilled ? 'Verified' : 'Awaiting Upload');
        const statusB = b.verifierStatus || (b.isFulfilled ? 'Verified' : 'Awaiting Upload');
        comp = statusA.localeCompare(statusB);
      }
      return reqSortDirection === 'asc' ? comp : -comp;
    });
  }, [assuranceSet, reqSortField, reqSortDirection, documents]);

  const isCAdminPersona = activePersona === 'C Admin';
  const clientOwnerOrg =
    assuranceSet?.clientOrg || assuranceSet?.charterer || assuranceSet?.initiatorOrg || '';
  const serviceProviderOrg = assuranceSet?.serviceProviderOrg;
  const organizationParties = assuranceSet ? setOrganizationParties(assuranceSet) : [];

  const verifierCandidates = useMemo(
    () =>
      filterCandidatesByReviewMode(
        users,
        assuranceSet?.reviewMode || 'third_party',
        'Verifier',
        { clientOrg: clientOwnerOrg, serviceProviderOrg },
      ),
    [users, assuranceSet?.reviewMode, clientOwnerOrg, serviceProviderOrg],
  );

  const approverCandidates = useMemo(
    () =>
      filterEligibleApproversForScope(users, {
        serviceProviderOrg,
        isClientAdmin: isCAdminPersona,
        isCharteringOtherServices: true,
      }),
    [users, serviceProviderOrg, isCAdminPersona],
  );

  const sectionSummaries = useMemo(() => summarizeTaskSections(assuranceSet), [assuranceSet]);
  const onTimeStatus = useMemo(() => getAssuranceSetOnTimeStatus(assuranceSet), [assuranceSet]);
  const openFindings = useMemo(() => getAssuranceSetOpenFindings(assuranceSet, capaItems), [assuranceSet, capaItems]);
  const remainingItems = useMemo(() => getAssuranceSetRemainingItems(assuranceSet), [assuranceSet]);
  const sectionNameFor = (sectionId?: string) =>
    assuranceSet.sections?.find((section) => section.id === sectionId)?.name;
  const predecessorTitleFor = (taskId?: string) =>
    assuranceSet.requirements.find((task) => task.id === taskId)?.title;
  const renderTaskPlacement = (req: AssuranceRequirement) => {
    const sectionName = sectionNameFor(req.sectionId);
    const predecessor = predecessorTitleFor(req.predecessorId);
    if (!sectionName && !predecessor) return null;
    return (
      <div className="small text-secondary fw-normal">
        {sectionName}
        {predecessor ? `${sectionName ? ' · ' : ''}After ${predecessor}` : ''}
      </div>
    );
  };

  const mainRequirements = sortedRequirements.filter((r) => !r.isOtherDocument);
  const otherRequirements = sortedRequirements.filter((r) => r.isOtherDocument);
  /* one page sequence for the whole table: requirements first, then other documents */
  const requirementsPagination = usePagination(
    [...mainRequirements, ...otherRequirements],
    [assuranceSet?.id, reqSortField, reqSortDirection],
  );
  const pageMainRequirements = requirementsPagination.pageItems.filter((r) => !r.isOtherDocument);
  const pageOtherRequirements = requirementsPagination.pageItems.filter((r) => r.isOtherDocument);
  const isLastRequirementsPage =
    requirementsPagination.controls.page === requirementsPagination.controls.totalPages;

  useEffect(() => {
    if (!focusedRequirementId) return;
    const items = [...mainRequirements, ...otherRequirements];
    const index = items.findIndex((requirement) => requirement.id === focusedRequirementId);
    if (index < 0) {
      setFocusedRequirementId(undefined);
      return;
    }
    const page = Math.floor(index / requirementsPagination.controls.pageSize) + 1;
    if (requirementsPagination.controls.page !== page) {
      requirementsPagination.controls.onPageChange(page);
      return;
    }
    document
      .querySelector(`[data-requirement-id="${focusedRequirementId}"]`)
      ?.scrollIntoView({ block: 'center' });
    setFocusedRequirementId(undefined);
  }, [focusedRequirementId, requirementsPagination.controls.page, setFocusedRequirementId]);

  const activeUser = useSessionUser();
  const sessionUser = activeUser ?? undefined;
  const currentUserId = sessionUser?.id || activeSessionUserId;

  const visibleEvents = useMemo(
    () => filterAuditTrailForPersona(auditEvents, activePersona, assuranceSets, vessels, currentUserId),
    [auditEvents, activePersona, assuranceSets, vessels, currentUserId],
  );

  const setAuditEvents = useMemo(() => {
    const rawSetEvents = visibleEvents.filter((ev) => {
      const target = ev.target;
      return (
        target &&
        (target.kind === 'set' || target.kind === 'task' || target.kind === 'date') &&
        target.setId === assuranceSet.id
      );
    });

    const dateHistoryEvents: AuditTrailEvent[] = (assuranceSet.targetDateHistory || []).map((row) => {
      const matchingUser = users.find((u) => u.name === row.changedBy || u.id === row.changedBy || row.changedBy.startsWith(u.name) || row.changedBy.startsWith(u.id));
      return {
      id: row.id,
      timestampUtc: row.changedAt,
      userId: matchingUser ? matchingUser.id : row.changedBy,
      userRole: (matchingUser?.roles?.[0] as import('../types/audit').UserRolePersona) || 'Administrator',
      organization: matchingUser?.organization || assuranceSet.clientOrg || assuranceSet.initiatorOrg || 'Client Organization',
      action: 'Changed date',
      targetAsset: `${assuranceSet.id} (${assuranceSet.title})`,
      target: {
        kind: 'date',
        setId: assuranceSet.id,
        dateField: row.scope === 'set' ? 'complianceDeadline' : 'targetDate',
        taskId: row.scope === 'task' ? (row.taskId || row.requirementId) : undefined,
      },
      fieldDelta: {
        fieldName: row.scope === 'set' ? 'Compliance deadline' : (row.taskTitle || row.taskId || 'Task target date'),
        oldValue: row.oldDate,
        newValue: row.newDate,
      },
      justificationNotes: row.reason,
    }; });

    const visibleDateHistory = filterAuditTrailForPersona(
      dateHistoryEvents,
      activePersona,
      assuranceSets,
      vessels,
      currentUserId,
    );

    const all = [...rawSetEvents, ...visibleDateHistory];
    all.sort((a, b) => new Date(b.timestampUtc).getTime() - new Date(a.timestampUtc).getTime());

    const seenIds = new Set<string>();
    const seenDateDeltas = new Set<string>();
    const deduplicated: AuditTrailEvent[] = [];

    for (const ev of all) {
      if (seenIds.has(ev.id)) continue;
      seenIds.add(ev.id);

      if (ev.action === 'Changed date' || ev.target?.kind === 'date') {
        const deltaKey = `${ev.timestampUtc.slice(0, 19)}_${ev.fieldDelta?.oldValue}_${ev.fieldDelta?.newValue}`;
        if (seenDateDeltas.has(deltaKey)) continue;
        seenDateDeltas.add(deltaKey);
      }

      deduplicated.push(ev);
    }

    return deduplicated;
  }, [visibleEvents, assuranceSet, activePersona, assuranceSets, vessels, currentUserId]);

  const isApproverViewer = activePersona === 'Approver';
  const isNamedApprover =
    isApproverViewer &&
    Boolean(sessionUser) &&
    assigneeMatchesUser(assuranceSet?.assignedApprover, sessionUser);
  const isApprovalStage =
    assuranceSet?.stage === 'Approval' &&
    assuranceSet?.approverDecision !== 'Approved' &&
    assuranceSet?.approverDecision !== 'Returned for Correction' &&
    assuranceSet?.approverDecision !== 'Rejected';
  const showApproverDecisionBar = isNamedApprover && isApprovalStage;

  if (!assuranceSet) return <div>Assurance Set not found.</div>;

  if (assuranceSet.visibility === 'draft') {
    return (
      <div className="card map-card-custom p-4 text-center my-4">
        <div className="py-4">
          <div className="badge bg-warning-subtle text-dark border border-warning-subtle px-3 py-1.5 mb-3">
            Draft
          </div>
          <h4 className="fw-bold text-dark">{assuranceSet.title}</h4>
          <p className="text-secondary mx-auto mb-4" style={{ maxWidth: '550px' }}>
            This assurance set is a draft. Finish setup to create it.
          </p>
          <div className="d-flex align-items-center justify-content-center gap-3">
            {getAssuranceSetRoleActions(assuranceSet, activePersona, activeDemoOrganization, sessionUser).canManage && (
              <button
                type="button"
                className="btn btn-primary px-4 fw-semibold"
                onClick={() => setCurrentHashView('create-assurance-set', assuranceSet.id)}
              >
                Continue Setup
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const isCAdmin = isCAdminPersona;
  const roleActions = getAssuranceSetRoleActions(assuranceSet, activePersona, activeDemoOrganization, sessionUser);
  const shortCertificates = listCertificatesShortOfContract(
    assuranceSet,
    documents,
    assuranceSet.charterWindowEnd,
  );
  const complianceOverdue = isComplianceDeadlineOverdue(assuranceSet);
  const renderContractShortWarning = (doc?: MasterDocument) => {
    if (!doc || !documentExpiresBeforeContractEnd(doc, assuranceSet.charterWindowEnd)) return null;
    return (
      <div className="text-danger small mt-1">
        Expires {formatMaritimeDate(doc.expiryDate)}, before the contract ends {formatMaritimeDate(assuranceSet.charterWindowEnd)}. Re-upload a certificate that covers the contract.
      </div>
    );
  };

  /* asset under assurance: its type, display name and the registry page it opens; a crew set may list several members (ADR 0023) */
  const assuredAsset = ((): {
    typeLabel: string;
    name: string;
    view?: string;
    entityId?: string;
    members?: { id: string; name: string }[];
  } => {
    if (assuranceSet.assuranceType === 'Crew') {
      const members = getAssuranceSetAssets(assuranceSet).map((asset) => ({ id: asset.id, name: asset.name }));
      return {
        typeLabel: 'Crew',
        name: assuranceSet.crewName || assuranceSet.vesselName,
        view: assuranceSet.crewId ? 'crew' : undefined,
        entityId: assuranceSet.crewId,
        members: assuranceSet.crewId ? members : undefined,
      };
    }
    if (assuranceSet.assuranceType === 'Equipment') {
      return {
        typeLabel: 'Equipment',
        name: assuranceSet.equipmentName || assuranceSet.vesselName,
        view: assuranceSet.equipmentId ? 'equipment' : undefined,
        entityId: assuranceSet.equipmentId,
      };
    }
    if (assuranceSet.assuranceType === 'Activity') {
      return { typeLabel: 'Activity', name: assuranceSet.activityName || assuranceSet.vesselName };
    }
    const targetVessel = vessels.find(
      (v) => v.id === assuranceSet.vesselId || v.name.toLowerCase() === assuranceSet.vesselName.toLowerCase(),
    );
    return {
      typeLabel: 'Vessel',
      name: `${assuranceSet.vesselName} (IMO ${assuranceSet.imoNumber})`,
      view: targetVessel || assuranceSet.vesselId ? 'vessels' : undefined,
      entityId: targetVessel?.id || assuranceSet.vesselId,
    };
  })();

  /* project side of the set: zero or one project per set */
  const linkedProject = getProjectForAssuranceSet(assuranceSet, projects);
  const canAddToProject = roleActions.canManage && isAssuranceSetOrphaned(assuranceSet, projects);
  const attachableProjects = canAddToProject
    ? filterProjectsForPersona(
      projects,
      activePersona,
      users,
      assuranceSets,
      activePersona === 'C Admin' ? activeDemoOrganization : undefined,
    )
    : [];
  const creator = getAssuranceSetCreator(assuranceSet, users);

  /* the charter window stays editable for managers with date permission until the set is approved or certified */
  const isCharterWindowLocked = assuranceSet.stage === 'Approved' || assuranceSet.stage === 'Certified' || assuranceSet.stage === 'Cancelled';
  const canEditCharterWindow = roleActions.canManage && roleActions.canChangeDates && !isCharterWindowLocked;
  const isSetOpen = !isClosedAssuranceSet(assuranceSet) && assuranceSet.stage !== 'Cancelled';
  const canEditTasks = isClientUser(sessionUser, assuranceSet, activePersona) && isSetOpen;
  const activeDateGrantsCount = (assuranceSet.datePermissionGrants || []).filter((g) => isDatePermissionActive(g)).length;

  const openAddTaskModal = () => {
    setNewTaskDraft({
      title: '',
      category: 'Statutory Certificate',
      description: '',
      isMandatory: true,
      targetDate: assuranceSet.targetDate || assuranceSet.complianceDeadline || '',
      assignedSubmitter: assuranceSet.assignedSubmitter || '',
      assignedVerifier: assuranceSet.assignedVerifier || '',
    });
    setNewTaskError(null);
    setIsAddTaskModalOpen(true);
  };

  const handleSaveNewTask = () => {
    if (!newTaskDraft.title.trim()) {
      setNewTaskError('Task title is required.');
      return;
    }
    if (!newTaskDraft.category.trim()) {
      setNewTaskError('Task category is required.');
      return;
    }
    const setLimit = assuranceSet.targetDate || assuranceSet.complianceDeadline;
    if (setLimit && newTaskDraft.targetDate && newTaskDraft.targetDate > setLimit) {
      setNewTaskError(`Target date cannot be after the set target date (${formatMaritimeDate(setLimit)}).`);
      return;
    }

    const res = addAssuranceTask(assuranceSet.id, {
      title: newTaskDraft.title.trim(),
      category: newTaskDraft.category.trim(),
      description: newTaskDraft.description.trim() || undefined,
      isMandatory: newTaskDraft.isMandatory,
      targetDate: newTaskDraft.targetDate || undefined,
      assignedSubmitter: newTaskDraft.assignedSubmitter.trim() || undefined,
      assignedVerifier: newTaskDraft.assignedVerifier.trim() || undefined,
    });

    if (!res.success) {
      setNewTaskError(res.message || 'Failed to add task.');
      return;
    }

    setIsAddTaskModalOpen(false);
  };

  const openEditTask = (req: AssuranceRequirement) => {
    setEditingTask(req);
    setEditTaskDraft({
      title: req.title,
      category: req.category,
      description: req.description || '',
      isMandatory: req.isMandatory,
      targetDate: req.targetDate || assuranceSet.targetDate || assuranceSet.complianceDeadline || '',
      assignedSubmitter: req.assignedSubmitter || assuranceSet.assignedSubmitter || '',
      assignedVerifier: req.assignedVerifier || assuranceSet.assignedVerifier || '',
    });
    setEditTaskError(null);
  };

  const handleSaveEditTask = () => {
    if (!editingTask) return;
    if (!editTaskDraft.title.trim()) {
      setEditTaskError('Task title is required.');
      return;
    }
    if (!editTaskDraft.category.trim()) {
      setEditTaskError('Task category is required.');
      return;
    }
    const setLimit = assuranceSet.targetDate || assuranceSet.complianceDeadline;
    if (setLimit && editTaskDraft.targetDate && editTaskDraft.targetDate > setLimit) {
      setEditTaskError(`Target date cannot be after the set target date (${formatMaritimeDate(setLimit)}).`);
      return;
    }

    const res = editAssuranceTask(assuranceSet.id, editingTask.id, {
      title: editTaskDraft.title.trim(),
      category: editTaskDraft.category.trim(),
      description: editTaskDraft.description.trim() || undefined,
      isMandatory: editTaskDraft.isMandatory,
      targetDate: editTaskDraft.targetDate || undefined,
      assignedSubmitter: editTaskDraft.assignedSubmitter.trim() || undefined,
      assignedVerifier: editTaskDraft.assignedVerifier.trim() || undefined,
    });

    if (!res.success) {
      setEditTaskError(res.message || 'Failed to edit task.');
      return;
    }

    setEditingTask(null);
  };

  const handleConfirmDeleteTask = () => {
    if (!taskToDelete) return;
    removeAssuranceTask(assuranceSet.id, taskToDelete.id);
    setTaskToDelete(null);
  };

  /* earliest selectable day: tomorrow, since today and earlier are not allowed */
  const minCharterDate = (() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return toIsoLocalDate(tomorrow);
  })();

  const startCharterWindowEdit = () => {
    if (!roleActions.canChangeDates) {
      setProjectToast(DATE_PERMISSION_REQUIRED);
      setTimeout(() => setProjectToast(null), 3500);
      return;
    }
    setCharterStartDraft(assuranceSet.charterWindowStart || '');
    setCharterEndDraft(assuranceSet.charterWindowEnd || '');
    setDeadlineDraft(assuranceSet.complianceDeadline || assuranceSet.targetDate || assuranceSet.charterWindowStart || '');
    setDeadlineReasonDraft('');
    setCharterWindowErrors({});
    setIsEditingCharterWindow(true);
  };

  const cancelCharterWindowEdit = () => {
    setIsEditingCharterWindow(false);
    setCharterWindowErrors({});
  };

  const commitCharterWindow = () => {
    const endChanged = charterEndDraft !== assuranceSet.charterWindowEnd;
    const oldDeadline = assuranceSet.complianceDeadline || assuranceSet.targetDate || '';
    const deadlineChanged = deadlineDraft !== oldDeadline;

    const historyRow: TargetDateChangeRecord | undefined = deadlineChanged
      ? {
        id: `TDC-${Date.now()}-set`,
        setId: assuranceSet.id,
        scope: 'set',
        oldDate: oldDeadline || '—',
        newDate: deadlineDraft,
        changedBy: sessionUser?.name || 'Client Admin',
        changedAt: new Date().toISOString(),
        reason: deadlineReasonDraft.trim() || undefined,
      }
      : undefined;

    updateAssuranceSet({
      ...assuranceSet,
      charterWindowStart: charterStartDraft,
      charterWindowEnd: charterEndDraft,
      complianceDeadline: deadlineDraft,
      targetDate: deadlineDraft,
      targetDateHistory: historyRow
        ? [...(assuranceSet.targetDateHistory || []), historyRow]
        : assuranceSet.targetDateHistory,
    });
    if (endChanged) {
      raiseDocumentRenewalNotifications([assuranceSet.id]);
    }
    setIsEditingCharterWindow(false);
    setShortCertificateConfirm(null);
    setProjectToast('Contract Period and Target Date updated.');
    setTimeout(() => setProjectToast(null), 3500);
  };

  const openTaskDateEdit = (req: AssuranceRequirement) => {
    if (!roleActions.canChangeDates) {
      setProjectToast('Date change permission required to modify task target dates.');
      setTimeout(() => setProjectToast(null), 3500);
      return;
    }
    const setLimit = assuranceSet.targetDate || assuranceSet.complianceDeadline || '';
    setEditingTaskDate({
      reqId: req.id,
      title: req.title,
      currentDate: req.targetDate || setLimit,
    });
    setTaskDateDraft(req.targetDate || setLimit);
    setTaskDateReasonDraft('');
    setTaskDateError(null);
  };

  const handleSaveTaskTargetDate = () => {
    if (!editingTaskDate) return;
    const setLimit = assuranceSet.targetDate || assuranceSet.complianceDeadline || '';
    const err = validateTaskTargetDate(taskDateDraft, setLimit);
    if (err) {
      setTaskDateError(err);
      return;
    }
    const result = updateTaskTargetDate(
      assuranceSet.id,
      editingTaskDate.reqId,
      taskDateDraft,
      sessionUser?.name || 'Client Admin',
      taskDateReasonDraft.trim() || undefined,
    );
    if (result.success) {
      setEditingTaskDate(null);
      setProjectToast(`Target date for "${editingTaskDate.title}" updated.`);
      setTimeout(() => setProjectToast(null), 3500);
    } else {
      setTaskDateError(result.message || 'Failed to update task target date.');
    }
  };

  const handleGrantPermission = () => {
    const grantee = users.find((u) => u.id === selectedGranteeId);
    if (!grantee) return;
    const hours = parseInt(grantDurationHours, 10) || 24;
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    grantDatePermission(assuranceSet.id, {
      userId: grantee.id,
      userName: grantee.name,
      grantedBy: sessionUser?.name || 'Client Admin',
      expiresAt,
      reason: grantReasonDraft.trim() || undefined,
    });
    setSelectedGranteeId('');
    setGrantReasonDraft('');
    setProjectToast(`Date change permission granted to ${grantee.name} for ${hours} hours.`);
    setTimeout(() => setProjectToast(null), 3500);
  };

  const handleSaveRevisedDeadline = () => {
    if (!revisedDateDraft) {
      setRevisedDateError('Revised completion date is required.');
      return;
    }
    const result = reviseAssuranceSetDeadline(
      assuranceSet.id,
      revisedDateDraft,
      sessionUser?.name || 'Set Manager',
      revisedDateReason.trim() || undefined,
    );
    if (result.success) {
      setIsReviseDeadlineModalOpen(false);
      setProjectToast('Revised completion date saved.');
      setTimeout(() => setProjectToast(null), 3500);
    } else {
      setRevisedDateError(result.message || 'Failed to update completion date.');
    }
  };

  const handleGrantExemptions = () => {
    if (selectedExemptTaskIds.length === 0) {
      setExemptionError('Please select at least one task to exempt.');
      return;
    }
    if (!exemptionReasonDraft.trim()) {
      setExemptionError('Exemption reason is required.');
      return;
    }
    if (!exemptionNewDateDraft) {
      setExemptionError('New completion date for exempted tasks is required.');
      return;
    }
    const result = exemptAssuranceTasks(
      assuranceSet.id,
      selectedExemptTaskIds,
      exemptionReasonDraft.trim(),
      exemptionGrantedByDraft.trim() || sessionUser?.name || 'Set Manager',
      exemptionNewDateDraft,
    );
    if (result.success) {
      setIsExemptTasksModalOpen(false);
      setProjectToast(`${selectedExemptTaskIds.length} task(s) exempted.`);
      setTimeout(() => setProjectToast(null), 3500);
    } else {
      setExemptionError(result.message || 'Failed to exempt tasks.');
    }
  };

  const handleConfirmPartialClose = () => {
    const result = partiallyCloseAssuranceSet(
      assuranceSet.id,
      sessionUser?.name || 'Set Manager',
      partialCloseNotes.trim() || undefined,
    );
    if (result.success) {
      setIsPartialCloseModalOpen(false);
      setProjectToast('Assurance set partially closed. Exempted tasks remain open.');
      setTimeout(() => setProjectToast(null), 3500);
    } else {
      setProjectToast(result.message || 'Failed to partially close assurance set.');
      setTimeout(() => setProjectToast(null), 3500);
    }
  };

  const handleConfirmCancel = () => {
    const result = cancelAssuranceSet(
      assuranceSet.id,
      sessionUser?.name || 'Set Manager',
      cancellationReasonDraft.trim() || undefined,
    );
    if (result.success) {
      setIsCancelModalOpen(false);
      setProjectToast('Assurance set has been cancelled.');
      setTimeout(() => setProjectToast(null), 3500);
    } else {
      setProjectToast(result.message || 'Failed to cancel assurance set.');
      setTimeout(() => setProjectToast(null), 3500);
    }
  };

  const handleRevokePermission = (grantId: string) => {
    revokeDatePermission(assuranceSet.id, grantId);
    setProjectToast('Date change permission revoked.');
    setTimeout(() => setProjectToast(null), 3500);
  };

  const saveCharterWindow = () => {
    const errors: { start?: string; end?: string; deadline?: string } = validateCharterWindow(charterStartDraft, charterEndDraft);
    const deadlineError = validateComplianceDeadline(deadlineDraft, charterStartDraft);
    if (deadlineError) errors.deadline = deadlineError;
    if (!errors.start && !errors.end) {
      /* the asset cannot hold two contracts at once */
      const overlapError = formatOverlapError(
        findOverlappingAssuranceSets(
          {
            id: assuranceSet.id,
            scope: getAssuranceSetScopes(assuranceSet)[0],
            vesselId: assuranceSet.vesselId,
            crewIds: getAssuranceSetCrewIds(assuranceSet),
            equipmentId: assuranceSet.equipmentId,
            start: charterStartDraft,
            end: charterEndDraft,
          },
          assuranceSets,
        ),
      );
      if (overlapError) errors.start = overlapError;
    }
    setCharterWindowErrors(errors);
    if (errors.start || errors.end || errors.deadline) return;

    const shortOfNewEnd = listCertificatesShortOfContract(assuranceSet, documents, charterEndDraft);
    if (charterEndDraft !== assuranceSet.charterWindowEnd && shortOfNewEnd.length > 0) {
      setShortCertificateConfirm(shortOfNewEnd);
      return;
    }

    commitCharterWindow();
  };

  const closeAddToProject = () => {
    setIsAddToProjectOpen(false);
    setTargetProjectId('');
    setAddToProjectError(null);
  };

  const handleAddToProject = () => {
    const result = attachAssuranceSetToProject(assuranceSet.id, targetProjectId);
    if (!result.success) {
      setAddToProjectError(result.message || 'The assurance set could not be added to the project.');
      return;
    }
    const projectName = projects.find((p) => p.id === targetProjectId)?.name || targetProjectId;
    closeAddToProject();
    setProjectToast(`Added to project ${projectName}.`);
    setTimeout(() => setProjectToast(null), 3500);
  };
  const canUpload = roleActions.canUpload;
  const stakeholderLockReason = getAssuranceSetStakeholderLockReason(assuranceSet);
  const canEditStakeholders =
    roleActions.canManage &&
    canEditAssuranceSetStakeholders(assuranceSet, activePersona, activeDemoOrganization, sessionUser);
  const isLinkedSubSet = (req: AssuranceRequirement) =>
    req.fulfillmentType === 'assurance_set' || Boolean(req.linkedAssuranceSetId);

  const assignStakeholder = (
    role: 'Submitter' | 'Verifier' | 'Inspector' | 'Approver',
    assigneeName: string,
  ) => {
    const result = updateAssuranceStakeholder(assuranceSet.id, role, assigneeName);
    if (!result.success) {
      setStakeholderError(result.message || 'The stakeholder could not be assigned.');
      return;
    }
    setStakeholderError(null);
    setEditingRole(null);
  };

  const verifiedCount = assuranceSet.requirements.filter((r) => r.verifierStatus === 'Verified').length;
  const totalCount = assuranceSet.requirements.length;

  const renderRequirementStatus = (req: AssuranceRequirement) => {
    if (!req.documentId) {
      return (
        <span className="badge bg-secondary text-white px-2.5 py-1.5" style={{ fontSize: '0.75rem' }}>
          Awaiting Upload
        </span>
      );
    }
    const isSetApproved = assuranceSet.stage === 'Approved' || assuranceSet.approverDecision === 'Approved';

    if (req.verifierStatus === 'Verified') {
      if (isSetApproved) {
        return <span className="badge bg-success text-white px-2.5 py-1.5" style={{ fontSize: '0.75rem' }}>Approved</span>;
      }
      return <span className="badge bg-info text-dark px-2.5 py-1.5" style={{ fontSize: '0.75rem' }}>Verified</span>;
    }
    if (req.verifierStatus === 'Correction Requested') {
      return <span className="badge bg-warning text-dark px-2.5 py-1.5" style={{ fontSize: '0.75rem' }}>Returned for Correction</span>;
    }
    if (req.verifierStatus === 'Rejected') {
      return <span className="badge bg-danger text-white px-2.5 py-1.5" style={{ fontSize: '0.75rem' }}>Rejected</span>;
    }
    const isInspectionDoc =
      (req.category as string).toLowerCase().includes('inspection') ||
      (req.category as string).toLowerCase().includes('audit') ||
      req.title.toLowerCase().includes('inspection') ||
      req.title.toLowerCase().includes('audit');

    if (isInspectionDoc) {
      return <span className="badge bg-warning text-dark px-2.5 py-1.5" style={{ fontSize: '0.75rem' }}>To Inspect</span>;
    }

    return (
      <span className="badge bg-primary text-white px-2.5 py-1.5" style={{ fontSize: '0.75rem' }}>
        Submitted
      </span>
    );
  };

  const closeUploadModal = () => {
    setIsUploadModalOpen(false);
    setUploadTargetRequirement(null);
    setReplaceExistingDoc(null);
  };

  /* an approved or certified set takes no new uploads: its document versions are locked */
  const isSetVersionLocked = isClosedAssuranceSet(assuranceSet);
  const canUploadHere = canUpload && !isSetVersionLocked;

  /* version badge of a requirement row: the pinned version with a lock on an approved set, and a note when the library has moved on */
  const renderVersionBadge = (req: AssuranceRequirement, docView?: RequirementDocumentView) => {
    const label = docView?.doc.currentVersion || req.documentVersion;
    if (!label) return null;
    const lockedOn = docView?.snapshot?.verifiedAt || assuranceSet.lockedAt;
    return (
      <>
        <span
          className="badge bg-light text-secondary border ms-2 d-inline-flex align-items-center gap-1"
          style={{ fontSize: '0.7rem' }}
          title={docView?.isLocked ? `Approved version${lockedOn ? `, locked ${formatMaritimeDate(lockedOn)}` : ''}` : undefined}
        >
          {docView?.isLocked && <Lock size={10} aria-label="Locked version" />}
          {label}
        </span>
        {docView?.newerVersionLabel && (
          <span className="text-secondary ms-1.5 fw-normal" style={{ fontSize: '0.7rem' }}>
            {docView.newerVersionLabel} available
          </span>
        )}
      </>
    );
  };

  const openRequirementUpload = (req: AssuranceRequirement, existingDoc?: MasterDocument) => {
    setUploadTargetRequirement(req);
    setReplaceExistingDoc(existingDoc || null);
    setIsUploadModalOpen(true);
  };

  /* version a requirement is shown with: pinned on an approved set, live otherwise */
  const getExportVersionLabel = (req: AssuranceRequirement, linkedDoc?: MasterDocument): string =>
    (linkedDoc ? getRequirementDocumentView(assuranceSet, req, linkedDoc).doc.currentVersion : req.documentVersion) || '';

  const handleExportCsv = () => {
    const exportData = assuranceSet.requirements.map((req) => {
      const linkedDoc = documents.find((d) => d.id === req.documentId || (req.linkedDocumentId && d.id === req.linkedDocumentId));
      const hasAttachedDoc = Boolean(linkedDoc || req.documentId || req.linkedDocumentId);
      const effectiveOcr = hasAttachedDoc ? (req.ocrConfidence || linkedDoc?.ocrConfidence || 0) : 0;
      return {
        Requirement: req.title,
        Version: getExportVersionLabel(req, linkedDoc),
        OcrConfidence: `${effectiveOcr}%`,
        Status: getStatusDisplayLabel(req.verifierStatus || (req.isFulfilled ? 'Approved' : 'Pending')),
        Notes: req.notes || '',
      };
    });
    exportToCsv(`${assuranceSet.id}_Requirements`, exportData);
    setIsExportOpen(false);
  };

  const handleExportPdf = () => {
    const headers = ['Requirement', 'Version', 'OCR Confidence', 'Status', 'Notes'];
    const rows = assuranceSet.requirements.map((req) => {
      const linkedDoc = documents.find((d) => d.id === req.documentId || (req.linkedDocumentId && d.id === req.linkedDocumentId));
      const hasAttachedDoc = Boolean(linkedDoc || req.documentId || req.linkedDocumentId);
      const effectiveOcr = hasAttachedDoc ? (req.ocrConfidence || linkedDoc?.ocrConfidence || 0) : 0;
      return [
        req.title,
        getExportVersionLabel(req, linkedDoc) || '-',
        `${effectiveOcr}%`,
        getStatusDisplayLabel(req.verifierStatus || (req.isFulfilled ? 'Approved' : 'Pending')),
        req.notes || '-',
      ];
    });
    exportToPdf(`${assuranceSet.id} Requirements`, headers, rows);
    setIsExportOpen(false);
  };

  /* DetailHeader status derivation: single badge only */
  const headerStatus = useMemo(() => {
    if (assuranceSet.stage === 'Cancelled') return undefined;
    if (assuranceSet.closureType === 'partial') return 'Partially Closed';
    if (complianceOverdue) return 'Overdue';
    return assuranceSet.stage;
  }, [assuranceSet.stage, assuranceSet.closureType, complianceOverdue]);

  const canUseAsTemplate =
    roleActions.canManage ||
    ((isCAdmin || activePersona === 'Administrator') &&
      (assuranceSet.visibility === 'public' || assuranceSet.templateSource === 'public'));

  const detailHeaderActions = (
    <div className="d-flex align-items-center gap-2">
      {canUseAsTemplate && (
        <button
          type="button"
          className="btn btn-sm btn-outline-primary"
          onClick={() => setCurrentHashView('create-assurance-set', assuranceSet.id)}
        >
          Use as Template
        </button>
      )}
      {roleActions.canInspect && (
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={() => setCurrentHashView('inspector', assuranceSet.vesselName)}
        >
          Open Inspection
        </button>
      )}
      {roleActions.canApprove && (
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={() => setCurrentHashView('approver', assuranceSet.id)}
        >
          Open Approval
        </button>
      )}
    </div>
  );

  return (
    <div className="d-flex flex-column gap-4">
      {projectToast && (
        <div className="alert alert-success py-2 mb-0" role="status">{projectToast}</div>
      )}

      {/* DetailHeader with 1 status badge, metaItems, and Export; the top header holds the back button */}
      <DetailHeader
        title={assuranceSet.title}
        status={headerStatus}
        metaItems={[
          assuranceSet.id,
          assuredAsset.name,
        ]}
        mainAction={detailHeaderActions}
        onExportCsv={handleExportCsv}
        onExportPdf={handleExportPdf}
      />

      {/* Cancelled set shows alert only, below header */}
      {assuranceSet.stage === 'Cancelled' && (
        <div className="alert alert-secondary mb-0" role="alert">
          <span className="fw-semibold">Cancelled:</span>{' '}
          This assurance set was cancelled on {formatMaritimeDate(assuranceSet.cancelledAt || '')}.
          {assuranceSet.cancellationReason ? ` Reason: ${assuranceSet.cancellationReason}.` : ''}{' '}
          This set cannot be restarted.
        </div>
      )}

      {/* Top Row: Campaign Summary Information Card + Compact Stage Pipeline */}
      {/* Assurance Set Detail Tabs */}
      <ul className="nav nav-tabs border-bottom mb-3" role="tablist">
        <li className="nav-item" role="presentation">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'details'}
            className={`nav-link ${activeTab === 'details' ? 'active fw-bold text-primary' : 'text-secondary'}`}
            onClick={() => handleTabChange('details')}
          >
            Details
          </button>
        </li>
        <li className="nav-item" role="presentation">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'requirements'}
            className={`nav-link ${activeTab === 'requirements' ? 'active fw-bold text-primary' : 'text-secondary'}`}
            onClick={() => handleTabChange('requirements')}
          >
            Requirements
          </button>
        </li>
        <li className="nav-item" role="presentation">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'tasks'}
            className={`nav-link ${activeTab === 'tasks' ? 'active fw-bold text-primary' : 'text-secondary'}`}
            onClick={() => handleTabChange('tasks')}
          >
            Tasks
          </button>
        </li>
        <li className="nav-item" role="presentation">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'audit'}
            className={`nav-link ${activeTab === 'audit' ? 'active fw-bold text-primary' : 'text-secondary'}`}
            onClick={() => handleTabChange('audit')}
          >
            Audit Trail
          </button>
        </li>
      </ul>

      {/* Tab: Details */}
      {activeTab === 'details' && (
      <div className="d-flex flex-column gap-4">
        {/* Top Row: Information & Readiness Cards */}
      <div className="row g-4 align-items-stretch">
        {/* Left: Assurance Set Information & Stakeholder Role Assignments Card */}
        <div className="col-12 col-lg-8 col-md-7 w-100">
          <div className="card map-card-custom p-4 h-100">
            {showApproverDecisionBar && (
              <ApproverDecisionBar
                assuranceSet={assuranceSet}
                openFindingsCount={openFindings.length}
                onDecisionSubmitted={(decision) => {
                  setProjectToast(`Assurance set ${assuranceSet.id} updated to ${decision}.`);
                }}
              />
            )}
            {/* On-Time, Open Findings, and Remaining Items Badges inside Info Card */}
            <div className="d-flex flex-wrap align-items-center gap-2 mb-3 pb-3 border-bottom">
              <span className={`badge ${onTimeStatus.isOnTime ? 'bg-success-subtle text-success-emphasis border border-success-subtle' : 'bg-danger text-white'}`} title={onTimeStatus.detail}>
                {onTimeStatus.statusLabel}{!onTimeStatus.isOnTime && onTimeStatus.lateItemsCount > 0 ? ` (${onTimeStatus.lateItemsCount} late)` : ''}
              </span>
              {openFindings.length > 0 && (
                <button
                  type="button"
                  className="btn btn-sm btn-link p-0 text-decoration-none"
                  onClick={() => setCurrentHashView('capa', assuranceSet.vesselName || assuranceSet.vesselId)}
                >
                  <span className="badge bg-warning text-dark">
                    {openFindings.length} {openFindings.length === 1 ? 'Open Finding' : 'Open Findings'}
                  </span>
                </button>
              )}
              <span className="badge bg-light text-secondary border">
                {remainingItems.label}
              </span>
            </div>

            <div className="small">
              <div className="row g-4">
                {/* Assurance Set Information */}
                <div className="col-md-6 d-flex flex-column gap-3">
                  <div className="d-flex align-items-center justify-content-between mb-1">
                    <span className="text-uppercase fw-bold text-secondary" style={{ fontSize: '0.725rem', letterSpacing: '0.05em' }}>
                      Details
                    </span>
                  </div>
                  <div className="map-detail-row border-bottom pb-2">
                    <div className="text-secondary" style={{ fontSize: '0.725rem' }}>Set ID:</div>
                    <div className="fw-bold text-dark font-mono-code">{assuranceSet.id}</div>
                  </div>
                  <div className="map-detail-row border-bottom pb-2">
                    <div className="d-flex align-items-center justify-content-between">
                      <div className="text-secondary" style={{ fontSize: '0.725rem' }}>Project:</div>
                      {canAddToProject && (
                        <button
                          type="button"
                          className="btn btn-link p-0 text-decoration-none small ms-auto"
                          style={{ fontSize: '0.7rem', color: '#0284c7' }}
                          onClick={() => setIsAddToProjectOpen(true)}
                        >
                          Add to Project
                        </button>
                      )}
                    </div>
                    {linkedProject ? (
                      <button
                        type="button"
                        className="d-block w-100 p-0 border-0 bg-transparent fw-bold text-dark text-start"
                        style={{ fontSize: 'inherit', lineHeight: 'inherit', fontFamily: 'inherit', cursor: 'pointer' }}
                        onClick={() => setCurrentHashView('project', linkedProject.id)}
                      >
                        {linkedProject.name} ({linkedProject.id})
                      </button>
                    ) : (
                      <div className="fw-bold text-dark">No project</div>
                    )}
                  </div>
                  <div className="map-detail-row border-bottom pb-2">
                    <div className="text-secondary" style={{ fontSize: '0.725rem' }}>Created By:</div>
                    <div className="fw-bold text-dark">
                      {creator.name
                        ? creator.organization && creator.organization !== clientOwnerOrg
                          ? `${creator.name} (${creator.organization})`
                          : creator.name
                        : creator.organization}
                    </div>
                  </div>
                  <div className="map-detail-row border-bottom pb-2">
                    <div className="text-secondary" style={{ fontSize: '0.725rem' }}>Client:</div>
                    <div className="fw-bold text-dark">{clientOwnerOrg}</div>
                  </div>
                  {serviceProviderOrg && (
                    <div className="map-detail-row border-bottom pb-2">
                      <div className="text-secondary" style={{ fontSize: '0.725rem' }}>{getProviderLabel(assuranceSet.assuranceType)}:</div>
                      <div className="fw-bold text-dark">{serviceProviderOrg}</div>
                    </div>
                  )}
                  {organizationParties.length > 0 && (
                    <div className="map-detail-row border-bottom pb-2">
                      <div className="text-secondary" style={{ fontSize: '0.725rem' }}>Organizations</div>
                      <ul className="list-unstyled mb-0 mt-1">
                        {organizationParties.map((party) => (
                          <li
                            key={`${party.organization}-${party.group}`}
                            className="d-flex justify-content-between align-items-center gap-2 py-1"
                          >
                            <span className="fw-bold text-dark">{party.organization}</span>
                            <span className="badge bg-light text-dark border">{party.group}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="map-detail-row border-bottom pb-2">
                    <div className="text-secondary" style={{ fontSize: '0.725rem' }}>Scope:</div>
                    <div className="fw-bold text-dark">{assuredAsset.typeLabel}</div>
                  </div>
                  <div className="map-detail-row border-bottom pb-2">
                    <div className="text-secondary" style={{ fontSize: '0.725rem' }}>
                      {assuredAsset.members && assuredAsset.members.length > 1 ? `Assets (${assuredAsset.members.length}):` : 'Asset:'}
                    </div>
                    {assuredAsset.members && assuredAsset.members.length > 1 ? (
                      <ul className="list-unstyled mb-0">
                        {assuredAsset.members.map((member) => (
                          <li key={member.id}>
                            <button
                              type="button"
                              className="d-block w-100 p-0 border-0 bg-transparent fw-bold text-dark text-start"
                              style={{ fontSize: 'inherit', lineHeight: 'inherit', fontFamily: 'inherit', cursor: 'pointer' }}
                              onClick={() => setCurrentHashView('crew', member.id)}
                            >
                              {member.name}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : assuredAsset.view ? (
                      <button
                        type="button"
                        className="d-block w-100 p-0 border-0 bg-transparent fw-bold text-dark text-start"
                        style={{ fontSize: 'inherit', lineHeight: 'inherit', fontFamily: 'inherit', cursor: 'pointer' }}
                        onClick={() => setCurrentHashView(assuredAsset.view as string, assuredAsset.entityId)}
                      >
                        {assuredAsset.name}
                      </button>
                    ) : (
                      <div className="fw-bold text-dark">{assuredAsset.name}</div>
                    )}
                  </div>
                  <div className="map-detail-row">
                    <div className="d-flex align-items-center justify-content-between">
                      <div className="d-flex align-items-center gap-2">
                        <div className="text-secondary" style={{ fontSize: '0.725rem' }}>Contract Period:</div>
                        {roleActions.canChangeDates ? (
                          <span className="badge bg-success-subtle text-success border border-success-subtle" style={{ fontSize: '0.65rem' }}>
                            Authorized
                          </span>
                        ) : roleActions.canManage && !isCharterWindowLocked ? (
                          <span className="badge bg-secondary-subtle text-secondary border border-secondary-subtle" style={{ fontSize: '0.65rem' }}>
                            Permission required
                          </span>
                        ) : null}
                      </div>
                      {canEditCharterWindow && (
                        <button
                          type="button"
                          className="btn btn-link p-0 text-decoration-none small ms-auto"
                          style={{ fontSize: '0.7rem', color: '#0284c7' }}
                          onClick={isEditingCharterWindow ? cancelCharterWindowEdit : startCharterWindowEdit}
                        >
                          {isEditingCharterWindow ? 'Cancel' : 'Edit'}
                        </button>
                      )}
                    </div>
                    {isEditingCharterWindow ? (
                      <div className="mt-1 d-flex flex-column gap-2">
                        <div>
                          <label className="form-label text-secondary small mb-1" htmlFor="charter-window-start">
                            Start <span className="text-danger">*</span>
                          </label>
                          <input
                            id="charter-window-start"
                            type="date"
                            className={`form-control form-control-sm bg-white text-dark${charterWindowErrors.start ? ' is-invalid border-danger' : ''}`}
                            value={charterStartDraft}
                            min={minCharterDate}
                            onChange={(e) => {
                              setCharterStartDraft(e.target.value);
                              setCharterWindowErrors((prev) => ({ ...prev, start: undefined }));
                            }}
                          />
                          {charterWindowErrors.start && (
                            <div className="invalid-feedback d-block small">{charterWindowErrors.start}</div>
                          )}
                        </div>
                        <div>
                          <label className="form-label text-secondary small mb-1" htmlFor="charter-window-end">
                            End <span className="text-danger">*</span>
                          </label>
                          <input
                            id="charter-window-end"
                            type="date"
                            className={`form-control form-control-sm bg-white text-dark${charterWindowErrors.end ? ' is-invalid border-danger' : ''}`}
                            value={charterEndDraft}
                            min={charterStartDraft && charterStartDraft > minCharterDate ? charterStartDraft : minCharterDate}
                            onChange={(e) => {
                              setCharterEndDraft(e.target.value);
                              setCharterWindowErrors((prev) => ({ ...prev, end: undefined }));
                            }}
                          />
                          {charterWindowErrors.end && (
                            <div className="invalid-feedback d-block small">{charterWindowErrors.end}</div>
                          )}
                        </div>
                        <div>
                          <label className="form-label text-secondary small mb-1" htmlFor="compliance-deadline">
                            Compliance Deadline <span className="text-danger">*</span>
                          </label>
                          <input
                            id="compliance-deadline"
                            type="date"
                            className={`form-control form-control-sm bg-white text-dark${charterWindowErrors.deadline ? ' is-invalid border-danger' : ''}`}
                            value={deadlineDraft}
                            max={charterStartDraft || undefined}
                            onChange={(e) => {
                              setDeadlineDraft(e.target.value);
                              setCharterWindowErrors((prev) => ({ ...prev, deadline: undefined }));
                            }}
                          />
                          <div className="form-text">When this set must be complete. On or before the contract start.</div>
                          {charterWindowErrors.deadline && (
                            <div className="invalid-feedback d-block small">{charterWindowErrors.deadline}</div>
                          )}
                        </div>
                        <div>
                          <label className="form-label text-secondary small mb-1" htmlFor="deadline-reason">
                            Reason for Date Change <span className="text-muted fw-normal">(optional)</span>
                          </label>
                          <input
                            id="deadline-reason"
                            type="text"
                            className="form-control form-control-sm bg-white text-dark"
                            placeholder="e.g. Schedule adjustment per operational request"
                            value={deadlineReasonDraft}
                            onChange={(e) => setDeadlineReasonDraft(e.target.value)}
                          />
                        </div>
                        <div>
                          <button type="button" className="btn btn-sm btn-primary" onClick={saveCharterWindow}>
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="fw-bold text-dark">{formatMaritimeDate(assuranceSet.charterWindowStart)} - {formatMaritimeDate(assuranceSet.charterWindowEnd)}</div>
                        <div className="text-secondary mt-1 d-flex align-items-center gap-2 flex-wrap" style={{ fontSize: '0.75rem' }}>
                          <span>Compliance deadline: {formatMaritimeDate(assuranceSet.complianceDeadline || assuranceSet.targetDate || '')}</span>
                        </div>
                        <div className="d-flex align-items-center gap-2 mt-2">
                          {(activeDateGrantsCount > 0 || activePersona === 'C Admin') && (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary py-0 px-2 d-inline-flex align-items-center gap-1"
                              style={{ fontSize: '0.72rem' }}
                              onClick={() => setIsDatePermissionsModalOpen(true)}
                            >
                              <Key size={12} />
                              {activeDateGrantsCount > 0 ? `Date grants (${activeDateGrantsCount})` : 'Grant date access'}
                            </button>
                          )}
                        </div>
                        {complianceOverdue && roleActions.canManage && assuranceSet.stage !== 'Cancelled' && assuranceSet.stage !== 'Approved' && (
                          <div className="d-flex flex-wrap gap-2 mt-2 pt-2 border-top">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger py-0 px-2"
                              style={{ fontSize: '0.72rem' }}
                              onClick={() => {
                                setRevisedDateDraft(assuranceSet.revisedCompletionDate || assuranceSet.complianceDeadline || assuranceSet.targetDate || '');
                                setRevisedDateReason('');
                                setRevisedDateError(null);
                                setIsReviseDeadlineModalOpen(true);
                              }}
                            >
                              Revise Completion Date
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger py-0 px-2"
                              style={{ fontSize: '0.72rem' }}
                              onClick={() => {
                                setSelectedExemptTaskIds([]);
                                setExemptionReasonDraft('');
                                setExemptionGrantedByDraft(sessionUser?.name || 'Set Manager');
                                setExemptionNewDateDraft('');
                                setExemptionError(null);
                                setIsExemptTasksModalOpen(true);
                              }}
                            >
                              Exempt Tasks
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger py-0 px-2"
                              style={{ fontSize: '0.72rem' }}
                              onClick={() => {
                                setPartialCloseNotes('');
                                setIsPartialCloseModalOpen(true);
                              }}
                            >
                              Partial Closure
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-danger text-white py-0 px-2"
                              style={{ fontSize: '0.72rem' }}
                              onClick={() => {
                                setCancellationReasonDraft('');
                                setIsCancelModalOpen(true);
                              }}
                            >
                              Cancel Set
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    {roleActions.canManage && isCharterWindowLocked && (
                      <div className="text-secondary mt-1" style={{ fontSize: '0.7rem' }}>
                        Locked once the set is approved or certified.
                      </div>
                    )}
                  </div>
                </div>

                {/* Stakeholder Role Assignments */}
                <div className="col-md-6 d-flex flex-column gap-3">
                  <div className="text-uppercase fw-bold text-secondary mb-1" style={{ fontSize: '0.725rem', letterSpacing: '0.05em' }}>
                    Stakeholders
                  </div>
                  {stakeholderError && (
                    <div className="alert alert-danger py-2 small mb-0">{stakeholderError}</div>
                  )}
                  {!canEditStakeholders && stakeholderLockReason && (isCAdmin || activePersona === 'Administrator') && (
                    <div className="alert alert-light border py-2 small mb-0 text-secondary">
                      {stakeholderLockReason}
                    </div>
                  )}

                  {/* Review Channel: who may verify and approve this set */}
                  <div className="map-detail-row border-bottom pb-2">
                    <div className="text-secondary" style={{ fontSize: '0.725rem' }}>Review Channel:</div>
                    <div className="fw-bold text-dark">{formatReviewChannel(assuranceSet)}</div>
                  </div>

                  {/* Submitter */}
                  <div className="map-detail-row border-bottom pb-2">
                    <div className="d-flex align-items-center justify-content-between">
                      <div className="text-secondary" style={{ fontSize: '0.725rem' }}>Submitter:</div>
                      {canEditStakeholders && (
                        <button
                          type="button"
                          className="btn btn-link p-0 text-decoration-none small ms-auto"
                          style={{ fontSize: '0.7rem', color: '#0284c7' }}
                          onClick={() => setEditingRole(editingRole === 'Submitter' ? null : 'Submitter')}
                        >
                          {editingRole === 'Submitter' ? 'Cancel' : 'Assign / Change'}
                        </button>
                      )}
                    </div>
                    {editingRole === 'Submitter' ? (
                      <div className="mt-1 d-flex flex-column gap-1">
                        <select
                          className="form-select form-select-sm"
                          style={{ fontSize: '0.75rem' }}
                          value={assuranceSet.assignedSubmitter || ''}
                          onChange={(e) => {
                            if (e.target.value) assignStakeholder('Submitter', e.target.value);
                          }}
                        >
                          <option value="">Select submitter</option>
                          {users
                            .filter((u) => userHasRole(u, 'Submitter') || userHasRole(u, 'Administrator'))
                            .map((u) => (
                              <option key={u.id} value={`${u.name} (${u.organization})`}>
                                {u.name} - {u.organization}
                              </option>
                            ))}
                        </select>
                        <button
                          type="button"
                          className="btn btn-xs btn-outline-primary align-self-start mt-1"
                          style={{ fontSize: '0.675rem' }}
                          onClick={() => setCurrentHashView('users')}
                        >
                          Add a submitter in User Management
                        </button>
                      </div>
                    ) : (
                      <div className="fw-bold text-dark">{assuranceSet.assignedSubmitter || 'M. Chen (Northwind Marine Pty Ltd)'}</div>
                    )}
                  </div>

                  {/* Verifier */}
                  <div className="map-detail-row border-bottom pb-2">
                    <div className="d-flex align-items-center justify-content-between">
                      <div className="text-secondary" style={{ fontSize: '0.725rem' }}>Verifier:</div>
                      {canEditStakeholders && (
                        <button
                          type="button"
                          className="btn btn-link p-0 text-decoration-none small ms-auto"
                          style={{ fontSize: '0.7rem', color: '#0284c7' }}
                          onClick={() => setEditingRole(editingRole === 'Verifier' ? null : 'Verifier')}
                        >
                          {editingRole === 'Verifier' ? 'Cancel' : 'Assign / Change'}
                        </button>
                      )}
                    </div>
                    {editingRole === 'Verifier' ? (
                      <div className="mt-1 d-flex flex-column gap-1">
                        <select
                          className="form-select form-select-sm"
                          style={{ fontSize: '0.75rem' }}
                          value={assuranceSet.assignedVerifier || ''}
                          onChange={(e) => {
                            if (e.target.value) assignStakeholder('Verifier', e.target.value);
                          }}
                        >
                          <option value="">Select verifier</option>
                          {verifierCandidates.map((u) => (
                            <option key={u.id} value={`${u.name} (${u.organization})`}>
                              {u.name} - {u.organization}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="btn btn-xs btn-outline-primary align-self-start mt-1"
                          style={{ fontSize: '0.675rem' }}
                          onClick={() => setCurrentHashView('users')}
                        >
                          Add a verifier in User Management
                        </button>
                      </div>
                    ) : (
                      <div className="fw-bold text-dark">
                        {assuranceSet.verificationRequired === false
                          ? 'N/A (Verification Bypassed)'
                          : (assuranceSet.assignedVerifier || 'A. Fontaine (Bureau Veritas Inspectorate)')}
                      </div>
                    )}
                  </div>

                  {/* Inspector */}
                  <div className="map-detail-row border-bottom pb-2">
                    <div className="d-flex align-items-center justify-content-between">
                      <div className="text-secondary" style={{ fontSize: '0.725rem' }}>Inspector:</div>
                      {canEditStakeholders && (
                        <button
                          type="button"
                          className="btn btn-link p-0 text-decoration-none small ms-auto"
                          style={{ fontSize: '0.7rem', color: '#0284c7' }}
                          onClick={() => setEditingRole(editingRole === 'Inspector' ? null : 'Inspector')}
                        >
                          {editingRole === 'Inspector' ? 'Cancel' : 'Assign / Change'}
                        </button>
                      )}
                    </div>
                    {editingRole === 'Inspector' ? (
                      <div className="mt-1 d-flex flex-column gap-1">
                        <select
                          className="form-select form-select-sm"
                          style={{ fontSize: '0.75rem' }}
                          value={assuranceSet.assignedInspector || ''}
                          onChange={(e) => {
                            if (e.target.value) assignStakeholder('Inspector', e.target.value);
                          }}
                        >
                          <option value="">Select inspector</option>
                          {users
                            .filter((u) => userHasRole(u, 'Inspector'))
                            .map((u) => (
                              <option key={u.id} value={`${u.name} (${u.organization})`}>
                                {u.name} - {u.organization}
                              </option>
                            ))}
                        </select>
                        <button
                          type="button"
                          className="btn btn-xs btn-outline-primary align-self-start mt-1"
                          style={{ fontSize: '0.675rem' }}
                          onClick={() => setCurrentHashView('users')}
                        >
                          Add an inspector in User Management
                        </button>
                      </div>
                    ) : (
                      <div className="fw-bold text-dark">
                        {assuranceSet.mandatoryInspectionRequired
                          ? (assuranceSet.assignedInspector || 'N. Technical (Meridian Marine Surveyors)')
                          : (assuranceSet.assignedInspector || 'N/A (Not Required)')}
                      </div>
                    )}
                  </div>

                  {/* Approver */}
                  <div className="map-detail-row">
                    <div className="d-flex align-items-center justify-content-between">
                      <div className="text-secondary" style={{ fontSize: '0.725rem' }}>Approver:</div>
                      {canEditStakeholders && (
                        <button
                          type="button"
                          className="btn btn-link p-0 text-decoration-none small ms-auto"
                          style={{ fontSize: '0.7rem', color: '#0284c7' }}
                          onClick={() => setEditingRole(editingRole === 'Approver' ? null : 'Approver')}
                        >
                          {editingRole === 'Approver' ? 'Cancel' : 'Assign / Change'}
                        </button>
                      )}
                    </div>
                    {editingRole === 'Approver' ? (
                      <div className="mt-1 d-flex flex-column gap-1">
                        <select
                          className="form-select form-select-sm"
                          style={{ fontSize: '0.75rem' }}
                          value={assuranceSet.assignedApprover || ''}
                          onChange={(e) => {
                            if (e.target.value) assignStakeholder('Approver', e.target.value);
                          }}
                        >
                          <option value="">Select approver</option>
                          {approverCandidates.map((u) => (
                            <option key={u.id} value={`${u.name} (${u.organization})`}>
                              {u.name} - {u.organization}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="btn btn-xs btn-outline-primary align-self-start mt-1"
                          style={{ fontSize: '0.675rem' }}
                          onClick={() => setCurrentHashView('users')}
                        >
                          Add an approver in User Management
                        </button>
                      </div>
                    ) : (
                      <div className="fw-bold text-dark">
                        {assuranceSet.formalApprovalRequired === false
                          ? 'N/A (Direct Sign-Off)'
                          : (assuranceSet.assignedApprover || 'P. Nardelli (Marine Assurance Authority)')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Bottom Section: Stage & Readiness */}
      <div className="card map-card-custom p-4">
        {/* Stage Pipeline Stepper */}
        <div className="mb-4">
          <div className="text-uppercase fw-bold text-secondary mb-3" style={{ fontSize: '0.725rem', letterSpacing: '0.05em' }}>
            Stage
          </div>
          <PipelineStepper
            currentStage={assuranceSet.stage}
            readinessScore={calculateAssuranceSetReadiness(assuranceSet)}
            assuranceSet={assuranceSet}
            orientation="horizontal"
            className="border-0 p-0 mb-0 bg-transparent flex-wrap gap-3"
          />
        </div>

        {/* Readiness Index */}
        <div className="pt-3 border-top">
          <div className="text-secondary text-uppercase fw-bold mb-2" style={{ fontSize: '0.725rem', letterSpacing: '0.05em' }}>
            Readiness
          </div>
          <ReadinessGauge score={calculateAssuranceSetReadiness(assuranceSet)} size="md" />
        </div>
      </div>
      </div>
      )}


      {/* Tab: Requirements */}
      {activeTab === 'requirements' && (
      <div className="card map-card-custom">
        <div className="card-header border-bottom p-3">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
            <div>
              <div className="fw-bold text-dark fs-6">
                Requirements
              </div>
            </div>
            <div className="d-flex align-items-center gap-2 ms-auto">
              {canUploadHere && (
                <button
                  type="button"
                  className="btn btn-sm btn-primary text-white"
                  onClick={() => {
                    setUploadTargetRequirement(null);
                    setReplaceExistingDoc(null);
                    setIsUploadModalOpen(true);
                  }}
                >
                  Upload Document
                </button>
              )}
            </div>
          </div>

        </div>
        {shortCertificates.length > 0 && (
          <div className="alert alert-warning rounded-0 border-0 border-bottom mb-0" role="status">
            {shortCertificates.length === 1
              ? '1 certificate expires'
              : `${shortCertificates.length} certificates expire`}{' '}
            before the contract ends on {formatMaritimeDate(assuranceSet.charterWindowEnd)}.
          </div>
        )}
        <div className="table-responsive">
          <table className="table map-table-custom align-middle mb-0">
            <thead>
              <tr>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => handleReqSort('title')}
                >
                  Requirement {renderSortIndicator('title')}
                </th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => handleReqSort('targetDate')}
                >
                  Target Date {renderSortIndicator('targetDate')}
                </th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => handleReqSort('ocrConfidence')}
                >
                  OCR Confidence {renderSortIndicator('ocrConfidence')}
                </th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => handleReqSort('status')}
                >
                  Status {renderSortIndicator('status')}
                </th>
                <th className="text-end" style={{ whiteSpace: 'nowrap' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {/* Main Files (Toggled Statutory Requirements during campaign creation) */}
              {pageMainRequirements.map((req: AssuranceRequirement) => {
                const linkedDoc = documents.find((d) => d.id === req.documentId || (req.linkedDocumentId && d.id === req.linkedDocumentId));
                /* an approved set shows the version it was approved against, not the live one */
                const docView = linkedDoc ? getRequirementDocumentView(assuranceSet, req, linkedDoc) : undefined;
                const linkedChildSet = req.linkedAssuranceSetId
                  ? assuranceSets.find((s) => s.id === req.linkedAssuranceSetId)
                  : undefined;
                const hasAttachedDoc = Boolean(linkedDoc || req.documentId || req.linkedDocumentId);
                const effectiveOcr = hasAttachedDoc ? (req.ocrConfidence || linkedDoc?.ocrConfidence || 0) : 0;

                if (isLinkedSubSet(req) && linkedChildSet) {
                  return (
                    <tr key={req.id} className="table-light" data-requirement-id={req.id}>
                      <td>
                        <div className="fw-semibold text-dark">{req.title}</div>
                        {renderTaskPlacement(req)}
                        <div className="d-flex align-items-center gap-1.5 flex-wrap">
                          <span className="font-mono-code small text-primary">{linkedChildSet.id}</span>
                          <span className="badge bg-info text-dark" style={{ fontSize: '0.7rem' }}>
                            Linked Sub-Set
                          </span>
                        </div>
                        {req.description && (
                          <div className="text-secondary small mt-0.5">{req.description}</div>
                        )}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <span className="small text-dark">
                          {formatMaritimeDate(req.targetDate || linkedChildSet.complianceDeadline || assuranceSet.targetDate || assuranceSet.complianceDeadline)}
                        </span>
                      </td>
                      <td>
                        <span className="text-muted small">—</span>
                      </td>
                      <td>
                        <span className={`badge ${linkedChildSet.stage === 'Approved' || linkedChildSet.stage === 'Certified' ? 'bg-success' : 'bg-secondary'}`}>
                          {linkedChildSet.stage}
                        </span>
                      </td>
                      <td className="text-end">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center p-0"
                          style={{ width: '32px', height: '32px' }}
                          onClick={() => setCurrentHashView('assurance-sets', linkedChildSet.id)}
                          title="View"
                          aria-label="View"
                        >
                          <FolderOpen size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={req.id} data-requirement-id={req.id}>
                    <td>
                      <div className="fw-semibold text-dark">
                        {req.title}
                        {renderVersionBadge(req, docView)}
                        {req.attemptNumber && (
                          <span className="badge bg-light text-secondary border ms-1.5" style={{ fontSize: '0.65rem' }}>
                            Attempt {req.attemptNumber}
                          </span>
                        )}
                        {req.exemption && (
                          <span
                            className="badge bg-warning text-dark ms-1.5"
                            style={{ fontSize: '0.65rem' }}
                            title={`Exempted by ${req.exemption.grantedBy}: ${req.exemption.reason} (New date: ${formatMaritimeDate(req.exemption.newDate)})`}
                          >
                            Exempted ({formatMaritimeDate(req.exemption.newDate)})
                          </span>
                        )}
                        {renderTaskPlacement(req)}
                        {req.isSpecialized && (
                          <span className="badge bg-info-subtle text-info-emphasis border border-info-subtle ms-1.5" style={{ fontSize: '0.65rem' }}>
                            Custom
                          </span>
                        )}
                      </div>
                      {renderContractShortWarning(docView?.doc || linkedDoc)}
                      {req.description && (
                        <div className="text-secondary small mt-0.5" style={{ fontSize: '0.78rem', lineHeight: '1.4' }}>
                          {req.description}
                        </div>
                      )}
                      {(req.assignedSubmitter || req.assignedVerifier) && (
                        <div className="text-muted mt-1 d-flex align-items-center gap-2 flex-wrap" style={{ fontSize: '0.7rem' }}>
                          {req.assignedSubmitter && (
                            <span><span className="text-secondary fw-semibold">Submitter:</span> {req.assignedSubmitter.split(' (')[0]}</span>
                          )}
                          {req.assignedSubmitter && req.assignedVerifier && <span>·</span>}
                          {req.assignedVerifier && (
                            <span><span className="text-secondary fw-semibold">Verifier:</span> {req.assignedVerifier.split(' (')[0]}</span>
                          )}
                        </div>
                      )}
                      {/* the document judged against this set's contract period, not once for every set (gap review E5, G3) */}
                      {docView && (() => {
                        const validity = getValidityInContractPeriod(docView.doc.expiryDate, assuranceSet);
                        if (validity.state === 'unknown') return null;
                        const tone =
                          validity.state === 'valid_through_period'
                            ? 'bg-success-subtle text-success-emphasis border-success-subtle'
                            : validity.state === 'lapsed'
                              ? 'bg-danger-subtle text-danger-emphasis border-danger-subtle'
                              : 'bg-warning-subtle text-warning-emphasis border-warning-subtle';
                        return (
                          <div className="mt-1 d-flex align-items-center gap-2 flex-wrap" style={{ fontSize: '0.7rem' }}>
                            <span className={`badge border ${tone}`}>{validity.label}</span>
                            {validity.state !== 'valid_through_period' && validity.expiryDate && (
                              <span className="text-muted">
                                {formatMaritimeDate(validity.expiryDate)}
                                {/* a lapse names the issuer and the party responsible for renewal (paper 16.1) */}
                                {validity.state === 'lapsed' && (
                                  <>
                                    {' '}· {docView.doc.issuingAuthority || 'Issuing authority not recorded'}
                                    {' '}· Responsible: {assuranceSet.serviceProviderOrg || 'Service provider not recorded'}
                                  </>
                                )}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                      {req.decisionTime && (
                        <div className="text-muted mt-1" style={{ fontSize: '0.7rem' }}>
                          <span className="text-secondary fw-semibold">Decision:</span> {formatMaritimeDateTime(req.decisionTime)}
                        </div>
                      )}
                      {/* how this set's verifier confirmed the document (gap review G1) */}
                      {req.verifierStatus === 'Verified' && (
                        <div className="text-muted mt-1" style={{ fontSize: '0.7rem' }}>
                          <span className="text-secondary fw-semibold">Method:</span> {req.verificationMethod || 'Not recorded'}
                          {req.overrideReason && (
                            <span className="ms-2 text-warning-emphasis" title={req.overrideReason}>· Override</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <div className="d-flex align-items-center gap-2">
                        <span className="small text-dark">
                          {formatMaritimeDate(req.targetDate || assuranceSet.targetDate || assuranceSet.complianceDeadline)}
                        </span>
                        {roleActions.canChangeDates && !isCharterWindowLocked && (
                          <button
                            type="button"
                            className="btn btn-sm btn-link p-0 text-secondary"
                            title="Edit task target date"
                            onClick={() => openTaskDateEdit(req)}
                          >
                            <Pencil size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                    <td>
                      <ConfidenceBadge score={effectiveOcr} />
                    </td>
                    <td>
                      {renderRequirementStatus(req)}
                    </td>
                    <td className="text-end">
                      <div className="d-flex align-items-center justify-content-end gap-1.5 flex-wrap">
                        {linkedDoc ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center p-0"
                              style={{ width: '32px', height: '32px' }}
                              onClick={() => setSelectedDocForReview({ doc: docView?.doc || linkedDoc, notes: req.notes, requirementId: req.id, verifierStatus: req.verifierStatus, isVersionLocked: docView?.isLocked })}
                              title="PDF Review"
                              aria-label="PDF Review"
                            >
                              <FileText size={16} />
                            </button>
                            {canUploadHere && (
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center justify-content-center p-0"
                                style={{ width: '32px', height: '32px' }}
                                onClick={() => openRequirementUpload(req, linkedDoc)}
                                disabled={Boolean(getDocumentReuploadBlockReason(linkedDoc, notifications, new Date(), assuranceSet.charterWindowEnd))}
                                title={getDocumentReuploadBlockReason(linkedDoc, notifications, new Date(), assuranceSet.charterWindowEnd) || 'Upload new version'}
                                aria-label="Upload new version"
                              >
                                <RefreshCw size={16} />
                              </button>
                            )}
                          </>
                        ) : canUploadHere ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-primary text-white d-inline-flex align-items-center justify-content-center p-0"
                            style={{ width: '32px', height: '32px' }}
                            onClick={() => openRequirementUpload(req)}
                            title="Upload document"
                            aria-label="Upload document"
                          >
                            <Upload size={16} />
                          </button>
                        ) : (
                          <span className="text-secondary small">No Document</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* Other Documents Section Title: shown on the page that holds other documents, or on the last page */}
              {(pageOtherRequirements.length > 0 || isLastRequirementsPage) && (
                <tr className="bg-light border-top border-bottom">
                  <td colSpan={4} className="py-2.5 px-3">
                    <div className="d-flex align-items-center justify-content-between">
                      <span className="fw-bold text-secondary text-uppercase" style={{ fontSize: '0.75rem', letterSpacing: '0.05em' }}>
                        Other Documents
                      </span>
                    </div>
                  </td>
                </tr>
              )}

              {/* Other Documents Rows */}
              {otherRequirements.length > 0 ? (
                pageOtherRequirements.map((req: AssuranceRequirement) => {
                  const linkedDoc = documents.find((d) => d.id === req.documentId || (req.linkedDocumentId && d.id === req.linkedDocumentId));
                  /* an approved set shows the version it was approved against, not the live one */
                  const docView = linkedDoc ? getRequirementDocumentView(assuranceSet, req, linkedDoc) : undefined;
                  const hasAttachedDoc = Boolean(linkedDoc || req.documentId || req.linkedDocumentId);
                  const effectiveOcr = hasAttachedDoc ? (req.ocrConfidence || linkedDoc?.ocrConfidence || 0) : 0;

                  return (
                    <tr key={req.id} data-requirement-id={req.id}>
                      <td className="fw-semibold text-dark">
                        {req.title}
                        {renderVersionBadge(req, docView)}
                        {req.attemptNumber && (
                          <span className="badge bg-light text-secondary border ms-1.5" style={{ fontSize: '0.65rem' }}>
                            Attempt {req.attemptNumber}
                          </span>
                        )}
                        {renderTaskPlacement(req)}
                        {req.decisionTime && (
                          <div className="text-muted mt-0.5" style={{ fontSize: '0.7rem' }}>
                            <span className="text-secondary fw-semibold">Decision:</span> {formatMaritimeDateTime(req.decisionTime)}
                          </div>
                        )}
                        {renderContractShortWarning(docView?.doc || linkedDoc)}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <div className="d-flex align-items-center gap-2">
                          <span className="small text-dark">
                            {formatMaritimeDate(req.targetDate || assuranceSet.targetDate || assuranceSet.complianceDeadline)}
                          </span>
                          {roleActions.canChangeDates && !isCharterWindowLocked && (
                            <button
                              type="button"
                              className="btn btn-sm btn-link p-0 text-secondary"
                              title="Edit task target date"
                              onClick={() => openTaskDateEdit(req)}
                            >
                              <Pencil size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                      <td>
                        <ConfidenceBadge score={effectiveOcr} />
                      </td>
                      <td>
                        {renderRequirementStatus(req)}
                      </td>
                      <td className="text-end">
                        <div className="d-flex align-items-center justify-content-end gap-1.5 flex-wrap">
                          {linkedDoc ? (
                            <>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center p-0"
                                style={{ width: '32px', height: '32px' }}
                                onClick={() => setSelectedDocForReview({ doc: docView?.doc || linkedDoc, notes: req.notes, requirementId: req.id, verifierStatus: req.verifierStatus, isVersionLocked: docView?.isLocked })}
                                title="PDF Review"
                                aria-label="PDF Review"
                              >
                                <FileText size={16} />
                              </button>
                              {canUploadHere && (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center justify-content-center p-0"
                                  style={{ width: '32px', height: '32px' }}
                                  onClick={() => openRequirementUpload(req, linkedDoc)}
                                  disabled={Boolean(getDocumentReuploadBlockReason(linkedDoc, notifications, new Date(), assuranceSet.charterWindowEnd))}
                                  title={getDocumentReuploadBlockReason(linkedDoc, notifications, new Date(), assuranceSet.charterWindowEnd) || 'Upload new version'}
                                  aria-label="Upload new version"
                                >
                                  <RefreshCw size={16} />
                                </button>
                              )}
                            </>
                          ) : canUploadHere ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-primary text-white d-inline-flex align-items-center justify-content-center p-0"
                              style={{ width: '32px', height: '32px' }}
                              onClick={() => openRequirementUpload(req)}
                              title="Upload document"
                              aria-label="Upload document"
                            >
                              <Upload size={16} />
                            </button>
                          ) : (
                            <span className="text-secondary small">No Document</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                isLastRequirementsPage && (
                  <tr>
                    <td colSpan={4} className="text-center text-muted py-3 small">
                      No other documents yet.
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
        <TablePagination {...requirementsPagination.controls} />
      </div>
      )}

      {/* Tab: Tasks */}
      {activeTab === 'tasks' && (
        sectionSummaries.length > 0 ? (
          <div className="card map-card-custom">
            <div className="card-header p-0">
              <button
                type="button"
                className="btn btn-link text-decoration-none text-dark w-100 d-flex align-items-center gap-2 p-3 text-start"
                aria-expanded={sectionsOpen}
                onClick={() => setSectionsOpen((open) => !open)}
              >
                <ChevronDown
                  size={16}
                  className="flex-shrink-0"
                  style={{ transform: sectionsOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                />
                <span className="fw-bold">Task sections</span>
                <span className="small text-secondary">
                  {sectionSummaries.length} {sectionSummaries.length === 1 ? 'section' : 'sections'}
                  {sectionSummaries.filter((section) => section.heavy).length > 0 && (
                    <> &middot; {sectionSummaries.filter((section) => section.heavy).length} with 3+ open tasks</>
                  )}
                </span>
              </button>
            </div>
            {sectionsOpen && (
              <div className="card-body border-top">
                <div className="small text-secondary mb-2">Open tasks and certificates in each section. Sections with three or more tasks still open are highlighted.</div>
                <TaskSectionCards set={assuranceSet} />
              </div>
            )}
          </div>
        ) : (
          <div className="card map-card-custom p-4">
            <EmptyState
              title="No task sections"
              description="No task sections have been defined for this assurance set."
            />
          </div>
        )
      )}

      {/* Bottom Row: Requirements Register Table taking full 100% width across two columns */}


      {/* Tab: Audit Trail */}
      {activeTab === 'audit' && (
        <div className="card map-card-custom p-4">
          <div className="d-flex align-items-center justify-content-between mb-3">
            <div>
              <h5 className="fw-bold text-dark mb-1">Audit Trail</h5>
              <div className="small text-secondary">
                Immutable ledger of changes to this assurance set, its tasks, and target dates.
              </div>
            </div>
          </div>
          {setAuditEvents.length === 0 ? (
            <EmptyState
              title="No audit events recorded"
              description="There are no audit events recorded for this assurance set."
            />
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.8rem' }}>
                <thead className="table-light">
                  <tr>
                    <th>Timestamp</th>
                    <th>User &amp; Role</th>
                    <th>Action</th>
                    <th>Change Details</th>
                    <th>Justification</th>
                  </tr>
                </thead>
                <tbody>
                  {setAuditEvents.map((ev) => {
                    const note = ev.justificationNotes?.trim() ?? '';
                    return (
                      <tr key={ev.id} data-event-id={ev.id}>
                        <td className="font-mono-code small">{formatMaritimeDateTime(ev.timestampUtc)}</td>
                        <td className="small text-dark">
                          <div className="fw-semibold">{ev.userId}</div>
                          <span className="text-secondary">{getRoleDisplayLabel(ev.userRole)} &middot; {ev.organization}</span>
                        </td>
                        <td className="fw-semibold text-primary">{ev.action}</td>
                        <td className="small text-dark">{displayAuditChange(ev)}</td>
                        <td className="small text-secondary">
                          {note ? (
                            <span className="d-block text-truncate" title={note} tabIndex={0}>
                              {note}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}


      {/* Document Review Drawer */}
      <DocumentReviewDrawer
        document={selectedDocForReview?.doc || null}
        requirementNotes={selectedDocForReview?.notes}
        onClose={() => setSelectedDocForReview(null)}
        allowSubmit={roleActions.canUpload}
        allowVerify={roleActions.canVerify}
        requirementId={selectedDocForReview?.requirementId}
        requirementVerifierStatus={selectedDocForReview?.verifierStatus}
        assuranceSetId={assuranceSet.id}
        isVersionLocked={selectedDocForReview?.isVersionLocked}
      />

      {/* add an orphaned set to one existing project */}
      {isAddToProjectOpen && (
        <div
          className="modal fade show d-block"
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-to-project-title"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 1055 }}
        >
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '480px' }}>
            <div className="modal-content border-0 rounded-3">
              <div className="modal-header border-bottom px-4 py-3">
                <h5 id="add-to-project-title" className="modal-title fw-bold text-dark fs-6">Add to Project</h5>
                <button type="button" className="btn-close" onClick={closeAddToProject} aria-label="Close" />
              </div>
              <div className="modal-body px-4 py-4">
                {attachableProjects.length === 0 ? (
                  <p className="text-secondary small mb-0">
                    No projects yet. Create a project first.
                  </p>
                ) : (
                  <>
                    <label className="form-label text-secondary small fw-semibold" htmlFor="add-to-project-select">
                      Project <span className="text-danger">*</span>
                    </label>
                    <select
                      id="add-to-project-select"
                      className={`form-select bg-white text-dark border-secondary-subtle${addToProjectError ? ' is-invalid border-danger' : ''}`}
                      value={targetProjectId}
                      onChange={(e) => {
                        setTargetProjectId(e.target.value);
                        setAddToProjectError(null);
                      }}
                    >
                      <option value="">Select a project</option>
                      {attachableProjects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.id} &mdash; {p.name}
                        </option>
                      ))}
                    </select>
                    {addToProjectError && (
                      <div className="invalid-feedback d-block small mt-1">{addToProjectError}</div>
                    )}
                    <div className="form-text small">An assurance set can belong to one project only.</div>
                  </>
                )}
              </div>
              <div className="modal-footer border-top px-4 py-3">
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={closeAddToProject}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  disabled={!targetProjectId}
                  onClick={handleAddToProject}
                >
                  Add to Project
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {shortCertificateConfirm && (
        <>
          <div className="modal-backdrop fade show" />
          <div className="modal fade show d-block" role="dialog" aria-modal="true" aria-labelledby="short-certificate-title">
            <div className="modal-dialog modal-dialog-centered" ref={confirmDialogRef} tabIndex={-1}>
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title" id="short-certificate-title">Certificates expire before the contract ends</h5>
                </div>
                <div className="modal-body">
                  <p className="mb-2">
                    These certificates expire before {formatMaritimeDate(charterEndDraft)}. Saving still updates the contract period. Re-upload each one so it covers the contract.
                  </p>
                  <ul className="mb-0">
                    {shortCertificateConfirm.map((doc) => (
                      <li key={doc.id}>
                        {doc.title} — expires {formatMaritimeDate(doc.expiryDate)}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setShortCertificateConfirm(null)}>
                    Cancel
                  </button>
                  <button type="button" className="btn btn-primary" onClick={commitCharterWindow}>
                    Save contract period
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Version History Drawer for Submitter / Admin Reupload */}
      <VersionHistoryDrawer
        document={selectedDocForVersionHistory}
        onClose={() => setSelectedDocForVersionHistory(null)}
      />

      {/* Document Upload Modal */}
      <DocumentUploadModal
        isOpen={isUploadModalOpen}
        onClose={closeUploadModal}
        existingDocument={replaceExistingDoc}
        assuranceSetId={assuranceSet.id}
        requirementId={uploadTargetRequirement?.id}
        requirementTitle={uploadTargetRequirement?.title}
        requirementCategory={uploadTargetRequirement?.category}
        defaultVesselId={assuranceSet.vesselId}
        onUploadComplete={closeUploadModal}
      />

      {/* Edit Task Target Date Modal */}
      {editingTaskDate && (
        <>
          <div className="modal-backdrop fade show" />
          <div className="modal fade show d-block" role="dialog" aria-modal="true" aria-labelledby="edit-task-date-title">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title fs-6 fw-bold" id="edit-task-date-title">Edit Task Target Date</h5>
                  <button type="button" className="btn-close" aria-label="Close" onClick={() => setEditingTaskDate(null)} />
                </div>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label text-secondary small fw-semibold">Task</label>
                    <div className="fw-semibold text-dark">{editingTaskDate.title}</div>
                    <div className="text-muted small">ID: {editingTaskDate.reqId}</div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label text-secondary small fw-semibold" htmlFor="task-target-date-input">
                      Target Date <span className="text-danger">*</span>
                    </label>
                    <input
                      id="task-target-date-input"
                      type="date"
                      className={`form-control bg-white text-dark${taskDateError ? ' is-invalid border-danger' : ''}`}
                      value={taskDateDraft}
                      max={assuranceSet.targetDate || assuranceSet.complianceDeadline || undefined}
                      onChange={(e) => {
                        setTaskDateDraft(e.target.value);
                        setTaskDateError(null);
                      }}
                    />
                    <div className="form-text">
                      Must fall on or before the set target date ({formatMaritimeDate(assuranceSet.targetDate || assuranceSet.complianceDeadline)}).
                    </div>
                    {taskDateError && (
                      <div className="invalid-feedback d-block small mt-1">{taskDateError}</div>
                    )}
                  </div>
                  <div className="mb-2">
                    <label className="form-label text-secondary small fw-semibold" htmlFor="task-date-reason-input">
                      Reason for Change <span className="text-muted fw-normal">(optional)</span>
                    </label>
                    <input
                      id="task-date-reason-input"
                      type="text"
                      className="form-control bg-white text-dark"
                      placeholder="e.g. Schedule adjustment"
                      value={taskDateReasonDraft}
                      onChange={(e) => setTaskDateReasonDraft(e.target.value)}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setEditingTaskDate(null)}>
                    Cancel
                  </button>
                  <button type="button" className="btn btn-sm btn-primary" onClick={handleSaveTaskTargetDate}>
                    Save Target Date
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Target Date Permissions Modal */}
      {isDatePermissionsModalOpen && (
        <>
          <div className="modal-backdrop fade show" />
          <div className="modal fade show d-block" role="dialog" aria-modal="true" aria-labelledby="date-permissions-title">
            <div className="modal-dialog modal-dialog-centered modal-lg">
              <div className="modal-content">
                <div className="modal-header">
                  <div>
                    <h5 className="modal-title fs-6 fw-bold" id="date-permissions-title">Target Date Grants</h5>
                    <div className="text-muted small">Short-term permissions granted to named client users to change target dates (BRD V4.2 change 6).</div>
                  </div>
                  <button type="button" className="btn-close" aria-label="Close" onClick={() => setIsDatePermissionsModalOpen(false)} />
                </div>
                <div className="modal-body d-flex flex-column gap-3">
                  <div>
                    <h6 className="fw-bold text-dark small mb-2">Active & Recent Grants</h6>
                    {(!assuranceSet.datePermissionGrants || assuranceSet.datePermissionGrants.length === 0) ? (
                      <div className="alert alert-light border small text-muted mb-0">
                        No named client users have date modification grants on this set.
                      </div>
                    ) : (
                      <div className="table-responsive">
                        <table className="table table-sm table-bordered align-middle mb-0" style={{ fontSize: '0.78rem' }}>
                          <thead className="table-light">
                            <tr>
                              <th>Client User</th>
                              <th>Granted By</th>
                              <th>Granted At</th>
                              <th>Expires At</th>
                              <th>Status</th>
                              {activePersona === 'C Admin' && <th className="text-end">Action</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {assuranceSet.datePermissionGrants.map((grant) => {
                              const active = isDatePermissionActive(grant);
                              return (
                                <tr key={grant.id}>
                                  <td className="fw-semibold text-dark">{grant.userName}</td>
                                  <td>{grant.grantedBy}</td>
                                  <td>{formatMaritimeDate(grant.grantedAt)}</td>
                                  <td>{new Date(grant.expiresAt).toLocaleString()}</td>
                                  <td>
                                    {active ? (
                                      <span className="badge bg-success-subtle text-success border border-success-subtle">
                                        Active
                                      </span>
                                    ) : (
                                      <span className="badge bg-secondary-subtle text-secondary border border-secondary-subtle">
                                        Expired
                                      </span>
                                    )}
                                  </td>
                                  {activePersona === 'C Admin' && (
                                    <td className="text-end">
                                      {active && (
                                        <button
                                          type="button"
                                          className="btn btn-sm btn-link text-danger p-0"
                                          style={{ fontSize: '0.72rem' }}
                                          onClick={() => handleRevokePermission(grant.id)}
                                        >
                                          Revoke
                                        </button>
                                      )}
                                    </td>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {activePersona === 'C Admin' && (
                    <div className="card bg-light-subtle border p-3 rounded-2">
                      <h6 className="fw-bold text-dark small mb-2">Grant Short-Term Date Access</h6>
                      <div className="row g-2">
                        <div className="col-12 col-md-5">
                          <label className="form-label text-secondary small mb-1">Select Client User</label>
                          <select
                            className="form-select form-select-sm bg-white"
                            value={selectedGranteeId}
                            onChange={(e) => setSelectedGranteeId(e.target.value)}
                          >
                            <option value="">Choose client user...</option>
                            {users
                              .filter((u) => isClientUser(u, assuranceSet, activePersona))
                              .map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.name} ({u.organization})
                                </option>
                              ))}
                          </select>
                        </div>
                        <div className="col-12 col-md-3">
                          <label className="form-label text-secondary small mb-1">Duration</label>
                          <select
                            className="form-select form-select-sm bg-white"
                            value={grantDurationHours}
                            onChange={(e) => setGrantDurationHours(e.target.value)}
                          >
                            <option value="1">1 Hour</option>
                            <option value="2">2 Hours</option>
                            <option value="8">8 Hours</option>
                            <option value="24">24 Hours</option>
                            <option value="48">48 Hours</option>
                            <option value="168">7 Days</option>
                          </select>
                        </div>
                        <div className="col-12 col-md-4">
                          <label className="form-label text-secondary small mb-1">Reason (optional)</label>
                          <input
                            type="text"
                            className="form-control form-control-sm bg-white"
                            placeholder="e.g. Schedule audit window"
                            value={grantReasonDraft}
                            onChange={(e) => setGrantReasonDraft(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="mt-2 text-end">
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          disabled={!selectedGranteeId}
                          onClick={handleGrantPermission}
                        >
                          Grant Permission
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-sm btn-secondary" onClick={() => setIsDatePermissionsModalOpen(false)}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Overdue Outcome Modal: Revise Completion Date */}
      {isReviseDeadlineModalOpen && (
        <>
          <div className="modal-backdrop fade show" />
          <div className="modal show d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="revise-deadline-title">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <div>
                    <h5 className="modal-title fs-6 fw-bold" id="revise-deadline-title">Revise Completion Date</h5>
                    <div className="text-muted small">Update the target completion date for this overdue assurance set.</div>
                  </div>
                  <button type="button" className="btn-close" aria-label="Close" onClick={() => setIsReviseDeadlineModalOpen(false)} />
                </div>
                <div className="modal-body d-flex flex-column gap-3">
                  <div>
                    <label className="form-label text-secondary small mb-1">Current Deadline</label>
                    <div className="fw-bold text-dark">
                      {formatMaritimeDate(assuranceSet.revisedCompletionDate || assuranceSet.complianceDeadline || assuranceSet.targetDate || '')}
                    </div>
                  </div>
                  <div>
                    <label className="form-label text-secondary small mb-1" htmlFor="revised-deadline-input">
                      New Completion Date <span className="text-danger">*</span>
                    </label>
                    <input
                      id="revised-deadline-input"
                      type="date"
                      className="form-control form-control-sm"
                      value={revisedDateDraft}
                      onChange={(e) => {
                        setRevisedDateDraft(e.target.value);
                        setRevisedDateError(null);
                      }}
                    />
                    {revisedDateError && (
                      <div className="invalid-feedback d-block small">{revisedDateError}</div>
                    )}
                  </div>
                  <div>
                    <label className="form-label text-secondary small mb-1" htmlFor="revised-deadline-reason">
                      Reason for Revision <span className="text-muted fw-normal">(optional)</span>
                    </label>
                    <textarea
                      id="revised-deadline-reason"
                      rows={2}
                      className="form-control form-control-sm"
                      placeholder="e.g. Supplier delay in certification endorsement..."
                      value={revisedDateReason}
                      onChange={(e) => setRevisedDateReason(e.target.value)}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-sm btn-secondary" onClick={() => setIsReviseDeadlineModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="button" className="btn btn-sm btn-primary" onClick={handleSaveRevisedDeadline}>
                    Save Revised Date
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Overdue Outcome Modal: Exempt Tasks */}
      {isExemptTasksModalOpen && (
        <>
          <div className="modal-backdrop fade show" />
          <div className="modal show d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="exempt-tasks-title">
            <div className="modal-dialog modal-dialog-centered modal-lg">
              <div className="modal-content">
                <div className="modal-header">
                  <div>
                    <h5 className="modal-title fs-6 fw-bold" id="exempt-tasks-title">Exempt Tasks from Completion Date</h5>
                    <div className="text-muted small">Grant individual deadline extensions for specific tasks so the set can proceed.</div>
                  </div>
                  <button type="button" className="btn-close" aria-label="Close" onClick={() => setIsExemptTasksModalOpen(false)} />
                </div>
                <div className="modal-body d-flex flex-column gap-3">
                  <div>
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <label className="form-label text-secondary small mb-0 fw-bold">Select Tasks to Exempt</label>
                      <div className="d-flex gap-2">
                        <button
                          type="button"
                          className="btn btn-link btn-sm p-0 text-decoration-none"
                          onClick={() => setSelectedExemptTaskIds(assuranceSet.requirements.map((r) => r.id))}
                        >
                          Select All
                        </button>
                        <span className="text-muted">·</span>
                        <button
                          type="button"
                          className="btn btn-link btn-sm p-0 text-decoration-none"
                          onClick={() => setSelectedExemptTaskIds([])}
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                    <div className="table-responsive border rounded" style={{ maxHeight: '200px' }}>
                      <table className="table table-sm table-hover align-middle mb-0" style={{ fontSize: '0.8rem' }}>
                        <thead className="table-light">
                          <tr>
                            <th style={{ width: '40px' }}></th>
                            <th>Task Title</th>
                            <th>Current Target Date</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {assuranceSet.requirements.map((req) => {
                            const isSelected = selectedExemptTaskIds.includes(req.id);
                            return (
                              <tr
                                key={req.id}
                                style={{ cursor: 'pointer' }}
                                onClick={() => {
                                  setSelectedExemptTaskIds((prev) =>
                                    prev.includes(req.id) ? prev.filter((id) => id !== req.id) : [...prev, req.id],
                                  );
                                }}
                              >
                                <td>
                                  <input
                                    type="checkbox"
                                    className="form-check-input"
                                    checked={isSelected}
                                    onChange={() => { }}
                                  />
                                </td>
                                <td className="fw-semibold text-dark">
                                  {req.title}
                                  {req.exemption && (
                                    <span className="badge bg-warning text-dark ms-1.5" style={{ fontSize: '0.65rem' }}>
                                      Already Exempted
                                    </span>
                                  )}
                                </td>
                                <td className="text-muted">
                                  {formatMaritimeDate(req.targetDate || req.exemption?.newDate || assuranceSet.targetDate || assuranceSet.complianceDeadline || '')}
                                </td>
                                <td>
                                  <span className={`badge ${req.isFulfilled ? 'bg-success' : 'bg-secondary'}`}>
                                    {req.verifierStatus || (req.isFulfilled ? 'Approved' : 'Pending')}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="row g-2">
                    <div className="col-md-6">
                      <label className="form-label text-secondary small mb-1" htmlFor="exemption-granted-by">
                        Granted By
                      </label>
                      <input
                        id="exemption-granted-by"
                        type="text"
                        className="form-control form-control-sm"
                        value={exemptionGrantedByDraft}
                        onChange={(e) => setExemptionGrantedByDraft(e.target.value)}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label text-secondary small mb-1" htmlFor="exemption-new-date">
                        New Target Date for Exempted Tasks <span className="text-danger">*</span>
                      </label>
                      <input
                        id="exemption-new-date"
                        type="date"
                        className="form-control form-control-sm"
                        value={exemptionNewDateDraft}
                        onChange={(e) => {
                          setExemptionNewDateDraft(e.target.value);
                          setExemptionError(null);
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="form-label text-secondary small mb-1" htmlFor="exemption-reason">
                      Exemption Reason <span className="text-danger">*</span>
                    </label>
                    <textarea
                      id="exemption-reason"
                      rows={2}
                      className="form-control form-control-sm"
                      placeholder="e.g. Vessel dry-dock survey scheduled for next week..."
                      value={exemptionReasonDraft}
                      onChange={(e) => {
                        setExemptionReasonDraft(e.target.value);
                        setExemptionError(null);
                      }}
                    />
                  </div>

                  {exemptionError && (
                    <div className="alert alert-danger py-1.5 px-3 mb-0 small">{exemptionError}</div>
                  )}
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-sm btn-secondary" onClick={() => setIsExemptTasksModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="button" className="btn btn-sm btn-primary" onClick={handleGrantExemptions}>
                    Grant Exemption ({selectedExemptTaskIds.length})
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Overdue Outcome Modal: Partial Closure */}
      {isPartialCloseModalOpen && (
        <>
          <div className="modal-backdrop fade show" />
          <div className="modal show d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="partial-close-title">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <div>
                    <h5 className="modal-title fs-6 fw-bold" id="partial-close-title">Confirm Partial Closure</h5>
                    <div className="text-muted small">Partially approve this assurance set while leaving exempted tasks open.</div>
                  </div>
                  <button type="button" className="btn-close" aria-label="Close" onClick={() => setIsPartialCloseModalOpen(false)} />
                </div>
                <div className="modal-body d-flex flex-column gap-3">
                  <div className="alert alert-warning py-2 mb-0 small">
                    <strong>Partial Closure Policy:</strong> The set will be moved to Approved status with partial closure mode. All exempted tasks will remain open and retain their extended completion dates.
                  </div>
                  <div className="d-flex flex-column gap-1 small">
                    <div>
                      <span className="text-muted">Total tasks:</span>{' '}
                      <span className="fw-semibold text-dark">{assuranceSet.requirements.length}</span>
                    </div>
                    <div>
                      <span className="text-muted">Exempted tasks (will remain open):</span>{' '}
                      <span className="fw-semibold text-warning">
                        {assuranceSet.requirements.filter((r) => r.exemption).length}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted">Completed / fulfilled tasks:</span>{' '}
                      <span className="fw-semibold text-success">
                        {assuranceSet.requirements.filter((r) => r.isFulfilled).length}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="form-label text-secondary small mb-1" htmlFor="partial-close-notes">
                      Closure Notes <span className="text-muted fw-normal">(optional)</span>
                    </label>
                    <textarea
                      id="partial-close-notes"
                      rows={2}
                      className="form-control form-control-sm"
                      placeholder="e.g. Approved with partial closure under management exemption..."
                      value={partialCloseNotes}
                      onChange={(e) => setPartialCloseNotes(e.target.value)}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-sm btn-secondary" onClick={() => setIsPartialCloseModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="button" className="btn btn-sm btn-warning text-dark fw-semibold" onClick={handleConfirmPartialClose}>
                    Partially Close Set
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Overdue Outcome Modal: Cancel Set */}
      {isCancelModalOpen && (
        <>
          <div className="modal-backdrop fade show" />
          <div className="modal show d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="cancel-set-title">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <div>
                    <h5 className="modal-title fs-6 fw-bold text-danger" id="cancel-set-title">Cancel Assurance Set</h5>
                    <div className="text-muted small">Move this assurance set to Cancelled status.</div>
                  </div>
                  <button type="button" className="btn-close" aria-label="Close" onClick={() => setIsCancelModalOpen(false)} />
                </div>
                <div className="modal-body d-flex flex-column gap-3">
                  <div className="alert alert-danger py-2 mb-0 small">
                    <strong>Permanent Action:</strong> Cancelling moves this set to <strong>Cancelled</strong> status. There is no action to restart or re-initiate this set.
                  </div>
                  <div>
                    <label className="form-label text-secondary small mb-1" htmlFor="cancel-reason">
                      Cancellation Reason <span className="text-muted fw-normal">(optional)</span>
                    </label>
                    <textarea
                      id="cancel-reason"
                      rows={2}
                      className="form-control form-control-sm"
                      placeholder="e.g. Vessel replacement nominated by charterer; campaign discontinued..."
                      value={cancellationReasonDraft}
                      onChange={(e) => setCancellationReasonDraft(e.target.value)}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-sm btn-secondary" onClick={() => setIsCancelModalOpen(false)}>
                    Keep Set
                  </button>
                  <button type="button" className="btn btn-sm btn-danger text-white fw-semibold" onClick={handleConfirmCancel}>
                    Cancel Set
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
