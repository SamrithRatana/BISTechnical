/**
 * @file excelTemplate.ts
 * @description Loads an .xlsx template and fills it with report data.
 *
 * ## Why the layout lives in a file instead of in code
 *
 * Column order, headers, widths, fonts, fills and page setup are all defined in
 * `public/templates/*.xlsx`. Someone who needs a column moved, renamed or
 * dropped opens the file in Excel, edits it, saves — no rebuild, no developer.
 * That is the whole point: report layout is a business decision that changes
 * often, and routing every change through a code deploy is what made the old
 * reports hard to keep current.
 *
 * The code here knows only the *placeholder contract*, never the layout.
 *
 * ## The contract
 *
 *   {{title}} {{subtitle}}   scalar text, replaced in place
 *   {{group}}                prototype row, cloned once per group
 *   {{<field>}}              on the data prototype row: the record property to
 *                            print in that cell. Cell order = column order.
 *   {{subtotal}} {{count}}   prototype row, cloned once per group
 *   {{grandTotal}} {{total}} scalar
 *   {{summary}}              scalar
 *
 * Prototype rows are cloned for their *styling* and then removed, so they never
 * appear in the output. Change the fill on the data prototype and every data
 * row in every future report changes with it.
 */

import type { Workbook, Worksheet, Row } from "exceljs";

/** A record rendered as one row; values are read by placeholder name. */
export type TemplateRecord = Record<string, unknown>;

export interface TemplateGroup {
  name: string;
  rows: TemplateRecord[];
}

export interface FillTemplateOptions {
  templateUrl: string;
  title: string;
  subtitle?: string;
  groups: TemplateGroup[];
  /** Labels so the engine stays free of user-facing English. */
  labels: { subtotal: string; grandTotal: string };
  summary?: string;
  /** Formats a raw record value for display. */
  format?: (field: string, value: unknown) => string;
}

const PLACEHOLDER = /\{\{\s*([A-Za-z0-9_.]+)\s*\}\}/;

/** The placeholder token in a cell, or null when the cell holds ordinary text. */
function tokenOf(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = PLACEHOLDER.exec(value);
  return match ? match[1] : null;
}

/** First token found anywhere on a row — identifies prototype rows. */
function rowToken(row: Row): string | null {
  let found: string | null = null;
  row.eachCell({ includeEmpty: false }, (cell) => {
    if (found) return;
    const token = tokenOf(cell.value);
    if (token) found = token;
  });
  return found;
}

interface Prototypes {
  group?: number;
  data?: number;
  subtotal?: number;
}

/** Locates the prototype rows by their marker tokens. */
function findPrototypes(sheet: Worksheet): Prototypes {
  const found: Prototypes = {};
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const token = rowToken(row);
    if (token === "group" && found.group === undefined) found.group = rowNumber;
    else if (token === "subtotal" && found.subtotal === undefined) found.subtotal = rowNumber;
    else if (
      found.data === undefined &&
      token !== null &&
      !["title", "subtitle", "group", "subtotal", "count", "grandTotal", "total", "summary"].includes(
        token
      )
    ) {
      // Any row whose tokens are neither structural nor scalar is the data
      // prototype — so adding a column is just adding a {{field}} cell.
      found.data = rowNumber;
    }
  });
  return found;
}

/** The ordered field names on the data prototype: column order, from the file. */
function readFieldOrder(sheet: Worksheet, dataRowNumber: number): (string | null)[] {
  const row = sheet.getRow(dataRowNumber);
  const fields: (string | null)[] = [];
  const columnCount = sheet.columnCount;
  for (let c = 1; c <= columnCount; c++) {
    fields.push(tokenOf(row.getCell(c).value));
  }
  return fields;
}

