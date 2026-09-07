"use client";

/**
 * @file report/ReportSheet.tsx
 * @description Renders the shared report layout inside the web app.
 *
 * The markup and the stylesheet both come from `src/report-layout/`, which is
 * the same code the CamID phone app prints from. This component only mounts
 * that output and applies the on-screen zoom — it decides nothing about the
 * layout, on purpose. Anything that changes how the report *looks* belongs in
 * `src/report-layout/`, or the two platforms drift apart again.
 *
 * Rendering it inline in the app document (rather than in an iframe) is
 * deliberate: the Khmer faces are loaded by `next/font` on the app's <html>
 * element, and an iframe would not inherit them, so Khmer text would reflow
 * against a fallback face and stop matching the phone.
 */

import React, { useMemo } from "react";
import {
  buildReportCss,
  buildWebPrintIsolationCss,
  renderReportSheet,
  type RenderReportOptions,
  type ReportTemplateSettings,
  type ReportTicketLike,
  type ResolvedSparePartRow,
} from "@/report-layout";

export interface ReportSheetProps {
  item: ReportTicketLike;
  sparePartRows: ResolvedSparePartRow[];
  settings: ReportTemplateSettings;
  /** On-screen scale; 1 = 100%. Never reaches the printed page. */
  zoom?: number;
  /** Emits the designer's selection hooks into the markup. */
  design?: boolean;
  /** Emits interactive WYSIWYG editor hooks (per-row delete button, add row button). */
  interactive?: boolean;
  /** Adds the rules that hide the rest of the app while printing. */
  isolateForPrint?: boolean;
  /** Resolved URL for the uploaded system brand logo, when the template asks for it. */
  brandLogoSrc?: string;
  className?: string;
}

/**
 * The A4 sheet, ready to print.
 *
 * `dangerouslySetInnerHTML` is correct here rather than a smell: the markup is
 * produced by our own generator, and every interpolated value goes through
 * `escapeHtml` in `report-layout/format.ts` before it reaches the string.
 */
export default function ReportSheet({
  item,
  sparePartRows,
  settings,
  zoom = 1,
  design = false,
  interactive = false,
  isolateForPrint = false,
  brandLogoSrc,
  className = "",
}: ReportSheetProps) {
  const css = useMemo(
    () => `${buildReportCss(settings)}\n${isolateForPrint ? buildWebPrintIsolationCss() : ""}`,
    [settings, isolateForPrint],
  );

  const html = useMemo(() => {
    const options: RenderReportOptions = { design, interactive, brandLogoSrc };
    return renderReportSheet(item, sparePartRows, settings, options);
  }, [item, sparePartRows, settings, design, interactive, brandLogoSrc]);

  return (
    <>
      {/* A <style> element, unlike <script>, is re-applied on every client
          render, so this is safe in a component that re-renders — see the
          script/hydration rule in CLAUDE.md §1. */}
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div
        className={`rpt-zoom ${className}`}
        style={{ ["--rpt-zoom" as string]: String(zoom) }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </>
  );
}
