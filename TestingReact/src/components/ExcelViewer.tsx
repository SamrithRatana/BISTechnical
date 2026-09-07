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
import { createPortal } from "react-dom";
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
import { cn } from "@/lib/utils";

const STATUS_BADGE_MAP: Record<string, { bg: string; text: string; border: string }> = {
  active: { bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200/70 dark:border-emerald-800/60" },
  completed: { bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200/70 dark:border-emerald-800/60" },
  finished: { bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200/70 dark:border-emerald-800/60" },
  delivered: { bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200/70 dark:border-emerald-800/60" },
  fixed: { bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200/70 dark:border-emerald-800/60" },
  "រួចរាល់": { bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200/70 dark:border-emerald-800/60" },
  "បានប្រគល់": { bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200/70 dark:border-emerald-800/60" },
  "សកម្ម": { bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200/70 dark:border-emerald-800/60" },

  "in progress": { bg: "bg-amber-50 dark:bg-amber-950/40", text: "text-amber-700 dark:text-amber-300", border: "border-amber-200/70 dark:border-amber-800/60" },
  repairing: { bg: "bg-amber-50 dark:bg-amber-950/40", text: "text-amber-700 dark:text-amber-300", border: "border-amber-200/70 dark:border-amber-800/60" },
  inspecting: { bg: "bg-sky-50 dark:bg-sky-950/40", text: "text-sky-700 dark:text-sky-300", border: "border-sky-200/70 dark:border-sky-800/60" },
  "កំពុងជួសជុល": { bg: "bg-amber-50 dark:bg-amber-950/40", text: "text-amber-700 dark:text-amber-300", border: "border-amber-200/70 dark:border-amber-800/60" },
  "កំពុងត្រួតពិនិត្យ": { bg: "bg-sky-50 dark:bg-sky-950/40", text: "text-sky-700 dark:text-sky-300", border: "border-sky-200/70 dark:border-sky-800/60" },
  "awaiting customer confirm": { bg: "bg-amber-50 dark:bg-amber-950/40", text: "text-amber-700 dark:text-amber-300", border: "border-amber-200/70 dark:border-amber-800/60" },
  "រង់ចាំអតិថិជនយល់ព្រម": { bg: "bg-amber-50 dark:bg-amber-950/40", text: "text-amber-700 dark:text-amber-300", border: "border-amber-200/70 dark:border-amber-800/60" },

  "not invoiced": { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-600 dark:text-slate-300", border: "border-slate-200/80 dark:border-slate-700" },
  received: { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-600 dark:text-slate-300", border: "border-slate-200/80 dark:border-slate-700" },
  pending: { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-600 dark:text-slate-300", border: "border-slate-200/80 dark:border-slate-700" },
  "មិនទាន់ទូទាត់": { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-600 dark:text-slate-300", border: "border-slate-200/80 dark:border-slate-700" },
  "បានទទួល": { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-600 dark:text-slate-300", border: "border-slate-200/80 dark:border-slate-700" },
  "រង់ចាំ": { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-600 dark:text-slate-300", border: "border-slate-200/80 dark:border-slate-700" },

  rejected: { bg: "bg-rose-50 dark:bg-rose-950/40", text: "text-rose-700 dark:text-rose-300", border: "border-rose-200/70 dark:border-rose-800/60" },
  "customer rejected": { bg: "bg-rose-50 dark:bg-rose-950/40", text: "text-rose-700 dark:text-rose-300", border: "border-rose-200/70 dark:border-rose-800/60" },
  unrepairable: { bg: "bg-rose-50 dark:bg-rose-950/40", text: "text-rose-700 dark:text-rose-300", border: "border-rose-200/70 dark:border-rose-800/60" },
  "មិនអាចជួសជុលបាន": { bg: "bg-rose-50 dark:bg-rose-950/40", text: "text-rose-700 dark:text-rose-300", border: "border-rose-200/70 dark:border-rose-800/60" },
  "អតិថិជនបដិសេធ": { bg: "bg-rose-50 dark:bg-rose-950/40", text: "text-rose-700 dark:text-rose-300", border: "border-rose-200/70 dark:border-rose-800/60" },
};

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
  defaultShowStyles?: boolean;
}

export default function ExcelViewer({
  sheet,
  className = "",
  showGrid = false,
  title,
  extraActions,
  defaultShowStyles = false,
}: ExcelViewerProps) {
  const { t } = useI18n();
  const { spans, covered } = useMemo(() => readMerges(sheet), [sheet]);

  /** Default to false: Modern Soft layout with subtle lines and header accents */
  const [showStyles, setShowStyles] = useState(defaultShowStyles);
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
   * Precompute semantic role of each row to apply Modern Soft styling when !showStyles
   */
  const rowMeta = useMemo(() => {
    const meta: Record<
      number,
      {
        isTitle: boolean;
        isSubtitle: boolean;
        isBlank: boolean;
        isHeader: boolean;
        isGroup: boolean;
        isTotal: boolean;
        isSummary: boolean;
        isData: boolean;
      }
    > = {};

    for (let r = 1; r <= rowCount; r++) {
      const isTitle = r === 1;
      const isSubtitle = r === 2;
      const isBlank = r === 3;
      const isHeader = r === 4;

      if (isTitle || isSubtitle || isBlank || isHeader) {
        meta[r] = {
          isTitle,
          isSubtitle,
          isBlank,
          isHeader,
          isGroup: false,
          isTotal: false,
          isSummary: false,
          isData: false,
        };
        continue;
      }

      const row = sheet.getRow(r);
      let rowJoinedText = "";
      let cellCount = 0;
      row.eachCell({ includeEmpty: false }, (cell) => {
        rowJoinedText += " " + String(cell.value || "");
        cellCount++;
      });
      const lower = rowJoinedText.toLowerCase().trim();

      const isTotal =
        lower.includes("grand total") ||
        lower.includes("total") ||
        lower.includes("សរុបទាំងអស់") ||
        lower.includes("សរុប");

      const isSummary =
        !isTotal &&
        (lower.includes("breakdown") ||
          lower.includes("summary") ||
          lower.includes("engineer count") ||
          lower.includes("សម្គាល់"));

      const span = spans.get(`${r}:1`);
      const isGroup = Boolean(!isTotal && !isSummary && span && span.colspan > 2);
      const isData = !isTotal && !isSummary && !isGroup && cellCount > 0;

      meta[r] = {
        isTitle: false,
        isSubtitle: false,
        isBlank: false,
        isHeader: false,
        isGroup,
        isTotal,
        isSummary,
        isData,
      };
    }

    return meta;
  }, [sheet, rowCount, spans]);


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

  const handleExitFullscreen = useCallback(() => {
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    setIsFullscreen(false);
  }, []);

  const handleEnterFullscreen = useCallback(() => {
    setIsFullscreen(true);
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }, []);

  // Handle ESC key and fullscreenchange to exit fullscreen and prevent background scrolling
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        handleExitFullscreen();
      }
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    window.addEventListener("keydown", handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    if (isFullscreen) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isFullscreen, handleExitFullscreen]);

  const zoom = manualZoom ?? fitZoom;
  const buttonClass =
    "rounded-md p-1.5 text-ink-secondary transition-colors hover:bg-sunken disabled:opacity-40 ";

  const reportTitle = useMemo(() => {
    const raw = sheet.getRow(1).getCell(1).value;
    const text = cellText(raw).trim();
    return text || title || sheet.name || "Report";
  }, [sheet, title]);

  const reportSubtitle = useMemo(() => {
    const raw = sheet.getRow(2).getCell(1).value;
    return cellText(raw).trim();
  }, [sheet]);

  const [timestamp, setTimestamp] = useState<{ time: string; date: string }>({
    time: "",
    date: ""
  });

  useEffect(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    let hours = now.getHours();
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;
    const time = `${pad(hours)}:${pad(now.getMinutes())} ${ampm}`;
    const date = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
    setTimestamp({ time, date });
  }, []);

  const cardHeaderElement = useMemo(() => (
    <div className="flex items-start justify-between pb-6 pt-2 px-2 border-b border-slate-100 dark:border-slate-800/80 mb-4 select-none">
      {/* Top Left: Timestamp matching reference image */}
      <div className="text-left text-xs text-slate-400 dark:text-slate-500 font-normal leading-tight tabular-nums">
        <div>{timestamp.time || "08:43 AM"}</div>
        <div>{timestamp.date || "07/09/2026"}</div>
      </div>

      {/* Center: Company Name, Report Title, Subtitle */}
      <div className="flex-1 text-center px-4">
        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
          CAM Professional Technology Co., Ltd.
        </h2>
        <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-1">
          {reportTitle}
        </div>
        {reportSubtitle ? (
          <div className="text-xs italic text-slate-500 dark:text-slate-400 mt-0.5">
            {reportSubtitle}
          </div>
        ) : null}
      </div>

      {/* Right spacer for symmetrical centering */}
      <div className="w-16 hidden sm:block" />
    </div>
  ), [timestamp, reportTitle, reportSubtitle]);

  /**
   * The rendered sheet, built once per sheet/appearance change.
   */
  const tableElement = useMemo(() => (
    <table
      className={cn(
        "border-collapse transition-colors",
        !showStyles ? "w-full min-w-full" : "mb-10",
        !showStyles && "bg-white dark:bg-slate-900 rounded-xl"
      )}
      style={{
        tableLayout: "fixed",
        width: !showStyles ? "100%" : naturalWidth,
        minWidth: !showStyles ? (naturalWidth > 0 ? `${naturalWidth}px` : "100%") : naturalWidth
      }}
    >
      <colgroup>
        {showGrid && <col style={{ width: gutterWidth }} />}
        {widths.map((width, i) => {
          const pct = naturalWidth > 0 ? (width / naturalWidth) * 100 : 100 / columnCount;
          return (
            <col
              key={i}
              style={{
                width: !showStyles ? `${pct}%` : width,
              }}
            />
          );
        })}
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
          const meta = rowMeta[rowNumber] ?? {
            isTitle: rowNumber === 1,
            isSubtitle: rowNumber === 2,
            isBlank: rowNumber === 3,
            isHeader: rowNumber === 4,
            isGroup: false,
            isTotal: false,
            isSummary: false,
            isData: rowNumber > 4,
          };

          if (!showStyles && (meta.isTitle || meta.isSubtitle || meta.isBlank)) {
            return null;
          }

          return (
            <tr
              key={rowNumber}
              className={cn(
                "transition-colors",
                !showStyles && meta.isData && "hover:bg-slate-50/75 dark:hover:bg-slate-800/40"
              )}
              style={{ height: heightToPx(row?.height) }}
            >
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

                // ── Background ────────────────────────────────────────────────
                let background = "transparent";
                if (showStyles && fill?.type === "pattern") {
                  background = argbToCss(fill.fgColor?.argb) ?? "transparent";
                } else if (!showStyles) {
                  if (meta.isHeader) {
                    background = "#f8fafc"; // Subtle header tint matching reference
                  } else if (meta.isGroup) {
                    background = "rgba(241, 245, 249, 0.75)";
                  } else if (meta.isTotal) {
                    background = "#f1f5f9"; // Soft blue-slate total row
                  } else if (meta.isSummary) {
                    background = "rgba(248, 250, 252, 0.75)";
                  }
                }

                // ── Borders ───────────────────────────────────────────────────
                let cellBorderTop: string | undefined;
                let cellBorderBottom: string | undefined;
                let cellBorderLeft: string | undefined;
                let cellBorderRight: string | undefined;

                if (showStyles) {
                  cellBorderTop = borderCss(cell.border, "top");
                  cellBorderLeft = borderCss(cell.border, "left");
                  cellBorderBottom = borderCss(cell.border, "bottom");
                  cellBorderRight = borderCss(cell.border, "right");
                } else {
                  // Modern Soft: subtle horizontal lines without vertical gridlines
                  if (meta.isHeader) {
                    cellBorderTop = "1px solid #e2e8f0";
                    cellBorderBottom = "1.5px solid #cbd5e1";
                  } else if (meta.isGroup) {
                    cellBorderTop = "1px solid #e2e8f0";
                    cellBorderBottom = "1px solid #e2e8f0";
                  } else if (meta.isTotal) {
                    cellBorderTop = "1.5px solid #cbd5e1";
                    cellBorderBottom = "1.5px solid #cbd5e1";
                  } else if (meta.isSummary) {
                    cellBorderTop = "1px solid #e2e8f0";
                  } else if (meta.isData) {
                    cellBorderBottom = "1px solid #f1f5f9";
                  }
                }

                // ── Typography ────────────────────────────────────────────────
                let calculatedFontSize = "12.5px";
                if (font?.size) {
                  calculatedFontSize = `${font.size}px`;
                } else if (meta.isTitle) {
                  calculatedFontSize = "16px";
                } else if (meta.isSubtitle) {
                  calculatedFontSize = "12px";
                } else if (meta.isHeader) {
                  calculatedFontSize = "11px";
                } else if (meta.isTotal || meta.isGroup) {
                  calculatedFontSize = "12px";
                }

                let calculatedFontWeight = 400;
                if (showStyles) {
                  calculatedFontWeight = font?.bold || meta.isTitle || meta.isHeader || meta.isGroup || meta.isTotal ? 700 : 400;
                } else {
                  calculatedFontWeight = meta.isTitle || meta.isTotal ? 700 : meta.isHeader || meta.isGroup || font?.bold ? 600 : 400;
                }

                let textColor = "inherit";
                if (showStyles) {
                  textColor = argbToCss(font?.color?.argb) ?? "inherit";
                } else {
                  if (meta.isHeader) {
                    textColor = "#475569";
                  } else if (meta.isSubtitle || meta.isSummary) {
                    textColor = "#64748b";
                  } else if (meta.isTotal || meta.isTitle) {
                    textColor = "#0f172a";
                  }
                }

                // ── Padding ───────────────────────────────────────────────────
                let cellPadding = "7px 10px";
                if (meta.isTitle) {
                  cellPadding = "12px 6px 2px";
                } else if (meta.isSubtitle) {
                  cellPadding = "2px 6px 12px";
                } else if (meta.isHeader) {
                  cellPadding = "8px 10px";
                } else if (meta.isGroup) {
                  cellPadding = "10px 12px";
                } else if (meta.isTotal) {
                  cellPadding = "8px 10px";
                }

                // ── Alignment ────────────────────────────────────────────────
                let calculatedTextAlign: React.CSSProperties["textAlign"] =
                  (alignment?.horizontal as React.CSSProperties["textAlign"]) ??
                  (meta.isTitle || meta.isSubtitle ? "center" : "left");

                if (!showStyles) {
                  if (meta.isHeader) {
                    calculatedTextAlign =
                      colNumber === 1
                        ? "left"
                        : alignment?.horizontal === "right" || columnCount >= 10
                        ? "right"
                        : (alignment?.horizontal as React.CSSProperties["textAlign"]) ?? "left";
                  } else if (meta.isTotal) {
                    calculatedTextAlign =
                      colNumber === 1
                        ? "left"
                        : (alignment?.horizontal as React.CSSProperties["textAlign"]) ?? "right";
                  } else if (meta.isData) {
                    if (
                      typeof cell.value === "number" ||
                      alignment?.horizontal === "right" ||
                      (!Number.isNaN(Number(cell.value)) && String(cell.value).trim() !== "" && colNumber > 1 && columnCount >= 10)
                    ) {
                      calculatedTextAlign = "right";
                    }
                  }
                }

                // ── Display Value & Badges ────────────────────────────────────
                const displayValue = cellText(cell.value);
                const statusKey = displayValue.trim().toLowerCase();
                const badgeStyle = !showStyles && meta.isData ? STATUS_BADGE_MAP[statusKey] : undefined;

                return (
                  <td
                    key={colNumber}
                    colSpan={span?.colspan}
                    rowSpan={span?.rowspan}
                    style={{
                      backgroundColor: background,
                      color: textColor,
                      fontWeight: calculatedFontWeight,
                      fontStyle: font?.italic || meta.isSubtitle ? "italic" : undefined,
                      fontSize: calculatedFontSize,
                      letterSpacing: !showStyles && meta.isHeader ? "0.04em" : undefined,
                      textTransform: !showStyles && meta.isHeader ? "uppercase" : undefined,
                      lineHeight: "1.35",
                      textAlign: calculatedTextAlign,
                      verticalAlign: meta.isTitle || meta.isSubtitle ? "middle" : meta.isHeader ? "bottom" : "top",
                      whiteSpace:
                        meta.isGroup || meta.isTitle || meta.isSubtitle || alignment?.wrapText || colNumber === 3 || colNumber === 4
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
                    {badgeStyle ? (
                      <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border", badgeStyle.bg, badgeStyle.text, badgeStyle.border)}>
                        {displayValue}
                      </span>
                    ) : (
                      displayValue
                    )}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  ), [
    sheet,
    rowCount,
    columnCount,
    widths,
    naturalWidth,
    gutterWidth,
    showGrid,
    showStyles,
    spans,
    covered,
    rowMeta,
  ]);

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
              onClick={handleEnterFullscreen}
              title={t("report.fullscreen") || "Full Screen"}
              aria-label={t("report.fullscreen") || "Full Screen"}
              className={`${buttonClass} text-accent hover:bg-accent-soft hover:text-accent-hover`}
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* ── Standard View Container ───────────────────────────────────────── */}
        <div
          ref={containerRef}
          className={`flex-1 min-h-0 overflow-auto p-3 sm:p-5 pb-16 rounded-b-2xl overscroll-contain print:overflow-visible print:p-0 ${
            showStyles ? "bg-sunken " : "bg-slate-50/50 dark:bg-slate-950/40 "
          }`}
        >
          <div
            className={`min-w-full pb-8 ${
              showStyles
                ? "inline-block bg-white shadow-lg print:shadow-none"
                : "block bg-white dark:bg-slate-900 rounded-2xl shadow-xs border border-slate-200/80 dark:border-slate-800 p-4 sm:p-6"
            }`}
            // `zoom`, not `transform` — transform would break the sticky header.
            style={{ zoom: showStyles ? zoom : (manualZoom ?? 1) }}
          >
            {!showStyles && cardHeaderElement}
            {tableElement}
          </div>
        </div>
      </div>

      {/* ── Fullscreen Modal View (Portaled to document.body) ─────────────────────────── */}
      {isFullscreen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[99999] flex flex-col bg-slate-900/60 backdrop-blur-sm p-1.5 sm:p-2.5 md:p-3.5 animate-in fade-in duration-200 w-screen h-screen overflow-hidden">
          <div className="flex flex-col h-full w-full bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-subtle overflow-hidden">
            {/* Fullscreen Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-subtle bg-cushion/90 px-4 py-2.5 backdrop-blur-sm shrink-0">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-success-soft text-success">
                    <FileSpreadsheet className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-semibold text-ink">
                    {title || sheet.name || "Excel Report"}
                  </span>
                  <span className="hidden sm:inline-flex items-center rounded-md bg-sunken/70 px-2 py-0.5 text-[11px] font-medium text-ink-secondary">
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

                <span className="w-12 text-center text-xs font-mono font-medium text-ink-secondary">
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
                  onClick={handleExitFullscreen}
                  title={t("report.exitFullscreen") || "Exit Fullscreen"}
                  aria-label={t("report.exitFullscreen") || "Exit Fullscreen"}
                  className="flex items-center gap-1.5 rounded-lg bg-sunken hover:bg-cushion px-3 py-1.5 text-xs font-medium text-ink transition-colors cursor-pointer border border-subtle"
                >
                  <Minimize2 className="h-3.5 w-3.5" />
                  <span>{t("report.exitFullscreen") || "Exit"}</span>
                  <kbd className="hidden sm:inline-block ml-1 rounded bg-sunken px-1.5 py-0.5 text-[10px] font-mono text-ink-secondary">ESC</kbd>
                </button>

                <button
                  type="button"
                  onClick={handleExitFullscreen}
                  className="ml-1 rounded-lg p-1.5 text-ink-muted hover:bg-sunken hover:text-ink transition-colors cursor-pointer"
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
                showStyles ? "bg-sunken" : "bg-slate-50/50 dark:bg-slate-950/40"
              }`}
            >
              <div
                className={`min-w-full pb-8 ${
                  showStyles
                    ? "inline-block bg-white shadow-xl"
                    : "block bg-white dark:bg-slate-900 rounded-2xl shadow-xs border border-slate-200/80 dark:border-slate-800 p-4 sm:p-6"
                }`}
                style={{ zoom: showStyles ? zoom : (manualZoom ?? 1) }}
              >
                {!showStyles && cardHeaderElement}
                {tableElement}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
