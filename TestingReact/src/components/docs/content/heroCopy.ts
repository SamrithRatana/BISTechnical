/**
 * @file components/docs/content/heroCopy.ts
 * @description The page's own furniture copy — hero, search, lifecycle intro,
 * footer. Everything that is *about* the manual rather than *in* it.
 *
 * Bilingual inline, like the rest of the catalogue (see `docsTypes.ts` for why
 * this is not in `i18n/en.ts`). The Khmer is written, not machine-translated,
 * and reuses the vocabulary the app already puts on screen — ប្រព័ន្ធ, ជួសជុល,
 * គ្រឿងបន្លាស់, របាយការណ៍ — so a reader moving between the manual and a queue
 * screen meets the same words in both places.
 */

import type { Bilingual } from "../docsTypes";

export const HERO_COPY: Record<
  "badge" | "title" | "titleAccent" | "subtitle" | "ctaStart" | "ctaLifecycle",
  Bilingual
> = {
  badge: {
    en: "Complete system documentation",
    km: "ឯកសារណែនាំពេញលេញនៃប្រព័ន្ធ",
  },
  title: {
    en: "Learn the whole system, one screen at a time",
    km: "រៀនប្រើប្រាស់ប្រព័ន្ធទាំងមូល ម្ដងមួយអេក្រង់",
  },
  /** Must appear verbatim inside `title` — the hero splits on it. */
  titleAccent: {
    en: "the whole system",
    km: "ប្រព័ន្ធទាំងមូល",
  },
  subtitle: {
    en: "Every page, every button and every rule of the Service & Maintenance Portal — from signing in with your face to closing a repair, moving stock and printing the monthly report. Written for the people who use it, not for the people who built it.",
    km: "គ្រប់ទំព័រ គ្រប់ប៊ូតុង និងគ្រប់ច្បាប់នៃប្រព័ន្ធសេវាកម្ម និងថែទាំ — ចាប់ពីការចូលប្រព័ន្ធដោយស្កេនមុខ រហូតដល់បិទការងារជួសជុល គ្រប់គ្រងស្តុក និងបោះពុម្ពរបាយការណ៍ប្រចាំខែ។ សរសេរសម្រាប់អ្នកប្រើប្រាស់ មិនមែនសម្រាប់អ្នកសរសេរកម្មវិធីទេ។",
  },
  ctaStart: {
    en: "Start reading",
    km: "ចាប់ផ្ដើមអាន",
  },
  ctaLifecycle: {
    en: "See the repair lifecycle",
    km: "មើលដំណើរការជួសជុល",
  },
};

export const SEARCH_COPY: Record<"placeholder" | "clear" | "noResults" | "noResultsHint", Bilingual> = {
  placeholder: {
    en: "Search the manual — a page, a button, a rule…",
    km: "ស្វែងរកក្នុងឯកសារ — ទំព័រ ប៊ូតុង ឬច្បាប់…",
  },
  clear: {
    en: "Clear search",
    km: "សម្អាតការស្វែងរក",
  },
  noResults: {
    en: "Nothing in the manual matches that",
    km: "រកមិនឃើញអ្វីដែលត្រូវនឹងពាក្យនោះទេ",
  },
  noResultsHint: {
    en: "Try a page name (receive item), a route (/spareparts) or a status (Awaiting Sparepart).",
    km: "សាកល្បងឈ្មោះទំព័រ (receive item) ផ្លូវទំព័រ (/spareparts) ឬស្ថានភាព (Awaiting Sparepart)។",
  },
};

export const LIFECYCLE_COPY: Record<"eyebrow" | "title" | "body" | "footnote", Bilingual> = {
  eyebrow: {
    en: "The one diagram to remember",
    km: "ដ្យាក្រាមមួយដែលត្រូវចាំ",
  },
  title: {
    en: "How a repair ticket travels through the system",
    km: "របៀបដែលសំណុំរឿងជួសជុលធ្វើដំណើរក្នុងប្រព័ន្ធ",
  },
  body: {
    en: "Every machine that comes through the door follows this chain. Each stop is a status, each status has its own queue page, and the person who owns that page is the one who moves the ticket on. Tap any stop to read its instructions.",
    km: "គ្រប់ម៉ាស៊ីនដែលចូលមកសុទ្ធតែដើរតាមខ្សែច្រវាក់នេះ។ ចំណតនីមួយៗគឺជាស្ថានភាពមួយ ស្ថានភាពនីមួយៗមានទំព័រជួរការងាររបស់វា ហើយអ្នកទទួលបន្ទុកទំព័រនោះជាអ្នករុញសំណុំរឿងទៅមុខ។ ចុចលើចំណតណាមួយដើម្បីអានការណែនាំ។",
  },
  footnote: {
    en: "The codes in grey are the exact status values you will see in the Status column and in every report filter.",
    km: "អក្សរពណ៌ប្រផេះគឺជាតម្លៃស្ថានភាពពិតប្រាកដ ដែលអ្នកនឹងឃើញក្នុងជួរឈរ Status និងក្នុងតម្រងរបាយការណ៍ទាំងអស់។",
  },
};

