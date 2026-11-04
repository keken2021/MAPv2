/* 
  file summary: assurance set command center deep-dive view presenting stage pipeline stepper and requirements register in light theme.
  responsibilities: manages requirement verification statuses, displays pipeline stage progress, and enforces C Admin read-only rules.
  role in system: deep-dive view rendered when an assurance set row is selected.
*/

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, FolderOpen, FileCheck, FileText, Lock, RefreshCw, Upload, Pencil, Calendar, Key, ShieldCheck, Plus, Trash2, Eye, Search } from 'lucide-react';
import { useMapStore } from '../store/useMapStore';
import { PipelineStepper } from '../components/common/PipelineStepper';
import { ReadinessGauge } from '../components/common/ReadinessGauge';
import { DetailHeader } from '../components/common/DetailHeader';
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
import { AssuranceObject, AssuranceRequirement, AssuranceSubtype, DatePermissionGrant, TargetDateChangeRecord, TaskSection, ThreePillarsCategory } from '../types/assurance';
import { filterProjectsForPersona, getProjectForAssuranceSet, isAssuranceSetOrphaned } from '../utils/projectHelpers';

import { VersionHistoryDrawer } from '../components/drawers/VersionHistoryDrawer';
import { exportToCsv, exportToPdf } from '../utils/exportHelpers';
import { DocumentUploadModal } from '../components/modals/DocumentUploadModal';
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
} from '../utils/rbacHelpers';
import { useSessionUser } from '../utils/useSessionUser';
import { ApproverDecisionBar } from '../components/common/ApproverDecisionBar';
import { getDocumentReuploadBlockReason, documentExpiresBeforeContractEnd, listCertificatesShortOfContract } from '../utils/documentRenewalHelpers';
import { useOverlayBehavior } from '../utils/useOverlayBehavior';
import { getAssuranceSetAssets, getAssuranceSetCrewIds, getAssuranceSetObjects, getAssuranceSetScopes, SUBTYPE_CATEGORIES } from '../utils/assuranceTemplates';
import { findOverlappingAssuranceSets, formatOverlapError } from '../utils/assuranceOverlap';
import {
  deriveObjectVerification,
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

export type AssuranceDetailTab = 'details' | 'objects' | 'requirements' | 'tasks' | 'audit';


interface RequirementSectionInfo {
  sectionId: string;
  sectionTitle: string;
  sectionOrder: number;
  isGeneral: boolean;
  isCustom: boolean;
  scope?: AssuranceSubtype | 'procedure' | 'method';
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

  let scope: AssuranceSubtype | 'procedure' | 'method' = 'Vessel';
  if (req.subtype) {
    scope = req.subtype;
  } else if (req.sectionId?.startsWith('sec-')) {
    const slug = req.sectionId.replace('sec-', '').toLowerCase();
    if (slug === 'crew') scope = 'Crew';
    else if (slug === 'equipment') scope = 'Equipment';
    else if (slug === 'activity') scope = 'Activity';
    else if (slug === 'procedure') scope = 'procedure';
    else if (slug === 'method') scope = 'method';
    else if (slug === 'vessel') scope = 'Vessel';
  } else {
    const cat = req.category || '';
    if (/crew|competency|medical|bosiet|credential/i.test(cat)) {
      scope = 'Crew';
    } else if (/equipment|lifting|crane|fmea/i.test(cat)) {
      scope = 'Equipment';
    } else if (/operational|risk|simops|mooring|emergency/i.test(cat)) {
      scope = 'Activity';
    } else if (/procedure/i.test(cat)) {
      scope = 'procedure';
    } else if (/method/i.test(cat)) {
      scope = 'method';
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
      : scope === 'Activity'
      ? 'Activity documents'
      : scope === 'procedure'
      ? 'Procedures'
      : 'Methods';

  const defaultOrder =
    scope === 'Vessel'
      ? 10
      : scope === 'Crew'
      ? 20
      : scope === 'Equipment'
      ? 30
      : scope === 'Activity'
      ? 40
      : scope === 'procedure'
      ? 50
      : 60;

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
  if (secInfo.isGeneral || secInfo.isCustom || secInfo.scope === 'procedure' || secInfo.scope === 'method') {
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

const OBJECT_TYPE_LABELS: Record<string, string> = {
  vessel: 'Vessel',
  person: 'Crew',
  equipment: 'Equipment',
  procedure: 'Procedure',
  document: 'Document',
  method: 'Method',
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
  set: { assignedSubmitter?: string; serviceProviderOrg?: string },
  users: Array<{ id: string; name: string; organization?: string }>,
  objects: AssuranceObject[],
): boolean {
  if (isClient) return true;
  if (!viewerOrg.trim()) return false;
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
  const [editingRole, setEditingRole] = useState<'Submitter' | 'Verifier' | 'Inspector' | 'Approver' | null>(null);
  const [editingSubmitterOrg, setEditingSubmitterOrg] = useState<string | null>(null);

  const [objectSearch, setObjectSearch] = useState('');
  const [isAddingCustomSection, setIsAddingCustomSection] = useState(false);
  const [customSectionName, setCustomSectionName] = useState('');
  const [customSectionError, setCustomSectionError] = useState('');

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

  type ReqSortField = 'title' | 'targetDate' | 'targetObject' | 'ocrConfidence' | 'status';
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

  const [activeTab, setActiveTab] = useState<AssuranceDetailTab>(() => initialTab || parseTabFromUrl());

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
      setObjects.some((o) => o.type === 'procedure') ||
      assuranceSet.subtypes?.some((s) => s.toLowerCase() === 'procedure') ||
      assuranceSet.requirements?.some((r) => r.subtype?.toLowerCase() === 'procedure')
    ) {
      linkedScopes.add('Procedure');
    }
    if (
      setObjects.some((o) => o.type === 'method') ||
      assuranceSet.subtypes?.some((s) => s.toLowerCase() === 'method') ||
      assuranceSet.requirements?.some((r) => r.subtype?.toLowerCase() === 'method')
    ) {
      linkedScopes.add('Method');
    }

    (assuranceSet.sections || []).forEach((sec) => {
      const id = sec.id.toLowerCase();
      if (id === 'sec-vessel' || id === 'vessel') linkedScopes.add('Vessel');
      else if (id === 'sec-crew' || id === 'crew') linkedScopes.add('Crew');
      else if (id === 'sec-equipment' || id === 'equipment') linkedScopes.add('Equipment');
      else if (id === 'sec-procedure' || id === 'procedure') linkedScopes.add('Procedure');
      else if (id === 'sec-method' || id === 'method') linkedScopes.add('Method');
    });

    const objectSectionList: TaskSection[] = [];
    const scopeOrder: Record<string, number> = {
      Vessel: 10,
      Crew: 20,
      Equipment: 30,
      Procedure: 40,
      Method: 50,
    };

    ['Vessel', 'Crew', 'Equipment', 'Procedure', 'Method'].forEach((scope) => {
      if (!linkedScopes.has(scope)) return;
      const slug = scope.toLowerCase();
      const secId = `sec-${slug}`;
      const declared = assuranceSet.sections?.find((s) => s.id === secId || s.id === slug || s.name.toLowerCase().includes(slug));
      const defaultName = scope === 'Crew' ? 'Crew directory documents' : scope === 'Procedure' ? 'Procedures' : scope === 'Method' ? 'Methods' : `${scope} documents`;
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
          isCustom: !['sec-general', 'sec-vessel', 'sec-crew', 'sec-equipment', 'sec-procedure', 'sec-method'].includes(sec.id),
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
      if (sec.info.isGeneral || sec.info.isCustom || sec.info.scope === 'procedure' || sec.info.scope === 'method') {
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
    document
      .querySelector(`[data-requirement-id="${focusedRequirementId}"]`)
      ?.scrollIntoView({ block: 'center' });
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

    if (isClientViewer) {
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
      if (auditTarget && auditTarget.kind === 'task' && auditTarget.taskId) {
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
      }

      if (/document|certificate|dossier/i.test(ev.action) && ev.organization && viewerPartyOrg) {
        if (!orgFieldMatches(viewerPartyOrg, ev.organization) && !orgFieldMatches(clientOwnerOrg, ev.organization)) {
          return false;
        }
      }

      return true;
    });
  }, [visibleEvents, assuranceSet, activePersona, assuranceSets, vessels, currentUserId, isClientViewer, viewerPartyOrg, users, setObjects, clientOwnerOrg]);

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
  const canEditTasks = (isClientUser(sessionUser, assuranceSet, activePersona) || activePersona === 'Administrator' || roleActions.canManage) && isSetOpen;
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
  const totalCount = assuranceSet.requirements.length;

  const renderRequirementStatus = (req: AssuranceRequirement, canViewDoc: boolean = true) => {
    if (!canViewDoc || (!req.documentId && !req.linkedDocumentId)) {
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
  const renderVersionBadge = (req: AssuranceRequirement, docView?: RequirementDocumentView, canViewDoc: boolean = true) => {
    if (!canViewDoc) return null;
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
          clientOwnerOrg,
          assuranceSet.complianceDeadline || assuranceSet.targetDate
            ? formatMaritimeDate(assuranceSet.complianceDeadline || assuranceSet.targetDate || '')
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
            aria-selected={activeTab === 'objects'}
            className={`nav-link ${activeTab === 'objects' ? 'active fw-bold text-primary' : 'text-secondary'}`}
            onClick={() => handleTabChange('objects')}
          >
            Objects
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
                        <ul className="list-unstyled mb-0 mt-1">
                          {organizations.map((organization) => (
                            <li key={organization} className="fw-bold text-dark py-1">
                              {organization}
                            </li>
                          ))}
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
                            ? stakeholderLabel('Inspector', assuranceSet.assignedInspector || 'N. Technical (Meridian Marine Surveyors)')
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

      )}

      {/* Tab: Objects */}
      {activeTab === 'objects' && (
        <div className="card map-card-custom">
          <div className="p-3 border-bottom">
            <div className="row g-2 align-items-center">
              <div className="col-12 col-md-5">
                <div className="input-group">
                  <span className="input-group-text bg-white border-end-0 text-muted">
                    <Search size={15} />
                  </span>
                  <input
                    type="text"
                    className="form-control border-start-0 ps-0 bg-white text-dark"
                    placeholder="Search objects..."
                    value={objectSearch}
                    onChange={(e) => setObjectSearch(e.target.value)}
                    aria-label="Search objects"
                  />
                  {objectSearch && (
                    <button
                      type="button"
                      className="btn btn-outline-secondary border-start-0"
                      onClick={() => setObjectSearch('')}
                      aria-label="Clear search"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

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
                {filteredObjects.length === 0 ? (
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
                  objectsPagination.pageItems.map((obj) => {
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
                  })
                )}
              </tbody>
            </table>
          </div>
          {filteredObjects.length > 0 && (
            <TablePagination {...objectsPagination.controls} />
          )}
        </div>
      )}

      {/* Tab: Requirements */}
      {activeTab === 'requirements' && (
        <div className="d-flex flex-column gap-4">
          {/* Top: Stage & Readiness Section */}
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

          <div className="card map-card-custom">
            <div className="card-header border-bottom p-3">
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
                <div>
                  <div className="fw-bold text-dark fs-6">
                    Requirements
                  </div>
                </div>
                <div className="d-flex align-items-center gap-2 ms-auto">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1.5"
                    onClick={() => {
                      setIsAddingCustomSection(true);
                      setCustomSectionError('');
                      setCustomSectionName('');
                    }}
                    data-testid="btn-add-custom-section"
                  >
                    <Plus size={14} />
                    Add custom section
                  </button>
                  {canEditTasks && (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
                      onClick={openAddTaskModal}
                    >
                      <Plus size={14} />
                      Add Task
                    </button>
                  )}
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
                    <th
                      style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                      onClick={() => handleReqSort('targetObject')}
                    >
                      Target Object {renderSortIndicator('targetObject')}
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
                  {effectiveSections.length === 0 && orderedRequirements.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center text-muted py-4 small">
                        No requirements or documents recorded.
                      </td>
                    </tr>
                  ) : (
                    effectiveSections.map((sec) => {
                      const slug = (sec.name || sec.id).toLowerCase().replace(/[^a-z0-9]+/g, '-');
                      const sectionTitle = toSentenceCase(sec.name);
                      const secReqs = orderedRequirements.filter((req) => {
                        const info = getRequirementSectionInfo(req, assuranceSet?.sections);
                        return info.sectionId === sec.id;
                      });

                      return (
                        <React.Fragment key={sec.id}>
                          <tr className="bg-light border-top border-bottom" data-testid={`group-section-${slug}`}>
                            <td colSpan={5} className="py-2.5 px-3">
                              <div className="d-flex align-items-center justify-content-between">
                                <span className="fw-bold text-secondary" style={{ fontSize: '0.75rem', letterSpacing: '0.05em' }} data-testid="section-group-header">
                                  {sectionTitle}
                                </span>
                              </div>
                            </td>
                          </tr>
                          {secReqs.length === 0 ? (
                            <tr data-testid={`empty-section-${slug}`}>
                              <td colSpan={5} className="text-center text-muted py-3 small fst-italic">
                                No requirements recorded in this section.
                              </td>
                            </tr>
                          ) : (
                            secReqs.map((req: AssuranceRequirement, rIdx: number) => {
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

                              return (
                                <React.Fragment key={req.id}>
                                  {Boolean(currentSubtype && isFirstOfSubtype) && (
                                    <tr className="bg-light-subtle border-bottom" data-testid={`group-subtype-${currentSubtype.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>
                                      <td colSpan={5} className="py-1.5 px-4 text-secondary small fw-semibold">
                                        <div className="d-flex align-items-center gap-2">
                                  <span style={{ fontSize: '0.75rem' }} data-testid="subtype-group-header">{currentSubtype}</span>
                                </div>
                              </td>
                            </tr>
                          )}
                          {isLinkedSubSet(req) && linkedChildSet ? (
                            <tr className="table-light" data-requirement-id={req.id}>
                              <td>
                                <div className="fw-semibold text-dark">
                                  {req.title}
                                  {req.isOtherDocument && (
                                    <span
                                      className="badge bg-secondary-subtle text-dark border ms-1.5"
                                      style={{ fontSize: '0.65rem' }}
                                      data-testid={`badge-other-doc-${req.id}`}
                                      title="Added by client"
                                    >
                                      Added by client
                                    </span>
                                  )}
                                </div>
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
                                <div className="fw-semibold text-dark">{linkedChildSet.title}</div>
                                <div className="text-muted font-mono-code small">{linkedChildSet.id}</div>
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
                          ) : isSharedRequirement ? (
                            <>
                              <tr data-requirement-id={req.id} data-testid="shared-requirement-row" className="table-row-shared">
                                <td>
                                  <div className="fw-semibold text-dark">
                                    {req.title}
                                    <span
                                      className="badge bg-secondary-subtle text-secondary border ms-1.5"
                                      style={{ fontSize: '0.65rem' }}
                                      data-testid="badge-shared-requirement"
                                      title="Requirement shared across multiple parties"
                                    >
                                      Shared ({groupTasks.length} parties)
                                    </span>
                                    {req.isOtherDocument && (
                                      <span
                                        className="badge bg-secondary-subtle text-dark border ms-1.5"
                                        style={{ fontSize: '0.65rem' }}
                                        data-testid={`badge-other-doc-${req.id}`}
                                        title="Added by client"
                                      >
                                        Added by client
                                      </span>
                                    )}
                                  </div>
                                  {renderTaskPlacement(req)}
                                  {req.description && (
                                    <div className="text-secondary small mt-0.5" style={{ fontSize: '0.78rem', lineHeight: '1.4' }}>
                                      {req.description}
                                    </div>
                                  )}
                                </td>
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
                                <td>
                                  <span className="text-muted small">—</span>
                                </td>
                                <td>
                                  {(() => {
                                    const allDone = groupTasks.every((t) => t.isFulfilled || t.verifierStatus === 'Verified' || (assuranceSet.verificationRequired === false && Boolean(t.documentId || t.linkedDocumentId)));
                                    const doneCount = groupTasks.filter((t) => t.isFulfilled || t.verifierStatus === 'Verified' || (assuranceSet.verificationRequired === false && Boolean(t.documentId || t.linkedDocumentId))).length;
                                    if (allDone) {
                                      return (
                                        <span className="badge bg-success text-white px-2.5 py-1.5" style={{ fontSize: '0.75rem' }} data-testid="shared-req-status">
                                          Verified
                                        </span>
                                      );
                                    }
                                    if (doneCount > 0) {
                                      return (
                                        <span className="badge bg-warning text-dark px-2.5 py-1.5" style={{ fontSize: '0.75rem' }} data-testid="shared-req-status">
                                          In Progress ({doneCount}/{groupTasks.length})
                                        </span>
                                      );
                                    }
                                    return (
                                      <span className="badge bg-secondary text-white px-2.5 py-1.5" style={{ fontSize: '0.75rem' }} data-testid="shared-req-status">
                                        Pending
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
                              {groupTasks.map((partyTask) => {
                                const canViewPartyDoc = isRequirementDocumentVisible(partyTask, isClientViewer, viewerPartyOrg, assuranceSet, users, setObjects);
                                const partyLinkedDoc = documents.find((d) => d.id === partyTask.documentId || (partyTask.linkedDocumentId && d.id === partyTask.linkedDocumentId));
                                const effectivePartyDoc = canViewPartyDoc ? partyLinkedDoc : undefined;
                                const partyDocView = effectivePartyDoc ? getRequirementDocumentView(assuranceSet, partyTask, effectivePartyDoc) : undefined;
                                const partyHasDoc = Boolean(effectivePartyDoc || (canViewPartyDoc && (partyTask.documentId || partyTask.linkedDocumentId)));
                                const partyOcr = partyHasDoc ? (partyTask.ocrConfidence || partyLinkedDoc?.ocrConfidence || 0) : 0;
                                const partyName = getRequirementPartyLabel(partyTask, assuranceSet, users, setObjects);

                                return (
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
                                        <div>
                                          <span className="fw-semibold text-dark small" data-testid="party-name">
                                            {partyName}
                                          </span>
                                          {renderVersionBadge(partyTask, partyDocView, canViewPartyDoc)}
                                          {partyTask.attemptNumber && (
                                            <span className="badge bg-light text-secondary border ms-1.5" style={{ fontSize: '0.65rem' }}>
                                              Attempt {partyTask.attemptNumber}
                                            </span>
                                          )}
                                          {partyTask.isOtherDocument && (
                                            <span
                                              className="badge bg-secondary-subtle text-dark border ms-1.5"
                                              style={{ fontSize: '0.65rem' }}
                                              data-testid={`badge-other-doc-${partyTask.id}`}
                                              title="Added by client"
                                            >
                                              Added by client
                                            </span>
                                          )}
                                          {partyTask.notes && canViewPartyDoc && (
                                            <div className="text-secondary small mt-0.5" style={{ fontSize: '0.72rem' }}>
                                              {partyTask.notes}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                    <td>
                                      <span className="text-muted small">—</span>
                                    </td>
                                    <td>
                                      <ConfidenceBadge score={partyOcr} />
                                    </td>
                                    <td>
                                      {renderRequirementStatus(partyTask, canViewPartyDoc)}
                                    </td>
                                    <td className="text-end">
                                      <div className="d-flex align-items-center justify-content-end gap-1.5 flex-wrap">
                                        {effectivePartyDoc && canViewPartyDoc && (
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
                                        {canUploadHere && (isClientViewer || canViewPartyDoc) && (
                                          <button
                                            type="button"
                                            className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center justify-content-center p-0"
                                            style={{ width: '32px', height: '32px' }}
                                            onClick={() => openRequirementUpload(partyTask, effectivePartyDoc)}
                                            title="Upload document"
                                            aria-label="Upload document"
                                          >
                                            <Upload size={14} />
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </>
                          ) : (
                            <tr data-requirement-id={req.id}>
                              <td>
                                <div className="fw-semibold text-dark">
                                  {req.title}
                                  {renderVersionBadge(req, docView, canViewDoc)}
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
                                  {req.isOtherDocument ? (
                                    <span
                                      className="badge bg-secondary-subtle text-dark border ms-1.5"
                                      style={{ fontSize: '0.65rem' }}
                                      data-testid={`badge-other-doc-${req.id}`}
                                      title="Added by client"
                                    >
                                      Added by client
                                    </span>
                                  ) : req.isSpecialized ? (
                                    <span className="badge bg-info-subtle text-info-emphasis border border-info-subtle ms-1.5" style={{ fontSize: '0.65rem' }}>
                                      Custom
                                    </span>
                                  ) : null}
                                </div>
                                {renderContractShortWarning(docView?.doc || effectiveLinkedDoc, canViewDoc)}
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
                              <td>
                                <ConfidenceBadge score={effectiveOcr} />
                              </td>
                              <td>
                                {renderRequirementStatus(req, canViewDoc)}
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
                                  {effectiveLinkedDoc && canViewDoc ? (
                                    <>
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
                                      {canUploadHere && (
                                        <button
                                          type="button"
                                          className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center justify-content-center p-0"
                                          style={{ width: '32px', height: '32px' }}
                                          onClick={() => openRequirementUpload(req, effectiveLinkedDoc)}
                                          disabled={Boolean(getDocumentReuploadBlockReason(effectiveLinkedDoc, notifications, new Date(), assuranceSet.charterWindowEnd))}
                                          title={getDocumentReuploadBlockReason(effectiveLinkedDoc, notifications, new Date(), assuranceSet.charterWindowEnd) || 'Upload new version'}
                                          aria-label="Upload new version"
                                        >
                                          <RefreshCw size={16} />
                                        </button>
                                      )}
                                    </>
                                  ) : canUploadHere && canViewDoc ? (
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
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <TablePagination {...requirementsPagination.controls} />
          </div>
        </div>
      )}

      {/* Tab: Tasks */}
      {activeTab === 'tasks' && (
        sectionSummaries.length > 0 ? (
          <div className="card map-card-custom">
            <div className="card-header d-flex align-items-center gap-2 p-3 bg-white">
              <span className="fw-bold text-dark">Task sections</span>
            </div>
            <div className="card-body border-top">
              <div className="small text-secondary mb-2">Open tasks and certificates in each section. Sections with three or more tasks still open are highlighted.</div>
              <TaskSectionCards set={taskSectionsSet} />
            </div>
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
        document={
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

      {/* Add Task Modal */}
      {isAddTaskModalOpen && (
        <>
          <div className="modal-backdrop fade show" />
          <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="add-task-title">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title fs-6 fw-bold text-dark" id="add-task-title">Add Task</h5>
                  <button type="button" className="btn-close" aria-label="Close" onClick={() => setIsAddTaskModalOpen(false)} />
                </div>
                <div className="modal-body d-flex flex-column gap-3">
                  {newTaskError && (
                    <div className="alert alert-danger py-2 mb-0 small">{newTaskError}</div>
                  )}
                  <div>
                    <label className="form-label text-secondary small fw-semibold" htmlFor="add-task-title-input">
                      Title <span className="text-danger">*</span>
                    </label>
                    <input
                      id="add-task-title-input"
                      type="text"
                      className="form-control form-control-sm bg-white text-dark"
                      placeholder="e.g. Field mooring arrangement"
                      value={newTaskDraft.title}
                      onChange={(e) => {
                        setNewTaskDraft({ ...newTaskDraft, title: e.target.value });
                        setNewTaskError(null);
                      }}
                    />
                  </div>
                  <div>
                    <label className="form-label text-secondary small fw-semibold" htmlFor="add-task-category">
                      Category <span className="text-danger">*</span>
                    </label>
                    <select
                      id="add-task-category"
                      className="form-select form-select-sm bg-white text-dark"
                      value={newTaskDraft.category}
                      onChange={(e) => setNewTaskDraft({ ...newTaskDraft, category: e.target.value })}
                    >
                      <option value="Statutory Certificate">Statutory Certificate</option>
                      <option value="Class Notation Certificate">Class Notation Certificate</option>
                      <option value="Flag Administration Registry">Flag Administration Registry</option>
                      <option value="Environmental Certificate">Environmental Certificate</option>
                      <option value="Safety & Lifesaving Equipment">Safety & Lifesaving Equipment</option>
                      <option value="Crew Credential">Crew Credential</option>
                      <option value="Operational Plan">Operational Plan</option>
                      <option value="Inspection Report">Inspection Report</option>
                      <option value="Equipment Register">Equipment Register</option>
                      <option value="Custom Requirement">Custom Requirement</option>
                    </select>
                  </div>
                  {assuranceSet.sections && assuranceSet.sections.length > 0 && (
                    <div>
                      <label className="form-label text-secondary small fw-semibold" htmlFor="add-task-section">
                        Section <span className="text-muted fw-normal">(optional)</span>
                      </label>
                      <select
                        id="add-task-section"
                        className="form-select form-select-sm bg-white text-dark"
                        value={newTaskDraft.sectionId}
                        onChange={(e) => setNewTaskDraft({ ...newTaskDraft, sectionId: e.target.value })}
                      >
                        <option value="">No section</option>
                        {assuranceSet.sections.filter((sec) => Boolean(sec.name?.trim())).map((sec) => (
                          <option key={sec.id} value={sec.id}>
                            {toSentenceCase(sec.name)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="form-label text-secondary small fw-semibold" htmlFor="add-task-predecessor">
                      Predecessor <span className="text-muted fw-normal">(optional)</span>
                    </label>
                    <select
                      id="add-task-predecessor"
                      className="form-select form-select-sm bg-white text-dark"
                      value={newTaskDraft.predecessorId}
                      onChange={(e) => setNewTaskDraft({ ...newTaskDraft, predecessorId: e.target.value })}
                    >
                      <option value="">No predecessor</option>
                      {assuranceSet.requirements.map((req) => (
                        <option key={req.id} value={req.id}>
                          {req.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label text-secondary small fw-semibold" htmlFor="add-task-target-date">
                      Target Date <span className="text-muted fw-normal">(optional)</span>
                    </label>
                    <input
                      id="add-task-target-date"
                      type="date"
                      className="form-control form-control-sm bg-white text-dark"
                      max={assuranceSet.targetDate || assuranceSet.complianceDeadline || undefined}
                      value={newTaskDraft.targetDate}
                      onChange={(e) => setNewTaskDraft({ ...newTaskDraft, targetDate: e.target.value })}
                    />
                    <div className="form-text" style={{ fontSize: '0.72rem' }}>
                      Must fall on or before the set target date ({formatMaritimeDate(assuranceSet.targetDate || assuranceSet.complianceDeadline)}).
                    </div>
                  </div>
                  <div>
                    <label className="form-label text-secondary small fw-semibold" htmlFor="add-task-description">
                      Description <span className="text-muted fw-normal">(optional)</span>
                    </label>
                    <textarea
                      id="add-task-description"
                      rows={2}
                      className="form-control form-control-sm bg-white text-dark"
                      placeholder="Notes or instructions for this task..."
                      value={newTaskDraft.description}
                      onChange={(e) => setNewTaskDraft({ ...newTaskDraft, description: e.target.value })}
                    />
                  </div>
                  <div className="form-check">
                    <input
                      id="add-task-mandatory"
                      type="checkbox"
                      className="form-check-input"
                      checked={newTaskDraft.isMandatory}
                      onChange={(e) => setNewTaskDraft({ ...newTaskDraft, isMandatory: e.target.checked })}
                    />
                    <label className="form-check-label text-secondary small" htmlFor="add-task-mandatory">
                      Mandatory requirement
                    </label>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setIsAddTaskModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="button" className="btn btn-sm btn-primary" onClick={handleSaveNewTask}>
                    Add Task
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Edit Task Modal */}
      {editingTask && (
        <>
          <div className="modal-backdrop fade show" />
          <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="edit-task-title">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <div>
                    <h5 className="modal-title fs-6 fw-bold text-dark" id="edit-task-title">Edit Task</h5>
                    <div className="text-muted small">ID: {editingTask.id}</div>
                  </div>
                  <button type="button" className="btn-close" aria-label="Close" onClick={() => setEditingTask(null)} />
                </div>
                <div className="modal-body d-flex flex-column gap-3">
                  {editTaskError && (
                    <div className="alert alert-danger py-2 mb-0 small">{editTaskError}</div>
                  )}
                  <div>
                    <label className="form-label text-secondary small fw-semibold" htmlFor="edit-task-title-input">
                      Title <span className="text-danger">*</span>
                    </label>
                    <input
                      id="edit-task-title-input"
                      type="text"
                      className="form-control form-control-sm bg-white text-dark"
                      value={editTaskDraft.title}
                      onChange={(e) => {
                        setEditTaskDraft({ ...editTaskDraft, title: e.target.value });
                        setEditTaskError(null);
                      }}
                    />
                  </div>
                  <div>
                    <label className="form-label text-secondary small fw-semibold" htmlFor="edit-task-category">
                      Category <span className="text-danger">*</span>
                    </label>
                    <select
                      id="edit-task-category"
                      className="form-select form-select-sm bg-white text-dark"
                      value={editTaskDraft.category}
                      onChange={(e) => setEditTaskDraft({ ...editTaskDraft, category: e.target.value })}
                    >
                      <option value="Statutory Certificate">Statutory Certificate</option>
                      <option value="Class Notation Certificate">Class Notation Certificate</option>
                      <option value="Flag Administration Registry">Flag Administration Registry</option>
                      <option value="Environmental Certificate">Environmental Certificate</option>
                      <option value="Safety & Lifesaving Equipment">Safety & Lifesaving Equipment</option>
                      <option value="Crew Credential">Crew Credential</option>
                      <option value="Operational Plan">Operational Plan</option>
                      <option value="Inspection Report">Inspection Report</option>
                      <option value="Equipment Register">Equipment Register</option>
                      <option value="Custom Requirement">Custom Requirement</option>
                      {!['Statutory Certificate', 'Class Notation Certificate', 'Flag Administration Registry', 'Environmental Certificate', 'Safety & Lifesaving Equipment', 'Crew Credential', 'Operational Plan', 'Inspection Report', 'Equipment Register', 'Custom Requirement'].includes(editTaskDraft.category) && (
                        <option value={editTaskDraft.category}>{editTaskDraft.category}</option>
                      )}
                    </select>
                  </div>
                  {assuranceSet.sections && assuranceSet.sections.length > 0 && (
                    <div>
                      <label className="form-label text-secondary small fw-semibold" htmlFor="edit-task-section">
                        Section <span className="text-muted fw-normal">(optional)</span>
                      </label>
                      <select
                        id="edit-task-section"
                        className="form-select form-select-sm bg-white text-dark"
                        value={editTaskDraft.sectionId}
                        onChange={(e) => setEditTaskDraft({ ...editTaskDraft, sectionId: e.target.value })}
                      >
                        <option value="">No section</option>
                        {assuranceSet.sections.filter((sec) => Boolean(sec.name?.trim())).map((sec) => (
                          <option key={sec.id} value={sec.id}>
                            {toSentenceCase(sec.name)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="form-label text-secondary small fw-semibold" htmlFor="edit-task-predecessor">
                      Predecessor <span className="text-muted fw-normal">(optional)</span>
                    </label>
                    <select
                      id="edit-task-predecessor"
                      className="form-select form-select-sm bg-white text-dark"
                      value={editTaskDraft.predecessorId}
                      onChange={(e) => setEditTaskDraft({ ...editTaskDraft, predecessorId: e.target.value })}
                    >
                      <option value="">No predecessor</option>
                      {assuranceSet.requirements
                        .filter((req) => req.id !== editingTask.id)
                        .map((req) => (
                          <option key={req.id} value={req.id}>
                            {req.title}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label text-secondary small fw-semibold" htmlFor="edit-task-target-date">
                      Target Date <span className="text-muted fw-normal">(optional)</span>
                    </label>
                    <input
                      id="edit-task-target-date"
                      type="date"
                      className="form-control form-control-sm bg-white text-dark"
                      max={assuranceSet.targetDate || assuranceSet.complianceDeadline || undefined}
                      value={editTaskDraft.targetDate}
                      onChange={(e) => setEditTaskDraft({ ...editTaskDraft, targetDate: e.target.value })}
                    />
                    <div className="form-text" style={{ fontSize: '0.72rem' }}>
                      Must fall on or before the set target date ({formatMaritimeDate(assuranceSet.targetDate || assuranceSet.complianceDeadline)}).
                    </div>
                  </div>
                  <div>
                    <label className="form-label text-secondary small fw-semibold" htmlFor="edit-task-description">
                      Description <span className="text-muted fw-normal">(optional)</span>
                    </label>
                    <textarea
                      id="edit-task-description"
                      rows={2}
                      className="form-control form-control-sm bg-white text-dark"
                      value={editTaskDraft.description}
                      onChange={(e) => setEditTaskDraft({ ...editTaskDraft, description: e.target.value })}
                    />
                  </div>
                  <div className="form-check">
                    <input
                      id="edit-task-mandatory"
                      type="checkbox"
                      className="form-check-input"
                      checked={editTaskDraft.isMandatory}
                      onChange={(e) => setEditTaskDraft({ ...editTaskDraft, isMandatory: e.target.checked })}
                    />
                    <label className="form-check-label text-secondary small" htmlFor="edit-task-mandatory">
                      Mandatory requirement
                    </label>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setEditingTask(null)}>
                    Cancel
                  </button>
                  <button type="button" className="btn btn-sm btn-primary" onClick={handleSaveEditTask}>
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Remove Task Confirmation Modal */}
      {taskToDelete && (
        <>
          <div className="modal-backdrop fade show" />
          <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="remove-task-title">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title fs-6 fw-bold text-danger" id="remove-task-title">Remove Task</h5>
                  <button type="button" className="btn-close" aria-label="Close" onClick={() => setTaskToDelete(null)} />
                </div>
                <div className="modal-body">
                  <p className="mb-0 text-dark small">
                    Are you sure you want to remove <strong>{taskToDelete.title}</strong> from this assurance set?
                  </p>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setTaskToDelete(null)}>
                    Cancel
                  </button>
                  <button type="button" className="btn btn-sm btn-danger text-white" onClick={handleConfirmDeleteTask}>
                    Remove Task
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
