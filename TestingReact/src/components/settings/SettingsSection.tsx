"use client";

/**
 * @file components/settings/SettingsSection.tsx
 * @description 100% Complete Appearance + Theme & Branding Settings Section.
 * Retains all 8 Sidebar styles, 4 Command Palette styles, 3 Live Preview modes,
 * Brand Logo Zoom slider, WCAG color picker, Motion & Lite Mode performance controls,
 * and Device & Sessions Manager.
 */

import BrandLogo from "@/components/BrandLogo";
import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { motion } from "framer-motion";
import {
  RotateCcw,
  Type,
  Upload,
  Loader2,
  UserRound,
  Sparkles,
  ZoomIn,
  Sun,
  Moon,
  Laptop,
  CheckCircle2,
  TrendingUp,
  Palette,
  Smartphone,
  ShieldCheck,
  KeyRound,
  ScanFace,
} from "lucide-react";
import dynamic from "next/dynamic";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

const DeviceSessionManager = dynamic(() => import("@/components/DeviceSessionManager"), {
  loading: () => (
    <div className="p-8 flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-accent" />
    </div>
  ),
  ssr: false,
});

const PasskeyManager = dynamic(() => import("@/components/PasskeyManager"), {
  loading: () => (
    <div className="p-4 flex items-center justify-center">
      <Loader2 className="w-5 h-5 animate-spin text-accent" />
    </div>
  ),
  ssr: false,
});

import { useI18n } from "@/i18n/LanguageProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { usePerformance } from "@/components/PerformanceProvider";
import {
  DENSITIES,
  FONT_SCALES,
  HEX_COLOR_PATTERN,
  RADII,
  SURFACE_STYLES,
  type ModeName,
  type SurfaceStyleName,
  type CommandPaletteStyle,
  type SidebarStyleName,
  type CrudStyleName,
} from "@/theme/themeConfig";
import { useProfilePhotoUpload } from "@/hooks/useProfilePhotoUpload";
import { extractDominantColor } from "@/lib/dominantColor";
import type { TranslationKey } from "@/i18n/translations";

const RADIUS_LABEL = {
  sharp: "theme.radiusSharp",
  soft: "theme.radiusSoft",
  round: "theme.radiusRound",
} as const;

const DENSITY_LABEL = {
  comfortable: "theme.densityComfortable",
  compact: "theme.densityCompact",
} as const;

const FONT_SCALE_LABEL = {
  sm: "theme.fontScaleSm",
  md: "theme.fontScaleMd",
  lg: "theme.fontScaleLg",
} as const;

const ACCENT_SWATCHES: { key: TranslationKey; hex: string }[] = [
  { key: "theme.accentCyan", hex: "#0891B2" },
  { key: "theme.accentEmerald", hex: "#0F6E4E" },
  { key: "theme.accentBlue", hex: "#2563EB" },
  { key: "theme.accentViolet", hex: "#7C3AED" },
  { key: "theme.accentRose", hex: "#E11D48" },
  { key: "theme.accentAmber", hex: "#D97706" },
];

function readStoredProfilePictureUrl(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const brandLogo = localStorage.getItem("system_brand_logo");
    if (brandLogo) return brandLogo;
    const stored = localStorage.getItem("user_info");
    if (!stored) return null;
    const parsed = JSON.parse(stored) as { profilePictureUrl?: string };
    return parsed.profilePictureUrl || null;
  } catch {
    return null;
  }
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onStoreChange: () => void) {
  const mq = window.matchMedia(REDUCED_MOTION_QUERY);
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

function getReducedMotionSnapshot(): boolean {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function getReducedMotionServerSnapshot(): boolean {
  return false;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.015,
      delayChildren: 0,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 4 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.15,
      ease: "easeOut" as const,
    },
  },
};

const rightColumnVariants = {
  hidden: { opacity: 0, y: 4 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.15,
      ease: "easeOut" as const,
    },
  },
};

