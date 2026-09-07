/**
 * SUPERSEDED - NOTHING IMPORTS THIS FILE.
 *
 * This is the older chapter/topic catalogue (`DOCS_CHAPTERS`, 56 topics across
 * `gettingStarted.ts`, `start*.ts`, `workflow*.ts`, `inventory*.ts`,
 * `reports*.ts`, `admin*.ts`). The card-grid components that rendered it -
 * `ChapterNav`, `ChapterSection`, `TopicCard` - were removed in the 2026-09-01
 * docs restructure; the page now renders `content/docsData.ts`'s article
 * catalogue instead.
 *
 * It is KEPT rather than deleted because the prose is authored bilingual
 * documentation and several topics are better written than their article
 * counterparts - five of them (`inspection`, `confirmed-sale`,
 * `approve-repair`, `rejected`, `unrepairable`) were ported into
 * `articlesWorkflow*.ts` to fix six dead stops on the lifecycle rail. The
 * remaining ~50 have not been reviewed against the articles.
 *
 * Two live modules still sit in this folder and are NOT superseded - import
 * them directly, never through this file:
 *   - `content/lifecycle.ts`  (LIFECYCLE_STAGES, drawn by `LifecycleRail`)
 *   - `content/heroCopy.ts`   (all page furniture copy)
 *
 * Next step is a decision, not a cleanup: merge the remaining topics into the
 * article catalogue, or delete this subtree. Until then it costs the reader
 * nothing - with no importer, the bundler never puts it in a chunk.
 */

/**
 * @file components/docs/content/index.ts
 * @description The manual, assembled — chapter order, the counts the hero
 * quotes, and the integrity check that keeps both honest.
 *
 * The counts are DERIVED, never typed in. A hero that claims "48 documented
 * screens" beside a catalogue holding 44 is the kind of small lie that makes a
 * reader stop trusting the rest of the page, and it is exactly what happens
 * when a number is maintained by hand next to a list that grows.
 */

import type { DocChapter } from "../docsTypes";
import { GETTING_STARTED_CHAPTER } from "./gettingStarted";
import { WORKFLOW_CHAPTER } from "./workflow";
import { INVENTORY_CHAPTER } from "./inventory";
import { REPORTS_CHAPTER } from "./reports";
import { ADMIN_CHAPTER } from "./admin";
import { LIFECYCLE_STAGES } from "./lifecycle";

export { LIFECYCLE_STAGES } from "./lifecycle";

export const DOCS_CHAPTERS: readonly DocChapter[] = [
  GETTING_STARTED_CHAPTER,
  WORKFLOW_CHAPTER,
  INVENTORY_CHAPTER,
  REPORTS_CHAPTER,
  ADMIN_CHAPTER,
];

export const DOCS_TOPIC_COUNT = DOCS_CHAPTERS.reduce(
  (total, chapter) => total + chapter.topics.length,
  0
);

/**
 * Catalogue integrity, checked once on every dev boot.
 *
 * There is no test runner in this project (see the root CLAUDE.md §15), and
 * the two things most likely to break here both fail SILENTLY in the browser:
 * a duplicate topic id makes `getElementById` pick whichever card rendered
 * first, and a lifecycle stage pointing at an id that no longer exists turns
 * its stop on the diagram into a dead click. Neither throws, neither logs,
 * and neither is visible in a screenshot.
 *
 * `process.env.NODE_ENV` is statically replaced at build time, so this whole
 * block is dead code the bundler drops from the production chunk — it costs
 * the reader nothing and costs whoever edits the catalogue one loud console
 * error the moment they get it wrong.
 */
if (process.env.NODE_ENV !== "production") {
  const ids = DOCS_CHAPTERS.flatMap((chapter) => chapter.topics.map((topic) => topic.id));
  const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (duplicates.length > 0) {
    console.error(
      `[docs] Duplicate topic ids: ${[...new Set(duplicates)].join(", ")}. ` +
        "Ids are DOM ids and deep-link anchors, so a duplicate silently sends " +
        "every link to whichever card renders first."
    );
  }

  const known = new Set(ids);
  const orphans = LIFECYCLE_STAGES.filter((stage) => !known.has(stage.topicId));
  if (orphans.length > 0) {
    console.error(
      "[docs] Lifecycle stages point at topics that do not exist: " +
        orphans.map((stage) => `${stage.status} -> ${stage.topicId}`).join(", ") +
        ". Clicking those stops on the rail would do nothing."
    );
  }
}
