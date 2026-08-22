"use client";

/**
 * @file app/users/page.tsx
 * @description Modern User, Role & Permission Management page consuming
 * UserManagementAPI via Next.js proxy (/api/proxy/UserManagement?service=jwt).
 */

import React, { useState, useEffect, useCallback, useSyncExternalStore } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import RequireRole, { useHasRole } from "@/components/RequireRole";
import { ADMIN_ROLES } from "@/services/authSession";
import {
  readSidebarOpen,
  readSidebarOpenOnServer,
  setSidebarOpen,
  subscribeToSidebar,
} from "@/services/sidebarPreference";
import { sidebarMarginClass } from "@/lib/sidebarMetrics";
import { useTheme } from "@/theme/ThemeProvider";
import { useI18n } from "@/i18n/LanguageProvider";
import {
  Users,
  ShieldCheck,
  Search,
  UserPlus,
  RefreshCw,
  Lock,
  CheckCircle2,
  XCircle,
  Loader2,
  Edit,
  Mail,
  Phone,
  User
  } from "lucide-react";
import { ModalWrapper } from "@/components/av/ModalWrapper";

interface SystemUser {
  id: string;
  userName: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  profilePictureUrl?: string;
  roles?: string[];
  isLockedOut?: boolean;
}

interface SystemRole {
  id: string;
  name: string;
  userCount?: number;
}

interface UserRoleAssignment {
  id: string;
  name: string;
  isAssigned: boolean;
}

