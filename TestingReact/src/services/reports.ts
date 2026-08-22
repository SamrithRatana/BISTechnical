/**
 * @file reports.ts
 * @description Data fetchers for the report pages.
 *
 * Separate from `api.ts` because reports read differently from the queues: they
 * want a whole date range at once rather than an infinite-scroll page, and they
 * are never cached — a report is usually opened *because* someone is checking a
 * number, and a three-minute-old answer to that question is a wrong one.
 *
 * Everything here goes through the existing `/api/proxy/*` routes, so no
 * backend change was needed for any of it: `/technicalservices/search` already
 * exposes the date, company, status and user filters the eight Blazor reports
 * were built on.
 */

import { type RepairServiceItem, calculateDaysTaken } from "./types";
import { fetchUserMap, enrichTicketUsers } from "./userService";

/**
 * How many rows one report request pulls.
 *
 * The search endpoint is paginated and the reports are not — a monthly report
 * is read as one document. This is deliberately far above a realistic month
 * (the busiest month in the data is a few hundred rows) so a single request
 * covers it, while still being a ceiling rather than an unbounded read.
 */
const REPORT_PAGE_SIZE = 2000;

export interface ServiceReportQuery {
  fromDate: Date;
  toDate: Date;
  /** Restrict to specific companies (monthly report drill-down). */
  companyNames?: string[];
  /** Restrict to specific statuses; omitted means every status. */
  statuses?: string[];
  searchTerm?: string;
  /** "Free" | "Charge"; omitted means every type. */
  serviceType?: string;
  /** "CompanyService" | "OnSite"; omitted means everywhere. */
  serviceLocation?: string;
}

/**
 * Formats a date as unmarked local wall-clock, matching how the backend stores
 * and compares DateTimes (Phnom Penh, no timezone suffix).
 *
 * `toISOString()` would convert to UTC and shift every boundary back seven
 * hours — a report "from the 1st" would silently include the last seven hours
 * of the previous month.
 */
function toBackendDate(date: Date, endOfDay = false): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const time = endOfDay ? "23:59:59" : "00:00:00";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${time}`;
}

/**
 * Shared helper to fetch ticket records and concurrently resolve/enrich user names in parallel.
 * Avoids sequential network waterfalls on cold user cache and automatically disables
 * redundant SQL COUNT(*) scans via includeTotalCount=false for sub-second report delivery.
 */
async function fetchAndEnrichTickets(
  url: string,
  errorContext: string
): Promise<RepairServiceItem[]> {
  let targetUrl = url;
  if (targetUrl.includes("/search") && !targetUrl.includes("includeTotalCount=")) {
    targetUrl += (targetUrl.includes("?") ? "&" : "?") + "includeTotalCount=false";
  }

  const [res, userMap] = await Promise.all([
    fetch(targetUrl, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    }),
    fetchUserMap().catch(() => new Map()),
  ]);

  if (!res.ok) throw new Error(`${errorContext} request failed (${res.status})`);

  const data = await res.json();
  const rawItems = (data.items ?? data ?? []) as RepairServiceItem[];
  return rawItems.map((item) => enrichTicketUsers(item, userMap));
}

/**
 * Pulls every service ticket in a date range, for the ticket-based reports
 * (daily, monthly, customer, engineer, history, repair summary).
 *
 * `forceServiceDateOnly` is set because a report about a date range means the
 * range the job was *booked* in. Without it the endpoint switches to
 * process-date filtering per status, so the same ticket lands in a different
 * month depending on its current status — and two reports run a week apart
 * stop reconciling.
 */
export async function fetchServiceReport(
  query: ServiceReportQuery
): Promise<RepairServiceItem[]> {
  const params = new URLSearchParams({
    pageNumber: "1",
    pageSize: String(REPORT_PAGE_SIZE),
    fromDate: toBackendDate(query.fromDate),
    toDate: toBackendDate(query.toDate, true),
    forceServiceDateOnly: "true",
    sortBy: "ServiceDate",
    sortDescending: "false",
  });

  if (query.searchTerm?.trim()) params.set("searchTerm", query.searchTerm.trim());
  // The endpoint comma-splits this one into a multi-status filter.
  if (query.statuses?.length) params.set("status", query.statuses.join(","));
  if (query.serviceType) params.set("serviceType", query.serviceType);
  if (query.serviceLocation) params.set("serviceLocation", query.serviceLocation);
  // Repeated key, not comma-joined: the backend binds `string[] CompanyNames`,
  // and a company name containing a comma would otherwise split into two.
  query.companyNames?.forEach((name) => params.append("companyNames", name));

  return fetchAndEnrichTickets(
    `/api/proxy/technicalservices/search?${params.toString()}`,
    "Report"
  );
}

/** One spare part's usage over the period, from `/spareparts/usage`. */
export interface SparepartUsageRow {
  sparepartId: string;
  itemName: string;
  serialNumber: string;
  stockQuantity: number;
  usedQuantity: number;
  serviceUsedQty: number;
  manualUsedQty: number;
  usageCount: number;
}

/** One spare part currently on hold, from `/spareparts/hold`. */
export interface SparepartHoldRow {
  sparepartId: string;
  itemName: string;
  serialNumber: string;
  currentStock: number;
  totalHoldQty: number;
  holdCount: number;
}

/**
 * Both spare-part endpoints bind `[AsParameters]` query classes whose string
 * and bool members are **not** nullable, so ASP.NET treats every one of them as
 * required and answers 500 — not 400 — when any is missing. Omitting
 * `sortDescending` alone is enough to break the call.
 *
 * Sending the full set on every request is the client-side workaround. The
 * proper fix is `string?` / `bool?` on those query classes in the API; until
 * then, do not "tidy" these away.
 */
export async function fetchSparepartUsage(
  from: Date,
  to: Date,
  /**
   * `standard` dates each movement by `SparepartStockAuditLog.Timestamp` — the
   * transaction ledger. `alwayscreated` attributes it to the ticket's own date
   * instead. See `ReportDateMode` in `components/ReportFilterBar` for why both
   * exist. Defaults to the ledger so existing callers are unchanged.
   */
  dateMode: "standard" | "alwayscreated" = "standard"
): Promise<SparepartUsageRow[]> {
  const params = new URLSearchParams({
    pageNumber: "1",
    pageSize: "1000",
    fromDate: toBackendDate(from),
    toDate: toBackendDate(to, true),
    searchTerm: "",
    status: "",
    sortBy: "usedquantity",
    sortDescending: "true",
    includeManualStockOut: "true",
    serviceType: "",
    condition: "",
    dateMode,
    sourceFilter: "",
  });

  const res = await fetch(`/api/proxy/spareparts/usage?${params.toString()}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Spare part usage request failed (${res.status})`);

  const data = await res.json();
  return (data.items ?? data ?? []) as SparepartUsageRow[];
}

export async function fetchSparepartHold(): Promise<SparepartHoldRow[]> {
  // No date range: "on hold" is a statement about right now, not a period.
  const params = new URLSearchParams({
    pageNumber: "1",
    pageSize: "1000",
    searchTerm: "",
    status: "",
    serviceType: "",
    sortBy: "holdqty",
    sortDescending: "true",
  });

  const res = await fetch(`/api/proxy/spareparts/hold?${params.toString()}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Spare part hold request failed (${res.status})`);

  const data = await res.json();
  return (data.items ?? data ?? []) as SparepartHoldRow[];
}

// ═══════════════════════════════════════════════════════════════════════════
//  STOCK TRANSACTION REPORTS
//
//  These read `/spareparts/transactions`, `/movement-summary` and
//  `/dead-stock` — movement-level views over `SparepartStockAuditLog`, where
//  the usage report above is an aggregate.
//
//  Why they exist: the usage report nets a return against an issue, so a part
//  fitted and then returned reads as "nothing happened" and neither movement
//  is visible. Measured on the live ledger, ~100 units came back to stock over
//  six months that no report showed as a line.
//
//  Note the query strings here are SHORT, unlike `fetchSparepartUsage` above
//  which must send its full parameter set or the endpoint 500s. These three
//  bind nullable query classes, so an omitted parameter is genuinely optional.
// ═══════════════════════════════════════════════════════════════════════════

/** Direction of a stock movement. */
export type StockDirection = "In" | "Out" | "None";

/** Where a movement came from. */
export type StockSource = "Service" | "Manual" | "Adjustment";

/** One row of the stock ledger — a single movement, as the trigger recorded it. */
export interface StockTransactionRow {
  id: string;
  timestamp: string;
  sparepartId: string;
  itemName: string;
  serialNumber: string;
  operationType: string;
  /** Signed: negative left the shelf, positive returned. */
  quantityChange: number;
  /** Unsigned magnitude. */
  quantity: number;
  direction: StockDirection;
  source: StockSource;
  balanceBefore: number;
  balanceAfter: number;
  serviceId: string | null;
  reportNo: string;
  companyName: string;
  serviceStatus: string;
  reason: string;
  /** True when a later movement on the same ticket+part undid this one. */
  reversedLater: boolean;
  /** True when this movement is itself undoing an earlier one. */
  isReversal: boolean;
}

/** Per-part reconciliation over a period. */
export interface StockMovementRow {
  sparepartId: string;
  itemName: string;
  serialNumber: string;
  openingBalance: number;
  totalIn: number;
  totalOut: number;
  netChange: number;
  closingBalance: number;
  currentStock: number;
  movementCount: number;
}

/** A part holding stock that nothing has touched for a while. */
export interface StockDeadRow {
  sparepartId: string;
  itemName: string;
  serialNumber: string;
  quantity: number;
  heldQuantity: number;
  /** Null when the part has no movement on record at all. */
  lastMovement: string | null;
  daysSinceMovement: number | null;
}

/** Filters the ledger endpoint accepts. All optional. */
export interface StockTransactionFilters {
  direction?: StockDirection;
  source?: StockSource;
  includeTrackingRows?: boolean;
  searchTerm?: string;
}

async function getStockJson<T>(path: string, params: URLSearchParams): Promise<T[]> {
  const res = await fetch(`/api/proxy/${path}?${params.toString()}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`${path} request failed (${res.status})`);
  const data = await res.json();
  return (data.items ?? data ?? []) as T[];
}

