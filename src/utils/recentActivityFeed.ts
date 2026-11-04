import { AuditTrailEvent } from '../types/audit';
import { DashboardActivityItem, DashboardRole } from '../types/dashboard';

/**
 * Formats an ISO 8601 UTC timestamp string into a concise human-readable relative time string.
 * Example outputs: "Just now", "25 min ago", "1 h ago", "Yesterday", "2 days ago", "1 mo ago", "1 yr ago".
 */
export function formatRelativeTime(isoString: string, now: Date = new Date()): string {
  if (!isoString) return '';
  const timestamp = Date.parse(isoString);
  if (Number.isNaN(timestamp)) return '';

  const diffMs = now.getTime() - timestamp;
  if (diffMs <= 0) return 'Just now';

  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Just now';

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays} days ago`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return diffMonths <= 1 ? '1 mo ago' : `${diffMonths} mo ago`;

  const diffYears = Math.floor(diffDays / 365);
  return diffYears <= 1 ? '1 yr ago' : `${diffYears} yr ago`;
}

/**
 * Extracts a readable asset, document, or vessel subject from targetAsset string.
 */
export function extractCleanSubject(targetAsset: string): string {
  if (!targetAsset) return 'item';

  const parenMatch = targetAsset.match(/\(([^)]+)\)/);
  if (parenMatch) {
    const inside = parenMatch[1].trim();
    if (!/^IMO\s*\d+/i.test(inside) && !/^AS-[A-Z0-9-]+$/i.test(inside)) {
      return inside.replace(/\s+Assurance$/i, '').trim();
    }
  }

  if (targetAsset.includes(' · ')) {
    const parts = targetAsset.split(' · ').map((p) => p.trim()).filter(Boolean);
    const last = parts[parts.length - 1];
    if (last && !/^AS-|^REQ-/i.test(last)) {
      return last;
    }
  }

  if (targetAsset.includes(' / ')) {
    const parts = targetAsset.split(' / ').map((p) => p.trim()).filter(Boolean);
    const last = parts[parts.length - 1];
    if (last) return last;
  }

  const imoStripped = targetAsset.replace(/\s*\(IMO\s*\d+\)/i, '').trim();
  if (imoStripped) return imoStripped;

  return targetAsset;
}

/**
 * Formats an AuditTrailEvent into a plain English sentence without technical boilerplate or jargon.
 */
export function formatAuditEventSentence(event: AuditTrailEvent): string {
  const action = (event.action || '').trim();
  const subject = extractCleanSubject(event.targetAsset);
  const userRole = event.userRole || 'User';

  if (/^system transition:.*->\s*approval/i.test(action)) {
    return `${subject} reached approval`;
  }
  if (/^system transition:.*->\s*inspection/i.test(action)) {
    return `${subject} moved to inspection`;
  }
  if (/^system transition:.*->\s*evidence/i.test(action)) {
    return `${subject} evidence gathering started`;
  }
  if (/^system transition:.*->\s*verification/i.test(action)) {
    return `${subject} moved to verification`;
  }

  if (/^Requirement Verification:\s*Verified/i.test(action) || /^Verified\b/i.test(action)) {
    return `Verifier accepted ${subject}`;
  }
  if (/returned|correction requested|rejected/i.test(action)) {
    return `Verifier returned ${subject}`;
  }

  if (/uploaded document revision/i.test(action)) {
    const isReupload =
      (action.includes('v1.') && !action.includes('v1.0')) ||
      Boolean(event.fieldDelta?.oldValue && event.fieldDelta.oldValue !== '—');
    return isReupload ? `Submitter re-uploaded ${subject}` : `Submitter uploaded ${subject}`;
  }
  if (/uploaded document/i.test(action) || /submitted/i.test(action)) {
    return `Submitter uploaded ${subject}`;
  }

  if (/flagged.*re-?inspection/i.test(action) || /flagged.*re-?inspection/i.test(event.justificationNotes || '')) {
    return `Client flagged ${subject} for re-inspection`;
  }
  if (/raised finding|logged.*defect/i.test(action)) {
    return `Inspector logged finding on ${subject}`;
  }
  if (/closed finding/i.test(action)) {
    return `Finding closed on ${subject}`;
  }

  if (/completed on-site survey|inspection completed|completed checklist/i.test(action)) {
    return `Inspector completed survey on ${subject}`;
  }

  if (/approved assurance set|^approved\b/i.test(action)) {
    return `Approver approved ${subject}`;
  }

  if (/assigned.*submitter/i.test(action)) {
    return `Assigned submitter on ${subject}`;
  }
  if (/assigned.*verifier/i.test(action)) {
    return `Assigned verifier on ${subject}`;
  }
  if (/assigned.*inspector/i.test(action)) {
    return `Assigned inspector on ${subject}`;
  }
  if (/assigned.*approver/i.test(action)) {
    return `Assigned approver on ${subject}`;
  }

  if (/exempted/i.test(action)) {
    return `Exempted task on ${subject}`;
  }

  if (/changed date|date change/i.test(action)) {
    return `Target date updated on ${subject}`;
  }

  if (/registered.*vessel/i.test(action)) {
    return `Registered vessel ${subject}`;
  }

  if (/initiated assurance set/i.test(action)) {
    return `Initiated assurance set for ${subject}`;
  }

  if (userRole && action) {
    return `${userRole} ${action.toLowerCase()} on ${subject}`;
  }

  return `${action || 'Update'} on ${subject}`;
}

/**
 * Evaluates whether an audit event is specifically relevant to the given dashboard role.
 */
export function isEventRelevantToRole(event: AuditTrailEvent, role: DashboardRole): boolean {
  const action = (event.action || '').toLowerCase();
  const userRole = (event.userRole || '').toLowerCase();
  const notes = (event.justificationNotes || '').toLowerCase();
  const targetKind = event.target?.kind;

  switch (role) {
    case 'Administrator as client': {
      return true;
    }
    case 'Submitter': {
      if (userRole === 'submitter') return true;
      if (action.includes('upload') || action.includes('revision') || action.includes('submit')) return true;
      if (action.includes('verified') || action.includes('returned') || action.includes('correction')) return true;
      if (action.includes('finding') || action.includes('defect')) return true;
      if (action.includes('evidence gathering') || (action.includes('assigned') && action.includes('submitter'))) return true;
      if (targetKind === 'document' || targetKind === 'requirement') return true;
      return false;
    }
    case 'Verifier': {
      if (userRole === 'verifier') return true;
      if (action.includes('verify') || action.includes('verification') || action.includes('accepted')) return true;
      if (action.includes('returned') || action.includes('correction')) return true;
      if (action.includes('upload') || action.includes('revision') || action.includes('submitted')) return true;
      if (action.includes('escalat')) return true;
      if (action.includes('-> verification') || action.includes('verification ->')) return true;
      if (targetKind === 'document' || targetKind === 'requirement') return true;
      return false;
    }
    case 'Inspector': {
      if (userRole === 'inspector') return true;
      if (action.includes('inspect') || action.includes('survey') || action.includes('checklist')) return true;
      if (action.includes('finding') || action.includes('defect') || action.includes('capa')) return true;
      if (action.includes('re-inspect') || action.includes('reinspection') || notes.includes('re-inspection')) return true;
      if (action.includes('-> inspection') || action.includes('inspection ->')) return true;
      if (targetKind === 'finding' || targetKind === 'object') return true;
      return false;
    }
    case 'Approver': {
      if (userRole === 'approver') return true;
      if (action.includes('approv') || action.includes('certif') || action.includes('decision')) return true;
      if (action.includes('-> approval')) return true;
      if (targetKind === 'stage' && (event.target as { stage?: string })?.stage === 'Approval') return true;
      return false;
    }
    default:
      return true;
  }
}

/**
 * Retrieves the last 5 audit events relevant to the given role, formatted as DashboardActivityItems, newest first.
 * If strictly relevant events are fewer than maxItems, remaining items are supplemented from latest events to ensure a complete feed.
 */
export function getRoleRecentActivity(
  role: DashboardRole,
  auditEvents: AuditTrailEvent[],
  maxItems: number = 5,
  now: Date = new Date(),
): DashboardActivityItem[] {
  if (!auditEvents || auditEvents.length === 0) {
    return [];
  }

  const sorted = [...auditEvents].sort((a, b) => {
    const timeA = Date.parse(a.timestampUtc) || 0;
    const timeB = Date.parse(b.timestampUtc) || 0;
    return timeB - timeA;
  });

  const relevant = sorted.filter((ev) => isEventRelevantToRole(ev, role));

  const resultEvents = [...relevant.slice(0, maxItems)];
  if (resultEvents.length < maxItems) {
    const existingIds = new Set(resultEvents.map((e) => e.id));
    for (const ev of sorted) {
      if (!existingIds.has(ev.id)) {
        resultEvents.push(ev);
        existingIds.add(ev.id);
        if (resultEvents.length >= maxItems) break;
      }
    }
  }

  return resultEvents.map((ev) => {
    const sentence = formatAuditEventSentence(ev);
    const relativeTime = formatRelativeTime(ev.timestampUtc, now);
    return {
      id: ev.id,
      text: sentence,
      timeAgo: relativeTime,
      sentence,
      relativeTime,
      timestampUtc: ev.timestampUtc,
    };
  });
}
