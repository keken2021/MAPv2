/*
  file summary: Contract chain fields component for Organizations & Contract Chain modal.
  responsibilities: Renders the project's client as read-only text, and head contractor and vendor as clearable text inputs with datalist autocomplete.
  role in system: Consumed by EditParticipatingOrganizationsModal.tsx (Map Design System §12).
*/

import React from 'react';
import { X } from 'lucide-react';

export interface ContractChainFieldsProps {
  client: string;
  headContractor: string;
  vendor: string;
  onHeadContractorChange: (value: string) => void;
  onVendorChange: (value: string) => void;
  listId?: string;
}

export const ContractChainFields: React.FC<ContractChainFieldsProps> = ({
  client,
  headContractor,
  vendor,
  onHeadContractorChange,
  onVendorChange,
  listId = 'known-org-list',
}) => {
  return (
    <div className="card border mb-3" data-testid="contract-chain-fields">
      <div className="card-header bg-light py-2 px-3">
        <span className="fw-semibold text-dark small">Contract Chain</span>
      </div>
      <div className="card-body p-3">
        <div className="row g-3">
          <div className="col-12 col-md-4">
            <label className="form-label text-secondary small fw-medium mb-1">
              Client
            </label>
            <div
              className="form-control-plaintext form-control-sm fw-semibold text-dark py-1"
              data-testid="contract-chain-client-display"
            >
              {client || 'None'}
            </div>
          </div>

          <div className="col-12 col-md-4">
            <label
              className="form-label text-secondary small fw-medium mb-1"
              htmlFor="input-head-contractor"
            >
              Head contractor
            </label>
            <div className="position-relative">
              <input
                id="input-head-contractor"
                type="text"
                className="form-control form-control-sm pe-4"
                list={listId}
                placeholder="e.g. Northwind Marine"
                value={headContractor}
                onChange={(e) => onHeadContractorChange(e.target.value)}
                data-testid="input-head-contractor"
              />
              {headContractor && (
                <button
                  type="button"
                  className="btn btn-link btn-sm position-absolute top-50 translate-middle-y text-muted p-0"
                  style={{ right: '8px', textDecoration: 'none' }}
                  onClick={() => onHeadContractorChange('')}
                  aria-label="Clear head contractor"
                  title="Clear head contractor"
                  data-testid="btn-clear-head-contractor"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          <div className="col-12 col-md-4">
            <label
              className="form-label text-secondary small fw-medium mb-1"
              htmlFor="input-vendor"
            >
              Vendor
            </label>
            <div className="position-relative">
              <input
                id="input-vendor"
                type="text"
                className="form-control form-control-sm pe-4"
                list={listId}
                placeholder="e.g. Meridian Shipyards"
                value={vendor}
                onChange={(e) => onVendorChange(e.target.value)}
                data-testid="input-vendor"
              />
              {vendor && (
                <button
                  type="button"
                  className="btn btn-link btn-sm position-absolute top-50 translate-middle-y text-muted p-0"
                  style={{ right: '8px', textDecoration: 'none' }}
                  onClick={() => onVendorChange('')}
                  aria-label="Clear vendor"
                  title="Clear vendor"
                  data-testid="btn-clear-vendor"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