/** The stock ledger: every movement in the range, newest first. */
export async function fetchStockTransactions(
  from: Date,
  to: Date,
  filters: StockTransactionFilters = {}
): Promise<StockTransactionRow[]> {
  const params = new URLSearchParams({
    pageNumber: "1",
    pageSize: String(REPORT_PAGE_SIZE),
    fromDate: toBackendDate(from),
    toDate: toBackendDate(to, true),
  });
  if (filters.direction) params.set("direction", filters.direction);
  if (filters.source) params.set("source", filters.source);
  if (filters.includeTrackingRows) params.set("includeTrackingRows", "true");
  if (filters.searchTerm) params.set("searchTerm", filters.searchTerm);

  return getStockJson<StockTransactionRow>("spareparts/transactions", params);
}

/** Per-part opening/in/out/closing over the range. */
export async function fetchStockMovementSummary(
  from: Date,
  to: Date
): Promise<StockMovementRow[]> {
  const params = new URLSearchParams({
    pageNumber: "1",
    pageSize: String(REPORT_PAGE_SIZE),
    fromDate: toBackendDate(from),
    toDate: toBackendDate(to, true),
  });
  return getStockJson<StockMovementRow>("spareparts/movement-summary", params);
}

/**
 * Parts holding stock with no movement for `idleDays`.
 *
 * No date range: "idle" describes a window ending now, not an arbitrary past
 * period — the same reason `fetchSparepartHold` takes none.
 */
export async function fetchStockDead(idleDays = 90): Promise<StockDeadRow[]> {
  const params = new URLSearchParams({
    pageNumber: "1",
    pageSize: String(REPORT_PAGE_SIZE),
    idleDays: String(idleDays),
  });
  return getStockJson<StockDeadRow>("spareparts/dead-stock", params);
}

/** One detected stock-data inconsistency, from `/spareparts/health`. */
export interface StockHealthIssue {
  category:
    | "OrphanNotification"
    | "LedgerMismatch"
    | "DuplicateName"
    | "NegativeStock"
    | "OrphanRestore";
  severity: "high" | "medium" | "low";
  sparepartId: string | null;
  itemName: string;
  serialNumber: string;
  detail: string;
  expected: number | null;
  actual: number | null;
  occurredAt: string | null;
  reportNo: string | null;
}

/**
 * Stock-data health check.
 *
 * No date range: these are standing faults, not events in a period. A
 * notification sent for a movement the ledger never recorded stays wrong until
 * someone fixes it, so scoping it to "this month" would hide it.
 */
