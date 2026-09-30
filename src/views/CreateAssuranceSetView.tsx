/* 
  file summary: segmented assurance set creation wizard matching enterprise design standards (similar to VesselModal).
  responsibilities: captures campaign scope (Project vs Subtypes: Vessel, Crew, Activity, Equipment), general information, subtype statutory & operational documents with descriptions, public/organization templates, specialized custom requirements, workflow policies, and role assignments.
  role in system: rendered by App.tsx when currentHashView is 'create-assurance-set'.
*/

import React, { useState, useEffect, useCallback } from 'react';
import { useMapStore } from '../store/useMapStore';
import { AssuranceSet, AssuranceRequirement, AssuranceScopeType, AssuranceSubtype } from '../types/assurance';
import { UserProfile } from '../types/user';
import {
  filterCAdminAvailableToCharter,
  filterCAdminOwnFleet,
  filterVesselsForPersona,
  getClientAdminOrganization,
  isChartererMatchingVesselOwner,
  isVesselOwnedByClientOrg,
} from '../utils/rbacHelpers';
import { usersWithRole, getEligibleVerifiers, getAssuranceAssignmentWarnings, hasBlockingAssuranceAssignmentConflict } from '../utils/userRoleHelpers';
import { isDuplicateCampaignTitle, generateUniqueAssuranceSetId, generateUniqueRequirementId } from '../utils/validation';
import { SUBTYPE_STANDARD_DOCS, SUBTYPE_TEMPLATES, SUBTYPE_CATEGORIES, StandardSubtypeDocument, SubtypeTemplate, EXISTING_PROJECTS } from '../utils/assuranceTemplates';
import { AssuranceRequirementCategory } from '../types/assurance';

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
    assuranceSets,
    addAssuranceSet,
    updateAssuranceSet,
    activePersona,
    setCurrentHashView,
    previousHashView,
    createAssuranceForVesselId,
    setCreateAssuranceForVesselId,
    users,
  } = useMapStore();

  const isClientAdmin = activePersona === 'C Admin';
  const clientOrg = getClientAdminOrganization(users);

  const [vesselSource, setVesselSource] = useState<'external' | 'own-fleet'>('external');

  const availableVessels = isClientAdmin
    ? vesselSource === 'own-fleet'
      ? filterCAdminOwnFleet(vessels, clientOrg)
      : filterCAdminAvailableToCharter(vessels, assuranceSets, clientOrg)
    : activePersona === 'Administrator'
      ? vessels
      : filterVesselsForPersona(vessels, assuranceSets, activePersona);

  const defaultCharterer = isClientAdmin ? clientOrg : 'Northwind Marine Pty Ltd';
  const prefilledVessel = createAssuranceForVesselId
    ? vessels.find((v) => v.id === createAssuranceForVesselId)
    : undefined;
  const initialVesselId = prefilledVessel?.id || availableVessels[0]?.id || vessels[0]?.id || '';
  const initialVesselName = prefilledVessel?.name || availableVessels[0]?.name || vessels[0]?.name || 'Vessel';

  /* Wizard Step State */
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [errorMessage, setErrorMessage] = useState('');
  const [editingDraftId, setEditingDraftId] = useState<string | undefined>(undefined);

  /* Step 1: Scope & General Information */
  const [title, setTitle] = useState(
    () => `${defaultCharterer} - ${initialVesselName} Charter Vetting`
  );
  const [assuranceType, setAssuranceType] = useState<AssuranceScopeType>('Project');
  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => EXISTING_PROJECTS[0]?.id || '');
  const [templatePrivacy, setTemplatePrivacy] = useState<'organization' | 'public'>('organization');
  const [showCancelPrompt, setShowCancelPrompt] = useState<boolean>(false);
  const [isGeneralInfoExpanded, setIsGeneralInfoExpanded] = useState<boolean>(true);
  const [vesselId, setVesselId] = useState(initialVesselId);
  const [charterer, setCharterer] = useState(defaultCharterer);
  const [startDate, setStartDate] = useState('2026-11-01');
  const [endDate, setEndDate] = useState('2027-11-01');
  const isVesselLocked = Boolean(createAssuranceForVesselId);

  /* Global template selector from existing assurance sets (optional) */
  const [selectedGlobalTemplateId, setSelectedGlobalTemplateId] = useState<string>(templateSetId || '');

  /* Workflow requirements state */
  const [verificationRequired, setVerificationRequired] = useState(true);
  const [inspectionRequired, setInspectionRequired] = useState(true);
  const [approvalRequired, setApprovalRequired] = useState(true);

  /* Stakeholder assignment state */
  const submitterUsers = usersWithRole(users, 'Submitter');
  const verifierUsers = getEligibleVerifiers(users);
  const inspectorUsers = usersWithRole(users, 'Inspector');
  const approverUsers = usersWithRole(users, 'Approver');

  const [assignedSubmitter, setAssignedSubmitter] = useState(submitterUsers[0]?.id || '');
  const [assignedVerifier, setAssignedVerifier] = useState(verifierUsers[0]?.id || '');
  const [assignedInspector, setAssignedInspector] = useState(inspectorUsers[0]?.id || '');
  const [assignedApprover, setAssignedApprover] = useState(approverUsers[0]?.id || '');
  const [assignmentError, setAssignmentError] = useState('');
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

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
  const getWizardSteps = (): Array<{ id: string; label: string; subtype?: AssuranceSubtype }> => {
    if (assuranceType === 'Project') {
      return [
        { id: 'step-scope', label: 'Identification & Scope' },
        { id: 'step-vessel', label: 'Vessel', subtype: 'Vessel' },
        { id: 'step-crew', label: 'Crew', subtype: 'Crew' },
        { id: 'step-activity', label: 'Activity', subtype: 'Activity' },
        { id: 'step-equipment', label: 'Equipment', subtype: 'Equipment' },
        { id: 'step-review', label: 'Review & Initiate' },
      ];
    } else {
      return [
        { id: 'step-scope', label: 'Identification & Scope' },
        { id: `step-${assuranceType.toLowerCase()}`, label: assuranceType, subtype: assuranceType as AssuranceSubtype },
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
    if (!createAssuranceForVesselId) {
      setVesselId(targetSet.vesselId);
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

    const targetVesselObj = createAssuranceForVesselId
      ? vessels.find((v) => v.id === createAssuranceForVesselId)
      : vessels.find((v) => v.id === targetSet.vesselId) || vessels[0];
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
          if (target.projectId) setSelectedProjectId(target.projectId);
          if (target.templateSource === 'public' || target.visibility === 'draft') {
            setTemplatePrivacy('public');
          } else {
            setTemplatePrivacy('organization');
          }
          if (target.vesselId) setVesselId(target.vesselId);
          if (target.charterer) setCharterer(target.charterer);
          if (target.charterWindowStart) setStartDate(target.charterWindowStart);
          if (target.charterWindowEnd) setEndDate(target.charterWindowEnd);
          setVerificationRequired(target.verificationRequired ?? true);
          setInspectionRequired(target.mandatoryInspectionRequired);
          setApprovalRequired(target.formalApprovalRequired ?? true);
          if (target.appliedTemplates) setSelectedSubtypeTemplates(target.appliedTemplates);

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
      setErrorMessage(`Please enter a title for the specialized ${subtype} document.`);
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

  /* Validation per Step */
  const validateCurrentStep = (): boolean => {
    setErrorMessage('');

    if (currentStep === 1) {
      if (!title.trim()) {
        setErrorMessage('Assurance set campaign title is mandatory.');
        return false;
      }
      const duplicateCheck = isDuplicateCampaignTitle(title, assuranceSets);
      if (duplicateCheck.isDuplicate) {
        setErrorMessage(duplicateCheck.reason || 'Campaign title already exists. Please choose a unique name.');
        return false;
      }
      if (assuranceType === 'Project' && !selectedProjectId) {
        setErrorMessage('Please select an existing project to attach this assurance set.');
        return false;
      }
      if (!startDate || !endDate) {
        setErrorMessage('Charter window start and end dates are required.');
        return false;
      }
      if (
        hasBlockingAssuranceAssignmentConflict({
          verifierId: verificationRequired ? assignedVerifier : undefined,
          approverId: approvalRequired ? assignedApprover : undefined,
        })
      ) {
        setErrorMessage('Segregation-of-Duty Error: Verifier and Approver cannot be the same user.');
        return false;
      }
    }

    return true;
  };

  const handleNext = () => {
    if (validateCurrentStep()) {
      setCurrentStep((prev) => Math.min(prev + 1, totalSteps));
    }
  };

  const handlePrevious = () => {
    setErrorMessage('');
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const selectedVessel = vessels.find((v) => v.id === vesselId) || availableVessels[0] || vessels[0];
  const selectedSubmitter = users.find((u: UserProfile) => u.id === assignedSubmitter);
  const selectedVerifier = users.find((u: UserProfile) => u.id === assignedVerifier);
  const selectedInspector = users.find((u: UserProfile) => u.id === assignedInspector);
  const selectedApprover = users.find((u: UserProfile) => u.id === assignedApprover);

  const assignmentWarnings = getAssuranceAssignmentWarnings({
    submitterId: assignedSubmitter,
    verifierId: verificationRequired ? assignedVerifier : undefined,
    approverId: approvalRequired ? assignedApprover : undefined,
  });

  /* Submit and create assurance set */
  const handleSubmit = (e?: React.SyntheticEvent) => {
    e?.preventDefault();
    setHasAttemptedSubmit(true);

    if (!validateCurrentStep()) {
      setCurrentStep(1);
      return;
    }

    const isOwnFleetSelection = isClientAdmin && isVesselOwnedByClientOrg(selectedVessel, clientOrg);
    const isExternalSelfCharterRisk =
      isClientAdmin &&
      vesselSource === 'external' &&
      isChartererMatchingVesselOwner(clientOrg, selectedVessel);

    if (isExternalSelfCharterRisk) {
      const confirmed = window.confirm(
        `The selected vessel appears to be owned by ${clientOrg}. This looks like an internal deployment, not a third-party charter.\n\nClick OK to proceed as internal deployment.`
      );
      if (!confirmed) return;
    }

    const uniqueSetId = generateUniqueAssuranceSetId(assuranceSets);

    /* Determine which subtypes are active */
    const activeSubtypes: AssuranceSubtype[] =
      assuranceType === 'Project'
        ? ['Vessel', 'Crew', 'Activity', 'Equipment']
        : [assuranceType as AssuranceSubtype];

    /* Build combined requirements list from standard subtype docs and specialized docs */
    const finalRequirements: AssuranceRequirement[] = [];
    let reqIndex = 0;

    activeSubtypes.forEach((subtype) => {
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
        });
      });
    });

    const initiatorOrg = isClientAdmin ? clientOrg : 'Northwind Marine Pty Ltd';
    const effectiveCharterer = charterer.trim() || initiatorOrg;
    const internalDeployment = isClientAdmin && (vesselSource === 'own-fleet' || isOwnFleetSelection);

    const targetSetId = editingDraftId || generateUniqueAssuranceSetId(assuranceSets);

    const newSet: AssuranceSet = {
      id: targetSetId,
      title: title.trim(),
      assuranceType,
      projectId: assuranceType === 'Project' ? selectedProjectId : undefined,
      projectName: assuranceType === 'Project' ? (EXISTING_PROJECTS.find((p) => p.id === selectedProjectId)?.name || selectedProjectId) : undefined,
      subtypes: activeSubtypes,
      visibility: templatePrivacy,
      templateSource: templatePrivacy,
      appliedTemplates: selectedSubtypeTemplates,
      vesselId: selectedVessel?.id || 'VESSEL-001',
      vesselName: selectedVessel?.name || 'Vessel Asset',
      imoNumber: selectedVessel?.imoNumber || '9123456',
      initiatorOrg,
      initiatorRole: isClientAdmin ? 'C Admin · Client Created' : 'Vessel Provider Admin',
      charterer: effectiveCharterer,
      internalDeployment: internalDeployment || undefined,
      charterWindowStart: startDate,
      charterWindowEnd: endDate,
      stage: 'Initiated',
      readinessScore: 10,
      verificationRequired,
      mandatoryInspectionRequired: inspectionRequired,
      formalApprovalRequired: approvalRequired,
      inspectionCompleted: false,
      assignedSubmitter: selectedSubmitter
        ? `${selectedSubmitter.name} (${selectedSubmitter.organization})`
        : 'Pending Admin Assignment',
      assignedVerifier: verificationRequired
        ? selectedVerifier
          ? `${selectedVerifier.name} (${selectedVerifier.organization})`
          : 'Pending Admin Assignment'
        : undefined,
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
      requirements: finalRequirements,
      stakeholders: undefined,
      assignedStakeholders: undefined,
      createdByPersona: '',
    };

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
    const activeSubtypes: AssuranceSubtype[] =
      assuranceType === 'Project'
        ? ['Vessel', 'Crew', 'Activity', 'Equipment']
        : [assuranceType as AssuranceSubtype];

    const finalRequirements: AssuranceRequirement[] = [];
    let reqIndex = 0;

    activeSubtypes.forEach((subtype) => {
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
        });
      });
    });

    const isOwnFleetSelection = isClientAdmin && isVesselOwnedByClientOrg(selectedVessel, clientOrg);
    const initiatorOrg = isClientAdmin ? clientOrg : 'Northwind Marine Pty Ltd';
    const effectiveCharterer = charterer.trim() || initiatorOrg;
    const internalDeployment = isClientAdmin && (vesselSource === 'own-fleet' || isOwnFleetSelection);

    const draftSet: AssuranceSet = {
      id: targetSetId,
      title: title.trim() || `${defaultCharterer} - Draft Campaign`,
      assuranceType,
      projectId: assuranceType === 'Project' ? selectedProjectId : undefined,
      projectName: assuranceType === 'Project' ? (EXISTING_PROJECTS.find((p) => p.id === selectedProjectId)?.name || selectedProjectId) : undefined,
      subtypes: activeSubtypes,
      visibility: 'draft',
      templateSource: templatePrivacy,
      appliedTemplates: selectedSubtypeTemplates,
      vesselId: selectedVessel?.id || 'VESSEL-001',
      vesselName: selectedVessel?.name || 'Vessel Asset',
      imoNumber: selectedVessel?.imoNumber || '9123456',
      initiatorOrg,
      initiatorRole: isClientAdmin ? 'C Admin · Client Created' : 'Vessel Provider Admin',
      charterer: effectiveCharterer,
      internalDeployment: internalDeployment || undefined,
      charterWindowStart: startDate || '2026-11-01',
      charterWindowEnd: endDate || '2027-11-01',
      stage: 'Initiated',
      readinessScore: 0,
      verificationRequired,
      mandatoryInspectionRequired: inspectionRequired,
      formalApprovalRequired: approvalRequired,
      inspectionCompleted: false,
      assignedSubmitter: selectedSubmitter
        ? `${selectedSubmitter.name} (${selectedSubmitter.organization})`
        : 'Pending Admin Assignment',
      assignedVerifier: verificationRequired
        ? selectedVerifier
          ? `${selectedVerifier.name} (${selectedVerifier.organization})`
          : 'Pending Admin Assignment'
        : undefined,
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
      requirements: finalRequirements,
      stakeholders: undefined,
      assignedStakeholders: undefined,
      createdByPersona: '',
    };

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
  const renderSubtypeSection = (subtype: AssuranceSubtype) => {
    const standardDocs = SUBTYPE_STANDARD_DOCS[subtype] || [];
    const publicTemplates = SUBTYPE_TEMPLATES.filter((t) => (t.subtype === subtype || t.subtype === 'All') && t.source === 'public');
    const orgTemplates = SUBTYPE_TEMPLATES.filter((t) => (t.subtype === subtype || t.subtype === 'All') && t.source === 'organization');
    const activeTemplateId = selectedSubtypeTemplates[subtype] || '';
    const specializedList = specializedDocs.filter((d) => d.subtype === subtype);
    const specInput = specializedInputs[subtype];

    return (
      <div className="d-flex flex-column gap-4" id={`subtype-docs-container-${subtype}`}>
        {/* Template Selector Card (Optional) */}
        <div className="card border shadow-sm rounded-3 bg-white">
          <div className="card-header bg-light border-bottom px-4 py-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
              <h5 className="fw-bold text-slate-900 m-0 fs-6">
                {subtype} Assurance Templates (Optional)
              </h5>
              <div className="text-muted small mt-0.5">
                Apply a public standard or organizational baseline to automatically configure required {subtype.toLowerCase()} documents.
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
              Required {subtype} Documents &amp; Information
            </h5>
            <p className="text-muted small m-0 mt-1">
              Toggle mandatory and statutory compliance requirements for this {subtype.toLowerCase()} section. All documents include verified descriptions.
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
                Add Specialized {subtype} Document <span className="text-secondary fw-normal fs-7">(Optional)</span>
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
                  className="form-control bg-white text-dark border-secondary-subtle"
                  placeholder={`e.g. Specialized ${subtype} Operational Verification Report`}
                  value={specInput.title}
                  onChange={(e) =>
                    setSpecializedInputs((prev) => ({
                      ...prev,
                      [subtype]: { ...prev[subtype], title: e.target.value },
                    }))
                  }
                />
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
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Add Specialized Document
                </button>
              </div>
            </div>

            {/* List of Added Specialized Documents for this subtype */}
            {specializedList.length > 0 && (
              <div className="mt-4 border-top pt-3">
                <h6 className="fw-bold text-dark small mb-2">
                  Added Specialized {subtype} Requirements ({specializedList.length})
                </h6>
                <div className="d-flex flex-column gap-2">
                  {specializedList.map((spec) => (
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
          {errorMessage && (
            <div className="alert alert-danger py-2 small mb-4">{errorMessage}</div>
          )}

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
                        className={`form-control bg-white text-dark border-secondary-subtle${animatingFields.has('grid-campaign-title') ? ' map-autofill-animate' : ''}${isDuplicateCampaignTitle(title, assuranceSets).isDuplicate || (hasAttemptedSubmit && !title.trim()) ? ' is-invalid' : ''}`}
                        placeholder="e.g. Chevron Gorgon Charter Vetting 2026"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                      />
                      {isDuplicateCampaignTitle(title, assuranceSets).isDuplicate && (
                        <div className="invalid-feedback d-block small mt-1">
                          {isDuplicateCampaignTitle(title, assuranceSets).reason}
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
                        onChange={(e) => setAssuranceType(e.target.value as AssuranceScopeType)}
                      >
                        <option value="Project">Project (Vessel, Crew, Activity, Equipment)</option>
                        <option value="Vessel">Vessel Only</option>
                        <option value="Crew">Crew Only</option>
                        <option value="Activity">Activity Only</option>
                        <option value="Equipment">Equipment Only</option>
                      </select>
                    </div>

                    {/* Existing Project Association Dropdown (Mandatory when scope is Project) */}
                    {assuranceType === 'Project' && (
                      <div className="col-12">
                        <div className="p-3 bg-light border rounded-3">
                          <label className="form-label text-secondary small fw-semibold d-flex align-items-center justify-content-between" htmlFor="grid-project-association">
                            <span>Associated Existing Project <span className="text-danger">*</span></span>
                            <span className="badge bg-primary text-white font-mono-code" style={{ fontSize: '0.675rem' }}>
                              Required for Project Scope
                            </span>
                          </label>
                          <select
                            id="grid-project-association"
                            className="form-select bg-white text-dark border-secondary-subtle fw-semibold"
                            value={selectedProjectId}
                            onChange={(e) => setSelectedProjectId(e.target.value)}
                            required
                          >
                            <option value="">-- Select an Existing Project to Attach Assurance Set --</option>
                            {EXISTING_PROJECTS.map((proj) => (
                              <option key={proj.id} value={proj.id}>
                                {proj.id} &mdash; {proj.name} ({proj.clientOperator})
                              </option>
                            ))}
                          </select>

                          {/* Selected Project Details Info Card */}
                          {EXISTING_PROJECTS.find((p) => p.id === selectedProjectId) && (() => {
                            const proj = EXISTING_PROJECTS.find((p) => p.id === selectedProjectId)!;
                            return (
                              <div className="mt-2.5 p-2.5 bg-white border rounded-2 small text-secondary">
                                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-1">
                                  <span className="fw-bold text-dark">{proj.name}</span>
                                  <span className="badge bg-light text-dark border font-mono-code" style={{ fontSize: '0.675rem' }}>
                                    {proj.id}
                                  </span>
                                </div>
                                <div className="row g-2 text-muted" style={{ fontSize: '0.78rem' }}>
                                  <div className="col-12 col-md-6">
                                    <strong className="text-secondary">Operator / Client:</strong> {proj.clientOperator}
                                  </div>
                                  <div className="col-12 col-md-6">
                                    <strong className="text-secondary">Basin / Location:</strong> {proj.location}
                                  </div>
                                  <div className="col-12">
                                    <strong className="text-secondary">Scope Summary:</strong> {proj.description}
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    )}

                    <div className="col-12">
                      <div className="p-3 bg-primary-subtle border border-primary-subtle rounded-2 small text-primary d-flex align-items-center justify-content-between flex-wrap gap-2">
                        <div>
                          <strong>Selected Scope: {assuranceType} Assurance</strong>
                          <div className="text-secondary mt-0.5">
                            {assuranceType === 'Project'
                              ? 'Project scope mandates individual sections and requirement verification for all 4 operational subtypes (Vessel, Crew, Activity, and Equipment) attached to the selected offshore project.'
                              : `Standalone assurance set focused strictly on the ${assuranceType} subtype statutory requirements and operational documents.`}
                          </div>
                        </div>
                        <span className="badge bg-primary text-white font-mono-code">
                          {assuranceType === 'Project' ? '4 Subtypes Required' : '1 Subtype Required'}
                        </span>
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
                      Template Privacy &amp; Distribution Scope
                    </h5>
                    <div className="text-muted small">
                      Select whether this assurance set and its document specifications can be used as a template by the public or within your organization only.
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
                              <strong className="text-dark small">Organization Only (Private)</strong>
                              <span className="badge bg-secondary-subtle text-dark border font-mono-code" style={{ fontSize: '0.65rem' }}>
                                Internal
                              </span>
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
                              <strong className="text-dark small">Public Industry Standard (Shared)</strong>
                              <span className="badge bg-success-subtle text-success border border-success-subtle font-mono-code" style={{ fontSize: '0.65rem' }}>
                                Platform Wide
                              </span>
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
                      General Information &amp; Charter Parameters
                    </h5>
                    <div className="text-muted small">
                      Configure asset target, charter window, workflow governance, and stakeholder assignments.
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
                    onClick={() => setIsGeneralInfoExpanded(!isGeneralInfoExpanded)}
                  >
                    <span>{isGeneralInfoExpanded ? 'Collapse' : 'Expand'}</span>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      style={{ transform: isGeneralInfoExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                </div>

                {isGeneralInfoExpanded && (
                  <div className="card-body p-4">
                    <div className="row g-4">
                      {/* Vessel & Charterer Row */}
                      <div className="col-12 col-md-6">
                        <label className="form-label text-secondary small fw-semibold" htmlFor="grid-target-vessel">
                          Target Vessel / Primary Asset <span className="text-danger">*</span>
                        </label>
                        <select
                          id="grid-target-vessel"
                          className={`form-select bg-white text-dark border-secondary-subtle${animatingFields.has('grid-target-vessel') ? ' map-autofill-animate' : ''}`}
                          value={vesselId}
                          onChange={(e) => setVesselId(e.target.value)}
                          disabled={availableVessels.length === 0 || isVesselLocked}
                        >
                          {availableVessels.length === 0 ? (
                            <option value="">No vessels available</option>
                          ) : (
                            availableVessels.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.name} (IMO: {v.imoNumber} — Flag: {v.flagState})
                              </option>
                            ))
                          )}
                        </select>
                      </div>

                      {!isClientAdmin ? (
                        <div className="col-12 col-md-6">
                          <label className="form-label text-secondary small fw-semibold" htmlFor="grid-charterer-org">
                            Charterer Organization <span className="text-danger">*</span>
                          </label>
                          <input
                            id="grid-charterer-org"
                            type="text"
                            className="form-control bg-white text-dark border-secondary-subtle"
                            placeholder="e.g. Chevron Australia Pty Ltd"
                            value={charterer}
                            onChange={(e) => setCharterer(e.target.value)}
                            required
                          />
                        </div>
                      ) : (
                        <div className="col-12 col-md-6">
                          <label className="form-label text-secondary small fw-semibold">
                            Client Organization
                          </label>
                          <input
                            type="text"
                            className="form-control bg-light text-secondary border-secondary-subtle"
                            value={clientOrg}
                            disabled
                          />
                        </div>
                      )}

                      {/* Charter Window Dates */}
                      <div className="col-12 col-md-6">
                        <label className="form-label text-secondary small fw-semibold" htmlFor="grid-charter-start">
                          Charter Start Date <span className="text-danger">*</span>
                        </label>
                        <input
                          id="grid-charter-start"
                          type="date"
                          className="form-control bg-white text-dark border-secondary-subtle font-mono-code"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          required
                        />
                      </div>

                      <div className="col-12 col-md-6">
                        <label className="form-label text-secondary small fw-semibold" htmlFor="grid-charter-end">
                          Charter End Date <span className="text-danger">*</span>
                        </label>
                        <input
                          id="grid-charter-end"
                          type="date"
                          className="form-control bg-white text-dark border-secondary-subtle font-mono-code"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          required
                        />
                      </div>

                      {/* Workflow Switches */}
                      <div className="col-12">
                        <div className="p-3 bg-light border rounded-3">
                          <strong className="text-dark small d-block mb-2">Workflow &amp; Verification Policies</strong>
                          <div className="d-flex flex-wrap gap-4">
                            <div className="form-check form-switch m-0">
                              <input
                                className="form-check-input cursor-pointer"
                                type="checkbox"
                                checked={verificationRequired}
                                onChange={(e) => setVerificationRequired(e.target.checked)}
                                id="wf-verify"
                              />
                              <label htmlFor="wf-verify" className="form-check-label text-dark small fw-semibold cursor-pointer">
                                Verification Required (Verifier Gate)
                              </label>
                            </div>

                            <div className="form-check form-switch m-0">
                              <input
                                className="form-check-input cursor-pointer"
                                type="checkbox"
                                checked={inspectionRequired}
                                onChange={(e) => setInspectionRequired(e.target.checked)}
                                id="wf-inspect"
                              />
                              <label htmlFor="wf-inspect" className="form-check-label text-dark small fw-semibold cursor-pointer">
                                Visual / Vessel Inspection Required
                              </label>
                            </div>

                            <div className="form-check form-switch m-0">
                              <input
                                className="form-check-input cursor-pointer"
                                type="checkbox"
                                checked={approvalRequired}
                                onChange={(e) => setApprovalRequired(e.target.checked)}
                                id="wf-approve"
                              />
                              <label htmlFor="wf-approve" className="form-check-label text-dark small fw-semibold cursor-pointer">
                                Formal Approver Sign-Off Required
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Stakeholder Role Assignments (Admin & C Admin) */}
                      <div className="col-12">
                        <div className="p-3 border rounded-3 bg-light-subtle">
                          <strong className="text-dark small d-block mb-2">Assigned Campaign Stakeholders</strong>
                          {assignmentWarnings.length > 0 && (
                            <div className="alert alert-warning py-1.5 small mb-3">
                              <ul className="mb-0 ps-3">
                                {assignmentWarnings.map((w) => (
                                  <li key={w}>{w}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <div className="row g-3">
                            <div className="col-12 col-md-6 col-lg-3">
                              <label className="form-label text-secondary small fw-semibold" htmlFor="assign-sub">
                                Submitter <span className="text-danger">*</span>
                              </label>
                              <select
                                id="assign-sub"
                                className="form-select form-select-sm bg-white text-dark border-secondary-subtle"
                                value={assignedSubmitter}
                                onChange={(e) => setAssignedSubmitter(e.target.value)}
                              >
                                {submitterUsers.map((u) => (
                                  <option key={u.id} value={u.id}>
                                    {u.name} ({u.organization})
                                  </option>
                                ))}
                              </select>
                            </div>

                            {verificationRequired && (
                              <div className="col-12 col-md-6 col-lg-3">
                                <label className="form-label text-secondary small fw-semibold" htmlFor="assign-ver">
                                  Verifier <span className="text-danger">*</span>
                                </label>
                                <select
                                  id="assign-ver"
                                  className="form-select form-select-sm bg-white text-dark border-secondary-subtle"
                                  value={assignedVerifier}
                                  onChange={(e) => setAssignedVerifier(e.target.value)}
                                >
                                  {verifierUsers.map((u) => (
                                    <option key={u.id} value={u.id}>
                                      {u.name} ({u.organization})
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}

                            {inspectionRequired && (
                              <div className="col-12 col-md-6 col-lg-3">
                                <label className="form-label text-secondary small fw-semibold" htmlFor="assign-ins">
                                  Inspector
                                </label>
                                <select
                                  id="assign-ins"
                                  className="form-select form-select-sm bg-white text-dark border-secondary-subtle"
                                  value={assignedInspector}
                                  onChange={(e) => setAssignedInspector(e.target.value)}
                                >
                                  {inspectorUsers.map((u) => (
                                    <option key={u.id} value={u.id}>
                                      {u.name} ({u.organization})
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}

                            {approvalRequired && (
                              <div className="col-12 col-md-6 col-lg-3">
                                <label className="form-label text-secondary small fw-semibold" htmlFor="assign-app">
                                  Approver <span className="text-danger">*</span>
                                </label>
                                <select
                                  id="assign-app"
                                  className="form-select form-select-sm bg-white text-dark border-secondary-subtle"
                                  value={assignedApprover}
                                  onChange={(e) => setAssignedApprover(e.target.value)}
                                >
                                  {approverUsers.map((u) => (
                                    <option key={u.id} value={u.id}>
                                      {u.name} ({u.organization})
                                    </option>
                                  ))}
                                </select>
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

          {/* DYNAMIC SUBTYPE STEPS */}
          {currentStepData.subtype && renderSubtypeSection(currentStepData.subtype)}

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
                        <div className="p-3 bg-light rounded-3 border">
                          <strong className="text-dark small d-block mb-1">Campaign Title &amp; Governance</strong>
                          <div className="fw-bold text-primary fs-6">{title}</div>
                          <div className="text-secondary small mt-2">
                            <strong>Scope:</strong> {assuranceType} Assurance &nbsp;|&nbsp; <strong>Asset:</strong> {selectedVessel?.name} ({selectedVessel?.imoNumber})
                          </div>
                          <div className="text-secondary small">
                            <strong>Charterer:</strong> {charterer} &nbsp;|&nbsp; <strong>Window:</strong> {startDate} to {endDate}
                          </div>
                          {assuranceType === 'Project' && selectedProjectId && (
                            <div className="text-secondary small mt-1">
                              <strong>Attached Project:</strong>{' '}
                              <span className="text-dark fw-semibold">
                                {EXISTING_PROJECTS.find((p) => p.id === selectedProjectId)?.name || selectedProjectId}
                              </span>{' '}
                              <span className="badge bg-light text-dark border font-mono-code ms-1" style={{ fontSize: '0.675rem' }}>
                                {selectedProjectId}
                              </span>
                            </div>
                          )}
                          <div className="text-secondary small mt-1 d-flex align-items-center gap-2">
                            <strong>Template Privacy:</strong>
                            <span className={`badge ${templatePrivacy === 'public' ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-secondary-subtle text-dark border'} font-mono-code`} style={{ fontSize: '0.675rem' }}>
                              {templatePrivacy === 'public' ? 'Public Standard (Shared)' : 'Organization Only (Private)'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="col-12 col-md-6">
                        <div className="p-3 bg-light rounded-3 border">
                          <strong className="text-dark small d-block mb-1">Assigned Stakeholders</strong>
                          <div className="text-secondary small"><strong>Submitter:</strong> {selectedSubmitter ? `${selectedSubmitter.name} (${selectedSubmitter.organization})` : 'Pending'}</div>
                          <div className="text-secondary small"><strong>Verifier:</strong> {verificationRequired ? (selectedVerifier ? `${selectedVerifier.name} (${selectedVerifier.organization})` : 'Pending') : 'N/A'}</div>
                          <div className="text-secondary small"><strong>Inspector:</strong> {inspectionRequired ? (selectedInspector ? `${selectedInspector.name} (${selectedInspector.organization})` : 'Pending') : 'N/A'}</div>
                          <div className="text-secondary small"><strong>Approver:</strong> {approvalRequired ? (selectedApprover ? `${selectedApprover.name} (${selectedApprover.organization})` : 'Pending') : 'N/A'}</div>
                        </div>
                      </div>

                      {/* Subtypes Requirements Summary Breakdown */}
                      <div className="col-12">
                        <strong className="text-dark small d-block mb-2">Subtype Requirements Breakdown</strong>
                        <div className="row g-3">
                          {(assuranceType === 'Project' ? (['Vessel', 'Crew', 'Activity', 'Equipment'] as AssuranceSubtype[]) : [assuranceType as AssuranceSubtype]).map((sub) => {
                            const stdCount = SUBTYPE_STANDARD_DOCS[sub].filter((d) => docToggles[d.id]).length;
                            const specCount = specializedDocs.filter((d) => d.subtype === sub && d.isEnabled).length;
                            const tmplName = SUBTYPE_TEMPLATES.find((t) => t.id === selectedSubtypeTemplates[sub])?.name;

                            return (
                              <div key={sub} className="col-12 col-md-6 col-lg-3">
                                <div className="p-3 bg-white border rounded-3 shadow-2xs h-100">
                                  <div className="d-flex align-items-center justify-content-between mb-1">
                                    <strong className="text-dark small">{sub} Subtype</strong>
                                    <span className="badge bg-primary text-white font-mono-code" style={{ fontSize: '0.675rem' }}>
                                      {stdCount + specCount} Docs
                                    </span>
                                  </div>
                                  <div className="text-secondary small" style={{ fontSize: '0.78rem' }}>
                                    <div>Standard: {stdCount} required</div>
                                    <div>Specialized: {specCount} custom</div>
                                    {tmplName && <div className="text-primary mt-1 text-truncate" title={tmplName}>Template: {tmplName}</div>}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
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
              title="Save current progress as a draft and resume later"
            >
              Save as Draft
            </button>
          </div>

          <div className="d-flex align-items-center gap-2">
            {currentStep > 1 && (
              <button
                type="button"
                className="btn btn-outline-primary px-3.5 py-1.5 fw-semibold"
                onClick={handlePrevious}
              >
                &larr; Previous Step
              </button>
            )}

            {currentStep < totalSteps ? (
              <button
                type="button"
                className="btn btn-primary text-white px-4 py-1.5 fw-semibold"
                onClick={handleNext}
              >
                Next Step &rarr;
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
                <h5 className="modal-title fw-bold text-dark fs-6">Exit Assurance Set Wizard</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowCancelPrompt(false)}
                  aria-label="Close"
                />
              </div>
              <div className="modal-body px-4 py-4">
                <p className="text-secondary small mb-3" style={{ fontSize: '0.875rem', lineHeight: '1.5' }}>
                  You have unsaved changes in this assurance set creation wizard. Would you like to save your configuration as a draft to resume later, or discard your progress?
                </p>
                <div className="p-3 bg-light rounded-3 border small">
                  <div className="fw-semibold text-dark">{title || 'Untitled Campaign'}</div>
                  <div className="text-muted mt-0.5">
                    Scope: {assuranceType} &nbsp;|&nbsp; Target: {selectedVessel?.name || 'Vessel'}
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
                    Save as Draft
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
