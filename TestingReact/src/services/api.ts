/**
 * @file api.ts
 * @description Central API client for the Service Maintenance application.
 *
 * Architecture decisions:
 * - All types are imported from `./types` — never defined inline here.
 * - All mock/fallback data is imported from `./mockData`.
 * - A shared `getAuthHeaders()` helper avoids repeating the JWT header logic.
 * - A lightweight in-memory cache (`cachedFetch`) deduplicates inflight requests
 *   and caches results for 3 minutes — matching the C# CacheHelper TTL.
 */

// Re-export everything from types so consumers only need one import path
export type {
  SparePartItemDetail,
  SparePartItem,
  RepairServiceItem,
  ServiceStatusDbItem,
  PaginatedResult,
  CustomerItem,
  ItemModel,
  DashboardStats,
  LoginResponse
} from "./types";

export { SERVICE_STATUSES_DB, SERVICE_LOCATIONS } from "./types";

import type {
  RepairServiceItem,
  SparePartItem,
  CustomerItem,
  ItemModel,
  PaginatedResult,
  DashboardStats,
  LoginResponse
} from "./types";

import { SERVICE_STATUSES_DB } from "./types";

import {
  MOCK_SERVICE_TICKETS,
  MOCK_SPARE_PARTS,
  MOCK_CUSTOMERS,
  MOCK_ITEM_MODELS
} from "./mockData";

import { fetchUserMap, enrichTicketUsers } from "./userService";

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/**
 * Returns HTTP headers including an Authorization Bearer token when one exists
 * in localStorage. Safe to call in SSR (returns base headers only on server).
 */
function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("jwt_token");
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// In-memory + sessionStorage SWR cache for 0ms instant page loads
// ---------------------------------------------------------------------------

const DEFAULT_TTL_MS = 3 * 60 * 1_000; // 3 minutes TTL

/** Maximum number of entries before LRU eviction kicks in */
const MAX_CACHE_ENTRIES = 200;
/** Number of oldest entries to evict when the limit is hit */
const EVICT_COUNT = 50;

interface CacheEntry<T> {
  data: T;
  expiry: number;
  timestamp: number;
}

const cacheStore = new Map<string, CacheEntry<unknown>>();
const inflightRequests = new Map<string, Promise<unknown>>();
const cacheSubscribers = new Map<string, Set<(data: unknown) => void>>();

/**
 * LRU eviction: removes the oldest EVICT_COUNT entries when the cache
 * exceeds MAX_CACHE_ENTRIES. Prevents unbounded memory growth in long
 * browser sessions.
 */
function evictIfOverLimit(): void {
  if (cacheStore.size <= MAX_CACHE_ENTRIES) return;
  // Sort by timestamp ascending (oldest first)
  const sorted = Array.from(cacheStore.entries()).sort(
    ([, a], [, b]) => a.timestamp - b.timestamp
  );
  for (let i = 0; i < EVICT_COUNT && i < sorted.length; i++) {
    const key = sorted[i][0];
    cacheStore.delete(key);
    if (typeof window !== "undefined") {
      try { sessionStorage.removeItem(`cache:${key}`); } catch {}
    }
  }
}

/**
 * Reads a persisted entry out of sessionStorage into the memory map, expiry
 * and all. Returns undefined when there is nothing stored (or storage is
 * unavailable, e.g. during SSR or with cookies blocked).
 */
function readPersistedEntry<T>(key: string): CacheEntry<T> | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = sessionStorage.getItem(`cache:${key}`);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as CacheEntry<T>;
    cacheStore.set(key, parsed as CacheEntry<unknown>);
    return parsed;
  } catch {
    return undefined; // corrupt JSON or storage disabled
  }
}

/**
 * Reads from memory or sessionStorage.
 *
 * Deliberately returns stale data without checking expiry — callers use this
 * for the instant first paint and then let `cachedFetch` revalidate behind it.
 */
export function getCached<T>(key: string): T | null {
  const entry =
    (cacheStore.get(key) as CacheEntry<T> | undefined) ??
    readPersistedEntry<T>(key);
  return entry ? entry.data : null;
}

/** Stores `data` under `key` with TTL and persists to sessionStorage */
export function setCached<T>(key: string, data: T, ttlMs = DEFAULT_TTL_MS): void {
  const entry: CacheEntry<T> = {
    data,
    expiry: Date.now() + ttlMs,
    timestamp: Date.now()
  };
  cacheStore.set(key, entry as CacheEntry<unknown>);

  // ✅ LRU eviction: keep memory bounded
  evictIfOverLimit();

  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(`cache:${key}`, JSON.stringify(entry));
    } catch { /* storage quota exceeded */ }
  }

  // Notify subscribers if background revalidation finished
  const subs = cacheSubscribers.get(key);
  if (subs) {
    subs.forEach((cb) => cb(data));
  }
}

/** Removes exact cache keys */
export function invalidateCache(...keys: string[]): void {
  keys.forEach((k) => {
    cacheStore.delete(k);
    if (typeof window !== "undefined") {
      try { sessionStorage.removeItem(`cache:${k}`); } catch {}
    }
  });
}

/** Removes all cache keys matching `prefix` (or all if prefix is empty) */
export function invalidateCachePrefix(prefix: string): void {
  for (const key of Array.from(cacheStore.keys())) {
    if (!prefix || key.startsWith(prefix)) invalidateCache(key);
  }
}


/**
 * Fetches data with SWR (Stale-While-Revalidate) & inflight deduplication.
 * Returns cached data immediately if available, while revalidating in background.
 */
async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = DEFAULT_TTL_MS
): Promise<T> {
  // Seed from sessionStorage on a miss. The memory map starts empty after a
  // full page reload (F5, or following a link back into the app), so without
  // this the persisted copy was only ever read by callers that reached for
  // `getCached` directly — every cachedFetch caller refetched from scratch and
  // stared at a spinner, despite valid data sitting in sessionStorage. The
  // stored entry keeps its original expiry, so this restores the cache rather
  // than extending it.
  const entry =
    (cacheStore.get(key) as CacheEntry<T> | undefined) ??
    readPersistedEntry<T>(key);
  const isExpired = !entry || Date.now() > entry.expiry;

  // If we have valid non-expired cached data, return instantly!
  if (entry && !isExpired) {
    return entry.data;
  }

  const existingInflight = inflightRequests.get(key);
  if (existingInflight) {
    // If we have stale data, return stale immediately while inflight runs
    if (entry) return entry.data;
    return existingInflight as Promise<T>;
  }

  const fetchPromise = fetcher()
    .then((freshData) => {
      setCached(key, freshData, ttlMs);
      inflightRequests.delete(key);
      return freshData;
    })
    .catch((err: unknown) => {
      inflightRequests.delete(key);
      if (entry) return entry.data; // Return stale fallback on error
      throw err;
    });

  inflightRequests.set(key, fetchPromise as Promise<unknown>);

  // If stale entry exists, return stale data immediately (SWR behavior for 0ms load!)
  if (entry) {
    return entry.data;
  }

  return fetchPromise;
}

