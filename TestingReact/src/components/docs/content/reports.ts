/**
 * @file components/docs/content/reports.ts
 * @description Chapter 04 — reports, and the printed sheet the customer keeps.
 *
 * Topics live in `reportsUsing.ts` (shared mechanics) and
 * `reportsCatalogue.ts` (which report answers which question). The A4 template
 * designer is documented in chapter 05, beside the other things only an
 * administrator publishes.
 */

import type { DocChapter } from "../docsTypes";
import { DOCS_REPORT_COUNT } from "./reportCount";
import { REPORT_USING_TOPICS } from "./reportsUsing";
import { REPORT_CATALOGUE_TOPICS } from "./reportsCatalogue";

export const REPORTS_CHAPTER: DocChapter = {
  id: "reports",
  index: "04",
  accent: "amber",
  icon: "chart",
  title: { en: "Reports & printing", km: "របាយការណ៍ និងការបោះពុម្ព" },
  tagline: {
    en: `${DOCS_REPORT_COUNT} reports over the same data. ${DOCS_REPORT_COUNT - 1} are spreadsheets you filter, read and export; one is the A4 sheet a customer receives with their machine.`,
    km: `របាយការណ៍ ${DOCS_REPORT_COUNT} លើទិន្នន័យដដែល។ ${DOCS_REPORT_COUNT - 1} ជាតារាងដែលអ្នកត្រង អាន និងនាំចេញ; មួយទៀតជាសន្លឹក A4 ដែលអតិថិជនទទួលជាមួយម៉ាស៊ីនរបស់ពួកគេ។`,
  },
  topics: [...REPORT_USING_TOPICS, ...REPORT_CATALOGUE_TOPICS],
};
