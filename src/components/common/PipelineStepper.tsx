/* 
  file summary: pipeline stepper component presenting assurance set lifecycle stage progression.
  responsibilities: renders visual steppers for stages: initiated, validation, verification, inspection, approval, certified.
  role in system: header stepper for assurance detail view and command center.
*/

import { AssuranceSet, AssuranceStage } from '../../types/assurance';
import { Check } from 'lucide-react';

interface PipelineStepperProps {
  currentStage: AssuranceStage;
  readinessScore?: number;
  onStageSelect?: (stage: AssuranceStage) => void;
  orientation?: 'horizontal' | 'vertical';
  assuranceSet?: Partial<AssuranceSet>;
  workflowConfig?: {
    verificationRequired?: boolean;
    mandatoryInspectionRequired?: boolean;
    formalApprovalRequired?: boolean;
  };
}

/**
  what: renders visual progress stepper for assurance pipeline lifecycle stages dynamically tailored to workflow policy requirements.
  how: checks verification, visual inspection, and formal approval configuration flags to construct dynamic steps:
       1. initiated
       2. validation
       3. verification (included if verification required)
       4. visual inspection (included if inspection required)
       5. approval / certified (included if formal approval required)
  with what file: src/components/common/PipelineStepper.tsx used by AssuranceDetailView.tsx and dashboard.
*/
export const PipelineStepper: React.FC<PipelineStepperProps> = ({
  currentStage,
  readinessScore,
  onStageSelect,
  orientation = 'horizontal',
  assuranceSet,
  workflowConfig,
}) => {
  const hasUploadedDocs =
    assuranceSet?.requirements && assuranceSet.requirements.length > 0
      ? assuranceSet.requirements.some((r) => Boolean(r.documentId || r.linkedDocumentId || r.isFulfilled))
      : true;

  const isFullyApproved =
    hasUploadedDocs &&
    ((readinessScore !== undefined && readinessScore >= 100) ||
      currentStage === 'Approved' ||
      currentStage === 'Certified');

  /* resolve workflow requirements based on passed props and assurance set properties */
  const isVerificationRequired =
    workflowConfig?.verificationRequired !== undefined
      ? workflowConfig.verificationRequired
      : assuranceSet?.verificationRequired !== undefined
        ? assuranceSet.verificationRequired
        : Boolean(assuranceSet?.assignedVerifier || true);

  const isInspectionRequired =
    workflowConfig?.mandatoryInspectionRequired !== undefined
      ? workflowConfig.mandatoryInspectionRequired
      : assuranceSet?.mandatoryInspectionRequired !== undefined
        ? assuranceSet.mandatoryInspectionRequired
        : false;

  const isApprovalRequired =
    workflowConfig?.formalApprovalRequired !== undefined
      ? workflowConfig.formalApprovalRequired
      : assuranceSet?.formalApprovalRequired !== undefined
        ? assuranceSet.formalApprovalRequired
        : Boolean(assuranceSet?.assignedApprover || true);

  /* build dynamic workflow stages */
  const stages: { stage: AssuranceStage; label: string; num: number }[] = [];
  let stepNum = 1;

  stages.push({ stage: 'Initiated', label: 'Initiated', num: stepNum++ });
  stages.push({ stage: 'Validation', label: 'Validation', num: stepNum++ });

  if (isVerificationRequired) {
    stages.push({ stage: 'Verification', label: 'Verification', num: stepNum++ });
  }

  if (isInspectionRequired) {
    stages.push({ stage: 'Inspection', label: 'Inspection', num: stepNum++ });
  }

  if (isApprovalRequired) {
    stages.push({
      stage: 'Approval',
      label: isFullyApproved ? 'Approved' : 'Approval',
      num: stepNum++,
    });
  } else {
    stages.push({
      stage: 'Certified',
      label: 'Certified',
      num: stepNum++,
    });
  }

  const getStageIndex = (stage: AssuranceStage): number => {
    if (isFullyApproved) return stages.length;

    /* direct match in dynamic stages array */
    const directIdx = stages.findIndex((s) => s.stage === stage);
    if (directIdx >= 0) return directIdx;

    /* fallback aliases for approval/certified/approved */
    if (stage === 'Approved' || stage === 'Certified') {
      return stages.length - 1;
    }
    if (stage === 'Approval') {
      const appIdx = stages.findIndex((s) => s.stage === 'Approval' || s.stage === 'Certified');
      if (appIdx >= 0) return appIdx;
    }
    if (stage === 'Inspection') {
      const insIdx = stages.findIndex((s) => s.stage === 'Inspection');
      if (insIdx >= 0) return insIdx;
      const appIdx = stages.findIndex((s) => s.stage === 'Approval' || s.stage === 'Certified');
      if (appIdx >= 0) return appIdx;
    }
    if (stage === 'Verification') {
      const verIdx = stages.findIndex((s) => s.stage === 'Verification');
      if (verIdx >= 0) return verIdx;
    }

    return 0;
  };

  const currentIdx = getStageIndex(currentStage);

  if (orientation === 'vertical') {
    return (
      <div className="d-flex flex-column gap-2 py-1">
        {stages.map((s, idx) => {
          const isCompleted = isFullyApproved || idx < currentIdx;
          const isActive = !isFullyApproved && idx === currentIdx;

          return (
            <div
              key={s.stage}
              className={`d-flex align-items-center gap-3 p-2 rounded-2 transition-all ${isActive
                ? 'bg-primary-subtle text-primary fw-bold border border-primary-subtle'
                : isCompleted
                  ? 'text-success'
                  : 'text-secondary opacity-75'
                }`}
              onClick={() => onStageSelect && onStageSelect(s.stage)}
              style={{ cursor: onStageSelect ? 'pointer' : 'default', fontSize: '0.8rem' }}
            >
              <div
                className={`d-flex align-items-center justify-content-center rounded-circle font-mono-code fw-bold flex-shrink-0 ${isCompleted
                  ? 'bg-success text-white'
                  : isActive
                    ? 'bg-primary text-white shadow-2xs'
                    : 'bg-light text-secondary border'
                  }`}
                style={{ width: '24px', height: '24px', fontSize: '0.7rem' }}
              >
                {isCompleted ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : s.num}
              </div>
              <span className="font-mono-code ms-1.5" style={{ fontSize: '0.775rem' }}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="map-stepper-container">
      {stages.map((s, idx) => {
        const isCompleted = isFullyApproved || idx < currentIdx;
        const isActive = !isFullyApproved && idx === currentIdx;

        return (
          <div
            key={s.stage}
            className={`map-stepper-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
            onClick={() => onStageSelect && onStageSelect(s.stage)}
            style={{ cursor: onStageSelect ? 'pointer' : 'default' }}
          >
            <div className="map-stepper-number">
              {isCompleted ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : s.num}
            </div>
            <span className="d-none d-md-inline">{s.label}</span>
          </div>
        );
      })}
    </div>
  );
};
