/* 
  file summary: Audit Trail log event interfaces for the marine assurance platform (map).
  responsibilities: defines structured event entries recording timestamps, user ids, persona roles, a set, task or date target, field deltas, and compliance status changes.
  role in system: consumed by audit trail offcanvas drawer, store audit logging actions, and compliance reporting.
*/

export type UserRolePersona =
  | "Administrator"
  | "C Admin"
  | "Submitter"
  | "Verifier"
  | "Inspector"
  | "Approver";

/** which record an audit event is about: one of 10 domain entities on an assurance set */
export type AuditEventTarget =
  | { kind: "set"; setId: string }
  | { kind: "stage"; setId: string; stage: string }
  | { kind: "object"; setId: string; objectId: string; objectType?: string; objectName?: string }
  | { kind: "requirement"; setId: string; requirementId: string; title?: string }
  | { kind: "document"; setId: string; documentId: string; version?: string }
  | { kind: "task"; setId: string; taskId: string }
  | { kind: "stakeholder"; setId: string; userId?: string; role?: string }
  | { kind: "party"; setId: string; organization?: string; partyRole?: string }
  | { kind: "finding"; setId: string; findingId: string }
  | { kind: "date"; setId: string; dateField: string; taskId?: string };

export interface AuditTrailEvent {
  id: string; // e.g. AUD-90481
  timestampUtc: string; // ISO 8601 UTC
  userId: string;
  userRole: UserRolePersona;
  organization: string;
  action: string; // e.g. "Verified Certificate", "Registered Vessel", "Logged CAPA Defect"
  /** readable subject kept so existing screens can still search and show the event */
  targetAsset: string; // e.g. MV Pacific Endeavour / AS-2026-001
  /** structured subject: the set, the task, or the date this event refers to */
  target: AuditEventTarget;
  fieldDelta?: {
    fieldName: string;
    oldValue: string;
    newValue: string;
  };
  documentStatusDelta?: {
    documentId: string;
    oldStatus: string;
    newStatus: string;
  };
  justificationNotes?: string;
}

/** an event before the store fills in its structured target */
export type AuditTrailEventDraft = Omit<AuditTrailEvent, "target"> & {
  target?: AuditEventTarget;
};

const DATE_FIELD_LABELS: Record<string, string> = {
  charterWindowStart: "Contract start",
  charterWindowEnd: "Contract end",
  complianceDeadline: "Compliance deadline",
  projectWindowStart: "Project window start",
  projectWindowEnd: "Project window end",
  closedDate: "Closed date",
};

/**
  what: returns the label shown for a date field stored on an audit target.
  how: maps known assurance and finding date keys to words, and otherwise returns the key.
  with what file: src/types/audit.ts, used by the audit trail screen and date-change logging.
*/
export function auditDateFieldLabel(dateField: string): string {
  return DATE_FIELD_LABELS[dateField] ?? dateField;
}

/**
  what: returns the one-line description of a structured audit target.
  how: names the kind and the set, task or date id stored on the event.
  with what file: src/types/audit.ts, used by AuditTrailView and the audit drawer.
*/
export function formatAuditTarget(target: AuditEventTarget): string {
  switch (target.kind) {
    case "set":
      return target.setId === "multiple" ? "Several sets" : `Set ${target.setId}`;
    case "stage":
      return `Stage ${target.stage} · Set ${target.setId}`;
    case "object":
      return `Object ${target.objectId} · Set ${target.setId}`;
    case "requirement":
      return `Requirement ${target.requirementId} · Set ${target.setId}`;
    case "document": {
      const ver = target.version ? ` (${target.version})` : "";
      return `Document ${target.documentId}${ver} · Set ${target.setId}`;
    }
    case "task":
      return `Task ${target.taskId} · Set ${target.setId}`;
    case "stakeholder": {
      const details = [target.role, target.userId].filter(Boolean).join(" · ");
      return details ? `Stakeholder ${details} · Set ${target.setId}` : `Stakeholder · Set ${target.setId}`;
    }
    case "party": {
      const details = [target.organization, target.partyRole].filter(Boolean).join(" · ");
      return details ? `Party ${details} · Set ${target.setId}` : `Party · Set ${target.setId}`;
    }
    case "finding":
      return `Finding ${target.findingId} · Set ${target.setId}`;
    case "date": {
      const task = target.taskId ? ` · Task ${target.taskId}` : "";
      return `Date ${auditDateFieldLabel(target.dateField)}${task} · Set ${target.setId}`;
    }
    default: {
      const exhaustiveCheck: never = target;
      return `Set ${(exhaustiveCheck as AuditEventTarget).setId}`;
    }
  }
}

