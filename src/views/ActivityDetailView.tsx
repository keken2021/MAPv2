/*
  file summary: detail view for an activity assurance object.
  responsibilities: renders detail header with verification and meta facts, tabs navigation, and overview tab.
  role in system: opened when an activity row is clicked in AssuranceObjectsView or navigated to via #/activities/:id.
*/

import React, { useState, useMemo } from 'react';
import { DetailHeader } from '../components/common/DetailHeader';
import { ObjectVerificationBadge } from '../components/common/ObjectVerificationBadge';
import { useMapStore } from '../store/useMapStore';
import { deriveObjectVerification } from '../utils/documentVersionSnapshot';
import { setsUsingObject } from './AssuranceObjectsView';
import { verificationsForViewer } from '../components/drawers/AssuranceObjectDrawer';
import { getDemoSessionContext, getSessionUserForPersona } from '../utils/userRoleHelpers';

interface ActivityDetailViewProps {
  activityId: string;
}

export const ActivityDetailView: React.FC<ActivityDetailViewProps> = ({ activityId }) => {
  const {
    assuranceObjects,
    assuranceSets,
    activePersona,
    activeDemoOrganization,
    activeSessionUserId,
    users,
    currentHashView,
    previousHashView,
    previousEntityId,
    setCurrentHashView,
  } = useMapStore();

  const [activeTab, setActiveTab] = useState<'overview'>('overview');

  const activity = useMemo(
    () => assuranceObjects.find((obj) => obj.id === activityId && obj.type === 'activity'),
    [assuranceObjects, activityId],
  );

  const sessionUser = useMemo(
    () =>
      getSessionUserForPersona(
        activePersona,
        users,
        getDemoSessionContext({ activeDemoOrganization, activeSessionUserId }),
      ),
    [activePersona, users, activeDemoOrganization, activeSessionUserId],
  );
  const organization = sessionUser?.organization || activeDemoOrganization;

  const usedInCount = useMemo(
    () => (activity ? setsUsingObject(activity.id, assuranceSets) : 0),
    [activity, assuranceSets],
  );

  const verification = useMemo(
    () => (activity ? deriveObjectVerification(activity.id, assuranceSets, organization) : null),
    [activity, assuranceSets, organization],
  );

  const viewerVerifications = useMemo(
    () => (activity ? verificationsForViewer(activity, assuranceSets, activePersona, organization) : []),
    [activity, assuranceSets, activePersona, organization],
  );

  const handleBack = () => {
    if (previousHashView && previousHashView !== 'login' && previousHashView !== currentHashView) {
      setCurrentHashView(previousHashView, previousEntityId);
    } else {
      setCurrentHashView('objects');
    }
  };

  const backLabel =
    previousHashView && previousHashView !== 'login' && previousHashView !== currentHashView
      ? previousHashView === 'objects'
        ? 'Objects'
        : previousHashView === 'assurance-sets'
          ? 'Assurance Sets'
          : previousHashView
      : 'Objects';

  if (!activity) {
    return (
      <div className="alert alert-warning m-4">
        Activity not found.
      </div>
    );
  }

  return (
    <div className="d-flex flex-column gap-3">
      <DetailHeader
        title={activity.name}
        status={verification?.status}
        metaItems={[
          activity.identifier || '',
          activity.ownerOrganization || '',
          `Used in ${usedInCount} ${usedInCount === 1 ? 'set' : 'sets'}`,
        ].filter(Boolean)}
        backLink={{
          label: backLabel,
          onClick: handleBack,
        }}
      />
      {verification && (
        <div className="px-4 py-2 bg-white border-bottom d-flex align-items-center gap-2">
          <span className="small text-muted fw-semibold">Verification:</span>
          <ObjectVerificationBadge verification={verification} />
        </div>
      )}

      <ul className="nav nav-tabs border-bottom px-4" role="tablist" aria-label="Activity detail tabs">
        <li className="nav-item">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'overview'}
            className={`nav-link ${activeTab === 'overview' ? 'active fw-bold text-primary' : 'text-secondary'}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
        </li>
      </ul>

      <div className="p-4">
        {activeTab === 'overview' && (
          <div className="card shadow-sm p-4">
            <h2 className="h5 mb-4 fw-bold">Overview</h2>
            <div className="row g-4">
              <div className="col-12 col-md-6">
                <div className="text-muted small mb-1">Identifier</div>
                <div className="fw-semibold">{activity.identifier || '—'}</div>
              </div>
              <div className="col-12 col-md-6">
                <div className="text-muted small mb-1">Owner</div>
                <div className="fw-semibold">{activity.ownerOrganization || '—'}</div>
              </div>
              <div className="col-12">
                <div className="text-muted small mb-1">Description</div>
                <div>{activity.description || 'No description.'}</div>
              </div>
              <div className="col-12">
                <h3 className="h6 mb-3 fw-bold">Verification</h3>
                {viewerVerifications.length === 0 ? (
                  <div className="text-muted">No verification for your organization.</div>
                ) : (
                  <div className="d-flex flex-column gap-3">
                    {viewerVerifications.map((v) => (
                      <div key={v.clientOrganization} className="p-3 border rounded" data-testid="object-verification">
                        <div className="fw-semibold mb-1">{v.clientOrganization}</div>
                        <ObjectVerificationBadge verification={v} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
