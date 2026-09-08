/**
 * @file lib/routeDocMap.ts
 * @description Maps application routes to corresponding documentation articles.
 *
 * Designed for on-demand dynamic loading: the route-to-articleId lookup is small
 * and instantaneous, while the rich article contents (steps, callouts, diagrams)
 * are loaded asynchronously only when the Help drawer is actually opened.
 */

export interface RouteDocSummary {
  articleId: string;
  titleKm: string;
  titleEn: string;
  subtitleKm: string;
  subtitleEn: string;
  categoryKm: string;
  categoryEn: string;
  icon: string;
  badge?: string;
  summaryKm: string;
  summaryEn: string;
  steps?: {
    number: number;
    titleKm: string;
    titleEn: string;
    descKm: string;
    descEn: string;
  }[];
  callouts?: {
    type: "info" | "tip" | "warning" | "success";
    titleKm: string;
    titleEn: string;
    contentKm: string;
    contentEn: string;
  }[];
  docsUrl: string; // e.g. "/docs#receive-item"
}

/**
 * Direct route-to-documentation URL mapping table.
 * Maps application paths to specific articles and sub-target elements (sections or catalog rows).
 * Format:
 *  - Standard article: "/docs#<articleId>"
 *  - Deep link with row/sub-target: "/docs#<articleId>--<subTargetId>"
 */
export const ROUTE_TO_DOC_URL: Record<string, string> = {
  // ── Chapter 1: Core Dashboard & Authentication ──
  "/": "/docs#getting-started-guide",
  "/login": "/docs#login-process-flow",
  "/face-link": "/docs#face-link",
  "/scanner": "/docs#mobile-barcode-scanner",
  "/download": "/docs#mobile-barcode-scanner",
  "/download/android": "/docs#mobile-barcode-scanner",
  "/download/ios": "/docs#mobile-barcode-scanner",

  // ── Chapter 2: 11-Stage Repair Lifecycle ──
  "/received-inventory": "/docs#received-inventory",
  "/receive-item": "/docs#receive-item",
  "/service-tickets": "/docs#receive-item",
  "/inspect-item": "/docs#inspect-item",
  "/inspection": "/docs#inspection",
  "/spare-request": "/docs#spare-request",
  "/waiting-confirm": "/docs#waiting-confirm",
  "/confirmed-sale": "/docs#confirmed-sale",
  "/pending-repairs": "/docs#pending-repairs",
  "/approve-repair": "/docs#approve-repair",
  "/approve-verify": "/docs#approve-verify",
  "/completed-repairs": "/docs#completed-repairs",
  "/finished-repair": "/docs#completed-repairs",
  "/rejected": "/docs#rejected-unrepairable",
  "/unrepairable": "/docs#rejected-unrepairable",
  "/third-party-repairs": "/docs#third-party-repairs",

  // ── Chapter 3: Spare Parts Catalog & Stock Ledger ──
  "/spareparts/brands": "/docs#spareparts-catalog",
  "/spareparts/categories": "/docs#spareparts-catalog",
  "/spareparts/types": "/docs#spareparts-catalog",
  "/spareparts": "/docs#spareparts-catalog",
  "/sparepart-hold": "/docs#sparepart-hold",
  "/stock-transactions": "/docs#stock-transactions",
  "/stock-movement": "/docs#stock-movement",
  "/stock-adjustments": "/docs#stock-adjustments",
  "/stock-reconciliation": "/docs#stock-transactions",
  "/stock-health": "/docs#stock-health",
  "/stock-dead": "/docs#stock-dead",

  // ── Chapter 4: Enterprise Reports - Operations (10 Reports) ──
  "/daily-report": "/docs#report-repair-operations--daily-report",
  "/monthly-report": "/docs#report-repair-operations--monthly-report",
  "/monthly-technical-matrix": "/docs#report-repair-operations--monthly-technical-matrix",
  "/repair-report": "/docs#report-repair-operations--repair-report",
  "/history-report": "/docs#report-repair-operations--history-report",
  "/stage-report": "/docs#report-repair-operations--stage-report",
  "/location-report": "/docs#report-repair-operations--location-report",
  "/contract-report": "/docs#report-repair-operations--contract-report",

  // ── Chapter 4: Enterprise Reports - Quality & Diagnostics (2 Reports) ──
  "/faults-report": "/docs#report-quality-diagnostics--faults-report",
  "/rejected-report": "/docs#report-quality-diagnostics--rejected-report",

  // ── Chapter 4: Enterprise Reports - Technician KPIs (2 Reports) ──
  "/engineer-kpi-report": "/docs#report-technician-kpis--engineer-kpi-report",
  "/engineer-report": "/docs#report-technician-kpis--engineer-report",

  // ── Chapter 4: Enterprise Reports - Sales & CRM (7 Reports) ──
  "/sales-followup": "/docs#report-sales-crm--waiting-confirm",
  "/sales-leads-report": "/docs#report-sales-crm--sales-leads-report",
  "/sales-conversion-report": "/docs#report-sales-crm--sales-conversion-report",
  "/customer-report": "/docs#report-sales-crm--customer-report",
  "/customers": "/docs#report-sales-crm--customer-report",
  "/top-customers-report": "/docs#report-sales-crm--top-customers-report",
  "/contract-renewal-report": "/docs#report-sales-crm--contract-renewal-report",

  // ── Chapter 4: Enterprise Reports - Spare Parts Stock (8 Reports) ──
  "/sparepart-usage": "/docs#report-spare-parts-stock--sparepart-usage-report",

  // ── Chapter 5: Administration & Security Settings ──
  "/profile": "/docs#admin-profile",
  "/settings": "/docs#admin-theme",
  "/templates-settings": "/docs#reports-overview",
  "/users": "/docs#admin-users",
  "/permissions": "/docs#admin-users",
};

