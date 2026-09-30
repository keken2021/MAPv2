/* 
  file summary: segmented assurance set creation modal dialog for initiating campaigns in light theme.
  responsibilities: captures campaign scope (Project vs single Subtypes), general info, subtype statutory/operational requirements with descriptions, templates, and specialized documents in a multi-step modal wizard.
  role in system: modal drawer component for assurance campaign initiation.
*/

import React, { useState, useEffect } from 'react';
import { useMapStore } from '../../store/useMapStore';
import {
  AssuranceSet,
  AssuranceRequirement,
  AssuranceScopeType,
  AssuranceSubtype,
  AssuranceRequirementCategory,
} from '../../types/assurance';
import { filterVesselsForPersona, getClientAdminOrganization } from '../../utils/rbacHelpers';
import {
  isDuplicateCampaignTitle,
  generateUniqueAssuranceSetId,
  generateUniqueRequirementId,
} from '../../utils/validation';
import {
  SUBTYPE_STANDARD_DOCS,
  SUBTYPE_TEMPLATES,
  SUBTYPE_CATEGORIES,
} from '../../utils/assuranceTemplates';

interface AssuranceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SpecializedDoc {
  id: string;
  subtype: AssuranceSubtype;
  title: string;
  category: AssuranceRequirementCategory;
  description: string;
  isMandatory: boolean;
  isEnabled: boolean;
}

