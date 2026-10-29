/* 
  file summary: segmented assurance set creation wizard matching enterprise design standards (similar to VesselModal).
  responsibilities: captures the one scope the set covers (Vessel, Crew or Equipment; Activity is switched off for now) with the tab of that scope, optional project link, general information, subtype statutory & operational documents with descriptions, public/organization templates, specialized custom requirements, workflow policies, and role assignments.
  role in system: rendered by App.tsx when currentHashView is 'create-assurance-set'.
*/

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useMapStore } from '../store/useMapStore';
import {
  AssuranceSet,
  AssuranceTemplate,
  AssuranceRequirement,
  AssuranceSubtype,
  ReviewMode,
  ReviewChannel,
  AuthorityValidationMethod,
  AssuranceRequirementCategory,
  AssuranceObject,
  AssuranceObjectType,
} from '../types/assurance';
import { UserProfile } from '../types/user';
import { CrewMember } from '../types/crew';
import {
  filterCAdminAvailableToCharter,
  getClientAdminOrganization,
  orgFieldMatches,
} from '../utils/rbacHelpers';
import {
  usersWithRole,
  userHasRole,
  getEligibleVerifiers,
  getServiceProviderSubmitterCandidates,
  filterEligibleVerifiersForScope,
  filterEligibleApproversForScope,
  filterCandidatesByReviewMode,
  getAssuranceAssignmentWarnings,
  hasBlockingAssuranceAssignmentConflict,
  getReviewChannelForUser,
} from '../utils/userRoleHelpers';
import { isDuplicateCampaignTitle, generateUniqueAssuranceSetId, generateUniqueRequirementId, validateComplianceDeadline, validateTaskTargetDate, TASK_DATE_AFTER_SET_DATE } from '../utils/validation';
import {
  SUBTYPE_STANDARD_DOCS,
  SUBTYPE_TEMPLATES,
  SUBTYPE_CATEGORIES,
  StandardSubtypeDocument,
  SubtypeTemplate,
  EXISTING_ACTIVITIES,
  THREE_PILLARS_CONFIG,
  ASSURANCE_SCOPE_OPTIONS,
  orderAssuranceScopes,
  getPrimaryAssuranceScope,
  getAssuranceSetScopes,
  getAssuranceSetScopeType,
  getAssuranceSetCrewIds,
  buildAssuranceWizardSteps,
  customRequirementFields,
  getThreePillarsCategory,
  vesselToAssuranceObject,
  crewToAssuranceObject,
  equipmentToAssuranceObject,
  SEEDED_OPERATIONAL_OBJECTS,
  getAssuranceSetObjects,
  getAssuranceObjectScope,
  placeTasksInSections,
} from '../utils/assuranceTemplates';
import {
  autoAttachDocumentsToRequirements,
} from '../utils/documentMatchingHelpers';
import {
  findOverlappingAssuranceSets,
  formatOverlapError,
  getDefaultNonConflictingContractPeriod,
  getAssetPeriodConflicts,
  isAssetAvailableForPeriod,
  type ContractPeriodConflict,
} from '../utils/assuranceOverlap';
import { formatMaritimeDate } from '../utils/formatters';
import { filterProjectsForPersona, projectToAssuranceProjectScope, setOrganizationParties, withProjectVessels } from '../utils/projectHelpers';
import { resolveAssuranceRequestContext, resolveAssuranceRequestSetClient, resolveRequestedServiceProviderOrg } from '../utils/notificationHelpers';
import { Plus, ChevronDown, ShieldCheck, FileCheck, ExternalLink, Globe, Building2, Ship, Users, Wrench, Activity, Sparkles, CheckCircle2, Trash2, AlertCircle } from 'lucide-react';
import { calculateAssuranceSetReadiness } from '../utils/readinessHelpers';
import { SearchableSelect, SearchableSelectItem } from '../components/common/SearchableSelect';

interface SpecializedDoc {
  id: string;
  subtype: AssuranceSubtype;
  title: string;
  category: AssuranceRequirementCategory;
  description: string;
  isMandatory: boolean;
  isEnabled: boolean;
  templateId?: string;
  /** null omits the subtype so People and Process keep their pillar on a Vessel set */
  requirementSubtype?: AssuranceSubtype | null;
  targetObjectId?: string;
  targetDate?: string;
}

interface CreateAssuranceSetViewProps {
  templateSetId?: string;
}

