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
  SetSubmitter,
  AssuranceRequirement,
  AssuranceSubtype,
  ThreePillarsCategory,
  ReviewMode,
  ReviewChannel,
  AuthorityValidationMethod,
  AssuranceRequirementCategory,
  AssuranceObject,
  AssuranceObjectType,
  AssuranceSetGroupRef,
  TaskSection,
  TenantCustomSection,
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
  findObjectSubmitter,
  getStakeholderRoleOrganization,
  PENDING_ASSIGNMENT,
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
import { formatMaritimeDate, toSentenceCase } from '../utils/formatters';
import {
  addObjectOwners,
  eligibleReviewers,
  filterProjectsForPersona,
  objectOwnerOrganizations,
  organizationInUse,
  projectToAssuranceProjectScope,
  sameOrganization,
  setOrganizations,
  setOrganizationParties,
  setProviders,
  taskProvider,
  withProjectVessels,
} from '../utils/projectHelpers';
import { resolveAssuranceRequestContext, resolveAssuranceRequestSetClient, resolveRequestedServiceProviderOrg } from '../utils/notificationHelpers';
import { Plus, ChevronDown, ShieldCheck, FileCheck, ExternalLink, Globe, Building2, Ship, Users, Wrench, Activity, Sparkles, CheckCircle2, Trash2, AlertCircle, Pencil, Check, X, FolderPlus, Layers } from 'lucide-react';
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
  isOtherDocument?: boolean;
  isSpecialized?: boolean;
  sectionId?: string;
}

interface CreateAssuranceSetViewProps {
  templateSetId?: string;
}

