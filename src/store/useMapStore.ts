/* 
  file summary: unified zustand global state management store for the marine assurance platform (map).
  responsibilities: manages state for active persona rbac, vessel fleet, assurance sets, document vault, audit logs, hash route tracking, and compliance workflows.
  role in system: central state store consumed by all header, sidebar, table, view, drawer, and modal components.
*/

import { create } from 'zustand';
import { UserRolePersona, AuditTrailEvent } from '../types/audit';
import { VesselInformation, VesselStatusDimension, VesselStatusHistoryEntry } from '../types/vessel';
import { EquipmentAsset } from '../types/equipment';
import { AvailabilityStatus } from '../types/asset';
import { AssuranceSet, AssuranceStage, AssuranceRequirement } from '../types/assurance';
import { MasterDocument } from '../types/document';
import { MOCK_VESSELS, MOCK_ASSURANCE_SETS, MOCK_DOCUMENTS, MOCK_AUDIT_TRAIL, MOCK_USERS } from './mockData';
import { MOCK_EQUIPMENT } from './equipmentMockData';
import { MOCK_CREW } from './crewMockData';
import {
  isDuplicateVessel,
  isDuplicateEquipment,
  isDuplicateCampaignTitle,
  generateUniqueAssuranceSetId,
} from '../utils/validation';
import { isViewAccessibleToPersona } from '../utils/rbacHelpers';
import { UserProfile } from '../types/user';
import { CrewMember, STCWDocumentItem } from '../types/crew';
import { CapaItem, CapaStatus, CapaEvidenceItem } from '../types/capa';
import { MOCK_CAPA_ITEMS } from './capaMockData';
import {
  CrudAction,
  PermissionCategory,
  PermissionScopeDefinition,
  RolePermissionMatrix,
  UserPermissionOverrides,
  emptyCrud,
  slugifyPermissionKey,
  ALL_ROLE_PERSONAS,
  BUILTIN_PERMISSION_CATEGORIES,
} from '../types/permissions';
import {
  PERMISSION_SCOPE_CATALOG,
  buildBrdRolePermissionDefaults,
  buildEmptyFlagsForCatalog,
} from '../utils/permissionDefaults';
import { applyPermissionGuards } from '../utils/permissionHelpers';
import { calculateAssuranceSetReadiness } from '../utils/readinessHelpers';
import {
  Project,
  ProjectAssetLink,
  ProjectRiskProfile,
  ProjectType,
  WorkLocationType,
} from '../types/project';
import { MOCK_PROJECTS, PROJECT_SEED_ASSURANCE_SETS } from './projectMockData';
import {
  buildMasterAssuranceRequirements,
  calculateProjectReadiness,
  generateMasterAssuranceSetId,
  generateUniqueProjectId,
  getProjectEffectiveCharterer,
  requiresAssuranceSetForAssetLink,
} from '../utils/projectHelpers';
import { MOCK_VESSEL_STATUS_HISTORY } from './vesselStatusHistoryMockData';
import {
  buildInitialVesselStatusHistoryEntries,
  diffVesselStatusChanges,
  generateVesselStatusHistoryId,
  getTrackedVesselStatusValues,
} from '../utils/vesselStatusHistoryHelpers';

export interface MapStoreState {

  // Authentication State
  isAuthenticated: boolean;
  login: (role: UserRolePersona) => void;
  logout: () => void;

  // Persona & RBAC State
  activePersona: UserRolePersona;
  setActivePersona: (persona: UserRolePersona) => void;

  // Hash Navigation State
  currentHashView: string;
  previousHashView?: string;
  currentEntityId?: string;
  previousEntityId?: string;
  setCurrentHashView: (view: string, entityId?: string) => void;

  // Active Asset Context
  activeVesselId: string;
  setActiveVesselId: (id: string) => void;

  /** When set, Create Assurance Set pre-selects this vessel and returns there after save/cancel */
  createAssuranceForVesselId?: string;
  setCreateAssuranceForVesselId: (vesselId?: string) => void;

  /** When set, returning navigation targets this project after add-to-project flows */
  returnToProjectId?: string;
  setReturnToProjectId: (projectId?: string) => void;

  // Project Charter State
  projects: Project[];
  addProject: (input: {
    name: string;
    projectType: ProjectType;
    clientOperator: string;
    requestingOrganization: string;
    location: string;
    description?: string;
    charterWindowStart: string;
    charterWindowEnd: string;
    operatorOrganization: string;
    charterer?: string;
    routeDescription?: string;
    riskProfile?: ProjectRiskProfile | null;
    serviceProvider?: string;
    workOrderRef?: string;
    workLocationType?: WorkLocationType;
    primaryVesselId?: string;
    assetLinks?: Omit<ProjectAssetLink, 'id' | 'projectId' | 'addedAt' | 'addedByPersona'>[];
  }) => { success: boolean; projectId?: string; message?: string };
  updateProject: (project: Project) => void;
  addAssetToProject: (
    projectId: string,
    link: Omit<ProjectAssetLink, 'id' | 'projectId' | 'addedAt' | 'addedByPersona'>,
  ) => { success: boolean; message?: string };
  removeAssetFromProject: (projectId: string, linkId: string) => void;
  linkAssuranceSetToProjectAsset: (projectId: string, linkId: string, assuranceSetId: string) => void;
  syncProjectMasterAssurance: (projectId: string) => void;

  // Vessel Fleet State
  vessels: VesselInformation[];
  addVessel: (vessel: VesselInformation) => { success: boolean; message?: string; vesselId?: string };
  updateVessel: (vessel: VesselInformation) => void;
  updateVesselStatus: (vesselId: string, status: VesselInformation['status']) => void;
  updateVesselAvailability: (vesselId: string, availabilityStatus: AvailabilityStatus) => void;

  // Vessel Status History
  vesselStatusHistory: VesselStatusHistoryEntry[];
  recordVesselStatusChange: (params: {
    vesselId: string;
    dimension: VesselStatusDimension;
    previousValue: string | null;
    newValue: string;
    changedBy?: string;
    changedByRole?: UserRolePersona;
    notes?: string;
    source?: VesselStatusHistoryEntry['source'];
    effectiveFrom?: string;
  }) => void;

  // Equipment Assets State
  equipment: EquipmentAsset[];
  addEquipment: (item: EquipmentAsset) => { success: boolean; message?: string; equipmentId?: string };
  updateEquipment: (item: EquipmentAsset) => void;
  updateEquipmentAvailability: (equipmentId: string, availabilityStatus: AvailabilityStatus) => void;

  // Assurance Sets State
  assuranceSets: AssuranceSet[];
  addAssuranceSet: (set: AssuranceSet) => void;
  updateAssuranceSet: (set: AssuranceSet) => void;
  updateAssuranceStage: (setId: string, stage: AssuranceStage) => void;
  updateAssuranceStakeholder: (
    setId: string,
    role: 'Submitter' | 'Verifier' | 'Inspector' | 'Approver',
    assigneeName: string
  ) => void;
  updateAssuranceInspector: (setId: string, inspectorName: string) => void;
  updateRequirementStatus: (
    setId: string,
    reqId: string,
    status: 'Verified' | 'Correction Requested' | 'Rejected',
    notes?: string
  ) => void;
  denyRequirementByApprover: (
    setId: string,
    reqId: string,
    decision: 'Correction Requested' | 'Rejected',
    notes: string
  ) => void;
  setApproverDecision: (
    setId: string,
    decision: 'Approved' | 'Returned for Correction' | 'Rejected',
    notes?: string
  ) => void;

  // Document Library State
  documents: MasterDocument[];
  addDocument: (doc: MasterDocument) => void;
  linkDocumentToVessel: (docId: string, vesselId: string, vesselName?: string, imoNumber?: string) => void;
  uploadDocumentForRequirement: (
    setId: string,
    requirementId: string | undefined,
    doc: MasterDocument,
  ) => void;
  addDocumentVersion: (
    docId: string,
    newVersionLabel: string,
    fileName: string,
    fileSizeBytes: number,
    changeSummary: string
  ) => void;
  verifyDocument: (
    docId: string,
    status: 'Pending' | 'Verified' | 'Correction Requested' | 'Rejected',
    notes?: string,
    routeTarget?: 'Inspector' | 'Approver',
  ) => void;

  // Audit Trail State
  auditEvents: AuditTrailEvent[];
  logAuditEvent: (event: Omit<AuditTrailEvent, 'id' | 'timestampUtc'>) => void;

  // User Management State
  users: UserProfile[];
  addUser: (user: UserProfile) => void;
  updateUser: (user: UserProfile) => void;
  updateUserStatus: (userId: string, status: UserProfile['status']) => void;

  // Roles & Permissions State (BRD defaults + admin overrides)
  rolePermissionDefaults: RolePermissionMatrix;
  userPermissionOverrides: UserPermissionOverrides;
  customRoles: string[];
  customScopes: PermissionScopeDefinition[];
  customCategories: string[];
  setRolePermissionFlag: (
    role: string,
    scopeKey: string,
    action: CrudAction,
    value: boolean,
  ) => void;
  commitRolePermissionDefaults: (matrix: RolePermissionMatrix) => void;
  commitUserPermissionOverrides: (overrides: UserPermissionOverrides) => void;
  resetRolePermissionsToBrd: () => void;
  setUserPermissionOverride: (
    userId: string,
    scopeKey: string,
    action: CrudAction,
    value: boolean,
  ) => void;
  clearUserPermissionOverrides: (userId: string) => void;
  addCustomRole: (roleName: string) => { success: boolean; message?: string };
  addCustomCategory: (categoryName: string) => { success: boolean; message?: string };
  addCustomScope: (input: {
    label: string;
    description: string;
    category: string;
  }) => { success: boolean; message?: string; key?: string };

