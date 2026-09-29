/* 
  file summary: modal dialog component for registering new crew members into the organization directory.
  responsibilities: captures full name, rank, nationality, seaman book, passport, and vessel assignment, updating zustand store and audit log.
  role in system: launched by CrewView.tsx or CrewTable.tsx when admin or submitter clicks register crew member.
*/

import React, { useState, useEffect } from 'react';
import { useMapStore } from '../../store/useMapStore';
import { CrewMember, STCWLayer } from '../../types/crew';
import { filterVesselsForPersona } from '../../utils/rbacHelpers';

interface AddCrewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenUploadDoc?: (crew: CrewMember, initialLayer?: STCWLayer) => void;
  onViewCrewDetail?: (crewId: string) => void;
  initialVesselId?: string;
}

/**
  what: renders modal for registering new organization crew members.
  how: captures crew Information, assigns initial stcw core documents, provides post-registration layered document upload options, updates zustand store, and logs audit event.
  with what file: src/components/drawers/AddCrewModal.tsx loaded by CrewView.tsx.
*/
export const AddCrewModal: React.FC<AddCrewModalProps> = ({
  isOpen,
  onClose,
  onOpenUploadDoc,
  onViewCrewDetail,
  initialVesselId,
}) => {
  const { vessels, assuranceSets, addCrewMember, activePersona } = useMapStore();
  const availableVessels =
    activePersona === 'Administrator'
      ? vessels
      : filterVesselsForPersona(vessels, assuranceSets, activePersona);

  const [fullName, setFullName] = useState('');
  const [rank, setRank] = useState('Chief Officer');
  const [nationality, setNationality] = useState('Australian');
  const [seamansBookNo, setSeamansBookNo] = useState('');
  const [passportNo, setPassportNo] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('1988-05-15');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [currentVesselId, setCurrentVesselId] = useState(availableVessels[0]?.id || '');
  const [errorMessage, setErrorMessage] = useState('');
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [registeredCrew, setRegisteredCrew] = useState<CrewMember | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialVesselId) {
        setCurrentVesselId(initialVesselId);
      } else if (vessels.length > 0) {
        setCurrentVesselId(vessels[0].id);
      }
    } else {
      setRegisteredCrew(null);
      setErrorMessage('');
      setHasAttemptedSubmit(false);
    }
  }, [isOpen, initialVesselId, vessels]);

  if (!isOpen) return null;

  const canManage = activePersona === 'Administrator' || activePersona === 'Submitter';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setHasAttemptedSubmit(true);

    if (!canManage) {
      setErrorMessage('Permission Denied: Registering new crew members is restricted exclusively to Administrator or Submitter roles.');
      return;
    }

    if (!fullName.trim() || !seamansBookNo.trim() || !passportNo.trim()) {
      setErrorMessage('Please fill out all required fields (Full Name, Seaman\'s Book No, and Passport No).');
      return;
    }

    const selectedVessel = vessels.find((v) => v.id === currentVesselId);
    const newCrewId = `CREW-${Math.floor(200 + Math.random() * 800)}`;

    const newCrew: CrewMember = {
      id: newCrewId,
      fullName: fullName.trim(),
      rank,
      nationality: nationality.trim() || 'Australian',
      seamansBookNo: seamansBookNo.trim(),
      passportNo: passportNo.trim(),
      dateOfBirth,
      emergencyContact: emergencyContact.trim() || '+61 400 123 456 (Next of Kin)',
      currentVesselId: selectedVessel?.id,
      currentVesselName: selectedVessel ? `${selectedVessel.name} (IMO ${selectedVessel.imoNumber})` : undefined,
      complianceStatus: 'Fully Compliant',
      overallComplianceScore: 100,
      lastAuditedDate: new Date().toISOString().split('T')[0],
      assignments: selectedVessel
        ? [
          {
            id: `ASG-${Math.floor(600 + Math.random() * 300)}`,
            vesselId: selectedVessel.id,
            vesselName: selectedVessel.name,
            imoNumber: selectedVessel.imoNumber,
            vesselType: selectedVessel.classificationSociety ? `${selectedVessel.classificationSociety} Vessel` : 'Offshore Support Vessel',
            rankHeld: rank,
            embarkDate: new Date().toISOString().split('T')[0],
            isCurrent: true,
          },
        ]
        : [],
      layer1CoreDocuments: [
        {
          id: `DOC-CRW-L1-${Math.floor(100 + Math.random() * 900)}`,
          title: 'Valid International Passport',
          layer: 'Layer 1 - Universal Core',
          stcwRegulation: 'SOLAS / National Regs',
          certificateNo: passportNo.trim(),
          issuingAuthority: 'Australian Passport Office',
          issueDate: '2023-01-01',
          expiryDate: '2033-01-01',
          verificationStatus: 'Verified',
          fileName: 'passport_scan.pdf',
          fileSizeBytes: 1400000,
        },
        {
          id: `DOC-CRW-L1-${Math.floor(100 + Math.random() * 900)}`,
          title: "National Seaman's Book (Continuous Discharge Certificate)",
          layer: 'Layer 1 - Universal Core',
          stcwRegulation: 'STCW Reg I/9',
          certificateNo: seamansBookNo.trim(),
          issuingAuthority: 'AMSA Australia',
          issueDate: '2023-01-01',
          expiryDate: '2033-01-01',
          verificationStatus: 'Verified',
          fileName: 'seamans_book_scan.pdf',
          fileSizeBytes: 2000000,
        },
      ],
      layer2Endorsements: [],
    };

    addCrewMember(newCrew);

    /* reset input state and present post-registration action panel */
    setFullName('');
    setRank('Chief Officer');
    setNationality('Australian');
    setSeamansBookNo('');
    setPassportNo('');
    setDateOfBirth('1988-05-15');
    setEmergencyContact('');
    setErrorMessage('');
    setRegisteredCrew(newCrew);
  };

  if (registeredCrew) {
    return (
      <div className="map-modal-backdrop d-flex align-items-center justify-content-center p-3">
        <div className="card map-card-custom shadow-lg" style={{ width: '100%', maxWidth: '620px', zIndex: 1100 }}>
          <div className="card-header bg-success text-white p-3 d-flex align-items-center justify-content-between">
            <div className="fw-bold fs-6">
              Crew Member Registered Successfully
            </div>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={() => {
                setRegisteredCrew(null);
                onClose();
              }}
              aria-label="Close"
            />
          </div>
          <div className="card-body p-4 d-flex flex-column gap-3">
            <div className="alert alert-success py-2 px-3 small mb-0 font-mono-code">
              Registered <strong>{registeredCrew.fullName}</strong> ({registeredCrew.rank}) — Seaman's Book #: <strong>{registeredCrew.seamansBookNo}</strong>
            </div>

            <p className="small text-secondary mb-0">
              The crew profile has been registered in the system. As an Administrator or Submitter, you can now add STCW compliance certificates for this seafarer based on compliance layers below:
            </p>

            <div className="d-flex flex-column gap-2">
              <button
                type="button"
                className="btn btn-outline-primary text-start p-3 d-flex align-items-center justify-content-between"
                onClick={() => {
                  const target = registeredCrew;
                  setRegisteredCrew(null);
                  onClose();
                  if (onOpenUploadDoc) {
                    onOpenUploadDoc(target, 'Layer 1 - Universal Core');
                  }
                }}
              >
                <div>
                  <div className="fw-bold">+ Upload Layer 1 — Universal Core Certificate</div>
                  <div className="small text-muted">Universal Core (Passport, Seaman's Book, BST, ENG1 Medical, Security Awareness)</div>
                </div>
                <span className="btn btn-sm btn-primary ms-2 flex-shrink-0">Add Layer 1</span>
              </button>

              <button
                type="button"
                className="btn btn-outline-info text-dark text-start p-3 d-flex align-items-center justify-content-between"
                onClick={() => {
                  const target = registeredCrew;
                  setRegisteredCrew(null);
                  onClose();
                  if (onOpenUploadDoc) {
                    onOpenUploadDoc(target, 'Layer 2 - Vessel Specific & Endorsements');
                  }
                }}
              >
                <div>
                  <div className="fw-bold">+ Upload Layer 2 — Vessel Specific Endorsement</div>
                  <div className="small text-muted">Vessel & Cargo Specific (CoC, Flag Endorsement, Advanced Tanker, IGF, DP Operator)</div>
                </div>
                <span className="btn btn-sm btn-info text-dark ms-2 flex-shrink-0">Add Layer 2</span>
              </button>
            </div>
          </div>
          <div className="card-footer d-flex align-items-center justify-content-between p-3 border-top bg-light">
            {onViewCrewDetail && (
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => {
                  const targetId = registeredCrew.id;
                  setRegisteredCrew(null);
                  onClose();
                  onViewCrewDetail(targetId);
                }}
              >
                View Details
              </button>
            )}
            <button
              type="button"
              className="btn btn-sm btn-primary ms-auto"
              onClick={() => {
                setRegisteredCrew(null);
                onClose();
              }}
            >
              Done / Return to Directory
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="map-modal-backdrop d-flex align-items-center justify-content-center p-3">
      <div className="card map-card-custom shadow-lg" style={{ width: '100%', maxWidth: '600px', zIndex: 1100 }}>
        {/* Modal Header */}
        <div className="card-header d-flex align-items-center justify-content-between p-3 border-bottom">
          <div className="fw-bold text-dark fs-6">
            Register New Crew Member Profile
          </div>
          <button
            type="button"
            className="btn-close"
            onClick={onClose}
            aria-label="Close"
          />
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit}>
          <div className="card-body p-4 d-flex flex-column gap-3">
            {errorMessage && (
              <div className="alert alert-danger py-2 small mb-0">
                {errorMessage}
              </div>
            )}

            {/* Full Name & Rank */}
            <div className="row g-3">
              <div className="col-md-7">
                <label className="form-label small fw-semibold text-secondary mb-1" htmlFor="crew-fullname">Full Name <span className="text-danger">*</span></label>
                <input
                  id="crew-fullname"
                  type="text"
                  className={`form-control form-control-sm bg-white text-dark border-secondary ${hasAttemptedSubmit && !fullName.trim() ? 'is-invalid' : ''}`}
                  placeholder="e.g. Capt. James Cook"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div className="col-md-5">
                <label className="form-label small fw-semibold text-secondary mb-1" htmlFor="crew-rank">Rank / Position <span className="text-danger">*</span></label>
                <select
                  id="crew-rank"
                  className="form-select form-select-sm bg-white text-dark border-secondary"
                  value={rank}
                  onChange={(e) => setRank(e.target.value)}
                >
                  <option value="Master / Ship Captain">Master / Ship Captain</option>
                  <option value="Chief Officer">Chief Officer</option>
                  <option value="Second Officer">Second Officer</option>
                  <option value="Chief Engineer">Chief Engineer</option>
                  <option value="Second Engineer">Second Engineer</option>
                  <option value="Bosun / Deck Foreman">Bosun / Deck Foreman</option>
                  <option value="Able Seaman (AB)">Able Seaman (AB)</option>
                </select>
              </div>
            </div>

            {/* Nationality & Seaman's Book No */}
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label small fw-semibold text-secondary mb-1" htmlFor="crew-nat">Nationality <span className="text-danger">*</span></label>
                <input
                  id="crew-nat"
                  type="text"
                  className={`form-control form-control-sm bg-white text-dark border-secondary ${hasAttemptedSubmit && !nationality.trim() ? 'is-invalid' : ''}`}
                  placeholder="e.g. Australian"
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                  required
                />
              </div>

              <div className="col-md-6">
                <label className="form-label small fw-semibold text-secondary mb-1" htmlFor="crew-sb">Seaman's Discharge Book No <span className="text-danger">*</span></label>
                <input
                  id="crew-sb"
                  type="text"
                  className={`form-control form-control-sm bg-white text-dark border-secondary font-mono-code ${hasAttemptedSubmit && !seamansBookNo.trim() ? 'is-invalid' : ''}`}
                  placeholder="e.g. SB-AU-990412"
                  value={seamansBookNo}
                  onChange={(e) => setSeamansBookNo(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Passport No & Date of Birth */}
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label small fw-semibold text-secondary mb-1" htmlFor="crew-passport">Passport Number <span className="text-danger">*</span></label>
                <input
                  id="crew-passport"
                  type="text"
                  className={`form-control form-control-sm bg-white text-dark border-secondary font-mono-code ${hasAttemptedSubmit && !passportNo.trim() ? 'is-invalid' : ''}`}
                  placeholder="e.g. PA-AU-8819023"
                  value={passportNo}
                  onChange={(e) => setPassportNo(e.target.value)}
                  required
                />
              </div>

              <div className="col-md-6">
                <label className="form-label small fw-semibold text-secondary mb-1" htmlFor="crew-dob">Date of Birth <span className="text-danger">*</span></label>
                <input
                  id="crew-dob"
                  type="date"
                  className={`form-control form-control-sm bg-white text-dark border-secondary font-mono-code ${hasAttemptedSubmit && !dateOfBirth.trim() ? 'is-invalid' : ''}`}
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Vessel Assignment Dropdown */}
            <div>
              <label className="form-label small fw-semibold text-secondary mb-1" htmlFor="crew-vessel">Initial Vessel Assignment</label>
              <select
                id="crew-vessel"
                className="form-select form-select-sm bg-white text-dark border-secondary"
                value={currentVesselId}
                onChange={(e) => setCurrentVesselId(e.target.value)}
              >
                <option value="">Ashore / Unassigned</option>
                {availableVessels.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} (IMO {v.imoNumber}) — {v.flagState}
                  </option>
                ))}
              </select>
            </div>

            {/* Emergency Contact Info */}
            <div>
              <label className="form-label small fw-semibold text-secondary mb-1" htmlFor="crew-emergency">Emergency Contact Details</label>
              <input
                id="crew-emergency"
                type="text"
                className="form-control form-control-sm bg-white text-dark border-secondary"
                placeholder="e.g. +61 400 123 456 (Next of Kin - Jane Cook)"
                value={emergencyContact}
                onChange={(e) => setEmergencyContact(e.target.value)}
              />
            </div>
          </div>

          {/* Modal Footer Controls */}
          <div className="card-footer d-flex align-items-center justify-content-end gap-2 p-3 border-top bg-light">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-sm btn-primary"
              disabled={!canManage}
            >
              Register Crew Profile
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
