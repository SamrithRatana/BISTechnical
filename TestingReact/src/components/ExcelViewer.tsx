"use client";

/**
 * @file ExcelViewer.tsx
 * @description Renders a real ExcelJS worksheet as HTML — merges, fonts,
 * alignment, column widths and row heights all read from the workbook.
 *
 * Nothing here decides how a report looks. Every visual decision comes from the
 * .xlsx: change a fill in Excel, save, reload, and the screen changes with it.
 *
 * ## Two viewing modes
 *
 * By default the sheet renders **plain** — no cell borders, no fills, no font
 * colours — and scaled to fit the width of its container. A report is read
 * first to answer "what are the numbers", and at that moment a full grid of
 * lines and coloured bands is noise that pushes half the columns off-screen.
 * Structure survives without it: bold still marks headers and totals, and
 * alignment still separates text from figures.
 *
 * Ticking "border lines and colours" restores exactly what the template
 * specifies, which is what you want when checking the document against the
 * printed or exported version.
 *
 * ## Why CSS `zoom` and not `transform: scale()`
 *
 * `transform` creates a containing block, which breaks `position: sticky` — the
 * frozen header and row gutter would scroll away with the body, and the frozen
 * header is the single most useful thing about a long report. `zoom` scales
 * layout without that side effect, so the header stays pinned at every size.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Worksheet, Cell, Borders } from "exceljs";
import {
  Minus,
  Plus,
  Maximize2,
  Minimize2,
  RotateCcw,
  FileSpreadsheet,
  X
} from "lucide-react";
import { useI18n } from "@/i18n/LanguageProvider";

/** "FF1E3A5F" → "#1E3A5F"; ExcelJS puts alpha first. */
function argbToCss(argb?: string): string | undefined {
  if (!argb) return undefined;
  const hex = argb.length === 8 ? argb.slice(2) : argb;
  return `#${hex}`;
}

/** Excel column width is ~characters; converts to balanced rendering px fitting standard screens at 100% zoom. */
function widthToPx(width: number | undefined): number {
  return Math.round((width ?? 12) * 6.5 + 10);
}

/** Row height arrives in points. */
function heightToPx(height: number | undefined): number {
  return height ? Math.round(height * 1.333) : 26;
}

/** "A1" → { row, col }. */
function parseRef(ref: string): { row: number; col: number } {
  const match = /^([A-Z]+)(\d+)$/.exec(ref);
  if (!match) return { row: 1, col: 1 };
  let col = 0;
  for (const char of match[1]) col = col * 26 + (char.charCodeAt(0) - 64);
  return { row: Number(match[2]), col };
}

interface Span {
  rowspan: number;
  colspan: number;
}

/**
 * Merge ranges, as a lookup of master cells plus the set of cells they swallow.
 */
function readMerges(sheet: Worksheet): { spans: Map<string, Span>; covered: Set<string> } {
  const spans = new Map<string, Span>();
  const covered = new Set<string>();

  // 1. Read sheet._merges (live merge collection in ExcelJS)
  const internalMerges = (
    sheet as unknown as {
      _merges?: Record<
        string,
        {
          model?: { top: number; left: number; bottom: number; right: number };
          top?: number;
          left?: number;
          bottom?: number;
          right?: number;
        }
      >;
    }
  )._merges;

  if (internalMerges && typeof internalMerges === "object") {
    for (const key of Object.keys(internalMerges)) {
      const m = internalMerges[key];
      const top = m.model?.top ?? m.top;
      const left = m.model?.left ?? m.left;
      const bottom = m.model?.bottom ?? m.bottom;
      const right = m.model?.right ?? m.right;
      if (top && left && bottom && right) {
        spans.set(`${top}:${left}`, {
          rowspan: bottom - top + 1,
          colspan: right - left + 1
        });
        for (let r = Number(top); r <= Number(bottom); r++) {
          for (let c = Number(left); c <= Number(right); c++) {
            if (r === Number(top) && c === Number(left)) continue;
            covered.add(`${r}:${c}`);
          }
        }
      }
    }
  }

  // 2. Read cell.isMerged & cell.master from all cells as guaranteed source of truth
  sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      if (cell.isMerged && cell.master) {
        const master = cell.master as unknown as { row?: number | string; col?: number | string };
        if (Number(master?.row) === rowNumber && Number(master?.col) === colNumber) {
          if (!spans.has(`${rowNumber}:${colNumber}`)) {
            spans.set(`${rowNumber}:${colNumber}`, { rowspan: 1, colspan: 1 });
          }
        } else {
          covered.add(`${rowNumber}:${colNumber}`);
        }
      }
    });
  });

  // 3. Fallback to sheet.model.merges if spans is empty
  if (spans.size === 0) {
    const model = sheet.model as unknown as { merges?: string[] };
    for (const range of model.merges ?? []) {
      const [fromRef, toRef] = range.split(":");
      if (!toRef) continue;
      const from = parseRef(fromRef);
      const to = parseRef(toRef);

      spans.set(`${from.row}:${from.col}`, {
        rowspan: to.row - from.row + 1,
        colspan: to.col - from.col + 1
      });

      for (let r = from.row; r <= to.row; r++) {
        for (let c = from.col; c <= to.col; c++) {
          if (r === from.row && c === from.col) continue;
          covered.add(`${r}:${c}`);
        }
      }
    }
  }

  return { spans, covered };
}

