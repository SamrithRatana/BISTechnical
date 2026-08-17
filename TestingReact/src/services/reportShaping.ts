/**
 * @file reportShaping.ts
 * @description Grouping and formatting shared by the report pages.
 *
 * Kept out of the pages so "how a date is printed" and "how rows are bucketed"
 * are decided once. Which *field* appears in which column is not here — that is
 * the template's job.
 */

import type { TemplateGroup } from "./excelTemplate";

/** dd/MM/yyyy, the format the Blazor reports used. */
export function formatDay(value: unknown): string {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** dd/MM/yyyy HH:mm — the daily report shows the time as well. */
export function formatDayTime(value: unknown): string {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${formatDay(value)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Buckets records by a key, sorted by group name.
 *
 * `fallback` names the bucket for records with no key — an empty group heading
 * reads as a rendering fault, and these rows must still be counted somewhere or
 * the grand total stops matching the row count.
 */
export function groupBy<T extends Record<string, unknown>>(
  rows: T[],
  key: (row: T) => string | null | undefined,
  fallback: string
): TemplateGroup[] {
  const buckets = new Map<string, T[]>();
  for (const row of rows) {
    const name = key(row)?.toString().trim() || fallback;
    const bucket = buckets.get(name);
    if (bucket) bucket.push(row);
    else buckets.set(name, [row]);
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, groupRows]) => ({
      name,
      rows: groupRows as unknown as Record<string, unknown>[],
    }));
}

/** A single flat block — for reports that are not grouped. */
export function flat(rows: Record<string, unknown>[]): TemplateGroup[] {
  return [{ name: "", rows }];
}
