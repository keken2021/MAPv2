/*
  file summary: equipment registration modal for registering fleet equipment assets.
  responsibilities: captures equipment fields, optional parent vessel, and duplicate check before confirm.
  role in system: invoked from EquipmentView when clicking Register Equipment (FE-2).
*/

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useMapStore } from '../../store/useMapStore';
import { EquipmentAsset, EquipmentCategory } from '../../types/equipment';
import { getDefaultAssetStatus, deriveComplianceStatus } from '../../types/asset';
import { isDuplicateEquipment, generateUniqueEquipmentId } from '../../utils/validation';
import { filterVesselsForPersona } from '../../utils/rbacHelpers';

interface EquipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegistered?: (equipmentId: string) => void;
}

const CATEGORIES: EquipmentCategory[] = [
  'Fire-Fighting Equipment (FFE)',
  'Navigation & Bridge Equipment',
  'Life-Saving Appliances',
  'Machinery & Propulsion',
  'Other',
];

export const EquipmentModal: React.FC<EquipmentModalProps> = ({ isOpen, onClose, onRegistered }) => {
  const { addEquipment, equipment, vessels, assuranceSets, activePersona } = useMapStore();
  const [name, setName] = useState('');
  const [equipmentIdentifier, setEquipmentIdentifier] = useState('');
  const [category, setCategory] = useState<EquipmentCategory>('Fire-Fighting Equipment (FFE)');
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [parentVesselId, setParentVesselId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState('');

  const availableVessels = filterVesselsForPersona(vessels, assuranceSets, activePersona);
  const owningOrganization =
    activePersona === 'C Admin' ? 'Southern Basin Energy' : 'Northwind Marine Pty Ltd';

  if (!isOpen) return null;

  const runDuplicateCheck = (identifier: string) => {
    const result = isDuplicateEquipment(identifier, equipment);
    setDuplicateWarning(result.isDuplicate ? result.reason ?? 'Duplicate identifier.' : '');
    return !result.isDuplicate;
  };

  const handleSubmit = () => {
    setErrorMessage('');
    if (!name.trim()) {
      setErrorMessage('Equipment name is required.');
      return;
    }
    if (!equipmentIdentifier.trim()) {
      setErrorMessage('Equipment identifier is required.');
      return;
    }
    if (!runDuplicateCheck(equipmentIdentifier)) return;

    const statusDefaults = getDefaultAssetStatus();
    const newEquipment: EquipmentAsset = {
      id: generateUniqueEquipmentId(equipment),
      name: name.trim(),
      equipmentIdentifier: equipmentIdentifier.trim().toUpperCase(),
      category,
      manufacturer: manufacturer.trim() || undefined,
      model: model.trim() || undefined,
      serialNumber: serialNumber.trim() || undefined,
      parentVesselId: parentVesselId || undefined,
      owningOrganization,
      complianceReadinessScore: 0,
      ...statusDefaults,
      complianceStatus: deriveComplianceStatus(0),
    };

    const result = addEquipment(newEquipment);
    if (!result.success) {
      setErrorMessage(result.message ?? 'Registration failed.');
      return;
    }

    onRegistered?.(newEquipment.id);
    onClose();
    setName('');
    setEquipmentIdentifier('');
    setManufacturer('');
    setModel('');
    setSerialNumber('');
    setParentVesselId('');
    setDuplicateWarning('');
  };

  return (
    <>
      <div className="modal fade show d-block" tabIndex={-1} role="dialog" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <div className="modal-dialog modal-lg modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header d-flex align-items-center justify-content-between p-3 border-bottom">
              <h5 className="modal-title fw-bold m-0">Register Equipment</h5>
              <button
                type="button"
                className="btn btn-sm btn-icon border-0 bg-transparent text-secondary p-1"
                onClick={onClose}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              {errorMessage && <div className="alert alert-danger py-2 small">{errorMessage}</div>}
              {duplicateWarning && <div className="alert alert-warning py-2 small">{duplicateWarning}</div>}

              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">Equipment Name *</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">Equipment Identifier *</label>
                  <input
                    type="text"
                    className="form-control form-control-sm font-mono-code"
                    value={equipmentIdentifier}
                    onChange={(e) => {
                      setEquipmentIdentifier(e.target.value);
                      if (e.target.value.trim()) runDuplicateCheck(e.target.value);
                      else setDuplicateWarning('');
                    }}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">Category *</label>
                  <select
                    className="form-select form-select-sm"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as EquipmentCategory)}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">Parent Vessel (optional)</label>
                  <select
                    className="form-select form-select-sm"
                    value={parentVesselId}
                    onChange={(e) => setParentVesselId(e.target.value)}
                  >
                    <option value="">— None —</option>
                    {availableVessels.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} (IMO {v.imoNumber})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label small fw-semibold">Manufacturer</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={manufacturer}
                    onChange={(e) => setManufacturer(e.target.value)}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label small fw-semibold">Model</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label small fw-semibold">Serial Number</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary btn-sm fw-semibold" onClick={handleSubmit}>
                Confirm Registration
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
