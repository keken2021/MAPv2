/*
  file summary: object reference picker and per-object duplicate title check fields for document upload workflows.
  responsibilities: enables selecting an assurance object type and specific object instance, toggling upload mode between new document and new version, detecting same-object duplicate titles with a 1-click pivot to versioning, and showing why versioning is blocked under A11 / FR-16.
  role in system: child component rendered inside DocumentUploadModal.tsx.
*/

import React from 'react';
import { AlertCircle, ArrowRight, RefreshCw, FileText } from 'lucide-react';
import type { AssuranceObjectType } from '../../types/assurance';
import type { MasterDocument } from '../../types/document';
import {
  DocumentTargetObject,
  OBJECT_TYPE_LABELS,
  getObjectTypeLabel,
  DuplicateObjectDocumentMatch,
} from '../../utils/documentObjectHelpers';

export interface DocumentObjectReferenceFieldsProps {
  selectedObjectType: AssuranceObjectType | '';
  selectedObjectId: string;
  onSelectObjectType: (type: AssuranceObjectType | '') => void;
  onSelectObjectId: (id: string, obj?: DocumentTargetObject) => void;
  availableObjects: DocumentTargetObject[];
  disabled?: boolean;
  lockObject?: boolean;
  uploadMode: 'new_document' | 'new_version';
  onUploadModeChange?: (mode: 'new_document' | 'new_version') => void;
  allowVersionModeSwitch?: boolean;
  existingTargetDocId?: string;
  onSelectExistingTargetDoc?: (doc: MasterDocument | null) => void;
  candidateDocumentsForVersion: MasterDocument[];
  duplicateMatch: DuplicateObjectDocumentMatch | null;
  onSwitchToVersionDuplicate?: (match: DuplicateObjectDocumentMatch) => void;
  duplicateVersionBlockReason?: string;
}

