"use client";

/**
 * @file app/profile/page.tsx
 * @description Pixel-Perfect, High-Performance Unified User Profile & Settings Hub.
 * Features full-width Tab Bar directly below Profile Header, live Unsplash Studio,
 * embedded SettingsSection, complete user information fields, edit profile, and change password.
 */

import { syncUserProfile, USER_INFO_UPDATED_EVENT } from "@/services/profileSync";
import BrandLogo from "@/components/BrandLogo";
import React, { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  User as UserIcon,
  Shield,
  ShieldCheck,
  BadgeCheck,
  Mail,
  Phone,
  MapPin,
  Globe,
  Camera,
  Sparkles,
  Search,
  Check,
  Edit3,
  Smartphone,
  Palette,
  X,
  Loader2,
  Settings,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  Copy,
  Building,
  UserCheck,
  Maximize2,
} from "lucide-react";
import toast from "react-hot-toast";
import PageWrapper from "@/components/PageWrapper";
import { ModalWrapper } from "@/components/av/ModalWrapper";
import MediaLightbox from "@/components/MediaLightbox";
import { useProfilePhotoUpload } from "@/hooks/useProfilePhotoUpload";
import {
  fetchUserMap,
  updateUserProfile,
  changeUserPassword,
} from "@/services/userService";
import {
  searchUnsplash,
  UnsplashWebPhoto,
  CURATED_WEB_WALLPAPERS,
} from "@/services/unsplashService";
import SettingsSection from "@/components/settings/SettingsSection";
import { firstValidationMessage } from "@/i18n/validationMessage";
import { validateProfile, validatePasswordChange } from "@/validation";
import { useI18n } from "@/i18n/LanguageProvider";

type ProfileTab = "about" | "settings" | "security" | "wallpapers" | "devices";

interface StoredUserProfile {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  userName: string;
  role: string;
  email: string;
  phoneNumber: string;
  picture: string | null;
  coverUrl: string | null;
  location: string;
  department: string;
}

const CATEGORY_TABS = [
  { id: "all", label: "All Wallpapers" },
  { id: "cyber", label: "Cyber & AI" },
  { id: "mountain", label: "Mountains" },
  { id: "nature", label: "Nature" },
  { id: "space", label: "Space & Stars" },
  { id: "dark", label: "Dark Minimal" },
  { id: "urban", label: "City & Supercars" },
  { id: "pastel", label: "Pastel Wave" },
];

function getInitials(name: string): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function readStoredUser(): StoredUserProfile {
  const fallback: StoredUserProfile = {
    id: "",
    name: "samrith ratana",
    firstName: "samrith",
    lastName: "ratana",
    userName: "samrith.ratana",
    role: "SuperAdmin",
    email: "admin@gmail.com",
    phoneNumber: "016285116",
    picture: null,
    coverUrl: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=1920&auto=format&fit=crop",
    location: "Phnom Penh, Cambodia",
    department: "Headquarters & Core System",
  };

  if (typeof window === "undefined") return fallback;
  try {
    const stored = localStorage.getItem("user_info");
    const storedCover = localStorage.getItem("user_profile_cover");
    if (!stored) return fallback;
    const parsed = JSON.parse(stored);
    const firstName = String(parsed.firstName || parsed.FirstName || "");
    const lastName = String(parsed.lastName || parsed.LastName || "");
    const userName = String(parsed.userName || parsed.UserName || "");
    const email = String(parsed.email || parsed.Email || fallback.email);
    const phone = String(parsed.phoneNumber || parsed.PhoneNumber || fallback.phoneNumber);
    const rawRoles = parsed.roles || parsed.Roles || (parsed.role ? [parsed.role] : []);
    const roles = Array.isArray(rawRoles) ? rawRoles : [];
    let picture = (parsed.profilePictureUrl || parsed.ProfilePictureUrl || null) as string | null;
    if (picture && typeof picture === "string" && picture.startsWith("/uploads/")) {
      const jwtApi = process.env.NEXT_PUBLIC_JWT_API_URL || "https://user.camprotec.com.kh";
      picture = `${jwtApi}${picture}`;
    }
    const full = `${firstName.trim()} ${lastName.trim()}`.trim();

    return {
      id: String(parsed.id || parsed.Id || parsed.userId || ""),
      name: full || userName || fallback.name,
      firstName: firstName || (full ? full.split(" ")[0] : fallback.firstName),
      lastName: lastName || (full ? full.split(" ").slice(1).join(" ") : fallback.lastName),
      userName: userName || fallback.userName,
      role: roles[0] || fallback.role,
      email: email,
      phoneNumber: phone,
      picture: picture,
      coverUrl:
        String(parsed.coverUrl || parsed.CoverUrl || "") ||
        storedCover ||
        fallback.coverUrl,
      location: String(parsed.location || fallback.location),
      department: String(parsed.department || fallback.department),
    };
  } catch {
    return fallback;
  }
}

