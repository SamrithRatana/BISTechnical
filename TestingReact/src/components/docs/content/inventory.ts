/**
 * @file components/docs/content/inventory.ts
 * @description Chapter 03 — inventory, spare parts and the stock behind them.
 *
 * Topics live in `inventoryCatalogues.ts` (the catalogues and the manual stock
 * moves) and `inventoryStockReports.ts` (the eight reports that explain the
 * numbers), so no one file runs past ~300 lines.
 */

import type { DocChapter } from "../docsTypes";
import { CATALOGUE_TOPICS } from "./inventoryCatalogues";
import { STOCK_REPORT_TOPICS } from "./inventoryStockReports";

export const INVENTORY_CHAPTER: DocChapter = {
  id: "inventory",
  index: "03",
  accent: "emerald",
  icon: "package",
  title: { en: "Inventory & stock", km: "សារពើភណ្ឌ និងស្តុក" },
  tagline: {
    en: "Two catalogues — machines and spare parts — and the eight reports that explain where the stock went. Most stock moves on its own when a repair is approved; the rest you move by hand, with a reason.",
    km: "បញ្ជីពីរ — ម៉ាស៊ីន និងគ្រឿងបន្លាស់ — និងរបាយការណ៍ប្រាំបីដែលពន្យល់ថាស្តុកទៅណា។ ស្តុកភាគច្រើនផ្លាស់ទីដោយខ្លួនឯងពេលការជួសជុលត្រូវបានអនុម័ត; ចំណែកដែលនៅសល់ អ្នកផ្លាស់ដោយដៃ ព្រមទាំងមូលហេតុ។",
  },
  topics: [...CATALOGUE_TOPICS, ...STOCK_REPORT_TOPICS],
};