function defaultFormat(_field: string, value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

/**
 * Loads the template, expands it against `groups`, and returns the workbook —
 * ready to render on screen or hand to the user as a download. One workbook
 * backs both, so what is displayed and what is exported cannot drift.
 */
/**
 * ExcelJS is CommonJS, and consumers disagree about where its exports land:
 * Node's ESM loader puts them under `.default`, while some bundler interop
 * hoists them onto the namespace. Reading the wrong one gives
 * "Workbook is not a constructor" — at runtime, on the user's click, long after
 * typechecking passed. Accept either shape once, here.
 */
async function loadExcelJS() {
  const mod = await import("exceljs");
  const candidate = mod as unknown as { default?: unknown };
  const resolved = (candidate.default ?? mod) as typeof mod;
  if (typeof resolved.Workbook !== "function") {
    throw new Error("ExcelJS failed to load: no Workbook constructor");
  }
  return resolved;
}

export async function fillTemplate({
  templateUrl,
  title,
  subtitle,
  groups,
  labels,
  summary,
  format = defaultFormat,
}: FillTemplateOptions): Promise<Workbook> {
  const ExcelJS = await loadExcelJS();

  const response = await fetch(templateUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Template ${templateUrl} could not be loaded (${response.status})`);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await response.arrayBuffer());

  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("Template contains no worksheet");

  const prototypes = findPrototypes(sheet);
  if (prototypes.data === undefined) {
    throw new Error("Template has no data prototype row (a row of {{field}} cells)");
  }

  const fields = readFieldOrder(sheet, prototypes.data);
  const totalRecords = groups.reduce((sum, g) => sum + g.rows.length, 0);

  /**
   * Rows are generated top-down and spliced in one block, then the prototypes
   * are deleted in a single pass.
   *
   * Deleting as we go would invalidate every row number captured above —
   * ExcelJS renumbers on splice — and the resulting off-by-one lands rows on
   * top of the grand total. Collect first, mutate once.
   */
  const generated: { kind: "group" | "data" | "subtotal"; values: (string | number)[] }[] = [];

  for (const group of groups) {
    // An empty name means the report is not grouped (spare-part usage, the
    // engineer summary): emit the rows flat rather than a blank banner row.
    if (group.name) generated.push({ kind: "group", values: [group.name] });

    for (const record of group.rows) {
      generated.push({
        kind: "data",
        values: fields.map((field) => (field ? format(field, record[field]) : "")),
      });
    }

    // A subtotal under an ungrouped block would just restate the grand total.
    if (group.name) {
      generated.push({
        kind: "subtotal",
        values: (() => {
          const values: (string | number)[] = new Array(fields.length).fill("");
          values[Math.max(0, fields.length - 2)] = labels.subtotal;
          values[fields.length - 1] = group.rows.length;
          return values;
        })(),
      });
    }
  }

  const styleSource: Record<string, number> = {
    group: prototypes.group ?? prototypes.data,
    data: prototypes.data,
    subtotal: prototypes.subtotal ?? prototypes.data,
  };

  // Remove existing prototype merges from the sheet model so they don't corrupt target rows
  const minProto = Math.min(
    ...[prototypes.group, prototypes.data, prototypes.subtotal].filter((n): n is number => typeof n === "number")
  );
  const internalMerges = (sheet as unknown as { _merges?: Record<string, { model?: { top: number }; top?: number }> })._merges;
  if (internalMerges && typeof internalMerges === "object") {
    for (const k of Object.keys(internalMerges)) {
      const top = internalMerges[k]?.model?.top ?? internalMerges[k]?.top;
      if (top !== undefined && top >= minProto) {
        delete internalMerges[k];
      }
    }
  }

  /**
   * Insert *below every prototype*, not below the data prototype.
   */
  const insertAt =
    Math.max(prototypes.group ?? 0, prototypes.data, prototypes.subtotal ?? 0) + 1;

  const groupTargets: number[] = [];

  generated.forEach((entry, index) => {
    const target = insertAt + index;
    const inserted = sheet.insertRow(target, [], "i");
    const source = sheet.getRow(styleSource[entry.kind]);
    inserted.height = source.height;
    for (let c = 1; c <= Math.max(fields.length, entry.values.length); c++) {
      const cell = inserted.getCell(c);
      cell.style = { ...source.getCell(c).style };
      const value = entry.values[c - 1];
      cell.value = value === undefined || value === "" ? null : value;
    }
    if (entry.kind === "group") {
      groupTargets.push(target);
    }
  });

  // Scalars, after insertion so the rows have moved to their final positions.
  sheet.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      const token = tokenOf(cell.value);
      if (!token) return;
      if (token === "title") cell.value = title;
      else if (token === "subtitle") cell.value = subtitle ?? "";
      else if (token === "grandTotal") cell.value = labels.grandTotal;
      else if (token === "total") cell.value = totalRecords;
      else if (token === "summary") cell.value = summary ?? "";
    });
  });

  // Remove the prototypes last, bottom-up so earlier indices stay valid.
  const prototypeRows = [prototypes.group, prototypes.data, prototypes.subtotal]
    .filter((n): n is number => typeof n === "number")
    .sort((a, b) => b - a);
  for (const rowNumber of prototypeRows) sheet.spliceRows(rowNumber, 1);

  // Now apply mergeCells on the final group row positions!
  const offset = prototypeRows.length;
  for (const origTarget of groupTargets) {
    const finalRow = origTarget - offset;
    try {
      sheet.mergeCells(finalRow, 1, finalRow, Math.max(1, fields.length));
    } catch {
      // Ignore if already merged
    }
  }

  return workbook;
}

/**
 * Hands the finished workbook to the user as a download.
 *
 * Two things here are deliberate and were both wrong before:
 *
 * 1. **The object URL is revoked on a later task, not on the next line.** A
 *    click-initiated download is asynchronous — the browser reads the blob
 *    after the handler returns — so revoking in the same tick races the read
 *    it is meant to feed. It survives for a small workbook because the read
 *    wins; a monthly report with a few hundred rows is exactly where it does
 *    not, and the failure is silent: no error, no file, a button that looks
 *    like it worked.
 *
 * 2. **The anchor is in the document when it is clicked.** A detached `<a>`
 *    happens to work in Chromium; Firefox ignores the click entirely, so
 *    export did nothing at all there.
 *
 * The blob is held until the revoke fires. That is the point — releasing it
 * early is the bug — and one workbook for one task is not a leak.
 */
export async function downloadWorkbook(workbook: Workbook, fileName: string): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileName}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Long enough for the browser to have taken the blob, short enough that the
  // memory is not held for the rest of the session.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