export async function fetchStockHealth(): Promise<StockHealthIssue[]> {
  const params = new URLSearchParams({ pageNumber: "1", pageSize: String(REPORT_PAGE_SIZE) });
  return getStockJson<StockHealthIssue>("spareparts/health", params);
}

/** One deduction that was undone, from `/spareparts/reconciliation`. */
export interface StockReconciliationRow {
  sparepartId: string;
  itemName: string;
  serialNumber: string;
  quantity: number;
  outAt: string;
  returnedAt: string;
  minutesOut: number;
  why: string;
  reportNo: string;
  /** False when the pair exists only as notifications and never reached the ledger. */
  recordedInLedger: boolean;
}

/** Headline counts plus every cancelled-out pair behind them. */
export interface StockReconciliationResult {
  notificationsSent: number;
  ledgerStockOut: number;
  reportedUsage: number;
  reversedPairs: number;
  unrecordedMovements: number;
  rows: StockReconciliationRow[];
}

/**
 * Explains why the stock-out notification count and the usage figure disagree
 * for a period.
 *
 * Returns a plain object rather than a PagedResult, so it does not go through
 * `getStockJson` — the headline counts matter as much as the rows and would be
 * lost by unwrapping to `items`.
 */
export async function fetchStockReconciliation(
  from: Date,
  to: Date
): Promise<StockReconciliationResult> {
  const params = new URLSearchParams({
    fromDate: toBackendDate(from),
    toDate: toBackendDate(to, true),
  });
  const res = await fetch(`/api/proxy/spareparts/reconciliation?${params.toString()}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Stock reconciliation request failed (${res.status})`);
  return (await res.json()) as StockReconciliationResult;
}

/** Query parameters for active backlog and work-in-progress repair report. */
export interface PendingRepairsQuery {
  fromDate?: Date;
  toDate?: Date;
  companyNames?: string[];
  statuses?: string[];
  userIds?: string[];
  searchTerm?: string;
  serviceType?: string;
  serviceLocation?: string;
}

/**
 * Fetches all incomplete tickets currently pending or in progress
 * (excludes Finished, Customer Rejected, Unrepairable).
 */
export async function fetchPendingRepairsReport(
  query: PendingRepairsQuery = {}
): Promise<RepairServiceItem[]> {
  const params = new URLSearchParams({
    pageNumber: "1",
    pageSize: String(REPORT_PAGE_SIZE),
    sortBy: "ServiceDate",
    sortDescending: "true",
  });

  if (query.fromDate) {
    params.set("fromDate", toBackendDate(query.fromDate));
    params.set("forceServiceDateOnly", "true");
  }
  if (query.toDate) {
    params.set("toDate", toBackendDate(query.toDate, true));
    params.set("forceServiceDateOnly", "true");
  }

  // Specific status selected vs default pending set
  if (query.statuses?.length) {
    params.set("status", query.statuses.join(","));
  } else {
    params.set("excludedStatuses", "Finished,Customer Rejected,Unrepairable");
  }

  if (query.searchTerm?.trim()) params.set("searchTerm", query.searchTerm.trim());
  if (query.serviceType) params.set("serviceType", query.serviceType);
  if (query.serviceLocation) params.set("serviceLocation", query.serviceLocation);
  query.companyNames?.forEach((name) => params.append("companyNames", name));
  query.userIds?.forEach((id) => params.append("userIds", id));

  return fetchAndEnrichTickets(
    `/api/proxy/technicalservices/search?${params.toString()}`,
    "Pending repairs report"
  );
}

/** Query parameters for completed repair services report. */
export interface CompletedRepairsQuery {
  fromDate: Date;
  toDate: Date;
  companyNames?: string[];
  userIds?: string[];
  searchTerm?: string;
  serviceType?: string;
  serviceLocation?: string;
}

/**
 * Fetches all tickets completed/finished within the specified FinishedDate range.
 */
export async function fetchCompletedRepairsReport(
  query: CompletedRepairsQuery
): Promise<RepairServiceItem[]> {
  const params = new URLSearchParams({
    pageNumber: "1",
    pageSize: String(REPORT_PAGE_SIZE),
    status: "Finished",
    useProcessDateFiltering: "true",
    statusesForProcessFiltering: "Finished",
    fromDate: toBackendDate(query.fromDate),
    toDate: toBackendDate(query.toDate, true),
    sortBy: "FinishedDate",
    sortDescending: "true",
  });

  if (query.searchTerm?.trim()) params.set("searchTerm", query.searchTerm.trim());
  if (query.serviceType) params.set("serviceType", query.serviceType);
  if (query.serviceLocation) params.set("serviceLocation", query.serviceLocation);
  query.companyNames?.forEach((name) => params.append("companyNames", name));
  query.userIds?.forEach((id) => params.append("userIds", id));

  return fetchAndEnrichTickets(
    `/api/proxy/technicalservices/search?${params.toString()}`,
    "Completed repairs report"
  );
}

/**
 * Daily Repair Report query interface.
 */
export interface DailyReportQuery {
  fromDate: Date;
  toDate: Date;
  statuses?: string[];
  searchTerm?: string;
  serviceType?: string;
  serviceLocation?: string;
  companyNames?: string[];
  userIds?: string[];
}

const ALL_PROCESS_STATUSES: ServiceStageKey[] = [
  "Item Recieved",
  "Inspection",
  "Inspecting",
  "Sale Confirmed",
  "Awaiting Customer Confirm",
  "Awaiting Sparepart",
  "Sent Spareparts",
  "Repairing",
  "Finished",
  "Customer Rejected",
  "Unrepairable",
  "Repair by Third-Party",
];

/**
 * Fetches tickets for the daily repair report.
 * - Queries by process date filtering across all statuses (or selected statuses)
 *   so every ticket having any StatusDate in the date range is returned regardless of status.
 * - Enriches each row's displayed serviceDate with its actual status action timestamp.
 */
