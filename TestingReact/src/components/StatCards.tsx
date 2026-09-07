"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  TrendingUp,
  PackageCheck,
  Hourglass,
  CheckCircle2,
  Lock,
  Boxes,
  ClipboardCheck,
  ClipboardList,
  BadgeCheck,
  Truck,
  Wrench,
  CalendarCheck,
  ExternalLink,
  XCircle,
  Ban,
  ChevronDown,
  RotateCcw,
  Check,
  SlidersHorizontal,
  Calendar,
  CalendarRange,
  Tag,
  ArrowRight,
} from "lucide-react";
import {
  fetchDashboardStats,
  getCached,
  type DashboardStats,
  type ServiceSearchExtras,
} from "@/services/api";
import { useI18n } from "@/i18n/LanguageProvider";
import { KpiCard } from "@/components/av";
import { useDashboard } from "@/components/dashboard/useDashboardStore";
import {
  useTicketSeries,
  dailyCounts,
  halfOverHalfTrend,
  statusIs,
} from "@/hooks/useTicketSeries";
import type { RepairServiceItem } from "@/services/types";
import type { TranslationKey } from "@/i18n/translations";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

/**
 * @file components/StatCards.tsx
 * @description The dashboard's four customizable KPI tiles with status selection & date range binding.
 *
 * Each card can be configured with:
 * 1. Status metric (Received, Repairing, Awaiting Customer Confirm, Finished, All, etc.)
 * 2. Date window binding (All Time, Today, Yesterday, Last 7 Days, This Month, Custom From/To Date)
 */

const DAYS = 7;
const STORAGE_KEY_V3 = "user_dashboard_kpi_cards_config_v3";

export type DateFilterPreset =
  | "all"
  | "today"
  | "yesterday"
  | "last7days"
  | "thisMonth"
  | "lastMonth"
  | "last30days"
  | "thisYear"
  | "custom";

export interface CardConfig {
  id: string;
  metricId: string;
  datePreset: DateFilterPreset;
  fromDate?: string;
  toDate?: string;
}

const DEFAULT_CARD_CONFIGS: CardConfig[] = [
  { id: "card-0", metricId: "Today", datePreset: "today" },
  { id: "card-1", metricId: "Received", datePreset: "all" },
  { id: "card-2", metricId: "Waiting", datePreset: "all" },
  { id: "card-3", metricId: "Finished", datePreset: "all" },
];

export type MetricCategory = "time" | "workflow" | "resolution";

export interface MetricDef {
  id: string;
  filterKey: string;
  titleKey?: TranslationKey;
  titleEn: string;
  titleKm: string;
  category: MetricCategory;
  icon: React.ElementType;
  match: (item: RepairServiceItem) => boolean;
  dateOf: (item: RepairServiceItem) => string | undefined | null;
  trendIsGood: boolean;
}