export const AssuranceModal: React.FC<AssuranceModalProps> = ({ isOpen, onClose }) => {
  const { vessels, assuranceSets, addAssuranceSet, activePersona, users } = useMapStore();

  const isClientAdmin = activePersona === 'C Admin';
  const clientOrg = getClientAdminOrganization(users);
  const defaultOrg = isClientAdmin ? clientOrg : 'Northwind Marine Pty Ltd';

  const availableVessels =
    activePersona === 'Administrator'
      ? vessels
      : filterVesselsForPersona(vessels, assuranceSets, activePersona);

  const initialVessel = availableVessels[0] || vessels[0];

  /* Wizard state */
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [errorMessage, setErrorMessage] = useState('');

  /* Step 1: Scope & General Info */
  const [title, setTitle] = useState(
    () => `${defaultOrg} - ${initialVessel?.name || 'Vessel'} Charter Vetting`
  );
  const [assuranceType, setAssuranceType] = useState<AssuranceScopeType>('Project');
  const [templatePrivacy, setTemplatePrivacy] = useState<'organization' | 'public'>('organization');
  const [showCancelPrompt, setShowCancelPrompt] = useState<boolean>(false);
  const [isGeneralInfoExpanded, setIsGeneralInfoExpanded] = useState<boolean>(true);
  const [vesselId, setVesselId] = useState(initialVessel?.id || '');
  const [charterer, setCharterer] = useState(defaultOrg);
  const [startDate, setStartDate] = useState('2026-11-01');
  const [endDate, setEndDate] = useState('2027-11-01');

  /* Workflow requirements */
  const [verificationRequired, setVerificationRequired] = useState(true);
  const [inspectionRequired, setInspectionRequired] = useState(true);
  const [approvalRequired, setApprovalRequired] = useState(true);

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

  /* Selected Templates per Subtype */
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

  useEffect(() => {
    if (!isOpen) return;
    setCurrentStep(1);
    setErrorMessage('');
    setShowCancelPrompt(false);
  }, [isOpen]);

  /* Calculate active wizard steps */
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

  useEffect(() => {
    if (currentStep > totalSteps) {
      setCurrentStep(totalSteps);
    }
  }, [totalSteps, currentStep]);

  if (!isOpen) return null;

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
  };

  const handleToggleStandardDoc = (docId: string) => {
    setDocToggles((prev) => ({
      ...prev,
      [docId]: !prev[docId],
    }));
  };

  const handleAddSpecializedDoc = (subtype: AssuranceSubtype) => {
    const input = specializedInputs[subtype];
    if (!input.title.trim()) {
      setErrorMessage(`Please enter a title for the specialized ${subtype} document.`);
      return;
    }

    const newSpecializedDoc: SpecializedDoc = {
      id: `modal-spec-${subtype.toLowerCase()}-${Date.now()}`,
      subtype,
      title: input.title.trim(),
      category: input.category,
      description: input.description.trim() || `Specialized requirement for ${subtype} assurance.`,
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

  const validateCurrentStep = (): boolean => {
    setErrorMessage('');
    if (currentStep === 1) {
      if (!title.trim()) {
        setErrorMessage('Assurance set name is mandatory.');
        return false;
      }
      const duplicateCheck = isDuplicateCampaignTitle(title, assuranceSets);
      if (duplicateCheck.isDuplicate) {
        setErrorMessage(duplicateCheck.reason || 'Campaign title already exists.');
        return false;
      }
      if (!startDate || !endDate) {
        setErrorMessage('Charter window dates are required.');
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

  const handleSubmit = (e?: React.SyntheticEvent) => {
    e?.preventDefault();
    if (!validateCurrentStep()) {
      setCurrentStep(1);
      return;
    }

    const uniqueSetId = generateUniqueAssuranceSetId(assuranceSets);
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

    const newSet: AssuranceSet = {
      id: uniqueSetId,
      title: title.trim(),
      assuranceType,
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
      charterWindowStart: startDate,
      charterWindowEnd: endDate,
      stage: 'Initiated',
      readinessScore: 10,
      verificationRequired,
      mandatoryInspectionRequired: inspectionRequired,
      formalApprovalRequired: approvalRequired,
      inspectionCompleted: false,
      requirements: finalRequirements,
      stakeholders: undefined,
      assignedStakeholders: undefined,
      createdByPersona: '',
    };

    addAssuranceSet(newSet);
    onClose();
  };

  const handleSaveDraft = () => {
    const uniqueSetId = generateUniqueAssuranceSetId(assuranceSets);
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

    const draftSet: AssuranceSet = {
      id: uniqueSetId,
      title: title.trim() || `${defaultOrg} - Draft Campaign`,
      assuranceType,
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
      charterWindowStart: startDate || '2026-11-01',
      charterWindowEnd: endDate || '2027-11-01',
      stage: 'Initiated',
      readinessScore: 0,
      verificationRequired,
      mandatoryInspectionRequired: inspectionRequired,
      formalApprovalRequired: approvalRequired,
      inspectionCompleted: false,
      requirements: finalRequirements,
      stakeholders: undefined,
      assignedStakeholders: undefined,
      createdByPersona: '',
    };

    addAssuranceSet(draftSet);
    setShowCancelPrompt(false);
    onClose();
  };

  const handleCancelClick = () => {
    setShowCancelPrompt(true);
  };

  const handleConfirmExitWithoutSaving = () => {
    setShowCancelPrompt(false);
    onClose();
  };

  const renderSubtypeSection = (subtype: AssuranceSubtype) => {
    const standardDocs = SUBTYPE_STANDARD_DOCS[subtype] || [];
    const publicTemplates = SUBTYPE_TEMPLATES.filter(
      (t) => (t.subtype === subtype || t.subtype === 'All') && t.source === 'public'
    );
    const orgTemplates = SUBTYPE_TEMPLATES.filter(
      (t) => (t.subtype === subtype || t.subtype === 'All') && t.source === 'organization'
    );
    const activeTemplateId = selectedSubtypeTemplates[subtype] || '';
    const specializedList = specializedDocs.filter((d) => d.subtype === subtype);
    const specInput = specializedInputs[subtype];

    return (
      <div className="d-flex flex-column gap-3">
        {/* Template Option */}
        <div className="p-3 bg-light border rounded-3">
          <div className="d-flex align-items-center justify-content-between mb-2">
            <strong className="text-dark small">{subtype} Subtype Templates (Optional)</strong>
            {activeTemplateId && (
              <span className="badge bg-primary text-white font-mono-code" style={{ fontSize: '0.65rem' }}>
                Template Active
              </span>
            )}
          </div>
          <div className="row g-2">
            <div className="col-md-6">
              <select
                className="form-select form-select-sm bg-white text-dark border-secondary-subtle"
                value={publicTemplates.some((t) => t.id === activeTemplateId) ? activeTemplateId : ''}
                onChange={(e) => handleSelectSubtypeTemplate(subtype, e.target.value)}
              >
                <option value="">-- Public {subtype} Templates --</option>
                {publicTemplates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="col-md-6">
              <select
                className="form-select form-select-sm bg-white text-dark border-secondary-subtle"
                value={orgTemplates.some((t) => t.id === activeTemplateId) ? activeTemplateId : ''}
                onChange={(e) => handleSelectSubtypeTemplate(subtype, e.target.value)}
              >
                <option value="">-- Organization Templates --</option>
                {orgTemplates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Standard Docs */}
        <div className="d-flex flex-column gap-2">
          <strong className="text-dark small">Required {subtype} Documents</strong>
          {standardDocs.map((doc) => {
            const isEnabled = Boolean(docToggles[doc.id]);
            return (
              <div key={doc.id} className="p-2.5 border rounded-2 bg-white d-flex align-items-start justify-content-between gap-2">
                <div className="d-flex align-items-start gap-2.5 flex-grow-1">
                  <div className="form-check form-switch m-0 mt-0.5">
                    <input
                      className="form-check-input cursor-pointer"
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => handleToggleStandardDoc(doc.id)}
                      id={`modal-toggle-${doc.id}`}
                    />
                  </div>
                  <div>
                    <label htmlFor={`modal-toggle-${doc.id}`} className="fw-bold text-dark small mb-0 d-block cursor-pointer">
                      {doc.title}
                    </label>
                    <div className="text-secondary small" style={{ fontSize: '0.78rem' }}>
                      {doc.description}
                    </div>
                  </div>
                </div>
                <span className={`badge font-mono-code ${isEnabled ? 'bg-success-subtle text-success' : 'bg-light text-secondary border'}`}>
                  {isEnabled ? 'Required' : 'Off'}
                </span>
              </div>
            );
          })}
        </div>

        {/* Specialized Doc Input (Optional) */}
        <div className="p-3 border rounded-3 bg-light-subtle">
          <div className="d-flex align-items-center justify-content-between mb-1.5">
            <strong className="text-dark small">Add Specialized {subtype} Document <span className="text-muted fw-normal">(Optional)</span></strong>
            <span className="badge bg-secondary-subtle text-secondary border font-mono-code" style={{ fontSize: '0.65rem' }}>
              Optional
            </span>
          </div>
          <div className="text-muted small mb-2" style={{ fontSize: '0.78rem' }}>
            Optional: Specify any custom or project-specific document requirements if additional evidence is required.
          </div>
          <div className="row g-2">
            <div className="col-md-7">
              <input
                type="text"
                className="form-control form-control-sm bg-white text-dark"
                placeholder="Specialized Document Title (Optional unless adding)"
                value={specInput.title}
                onChange={(e) => setSpecializedInputs((p) => ({ ...p, [subtype]: { ...p[subtype], title: e.target.value } }))}
              />
            </div>
            <div className="col-md-5">
              <select
                className="form-select form-select-sm bg-white text-dark"
                value={specInput.category}
                onChange={(e) => setSpecializedInputs((p) => ({ ...p, [subtype]: { ...p[subtype], category: e.target.value as AssuranceRequirementCategory } }))}
              >
                {(SUBTYPE_CATEGORIES[subtype] || []).map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="col-12">
              <input
                type="text"
                className="form-control form-control-sm bg-white text-dark"
                placeholder="Operational document description / reason..."
                value={specInput.description}
                onChange={(e) => setSpecializedInputs((p) => ({ ...p, [subtype]: { ...p[subtype], description: e.target.value } }))}
              />
            </div>
            <div className="col-12 d-flex justify-content-end">
              <button
                type="button"
                className="btn btn-sm btn-primary text-white"
                onClick={() => handleAddSpecializedDoc(subtype)}
              >
                + Add Specialized Document
              </button>
            </div>
          </div>

          {specializedList.length > 0 && (
            <div className="mt-2 pt-2 border-top d-flex flex-column gap-1.5">
              {specializedList.map((spec) => (
                <div key={spec.id} className="p-2 bg-white border rounded d-flex align-items-center justify-content-between">
                  <div className="small">
                    <strong>{spec.title}</strong> &mdash; <span className="text-muted">{spec.description}</span>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <button
                      type="button"
                      className={`btn btn-xs py-0 px-1.5 ${spec.isEnabled ? 'btn-outline-success' : 'btn-outline-secondary'}`}
                      onClick={() => handleToggleSpecializedDoc(spec.id)}
                    >
                      {spec.isEnabled ? 'Active' : 'Disabled'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-xs btn-outline-danger py-0 px-1.5 text-danger"
                      onClick={() => handleRemoveSpecializedDoc(spec.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const currentStepData = steps[currentStep - 1] || steps[0];

  return (
    <div
      className="modal show d-block map-modal-backdrop"
      tabIndex={-1}
      style={{ zIndex: 1050, backgroundColor: 'rgba(15, 23, 42, 0.45)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-dialog modal-dialog-centered modal-xl modal-dialog-scrollable">
        <div className="modal-content bg-white text-dark border shadow-lg rounded-3 overflow-hidden">
          {/* Header */}
          <div className="modal-header border-bottom bg-light px-4 py-3 d-flex align-items-center justify-content-between">
            <div>
              <h5 className="modal-title fw-bold text-slate-900 m-0 fs-6">
                Create Assurance Set
              </h5>
              <div className="text-secondary small">
                Segmented assurance set creation across asset scopes and required documents
              </div>
            </div>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
          </div>

          {/* Step Progress Header */}
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
              />
            </div>
          </div>

          {/* Modal Body */}
          <div className="modal-body p-4" style={{ maxHeight: '68vh', overflowY: 'auto' }}>
            {errorMessage && (
              <div className="alert alert-danger py-2 small mb-3">{errorMessage}</div>
            )}

            {/* STEP 1: Scope & General Information */}
            {currentStep === 1 && (
              <div className="d-flex flex-column gap-3">
                <div className="row g-3">
                  <div className="col-md-8">
                    <label className="form-label text-secondary small fw-semibold">
                      Assurance Set Name / Title <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control bg-white text-dark"
                      placeholder="e.g. Chevron Gorgon Charter Vetting 2026"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                    />
                  </div>

                  <div className="col-md-4">
                    <label className="form-label text-secondary small fw-semibold">
                      Assurance Scope <span className="text-danger">*</span>
                    </label>
                    <select
                      className="form-select bg-white text-dark"
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
                </div>

                {/* Template Privacy & Distribution Scope */}
                <div className="border rounded-3 p-3 bg-light-subtle">
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <strong className="text-dark small">Template Privacy &amp; Distribution Scope</strong>
                    <span className="badge bg-light text-dark border font-mono-code" style={{ fontSize: '0.675rem' }}>
                      {templatePrivacy === 'public' ? 'Public Template' : 'Organization Only'}
                    </span>
                  </div>
                  <div className="row g-2">
                    <div className="col-12 col-md-6">
                      <label
                        className={`d-block p-2.5 border rounded cursor-pointer h-100 ${templatePrivacy === 'organization' ? 'border-primary bg-primary-subtle' : 'bg-white'
                          }`}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="d-flex align-items-start gap-2">
                          <input
                            type="radio"
                            name="modal-template-privacy"
                            value="organization"
                            checked={templatePrivacy === 'organization'}
                            onChange={() => setTemplatePrivacy('organization')}
                            className="form-check-input mt-0.5 cursor-pointer"
                          />
                          <div>
                            <strong className="text-dark small d-block">Organization Only (Private)</strong>
                            <span className="text-secondary small" style={{ fontSize: '0.75rem' }}>
                              Available only for members of your organization to use as a template.
                            </span>
                          </div>
                        </div>
                      </label>
                    </div>

                    <div className="col-12 col-md-6">
                      <label
                        className={`d-block p-2.5 border rounded cursor-pointer h-100 ${templatePrivacy === 'public' ? 'border-primary bg-primary-subtle' : 'bg-white'
                          }`}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="d-flex align-items-start gap-2">
                          <input
                            type="radio"
                            name="modal-template-privacy"
                            value="public"
                            checked={templatePrivacy === 'public'}
                            onChange={() => setTemplatePrivacy('public')}
                            className="form-check-input mt-0.5 cursor-pointer"
                          />
                          <div>
                            <strong className="text-dark small d-block">Public Standard (Shared)</strong>
                            <span className="text-secondary small" style={{ fontSize: '0.75rem' }}>
                              Published for any platform organization to use as an industry baseline.
                            </span>
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Collapsible General Info */}
                <div className="border rounded-3 p-3 bg-light-subtle">
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <strong className="text-dark small">General Information &amp; Parameters</strong>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary py-0 px-2"
                      style={{ fontSize: '0.75rem' }}
                      onClick={() => setIsGeneralInfoExpanded(!isGeneralInfoExpanded)}
                    >
                      {isGeneralInfoExpanded ? 'Hide' : 'Show'} Details
                    </button>
                  </div>

                  {isGeneralInfoExpanded && (
                    <div className="row g-3 mt-1">
                      <div className="col-md-6">
                        <label className="form-label text-secondary small fw-semibold">Target Vessel / Asset</label>
                        <select
                          className="form-select form-select-sm bg-white text-dark"
                          value={vesselId}
                          onChange={(e) => setVesselId(e.target.value)}
                        >
                          {availableVessels.map((v) => (
                            <option key={v.id} value={v.id}>{v.name} (IMO: {v.imoNumber})</option>
                          ))}
                        </select>
                      </div>

                      <div className="col-md-6">
                        <label className="form-label text-secondary small fw-semibold">Charterer Organization</label>
                        <input
                          type="text"
                          className="form-control form-control-sm bg-white text-dark"
                          value={charterer}
                          onChange={(e) => setCharterer(e.target.value)}
                        />
                      </div>

                      <div className="col-md-6">
                        <label className="form-label text-secondary small fw-semibold">Charter Start Date</label>
                        <input
                          type="date"
                          className="form-control form-control-sm bg-white text-dark font-mono-code"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                        />
                      </div>

                      <div className="col-md-6">
                        <label className="form-label text-secondary small fw-semibold">Charter End Date</label>
                        <input
                          type="date"
                          className="form-control form-control-sm bg-white text-dark font-mono-code"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                        />
                      </div>

                      <div className="col-12">
                        <div className="d-flex flex-wrap gap-3 p-2 bg-white border rounded">
                          <div className="form-check form-switch m-0">
                            <input
                              className="form-check-input cursor-pointer"
                              type="checkbox"
                              checked={verificationRequired}
                              onChange={(e) => setVerificationRequired(e.target.checked)}
                              id="modal-wf-v"
                            />
                            <label htmlFor="modal-wf-v" className="form-check-label text-dark small cursor-pointer">
                              Verification Required
                            </label>
                          </div>

                          <div className="form-check form-switch m-0">
                            <input
                              className="form-check-input cursor-pointer"
                              type="checkbox"
                              checked={inspectionRequired}
                              onChange={(e) => setInspectionRequired(e.target.checked)}
                              id="modal-wf-i"
                            />
                            <label htmlFor="modal-wf-i" className="form-check-label text-dark small cursor-pointer">
                              Inspection Required
                            </label>
                          </div>

                          <div className="form-check form-switch m-0">
                            <input
                              className="form-check-input cursor-pointer"
                              type="checkbox"
                              checked={approvalRequired}
                              onChange={(e) => setApprovalRequired(e.target.checked)}
                              id="modal-wf-a"
                            />
                            <label htmlFor="modal-wf-a" className="form-check-label text-dark small cursor-pointer">
                              Approval Required
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* DYNAMIC SUBTYPE STEP */}
            {currentStepData.subtype && renderSubtypeSection(currentStepData.subtype)}

            {/* REVIEW STEP */}
            {currentStepData.id === 'step-review' && (
              <div className="d-flex flex-column gap-3">
                <div className="p-3 bg-light border rounded-3">
                  <strong className="text-dark small d-block mb-1">Campaign Overview</strong>
                  <div className="fw-bold text-primary fs-6">{title}</div>
                  <div className="text-secondary small mt-1">
                    Scope: <strong>{assuranceType}</strong> &nbsp;|&nbsp; Target: <strong>{selectedVessel?.name}</strong> &nbsp;|&nbsp; Dates: {startDate} to {endDate}
                  </div>
                  <div className="text-secondary small mt-1 d-flex align-items-center gap-2">
                    <span>Privacy:</span>
                    <span className={`badge ${templatePrivacy === 'public' ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-secondary-subtle text-dark border'} font-mono-code`} style={{ fontSize: '0.675rem' }}>
                      {templatePrivacy === 'public' ? 'Public Standard (Shared)' : 'Organization Only (Private)'}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-white border rounded-3">
                  <strong className="text-dark small d-block mb-2">Subtype Requirements</strong>
                  <div className="row g-2">
                    {(assuranceType === 'Project' ? (['Vessel', 'Crew', 'Activity', 'Equipment'] as AssuranceSubtype[]) : [assuranceType as AssuranceSubtype]).map((sub) => {
                      const stdCount = SUBTYPE_STANDARD_DOCS[sub].filter((d) => docToggles[d.id]).length;
                      const specCount = specializedDocs.filter((d) => d.subtype === sub && d.isEnabled).length;
                      return (
                        <div key={sub} className="col-6 col-md-3">
                          <div className="p-2 border rounded bg-light-subtle text-center">
                            <div className="fw-bold text-dark small">{sub}</div>
                            <div className="text-primary font-mono-code small">{stdCount + specCount} Docs</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Navigation */}
          <div className="modal-footer border-top bg-light px-4 py-2.5 d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div className="d-flex align-items-center gap-2">
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={handleCancelClick}>
                Cancel
              </button>
              <button type="button" className="btn btn-outline-secondary btn-sm fw-semibold" onClick={handleSaveDraft}>
                Save as Draft
              </button>
            </div>
            <div className="d-flex align-items-center gap-2">
              {currentStep > 1 && (
                <button type="button" className="btn btn-outline-primary btn-sm fw-semibold" onClick={handlePrevious}>
                  &larr; Previous
                </button>
              )}
              {currentStep < totalSteps ? (
                <button type="button" className="btn btn-primary btn-sm text-white fw-semibold" onClick={handleNext}>
                  Next &rarr;
                </button>
              ) : (
                <button type="button" className="btn btn-primary btn-sm text-white fw-semibold" onClick={handleSubmit}>
                  Initiate Assurance Set
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Cancel Draft Confirmation Dialog for Modal */}
      {showCancelPrompt && (
        <div
          className="modal fade show d-block"
          tabIndex={-1}
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)', zIndex: 1060 }}
        >
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '420px' }}>
            <div className="modal-content shadow-lg border-0 rounded-3">
              <div className="modal-header border-bottom px-3 py-2.5 bg-light">
                <h6 className="modal-title fw-bold text-dark m-0">Exit Campaign Wizard</h6>
                <button
                  type="button"
                  className="btn-close btn-sm"
                  onClick={() => setShowCancelPrompt(false)}
                  aria-label="Close"
                />
              </div>
              <div className="modal-body px-3 py-3">
                <p className="text-secondary small mb-2" style={{ fontSize: '0.85rem' }}>
                  Save your progress as a draft to resume later or discard changes?
                </p>
                <div className="p-2 bg-light rounded border small">
                  <div className="fw-semibold text-dark">{title || 'Draft Campaign'}</div>
                  <div className="text-muted mt-0.5">{assuranceType} &middot; {selectedVessel?.name || 'Vessel'}</div>
                </div>
              </div>
              <div className="modal-footer border-top bg-light px-3 py-2 d-flex align-items-center justify-content-between">
                <button
                  type="button"
                  className="btn btn-outline-danger btn-sm"
                  onClick={handleConfirmExitWithoutSaving}
                >
                  Discard
                </button>
                <div className="d-flex align-items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-light border btn-sm"
                    onClick={() => setShowCancelPrompt(false)}
                  >
                    Keep Editing
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm text-white fw-semibold"
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
    </div>
  );
};
