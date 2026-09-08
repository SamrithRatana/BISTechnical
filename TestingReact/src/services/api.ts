import {
  sendTelegramNotification,
  sendTelegramPhotoNotification,
  editTelegramNotification,
  deleteTelegramNotification,
  getLiveTelegramMessages,
  saveServiceTelegramMessage,
  markTelegramMessageDeleted,
  cleanupOldTopicTelegramMessages,
  cleanupAllTelegramMessagesForService
} from "./telegramService";
import { buildTelegramMessage, type TicketNotificationData } from "./telegramMessageBuilder";
import { generateReportImageBlob } from "./reportImageGenerator";
import { clearListCache } from "@/hooks/useInfiniteList";
import { notifyLocalRealtime } from "@/hooks/useRealtimeTickets";
import { getCurrentUserFullName, resolveUserNameSync } from "./userService";
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
  SparePartClassification,
  ApiWriteResult,
  RepairServiceItem,
  ServiceStatusDbItem,
  PaginatedResult,
  CustomerItem,
  CustomerTypeItem,
  ItemModel,
  DashboardStats,
  LoginResponse
} from "./types";

export { SERVICE_STATUSES_DB, SERVICE_LOCATIONS } from "./types";

import type {
  ApiWriteResult,
  RepairServiceItem,
  SparePartClassification,
  SparePartItem,
  CustomerItem,
  CustomerTypeItem,
  ItemModel,
  PaginatedResult,
  DashboardStats,
  LoginResponse
} from "./types";

import { SERVICE_STATUSES_DB } from "./types";
import { networkFailure, readWriteResult } from "./apiWriteResult";

import {
  MOCK_SERVICE_TICKETS,
  MOCK_SPARE_PARTS,
  MOCK_CUSTOMERS,
  MOCK_ITEM_MODELS
} from "./mockData";

import { fetchUserMap, enrichTicketUsers } from "./userService";
import { registerSessionCacheClearer } from "./authSession";
import { timeoutAfter, fetchWithRetry } from "@/lib/withTimeout";
import { captureSystemError, recordProcessActivity } from "./systemObservability";
import {
  checkStockShortages,
  isStockDeductingStatus,
  shortageErrorMessage,
  type SparePartLineLike,
  // Deep-imported, not through the `@/validation` barrel: this module is on
  // every route's critical path and the barrel also re-exports the form rules
  // and their message strings, which nothing here uses.
} from "@/validation/stockPreflight";
import type { ShortageItem } from "@/validation/stockShortage";

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/**
 * Returns HTTP headers including an Authorization Bearer token when one exists
 * in localStorage. Safe to call in SSR (returns base headers only on server).
 */
export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("jwt_token");
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Safely parses a Response body as JSON. If the response is not valid JSON
 * (e.g. plain text "Offline", HTML error page, or empty body), returns fallback
 * instead of throwing a SyntaxError that breaks UI overlays.
 */
export async function safeJsonParse<T>(res: Response, fallback: T): Promise<T> {
  try {
    const text = await res.text();
    if (!text || !text.trim() || text.trim() === "Offline") return fallback;
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}


// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// In-memory + sessionStorage SWR cache for 0ms instant page loads
// ---------------------------------------------------------------------------

const DEFAULT_TTL_MS = 3 * 60 * 1_000; // 3 minutes TTL

/**
 * Outer backstop on a cached read. See `fetchWithRetry`'s own 20s per-attempt
 * default, which is the one that normally fires.
 *
 * This 30s bound is also what sizes `fetchWithRetry`'s 25s retry budget: the
 * retries have to finish inside it, because this backstop RETHROWS instead of
 * falling back to `mockData`, so a retry that overran it would turn a
 * recoverable read into a hard error.
 *
 * Longer than the per-attempt timeout on purpose. The timeout that matters is the one on the
 * `fetch` itself, because every fetcher in this file wraps its request in a
 * `try/catch` whose `catch` returns `mockData` — the designed offline
 * behaviour. A hanging `fetch` never rejects, so that `catch` never ran and
 * the fallback was unreachable for the exact failure it exists to cover;
 * aborting the request from inside makes it run normally.
 *
 * This outer bound only catches a fetcher that hangs for some OTHER reason —
 * a JSON body that never finishes streaming, an enrichment step that stalls.
 * It rethrows rather than falling back, because at that point there is no
 * fallback to reach.
 */
const READ_TIMEOUT_MS = 30_000;

/** Maximum number of entries before LRU eviction kicks in */
const MAX_CACHE_ENTRIES = 80;
/** Number of oldest entries to evict when the limit is hit */
const EVICT_COUNT = 25;

interface CacheEntry<T> {
  data: T;
  expiry: number;
  timestamp: number;
}

const cacheStore = new Map<string, CacheEntry<unknown>>();
const inflightRequests = new Map<string, Promise<unknown>>();

/**
 * Empty both on sign-out.
 *
 * `cacheStore` is read BEFORE sessionStorage, so clearing only the persisted
 * copy left the one that actually answers untouched — and logout is a
 * client-side navigation, so this module is never re-evaluated. The next user
 * on the same tab was being served the previous user's rows out of this Map.
 *
 * `inflightRequests` goes too: a request started under the old token must not
 * be adopted by the new session as though it were its own.
 */
registerSessionCacheClearer(() => {
  cacheStore.clear();
  inflightRequests.clear();
});

/**
 * Periodic cache sweeper: purges all expired entries to actively reclaim memory
 * without waiting for MAX_CACHE_ENTRIES limit.
 */
function sweepExpiredCache(): void {
  const now = Date.now();
  for (const [key, entry] of Array.from(cacheStore.entries())) {
    if (now > entry.expiry) {
      cacheStore.delete(key);
      if (typeof window !== "undefined") {
        try { sessionStorage.removeItem(`cache:${key}`); } catch {}
      }
    }
  }
}

if (typeof window !== "undefined") {
  // Sweep memory every 60 seconds
  setInterval(sweepExpiredCache, 60_000);
  // Also sweep immediately whenever the tab is backgrounded
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") sweepExpiredCache();
  });
}

/**
 * LRU eviction: removes the oldest EVICT_COUNT entries when the cache
 * exceeds MAX_CACHE_ENTRIES. Prevents unbounded memory growth in long
 * browser sessions.
 */
function evictIfOverLimit(): void {
  sweepExpiredCache();
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
  if (typeof window !== "undefined") {
    try {
      const p = prefix ? `cache:${prefix}` : "cache:";
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith(p)) {
          sessionStorage.removeItem(k);
        }
      }
    } catch { /* ignore */ }
  }
}


/**
 * Fetches data with SWR (Stale-While-Revalidate) & inflight deduplication.
 * Returns cached data immediately if available, while revalidating in background.
 */