export const METRIC_DEFS: readonly MetricDef[] = [
  // ─── General / Time Window Metrics ────────────────────
  {
    id: "All",
    filterKey: "All",
    titleEn: "All Tickets",
    titleKm: "សំបុត្រទាំងអស់",
    category: "workflow",
    icon: ClipboardList,
    match: () => true,
    dateOf: (i) => i.serviceDate,
    trendIsGood: true,
  },
  {
    id: "Today",
    filterKey: "Today",
    titleKey: "dash.todayReport",
    titleEn: "Today's Intake",
    titleKm: "របាយការណ៍ថ្ងៃនេះ",
    category: "time",
    icon: TrendingUp,
    match: (i) => isDateToday(i.serviceDate),
    dateOf: (i) => i.serviceDate,
    trendIsGood: true,
  },
  {
    id: "FinishedMonth",
    filterKey: "Finished",
    titleKey: "dash.finished",
    titleEn: "Finished This Month",
    titleKm: "ជួសជុលរួចក្នុងខែនេះ",
    category: "time",
    icon: CalendarCheck,
    match: (i) => statusIs(i, "finish") && isDateThisMonth(i.finishedDate ?? i.serviceDate),
    dateOf: (i) => i.finishedDate ?? i.serviceDate,
    trendIsGood: true,
  },

  // ─── Workflow Stage Metrics ──────────────────────────
  {
    id: "Received",
    filterKey: "Received",
    titleKey: "status.received",
    titleEn: "Received Items",
    titleKm: "ម៉ាស៊ីនចូល",
    category: "workflow",
    icon: PackageCheck,
    match: (i) => statusIs(i, "reciev") || statusIs(i, "receiv"),
    dateOf: (i) => i.serviceDate,
    trendIsGood: true,
  },
  {
    id: "Inspection",
    filterKey: "Inspection",
    titleKey: "status.inspection",
    titleEn: "Inspection",
    titleKm: "វិនិច្ឆ័យរួចរាល់",
    category: "workflow",
    icon: ClipboardCheck,
    match: (i) => statusIs(i, "inspect"),
    dateOf: (i) => i.serviceDate,
    trendIsGood: true,
  },
  {
    id: "Waiting",
    filterKey: "Awaiting Customer Confirm",
    titleKey: "status.awaitingCustomerConfirm",
    titleEn: "Awaiting Customer Confirm",
    titleKm: "រង់ចាំការយល់ព្រមពីភ្ញៀវ",
    category: "workflow",
    icon: Hourglass,
    match: (i) => statusIs(i, "awaiting customer"),
    dateOf: (i) => i.serviceDate,
    trendIsGood: false,
  },
  {
    id: "Awaiting Sparepart",
    filterKey: "Awaiting Sparepart",
    titleKey: "status.awaitingSparepart",
    titleEn: "Awaiting Sparepart",
    titleKm: "រង់ចាំគ្រឿងបន្លាស់",
    category: "workflow",
    icon: Boxes,
    match: (i) => statusIs(i, "awaiting spare") || statusIs(i, "sparepart"),
    dateOf: (i) => i.serviceDate,
    trendIsGood: false,
  },
  {
    id: "Sale Confirmed",
    filterKey: "Sale Confirmed",
    titleKey: "status.saleConfirmed",
    titleEn: "Sale Confirmed",
    titleKm: "ផ្នែកលក់យល់ព្រមជួសជុល",
    category: "workflow",
    icon: BadgeCheck,
    match: (i) => statusIs(i, "sale confirmed"),
    dateOf: (i) => i.serviceDate,
    trendIsGood: true,
  },
  {
    id: "Sent Spareparts",
    filterKey: "Sent Spareparts",
    titleKey: "status.sentSpareparts",
    titleEn: "Sent Spareparts",
    titleKm: "បានបញ្ជូនគ្រឿងបន្លាស់",
    category: "workflow",
    icon: Truck,
    match: (i) => statusIs(i, "sent spare"),
    dateOf: (i) => i.serviceDate,
    trendIsGood: true,
  },
  {
    id: "Repairing",
    filterKey: "Repairing",
    titleKey: "status.repairing",
    titleEn: "Repairing",
    titleKm: "កំពុងជួសជុល",
    category: "workflow",
    icon: Wrench,
    match: (i) => statusIs(i, "repairing"),
    dateOf: (i) => i.serviceDate,
    trendIsGood: true,
  },
  {
    id: "Third-Party",
    filterKey: "Repair by Third-Party",
    titleKey: "status.thirdParty",
    titleEn: "Repair by Third-Party",
    titleKm: "ជាងខាងក្រៅជួសជុល",
    category: "workflow",
    icon: ExternalLink,
    match: (i) => statusIs(i, "third-party") || statusIs(i, "third party"),
    dateOf: (i) => i.serviceDate,
    trendIsGood: true,
  },

  // ─── Resolution Metrics ──────────────────────────────
  {
    id: "Finished",
    filterKey: "Finished",
    titleKey: "status.finished",
    titleEn: "Finished (All Time)",
    titleKm: "ជួសជុលរួចរាល់សរុប",
    category: "resolution",
    icon: CheckCircle2,
    match: (i) => statusIs(i, "finish"),
    dateOf: (i) => i.finishedDate ?? i.serviceDate,
    trendIsGood: true,
  },
  {
    id: "Customer Rejected",
    filterKey: "Customer Rejected",
    titleKey: "status.customerRejected",
    titleEn: "Customer Rejected",
    titleKm: "អតិថិជនមិនជួសជុល",
    category: "resolution",
    icon: XCircle,
    match: (i) => statusIs(i, "customer rejected") || statusIs(i, "reject"),
    dateOf: (i) => i.serviceDate,
    trendIsGood: false,
  },
  {
    id: "Unrepairable",
    filterKey: "Unrepairable",
    titleKey: "status.unrepairable",
    titleEn: "Unrepairable",
    titleKm: "ជួសជុលមិនបាន",
    category: "resolution",
    icon: Ban,
    match: (i) => statusIs(i, "unrepairable"),
    dateOf: (i) => i.serviceDate,
    trendIsGood: false,
  },
];

const METRIC_MAP: Record<string, MetricDef> = Object.fromEntries(
  METRIC_DEFS.map((m) => [m.id, m])
);

