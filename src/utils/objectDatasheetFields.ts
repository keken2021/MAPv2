/* 
  file summary: pure field definitions, extractors, and snapshot helpers for linked object datasheets.
  responsibilities: maps vessels, equipment, crew, and activities to read-only live datasheet field structures, and captures sign-off snapshots.
  role in system: consumed by LinkedObjectDatasheetDrawer.tsx, useMapStore.ts, and tests.
*/

import type { VesselInformation } from '../types/vessel';
import type { EquipmentAsset } from '../types/equipment';
import type { CrewMember } from '../types/crew';
import type {
  AssuranceObject,
  AssuranceObjectType,
  AssuranceSet,
  DatasheetSnapshot,
} from '../types/assurance';
import type { UserRolePersona } from '../types/audit';
import { getAssuranceSetObjects } from './assuranceTemplates';

export interface ObjectDatasheetField {
  key: string;
  label: string;
  value: string | number | undefined | null;
  displayValue: string;
  isMono?: boolean;
}

export interface ObjectDatasheetData {
  objectId: string;
  type: AssuranceObjectType;
  title: string;
  subtitle?: string;
  fields: ObjectDatasheetField[];
}

export interface ObjectStoreSnapshotSource {
  vessels: VesselInformation[];
  equipment: EquipmentAsset[];
  crew: CrewMember[];
  assuranceObjects?: AssuranceObject[];
}

/**
 * Builds the read-only live datasheet field list for a linked assurance object.
 * - Vessel: A6 public fields + dimensions.
 * - Equipment: name, serial/tag, type, manufacturer, model, owning organization, parent vessel name as text.
 * - Person: name, rank/role, employer, nationality, no contact details.
 */
export function getObjectDatasheet(
  objectId: string,
  objectType: AssuranceObjectType,
  store: ObjectStoreSnapshotSource,
): ObjectDatasheetData | null {
  if (objectType === 'vessel') {
    const vessel = store.vessels.find((v) => v.id === objectId || v.name === objectId);
    if (!vessel) return null;

    const fields: ObjectDatasheetField[] = [
      {
        key: 'name',
        label: 'Vessel Name',
        value: vessel.name,
        displayValue: vessel.name || '—',
      },
      {
        key: 'imoNumber',
        label: 'IMO Number',
        value: vessel.imoNumber,
        displayValue: vessel.imoNumber || '—',
        isMono: true,
      },
      {
        key: 'flagState',
        label: 'Flag State',
        value: vessel.flagState,
        displayValue: vessel.flagState || '—',
      },
      {
        key: 'vesselType',
        label: 'Vessel Type',
        value: vessel.vesselSubtype || vessel.vesselType,
        displayValue: vessel.vesselSubtype || vessel.vesselType || '—',
      },
      {
        key: 'classificationSociety',
        label: 'Classification Society',
        value: vessel.classificationSociety,
        displayValue: vessel.classificationSociety || '—',
      },
      {
        key: 'yearBuilt',
        label: 'Year of Build',
        value: vessel.yearBuilt,
        displayValue: vessel.yearBuilt ? String(vessel.yearBuilt) : '—',
      },
      {
        key: 'registeredOwner',
        label: 'Registered Owner Organization',
        value: vessel.registeredOwner,
        displayValue: vessel.registeredOwner || '—',
      },
      {
        key: 'lengthOverallMeters',
        label: 'Length Overall',
        value: vessel.lengthOverallMeters,
        displayValue: vessel.lengthOverallMeters ? `${vessel.lengthOverallMeters} m` : '—',
      },
      {
        key: 'beamMeters',
        label: 'Beam',
        value: vessel.beamMeters,
        displayValue: vessel.beamMeters ? `${vessel.beamMeters} m` : '—',
      },
      {
        key: 'draftMeters',
        label: 'Draft',
        value: vessel.draftMeters,
        displayValue: vessel.draftMeters ? `${vessel.draftMeters} m` : '—',
      },
    ];

    return {
      objectId: vessel.id,
      type: 'vessel',
      title: vessel.name,
      subtitle: vessel.imoNumber ? `IMO: ${vessel.imoNumber}` : undefined,
      fields,
    };
  }

  if (objectType === 'equipment') {
    const eq = store.equipment.find(
      (e) => e.id === objectId || e.name === objectId || e.equipmentIdentifier === objectId,
    );
    if (!eq) return null;

    const parentVessel = eq.parentVesselId
      ? store.vessels.find((v) => v.id === eq.parentVesselId)
      : undefined;

    const fields: ObjectDatasheetField[] = [
      {
        key: 'name',
        label: 'Name',
        value: eq.name,
        displayValue: eq.name || '—',
      },
      {
        key: 'serialNumber',
        label: 'Serial / Tag',
        value: eq.serialNumber || eq.equipmentIdentifier,
        displayValue: eq.serialNumber || eq.equipmentIdentifier || '—',
        isMono: true,
      },
      {
        key: 'category',
        label: 'Type',
        value: eq.category,
        displayValue: eq.category || '—',
      },
      {
        key: 'manufacturer',
        label: 'Manufacturer',
        value: eq.manufacturer,
        displayValue: eq.manufacturer || '—',
      },
      {
        key: 'model',
        label: 'Model',
        value: eq.model,
        displayValue: eq.model || '—',
      },
      {
        key: 'owningOrganization',
        label: 'Owning Organization',
        value: eq.owningOrganization,
        displayValue: eq.owningOrganization || '—',
      },
      {
        key: 'parentVesselName',
        label: 'Parent Vessel',
        value: parentVessel?.name,
        displayValue: parentVessel?.name || '—',
      },
    ];

    return {
      objectId: eq.id,
      type: 'equipment',
      title: eq.name,
      subtitle: eq.equipmentIdentifier || eq.serialNumber,
      fields,
    };
  }

  if (objectType === 'person') {
    const person = store.crew.find((c) => c.id === objectId || c.fullName === objectId);
    if (!person) return null;

    const employer = person.organization || person.manningAgency || '—';

    const fields: ObjectDatasheetField[] = [
      {
        key: 'fullName',
        label: 'Name',
        value: person.fullName,
        displayValue: person.fullName || '—',
      },
      {
        key: 'rank',
        label: 'Rank / Role',
        value: person.rank,
        displayValue: person.rank || '—',
      },
      {
        key: 'employer',
        label: 'Employer',
        value: employer,
        displayValue: employer,
      },
      {
        key: 'nationality',
        label: 'Nationality',
        value: person.nationality,
        displayValue: person.nationality || '—',
      },
    ];

    return {
      objectId: person.id,
      type: 'person',
      title: person.fullName,
      subtitle: person.rank,
      fields,
    };
  }

  // Generic or Activity fallback
  const custom = (store.assuranceObjects || []).find((obj) => obj.id === objectId);
  if (custom) {
    const fields: ObjectDatasheetField[] = [
      {
        key: 'name',
        label: 'Name',
        value: custom.name,
        displayValue: custom.name || '—',
      },
      {
        key: 'identifier',
        label: 'Identifier',
        value: custom.identifier,
        displayValue: custom.identifier || '—',
        isMono: true,
      },
      {
        key: 'type',
        label: 'Type',
        value: custom.type,
        displayValue: custom.type || '—',
      },
      {
        key: 'ownerOrganization',
        label: 'Owning Organization',
        value: custom.ownerOrganization,
        displayValue: custom.ownerOrganization || '—',
      },
    ];

    return {
      objectId: custom.id,
      type: custom.type,
      title: custom.name,
      subtitle: custom.identifier,
      fields,
    };
  }

  return null;
}

