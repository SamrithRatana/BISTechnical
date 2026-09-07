/**
 * @file services/routePrefetch.ts
 * @description Smart, Debounced Just-In-Time prefetcher for Sidebar navigation.
 *
 * Prevents rapid mouse sweeps from spamming backend API endpoints.
 * Only warms up the cache when a user intentionally hovers for >150ms.
 */

import {
  fetchCustomerCenter,
  fetchDashboardStats,
  fetchItemsInventory,
  fetchRepairServices,
  fetchSparePartsInventory,
  fetchApproveVerifyServices,
} from "./api";
import { primeListCache } from "@/hooks/useInfiniteList";
import { registerSessionCacheClearer } from "./authSession";

const prefetchedRoutes = new Map<string, number>();
const PREFETCH_THROTTLE_MS = 120_000; // 2 minutes throttle per route
let debounceTimer: NodeJS.Timeout | number | null = null;
let activePrefetchPromise: Promise<void> | null = null;

registerSessionCacheClearer(() => {
  prefetchedRoutes.clear();
});

async function triggerRouteDataFetch(cleanPath: string): Promise<void> {
  switch (cleanPath) {
    case "/":
      await fetchDashboardStats();
      break;

    case "/received-inventory": {
      const res = await fetchItemsInventory(1, 25, "");
      if (res?.items) primeListCache("item-models:", res.items, res.totalCount);
      break;
    }

    case "/spareparts": {
      const res = await fetchSparePartsInventory(1, 25, "");
      if (res?.items) primeListCache("spareparts:", res.items, res.totalCount);
      break;
    }

    case "/customers": {
      const res = await fetchCustomerCenter(1, 20, "");
      if (res?.items) primeListCache("customers:", res.items, res.totalCount);
      break;
    }

    case "/receive-item": {
      const res = await fetchRepairServices(1, 25, "Received", "");
      if (res?.items) primeListCache("Received|", res.items, res.totalCount);
      break;
    }

    case "/inspect-item": {
      const res = await fetchRepairServices(1, 25, "Inspecting", "");
      if (res?.items) primeListCache("Inspecting|", res.items, res.totalCount);
      break;
    }

    case "/inspection": {
      const res = await fetchRepairServices(1, 25, "Inspection", "");
      if (res?.items) primeListCache("Inspection|", res.items, res.totalCount);
      break;
    }

    case "/approve-repair": {
      const res = await fetchRepairServices(1, 25, "Repairing", "");
      if (res?.items) primeListCache("Repairing|", res.items, res.totalCount);
      break;
    }

    case "/approve-verify": {
      const res = await fetchApproveVerifyServices(1, 25, "");
      if (res?.items) primeListCache("ApproveVerify|", res.items, res.totalCount);
      break;
    }

    case "/spare-request": {
      const res = await fetchRepairServices(1, 25, "Awaiting Sparepart", "");
      if (res?.items) primeListCache("Awaiting Sparepart|", res.items, res.totalCount);
      break;
    }

    case "/confirmed-sale": {
      const res = await fetchRepairServices(1, 25, "Sale Confirmed", "");
      if (res?.items) primeListCache("Sale Confirmed|", res.items, res.totalCount);
      break;
    }

    case "/waiting-confirm": {
      const res = await fetchRepairServices(1, 25, "Awaiting Customer Confirm", "");
      if (res?.items) primeListCache("Awaiting Customer Confirm|", res.items, res.totalCount);
      break;
    }

    case "/rejected": {
      const res = await fetchRepairServices(1, 25, "Customer Rejected", "");
      if (res?.items) primeListCache("Customer Rejected|", res.items, res.totalCount);
      break;
    }

    case "/unrepairable": {
      const res = await fetchRepairServices(1, 25, "Unrepairable", "");
      if (res?.items) primeListCache("Unrepairable|", res.items, res.totalCount);
      break;
    }

    default:
      break;
  }
}

/**
 * Triggers a debounced, deduplicated background prefetch.
 * Mouse sweeping won't trigger any network requests.
 */
export function prefetchRouteData(href: string): void {
  if (typeof window === "undefined" || !href || href.startsWith("#")) return;

  const cleanPath = href.split("?")[0].replace(/\/+$/, "") || "/";
  const now = Date.now();
  const lastPrefetched = prefetchedRoutes.get(cleanPath) || 0;
  if (now - lastPrefetched < PREFETCH_THROTTLE_MS) {
    return;
  }

  // Clear previous pending debounce
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  // 150ms debounce: only prefetch if the user hovers with intent
  debounceTimer = setTimeout(() => {
    prefetchedRoutes.set(cleanPath, Date.now());
    if (!activePrefetchPromise) {
      activePrefetchPromise = triggerRouteDataFetch(cleanPath)
        .catch(() => {})
        .finally(() => {
          activePrefetchPromise = null;
        });
    }
  }, 150);
}
