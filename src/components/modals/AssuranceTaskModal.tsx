import React from 'react';
import { Modal } from './Modal';
import { AssuranceRequirement, AssuranceSet } from '../../types/assurance';
import { formatMaritimeDate, toSentenceCase } from '../../utils/formatters';

type TaskDraft = {
  title: string;
  category: string;
  description: string;
  isMandatory: boolean;
  targetDate: string;
  assignedSubmitter: string;
  assignedVerifier: string;
  sectionId: string;
  predecessorId: string;
};

const STANDARD_CATEGORIES = [
  'Statutory Certificate',
  'Class Notation Certificate',
  'Flag Administration Registry',
  'Environmental Certificate',
  'Safety & Lifesaving Equipment',
  'Crew Credential',
  'Operational Plan',
  'Inspection Report',
  'Equipment Register',
  'Custom Requirement',
];

interface AddProps {
  mode: 'add';
  draft: TaskDraft;
  onDraftChange: (draft: TaskDraft) => void;
  onSave: () => void;
  error: string | null;
}

interface EditProps {
  mode: 'edit';
  editingTask: AssuranceRequirement;
  draft: TaskDraft;
  onDraftChange: (draft: TaskDraft) => void;
  onSave: () => void;
  error: string | null;
}

interface DateProps {
  mode: 'date';
  editingTaskDate: { reqId: string; title: string; currentDate: string };
  dateDraft: string;
  dateReasonDraft: string;
  dateError: string | null;
  onDateDraftChange: (val: string) => void;
  onDateReasonChange: (val: string) => void;
  onSave: () => void;
}

type AssuranceTaskModalProps = {
  isOpen: boolean;
  onClose: () => void;
  assuranceSet: AssuranceSet;
} & (AddProps | EditProps | DateProps);

