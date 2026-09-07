"use client";

/**
 * @file GlobalSearch.tsx
 * @description Command Palette Modal — the system-wide search, redesigned
 * from a floating dropdown anchored to the header input into a centered
 * modal that matches the Aura Velvet reference design (localhost:3001).
 *
 * ── Two states ────────────────────────────────────────────────────────────
 *
 * EMPTY STATE  (modal open, no text typed yet)
 *   Shows 5 navigation shortcuts sourced from `config/navigation.ts`.
 *   The first item is highlighted. Arrow keys move the selection; Enter
 *   navigates; Esc closes. Keyboard shortcut badges show on the right.
 *
 * SEARCH STATE  (2+ characters typed)
 *   Navigation list disappears. Real search results take over — the existing
 *   multi-category fetch (Tickets, Spare Parts, Customers, Items, Users) with
 *   category tabs, count badges and status chips. All data + logic unchanged.
 *
 * ── Trigger ───────────────────────────────────────────────────────────────
 *   Click the search button in the header, OR press Ctrl+K / Cmd+K anywhere.
 *   Esc always closes.
 *
 * ── Backdrop ─────────────────────────────────────────────────────────────
 *   Uses `ModalWrapper` — the shared component that applies `av-scrim`
 *   (backdrop-filter blur + dim) consistently with every other modal in
 *   the app. The blur is NOT re-implemented here.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, usePathname } from "next/navigation";
import {
  Search, Loader2, FileText, Wrench, Users, Package, Sparkles,
  Home, BarChart2, ArrowRight, Command, Smartphone, Table as TableIcon,
} from "lucide-react";
import { useCompanionScanner } from "@/context/CompanionScannerContext";
import HighlightText from "./HighlightText";

const AllTicketsSearchModal = dynamic(() => import("./AllTicketsSearchModal"), { ssr: false });
import {
  fetchRepairServices,
  fetchSparePartsInventory,
  fetchCustomerCenter,
  fetchItemsInventory,
  type RepairServiceItem,
  type SparePartItem,
  type CustomerItem,
  type ItemModel,
} from "@/services/api";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useInfiniteList } from "@/hooks/useInfiniteList";
import InfiniteScrollStatus from "./InfiniteScrollStatus";
import { useI18n } from "@/i18n/LanguageProvider";
import { translateStatus } from "@/i18n/statusLabel";
import { fetchUserMap, type UserDto } from "@/services/userService";
import { ADMIN_ROLES } from "@/services/authSession";
import { useHasRole } from "./RequireRole";
import { useAiAssistant } from "./ai/AiAssistantProvider";
import { useActionHandler } from "./ActionBus";
import { ModalWrapper } from "@/components/av/ModalWrapper";

// ─── Status maps ──────────────────────────────────────────────────────────────

const STATUS_ROUTES: Record<string, string> = {
  "Item Recieved":             "/receive-item",
  "Received":                  "/receive-item",
  "Inspecting":                "/inspect-item",
  "Inspection":                "/inspection",
  "Awaiting Sparepart":        "/spare-request",
  "Awaiting Customer Confirm": "/waiting-confirm",
  "Sale Confirmed":            "/confirmed-sale",
  "Sent Spareparts":           "/approve-repair",
  "Repairing":                 "/approve-repair",
  "Finished":                  "/approve-verify",
  "Customer Rejected":         "/rejected",
  "Unrepairable":              "/unrepairable",
  "Repair by Third-Party":     "/approve-repair",
};

const STATUS_BADGE: Record<string, string> = {
  "Finished":                  "bg-success-soft text-success-fg",
  "Awaiting Customer Confirm": "bg-warning-soft text-warning-fg",
  "Awaiting Sparepart":        "bg-info-soft text-info-fg",
  "Customer Rejected":         "bg-danger-soft text-danger-fg",
  "Unrepairable":              "bg-warning-soft text-warning-fg",
  "Repair by Third-Party":     "bg-accent-soft text-accent",
};

// ─── Style tokens ─────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;
const PREVIEW_SIZE = 5;

type SearchCategory = "tickets" | "spareParts" | "customers" | "items" | "users";

const TAB_CLS =
  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold whitespace-nowrap transition-colors";

const LIST_CLS = "p-2 space-y-1";

const ROW_CLS =
  "group w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left " +
  "transition-colors cursor-pointer";

const ROW_ICON_CLS =
  "w-7.5 h-7.5 lg:w-7.5 lg:h-7.5 xl:w-8.5 xl:h-8.5 rounded-xl bg-white/80 dark:bg-white/10 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0 " +
  "border border-black/[0.08] dark:border-white/[0.1] shadow-2xs transition-all";

const ROW_ICON_ACTIVE_CLS =
  "w-7.5 h-7.5 lg:w-7.5 lg:h-7.5 xl:w-8.5 xl:h-8.5 rounded-xl bg-accent text-accent-fg flex items-center justify-center shrink-0 shadow-sm";

const VIEW_ALL_CLS =
  "w-full px-3.5 py-2 rounded-2xl text-[12px] font-bold text-accent hover:bg-accent-soft transition-colors text-left";

const KBD_CLS =
  "font-mono font-bold px-1.5 py-0.5 rounded-md bg-white/80 dark:bg-white/15 border border-black/[0.08] dark:border-white/[0.1] text-slate-700 dark:text-slate-200 leading-none text-[10px] shadow-2xs";

// ─── Navigation shortcuts shown in the empty state ────────────────────────────

interface NavShortcut {
  id: string;
  title: string;
  category: string;
  icon: React.ElementType;
  shortcut?: string;
  run: () => void;
}

// ─── Secondary results type ───────────────────────────────────────────────────

interface SecondaryResults {
  query: string;
  spareParts: SparePartItem[];
  sparePartsTotal: number;
  customers: CustomerItem[];
  customersTotal: number;
  items: ItemModel[];
  itemsTotal: number;
  users: UserDto[];
  usersTotal: number;
}

const EMPTY_SECONDARY: SecondaryResults = {
  query: "",
  spareParts: [], sparePartsTotal: 0,
  customers: [], customersTotal: 0,
  items: [], itemsTotal: 0,
  users: [], usersTotal: 0,
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function GlobalSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const { openPairingModal } = useCompanionScanner();
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [tableSearchQuery, setTableSearchQuery] = useState("");
  const [selectedNavIndex, setSelectedNavIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { t, lang } = useI18n();
  const isKhmer = lang === "km";

  const canAdminister = useHasRole(ADMIN_ROLES);
  const canAdministerRef = useRef(false);
  useEffect(() => {
    canAdministerRef.current = canAdminister === true;
  }, [canAdminister]);

  const debouncedTerm = useDebouncedValue(term, 300);
  const ai = useAiAssistant();

  const openTableModal = useCallback((queryToPass?: string) => {
    const q = (queryToPass !== undefined ? queryToPass : (debouncedTerm.trim() || term.trim())).trim();
    setTableSearchQuery(q);
    setIsTableModalOpen(true);
    setOpen(false);
  }, [debouncedTerm, term]);

  // ── Open with Ctrl+K / Cmd+K / Ctrl+/ / Alt+K / Ctrl+J (Conflict-free with Chrome) ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;
      /*
        `e.key` can be `undefined`, not just absent-per-spec `""`. The DOM
        spec says an uninitialised `KeyboardEvent.key` defaults to `""`, but a
        handful of real dispatchers ignore that: some IME composition steps,
        on-screen/touch keyboards, and at least one password-manager
        extension's injected `keydown` construct a bare event with no `key`
        property at all. `e.key.toLowerCase()` then throws — a capture-phase
        `window` listener, so the crash takes down whichever page the user
        happened to be on, not something specific to that route.

        `e.code` is the physical key position and is far more reliably
        populated by non-standard dispatchers, which is exactly why this
        handler already OR'd it in — the `?? ""` here just stops the guard
        that was already half-written from crashing on its other half.
      */
      const key = e.key ?? "";
      const isKeyK = key.toLowerCase() === "k" || e.code === "KeyK";
      const isSlash = key === "/" || e.code === "Slash";
      const isKeyJ = key.toLowerCase() === "j" || e.code === "KeyJ";

      // Match: Ctrl+K, Cmd+K, Ctrl+/, Cmd+/, Alt+K, or Ctrl+J
      if ((isCmdOrCtrl && isKeyK) || (isCmdOrCtrl && isSlash) || (e.altKey && isKeyK) || (isCmdOrCtrl && isKeyJ)) {
        e.preventDefault();
        e.stopPropagation();
        setOpen((prev) => !prev);
      }
    };

    // Use capturing phase (true) on window so our handler intercepts before Chrome's default browser handler!
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  // ── Auto-focus the input when modal opens ──────────────────────────────────
  useEffect(() => {
    if (open) {
      const id = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(id);
    } else {
      queueMicrotask(() => {
        setTerm("");
        setSelectedNavIndex(0);
      });
    }
  }, [open]);

  // ── AI Assistant action ────────────────────────────────────────────────────
  useActionHandler("ui.globalSearch", (_ref, values) => {
    if (values?.query !== undefined) setTerm(values.query);
    setOpen(true);
    return true;
  });

  const askAssistant = useCallback(() => {
    const question = term.trim();
    if (!ai) return;
    setOpen(false);
    if (question.length >= 2) {
      ai.ask(question);
      setTerm("");
    } else {
      ai.setOpen(true);
    }
  }, [term, ai]);

  // ── Navigation shortcuts (empty state) ────────────────────────────────────
  const navShortcuts: NavShortcut[] = useMemo(() => [
    {
      id: "nav-all-tickets-table",
      title: isKhmer ? "តារាងស្វែងរកសំបុត្រទាំងអស់ (All Tickets Search)" : "All Tickets Table Search",
      category: "Action",
      icon: TableIcon,
      shortcut: "G T",
      run: () => openTableModal(""),
    },
    {
      id: "nav-scanner",
      title: isKhmer ? "ស្កេន Barcode ដោយទូរស័ព្ទ (Mobile Scanner)" : "Mobile Companion Barcode Scanner",
      category: "Action",
      icon: Smartphone,
      shortcut: "G M",
      run: () => { setOpen(false); openPairingModal(); },
    },
    {
      id: "nav-home",
      title: isKhmer ? "ទៅកាន់ ផ្ទាំងគ្រប់គ្រង (Home)" : "Go to Dashboard (Home)",
      category: "Navigation",
      icon: Home,
      shortcut: "G D",
      run: () => { router.push("/"); setOpen(false); },
    },
    {
      id: "nav-spareparts",
      title: isKhmer ? "ទៅកាន់ SparePart Item Inventory" : "Go to SparePart Item Inventory",
      category: "Navigation",
      icon: Wrench,
      shortcut: "G S",
      run: () => { router.push("/spareparts"); setOpen(false); },
    },
    {
      id: "nav-customers",
      title: isKhmer ? "ទៅកាន់ Customer Center" : "Go to Customer Center",
      category: "Navigation",
      icon: Users,
      shortcut: "G C",
      run: () => { router.push("/customers"); setOpen(false); },
    },
    {
      id: "nav-reports",
      title: isKhmer ? "ទៅកាន់ Reports" : "Go to Reports",
      category: "Navigation",
      icon: BarChart2,
      shortcut: "G R",
      run: () => { router.push("/daily-report"); setOpen(false); },
    },
    {
      id: "nav-ai",
      title: isKhmer ? "AI Assistant" : "AI Assistant",
      category: "Action",
      icon: Sparkles,
      shortcut: "⌘ A",
      run: () => { setOpen(false); ai?.setOpen(true); },
    },
  ], [router, ai, isKhmer]);

  // ── Arrow key navigation in empty state ───────────────────────────────────
  const searchActive = debouncedTerm.trim().length >= 2;

  useEffect(() => {
    if (!open || searchActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedNavIndex((p) => (p + 1) % navShortcuts.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedNavIndex((p) => (p - 1 + navShortcuts.length) % navShortcuts.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        navShortcuts[selectedNavIndex]?.run();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, searchActive, navShortcuts, selectedNavIndex]);

  // Reset nav selection when filter changes
  useEffect(() => {
    queueMicrotask(() => {
      setSelectedNavIndex(0);
    });
  }, [term]);

  // ── Search data ────────────────────────────────────────────────────────────
  const query = debouncedTerm.trim();

  const [secondary, setSecondary] = useState<SecondaryResults>(EMPTY_SECONDARY);

  const {
    items: tickets,
    totalCount: ticketsTotal,
    isLoading: ticketsLoading,
    isLoadingMore: ticketsLoadingMore,
    reachedEnd: ticketsReachedEnd,
    limitReached: ticketsLimitReached,
    scrollRootRef,
    sentinelRef,
  } = useInfiniteList<RepairServiceItem, HTMLDivElement, HTMLDivElement>({
    fetchPage: (pageNumber, size) =>
      fetchRepairServices(pageNumber, size, "All", query),
    pageSize: PAGE_SIZE,
    resetKey: query,
    getId: (i) => i?.id,
    disabled: !searchActive,
  });

  useEffect(() => {
    let cancelled = false;
    if (!searchActive) return;
    void (async () => {
      const [sp, cu, it, userMap] = await Promise.all([
        fetchSparePartsInventory(1, PREVIEW_SIZE, query),
        fetchCustomerCenter(1, PREVIEW_SIZE, query),
        fetchItemsInventory(1, PREVIEW_SIZE, query),
        fetchUserMap(),
      ]);
      if (cancelled) return;

      const matchingUsers: UserDto[] = [];
      if (canAdministerRef.current && userMap && userMap.size > 0) {
        const qLower = query.toLowerCase().trim();
        const seen = new Set<string>();
        userMap.forEach((u) => {
          if (!seen.has(u.id)) {
            seen.add(u.id);
            const fn = `${u.firstName || ""} ${u.lastName || ""}`.toLowerCase();
            const un = (u.userName || "").toLowerCase();
            const em = (u.email || "").toLowerCase();
            const rl = (u.roles || []).join(" ").toLowerCase();
            if (!qLower || fn.includes(qLower) || un.includes(qLower) || em.includes(qLower) || rl.includes(qLower)) {
              matchingUsers.push(u);
            }
          }
        });
      }

      setSecondary({
        query,
        spareParts: sp.items ?? [], sparePartsTotal: sp.totalCount ?? 0,
        customers: cu.items ?? [], customersTotal: cu.totalCount ?? 0,
        items: it.items ?? [], itemsTotal: it.totalCount ?? 0,
        users: matchingUsers.slice(0, PREVIEW_SIZE), usersTotal: matchingUsers.length,
      });
    })();
    return () => { cancelled = true; };
  }, [query, searchActive]);

  const secondaryReady = !searchActive || secondary.query === query;
  const shown = searchActive && secondary.query === query ? secondary : EMPTY_SECONDARY;
  const loading = searchActive && (ticketsLoading || !secondaryReady);

  const [activeCategory, setActiveCategory] = useState<SearchCategory>("tickets");
  const [prevQuery, setPrevQuery] = useState(query);
  if (query !== prevQuery) {
    setPrevQuery(query);
    setActiveCategory("tickets");
  }

  const hasAnyResults =
    tickets.length > 0 ||
    shown.sparePartsTotal > 0 ||
    shown.customersTotal > 0 ||
    shown.itemsTotal > 0 ||
    shown.usersTotal > 0;

  const categoryTabs: Array<{ key: SearchCategory; icon: React.ElementType; label: string; count: number }> = [
    { key: "tickets",    icon: FileText, label: t("header.searchTabTickets"),        count: ticketsTotal },
    { key: "spareParts", icon: Wrench,   label: t("header.searchSectionSpareParts"), count: shown.sparePartsTotal },
    { key: "customers",  icon: Users,    label: t("header.searchSectionCustomers"),  count: shown.customersTotal },
    { key: "items",      icon: Package,  label: t("header.searchSectionItems"),      count: shown.itemsTotal },
  ];

  const goToRoute = useCallback((route: string, q: string) => {
    const href = q ? `${route}?q=${encodeURIComponent(q)}` : route;
    if (pathname === route) {
      window.location.href = href;
      return;
    }
    router.push(href);
    setOpen(false);
    setTerm("");
  }, [router, pathname]);

  const goToTicket = useCallback((ticket: RepairServiceItem) => {
    goToRoute(STATUS_ROUTES[ticket.status] ?? "/", ticket.reportNo || ticket.serialNumber || "");
  }, [goToRoute]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Header Trigger Button ──────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs bg-cushion border border-subtle rounded-lg text-ink-muted hover:border-accent/30 hover:text-ink-secondary transition-[color,background-color,border-color,box-shadow,opacity,transform,filter] group"
        aria-label={t("header.searchPlaceholder")}
      >
        <Search className="w-3.5 h-3.5 shrink-0" />
        <span className="flex-1 text-left truncate">{t("header.searchPlaceholder")}</span>
        <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-surface border border-subtle text-[10px] font-mono text-ink-muted shadow-sm shrink-0">
          <Command className="w-2.5 h-2.5" />K
        </kbd>
      </button>

      {/* ── Command Palette Modal ─────────────────────────────────────────── */}
      <ModalWrapper
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="max-w-lg xl:max-w-xl"
        zIndex={200}
        labelledBy="global-search-heading"
        placement="top"
        backdropVariant="heavy"
        isCommandPalette={true}
      >
        {/* Search Input Bar — reference: CommandPalette.tsx L186-199 */}
        <div className="flex items-center gap-2.5 px-4 py-3 xl:px-5 xl:py-3.5 border-b border-black/[0.05] dark:border-white/[0.08]">
          <Search className="w-4 h-4 xl:w-5 xl:h-5 text-accent shrink-0" />
          <input
            ref={inputRef}
            id="global-search-heading"
            type="text"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && term.trim().length >= 2) {
                e.preventDefault();
                askAssistant();
              }
            }}
            placeholder={t("header.searchPlaceholder")}
            className="flex-1 bg-transparent text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 outline-none"
            autoComplete="off"
          />
          <div className="flex items-center gap-1.5 xl:gap-2 shrink-0">
            {loading && <Loader2 className="w-3.5 h-3.5 text-slate-600 animate-spin" />}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                openPairingModal();
              }}
              title={isKhmer ? "ស្កេនដោយទូរស័ព្ទដៃ (G M)" : "Scan with Phone (G M)"}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/25 border border-cyan-500/30 transition-colors"
            >
              <Smartphone className="w-3 h-3" />
              <span className="hidden sm:inline">{isKhmer ? "ទូរស័ព្ទ" : "Phone"}</span>
            </button>
            <button
              type="button"
              onClick={askAssistant}
              title={t("ai.panelTitle")}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold bg-gradient-to-r from-accent to-accent-hover text-white hover:opacity-90 shadow-sm transition-[color,background-color,border-color,box-shadow,opacity,transform,filter]"
            >
              <Sparkles className="w-3 h-3" />
              <span>AI</span>
            </button>
            <kbd className={KBD_CLS}>esc</kbd>
          </div>
        </div>

        {/* Panel Body */}
        <div
          ref={searchActive ? scrollRootRef : undefined}
          className="max-h-64 sm:max-h-72 xl:max-h-80 overflow-y-auto"
        >
          {/* ── EMPTY STATE: navigation shortcuts ─── */}
          {!searchActive && (
            <div className="p-2 space-y-1">
              {navShortcuts.map((item, idx) => {
                const Icon = item.icon;
                const isSelected = selectedNavIndex === idx;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={item.run}
                    onMouseEnter={() => setSelectedNavIndex(idx)}
                    className={`${ROW_CLS} ${isSelected ? "bg-accent/10 border border-accent/20 shadow-2xs" : "border border-transparent hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"}`}
                  >
                    <div className={isSelected ? ROW_ICON_ACTIVE_CLS : ROW_ICON_CLS}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className={`text-[13px] font-bold truncate ${isSelected ? "text-accent" : "text-slate-900 dark:text-slate-100"}`}>
                        {item.title}
                      </p>
                      <p className={`text-[11px] font-semibold mt-0.5 ${isSelected ? "text-accent" : "text-slate-600 dark:text-slate-300"}`}>
                        {item.category}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {item.shortcut && (
                        <kbd className={`${KBD_CLS} ${isSelected ? "bg-accent/15 border-accent/30 text-accent font-bold" : ""}`}>
                          {item.shortcut}
                        </kbd>
                      )}
                      {isSelected && <ArrowRight className="w-3.5 h-3.5 text-accent" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* ── SEARCH STATE: real results ─── */}
          {searchActive && (
            loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-slate-600" />
              </div>
            ) : !hasAnyResults ? (
              <p className="px-4 py-8 text-xs font-semibold text-slate-600 dark:text-slate-300 text-center">
                {t("header.searchNoMatchAny", { term: term.trim() })}
              </p>
            ) : (
              <>
                {/* Category tabs */}
                <div className="sticky top-0 z-10 flex items-center gap-1.5 px-2.5 py-2 border-b border-black/[0.05] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02] overflow-x-auto">
                  {categoryTabs.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveCategory(tab.key)}
                      className={`${TAB_CLS} ${
                        activeCategory === tab.key
                          ? "bg-accent text-white shadow-xs"
                          : "text-slate-700 dark:text-slate-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.08]"
                      }`}
                    >
                      <tab.icon className="w-3.5 h-3.5" />
                      {tab.label}
                      <span
                        className={`px-1.5 rounded-full text-[10px] font-bold ${
                          activeCategory === tab.key
                            ? "bg-white/20 text-white"
                            : "bg-black/[0.06] dark:bg-white/10 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {tab.count}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Tickets */}
                {activeCategory === "tickets" && (
                  tickets.length === 0 ? (
                    <p className="px-4 py-4 text-xs font-semibold text-slate-600 dark:text-slate-300 text-center">
                      {t("header.searchNoMatch", { term: term.trim() })}
                    </p>
                  ) : (
                    <div className={LIST_CLS}>
                      {/* Full Table View Quick Action Banner */}
                      <div className="flex items-center justify-between px-3 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl mb-1.5 text-[11px]">
                        <span className="font-semibold text-indigo-700 dark:text-indigo-300">
                          {isKhmer ? `សំបុត្រសរុប ${ticketsTotal} ត្រូវនឹង "${query}"` : `${ticketsTotal} tickets match "${query}"`}
                        </span>
                        <button
                          type="button"
                          onClick={() => openTableModal(query)}
                          className="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 hover:underline"
                        >
                          <TableIcon className="w-3.5 h-3.5" />
                          {isKhmer ? "មើលក្នុងទម្រង់តារាងពេញ →" : "View in Full Table →"}
                        </button>
                      </div>

                      {tickets.map((ticket) => (
                        <button
                          key={ticket.id}
                          type="button"
                          onClick={() => goToTicket(ticket)}
                          className={`${ROW_CLS} hover:bg-accent/10`}
                        >
                          <div className={`${ROW_ICON_CLS} group-hover:bg-accent group-hover:text-accent-fg group-hover:border-transparent`}>
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-bold font-mono text-slate-900 dark:text-slate-100 truncate">
                              <HighlightText text={ticket.reportNo || "—"} query={query} />
                            </p>
                            <p className="text-[11.5px] font-medium text-slate-700 dark:text-slate-200 truncate mt-0.5">
                              <HighlightText
                                text={[ticket.companyName, ticket.itemName, ticket.serialNumber].filter(Boolean).join(" · ")}
                                query={query}
                              />
                            </p>
                          </div>
                          <span
                            className={`shrink-0 text-[10px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap shadow-2xs ${
                              STATUS_BADGE[ticket.status] ?? "bg-black/[0.06] text-slate-700 dark:text-slate-200"
                            }`}
                          >
                            {translateStatus(ticket.status, t)}
                          </span>
                        </button>
                      ))}
                      <div ref={sentinelRef} className="px-3 py-2 text-center text-xs font-semibold text-slate-600 dark:text-slate-300">
                        <InfiniteScrollStatus
                          isLoadingMore={ticketsLoadingMore}
                          reachedEnd={ticketsReachedEnd}
                          limitReached={ticketsLimitReached}
                          count={tickets.length}
                        />
                      </div>
                    </div>
                  )
                )}

                {/* Spare Parts */}
                {activeCategory === "spareParts" && (
                  shown.spareParts.length === 0 ? (
                    <p className="px-4 py-4 text-xs font-semibold text-slate-600 dark:text-slate-300 text-center">{t("msg.noSparePartsFound")}</p>
                  ) : (
                    <div className={LIST_CLS}>
                      {shown.spareParts.map((part) => (
                        <button
                          key={part.id}
                          type="button"
                          onClick={() => goToRoute("/spareparts", part.itemName || part.serialNumber || part.partNumber || "")}
                          className={`${ROW_CLS} hover:bg-accent/10`}
                        >
                          <div className={`${ROW_ICON_CLS} group-hover:bg-accent group-hover:text-accent-fg group-hover:border-transparent`}>
                            <Wrench className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-bold text-slate-900 dark:text-slate-100 truncate">
                              <HighlightText text={part.itemName || "—"} query={query} />
                            </p>
                            <p className="text-[11.5px] font-medium text-slate-700 dark:text-slate-200 truncate mt-0.5">
                              <HighlightText
                                text={[part.partNumber || part.serialNumber, part.useFor].filter(Boolean).join(" · ")}
                                query={query}
                              />
                            </p>
                          </div>
                        </button>
                      ))}
                      {shown.sparePartsTotal > shown.spareParts.length && (
                        <button type="button" onClick={() => goToRoute("/spareparts", query)} className={VIEW_ALL_CLS}>
                          {t("header.searchViewAllSpareParts", { count: shown.sparePartsTotal })}
                        </button>
                      )}
                    </div>
                  )
                )}

                {/* Customers */}
                {activeCategory === "customers" && (
                  shown.customers.length === 0 ? (
                    <p className="px-4 py-4 text-xs font-semibold text-slate-600 dark:text-slate-300 text-center">{t("msg.noCustomersFound")}</p>
                  ) : (
                    <div className={LIST_CLS}>
                      {shown.customers.map((cust) => (
                        <button
                          key={cust.id}
                          type="button"
                          onClick={() => goToRoute("/customers", cust.companyName || cust.contactName || "")}
                          className={`${ROW_CLS} hover:bg-accent/10`}
                        >
                          <div className={`${ROW_ICON_CLS} group-hover:bg-accent group-hover:text-accent-fg group-hover:border-transparent`}>
                            <Users className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-bold text-slate-900 dark:text-slate-100 truncate">
                              <HighlightText text={cust.companyName || "—"} query={query} />
                            </p>
                            <p className="text-[11.5px] font-medium text-slate-700 dark:text-slate-200 truncate mt-0.5">
                              <HighlightText
                                text={[cust.contactName, cust.phoneNumber].filter(Boolean).join(" · ")}
                                query={query}
                              />
                            </p>
                          </div>
                        </button>
                      ))}
                      {shown.customersTotal > shown.customers.length && (
                        <button type="button" onClick={() => goToRoute("/customers", query)} className={VIEW_ALL_CLS}>
                          {t("header.searchViewAllCustomers", { count: shown.customersTotal })}
                        </button>
                      )}
                    </div>
                  )
                )}

                {/* Items */}
                {activeCategory === "items" && (
                  shown.items.length === 0 ? (
                    <p className="px-4 py-4 text-xs font-semibold text-slate-600 dark:text-slate-300 text-center">{t("msg.noItemsFound")}</p>
                  ) : (
                    <div className={LIST_CLS}>
                      {shown.items.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => goToRoute("/received-inventory", item.itemName || item.serialNumber || "")}
                          className={`${ROW_CLS} hover:bg-accent/10`}
                        >
                          <div className={`${ROW_ICON_CLS} group-hover:bg-accent group-hover:text-accent-fg group-hover:border-transparent`}>
                            <Package className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-bold text-slate-900 dark:text-slate-100 truncate">
                              <HighlightText text={item.itemName || "—"} query={query} />
                            </p>
                            <p className="text-[11.5px] font-medium text-slate-700 dark:text-slate-200 truncate mt-0.5">
                              <HighlightText
                                text={[item.serialNumber, item.itemType].filter(Boolean).join(" · ")}
                                query={query}
                              />
                            </p>
                          </div>
                        </button>
                      ))}
                      {shown.itemsTotal > shown.items.length && (
                        <button type="button" onClick={() => goToRoute("/received-inventory", query)} className={VIEW_ALL_CLS}>
                          {t("header.searchViewAllItems", { count: shown.itemsTotal })}
                        </button>
                      )}
                    </div>
                  )
                )}

                {/* Users */}
                {activeCategory === "users" && (
                  shown.users.length === 0 ? (
                    <p className="px-4 py-4 text-xs font-semibold text-slate-600 dark:text-slate-300 text-center">
                      {isKhmer ? "រកមិនឃើញគណនីអ្នកប្រើប្រាស់ឡើយ" : "No matching users found"}
                    </p>
                  ) : (
                    <div className={LIST_CLS}>
                      {shown.users.map((user) => {
                        const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.userName;
                        return (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() => goToRoute("/users", user.userName || fullName)}
                            className={`${ROW_CLS} hover:bg-accent/10`}
                          >
                            <div className="w-9 h-9 rounded-xl bg-accent text-white flex items-center justify-center shrink-0 font-bold text-xs shadow-xs">
                              {fullName.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-bold text-slate-900 dark:text-slate-100 truncate">
                                <HighlightText text={fullName} query={query} />{" "}
                                <span className="text-[10px] font-semibold text-slate-500">
                                  (@<HighlightText text={user.userName} query={query} />)
                                </span>
                              </p>
                              <p className="text-[11.5px] font-medium text-slate-700 dark:text-slate-200 truncate mt-0.5">
                                <HighlightText
                                  text={[user.email, user.roles?.join(", ")].filter(Boolean).join(" · ")}
                                  query={query}
                                />
                              </p>
                            </div>
                          </button>
                        );
                      })}
                      {shown.usersTotal > shown.users.length && (
                        <button type="button" onClick={() => goToRoute("/users", query)} className={VIEW_ALL_CLS}>
                          {isKhmer ? `មើលគណនីទាំង ${shown.usersTotal} ក្នុង Users & Roles →` : `View all ${shown.usersTotal} in Users & Roles →`}
                        </button>
                      )}
                    </div>
                  )
                )}
              </>
            )
          )}
        </div>

        {/* ── Footer kbd hints — always visible ────────────────── */}
        <div className="flex items-center justify-between gap-3 px-5 py-2.5 border-t border-black/[0.05] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02] text-[11px] font-bold text-slate-700 dark:text-slate-200">
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <kbd className={KBD_CLS}>↑</kbd>
            <kbd className={KBD_CLS}>↓</kbd>
            {t("header.searchHintNavigate")}
            <kbd className={`${KBD_CLS} ml-1`}>↵</kbd>
            {t("header.searchHintOpen")}
          </span>
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <kbd className={KBD_CLS}>esc</kbd>
            {t("header.searchHintDismiss")}
          </span>
        </div>
      </ModalWrapper>

      {/* ── All Tickets Search Table Modal ── */}
      {isTableModalOpen && (
        <AllTicketsSearchModal
          open={isTableModalOpen}
          onClose={() => setIsTableModalOpen(false)}
          initialQuery={tableSearchQuery}
        />
      )}
    </>
  );
}