export const FOOTER_COPY: Record<"signIn" | "download" | "note", Bilingual> = {
  signIn: {
    en: "Go to sign in",
    km: "ទៅកាន់ការចូលប្រព័ន្ធ",
  },
  download: {
    en: "Get the CAM ID mobile app",
    km: "ទាញយកកម្មវិធី CAM ID",
  },
  note: {
    en: "This manual describes the portal as it is built today. If a screen behaves differently from what you read here, trust the screen and tell your administrator.",
    km: "ឯកសារនេះពណ៌នាអំពីប្រព័ន្ធតាមស្ថានភាពបច្ចុប្បន្ន។ បើអេក្រង់ណាមួយដំណើរការខុសពីអ្វីដែលអ្នកអានទីនេះ សូមជឿលើអេក្រង់ ហើយជូនដំណឹងដល់អ្នកគ្រប់គ្រងប្រព័ន្ធ។",
  },
};

/** Trust-strip figures under the hero headline — exactly the three the hero
 *  renders; a fourth here would be a label with nothing to label. */
export const HERO_STAT_LABELS: Record<"chapters" | "topics" | "stages", Bilingual> = {
  chapters: { en: "chapters", km: "ជំពូក" },
  topics: { en: "documented screens", km: "អេក្រង់មានឯកសារ" },
  stages: { en: "workflow stages", km: "ដំណាក់កាលការងារ" },
};

/**
 * Reader furniture — the words around an article rather than in it.
 *
 * `stepOf` and `articlesIn` carry `{n}` / `{m}` placeholders instead of being
 * assembled by concatenation, because Khmer does not put the number where
 * English does: "Step 4 of 12" is "ជំហានទី ៤ ក្នុងចំណោម ១២", and a
 * `"Step " + n + " of " + m` would strand the reader with English word order
 * wrapped around Khmer text.
 */
export const READER_COPY: Record<
  | "chapter"
  | "stepOf"
  | "articlesIn"
  | "status"
  | "openInApp"
  | "prev"
  | "next"
  | "backToTop"
  | "onThisPage"
  | "menu",
  Bilingual
> = {
  chapter: { en: "Chapter", km: "ជំពូក" },
  stepOf: { en: "Step {n} of {m}", km: "ជំហានទី {n} ក្នុងចំណោម {m}" },
  articlesIn: { en: "{n} pages", km: "{n} ទំព័រ" },
  status: { en: "Ticket status", km: "ស្ថានភាពសំបុត្រ" },
  openInApp: { en: "Open this screen", km: "បើកអេក្រង់នេះ" },
  prev: { en: "Previous", km: "មុន" },
  next: { en: "Next", km: "បន្ទាប់" },
  backToTop: { en: "Back to top", km: "ត្រឡប់ទៅលើ" },
  onThisPage: { en: "On this page", km: "នៅក្នុងទំព័រនេះ" },
  menu: { en: "Documentation menu", km: "មាតិកាឯកសារ" },
};

/** The chapter map under the lifecycle rail — the "where do I start" answer. */
export const PATHWAY_COPY: Record<"eyebrow" | "title" | "body" | "start", Bilingual> = {
  eyebrow: {
    en: "The reading path",
    km: "ផ្លូវនៃការអាន",
  },
  title: {
    en: "Five chapters, in the order they make sense",
    km: "ជំពូកទាំង ៥ តាមលំដាប់ដែលងាយយល់",
  },
  body: {
    en: "Start at the top and press next at the bottom of every page — you will have read the manual front to back without ever choosing where to go. Or jump straight to the chapter that covers the screen in front of you.",
    km: "ចាប់ផ្ដើមពីខាងលើ រួចចុច «បន្ទាប់» នៅចុងទំព័រនីមួយៗ — អ្នកនឹងអានឯកសារនេះចប់ពីដើមដល់ចប់ ដោយមិនចាំបាច់រើសផ្លូវឡើយ។ ឬលោតទៅជំពូកដែលពន្យល់អំពីអេក្រង់នៅចំពោះមុខអ្នកតែម្ដង។",
  },
  start: { en: "Start here", km: "ចាប់ផ្ដើមទីនេះ" },
};

const KHMER_DIGITS = "០១២៣៤៥៦៧៨៩";

/**
 * Fills `{n}` / `{m}` in the templates above, rendering the numbers in Khmer
 * numerals when the reader is in Khmer.
 *
 * Not cosmetic: the catalogue's own prose already writes counts that way
 * ("ដំណាក់កាលទាំង ១១"), so a Latin-digit counter beside it reads as a
 * string the translator missed. Applied only to values interpolated INTO
 * Khmer prose — the mono chapter numbers and step chips stay Latin, where they
 * are a visual index rather than something being read aloud.
 */
export function fillCopy(
  template: string,
  values: Record<string, string | number>,
  isKhmer = false
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    if (!(key in values)) return match;
    const value = String(values[key]);
    return isKhmer ? value.replace(/[0-9]/g, (d) => KHMER_DIGITS[Number(d)]) : value;
  });
}
