/**
 * @file validation/stockPreflight.ts
 * @description The pre-flight that stops a ticket moving into a
 * stock-deducting status when the parts are not on the shelf.
 *
 * See `stockShortage.ts` for the rules this folder lives by. The short version
 * is: plain TypeScript, no framework imports — which is why the catalogue
 * lookup is INJECTED rather than imported. The web reads it through
 * `services/api`, the phone through `portalApi`; the decision of what counts
 * as a shortage is the same code on both.
 *
 * ── WHY THIS RUNS ON THE CLIENT AT ALL ────────────────────────────────────
 * The real gate is a SQL trigger, and it works. But when it fires, all the
 * client gets back is a raised message — so without this pre-flight the user
 * finds out only after the write is attempted, and finds out as a SQL string.
 * Running the check first turns "the operation failed" into "this part is
 * short by two", before anything is written.
 *
 * It does NOT replace the trigger: between the catalogue read and the POST
 * another user can take the last unit, so the trigger is still the authority
 * and its rejection still has to be handled. This only makes the common case
 * legible.
 */

import type { ShortageItem } from "./stockShortage";

/** The fields a ticket's spare-part line is read for. Casing varies by endpoint. */
export interface SparePartLineLike {
  [key: string]: unknown;
}

/**
 * What the catalogue lookup must return for the check to compare against.
 *
 * Deliberately NO index signature: TypeScript will not assign a declared
 * interface (the web's `SparePartItem`, the phone's `PortalSparePart`) to a
 * type that has one, so adding it here would force every call site to cast.
 * PascalCase variants are read through `asCatalogRecord` instead.
 */
export interface CatalogPartLike {
  itemName?: string | null;
  quantity?: number | null;
}

/** Reads a catalogue part by id, bypassing any cache. Supplied per platform. */
export type CatalogLookup = (sparePartId: string) => Promise<CatalogPartLike | null | undefined>;

const NULL_GUID = "00000000-0000-0000-0000-000000000000";

/**
 * The two statuses whose SQL trigger deducts stock
 * (`trg_Services_AfterUpdate_StatusToRepairing`, statuses 5 and 12).
 *
 * Checking any other transition would refuse moves the database would have
 * allowed, so this list is the whole scope of the pre-flight.
 */
export function isStockDeductingStatus(status: string | null | undefined): boolean {
  const s = String(status ?? "").trim().toLowerCase();
  return s === "sent spareparts" || s === "repairing";
}

/** Reads a catalogue row's PascalCase spelling without widening its type. */
function asCatalogRecord(part: CatalogPartLike | null | undefined): Record<string, unknown> {
  return (part ?? {}) as unknown as Record<string, unknown>;
}

