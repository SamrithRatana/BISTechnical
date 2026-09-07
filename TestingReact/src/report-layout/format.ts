/**
 * @file report-layout/format.ts
 * @description Value formatting and escaping for the printed report.
 *
 * See `types.ts` for why this folder has no framework imports.
 */

import { calculateReportDaysTaken, getReportStatusDate, TICKET_FIELDS } from "./fields";
import { asRecord, type ReportSparePartLike, type ReportTicketLike } from "./types";

/**
 * Escapes text for interpolation into the generated HTML.
 *
 * EVERY value that reaches the document goes through this. The report prints
 * customer names, addresses and free-text complaints straight from the
 * database, and the output is handed to `srcdoc` on web and to a WebView on
 * mobile — both of which execute script. Interpolating raw is a stored-XSS
 * hole, so there is no "trusted" caller that may skip it.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Reduces a value to what is legal inside a quoted CSS font-family name.
 *
 * An allowlist, not a blocklist. The blocklist this replaced stripped
 * `<>{}\;` and let `'`, `"`, `(`, `)`, `/` and `*` through — so a family name
 * of `a', sans-serif /*` closed the quoted string and commented out the
 * stylesheet as far as the next comment terminator, of which the generated CSS
 * has several in its own banners.
 */
export function escapeCss(value: unknown): string {
  return String(value ?? "").replace(/[^A-Za-z0-9 _-]/g, "");
}

/**
 * A template number, coerced so it cannot escape a CSS declaration.
 *
 * The settings blob is `JSON.parse`d off the wire and validated by nothing on
 * either side, so a field typed `number` here can hold whatever the stored JSON
 * held. These values land directly in a `<style>` block, where a string such as
 * `1.3} body{background:url(https://x/?c=)}` closes the rule and injects
 * arbitrary CSS into every user's report and into the phone's WebView.
 * Non-finite input falls back rather than emitting `NaN`.
 */
export function cssNumber(value: unknown, fallback: number, min = -10000, max = 10000): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** A template string used as a CSS keyword (`left` / `center` / `right`). */
export function cssKeyword(value: unknown, allowed: readonly string[]): string | undefined {
  const v = String(value ?? "").trim().toLowerCase();
  return allowed.includes(v) ? v : undefined;
}

/**
 * A template colour, accepted only in the notations the designer can produce.
 *
 * `escapeHtml` on an inline `style` attribute stops the attribute being escaped
 * but not a declaration being injected inside it — `red;background:url(...)`
 * survives it intact and beacons on every printed report.
 */
export function cssColor(value: unknown): string | undefined {
  const v = String(value ?? "").trim();
  if (!v) return undefined;
  if (/^#[0-9a-f]{3,8}$/i.test(v)) return v;
  if (/^rgba?\(\s*[\d.\s,%/]+\)$/i.test(v)) return v;
  if (/^[a-z]{3,20}$/i.test(v)) return v;
  return undefined;
}

/**
 * Restricts what may be used as the report's header image.
 *
 * Accepted: a same-origin path, an inline data URI, or an absolute `https:`
 * URL. `https:` has to be allowed — the uploaded company logo lives on the
 * project's R2 bucket and is already rendered app-wide in the sidebar and on
 * the login screen, so refusing it here would silently print the bundled Cam
 * logo for every company that set their own. What stays blocked is everything
 * that is neither: `javascript:`, `http:` (mixed content), and protocol-
 * relative forms.
 */
export function safeImageSrc(url: string | null | undefined, fallback: string): string {
  const raw = String(url ?? "").trim();
  if (!raw) return fallback;
  // A backslash is a path separator for http(s), so `/\evil.example/x.png` is
  // protocol-relative and resolves off-origin. Reject either separator in the
  // second position.
  if (raw.startsWith("/") && !/^\/[/\\]/.test(raw)) return raw;
  if (/^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=\s]+$/i.test(raw)) return raw;
  if (/^https:\/\/[^/\\?#\s]+\//i.test(raw)) return raw;
  return fallback;
}

/**
 * The report's typeface stack.
 *
 * Each preset leads with the Next.js font variable so the web app uses the
 * self-hosted face it already loaded, but every variable carries a literal
 * fallback (`var(--font-battambang, 'Battambang')`) because the mobile
 * WebView defines no such variable — there it resolves to the family loaded
 * from the document's own `<link>`. Same family name on both, so glyph
 * metrics match.
 */
export function resolveReportFontFamily(familyKey?: string): string {
  const battambang = "var(--font-battambang, 'Battambang')";
  const kantumruy = "var(--font-kantumruy, 'Kantumruy Pro')";
  const noto = "var(--font-noto-khmer, 'Noto Sans Khmer')";
  const khmerFallback = "'Khmer OS Battambang', 'Khmer OS', 'Khmer UI', 'Leelawadee UI'";

  switch (familyKey) {
    case "arial":
      return `Arial, ${battambang}, ${kantumruy}, ${noto}, ${khmerFallback}, sans-serif`;
    case "times":
      return `'Times New Roman', Times, ${battambang}, ${kantumruy}, ${noto}, ${khmerFallback}, serif`;
    case "kantumruy":
      return `${kantumruy}, ${battambang}, ${noto}, ${khmerFallback}, sans-serif`;
    case "noto":
      return `${noto}, ${battambang}, ${kantumruy}, ${khmerFallback}, sans-serif`;
    case "courier":
      return "'Courier New', Courier, monospace";
    case "khmer":
    case undefined:
    case "":
      return `${battambang}, ${kantumruy}, ${noto}, ${khmerFallback}, sans-serif`;
    default:
      // A font the user picked from their own machine; keep the Khmer stack
      // behind it so a machine without that face still renders Khmer.
      return `'${escapeCss(familyKey)}', ${battambang}, ${kantumruy}, ${noto}, ${khmerFallback}, sans-serif`;
  }
}

/** Monospaced stack for the Part No column and serial numbers. */
export const REPORT_MONO_FAMILY = "'Courier New', Courier, ui-monospace, monospace";

export function formatMoney(n: number): string {
  return `$${n.toFixed(2)}`;
}

function formatTime24HourWithAmPm(date: Date): string {
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const period = hours < 12 ? "AM" : "PM";
  return `${String(hours).padStart(2, "0")}:${minutes} ${period}`;
}

/** `DD-MM-YYYY HH:mm AM/PM`, the format the DevExpress report used. */
export function formatReportDate(dateStr?: string | null): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    return `${day}-${month}-${d.getFullYear()} ${formatTime24HourWithAmPm(d)}`;
  } catch {
    return String(dateStr);
  }
}