// ---------------------------------------------------------------------------
// Status mapping
// ---------------------------------------------------------------------------

/**
 * Maps a UI filter string (e.g. "Received") to the exact row in the
 * ServiceStatuses DB table so API search queries use the canonical name.
 */
export function getDbStatusMapping(filter: string): { id: number; name: string } {
  if (!filter || filter === "All") return { id: 0, name: "" };
  const f = filter.toUpperCase();

  if (f === "RECEIVED" || f === "ITEM RECIEVED")              return { id: 1,  name: "Item Recieved" };
  if (f === "INSPECTION")                                      return { id: 2,  name: "Inspection" };
  if (f === "AWAITING CUSTOMER CONFIRM" || f === "WAITING")   return { id: 3,  name: "Awaiting Customer Confirm" };
  if (f === "AWAITING SPAREPART" || f === "SPAREPART")        return { id: 4,  name: "Awaiting Sparepart" };
  if (f === "REPAIRING" || f === "APPROVE REPAIRING")         return { id: 5,  name: "Repairing" };
  if (f === "FINISHED")                                        return { id: 6,  name: "Finished" };
  if (f === "CUSTOMER REJECTED" || f === "REJECTED")          return { id: 7,  name: "Customer Rejected" };
  if (f === "UNREPAIRABLE")                                    return { id: 8,  name: "Unrepairable" };
  if (f === "REPAIR BY THIRD-PARTY" || f === "THIRD-PARTY")   return { id: 9,  name: "Repair by Third-Party" };
  if (f === "INSPECTING" || f === "INSPECT")                  return { id: 10, name: "Inspecting" };
  if (f === "SALE CONFIRMED" || f === "CONFIRMED SALE")       return { id: 11, name: "Sale Confirmed" };
  if (f === "SENT SPAREPARTS")                                 return { id: 12, name: "Sent Spareparts" };

  return { id: 0, name: filter };
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/**
 * Authenticates a user and returns a JWT token on success.
 * Calls `POST /api/auth/login`.
 */
export async function loginUser(userName: string, password: string): Promise<LoginResponse> {
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userName, password })
    });

    const data = (await res.json()) as LoginResponse;
    if (!res.ok || !data.isSuccess) {
      return { isSuccess: false, message: data.message ?? "Invalid username or password" };
    }
    return data;
  } catch {
    return {
      isSuccess: false,
      message: "Connection failed. Please check your internet or API service status."
    };
  }
}

// ---------------------------------------------------------------------------
// Status update
// ---------------------------------------------------------------------------

/**
 * Maps a UI status name to its dedicated C# BIS endpoint + payload.
 * Matches the Blazor Services exactly:
 *   InspectingService   → POST /api/inspecting          { id, inspectingBy }
 *   AwaitingCustomer    → POST /api/awaitingcustomerConfirm { id, setAwaitingCustomerConfirmBy }
 *   AwaitingSparepart   → POST /api/awaitingsparepart   { id, setAwaitingSparepartBy }
 *   CustomerRejected    → POST /api/customerrejected     { id, setCustomerRejectedBy }
 *   SaleConfirmed       → POST /api/saleconfirmed        { id, setSaleConfirmedBy }
 *   SentSpareparts      → POST /api/sentspareparts       { id, setSentSparepartsBy }
 *   Unrepairable        → POST /api/unrepairable         { id, setUnrepairableBy }
 *   Repairing           → POST /api/repairitem           { id, repairBy }
 *   ThirdParty          → POST /api/thirdpartyrepair     { id, thirdPartyRepairBy }
 */
function buildStatusRequest(
  id: string,
  newStatus: string,
  performedBy: string
): { endpoint: string; payload: Record<string, string> } | null {
  const status = newStatus.toLowerCase();
  const NULL_GUID = "00000000-0000-0000-0000-000000000000";
  const by = performedBy || NULL_GUID;

  if (status === "inspecting")
    return { endpoint: "/api/proxy/inspecting", payload: { id, inspectingBy: by } };
  if (status === "awaiting customer confirm")
    return { endpoint: "/api/proxy/awaitingcustomerConfirm", payload: { id, setAwaitingCustomerConfirmBy: by } };
  if (status === "awaiting sparepart")
    return { endpoint: "/api/proxy/awaitingsparepart", payload: { id, setAwaitingSparepartBy: by } };
  if (status === "customer rejected")
    return { endpoint: "/api/proxy/customerrejected", payload: { id, setCustomerRejectedBy: by } };
  if (status === "sale confirmed")
    return { endpoint: "/api/proxy/saleconfirmed", payload: { id, setSaleConfirmedBy: by } };
  if (status === "sent spareparts")
    return { endpoint: "/api/proxy/sentspareparts", payload: { id, setSentSparepartsBy: by } };
  if (status === "unrepairable")
    return { endpoint: "/api/proxy/unrepairable", payload: { id, setUnrepairableBy: by } };
  if (status === "repairing")
    return { endpoint: "/api/proxy/repairitem", payload: { id, repairBy: by } };
  if (status === "repair by third-party")
    return { endpoint: "/api/proxy/thirdpartyrepair", payload: { id, thirdPartyRepairBy: by } };
  if (status === "finished")
    return { endpoint: "/api/proxy/finishedrepair", payload: { id, verifiedBy: by } };

  // Deliberately no "inspection" case. It used to POST /inspectitem with
  // inspection/solution hardcoded to "Completed", which the handler writes
  // straight onto the ticket — silently destroying the technician's real
  // findings every time the transition ran. A ticket reaches "Inspection"
  // by completing the inspect dialog, which sends the actual text.
  return null;
}

/**
 * Updates a service ticket's status by calling the correct dedicated BIS endpoint.
 * Matches how Blazor's BIS services work — each status has its own POST endpoint
 * with a small targeted payload (id + performedBy guid).
 */
