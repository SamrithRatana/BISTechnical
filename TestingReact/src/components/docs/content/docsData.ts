/**
 * @file components/docs/content/docsData.ts
 * @description The manual, assembled — chapter order, the flat reading path
 * every "next" button walks, the counts the hero quotes, and the integrity
 * check that keeps all three honest.
 *
 * This file used to hold all 905 lines of catalogue as well. It now holds only
 * the assembly; the prose lives in one `articles*.ts` per chapter (§1: no file
 * over ~300 lines). The import path is deliberately unchanged, so every
 * consumer kept working through the split.
 *
 * ─── Everything countable here is DERIVED ───────────────────────────────────
 *
 * A hero that claims "56 documented screens" beside a catalogue holding 27 is
 * the kind of small lie that makes a reader stop trusting the rest of the
 * page, and it is exactly what happens when a number is maintained by hand
 * next to a list that grows. Same for "Stage 4" typed into an article title.
 * Nothing on this page states a position or a total that is not read back out
 * of these arrays.
 */

import type { DocsArticle, DocsSectionGroup } from "./articleTypes";
import { GETTING_STARTED_SECTION } from "./articlesGettingStarted";
import { WORKFLOW_SECTION } from "./articlesWorkflow";
import { INVENTORY_SECTION } from "./articlesInventory";
import { REPORTS_SECTION } from "./articlesReports";
import { ADMIN_SECTION } from "./articlesAdmin";
import { LIFECYCLE_STAGES } from "./lifecycle";

/** Re-exported so consumers import the catalogue and its shape from one place.
 *  Only the types something actually renders are surfaced — the rest
 *  (`DocsCallout`, `DocsStep`, `DocsDiagramNode`) are reachable from
 *  `./articleTypes` if a consumer ever needs one. */
export type { DocsArticle, DocsDiagram, DocsSectionGroup } from "./articleTypes";

/** Chapter order. This is the order the sidebar prints and the order the
 *  reading path below walks — a reader who presses "next" from the first
 *  article to the last has read the manual front to back. */
export const DOCS_NAVIGATION_SECTIONS: readonly DocsSectionGroup[] = [
  GETTING_STARTED_SECTION,
  WORKFLOW_SECTION,
  INVENTORY_SECTION,
  REPORTS_SECTION,
  ADMIN_SECTION,
];

/**
 * Every article, flattened, in reading order.
 *
 * Computed once at module scope rather than inside a `useMemo` in each
 * consumer: it is derived from a constant, so every component that flattened
 * it separately was recomputing the same array and — worse — could disagree
 * about the order if one of them ever filtered first.
 */
export const DOCS_ALL_ARTICLES: readonly DocsArticle[] = DOCS_NAVIGATION_SECTIONS.flatMap(
  (section) => section.articles
);

/** The article a reader lands on with no hash. Named rather than `[0]` so the
 *  entry point is a decision, not an accident of array order. */
export const DOCS_DEFAULT_ARTICLE_ID = "getting-started-guide";

export const DOCS_ARTICLE_COUNT = DOCS_ALL_ARTICLES.length;
export const DOCS_SECTION_COUNT = DOCS_NAVIGATION_SECTIONS.length;

/** The section an article belongs to, for the breadcrumb and the "step N of M"
 *  counter — which counts within the chapter, not across the whole manual. */
export function docsSectionOf(articleId: string): DocsSectionGroup | undefined {
  return DOCS_NAVIGATION_SECTIONS.find((section) =>
    section.articles.some((article) => article.id === articleId)
  );
}

/**
 * Catalogue integrity, checked once on every dev boot.
 *
 * There is no test runner in this project (root CLAUDE.md §15), and the three
 * things most likely to break here all fail SILENTLY in the browser:
 *
 *  - A duplicate article id makes the hash reader pick whichever entry `find`
 *    reached first, so a deep link lands on the wrong page.
 *  - A lifecycle stage pointing at an id that no longer exists turns its stop
 *    on the rail into a dead click that throws the reader back to article one.
 *    Six of the eleven stops were in exactly that state, and the check that
 *    should have caught it passed — because it validated against the older
 *    chapter catalogue, which still had topics for pages the reader could not
 *    reach. Validate against what is RENDERED, never against a parallel list.
 *  - A default article id that does not exist makes the page open on whatever
 *    happens to sort first.
 *
 * None of those throws, none logs, and none is visible in a screenshot.
 *
 * `process.env.NODE_ENV` is statically replaced at build time, so the whole
 * block is dead code the bundler drops from the production chunk — it costs
 * the reader nothing and costs whoever edits the catalogue one loud console
 * error the moment they get it wrong.
 */
if (process.env.NODE_ENV !== "production") {
  const ids = DOCS_ALL_ARTICLES.map((article) => article.id);
  const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (duplicates.length > 0) {
    console.error(
      `[docs] Duplicate article ids: ${[...new Set(duplicates)].join(", ")}. ` +
        "Ids are deep-link anchors, so a duplicate silently sends every link " +
        "to whichever article is found first."
    );
  }

  const known = new Set(ids);

  const orphanStages = LIFECYCLE_STAGES.filter((stage) => !known.has(stage.topicId));
  if (orphanStages.length > 0) {
    console.error(
      "[docs] Lifecycle stages point at articles that do not exist: " +
        orphanStages.map((stage) => `${stage.status} -> ${stage.topicId}`).join(", ") +
        ". Those stops on the rail are dead clicks."
    );
  }

  if (!known.has(DOCS_DEFAULT_ARTICLE_ID)) {
    console.error(
      `[docs] DOCS_DEFAULT_ARTICLE_ID "${DOCS_DEFAULT_ARTICLE_ID}" is not in the catalogue.`
    );
  }
}
