/**
 * @file services/sparepartTaxonomyApi.ts
 * @description Typed client for the spare-part Category / Type / Brand
 * lookups (`/api/spareparts/categories|types|brands`, added 2026-09-05).
 *
 * Its own module rather than another 200 lines in `api.ts` (already over
 * 2,000), but it reuses that file's cache, auth and retry plumbing so the
 * behaviour is identical: reads go through `cachedFetch` under the
 * `sparepart-taxonomy` prefix, writes invalidate that prefix AND `spareparts`
 * (the list shows these names and the lookups carry `partCount`).
 *
 * No mock fallback on purpose. An empty dropdown is the truthful state when
 * the backend is down; inventing categories would let someone file a part
 * under an id that does not exist.
 */

import { fetchWithRetry } from "@/lib/withTimeout";
import { cachedFetch, getAuthHeaders, invalidateCachePrefix } from "./api";
import { networkFailure, readWriteResult } from "./apiWriteResult";
import type {
  ApiWriteResult,
  SparePartBrand,
  SparePartCategory,
  SparePartTaxonomyInput,
  SparePartType,
} from "./types";

const PREFIX = "sparepart-taxonomy";
const BASE = "/api/proxy/spareparts";
/** Lookups change rarely; the write paths invalidate, so this is a backstop. */
const TTL_MS = 60_000;
const NULL_GUID = "00000000-0000-0000-0000-000000000000";

type Raw = Record<string, unknown>;

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function nullableStr(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}
function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function readList(url: string): Promise<Raw[]> {
  const res = await fetchWithRetry(url, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data: unknown = await res.json();
  return Array.isArray(data) ? (data as Raw[]) : [];
}

/**
 * Drops the cached lookups only. `useTaxonomyList` calls this when the SSE
 * stream reports a spare-part write from elsewhere; the catalogue list has
 * its own invalidation for that event.
 */
export function invalidateTaxonomyCache(): void {
  invalidateCachePrefix(PREFIX);
}

function invalidate(): void {
  invalidateTaxonomyCache();
  invalidateCachePrefix("spareparts");
}

/**
 * Invalidates before AND after the request. Before is the house style
 * (`api.ts`); after is what closes the gap it leaves: a read already in
 * flight when the write starts resolves with the pre-write list and
 * `cachedFetch` stores it for `TTL_MS`. Clearing again once the write has
 * landed means the next read cannot be served that stale copy.
 */
async function write(method: "POST" | "PUT" | "DELETE", url: string, body?: unknown): Promise<ApiWriteResult> {
  invalidate();
  try {
    const res = await fetchWithRetry(url, {
      method,
      headers: getAuthHeaders(),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return await readWriteResult(res);
  } catch (err: unknown) {
    console.error(`Spare-part taxonomy ${method} ${url} failed:`, err);
    return networkFailure();
  } finally {
    invalidate();
  }
}

function idPath(base: string, id: string): string {
  return `${base}/${encodeURIComponent(id)}`;
}

// ── Categories ──────────────────────────────────────────────────────────────

export function fetchSparePartCategories(): Promise<SparePartCategory[]> {
  return cachedFetch(`${PREFIX}:categories`, async () => {
    const rows = await readList(`${BASE}/categories`);
    return rows.map((r) => ({
      id: str(r.id),
      name: str(r.name),
      description: nullableStr(r.description),
      sortOrder: num(r.sortOrder),
      typeCount: num(r.typeCount),
      partCount: num(r.partCount),
    }));
  }, TTL_MS);
}

export function createSparePartCategory(input: SparePartTaxonomyInput): Promise<ApiWriteResult> {
  return write("POST", `${BASE}/categories`, categoryBody(input));
}

export function updateSparePartCategory(id: string, input: SparePartTaxonomyInput): Promise<ApiWriteResult> {
  return write("PUT", idPath(`${BASE}/categories`, id), categoryBody(input));
}

export function deleteSparePartCategory(id: string): Promise<ApiWriteResult> {
  return write("DELETE", idPath(`${BASE}/categories`, id));
}

function categoryBody(input: SparePartTaxonomyInput) {
  return {
    name: input.name.trim(),
    description: input.description?.trim() || null,
    sortOrder: input.sortOrder ?? 0,
  };
}

// ── Types ───────────────────────────────────────────────────────────────────

/**
 * All types, across every category. Callers narrow per category on the
 * client (the list is small) — the API's `?categoryId` filter exists for
 * other consumers and is deliberately not wrapped here until one needs it.
 */
export function fetchSparePartTypes(): Promise<SparePartType[]> {
  return cachedFetch(`${PREFIX}:types`, async () => {
    const rows = await readList(`${BASE}/types`);
    return rows.map((r) => ({
      id: str(r.id),
      categoryId: str(r.categoryId),
      categoryName: str(r.categoryName),
      name: str(r.name),
      description: nullableStr(r.description),
      sortOrder: num(r.sortOrder),
      partCount: num(r.partCount),
    }));
  }, TTL_MS);
}

export function createSparePartType(input: SparePartTaxonomyInput): Promise<ApiWriteResult> {
  return write("POST", `${BASE}/types`, typeBody(input));
}

export function updateSparePartType(id: string, input: SparePartTaxonomyInput): Promise<ApiWriteResult> {
  return write("PUT", idPath(`${BASE}/types`, id), typeBody(input));
}

export function deleteSparePartType(id: string): Promise<ApiWriteResult> {
  return write("DELETE", idPath(`${BASE}/types`, id));
}

function typeBody(input: SparePartTaxonomyInput) {
  // `CategoryId` is a non-nullable Guid on the server; the all-zero GUID
  // reaches the domain rule ("'CategoryId' is required" → 400) instead of the
  // binder's generic message. `validateTaxonomyType` normally stops it here.
  return {
    categoryId: input.categoryId || NULL_GUID,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    sortOrder: input.sortOrder ?? 0,
  };
}

// ── Brands ──────────────────────────────────────────────────────────────────

export function fetchSparePartBrands(): Promise<SparePartBrand[]> {
  return cachedFetch(`${PREFIX}:brands`, async () => {
    const rows = await readList(`${BASE}/brands`);
    return rows.map((r) => ({
      id: str(r.id),
      name: str(r.name),
      logoUrl: nullableStr(r.logoUrl),
      partCount: num(r.partCount),
    }));
  }, TTL_MS);
}

export function createSparePartBrand(input: SparePartTaxonomyInput): Promise<ApiWriteResult> {
  return write("POST", `${BASE}/brands`, brandBody(input));
}

export function updateSparePartBrand(id: string, input: SparePartTaxonomyInput): Promise<ApiWriteResult> {
  return write("PUT", idPath(`${BASE}/brands`, id), brandBody(input));
}

export function deleteSparePartBrand(id: string): Promise<ApiWriteResult> {
  return write("DELETE", idPath(`${BASE}/brands`, id));
}

function brandBody(input: SparePartTaxonomyInput) {
  // Upper-cased here as well as on the server, so what the user sees in the
  // list after saving is what they saw in the input.
  return {
    name: input.name.trim().toUpperCase(),
    logoUrl: input.logoUrl?.trim() || null,
  };
}