/**
  what: chooses a set, task or date target from the event text when the caller did not pass one.
  how: reads a set id, a task id, or a date field out of the action and the subject, and otherwise records an unscoped set reference.
  with what file: src/types/audit.ts, used by withStructuredAuditTarget.
*/
export function inferAuditTarget(event: {
  targetAsset: string;
  action?: string;
  fieldDelta?: { fieldName: string; oldValue?: string; newValue?: string };
  documentStatusDelta?: { documentId: string; oldStatus?: string; newStatus?: string };
}): AuditEventTarget {
  const blob = `${event.action ?? ""} ${event.targetAsset} ${event.fieldDelta?.fieldName ?? ""}`;
  const setMatch = blob.match(/\b(AS-[A-Z0-9-]+)\b/i);
  const setId = setMatch?.[1] ?? "unscoped";
  const fieldName = event.fieldDelta?.fieldName ?? "";
  const action = event.action ?? "";

  const looksLikeDate =
    /date|deadline|window|charter/i.test(fieldName) ||
    /changed date|date change|closed date/i.test(action);

  if (looksLikeDate) {
    const taskMatch =
      blob.match(/\b(?:Task|Requirement)\s+(?!AS-)([A-Za-z0-9-]+)/i) ??
      blob.match(/\b(REQ-[A-Za-z0-9-]+)\b/i) ??
      blob.match(/\b(TASK-[A-Za-z0-9-]+)\b/i);
    return {
      kind: "date",
      setId,
      dateField: fieldName || "date",
      taskId: taskMatch?.[1],
    };
  }

  // Stage
  if (
    fieldName === "stage" ||
    /stage|transition.*stage|advance.*stage/i.test(action) ||
    blob.match(/\bStage\s+([A-Za-z]+)\b/i)
  ) {
    const stageMatch = blob.match(/\bStage\s+([A-Za-z]+)\b/i);
    const stage = event.fieldDelta?.newValue || stageMatch?.[1] || "stage";
    return { kind: "stage", setId, stage };
  }

  // Finding / CAPA
  const findingMatch =
    blob.match(/\b(CAPA-[0-9]+|FIND-[0-9]+)\b/i) ??
    blob.match(/\bFinding\s+([A-Za-z0-9-]+)\b/i);
  if (findingMatch || /finding|capa/i.test(action) || /finding|capa/i.test(event.targetAsset)) {
    return { kind: "finding", setId, findingId: findingMatch?.[1] ?? "finding" };
  }

  // Document
  const docMatch =
    blob.match(/\b(MAP-DOC[A-Za-z0-9-]*|DOC-[A-Za-z0-9-]+)\b/i) ??
    blob.match(/\bDocument\s+([A-Za-z0-9-]+)\b/i);
  if (event.documentStatusDelta?.documentId || docMatch || /document|certificate|revision/i.test(action)) {
    const documentId = docMatch?.[1] ?? event.documentStatusDelta?.documentId ?? "document";
    const verMatch = blob.match(/\b(v[0-9]+(?:\.[0-9]+)?)\b/i);
    return { kind: "document", setId, documentId, version: verMatch?.[1] };
  }

  // Requirement (if specifically marked as Requirement)
  const reqMatch =
    blob.match(/\bRequirement\s+(?!AS-)([A-Za-z0-9-]+)\b/i) ??
    blob.match(/\b(REQ-[A-Za-z0-9-]+)\b/i);
  if (reqMatch && (/requirement/i.test(action) || /requirement/i.test(event.targetAsset) || /REQ-/i.test(blob))) {
    return { kind: "requirement", setId, requirementId: reqMatch[1] };
  }

  // Object (vessel, equipment, etc.)
  const objMatch =
    blob.match(/\b(OBJ-[A-Za-z0-9-]+|VESSEL-[0-9]+|EQP-[0-9]+|PROC-[0-9]+)\b/i) ??
    blob.match(/\bObject\s+([A-Za-z0-9-]+)\b/i);
  if (
    objMatch ||
    /vessel|equipment|procedure|method|crew|\bobject\b/i.test(action) ||
    /vessel|equipment|procedure|method|crew|\bobject\b/i.test(event.targetAsset)
  ) {
    return { kind: "object", setId, objectId: objMatch?.[1] ?? "object" };
  }

  // Party
  const partyMatch =
    event.targetAsset.match(/\bParty\s+([^·\n]+)\b/i) ??
    blob.match(/\bParty\s+([A-Z][A-Za-z0-9\s]+?)(?=\s*·|$)/i);
  const isPartyAction = /party|service provider|client org|requesting party|responding party/i.test(action);
  if (partyMatch || isPartyAction || /party/i.test(event.targetAsset)) {
    const partyRoleMatch = blob.match(/\b(service provider|client|third party|charterer|owner)\b/i);
    const org = partyMatch?.[1]?.trim();
    return {
      kind: "party",
      setId,
      organization: org,
      partyRole: partyRoleMatch?.[1],
    };
  }

  // Stakeholder
  const userMatch = blob.match(/\b(USR-[0-9]+)\b/i);
  const roleMatch = blob.match(/\b(Submitter|Verifier|Inspector|Approver|C Admin|Administrator)\b/i);
  if (
    /stakeholder|assign.*role|role.*assign/i.test(action) ||
    (userMatch && /role|user|stakeholder/i.test(blob)) ||
    (roleMatch && /assign|stakeholder/i.test(action))
  ) {
    return { kind: "stakeholder", setId, userId: userMatch?.[1], role: roleMatch?.[1] };
  }

  // Task
  const taskMatch =
    blob.match(/\bTask\s+(?!AS-)([A-Za-z0-9-]+)\b/i) ??
    blob.match(/\b(TASK-[A-Za-z0-9-]+)\b/i) ??
    reqMatch;
  if (taskMatch || /task/i.test(action) || /task/i.test(event.targetAsset)) {
    return { kind: "task", setId, taskId: taskMatch?.[1] ?? "task" };
  }

  if (setMatch) {
    return { kind: "set", setId: setMatch[1] };
  }
  return { kind: "set", setId: "unscoped" };
}

/**
  what: returns the event with a structured target filled in.
  how: keeps a target the caller already stored, and otherwise infers one from the event text.
  with what file: src/types/audit.ts, used by logAuditEvent and the seeded audit trail.
*/
export function withStructuredAuditTarget(
  event: AuditTrailEventDraft,
): AuditTrailEvent {
  return {
    ...event,
    target: event.target ?? inferAuditTarget(event),
  };
}

/**
  what: reports whether an audit event matches a search string.
  how: compares the string with the action, the subject, the structured target and the notes.
  with what file: src/types/audit.ts, used by AuditTrailView and the audit drawer.
*/
export function auditEventMatchesSearch(
  event: AuditTrailEvent,
  term: string,
): boolean {
  const query = term.trim().toLowerCase();
  if (!query) return true;

  const targetProps = Object.values(event.target)
    .filter((v): v is string => typeof v === "string")
    .join(" ");

  const dateLabel = event.target.kind === "date" ? auditDateFieldLabel(event.target.dateField) : "";

  const haystack = [
    event.action,
    event.targetAsset,
    formatAuditTarget(event.target),
    targetProps,
    dateLabel,
    event.userRole,
    event.organization,
    event.justificationNotes ?? "",
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}