export async function cachedFetch<T>(
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

  /*
    Bounded wait.

    Every cached read in this file funnels through here, so one wrapper puts a
    ceiling on all of them. `fetch` has no default timeout: a connection that
    is accepted and then goes quiet never rejects, so the promise never
    settles, `inflightRequests` never clears the key, and every later caller
    for that key joins a promise that will never resolve. The page holds its
    spinner until someone reloads the browser.

    On timeout the `.catch` below already does the right thing — serve the
    stale entry if there is one, otherwise let the caller's own `catch` fall
    back to `mockData`. Both are better than waiting forever.

    This bounds the WAIT, not the request; see `lib/withTimeout`. The fetcher
    is an opaque closure here, so there is no signal to abort.
  */
  const fetchPromise = timeoutAfter(fetcher(), READ_TIMEOUT_MS, key)
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
    const res = await fetchWithRetry("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userName, password })
    });

    const data = await safeJsonParse<LoginResponse>(res, {
      isSuccess: false,
      message: "Unexpected response format from server"
    });
    if (!res.ok || !data.isSuccess) {
      captureSystemError({
        serviceId: "our-user-api",
        endpoint: "/api/auth/login",
        method: "POST",
        statusCode: res.status || 401,
        message: data.message ?? "Authentication failed: Invalid credentials",
        userContext: { username: userName },
      });
      return { isSuccess: false, message: data.message ?? "Invalid username or password" };
    }

    recordProcessActivity({
      serviceId: "our-user-api",
      type: "AUTH",
      descriptionKm: `អ្នកប្រើប្រាស់ "${userName}" បានចូលប្រព័ន្ធជោគជ័យ`,
      descriptionEn: `User "${userName}" successfully authenticated`,
      statusCode: 200,
      user: userName,
    });

    return data;
  } catch (err) {
    captureSystemError({
      serviceId: "our-user-api",
      endpoint: "/api/auth/login",
      method: "POST",
      statusCode: 0,
      message: "Connection failed. Please check your internet or API service status.",
      severity: "CRITICAL",
      userContext: { username: userName },
    });
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

/**
 * Dispatches authentic Telegram notification safely in the background
 */
export async function dispatchTelegramNotificationSafe(
  item: RepairServiceItem,
  newStatus?: string,
  performedByName?: string,
  forceEdit = false
): Promise<void> {
  try {
    const rawStatus = (newStatus || item.status || "").trim().toLowerCase();
    const statusId = item.statusId;

    // 🚫 For Status Repairing, do NOT alert new message to Telegram (no Topic exists for Repairing).
    // 🧹 But DO delete / retract any existing messages from previous topics (e.g. Sent Spareparts, Inspection, etc.)!
    if (
      rawStatus.includes("repairing") ||
      rawStatus.includes("កំពុងជួសជុល") ||
      rawStatus === "5" ||
      statusId === 5
    ) {
      if (item.id) {
        await cleanupOldTopicTelegramMessages(item.id);
      }
      return;
    }

    let topicKey = "";

    if (
      rawStatus.includes("receive") ||
      rawStatus.includes("recieved") ||
      rawStatus.includes("ទទួល") ||
      rawStatus === "1" ||
      statusId === 1
    ) {
      topicKey = "ItemReceived";
    } else if (
      rawStatus.includes("inspecting") ||
      rawStatus.includes("កំពុងវិនិច្ឆ័យ") ||
      rawStatus === "10" ||
      statusId === 10
    ) {
      topicKey = "Inspecting";
    } else if (
      rawStatus.includes("inspection") ||
      rawStatus.includes("វិនិច្ឆ័យរួចរាល់") ||
      rawStatus === "2" ||
      statusId === 2
    ) {
      topicKey = "Inspection";
    } else if (
      rawStatus.includes("awaiting customer") ||
      rawStatus.includes("confirm ពីភ្ញៀវ") ||
      rawStatus === "3" ||
      statusId === 3
    ) {
      topicKey = "AwaitingCustomerConfirm";
    } else if (
      rawStatus.includes("awaiting spare") ||
      rawStatus.includes("ស្នើរគ្រឿងបន្លាស់") ||
      rawStatus.includes("រង់ចាំគ្រឿងបន្លាស់") ||
      rawStatus === "4" ||
      statusId === 4
    ) {
      topicKey = "AwaitingSparepart";
    } else if (
      rawStatus.includes("sale confirm") ||
      rawStatus.includes("ទីផ្សារ confirmed") ||
      rawStatus === "11" ||
      statusId === 11
    ) {
      topicKey = "SaleConfirmed";
    } else if (
      rawStatus.includes("sent spare") ||
      rawStatus.includes("បញ្ជូនគ្រឿងបន្លាស់") ||
      rawStatus === "12" ||
      statusId === 12
    ) {
      topicKey = "SentSpareparts";
    } else if (
      rawStatus.includes("finish") ||
      rawStatus.includes("ជួសជុលរួចរាល់") ||
      rawStatus.includes("រួចរាល់") ||
      rawStatus === "6" ||
      statusId === 6
    ) {
      topicKey = "Finished";
    } else if (
      rawStatus.includes("customer reject") ||
      rawStatus.includes("reject") ||
      rawStatus.includes("មិនជួសជុល") ||
      rawStatus === "7" ||
      statusId === 7
    ) {
      topicKey = "CustomerRejected";
    } else if (
      rawStatus.includes("unrepairable") ||
      rawStatus.includes("ជួសជុលមិនបាន") ||
      rawStatus === "8" ||
      statusId === 8
    ) {
      topicKey = "Unrepairable";
    }

    if (!topicKey) {
      console.warn("Could not determine topicKey for status:", { rawStatus, statusId });
      return;
    }

    // Fetch full item details to ensure all fields/spareparts are present
    let fullItem = { ...item };
    try {
      if (item.id && !item.id.startsWith("new-")) {
        const fetched = await fetchServiceById(item.id);
        if (fetched) {
          fullItem = {
            ...fetched,
            ...item,
            reportNo: item.reportNo || fetched.reportNo || "",
            sparePartItems: item.sparePartItems ?? fetched.sparePartItems ?? fetched.sparepartItems,
            sparepartItems: item.sparepartItems ?? fetched.sparepartItems ?? fetched.sparePartItems,
          };
        }
      }
    } catch {}

    const rawParts = (
      (item.sparePartItems && (item.sparePartItems as any[]).length > 0 ? item.sparePartItems : null) ??
      (item.sparepartItems && (item.sparepartItems as any[]).length > 0 ? item.sparepartItems : null) ??
      fullItem.sparePartItems ??
      fullItem.sparepartItems ??
      []
    ) as unknown as Array<Record<string, unknown>>;
    const parts = await Promise.all(
      rawParts.map(async (sp) => {
        let resolvedName = (sp.itemName || sp.description) as string | undefined;
        const sparePartId = (sp.sparePartId || sp.SparepartId || sp.sparepartId) as string | undefined;
        if ((!resolvedName || resolvedName === "Unknown Sparepart" || resolvedName === "Unknown Item") && sparePartId) {
          try {
            const catalog = await fetchSparePartById(String(sparePartId));
            if (catalog?.itemName) {
              resolvedName = catalog.itemName;
            }
          } catch {}
        }
        return {
          itemName: resolvedName || "Spare Part",
          quantity: ((sp.quantity ?? sp.Quantity ?? 1) as number),
          condition: ((sp.condition ?? sp.Condition ?? "Replace") as string),
          remarks: ((sp.remarks ?? sp.Remarks ?? "-") as string)
        };
      })
    );

    const resolvedServiceType = fullItem.serviceTypeId === 1
      ? "Free"
      : fullItem.serviceTypeId === 2
      ? "Charge"
      : (fullItem.serviceType || "Free");

    const notifData: TicketNotificationData = {
      reportNo: fullItem.reportNo || "N/A",
      companyName: fullItem.companyName || "N/A",
      address: fullItem.address,
      contactPerson: fullItem.contactName,
      phoneNumber: fullItem.phoneNumber,
      serviceDate: fullItem.serviceDate ? new Date(fullItem.serviceDate).toLocaleDateString("en-GB") : undefined,
      serviceLocation: fullItem.serviceLocation || "CompanyService",
      itemName: fullItem.itemName || "N/A",
      serialNumber: fullItem.serialNumber || "N/A",
      hasContract: Boolean(fullItem.hasContract),
      serviceType: resolvedServiceType,
      customerRequest: fullItem.customerRequest,
      inspection: fullItem.inspection,
      solution: fullItem.solution,
      inspectByName: (fullItem.inspectBy ? resolveUserNameSync(fullItem.inspectBy) : "") || fullItem.inspectByName || (fullItem.inspectingBy ? resolveUserNameSync(fullItem.inspectingBy) : "") || getCurrentUserFullName(),
      approvedByName: (fullItem.setSaleConfirmedBy ? resolveUserNameSync(fullItem.setSaleConfirmedBy) : "") || fullItem.setSaleConfirmedByName || (fullItem.repairBy ? resolveUserNameSync(fullItem.repairBy) : "") || fullItem.repairByName || (fullItem.verifiedBy ? resolveUserNameSync(fullItem.verifiedBy) : "") || fullItem.verifiedByName || getCurrentUserFullName(),
      performedByName: performedByName || (fullItem.setSentSparepartsBy ? resolveUserNameSync(fullItem.setSentSparepartsBy) : "") || (fullItem.setAwaitingSparepartBy ? resolveUserNameSync(fullItem.setAwaitingSparepartBy) : "") || (fullItem.setAwaitingCustomerConfirmBy ? resolveUserNameSync(fullItem.setAwaitingCustomerConfirmBy) : "") || (fullItem.createBy ? resolveUserNameSync(fullItem.createBy) : "") || getCurrentUserFullName(),
      receivedByName: (fullItem.createBy ? resolveUserNameSync(fullItem.createBy) : "") || fullItem.createdByName || getCurrentUserFullName(),
      spareParts: parts
    };

    // 1. Check if an active message already exists for this exact topic (e.g. edit in place)
    let liveMessages: Array<{ topicKey: string; messageId: number }> = [];
    if (fullItem.id) {
      liveMessages = await getLiveTelegramMessages(fullItem.id);
    }
    const matchingInTopic = liveMessages.filter(
      (m) => m.topicKey.trim().toLowerCase() === topicKey.trim().toLowerCase()
    );
    matchingInTopic.sort((a, b) => b.messageId - a.messageId);
    const existingInTopic = matchingInTopic[0];

    // Clean up older duplicates in the same topic if any exist
    if (matchingInTopic.length > 1) {
      for (const dup of matchingInTopic.slice(1)) {
        await deleteTelegramNotification(dup.messageId);
        await markTelegramMessageDeleted(dup.messageId);
      }
    }

    const isEdit = forceEdit || Boolean(existingInTopic);
    const messageHtml = buildTelegramMessage(topicKey, notifData, isEdit);

    const isPhotoTopic =
      topicKey === "Finished" ||
      topicKey === "CustomerRejected" ||
      topicKey === "Unrepairable";

    if (isPhotoTopic && typeof window !== "undefined") {
      try {
        const photoBlob = await generateReportImageBlob(fullItem);
        if (photoBlob) {
          // If message already existed in this topic, delete old message first to prevent duplicate
          if (existingInTopic) {
            await deleteTelegramNotification(existingInTopic.messageId);
            await markTelegramMessageDeleted(existingInTopic.messageId);
          }

          const sendRes = await sendTelegramPhotoNotification(topicKey, photoBlob, messageHtml);
          if (sendRes.success && sendRes.messageId && fullItem.id) {
            await saveServiceTelegramMessage(fullItem.id, topicKey, sendRes.messageId);
          }

          // Retract old topic messages
          if (fullItem.id) {
            await cleanupOldTopicTelegramMessages(fullItem.id, topicKey);
          }
          return;
        }
      } catch (photoErr) {
        console.warn("Report photo generation failed, falling back to text:", photoErr);
      }
    }

    if (existingInTopic) {
      const editRes = await editTelegramNotification(existingInTopic.messageId, messageHtml);
      if (!editRes.success && !editRes.notModified) {
        // Fallback: if edit fails (e.g. message too old or not found),
        // delete old message first so we NEVER leave duplicate messages in the topic!
        await deleteTelegramNotification(existingInTopic.messageId);
        await markTelegramMessageDeleted(existingInTopic.messageId);

        const sendRes = await sendTelegramNotification(topicKey, messageHtml);
        if (sendRes.success && sendRes.messageId) {
          if (fullItem.id) {
            await saveServiceTelegramMessage(fullItem.id, topicKey, sendRes.messageId);
          }
        }
      }
    } else {
      // 2. Send to the new topic
      const sendRes = await sendTelegramNotification(topicKey, messageHtml);
      if (sendRes.success && sendRes.messageId && fullItem.id) {
        await saveServiceTelegramMessage(fullItem.id, topicKey, sendRes.messageId);
      }
    }

    // 3. 🧹 Retract / delete messages from OLD topics so only the active topic has this ticket!
    if (fullItem.id) {
      await cleanupOldTopicTelegramMessages(fullItem.id, topicKey);
    }
  } catch (err) {
    console.warn("Telegram dispatch error (non-fatal):", err);
  }
}

/**
 * `ShortageItem` and the shortage rules moved to `@/validation`, which is
 * mirrored into the CamID app so the phone applies the same `Fix`/qty/null-GUID
 * skips and produces the same message. Re-exported so existing importers are
 * unaffected.
 */
export type { ShortageItem } from "@/validation/stockShortage";

export interface StatusUpdateResult {
  success: boolean;
  error?: string;
  shortages?: ShortageItem[];
}

export async function updateServiceStatus(
  item: RepairServiceItem,
  newStatus: string
): Promise<StatusUpdateResult> {
  // The rule lives in `@/validation`, which is mirrored into the CamID app —
  // the phone used to post straight through and surface the SQL trigger's raw
  // rejection, while this ran a per-line pre-flight and showed a proper
  // shortage panel. One implementation now decides for both; each side only
  // supplies its own catalogue reader.
  if (isStockDeductingStatus(newStatus)) {
    let parts: SparePartLineLike[] = [];
    try {
      const fullTicket = await fetchServiceById(item.id);
      parts = (fullTicket?.sparePartItems ||
        (fullTicket as unknown as Record<string, unknown>)?.sparepartItems ||
        item.sparePartItems ||
        (item as unknown as Record<string, unknown>)?.sparepartItems ||
        []) as SparePartLineLike[];
    } catch {
      parts = (item.sparePartItems ||
        (item as unknown as Record<string, unknown>)?.sparepartItems ||
        []) as SparePartLineLike[];
    }

    if (parts.length > 0) {
      const shortages: ShortageItem[] = await checkStockShortages(parts, (id) => fetchSparePartById(id, true));
      if (shortages.length > 0) {
        return { success: false, error: shortageErrorMessage(shortages), shortages };
      }
    }
  }

  invalidateCachePrefix("repairservices");
  invalidateCachePrefix("dashboard");
  invalidateCachePrefix("spareparts");

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
      const res = await fetchWithRetry(statusRequest.endpoint, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(statusRequest.payload)
      });
      if (res.ok) {
        if (process.env.NODE_ENV !== "production") {
          console.log(`✅ Status updated to "${newStatus}" via ${statusRequest.endpoint}`);
        }
        recordProcessActivity({
          serviceId: "our-technical-api",
          type: "MUTATION",
          descriptionKm: `ប្តូរស្ថានភាពប័ណ្ណជួសជុល ${item.reportNo || item.id} ទៅជា "${newStatus}"`,
          descriptionEn: `Updated ticket ${item.reportNo || item.id} status to "${newStatus}"`,
          statusCode: 200,
          user: performedBy,
        });
        notifyLocalRealtime({ type: "status_changed", resource: "ticket", status: newStatus });
        void dispatchTelegramNotificationSafe(item, newStatus);
        return { success: true };
      }
      const errText = await res.text().catch(() => "");
      let parsedError = errText;
      try {
        const json = JSON.parse(errText);
        parsedError = json.detail || json.title || json.message || errText;
      } catch {
        parsedError = errText.replace(/^"|"$/g, "");
      }
      captureSystemError({
        serviceId: "our-technical-api",
        endpoint: statusRequest.endpoint,
        method: "POST",
        statusCode: res.status,
        message: parsedError || `Failed to update status to ${newStatus}`,
        payloadSnippet: JSON.stringify(statusRequest.payload),
        userContext: { username: performedBy },
      });
      console.warn(`❌ Status update failed [${res.status}]: ${parsedError}`);
      return { success: false, error: parsedError || "Failed to update status" };
    } catch (err: unknown) {
      console.error("Failed to update status via BIS endpoint:", err);
      const errMsg = err instanceof Error ? err.message : "Failed to update status";
      captureSystemError({
        serviceId: "our-technical-api",
        endpoint: statusRequest.endpoint,
        method: "POST",
        statusCode: 0,
        message: errMsg,
        stackTrace: err instanceof Error ? err.stack : undefined,
        userContext: { username: performedBy },
      });
      return { success: false, error: errMsg };
    }
  }

  // Fallback: for unmapped statuses use the generic PUT endpoint.
  console.warn(`⚠️ No specific BIS endpoint for status "${newStatus}", using fallback PUT`);
  const matched = SERVICE_STATUSES_DB.find((s) => s.name === newStatus);
  const updated: RepairServiceItem = {
    ...item,
    status: newStatus,
    statusId: matched?.id ?? item.statusId
  };
  try {
    const res = await fetchWithRetry(`/api/proxy/technicalservices`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(updated)
    });
    if (res.ok) {
      recordProcessActivity({
        serviceId: "our-technical-api",
        type: "MUTATION",
        descriptionKm: `ប្តូរស្ថានភាពប័ណ្ណ ${item.reportNo || item.id} ទៅជា "${newStatus}" (PUT)`,
        descriptionEn: `Updated ticket ${item.reportNo || item.id} status to "${newStatus}" via PUT`,
        statusCode: 200,
        user: performedBy,
      });
      notifyLocalRealtime({ type: "status_changed", resource: "ticket", status: newStatus });
      void dispatchTelegramNotificationSafe(item, newStatus);
      return { success: true };
    }
    const errText = await res.text().catch(() => "");
    captureSystemError({
      serviceId: "our-technical-api",
      endpoint: "/api/proxy/technicalservices",
      method: "PUT",
      statusCode: res.status,
      message: errText || `Failed to update status to ${newStatus}`,
      userContext: { username: performedBy },
    });
    return { success: false, error: errText || "Failed to update status" };
  } catch (err: unknown) {
    console.error("Fallback PUT status update failed:", err);
    captureSystemError({
      serviceId: "our-technical-api",
      endpoint: "/api/proxy/technicalservices",
      method: "PUT",
      statusCode: 0,
      message: err instanceof Error ? err.message : "Failed to update status",
      stackTrace: err instanceof Error ? err.stack : undefined,
      userContext: { username: performedBy },
    });
    return { success: false, error: "Failed to update status" };
  }
}