export async function updateServiceStatus(
  item: RepairServiceItem,
  newStatus: string
): Promise<boolean> {
  invalidateCachePrefix("repairservices");
  invalidateCachePrefix("dashboard");

  // Resolve the current user's GUID for the "performedBy" field
  let performedBy = "00000000-0000-0000-0000-000000000000";
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("user_info");
      if (raw) {
        const parsed = JSON.parse(raw) as { id?: string };
        if (parsed.id) performedBy = parsed.id;
      }
      if (performedBy === "00000000-0000-0000-0000-000000000000") {
        const token = localStorage.getItem("jwt_token");
        if (token) {
          const parts = token.split(".");
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
            performedBy = payload.nameid ?? payload.sub ?? payload.nameidentifier ?? performedBy;
          }
        }
      }
    } catch { /* ignore */ }
  }

  const statusRequest = buildStatusRequest(item.id, newStatus, performedBy);

  if (statusRequest) {
    // Use the dedicated BIS endpoint for this status
    try {
      const res = await fetch(statusRequest.endpoint, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(statusRequest.payload)
      });
      if (res.ok) {
        // Development only. This fires on every status change a technician
        // makes, so in production it was writing a line per action to the
        // user's console for no diagnostic gain — the same reasoning that
        // already gates the proxy route's per-request logging.
        if (process.env.NODE_ENV !== "production") {
          console.log(`✅ Status updated to "${newStatus}" via ${statusRequest.endpoint}`);
        }
        return true;
      }
      const errText = await res.text().catch(() => "");
      console.error(`❌ Status update failed [${res.status}]: ${errText}`);
      return false;
    } catch (err: unknown) {
      console.error("Failed to update status via BIS endpoint:", err);
      return false;
    }
  }

  // Fallback: for unmapped statuses use the generic PUT endpoint.
  // Backend route is `PUT /technicalservices` (id goes in the body — there
  // is no `/technicalservices/{id}` route to PUT against). Note this still
  // round-trips the item's spare-parts sub-array back to a full-record
  // update endpoint that expects a complete `SparepartItemDTO[]`; if the
  // client's copy of that array is incomplete, fields on it can be silently
  // dropped server-side. In practice every mapped status above is handled
  // by its own dedicated endpoint, so this path should rarely execute.
  console.warn(`⚠️ No specific BIS endpoint for status "${newStatus}", using fallback PUT`);
  const matched = SERVICE_STATUSES_DB.find((s) => s.name === newStatus);
  const updated: RepairServiceItem = {
    ...item,
    status: newStatus,
    statusId: matched?.id ?? item.statusId
  };
  try {
    const res = await fetch(`/api/proxy/technicalservices`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(updated)
    });
    return res.ok;
  } catch (err: unknown) {
    console.error("Fallback PUT status update failed:", err);
    return false;
  }
}


/**
 * Deletes a service ticket by ID.
 * Calls `DELETE /api/proxy/technicalservices/{id}`.
 */
export async function deleteTechnicalService(id: string): Promise<boolean> {
  invalidateCachePrefix("repairservices");
  invalidateCachePrefix("dashboard");
  try {
    let res = await fetch(`/api/proxy/receiveitem/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      res = await fetch(`/api/proxy/technicalservices/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders()
      });
    }
    return res.ok;
  } catch (err: unknown) {
    console.error("Failed to delete technical service:", err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Internal fetch helpers
// ---------------------------------------------------------------------------

/** Parses paginated API response or falls back to an empty page. */
function parsePaginatedResponse<T>(
  data: Record<string, unknown>,
  pageNumber: number,
  pageSize: number
): PaginatedResult<T> {
  const rawList = (data.items ?? data.Data ?? (Array.isArray(data) ? data : [])) as T[];
  const total   = (data.totalCount ?? data.TotalCount ?? rawList.length) as number;
  return {
    items: rawList,
    totalCount: total,
    pageNumber,
    pageSize,
    totalPages: Math.max(Math.ceil(total / pageSize), 1)
  };
}

/**
 * Extra `/technicalservices/search` filters beyond status + free text.
 *
 * Keys must be real `ServiceSearchQuery` parameters — anything else is
 * silently ignored by the backend, which looks identical to a filter that
 * matched nothing. Currently used by the AI search to pass through the
 * date window and free/charge distinction it extracted from the question.
 */
export interface ServiceSearchExtras {
  fromDate?: string;
  toDate?: string;
  /** "Free" | "Charge" */
  serviceType?: string;
  /** "Company" | "CustomerSite" */
  serviceLocation?: string;
  /** Relative date window: "Today" | "Yesterday" | "LastWeek" | "LastMonth" */
  dateFilter?: string;
  useProcessDateFiltering?: boolean;
  statusesForProcessFiltering?: string[];
  userIds?: string[];
  userFilterStatuses?: string[];
}

/**
 * UI filter names that describe a *date window*, not a ticket status.
 *
 * The dashboard's "Today's Report" tile and its table both pass "Today" as the
 * active filter, and that used to be forwarded as `status=Today`. No ticket
 * status is named "Today", so the backend matched nothing and the dashboard
 * showed an empty table and a 0 tile on every load. These map to the
 * `dateFilter` parameter instead, which is what `ServiceSearchQuery.DateFilter`
 * on the backend actually understands.
 */
const DATE_WINDOW_FILTERS: Record<string, string> = {
  TODAY:     "Today",
  YESTERDAY: "Yesterday",
  LASTWEEK:  "LastWeek",
  LASTMONTH: "LastMonth"
};

/** Fetches a single status's repair services (no caching — caller handles it). */
async function fetchSingleStatusServices(
  pageNumber: number,
  pageSize: number,
  statusName: string,
  searchTerm: string,
  extras?: ServiceSearchExtras
): Promise<{ items: RepairServiceItem[]; totalCount: number }> {
  const params = new URLSearchParams({
    pageNumber: pageNumber.toString(),
    pageSize:   pageSize.toString(),
    sortBy:     "reportNo",
    sortDescending: "true"
  });

  // Only the first batch needs the total. The lists load by infinite scroll,
  // and the backend was re-counting the entire filtered set on every scroll —
  // a second full pass for a number that cannot have changed. `useInfiniteList`
  // keeps the total it was given (it guards on a falsy value) and decides
  // "end of list" from batch size, not from the count, so later batches can
  // safely go without it. Same for `fetchAllMatches`, which only reads page 1's.
  if (pageNumber > 1) params.set("includeTotalCount", "false");
  if (statusName && statusName !== "All") params.set("status", statusName);
  if (searchTerm) params.set("searchTerm", searchTerm);
  if (extras?.dateFilter)      params.set("dateFilter",      extras.dateFilter);
  if (extras?.fromDate)        params.set("fromDate",        extras.fromDate);
  if (extras?.toDate)          params.set("toDate",          extras.toDate);
  if (extras?.serviceType)     params.set("serviceType",     extras.serviceType);
  if (extras?.serviceLocation) params.set("serviceLocation", extras.serviceLocation);
  if (extras?.useProcessDateFiltering) params.set("useProcessDateFiltering", "true");
  if (extras?.statusesForProcessFiltering && extras.statusesForProcessFiltering.length > 0) {
    extras.statusesForProcessFiltering.forEach((st) => params.append("statusesForProcessFiltering", st));
  }
  if (extras?.userIds && extras.userIds.length > 0) {
    extras.userIds.forEach((u) => params.append("userIds", u));
  }
  if (extras?.userFilterStatuses && extras.userFilterStatuses.length > 0) {
    extras.userFilterStatuses.forEach((st) => params.append("userFilterStatuses", st));
  }

  const res = await fetch(
    `/api/proxy/technicalservices/search?${params.toString()}`,
    { headers: getAuthHeaders() }
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = (await res.json()) as Record<string, unknown>;
  const items      = (data.items ?? data.Items ?? data.Data ?? (Array.isArray(data) ? data : [])) as RepairServiceItem[];
  const totalCount = (data.totalCount ?? data.TotalCount ?? items.length) as number;
  return { items, totalCount };
}

// ---------------------------------------------------------------------------
// Public API functions
// ---------------------------------------------------------------------------

/**
 * Runs a paginated fetcher repeatedly until every page has been retrieved,
 * merging the results into one combined page. This is how "search shows
 * every match" is implemented across the app: search result counts aren't
 * predictable (could be 3 rows or 3,000), so rather than pick a single
 * generous-but-still-arbitrary page size, this fetches page 1, reads the
 * real `totalCount` the backend reports, and fetches whatever remaining
 * pages that implies (in parallel) — genuinely unbounded rather than
 * capped.
 *
 * `MAX_PAGES` is a safety cap (not a product limit) purely against a
 * malformed/incorrect `totalCount` from the backend turning one search into
 * thousands of requests; at `pageSize` 100 that's already 10,000 records,
 * far beyond anything this app's tables realistically return.
 */
export async function fetchAllMatches<T>(
  fetchPage: (pageNumber: number, pageSize: number) => Promise<PaginatedResult<T>>,
  pageSize = 100
): Promise<PaginatedResult<T>> {
  const MAX_PAGES = 100;

  const first = await fetchPage(1, pageSize);
  const totalPages = Math.min(MAX_PAGES, Math.max(1, Math.ceil(first.totalCount / pageSize)));

  if (totalPages <= 1) return first;

  const rest = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, i) => fetchPage(i + 2, pageSize))
  );

  const items = [first, ...rest].flatMap((r) => r.items);

  return {
    items,
    totalCount: first.totalCount,
    pageNumber: 1,
    pageSize: items.length,
    totalPages: 1
  };
}

