"use client";

/**
 * @file Header.tsx
 * @description Application header bar.
 * Features: sidebar toggle, global search, language switcher, dark-mode
 * toggle, JWT logged-in user profile, roles, avatar/initials, profile menu.
 */

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, Globe, Menu, RefreshCw, LogOut, User as UserIcon, ShieldCheck, ChevronDown } from "lucide-react";
import { fetchUserMap } from "@/services/userService";
import { clearSession } from "@/services/authSession";
import { useI18n } from "@/i18n/LanguageProvider";
import { LANGUAGES, LANGUAGE_LABELS, LANGUAGE_SHORT } from "@/i18n/translations";
import { useActionHandler } from "./ActionBus";
import GlobalSearch from "./GlobalSearch";
import SystemStatus from "./SystemStatus";
import ThemeToggle from "./ThemeToggle";

interface HeaderProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

/**
 * The cached user, read straight out of localStorage.
 *
 * Used as a lazy `useState` initialiser so the header's first render already
 * shows the signed-in name. It used to start empty and be filled by a mount
 * effect, which meant every page navigation flashed a blank profile area
 * before the name appeared — the data was local and instant the whole time.
 *
 * Safe against a hydration mismatch because `Header` never reaches the server
 * HTML: `AuthGuard` renders its checking state instead, so this component's
 * first render is always a client one.
 */
function readStoredUser(): {
  name: string;
  role: string;
  email: string;
  picture: string | null;
} {
  const empty = { name: "", role: "", email: "", picture: null };
  if (typeof window === "undefined") return empty;
  try {
    const stored = localStorage.getItem("user_info");
    if (!stored) return empty;
    const parsed = JSON.parse(stored) as {
      userName?: string;
      email?: string;
      firstName?: string;
      lastName?: string;
      roles?: string[];
      role?: string;
      profilePictureUrl?: string;
    };
    const full = `${(parsed.firstName || "").trim()} ${(parsed.lastName || "").trim()}`.trim();
    return {
      name: full || parsed.userName || "",
      role: parsed.roles?.[0] || parsed.role || "",
      email: parsed.email || "",
      picture: parsed.profilePictureUrl || null
    };
  } catch {
    // Malformed JSON in localStorage is not worth failing a page render over.
    return empty;
  }
}