export const DATE_PRESETS: {
  id: DateFilterPreset;
  labelEn: string;
  labelKm: string;
  shortKm: string;
}[] = [
  { id: "all", labelEn: "All Time", labelKm: "គ្រប់ពេល (ទាំងអស់)", shortKm: "ទាំងអស់" },
  { id: "today", labelEn: "Today", labelKm: "ថ្ងៃនេះ", shortKm: "ថ្ងៃនេះ" },
  { id: "yesterday", labelEn: "Yesterday", labelKm: "ម្សិលមិញ", shortKm: "ម្សិលមិញ" },
  { id: "last7days", labelEn: "Last 7 Days", labelKm: "៧ ថ្ងៃចុងក្រោយ", shortKm: "៧ ថ្ងៃ" },
  { id: "thisMonth", labelEn: "This Month", labelKm: "ខែនេះ", shortKm: "ខែនេះ" },
  { id: "lastMonth", labelEn: "Last Month", labelKm: "ខែមុន", shortKm: "ខែមុន" },
  { id: "last30days", labelEn: "Last 30 Days", labelKm: "៣០ ថ្ងៃចុងក្រោយ", shortKm: "៣០ ថ្ងៃ" },
  { id: "thisYear", labelEn: "This Year", labelKm: "ឆ្នាំនេះ", shortKm: "ឆ្នាំនេះ" },
  { id: "custom", labelEn: "Custom Range…", labelKm: "កំណត់ថ្ងៃផ្ទាល់ខ្លួន…", shortKm: "កំណត់ថ្ងៃ" },
];

const CATEGORY_ORDER: readonly MetricCategory[] = ["time", "workflow", "resolution"];

const CATEGORY_LABELS: Record<MetricCategory, { en: string; km: string }> = {
  time: {
    en: "Time Window",
    km: "ពេលវេលា",
  },
  workflow: {
    en: "Workflow Stages",
    km: "ដំណាក់កាលការងារ",
  },
  resolution: {
    en: "Resolution",
    km: "លទ្ធផលចុងក្រោយ",
  },
};

function isDateToday(dStr?: string | null): boolean {
  if (!dStr) return false;
  const d = new Date(dStr);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isDateThisMonth(dStr?: string | null): boolean {
  if (!dStr) return false;
  const d = new Date(dStr);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth()
  );
}

function getDatePresetBounds(
  preset: DateFilterPreset,
  customFrom?: string,
  customTo?: string
): { start: number; end: number } | null {
  const now = new Date();
  if (preset === "all") return null;

  if (preset === "today") {
    const s = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const e = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { start: s.getTime(), end: e.getTime() };
  }

  if (preset === "yesterday") {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    const s = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0, 0);
    const e = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59, 999);
    return { start: s.getTime(), end: e.getTime() };
  }

  if (preset === "last7days") {
    const s = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
    const e = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { start: s.getTime(), end: e.getTime() };
  }

  if (preset === "thisMonth") {
    const s = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const e = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start: s.getTime(), end: e.getTime() };
  }

  if (preset === "lastMonth") {
    const s = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
    const e = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return { start: s.getTime(), end: e.getTime() };
  }

  if (preset === "last30days") {
    const s = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29, 0, 0, 0, 0);
    const e = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { start: s.getTime(), end: e.getTime() };
  }

  if (preset === "thisYear") {
    const s = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    const e = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    return { start: s.getTime(), end: e.getTime() };
  }

  if (preset === "custom") {
    const s = customFrom ? new Date(`${customFrom}T00:00:00`).getTime() : 0;
    const e = customTo ? new Date(`${customTo}T23:59:59.999`).getTime() : Infinity;
    return { start: isNaN(s) ? 0 : s, end: isNaN(e) ? Infinity : e };
  }

  return null;
}

function getDateBadgeText(
  preset: DateFilterPreset,
  lang: string,
  fromDate?: string,
  toDate?: string
): string {
  if (preset === "all") return "";
  if (preset === "today") return lang === "km" ? "ថ្ងៃនេះ" : "Today";
  if (preset === "yesterday") return lang === "km" ? "ម្សិលមិញ" : "Yesterday";
  if (preset === "last7days") return lang === "km" ? "៧ ថ្ងៃ" : "7 Days";
  if (preset === "thisMonth") return lang === "km" ? "ខែនេះ" : "This Month";
  if (preset === "lastMonth") return lang === "km" ? "ខែមុន" : "Last Month";
  if (preset === "last30days") return lang === "km" ? "៣០ ថ្ងៃ" : "30 Days";
  if (preset === "thisYear") return lang === "km" ? "ឆ្នាំនេះ" : "This Year";
  if (preset === "custom") {
    if (fromDate && toDate) {
      const f = fromDate.slice(5).replace("-", "/");
      const t = toDate.slice(5).replace("-", "/");
      return `${f} - ${t}`;
    }
    return lang === "km" ? "កំណត់ថ្ងៃ" : "Custom";
  }
  return "";
}

