/**
 * @file report-layout/document.ts
 * @description Wraps the shared sheet in a complete, standalone HTML
 * document — what the CamID app shows in its WebView and hands to
 * `expo-print`.
 *
 * See `types.ts` for why this folder has no framework imports.
 */

import { buildReportCss } from "./css";
import { renderReportSheet, type RenderReportOptions } from "./html";
import { escapeHtml } from "./format";
import type { ReportTemplateSettings, ReportTicketLike, ResolvedSparePartRow } from "./types";

/**
 * The Khmer faces the report is designed in.
 *
 * The web app already self-hosts these three through `next/font/google`, so
 * on the desktop the stack resolves to the local copies and this link is not
 * used. The phone's WebView has no such loader, so the standalone document
 * fetches the same three families from Google — same typefaces, same metrics,
 * same printed line breaks on both platforms.
 *
 * `display=block` rather than `swap` on purpose: expo-print rasterises the
 * page as soon as the WebView reports it loaded. Under `swap` that race is
 * routinely lost and the PDF silently ships the fallback face, so Khmer text
 * comes out at different widths than the preview showed.
 */
const GOOGLE_FONTS_HREF =
  "https://fonts.googleapis.com/css2" +
  "?family=Battambang:wght@400;700" +
  "&family=Kantumruy+Pro:wght@400;500;600;700" +
  "&family=Noto+Sans+Khmer:wght@400;500;600;700" +
  "&display=block";

export interface RenderReportDocumentOptions extends RenderReportOptions {
  /**
   * `"print"` strips the grey desk and the preview zoom so the sheet is the
   * whole page — what `Print.printToFileAsync` should be given.
   * `"preview"` keeps the desk for the on-screen WebView.
   */
  mode?: "preview" | "print";
  /** Loads the Khmer webfonts from Google. Off for a document rendered inside the web app, which already has them. */
  includeWebFonts?: boolean;
  /** Extra CSS appended after the report stylesheet. */
  extraCss?: string;
  /** Initial preview zoom, 1 = 100%. Ignored in print mode. */
  zoom?: number;
  /** Document language attribute. */
  lang?: string;
}

/**
 * Builds the full `<!DOCTYPE html>` document for one ticket.
 *
 * This is the same sheet markup and the same stylesheet the web app renders
 * inline — only the wrapper differs — so what the phone prints and what the
 * desktop prints come off one layout.
 */
export function renderReportDocument(
  item: ReportTicketLike,
  sparePartRows: ResolvedSparePartRow[],
  settings: ReportTemplateSettings,
  options: RenderReportDocumentOptions = {},
): string {
  const {
    mode = "preview",
    includeWebFonts = true,
    extraCss = "",
    zoom = 1,
    lang = "km",
    ...sheetOptions
  } = options;

  const isPrint = mode === "print";
  const css = buildReportCss(settings, { includeViewportChrome: !isPrint });
  const sheet = renderReportSheet(item, sparePartRows, settings, sheetOptions);
  const title = `Technical Service Report — ${item.reportNo || "Draft"}`;

  const fontLinks = includeWebFonts
    ? `  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="${GOOGLE_FONTS_HREF}">`
    : "";

  // In print mode the sheet is the document; nothing wraps it, so the page
  // box and the sheet box are the same rectangle and the margins are the
  // sheet's own padding on all four sides.
  const body = isPrint
    ? sheet
    : `<div class="rpt-viewport">
<div class="rpt-zoom" style="--rpt-zoom:${Number.isFinite(zoom) ? zoom : 1}">
${sheet}
</div>
</div>`;

  return `<!DOCTYPE html>
<html lang="${escapeHtml(lang)}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
${fontLinks}
  <style>
${css}
${extraCss}
  </style>
</head>
<body class="rpt-print-root">
${body}
</body>
</html>`;
}
