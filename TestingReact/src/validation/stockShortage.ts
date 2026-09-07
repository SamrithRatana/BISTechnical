/**
 * @file validation/stockShortage.ts
 * @description Turns the backend's stock-shortage rejection into something a
 * screen can render.
 *
 * ── THIS FOLDER IS THE ONE SET OF BUSINESS RULES ──────────────────────────
 * `src/validation/` holds the rules BOTH platforms must enforce identically,
 * as plain TypeScript: no React, no Next, no React Native, no DOM, no
 * `window`, no Node built-ins, no imports outside this folder. That is what
 * lets the same files run inside the Expo/Metro bundle, where they are
 * mirrored to `CamIdMobile/src/validation/` by `npm run sync:shared`.
 *
 * The rule and its wording live here; each platform supplies only the
 * presentation. A rule implemented twice is a rule that will disagree with
 * itself — that is exactly what happened to the printed report, and to the
 * phone's copy of the report template.
 *
 * ── WHY THE SHORTAGE ARRIVES AS A STRING ──────────────────────────────────
 * The stock rule is enforced by a SQL trigger, not by application code, so the
 * only thing the client receives is the trigger's raised message wrapped in
 * whatever the API layer added around it. Parsing it is not a nicety: without
 * it the phone shows the user a raw SQL error, and the desktop showed a
 * structured panel naming the part, the quantity on hand and the quantity
 * required. Same backend, two very different answers to "why can I not do
 * this?".
 */

export interface ShortageItem {
  itemName: string;
  sparePartId?: string;
  /** Quantity on hand. String because the trigger reports it as text. */
  available: number | string;
  /** Quantity the ticket needs. */
  required: number | string;
}

export interface StockShortageDetails {
  items?: ShortageItem[];
  itemName?: string;
  sparePartId?: string;
  available?: number | string;
  required?: number | string;
  /** The message with SQL noise stripped, for when nothing could be parsed. */
  rawMessage?: string;
}

/** `Item: X | Available: 0 | Required: 1` — the English trigger. */
const ENGLISH_SHORTAGE =
  /Item:\s*([^|\r\n]+)\s*\|\s*Available:\s*(\d+)\s*\|\s*Required:\s*(\d+)/i;

/** `ឈ្មោះ: X | Id: Y | មានក្នុងស្តុក: 0 | ត្រូវការ: 1` — the Khmer trigger. */
const KHMER_SHORTAGE =
  /ឈ្មោះ:\s*([^|\r\n]+)(?:\|\s*Id:\s*([^|\r\n]+))?\s*\|\s*មានក្នុងស្តុក:\s*(\d+)\s*\|\s*ត្រូវការ:\s*(\d+)/i;

/**
 * True when a failed transition was refused for lack of stock, rather than for
 * any other reason.
 *
 * Used to decide whether to show the shortage panel or a plain error, so it
 * has to be conservative: a false positive shows an empty stock panel for an
 * unrelated failure, which is worse than a plain message.
 */
export function isStockShortageError(raw: string | null | undefined): boolean {
  if (!raw) return false;
  if (ENGLISH_SHORTAGE.test(raw) || KHMER_SHORTAGE.test(raw)) return true;
  return /insufficient stock|not enough stock|មិនគ្រប់គ្រាន់|ស្តុកមិនគ្រប់/i.test(raw);
}

/**
 * Parses a raw error string — from the SQL trigger, the API, or a client-side
 * pre-check — into structured shortage fields.
 *
 * `existingShortages` short-circuits it: a caller that already knows what is
 * short (because it checked before calling) passes them straight through
 * rather than round-tripping through a message.
 */
export function parseStockErrorMessage(
  raw: string,
  existingShortages?: ShortageItem[],
): StockShortageDetails {
  if (existingShortages && existingShortages.length > 0) {
    return {
      items: existingShortages,
      itemName: existingShortages[0].itemName,
      available: existingShortages[0].available,
      required: existingShortages[0].required,
      rawMessage: raw,
    };
  }

  if (!raw) return { rawMessage: "" };

  const english = raw.match(ENGLISH_SHORTAGE);
  if (english) {
    const single: ShortageItem = {
      itemName: english[1].trim(),
      available: english[2].trim(),
      required: english[3].trim(),
    };
    return {
      items: [single],
      itemName: single.itemName,
      available: single.available,
      required: single.required,
      rawMessage: raw,
    };
  }

  const khmer = raw.match(KHMER_SHORTAGE);
  if (khmer) {
    const single: ShortageItem = {
      itemName: khmer[1].trim(),
      sparePartId: khmer[2]?.trim(),
      available: khmer[3].trim(),
      required: khmer[4].trim(),
    };
    return {
      items: [single],
      itemName: single.itemName,
      sparePartId: single.sparePartId,
      available: single.available,
      required: single.required,
      rawMessage: raw,
    };
  }

  // Nothing matched: strip the SQL wrapper so the user is not shown
  // "The batch has been aborted" as if it meant something to them.
  return { rawMessage: cleanServerMessage(raw) };
}

/**
 * Removes the noise SQL Server wraps around a raised message.
 *
 * Worth doing even when the shortage pattern did not match — these two
 * sentences are the bulk of the string and say nothing a user can act on.
 */
export function cleanServerMessage(raw: string): string {
  return String(raw ?? "")
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .replace(/\\r\\n/g, " ")
    .replace(/\r\n|\n/g, " ")
    .replace(/An error was raised during trigger execution.*$/i, "")
    .replace(/The batch has been aborted.*$/i, "")
    .trim();
}

/** The shortage rows to render, with sane fallbacks for a partial parse. */
export function shortageItemsOf(details: StockShortageDetails | null): ShortageItem[] {
  if (!details) return [];
  if (details.items && details.items.length > 0) return details.items;
  if (!details.itemName && details.available === undefined) return [];
  return [
    {
      itemName: details.itemName || "គ្រឿងបន្លាស់",
      sparePartId: details.sparePartId,
      available: details.available !== undefined ? details.available : "0",
      required: details.required !== undefined ? details.required : "1",
    },
  ];
}
