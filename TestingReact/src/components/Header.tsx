"use client";

/**
 * @file Header.tsx
 * @description Application header bar.
 * Features: sidebar toggle, global search, language switcher, dark-mode
 * toggle, JWT logged-in user profile, roles, avatar/initials, profile menu.
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Camera, Check, Globe, Loader2, Menu, RefreshCw, LogOut, Settings, User as UserIcon, ShieldCheck, ChevronDown, Sparkles, Leaf } from "lucide-react";
import { fetchUserMap } from "@/services/userService";
import { clearSession } from "@/services/authSession";
import { useProfilePhotoUpload } from "@/hooks/useProfilePhotoUpload";
import { useI18n } from "@/i18n/LanguageProvider";
import { LANGUAGES, LANGUAGE_LABELS, LANGUAGE_SHORT } from "@/i18n/translations";
import { useActionHandler } from "./ActionBus";
import { useIsModalActive } from "@/hooks/useIsModalActive";
import { cn } from "@/lib/utils";
import GlobalSearch from "./GlobalSearch";
import SystemStatus from "./SystemStatus";
import ThemeToggle from "./ThemeToggle";
import CompanionScannerHeaderButton from "./CompanionScannerHeaderButton";
import { useCompanionScanner } from "@/context/CompanionScannerContext";

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
  const headerRef = useRef<HTMLElement>(null);
  const router = useRouter();
  const { disconnectPhone } = useCompanionScanner();
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

  // The direct, discoverable place to change a profile photo — the dropdown
  // you already open to see your name/role/logout. `useProfilePhotoUpload`
  // owns the upload+persist mutation; this component keeps its own
  // `profilePicture` display state because it already has one (seeded from
  // storage, refreshed async from `fetchUserMap()`) and just updates it with
  // whatever URL a successful upload returns.
  const {
    isUploading: isUploadingPhoto,
    progress: photoProgress,
    uploadPhoto,
  } = useProfilePhotoUpload();
  const photoFileInputRef = useRef<HTMLInputElement>(null);
  const handlePhotoFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      const url = await uploadPhoto(file);
      if (url) setProfilePicture(url);
    },
    [uploadPhoto]
  );

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
    // Disconnect linked phone scanner companion session
    disconnectPhone();

    // clearSession() also drops the `cache:` entries in sessionStorage. Those
    // hold the previous user's ticket queues and customer rows, and on a shared
    // workshop machine they would otherwise still be there for whoever logs in
    // next — the tables paint from cache before the first fetch returns.
    clearSession();
    sessionStorage.removeItem("robot_greeted");
    router.push("/login");
  };

  const getInitials = (name: string) => {
    if (!name || !name.trim()) return "U";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const isModalActive = useIsModalActive();

  const renderRightControls = () => (
    <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
      {/* Mobile Companion Hardware Scanner Button */}
      <CompanionScannerHeaderButton />

      {/* Language selector */}
      <div className="relative" ref={langRef}>
        <button
          onClick={() => setShowLangMenu((v) => !v)}
          title={t("header.selectLanguage")}
          aria-haspopup="listbox"
          aria-expanded={showLangMenu}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-ink bg-sunken rounded-lg hover:bg-sunken transition-colors"
        >
          <Globe className="w-3.5 h-3.5 shrink-0" />
          {/* Label and chevron drop below `xl`. The globe alone is an
              understood affordance, and between 1024 and 1279 the rail plus
              this cluster does not fit — see the header comment on the row. */}
          <span className="hidden xl:inline">{LANGUAGE_SHORT[lang]}</span>
          <ChevronDown className={`hidden xl:block w-3 h-3 text-ink-muted transition-transform duration-200 ${showLangMenu ? "rotate-180" : ""}`} />
        </button>

        <AnimatePresence>
          {showLangMenu && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 450, damping: 28 }}
              role="listbox"
              className="absolute right-0 mt-2 w-44 av-glass-panel rounded-xl p-1.5 z-[250] shadow-xl"
            >
              <p className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                {t("header.selectLanguage")}
              </p>
              {LANGUAGES.map((code) => (
                <button
                  key={code}
                  role="option"
                  aria-selected={lang === code}
                  onClick={() => {
                    setLang(code);
                    setTimeout(() => setShowLangMenu(false), 60);
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 text-xs font-medium rounded-lg transition-colors ${
                    lang === code
                      ? "bg-accent-soft text-accent-soft-fg"
                      : "text-ink av-glass-row"
                  }`}
                >
                  <span>{LANGUAGE_LABELS[code]}</span>
                  {lang === code && <Check className="w-3.5 h-3.5 shrink-0" />}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Connection + backend health. Hidden below `xl`: it is a diagnostic
          latency badge, the widest single item in this cluster (~85px), and
          the first thing that should go when the row is short of room. */}
      <div className="hidden xl:flex items-center">
        <SystemStatus />
      </div>

      {/* Light / dark / system */}
      <ThemeToggle />

      {/* Notifications */}
      <button
        title={t("header.notifications")}
        className="relative p-2 text-ink-secondary hover:bg-sunken rounded-lg transition-colors"
      >
        <Bell className="w-4 h-4" />
        <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent ring-2 ring-surface" />
      </button>

      <div className="h-4 w-px bg-sunken" />

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

          {/* `xl`, not `lg`. At `lg` the 256px rail is already showing, so
              1024-1279 has only ~768px of row to work with and this 66px name
              block was part of what pushed the cluster past the edge. The
              avatar still identifies the signed-in user. */}
          <div className="hidden xl:flex flex-col text-left">
            <span className="text-xs font-semibold text-ink leading-tight">
              {t("header.greeting", { name: userName })}
            </span>
            <span className="text-[10px] text-accent font-medium">
              {userRole}
            </span>
          </div>

          <ChevronDown className="w-3.5 h-3.5 text-ink-muted hidden lg:block" />
        </button>

        {/* User Profile Dropdown — Aura-style animated glass panel */}
        <AnimatePresence>
          {showProfileMenu && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 450, damping: 28 }}
              className="absolute right-0 mt-2 w-56 av-glass-panel rounded-2xl p-3 space-y-2 z-[250] shadow-xl"
            >
              <div className="flex items-center gap-3 p-2 bg-cushion/70 rounded-xl">
                {profilePicture ? (
                  <img
                    src={profilePicture}
                    alt=""
                    width={40}
                    height={40}
                    decoding="async"
                    className="w-10 h-10 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center font-bold text-sm shrink-0">
                    {getInitials(userName)}
                  </div>
                )}
                <div className="flex flex-col min-w-0">
                  <p className="text-xs font-bold text-ink truncate">{userName}</p>
                  <p className="text-[11px] text-ink-secondary truncate">{userEmail}</p>
                </div>
              </div>

              <div className="px-2 py-1 flex items-center justify-between text-[11px] font-medium text-ink-secondary">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-accent" /> {t("header.role")}:
                </span>
                <span className="px-2 py-0.5 rounded-md bg-accent-soft text-accent-soft-fg font-bold">
                  {userRole}
                </span>
              </div>

              <button
                type="button"
                disabled={isUploadingPhoto}
                onClick={() => photoFileInputRef.current?.click()}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-ink av-glass-row rounded-xl disabled:opacity-60"
              >
                {isUploadingPhoto ? (
                  <Loader2 className="w-4 h-4 text-accent animate-spin" />
                ) : (
                  <Camera className="w-4 h-4 text-accent" />
                )}
                <span>
                  {isUploadingPhoto
                    ? photoProgress === null
                      ? t("upload.uploading")
                      : t("upload.uploadingPercent", { percent: String(photoProgress) })
                    : t("header.changePhoto")}
                </span>
              </button>
              <input
                ref={photoFileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handlePhotoFileSelected}
                className="hidden"
              />

              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  router.push("/settings");
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-ink av-glass-row rounded-xl"
              >
                <Settings className="w-4 h-4 text-accent" />
                <span>{t("nav.systemSettings")}</span>
              </button>

              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  router.push("/users");
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-ink av-glass-row rounded-xl"
              >
                <UserIcon className="w-4 h-4 text-accent" />
                <span>{lang === "km" ? "គ្រប់គ្រង Users & Roles" : "Users & Roles Management"}</span>
              </button>

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-danger hover:bg-danger-soft rounded-xl transition-colors"
              >
                <LogOut className="w-4 h-4 text-danger" />
                <span>{t("header.signOut")}</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );

  /*
    Publish the header's own height as `--av-header-h` on <html>, for
    `.av-modal-center` / `.av-modal-top` in `globals.css` to reserve.

    The header is `sticky top-0` and, while a dialog is open, deliberately
    raised to `z-[2500]` — ABOVE the modal layer at 1120. So a viewport-centred
    dialog does not merely sit near the header, it is painted under it, and on
    a 1366x768 screen (~625px of viewport) the panel's top corner and part of
    its title row disappear behind the band.

    Measured rather than hardcoded because the height is breakpoint-dependent
    (`py-1.5` / `xl:py-2.5` around an `h-11`..`xl:h-14` bar — 68px at 1280 and
    below, 76px above) and would drift the moment either changes. A
    `ResizeObserver` also covers the density and font-scale preferences, which
    resize the bar without any viewport change at all.

    Removed on unmount so the headerless routes — `/login`, `/scanner` — fall
    back to the `0px` default in the `var()` and reserve nothing.
  */
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const root = document.documentElement;
    const write = () =>
      root.style.setProperty(
        "--av-header-h",
        `${Math.round(el.getBoundingClientRect().height)}px`
      );
    write();
    /*
      `box: "border-box"`, not the default `content-box`. The bar inside this
      element is a fixed `h-11`..`xl:h-14`, so the header's CONTENT box is 56px
      at every breakpoint — only its `py-1.5` / `xl:py-2.5` padding changes
      (68px total below `xl`, 76px above). Observed as content-box the callback
      never fires on a breakpoint crossing, and the published value silently
      keeps the previous breakpoint's height. Caught by resizing 1920 -> 1200
      and reading 76px back off an element measuring 68px.
    */
    const observer = new ResizeObserver(write);
    observer.observe(el, { box: "border-box" });
    return () => {
      observer.disconnect();
      root.style.removeProperty("--av-header-h");
    };
  }, []);

  return (
    <header
      ref={headerRef}
      className={cn(
        "sticky top-0 w-full px-3 sm:px-4 lg:px-4 xl:px-6 py-1.5 lg:py-1.5 xl:py-2.5 transition-all shrink-0",
        isModalActive ? "z-[2500]" : "z-[140]"
      )}
    >
      <div className="flex items-center justify-between h-11 sm:h-12 lg:h-12 xl:h-14 px-3 sm:px-4 xl:px-5 rounded-2xl soft-glass border border-subtle shadow-soft-sm relative">
        {/* Left: Sidebar Toggle, Reload & Brand Identity.

            `min-w-0` so this column can shrink. A flex item defaults to
            `min-width: auto`, which refuses to go below its content — with
            three unshrinkable columns in one row that is what turns a tight
            fit into horizontal overflow of the whole document. */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-xl text-ink-secondary hover:text-ink hover:bg-sunken transition-colors cursor-pointer"
            title={t("header.toggleSidebar")}
          >
            <Menu className="w-5 h-5" />
          </button>

          <button
            onClick={() => window.location.reload()}
            className="p-2 rounded-xl text-ink-secondary hover:text-ink hover:bg-sunken transition-colors cursor-pointer"
            title={t("header.refresh")}
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {isModalActive && (
            <div className="hidden lg:flex items-center gap-2.5 pl-2 border-l border-subtle enter-fade">
              <span className="w-8 h-8 rounded-xl grid place-items-center bg-accent-soft text-accent shrink-0">
                <Sparkles className="w-4 h-4" />
              </span>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-xs text-ink tracking-tight">
                  {t("app.brand")}
                </span>
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-accent-soft text-accent border border-accent/20">
                  v2
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Center: Global Search Bar / Command Palette Trigger */}
        {/* `max-w-xs` until `xl`. Between 1024 and 1279 the 256px rail leaves
            roughly 768px of row; at `max-w-md` (448px) the search alone plus
            the right cluster exceeded it. It grows back to `max-w-md` once
            there is room for it. */}
        <div className="hidden md:flex items-center flex-1 min-w-0 max-w-xs xl:max-w-md mx-3 lg:mx-4 xl:mx-6">
          <GlobalSearch />
        </div>

        {/* Right Controls */}
        {renderRightControls()}
      </div>
    </header>
  );
}
