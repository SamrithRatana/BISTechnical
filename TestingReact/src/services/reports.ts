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

import type { RepairServiceItem } from "./types";

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

  const res = await fetch(`/api/proxy/technicalservices/search?${params.toString()}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) throw new Error(`Report request failed with status ${res.status}`);

  const data = await res.json();
  // The endpoint returns a PagedResult; older shapes returned a bare array.
  return (data.items ?? data ?? []) as RepairServiceItem[];
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
export async function fetchSparepartUsage(from: Date, to: Date): Promise<SparepartUsageRow[]> {
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
    dateMode: "standard",
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