export default function Header({ sidebarOpen, setSidebarOpen }: HeaderProps) {
  const router = useRouter();
  const [userName, setUserName] = useState(readStoredUser().name);
  const [userRole, setUserRole] = useState(readStoredUser().role);
  const [userEmail, setUserEmail] = useState(readStoredUser().email);
  const [profilePicture, setProfilePicture] = useState<string | null>(
    readStoredUser().picture
  );
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);
  const { lang, setLang, t } = useI18n();

  /**
   * Refreshes the cached profile against the UserManagement API.
   *
   * Only the *asynchronous* half is left here. The synchronous localStorage
   * read that used to open this effect now seeds `useState` directly, and the
   * dark-mode block that used to close it now lives in `ThemeScript`, which
   * runs before the first paint instead of after it. What remains is a genuine
   * side effect: a network call whose result legitimately arrives later.
   *
   * `fetchUserMap` caches at module scope and de-dupes in-flight calls, so
   * mounting this header on every page navigation costs one request per
   * session, not one per page.
   */
  useEffect(() => {
    if (typeof window !== "undefined") {
      fetchUserMap()
        .then((userMap) => {
          const stored = localStorage.getItem("user_info");
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              const userId = parsed.id || parsed.userName;
              if (userId) {
                const u = userMap.get(userId.toLowerCase());
                if (u) {
                  const fn = (u.firstName || "").trim();
                  const ln = (u.lastName || "").trim();
                  const full = `${fn} ${ln}`.trim();
                  if (full || u.userName) setUserName(full || u.userName);
                  if (u.email) setUserEmail(u.email);
                  if (u.roles && u.roles.length > 0) setUserRole(u.roles[0]);
                  if (u.profilePictureUrl) setProfilePicture(u.profilePictureUrl);
                }
              }
            } catch {}
          }
        })
        .catch(() => {});
    }
  }, []);

  // Close dropdown menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setShowProfileMenu(false);
      }
      if (langRef.current && !langRef.current.contains(target)) {
        setShowLangMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Interface controls, exposed to the assistant ──────────────────────────
  //
  // The language lives behind a button in this header, so the header is the
  // only place that can perform it. It changes nothing but what the user is
  // looking at, which is why it always reports success.
  //
  // The `ui.theme.dark` / `.light` / `.toggle` handlers that sat here are gone
  // with dark mode — there is one palette now, so there is nothing to switch.
  useActionHandler("ui.language.english", () => {
    setLang("en");
    return true;
  });
  useActionHandler("ui.language.khmer", () => {
    setLang("km");
    return true;
  });

  const handleLogout = () => {
    // clearSession() also drops the `cache:` entries in sessionStorage. Those
    // hold the previous user's ticket queues and customer rows, and on a shared
    // workshop machine they would otherwise still be there for whoever logs in
    // next — the tables paint from cache before the first fetch returns.
    clearSession();
    sessionStorage.removeItem("robot_greeted");
    router.push("/login");
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const headerBgClass = "border-b border-subtle av-glass";

  return (
    <header className={`h-16 shrink-0 sticky top-0 z-30 flex items-center justify-between px-6 transition-colors ${headerBgClass}`}>
      {/* Left controls */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg text-ink-secondary hover:bg-sunken transition-colors"
          title={t("header.toggleSidebar")}
        >
          <Menu className="w-5 h-5" />
        </button>

        <button
          onClick={() => window.location.reload()}
          className="p-2 rounded-lg text-ink-secondary hover:bg-sunken transition-colors"
          title={t("header.refresh")}
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Global Search Bar */}
      <div className="hidden md:flex items-center flex-1 max-w-md mx-8">
        <GlobalSearch />
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Language selector */}
        <div className="relative" ref={langRef}>
          <button
            onClick={() => setShowLangMenu((v) => !v)}
            title={t("header.selectLanguage")}
            aria-haspopup="listbox"
            aria-expanded={showLangMenu}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-ink bg-sunken rounded-lg hover:bg-sunken transition-colors "
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{LANGUAGE_SHORT[lang]}</span>
            <ChevronDown className="w-3 h-3 text-ink-muted" />
          </button>

          {showLangMenu && (
            <div
              role="listbox"
              className="absolute right-0 mt-2 w-44 bg-elevated border border-subtle rounded-xl shadow-xl p-1.5 z-50 enter-pop"
            >
              <p className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                {t("header.selectLanguage")}
              </p>
              {LANGUAGES.map((code) => (
                <button
                  key={code}
                  role="option"
                  aria-selected={lang === code}
                  onClick={() => { setLang(code); setShowLangMenu(false); }}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 text-xs font-medium rounded-lg transition-colors ${
                    lang === code
                      ? "bg-accent-soft text-accent-soft-fg"
                      : "text-ink hover:bg-sunken "
                  }`}
                >
                  <span>{LANGUAGE_LABELS[code]}</span>
                  {lang === code && <Check className="w-3.5 h-3.5 shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Connection + backend health. Sits before the theme toggle so it is
            the first thing in this cluster, and stays visible on every page. */}
        <SystemStatus />

        {/* Light / dark / system. In the header rather than buried in Settings
            because it is the one appearance control people reach for daily —
            the others (radius, density, font scale) are set once. */}
        <ThemeToggle />

        {/* Notifications */}
        <button
          title={t("header.notifications")}
          className="relative p-2 text-ink-secondary hover:bg-sunken rounded-lg transition-colors "
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent ring-2 ring-white " />
        </button>

        <div className="h-4 w-px bg-sunken " />

        {/* JWT User Profile Dropdown Menu */}
        <div className="relative pl-2" ref={menuRef}>
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-sunken transition-colors"
          >
            {profilePicture ? (
              <img
                src={profilePicture}
                alt={userName}
                width={32}
                height={32}
                decoding="async"
                className="w-8 h-8 rounded-full object-cover ring-2 ring-accent/20"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center font-bold text-xs shadow-sm ring-2 ring-accent/20">
                {getInitials(userName)}
              </div>
            )}

            <div className="hidden lg:flex flex-col text-left">
              <span className="text-xs font-semibold text-ink leading-tight">
                {t("header.greeting", { name: userName })}
              </span>
              <span className="text-[10px] text-accent font-medium">
                {userRole}
              </span>
            </div>

            <ChevronDown className="w-3.5 h-3.5 text-ink-muted hidden lg:block" />
          </button>

          {/* User Profile Dropdown */}
          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-elevated border border-subtle rounded-2xl shadow-xl p-3 space-y-2 z-50 enter-pop">
              <div className="flex items-center gap-3 p-2 bg-cushion rounded-xl">
                <div className="w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center font-bold text-sm">
                  {getInitials(userName)}
                </div>
                <div className="flex flex-col min-w-0">
                  <p className="text-xs font-bold text-ink truncate">
                    {userName}
                  </p>
                  <p className="text-[11px] text-ink-secondary truncate">
                    {userEmail}
                  </p>
                </div>
              </div>

              <div className="px-2 py-1 flex items-center justify-between text-[11px] font-medium text-ink-secondary ">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-accent" /> {t("header.role")}:
                </span>
                <span className="px-2 py-0.5 rounded-md bg-accent-soft text-accent-soft-fg font-bold">
                  {userRole}
                </span>
              </div>

              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  router.push("/users");
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-ink hover:bg-sunken rounded-xl transition-colors"
              >
                <UserIcon className="w-4 h-4 text-accent " />
                <span>{lang === "km" ? "គ្រប់គ្រង Users & Roles" : "Users & Roles Management"}</span>
              </button>

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-danger hover:bg-danger-soft rounded-xl transition-colors"
              >
                <LogOut className="w-4 h-4 text-danger" />
                <span>{t("header.signOut")}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
