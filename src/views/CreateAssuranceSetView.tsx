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
import { filterProjectsForPersona, projectToAssuranceProjectScope, withProjectVessels } from '../utils/projectHelpers';
import { resolveAssuranceRequestContext, resolveAssuranceRequestSetClient, resolveRequestedServiceProviderOrg } from '../utils/notificationHelpers';
import { Plus, ChevronDown, ShieldCheck, FileCheck, ExternalLink, Globe, Building2, Ship, Users, Wrench, Activity, Sparkles, CheckCircle2, Trash2, AlertCircle } from 'lucide-react';
import { calculateAssuranceSetReadiness } from '../utils/readinessHelpers';

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
    () => `${titleOrg} - ${initialSubjectName} Charter Vetting`,
  );
  /* the one scope the set covers, kept as a one-entry list; a set covers exactly one asset (ADR 0004). A request that suggests several scopes starts on the first; the others get their own sets */
  const [selectedScopes, setSelectedScopes] = useState<AssuranceSubtype[]>(() => {
    if (lockedAsset) return [lockedAsset.scope];
    if (suggestedAsset) return [suggestedAsset.assetType];
    if (requestedScopes && requestedScopes.length > 0) return [getPrimaryAssuranceScope(requestedScopes)];
    return [requestedScope || 'Vessel'];
  });
  /* scope the set is filed under and named after */
  const assuranceType = getPrimaryAssuranceScope(selectedScopes);
  /* scope handed over by a listing; it cannot be changed */
  const lockedScopes: AssuranceSubtype[] = isScopeLocked && lockedAsset ? [lockedAsset.scope] : [];
  const [selectedProjectId, setSelectedProjectId] = useState<string>(lockedProjectId || '');
  const [vesselId, setVesselId] = useState(initialVesselId);
  /* crew members a crew set covers, in the order they were ticked (ADR 0023); the first one names the set */
  const [selectedCrewIds, setSelectedCrewIds] = useState<string[]>(() => {
    const first =
      lockedAsset?.scope === 'Crew'
        ? lockedAsset.assetId
        : suggestedAsset?.assetType === 'Crew'
          ? suggestedAsset.assetId
          : crew[0]?.id;
    return first ? [first] : [];
  });
  const selectedCrewId = selectedCrewIds[0] || '';
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>(() =>
    lockedAsset?.scope === 'Equipment'
      ? lockedAsset.assetId
      : suggestedAsset?.assetType === 'Equipment'
        ? suggestedAsset.assetId
        : equipment[0]?.id || '',
  );
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

  /* Covered Assurance Objects State (ADR 0029) */
  const [selectedAssuranceObjects, setSelectedAssuranceObjects] = useState<AssuranceObject[]>(() => {
    const list: AssuranceObject[] = [];
    if (lockedAsset) {
      if (lockedAsset.scope === 'Vessel') {
        const v = vessels.find((x) => x.id === lockedAsset.assetId);
        if (v) list.push(vesselToAssuranceObject(v));
      } else if (lockedAsset.scope === 'Crew') {
        const c = crew.find((x) => x.id === lockedAsset.assetId);
        if (c) list.push(crewToAssuranceObject(c));
      } else if (lockedAsset.scope === 'Equipment') {
        const e = equipment.find((x) => x.id === lockedAsset.assetId);
        if (e) list.push(equipmentToAssuranceObject(e));
      }
    } else if (suggestedAsset) {
      if (suggestedAsset.assetType === 'Vessel') {
        const v = vessels.find((x) => x.id === suggestedAsset.assetId);
        if (v) list.push(vesselToAssuranceObject(v));
      } else if (suggestedAsset.assetType === 'Crew') {
        const c = crew.find((x) => x.id === suggestedAsset.assetId);
        if (c) list.push(crewToAssuranceObject(c));
      } else if (suggestedAsset.assetType === 'Equipment') {
        const e = equipment.find((x) => x.id === suggestedAsset.assetId);
        if (e) list.push(equipmentToAssuranceObject(e));
      }
    }
    if (list.length === 0 && initialVesselId) {
      const v = vessels.find((x) => x.id === initialVesselId);
      if (v) list.push(vesselToAssuranceObject(v));
    }
    return list;
  });
  const [newObjectType, setNewObjectType] = useState<AssuranceObjectType>('procedure');
  const [newObjectId, setNewObjectId] = useState<string>('');

  // Sync vessel changes into assuranceObjects
  useEffect(() => {
    if (!vesselId) return;
    const v = vessels.find((x) => x.id === vesselId);
    if (!v) return;
    const vObj = vesselToAssuranceObject(v);
    setSelectedAssuranceObjects((prev) => {
      if (prev.some((o) => o.id === v.id)) return prev;
      const nonVessels = prev.filter((o) => o.type !== 'vessel');
      return [vObj, ...nonVessels];
    });
  }, [vesselId, vessels]);

  // Sync crew changes into assuranceObjects
  useEffect(() => {
    if (selectedCrewIds.length === 0) return;
    const crewObjs = selectedCrewIds
      .map((id) => crew.find((c) => c.id === id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c))
      .map(crewToAssuranceObject);
    setSelectedAssuranceObjects((prev) => {
      const nonPersons = prev.filter((o) => o.type !== 'person');
      return [...nonPersons, ...crewObjs];
    });
  }, [selectedCrewIds, crew]);

  // Sync equipment changes into assuranceObjects
  useEffect(() => {
    if (!selectedEquipmentId) return;
    const eq = equipment.find((e) => e.id === selectedEquipmentId);
    if (!eq) return;
    const eqObj = equipmentToAssuranceObject(eq);
    setSelectedAssuranceObjects((prev) => {
      if (prev.some((o) => o.id === eq.id)) return prev;
      const nonEquip = prev.filter((o) => o.type !== 'equipment');
      return [...nonEquip, eqObj];
    });
  }, [selectedEquipmentId, equipment]);

  const availableObjectsForType = useMemo<AssuranceObject[]>(() => {
    let list: AssuranceObject[] = [];
    switch (newObjectType) {
      case 'vessel':
        list = availableVessels.map(vesselToAssuranceObject);
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
  }, [newObjectType, availableVessels, crew, equipment, storeAssuranceObjects]);

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

  /* choosing a scope replaces the previous one: a set covers exactly one asset */
  const handleSelectScope = (newScope: AssuranceSubtype) => {
    if (lockedScopes.length > 0 || newScope === assuranceType) return;
    setSelectedScopes([newScope]);
    setFieldErrors({});

    /* the suggested title follows the scope */

    if (newScope === 'Vessel') {
      const v = vesselChoices.find((item) => item.id === vesselId) || vesselChoices[0];
      setTitle(`${titleOrg} - ${v ? v.name : 'MV Pacific Endeavour'} Vetting`);
    } else if (newScope === 'Crew') {
      const c = crew.find((item) => item.id === selectedCrewId) || crew[0];
      setTitle(`${titleOrg} - ${c ? c.fullName : 'Capt. Alexander Wright'} Vetting`);
    } else if (newScope === 'Equipment') {
      const e = equipment.find((item) => item.id === selectedEquipmentId) || equipment[0];
      setTitle(`${titleOrg} - ${e ? e.name : '150T Traction Winch'} Vetting`);
    } else if (newScope === 'Activity') {
      const a = EXISTING_ACTIVITIES.find((item) => item.id === selectedActivityId) || EXISTING_ACTIVITIES[0];
      setTitle(`${titleOrg} - ${a ? a.name : 'Operational Procedure'} Vetting`);
    }
  };

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

  /* Selected Templates per Subtype: { [subtype]: templateId } */
  const [selectedSubtypeTemplates, setSelectedSubtypeTemplates] = useState<Record<string, string>>({
    Vessel: '',
    Crew: '',
    Activity: '',
    Equipment: '',
  });

  /* Specialized Custom Documents added by the user */
  const [specializedDocs, setSpecializedDocs] = useState<SpecializedDoc[]>([]);

  /* Specialized Document Form Inputs (tracked per subtype) */
  const [specializedInputs, setSpecializedInputs] = useState<Record<AssuranceSubtype, {
    title: string;
    description: string;
    category: AssuranceRequirementCategory;
    isMandatory: boolean;
  }>>({
    Vessel: { title: '', description: '', category: SUBTYPE_CATEGORIES.Vessel[0], isMandatory: true },
    Crew: { title: '', description: '', category: SUBTYPE_CATEGORIES.Crew[0], isMandatory: true },
    Activity: { title: '', description: '', category: SUBTYPE_CATEGORIES.Activity[0], isMandatory: true },
    Equipment: { title: '', description: '', category: SUBTYPE_CATEGORIES.Equipment[0], isMandatory: true },
  });

  /* Wizard tabs: Scope, the tab of the chosen scope, Review */
  const steps = buildAssuranceWizardSteps(selectedScopes);
  const totalSteps = steps.length;

  /* Adjust current step if a scope change makes current step out of bounds */
  useEffect(() => {
    if (currentStep > totalSteps) {
      setCurrentStep(totalSteps);
    }
  }, [totalSteps, currentStep]);

  /* Handle global existing assurance set template selection */
  const applyGlobalTemplateData = (targetSet: AssuranceSet) => {
    if (!lockedVessel) {
      const templateVesselId = vesselChoices.some((v) => v.id === targetSet.vesselId)
        ? targetSet.vesselId
        : vesselChoices[0]?.id || '';
      setVesselId(templateVesselId);
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

    const cleanSubject = baseSubject || `${vesselDisplayName} Charter Vetting`;
    setTitle(`${templateCharterer} - ${cleanSubject}`);

    /* a template filed under a scope that is no longer offered leaves the current ticks as they are */
    const templateScopes = orderAssuranceScopes(targetSet.assuranceType ? [targetSet.assuranceType] : []);
    if (!lockedAsset && templateScopes.length > 0) {
      setSelectedScopes(templateScopes);
    }

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
        if (!lockedAsset) setSelectedScopes([templateScope]);
        setTitle(`${defaultCharterer} - ${publicTmpl.scopeType || initialSubjectName} Charter Vetting`);
        setTemplatePrivacy('organization');
        setVerificationRequired(publicTmpl.verificationRequired ?? true);
        setInspectionRequired(publicTmpl.mandatoryInspectionRequired ?? true);
        setApprovalRequired(publicTmpl.formalApprovalRequired ?? true);
        if (publicTmpl.reviewMode) setReviewMode(publicTmpl.reviewMode);

        const updatedToggles: Record<string, boolean> = {};
        Object.values(SUBTYPE_STANDARD_DOCS).flat().forEach((doc) => {
          const matched = publicTmpl.requirements.some(
            (r) => r.title.toLowerCase().includes(doc.title.toLowerCase()) || doc.title.toLowerCase().includes(r.title.toLowerCase()),
          );
          if (matched) {
            updatedToggles[doc.id] = true;
          }
        });
        setDocToggles((prev) => ({ ...prev, ...updatedToggles }));

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
          if (!lockedAsset) setSelectedScopes([getPrimaryAssuranceScope(getAssuranceSetScopes(target))]);
          if (target.projectId && !lockedProjectId) setSelectedProjectId(target.projectId);
          if (target.crewId && !lockedAsset) setSelectedCrewIds(getAssuranceSetCrewIds(target));
          if (target.equipmentId && !lockedAsset) setSelectedEquipmentId(target.equipmentId);
          if (target.activityId) setSelectedActivityId(target.activityId);
          if (target.templateSource === 'public' || target.visibility === 'draft') {
            setTemplatePrivacy('public');
          } else {
            setTemplatePrivacy('organization');
          }
          if (target.vesselId) {
            setVesselId(
              vesselChoices.some((v) => v.id === target.vesselId)
                ? target.vesselId
                : vesselChoices[0]?.id || '',
            );
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
          Object.values(SUBTYPE_STANDARD_DOCS).forEach((list) => {
            list.forEach((doc) => {
              const matched = target.requirements.some(
                (r) => !r.isSpecialized && (r.title.toLowerCase().includes(doc.title.toLowerCase()) || doc.title.toLowerCase().includes(r.title.toLowerCase()))
              );
              updatedToggles[doc.id] = matched;
            });
          });
          setDocToggles(updatedToggles);

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

  /* Toggle individual standard document */
  const handleToggleStandardDoc = (docId: string) => {
    setDocToggles((prev) => ({
      ...prev,
      [docId]: !prev[docId],
    }));
  };

  /* Handle adding a specialized custom document */
  const handleAddSpecializedDoc = (subtype: AssuranceSubtype) => {
    const input = specializedInputs[subtype];
    if (!input.title.trim()) {
      setFieldErrors((prev) => ({
        ...prev,
        [`specialized_${subtype}`]: `Document title is required for specialized ${subtype.toLowerCase()} document.`,
      }));
      return;
    }

    const newSpecializedDoc: SpecializedDoc = {
      id: `spec-${subtype.toLowerCase()}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      subtype,
      title: input.title.trim(),
      category: input.category,
      description: input.description.trim() || `Custom requirement for ${subtype} assurance.`,
      isMandatory: input.isMandatory,
      isEnabled: true,
    };

    setSpecializedDocs((prev) => [...prev, newSpecializedDoc]);
    setSpecializedInputs((prev) => ({
      ...prev,
      [subtype]: {
        title: '',
        description: '',
        category: SUBTYPE_CATEGORIES[subtype][0],
        isMandatory: true,
      },
    }));
    setFieldErrors((prev) => {
      const u = { ...prev };
      delete u[`specialized_${subtype}`];
      return u;
    });
    setErrorMessage('');
  };

  const handleRemoveSpecializedDoc = (id: string) => {
    setSpecializedDocs((prev) => prev.filter((d) => d.id !== id));
  };

  const handleToggleSpecializedDoc = (id: string) => {
    setSpecializedDocs((prev) =>
      prev.map((d) => (d.id === id ? { ...d, isEnabled: !d.isEnabled } : d))
    );
  };

  /* Errors for one wizard tab: the scope tab covers identification and stakeholders, each scope tab its own asset */
  const getStepErrors = (stepNumber: number): Record<string, string> => {
    const newErrors: Record<string, string> = {};
    const step = steps[stepNumber - 1];
    if (!step) return newErrors;

    if (step.id === 'step-scope') {
      if (!title.trim()) {
        newErrors.title = 'Title is required.';
      } else {
        const duplicateCheck = isDuplicateCampaignTitle(title, assuranceSets, editingDraftId);
        if (duplicateCheck.isDuplicate) {
          newErrors.title = duplicateCheck.reason || 'This title is already in use.';
        }
      }

      if (selectedScopes.length === 0) {
        newErrors.scope = 'Select a scope.';
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
      /* the asset is picked next to the dates; only the same asset cannot hold two contracts at once, so the error sits on the asset */
      const datesValid = !newErrors.startDate && !newErrors.endDate;
      if (assuranceType === 'Vessel') {
        if (!vesselChoices.some((v) => v.id === vesselId)) {
          newErrors.vesselId = 'Select a vessel from another organization.';
        } else if (datesValid) {
          const overlap = formatOverlapError(getAssetPeriodConflicts('Vessel', vesselId, startDate, endDate, assuranceSets, editingDraftId || undefined));
          if (overlap) newErrors.vesselId = overlap;
        }
      }
      if (assuranceType === 'Crew') {
        if (selectedCrewIds.length === 0) {
          newErrors.crewId = 'Select at least one crew member.';
        } else if (datesValid) {
          const overlap = formatOverlapError(
            findOverlappingAssuranceSets(
              { id: editingDraftId || undefined, scope: 'Crew', crewIds: selectedCrewIds, start: startDate, end: endDate },
              assuranceSets,
            ),
          );
          if (overlap) newErrors.crewId = overlap;
        }
      }
      if (assuranceType === 'Equipment') {
        if (!selectedEquipmentId) {
          newErrors.equipmentId = 'Select equipment.';
        } else if (datesValid) {
          const overlap = formatOverlapError(getAssetPeriodConflicts('Equipment', selectedEquipmentId, startDate, endDate, assuranceSets, editingDraftId || undefined));
          if (overlap) newErrors.equipmentId = overlap;
        }
      }
      if (assuranceType === 'Activity' && !selectedActivityId) {
        newErrors.activityId = 'Select an activity.';
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
            isMandatory: doc.isMandatory,
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
      requirements: effectiveRequirements,
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
            isMandatory: doc.isMandatory,
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
      requirements: effectiveRequirements,
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
      delete u.vesselId;
      delete u.crewId;
      delete u.equipmentId;
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

  /* Render the header and asset selector of one scope tab */
  const renderAssetPicker = (subtype: AssuranceSubtype) => {
    const ScopeIcon = subtype === 'Vessel' ? Ship : subtype === 'Crew' ? Users : subtype === 'Equipment' ? Wrench : Activity;
    const assetNoun = subtype === 'Crew' ? 'crew member' : subtype.toLowerCase();

    return (
      <div className="card border shadow-2xs rounded-3 bg-white">
        <div className="card-header bg-light border-bottom px-4 py-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
          <div className="d-flex align-items-center gap-2.5">
            <div className="p-2 bg-primary text-white rounded-2 d-flex align-items-center justify-content-center">
              <ScopeIcon className="w-5 h-5" />
            </div>
            <div>
              <h5 className="fw-bold text-slate-900 m-0 fs-6">
                {subtype}
              </h5>
              <div className="text-muted small mt-0.5">
                {`Select the ${assetNoun} this assurance set covers for the contract period above.`}
              </div>
            </div>
          </div>
        </div>
        <div className="card-body p-4">
          {subtype === 'Vessel' && (
            <div>
              <label className="form-label text-secondary small fw-semibold" htmlFor="grid-target-asset-vessel">
                Vessel <span className="text-danger">*</span>
              </label>
              <select
                id="grid-target-asset-vessel"
                className={`form-select bg-white text-dark border-secondary-subtle${animatingFields.has('grid-target-vessel') ? ' map-autofill-animate' : ''}${fieldErrors.vesselId ? ' is-invalid border-danger' : ''}`}
                value={vesselId}
                onChange={(e) => {
                  setVesselId(e.target.value);
                  setFieldErrors((prev) => {
                    const u = { ...prev };
                    delete u.vesselId;
                    return u;
                  });
                }}
                disabled={vesselChoices.length === 0 || isVesselLocked || lockedScopes.includes('Vessel')}
              >
                {vesselChoices.length === 0 ? (
                  <option value="">No vessels from another organization</option>
                ) : (
                  vesselChoices.map((v) => {
                    const conflicts = getAssetPeriodConflicts('Vessel', v.id, startDate, endDate, assuranceSets, editingDraftId || undefined);
                    const hasConflict = conflicts.length > 0;
                    return (
                      <option key={v.id} value={v.id} disabled={hasConflict}>
                        {v.name} (IMO: {v.imoNumber} &mdash; Flag: {v.flagState} &mdash; {v.vesselType})
                        {hasConflict ? ` — ${formatBookedLabel(conflicts[0])}` : ''}
                      </option>
                    );
                  })
                )}
              </select>
              {fieldErrors.vesselId && (
                <div className="invalid-feedback d-block small mt-1 font-mono-code" style={{ fontSize: '0.75rem' }}>
                  {fieldErrors.vesselId}
                </div>
              )}
              {selectedVessel &&
                renderCollisionAlert(
                  'Vessel',
                  selectedVessel.id,
                  selectedVessel.name,
                  getAssetPeriodConflicts('Vessel', selectedVessel.id, startDate, endDate, assuranceSets, editingDraftId || undefined),
                )}
              <div className="text-secondary small mt-1" style={{ fontSize: '0.78rem' }}>
                Your own vessels are not listed. You become the client of the vessel you select.
              </div>

              {selectedVessel && (
                <div className="mt-3 p-3 bg-light border rounded-3 small">
                  <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                    <span className="fw-bold text-dark fs-6">{selectedVessel.name}</span>
                    <span className="badge bg-secondary text-white font-mono-code">IMO {selectedVessel.imoNumber}</span>
                  </div>
                  <div className="row g-2 text-secondary" style={{ fontSize: '0.8rem' }}>
                    <div className="col-12 col-md-4">
                      <strong>Type:</strong> {selectedVessel.vesselType}
                    </div>
                    <div className="col-12 col-md-4">
                      <strong>Flag State:</strong> {selectedVessel.flagState}
                    </div>
                    <div className="col-12 col-md-4">
                      <strong>Registered Owner:</strong> {selectedVessel.registeredOwner}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {subtype === 'Crew' && (
            <div>
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="form-label text-secondary small fw-semibold mb-0" id="grid-target-asset-crew-label">
                  Crew Members <span className="text-danger">*</span>
                </span>
                <span className="small text-secondary font-mono-code" aria-live="polite">
                  {selectedCrewIds.length} selected
                </span>
              </div>
              <div
                id="grid-target-asset-crew"
                role="group"
                aria-labelledby="grid-target-asset-crew-label"
                className={`border rounded-3 bg-white overflow-auto${fieldErrors.crewId ? ' border-danger' : ' border-secondary-subtle'}`}
                style={{ maxHeight: '240px' }}
              >
                {crew.map((c) => {
                  const isChecked = selectedCrewIds.includes(c.id);
                  /* a crew member handed over by a charter action stays in the set */
                  const isLockedMember = lockedScopes.includes('Crew') && lockedAsset?.assetId === c.id;
                  const conflicts = getAssetPeriodConflicts('Crew', c.id, startDate, endDate, assuranceSets, editingDraftId || undefined);
                  const hasConflict = conflicts.length > 0;
                  /* a contracted member cannot be ticked, but one already ticked can still be removed */
                  const isDisabled = isLockedMember || (hasConflict && !isChecked);
                  return (
                    <label
                      key={c.id}
                      htmlFor={`grid-crew-${c.id}`}
                      className={`d-flex align-items-start gap-2 px-3 py-2 border-bottom mb-0 small${isChecked ? ' bg-light' : ''}${hasConflict ? ' bg-danger-subtle bg-opacity-25' : ''}`}
                      style={{ cursor: isDisabled ? 'not-allowed' : 'pointer' }}
                    >
                      <input
                        id={`grid-crew-${c.id}`}
                        type="checkbox"
                        className="form-check-input mt-1 flex-shrink-0"
                        checked={isChecked}
                        disabled={isDisabled}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          if (hasConflict && checked) return;
                          setSelectedCrewIds((prev) =>
                            checked ? [...prev.filter((id) => id !== c.id), c.id] : prev.filter((id) => id !== c.id),
                          );
                          setFieldErrors((prev) => {
                            const u = { ...prev };
                            delete u.crewId;
                            delete u.startDate;
                            return u;
                          });
                        }}
                      />
                      <span className="d-flex flex-column flex-grow-1">
                        <div className="d-flex align-items-center justify-content-between flex-wrap gap-1">
                          <span className="fw-semibold text-dark">
                            {c.fullName} <span className="text-secondary fw-normal">&mdash; {c.rank}</span>
                          </span>
                          {hasConflict && (
                            <span className="badge bg-danger-subtle text-danger border border-danger-subtle font-mono-code" style={{ fontSize: '0.675rem' }}>
                              {formatBookedLabel(conflicts[0])}
                            </span>
                          )}
                        </div>
                        <span className="text-secondary font-mono-code" style={{ fontSize: '0.75rem' }}>
                          Seaman's Book: {c.seamansBookNo} &middot; {c.organization}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
              {fieldErrors.crewId && (
                <div className="invalid-feedback d-block small mt-1 font-mono-code" style={{ fontSize: '0.75rem' }}>
                  {fieldErrors.crewId}
                </div>
              )}
              {(() => {
                const bookedMember = selectedCrewMembers.find(
                  (c) => getAssetPeriodConflicts('Crew', c.id, startDate, endDate, assuranceSets, editingDraftId || undefined).length > 0,
                );
                return bookedMember
                  ? renderCollisionAlert(
                      'Crew',
                      bookedMember.id,
                      bookedMember.fullName,
                      getAssetPeriodConflicts('Crew', bookedMember.id, startDate, endDate, assuranceSets, editingDraftId || undefined),
                    )
                  : null;
              })()}
            </div>
          )}

          {subtype === 'Equipment' && (
            <div>
              <label className="form-label text-secondary small fw-semibold" htmlFor="grid-target-asset-equipment">
                Equipment <span className="text-danger">*</span>
              </label>
              <select
                id="grid-target-asset-equipment"
                className={`form-select bg-white text-dark border-secondary-subtle fw-semibold${fieldErrors.equipmentId ? ' is-invalid border-danger' : ''}`}
                value={selectedEquipmentId}
                onChange={(e) => {
                  setSelectedEquipmentId(e.target.value);
                  setFieldErrors((prev) => {
                    const u = { ...prev };
                    delete u.equipmentId;
                    return u;
                  });
                }}
                disabled={lockedScopes.includes('Equipment')}
              >
                {equipment.map((e) => {
                  const conflicts = getAssetPeriodConflicts('Equipment', e.id, startDate, endDate, assuranceSets, editingDraftId || undefined);
                  const hasConflict = conflicts.length > 0;
                  return (
                    <option key={e.id} value={e.id} disabled={hasConflict}>
                      {e.name} (Tag: {e.equipmentIdentifier} &mdash; Category: {e.category})
                      {hasConflict ? ` — ${formatBookedLabel(conflicts[0])}` : ''}
                    </option>
                  );
                })}
              </select>
              {fieldErrors.equipmentId && (
                <div className="invalid-feedback d-block small mt-1 font-mono-code" style={{ fontSize: '0.75rem' }}>
                  {fieldErrors.equipmentId}
                </div>
              )}
              {selectedEquipment &&
                renderCollisionAlert(
                  'Equipment',
                  selectedEquipment.id,
                  selectedEquipment.name,
                  getAssetPeriodConflicts('Equipment', selectedEquipment.id, startDate, endDate, assuranceSets, editingDraftId || undefined),
                )}

              {selectedEquipment && (
                <div className="mt-3 p-3 bg-light border rounded-3 small">
                  <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                    <span className="fw-bold text-dark fs-6">{selectedEquipment.name}</span>
                    <span className="badge bg-dark text-white font-mono-code">{selectedEquipment.equipmentIdentifier}</span>
                  </div>
                  <div className="row g-2 text-secondary" style={{ fontSize: '0.8rem' }}>
                    <div className="col-12 col-md-4">
                      <strong>Category:</strong> {selectedEquipment.category}
                    </div>
                    <div className="col-12 col-md-4">
                      <strong>Manufacturer:</strong> {selectedEquipment.manufacturer || 'N/A'}
                    </div>
                    <div className="col-12 col-md-4">
                      <strong>Serial Number:</strong> {selectedEquipment.serialNumber || 'N/A'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {subtype === 'Activity' && (
            <div>
              <label className="form-label text-secondary small fw-semibold" htmlFor="grid-target-asset-activity">
                Activity <span className="text-danger">*</span>
              </label>
              <select
                id="grid-target-asset-activity"
                className={`form-select bg-white text-dark border-secondary-subtle fw-semibold${fieldErrors.activityId ? ' is-invalid border-danger' : ''}`}
                value={selectedActivityId}
                onChange={(e) => {
                  setSelectedActivityId(e.target.value);
                  setFieldErrors((prev) => {
                    const u = { ...prev };
                    delete u.activityId;
                    return u;
                  });
                }}
              >
                {EXISTING_ACTIVITIES.map((act) => (
                  <option key={act.id} value={act.id}>
                    {act.id} &mdash; {act.name} ({act.category})
                  </option>
                ))}
              </select>
              {fieldErrors.activityId && (
                <div className="invalid-feedback d-block small mt-1 font-mono-code" style={{ fontSize: '0.75rem' }}>
                  {fieldErrors.activityId}
                </div>
              )}

              {selectedActivity && (
                <div className="mt-3 p-3 bg-light border rounded-3 small">
                  <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                    <span className="fw-bold text-dark fs-6">{selectedActivity.name}</span>
                    <span className="badge bg-info text-dark font-mono-code">{selectedActivity.category}</span>
                  </div>
                  <div className="row g-2 text-secondary" style={{ fontSize: '0.8rem' }}>
                    <div className="col-12 col-md-6">
                      <strong>Location:</strong> {selectedActivity.location}
                    </div>
                    <div className="col-12 col-md-6">
                      <strong>Category:</strong> {selectedActivity.category}
                    </div>
                    <div className="col-12">
                      <strong>Description:</strong> {selectedActivity.description}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
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
    const specializedList = specializedDocs.filter((d: { subtype: string; }) => d.subtype === subtype);
    const specInput = specializedInputs[subtype];
    /* Section label: for standalone (non-project) scopes use neutral 'Documents' label */
    const sectionLabel = 'Documents';

    return (
      <div className="d-flex flex-column gap-4" id={`subtype-docs-container-${subtype}`}>
        {/* Template Selector Card (Optional) */}
        <div className="card border shadow-sm rounded-3 bg-white">
          <div className="card-header bg-light border-bottom px-4 py-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
              <h5 className="fw-bold text-slate-900 m-0 fs-6">
                {sectionLabel} Assurance Templates (Optional)
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
              <div className="col-12 col-md-6">
                <label className="form-label text-secondary small fw-semibold">
                  Public Templates
                </label>
                <select
                  className="form-select bg-white text-dark border-secondary-subtle"
                  value={publicTemplates.some((t) => t.id === activeTemplateId) ? activeTemplateId : ''}
                  onChange={(e) => handleSelectSubtypeTemplate(subtype, e.target.value)}
                >
                  <option value="">Select a public template</option>
                  {publicTemplates.map((tmpl) => (
                    <option key={tmpl.id} value={tmpl.id}>
                      {tmpl.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-12 col-md-6">
                <label className="form-label text-secondary small fw-semibold">
                  Organization Templates
                </label>
                <select
                  className="form-select bg-white text-dark border-secondary-subtle"
                  value={orgTemplates.some((t) => t.id === activeTemplateId) ? activeTemplateId : ''}
                  onChange={(e) => handleSelectSubtypeTemplate(subtype, e.target.value)}
                >
                  <option value="">Select an organization template</option>
                  {orgTemplates.map((tmpl) => (
                    <option key={tmpl.id} value={tmpl.id}>
                      {tmpl.name} ({tmpl.organizationName || 'Corporate'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {activeTemplateId && (
              <div className="mt-3 p-3 bg-light-subtle border border-primary-subtle rounded-2 d-flex align-items-center justify-content-between">
                <div className="small text-secondary">
                  <strong className="text-primary d-block">
                    Active: {SUBTYPE_TEMPLATES.find((t) => t.id === activeTemplateId)?.name}
                  </strong>
                  <span>{SUBTYPE_TEMPLATES.find((t) => t.id === activeTemplateId)?.description}</span>
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

        {/* Standard Required Documents List with Descriptions */}
        <div className="card border shadow-sm rounded-3 bg-white">
          <div className="card-header bg-light border-bottom px-4 py-3">
            <h5 className="fw-bold text-slate-900 m-0 fs-6">
              Required Documents &amp; Information
            </h5>
            <p className="text-muted small m-0 mt-1">
              Mark each document as required or not.
            </p>
          </div>
          <div className="card-body p-4">
            <div className="d-flex flex-column gap-3">
              {standardDocs.map((doc) => {
                const isEnabled = Boolean(docToggles[doc.id]);

                return (
                  <div
                    key={doc.id}
                    className={`p-3 border rounded-3 transition-all ${isEnabled ? 'bg-white border-primary-subtle shadow-2xs' : 'bg-light border-light-subtle opacity-75'
                      }`}
                  >
                    <div className="d-flex align-items-start justify-content-between gap-3">
                      <div className="d-flex align-items-start gap-3 flex-grow-1">
                        <div className="form-check form-switch m-0 fs-5 mt-0.5">
                          <input
                            className="form-check-input cursor-pointer"
                            type="checkbox"
                            checked={isEnabled}
                            onChange={() => handleToggleStandardDoc(doc.id)}
                            id={`toggle-${doc.id}`}
                            style={{ width: '2.5rem', height: '1.35rem', cursor: 'pointer' }}
                          />
                        </div>
                        <div className="flex-grow-1">
                          <div className="d-flex align-items-center gap-2 flex-wrap">
                            <label
                              htmlFor={`toggle-${doc.id}`}
                              className="fw-bold text-dark mb-0 d-block small cursor-pointer"
                            >
                              {doc.title}
                            </label>
                          </div>
                          <p className="text-secondary small mb-0 mt-1" style={{ lineHeight: '1.45', fontSize: '0.8125rem' }}>
                            {doc.description}
                          </p>
                        </div>
                      </div>

                      <div>
                        {isEnabled ? (
                          <span
                            className="badge rounded-pill fw-semibold px-3 py-1"
                            style={{ backgroundColor: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', fontSize: '0.75rem' }}
                          >
                            Required
                          </span>
                        ) : (
                          <span
                            className="badge rounded-pill fw-semibold px-3 py-1 text-secondary"
                            style={{ backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', fontSize: '0.75rem' }}
                          >
                            Off
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Specialized Custom Document Input with Description */}
        <div className="card border shadow-sm rounded-3 bg-white">
          <div className="card-header bg-light border-bottom px-4 py-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
              <h5 className="fw-bold text-slate-900 m-0 fs-6">
                Add Document <span className="text-secondary fw-normal fs-7">(optional)</span>
              </h5>
              <p className="text-muted small m-0 mt-1">
                Add any other documents this assurance set needs.
              </p>
            </div>
          </div>
          <div className="card-body p-4">
            <div className="row g-3">
              <div className="col-12 col-md-8">
                <label className="form-label text-secondary small fw-semibold">
                  Title
                </label>
                <input
                  type="text"
                  className={`form-control bg-white text-dark border-secondary-subtle${fieldErrors[`specialized_${subtype}`] ? ' is-invalid border-danger' : ''}`}
                  placeholder={`e.g. ${subtype} Verification Report`}
                  value={specInput.title}
                  onChange={(e) => {
                    setSpecializedInputs((prev) => ({
                      ...prev,
                      [subtype]: { ...prev[subtype], title: e.target.value },
                    }));
                    setFieldErrors((prev) => {
                      const u = { ...prev };
                      delete u[`specialized_${subtype}`];
                      return u;
                    });
                  }}
                />
                {fieldErrors[`specialized_${subtype}`] && (
                  <div className="text-danger small mt-1 font-mono-code" style={{ fontSize: '0.75rem' }}>
                    {fieldErrors[`specialized_${subtype}`]}
                  </div>
                )}
              </div>

              <div className="col-12 col-md-4">
                <label className="form-label text-secondary small fw-semibold">
                  {subtype} Document Category
                </label>
                <select
                  className="form-select bg-white text-dark border-secondary-subtle"
                  value={specInput.category}
                  onChange={(e) =>
                    setSpecializedInputs((prev) => ({
                      ...prev,
                      [subtype]: { ...prev[subtype], category: e.target.value as AssuranceRequirementCategory },
                    }))
                  }
                >
                  {(SUBTYPE_CATEGORIES[subtype] || []).map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-12">
                <label className="form-label text-secondary small fw-semibold">
                  Document Description &amp; Compliance Context
                </label>
                <textarea
                  className="form-control bg-white text-dark border-secondary-subtle"
                  rows={2}
                  placeholder="Why this document is needed"
                  value={specInput.description}
                  onChange={(e) =>
                    setSpecializedInputs((prev) => ({
                      ...prev,
                      [subtype]: { ...prev[subtype], description: e.target.value },
                    }))
                  }
                />
              </div>

              <div className="col-12 d-flex align-items-center justify-content-between flex-wrap gap-2">
                <div className="form-check form-switch m-0">
                  <input
                    className="form-check-input cursor-pointer"
                    type="checkbox"
                    checked={specInput.isMandatory}
                    onChange={(e) =>
                      setSpecializedInputs((prev) => ({
                        ...prev,
                        [subtype]: { ...prev[subtype], isMandatory: e.target.checked },
                      }))
                    }
                    id={`spec-mand-toggle-${subtype}`}
                  />
                  <label htmlFor={`spec-mand-toggle-${subtype}`} className="form-check-label text-secondary small fw-semibold cursor-pointer">
                    Required for Approval
                  </label>
                </div>

                <button
                  type="button"
                  className="btn btn-sm btn-primary text-white fw-semibold d-inline-flex align-items-center gap-1.5"
                  onClick={() => handleAddSpecializedDoc(subtype)}
                >
                  Add Document
                </button>
              </div>
            </div>

            {/* List of Added Specialized Documents for this subtype */}
            {specializedList.length > 0 && (
              <div className="mt-4 border-top pt-3">
                <h6 className="fw-bold text-dark small mb-2">
                  Added Documents ({specializedList.length})
                </h6>
                <div className="d-flex flex-column gap-2">
                  {specializedList.map((spec: SpecializedDoc) => (
                    <div
                      key={spec.id}
                      className="p-3 border rounded-2 bg-light-subtle d-flex align-items-start justify-content-between gap-2"
                    >
                      <div className="d-flex align-items-start gap-2.5">
                        <div className="form-check form-switch m-0 mt-0.5">
                          <input
                            className="form-check-input cursor-pointer"
                            type="checkbox"
                            checked={spec.isEnabled}
                            onChange={() => handleToggleSpecializedDoc(spec.id)}
                          />
                        </div>
                        <div>
                          <div className="d-flex align-items-center gap-2">
                            <strong className="text-dark small">{spec.title}</strong>
                          </div>
                          <div className="text-secondary small mt-0.5" style={{ fontSize: '0.78rem' }}>
                            {spec.description}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger py-0 px-2 text-danger"
                        style={{ fontSize: '0.75rem' }}
                        onClick={() => handleRemoveSpecializedDoc(spec.id)}
                        title="Remove"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
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
          <div className="progress mt-2.5" style={{ height: '4px' }}>
            <div
              className="progress-bar bg-primary"
              role="progressbar"
              style={{ width: `${(currentStep / totalSteps) * 100}%`, transition: 'width 0.3s ease' }}
              aria-valuenow={(currentStep / totalSteps) * 100}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>

        {/* Wizard Main Content Body */}
        <div className="card-body p-4">
          {/* STEP 1: Identification, Scope & General Information */}
          {currentStep === 1 && (
            <div className="d-flex flex-column gap-4">
              {/* Campaign Identification & Scope Card */}
              <div className="card border shadow-2xs rounded-3 bg-white">
                <div className="card-header bg-light border-bottom px-4 py-3">
                  <h5 className="fw-bold text-slate-900 m-0 fs-6">
                    1. Assurance Set Scope &amp; Identification
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
                        placeholder="e.g. Chevron Gorgon Charter Vetting 2026"
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

                    {/* Scope / Subtype Selector */}
                    <div className="col-12 col-md-4">
                      <label className="form-label text-secondary small fw-semibold" htmlFor="grid-assurance-type">
                        Scope <span className="text-danger">*</span>
                      </label>
                      <select
                        id="grid-assurance-type"
                        className={`form-select bg-white text-dark border-secondary-subtle fw-semibold ${fieldErrors.scope ? 'is-invalid' : ''}`}
                        value={assuranceType}
                        onChange={(e) => handleSelectScope(e.target.value as AssuranceSubtype)}
                        disabled={lockedScopes.length > 0}
                        aria-describedby="grid-assurance-type-help"
                      >
                        {ASSURANCE_SCOPE_OPTIONS.map((scope) => (
                          <option key={scope} value={scope}>
                            {scope}
                          </option>
                        ))}
                      </select>
                      {fieldErrors.scope && (
                        <div className="invalid-feedback d-block small mt-1 font-mono-code" style={{ fontSize: '0.75rem' }}>
                          {fieldErrors.scope}
                        </div>
                      )}
                      <div id="grid-assurance-type-help" className="form-text small">
                        {lockedScopes.length > 0
                          ? `${lockedScopes[0]} is set by the listing you came from.`
                          : 'A set covers one asset. Create a separate set for each vessel, crew member or equipment item.'}
                      </div>
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

              {/* the asset sits next to the contract period, so the overlap check runs against the asset actually picked */}
              {renderAssetPicker(assuranceType)}

              {/* Covered Assurance Objects Section (ADR 0029) */}
              <div className="card border shadow-2xs rounded-3 bg-white mt-4" id="covered-assurance-objects-card">
                <div className="card-header bg-light border-bottom px-4 py-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
                  <div>
                    <h5 className="fw-bold text-slate-900 m-0 fs-6">
                      Covered Assurance Objects ({selectedAssuranceObjects.length})
                    </h5>
                    <div className="text-muted small mt-0.5">
                      A set can cover any mix of objects (vessels, personnel, equipment, procedures, methods, documents, organizations). Each object shows its type and owner (ADR 0029).
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
                        setSelectedAssuranceObjects(portSetObjects);
                        if (v) setVesselId(v.id);
                        if (c) setSelectedCrewIds([c.id]);
                        if (eq) setSelectedEquipmentId(eq.id);
                        setSelectedScopes(['Vessel', 'Crew', 'Equipment']);
                        setTitle((prev) => prev.includes('Port Entry') ? prev : `${clientOrg} - Port Entry & Arrival Assurance Set`);
                      }}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Load Port-Entry Bundle
                    </button>
                  </div>
                </div>
                <div className="card-body p-4">
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
                          {selectedAssuranceObjects.map((obj) => (
                            <tr key={obj.id} data-testid={`assurance-object-row-${obj.id}`}>
                              <td>
                                <span className={`badge ${
                                  obj.type === 'vessel' ? 'bg-primary text-white' :
                                  obj.type === 'person' ? 'bg-success text-white' :
                                  obj.type === 'equipment' ? 'bg-warning text-dark' :
                                  obj.type === 'procedure' ? 'bg-info text-dark' :
                                  obj.type === 'method' ? 'bg-secondary text-white' :
                                  obj.type === 'document' ? 'bg-dark text-white' : 'bg-light text-dark border'
                                } text-capitalize font-mono-code`}>
                                  {obj.type}
                                </span>
                              </td>
                              <td className="fw-semibold text-dark">{obj.name}</td>
                              <td className="text-secondary small">{obj.ownerOrganization}</td>
                              <td className="font-mono-code small text-secondary">{obj.identifier || '—'}</td>
                              <td className="text-end">
                                <button
                                  type="button"
                                  className="btn btn-sm btn-link text-danger p-0"
                                  title="Remove object"
                                  onClick={() => {
                                    setSelectedAssuranceObjects((prev) => prev.filter((o) => o.id !== obj.id));
                                  }}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Add Object row */}
                  <div className="row g-2 align-items-center mt-3 pt-3 border-top">
                    <div className="col-12 col-md-3">
                      <select
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
                        className="form-select form-select-sm"
                        value={newObjectId}
                        onChange={(e) => setNewObjectId(e.target.value)}
                      >
                        <option value="">Select {newObjectType} to add...</option>
                        {availableObjectsForType.map((o) => (
                          <option key={o.id} value={o.id} disabled={selectedAssuranceObjects.some((x) => x.id === o.id)}>
                            {o.name} ({o.ownerOrganization}) {selectedAssuranceObjects.some((x) => x.id === o.id) ? '— added' : ''}
                          </option>
                        ))}
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
                          }
                        }}
                      >
                        <Plus className="w-4 h-4" />
                        Add Object
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Template Privacy & Access Scope Card */}
              <div className="card border shadow-2xs rounded-3 bg-white">
                <div className="card-header bg-light border-bottom px-4 py-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
                  <div>
                    <h5 className="fw-bold text-slate-900 m-0 fs-6">
                      2. Template Privacy &amp; Distribution Scope
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
                      3. Governance &amp; Stakeholder Assignments
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
                              Review Channel &amp; Authority Governance
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
                                Checks &amp; Stages
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

          {/* SCOPE TAB: the required documents of the chosen scope; its asset is picked on the Scope tab */}
          {currentStepData.subtype && (
            <div className="d-flex flex-column gap-4">
              {renderSubtypeSection(currentStepData.subtype)}
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
                            <strong>Scope:</strong> {selectedScopes.join(', ')}
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
                            <strong className="text-dark small d-block mb-1">Review &amp; Checks</strong>
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
                                isMandatory: doc.isMandatory,
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
                                  <strong className="text-dark small">Required &amp; Added Documents ({allNeededDocs.length})</strong>
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
                                                className={`badge ${doc.isCustom ? 'bg-primary-subtle text-primary border border-primary-subtle' : 'bg-secondary-subtle text-dark border'} font-mono-code`}
                                                style={{ fontSize: '0.7rem' }}
                                              >
                                                {doc.isCustom ? 'Added' : 'Required'}
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
                    Scope: {selectedScopes.join(', ') || 'None'} &nbsp;|&nbsp; Asset:{' '}
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