/**
 * Fetches paginated items from the device/item registry.
 * Maps to `ItemModelList.razor` → `GET /api/proxy/items`.
 */
export async function fetchItemsInventory(
  pageNumber = 1,
  pageSize   = 20,
  searchTerm = ""
): Promise<PaginatedResult<ItemModel>> {
  const cacheKey = `items:page${pageNumber}:size${pageSize}:search${searchTerm}`;
  return cachedFetch(cacheKey, async () => {
    try {
      const params = new URLSearchParams({
        pageNumber: pageNumber.toString(),
        pageSize:   pageSize.toString()
      });
      if (searchTerm) params.set("searchTerm", searchTerm);

      const endpoint = searchTerm ? "/api/proxy/items/search" : "/api/proxy/items";

      const res = await fetch(
        `${endpoint}?${params.toString()}`,
        { headers: getAuthHeaders() }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Record<string, unknown>;
      const rawList = (data.items ?? data.Data ?? (Array.isArray(data) ? data : [])) as Record<string, unknown>[];
      const items: ItemModel[] = rawList.map((i) => ({
        id:           String(i.id ?? i.Id ?? ""),
        itemName:     String(i.itemName ?? i.ItemName ?? ""),
        serialNumber: String(i.serialNumber ?? i.SerialNumber ?? ""),
        itemType:     String(i.itemType ?? i.ItemType ?? "N/A")
      }));
      const total = (data.totalCount ?? data.TotalCount ?? items.length) as number;
      return { items, totalCount: total, pageNumber, pageSize, totalPages: Math.max(Math.ceil(total / pageSize), 1) };
    } catch {
      // Offline fallback
      const filtered = searchTerm
        ? MOCK_ITEM_MODELS.filter(
            (m) =>
              m.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
              (m.serialNumber ?? "").toLowerCase().includes(searchTerm.toLowerCase())
          )
        : MOCK_ITEM_MODELS;
      return {
        items:      filtered,
        totalCount: filtered.length,
        pageNumber,
        pageSize,
        totalPages: Math.ceil(filtered.length / pageSize)
      };
    }
  });
}

/**
 * Fetches paginated spare parts inventory, optionally filtered by a search
 * term. Maps to `SparePartList.razor` → `GET /api/proxy/spareparts`, and to
 * `/spareparts/search` when a term is supplied — the backend matches that
 * term against ItemName, SerialNumber, Description and UseFor across the
 * whole table, which is the only way to find a part that isn't on the page
 * currently being shown.
 */
/**
 * Fetches a single spare part's catalog record by id.
 * Calls `GET /api/proxy/spareparts/{id}`.
 *
 * The ticket's own SparepartItems sub-table (returned by fetchServiceById)
 * only carries SparepartId/Description/Quantity/Condition — the catalog
 * fields (ItemName, UseFor, PictureUrl, stock Quantity) live on the separate
 * Spareparts table and must be resolved per id, same as the Blazor dialog's
 * LoadSelectedSparePartsOnly.
 */
export async function fetchSparePartById(id: string): Promise<SparePartItem | null> {
  if (!id) return null;
  try {
    const res = await fetch(`/api/proxy/spareparts/${id}`, { headers: getAuthHeaders() });
    if (!res.ok) return null;
    const p = (await res.json()) as Record<string, unknown>;
    if (!p || typeof p !== "object") return null;
    return {
      id:           String(p.id ?? id),
      partNumber:   String(p.serialNumber ?? p.SerialNumber ?? p.partNumber ?? ""),
      serialNumber: String(p.serialNumber ?? p.SerialNumber ?? ""),
      itemName:     String(p.itemName ?? p.ItemName ?? p.name ?? ""),
      useFor:       String(p.useFor ?? p.UseFor ?? p.modelCompatible ?? ""),
      pictureUrl:   String(p.pictureUrl ?? p.PictureUrl ?? ""),
      quantity:     Number(p.quantity ?? p.Quantity ?? 0),
      defaultPrice: Number(p.defaultPrice ?? p.DefaultPrice ?? p.unitPrice ?? 0),
      description:  String(p.description ?? p.Description ?? ""),
      status:       String(p.status ?? "")
    };
  } catch (err: unknown) {
    console.error("Failed to fetch spare part by id:", err);
    return null;
  }
}

export async function fetchSparePartsInventory(
  pageNumber = 1,
  pageSize   = 10,
  searchTerm = ""
): Promise<PaginatedResult<SparePartItem>> {
  const cacheKey = `spareparts:page${pageNumber}:size${pageSize}:search${searchTerm}`;
  return cachedFetch(cacheKey, async () => {
    try {
      const params = new URLSearchParams({
        pageNumber: pageNumber.toString(),
        pageSize:   pageSize.toString()
      });
      if (searchTerm) params.set("searchTerm", searchTerm);
      const endpoint = searchTerm ? "/api/proxy/spareparts/search" : "/api/proxy/spareparts";

      const res = await fetch(
        `${endpoint}?${params.toString()}`,
        { headers: getAuthHeaders() }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Record<string, unknown>;

      // Normalise mixed PascalCase / camelCase keys returned by the API
      const rawList = (data.items ?? data.Data ?? (Array.isArray(data) ? data : [])) as Record<string, unknown>[];
      const items: SparePartItem[] = rawList.map((p) => ({
        id:           String(p.id ?? ""),
        partNumber:   String(p.serialNumber ?? p.SerialNumber ?? p.partNumber ?? ""),
        serialNumber: String(p.serialNumber ?? p.SerialNumber ?? ""),
        itemName:     String(p.itemName ?? p.ItemName ?? p.name ?? ""),
        useFor:       String(p.useFor ?? p.UseFor ?? p.modelCompatible ?? ""),
        pictureUrl:   String(p.pictureUrl ?? p.PictureUrl ?? ""),
        quantity:     Number(p.quantity ?? p.Quantity ?? 0),
        defaultPrice: Number(p.defaultPrice ?? p.DefaultPrice ?? p.unitPrice ?? 0),
        description:  String(p.description ?? p.Description ?? ""),
        status:       String(p.status ?? "")
      }));

      const total = (data.totalCount ?? data.TotalCount ?? items.length) as number;
      return { items, totalCount: total, pageNumber, pageSize, totalPages: Math.max(Math.ceil(total / pageSize), 1) };
    } catch {
      // Offline: mirror the server's search fields so the fallback behaves
      // the same way rather than ignoring the term and showing everything.
      const term = searchTerm.trim().toLowerCase();
      const filtered = term
        ? MOCK_SPARE_PARTS.filter((p) =>
            (p.itemName ?? "").toLowerCase().includes(term) ||
            (p.serialNumber ?? "").toLowerCase().includes(term) ||
            (p.description ?? "").toLowerCase().includes(term) ||
            (p.useFor ?? "").toLowerCase().includes(term)
          )
        : MOCK_SPARE_PARTS;
      return {
        items:      filtered,
        totalCount: filtered.length,
        pageNumber,
        pageSize,
        totalPages: Math.max(Math.ceil(filtered.length / pageSize), 1)
      };
    }
  });
}

/**
 * Creates a new spare part.
 * Calls `POST /api/proxy/spareparts`.
 */
export async function createSparePart(part: SparePartItem): Promise<boolean> {
  invalidateCachePrefix("spareparts");
  try {
    const payload = {
      itemName:     part.itemName,
      serialNumber: part.serialNumber ?? part.partNumber,
      description:  part.description ?? "",
      useFor:       part.useFor ?? "",
      pictureUrl:   part.pictureUrl ?? "",
      quantity:     part.quantity ?? 0,
      defaultPrice: part.defaultPrice ?? 0
    };
    const res = await fetch("/api/proxy/spareparts", {
      method:  "POST",
      headers: getAuthHeaders(),
      body:    JSON.stringify(payload)
    });
    return res.ok;
  } catch (err: unknown) {
    console.error("Failed to create spare part:", err);
    return false;
  }
}

/**
 * Updates an existing spare part.
 * Calls `PUT /api/proxy/spareparts`.
 */
export async function updateSparePart(
  part:        SparePartItem,
  performedBy = "00000000-0000-0000-0000-000000000000"
): Promise<boolean> {
  invalidateCachePrefix("spareparts");
  try {
    const payload = {
      id:           part.id,
      itemName:     part.itemName,
      serialNumber: part.serialNumber ?? part.partNumber,
      description:  part.description ?? "",
      useFor:       part.useFor ?? "",
      pictureUrl:   part.pictureUrl ?? "",
      quantity:     part.quantity ?? 0,
      defaultPrice: part.defaultPrice ?? 0,
      performedBy
    };
    const res = await fetch("/api/proxy/spareparts", {
      method:  "PUT",
      headers: getAuthHeaders(),
      body:    JSON.stringify(payload)
    });
    return res.ok;
  } catch (err: unknown) {
    console.error("Failed to update spare part:", err);
    return false;
  }
}

/**
 * Deletes a spare part by ID.
 * Calls `DELETE /api/proxy/spareparts/{id}`.
 */
export async function deleteSparePart(id: string): Promise<boolean> {
  invalidateCachePrefix("spareparts");
  try {
    const res = await fetch(`/api/proxy/spareparts/${id}`, {
      method:  "DELETE",
      headers: getAuthHeaders()
    });
    return res.ok;
  } catch (err: unknown) {
    console.error("Failed to delete spare part:", err);
    return false;
  }
}

/**
 * Records a manual stock-out transaction.
 * Calls `POST /api/proxy/spareparts/manual-stockout`.
 */
export async function insertManualStockOut(
  sparepartId: string,
  quantity:    number,
  reason:      string,
  performedBy = "00000000-0000-0000-0000-000000000000"
): Promise<boolean> {
  invalidateCachePrefix("spareparts");
  try {
    const res = await fetch("/api/proxy/spareparts/manual-stockout", {
      method:  "POST",
      headers: getAuthHeaders(),
      body:    JSON.stringify({ sparepartId, quantity, reason, performedBy })
    });
    return res.ok;
  } catch (err: unknown) {
    console.error("Failed to record stock-out:", err);
    return false;
  }
}

/**
 * Fetches paginated customers.
 * Maps to `CustomerList.razor` → `GET /api/proxy/customercenter/customers`.
 */
export async function fetchCustomerCenter(
  pageNumber = 1,
  pageSize   = 10,
  searchTerm = ""
): Promise<PaginatedResult<CustomerItem>> {
  const cacheKey = `customers:page${pageNumber}:size${pageSize}:search${searchTerm}`;
  return cachedFetch(cacheKey, async () => {
    try {
      const params = new URLSearchParams({
        service:    "customer",
        pageNumber: pageNumber.toString(),
        pageSize:   pageSize.toString()
      });
      if (searchTerm) params.set("searchTerm", searchTerm);

      const res = await fetch(`/api/proxy/Customer?${params.toString()}`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Record<string, unknown>;

      const rawList = (data.data ?? data.Data ?? data.items ?? (Array.isArray(data) ? data : [])) as Record<string, unknown>[];
      const items: CustomerItem[] = rawList.map((c) => ({
        id:           String(c.id ?? c.Id ?? c.customerId ?? ""),
        companyName:  String(c.companyName ?? c.CompanyName ?? c.name ?? "N/A"),
        contactName:  String(c.contactName ?? c.ContactName ?? c.contactPerson ?? "—"),
        phoneNumber:  String(c.phoneNumber ?? c.PhoneNumber ?? c.phone ?? "—"),
        address:      String(c.address ?? c.Address ?? "—"),
        customerType: String(c.customerType ?? c.CustomerType ?? "Corporate"),
        isActive:     Boolean(c.isActive ?? true)
      }));

      const total = (data.totalRecords ?? data.TotalRecords ?? data.totalCount ?? items.length) as number;
      return {
        items,
        totalCount: total,
        pageNumber,
        pageSize,
        totalPages: Math.max(Math.ceil(total / pageSize), 1)
      };
    } catch (err: unknown) {
      console.error("Failed to fetch customer center:", err);
      return {
        items:      MOCK_CUSTOMERS,
        totalCount: MOCK_CUSTOMERS.length,
        pageNumber,
        pageSize,
        totalPages: Math.ceil(MOCK_CUSTOMERS.length / pageSize)
      };
    }
  });
}

/**
 * Creates a new customer in Customer Center.
 * Calls `POST /api/proxy/Customer?service=customer`.
 */
export async function createCustomer(customer: Partial<CustomerItem>): Promise<boolean> {
  invalidateCachePrefix("customers");
  try {
    const res = await fetch("/api/proxy/Customer?service=customer", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(customer)
    });
    return res.ok;
  } catch (err: unknown) {
    console.error("Failed to create customer:", err);
    return false;
  }
}

/**
 * Updates an existing customer in Customer Center.
 * Calls `PUT /api/proxy/Customer/{id}?service=customer`.
 */
export async function updateCustomer(id: string, customer: Partial<CustomerItem>): Promise<boolean> {
  invalidateCachePrefix("customers");
  try {
    const res = await fetch(`/api/proxy/Customer/${id}?service=customer`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ ...customer, id })
    });
    return res.ok;
  } catch (err: unknown) {
    console.error("Failed to update customer:", err);
    return false;
  }
}

