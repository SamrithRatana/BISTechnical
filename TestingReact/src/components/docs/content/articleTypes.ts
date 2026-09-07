/**
 * @file components/docs/content/articleTypes.ts
 * @description The shape of one manual page.
 *
 * Plain data, no React — the catalogue is authored and reviewed as prose, and
 * the rendering layer maps `icon` names to components on its own side
 * (`docsIconMap.ts`). A content edit then never needs a component import.
 *
 * ─── Why the copy is NOT in `i18n/en.ts` / `km.ts` ──────────────────────────
 *
 * `LanguageProvider` imports `en.ts` statically, so every key in that file
 * lands in the chunk all 50+ routes download before they can paint. This
 * manual is several hundred strings of long-form prose in two languages, read
 * by exactly one public page. Putting it in the shared dictionary would make
 * every technician on the shop floor download the manual on the way to a queue
 * screen — against §4's bundle rule, and for no one's benefit.
 *
 * So both languages travel inline, in this route's own chunk. `useDocsText()`
 * picks the side to render from `useI18n().lang`, so the language toggle still
 * drives it — the mechanism is shared, the payload is not.
 */

/** A coloured aside. `type` picks the icon and the palette, nothing else. */
export interface DocsCallout {
  type: "info" | "tip" | "warning" | "success";
  titleKm: string;
  titleEn: string;
  contentKm: string;
  contentEn: string;
}

export interface DocsStep {
  /** Printed as the step chip. Authored, because a step can be "2a" in prose
   *  even though these all happen to run 1..n. */
  number: number;
  titleKm: string;
  titleEn: string;
  descKm: string;
  descEn: string;
}

export interface DocsDiagramNode {
  id: string;
  labelKm: string;
  labelEn: string;
  badgeKm?: string;
  badgeEn?: string;
  /** Makes the node a real link into the app. Must start with `/`. */
  route?: string;
  color: "violet" | "cyan" | "emerald" | "amber" | "rose" | "sky" | "indigo";
}

export interface DocsDiagram {
  titleKm: string;
  titleEn: string;
  descriptionKm: string;
  descriptionEn: string;
  /** Rendered in order; the sequence number comes from the index. */
  nodes: DocsDiagramNode[];
}

export interface DocsArticle {
  /** Stable anchor id — also the deep-link hash (`/docs#receive-item`) and the
   *  value `LifecycleStage.topicId` points at. Never renamed casually. */
  id: string;
  titleKm: string;
  titleEn: string;
  subtitleKm: string;
  subtitleEn: string;
  categoryKm: string;
  categoryEn: string;
  /** Key into `docsIconMap.ts`. An unknown name falls back, never throws. */
  icon: string;
  /** The app route this teaches, when it teaches one. */
  route?: string;
  /**
   * The LITERAL backend status a ticket holds while it sits on this page,
   * copied from `SERVICE_STATUSES_DB` — misspellings included. Never
   * translated: the reader has to be able to match it against the app's own
   * Status column and against every report filter.
   */
  status?: string;
  /** Roles the UI gates this behind. Absent means everyone. */
  roles?: string[];
  badge?: string;
  summaryKm: string;
  summaryEn: string;
  diagram?: DocsDiagram;
  steps?: DocsStep[];
  callouts?: DocsCallout[];
  reportTableCategory?: "operations" | "diagnostics" | "kpis" | "sales" | "stock" | "all";
}

export interface DocsSectionGroup {
  id: string;
  titleKm: string;
  titleEn: string;
  icon: string;
  badge?: string;
  /**
   * Ordered. The order is the reading order AND — for the workflow chapter —
   * the order a ticket actually travels, so "step N of M" and prev/next are
   * derived from the index rather than typed into the copy.
   */
  articles: DocsArticle[];
}