export default function UsersPage() {
  const { t, lang } = useI18n();
  const isKhmer = lang === "km";

  const [activeTab, setActiveTab] = useState<"users" | "roles">("users");

  // Data states
  const [usersList, setUsersList] = useState<SystemUser[]>([]);
  const [rolesList, setRolesList] = useState<SystemRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [showEditRolesModal, setShowEditRolesModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SystemUser | null>(null);
  const [userRoles, setUserRoles] = useState<UserRoleAssignment[]>([]);
  const [savingRoles, setSavingRoles] = useState(false);

  // New User Form State
  const [newUserName, setNewUserName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);

  // Fetch Users & Roles
  // The User/Role Management controllers now require a signed-in caller (they
  // previously had no [Authorize] at all, so create-user and role assignment
  // were open to anyone). The proxy route only forwards an Authorization header
  // when the browser sent one, so these calls have to attach the token.
  const authHeaders = useCallback((extra: Record<string, string> = {}) => {
    const headers: Record<string, string> = { Accept: "application/json", ...extra };
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("jwt_token");
      if (token) headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Users
      const usersRes = await fetch("/api/proxy/UserManagement?service=jwt&page=1&pageSize=100", {
        headers: authHeaders()
      });
      if (usersRes.ok) {
        const uData = await usersRes.json();
        const raw = uData.Data || uData.items || (Array.isArray(uData) ? uData : []);
        const mapped: SystemUser[] = raw.map((u: any) => ({
          id: String(u.id || u.Id || ""),
          userName: u.userName || u.UserName || "",
          email: u.email || u.Email || "",
          firstName: u.firstName || u.FirstName || "",
          lastName: u.lastName || u.LastName || "",
          phoneNumber: u.phoneNumber || u.PhoneNumber || "",
          profilePictureUrl: u.profilePictureUrl || u.ProfilePictureUrl || "",
          roles: u.roles || u.Roles || [],
          isLockedOut: Boolean(u.isLockedOut || u.IsLockedOut)
        }));
        setUsersList(mapped);
      }

      // 2. Fetch Roles
      const rolesRes = await fetch("/api/proxy/RoleManagement?service=jwt", {
        headers: authHeaders()
      });
      if (rolesRes.ok) {
        const rData = await rolesRes.json();
        const rawR = rData.Data || rData || [];
        const mappedR: SystemRole[] = rawR.map((r: any) => ({
          id: String(r.id || r.Id || ""),
          name: r.name || r.Name || r.roleName || r.RoleName || "",
          userCount: r.userCount || r.UserCount || 0
        }));
        setRolesList(mappedR);
      }
    } catch (err) {
      console.error("Failed to load user management data:", err);
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  // Don't fetch the staff directory for someone who isn't allowed to see it.
  // `null` means the role check hasn't resolved yet, so wait rather than
  // firing a request that may turn out to be unauthorised.
  const canAdminister = useHasRole(ADMIN_ROLES);

  useEffect(() => {
    if (canAdminister !== true) return;
    void loadData();
  }, [loadData, canAdminister]);

  // Open Manage Roles for User
  const handleOpenManageRoles = async (user: SystemUser) => {
    setSelectedUser(user);
    setShowEditRolesModal(true);
    try {
      const res = await fetch(`/api/proxy/UserManagement/${user.id}/roles?service=jwt`, {
        headers: authHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        const rawRoles: any[] = data.Data?.Roles || data.Roles || data.roles || [];
        const mapped: UserRoleAssignment[] = rawRoles.map((r: any) => ({
          id: String(r.id || r.Id || ""),
          name: r.name || r.Name || r.roleName || r.RoleName || "",
          isAssigned: Boolean(r.isAssigned || r.IsAssigned)
        }));
        setUserRoles(mapped);
      }
    } catch (err) {
      console.error("Failed to load user roles:", err);
    }
  };

  // Toggle role assignment in modal
  const toggleRoleAssignment = (roleId: string) => {
    setUserRoles((prev) =>
      prev.map((r) => (r.id === roleId ? { ...r, isAssigned: !r.isAssigned } : r))
    );
  };

  // Save updated roles
  const handleSaveUserRoles = async () => {
    if (!selectedUser) return;
    setSavingRoles(true);
    try {
      const assignedNames = userRoles.filter((r) => r.isAssigned).map((r) => r.name);
      const res = await fetch(`/api/proxy/UserManagement/${selectedUser.id}/roles?service=jwt`, {
        method: "PUT",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          UserId: selectedUser.id,
          Roles: assignedNames
        })
      });
      if (res.ok) {
        setShowEditRolesModal(false);
        await loadData();
      }
    } catch (err) {
      console.error("Failed to update user roles:", err);
    } finally {
      setSavingRoles(false);
    }
  };

  // Create new user submit
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName || !newEmail || !newPassword) return;
    setCreatingUser(true);
    try {
      const res = await fetch("/api/proxy/UserManagement?service=jwt", {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          UserName: newUserName,
          Email: newEmail,
          FirstName: newFirstName,
          LastName: newLastName,
          PhoneNumber: newPhone,
          Password: newPassword,
          ConfirmPassword: newPassword
        })
      });
      if (res.ok) {
        setShowCreateUserModal(false);
        setNewUserName("");
        setNewEmail("");
        setNewFirstName("");
        setNewLastName("");
        setNewPhone("");
        setNewPassword("");
        await loadData();
      }
    } catch (err) {
      console.error("Failed to create user:", err);
    } finally {
      setCreatingUser(false);
    }
  };

  /*
    Same module store `PageWrapper` reads, not a local `useState`.

    This page renders the shell itself rather than going through `PageWrapper`,
    and a `useState(true)` here meant the rail arrived expanded no matter what
    the user had collapsed it to elsewhere — and toggling it here persisted
    nothing, so navigating away snapped it back. See `services/sidebarPreference`
    for why this lives outside React.
  */
  const sidebarOpen = useSyncExternalStore(
    subscribeToSidebar,
    readSidebarOpen,
    readSidebarOpenOnServer
  );
  const { prefs } = useTheme();

  // Filtered users by query
  const filteredUsers = usersList.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const fullName = `${u.firstName || ""} ${u.lastName || ""}`.toLowerCase();
    return (
      u.userName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      fullName.includes(q) ||
      (u.roles && u.roles.some((r) => r.toLowerCase().includes(q)))
    );
  });

  return (
    <div className="h-screen overflow-hidden bg-sunken/70 text-ink font-sans flex">
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
      {/* The margin comes from `sidebarMarginClass` so this page cannot drift
          from `PageWrapper` again: the hardcoded `lg:ml-64` here knew nothing
          about sidebar styles, so a dual-column rail (320px) painted 64px over
          this column and an enterprise rail 48px over it.

          The `lg:` prefixes inside that helper are load-bearing. The aside is
          `position: fixed`, and below `lg` it is an off-canvas drawer occupying
          no layout space — so an unprefixed `ml-64` indented this column by
          256px on every phone and small tablet with nothing in the gap, leaving
          ~134px of usable width at 390px. Only the desktop rail earns a margin.

          `transition-[margin]` rather than `transition-all`: the latter also
          animated `background-color`, so every theme change dragged a 300ms
          cross-fade through this full-height container for no reason. */}
      <div
        className={`flex-1 flex flex-col h-screen overflow-hidden min-w-0 transition-[margin] duration-300 ease-out ${sidebarMarginClass(
          prefs.sidebarStyle || "classic",
          sidebarOpen
        )}`}
      >
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <main className="flex-1 flex flex-col p-4 lg:p-6 w-full mx-auto overflow-y-auto min-h-0 space-y-6">
        {/* Sidebar and Header stay outside the gate so a user who lands here
            by URL can still navigate away. */}
        <RequireRole allowed={ADMIN_ROLES}>
        {/* Header Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface p-6 rounded-2xl border border-subtle shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-tr from-accent to-accent-hover rounded-xl text-white shadow-md">
              <Users className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-ink ">
                {isKhmer ? "ការគ្រប់គ្រងអ្នកប្រើប្រាស់ និងតួនាទី" : "User & Role Management"}
              </h1>
              <p className="text-sm text-ink-secondary ">
                {isKhmer
                  ? "គ្រប់គ្រងគណនីបុគ្គលិក តួនាទី (Roles) និងសិទ្ធិអនុញ្ញាត (Permissions) ក្នុងប្រព័ន្ធ"
                  : "Manage system accounts, assigned roles, and security permissions"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => void loadData()}
              disabled={loading}
              className="p-2.5 rounded-xl border border-subtle text-ink-secondary hover:bg-cushion transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>

            <button
              onClick={() => setShowCreateUserModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-accent to-accent-hover hover:from-accent hover:to-accent-hover text-white rounded-xl font-medium shadow-md transition-[color,background-color,border-color,box-shadow,opacity,transform,filter] text-sm"
            >
              <UserPlus className="w-4 h-4" />
              <span>{isKhmer ? "បន្ថែមអ្នកប្រើប្រាស់" : "Add New User"}</span>
            </button>
          </div>
        </div>

        {/* Tabs & Search Filter */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center bg-sunken p-1.5 rounded-xl border border-subtle w-full sm:w-auto">
            <button
              onClick={() => setActiveTab("users")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-[color,background-color,border-color,box-shadow,opacity,transform,filter] ${
                activeTab === "users"
                  ? "bg-surface text-accent shadow-sm"
                  : "text-ink-secondary hover:text-ink "
              }`}
            >
              <Users className="w-4 h-4" />
              <span>{isKhmer ? "គណនីអ្នកប្រើប្រាស់" : "User Accounts"}</span>
              <span className="px-2 py-0.5 text-xs bg-accent-soft text-accent rounded-full font-semibold">
                {usersList.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("roles")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-[color,background-color,border-color,box-shadow,opacity,transform,filter] ${
                activeTab === "roles"
                  ? "bg-surface text-accent shadow-sm"
                  : "text-ink-secondary hover:text-ink "
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isKhmer ? "តួនាទីប្រព័ន្ធ (Roles)" : "System Roles"}</span>
              <span className="px-2 py-0.5 text-xs bg-accent-soft text-accent rounded-full font-semibold">
                {rolesList.length}
              </span>
            </button>
          </div>

          {activeTab === "users" && (
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isKhmer ? "ស្វែងរកឈ្មោះ ផ្សេងៗ..." : "Search users, email, role..."}
                className="w-full pl-10 pr-4 py-2.5 bg-surface border border-subtle rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent "
              />
            </div>
          )}
        </div>

        {/* Content Body */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-surface rounded-2xl border border-subtle ">
            <Loader2 className="w-8 h-8 animate-spin text-accent mb-3" />
            <p className="text-sm text-ink-secondary ">
              {isKhmer ? "កំពុងទាញយកទិន្នន័យពី UserManagement API..." : "Loading data from UserManagement API..."}
            </p>
          </div>
        ) : activeTab === "users" ? (
          /* Users Table */
          <div className="bg-surface rounded-2xl border border-subtle shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-ink-secondary ">
                <thead className="bg-cushion text-ink border-b border-subtle uppercase text-xs font-semibold">
                  <tr>
                    <th className="px-6 py-4">{isKhmer ? "ឈ្មោះបុគ្គលិក" : "User Info"}</th>
                    <th className="px-6 py-4">{isKhmer ? "អ៊ីម៉ែល / ទូរស័ព្ទ" : "Contact Details"}</th>
                    <th className="px-6 py-4">{isKhmer ? "តួនាទី (Roles)" : "Assigned Roles"}</th>
                    <th className="px-6 py-4">{isKhmer ? "ស្ថានភាព" : "Status"}</th>
                    <th className="px-6 py-4 text-right">{isKhmer ? "សកម្មភាព" : "Actions"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-subtle ">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-ink-muted">
                        {isKhmer ? "មិនមានទិន្នន័យអ្នកប្រើប្រាស់ឡើយ" : "No users found matching your search."}
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const fullName = `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.userName;
                      return (
                        <tr key={u.id} className="hover:bg-cushion/80 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-accent to-accent flex items-center justify-center text-white font-bold text-sm shadow-sm">
                                {fullName.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-semibold text-ink ">
                                  {fullName}
                                </div>
                                <div className="text-xs text-ink-muted flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  <span>@{u.userName}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 text-ink text-xs">
                                <Mail className="w-3.5 h-3.5 text-ink-muted" />
                                <span>{u.email || "—"}</span>
                              </div>
                              {u.phoneNumber && (
                                <div className="flex items-center gap-1.5 text-ink-secondary text-xs">
                                  <Phone className="w-3.5 h-3.5 text-ink-muted" />
                                  <span>{u.phoneNumber}</span>
                                </div>
                              )}
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-1.5">
                              {u.roles && u.roles.length > 0 ? (
                                u.roles.map((r, i) => (
                                  <span
                                    key={i}
                                    className="px-2.5 py-1 text-xs font-medium bg-accent-soft border border-accent text-accent rounded-lg"
                                  >
                                    {r}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-ink-muted italic">
                                  {isKhmer ? "គ្មាន Role" : "No Role"}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            {u.isLockedOut ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-danger-soft text-danger rounded-full border border-danger ">
                                <Lock className="w-3 h-3" />
                                <span>{isKhmer ? "បានបិទ" : "Locked"}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-success-soft text-success rounded-full border border-success ">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>{isKhmer ? "ដំណើរការ" : "Active"}</span>
                              </span>
                            )}
                          </td>

                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => void handleOpenManageRoles(u)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-accent-soft hover:bg-accent-soft text-accent rounded-lg transition-colors border border-accent "
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>{isKhmer ? "កំណត់ Roles" : "Edit Roles"}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Roles Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rolesList.map((r) => (
              <div
                key={r.id}
                className="bg-surface p-6 rounded-2xl border border-subtle shadow-sm hover:shadow-md transition-[color,background-color,border-color,box-shadow,opacity,transform,filter] space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="p-3 bg-accent-soft text-accent rounded-xl border border-accent ">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <span className="px-2.5 py-1 text-xs font-semibold bg-sunken text-ink-secondary rounded-full">
                    {r.userCount ? `${r.userCount} Users` : "System Role"}
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-ink ">
                    {r.name}
                  </h3>
                  <p className="text-xs text-ink-secondary mt-1">
                    {isKhmer
                      ? `តួនាទីប្រព័ន្ធ ${r.name} សម្រាប់កំណត់សិទ្ធិអនុញ្ញាត`
                      : `System security role defining access control permissions`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

      {/* Edit Roles Modal */}
      <ModalWrapper
        open={showEditRolesModal && !!selectedUser}
        onClose={() => setShowEditRolesModal(false)}
        maxWidth="max-w-md"
        zIndex={50}
        placement="center"
        backdropVariant="heavy"
      >
        <div className="bg-surface rounded-2xl border border-subtle p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-subtle pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-accent-soft text-accent rounded-xl">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-ink">
                  {isKhmer ? "កំណត់ Roles ជូនអ្នកប្រើប្រាស់" : "Manage User Roles"}
                </h3>
                <p className="text-xs text-ink-muted">
                  {selectedUser?.firstName} {selectedUser?.lastName} (@{selectedUser?.userName})
                </p>
              </div>
            </div>
            <button onClick={() => setShowEditRolesModal(false)} className="text-ink-muted hover:text-ink-secondary">
              <XCircle className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-3">
            {userRoles.map((r) => (
              <label
                key={r.id}
                className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-[color,background-color,border-color,box-shadow,opacity,transform,filter] ${
                  r.isAssigned
                    ? "bg-accent-soft border-accent text-accent"
                    : "bg-cushion border-subtle text-ink"
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={r.isAssigned}
                    onChange={() => toggleRoleAssignment(r.id)}
                    className="w-4 h-4 text-accent rounded focus:ring-accent"
                  />
                  <span className="font-semibold text-sm">{r.name}</span>
                </div>
                {r.isAssigned && <CheckCircle2 className="w-4 h-4 text-accent" />}
              </label>
            ))}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={() => setShowEditRolesModal(false)}
              className="px-4 py-2 text-sm text-ink-secondary hover:bg-sunken rounded-xl"
            >
              {isKhmer ? "បោះបង់" : "Cancel"}
            </button>
            <button
              onClick={() => void handleSaveUserRoles()}
              disabled={savingRoles}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-gradient-to-r from-accent to-accent-hover text-white rounded-xl shadow-md"
            >
              {savingRoles && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{isKhmer ? "រក្សាទុក" : "Save Changes"}</span>
            </button>
          </div>
        </div>
      </ModalWrapper>

      {/* Create User Modal */}
      <ModalWrapper
        open={showCreateUserModal}
        onClose={() => setShowCreateUserModal(false)}
        maxWidth="max-w-lg"
        zIndex={50}
        placement="center"
        backdropVariant="heavy"
      >
        <form
          onSubmit={(e) => void handleCreateUser(e)}
          className="bg-surface rounded-2xl border border-subtle p-6 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-subtle pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-tr from-accent to-accent-hover text-white rounded-xl">
                <UserPlus className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-ink">
                {isKhmer ? "បង្កើតគណនីអ្នកប្រើប្រាស់ថ្មី" : "Create New User Account"}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowCreateUserModal(false)}
              className="text-ink-muted hover:text-ink-secondary"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-ink-secondary mb-1 block">
                {isKhmer ? "ឈ្មោះ (First Name)" : "First Name"}
              </label>
              <input
                type="text"
                value={newFirstName}
                onChange={(e) => setNewFirstName(e.target.value)}
                className="w-full px-3.5 py-2 bg-cushion border border-subtle rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-secondary mb-1 block">
                {isKhmer ? "ត្រកូល (Last Name)" : "Last Name"}
              </label>
              <input
                type="text"
                value={newLastName}
                onChange={(e) => setNewLastName(e.target.value)}
                className="w-full px-3.5 py-2 bg-cushion border border-subtle rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-ink-secondary mb-1 block">
              {isKhmer ? "ឈ្មោះគណនី (Username) *" : "Username *"}
            </label>
            <input type="text" required value={newUserName} onChange={(e) => setNewUserName(e.target.value)} placeholder="e.g. sophy"
              className="w-full px-3.5 py-2 bg-cushion border border-subtle rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
          </div>

          <div>
            <label className="text-xs font-semibold text-ink-secondary mb-1 block">
              {isKhmer ? "អ៊ីម៉ែល (Email) *" : "Email Address *"}
            </label>
            <input type="email" required value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="sophy@camprotec.com.kh"
              className="w-full px-3.5 py-2 bg-cushion border border-subtle rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
          </div>

          <div>
            <label className="text-xs font-semibold text-ink-secondary mb-1 block">
              {isKhmer ? "លេខទូរស័ព្ទ" : "Phone Number"}
            </label>
            <input type="text" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+855 12 345 678"
              className="w-full px-3.5 py-2 bg-cushion border border-subtle rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
          </div>

          <div>
            <label className="text-xs font-semibold text-ink-secondary mb-1 block">
              {isKhmer ? "ពាក្យសម្ងាត់ (Password) *" : "Password *"}
            </label>
            <input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••"
              className="w-full px-3.5 py-2 bg-cushion border border-subtle rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3">
            <button type="button" onClick={() => setShowCreateUserModal(false)}
              className="px-4 py-2 text-sm text-ink-secondary hover:bg-sunken rounded-xl">
              {isKhmer ? "បោះបង់" : "Cancel"}
            </button>
            <button type="submit" disabled={creatingUser}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium bg-gradient-to-r from-accent to-accent-hover text-white rounded-xl shadow-md">
              {creatingUser && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{isKhmer ? "បង្កើតគណនី" : "Create Account"}</span>
            </button>
          </div>
        </form>
      </ModalWrapper>
        </RequireRole>
        </main>
      </div>
    </div>
  );
}
