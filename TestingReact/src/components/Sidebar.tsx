"use client";

import BrandLogo from "@/components/BrandLogo";
import { useBrandLogo, publishBrandLogo } from "@/services/brandLogoStore";
import React, { memo, useCallback, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  Package,
  Wrench,
  Users,
  ClipboardList,
  CheckCircle,
  Clock,
  XCircle,
  FileText,
  FileSpreadsheet,
  ShieldAlert,
  Settings,
  Activity,
  Leaf,
  AlertTriangle,
  Truck,
  FileCheck,
  MapPin,
  AlertCircle,
  Award,
  PhoneCall,
  TrendingUp,
  Sparkles,
  RefreshCw,
  Trophy,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  SlidersHorizontal,
  Cpu,
  Search,
  BarChart3,
  Box,
  ChevronsUpDown, Boxes,
  FolderTree,
  Tags,
  BadgeCheck,
} from "lucide-react";
import { useI18n } from "@/i18n/LanguageProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { useActionHandler } from "@/components/ActionBus";
import { fetchAppLogoUrl } from "@/services/appSettings";
import { fetchHealthSnapshot, subscribeToHealth, readHealth, publishHealth, type HealthSnapshot } from "@/services/healthSnapshot";
import { prefetchRouteData } from "@/services/routePrefetch";
import { NAV_GROUPS, HOME_ITEM, SETTINGS_ITEM, findNavItem, type NavSubGroup } from "@/config/navigation";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { hasAnyRole } from "@/services/authSession";
import { ProgressBar } from "@/components/av";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

const ICONS: Record<string, React.ElementType> = {
  "/templates-settings": SlidersHorizontal,
  "/service-tickets": FileText,
  "/pending-repairs": Clock,
  "/completed-repairs": CheckCircle,
  "/stage-report": Activity,
  "/rejected-report": AlertTriangle,
  "/third-party-repairs": Truck,
  "/contract-report": FileCheck,
  "/location-report": MapPin,
  "/faults-report": AlertCircle,
  "/engineer-kpi-report": Award,
  "/sales-followup": PhoneCall,
  "/sales-conversion-report": TrendingUp,
  "/sales-leads-report": Sparkles,
  "/contract-renewal-report": RefreshCw,
  "/top-customers-report": Trophy,
  "/daily-report": FileSpreadsheet,
  "/monthly-report": FileSpreadsheet,
  "/monthly-technical-matrix": FileSpreadsheet,
  "/customer-report": FileSpreadsheet,
  "/engineer-report": FileSpreadsheet,
  "/repair-report": FileSpreadsheet,
  "/history-report": FileSpreadsheet,
  "/sparepart-usage": FileSpreadsheet,
  "/sparepart-hold": FileSpreadsheet,
  "/stock-transactions": FileSpreadsheet,
  "/stock-movement": TrendingUp,
  "/stock-adjustments": FileSpreadsheet,
  "/stock-reconciliation": FileCheck,
  "/stock-health": Activity,
  "/stock-dead": AlertTriangle,
  "/received-inventory": Package,
  "/spareparts": Wrench,
  "/spareparts/categories": FolderTree,
  "/spareparts/types": Tags,
  "/spareparts/brands": BadgeCheck,
  "/customers": Users,
  "/receive-item": ClipboardList,
  "/inspect-item": Clock,
  "/inspection": FileText,
  "/approve-repair": CheckCircle,
  "/approve-verify": CheckCircle,
  "/spare-request": Wrench,
  "/confirmed-sale": CheckCircle,
  "/waiting-confirm": Clock,
  "/rejected": XCircle,
  "/unrepairable": ShieldAlert,
};

const GROUP_ICONS: Record<string, React.ElementType> = {
  "nav.groupInventory": Package,
  "nav.groupCustomer": Users,
  "nav.groupTechnical": Wrench,
  "nav.groupStock": Box,
  "nav.groupSales": TrendingUp,
  "nav.groupTracking": AlertTriangle,
  "nav.groupReports": BarChart3,
};

const SUBGROUP_ICONS: Record<string, React.ElementType> = {
  "nav.subgroupReportDesign": SlidersHorizontal,
  "nav.subgroupOperations": Wrench,
  "nav.subgroupDiagnostics": AlertCircle,
  "nav.subgroupEngineerKpi": Award,
  "nav.subgroupSalesCrm": TrendingUp,
  "nav.subgroupStockParts": Package,
  "nav.subgroupSpareParts": Boxes,
};

const RAIL_CATEGORIES = [
  { id: "home", title: "Home", icon: Home, href: "/" },
  {
    id: "inventory",
    title: "Inventory & Spare Parts",
    icon: Package,
    items: [
      { href: "/received-inventory", name: "Receive Inventory" },
      { href: "/spareparts", name: "Spare Parts Catalog" },
      { href: "/spareparts/categories", name: "Part Categories" },
      { href: "/spareparts/types", name: "Part Types" },
      { href: "/spareparts/brands", name: "Part Brands" },
      { href: "/stock-transactions", name: "Stock Transactions" },
      { href: "/stock-movement", name: "Stock Movement" },
      { href: "/stock-adjustments", name: "Stock Adjustments" },
      { href: "/stock-reconciliation", name: "Stock Reconciliation" },
      { href: "/stock-health", name: "Stock Health" },
      { href: "/stock-dead", name: "Dead Stock" },
    ],
  },
  {
    id: "technical",
    title: "Technical Operations",
    icon: Wrench,
    items: [
      { href: "/receive-item", name: "Receive Item" },
      { href: "/inspect-item", name: "Inspect Item" },
      { href: "/inspection", name: "Technical Inspection" },
      { href: "/approve-repair", name: "Approve Repair" },
      { href: "/approve-verify", name: "Verify Repairs" },
      { href: "/spare-request", name: "Spare Request" },
    ],
  },
  {
    id: "customers",
    title: "Customer Center",
    icon: Users,
    items: [
      { href: "/customers", name: "Customer Directory" },
      { href: "/confirmed-sale", name: "Confirmed Sales" },
      { href: "/waiting-confirm", name: "Waiting Confirmation" },
      { href: "/rejected", name: "Rejected Tickets" },
      { href: "/unrepairable", name: "Unrepairable Equipment" },
      { href: "/sales-followup", name: "Sales Followup" },
    ],
  },
  {
    id: "reports",
    title: "28 Core Reports",
    icon: BarChart3,
    items: [
      { href: "/service-tickets", name: "Service Tickets & Reports" },
      { href: "/templates-settings", name: "Report Designer" },
      { href: "/daily-report", name: "Daily Operations" },
      { href: "/monthly-report", name: "Monthly Performance" },
      { href: "/monthly-technical-matrix", name: "Technical Matrix" },
      { href: "/customer-report", name: "Customer Analytics" },
      { href: "/engineer-report", name: "Engineer Analytics" },
      { href: "/repair-report", name: "Repair Performance" },
      { href: "/history-report", name: "Audit & History" },
      { href: "/sparepart-usage", name: "Spare Parts Usage" },
      { href: "/sparepart-hold", name: "Sparepart Hold" },
      { href: "/stock-adjustments", name: "Stock Adjustments" },
      { href: "/stock-reconciliation", name: "Stock Reconciliation" },
      { href: "/stage-report", name: "Stage Breakdown" },
      { href: "/engineer-kpi-report", name: "Engineer KPI" },
      { href: "/sales-conversion-report", name: "Sales Conversion" },
      { href: "/sales-leads-report", name: "Sales Leads" },
      { href: "/contract-renewal-report", name: "Contract Renewals" },
      { href: "/top-customers-report", name: "Top Customers" },
    ],
  },
];

const DUAL_DOMAINS = [
  { id: "home", title: "Overview", icon: Home, directHref: "/" },
  {
    id: "operations",
    title: "Technical Operations",
    icon: Wrench,
    items: [
      { href: "/receive-item", name: "Receive Item" },
      { href: "/inspect-item", name: "Inspect Item" },
      { href: "/inspection", name: "Technical Inspection" },
      { href: "/approve-repair", name: "Approve Repair" },
      { href: "/approve-verify", name: "Verify Repairs" },
      { href: "/spare-request", name: "Spare Request" },
    ],
  },
  {
    id: "inventory",
    title: "Inventory & Spare Parts",
    icon: Package,
    items: [
      { href: "/received-inventory", name: "Received Inventory" },
      { href: "/spareparts", name: "Spare Parts Catalog" },
      { href: "/spareparts/categories", name: "Part Categories" },
      { href: "/spareparts/types", name: "Part Types" },
      { href: "/spareparts/brands", name: "Part Brands" },
      { href: "/stock-transactions", name: "Stock Transactions" },
      { href: "/stock-movement", name: "Stock Movement" },
      { href: "/stock-adjustments", name: "Stock Adjustments" },
      { href: "/stock-reconciliation", name: "Stock Reconciliation" },
      { href: "/stock-health", name: "Stock Health" },
      { href: "/stock-dead", name: "Dead Stock" },
    ],
  },
  {
    id: "reports",
    title: "28 Core Reports",
    icon: BarChart3,
    items: [
      { href: "/service-tickets", name: "Service Tickets & Reports" },
      { href: "/templates-settings", name: "Report Designer" },
      { href: "/daily-report", name: "Daily Operations" },
      { href: "/monthly-report", name: "Monthly Performance" },
      { href: "/monthly-technical-matrix", name: "Technical Matrix" },
      { href: "/customer-report", name: "Customer Analytics" },
      { href: "/engineer-report", name: "Engineer Analytics" },
      { href: "/repair-report", name: "Repair Performance" },
      { href: "/history-report", name: "Audit & History" },
      { href: "/sparepart-usage", name: "Spare Parts Usage" },
      { href: "/sparepart-hold", name: "Sparepart Hold" },
      { href: "/stage-report", name: "Stage Breakdown" },
      { href: "/rejected-report", name: "Rejected Analysis" },
      { href: "/third-party-repairs", name: "Third Party Operations" },
      { href: "/contract-report", name: "Contract Matrix" },
      { href: "/location-report", name: "Location Demographics" },
      { href: "/faults-report", name: "Common Faults" },
      { href: "/engineer-kpi-report", name: "Engineer KPI" },
      { href: "/sales-conversion-report", name: "Sales Conversion" },
      { href: "/sales-leads-report", name: "Sales Leads" },
      { href: "/contract-renewal-report", name: "Contract Renewals" },
      { href: "/top-customers-report", name: "Top Customers" },
    ],
  },
  {
    id: "customers",
    title: "Customers & Sales",
    icon: Users,
    items: [
      { href: "/customers", name: "Customer Center" },
      { href: "/confirmed-sale", name: "Confirmed Sales" },
      { href: "/waiting-confirm", name: "Waiting Confirmation" },
      { href: "/rejected", name: "Rejected Tickets" },
      { href: "/unrepairable", name: "Unrepairable Equipment" },
      { href: "/sales-followup", name: "Sales Followup" },
    ],
  },
];

const NAV_PILL_SPRING = { type: "spring", stiffness: 450, damping: 32 } as const;
const NAV_ACCENT_SPRING = { type: "spring", stiffness: 500, damping: 30 } as const;

let savedSidebarScrollTop = 0;
// Default all parent groups to COLLAPSED (false)
let savedOpenParentGroups: Record<string, boolean> = {
  "nav.groupInventory": false,
  "nav.groupCustomer": false,
  "nav.groupTechnical": false,
  "nav.groupStock": false,
  "nav.groupSales": false,
  "nav.groupTracking": false,
  "nav.groupReports": false,
};

let savedOpenSubgroups: Record<string, boolean> = {
  // Collapsed by default: user can click to expand when needed
  "nav.subgroupSpareParts": false,
  "nav.subgroupReportDesign": false,
  "nav.subgroupOperations": false,
  "nav.subgroupDiagnostics": false,
  "nav.subgroupEngineerKpi": false,
  "nav.subgroupSalesCrm": false,
  "nav.subgroupStockParts": false,
};

interface HealthState {
  pct: number;
  label: string;
  /*
    Every field optional, matching `HealthSnapshot`. This used to declare them
    all required and got away with it only because the payload arrived as
    `any` from `res.json()` — the reads below have always been written
    defensively (`mem?.totalMb ?? 325`), which is the honest shape.
  */
  memory?: HealthSnapshot["memory"];
}