/**
 * Backward compatibility alias for ROUTE_TO_DOC_ID.
 */
export const ROUTE_TO_DOC_ID: Record<string, string> = Object.fromEntries(
  Object.entries(ROUTE_TO_DOC_URL).map(([route, docUrl]) => {
    const hash = docUrl.split("#")[1] || "getting-started-guide";
    return [route, hash.split("--")[0]];
  })
);

/**
 * Resolves a URL pathname to the exact documentation deep-link URL (including hash and sub-targets).
 */
export function resolveDocUrlForPath(pathname: string): string {
  if (!pathname) return "/docs#getting-started-guide";

  // Clean trailing slash and strip query string
  const cleanPath = pathname.split("?")[0].replace(/\/+$/, "") || "/";

  // 1. Direct exact match
  if (ROUTE_TO_DOC_URL[cleanPath]) {
    return ROUTE_TO_DOC_URL[cleanPath];
  }

  // 2. Prefix matching for nested sub-routes
  for (const [routeKey, targetUrl] of Object.entries(ROUTE_TO_DOC_URL)) {
    if (routeKey !== "/" && cleanPath.startsWith(routeKey)) {
      return targetUrl;
    }
  }

  return "/docs#getting-started-guide";
}

/**
 * Resolves a URL pathname to the most accurate Docs Article ID.
 */
export function resolveArticleIdForPath(pathname: string): string {
  const targetUrl = resolveDocUrlForPath(pathname);
  const hash = targetUrl.split("#")[1] || "getting-started-guide";
  return hash.split("--")[0];
}

/**
 * Loads the full article summary asynchronously on demand.
 * Keeps initial page bundle light by dynamically importing docs data only when needed.
 */
export async function loadDocSummaryForRoute(pathname: string): Promise<RouteDocSummary> {
  const articleId = resolveArticleIdForPath(pathname);
  const targetUrl = resolveDocUrlForPath(pathname);

  try {
    const { DOCS_ALL_ARTICLES } = await import("@/components/docs/content/docsData");
    const article = DOCS_ALL_ARTICLES.find((a) => a.id === articleId) || DOCS_ALL_ARTICLES[0];

    return {
      articleId: article.id,
      titleKm: article.titleKm,
      titleEn: article.titleEn,
      subtitleKm: article.subtitleKm,
      subtitleEn: article.subtitleEn,
      categoryKm: article.categoryKm,
      categoryEn: article.categoryEn,
      icon: article.icon,
      badge: article.badge,
      summaryKm: article.summaryKm,
      summaryEn: article.summaryEn,
      steps: article.steps?.map((s) => ({
        number: s.number,
        titleKm: s.titleKm,
        titleEn: s.titleEn,
        descKm: s.descKm,
        descEn: s.descEn,
      })),
      callouts: article.callouts?.map((c) => ({
        type: c.type,
        titleKm: c.titleKm,
        titleEn: c.titleEn,
        contentKm: c.contentKm,
        contentEn: c.contentEn,
      })),
      docsUrl: targetUrl,
    };
  } catch (err) {
    console.error("[routeDocMap] Failed to load docs data", err);
    return {
      articleId: "getting-started-guide",
      titleKm: "ការណែនាំអំពីប្រព័ន្ធ",
      titleEn: "System Documentation Guide",
      subtitleKm: "ស្វែងយល់ពីរបៀបប្រើប្រាស់ប្រព័ន្ធទាំងមូល",
      subtitleEn: "Learn how to operate the service management system",
      categoryKm: "សៀវភៅណែនាំ",
      categoryEn: "User Manual",
      icon: "BookOpen",
      summaryKm: "ប្រព័ន្ធគ្រប់គ្រងសេវាកម្មជួសជុល និងថែទាំកុំព្យូទ័រ/ម៉ាស៊ីនបោះពុម្ព Camprotec។",
      summaryEn: "Camprotec Service Maintenance and Repair Management Portal.",
      docsUrl: targetUrl,
    };
  }
}