/**
 * Deletes a service ticket by ID.
 * Calls `DELETE /api/proxy/technicalservices/{id}`.
 */
export async function deleteTechnicalService(id: string): Promise<boolean> {
  invalidateCachePrefix("repairservices");
  invalidateCachePrefix("dashboard");
  invalidateCachePrefix("spareparts");

  // 🧹 Clean up / delete all Telegram messages across all topics for this ticket
  void cleanupAllTelegramMessagesForService(id);

  try {
    let res = await fetchWithRetry(`/api/proxy/receiveitem/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      res = await fetchWithRetry(`/api/proxy/technicalservices/${id}`, {
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

/**
 * Updates the remarks for a specific spare part item attached to a service ticket.
 * Calls `POST /api/proxy/spareparts/items/{sparepartItemId}/remarks`.
 */
export async function updateSparepartItemRemarks(
  sparePartItemId: string,
  remarks: string
): Promise<boolean> {
  invalidateCachePrefix("repairservices");
  try {
    const res = await fetchWithRetry(`/api/proxy/spareparts/items/${sparePartItemId}/remarks`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ remarks })
    });
    return res.ok;
  } catch (err: unknown) {
    console.error("Failed to update sparepart item remarks:", err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Internal fetch helpers
// ---------------------------------------------------------------------------

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
  /**
   * Ask the backend for a narrower row. `"summary"` returns only id, status
   * and the two dates — for callers that render a chart rather than a table.
   * Omit it for the full ticket.
   */
  projection?: "summary";
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
  if (extras?.projection) params.set("projection", extras.projection);

  const res = await fetchWithRetry(
    `/api/proxy/technicalservices/search?${params.toString()}`,
    { headers: getAuthHeaders() }
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await safeJsonParse<Record<string, unknown>>(res, {});
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

      const res = await fetchWithRetry(
        `${endpoint}?${params.toString()}`,
        { headers: getAuthHeaders() }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await safeJsonParse<Record<string, unknown>>(res, {});
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
 *
 * Cached, because the call site is a loop. `ServiceDetailModal` and
 * `InspectItemDialog` both resolve one catalogue row per spare-part line on
 * the ticket, so opening a ticket costs N of these (measured over the 400
 * most recent tickets: 1.8 on average for a ticket that has parts, 7 at
 * worst). Uncached, that N was paid again on every reopen, and again for
 * every other ticket using the same part — and a workshop reuses the same
 * toner and fuser rows constantly, so the hit rate here is high. The
 * catalogue row is slow-changing (name, picture, stock level), and the
 * mutation paths already call `invalidateCachePrefix("spareparts")`, so the
 * existing invalidation covers this key too.
 */
export async function fetchSparePartById(id: string, bypassCache = false): Promise<SparePartItem | null> {
  if (!id) return null;

  if (bypassCache) {
    invalidateCache(`spareparts:id:${id}`);
  }

  return cachedFetch(`spareparts:id:${id}`, async () => {
    try {
      const res = await fetchWithRetry(`/api/proxy/spareparts/${id}`, { headers: getAuthHeaders() });
      if (!res.ok) return null;
      const p = await safeJsonParse<Record<string, unknown> | null>(res, null);
      if (!p || typeof p !== "object") return null;
      return mapSparePartRow(p, id);
    } catch (err: unknown) {
      console.warn("Failed to fetch spare part by id:", err);
      return null;
    }
  }, 10_000);
}

/** Classification filters for the spare-part list; empty / undefined = no filter. */
export interface SparePartFilters {
  categoryId?: string | null;
  typeId?: string | null;
  brandId?: string | null;
}

/** Maps a spare-part row from either API casing onto `SparePartItem`. */
function mapSparePartRow(p: Record<string, unknown>, fallbackId = ""): SparePartItem {
  const nullableStr = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
  return {
    id:           String(p.id ?? fallbackId),
    partNumber:   String(p.serialNumber ?? p.SerialNumber ?? p.partNumber ?? ""),
    serialNumber: String(p.serialNumber ?? p.SerialNumber ?? ""),
    itemName:     String(p.itemName ?? p.ItemName ?? p.name ?? ""),
    useFor:       String(p.useFor ?? p.UseFor ?? p.modelCompatible ?? ""),
    pictureUrl:   String(p.pictureUrl ?? p.PictureUrl ?? ""),
    quantity:     Number(p.quantity ?? p.Quantity ?? 0),
    defaultPrice: Number(p.defaultPrice ?? p.DefaultPrice ?? p.unitPrice ?? 0),
    description:  String(p.description ?? p.Description ?? ""),
    status:       String(p.status ?? ""),
    linkItemId:   String(p.linkItemId ?? p.LinkItemId ?? ""),
    categoryId:   nullableStr(p.categoryId ?? p.CategoryId),
    categoryName: nullableStr(p.categoryName ?? p.CategoryName),
    typeId:       nullableStr(p.typeId ?? p.TypeId),
    typeName:     nullableStr(p.typeName ?? p.TypeName),
    brandId:      nullableStr(p.brandId ?? p.BrandId),
    brandName:    nullableStr(p.brandName ?? p.BrandName),
    brandLogoUrl: nullableStr(p.brandLogoUrl ?? p.BrandLogoUrl),
    isDraft:      Boolean(p.isDraft ?? p.IsDraft ?? false),
  };
}

export async function fetchSparePartsInventory(
  pageNumber = 1,
  pageSize   = 10,
  searchTerm = "",
  stockBand  = "all",
  filters: SparePartFilters = {},
  sortBy?: string | null,
  sortDescending = false
): Promise<PaginatedResult<SparePartItem>> {
  const categoryId = filters.categoryId || "";
  const typeId = filters.typeId || "";
  const brandId = filters.brandId || "";
  const sortKey = sortBy ? `:sort${sortBy}:${sortDescending}` : "";
  const cacheKey =
    `spareparts:page${pageNumber}:size${pageSize}:search${searchTerm}:band${stockBand}` +
    `:cat${categoryId}:type${typeId}:brand${brandId}${sortKey}`;
  return cachedFetch(cacheKey, async () => {
    try {
      const params = new URLSearchParams({
        pageNumber: pageNumber.toString(),
        pageSize:   pageSize.toString()
      });
      if (searchTerm) params.set("searchTerm", searchTerm);
      if (stockBand && stockBand !== "all") params.set("stockBand", stockBand);
      if (categoryId) params.set("categoryId", categoryId);
      if (typeId) params.set("typeId", typeId);
      if (brandId) params.set("brandId", brandId);
      if (sortBy) {
        params.set("sortBy", sortBy);
        params.set("sortDescending", sortDescending ? "true" : "false");
      }
      const endpoint = searchTerm ? "/api/proxy/spareparts/search" : "/api/proxy/spareparts";

      const res = await fetchWithRetry(
        `${endpoint}?${params.toString()}`,
        { headers: getAuthHeaders() }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await safeJsonParse<Record<string, unknown>>(res, {});

      // Normalise mixed PascalCase / camelCase keys returned by the API
      const rawList = (data.items ?? data.Data ?? (Array.isArray(data) ? data : [])) as Record<string, unknown>[];
      const items: SparePartItem[] = rawList.map((p) => mapSparePartRow(p));

      const total = (data.totalCount ?? data.TotalCount ?? items.length) as number;
      const goodCount = (data.goodCount ?? data.GoodCount) as number | undefined;
      const criticalCount = (data.criticalCount ?? data.CriticalCount) as number | undefined;
      const outOfStockCount = (data.outOfStockCount ?? data.OutOfStockCount) as number | undefined;
      const draftCount = (data.draftCount ?? data.DraftCount) as number | undefined;
      const totalAll = (data.totalAll ?? data.TotalAll) as number | undefined;

      return {
        items,
        totalCount: total,
        pageNumber,
        pageSize,
        totalPages: Math.max(Math.ceil(total / pageSize), 1),
        goodCount,
        criticalCount,
        outOfStockCount,
        draftCount,
        totalAll,
      };
    } catch {
      const term = searchTerm.trim().toLowerCase();
      const hasClassificationFilter = Boolean(categoryId || typeId || brandId);
      const filtered = hasClassificationFilter
        ? []
        : term
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
  }, 15_000);
}

export async function toggleSparePartDraft(id: string, isDraft: boolean): Promise<boolean> {
  invalidateCachePrefix("spareparts");
  try {
    const res = await fetchWithRetry(`/api/proxy/spareparts/${id}/draft?isDraft=${isDraft}`, {
      method: "PUT",
      headers: getAuthHeaders(),
    });
    return res.ok;
  } catch (err) {
    console.error("toggleSparePartDraft failed", err);
    return false;
  }
}

export async function batchSetSparePartsDraft(ids: string[], isDraft: boolean): Promise<boolean> {
  invalidateCachePrefix("spareparts");
  try {
    const res = await fetchWithRetry(`/api/proxy/spareparts/batch-draft`, {
      method: "PUT",
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ids, isDraft }),
    });
    return res.ok;
  } catch (err) {
    console.error("batchSetSparePartsDraft failed", err);
    return false;
  }
}

const NULL_GUID = "00000000-0000-0000-0000-000000000000";

/**
 * The `classification` object for a spare-part write, or `undefined` to leave
 * the part's classification untouched. A screen that has the three selects
 * passes them (empty select → `null`, which clears); a caller that only
 * changes stock passes nothing, so the update cannot wipe the filing.
 */
function classificationPayload(c: SparePartClassification | undefined) {
  if (!c) return undefined;
  return {
    categoryId: c.categoryId || null,
    typeId:     c.typeId || null,
    brandId:    c.brandId || null,
  };
}

function invalidateSparePartWrites(lookupsTouched: boolean): void {
  invalidateCachePrefix("spareparts");
  // The lookups carry partCount, which a create / reclassify / delete moves.
  if (lookupsTouched) invalidateCachePrefix("sparepart-taxonomy");
}

/**
 * Creates a new spare part.
 * Calls `POST /api/proxy/spareparts`.
 */
export async function createSparePart(
  part: SparePartItem,
  classification?: SparePartClassification
): Promise<ApiWriteResult> {
  invalidateSparePartWrites(classification !== undefined);
  try {
    const payload = {
      itemName:       part.itemName,
      serialNumber:   part.serialNumber ?? part.partNumber,
      description:    part.description ?? "",
      useFor:         part.useFor ?? "",
      pictureUrl:     part.pictureUrl ?? "",
      linkItemId:     part.linkItemId || NULL_GUID,
      quantity:       part.quantity ?? 0,
      defaultPrice:   part.defaultPrice ?? 0,
      classification: classificationPayload(classification),
    };
    const res = await fetchWithRetry("/api/proxy/spareparts", {
      method:  "POST",
      headers: getAuthHeaders(),
      body:    JSON.stringify(payload)
    });
    return await readWriteResult(res);
  } catch (err: unknown) {
    console.error("Failed to create spare part:", err);
    return networkFailure();
  }
}

/**
 * Updates an existing spare part.
 * Calls `PUT /api/proxy/spareparts`.
 *
 * `classification` is optional on purpose — see `classificationPayload`.
 * Stock-in and set-stock call this without it and must not clear the filing.
 */
export async function updateSparePart(
  part:        SparePartItem,
  performedBy = NULL_GUID,
  classification?: SparePartClassification
): Promise<ApiWriteResult> {
  invalidateSparePartWrites(classification !== undefined);
  try {
    const payload = {
      id:             part.id,
      itemName:       part.itemName,
      serialNumber:   part.serialNumber ?? part.partNumber ?? "",
      description:    part.description ?? "",
      useFor:         part.useFor ?? "",
      pictureUrl:     part.pictureUrl ?? "",
      linkItemId:     part.linkItemId || NULL_GUID,
      quantity:       part.quantity ?? 0,
      defaultPrice:   part.defaultPrice ?? 0,
      performedBy,
      classification: classificationPayload(classification),
    };
    const res = await fetchWithRetry("/api/proxy/spareparts", {
      method:  "PUT",
      headers: getAuthHeaders(),
      body:    JSON.stringify(payload)
    });
    return await readWriteResult(res);
  } catch (err: unknown) {
    console.error("Failed to update spare part:", err);
    return networkFailure();
  }
}

/**
 * Deletes a spare part by ID.
 * Calls `DELETE /api/proxy/spareparts/{id}`.
 *
 * The API refuses (409, code `inUse`, `count`) while the part is on any ticket
 * line or has any row in the stock audit ledger — a part with history is never
 * deletable, and the result says so rather than pretending it worked.
 */
export async function deleteSparePart(id: string): Promise<ApiWriteResult> {
  invalidateSparePartWrites(true);
  try {
    const res = await fetchWithRetry(`/api/proxy/spareparts/${id}`, {
      method:  "DELETE",
      headers: getAuthHeaders()
    });
    return await readWriteResult(res);
  } catch (err: unknown) {
    console.error("Failed to delete spare part:", err);
    return networkFailure();
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
    const res = await fetchWithRetry("/api/proxy/spareparts/manual-stockout", {
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

export interface SparepartTransaction {
  id: string;
  timestamp: string;
  sparepartId: string;
  itemName: string;
  serialNumber: string;
  pictureUrl?: string | null;
  operationType: string;
  quantityChange: number;
  quantity: number;
  direction: "In" | "Out" | "None" | string;
  source: string;
  balanceAfter: number;
  balanceBefore: number;
  serviceId?: string | null;
  reportNo?: string;
  companyName?: string;
  serviceStatus?: string;
  reason?: string;
  reversedLater?: boolean;
  isReversal?: boolean;
}

/**
 * Fetches real-time spare part transactions (Stock In / Stock Out ledger).
 * Calls `GET /api/proxy/spareparts/transactions`.
 */
export async function fetchSparepartTransactions(
  pageNumber = 1,
  pageSize = 10,
  direction?: string,
  searchTerm = "",
  force = false
): Promise<PaginatedResult<SparepartTransaction>> {
  const cacheKey = `spareparts:transactions:p${pageNumber}:s${pageSize}:d${direction || "All"}:q${searchTerm.trim()}`;
  if (force) {
    invalidateCachePrefix(cacheKey);
  }
  return cachedFetch(
    cacheKey,
    async () => {
      try {
        const params = new URLSearchParams({
          pageNumber: pageNumber.toString(),
          pageSize: pageSize.toString(),
        });
        if (direction && direction !== "All") params.set("direction", direction);
        if (searchTerm.trim()) params.set("searchTerm", searchTerm.trim());

        const res = await fetchWithRetry(`/api/proxy/spareparts/transactions?${params.toString()}`, {
          headers: getAuthHeaders(),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await safeJsonParse<Record<string, unknown>>(res, {});
        const rawItems = (data.items ?? data.Data ?? (Array.isArray(data) ? data : [])) as Record<string, unknown>[];
        const items: SparepartTransaction[] = rawItems.map((r) => ({
          id: String(r.id ?? ""),
          timestamp: String(r.timestamp ?? ""),
          sparepartId: String(r.sparepartId ?? ""),
          itemName: String(r.itemName ?? ""),
          serialNumber: String(r.serialNumber ?? ""),
          pictureUrl: r.pictureUrl ? String(r.pictureUrl) : null,
          operationType: String(r.operationType ?? ""),
          quantityChange: Number(r.quantityChange ?? 0),
          quantity: Number(r.quantity ?? Math.abs(Number(r.quantityChange ?? 0))),
          direction: String(r.direction ?? (Number(r.quantityChange ?? 0) > 0 ? "In" : "Out")),
          source: String(r.source ?? ""),
          balanceAfter: Number(r.balanceAfter ?? 0),
          balanceBefore: Number(r.balanceBefore ?? 0),
          serviceId: r.serviceId ? String(r.serviceId) : null,
          reportNo: String(r.reportNo ?? ""),
          companyName: String(r.companyName ?? ""),
          serviceStatus: String(r.serviceStatus ?? ""),
          reason: String(r.reason ?? ""),
          reversedLater: Boolean(r.reversedLater),
          isReversal: Boolean(r.isReversal),
        }));
        const totalCount = Number(data.totalCount ?? data.TotalCount ?? items.length);
        return {
          items,
          totalCount,
          pageNumber,
          pageSize,
          totalPages: Math.max(Math.ceil(totalCount / pageSize), 1),
        };
      } catch (err) {
        console.warn("Failed to fetch sparepart transactions:", err);
        return {
          items: [],
          totalCount: 0,
          pageNumber,
          pageSize,
          totalPages: 1,
        };
      }
    },
    20_000
  );
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

      const res = await fetchWithRetry(`/api/proxy/Customer?${params.toString()}`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await safeJsonParse<Record<string, unknown>>(res, {});

      const rawList = (data.data ?? data.Data ?? data.items ?? (Array.isArray(data) ? data : [])) as Record<string, unknown>[];
      const items: CustomerItem[] = rawList.map((c) => ({
        id:           String(c.id ?? c.Id ?? c.customerId ?? ""),
        companyName:  String(c.companyName ?? c.CompanyName ?? c.name ?? "N/A"),
        contactName:  String(c.contactName ?? c.ContactName ?? c.contactPerson ?? c.ContactPerson ?? c.attention ?? c.Attention ?? ""),
        phoneNumber:  String(c.phoneNumber ?? c.PhoneNumber ?? c.phone ?? c.Phone ?? ""),
        address:      String(c.address ?? c.Address ?? ""),
        customerType: c.customerType != null ? String(c.customerType).trim() : (c.CustomerType != null ? String(c.CustomerType).trim() : ""),
        customerTypeListId: typeof c.customerTypeListId === "number" ? c.customerTypeListId : (typeof c.CustomerTypeListId === "number" ? c.CustomerTypeListId : null),
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
  customerTypeLookupCache = null;
  try {
    const res = await fetchWithRetry("/api/proxy/Customer?service=customer", {
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
/**
 * Persists a profile picture URL already uploaded via the shared R2 upload
 * route (`services/upload.ts`) onto the current user's account.
 * Calls `PUT /api/proxy/Auth/update-profile-picture-url?service=jwt`, which
 * reaches `UserManagementAPI`'s `AuthController.UpdateProfilePictureUrl` —
 * an additive endpoint that just sets `ApplicationUser.ProfilePictureUrl`
 * from an already-hosted URL, distinct from that controller's existing
 * `upload-profile-picture` (which receives the raw file itself).
 *
 * Note: this goes through the generic proxy, which broadcasts a
 * `ticket_updated` SSE event on every successful PUT regardless of path —
 * there's no "no resource" case in `RealtimeResource`. A profile-picture
 * update is rare enough that the one harmless extra table refetch it causes
 * elsewhere isn't worth widening that shared route's logic to special-case.
 */
export async function updateProfilePictureUrl(url: string): Promise<boolean> {
  try {
    const res = await fetchWithRetry(`/api/proxy/Auth/update-profile-picture-url?service=jwt`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ profilePictureUrl: url })
    });
    return res.ok;
  } catch (err: unknown) {
    console.error("Failed to update profile picture URL:", err);
    return false;
  }
}

export async function updateCustomer(id: string, customer: Partial<CustomerItem>): Promise<boolean> {
  invalidateCachePrefix("customers");
  customerTypeLookupCache = null;
  try {
    const res = await fetchWithRetry(`/api/proxy/Customer/${id}?service=customer`, {
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
  customerTypeLookupCache = null;
  try {
    const res = await fetchWithRetry(`/api/proxy/Customer/${id}?service=customer`, {
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
 * Fetches the master customer types from CustomerAPI.
 * Calls `GET /api/proxy/CustomerType?service=customer`.
 */
export async function fetchCustomerTypes(force = false): Promise<CustomerTypeItem[]> {
  const cacheKey = "customer-types";
  if (force) invalidateCachePrefix(cacheKey);
  return cachedFetch(cacheKey, async () => {
    try {
      const res = await fetchWithRetry("/api/proxy/CustomerType?service=customer", {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await safeJsonParse<any>(res, []);
      const rawList = Array.isArray(data)
        ? data
        : (data.data ?? data.Data ?? data.items ?? []);
      return (rawList as Record<string, unknown>[]).map((ct) => ({
        listId: Number(ct.listId ?? ct.ListId ?? 0),
        type: String(ct.type ?? ct.Type ?? "").trim(),
        description: ct.description ? String(ct.description) : undefined,
        isActive: ct.isActive !== undefined ? Boolean(ct.isActive) : true
      })).filter((ct) => ct.type.length > 0);
    } catch (err: unknown) {
      console.error("Failed to fetch customer types:", err);
      return [];
    }
  }, 2 * 60 * 1000);
}

/**
 * In-memory map of companyName (lowercased) -> customerType from CustomerAPI.
 * Cached for 5 minutes so reports and lookups don't repeatedly fetch.
 */
let customerTypeLookupCache: { map: Map<string, string>; expiresAt: number } | null = null;

export async function getCustomerTypeLookupMap(force = false): Promise<Map<string, string>> {
  const now = Date.now();
  if (!force && customerTypeLookupCache && customerTypeLookupCache.expiresAt > now) {
    return customerTypeLookupCache.map;
  }

  try {
    const res = await fetchWithRetry("/api/proxy/Customer?service=customer&pageSize=3000", {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await safeJsonParse<any>(res, []);
    const rawList = Array.isArray(data)
      ? data
      : (data.data ?? data.Data ?? data.items ?? []);

    const map = new Map<string, string>();
    for (const c of rawList) {
      const name = String(c.companyName ?? c.CompanyName ?? "").trim().toLowerCase();
      const type = String(c.customerType ?? c.CustomerType ?? "").trim();
      if (name && type) {
        map.set(name, type);
      }
    }
    customerTypeLookupCache = { map, expiresAt: now + 5 * 60 * 1000 };
    return map;
  } catch (err) {
    console.error("Failed to build customer type lookup map:", err);
    return customerTypeLookupCache?.map ?? new Map<string, string>();
  }
}

/**
 * Resolves live customer types from CustomerAPI for a batch of company names.
 */
export async function resolveCustomerTypesBatch(companyNames: string[]): Promise<Map<string, string>> {
  const lookup = await getCustomerTypeLookupMap();
  const result = new Map<string, string>();
  for (const name of companyNames) {
    const key = name.trim().toLowerCase();
    const resolved = lookup.get(key) || "";
    result.set(name, resolved);
  }
  return result;
}

/**
 * Stable, order-independent string for a filter object, for use in a cache key.
 *
 * `JSON.stringify` alone is not safe here: it preserves insertion order, so
 * `{fromDate, toDate}` and `{toDate, fromDate}` — the same filter — would key
 * two separate cache entries and double every request. Keys are sorted, arrays
 * are sorted, and empty/undefined values are dropped so that "field absent"
 * and "field explicitly empty" collapse to one entry rather than two.
 */
function stableKey<T extends object>(obj: T): string {
  const record = obj as Record<string, unknown>;
  const parts: string[] = [];
  for (const k of Object.keys(record).sort()) {
    const v = record[k];
    if (v === undefined || v === null || v === "") continue;
    parts.push(`${k}=${Array.isArray(v) ? [...v].map(String).sort().join("|") : String(v)}`);
  }
  return parts.join(";");
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
  //
  // Every field is included, not a hand-picked three. The key used to name
  // only fromDate/toDate/serviceType, so two searches differing solely in
  // `serviceLocation` — or in `userIds`, the engineer-report filter — hashed
  // to the same entry and the second silently read back the first one's rows.
  // No client call site passes those fields *today*, which is exactly why it
  // was invisible: the bug would have arrived with the next filter someone
  // added to a queue page, as a wrong table rather than a slow one. Derived
  // from the object so a new field cannot be forgotten again; arrays are
  // sorted so member order never splits one filter across two entries.
  const extraKey = extras ? `:x${stableKey(extras)}` : "";
  const cacheKey = `repairservices:${filter}:page${pageNumber}:size${pageSize}:search${searchTerm}${extraKey}`;

  return cachedFetch(cacheKey, async () => {
    const filterUpper = filter.toUpperCase();

    // "Today" and friends name a date window, not a status — send them as
    // `dateFilter` with no status, otherwise the backend looks for a ticket
    // status by that name and matches nothing. See DATE_WINDOW_FILTERS.
    const dateWindow = DATE_WINDOW_FILTERS[filterUpper];
    if (dateWindow) {
      try {
        // Started together, not one after the other. The two are independent —
        // the user map is keyed on GUIDs the ticket rows merely reference — so
        // awaiting them in sequence added the whole cold user-map latency
        // (~600ms: page 1 must land before pages 2..N fan out) on top of the
        // search on every uncached load. `reports.ts` already fetches this pair
        // with `Promise.all` for exactly this reason; this path never got it.
        const [{ items, totalCount }, userMap] = await Promise.all([
          fetchSingleStatusServices(
            pageNumber,
            pageSize,
            "",
            searchTerm,
            { ...extras, dateFilter: dateWindow }
          ),
          fetchUserMap().catch(() => new Map()),
        ]);
        return {
          items:      items.map((item) => enrichTicketUsers(item, userMap)),
          totalCount,
          pageNumber,
          pageSize,
          totalPages: Math.max(Math.ceil(totalCount / pageSize), 1)
        };
      } catch (err: unknown) {
        console.warn(`Date-window fetch (${dateWindow}) failed, using fallback:`, err);
        return {
          items: [],
          totalCount: 0,
          pageNumber,
          pageSize,
          totalPages: 1,
        };
      }
    }

    // Approve Repairing page merges three statuses (RepairItemList.razor)
    if (filterUpper === "REPAIRING" || filterUpper === "APPROVE REPAIRING") {
      try {
        const multiStatus = "Sent Spareparts,Inspection,Sale Confirmed";
        // Concurrent, for the reason given in the date-window branch above.
        const [{ items, totalCount }, userMap] = await Promise.all([
          fetchSingleStatusServices(
            pageNumber,
            pageSize,
            multiStatus,
            searchTerm,
            extras
          ),
          fetchUserMap().catch(() => new Map()),
        ]);
        const enrichedCombined = items.map((item) => enrichTicketUsers(item, userMap));

        return {
          items:      enrichedCombined,
          totalCount,
          pageNumber,
          pageSize,
          totalPages: Math.max(Math.ceil(totalCount / pageSize), 1)
        };
      } catch (err: unknown) {
        console.warn("Multi-status fetch failed, using fallback:", err);

        // Offline fallback
        const statuses = ["Sent Spareparts", "Inspection", "Sale Confirmed"];
        let filtered = MOCK_SERVICE_TICKETS.filter((i) =>
          statuses.some((st) => i.status.toLowerCase() === st.toLowerCase())
        );

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
    }

    const statusMap = getDbStatusMapping(filter);

    try {
      // Concurrent, for the reason given in the date-window branch above. This
      // is the branch every ordinary queue page takes, so it is the one that
      // decides how long the first table on screen takes to fill.
      const [{ items, totalCount }, userMap] = await Promise.all([
        fetchSingleStatusServices(
          pageNumber,
          pageSize,
          statusMap.name,
          searchTerm,
          extras
        ),
        fetchUserMap().catch(() => new Map()),
      ]);
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
      const statusParam = term ? "Repairing,Finished" : "Repairing";
      // Concurrent — see `fetchRepairServices`'s date-window branch.
      const [{ items, totalCount }, userMap] = await Promise.all([
        fetchSingleStatusServices(pageNumber, pageSize, statusParam, term),
        fetchUserMap().catch(() => new Map()),
      ]);
      const enrichedCombined = items.map((item) => enrichTicketUsers(item, userMap));

      return {
        items:      enrichedCombined,
        totalCount,
        pageNumber,
        pageSize,
        totalPages: Math.max(Math.ceil(totalCount / pageSize), 1)
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
    // Both started at once: this is the path that runs when a ticket dialog
    // opens, and the user map does not depend on the ticket. On a cold cache
    // the sequential version made the dialog wait for the ticket AND then the
    // whole user-map pagination before it could show a name.
    const [res, userMap] = await Promise.all([
      fetchWithRetry(`/api/proxy/technicalservices/${id}`, {
        headers: getAuthHeaders()
      }),
      fetchUserMap().catch(() => new Map()),
    ]);
    if (!res.ok) return null;
    const data = await safeJsonParse<RepairServiceItem | null>(res, null);
    if (!data || !data.id) return null;
    return enrichTicketUsers(data, userMap);
  } catch (err: unknown) {
    console.warn("Failed to fetch service by id:", err);
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
export async function fetchDashboardStats(force = false): Promise<DashboardStats> {
  if (force) {
    invalidateCachePrefix("dashboard:statistics");
  }
  return cachedFetch(
    "dashboard:statistics",
    async () => {
      try {
        const res = await fetchWithRetry(
          "/api/proxy/technicalservices/dashboard-stats",
          { headers: getAuthHeaders() }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await safeJsonParse<DashboardStats>(res, EMPTY_DASHBOARD_STATS);
      } catch (err: unknown) {
        console.warn("Failed to fetch dashboard stats:", err);
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
  invalidateCachePrefix('spareparts');
  invalidateCachePrefix('dashboard');
  try {
    const res = await fetchWithRetry('/api/proxy/inspectitem', {
      method:  'POST',
      headers: getAuthHeaders(),
      body:    JSON.stringify(payload)
    });
    if (res.ok) {
      void dispatchTelegramNotificationSafe({ id: payload.serviceId } as unknown as RepairServiceItem, "Inspection");
    }
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
  invalidateCachePrefix('spareparts');
  invalidateCachePrefix('dashboard');
  try {
    const res = await fetchWithRetry(
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
  invalidateCachePrefix('spareparts');
  invalidateCachePrefix('dashboard');
  try {
    const res = await fetchWithRetry('/api/proxy/finishedrepair', {
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
    const res = await fetchWithRetry(`/api/proxy/customercenter/customers?${params}`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await safeJsonParse<Record<string, unknown>>(res, {});
    return (data.items ?? data.Data ?? (Array.isArray(data) ? data : [])) as CustomerItem[];
  } catch (err: unknown) {
    console.warn('Failed to search customers:', err);
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
    const res = await fetchWithRetry("/api/proxy/items", {
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
    const res = await fetchWithRetry(`/api/proxy/items?${params}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await safeJsonParse<Record<string, unknown>>(res, {});
    const list = (data.items ?? data.Data ?? (Array.isArray(data) ? data : [])) as ItemModel[];
    return list.filter((i) => i.itemName?.toLowerCase().includes(searchTerm.toLowerCase()));
  } catch (err: unknown) {
    console.warn('Failed to search items:', err);
    return [];
  }
}
