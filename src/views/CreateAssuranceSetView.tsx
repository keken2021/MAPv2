/* 
  file summary: segmented assurance set creation wizard matching enterprise design standards (similar to VesselModal).
  responsibilities: captures campaign scope (Project vs Subtypes: Vessel, Crew, Activity, Equipment), general information, subtype statutory & operational documents with descriptions, public/organization templates, specialized custom requirements, workflow policies, and role assignments.
  role in system: rendered by App.tsx when currentHashView is 'create-assurance-set'.
*/

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useMapStore } from '../store/useMapStore';
import {
  AssuranceSet,
  AssuranceRequirement,
  AssuranceScopeType,
  AssuranceSubtype,
  ReviewMode,
  ReviewChannel,
  AuthorityValidationMethod,
  AssuranceRequirementCategory,
  ThreePillarsCategory,
} from '../types/assurance';
import { UserProfile } from '../types/user';
import {
  filterCAdminAvailableToCharter,
  filterVesselAdminAvailableToCharter,
  getClientAdminOrganization,
  isChartererMatchingVesselOwner,
} from '../utils/rbacHelpers';
import {
  usersWithRole,
  userHasRole,
  getEligibleVerifiers,
  filterEligibleVerifiersForScope,
  filterEligibleApproversForScope,
  filterCandidatesByReviewMode,
  getAssuranceAssignmentWarnings,
  hasBlockingAssuranceAssignmentConflict,
  getReviewChannelForUser,
} from '../utils/userRoleHelpers';
import { isDuplicateCampaignTitle, generateUniqueAssuranceSetId, generateUniqueRequirementId } from '../utils/validation';
import {
  SUBTYPE_STANDARD_DOCS,
  SUBTYPE_TEMPLATES,
  SUBTYPE_CATEGORIES,
  StandardSubtypeDocument,
  SubtypeTemplate,
  EXISTING_ACTIVITIES,
  getThreePillarsCategory,
  THREE_PILLARS_CONFIG,
} from '../utils/assuranceTemplates';
import {
  autoAttachDocumentsToRequirements,
  findMatchingDocumentForRequirement,
} from '../utils/documentMatchingHelpers';
import { getAssuranceWizardProjectOptions } from '../utils/projectHelpers';
import { calculateAssuranceSetReadiness } from '../utils/readinessHelpers';
import { Plus, ChevronDown, ShieldCheck, FileCheck, ExternalLink, Globe, Building2, Ship, Users, Wrench, Activity, Layers, Sparkles, CheckCircle2, Trash2, Clock, Calendar, FileText, BadgeCheck, AlertCircle } from 'lucide-react';