  // Crew Directory State
  crew: CrewMember[];
  addCrewMember: (crew: CrewMember) => void;
  assignCrewToVessel: (crewId: string, vesselId: string | undefined) => void;
  addCrewDocument: (crewId: string, doc: STCWDocumentItem) => void;
  updateCrewDocument: (crewId: string, doc: STCWDocumentItem) => void;
  deleteCrewDocument: (crewId: string, docId: string) => void;

  // Global Drawers State
  isAuditDrawerOpen: boolean;
  setAuditDrawerOpen: (open: boolean) => void;

  // CAPA Management State
  capaItems: CapaItem[];
  addCapaItem: (capa: CapaItem) => void;
  updateCapaStatus: (capaId: string, status: CapaStatus, inspectorNotes?: string) => void;
  addCapaEvidence: (capaId: string, evidence: CapaEvidenceItem) => void;
  removeCapaEvidence: (capaId: string, evidenceId: string) => void;
  flagCapaForReinspection: (capaId: string, reason?: string) => void;
}

const BRD_PERMISSION_DEFAULTS = buildBrdRolePermissionDefaults();


export const useMapStore = create<MapStoreState>((set, get) => ({
  isAuthenticated: false,
  login: (role) => {
    get().logAuditEvent({
      userId: 'USR-LOGIN',
      userRole: role,
      organization: role === 'C Admin' ? 'Southern Basin Energy' : 'Northwind Marine',
      action: 'Authenticated User Session',
      targetAsset: 'Authentication Gateway',
      justificationNotes: `Logged in as ${role}`,
    });
    const targetView = role === 'Verifier' ? 'verifier' : role === 'Inspector' ? 'inspector' : 'dashboard';
    window.location.hash = `#/${targetView}`;
    set({ isAuthenticated: true, activePersona: role, currentHashView: targetView });
  },
  logout: () => {
    get().logAuditEvent({
      userId: 'USR-LOGOUT',
      userRole: get().activePersona,
      organization: 'MAP Gateway',
      action: 'Terminated User Session',
      targetAsset: 'Authentication Gateway',
      justificationNotes: 'User signed out.',
    });
    window.location.hash = '#/login';
    set({ isAuthenticated: false, currentHashView: 'login' });
  },

  activePersona: 'Administrator',
  setActivePersona: (persona) => {
    get().logAuditEvent({
      userId: 'USR-PERSONA-SWITCH',
      userRole: persona,
      organization: persona === 'C Admin' ? 'Southern Basin Energy' : 'Northwind Marine',
      action: 'Switched Active User Persona',
      targetAsset: 'Global System Context',
      justificationNotes: `Persona set to ${persona}`,
    });

    /* default to dashboard if active view is not accessible to newly selected persona */
    const currentView = get().currentHashView;
    const currentId = get().currentEntityId;

    if (!isViewAccessibleToPersona(currentView, currentId, persona)) {
      get().setCurrentHashView('dashboard');
    }

    set({ activePersona: persona });
  },

  currentHashView: 'login',
  previousHashView: undefined,
  currentEntityId: undefined,
  previousEntityId: undefined,
  setCurrentHashView: (view, entityId) => {
    const currentView = get().currentHashView;
    const currentId = get().currentEntityId;

    let prevView = get().previousHashView;
    let prevId = get().previousEntityId;

    if (currentView !== view || currentId !== entityId) {
      prevView = currentView;
      prevId = currentId;
    }

    window.location.hash = entityId ? `#/${view}/${entityId}` : `#/${view}`;
    set({
      previousHashView: prevView,
      previousEntityId: prevId,
      currentHashView: view,
      currentEntityId: entityId,
    });
  },

  activeVesselId: 'VESSEL-001',
  setActiveVesselId: (id) => set({ activeVesselId: id }),

  createAssuranceForVesselId: undefined,
  setCreateAssuranceForVesselId: (vesselId) => set({ createAssuranceForVesselId: vesselId }),

  returnToProjectId: undefined,
  setReturnToProjectId: (projectId) => set({ returnToProjectId: projectId }),

  projects: MOCK_PROJECTS,
  addProject: (input) => {
    const existing = get().projects;
    const projectId = generateUniqueProjectId(existing);
    const masterId = generateMasterAssuranceSetId(projectId, get().assuranceSets);
    const persona = get().activePersona;
    const effectiveCharterer = input.charterer?.trim() || input.requestingOrganization;

    const crossOrgMissingAssurance = (input.assetLinks ?? []).filter(
      (link) =>
        requiresAssuranceSetForAssetLink(input.requestingOrganization, link.providerOrganization) &&
        !link.assuranceSetId,
    );
    if (crossOrgMissingAssurance.length > 0) {
      return {
        success: false,
        message: 'Cross-organization assets require an assurance set to be selected.',
      };
    }

    const assetLinks: ProjectAssetLink[] = (input.assetLinks ?? []).map((link, idx) => ({
      ...link,
      id: `PAL-${Date.now()}-${idx}`,
      projectId,
      addedAt: new Date().toISOString(),
      addedByPersona: persona,
    }));

    const childSets = assetLinks
      .map((l) => get().assuranceSets.find((s) => s.id === l.assuranceSetId))
      .filter((s): s is AssuranceSet => Boolean(s));

    const masterRequirements = buildMasterAssuranceRequirements(childSets, input.name);
    const masterSet: AssuranceSet = {
      id: masterId,
      title: `${input.name} — Project Master Assurance`,
      assuranceType: 'Project',
      subtypes: ['Vessel', 'Crew', 'Activity', 'Equipment'],
      projectId,
      projectName: input.name,
      vesselId: childSets[0]?.vesselId || get().vessels[0]?.id || '',
      vesselName: childSets[0]?.vesselName || get().vessels[0]?.name || 'Project Asset',
      imoNumber: childSets[0]?.imoNumber || get().vessels[0]?.imoNumber || '0000000',
      initiatorOrg: input.operatorOrganization,
      initiatorRole: persona === 'C Admin' ? 'C Admin · Client Created' : 'Vessel Provider Admin',
      charterer: effectiveCharterer,
      charterWindowStart: input.charterWindowStart,
      charterWindowEnd: input.charterWindowEnd,
      stage: 'Initiated',
      readinessScore: 0,
      mandatoryInspectionRequired: true,
      inspectionCompleted: false,
      isProjectMaster: true,
      parentProjectId: projectId,
      aggregatedFromSetIds: assetLinks.map((l) => l.assuranceSetId),
      requirements: masterRequirements,
      createdByPersona: persona,
    };

    const projectDraft: Project = {
      id: projectId,
      name: input.name,
      projectType: input.projectType,
      requestingOrganization: input.requestingOrganization,
      clientOperator: input.clientOperator,
      location: input.location,
      description: input.description || '',
      charterer: input.charterer,
      routeDescription: input.routeDescription,
      riskProfile: input.riskProfile ?? null,
      charterWindowStart: input.charterWindowStart,
      charterWindowEnd: input.charterWindowEnd,
      status: assetLinks.length > 0 ? 'Assurance In Progress' : 'Composing',
      operatorOrganization: input.operatorOrganization,
      masterAssuranceSetId: masterId,
      assetLinks,
      serviceProvider: input.serviceProvider,
      workOrderRef: input.workOrderRef,
      workLocationType: input.workLocationType,
      primaryVesselId: input.primaryVesselId,
    };

    const readinessScore = calculateProjectReadiness(
      projectDraft,
      [...get().assuranceSets, masterSet],
    );

    const project: Project = {
      ...projectDraft,
      readinessScore,
    };

    masterSet.readinessScore = calculateAssuranceSetReadiness(masterSet);

    set((state) => ({
      projects: [...state.projects, project],
      assuranceSets: [...state.assuranceSets, masterSet],
    }));

    get().logAuditEvent({
      userId: 'USR-CURRENT',
      userRole: persona,
      organization: input.operatorOrganization,
      action: 'Created Project Charter',
      targetAsset: `${projectId} (${input.name})`,
      justificationNotes: `Master assurance set ${masterId} auto-created.`,
    });

    return { success: true, projectId };
  },

  updateProject: (updatedProject) => {
    set((state) => ({
      projects: state.projects.map((p) => (p.id === updatedProject.id ? updatedProject : p)),
    }));
  },

  addAssetToProject: (projectId, linkInput) => {
    const project = get().projects.find((p) => p.id === projectId);
    if (!project) return { success: false, message: 'Project not found.' };

    const duplicate = project.assetLinks.some(
      (l) => l.assetType === linkInput.assetType && l.assetId === linkInput.assetId,
    );
    if (duplicate) {
      return { success: false, message: 'This asset is already linked to the project.' };
    }

    const link: ProjectAssetLink = {
      ...linkInput,
      id: `PAL-${Date.now()}`,
      projectId,
      addedAt: new Date().toISOString(),
      addedByPersona: get().activePersona,
    };

    const updatedProject: Project = {
      ...project,
      assetLinks: [...project.assetLinks, link],
      status: 'Assurance In Progress',
    };

    set((state) => ({
      projects: state.projects.map((p) => (p.id === projectId ? updatedProject : p)),
    }));

    get().syncProjectMasterAssurance(projectId);

    get().logAuditEvent({
      userId: 'USR-CURRENT',
      userRole: get().activePersona,
      organization: project.operatorOrganization,
      action: 'Linked Asset to Project',
      targetAsset: `${projectId} ← ${link.assetName}`,
      justificationNotes: `Attached ${link.assuranceSetId} for ${link.assetType} asset.`,
    });

    return { success: true };
  },

  removeAssetFromProject: (projectId, linkId) => {
    const project = get().projects.find((p) => p.id === projectId);
    if (!project) return;

    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId
          ? {
            ...p,
            assetLinks: p.assetLinks.filter((l) => l.id !== linkId),
            status: p.assetLinks.length <= 1 ? 'Composing' : p.status,
          }
          : p,
      ),
    }));

    get().syncProjectMasterAssurance(projectId);
  },

  linkAssuranceSetToProjectAsset: (projectId, linkId, assuranceSetId) => {
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId
          ? {
            ...p,
            assetLinks: p.assetLinks.map((l) =>
              l.id === linkId ? { ...l, assuranceSetId } : l,
            ),
          }
          : p,
      ),
    }));
    get().syncProjectMasterAssurance(projectId);
  },

  syncProjectMasterAssurance: (projectId) => {
    const project = get().projects.find((p) => p.id === projectId);
    if (!project) return;

    const childSets = project.assetLinks
      .map((l) => get().assuranceSets.find((s) => s.id === l.assuranceSetId))
      .filter((s): s is AssuranceSet => Boolean(s));

    const masterRequirements = buildMasterAssuranceRequirements(childSets, project.name);
    const aggregatedFromSetIds = project.assetLinks.map((l) => l.assuranceSetId);
    const readinessScore = calculateProjectReadiness(project, get().assuranceSets);

    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId ? { ...p, readinessScore } : p,
      ),
      assuranceSets: state.assuranceSets.map((s) => {
        if (s.id !== project.masterAssuranceSetId) return s;
        const updated: AssuranceSet = {
          ...s,
          projectId: project.id,
          projectName: project.name,
          aggregatedFromSetIds,
          requirements: masterRequirements,
          charterWindowStart: project.charterWindowStart,
          charterWindowEnd: project.charterWindowEnd,
          charterer: getProjectEffectiveCharterer(project),
        };
        return {
          ...updated,
          readinessScore: calculateAssuranceSetReadiness(updated),
        };
      }),
    }));
  },

  // Fleet Vessels
  vessels: MOCK_VESSELS,

  vesselStatusHistory: MOCK_VESSEL_STATUS_HISTORY,
  recordVesselStatusChange: (params) => {
    const now = params.effectiveFrom ?? new Date().toISOString();
    const activePersona = get().activePersona;
    const newEntry: VesselStatusHistoryEntry = {
      id: generateVesselStatusHistoryId(),
      vesselId: params.vesselId,
      dimension: params.dimension,
      previousValue: params.previousValue,
      newValue: params.newValue,
      effectiveFrom: now,
      changedAt: now,
      changedBy: params.changedBy ?? 'USR-CURRENT',
      changedByRole: params.changedByRole ?? activePersona,
      notes: params.notes,
      source: params.source ?? 'manual',
    };

    set((state) => ({
      vesselStatusHistory: [
        ...state.vesselStatusHistory.map((entry) =>
          entry.vesselId === params.vesselId &&
          entry.dimension === params.dimension &&
          !entry.effectiveTo
            ? { ...entry, effectiveTo: now }
            : entry,
        ),
        newEntry,
      ],
    }));
  },

  addVessel: (newVessel) => {
    const dupCheck = isDuplicateVessel(newVessel.imoNumber, newVessel.officialRegNumber, get().vessels);
    if (dupCheck.isDuplicate) {
      return { success: false, message: dupCheck.reason };
    }

    const registeredAt = new Date().toISOString();
    const initialHistory = buildInitialVesselStatusHistoryEntries(
      newVessel,
      'USR-CURRENT',
      get().activePersona,
      registeredAt,
    );

    set((state) => ({
      vessels: [...state.vessels, newVessel],
      vesselStatusHistory: [...state.vesselStatusHistory, ...initialHistory],
    }));

    get().logAuditEvent({
      userId: 'USR-CURRENT',
      userRole: get().activePersona,
      organization: get().activePersona === 'Administrator' ? 'Northwind Marine Pty Ltd' : 'Northwind Marine Pty Ltd',
      action: 'Registered Unique Vessel Record',
      targetAsset: `${newVessel.name} (IMO ${newVessel.imoNumber})`,
      justificationNotes: `Registered vessel under ${newVessel.flagState} flag.`,
    });

    return { success: true, vesselId: newVessel.id };
  },

  updateVessel: (updatedVessel) => {
    const previousVessel = get().vessels.find((v) => v.id === updatedVessel.id);
    const statusChanges = previousVessel ? diffVesselStatusChanges(previousVessel, updatedVessel) : [];

    set((state) => ({
      vessels: state.vessels.map((v) => (v.id === updatedVessel.id ? updatedVessel : v)),
      /* synchronize vessel name and imo across all linked assurance sets */
      assuranceSets: state.assuranceSets.map((s) =>
        s.vesselId === updatedVessel.id
          ? {
            ...s,
            vesselName: updatedVessel.name,
            imoNumber: updatedVessel.imoNumber,
          }
          : s
      ),
      /* synchronize vessel attributes in linked master documents */
      documents: state.documents.map((d) =>
        d.vesselId === updatedVessel.id && d.vesselAttributes
          ? {
            ...d,
            vesselAttributes: {
              ...d.vesselAttributes,
              vesselName: updatedVessel.name,
              imoNumber: updatedVessel.imoNumber,
            },
          }
          : d
      ),
    }));

    statusChanges.forEach((change) => {
      get().recordVesselStatusChange({
        vesselId: updatedVessel.id,
        dimension: change.dimension,
        previousValue: change.previousValue,
        newValue: change.newValue,
        source: 'manual',
      });
    });

    get().logAuditEvent({
      userId: 'USR-CURRENT',
      userRole: get().activePersona,
      organization: get().activePersona === 'C Admin' ? 'Chevron Australia' : 'Northwind Marine Pty Ltd',
      action: 'Updated Vessel Specifications',
      targetAsset: `${updatedVessel.name} (IMO ${updatedVessel.imoNumber})`,
      justificationNotes: `Updated vessel Information for ${updatedVessel.name}`,
    });
  },

  updateVesselStatus: (vesselId, status) => {
    const previousVessel = get().vessels.find((v) => v.id === vesselId);
    if (!previousVessel) return;

    const nextVessel = { ...previousVessel, status };
    const statusChanges = diffVesselStatusChanges(previousVessel, nextVessel);

    set((state) => ({
      vessels: state.vessels.map((v) => (v.id === vesselId ? nextVessel : v)),
    }));

    statusChanges.forEach((change) => {
      get().recordVesselStatusChange({
        vesselId,
        dimension: change.dimension,
        previousValue: change.previousValue,
        newValue: change.newValue,
        source: 'manual',
      });
    });
  },

  updateVesselAvailability: (vesselId, availabilityStatus) => {
    const previousVessel = get().vessels.find((v) => v.id === vesselId);
    if (!previousVessel) return;

    const previousAvailability =
      previousVessel.availabilityStatus ??
      getTrackedVesselStatusValues(previousVessel).availability;

    if (previousAvailability === availabilityStatus) return;

    const now = new Date().toISOString();
    set((state) => ({
      vessels: state.vessels.map((v) =>
        v.id === vesselId ? { ...v, availabilityStatus, availabilityUpdatedAt: now } : v,
      ),
    }));

    get().recordVesselStatusChange({
      vesselId,
      dimension: 'availability',
      previousValue: previousAvailability,
      newValue: availabilityStatus,
      source: 'manual',
      effectiveFrom: now,
    });
  },

  equipment: MOCK_EQUIPMENT,
  addEquipment: (newEquipment) => {
    const dupCheck = isDuplicateEquipment(newEquipment.equipmentIdentifier, get().equipment);
    if (dupCheck.isDuplicate) {
      return { success: false, message: dupCheck.reason };
    }
    set((state) => ({ equipment: [...state.equipment, newEquipment] }));
    get().logAuditEvent({
      userId: 'USR-CURRENT',
      userRole: get().activePersona,
      organization: newEquipment.owningOrganization,
      action: 'Registered Equipment Asset',
      targetAsset: `${newEquipment.name} (${newEquipment.equipmentIdentifier})`,
      justificationNotes: `Registered equipment under category ${newEquipment.category}.`,
    });
    return { success: true, equipmentId: newEquipment.id };
  },

  updateEquipment: (updatedEquipment) => {
    set((state) => ({
      equipment: state.equipment.map((e) => (e.id === updatedEquipment.id ? updatedEquipment : e)),
    }));
  },

  updateEquipmentAvailability: (equipmentId, availabilityStatus) => {
    const now = new Date().toISOString();
    set((state) => ({
      equipment: state.equipment.map((e) =>
        e.id === equipmentId ? { ...e, availabilityStatus, availabilityUpdatedAt: now } : e,
      ),
    }));
  },

  // Assurance Sets
  assuranceSets: [...MOCK_ASSURANCE_SETS, ...PROJECT_SEED_ASSURANCE_SETS],
  addAssuranceSet: (newSet) => {
    const existingSets = get().assuranceSets;
    const titleCheck = isDuplicateCampaignTitle(newSet.title, existingSets, newSet.id);
    if (titleCheck.isDuplicate) {
      console.warn(`[MAP Duplicate Guard] ${titleCheck.reason}`);
      return;
    }

    const uniqueId = existingSets.some((s) => s.id === newSet.id)
      ? generateUniqueAssuranceSetId(existingSets)
      : newSet.id || generateUniqueAssuranceSetId(existingSets);

    const sanitizedRequirements = newSet.requirements?.map((r) => ({
      ...r,
      ocrConfidence: (r.documentId || r.linkedDocumentId) ? (r.ocrConfidence || 0) : 0,
    })) || [];

    const computedSet: AssuranceSet = {
      ...newSet,
      id: uniqueId,
      stage: newSet.stage || 'Initiated',
      requirements: sanitizedRequirements,
      readinessScore: calculateAssuranceSetReadiness({
        ...newSet,
        id: uniqueId,
        requirements: sanitizedRequirements,
      }),
    };
    set((state) => ({ assuranceSets: [...state.assuranceSets, computedSet] }));
    get().logAuditEvent({
      userId: 'USR-CURRENT',
      userRole: get().activePersona,
      organization: newSet.initiatorOrg,
      action: 'Initiated Assurance Set',
      targetAsset: `${computedSet.id} (${computedSet.title})`,
      justificationNotes: `Created assurance set for vessel ${computedSet.vesselName}`,
    });
  },
  updateAssuranceSet: (updatedSet) => {
    const sanitizedRequirements = updatedSet.requirements?.map((r) => ({
      ...r,
      ocrConfidence: (r.documentId || r.linkedDocumentId) ? (r.ocrConfidence || 0) : 0,
    })) || [];

    const computedSet: AssuranceSet = {
      ...updatedSet,
      requirements: sanitizedRequirements,
      readinessScore: calculateAssuranceSetReadiness({
        ...updatedSet,
        requirements: sanitizedRequirements,
      }),
    };

    set((state) => ({
      assuranceSets: state.assuranceSets.map((s) => (s.id === updatedSet.id ? computedSet : s)),
    }));
  },
  updateAssuranceStage: (setId, stage) => {
    set((state) => ({
      assuranceSets: state.assuranceSets.map((s) => {
        if (s.id !== setId) return s;
        const candidateSet: AssuranceSet = { ...s, stage };
        return {
          ...candidateSet,
          readinessScore: calculateAssuranceSetReadiness(candidateSet),
        };
      }),
    }));
  },
  updateAssuranceStakeholder: (setId, role, assigneeName) => {
    set((state) => ({
      assuranceSets: state.assuranceSets.map((s) => {
        if (s.id !== setId) return s;
        if (role === 'Submitter') {
          return { ...s, assignedSubmitter: assigneeName };
        }
        if (role === 'Verifier') {
          return { ...s, assignedVerifier: assigneeName, verificationRequired: true };
        }
        if (role === 'Inspector') {
          return { ...s, assignedInspector: assigneeName, mandatoryInspectionRequired: true };
        }
        if (role === 'Approver') {
          return { ...s, assignedApprover: assigneeName, formalApprovalRequired: true };
        }
        return s;
      }),
    }));
    get().logAuditEvent({
      userId: 'USR-CURRENT',
      userRole: get().activePersona,
      organization: get().activePersona === 'C Admin' ? 'Southern Basin Energy' : 'Northwind Marine',
      action: `Assigned Vessel ${role}`,
      targetAsset: `${setId} · ${assigneeName}`,
      justificationNotes: `Assigned ${role.toLowerCase()} ${assigneeName} to assurance campaign ${setId}`,
    });
  },
  updateAssuranceInspector: (setId, inspectorName) => {
    get().updateAssuranceStakeholder(setId, 'Inspector', inspectorName);
  },
  updateRequirementStatus: (setId, reqId, status, notes) => {
    const affectedDocIds = new Set<string>();

    set((state) => {
      const updatedSets = state.assuranceSets.map((s) => {
        if (s.id !== setId) return s;
        const updatedReqs = s.requirements.map((r) => {
          if (r.id === reqId) {
            if (r.documentId) affectedDocIds.add(r.documentId);
            if (r.linkedDocumentId) affectedDocIds.add(r.linkedDocumentId);
            return {
              ...r,
              verifierStatus: status,
              notes: notes || r.notes,
              isFulfilled: status === 'Verified',
            };
          }
          return r;
        });
        const allVerified =
          updatedReqs.length > 0 &&
          updatedReqs.every(
            (r) =>
              Boolean(r.documentId || r.linkedDocumentId || r.isFulfilled) &&
              (r.verifierStatus === 'Verified' || s.verificationRequired === false || r.isFulfilled)
          );

        let nextStage = s.stage;
        if (allVerified) {
          const routesToInspector =
            updatedReqs.some((r) => r.verificationRoute === 'Inspector') ||
            (s.mandatoryInspectionRequired && !s.inspectionCompleted);
          if (routesToInspector) {
            nextStage = 'Inspection';
          } else if (s.formalApprovalRequired !== false) {
            nextStage = 'Approval';
          } else {
            nextStage = 'Approved';
          }
        } else if (status === 'Correction Requested' || status === 'Rejected') {
          nextStage = 'Verification';
        }

        const candidateSet: AssuranceSet = {
          ...s,
          requirements: updatedReqs,
          stage: nextStage,
          approverDecision: allVerified
            ? (s.formalApprovalRequired !== false ? 'Pending' : 'Approved')
            : status === 'Verified'
              ? s.approverDecision
              : status === 'Correction Requested'
                ? 'Returned for Correction'
                : 'Rejected',
        };

        return {
          ...candidateSet,
          readinessScore: calculateAssuranceSetReadiness(candidateSet),
        };
      });

      const updatedDocs = state.documents.map((d) => {
        if (affectedDocIds.has(d.id)) {
          return { ...d, verificationStatus: status, verificationNotes: notes };
        }
        return d;
      });

      return {
        assuranceSets: updatedSets,
        documents: updatedDocs,
      };
    });

    const isDenial = status === 'Correction Requested' || status === 'Rejected';
    const actionTag = isDenial ? ' [PING: SUBMITTER ACTION REQUIRED]' : '';
    get().logAuditEvent({
      userId: get().activePersona === 'Approver' ? 'USR-APPROVE-01' : 'USR-VERIFY-01',
      userRole: get().activePersona,
      organization: get().activePersona === 'Approver' ? 'Marine Assurance Authority' : 'Compliance Services',
      action: `Requirement Verification: ${status}${actionTag}`,
      targetAsset: `${setId} / Requirement ${reqId}`,
      justificationNotes: notes || `Verifier status set to ${status}${isDenial ? ' — Submitter revision required.' : ''}`,
    });
  },
  denyRequirementByApprover: (setId, reqId, decision, notes) => {
    const affectedDocIds = new Set<string>();
    let requirementTitle = reqId;

    set((state) => {
      const updatedSets = state.assuranceSets.map((s) => {
        if (s.id !== setId) return s;

        const updatedReqs = s.requirements.map((r) => {
          if (r.id === reqId) {
            requirementTitle = r.title;
            if (r.documentId) affectedDocIds.add(r.documentId);
            if (r.linkedDocumentId) affectedDocIds.add(r.linkedDocumentId);
            return {
              ...r,
              verifierStatus: decision,
              isFulfilled: false,
              notes: notes || `Executive Approver returned document as ${decision}.`,
            };
          }
          return r;
        });

        const candidateSet: AssuranceSet = {
          ...s,
          requirements: updatedReqs,
          stage: 'Verification',
          approverDecision: decision === 'Correction Requested' ? 'Returned for Correction' : 'Rejected',
          approverNotes: notes,
        };

        return {
          ...candidateSet,
          readinessScore: calculateAssuranceSetReadiness(candidateSet),
        };
      });

      /* synchronize master documents matching the requirement */
      const updatedDocs = state.documents.map((d) => {
        const isMatchedDoc = affectedDocIds.has(d.id) ||
          d.title.toLowerCase() === requirementTitle.toLowerCase() ||
          (d.vesselId && state.assuranceSets.find((s) => s.id === setId)?.vesselId === d.vesselId &&
            d.title.toLowerCase().includes(requirementTitle.toLowerCase()));

        if (isMatchedDoc) {
          return {
            ...d,
            verificationStatus: decision,
            verificationNotes: notes || `Executive Approver set status to ${decision}. Submitter revision required.`,
          };
        }
        return d;
      });

      return {
        assuranceSets: updatedSets,
        documents: updatedDocs,
      };
    });

    get().logAuditEvent({
      userId: 'USR-APPROVE-01',
      userRole: get().activePersona,
      organization: 'Marine Assurance Authority',
      action: `Approver Denied Verified Document [PING: SUBMITTER ACTION REQUIRED]`,
      targetAsset: `${setId} / ${requirementTitle}`,
      justificationNotes: `Approver denied verified document (${decision}): ${notes || 'Revision requested from submitter.'}`,
    });
  },
  setApproverDecision: (setId, decision, notes) => {
    const isDenial = decision === 'Returned for Correction' || decision === 'Rejected';
    const mappedStatus: 'Correction Requested' | 'Rejected' =
      decision === 'Returned for Correction' ? 'Correction Requested' : 'Rejected';
    const affectedDocIds = new Set<string>();

    set((state) => {
      const targetSet = state.assuranceSets.find((s) => s.id === setId);

      const updatedSets = state.assuranceSets.map((s) => {
        if (s.id !== setId) return s;
        const newStage = decision === 'Approved' ? 'Approved' : 'Verification';

        const updatedReqs: AssuranceRequirement[] = isDenial
          ? s.requirements.map((r) => {
            if (r.documentId) affectedDocIds.add(r.documentId);
            if (r.linkedDocumentId) affectedDocIds.add(r.linkedDocumentId);
            return {
              ...r,
              verifierStatus: mappedStatus,
              isFulfilled: false,
              notes: notes || `Campaign returned to verification stage by Executive Approver.`,
            };
          })
          : s.requirements;

        const candidateSet: AssuranceSet = {
          ...s,
          requirements: updatedReqs,
          stage: newStage,
          approverDecision: decision,
          approverNotes: notes,
        };
        return {
          ...candidateSet,
          readinessScore: calculateAssuranceSetReadiness(candidateSet),
        };
      });

      /* when entire campaign is denied, cascade returned/rejected status to all linked documents */
      const updatedDocs = isDenial
        ? state.documents.map((d) => {
          const isSetLinked = affectedDocIds.has(d.id) || (targetSet && d.vesselId === targetSet.vesselId);
          if (isSetLinked) {
            return {
              ...d,
              verificationStatus: mappedStatus,
              verificationNotes: notes || `Approver ${decision}: Revision required for campaign ${setId}.`,
            };
          }
          return d;
        })
        : state.documents;

      return {
        assuranceSets: updatedSets,
        documents: updatedDocs,
      };
    });

    const pingTag = isDenial ? ' [PING: SUBMITTER ACTION REQUIRED]' : '';
    get().logAuditEvent({
      userId: 'USR-APPROVE-01',
      userRole: get().activePersona,
      organization: 'Marine Assurance Authority',
      action: `Approver Final Decision: ${decision}${pingTag}`,
      targetAsset: `Assurance Set ${setId}`,
      justificationNotes: notes || `Executive decision: ${decision}${isDenial ? ' — Submitter revision ping dispatched.' : ''}`,
    });
  },

  // Documents
  documents: MOCK_DOCUMENTS,
  addDocument: (doc) => {
    set((state) => ({ documents: [...state.documents, doc] }));
    get().logAuditEvent({
      userId: 'USR-SUBMIT-01',
      userRole: get().activePersona,
      organization: 'Vessel Provider Operations',
      action: 'Uploaded New Master Document',
      targetAsset: `${doc.id} (${doc.title})`,
      justificationNotes: `Uploaded certificate ${doc.certificateNo}`,
    });
  },
  linkDocumentToVessel: (docId, vesselId, vesselName, imoNumber) => {
    set((state) => ({
      documents: state.documents.map((d) => {
        if (d.id !== docId) return d;
        return {
          ...d,
          vesselId,
          vesselAttributes: d.vesselAttributes
            ? {
              ...d.vesselAttributes,
              vesselName: vesselName || d.vesselAttributes.vesselName,
              imoNumber: imoNumber || d.vesselAttributes.imoNumber,
            }
            : undefined,
        };
      }),
    }));
  },
  uploadDocumentForRequirement: (setId, requirementId, doc) => {
    set((state) => {
      const updatedSets = state.assuranceSets.map((s) => {
        if (s.id !== setId) return s;

        let updatedReqs = [...s.requirements];
        const targetReqExists = requirementId ? updatedReqs.some((r) => r.id === requirementId) : false;

        if (targetReqExists) {
          updatedReqs = updatedReqs.map((r) => {
            if (r.id !== requirementId) return r;
            return {
              ...r,
              documentId: doc.id,
              documentVersion: doc.currentVersion,
              verifierStatus: 'Pending' as const,
              isFulfilled: false,
              ocrConfidence: doc.ocrConfidence,
              notes: `Upload linked to requirement (${doc.versions[0]?.fileName || doc.title}).`,
            };
          });
        } else {
          const newReq: AssuranceRequirement = {
            id: `req-other-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
            category: doc.entityType === 'Crew Certificate' ? 'Crew Credential' : 'Statutory Certificate',
            title: doc.title,
            isMandatory: false,
            isFulfilled: false,
            ocrConfidence: doc.ocrConfidence || 99,
            documentId: doc.id,
            documentVersion: doc.currentVersion || 'v1.0',
            verifierStatus: 'Pending',
            isOtherDocument: true,
            notes: `Uploaded additional document (${doc.versions?.[0]?.fileName || doc.title}).`,
          };
          updatedReqs.push(newReq);
        }

        const hasLinkedDocuments = updatedReqs.some((r) => r.documentId);
        let nextStage = s.stage;
        if (hasLinkedDocuments && (s.stage === 'Initiated' || s.stage === 'Validation')) {
          if (s.verificationRequired !== false) {
            nextStage = 'Verification';
          } else {
            const allUploaded = updatedReqs.every((r) => r.documentId);
            if (allUploaded) {
              nextStage = s.mandatoryInspectionRequired && !s.inspectionCompleted
                ? 'Inspection'
                : s.formalApprovalRequired !== false
                  ? 'Approval'
                  : 'Approved';
            } else {
              nextStage = 'Validation';
            }
          }
        }

        const candidateSet: AssuranceSet = {
          ...s,
          requirements: updatedReqs,
          stage: nextStage,
        };

        return {
          ...candidateSet,
          readinessScore: calculateAssuranceSetReadiness(candidateSet),
        };
      });

      return {
        documents: state.documents.some((d) => d.id === doc.id) ? state.documents : [...state.documents, doc],
        assuranceSets: updatedSets,
      };
    });

    get().logAuditEvent({
      userId: 'USR-SUBMIT-01',
      userRole: get().activePersona,
      organization: 'Vessel Provider Operations',
      action: 'Uploaded Document for Assurance Requirement',
      targetAsset: `${doc.id} -> ${setId} / ${requirementId || 'Other Documents'}`,
      justificationNotes: `Upload: ${doc.title} (${doc.certificateNo}) queued for verifier review.`,
    });
  },
  addDocumentVersion: (docId, newVersionLabel, fileName, fileSizeBytes, changeSummary) => {
    set((state) => {
      const updatedDocs = state.documents.map((d) => {
        if (d.id !== docId) return d;
        const newVersionObj = {
          versionLabel: newVersionLabel,
          uploadedAt: new Date().toISOString(),
          uploadedBy: 'Ops Submitter',
          fileSizeBytes,
          fileName,
          changeSummary,
        };
        return {
          ...d,
          currentVersion: newVersionLabel,
          ocrConfidence: 98,
          verificationStatus: 'Pending' as const,
          versions: [newVersionObj, ...d.versions],
        };
      });
      const targetDoc = updatedDocs.find((d) => d.id === docId);

      const updatedSets = state.assuranceSets.map((s) => {
        let hasMatchedReq = false;
        const updatedReqs = s.requirements.map((r) => {
          if (r.documentId === docId || (targetDoc && r.title.toLowerCase() === targetDoc.title.toLowerCase())) {
            hasMatchedReq = true;
            return {
              ...r,
              documentId: docId,
              documentVersion: newVersionLabel,
              verifierStatus: 'Pending' as const,
              isFulfilled: false,
              ocrConfidence: 98,
              notes: changeSummary || `Replacement revision ${newVersionLabel} uploaded by submitter.`,
            };
          }
          return r;
        });

        if (!hasMatchedReq) return s;

        const candidateSet: AssuranceSet = {
          ...s,
          requirements: updatedReqs,
          stage: 'Verification' as const,
        };

        return {
          ...candidateSet,
          readinessScore: calculateAssuranceSetReadiness(candidateSet),
        };
      });

      return {
        documents: updatedDocs,
        assuranceSets: updatedSets,
      };
    });

    get().logAuditEvent({
      userId: 'USR-SUBMIT-01',
      userRole: get().activePersona,
      organization: 'Vessel Provider Operations',
      action: `Uploaded Document Revision ${newVersionLabel}`,
      targetAsset: `Document ${docId}`,
      justificationNotes: changeSummary,
    });
  },
  verifyDocument: (docId, status, notes, routeTarget) => {
    set((state) => {
      const updatedDocs = state.documents.map((d) =>
        d.id === docId ? { ...d, verificationStatus: status, verificationNotes: notes } : d
      );
      const targetDoc = updatedDocs.find((d) => d.id === docId);

      const updatedSets = state.assuranceSets.map((s) => {
        let hasMatchedReq = false;

        const updatedReqs = s.requirements.map((r) => {
          const isDocIdMatch = r.documentId === docId;
          const isTitleMatch = targetDoc && r.title.toLowerCase() === targetDoc.title.toLowerCase();
          const isSubTitleMatch = targetDoc && (
            r.title.toLowerCase().includes(targetDoc.title.toLowerCase()) ||
            targetDoc.title.toLowerCase().includes(r.title.toLowerCase())
          );

          if (isDocIdMatch || isTitleMatch || (s.vesselId === targetDoc?.vesselId && isSubTitleMatch)) {
            hasMatchedReq = true;
            return {
              ...r,
              documentId: docId,
              verifierStatus: status,
              isFulfilled: status === 'Verified',
              ocrConfidence: targetDoc?.ocrConfidence || 98,
              notes: notes || r.notes,
              verificationRoute:
                status === 'Verified' && routeTarget ? routeTarget : r.verificationRoute,
            };
          }
          return r;
        });

        if (!hasMatchedReq) return s;

        const allVerified = updatedReqs.length > 0 && updatedReqs.every((r) => r.verifierStatus === 'Verified' || s.verificationRequired === false);

        let nextStage = s.stage;
        if (allVerified) {
          const routesToInspector =
            updatedReqs.some((r) => r.verificationRoute === 'Inspector') ||
            (s.mandatoryInspectionRequired && !s.inspectionCompleted);
          if (routesToInspector) {
            nextStage = 'Inspection';
          } else if (s.formalApprovalRequired !== false) {
            nextStage = 'Approval';
          } else {
            nextStage = 'Approved';
          }
        } else if (status === 'Correction Requested' || status === 'Rejected') {
          nextStage = 'Verification';
        }

        const candidateSet: AssuranceSet = {
          ...s,
          requirements: updatedReqs,
          stage: nextStage,
          approverDecision: allVerified
            ? (s.formalApprovalRequired !== false ? 'Pending' : 'Approved')
            : status === 'Verified'
              ? s.approverDecision
              : status === 'Correction Requested'
                ? 'Returned for Correction'
                : 'Rejected',
        };

        return {
          ...candidateSet,
          readinessScore: calculateAssuranceSetReadiness(candidateSet),
        };
      });

      return {
        documents: updatedDocs,
        assuranceSets: updatedSets,
      };
    });

    const isDenial = status === 'Correction Requested' || status === 'Rejected';
    const pingTag = isDenial ? ' [PING: SUBMITTER ACTION REQUIRED]' : '';
    const routeNote = routeTarget ? ` | Routed to ${routeTarget}` : '';
    const activePersona = get().activePersona;
    get().logAuditEvent({
      userId: activePersona === 'Approver' ? 'USR-APPROVE-01' : 'USR-VERIFY-01',
      userRole: activePersona,
      organization: activePersona === 'Approver' ? 'Marine Assurance Authority' : 'Verifier Inspectorate',
      action: `${activePersona === 'Approver' ? 'Approver' : 'Verifier'} Document Action: ${status}${pingTag}`,
      targetAsset: `Document ${docId}`,
      justificationNotes: `${notes || `Verification status updated to ${status}`}${routeNote}${isDenial ? ' — Submitter revision required.' : ''}`,
    });
  },

  // Audit Events
  auditEvents: MOCK_AUDIT_TRAIL,
  logAuditEvent: (eventData) => {
    const newEvent: AuditTrailEvent = {
      id: `AUD-${Math.floor(10000 + Math.random() * 90000)}`,
      timestampUtc: new Date().toISOString(),
      ...eventData,
    };
    set((state) => ({ auditEvents: [newEvent, ...state.auditEvents] }));
  },

  /* user management store state and actions */
  users: MOCK_USERS,
  addUser: (newUser) => {
    const activePersona = get().activePersona;
    const preparedUser: UserProfile = {
      ...newUser,
      createdBy: newUser.createdBy || activePersona,
      invitedBy: newUser.invitedBy || (newUser.status === 'Pending Invitation' ? activePersona : undefined),
    };
    set((state) => ({ users: [preparedUser, ...state.users] }));
    get().logAuditEvent({
      userId: 'USR-CURRENT',
      userRole: activePersona,
      organization: 'Northwind Marine Pty Ltd',
      action: `Provisioned New User Profile (${preparedUser.userType})`,
      targetAsset: `${preparedUser.name} (${preparedUser.email})`,
      justificationNotes: `Added ${preparedUser.userType} user assigned as ${preparedUser.roles.join(', ')} for ${preparedUser.organization}.`,
    });
  },
  updateUser: (updatedUser) => {
    set((state) => ({
      users: state.users.map((u) => (u.id === updatedUser.id ? updatedUser : u)),
    }));
    get().logAuditEvent({
      userId: 'USR-CURRENT',
      userRole: get().activePersona,
      organization: 'Northwind Marine Pty Ltd',
      action: 'Updated User Profile',
      targetAsset: `${updatedUser.name} (${updatedUser.email})`,
      justificationNotes: `Updated user profile for ${updatedUser.name} (${updatedUser.roles.join(', ')}, ${updatedUser.userType}).`,
    });
  },
  updateUserStatus: (userId, status) => {
    set((state) => ({
      users: state.users.map((u) => (u.id === userId ? { ...u, status } : u)),
    }));
  },

  rolePermissionDefaults: BRD_PERMISSION_DEFAULTS,
  userPermissionOverrides: {},
  customRoles: [],
  customScopes: [],
  customCategories: [],
  setRolePermissionFlag: (role, scopeKey, action, value) => {
    const guarded = applyPermissionGuards(
      scopeKey,
      role,
      {
        ...(get().rolePermissionDefaults[role]?.[scopeKey] ?? emptyCrud()),
        [action]: value,
      },
      get().customScopes,
    );
    set((state) => ({
      rolePermissionDefaults: {
        ...state.rolePermissionDefaults,
        [role]: {
          ...state.rolePermissionDefaults[role],
          [scopeKey]: guarded,
        },
      },
    }));
    const scopeLabel =
      [...PERMISSION_SCOPE_CATALOG, ...get().customScopes].find((s) => s.key === scopeKey)?.label ??
      scopeKey;
    get().logAuditEvent({
      userId: 'USR-ADMIN',
      userRole: get().activePersona,
      organization: 'Northwind Marine Pty Ltd',
      action: 'Updated Role Permission Default',
      targetAsset: `${role} · ${scopeLabel} · ${action}`,
      justificationNotes: `Set ${action} to ${value ? 'allowed' : 'denied'} for role ${role} on "${scopeLabel}".`,
    });
  },
  commitRolePermissionDefaults: (matrix) => {
    set({ rolePermissionDefaults: matrix });
    get().logAuditEvent({
      userId: 'USR-ADMIN',
      userRole: get().activePersona,
      organization: 'Northwind Marine Pty Ltd',
      action: 'Saved Role Permission Defaults',
      targetAsset: 'Role Rights Matrix',
      justificationNotes: 'Administrator committed role-default permission changes.',
    });
  },
  commitUserPermissionOverrides: (overrides) => {
    set({ userPermissionOverrides: overrides });
    get().logAuditEvent({
      userId: 'USR-ADMIN',
      userRole: get().activePersona,
      organization: 'Northwind Marine Pty Ltd',
      action: 'Saved User Permission Overrides',
      targetAsset: 'User Rights Matrix',
      justificationNotes: 'Administrator committed per-user permission overrides.',
    });
  },
  resetRolePermissionsToBrd: () => {
    set({
      rolePermissionDefaults: buildBrdRolePermissionDefaults(),
      userPermissionOverrides: {},
      customRoles: [],
      customScopes: [],
      customCategories: [],
    });
    get().logAuditEvent({
      userId: 'USR-ADMIN',
      userRole: get().activePersona,
      organization: 'Northwind Marine Pty Ltd',
      action: 'Reset Role Permissions to BRD Defaults',
      targetAsset: 'Role Rights Matrix',
      justificationNotes: 'Restored BRD-seeded CRUD defaults and cleared custom roles/scopes/categories/overrides.',
    });
  },
  setUserPermissionOverride: (userId, scopeKey, action, value) => {
    set((state) => {
      const userOverrides = { ...(state.userPermissionOverrides[userId] || {}) };
      const scopePatch = { ...(userOverrides[scopeKey] || {}), [action]: value };
      userOverrides[scopeKey] = scopePatch;
      return {
        userPermissionOverrides: {
          ...state.userPermissionOverrides,
          [userId]: userOverrides,
        },
      };
    });
    const scopeLabel =
      [...PERMISSION_SCOPE_CATALOG, ...get().customScopes].find((s) => s.key === scopeKey)?.label ??
      scopeKey;
    const userName = get().users.find((u) => u.id === userId)?.name ?? userId;
    get().logAuditEvent({
      userId: 'USR-ADMIN',
      userRole: get().activePersona,
      organization: 'Northwind Marine Pty Ltd',
      action: 'Updated User Permission Override',
      targetAsset: `${userName} · ${scopeLabel} · ${action}`,
      justificationNotes: `Override ${action}=${value} for ${userName} on "${scopeLabel}".`,
    });
  },
  clearUserPermissionOverrides: (userId) => {
    set((state) => {
      const next = { ...state.userPermissionOverrides };
      delete next[userId];
      return { userPermissionOverrides: next };
    });
    get().logAuditEvent({
      userId: 'USR-ADMIN',
      userRole: get().activePersona,
      organization: 'Northwind Marine Pty Ltd',
      action: 'Cleared User Permission Overrides',
      targetAsset: userId,
      justificationNotes: `Restored user ${userId} to role-default permissions.`,
    });
  },
  addCustomRole: (roleName) => {
    const name = roleName.trim();
    if (!name) return { success: false, message: 'Role name is required.' };
    const existing = [...ALL_ROLE_PERSONAS, ...get().customRoles];
    if (existing.some((r) => r.toLowerCase() === name.toLowerCase())) {
      return { success: false, message: 'A role with this name already exists.' };
    }
    const catalog = [...PERMISSION_SCOPE_CATALOG, ...get().customScopes];
    set((state) => ({
      customRoles: [...state.customRoles, name],
      rolePermissionDefaults: {
        ...state.rolePermissionDefaults,
        [name]: buildEmptyFlagsForCatalog(catalog),
      },
    }));
    get().logAuditEvent({
      userId: 'USR-ADMIN',
      userRole: get().activePersona,
      organization: 'Northwind Marine Pty Ltd',
      action: 'Created Custom Role',
      targetAsset: name,
      justificationNotes: `Added custom role "${name}" with empty CRUD defaults.`,
    });
    return { success: true };
  },
  addCustomCategory: (categoryName) => {
    const name = categoryName.trim();
    if (!name) return { success: false, message: 'Category name is required.' };
    const existing = [...BUILTIN_PERMISSION_CATEGORIES, ...get().customCategories];
    if (existing.some((c) => c.toLowerCase() === name.toLowerCase())) {
      return { success: false, message: 'A category with this name already exists.' };
    }
    set((state) => ({
      customCategories: [...state.customCategories, name],
    }));
    get().logAuditEvent({
      userId: 'USR-ADMIN',
      userRole: get().activePersona,
      organization: 'Northwind Marine Pty Ltd',
      action: 'Created Permission Category',
      targetAsset: name,
      justificationNotes: `Added permission category "${name}".`,
    });
    return { success: true };
  },
  addCustomScope: ({ label, description, category }) => {
    const trimmed = label.trim();
    if (!trimmed) return { success: false, message: 'Feature / scope name is required.' };
    const categoryName = category.trim();
    if (!categoryName) return { success: false, message: 'Category is required.' };

    let key = `custom_${slugifyPermissionKey(trimmed)}`;
    const allKeys = new Set([
      ...PERMISSION_SCOPE_CATALOG.map((s) => s.key),
      ...get().customScopes.map((s) => s.key),
    ]);
    if (allKeys.has(key)) key = `${key}_${Date.now()}`;

    const def: PermissionScopeDefinition = {
      key,
      label: trimmed,
      description: description.trim() || 'Feature scope added by administrator.',
      category: categoryName,
      isCustom: true,
    };

    set((state) => {
      const nextMatrix: RolePermissionMatrix = { ...state.rolePermissionDefaults };
      for (const role of Object.keys(nextMatrix)) {
        nextMatrix[role] = {
          ...nextMatrix[role],
          [key]: emptyCrud(),
        };
      }
      const cats = state.customCategories;
      const known =
        BUILTIN_PERMISSION_CATEGORIES.some((c) => c.toLowerCase() === categoryName.toLowerCase()) ||
        cats.some((c) => c.toLowerCase() === categoryName.toLowerCase());
      return {
        customScopes: [...state.customScopes, def],
        rolePermissionDefaults: nextMatrix,
        customCategories: known ? cats : [...cats, categoryName],
      };
    });
    get().logAuditEvent({
      userId: 'USR-ADMIN',
      userRole: get().activePersona,
      organization: 'Northwind Marine Pty Ltd',
      action: 'Created Custom Permission Scope',
      targetAsset: trimmed,
      justificationNotes: `Added permission "${trimmed}" under category "${categoryName}".`,
    });
    return { success: true, key };
  },

  // Crew Directory
  crew: MOCK_CREW,
  addCrewMember: (newCrew) => {
    const activePersona = get().activePersona;
    /* convert all layer 1 and layer 2 certificates attached to new crew into MasterDocument entries */
    const allCrewDocs = [...newCrew.layer1CoreDocuments, ...newCrew.layer2Endorsements];
    const newMasterDocs: MasterDocument[] = allCrewDocs.map((doc) => {
      const isExpired = doc.verificationStatus === 'Expired' || new Date(doc.expiryDate).getTime() < Date.now();
      return {
        id: doc.id,
        title: `${doc.title} — ${newCrew.fullName}`,
        entityType: 'Crew Certificate',
        vesselId: newCrew.currentVesselId || '',
        certificateNo: doc.certificateNo,
        issuingAuthority: doc.issuingAuthority,
        expiryDate: doc.expiryDate,
        ocrConfidence: 98.5,
        complianceState: isExpired ? 'Expired' : doc.verificationStatus === 'Expiring' ? 'Expiring < 6 Mos' : 'Valid',
        currentVersion: 'v1.0',
        versions: [
          {
            versionLabel: 'v1.0',
            uploadedAt: new Date().toISOString(),
            uploadedBy: activePersona || 'Crewing Administrator',
            fileSizeBytes: doc.fileSizeBytes || 1500000,
            fileName: doc.fileName || `${doc.title.toLowerCase().replace(/\s+/g, '_')}.pdf`,
            changeSummary: `Uploaded ${doc.layer} certificate for STCW compliance tracking.`,
          },
        ],
        crewAttributes: {
          crewName: newCrew.fullName,
          passportId: newCrew.passportNo,
          rank: newCrew.rank,
          certType: doc.stcwRegulation || doc.title,
          issuingCenter: doc.issuingAuthority,
          issueDate: doc.issueDate,
          expiryDate: doc.expiryDate,
          assignedVessel: newCrew.currentVesselName || '',
          nationality: newCrew.nationality,
          trainingDate: doc.issueDate,
          ocrConfidence: 98.5,
        },
        validationRules: {
          charterBufferPassed: !isExpired,
          assetMatch100Percent: true,
          iacsAuthorityValid: true,
          overallValid: !isExpired,
          exceptionDetails: isExpired ? `Certificate expired on ${doc.expiryDate}. Immediate renewal required.` : undefined,
        },
        verificationStatus: isExpired ? 'Correction Requested' : 'Verified',
        verificationNotes: isExpired ? 'Expired certificate. Please upload updated renewal scan.' : undefined,
      };
    });

    set((state) => {
      const existingDocIds = new Set(state.documents.map((d) => d.id));
      const filteredNewDocs = newMasterDocs.filter((d) => !existingDocIds.has(d.id));
      return {
        crew: [newCrew, ...state.crew],
        documents: [...filteredNewDocs, ...state.documents],
      };
    });

    get().logAuditEvent({
      userId: 'USR-CURRENT',
      userRole: get().activePersona,
      organization: 'Northwind Marine Pty Ltd',
      action: 'Registered Crew Member',
      targetAsset: `${newCrew.fullName} (${newCrew.rank})`,
      justificationNotes: `Registered crew member with Seaman's Book ${newCrew.seamansBookNo}`,
    });
  },
  assignCrewToVessel: (crewId, vesselId) => {
    const vessel = get().vessels.find((v) => v.id === vesselId);
    set((state) => {
      const targetCrew = state.crew.find((c) => c.id === crewId);
      const crewName = targetCrew?.fullName;
      const updatedCrew = state.crew.map((c) => {
        if (c.id !== crewId) return c;
        if (!vesselId) {
          return {
            ...c,
            currentVesselId: undefined,
            currentVesselName: undefined,
          };
        }
        const existingAssignments = c.assignments || [];
        const newAssignment = {
          id: `ASG-${Math.floor(600 + Math.random() * 300)}`,
          vesselId: vessel!.id,
          vesselName: vessel!.name,
          imoNumber: vessel!.imoNumber,
          vesselType: vessel!.classificationSociety ? `${vessel!.classificationSociety} Vessel` : 'Offshore Support Vessel',
          rankHeld: c.rank,
          embarkDate: new Date().toISOString().split('T')[0],
          isCurrent: true,
        };
        const updatedAssignments = [newAssignment, ...existingAssignments.map((a) => ({ ...a, isCurrent: false }))];
        return {
          ...c,
          currentVesselId: vessel!.id,
          currentVesselName: `${vessel!.name} (IMO ${vessel!.imoNumber})`,
          assignments: updatedAssignments,
        };
      });

      /* update corresponding documents in document library with new vessel association */
      const updatedDocuments = state.documents.map((d) => {
        if (d.entityType === 'Crew Certificate' && d.crewAttributes?.crewName === crewName) {
          return {
            ...d,
            vesselId: vesselId || '',
            crewAttributes: d.crewAttributes
              ? {
                ...d.crewAttributes,
                assignedVessel: vessel ? `${vessel.name} (IMO ${vessel.imoNumber})` : '',
              }
              : undefined,
          };
        }
        return d;
      });

      return {
        crew: updatedCrew,
        documents: updatedDocuments,
      };
    });

    get().logAuditEvent({
      userId: 'USR-ADMIN-01',
      userRole: get().activePersona,
      organization: 'Northwind Marine',
      action: 'Updated Crew Vessel Assignment',
      targetAsset: `Crew ${crewId}`,
      justificationNotes: vesselId ? `Assigned crew ${crewId} to vessel ${vessel?.name}` : `Unassigned crew ${crewId}`,
    });
  },
  addCrewDocument: (crewId, doc) => {
    const targetCrew = get().crew.find((c) => c.id === crewId);
    const activePersona = get().activePersona;
    const isExpired = doc.verificationStatus === 'Expired' || new Date(doc.expiryDate).getTime() < Date.now();
    const newMasterDoc: MasterDocument = {
      id: doc.id,
      title: targetCrew ? `${doc.title} — ${targetCrew.fullName}` : doc.title,
      entityType: 'Crew Certificate',
      vesselId: targetCrew?.currentVesselId || '',
      certificateNo: doc.certificateNo,
      issuingAuthority: doc.issuingAuthority,
      expiryDate: doc.expiryDate,
      ocrConfidence: 98.5,
      complianceState: isExpired ? 'Expired' : doc.verificationStatus === 'Expiring' ? 'Expiring < 6 Mos' : 'Valid',
      currentVersion: 'v1.0',
      versions: [
        {
          versionLabel: 'v1.0',
          uploadedAt: new Date().toISOString(),
          uploadedBy: activePersona || 'Crewing Administrator',
          fileSizeBytes: doc.fileSizeBytes || 1500000,
          fileName: doc.fileName || `${doc.title.toLowerCase().replace(/\s+/g, '_')}.pdf`,
          changeSummary: `Uploaded ${doc.layer} certificate for STCW compliance tracking.`,
        },
      ],
      crewAttributes: targetCrew
        ? {
          crewName: targetCrew.fullName,
          passportId: targetCrew.passportNo,
          rank: targetCrew.rank,
          certType: doc.stcwRegulation || doc.title,
          issuingCenter: doc.issuingAuthority,
          issueDate: doc.issueDate,
          expiryDate: doc.expiryDate,
          assignedVessel: targetCrew.currentVesselName || '',
          nationality: targetCrew.nationality,
          trainingDate: doc.issueDate,
          ocrConfidence: 98.5,
        }
        : undefined,
      validationRules: {
        charterBufferPassed: !isExpired,
        assetMatch100Percent: true,
        iacsAuthorityValid: true,
        overallValid: !isExpired,
        exceptionDetails: isExpired ? `Certificate expired on ${doc.expiryDate}. Immediate renewal required.` : undefined,
      },
      verificationStatus: isExpired ? 'Correction Requested' : 'Verified',
      verificationNotes: isExpired ? 'Expired certificate. Please upload updated renewal scan.' : undefined,
    };

    set((state) => ({
      crew: state.crew.map((c) => {
        if (c.id !== crewId) return c;
        const isLayer1 = doc.layer === 'Layer 1 - Universal Core';
        const updatedL1 = isLayer1 ? [doc, ...c.layer1CoreDocuments] : c.layer1CoreDocuments;
        const updatedL2 = !isLayer1 ? [doc, ...c.layer2Endorsements] : c.layer2Endorsements;
        return {
          ...c,
          layer1CoreDocuments: updatedL1,
          layer2Endorsements: updatedL2,
          lastAuditedDate: new Date().toISOString().split('T')[0],
        };
      }),
      documents: [newMasterDoc, ...state.documents.filter((d) => d.id !== doc.id)],
    }));

    get().logAuditEvent({
      userId: 'USR-CURRENT',
      userRole: get().activePersona,
      organization: 'Northwind Marine Pty Ltd',
      action: `Uploaded Crew STCW Document (${doc.title})`,
      targetAsset: `Crew ${crewId} / ${doc.certificateNo}`,
      justificationNotes: `Uploaded ${doc.layer} certificate for STCW compliance tracking.`,
    });
  },
  updateCrewDocument: (crewId, doc) => {
    const targetCrew = get().crew.find((c) => c.id === crewId);
    const activePersona = get().activePersona;
    const isExpired = doc.verificationStatus === 'Expired' || new Date(doc.expiryDate).getTime() < Date.now();

    set((state) => {
      const updatedCrew = state.crew.map((c) => {
        if (c.id !== crewId) return c;
        const filteredL1 = c.layer1CoreDocuments.filter((d) => d.id !== doc.id);
        const filteredL2 = c.layer2Endorsements.filter((d) => d.id !== doc.id);
        const isLayer1 = doc.layer === 'Layer 1 - Universal Core';
        const updatedL1 = isLayer1 ? [doc, ...filteredL1] : filteredL1;
        const updatedL2 = !isLayer1 ? [doc, ...filteredL2] : filteredL2;
        return {
          ...c,
          layer1CoreDocuments: updatedL1,
          layer2Endorsements: updatedL2,
          lastAuditedDate: new Date().toISOString().split('T')[0],
        };
      });

      const existingDoc = state.documents.find((d) => d.id === doc.id);
      const updatedDocuments = existingDoc
        ? state.documents.map((d) => {
          if (d.id !== doc.id) return d;
          return {
            ...d,
            title: targetCrew ? `${doc.title} — ${targetCrew.fullName}` : doc.title,
            certificateNo: doc.certificateNo,
            issuingAuthority: doc.issuingAuthority,
            expiryDate: doc.expiryDate,
            complianceState: isExpired ? ('Expired' as const) : doc.verificationStatus === 'Expiring' ? ('Expiring < 6 Mos' as const) : ('Valid' as const),
            verificationStatus: isExpired ? ('Correction Requested' as const) : ('Verified' as const),
            versions: [
              {
                versionLabel: `v${d.versions.length + 1}.0`,
                uploadedAt: new Date().toISOString(),
                uploadedBy: activePersona || 'Crewing Administrator',
                fileSizeBytes: doc.fileSizeBytes || 1500000,
                fileName: doc.fileName || d.versions[0]?.fileName || 'updated_cert.pdf',
                changeSummary: `Reuploaded / updated ${doc.layer} certificate.`,
              },
              ...d.versions,
            ],
          };
        })
        : [
          {
            id: doc.id,
            title: targetCrew ? `${doc.title} — ${targetCrew.fullName}` : doc.title,
            entityType: 'Crew Certificate' as const,
            vesselId: targetCrew?.currentVesselId || '',
            certificateNo: doc.certificateNo,
            issuingAuthority: doc.issuingAuthority,
            expiryDate: doc.expiryDate,
            ocrConfidence: 98.5,
            complianceState: isExpired ? ('Expired' as const) : ('Valid' as const),
            currentVersion: 'v1.0',
            versions: [
              {
                versionLabel: 'v1.0',
                uploadedAt: new Date().toISOString(),
                uploadedBy: activePersona || 'Crewing Administrator',
                fileSizeBytes: doc.fileSizeBytes || 1500000,
                fileName: doc.fileName || 'cert.pdf',
                changeSummary: `Uploaded ${doc.layer} certificate.`,
              },
            ],
            crewAttributes: targetCrew
              ? {
                crewName: targetCrew.fullName,
                passportId: targetCrew.passportNo,
                rank: targetCrew.rank,
                certType: doc.stcwRegulation || doc.title,
                issuingCenter: doc.issuingAuthority,
                issueDate: doc.issueDate,
                expiryDate: doc.expiryDate,
                assignedVessel: targetCrew.currentVesselName || '',
                nationality: targetCrew.nationality,
                trainingDate: doc.issueDate,
                ocrConfidence: 98.5,
              }
              : undefined,
            validationRules: {
              charterBufferPassed: !isExpired,
              assetMatch100Percent: true,
              iacsAuthorityValid: true,
              overallValid: !isExpired,
            },
            verificationStatus: isExpired ? ('Correction Requested' as const) : ('Verified' as const),
          },
          ...state.documents,
        ];

      return {
        crew: updatedCrew,
        documents: updatedDocuments,
      };
    });

    get().logAuditEvent({
      userId: 'USR-CURRENT',
      userRole: get().activePersona,
      organization: 'Northwind Marine Pty Ltd',
      action: `Updated / Reuploaded Crew STCW Document (${doc.title})`,
      targetAsset: `Crew ${crewId} / ${doc.certificateNo}`,
      justificationNotes: `Reuploaded / updated ${doc.layer} certificate status (${doc.verificationStatus}), expiry date ${doc.expiryDate}.`,
    });
  },
  deleteCrewDocument: (crewId, docId) => {
    set((state) => ({
      crew: state.crew.map((c) => {
        if (c.id !== crewId) return c;
        const updatedL1 = c.layer1CoreDocuments.filter((d) => d.id !== docId);
        const updatedL2 = c.layer2Endorsements.filter((d) => d.id !== docId);
        return {
          ...c,
          layer1CoreDocuments: updatedL1,
          layer2Endorsements: updatedL2,
          lastAuditedDate: new Date().toISOString().split('T')[0],
        };
      }),
      documents: state.documents.filter((d) => d.id !== docId),
    }));
    get().logAuditEvent({
      userId: 'USR-CURRENT',
      userRole: get().activePersona,
      organization: 'Northwind Marine Pty Ltd',
      action: 'Deleted Crew STCW Document',
      targetAsset: `Crew ${crewId} / Doc ${docId}`,
      justificationNotes: 'Removed STCW certificate record from crew profile.',
    });
  },

  isAuditDrawerOpen: false,
  setAuditDrawerOpen: (open) => set({ isAuditDrawerOpen: open }),

  // CAPA Management Store Implementation
  capaItems: MOCK_CAPA_ITEMS,
  addCapaItem: (capa) => set((state) => ({ capaItems: [capa, ...state.capaItems] })),
  updateCapaStatus: (capaId, status, inspectorNotes) => {
    set((state) => ({
      capaItems: state.capaItems.map((item) =>
        item.id === capaId
          ? {
            ...item,
            status,
            inspectorNotes: inspectorNotes !== undefined ? inspectorNotes : item.inspectorNotes,
            lastInspectedDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
          }
          : item
      ),
    }));
  },
  addCapaEvidence: (capaId, evidence) => {
    set((state) => ({
      capaItems: state.capaItems.map((item) =>
        item.id === capaId ? { ...item, evidences: [...item.evidences, evidence] } : item
      ),
    }));
  },
  removeCapaEvidence: (capaId, evidenceId) => {
    set((state) => ({
      capaItems: state.capaItems.map((item) =>
        item.id === capaId
          ? { ...item, evidences: item.evidences.filter((ev) => ev.id !== evidenceId) }
          : item
      ),
    }));
  },
  flagCapaForReinspection: (capaId, reason) => {
    set((state) => ({
      capaItems: state.capaItems.map((item) =>
        item.id === capaId
          ? {
            ...item,
            status: 'Under Re-Inspection',
            flaggedForReinspection: true,
            cadminFlagReason: reason?.trim() || 'Re-inspection requested by C Admin charterer',
            flaggedByCAdminDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
          }
          : item
      ),
    }));
    get().logAuditEvent({
      userId: 'USR-CADMIN-01',
      userRole: get().activePersona,
      organization: 'Charterer Organization',
      action: `Flagged CAPA (${capaId}) for Re-Inspection`,
      targetAsset: `CAPA ${capaId}`,
      justificationNotes: reason || 'C Admin requested re-inspection verification by inspector',
    });
  },
}));
