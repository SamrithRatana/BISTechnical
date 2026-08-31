/**
 * @file components/docs/content/reportCount.ts
 * @description How many reports the portal ships — declared once.
 *
 * Unlike the workflow-stage count, this one cannot be derived from anything
 * the manual already holds. Its authority is `ALL_REPORTS` in
 * `services/reportCatalog.ts`, and importing that here would pull the column
 * definitions, widths, data types and aggregations for all 29 reports into the
 * public docs chunk to read one integer — against §4 for no reader's benefit.
 *
 * So it is a mirrored constant, in exactly one place, with the mirror named.
 * If `ALL_REPORTS` grows, this is the single line to change; the atlas chip and
 * the reports chapter both read it, so they cannot disagree with each other
 * even while they are being corrected.
 */

/** Entries in `ALL_REPORTS` (`services/reportCatalog.ts`) — 28 spreadsheet
 *  reports plus the one A4 Technical Service Report. */
export const DOCS_REPORT_COUNT = 29;