function getMetricTitle(
  metric: MetricDef,
  t: (k: TranslationKey) => string,
  lang: string
): string {
  if (metric.titleKey) {
    try {
      const val = t(metric.titleKey);
      if (val && val !== metric.titleKey) return val;
    } catch {
      // fallback
    }
  }
  return lang === "km" ? metric.titleKm : metric.titleEn;
}

function isCardActive(
  metric: MetricDef,
  selectedFilter: string
): boolean {
  if (selectedFilter === metric.filterKey || selectedFilter === metric.id) return true;
  if (
    metric.id === "Received" &&
    (selectedFilter.toLowerCase().includes("reciev") || selectedFilter.toLowerCase().includes("receiv"))
  ) {
    return true;
  }
  if (
    metric.id === "Waiting" &&
    (selectedFilter === "WAITING" || selectedFilter.toLowerCase().includes("customer"))
  ) {
    return true;
  }
  return false;
}

function countItemsForConfig(
  config: CardConfig,
  items: RepairServiceItem[],
  dbStats: DashboardStats | null
): number {
  const metric = METRIC_MAP[config.metricId] || METRIC_MAP["Today"];
  const bounds = getDatePresetBounds(config.datePreset, config.fromDate, config.toDate);

  // Authoritative DB stats when unbounded ("all")
  if (config.datePreset === "all" && dbStats) {
    if (metric.id === "Received") return dbStats.receivedCount;
    if (metric.id === "Waiting") return dbStats.waitingCustomerCount;
    if (metric.id === "Awaiting Sparepart") return dbStats.waitingSpareCount;
    if (metric.id === "Finished") return dbStats.finishedCount;
  }
  if (config.datePreset === "today" && metric.id === "Today" && dbStats) {
    return dbStats.todayCount;
  }
  if (config.datePreset === "thisMonth" && metric.id === "Finished" && dbStats) {
    return dbStats.finishedThisMonthCount;
  }

  // Live filter on tickets
  return items.filter((item) => {
    if (!metric.match(item)) return false;
    if (!bounds) return true;
    const raw = metric.dateOf(item);
    if (!raw) return false;
    const t = new Date(raw).getTime();
    if (!Number.isFinite(t)) return false;
    return t >= bounds.start && t <= bounds.end;
  }).length;
}

interface StatCardsProps {
  selectedFilter: string;
  setSelectedFilter: (id: string) => void;
  onFilterChangeWithExtras?: (filter: string, extras?: ServiceSearchExtras) => void;
}