export async function fetchDailyReport(
  query: DailyReportQuery
): Promise<RepairServiceItem[]> {
  const isStatusSpecified =
    query.statuses &&
    query.statuses.length > 0 &&
    !query.statuses.includes("All") &&
    !query.statuses.includes("");

  const targetStatuses = isStatusSpecified
    ? (query.statuses as ServiceStageKey[])
    : ALL_PROCESS_STATUSES;

  const params = new URLSearchParams({
    pageNumber: "1",
    pageSize: String(REPORT_PAGE_SIZE),
    fromDate: toBackendDate(query.fromDate),
    toDate: toBackendDate(query.toDate, true),
    sortBy: "ServiceDate",
    sortDescending: "true",
  });

  if (isStatusSpecified) {
    // When specific status is selected in daily-report: filter by current status
    params.set("status", query.statuses!.join(","));
  } else {
    // When ALL statuses: process date filtering across all statuses
    params.set("useProcessDateFiltering", "true");
    ALL_PROCESS_STATUSES.forEach((st) => {
      params.append("statusesForProcessFiltering", st);
    });
  }

  if (query.searchTerm?.trim()) params.set("searchTerm", query.searchTerm.trim());
  if (query.serviceType) params.set("serviceType", query.serviceType);
  if (query.serviceLocation) params.set("serviceLocation", query.serviceLocation);
  query.companyNames?.forEach((name) => params.append("companyNames", name));
  query.userIds?.forEach((id) => params.append("userIds", id));

  const enriched = await fetchAndEnrichTickets(
    `/api/proxy/technicalservices/search?${params.toString()}`,
    "Daily report"
  );

  return enriched.map((item) => {
    const currentStatus = item.status as ServiceStageKey;
    const info = extractStageInfo(item, currentStatus);
    return {
      ...item,
      serviceDate: info.stageDate || item.serviceDate,
    };
  });
}

export type ServiceStageKey =
  | "Item Recieved"
  | "Inspection"
  | "Inspecting"
  | "Awaiting Customer Confirm"
  | "Awaiting Sparepart"
  | "Sale Confirmed"
  | "Sent Spareparts"
  | "Repairing"
  | "Finished"
  | "Customer Rejected"
  | "Unrepairable"
  | "Repair by Third-Party";

export interface StageActivityQuery {
  stage: ServiceStageKey;
  fromDate: Date;
  toDate: Date;
  companyNames?: string[];
  userIds?: string[];
  searchTerm?: string;
  serviceType?: string;
  serviceLocation?: string;
}

export interface StageActivityRow extends RepairServiceItem {
  stageDate?: string;
  performedBy?: string;
}

export function extractStageInfo(
  item: RepairServiceItem,
  stage: ServiceStageKey
): {
  stageDate?: string;
  performedBy?: string;
} {
  switch (stage) {
    case "Item Recieved":
      return { stageDate: item.serviceDate, performedBy: item.createdByName };
    case "Inspection":
    case "Inspecting":
      return { stageDate: item.inspectDate || item.serviceDate, performedBy: item.inspectByName };
    case "Awaiting Customer Confirm":
      return { stageDate: item.awaitingCustomerConfirmDate, performedBy: item.setAwaitingCustomerConfirmByName };
    case "Awaiting Sparepart":
      return { stageDate: item.awaitingSparepartDate, performedBy: item.setAwaitingSparepartByName };
    case "Sale Confirmed":
      return { stageDate: item.saleConfirmedDate, performedBy: item.setSaleConfirmedByName };
    case "Sent Spareparts":
      return { stageDate: item.sentSparepartsDate, performedBy: item.setSentSparepartsByName };
    case "Repairing":
      return { stageDate: item.repairDate, performedBy: item.repairByName };
    case "Finished":
      return { stageDate: item.finishedDate, performedBy: item.verifiedByName || item.repairByName };
    case "Customer Rejected":
      return { stageDate: item.customerRejectedDate, performedBy: item.setCustomerRejectedByName };
    case "Unrepairable":
      return { stageDate: item.unrepairableDate, performedBy: item.setUnrepairableByName };
    case "Repair by Third-Party":
      return { stageDate: item.thirdPartyRepairDate, performedBy: item.thirdPartyRepairByName };
    default:
      return { stageDate: item.serviceDate, performedBy: item.createdByName };
  }
}

/**
 * Fetches all service tickets that reached a specific workflow stage in the given date range.
 */
export async function fetchStageActivityReport(
  query: StageActivityQuery
): Promise<StageActivityRow[]> {
  const params = new URLSearchParams({
    pageNumber: "1",
    pageSize: String(REPORT_PAGE_SIZE),
    useProcessDateFiltering: "true",
    statusesForProcessFiltering: query.stage,
    fromDate: toBackendDate(query.fromDate),
    toDate: toBackendDate(query.toDate, true),
    sortBy: "ServiceDate",
    sortDescending: "true",
  });

  if (query.searchTerm?.trim()) params.set("searchTerm", query.searchTerm.trim());
  if (query.serviceType) params.set("serviceType", query.serviceType);
  if (query.serviceLocation) params.set("serviceLocation", query.serviceLocation);
  query.companyNames?.forEach((name) => params.append("companyNames", name));
  query.userIds?.forEach((id) => params.append("userIds", id));

  const enriched = await fetchAndEnrichTickets(
    `/api/proxy/technicalservices/search?${params.toString()}`,
    "Stage activity report"
  );

  return enriched.map((item) => {
    const info = extractStageInfo(item, query.stage);
    return {
      ...item,
      stageDate: info.stageDate || item.serviceDate,
      performedBy: info.performedBy || "—",
    };
  });
}

// ─────────────────────────────────────────────────────────────
// Rejected & Unrepairable Report
// ─────────────────────────────────────────────────────────────

export interface RejectedReportQuery {
  fromDate: Date;
  toDate: Date;
  statuses?: string[]; // "Customer Rejected", "Unrepairable", or both
  searchTerm?: string;
  serviceType?: string;
  serviceLocation?: string;
  companyNames?: string[];
  userIds?: string[];
}

export interface RejectedReportRow extends RepairServiceItem {
  decidedBy: string;
}

