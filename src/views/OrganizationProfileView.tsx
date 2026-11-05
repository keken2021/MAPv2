/*
  file summary: Settings screen for the active organization's contact profile.
  responsibilities: Administrator edits their own organization only; other roles see the same fields read-only.
  role in system: routed at #/organization-profile from App.tsx (sidebar item comes in a later Task).
*/

import React, { useEffect, useMemo, useState } from 'react';
import { useMapStore } from '../store/useMapStore';
import {
  OrganizationProfilePatch,
  useOrganizationProfileStore,
} from '../store/organizationProfileStore';
import {
  ORGANIZATION_FIELD_NOT_RECORDED,
  displayOrganizationField,
} from '../types/organization';
import { Save } from 'lucide-react';

const EMPTY_FORM: OrganizationProfilePatch = {
  email: '',
  phone: '',
  fax: '',
  website: '',
  address: '',
};

/**
  what: Organization profile Settings — contact fields for the active demo organization.
*/
export const OrganizationProfileView: React.FC = () => {
  const { activePersona, activeDemoOrganization } = useMapStore();
  const profiles = useOrganizationProfileStore((s) => s.profiles);
  const getProfileByName = useOrganizationProfileStore((s) => s.getProfileByName);
  const updateProfileForOrganization = useOrganizationProfileStore(
    (s) => s.updateProfileForOrganization,
  );

  const organizationName = (activeDemoOrganization || '').trim();
  const profile = useMemo(
    () => getProfileByName(organizationName),
    [getProfileByName, organizationName, profiles],
  );

  const canEdit = activePersona === 'Administrator' && Boolean(organizationName) && Boolean(profile);

  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<OrganizationProfilePatch>(EMPTY_FORM);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    setIsEditing(false);
    setSaveMessage(null);
    setForm({
      email: profile?.email || '',
      phone: profile?.phone || '',
      fax: profile?.fax || '',
      website: profile?.website || '',
      address: profile?.address || '',
    });
  }, [profile?.id, profile?.email, profile?.phone, profile?.fax, profile?.website, profile?.address]);

  const handleSave = () => {
    if (!canEdit || !organizationName) return;
    const ok = updateProfileForOrganization(organizationName, form);
    if (ok) {
      setIsEditing(false);
      setSaveMessage('Organization profile saved.');
      setTimeout(() => setSaveMessage(null), 3500);
    }
  };

  const handleCancel = () => {
    setForm({
      email: profile?.email || '',
      phone: profile?.phone || '',
      fax: profile?.fax || '',
      website: profile?.website || '',
      address: profile?.address || '',
    });
    setIsEditing(false);
  };

  const renderField = (
    label: string,
    key: keyof OrganizationProfilePatch,
    options?: { multiline?: boolean; type?: string },
  ) => {
    const recorded = displayOrganizationField(profile?.[key]);
    if (canEdit && isEditing) {
      return (
        <div className="mb-3" key={key}>
          <label className="form-label small text-muted mb-1" htmlFor={`org-profile-${key}`}>
            {label}
          </label>
          {options?.multiline ? (
            <textarea
              id={`org-profile-${key}`}
              className="form-control form-control-sm"
              rows={3}
              value={form[key] || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
            />
          ) : (
            <input
              id={`org-profile-${key}`}
              type={options?.type || 'text'}
              className="form-control form-control-sm"
              value={form[key] || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
            />
          )}
        </div>
      );
    }

    return (
      <div className="mb-3" key={key}>
        <div className="small text-muted mb-1">{label}</div>
        <div className={`fw-semibold ${recorded === ORGANIZATION_FIELD_NOT_RECORDED ? 'text-muted' : 'text-dark'}`}>
          {recorded}
        </div>
      </div>
    );
  };

  return (
    <div className="d-flex flex-column gap-4">
      <div className="d-flex flex-wrap align-items-start justify-content-between gap-3">
        <div>
          <p className="text-secondary small mb-0">
            Contact details for{' '}
            <span className="fw-semibold text-dark">{organizationName || 'the active organization'}</span>
            {canEdit
              ? '. Administrator can edit this organization only.'
              : '. Read-only for your role.'}
          </p>
        </div>
        {canEdit && (
          <div className="d-flex align-items-center gap-2">
            {isEditing ? (
              <>
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={handleCancel}>
                  Cancel
                </button>
                <button type="button" className="btn btn-sm btn-primary d-flex align-items-center gap-1" onClick={handleSave}>
                  <Save size={14} />
                  Save
                </button>
              </>
            ) : (
              <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setIsEditing(true)}>
                Edit profile
              </button>
            )}
          </div>
        )}
      </div>

      {saveMessage && (
        <div className="alert alert-success py-2 px-3 mb-0 small" role="status">
          {saveMessage}
        </div>
      )}

      {!organizationName && (
        <div className="alert alert-warning py-2 px-3 mb-0 small">No active organization is selected.</div>
      )}

      {organizationName && !profile && (
        <div className="alert alert-light border py-2 px-3 mb-0 small text-secondary">
          No organization profile is recorded for this name yet. Contact fields show as {ORGANIZATION_FIELD_NOT_RECORDED}.
        </div>
      )}

      <div className="card map-card-custom border shadow-sm">
        <div className="card-body p-4">
          <div className="row">
            <div className="col-md-6">{renderField('Email', 'email', { type: 'email' })}</div>
            <div className="col-md-6">{renderField('Phone', 'phone', { type: 'tel' })}</div>
            <div className="col-md-6">{renderField('Fax', 'fax', { type: 'tel' })}</div>
            <div className="col-md-6">{renderField('Website', 'website', { type: 'url' })}</div>
            <div className="col-12">{renderField('Address', 'address', { multiline: true })}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