/**
 * Deletes a customer by ID.
 * Calls `DELETE /api/proxy/Customer/{id}?service=customer`.
 */
export async function deleteCustomer(id: string): Promise<boolean> {
  invalidateCachePrefix("customers");
  try {
    const res = await fetch(`/api/proxy/Customer/${id}?service=customer`, {
      method: "DELETE",
      headers: getAuthHeaders()
    });
    return res.ok;
  } catch (err: unknown) {
    console.error("Failed to delete customer:", err);
    return false;
  }
}

/**
 * Fetches paginated service tickets, optionally filtered by status.
 * Handles multi-status merging for the Approve Repairing page.
 * Maps to `GET /api/proxy/technicalservices/search`.
 */
export async function fetchRepairServices(
  pageNumber = 1,
  pageSize   = 10,
  filter     = "All",
  searchTerm = "",
  extras?: ServiceSearchExtras
): Promise<PaginatedResult<RepairServiceItem>> {
  // `extras` is part of the cache key: without it, an AI-filtered query
  // ("finished last week") would read back the unfiltered result cached
  // under the same status + search term.
  const extraKey = extras
    ? `:from${extras.fromDate ?? ""}:to${extras.toDate ?? ""}:type${extras.serviceType ?? ""}`
    : "";
  const cacheKey = `repairservices:${filter}:page${pageNumber}:size${pageSize}:search${searchTerm}${extraKey}`;

  return cachedFetch(cacheKey, async () => {
    const filterUpper = filter.toUpperCase();

    // "Today" and friends name a date window, not a status — send them as
    // `dateFilter` with no status, otherwise the backend looks for a ticket
    // status by that name and matches nothing. See DATE_WINDOW_FILTERS.
    const dateWindow = DATE_WINDOW_FILTERS[filterUpper];
    if (dateWindow) {
      try {
        const { items, totalCount } = await fetchSingleStatusServices(
          pageNumber,
          pageSize,
          "",
          searchTerm,
          { ...extras, dateFilter: dateWindow }
        );

        const userMap = await fetchUserMap().catch(() => new Map());
        return {
          items:      items.map((item) => enrichTicketUsers(item, userMap)),
          totalCount,
          pageNumber,
          pageSize,
          totalPages: Math.max(Math.ceil(totalCount / pageSize), 1)
        };
      } catch (err: unknown) {
        console.warn(`Date-window fetch (${dateWindow}) failed, using fallback:`, err);
      }
    }

    // Approve Repairing page merges three statuses (RepairItemList.razor)
    if (filterUpper === "REPAIRING" || filterUpper === "APPROVE REPAIRING") {
      try {
        const statuses = ["Sent Spareparts", "Inspection", "Sale Confirmed"];
        const results  = await Promise.all(
          statuses.map((st) => fetchSingleStatusServices(pageNumber, pageSize, st, searchTerm, extras))
        );

        // Deduplicate by ID and sort descending by reportNo
        const uniqueMap = new Map<string, RepairServiceItem>();
        let total = 0;
        results.forEach((r) => {
          r.items.forEach((i) => uniqueMap.set(i.id, i));
          total += r.totalCount;
        });
        const combinedItems = Array.from(uniqueMap.values()).sort((a, b) =>
          (b.reportNo ?? "").localeCompare(a.reportNo ?? "")
        );

        const userMap = await fetchUserMap().catch(() => new Map());
        const enrichedCombined = combinedItems.map((item) => enrichTicketUsers(item, userMap));

        return {
          items:      enrichedCombined,
          totalCount: total,
          pageNumber,
          pageSize,
          totalPages: Math.max(Math.ceil(total / pageSize), 1)
        };
      } catch (err: unknown) {
        console.warn("Multi-status fetch failed, using fallback:", err);
      }
    }

    const statusMap = getDbStatusMapping(filter);

    try {
      const { items, totalCount } = await fetchSingleStatusServices(
        pageNumber,
        pageSize,
        statusMap.name,
        searchTerm,
        extras
      );

      const userMap = await fetchUserMap().catch(() => new Map());
      const enrichedItems = items.map((item) => enrichTicketUsers(item, userMap));

      return {
        items:      enrichedItems,
        totalCount,
        pageNumber,
        pageSize,
        totalPages: Math.max(Math.ceil(totalCount / pageSize), 1)
      };
    } catch {
      // Offline: filter + paginate mock data
      let filtered = [...MOCK_SERVICE_TICKETS];

      if (statusMap.name) {
        const target = statusMap.name.toLowerCase();
        filtered = filtered.filter(
          (i) => i.status.toLowerCase() === target || i.statusId === statusMap.id
        );
      }

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(
          (i) =>
            i.companyName.toLowerCase().includes(term) ||
            i.itemName.toLowerCase().includes(term) ||
            i.serialNumber.toLowerCase().includes(term) ||
            (i.reportNo ?? "").toLowerCase().includes(term)
        );
      }

      const start = (pageNumber - 1) * pageSize;
      const page  = filtered.slice(start, start + pageSize);
      return {
        items:      page,
        totalCount: filtered.length,
        pageNumber,
        pageSize,
        totalPages: Math.max(Math.ceil(filtered.length / pageSize), 1)
      };
    }
  });
}