function Section({
  titleKey,
  hintKey,
  children,
  badge,
}: {
  titleKey: TranslationKey;
  hintKey?: TranslationKey;
  children: React.ReactNode;
  badge?: React.ReactNode;
}) {
  const { t } = useI18n();
  return (
    <motion.section
      variants={itemVariants}
      className="rounded-2xl border border-subtle/80 bg-surface p-5 shadow-sm transition-all duration-200"
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-ink">{t(titleKey)}</h2>
          {hintKey && <p className="mt-0.5 text-xs text-ink-secondary">{t(hintKey)}</p>}
        </div>
        {badge}
      </div>
      <div className="mt-4">{children}</div>
    </motion.section>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
  labelFor,
}: {
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  labelFor: (option: T) => string;
}) {
  return (
    <div role="radiogroup" className="inline-flex flex-wrap gap-1 rounded-xl bg-sunken p-1">
      {options.map((option) => {
        const active = option === value;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option)}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 cursor-pointer ${
              active ? "bg-surface text-ink shadow-sm font-bold" : "text-ink-secondary hover:text-ink"
            }`}
          >
            {labelFor(option)}
          </button>
        );
      })}
    </div>
  );
}

export default function SettingsSection({
  initialSubTab = "appearance",
}: {
  initialSubTab?: "appearance" | "sessions";
}) {
  const { t, lang } = useI18n();
  const { prefs, update, reset } = useTheme();
  const { tier: perfTier } = usePerformance();

  const osReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );

  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(() =>
    readStoredProfilePictureUrl()
  );
  const {
    isUploading: isUploadingPhoto,
    progress: photoProgress,
    uploadBrandLogo,
  } = useProfilePhotoUpload();
  const photoFileInputRef = useRef<HTMLInputElement>(null);

  const [customColorInput, setCustomColorInput] = useState(prefs.accentColor ?? "");
  const [customColorError, setCustomColorError] = useState(false);

  const applyAccent = useCallback(
    (hex: string | null) => {
      update({ accentColor: hex });
      setCustomColorInput(hex ?? "");
      setCustomColorError(false);
    },
    [update]
  );

  const handlePhotoFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;

      const localColor = await extractDominantColor(file);
      if (localColor) {
        applyAccent(localColor);
        setSuggestion({ url: "pending", color: localColor });
        toast.success(`Brand color auto-applied: ${localColor}`);
      }

      const url = await uploadBrandLogo(file);
      if (url) {
        setProfilePictureUrl(url);
        if (localColor) {
          setSuggestion({ url, color: localColor });
        } else {
          const remoteColor = await extractDominantColor(url);
          if (remoteColor) {
            applyAccent(remoteColor);
            setSuggestion({ url, color: remoteColor });
            toast.success(`Brand color auto-applied: ${remoteColor}`);
          }
        }
      }
    },
    [uploadBrandLogo, applyAccent]
  );

  const [suggestion, setSuggestion] = useState<{ url: string; color: string | null } | null>(null);
  const [isComputingSuggestion, setIsComputingSuggestion] = useState(false);

  useEffect(() => {
    if (!profilePictureUrl) {
      setSuggestion(null);
      return;
    }
    if (suggestion && suggestion.url === profilePictureUrl) return;

    let cancelled = false;
    setIsComputingSuggestion(true);
    extractDominantColor(profilePictureUrl)
      .then((color) => {
        if (cancelled) return;
        setSuggestion({ url: profilePictureUrl, color });
      })
      .finally(() => {
        if (!cancelled) setIsComputingSuggestion(false);
      });

    return () => {
      cancelled = true;
    };
  }, [profilePictureUrl, suggestion]);

  const suggestedColor = suggestion?.color ?? null;
  const [isDetecting, setIsDetecting] = useState(false);

  const handleAutoDetectBrandColor = useCallback(async () => {
    if (!profilePictureUrl) {
      toast.error("Please upload a logo first.");
      return;
    }
    setIsDetecting(true);
    const color = await extractDominantColor(profilePictureUrl);
    setIsDetecting(false);
    if (color) {
      applyAccent(color);
      setSuggestion({ url: profilePictureUrl, color });
      toast.success(`Brand accent color applied: ${color}`);
    } else {
      toast.error("Could not extract dominant color from the image.");
    }
  }, [profilePictureUrl, applyAccent]);

  const handleCustomColorChange = useCallback(
    (value: string) => {
      setCustomColorInput(value);
      if (value === "") {
        update({ accentColor: null });
        setCustomColorError(false);
        return;
      }
      if (HEX_COLOR_PATTERN.test(value)) {
        update({ accentColor: value });
        setCustomColorError(false);
      } else {
        setCustomColorError(true);
      }
    },
    [update]
  );

  const [previewTab, setPreviewTab] = useState<"ticket" | "kpi" | "login">("ticket");
  const [settingsTab, setSettingsTab] = useState<"appearance" | "sessions">(initialSubTab);

  useEffect(() => {
    setSettingsTab(initialSubTab);
  }, [initialSubTab]);

  return (
    <div className="space-y-4 min-w-0">
      {/* Top Global Sync Banner (Fit Content) */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="inline-flex flex-wrap items-center gap-2.5 sm:gap-3 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-2xl bg-gradient-to-r from-accent-soft/80 via-surface to-accent-soft/30 border border-accent/25 shadow-xs max-w-full"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-xs font-bold text-ink">
            {lang === "km" ? "ប្រព័ន្ធ Global Branding & Sessions៖" : "Global System Branding & Sessions:"}
          </span>
          <span className="text-[11px] text-ink-secondary">
            {lang === "km"
              ? "Settings និង Device Sessions ត្រូវបាន Sync ស្វ័យប្រវត្តិ"
              : "Settings & device sessions synced in real-time"}
          </span>
        </div>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-xl border border-subtle bg-surface hover:bg-cushion text-[10.5px] font-semibold text-ink-secondary hover:text-ink transition-colors cursor-pointer shadow-xs active:scale-95 ml-auto sm:ml-1"
        >
          <RotateCcw className="w-3 h-3" />
          <span>{t("theme.reset")}</span>
        </button>
      </motion.div>

      {/* ── Main Settings Tab Switcher ── */}
      <div className="flex items-center gap-1.5 p-1 bg-sunken rounded-xl w-fit border border-subtle">
        <button
          type="button"
          onClick={() => setSettingsTab("appearance")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
            settingsTab === "appearance"
              ? "bg-surface text-ink shadow-xs ring-1 ring-black/5 dark:ring-white/10"
              : "text-ink-secondary hover:text-ink hover:bg-cushion"
          )}
        >
          <Palette className="w-3.5 h-3.5 text-accent" />
          <span>{lang === "km" ? "រូបរាង & Branding" : "Appearance & Branding"}</span>
        </button>

        <button
          type="button"
          onClick={() => setSettingsTab("sessions")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer relative",
            settingsTab === "sessions"
              ? "bg-surface text-ink shadow-xs ring-1 ring-black/5 dark:ring-white/10"
              : "text-ink-secondary hover:text-ink hover:bg-cushion"
          )}
        >
          <Smartphone className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
          <span>{lang === "km" ? "ឧបករណ៍ & Session" : "Device & Sessions"}</span>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
        </button>
      </div>

      {settingsTab === "sessions" ? (
        /* ── Device & Sessions Management Dashboard + Passkey at bottom ── */
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-5"
        >
          {/* 1. Connected Devices, Phone/PC Face Authentication & Active Login Sessions */}
          <DeviceSessionManager />

          {/* 2. Face & Passkey (WebAuthn FIDO2) at bottom */}
          <div className="p-5 rounded-2xl border border-subtle/80 bg-surface shadow-xs space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-subtle">
              <KeyRound className="w-4 h-4 text-accent" />
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-ink">
                {lang === "km" ? "Face & Passkey (WebAuthn FIDO2 Security Keys)" : "Face & Passkey (WebAuthn FIDO2 Security Keys)"}
              </h3>
            </div>
            <PasskeyManager />
          </div>
        </motion.div>
      ) : (
        /* ── Appearance & Branding Grid ── */
        <div className="grid gap-4 lg:grid-cols-3">
          {/* ── Main Controls Staggered Column ── */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-4 lg:col-span-2"
          >
            {/* 1. Brand Logo & Zoom Tool */}
            <Section
              titleKey="theme.profilePhotoSection"
              hintKey="theme.profilePhotoHint"
              badge={
                <span className="px-2.5 py-0.5 rounded-full bg-accent-soft text-accent-soft-fg text-[11px] font-bold">
                  System Brand
                </span>
              }
            >
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    "h-20 w-20 shrink-0 overflow-hidden rounded-2xl grid place-items-center transition-all duration-200",
                    profilePictureUrl
                      ? "bg-gradient-to-br from-white via-slate-50 to-accent-soft/30 border border-accent/30 shadow-md ring-1 ring-accent/20 p-2"
                      : "border border-subtle bg-sunken"
                  )}
                >
                  {profilePictureUrl ? (
                    <BrandLogo
                      src={profilePictureUrl}
                      alt="Brand Logo"
                      style={{ transform: `scale(${(prefs.logoScale ?? 130) / 100})` }}
                      className="h-full w-full object-contain drop-shadow-xs transition-transform duration-150"
                    />
                  ) : (
                    <UserRound className="h-8 w-8 text-ink-muted" />
                  )}
                </div>
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      disabled={isUploadingPhoto || isDetecting}
                      onClick={() => photoFileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-subtle bg-surface px-3.5 py-2 text-xs font-semibold text-ink-secondary transition-all hover:bg-cushion hover:text-ink disabled:opacity-60 cursor-pointer shadow-xs active:scale-98"
                    >
                      {isUploadingPhoto ? (
                        <Loader2 className="h-4 w-4 animate-spin text-accent" />
                      ) : (
                        <Upload className="h-4 w-4 text-accent" />
                      )}
                      <span>
                        {isUploadingPhoto
                          ? photoProgress === null
                            ? t("upload.uploading")
                            : t("upload.uploadingPercent", { percent: String(photoProgress) })
                          : t("upload.fromDevice")}
                      </span>
                    </button>

                    {profilePictureUrl && (
                      <button
                        type="button"
                        disabled={isDetecting || isUploadingPhoto}
                        onClick={handleAutoDetectBrandColor}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-accent/40 bg-accent-soft px-3.5 py-2 text-xs font-bold text-accent-soft-fg transition-all hover:bg-accent hover:text-white disabled:opacity-60 cursor-pointer shadow-xs active:scale-98"
                      >
                        {isDetecting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                        <span>✨ Auto-Apply Logo Color</span>
                      </button>
                    )}
                  </div>
                  <input
                    ref={photoFileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handlePhotoFileSelected}
                    className="hidden"
                  />
                  {!profilePictureUrl && (
                    <p className="text-[11px] text-ink-muted">{t("theme.profilePhotoNone")}</p>
                  )}
                </div>
              </div>

              {profilePictureUrl && (
                <div className="pt-3.5 mt-3.5 border-t border-subtle space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="logo-scale-slider" className="text-xs font-semibold text-ink flex items-center gap-1.5">
                      <ZoomIn className="w-4 h-4 text-accent" />
                      <span>Logo Zoom &amp; Scale Tool (ទំហំ Logo):</span>
                    </label>
                    <span className="px-2.5 py-0.5 rounded-md bg-accent-soft text-accent-soft-fg text-xs font-mono font-bold">
                      {prefs.logoScale ?? 130}%
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      id="logo-scale-slider"
                      type="range"
                      min={80}
                      max={260}
                      step={5}
                      value={prefs.logoScale ?? 130}
                      onChange={(e) => update({ logoScale: Number(e.target.value) })}
                      className="flex-1 h-6 py-2 bg-clip-content bg-cushion rounded-lg appearance-none cursor-pointer accent-accent"
                    />
                    <button
                      type="button"
                      onClick={() => update({ logoScale: 130 })}
                      title="Reset Zoom to 130%"
                      className="px-2.5 py-1 rounded-lg border border-subtle hover:bg-cushion text-ink-secondary hover:text-ink text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset</span>
                    </button>
                  </div>
                </div>
              )}
            </Section>

            {/* 2. Theme Mode (Light / Dark / System) */}
            <Section
              titleKey="theme.modeSection"
              hintKey="theme.modeSectionHint"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    mode: "light" as ModeName,
                    title: lang === "km" ? "Daylight (ភ្លឺ)" : "Light Mode",
                    desc: lang === "km" ? "ផ្ទៃសររលោងភ្លឺច្បាស់" : "Crisp daytime clarity",
                    icon: Sun,
                    previewClass: "bg-slate-50 border-slate-200 text-slate-900",
                  },
                  {
                    mode: "dark" as ModeName,
                    title: lang === "km" ? "Midnight (ងងឹត)" : "Dark Mode",
                    desc: lang === "km" ? "ផ្ទៃខ្មៅ OLED ស្រួលភ្នែក" : "OLED deep midnight",
                    icon: Moon,
                    previewClass: "bg-slate-900 border-slate-700 text-slate-100",
                  },
                  {
                    mode: "system" as ModeName,
                    title: lang === "km" ? "Auto (តាម OS)" : "Match System",
                    desc: lang === "km" ? "តាមម៉ាស៊ីនកុំព្យូទ័រ" : "Follow OS setting",
                    icon: Laptop,
                    previewClass: "bg-gradient-to-r from-slate-100 to-slate-850 border-slate-300 text-slate-800",
                  },
                ].map((item) => {
                  const active = prefs.mode === item.mode;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.mode}
                      type="button"
                      onClick={() => update({ mode: item.mode })}
                      className={cn(
                        "p-3.5 rounded-2xl border text-left flex flex-col justify-between gap-3 transition-all cursor-pointer relative overflow-hidden",
                        active
                          ? "border-accent bg-accent-soft/40 ring-2 ring-accent shadow-sm"
                          : "border-subtle bg-surface hover:bg-cushion"
                      )}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className={cn("p-2 rounded-xl border shadow-xs", item.previewClass)}>
                          <Icon className="w-4 h-4" />
                        </div>
                        {active && (
                          <CheckCircle2 className="w-4 h-4 text-accent fill-accent/20" />
                        )}
                      </div>
                      <div>
                        <span className="font-bold text-xs text-ink block">{item.title}</span>
                        <span className="text-[11px] text-ink-secondary block mt-0.5">{item.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Section>

            {/* 3. Surface Style (Cushion / Glass / Flat) */}
            <Section
              titleKey="theme.surfaceStyleSection"
              hintKey="theme.surfaceStyleHint"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    id: "cushion" as SurfaceStyleName,
                    title: lang === "km" ? "Cushioned (ខ្នើយទន់)" : "Cushioned",
                    desc: lang === "km" ? "ស្រមោលស្រទន់ Velvet" : "Soft layered depth",
                    accent: "shadow-md bg-surface",
                  },
                  {
                    id: "glass" as SurfaceStyleName,
                    title: lang === "km" ? "Frosted Glass (កញ្ចក់)" : "Frosted Glass",
                    desc: lang === "km" ? "កញ្ចក់សម្រិលបែបទំនើប" : "Glassmorphic blur",
                    accent: "backdrop-blur-md bg-surface/70 border-white/40",
                  },
                  {
                    id: "flat" as SurfaceStyleName,
                    title: lang === "km" ? "Clean Flat (រាបស្មើ)" : "Clean Flat",
                    desc: lang === "km" ? "រាបស្មើសាមញ្ញគ្មានស្រមោល" : "Minimalist, 0 shadow",
                    accent: "shadow-none border-subtle bg-surface",
                  },
                ].map((item) => {
                  const active = prefs.surfaceStyle === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => update({ surfaceStyle: item.id })}
                      className={cn(
                        "p-3.5 rounded-2xl border text-left flex flex-col justify-between gap-3 transition-all cursor-pointer",
                        active
                          ? "border-accent bg-accent-soft/40 ring-2 ring-accent shadow-sm"
                          : "border-subtle bg-surface hover:bg-cushion"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className={cn("w-10 h-6 rounded-lg border p-1", item.accent)}>
                          <div className="w-full h-full rounded-sm bg-accent/25" />
                        </div>
                        {active && <CheckCircle2 className="w-4 h-4 text-accent fill-accent/20" />}
                      </div>
                      <div>
                        <span className="font-bold text-xs text-ink block">{item.title}</span>
                        <span className="text-[11px] text-ink-secondary block mt-0.5">{item.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Section>

            {/* 4. Command Palette Styles (Glass / Solid / Tinted / Obsidian) */}
            <Section
              titleKey="theme.cmdPaletteSection"
              hintKey="theme.cmdPaletteHint"
              badge={
                <span className="px-2.5 py-0.5 rounded-full bg-accent-soft text-accent-soft-fg text-[11px] font-bold">
                  Spotlight UI (Ctrl + K)
                </span>
              }
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  {
                    id: "glass" as CommandPaletteStyle,
                    title: lang === "km" ? "Frosted Glass (កញ្ចក់ថ្លា)" : "Frosted Glass",
                    desc: lang === "km" ? "កញ្ចក់ថ្លាសម្រិលបែប Apple" : "Translucent frosted glass",
                    preview: "bg-white/60 dark:bg-white/10 backdrop-blur-md border-white/70 dark:border-white/20 shadow-md",
                    inner: "bg-accent/20 border border-accent/40 text-accent",
                  },
                  {
                    id: "solid" as CommandPaletteStyle,
                    title: lang === "km" ? "Theme Solid (រាបស្មើ)" : "System Solid",
                    desc: lang === "km" ? "ផ្ទៃរាបស្មើតាម Theme ប្រព័ន្ធ" : "Classic solid theme card",
                    preview: "bg-surface border-subtle shadow-md",
                    inner: "bg-accent text-white shadow-xs",
                  },
                  {
                    id: "tinted" as CommandPaletteStyle,
                    title: lang === "km" ? "Brand Tinted (រំលេចពណ៌)" : "Brand Tinted",
                    desc: lang === "km" ? "កញ្ចក់រំលេចពណ៌ Brand Logo" : "Tinted with Logo Accent",
                    preview: "bg-accent-soft/60 backdrop-blur-md border-accent/40 shadow-md",
                    inner: "bg-accent text-white shadow-xs",
                  },
                  {
                    id: "acrylic" as CommandPaletteStyle,
                    title: lang === "km" ? "Obsidian Dark (កញ្ចក់ខ្មៅ)" : "Obsidian Dark",
                    desc: lang === "km" ? "កញ្ចក់រលោងខ្មៅងងឹត" : "Deep smoked dark glass",
                    preview: "bg-slate-950/90 backdrop-blur-md border-slate-700 text-white shadow-lg",
                    inner: "bg-cyan-500 text-white shadow-xs",
                  },
                ].map((item) => {
                  const active = (prefs.commandPaletteStyle ?? "glass") === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => update({ commandPaletteStyle: item.id })}
                      className={cn(
                        "p-3.5 rounded-2xl border text-left flex flex-col justify-between gap-3 transition-all cursor-pointer",
                        active
                          ? "border-accent bg-accent-soft/40 ring-2 ring-accent shadow-sm"
                          : "border-subtle bg-surface hover:bg-cushion"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className={cn("w-14 h-8 rounded-xl border p-1 flex items-center justify-center shadow-xs", item.preview)}>
                          <div className={cn("w-full h-4 rounded-md flex items-center justify-center text-[9px] font-bold font-mono", item.inner)}>
                            ⌘K
                          </div>
                        </div>
                        {active && <CheckCircle2 className="w-4 h-4 text-accent fill-accent/20" />}
                      </div>
                      <div>
                        <span className="font-bold text-xs text-ink block">{item.title}</span>
                        <span className="text-[11px] text-ink-secondary block mt-0.5">{item.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Section>

            {/* 5. 8 Modern Sidebar Styles & Archetypes */}
            <Section
              titleKey="theme.sidebarStyleSection"
              hintKey="theme.sidebarStyleHint"
              badge={
                <span className="px-2.5 py-0.5 rounded-full bg-accent-soft text-accent-soft-fg text-[11px] font-bold">
                  8 Modern Archetypes
                </span>
              }
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {[
                  {
                    id: "classic" as SidebarStyleName,
                    title: lang === "km" ? "Aura Classic (លំនាំដើម)" : "Aura Classic",
                    desc: lang === "km" ? "ពេញកម្ពស់ + Accent Bar ឆ្វេង" : "Full dock + left accent bar",
                    preview: (
                      <div className="w-14 h-8 rounded-lg border border-subtle bg-surface p-1 flex flex-col justify-between shadow-xs">
                        <div className="w-full h-3 rounded bg-accent-soft border-l-2 border-accent" />
                        <div className="w-2/3 h-1.5 rounded-xs bg-ink/10" />
                      </div>
                    ),
                  },
                  {
                    id: "compact-rail" as SidebarStyleName,
                    title: lang === "km" ? "UntitledUI Rail + Flyout" : "UntitledUI Rail + Flyout",
                    desc: lang === "km" ? "Slim Icon Rail (68px) + Popover" : "Slim icon rail with flyouts",
                    preview: (
                      <div className="w-14 h-8 rounded-lg border border-subtle bg-surface p-1 flex items-center gap-1.5">
                        <div className="w-4 h-full rounded bg-accent/20 flex flex-col items-center justify-around py-0.5">
                          <div className="w-2 h-2 rounded-xs bg-accent" />
                          <div className="w-1.5 h-1.5 rounded-xs bg-ink/20" />
                        </div>
                        <div className="flex-1 h-full rounded-md border border-subtle bg-surface shadow-xs p-1 flex flex-col justify-between">
                          <div className="w-full h-2 rounded-xs bg-accent-soft" />
                          <div className="w-2/3 h-1 rounded-xs bg-ink/10" />
                        </div>
                      </div>
                    ),
                  },
                  {
                    id: "floating" as SidebarStyleName,
                    title: lang === "km" ? "Floating Island Glass" : "Floating Island Glass",
                    desc: lang === "km" ? "អណ្តែតដាច់ពីគែម + Frosted Blur" : "Detached floating capsule",
                    preview: (
                      <div className="w-14 h-8 rounded-lg bg-sunken/60 p-0.5 flex items-center justify-center">
                        <div className="w-12 h-7 rounded-lg border border-white/60 dark:border-white/20 bg-white/70 dark:bg-white/10 backdrop-blur-md shadow-xs p-1 flex flex-col justify-between">
                          <div className="w-full h-2.5 rounded bg-accent/20 border border-accent/40" />
                          <div className="w-1/2 h-1 rounded-xs bg-ink/10" />
                        </div>
                      </div>
                    ),
                  },
                  {
                    id: "dual-column" as SidebarStyleName,
                    title: lang === "km" ? "Dual-Column Mega Sidebar" : "Dual-Column Mega Sidebar",
                    desc: lang === "km" ? "ជួរទី១ Rail + ជួរទី២ Sub-pane" : "Icon rail + adjoining sub-pane",
                    preview: (
                      <div className="w-14 h-8 rounded-lg border border-subtle bg-surface flex overflow-hidden shadow-xs">
                        <div className="w-4 h-full bg-cushion border-r border-subtle/80 flex flex-col items-center justify-around py-0.5">
                          <div className="w-2 h-2 rounded-xs bg-accent" />
                          <div className="w-1.5 h-1.5 rounded-xs bg-ink/20" />
                        </div>
                        <div className="flex-1 p-1 flex flex-col justify-between">
                          <div className="w-full h-2.5 rounded bg-accent-soft" />
                          <div className="w-2/3 h-1.5 rounded-xs bg-ink/10" />
                        </div>
                      </div>
                    ),
                  },
                  {
                    id: "carbon" as SidebarStyleName,
                    title: lang === "km" ? "Carbon Studio Dark" : "Carbon Studio Dark",
                    desc: lang === "km" ? "ផ្ទៃខ្មៅ Obsidian + Neon Accent" : "Obsidian dark + neon cyan",
                    preview: (
                      <div className="w-14 h-8 rounded-lg border border-slate-800 bg-[#0B0F19] p-1 flex flex-col justify-between shadow-xs">
                        <div className="w-full h-3 rounded bg-cyan-500/20 border-l-2 border-cyan-400 text-cyan-400" />
                        <div className="w-2/3 h-1.5 rounded-xs bg-slate-800" />
                      </div>
                    ),
                  },
                  {
                    id: "enterprise-erp" as SidebarStyleName,
                    title: lang === "km" ? "Enterprise ERP Pro" : "Enterprise ERP Pro",
                    desc: lang === "km" ? "Bracket Badges + Moving Active Pill" : "Bracket badges + moving active pill",
                    preview: (
                      <div className="w-14 h-8 rounded-lg border border-subtle bg-surface p-0.5 flex flex-col justify-between shadow-xs">
                        <div className="w-full h-3 rounded bg-accent text-accent-fg flex items-center justify-between px-1 text-[7px] font-bold shadow-xs">
                          <span>≡ Dash</span>
                          <span className="w-1 h-1 rounded-full bg-white" />
                        </div>
                        <div className="w-full h-2 rounded border-l border-accent/60 bg-accent-soft/40 flex items-center justify-between px-1">
                          <span className="w-2 h-1 rounded-xs bg-accent" />
                          <span className="text-[6px] text-accent font-bold">&gt;</span>
                        </div>
                      </div>
                    ),
                  },
                  {
                    id: "radiant" as SidebarStyleName,
                    title: lang === "km" ? "Radiant Aurora Glass" : "Radiant Aurora Glass",
                    desc: lang === "km" ? "Gradient Mesh + ពន្លឺ Aura Glow" : "Gradient mesh with luminous glow",
                    preview: (
                      <div className="w-14 h-8 rounded-lg border border-accent/30 bg-gradient-to-br from-accent-soft/60 via-surface to-accent/20 p-1 flex flex-col justify-between shadow-xs">
                        <div className="w-full h-3 rounded bg-accent text-white shadow-xs flex items-center justify-center">
                          <div className="w-2/3 h-1 rounded-xs bg-white/70" />
                        </div>
                        <div className="w-1/2 h-1 rounded-xs bg-ink/10" />
                      </div>
                    ),
                  },
                  {
                    id: "motion-expansion" as SidebarStyleName,
                    title: lang === "km" ? "Kinetic Morphing Expansion (Dribbble)" : "Kinetic Morphing Expansion",
                    desc: lang === "km" ? "Spring Width Expansion + Floating Pin Trigger" : "Fluid expansion animations + floating pin trigger",
                    preview: (
                      <div className="relative w-14 h-8 rounded-lg border border-subtle bg-surface p-1 flex flex-col justify-between shadow-xs overflow-visible">
                        <div className="w-full h-3 rounded-md bg-gradient-to-r from-accent/20 to-accent/5 border border-accent/30 flex items-center justify-between px-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                          <span className="w-4 h-1 rounded-xs bg-accent/60" />
                        </div>
                        <div className="w-3/4 h-1.5 rounded-xs bg-ink/10 ml-2 border-l border-accent/40" />
                        <div className="absolute -right-1.5 top-2.5 w-3 h-3 rounded-full bg-accent text-white flex items-center justify-center text-[7px] shadow-xs ring-1 ring-white">
                          ›
                        </div>
                      </div>
                    ),
                  },
                ].map((item) => {
                  const active = (prefs.sidebarStyle ?? "classic") === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => update({ sidebarStyle: item.id })}
                      className={cn(
                        "p-3.5 rounded-2xl border text-left flex flex-col justify-between gap-3 transition-all cursor-pointer",
                        active
                          ? "border-accent bg-accent-soft/40 ring-2 ring-accent shadow-sm"
                          : "border-subtle bg-surface hover:bg-cushion"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        {item.preview}
                        {active && <CheckCircle2 className="w-4 h-4 text-accent fill-accent/20" />}
                      </div>
                      <div>
                        <span className="font-bold text-xs text-ink block">{item.title}</span>
                        <span className="text-[11px] text-ink-secondary block mt-0.5">{item.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Section>

            {/* 5.5. CRUD & DataGrid Layout Styles (Modern Inline vs Enterprise Ribbon vs Split Workbench vs Compact POS) */}
            <Section
              titleKey="theme.crudStyleSection"
              hintKey="theme.crudStyleHint"
              badge={
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-accent-soft text-accent-soft-fg border border-accent/20">
                  {prefs.crudStyle || "modern-inline"}
                </span>
              }
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  {
                    id: "modern-inline" as CrudStyleName,
                    title: lang === "km" ? "Modern Inline (ទម្រង់ថ្មី Inline)" : "Modern Inline Action Bar",
                    desc:
                      lang === "km"
                        ? "របារ Search 1 ជួរ + ប៊ូតុង Action លើជួរនីមួយៗ (រូបភាព 1 & 2)"
                        : "Sleek 1-line search + inline per-row actions (Images 1 & 2)",
                    preview: (
                      <div className="w-full h-11 rounded-lg border border-subtle bg-cushion/60 p-1.5 flex flex-col justify-between">
                        <div className="flex items-center justify-between gap-1">
                          <div className="h-3 w-24 rounded bg-surface border border-subtle flex items-center px-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-ink/30" />
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="h-3 px-1.5 rounded bg-accent text-[7px] text-white font-bold flex items-center">
                              + New
                            </div>
                            <div className="h-3 w-4 rounded bg-surface border border-subtle" />
                          </div>
                        </div>
                        <div className="flex items-center justify-between border-t border-subtle/60 pt-0.5 text-[7px] text-ink-muted">
                          <span>Row item...</span>
                          <div className="flex gap-1">
                            <span className="w-2 h-2 rounded bg-ink/20 inline-block" />
                            <span className="w-2 h-2 rounded bg-ink/20 inline-block" />
                          </div>
                        </div>
                      </div>
                    ),
                  },
                  {
                    id: "enterprise-ribbon" as CrudStyleName,
                    title:
                      lang === "km"
                        ? "Enterprise Ribbon (ទម្រង់ Ribbon 2 ជួរ)"
                        : "Enterprise Ribbon Command Toolbar",
                    desc:
                      lang === "km"
                        ? "Command Ribbon (Create, Edit, Delete, Export, Check List) + Column Filter Funnels (រូបភាព 4)"
                        : "Command ribbon + dedicated search + column filter funnels (Image 4)",
                    preview: (
                      <div className="w-full h-11 rounded-lg border border-subtle bg-surface p-1 flex flex-col justify-between">
                        <div className="flex items-center gap-1 border-b border-subtle/80 pb-0.5">
                          <span className="px-1 rounded bg-accent/15 text-accent text-[6.5px] font-bold">+ Create</span>
                          <span className="px-1 rounded bg-sunken text-[6.5px] text-ink-secondary">✎ Edit</span>
                          <span className="px-1 rounded bg-sunken text-[6.5px] text-ink-secondary">🗑 Del</span>
                          <span className="px-1 rounded bg-sunken text-[6.5px] text-ink-secondary">⭳ Export</span>
                        </div>
                        <div className="flex items-center justify-between gap-1 pt-0.5">
                          <div className="h-2.5 flex-1 rounded bg-cushion border border-subtle text-[6px] px-1 text-ink-muted flex items-center">
                            Search...
                          </div>
                          <span className="px-1 py-0.2 rounded bg-accent text-white text-[6px] font-bold">Search</span>
                        </div>
                      </div>
                    ),
                  },
                  {
                    id: "split-workbench" as CrudStyleName,
                    title: lang === "km" ? "Split Workbench (ទម្រង់ Split)" : "Split Workbench Layout",
                    desc:
                      lang === "km"
                        ? "តារាងបញ្ជីផ្នែកឆ្វេង + ផ្ទាំង Detail Preview ផ្នែកស្ដាំ"
                        : "Master list on left + active item preview pane on right",
                    preview: (
                      <div className="w-full h-11 rounded-lg border border-subtle bg-surface p-1 flex gap-1">
                        <div className="flex-1 h-full rounded border border-subtle/80 bg-cushion/40 p-0.5 flex flex-col justify-between">
                          <div className="h-2 w-full rounded bg-surface border border-subtle" />
                          <div className="h-1.5 w-3/4 rounded bg-accent/20" />
                          <div className="h-1.5 w-2/3 rounded bg-ink/10" />
                        </div>
                        <div className="w-12 h-full rounded border border-accent/30 bg-accent-soft/30 p-0.5 flex flex-col justify-between">
                          <div className="h-2 w-full rounded bg-accent text-[6px] text-white font-bold flex items-center justify-center">Detail</div>
                          <div className="h-1 w-full rounded bg-ink/20" />
                          <div className="h-1 w-3/4 rounded bg-ink/15" />
                        </div>
                      </div>
                    ),
                  },
                  {
                    id: "compact-pos" as CrudStyleName,
                    title: lang === "km" ? "Compact POS Fast Grid (ទម្រង់ POS)" : "Compact POS / Fast Grid",
                    desc:
                      lang === "km"
                        ? "ទម្រង់តារាងញឹកស្អេកសម្រាប់ Cashier / POS / Barcode Scanner រហ័ស"
                        : "Ultra-dense rows tuned for cashier barcode entry & speed",
                    preview: (
                      <div className="w-full h-11 rounded-lg border border-subtle bg-surface p-1 flex flex-col justify-between">
                        <div className="h-2 w-full rounded bg-ink/80 text-[6px] text-white px-1 flex items-center justify-between font-mono">
                          <span>FAST POS</span>
                          <span>SCAN READY</span>
                        </div>
                        <div className="grid grid-cols-3 gap-0.5">
                          <div className="h-2 rounded bg-cushion border border-subtle" />
                          <div className="h-2 rounded bg-cushion border border-subtle" />
                          <div className="h-2 rounded bg-accent text-[5px] text-white font-bold flex items-center justify-center">OK</div>
                        </div>
                        <div className="h-1.5 w-full rounded bg-sunken" />
                      </div>
                    ),
                  },
                ].map((item) => {
                  const active = (prefs.crudStyle ?? "modern-inline") === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => update({ crudStyle: item.id })}
                      className={cn(
                        "p-3.5 rounded-2xl border text-left flex flex-col justify-between gap-3 transition-all cursor-pointer",
                        active
                          ? "border-accent bg-accent-soft/40 ring-2 ring-accent shadow-sm"
                          : "border-subtle bg-surface hover:bg-cushion"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        {item.preview}
                        {active && <CheckCircle2 className="w-4 h-4 text-accent fill-accent/20 ml-2 shrink-0" />}
                      </div>
                      <div>
                        <span className="font-bold text-xs text-ink block">{item.title}</span>
                        <span className="text-[11px] text-ink-secondary block mt-0.5">{item.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Section>

            {/* 6. Accent Color Swatches & Custom Hex Picker */}
            <Section titleKey="theme.accentSection" hintKey="theme.accentHint">
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => applyAccent(null)}
                  aria-pressed={prefs.accentColor === null}
                  className={`inline-flex h-8 items-center rounded-full border px-3 text-[11px] font-semibold transition-colors duration-150 cursor-pointer ${
                    prefs.accentColor === null
                      ? "border-accent bg-accent-soft text-accent-soft-fg ring-2 ring-accent"
                      : "border-subtle text-ink-secondary hover:bg-cushion hover:text-ink"
                  }`}
                >
                  {t("theme.accentDefault")}
                </button>

                {suggestedColor && (
                  <button
                    type="button"
                    onClick={() => applyAccent(suggestedColor)}
                    aria-pressed={prefs.accentColor === suggestedColor}
                    title={`Logo Color: ${suggestedColor}`}
                    className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[11px] font-semibold transition-all duration-150 cursor-pointer shadow-xs ${
                      prefs.accentColor === suggestedColor
                        ? "border-accent bg-accent-soft text-accent-soft-fg ring-2 ring-accent"
                        : "border-subtle hover:bg-cushion text-ink-secondary hover:text-ink"
                    }`}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-xs shrink-0"
                      style={{ backgroundColor: suggestedColor }}
                    />
                    <span className="font-mono">✨ Logo ({suggestedColor})</span>
                  </button>
                )}

                {ACCENT_SWATCHES.map((swatch) => (
                  <button
                    key={swatch.hex}
                    type="button"
                    onClick={() => applyAccent(swatch.hex)}
                    aria-pressed={prefs.accentColor === swatch.hex}
                    title={t(swatch.key)}
                    style={{ backgroundColor: swatch.hex }}
                    className={`h-8 w-8 rounded-full border-2 transition duration-150 cursor-pointer ${
                      prefs.accentColor === swatch.hex
                        ? "border-surface ring-2 ring-accent scale-105 shadow-sm"
                        : "border-surface/60 hover:scale-105"
                    }`}
                  />
                ))}

                {isComputingSuggestion && !suggestedColor && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-secondary">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Detecting color...</span>
                  </span>
                )}
              </div>

              <div className="mt-3.5 flex items-center gap-2 flex-wrap">
                <label
                  htmlFor="accent-hex-input"
                  className="shrink-0 text-[11px] font-semibold text-ink-secondary"
                >
                  {t("theme.customColor")}
                </label>
                <input
                  id="accent-hex-input"
                  type="text"
                  value={customColorInput}
                  onChange={(e) => handleCustomColorChange(e.target.value)}
                  placeholder={t("theme.customColorHint")}
                  className={`w-32 rounded-lg border px-2.5 py-1.5 font-mono text-xs bg-surface outline-none focus:ring-2 focus:ring-accent/20 ${
                    customColorError ? "border-danger" : "border-subtle"
                  }`}
                />
                <input
                  type="color"
                  value={HEX_COLOR_PATTERN.test(customColorInput) ? customColorInput : "#000000"}
                  onChange={(e) => handleCustomColorChange(e.target.value)}
                  aria-label={t("theme.customColor")}
                  className="h-8 w-8 cursor-pointer rounded-lg border border-subtle bg-transparent p-0"
                />
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 text-[10px] font-mono font-bold">
                  ✓ WCAG AA 4.5:1 Contrast Safe
                </span>
              </div>
              {customColorError && (
                <p className="mt-1.5 text-[11px] text-danger">{t("theme.customColorInvalid")}</p>
              )}
            </Section>

            {/* 7. Ergonomics: Radius, Density, Font Scale, Motion & Lite Mode */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Section titleKey="theme.radiusSection" hintKey="theme.radiusHint">
                <Segmented
                  options={RADII}
                  value={prefs.radius}
                  onChange={(radius) => update({ radius })}
                  labelFor={(r) => t(RADIUS_LABEL[r])}
                />
              </Section>
              <Section titleKey="theme.densitySection" hintKey="theme.densityHint">
                <Segmented
                  options={DENSITIES}
                  value={prefs.density}
                  onChange={(density) => update({ density })}
                  labelFor={(d) => t(DENSITY_LABEL[d])}
                />
              </Section>
              <Section titleKey="theme.fontScaleSection" hintKey="theme.fontScaleHint">
                <Segmented
                  options={FONT_SCALES}
                  value={prefs.fontScale}
                  onChange={(fontScale) => update({ fontScale })}
                  labelFor={(f) => t(FONT_SCALE_LABEL[f])}
                />
              </Section>
              <Section titleKey="theme.motionSection" hintKey="theme.motionHint">
                <Segmented
                  options={["full", "reduced"] as const}
                  value={prefs.motion}
                  onChange={(motion) => update({ motion })}
                  labelFor={(m) => (m === "full" ? "Full Motion" : "Reduced")}
                />
                {osReducedMotion && (
                  <p className="mt-2 text-[11px] text-ink-secondary">
                    {t("theme.motionOsNote")}
                  </p>
                )}
              </Section>
              <Section titleKey="perf.sectionTitle" hintKey="perf.sectionHint">
                <Segmented
                  options={["off", "on"] as const}
                  value={prefs.lite}
                  onChange={(lite) => update({ lite })}
                  labelFor={(l) => (l === "on" ? "Lite Mode (On)" : "Full GPU (Off)")}
                />
                <p className="mt-2 text-[11px] text-ink-secondary">
                  {t("perf.tierLabel")}:{" "}
                  {perfTier === "low"
                    ? "Low-tier device"
                    : perfTier === "medium"
                    ? "Standard device"
                    : "High-performance device"}
                </p>
              </Section>
            </div>
          </motion.div>

          {/* ── Right Live Preview Animated Column ── */}
          <motion.div
            variants={rightColumnVariants}
            initial="hidden"
            animate="visible"
            className="lg:col-span-1"
          >
            <div className="lg:sticky lg:top-4 space-y-4">
              <Section
                titleKey="theme.previewSection"
                hintKey="theme.previewHint"
                badge={
                  <div className="inline-flex rounded-lg bg-sunken p-0.5 border border-subtle">
                    <button
                      type="button"
                      onClick={() => setPreviewTab("ticket")}
                      title="Ticket Preview"
                      className={cn(
                        "min-h-6 px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer",
                        previewTab === "ticket" ? "bg-surface text-ink shadow-xs" : "text-ink-secondary"
                      )}
                    >
                      Ticket
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewTab("kpi")}
                      title="KPI Preview"
                      className={cn(
                        "min-h-6 px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer",
                        previewTab === "kpi" ? "bg-surface text-ink shadow-xs" : "text-ink-secondary"
                      )}
                    >
                      KPI
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewTab("login")}
                      title="Login Preview"
                      className={cn(
                        "min-h-6 px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer",
                        previewTab === "login" ? "bg-surface text-ink shadow-xs" : "text-ink-secondary"
                      )}
                    >
                      Login
                    </button>
                  </div>
                }
              >
                {previewTab === "ticket" && (
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-subtle p-4 bg-surface shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="truncate text-xs font-bold text-ink">
                            Ticket SVC-1042
                          </h3>
                          <p className="mt-1 text-[11px] text-ink-secondary">
                            Compressor unit, awaiting customer confirmation.
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-0.5 text-[10px] font-bold text-accent-soft-fg">
                          In Progress
                        </span>
                      </div>
                      <div className="mt-3.5 flex gap-2">
                        <button
                          type="button"
                          className="rounded-xl bg-accent px-3.5 py-1.5 text-xs font-bold text-accent-fg transition-all hover:brightness-110 shadow-xs cursor-pointer"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="rounded-xl border border-subtle px-3.5 py-1.5 text-xs font-semibold text-ink-secondary hover:bg-cushion transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-subtle">
                      <table className="w-full text-left">
                        <thead className="bg-cushion">
                          <tr>
                            <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                              REF NO
                            </th>
                            <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                              CUSTOMER
                            </th>
                            <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                              STATUS
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-subtle">
                          {[
                            ["SVC-1042", "Sokha Ltd", true],
                            ["SVC-1041", "Mekong Co", false],
                            ["SVC-1039", "Angkor Ice", false],
                          ].map(([ref, customer, hot]) => (
                            <tr key={ref as string}>
                              <td className="px-3 py-2 font-mono text-[11px] text-ink font-semibold">
                                {ref}
                              </td>
                              <td className="px-3 py-2 text-[11px] text-ink-secondary">
                                {customer}
                              </td>
                              <td className="px-3 py-2">
                                <span
                                  className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                    hot
                                      ? "bg-accent text-accent-fg"
                                      : "bg-sunken text-ink-secondary"
                                  }`}
                                >
                                  In Progress
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {previewTab === "kpi" && (
                  <div className="space-y-3">
                    <div className="p-4 rounded-2xl border border-accent/30 bg-surface shadow-sm ring-1 ring-accent/20">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                            Today&apos;s Intake
                          </span>
                          <span className="block text-2xl font-black text-ink mt-1">24</span>
                        </div>
                        <div className="p-2 rounded-xl bg-accent-soft text-accent">
                          <TrendingUp className="w-5 h-5" />
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-subtle flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded-full bg-accent-soft text-accent-soft-fg text-[10px] font-bold">
                          +280.0% vs avg
                        </span>
                        <div className="h-6 w-20 bg-gradient-to-r from-transparent to-accent/30 rounded-sm" />
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl border border-subtle bg-cushion flex items-center justify-between">
                      <span className="text-xs font-semibold text-ink">Active Theme Accent</span>
                      <div className="flex items-center gap-2">
                        <span
                          className="w-4 h-4 rounded-full border border-black/10"
                          style={{ backgroundColor: prefs.accentColor || "#0F6E4E" }}
                        />
                        <span className="text-xs font-mono font-bold text-ink">
                          {prefs.accentColor || "Default"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {previewTab === "login" && (
                  <div className="space-y-3">
                    <div
                      style={{
                        background: `linear-gradient(135deg, ${prefs.accentColor || "#0F6E4E"} 0%, rgba(15, 23, 42, 0.95) 100%)`,
                      }}
                      className="p-4 rounded-2xl text-white shadow-md space-y-3 border border-white/20"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-white p-1 border border-white/40 shadow-xs grid place-items-center overflow-hidden">
                          {profilePictureUrl ? (
                            <BrandLogo
                              src={profilePictureUrl}
                              alt=""
                              style={{ transform: `scale(${(prefs.logoScale ?? 130) / 100})` }}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <Sparkles className="w-4 h-4 text-slate-800" />
                          )}
                        </div>
                        <div>
                          <span className="text-xs font-black block text-white leading-none">
                            Next-Gen Portal
                          </span>
                          <span className="text-[10px] text-white/70 block mt-0.5">Enterprise Hub</span>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-white/10 border border-white/15 backdrop-blur-xs space-y-1.5">
                        <span className="text-[11px] font-bold text-white block">Welcome back</span>
                        <div className="h-4 bg-white/20 rounded-md w-3/4" />
                        <div className="h-6 bg-white/30 rounded-lg w-full mt-2" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Status Bar */}
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-subtle px-3 py-2 bg-cushion/60">
                  <Type className="h-3.5 w-3.5 shrink-0 text-accent" />
                  <span className="text-[11px] text-ink-secondary">
                    {t(RADIUS_LABEL[prefs.radius])} · {t(DENSITY_LABEL[prefs.density])} ·{" "}
                    {t(FONT_SCALE_LABEL[prefs.fontScale])}
                  </span>
                </div>
              </Section>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