/** Renders whatever ExcelJS hands back for a cell value as display text. */
function cellText(value: Cell["value"]): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(value.getDate())}/${pad(value.getMonth() + 1)}/${value.getFullYear()}`;
  }
  if (typeof value === "object") {
    const rich = value as { richText?: { text: string }[]; result?: unknown; text?: string };
    if (rich.richText) return rich.richText.map((part) => part.text).join("");
    if (rich.result !== undefined) return String(rich.result);
    if (rich.text !== undefined) return rich.text;
    return "";
  }
  return String(value);
}

const BORDER_WIDTH: Record<string, string> = {
  thin: "1px",
  medium: "2px",
  thick: "3px",
  hair: "1px"
};

function borderCss(border: Partial<Borders> | undefined, side: keyof Borders): string | undefined {
  const edge = border?.[side] as { style?: string; color?: { argb?: string } } | undefined;
  if (!edge?.style) return undefined;
  const width = BORDER_WIDTH[edge.style] ?? "1px";
  const color = argbToCss(edge.color?.argb) ?? "#cbd5e1";
  const style = edge.style === "dotted" || edge.style === "dashed" ? edge.style : "solid";
  return `${width} ${style} ${color}`;
}

/** Minimum zoom limit allowing wide multi-column reports to fit on compact displays. */
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.0;
const ZOOM_STEP = 0.05;

/** 0 → "A", 1 → "B", 25 → "Z", 26 → "AA", etc. */
function columnLetter(index: number): string {
  let letter = "";
  let temp = index;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

interface ExcelViewerProps {
  sheet: Worksheet;
  className?: string;
  showGrid?: boolean;
  title?: string;
  extraActions?: React.ReactNode;
}

export default function ExcelViewer({
  sheet,
  className = "",
  showGrid = false,
  title,
  extraActions
}: ExcelViewerProps) {
  const { t } = useI18n();
  const { spans, covered } = useMemo(() => readMerges(sheet), [sheet]);

  /** Off by default — see the file comment. */
  const [showStyles, setShowStyles] = useState(false);
  /** Fullscreen viewer toggle */
  const [isFullscreen, setIsFullscreen] = useState(false);
  /** null means "fit to width"; a number is an explicit user choice. */
  const [manualZoom, setManualZoom] = useState<number | null>(null);
  const [fitZoom, setFitZoom] = useState(1);

  const containerRef = useRef<HTMLDivElement>(null);
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);

  // Accurately calculate column count across all defined rows
  const columnCount = useMemo(() => {
    let maxCols = Math.max(1, sheet.columnCount || 0);
    sheet.eachRow({ includeEmpty: false }, (row) => {
      if (row.actualCellCount > maxCols) maxCols = row.actualCellCount;
      if (row.cellCount > maxCols) maxCols = row.cellCount;
    });
    return maxCols;
  }, [sheet]);

  const rowCount = Math.max(1, sheet.rowCount);
  const gutterWidth = Math.max(36, String(rowCount).length * 8 + 16);

  const widths = useMemo(
    () => Array.from({ length: columnCount }, (_, i) => widthToPx(sheet.getColumn(i + 1)?.width)),
    [sheet, columnCount]
  );

  /**
   * Natural width calculated from accurate pixel column widths.
   */
  const naturalWidth = useMemo(() => {
    const colsWidth = widths.reduce((sum, w) => sum + w, 0);
    return showGrid ? colsWidth + gutterWidth : colsWidth;
  }, [widths, showGrid, gutterWidth]);

  /**
   * Recalculates the optimal zoom scale so that the report table fits
   * precisely within the user's container/screen resolution without horizontal scroll.
   */
  const recomputeFit = useCallback(() => {
    const element = isFullscreen ? fullscreenContainerRef.current : containerRef.current;
    if (!element || naturalWidth <= 0) return;
    const available = element.clientWidth;
    if (!available || available <= 0) return;

    // Available space minus comfortable padding and scrollbar buffer
    const padding = isFullscreen ? 48 : 32;
    const targetWidth = Math.max(150, available - padding);

    // Calculate the exact zoom ratio needed to fit all columns
    const calculatedZoom = targetWidth / naturalWidth;
    // Cap at 1.0 (100%) so small tables aren't unnaturally stretched, but scale down as needed
    const newFit = Math.min(1, Math.max(MIN_ZOOM, Math.floor(calculatedZoom * 100) / 100));

    setFitZoom(newFit);
  }, [naturalWidth, isFullscreen]);

  // Observe container size and window resize changes to automatically fit the resolution
  useEffect(() => {
    const timer = setTimeout(recomputeFit, 60);

    const element = isFullscreen ? fullscreenContainerRef.current : containerRef.current;
    if (!element) return () => clearTimeout(timer);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => {
        recomputeFit();
      });
      observer.observe(element);
    }

    window.addEventListener("resize", recomputeFit);

    return () => {
      clearTimeout(timer);
      observer?.disconnect();
      window.removeEventListener("resize", recomputeFit);
    };
  }, [recomputeFit, isFullscreen, sheet]);

  // Handle ESC key to exit fullscreen and prevent background scrolling
  useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isFullscreen]);

  const zoom = manualZoom ?? fitZoom;
  const plainBorder = showStyles ? undefined : "none";
  const buttonClass =
    "rounded-md p-1.5 text-ink-secondary transition-colors hover:bg-sunken disabled:opacity-40 ";

  const renderTable = () => (
    <table
      className="border-collapse mb-10"
      style={{
        tableLayout: "fixed",
        width: naturalWidth,
        minWidth: naturalWidth
      }}
    >
      <colgroup>
        {showGrid && <col style={{ width: gutterWidth }} />}
        {widths.map((width, i) => (
          <col key={i} style={{ width }} />
        ))}
      </colgroup>

      {showGrid && (
        <thead>
          <tr>
            <th
              className="border border-prominent bg-sunken text-[10px] font-normal text-ink-secondary "
              style={{ width: gutterWidth }}
            />
            {widths.map((_, i) => (
              <th
                key={i}
                className="border border-prominent bg-sunken px-1 py-0.5 text-center text-[10px] font-normal text-ink-secondary "
              >
                {columnLetter(i)}
              </th>
            ))}
          </tr>
        </thead>
      )}

      <tbody>
        {Array.from({ length: rowCount }, (_, rowIndex) => {
          const rowNumber = rowIndex + 1;
          const row = sheet.getRow(rowNumber);

          return (
            <tr key={rowNumber} style={{ height: heightToPx(row?.height) }}>
              {showGrid && (
                <td
                  className="border border-prominent bg-sunken text-center align-middle text-[10px] tabular-nums text-ink-muted "
                  style={{ width: gutterWidth }}
                >
                  {rowNumber}
                </td>
              )}

              {Array.from({ length: columnCount }, (_, colIndex) => {
                const colNumber = colIndex + 1;
                const key = `${rowNumber}:${colNumber}`;
                if (covered.has(key)) return null;

                const span = spans.get(key);
                const cell = row.getCell(colNumber);
                const font = cell.font;
                const fill = cell.fill as
                  | { type?: string; fgColor?: { argb?: string } }
                  | undefined;
                const alignment = cell.alignment;
                const isTitle = rowNumber === 1;
                const isSubtitle = rowNumber === 2;
                const isHeaderRow = rowNumber === 4;
                const isGroupRow = Boolean(span?.colspan && span.colspan > 1 && rowNumber > 4);

                // Plain mode keeps weight, size and alignment — drops all borders, fills and sticky freeze
                const background =
                  showStyles && fill?.type === "pattern"
                    ? (argbToCss(fill.fgColor?.argb) ?? "transparent")
                    : "transparent";

                const calculatedFontSize = font?.size
                  ? `${font.size}px`
                  : isTitle
                  ? "16px"
                  : isSubtitle
                  ? "12px"
                  : isHeaderRow || isGroupRow
                  ? "13px"
                  : "12.5px";

                const calculatedFontWeight = font?.bold || isTitle || isHeaderRow || isGroupRow ? 700 : 400;

                const cellPadding = isTitle
                  ? "8px 4px 2px"
                  : isSubtitle
                  ? "0 4px 10px"
                  : isGroupRow
                  ? "12px 8px 4px"
                  : isHeaderRow
                  ? "6px 8px"
                  : "5px 8px";

                const cellBorderTop = showStyles ? borderCss(cell.border, "top") : undefined;
                const cellBorderLeft = showStyles ? borderCss(cell.border, "left") : undefined;
                const cellBorderBottom = showStyles ? borderCss(cell.border, "bottom") : undefined;
                const cellBorderRight = showStyles ? borderCss(cell.border, "right") : undefined;

                return (
                  <td
                    key={colNumber}
                    colSpan={span?.colspan}
                    rowSpan={span?.rowspan}
                    style={{
                      backgroundColor: background,
                      color: showStyles
                        ? (argbToCss(font?.color?.argb) ?? "inherit")
                        : isSubtitle
                        ? "#64748b"
                        : "inherit",
                      fontWeight: calculatedFontWeight,
                      fontStyle: font?.italic || isSubtitle ? "italic" : undefined,
                      fontSize: calculatedFontSize,
                      lineHeight: "1.35",
                      textAlign:
                        (alignment?.horizontal as React.CSSProperties["textAlign"]) ??
                        (isTitle || isSubtitle ? "center" : "left"),
                      verticalAlign: isTitle || isSubtitle ? "middle" : isHeaderRow ? "bottom" : "top",
                      whiteSpace:
                        isGroupRow || isTitle || isSubtitle || alignment?.wrapText || colNumber === 3 || colNumber === 4
                          ? "normal"
                          : "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      wordBreak: "break-word",
                      padding: cellPadding,
                      borderTop: cellBorderTop,
                      borderLeft: cellBorderLeft,
                      borderBottom: cellBorderBottom,
                      borderRight: cellBorderRight
                    }}
                  >
                    {cellText(cell.value)}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  return (
    <>
      <div className={`flex flex-col h-full w-full rounded-2xl border border-subtle/90 shadow-sm overflow-hidden bg-white ${className}`}>
        {/* ── Standard View Controls ────────────────────────────────────────── */}
        <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 border-b border-subtle bg-cushion/50 px-3 py-1.5 print:hidden">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex min-h-6 cursor-pointer items-center gap-2 text-xs font-medium text-ink-secondary hover:text-ink transition-colors">
              <input
                type="checkbox"
                checked={showStyles}
                onChange={(e) => setShowStyles(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-prominent accent-purple-600 cursor-pointer"
              />
              {t("report.showStyles")}
            </label>

            {extraActions && (
              <>
                <div className="h-4 w-px bg-sunken hidden sm:block" />
                <div className="flex items-center gap-2">
                  {extraActions}
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setManualZoom(Math.max(MIN_ZOOM, Math.round((zoom - ZOOM_STEP) * 100) / 100))}
              disabled={zoom <= MIN_ZOOM}
              title={t("report.zoomOut")}
              aria-label={t("report.zoomOut")}
              className={buttonClass}
            >
              <Minus className="h-3.5 w-3.5" />
            </button>

            <span className="w-11 text-center text-[11px] font-mono tabular-nums text-ink-secondary ">
              {Math.round(zoom * 100)}%
            </span>

            <button
              type="button"
              onClick={() => setManualZoom(Math.min(MAX_ZOOM, Math.round((zoom + ZOOM_STEP) * 100) / 100))}
              disabled={zoom >= MAX_ZOOM}
              title={t("report.zoomIn")}
              aria-label={t("report.zoomIn")}
              className={buttonClass}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={() => {
                setManualZoom(null);
                recomputeFit();
              }}
              title={t("report.fitWidth")}
              aria-label={t("report.fitWidth")}
              className={`${buttonClass} ${manualZoom === null ? "bg-sunken text-ink " : ""}`}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>

            <div className="h-3.5 w-px bg-sunken mx-0.5" />

            <button
              type="button"
              onClick={() => setIsFullscreen(true)}
              title={t("report.fullscreen")}
              aria-label={t("report.fullscreen")}
              className={`${buttonClass} text-accent hover:bg-accent-soft hover:text-accent-hover`}
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* ── Standard View Container ───────────────────────────────────────── */}
        <div
          ref={containerRef}
          className={`flex-1 min-h-0 overflow-auto p-4 pb-16 rounded-b-2xl overscroll-contain print:overflow-visible print:p-0 ${
            showStyles ? "bg-sunken " : "bg-white "
          }`}
        >
          <div
            className={`inline-block min-w-full pb-8 ${showStyles ? "bg-white shadow-lg print:shadow-none" : ""}`}
            // `zoom`, not `transform` — transform would break the sticky header.
            style={{ zoom }}
          >
            {renderTable()}
          </div>
        </div>
      </div>

      {/* ── Fullscreen Modal View ─────────────────────────────────────────── */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 flex flex-col av-scrim p-2 sm:p-4 md:p-6 animate-in fade-in duration-200">
          <div className="flex flex-col h-full w-full max-w-[98vw] mx-auto bg-white rounded-2xl shadow-2xl border border-subtle overflow-hidden">
            {/* Fullscreen Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-subtle bg-cushion/90 px-4 py-2.5 backdrop-blur-sm">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-success-soft text-success ">
                    <FileSpreadsheet className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-semibold text-ink ">
                    {title || sheet.name || "Excel Report"}
                  </span>
                  <span className="hidden sm:inline-flex items-center rounded-md bg-sunken/70 px-2 py-0.5 text-[11px] font-medium text-ink-secondary ">
                    {rowCount} rows × {columnCount} cols
                  </span>
                </div>

                <div className="h-4 w-px bg-sunken hidden sm:block" />

                <label className="flex min-h-6 cursor-pointer items-center gap-2 text-xs font-medium text-ink-secondary hover:text-ink transition-colors">
                  <input
                    type="checkbox"
                    checked={showStyles}
                    onChange={(e) => setShowStyles(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-prominent accent-purple-600 cursor-pointer"
                  />
                  {t("report.showStyles")}
                </label>

                {extraActions && (
                  <>
                    <div className="h-4 w-px bg-sunken hidden sm:block" />
                    <div className="flex items-center gap-2">
                      {extraActions}
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setManualZoom(Math.max(MIN_ZOOM, Math.round((zoom - ZOOM_STEP) * 100) / 100))}
                  disabled={zoom <= MIN_ZOOM}
                  title={t("report.zoomOut")}
                  aria-label={t("report.zoomOut")}
                  className={buttonClass}
                >
                  <Minus className="h-4 w-4" />
                </button>

                <span className="w-12 text-center text-xs font-mono font-medium text-ink-secondary ">
                  {Math.round(zoom * 100)}%
                </span>

                <button
                  type="button"
                  onClick={() => setManualZoom(Math.min(MAX_ZOOM, Math.round((zoom + ZOOM_STEP) * 100) / 100))}
                  disabled={zoom >= MAX_ZOOM}
                  title={t("report.zoomIn")}
                  aria-label={t("report.zoomIn")}
                  className={buttonClass}
                >
                  <Plus className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setManualZoom(null);
                    recomputeFit();
                  }}
                  title={t("report.fitWidth")}
                  aria-label={t("report.fitWidth")}
                  className={`${buttonClass} ${manualZoom === null ? "bg-sunken text-ink " : ""}`}
                >
                  <RotateCcw className="h-4 w-4" />
                </button>

                <div className="h-4 w-px bg-sunken mx-1" />

                <button
                  type="button"
                  onClick={() => setIsFullscreen(false)}
                  title={t("report.exitFullscreen")}
                  aria-label={t("report.exitFullscreen")}
                  className="flex items-center gap-1.5 rounded-lg bg-sunken hover:bg-sunken px-3 py-1.5 text-xs font-medium text-ink transition-colors"
                >
                  <Minimize2 className="h-3.5 w-3.5" />
                  <span>{t("report.exitFullscreen")}</span>
                  <kbd className="hidden sm:inline-block ml-1 rounded bg-sunken/70 px-1.5 py-0.5 text-[10px] font-mono text-ink-secondary ">ESC</kbd>
                </button>

                <button
                  type="button"
                  onClick={() => setIsFullscreen(false)}
                  className="ml-1 rounded-lg p-1.5 text-ink-muted hover:bg-sunken hover:text-ink-secondary transition-colors"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Fullscreen Table Scroll Area */}
            <div
              ref={fullscreenContainerRef}
              className={`flex-1 overflow-auto p-4 md:p-6 pb-20 ${
                showStyles ? "bg-sunken " : "bg-sunken/70 "
              }`}
            >
              <div
                className={`inline-block min-w-full ${showStyles ? "bg-white shadow-xl" : "bg-white rounded-lg shadow-sm"}`}
                style={{ zoom }}
              >
                {renderTable()}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