function ProfileContent() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get("tab") as ProfileTab | null;

  const [activeTab, setActiveTab] = useState<ProfileTab>(() => {
    if (tabParam && ["about", "settings", "security", "wallpapers", "devices"].includes(tabParam)) {
      return tabParam;
    }
    return "about";
  });

  const [profile, setProfile] = useState<StoredUserProfile>(readStoredUser);

  /*
    Pull the server's copy of the profile on mount, then re-read local state
    when it lands. This is what makes an edit made on the CAM ID mobile app
    (which writes to the server) appear here without signing out and back in.
    TTL-gated inside syncUserProfile, so revisiting the page is cheap.
  */
  useEffect(() => {
    const refresh = () => setProfile(readStoredUser());
    window.addEventListener(USER_INFO_UPDATED_EVENT, refresh);
    void syncUserProfile();
    return () => {
      window.removeEventListener(USER_INFO_UPDATED_EVENT, refresh);
    };
  }, []);

  // Sync tab from URL
  useEffect(() => {
    if (tabParam && ["about", "settings", "security", "wallpapers", "devices"].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  // Edit Profile Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editModalTab, setEditModalTab] = useState<"profile" | "password">("profile");

  // Profile fields state
  const [editFirstName, setEditFirstName] = useState(profile.firstName);
  const [editLastName, setEditLastName] = useState(profile.lastName);
  const [editUserName, setEditUserName] = useState(profile.userName);
  const [editEmail, setEditEmail] = useState(profile.email);
  const [editPhone, setEditPhone] = useState(profile.phoneNumber);
  const [editLocation, setEditLocation] = useState(profile.location);
  const [editDepartment, setEditDepartment] = useState(profile.department);
  const [savingProfile, setSavingProfile] = useState(false);

  // Change Password fields state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Open Edit Modal helper
  const openEditModal = (subTab: "profile" | "password" = "profile") => {
    setEditModalTab(subTab);
    setEditFirstName(profile.firstName || profile.name.split(" ")[0] || "");
    setEditLastName(profile.lastName || profile.name.split(" ").slice(1).join(" ") || "");
    setEditUserName(profile.userName || profile.name.toLowerCase().replace(/\s+/g, "."));
    setEditEmail(profile.email);
    setEditPhone(profile.phoneNumber);
    setEditLocation(profile.location);
    setEditDepartment(profile.department);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowEditModal(true);
  };

  // Unsplash Studio Modal & State
  const [showUnsplashModal, setShowUnsplashModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [wallpapers, setWallpapers] = useState<UnsplashWebPhoto[]>(CURATED_WEB_WALLPAPERS);
  const [loadingWallpapers, setLoadingWallpapers] = useState(false);
  const [customCoverInput, setCustomCoverInput] = useState("");
  const [previewCoverUrl, setPreviewCoverUrl] = useState<string | null>(null);
  const [isCoverLightboxOpen, setIsCoverLightboxOpen] = useState(false);

  // Photo Upload hook
  const { isUploading: isUploadingPhoto, uploadPhoto } = useProfilePhotoUpload();
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Sync profile data from UserManagement API on mount
  useEffect(() => {
    fetchUserMap()
      .then((userMap) => {
        const stored = localStorage.getItem("user_info");
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            const uid = (parsed.id || parsed.Id || parsed.userName || parsed.UserName || "").toLowerCase();
            if (uid) {
              const u = userMap.get(uid);
              if (u) {
                const fn = (u.firstName || "").trim();
                const ln = (u.lastName || "").trim();
                const full = `${fn} ${ln}`.trim();
                let pic = u.profilePictureUrl || null;
                if (pic && pic.startsWith("/uploads/")) {
                  const jwtApi = process.env.NEXT_PUBLIC_JWT_API_URL || "https://user.camprotec.com.kh";
                  pic = `${jwtApi}${pic}`;
                }
                setProfile((prev) => ({
                  ...prev,
                  id: u.id || prev.id,
                  name: full || u.userName || prev.name,
                  firstName: fn || prev.firstName,
                  lastName: ln || prev.lastName,
                  userName: u.userName || prev.userName,
                  email: u.email || prev.email,
                  role: (u.roles && u.roles[0]) || prev.role,
                  phoneNumber: u.phoneNumber || prev.phoneNumber,
                  picture: pic || prev.picture,
                }));
              }
            }
          } catch {}
        }
      })
      .catch(() => {});

    // Listen for avatar updates dispatched across components
    const handleUserInfoUpdated = (e: any) => {
      if (e?.detail?.url) {
        setProfile((prev) => ({ ...prev, picture: e.detail.url }));
      }
      if (e?.detail?.name) {
        setProfile((prev) => ({
          ...prev,
          name: e.detail.name,
          email: e.detail.email || prev.email,
          phoneNumber: e.detail.phoneNumber || prev.phoneNumber,
        }));
      }
    };
    window.addEventListener("user_info_updated", handleUserInfoUpdated);
    return () => window.removeEventListener("user_info_updated", handleUserInfoUpdated);
  }, []);

  // Fetch Unsplash Wallpapers
  const fetchWallpapers = useCallback(async (query: string, category: string) => {
    setLoadingWallpapers(true);
    try {
      const results = await searchUnsplash(query, category);
      setWallpapers(results);
    } catch {
      setWallpapers(CURATED_WEB_WALLPAPERS);
    } finally {
      setLoadingWallpapers(false);
    }
  }, []);

  // Debounced search when searching Unsplash
  useEffect(() => {
    if (!showUnsplashModal && activeTab !== "wallpapers") return;

    if (searchQuery.trim().length > 0) {
      const timer = setTimeout(() => {
        fetchWallpapers(searchQuery.trim(), "all");
      }, 300);
      return () => clearTimeout(timer);
    } else {
      fetchWallpapers("", selectedCategory);
    }
  }, [showUnsplashModal, activeTab, searchQuery, selectedCategory, fetchWallpapers]);

  /*
    Handle Cover Selection. Server first (the new CoverUrl column) so the CAM
    ID mobile app and any other browser show the same cover; localStorage
    stays as an offline cache. Persisting reuses PUT api/auth/update-profile,
    which treats a missing CoverUrl as "leave unchanged", so sending only the
    identity fields it requires plus the cover cannot clobber anything.
  */
  const handleApplyCover = useCallback((url: string) => {
    setProfile((prev) => ({ ...prev, coverUrl: url }));
    let info: Record<string, unknown> = {};
    try {
      localStorage.setItem("user_profile_cover", url);
      info = JSON.parse(localStorage.getItem("user_info") || "{}");
      info.coverUrl = url;
      localStorage.setItem("user_info", JSON.stringify(info));
    } catch {}
    void (async () => {
      try {
        const token = localStorage.getItem("jwt_token");
        if (!token) return;
        const res = await fetch("/api/proxy/Auth/update-profile?service=jwt", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            FirstName: String(info.firstName || profile.firstName || ""),
            LastName: String(info.lastName || profile.lastName || ""),
            Email: String(info.email || profile.email || ""),
            PhoneNumber: String(info.phoneNumber || profile.phoneNumber || ""),
            CoverUrl: url,
          }),
        });
        if (!res.ok) {
          console.warn("Cover saved locally; server rejected the sync:", res.status);
        }
      } catch (err) {
        console.warn("Cover saved locally; server unreachable:", err);
      }
    })();
    toast.success("Cover background updated!");
    setShowUnsplashModal(false);
  }, [profile.firstName, profile.lastName, profile.email, profile.phoneNumber]);

  // Handle Photo Upload
  const handleAvatarFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const newUrl = await uploadPhoto(file);
      if (newUrl) {
        setProfile((prev) => ({ ...prev, picture: newUrl }));
        toast.success("Profile photo updated!");
      }
    },
    [uploadPhoto]
  );

  // Save Profile Info
  const handleSaveProfile = useCallback(async () => {
    // One rule, both platforms: `@/validation` is mirrored into the CamID app,
    // whose profile screen checked the name and then saved an email and a phone
    // number it had never looked at. So did this one.
    const check = validateProfile({
      name: editFirstName,
      email: editEmail,
      phoneNumber: editPhone,
    });
    if (!check.isValid) {
      toast.error(firstValidationMessage(check, t));
      return;
    }
    setSavingProfile(true);
    try {
      const fullName = `${editFirstName.trim()} ${editLastName.trim()}`.trim();
      setProfile((prev) => ({
        ...prev,
        name: fullName,
        firstName: editFirstName.trim(),
        lastName: editLastName.trim(),
        userName: editUserName.trim(),
        email: editEmail.trim(),
        phoneNumber: editPhone.trim(),
        location: editLocation.trim(),
        department: editDepartment.trim(),
      }));

      // Update backend if profile has ID
      if (profile.id) {
        await updateUserProfile(profile.id, {
          firstName: editFirstName.trim(),
          lastName: editLastName.trim(),
          email: editEmail.trim(),
          phoneNumber: editPhone.trim(),
          userName: editUserName.trim() || undefined,
        });
      }

      // Update local storage
      const stored = localStorage.getItem("user_info");
      const parsed = stored ? JSON.parse(stored) : {};
      localStorage.setItem(
        "user_info",
        JSON.stringify({
          ...parsed,
          firstName: editFirstName.trim(),
          lastName: editLastName.trim(),
          fullName,
          userName: editUserName.trim() || parsed.userName,
          email: editEmail.trim(),
          phoneNumber: editPhone.trim(),
          location: editLocation.trim(),
          department: editDepartment.trim(),
        })
      );

      window.dispatchEvent(
        new CustomEvent("user_info_updated", {
          detail: {
            name: fullName,
            email: editEmail.trim(),
            phoneNumber: editPhone.trim(),
          },
        })
      );

      toast.success("Profile updated successfully!");
      setShowEditModal(false);
    } catch {
      toast.error("Could not update profile.");
    } finally {
      setSavingProfile(false);
    }
  }, [editFirstName, editLastName, editUserName, editEmail, editPhone, editLocation, editDepartment, profile.id, t]);

  // Handle Change Password
  const handleChangePassword = useCallback(async () => {
    // Same shared rule the CamID Settings tab now runs. Its own version tested
    // `if (confirmPassword && ...)`, so an empty confirmation skipped the check
    // entirely; this one treats empty as a mismatch, which it is.
    const check = validatePasswordChange({ currentPassword, newPassword, confirmPassword });
    if (!check.isValid) {
      toast.error(firstValidationMessage(check, t));
      return;
    }

    setChangingPassword(true);
    try {
      const res = await changeUserPassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      if (res.success) {
        toast.success("Password changed successfully!");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setShowEditModal(false);
      } else {
        toast.error(res.message || "Failed to change password");
      }
    } catch {
      toast.error("An error occurred while changing password");
    } finally {
      setChangingPassword(false);
    }
  }, [currentPassword, newPassword, confirmPassword, t]);

  // Copy User ID to Clipboard
  const handleCopyId = (id: string) => {
    if (!id) return;
    navigator.clipboard.writeText(id);
    toast.success("User ID copied to clipboard!");
  };

  return (
    <div className="w-full max-w-full overflow-x-hidden overflow-y-auto space-y-4 sm:space-y-5 pb-8 min-w-0">
      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── 1. MAIN UNIFIED PROFILE HEADER CARD ── */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <div className="rounded-3xl border border-subtle bg-surface-card shadow-soft-sm overflow-hidden min-w-0">
        {/* Sleek Panoramic Cover Banner with 1-Click Fullscreen Lightbox View */}
        <div
          onClick={() => {
            if (profile.coverUrl) {
              setIsCoverLightboxOpen(true);
            }
          }}
          title={profile.coverUrl ? "Click to view full cover photo" : undefined}
          className={`relative h-32 sm:h-36 md:h-40 lg:h-44 xl:h-48 w-full overflow-hidden bg-surface-sunken group ${
            profile.coverUrl ? "cursor-zoom-in" : ""
          }`}
        >
          {profile.coverUrl ? (
            <img
              src={profile.coverUrl}
              alt="Profile Cover"
              className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-accent/80 via-accent to-accent-hover" />
          )}

          {/* Subtle Gradient Scrim & Hover Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
          {profile.coverUrl && (
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md text-white text-xs font-bold border border-white/20 shadow-lg">
                <Maximize2 className="w-3.5 h-3.5 text-accent" />
                <span>View Full Cover</span>
              </span>
            </div>
          )}

          {/* Top Left: Enterprise Badge */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute top-3 left-3 sm:top-3.5 sm:left-3.5 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-sm border border-white/20 text-white text-[10.5px] font-semibold tracking-wide"
          >
            <Shield className="w-3 h-3 text-accent" />
            <span>CAM SECURE IDENTITY • ENTERPRISE</span>
          </div>

          {/* Top Right: Edit Cover Button */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute top-3 right-3 sm:top-3.5 sm:right-3.5"
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                setPreviewCoverUrl(profile.coverUrl);
                setShowUnsplashModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/30 text-white text-[11px] font-bold shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Camera className="w-3 h-3 text-white" />
              <span>Edit Cover</span>
            </button>
          </div>
        </div>

        {/* Identity & Actions Bar */}
        <div className="px-4 sm:px-5 lg:px-6 pb-2.5 pt-0 min-w-0">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 -mt-9 sm:-mt-11 md:-mt-12">
            {/* Left: Avatar + Names */}
            <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-3.5 min-w-0">
              {/* Circular Avatar with crisp solid framing for Transparent Logos */}
              <div className="relative shrink-0">
                <div className="relative w-20 h-20 sm:w-24 sm:h-24 md:w-26 md:h-26 rounded-full ring-3 sm:ring-4 ring-white dark:ring-slate-900 shadow-lg overflow-hidden bg-white dark:bg-slate-900 flex items-center justify-center p-1 group">
                  {profile.picture ? (
                    <div className="w-full h-full rounded-full bg-white dark:bg-slate-900 flex items-center justify-center overflow-hidden">
                      <BrandLogo
                        src={profile.picture}
                        alt={profile.name}
                        onError={() => setProfile((p) => ({ ...p, picture: null }))}
                        className="w-full h-full object-contain rounded-full"
                      />
                    </div>
                  ) : (
                    <div className="w-full h-full rounded-full bg-gradient-to-br from-accent to-accent-hover text-white flex items-center justify-center font-extrabold text-2xl tracking-tight select-none">
                      {getInitials(profile.name)}
                    </div>
                  )}

                  {/* Change Photo Overlay Button on hover */}
                  <button
                    onClick={() => photoInputRef.current?.click()}
                    disabled={isUploadingPhoto}
                    className="absolute inset-0 bg-black/55 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[11px] font-semibold gap-1 cursor-pointer rounded-full"
                  >
                    {isUploadingPhoto ? (
                      <Loader2 className="w-4 h-4 animate-spin text-accent" />
                    ) : (
                      <>
                        <Camera className="w-4 h-4 text-white" />
                        <span>Change</span>
                      </>
                    )}
                  </button>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarFileSelected}
                    className="hidden"
                  />
                </div>

                {/* Active Online Indicator cleanly positioned outside the overflow-hidden circle */}
                <div className="absolute bottom-0.5 right-0.5 sm:bottom-1 sm:right-1 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900 shadow-md flex items-center justify-center z-10" />
              </div>

              {/* User Details */}
              <div className="space-y-0.5 mb-0.5 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h2 className="text-lg sm:text-xl font-extrabold text-ink tracking-tight truncate">
                    {profile.name}
                  </h2>
                  <BadgeCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-bold text-accent px-2 py-0.5 rounded-full bg-accent-soft shrink-0 text-[11px]">
                    {profile.role}
                  </span>
                  <span className="text-ink-muted flex items-center gap-1 shrink-0 text-[11px]">
                    <MapPin className="w-3 h-3 text-ink-muted" />
                    {profile.location}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Quick Action Buttons & Trust Rating */}
            <div className="flex flex-col sm:items-end gap-1.5 shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-ink">9.9</span>
                <span className="text-amber-400 text-xs tracking-tighter">★★★★★</span>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  Verified Security Level
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => openEditModal("profile")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent text-white text-xs font-bold shadow-soft hover:bg-accent-hover transition-all active:scale-95 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Profile</span>
                </button>

                <button
                  onClick={() => openEditModal("password")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-ink text-xs font-bold border border-subtle hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95 cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5 text-accent" />
                  <span>Password</span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab("security");
                    router.replace("/profile?tab=security", { scroll: false });
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl av-glass-row border border-subtle text-ink text-xs font-bold transition-all active:scale-95 cursor-pointer"
                >
                  <Smartphone className="w-3.5 h-3.5 text-accent" />
                  <span>CAM ID Paired</span>
                </button>

                <button
                  onClick={() => {
                    setPreviewCoverUrl(profile.coverUrl);
                    setShowUnsplashModal(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-bold border border-purple-500/20 hover:bg-purple-500/15 transition-all active:scale-95 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Unsplash Studio</span>
                </button>
              </div>
            </div>
          </div>

          {/* Subtle Horizontal Divider like Facebook */}
          <div className="border-t border-subtle mt-2 pt-0.5" />

          {/* Integrated Facebook-Style Navigation Tab Bar */}
          <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar pt-0.5 min-w-0">
            {[
              { id: "about", label: "About & Overview", icon: UserIcon },
              { id: "settings", label: "System Settings", icon: Settings },
              { id: "security", label: "Device & Sessions", icon: Smartphone },
              { id: "wallpapers", label: "Unsplash Wallpapers", icon: Palette },
            ].map((tab) => {
              const isActive = activeTab === tab.id || (tab.id === "security" && activeTab === "devices");
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as ProfileTab);
                    router.replace(`/profile?tab=${tab.id}`, { scroll: false });
                  }}
                  className={`relative flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                    isActive
                      ? "text-accent bg-accent-soft shadow-xs font-extrabold"
                      : "text-ink-secondary hover:text-ink hover:bg-surface-cushion"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-accent" : "text-ink-muted"}`} />
                  <span>{tab.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="activeProfileTabIndicator"
                      className="absolute bottom-0 left-2 right-2 h-0.5 bg-accent rounded-full"
                      transition={{ type: "spring", stiffness: 500, damping: 35 }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── 2. DYNAMIC CONTENT SECTION ── */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <AnimatePresence mode="wait">
        {/* ════ TAB: SYSTEM SETTINGS (APPEARANCE & BRANDING) ════ */}
        {activeTab === "settings" && (
          <motion.div
            key="tab-settings"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="rounded-3xl border border-subtle bg-surface-card p-5 sm:p-7 shadow-soft-sm min-w-0"
          >
            <SettingsSection initialSubTab="appearance" />
          </motion.div>
        )}

        {/* ════ TAB: ABOUT & OVERVIEW ════ */}
        {activeTab === "about" && (
          <motion.div
            key="tab-about"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start min-w-0"
          >
            {/* Left Column: Organization & Security Matrix */}
            <div className="lg:col-span-4 space-y-4 sm:space-y-5 min-w-0">
              {/* Organization Card */}
              <div className="rounded-3xl border border-subtle bg-surface-card p-4 sm:p-5 shadow-soft-sm space-y-3.5">
                <span className="text-[10px] font-extrabold tracking-wider uppercase text-ink-muted flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-accent" />
                  WORK & ORGANIZATION
                </span>

                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-2xl bg-surface-cushion border border-subtle">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-accent-soft text-accent flex items-center justify-center font-extrabold text-xs shrink-0">
                        CAM
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-ink truncate">
                          CAM Enterprise Systems
                        </p>
                        <p className="text-[10px] text-ink-muted truncate">
                          {profile.department || "Headquarters & Core System"}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                      Primary
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-2xl bg-surface-cushion border border-subtle">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-extrabold text-xs shrink-0">
                        TS
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-ink truncate">
                          Technical Service Matrix
                        </p>
                        <p className="text-[10px] text-ink-muted truncate">
                          Operations & Maintenance
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent-soft text-accent shrink-0">
                      Division
                    </span>
                  </div>
                </div>

                {/* Security Matrix & Skills */}
                <div className="border-t border-subtle pt-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold tracking-wider uppercase text-ink-muted">
                      SECURITY & CREDENTIALS
                    </span>
                    <button
                      onClick={() => openEditModal("password")}
                      className="text-[10px] text-accent hover:underline font-bold flex items-center gap-1"
                    >
                      <KeyRound className="w-3 h-3" /> Change Password
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-[11px] font-semibold mb-1">
                        <span className="text-ink">Biometric 2FA (CAM ID)</span>
                        <span className="text-accent font-bold">100%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-surface-sunken overflow-hidden">
                        <div className="h-full bg-accent rounded-full w-full" />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] font-semibold mb-1">
                        <span className="text-ink">Passkey FIDO2 WebAuthn</span>
                        <span className="text-purple-600 dark:text-purple-400 font-bold">Active ✓</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-surface-sunken overflow-hidden">
                        <div className="h-full bg-purple-500 rounded-full w-[95%]" />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] font-semibold mb-1">
                        <span className="text-ink">Service Matrix Clearance</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">Verified ✓</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-surface-sunken overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full w-[98%]" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: User Account Information & Performance */}
            <div className="lg:col-span-8 space-y-4 sm:space-y-5 min-w-0">
              <div className="rounded-3xl border border-subtle bg-surface-card p-4 sm:p-6 shadow-soft-sm space-y-4 sm:space-y-5 min-w-0">
                {/* Account Details Header */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-ink-muted flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-accent" />
                    ACCOUNT INFORMATION & DETAILS
                  </h4>
                  <button
                    onClick={() => openEditModal("profile")}
                    className="text-xs text-accent font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Edit Information
                  </button>
                </div>

                {/* 6 Information Grid Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 min-w-0">
                  {/* Full Name */}
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-surface-cushion border border-subtle min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-accent-soft text-accent flex items-center justify-center shrink-0 font-bold text-xs">
                      FN
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-extrabold uppercase text-ink-muted">FULL NAME</p>
                      <p className="text-xs font-bold text-ink truncate">{profile.name}</p>
                    </div>
                  </div>

                  {/* Username / Handle */}
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-surface-cushion border border-subtle min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 font-bold text-xs">
                      @
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-extrabold uppercase text-ink-muted">USERNAME / HANDLE</p>
                      <p className="text-xs font-bold text-ink truncate">
                        @{profile.userName || profile.name.toLowerCase().replace(/\s+/g, ".")}
                      </p>
                    </div>
                  </div>

                  {/* Phone Number */}
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-surface-cushion border border-subtle min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
                      <Phone className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-extrabold uppercase text-ink-muted">PHONE NUMBER</p>
                      <p className="text-xs font-bold text-ink truncate">{profile.phoneNumber || "Not set"}</p>
                    </div>
                  </div>

                  {/* Email Address */}
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-surface-cushion border border-subtle min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-extrabold uppercase text-ink-muted">EMAIL ADDRESS</p>
                      <p className="text-xs font-bold text-ink truncate">{profile.email}</p>
                    </div>
                  </div>

                  {/* Location & City */}
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-surface-cushion border border-subtle min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-extrabold uppercase text-ink-muted">LOCATION</p>
                      <p className="text-xs font-bold text-ink truncate">{profile.location || "Phnom Penh, Cambodia"}</p>
                    </div>
                  </div>

                  {/* User GUID with Click-to-Copy */}
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-surface-cushion border border-subtle min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <Shield className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-extrabold uppercase text-ink-muted">USER IDENTIFIER (GUID)</p>
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-mono font-bold text-ink truncate">
                          {profile.id ? `${profile.id.slice(0, 14)}...` : "Authenticated User"}
                        </p>
                        {profile.id && (
                          <button
                            onClick={() => handleCopyId(profile.id)}
                            title="Copy GUID"
                            className="text-ink-muted hover:text-accent cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Performance Metrics */}
                <div className="border-t border-subtle pt-3.5 min-w-0">
                  <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-ink-muted mb-2.5">
                    PERFORMANCE METRICS & STATS
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 min-w-0">
                    <div className="p-2.5 sm:p-3 rounded-2xl bg-surface-cushion border border-subtle text-center min-w-0">
                      <p className="text-lg sm:text-xl font-extrabold text-accent truncate">142</p>
                      <p className="text-[10px] font-bold text-ink-muted mt-0.5 truncate">Tickets Handled</p>
                    </div>
                    <div className="p-2.5 sm:p-3 rounded-2xl bg-surface-cushion border border-subtle text-center min-w-0">
                      <p className="text-lg sm:text-xl font-extrabold text-emerald-600 dark:text-emerald-400 truncate">99.8%</p>
                      <p className="text-[10px] font-bold text-ink-muted mt-0.5 truncate">SLA Accuracy</p>
                    </div>
                    <div className="p-2.5 sm:p-3 rounded-2xl bg-surface-cushion border border-subtle text-center min-w-0">
                      <p className="text-lg sm:text-xl font-extrabold text-purple-600 dark:text-purple-400 truncate">24/7</p>
                      <p className="text-[10px] font-bold text-ink-muted mt-0.5 truncate">Biometric Sync</p>
                    </div>
                    <div className="p-2.5 sm:p-3 rounded-2xl bg-surface-cushion border border-subtle text-center min-w-0">
                      <p className="text-lg sm:text-xl font-extrabold text-amber-600 dark:text-amber-400 truncate">0</p>
                      <p className="text-[10px] font-bold text-ink-muted mt-0.5 truncate">Security Incidents</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ════ TAB: DEVICE & SESSIONS (SECURITY & PASSKEYS) ════ */}
        {(activeTab === "security" || activeTab === "devices") && (
          <motion.div
            key="tab-security-sessions"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="rounded-3xl border border-subtle bg-surface-card p-5 sm:p-7 shadow-soft-sm min-w-0"
          >
            <SettingsSection initialSubTab="sessions" />
          </motion.div>
        )}

        {/* ════ TAB: UNSPLASH WALLPAPERS STUDIO ════ */}
        {activeTab === "wallpapers" && (
          <motion.div
            key="tab-wallpapers"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="rounded-3xl border border-subtle bg-surface-card p-5 sm:p-7 shadow-soft-sm space-y-4 min-w-0"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
              <div>
                <h4 className="text-base font-bold text-ink flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-accent shrink-0" />
                  Unsplash Wallpaper Studio
                </h4>
                <p className="text-xs text-ink-muted">
                  Live search millions of HD wallpapers & apply 1-Tap to profile cover
                </p>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-72 shrink-0">
                <Search className="w-4 h-4 text-accent absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search Unsplash..."
                  className="w-full pl-9 pr-7 py-2 rounded-xl bg-surface-cushion border border-subtle text-xs text-ink focus:outline-none focus:ring-2 focus:ring-accent"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Custom URL Input */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Or paste any custom 4K image URL..."
                value={customCoverInput}
                onChange={(e) => setCustomCoverInput(e.target.value)}
                className="flex-1 px-3.5 py-2 rounded-xl bg-surface-cushion border border-subtle text-xs text-ink focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <button
                onClick={() => {
                  if (customCoverInput.trim()) {
                    handleApplyCover(customCoverInput.trim());
                    setCustomCoverInput("");
                  }
                }}
                className="px-4 py-2 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent-hover transition-colors shrink-0 cursor-pointer"
              >
                Apply URL
              </button>
            </div>

            {/* Category Filter Pills */}
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {CATEGORY_TABS.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    setSearchQuery("");
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                    selectedCategory === cat.id && !searchQuery
                      ? "bg-accent text-white shadow-soft"
                      : "bg-surface-cushion border border-subtle text-ink-muted hover:text-ink"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Wallpapers Grid */}
            {loadingWallpapers ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-accent" />
                <span className="text-xs text-ink-muted font-medium">Fetching HD Wallpapers...</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[500px] overflow-y-auto no-scrollbar pr-1">
                {wallpapers.map((photo) => (
                  <div
                    key={photo.id}
                    className="group relative h-36 rounded-2xl overflow-hidden border border-subtle shadow-soft-sm bg-surface-sunken cursor-pointer"
                    onClick={() => handleApplyCover(photo.url)}
                  >
                    <img
                      src={photo.thumbUrl}
                      alt={photo.name || "Wallpaper"}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="px-3 py-1 rounded-xl bg-accent text-white text-xs font-bold shadow-md">
                        Apply Cover
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── MODAL 1: EDIT PROFILE & RESET PASSWORD MODAL ── */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <ModalWrapper
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        maxWidth="max-w-lg"
      >
        <div className="p-5 sm:p-6 space-y-4 bg-surface-elevated">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-accent-soft text-accent flex items-center justify-center">
                {editModalTab === "profile" ? <Edit3 className="w-5 h-5" /> : <KeyRound className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-base font-bold text-ink">
                  {editModalTab === "profile" ? "Edit Profile Information" : "Change Password"}
                </h3>
                <p className="text-xs text-ink-muted">
                  {editModalTab === "profile"
                    ? "Update your personal details and system credentials"
                    : "Update your account password securely"}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowEditModal(false)}
              className="w-8 h-8 rounded-full bg-surface-cushion hover:bg-surface-sunken flex items-center justify-center text-ink-muted hover:text-ink transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Modal Tab Switcher */}
          <div className="flex p-1 bg-sunken rounded-xl border border-subtle">
            <button
              onClick={() => setEditModalTab("profile")}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                editModalTab === "profile"
                  ? "bg-surface text-ink shadow-xs"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              General Information
            </button>
            <button
              onClick={() => setEditModalTab("password")}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                editModalTab === "password"
                  ? "bg-surface text-ink shadow-xs"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              Security &amp; Password
            </button>
          </div>

          {/* Tab 1: Profile Information */}
          {editModalTab === "profile" ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-ink-muted">
                    FIRST NAME
                  </label>
                  <input
                    type="text"
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-surface-cushion border border-subtle text-xs font-semibold text-ink focus:ring-2 focus:ring-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-ink-muted">
                    LAST NAME
                  </label>
                  <input
                    type="text"
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-surface-cushion border border-subtle text-xs font-semibold text-ink focus:ring-2 focus:ring-accent focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-ink-muted">
                  USERNAME / HANDLE
                </label>
                <input
                  type="text"
                  value={editUserName}
                  onChange={(e) => setEditUserName(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-surface-cushion border border-subtle text-xs font-semibold text-ink focus:ring-2 focus:ring-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-ink-muted">
                  EMAIL ADDRESS
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-surface-cushion border border-subtle text-xs font-semibold text-ink focus:ring-2 focus:ring-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-ink-muted">
                  PHONE NUMBER
                </label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-surface-cushion border border-subtle text-xs font-semibold text-ink focus:ring-2 focus:ring-accent focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-ink-muted">
                    LOCATION &amp; CITY
                  </label>
                  <input
                    type="text"
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-surface-cushion border border-subtle text-xs font-semibold text-ink focus:ring-2 focus:ring-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-ink-muted">
                    DEPARTMENT
                  </label>
                  <input
                    type="text"
                    value={editDepartment}
                    onChange={(e) => setEditDepartment(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-surface-cushion border border-subtle text-xs font-semibold text-ink focus:ring-2 focus:ring-accent focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-2 rounded-xl bg-surface-cushion hover:bg-surface-sunken text-ink text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                  className="flex-1 px-4 py-2 rounded-xl bg-accent text-white text-xs font-bold shadow-soft hover:bg-accent-hover transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
                </button>
              </div>
            </div>
          ) : (
            /* Tab 2: Change Password */
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-ink-muted">
                  CURRENT PASSWORD
                </label>
                <div className="relative mt-1">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full pl-3 pr-9 py-2 rounded-xl bg-surface-cushion border border-subtle text-xs font-semibold text-ink focus:ring-2 focus:ring-accent focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-ink-muted">
                  NEW PASSWORD
                </label>
                <div className="relative mt-1">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Min 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-3 pr-9 py-2 rounded-xl bg-surface-cushion border border-subtle text-xs font-semibold text-ink focus:ring-2 focus:ring-accent focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-ink-muted">
                  CONFIRM NEW PASSWORD
                </label>
                <div className="relative mt-1">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-3 pr-9 py-2 rounded-xl bg-surface-cushion border border-subtle text-xs font-semibold text-ink focus:ring-2 focus:ring-accent focus:outline-none"
                  />
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-300">
                ⚠️ Changing your password will invalidate existing sessions on other devices.
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-2 rounded-xl bg-surface-cushion hover:bg-surface-sunken text-ink text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleChangePassword}
                  disabled={changingPassword}
                  className="flex-1 px-4 py-2 rounded-xl bg-accent text-white text-xs font-bold shadow-soft hover:bg-accent-hover transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {changingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update Password"}
                </button>
              </div>
            </div>
          )}
        </div>
      </ModalWrapper>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── MODAL 2: UNSPLASH FULL VIEWPORT PORTAL MODAL ── */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <ModalWrapper
        open={showUnsplashModal}
        onClose={() => setShowUnsplashModal(false)}
        maxWidth="max-w-4xl lg:max-w-5xl"
      >
        <div className="p-5 sm:p-7 space-y-4 bg-surface-elevated max-h-[85vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-ink">
                  Unsplash Wallpaper &amp; Cover Studio
                </h3>
                <p className="text-xs text-ink-muted">
                  Live search millions of 4K HD photos and apply 1-Tap as your Profile Cover
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowUnsplashModal(false)}
              className="w-8 h-8 rounded-full bg-surface-cushion hover:bg-surface-sunken flex items-center justify-center text-ink-muted hover:text-ink transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Custom Link */}
          <div className="flex gap-2 shrink-0">
            <input
              type="text"
              placeholder="Paste direct HD image URL..."
              value={customCoverInput}
              onChange={(e) => setCustomCoverInput(e.target.value)}
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-surface-cushion border border-subtle text-xs text-ink focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <button
              onClick={() => {
                if (customCoverInput.trim()) {
                  handleApplyCover(customCoverInput.trim());
                  setCustomCoverInput("");
                }
              }}
              className="px-4 py-2.5 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent-hover transition-colors shrink-0 cursor-pointer"
            >
              Apply Cover
            </button>
          </div>

          {/* Category Tabs */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 shrink-0">
            {CATEGORY_TABS.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setSearchQuery("");
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                  selectedCategory === cat.id && !searchQuery
                    ? "bg-accent text-white shadow-soft"
                    : "bg-surface-cushion border border-subtle text-ink-muted hover:text-ink"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="relative shrink-0">
            <Search className="w-4 h-4 text-accent absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search million photos (e.g. Cyberpunk, 4K Nebula, Lamborghini, Minimalist)..."
              className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-surface-cushion border border-subtle text-xs text-ink focus:outline-none focus:ring-2 focus:ring-accent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Wallpapers Live Grid */}
          <div className="flex-1 overflow-y-auto min-h-[300px] pr-1">
            {loadingWallpapers ? (
              <div className="h-64 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-7 h-7 animate-spin text-accent" />
                <span className="text-xs text-ink-muted font-medium">Fetching 4K Wallpapers...</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {wallpapers.map((photo) => (
                  <div
                    key={photo.id}
                    onClick={() => handleApplyCover(photo.url)}
                    className="group relative h-40 rounded-2xl overflow-hidden border border-subtle shadow-soft-sm bg-surface-sunken cursor-pointer"
                  >
                    <img
                      src={photo.thumbUrl}
                      alt={photo.name || "Wallpaper"}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                      <span className="text-[10px] text-white/80 font-medium truncate">
                        Photo by {photo.authorName || "Unsplash"}
                      </span>
                      <span className="mt-1 px-3 py-1 rounded-lg bg-accent text-white text-[11px] font-bold text-center shadow-md">
                        Apply as Cover
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </ModalWrapper>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── 3. DIRECT FULLSCREEN COVER LIGHTBOX VIEWER ── */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {profile.coverUrl && (
        <MediaLightbox
          open={isCoverLightboxOpen}
          onClose={() => setIsCoverLightboxOpen(false)}
          title={profile.name ? `${profile.name} • Cover Wallpaper` : "Profile Cover"}
          caption="4K Ultra-HD Panoramic Wallpaper"
          subtitle={profile.location || "CAM Enterprise Systems"}
          kind="image"
          fullscreenOnly={true}
          imageUrl={profile.coverUrl}
        />
      )}
    </div>
  );
}

export default function ProfilePage() {
  return (
    <PageWrapper titleKey="nav.myProfile">
      <Suspense
        fallback={
          <div className="p-8 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-accent" />
          </div>
        }
      >
        <ProfileContent />
      </Suspense>
    </PageWrapper>
  );
}
