/* 
  file summary: sidebar navigation component with role-based access control (rbac) route filtering matching exact mockup styling.
  responsibilities: renders fixed dark navy sidepanel, organisation card, teal dot nav items, and signed in as user section.
  role in system: sidebar navigation component embedded in app layout shell.
*/

import React, { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, LogOut } from "lucide-react";
import { useMapStore } from "../../store/useMapStore";
import { UserRolePersona } from "../../types/audit";
import { ENABLE_ROLES_AND_PERMISSIONS } from "../../config/featureFlags";
import {
  VIEW_TO_SCOPE,
  getEffectiveUserScopeFlags,
  getRoleScopeFlags,
  isUserOverride,
} from "../../utils/permissionHelpers";

interface NavItem {
  key: string;
  label: string;
  allowedRoles: UserRolePersona[];
  badgeText?: string;
  children?: NavItem[];
  isGroup?: boolean;
}

const ASSETS_CHILD_KEYS = ["vessels", "equipment", "crew"];

/**
  what: renders fixed dark navy sidepanel matching mockup design with organisation card and dot navigation.
  how: checks active persona against nav item permissions, applies teal dot active highlights, and updates store route on click.
  with what file: src/components/layout/AppSidebar.tsx loaded by App.tsx.
*/
export const AppSidebar: React.FC = () => {
  const {
    activePersona,
    setActivePersona,
    currentHashView,
    setCurrentHashView,
    logout,
    rolePermissionDefaults,
    userPermissionOverrides,
    users,
    customScopes,
  } = useMapStore();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(["assets"]),
  );

  /* lookup mock user details based on active persona */
  const getUserInfo = (
    role: UserRolePersona,
  ): { name: string; initials: string } => {
    switch (role) {
      case "C Admin":
        return { name: "S. Basin", initials: "SB" };
      case "Submitter":
        return { name: "M. Chen", initials: "MC" };
      case "Verifier":
        return { name: "A. Fontaine", initials: "AF" };
      case "Inspector":
        return { name: "N. Technical", initials: "NT" };
      case "Approver":
        return { name: "P. Nardelli", initials: "PN" };
      case "Administrator":
      default:
        return { name: "K. Osei", initials: "KO" };
    }
  };

  const userInfo = getUserInfo(activePersona);
  const matchingUser =
    users.find((u) => u.roles.includes(activePersona)) ?? null;

  const navItems: NavItem[] = [
    {
      key: "dashboard",
      label: "Dashboard",
      allowedRoles: [
        "Administrator",
        "C Admin",
        "Submitter",
        "Verifier",
        "Inspector",
        "Approver",
      ],
    },
    {
      key: "project",
      label: "Projects",
      allowedRoles: ["Administrator", "C Admin"],
    },
    {
      key: "marketplace",
      label: "Marketplace",
      allowedRoles: [
        "Administrator",
        "C Admin",
        "Submitter",
        "Verifier",
        "Inspector",
        "Approver",
      ],
    },
    {
      key: "assets",
      label: "Assets",
      isGroup: true,
      allowedRoles: ["Administrator", "C Admin", "Submitter"],
      children: [
        {
          key: "vessels",
          label: "Vessels",
          allowedRoles: ["Administrator", "C Admin", "Submitter"],
        },
        {
          key: "equipment",
          label: "Equipment",
          allowedRoles: ["Administrator", "C Admin"],
        },
        {
          key: "crew",
          label: "Crew Directory",
          allowedRoles: ["Administrator", "C Admin"],
        },
      ],
    },
    {
      key: "assurance-sets",
      label: "Assurance Sets",
      allowedRoles: ["Administrator", "Submitter"],
    },
    {
      key: "documents",
      label: "Document Library",
      allowedRoles: ["Administrator", "Submitter", "Verifier"],
    },
    // {
    //   key: "crew",
    //   label: "Crew Directory",
    //   allowedRoles: ["Administrator"],
    // },
    {
      key: "verifier",
      label: "Verification Queue",
      allowedRoles: ["Administrator", "Submitter", "Verifier"],
      badgeText: "2",
    },
    {
      key: "inspector",
      label: "Physical Inspections",
      allowedRoles: ["Administrator"],
    },
    {
      key: "approver",
      label: "Approval Gate",
      allowedRoles: ["Approver", "Verifier"],
    },
    {
      key: "capa",
      label: "CAPA Tracker",
      allowedRoles: ["C Admin", "Inspector"],
    },
    {
      key: "audit",
      label: "Audit Trail",
      allowedRoles: [
        "Administrator",
        "C Admin",
        "Submitter",
        "Verifier",
        "Inspector",
        "Approver",
      ],
    },
    {
      key: "users",
      label: "User Management",
      allowedRoles: ["Administrator", "C Admin"],
    },
    ...(ENABLE_ROLES_AND_PERMISSIONS
      ? [
          {
            key: "roles-permissions",
            label: "Roles & Permissions",
            allowedRoles: ["Administrator"] as UserRolePersona[],
          },
        ]
      : []),
  ];

  /* auto-expand Assets when a child route is active */
  useEffect(() => {
    if (ASSETS_CHILD_KEYS.includes(currentHashView)) {
      setExpandedGroups((prev) => new Set(prev).add("assets"));
    }
  }, [currentHashView]);

  const isLeafItemVisible = (item: NavItem): boolean => {
    if (
      (activePersona === "Verifier" || activePersona === "Submitter") &&
      item.key === "verifier"
    )
      return false;
    if (activePersona === "Inspector" && item.key === "inspector") return false;
    if (activePersona === "Approver" && item.key === "approver") return false;
    if (
      (activePersona === "C Admin" || activePersona === "Submitter") &&
      item.key === "assurance-sets"
    )
      return false;
    if (
      (activePersona === "Administrator" || activePersona === "Submitter") &&
      item.key === "capa"
    )
      return false;

    if (item.key === "roles-permissions") {
      return activePersona === "Administrator";
    }

    const initialAllowed = item.allowedRoles.includes(activePersona);

    if (!ENABLE_ROLES_AND_PERMISSIONS) return initialAllowed;

    const scopeKey = VIEW_TO_SCOPE[item.key];
    if (!scopeKey) return initialAllowed;

    if (
      matchingUser &&
      isUserOverride(userPermissionOverrides, matchingUser.id, scopeKey, "read")
    ) {
      return getEffectiveUserScopeFlags(
        rolePermissionDefaults,
        userPermissionOverrides,
        matchingUser,
        scopeKey,
        customScopes,
      ).read;
    }

    return getRoleScopeFlags(
      rolePermissionDefaults,
      activePersona,
      scopeKey,
      customScopes,
    ).read;
  };

  const filterNavItems = (items: NavItem[]): NavItem[] =>
    items
      .map((item) => {
        if (item.children) {
          const visibleChildren = filterNavItems(item.children);
          if (visibleChildren.length === 0) return null;
          return { ...item, children: visibleChildren };
        }
        return isLeafItemVisible(item) ? item : null;
      })
      .filter((item): item is NavItem => item !== null);

  const visibleItems = filterNavItems(navItems);

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const isItemActive = (item: NavItem): boolean =>
    currentHashView === item.key ||
    (item.key === "assurance-sets" &&
      currentHashView === "create-assurance-set");

  const isGroupChildActive = (item: NavItem): boolean =>
    item.children?.some((child) => isItemActive(child)) ?? false;

  const renderNavButton = (
    item: NavItem,
    options: {
      isActive: boolean;
      onClick: () => void;
      depth: number;
      showChevron?: boolean;
      isExpanded?: boolean;
    },
  ) => {
    const { isActive, onClick, depth, showChevron, isExpanded } = options;

    return (
      <button
        type="button"
        className={`nav-link text-start d-flex align-items-center justify-between mb-1 py-2 ${isActive ? "fw-semibold" : ""}`}
        style={{
          borderRadius: "6px",
          fontSize: depth > 0 ? "0.8rem" : "0.85rem",
          backgroundColor: isActive ? "#0e324c" : "transparent",
          color: isActive ? "#ffffff" : depth > 0 ? "#94a3b8" : "#cbd5e1",
          border: "none",
          cursor: "pointer",
          transition: "all 0.15s ease-in-out",
          paddingLeft: depth > 0 ? "10px" : "12px",
          paddingRight: "12px",
        }}
        onClick={onClick}
      >
        <div className="d-flex align-items-center">
          {depth === 0 && (
            <span
              style={{
                display: "inline-block",
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                backgroundColor: isActive ? "#38bdf8" : "#475569",
                marginRight: "10px",
              }}
            />
          )}
          <span>{item.label}</span>
        </div>

        {showChevron ? (
          <span className="text-secondary d-flex align-items-center ms-auto">
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        ) : (
          item.badgeText && (
            <span
              className={`badge rounded-pill ms-auto ${isActive ? "bg-primary text-white" : "bg-warning text-dark"}`}
              style={{
                fontSize: "0.65rem",
                padding: "0.25em 0.6em",
              }}
            >
              {item.badgeText}
            </span>
          )
        )}
      </button>
    );
  };

  const renderNavItem = (item: NavItem, depth = 0): React.ReactNode => {
    if (item.isGroup && item.children) {
      const isExpanded = expandedGroups.has(item.key);
      const childActive = isGroupChildActive(item);

      return (
        <React.Fragment key={item.key}>
          {renderNavButton(item, {
            isActive: childActive,
            onClick: () => toggleGroup(item.key),
            depth,
            showChevron: true,
            isExpanded,
          })}
          {isExpanded && (
            <div
              className="d-flex flex-column mb-1"
              style={{ marginLeft: "28px" }}
            >
              {item.children.map((child) => renderNavItem(child, depth + 1))}
            </div>
          )}
        </React.Fragment>
      );
    }

    return (
      <React.Fragment key={item.key}>
        {renderNavButton(item, {
          isActive: isItemActive(item),
          onClick: () => setCurrentHashView(item.key),
          depth,
        })}
      </React.Fragment>
    );
  };

  return (
    <aside
      className="map-sidebar-nav"
      style={{ backgroundColor: "rgb(11, 27, 43)" }}
    >
      {/* map brand header with teal M logo badge */}
      <div
        className="d-flex align-items-center gap-3 px-3 py-3 border-bottom"
        style={{ borderColor: "rgba(255, 255, 255, 0.08)" }}
      >
        <div
          className="d-flex align-items-center justify-content-center fw-bold text-white shadow-sm"
          style={{
            width: "34px",
            height: "34px",
            backgroundColor: "#0d9488",
            borderRadius: "6px",
            fontSize: "1rem",
            letterSpacing: "0.02em",
          }}
        >
          M
        </div>
        <div className="d-flex flex-column">
          <span
            className="fw-bold text-white"
            style={{
              fontSize: "1.05rem",
              letterSpacing: "0.05em",
              lineHeight: "1.1",
            }}
          >
            MAP
          </span>
          <span
            className="small text-uppercase"
            style={{
              fontSize: "0.625rem",
              color: "#64748b",
              letterSpacing: "0.08em",
            }}
          >
            Marine Assurance
          </span>
        </div>
      </div>

      {/* main navigation list with dot highlights */}
      <div className="nav flex-column nav-pills px-2 pt-3">
        {visibleItems.map((item) => (
          <React.Fragment key={item.key}>
            {item.key === "users" && (
              <div
                className="text-uppercase fw-bold px-3 mt-4 mb-2"
                style={{
                  fontSize: "0.625rem",
                  letterSpacing: "0.08em",
                  color: "#64748b",
                }}
              >
                Settings
              </div>
            )}
            {renderNavItem(item)}
          </React.Fragment>
        ))}
      </div>

      {/* organisation & signed-in user footer card */}
      <div
        className="mt-auto p-3 border-top position-relative"
        style={{
          borderColor: "rgba(255, 255, 255, 0.08)",
          backgroundColor: "rgba(0, 0, 0, 0.2)",
        }}
      >
        <div className="mb-2">
          <div
            className="text-uppercase fw-bold mb-0.5"
            style={{
              fontSize: "0.625rem",
              letterSpacing: "0.08em",
              color: "#64748b",
            }}
          >
            Organisation
          </div>
          <div
            className="fw-bold text-white text-truncate"
            style={{ fontSize: "0.85rem" }}
          >
            {activePersona === "C Admin"
              ? "Southern Basin Energy"
              : "Northwind Marine Pty Ltd"}
          </div>
        </div>

        <div
          className="d-flex align-items-center justify-between p-2 rounded cursor-pointer"
          style={{
            backgroundColor: isUserMenuOpen
              ? "rgba(255, 255, 255, 0.08)"
              : "rgba(255, 255, 255, 0.03)",
            border: "1px solid rgba(255, 255, 255, 0.06)",
            transition: "background-color 0.15s ease",
            cursor: "pointer",
          }}
          onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
        >
          <div className="d-flex align-items-center gap-2 overflow-hidden">
            <div
              className="rounded-circle bg-primary text-white fw-bold d-flex align-items-center justify-content-center flex-shrink-0"
              style={{ width: "28px", height: "28px", fontSize: "0.75rem" }}
            >
              {userInfo.initials}
            </div>
            <div className="d-flex flex-column text-truncate">
              <span
                className="fw-bold text-white text-truncate"
                style={{ fontSize: "0.85rem" }}
              >
                {userInfo.name}
              </span>
              <span
                className="text-truncate"
                style={{ fontSize: "0.7rem", color: "#38bdf8" }}
              >
                {activePersona}
              </span>
            </div>
          </div>
          <span className="text-secondary d-flex align-items-center ms-1">
            {isUserMenuOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </div>

        {/* user persona switch & sign out popover menu */}
        {isUserMenuOpen && (
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
              Switch Role / Persona
            </div>
            {([
              { role: "Administrator" as UserRolePersona, name: "K. Osei" },
              { role: "C Admin" as UserRolePersona, name: "S. Basin" },
              { role: "Submitter" as UserRolePersona, name: "M. Chen" },
              { role: "Verifier" as UserRolePersona, name: "A. Fontaine" },
              { role: "Inspector" as UserRolePersona, name: "N. Technical" },
              { role: "Approver" as UserRolePersona, name: "P. Nardelli" },
            ]).map((p) => (
              <button
                key={p.role}
                type="button"
                className={`btn btn-sm text-start w-100 d-flex align-items-center justify-content-between py-1 px-2 mb-1 rounded border-0 ${
                  activePersona === p.role
                    ? "text-white fw-semibold"
                    : "text-light"
                }`}
                style={{
                  fontSize: "0.75rem",
                  backgroundColor: activePersona === p.role ? "#0284c7" : "transparent",
                }}
                onClick={() => {
                  setActivePersona(p.role);
                  setIsUserMenuOpen(false);
                }}
              >
                <div>
                  <div className="fw-semibold">{p.name}</div>
                  <div
                    style={{
                      fontSize: "0.65rem",
                      color: activePersona === p.role ? "#e0f2fe" : "#94a3b8",
                    }}
                  >
                    {p.role}
                  </div>
                </div>
                {activePersona === p.role && (
                  <span style={{ fontSize: "0.65rem", color: "#ffffff" }}>Active</span>
                )}
              </button>
            ))}
            <div
              className="border-top my-1"
              style={{ borderColor: "rgba(255, 255, 255, 0.08)" }}
            />
            <button
              type="button"
              className="btn btn-sm text-start text-danger w-100 d-flex align-items-center gap-2 py-1.5 px-2 border-0 bg-transparent"
              style={{ fontSize: "0.78rem" }}
              onClick={() => {
                setIsUserMenuOpen(false);
                logout();
              }}
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