/**
 * Fetches tickets for the Approve Verify (QA) queue.
 *
 * With no search term, only "Repairing" tickets are shown — a ticket only
 * needs verifying once it's actually finished, but keeping already-Finished
 * tickets out of the default view stops the queue from accumulating
 * everything ever verified. Once the user searches, "Finished" tickets are
 * merged back in too, so a specific ticket can still be found by ref
 * no/company/serial regardless of whether it's still being repaired or
 * already finished. Mirrors the multi-status merge in `fetchRepairServices`
 * above (RepairItemList.razor's pattern), but with its own status set.
 * Maps to `GET /api/proxy/technicalservices/search`.
 */
export async function fetchApproveVerifyServices(
  pageNumber = 1,
  pageSize   = 10,
  searchTerm = ""
): Promise<PaginatedResult<RepairServiceItem>> {
  const term = searchTerm.trim();
  const statuses = term ? ["Repairing", "Finished"] : ["Repairing"];
  const cacheKey = `repairservices:ApproveVerify:page${pageNumber}:size${pageSize}:search${term}`;

  return cachedFetch(cacheKey, async () => {
    try {
      const results = await Promise.all(
        statuses.map((st) => fetchSingleStatusServices(pageNumber, pageSize, st, term))
      );

      // Deduplicate by ID and sort descending by reportNo
      const uniqueMap = new Map<string, RepairServiceItem>();
      let total = 0;
      results.forEach((r) => {
        r.items.forEach((i) => uniqueMap.set(i.id, i));
        total += r.totalCount;
      });
      const combinedItems = Array.from(uniqueMap.values()).sort((a, b) =>
        (b.reportNo ?? "").localeCompare(a.reportNo ?? "")
      );

      const userMap = await fetchUserMap().catch(() => new Map());
      const enrichedCombined = combinedItems.map((item) => enrichTicketUsers(item, userMap));

      return {
        items:      enrichedCombined,
        totalCount: total,
        pageNumber,
        pageSize,
        totalPages: Math.max(Math.ceil(total / pageSize), 1)
      };
    } catch (err: unknown) {
      console.warn("Approve Verify fetch failed, using fallback:", err);

      // Offline: filter + paginate mock data
      let filtered = MOCK_SERVICE_TICKETS.filter((i) =>
        statuses.some((st) => i.status.toLowerCase() === st.toLowerCase())
      );

      if (term) {
        const t = term.toLowerCase();
        filtered = filtered.filter(
          (i) =>
            i.companyName.toLowerCase().includes(t) ||
            i.itemName.toLowerCase().includes(t) ||
            i.serialNumber.toLowerCase().includes(t) ||
            (i.reportNo ?? "").toLowerCase().includes(t)
        );
      }

      const start = (pageNumber - 1) * pageSize;
      const page  = filtered.slice(start, start + pageSize);
      return {
        items:      page,
        totalCount: filtered.length,
        pageNumber,
        pageSize,
        totalPages: Math.max(Math.ceil(filtered.length / pageSize), 1)
      };
    }
  });
}