export default function StatCards({
  selectedFilter,
  setSelectedFilter,
  onFilterChangeWithExtras,
}: StatCardsProps) {
  const { t, lang } = useI18n();
  const { isPrivacyMode, togglePrivacyMode } = useDashboard();
  const { items, loading } = useTicketSeries();

  const [cards, setCards] = useState<CardConfig[]>(DEFAULT_CARD_CONFIGS);
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
  const [popoverTab, setPopoverTab] = useState<"status" | "date">("status");
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // Load configuration from localStorage
  useEffect(() => {
    try {
      const rawV3 = localStorage.getItem(STORAGE_KEY_V3);
      if (rawV3) {
        const parsed = JSON.parse(rawV3);
        if (Array.isArray(parsed) && parsed.length === 4) {
          const validated: CardConfig[] = parsed.map((c, idx) => ({
            id: `card-${idx}`,
            metricId: METRIC_MAP[c.metricId] ? c.metricId : DEFAULT_CARD_CONFIGS[idx].metricId,
            datePreset: c.datePreset || "all",
            fromDate: c.fromDate || "",
            toDate: c.toDate || "",
          }));
          setCards(validated);
          return;
        }
      }
      // Migration from v2
      const rawV2 = localStorage.getItem("user_dashboard_kpi_metrics_selection_v2");
      if (rawV2) {
        const parsedV2 = JSON.parse(rawV2);
        if (Array.isArray(parsedV2) && parsedV2.length === 4) {
          const migrated: CardConfig[] = parsedV2.map((id, idx) => ({
            id: `card-${idx}`,
            metricId: METRIC_MAP[id] ? id : DEFAULT_CARD_CONFIGS[idx].metricId,
            datePreset: id === "Today" ? "today" : id === "FinishedMonth" ? "thisMonth" : "all",
          }));
          setCards(migrated);
        }
      }
    } catch (e) {
      console.warn("Could not read KPI cards config from localStorage:", e);
    }
  }, []);

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    if (activeDropdown === null) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveDropdown(null);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeDropdown]);

  // Authoritative DB stats from backend
  const [dbStats, setDbStats] = useState<DashboardStats | null>(() => {
    return getCached<DashboardStats>("dashboard:statistics") ?? null;
  });

  useEffect(() => {
    let isMounted = true;
    async function loadStats() {
      try {
        const stats = await fetchDashboardStats();
        if (isMounted && stats) {
          setDbStats(stats);
        }
      } catch (err) {
        console.warn("Failed to load dashboard stats:", err);
      }
    }
    void loadStats();
    return () => {
      isMounted = false;
    };
  }, []);

  // Save changes to state & localStorage
  const updateCardConfig = (cardIdx: number, updater: (prev: CardConfig) => CardConfig) => {
    setCards((curr) => {
      const next = [...curr];
      next[cardIdx] = updater(next[cardIdx]);
      try {
        localStorage.setItem(STORAGE_KEY_V3, JSON.stringify(next));
      } catch (e) {
        console.warn("Failed to save KPI config:", e);
      }
      return next;
    });
  };

  // Switch status with duplicate swap
  const handleSelectStatus = (cardIdx: number, newMetricId: string) => {
    const currentCard = cards[cardIdx];
    if (currentCard.metricId === newMetricId) {
      setPopoverTab("date");
      return;
    }

    setCards((prev) => {
      const next = [...prev];
      const oldMetricId = next[cardIdx].metricId;
      const dupIdx = next.findIndex((c, idx) => idx !== cardIdx && c.metricId === newMetricId);
      if (dupIdx !== -1) {
        next[dupIdx] = { ...next[dupIdx], metricId: oldMetricId };
      }
      next[cardIdx] = { ...next[cardIdx], metricId: newMetricId };
      try {
        localStorage.setItem(STORAGE_KEY_V3, JSON.stringify(next));
      } catch (e) {
        console.warn("Failed to save KPI selection:", e);
      }
      return next;
    });

    const newMetric = METRIC_MAP[newMetricId];
    const metricTitle = getMetricTitle(newMetric, t, lang);
    toast.success(
      lang === "km"
        ? `បានប្ដូរទៅជា «${metricTitle}»`
        : `Status updated to "${metricTitle}"`,
      { position: "bottom-right", duration: 2000 }
    );
  };

  // Select date preset
  const handleSelectDatePreset = (cardIdx: number, preset: DateFilterPreset) => {
    updateCardConfig(cardIdx, (c) => ({
      ...c,
      datePreset: preset,
      // If custom and no dates yet, prepopulate with today
      fromDate: preset === "custom" && !c.fromDate ? new Date().toISOString().slice(0, 10) : c.fromDate,
      toDate: preset === "custom" && !c.toDate ? new Date().toISOString().slice(0, 10) : c.toDate,
    }));
  };

  // Select custom dates
  const handleCustomDateChange = (
    cardIdx: number,
    field: "fromDate" | "toDate",
    val: string
  ) => {
    updateCardConfig(cardIdx, (c) => ({
      ...c,
      datePreset: "custom",
      [field]: val,
    }));
  };

  // Reset single card
  const handleResetCard = (cardIdx: number) => {
    const def = DEFAULT_CARD_CONFIGS[cardIdx];
    updateCardConfig(cardIdx, () => ({ ...def }));
    setActiveDropdown(null);
    toast.success(lang === "km" ? "បានកំណត់កាតនេះដូចដើម" : "Reset card to default", {
      position: "bottom-right",
      duration: 2000,
    });
  };

  // Reset all 4 cards
  const handleResetAll = () => {
    setCards(DEFAULT_CARD_CONFIGS);
    try {
      localStorage.removeItem(STORAGE_KEY_V3);
      localStorage.removeItem("user_dashboard_kpi_metrics_selection_v2");
    } catch (e) {
      console.warn("Failed to reset:", e);
    }
    setActiveDropdown(null);
    toast.success(lang === "km" ? "បានកំណត់កាតទាំង ៤ ដូចដើម" : "Reset all 4 cards to default", {
      position: "bottom-right",
      duration: 2000,
    });
  };

  // Card click triggers table filter (and optional date extras)
  const handleCardClick = (config: CardConfig) => {
    const metric = METRIC_MAP[config.metricId] || METRIC_MAP["Today"];
    setSelectedFilter(metric.filterKey);

    if (onFilterChangeWithExtras) {
      const extras: ServiceSearchExtras = {};
      if (config.datePreset === "today") extras.dateFilter = "Today";
      else if (config.datePreset === "yesterday") extras.dateFilter = "Yesterday";
      else if (config.datePreset === "last7days") extras.dateFilter = "LastWeek";
      else if (config.datePreset === "thisMonth") extras.dateFilter = "LastMonth";
      else if (config.datePreset === "custom" && config.fromDate) {
        extras.fromDate = config.fromDate;
        extras.toDate = config.toDate;
      }
      onFilterChangeWithExtras(metric.filterKey, extras);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 lg:gap-3 xl:gap-4">
        {cards.map((config, i) => {
          const metric = METRIC_MAP[config.metricId] || METRIC_MAP["Today"];
          const Icon = metric.icon;
          const isSelected = isCardActive(metric, selectedFilter);
          const isDropdownOpen = activeDropdown === i;

          // Compute count based on status and bound date range
          const cardCount = countItemsForConfig(config, items, dbStats);

          // Compute 7-day sparkline
          const sparkData = dailyCounts(items, DAYS, metric.match, metric.dateOf);
          const trend = halfOverHalfTrend(sparkData);
          const hasData = sparkData.some((n) => n > 0);

          const statusTitle = getMetricTitle(metric, t, lang);
          const dateBadge = getDateBadgeText(config.datePreset, lang, config.fromDate, config.toDate);

          return (
            <div
              key={config.id}
              style={{ "--enter-i": i } as React.CSSProperties}
              className={cn("enter-up relative", isDropdownOpen ? "z-40" : "z-10")}
            >
              <KpiCard
                label={
                  <div className="flex items-center gap-1.5 min-w-0 max-w-full">
                    <span className="truncate">{statusTitle}</span>
                    {dateBadge && (
                      <span className="px-1.5 py-0.5 text-[9px] rounded-md font-semibold bg-accent/15 text-accent border border-accent/20 shrink-0 uppercase tracking-tight">
                        {dateBadge}
                      </span>
                    )}
                  </div>
                }
                headerAction={
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveDropdown((curr) => {
                        if (curr === i) return null;
                        setPopoverTab("status");
                        return i;
                      });
                    }}
                    className={cn(
                      "p-1 -my-1 rounded-md text-ink-muted hover:text-accent hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer inline-flex items-center",
                      isDropdownOpen && "text-accent bg-accent/10 dark:bg-white/15"
                    )}
                    title={
                      lang === "km"
                        ? "ចុចដើម្បីប្ដូរស្ថានភាព & ចងកាលបរិច្ឆេទ"
                        : "Click to change status & date range"
                    }
                    aria-label="Configure KPI metric and date"
                  >
                    <ChevronDown
                      className={cn(
                        "w-3.5 h-3.5 transition-transform duration-200",
                        isDropdownOpen && "rotate-180"
                      )}
                    />
                  </button>
                }
                value={
                  isPrivacyMode ? (
                    <div className="w-20 h-7 my-1 bg-zinc-200/90 dark:bg-zinc-700/80 rounded animate-pulse" />
                  ) : loading && !dbStats && items.length === 0 ? (
                    <div className="w-16 h-7 my-0.5 bg-cushion/80 rounded-lg animate-pulse" />
                  ) : (
                    cardCount
                  )
                }
                icon={<Icon className="w-4 h-4" />}
                selected={isSelected}
                onClick={() => handleCardClick(config)}
                trend={isPrivacyMode ? undefined : trend}
                trendIsGood={metric.trendIsGood}
                trendCaption={
                  isPrivacyMode
                    ? undefined
                    : dateBadge
                    ? `${statusTitle} (${dateBadge})`
                    : hasData
                    ? t("dash.last7Days")
                    : undefined
                }
                sparkline={isPrivacyMode ? undefined : hasData ? sparkData : undefined}
              />

              {/* Status & Date Range Customization Popover */}
              {isDropdownOpen && (
                <div
                  ref={popoverRef}
                  className={cn(
                    "absolute top-11 z-50 w-[calc(100vw-32px)] max-w-sm sm:w-88 bg-white/95 dark:bg-zinc-900/95 border border-zinc-200/90 dark:border-zinc-800 rounded-2xl shadow-2xl p-3 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md",
                    i >= 2 ? "right-0 left-auto" : "left-0 right-auto"
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Popover Header with Reset actions */}
                  <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-subtle">
                    <div className="flex items-center gap-1.5">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-accent" />
                      <span className="text-xs font-semibold text-ink">
                        {lang === "km"
                          ? `កំណត់កាតទី ${i + 1} (Status & ចងថ្ងៃ)`
                          : `Card ${i + 1} Configuration`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleResetCard(i)}
                        className="text-[10px] font-medium text-ink-muted hover:text-accent px-1.5 py-0.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                        title={lang === "km" ? "កំណត់កាតនេះដូចដើម" : "Reset this card"}
                      >
                        {lang === "km" ? "កាតនេះ" : "This card"}
                      </button>
                      <span className="text-zinc-300 dark:text-zinc-700 text-[10px]">|</span>
                      <button
                        type="button"
                        onClick={handleResetAll}
                        className="text-[10px] font-medium text-ink-muted hover:text-accent px-1.5 py-0.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors inline-flex items-center gap-1 cursor-pointer"
                        title={lang === "km" ? "កំណត់ទាំង ៤ មកដូចដើម" : "Reset all to default"}
                      >
                        <RotateCcw className="w-2.5 h-2.5" />
                        <span>{lang === "km" ? "ទាំងអស់" : "All"}</span>
                      </button>
                    </div>
                  </div>

                  {/* 2 Tabs: 1. Status | 2. Date Range (ចងថ្ងៃ) */}
                  <div className="flex p-0.5 mb-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setPopoverTab("status")}
                      className={cn(
                        "flex-1 py-1.5 px-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                        popoverTab === "status"
                          ? "bg-white dark:bg-zinc-900 text-ink shadow-sm"
                          : "text-ink-muted hover:text-ink"
                      )}
                    >
                      <Tag className="w-3.5 h-3.5 text-accent" />
                      <span>{lang === "km" ? "១. ស្ថានភាព (Status)" : "1. Status"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPopoverTab("date")}
                      className={cn(
                        "flex-1 py-1.5 px-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer relative",
                        popoverTab === "date"
                          ? "bg-white dark:bg-zinc-900 text-ink shadow-sm"
                          : "text-ink-muted hover:text-ink"
                      )}
                    >
                      <Calendar className="w-3.5 h-3.5 text-accent" />
                      <span>{lang === "km" ? "២. ចងថ្ងៃ (Date Range)" : "2. Date Range"}</span>
                      {config.datePreset !== "all" && (
                        <span className="w-2 h-2 rounded-full bg-accent animate-pulse shrink-0" />
                      )}
                    </button>
                  </div>

                  {/* TAB 1: STATUS SELECTION */}
                  {popoverTab === "status" && (
                    <div className="space-y-3">
                      <div className="max-h-64 overflow-y-auto space-y-3 pr-1 av-scrollbar">
                        {CATEGORY_ORDER.map((cat) => {
                          const metricsInCat = METRIC_DEFS.filter((m) => m.category === cat);
                          const catLabel =
                            lang === "km" ? CATEGORY_LABELS[cat].km : CATEGORY_LABELS[cat].en;

                          return (
                            <div key={cat} className="space-y-1">
                              <div className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted/80">
                                {catLabel}
                              </div>
                              <div className="space-y-0.5">
                                {metricsInCat.map((m) => {
                                  const MetricIcon = m.icon;
                                  const isCurrentStatus = config.metricId === m.id;
                                  const title = getMetricTitle(m, t, lang);
                                  const mCount = countItemsForConfig(
                                    { ...config, metricId: m.id },
                                    items,
                                    dbStats
                                  );

                                  return (
                                    <button
                                      key={m.id}
                                      type="button"
                                      onClick={() => handleSelectStatus(i, m.id)}
                                      className={cn(
                                        "w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-left transition-colors text-xs group cursor-pointer",
                                        isCurrentStatus
                                          ? "bg-accent/15 text-accent font-medium shadow-soft-xs"
                                          : "text-ink hover:bg-black/5 dark:hover:bg-white/5"
                                      )}
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <div
                                          className={cn(
                                            "w-6 h-6 rounded-lg grid place-items-center shrink-0 transition-colors",
                                            isCurrentStatus
                                              ? "bg-accent text-accent-fg"
                                              : "bg-subtle text-ink-muted group-hover:text-ink"
                                          )}
                                        >
                                          <MetricIcon className="w-3.5 h-3.5" />
                                        </div>
                                        <span className="truncate">{title}</span>
                                      </div>

                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <span
                                          className={cn(
                                            "px-1.5 py-0.5 rounded-full text-[10px] tabular-nums font-semibold",
                                            isCurrentStatus
                                              ? "bg-accent/20 text-accent"
                                              : "bg-subtle text-ink-muted"
                                          )}
                                        >
                                          {mCount}
                                        </span>
                                        {isCurrentStatus && (
                                          <Check className="w-3.5 h-3.5 text-accent shrink-0" />
                                        )}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Shortcut to Date Binding tab */}
                      <div className="pt-2 border-t border-subtle flex items-center justify-between">
                        <span className="text-[11px] text-ink-muted">
                          {lang === "km"
                            ? "ចង់កំណត់កាលបរិច្ឆេទសម្រាប់កាតនេះ?"
                            : "Want to bind date for this card?"}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPopoverTab("date")}
                          className="text-[11px] font-semibold text-accent hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span>{lang === "km" ? "ចងថ្ងៃ (Date Range)" : "Bind Date"}</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: DATE RANGE BINDING (កន្លែងចងថ្ងៃ) */}
                  {popoverTab === "date" && (
                    <div className="space-y-3">
                      <div>
                        <div className="text-[11px] font-semibold text-ink mb-1.5 flex items-center justify-between">
                          <span>
                            {lang === "km"
                              ? "ជ្រើសរើសចន្លោះថ្ងៃ (Date Window):"
                              : "Select Date Preset:"}
                          </span>
                          {config.datePreset !== "all" && (
                            <button
                              type="button"
                              onClick={() => handleSelectDatePreset(i, "all")}
                              className="text-[10px] text-accent hover:underline cursor-pointer"
                            >
                              {lang === "km" ? "ដោះចងថ្ងៃ (Clear)" : "Clear date filter"}
                            </button>
                          )}
                        </div>

                        {/* Presets Grid */}
                        <div className="grid grid-cols-3 gap-1.5">
                          {DATE_PRESETS.map((p) => {
                            const isSelected = config.datePreset === p.id;
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => handleSelectDatePreset(i, p.id)}
                                className={cn(
                                  "px-2 py-1.5 rounded-lg text-center text-[11px] transition-all cursor-pointer font-medium truncate",
                                  isSelected
                                    ? "bg-accent text-accent-fg font-semibold shadow-soft-xs"
                                    : "bg-subtle text-ink hover:bg-black/5 dark:hover:bg-white/5"
                                )}
                              >
                                {lang === "km" ? p.shortKm : p.labelEn}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Custom Date Range Picker (From -> To) */}
                      <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-subtle space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-ink flex items-center gap-1.5">
                            <CalendarRange className="w-3.5 h-3.5 text-accent" />
                            {lang === "km"
                              ? "កំណត់ថ្ងៃផ្ទាល់ខ្លួន (ចាប់ពីថ្ងៃ ដល់ថ្ងៃ)"
                              : "Custom Range (From Date → To Date)"}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-medium text-ink-muted mb-0.5">
                              {lang === "km" ? "ចាប់ពីថ្ងៃ (From)" : "From Date"}
                            </label>
                            <input
                              type="date"
                              value={config.fromDate || ""}
                              onChange={(e) =>
                                handleCustomDateChange(i, "fromDate", e.target.value)
                              }
                              className="w-full text-xs px-2 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-ink focus:ring-1 focus:ring-accent outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-ink-muted mb-0.5">
                              {lang === "km" ? "ដល់ថ្ងៃ (To)" : "To Date"}
                            </label>
                            <input
                              type="date"
                              value={config.toDate || ""}
                              onChange={(e) =>
                                handleCustomDateChange(i, "toDate", e.target.value)
                              }
                              className="w-full text-xs px-2 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-ink focus:ring-1 focus:ring-accent outline-none"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Live Count & Apply Footer */}
                      <div className="pt-2 border-t border-subtle flex items-center justify-between gap-2">
                        <div className="text-[11px] text-ink-muted truncate">
                          {lang === "km" ? "លទ្ធផលសរុប៖ " : "Total: "}
                          <span className="font-bold text-ink">
                            {cardCount} {lang === "km" ? "គ្រឿង" : "tickets"}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveDropdown(null);
                            toast.success(
                              lang === "km"
                                ? "បានកំណត់ស្ថានភាព & កាលបរិច្ឆេទជោគជ័យ!"
                                : "Card settings saved!",
                              { position: "bottom-right", duration: 2000 }
                            );
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-accent text-accent-fg text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer inline-flex items-center gap-1 shadow-soft-xs"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{lang === "km" ? "រួចរាល់ (Done)" : "Done"}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* QuickBooks Online Floating Privacy Card */}
      {isPrivacyMode && (
        <div className="flex justify-center pt-1 pb-1">
          <button
            type="button"
            onClick={togglePrivacyMode}
            className="inline-flex items-center gap-3 px-6 py-3 bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700 rounded-xl shadow-md hover:shadow-lg transition-all text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:text-blue-600 dark:hover:text-blue-400 group cursor-pointer"
          >
            <div className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 group-hover:bg-blue-50 dark:group-hover:bg-blue-950/40 text-zinc-700 dark:text-zinc-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              <Lock className="w-4 h-4" />
            </div>
            <span>
              {lang === "km"
                ? "មើលព័ត៌មាន និងស្ថិតិលម្អិតដោយបិទភាពឯកជន (Click to turn privacy off)"
                : "See your financial info by turning privacy off"}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