/** Normalises the API's status spellings to the printed wording. */
export function formatReportStatus(status?: string | null): string {
  if (!status) return "";
  const s = status.trim();
  if (/^item\s*rec/i.test(s)) return "Item Recieved";
  if (/^inspect/i.test(s)) return "Inspection";
  if (/^await.*cust/i.test(s)) return "Awaiting Customer Confirm";
  if (/^await.*spare/i.test(s)) return "Awaiting Sparepart";
  if (/^repair/i.test(s)) return "Repairing";
  if (/^finish/i.test(s)) return "Finished";
  if (/^third/i.test(s)) return "Repair by Third-Party";
  if (/^reject/i.test(s)) return "Customer Rejected";
  if (/^unrepair/i.test(s)) return "Unrepairable";
  return s;
}

function ticketParts(item: ReportTicketLike): ReportSparePartLike[] {
  return item.sparePartItems || item.sparepartItems || [];
}

/**
 * Renders one bound database field as the report prints it — dates through
 * the report date format, booleans as the DevExpress-style ☑/☐ glyphs, and
 * the computed spare-part aggregates the designer exposes.
 *
 * Returns plain text; the caller escapes it.
 */
export function formatFieldValue(item: ReportTicketLike, fieldKey: string): string {
  const def = TICKET_FIELDS.find((f) => f.key === fieldKey);
  const parts = ticketParts(item);

  if (fieldKey === "sparePartsSummary") {
    return parts.map((s) => s.description || s.itemName).filter(Boolean).join(", ") || "—";
  }
  if (fieldKey === "sparePartsCount") {
    return String(parts.reduce((sum, s) => sum + (s.quantity || 1), 0));
  }
  if (fieldKey === "sparePartsTotalCost") {
    const total = parts.reduce((sum, s) => sum + (s.defaultPrice || 0) * (s.quantity || 1), 0);
    return total > 0 ? formatMoney(total) : "—";
  }
  if (fieldKey === "sparePartsRemarks") {
    return parts.map((s) => s.remarks).filter(Boolean).join("; ") || "—";
  }
  if (fieldKey === "isHoldStatus") {
    return parts.some((s) => Boolean(asRecord(s).isHoldStatus)) ? "☑" : "☐";
  }
  if (fieldKey === "daysTaken") {
    const days = calculateReportDaysTaken(item);
    return days != null ? `${days} days` : "—";
  }
  if (fieldKey === "statusDate") {
    // Not a column on the record — it is whichever lifecycle date matches the
    // ticket's current status. Without this branch the default binding of the
    // "Date Waiting" header row reads a property that does not exist and every
    // unfinished ticket prints an em dash there.
    const resolved = getReportStatusDate(item);
    return resolved ? formatReportDate(resolved) : "—";
  }

  // Own properties only. `fieldKey` is chosen in the designer, so `constructor`
  // or `toString` would otherwise print a function body into a customer's report.
  const record = asRecord(item);
  const raw = Object.prototype.hasOwnProperty.call(record, fieldKey) ? record[fieldKey] : undefined;
  if (def?.type === "boolean") return raw ? "☑" : "☐";
  if (def?.type === "date") return raw ? formatReportDate(String(raw)) : "—";
  if (raw == null || raw === "") return fieldKey === "serviceType" ? "Charge" : "—";
  return String(raw);
}