/**
 * Fetches one complete service ticket by id.
 *
 * The list/search endpoint is not a substitute: it omits fields the edit
 * form needs (and returns a row that may be stale by the time the dialog
 * opens). Mirrors `InspectItemService.GetRepairServiceByIdAsync` in the
 * Blazor app, which loads the edit dialog from this endpoint for the same
 * reason. Deliberately uncached — an edit form must start from live state.
 *
 * Note the API's `Service` DTO carries no ItemId/CustomerId, so callers that
 * need those resolve them by serial/company lookup (as the Blazor app does).
 */
export async function fetchServiceById(id: string): Promise<RepairServiceItem | null> {
  if (!id || id.startsWith("new-")) return null;
  try {
    const res = await fetch(`/api/proxy/technicalservices/${id}`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) return null;
    const data = (await res.json()) as RepairServiceItem;
    if (!data || !data.id) return null;
    const userMap = await fetchUserMap().catch(() => new Map());
    return enrichTicketUsers(data, userMap);
  } catch (err: unknown) {
    console.error("Failed to fetch service by id:", err);
    return null;
  }
}

/** All-zero stats — what the tiles show when the backend can't be reached. */
const EMPTY_DASHBOARD_STATS: DashboardStats = {
  todayCount:             0,
  receivedCount:          0,
  waitingCustomerCount:   0,
  waitingSpareCount:      0,
  finishedCount:          0,
  finishedThisMonthCount: 0
};

