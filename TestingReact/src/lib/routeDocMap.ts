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
 * Direct route-to-articleId lookup table.
 * Order matters: more specific sub-routes come before generic parent routes.
 */
export const ROUTE_TO_DOC_ID: Record<string, string> = {
  // --- Core Dashboard ---
  "/": "getting-started-guide",

  // --- Chapter 2: 11-Stage Repair Lifecycle ---
  "/receive-item": "receive-item",
  "/received-inventory": "receive-item",
  "/inspect-item": "inspect-item",
  "/inspection": "inspection",
  "/spare-request": "spare-request",
  "/waiting-confirm": "waiting-confirm",
  "/confirmed-sale": "confirmed-sale",
  "/approve-repair": "approve-repair",
  "/approve-verify": "approve-verify",
  "/finished-repair": "finished-handover",
  "/completed-repairs": "finished-handover",
  "/rejected": "rejected",
  "/unrepairable": "unrepairable",
  "/service-tickets": "receive-item",

  // --- Chapter 3: Spare Parts & Inventory ---
  "/spareparts/brands": "brand-taxonomy",
  "/spareparts/categories": "category-taxonomy",
  "/spareparts/types": "type-taxonomy",
  "/spareparts": "spare-catalog",
  "/sparepart-usage": "sparepart-usage-report",
  "/sparepart-hold": "sparepart-hold-report",
  "/stock-transactions": "stock-transactions-report",
  "/stock-movement": "stock-movement-report",
  "/stock-adjustments": "stock-adjustments-report",
  "/stock-reconciliation": "stock-reconciliation-report",
  "/stock-health": "stock-health-report",
  "/stock-dead": "stock-dead-report",

  // --- Chapter 4: Business Reports ---
  "/daily-report": "daily-operations-report",
  "/monthly-report": "monthly-operations-report",
  "/history-report": "repair-history-report",
  "/engineer-kpi-report": "engineer-kpi-report",
  "/engineer-report": "engineer-kpi-report",
  "/monthly-technical-matrix": "monthly-technical-matrix",
  "/sales-followup": "sales-followup-report",
  "/sales-conversion-report": "sales-followup-report",
  "/sales-leads-report": "sales-followup-report",
  "/faults-report": "fault-analysis-report",
  "/customer-report": "customer-report",
  "/customers": "customer-report",
  "/contract-report": "contract-report",
  "/contract-renewal-report": "contract-report",
  "/stage-report": "stage-report",
  "/pending-repairs": "pending-repairs",
  "/third-party-repairs": "third-party-repairs",
  "/repair-report": "repair-history-report",
  "/location-report": "daily-operations-report",

  // --- Chapter 5: Administration & Settings ---
  "/profile": "profile-overview",
  "/settings": "system-branding-customization",
  "/templates-settings": "template-management",
  "/users": "admin-user-management",
  "/permissions": "admin-user-management",
  "/login": "login-access-guide",
  "/face-link": "login-access-guide",
};

/**
 * Resolves a URL pathname to the most accurate Docs Article ID.
 */
export function resolveArticleIdForPath(pathname: string): string {
  if (!pathname) return "getting-started-guide";

  // 1. Direct exact match
  if (ROUTE_TO_DOC_ID[pathname]) {
    return ROUTE_TO_DOC_ID[pathname];
  }

  // 2. Prefix matching for nested routes
  const cleanPath = pathname.split("?")[0].replace(/\/$/, "");
  if (ROUTE_TO_DOC_ID[cleanPath]) {
    return ROUTE_TO_DOC_ID[cleanPath];
  }

  for (const [routeKey, docId] of Object.entries(ROUTE_TO_DOC_ID)) {
    if (routeKey !== "/" && cleanPath.startsWith(routeKey)) {
      return docId;
    }
  }

  return "getting-started-guide";
}

/**
 * Loads the full article summary asynchronously on demand.
 * Keeps initial page bundle light by dynamically importing docs data only when needed.
 */
export async function loadDocSummaryForRoute(pathname: string): Promise<RouteDocSummary> {
  const articleId = resolveArticleIdForPath(pathname);

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
      docsUrl: `/docs#${article.id}`,
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
      docsUrl: "/docs#getting-started-guide",
    };
  }
}