export const AssuranceTaskModal: React.FC<AssuranceTaskModalProps> = (props) => {
  const { isOpen, onClose, assuranceSet } = props;

  if (props.mode === 'date') {
    const { editingTaskDate, dateDraft, dateReasonDraft, dateError, onDateDraftChange, onDateReasonChange, onSave } = props;
    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Edit Task Target Date"
        footer={
          <>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn btn-sm btn-primary" onClick={onSave}>
              Save Target Date
            </button>
          </>
        }
      >
        <div className="d-flex flex-column gap-3">
          <div>
            <label className="form-label text-secondary small fw-semibold">Task</label>
            <div className="fw-semibold text-dark">{editingTaskDate.title}</div>
            <div className="text-muted small">ID: {editingTaskDate.reqId}</div>
          </div>
          <div>
            <label className="form-label text-secondary small fw-semibold" htmlFor="task-target-date-input">
              Target Date <span className="text-danger">*</span>
            </label>
            <input
              id="task-target-date-input"
              type="date"
              className={`form-control bg-white text-dark${dateError ? ' is-invalid border-danger' : ''}`}
              value={dateDraft}
              max={assuranceSet.targetDate || assuranceSet.complianceDeadline || undefined}
              onChange={(e) => { onDateDraftChange(e.target.value); }}
            />
            <div className="form-text">
              Must fall on or before the set target date ({formatMaritimeDate(assuranceSet.targetDate || assuranceSet.complianceDeadline)}).
            </div>
            {dateError && (
              <div className="invalid-feedback d-block small mt-1">{dateError}</div>
            )}
          </div>
          <div>
            <label className="form-label text-secondary small fw-semibold" htmlFor="task-date-reason-input">
              Reason for Change <span className="text-muted fw-normal">(optional)</span>
            </label>
            <input
              id="task-date-reason-input"
              type="text"
              className="form-control bg-white text-dark"
              placeholder="e.g. Schedule adjustment"
              value={dateReasonDraft}
              onChange={(e) => onDateReasonChange(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    );
  }

  const { draft, onDraftChange, onSave, error } = props;
  const isAdd = props.mode === 'add';
  const editingTask = !isAdd ? (props as EditProps).editingTask : null;

  const idPrefix = isAdd ? 'add' : 'edit';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isAdd ? 'Add Task' : 'Edit Task'}
      meta={!isAdd && editingTask ? `ID: ${editingTask.id}` : undefined}
      footer={
        <>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-sm btn-primary" onClick={onSave}>
            {isAdd ? 'Add Task' : 'Save Changes'}
          </button>
        </>
      }
    >
      <div className="d-flex flex-column gap-3">
        {error && (
          <div className="alert alert-danger py-2 mb-0 small">{error}</div>
        )}
        <div>
          <label className="form-label text-secondary small fw-semibold" htmlFor={`${idPrefix}-task-title-input`}>
            Title <span className="text-danger">*</span>
          </label>
          <input
            id={`${idPrefix}-task-title-input`}
            type="text"
            className="form-control form-control-sm bg-white text-dark"
            placeholder={isAdd ? 'e.g. Field mooring arrangement' : undefined}
            value={draft.title}
            onChange={(e) => {
              onDraftChange({ ...draft, title: e.target.value });
            }}
          />
        </div>
        <div>
          <label className="form-label text-secondary small fw-semibold" htmlFor={`${idPrefix}-task-category`}>
            Category <span className="text-danger">*</span>
          </label>
          <select
            id={`${idPrefix}-task-category`}
            className="form-select form-select-sm bg-white text-dark"
            value={draft.category}
            onChange={(e) => onDraftChange({ ...draft, category: e.target.value })}
          >
            {STANDARD_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
            {!isAdd && !STANDARD_CATEGORIES.includes(draft.category) && (
              <option value={draft.category}>{draft.category}</option>
            )}
          </select>
        </div>
        {assuranceSet.sections && assuranceSet.sections.length > 0 && (
          <div>
            <label className="form-label text-secondary small fw-semibold" htmlFor={`${idPrefix}-task-section`}>
              Section <span className="text-muted fw-normal">(optional)</span>
            </label>
            <select
              id={`${idPrefix}-task-section`}
              className="form-select form-select-sm bg-white text-dark"
              value={draft.sectionId}
              onChange={(e) => onDraftChange({ ...draft, sectionId: e.target.value })}
            >
              <option value="">No section</option>
              {assuranceSet.sections.filter((sec) => Boolean(sec.name?.trim())).map((sec) => (
                <option key={sec.id} value={sec.id}>{toSentenceCase(sec.name)}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="form-label text-secondary small fw-semibold" htmlFor={`${idPrefix}-task-predecessor`}>
            Predecessor <span className="text-muted fw-normal">(optional)</span>
          </label>
          <select
            id={`${idPrefix}-task-predecessor`}
            className="form-select form-select-sm bg-white text-dark"
            value={draft.predecessorId}
            onChange={(e) => onDraftChange({ ...draft, predecessorId: e.target.value })}
          >
            <option value="">No predecessor</option>
            {assuranceSet.requirements
              .filter((req) => !editingTask || req.id !== editingTask.id)
              .map((req) => (
                <option key={req.id} value={req.id}>{req.title}</option>
              ))}
          </select>
        </div>
        <div>
          <label className="form-label text-secondary small fw-semibold" htmlFor={`${idPrefix}-task-target-date`}>
            Target Date <span className="text-muted fw-normal">(optional)</span>
          </label>
          <input
            id={`${idPrefix}-task-target-date`}
            type="date"
            className="form-control form-control-sm bg-white text-dark"
            max={assuranceSet.targetDate || assuranceSet.complianceDeadline || undefined}
            value={draft.targetDate}
            onChange={(e) => onDraftChange({ ...draft, targetDate: e.target.value })}
          />
          <div className="form-text" style={{ fontSize: '0.72rem' }}>
            Must fall on or before the set target date ({formatMaritimeDate(assuranceSet.targetDate || assuranceSet.complianceDeadline)}).
          </div>
        </div>
        <div>
          <label className="form-label text-secondary small fw-semibold" htmlFor={`${idPrefix}-task-description`}>
            Description <span className="text-muted fw-normal">(optional)</span>
          </label>
          <textarea
            id={`${idPrefix}-task-description`}
            rows={2}
            className="form-control form-control-sm bg-white text-dark"
            placeholder={isAdd ? 'Notes or instructions for this task...' : undefined}
            value={draft.description}
            onChange={(e) => onDraftChange({ ...draft, description: e.target.value })}
          />
        </div>
        <div className="form-check">
          <input
            id={`${idPrefix}-task-mandatory`}
            type="checkbox"
            className="form-check-input"
            checked={draft.isMandatory}
            onChange={(e) => onDraftChange({ ...draft, isMandatory: e.target.checked })}
          />
          <label className="form-check-label text-secondary small" htmlFor={`${idPrefix}-task-mandatory`}>
            Mandatory requirement
          </label>
        </div>
      </div>
    </Modal>
  );
};
