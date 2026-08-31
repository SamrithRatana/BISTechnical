/**
 * @file components/docs/content/gettingStarted.ts
 * @description Chapter 01 — getting in, and finding your way once you are.
 *
 * The topics live in `startAccess.ts` (the front door) and `startWorkspace.ts`
 * (the workspace itself) so no one file runs past ~300 lines.
 */

import type { DocChapter } from "../docsTypes";
import { ACCESS_TOPICS } from "./startAccess";
import { WORKSPACE_TOPICS } from "./startWorkspace";

export const GETTING_STARTED_CHAPTER: DocChapter = {
  id: "getting-started",
  index: "01",
  accent: "violet",
  icon: "rocket",
  title: { en: "Getting started", km: "ចាប់ផ្ដើមប្រើប្រាស់" },
  tagline: {
    en: "How to sign in — four different ways — and how the workspace is laid out once you are through the door. Read this one first, whatever job you do.",
    km: "របៀបចូលប្រព័ន្ធ — មានបួនវិធី — និងរបៀបរៀបចំកន្លែងធ្វើការក្រោយពេលចូលរួច។ សូមអានជំពូកនេះមុនគេ ទោះអ្នកធ្វើការផ្នែកណាក៏ដោយ។",
  },
  topics: [...ACCESS_TOPICS, ...WORKSPACE_TOPICS],
};
