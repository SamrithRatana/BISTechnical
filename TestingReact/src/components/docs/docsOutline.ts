/**
 * @file components/docs/docsOutline.ts
 * @description Which headings an article actually renders — the single source
 * of truth behind both the article body and the "On this page" rail.
 *
 * The two have to agree exactly. A rail entry with no heading under it is a
 * link that scrolls nowhere; a heading with no rail entry is a section the
 * reader cannot see exists. Deriving both from one function makes the two
 * failures impossible rather than merely unlikely, which matters here because
 * the sections are CONDITIONAL — not every article has a diagram, a step list,
 * a report table or callouts.
 *
 * ─── Why anchors are `<articleId>--<section>` ───────────────────────────────
 *
 * The page addresses articles by hash (`/docs#receive-item`). Section anchors
 * have to be deep-linkable too — "read the bit about approving stock" should
 * be a link someone can paste — but a bare `#steps` would collide across all
 * 27 articles and would overwrite the article the hash is meant to select.
 * Prefixing with the article id makes every anchor unique, and lets the hash
 * reader in `page.tsx` recover the article by splitting on `--`.
 */

import type { Bilingual } from "./docsTypes";
import type { DocsArticle } from "./content/docsData";

export type DocsOutlineKey = "overview" | "flow" | "steps" | "reports" | "notes";

export interface DocsOutlineEntry {
  /** DOM id of the `<section>`, and the hash that deep-links to it. */
  anchor: string;
  key: DocsOutlineKey;
  label: Bilingual;
}

/** The heading text for each section. Exported so the article body and the
 *  rail print the SAME words — a rail saying "Step by step" over a heading
 *  saying "Execution guide" reads as two different sections. */
export const DOCS_OUTLINE_LABELS: Record<DocsOutlineKey, Bilingual> = {
  overview: { en: "Overview", km: "សេចក្តីសង្ខេប" },
  flow: { en: "How it flows", km: "លំហូរការងារ" },
  steps: { en: "Step by step", km: "ជំហានម្តងមួយៗ" },
  reports: { en: "Report catalogue", km: "បញ្ជីរបាយការណ៍" },
  notes: { en: "Notes & warnings", km: "ចំណាំ & ការព្រមាន" },
};

/** The anchor for one section of one article. Used by both sides so the string
 *  is never written out twice. */
export function docsAnchor(articleId: string, key: DocsOutlineKey): string {
  return `${articleId}--${key}`;
}

/** Splits `receive-item--steps` back into `receive-item`. A hash with no `--`
 *  is returned unchanged, so plain article links keep working. */
export function docsArticleIdFromHash(hash: string): string {
  return hash.split("--")[0];
}

export function docsOutline(article: DocsArticle): DocsOutlineEntry[] {
  const present: DocsOutlineKey[] = ["overview"];
  if (article.diagram) present.push("flow");
  if (article.steps && article.steps.length > 0) present.push("steps");
  if (article.reportTableCategory) present.push("reports");
  if (article.callouts && article.callouts.length > 0) present.push("notes");

  return present.map((key) => ({
    key,
    anchor: docsAnchor(article.id, key),
    label: DOCS_OUTLINE_LABELS[key],
  }));
}