function readStoredUser(): { name: string; role: string; picture: string | null } {
  if (typeof window === "undefined") return { name: "User", role: "Member", picture: null };
  try {
    const raw = localStorage.getItem("user_info");
    if (!raw) return { name: "User", role: "Member", picture: null };
    const p = JSON.parse(raw) as Record<string, unknown>;
    const fn = String(p.firstName || p.FirstName || "").trim();
    const ln = String(p.lastName || p.LastName || "").trim();
    const full = `${fn} ${ln}`.trim();
    const un = String(p.userName || p.UserName || "");
    const rawRoles = p.roles || p.Roles || (p.role ? [p.role] : []);
    const roles = Array.isArray(rawRoles) ? rawRoles : [];
    return {
      name: full || un || "User",
      role: String(roles[0] || "Member"),
      picture: (p.profilePictureUrl || p.ProfilePictureUrl || null) as string | null,
    };
  } catch {
    return { name: "User", role: "Member", picture: null };
  }
}

const DEFAULT_HEALTH: HealthState = {
  pct: 100,
  label: "2/2",
  memory: {
    frontendMb: 42,
    technicalApiMb: 206,
    userManagementApiMb: 297,
    customerEmployeeApiMb: 88,
    totalMb: 633,
    pct: 31,
  },
};