/**
 * Fetches every dashboard stat tile in one request.
 * Uses a shorter 1-minute TTL since stats are time-sensitive.
 * Calls `GET /api/proxy/technicalservices/dashboard-stats`.
 *
 * The tiles used to be derived client-side by running one full ticket search
 * per tile with `pageSize=1` purely to read `totalCount` off each — four
 * proxied round trips, four filtered scans of Services, to render four
 * integers. The backend now answers all of them from a single grouped count.
 *
 * On failure this returns zeros rather than plausible-looking numbers: the
 * previous stub (2 / 7 / 66 / 12 / 106) was indistinguishable from real data
 * on screen, so an outage looked like a quiet workday.
 */
export async function fetchDashboardStats(): Promise<DashboardStats> {
  return cachedFetch(
    "dashboard:statistics",
    async () => {
      try {
        const res = await fetch(
          "/api/proxy/technicalservices/dashboard-stats",
          { headers: getAuthHeaders() }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as DashboardStats;
      } catch (err: unknown) {
        console.error("Failed to fetch dashboard stats:", err);
        return EMPTY_DASHBOARD_STATS;
      }
    },
    60_000 // 1-minute TTL for dashboard stats
  );
}

/**
 * Saves a new inspection record (Accept action on Inspecting page).
 * Calls `POST /api/proxy/inspectitem`.
 */
export async function createInspectItem(payload: {
  serviceId: string;
  inspection: string;
  solution: string;
  serviceTypeId?: number;
  spareParts?: Array<{ sparePartId: string; quantity: number; condition: string }>;
}): Promise<boolean> {
  invalidateCachePrefix('repairservices');
  try {
    const res = await fetch('/api/proxy/inspectitem', {
      method:  'POST',
      headers: getAuthHeaders(),
      body:    JSON.stringify(payload)
    });
    return res.ok;
  } catch (err: unknown) {
    console.error('Failed to create inspect item:', err);
    return false;
  }
}

/**
 * Removes a single spare-part line from a service ticket's inspection
 * immediately (independent of the rest of the inspection form). Mirrors
 * InspectItemList.razor's `RemoveSparePart`, which deletes an
 * already-persisted line the moment the trash icon is clicked rather than
 * deferring it to the form's Save — so the removal survives even if the
 * dialog is closed without saving.
 * Calls `DELETE /api/proxy/inspectitem/{serviceId}/spareparts/{sparepartItemId}`.
 */
export async function deleteInspectItemSparePart(
  serviceId: string,
  sparepartItemId: string
): Promise<boolean> {
  invalidateCachePrefix('repairservices');
  try {
    const res = await fetch(
      `/api/proxy/inspectitem/${serviceId}/spareparts/${sparepartItemId}`,
      { method: 'DELETE', headers: getAuthHeaders() }
    );
    return res.ok;
  } catch (err: unknown) {
    console.error('Failed to delete inspect item spare part:', err);
    return false;
  }
}

/**
 * Marks a service ticket as Finished/Verified.
 * Calls `POST /api/proxy/finishedrepair`.
 */
export async function setFinishedRepair(payload: {
  serviceId: string;
  finishedDate?: string;
}): Promise<boolean> {
  invalidateCachePrefix('repairservices');
  invalidateCachePrefix('dashboard');
  try {
    const res = await fetch('/api/proxy/finishedrepair', {
      method:  'POST',
      headers: getAuthHeaders(),
      body:    JSON.stringify(payload)
    });
    return res.ok;
  } catch (err: unknown) {
    console.error('Failed to set finished repair:', err);
    return false;
  }
}

/**
 * Searches customers by name/company for the autocomplete field.
 * Calls `GET /api/proxy/customercenter/customers?service=customer&searchTerm=`.
 */
export async function searchCustomers(searchTerm: string): Promise<CustomerItem[]> {
  if (!searchTerm.trim()) return [];
  try {
    const params = new URLSearchParams({
      service:    'customer',
      searchTerm,
      pageNumber: '1',
      pageSize:   '10'
    });
    const res = await fetch(`/api/proxy/customercenter/customers?${params}`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as Record<string, unknown>;
    return (data.items ?? data.Data ?? (Array.isArray(data) ? data : [])) as CustomerItem[];
  } catch (err: unknown) {
    console.error('Failed to search customers:', err);
    return [];
  }
}

/**
 * Registers a brand-new item/model type (e.g. a machine never seen before)
 * and returns the server-assigned record.
 *
 * The backend's `POST /items` endpoint (CreateItemCommand) does not return
 * the created row — it only generates the Id server-side and reports success.
 * So after creating, we re-fetch by the (guaranteed-unique) serial number to
 * recover the authoritative server-assigned `id`. Never fabricate a client-side
 * GUID here — a mismatched id causes a foreign-key failure (or a silent
 * mislink) when the item is attached to a service ticket.
 * Matches `ReceiveItemList.razor` → `SaveNewItemType()` / `ItemService.CreateItemAsync`.
 */
export async function createItem(
  itemName: string,
  serialNumber?: string
): Promise<ItemModel | null> {
  const trimmedName = itemName.trim();
  if (!trimmedName) return null;

  const finalSerial = (serialNumber ?? "").trim() || `GEN-${Date.now().toString(36).toUpperCase()}`;

  try {
    const res = await fetch("/api/proxy/items", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        itemName: trimmedName,
        serialNumber: finalSerial,
        itemType: "Generate"
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    // Recover the server-assigned id by looking the item back up.
    const found = await fetchItemsInventory(1, 5, finalSerial);
    const match =
      found.items.find((i) => i.serialNumber?.toLowerCase() === finalSerial.toLowerCase()) ??
      found.items[0] ??
      null;

    return match ?? { id: "", itemName: trimmedName, serialNumber: finalSerial, itemType: "Generate" };
  } catch (err: unknown) {
    console.error("Failed to create item:", err);
    return null;
  }
}

/**
 * Searches device/item models for the autocomplete field.
 * Calls `GET /api/proxy/items/search?searchTerm=`.
 */

export async function searchItems(searchTerm: string): Promise<ItemModel[]> {
  if (!searchTerm.trim()) return [];
  try {
    const params = new URLSearchParams({ searchTerm, pageNumber: '1', pageSize: '15' });
    const res = await fetch(`/api/proxy/items?${params}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as Record<string, unknown>;
    const list = (data.items ?? data.Data ?? (Array.isArray(data) ? data : [])) as ItemModel[];
    return list.filter((i) => i.itemName?.toLowerCase().includes(searchTerm.toLowerCase()));
  } catch (err: unknown) {
    console.error('Failed to search items:', err);
    return [];
  }
}
