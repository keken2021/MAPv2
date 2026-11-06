import React, { useMemo } from 'react';
import { useMapStore } from '../store/useMapStore';
import {
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
    assuranceSets,
    documents,
    projects,
    capaItems,
    auditEvents,
    notifications,
    activePersona,
    activeDemoOrganization,
    setCurrentHashView,
  } = useMapStore();
  const sessionUser = useSessionUser();

  const isClientAdmin = activePersona === 'Administrator' || activePersona === 'C Admin';

  const adminClientConfig = useMemo(() => {
    if (!isClientAdmin) return null;
    return getAdministratorClientDashboardConfig({
      assuranceSets,
      capaItems,
      auditEvents,
      projects,
      activeOrganization: activeDemoOrganization,
      setCurrentHashView,
    });
  }, [isClientAdmin, assuranceSets, capaItems, auditEvents, projects, activeDemoOrganization, setCurrentHashView]);

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

  if (isClientAdmin && adminClientConfig) {
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
