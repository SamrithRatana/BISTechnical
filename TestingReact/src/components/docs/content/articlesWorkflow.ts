/**
 * @file components/docs/content/articlesWorkflow.ts
 * @description Chapter 2 — the repair lifecycle, one page per stop.
 *
 * ─── The order of this array IS the flow ────────────────────────────────────
 *
 * The pages are listed in the order a real ticket travels: booked in →
 * diagnosed → recorded → quoted → confirmed → parts → repaired → verified →
 * handed over, then the branches that leave the chain without a repair. The
 * sidebar, the "next" button and the "Step N of M" counter in the article
 * header all read their position from this array, so the reading order and
 * the ticket's own order are the same object.
 *
 * That is also why no title says "Stage 4" any more. A number typed into a
 * title is correct exactly until a stage is inserted, and stages have been
 * inserted twice — leaving titles that disagreed with both the rail and the
 * counter beside them. Every stage number the reader sees is now derived.
 *
 * `status` carries the LITERAL backend value from `SERVICE_STATUSES_DB` —
 * including "Item Recieved", misspelled in the database and therefore on
 * screen. Reproduced exactly on purpose: a reader comparing this page against
 * a real ticket, or typing the value into a report filter, has to see the
 * same characters the system uses.
 *
 * The two halves are separate files only because of §1's ~300-line rule; the
 * chain is one sequence and is spread back into one array below.
 */

import type { DocsSectionGroup } from "./articleTypes";
import { WORKFLOW_INTAKE_ARTICLES } from "./articlesWorkflowIntake";
import { WORKFLOW_FULFILMENT_ARTICLES } from "./articlesWorkflowFulfilment";

export const WORKFLOW_SECTION: DocsSectionGroup = {
  id: "repair-workflow",
  titleKm: "លំហូរការងារជួសជុល & ដំណាក់កាលទាំង ១១",
  titleEn: "Repair Operations & 11-Stage Lifecycle",
  icon: "Wrench",
  badge: "Core Workflow",
  articles: [...WORKFLOW_INTAKE_ARTICLES, ...WORKFLOW_FULFILMENT_ARTICLES],
};
