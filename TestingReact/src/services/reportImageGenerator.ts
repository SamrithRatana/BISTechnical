/**
 * @file services/reportImageGenerator.ts
 * @description Offscreen client-side A4 Technical Service Report rasterizer.
 * Uses html2canvas and the unified report-layout generator to convert a service ticket
 * into a high-resolution PNG image suitable for Telegram sendPhoto.
 */

import html2canvas from "html2canvas";
import {
  buildReportCss,
  renderReportSheet,
  ticketSparePartLines,
  resolveSparePartRows,
  DEFAULT_REPORT_TEMPLATE,
  type ReportTicketLike,
} from "@/report-layout";
import {
  syncReportTemplateFromServer,
  getPublishedTemplateSnapshot,
} from "@/services/reportTemplate";

/**
 * Generates a PNG Blob of the complete A4 Technical Service Report for a ticket.
 * Runs only in client (browser) context.
 */
export async function generateReportImageBlob(
  item: ReportTicketLike
): Promise<Blob | null> {
  if (typeof window === "undefined" || !item) return null;

  try {
    let settings = DEFAULT_REPORT_TEMPLATE;
    try {
      await syncReportTemplateFromServer();
      settings = getPublishedTemplateSnapshot();
    } catch {}

    const rawLines = ticketSparePartLines(item as Record<string, unknown>);
    const sparePartRows = resolveSparePartRows(rawLines);

    const css = buildReportCss(settings, { includeViewportChrome: false });
    const sheetHtml = renderReportSheet(item, sparePartRows, settings, {
      defaultLogoSrc: "/images/CamLogo.png",
    });

    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "-9999px";
    container.style.top = "0";
    container.style.width = "794px"; // A4 width at 96 DPI
    container.style.backgroundColor = "#ffffff";
    container.style.zIndex = "-9999";
    container.style.pointerEvents = "none";
    container.innerHTML = `<style>${css}</style><div class="rpt-print-root">${sheetHtml}</div>`;
    document.body.appendChild(container);

    // Wait briefly for layout and styling to settle
    await new Promise((resolve) => setTimeout(resolve, 150));

    const sheetElement = (container.querySelector(".rpt-sheet") as HTMLElement) || container;

    const canvas = await html2canvas(sheetElement, {
      scale: 1.5,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
    });

    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }

    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/png", 0.95);
    });
  } catch (err) {
    console.error("Failed to generate report image blob:", err);
    return null;
  }
}