export async function fetchRejectedReport(
  query: RejectedReportQuery
): Promise<RejectedReportRow[]> {
  const allowed = ["Customer Rejected", "Unrepairable"];
  const targetStatuses =
    query.statuses && query.statuses.length > 0
      ? query.statuses.filter((s) => allowed.includes(s))
      : allowed;

  const params = new URLSearchParams({
    pageNumber: "1",
    pageSize: String(REPORT_PAGE_SIZE),
    status: targetStatuses.length > 0 ? targetStatuses.join(",") : allowed.join(","),
    fromDate: toBackendDate(query.fromDate),
    toDate: toBackendDate(query.toDate, true),
    sortBy: "ServiceDate",
    sortDescending: "true",
  });

  if (query.searchTerm?.trim()) params.set("searchTerm", query.searchTerm.trim());
  if (query.serviceType) params.set("serviceType", query.serviceType);
  if (query.serviceLocation) params.set("serviceLocation", query.serviceLocation);
  query.companyNames?.forEach((name) => params.append("companyNames", name));
  query.userIds?.forEach((id) => params.append("userIds", id));

  const enriched = await fetchAndEnrichTickets(
    `/api/proxy/technicalservices/search?${params.toString()}`,
    "Rejected report"
  );

  return enriched.map((item) => {
    const isUnrepairable = item.status === "Unrepairable";
    const decidedBy = isUnrepairable
      ? item.setUnrepairableByName || item.inspectByName || "—"
      : item.setCustomerRejectedByName || item.inspectByName || "—";
    const actionDate = isUnrepairable
      ? item.unrepairableDate || item.serviceDate
      : item.customerRejectedDate || item.serviceDate;

    return {
      ...item,
      serviceDate: actionDate,
      decidedBy,
    };
  });
}

// ─────────────────────────────────────────────────────────────
// Third-Party Outsourced Repairs Report
// ─────────────────────────────────────────────────────────────

export interface ThirdPartyRepairsQuery {
  fromDate: Date;
  toDate: Date;
  statuses?: string[];
  searchTerm?: string;
  serviceType?: string;
  serviceLocation?: string;
  companyNames?: string[];
  userIds?: string[];
}

export async function fetchThirdPartyRepairsReport(
  query: ThirdPartyRepairsQuery
): Promise<RepairServiceItem[]> {
  const isStatusSpecified =
    query.statuses &&
    query.statuses.length > 0 &&
    !query.statuses.includes("All") &&
    !query.statuses.includes("");

  const params = new URLSearchParams({
    pageNumber: "1",
    pageSize: String(REPORT_PAGE_SIZE),
    status: isStatusSpecified ? query.statuses!.join(",") : "Repair by Third-Party",
    fromDate: toBackendDate(query.fromDate),
    toDate: toBackendDate(query.toDate, true),
    sortBy: "ServiceDate",
    sortDescending: "true",
  });

  if (query.searchTerm?.trim()) params.set("searchTerm", query.searchTerm.trim());
  if (query.serviceType) params.set("serviceType", query.serviceType);
  if (query.serviceLocation) params.set("serviceLocation", query.serviceLocation);
  query.companyNames?.forEach((name) => params.append("companyNames", name));
  query.userIds?.forEach((id) => params.append("userIds", id));

  const enriched = await fetchAndEnrichTickets(
    `/api/proxy/technicalservices/search?${params.toString()}`,
    "Third-party repairs"
  );

  return enriched.map((item) => {
    const sentDate = item.thirdPartyRepairDate || item.serviceDate;
    const daysTaken = item.daysTaken ?? calculateDaysTaken(item) ?? undefined;
    return {
      ...item,
      thirdPartyRepairDate: sentDate,
      daysTaken,
    };
  });
}

// ─────────────────────────────────────────────────────────────
// Contract vs Walk-in Service Report
// ─────────────────────────────────────────────────────────────

export interface ContractReportQuery {
  fromDate: Date;
  toDate: Date;
  hasContract?: boolean;
  statuses?: string[];
  searchTerm?: string;
  serviceType?: string;
  serviceLocation?: string;
  companyNames?: string[];
  userIds?: string[];
}

export interface ContractReportRow extends RepairServiceItem {
  contractLabel: string;
}

export async function fetchContractReport(
  query: ContractReportQuery
): Promise<ContractReportRow[]> {
  const isStatusSpecified =
    query.statuses &&
    query.statuses.length > 0 &&
    !query.statuses.includes("All") &&
    !query.statuses.includes("");

  const params = new URLSearchParams({
    pageNumber: "1",
    pageSize: String(REPORT_PAGE_SIZE),
    forceServiceDateOnly: "true",
    fromDate: toBackendDate(query.fromDate),
    toDate: toBackendDate(query.toDate, true),
    sortBy: "ServiceDate",
    sortDescending: "true",
  });

  if (query.hasContract !== undefined) {
    params.set("hasContract", String(query.hasContract));
  }
  if (isStatusSpecified) {
    params.set("status", query.statuses!.join(","));
  }
  if (query.searchTerm?.trim()) params.set("searchTerm", query.searchTerm.trim());
  if (query.serviceType) params.set("serviceType", query.serviceType);
  if (query.serviceLocation) params.set("serviceLocation", query.serviceLocation);
  query.companyNames?.forEach((name) => params.append("companyNames", name));
  query.userIds?.forEach((id) => params.append("userIds", id));

  const enriched = await fetchAndEnrichTickets(
    `/api/proxy/technicalservices/search?${params.toString()}`,
    "Contract report"
  );

  return enriched.map((item) => ({
    ...item,
    contractLabel: item.hasContract ? "Under Contract" : "Walk-in (Non-Contract)",
  }));
}

// ─────────────────────────────────────────────────────────────
// Service Location Breakdown Report (On-Site vs In-House)
// ─────────────────────────────────────────────────────────────

export interface LocationReportQuery {
  fromDate: Date;
  toDate: Date;
  serviceLocation?: string;
  statuses?: string[];
  searchTerm?: string;
  serviceType?: string;
  companyNames?: string[];
  userIds?: string[];
}

export interface LocationReportRow extends RepairServiceItem {
  locationLabel: string;
  engineer: string;
}

