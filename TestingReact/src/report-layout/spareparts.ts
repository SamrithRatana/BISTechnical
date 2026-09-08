/**
 * @file report-layout/spareparts.ts
 * @description Turns a ticket's raw spare-part lines into the rows the table
 * prints.
 *
 * See `types.ts` for why this folder has no framework imports.
 *
 * The API returns these lines with inconsistent casing and, depending on the
 * endpoint, without the catalogue fields (`useFor`, the part number) that the
 * report shows. The web app enriches them from the spare-parts inventory
 * before printing; the phone had no equivalent step and printed whatever the
 * ticket happened to carry, so the same ticket produced different table
 * contents on the two platforms. The *matching* rules live here so both sides
 * resolve a row identically — fetching the inventory stays with the caller,
 * which is the only genuinely platform-specific part.
 */

import type { ReportSparePartLike, ResolvedSparePartRow } from "./types";

type Dict = Record<string, unknown>;

/** First non-empty value among the given keys, case variants included. */
function pick(source: Dict, ...keys: string[]): string {
  for (const key of keys) {
    const value = source[key];
    if (value != null && String(value).trim() !== "") return String(value).trim();
  }
  return "";
}

function pickNumber(source: Dict, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && isFinite(value)) return value;
  }
  return undefined;
}

/** The identifier a ticket line uses to point at a catalogue part. */
export function sparePartLineId(raw: ReportSparePartLike): string {
  const line = raw as Dict;
  const candidates = [
    line.sparePartId,
    line.sparepartId,
    line.SparePartId,
    line.SparepartId,
    line.partId,
    line.PartId,
  ];
  for (const val of candidates) {
    if (val != null && typeof val === "string") {
      const trimmed = val.trim();
      if (trimmed && trimmed !== "00000000-0000-0000-0000-000000000000") {
        return trimmed;
      }
    }
  }
  const rawId = line.id ?? line.Id;
  if (rawId != null && typeof rawId === "string") {
    const trimmed = rawId.trim();
    if (
      trimmed &&
      !trimmed.startsWith("part-") &&
      trimmed !== "00000000-0000-0000-0000-000000000000"
    ) {
      return trimmed;
    }
  }
  return "";
}

/**
 * Finds the catalogue record a ticket line refers to — by id, part number or
 * serial number, else by name.
 */
export function matchSparePartInventory(
  raw: ReportSparePartLike,
  inventory: readonly Dict[],
): Dict | undefined {
  const lineId = sparePartLineId(raw).toLowerCase();
  const description = pick(raw as Dict, "description", "Description", "itemName", "ItemName").toLowerCase();

  return inventory.find((part) => {
    const id = String(part.id ?? "").toLowerCase().trim();
    const partNumber = String(part.partNumber ?? "").toLowerCase().trim();
    const serialNumber = String(part.serialNumber ?? "").toLowerCase().trim();
    const name = String(part.itemName ?? part.partName ?? "").toLowerCase().trim();

    if (lineId && (id === lineId || partNumber === lineId || serialNumber === lineId)) return true;
    if (description && name && (name === description || name.includes(description) || description.includes(name))) {
      return true;
    }
    return false;
  });
}

/**
 * Maps one ticket line (plus its catalogue match, when the caller found one)
 * to a printed row. Catalogue values win over the line's own copies, which
 * are frequently stale.
 */
export function resolveSparePartRow(
  raw: ReportSparePartLike,
  inventoryMatch: Dict | undefined,
  index: number,
): ResolvedSparePartRow {
  const line = raw as Dict;
  const match = inventoryMatch ?? {};

  const itemName =
    pick(match, "itemName", "partName", "name") ||
    pick(line, "itemName", "ItemName", "description", "Description") ||
    "—";

  const useFor =
    pick(match, "useFor", "compatibleModel") ||
    pick(line, "useFor", "UseFor", "compatibleModel") ||
    "—";

  let partNo =
    pick(match, "partNumber", "serialNumber", "code", "partNo") ||
    pick(line, "partNumber", "PartNumber", "serialNumber", "SerialNumber", "code");

  // A raw GUID is the ticket line's own primary key leaking through, not a
  // part number; so is anything longer than a real catalogue code.
  const lineId = sparePartLineId(raw);
  if (!partNo || partNo === lineId || partNo === "undefined" || partNo.length > 25) partNo = "N/A";

  const unitPrice = pickNumber(match, "defaultPrice") ?? pickNumber(line, "defaultPrice", "DefaultPrice", "price", "Price");

  return {
    id: pick(line, "id", "Id") || String(index),
    itemName,
    useFor,
    sparePartId: partNo,
    quantity: Number(line.quantity ?? line.Quantity ?? 1),
    condition: pick(line, "condition", "Condition") || "Replace",
    unitPrice,
    remarks: pick(line, "remarks", "Remarks"),
  };
}

/** Reads a ticket's spare-part lines under any of the casings the API uses. */
export function ticketSparePartLines(item: Record<string, unknown>): ReportSparePartLike[] {
  const candidates = [
    item.sparepartItems,
    item.sparePartItems,
    item._sparepartItems,
    item.SparepartItems,
    item.SparePartItems,
    item.spareParts,
    item.SpareParts,
  ];
  for (const value of candidates) {
    if (Array.isArray(value)) return value as ReportSparePartLike[];
  }
  return [];
}

/** Resolves every line of a ticket against an optional catalogue snapshot. */
export function resolveSparePartRows(
  rawParts: readonly ReportSparePartLike[],
  inventory: readonly Dict[] = [],
): ResolvedSparePartRow[] {
  return rawParts.map((raw, index) => resolveSparePartRow(raw, matchSparePartInventory(raw, inventory), index));
}
