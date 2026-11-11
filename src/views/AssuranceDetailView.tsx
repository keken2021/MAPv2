/* 
  file summary: assurance set command center deep-dive view presenting stage pipeline stepper and requirements register in light theme.
  responsibilities: manages requirement verification statuses, displays pipeline stage progress, and enforces C Admin read-only rules.
  role in system: deep-dive view rendered when an assurance set row is selected.
*/

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, ChevronRight, Users, UserMinus, RotateCcw, FolderOpen, FileCheck, FileText, Lock, RefreshCw, Upload, Pencil, Calendar, Key, ShieldCheck, Plus, Trash2, Eye, Search } from 'lucide-react';
import { useMapStore } from '../store/useMapStore';
import { PipelineStepper } from '../components/common/PipelineStepper';
import { ReadinessGauge } from '../components/common/ReadinessGauge';
import { DetailHeader } from '../components/common/DetailHeader';
import { isAssuranceSetAtRisk } from '../config/thresholds';
import { ConfidenceBadge } from '../components/common/ConfidenceBadge';
import { ObjectVerificationBadge } from '../components/common/ObjectVerificationBadge';
import { DocumentReviewDrawer } from '../components/drawers/DocumentReviewDrawer';
import { formatMaritimeDate, formatMaritimeDateTime, formatReviewChannel, getProviderLabel, getStatusDisplayLabel, toSentenceCase } from '../utils/formatters';
import { setOrganizations, setOrganizationParties } from '../utils/projectHelpers';
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
import { AssuranceObject, AssuranceRequirement, AssuranceSetGroupRef, AssuranceSubtype, DatePermissionGrant, TargetDateChangeRecord, TaskSection, ThreePillarsCategory } from '../types/assurance';
import { filterProjectsForPersona, getProjectForAssuranceSet, isAssuranceSetOrphaned } from '../utils/projectHelpers';

import { VersionHistoryDrawer } from '../components/drawers/VersionHistoryDrawer';
import { exportToCsv, exportToPdf } from '../utils/exportHelpers';
import { DocumentUploadModal } from '../components/modals/DocumentUploadModal';
import { AttachAssuranceSetPreviewModal } from '../components/modals/AttachAssuranceSetPreviewModal';
import { AssuranceTaskModal } from '../components/modals/AssuranceTaskModal';
import { ProjectTasksTable, getTaskRowActionLabel } from '../components/tables/ProjectTasksTable';
import {
  canAssignStakeholderRole,
  getOrganizationRoleCandidates,
  getServiceProviderSubmitterCandidates,
  getStakeholderRoleOrganization,
  PENDING_ASSIGNMENT,
  setSubmitters,
  StakeholderRole,
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
  orgFieldMatches,
  isProjectOwnerWithoutSubSetGroup,
} from '../utils/rbacHelpers';
import { useSessionUser } from '../utils/useSessionUser';
import { ApproverDecisionBar } from '../components/common/ApproverDecisionBar';
import { getDocumentReuploadBlockReason, documentExpiresBeforeContractEnd, listCertificatesShortOfContract } from '../utils/documentRenewalHelpers';
import { Modal } from '../components/modals/Modal';
import { ConfirmDialog } from '../components/modals/ConfirmDialog';
import { getAssuranceSetAssets, getAssuranceSetCrewIds, getAssuranceSetObjects, getAssuranceSetScopes, SUBTYPE_CATEGORIES } from '../utils/assuranceTemplates';
import { findOverlappingAssuranceSets, formatOverlapError } from '../utils/assuranceOverlap';
import {
  deriveObjectVerification,
  getRequirementDocumentView,
  isClosedAssuranceSet,
  RequirementDocumentView,
  isRequirementOnOlderVersion,
  countOutdatedVersionRequirements,
} from '../utils/documentVersionSnapshot';
import { usePagination } from '../utils/usePagination';
import { TablePagination } from '../components/common/TablePagination';
import { getValidityInContractPeriod } from '../utils/expiryPolicy';
import { EmptyState } from '../components/common/EmptyState';
import { Tabs } from '../components/common/Tabs';
import { ListToolbar } from '../components/common/ListToolbar';
import { StatusBadge } from '../components/common/StatusBadge';
import { AuditEventTarget, AuditTrailEvent, formatAuditTarget, auditEventMatchesSearch } from '../types/audit';
import { getRoleDisplayLabel } from '../utils/userRoleHelpers';

export type AssuranceDetailTab = 'details' | 'objects' | 'requirements' | 'tasks' | 'audit';


interface RequirementSectionInfo {
  sectionId: string;
  sectionTitle: string;
  sectionOrder: number;
  isGeneral: boolean;
  isCustom: boolean;
  scope?: AssuranceSubtype | 'activity';
}

function getRequirementSectionInfo(
  req: AssuranceRequirement,
  setSections?: TaskSection[],
): RequirementSectionInfo {
  const isGeneral =
    req.sectionId === 'sec-general' ||
    req.sectionId === 'general' ||
    Boolean(
      req.title &&
      (req.title.includes('Document of Compliance (DOC)') ||
        req.title.includes('Company ISM Document of Compliance') ||
        req.title.includes('Non-Disclosure Agreement (NDA)') ||
        req.title.includes('Master Service Agreement (MSA)'))
    );

  if (isGeneral) {
    const sec = setSections?.find((s) => s.id === 'sec-general' || s.id === 'general');
    return {
      sectionId: 'sec-general',
      sectionTitle: toSentenceCase(sec?.name || 'General documents'),
      sectionOrder: sec?.order ?? 0,
      isGeneral: true,
      isCustom: false,
    };
  }

  if (req.sectionId) {
    const customSec = setSections?.find(
      (s) =>
        s.id === req.sectionId &&
        !['sec-general', 'general', 'sec-vessel', 'sec-crew', 'sec-equipment', 'sec-activity', 'sec-procedure', 'sec-method'].includes(s.id),
    );
    if (customSec) {
      return {
        sectionId: customSec.id,
        sectionTitle: toSentenceCase(customSec.name),
        sectionOrder: customSec.order ?? 100,
        isGeneral: false,
        isCustom: true,
      };
    }
  }

  let scope: AssuranceSubtype | 'activity' = 'Vessel';
  if (req.subtype) {
    scope = req.subtype;
  } else if (req.sectionId?.startsWith('sec-')) {
    const slug = req.sectionId.replace('sec-', '').toLowerCase();
    if (slug === 'crew') scope = 'Crew';
    else if (slug === 'equipment') scope = 'Equipment';
    else if (slug === 'activity' || slug === 'procedure' || slug === 'method') scope = 'activity';
    else if (slug === 'vessel') scope = 'Vessel';
  } else {
    const cat = req.category || '';
    if (/crew|competency|medical|bosiet|credential/i.test(cat)) {
      scope = 'Crew';
    } else if (/equipment|lifting|crane|fmea/i.test(cat)) {
      scope = 'Equipment';
    } else if (/operational|risk|simops|mooring|emergency|procedure|method/i.test(cat)) {
      scope = 'activity';
    } else {
      scope = 'Vessel';
    }
  }

  const scopeSlug = scope.toLowerCase();
  const secId = `sec-${scopeSlug}`;
  const matchedSec = setSections?.find(
    (s) =>
      s.id === secId ||
      s.id === scopeSlug ||
      s.name.toLowerCase().includes(scopeSlug),
  );

  const defaultTitle =
    scope === 'Vessel'
      ? 'Vessel documents'
      : scope === 'Crew'
        ? 'Crew directory documents'
        : scope === 'Equipment'
          ? 'Equipment documents'
          : 'Activities';

  const defaultOrder =
    scope === 'Vessel'
      ? 10
      : scope === 'Crew'
        ? 20
        : scope === 'Equipment'
          ? 30
          : 40;

  return {
    sectionId: secId,
    sectionTitle: toSentenceCase(matchedSec?.name || defaultTitle),
    sectionOrder: matchedSec?.order ?? defaultOrder,
    isGeneral: false,
    isCustom: false,
    scope,
  };
}

function getRequirementSubtype(
  req: AssuranceRequirement,
  secInfo: RequirementSectionInfo,
): string {
  if (secInfo.isGeneral || secInfo.isCustom || secInfo.scope === 'activity' || (secInfo.scope as any) === 'Activity') {
    return '';
  }
  return req.category || 'Standard Documents';
}

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
    if (lower === 'objects' || lower === 'object') return 'objects';
    if (lower === 'requirements') return 'requirements';
    if (lower === 'tasks') return 'tasks';
    if (lower === 'audit' || lower === 'audit-trail' || lower === 'audittrail') return 'audit';
    if (lower === 'details') return 'details';
  }
  return 'details';
}

export type AuditMovementCategory =
  | 'all'
  | 'stage_workflow'
  | 'docs_reqs'
  | 'stakeholders_parties'
  | 'tasks_findings'
  | 'dates_scope';

/**
  what: checks if an audit event matches a movement category.
  how: checks target kind and falls back to keywords in action and delta field name.
  with what file: src/views/AssuranceDetailView.tsx used by the Audit Trail tab filter.
*/
export function matchesAuditCategory(ev: AuditTrailEvent, category: AuditMovementCategory): boolean {
  if (category === 'all') return true;

  const targetKind = ev.target?.kind;
  const action = ev.action.toLowerCase();
  const field = ev.fieldDelta?.fieldName?.toLowerCase() ?? '';

  switch (category) {
    case 'stage_workflow':
      return (
        targetKind === 'stage' ||
        targetKind === 'set' ||
        action.startsWith('system transition') ||
        action.includes('stage') ||
        action.includes('workflow') ||
        action.includes('status') ||
        action.includes('approval') ||
        action.includes('decision') ||
        action.includes('sign-off') ||
        action.includes('readiness') ||
        field === 'stage' ||
        field === 'status'
      );
    case 'docs_reqs':
      return (
        targetKind === 'document' ||
        targetKind === 'requirement' ||
        Boolean(ev.documentStatusDelta) ||
        action.includes('document') ||
        action.includes('certificate') ||
        action.includes('requirement') ||
        action.includes('upload') ||
        action.includes('verify') ||
        action.includes('version') ||
        field.includes('document') ||
        field.includes('version') ||
        field.includes('requirement')
      );
    case 'stakeholders_parties':
      return (
        targetKind === 'stakeholder' ||
        targetKind === 'party' ||
        action.includes('stakeholder') ||
        action.includes('party') ||
        action.includes('assign') ||
        action.includes('role') ||
        field.includes('stakeholder') ||
        field.includes('party') ||
        field.includes('role') ||
        field.includes('candidate')
      );
    case 'tasks_findings':
      return (
        targetKind === 'task' ||
        targetKind === 'finding' ||
        action.includes('task') ||
        action.includes('finding') ||
        action.includes('capa') ||
        action.includes('defect') ||
        action.includes('exemption') ||
        field.includes('task') ||
        field.includes('finding') ||
        field.includes('capa')
      );
    case 'dates_scope':
      return (
        targetKind === 'date' ||
        targetKind === 'object' ||
        action.includes('date') ||
        action.includes('deadline') ||
        action.includes('window') ||
        action.includes('permission') ||
        action.includes('scope') ||
        action.includes('object') ||
        action.includes('vessel') ||
        field.includes('date') ||
        field.includes('deadline') ||
        field.includes('window')
      );
    default:
      return true;
  }
}

function displayAuditValue(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(value)) return value;
  const formatted = formatMaritimeDate(value);
  return formatted === 'N/A' ? value : formatted;
}

function displayAuditTarget(event: AuditTrailEvent): string {
  return formatAuditTarget(event.target)
    .split('Set unscoped').join('No assurance set')
    .split('Date targetDate').join('Target date');
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

const OBJECT_TYPE_LABELS: Record<string, string> = {
  vessel: 'Vessel',
  person: 'Crew',
  equipment: 'Equipment',
  activity: 'Activity',
  document: 'Document',
  organization: 'Organization',
};

/**
  what: resolves the responsible party organization for a requirement task.
  how: checks assignedSubmitter (explicit or parenthesized organization), matched user profile, target object owner, set submitter, and set service provider organization.
  with what file: src/views/AssuranceDetailView.tsx used for party-scoped document visibility (findings 5e-01, 5e-03).
*/
function getRequirementGroupKey(req: AssuranceRequirement): string {
  if (req.requirementGroupId?.trim()) {
    return `grp:${req.requirementGroupId.trim()}`;
  }
  return `req:${req.sectionId || ''}:${req.title.trim().toLowerCase()}`;
}

function getRequirementResponsiblePartyOrg(
  req: AssuranceRequirement,
  set: { assignedSubmitter?: string; serviceProviderOrg?: string },
  users: Array<{ id: string; name: string; organization?: string }>,
  objects: AssuranceObject[],
): string {
  if (req.responsibleParty?.trim()) {
    return req.responsibleParty.trim();
  }
  if (req.responsibleParties && req.responsibleParties.length === 1 && req.responsibleParties[0]?.trim()) {
    return req.responsibleParties[0].trim();
  }
  if (req.assignedSubmitter) {
    const parenMatch = req.assignedSubmitter.match(/\(([^)]+)\)/);
    if (parenMatch && parenMatch[1].trim()) {
      return parenMatch[1].trim();
    }
    const matchedUser = users.find(
      (u) =>
        u.name.toLowerCase() === req.assignedSubmitter?.trim().toLowerCase() ||
        (req.submitterId && u.id === req.submitterId),
    );
    if (matchedUser?.organization) {
      return matchedUser.organization;
    }
  }

  if (req.targetObjectId) {
    const targetObj = objects.find((o) => o.id === req.targetObjectId);
    if (targetObj?.ownerOrganization) {
      return targetObj.ownerOrganization;
    }
  }

  if (set.assignedSubmitter) {
    const parenMatch = set.assignedSubmitter.match(/\(([^)]+)\)/);
    if (parenMatch && parenMatch[1].trim()) {
      return parenMatch[1].trim();
    }
  }

  return set.serviceProviderOrg || '';
}

function getRequirementPartyLabel(
  req: AssuranceRequirement,
  set: { assignedSubmitter?: string; serviceProviderOrg?: string },
  users: Array<{ id: string; name: string; organization?: string }>,
  objects: AssuranceObject[],
): string {
  if (req.responsibleParty?.trim()) {
    return req.responsibleParty.trim();
  }
  if (req.responsibleParties && req.responsibleParties.length === 1 && req.responsibleParties[0]?.trim()) {
    return req.responsibleParties[0].trim();
  }
  const resolved = getRequirementResponsiblePartyOrg(req, set, users, objects);
  if (resolved?.trim()) {
    return resolved.trim();
  }
  if (req.assignedSubmitter?.trim()) {
    const parenMatch = req.assignedSubmitter.match(/\(([^)]+)\)/);
    if (parenMatch && parenMatch[1].trim()) {
      return parenMatch[1].trim();
    }
    return req.assignedSubmitter.trim();
  }
  return '';
}

/**
  what: checks if a requirement's document is visible to the active viewer.
  how: client organization sees all documents; non-client parties see only documents for their own tasks (matching viewer organization).
  with what file: src/views/AssuranceDetailView.tsx used for requirement rows, document viewer, exports, and audit trail.
*/
function isRequirementDocumentVisible(
  req: AssuranceRequirement,
  isClient: boolean,
  viewerOrg: string,
  set: {
    assignedSubmitter?: string;
    serviceProviderOrg?: string;
    stakeholders?: { verifierOrg?: string; inspectorOrg?: string; approverOrg?: string } | null;
  },
  users: Array<{ id: string; name: string; organization?: string }>,
  objects: AssuranceObject[],
): boolean {
  if (isClient) return true;
  if (!viewerOrg.trim()) return false;
  // Reviewing organizations (verifier / inspector / approver) must be able to read the documents they review.
  const reviewerOrgs = [set.stakeholders?.verifierOrg, set.stakeholders?.inspectorOrg, set.stakeholders?.approverOrg];
  if (reviewerOrgs.some((org) => org?.trim() && orgFieldMatches(viewerOrg, org))) return true;
  const partyOrg = getRequirementResponsiblePartyOrg(req, set, users, objects);
  if (!partyOrg.trim()) return false;
  return orgFieldMatches(viewerOrg, partyOrg);
}

interface AssuranceDetailViewProps {
  setId: string;
  initialTab?: AssuranceDetailTab;
}