function pick(line: SparePartLineLike, ...keys: string[]): unknown {
  for (const k of keys) {
    const v = line[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

/** The catalogue id a ticket line points at, under any of the API's casings. */
export function linePartId(line: SparePartLineLike): string | undefined {
  const id = pick(line, "sparePartId", "sparepartId", "SparePartId", "SparepartId", "id");
  const s = id === undefined ? "" : String(id).trim();
  return s && s !== NULL_GUID ? s : undefined;
}

/**
 * Whether one ticket line will actually consume stock.
 *
 * Mirrors the trigger exactly, and the `Fix` rule is the one that matters:
 * a part being repaired in place is not taken off the shelf, so counting it
 * would block a transition the database would have allowed. `Free`, `Replace`
 * and anything else DO consume.
 */
export function lineConsumesStock(line: SparePartLineLike): boolean {
  if (!linePartId(line)) return false;
  const condition = String(pick(line, "condition", "Condition") ?? "").trim().toLowerCase();
  if (condition === "fix") return false;
  return lineRequiredQty(line) > 0;
}

/** How many units the line needs. Defaults to 1, the way the web reads it. */
export function lineRequiredQty(line: SparePartLineLike): number {
  const raw = pick(line, "quantity", "Quantity");
  const n = Number(raw ?? 1);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Compares every stock-consuming line against live catalogue quantities.
 *
 * ── WHAT COUNTS AS "SHORT" ────────────────────────────────────────────────
 * Only a catalogue row that actually came back, carrying a readable quantity.
 * A lookup that throws, resolves `null`, or resolves a record with no numeric
 * quantity is UNKNOWN, and unknown is not short.
 *
 * That distinction is the whole safety property. Both platforms' readers
 * return `null` for any non-OK response, and this repo has 33 ticket lines
 * pointing at parts since deleted from the catalogue — so reading `null` as
 * "zero on hand" invented a shortage for every one of them and made those
 * tickets impossible to move, from either app. A 401 after a token expiry, or
 * any 5xx, did the same to every ticket at once.
 *
 * The trigger is still the authority and still refuses a genuine shortage;
 * this only decides what can be explained BEFORE the write.
 *
 * ── LINES ARE SUMMED PER PART ─────────────────────────────────────────────
 * A ticket may list the same part twice. Comparing each line against the full
 * quantity on hand passes two lines of one against a stock of one, and the
 * trigger — which deducts both — then refuses with the raw SQL message this
 * check exists to prevent.
 */
export async function checkStockShortages(
  lines: readonly SparePartLineLike[],
  lookup: CatalogLookup,
): Promise<ShortageItem[]> {
  /** Part id -> total units this ticket will take, and a name to call it by. */
  const needed = new Map<string, { required: number; fallbackName: string }>();

  for (const line of lines ?? []) {
    if (!lineConsumesStock(line)) continue;
    const sparePartId = linePartId(line);
    if (!sparePartId) continue;

    const existing = needed.get(sparePartId);
    const fallbackName = String(
      pick(line, "itemName", "ItemName", "description", "Description") ?? "Unknown Part",
    );
    if (existing) {
      existing.required += lineRequiredQty(line);
    } else {
      needed.set(sparePartId, { required: lineRequiredQty(line), fallbackName });
    }
  }

  if (needed.size === 0) return [];

  // Fanned out rather than awaited in sequence: nothing here depends on the
  // previous lookup, and a six-part ticket on a slow link was spending six
  // request timeouts back to back with the user watching a spinner.
  const entries = [...needed.entries()];
  const results: (ShortageItem | null)[] = await Promise.all(
    entries.map(async ([sparePartId, want]): Promise<ShortageItem | null> => {
      try {
        const catalog = await lookup(sparePartId);
        if (catalog === null || catalog === undefined) return null;

        const cat = asCatalogRecord(catalog);
        const raw = catalog.quantity ?? cat.Quantity;
        const available = Number(raw);
        // An unreadable quantity is unknown, not zero — same reasoning as a
        // failed read.
        if (raw === null || raw === undefined || !Number.isFinite(available)) return null;
        if (available >= want.required) return null;

        return {
          itemName: String(catalog.itemName ?? cat.ItemName ?? want.fallbackName),
          sparePartId,
          available,
          required: want.required,
        };
      } catch {
        // See the doc comment: a failed read is not a shortage.
        return null;
      }
    }),
  );

  return results.filter((r): r is ShortageItem => r !== null);
}

/**
 * The message shown when the pre-flight refuses.
 *
 * Deliberately written in the SAME shape the SQL trigger raises, so that
 * `parseStockErrorMessage` can read a client-side refusal and a server-side
 * one with the same code path — one parser, one presentation, wherever the
 * refusal came from.
 */
export function shortageErrorMessage(shortages: readonly ShortageItem[]): string {
  if (shortages.length === 0) return "";
  if (shortages.length === 1) {
    const s = shortages[0];
    return `Insufficient stock when releasing hold for service order. Item: ${s.itemName} | Available: ${s.available} | Required: ${s.required}`;
  }
  return `Insufficient stock for ${shortages.length} items when releasing hold.`;
}
