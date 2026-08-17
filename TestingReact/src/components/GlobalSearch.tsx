"use client";

/**
 * @file GlobalSearch.tsx
 * @description System-wide search in the header, across every major entity
 * in the app:
 * - Tickets — server-side `/technicalservices/search`, matching ReportNo,
 *   CompanyName, ContactName, item name, serial number and CustomerRequest.
 * - Spare Parts, Customers, Items, Users — each queried separately and shown
 *   as a preview list with category tabs.
 * - AI Assistant — handed over to the global AI Assistant chat panel (`@/components/ai`).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, usePathname } from "next/navigation";
import {
  Search, Loader2, FileText, Wrench, Users, Package, Sparkles,
} from "lucide-react";
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
import { useFloatingPanel } from "@/hooks/useFloatingPanel";
import { useInfiniteList } from "@/hooks/useInfiniteList";
import InfiniteScrollStatus from "./InfiniteScrollStatus";
import { useI18n } from "@/i18n/LanguageProvider";
import { translateStatus } from "@/i18n/statusLabel";
import { fetchUserMap, type UserDto } from "@/services/userService";
import { ADMIN_ROLES } from "@/services/authSession";
import { useHasRole } from "./RequireRole";
import { useAiAssistant } from "./ai/AiAssistantProvider";
import { useActionHandler } from "./ActionBus";

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
  "Finished":                  "bg-success-soft text-success-fg ",
  "Awaiting Customer Confirm": "bg-warning-soft text-warning-fg ",
  "Awaiting Sparepart":        "bg-info-soft text-info-fg ",
  "Customer Rejected":         "bg-danger-soft text-danger-fg ",
  "Unrepairable":              "bg-warning-soft text-warning-fg ",
  "Repair by Third-Party":     "bg-accent-soft text-accent ",
};

const PAGE_SIZE = 25;
const PREVIEW_SIZE = 5;

type SearchCategory = "tickets" | "spareParts" | "customers" | "items" | "users";

const TAB_CLS =
  "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors";
const ROW_CLS =
  "w-full flex items-center gap-3 px-3 py-2.5 hover:bg-cushion transition-colors text-left border-b border-subtle last:border-b-0";
const ROW_ICON_CLS =
  "w-8 h-8 rounded-lg bg-accent-soft text-accent flex items-center justify-center shrink-0";
const VIEW_ALL_CLS =
  "w-full px-3 py-2 text-[11px] font-semibold text-accent hover:bg-cushion transition-colors text-left";

function mergeRefs<T>(...refs: Array<React.Ref<T> | undefined>): React.RefCallback<T> {
  return (node) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === "function") ref(node);
      else (ref as React.MutableRefObject<T | null>).current = node;
    }
  };
}

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

export default function GlobalSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const { t, lang } = useI18n();
  const isKhmer = lang === "km";

  /**
   * Whether this user may search the staff directory. Mirrored into a ref so
   * the search effect can read the current value without listing it as a
   * dependency — it resolves shortly after mount, and re-running the effect
   * then would fire a second round of searches for the same query.
   */
  const canAdminister = useHasRole(ADMIN_ROLES);
  const canAdministerRef = useRef(false);
  useEffect(() => {
    canAdministerRef.current = canAdminister === true;
  }, [canAdminister]);

  const debouncedTerm = useDebouncedValue(term, 300);

  const { anchorRef, panelRef, coords } = useFloatingPanel<HTMLDivElement, HTMLDivElement>({
    open,
    onClose: () => setOpen(false),
    width: "match",
    estimatedHeight: 320,
    align: "start",
  });

  const ai = useAiAssistant();

  // Driving the header search on the user's behalf: the term is typed in and
  // the results panel opened, and that is where it stops. Which result to take
  // is a decision about their own work, so the assistant never picks one — same
  // rule as every dialog it opens.
  useActionHandler("ui.globalSearch", (_ref, values) => {
    // A request with no term opens the box as it stands rather than emptying
    // it — "open the search" shouldn't discard what is already typed there.
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

  const query = debouncedTerm.trim();
  const searchActive = query.length >= 2;

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
      // Read through a ref so this effect doesn't re-run (and re-issue four
      // searches) the moment the role check resolves after mount.
      const [sp, cu, it, userMap] = await Promise.all([
        fetchSparePartsInventory(1, PREVIEW_SIZE, query),
        fetchCustomerCenter(1, PREVIEW_SIZE, query),
        fetchItemsInventory(1, PREVIEW_SIZE, query),
        fetchUserMap(),
      ]);
      if (cancelled) return;

      // Staff accounts are an administrator's business, so they are only
      // matched for administrators. `fetchUserMap()` above still runs for
      // everyone — it resolves the names shown on ticket rows, which is a
      // different thing from searching the directory.
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

  const setPanelNode = useMemo(() => mergeRefs(panelRef, scrollRootRef), [panelRef, scrollRootRef]);

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

  const showPanel = open && searchActive;
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

  return (
    <div ref={anchorRef} className="relative w-full">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none" />
      <input
        type="text"
        value={term}
        onChange={(e) => {
          setTerm(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && term.trim().length >= 2) {
            e.preventDefault();
            askAssistant();
          }
        }}
        placeholder={t("header.searchPlaceholder")}
        className="w-full pl-9 pr-24 py-1.5 text-xs bg-cushion border border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all "
      />

      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
        {loading && <Loader2 className="w-3.5 h-3.5 text-ink-muted animate-spin" />}
        <button
          type="button"
          onClick={askAssistant}
          title={t("ai.panelTitle")}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold bg-gradient-to-r from-accent to-accent-hover text-white hover:from-accent hover:to-accent-hover shadow-sm transition-all"
        >
          <Sparkles className="w-3 h-3" />
          <span>AI</span>
        </button>
      </div>

      {showPanel && coords &&
        createPortal(
          <div
            ref={setPanelNode}
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              width: coords.width,
              transform: coords.placement === "top" ? "translateY(-100%)" : undefined,
            }}
            className={`z-[100] bg-elevated  border border-subtle  rounded-xl shadow-xl  overflow-hidden max-h-80 overflow-y-auto ${
              coords.placement === "top" ? "dropdown-panel-in-top" : "dropdown-panel-in"
            }`}
          >
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-ink-muted" />
              </div>
            ) : !hasAnyResults ? (
              <p className="px-4 py-4 text-xs text-ink-muted text-center">
                {t("header.searchNoMatchAny", { term: term.trim() })}
              </p>
            ) : (
              <>
                <div className="sticky top-0 z-10 flex items-center gap-1 px-2 py-1.5 bg-elevated border-b border-subtle overflow-x-auto">
                  {categoryTabs.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveCategory(tab.key)}
                      className={`${TAB_CLS} ${
                        activeCategory === tab.key
                          ? "bg-accent text-white"
                          : "text-ink-secondary hover:bg-sunken "
                      }`}
                    >
                      <tab.icon className="w-3.5 h-3.5" />
                      {tab.label}
                      <span
                        className={`px-1.5 rounded-full text-[10px] font-bold ${
                          activeCategory === tab.key
                            ? "bg-white/20"
                            : "bg-sunken text-ink-secondary "
                        }`}
                      >
                        {tab.count}
                      </span>
                    </button>
                  ))}
                </div>

                {activeCategory === "tickets" && (
                  tickets.length === 0 ? (
                    <p className="px-4 py-4 text-xs text-ink-muted text-center">
                      {t("header.searchNoMatch", { term: term.trim() })}
                    </p>
                  ) : (
                    <>
                      {tickets.map((ticket) => (
                        <button
                          key={ticket.id}
                          type="button"
                          onClick={() => goToTicket(ticket)}
                          className={ROW_CLS}
                        >
                          <div className={ROW_ICON_CLS}>
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold font-mono text-ink truncate">
                              {ticket.reportNo || "—"}
                            </p>
                            <p className="text-[11px] text-ink-secondary truncate">
                              {[ticket.companyName, ticket.itemName, ticket.serialNumber].filter(Boolean).join(" · ")}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                              STATUS_BADGE[ticket.status] ?? "bg-sunken text-ink-secondary "
                            }`}
                          >
                            {translateStatus(ticket.status, t)}
                          </span>
                        </button>
                      ))}
                      <div ref={sentinelRef} className="px-3 py-2 text-center">
                        <InfiniteScrollStatus
                          isLoadingMore={ticketsLoadingMore}
                          reachedEnd={ticketsReachedEnd}
                          limitReached={ticketsLimitReached}
                          count={tickets.length}
                        />
                      </div>
                    </>
                  )
                )}

                {activeCategory === "spareParts" && (
                  shown.spareParts.length === 0 ? (
                    <p className="px-4 py-4 text-xs text-ink-muted text-center">{t("msg.noSparePartsFound")}</p>
                  ) : (
                    <>
                      {shown.spareParts.map((part) => (
                        <button
                          key={part.id}
                          type="button"
                          onClick={() => goToRoute("/spareparts", part.itemName || part.serialNumber || part.partNumber || "")}
                          className={ROW_CLS}
                        >
                          <div className={ROW_ICON_CLS}>
                            <Wrench className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-ink truncate">
                              {part.itemName || "—"}
                            </p>
                            <p className="text-[11px] text-ink-secondary truncate">
                              {[part.partNumber || part.serialNumber, part.useFor].filter(Boolean).join(" · ")}
                            </p>
                          </div>
                        </button>
                      ))}
                      {shown.sparePartsTotal > shown.spareParts.length && (
                        <button type="button" onClick={() => goToRoute("/spareparts", query)} className={VIEW_ALL_CLS}>
                          {t("header.searchViewAllSpareParts", { count: shown.sparePartsTotal })}
                        </button>
                      )}
                    </>
                  )
                )}

                {activeCategory === "customers" && (
                  shown.customers.length === 0 ? (
                    <p className="px-4 py-4 text-xs text-ink-muted text-center">{t("msg.noCustomersFound")}</p>
                  ) : (
                    <>
                      {shown.customers.map((customer) => (
                        <button
                          key={customer.id}
                          type="button"
                          onClick={() => goToRoute("/customers", customer.companyName || customer.contactName || "")}
                          className={ROW_CLS}
                        >
                          <div className={ROW_ICON_CLS}>
                            <Users className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-ink truncate">
                              {customer.companyName || "—"}
                            </p>
                            <p className="text-[11px] text-ink-secondary truncate">
                              {[customer.contactName, customer.phoneNumber].filter(Boolean).join(" · ")}
                            </p>
                          </div>
                        </button>
                      ))}
                      {shown.customersTotal > shown.customers.length && (
                        <button type="button" onClick={() => goToRoute("/customers", query)} className={VIEW_ALL_CLS}>
                          {t("header.searchViewAllCustomers", { count: shown.customersTotal })}
                        </button>
                      )}
                    </>
                  )
                )}

                {activeCategory === "items" && (
                  shown.items.length === 0 ? (
                    <p className="px-4 py-4 text-xs text-ink-muted text-center">{t("msg.noItemsFound")}</p>
                  ) : (
                    <>
                      {shown.items.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => goToRoute("/received-inventory", item.itemName || item.serialNumber || "")}
                          className={ROW_CLS}
                        >
                          <div className={ROW_ICON_CLS}>
                            <Package className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-ink truncate">
                              {item.itemName || "—"}
                            </p>
                            <p className="text-[11px] text-ink-secondary truncate">
                              {[item.serialNumber, item.itemType].filter(Boolean).join(" · ")}
                            </p>
                          </div>
                        </button>
                      ))}
                      {shown.itemsTotal > shown.items.length && (
                        <button type="button" onClick={() => goToRoute("/received-inventory", query)} className={VIEW_ALL_CLS}>
                          {t("header.searchViewAllItems", { count: shown.itemsTotal })}
                        </button>
                      )}
                    </>
                  )
                )}

                {activeCategory === "users" && (
                  shown.users.length === 0 ? (
                    <p className="px-4 py-4 text-xs text-ink-muted text-center">
                      {isKhmer ? "រកមិនឃើញគណនីអ្នកប្រើប្រាស់ឡើយ" : "No matching users found"}
                    </p>
                  ) : (
                    <>
                      {shown.users.map((user) => {
                        const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.userName;
                        return (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() => goToRoute("/users", user.userName || fullName)}
                            className={ROW_CLS}
                          >
                            <div className="w-8 h-8 rounded-lg bg-accent-soft text-accent flex items-center justify-center shrink-0 font-bold text-xs">
                              {fullName.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-ink truncate">
                                {fullName} <span className="text-[10px] text-ink-muted">(@{user.userName})</span>
                              </p>
                              <p className="text-[11px] text-ink-secondary truncate">
                                {[user.email, user.roles?.join(", ")].filter(Boolean).join(" · ")}
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
                    </>
                  )
                )}
              </>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
