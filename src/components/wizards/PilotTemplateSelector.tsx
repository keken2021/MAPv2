import React from 'react';
import { PILOT_SS_TEMPLATES, SubtypeTemplate } from '../../utils/assuranceTemplates';
import { Layers, CheckCircle2 } from 'lucide-react';

interface PilotTemplateSelectorProps {
  selectedTemplateId: string;
  onSelectTemplate: (templateId: string) => void;
  templates?: SubtypeTemplate[];
}

export const PilotTemplateSelector: React.FC<PilotTemplateSelectorProps> = ({
  selectedTemplateId,
  onSelectTemplate,
  templates = PILOT_SS_TEMPLATES,
}) => {
  const activeTemplate = templates.find((t) => t.id === selectedTemplateId);

  return (
    <div className="card border shadow-2xs rounded-3 bg-white" data-testid="step1-pilot-templates">
      <div className="card-header bg-light border-bottom px-4 py-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
        <div className="d-flex align-items-center gap-2">
          <Layers className="w-4 h-4 text-primary" aria-hidden="true" />
          <h5 className="fw-bold text-slate-900 m-0 fs-6">
            Starting Template
          </h5>
        </div>
        <div className="d-flex align-items-center gap-2">
          <label className="form-label text-secondary small fw-semibold m-0" htmlFor="grid-starting-template">
            Quick Select:
          </label>
          <select
            id="grid-starting-template"
            aria-label="Starting Template"
            className="form-select form-select-sm bg-white text-dark border-secondary-subtle"
            style={{ minWidth: '240px' }}
            value={selectedTemplateId}
            onChange={(e) => onSelectTemplate(e.target.value)}
          >
            <option value="">Select a starting template...</option>
            {templates.map((tmpl) => (
              <option key={tmpl.id} value={tmpl.id}>
                {tmpl.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="card-body p-4">
        <div className="text-muted small mb-3">
          Select one of the five standard pilot templates (SS-01 to SS-05) to pre-populate the set title, scope, and Step 3 requirements.
        </div>
        <div className="row g-3">
          {templates.map((tmpl) => {
            const isSelected = selectedTemplateId === tmpl.id;
            const reqCount = (tmpl.recommendedDocIds?.length || 0) + (tmpl.customRequirements?.length || 0);
            return (
              <div key={tmpl.id} className="col-12 col-md-6 col-xl-4">
                <button
                  type="button"
                  data-testid={`pilot-template-${tmpl.id}`}
                  aria-pressed={isSelected}
                  onClick={() => onSelectTemplate(isSelected ? '' : tmpl.id)}
                  className={`w-100 text-start p-3 rounded-3 border transition-all d-flex flex-column justify-content-between h-100 ${
                    isSelected
                      ? 'border-primary bg-primary bg-opacity-10 shadow-2xs'
                      : 'border-secondary-subtle bg-white'
                  }`}
                >
                  <div>
                    <div className="d-flex align-items-center justify-content-between gap-2 mb-1">
                      <span className="fw-semibold text-slate-900 small">{tmpl.name}</span>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" aria-hidden="true" />}
                    </div>
                    <p className="text-secondary small mb-2" style={{ fontSize: '0.78rem' }}>
                      {tmpl.description}
                    </p>
                  </div>
                  <div className="d-flex align-items-center justify-content-between gap-2 pt-2 border-top border-secondary-subtle mt-auto">
                    <span className="badge bg-light text-dark border font-mono-code" style={{ fontSize: '0.7rem' }}>
                      Scope: {tmpl.subtype}
                    </span>
                    <span className="text-secondary small" style={{ fontSize: '0.75rem' }}>
                      {reqCount} {reqCount === 1 ? 'requirement' : 'requirements'}
                    </span>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
        {activeTemplate && (
          <div className="mt-3 pt-3 border-top d-flex align-items-center justify-content-between flex-wrap gap-2" data-testid="pilot-template-active-summary">
            <span className="small text-slate-700">
              Active template: <strong className="text-slate-900">{activeTemplate.name}</strong> ({activeTemplate.subtype} scope)
            </span>
            <button
              type="button"
              className="btn btn-sm btn-link text-secondary text-decoration-none p-0 small"
              onClick={() => onSelectTemplate('')}
            >
              Clear template
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