/**
 * Extracts key-value field map of an object for snapshot persistence.
 */
export function extractObjectDatasheetFields(
  objectId: string,
  objectType: AssuranceObjectType,
  store: ObjectStoreSnapshotSource,
): Record<string, string | number | undefined | null> {
  const datasheet = getObjectDatasheet(objectId, objectType, store);
  if (!datasheet) return {};

  const record: Record<string, string | number | undefined | null> = {};
  datasheet.fields.forEach((f) => {
    record[f.key] = f.value;
  });
  return record;
}

/**
 * Captures datasheet snapshots for all linked objects of an assurance set.
 */
export function captureDatasheetSnapshotsForSet(
  set: AssuranceSet,
  role: UserRolePersona,
  userId: string,
  store: ObjectStoreSnapshotSource,
  at: string = new Date().toISOString(),
): { snapshots: DatasheetSnapshot[]; objectNames: string[] } {
  const baseObjects = getAssuranceSetObjects(set);
  const byId = new Map<string, { id: string; type: AssuranceObjectType; name: string }>();

  baseObjects.forEach((obj) => {
    byId.set(obj.id, { id: obj.id, type: obj.type, name: obj.name || obj.id });
  });

  if (set.vesselId && !byId.has(set.vesselId)) {
    byId.set(set.vesselId, { id: set.vesselId, type: 'vessel', name: set.vesselName || set.vesselId });
  }

  (set.requirements || []).forEach((req) => {
    if (req.targetObjectId && !byId.has(req.targetObjectId)) {
      const found = (store.assuranceObjects || []).find((o) => o.id === req.targetObjectId);
      if (found) {
        byId.set(found.id, { id: found.id, type: found.type, name: found.name || found.id });
      }
    }
  });

  (set.crewGroups || []).forEach((cg) => {
    (cg.memberIds || []).forEach((memberId) => {
      if (!byId.has(memberId)) {
        const member = store.crew.find((c) => c.id === memberId);
        byId.set(memberId, {
          id: memberId,
          type: 'person',
          name: member?.fullName || memberId,
        });
      }
    });
  });

  const snapshots: DatasheetSnapshot[] = [];
  const objectNames: string[] = [];

  for (const obj of byId.values()) {
    const fields = extractObjectDatasheetFields(obj.id, obj.type, store);
    snapshots.push({
      objectId: obj.id,
      role,
      userId,
      at,
      fields,
    });
    objectNames.push(obj.name);
  }

  return { snapshots, objectNames };
}