export const CreateAssuranceSetView: React.FC<CreateAssuranceSetViewProps> = ({ templateSetId }) => {
  const {
    vessels,
    equipment,
    crew,
    documents,
    assuranceSets,
    assuranceTemplates = [],
    assuranceObjects: storeAssuranceObjects = [],
    registerAssuranceObject,
    addAssuranceSet,
    addAssuranceTemplate,
    updateAssuranceSet,
    activePersona,
    setCurrentHashView,
    previousHashView,
    createAssuranceForVesselId,
    setCreateAssuranceForVesselId,
    createAssuranceForAsset,
    setCreateAssuranceForAsset,
    attachAssuranceSetToProject,
    projects,
    returnToProjectId,
    setReturnToProjectId,
    lockedProjectId: storeLockedProjectId,
    setLockedProjectId,
    users,
    activeSessionUserId,
    notifications,
    pendingAssuranceRequestNotificationId,
    activeDemoOrganization,
  } = useMapStore();

  const clientOrgHint = activePersona === 'C Admin' ? activeDemoOrganization : undefined;

  /* projects the active persona can see, offered as an optional link for any scope */
  const availableProjectOptions = useMemo(
    () =>
      filterProjectsForPersona(
        projects,
        activePersona,
        users,
        assuranceSets,
        clientOrgHint,
      ).map(projectToAssuranceProjectScope),
    [projects, activePersona, users, assuranceSets, clientOrgHint],
  );

  /* project the wizard was opened from, or the project named on the invitation */
  const [lockedProjectId] = useState<string | undefined>(() => {
    const fromNotification = notifications.find(
      (n) => n.id === pendingAssuranceRequestNotificationId && n.status !== 'actioned',
    )?.projectId;
    const candidate = storeLockedProjectId || returnToProjectId || fromNotification;
    return candidate && projects.some((p) => p.id === candidate)
      ? candidate
      : undefined;
  });
  const isProjectLocked = Boolean(lockedProjectId);

  /* assurance set request the wizard was opened from; captured once so the set keeps its client and assigned creator */
  const [requestContext] = useState(() =>
    resolveAssuranceRequestContext(
      notifications.find(
        (n) => n.id === pendingAssuranceRequestNotificationId && n.status !== 'actioned',
      ),
      projects,
      users,
    ),
  );
  const requestedScopes = requestContext?.notification.request?.suggestedScopes;
  const requestedScope =
    requestedScopes?.length === 1
      ? requestedScopes[0]
      : requestContext?.notification.request?.suggestedScope;
  const suggestedAsset =
    requestContext?.notification.request?.suggestedAssets?.length === 1
      ? requestContext.notification.request.suggestedAssets[0]
      : undefined;

  /* scope and asset handed over by a charter action; captured once so the store value can be cleared */
  const [lockedAsset] = useState(() => {
    if (!createAssuranceForAsset) return undefined;
    const { scope, assetId } = createAssuranceForAsset;
    const exists =
      scope === 'Vessel'
        ? vessels.some((v) => v.id === assetId)
        : scope === 'Crew'
          ? crew.some((c) => c.id === assetId)
          : equipment.some((e) => e.id === assetId);
    return exists ? createAssuranceForAsset : undefined;
  });

  useEffect(() => {
    if (createAssuranceForAsset) {
      setCreateAssuranceForAsset(undefined);
    }
  }, [createAssuranceForAsset, setCreateAssuranceForAsset]);

  useEffect(() => {
    if (returnToProjectId) {
      setReturnToProjectId(undefined);
    }
    if (storeLockedProjectId) {
      setLockedProjectId(undefined);
    }
  }, [
    returnToProjectId,
    setReturnToProjectId,
    storeLockedProjectId,
    setLockedProjectId,
  ]);

  const isClientAdmin = activePersona === 'C Admin';
  /* user recorded as the creator of sets made in this session; a request names its own creator */
  const creatorName =
    requestContext?.assigneeName ||
    users.find((u) => u.id === activeSessionUserId)?.name ||
    users.find((u) => u.roles.includes(activePersona) && u.organization === activeDemoOrganization)?.name;
  const clientOrg = getClientAdminOrganization(users, clientOrgHint);

  const availableVessels = filterCAdminAvailableToCharter(vessels, assuranceSets, clientOrg);

  const defaultCharterer = clientOrg;
  /* an invited organization creating from a request is the client; other requests keep the project client */
  const setClientOrg = resolveAssuranceRequestSetClient(defaultCharterer, requestContext);
  const titleOrg = setClientOrg;
  const lockedVessel = createAssuranceForVesselId
    ? availableVessels.find((v) => v.id === createAssuranceForVesselId)
    : undefined;
  const suggestedVessel =
    suggestedAsset?.assetType === 'Vessel'
      ? availableVessels.find((v) => v.id === suggestedAsset.assetId)
      : undefined;
  const initialVesselId = lockedVessel?.id || suggestedVessel?.id || availableVessels[0]?.id || '';
  const initialVesselName = lockedVessel?.name || availableVessels[0]?.name || 'Vessel';
  /* a vessel hand-off only locks when that vessel is one this persona may charter */
  const isScopeLocked = Boolean(lockedAsset) && (lockedAsset?.scope !== 'Vessel' || Boolean(lockedVessel));
  const initialSubjectName =
    lockedAsset?.scope === 'Crew'
      ? crew.find((c) => c.id === lockedAsset.assetId)?.fullName || initialVesselName
      : lockedAsset?.scope === 'Equipment'
        ? equipment.find((e) => e.id === lockedAsset.assetId)?.name || initialVesselName
        : suggestedAsset?.assetType === 'Crew'
          ? crew.find((c) => c.id === suggestedAsset.assetId)?.fullName || initialVesselName
          : suggestedAsset?.assetType === 'Equipment'
            ? equipment.find((e) => e.id === suggestedAsset.assetId)?.name || initialVesselName
            : !lockedAsset && requestedScope === 'Crew'
              ? crew[0]?.fullName || initialVesselName
              : !lockedAsset && requestedScope === 'Equipment'
                ? equipment[0]?.name || initialVesselName
                : initialVesselName;

  /* Wizard Step State */
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [errorMessage, setErrorMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [editingDraftId, setEditingDraftId] = useState<string | undefined>(undefined);

  /* Step 1: Scope & General Information */
  const [title, setTitle] = useState(
    () => `${titleOrg} - ${initialSubjectName} Assurance Set`,
  );
  const [selectedProjectId, setSelectedProjectId] = useState<string>(lockedProjectId || '');
  /* Covered Assurance Objects (ADR 0029): the only place the set's vessels, crew, equipment and other objects are chosen; every object is equal */
  const [selectedAssuranceObjects, setSelectedAssuranceObjects] = useState<AssuranceObject[]>(() => {
    const handedOff = lockedAsset
      ? { scope: lockedAsset.scope, id: lockedAsset.assetId }
      : suggestedAsset
        ? { scope: suggestedAsset.assetType, id: suggestedAsset.assetId }
        : undefined;
    /* a request that names a scope but no asset starts with the first asset of that scope, as the scope picker did */
    const requestedPrimaryScope =
      requestedScopes && requestedScopes.length > 0 ? getPrimaryAssuranceScope(requestedScopes) : requestedScope;
    const start = handedOff || (requestedPrimaryScope === 'Crew'
      ? { scope: 'Crew' as AssuranceSubtype, id: crew[0]?.id || '' }
      : requestedPrimaryScope === 'Equipment'
        ? { scope: 'Equipment' as AssuranceSubtype, id: equipment[0]?.id || '' }
        : { scope: 'Vessel' as AssuranceSubtype, id: initialVesselId });
    if (start.scope === 'Vessel') {
      const v = vessels.find((x) => x.id === start.id);
      return v ? [vesselToAssuranceObject(v)] : [];
    }
    if (start.scope === 'Crew') {
      const c = crew.find((x) => x.id === start.id);
      return c ? [crewToAssuranceObject(c)] : [];
    }
    if (start.scope === 'Equipment') {
      const e = equipment.find((x) => x.id === start.id);
      return e ? [equipmentToAssuranceObject(e)] : [];
    }
    return [];
  });
  const [newObjectType, setNewObjectType] = useState<AssuranceObjectType>('vessel');
  const [newObjectId, setNewObjectId] = useState<string>('');
  /* the single-asset fields read from the object rows; they stay on the saved set for older views (ADR 0029) */
  const vesselId = selectedAssuranceObjects.find((o) => o.type === 'vessel')?.id || '';
  const selectedCrewIds = selectedAssuranceObjects.filter((o) => o.type === 'person').map((o) => o.id);
  const selectedCrewId = selectedCrewIds[0] || '';
  const selectedEquipmentId = selectedAssuranceObjects.find((o) => o.type === 'equipment')?.id || '';
  /* asset types the objects cover, in the offered order; each one gets a section on the Requirements tab */
  const selectedScopes = useMemo(
    () =>
      orderAssuranceScopes(
        selectedAssuranceObjects
          .map((o) => getAssuranceObjectScope(o.type))
          .filter((scope): scope is AssuranceSubtype => Boolean(scope)),
      ),
    [selectedAssuranceObjects],
  );
  /* scope the set is filed under for older views; it is not a choice in the wizard */
  const assuranceType = getPrimaryAssuranceScope(selectedScopes);
  /* an asset handed over by a listing or a vessel page stays in the set */
  const lockedObjectIds: string[] = [
    ...(isScopeLocked && lockedAsset ? [lockedAsset.assetId] : []),
    ...(lockedVessel ? [lockedVessel.id] : []),
  ];
  /* replaces the rows of one object type; vessels lead the list, other types follow */
  const replaceCoveredObjects = (type: AssuranceObjectType, next: AssuranceObject[]) =>
    setSelectedAssuranceObjects((prev) => {
      const rest = prev.filter((o) => o.type !== type || lockedObjectIds.includes(o.id));
      const added = next.filter((o) => !rest.some((r) => r.id === o.id));
      return type === 'vessel' ? [...added, ...rest] : [...rest, ...added];
    });
  const setVesselId = (id: string) => {
    const v = vessels.find((x) => x.id === id);
    replaceCoveredObjects('vessel', v ? [vesselToAssuranceObject(v)] : []);
  };
  const setSelectedCrewIds = (ids: string[]) =>
    replaceCoveredObjects(
      'person',
      ids
        .map((id) => crew.find((c) => c.id === id))
        .filter((c): c is CrewMember => Boolean(c))
        .map(crewToAssuranceObject),
    );
  const setSelectedEquipmentId = (id: string) => {
    const e = equipment.find((x) => x.id === id);
    replaceCoveredObjects('equipment', e ? [equipmentToAssuranceObject(e)] : []);
  };
  const [selectedActivityId, setSelectedActivityId] = useState<string>(() => EXISTING_ACTIVITIES[0]?.id || '');
  const [templatePrivacy, setTemplatePrivacy] = useState<'organization' | 'public'>('organization');
  const [showCancelPrompt, setShowCancelPrompt] = useState<boolean>(false);
  const [isGeneralInfoExpanded, setIsGeneralInfoExpanded] = useState<boolean>(true);
  const charterer = setClientOrg;
  /* a handed-off asset gets a default period after its own contracts only; otherwise after every contract */
  const handedOffScope = lockedAsset?.scope || suggestedAsset?.assetType;
  const handedOffAssetId = lockedAsset?.assetId || suggestedAsset?.assetId || '';
  const initialPeriod = useMemo(
    () =>
      getDefaultNonConflictingContractPeriod(
        assuranceSets,
        handedOffScope && handedOffAssetId
          ? {
            scope: handedOffScope,
            vesselId: handedOffScope === 'Vessel' ? handedOffAssetId : undefined,
            crewIds: handedOffScope === 'Crew' ? [handedOffAssetId] : undefined,
            equipmentId: handedOffScope === 'Equipment' ? handedOffAssetId : undefined,
          }
          : undefined,
      ),
    [assuranceSets, handedOffScope, handedOffAssetId],
  );
  const [startDate, setStartDate] = useState(() => initialPeriod.start);
  const [endDate, setEndDate] = useState(() => initialPeriod.end);
  const [complianceDeadline, setComplianceDeadline] = useState(() => initialPeriod.start);
  const isVesselLocked = Boolean(lockedVessel);

  useEffect(() => {
    if (createAssuranceForVesselId && !lockedVessel) {
      setCreateAssuranceForVesselId(undefined);
    }
  }, [createAssuranceForVesselId, lockedVessel, setCreateAssuranceForVesselId]);

  /* Global template selector from existing assurance sets (optional) */
  const [selectedGlobalTemplateId, setSelectedGlobalTemplateId] = useState<string>(templateSetId || '');

  /* Workflow requirements state */
  const [verificationRequired, setVerificationRequired] = useState(true);
  const [inspectionRequired, setInspectionRequired] = useState(true);
  const [approvalRequired, setApprovalRequired] = useState(true);

  /* Review & Verification Channel Governance (MVP 1.5) */
  const [reviewMode, setReviewMode] = useState<ReviewMode>('internal');
  const [validityCheckRequired, setValidityCheckRequired] = useState<boolean>(true);
  const [suitabilityCheckRequired, setSuitabilityCheckRequired] = useState<boolean>(true);
  const [authorityValidationMethod, setAuthorityValidationMethod] = useState<AuthorityValidationMethod>('api');

  /* a project set can use the project's vessels even when those vessels already have another set */
  const vesselChoices = withProjectVessels(
    availableVessels,
    vessels,
    projects.find((project) => project.id === (selectedProjectId || lockedProjectId)),
  );
  const availableObjectsForType = useMemo<AssuranceObject[]>(() => {
    let list: AssuranceObject[] = [];
    switch (newObjectType) {
      case 'vessel':
        list = vesselChoices.map(vesselToAssuranceObject);
        break;
      case 'person':
        list = crew.map(crewToAssuranceObject);
        break;
      case 'equipment':
        list = equipment.map(equipmentToAssuranceObject);
        break;
      case 'procedure':
        list = [
          ...storeAssuranceObjects.filter((o) => o.type === 'procedure'),
          ...SEEDED_OPERATIONAL_OBJECTS.filter((o) => o.type === 'procedure'),
        ];
        break;
      case 'method':
        list = [
          ...storeAssuranceObjects.filter((o) => o.type === 'method'),
          ...SEEDED_OPERATIONAL_OBJECTS.filter((o) => o.type === 'method'),
        ];
        break;
      case 'document':
        list = [
          ...storeAssuranceObjects.filter((o) => o.type === 'document'),
          ...SEEDED_OPERATIONAL_OBJECTS.filter((o) => o.type === 'document'),
        ];
        break;
      case 'organization':
        list = [
          ...storeAssuranceObjects.filter((o) => o.type === 'organization'),
          ...SEEDED_OPERATIONAL_OBJECTS.filter((o) => o.type === 'organization'),
        ];
        break;
      default:
        list = [];
    }
    return Array.from(new Map(list.map((o) => [o.id, o])).values());
  }, [newObjectType, vesselChoices, crew, equipment, storeAssuranceObjects]);

  const selectedVesselForScope = vesselChoices.find((v) => v.id === vesselId) || vesselChoices[0];
  const selectedEquipmentForScope = equipment.find((e) => e.id === selectedEquipmentId);
  const selectedCrewForScope = crew.find((c) => c.id === selectedCrewId);
  const selectedActivityForScope = EXISTING_ACTIVITIES.find((a) => a.id === selectedActivityId);

  /* owner of the asset the set names; a bunker supplier can be a different organization */
  const assetProviderOrg =
    assuranceType === 'Vessel'
      ? (selectedVesselForScope?.registeredOwner || selectedVesselForScope?.ismCompany || 'Northwind Marine Pty Ltd')
      : assuranceType === 'Equipment'
        ? (selectedEquipmentForScope?.owningOrganization || selectedEquipmentForScope?.manufacturer || 'Subsea Equipment Provider')
        : assuranceType === 'Crew'
          ? (selectedCrewForScope?.organization || 'Global Maritime Crewing')
          : assuranceType === 'Activity'
            ? (selectedActivityForScope?.category || 'Deepwater Marine Services')
            : (selectedVesselForScope?.registeredOwner || 'Northwind Marine Pty Ltd');

  /* a request from another organization makes that requester the service provider, so the submitter is theirs */
  const serviceProviderOrg = resolveRequestedServiceProviderOrg(
    requestContext,
    setClientOrg,
    assetProviderOrg,
  );
  const vesselOwnerOrg = serviceProviderOrg;

  const submitterCandidates = useMemo(
    () => getServiceProviderSubmitterCandidates(users, serviceProviderOrg),
    [users, serviceProviderOrg],
  );
  const [assignedSubmitterId, setAssignedSubmitterId] = useState(
    () => getServiceProviderSubmitterCandidates(users, serviceProviderOrg)[0]?.id || '',
  );
  const selectedSubmitterForProvider = users.find((user) => user.id === assignedSubmitterId);
  const appointedProviderOrg = selectedSubmitterForProvider?.organization || serviceProviderOrg;
  /* keep the existing review lists; only the chosen supplier is kept off verifier and approver */
  const isInternalDeployment = true;
  const excludeAppointedProvider = (user: UserProfile) =>
    !selectedSubmitterForProvider ||
    !user.organization?.toLowerCase().includes(appointedProviderOrg.toLowerCase());

  /* Dynamic Stakeholder candidate lists strictly enforcing Review Channel Governance & Segregation of Duties */
  const verifierCandidates = filterCandidatesByReviewMode(users, reviewMode, 'Verifier', {
    clientOrg,
    serviceProviderOrg,
    internalDeployment: isInternalDeployment,
  }).filter(excludeAppointedProvider);
  const approverCandidates = filterCandidatesByReviewMode(users, reviewMode, 'Approver', {
    clientOrg,
    serviceProviderOrg,
    internalDeployment: isInternalDeployment,
  }).filter(excludeAppointedProvider);
  const inspectorCandidates = usersWithRole(users, 'Inspector');

  /* Intelligent verifier defaults per category */
  const defaultSubtypeVerifiers: Record<AssuranceSubtype, string> = {
    Vessel: verifierCandidates[0]?.id || '',
    Crew: verifierCandidates[1]?.id || verifierCandidates[0]?.id || '',
    Activity: verifierCandidates[2]?.id || verifierCandidates[0]?.id || '',
    Equipment: verifierCandidates[0]?.id || '',
  };

  const [assignedSubtypeStakeholders, setAssignedSubtypeStakeholders] = useState<Record<AssuranceSubtype, { verifierId: string }>>({
    Vessel: { verifierId: defaultSubtypeVerifiers.Vessel },
    Crew: { verifierId: defaultSubtypeVerifiers.Crew },
    Activity: { verifierId: defaultSubtypeVerifiers.Activity },
    Equipment: { verifierId: defaultSubtypeVerifiers.Equipment },
  });

  const [assignedVerifier, setAssignedVerifier] = useState(
    reviewMode === 'issuing_authority' ? 'api-authority' : (verifierCandidates[0]?.id || '')
  );
  const [assignedInspector, setAssignedInspector] = useState(inspectorCandidates[0]?.id || '');
  const [assignedApprover, setAssignedApprover] = useState(approverCandidates[0]?.id || '');
  const [isApproverSameAsVerifier, setIsApproverSameAsVerifier] = useState<boolean>(false);

  useEffect(() => {
    setAssignedSubmitterId((current) =>
      submitterCandidates.some((user) => user.id === current)
        ? current
        : submitterCandidates[0]?.id || '',
    );
  }, [submitterCandidates]);

  useEffect(() => {
    if (!assignedSubmitterId || reviewMode === 'issuing_authority') return;
    if (!verifierCandidates.some((user) => user.id === assignedVerifier)) {
      setAssignedVerifier(verifierCandidates[0]?.id || '');
    }
    if (!approverCandidates.some((user) => user.id === assignedApprover)) {
      setAssignedApprover(approverCandidates[0]?.id || '');
    }
  }, [assignedSubmitterId, appointedProviderOrg, reviewMode, assignedVerifier, assignedApprover, verifierCandidates, approverCandidates]);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  /* Ensure selected verifier is available in approver list when dual-role/same-as-verifier is active */
  const effectiveApproverCandidates = React.useMemo(() => {
    const list = [...approverCandidates];
    const currentVerifierUser = users.find((u) => u.id === assignedVerifier);
    if (
      currentVerifierUser &&
      reviewMode !== 'issuing_authority' &&
      !list.some((u) => u.id === currentVerifierUser.id)
    ) {
      const isRestricted = Boolean(
        !isInternalDeployment &&
        serviceProviderOrg &&
        currentVerifierUser.organization?.toLowerCase().includes(serviceProviderOrg.toLowerCase())
      );
      if (!isRestricted) {
        list.unshift(currentVerifierUser);
      }
    }
    return list;
  }, [approverCandidates, users, assignedVerifier, reviewMode, serviceProviderOrg, isInternalDeployment]);

  const handleReviewModeChange = (newMode: ReviewMode) => {
    setReviewMode(newMode);

    const newVerifiers = filterCandidatesByReviewMode(users, newMode, 'Verifier', {
      clientOrg,
      serviceProviderOrg,
      internalDeployment: isInternalDeployment,
    }).filter(excludeAppointedProvider);
    const newApprovers = filterCandidatesByReviewMode(users, newMode, 'Approver', {
      clientOrg,
      serviceProviderOrg,
      internalDeployment: isInternalDeployment,
    }).filter(excludeAppointedProvider);

    if (newMode === 'issuing_authority') {
      setAssignedVerifier('api-authority');
      setIsApproverSameAsVerifier(false);
      if (!newApprovers.some((u) => u.id === assignedApprover)) {
        setAssignedApprover(newApprovers[0]?.id || '');
      }
    } else {
      if (assignedVerifier === 'api-authority' || !newVerifiers.some((u) => u.id === assignedVerifier)) {
        const fallbackVerifier = newVerifiers[0]?.id || '';
        setAssignedVerifier(fallbackVerifier);
        if (isApproverSameAsVerifier) {
          setAssignedApprover(fallbackVerifier);
        }
      }
      if (!isApproverSameAsVerifier && !newApprovers.some((u) => u.id === assignedApprover)) {
        setAssignedApprover(newApprovers[0]?.id || '');
      }
    }

    setFieldErrors((prev) => {
      const u = { ...prev };
      delete u.verifier;
      delete u.approver;
      return u;
    });
  };

  const handleVerifierChange = (newVerifierId: string) => {
    setAssignedVerifier(newVerifierId);
    if (isApproverSameAsVerifier) {
      setAssignedApprover(newVerifierId);
    }
    setFieldErrors((prev) => {
      const u = { ...prev };
      delete u.verifier;
      if (isApproverSameAsVerifier) delete u.approver;
      return u;
    });
  };

  const handleToggleSameAsVerifier = (checked: boolean) => {
    setIsApproverSameAsVerifier(checked);
    if (checked) {
      setAssignedApprover(assignedVerifier);
      setFieldErrors((prev) => {
        const u = { ...prev };
        delete u.approver;
        return u;
      });
    }
  };

  /* Autofill shimmer animation */
  const [animatingFields, setAnimatingFields] = useState<Set<string>>(new Set());

  const triggerAutofillAnimation = useCallback((fieldIds: string[]) => {
    setAnimatingFields(new Set(fieldIds));
    setTimeout(() => setAnimatingFields(new Set()), 750);
  }, []);

  /* Subtype Standard Documents Toggle Map: { [docId]: boolean } */
  const [docToggles, setDocToggles] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    Object.values(SUBTYPE_STANDARD_DOCS).forEach((docList) => {
      docList.forEach((d) => {
        initial[d.id] = d.defaultEnabled;
      });
    });
    return initial;
  });

  /* Subtype Standard Documents Required Map: { [docId]: boolean } */
  const [docRequired, setDocRequired] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    Object.values(SUBTYPE_STANDARD_DOCS).forEach((docList) => {
      docList.forEach((d) => {
        initial[d.id] = d.isMandatory;
      });
    });
    return initial;
  });

  /* Selected Templates per Subtype: { [subtype]: templateId } */
  const [selectedSubtypeTemplates, setSelectedSubtypeTemplates] = useState<Record<string, string>>({
    Vessel: '',
    Crew: '',
    Activity: '',
    Equipment: '',
  });

  /* Specialized Custom Documents added by the user */
  const [specializedDocs, setSpecializedDocs] = useState<SpecializedDoc[]>([]);

  /* Wizard tabs: General, Objects, Requirements, Review */
  const steps = buildAssuranceWizardSteps();
  const totalSteps = steps.length;

  /* Adjust current step if a scope change makes current step out of bounds */
  useEffect(() => {
    if (currentStep > totalSteps) {
      setCurrentStep(totalSteps);
    }
  }, [totalSteps, currentStep]);

  /* one asset of a template's scope as the object list: the preferred one when it can be picked, else the first; a template names a scope, not always an asset */
  const getTemplateObjects = (scope: AssuranceSubtype, preferredId?: string): AssuranceObject[] => {
    if (scope === 'Vessel') {
      const v = vesselChoices.find((x) => x.id === preferredId) || vesselChoices[0];
      return v ? [vesselToAssuranceObject(v)] : [];
    }
    if (scope === 'Crew') {
      const c = crew.find((x) => x.id === preferredId) || crew[0];
      return c ? [crewToAssuranceObject(c)] : [];
    }
    if (scope === 'Equipment') {
      const e = equipment.find((x) => x.id === preferredId) || equipment[0];
      return e ? [equipmentToAssuranceObject(e)] : [];
    }
    return [];
  };
  /* a hand-off from a listing or a vessel page keeps its asset; a template does not replace it */
  const canTemplateReplaceObjects = !lockedAsset && !lockedVessel;

  /* Handle global existing assurance set template selection */
  const applyGlobalTemplateData = (targetSet: AssuranceSet) => {
    /* a template filed under a scope that is no longer offered leaves the objects as they are */
    const templateScope =
      orderAssuranceScopes(targetSet.assuranceType ? [targetSet.assuranceType] : [])[0] ||
      (targetSet.vesselId && !targetSet.assuranceType ? 'Vessel' : undefined);
    if (canTemplateReplaceObjects && templateScope) {
      const preferredId =
        templateScope === 'Vessel' ? targetSet.vesselId : templateScope === 'Crew' ? targetSet.crewId : targetSet.equipmentId;
      const templateObjects = getTemplateObjects(templateScope, preferredId);
      if (templateObjects.length > 0) setSelectedAssuranceObjects(templateObjects);
    }
    if (targetSet.charterWindowStart) setStartDate(targetSet.charterWindowStart);
    if (targetSet.charterWindowEnd) setEndDate(targetSet.charterWindowEnd);
    setComplianceDeadline(targetSet.complianceDeadline || targetSet.charterWindowStart || '');
    setVerificationRequired(targetSet.verificationRequired !== undefined ? targetSet.verificationRequired : Boolean(targetSet.assignedVerifier));
    setInspectionRequired(targetSet.mandatoryInspectionRequired);
    setApprovalRequired(targetSet.formalApprovalRequired !== undefined ? targetSet.formalApprovalRequired : Boolean(targetSet.assignedApprover));

    const templateCharterer = defaultCharterer;

    const targetVesselObj = lockedVessel
      || vesselChoices.find((v) => v.id === targetSet.vesselId)
      || vesselChoices[0];
    const vesselDisplayName = targetSet.vesselName || targetVesselObj?.name || 'Vessel';

    const baseSubject = targetSet.title
      .replace(new RegExp(`^${templateCharterer}\\s*[-–:]*\\s*`, 'i'), '')
      .replace(/^Chevron Australia( Pty Ltd)?\s*[-–:]*\s*/i, '')
      .replace(/^Northwind Marine( Pty Ltd)?\s*[-–:]*\s*/i, '')
      .replace(/^Woodside Energy( Ltd)?\s*[-–:]*\s*/i, '')
      .replace(/^Inpex( Operations Australia)?\s*[-–:]*\s*/i, '')
      .trim();

    const cleanSubject = baseSubject || `${vesselDisplayName} Assurance Set`;
    setTitle(`${templateCharterer} - ${cleanSubject}`);

    /* match requirements */
    const updatedToggles: Record<string, boolean> = { ...docToggles };
    Object.values(SUBTYPE_STANDARD_DOCS).flat().forEach((doc) => {
      const isMatched = targetSet.requirements.some(
        (r) =>
          r.title.toLowerCase().includes(doc.title.toLowerCase()) ||
          doc.title.toLowerCase().includes(r.title.toLowerCase())
      );
      if (isMatched) {
        updatedToggles[doc.id] = true;
      }
    });
    setDocToggles(updatedToggles);

    triggerAutofillAnimation(['grid-campaign-title', 'grid-target-vessel', 'grid-charter-start', 'grid-charter-end']);
  };

  useEffect(() => {
    if (templateSetId) {
      setSelectedGlobalTemplateId(templateSetId);
      const publicTmpl = (assuranceTemplates || []).find((t) => t.id === templateSetId);
      const target = assuranceSets.find((s) => s.id === templateSetId);

      if (publicTmpl) {
        // Pre-fill from public generalized AssuranceTemplate (no specific asset bindings)
        const templateScope = publicTmpl.scope || publicTmpl.assuranceType || 'Vessel';
        if (canTemplateReplaceObjects && ASSURANCE_SCOPE_OPTIONS.includes(templateScope)) {
          const templateObjects = getTemplateObjects(templateScope);
          if (templateObjects.length > 0) setSelectedAssuranceObjects(templateObjects);
        }
        setTitle(`${defaultCharterer} - ${publicTmpl.scopeType || initialSubjectName} Assurance Set`);
        setTemplatePrivacy('organization');
        setVerificationRequired(publicTmpl.verificationRequired ?? true);
        setInspectionRequired(publicTmpl.mandatoryInspectionRequired ?? true);
        setApprovalRequired(publicTmpl.formalApprovalRequired ?? true);
        if (publicTmpl.reviewMode) setReviewMode(publicTmpl.reviewMode);

        const updatedToggles: Record<string, boolean> = {};
        const updatedRequired: Record<string, boolean> = {};
        Object.values(SUBTYPE_STANDARD_DOCS).flat().forEach((doc) => {
          const matched = publicTmpl.requirements.find(
            (r) => r.title.toLowerCase().includes(doc.title.toLowerCase()) || doc.title.toLowerCase().includes(r.title.toLowerCase()),
          );
          if (matched) {
            updatedToggles[doc.id] = true;
            updatedRequired[doc.id] = matched.isMandatory;
          }
        });
        setDocToggles((prev) => ({ ...prev, ...updatedToggles }));
        setDocRequired((prev) => ({ ...prev, ...updatedRequired }));

        const customReqs: SpecializedDoc[] = publicTmpl.requirements
          .filter((r) => !Object.values(SUBTYPE_STANDARD_DOCS).flat().some((d) => d.title.toLowerCase() === r.title.toLowerCase()))
          .map((r, idx) => ({
            id: `template-spec-${idx}-${Date.now()}`,
            subtype: (r.subtype as AssuranceSubtype) || templateScope,
            title: r.title,
            category: r.category,
            description: r.description || '',
            isMandatory: r.isMandatory,
            isEnabled: true,
          }));
        if (customReqs.length > 0) {
          setSpecializedDocs(customReqs);
        }

        triggerAutofillAnimation(['grid-campaign-title', 'grid-target-vessel', 'grid-charter-start', 'grid-charter-end']);
      } else if (target) {
        if (target.visibility === 'draft') {
          // Resume draft editing in-place
          setEditingDraftId(target.id);
          setTitle(target.title);
          /* the draft's own object rows; an older draft gets them from its single-asset fields */
          if (canTemplateReplaceObjects) {
            const restoredObjects = getAssuranceSetObjects(target);
            if (restoredObjects.length > 0) setSelectedAssuranceObjects(restoredObjects);
          }
          if (target.projectId && !lockedProjectId) setSelectedProjectId(target.projectId);
          if (target.activityId) setSelectedActivityId(target.activityId);
          if (target.templateSource === 'public' || target.visibility === 'draft') {
            setTemplatePrivacy('public');
          } else {
            setTemplatePrivacy('organization');
          }
          if (target.charterWindowStart) setStartDate(target.charterWindowStart);
          if (target.charterWindowEnd) setEndDate(target.charterWindowEnd);
          setComplianceDeadline(target.complianceDeadline || target.charterWindowStart || '');
          setVerificationRequired(target.verificationRequired ?? true);
          setInspectionRequired(target.mandatoryInspectionRequired);
          setApprovalRequired(target.formalApprovalRequired ?? true);
          if (target.appliedTemplates) setSelectedSubtypeTemplates(target.appliedTemplates);
          if (target.subtypeStakeholders) {
            setAssignedSubtypeStakeholders({
              Vessel: {
                verifierId: target.subtypeStakeholders.Vessel?.verifierId || defaultSubtypeVerifiers.Vessel,
              },
              Crew: {
                verifierId: target.subtypeStakeholders.Crew?.verifierId || defaultSubtypeVerifiers.Crew,
              },
              Activity: {
                verifierId: target.subtypeStakeholders.Activity?.verifierId || defaultSubtypeVerifiers.Activity,
              },
              Equipment: {
                verifierId: target.subtypeStakeholders.Equipment?.verifierId || defaultSubtypeVerifiers.Equipment,
              },
            });
          }

          // Restore doc toggles precisely
          const updatedToggles: Record<string, boolean> = {};
          const updatedRequired: Record<string, boolean> = {};
          Object.values(SUBTYPE_STANDARD_DOCS).forEach((list) => {
            list.forEach((doc) => {
              const matchedReq = target.requirements.find(
                (r) => !r.isSpecialized && (r.title.toLowerCase().includes(doc.title.toLowerCase()) || doc.title.toLowerCase().includes(r.title.toLowerCase()))
              );
              updatedToggles[doc.id] = Boolean(matchedReq);
              if (matchedReq) {
                updatedRequired[doc.id] = matchedReq.isMandatory;
              }
            });
          });
          setDocToggles(updatedToggles);
          setDocRequired((prev) => ({ ...prev, ...updatedRequired }));

          // Restore specialized custom requirements
          const customReqs: SpecializedDoc[] = target.requirements
            .filter((r) => r.isSpecialized)
            .map((r, idx) => ({
              id: `restored-spec-${idx}-${Date.now()}`,
              subtype: (r.subtype as AssuranceSubtype) || 'Vessel',
              title: r.title,
              category: r.category,
              description: r.description || '',
              isMandatory: r.isMandatory,
              isEnabled: true,
            }));
          setSpecializedDocs(customReqs);
        } else {
          applyGlobalTemplateData(target);
        }
      }
    }
  }, [templateSetId]);

  /* Handle Subtype Template Selection */
  const savedRequirementSubtype = (spec: SpecializedDoc): AssuranceSubtype | undefined =>
    spec.requirementSubtype === null ? undefined : (spec.requirementSubtype ?? spec.subtype);

  const handleSelectSubtypeTemplate = (subtype: AssuranceSubtype, templateId: string) => {
    setSelectedSubtypeTemplates((prev) => ({ ...prev, [subtype]: templateId }));

    const tmpl = templateId ? SUBTYPE_TEMPLATES.find((t) => t.id === templateId) : undefined;

    if (tmpl) {
      setDocToggles((prev) => {
        const updated = { ...prev };
        SUBTYPE_STANDARD_DOCS[subtype].forEach((d) => {
          updated[d.id] = tmpl.recommendedDocIds.includes(d.id);
        });
        return updated;
      });
    }

    setSpecializedDocs((prev) => {
      const kept = prev.filter((doc) => !(doc.subtype === subtype && doc.templateId));
      if (!tmpl?.customRequirements?.length) return kept;
      const added = tmpl.customRequirements.map((task, index) => {
        const fields = customRequirementFields(task);
        return {
          id: `tmpl-${tmpl.id}-${index}`,
          subtype,
          title: task.title,
          category: fields.category,
          description: task.description,
          isMandatory: true,
          isEnabled: true,
          templateId: tmpl.id,
          requirementSubtype: fields.requirementSubtype,
        };
      });
      return [...kept, ...added];
    });

    if (tmpl) triggerAutofillAnimation([`subtype-docs-container-${subtype}`]);
  };

  /* link or unlink the optional project; ignored while the project is locked by the entry point */
  const handleProjectChange = (projId: string) => {
    if (isProjectLocked) return;
    setSelectedProjectId(projId);
  };

  /* Add catalogue standard document back to list */
  const handleAddCatalogueDoc = (docId: string) => {
    setDocToggles((prev) => ({
      ...prev,
      [docId]: true,
    }));
  };

  /* Create custom document from searchable picker */
  const handleCreateCustomDoc = (subtype: AssuranceSubtype, titleText: string) => {
    const newDoc: SpecializedDoc = {
      id: `custom-doc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      subtype,
      title: titleText.trim(),
      category: SUBTYPE_CATEGORIES[subtype][0],
      description: `Custom requirement for ${subtype} assurance.`,
      isMandatory: true,
      isEnabled: true,
    };
    setSpecializedDocs((prev) => [...prev, newDoc]);
  };

  /* Toggle Required / Optional for standard doc */
  const handleToggleStandardDocRequired = (docId: string, currentVal: boolean) => {
    setDocRequired((prev) => ({
      ...prev,
      [docId]: !currentVal,
    }));
  };

  /* Toggle Required / Optional for custom doc */
  const handleToggleCustomDocRequired = (specId: string) => {
    setSpecializedDocs((prev) =>
      prev.map((spec) => (spec.id === specId ? { ...spec, isMandatory: !spec.isMandatory } : spec))
    );
  };

  /* Remove standard doc from list (can be re-added via search) */
  const handleRemoveStandardDoc = (docId: string) => {
    setDocToggles((prev) => ({
      ...prev,
      [docId]: false,
    }));
  };

  /* Remove custom doc */
  const handleRemoveCustomDoc = (specId: string) => {
    setSpecializedDocs((prev) => prev.filter((spec) => spec.id !== specId));
  };

  const handleToggleSpecializedDoc = (id: string) => {
    setSpecializedDocs((prev) =>
      prev.map((d) => (d.id === id ? { ...d, isEnabled: !d.isEnabled } : d))
    );
  };

  /* Errors for one wizard tab: General covers identification, dates and stakeholders; Objects covers what the set covers */
  const getStepErrors = (stepNumber: number): Record<string, string> => {
    const newErrors: Record<string, string> = {};
    const step = steps[stepNumber - 1];
    if (!step) return newErrors;

    if (step.id === 'step-general') {
      if (!title.trim()) {
        newErrors.title = 'Title is required.';
      } else {
        const duplicateCheck = isDuplicateCampaignTitle(title, assuranceSets, editingDraftId);
        if (duplicateCheck.isDuplicate) {
          newErrors.title = duplicateCheck.reason || 'This title is already in use.';
        }
      }

      if (!startDate) {
        newErrors.startDate = 'Start date is required.';
      }
      if (!endDate) {
        newErrors.endDate = 'End date is required.';
      }
      if (startDate && endDate && startDate > endDate) {
        newErrors.endDate = 'End date cannot be before the start date.';
      }
      const deadlineError = validateComplianceDeadline(complianceDeadline, startDate);
      if (deadlineError) {
        newErrors.complianceDeadline = deadlineError;
      }
      /* Verifier, Inspector & Approver Role Validations (MVP 1:1 Mapping) */
      if (verificationRequired && reviewMode !== 'issuing_authority' && !assignedVerifier) {
        newErrors.verifier = 'Select a verifier.';
      }
      if (inspectionRequired && !assignedInspector) {
        newErrors.inspector = 'Select an inspector.';
      }
      if (approvalRequired && !assignedApprover) {
        newErrors.approver = 'Select an approver.';
      }

      if (
        hasBlockingAssuranceAssignmentConflict({
          verifierId: verificationRequired && reviewMode !== 'issuing_authority' ? assignedVerifier : undefined,
          approverId: approvalRequired ? assignedApprover : undefined,
          vesselOwnerOrg: serviceProviderOrg,
          serviceProviderOrg: appointedProviderOrg,
          isCharteringOtherServices: Boolean(selectedSubmitterForProvider),
          isClientAdmin,
          users,
          internalDeployment: selectedSubmitterForProvider
            ? orgFieldMatches(clientOrg, selectedSubmitterForProvider.organization)
            : isInternalDeployment,
        })
      ) {
        const verifierUser = users.find((u) => u.id === assignedVerifier);
        const approverUser = users.find((u) => u.id === assignedApprover);
        if (verifierUser && appointedProviderOrg && verifierUser.organization?.toLowerCase().includes(appointedProviderOrg.toLowerCase())) {
          newErrors.verifier = `Service provider conflict: Staff from ${appointedProviderOrg} cannot verify their own documents.`;
        }
        if (approverUser && appointedProviderOrg && approverUser.organization?.toLowerCase().includes(appointedProviderOrg.toLowerCase())) {
          newErrors.approver = `Service provider conflict: Staff from ${appointedProviderOrg} cannot approve their own documents.`;
        }
      }
    }

    if (step.id === 'step-objects') {
      if (selectedAssuranceObjects.length === 0) {
        newErrors.objects = 'Add at least one object.';
      }
      /* only the same asset cannot hold two contracts at once, so each error sits on its own row */
      const datesValid = Boolean(startDate && endDate && startDate <= endDate);
      selectedAssuranceObjects.forEach((obj) => {
        const scope = getAssuranceObjectScope(obj.type);
        if (!scope) return;
        if (obj.type === 'vessel' && !vesselChoices.some((v) => v.id === obj.id)) {
          newErrors[`object_${obj.id}`] = 'Select a vessel from another organization.';
          return;
        }
        if (datesValid) {
          const overlap = formatOverlapError(getAssetPeriodConflicts(scope, obj.id, startDate, endDate, assuranceSets, editingDraftId || undefined));
          if (overlap) newErrors[`object_${obj.id}`] = overlap;
        }
      });
    }

    if (step.id === 'step-review' && !assignedSubmitterId) {
      newErrors.submitter = 'Select the service provider submitter.';
    }

    return newErrors;
  };

  /* Validation per Step with Field-Specific Mapping */
  const validateCurrentStep = (): boolean => {
    setErrorMessage('');
    const newErrors = getStepErrors(currentStep);
    setFieldErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateCurrentStep()) {
      setCurrentStep((prev) => Math.min(prev + 1, totalSteps));
    }
  };

  const handlePrevious = () => {
    setErrorMessage('');
    setFieldErrors({});
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const selectedProject = selectedProjectId ? projects.find((p) => p.id === selectedProjectId) : undefined;
  /* keep a locked or draft-restored project selectable even when it is outside the persona's visible list */
  const projectOptions =
    selectedProject && !availableProjectOptions.some((p) => p.id === selectedProject.id)
      ? [projectToAssuranceProjectScope(selectedProject), ...availableProjectOptions]
      : availableProjectOptions;
  const selectedVessel = vesselChoices.find((v) => v.id === vesselId) || vesselChoices[0];
  const selectedCrew = crew.find((c) => c.id === selectedCrewId) || crew[0];
  const selectedCrewMembers = selectedCrewIds
    .map((id) => crew.find((c) => c.id === id))
    .filter((c): c is CrewMember => Boolean(c));
  const selectedEquipment = equipment.find((e) => e.id === selectedEquipmentId) || equipment[0];
  const selectedActivity = EXISTING_ACTIVITIES.find((a) => a.id === selectedActivityId) || EXISTING_ACTIVITIES[0];

  /* display name of the asset picked for a scope */
  const getScopeAssetName = (scope: AssuranceSubtype): string =>
    scope === 'Vessel' ? (selectedVessel?.name || 'Vessel') :
      scope === 'Crew' ? (selectedCrewMembers.map((c) => c.fullName).join(', ') || 'Crew') :
        scope === 'Equipment' ? (selectedEquipment?.name || 'Equipment') :
          (selectedActivity?.name || 'Activity');

  /* asset name with its identifying detail, as shown on the review tab */
  const getScopeAssetSummary = (scope: AssuranceSubtype): string =>
    scope === 'Vessel' ? `${getScopeAssetName(scope)} (IMO: ${selectedVessel?.imoNumber || 'N/A'})` :
      scope === 'Crew' ? (selectedCrewMembers.map((c) => `${c.fullName} (${c.rank})`).join(', ') || 'Crew') :
        scope === 'Equipment' ? `${getScopeAssetName(scope)} (Tag: ${selectedEquipment?.equipmentIdentifier || 'N/A'})` :
          `${getScopeAssetName(scope)} (${selectedActivity?.category || 'N/A'})`;

  const selectedSubmitter = users.find((u: UserProfile) => u.id === assignedSubmitterId);
  const submitterLabel = selectedSubmitter
    ? `${selectedSubmitter.name} (${selectedSubmitter.organization})`
    : 'Designated by Chartered Asset Owner';
  const appointedStakeholders = selectedSubmitter
    ? {
      submitterId: selectedSubmitter.id,
      submitterName: selectedSubmitter.name,
      submitterOrg: selectedSubmitter.organization,
    }
    : undefined;
  const selectedVerifier = users.find((u: UserProfile) => u.id === assignedVerifier);
  const selectedInspector = users.find((u: UserProfile) => u.id === assignedInspector);
  const selectedApprover = users.find((u: UserProfile) => u.id === assignedApprover);

  const assignmentWarnings = getAssuranceAssignmentWarnings({
    verifierId: verificationRequired && reviewMode !== 'issuing_authority' ? assignedVerifier : undefined,
    approverId: approvalRequired ? assignedApprover : undefined,
    subtypeStakeholders: undefined,
    vesselOwnerOrg: serviceProviderOrg,
    serviceProviderOrg: appointedProviderOrg,
    isCharteringOtherServices: !isInternalDeployment,
    isClientAdmin,
    users,
    internalDeployment: isInternalDeployment,
  });

  /* Submit and create assurance set */
  const handleSubmit = (e?: React.SyntheticEvent) => {
    e?.preventDefault();
    setHasAttemptedSubmit(true);

    /* every tab is checked on submit; the wizard returns to the first one that still has an error */
    setErrorMessage('');
    const firstInvalidStep = steps.findIndex((_, idx) => Object.keys(getStepErrors(idx + 1)).length > 0);
    if (firstInvalidStep !== -1) {
      setFieldErrors(getStepErrors(firstInvalidStep + 1));
      setCurrentStep(firstInvalidStep + 1);
      return;
    }

    const uniqueSetId = generateUniqueAssuranceSetId(assuranceSets);

    /* Determine which subtypes are active */
    const activeSubtypes = orderAssuranceScopes(selectedScopes);

    /* Build combined requirements list from standard subtype docs and specialized docs */
    const finalRequirements: AssuranceRequirement[] = [];
    let reqIndex = 0;

    const reqAssignedVerifier = verificationRequired
      ? reviewMode === 'issuing_authority'
        ? 'AMSA Digital Validation API Gateway'
        : selectedVerifier
          ? `${selectedVerifier.name} (${selectedVerifier.organization})`
          : 'Pending Admin Assignment'
      : undefined;

    activeSubtypes.forEach((subtype) => {
      const reqAssignedSubmitter = submitterLabel;

      const standardList = SUBTYPE_STANDARD_DOCS[subtype];
      standardList.forEach((doc) => {
        if (docToggles[doc.id]) {
          finalRequirements.push({
            id: generateUniqueRequirementId(uniqueSetId, reqIndex++),
            category: doc.category,
            title: doc.title,
            description: doc.description,
            subtype: doc.subtype,
            isMandatory: docRequired[doc.id] ?? doc.isMandatory,
            isFulfilled: false,
            ocrConfidence: 0,
            verifierStatus: 'Pending',
            assignedSubmitter: reqAssignedSubmitter,
            assignedVerifier: reqAssignedVerifier,
            verifierId: verificationRequired ? assignedVerifier : undefined,
            targetDate: complianceDeadline,
          });
        }
      });

      const customList = specializedDocs.filter((d) => d.subtype === subtype && d.isEnabled);
      customList.forEach((spec) => {
        finalRequirements.push({
          id: generateUniqueRequirementId(uniqueSetId, reqIndex++),
          category: spec.category,
          title: spec.title,
          description: spec.description,
          subtype: savedRequirementSubtype(spec),
          isMandatory: spec.isMandatory,
          isSpecialized: true,
          targetDate: spec.targetDate || complianceDeadline,
          isFulfilled: false,
          ocrConfidence: 0,
          verifierStatus: 'Pending',
          assignedSubmitter: reqAssignedSubmitter,
          assignedVerifier: reqAssignedVerifier,
          verifierId: verificationRequired ? assignedVerifier : undefined,
        });
      });
    });

    const placedTasks = placeTasksInSections(finalRequirements);
    finalRequirements.splice(0, finalRequirements.length, ...placedTasks.requirements);

    const ownerOrg = charterer.trim() || clientOrg;
    const effectiveCharterer = ownerOrg;
    /* a request keeps the creating organization as initiator while the client is the project client */
    const initiatorOrg = requestContext ? defaultCharterer : ownerOrg;

    const targetSetId = editingDraftId || generateUniqueAssuranceSetId(assuranceSets);

    const effectiveRequirements = autoAttachDocumentsToRequirements(finalRequirements, {
      documents,
      vessel: selectedVesselForScope,
      vessels,
      crew,
      selectedCrewId,
      selectedCrewIds,
      equipment,
      selectedEquipmentId,
      selectedVesselId: vesselId,
      selectedActivityId,
      targetSubtype: assuranceType,
    });

    const invalidTask = finalRequirements.find(
      (r) => r.targetDate && validateTaskTargetDate(r.targetDate, complianceDeadline)
    );
    if (invalidTask) {
      setFieldErrors((prev) => ({
        ...prev,
        complianceDeadline: TASK_DATE_AFTER_SET_DATE,
      }));
      return;
    }

    const effectiveAssetName =
      assuranceType === 'Vessel' ? (selectedVessel?.name || 'Vessel') :
        assuranceType === 'Crew' ? (selectedCrew?.fullName || 'Crew') :
          assuranceType === 'Equipment' ? (selectedEquipment?.name || 'Equipment') :
            (selectedActivity?.name || 'Activity');

    const effectiveImo =
      assuranceType === 'Vessel' ? (selectedVessel?.imoNumber || '9123453') : (selectedVessel?.imoNumber || 'N/A');

    const isPublicTemplateRequested = templatePrivacy === 'public';

    const newSet: AssuranceSet = {
      id: targetSetId,
      title: title.trim(),
      assuranceType,
      scopeType: getAssuranceSetScopeType(
        {
          assuranceType,
          subtypes: activeSubtypes,
          vesselId: selectedVessel?.id,
          crewId: selectedScopes.includes('Crew') ? selectedCrewId : undefined,
          equipmentId: selectedScopes.includes('Equipment') ? selectedEquipmentId : undefined,
          title,
        },
        vessels,
        crew,
        equipment,
      ),
      projectId: selectedProject?.id,
      projectName: selectedProject?.name,
      crewId: selectedScopes.includes('Crew') ? selectedCrewId : undefined,
      crewName: selectedScopes.includes('Crew') ? (selectedCrew?.fullName || selectedCrewId) : undefined,
      crewIds: selectedScopes.includes('Crew') ? selectedCrewIds : undefined,
      crewNames: selectedScopes.includes('Crew') ? selectedCrewMembers.map((c) => c.fullName) : undefined,
      equipmentId: selectedScopes.includes('Equipment') ? selectedEquipmentId : undefined,
      equipmentName: selectedScopes.includes('Equipment') ? (selectedEquipment?.name || selectedEquipmentId) : undefined,
      activityId: selectedScopes.includes('Activity') ? selectedActivityId : undefined,
      activityName: selectedScopes.includes('Activity') ? (selectedActivity?.name || selectedActivityId) : undefined,
      subtypes: activeSubtypes,
      subtypeStakeholders: {
        Vessel: {
          assignedSubmitter: submitterLabel,
          submitterName: submitterLabel,
          verifierId: verificationRequired ? assignedVerifier : undefined,
          verifierName: selectedVerifier?.name,
          verifierOrg: selectedVerifier?.organization,
          assignedVerifier: reqAssignedVerifier,
        },
        Crew: {
          assignedSubmitter: submitterLabel,
          submitterName: submitterLabel,
          verifierId: verificationRequired ? assignedVerifier : undefined,
          verifierName: selectedVerifier?.name,
          verifierOrg: selectedVerifier?.organization,
          assignedVerifier: reqAssignedVerifier,
        },
        Activity: {
          assignedSubmitter: submitterLabel,
          submitterName: submitterLabel,
          verifierId: verificationRequired ? assignedVerifier : undefined,
          verifierName: selectedVerifier?.name,
          verifierOrg: selectedVerifier?.organization,
          assignedVerifier: reqAssignedVerifier,
        },
        Equipment: {
          assignedSubmitter: submitterLabel,
          submitterName: submitterLabel,
          verifierId: verificationRequired ? assignedVerifier : undefined,
          verifierName: selectedVerifier?.name,
          verifierOrg: selectedVerifier?.organization,
          assignedVerifier: reqAssignedVerifier,
        },
      },
      visibility: 'organization',
      templateSource: isPublicTemplateRequested ? 'public' : 'organization',
      appliedTemplates: selectedSubtypeTemplates,
      vesselId: selectedVessel?.id || '',
      vesselName: effectiveAssetName,
      imoNumber: effectiveImo,
      initiatorOrg,
      initiatorRole: 'C Admin · Client Created',
      charterer: effectiveCharterer,
      charterWindowStart: startDate,
      charterWindowEnd: endDate,
      complianceDeadline,
      targetDate: complianceDeadline,
      datePermissionGrants: activeSessionUserId
        ? [
          {
            id: `DPG-${Date.now()}-1`,
            userId: activeSessionUserId,
            userName: creatorName || 'Client Admin',
            grantedBy: 'System (Creation)',
            grantedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            reason: 'Initial setup permission',
          },
        ]
        : [],
      targetDateHistory: [
        {
          id: `TDC-${Date.now()}-0`,
          setId: uniqueSetId,
          scope: 'set',
          oldDate: '—',
          newDate: complianceDeadline,
          changedBy: creatorName || 'Client Admin',
          changedAt: new Date().toISOString(),
          reason: 'Initial target date set at creation',
        },
      ],
      stage: 'Initiated',
      readinessScore: 10,
      verificationRequired,
      mandatoryInspectionRequired: inspectionRequired,
      formalApprovalRequired: approvalRequired,
      inspectionCompleted: false,
      assignedSubmitter: submitterLabel,
      assignedVerifier: reqAssignedVerifier,
      assignedInspector: !inspectionRequired
        ? undefined
        : selectedInspector
          ? `${selectedInspector.name} (${selectedInspector.organization})`
          : 'Pending Admin Assignment',
      assignedApprover: approvalRequired
        ? selectedApprover
          ? `${selectedApprover.name} (${selectedApprover.organization})`
          : 'Pending Admin Assignment'
        : undefined,
      reviewMode,
      reviewChannels: reviewMode === 'mixed' ? ['internal', 'third_party', 'issuing_authority'] : [reviewMode],
      validityCheckRequired,
      suitabilityCheckRequired,
      authorityValidationMethod: (reviewMode === 'issuing_authority' || reviewMode === 'mixed') ? authorityValidationMethod : undefined,
      serviceProviderOrg: appointedProviderOrg,
      clientOrg: ownerOrg,
      parties: setOrganizationParties({ clientOrg: ownerOrg, serviceProviderOrg: appointedProviderOrg }),
      requirements: effectiveRequirements,
      sections: placedTasks.sections,
      stakeholders: appointedStakeholders,
      assignedStakeholders: undefined,
      createdByPersona: 'C Admin',
      createdByName: creatorName,
      clientWorkflowStage: 'draft',
      assuranceObjects: selectedAssuranceObjects,
    };

    newSet.readinessScore = calculateAssuranceSetReadiness(newSet);

    if (editingDraftId) {
      updateAssuranceSet(newSet);
    } else {
      addAssuranceSet(newSet);
    }

    // When Public scope is selected for template privacy, auto-create a duplicate generalized AssuranceTemplate with AST- ID
    if (isPublicTemplateRequested) {
      const derivedScopeType = newSet.scopeType || 'General';
      const existingTmplCount = (assuranceTemplates || []).length;
      let nextNum = existingTmplCount + 1;
      let candidateId = `AST-2026-${String(nextNum).padStart(3, '0')}`;
      while ((assuranceTemplates || []).some((t) => t.id === candidateId)) {
        nextNum++;
        candidateId = `AST-2026-${String(nextNum).padStart(3, '0')}`;
      }

      const duplicateTemplate: AssuranceTemplate = {
        id: candidateId,
        title: `${derivedScopeType} Standard Assurance Template`,
        description: `Generalized public assurance template for ${derivedScopeType} operations. Published by ${initiatorOrg}.`,
        scope: assuranceType,
        assuranceType,
        scopeType: derivedScopeType,
        visibility: 'public',
        templateSource: 'public',
        subtypes: activeSubtypes,
        requirements: effectiveRequirements.map((r, i) => ({
          ...r,
          id: `AST-REQ-${String(nextNum).padStart(3, '0')}-${i + 1}`,
          isFulfilled: false,
          ocrConfidence: 0,
          documentId: undefined,
          linkedDocumentId: undefined,
          verifierStatus: 'Pending',
          notes: undefined,
        })),
        initiatorOrg,
        createdByPersona: isClientAdmin ? 'C Admin' : 'Administrator',
        createdByName: creatorName,
        createdAt: new Date().toISOString(),
        mandatoryInspectionRequired: inspectionRequired,
        verificationRequired,
        formalApprovalRequired: approvalRequired,
        reviewMode,
        reviewChannels: reviewMode === 'mixed' ? ['internal', 'third_party', 'issuing_authority'] : [reviewMode],
      };

      addAssuranceTemplate(duplicateTemplate);
    }

    /* an initiated set with a project joins that project roster; the set keeps a single project */
    if (newSet.projectId) {
      const attachResult = attachAssuranceSetToProject(newSet.id, newSet.projectId);
      if (!attachResult.success) {
        /* keep both sides consistent: a set the project roster rejected stays orphaned */
        updateAssuranceSet({ ...newSet, projectId: undefined, projectName: undefined });
      }
    }

    if (createAssuranceForVesselId) {
      const returnVesselId = createAssuranceForVesselId;
      setCreateAssuranceForVesselId(undefined);
      setCurrentHashView('vessels', returnVesselId);
      return;
    }

    if (lockedProjectId) {
      setCurrentHashView('project', lockedProjectId);
      return;
    }

    setCurrentHashView('assurance-sets', newSet.id);
  };

  /* Save current configuration as Draft */
  const handleSaveDraft = () => {
    const targetSetId = editingDraftId || generateUniqueAssuranceSetId(assuranceSets);
    const activeSubtypes = orderAssuranceScopes(selectedScopes);

    const finalRequirements: AssuranceRequirement[] = [];
    let reqIndex = 0;

    const reqAssignedVerifier = verificationRequired
      ? selectedVerifier
        ? `${selectedVerifier.name} (${selectedVerifier.organization})`
        : 'Pending Admin Assignment'
      : undefined;

    activeSubtypes.forEach((subtype) => {
      const reqAssignedSubmitter = submitterLabel;

      const standardList = SUBTYPE_STANDARD_DOCS[subtype];
      standardList.forEach((doc) => {
        if (docToggles[doc.id]) {
          finalRequirements.push({
            id: generateUniqueRequirementId(targetSetId, reqIndex++),
            category: doc.category,
            title: doc.title,
            description: doc.description,
            subtype: doc.subtype,
            isMandatory: docRequired[doc.id] ?? doc.isMandatory,
            isFulfilled: false,
            ocrConfidence: 0,
            verifierStatus: 'Pending',
            assignedSubmitter: reqAssignedSubmitter,
            assignedVerifier: reqAssignedVerifier,
            verifierId: verificationRequired ? assignedVerifier : undefined,
            targetDate: complianceDeadline,
          });
        }
      });

      const customList = specializedDocs.filter((d) => d.subtype === subtype && d.isEnabled);
      customList.forEach((spec) => {
        finalRequirements.push({
          id: generateUniqueRequirementId(targetSetId, reqIndex++),
          category: spec.category,
          title: spec.title,
          description: spec.description,
          subtype: savedRequirementSubtype(spec),
          isMandatory: spec.isMandatory,
          isSpecialized: true,
          targetDate: spec.targetDate || complianceDeadline,
          isFulfilled: false,
          ocrConfidence: 0,
          verifierStatus: 'Pending',
          assignedSubmitter: reqAssignedSubmitter,
          assignedVerifier: reqAssignedVerifier,
          verifierId: verificationRequired ? assignedVerifier : undefined,
        });
      });
    });

    const placedTasks = placeTasksInSections(finalRequirements);
    finalRequirements.splice(0, finalRequirements.length, ...placedTasks.requirements);

    const ownerOrg = charterer.trim() || clientOrg;
    const effectiveCharterer = ownerOrg;
    /* a request keeps the creating organization as initiator while the client is the project client */
    const initiatorOrg = requestContext ? defaultCharterer : ownerOrg;

    const effectiveRequirements = autoAttachDocumentsToRequirements(finalRequirements, {
      documents,
      vessel: selectedVesselForScope,
      vessels,
      crew,
      selectedCrewId,
      selectedCrewIds,
      equipment,
      selectedEquipmentId,
      selectedVesselId: vesselId,
      selectedActivityId,
      targetSubtype: assuranceType,
    });

    const invalidTask = finalRequirements.find(
      (r) => r.targetDate && validateTaskTargetDate(r.targetDate, complianceDeadline)
    );
    if (invalidTask) {
      setFieldErrors((prev) => ({
        ...prev,
        complianceDeadline: TASK_DATE_AFTER_SET_DATE,
      }));
      return;
    }

    const effectiveAssetName =
      assuranceType === 'Vessel' ? (selectedVessel?.name || 'Vessel') :
        assuranceType === 'Crew' ? (selectedCrew?.fullName || 'Crew') :
          assuranceType === 'Equipment' ? (selectedEquipment?.name || 'Equipment') :
            (selectedActivity?.name || 'Activity');

    const effectiveImo =
      assuranceType === 'Vessel' ? (selectedVessel?.imoNumber || '9123453') : (selectedVessel?.imoNumber || 'N/A');

    const draftSet: AssuranceSet = {
      id: targetSetId,
      title: title.trim() || `${titleOrg} - Draft Assurance Set`,
      assuranceType,
      projectId: selectedProject?.id,
      projectName: selectedProject?.name,
      crewId: selectedScopes.includes('Crew') ? selectedCrewId : undefined,
      crewName: selectedScopes.includes('Crew') ? (selectedCrew?.fullName || selectedCrewId) : undefined,
      crewIds: selectedScopes.includes('Crew') ? selectedCrewIds : undefined,
      crewNames: selectedScopes.includes('Crew') ? selectedCrewMembers.map((c) => c.fullName) : undefined,
      equipmentId: selectedScopes.includes('Equipment') ? selectedEquipmentId : undefined,
      equipmentName: selectedScopes.includes('Equipment') ? (selectedEquipment?.name || selectedEquipmentId) : undefined,
      activityId: selectedScopes.includes('Activity') ? selectedActivityId : undefined,
      activityName: selectedScopes.includes('Activity') ? (selectedActivity?.name || selectedActivityId) : undefined,
      subtypes: activeSubtypes,
      subtypeStakeholders: {
        Vessel: {
          assignedSubmitter: submitterLabel,
          submitterName: submitterLabel,
          verifierId: verificationRequired ? assignedVerifier : undefined,
          verifierName: selectedVerifier?.name,
          verifierOrg: selectedVerifier?.organization,
          assignedVerifier: reqAssignedVerifier,
        },
        Crew: {
          assignedSubmitter: submitterLabel,
          submitterName: submitterLabel,
          verifierId: verificationRequired ? assignedVerifier : undefined,
          verifierName: selectedVerifier?.name,
          verifierOrg: selectedVerifier?.organization,
          assignedVerifier: reqAssignedVerifier,
        },
        Activity: {
          assignedSubmitter: submitterLabel,
          submitterName: submitterLabel,
          verifierId: verificationRequired ? assignedVerifier : undefined,
          verifierName: selectedVerifier?.name,
          verifierOrg: selectedVerifier?.organization,
          assignedVerifier: reqAssignedVerifier,
        },
        Equipment: {
          assignedSubmitter: submitterLabel,
          submitterName: submitterLabel,
          verifierId: verificationRequired ? assignedVerifier : undefined,
          verifierName: selectedVerifier?.name,
          verifierOrg: selectedVerifier?.organization,
          assignedVerifier: reqAssignedVerifier,
        },
      },
      visibility: 'draft',
      templateSource: templatePrivacy,
      appliedTemplates: selectedSubtypeTemplates,
      vesselId: selectedVessel?.id || '',
      vesselName: effectiveAssetName,
      imoNumber: effectiveImo,
      initiatorOrg,
      initiatorRole: 'C Admin · Client Created',
      charterer: effectiveCharterer,
      charterWindowStart: startDate || initialPeriod.start,
      charterWindowEnd: endDate || initialPeriod.end,
      complianceDeadline: complianceDeadline || startDate || initialPeriod.start,
      targetDate: complianceDeadline || startDate || initialPeriod.start,
      stage: 'Initiated',
      readinessScore: 0,
      verificationRequired,
      mandatoryInspectionRequired: inspectionRequired,
      formalApprovalRequired: approvalRequired,
      inspectionCompleted: false,
      assignedSubmitter: submitterLabel,
      assignedVerifier: reqAssignedVerifier,
      assignedInspector: !inspectionRequired
        ? undefined
        : selectedInspector
          ? `${selectedInspector.name} (${selectedInspector.organization})`
          : 'Pending Admin Assignment',
      assignedApprover: approvalRequired
        ? selectedApprover
          ? `${selectedApprover.name} (${selectedApprover.organization})`
          : 'Pending Admin Assignment'
        : undefined,
      reviewMode,
      reviewChannels: reviewMode === 'mixed' ? ['internal', 'third_party', 'issuing_authority'] : [reviewMode],
      validityCheckRequired,
      suitabilityCheckRequired,
      authorityValidationMethod: (reviewMode === 'issuing_authority' || reviewMode === 'mixed') ? authorityValidationMethod : undefined,
      serviceProviderOrg: appointedProviderOrg,
      clientOrg: ownerOrg,
      parties: setOrganizationParties({ clientOrg: ownerOrg, serviceProviderOrg: appointedProviderOrg }),
      requirements: effectiveRequirements,
      sections: placedTasks.sections,
      stakeholders: appointedStakeholders,
      assignedStakeholders: undefined,
      createdByPersona: 'C Admin',
      createdByName: creatorName,
      clientWorkflowStage: 'draft',
      internalDeployment: isInternalDeployment,
      assuranceObjects: selectedAssuranceObjects,
    };

    draftSet.readinessScore = calculateAssuranceSetReadiness(draftSet);

    if (editingDraftId) {
      updateAssuranceSet(draftSet);
    } else {
      addAssuranceSet(draftSet);
    }
    setShowCancelPrompt(false);

    if (createAssuranceForVesselId) {
      const returnVesselId = createAssuranceForVesselId;
      setCreateAssuranceForVesselId(undefined);
      setCurrentHashView('vessels', returnVesselId);
      return;
    }

    if (lockedProjectId) {
      setCurrentHashView('project', lockedProjectId);
      return;
    }

    setCurrentHashView('assurance-sets', draftSet.id);
  };

  const handleCancelClick = () => {
    setShowCancelPrompt(true);
  };

  const handleConfirmExitWithoutSaving = () => {
    setShowCancelPrompt(false);
    if (createAssuranceForVesselId) {
      const returnVesselId = createAssuranceForVesselId;
      setCreateAssuranceForVesselId(undefined);
      setCurrentHashView('vessels', returnVesselId);
      return;
    }
    if (lockedProjectId) {
      setCurrentHashView('project', lockedProjectId);
      return;
    }
    setCurrentHashView(previousHashView === 'dashboard' ? 'dashboard' : 'assurance-sets');
  };

  /* label of an asset already contracted in the chosen period, with the dates of the set that holds it */
  const formatBookedLabel = (conflict: ContractPeriodConflict) =>
    `Booked by ${conflict.set.id} (${formatMaritimeDate(conflict.set.charterWindowStart)} – ${formatMaritimeDate(conflict.set.charterWindowEnd)})`;

  /* moves the contract period to the first window the asset is free */
  const applyNextFreeDates = (scope: AssuranceSubtype, assetId: string) => {
    const next = getDefaultNonConflictingContractPeriod(assuranceSets, {
      id: editingDraftId || undefined,
      scope,
      vesselId: scope === 'Vessel' ? assetId : undefined,
      crewIds: scope === 'Crew' ? [assetId] : undefined,
      equipmentId: scope === 'Equipment' ? assetId : undefined,
    });
    setStartDate(next.start);
    setEndDate(next.end);
    setComplianceDeadline((current) => (!current || current > next.start ? next.start : current));
    setFieldErrors((prev) => {
      const u = { ...prev };
      delete u.startDate;
      delete u.endDate;
      delete u.complianceDeadline;
      Object.keys(u).filter((key) => key.startsWith('object_')).forEach((key) => delete u[key]);
      return u;
    });
  };

  /* collision alert for the picked asset, with a one-click move to its next free dates */
  const renderCollisionAlert = (scope: AssuranceSubtype, assetId: string, assetName: string, conflicts: ContractPeriodConflict[]) => {
    if (conflicts.length === 0) return null;
    const [primaryConflict] = conflicts;
    return (
      <div className="alert alert-danger d-flex align-items-start gap-2 mt-2 p-3 rounded-3" role="alert">
        <AlertCircle className="text-danger flex-shrink-0 mt-0.5" style={{ width: '18px', height: '18px' }} />
        <div className="small text-danger flex-grow-1">
          <strong>Asset Collision:</strong> {assetName} is already contracted under{' '}
          <span className="font-mono-code fw-semibold">{primaryConflict.set.id}</span> ({formatMaritimeDate(primaryConflict.set.charterWindowStart)} &ndash; {formatMaritimeDate(primaryConflict.set.charterWindowEnd)}). Pick another {scope === 'Crew' ? 'crew member' : scope.toLowerCase()} or move the contract period.
          <div className="mt-2">
            <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => applyNextFreeDates(scope, assetId)}>
              Use next free dates
            </button>
          </div>
        </div>
      </div>
    );
  };

  /* Render reusable Subtype Document Section */
  const renderSubtypeSection = (subtype: AssuranceSubtype) => {
    const standardDocs = SUBTYPE_STANDARD_DOCS[subtype] || [];
    const publicTemplates = SUBTYPE_TEMPLATES.filter((t) => (t.subtype === subtype || t.subtype === 'All') && t.source === 'public');
    const orgTemplates = SUBTYPE_TEMPLATES.filter((t) => (t.subtype === subtype || t.subtype === 'All') && t.source === 'organization');
    const activeTemplateId = selectedSubtypeTemplates[subtype] || '';
    const activeTemplate = SUBTYPE_TEMPLATES.find((t) => t.id === activeTemplateId);

    const activeStandardDocs = standardDocs.filter((d) => docToggles[d.id]);
    const activeSpecializedDocs = specializedDocs.filter((d) => d.subtype === subtype && d.isEnabled);
    const totalActiveCount = activeStandardDocs.length + activeSpecializedDocs.length;

    const availableSearchItems: SearchableSelectItem[] = standardDocs
      .filter((d) => !docToggles[d.id])
      .map((d) => ({
        id: d.id,
        label: d.title,
        hint: d.category,
      }));

    return (
      <div className="d-flex flex-column gap-3" id={`subtype-docs-container-${subtype}`}>
        {/* Template Selector Card */}
        <div className="card border shadow-2xs rounded-3 bg-white">
          <div className="card-header bg-light border-bottom px-4 py-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
              <h5 className="fw-bold text-slate-900 m-0 fs-6">
                Assurance Templates <span className="text-secondary fw-normal fs-7">(Optional)</span>
              </h5>
              <div className="text-muted small mt-0.5">
                Start from a template to fill in the required documents.
              </div>
            </div>
            {activeTemplateId && (
              <span className="badge bg-primary text-white font-mono-code px-2.5 py-1.5" style={{ fontSize: '0.75rem' }}>
                Template Applied
              </span>
            )}
          </div>
          <div className="card-body p-4">
            <div className="row g-3">
              <div className="col-12 col-md-8 col-lg-6">
                <label className="form-label text-secondary small fw-semibold" htmlFor={`template-select-${subtype}`}>
                  Select Template
                </label>
                <select
                  id={`template-select-${subtype}`}
                  className="form-select bg-white text-dark border-secondary-subtle"
                  value={activeTemplateId}
                  onChange={(e) => handleSelectSubtypeTemplate(subtype, e.target.value)}
                >
                  <option value="">Select a template...</option>
                  {publicTemplates.length > 0 && (
                    <optgroup label="Public Templates">
                      {publicTemplates.map((tmpl) => (
                        <option key={tmpl.id} value={tmpl.id}>
                          {tmpl.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {orgTemplates.length > 0 && (
                    <optgroup label="Organization Templates">
                      {orgTemplates.map((tmpl) => (
                        <option key={tmpl.id} value={tmpl.id}>
                          {tmpl.name} ({tmpl.organizationName || 'Corporate'})
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
            </div>

            {activeTemplateId && (
              <div className="mt-3 p-3 bg-light-subtle border border-primary-subtle rounded-2 d-flex align-items-center justify-content-between">
                <div className="small text-secondary">
                  <strong className="text-primary d-block">
                    Active: {activeTemplate?.name}
                  </strong>
                  <span>{activeTemplate?.description}</span>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => handleSelectSubtypeTemplate(subtype, '')}
                >
                  Clear Template
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Required Documents List & Searchable Picker Card */}
        <div className="card border shadow-2xs rounded-3 bg-white">
          <div className="card-header bg-light border-bottom px-4 py-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
              <h5 className="fw-bold text-slate-900 m-0 fs-6">
                Documents ({totalActiveCount})
              </h5>
              <div className="text-muted small mt-0.5">
                Set each document as required or optional, or search to add more.
              </div>
            </div>
          </div>
          <div className="card-body p-4 d-flex flex-column gap-3">
            {/* Searchable document picker */}
            <div>
              <label className="form-label text-secondary small fw-semibold" htmlFor={`search-docs-${subtype}`}>
                Add Document
              </label>
              <SearchableSelect
                id={`search-docs-${subtype}`}
                items={availableSearchItems}
                placeholder={`Search ${subtype.toLowerCase()} documents to add...`}
                aria-label={`Search ${subtype.toLowerCase()} documents`}
                onSelect={(item) => handleAddCatalogueDoc(item.id)}
                onCreate={(customTitle) => handleCreateCustomDoc(subtype, customTitle)}
                createLabel={(text) => `Add '${text}' as a custom document`}
              />
            </div>

            {/* Document rows or empty state */}
            {totalActiveCount === 0 ? (
              <div className="p-4 text-center text-secondary small bg-light rounded-2 border border-dashed">
                No {subtype} documents. Search to add one.
              </div>
            ) : (
              <div className="d-flex flex-column gap-2" id={`docs-list-${subtype}`}>
                {activeStandardDocs.map((doc) => {
                  const isRequired = docRequired[doc.id] ?? doc.isMandatory;
                  return (
                    <div
                      key={doc.id}
                      className="p-3 border rounded-3 bg-white shadow-2xs d-flex align-items-center justify-content-between gap-3"
                    >
                      <div className="d-flex align-items-center gap-2 flex-grow-1 min-w-0">
                        <span className="fw-semibold text-dark small text-truncate">
                          {doc.title}
                        </span>
                      </div>
                      <div className="d-flex align-items-center gap-3 flex-shrink-0">
                        <div className="form-check form-switch m-0 d-flex align-items-center gap-2">
                          <input
                            className="form-check-input cursor-pointer"
                            type="checkbox"
                            id={`req-toggle-${doc.id}`}
                            checked={isRequired}
                            onChange={() => handleToggleStandardDocRequired(doc.id, isRequired)}
                            style={{ width: '2.25rem', height: '1.2rem', cursor: 'pointer' }}
                          />
                          <label
                            htmlFor={`req-toggle-${doc.id}`}
                            className={`small fw-semibold m-0 cursor-pointer ${
                              isRequired ? 'text-success' : 'text-secondary'
                            }`}
                            style={{ fontSize: '0.78rem', minWidth: '55px' }}
                          >
                            {isRequired ? 'Required' : 'Optional'}
                          </label>
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger d-inline-flex align-items-center justify-content-center p-1.5 rounded-2"
                          title="Remove document"
                          aria-label={`Remove ${doc.title}`}
                          onClick={() => handleRemoveStandardDoc(doc.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {activeSpecializedDocs.map((spec) => {
                  const isRequired = spec.isMandatory;
                  return (
                    <div
                      key={spec.id}
                      className="p-3 border rounded-3 bg-white shadow-2xs d-flex align-items-center justify-content-between gap-3"
                    >
                      <div className="d-flex align-items-center gap-2 flex-grow-1 min-w-0">
                        <span className="fw-semibold text-dark small text-truncate">
                          {spec.title}
                        </span>
                        <span
                          className="badge bg-secondary-subtle text-dark border font-mono-code"
                          style={{ fontSize: '0.675rem' }}
                        >
                          Custom
                        </span>
                      </div>
                      <div className="d-flex align-items-center gap-3 flex-shrink-0">
                        <div className="form-check form-switch m-0 d-flex align-items-center gap-2">
                          <input
                            className="form-check-input cursor-pointer"
                            type="checkbox"
                            id={`req-toggle-${spec.id}`}
                            checked={isRequired}
                            onChange={() => handleToggleCustomDocRequired(spec.id)}
                            style={{ width: '2.25rem', height: '1.2rem', cursor: 'pointer' }}
                          />
                          <label
                            htmlFor={`req-toggle-${spec.id}`}
                            className={`small fw-semibold m-0 cursor-pointer ${
                              isRequired ? 'text-success' : 'text-secondary'
                            }`}
                            style={{ fontSize: '0.78rem', minWidth: '55px' }}
                          >
                            {isRequired ? 'Required' : 'Optional'}
                          </label>
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger d-inline-flex align-items-center justify-content-center p-1.5 rounded-2"
                          title="Remove document"
                          aria-label={`Remove ${spec.title}`}
                          onClick={() => handleRemoveCustomDoc(spec.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const currentStepData = steps[currentStep - 1] || steps[0];

  return (
    <div className="container-fluid px-4 py-4 map-assurance-wizard" style={{ maxWidth: '1280px' }}>
      {/* Top Breadcrumb & Title */}
      <div className="d-flex flex-wrap align-items-center justify-between gap-3 mb-3">
        <div>
          <h2 className="fw-bold text-slate-900 m-0 fs-3">Create Assurance Set</h2>
        </div>
      </div>

      {/* Segmented Step Header & Progress Bar */}
      <div className="card border shadow-sm rounded-3 bg-white mb-4 overflow-hidden">
        <div className="bg-light px-4 py-3 border-bottom">
          <div className="d-flex align-items-center justify-content-between flex-nowrap overflow-x-auto text-nowrap gap-2 pb-1">
            {steps.map((step, idx) => {
              const stepNum = idx + 1;
              const isCurrent = currentStep === stepNum;
              const isPast = currentStep > stepNum;
              return (
                <button
                  key={step.id}
                  type="button"
                  className={`btn btn-link p-0 text-decoration-none d-inline-flex align-items-center gap-2 text-nowrap transition-all ${isCurrent ? 'text-primary fw-bold' : isPast ? 'text-dark fw-semibold' : 'text-muted'
                    }`}
                  style={{ fontSize: '0.8125rem' }}
                  onClick={() => {
                    if (isPast || validateCurrentStep()) {
                      setCurrentStep(stepNum);
                    }
                  }}
                >
                  <span
                    className={`d-inline-flex align-items-center justify-content-center rounded-circle flex-shrink-0 ${isCurrent
                      ? 'bg-primary text-white shadow-2xs'
                      : isPast
                        ? 'bg-success text-white'
                        : 'bg-white text-secondary border'
                      }`}
                    style={{ width: '22px', height: '22px', fontSize: '0.725rem', fontWeight: 700 }}
                  >
                    {stepNum}
                  </span>
                  <span>{step.label}</span>
                  {idx < steps.length - 1 && (
                    <span className="text-secondary-subtle opacity-50 ms-1 select-none" style={{ fontSize: '0.75rem' }}>
                      &rsaquo;
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Wizard Main Content Body */}
        <div className="card-body p-4">
          {/* GENERAL TAB: identification, contract period, template privacy and stakeholders */}
          {currentStepData.id === 'step-general' && (
            <div className="d-flex flex-column gap-4">
              {/* Campaign Identification Card */}
              <div className="card border shadow-2xs rounded-3 bg-white">
                <div className="card-header bg-light border-bottom px-4 py-3">
                  <h5 className="fw-bold text-slate-900 m-0 fs-6">
                    Identification
                  </h5>
                </div>
                <div className="card-body p-4">
                  <div className="row g-3">
                    {/* Campaign Title */}
                    <div className="col-12 col-md-8">
                      <label className="form-label text-secondary small fw-semibold" htmlFor="grid-campaign-title">
                        Title <span className="text-danger">*</span>
                      </label>
                      <input
                        id="grid-campaign-title"
                        type="text"
                        className={`form-control bg-white text-dark border-secondary-subtle${animatingFields.has('grid-campaign-title') ? ' map-autofill-animate' : ''}${isDuplicateCampaignTitle(title, assuranceSets).isDuplicate || fieldErrors.title || (hasAttemptedSubmit && !title.trim()) ? ' is-invalid border-danger' : ''}`}
                        placeholder="e.g. Chevron Gorgon 2026"
                        value={title}
                        onChange={(e) => {
                          setTitle(e.target.value);
                          setFieldErrors((prev) => {
                            const u = { ...prev };
                            delete u.title;
                            return u;
                          });
                        }}
                        required
                      />
                      {fieldErrors.title && (
                        <div className="invalid-feedback d-block small mt-1 font-mono-code" style={{ fontSize: '0.75rem' }}>
                          {fieldErrors.title}
                        </div>
                      )}
                      {!fieldErrors.title && isDuplicateCampaignTitle(title, assuranceSets, editingDraftId).isDuplicate && (
                        <div className="invalid-feedback d-block small mt-1 font-mono-code" style={{ fontSize: '0.75rem' }}>
                          {isDuplicateCampaignTitle(title, assuranceSets, editingDraftId).reason}
                        </div>
                      )}
                    </div>

                    {/* the project is assigned by the invitation or the project page; otherwise it can be chosen */}
                    <div className="col-12 col-md-6">
                      <label className="form-label text-secondary small fw-semibold" htmlFor="grid-linked-project">
                        Project{' '}
                        {isProjectLocked ? null : (
                          <span className="text-secondary fw-normal fs-7">(Optional)</span>
                        )}
                      </label>
                      {isProjectLocked ? (
                        <input
                          id="grid-linked-project"
                          className="form-control bg-light text-dark border-secondary-subtle"
                          value={
                            selectedProject
                              ? `${selectedProject.id} — ${selectedProject.name}`
                              : selectedProjectId
                          }
                          readOnly
                          aria-describedby="grid-linked-project-help"
                        />
                      ) : (
                        <select
                          id="grid-linked-project"
                          className="form-select bg-white text-dark border-secondary-subtle"
                          value={selectedProjectId}
                          onChange={(e) => handleProjectChange(e.target.value)}
                        >
                          <option value="">No project</option>
                          {projectOptions.map((proj) => (
                            <option key={proj.id} value={proj.id}>
                              {proj.id} &mdash; {proj.name}
                            </option>
                          ))}
                        </select>
                      )}
                      {isProjectLocked && (
                        <div id="grid-linked-project-help" className="form-text small">
                          {requestContext
                            ? `Assigned by the invitation from ${requestContext.requestedByName}. Client: ${setClientOrg}. Created by: ${requestContext.assigneeName}.`
                            : 'Assigned by the project you came from.'}
                        </div>
                      )}
                    </div>

                    {/* Charter Window Dates */}
                    <div className="col-12 col-md-3">
                      <label className="form-label text-secondary small fw-semibold" htmlFor="grid-charter-start">
                        Contract Period Start <span className="text-danger">*</span>
                      </label>
                      <input
                        id="grid-charter-start"
                        type="date"
                        placeholder={initialPeriod.start}
                        className={`form-control bg-white text-dark border-secondary-subtle font-mono-code${fieldErrors.startDate ? ' is-invalid border-danger' : ''}`}
                        value={startDate}
                        onChange={(e) => {
                          const nextStart = e.target.value;
                          setStartDate(nextStart);
                          setComplianceDeadline((current) => (!current || (nextStart && current > nextStart) ? nextStart : current));
                          setFieldErrors((prev) => {
                            const u = { ...prev };
                            delete u.startDate;
                            delete u.endDate;
                            delete u.complianceDeadline;
                            return u;
                          });
                        }}
                        required
                      />
                      {fieldErrors.startDate && (
                        <div className="invalid-feedback d-block small mt-1 font-mono-code" style={{ fontSize: '0.75rem' }}>
                          {fieldErrors.startDate}
                        </div>
                      )}
                    </div>

                    <div className="col-12 col-md-3">
                      <label className="form-label text-secondary small fw-semibold" htmlFor="grid-charter-end">
                        Contract Period End <span className="text-danger">*</span>
                      </label>
                      <input
                        id="grid-charter-end"
                        type="date"
                        placeholder={initialPeriod.end}
                        className={`form-control bg-white text-dark border-secondary-subtle font-mono-code${fieldErrors.endDate ? ' is-invalid border-danger' : ''}`}
                        value={endDate}
                        onChange={(e) => {
                          setEndDate(e.target.value);
                          setFieldErrors((prev) => {
                            const u = { ...prev };
                            delete u.endDate;
                            return u;
                          });
                        }}
                        required
                      />
                      {fieldErrors.endDate && (
                        <div className="invalid-feedback d-block small mt-1 font-mono-code" style={{ fontSize: '0.75rem' }}>
                          {fieldErrors.endDate}
                        </div>
                      )}
                    </div>

                    <div className="col-12 col-md-4">
                      <label className="form-label text-secondary small fw-semibold" htmlFor="grid-compliance-deadline">
                        Compliance Deadline <span className="text-danger">*</span>
                      </label>
                      <input
                        id="grid-compliance-deadline"
                        type="date"
                        className={`form-control bg-white text-dark border-secondary-subtle font-mono-code${fieldErrors.complianceDeadline ? ' is-invalid border-danger' : ''}`}
                        value={complianceDeadline}
                        max={startDate || undefined}
                        onChange={(e) => {
                          setComplianceDeadline(e.target.value);
                          setFieldErrors((prev) => {
                            const u = { ...prev };
                            delete u.complianceDeadline;
                            return u;
                          });
                        }}
                        required
                        aria-describedby="grid-compliance-deadline-help"
                      />
                      <div id="grid-compliance-deadline-help" className="form-text small">
                        When this assurance set must be complete. On or before the contract start. Separate from the period the asset is chartered.
                      </div>
                      {fieldErrors.complianceDeadline && (
                        <div className="invalid-feedback d-block small mt-1 font-mono-code" style={{ fontSize: '0.75rem' }}>
                          {fieldErrors.complianceDeadline}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Template Privacy & Access Scope Card */}
              <div className="card border shadow-2xs rounded-3 bg-white">
                <div className="card-header bg-light border-bottom px-4 py-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
                  <div>
                    <h5 className="fw-bold text-slate-900 m-0 fs-6">
                      Template Privacy
                    </h5>
                    <div className="text-muted small">
                      Choose who can reuse this assurance set as a template.
                    </div>
                  </div>
                  <span className="badge bg-light text-dark border font-mono-code" style={{ fontSize: '0.7rem' }}>
                    {templatePrivacy === 'public' ? 'Public Template' : 'Organization Only'}
                  </span>
                </div>
                <div className="card-body p-4">
                  <div className="row g-3">
                    {/* Organization Only Option */}
                    <div className="col-12 col-md-6">
                      <label
                        className={`d-block p-3 border rounded-3 cursor-pointer h-100 transition-all ${templatePrivacy === 'organization'
                          ? 'border-primary bg-primary-subtle shadow-2xs'
                          : 'bg-white hover-bg-light'
                          }`}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="d-flex align-items-start gap-3">
                          <input
                            type="radio"
                            name="create-view-template-privacy"
                            value="organization"
                            checked={templatePrivacy === 'organization'}
                            onChange={() => setTemplatePrivacy('organization')}
                            className="form-check-input mt-1 cursor-pointer"
                          />
                          <div>
                            <div className="d-flex align-items-center gap-2">
                              <strong className="text-dark small">Organization Only</strong>
                            </div>
                            <p className="text-secondary small m-0 mt-1" style={{ fontSize: '0.8rem', lineHeight: '1.4' }}>
                              Only your organization can use this template.
                            </p>
                          </div>
                        </div>
                      </label>
                    </div>

                    {/* Public Template Option */}
                    <div className="col-12 col-md-6">
                      <label
                        className={`d-block p-3 border rounded-3 cursor-pointer h-100 transition-all ${templatePrivacy === 'public'
                          ? 'border-primary bg-primary-subtle shadow-2xs'
                          : 'bg-white hover-bg-light'
                          }`}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="d-flex align-items-start gap-3">
                          <input
                            type="radio"
                            name="create-view-template-privacy"
                            value="public"
                            checked={templatePrivacy === 'public'}
                            onChange={() => setTemplatePrivacy('public')}
                            className="form-check-input mt-1 cursor-pointer"
                          />
                          <div>
                            <div className="d-flex align-items-center gap-2">
                              <strong className="text-dark small">Public</strong>
                            </div>
                            <p className="text-secondary small m-0 mt-1" style={{ fontSize: '0.8rem', lineHeight: '1.4' }}>
                              Any organization on the platform can use this template.
                            </p>
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* General Information Section (Toggled / Collapsible) */}
              <div className="card border shadow-2xs rounded-3 bg-white">
                <div className="card-header bg-light border-bottom px-4 py-3 d-flex align-items-center justify-content-between">
                  <div>
                    <h5 className="fw-bold text-slate-900 m-0 fs-6">
                      Stakeholders
                    </h5>
                    <div className="text-muted small">
                      Choose who reviews and who is assigned.
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
                    onClick={() => setIsGeneralInfoExpanded(!isGeneralInfoExpanded)}
                  >
                    <span>{isGeneralInfoExpanded ? 'Collapse' : 'Expand'}</span>
                    <ChevronDown
                      className={`w-3 h-3 transition-transform duration-200 ${isGeneralInfoExpanded ? 'rotate-180' : ''}`}
                    />
                  </button>
                </div>

                {isGeneralInfoExpanded && (
                  <div className="card-body p-4">
                    <div className="row g-4">
                      {/* Workflow & Review Policies (MVP 1.5 - Review Channels & Validity/Suitability) */}
                      <div className="col-12">
                        <div className="p-4 bg-light border rounded-3 d-flex flex-column gap-3.5">
                          <div>
                            <strong className="text-dark small d-block mb-1.5" style={{ fontSize: '0.85rem' }}>
                              Review Channel
                            </strong>
                            <div className="text-muted small" style={{ fontSize: '0.8rem', lineHeight: '1.4' }}>
                              The client chooses who reviews: its own staff, a third party, the issuing authority, or a mix.
                            </div>
                          </div>

                          <div className="row g-3">
                            {[
                              { id: 'internal', label: 'Internal', desc: 'Client staff' },
                              { id: 'third_party', label: 'Third Party', desc: 'Independent surveyors and auditors' },
                              { id: 'issuing_authority', label: 'Issuing Authority', desc: 'AMSA or the flag state' },
                              { id: 'mixed', label: 'Mixed', desc: 'A combination of the above' },
                            ].map((modeOpt) => (
                              <div key={modeOpt.id} className="col-12 col-md-6 col-lg-3">
                                <button
                                  type="button"
                                  className={`w-100 p-3 px-3.5 rounded-3 border text-start transition-all d-flex flex-column gap-1.5 h-100 ${reviewMode === modeOpt.id
                                    ? 'bg-primary text-white border-primary shadow-2xs'
                                    : 'bg-white text-dark border-secondary-subtle hover-border-primary'
                                    }`}
                                  onClick={() => handleReviewModeChange(modeOpt.id as ReviewMode)}
                                >
                                  <div className={`fw-bold small lh-sm ${reviewMode === modeOpt.id ? 'text-white' : 'text-dark'}`} style={{ fontSize: '0.825rem' }}>
                                    {modeOpt.label}
                                  </div>
                                  <div className={`small ${reviewMode === modeOpt.id ? 'text-white-50' : 'text-muted'}`} style={{ fontSize: '0.74rem', lineHeight: '1.35' }}>
                                    {modeOpt.desc}
                                  </div>
                                </button>
                              </div>
                            ))}
                          </div>

                          {/* Authority Validation Method (when Issuing Authority or Mixed active) */}
                          {(reviewMode === 'issuing_authority' || reviewMode === 'mixed') && (
                            <div className="p-3 px-3.5 bg-info-subtle border border-info-subtle rounded-3">
                              <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
                                <div className="pe-2">
                                  <strong className="text-dark small d-block mb-1" style={{ fontSize: '0.825rem' }}>
                                    Authority Validation
                                  </strong>
                                  <div className="text-secondary small" style={{ fontSize: '0.75rem', lineHeight: '1.35' }}>
                                    Choose how the authority validates documents.
                                  </div>
                                </div>
                                <div className="d-flex align-items-center gap-2">
                                  <select
                                    className="form-select form-select-sm bg-white text-dark border-secondary-subtle font-mono-code px-3 py-1.5"
                                    value={authorityValidationMethod}
                                    onChange={(e) => setAuthorityValidationMethod(e.target.value as AuthorityValidationMethod)}
                                    style={{ fontSize: '0.78rem', minWidth: '290px' }}
                                  >
                                    <option value="api">AMSA API</option>
                                    <option value="direct_link">Flag State Link</option>
                                    <option value="manual">Class Society Portal</option>
                                  </select>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Grouped Assurance Checks & Workflow Gates */}
                          <div className="p-4 px-4 bg-white border rounded-3 d-flex flex-column gap-3 shadow-2xs">
                            <div>
                              <strong className="text-dark small d-block mb-1" style={{ fontSize: '0.825rem' }}>
                                Checks
                              </strong>
                              <div className="text-muted small" style={{ fontSize: '0.76rem', lineHeight: '1.35' }}>
                                Choose which checks and stages apply.
                              </div>
                            </div>

                            <div className="row g-3">
                              <div className="col-12 col-md-6">
                                <div className="p-3 px-3.5 bg-light-subtle border rounded-3 d-flex align-items-start gap-3 h-100">
                                  <div className="form-check form-switch m-0 mt-0.5">
                                    <input
                                      className="form-check-input cursor-pointer"
                                      type="checkbox"
                                      checked={validityCheckRequired}
                                      onChange={(e) => setValidityCheckRequired(e.target.checked)}
                                      id="chk-validity"
                                      style={{ width: '2.25rem', height: '1.25rem' }}
                                    />
                                  </div>
                                  <div className="flex-grow-1">
                                    <label htmlFor="chk-validity" className="fw-semibold text-dark small m-0 cursor-pointer d-block">
                                      Statutory Validity Check
                                    </label>
                                    <div className="text-muted small mt-1" style={{ fontSize: '0.75rem', lineHeight: '1.35' }}>
                                      Checks that documents are authentic, in date, and in good standing.
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="col-12 col-md-6">
                                <div className="p-3 px-3.5 bg-light-subtle border rounded-3 d-flex align-items-start gap-3 h-100">
                                  <div className="form-check form-switch m-0 mt-0.5">
                                    <input
                                      className="form-check-input cursor-pointer"
                                      type="checkbox"
                                      checked={suitabilityCheckRequired}
                                      onChange={(e) => setSuitabilityCheckRequired(e.target.checked)}
                                      id="chk-suitability"
                                      style={{ width: '2.25rem', height: '1.25rem' }}
                                    />
                                  </div>
                                  <div className="flex-grow-1">
                                    <label htmlFor="chk-suitability" className="fw-semibold text-dark small m-0 cursor-pointer d-block">
                                      Operational Suitability Check
                                    </label>
                                    <div className="text-muted small mt-1" style={{ fontSize: '0.75rem', lineHeight: '1.35' }}>
                                      Checks that the asset suits the charter and scope.
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Workflow Gate Switches grouped inside the container */}
                            <div className="pt-3 border-top d-flex flex-wrap gap-4 align-items-center">
                              <div className="form-check form-switch m-0 d-flex align-items-center gap-2">
                                <input
                                  className="form-check-input cursor-pointer"
                                  type="checkbox"
                                  checked={verificationRequired}
                                  onChange={(e) => setVerificationRequired(e.target.checked)}
                                  id="wf-verify"
                                />
                                <label htmlFor="wf-verify" className="form-check-label text-dark small fw-semibold cursor-pointer ps-1">
                                  Verification Required
                                </label>
                              </div>

                              <div className="form-check form-switch m-0 d-flex align-items-center gap-2">
                                <input
                                  className="form-check-input cursor-pointer"
                                  type="checkbox"
                                  checked={inspectionRequired}
                                  onChange={(e) => setInspectionRequired(e.target.checked)}
                                  id="wf-inspect"
                                />
                                <label htmlFor="wf-inspect" className="form-check-label text-dark small fw-semibold cursor-pointer ps-1">
                                  Inspection Required
                                </label>
                              </div>

                              <div className="form-check form-switch m-0 d-flex align-items-center gap-2">
                                <input
                                  className="form-check-input cursor-pointer"
                                  type="checkbox"
                                  checked={approvalRequired}
                                  onChange={(e) => setApprovalRequired(e.target.checked)}
                                  id="wf-approve"
                                />
                                <label htmlFor="wf-approve" className="form-check-label text-dark small fw-semibold cursor-pointer ps-1">
                                  Approval Required
                                </label>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Stakeholder Role Assignments (MVP 1:1 Set-Level Mapping) */}
                      <div className="col-12">
                        <div className="p-4 border rounded-3 bg-light-subtle">
                          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
                            <div>
                              <strong className="text-dark small d-block mb-1" style={{ fontSize: '0.85rem' }}>
                                Stakeholders
                              </strong>
                              <div className="text-muted" style={{ fontSize: '0.78rem' }}>
                                The submitter is filled in from the service provider. Choose a submitter, a client admin, or an administrator of that organization, then one verifier, inspector, and approver.
                              </div>
                            </div>
                          </div>

                          <div className="row g-4 pt-1">
                            <div className="col-12 col-md-6 col-lg-4 d-flex flex-column">
                              <div className="d-flex align-items-center justify-content-between mb-2" style={{ minHeight: '22px' }}>
                                <label className="form-label text-secondary small fw-semibold m-0" htmlFor="assign-sub">
                                  Submitter <span className="text-danger">*</span>
                                </label>
                              </div>
                              <select
                                id="assign-sub"
                                className={`form-select form-select-sm bg-white text-dark border-secondary-subtle${fieldErrors.submitter ? ' is-invalid border-danger' : ''}`}
                                value={assignedSubmitterId}
                                onChange={(e) => {
                                  setAssignedSubmitterId(e.target.value);
                                  setFieldErrors((prev) => {
                                    const next = { ...prev };
                                    delete next.submitter;
                                    return next;
                                  });
                                }}
                              >
                                <option value="">Select submitter</option>
                                {submitterCandidates.map((user) => (
                                  <option key={user.id} value={user.id}>
                                    {user.name} — {user.roles.includes('Submitter') ? 'Submitter' : user.roles.includes('C Admin') ? 'Client Admin' : 'Administrator'} ({user.organization})
                                  </option>
                                ))}
                              </select>
                              <div className="text-muted mt-1" style={{ fontSize: '0.75rem' }}>
                                {serviceProviderOrg
                                  ? `Service provider: ${serviceProviderOrg}.`
                                  : 'Select the asset to name the service provider.'}
                              </div>
                              {fieldErrors.submitter && (
                                <div className="text-danger small mt-1 font-mono-code" style={{ fontSize: '0.72rem' }}>
                                  {fieldErrors.submitter}
                                </div>
                              )}
                              {/* {selectedSubmitterForProvider &&
                                !orgFieldMatches(serviceProviderOrg, selectedSubmitterForProvider.organization) && (
                                  <div className="alert alert-warning py-2 px-2 mt-2 mb-0" role="status" style={{ fontSize: '0.75rem' }}>
                                    {selectedSubmitterForProvider.name} is in {selectedSubmitterForProvider.organization}. A submitter must belong to the same organization as the vessel provider ({serviceProviderOrg}).
                                  </div>
                                )} */}
                            </div>
                            {verificationRequired && (
                              <div className="col-12 col-md-6 col-lg-4 d-flex flex-column">
                                <div className="d-flex align-items-center justify-content-between mb-2" style={{ minHeight: '22px' }}>
                                  <label className="form-label text-secondary small fw-semibold m-0" htmlFor="assign-ver">
                                    Verifier <span className="text-danger">*</span>
                                  </label>
                                </div>
                                {reviewMode === 'issuing_authority' ? (
                                  <div className="p-2 px-3 bg-light border border-secondary-subtle rounded-2 d-flex align-items-center justify-content-between text-secondary font-mono-code" style={{ minHeight: '34px' }}>
                                    <span className="fw-semibold text-primary small">Handled by the authority</span>
                                    <span className="badge bg-primary-subtle text-primary border border-primary-subtle font-sans" style={{ fontSize: '0.72rem' }}>
                                      AMSA
                                    </span>
                                  </div>
                                ) : (
                                  <select
                                    id="assign-ver"
                                    className={`form-select form-select-sm bg-white text-dark border-secondary-subtle${fieldErrors.verifier ? ' is-invalid border-danger' : ''}`}
                                    value={assignedVerifier}
                                    onChange={(e) => handleVerifierChange(e.target.value)}
                                  >
                                    {verifierCandidates.map((u) => {
                                      const channel = getReviewChannelForUser(u, clientOrg);
                                      const channelTag =
                                        channel === 'issuing_authority'
                                          ? 'Regulatory Authority'
                                          : channel === 'third_party'
                                            ? 'Appointed 3rd Party'
                                            : 'Internal Client';
                                      return (
                                        <option key={u.id} value={u.id}>
                                          {u.name} ({u.organization}) · [{channelTag}]
                                        </option>
                                      );
                                    })}
                                  </select>
                                )}
                                {fieldErrors.verifier && reviewMode !== 'issuing_authority' && (
                                  <div className="text-danger small mt-1 font-mono-code" style={{ fontSize: '0.72rem' }}>
                                    {fieldErrors.verifier}
                                  </div>
                                )}
                              </div>
                            )}

                            {inspectionRequired && (
                              <div className="col-12 col-md-6 col-lg-4 d-flex flex-column">
                                <div className="d-flex align-items-center justify-content-between mb-2" style={{ minHeight: '22px' }}>
                                  <label className="form-label text-secondary small fw-semibold m-0" htmlFor="assign-ins">
                                    Inspector <span className="text-danger">*</span>
                                  </label>
                                </div>
                                <select
                                  id="assign-ins"
                                  className={`form-select form-select-sm bg-white text-dark border-secondary-subtle${fieldErrors.inspector ? ' is-invalid border-danger' : ''}`}
                                  value={assignedInspector}
                                  onChange={(e) => {
                                    setAssignedInspector(e.target.value);
                                    setFieldErrors((prev) => {
                                      const u = { ...prev };
                                      delete u.inspector;
                                      return u;
                                    });
                                  }}
                                >
                                  {inspectorCandidates.map((u) => (
                                    <option key={u.id} value={u.id}>
                                      {u.name} ({u.organization})
                                    </option>
                                  ))}
                                </select>
                                {fieldErrors.inspector && (
                                  <div className="text-danger small mt-1 font-mono-code" style={{ fontSize: '0.72rem' }}>
                                    {fieldErrors.inspector}
                                  </div>
                                )}
                              </div>
                            )}

                            {approvalRequired && (
                              <div className="col-12 col-md-6 col-lg-4 d-flex flex-column">
                                <div className="d-flex align-items-center justify-content-between mb-2" style={{ minHeight: '22px' }}>
                                  <label className="form-label text-secondary small fw-semibold m-0" htmlFor="assign-app">
                                    Approver <span className="text-danger">*</span>
                                  </label>
                                  {verificationRequired && reviewMode !== 'issuing_authority' && (
                                    <div className="form-check form-check-inline m-0 d-flex align-items-center gap-1.5">
                                      <input
                                        type="checkbox"
                                        id="chk-same-as-verifier"
                                        className="form-check-input cursor-pointer m-0"
                                        checked={isApproverSameAsVerifier}
                                        onChange={(e) => handleToggleSameAsVerifier(e.target.checked)}
                                        style={{ width: '0.95rem', height: '0.95rem' }}
                                      />
                                      <label
                                        htmlFor="chk-same-as-verifier"
                                        className="form-check-label text-primary small fw-semibold cursor-pointer user-select-none"
                                        style={{ fontSize: '0.75rem' }}
                                      >
                                        Same as Verifier
                                      </label>
                                    </div>
                                  )}
                                </div>
                                <select
                                  id="assign-app"
                                  className={`form-select form-select-sm bg-white text-dark border-secondary-subtle${fieldErrors.approver ? ' is-invalid border-danger' : ''}`}
                                  value={isApproverSameAsVerifier ? assignedVerifier : assignedApprover}
                                  disabled={isApproverSameAsVerifier}
                                  onChange={(e) => {
                                    setAssignedApprover(e.target.value);
                                    setFieldErrors((prev) => {
                                      const u = { ...prev };
                                      delete u.approver;
                                      return u;
                                    });
                                  }}
                                >
                                  {effectiveApproverCandidates.map((u) => {
                                    const channel = getReviewChannelForUser(u, clientOrg);
                                    const channelTag =
                                      channel === 'issuing_authority'
                                        ? 'Regulatory Authority'
                                        : channel === 'third_party'
                                          ? 'Appointed 3rd Party'
                                          : 'Internal Client';
                                    return (
                                      <option key={u.id} value={u.id}>
                                        {u.name} ({u.organization}) · [{channelTag}]
                                      </option>
                                    );
                                  })}
                                </select>
                                {fieldErrors.approver && (
                                  <div className="text-danger small mt-1 font-mono-code" style={{ fontSize: '0.72rem' }}>
                                    {fieldErrors.approver}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div >
          )}

          {/* OBJECTS TAB: everything the set covers; every object is equal (ADR 0029) */}
          {currentStepData.id === 'step-objects' && (
            <div className="d-flex flex-column gap-4">
                {/* Covered Assurance Objects Section (ADR 0029) */}
                <div className="card border shadow-2xs rounded-3 bg-white" id="covered-assurance-objects-card">
                  <div className="card-header bg-light border-bottom px-4 py-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
                    <div>
                      <h5 className="fw-bold text-slate-900 m-0 fs-6">
                        Covered Assurance Objects ({selectedAssuranceObjects.length})
                      </h5>
                      <div className="text-muted small mt-0.5">
                        Add every vessel, crew member, piece of equipment, procedure, method, document or organization this set covers.
                      </div>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <button
                        type="button"
                        id="btn-load-port-entry-bundle"
                        className="btn btn-sm btn-outline-primary fw-semibold d-inline-flex align-items-center gap-1.5"
                        onClick={() => {
                          const v = vessels.find((x) => x.id === vesselId) || vessels[0];
                          const c = crew.find((x) => x.id === (selectedCrewId || crew[0]?.id)) || crew[0];
                          const eq = equipment.find((x) => x.id === (selectedEquipmentId || equipment[0]?.id)) || equipment[0];
                          const portProc = SEEDED_OPERATIONAL_OBJECTS.find((o) => o.id === 'OBJ-PROC-PORT-01')!;
                          const towMeth = SEEDED_OPERATIONAL_OBJECTS.find((o) => o.id === 'OBJ-METH-TOW-01')!;
                          const portDoc = SEEDED_OPERATIONAL_OBJECTS.find((o) => o.id === 'OBJ-DOC-CLR-01')!;
                          const portOrg = SEEDED_OPERATIONAL_OBJECTS.find((o) => o.id === 'OBJ-ORG-PPA-01')!;
                          const portSetObjects: AssuranceObject[] = [];
                          if (v) portSetObjects.push(vesselToAssuranceObject(v));
                          if (c) portSetObjects.push(crewToAssuranceObject(c));
                          if (eq) portSetObjects.push(equipmentToAssuranceObject(eq));
                          portSetObjects.push(portProc, towMeth, portDoc, portOrg);
                          setSelectedAssuranceObjects([
                            ...selectedAssuranceObjects.filter((o) => lockedObjectIds.includes(o.id) && !portSetObjects.some((p) => p.id === o.id)),
                            ...portSetObjects,
                          ]);
                          setTitle((prev) => prev.includes('Port Entry') ? prev : `${clientOrg} - Port Entry Assurance Set`);
                        }}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Load Port-Entry Bundle
                      </button>
                    </div>
                  </div>
                  <div className="card-body p-4">
                    {fieldErrors.objects && (
                      <div className="alert alert-danger small py-2 mb-3" role="alert">
                        {fieldErrors.objects}
                      </div>
                    )}
                    {selectedAssuranceObjects.length === 0 ? (
                      <div className="text-muted small">No assurance objects attached yet.</div>
                    ) : (
                      <div className="table-responsive">
                        <table className="table table-sm table-hover align-middle mb-0">
                          <thead className="table-light small text-secondary">
                            <tr>
                              <th scope="col" style={{ width: '120px' }}>Type</th>
                              <th scope="col">Name</th>
                              <th scope="col">Owner Organization</th>
                              <th scope="col">Identifier / Tag</th>
                              <th scope="col" className="text-end" style={{ width: '80px' }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedAssuranceObjects.map((obj) => {
                              const objectScope = getAssuranceObjectScope(obj.type);
                              const conflicts = objectScope
                                ? getAssetPeriodConflicts(objectScope, obj.id, startDate, endDate, assuranceSets, editingDraftId || undefined)
                                : [];
                              const isLockedObject = lockedObjectIds.includes(obj.id);
                              const objectError = fieldErrors[`object_${obj.id}`];
                              return (
                                <React.Fragment key={obj.id}>
                                  <tr data-testid={`assurance-object-row-${obj.id}`} className={conflicts.length > 0 || objectError ? 'table-danger' : ''}>
                                    <td>
                                      <span className={`badge ${obj.type === 'vessel' ? 'bg-primary text-white' :
                                          obj.type === 'person' ? 'bg-success text-white' :
                                            obj.type === 'equipment' ? 'bg-warning text-dark' :
                                              obj.type === 'procedure' ? 'bg-info text-dark' :
                                                obj.type === 'method' ? 'bg-secondary text-white' :
                                                  obj.type === 'document' ? 'bg-dark text-white' : 'bg-light text-dark border'
                                        } text-capitalize font-mono-code`}>
                                        {obj.type}
                                      </span>
                                    </td>
                                    <td className="fw-semibold text-dark">
                                      {obj.name}
                                      {isLockedObject && (
                                        <div className="text-secondary small fw-normal">Set by the page you came from.</div>
                                      )}
                                      {objectError && conflicts.length === 0 && (
                                        <div className="text-danger small fw-normal font-mono-code" style={{ fontSize: '0.75rem' }}>
                                          {objectError}
                                        </div>
                                      )}
                                    </td>
                                    <td className="text-secondary small">{obj.ownerOrganization}</td>
                                    <td className="font-mono-code small text-secondary">{obj.identifier || '—'}</td>
                                    <td className="text-end">
                                      {!isLockedObject && (
                                        <button
                                          type="button"
                                          className="btn btn-sm btn-link text-danger p-0"
                                          title="Remove object"
                                          aria-label={`Remove ${obj.name}`}
                                          onClick={() => {
                                            setSelectedAssuranceObjects((prev) => prev.filter((o) => o.id !== obj.id));
                                            setFieldErrors((prev) => {
                                              const u = { ...prev };
                                              delete u[`object_${obj.id}`];
                                              return u;
                                            });
                                          }}
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                  {objectScope && conflicts.length > 0 && (
                                    <tr>
                                      <td colSpan={5} className="border-0 pt-0">
                                        {renderCollisionAlert(objectScope, obj.id, obj.name, conflicts)}
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Add Object row */}
                    <div className="row g-2 align-items-center mt-3 pt-3 border-top">
                      <div className="col-12 col-md-3">
                        <select
                          id="grid-add-object-type"
                          aria-label="Object type"
                          className="form-select form-select-sm"
                          value={newObjectType}
                          onChange={(e) => {
                            setNewObjectType(e.target.value as AssuranceObjectType);
                            setNewObjectId('');
                          }}
                        >
                          <option value="vessel">Vessel</option>
                          <option value="person">Person / Crew</option>
                          <option value="equipment">Equipment</option>
                          <option value="procedure">Procedure</option>
                          <option value="method">Method</option>
                          <option value="document">Document</option>
                          <option value="organization">Organization</option>
                        </select>
                      </div>
                      <div className="col-12 col-md-6">
                        <select
                          id="grid-add-object-item"
                          aria-label="Object to add"
                          className="form-select form-select-sm"
                          value={newObjectId}
                          onChange={(e) => setNewObjectId(e.target.value)}
                        >
                          <option value="">Select {newObjectType} to add...</option>
                          {availableObjectsForType.map((o) => {
                            const isAdded = selectedAssuranceObjects.some((x) => x.id === o.id);
                            const optionScope = getAssuranceObjectScope(o.type);
                            /* an asset already contracted for this period cannot be added */
                            const conflicts = optionScope
                              ? getAssetPeriodConflicts(optionScope, o.id, startDate, endDate, assuranceSets, editingDraftId || undefined)
                              : [];
                            return (
                              <option key={o.id} value={o.id} disabled={isAdded || conflicts.length > 0}>
                                {o.name} ({o.ownerOrganization})
                                {isAdded ? ' — added' : conflicts.length > 0 ? ` — ${formatBookedLabel(conflicts[0])}` : ''}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                      <div className="col-12 col-md-3">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary w-100 d-inline-flex align-items-center justify-content-center gap-1"
                          disabled={!newObjectId}
                          onClick={() => {
                            const found = availableObjectsForType.find((o) => o.id === newObjectId);
                            if (found && !selectedAssuranceObjects.some((o) => o.id === found.id)) {
                              setSelectedAssuranceObjects((prev) => [...prev, found]);
                              setNewObjectId('');
                              setFieldErrors((prev) => {
                                const u = { ...prev };
                                delete u.objects;
                                return u;
                              });
                            }
                          }}
                        >
                          <Plus className="w-4 h-4" />
                          Add Object
                        </button>
                      </div>
                      {newObjectType === 'vessel' && (
                        <div className="col-12 text-secondary small" style={{ fontSize: '0.78rem' }}>
                          Your own vessels are not listed. You become the client of the vessel you select.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
            </div>
          )}

          {/* REQUIREMENTS TAB: the required documents of each asset type the objects cover */}
          {currentStepData.id === 'step-requirements' && (
            <div className="d-flex flex-column gap-4">
              {selectedScopes.length === 0 ? (
                <div className="card border shadow-2xs rounded-3 bg-white">
                  <div className="card-body p-4 text-secondary small">
                    No standard documents for these objects. Vessels, crew members and equipment bring their required documents here; documents for procedures, methods, documents and organizations are not available yet.
                  </div>
                </div>
              ) : (
                selectedScopes.map((scope) => {
                  const ScopeIcon = scope === 'Vessel' ? Ship : scope === 'Crew' ? Users : Wrench;
                  return (
                    <section key={scope} className="d-flex flex-column gap-3" aria-labelledby={`requirements-heading-${scope}`}>
                      <h4 id={`requirements-heading-${scope}`} className="fw-bold text-slate-900 fs-5 m-0 d-flex align-items-center gap-2">
                        <ScopeIcon className="w-5 h-5 text-primary" aria-hidden="true" />
                        {scope} documents
                      </h4>
                      {renderSubtypeSection(scope)}
                    </section>
                  );
                })
              )}
            </div>
          )}

          {/* FINAL STEP: Review & Initiate */}
          {
            currentStepData.id === 'step-review' && (
              <div className="d-flex flex-column gap-4">
                <div className="card border shadow-2xs rounded-3 bg-white">
                  <div className="card-header bg-light border-bottom px-4 py-3">
                    <h5 className="fw-bold text-slate-900 m-0 fs-6">
                      Review
                    </h5>
                  </div>
                  <div className="card-body p-4">
                    <div className="row g-4">
                      <div className="col-12 col-md-6">
                        <div className="p-3 bg-light rounded-3 border h-100">
                          <strong className="text-dark small d-block mb-1">Details</strong>
                          <div className="fw-bold text-primary fs-6">{title}</div>
                          <div className="text-secondary small mt-2">
                            <strong>Objects:</strong> {selectedAssuranceObjects.length}
                          </div>
                          {selectedScopes.map((scope) => (
                            <div key={scope} className="text-secondary small mt-1">
                              <strong>{scope}:</strong>{' '}
                              {scope === 'Crew' ? (
                                <span className="text-dark fw-semibold">
                                  {selectedCrewMembers.length} Selected Crew Member{selectedCrewMembers.length === 1 ? '' : 's'} (itemized below)
                                </span>
                              ) : (
                                <span className="text-dark fw-semibold">{getScopeAssetSummary(scope)}</span>
                              )}
                            </div>
                          ))}
                          {selectedAssuranceObjects.some((o) => !getAssuranceObjectScope(o.type)) && (
                            <div className="text-secondary small mt-1">
                              <strong>Other objects:</strong>{' '}
                              <span className="text-dark fw-semibold">
                                {selectedAssuranceObjects
                                  .filter((o) => !getAssuranceObjectScope(o.type))
                                  .map((o) => `${o.name} (${o.type})`)
                                  .join(', ')}
                              </span>
                            </div>
                          )}
                          <div className="text-secondary small mt-1">
                            <strong>Contract Period:</strong> {startDate} to {endDate}
                          </div>
                          <div className="text-secondary small mt-1">
                            <strong>Compliance Deadline:</strong> {complianceDeadline}
                          </div>
                          {selectedProject && (
                            <div className="text-secondary small mt-1">
                              <strong>Project:</strong> {selectedProject.name}{' '}
                              <span className="font-mono-code">({selectedProject.id})</span>
                            </div>
                          )}
                          {requestContext && (
                            <div className="text-secondary small mt-1">
                              <strong>Client:</strong> {setClientOrg} &middot;{' '}
                              <strong>Created by:</strong> {requestContext.assigneeName}
                            </div>
                          )}
                          <div className="text-secondary small mt-1 d-flex align-items-center gap-2">
                            <strong>Template:</strong>
                            <span className={`badge ${templatePrivacy === 'public' ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-secondary-subtle text-dark border'} font-mono-code`} style={{ fontSize: '0.675rem' }}>
                              {templatePrivacy === 'public' ? 'Public' : 'Organization Only'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="col-12 col-md-6">
                        <div className="p-3 bg-light rounded-3 border h-100">
                          <strong className="text-dark small d-block mb-1">Stakeholders</strong>
                          <div className="text-secondary small"><strong>Submitter:</strong> {submitterLabel}</div>
                          <div className="text-secondary small"><strong>Verifier:</strong> {verificationRequired ? (selectedVerifier ? `${selectedVerifier.name} (${selectedVerifier.organization})` : 'Pending') : 'N/A'}</div>
                          <div className="text-secondary small"><strong>Inspector:</strong> {inspectionRequired ? (selectedInspector ? `${selectedInspector.name} (${selectedInspector.organization})` : 'Pending') : 'N/A'}</div>
                          <div className="text-secondary small"><strong>Approver:</strong> {approvalRequired ? (selectedApprover ? `${selectedApprover.name} (${selectedApprover.organization})` : 'Pending') : 'N/A'}</div>

                          <div className="pt-2 mt-2 border-top">
                            <strong className="text-dark small d-block mb-1">Review</strong>
                            <div className="d-flex flex-wrap gap-1.5 mb-1">
                              <span className="badge bg-primary-subtle text-primary border border-primary-subtle font-mono-code" style={{ fontSize: '0.675rem' }}>
                                Review: {reviewMode === 'internal' ? 'Internal' : reviewMode === 'third_party' ? 'Third Party' : reviewMode === 'issuing_authority' ? 'Issuing Authority' : 'Mixed Multi-Channel'}
                              </span>
                              {validityCheckRequired && (
                                <span className="badge bg-success-subtle text-success border border-success-subtle font-mono-code" style={{ fontSize: '0.675rem' }}>
                                  Statutory Validity Check
                                </span>
                              )}
                              {suitabilityCheckRequired && (
                                <span className="badge bg-info-subtle text-info-emphasis border border-info-subtle font-mono-code" style={{ fontSize: '0.675rem' }}>
                                  Operational Suitability Check
                                </span>
                              )}
                            </div>
                            {(reviewMode === 'issuing_authority' || reviewMode === 'mixed') && (
                              <div className="text-muted small" style={{ fontSize: '0.72rem' }}>
                                Authority Validation: {authorityValidationMethod === 'api' ? 'AMSA API' : authorityValidationMethod === 'direct_link' ? 'Flag State Link' : 'Class Society Portal'}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Requirements summary: one card per ticked scope */}
                      <div className="col-12">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                          <strong className="text-dark small d-block">
                            Requirements
                          </strong>
                        </div>

                        <div className="row g-3">
                          {selectedScopes.map((scope) => {
                            const standardCount = SUBTYPE_STANDARD_DOCS[scope].filter((d) => docToggles[d.id]).length;
                            const customCount = specializedDocs.filter((d) => d.subtype === scope && d.isEnabled).length;
                            const isCrew = scope === 'Crew';
                            return (
                              <div key={scope} className={isCrew ? 'col-12' : 'col-12 col-md-6'}>
                                <div className="p-3 bg-white border rounded-3 shadow-2xs h-100">
                                  <div className="d-flex align-items-center justify-content-between mb-2">
                                    <strong className="text-dark small">{scope}</strong>
                                    <span className="badge bg-dark text-white font-mono-code" style={{ fontSize: '0.675rem' }}>
                                      {standardCount + customCount} Docs
                                    </span>
                                  </div>
                                  {isCrew ? (
                                    <div>
                                      <div className="d-flex align-items-center justify-content-between mb-2 text-secondary small" style={{ fontSize: '0.78rem' }}>
                                        <span className="fw-semibold text-dark">
                                          {selectedCrewMembers.length} Selected Crew Member{selectedCrewMembers.length === 1 ? '' : 's'}
                                        </span>
                                        <span>Standard: {standardCount} &middot; Custom: {customCount}</span>
                                      </div>
                                      <div className="table-responsive border rounded-3 overflow-hidden bg-white mt-1">
                                        <table className="table table-hover table-sm align-middle mb-0" style={{ fontSize: '0.8rem' }}>
                                          <thead className="table-light text-secondary border-bottom">
                                            <tr>
                                              <th className="py-2 px-3 fw-semibold">Crew Member</th>
                                              <th className="py-2 px-3 fw-semibold">Rank</th>
                                              <th className="py-2 px-3 fw-semibold font-mono-code">Seaman's Book</th>
                                              <th className="py-2 px-3 fw-semibold">Organization</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {selectedCrewMembers.length === 0 ? (
                                              <tr>
                                                <td colSpan={4} className="py-3 px-3 text-center text-secondary">
                                                  No crew members selected
                                                </td>
                                              </tr>
                                            ) : (
                                              selectedCrewMembers.map((c) => (
                                                <tr key={c.id}>
                                                  <td className="py-2 px-3 fw-semibold text-dark">{c.fullName}</td>
                                                  <td className="py-2 px-3 text-secondary">{c.rank}</td>
                                                  <td className="py-2 px-3 font-mono-code text-secondary">{c.seamansBookNo || c.id}</td>
                                                  <td className="py-2 px-3 text-secondary">{c.organization}</td>
                                                </tr>
                                              ))
                                            )}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="p-2 bg-light rounded-2 text-secondary small" style={{ fontSize: '0.78rem' }}>
                                      <div className="fw-semibold text-dark">{getScopeAssetSummary(scope)}</div>
                                      <div className="mt-1">Standard: {standardCount} · Custom: {customCount}</div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Required & Added Documents Needed for Assurance Set */}
                      {(() => {
                        const activeSubtypes = orderAssuranceScopes(selectedScopes);

                        const allNeededDocs: { subtype: AssuranceSubtype; title: string; isCustom: boolean; isMandatory: boolean }[] = [];
                        activeSubtypes.forEach((subtype) => {
                          SUBTYPE_STANDARD_DOCS[subtype].forEach((doc) => {
                            if (docToggles[doc.id]) {
                              allNeededDocs.push({
                                subtype,
                                title: doc.title,
                                isCustom: false,
                                isMandatory: docRequired[doc.id] ?? doc.isMandatory,
                              });
                            }
                          });
                          specializedDocs.filter((d) => d.subtype === subtype && d.isEnabled).forEach((spec) => {
                            allNeededDocs.push({
                              subtype,
                              title: spec.title,
                              isCustom: true,
                              isMandatory: spec.isMandatory,
                            });
                          });
                        });

                        const standardCount = allNeededDocs.filter((d) => !d.isCustom).length;
                        const addedCount = allNeededDocs.filter((d) => d.isCustom).length;

                        return (
                          <div className="col-12">
                            <div className="p-3 bg-light-subtle rounded-3 border border-secondary-subtle">
                              <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                                <div className="d-flex align-items-center gap-2">
                                  <FileCheck className="text-primary" style={{ width: '18px', height: '18px' }} />
                                  <strong className="text-dark small">Required Documents ({allNeededDocs.length})</strong>
                                </div>
                                <span className="badge bg-light text-secondary border font-mono-code" style={{ fontSize: '0.75rem' }}>
                                  {standardCount} Required · {addedCount} Added
                                </span>
                              </div>
                              <p className="text-secondary small mb-3" style={{ fontSize: '0.8125rem' }}>
                                These documents are required for this assurance set. Existing documents will only attach themselves or show after the set has been created.
                              </p>
                              {allNeededDocs.length === 0 ? (
                                <div className="text-muted small fst-italic">No documents required or added for this set.</div>
                              ) : (
                                <div className="d-flex flex-column gap-2.5">
                                  {activeSubtypes.map((sub) => {
                                    const subDocs = allNeededDocs.filter((d) => d.subtype === sub);
                                    if (subDocs.length === 0) return null;
                                    return (
                                      <div key={sub} className="bg-white p-3 rounded-2 border">
                                        <div className="fw-semibold text-dark small mb-2">
                                          {sub} Scope Documents ({subDocs.length})
                                        </div>
                                        <div className="d-flex flex-column gap-1.5">
                                          {subDocs.map((doc, idx) => (
                                            <div
                                              key={idx}
                                              className="d-flex align-items-center justify-content-between p-2 rounded-1 bg-light small"
                                            >
                                              <span className="text-dark fw-medium">{doc.title}</span>
                                              <span
                                                className={`badge ${doc.isCustom ? 'bg-primary-subtle text-primary border border-primary-subtle' : doc.isMandatory ? 'bg-secondary-subtle text-dark border' : 'bg-light text-secondary border'} font-mono-code`}
                                                style={{ fontSize: '0.7rem' }}
                                              >
                                                {doc.isCustom ? 'Added' : doc.isMandatory ? 'Required' : 'Optional'}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            )}
        </div>

        {/* Wizard Footer Navigation Bar */}
        <div className="card-footer bg-light border-top px-4 py-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-outline-secondary px-3.5 py-1.5"
              onClick={handleCancelClick}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary px-3.5 py-1.5 fw-semibold"
              onClick={handleSaveDraft}
              title={editingDraftId ? "Save updated state to current draft" : "Save current progress as a draft and resume later"}
            >
              {editingDraftId ? 'Save Draft' : 'Save as Draft'}
            </button>
          </div>

          <div className="d-flex align-items-center gap-2">
            {currentStep > 1 && (
              <button
                type="button"
                className="btn btn-outline-primary px-3.5 py-1.5 fw-semibold"
                onClick={handlePrevious}
              >
                Back
              </button>
            )}

            {currentStep < totalSteps ? (
              <button
                type="button"
                className="btn btn-primary text-white px-4 py-1.5 fw-semibold"
                onClick={handleNext}
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                className="btn text-white px-5 py-2 fw-semibold shadow-sm"
                style={{ backgroundColor: 'rgb(11, 27, 43)', borderColor: 'rgb(11, 27, 43)' }}
                onClick={handleSubmit}
              >
                Create Assurance Set
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Cancel / Exit Confirmation Modal with Save Draft Option */}
      {showCancelPrompt && (
        <div
          className="modal fade show d-block"
          tabIndex={-1}
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 1055 }}
        >
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '480px' }}>
            <div className="modal-content shadow-lg border-0 rounded-3">
              <div className="modal-header border-bottom px-4 py-3 bg-light">
                <h5 className="modal-title fw-bold text-dark fs-6">
                  Unsaved Changes
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowCancelPrompt(false)}
                  aria-label="Close"
                />
              </div>
              <div className="modal-body px-4 py-4">
                <p className="text-secondary small mb-3" style={{ fontSize: '0.875rem', lineHeight: '1.5' }}>
                  {editingDraftId
                    ? 'Save your changes to this draft, or discard them?'
                    : 'Save this assurance set as a draft, or discard it?'}
                </p>
                <div className="p-3 bg-light rounded-3 border small">
                  <div className="fw-semibold text-dark">{title || 'Untitled'}</div>
                  <div className="text-muted mt-0.5">
                    Objects: {selectedAssuranceObjects.length} &nbsp;|&nbsp; Assets:{' '}
                    {selectedScopes.map(getScopeAssetName).join(', ') || 'None'}
                  </div>
                </div>
              </div>
              <div className="modal-footer border-top bg-light px-4 py-3 d-flex align-items-center justify-content-between">
                <button
                  type="button"
                  className="btn btn-outline-danger btn-sm px-3"
                  onClick={handleConfirmExitWithoutSaving}
                >
                  Discard
                </button>
                <div className="d-flex align-items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-light border btn-sm px-3"
                    onClick={() => setShowCancelPrompt(false)}
                  >
                    Keep Editing
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm px-3.5 text-white fw-semibold"
                    onClick={handleSaveDraft}
                  >
                    {editingDraftId ? 'Save Draft' : 'Save as Draft'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div >
  );
};
