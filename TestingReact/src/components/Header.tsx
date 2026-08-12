"use client";

/**
 * @file Header.tsx
 * @description Application header bar.
 * Features: sidebar toggle, global search, dark-mode toggle,
 * JWT logged-in user profile, roles, avatar/initials, and profile menu.
 */

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Bell, Globe, Menu, RefreshCw, LogOut, Sun, Moon, User as UserIcon, ShieldCheck, ChevronDown } from "lucide-react";
import { fetchUserMap, UserDto } from "@/services/userService";
import GlobalSearch from "./GlobalSearch";

interface HeaderProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export default function Header({ sidebarOpen, setSidebarOpen }: HeaderProps) {
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Initialise user info & dark mode from localStorage & UserManagement API on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("user_info");
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as {
            id?: string;
            userName?: string;
            email?: string;
            firstName?: string;
            lastName?: string;
            roles?: string[];
            role?: string;
            profilePictureUrl?: string;
          };
          
          const fn = (parsed.firstName || "").trim();
          const ln = (parsed.lastName || "").trim();
          const full = `${fn} ${ln}`.trim();
          const nameToSet = full || parsed.userName || "";
          
          setUserName(nameToSet);
          if (parsed.email) setUserEmail(parsed.email);
          if (parsed.roles && parsed.roles.length > 0) {
            setUserRole(parsed.roles[0]);
          } else if (parsed.role) {
            setUserRole(parsed.role);
          }
          if (parsed.profilePictureUrl) {
            setProfilePicture(parsed.profilePictureUrl);
          }
        } catch { /* ignore malformed JSON */ }
      }

      // Re-fetch user details from JWT UserManagement API if logged in
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

      // Dark mode
      const savedTheme = localStorage.getItem("theme");
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const dark = savedTheme === "dark" || (!savedTheme && prefersDark);
      setIsDark(dark);
      document.documentElement.classList.toggle("dark", dark);
    }
  }, []);

  // Close dropdown menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleDark = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  const handleLogout = () => {
    localStorage.removeItem("jwt_token");
    localStorage.removeItem("user_info");
    router.push("/login");
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <header className="h-16 shrink-0 border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between px-6 transition-colors dark:bg-slate-900 dark:border-slate-800">
      {/* Left controls */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
          title="Toggle Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <button
          onClick={() => window.location.reload()}
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
          title="Refresh Data"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-slate-200 dark:bg-slate-800" />

        <h1 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Repair &amp; Maintenance System
        </h1>
      </div>

      {/* Global Search Bar */}
      <div className="hidden md:flex items-center flex-1 max-w-md mx-8">
        <GlobalSearch />
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Language selector */}
        <button className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors dark:bg-slate-800 dark:text-slate-300">
          <Globe className="w-3.5 h-3.5" />
          <span>English</span>
        </button>

        {/* Dark mode toggle */}
        <button
          onClick={toggleDark}
          className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Notifications */}
        <button className="relative p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors dark:text-slate-300 dark:hover:bg-slate-800">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white dark:ring-slate-900" />
        </button>

        <div className="h-4 w-px bg-slate-200 dark:bg-slate-800" />

        {/* JWT User Profile Dropdown Menu */}
        <div className="relative pl-2" ref={menuRef}>
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {profilePicture ? (
              <img
                src={profilePicture}
                alt={userName}
                className="w-8 h-8 rounded-full object-cover ring-2 ring-blue-500/20"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-sm ring-2 ring-blue-500/20">
                {getInitials(userName)}
              </div>
            )}

            <div className="hidden lg:flex flex-col text-left">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-tight">
                Hello {userName}!
              </span>
              <span className="text-[10px] text-blue-600 font-medium dark:text-blue-400">
                {userRole}
              </span>
            </div>

            <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden lg:block" />
          </button>

          {/* User Profile Dropdown */}
          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-3 space-y-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                  {getInitials(userName)}
                </div>
                <div className="flex flex-col min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                    {userName}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {userEmail}
                  </p>
                </div>
              </div>

              <div className="px-2 py-1 flex items-center justify-between text-[11px] font-medium text-slate-600 dark:text-slate-300">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600" /> Role:
                </span>
                <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-bold dark:bg-blue-950 dark:text-blue-300">
                  {userRole}
                </span>
              </div>

              <div className="h-px bg-slate-100 dark:bg-slate-800" />

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors"
              >
                <LogOut className="w-4 h-4 text-red-500" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
