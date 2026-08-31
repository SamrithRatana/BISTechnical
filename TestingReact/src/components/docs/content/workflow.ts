/**
 * @file components/docs/content/workflow.ts
 * @description Chapter 02 — the repair workflow, one topic per queue page.
 *
 * The topics live in `workflowIntake.ts` and `workflowFulfilment.ts` so no one
 * file runs past ~300 lines; this module is the chapter itself and the order
 * they read in.
 *
 * The purposes are taken from `config/navigation.ts`, which is the app's own
 * single source of truth for what each page is for — the sidebar and the AI
 * assistant both read it — so the manual cannot drift from the menu.
 */

import type { DocChapter } from "../docsTypes";
import { INTAKE_TOPICS } from "./workflowIntake";
import { FULFILMENT_TOPICS } from "./workflowFulfilment";

export const WORKFLOW_CHAPTER: DocChapter = {
  id: "workflow",
  index: "02",
  accent: "cyan",
  icon: "workflow",
  title: { en: "The repair workflow", km: "ដំណើរការជួសជុល" },
  tagline: {
    en: "Nine queue pages and two outcomes. Each page shows the tickets sitting at one status, and the action on that page is what moves them to the next one.",
    km: "ទំព័រជួរការងារ ៩ និងលទ្ធផល ២។ ទំព័រនីមួយៗបង្ហាញសំណុំរឿងដែលនៅស្ថានភាពតែមួយ ហើយសកម្មភាពនៅទំព័រនោះជាអ្វីដែលរុញវាទៅដំណាក់កាលបន្ទាប់។",
  },
  topics: [...INTAKE_TOPICS, ...FULFILMENT_TOPICS],
};
