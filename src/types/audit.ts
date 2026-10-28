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

/** which record an audit event is about: one assurance set, one task on a set, or one date on a set */
export type AuditEventTarget =
  | { kind: "set"; setId: string }
  | { kind: "task"; setId: string; taskId: string }
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
  if (target.kind === "set") {
    return target.setId === "multiple" ? "Several sets" : `Set ${target.setId}`;
  }
  if (target.kind === "task") {
    return `Task ${target.taskId} · Set ${target.setId}`;
  }
  const task = target.taskId ? ` · Task ${target.taskId}` : "";
  return `Date ${auditDateFieldLabel(target.dateField)}${task} · Set ${target.setId}`;
}

/**
  what: chooses a set, task or date target from the event text when the caller did not pass one.
  how: reads a set id, a task id, or a date field out of the action and the subject, and otherwise records an unscoped set reference.
  with what file: src/types/audit.ts, used by withStructuredAuditTarget.
*/
export function inferAuditTarget(event: {
  targetAsset: string;
  action?: string;
  fieldDelta?: { fieldName: string };
}): AuditEventTarget {
  const blob = `${event.action ?? ""} ${event.targetAsset} ${event.fieldDelta?.fieldName ?? ""}`;
  const setMatch = blob.match(/\b(AS-[A-Z0-9-]+)\b/i);
  const setId = setMatch?.[1] ?? "unscoped";
  const taskMatch = blob.match(/\b(?:Requirement|Task)\s+([A-Za-z0-9-]+)/i);
  const fieldName = event.fieldDelta?.fieldName ?? "";
  const action = event.action ?? "";
  const looksLikeDate =
    /date|deadline|window|charter/i.test(fieldName) ||
    /changed date|date change/i.test(action);

  if (looksLikeDate) {
    return {
      kind: "date",
      setId,
      dateField: fieldName || "date",
      taskId: taskMatch?.[1],
    };
  }
  if (taskMatch) {
    return { kind: "task", setId, taskId: taskMatch[1] };
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
  const taskId = event.target.kind === "task" ? event.target.taskId : event.target.kind === "date" ? event.target.taskId ?? "" : "";
  const dateField = event.target.kind === "date" ? event.target.dateField : "";
  const haystack = [
    event.action,
    event.targetAsset,
    formatAuditTarget(event.target),
    event.target.kind,
    event.target.setId,
    taskId,
    dateField,
    event.userRole,
    event.justificationNotes ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}