export async function fetchLocationReport(
  query: LocationReportQuery
): Promise<LocationReportRow[]> {
  const isStatusSpecified =
    query.statuses &&
    query.statuses.length > 0 &&
    !query.statuses.includes("All") &&
    !query.statuses.includes("");

  const params = new URLSearchParams({
    pageNumber: "1",
    pageSize: String(REPORT_PAGE_SIZE),
    forceServiceDateOnly: "true",
    fromDate: toBackendDate(query.fromDate),
    toDate: toBackendDate(query.toDate, true),
    sortBy: "ServiceDate",
    sortDescending: "true",
  });

  if (query.serviceLocation) params.set("serviceLocation", query.serviceLocation);
  if (isStatusSpecified) params.set("status", query.statuses!.join(","));
  if (query.searchTerm?.trim()) params.set("searchTerm", query.searchTerm.trim());
  if (query.serviceType) params.set("serviceType", query.serviceType);
  query.companyNames?.forEach((name) => params.append("companyNames", name));
  query.userIds?.forEach((id) => params.append("userIds", id));

  const enriched = await fetchAndEnrichTickets(
    `/api/proxy/technicalservices/search?${params.toString()}`,
    "Location report"
  );

  return enriched.map((item) => {
    const engineer =
      item.repairByName ||
      item.inspectByName ||
      item.createdByName ||
      "—";
    const locationLabel =
      item.serviceLocation === "OnSite" ? "On-Site (At Client)" : "In-House (Company Service)";

    return {
      ...item,
      engineer,
      locationLabel,
    };
  });
}

// ─────────────────────────────────────────────────────────────
// Common Faults & Diagnostics Report
// ─────────────────────────────────────────────────────────────

export interface FaultsReportQuery {
  fromDate: Date;
  toDate: Date;
  searchTerm?: string;
  serviceType?: string;
  serviceLocation?: string;
  companyNames?: string[];
  userIds?: string[];
}

export async function fetchFaultsReport(
  query: FaultsReportQuery
): Promise<RepairServiceItem[]> {
  const params = new URLSearchParams({
    pageNumber: "1",
    pageSize: String(REPORT_PAGE_SIZE),
    forceServiceDateOnly: "true",
    fromDate: toBackendDate(query.fromDate),
    toDate: toBackendDate(query.toDate, true),
    sortBy: "ItemName",
    sortDescending: "false",
  });

  if (query.searchTerm?.trim()) params.set("searchTerm", query.searchTerm.trim());
  if (query.serviceType) params.set("serviceType", query.serviceType);
  if (query.serviceLocation) params.set("serviceLocation", query.serviceLocation);
  query.companyNames?.forEach((name) => params.append("companyNames", name));
  query.userIds?.forEach((id) => params.append("userIds", id));

  const enriched = await fetchAndEnrichTickets(
    `/api/proxy/technicalservices/search?${params.toString()}`,
    "Faults report"
  );

  // Filter for rows that have at least some fault, inspection or solution note
  return enriched.filter(
    (item) =>
      item.itemName?.trim() ||
      item.customerRequest?.trim() ||
      item.inspection?.trim() ||
      item.solution?.trim()
  );
}

// ─────────────────────────────────────────────────────────────
// Sales: Quotation Follow-up Tracker
// ─────────────────────────────────────────────────────────────

export interface SalesFollowupQuery {
  fromDate: Date;
  toDate: Date;
  searchTerm?: string;
  serviceType?: string;
  serviceLocation?: string;
  companyNames?: string[];
  userIds?: string[];
}

export interface SalesFollowupRow extends RepairServiceItem {
  awaitingDate: string;
  daysWaiting: number;
  quotedParts: string;
}

export async function fetchSalesFollowupReport(
  query: SalesFollowupQuery
): Promise<SalesFollowupRow[]> {
  const params = new URLSearchParams({
    pageNumber: "1",
    pageSize: String(REPORT_PAGE_SIZE),
    status: "Awaiting Customer Confirm",
    forceServiceDateOnly: "true",
    fromDate: toBackendDate(query.fromDate),
    toDate: toBackendDate(query.toDate, true),
    sortBy: "AwaitingCustomerConfirmDate",
    sortDescending: "false",
  });

  if (query.searchTerm?.trim()) params.set("searchTerm", query.searchTerm.trim());
  if (query.serviceType) params.set("serviceType", query.serviceType);
  if (query.serviceLocation) params.set("serviceLocation", query.serviceLocation);
  query.companyNames?.forEach((name) => params.append("companyNames", name));
  query.userIds?.forEach((id) => params.append("userIds", id));

  const enriched = await fetchAndEnrichTickets(
    `/api/proxy/technicalservices/search?${params.toString()}`,
    "Sales followup report"
  );

  const now = new Date();

  return enriched.map((item) => {
    const awaitingDate = item.awaitingCustomerConfirmDate || item.serviceDate;
    const waitingMs = now.getTime() - new Date(awaitingDate).getTime();
    const daysWaiting = Math.max(0, Math.floor(waitingMs / (1000 * 60 * 60 * 24)));

    const quotedParts =
      item.sparepartItems && item.sparepartItems.length > 0
        ? item.sparepartItems
            .map((sp) => `${sp.condition || "Replace"} (Qty: ${sp.quantity})`)
            .join(", ")
        : "—";

    return {
      ...item,
      awaitingDate,
      daysWaiting,
      quotedParts,
    };
  });
}

// ─────────────────────────────────────────────────────────────
// Sales: Quote Conversion & Win/Loss Rate Report
// ─────────────────────────────────────────────────────────────

export interface SalesConversionQuery {
  fromDate: Date;
  toDate: Date;
  searchTerm?: string;
  serviceType?: string;
  serviceLocation?: string;
  companyNames?: string[];
  userIds?: string[];
}

export interface SalesConversionRow extends RepairServiceItem {
  decisionDate: string;
  salesRep: string;
  closingDays: number;
  outcome: "Approved" | "Declined";
}

export async function fetchSalesConversionReport(
  query: SalesConversionQuery
): Promise<SalesConversionRow[]> {
  const params = new URLSearchParams({
    pageNumber: "1",
    pageSize: String(REPORT_PAGE_SIZE),
    status: "Sale Confirmed,Customer Rejected",
    fromDate: toBackendDate(query.fromDate),
    toDate: toBackendDate(query.toDate, true),
    sortBy: "ServiceDate",
    sortDescending: "true",
  });

  if (query.searchTerm?.trim()) params.set("searchTerm", query.searchTerm.trim());
  if (query.serviceType) params.set("serviceType", query.serviceType);
  if (query.serviceLocation) params.set("serviceLocation", query.serviceLocation);
  query.companyNames?.forEach((name) => params.append("companyNames", name));
  query.userIds?.forEach((id) => params.append("userIds", id));

  const enriched = await fetchAndEnrichTickets(
    `/api/proxy/technicalservices/search?${params.toString()}`,
    "Sales conversion report"
  );

  return enriched.map((item) => {
    const isApproved = item.status === "Sale Confirmed";
    const decisionDate = isApproved
      ? item.saleConfirmedDate || item.serviceDate
      : item.customerRejectedDate || item.serviceDate;
    const salesRep = isApproved
      ? item.setSaleConfirmedByName || item.createdByName || "—"
      : item.setCustomerRejectedByName || item.createdByName || "—";

    const startDate = item.awaitingCustomerConfirmDate || item.serviceDate;
    const diffMs = new Date(decisionDate).getTime() - new Date(startDate).getTime();
    const closingDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

    return {
      ...item,
      decisionDate,
      salesRep,
      closingDays,
      outcome: isApproved ? ("Approved" as const) : ("Declined" as const),
    };
  });
}