/**
  what: renders assurance set command center deep-dive view in light theme.
  how: displays pipeline stepper header, requirement register table with export controls, and opens DocumentReviewDrawer, VersionHistoryDrawer, or DocumentUploadModal based on persona RBAC.
  with what file: src/views/AssuranceDetailView.tsx loaded by App.tsx.
*/
export const AssuranceDetailView: React.FC<AssuranceDetailViewProps> = ({ setId, initialTab }) => {
  const {
    assuranceSets,
    assuranceObjects,
    crew = [],
    vessels,
    auditEvents,
    logExport,
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
    excludeGroupMember,
    restoreGroupMember,
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
  const [isAttachPreviewOpen, setIsAttachPreviewOpen] = useState(false);
  const [isEditingCharterWindow, setIsEditingCharterWindow] = useState(false);
  const [charterStartDraft, setCharterStartDraft] = useState('');
  const [charterEndDraft, setCharterEndDraft] = useState('');
  const [plannedCharterDateDraft, setPlannedCharterDateDraft] = useState('');
  const [deadlineDraft, setDeadlineDraft] = useState('');
  const [deadlineReasonDraft, setDeadlineReasonDraft] = useState('');
  const [isDatePermissionsModalOpen, setIsDatePermissionsModalOpen] = useState(false);
  const [selectedGranteeId, setSelectedGranteeId] = useState('');
  const [grantDurationDays, setGrantDurationDays] = useState('14');
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
  const [partialCloseError, setPartialCloseError] = useState<string | null>(null);

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
    sectionId: '',
    predecessorId: '',
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
    sectionId: '',
    predecessorId: '',
  });
  const [editTaskError, setEditTaskError] = useState<string | null>(null);

  const [taskToDelete, setTaskToDelete] = useState<AssuranceRequirement | null>(null);
  const [shortCertificateConfirm, setShortCertificateConfirm] = useState<MasterDocument[] | null>(null);
  const [targetProjectId, setTargetProjectId] = useState('');
  const [addToProjectError, setAddToProjectError] = useState<string | null>(null);
  const [projectToast, setProjectToast] = useState<string | null>(null);
  const [selectedDocForReview, setSelectedDocForReview] = useState<{ doc: MasterDocument; notes?: string; requirementId?: string; verifierStatus?: string; isVersionLocked?: boolean } | null>(null);
  const [selectedDocForVersionHistory, setSelectedDocForVersionHistory] = useState<MasterDocument | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadTargetRequirement, setUploadTargetRequirement] = useState<AssuranceRequirement | null>(null);
  const [replaceExistingDoc, setReplaceExistingDoc] = useState<MasterDocument | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<'Submitter' | 'Verifier' | 'Inspector' | 'Approver' | null>(null);
  const [editingSubmitterOrg, setEditingSubmitterOrg] = useState<string | null>(null);

  const [objectSearch, setObjectSearch] = useState('');
  const [isAddingCustomSection, setIsAddingCustomSection] = useState(false);
  const [customSectionName, setCustomSectionName] = useState('');
  const [customSectionError, setCustomSectionError] = useState('');
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
        setIsAddMenuOpen(false);
      }
    };
    if (isAddMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isAddMenuOpen]);

  const handleSaveCustomSection = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = customSectionName.trim();
    if (!trimmed) {
      setCustomSectionError('A section name is required.');
      return;
    }
    const formattedName = toSentenceCase(trimmed);
    const newSectionId = `csec-${Date.now()}`;
    const currentSections = assuranceSet?.sections || [];
    const newSection: TaskSection = {
      id: newSectionId,
      name: formattedName,
      order: currentSections.length + 10,
    };
    if (assuranceSet) {
      updateAssuranceSet({
        ...assuranceSet,
        sections: [...currentSections, newSection],
      });
    }
    setCustomSectionName('');
    setCustomSectionError('');
    setIsAddingCustomSection(false);
  };

  type ReqSortField = 'title' | 'targetDate' | 'targetObject' | 'status' | 'version';

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

  const [activeTab, setActiveTab] = useState<AssuranceDetailTab>(() => initialTab || parseTabFromUrl());
  const [showBackToTasks, setShowBackToTasks] = useState<boolean>(false);
  /* the Tasks pane mounts on first visit and then stays mounted, so its search, filters and page survive tab changes */
  const [tasksPaneMounted, setTasksPaneMounted] = useState<boolean>(activeTab === 'tasks');
  useEffect(() => {
    if (activeTab === 'tasks') setTasksPaneMounted(true);
  }, [activeTab]);
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(() => new Set());
  const [expandedReqIds, setExpandedReqIds] = useState<Set<string>>(() => new Set());
  const [isEmptySectionsExpanded, setIsEmptySectionsExpanded] = useState<boolean>(false);

  const toggleGroupExpand = (groupId: string) => {
    setExpandedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const toggleReqExpand = (id: string) => {
    setExpandedReqIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const [excludingMember, setExcludingMember] = useState<{ memberId: string; memberName: string; groupId: string } | null>(null);

  const openExcludeModal = (memberId: string, memberName: string, groupId: string) => {
    setExcludingMember({ memberId, memberName, groupId });
  };

  const closeExcludeModal = () => {
    setExcludingMember(null);
  };

  const handleConfirmExclude = (reason?: string) => {
    if (!excludingMember) return;
    const actor = sessionUser?.name || activePersona;
    excludeGroupMember(assuranceSet.id, excludingMember.memberId, reason ?? '', actor);
    closeExcludeModal();
  };

  const handleRestoreMember = (memberId: string) => {
    const actor = sessionUser?.name || activePersona;
    restoreGroupMember(assuranceSet.id, memberId, actor);
  };

  const isMemberExcluded = useCallback((memberId: string) => {
    return Boolean(
      assuranceSet?.memberExclusions?.some(
        (ex) => ex.memberId === memberId && !ex.restored,
      ),
    );
  }, [assuranceSet?.memberExclusions]);

  const getGroupRollupStatus = useCallback((group: AssuranceSetGroupRef) => {
    const included = group.memberIds.filter((id) => !isMemberExcluded(id));
    if (included.length === 0) {
      return {
        label: 'No Active Members',
        badgeText: 'Excluded',
        tone: 'neutral' as const,
        verifiedCount: 0,
        totalCount: 0,
      };
    }
    let verifiedCount = 0;
    included.forEach((memberId) => {
      const v = deriveObjectVerification(memberId, assuranceSets, activeDemoOrganization);
      if (v && v.status.toLowerCase().includes('verified')) {
        verifiedCount++;
        return;
      }
      const memberReqs = (assuranceSet?.requirements || []).filter(
        (r) => r.targetObjectId === memberId,
      );
      if (memberReqs.length > 0 && memberReqs.every((r) => r.verifierStatus === 'Verified')) {
        verifiedCount++;
        return;
      }
      const c = (crew || []).find((x) => x.id === memberId);
      if (c?.complianceStatus === 'Fully Compliant') {
        verifiedCount++;
      }
    });

    if (verifiedCount === included.length) {
      return {
        label: 'Verified',
        badgeText: 'Fully Verified',
        tone: 'success' as const,
        verifiedCount,
        totalCount: included.length,
      };
    }
    if (verifiedCount > 0) {
      return {
        label: 'Partial',
        badgeText: 'Partially Verified',
        tone: 'warning' as const,
        verifiedCount,
        totalCount: included.length,
      };
    }
    return {
      label: 'Pending',
      badgeText: 'Pending',
      tone: 'neutral' as const,
      verifiedCount: 0,
      totalCount: included.length,
    };
  }, [isMemberExcluded, assuranceSets, activeDemoOrganization, assuranceSet?.requirements, crew]);

  const handleTabChange = (tab: AssuranceDetailTab) => {
    setShowBackToTasks(false);
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
      setShowBackToTasks(false);
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
  const assuranceSetTags: ThreePillarsCategory[] = useMemo(() => {
    if (Array.isArray(assuranceSet?.tags) && assuranceSet.tags.length > 0) {
      return assuranceSet.tags;
    }
    if (Array.isArray(assuranceSet?.pppTags) && assuranceSet.pppTags.length > 0) {
      return assuranceSet.pppTags;
    }
    return [];
  }, [assuranceSet?.tags, assuranceSet?.pppTags]);

  const clientOwnerOrg =
    assuranceSet?.clientOrg || assuranceSet?.charterer || assuranceSet?.initiatorOrg || '';
  const serviceProviderOrg = assuranceSet?.serviceProviderOrg;
  const organizationParties = assuranceSet ? setOrganizationParties(assuranceSet) : [];

  const setObjects = useMemo(() => {
    if (!assuranceSet) return [];
    const baseObjects = getAssuranceSetObjects(assuranceSet);
    const byId = new Map<string, AssuranceObject>();
    baseObjects.forEach((obj) => byId.set(obj.id, obj));

    (assuranceSet.requirements || []).forEach((req) => {
      if (req.targetObjectId && !byId.has(req.targetObjectId)) {
        const found = assuranceObjects.find((o) => o.id === req.targetObjectId);
        if (found) {
          byId.set(found.id, found);
        }
      }
    });

    return Array.from(byId.values());
  }, [assuranceSet, assuranceObjects]);

  const resolveRequirementTargetObject = (req: AssuranceRequirement): { name: string; type?: string; identifier?: string } => {
    if (req.targetObjectId) {
      const matched = setObjects.find((o) => o.id === req.targetObjectId) || assuranceObjects.find((o) => o.id === req.targetObjectId);
      if (matched) {
        return { name: matched.name, type: matched.type, identifier: matched.identifier };
      }
    }
    const doc = documents.find((d) => d.id === req.documentId || (req.linkedDocumentId && d.id === req.linkedDocumentId));
    if (doc?.crewAttributes?.crewName) {
      const matched = setObjects.find((o) => o.type === 'person' && o.name === doc.crewAttributes?.crewName);
      if (matched) return { name: matched.name, type: matched.type, identifier: matched.identifier };
      return { name: doc.crewAttributes.crewName, type: 'person' };
    }
    if (req.category === 'Plant' || assuranceSet?.vesselId) {
      const matched = setObjects.find((o) => o.type === 'vessel' || o.id === assuranceSet?.vesselId);
      if (matched) return { name: matched.name, type: matched.type, identifier: matched.identifier };
    }
    if (setObjects.length > 0) {
      return { name: setObjects[0].name, type: setObjects[0].type, identifier: setObjects[0].identifier };
    }
    return { name: assuranceSet?.vesselName || assuranceSet?.title || 'Object' };
  };

  const filteredObjects = useMemo(() => {
    if (!objectSearch.trim()) return setObjects;
    const q = objectSearch.toLowerCase();
    return setObjects.filter((obj) => {
      const matchName = obj.name.toLowerCase().includes(q);
      const matchId = (obj.identifier || obj.id).toLowerCase().includes(q);
      const matchOwner = (obj.ownerOrganization || '').toLowerCase().includes(q);
      const matchType = obj.type.toLowerCase().includes(q);
      return matchName || matchId || matchOwner || matchType;
    });
  }, [setObjects, objectSearch]);

  const objectsPagination = usePagination(filteredObjects, [assuranceSet?.id, objectSearch]);

  const setCrewGroups: AssuranceSetGroupRef[] = useMemo(() => {
    return assuranceSet?.crewGroups || [];
  }, [assuranceSet?.crewGroups]);

  const groupMemberIdSet = useMemo(() => {
    return new Set(setCrewGroups.flatMap((g) => g.memberIds));
  }, [setCrewGroups]);

  const filteredCrewGroups = useMemo(() => {
    if (!objectSearch.trim()) return setCrewGroups;
    const q = objectSearch.toLowerCase();
    return setCrewGroups.filter((g) => {
      if (g.groupName.toLowerCase().includes(q)) return true;
      if (g.specialization && g.specialization.toLowerCase().includes(q)) return true;
      return g.memberIds.some((id) => {
        const c = crew.find((x) => x.id === id);
        return (
          id.toLowerCase().includes(q) ||
          (c && (c.fullName || '').toLowerCase().includes(q)) ||
          (c?.rank && c.rank.toLowerCase().includes(q))
        );
      });
    });
  }, [setCrewGroups, objectSearch, crew]);

  const standaloneObjects = useMemo(() => {
    if (setCrewGroups.length === 0) return filteredObjects;
    return filteredObjects.filter((obj) => !groupMemberIdSet.has(obj.id));
  }, [filteredObjects, setCrewGroups.length, groupMemberIdSet]);

  const standalonePagination = usePagination(standaloneObjects, [assuranceSet?.id, objectSearch]);

  const requirementGroupTasksMap = useMemo(() => {
    const map = new Map<string, AssuranceRequirement[]>();
    if (!assuranceSet?.requirements) return map;
    for (const req of assuranceSet.requirements) {
      const key = getRequirementGroupKey(req);
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(req);
    }
    return map;
  }, [assuranceSet?.requirements]);

  const effectiveSections = useMemo(() => {
    if (!assuranceSet) return [];

    const declaredGeneral = assuranceSet.sections?.find((s) => s.id === 'sec-general' || s.id === 'general');
    const generalSection: TaskSection = {
      id: 'sec-general',
      name: toSentenceCase(declaredGeneral?.name || 'General documents'),
      order: declaredGeneral?.order ?? 0,
    };

    const linkedScopes = new Set<string>();
    if (
      assuranceSet.vesselId ||
      assuranceSet.subtypes?.includes('Vessel') ||
      assuranceSet.assuranceType === 'Vessel' ||
      setObjects.some((o) => o.type === 'vessel') ||
      assuranceSet.requirements?.some((r) => r.subtype === 'Vessel')
    ) {
      linkedScopes.add('Vessel');
    }
    if (
      setObjects.some((o) => o.type === 'person') ||
      assuranceSet.subtypes?.includes('Crew') ||
      assuranceSet.requirements?.some((r) => r.subtype === 'Crew')
    ) {
      linkedScopes.add('Crew');
    }
    if (
      setObjects.some((o) => o.type === 'equipment') ||
      assuranceSet.subtypes?.includes('Equipment') ||
      assuranceSet.requirements?.some((r) => r.subtype === 'Equipment')
    ) {
      linkedScopes.add('Equipment');
    }
    if (
      setObjects.some((o) => o.type === 'activity') ||
      assuranceSet.subtypes?.some((s) => s.toLowerCase() === 'activity') ||
      assuranceSet.requirements?.some((r) => r.subtype?.toLowerCase() === 'activity')
    ) {
      linkedScopes.add('Activity');
    }

    (assuranceSet.sections || []).forEach((sec) => {
      const id = sec.id.toLowerCase();
      if (id === 'sec-vessel' || id === 'vessel') linkedScopes.add('Vessel');
      else if (id === 'sec-crew' || id === 'crew') linkedScopes.add('Crew');
      else if (id === 'sec-equipment' || id === 'equipment') linkedScopes.add('Equipment');
      else if (id === 'sec-activity' || id === 'activity' || id === 'sec-procedure' || id === 'procedure' || id === 'sec-method' || id === 'method') linkedScopes.add('Activity');
    });

    const objectSectionList: TaskSection[] = [];
    const scopeOrder: Record<string, number> = {
      Vessel: 10,
      Crew: 20,
      Equipment: 30,
      Activity: 40,
    };

    ['Vessel', 'Crew', 'Equipment', 'Activity'].forEach((scope) => {
      if (!linkedScopes.has(scope)) return;
      const slug = scope.toLowerCase();
      const secId = `sec-${slug}`;
      const declared = assuranceSet.sections?.find((s) => s.id === secId || s.id === slug || s.name.toLowerCase().includes(slug));
      const defaultName = scope === 'Crew' ? 'Crew directory documents' : scope === 'Activity' ? 'Activities' : `${scope} documents`;
      objectSectionList.push({
        id: secId,
        name: toSentenceCase(declared?.name || defaultName),
        order: declared?.order ?? scopeOrder[scope],
      });
    });

    const standardIds = new Set([
      'sec-general', 'general',
      'sec-vessel', 'vessel',
      'sec-crew', 'crew',
      'sec-equipment', 'equipment',
      'sec-procedure', 'procedure',
      'sec-method', 'method',
      'sec-activity', 'activity'
    ]);

    const customSectionList: TaskSection[] = (assuranceSet.sections || [])
      .filter((s) => !standardIds.has(s.id.toLowerCase()) && Boolean(s.name?.trim()))
      .map((s, idx) => ({
        id: s.id,
        name: toSentenceCase(s.name),
        order: s.order ?? (100 + idx),
      }));

    const all = [
      generalSection,
      ...objectSectionList.sort((a, b) => a.order - b.order),
      ...customSectionList.sort((a, b) => a.order - b.order),
    ];

    const recognizedSectionIds = new Set(all.map((s) => s.id));
    (assuranceSet.requirements || []).forEach((req) => {
      const info = getRequirementSectionInfo(req, assuranceSet.sections);
      if (!recognizedSectionIds.has(info.sectionId)) {
        recognizedSectionIds.add(info.sectionId);
        all.push({
          id: info.sectionId,
          name: toSentenceCase(info.sectionTitle),
          order: info.sectionOrder,
        });
      }
    });

    return all.filter((s) => Boolean(s.id?.trim()) && Boolean(s.name?.trim()));
  }, [assuranceSet, setObjects]);

  const {
    orderedRequirements,
    peopleRequirements,
    plantRequirements,
    processRequirements,
    otherRequirements,
  } = useMemo(() => {
    if (!assuranceSet?.requirements) {
      return {
        orderedRequirements: [],
        peopleRequirements: [],
        plantRequirements: [],
        processRequirements: [],
        otherRequirements: [],
      };
    }

    const sortFn = (a: AssuranceRequirement, b: AssuranceRequirement) => {
      let comp = 0;
      if (reqSortField === 'title') {
        comp = a.title.localeCompare(b.title);
      } else if (reqSortField === 'targetObject') {
        const objA = resolveRequirementTargetObject(a).name;
        const objB = resolveRequirementTargetObject(b).name;
        comp = objA.localeCompare(objB);
      } else if (reqSortField === 'targetDate') {
        const dateA = a.targetDate || assuranceSet.targetDate || assuranceSet.complianceDeadline || '';
        const dateB = b.targetDate || assuranceSet.targetDate || assuranceSet.complianceDeadline || '';
        comp = dateA.localeCompare(dateB);
      } else if (reqSortField === 'version') {
        const verA = a.documentVersion || '';
        const verB = b.documentVersion || '';
        comp = verA.localeCompare(verB);
      } else if (reqSortField === 'status') {
        const statusA = a.verifierStatus || (a.isFulfilled ? 'Verified' : 'Awaiting Upload');
        const statusB = b.verifierStatus || (b.isFulfilled ? 'Verified' : 'Awaiting Upload');
        comp = statusA.localeCompare(statusB);
      }
      return reqSortDirection === 'asc' ? comp : -comp;
    };

    const sectionBuckets = new Map<
      string,
      {
        info: RequirementSectionInfo;
        requirements: AssuranceRequirement[];
      }
    >();

    for (const sec of effectiveSections) {
      sectionBuckets.set(sec.id, {
        info: {
          sectionId: sec.id,
          sectionTitle: sec.name,
          sectionOrder: sec.order,
          isGeneral: sec.id === 'sec-general',
          isCustom: !['sec-general', 'sec-vessel', 'sec-crew', 'sec-equipment', 'sec-activity', 'sec-procedure', 'sec-method'].includes(sec.id),
        },
        requirements: [],
      });
    }

    for (const req of assuranceSet.requirements) {
      const info = getRequirementSectionInfo(req, assuranceSet.sections);
      if (!sectionBuckets.has(info.sectionId)) {
        sectionBuckets.set(info.sectionId, {
          info,
          requirements: [],
        });
      }
      sectionBuckets.get(info.sectionId)!.requirements.push(req);
    }

    const sortedSections = Array.from(sectionBuckets.values()).sort((a, b) => {
      if (a.info.isGeneral !== b.info.isGeneral) {
        return a.info.isGeneral ? -1 : 1;
      }
      return a.info.sectionOrder - b.info.sectionOrder;
    });

    const ordered: AssuranceRequirement[] = [];
    const seenGroupKeys = new Set<string>();

    for (const sec of sortedSections) {
      if (sec.info.isGeneral || sec.info.isCustom || sec.info.scope === 'activity' || (sec.info.scope as any) === 'Activity') {
        const sortedSecReqs = [...sec.requirements].sort(sortFn);
        for (const req of sortedSecReqs) {
          const groupKey = getRequirementGroupKey(req);
          if (seenGroupKeys.has(groupKey)) continue;
          seenGroupKeys.add(groupKey);
          ordered.push(req);
        }
      } else {
        const subtypeScope = (sec.info.scope as AssuranceSubtype) || 'Vessel';
        const predefinedCategories = (SUBTYPE_CATEGORIES[subtypeScope as AssuranceSubtype] || []) as string[];

        const catBuckets = new Map<string, AssuranceRequirement[]>();
        for (const req of sec.requirements) {
          const cat = req.category || 'Standard Documents';
          if (!catBuckets.has(cat)) {
            catBuckets.set(cat, []);
          }
          catBuckets.get(cat)!.push(req);
        }

        const orderedCatNames = Array.from(catBuckets.keys()).sort((catA, catB) => {
          const idxA = predefinedCategories.indexOf(catA as any);
          const idxB = predefinedCategories.indexOf(catB as any);
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          if (idxA !== -1) return -1;
          if (idxB !== -1) return 1;
          return catA.localeCompare(catB);
        });

        for (const catName of orderedCatNames) {
          const reqs = catBuckets.get(catName) || [];
          reqs.sort(sortFn);
          for (const req of reqs) {
            const groupKey = getRequirementGroupKey(req);
            if (seenGroupKeys.has(groupKey)) continue;
            seenGroupKeys.add(groupKey);
            ordered.push(req);
          }
        }
      }
    }

    return {
      orderedRequirements: ordered,
      peopleRequirements: [],
      plantRequirements: [],
      processRequirements: [],
      otherRequirements: [],
    };
  }, [assuranceSet, reqSortField, reqSortDirection, documents, setObjects, assuranceObjects, effectiveSections]);

  const isCAdminPersona = activePersona === 'C Admin';
  const isSubmitter = activePersona === 'Submitter';
  const isVerifier = activePersona === 'Verifier';
  const isApproverOrInspector = activePersona === 'Approver' || activePersona === 'Inspector';
  const isAdminViewer = activePersona === 'Administrator' || activePersona === 'C Admin';
  const reqTableColSpan = isSubmitter ? 3 : 4;

  const organizations = assuranceSet ? setOrganizations(assuranceSet) : [];
  /* each list holds the people of the organization that fills the role */
  const roleOrganization = (role: StakeholderRole) =>
    assuranceSet ? getStakeholderRoleOrganization(assuranceSet, role) : undefined;
  const verifierCandidates = useMemo(
    () => getOrganizationRoleCandidates(users, roleOrganization('Verifier'), 'Verifier'),
    [users, assuranceSet],
  );
  const inspectorCandidates = useMemo(
    () => getOrganizationRoleCandidates(users, roleOrganization('Inspector'), 'Inspector'),
    [users, assuranceSet],
  );
  const approverCandidates = useMemo(
    () => getOrganizationRoleCandidates(users, roleOrganization('Approver'), 'Approver'),
    [users, assuranceSet],
  );

  const sectionSummaries = useMemo(
    () =>
      summarizeTaskSections({
        ...assuranceSet,
        sections: (assuranceSet.sections || []).map((sec) => ({
          ...sec,
          name: toSentenceCase(sec.name),
        })),
      }),
    [assuranceSet]
  );
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

  /* one page sequence for the whole table: People, Plant, Process, then other documents */
  const requirementsPagination = usePagination(
    orderedRequirements,
    [assuranceSet?.id, reqSortField, reqSortDirection],
  );

  useEffect(() => {
    if (!focusedRequirementId) return;
    const items = orderedRequirements;
    const index = items.findIndex((requirement) => {
      if (requirement.id === focusedRequirementId) return true;
      const key = getRequirementGroupKey(requirement);
      const groupTasks = requirementGroupTasksMap.get(key);
      return groupTasks?.some((t) => t.id === focusedRequirementId);
    });
    if (index < 0) {
      setFocusedRequirementId(undefined);
      return;
    }
    const page = Math.floor(index / requirementsPagination.controls.pageSize) + 1;
    if (requirementsPagination.controls.page !== page) {
      requirementsPagination.controls.onPageChange(page);
      return;
    }
    const targetEl = document.querySelector(`[data-requirement-id="${focusedRequirementId}"]`);
    if (targetEl && typeof targetEl.scrollIntoView === 'function') {
      targetEl.scrollIntoView({ block: 'center' });
    }
    setFocusedRequirementId(undefined);
  }, [focusedRequirementId, orderedRequirements, requirementsPagination.controls.page, requirementsPagination.controls.pageSize, setFocusedRequirementId]);

  const activeUser = useSessionUser();
  const sessionUser = activeUser ?? undefined;
  const currentUserId = sessionUser?.id || activeSessionUserId;

  const viewerPartyOrg = (
    activeDemoOrganization?.trim() ||
    sessionUser?.organization?.trim() ||
    (activePersona === 'Submitter' || activePersona === 'Administrator' ? serviceProviderOrg || '' : '')
  ).trim();

  const isClientViewer = useMemo(() => {
    if (activeDemoOrganization?.trim()) {
      return Boolean(clientOwnerOrg && orgFieldMatches(activeDemoOrganization, clientOwnerOrg));
    }
    if (sessionUser?.organization?.trim()) {
      if (clientOwnerOrg && orgFieldMatches(sessionUser.organization, clientOwnerOrg)) {
        return true;
      }
      return false;
    }
    if (activePersona === 'C Admin') return true;
    return isClientUser(sessionUser, assuranceSet, activePersona);
  }, [activeDemoOrganization, sessionUser, clientOwnerOrg, activePersona, assuranceSet]);

  const outdatedVersionCount = useMemo(
    () => countOutdatedVersionRequirements(assuranceSet, documents),
    [assuranceSet, documents],
  );

  const visibleEvents = useMemo(
    () => filterAuditTrailForPersona(auditEvents, activePersona, assuranceSets, vessels, currentUserId),
    [auditEvents, activePersona, assuranceSets, vessels, currentUserId],
  );

  const setAuditEvents = useMemo(() => {
    const rawSetEvents = visibleEvents.filter((ev) => {
      const target = ev.target;
      if (target && target.setId === assuranceSet.id) {
        return true;
      }
      if (!target && ev.targetAsset && ev.targetAsset.includes(assuranceSet.id)) {
        return true;
      }
      return false;
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
      };
    });

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

    if (isClientViewer || activePersona === 'Approver') {
      return deduplicated;
    }

    return deduplicated.filter((ev) => {
      if (ev.documentStatusDelta?.documentId) {
        const reqWithDoc = assuranceSet.requirements?.find(
          (r) =>
            r.documentId === ev.documentStatusDelta!.documentId ||
            r.linkedDocumentId === ev.documentStatusDelta!.documentId,
        );
        if (reqWithDoc) {
          return isRequirementDocumentVisible(
            reqWithDoc,
            isClientViewer,
            viewerPartyOrg,
            assuranceSet,
            users,
            setObjects,
          );
        }
        if (ev.organization && viewerPartyOrg && !orgFieldMatches(viewerPartyOrg, ev.organization)) {
          return false;
        }
      }

      const auditTarget = ev.target;
      if (auditTarget) {
        if (auditTarget.kind === 'task' && auditTarget.taskId) {
          const req = assuranceSet.requirements?.find((r) => r.id === auditTarget.taskId);
          if (req) {
            const isDocRelated =
              Boolean(ev.documentStatusDelta) ||
              /document|certificate|upload|dossier/i.test(ev.action) ||
              /document|version/i.test(ev.fieldDelta?.fieldName || '');
            if (isDocRelated) {
              return isRequirementDocumentVisible(
                req,
                isClientViewer,
                viewerPartyOrg,
                assuranceSet,
                users,
                setObjects,
              );
            }
          }
        } else if (auditTarget.kind === 'requirement' && auditTarget.requirementId) {
          const req = assuranceSet.requirements?.find((r) => r.id === auditTarget.requirementId);
          if (req) {
            const isDocRelated =
              Boolean(ev.documentStatusDelta) ||
              /document|certificate|upload|dossier/i.test(ev.action) ||
              /document|version/i.test(ev.fieldDelta?.fieldName || '');
            if (isDocRelated) {
              return isRequirementDocumentVisible(
                req,
                isClientViewer,
                viewerPartyOrg,
                assuranceSet,
                users,
                setObjects,
              );
            }
          }
        } else if (auditTarget.kind === 'document' && auditTarget.documentId) {
          const reqWithDoc = assuranceSet.requirements?.find(
            (r) =>
              r.documentId === auditTarget.documentId ||
              r.linkedDocumentId === auditTarget.documentId,
          );
          if (reqWithDoc) {
            return isRequirementDocumentVisible(
              reqWithDoc,
              isClientViewer,
              viewerPartyOrg,
              assuranceSet,
              users,
              setObjects,
            );
          }
        }
      }

      if (/document|certificate|dossier/i.test(ev.action) && ev.organization && viewerPartyOrg) {
        if (!orgFieldMatches(viewerPartyOrg, ev.organization) && !orgFieldMatches(clientOwnerOrg, ev.organization)) {
          return false;
        }
      }

      return true;
    });
  }, [visibleEvents, assuranceSet, activePersona, assuranceSets, vessels, currentUserId, isClientViewer, viewerPartyOrg, users, setObjects, clientOwnerOrg]);

  const [auditSearchTerm, setAuditSearchTerm] = useState('');
  const [auditCategoryFilter, setAuditCategoryFilter] = useState<AuditMovementCategory>('all');

  const filteredAuditEvents = useMemo(() => {
    return setAuditEvents.filter((ev) => {
      const matchesSearch = auditEventMatchesSearch(ev, auditSearchTerm);
      const matchesCat = matchesAuditCategory(ev, auditCategoryFilter);
      return matchesSearch && matchesCat;
    });
  }, [setAuditEvents, auditSearchTerm, auditCategoryFilter]);

  const auditPagination = usePagination(filteredAuditEvents, [
    assuranceSet?.id,
    auditSearchTerm,
    auditCategoryFilter,
  ]);

  const handleAuditExportCsv = () => {
    const exportData = filteredAuditEvents.map((ev) => ({
      TimestampUtc: ev.timestampUtc,
      Action: ev.action,
      Target: displayAuditTarget(ev),
      Change: displayAuditChange(ev),
      TargetAsset: ev.targetAsset,
      UserRole: ev.userRole,
      Organization: ev.organization,
      Notes: ev.justificationNotes || '',
    }));
    exportToCsv(`${assuranceSet.id}_Audit_Trail`, exportData);
    logExport({
      screen: 'Assurance set detail - Audit',
      format: 'CSV',
      setId: assuranceSet.id,
      detail: `${filteredAuditEvents.length} events`,
    });
  };

  const handleAuditExportPdf = () => {
    const headers = ['Timestamp (UTC)', 'Action', 'Target', 'Role', 'Notes'];
    const rows = filteredAuditEvents.map((ev) => [
      ev.timestampUtc,
      ev.action,
      displayAuditTarget(ev),
      `${getRoleDisplayLabel(ev.userRole)} (${ev.organization})`,
      ev.justificationNotes || '-',
    ]);
    exportToPdf(`${assuranceSet.id} Audit Trail`, headers, rows);
    logExport({
      screen: 'Assurance set detail - Audit',
      format: 'PDF',
      setId: assuranceSet.id,
      detail: `${filteredAuditEvents.length} events`,
    });
  };

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

  const viewerParty: 'requesting' | 'responding' | 'other' = useMemo(() => {
    const respondingPartyOrg = assuranceSet?.respondingParty || assuranceSet?.serviceProviderOrg;
    if (isSubmitter || (respondingPartyOrg && viewerPartyOrg && orgFieldMatches(viewerPartyOrg, respondingPartyOrg))) {
      return 'responding';
    }
    if (isClientViewer || isVerifier || isApproverViewer || isCAdminPersona || activePersona === 'Administrator') {
      return 'requesting';
    }
    return 'other';
  }, [isSubmitter, isClientViewer, isVerifier, isApproverViewer, isCAdminPersona, activePersona, assuranceSet?.respondingParty, assuranceSet?.serviceProviderOrg, viewerPartyOrg]);

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
  const taskSectionsSet = useMemo(() => {
    const baseSet = isClientViewer
      ? assuranceSet
      : {
        ...assuranceSet,
        requirements:
          assuranceSet.requirements?.map((req) => {
            const canView = isRequirementDocumentVisible(req, isClientViewer, viewerPartyOrg, assuranceSet, users, setObjects);
            if (canView) return req;
            const { documentId, linkedDocumentId, ...rest } = req;
            return rest as AssuranceRequirement;
          }) || [],
      };
    return {
      ...baseSet,
      sections: (baseSet.sections || []).map((sec) => ({
        ...sec,
        name: toSentenceCase(sec.name),
      })),
    };
  }, [assuranceSet, isClientViewer, viewerPartyOrg, users, setObjects]);

  const shortCertificates = listCertificatesShortOfContract(
    taskSectionsSet,
    documents,
    assuranceSet.charterWindowEnd,
  );
  const complianceOverdue = isComplianceDeadlineOverdue(assuranceSet);
  const renderContractShortWarning = (doc?: MasterDocument, canViewDoc: boolean = true) => {
    if (!canViewDoc || !doc || !documentExpiresBeforeContractEnd(doc, assuranceSet.charterWindowEnd)) return null;
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
  const isRestrictedProjectOwner = isProjectOwnerWithoutSubSetGroup(
    assuranceSet,
    linkedProject,
    viewerPartyOrg,
    sessionUser,
  );
  const canAddToProject = !isRestrictedProjectOwner && roleActions.canManage && isAssuranceSetOrphaned(assuranceSet, projects);
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
  const canEditCharterWindow = !isRestrictedProjectOwner && roleActions.canManage && roleActions.canChangeDates && !isCharterWindowLocked;
  const isSetOpen = !isClosedAssuranceSet(assuranceSet) && assuranceSet.stage !== 'Cancelled';
  const canEditTasks = !isRestrictedProjectOwner && (isClientUser(sessionUser, assuranceSet, activePersona) || activePersona === 'Administrator' || roleActions.canManage) && isSetOpen;
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
      sectionId: '',
      predecessorId: '',
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
      sectionId: newTaskDraft.sectionId || undefined,
      predecessorId: newTaskDraft.predecessorId || undefined,
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
      sectionId: req.sectionId || '',
      predecessorId: req.predecessorId || '',
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
      sectionId: editTaskDraft.sectionId || undefined,
      predecessorId: editTaskDraft.predecessorId || undefined,
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
    setPlannedCharterDateDraft(assuranceSet.plannedCharterDate || '');
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
      plannedCharterDate: plannedCharterDateDraft || undefined,
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
    if (!taskDateReasonDraft.trim()) {
      setTaskDateError('A reason for changing the target date is required.');
      return;
    }
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
      taskDateReasonDraft.trim(),
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
    const days = parseInt(grantDurationDays, 10) || 14;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    grantDatePermission(assuranceSet.id, {
      userId: grantee.id,
      userName: grantee.name,
      grantedBy: sessionUser?.name || 'Client Admin',
      expiresAt,
      reason: grantReasonDraft.trim() || undefined,
    });
    setSelectedGranteeId('');
    setGrantReasonDraft('');
    setProjectToast(`Date change permission granted to ${grantee.name} for ${days} days.`);
    setTimeout(() => setProjectToast(null), 3500);
  };

  const handleSaveRevisedDeadline = () => {
    if (!revisedDateDraft) {
      setRevisedDateError('Revised completion date is required.');
      return;
    }
    if (!revisedDateReason.trim()) {
      setRevisedDateError('Reason for revision is required.');
      return;
    }
    const result = reviseAssuranceSetDeadline(
      assuranceSet.id,
      revisedDateDraft,
      sessionUser?.name || 'Set Manager',
      revisedDateReason.trim(),
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
    setPartialCloseError(null);
    const result = partiallyCloseAssuranceSet(
      assuranceSet.id,
      sessionUser?.name || 'Set Manager',
      partialCloseNotes.trim() || undefined,
    );
    if (result.success) {
      setIsPartialCloseModalOpen(false);
      setPartialCloseError(null);
      setProjectToast('Assurance set partially closed. Exempted tasks remain open.');
      setTimeout(() => setProjectToast(null), 3500);
    } else {
      setPartialCloseError(result.message || 'Failed to partially close assurance set.');
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
    setIsAttachPreviewOpen(false);
    setTargetProjectId('');
    setAddToProjectError(null);
  };

  const handleAddToProjectContinue = () => {
    if (!targetProjectId) return;
    setAddToProjectError(null);
    setIsAddToProjectOpen(false);
    setIsAttachPreviewOpen(true);
  };

  const attachTargetProject = projects.find((p) => p.id === targetProjectId) ?? null;

  const handleAttachPreviewConfirm = (
    _roleInProject: string,
    charterWindowStart: string,
    charterWindowEnd: string,
  ) => {
    if (!attachTargetProject) return;
    updateAssuranceSet({
      ...assuranceSet,
      charterWindowStart,
      charterWindowEnd,
      projectId: attachTargetProject.id,
      projectName: attachTargetProject.name,
      charterer: attachTargetProject.clientOperator || attachTargetProject.requestingOrganization,
    });
    const result = attachAssuranceSetToProject(assuranceSet.id, attachTargetProject.id);
    if (!result.success) {
      setAddToProjectError(result.message || 'The assurance set could not be added to the project.');
      setIsAttachPreviewOpen(false);
      setIsAddToProjectOpen(true);
      return;
    }
    closeAddToProject();
    setProjectToast(
      `Added to project ${attachTargetProject.name} with Contract Period (${charterWindowStart} to ${charterWindowEnd}).`,
    );
    setTimeout(() => setProjectToast(null), 3500);
  };
  const canUpload = roleActions.canUpload;
  const stakeholderLockReason = getAssuranceSetStakeholderLockReason(assuranceSet);
  const canEditStakeholders =
    roleActions.canManage &&
    canEditAssuranceSetStakeholders(assuranceSet, activePersona, activeDemoOrganization, sessionUser);
  const isLinkedSubSet = (req: AssuranceRequirement) =>
    req.fulfillmentType === 'assurance_set' || Boolean(req.linkedAssuranceSetId);

  /* the client chooses organizations; only each organization's own admin chooses its person */
  const canAssignRole = (role: StakeholderRole) =>
    canEditStakeholders && canAssignStakeholderRole(assuranceSet, role, activeDemoOrganization);
  const stakeholderLabel = (role: StakeholderRole, assigned: string) => {
    if (assigned !== PENDING_ASSIGNMENT) return assigned;
    const organization = roleOrganization(role);
    return organization ? `Pending, ${organization}` : PENDING_ASSIGNMENT;
  };
  const assignStakeholder = (
    role: StakeholderRole,
    assigneeName: string,
    submitterOrganization?: string,
  ) => {
    const result = updateAssuranceStakeholder(assuranceSet.id, role, assigneeName, submitterOrganization);
    if (!result.success) {
      setStakeholderError(result.message || 'The stakeholder could not be assigned.');
      return;
    }
    setStakeholderError(null);
    setEditingRole(null);
    setEditingSubmitterOrg(null);
  };

  const verifiedCount = assuranceSet.requirements.filter((r) => r.verifierStatus === 'Verified').length;
  /* how many requirements this role still has to work on; shown on the Tasks tab badge and above the requirements list */
  const requirementCounts = (() => {
    const reqs = assuranceSet.requirements;
    const total = reqs.length;
    const hasDoc = (r: AssuranceRequirement) => Boolean(r.documentId || r.linkedDocumentId);
    const returned = reqs.filter((r) => r.verifierStatus === 'Correction Requested' || r.verifierStatus === 'Rejected').length;
    const toUpload = reqs.filter((r) => !hasDoc(r) || r.verifierStatus === 'Correction Requested' || r.verifierStatus === 'Rejected').length;
    const toVerify = reqs.filter((r) => hasDoc(r) && r.verifierStatus === 'Pending').length;
    const verified = reqs.filter((r) => r.verifierStatus === 'Verified').length;
    const awaitingUpload = reqs.filter((r) => !hasDoc(r)).length;
    const open = total - verified;
    const persona = activePersona;
    const mine =
      persona === 'Submitter' ? toUpload
        : persona === 'Verifier' ? toVerify
          : persona === 'Inspector' || persona === 'Approver' ? open
            : 0;
    return { total, returned, toUpload, toVerify, verified, awaitingUpload, open, mine };
  })();
  const totalCount = assuranceSet.requirements.length;

  const renderRequirementStatus = (req: AssuranceRequirement, canViewDoc: boolean = true) => {
    if (!canViewDoc || (!req.documentId && !req.linkedDocumentId)) {
      return <StatusBadge value="Awaiting Upload" tone="neutral" />;
    }
    const isSetApproved = assuranceSet.stage === 'Approved' || assuranceSet.approverDecision === 'Approved';

    if (req.verifierStatus === 'Verified') {
      if (isSetApproved) {
        return <StatusBadge value="Approved" />;
      }
      return <StatusBadge value="Verified" />;
    }
    if (req.verifierStatus === 'Correction Requested') {
      return <StatusBadge value="Returned for Correction" />;
    }
    if (req.verifierStatus === 'Rejected') {
      return <StatusBadge value="Rejected" />;
    }
    const isInspectionDoc =
      (req.category as string).toLowerCase().includes('inspection') ||
      (req.category as string).toLowerCase().includes('audit') ||
      req.title.toLowerCase().includes('inspection') ||
      req.title.toLowerCase().includes('audit');

    if (isInspectionDoc) {
      return <StatusBadge value="To Inspect" tone="warning" />;
    }

    return <StatusBadge value="Submitted" tone="neutral" />;
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
  const renderVersionBadge = (req: AssuranceRequirement, docView?: RequirementDocumentView, canViewDoc: boolean = true) => {
    if (!canViewDoc) return null;
    const isOutdated = isRequirementOnOlderVersion(req, assuranceSet, documents);
    const label = docView?.doc.currentVersion || req.documentVersion;
    if (!label && !isOutdated) return null;
    const lockedOn = docView?.snapshot?.verifiedAt || assuranceSet.lockedAt;
    return (
      <>
        {label && (
          <span
            className="badge bg-light text-secondary border ms-2 d-inline-flex align-items-center gap-1"
            style={{ fontSize: '0.7rem' }}
            title={docView?.isLocked ? `Approved version${lockedOn ? `, locked ${formatMaritimeDate(lockedOn)}` : ''}` : undefined}
          >
            {docView?.isLocked && <Lock size={10} aria-label="Locked version" />}
            {label}
          </span>
        )}
        {docView?.newerVersionLabel && (
          <span className="text-secondary ms-1.5 fw-normal" style={{ fontSize: '0.7rem' }}>
            {docView.newerVersionLabel} available
          </span>
        )}
        {isOutdated && (
          <span
            className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle ms-2"
            style={{ fontSize: '0.7rem' }}
            data-testid={`badge-newer-version-${req.id}`}
          >
            Newer version available
          </span>
        )}
      </>
    );
  };

  /* at most one badge on the row, the first that applies: Exempted, Shared (n), Lapsed */
  const renderRowStatusBadge = (
    req: AssuranceRequirement,
    docView?: RequirementDocumentView,
    canViewDoc: boolean = true,
    isShared: boolean = false,
    sharedCount: number = 0,
  ) => {
    if (req.exemption) {
      return (
        <span
          className="ms-1.5"
          data-testid={`badge-exempted-${req.id}`}
          title={`Exempted by ${req.exemption.grantedBy}: ${req.exemption.reason} (New date: ${formatMaritimeDate(req.exemption.newDate)})`}
        >
          <StatusBadge value={`Exempted (${formatMaritimeDate(req.exemption.newDate)})`} tone="warning" />
        </span>
      );
    }
    if (isShared && sharedCount > 1) {
      return (
        <span className="ms-1.5" data-testid="badge-shared-requirement" title="Requirement shared across multiple parties">
          <StatusBadge value={`Shared (${sharedCount} parties)`} tone="neutral" />
        </span>
      );
    }
    if (docView && canViewDoc) {
      const validity = getValidityInContractPeriod(docView.doc.expiryDate, assuranceSet);
      if (validity.state === 'lapsed') {
        return (
          <span className="ms-1.5" data-testid={`badge-lapsed-${req.id}`}>
            <StatusBadge value="Lapsed" tone="danger" />
          </span>
        );
      }
    }
    return null;
  };

  /* validity badge in contract period for Approver and Inspector rows */
  const renderValidityBadge = (req: AssuranceRequirement, docView?: RequirementDocumentView, canViewDoc: boolean = true) => {
    if (!docView || !canViewDoc) return <span className="text-muted small">—</span>;
    const validity = getValidityInContractPeriod(docView.doc.expiryDate, assuranceSet);
    if (validity.state === 'unknown') return <span className="text-muted small">—</span>;
    const tone =
      validity.state === 'valid_through_period'
        ? 'success'
        : validity.state === 'lapsed'
          ? 'danger'
          : 'warning';
    return (
      <span data-testid={`badge-validity-${req.id}`}>
        <StatusBadge value={validity.label} tone={tone} />
      </span>
    );
  };

  const openRequirementUpload = (req: AssuranceRequirement, existingDoc?: MasterDocument) => {
    const canViewDoc = isRequirementDocumentVisible(req, isClientViewer, viewerPartyOrg, assuranceSet, users, setObjects);
    if (!isClientViewer && !canViewDoc) return;
    setUploadTargetRequirement(req);
    setReplaceExistingDoc(existingDoc || null);
    setIsUploadModalOpen(true);
  };

  /* version a requirement is shown with: pinned on an approved set, live otherwise */
  const getExportVersionLabel = (req: AssuranceRequirement, linkedDoc?: MasterDocument): string =>
    (linkedDoc ? getRequirementDocumentView(assuranceSet, req, linkedDoc).doc.currentVersion : req.documentVersion) || '';

  const handleExportCsv = () => {
    const exportData = assuranceSet.requirements.map((req) => {
      const canViewDoc = isRequirementDocumentVisible(req, isClientViewer, viewerPartyOrg, assuranceSet, users, setObjects);
      const linkedDoc = documents.find((d) => d.id === req.documentId || (req.linkedDocumentId && d.id === req.linkedDocumentId));
      const effectiveLinkedDoc = canViewDoc ? linkedDoc : undefined;
      const hasAttachedDoc = Boolean(effectiveLinkedDoc || (canViewDoc && (req.documentId || req.linkedDocumentId)));
      const effectiveOcr = hasAttachedDoc ? (req.ocrConfidence || linkedDoc?.ocrConfidence || 0) : 0;
      const party = getRequirementPartyLabel(req, assuranceSet, users, setObjects);
      return {
        Requirement: req.title,
        'Responsible Party': party,
        Version: canViewDoc ? getExportVersionLabel(req, linkedDoc) : '',
        OcrConfidence: canViewDoc ? `${effectiveOcr}%` : '0%',
        Status: canViewDoc
          ? getStatusDisplayLabel(req.verifierStatus || (req.isFulfilled ? 'Approved' : 'Pending'))
          : 'Pending',
        Notes: canViewDoc ? (req.notes || '') : '',
      };
    });
    exportToCsv(`${assuranceSet.id}_Requirements`, exportData);
    setIsExportOpen(false);
  };

  const handleExportPdf = () => {
    const headers = ['Requirement', 'Version', 'OCR Confidence', 'Status', 'Notes', 'Responsible Party'];
    const rows = assuranceSet.requirements.map((req) => {
      const canViewDoc = isRequirementDocumentVisible(req, isClientViewer, viewerPartyOrg, assuranceSet, users, setObjects);
      const linkedDoc = documents.find((d) => d.id === req.documentId || (req.linkedDocumentId && d.id === req.linkedDocumentId));
      const effectiveLinkedDoc = canViewDoc ? linkedDoc : undefined;
      const hasAttachedDoc = Boolean(effectiveLinkedDoc || (canViewDoc && (req.documentId || req.linkedDocumentId)));
      const effectiveOcr = hasAttachedDoc ? (req.ocrConfidence || linkedDoc?.ocrConfidence || 0) : 0;
      const party = getRequirementPartyLabel(req, assuranceSet, users, setObjects);
      return [
        req.title,
        canViewDoc ? (getExportVersionLabel(req, linkedDoc) || '-') : '-',
        canViewDoc ? `${effectiveOcr}%` : '0%',
        canViewDoc
          ? getStatusDisplayLabel(req.verifierStatus || (req.isFulfilled ? 'Approved' : 'Pending'))
          : 'Pending',
        canViewDoc ? (req.notes || '-') : '-',
        party || '-',
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
    if (isAssuranceSetAtRisk(assuranceSet)) return 'At risk';
    return assuranceSet.stage;
  }, [assuranceSet, complianceOverdue]);

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
          onClick={() => setCurrentHashView('inspector', assuranceSet.id)}
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
        backLink={
          showBackToTasks && activeTab === 'requirements'
            ? {
                label: 'tasks',
                onClick: () => {
                  setShowBackToTasks(false);
                  handleTabChange('tasks');
                },
              }
            : undefined
        }
        metaItems={[
          clientOwnerOrg,
          assuranceSet.complianceDeadline || assuranceSet.targetDate
            ? formatMaritimeDate(assuranceSet.complianceDeadline || assuranceSet.targetDate || '')
            : '',
          assuranceSet.requestingParty ? `Requesting party: ${assuranceSet.requestingParty}` : '',
          assuranceSet.respondingParty ? `Responding party: ${assuranceSet.respondingParty}` : '',
          outdatedVersionCount > 0
            ? `${outdatedVersionCount} newer version${outdatedVersionCount > 1 ? 's' : ''} available`
            : '',
        ].filter(Boolean)}
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
      {/* Assurance Set Detail Tabs — ?tab= URL sync stays in handleTabChange */}
      <Tabs
        variant="section"
        className="mb-3"
        aria-label="Assurance set detail tabs"
        active={activeTab}
        onChange={(key) => handleTabChange(key as AssuranceDetailTab)}
        tabs={[
          { key: 'details', label: 'Details' },
          { key: 'objects', label: 'Objects' },
          { key: 'requirements', label: 'Requirements' },
          {
            key: 'tasks',
            label: 'Tasks',
            count: requirementCounts.mine > 0 ? requirementCounts.mine : undefined,
            tone: 'warn',
          },
          { key: 'audit', label: 'Audit Trail' },
        ]}
      />

      {/* Tab: Details */}
      {activeTab === 'details' && (
        <div className="d-flex flex-column gap-4">
          {/* Top Section: Stage & Readiness, shown above the assurance set details */}
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
                    <div className="map-detail-row border-bottom pb-2" data-testid="detail-requesting-party">
                      <div className="text-secondary" style={{ fontSize: '0.725rem' }}>Requesting party:</div>
                      <div className="fw-bold text-dark">{assuranceSet.requestingParty || clientOwnerOrg}</div>
                    </div>
                    {(assuranceSet.respondingParty || assuranceSet.serviceProviderOrg) && (
                      <div className="map-detail-row border-bottom pb-2" data-testid="detail-responding-party">
                        <div className="text-secondary" style={{ fontSize: '0.725rem' }}>Responding party:</div>
                        <div className="fw-bold text-dark">{assuranceSet.respondingParty || assuranceSet.serviceProviderOrg}</div>
                      </div>
                    )}
                    {assuranceSetTags.length > 0 && (
                      <div className="map-detail-row border-bottom pb-2">
                        <div className="text-secondary" style={{ fontSize: '0.725rem' }}>Tags:</div>
                        <div className="d-flex flex-wrap gap-1 mt-1">
                          {assuranceSetTags.map((tag) => (
                            <span key={tag} className="badge bg-light text-dark border">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {organizations.length > 0 && (
                      <div className="map-detail-row border-bottom pb-2">
                        <div className="text-secondary" style={{ fontSize: '0.725rem' }}>Organizations</div>
                        <ul className="list-unstyled mb-0 mt-1" data-testid="assurance-set-organizations">
                          {organizations.map((organization) => {
                            const partyRow =
                              assuranceSet.parties?.find((p) => p.organization === organization) ||
                              organizationParties.find((p) => p.organization === organization);
                            const partyRole =
                              assuranceSet.partyRoles?.[organization] ||
                              (assuranceSet.requestingParty === organization ? 'Requesting party' : undefined) ||
                              (assuranceSet.respondingParty === organization ? 'Responding party' : undefined) ||
                              partyRow?.partyRole;
                            return (
                              <li key={organization} className="fw-bold text-dark py-1">
                                <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap">
                                  <span>{organization}</span>
                                  {partyRole && (
                                    <span className="badge bg-light text-secondary border" style={{ fontSize: '0.7rem' }}>
                                      {partyRole}
                                    </span>
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
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
                            <label className="form-label text-secondary small mb-1" htmlFor="planned-charter-date">
                              Planned Charter Date <span className="text-secondary fw-normal fs-7">(Optional)</span>
                            </label>
                            <input
                              id="planned-charter-date"
                              type="date"
                              className="form-control form-control-sm bg-white text-dark"
                              value={plannedCharterDateDraft}
                              onChange={(e) => setPlannedCharterDateDraft(e.target.value)}
                            />
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
                              Reason for Date Change <span className="text-danger">*</span>
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
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              disabled={!deadlineReasonDraft.trim()}
                              title={!deadlineReasonDraft.trim() ? 'A reason for changing the date is required.' : undefined}
                              onClick={saveCharterWindow}
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="fw-bold text-dark">{formatMaritimeDate(assuranceSet.charterWindowStart)} - {formatMaritimeDate(assuranceSet.charterWindowEnd)}</div>
                          {assuranceSet.plannedCharterDate && (
                            <div className="text-secondary mt-1" style={{ fontSize: '0.75rem' }} data-testid="detail-planned-charter-date">
                              <span>Planned charter: {formatMaritimeDate(assuranceSet.plannedCharterDate)}</span>
                            </div>
                          )}
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
                          {roleActions.canManage && assuranceSet.stage !== 'Cancelled' && assuranceSet.stage !== 'Approved' && assuranceSet.stage !== 'Certified' && (
                            <div className="d-flex flex-wrap gap-2 mt-2 pt-2 border-top">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger py-0 px-2"
                                style={{ fontSize: '0.72rem' }}
                                onClick={() => {
                                  setPartialCloseNotes('');
                                  setPartialCloseError(null);
                                  setIsPartialCloseModalOpen(true);
                                }}
                              >
                                Partial Closure
                              </button>
                              {complianceOverdue && (
                                <>
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
                                    className="btn btn-sm btn-danger text-white py-0 px-2"
                                    style={{ fontSize: '0.72rem' }}
                                    onClick={() => {
                                      setCancellationReasonDraft('');
                                      setIsCancelModalOpen(true);
                                    }}
                                  >
                                    Cancel Set
                                  </button>
                                </>
                              )}
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

                    {/* Submitters: one for each provider on the set */}
                    {(setSubmitters(assuranceSet).length > 0
                      ? setSubmitters(assuranceSet)
                      : [{ organization: '', assignee: 'M. Chen (Northwind Marine Pty Ltd)' }]
                    ).map((submitter) => {
                      const isEditing = editingSubmitterOrg === submitter.organization;
                      return (
                        <div key={submitter.organization || 'submitter'} className="map-detail-row border-bottom pb-2" data-testid="set-submitter">
                          <div className="d-flex align-items-center justify-content-between">
                            <div className="text-secondary" style={{ fontSize: '0.725rem' }}>Submitter:</div>
                            {canEditStakeholders && canAssignStakeholderRole(assuranceSet, 'Submitter', activeDemoOrganization, submitter.organization) && (
                              <button
                                type="button"
                                className="btn btn-link p-0 text-decoration-none small ms-auto"
                                style={{ fontSize: '0.7rem', color: '#0284c7' }}
                                onClick={() => setEditingSubmitterOrg(isEditing ? null : submitter.organization)}
                              >
                                {isEditing ? 'Cancel' : 'Assign / Change'}
                              </button>
                            )}
                          </div>
                          {isEditing ? (
                            <div className="mt-1 d-flex flex-column gap-1">
                              <select
                                className="form-select form-select-sm"
                                style={{ fontSize: '0.75rem' }}
                                value={submitter.assignee}
                                onChange={(e) => {
                                  if (e.target.value) assignStakeholder('Submitter', e.target.value, submitter.organization);
                                }}
                              >
                                <option value="">Select submitter</option>
                                {getServiceProviderSubmitterCandidates(users, submitter.organization).map((u) => (
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
                            <div className="fw-bold text-dark">
                              {submitter.assignee === PENDING_ASSIGNMENT
                                ? (submitter.organization ? `Pending, ${submitter.organization}` : 'Pending')
                                : submitter.assignee}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Verifier */}
                    <div className="map-detail-row border-bottom pb-2">
                      <div className="d-flex align-items-center justify-content-between">
                        <div className="text-secondary" style={{ fontSize: '0.725rem' }}>Verifier:</div>
                        {canAssignRole('Verifier') && (
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
                          {assuranceSet.assignedVerifier
                            ? stakeholderLabel('Verifier', assuranceSet.assignedVerifier)
                            : stakeholderLabel('Verifier', 'A. Fontaine (Bureau Veritas Inspector)')}
                        </div>
                      )}
                    </div>

                    {/* Inspector */}
                    <div className="map-detail-row border-bottom pb-2">
                      <div className="d-flex align-items-center justify-content-between">
                        <div className="text-secondary" style={{ fontSize: '0.725rem' }}>Inspector:</div>
                        {canAssignRole('Inspector') && (
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
                            {inspectorCandidates.map((u) => (
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
                            ? stakeholderLabel('Inspector', assuranceSet.assignedInspector || 'N. Technical (Bureau Veritas Inspectorate)')
                            : (assuranceSet.assignedInspector || 'N/A (Not Required)')}
                        </div>
                      )}
                    </div>

                    {/* Approver */}
                    <div className="map-detail-row">
                      <div className="d-flex align-items-center justify-content-between">
                        <div className="text-secondary" style={{ fontSize: '0.725rem' }}>Approver:</div>
                        {canAssignRole('Approver') && (
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
                            : (assuranceSet.assignedApprover
                              ? stakeholderLabel('Approver', assuranceSet.assignedApprover)
                              : stakeholderLabel('Approver', 'P. Nardelli (Marine Assurance Authority)'))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        </div>
      )}

      {/* Tab: Objects */}
      {activeTab === 'objects' && (
        <div className="card map-card-custom">
          <ListToolbar
            searchValue={objectSearch}
            onSearchChange={setObjectSearch}
            searchPlaceholder="Search objects..."
            className="border-bottom"
          />

          <div className="table-responsive">
            <table className="table map-table-custom align-middle mb-0" data-testid="assurance-objects-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Belongs To</th>
                  <th>Verification Status</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredObjects.length === 0 && filteredCrewGroups.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-0">
                      <EmptyState
                        icon={Search}
                        title={objectSearch ? 'No matching objects' : 'No objects'}
                        description={
                          objectSearch
                            ? 'No objects match the current search term.'
                            : 'No objects are recorded under this assurance set.'
                        }
                        action={objectSearch ? { label: 'Clear search', onClick: () => setObjectSearch('') } : undefined}
                      />
                    </td>
                  </tr>
                ) : (
                  <>
                    {/* Crew Groups as top-level expandable rows (ADR 0029 / BRD v4.2) */}
                    {filteredCrewGroups.map((group) => {
                      const isExpanded = expandedGroupIds.has(group.groupId);
                      const rollup = getGroupRollupStatus(group);
                      const groupOrg = assuranceSet.serviceProviderOrg || clientOwnerOrg;

                      return (
                        <React.Fragment key={`group-${group.groupId}`}>
                          <tr
                            data-testid="crew-group-row"
                            data-group-id={group.groupId}
                            className="bg-light bg-opacity-50"
                          >
                            <td>
                              <div className="d-flex align-items-center">
                                <button
                                  type="button"
                                  className="btn btn-sm btn-link p-0 me-2 text-dark text-decoration-none d-inline-flex align-items-center"
                                  onClick={() => toggleGroupExpand(group.groupId)}
                                  aria-expanded={isExpanded}
                                  aria-label={isExpanded ? `Collapse ${group.groupName}` : `Expand ${group.groupName}`}
                                  data-testid={`toggle-group-${group.groupId}`}
                                >
                                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                </button>
                                <Users size={16} className="text-primary me-2 flex-shrink-0" />
                                <div>
                                  <span className="fw-semibold text-dark">{group.groupName}</span>
                                  <span className="badge bg-light text-secondary border ms-2">
                                    {group.memberIds.length} {group.memberIds.length === 1 ? 'member' : 'members'}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                                Crew Group
                              </span>
                            </td>
                            <td>
                              <div className="fw-semibold text-dark">{groupOrg}</div>
                              {group.specialization && (
                                <div className="text-muted font-mono-code" style={{ fontSize: '0.75rem' }}>
                                  {group.specialization}
                                </div>
                              )}
                            </td>
                            <td>
                              <span
                                className={`badge ${
                                  rollup.tone === 'success'
                                    ? 'bg-success-subtle text-success border border-success-subtle'
                                    : rollup.tone === 'warning'
                                    ? 'bg-warning-subtle text-warning-emphasis border border-warning-subtle'
                                    : 'bg-light text-secondary border'
                                } d-inline-flex align-items-center gap-1`}
                                data-testid={`group-rollup-${group.groupId}`}
                              >
                                {rollup.tone === 'success' && <ShieldCheck size={13} />}
                                <span>{rollup.verifiedCount}/{rollup.totalCount} verified</span>
                              </span>
                            </td>
                            <td className="text-end">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center p-0"
                                style={{ width: '32px', height: '32px' }}
                                onClick={() => setCurrentHashView('crew-group', group.groupId)}
                                title={`View ${group.groupName}`}
                                aria-label={`View ${group.groupName}`}
                              >
                                <Eye size={16} />
                              </button>
                            </td>
                          </tr>

                          {/* Member sub-rows directly under group (no nesting) */}
                          {isExpanded &&
                            group.memberIds.map((memberId) => {
                              const isExcluded = isMemberExcluded(memberId);
                              const exclusion = assuranceSet.memberExclusions?.find(
                                (ex) => ex.memberId === memberId && !ex.restored,
                              );
                              const memberCrew = crew.find((c) => c.id === memberId);
                              const memberObj =
                                setObjects.find((o) => o.id === memberId || o.identifier === memberId) ||
                                assuranceObjects.find((o) => o.id === memberId || o.identifier === memberId);
                              const memberName =
                                memberObj?.name || memberCrew?.fullName || memberId;
                              const memberRank = memberCrew?.rank || 'Seafarer';
                              const memberOrg =
                                memberCrew?.organization ||
                                memberObj?.ownerOrganization ||
                                groupOrg;
                              const verification = deriveObjectVerification(
                                memberId,
                                assuranceSets,
                                activeDemoOrganization,
                              );

                              const activeMembersInGroup = group.memberIds.filter((id) => !isMemberExcluded(id));
                              const isLastMember = activeMembersInGroup.length <= 1 && activeMembersInGroup.includes(memberId);
                              const canManageMemberExclusions = activePersona === 'Administrator';

                              return (
                                <tr
                                  key={`member-${group.groupId}-${memberId}`}
                                  data-testid="crew-group-member-row"
                                  data-member-id={memberId}
                                  className={isExcluded ? 'table-light opacity-75' : ''}
                                >
                                  <td>
                                    <div className="d-flex align-items-center ps-4">
                                      <span className="text-muted me-2 select-none" aria-hidden="true">&#x21b3;</span>
                                      <div>
                                        <div
                                          className={`fw-medium ${
                                            isExcluded ? 'text-decoration-line-through text-muted' : 'text-dark'
                                          }`}
                                        >
                                          {memberName}
                                        </div>
                                        <div
                                          className="text-muted font-mono-code"
                                          style={{ fontSize: '0.75rem' }}
                                        >
                                          {memberRank} &middot; {memberId}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td>
                                    <span className="badge bg-light text-secondary border">Person</span>
                                  </td>
                                  <td>
                                    <div className="fw-semibold text-dark">{memberOrg}</div>
                                  </td>
                                  <td>
                                    {isExcluded ? (
                                      <div>
                                        <span
                                          className="badge bg-secondary text-white"
                                          data-testid={`member-excluded-badge-${memberId}`}
                                        >
                                          Excluded
                                        </span>
                                        {exclusion && (
                                          <div
                                            className="text-muted mt-1"
                                            style={{ fontSize: '0.72rem', lineHeight: '1.3' }}
                                            data-testid={`member-exclusion-details-${memberId}`}
                                          >
                                            <div><strong className="text-secondary">Reason:</strong> {exclusion.reason}</div>
                                            <div className="text-secondary"><strong className="text-secondary">By:</strong> {exclusion.excludedBy} &middot; {formatMaritimeDate(exclusion.excludedAt)}</div>
                                          </div>
                                        )}
                                      </div>
                                    ) : verification ? (
                                      <ObjectVerificationBadge verification={verification} />
                                    ) : (
                                      <span className="text-muted small">—</span>
                                    )}
                                  </td>
                                  <td className="text-end">
                                    <div className="d-inline-flex align-items-center justify-content-end gap-1.5">
                                      <button
                                        type="button"
                                        className="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center p-0"
                                        style={{ width: '32px', height: '32px' }}
                                        onClick={() => setCurrentHashView('crew', memberId)}
                                        title={`View ${memberName}`}
                                        aria-label={`View ${memberName}`}
                                      >
                                        <Eye size={16} />
                                      </button>
                                      {canManageMemberExclusions && (
                                        isExcluded ? (
                                          <button
                                            type="button"
                                            className="btn btn-sm btn-outline-success d-inline-flex align-items-center justify-content-center p-0"
                                            style={{ width: '32px', height: '32px' }}
                                            onClick={() => handleRestoreMember(memberId)}
                                            title={`Restore ${memberName}`}
                                            aria-label={`Restore ${memberName}`}
                                            data-testid={`restore-member-btn-${memberId}`}
                                          >
                                            <RotateCcw size={15} />
                                          </button>
                                        ) : isLastMember ? (
                                          <button
                                            type="button"
                                            className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center justify-content-center p-0 opacity-50"
                                            style={{ width: '32px', height: '32px', cursor: 'not-allowed' }}
                                            disabled
                                            title="The last member of a group cannot be excluded"
                                            aria-label="Cannot exclude last member"
                                            data-testid={`exclude-member-btn-${memberId}`}
                                          >
                                            <UserMinus size={15} />
                                          </button>
                                        ) : (
                                          <button
                                            type="button"
                                            className="btn btn-sm btn-outline-danger d-inline-flex align-items-center justify-content-center p-0"
                                            style={{ width: '32px', height: '32px' }}
                                            onClick={() => openExcludeModal(memberId, memberName, group.groupId)}
                                            title={`Exclude ${memberName}`}
                                            aria-label={`Exclude ${memberName}`}
                                            data-testid={`exclude-member-btn-${memberId}`}
                                          >
                                            <UserMinus size={15} />
                                          </button>
                                        )
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                        </React.Fragment>
                      );
                    })}

                    {/* Standalone objects (not belonging to any attached crew group) */}
                    {(setCrewGroups.length > 0 ? standaloneObjects : objectsPagination.pageItems).map((obj) => {
                      const verification = deriveObjectVerification(obj.id, assuranceSets, activeDemoOrganization);
                      const typeLabel = OBJECT_TYPE_LABELS[obj.type] || obj.type.charAt(0).toUpperCase() + obj.type.slice(1);
                      const belongsTo = obj.ownerOrganization || assuranceSet.serviceProviderOrg || clientOwnerOrg;
                      const assignedTarget =
                        obj.assignments?.find((a) => a.isCurrent)?.targetName ||
                        (obj.type !== 'vessel' && assuranceSet.vesselName ? assuranceSet.vesselName : null);
                      const hasDetailView = obj.type === 'vessel' || obj.type === 'person' || obj.type === 'equipment';

                      return (
                        <tr key={obj.id} data-testid="assurance-object-row">
                          <td>
                            <div className="fw-semibold text-dark">{obj.name}</div>
                            {obj.identifier && (
                              <div className="text-muted font-mono-code" style={{ fontSize: '0.75rem' }}>
                                {obj.identifier}
                              </div>
                            )}
                          </td>
                          <td>
                            <span className="badge bg-light text-dark border">
                              {typeLabel}
                            </span>
                          </td>
                          <td>
                            <div className="fw-semibold text-dark">{belongsTo}</div>
                            {assignedTarget && (
                              <div className="text-muted font-mono-code" style={{ fontSize: '0.75rem' }}>
                                {assignedTarget}
                              </div>
                            )}
                          </td>
                          <td>
                            {verification ? (
                              <ObjectVerificationBadge verification={verification} />
                            ) : (
                              <span className="text-muted small">—</span>
                            )}
                          </td>
                          <td className="text-end">
                            {hasDetailView && (
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center p-0"
                                style={{ width: '32px', height: '32px' }}
                                onClick={() => {
                                  if (obj.type === 'vessel') setCurrentHashView('vessels', obj.id);
                                  else if (obj.type === 'person') setCurrentHashView('crew', obj.id);
                                  else if (obj.type === 'equipment') setCurrentHashView('equipment', obj.id);
                                }}
                                title={`View ${obj.name}`}
                                aria-label={`View ${obj.name}`}
                              >
                                <Eye size={16} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </>
                )}
              </tbody>
            </table>
          </div>
          {setCrewGroups.length === 0 && filteredObjects.length > 0 && (
            <TablePagination {...objectsPagination.controls} />
          )}
          {setCrewGroups.length > 0 && standaloneObjects.length > 10 && (
            <TablePagination {...standalonePagination.controls} />
          )}
        </div>
      )}

      {/* Tab: Requirements */}
      {activeTab === 'requirements' && (
        <div className="d-flex flex-column gap-3">
          {/* Summary line: Stage, Readiness %, and View stage link */}
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 px-1 text-secondary small" data-testid="requirements-summary-line">
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <span>
                Stage: <strong className="text-dark">{assuranceSet.stage}</strong>
              </span>
              <span className="text-muted">&middot;</span>
              <span>
                Readiness: <strong className="text-dark">{calculateAssuranceSetReadiness(assuranceSet)}%</strong>
              </span>
            </div>
            <button
              type="button"
              role="link"
              className="btn btn-link p-0 text-decoration-none small"
              style={{ fontSize: '0.8rem', color: '#0284c7' }}
              onClick={() => handleTabChange('details')}
            >
              View stage
            </button>
          </div>

          {isRestrictedProjectOwner ? (
            <div className="card map-card-custom p-4 text-center my-2" data-testid="restricted-project-owner-requirements-note">
              <p className="text-secondary mb-0">Documents and requirements are restricted to participating group members.</p>
            </div>
          ) : (
            <>
          {/* how many requirements each role has to work on */}
          {(() => {
            const c = requirementCounts;
            const chips: { label: string; value: string; testId: string; tone: 'primary' | 'warning' | 'success' | 'neutral' }[] = [];
            if (isSubmitter) {
              chips.push({ label: 'To upload', value: `${c.toUpload} of ${c.total}`, testId: 'count-to-upload', tone: c.toUpload > 0 ? 'primary' : 'success' });
              if (c.returned > 0) chips.push({ label: 'Returned for correction', value: String(c.returned), testId: 'count-returned', tone: 'warning' });
              chips.push({ label: 'Verified', value: `${c.verified} of ${c.total}`, testId: 'count-verified', tone: 'neutral' });
            } else if (isVerifier) {
              chips.push({ label: 'To verify', value: `${c.toVerify} of ${c.total}`, testId: 'count-to-verify', tone: c.toVerify > 0 ? 'primary' : 'success' });
              chips.push({ label: 'Awaiting upload', value: String(c.awaitingUpload), testId: 'count-awaiting-upload', tone: 'neutral' });
              chips.push({ label: 'Verified', value: `${c.verified} of ${c.total}`, testId: 'count-verified', tone: 'neutral' });
            } else if (isApproverOrInspector) {
              chips.push({ label: 'Verified', value: `${c.verified} of ${c.total}`, testId: 'count-verified', tone: c.open === 0 ? 'success' : 'neutral' });
              chips.push({ label: 'Still open', value: String(c.open), testId: 'count-open', tone: c.open > 0 ? 'primary' : 'success' });
            } else {
              chips.push({ label: 'Total', value: String(c.total), testId: 'count-total', tone: 'neutral' });
              chips.push({ label: 'To upload', value: String(c.toUpload), testId: 'count-to-upload', tone: 'neutral' });
              chips.push({ label: 'To verify', value: String(c.toVerify), testId: 'count-to-verify', tone: 'neutral' });
              chips.push({ label: 'Verified', value: String(c.verified), testId: 'count-verified', tone: 'neutral' });
            }
            const toneClass = { primary: 'bg-primary-subtle text-primary-emphasis border-primary-subtle', warning: 'bg-warning-subtle text-warning-emphasis border-warning-subtle', success: 'bg-success-subtle text-success-emphasis border-success-subtle', neutral: 'bg-light text-secondary border' };
            return (
              <div className="d-flex flex-wrap gap-2 px-1" data-testid="requirements-role-counts" aria-label="Requirements you need to work on">
                {chips.map((chip) => (
                  <span key={chip.testId} className={`badge fw-normal border d-inline-flex align-items-center gap-1 ${toneClass[chip.tone]}`} style={{ fontSize: '0.8rem' }} data-testid={chip.testId}>
                    <span>{chip.label}</span>
                    <strong>{chip.value}</strong>
                  </span>
                ))}
              </div>
            );
          })()}

          <div className="card map-card-custom">
            <div className="card-header border-bottom p-3">
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
                <div>
                  <div className="fw-bold text-dark fs-6">
                    Requirements
                  </div>
                </div>
                <div className="d-flex align-items-center gap-2 ms-auto">
                  {(isSetOpen || canEditTasks) && (
                    <div className="dropdown position-relative" ref={addMenuRef}>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1.5"
                        onClick={() => setIsAddMenuOpen((prev) => !prev)}
                        aria-expanded={isAddMenuOpen}
                        aria-haspopup="true"
                        aria-label="Add"
                        data-testid="btn-add-menu"
                      >
                        <Plus size={14} />
                        <span>Add</span>
                        <ChevronDown size={14} className="text-muted ms-0.5" />
                      </button>

                      <div
                        className={`dropdown-menu shadow-sm position-absolute mt-1 end-0 ${isAddMenuOpen ? 'show' : ''}`}
                        style={{ zIndex: 1050, minWidth: '180px' }}
                      >
                        {canEditTasks && (
                          <button
                            type="button"
                            className="dropdown-item d-flex align-items-center gap-2 py-2"
                            onClick={() => {
                              setIsAddMenuOpen(false);
                              openAddTaskModal();
                            }}
                          >
                            <Plus size={14} className="text-primary" />
                            <span>Add Task</span>
                          </button>
                        )}
                        <button
                          type="button"
                          className="dropdown-item d-flex align-items-center gap-2 py-2"
                          onClick={() => {
                            setIsAddMenuOpen(false);
                            setIsAddingCustomSection(true);
                            setCustomSectionError('');
                            setCustomSectionName('');
                          }}
                          data-testid="btn-add-custom-section"
                        >
                          <Plus size={14} className="text-secondary" />
                          <span>Add custom section</span>
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              </div>

            </div>
            {isAddingCustomSection && (
              <div className="p-3 bg-light border-bottom" data-testid="form-add-custom-section">
                <form onSubmit={handleSaveCustomSection}>
                  <div className="row g-2 align-items-end">
                    <div className="col-12 col-md-6">
                      <label className="form-label text-secondary small fw-semibold" htmlFor="input-custom-section-name">
                        Section name <span className="text-danger">*</span>
                      </label>
                      <input
                        id="input-custom-section-name"
                        type="text"
                        className={`form-control form-control-sm ${customSectionError ? 'is-invalid' : ''}`}
                        placeholder="e.g. Navigational equipment, Environmental compliance"
                        value={customSectionName}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCustomSectionName(val);
                          if (!val.trim()) {
                            setCustomSectionError('A section name is required.');
                          } else {
                            setCustomSectionError('');
                          }
                        }}
                        data-testid="input-custom-section-name"
                        autoFocus
                      />
                      {customSectionError && (
                        <div className="text-danger small mt-1" data-testid="error-custom-section-name">
                          {customSectionError}
                        </div>
                      )}
                    </div>
                    <div className="col-auto d-flex align-items-center gap-2">
                      <button
                        type="submit"
                        className="btn btn-sm btn-primary text-white"
                        data-testid="btn-save-custom-section"
                        disabled={!customSectionName.trim()}
                        onClick={handleSaveCustomSection}
                      >
                        Save section
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => {
                          setIsAddingCustomSection(false);
                          setCustomSectionName('');
                          setCustomSectionError('');
                        }}
                        data-testid="btn-cancel-custom-section"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}
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
                      Title {renderSortIndicator('title')}
                    </th>
                    {isVerifier ? (
                      <th
                        style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                        onClick={() => handleReqSort('version')}
                        data-testid="th-version"
                      >
                        Version {renderSortIndicator('version')}
                      </th>
                    ) : isApproverOrInspector ? (
                      <th style={{ whiteSpace: 'nowrap' }} data-testid="th-validity">
                        Validity
                      </th>
                    ) : !isSubmitter ? (
                      <th
                        style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                        onClick={() => handleReqSort('targetObject')}
                        data-testid="th-target-object"
                      >
                        Target Object {renderSortIndicator('targetObject')}
                      </th>
                    ) : null}
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
                  {effectiveSections.length === 0 && orderedRequirements.length === 0 ? (
                    <tr>
                      <td colSpan={reqTableColSpan} className="text-center text-muted py-4 small">
                        No requirements or documents recorded.
                      </td>
                    </tr>
                  ) : (
                    (() => {
                      const sectionsWithReqs: { sec: TaskSection; secReqs: AssuranceRequirement[] }[] = [];
                      const emptySections: TaskSection[] = [];

                      for (const sec of effectiveSections) {
                        const secReqs = orderedRequirements.filter((req) => {
                          const info = getRequirementSectionInfo(req, assuranceSet?.sections);
                          return info.sectionId === sec.id;
                        });
                        if (secReqs.length > 0) {
                          sectionsWithReqs.push({ sec, secReqs });
                        } else {
                          emptySections.push(sec);
                        }
                      }

                      return (
                        <>
                          {sectionsWithReqs.map(({ sec, secReqs }) => {
                            const slug = (sec.name || sec.id).toLowerCase().replace(/[^a-z0-9]+/g, '-');
                            const sectionTitle = toSentenceCase(sec.name);

                            return (
                              <React.Fragment key={sec.id}>
                                <tr className="bg-light border-top border-bottom" data-testid={`group-section-${slug}`}>
                                  <td colSpan={reqTableColSpan} className="py-2.5 px-3">
                                    <div className="d-flex align-items-center justify-content-between">
                                      <span className="fw-bold text-secondary" style={{ fontSize: '0.75rem', letterSpacing: '0.05em' }} data-testid="section-group-header">
                                        {sectionTitle}
                                      </span>
                                      {isAdminViewer && (() => {
                                        const secDoneCount = secReqs.filter((r) => {
                                          if (r.verifierStatus === 'Verified' || r.isFulfilled) return true;
                                          if (r.requirementGroupId?.trim()) {
                                            const groupTasks = assuranceSet.requirements.filter((t) => t.requirementGroupId === r.requirementGroupId);
                                            if (groupTasks.length > 0 && groupTasks.every((t) => t.isFulfilled || t.verifierStatus === 'Verified')) {
                                              return true;
                                            }
                                          }
                                          return false;
                                        }).length;
                                        return (
                                          <span className="badge bg-light text-secondary border font-mono-code" style={{ fontSize: '0.7rem' }} data-testid={`section-count-${slug}`}>
                                            {secDoneCount}/{secReqs.length}
                                          </span>
                                        );
                                      })()}
                                    </div>
                                  </td>
                                </tr>
                                {secReqs.map((req: AssuranceRequirement, rIdx: number) => {
                              const secInfo = getRequirementSectionInfo(req, assuranceSet?.sections);
                              const currentSubtype = getRequirementSubtype(req, secInfo);

                              const prevReq = rIdx > 0 ? secReqs[rIdx - 1] : null;
                              const prevSecInfo = prevReq ? getRequirementSectionInfo(prevReq, assuranceSet?.sections) : null;
                              const prevSubtype = prevReq && prevSecInfo ? getRequirementSubtype(prevReq, prevSecInfo) : null;

                              const isFirstOfSubtype = !prevReq || currentSubtype !== prevSubtype;

                              const canViewDoc = isRequirementDocumentVisible(req, isClientViewer, viewerPartyOrg, assuranceSet, users, setObjects);
                              const groupKey = getRequirementGroupKey(req);
                              const groupTasks = requirementGroupTasksMap.get(groupKey) || [req];
                              const isSharedRequirement = groupTasks.length > 1;

                              const linkedDoc = documents.find((d) => d.id === req.documentId || (req.linkedDocumentId && d.id === req.linkedDocumentId));
                              const effectiveLinkedDoc = canViewDoc ? linkedDoc : undefined;
                              /* an approved set shows the version it was approved against, not the live one */
                              const docView = effectiveLinkedDoc ? getRequirementDocumentView(assuranceSet, req, effectiveLinkedDoc) : undefined;
                              const linkedChildSet = req.linkedAssuranceSetId
                                ? assuranceSets.find((s) => s.id === req.linkedAssuranceSetId)
                                : undefined;

                              const hasAttachedDoc = Boolean(effectiveLinkedDoc || (canViewDoc && (req.documentId || req.linkedDocumentId)));
                              const effectiveOcr = hasAttachedDoc ? (req.ocrConfidence || linkedDoc?.ocrConfidence || 0) : 0;
                              const isReqExpanded = expandedReqIds.has(req.id);

                              return (
                                <React.Fragment key={req.id}>
                                  {Boolean(currentSubtype && isFirstOfSubtype) && (
                                    <tr className="bg-light-subtle border-bottom" data-testid={`group-subtype-${currentSubtype.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>
                                      <td colSpan={reqTableColSpan} className="py-1.5 px-4 text-secondary small fw-semibold">
                                        <div className="d-flex align-items-center gap-2">
                                          <span style={{ fontSize: '0.75rem' }} data-testid="subtype-group-header">{currentSubtype}</span>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                  {isLinkedSubSet(req) && linkedChildSet ? (
                                    <>
                                      <tr className="table-light" data-requirement-id={req.id}>
                                        <td>
                                          <div className="d-flex align-items-center">
                                            <button
                                              type="button"
                                              className="btn btn-sm btn-link p-0 me-2 text-dark text-decoration-none d-inline-flex align-items-center"
                                              onClick={() => toggleReqExpand(req.id)}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                  e.preventDefault();
                                                  toggleReqExpand(req.id);
                                                }
                                              }}
                                              aria-expanded={isReqExpanded}
                                              aria-label={isReqExpanded ? `Collapse ${req.title}` : `Expand ${req.title}`}
                                              data-testid={`toggle-req-${req.id}`}
                                            >
                                              {isReqExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                            </button>
                                            <div>
                                              <div className="fw-semibold text-dark">
                                                {req.title}
                                                {renderRowStatusBadge(req, undefined, false, false, 0)}
                                              </div>
                                              {renderTaskPlacement(req)}
                                              <div className="d-flex align-items-center gap-1.5 flex-wrap">
                                                <span className="font-mono-code small text-primary">{linkedChildSet.id}</span>
                                                <span className="badge bg-info text-dark" style={{ fontSize: '0.7rem' }}>
                                                  Linked Sub-Set
                                                </span>
                                              </div>
                                            </div>
                                          </div>
                                        </td>
                                        {isVerifier || isApproverOrInspector ? (
                                          <td style={{ whiteSpace: 'nowrap' }}>
                                            <span className="text-muted small">—</span>
                                          </td>
                                        ) : !isSubmitter ? (
                                          <td style={{ whiteSpace: 'nowrap' }}>
                                            <div className="fw-semibold text-dark">{linkedChildSet.title}</div>
                                            <div className="text-muted font-mono-code small">{linkedChildSet.id}</div>
                                          </td>
                                        ) : null}
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
                                      {isReqExpanded && (
                                        <tr data-testid={`req-detail-${req.id}`} className="bg-light-subtle">
                                          <td colSpan={reqTableColSpan} className="py-2.5 px-4">
                                            <div className="d-flex flex-column gap-2" style={{ fontSize: '0.78rem' }}>
                                              {req.isOtherDocument && (
                                                <div className="d-flex align-items-center gap-2 flex-wrap">
                                                  <span
                                                    className="badge bg-secondary-subtle text-dark border"
                                                    style={{ fontSize: '0.65rem' }}
                                                    data-testid={`badge-other-doc-${req.id}`}
                                                    title="Added by client"
                                                  >
                                                    Added by client
                                                  </span>
                                                </div>
                                              )}
                                              {(isSubmitter || isVerifier || isApproverOrInspector) && (
                                                <div className="d-flex align-items-center gap-2 flex-wrap">
                                                  <span className="text-secondary fw-semibold">Target Sub-Set:</span>
                                                  <span className="text-dark">{linkedChildSet.title}</span>
                                                  <span className="text-muted font-mono-code small">({linkedChildSet.id})</span>
                                                </div>
                                              )}
                                              {req.description && (
                                                <div className="text-secondary small">{req.description}</div>
                                              )}
                                            </div>
                                          </td>
                                        </tr>
                                      )}
                                    </>
                                  ) : isSharedRequirement ? (
                                    <>
                                      <tr data-requirement-id={req.id} data-testid="shared-requirement-row" className="table-row-shared">
                                        <td>
                                          <div className="d-flex align-items-center">
                                            <button
                                              type="button"
                                              className="btn btn-sm btn-link p-0 me-2 text-dark text-decoration-none d-inline-flex align-items-center"
                                              onClick={() => toggleReqExpand(req.id)}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                  e.preventDefault();
                                                  toggleReqExpand(req.id);
                                                }
                                              }}
                                              aria-expanded={isReqExpanded}
                                              aria-label={isReqExpanded ? `Collapse ${req.title}` : `Expand ${req.title}`}
                                              data-testid={`toggle-req-${req.id}`}
                                            >
                                              {isReqExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                            </button>
                                            <div>
                                              <div className="fw-semibold text-dark">
                                                {req.title}
                                                {renderRowStatusBadge(req, docView, canViewDoc, true, groupTasks.length)}
                                                {(docView?.isLocked || isRequirementOnOlderVersion(req, assuranceSet, documents)) && renderVersionBadge(req, docView, canViewDoc)}
                                              </div>
                                              {renderTaskPlacement(req)}
                                            </div>
                                          </div>
                                        </td>
                                        {isVerifier || isApproverOrInspector ? (
                                          <td style={{ whiteSpace: 'nowrap' }}>
                                            <span className="text-muted small">—</span>
                                          </td>
                                        ) : !isSubmitter ? (
                                          <td style={{ whiteSpace: 'nowrap' }}>
                                            {(() => {
                                              const targetObj = resolveRequirementTargetObject(req);
                                              return (
                                                <div>
                                                  <div className="fw-semibold text-dark">{targetObj.name}</div>
                                                  {targetObj.identifier && (
                                                    <div className="text-muted font-mono-code" style={{ fontSize: '0.72rem' }}>
                                                      {targetObj.identifier}
                                                    </div>
                                                  )}
                                                </div>
                                              );
                                            })()}
                                          </td>
                                        ) : null}
                                        <td>
                                          {(() => {
                                            const allDone = groupTasks.every((t) => t.isFulfilled || t.verifierStatus === 'Verified' || (assuranceSet.verificationRequired === false && Boolean(t.documentId || t.linkedDocumentId)));
                                            const doneCount = groupTasks.filter((t) => t.isFulfilled || t.verifierStatus === 'Verified' || (assuranceSet.verificationRequired === false && Boolean(t.documentId || t.linkedDocumentId))).length;
                                            if (allDone) {
                                              return (
                                                <span data-testid="shared-req-status">
                                                  <StatusBadge value="Verified" />
                                                </span>
                                              );
                                            }
                                            if (doneCount > 0) {
                                              return (
                                                <span data-testid="shared-req-status">
                                                  <StatusBadge value={`In Progress (${doneCount}/${groupTasks.length})`} tone="warning" />
                                                </span>
                                              );
                                            }
                                            return (
                                              <span data-testid="shared-req-status">
                                                <StatusBadge value="Pending" />
                                              </span>
                                            );
                                          })()}
                                        </td>
                                        <td className="text-end">
                                          <div className="d-flex align-items-center justify-content-end gap-1.5 flex-wrap">
                                            {canEditTasks && (
                                              <>
                                                <button
                                                  type="button"
                                                  className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center justify-content-center p-0"
                                                  style={{ width: '32px', height: '32px' }}
                                                  onClick={() => openEditTask(req)}
                                                  title="Edit task"
                                                  aria-label="Edit task"
                                                >
                                                  <Pencil size={14} />
                                                </button>
                                                <button
                                                  type="button"
                                                  className="btn btn-sm btn-outline-danger d-inline-flex align-items-center justify-content-center p-0"
                                                  style={{ width: '32px', height: '32px' }}
                                                  onClick={() => setTaskToDelete(req)}
                                                  title="Remove task"
                                                  aria-label="Remove task"
                                                >
                                                  <Trash2 size={14} />
                                                </button>
                                              </>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                      {isReqExpanded && (
                                        <tr data-testid={`req-detail-${req.id}`} className="bg-light-subtle">
                                          <td colSpan={reqTableColSpan} className="py-2.5 px-4">
                                            <div className="d-flex flex-column gap-2" style={{ fontSize: '0.78rem' }}>
                                              {(renderVersionBadge(req, docView, canViewDoc) || req.attemptNumber || req.isOtherDocument || req.isSpecialized) && (
                                                <div className="d-flex align-items-center gap-2 flex-wrap">
                                                  {renderVersionBadge(req, docView, canViewDoc)}
                                                  {req.attemptNumber && (
                                                    <span className="badge bg-light text-secondary border" style={{ fontSize: '0.65rem' }}>
                                                      Attempt {req.attemptNumber}
                                                    </span>
                                                  )}
                                                  {req.isOtherDocument && (
                                                    <span
                                                      className="badge bg-secondary-subtle text-dark border"
                                                      style={{ fontSize: '0.65rem' }}
                                                      data-testid={`badge-other-doc-${req.id}`}
                                                      title="Added by client"
                                                    >
                                                      Added by client
                                                    </span>
                                                  )}
                                                  {req.isSpecialized && (
                                                    <span className="badge bg-info-subtle text-info-emphasis border border-info-subtle" style={{ fontSize: '0.65rem' }}>
                                                      Custom
                                                    </span>
                                                  )}
                                                </div>
                                              )}
                                              {(isSubmitter || isVerifier || isApproverOrInspector) && (() => {
                                                const targetObj = resolveRequirementTargetObject(req);
                                                return (
                                                  <div className="d-flex align-items-center gap-2 flex-wrap">
                                                    <span className="text-secondary fw-semibold">Target Object:</span>
                                                    <span className="text-dark">{targetObj.name}</span>
                                                    {targetObj.identifier && (
                                                      <span className="text-muted font-mono-code small">({targetObj.identifier})</span>
                                                    )}
                                                  </div>
                                                );
                                              })()}
                                              {req.description && (
                                                <div className="text-secondary small" style={{ lineHeight: '1.4' }}>
                                                  {req.description}
                                                </div>
                                              )}
                                            </div>
                                          </td>
                                        </tr>
                                      )}
                                      {groupTasks.map((partyTask) => {
                                        const canViewPartyDoc = isRequirementDocumentVisible(partyTask, isClientViewer, viewerPartyOrg, assuranceSet, users, setObjects);
                                        const partyLinkedDoc = documents.find((d) => d.id === partyTask.documentId || (partyTask.linkedDocumentId && d.id === partyTask.linkedDocumentId));
                                        const effectivePartyDoc = canViewPartyDoc ? partyLinkedDoc : undefined;
                                        const partyDocView = effectivePartyDoc ? getRequirementDocumentView(assuranceSet, partyTask, effectivePartyDoc) : undefined;
                                        const partyHasDoc = Boolean(effectivePartyDoc || (canViewPartyDoc && (partyTask.documentId || partyTask.linkedDocumentId)));
                                        const partyOcr = partyHasDoc ? (partyTask.ocrConfidence || partyLinkedDoc?.ocrConfidence || 0) : 0;
                                        const partyName = getRequirementPartyLabel(partyTask, assuranceSet, users, setObjects);
                                        const isPartyExpanded = expandedReqIds.has(partyTask.id);

                                        return (
                                          <React.Fragment key={partyTask.id}>
                                            <tr
                                              key={partyTask.id}
                                              data-requirement-id={partyTask.id}
                                              data-testid="party-sub-row"
                                              data-party={partyName}
                                              className="party-sub-row bg-light-subtle border-top-0"
                                            >
                                              <td style={{ paddingLeft: '2.5rem' }}>
                                                <div className="d-flex align-items-center gap-2">
                                                  <span className="text-secondary small fw-bold" style={{ fontSize: '0.85rem' }}>↳</span>
                                                  <button
                                                    type="button"
                                                    className="btn btn-sm btn-link p-0 text-dark text-decoration-none d-inline-flex align-items-center"
                                                    onClick={() => toggleReqExpand(partyTask.id)}
                                                    onKeyDown={(e) => {
                                                      if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        toggleReqExpand(partyTask.id);
                                                      }
                                                    }}
                                                    aria-expanded={isPartyExpanded}
                                                    aria-label={isPartyExpanded ? `Collapse ${partyName}` : `Expand ${partyName}`}
                                                    data-testid={`toggle-req-${partyTask.id}`}
                                                  >
                                                    {isPartyExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                  </button>
                                                  <div>
                                                    <span className="fw-semibold text-dark small" data-testid="party-name">
                                                      {partyName}
                                                    </span>
                                                    {renderRowStatusBadge(partyTask, partyDocView, canViewPartyDoc, false, 0)}
                                                    {(partyDocView?.isLocked || isRequirementOnOlderVersion(partyTask, assuranceSet, documents)) && renderVersionBadge(partyTask, partyDocView, canViewPartyDoc)}
                                                  </div>
                                                </div>
                                              </td>
                                              {isVerifier ? (
                                                <td style={{ whiteSpace: 'nowrap' }}>
                                                  {renderVersionBadge(partyTask, partyDocView, canViewPartyDoc) || (
                                                    <span className="text-muted small">—</span>
                                                  )}
                                                </td>
                                              ) : isApproverOrInspector ? (
                                                <td style={{ whiteSpace: 'nowrap' }}>
                                                  {renderValidityBadge(partyTask, partyDocView, canViewPartyDoc)}
                                                </td>
                                              ) : !isSubmitter ? (
                                                <td>
                                                  <span className="text-muted small">—</span>
                                                </td>
                                              ) : null}
                                              <td>
                                                {renderRequirementStatus(partyTask, canViewPartyDoc)}
                                              </td>
                                              <td className="text-end">
                                                <div className="d-flex align-items-center justify-content-end gap-1.5 flex-wrap">
                                                  {!isSubmitter && effectivePartyDoc && canViewPartyDoc && (
                                                    <button
                                                      type="button"
                                                      className="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center p-0"
                                                      style={{ width: '32px', height: '32px' }}
                                                      onClick={() => setSelectedDocForReview({ doc: partyDocView?.doc || effectivePartyDoc, notes: partyTask.notes, requirementId: partyTask.id, verifierStatus: partyTask.verifierStatus, isVersionLocked: partyDocView?.isLocked })}
                                                      title="PDF Review"
                                                      aria-label="PDF Review"
                                                    >
                                                      <FileText size={16} />
                                                    </button>
                                                  )}
                                                </div>
                                              </td>
                                            </tr>
                                            {isPartyExpanded && (
                                              <tr data-testid={`req-detail-${partyTask.id}`} className="party-detail-row bg-light-subtle">
                                                <td colSpan={reqTableColSpan} style={{ paddingLeft: '4rem' }} className="py-2.5 pe-4">
                                                  <div className="d-flex flex-column gap-1.5" style={{ fontSize: '0.75rem' }}>
                                                    {(renderVersionBadge(partyTask, partyDocView, canViewPartyDoc) || partyTask.attemptNumber || partyTask.isOtherDocument) && (
                                                      <div className="d-flex align-items-center gap-2 flex-wrap">
                                                        {renderVersionBadge(partyTask, partyDocView, canViewPartyDoc)}
                                                        {partyTask.attemptNumber && (
                                                          <span className="badge bg-light text-secondary border" style={{ fontSize: '0.65rem' }}>
                                                            Attempt {partyTask.attemptNumber}
                                                          </span>
                                                        )}
                                                        {partyTask.isOtherDocument && (
                                                          <span
                                                            className="badge bg-secondary-subtle text-dark border"
                                                            style={{ fontSize: '0.65rem' }}
                                                            data-testid={`badge-other-doc-${partyTask.id}`}
                                                            title="Added by client"
                                                          >
                                                            Added by client
                                                          </span>
                                                        )}
                                                      </div>
                                                    )}
                                                    {partyTask.notes && canViewPartyDoc && (
                                                      <div className="text-secondary">{partyTask.notes}</div>
                                                    )}
                                                    {isSubmitter && effectivePartyDoc && canViewPartyDoc && (
                                                      <div className="d-flex align-items-center gap-2 flex-wrap">
                                                        <button
                                                          type="button"
                                                          className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1.5 px-2.5 py-1"
                                                          onClick={() => setSelectedDocForReview({ doc: partyDocView?.doc || effectivePartyDoc, notes: partyTask.notes, requirementId: partyTask.id, verifierStatus: partyTask.verifierStatus, isVersionLocked: partyDocView?.isLocked })}
                                                          title="PDF Review"
                                                          aria-label="PDF Review"
                                                        >
                                                          <FileText size={14} />
                                                          <span>PDF Review</span>
                                                        </button>
                                                      </div>
                                                    )}
                                                    <div className="d-flex align-items-center gap-2 flex-wrap">
                                                      <span className="text-secondary fw-semibold">OCR Confidence:</span>
                                                      <ConfidenceBadge score={partyOcr} />
                                                    </div>
                                                  </div>
                                                </td>
                                              </tr>
                                            )}
                                          </React.Fragment>
                                        );
                                      })}
                                    </>
                                  ) : (
                                    <>
                                      <tr data-requirement-id={req.id}>
                                        <td>
                                          <div className="d-flex align-items-center">
                                            <button
                                              type="button"
                                              className="btn btn-sm btn-link p-0 me-2 text-dark text-decoration-none d-inline-flex align-items-center"
                                              onClick={() => toggleReqExpand(req.id)}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                  e.preventDefault();
                                                  toggleReqExpand(req.id);
                                                }
                                              }}
                                              aria-expanded={isReqExpanded}
                                              aria-label={isReqExpanded ? `Collapse ${req.title}` : `Expand ${req.title}`}
                                              data-testid={`toggle-req-${req.id}`}
                                            >
                                              {isReqExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                            </button>
                                            <div>
                                              <div className="fw-semibold text-dark">
                                                {req.title}
                                                {renderRowStatusBadge(req, docView, canViewDoc, false, 0)}
                                                {(docView?.isLocked || isRequirementOnOlderVersion(req, assuranceSet, documents)) && renderVersionBadge(req, docView, canViewDoc)}
                                              </div>
                                            </div>
                                          </div>
                                        </td>
                                        {isVerifier ? (
                                          <td style={{ whiteSpace: 'nowrap' }}>
                                            {renderVersionBadge(req, docView, canViewDoc) || (
                                              <span className="text-muted small">—</span>
                                            )}
                                          </td>
                                        ) : isApproverOrInspector ? (
                                          <td style={{ whiteSpace: 'nowrap' }}>
                                            {renderValidityBadge(req, docView, canViewDoc)}
                                          </td>
                                        ) : !isSubmitter ? (
                                          <td style={{ whiteSpace: 'nowrap' }}>
                                            {(() => {
                                              const targetObj = resolveRequirementTargetObject(req);
                                              return (
                                                <div>
                                                  <div className="fw-semibold text-dark">{targetObj.name}</div>
                                                  {targetObj.identifier && (
                                                    <div className="text-muted font-mono-code" style={{ fontSize: '0.72rem' }}>
                                                      {targetObj.identifier}
                                                    </div>
                                                  )}
                                                </div>
                                              );
                                            })()}
                                          </td>
                                        ) : null}
                                        <td>
                                          {renderRequirementStatus(req, canViewDoc)}
                                        </td>
                                        <td className="text-end">
                                          <div className="d-flex align-items-center justify-content-end gap-1.5 flex-wrap">
                                            {canEditTasks && !isApproverOrInspector && !isSubmitter && !isVerifier && (
                                              <>
                                                <button
                                                  type="button"
                                                  className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center justify-content-center p-0"
                                                  style={{ width: '32px', height: '32px' }}
                                                  onClick={() => openEditTask(req)}
                                                  title="Edit task"
                                                  aria-label="Edit task"
                                                >
                                                  <Pencil size={14} />
                                                </button>
                                                <button
                                                  type="button"
                                                  className="btn btn-sm btn-outline-danger d-inline-flex align-items-center justify-content-center p-0"
                                                  style={{ width: '32px', height: '32px' }}
                                                  onClick={() => setTaskToDelete(req)}
                                                  title="Remove task"
                                                  aria-label="Remove task"
                                                >
                                                  <Trash2 size={14} />
                                                </button>
                                              </>
                                            )}
                                            {effectiveLinkedDoc && canViewDoc ? (
                                              !isSubmitter ? (
                                                <button
                                                  type="button"
                                                  className="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center p-0"
                                                  style={{ width: '32px', height: '32px' }}
                                                  onClick={() => setSelectedDocForReview({ doc: docView?.doc || effectiveLinkedDoc, notes: req.notes, requirementId: req.id, verifierStatus: req.verifierStatus, isVersionLocked: docView?.isLocked })}
                                                  title="PDF Review"
                                                  aria-label="PDF Review"
                                                >
                                                  <FileText size={16} />
                                                </button>
                                              ) : null
                                            ) : (
                                              <span className="text-secondary small">No Document</span>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                      {isReqExpanded && (
                                        <tr data-testid={`req-detail-${req.id}`} className="bg-light-subtle">
                                          <td colSpan={reqTableColSpan} className="py-2.5 px-4">
                                            <div className="d-flex flex-column gap-2" style={{ fontSize: '0.78rem' }}>
                                              {(renderVersionBadge(req, docView, canViewDoc) || req.attemptNumber || req.isOtherDocument || req.isSpecialized) && (
                                                <div className="d-flex align-items-center gap-2 flex-wrap">
                                                  {renderVersionBadge(req, docView, canViewDoc)}
                                                  {req.attemptNumber && (
                                                    <span className="badge bg-light text-secondary border" style={{ fontSize: '0.65rem' }}>
                                                      Attempt {req.attemptNumber}
                                                    </span>
                                                  )}
                                                  {req.isOtherDocument && (
                                                    <span
                                                      className="badge bg-secondary-subtle text-dark border"
                                                      style={{ fontSize: '0.65rem' }}
                                                      data-testid={`badge-other-doc-${req.id}`}
                                                      title="Added by client"
                                                    >
                                                      Added by client
                                                    </span>
                                                  )}
                                                  {req.isSpecialized && (
                                                    <span className="badge bg-info-subtle text-info-emphasis border border-info-subtle" style={{ fontSize: '0.65rem' }}>
                                                      Custom
                                                    </span>
                                                  )}
                                                </div>
                                              )}
                                              {(isSubmitter || isVerifier || isApproverOrInspector) && (() => {
                                                const targetObj = resolveRequirementTargetObject(req);
                                                return (
                                                  <div className="d-flex align-items-center gap-2 flex-wrap">
                                                    <span className="text-secondary fw-semibold">Target Object:</span>
                                                    <span className="text-dark">{targetObj.name}</span>
                                                    {targetObj.identifier && (
                                                      <span className="text-muted font-mono-code small">({targetObj.identifier})</span>
                                                    )}
                                                  </div>
                                                );
                                              })()}
                                              {req.description && (
                                                <div className="text-secondary" style={{ lineHeight: '1.4' }}>
                                                  {req.description}
                                                </div>
                                              )}
                                              {isSubmitter && effectiveLinkedDoc && canViewDoc && (
                                                <div className="d-flex align-items-center gap-2 flex-wrap">
                                                  <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1.5 px-2.5 py-1"
                                                    onClick={() => setSelectedDocForReview({ doc: docView?.doc || effectiveLinkedDoc, notes: req.notes, requirementId: req.id, verifierStatus: req.verifierStatus, isVersionLocked: docView?.isLocked })}
                                                    title="PDF Review"
                                                    aria-label="PDF Review"
                                                  >
                                                    <FileText size={14} />
                                                    <span>PDF Review</span>
                                                  </button>
                                                </div>
                                              )}
                                              <div className="d-flex align-items-center gap-3 flex-wrap">
                                                <div className="d-flex align-items-center gap-1.5">
                                                  <span className="text-secondary fw-semibold">OCR Confidence:</span>
                                                  <ConfidenceBadge score={effectiveOcr} />
                                                </div>
                                                {(req.assignedSubmitter || req.assignedVerifier) && (
                                                  <div className="text-muted d-flex align-items-center gap-2 flex-wrap">
                                                    {req.assignedSubmitter && (
                                                      <span><span className="text-secondary fw-semibold">Submitter:</span> {req.assignedSubmitter.split(' (')[0]}</span>
                                                    )}
                                                    {req.assignedSubmitter && req.assignedVerifier && <span>·</span>}
                                                    {req.assignedVerifier && (
                                                      <span><span className="text-secondary fw-semibold">Verifier:</span> {req.assignedVerifier.split(' (')[0]}</span>
                                                    )}
                                                  </div>
                                                )}
                                                {req.decisionTime && (
                                                  <div className="text-muted">
                                                    <span className="text-secondary fw-semibold">Decision:</span> {formatMaritimeDateTime(req.decisionTime)}
                                                  </div>
                                                )}
                                                {req.verifierStatus === 'Verified' && (
                                                  <div className="text-muted">
                                                    <span className="text-secondary fw-semibold">Method:</span> {req.verificationMethod || 'Not recorded'}
                                                    {req.overrideReason && (
                                                      <span className="ms-2 text-warning-emphasis" title={req.overrideReason}>· Override</span>
                                                    )}
                                                  </div>
                                                )}
                                              </div>
                                              {renderContractShortWarning(docView?.doc || effectiveLinkedDoc, canViewDoc)}
                                              {docView && canViewDoc && (() => {
                                                const validity = getValidityInContractPeriod(docView.doc.expiryDate, assuranceSet);
                                                if (validity.state === 'unknown') return null;
                                                const tone =
                                                  validity.state === 'valid_through_period'
                                                    ? 'bg-success-subtle text-success-emphasis border-success-subtle'
                                                    : validity.state === 'lapsed'
                                                      ? 'bg-danger-subtle text-danger-emphasis border-danger-subtle'
                                                      : 'bg-warning-subtle text-warning-emphasis border-warning-subtle';
                                                return (
                                                  <div className="d-flex align-items-center gap-2 flex-wrap">
                                                    <span className={`badge border ${tone}`}>{validity.label}</span>
                                                    {validity.state !== 'valid_through_period' && validity.expiryDate && (
                                                      <span className="text-muted">
                                                        {formatMaritimeDate(validity.expiryDate)}
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
                                            </div>
                                          </td>
                                        </tr>
                                      )}
                                    </>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}
                      {emptySections.length > 0 && (
                        <>
                          <tr className="bg-light border-top border-bottom" data-testid="empty-sections-row">
                            <td colSpan={reqTableColSpan} className="py-2.5 px-3">
                              <button
                                type="button"
                                className="btn btn-sm btn-link p-0 text-secondary text-decoration-none d-inline-flex align-items-center gap-2 fw-semibold"
                                style={{ fontSize: '0.75rem', letterSpacing: '0.05em' }}
                                onClick={() => setIsEmptySectionsExpanded((prev) => !prev)}
                                aria-expanded={isEmptySectionsExpanded}
                                data-testid="toggle-empty-sections"
                              >
                                {isEmptySectionsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                <span>
                                  {emptySections.length} empty {emptySections.length === 1 ? 'section' : 'sections'}
                                </span>
                              </button>
                            </td>
                          </tr>
                          {isEmptySectionsExpanded &&
                            emptySections.map((sec) => {
                              const slug = (sec.name || sec.id).toLowerCase().replace(/[^a-z0-9]+/g, '-');
                              const sectionTitle = toSentenceCase(sec.name);
                              return (
                                <tr
                                  key={sec.id}
                                  data-testid={`empty-section-${slug}`}
                                  className="border-bottom bg-white"
                                >
                                  <td colSpan={reqTableColSpan} className="py-2 px-3 ps-4 text-muted small">
                                    <span className="fw-medium text-dark">{sectionTitle}</span>
                                    <span className="ms-2 text-secondary fst-italic" style={{ fontSize: '0.75rem' }}>
                                      (No requirements recorded)
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                        </>
                      )}
                    </>
                  );
                })()
              )}
                </tbody>
              </table>
            </div>
            <TablePagination {...requirementsPagination.controls} />
          </div>
          </>
          )}
        </div>
      )}

      {/* Tab: Tasks */}
      {tasksPaneMounted && (
      <div
        style={{ display: activeTab === 'tasks' ? 'flex' : 'none' }}
        className="flex-column gap-3"
        data-testid="assurance-detail-tasks-tab-pane"
      >
        {isRestrictedProjectOwner ? (
          <div className="card map-card-custom p-4 text-center my-2" data-testid="restricted-project-owner-tasks-note">
            <p className="text-secondary mb-0">Documents and requirements are restricted to participating group members.</p>
          </div>
        ) : (
          <ProjectTasksTable
            sets={assuranceSet ? [assuranceSet] : []}
            scope={{ type: 'set', id: assuranceSet?.id || '' }}
            today={new Date()}
            showActions
            viewerParty={viewerParty}
            onOpenRequirement={(req) => {
              setFocusedRequirementId(req.id);
              setShowBackToTasks(true);
              setActiveTab('requirements');
            }}
            onTaskAction={(req, parentSet) => {
              const action = getTaskRowActionLabel({ requirement: req, parentSet }, viewerParty);
              const linkedDoc = documents.find((d) => d.id === req.documentId || (req.linkedDocumentId && d.id === req.linkedDocumentId));
              if (action === 'Upload') {
                openRequirementUpload(req, linkedDoc);
              } else if (action === 'Review') {
                if (linkedDoc) {
                  const docView = getRequirementDocumentView(parentSet, req, linkedDoc);
                  setSelectedDocForReview({
                    doc: docView?.doc || linkedDoc,
                    notes: req.notes,
                    requirementId: req.id,
                    verifierStatus: req.verifierStatus,
                    isVersionLocked: docView?.isLocked,
                  });
                }
              } else {
                setFocusedRequirementId(req.id);
                setShowBackToTasks(true);
                setActiveTab('requirements');
              }
            }}
          />
        )}
      </div>
      )}

      {/* Bottom Row: Requirements Register Table taking full 100% width across two columns */}


      {/* Tab: Audit Trail */}
      {activeTab === 'audit' && (
        <div className="card map-card-custom p-4">
          <div className="mb-3">
            <h5 className="fw-bold text-dark mb-1">Audit Trail</h5>
            <div className="small text-secondary">
              Immutable ledger of changes to this assurance set, its tasks, and target dates.
            </div>
          </div>
          {setAuditEvents.length === 0 ? (
            <EmptyState
              title="No audit events recorded"
              description="There are no audit events recorded for this assurance set."
            />
          ) : (
            <>
              <ListToolbar
                searchValue={auditSearchTerm}
                onSearchChange={setAuditSearchTerm}
                searchPlaceholder="Search audit trail..."
                onExportCsv={handleAuditExportCsv}
                onExportPdf={handleAuditExportPdf}
                className="border rounded mb-3 px-0"
              >
                <div className="d-flex align-items-center gap-2">
                  <label htmlFor="audit-category-select" className="small text-secondary text-nowrap mb-0">
                    Category:
                  </label>
                  <select
                    id="audit-category-select"
                    className="form-select form-select-sm bg-white text-dark border-secondary"
                    style={{ minWidth: '180px' }}
                    value={auditCategoryFilter}
                    onChange={(e) => setAuditCategoryFilter(e.target.value as AuditMovementCategory)}
                    aria-label="Filter by category"
                  >
                    <option value="all">All categories</option>
                    <option value="stage_workflow">Stage &amp; Workflow</option>
                    <option value="docs_reqs">Documents &amp; Requirements</option>
                    <option value="stakeholders_parties">Stakeholders &amp; Parties</option>
                    <option value="tasks_findings">Tasks &amp; Findings</option>
                    <option value="dates_scope">Dates &amp; Scope</option>
                  </select>
                </div>
              </ListToolbar>

              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.8rem' }}>
                  <thead className="table-light">
                    <tr>
                      <th>Timestamp</th>
                      <th>User &amp; Role</th>
                      <th>Action</th>
                      <th>Target</th>
                      <th>Change Details</th>
                      <th>Justification</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditPagination.pageItems.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-4 text-secondary small">
                          No audit events match your search or filter criteria.
                        </td>
                      </tr>
                    ) : (
                      auditPagination.pageItems.map((ev) => {
                        const note = ev.justificationNotes?.trim() ?? '';
                        return (
                          <tr key={ev.id} data-event-id={ev.id}>
                            <td className="font-mono-code small">{formatMaritimeDateTime(ev.timestampUtc)}</td>
                            <td className="small text-dark">
                              <div className="fw-semibold">{ev.userId}</div>
                              <span className="text-secondary">{getRoleDisplayLabel(ev.userRole)} &middot; {ev.organization}</span>
                            </td>
                            <td className="fw-semibold text-primary">{ev.action}</td>
                            <td className="small text-dark">
                              <div className="fw-semibold text-truncate" style={{ maxWidth: '240px' }} title={displayAuditTarget(ev)}>
                                {displayAuditTarget(ev)}
                              </div>
                              <span className="badge bg-light text-secondary border mt-1" style={{ fontSize: '0.7rem' }}>
                                {ev.target?.kind ? ev.target.kind.toUpperCase() : 'SET'}
                              </span>
                            </td>
                            <td className="small text-dark">
                              <div>{displayAuditChange(ev)}</div>
                              {ev.fieldDelta && (
                                <div className="d-flex align-items-center gap-1 mt-1 flex-wrap">
                                  <span className="badge bg-light text-dark border px-2 py-1 font-mono-code" style={{ fontSize: '0.72rem' }}>
                                    {displayAuditValue(ev.fieldDelta.oldValue)}
                                  </span>
                                  <span className="text-secondary small">&rarr;</span>
                                  <span className="badge bg-primary text-white px-2 py-1 font-mono-code" style={{ fontSize: '0.72rem' }}>
                                    {displayAuditValue(ev.fieldDelta.newValue)}
                                  </span>
                                </div>
                              )}
                            </td>
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
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <TablePagination {...auditPagination.controls} />
            </>
          )}
        </div>
      )}


      {/* Document Review Drawer */}
      <DocumentReviewDrawer
        document={
          !isRestrictedProjectOwner &&
          selectedDocForReview &&
            (isClientViewer ||
              !selectedDocForReview.requirementId ||
              isRequirementDocumentVisible(
                assuranceSet.requirements?.find((r) => r.id === selectedDocForReview.requirementId) || ({ id: '' } as any),
                isClientViewer,
                viewerPartyOrg,
                assuranceSet,
                users,
                setObjects,
              ))
            ? selectedDocForReview.doc
            : null
        }
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
                  onClick={handleAddToProjectContinue}
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <AttachAssuranceSetPreviewModal
        isOpen={isAttachPreviewOpen && Boolean(attachTargetProject)}
        onClose={closeAddToProject}
        assuranceSet={assuranceSet}
        project={attachTargetProject || { name: '' }}
        onConfirm={handleAttachPreviewConfirm}
      />

      <ConfirmDialog
        isOpen={shortCertificateConfirm !== null}
        title="Certificates expire before the contract ends"
        message={
          shortCertificateConfirm && (
            <>
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
            </>
          )
        }
        confirmLabel="Save contract period"
        onConfirm={commitCharterWindow}
        onCancel={() => setShortCertificateConfirm(null)}
      />

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
      <AssuranceTaskModal
        mode="date"
        isOpen={!!editingTaskDate}
        onClose={() => setEditingTaskDate(null)}
        assuranceSet={assuranceSet}
        editingTaskDate={editingTaskDate ?? { reqId: '', title: '', currentDate: '' }}
        dateDraft={taskDateDraft}
        dateReasonDraft={taskDateReasonDraft}
        dateError={taskDateError}
        onDateDraftChange={(val) => { setTaskDateDraft(val); setTaskDateError(null); }}
        onDateReasonChange={setTaskDateReasonDraft}
        onSave={handleSaveTaskTargetDate}
      />

      {/* Target Date Permissions Modal */}
      <Modal
        isOpen={isDatePermissionsModalOpen}
        onClose={() => setIsDatePermissionsModalOpen(false)}
        title="Target Date Grants"
        meta="Short-term permissions granted to named client users to change target dates (BRD V4.2 change 6)."
        size="lg"
        footer={
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => setIsDatePermissionsModalOpen(false)}>
            Close
          </button>
        }
      >
        <div className="d-flex flex-column gap-3">
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
                  <label className="form-label text-secondary small mb-1" htmlFor="grant-duration-days">Permission Window (Days)</label>
                  <select
                    id="grant-duration-days"
                    className="form-select form-select-sm bg-white"
                    value={grantDurationDays}
                    onChange={(e) => setGrantDurationDays(e.target.value)}
                  >
                    <option value="1">1 Day</option>
                    <option value="3">3 Days</option>
                    <option value="7">7 Days</option>
                    <option value="14">14 Days</option>
                    <option value="30">30 Days</option>
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
      </Modal>

      {/* Overdue Outcome Modal: Revise Completion Date */}
      <Modal
        isOpen={isReviseDeadlineModalOpen}
        onClose={() => setIsReviseDeadlineModalOpen(false)}
        title="Revise Completion Date"
        meta="Update the target completion date for this overdue assurance set."
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => setIsReviseDeadlineModalOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              disabled={!revisedDateReason.trim()}
              title={!revisedDateReason.trim() ? 'A reason for revising the completion date is required.' : undefined}
              onClick={handleSaveRevisedDeadline}
            >
              Save Revised Date
            </button>
          </>
        }
      >
        <div className="d-flex flex-column gap-3">
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
              Reason for Revision <span className="text-danger">*</span>
            </label>
            <textarea
              id="revised-deadline-reason"
              rows={2}
              className="form-control form-control-sm"
              placeholder="e.g. Supplier delay in certification endorsement..."
              value={revisedDateReason}
              onChange={(e) => {
                setRevisedDateReason(e.target.value);
                setRevisedDateError(null);
              }}
            />
          </div>
        </div>
      </Modal>

      {/* Overdue Outcome Modal: Exempt Tasks */}
      <Modal
        isOpen={isExemptTasksModalOpen}
        onClose={() => setIsExemptTasksModalOpen(false)}
        title="Exempt Tasks from Completion Date"
        meta="Grant individual deadline extensions for specific tasks so the set can proceed."
        size="lg"
        footer={
          <>
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => setIsExemptTasksModalOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn-sm btn-primary" onClick={handleGrantExemptions}>
              Grant Exemption ({selectedExemptTaskIds.length})
            </button>
          </>
        }
      >
        <div className="d-flex flex-column gap-3">
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
                                  <StatusBadge
                                    value={req.verifierStatus || (req.isFulfilled ? 'Approved' : 'Pending')}
                                  />
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
      </Modal>

      {/* Overdue Outcome Modal: Partial Closure */}
      <ConfirmDialog
        isOpen={isPartialCloseModalOpen}
        title="Confirm Partial Closure"
        message={
          <div className="d-flex flex-column gap-3">
            <div className="alert alert-warning py-2 mb-0 small">
              <strong>Partial Closure Policy:</strong> The set will be moved to Approved status with partial closure mode. Every mandatory task must be Verified or exempted first. Exempted tasks remain open with their extended dates.
            </div>
            {partialCloseError && (
              <div className="alert alert-danger py-2 mb-0 small" role="alert">
                {partialCloseError}
              </div>
            )}
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
                <span className="text-muted">Open required (block close):</span>{' '}
                <span className="fw-semibold text-danger">
                  {assuranceSet.requirements.filter(
                    (r) => r.isMandatory && !r.exemption && r.verifierStatus !== 'Verified',
                  ).length}
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
        }
        confirmLabel="Partially Close Set"
        cancelLabel="Cancel"
        onConfirm={handleConfirmPartialClose}
        onCancel={() => { setIsPartialCloseModalOpen(false); setPartialCloseNotes(''); setPartialCloseError(null); }}
      />

      {/* Overdue Outcome Modal: Cancel Set */}
      <ConfirmDialog
        isOpen={isCancelModalOpen}
        title="Cancel Assurance Set"
        message={
          <div className="d-flex flex-column gap-3">
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
        }
        confirmLabel="Cancel Set"
        cancelLabel="Keep Set"
        tone="danger"
        onConfirm={handleConfirmCancel}
        onCancel={() => { setIsCancelModalOpen(false); setCancellationReasonDraft(''); }}
      />

      {/* Add Task Modal */}
      <AssuranceTaskModal
        mode="add"
        isOpen={isAddTaskModalOpen}
        onClose={() => setIsAddTaskModalOpen(false)}
        assuranceSet={assuranceSet}
        draft={newTaskDraft}
        onDraftChange={setNewTaskDraft}
        onSave={handleSaveNewTask}
        error={newTaskError}
      />

      {/* Edit Task Modal */}
      {editingTask && (
        <AssuranceTaskModal
          mode="edit"
          isOpen={!!editingTask}
          onClose={() => setEditingTask(null)}
          assuranceSet={assuranceSet}
          editingTask={editingTask}
          draft={editTaskDraft}
          onDraftChange={setEditTaskDraft}
          onSave={handleSaveEditTask}
          error={editTaskError}
        />
      )}

      {/* Remove Task Confirmation Modal */}
      <ConfirmDialog
        isOpen={taskToDelete !== null}
        title="Remove Task"
        message={
          taskToDelete && (
            <p className="mb-0 text-dark small">
              Are you sure you want to remove <strong>{taskToDelete.title}</strong> from this assurance set?
            </p>
          )
        }
        confirmLabel="Remove Task"
        tone="danger"
        onConfirm={handleConfirmDeleteTask}
        onCancel={() => setTaskToDelete(null)}
      />

      <ConfirmDialog
        isOpen={excludingMember !== null}
        title={
          <span className="d-flex align-items-center gap-2">
            <UserMinus size={18} />
            Exclude Seafarer from Set
          </span>
        }
        message={
          excludingMember && (
            <p className="text-secondary small mb-0">
              You are excluding <strong className="text-dark">{excludingMember.memberName}</strong> from this assurance set.
              The master crew group in the directory will remain unchanged.
            </p>
          )
        }
        confirmLabel="Confirm Exclusion"
        tone="danger"
        reasonLabel="Reason for Exclusion"
        reasonPlaceholder="Enter required operational or medical justification..."
        confirmTestId="confirm-exclude-btn"
        reasonTestId="exclude-reason-input"
        onConfirm={handleConfirmExclude}
        onCancel={closeExcludeModal}
      />
    </div>
  );
};