const HealthWidget = memo(function HealthWidget({
  collapsed,
  sidebarStyle = "classic",
}: {
  collapsed: boolean;
  sidebarStyle?: string;
}) {
  const [health, setHealth] = useState<HealthState>(() => (readHealth() as HealthState) || DEFAULT_HEALTH);
  const isCarbon = sidebarStyle === "carbon";
  // This widget rendered entirely in English before 2026-08-25 — it was the one
  // block of the sidebar that never called useI18n().
  const { t, lang } = useI18n();

  useEffect(() => {
    let alive = true;

    async function check() {
      try {
        /*
          Shared snapshot, not a direct `fetch`. This component remounts on
          every navigation (each page renders its own `PageWrapper`), so a
          mount fetch here meant one `/api/health` request per route change
          and made the 60s interval below meaningless. `SystemStatus` polls
          and publishes into the same store, so this usually costs no request
          at all — see `services/healthSnapshot`.
        */
        const data = await fetchHealthSnapshot();
        if (!data) throw new Error("health unavailable");
        const comps = Object.values(data?.components ?? {}) as ({ status?: string } | undefined)[];
        const up = comps.filter((c) => c?.status === "up").length;
        const pct = comps.length ? (up / comps.length) * 100 : data?.status === "healthy" ? 100 : 0;
        if (alive) {
          setHealth({
            pct,
            label: `${up}/${comps.length}`,
            memory: data?.memory,
          });
        }
      } catch {
        if (alive) {
          setHealth({
            pct: 0,
            label: "—",
            memory: {
              frontendMb: 45,
              technicalApiMb: 98,
              userManagementApiMb: 94,
              customerEmployeeApiMb: 88,
              totalMb: 325,
              pct: 32,
            },
          });
        }
      }
    }

    void check();

    const tick = () => {
      if (document.visibilityState === "visible") void check();
    };
    const id = setInterval(tick, 60_000);

    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);

    // `SystemStatus` polls at 30s and publishes; picking that up here is what
    // lets this component stay current without a request of its own.
    const unsubscribe = subscribeToHealth(() => {
      if (alive) void check();
    });

    return () => {
      alive = false;
      clearInterval(id);
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const pct = health?.pct ?? 0;
  const tone = pct >= 100 ? "success" : pct > 0 ? "warning" : "danger";
  const mem = health?.memory;
  const memTotal = mem?.totalMb ?? 325;
  const memPct = mem?.pct ?? Math.round((memTotal / 2048) * 100);
  const memTone = memPct < 75 ? "accent" : memPct < 90 ? "warning" : "danger";

  const [isCleaningRam, setIsCleaningRam] = useState(false);

  // By default, keep health & RAM collapsed/small as requested by user.
  // When user clicks, it expands into full details view. State persists across navigations.
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem("sidebar_health_expanded") === "true";
    } catch {
      return false;
    }
  });

  const toggleExpanded = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("sidebar_health_expanded", String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const handleCleanRam = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isCleaningRam) return;
    setIsCleaningRam(true);
    try {
      // 1. Client-side SWR & Session cache purge
      if (typeof window !== "undefined") {
        for (const key of Object.keys(sessionStorage)) {
          if (key.startsWith("cache:") || key.startsWith("inf_list_")) {
            sessionStorage.removeItem(key);
          }
        }
      }
      // 2. Server-side V8 GC & API cache purge
      const res = await fetch("/api/health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.report) {
        publishHealth(data.report);
      }
      toast.success(
        lang === "km"
          ? "🧹 បានសម្អាត RAM & System Cache ជោគជ័យ!"
          : "🧹 System RAM & Cache Purged Successfully!",
        { id: "clean-ram-toast", duration: 3000 }
      );
    } catch {
      toast.error(
        lang === "km"
          ? "❌ មិនអាចសម្អាត RAM បានទេ"
          : "❌ Failed to clean RAM"
      );
    } finally {
      setIsCleaningRam(false);
    }
  }, [isCleaningRam, lang]);

  if (collapsed) {
    return (
      <div className="grid place-items-center py-2 space-y-2" title={t("sysmon.tooltipSummary", { pct: String(Math.round(pct)), mb: String(memTotal) })}>
        <Activity
          className={cn(
            "w-5 h-5",
            tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-danger"
          )}
        />
        <button
          type="button"
          onClick={handleCleanRam}
          disabled={isCleaningRam}
          title={lang === "km" ? "ចុចដើម្បីសម្អាត RAM" : "Click to Clean RAM"}
          className="cursor-pointer"
        >
          <Cpu className={cn("w-4 h-4", isCarbon ? "text-cyan-400" : "text-accent", isCleaningRam && "animate-spin")} />
        </button>
      </div>
    );
  }

  return (
    <div className={cn(
      "rounded-xl border transition-all duration-200 select-none",
      isCarbon
        ? "bg-slate-900/90 border-slate-800 text-slate-200"
        : "bg-cushion border-subtle",
      !isExpanded && "hover:border-accent/30 hover:bg-cushion-hover/60 shadow-2xs"
    )}>
      {/* ── 1. HEADER ROW (CLICKABLE TOGGLE) ── */}
      <button
        type="button"
        onClick={toggleExpanded}
        aria-expanded={isExpanded}
        className={cn(
          "w-full flex items-center justify-between text-left cursor-pointer transition-colors group",
          isExpanded
            ? "p-2 lg:p-2 xl:p-2.5 pb-1 lg:pb-1 xl:pb-1"
            : "p-2 lg:p-2 xl:p-2.5"
        )}
        title={
          isExpanded
            ? (lang === "km" ? "ចុចដើម្បីបង្រួមតូច" : "Click to collapse")
            : (lang === "km" ? "ចុចដើម្បីមើលព័ត៌មានលម្អិត System & RAM" : "Click to expand System Health & RAM details")
        }
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="relative flex items-center shrink-0">
            <Activity
              className={cn(
                "w-3.5 h-3.5 shrink-0",
                tone === "success"
                  ? isCarbon ? "text-emerald-400" : "text-accent"
                  : tone === "warning"
                    ? "text-warning"
                    : "text-danger"
              )}
            />
            {tone !== "success" && (
              <span className="absolute -top-0.5 -right-0.5 flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-danger" />
              </span>
            )}
          </div>
          <span className={cn("text-xs font-semibold truncate", isCarbon ? "text-slate-200" : "text-ink")}>
            {t("sysmon.systemHealth")}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={cn(
              "text-xs font-semibold tabular-nums",
              tone === "success"
                ? isCarbon ? "text-emerald-400" : "text-emerald-600 dark:text-emerald-400 font-bold"
                : "text-warning font-bold"
            )}
          >
            {health ? `${Math.round(pct)}%` : "…"}
          </span>

          {!isExpanded && (
            <span
              className={cn(
                "text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded flex items-center gap-1",
                isCarbon
                  ? "bg-slate-800/80 text-cyan-300 border border-slate-700/60"
                  : "bg-surface text-ink-secondary border border-subtle"
              )}
            >
              <Cpu className="w-3 h-3 text-accent shrink-0" />
              <span>{memTotal} MB</span>
            </span>
          )}

          <ChevronDown
            className={cn(
              "w-3.5 h-3.5 text-ink-muted group-hover:text-ink transition-transform duration-200",
              isExpanded && "rotate-180"
            )}
          />
        </div>
      </button>

      {/* ── 2. EXPANDABLE DETAILS BODY (LIKE IMAGE 2) ── */}
      {isExpanded && (
        <div className="px-2 lg:px-2 xl:px-2.5 pb-2 lg:pb-2 xl:pb-2.5 space-y-2 lg:space-y-2 xl:space-y-2.5 pt-0.5">
          {/* System Services Health Progress */}
          <div>
            <ProgressBar value={pct} tone={tone} />
            <div className={cn("mt-0.5 text-[9.5px] flex items-center justify-between", isCarbon ? "text-slate-400" : "text-ink-muted")}>
              <span>{health ? t("sysmon.servicesResponding", { label: health.label }) : t("sysmon.checking")}</span>
              <span className={cn(
                "font-mono text-[8.5px] font-semibold",
                tone === "success" ? "text-emerald-500" : tone === "warning" ? "text-warning" : "text-danger"
              )}>
                {tone === "success"
                  ? t("sysmon.allOnline")
                  : tone === "warning"
                    ? t("sysmon.degraded")
                    : t("sysmon.offline")}
              </span>
            </div>
          </div>

          {/* Subtle Divider */}
          <div className={cn("h-px", isCarbon ? "bg-slate-800" : "bg-subtle/50")} />

          {/* System RAM Usage Progress */}
          <div className="relative group cursor-pointer">
            <div className="flex items-center gap-1.5 mb-1">
              <Cpu className={cn("w-3 h-3 shrink-0", isCarbon ? "text-cyan-400" : "text-accent")} />
              <span className={cn("text-[10.5px] font-semibold", isCarbon ? "text-slate-200" : "text-ink")}>{t("sysmon.ramUsage")}</span>
              <button
                type="button"
                onClick={handleCleanRam}
                disabled={isCleaningRam}
                title={lang === "km" ? "ចុចដើម្បីសម្អាត RAM & System Cache" : "Click to Purge System RAM & Cache"}
                className={cn(
                  "ml-auto px-1.5 py-0.5 text-[9px] font-bold rounded-md flex items-center gap-1 transition-all cursor-pointer border shadow-sm",
                  isCarbon
                    ? "bg-cyan-950/70 text-cyan-300 border-cyan-800/70 hover:bg-cyan-900"
                    : "bg-accent-soft text-accent border-accent/30 hover:bg-accent hover:text-white"
                )}
              >
                <Sparkles className={cn("w-2.5 h-2.5", isCleaningRam && "animate-spin")} />
                <span>{isCleaningRam ? (lang === "km" ? "សម្អាត..." : "Cleaning...") : (lang === "km" ? "សម្អាត RAM" : "Clean RAM")}</span>
              </button>
              <span className={cn("text-[10.5px] font-semibold tabular-nums", isCarbon ? "text-cyan-400" : "text-accent font-bold")}>
                {memTotal} MB
              </span>
            </div>
            <ProgressBar value={memPct} tone={memTone} />
            <div className={cn("mt-0.5 text-[9.5px] flex items-center justify-between", isCarbon ? "text-slate-400" : "text-ink-muted")}>
              <span>{t("sysmon.ramAllocated", { pct: String(memPct) })}</span>
              <span className={cn("text-[8.5px] font-medium", isCarbon ? "text-cyan-400/80 group-hover:text-cyan-300" : "text-accent/80 group-hover:text-accent")}>
                {t("sysmon.hoverForDetails")}
              </span>
            </div>

            {/* Floating Tooltip Breakdown on Mouse Hover */}
            <div className="absolute bottom-full left-0 right-0 mb-2 hidden group-hover:block z-50 p-2.5 rounded-xl bg-slate-900/95 text-white border border-white/15 shadow-2xl backdrop-blur-xl pointer-events-none transition-all duration-200 min-w-[235px]">
              <div className="text-[10px] font-bold text-slate-300 border-b border-white/10 pb-1 mb-1.5 flex items-center justify-between whitespace-nowrap gap-2">
                <span>⚡ {t("sysmon.liveMicroservices")}</span>
                <span className="text-emerald-400 font-mono font-bold">{t("sysmon.mbTotal", { mb: String(memTotal) })}</span>
              </div>
              <div className="space-y-1.5 text-[10px] font-mono">
                <div className="flex items-center justify-between text-slate-300 whitespace-nowrap">
                  <span className="flex items-center gap-1.5">🌐 <span>{t("sysmon.svcFrontend")}</span></span>
                  <span className="text-white font-bold">{mem?.frontendMb ?? 45} MB</span>
                </div>
                <div className="flex items-center justify-between text-slate-300 whitespace-nowrap">
                  <span className="flex items-center gap-1.5">⚙️ <span>{t("sysmon.svcTechnical")}</span></span>
                  <span className="text-emerald-400 font-bold">{mem?.technicalApiMb ?? 98} MB</span>
                </div>
                <div className="flex items-center justify-between text-slate-300 whitespace-nowrap">
                  <span className="flex items-center gap-1.5">🔑 <span>{t("sysmon.svcUserAuth")}</span></span>
                  <span className="text-teal-400 font-bold">{mem?.userManagementApiMb ?? 94} MB</span>
                </div>
                <div className="flex items-center justify-between text-slate-300 whitespace-nowrap">
                  <span className="flex items-center gap-1.5">👥 <span>{t("sysmon.svcCustomer")}</span></span>
                  <span className="text-cyan-400 font-bold">{mem?.customerEmployeeApiMb ?? 88} MB</span>
                </div>
              </div>
              <div className="mt-2 pt-1.5 border-t border-white/10 flex items-center justify-between text-[9px] text-slate-400">
                <span>V8 Memory Collector</span>
                <span className="text-emerald-400 font-semibold">Active & Monitored</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

const NavRow = memo(function NavRow({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
  compact = false,
  subItem = false,
  sidebarStyle = "classic",
  onNavigate,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
  collapsed: boolean;
  compact?: boolean;
  subItem?: boolean;
  sidebarStyle?: string;
  onNavigate?: () => void;
}) {
  const isCarbon = sidebarStyle === "carbon";
  const isEnterprise = sidebarStyle === "enterprise-erp";
  const isRadiant = sidebarStyle === "radiant";
  const isFloating = sidebarStyle === "floating";
  const isUntitled = sidebarStyle === "compact-rail";
  const isMotion = sidebarStyle === "motion-expansion";

  return (
    <div className="w-full">
    <Link
      href={href}
      prefetch={false}
      onMouseEnter={() => prefetchRouteData(href)}
      onFocus={() => prefetchRouteData(href)}
      onTouchStart={() => prefetchRouteData(href)}
      onClick={() => {
        onNavigate?.();
      }}
      title={collapsed ? label : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex items-center font-medium transition-all duration-150 ease-out select-none",
        isEnterprise
          ? subItem
            ? "rounded-xl px-3 py-1.5 text-xs"
            : "rounded-2xl px-3.5 py-2.5 text-xs lg:text-xs xl:text-sm shadow-xs min-h-[44px]"
          : isRadiant
          ? "rounded-2xl px-3 py-2.5 gap-3"
          : isMotion
          ? "rounded-xl px-3 py-2 gap-2.5"
          : "rounded-xl px-3 py-2 gap-3",
        subItem
          ? "text-[13px] gap-2.5 py-1"
          : compact
          ? "py-2 text-[13.5px] px-2.5"
          : "text-[13.5px] lg:text-[13.5px] xl:text-[14px]",
        // Text & Active styling
        isEnterprise
          ? active
            ? "text-white font-bold ring-1 ring-white/30"
            : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
        : isMotion
          ? active
            ? "bg-gradient-to-r from-accent/20 via-accent/10 to-transparent text-accent font-bold rounded-xl border-l-2 border-accent shadow-xs"
            : "text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-cushion dark:hover:bg-slate-850 rounded-xl"
        : isUntitled
          ? active
            ? "bg-accent text-white font-bold shadow-soft-sm rounded-xl"
            : "text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-cushion rounded-xl"
        : isRadiant
          ? active
            ? "bg-accent text-white font-bold shadow-[0_0_18px_rgba(var(--accent-rgb),0.38)]"
            : "text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-accent-soft/30"
        : isCarbon
          ? active
            ? "text-cyan-300 font-bold"
            : "text-slate-400 hover:text-slate-100 hover:bg-slate-850/80"
        : active
          ? "text-accent-soft-fg font-semibold"
          : "text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-cushion",
        collapsed && "justify-center px-0"
      )}
    >
      {/* ── Left Curved Bracket Badge for Top Home Item in ERP ── */}
      {isEnterprise && !collapsed && !subItem && (
        <span
          aria-hidden
          className={cn(
            "absolute left-1.5 top-1.5 bottom-1.5 w-5 rounded-l-xl border-l-2 border-t border-b pointer-events-none transition-colors",
            active
              ? "border-white/80 bg-white/10"
              : "border-accent/80 bg-gradient-to-r from-accent/15 to-transparent"
          )}
        />
      )}

      {/* ── Active Background Pill for ERP ── */}
      {active && isEnterprise && (
        <span
          aria-hidden
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{
            background: "linear-gradient(95deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 80%, white 20%) 55%, color-mix(in srgb, var(--accent) 65%, white 35%) 100%)",
            boxShadow: "0 4px 14px -2px rgba(var(--accent-rgb), 0.4)",
          }}
        />
      )}

      {/* ── Active Background Pill for classic, floating, carbon ── */}
      {active && !isEnterprise && !isUntitled && !isRadiant && !isMotion && (
        <motion.span
          aria-hidden
          layoutId="sidebar-active-pill"
          className={cn(
            "absolute inset-0 rounded-xl pointer-events-none",
            isCarbon
              ? "bg-cyan-500/15 border border-cyan-500/30 shadow-[0_0_12px_rgba(6,182,212,0.25)]"
              : isFloating
              ? "bg-accent/15 backdrop-blur-md border border-accent/30 shadow-xs"
              : "bg-accent-soft"
          )}
          transition={NAV_PILL_SPRING}
        />
      )}

      {/* ── Active Left Accent Bar ── */}
      {active && !isEnterprise && !isUntitled && !isRadiant && !isMotion && (
        <motion.span
          aria-hidden
          layoutId="sidebar-accent-bar"
          className={cn(
            "absolute pointer-events-none",
            isCarbon
              ? "left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-cyan-400"
              : "left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-accent"
          )}
          transition={NAV_ACCENT_SPRING}
        />
      )}

      <div className={cn("flex items-center gap-2.5 min-w-0", isEnterprise && !subItem && "pl-1")}>
        <Icon
          className={cn(
            "relative shrink-0 transition-colors",
            subItem ? "w-4 h-4" : compact ? "w-4 h-4" : "w-4 h-4 xl:w-5 xl:h-5",
            isEnterprise
              ? active
                ? "text-accent-fg"
                : "text-accent"
              : isCarbon && active
              ? "text-cyan-400"
              : isUntitled && active
              ? "text-white"
              : isRadiant && active
              ? "text-white"
              : active
              ? "text-accent"
              : "text-slate-600 dark:text-slate-400"
          )}
        />
        {!collapsed && (
          <span
            className={cn(
              "relative truncate leading-snug tracking-normal",
              active ? "font-bold" : "text-slate-700 dark:text-slate-200 font-medium"
            )}
          >
            {label}
          </span>
        )}
      </div>

      {!collapsed && isUntitled && active && (
        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white shrink-0" />
      )}
    </Link>
    </div>
  );
});

/** Collapsible Child Sub-Group Section for Structured Report Categories */
const SubGroupSection = memo(function SubGroupSection({
  subGroup,
  activeHref,
  collapsed,
  isExpanded,
  sidebarStyle = "classic",
  onToggle,
  onNavigate,
}: {
  subGroup: NavSubGroup;
  activeHref: string;
  collapsed: boolean;
  isExpanded: boolean;
  sidebarStyle?: string;
  onToggle: () => void;
  onNavigate?: () => void;
}) {
  const { t } = useI18n();
  const Icon = SUBGROUP_ICONS[subGroup.titleKey] ?? FileSpreadsheet;
  const hasActiveChild = subGroup.items.some((item) => item.href === activeHref);
  const isCarbon = sidebarStyle === "carbon";
  const isEnterprise = sidebarStyle === "enterprise-erp";
  const isUntitled = sidebarStyle === "compact-rail";
  const isRadiant = sidebarStyle === "radiant";

  if (collapsed) {
    return (
      <div className="space-y-1 py-1">
        {subGroup.items.map((item) => (
          <NavRow
            key={item.href}
            href={item.href}
            label={t(item.nameKey)}
            icon={ICONS[item.href] ?? FileSpreadsheet}
            active={activeHref === item.href}
            collapsed={collapsed}
            compact
            sidebarStyle={sidebarStyle}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    );
  }

  return (
    <div className={cn(
      "space-y-1 mb-1",
      isEnterprise && "rounded-xl border border-slate-200/80 dark:border-slate-800/80 p-1 bg-white/80 dark:bg-slate-900/80 mb-2",
      isUntitled && "rounded-xl border border-subtle/60 p-1 bg-cushion/40 mb-2"
    )}>
      {/* Subgroup Header Button */}
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "relative w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-[13.5px] font-semibold select-none",
          "transition-all duration-150 text-left cursor-pointer",
          isEnterprise
            ? hasActiveChild
              ? "text-accent bg-accent-soft font-bold"
              : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-850"
            : isUntitled
            ? hasActiveChild
              ? "text-accent bg-accent-soft font-bold"
              : "text-ink hover:text-ink hover:bg-cushion"
            : isRadiant
            ? hasActiveChild
              ? "text-accent bg-accent-soft/60 font-bold"
              : "text-ink-secondary hover:text-ink hover:bg-accent-soft/20"
            : isCarbon
            ? hasActiveChild
              ? "text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 font-bold"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-850"
            : hasActiveChild
            ? "text-accent bg-accent-soft/40 font-bold"
            : "text-ink-secondary hover:text-ink hover:bg-cushion"
        )}
      >
        {/* Left Curved Bracket for Enterprise */}
        {isEnterprise && (
          <span
            aria-hidden
            className="absolute left-1 top-1 bottom-1 w-5 rounded-l-lg border-l-2 border-t border-b border-accent/60 pointer-events-none bg-gradient-to-r from-accent/15 to-transparent"
          />
        )}

        <div className="flex items-center gap-2 min-w-0 truncate pl-1">
          <Icon
            className={cn(
              "w-4 h-4 shrink-0 transition-colors",
              isEnterprise
                ? "text-accent"
                : isCarbon
                ? hasActiveChild ? "text-cyan-400" : "text-slate-500"
                : isUntitled || isRadiant
                ? hasActiveChild ? "text-accent" : "text-ink-muted"
                : hasActiveChild ? "text-accent" : "text-ink-muted"
            )}
          />
          <span className="truncate tracking-normal">{t(subGroup.titleKey)}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={cn(
              "px-2 py-0.5 text-[11px] font-bold rounded-full tabular-nums leading-tight",
              isEnterprise
                ? hasActiveChild
                  ? "bg-accent text-accent-fg shadow-xs"
                  : "bg-accent-soft text-accent border border-accent/30"
                : isUntitled
                ? hasActiveChild
                  ? "bg-accent text-white"
                  : "bg-surface text-ink-muted border border-subtle"
                : isCarbon
                ? hasActiveChild
                  ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40"
                  : "bg-slate-800 text-slate-400 border border-slate-750"
                : hasActiveChild
                ? "bg-accent/20 text-accent"
                : "bg-surface-elevated text-ink-muted border border-subtle"
            )}
          >
            {subGroup.items.length}
          </span>
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className={isCarbon ? "text-slate-500" : isEnterprise ? "text-accent" : "text-ink-muted"}
          >
            <ChevronDown className="w-4 h-4" />
          </motion.div>
        </div>
      </button>

      {/* Collapsible Child Items List */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className={cn(
              "pl-2.5 ml-3 space-y-0.5 py-0.5",
              isCarbon ? "border-l-2 border-slate-800" : "border-l-2 border-subtle/80"
            )}>
              {subGroup.items.map((item) => (
                <NavRow
                  key={item.href}
                  href={item.href}
                  label={t(item.nameKey)}
                  icon={ICONS[item.href] ?? FileSpreadsheet}
                  active={activeHref === item.href}
                  collapsed={collapsed}
                  subItem
                  sidebarStyle={sidebarStyle}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default function Sidebar({
  isOpen,
  setIsOpen,
}: {
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
}) {
  const { prefs } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const collapsed = !isOpen;

  // Brand logo comes from the shared store (services/brandLogoStore) rather
  // than local state: the old fetch-then-setState here had no unmount guard,
  // and Sidebar remounts on every navigation. Publishing to the store after
  // an unmount is harmless, so there is nothing left to guard.
  const brandLogo = useBrandLogo();
  const [currentUser] = useState(() => readStoredUser());
  const [activeFlyoutGroup, setActiveFlyoutGroup] = useState<string | null>(null);
  const [flyoutSearch, setFlyoutSearch] = useState("");
  const [inSidebarSearch, setInSidebarSearch] = useState("");
  const [dualSelectedDomain, setDualSelectedDomain] = useState<string>("operations");
  const [dualSearch, setDualSearch] = useState("");
  const [motionFlyout, setMotionFlyout] = useState<{ titleKey: string; top: number } | null>(null);

  // Track single selected key in Enterprise ERP mode with smooth Framer Motion transition
  const [selectedErpKey, setSelectedErpKey] = useState<string>(() => (pathname === "/" ? "home" : ""));

  const { hasPermission } = useUserPermissions();

  // Dynamically filter navigation groups based on current user's role permissions
  const filteredNavGroups = React.useMemo(() => {
    return NAV_GROUPS.map((group) => {
      // 1. Filter top-level items in this group
      const filteredItems = group.items?.filter((item) => {
        if (item.requiredRoles && !hasAnyRole(item.requiredRoles)) return false;
        if (item.requiredModule && !hasPermission(item.requiredModule)) return false;
        return true;
      });

      // 2. Filter sub-groups in this group
      const filteredSubGroups = group.subGroups
        ?.map((sub) => {
          if (sub.requiredRoles && !hasAnyRole(sub.requiredRoles)) return null;
          if (sub.requiredModule && !hasPermission(sub.requiredModule)) return null;
          const subItems = sub.items.filter((item) => {
            if (item.requiredRoles && !hasAnyRole(item.requiredRoles)) return false;
            if (item.requiredModule && !hasPermission(item.requiredModule)) return false;
            return true;
          });
          if (subItems.length === 0) return null;
          return { ...sub, items: subItems };
        })
        .filter((sub): sub is NonNullable<typeof sub> => sub !== null);

      if (group.requiredRoles && !hasAnyRole(group.requiredRoles)) return null;
      if (group.requiredModule && !hasPermission(group.requiredModule)) return null;

      const hasItems = Boolean(filteredItems && filteredItems.length > 0);
      const hasSubs = Boolean(filteredSubGroups && filteredSubGroups.length > 0);
      if (!hasItems && !hasSubs) return null;

      return {
        ...group,
        items: filteredItems,
        subGroups: filteredSubGroups,
      };
    }).filter((g): g is NonNullable<typeof g> => g !== null);
  }, [hasPermission]);

  // Dynamically filter DUAL_DOMAINS for dual sidebar mode
  const filteredDualDomains = React.useMemo(() => {
    return DUAL_DOMAINS.map((dom) => {
      if (!dom.items) return dom;
      const filteredItems = dom.items.filter((item) => {
        const nav = findNavItem(item.href);
        if (!nav) return true;
        if (nav.requiredRoles && !hasAnyRole(nav.requiredRoles)) return false;
        if (nav.requiredModule && !hasPermission(nav.requiredModule)) return false;
        return true;
      });
      return { ...dom, items: filteredItems };
    }).filter((dom) => dom.directHref || (dom.items && dom.items.length > 0));
  }, [hasPermission]);

  useEffect(() => {
    // Refresh the stored logo from the server once per mount; the store
    // fans the result out to every subscriber (login page included).
    fetchAppLogoUrl().then((url) => {
      if (url) publishBrandLogo(url);
    }).catch(() => {});
  }, []);

  const [prevPathname, setPrevPathname] = useState(pathname);
  const [optimisticPath, setOptimisticPath] = useState<string | null>(null);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setOptimisticPath(null);
  }

  const activeHref = optimisticPath || pathname;

  const [openParentGroups, setOpenParentGroups] = useState<Record<string, boolean>>(
    () => savedOpenParentGroups
  );

  const [openSubgroups, setOpenSubgroups] = useState<Record<string, boolean>>(
    () => savedOpenSubgroups
  );

  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (navRef.current && savedSidebarScrollTop > 0) {
      navRef.current.scrollTop = savedSidebarScrollTop;
    }
  }, []);

  const handleScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
    savedSidebarScrollTop = e.currentTarget.scrollTop;
  }, []);

  // Update dualSelectedDomain, selectedErpKey, and auto-expand parent group containing active link
  useEffect(() => {
    // 1. Synchronize Dual-Column Mega Sidebar Domain
    if (activeHref === "/") {
      setDualSelectedDomain("home");
      setSelectedErpKey("home");
      return;
    }

    for (const dom of filteredDualDomains) {
      if (dom.directHref === activeHref || dom.items?.some((i) => i.href === activeHref)) {
        setDualSelectedDomain(dom.id);
        break;
      }
    }

    // 2. Synchronize Parent Groups & Subgroups
    for (const group of filteredNavGroups) {
      let isInsideGroup = group.items?.some((i) => i.href === activeHref);
      if (group.subGroups) {
        for (const sub of group.subGroups) {
          if (sub.items.some((item) => item.href === activeHref)) {
            isInsideGroup = true;
            setOpenSubgroups((prev) => {
              if (prev[sub.titleKey]) return prev;
              const next = { ...prev, [sub.titleKey]: true };
              savedOpenSubgroups = next;
              return next;
            });
            break;
          }
        }
      }
      if (isInsideGroup) {
        setSelectedErpKey(group.titleKey);
        setOpenParentGroups((prev) => {
          if (prev[group.titleKey]) return prev;
          const next = { ...prev, [group.titleKey]: true };
          savedOpenParentGroups = next;
          return next;
        });
      }
    }
  }, [activeHref, filteredNavGroups, filteredDualDomains]);

  const toggleParentGroup = useCallback((key: string) => {
    setOpenParentGroups((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      savedOpenParentGroups = next;
      return next;
    });
  }, []);

  const toggleSubgroup = useCallback((key: string) => {
    setOpenSubgroups((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      savedOpenSubgroups = next;
      return next;
    });
  }, []);

  useActionHandler("ui.sidebar.collapse", () => {
    setIsOpen(false);
    return true;
  });
  useActionHandler("ui.sidebar.expand", () => {
    setIsOpen(true);
    return true;
  });
  useActionHandler("ui.sidebar.toggle", () => {
    setIsOpen(!isOpen);
    return true;
  });

  useEffect(() => {
    if (window.matchMedia("(max-width: 1023px)").matches) setIsOpen(false);
  }, [setIsOpen]);

  const handleNavRowClick = useCallback(() => {
    if (window.matchMedia("(max-width: 1023px)").matches) setIsOpen(false);
    setActiveFlyoutGroup(null);
  }, [setIsOpen]);

  const handleNavigate = useCallback(
    (href: string) => {
      if (window.matchMedia("(max-width: 1023px)").matches) setIsOpen(false);
      setActiveFlyoutGroup(null);
      if (href === pathname) return;
      router.push(href);
    },
    [setIsOpen, pathname, router]
  );

  const sidebarStyle = prefs.sidebarStyle || "classic";
  const isRail = sidebarStyle === "compact-rail";
  const isFloating = sidebarStyle === "floating";
  const isDual = sidebarStyle === "dual-column";
  const isCarbon = sidebarStyle === "carbon";
  const isEnterprise = sidebarStyle === "enterprise-erp";
  const isRadiant = sidebarStyle === "radiant";
  const isMotion = sidebarStyle === "motion-expansion";

  /**
   * `av-sidebar-enter`, but only the first time the app paints — never again.
   *
   * The sidebar is not a persistent shell here: every page renders its own
   * `PageWrapper`, so React unmounts and remounts this component on EVERY
   * navigation. Measured, not assumed — the `<aside>` after a route change is a
   * different DOM node, which means an unconditional entrance class re-runs its
   * keyframes on every single menu click. That is what made the chrome look
   * restless: the frame around the app kept re-introducing itself while only the
   * content inside it was supposed to be changing.
   *
   * A module-scope flag rather than state, for the same reason
   * `services/sidebarPreference.ts` uses one: it has to outlive the unmount, and
   * component state cannot.
   *
   * The flag is read into a ref during render because the class must already be
   * on the element in its first committed frame — an effect runs after paint,
   * which is too late for an entrance. Setting the flag stays in the effect so
   * render itself has no side effect.
   *
   * Dev-only caveat: React StrictMode mounts, unmounts and remounts once, so the
   * flag is spent on the discarded first mount and the fade is skipped in dev.
   * Production mounts once and plays it.
   */
  /**
   * ...and yet the fade plays on EVERY mount, not just the first. That is a
   * deliberate reversal, and the reason is worth writing down so it is not
   * "cleaned up" again.
   *
   * Gating it to the first mount was tried and made clicking a menu item feel
   * WORSE, not better. The active highlight is two framer shared-layout
   * elements — `layoutId="sidebar-active-pill"` and `layoutId="sidebar-accent-bar"`
   * further down this file. A `layoutId` transition can only interpolate when
   * the old and the new element are both inside a tree that stayed mounted
   * across the change. This sidebar does not: it is remounted wholesale on every
   * navigation (verified — the `<aside>` is a different DOM node afterwards),
   * so framer has no previous snapshot to animate from and the pill TELEPORTS
   * to its new row instead of sliding to it.
   *
   * The fade was never really an entrance. It was covering that teleport, and
   * removing it did not create the jank — it uncovered it.
   *
   * So this is a mask, honestly labelled as one. The actual fix is to stop the
   * shell remounting: move Sidebar + Header into a shared layout above the
   * pages, at which point the pill genuinely travels and this class can go back
   * to firing once, or drop away entirely.
   * Note `PageWrapper`'s own comments before attempting it — the sidebar's
   * collapsed width currently avoids a first-paint flash only because AuthGuard
   * keeps the shell out of the server HTML.
   */
  const entranceClass = "av-sidebar-enter";

  const currentFlyoutCategory = RAIL_CATEGORIES.find((c) => c.id === activeFlyoutGroup);
  const currentDomain = filteredDualDomains.find((d) => d.id === dualSelectedDomain) || filteredDualDomains[1] || filteredDualDomains[0];

  // ══════════════════════════════════════════════════════════════════════════
  // DISTINCT EXPANDED TEMPLATE RENDERERS
  // ══════════════════════════════════════════════════════════════════════════

  // ── 0. KINETIC MORPHING EXPANSION (ROBIN HOLESINSKY DRIBBBLE MASTERPIECE) ──
  const renderMotionExpansion = () => (
    <div className="h-full w-full rounded-[28px] xl:rounded-[32px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] flex flex-col relative select-none overflow-visible">
      {/* Floating Morph Pin Toggle Button on the Right Edge (Exact Match!) */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title={isOpen ? "Collapse Sidebar" : "Expand Sidebar"}
        className="hidden lg:flex absolute -right-3 top-6 z-50 w-6 h-6 rounded-full bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-sm items-center justify-center cursor-pointer text-slate-400 hover:text-slate-800 dark:hover:text-white hover:scale-110 active:scale-95 transition-all duration-200 group"
      >
        {isOpen ? (
          <ChevronLeft className="w-3.5 h-3.5 group-hover:text-slate-800 dark:group-hover:text-white transition-colors" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 group-hover:text-slate-800 dark:group-hover:text-white transition-colors" />
        )}
      </button>

      {/* 1. Header Profile & Geometric Logo */}
      <div className={cn(
        "h-14 px-3.5 flex items-center shrink-0 transition-all",
        isOpen ? "justify-start" : "justify-center"
      )}>
        <Link href="/" className="flex items-center gap-2.5 overflow-hidden min-w-0 group">
          {brandLogo ? (
            <span className="w-8 h-8 rounded-xl grid place-items-center shrink-0 overflow-hidden bg-gradient-to-br from-white via-white to-accent-soft/40 border border-accent/30 shadow-soft-sm p-1 group-hover:border-accent transition-all duration-200">
              <BrandLogo
                src={brandLogo}
                alt="Logo"
                style={{ transform: `scale(${(prefs.logoScale ?? 130) / 100})` }}
                className="w-full h-full object-contain drop-shadow-xs"
              />
            </span>
          ) : (
            <div className="w-7 h-7 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center font-black text-xs shadow-xs group-hover:scale-105 transition-transform">
              ✦
            </div>
          )}
          {isOpen && (
            <div className="flex flex-col min-w-0">
              <span className="font-bold tracking-tight text-[11.5px] text-slate-900 dark:text-slate-100 leading-none truncate">
                {t("app.brand")}
              </span>
              <span className="text-[8.5px] font-semibold tracking-wider uppercase mt-0.5 truncate text-slate-400">
                {t("app.brandTagline")}
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* 2. Sleek Rounded Search Bar */}
      <div className="px-2.5 pb-2 shrink-0">
        {isOpen ? (
          <button
            type="button"
            onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }))}
            className="w-full h-8 px-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors shadow-xs group cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200" />
              <span className="font-medium text-[11px]">Search</span>
            </div>
            <div className="flex items-center gap-0.5 text-[8.5px] font-mono font-bold text-slate-400 bg-white dark:bg-slate-700 border border-slate-200/60 dark:border-slate-600 px-1.5 py-0.5 rounded-md">
              ⌘ S
            </div>
          </button>
        ) : (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }))}
              title="Search (⌘S)"
              className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-700/60 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer shadow-xs"
            >
              <Search className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* 3. Navigation Tree Body */}
      <nav
        ref={navRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-2.5 space-y-0.5 scrollbar-none"
      >
        {/* Section Tag */}
        <div className={cn("text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1 mt-0.5 px-1", !isOpen && "text-center")}>
          {isOpen ? "Main" : "•••"}
        </div>

        {/* Dashboard (Home) */}
        {isOpen ? (
          <button
            type="button"
            onClick={() => handleNavigate("/")}
            className={cn(
              "w-full flex items-center justify-between px-2 py-1.5 rounded-xl text-[11.5px] font-semibold transition-all cursor-pointer",
              activeHref === "/"
                ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold shadow-xs"
                : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className={cn(
                "w-6 h-6 rounded-lg flex items-center justify-center",
                activeHref === "/"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
              )}>
                <Home className="w-3.5 h-3.5" />
              </div>
              <span className="truncate">{t(HOME_ITEM.nameKey)}</span>
            </div>
          </button>
        ) : (
          <div className="flex justify-center group relative">
            <button
              type="button"
              onClick={() => handleNavigate("/")}
              title={t(HOME_ITEM.nameKey)}
              className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer relative",
                activeHref === "/"
                  ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs ring-1 ring-slate-200 dark:ring-slate-700"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800"
              )}
            >
              <Home className="w-4 h-4" />
            </button>
            <div className="absolute left-full ml-3 px-2.5 py-1 rounded-lg bg-slate-900 text-white text-xs font-semibold whitespace-nowrap shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
              {t(HOME_ITEM.nameKey)}
            </div>
          </div>
        )}

        {/* Parent Groups with L-Shaped Tree Hierarchy */}
        {filteredNavGroups.map((group) => {
          const GroupIcon = GROUP_ICONS[group.titleKey] ?? Package;
          const isParentOpen = openParentGroups[group.titleKey] ?? false;
          const isAnyChildActive =
            group.items?.some((i) => i.href === activeHref) ||
            group.subGroups?.some((s) => s.items.some((i) => i.href === activeHref));

          if (!isOpen) {
            // Collapsed Rail Icon with Floating Submenu Trigger
            const isFlyoutOpen = motionFlyout?.titleKey === group.titleKey;
            return (
              <div
                key={group.titleKey}
                className="relative flex justify-center py-0.5"
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setMotionFlyout({ titleKey: group.titleKey, top: rect.top });
                }}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    if (isFlyoutOpen) {
                      setMotionFlyout(null);
                    } else {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setMotionFlyout({ titleKey: group.titleKey, top: rect.top });
                    }
                  }}
                  className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer relative",
                    isAnyChildActive || isFlyoutOpen
                      ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs ring-1 ring-slate-200 dark:ring-slate-700"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800"
                  )}
                >
                  <GroupIcon className="w-4 h-4" />
                  {isAnyChildActive && (
                    <span className="absolute right-1 top-1 w-1.5 h-1.5 rounded-full bg-accent" />
                  )}
                </button>
              </div>
            );
          }

          // Expanded Mode
          return (
            <div key={group.titleKey} className="space-y-0.5">
              <button
                type="button"
                onClick={() => toggleParentGroup(group.titleKey)}
                className="w-full flex items-center justify-between px-2 py-1.5 rounded-xl text-[11.5px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-850/50 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className={cn(
                    "w-6 h-6 rounded-lg flex items-center justify-center transition-colors",
                    isParentOpen || isAnyChildActive
                      ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                      : "bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400"
                  )}>
                    <GroupIcon className="w-3.5 h-3.5" />
                  </div>
                  <span className="truncate">
                    {t(group.titleKey)}
                  </span>
                </div>
                <ChevronDown className={cn(
                  "w-3 h-3 text-slate-400 transition-transform duration-200",
                  isParentOpen && "rotate-180"
                )} />
              </button>

              {/* L-Shaped Branch Connectors for Sub-Items */}
              {isParentOpen && (
                <div className="relative ml-5 pl-3.5 space-y-0.5 mt-0.5 mb-1.5">
                  {/* Continuous vertical guide line */}
                  <div className="absolute left-0 top-0 bottom-2.5 w-[1.5px] bg-slate-200 dark:bg-slate-700 pointer-events-none" />

                  {group.items?.map((item) => {
                    const active = activeHref === item.href;
                    return (
                      <div key={item.href} className="relative">
                        {/* L-curve connector */}
                        <span className="absolute -left-3.5 top-1/2 -translate-y-1/2 w-3 h-3 border-b-[1.5px] border-l-[1.5px] rounded-bl-lg border-slate-200 dark:border-slate-700 pointer-events-none" />
                        <Link
                          href={item.href}
                          prefetch={false}
                          onMouseEnter={() => prefetchRouteData(item.href)}
                          onFocus={() => prefetchRouteData(item.href)}
                          onClick={() => {
                            if (window.matchMedia("(max-width: 1023px)").matches) setIsOpen(false);
                            setActiveFlyoutGroup(null);
                          }}
                          className={cn(
                            "w-full text-left px-2.5 py-1 rounded-lg text-[11px] font-normal transition-all cursor-pointer block",
                            active
                              ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold shadow-xs"
                              : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                          )}
                        >
                          <span className="truncate block">{t(item.nameKey)}</span>
                        </Link>
                      </div>
                    );
                  })}

                  {group.subGroups?.map((subGroup) => (
                    <SubGroupSection
                      key={subGroup.titleKey}
                      subGroup={subGroup}
                      activeHref={activeHref}
                      collapsed={false}
                      isExpanded={openSubgroups[subGroup.titleKey] ?? false}
                      sidebarStyle="motion-expansion"
                      onToggle={() => toggleSubgroup(subGroup.titleKey)}
                      onNavigate={handleNavRowClick}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* 4. Bottom System Health & User Profile Card */}
      <div className={cn(
        "p-2.5 border-t border-slate-100 dark:border-slate-800 mt-auto shrink-0 space-y-2",
        !isOpen && "flex flex-col items-center"
      )}>
        <HealthWidget collapsed={!isOpen} sidebarStyle="motion-expansion" />

        {isOpen ? (
          <button
            type="button"
            onClick={() => handleNavigate("/settings")}
            className="w-full p-1.5 rounded-xl bg-slate-50/80 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-100/80 dark:border-slate-800 flex items-center justify-between transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-750 flex items-center justify-center text-[10px] font-bold text-slate-800 dark:text-slate-100 ring-1 ring-white dark:ring-slate-800">
                {currentUser.picture ? (
                  <BrandLogo src={currentUser.picture} alt={currentUser.name} className="w-full h-full object-cover rounded-full" />
                ) : (
                  currentUser.name.slice(0, 2).toUpperCase()
                )}
              </div>
              <div className="flex flex-col text-left min-w-0">
                <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100 truncate leading-tight">{currentUser.name}</span>
                <span className="text-[9px] text-slate-400 font-medium truncate">{currentUser.role}</span>
              </div>
            </div>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>
        ) : (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => handleNavigate("/settings")}
              title={currentUser.name}
              className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-750 flex items-center justify-center text-[10px] font-bold text-slate-800 dark:text-slate-100 ring-1 ring-white dark:ring-slate-800 cursor-pointer hover:ring-accent transition-all"
            >
              {currentUser.name.slice(0, 2).toUpperCase()}
            </button>
          </div>
        )}
      </div>

      {/* 5. Unclipped Floating Submenu Popover in Collapsed Mode (Image 3!) */}
      {!isOpen && motionFlyout && (() => {
        const activeGroup = filteredNavGroups.find((g) => g.titleKey === motionFlyout.titleKey);
        if (!activeGroup) return null;
        /*
          `top` used to be clamped to `innerHeight - 280`, i.e. on the
          assumption that no flyout is ever taller than 280px. Repair
          Operations has ten entries and renders around 430px, and the panel is
          `fixed` with no cap and no scroll — so on a 1366x768 laptop (~625px
          of viewport) a group opened low on the rail put its last entries past
          the bottom edge with no way to reach them.

          Clamped against a real minimum instead, and paired with a
          `maxHeight` computed from wherever it lands, so the panel is always
          fully on screen and scrolls internally when the group is long.
        */
        const flyGutter = 16;
        const flyViewport = typeof window !== "undefined" ? window.innerHeight : 800;
        const flyMinHeight = Math.min(420, flyViewport - flyGutter * 2);
        const flyTop = Math.max(
          flyGutter,
          Math.min(flyViewport - flyGutter - flyMinHeight, motionFlyout.top - 6)
        );
        return (
          <div
            onMouseEnter={() => {}}
            onMouseLeave={() => setMotionFlyout(null)}
            style={{
              top: `${flyTop}px`,
              maxHeight: `${flyViewport - flyGutter - flyTop}px`,
            }}
            className="fixed left-[84px] z-[9999] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-[0_12px_40px_rgba(0,0,0,0.15)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.6)] p-3 min-w-[175px] max-w-[240px] overflow-y-auto overscroll-contain animate-in fade-in zoom-in-95 duration-150 select-none pointer-events-auto"
          >
            <div className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 mb-2 px-1 border-b border-slate-100 dark:border-slate-800 pb-1 flex items-center justify-between">
              <span>{t(activeGroup.titleKey)}</span>
            </div>
            <div className="relative pl-3 space-y-0.5">
              <div className="absolute left-0 top-0 bottom-2.5 w-[1.5px] bg-slate-200 dark:bg-slate-700 pointer-events-none" />
              {activeGroup.items?.map((item) => {
                const active = activeHref === item.href;
                return (
                  <div key={item.href} className="relative">
                    <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 border-b-[1.5px] border-l-[1.5px] rounded-bl-md border-slate-200 dark:border-slate-700 pointer-events-none" />
                    <Link
                      href={item.href}
                      prefetch={false}
                      onMouseEnter={() => prefetchRouteData(item.href)}
                      onFocus={() => prefetchRouteData(item.href)}
                      onClick={() => {
                        setMotionFlyout(null);
                        if (window.matchMedia("(max-width: 1023px)").matches) setIsOpen(false);
                      }}
                      className={cn(
                        "w-full text-left px-2 py-1 rounded-lg text-[11px] font-normal transition-all cursor-pointer block",
                        active
                          ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold shadow-xs"
                          : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      )}
                    >
                      <span className="truncate block">{t(item.nameKey)}</span>
                    </Link>
                  </div>
                );
              })}

              {activeGroup.subGroups?.map((subGroup) => (
                <div key={subGroup.titleKey} className="pt-1">
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider px-1 mb-0.5">
                    {t(subGroup.titleKey)}
                  </div>
                  {subGroup.items.map((item) => {
                    const active = activeHref === item.href;
                    return (
                      <div key={item.href} className="relative">
                        <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 border-b-[1.5px] border-l-[1.5px] rounded-bl-md border-slate-200 dark:border-slate-700 pointer-events-none" />
                        <Link
                          href={item.href}
                          prefetch={false}
                          onMouseEnter={() => prefetchRouteData(item.href)}
                          onFocus={() => prefetchRouteData(item.href)}
                          onClick={() => {
                            setMotionFlyout(null);
                            if (window.matchMedia("(max-width: 1023px)").matches) setIsOpen(false);
                          }}
                          className={cn(
                            "w-full text-left px-2 py-1 rounded-lg text-[11px] font-normal transition-all cursor-pointer block",
                            active
                              ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold shadow-xs"
                              : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                          )}
                        >
                          <span className="truncate block">{t(item.nameKey)}</span>
                        </Link>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );

  // ── 1. UNTITLED UI EXPANDED WORKSPACE (Like Image 2!) ──
  const renderUntitledUIExpanded = () => (
    <div className="flex-1 flex flex-col min-h-0 bg-surface">
      {/* Workspace Switcher Header Card */}
      <div className="p-3 border-b border-subtle">
        <div className="p-2 rounded-2xl bg-cushion/80 border border-subtle flex items-center justify-between gap-2.5 hover:border-accent/40 transition-all cursor-pointer">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-xl bg-accent text-white font-bold text-xs grid place-items-center shrink-0 shadow-xs">
              {brandLogo ? (
                <BrandLogo src={brandLogo} alt="Logo" className="w-full h-full object-contain p-0.5 rounded-xl" />
              ) : (
                "CAM"
              )}
            </span>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-ink truncate leading-tight">CAMPROTEC</span>
              <span className="text-[10px] text-ink-muted truncate">Service Workspace</span>
            </div>
          </div>
          <ChevronsUpDown className="w-4 h-4 text-ink-muted shrink-0" />
        </div>

        {/* In-sidebar Quick Search Input */}
        <div className="relative mt-2.5">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            type="text"
            placeholder="Search pages, reports (⌘K)..."
            value={inSidebarSearch}
            onChange={(e) => setInSidebarSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-cushion border border-subtle focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      </div>

      {/* Nav Menu */}
      <nav
        ref={navRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-3 space-y-3"
      >
        <NavRow
          href="/"
          label={t(HOME_ITEM.nameKey)}
          icon={Home}
          active={activeHref === "/"}
          collapsed={false}
          sidebarStyle={sidebarStyle}
          onNavigate={handleNavRowClick}
        />

        {filteredNavGroups.map((group) => {
          const itemCount =
            (group.items?.length || 0) +
            (group.subGroups?.reduce((acc, s) => acc + s.items.length, 0) || 0);

          return (
            <div key={group.titleKey} className="space-y-1">
              <div className="flex items-center justify-between px-2 text-[11.5px] lg:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                <span>{t(group.titleKey)}</span>
                <span className="px-1.5 py-0.5 rounded-md bg-cushion dark:bg-slate-800 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                  {itemCount}
                </span>
              </div>
              {group.items?.map((item) => (
                <NavRow
                  key={item.href}
                  href={item.href}
                  label={t(item.nameKey)}
                  icon={ICONS[item.href] ?? FileText}
                  active={activeHref === item.href}
                  collapsed={false}
                  compact
                  sidebarStyle={sidebarStyle}
                  onNavigate={handleNavRowClick}
                />
              ))}
              {group.subGroups?.map((subGroup) => (
                <SubGroupSection
                  key={subGroup.titleKey}
                  subGroup={subGroup}
                  activeHref={activeHref}
                  collapsed={false}
                  isExpanded={openSubgroups[subGroup.titleKey] ?? false}
                  sidebarStyle={sidebarStyle}
                  onToggle={() => toggleSubgroup(subGroup.titleKey)}
                  onNavigate={handleNavRowClick}
                />
              ))}
            </div>
          );
        })}
      </nav>

      {/* User Profile Card & System Health Footer */}
      <div className="p-3 border-t border-subtle dark:border-slate-800 bg-cushion/30 dark:bg-slate-950/40 space-y-2 shrink-0">
        <HealthWidget collapsed={false} sidebarStyle="compact-rail" />

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-accent text-white font-bold text-xs grid place-items-center shrink-0 shadow-xs ring-2 ring-accent/20">
              {currentUser.picture ? (
                <BrandLogo src={currentUser.picture} alt={currentUser.name} className="w-full h-full object-cover rounded-full" />
              ) : (
                currentUser.name.slice(0, 2).toUpperCase()
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate leading-tight">{currentUser.name}</span>
              <span className="text-[10px] text-accent font-medium truncate">{currentUser.role}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleNavigate("/settings")}
            title="Settings"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-cushion dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  // ── 2. ENTERPRISE ERP PRO (DYNAMIC BRANDING ACCENT COLOR ADAPTIVE!) ──
  const renderEnterpriseErpExpanded = () => (
    <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
      {/* Authentic System Brand Profile Header */}
      <div className="h-14 lg:h-14 xl:h-16 px-3.5 flex items-center justify-between shrink-0 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
        <Link href="/" className="flex items-center gap-2.5 overflow-hidden min-w-0">
          <span className="w-8 h-8 lg:w-8 lg:h-8 xl:w-9 xl:h-9 rounded-xl grid place-items-center shrink-0 overflow-hidden bg-gradient-to-br from-white via-white to-accent-soft border border-accent/25 shadow-soft-sm p-1">
            {brandLogo ? (
              <BrandLogo
                src={brandLogo}
                alt="Logo"
                style={{ transform: `scale(${(prefs.logoScale ?? 130) / 100})` }}
                className="w-full h-full object-contain drop-shadow-xs transition-transform duration-200"
              />
            ) : (
              <Leaf className="w-4 h-4 text-accent" />
            )}
          </span>
          <span className="flex flex-col min-w-0">
            <span className="font-bold tracking-tight text-xs lg:text-xs xl:text-sm text-slate-800 dark:text-slate-100 leading-none truncate">
              {t("app.brand")}
            </span>
            <span className="text-[9px] font-semibold tracking-wider uppercase mt-1 truncate text-accent">
              {t("app.brandTagline")}
            </span>
          </span>
        </Link>

        {/* Quick Collapse Button */}
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          title="Collapse Sidebar"
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Nav List with Uniform Button Dimensions & Moving Active Capsule */}
      <nav
        ref={navRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-2.5 py-2.5 space-y-1.5"
      >
        {/* Top Home / Dashboard link (Same uniform size as parent rows) */}
        <div className="relative">
          <Link
            href="/"
            onClick={(e) => {
              if (
                e.metaKey ||
                e.ctrlKey ||
                e.shiftKey ||
                e.altKey ||
                e.button !== 0
              ) {
                return;
              }
              setSelectedErpKey("home");
              if (window.matchMedia("(max-width: 1023px)").matches) setIsOpen(false);
              setActiveFlyoutGroup(null);
            }}
            className={cn(
              "relative flex items-center justify-between font-semibold transition-all duration-150 ease-out select-none rounded-2xl px-3 py-2 text-[12.5px] lg:text-[13px] min-h-[44px]",
              selectedErpKey === "home"
                ? "text-accent-fg shadow-md shadow-accent/20"
                : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
          >
            {selectedErpKey === "home" && (
              <motion.div
                layoutId="erp-active-capsule"
                className="absolute inset-0 rounded-2xl ring-1 ring-white/30 pointer-events-none"
                style={{
                  background: "linear-gradient(95deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 80%, white 20%) 55%, color-mix(in srgb, var(--accent) 65%, white 35%) 100%)",
                  boxShadow: "0 6px 18px -2px rgba(var(--accent-rgb), 0.45)",
                }}
                transition={{ type: "spring", stiffness: 450, damping: 32 }}
              />
            )}

            {/* Left Curved Bracket Accent */}
            <span
              aria-hidden
              className={cn(
                "absolute left-1.5 top-1.5 bottom-1.5 w-5 rounded-l-xl border-l-2 border-t border-b pointer-events-none transition-colors z-10",
                selectedErpKey === "home"
                  ? "border-white/80 bg-white/10"
                  : "border-accent/80 bg-gradient-to-r from-accent/15 to-transparent"
              )}
            />

            <div className="relative flex items-center gap-2 min-w-0 pl-1 z-10 flex-1">
              <Home
                className={cn(
                  "w-4 h-4 shrink-0 transition-colors",
                  selectedErpKey === "home" ? "text-accent-fg" : "text-accent"
                )}
              />
              <span className="truncate tracking-tight">{t(HOME_ITEM.nameKey)}</span>
            </div>
          </Link>
        </div>

        {/* Parent Module Groups with Matching Uniform Height and Animated Selection Capsule */}
        {filteredNavGroups.map((group) => {
          const GroupIcon = GROUP_ICONS[group.titleKey] ?? Package;
          const isExpanded = openParentGroups[group.titleKey] ?? false;
          const isSelected = selectedErpKey === group.titleKey;

          const itemCount =
            (group.items?.length || 0) +
            (group.subGroups?.reduce((acc, s) => acc + s.items.length, 0) || 0);

          return (
            <div key={group.titleKey} className="space-y-0.5">
              {/* Parent Accordion Button (Uniform size as Home Dashboard) */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedErpKey(group.titleKey);
                    toggleParentGroup(group.titleKey);
                  }}
                  className={cn(
                    "relative w-full flex items-center justify-between gap-2 px-3 py-2 rounded-2xl text-[12.5px] lg:text-[13px] font-semibold select-none transition-all cursor-pointer min-h-[44px]",
                    isSelected
                      ? "text-accent-fg shadow-md shadow-accent/20"
                      : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  )}
                >
                  {isSelected && (
                    <motion.div
                      layoutId="erp-active-capsule"
                      className="absolute inset-0 rounded-2xl ring-1 ring-white/30 pointer-events-none"
                      style={{
                        background: "linear-gradient(95deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 80%, white 20%) 55%, color-mix(in srgb, var(--accent) 65%, white 35%) 100%)",
                        boxShadow: "0 6px 18px -2px rgba(var(--accent-rgb), 0.45)",
                      }}
                      transition={{ type: "spring", stiffness: 450, damping: 32 }}
                    />
                  )}

                  {/* ── Curved Left Bracket Accent ── */}
                  <span
                    aria-hidden
                    className={cn(
                      "absolute left-1.5 top-1.5 bottom-1.5 w-5 rounded-l-xl border-l-2 border-t border-b pointer-events-none transition-colors z-10",
                      isSelected
                        ? "border-white/90 bg-white/15"
                        : "border-accent/80 bg-gradient-to-r from-accent/15 to-transparent"
                    )}
                  />

                  <div className="relative flex items-center gap-2 min-w-0 pl-1 z-10 flex-1">
                    <GroupIcon
                      className={cn(
                        "w-4 h-4 shrink-0 transition-colors",
                        isSelected ? "text-accent-fg" : "text-accent"
                      )}
                    />
                    <span className="truncate tracking-tight">{t(group.titleKey)}</span>
                  </div>

                  <div className="relative flex items-center gap-1.5 shrink-0 z-10">
                    {/* Item Count Badge */}
                    <span
                      className={cn(
                        "px-2 py-0.5 text-[10px] font-bold rounded-full tabular-nums leading-tight shadow-xs transition-colors",
                        isSelected
                          ? "bg-white/25 text-white border border-white/40"
                          : "bg-accent-soft text-accent border border-accent/30"
                      )}
                    >
                      {itemCount}
                    </span>
                    {/* Chevron Right (rotates 90 deg down when open) */}
                    <ChevronRight
                      className={cn(
                        "w-3.5 h-3.5 transition-transform duration-200 shrink-0",
                        isExpanded ? "rotate-90" : "",
                        isSelected ? "text-accent-fg" : "text-slate-400"
                      )}
                    />
                  </div>
                </button>
              </div>

              {/* Children Items */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="pl-3 space-y-0.5 py-0.5 border-l-2 border-accent/25 dark:border-accent/30 ml-4">
                      {group.items?.map((item) => (
                        <NavRow
                          key={item.href}
                          href={item.href}
                          label={t(item.nameKey)}
                          icon={ICONS[item.href] ?? FileText}
                          active={activeHref === item.href}
                          collapsed={false}
                          subItem
                          compact
                          sidebarStyle="enterprise-erp"
                          onNavigate={handleNavRowClick}
                        />
                      ))}
                      {group.subGroups?.map((subGroup) => (
                        <SubGroupSection
                          key={subGroup.titleKey}
                          subGroup={subGroup}
                          activeHref={activeHref}
                          collapsed={false}
                          isExpanded={openSubgroups[subGroup.titleKey] ?? false}
                          sidebarStyle="enterprise-erp"
                          onToggle={() => toggleSubgroup(subGroup.titleKey)}
                          onNavigate={handleNavRowClick}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>

      {/* Pinned Enterprise Status Footer */}
      <div className="p-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80 shrink-0 space-y-1.5">
        <HealthWidget collapsed={false} sidebarStyle="enterprise-erp" />
        <NavRow
          href={SETTINGS_ITEM.href}
          label={t(SETTINGS_ITEM.nameKey)}
          icon={Settings}
          active={activeHref === "/settings"}
          collapsed={false}
          compact
          sidebarStyle="enterprise-erp"
          onNavigate={handleNavRowClick}
        />
      </div>
    </div>
  );

  // ── 3. STANDARD DOCK FOR CLASSIC, CARBON, RADIANT, FLOATING ──
  const renderStandardExpanded = () => (
    <>
      {/* Brand Header */}
      <div className={cn(
        "h-14 lg:h-14 xl:h-16 px-3.5 lg:px-3.5 xl:px-4 flex items-center shrink-0",
        isCarbon
          ? "border-b border-slate-800 bg-slate-950/40"
          : isRadiant
          ? "border-b border-accent/20 bg-accent-soft/20"
          : "border-b border-subtle"
      )}>
        <Link href="/" className="flex items-center gap-2.5 lg:gap-2.5 xl:gap-3 overflow-hidden min-w-0">
          <span className={cn(
            "w-8 h-8 lg:w-8 lg:h-8 xl:w-10 xl:h-10 rounded-xl grid place-items-center shrink-0 overflow-hidden transition-all duration-200",
            brandLogo
              ? "bg-gradient-to-br from-white via-white to-accent-soft/40 border border-accent/30 shadow-soft-sm ring-1 ring-accent/20 p-1 hover:border-accent/50"
              : isCarbon
              ? "bg-cyan-500 text-slate-950 shadow-soft-sm"
              : isRadiant
              ? "bg-accent text-white shadow-[0_0_15px_rgba(var(--accent-rgb),0.5)]"
              : "bg-accent text-accent-fg shadow-soft-sm"
          )}>
            {brandLogo ? (
              <BrandLogo
                src={brandLogo}
                alt="Logo"
                style={{ transform: `scale(${(prefs.logoScale ?? 130) / 100})` }}
                className="w-full h-full object-contain drop-shadow-xs transition-transform duration-200"
              />
            ) : (
              <Leaf className="w-4 h-4 lg:w-4 lg:h-4 xl:w-5 xl:h-5" />
            )}
          </span>
          {isOpen && (
            <span className="flex flex-col min-w-0">
              <span className={cn(
                "font-bold tracking-tight text-[13.5px] lg:text-sm xl:text-[15px] leading-none truncate",
                isCarbon ? "text-slate-100" : "text-ink"
              )}>
                {t("app.brand")}
              </span>
              <span className={cn(
                "text-[10px] lg:text-[10px] xl:text-[11px] font-medium tracking-wider uppercase mt-1 truncate",
                isCarbon ? "text-cyan-400" : "text-accent"
              )}>
                {t("app.brandTagline")}
              </span>
            </span>
          )}
        </Link>
      </div>

      {/* Nav Menu */}
      <nav
        ref={navRef}
        onScroll={handleScroll}
        className={cn(
          "flex-1 overflow-y-auto px-2.5 lg:px-2.5 xl:px-3 py-2.5 lg:py-2.5 xl:py-4 space-y-3 lg:space-y-3 xl:space-y-4",
          isCarbon && "scrollbar-thin scrollbar-thumb-slate-800"
        )}
      >
        <NavRow
          href="/"
          label={t(HOME_ITEM.nameKey)}
          icon={Home}
          active={activeHref === "/"}
          collapsed={collapsed}
          sidebarStyle={sidebarStyle}
          onNavigate={handleNavRowClick}
        />

        {filteredNavGroups.map((group) => {
          const GroupIcon = GROUP_ICONS[group.titleKey] ?? Package;
          const isParentOpen = openParentGroups[group.titleKey] ?? false;
          const itemCount =
            (group.items?.length || 0) +
            (group.subGroups?.reduce((acc, s) => acc + s.items.length, 0) || 0);

          return (
            <div key={group.titleKey} className="space-y-1">
              {/* ── A. RADIANT AURORA GLASS: Interactive Collapsible Parent Accordion ── */}
              {isRadiant ? (
                <>
                  {isOpen ? (
                    <button
                      type="button"
                      onClick={() => toggleParentGroup(group.titleKey)}
                      className={cn(
                        "w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-left select-none transition-all cursor-pointer group",
                        isParentOpen
                          ? "bg-accent-soft/30 dark:bg-accent-soft/10 text-slate-900 dark:text-slate-100 font-bold shadow-xs"
                          : "hover:bg-accent-soft/20 dark:hover:bg-accent-soft/10 text-slate-800 dark:text-slate-200 font-bold hover:text-slate-900 dark:hover:text-white"
                      )}
                    >
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <GroupIcon className="w-4 h-4 shrink-0 text-slate-600 dark:text-slate-400 transition-colors" />
                        <span className="text-[11.5px] xl:text-xs font-bold uppercase tracking-wide truncate text-slate-800 dark:text-slate-100">
                          {t(group.titleKey)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 pl-1">
                        <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums leading-none bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700">
                          {itemCount}
                        </span>
                        <motion.div
                          animate={{ rotate: isParentOpen ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                          className="text-slate-500 dark:text-slate-400"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </motion.div>
                      </div>
                    </button>
                  ) : null}

                  {/* Collapsible Children in Expanded Mode, or Direct Children in Slim Collapsed Mode */}
                  {isOpen ? (
                    <AnimatePresence initial={false}>
                      {isParentOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: "easeInOut" }}
                          className="overflow-hidden space-y-1 pt-0.5"
                        >
                          {group.items?.map((item) => (
                            <NavRow
                              key={item.href}
                              href={item.href}
                              label={t(item.nameKey)}
                              icon={ICONS[item.href] ?? FileText}
                              active={activeHref === item.href}
                              collapsed={collapsed}
                              compact
                              sidebarStyle={sidebarStyle}
                              onNavigate={handleNavRowClick}
                            />
                          ))}
                          {group.subGroups?.map((subGroup) => (
                            <SubGroupSection
                              key={subGroup.titleKey}
                              subGroup={subGroup}
                              activeHref={activeHref}
                              collapsed={collapsed}
                              isExpanded={openSubgroups[subGroup.titleKey] ?? false}
                              sidebarStyle={sidebarStyle}
                              onToggle={() => toggleSubgroup(subGroup.titleKey)}
                              onNavigate={handleNavRowClick}
                            />
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  ) : (
                    <>
                      {group.items?.map((item) => (
                        <NavRow
                          key={item.href}
                          href={item.href}
                          label={t(item.nameKey)}
                          icon={ICONS[item.href] ?? FileText}
                          active={activeHref === item.href}
                          collapsed={collapsed}
                          compact
                          sidebarStyle={sidebarStyle}
                          onNavigate={handleNavRowClick}
                        />
                      ))}
                      {group.subGroups?.map((subGroup) => (
                        <SubGroupSection
                          key={subGroup.titleKey}
                          subGroup={subGroup}
                          activeHref={activeHref}
                          collapsed={collapsed}
                          isExpanded={openSubgroups[subGroup.titleKey] ?? false}
                          sidebarStyle={sidebarStyle}
                          onToggle={() => toggleSubgroup(subGroup.titleKey)}
                          onNavigate={handleNavRowClick}
                        />
                      ))}
                    </>
                  )}
                </>
              ) : (
                /* ── B. AURA CLASSIC (DEFAULT), CARBON, FLOATING: Direct Non-Collapsible Original Listing ── */
                <>
                  {isOpen ? (
                    <div className="flex items-center justify-between px-2 text-[11.5px] lg:text-xs font-bold text-ink-muted uppercase tracking-wide mb-1">
                      <span className={isCarbon ? "text-slate-400" : ""}>{t(group.titleKey)}</span>
                      <span className={cn(
                        "px-1.5 py-0.5 rounded-md text-[10px] font-semibold",
                        isCarbon ? "bg-slate-800 text-slate-400" : "bg-cushion text-ink-secondary"
                      )}>
                        {itemCount}
                      </span>
                    </div>
                  ) : null}

                  {/* Direct Items List */}
                  {group.items?.map((item) => (
                    <NavRow
                      key={item.href}
                      href={item.href}
                      label={t(item.nameKey)}
                      icon={ICONS[item.href] ?? FileText}
                      active={activeHref === item.href}
                      collapsed={collapsed}
                      compact
                      sidebarStyle={sidebarStyle}
                      onNavigate={handleNavRowClick}
                    />
                  ))}

                  {/* Child Subgroups for Structured Report Categories */}
                  {group.subGroups?.map((subGroup) => (
                    <SubGroupSection
                      key={subGroup.titleKey}
                      subGroup={subGroup}
                      activeHref={activeHref}
                      collapsed={collapsed}
                      isExpanded={openSubgroups[subGroup.titleKey] ?? false}
                      sidebarStyle={sidebarStyle}
                      onToggle={() => toggleSubgroup(subGroup.titleKey)}
                      onNavigate={handleNavRowClick}
                    />
                  ))}
                </>
              )}
            </div>
          );
        })}
      </nav>

      {/* Pinned footer */}
      <div className={cn(
        "p-2.5 lg:p-2.5 xl:p-3 shrink-0 space-y-1.5",
        isCarbon
          ? "border-t border-slate-800 bg-slate-950/40"
          : isRadiant
          ? "border-t border-accent/20 dark:border-slate-800 bg-accent-soft/10 dark:bg-slate-950/30"
          : "border-t border-subtle dark:border-slate-800"
      )}>
        <HealthWidget collapsed={collapsed} sidebarStyle={sidebarStyle} />
        <NavRow
          href={SETTINGS_ITEM.href}
          label={t(SETTINGS_ITEM.nameKey)}
          icon={Settings}
          active={activeHref === "/settings"}
          collapsed={collapsed}
          compact
          sidebarStyle={sidebarStyle}
          onNavigate={handleNavRowClick}
        />
      </div>
    </>
  );

  return (
    <>
      {/* Scrim on mobile */}
      <div
        onClick={() => setIsOpen(false)}
        aria-hidden={!isOpen}
        className={cn(
          "fixed inset-0 z-30 bg-ink/40 lg:hidden transition-opacity duration-300 ease-out",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      />

      {/* ── 0. KINETIC MORPHING EXPANSION (ROBIN HOLESINSKY DRIBBBLE MASTERPIECE) ── */}
      {isMotion ? (
        <aside
          className={cn(
            "fixed top-3 left-3 bottom-3 z-40 h-[calc(100vh-24px)] flex flex-col pointer-events-none select-none transition-[width,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
            isOpen
              ? "w-64 xl:w-68 translate-x-0"
              : "w-[72px] lg:w-[72px] xl:w-[72px] -translate-x-full lg:translate-x-0"
          )}
        >
          <div className="pointer-events-auto h-full w-full relative">
            {renderMotionExpansion()}
          </div>
        </aside>
      ) : isDual ? (
        <aside
          className={cn(
            "fixed top-0 left-0 z-40 h-screen flex bg-surface border-r border-subtle select-none transition-[width,transform] duration-300 ease-out overflow-hidden",
            // No `xl:` here on purpose: the open branch below already sets
            // `xl:w-80`. A base `xl:` only ever leaks into the COLLAPSED state,
            // where `lg:w-20` cannot outrank it at >=1280px.
            "w-72",
            isOpen ? "translate-x-0" : "-translate-x-full",
            "lg:translate-x-0",
            isOpen ? "lg:w-72 xl:w-80" : "lg:w-20 xl:w-20"
          )}
        >
          {/* Column 1: Primary Domain Rail (64px) */}
          <div className="w-16 shrink-0 bg-cushion/70 dark:bg-slate-900/80 border-r border-subtle/80 flex flex-col items-center py-3 select-none backdrop-blur-md">
            <Link href="/" className="mb-4">
              <span className="w-10 h-10 rounded-2xl grid place-items-center shrink-0 overflow-hidden bg-gradient-to-br from-white via-white to-accent-soft/40 border border-accent/30 shadow-soft-sm ring-1 ring-accent/20 p-1 hover:border-accent/50 transition-all duration-200">
                {brandLogo ? (
                  <BrandLogo
                    src={brandLogo}
                    alt="Logo"
                    style={{ transform: `scale(${(prefs.logoScale ?? 130) / 100})` }}
                    className="w-full h-full object-contain drop-shadow-xs transition-transform duration-200"
                  />
                ) : (
                  <Leaf className="w-5 h-5 text-accent" />
                )}
              </span>
            </Link>

            <div className="flex-1 space-y-2 w-full px-2 flex flex-col items-center">
              {filteredDualDomains.map((dom) => {
                const Icon = dom.icon;
                const isSelected = dualSelectedDomain === dom.id;
                return (
                  <button
                    key={dom.id}
                    type="button"
                    onClick={() => {
                      if (dom.directHref) {
                        handleNavigate(dom.directHref);
                      } else {
                        setDualSelectedDomain(dom.id);
                        if (!isOpen) setIsOpen(true);
                      }
                    }}
                    title={dom.title}
                    className={cn(
                      "w-11 h-11 rounded-2xl flex items-center justify-center transition-all cursor-pointer relative z-10",
                      isSelected
                        ? "text-white font-bold"
                        : "text-ink-secondary hover:text-ink hover:bg-cushion"
                    )}
                  >
                    {isSelected && (
                      <motion.div
                        layoutId="dual-rail-active"
                        className="absolute inset-0 rounded-2xl bg-accent shadow-md shadow-accent/30 pointer-events-none"
                        transition={{ type: "spring", stiffness: 450, damping: 32 }}
                      />
                    )}
                    <Icon className="w-5 h-5 relative z-10" />
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => handleNavigate("/settings")}
              title={t(SETTINGS_ITEM.nameKey)}
              className={cn(
                "w-11 h-11 rounded-2xl flex items-center justify-center transition-all cursor-pointer",
                activeHref === "/settings"
                  ? "bg-accent text-white shadow-soft-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-cushion dark:hover:bg-slate-850"
              )}
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>

          {/* Column 2: Sub-Navigation Pane (Visible when expanded) */}
          {isOpen && (
            <div className="flex-1 flex flex-col min-w-0 bg-surface dark:bg-slate-900">
              {/* Header */}
              <div className="p-3 border-b border-subtle dark:border-slate-800 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-800 dark:text-slate-100 uppercase tracking-wider truncate">
                    {currentDomain.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    title="Collapse to Rail"
                    className="p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-cushion dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <ChevronsLeft className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <input
                    type="text"
                    placeholder="Filter pages..."
                    value={dualSearch}
                    onChange={(e) => setDualSearch(e.target.value)}
                    className="w-full pl-8 pr-6 py-1.5 rounded-xl text-xs bg-cushion dark:bg-slate-800 border border-subtle dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                  {dualSearch && (
                    <button
                      type="button"
                      onClick={() => setDualSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-[10px]"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {currentDomain.items
                  ?.filter((item) =>
                    dualSearch
                      ? item.name.toLowerCase().includes(dualSearch.toLowerCase())
                      : true
                  )
                  .map((item) => {
                    const active = activeHref === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        prefetch={false}
                        onMouseEnter={() => prefetchRouteData(item.href)}
                        onFocus={() => prefetchRouteData(item.href)}
                        onClick={() => {
                          if (window.matchMedia("(max-width: 1023px)").matches) setIsOpen(false);
                        }}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer",
                          active
                            ? "bg-gradient-to-r from-accent to-accent/90 text-white font-bold shadow-xs shadow-accent/25"
                            : "text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-cushion dark:hover:bg-slate-800"
                        )}
                      >
                        <span className="truncate">{item.name}</span>
                        {active && <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />}
                      </Link>
                    );
                  })}
              </div>

              {/* Bottom Health in Dual Column */}
              <div className="p-2 border-t border-subtle dark:border-slate-800 bg-cushion/20 dark:bg-slate-950/40">
                <HealthWidget collapsed={false} />
              </div>
            </div>
          )}
        </aside>
      ) : isFloating ? (
        /* ── 2. FLOATING ISLAND GLASS ── */
        <aside
          className={cn(
            entranceClass,
            "fixed top-0 left-0 z-40 h-screen pointer-events-none p-2 sm:p-2.5 lg:p-3",
            "transition-[width,transform] duration-300 ease-out",
            "w-64",
            isOpen ? "translate-x-0" : "-translate-x-full",
            "lg:translate-x-0",
            isOpen ? "lg:w-60 xl:w-64" : "lg:w-20"
          )}
        >
          <div className="pointer-events-auto h-full w-full rounded-2xl lg:rounded-3xl border border-white/70 dark:border-white/15 bg-surface/90 backdrop-blur-2xl shadow-2xl flex flex-col overflow-hidden">
            {renderStandardExpanded()}
          </div>
        </aside>
      ) : isEnterprise && isOpen ? (
        /* ── 3. ENTERPRISE ERP PRO (DYNAMIC BRANDING ACCENT ADAPTIVE!) ── */
        <aside
          className={cn(
            entranceClass,
            "fixed top-0 left-0 z-40 h-screen flex flex-col transition-[width,transform] duration-300 ease-out shadow-lg",
            "w-72 xl:w-76",
            isOpen ? "translate-x-0" : "-translate-x-full",
            "lg:translate-x-0",
            isOpen ? "lg:w-72 xl:w-76" : "lg:w-20"
          )}
        >
          {renderEnterpriseErpExpanded()}
        </aside>
      ) : isRail && !isOpen ? (
        /* ── 4. UNTITLED UI SLIM RAIL (WHEN COLLAPSED) + FLYOUT MENUS ── */
        <>
          <aside
            className={cn(
              entranceClass,
              "fixed top-0 left-0 z-40 h-screen w-20 bg-surface dark:bg-slate-900 border-r border-subtle dark:border-slate-800 flex flex-col items-center py-3 select-none transition-[transform] duration-300 ease-out",
              isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
            )}
          >
            {/* Top Logo */}
            <Link href="/" className="mb-4">
              <span className="w-10 h-10 rounded-2xl grid place-items-center shrink-0 overflow-hidden bg-gradient-to-br from-white via-white to-accent-soft/40 border border-accent/30 shadow-soft-md ring-1 ring-accent/20 p-1 hover:border-accent/50 transition-all duration-200">
                {brandLogo ? (
                  <BrandLogo
                    src={brandLogo}
                    alt="Logo"
                    style={{ transform: `scale(${(prefs.logoScale ?? 130) / 100})` }}
                    className="w-full h-full object-contain drop-shadow-xs transition-transform duration-200"
                  />
                ) : (
                  <Leaf className="w-5 h-5 text-accent" />
                )}
              </span>
            </Link>

            {/* Rail Items */}
            <div className="flex-1 w-full px-2 space-y-2 flex flex-col items-center">
              {RAIL_CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isCatActive =
                  (cat.href && activeHref === cat.href) ||
                  (cat.items && cat.items.some((i) => i.href === activeHref));
                const isFlyoutOpen = activeFlyoutGroup === cat.id;

                return (
                  <div key={cat.id} className="relative w-full flex justify-center group">
                    <button
                      type="button"
                      onClick={() => {
                        if (cat.href) {
                          handleNavigate(cat.href);
                        } else {
                          setActiveFlyoutGroup(activeFlyoutGroup === cat.id ? null : cat.id);
                        }
                      }}
                      title={cat.title}
                      className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer relative",
                        isCatActive || isFlyoutOpen
                          ? "bg-accent text-white shadow-soft-sm"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-cushion dark:hover:bg-slate-800"
                      )}
                    >
                      <Icon className="w-5 h-5" />
                      {isCatActive && (
                        <span className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-accent" />
                      )}
                    </button>

                    {/* Tooltip on simple hover */}
                    {!activeFlyoutGroup && (
                      <div className="absolute left-full ml-3 px-2.5 py-1 rounded-lg bg-slate-900 text-white text-xs font-semibold whitespace-nowrap shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                        {cat.title}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bottom Settings & Health */}
            <div className="w-full px-2 pt-2 border-t border-subtle dark:border-slate-800 flex flex-col items-center space-y-2">
              <HealthWidget collapsed={true} />
              <button
                type="button"
                onClick={() => handleNavigate("/settings")}
                title={t(SETTINGS_ITEM.nameKey)}
                className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer",
                  activeHref === "/settings"
                    ? "bg-accent text-white shadow-soft-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-cushion dark:hover:bg-slate-850"
                )}
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </aside>

          {/* Interactive Floating Flyout Popover Menu */}
          <AnimatePresence>
            {activeFlyoutGroup && currentFlyoutCategory && currentFlyoutCategory.items && (
              <motion.div
                initial={{ opacity: 0, x: -10, scale: 0.96 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -10, scale: 0.96 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="fixed left-[5.5rem] top-4 z-50 w-72 max-h-[85vh] rounded-3xl border border-white/70 dark:border-slate-700 bg-surface/95 dark:bg-slate-900/95 backdrop-blur-2xl shadow-2xl p-3 flex flex-col overflow-hidden text-slate-900 dark:text-slate-100"
              >
                <div className="flex items-center justify-between pb-2 border-b border-subtle dark:border-slate-800 mb-2">
                  <span className="font-bold text-xs text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <currentFlyoutCategory.icon className="w-4 h-4 text-accent" />
                    {currentFlyoutCategory.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveFlyoutGroup(null)}
                    className="text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-xs px-1.5 py-0.5 rounded-md hover:bg-cushion dark:hover:bg-slate-800"
                  >
                    ✕
                  </button>
                </div>

                {/* Quick Search inside Flyout */}
                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <input
                    type="text"
                    placeholder="Quick filter..."
                    value={flyoutSearch}
                    onChange={(e) => setFlyoutSearch(e.target.value)}
                    className="w-full pl-8 pr-2 py-1.5 rounded-xl text-xs bg-cushion dark:bg-slate-800 border border-subtle dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>

                {/* Child Links */}
                <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                  {currentFlyoutCategory.items
                    .filter((item) =>
                      flyoutSearch
                        ? item.name.toLowerCase().includes(flyoutSearch.toLowerCase())
                        : true
                    )
                    .map((item) => {
                      const active = activeHref === item.href;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          prefetch={false}
                          onMouseEnter={() => prefetchRouteData(item.href)}
                          onFocus={() => prefetchRouteData(item.href)}
                          onClick={() => {
                            setActiveFlyoutGroup(null);
                            if (window.matchMedia("(max-width: 1023px)").matches) setIsOpen(false);
                          }}
                          className={cn(
                            "w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer",
                            active
                              ? "bg-accent-soft dark:bg-accent/20 text-accent font-bold"
                              : "text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-cushion dark:hover:bg-slate-800"
                          )}
                        >
                          <span className="truncate">{item.name}</span>
                          {active && <span className="w-1.5 h-1.5 rounded-full bg-accent" />}
                        </Link>
                      );
                    })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      ) : isRail && isOpen ? (
        /* ── 5. UNTITLED UI EXPANDED WORKSPACE SIDEBAR (Like Image 2!) ── */
        <aside
          className={cn(
            entranceClass,
            "fixed top-0 left-0 z-40 h-screen flex flex-col transition-[width,transform] duration-300 ease-out border-r border-subtle dark:border-slate-800 bg-surface dark:bg-slate-900 shadow-soft-xl",
            "w-64",
            isOpen ? "translate-x-0" : "-translate-x-full",
            "lg:translate-x-0",
            isOpen ? "lg:w-60 xl:w-64" : "lg:w-20"
          )}
        >
          {renderUntitledUIExpanded()}
        </aside>
      ) : (
        /* ── 6. STANDARD DOCK FOR CLASSIC, CARBON, RADIANT, FLOATING, ETC. ── */
        <aside
          className={cn(
            entranceClass,
            "fixed top-0 left-0 z-40 h-screen flex flex-col",
            "transition-[width,transform] duration-300 ease-out",
            isCarbon
              ? "bg-[#0B0F19] text-slate-200 border-r border-slate-800/90 shadow-2xl"
              : isRadiant
              ? "bg-gradient-to-b from-accent-soft/30 via-surface to-accent-soft/10 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 border-r border-accent/20 dark:border-slate-800 backdrop-blur-xl"
              : "bg-surface dark:bg-slate-900 border-r border-subtle dark:border-slate-800 text-slate-900 dark:text-slate-100",
            // No `xl:` here on purpose - see the dual-column branch above.
            "w-64",
            isOpen ? "translate-x-0" : "-translate-x-full",
            "lg:translate-x-0",
            isOpen ? "lg:w-64 xl:w-68" : "lg:w-20 xl:w-20",
            !isOpen && "lg:shadow-none shadow-soft-xl"
          )}
        >
          {renderStandardExpanded()}
        </aside>
      )}
    </>
  );
}