// ─────────────────────────────────────────────────────────────
// Sales: New Machine Hot Leads Report
// ─────────────────────────────────────────────────────────────

export interface SalesLeadsQuery {
  fromDate: Date;
  toDate: Date;
  searchTerm?: string;
  serviceType?: string;
  serviceLocation?: string;
  companyNames?: string[];
  userIds?: string[];
}

export async function fetchSalesLeadsReport(
  query: SalesLeadsQuery
): Promise<RepairServiceItem[]> {
  const params = new URLSearchParams({
    pageNumber: "1",
    pageSize: String(REPORT_PAGE_SIZE),
    status: "Unrepairable,Customer Rejected",
    fromDate: toBackendDate(query.fromDate),
    toDate: toBackendDate(query.toDate, true),
    sortBy: "ServiceDate",
    sortDescending: "true",
  });

  if (query.searchTerm?.trim()) params.set("searchTerm", query.searchTerm.trim());
  if (query.serviceType) params.set("serviceType", query.serviceType);
  if (query.serviceLocation) params.set("serviceLocation", query.serviceLocation);
  query.companyNames?.forEach((name) => params.append("companyNames", name));
  query.userIds?.forEach((id) => params.append("userIds", id));

  return fetchAndEnrichTickets(
    `/api/proxy/technicalservices/search?${params.toString()}`,
    "Sales leads report"
  );
}

// ─────────────────────────────────────────────────────────────
// Sales: Contract SLA Renewal Tracker Report
// ─────────────────────────────────────────────────────────────

export interface ContractRenewalQuery {
  fromDate: Date;
  toDate: Date;
  searchTerm?: string;
  serviceType?: string;
  serviceLocation?: string;
  companyNames?: string[];
}

export interface ContractRenewalRow {
  companyName: string;
  customerType: string;
  contactName: string;
  phoneNumber: string;
  contractStatus: string;
  totalRepairs: number;
  lastServiceDate: string;
  suggestedAction: string;
}

export async function fetchContractRenewalReport(
  query: ContractRenewalQuery
): Promise<ContractRenewalRow[]> {
  const params = new URLSearchParams({
    pageNumber: "1",
    pageSize: String(REPORT_PAGE_SIZE),
    fromDate: toBackendDate(query.fromDate),
    toDate: toBackendDate(query.toDate, true),
    sortBy: "ServiceDate",
    sortDescending: "true",
  });

  if (query.searchTerm?.trim()) params.set("searchTerm", query.searchTerm.trim());
  if (query.serviceType) params.set("serviceType", query.serviceType);
  if (query.serviceLocation) params.set("serviceLocation", query.serviceLocation);
  query.companyNames?.forEach((name) => params.append("companyNames", name));

  const rawItems = await fetchAndEnrichTickets(
    `/api/proxy/technicalservices/search?${params.toString()}`,
    "Contract renewal report"
  );

  // Group by companyName
  const companyMap = new Map<string, RepairServiceItem[]>();
  rawItems.forEach((item) => {
    const key = item.companyName?.trim() || "Unspecified";
    if (!companyMap.has(key)) companyMap.set(key, []);
    companyMap.get(key)!.push(item);
  });

  const rows: ContractRenewalRow[] = [];
  companyMap.forEach((items, company) => {
    const hasContract = items.some((i) => i.hasContract);
    const latestItem = items[0];
    const totalRepairs = items.length;

    let suggestedAction = "Maintain Regular Followup";
    if (hasContract) {
      suggestedAction = "Review SLA & Prepare Renewal Contract";
    } else if (totalRepairs >= 3) {
      suggestedAction = "High-Frequency Walk-in: Pitch Annual Contract";
    } else {
      suggestedAction = "Offer Maintenance Package Proposal";
    }

    rows.push({
      companyName: company,
      customerType: "Corporate",
      contactName: latestItem?.contactName || "—",
      phoneNumber: latestItem?.phoneNumber || "—",
      contractStatus: hasContract ? "Active Contract" : "Walk-in",
      totalRepairs,
      lastServiceDate: latestItem?.serviceDate || "—",
      suggestedAction,
    });
  });

  return rows.sort((a, b) => b.totalRepairs - a.totalRepairs);
}

// ─────────────────────────────────────────────────────────────
// Sales: Top Customer Repair Accounts
// ─────────────────────────────────────────────────────────────

export interface TopCustomersQuery {
  fromDate: Date;
  toDate: Date;
  searchTerm?: string;
  serviceType?: string;
  serviceLocation?: string;
  companyNames?: string[];
}

export interface TopCustomerRow {
  rank: number;
  companyName: string;
  customerType: string;
  totalJobs: number;
  finishedJobs: number;
  chargeableJobs: number;
  partsUsed: number;
  tier: string;
}

