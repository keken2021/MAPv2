/*
  file summary: sidebar popover menu for switching active session user within the current persona and organization.
  responsibilities: lists active users holding the current persona in the active organization, highlights current session user, and allows switching or signing out.
  role in system: mounted by AppSidebar; consumes useMapStore and getSessionUsersForOrgPersona.
*/

import React, { useMemo } from 'react';
import { LogOut } from 'lucide-react';
import { useMapStore } from '../../store/useMapStore';
import {
  getRoleDisplayLabel,
  getSessionUserForPersona,
  getSessionUsersForOrgPersona,
} from '../../utils/userRoleHelpers';

export interface SidebarViewingAsMenuProps {
  onClose?: () => void;
}

export const SidebarViewingAsMenu: React.FC<SidebarViewingAsMenuProps> = ({ onClose }) => {
  const {
    users,
    activePersona,
    activeDemoOrganization,
    activeSessionUserId,
    setActiveSessionUser,
    logout,
  } = useMapStore();

  const people = useMemo(
    () => getSessionUsersForOrgPersona(users, activeDemoOrganization, activePersona),
    [users, activeDemoOrganization, activePersona],
  );

  const currentSessionUser = useMemo(
    () =>
      getSessionUserForPersona(activePersona, users, {
        organization: activeDemoOrganization,
        sessionUserId: activeSessionUserId,
      }),
    [activePersona, users, activeDemoOrganization, activeSessionUserId],
  );

  const currentUserId =
    (people.some((p) => p.id === activeSessionUserId) ? activeSessionUserId : undefined) ??
    currentSessionUser?.id;

  return (
    <div
      className="position-absolute bottom-100 start-0 mb-2 ms-2 p-2 rounded shadow-lg border"
      style={{
        width: "calc(100% - 16px)",
        backgroundColor: "#0b1b2b",
        borderColor: "#1e3a5f",
        zIndex: 1100,
      }}
    >
      <div
        className="px-2 py-1 mb-1 text-uppercase fw-bold"
        style={{
          fontSize: "0.625rem",
          letterSpacing: "0.08em",
          color: "#64748b",
        }}
      >
        Viewing as
      </div>
      {people.map((person) => {
        const isCurrent = person.id === currentUserId;
        return (
          <button
            key={person.id}
            type="button"
            className={`btn btn-sm text-start w-100 d-flex align-items-center justify-content-between py-1 px-2 mb-1 rounded border-0 ${
              isCurrent
                ? "text-white fw-semibold"
                : "text-light"
            }`}
            style={{
              fontSize: "0.75rem",
              backgroundColor: isCurrent ? "#0284c7" : "transparent",
            }}
            onClick={() => {
              setActiveSessionUser(person.id);
              onClose?.();
            }}
          >
            <div>
              <div className="fw-semibold">{person.name}</div>
              <div
                style={{
                  fontSize: "0.65rem",
                  color: isCurrent ? "#e0f2fe" : "#94a3b8",
                }}
              >
                {getRoleDisplayLabel(activePersona)}
              </div>
            </div>
            {isCurrent && (
              <span style={{ fontSize: "0.65rem", color: "#ffffff" }}>Active</span>
            )}
          </button>
        );
      })}
      <div
        className="border-top my-1"
        style={{ borderColor: "rgba(255, 255, 255, 0.08)" }}
      />
      <button
        type="button"
        className="btn btn-sm text-start text-danger w-100 d-flex align-items-center gap-2 py-1.5 px-2 border-0 bg-transparent"
        style={{ fontSize: "0.78rem" }}
        onClick={() => {
          onClose?.();
          logout();
        }}
      >
        <LogOut size={14} />
        <span>Sign Out</span>
      </button>
    </div>
  );
};