interface SpecializedDoc {
  id: string;
  subtype: AssuranceSubtype;
  title: string;
  category: AssuranceRequirementCategory;
  description: string;
  isMandatory: boolean;
  isEnabled: boolean;
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
    addAssuranceSet,
    updateAssuranceSet,
    activePersona,
    setCurrentHashView,
    previousHashView,
    createAssuranceForVesselId,
    setCreateAssuranceForVesselId,
    projects,
    returnToProjectId,
    setReturnToProjectId,
    users,
  } = useMapStore();

  const availableProjectOptions = useMemo(
    () => getAssuranceWizardProjectOptions(projects, activePersona, users, assuranceSets),
    [projects, activePersona, users, assuranceSets],
  );

  const isClientAdmin = activePersona === 'C Admin';
  const isVesselAdmin = activePersona === 'Administrator' || activePersona === 'Submitter';
  const clientOrg = getClientAdminOrganization(users);

  const availableVessels = isClientAdmin
    ? filterCAdminAvailableToCharter(vessels, assuranceSets, clientOrg)
    : isVesselAdmin
      ? filterVesselAdminAvailableToCharter(vessels)
      : vessels;

  const defaultCharterer = isClientAdmin ? clientOrg : 'Northwind Marine Pty Ltd';
  const lockedVessel = createAssuranceForVesselId
    ? availableVessels.find((v) => v.id === createAssuranceForVesselId)
    : undefined;
  const initialVesselId = lockedVessel?.id || availableVessels[0]?.id || '';
  const initialVesselName = lockedVessel?.name || availableVessels[0]?.name || 'Vessel';

  /* Wizard Step State */
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [errorMessage, setErrorMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [editingDraftId, setEditingDraftId] = useState<string | undefined>(undefined);

  /* Step 1: Scope & General Information */
  const [title, setTitle] = useState(
    () => `${defaultCharterer} - ${initialVesselName} Charter Vetting`
  );
  const [assuranceType, setAssuranceType] = useState<AssuranceScopeType>('Project');
  const [includedPhysicalAssets, setIncludedPhysicalAssets] = useState<AssuranceSubtype[]>(['Vessel', 'Equipment']);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [vesselId, setVesselId] = useState(initialVesselId);
  const [selectedCrewId, setSelectedCrewId] = useState<string>(() => crew[0]?.id || '');
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>(() => equipment[0]?.id || '');
  const [selectedActivityId, setSelectedActivityId] = useState<string>(() => EXISTING_ACTIVITIES[0]?.id || '');
  const [templatePrivacy, setTemplatePrivacy] = useState<'organization' | 'public'>('organization');
  const [showCancelPrompt, setShowCancelPrompt] = useState<boolean>(false);
  const [isGeneralInfoExpanded, setIsGeneralInfoExpanded] = useState<boolean>(true);
  const [charterer, setCharterer] = useState(defaultCharterer);
  const [startDate, setStartDate] = useState('2026-11-01');
  const [endDate, setEndDate] = useState('2027-11-01');
  const isVesselLocked = Boolean(lockedVessel);

  /* Helper functions for physical assets scope */
  const handleRemovePhysicalAsset = (assetType: AssuranceSubtype) => {
    setIncludedPhysicalAssets((prev) => prev.filter((t) => t !== assetType));
  };

  const handleAddPhysicalAsset = (assetType: AssuranceSubtype) => {
    setIncludedPhysicalAssets((prev) => {
      if (!prev.includes(assetType)) {
        return [...prev, assetType];
      }
      return prev;
    });
  };

  const getActiveSubtypes = useCallback((): AssuranceSubtype[] => {
    if (assuranceType === 'Project') {
      const list: AssuranceSubtype[] = [...includedPhysicalAssets];
      if (!list.includes('Crew')) list.push('Crew');
      if (!list.includes('Activity')) list.push('Activity');
      return list;
    }
    return [assuranceType as AssuranceSubtype];
  }, [assuranceType, includedPhysicalAssets]);

  useEffect(() => {
    if (createAssuranceForVesselId && !lockedVessel) {
      setCreateAssuranceForVesselId(undefined);
    }
  }, [createAssuranceForVesselId, lockedVessel, setCreateAssuranceForVesselId]);

  /* Global template selector from existing assurance sets (optional) */
  const [selectedGlobalTemplateId, setSelectedGlobalTemplateId] = useState<string>(templateSetId || '');
  const [selectedProjectTemplateId, setSelectedProjectTemplateId] = useState<string>('tmpl-pub-imca-unified-project');

  /* Workflow requirements state */
  const [verificationRequired, setVerificationRequired] = useState(true);
  const [inspectionRequired, setInspectionRequired] = useState(true);
  const [approvalRequired, setApprovalRequired] = useState(true);

  /* Review & Verification Channel Governance (MVP 1.5) */
  const [reviewMode, setReviewMode] = useState<ReviewMode>('internal');
  const [validityCheckRequired, setValidityCheckRequired] = useState<boolean>(true);
  const [suitabilityCheckRequired, setSuitabilityCheckRequired] = useState<boolean>(true);
  const [authorityValidationMethod, setAuthorityValidationMethod] = useState<AuthorityValidationMethod>('api');

  const selectedVesselForScope = availableVessels.find((v) => v.id === vesselId) || availableVessels[0];
  const selectedEquipmentForScope = equipment.find((e) => e.id === selectedEquipmentId);
  const selectedCrewForScope = crew.find((c) => c.id === selectedCrewId);
  const selectedActivityForScope = EXISTING_ACTIVITIES.find((a) => a.id === selectedActivityId);

  /* 1.4: Identify the Service Provider / Asset Owner organization */
  const serviceProviderOrg =
    assuranceType === 'Vessel'
      ? (selectedVesselForScope?.registeredOwner || selectedVesselForScope?.ismCompany || 'Northwind Marine Pty Ltd')
      : assuranceType === 'Equipment'
        ? (selectedEquipmentForScope?.owningOrganization || selectedEquipmentForScope?.manufacturer || 'Subsea Equipment Provider')
        : assuranceType === 'Crew'
          ? (selectedCrewForScope?.organization || 'Global Maritime Crewing')
          : assuranceType === 'Activity'
            ? (selectedActivityForScope?.category || 'Deepwater Marine Services')
            : (selectedVesselForScope?.registeredOwner || 'Northwind Marine Pty Ltd');

  const vesselOwnerOrg = serviceProviderOrg;
  const isCharteringOtherServices =
    !isClientAdmin ||
    Boolean(selectedVesselForScope && !isChartererMatchingVesselOwner(clientOrg, selectedVesselForScope));

  /* When scope is not Project (Vessel, Crew, Equipment, Activity), it is an internal deployment/self-assurance by the asset provider */
  const isInternalDeployment = assuranceType !== 'Project' || !isCharteringOtherServices;

  /* Dynamic Stakeholder candidate lists strictly enforcing Review Channel Governance & Segregation of Duties */
  const verifierCandidates = filterCandidatesByReviewMode(users, reviewMode, 'Verifier', {
    clientOrg,
    serviceProviderOrg,
    internalDeployment: isInternalDeployment,
  });
  const approverCandidates = filterCandidatesByReviewMode(users, reviewMode, 'Approver', {
    clientOrg,
    serviceProviderOrg,
    internalDeployment: isInternalDeployment,
  });
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

  const handleScopeChange = (newScope: AssuranceScopeType) => {
    setAssuranceType(newScope);
    setFieldErrors({});

    if (newScope === 'Project') {
      const proj = availableProjectOptions.find((p) => p.id === selectedProjectId) || availableProjectOptions[0];
      setTitle(`${defaultCharterer} - ${proj ? proj.name : 'Offshore Project'} Campaign`);
    } else if (newScope === 'Vessel') {
      const v = availableVessels.find((item) => item.id === vesselId) || availableVessels[0];
      setTitle(`${defaultCharterer} - ${v ? v.name : 'MV Pacific Endeavour'} Vetting`);
    } else if (newScope === 'Crew') {
      const c = crew.find((item) => item.id === selectedCrewId) || crew[0];
      setTitle(`${defaultCharterer} - ${c ? c.fullName : 'Capt. Alexander Wright'} Vetting`);
    } else if (newScope === 'Equipment') {
      const e = equipment.find((item) => item.id === selectedEquipmentId) || equipment[0];
      setTitle(`${defaultCharterer} - ${e ? e.name : '150T Traction Winch'} Vetting`);
    } else if (newScope === 'Activity') {
      const a = EXISTING_ACTIVITIES.find((item) => item.id === selectedActivityId) || EXISTING_ACTIVITIES[0];
      setTitle(`${defaultCharterer} - ${a ? a.name : 'Operational Procedure'} Vetting`);
    }
  };

  const handleReviewModeChange = (newMode: ReviewMode) => {
    setReviewMode(newMode);

    const newVerifiers = filterCandidatesByReviewMode(users, newMode, 'Verifier', {
      clientOrg,
      serviceProviderOrg,
      internalDeployment: isInternalDeployment,
    });
    const newApprovers = filterCandidatesByReviewMode(users, newMode, 'Approver', {
      clientOrg,
      serviceProviderOrg,
      internalDeployment: isInternalDeployment,
    });

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

  /* Calculate active wizard steps depending on selected assuranceType */
  const getWizardSteps = (): Array<{ id: string; label: string; pillar?: ThreePillarsCategory; subtype?: AssuranceSubtype }> => {
    if (assuranceType === 'Project') {
      return [
        { id: 'step-scope', label: 'Identification & Scope' },
        { id: 'step-plant', label: 'Plant', pillar: 'Plant' },
        { id: 'step-people', label: 'People', pillar: 'People', subtype: 'Crew' },
        { id: 'step-process', label: 'Process', pillar: 'Process', subtype: 'Activity' },
        { id: 'step-review', label: 'Review & Initiate' },
      ];
    } else {
      const pillar = getThreePillarsCategory(assuranceType);
      return [
        { id: 'step-scope', label: 'Identification & Scope' },
        { id: `step-${pillar.toLowerCase()}`, label: 'Documents', pillar, subtype: assuranceType as AssuranceSubtype },
        { id: 'step-review', label: 'Review & Initiate' },
      ];
    }
  };

  const steps = getWizardSteps();
  const totalSteps = steps.length;

  /* Adjust current step if assuranceType change makes current step out of bounds */
  useEffect(() => {
    if (currentStep > totalSteps) {
      setCurrentStep(totalSteps);
    }
  }, [totalSteps, currentStep]);

  /* Handle global existing assurance set template selection */
  const applyGlobalTemplateData = (targetSet: AssuranceSet) => {
    if (!lockedVessel) {
      const templateVesselId = availableVessels.some((v) => v.id === targetSet.vesselId)
        ? targetSet.vesselId
        : availableVessels[0]?.id || '';
      setVesselId(templateVesselId);
    }
    if (targetSet.charterWindowStart) setStartDate(targetSet.charterWindowStart);
    if (targetSet.charterWindowEnd) setEndDate(targetSet.charterWindowEnd);
    setVerificationRequired(targetSet.verificationRequired !== undefined ? targetSet.verificationRequired : Boolean(targetSet.assignedVerifier));
    setInspectionRequired(targetSet.mandatoryInspectionRequired);
    setApprovalRequired(targetSet.formalApprovalRequired !== undefined ? targetSet.formalApprovalRequired : Boolean(targetSet.assignedApprover));

    const templateCharterer = isClientAdmin
      ? clientOrg
      : (targetSet.charterer || targetSet.initiatorOrg || 'Northwind Marine Pty Ltd');
    setCharterer(templateCharterer);

    const targetVesselObj = lockedVessel
      || availableVessels.find((v) => v.id === targetSet.vesselId)
      || availableVessels[0];
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

    if (targetSet.assuranceType) {
      setAssuranceType(targetSet.assuranceType);
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
      const target = assuranceSets.find((s) => s.id === templateSetId);
      if (target) {
        if (target.visibility === 'draft') {
          // Resume draft editing in-place
          setEditingDraftId(target.id);
          setTitle(target.title);
          if (target.assuranceType) setAssuranceType(target.assuranceType);
          if (target.subtypes && Array.isArray(target.subtypes)) {
            const physicals = target.subtypes.filter((s) => s === 'Vessel' || s === 'Equipment') as AssuranceSubtype[];
            if (physicals.length > 0) {
              setIncludedPhysicalAssets(physicals);
            }
          }
          if (target.projectId) setSelectedProjectId(target.projectId);
          if (target.crewId) setSelectedCrewId(target.crewId);
          if (target.equipmentId) setSelectedEquipmentId(target.equipmentId);
          if (target.activityId) setSelectedActivityId(target.activityId);
          if (target.templateSource === 'public' || target.visibility === 'draft') {
            setTemplatePrivacy('public');
          } else {
            setTemplatePrivacy('organization');
          }
          if (target.vesselId) {
            setVesselId(
              availableVessels.some((v) => v.id === target.vesselId)
                ? target.vesselId
                : availableVessels[0]?.id || '',
            );
          }
          if (target.charterer) setCharterer(target.charterer);
          if (target.charterWindowStart) setStartDate(target.charterWindowStart);
          if (target.charterWindowEnd) setEndDate(target.charterWindowEnd);
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
  const handleSelectSubtypeTemplate = (subtype: AssuranceSubtype, templateId: string) => {
    setSelectedSubtypeTemplates((prev) => ({ ...prev, [subtype]: templateId }));

    if (!templateId) return;

    const tmpl = SUBTYPE_TEMPLATES.find((t) => t.id === templateId);
    if (!tmpl) return;

    setDocToggles((prev) => {
      const updated = { ...prev };
      SUBTYPE_STANDARD_DOCS[subtype].forEach((d) => {
        updated[d.id] = tmpl.recommendedDocIds.includes(d.id);
      });
      return updated;
    });

    triggerAutofillAnimation([`subtype-docs-container-${subtype}`]);
  };

  /* Handle Full Project Scope Template Selection (Spanning all 4 Sub-Assets) */
  const handleSelectProjectTemplate = (templateId: string) => {
    setSelectedProjectTemplateId(templateId);

    if (!templateId) return;

    const tmpl = SUBTYPE_TEMPLATES.find((t) => t.id === templateId && t.subtype === 'All');
    if (!tmpl) return;

    setSelectedSubtypeTemplates({
      Vessel: templateId,
      Crew: templateId,
      Activity: templateId,
      Equipment: templateId,
    });

    setDocToggles((prev) => {
      const updated = { ...prev };
      Object.values(SUBTYPE_STANDARD_DOCS).forEach((list) => {
        list.forEach((d) => {
          updated[d.id] = tmpl.recommendedDocIds.includes(d.id);
        });
      });
      return updated;
    });

    triggerAutofillAnimation([
      'grid-campaign-title',
      'project-template-card',
      'subtype-docs-container-Vessel',
      'subtype-docs-container-Crew',
      'subtype-docs-container-Activity',
      'subtype-docs-container-Equipment',
    ]);
  };

  /* Handle Project Selection for project-level assurance campaign */
  const handleProjectChange = (projId: string) => {
    setSelectedProjectId(projId);
    setFieldErrors((prev) => {
      const u = { ...prev };
      delete u.projectId;
      return u;
    });

    const proj = availableProjectOptions.find((p) => p.id === projId);
    const storeProject = projects.find((p) => p.id === projId);
    if (proj) {
      if (proj.defaultTemplateId) {
        handleSelectProjectTemplate(proj.defaultTemplateId);
      }
      if (storeProject?.charterWindowStart) {
        setStartDate(storeProject.charterWindowStart);
      }
      if (storeProject?.charterWindowEnd) {
        setEndDate(storeProject.charterWindowEnd);
      }
      const chartererName = isClientAdmin
        ? clientOrg
        : (storeProject?.charterer || storeProject?.clientOperator || proj.clientOperator);
      setCharterer(chartererName);
      setTitle(`${chartererName} - ${proj.name} Integrated Assurance Campaign`);
      triggerAutofillAnimation([
        'grid-campaign-title',
        'grid-target-asset-project',
      ]);
    }
  };

  useEffect(() => {
    if (availableProjectOptions.length === 0) return;

    const nextProjectId =
      returnToProjectId && availableProjectOptions.some((p) => p.id === returnToProjectId)
        ? returnToProjectId
        : selectedProjectId && availableProjectOptions.some((p) => p.id === selectedProjectId)
          ? selectedProjectId
          : availableProjectOptions[0].id;

    if (returnToProjectId) {
      setReturnToProjectId(undefined);
    }

    if (nextProjectId && nextProjectId !== selectedProjectId) {
      handleProjectChange(nextProjectId);
    }
  }, [availableProjectOptions, returnToProjectId, selectedProjectId, setReturnToProjectId]);

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
      description: input.description.trim() || `Specialized project requirement for ${subtype} assurance.`,
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

  /* Validation per Step with Field-Specific Mapping */
  const validateCurrentStep = (): boolean => {
    setErrorMessage('');
    const newErrors: Record<string, string> = {};

    if (currentStep === 1) {
      if (!title.trim()) {
        newErrors.title = 'Assurance set campaign title is mandatory.';
      } else {
        const duplicateCheck = isDuplicateCampaignTitle(title, assuranceSets, editingDraftId);
        if (duplicateCheck.isDuplicate) {
          newErrors.title = duplicateCheck.reason || 'Campaign title already exists. Choose a unique name.';
        }
      }

      if (assuranceType === 'Project' && !selectedProjectId) {
        newErrors.projectId = 'Target Project selection is required.';
      } else if (assuranceType === 'Vessel' && !vesselId) {
        newErrors.vesselId = 'Vessel selection is required.';
      } else if (assuranceType === 'Crew' && !selectedCrewId) {
        newErrors.crewId = 'Seafarer selection is required.';
      } else if (assuranceType === 'Equipment' && !selectedEquipmentId) {
        newErrors.equipmentId = 'Equipment selection is required.';
      } else if (assuranceType === 'Activity' && !selectedActivityId) {
        newErrors.activityId = 'Operational procedure selection is required.';
      }
      if (!startDate) {
        newErrors.startDate = 'Charter on-hire start date is required.';
      }
      if (!endDate) {
        newErrors.endDate = 'Charter Charter End is required.';
      }
      if (startDate && endDate && startDate > endDate) {
        newErrors.endDate = 'Charter redelivery date cannot be prior to on-hire start date.';
      }

      /* Verifier, Inspector & Approver Role Validations (MVP 1:1 Mapping) */
      if (verificationRequired && reviewMode !== 'issuing_authority' && !assignedVerifier) {
        newErrors.verifier = 'Verifier assignment is required.';
      }
      if (inspectionRequired && !assignedInspector) {
        newErrors.inspector = 'Visual inspector assignment is required.';
      }
      if (approvalRequired && !assignedApprover) {
        newErrors.approver = 'Campaign approver assignment is required.';
      }

      if (
        hasBlockingAssuranceAssignmentConflict({
          verifierId: verificationRequired && reviewMode !== 'issuing_authority' ? assignedVerifier : undefined,
          approverId: approvalRequired ? assignedApprover : undefined,
          vesselOwnerOrg: serviceProviderOrg,
          serviceProviderOrg,
          isCharteringOtherServices: !isInternalDeployment,
          isClientAdmin,
          users,
          internalDeployment: isInternalDeployment,
        })
      ) {
        const verifierUser = users.find((u) => u.id === assignedVerifier);
        const approverUser = users.find((u) => u.id === assignedApprover);
        if (verifierUser && serviceProviderOrg && verifierUser.organization?.toLowerCase().includes(serviceProviderOrg.toLowerCase())) {
          newErrors.verifier = `Service provider conflict: Staff from ${serviceProviderOrg} cannot verify their own documents.`;
        }
        if (approverUser && serviceProviderOrg && approverUser.organization?.toLowerCase().includes(serviceProviderOrg.toLowerCase())) {
          newErrors.approver = `Service provider conflict: Staff from ${serviceProviderOrg} cannot approve their own documents.`;
        }
      }
    }

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

  const selectedProject =
    availableProjectOptions.find((p) => p.id === selectedProjectId) || availableProjectOptions[0];
  const selectedVessel = availableVessels.find((v) => v.id === vesselId) || availableVessels[0];
  const selectedCrew = crew.find((c) => c.id === selectedCrewId) || crew[0];
  const selectedEquipment = equipment.find((e) => e.id === selectedEquipmentId) || equipment[0];
  const selectedActivity = EXISTING_ACTIVITIES.find((a) => a.id === selectedActivityId) || EXISTING_ACTIVITIES[0];

  const selectedVerifier = users.find((u: UserProfile) => u.id === assignedVerifier);
  const selectedInspector = users.find((u: UserProfile) => u.id === assignedInspector);
  const selectedApprover = users.find((u: UserProfile) => u.id === assignedApprover);

  const assignmentWarnings = getAssuranceAssignmentWarnings({
    verifierId: verificationRequired && reviewMode !== 'issuing_authority' ? assignedVerifier : undefined,
    approverId: approvalRequired ? assignedApprover : undefined,
    subtypeStakeholders: assuranceType === 'Project' ? assignedSubtypeStakeholders : undefined,
    vesselOwnerOrg: serviceProviderOrg,
    serviceProviderOrg,
    isCharteringOtherServices: !isInternalDeployment,
    isClientAdmin,
    users,
    internalDeployment: isInternalDeployment,
  });

  /* Submit and create assurance set */
  const handleSubmit = (e?: React.SyntheticEvent) => {
    e?.preventDefault();
    setHasAttemptedSubmit(true);

    if (!validateCurrentStep()) {
      setCurrentStep(1);
      return;
    }

    const uniqueSetId = generateUniqueAssuranceSetId(assuranceSets);

    /* Determine which subtypes are active */
    const activeSubtypes: AssuranceSubtype[] = getActiveSubtypes();

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
      const reqAssignedSubmitter = 'Designated by Chartered Asset Owner';

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
          subtype: spec.subtype,
          isMandatory: spec.isMandatory,
          isSpecialized: true,
          isFulfilled: false,
          ocrConfidence: 0,
          verifierStatus: 'Pending',
          assignedSubmitter: reqAssignedSubmitter,
          assignedVerifier: reqAssignedVerifier,
          verifierId: verificationRequired ? assignedVerifier : undefined,
        });
      });
    });

    const ownerOrg = charterer.trim() || (isClientAdmin ? clientOrg : defaultCharterer);
    const effectiveCharterer = ownerOrg;
    const initiatorOrg = ownerOrg;

    const effectiveRequirements = assuranceType === 'Project'
      ? finalRequirements
      : autoAttachDocumentsToRequirements(finalRequirements, {
        documents,
        vessel: selectedVesselForScope,
        vessels,
        crew,
        selectedCrewId,
        equipment,
        selectedEquipmentId,
        selectedVesselId: vesselId,
        selectedActivityId,
        targetSubtype: assuranceType as AssuranceSubtype,
      });

    const effectiveAssetName =
      assuranceType === 'Project' ? (selectedProject?.name || 'Project Scope') :
        assuranceType === 'Vessel' ? (selectedVessel?.name || 'Vessel Asset') :
          assuranceType === 'Crew' ? (selectedCrew?.fullName || 'Crew Asset') :
            assuranceType === 'Equipment' ? (selectedEquipment?.name || 'Equipment Asset') :
              (selectedActivity?.name || 'Activity Asset');

    const effectiveImo =
      assuranceType === 'Vessel' ? (selectedVessel?.imoNumber || '9123456') : 'N/A';

    const effectiveSubtypeStakeholders: Record<string, any> = {};
    activeSubtypes.forEach((st) => {
      effectiveSubtypeStakeholders[st] = {
        assignedSubmitter: 'Designated by Chartered Asset Owner',
        submitterName: 'Designated by Chartered Asset Owner',
        verifierId: verificationRequired ? assignedVerifier : undefined,
        verifierName: selectedVerifier?.name,
        verifierOrg: selectedVerifier?.organization,
        assignedVerifier: reqAssignedVerifier,
      };
    });

    const newSet: AssuranceSet = {
      id: '',
      title: title.trim(),
      assuranceType,
      projectId: assuranceType === 'Project' ? (selectedProjectId || undefined) : undefined,
      projectName: assuranceType === 'Project' ? (selectedProject?.name || selectedProjectId || undefined) : undefined,
      crewId: assuranceType === 'Crew' ? (selectedCrew?.id || selectedCrewId) : undefined,
      crewName: assuranceType === 'Crew' ? (selectedCrew?.fullName || 'Crew Asset') : undefined,
      equipmentId: assuranceType === 'Equipment' ? (selectedEquipment?.id || selectedEquipmentId) : undefined,
      equipmentName: assuranceType === 'Equipment' ? (selectedEquipment?.name || 'Equipment Asset') : undefined,
      activityId: assuranceType === 'Activity' ? (selectedActivity?.id || selectedActivityId) : undefined,
      activityName: assuranceType === 'Activity' ? (selectedActivity?.name || 'Activity Asset') : undefined,
      subtypes: activeSubtypes,
      subtypeStakeholders: effectiveSubtypeStakeholders as any,
      visibility: templatePrivacy,
      templateSource: templatePrivacy,
      appliedTemplates: selectedSubtypeTemplates,
      vesselId: assuranceType === 'Vessel' ? (selectedVessel?.id || vesselId) : (assuranceType === 'Crew' ? (selectedCrew?.currentVesselId || '') : (assuranceType === 'Equipment' ? (selectedEquipment?.parentVesselId || '') : '')),
      vesselName: effectiveAssetName,
      imoNumber: effectiveImo,
      initiatorOrg,
      initiatorRole: isClientAdmin ? 'C Admin · Client Created' : 'Vessel Provider Admin',
      charterer: effectiveCharterer,
      charterWindowStart: startDate,
      charterWindowEnd: endDate,
      stage: 'Initiated',
      readinessScore: 10,
      verificationRequired,
      mandatoryInspectionRequired: inspectionRequired,
      formalApprovalRequired: approvalRequired,
      inspectionCompleted: false,
      assignedSubmitter: 'Designated by Chartered Asset Owner',
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
      serviceProviderOrg,
      clientOrg: ownerOrg,
      requirements: effectiveRequirements,
      stakeholders: undefined,
      assignedStakeholders: undefined,
      createdByPersona: isClientAdmin ? 'C Admin' : 'Administrator',
      clientWorkflowStage: isClientAdmin ? 'draft' : undefined,
      internalDeployment: isInternalDeployment,
    };

    newSet.readinessScore = calculateAssuranceSetReadiness(newSet);

    if (editingDraftId) {
      updateAssuranceSet(newSet);
    } else {
      addAssuranceSet(newSet);
    }

    if (createAssuranceForVesselId) {
      const returnVesselId = createAssuranceForVesselId;
      setCreateAssuranceForVesselId(undefined);
      setCurrentHashView('vessels', returnVesselId);
      return;
    }

    setCurrentHashView('assurance-sets', newSet.id);
  };

  /* Save current configuration as Draft */
  const handleSaveDraft = () => {
    const targetSetId = editingDraftId || generateUniqueAssuranceSetId(assuranceSets);
    const activeSubtypes: AssuranceSubtype[] = getActiveSubtypes();

    const finalRequirements: AssuranceRequirement[] = [];
    let reqIndex = 0;

    const reqAssignedVerifier = verificationRequired
      ? selectedVerifier
        ? `${selectedVerifier.name} (${selectedVerifier.organization})`
        : 'Pending Admin Assignment'
      : undefined;

    activeSubtypes.forEach((subtype) => {
      const reqAssignedSubmitter = 'Designated by Chartered Asset Owner';

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
          subtype: spec.subtype,
          isMandatory: spec.isMandatory,
          isSpecialized: true,
          isFulfilled: false,
          ocrConfidence: 0,
          verifierStatus: 'Pending',
          assignedSubmitter: reqAssignedSubmitter,
          assignedVerifier: reqAssignedVerifier,
          verifierId: verificationRequired ? assignedVerifier : undefined,
        });
      });
    });

    const ownerOrg = charterer.trim() || (isClientAdmin ? clientOrg : defaultCharterer);
    const effectiveCharterer = ownerOrg;
    const initiatorOrg = ownerOrg;

    const effectiveRequirements = finalRequirements;

    const effectiveAssetName =
      assuranceType === 'Project'
        ? (selectedProject?.name || 'Project Scope')
        : assuranceType === 'Vessel'
          ? (selectedVessel?.name || 'Vessel Asset')
          : assuranceType === 'Crew'
            ? (selectedCrew?.fullName || 'Crew Asset')
            : assuranceType === 'Equipment'
              ? (selectedEquipment?.name || 'Equipment Asset')
              : (selectedActivity?.name || 'Activity Asset');

    const effectiveSubtypeStakeholders: Record<string, any> = {};
    activeSubtypes.forEach((st) => {
      effectiveSubtypeStakeholders[st] = {
        assignedSubmitter: 'Designated by Chartered Asset Owner',
        submitterName: 'Designated by Chartered Asset Owner',
        verifierId: verificationRequired ? assignedVerifier : undefined,
        verifierName: selectedVerifier?.name,
        verifierOrg: selectedVerifier?.organization,
        assignedVerifier: reqAssignedVerifier,
      };
    });

    const draftSet: AssuranceSet = {
      id: targetSetId,
      title: title.trim() || `${defaultCharterer} - Draft Campaign`,
      assuranceType,
      projectId: assuranceType === 'Project' ? (selectedProjectId || undefined) : undefined,
      projectName: assuranceType === 'Project' ? (selectedProject?.name || selectedProjectId || undefined) : undefined,
      crewId: assuranceType === 'Crew' ? (selectedCrew?.id || selectedCrewId) : undefined,
      crewName: assuranceType === 'Crew' ? (selectedCrew?.fullName || 'Crew Asset') : undefined,
      equipmentId: assuranceType === 'Equipment' ? (selectedEquipment?.id || selectedEquipmentId) : undefined,
      equipmentName: assuranceType === 'Equipment' ? (selectedEquipment?.name || 'Equipment Asset') : undefined,
      activityId: assuranceType === 'Activity' ? (selectedActivity?.id || selectedActivityId) : undefined,
      activityName: assuranceType === 'Activity' ? (selectedActivity?.name || 'Activity Asset') : undefined,
      subtypes: activeSubtypes,
      subtypeStakeholders: effectiveSubtypeStakeholders as any,
      visibility: 'draft',
      templateSource: templatePrivacy,
      appliedTemplates: selectedSubtypeTemplates,
      vesselId: assuranceType === 'Vessel' ? (selectedVessel?.id || vesselId) : (assuranceType === 'Crew' ? (selectedCrew?.currentVesselId || '') : (assuranceType === 'Equipment' ? (selectedEquipment?.parentVesselId || '') : '')),
      vesselName: effectiveAssetName,
      imoNumber: assuranceType === 'Vessel' ? (selectedVessel?.imoNumber || '9123456') : 'N/A',
      initiatorOrg,
      initiatorRole: isClientAdmin ? 'C Admin · Client Created' : 'Vessel Provider Admin',
      charterer: effectiveCharterer,
      charterWindowStart: startDate || '2026-11-01',
      charterWindowEnd: endDate || '2027-11-01',
      stage: 'Initiated',
      readinessScore: 0,
      verificationRequired,
      mandatoryInspectionRequired: inspectionRequired,
      formalApprovalRequired: approvalRequired,
      inspectionCompleted: false,
      assignedSubmitter: 'Designated by Chartered Asset Owner',
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
      serviceProviderOrg,
      clientOrg: ownerOrg,
      requirements: effectiveRequirements,
      stakeholders: undefined,
      assignedStakeholders: undefined,
      createdByPersona: isClientAdmin ? 'C Admin' : 'Administrator',
      clientWorkflowStage: isClientAdmin ? 'draft' : undefined,
      internalDeployment: isInternalDeployment,
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
    setCurrentHashView(isClientAdmin || previousHashView === 'dashboard' ? 'dashboard' : 'assurance-sets');
  };

  /* Render reusable Subtype Document Section */
  const renderSubtypeSection = (subtype: AssuranceSubtype, isProjectScope: boolean = true) => {
    const standardDocs = SUBTYPE_STANDARD_DOCS[subtype] || [];
    const publicTemplates = SUBTYPE_TEMPLATES.filter((t) => (t.subtype === subtype || t.subtype === 'All') && t.source === 'public');
    const orgTemplates = SUBTYPE_TEMPLATES.filter((t) => (t.subtype === subtype || t.subtype === 'All') && t.source === 'organization');
    const activeTemplateId = selectedSubtypeTemplates[subtype] || '';
    const specializedList = specializedDocs.filter((d: { subtype: string; }) => d.subtype === subtype);
    const specInput = specializedInputs[subtype];
    /* Section label: for standalone (non-project) scopes use neutral 'Documents' label */
    const sectionLabel = isProjectScope ? subtype : 'Documents';

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
                Apply a public standard or organizational baseline to automatically configure required {isProjectScope ? subtype.toLowerCase() : ''} documents.
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
                  Public Industry Standard Templates
                </label>
                <select
                  className="form-select bg-white text-dark border-secondary-subtle"
                  value={publicTemplates.some((t) => t.id === activeTemplateId) ? activeTemplateId : ''}
                  onChange={(e) => handleSelectSubtypeTemplate(subtype, e.target.value)}
                >
                  <option value="">-- Choose from Public {subtype} Standards --</option>
                  {publicTemplates.map((tmpl) => (
                    <option key={tmpl.id} value={tmpl.id}>
                      {tmpl.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-12 col-md-6">
                <label className="form-label text-secondary small fw-semibold">
                  Within Organization Templates
                </label>
                <select
                  className="form-select bg-white text-dark border-secondary-subtle"
                  value={orgTemplates.some((t) => t.id === activeTemplateId) ? activeTemplateId : ''}
                  onChange={(e) => handleSelectSubtypeTemplate(subtype, e.target.value)}
                >
                  <option value="">-- Choose from Organization Templates --</option>
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
              Required {isProjectScope ? `${subtype} ` : ''}Documents &amp; Information
            </h5>
            <p className="text-muted small m-0 mt-1">
              Toggle mandatory and statutory compliance requirements for this {isProjectScope ? `${subtype.toLowerCase()} ` : ''}section. All documents include verified descriptions.
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
                            <span className="badge bg-secondary-subtle text-dark border font-mono-code" style={{ fontSize: '0.675rem' }}>
                              {doc.category}
                            </span>
                            {doc.isMandatory && (
                              <span className="badge bg-danger-subtle text-danger border border-danger-subtle font-mono-code" style={{ fontSize: '0.65rem' }}>
                                Statutory Mandatory
                              </span>
                            )}
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
                Add Specialized {isProjectScope ? `${subtype} ` : ''}Document <span className="text-secondary fw-normal fs-7">(Optional)</span>
              </h5>
              <p className="text-muted small m-0 mt-1">
                Optional: Specify any custom or project-specific document requirements needed for this campaign.
              </p>
            </div>
            <span className="badge bg-secondary-subtle text-secondary border font-mono-code" style={{ fontSize: '0.7rem' }}>
              Optional Requirement
            </span>
          </div>
          <div className="card-body p-4">
            <div className="row g-3">
              <div className="col-12 col-md-8">
                <label className="form-label text-secondary small fw-semibold">
                  Specialized Document Title <span className="text-muted fw-normal">(Optional unless adding)</span>
                </label>
                <input
                  type="text"
                  className={`form-control bg-white text-dark border-secondary-subtle${fieldErrors[`specialized_${subtype}`] ? ' is-invalid border-danger' : ''}`}
                  placeholder={`e.g. Specialized ${subtype} Operational Verification Report`}
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
                  placeholder={`Provide detailed maritime/operational context explaining why this specialized ${subtype.toLowerCase()} document is required...`}
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
                    Mandatory for Campaign Approval
                  </label>
                </div>

                <button
                  type="button"
                  className="btn btn-sm btn-primary text-white fw-semibold d-inline-flex align-items-center gap-1.5"
                  onClick={() => handleAddSpecializedDoc(subtype)}
                >
                  Add Specialized Document
                </button>
              </div>
            </div>

            {/* List of Added Specialized Documents for this subtype */}
            {specializedList.length > 0 && (
              <div className="mt-4 border-top pt-3">
                <h6 className="fw-bold text-dark small mb-2">
                  Added Specialized {isProjectScope ? `${subtype} ` : ''}Requirements ({specializedList.length})
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
                            <span className="badge bg-info-subtle text-info-emphasis border border-info-subtle font-mono-code" style={{ fontSize: '0.65rem' }}>
                              {spec.category}
                            </span>
                            <span className="badge bg-primary-subtle text-primary border border-primary-subtle font-mono-code" style={{ fontSize: '0.65rem' }}>
                              Specialized
                            </span>
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
                        title="Remove specialized requirement"
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
    <div className="container-fluid px-4 py-4" style={{ maxWidth: '1280px' }}>
      {/* Top Breadcrumb & Title */}
      <div className="d-flex flex-wrap align-items-center justify-between gap-3 mb-3">
        <div>
          <h2 className="fw-bold text-slate-900 m-0 fs-3">Initiate Marine Assurance Set</h2>
          <p className="text-muted small m-0 mt-1">
            Segmented assurance wizard configured across asset scopes, operational subtypes, specialized required documents, and role assignments.
          </p>
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
                        Assurance Set Name / Campaign Title <span className="text-danger">*</span>
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
                        Assurance Scope <span className="text-danger">*</span>
                      </label>
                      <select
                        id="grid-assurance-type"
                        className="form-select bg-white text-dark border-secondary-subtle fw-semibold"
                        value={assuranceType}
                        onChange={(e) => handleScopeChange(e.target.value as AssuranceScopeType)}
                      >
                        <option value="Project">Project</option>
                        <option value="Vessel">Vessel</option>
                        <option value="Crew">Crew</option>
                        <option value="Activity">Activity</option>
                        <option value="Equipment">Equipment</option>
                      </select>
                    </div>

                  </div>
                </div>
              </div>

              {/* Scope Specification & Asset Nomination Policy Card */}
              <div className="card border shadow-2xs rounded-3 bg-white">
                <div className="card-header bg-light border-bottom px-4 py-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
                  <div>
                    <h5 className="fw-bold text-slate-900 m-0 fs-6">
                      {assuranceType === 'Project' ? '2. Target Project Scope' : `2. Target Asset Selection (${assuranceType})`}
                    </h5>
                    <div className="text-muted small">
                      {assuranceType === 'Project'
                        ? 'Select the offshore project and configure physical asset sections for this multi-subtype campaign.'
                        : `Select the specific ${assuranceType.toLowerCase()} to perform direct self-assurance and compliance passport verification.`}
                    </div>
                  </div>
                </div>
                <div className="card-body p-4">
                  {assuranceType === 'Project' && (
                    <div className="d-flex flex-column gap-4">
                      {/* Project Scope Unified Template Selector Banner */}
                      <div className="p-3 bg-light border border-secondary-subtle rounded-3" id="project-template-card">
                        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                          <div className="d-flex align-items-center gap-2">
                            <Layers className="w-4 h-4 text-primary" />
                            <span className="fw-bold text-dark small">Project Assurance Template Package</span>
                          </div>
                        </div>
                        <div className="text-secondary small mb-3" style={{ fontSize: '0.8rem' }}>
                          Select an industry standard baseline or client project specification. Applying a project template pre-configures statutory, crew, activity, and equipment requirements across all operational sections.
                        </div>
                        <div className="row g-2">
                          <div className="col-12 col-md-6">
                            <label className="form-label text-secondary small fw-semibold" htmlFor="grid-project-template-public" style={{ fontSize: '0.75rem' }}>
                              Public Industry Project Standards
                            </label>
                            <select
                              id="grid-project-template-public"
                              className="form-select form-select-sm bg-white text-dark border-secondary-subtle fw-semibold"
                              value={SUBTYPE_TEMPLATES.filter((t) => t.subtype === 'All' && t.source === 'public').some((t) => t.id === selectedProjectTemplateId) ? selectedProjectTemplateId : ''}
                              onChange={(e) => handleSelectProjectTemplate(e.target.value)}
                            >
                              <option value="">-- Choose Public Project Standard --</option>
                              {SUBTYPE_TEMPLATES.filter((t) => t.subtype === 'All' && t.source === 'public').map((tmpl) => (
                                <option key={tmpl.id} value={tmpl.id}>
                                  {tmpl.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="col-12 col-md-6">
                            <label className="form-label text-secondary small fw-semibold" htmlFor="grid-project-template-org" style={{ fontSize: '0.75rem' }}>
                              Within Organization Project Packages
                            </label>
                            <select
                              id="grid-project-template-org"
                              className="form-select form-select-sm bg-white text-dark border-secondary-subtle fw-semibold"
                              value={SUBTYPE_TEMPLATES.filter((t) => t.subtype === 'All' && t.source === 'organization').some((t) => t.id === selectedProjectTemplateId) ? selectedProjectTemplateId : ''}
                              onChange={(e) => handleSelectProjectTemplate(e.target.value)}
                            >
                              <option value="">-- Choose Organization Project Standard --</option>
                              {SUBTYPE_TEMPLATES.filter((t) => t.subtype === 'All' && t.source === 'organization').map((tmpl) => (
                                <option key={tmpl.id} value={tmpl.id}>
                                  {tmpl.name} ({tmpl.organizationName || 'Corporate'})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {selectedProjectTemplateId && (
                          <div className="mt-2 p-2 bg-white border border-primary-subtle rounded-2 d-flex align-items-center justify-content-between flex-wrap gap-2">
                            <div className="small text-secondary" style={{ fontSize: '0.78rem' }}>
                              <strong className="text-primary d-block">
                                Applied: {SUBTYPE_TEMPLATES.find((t) => t.id === selectedProjectTemplateId)?.name}
                              </strong>
                              <span>{SUBTYPE_TEMPLATES.find((t) => t.id === selectedProjectTemplateId)?.description}</span>
                            </div>
                            <span className="badge bg-success-subtle text-success border border-success-subtle font-mono-code" style={{ fontSize: '0.65rem' }}>
                              All 4 Subtypes Configured
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Primary Offshore Project Selection */}
                      <div>
                        <label className="form-label text-secondary small fw-semibold" htmlFor="grid-target-asset-project">
                          Target Project Scope <span className="text-danger">*</span>
                        </label>
                        <select
                          id="grid-target-asset-project"
                          className={`form-select bg-white text-dark border-secondary-subtle fw-semibold${fieldErrors.projectId ? ' is-invalid border-danger' : ''}`}
                          value={selectedProjectId}
                          onChange={(e) => handleProjectChange(e.target.value)}
                          required
                        >
                          {availableProjectOptions.length === 0 ? (
                            <option value="">No projects available — create a project first</option>
                          ) : (
                            availableProjectOptions.map((proj) => (
                              <option key={proj.id} value={proj.id}>
                                {proj.id} &mdash; {proj.name} ({proj.clientOperator})
                              </option>
                            ))
                          )}
                        </select>
                        {fieldErrors.projectId && (
                          <div className="invalid-feedback d-block small mt-1 font-mono-code" style={{ fontSize: '0.75rem' }}>
                            {fieldErrors.projectId}
                          </div>
                        )}

                        {selectedProject && (
                          <div className="mt-3 p-3 bg-light border rounded-3 small">
                            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                              <span className="fw-bold text-dark fs-6">{selectedProject.name}</span>
                            </div>
                            <div className="row g-2 text-secondary" style={{ fontSize: '0.8rem' }}>
                              <div className="col-12 col-md-4">
                                <strong>Client / Operator:</strong> {selectedProject.clientOperator}
                              </div>
                              <div className="col-12 col-md-4">
                                <strong>Basin / Location:</strong> {selectedProject.location}
                              </div>
                              <div className="col-12 col-md-4">
                                <strong>Assurance Coverage:</strong> Multi-Asset (Vessel, Crew, Equipment, Activity)
                              </div>
                              <div className="col-12">
                                <strong>Scope Summary:</strong> {selectedProject.description}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Vessel Scope: Direct Vessel Selection */}
                  {assuranceType === 'Vessel' && (
                    <div className="d-flex flex-column gap-4">
                      <div>
                        <label className="form-label text-secondary small fw-semibold" htmlFor="grid-target-vessel">
                          Select Target Vessel <span className="text-danger">*</span>
                        </label>
                        <select
                          id="grid-target-vessel"
                          className={`form-select bg-white text-dark border-secondary-subtle fw-semibold${fieldErrors.vesselId ? ' is-invalid border-danger' : ''}`}
                          value={vesselId}
                          onChange={(e) => {
                            const newVId = e.target.value;
                            setVesselId(newVId);
                            const v = availableVessels.find((item) => item.id === newVId);
                            if (v) setTitle(`${defaultCharterer} - ${v.name} Vetting`);
                            setFieldErrors((prev) => {
                              const u = { ...prev };
                              delete u.vesselId;
                              return u;
                            });
                          }}
                          disabled={isVesselLocked}
                          required
                        >
                          {availableVessels.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name} (IMO: {v.imoNumber}) &mdash; {v.vesselType} [{v.status}]
                            </option>
                          ))}
                        </select>
                        {fieldErrors.vesselId && (
                          <div className="invalid-feedback d-block small mt-1 font-mono-code" style={{ fontSize: '0.75rem' }}>
                            {fieldErrors.vesselId}
                          </div>
                        )}

                        {selectedVessel && (
                          <div className="mt-3 p-3 bg-light border rounded-3 small">
                            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                              <div className="d-flex align-items-center gap-2">
                                <Ship className="w-4 h-4 text-primary" />
                                <span className="fw-bold text-dark fs-6">{selectedVessel.name}</span>
                              </div>
                              <div className="d-flex align-items-center gap-2">
                                <span className="badge bg-primary text-white font-mono-code">{selectedVessel.id}</span>
                                <span className="badge bg-slate-100 text-slate-800 border font-mono-code">IMO: {selectedVessel.imoNumber}</span>
                                <span className="badge bg-success-subtle text-success border border-success-subtle">{selectedVessel.status}</span>
                              </div>
                            </div>
                            <div className="row g-2 text-secondary" style={{ fontSize: '0.8rem' }}>
                              <div className="col-12 col-md-4">
                                <strong>Vessel Type:</strong> {selectedVessel.vesselType}
                              </div>
                              <div className="col-12 col-md-4">
                                <strong>Class Society:</strong> {selectedVessel.classificationSociety}
                              </div>
                              <div className="col-12 col-md-4">
                                <strong>Flag State:</strong> {selectedVessel.flagState}
                              </div>
                              <div className="col-12 col-md-6">
                                <strong>Registered Owner:</strong> {selectedVessel.registeredOwner}
                              </div>
                              <div className="col-12 col-md-6">
                                <strong>ISM Manager:</strong> {selectedVessel.ismCompany}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="p-3 bg-light-subtle border border-secondary-subtle rounded-3 text-secondary small" style={{ fontSize: '0.8125rem', lineHeight: '1.5' }}>
                        <div className="d-flex align-items-center gap-2 mb-1.5">
                          <Sparkles className="w-4 h-4 text-primary" />
                          <strong className="text-dark">Self-Assurance &amp; Asset Vault Pre-Fulfillment</strong>
                        </div>
                        This assurance set is created directly for <strong>{selectedVessel?.name || 'the selected vessel'}</strong> by the asset provider ({serviceProviderOrg}). Statutory certificates in the vessel vault will be automatically matched and pre-fulfilled.
                      </div>
                    </div>
                  )}

                  {/* Crew Scope: Direct Seafarer Selection */}
                  {assuranceType === 'Crew' && (
                    <div className="d-flex flex-column gap-4">
                      <div>
                        <label className="form-label text-secondary small fw-semibold" htmlFor="grid-target-crew">
                          Select Target Seafarer <span className="text-danger">*</span>
                        </label>
                        <select
                          id="grid-target-crew"
                          className={`form-select bg-white text-dark border-secondary-subtle fw-semibold${fieldErrors.crewId ? ' is-invalid border-danger' : ''}`}
                          value={selectedCrewId}
                          onChange={(e) => {
                            const newCId = e.target.value;
                            setSelectedCrewId(newCId);
                            const c = crew.find((item) => item.id === newCId);
                            if (c) setTitle(`${defaultCharterer} - ${c.fullName} Vetting`);
                            setFieldErrors((prev) => {
                              const u = { ...prev };
                              delete u.crewId;
                              return u;
                            });
                          }}
                          required
                        >
                          {crew.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.fullName} ({c.id}) &mdash; {c.rank} [{c.complianceStatus}]
                            </option>
                          ))}
                        </select>
                        {fieldErrors.crewId && (
                          <div className="invalid-feedback d-block small mt-1 font-mono-code" style={{ fontSize: '0.75rem' }}>
                            {fieldErrors.crewId}
                          </div>
                        )}

                        {selectedCrew && (
                          <div className="mt-3 p-3 bg-light border rounded-3 small">
                            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                              <div className="d-flex align-items-center gap-2">
                                <Users className="w-4 h-4 text-primary" />
                                <span className="fw-bold text-dark fs-6">{selectedCrew.fullName}</span>
                              </div>
                              <div className="d-flex align-items-center gap-2">
                                <span className="badge bg-primary text-white font-mono-code">{selectedCrew.id}</span>
                                <span className="badge bg-info-subtle text-info border border-info-subtle">{selectedCrew.rank}</span>
                                <span className="badge bg-success-subtle text-success border border-success-subtle">{selectedCrew.complianceStatus}</span>
                              </div>
                            </div>
                            <div className="row g-2 text-secondary" style={{ fontSize: '0.8rem' }}>
                              <div className="col-12 col-md-4">
                                <strong>Nationality:</strong> {selectedCrew.nationality}
                              </div>
                              <div className="col-12 col-md-4">
                                <strong>Current Vessel:</strong> {selectedCrew.currentVesselId || 'Unassigned / Standby'}
                              </div>
                              <div className="col-12 col-md-4">
                                <strong>Seaman's Book:</strong> <span className="font-mono-code">{selectedCrew.seamansBookNo}</span>
                              </div>
                              <div className="col-12">
                                <strong>Employer / Organization:</strong> {selectedCrew.organization || 'Global Maritime Crewing'}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="p-3 bg-light-subtle border border-secondary-subtle rounded-3 text-secondary small" style={{ fontSize: '0.8125rem', lineHeight: '1.5' }}>
                        <div className="d-flex align-items-center gap-2 mb-1.5">
                          <Sparkles className="w-4 h-4 text-primary" />
                          <strong className="text-dark">Seafarer STCW Credentials Pre-Fulfillment</strong>
                        </div>
                        This assurance set creates a standing qualification passport for <strong>{selectedCrew?.fullName || 'the selected seafarer'}</strong>. STCW certificates, medical clearances, and endorsements in their record will be automatically attached.
                      </div>
                    </div>
                  )}

                  {/* Equipment Scope: Direct Equipment Selection */}
                  {assuranceType === 'Equipment' && (
                    <div className="d-flex flex-column gap-4">
                      <div>
                        <label className="form-label text-secondary small fw-semibold" htmlFor="grid-target-equipment">
                          Select Target Equipment <span className="text-danger">*</span>
                        </label>
                        <select
                          id="grid-target-equipment"
                          className={`form-select bg-white text-dark border-secondary-subtle fw-semibold${fieldErrors.equipmentId ? ' is-invalid border-danger' : ''}`}
                          value={selectedEquipmentId}
                          onChange={(e) => {
                            const newEId = e.target.value;
                            setSelectedEquipmentId(newEId);
                            const eq = equipment.find((item) => item.id === newEId);
                            if (eq) setTitle(`${defaultCharterer} - ${eq.name} Vetting`);
                            setFieldErrors((prev) => {
                              const u = { ...prev };
                              delete u.equipmentId;
                              return u;
                            });
                          }}
                          required
                        >
                          {equipment.map((eq) => (
                            <option key={eq.id} value={eq.id}>
                              {eq.name} ({eq.equipmentIdentifier}) &mdash; {eq.category} [{eq.availabilityStatus || 'Available'}]
                            </option>
                          ))}
                        </select>
                        {fieldErrors.equipmentId && (
                          <div className="invalid-feedback d-block small mt-1 font-mono-code" style={{ fontSize: '0.75rem' }}>
                            {fieldErrors.equipmentId}
                          </div>
                        )}

                        {selectedEquipment && (
                          <div className="mt-3 p-3 bg-light border rounded-3 small">
                            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                              <div className="d-flex align-items-center gap-2">
                                <Wrench className="w-4 h-4 text-primary" />
                                <span className="fw-bold text-dark fs-6">{selectedEquipment.name}</span>
                              </div>
                              <div className="d-flex align-items-center gap-2">
                                <span className="badge bg-primary text-white font-mono-code">{selectedEquipment.equipmentIdentifier}</span>
                                <span className="badge bg-secondary-subtle text-secondary border">{selectedEquipment.category}</span>
                                <span className="badge bg-success-subtle text-success border border-success-subtle">{selectedEquipment.availabilityStatus || 'Available'}</span>
                              </div>
                            </div>
                            <div className="row g-2 text-secondary" style={{ fontSize: '0.8rem' }}>
                              <div className="col-12 col-md-4">
                                <strong>Manufacturer / Model:</strong> {selectedEquipment.manufacturer || 'OEM'} {selectedEquipment.model || ''}
                              </div>
                              <div className="col-12 col-md-4">
                                <strong>Owning Organization:</strong> {selectedEquipment.owningOrganization}
                              </div>
                              <div className="col-12 col-md-4">
                                <strong>Assigned Location:</strong> {selectedEquipment.parentVesselId ? `Vessel ${selectedEquipment.parentVesselId}` : 'Modular / Standby'}
                              </div>
                              <div className="col-12">
                                <strong>Compliance Score:</strong> {selectedEquipment.complianceReadinessScore}% &bull; <strong>Serial No:</strong> <span className="font-mono-code">{selectedEquipment.serialNumber || 'N/A'}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="p-3 bg-light-subtle border border-secondary-subtle rounded-3 text-secondary small" style={{ fontSize: '0.8125rem', lineHeight: '1.5' }}>
                        <div className="d-flex align-items-center gap-2 mb-1.5">
                          <Sparkles className="w-4 h-4 text-primary" />
                          <strong className="text-dark">Equipment Certification &amp; Load Test Pre-Fulfillment</strong>
                        </div>
                        This assurance set verifies technical readiness for <strong>{selectedEquipment?.name || 'the selected equipment'}</strong>. Load test certificates, class surveys, and maintenance logs in the equipment vault will be automatically matched.
                      </div>
                    </div>
                  )}

                  {/* Activity Scope: Direct Procedure Selection */}
                  {assuranceType === 'Activity' && (
                    <div className="d-flex flex-column gap-4">
                      <div>
                        <label className="form-label text-secondary small fw-semibold" htmlFor="grid-target-activity">
                          Select Operational Procedure / Activity <span className="text-danger">*</span>
                        </label>
                        <select
                          id="grid-target-activity"
                          className={`form-select bg-white text-dark border-secondary-subtle fw-semibold${fieldErrors.activityId ? ' is-invalid border-danger' : ''}`}
                          value={selectedActivityId}
                          onChange={(e) => {
                            const newAId = e.target.value;
                            setSelectedActivityId(newAId);
                            const act = EXISTING_ACTIVITIES.find((item) => item.id === newAId);
                            if (act) setTitle(`${defaultCharterer} - ${act.name} Vetting`);
                            setFieldErrors((prev) => {
                              const u = { ...prev };
                              delete u.activityId;
                              return u;
                            });
                          }}
                          required
                        >
                          {EXISTING_ACTIVITIES.map((act) => (
                            <option key={act.id} value={act.id}>
                              {act.name} &mdash; {act.category}
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
                              <div className="d-flex align-items-center gap-2">
                                <Activity className="w-4 h-4 text-primary" />
                                <span className="fw-bold text-dark fs-6">{selectedActivity.name}</span>
                              </div>
                              <div className="d-flex align-items-center gap-2">
                                <span className="badge bg-primary text-white font-mono-code">{selectedActivity.id}</span>
                                <span className="badge bg-secondary-subtle text-secondary border">{selectedActivity.category}</span>
                              </div>
                            </div>
                            <div className="row g-2 text-secondary" style={{ fontSize: '0.8rem' }}>
                              <div className="col-12 col-md-6">
                                <strong>Operation Category:</strong> {selectedActivity.category}
                              </div>
                              <div className="col-12 col-md-6">
                                <strong>Operational Location:</strong> {selectedActivity.location}
                              </div>
                              <div className="col-12">
                                <strong>Scope Summary:</strong> {selectedActivity.description}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="p-3 bg-light-subtle border border-secondary-subtle rounded-3 text-secondary small" style={{ fontSize: '0.8125rem', lineHeight: '1.5' }}>
                        <div className="d-flex align-items-center gap-2 mb-1.5">
                          <Sparkles className="w-4 h-4 text-primary" />
                          <strong className="text-dark">Operational Procedure &amp; Safety Assurance</strong>
                        </div>
                        This assurance set defines the procedural safety and compliance baseline for <strong>{selectedActivity?.name || 'the selected operation'}</strong> across active marine and subsea projects.
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Template Privacy & Access Scope Card */}
              <div className="card border shadow-2xs rounded-3 bg-white">
                <div className="card-header bg-light border-bottom px-4 py-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
                  <div>
                    <h5 className="fw-bold text-slate-900 m-0 fs-6">
                      3. Template Privacy &amp; Distribution Scope
                    </h5>
                    <div className="text-muted small">
                      Select whether this assurance set and its document specifications can be used as a template by the public or within your organization only.
                    </div>
                  </div>
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
                              <strong className="text-dark small">Organization Wide</strong>
                            </div>
                            <p className="text-secondary small m-0 mt-1" style={{ fontSize: '0.8rem', lineHeight: '1.4' }}>
                              Restricted strictly to your organization. Only verified members of your company can discover, view, or clone this assurance template.
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
                              <strong className="text-dark small">Platform Wide</strong>
                            </div>
                            <p className="text-secondary small m-0 mt-1" style={{ fontSize: '0.8rem', lineHeight: '1.4' }}>
                              Published to the public template library. Other charterers, operators, and surveyors across the platform can adopt this as a standard baseline.
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
                      4. Charter Period &amp; Workflow Governance
                    </h5>
                    <div className="text-muted small">
                      Configure contractual charter hire window, review channel governance, and stakeholder assignments.
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
                      {/* Charter Period Window */}
                      <div className="col-12">
                        <div className="p-3 bg-light rounded-3 border">
                          <div className="d-flex align-items-center justify-content-between mb-2">
                            <strong className="text-dark small d-flex align-items-center gap-1.5">
                              <Clock className="w-4 h-4 text-primary" />
                              Charter Period
                            </strong>
                          </div>
                          <p className="text-secondary small mb-3" style={{ fontSize: '0.78rem', lineHeight: '1.4' }}>
                            Full contractual hire span from on-hire delivery to final off-hire redelivery. Encompasses mobilization, transit, on-hire proving trials (JH2013/DP), weather contingencies, and demobilization.
                          </p>

                          <div className="row g-3">
                            <div className="col-12 col-md-6">
                              <label className="form-label text-secondary small fw-semibold" htmlFor="grid-charter-start" style={{ fontSize: '0.75rem' }}>
                                Charter Start <span className="text-danger">*</span>
                              </label>
                              <input
                                id="grid-charter-start"
                                type="date"
                                className={`form-control form-control-sm bg-white text-dark border-secondary-subtle font-mono-code${fieldErrors.startDate ? ' is-invalid border-danger' : ''}`}
                                value={startDate}
                                onChange={(e) => {
                                  setStartDate(e.target.value);
                                  setFieldErrors((prev) => {
                                    const u = { ...prev };
                                    delete u.startDate;
                                    delete u.endDate;
                                    return u;
                                  });
                                }}
                                required
                              />
                              {fieldErrors.startDate && (
                                <div className="invalid-feedback d-block small mt-1 font-mono-code" style={{ fontSize: '0.72rem' }}>
                                  {fieldErrors.startDate}
                                </div>
                              )}
                            </div>

                            <div className="col-12 col-md-6">
                              <label className="form-label text-secondary small fw-semibold" htmlFor="grid-charter-end" style={{ fontSize: '0.75rem' }}>
                                Charter End <span className="text-danger">*</span>
                              </label>
                              <input
                                id="grid-charter-end"
                                type="date"
                                className={`form-control form-control-sm bg-white text-dark border-secondary-subtle font-mono-code${fieldErrors.endDate ? ' is-invalid border-danger' : ''}`}
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
                                <div className="invalid-feedback d-block small mt-1 font-mono-code" style={{ fontSize: '0.72rem' }}>
                                  {fieldErrors.endDate}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Workflow & Review Policies (MVP 1.5 - Review Channels & Validity/Suitability) */}
                      <div className="col-12">
                        <div className="p-4 bg-light border rounded-3 d-flex flex-column gap-3.5">
                          <div>
                            <strong className="text-dark small d-block mb-1.5" style={{ fontSize: '0.85rem' }}>
                              Review Channel &amp; Authority Governance
                            </strong>
                            <div className="text-muted small" style={{ fontSize: '0.8rem', lineHeight: '1.4' }}>
                              Who reviews is designated by the client. Review can be conducted internally, by an appointed third party, by the issuing authority, or a mixed combination.
                            </div>
                          </div>

                          <div className="row g-3">
                            {[
                              { id: 'internal', label: 'Internal Client Review', desc: 'In-house client assurance & vetting team' },
                              { id: 'third_party', label: 'Appointed Third Party', desc: 'Independent marine warranty surveyors & auditors' },
                              { id: 'issuing_authority', label: 'Issuing Authority / Regulatory', desc: 'Direct statutory validation via AMSA / Flag State' },
                              { id: 'mixed', label: 'Mixed Review (Multi-Channel)', desc: 'Combination of Internal, 3rd-Party & Authority' },
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
                                    Regulatory Authority Validation Gateway
                                  </strong>
                                  <div className="text-secondary small" style={{ fontSize: '0.75rem', lineHeight: '1.35' }}>
                                    Connect digital statutory checks via direct authority API or secure verification link.
                                  </div>
                                </div>
                                <div className="d-flex align-items-center gap-2">
                                  <select
                                    className="form-select form-select-sm bg-white text-dark border-secondary-subtle font-mono-code px-3 py-1.5"
                                    value={authorityValidationMethod}
                                    onChange={(e) => setAuthorityValidationMethod(e.target.value as AuthorityValidationMethod)}
                                    style={{ fontSize: '0.78rem', minWidth: '290px' }}
                                  >
                                    <option value="api">AMSA Digital Validation API Gateway</option>
                                    <option value="direct_link">Flag State Direct Verification Link</option>
                                    <option value="manual">Classification Society Direct Portal</option>
                                  </select>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Grouped Assurance Checks & Workflow Gates */}
                          <div className="p-4 px-4 bg-white border rounded-3 d-flex flex-column gap-3 shadow-2xs">
                            <div>
                              <strong className="text-dark small d-block mb-1" style={{ fontSize: '0.825rem' }}>
                                Separate Assurance Checks &amp; Workflow Gates
                              </strong>
                              <div className="text-muted small" style={{ fontSize: '0.76rem', lineHeight: '1.35' }}>
                                Configure statutory validity vs operational suitability checks alongside mandatory stage workflow gates.
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
                                      Checks document authenticity, expiry dates, and regulatory standing (via AMSA API / Link).
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
                                      Assesses operational fitness for purpose, charter specifications, and scope standards.
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
                                  Verification Required (Verifier Gate)
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
                                  Visual / Vessel Inspection Required
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
                                  Formal Approver Sign-Off Required
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
                                Assigned Assurance Set Stakeholders
                              </strong>
                              <div className="text-muted" style={{ fontSize: '0.78rem' }}>
                                Designate the single Verifier, Inspector, and Approver for this assurance set. Stakeholder lists dynamically adapt to the selected review governance model.
                              </div>
                            </div>
                          </div>

                          <div className="row g-4 pt-1">
                            {verificationRequired && (
                              <div className="col-12 col-md-6 col-lg-4 d-flex flex-column">
                                <div className="d-flex align-items-center justify-content-between mb-2" style={{ minHeight: '22px' }}>
                                  <label className="form-label text-secondary small fw-semibold m-0" htmlFor="assign-ver">
                                    Assurance Set Verifier <span className="text-danger">*</span>
                                  </label>
                                </div>
                                {reviewMode === 'issuing_authority' ? (
                                  <div className="p-2 px-3 bg-light border border-secondary-subtle rounded-2 d-flex align-items-center justify-content-between text-secondary font-mono-code" style={{ minHeight: '34px' }}>
                                    <span className="fw-semibold text-primary small">Handled via Authority API</span>
                                    <span className="badge bg-primary-subtle text-primary border border-primary-subtle font-sans" style={{ fontSize: '0.72rem' }}>
                                      AMSA Gateway
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
                                    Visual Inspector <span className="text-danger">*</span>
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
                                    Formal Campaign Approver <span className="text-danger">*</span>
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

          {/* DYNAMIC PILLAR STEPS (SHALLOW MVP HIERARCHY) */}
          {/* STEP: Plant (Screen for Physical Assets: Vessel & Equipment) */}
          {currentStepData.id === 'step-plant' && (
            <div className="d-flex flex-column gap-4">
              <div className="card border shadow-2xs rounded-3 bg-white">
                <div className="card-header bg-light border-bottom px-4 py-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
                  <div className="d-flex align-items-center gap-2.5">
                    <div className="p-2 bg-primary text-white rounded-2 d-flex align-items-center justify-content-center">
                      <Ship className="w-5 h-5" />
                    </div>
                    <div>
                      <h5 className="fw-bold text-slate-900 m-0 fs-6">
                        {assuranceType === 'Project' ? 'Plant (Physical Assets)' : 'Documents'}
                      </h5>
                      <div className="text-muted small mt-0.5">
                        {assuranceType === 'Project'
                          ? `Statutory and specialized requirements for physical assets (${includedPhysicalAssets.length > 0 ? includedPhysicalAssets.join(', ') : 'None'}) under this campaign.`
                          : `Statutory and specialized requirements for ${assuranceType === 'Vessel' ? 'Vessels' : 'deck equipment and machinery'}.`}
                      </div>
                    </div>
                  </div>

                  {assuranceType === 'Project' && (
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      {!includedPhysicalAssets.includes('Vessel') && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1.5 font-mono-code"
                          style={{ fontSize: '0.75rem' }}
                          onClick={() => handleAddPhysicalAsset('Vessel')}
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Vessels Section
                        </button>
                      )}
                      {!includedPhysicalAssets.includes('Equipment') && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1.5 font-mono-code"
                          style={{ fontSize: '0.75rem' }}
                          onClick={() => handleAddPhysicalAsset('Equipment')}
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Equipments Section
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {assuranceType === 'Project' ? (
                <div className="d-flex flex-column gap-4">
                  {/* Vessels Section */}
                  {includedPhysicalAssets.includes('Vessel') && (
                    <div className="p-3 bg-light-subtle border rounded-3 border-secondary-subtle">
                      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3 pb-2 border-bottom">
                        <div className="d-flex align-items-center gap-2">
                          <Ship className="w-4 h-4 text-primary" />
                          <h5 className="fw-bold text-slate-900 m-0 fs-6">Vessels</h5>
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1.5 font-mono-code"
                          style={{ fontSize: '0.75rem' }}
                          onClick={() => handleRemovePhysicalAsset('Vessel')}
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Remove Section
                        </button>
                      </div>
                      {renderSubtypeSection('Vessel')}
                    </div>
                  )}

                  {/* Equipments Section */}
                  {includedPhysicalAssets.includes('Equipment') && (
                    <div className="p-3 bg-light-subtle border rounded-3 border-secondary-subtle">
                      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3 pb-2 border-bottom">
                        <div className="d-flex align-items-center gap-2">
                          <Wrench className="w-4 h-4 text-primary" />
                          <h5 className="fw-bold text-slate-900 m-0 fs-6">Machinery &amp; Equipments</h5>
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1.5 font-mono-code"
                          style={{ fontSize: '0.75rem' }}
                          onClick={() => handleRemovePhysicalAsset('Equipment')}
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Remove Section
                        </button>
                      </div>
                      {renderSubtypeSection('Equipment')}
                    </div>
                  )}

                  {/* Empty state when no physical assets are included */}
                  {includedPhysicalAssets.length === 0 && (
                    <div className="p-5 text-center bg-white border rounded-3 shadow-2xs">
                      <div className="d-inline-flex p-3 bg-light rounded-circle text-muted mb-3">
                        <Ship className="w-6 h-6" />
                      </div>
                      <h5 className="fw-bold text-slate-900 mb-1">No Physical Asset Types Included</h5>
                      <p className="text-secondary small mb-4" style={{ maxWidth: '420px', margin: '0 auto' }}>
                        All physical asset sections have been removed from this project assurance set. You can add Vessels or Equipments sections at any time.
                      </p>
                      <div className="d-flex align-items-center justify-content-center gap-2 flex-wrap">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1.5 font-mono-code"
                          onClick={() => handleAddPhysicalAsset('Vessel')}
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Vessels Section
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1.5 font-mono-code"
                          onClick={() => handleAddPhysicalAsset('Equipment')}
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Equipments Section
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                renderSubtypeSection((assuranceType === 'Equipment' ? 'Equipment' : 'Vessel') as AssuranceSubtype, false)
              )}
            </div>
          )}

          {/* STEP: People */}
          {currentStepData.id === 'step-people' && (
            <div className="d-flex flex-column gap-4">
              <div className="card border shadow-2xs rounded-3 bg-white">
                <div className="card-header bg-light border-bottom px-4 py-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
                  <div className="d-flex align-items-center gap-2.5">
                    <div className="p-2 bg-primary text-white rounded-2 d-flex align-items-center justify-content-center">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <h5 className="fw-bold text-slate-900 m-0 fs-6">
                        {assuranceType === 'Project' ? 'People' : 'Documents'}
                      </h5>
                      <div className="text-muted small mt-0.5">
                        {assuranceType === 'Project'
                          ? 'Seafarer qualifications, STCW certificates, BOSIET inductions, and medical fitness requirements for project crew personnel.'
                          : `Seafarer qualifications, STCW certificates, BOSIET inductions, and medical fitness for ${selectedCrew?.fullName || 'assigned crew'}.`}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {renderSubtypeSection('Crew', assuranceType === 'Project')}
            </div>
          )}

          {/* STEP: Process */}
          {currentStepData.id === 'step-process' && (
            <div className="d-flex flex-column gap-4">
              <div className="card border shadow-2xs rounded-3 bg-white">
                <div className="card-header bg-light border-bottom px-4 py-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
                  <div className="d-flex align-items-center gap-2.5">
                    <div className="p-2 bg-primary text-white rounded-2 d-flex align-items-center justify-content-center">
                      <Activity className="w-5 h-5" />
                    </div>
                    <div>
                      <h5 className="fw-bold text-slate-900 m-0 fs-6">
                        {assuranceType === 'Project' ? 'Process' : 'Documents'}
                      </h5>
                      <div className="text-muted small mt-0.5">
                        {assuranceType === 'Project'
                          ? 'HSE plans, Method Statements (MOP), HAZID/HAZOP, SIMOPS protocols, and insurances for project operational activities.'
                          : `HSE plans, Method Statements (MOP), HAZID/HAZOP, SIMOPS protocols, and insurances for ${selectedActivity?.name || 'operational scope'}.`}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {renderSubtypeSection('Activity', assuranceType === 'Project')}
            </div>
          )}

          {/* FINAL STEP: Review & Initiate */}
          {
            currentStepData.id === 'step-review' && (
              <div className="d-flex flex-column gap-4">
                <div className="card border shadow-2xs rounded-3 bg-white">
                  <div className="card-header bg-light border-bottom px-4 py-3">
                    <h5 className="fw-bold text-slate-900 m-0 fs-6">
                      Review Assurance Campaign Specifications
                    </h5>
                  </div>
                  <div className="card-body p-4">
                    <div className="row g-4">
                      <div className="col-12 col-md-6">
                        <div className="p-3 bg-light rounded-3 border h-100">
                          <strong className="text-dark small d-block mb-1">Campaign Title &amp; Governance</strong>
                          <div className="fw-bold text-primary fs-6">{title}</div>
                          <div className="text-secondary small mt-2">
                            <strong>Scope:</strong> {assuranceType} Assurance &nbsp;|&nbsp; <strong>Target Project:</strong>{' '}
                            <span className="text-dark fw-semibold">{selectedProject?.name} ({selectedProject?.id})</span>
                          </div>
                          <div className="text-secondary small mt-1">
                            <strong>Client / Operator:</strong> {selectedProject?.clientOperator || charterer}
                          </div>
                          <div className="text-secondary small mt-1">
                            <strong>Charter Period:</strong> {startDate} to {endDate}
                          </div>
                          <div className="text-secondary small mt-1 d-flex align-items-center gap-2">
                            <strong>Template Privacy:</strong>
                            <span className={`badge ${templatePrivacy === 'public' ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-secondary-subtle text-dark border'} font-mono-code`} style={{ fontSize: '0.675rem' }}>
                              {templatePrivacy === 'public' ? 'Public Standard (Shared)' : 'Organization Wide'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="col-12 col-md-6">
                        <div className="p-3 bg-light rounded-3 border h-100">
                          <strong className="text-dark small d-block mb-1">Assigned Assurance Set Stakeholders (1:1 Mapping)</strong>
                          <div className="text-secondary small"><strong>Submitter:</strong> Designated by Asset Service Provider (Assigned in Project)</div>
                          <div className="text-secondary small"><strong>Verifier:</strong> {verificationRequired ? (selectedVerifier ? `${selectedVerifier.name} (${selectedVerifier.organization})` : 'Pending') : 'N/A'}</div>
                          <div className="text-secondary small"><strong>Inspector:</strong> {inspectionRequired ? (selectedInspector ? `${selectedInspector.name} (${selectedInspector.organization})` : 'Pending') : 'N/A'}</div>
                          <div className="text-secondary small"><strong>Approver:</strong> {approvalRequired ? (selectedApprover ? `${selectedApprover.name} (${selectedApprover.organization})` : 'Pending') : 'N/A'}</div>

                          <div className="pt-2 mt-2 border-top">
                            <strong className="text-dark small d-block mb-1">Review Governance &amp; Verification Checks</strong>
                            <div className="d-flex flex-wrap gap-1.5 mb-1">
                              <span className="badge bg-primary-subtle text-primary border border-primary-subtle font-mono-code" style={{ fontSize: '0.675rem' }}>
                                Channel: {reviewMode === 'internal' ? 'Internal Client' : reviewMode === 'third_party' ? 'Appointed 3rd Party' : reviewMode === 'issuing_authority' ? 'Issuing Authority' : 'Mixed Multi-Channel'}
                              </span>
                              {validityCheckRequired && (
                                <span className="badge bg-success-subtle text-success border border-success-subtle font-mono-code" style={{ fontSize: '0.675rem' }}>
                                  Statutory Validity Check (AMSA/Class)
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
                                Authority Gateway: {authorityValidationMethod === 'api' ? 'AMSA Validation API' : authorityValidationMethod === 'direct_link' ? 'Flag State Link' : 'Classification Society Portal'}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Three Pillars Requirements Summary Breakdown (People, Plant, Process) */}
                      <div className="col-12">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                          <strong className="text-dark small d-block">
                            Assurance Campaign Scope Breakdown · People, Plant, Process Framework
                          </strong>
                          <span className="badge bg-secondary text-white font-mono-code" style={{ fontSize: '0.675rem' }}>
                            Flattened MVP Structure
                          </span>
                        </div>

                        <div className="row g-3">
                          {/* Pillar 1: Plant (Physical Assets: Vessel & Equipment Side-by-Side) */}
                          <div className="col-12 col-lg-5">
                            <div className="p-3 bg-white border rounded-3 shadow-2xs h-100">
                              <div className="d-flex align-items-center justify-content-between mb-2">
                                <div className="d-flex align-items-center gap-1.5">
                                  <Ship className="w-4 h-4 text-primary" />
                                  <strong className="text-dark small">Plant (Physical Assets)</strong>
                                </div>
                                <span className="badge bg-dark text-white font-mono-code" style={{ fontSize: '0.675rem' }}>
                                  {(includedPhysicalAssets.includes('Vessel')
                                    ? SUBTYPE_STANDARD_DOCS.Vessel.filter((d) => docToggles[d.id]).length +
                                    specializedDocs.filter((d) => d.subtype === 'Vessel' && d.isEnabled).length
                                    : 0) +
                                    (includedPhysicalAssets.includes('Equipment')
                                      ? SUBTYPE_STANDARD_DOCS.Equipment.filter((d) => docToggles[d.id]).length +
                                      specializedDocs.filter((d) => d.subtype === 'Equipment' && d.isEnabled).length
                                      : 0)} Docs
                                </span>
                              </div>
                              <div className="d-flex flex-column gap-2 text-secondary small" style={{ fontSize: '0.78rem' }}>
                                {includedPhysicalAssets.includes('Vessel') && (
                                  <div className="p-2 bg-light rounded-2">
                                    <div className="fw-semibold text-dark">Section: Vessels</div>
                                    <div>Standard: {SUBTYPE_STANDARD_DOCS.Vessel.filter((d) => docToggles[d.id]).length} · Specialized: {specializedDocs.filter((d) => d.subtype === 'Vessel' && d.isEnabled).length}</div>
                                  </div>
                                )}
                                {includedPhysicalAssets.includes('Equipment') && (
                                  <div className="p-2 bg-light rounded-2">
                                    <div className="fw-semibold text-dark">Section: Machinery &amp; Equipments</div>
                                    <div>Standard: {SUBTYPE_STANDARD_DOCS.Equipment.filter((d) => docToggles[d.id]).length} · Specialized: {specializedDocs.filter((d) => d.subtype === 'Equipment' && d.isEnabled).length}</div>
                                  </div>
                                )}
                                {includedPhysicalAssets.length === 0 && (
                                  <div className="p-2 bg-light rounded-2 text-muted font-mono-code" style={{ fontSize: '0.75rem' }}>
                                    No physical asset types included in this campaign.
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Pillar 2: People (Key Seafarers & Crew) */}
                          <div className="col-12 col-md-6 col-lg-3.5" style={{ flex: '1 1 28%' }}>
                            <div className="p-3 bg-white border rounded-3 shadow-2xs h-100">
                              <div className="d-flex align-items-center justify-content-between mb-2">
                                <div className="d-flex align-items-center gap-1.5">
                                  <Users className="w-4 h-4 text-primary" />
                                  <strong className="text-dark small">People (Seafarers &amp; Crew)</strong>
                                </div>
                                <span className="badge bg-primary text-white font-mono-code" style={{ fontSize: '0.675rem' }}>
                                  {SUBTYPE_STANDARD_DOCS.Crew.filter((d) => docToggles[d.id]).length +
                                    specializedDocs.filter((d) => d.subtype === 'Crew' && d.isEnabled).length} Docs
                                </span>
                              </div>
                              <div className="d-flex flex-column gap-2 text-secondary small" style={{ fontSize: '0.78rem' }}>
                                <div className="p-2 bg-light rounded-2">
                                  <div className="fw-semibold text-dark">Section: Seafarers &amp; Crew Credentials</div>
                                  <div className="text-muted">Master, Chief Engineer &amp; Crew Specifications</div>
                                  <div className="mt-1">Standard: {SUBTYPE_STANDARD_DOCS.Crew.filter((d) => docToggles[d.id]).length} · Specialized: {specializedDocs.filter((d) => d.subtype === 'Crew' && d.isEnabled).length}</div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Pillar 3: Process (Operations & HSE Plans) */}
                          <div className="col-12 col-md-6 col-lg-3.5" style={{ flex: '1 1 28%' }}>
                            <div className="p-3 bg-white border rounded-3 shadow-2xs h-100">
                              <div className="d-flex align-items-center justify-content-between mb-2">
                                <div className="d-flex align-items-center gap-1.5">
                                  <Activity className="w-4 h-4 text-primary" />
                                  <strong className="text-dark small">Process (Operations &amp; HSE)</strong>
                                </div>
                                <span className="badge bg-info text-dark font-mono-code" style={{ fontSize: '0.675rem' }}>
                                  {SUBTYPE_STANDARD_DOCS.Activity.filter((d) => docToggles[d.id]).length +
                                    specializedDocs.filter((d) => d.subtype === 'Activity' && d.isEnabled).length} Docs
                                </span>
                              </div>
                              <div className="d-flex flex-column gap-2 text-secondary small" style={{ fontSize: '0.78rem' }}>
                                <div className="p-2 bg-light rounded-2">
                                  <div className="fw-semibold text-dark">Section: Marine Operations &amp; HSE Plans</div>
                                  <div className="text-muted">Operational Risk &amp; Emergency Protocols</div>
                                  <div className="mt-1">Standard: {SUBTYPE_STANDARD_DOCS.Activity.filter((d) => docToggles[d.id]).length} · Specialized: {specializedDocs.filter((d) => d.subtype === 'Activity' && d.isEnabled).length}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Asset Nomination & Verification Workflow Notice */}
                      <div className="col-12">
                        <div className="p-3 bg-light-subtle rounded-3 border border-primary-subtle">
                          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                            <div className="d-flex align-items-center gap-2">
                              <FileCheck className="text-primary" style={{ width: '18px', height: '18px' }} />
                              <strong className="text-dark small">Asset Nomination &amp; Verification Workflow</strong>
                            </div>
                            <span className="badge bg-primary text-white font-mono-code" style={{ fontSize: '0.75rem' }}>
                              Assigned via Project / Roster Management
                            </span>
                          </div>
                          <p className="text-secondary small mb-0" style={{ fontSize: '0.8125rem' }}>
                            All requirements defined in this Assurance Set establish baseline compliance standards. Physical assets, seafarers, and operational procedures will be nominated and assigned inside Project / Roster Management, where asset vaults and statutory certificates will be verified during campaign scheduling.
                          </p>
                        </div>
                      </div>
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
                Previous Step
              </button>
            )}

            {currentStep < totalSteps ? (
              <button
                type="button"
                className="btn btn-primary text-white px-4 py-1.5 fw-semibold"
                onClick={handleNext}
              >
                Next Step
              </button>
            ) : (
              <button
                type="button"
                className="btn text-white px-5 py-2 fw-semibold shadow-sm"
                style={{ backgroundColor: 'rgb(11, 27, 43)', borderColor: 'rgb(11, 27, 43)' }}
                onClick={handleSubmit}
              >
                Initiate Assurance Set
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
                  {editingDraftId ? 'Exit Draft Setup' : 'Exit Assurance Set Wizard'}
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
                    ? 'You are currently continuing setup of an existing draft assurance set. Would you like to save your updated state to this draft, or discard your current session changes?'
                    : 'You have unsaved changes in this assurance set creation wizard. Would you like to save your configuration as a draft to resume later, or discard your progress?'}
                </p>
                <div className="p-3 bg-light rounded-3 border small">
                  <div className="fw-semibold text-dark">{title || 'Untitled Campaign'}</div>
                  <div className="text-muted mt-0.5">
                    Scope: {assuranceType} &nbsp;|&nbsp; Target Project: {selectedProject?.name || 'Project Scope'}
                  </div>
                </div>
              </div>
              <div className="modal-footer border-top bg-light px-4 py-3 d-flex align-items-center justify-content-between">
                <button
                  type="button"
                  className="btn btn-outline-danger btn-sm px-3"
                  onClick={handleConfirmExitWithoutSaving}
                >
                  Discard &amp; Exit
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
