import React, { useMemo } from 'react';
import { useMapStore } from '../store/useMapStore';
import {
  getAdministratorDashboardConfig,
  getAdministratorClientDashboardConfig,
  getSubmitterDashboardConfig,
  getVerifierDashboardConfig,
  getInspectorDashboardConfig,
  getApproverDashboardConfig,
} from '../utils/roleDashboardConfigs';
import { useSessionUser } from '../utils/useSessionUser';
import { SharedDashboardFrame } from '../components/dashboard/SharedDashboardFrame';

export const DashboardView: React.FC = () => {
  const {
    vessels,
    assuranceSets,
    documents,
    projects,
    users,
    capaItems,
    auditEvents,
    notifications,
    activePersona,
    activeDemoOrganization,
    setCurrentHashView,
  } = useMapStore();
  const sessionUser = useSessionUser();

  const adminConfig = useMemo(() => {
    if (activePersona !== 'Administrator') return null;
    return getAdministratorDashboardConfig({
      vessels,
      assuranceSets,
      documents,
      capaItems,
      auditEvents,
      sessionUser,
      activeOrganization: activeDemoOrganization,
      setCurrentHashView,
    });
  }, [
    activePersona,
    vessels,
    assuranceSets,
    documents,
    capaItems,
    auditEvents,
    sessionUser,
    activeDemoOrganization,
    setCurrentHashView,
  ]);

  const adminClientConfig = useMemo(() => {
    if (activePersona !== 'C Admin') return null;
    return getAdministratorClientDashboardConfig({
      assuranceSets,
      capaItems,
      auditEvents,
      projects,
      users,
      sessionUser,
      activeOrganization: activeDemoOrganization,
      setCurrentHashView,
    });
  }, [
    activePersona,
    assuranceSets,
    capaItems,
    auditEvents,
    projects,
    users,
    sessionUser,
    activeDemoOrganization,
    setCurrentHashView,
  ]);

  const submitterConfig = useMemo(() => {
    if (activePersona !== 'Submitter') return null;
    return getSubmitterDashboardConfig({
      assuranceSets,
      documents,
      capaItems,
      auditEvents,
      sessionUser,
      activeOrganization: activeDemoOrganization,
      setCurrentHashView,
    });
  }, [activePersona, assuranceSets, documents, capaItems, auditEvents, sessionUser, activeDemoOrganization, setCurrentHashView]);

  const verifierConfig = useMemo(() => {
    if (activePersona !== 'Verifier') return null;
    return getVerifierDashboardConfig({
      assuranceSets,
      documents,
      auditEvents,
      notifications,
      sessionUser,
      activeOrganization: activeDemoOrganization,
      setCurrentHashView,
    });
  }, [activePersona, assuranceSets, documents, auditEvents, notifications, sessionUser, activeDemoOrganization, setCurrentHashView]);

  const inspectorConfig = useMemo(() => {
    if (activePersona !== 'Inspector') return null;
    return getInspectorDashboardConfig({
      assuranceSets,
      capaItems,
      auditEvents,
      sessionUser,
      activeOrganization: activeDemoOrganization,
      setCurrentHashView,
    });
  }, [activePersona, assuranceSets, capaItems, auditEvents, sessionUser, activeDemoOrganization, setCurrentHashView]);

  const approverConfig = useMemo(() => {
    if (activePersona !== 'Approver') return null;
    return getApproverDashboardConfig({
      assuranceSets,
      capaItems,
      auditEvents,
      sessionUser,
      activeOrganization: activeDemoOrganization,
      setCurrentHashView,
    });
  }, [activePersona, assuranceSets, capaItems, auditEvents, sessionUser, activeDemoOrganization, setCurrentHashView]);

  if (activePersona === 'Administrator' && adminConfig) {
    return (
      <div className="d-flex flex-column gap-4">
        <SharedDashboardFrame config={adminConfig} />
      </div>
    );
  }

  if (activePersona === 'C Admin' && adminClientConfig) {
    return (
      <div className="d-flex flex-column gap-4">
        <SharedDashboardFrame config={adminClientConfig} />
      </div>
    );
  }

  if (activePersona === 'Submitter' && submitterConfig) {
    return (
      <div className="d-flex flex-column gap-4">
        <SharedDashboardFrame config={submitterConfig} />
      </div>
    );
  }

  if (activePersona === 'Verifier' && verifierConfig) {
    return (
      <div className="d-flex flex-column gap-4">
        <SharedDashboardFrame config={verifierConfig} />
      </div>
    );
  }

  if (activePersona === 'Inspector' && inspectorConfig) {
    return (
      <div className="d-flex flex-column gap-4">
        <SharedDashboardFrame config={inspectorConfig} />
      </div>
    );
  }

  if (activePersona === 'Approver' && approverConfig) {
    return (
      <div className="d-flex flex-column gap-4">
        <SharedDashboardFrame config={approverConfig} />
      </div>
    );
  }

  return null;
};