export const DocumentObjectReferenceFields: React.FC<DocumentObjectReferenceFieldsProps> = ({
  selectedObjectType,
  selectedObjectId,
  onSelectObjectType,
  onSelectObjectId,
  availableObjects,
  disabled = false,
  lockObject = false,
  uploadMode,
  onUploadModeChange,
  allowVersionModeSwitch = false,
  existingTargetDocId,
  onSelectExistingTargetDoc,
  candidateDocumentsForVersion,
  duplicateMatch,
  onSwitchToVersionDuplicate,
  duplicateVersionBlockReason,
}) => {
  const filteredObjects = React.useMemo(() => {
    if (!selectedObjectType) return availableObjects;
    return availableObjects.filter((o) => o.type === selectedObjectType);
  }, [availableObjects, selectedObjectType]);

  return (
    <div className="d-flex flex-column gap-2 mb-2" data-testid="document-object-reference-fields">
      {/* Upload mode toggle when allowed */}
      {allowVersionModeSwitch && onUploadModeChange && (
        <div className="d-flex align-items-center justify-content-between p-2 bg-light border rounded-2 mb-1">
          <span className="small fw-semibold text-secondary">Upload Mode</span>
          <div className="btn-group btn-group-sm" role="group" aria-label="Upload mode">
            <button
              type="button"
              className={`btn btn-xs fw-semibold ${uploadMode === 'new_document' ? 'btn-primary text-white shadow-2xs' : 'btn-outline-secondary bg-white'}`}
              onClick={() => onUploadModeChange('new_document')}
              disabled={disabled}
            >
              <FileText size={12} className="me-1 d-inline" />
              New Document
            </button>
            <button
              type="button"
              className={`btn btn-xs fw-semibold ${uploadMode === 'new_version' ? 'btn-primary text-white shadow-2xs' : 'btn-outline-secondary bg-white'}`}
              onClick={() => onUploadModeChange('new_version')}
              disabled={disabled}
            >
              <RefreshCw size={12} className="me-1 d-inline" />
              Upload New Version
            </button>
          </div>
        </div>
      )}

      {/* Assurance Object Type and Target Object Selector */}
      <div className="row g-2">
        <div className="col-md-5">
          <label className="form-label text-secondary small fw-semibold mb-1" htmlFor="doc-target-type">
            Referenced Object Type <span className="text-danger">*</span>
          </label>
          <select
            id="doc-target-type"
            className="form-select form-select-sm bg-white text-dark border-secondary"
            value={selectedObjectType}
            onChange={(e) => {
              const nextType = e.target.value as AssuranceObjectType | '';
              onSelectObjectType(nextType);
              onSelectObjectId('');
            }}
            disabled={disabled || lockObject}
          >
            <option value="">-- Select Object Type --</option>
            <option value="vessel">{OBJECT_TYPE_LABELS.vessel}</option>
            <option value="person">{OBJECT_TYPE_LABELS.person}</option>
            <option value="equipment">{OBJECT_TYPE_LABELS.equipment}</option>
            <option value="activity">{OBJECT_TYPE_LABELS.activity}</option>
          </select>
        </div>

        <div className="col-md-7">
          <label className="form-label text-secondary small fw-semibold mb-1" htmlFor="doc-target-object">
            Target Object <span className="text-danger">*</span>
          </label>
          <select
            id="doc-target-object"
            className="form-select form-select-sm bg-white text-dark border-secondary"
            value={selectedObjectId}
            onChange={(e) => {
              const val = e.target.value;
              const found = availableObjects.find((o) => o.id === val && (!selectedObjectType || o.type === selectedObjectType));
              onSelectObjectId(val, found);
            }}
            disabled={disabled || lockObject || !selectedObjectType}
          >
            <option value="">
              {!selectedObjectType
                ? '-- Choose Object Type First --'
                : filteredObjects.length === 0
                  ? `-- No ${getObjectTypeLabel(selectedObjectType)} Available --`
                  : `-- Select ${getObjectTypeLabel(selectedObjectType)} (${filteredObjects.length}) --`}
            </option>
            {filteredObjects.map((obj) => (
              <option key={`${obj.type}:${obj.id}`} value={obj.id}>
                {obj.name} {obj.subtitle ? `(${obj.subtitle})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* In Upload New Version mode: existing document to version picker */}
      {uploadMode === 'new_version' && onSelectExistingTargetDoc && (
        <div className="p-2.5 bg-light border border-primary-subtle rounded-3 mt-1">
          <label className="form-label text-secondary small fw-semibold mb-1" htmlFor="version-target-doc-select">
            Select Document to Version <span className="text-danger">*</span>
          </label>
          <select
            id="version-target-doc-select"
            className="form-select form-select-sm bg-white text-dark border-secondary"
            value={existingTargetDocId || ''}
            onChange={(e) => {
              const val = e.target.value;
              const found = candidateDocumentsForVersion.find((d) => d.id === val) || null;
              onSelectExistingTargetDoc(found);
            }}
            disabled={disabled}
          >
            <option value="">
              {candidateDocumentsForVersion.length === 0
                ? '-- No existing documents found on this object --'
                : `-- Select Existing Document (${candidateDocumentsForVersion.length}) --`}
            </option>
            {candidateDocumentsForVersion.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.title} ({doc.certificateNo || doc.id}) · {doc.currentVersion || 'v1.0'}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Duplicate title detection warning with 1-click pivot */}
      {uploadMode === 'new_document' && duplicateMatch && (
        <div
          className="alert alert-warning py-2.5 px-3 mb-1 mt-1 border-warning shadow-2xs"
          role="alert"
          data-testid="duplicate-object-title-error"
        >
          <div className="d-flex align-items-start gap-2">
            <AlertCircle size={16} className="text-warning-emphasis flex-shrink-0 mt-0.5" />
            <div className="flex-grow-1">
              <div className="fw-bold small text-warning-emphasis">
                Duplicate Title on Same Object
              </div>
              <div className="small text-secondary mb-2" style={{ fontSize: '0.78rem' }}>
                A document titled <strong>"{duplicateMatch.title}"</strong> is already recorded for this {selectedObjectType ? getObjectTypeLabel(selectedObjectType).toLowerCase() : 'object'}. Documents sharing the same title on the same object must be uploaded as a new version.
              </div>

              {onSwitchToVersionDuplicate && (
                <div className="d-flex flex-wrap align-items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-xs btn-primary d-inline-flex align-items-center gap-1 font-mono-code fw-semibold"
                    onClick={() => onSwitchToVersionDuplicate(duplicateMatch)}
                    disabled={Boolean(duplicateVersionBlockReason)}
                    title={duplicateVersionBlockReason || 'Switch to Upload New Version of this document'}
                  >
                    <RefreshCw size={12} />
                    <span>Upload New Version Instead</span>
                    <ArrowRight size={12} />
                  </button>
                  {duplicateVersionBlockReason && (
                    <span className="text-muted small fst-italic" style={{ fontSize: '0.72rem' }}>
                      ({duplicateVersionBlockReason})
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