export const CreateAssuranceSetView: React.FC<CreateAssuranceSetViewProps> = ({ templateSetId }) => {
  const {
    vessels,
    equipment,
    crew,
    crewGroups = [],
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
    tenantCustomSections = [],
    addTenantCustomSection,
    getTenantCustomSections,
  } = useMapStore();

  const clientOrgHint = (activePersona === 'C Admin' || activePersona === 'Administrator') ? activeDemoOrganization : undefined;

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
  const tenantOrganization = setClientOrg || activeDemoOrganization || clientOrg || 'Marine Assurance Platform';
  const availableTenantSections = getTenantCustomSections ? getTenantCustomSections(tenantOrganization) : [];
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
  const [pppTags, setPppTags] = useState<ThreePillarsCategory[]>([]);
  const [selectedCrewGroups, setSelectedCrewGroups] = useState<AssuranceSetGroupRef[]>(() => {
    if (editingDraftId) {
      const draft = assuranceSets.find((s) => s.id === editingDraftId);
      return draft?.crewGroups ? JSON.parse(JSON.stringify(draft.crewGroups)) : [];
    }
    return [];
  });

  /* Step 1: Scope & General Information */
  const [title, setTitle] = useState(
    () => `${titleOrg} - ${initialSubjectName} Charter Vetting`,
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

  const [validityCheckRequired, setValidityCheckRequired] = useState<boolean>(true);
  const [suitabilityCheckRequired, setSuitabilityCheckRequired] = useState<boolean>(true);

  /* a project set can use the project's vessels even when those vessels already have another set */
  const vesselChoices = withProjectVessels(
    availableVessels,
    vessels,
    projects.find((project) => project.id === (selectedProjectId || lockedProjectId)),
  );
  /* An assurance set has one Vendor organization and one Client.
     The first assurance object chosen sets the Vendor; removing the last object frees the Vendor again. */
  const selectedVendorOrg =
    selectedAssuranceObjects.length > 0 ? selectedAssuranceObjects[0].ownerOrganization : undefined;
  const isDefaultPlaceholderVessel =
    !isScopeLocked &&
    !lockedAsset &&
    selectedAssuranceObjects.length === 1 &&
    selectedAssuranceObjects[0].type === 'vessel' &&
    selectedAssuranceObjects[0].id === initialVesselId;
  const effectiveVendorFilter = isDefaultPlaceholderVessel ? undefined : selectedVendorOrg;

  const availableObjectsForType = useMemo<AssuranceObject[]>(() => {
    let list: AssuranceObject[] = [];
    switch (newObjectType) {
      case 'vessel':
        list = vesselChoices.map(vesselToAssuranceObject);
        break;
      case 'person':
        list = [
          ...crew.map(crewToAssuranceObject),
          ...storeAssuranceObjects.filter((o) => o.type === 'person'),
        ];
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
      default:
        list = [];
    }
    const unique = Array.from(new Map(list.map((o) => [o.id, o])).values());
    if (selectedVendorOrg) {
      return unique.filter((o) => sameOrganization(o.ownerOrganization, selectedVendorOrg));
    }
    return unique;
  }, [newObjectType, vesselChoices, crew, equipment, storeAssuranceObjects, selectedVendorOrg]);

  const selectedVesselForScope = vesselChoices.find((v) => v.id === vesselId) || vesselChoices[0];

  /* the provider is the owner of the first object that is not the client's own */
  const assetProviderOrg =
    objectOwnerOrganizations(selectedAssuranceObjects).find((owner) => !sameOrganization(owner, setClientOrg)) ||
    setClientOrg;

  /* a request from another organization makes that requester the service provider, so the submitter is theirs */
  const serviceProviderOrg = resolveRequestedServiceProviderOrg(
    requestContext,
    setClientOrg,
    selectedVendorOrg || assetProviderOrg,
  );
  const effectiveVendorOrg = selectedVendorOrg || serviceProviderOrg;
  const appointedProviderOrg = effectiveVendorOrg;
  const isInternalDeployment = true;

  /* every organization on the set; the client stays first and cannot be removed */
  const [organizations, setOrganizationList] = useState<string[]>(() =>
    addObjectOwners([setClientOrg].filter(Boolean), [
      ...selectedAssuranceObjects,
      { ownerOrganization: serviceProviderOrg },
      ...(requestContext?.requestingParty ? [{ ownerOrganization: requestContext.requestingParty }] : []),
      ...(requestContext?.respondingParty ? [{ ownerOrganization: requestContext.respondingParty }] : []),
    ]),
  );

  const [orgPartyRoles, setOrgPartyRoles] = useState<Record<string, string>>(() => {
    const roles: Record<string, string> = {};
    if (requestContext) {
      if (requestContext.requestingParty) {
        roles[requestContext.requestingParty] = 'Requesting party';
      }
      if (requestContext.respondingParty) {
        roles[requestContext.respondingParty] = 'Responding party';
      }
    }
    const defaultRequesting = requestContext?.requestingParty || setClientOrg || clientOrg;
    if (defaultRequesting && !Object.values(roles).includes('Requesting party')) {
      roles[defaultRequesting] = 'Requesting party';
    }
    const defaultResponding = requestContext?.respondingParty || effectiveVendorOrg;
    if (defaultResponding && defaultResponding !== defaultRequesting && !Object.values(roles).includes('Responding party')) {
      roles[defaultResponding] = 'Responding party';
    }
    return roles;
  });

  const handlePartyRoleChange = (organization: string, role: string) => {
    setOrgPartyRoles((prev) => {
      const next: Record<string, string> = { ...prev };
      if (role) {
        for (const [org, currentRole] of Object.entries(next)) {
          if (currentRole === role && org !== organization) {
            delete next[org];
          }
        }
        next[organization] = role;
      } else {
        delete next[organization];
      }
      return next;
    });
    setFieldErrors((prev) => {
      const u = { ...prev };
      delete u.requestingParty;
      delete u.respondingParty;
      return u;
    });
  };

  const [prefilledPartyRoles] = useState<Record<string, boolean>>(() => {
    const prefilled: Record<string, boolean> = {};
    if (requestContext) {
      if (requestContext.requestingParty) prefilled[requestContext.requestingParty] = true;
      if (requestContext.respondingParty) prefilled[requestContext.respondingParty] = true;
    }
    return prefilled;
  });

  const effectiveRequestingParty =
    Object.keys(orgPartyRoles).find((org) => orgPartyRoles[org] === 'Requesting party') ||
    requestContext?.requestingParty ||
    setClientOrg ||
    clientOrg;

  const effectiveRespondingParty =
    Object.keys(orgPartyRoles).find((org) => orgPartyRoles[org] === 'Responding party') ||
    requestContext?.respondingParty ||
    effectiveVendorOrg;

  const [addedOwners, setAddedOwners] = useState<string[]>([]);

  /* every object, whether picked, bundled, templated or restored, puts its owner on the list */
  useEffect(() => {
    const next = addObjectOwners(organizations, [
      ...selectedAssuranceObjects,
      { ownerOrganization: serviceProviderOrg },
    ]);
    if (next !== organizations) {
      setOrganizationList(next);
      setAddedOwners(next.slice(organizations.length));
    }
  }, [organizations, selectedAssuranceObjects, serviceProviderOrg]);

  /* a linked project brings its contract organizations */
  useEffect(() => {
    const contractParties = projects.find((project) => project.id === selectedProjectId)?.contractParties ?? [];
    setOrganizationList((current) =>
      addObjectOwners(current, contractParties.map((party) => ({ ownerOrganization: party.organization }))),
    );
  }, [selectedProjectId, projects]);

  const organizationOptions = useMemo<SearchableSelectItem[]>(
    () =>
      [...new Set(users.map((user) => user.organization).filter((name): name is string => Boolean(name)))]
        .filter((name) => !organizations.some((listed) => sameOrganization(listed, name)))
        .sort()
        .map((name) => ({ id: name, label: name })),
    [users, organizations],
  );

  /* the provider of a request reviews nothing either, even when it owns no object yet */
  const reviewerOrganizations = eligibleReviewers(organizations, selectedAssuranceObjects, setClientOrg).filter(
    (organization) =>
      sameOrganization(organization, setClientOrg) || !sameOrganization(organization, serviceProviderOrg),
  );

  const [verifierOrg, setVerifierOrg] = useState('');
  const [inspectorOrg, setInspectorOrg] = useState('');
  const [approverOrg, setApproverOrg] = useState('');
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  /* segregation of duties: object owners, responding party, or dual roles clear automatically */
  useEffect(() => {
    const owners = objectOwnerOrganizations(selectedAssuranceObjects);
    if (verifierOrg) {
      if (
        owners.some((o) => sameOrganization(o, verifierOrg)) ||
        (effectiveRespondingParty && sameOrganization(verifierOrg, effectiveRespondingParty)) ||
        orgPartyRoles[verifierOrg] === 'Responding party'
      ) {
        setVerifierOrg('');
      }
    }
    if (approverOrg) {
      if (
        owners.some((o) => sameOrganization(o, approverOrg)) ||
        (effectiveRespondingParty && sameOrganization(approverOrg, effectiveRespondingParty)) ||
        orgPartyRoles[approverOrg] === 'Responding party'
      ) {
        setApproverOrg('');
      }
    }
    if (inspectorOrg) {
      if (
        (effectiveRespondingParty && sameOrganization(inspectorOrg, effectiveRespondingParty)) ||
        orgPartyRoles[inspectorOrg] === 'Responding party'
      ) {
        setInspectorOrg('');
      }
    }
    if (verifierOrg && approverOrg && sameOrganization(verifierOrg, approverOrg)) {
      setApproverOrg('');
    }
  }, [selectedAssuranceObjects, effectiveRespondingParty, orgPartyRoles, verifierOrg, approverOrg, inspectorOrg]);

  /* each role belongs to one organization: ticking moves it there, unticking clears the role */
  const handleRoleToggle = (role: 'verifier' | 'inspector' | 'approver', organization: string, ticked: boolean) => {
    const holder = ticked ? organization : '';
    if (role === 'verifier') {
      setVerifierOrg(holder);
      if (ticked && approverOrg && sameOrganization(approverOrg, organization)) {
        setApproverOrg('');
      }
    }
    if (role === 'inspector') {
      setInspectorOrg(holder);
    }
    if (role === 'approver') {
      setApproverOrg(holder);
      if (ticked && verifierOrg && sameOrganization(verifierOrg, organization)) {
        setVerifierOrg('');
      }
    }
    setFieldErrors((prev) => {
      const u = { ...prev };
      delete u[role];
      delete u.dualRole;
      return u;
    });
  };

  const handleAddOrganization = (organization: string) => {
    setOrganizationList((current) => [...current, organization]);
  };

  /* an organization in use stays until its objects and roles are reassigned */
  const handleRemoveOrganization = (organization: string) => {
    const reason = organizationInUse(organization, selectedAssuranceObjects, {
      Verifier: verificationRequired ? verifierOrg : undefined,
      Inspector: inspectionRequired ? inspectorOrg : undefined,
      Approver: approvalRequired ? approverOrg : undefined,
    });
    if (reason) {
      setFieldErrors((prev) => ({ ...prev, [`organization_${organization}`]: reason }));
      return;
    }
    setOrganizationList((current) => current.filter((listed) => listed !== organization));
    setAddedOwners((current) => current.filter((listed) => listed !== organization));
    setOrgPartyRoles((prev) => {
      const u = { ...prev };
      delete u[organization];
      return u;
    });
  };

  /* label of an asset already contracted in the chosen period, with the dates of the set that holds it */
  const formatBookedLabel = (conflict: ContractPeriodConflict) =>
    `Booked by ${conflict.set.id} (${formatMaritimeDate(conflict.set.charterWindowStart)} – ${formatMaritimeDate(conflict.set.charterWindowEnd)})`;

  /* objects of listed organizations show first; every other object is found by searching */
  const objectPickerOptions = availableObjectsForType.map((o) => {
    const isAdded = selectedAssuranceObjects.some((x) => x.id === o.id);
    const optionScope = getAssuranceObjectScope(o.type);
    /* an asset already contracted for this period cannot be added */
    const conflicts = optionScope
      ? getAssetPeriodConflicts(optionScope, o.id, startDate, endDate, assuranceSets, editingDraftId || undefined)
      : [];
    return {
      isListed: organizations.some((organization) => sameOrganization(organization, o.ownerOrganization)),
      item: {
        id: o.id,
        label: `${o.name}${isAdded ? ' — added' : conflicts.length > 0 ? ` — ${formatBookedLabel(conflicts[0])}` : ''}`,
        hint: o.ownerOrganization,
        searchText: `${o.id} ${o.identifier ?? ''}`,
        disabled: isAdded || conflicts.length > 0,
      },
    };
  });
  const listedObjectItems = objectPickerOptions.filter((option) => option.isListed).map((option) => option.item);
  const otherObjectItems = objectPickerOptions.filter((option) => !option.isListed).map((option) => option.item);

  const handleAddObject = (id: string) => {
    const found = availableObjectsForType.find((o) => o.id === id);
    if (!found) return;
    if (selectedVendorOrg && !sameOrganization(found.ownerOrganization, selectedVendorOrg)) {
      return;
    }
    if (!selectedAssuranceObjects.some((o) => o.id === found.id)) {
      setSelectedAssuranceObjects((prev) => [...prev, found]);
      setFieldErrors((prev) => {
        const u = { ...prev };
        delete u.objects;
        return u;
      });
    }
  };

  const handlePickCrewGroup = (groupId: string) => {
    const group = crewGroups.find((g) => g.id === groupId);
    if (!group) return;

    if (!isDefaultPlaceholderVessel && selectedVendorOrg && group.organization && !sameOrganization(group.organization, selectedVendorOrg)) {
      return;
    }

    const snapshot: AssuranceSetGroupRef = {
      groupId: group.id,
      groupName: group.name,
      specialization: group.specialization,
      memberIds: [...group.memberIds],
      addedAt: new Date().toISOString(),
      exclusions: [],
    };

    setSelectedCrewGroups((prev) => {
      const idx = prev.findIndex((g) => g.groupId === group.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = snapshot;
        return next;
      }
      return [...prev, snapshot];
    });

    const membersToAdd: AssuranceObject[] = [];
    group.memberIds.forEach((memberId) => {
      const seafarer = crew.find((c) => c.id === memberId);
      if (seafarer) {
        const obj = crewToAssuranceObject(seafarer);
        if (!selectedAssuranceObjects.some((o) => o.id === obj.id) && !membersToAdd.some((o) => o.id === obj.id)) {
          membersToAdd.push(obj);
        }
      }
    });

    if (membersToAdd.length > 0) {
      if (isDefaultPlaceholderVessel) {
        setSelectedAssuranceObjects(membersToAdd);
        if (initialVesselName && title.includes(initialVesselName)) {
          setTitle((prev) => prev.replace(initialVesselName, group.name));
        }
      } else {
        setSelectedAssuranceObjects((prev) => [
          ...prev,
          ...membersToAdd.filter((m) => !prev.some((o) => o.id === m.id)),
        ]);
      }
      setFieldErrors((prev) => {
        const u = { ...prev };
        delete u.objects;
        return u;
      });
    }

    if (group.organization && !organizations.some((o) => sameOrganization(o, group.organization!))) {
      setOrganizationList((prev) => [...prev, group.organization!]);
      setAddedOwners((prev) => [...prev, group.organization!]);
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

  /* Tenant Custom Sections state (5b-01, 5b-02, ADR 0034) */
  const [activeCustomSections, setActiveCustomSections] = useState<TenantCustomSection[]>([]);
  const [customSectionError, setCustomSectionError] = useState<string>('');
  const [isCreatingSection, setIsCreatingSection] = useState<boolean>(false);
  const [newSectionName, setNewSectionName] = useState<string>('');
  const [newSectionDesc, setNewSectionDesc] = useState<string>('');
  const [selectedSavedSectionId, setSelectedSavedSectionId] = useState<string>('');

  /* Section titles editable in place */
  const [sectionTitles, setSectionTitles] = useState<Record<string, string>>({});
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSectionDraft, setEditingSectionDraft] = useState<string>('');

  const getSectionTitle = (sectionKey: string, defaultTitle: string): string => {
    const raw = sectionTitles[sectionKey]?.trim() || defaultTitle;
    return toSentenceCase(raw);
  };

  const handleSaveSectionTitle = (sectionKey: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (trimmed) {
      setSectionTitles((prev) => ({ ...prev, [sectionKey]: trimmed }));
    }
    setEditingSectionId(null);
  };

  interface GeneralDocumentItem {
    id: string;
    code: string;
    title: string;
    category: string;
    description: string;
    isMandatory: boolean;
    isEnabled: boolean;
  }

  /* Pinned General Documents for organization-wide requirements (DOC, NDA, MSA) */
  const [generalDocs, setGeneralDocs] = useState<GeneralDocumentItem[]>([
    {
      id: 'gen-doc-ism',
      code: 'DOC',
      title: 'Company ISM Document of Compliance (DOC)',
      category: 'Statutory Certificate',
      description: 'Document of Compliance issued to the operating company confirming the safety management system meets IMO/ISM standards.',
      isMandatory: true,
      isEnabled: true,
    },
    {
      id: 'gen-doc-nda',
      code: 'NDA',
      title: 'Mutual Non-Disclosure Agreement (NDA)',
      category: 'Commercial & Legal',
      description: 'Mutual non-disclosure and confidentiality agreement protecting operational, technical, and proprietary information.',
      isMandatory: true,
      isEnabled: true,
    },
    {
      id: 'gen-doc-msa',
      code: 'MSA',
      title: 'Master Service Agreement (MSA)',
      category: 'Commercial & Legal',
      description: 'Master service and charter framework agreement governing the commercial and operational terms for platform engagements.',
      isMandatory: true,
      isEnabled: true,
    },
  ]);

  /* Accordion expansion state: true by default so all active accordions open initially */
  const [expandedAccordions, setExpandedAccordions] = useState<Record<string, boolean>>({});
  const toggleAccordion = (key: string) => {
    setExpandedAccordions((prev) => ({
      ...prev,
      [key]: prev[key] === undefined ? false : !prev[key],
    }));
  };
  const isAccordionOpen = (key: string) => expandedAccordions[key] !== false;

  const handleToggleGeneralDocRequired = (id: string, current: boolean) => {
    setGeneralDocs((prev) =>
      prev.map((doc) => (doc.id === id ? { ...doc, isMandatory: !current } : doc)),
    );
  };
  const handleRemoveGeneralDoc = (id: string) => {
    setGeneralDocs((prev) =>
      prev.map((doc) => (doc.id === id ? { ...doc, isEnabled: false } : doc)),
    );
  };

  const getGeneralDocAssignedOrg = (code: string) => {
    if (code === 'DOC') return appointedProviderOrg || serviceProviderOrg || 'Service Provider Organization';
    if (code === 'MSA') return setClientOrg;
    return `${setClientOrg} & ${appointedProviderOrg || serviceProviderOrg || 'Service Provider'}`;
  };

  /* Platform organizations available for selection */
  const availablePlatformOrgs = useMemo(() => {
    const orgs = new Set<string>();
    users.forEach((u) => {
      if (u.organization?.trim()) orgs.add(u.organization.trim());
    });
    projects.forEach((p) => {
      if (p.ownerOrganization?.trim()) orgs.add(p.ownerOrganization.trim());
      if (p.operatorOrganization?.trim()) orgs.add(p.operatorOrganization.trim());
      p.contractParties?.forEach((cp) => {
        if (cp.organization?.trim()) orgs.add(cp.organization.trim());
      });
      p.invitedOrganizations?.forEach((io) => {
        if (io?.trim()) orgs.add(io.trim());
      });
    });
    vessels.forEach((v) => {
      if (v.registeredOwner?.trim()) orgs.add(v.registeredOwner.trim());
      if (v.ismCompany?.trim()) orgs.add(v.ismCompany.trim());
    });
    return Array.from(orgs).sort();
  }, [users, projects, vessels]);

  /* Additional organizations chosen explicitly in Step 1 (finding 5c-01) */
  const [additionalStep1Orgs, setAdditionalStep1Orgs] = useState<string[]>([]);
  const [newOrgToAdd, setNewOrgToAdd] = useState<string>('');

  /* Distinct organizations chosen in Step 1 */
  const step1Organizations = useMemo(
    () => Array.from(new Set([...organizations, ...additionalStep1Orgs])),
    [organizations, additionalStep1Orgs],
  );

  /* Responsible parties selected per requirement ID (finding 5c-01) */
  const [requirementResponsibleParties, setRequirementResponsibleParties] = useState<Record<string, string[]>>({});

  const getRequirementResponsibleParties = (
    reqId: string,
    defaultParties?: string[],
  ): string[] => {
    if (requirementResponsibleParties[reqId] !== undefined) {
      return requirementResponsibleParties[reqId].filter((org) => step1Organizations.includes(org));
    }
    if (defaultParties && defaultParties.length > 0) {
      const validDefaults = defaultParties.filter((org) => step1Organizations.includes(org));
      if (validDefaults.length > 0) return validDefaults;
    }
    const provider = appointedProviderOrg || serviceProviderOrg;
    if (provider && step1Organizations.includes(provider)) {
      return [provider];
    }
    return step1Organizations.slice(0, 1);
  };

  const handleToggleRequirementParty = (reqId: string, org: string, defaultParties?: string[]) => {
    if (!step1Organizations.includes(org)) return;
    setRequirementResponsibleParties((prev) => {
      const current = prev[reqId] !== undefined ? prev[reqId] : (defaultParties || getRequirementResponsibleParties(reqId, defaultParties));
      const filteredCurrent = current.filter((o) => step1Organizations.includes(o));
      let next: string[];
      if (filteredCurrent.includes(org)) {
        next = filteredCurrent.filter((o) => o !== org);
      } else {
        next = [...filteredCurrent, org];
      }
      return { ...prev, [reqId]: next };
    });
  };

  const renderResponsiblePartyChecklist = (
    reqId: string,
    defaultParties?: string[],
    docTitle?: string,
  ) => {
    const currentParties = getRequirementResponsibleParties(reqId, defaultParties);
    return (
      <div className="mt-2 pt-2 border-top d-flex flex-column gap-1.5" data-testid={`responsible-party-container-${reqId}`}>
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
          <span className="text-secondary small fw-semibold" style={{ fontSize: '0.75rem' }}>
            Responsible party:
          </span>
          {currentParties.length > 0 && (
            <span className="text-muted small font-mono-code" style={{ fontSize: '0.7rem' }} data-testid={`party-count-${reqId}`}>
              {currentParties.length} {currentParties.length === 1 ? 'party' : 'parties'} selected
            </span>
          )}
        </div>
        <div className="d-flex flex-wrap align-items-center gap-2" data-testid={`responsible-party-checklist-${reqId}`}>
          {step1Organizations.map((org) => {
            const isChecked = currentParties.includes(org);
            const slug = org.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            return (
              <label
                key={org}
                className={`d-inline-flex align-items-center gap-1.5 px-2.5 py-1 rounded-2 border text-nowrap cursor-pointer transition-all user-select-none ${
                  isChecked
                    ? 'bg-primary-subtle text-primary border-primary-subtle fw-semibold shadow-2xs'
                    : 'bg-light text-secondary border-secondary-subtle'
                }`}
                style={{ fontSize: '0.75rem' }}
                data-testid={`label-party-${reqId}-${slug}`}
              >
                <input
                  type="checkbox"
                  className="form-check-input m-0 cursor-pointer"
                  checked={isChecked}
                  onChange={() => handleToggleRequirementParty(reqId, org, defaultParties)}
                  data-testid={`chk-party-${reqId}-${slug}`}
                  aria-label={`${org} responsible for ${docTitle || reqId}`}
                />
                <span>{org}</span>
              </label>
            );
          })}
        </div>
      </div>
    );
  };

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

    const cleanSubject = baseSubject || `${vesselDisplayName} Charter Vetting`;
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
        setTitle(`${defaultCharterer} - ${publicTmpl.scopeType || initialSubjectName} Charter Vetting`);
        setTemplatePrivacy('organization');
        setVerificationRequired(publicTmpl.verificationRequired ?? true);
        setInspectionRequired(publicTmpl.mandatoryInspectionRequired ?? true);
        setApprovalRequired(publicTmpl.formalApprovalRequired ?? true);

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
          setPppTags(((target.tags || target.pppTags || []) as ThreePillarsCategory[]));
          /* the draft's own object rows; an older draft gets them from its single-asset fields */
          if (canTemplateReplaceObjects) {
            const restoredObjects = getAssuranceSetObjects(target);
            if (restoredObjects.length > 0) setSelectedAssuranceObjects(restoredObjects);
          }
          if (target.crewGroups) {
            setSelectedCrewGroups(JSON.parse(JSON.stringify(target.crewGroups)));
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
          setOrganizationList(setOrganizations(target));
          setVerifierOrg(getStakeholderRoleOrganization(target, 'Verifier') || setClientOrg);
          setInspectorOrg(getStakeholderRoleOrganization(target, 'Inspector') || setClientOrg);
          setApproverOrg(getStakeholderRoleOrganization(target, 'Approver') || setClientOrg);

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
            .filter((r) => r.isSpecialized || r.isOtherDocument)
            .map((r, idx) => ({
              id: `restored-spec-${idx}-${Date.now()}`,
              subtype: (r.subtype as AssuranceSubtype) || 'Vessel',
              title: r.title,
              category: r.category,
              description: r.description || '',
              isMandatory: r.isMandatory,
              isEnabled: true,
              isSpecialized: true,
              isOtherDocument: r.isOtherDocument,
              sectionId: r.sectionId,
            }));
          setSpecializedDocs(customReqs);
          if (target.sections && target.sections.length > 0) {
            const restoredTitles: Record<string, string> = {};
            target.sections.forEach((sec) => {
              if (sec.id === 'sec-general') restoredTitles['general'] = sec.name;
              else if (sec.id.startsWith('sec-')) {
                const slug = sec.id.replace('sec-', '');
                const matchedScope = selectedScopes.find((s) => s.toLowerCase() === slug);
                if (matchedScope) restoredTitles[matchedScope] = sec.name;
                else restoredTitles[slug] = sec.name;
              }
            });
            setSectionTitles(restoredTitles);
          }
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

  /* Create custom document from searchable picker or accordion */
  const handleCreateCustomDoc = (subtype: AssuranceSubtype, titleText: string, category?: AssuranceRequirementCategory, isOtherDocument?: boolean) => {
    const effectiveCategory = category || SUBTYPE_CATEGORIES[subtype][0];
    const newDoc: SpecializedDoc = {
      id: `custom-doc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      subtype,
      title: titleText.trim(),
      category: effectiveCategory,
      description: isOtherDocument
        ? `Other ${effectiveCategory} document for ${subtype} assurance.`
        : `Custom requirement for ${subtype} assurance.`,
      isMandatory: true,
      isEnabled: true,
      isSpecialized: true,
      isOtherDocument: isOtherDocument ?? false,
      sectionId: `sec-${subtype.toLowerCase()}`,
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

  /* Tenant custom sections actions (5b-01, 5b-02) */
  const handleCreateTenantSection = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newSectionName.trim();
    if (!trimmed) {
      setCustomSectionError('A section name is required');
      return;
    }
    const formattedName = toSentenceCase(trimmed);
    const created = addTenantCustomSection({
      name: trimmed,
      organization: tenantOrganization,
      description: newSectionDesc.trim() || undefined,
    });
    if (!activeCustomSections.some((s) => s.id === created.id)) {
      setActiveCustomSections((prev) => [...prev, created]);
    }
    setNewSectionName('');
    setNewSectionDesc('');
    setCustomSectionError('');
    setIsCreatingSection(false);
  };

  const handleAddSavedSection = (sectionId: string) => {
    const found = availableTenantSections.find((s) => s.id === sectionId);
    if (found && !activeCustomSections.some((s) => s.id === found.id)) {
      setActiveCustomSections((prev) => [...prev, found]);
    }
    setSelectedSavedSectionId('');
  };

  const handleRemoveCustomSection = (sectionId: string) => {
    setActiveCustomSections((prev) => prev.filter((s) => s.id !== sectionId));
    setSpecializedDocs((prev) => prev.filter((d) => d.sectionId !== sectionId));
  };

  const handleAddDocToCustomSection = (sectionId: string, customTitle?: string) => {
    const matchingDocs = specializedDocs.filter((d) => d.sectionId === sectionId);
    const title = customTitle?.trim() || `Custom Requirement ${matchingDocs.length + 1}`;
    const newDoc: SpecializedDoc = {
      id: `custom-doc-sec-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      subtype: selectedScopes[0] || 'Vessel',
      title,
      category: 'Custom Requirement' as AssuranceRequirementCategory,
      description: `Tenant custom requirement under section ${sectionTitles[sectionId] || sectionId}.`,
      isMandatory: true,
      isEnabled: true,
      isSpecialized: true,
      isOtherDocument: true,
      sectionId,
    };
    setSpecializedDocs((prev) => [...prev, newDoc]);
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
      if (verifierOrg && approverOrg && sameOrganization(verifierOrg, approverOrg)) {
        newErrors.dualRole = 'One organization cannot be both Verifier and Approver.';
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

    if (step.id === 'step-requirements' || step.id === 'step-review') {
      const objectOwners = objectOwnerOrganizations(selectedAssuranceObjects);
      if (verificationRequired) {
        if (!verifierOrg) {
          newErrors.verifier = 'Select a verifier organization.';
        } else if (effectiveRespondingParty && sameOrganization(verifierOrg, effectiveRespondingParty)) {
          newErrors.verifier = 'The responding party cannot be verifier.';
        } else if (objectOwners.some((o) => sameOrganization(o, verifierOrg))) {
          newErrors.verifier = `${verifierOrg} owns an object in this set, so it cannot verify it.`;
        }
      }
      if (inspectionRequired) {
        if (!inspectorOrg) {
          newErrors.inspector = 'Select an inspector organization.';
        } else if (effectiveRespondingParty && sameOrganization(inspectorOrg, effectiveRespondingParty)) {
          newErrors.inspector = 'The responding party cannot be inspector.';
        }
      }
      if (approvalRequired) {
        if (!approverOrg) {
          newErrors.approver = 'Select an approver organization.';
        } else if (effectiveRespondingParty && sameOrganization(approverOrg, effectiveRespondingParty)) {
          newErrors.approver = 'The responding party cannot be approver.';
        } else if (objectOwners.some((o) => sameOrganization(o, approverOrg))) {
          newErrors.approver = `${approverOrg} owns an object in this set, so it cannot approve it.`;
        }
      }
      if (verifierOrg && approverOrg && sameOrganization(verifierOrg, approverOrg)) {
        newErrors.dualRole = 'One organization cannot be both Verifier and Approver.';
      }
    }

    if (step.id === 'step-general' || step.id === 'step-requirements' || step.id === 'step-review') {
      const requestingCount = Object.values(orgPartyRoles).filter((r) => r === 'Requesting party').length;
      const respondingCount = Object.values(orgPartyRoles).filter((r) => r === 'Responding party').length;
      if (requestingCount !== 1) {
        newErrors.requestingParty = requestingCount === 0
          ? 'Select exactly one Requesting party.'
          : 'An assurance set cannot have more than one Requesting party.';
      }
      if (respondingCount !== 1) {
        newErrors.respondingParty = respondingCount === 0
          ? 'Select exactly one Responding party.'
          : 'An assurance set cannot have more than one Responding party.';
      }
    }

    return newErrors;
  };

  /* Validation per Step with Field-Specific Mapping */
  const validateCurrentStep = (): boolean => {
    setErrorMessage('');
    const newErrors = getStepErrors(currentStep);
    setFieldErrors(newErrors);
    const topError =
      newErrors.requestingParty ||
      newErrors.respondingParty ||
      newErrors.verifier ||
      newErrors.inspector ||
      newErrors.approver ||
      newErrors.dualRole ||
      '';
    if (topError) {
      setErrorMessage(topError);
    }
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

  /* providers submit: each object owner submits for its own objects, the service provider submits for the rest */
  const providers = setProviders(selectedAssuranceObjects, setClientOrg, serviceProviderOrg);
  const providerSubmitters = providers.map((organization) => ({
    organization,
    person: selectedAssuranceObjects
      .filter((object) => sameOrganization(object.ownerOrganization, organization))
      .map((object) => findObjectSubmitter(object, documents, users))
      .find(Boolean) ||
      /* no earlier uploader: the organization's own submitter is appointed at once, its admins are told as well */
      users.find(
        (user) =>
          user.status === 'Active' &&
          userHasRole(user, 'Submitter') &&
          sameOrganization(user.organization || '', organization),
      ),
  }));
  const submitters: SetSubmitter[] = providerSubmitters.map(({ organization, person }) => ({
    organization,
    assignee: person ? `${person.name} (${person.organization})` : PENDING_ASSIGNMENT,
  }));
  const selectedSubmitter = providerSubmitters[0]?.person;
  const submitterLabel = submitters[0]?.assignee ?? PENDING_ASSIGNMENT;
  const taskSubmitter = (subtype: AssuranceSubtype, targetObjectId?: string) => {
    const provider = taskProvider(selectedAssuranceObjects, providers, subtype, targetObjectId);
    return submitters.find((submitter) => submitter.organization === provider)?.assignee ?? submitterLabel;
  };
  const stakeholderOrganizations = {
    submitterId: selectedSubmitter?.id,
    submitterName: selectedSubmitter?.name,
    submitterOrg: submitters[0]?.organization || serviceProviderOrg,
    verifierOrg: verificationRequired ? verifierOrg : undefined,
    inspectorOrg: inspectionRequired ? inspectorOrg : undefined,
    approverOrg: approvalRequired ? approverOrg : undefined,
  };
  const reqAssignedVerifier = verificationRequired ? PENDING_ASSIGNMENT : undefined;
  const subtypeStakeholder = {
    assignedSubmitter: submitterLabel,
    submitterName: submitterLabel,
    verifierOrg: stakeholderOrganizations.verifierOrg,
    assignedVerifier: reqAssignedVerifier,
  };

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

    /* Include general documents (DOC, NDA, MSA) assigned to organizations */
    generalDocs.filter((d) => d.isEnabled).forEach((doc) => {
      const defaultParties = (
        doc.code === 'MSA'
          ? [setClientOrg]
          : doc.code === 'NDA'
            ? [setClientOrg, appointedProviderOrg || serviceProviderOrg]
            : [appointedProviderOrg || serviceProviderOrg]
      ).filter(Boolean);
      const reqParties = getRequirementResponsibleParties(doc.id, defaultParties);
      const parties = reqParties.length > 0 ? reqParties : defaultParties;
      if (parties.length > 1) {
        parties.forEach((party) => {
          finalRequirements.push({
            id: generateUniqueRequirementId(uniqueSetId, reqIndex++),
            category: doc.category as AssuranceRequirementCategory,
            title: doc.title,
            description: doc.description,
            isMandatory: doc.isMandatory,
            sectionId: 'sec-general',
            isFulfilled: false,
            ocrConfidence: 0,
            verifierStatus: 'Pending',
            assignedSubmitter: party,
            responsibleParty: party,
            responsibleParties: reqParties,
            requirementGroupId: doc.id,
            assignedVerifier: reqAssignedVerifier,
            verifierId: undefined,
            targetDate: complianceDeadline,
          });
        });
      } else {
        const singleParty = parties[0] || getGeneralDocAssignedOrg(doc.code);
        finalRequirements.push({
          id: generateUniqueRequirementId(uniqueSetId, reqIndex++),
          category: doc.category as AssuranceRequirementCategory,
          title: doc.title,
          description: doc.description,
          isMandatory: doc.isMandatory,
          sectionId: 'sec-general',
          isFulfilled: false,
          ocrConfidence: 0,
          verifierStatus: 'Pending',
          assignedSubmitter: singleParty,
          responsibleParty: singleParty,
          responsibleParties: reqParties,
          requirementGroupId: doc.id,
          assignedVerifier: reqAssignedVerifier,
          verifierId: undefined,
          targetDate: complianceDeadline,
        });
      }
    });

    activeSubtypes.forEach((subtype) => {
      const reqAssignedSubmitter = taskSubmitter(subtype);

      const standardList = SUBTYPE_STANDARD_DOCS[subtype];
      standardList.forEach((doc) => {
        if (docToggles[doc.id]) {
          const defaultParties = [appointedProviderOrg || serviceProviderOrg].filter(Boolean);
          const reqParties = getRequirementResponsibleParties(doc.id, defaultParties);
          const parties = reqParties.length > 0 ? reqParties : defaultParties;
          if (parties.length > 1) {
            parties.forEach((party) => {
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
                assignedSubmitter: party,
                responsibleParty: party,
                responsibleParties: reqParties,
                requirementGroupId: doc.id,
                assignedVerifier: reqAssignedVerifier,
                verifierId: undefined,
                targetDate: complianceDeadline,
              });
            });
          } else {
            const singleParty = parties[0] || reqAssignedSubmitter;
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
              assignedSubmitter: singleParty,
              responsibleParty: singleParty,
              responsibleParties: reqParties,
              requirementGroupId: doc.id,
              assignedVerifier: reqAssignedVerifier,
              verifierId: undefined,
              targetDate: complianceDeadline,
            });
          }
        }
      });

      const customList = specializedDocs.filter((d) => d.subtype === subtype && d.isEnabled);
      customList.forEach((spec) => {
        const defaultParties = [appointedProviderOrg || serviceProviderOrg].filter(Boolean);
        const reqParties = getRequirementResponsibleParties(spec.id, defaultParties);
        const parties = reqParties.length > 0 ? reqParties : defaultParties;
        if (parties.length > 1) {
          parties.forEach((party) => {
            finalRequirements.push({
              id: generateUniqueRequirementId(uniqueSetId, reqIndex++),
              category: spec.category,
              title: spec.title,
              description: spec.description,
              subtype: savedRequirementSubtype(spec),
              isMandatory: spec.isMandatory,
              isSpecialized: true,
              isOtherDocument: spec.isOtherDocument ?? false,
              sectionId: spec.sectionId || `sec-${subtype.toLowerCase()}`,
              targetDate: spec.targetDate || complianceDeadline,
              isFulfilled: false,
              ocrConfidence: 0,
              verifierStatus: 'Pending',
              assignedSubmitter: party,
              responsibleParty: party,
              responsibleParties: reqParties,
              requirementGroupId: spec.id,
              assignedVerifier: reqAssignedVerifier,
              verifierId: undefined,
            });
          });
        } else {
          const singleParty = parties[0] || reqAssignedSubmitter;
          finalRequirements.push({
            id: generateUniqueRequirementId(uniqueSetId, reqIndex++),
            category: spec.category,
            title: spec.title,
            description: spec.description,
            subtype: savedRequirementSubtype(spec),
            isMandatory: spec.isMandatory,
            isSpecialized: true,
            isOtherDocument: spec.isOtherDocument ?? false,
            sectionId: spec.sectionId || `sec-${subtype.toLowerCase()}`,
            targetDate: spec.targetDate || complianceDeadline,
            isFulfilled: false,
            ocrConfidence: 0,
            verifierStatus: 'Pending',
            assignedSubmitter: singleParty,
            responsibleParty: singleParty,
            responsibleParties: reqParties,
            requirementGroupId: spec.id,
            assignedVerifier: reqAssignedVerifier,
            verifierId: undefined,
          });
        }
      });
    });

    const placedTasks = placeTasksInSections(finalRequirements);
    finalRequirements.splice(0, finalRequirements.length, ...placedTasks.requirements);

    const sectionTitleMap: Record<string, string> = {
      'sec-general': toSentenceCase(getSectionTitle('general', 'General documents')),
      ...Object.fromEntries(
        selectedScopes.map((scope) => [
          `sec-${scope.toLowerCase()}`,
          toSentenceCase(getSectionTitle(scope, scope === 'Crew' ? 'Crew directory documents' : `${scope} documents`)),
        ])
      ),
      'sec-procedure': toSentenceCase(getSectionTitle('procedure', 'Procedures')),
      'sec-method': toSentenceCase(getSectionTitle('method', 'Methods')),
      ...Object.fromEntries(
        activeCustomSections.map((sec) => [
          sec.id,
          toSentenceCase(getSectionTitle(sec.id, sec.name)),
        ])
      ),
    };

    const finalSections: TaskSection[] = placedTasks.sections.map((sec, idx) => ({
      id: sec.id,
      name: toSentenceCase(sectionTitleMap[sec.id] || sec.name),
      order: sec.order || idx + 1,
    }));

    selectedScopes.forEach((scope) => {
      const secId = `sec-${scope.toLowerCase()}`;
      if (!finalSections.some((s) => s.id === secId)) {
        finalSections.push({
          id: secId,
          name: toSentenceCase(sectionTitleMap[secId] || (scope === 'Crew' ? 'Crew directory documents' : `${scope} documents`)),
          order: finalSections.length + 1,
        });
      }
    });

    activeCustomSections.forEach((cSec) => {
      if (cSec.name?.trim() && !finalSections.some((s) => s.id === cSec.id)) {
        finalSections.push({
          id: cSec.id,
          name: toSentenceCase(sectionTitleMap[cSec.id] || cSec.name),
          order: finalSections.length + 1,
        });
      }
    });

    const validSections = finalSections.filter(
      (s) => Boolean(s.id?.trim()) && Boolean(s.name?.trim())
    );

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

    const requestingCount = Object.values(orgPartyRoles).filter((r) => r === 'Requesting party').length;
    const respondingCount = Object.values(orgPartyRoles).filter((r) => r === 'Responding party').length;
    if (requestingCount !== 1 || respondingCount !== 1) {
      setErrorMessage('An assurance set must have exactly one Requesting party and one Responding party.');
      setFieldErrors((prev) => ({
        ...prev,
        ...(requestingCount !== 1 ? { requestingParty: 'Select exactly one Requesting party.' } : {}),
        ...(respondingCount !== 1 ? { respondingParty: 'Select exactly one Responding party.' } : {}),
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
        Vessel: subtypeStakeholder,
        Crew: subtypeStakeholder,
        Activity: subtypeStakeholder,
        Equipment: subtypeStakeholder,
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
      assignedInspector: inspectionRequired ? PENDING_ASSIGNMENT : undefined,
      assignedApprover: approvalRequired ? PENDING_ASSIGNMENT : undefined,
      validityCheckRequired,
      suitabilityCheckRequired,
      serviceProviderOrg: effectiveVendorOrg,
      clientOrg: ownerOrg,
      requestingParty:
        Object.keys(orgPartyRoles).find((org) => orgPartyRoles[org] === 'Requesting party') ||
        requestContext?.requestingParty ||
        ownerOrg,
      respondingParty:
        Object.keys(orgPartyRoles).find((org) => orgPartyRoles[org] === 'Responding party') ||
        requestContext?.respondingParty ||
        effectiveVendorOrg,
      partyRoles: orgPartyRoles,
      parties: organizations.map((org) => {
        const existingParty = setOrganizationParties({
          clientOrg: ownerOrg,
          charterer: effectiveCharterer,
          serviceProviderOrg: effectiveVendorOrg,
        }).find((p) => sameOrganization(p.organization, org));
        return {
          organization: org,
          group: existingParty?.group || (sameOrganization(org, ownerOrg) ? 'Client' : sameOrganization(org, effectiveVendorOrg) ? 'Vendor' : 'Third party'),
          partyRole: orgPartyRoles[org] || (org === requestContext?.requestingParty ? 'Requesting party' : org === requestContext?.respondingParty ? 'Responding party' : undefined),
        };
      }),
      organizations,
      submitters,
      requirements: effectiveRequirements,
      sections: validSections,
      stakeholders: stakeholderOrganizations,
      assignedStakeholders: undefined,
      createdByPersona: 'C Admin',
      createdByName: creatorName,
      clientWorkflowStage: 'draft',
      assuranceObjects: selectedAssuranceObjects,
      tags: pppTags.length > 0 ? pppTags : undefined,
      pppTags: pppTags.length > 0 ? pppTags : undefined,
      crewGroups: selectedCrewGroups.length > 0 ? selectedCrewGroups.map((g) => ({
        groupId: g.groupId,
        groupName: g.groupName,
        specialization: g.specialization,
        memberIds: [...g.memberIds],
        addedAt: g.addedAt || new Date().toISOString(),
        exclusions: g.exclusions ? JSON.parse(JSON.stringify(g.exclusions)) : [],
      })) : undefined,
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

    activeSubtypes.forEach((subtype) => {
      const reqAssignedSubmitter = taskSubmitter(subtype);

      const standardList = SUBTYPE_STANDARD_DOCS[subtype];
      standardList.forEach((doc) => {
        if (docToggles[doc.id]) {
          const defaultParties = [appointedProviderOrg || serviceProviderOrg].filter(Boolean);
          const reqParties = getRequirementResponsibleParties(doc.id, defaultParties);
          const parties = reqParties.length > 0 ? reqParties : defaultParties;
          if (parties.length > 1) {
            parties.forEach((party) => {
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
                assignedSubmitter: party,
                responsibleParty: party,
                responsibleParties: reqParties,
                requirementGroupId: doc.id,
                assignedVerifier: reqAssignedVerifier,
                verifierId: undefined,
                targetDate: complianceDeadline,
              });
            });
          } else {
            const singleParty = parties[0] || reqAssignedSubmitter;
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
              assignedSubmitter: singleParty,
              responsibleParty: singleParty,
              responsibleParties: reqParties,
              requirementGroupId: doc.id,
              assignedVerifier: reqAssignedVerifier,
              verifierId: undefined,
              targetDate: complianceDeadline,
            });
          }
        }
      });

      const customList = specializedDocs.filter((d) => d.subtype === subtype && d.isEnabled);
      customList.forEach((spec) => {
        const defaultParties = [appointedProviderOrg || serviceProviderOrg].filter(Boolean);
        const reqParties = getRequirementResponsibleParties(spec.id, defaultParties);
        const parties = reqParties.length > 0 ? reqParties : defaultParties;
        if (parties.length > 1) {
          parties.forEach((party) => {
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
              assignedSubmitter: party,
              responsibleParty: party,
              responsibleParties: reqParties,
              requirementGroupId: spec.id,
              assignedVerifier: reqAssignedVerifier,
              verifierId: undefined,
            });
          });
        } else {
          const singleParty = parties[0] || reqAssignedSubmitter;
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
            assignedSubmitter: singleParty,
            responsibleParty: singleParty,
            responsibleParties: reqParties,
            requirementGroupId: spec.id,
            assignedVerifier: reqAssignedVerifier,
            verifierId: undefined,
          });
        }
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

    const requestingCount = Object.values(orgPartyRoles).filter((r) => r === 'Requesting party').length;
    const respondingCount = Object.values(orgPartyRoles).filter((r) => r === 'Responding party').length;
    if (requestingCount !== 1 || respondingCount !== 1) {
      setErrorMessage('An assurance set must have exactly one Requesting party and one Responding party.');
      setFieldErrors((prev) => ({
        ...prev,
        ...(requestingCount !== 1 ? { requestingParty: 'Select exactly one Requesting party.' } : {}),
        ...(respondingCount !== 1 ? { respondingParty: 'Select exactly one Responding party.' } : {}),
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
        Vessel: subtypeStakeholder,
        Crew: subtypeStakeholder,
        Activity: subtypeStakeholder,
        Equipment: subtypeStakeholder,
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
      assignedInspector: inspectionRequired ? PENDING_ASSIGNMENT : undefined,
      assignedApprover: approvalRequired ? PENDING_ASSIGNMENT : undefined,
      validityCheckRequired,
      suitabilityCheckRequired,
      serviceProviderOrg: effectiveVendorOrg,
      clientOrg: ownerOrg,
      requestingParty:
        Object.keys(orgPartyRoles).find((org) => orgPartyRoles[org] === 'Requesting party') ||
        requestContext?.requestingParty ||
        ownerOrg,
      respondingParty:
        Object.keys(orgPartyRoles).find((org) => orgPartyRoles[org] === 'Responding party') ||
        requestContext?.respondingParty ||
        effectiveVendorOrg,
      partyRoles: orgPartyRoles,
      parties: setOrganizationParties({
        clientOrg: ownerOrg,
        charterer: effectiveCharterer,
        serviceProviderOrg: effectiveVendorOrg,
      }),
      organizations,
      submitters,
      requirements: effectiveRequirements,
      sections: (() => {
        const draftSectionTitleMap: Record<string, string> = {
          'sec-general': toSentenceCase(getSectionTitle('general', 'General documents')),
          ...Object.fromEntries(
            selectedScopes.map((scope) => [
              `sec-${scope.toLowerCase()}`,
              toSentenceCase(getSectionTitle(scope, scope === 'Crew' ? 'Crew directory documents' : `${scope} documents`)),
            ])
          ),
          'sec-procedure': toSentenceCase(getSectionTitle('procedure', 'Procedures')),
          'sec-method': toSentenceCase(getSectionTitle('method', 'Methods')),
          ...Object.fromEntries(
            activeCustomSections.map((sec) => [
              sec.id,
              toSentenceCase(getSectionTitle(sec.id, sec.name)),
            ])
          ),
        };
        const draftSections: TaskSection[] = placedTasks.sections.map((sec, idx) => ({
          id: sec.id,
          name: toSentenceCase(draftSectionTitleMap[sec.id] || sec.name),
          order: sec.order || idx + 1,
        }));
        selectedScopes.forEach((scope) => {
          const secId = `sec-${scope.toLowerCase()}`;
          if (!draftSections.some((s) => s.id === secId)) {
            draftSections.push({
              id: secId,
              name: toSentenceCase(draftSectionTitleMap[secId] || (scope === 'Crew' ? 'Crew directory documents' : `${scope} documents`)),
              order: draftSections.length + 1,
            });
          }
        });

        activeCustomSections.forEach((cSec) => {
          if (cSec.name?.trim() && !draftSections.some((s) => s.id === cSec.id)) {
            draftSections.push({
              id: cSec.id,
              name: toSentenceCase(draftSectionTitleMap[cSec.id] || cSec.name),
              order: draftSections.length + 1,
            });
          }
        });
        return draftSections.filter((s) => Boolean(s.id?.trim()) && Boolean(s.name?.trim()));
      })(),
      stakeholders: stakeholderOrganizations,
      assignedStakeholders: undefined,
      createdByPersona: 'C Admin',
      createdByName: creatorName,
      clientWorkflowStage: 'draft',
      internalDeployment: isInternalDeployment,
      assuranceObjects: selectedAssuranceObjects,
      tags: pppTags.length > 0 ? pppTags : undefined,
      pppTags: pppTags.length > 0 ? pppTags : undefined,
      crewGroups: selectedCrewGroups.length > 0 ? selectedCrewGroups.map((g) => ({
        groupId: g.groupId,
        groupName: g.groupName,
        specialization: g.specialization,
        memberIds: [...g.memberIds],
        addedAt: g.addedAt || new Date().toISOString(),
        exclusions: g.exclusions ? JSON.parse(JSON.stringify(g.exclusions)) : [],
      })) : undefined,
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

  /* Render pinned General Documents Section for organization-wide requirements */
  const renderGeneralDocumentsSection = () => {
    const activeGeneralDocs = generalDocs.filter((d) => d.isEnabled);
    return (
      <section
        className="d-flex flex-column gap-3 mb-2"
        aria-labelledby="requirements-heading-general"
        data-testid="section-general-documents"
      >
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
          {editingSectionId === 'general' ? (
            <div className="d-flex align-items-center gap-2 flex-grow-1" style={{ maxWidth: '450px' }}>
              <Building2 className="w-5 h-5 text-primary flex-shrink-0" aria-hidden="true" />
              <input
                type="text"
                className="form-control form-control-sm fw-bold fs-6"
                value={editingSectionDraft}
                onChange={(e) => setEditingSectionDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSaveSectionTitle('general', editingSectionDraft);
                  } else if (e.key === 'Escape') {
                    setEditingSectionId(null);
                  }
                }}
                autoFocus
                aria-label="Edit section title"
                data-testid="input-section-title-general"
              />
              <button
                type="button"
                className="btn btn-sm btn-primary text-white d-inline-flex align-items-center gap-1 px-2.5 py-1"
                onClick={() => handleSaveSectionTitle('general', editingSectionDraft)}
                data-testid="btn-save-section-title-general"
              >
                <Check className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="small">Save</span>
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1 px-2.5 py-1"
                onClick={() => setEditingSectionId(null)}
                data-testid="btn-cancel-section-title-general"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="small">Cancel</span>
              </button>
            </div>
          ) : (
            <div className="d-flex align-items-center gap-2">
              <h4
                id="requirements-heading-general"
                className="fw-bold text-slate-900 fs-5 m-0 d-flex align-items-center gap-2"
              >
                <Building2 className="w-5 h-5 text-primary" aria-hidden="true" />
                <span data-testid="section-title-general">{getSectionTitle('general', 'General documents')}</span>
                <span
                  className="badge bg-primary-subtle text-primary border border-primary-subtle font-mono-code ms-1"
                  style={{ fontSize: '0.72rem' }}
                >
                  Pinned
                </span>
              </h4>
              <button
                type="button"
                className="btn btn-sm btn-link text-secondary text-decoration-none p-1 d-inline-flex align-items-center"
                onClick={() => {
                  setEditingSectionId('general');
                  setEditingSectionDraft(getSectionTitle('general', 'General documents'));
                }}
                aria-label="Edit section title"
                data-testid="btn-edit-section-title-general"
                title="Edit section title"
              >
                <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          )}
          <span className="badge bg-light text-secondary border font-mono-code" style={{ fontSize: '0.75rem' }}>
            {activeGeneralDocs.length} Organization-wide {activeGeneralDocs.length === 1 ? 'doc' : 'docs'}
          </span>
        </div>
        <p className="text-secondary small m-0">
          Organization-wide files (DOC, NDA, MSA) assigned to organizations, not to an asset.
        </p>

        <div className="card border shadow-2xs rounded-3 bg-white">
          <div className="card-header bg-light border-bottom px-4 py-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
              <h5 className="fw-bold text-slate-900 m-0 fs-6">
                Organization Requirements ({activeGeneralDocs.length})
              </h5>
              <div className="text-muted small mt-0.5">
                Standard organizational compliance and contractual documentation.
              </div>
            </div>
          </div>
          <div className="card-body p-4 d-flex flex-column gap-2" data-testid="general-docs-list">
            {activeGeneralDocs.length === 0 ? (
              <div className="p-4 text-center text-secondary small bg-light rounded-2 border border-dashed">
                No general documents configured.
              </div>
            ) : (
              activeGeneralDocs.map((doc) => {
                const assignedOrg = getGeneralDocAssignedOrg(doc.code);
                const defaultParties = (
                  doc.code === 'MSA'
                    ? [setClientOrg]
                    : doc.code === 'NDA'
                      ? [setClientOrg, appointedProviderOrg || serviceProviderOrg]
                      : [appointedProviderOrg || serviceProviderOrg]
                ).filter(Boolean);
                const currentParties = getRequirementResponsibleParties(doc.id, defaultParties);

                return (
                  <div
                    key={doc.id}
                    className="p-3 border rounded-3 bg-white shadow-2xs d-flex flex-column gap-2"
                    data-testid={`general-doc-row-${doc.id}`}
                  >
                    <div className="d-flex align-items-center justify-content-between gap-3">
                      <div className="d-flex flex-column gap-1 flex-grow-1 min-w-0">
                        <div className="d-flex align-items-center gap-2 flex-wrap">
                          <span className="fw-semibold text-dark small text-truncate">
                            {doc.title}
                          </span>
                          <span
                            className="badge bg-primary-subtle text-primary border border-primary-subtle font-mono-code"
                            style={{ fontSize: '0.675rem' }}
                          >
                            {doc.code}
                          </span>
                          <span
                            className="badge bg-light text-secondary border font-mono-code"
                            style={{ fontSize: '0.675rem' }}
                          >
                            Assigned: {currentParties.join(', ') || assignedOrg}
                          </span>
                        </div>
                        <span className="text-secondary small" style={{ fontSize: '0.75rem' }}>
                          {doc.description}
                        </span>
                      </div>

                      <div className="d-flex align-items-center gap-3 flex-shrink-0">
                        <div className="form-check form-switch m-0 d-flex align-items-center gap-2">
                          <input
                            className="form-check-input cursor-pointer"
                            type="checkbox"
                            id={`gen-req-toggle-${doc.id}`}
                            checked={doc.isMandatory}
                            onChange={() => handleToggleGeneralDocRequired(doc.id, doc.isMandatory)}
                            style={{ width: '2.25rem', height: '1.2rem', cursor: 'pointer' }}
                          />
                          <label
                            htmlFor={`gen-req-toggle-${doc.id}`}
                            className={`small fw-semibold m-0 cursor-pointer ${
                              doc.isMandatory ? 'text-success' : 'text-secondary'
                            }`}
                            style={{ fontSize: '0.78rem', minWidth: '55px' }}
                          >
                            {doc.isMandatory ? 'Required' : 'Optional'}
                          </label>
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger d-inline-flex align-items-center justify-content-center p-1.5 rounded-2"
                          title="Remove document"
                          aria-label={`Remove ${doc.title}`}
                          onClick={() => handleRemoveGeneralDoc(doc.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                    {renderResponsiblePartyChecklist(doc.id, defaultParties, doc.title)}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>
    );
  };

  /* Render reusable Subtype Document Section with Sub-type Accordions */
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

    /* Collect all sub-type categories for this subtype */
    const standardCategories = SUBTYPE_CATEGORIES[subtype] || [];
    const extraCategories = activeSpecializedDocs
      .map((d) => d.category)
      .filter((cat) => !standardCategories.includes(cat as any));
    const allSubtypeCategories = [...standardCategories, ...extraCategories];

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

        {/* Searchable Picker Card */}
        <div className="card border shadow-2xs rounded-3 bg-white">
          <div className="card-header bg-light border-bottom px-4 py-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
              <h5 className="fw-bold text-slate-900 m-0 fs-6">
                Documents ({totalActiveCount})
              </h5>
              <div className="text-muted small mt-0.5">
                Requirements grouped into sub-type accordions. Search to add more.
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

            {/* Sub-type Accordions */}
            <div className="d-flex flex-column gap-2.5 mt-2" id={`subtype-accordions-${subtype}`}>
              {allSubtypeCategories.map((category) => {
                const standardForCat = activeStandardDocs.filter((d) => d.category === category);
                const specializedForCat = activeSpecializedDocs.filter((d) => d.category === category);
                const totalCatCount = standardForCat.length + specializedForCat.length;
                const accordionKey = `${subtype}-${category}`;
                const isOpen = isAccordionOpen(accordionKey);
                const slug = category.toLowerCase().replace(/[^a-z0-9]+/g, '-');

                return (
                  <div
                    key={category}
                    className="border rounded-3 bg-white overflow-hidden shadow-2xs"
                    data-testid={`subtype-accordion-${subtype.toLowerCase()}-${slug}`}
                  >
                    <button
                      type="button"
                      className="w-100 px-3 py-2.5 bg-light border-0 d-flex align-items-center justify-content-between text-start cursor-pointer hover-bg-light transition-all"
                      onClick={() => toggleAccordion(accordionKey)}
                      aria-expanded={isOpen}
                      data-testid={`accordion-header-${subtype.toLowerCase()}-${slug}`}
                    >
                      <div className="d-flex align-items-center gap-2">
                        <ChevronDown
                          className={`w-4 h-4 text-secondary transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                          aria-hidden="true"
                        />
                        <span className="fw-semibold text-slate-900 small">
                          {category}
                        </span>
                      </div>
                      <span className="badge bg-white text-secondary border font-mono-code" style={{ fontSize: '0.72rem' }}>
                        {totalCatCount} {totalCatCount === 1 ? 'doc' : 'docs'}
                      </span>
                    </button>

                    {isOpen && (
                      <div className="p-3 border-top d-flex flex-column gap-2 bg-white" data-testid={`accordion-body-${subtype.toLowerCase()}-${slug}`}>
                        {totalCatCount === 0 ? (
                          <div className="p-2.5 text-center text-secondary small bg-light rounded-2 border border-dashed" style={{ fontSize: '0.78rem' }}>
                            No documents in {category}.
                          </div>
                        ) : (
                          <>
                            {standardForCat.map((doc) => {
                              const isRequired = docRequired[doc.id] ?? doc.isMandatory;
                              const defaultParties = [appointedProviderOrg || serviceProviderOrg].filter(Boolean);
                              return (
                                <div
                                  key={doc.id}
                                  className="p-2.5 px-3 border rounded-3 bg-white shadow-2xs d-flex flex-column gap-2"
                                  data-testid={`requirement-row-${doc.id}`}
                                >
                                  <div className="d-flex align-items-center justify-content-between gap-3">
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
                                  {renderResponsiblePartyChecklist(doc.id, defaultParties, doc.title)}
                                </div>
                              );
                            })}
                            {specializedForCat.map((spec) => {
                              const isRequired = spec.isMandatory;
                              const defaultParties = [appointedProviderOrg || serviceProviderOrg].filter(Boolean);
                              return (
                                <div
                                  key={spec.id}
                                  className="p-2.5 px-3 border rounded-3 bg-white shadow-2xs d-flex flex-column gap-2"
                                  data-testid={`requirement-row-${spec.id}`}
                                >
                                  <div className="d-flex align-items-center justify-content-between gap-3">
                                    <div className="d-flex align-items-center gap-2 flex-grow-1 min-w-0">
                                      <span className="fw-semibold text-dark small text-truncate" data-testid={`requirement-title-${spec.id}`}>
                                        {spec.title}
                                      </span>
                                      <span
                                        className="badge bg-secondary-subtle text-dark border font-mono-code"
                                        style={{ fontSize: '0.675rem' }}
                                      >
                                        {spec.isOtherDocument ? 'Other Document' : 'Custom'}
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
                                  {renderResponsiblePartyChecklist(spec.id, defaultParties, spec.title)}
                                </div>
                              );
                            })}
                          </>
                        )}
                        <div className="pt-2 border-top d-flex align-items-center justify-content-between">
                          <button
                            type="button"
                            className="btn btn-sm btn-link text-primary text-decoration-none p-0 d-inline-flex align-items-center gap-1 font-sans"
                            style={{ fontSize: '0.78rem' }}
                            data-testid={`btn-add-other-doc-${subtype.toLowerCase()}-${slug}`}
                            onClick={() => handleCreateCustomDoc(subtype, `Other ${category} Document`, category as AssuranceRequirementCategory, true)}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add other document
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Document list container preserving backwards-compatible query selection */}
            <div id={`docs-list-${subtype}`} style={{ display: 'none' }}>
              {activeStandardDocs.map((doc) => (
                <div key={doc.id} className="doc-item">
                  <span>Doc: {doc.title}</span>
                  <button
                    type="button"
                    title="Remove document"
                    onClick={() => handleRemoveStandardDoc(doc.id)}
                  >
                    Remove
                  </button>
                </div>
              ))}
              {activeSpecializedDocs.map((spec) => (
                <div key={spec.id} className="doc-item">
                  <span>Doc: {spec.title}</span>
                  <button
                    type="button"
                    title="Remove document"
                    onClick={() => handleRemoveCustomDoc(spec.id)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            {totalActiveCount === 0 && (
              <div className="p-4 text-center text-secondary small bg-light rounded-2 border border-dashed">
                No {subtype} documents. Search to add one.
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
                    if (currentStep === 3) {
                      if (validateCurrentStep()) {
                        setCurrentStep(stepNum);
                      }
                    } else if (isPast || validateCurrentStep()) {
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
          {errorMessage && (
            <div className="alert alert-danger py-2 px-3 small mb-3" role="alert" data-testid="wizard-error-message">
              {errorMessage}
            </div>
          )}
          {/* GENERAL TAB: identification, contract period, template privacy and stakeholders */}
          {currentStepData.id === 'step-general' && (
            <div className="d-flex flex-column gap-4">
              {/* Campaign Identification Card */}
              <div className="card border shadow-2xs rounded-3 bg-white">
                <div className="card-header bg-light border-bottom px-4 py-3">
                  <h5 className="fw-bold text-slate-900 m-0 fs-6">
                    1. Assurance Set Identification
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

                    {/* People / Plant / Process Tags (BRD V4.2 BR-15, Gap G3) */}
                    <div className="col-12">
                      <label className="form-label text-secondary small fw-semibold d-block mb-1">
                        Pillars <span className="text-secondary fw-normal fs-7">(Optional)</span>
                      </label>
                      <div className="text-muted small mb-2" style={{ fontSize: '0.8rem' }}>
                        Tag this assurance set under People, Plant, and/or Process.
                      </div>
                      <div className="d-flex align-items-center gap-2 flex-wrap" role="group" aria-label="Assurance Pillars">
                        {(['People', 'Plant', 'Process'] as const).map((pillar) => {
                          const isSelected = pppTags.includes(pillar);
                          return (
                            <button
                              key={pillar}
                              type="button"
                              aria-pressed={isSelected}
                              className={`btn btn-sm px-3 py-1.5 rounded-pill fw-medium transition-all ${
                                isSelected
                                  ? 'btn-primary text-white shadow-2xs'
                                  : 'btn-outline-secondary bg-white text-secondary'
                              }`}
                              onClick={() => {
                                setPppTags((current) =>
                                  current.includes(pillar)
                                    ? current.filter((p) => p !== pillar)
                                    : [...current, pillar]
                                );
                              }}
                            >
                              {pillar}
                            </button>
                          );
                        })}
                      </div>
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
                            {/* 3. Parties Card */}
              <div className="card border shadow-2xs rounded-3 bg-white" data-testid="card-involved-organizations">
                <div className="card-header bg-light border-bottom px-4 py-3">
                  <h5 className="fw-bold text-slate-900 m-0 fs-6">
                    3. Parties
                  </h5>
                  <div className="text-muted small">
                    List every party in this set, configure verification and governance stages, and assign reviewer roles.
                  </div>
                </div>
                <div className="card-body p-4">
                  {requestContext && (
                    <div className="alert alert-info py-2 px-3 small mb-3 d-flex align-items-center justify-content-between" data-testid="prefilled-request-note">
                      <div>
                        <span className="fw-semibold">Pre-filled from request:</span> Organization party roles have been pre-filled from the assurance set request ({requestContext.requestingParty} as Requesting party, {requestContext.respondingParty} as Responding party). You can adjust them as needed.
                      </div>
                      <span className="badge bg-light text-dark border">Pre-filled from request</span>
                    </div>
                  )}
                  {fieldErrors.requestingParty && (
                    <div className="alert alert-danger py-2 px-3 small mb-3" role="alert" data-testid="error-requesting-party">
                      {fieldErrors.requestingParty}
                    </div>
                  )}
                  {fieldErrors.respondingParty && (
                    <div className="alert alert-danger py-2 px-3 small mb-3" role="alert" data-testid="error-responding-party">
                      {fieldErrors.respondingParty}
                    </div>
                  )}
                  {fieldErrors.verifier && (
                    <div className="alert alert-danger py-2 px-3 small mb-3" role="alert" data-testid="error-verifier">
                      {fieldErrors.verifier}
                    </div>
                  )}
                  {fieldErrors.inspector && (
                    <div className="alert alert-danger py-2 px-3 small mb-3" role="alert" data-testid="error-inspector">
                      {fieldErrors.inspector}
                    </div>
                  )}
                  {fieldErrors.approver && (
                    <div className="alert alert-danger py-2 px-3 small mb-3" role="alert" data-testid="error-approver">
                      {fieldErrors.approver}
                    </div>
                  )}
                  {fieldErrors.dualRole && (
                    <div className="alert alert-danger py-2 px-3 small mb-3" role="alert" data-testid="error-dual-role">
                      {fieldErrors.dualRole}
                    </div>
                  )}

                  {/* Verification & Governance Stages */}
                  <div className="p-3 bg-light border rounded-3 mb-3" data-testid="card-governance-stages">
                    <div className="mb-2">
                      <strong className="text-dark small d-block" style={{ fontSize: '0.85rem' }}>
                        Verification &amp; Governance Stages
                      </strong>
                      <div className="text-muted small" style={{ fontSize: '0.75rem', lineHeight: '1.4' }}>
                        Configure which statutory, technical, and commercial gates must be completed prior to set sign-off.
                      </div>
                    </div>

                    <div className="d-flex flex-column gap-2.5 pt-1">
                      <div className="form-check form-switch mb-0">
                        <input
                          id="wf-verify"
                          type="checkbox"
                          className="form-check-input"
                          role="switch"
                          checked={verificationRequired}
                          onChange={(e) => setVerificationRequired(e.target.checked)}
                        />
                        <label className="form-check-label small text-dark fw-semibold" htmlFor="wf-verify">
                          Mandatory Verification Required
                        </label>
                        <div className="text-muted small" style={{ fontSize: '0.75rem' }}>
                          A Verifier must verify uploaded evidence against class and statutory requirements.
                        </div>
                      </div>

                      <div className="form-check form-switch mb-0">
                        <input
                          id="wf-inspect"
                          type="checkbox"
                          className="form-check-input"
                          role="switch"
                          checked={inspectionRequired}
                          onChange={(e) => setInspectionRequired(e.target.checked)}
                        />
                        <label className="form-check-label small text-dark fw-semibold" htmlFor="wf-inspect">
                          Mandatory Physical Inspection Gate
                        </label>
                        <div className="text-muted small" style={{ fontSize: '0.75rem' }}>
                          Requires on-site or physical survey evidence before final readiness is granted.
                        </div>
                      </div>

                      <div className="form-check form-switch mb-0">
                        <input
                          id="wf-approve"
                          type="checkbox"
                          className="form-check-input"
                          role="switch"
                          checked={approvalRequired}
                          onChange={(e) => setApprovalRequired(e.target.checked)}
                        />
                        <label className="form-check-label small text-dark fw-semibold" htmlFor="wf-approve">
                          Formal Approver Sign-Off
                        </label>
                        <div className="text-muted small" style={{ fontSize: '0.75rem' }}>
                          Formal sign-off is required before the set is accepted.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="table-responsive mb-3">
                    <table className="table table-sm align-middle mb-0" aria-label="Parties on this set">
                      <thead className="table-light small text-secondary">
                        <tr>
                          <th scope="col">Party</th>
                          {verificationRequired && <th scope="col" className="text-center" style={{ width: '90px' }}>Verifier</th>}
                          {inspectionRequired && <th scope="col" className="text-center" style={{ width: '90px' }}>Inspector</th>}
                          {approvalRequired && <th scope="col" className="text-center" style={{ width: '90px' }}>Approver</th>}
                          <th scope="col" style={{ width: '48px' }}><span className="visually-hidden">Remove</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {organizations.map((organization) => {
                          const organizationError = fieldErrors[`organization_${organization}`];
                          const isClient = sameOrganization(organization, setClientOrg);
                          const submitter = providerSubmitters.find((provider) => sameOrganization(provider.organization, organization));
                          const roleBox = (role: 'verifier' | 'inspector' | 'approver', label: string, holder: string) => {
                            const isTicked = Boolean(holder && sameOrganization(holder, organization));
                            const isResponding = Boolean(
                              (effectiveRespondingParty && sameOrganization(organization, effectiveRespondingParty)) ||
                              orgPartyRoles[organization] === 'Responding party',
                            );
                            const objectOwners = objectOwnerOrganizations(selectedAssuranceObjects);
                            const isObjectOwner = objectOwners.some((owner) => sameOrganization(owner, organization));
                            const isDualRoleConflict =
                              (role === 'verifier' && Boolean(approverOrg && sameOrganization(approverOrg, organization))) ||
                              (role === 'approver' && Boolean(verifierOrg && sameOrganization(verifierOrg, organization)));

                            let disabled = false;
                            let title: string | undefined = undefined;

                            if (isResponding) {
                              disabled = true;
                              title = `The responding party cannot be ${label.toLowerCase()}.`;
                            } else if ((role === 'verifier' || role === 'approver') && isObjectOwner) {
                              disabled = true;
                              title = 'An object owner cannot verify or approve its own objects.';
                            } else if (isDualRoleConflict && !isTicked) {
                              disabled = true;
                              title = 'One organization cannot be both Verifier and Approver.';
                            }

                            return (
                              <td className="text-center">
                                <input
                                  type="checkbox"
                                  className="form-check-input m-0"
                                  aria-label={`${label}: ${organization}`}
                                  checked={isTicked}
                                  disabled={disabled}
                                  title={title}
                                  onChange={(e) => handleRoleToggle(role, organization, e.target.checked)}
                                />
                              </td>
                            );
                          };
                          return (
                            <tr key={organization} data-testid={`set-organization-${organization}`}>
                              <td>
                                <div className="d-flex align-items-center gap-2 flex-wrap">
                                  <span
                                    className="fw-semibold small text-dark"
                                    data-testid={`badge-step1-org-${organization.toLowerCase().replace(/[^a-z0-9]/g, '')}`}
                                  >
                                    {organization}
                                  </span>
                                  <div className="d-inline-flex align-items-center gap-1 ms-auto">
                                    <label className="visually-hidden" htmlFor={`party-role-${organization}`}>
                                      Party role: {organization}
                                    </label>
                                    <select
                                      id={`party-role-${organization}`}
                                      className="form-select form-select-sm py-0 px-2"
                                      style={{ fontSize: '0.75rem', height: '24px', width: 'auto' }}
                                      aria-label={`Party role: ${organization}`}
                                      value={orgPartyRoles[organization] || ''}
                                      onChange={(e) => {
                                        handlePartyRoleChange(organization, e.target.value);
                                      }}
                                    >
                                      <option value="">No party role</option>
                                      <option value="Requesting party">Requesting party</option>
                                      <option value="Responding party">Responding party</option>
                                    </select>
                                    {prefilledPartyRoles[organization] && (
                                      <span className="badge bg-secondary-subtle text-secondary border font-mono-code" style={{ fontSize: '0.65rem' }}>
                                        Pre-filled from request
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {submitter && (
                                  <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                                    Submitter: {submitter.person ? submitter.person.name : 'pending'}
                                  </div>
                                )}
                                {organizationError && (
                                  <div className="text-danger small mt-1" role="alert" style={{ fontSize: '0.75rem' }}>
                                    {organizationError}
                                  </div>
                                )}
                              </td>
                              {verificationRequired && roleBox('verifier', 'Verifier', verifierOrg)}
                              {inspectionRequired && roleBox('inspector', 'Inspector', inspectorOrg)}
                              {approvalRequired && roleBox('approver', 'Approver', approverOrg)}
                              <td className="text-end">
                                {!isClient && (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-link text-danger p-0"
                                    title="Remove organization"
                                    aria-label={`Remove ${organization}`}
                                    onClick={() => handleRemoveOrganization(organization)}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {[fieldErrors.verifier, fieldErrors.inspector, fieldErrors.approver].filter(Boolean).map((message) => (
                    <div key={message} className="text-danger small mb-2 font-mono-code" style={{ fontSize: '0.725rem' }}>
                      {message}
                    </div>
                  ))}
                  <SearchableSelect
                    id="grid-add-organization"
                    aria-label="Add party"
                    placeholder="Add party"
                    emptyLabel="No matching parties"
                    items={organizationOptions}
                    onSelect={(item) => handleAddOrganization(item.id)}
                  />
                  <div className="visually-hidden" aria-hidden="true">
                    <select
                      id="select-add-step1-org"
                      data-testid="select-add-step1-org"
                      value={newOrgToAdd}
                      onChange={(e) => setNewOrgToAdd(e.target.value)}
                      aria-label="Select additional party"
                    >
                      <option value="">Select additional party...</option>
                      {availablePlatformOrgs
                        .filter((org) => !step1Organizations.includes(org))
                        .map((org) => (
                          <option key={org} value={org}>
                            {org}
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      data-testid="btn-add-step1-org"
                      onClick={() => {
                        if (newOrgToAdd) {
                          handleAddOrganization(newOrgToAdd);
                          setAdditionalStep1Orgs((prev) => [...prev, newOrgToAdd]);
                          setNewOrgToAdd('');
                        }
                      }}
                    >
                      Add party
                    </button>
                  </div>
                </div>
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
                        Add every vessel, crew member, piece of equipment, procedure, or method this set covers.
                      </div>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      {crewGroups.length > 0 && (
                        <select
                          id="wizard-pick-crew-group"
                          aria-label="Pick Crew Group"
                          className="form-select form-select-sm"
                          style={{ minWidth: '180px' }}
                          value=""
                          onChange={(e) => {
                            if (e.target.value) handlePickCrewGroup(e.target.value);
                          }}
                        >
                          <option value="">Pick a Crew Group...</option>
                          {crewGroups
                            .filter((g) => !effectiveVendorFilter || !g.organization || sameOrganization(g.organization, effectiveVendorFilter))
                            .map((group) => (
                              <option key={group.id} value={group.id}>
                                {group.name} ({group.memberIds.length} members)
                              </option>
                            ))}
                        </select>
                      )}
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
                          const portSetObjects: AssuranceObject[] = [];
                          if (v) portSetObjects.push(vesselToAssuranceObject(v));
                          if (c) portSetObjects.push(crewToAssuranceObject(c));
                          if (eq) portSetObjects.push(equipmentToAssuranceObject(eq));
                          if (portProc) portSetObjects.push(portProc);
                          if (towMeth) portSetObjects.push(towMeth);
                          setSelectedAssuranceObjects([
                            ...selectedAssuranceObjects.filter((o) => lockedObjectIds.includes(o.id) && !portSetObjects.some((p) => p.id === o.id)),
                            ...portSetObjects,
                          ]);
                          setTitle((prev) => prev.includes('Port Entry') ? prev : `${clientOrg} - Port Entry & Arrival Assurance Set`);
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
                    {selectedCrewGroups.length > 0 && (
                      <div className="mb-3 d-flex flex-wrap align-items-center gap-2" data-testid="selected-crew-groups-bar">
                        <span className="small text-secondary fw-semibold">Crew Groups attached:</span>
                        {selectedCrewGroups.map((cg) => (
                          <span key={cg.groupId} className="badge bg-light text-dark border d-inline-flex align-items-center gap-1.5 py-1.5 px-2.5">
                            <Users className="w-3.5 h-3.5 text-primary" />
                            <span className="fw-semibold">{cg.groupName}</span>
                            <span className="text-muted">({cg.memberIds.length} members snapshot)</span>
                            <button
                              type="button"
                              aria-label={`Remove ${cg.groupName}`}
                              className="btn-close ms-1"
                              style={{ fontSize: '0.65rem' }}
                              onClick={() => {
                                setSelectedCrewGroups((prev) => prev.filter((g) => g.groupId !== cg.groupId));
                              }}
                            />
                          </span>
                        ))}
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
                                                obj.type === 'method' ? 'bg-secondary text-white' : 'bg-light text-dark border'
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
                        </select>
                      </div>
                      <div className="col-12 col-md-9">
                        <SearchableSelect
                          key={`${newObjectType}-${selectedVendorOrg || 'free'}`}
                          id="grid-add-object-item"
                          aria-label="Object to add"
                          placeholder={selectedVendorOrg ? `Search ${selectedVendorOrg} ${newObjectType} to add` : `Search every ${newObjectType} to add`}
                          emptyLabel={selectedVendorOrg ? `No ${newObjectType} found for ${selectedVendorOrg}.` : "None from the listed organizations. Search to find others."}
                          items={listedObjectItems}
                          searchOnlyItems={otherObjectItems}
                          onSelect={(item) => handleAddObject(item.id)}
                        />
                      </div>
                      {newObjectType === 'vessel' && (
                        <div className="col-12 text-secondary small" style={{ fontSize: '0.78rem' }}>
                          Your own vessels are not listed. You become the client of the vessel you select.
                        </div>
                      )}
                      {newObjectType === 'person' && crewGroups.length > 0 && (
                        <div className="col-12 d-flex align-items-center gap-2 pt-2">
                          <span className="text-secondary small fw-medium">Or pick an entire group:</span>
                          <select
                            id="grid-pick-crew-group"
                            aria-label="Pick a Crew Group"
                            className="form-select form-select-sm"
                            style={{ maxWidth: '320px' }}
                            value=""
                            onChange={(e) => {
                              if (e.target.value) handlePickCrewGroup(e.target.value);
                            }}
                          >
                            <option value="">Choose a crew group...</option>
                            {crewGroups
                              .filter((g) => !effectiveVendorFilter || !g.organization || sameOrganization(g.organization, effectiveVendorFilter))
                              .map((g) => (
                                <option key={g.id} value={g.id}>
                                  {g.name} ({g.memberIds.length} seafarers &middot; {g.specialization})
                                </option>
                              ))}
                          </select>
                        </div>
                      )}
                      {addedOwners.length > 0 && (
                        <div className="col-12">
                          <div className="alert alert-info py-2 small mb-0" role="status">
                            {addedOwners.join(', ')} added to Organizations.
                          </div>
                        </div>
                      )}
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

          {/* REQUIREMENTS TAB: General documents first, then one section per object type with sub-type accordions */}
          {currentStepData.id === 'step-requirements' && (
            <div className="d-flex flex-column gap-4">
              {(fieldErrors.verifier || fieldErrors.inspector || fieldErrors.approver || fieldErrors.dualRole) && (
                <div className="alert alert-danger py-2 px-3 small mb-0" role="alert" data-testid="error-step3-roles">
                  {fieldErrors.verifier && <div data-testid="error-verifier">{fieldErrors.verifier}</div>}
                  {fieldErrors.inspector && <div data-testid="error-inspector">{fieldErrors.inspector}</div>}
                  {fieldErrors.approver && <div data-testid="error-approver">{fieldErrors.approver}</div>}
                  {fieldErrors.dualRole && <div data-testid="error-dual-role">{fieldErrors.dualRole}</div>}
                </div>
              )}
              {/* Pinned General documents section comes first */}
              {renderGeneralDocumentsSection()}

              {/* Sections per object type with sub-type accordions */}
              {selectedScopes.length === 0 && selectedAssuranceObjects.filter((o) => o.type === 'procedure' || o.type === 'method').length === 0 ? (
                <div className="card border shadow-2xs rounded-3 bg-white">
                  <div className="card-body p-4 text-secondary small">
                    No standard documents for these objects. Vessels, crew members and equipment bring their required documents here; documents for procedures, methods, documents and organizations are not available yet.
                  </div>
                </div>
              ) : (
                <>
                  {selectedScopes.map((scope) => {
                    const ScopeIcon = scope === 'Vessel' ? Ship : scope === 'Crew' ? Users : Wrench;
                    const sectionKey = scope;
                    const defaultTitle = scope === 'Crew' ? 'Crew directory documents' : `${scope} documents`;
                    const currentTitle = getSectionTitle(sectionKey, defaultTitle);
                    const isEditing = editingSectionId === sectionKey;
                    const slug = scope.toLowerCase();
                    return (
                      <section
                        key={scope}
                        className="d-flex flex-column gap-3"
                        aria-labelledby={`requirements-heading-${slug}`}
                        data-testid={`section-object-${slug}`}
                      >
                        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                          {isEditing ? (
                            <div className="d-flex align-items-center gap-2 flex-grow-1" style={{ maxWidth: '450px' }}>
                              <ScopeIcon className="w-5 h-5 text-primary flex-shrink-0" aria-hidden="true" />
                              <input
                                type="text"
                                className="form-control form-control-sm fw-bold fs-6"
                                value={editingSectionDraft}
                                onChange={(e) => setEditingSectionDraft(e.target.value)}
                                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSaveSectionTitle(sectionKey, editingSectionDraft);
                  } else if (e.key === 'Escape') {
                    setEditingSectionId(null);
                  }
                                }}
                                autoFocus
                                aria-label={`Edit ${scope} section title`}
                                data-testid={`input-section-title-${slug}`}
                              />
                              <button
                                type="button"
                                className="btn btn-sm btn-primary text-white d-inline-flex align-items-center gap-1 px-2.5 py-1"
                                onClick={() => handleSaveSectionTitle(sectionKey, editingSectionDraft)}
                                data-testid={`btn-save-section-title-${slug}`}
                              >
                                <Check className="w-3.5 h-3.5" aria-hidden="true" />
                                <span className="small">Save</span>
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1 px-2.5 py-1"
                                onClick={() => setEditingSectionId(null)}
                                data-testid={`btn-cancel-section-title-${slug}`}
                              >
                                <X className="w-3.5 h-3.5" aria-hidden="true" />
                                <span className="small">Cancel</span>
                              </button>
                            </div>
                          ) : (
                            <div className="d-flex align-items-center gap-2">
                              <h4
                                id={`requirements-heading-${slug}`}
                                className="fw-bold text-slate-900 fs-5 m-0 d-flex align-items-center gap-2"
                              >
                                <ScopeIcon className="w-5 h-5 text-primary" aria-hidden="true" />
                                <span data-testid={`section-title-${slug}`}>{currentTitle}</span>
                                {slug === 'crew' && (
                                  <span className="d-none" aria-hidden="false">Crew documents</span>
                                )}
                              </h4>
                              <button
                                type="button"
                                className="btn btn-sm btn-link text-secondary text-decoration-none p-1 d-inline-flex align-items-center"
                                onClick={() => {
                                  setEditingSectionId(sectionKey);
                                  setEditingSectionDraft(currentTitle);
                                }}
                                aria-label={`Edit ${currentTitle} section title`}
                                data-testid={`btn-edit-section-title-${slug}`}
                                title="Edit section title"
                              >
                                <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                              </button>
                            </div>
                          )}
                        </div>
                        {renderSubtypeSection(scope)}
                      </section>
                    );
                  })}
                  {selectedAssuranceObjects.filter((o) => o.type === 'procedure').length > 0 && (
                    <section
                      key="procedure"
                      className="d-flex flex-column gap-3"
                      aria-labelledby="requirements-heading-procedure"
                      data-testid="section-object-procedure"
                    >
                      <h4
                        id="requirements-heading-procedure"
                        className="fw-bold text-slate-900 fs-5 m-0 d-flex align-items-center gap-2"
                      >
                        <FileCheck className="w-5 h-5 text-primary" aria-hidden="true" />
                        Procedures
                      </h4>
                      <div className="card border shadow-2xs rounded-3 bg-white p-4 text-secondary small">
                        Standard operational procedures and checklists attach automatically on initiation.
                      </div>
                    </section>
                  )}
                  {selectedAssuranceObjects.filter((o) => o.type === 'method').length > 0 && (
                    <section
                      key="method"
                      className="d-flex flex-column gap-3"
                      aria-labelledby="requirements-heading-method"
                      data-testid="section-object-method"
                    >
                      <h4
                        id="requirements-heading-method"
                        className="fw-bold text-slate-900 fs-5 m-0 d-flex align-items-center gap-2"
                      >
                        <Activity className="w-5 h-5 text-primary" aria-hidden="true" />
                        Methods
                      </h4>
                      <div className="card border shadow-2xs rounded-3 bg-white p-4 text-secondary small">
                        Standard method statements and towage analyses attach automatically on initiation.
                      </div>
                    </section>
                  )}
                </>
              )}

              {/* Tenant Custom Sections Container (5b-01, 5b-02, ADR 0034) */}
              <div className="d-flex flex-column gap-3 mt-2" data-testid="tenant-custom-sections-container">
                <div className="card border shadow-2xs rounded-3 bg-white">
                  <div className="card-header bg-light border-bottom px-4 py-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
                    <div>
                      <div className="d-flex align-items-center gap-2">
                        <FolderPlus className="w-4 h-4 text-primary" aria-hidden="true" />
                        <h5 className="fw-bold text-slate-900 m-0 fs-6">
                          Tenant Custom Sections
                        </h5>
                        <span className="badge bg-secondary-subtle text-dark border font-mono-code" style={{ fontSize: '0.72rem' }} data-testid="badge-tenant-org">
                          {tenantOrganization}
                        </span>
                      </div>
                      <div className="text-muted small mt-0.5">
                        Create custom section categories saved for {tenantOrganization}, or add saved sections to this set.
                      </div>
                    </div>
                    {!isCreatingSection && (
                      <div className="d-flex align-items-center gap-2">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1.5"
                          onClick={() => {
                            setIsCreatingSection(true);
                            setCustomSectionError('');
                          }}
                          data-testid="btn-add-custom-section"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add custom section
                        </button>
                        <button
                          type="button"
                          className="d-none"
                          onClick={() => {
                            setIsCreatingSection(true);
                            setCustomSectionError('');
                          }}
                          data-testid="btn-create-custom-section"
                          aria-hidden="true"
                          tabIndex={-1}
                        >
                          Create Section
                        </button>
                      </div>
                    )}
                  </div>

                  {isCreatingSection && (
                    <div className="card-body p-4 border-bottom bg-light-subtle" data-testid="form-create-custom-section">
                      <h6 className="fw-bold text-dark mb-2 fs-7">New Custom Section for {tenantOrganization}</h6>
                      <div className="row g-2 align-items-end">
                        <div className="col-12 col-md-5">
                          <label className="form-label text-secondary small fw-semibold" htmlFor="input-custom-section-name">
                            Section Title <span className="text-danger">*</span>
                          </label>
                          <input
                            id="input-custom-section-name"
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="e.g. Berth Clearance, Environmental Conditions"
                            value={newSectionName}
                            onChange={(e) => {
                              setNewSectionName(e.target.value);
                              if (e.target.value.trim()) setCustomSectionError('');
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
                        <div className="col-12 col-md-5">
                          <label className="form-label text-secondary small fw-semibold" htmlFor="input-custom-section-description">
                            Description (Optional)
                          </label>
                          <input
                            id="input-custom-section-description"
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="e.g. Site-specific mooring requirements and clearance criteria"
                            value={newSectionDesc}
                            onChange={(e) => setNewSectionDesc(e.target.value)}
                            data-testid="input-custom-section-description"
                          />
                        </div>
                        <div className="col-12 col-md-2 d-flex gap-2">
                          <button
                            type="button"
                            className="btn btn-sm btn-primary text-white flex-grow-1"
                            disabled={!newSectionName.trim()}
                            onClick={handleCreateTenantSection}
                            data-testid="btn-save-custom-section"
                          >
                            Save Section
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => {
                              setIsCreatingSection(false);
                              setNewSectionName('');
                              setNewSectionDesc('');
                            }}
                            data-testid="btn-cancel-custom-section"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {availableTenantSections.length > 0 && (
                    <div className="card-body p-3 bg-white d-flex align-items-center justify-content-between flex-wrap gap-3">
                      <div className="d-flex align-items-center gap-2 flex-grow-1" style={{ maxWidth: '420px' }}>
                        <label className="form-label text-secondary small fw-semibold m-0 text-nowrap" htmlFor="select-saved-tenant-section">
                          Saved Sections:
                        </label>
                        <select
                          id="select-saved-tenant-section"
                          className="form-select form-select-sm"
                          value={selectedSavedSectionId}
                          onChange={(e) => setSelectedSavedSectionId(e.target.value)}
                          data-testid="select-saved-tenant-section"
                        >
                          <option value="">Select saved section to add...</option>
                          {availableTenantSections
                            .filter((sec) => !activeCustomSections.some((a) => a.id === sec.id))
                            .map((sec) => (
                              <option key={sec.id} value={sec.id}>
                                {sec.name}
                              </option>
                            ))}
                        </select>
                        <button
                          type="button"
                          className="btn btn-sm btn-primary text-white text-nowrap"
                          disabled={!selectedSavedSectionId}
                          onClick={() => handleAddSavedSection(selectedSavedSectionId)}
                          data-testid="btn-add-saved-section"
                        >
                          Add to Set
                        </button>
                      </div>
                      <div className="small text-secondary font-mono-code" data-testid="count-saved-sections">
                        {availableTenantSections.length} section{availableTenantSections.length === 1 ? '' : 's'} saved for {tenantOrganization}
                      </div>
                    </div>
                  )}
                </div>

                {/* Render each active custom section on this set */}
                {activeCustomSections.filter((sec) => Boolean(sec.name?.trim())).map((sec) => {
                  const slug = sec.id.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                  const rawTitle = sectionTitles[sec.id]?.trim() || sec.name;
                  const currentTitle = getSectionTitle(sec.id, sec.name);
                  const isEditing = editingSectionId === sec.id;
                  const secDocs = specializedDocs.filter((d) => d.sectionId === sec.id);

                  return (
                    <section
                      key={sec.id}
                      className="d-flex flex-column gap-3"
                      aria-labelledby={`requirements-heading-${slug}`}
                      data-testid={`section-custom-${slug}`}
                    >
                      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                        {isEditing ? (
                          <div className="d-flex align-items-center gap-2 flex-grow-1" style={{ maxWidth: '450px' }}>
                            <Layers className="w-5 h-5 text-primary flex-shrink-0" aria-hidden="true" />
                            <input
                              type="text"
                              className="form-control form-control-sm fw-bold fs-6"
                              value={editingSectionDraft}
                              onChange={(e) => setEditingSectionDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleSaveSectionTitle(sec.id, editingSectionDraft);
                                } else if (e.key === 'Escape') {
                                  setEditingSectionId(null);
                                }
                              }}
                              autoFocus
                              aria-label={`Edit ${sec.name} section title`}
                              data-testid={`input-section-title-${slug}`}
                            />
                            <button
                              type="button"
                              className="btn btn-sm btn-primary text-white d-inline-flex align-items-center gap-1 px-2.5 py-1"
                              onClick={() => handleSaveSectionTitle(sec.id, editingSectionDraft)}
                              data-testid={`btn-save-section-title-${slug}`}
                            >
                              <Check className="w-3.5 h-3.5" aria-hidden="true" />
                              <span className="small">Save</span>
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1 px-2.5 py-1"
                              onClick={() => setEditingSectionId(null)}
                              data-testid={`btn-cancel-section-title-${slug}`}
                            >
                              <X className="w-3.5 h-3.5" aria-hidden="true" />
                              <span className="small">Cancel</span>
                            </button>
                          </div>
                        ) : (
                          <div className="d-flex align-items-center gap-2">
                            <h4
                              id={`requirements-heading-${slug}`}
                              className="fw-bold text-slate-900 fs-5 m-0 d-flex align-items-center gap-2"
                            >
                              <Layers className="w-5 h-5 text-primary" aria-hidden="true" />
                              <span data-testid={`section-title-${slug}`}>{currentTitle}</span>
                              {rawTitle !== currentTitle && (
                                <span className="d-none" data-testid={`raw-section-title-${slug}`} aria-hidden="true">{rawTitle}</span>
                              )}
                            </h4>
                            <span className="badge bg-primary-subtle text-primary border border-primary-subtle font-mono-code" style={{ fontSize: '0.675rem' }}>
                              Tenant Section
                            </span>
                            <button
                              type="button"
                              className="btn btn-sm btn-link text-secondary text-decoration-none p-1 d-inline-flex align-items-center"
                              onClick={() => {
                                setEditingSectionId(sec.id);
                                setEditingSectionDraft(currentTitle);
                              }}
                              aria-label={`Edit ${currentTitle} section title`}
                              data-testid={`btn-edit-section-title-${slug}`}
                              title="Edit section title"
                            >
                              <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        )}
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1"
                          onClick={() => handleRemoveCustomSection(sec.id)}
                          data-testid={`btn-remove-custom-section-${slug}`}
                          title="Remove section from set"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span className="small">Remove Section</span>
                        </button>
                      </div>

                      <div className="card border shadow-2xs rounded-3 bg-white">
                        <div className="card-header bg-light border-bottom px-4 py-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
                          <div>
                            <h5 className="fw-bold text-slate-900 m-0 fs-6">
                              Requirements ({secDocs.length})
                            </h5>
                            <div className="text-muted small mt-0.5">
                              {sec.description || `Tenant-defined requirements under ${currentTitle}.`}
                            </div>
                          </div>
                        </div>
                        <div className="card-body p-4 d-flex flex-column gap-2" data-testid={`custom-section-body-${slug}`}>
                          {secDocs.length === 0 ? (
                            <div className="p-3 text-center text-secondary small bg-light rounded-2 border border-dashed">
                              No documents in this section yet. Click below to add documents.
                            </div>
                          ) : (
                            secDocs.map((doc) => {
                              const isRequired = doc.isMandatory;
                              const defaultParties = [appointedProviderOrg || serviceProviderOrg].filter(Boolean);
                              return (
                                <div
                                  key={doc.id}
                                  className="p-2.5 px-3 border rounded-3 bg-white shadow-2xs d-flex flex-column gap-2"
                                  data-testid={`requirement-row-${doc.id}`}
                                >
                                  <div className="d-flex align-items-center justify-content-between gap-3">
                                    <div className="d-flex align-items-center gap-2 flex-grow-1 min-w-0">
                                      <span className="fw-semibold text-dark small text-truncate" data-testid={`requirement-title-${doc.id}`}>
                                        {doc.title}
                                      </span>
                                      <span className="badge bg-secondary-subtle text-dark border font-mono-code" style={{ fontSize: '0.675rem' }}>
                                        Tenant Doc
                                      </span>
                                    </div>
                                    <div className="d-flex align-items-center gap-3 flex-shrink-0">
                                      <div className="form-check form-switch m-0 d-flex align-items-center gap-2">
                                        <input
                                          className="form-check-input cursor-pointer"
                                          type="checkbox"
                                          id={`req-toggle-${doc.id}`}
                                          checked={isRequired}
                                          onChange={() => handleToggleCustomDocRequired(doc.id)}
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
                                        onClick={() => handleRemoveCustomDoc(doc.id)}
                                      >
                                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                                      </button>
                                    </div>
                                  </div>
                                  {renderResponsiblePartyChecklist(doc.id, defaultParties, doc.title)}
                                </div>
                              );
                            })
                          )}

                          <div className="pt-2 border-top d-flex align-items-center justify-content-between">
                            <button
                              type="button"
                              className="btn btn-sm btn-link text-primary text-decoration-none p-0 d-inline-flex align-items-center gap-1 font-sans"
                              style={{ fontSize: '0.78rem' }}
                              data-testid={`btn-add-doc-to-section-${slug}`}
                              onClick={() => handleAddDocToCustomSection(sec.id)}
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Add document to section
                            </button>
                          </div>
                        </div>
                      </div>
                    </section>
                  );
                })}
              </div>
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
                            <strong>Organizations:</strong>{' '}
                            <span className="text-dark fw-semibold">{organizations.join(', ')}</span>
                          </div>
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
                          <div className="text-secondary small mt-1" data-testid="review-client">
                            <strong>Requesting party:</strong> <span className="text-dark fw-semibold">{effectiveRequestingParty}</span>
                          </div>
                          <div className="text-secondary small mt-1" data-testid="review-vendor">
                            <strong>Responding party:</strong> <span className="text-dark fw-semibold">{effectiveRespondingParty}</span>
                          </div>
                          {requestContext && (
                            <div className="text-secondary small mt-1">
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
                          {submitters.map((submitter) => (
                            <div key={submitter.organization} className="text-secondary small">
                              <strong>Submitter:</strong>{' '}
                              {submitter.assignee === PENDING_ASSIGNMENT ? `Pending, ${submitter.organization}` : submitter.assignee}
                            </div>
                          ))}
                          <div className="text-secondary small"><strong>Verifier:</strong> {verificationRequired ? (verifierOrg ? `Pending, ${verifierOrg}` : 'None selected') : 'N/A'}</div>
                          <div className="text-secondary small"><strong>Inspector:</strong> {inspectionRequired ? (inspectorOrg ? `Pending, ${inspectorOrg}` : 'None selected') : 'N/A'}</div>
                          <div className="text-secondary small"><strong>Approver:</strong> {approvalRequired ? (approverOrg ? `Pending, ${approverOrg}` : 'None selected') : 'N/A'}</div>

                          <div className="pt-2 mt-2 border-top">
                            <strong className="text-dark small d-block mb-1">Checks</strong>
                            <div className="d-flex flex-wrap gap-1.5 mb-1">
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
                          {activeCustomSections.map((cSec) => {
                            const secDocCount = specializedDocs.filter((d) => d.sectionId === cSec.id && d.isEnabled).length;
                            const title = getSectionTitle(cSec.id, cSec.name);
                            return (
                              <div key={cSec.id} className="col-12 col-md-6">
                                <div className="p-3 bg-white border rounded-3 shadow-2xs h-100">
                                  <div className="d-flex align-items-center justify-content-between mb-2">
                                    <strong className="text-dark small">{title}</strong>
                                    <span className="badge bg-primary text-white font-mono-code" style={{ fontSize: '0.675rem' }}>
                                      {secDocCount} Docs
                                    </span>
                                  </div>
                                  <div className="text-secondary small">
                                    Custom tenant section ({tenantOrganization})
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          {selectedScopes.map((scope) => {
                            const standardCount = SUBTYPE_STANDARD_DOCS[scope].filter((d) => docToggles[d.id]).length;
                            const customCount = specializedDocs.filter((d) => d.subtype === scope && d.isEnabled).length;
                            const isCrew = scope === 'Crew';
                            return (
                              <div key={scope} className={isCrew ? 'col-12' : 'col-12 col-md-6'}>
                                <div className="p-3 bg-white border rounded-3 shadow-2xs h-100">
                                  <div className="d-flex align-items-center justify-content-between mb-2">
                                    <strong className="text-dark small">{getSectionTitle(scope, `${scope} documents`)}</strong>
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
                                      {selectedCrewGroups.length > 0 && (
                                        <div className="mb-2 d-flex flex-wrap align-items-center gap-1.5" data-testid="review-crew-groups-snapshot">
                                          <span className="text-secondary small fw-medium">Crew Groups:</span>
                                          {selectedCrewGroups.map((g) => (
                                            <span key={g.groupId} className="badge bg-light text-dark border">
                                              {g.groupName} ({g.memberIds.length} members snapshot)
                                            </span>
                                          ))}
                                        </div>
                                      )}
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

                        const activeGenDocs = generalDocs.filter((d) => d.isEnabled);
                        const allNeededDocs: { subtype: AssuranceSubtype; title: string; isCustom: boolean; isMandatory: boolean; responsibleParties: string[] }[] = [];
                        activeSubtypes.forEach((subtype) => {
                          SUBTYPE_STANDARD_DOCS[subtype].forEach((doc) => {
                            if (docToggles[doc.id]) {
                              allNeededDocs.push({
                                subtype,
                                title: doc.title,
                                isCustom: false,
                                isMandatory: docRequired[doc.id] ?? doc.isMandatory,
                                responsibleParties: getRequirementResponsibleParties(doc.id, [appointedProviderOrg || serviceProviderOrg].filter(Boolean)),
                              });
                            }
                          });
                          specializedDocs.filter((d) => d.subtype === subtype && d.isEnabled).forEach((spec) => {
                            allNeededDocs.push({
                              subtype,
                              title: spec.title,
                              isCustom: true,
                              isMandatory: spec.isMandatory,
                              responsibleParties: getRequirementResponsibleParties(spec.id, [appointedProviderOrg || serviceProviderOrg].filter(Boolean)),
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
                                              <div className="d-flex flex-column gap-0.5 min-w-0">
                                                <span className="text-dark fw-medium">{doc.title}</span>
                                                {doc.responsibleParties && doc.responsibleParties.length > 0 && (
                                                  <span className="text-muted font-mono-code" style={{ fontSize: '0.72rem' }} data-testid={`review-doc-parties-${idx}`}>
                                                    Responsible: {doc.responsibleParties.join(', ')}
                                                  </span>
                                                )}
                                              </div>
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