export async function fetchTopCustomersReport(
  query: TopCustomersQuery
): Promise<TopCustomerRow[]> {
  const params = new URLSearchParams({
    pageNumber: "1",
    pageSize: String(REPORT_PAGE_SIZE),
    fromDate: toBackendDate(query.fromDate),
    toDate: toBackendDate(query.toDate, true),
    sortBy: "ServiceDate",
    sortDescending: "true",
  });

  if (query.searchTerm?.trim()) params.set("searchTerm", query.searchTerm.trim());
  if (query.serviceType) params.set("serviceType", query.serviceType);
  if (query.serviceLocation) params.set("serviceLocation", query.serviceLocation);
  query.companyNames?.forEach((name) => params.append("companyNames", name));

  const rawItems = await fetchAndEnrichTickets(
    `/api/proxy/technicalservices/search?${params.toString()}`,
    "Top customers report"
  );

  const companyMap = new Map<string, RepairServiceItem[]>();
  rawItems.forEach((item) => {
    const key = item.companyName?.trim() || "Unspecified";
    if (!companyMap.has(key)) companyMap.set(key, []);
    companyMap.get(key)!.push(item);
  });

  const list: Omit<TopCustomerRow, "rank">[] = [];
  companyMap.forEach((items, company) => {
    const totalJobs = items.length;
    const finishedJobs = items.filter((i) => i.status === "Finished").length;
    const chargeableJobs = items.filter((i) => i.serviceType === "Charge").length;
    const partsUsed = items.reduce(
      (sum, i) =>
        sum +
        (i.sparepartItems?.reduce((pSum, p) => pSum + (p.quantity || 0), 0) ?? 0),
      0
    );

    let tier = "Silver";
    if (totalJobs >= 10 || partsUsed >= 5) {
      tier = "VIP Platinum";
    } else if (totalJobs >= 5 || partsUsed >= 2) {
      tier = "Gold";
    }

    list.push({
      companyName: company,
      customerType: "Corporate",
      totalJobs,
      finishedJobs,
      chargeableJobs,
      partsUsed,
      tier,
    });
  });

  list.sort((a, b) => b.totalJobs - a.totalJobs);

  return list.map((item, idx) => ({
    ...item,
    rank: idx + 1,
  }));
}

// ─────────────────────────────────────────────────────────────
// Technician Performance & KPI Scorecard Report
// ─────────────────────────────────────────────────────────────

export interface EngineerKpiQuery {
  fromDate: Date;
  toDate: Date;
  searchTerm?: string;
  serviceType?: string;
  serviceLocation?: string;
  companyNames?: string[];
  userIds?: string[];
}

export interface EngineerKpiRow {
  rank: number;
  engineerName: string;
  assignedJobs: number;
  finishedJobs: number;
  avgDays: string;
  successRate: string;
  activeWip: number;
  grade: string;
}

export async function fetchEngineerKpiReport(
  query: EngineerKpiQuery
): Promise<EngineerKpiRow[]> {
  const params = new URLSearchParams({
    pageNumber: "1",
    pageSize: String(REPORT_PAGE_SIZE),
    fromDate: toBackendDate(query.fromDate),
    toDate: toBackendDate(query.toDate, true),
    sortBy: "ServiceDate",
    sortDescending: "true",
  });

  if (query.searchTerm?.trim()) params.set("searchTerm", query.searchTerm.trim());
  if (query.serviceType) params.set("serviceType", query.serviceType);
  if (query.serviceLocation) params.set("serviceLocation", query.serviceLocation);
  query.companyNames?.forEach((name) => params.append("companyNames", name));
  query.userIds?.forEach((id) => params.append("userIds", id));

  const enriched = await fetchAndEnrichTickets(
    `/api/proxy/technicalservices/search?${params.toString()}`,
    "Engineer KPI report"
  );

  // Aggregate by engineer
  const engineerMap = new Map<string, RepairServiceItem[]>();
  enriched.forEach((item) => {
    const eng =
      item.repairByName ||
      item.inspectByName ||
      item.createdByName ||
      "Unassigned";
    if (!engineerMap.has(eng)) engineerMap.set(eng, []);
    engineerMap.get(eng)!.push(item);
  });

  const list: Omit<EngineerKpiRow, "rank">[] = [];
  engineerMap.forEach((items, engineerName) => {
    const assignedJobs = items.length;
    const finishedItems = items.filter((i) => i.status === "Finished");
    const finishedJobs = finishedItems.length;

    const totalDays = finishedItems.reduce(
      (sum, i) => sum + (i.daysTaken ?? calculateDaysTaken(i) ?? 0),
      0
    );
    const avgDaysNum = finishedJobs > 0 ? totalDays / finishedJobs : 0;
    const successRateNum = assignedJobs > 0 ? (finishedJobs / assignedJobs) * 100 : 0;

    const activeWip = items.filter(
      (i) =>
        i.status !== "Finished" &&
        i.status !== "Customer Rejected" &&
        i.status !== "Unrepairable"
    ).length;

    let grade = "Grade C";
    if (successRateNum >= 90 && avgDaysNum <= 2.5) {
      grade = "Grade A+ (Elite)";
    } else if (successRateNum >= 80 && avgDaysNum <= 4.0) {
      grade = "Grade A (Excellent)";
    } else if (successRateNum >= 65) {
      grade = "Grade B (Good)";
    }

    list.push({
      engineerName,
      assignedJobs,
      finishedJobs,
      avgDays: avgDaysNum.toFixed(1),
      successRate: `${successRateNum.toFixed(1)}%`,
      activeWip,
      grade,
    });
  });

  list.sort((a, b) => b.finishedJobs - a.finishedJobs);

  return list.map((item, idx) => ({
    ...item,
    rank: idx + 1,
  }));
}

// ─────────────────────────────────────────────────────────────
// Monthly Technical Department Performance & Summary Matrix
// ─────────────────────────────────────────────────────────────

export interface AnnualTechnicalAutoData {
  machineIn: number[];        // Row 1: ម៉ាស៊ីនចូល (12 elements)
  machineOut: number[];       // Row 2: ម៉ាស៊ីនចេញ (12 elements)
  unrepairable: number[];     // Row 3: ម៉ាស៊ីនជួសជុលមិនបាន (12 elements)
  awaitingConfirm: number[];  // Row 4: ម៉ាស៊ីនរង់ចាំការយល់ព្រមជួសជុល (12 elements)
  onsiteService: number[];    // Row 7: ឆែក&ជួសជុលម៉ាស៊ីនខាងក្រៅ (12 elements)
}

export async function fetchAnnualTechnicalMatrix(year: number): Promise<AnnualTechnicalAutoData> {
  const res = await fetch(`/api/proxy/technicalservices/annual-matrix?year=${year}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`Failed to load annual technical data (${res.status})`);
  }

  const data = await res.json();
  return {
    machineIn: data.machineIn ?? data.MachineIn ?? Array(12).fill(0),
    machineOut: data.machineOut ?? data.MachineOut ?? Array(12).fill(0),
    unrepairable: data.unrepairable ?? data.Unrepairable ?? Array(12).fill(0),
    awaitingConfirm: data.awaitingConfirm ?? data.AwaitingConfirm ?? Array(12).fill(0),
    onsiteService: data.onsiteService ?? data.OnsiteService ?? Array(12).fill(0),
  };
}


