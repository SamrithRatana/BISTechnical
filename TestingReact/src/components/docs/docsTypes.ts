/**
 * @file components/docs/docsTypes.ts
 * @description The shape of the documentation itself.
 *
 * Deliberately plain data — no React, no icon components, no `"use client"` —
 * for the same reason `config/navigation.ts` is: the content is authored and
 * reviewed as data, and the rendering layer maps `icon` names to components on
 * its own side (`docsIcons.ts`). A content edit then never needs a component
 * import, and the catalogue stays readable as prose.
 *
 * ─── Why the copy is NOT in `i18n/en.ts` / `km.ts` ──────────────────────────
 *
 * `LanguageProvider` imports `en.ts` statically, so every key in that file
 * lands in the chunk all 50+ routes download before they can paint. The Docs
 * hub is several hundred strings of long-form prose in two languages, read by
 * exactly one public page. Putting it in the shared dictionary would make
 * every technician on the shop floor download the manual on the way to a queue
 * screen — against §4's bundle rule, and for no one's benefit.
 *
 * So the copy carries both languages inline and travels in this route's own
 * chunk. `useDocsText()` picks the side to render from `useI18n().lang`, so the
 * language toggle still drives it — the mechanism is shared, the payload is not.
 */

/** One string, both languages. Khmer is authored, never machine-translated. */
export interface Bilingual {
  en: string;
  km: string;
}

/** Chapter colour identity. Resolved to literal classes in `docsAccent.ts`. */
export type DocsAccent = "violet" | "cyan" | "emerald" | "amber" | "rose" | "sky";

/** Icon key, resolved to a lucide component in `docsIcons.ts`. */
export type DocsIconName =
  | "book"
  | "rocket"
  | "shield"
  | "workflow"
  | "clipboard"
  | "search"
  | "wrench"
  | "package"
  | "boxes"
  | "chart"
  | "printer"
  | "users"
  | "settings"
  | "sparkles"
  | "scan"
  | "phone"
  | "bell"
  | "key"
  | "layers"
  | "gauge"
  | "life-buoy";

export interface DocTopic {
  /** Stable anchor id — also the deep-link hash (`/docs#receive-item`). */
  id: string;
  icon: DocsIconName;
  title: Bilingual;
  /** One or two sentences: what it is for. */
  blurb: Bilingual;
  /** The app route this teaches, when it teaches one. */
  route?: string;
  /** Roles the UI gates this behind. Absent means everyone. */
  roles?: string[];
  /** Ordered, concrete UI steps. */
  steps: Bilingual[];
  /** Precise details worth knowing — side effects, limits, exact statuses. */
  facts?: Bilingual[];
}

export interface DocChapter {
  id: string;
  /** Printed as the chapter number: "01", "02", … */
  index: string;
  accent: DocsAccent;
  icon: DocsIconName;
  title: Bilingual;
  tagline: Bilingual;
  topics: DocTopic[];
}

/** One step of the repair lifecycle, for the pipeline rail. */
export interface LifecycleStage {
  /** The exact backend status string. Never translated — it is data, and the
   *  reader will see it verbatim in the app's status column. */
  status: string;
  label: Bilingual;
  route: string;
  /**
   * The `DocTopic.id` this stage's instructions live under. Stated, not derived
   * from `route` — see the note in `content/lifecycle.ts`. Verified against the
   * catalogue on every dev boot by `content/index.ts`.
   */
  topicId: string;
  note: Bilingual;
  accent: DocsAccent;
}
