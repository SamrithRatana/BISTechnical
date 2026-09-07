"use client";

/**
 * @file components/docs/DocsArticleView.tsx
 * @description One page of the manual.
 *
 * Laid out the way a documentation page is: breadcrumb, then where this page
 * sits in its chapter, then the title, then real `<h2>` sections in a fixed
 * order — overview, flow, steps, reference, notes — and a prev/next pair that
 * walks the whole manual front to back.
 *
 * ─── Every number here is derived ───────────────────────────────────────────
 *
 * "Step 4 of 12" reads its position out of the catalogue array, and the
 * headings and their anchors come from `docsOutline()` — the same function the
 * right-hand rail calls. Neither can drift from what is actually on the page,
 * which is the failure the old version shipped: titles carried hand-typed
 * stage numbers that no longer matched the lifecycle once stages were added.
 *
 * Section ids are `<articleId>--<section>` so a link to one page's steps
 * cannot collide with another's, and so `page.tsx` can recover the article
 * from a pasted section link.
 */

import React from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Info,
  Lightbulb,
  Route,
  ShieldCheck,
} from "lucide-react";
import {
  DOCS_ALL_ARTICLES,
  docsSectionOf,
  type DocsArticle,
} from "./content/docsData";
import { READER_COPY, fillCopy } from "./content/heroCopy";
import DocsInteractiveFlow from "./DocsInteractiveFlow";
import DocsReportCatalogTable from "./DocsReportCatalogTable";
import { DOCS_OUTLINE_LABELS, docsAnchor } from "./docsOutline";
import { useDocsText } from "./useDocsText";
import { useDocsTheme } from "./DocsThemeContext";

interface DocsArticleViewProps {
  article: DocsArticle;
  onSelectArticle: (articleId: string) => void;
}

/** Callout skins, resolved to literal classes so Tailwind can see them. */
const CALLOUT_SKIN = {
  tip: { box: "border-amber-500/30 bg-amber-500/[0.07]", title: "text-amber-300", Icon: Lightbulb },
  warning: { box: "border-rose-500/30 bg-rose-500/[0.07]", title: "text-rose-300", Icon: AlertCircle },
  success: { box: "border-emerald-500/30 bg-emerald-500/[0.07]", title: "text-emerald-300", Icon: CheckCircle2 },
  info: { box: "border-sky-500/30 bg-sky-500/[0.07]", title: "text-sky-300", Icon: Info },
} as const;

/**
 * The same four callouts on a white page.
 *
 * A `-500/30` border over a `/[0.07]` tint is drawn to LIFT a near-black card;
 * on white it leaves a `-300` title at roughly 1.5:1. Opaque `-50` fills with
 * `-700`/`-800` ink instead, which is the relationship `docsAccent.ts`'s light
 * skin already settled on — amber takes `-800` there for the same reason it
 * does here, `-700` on its own fill being the one pair with no margin.
 */
const CALLOUT_SKIN_LIGHT = {
  tip: { box: "border-amber-600 bg-amber-50", title: "text-amber-800", Icon: Lightbulb },
  warning: { box: "border-rose-600 bg-rose-50", title: "text-rose-700", Icon: AlertCircle },
  success: { box: "border-emerald-600 bg-emerald-50", title: "text-emerald-700", Icon: CheckCircle2 },
  info: { box: "border-sky-600 bg-sky-50", title: "text-sky-700", Icon: Info },
} as const;

export default function DocsArticleView({ article, onSelectArticle }: DocsArticleViewProps) {
  const { text, isKhmer } = useDocsText();
  const { isDark } = useDocsTheme();

  // Position in the whole manual drives prev/next; position in the chapter
  // drives the counter, because "step 18 of 27" tells a technician nothing
  // while "step 4 of 12 in the repair workflow" tells them where they are.
  const flatIndex = DOCS_ALL_ARTICLES.findIndex((entry) => entry.id === article.id);
  const prevArticle = flatIndex > 0 ? DOCS_ALL_ARTICLES[flatIndex - 1] : null;
  const nextArticle =
    flatIndex >= 0 && flatIndex < DOCS_ALL_ARTICLES.length - 1
      ? DOCS_ALL_ARTICLES[flatIndex + 1]
      : null;

  const section = docsSectionOf(article.id);
  const chapterIndex = section ? section.articles.findIndex((entry) => entry.id === article.id) : -1;
  const chapterTotal = section ? section.articles.length : 0;
  const chapterProgress = chapterTotal > 0 ? ((chapterIndex + 1) / chapterTotal) * 100 : 0;

  const goTo = React.useCallback(
    (id: string) => {
      onSelectArticle(id);
      const readerEl = document.getElementById("docs-reader");
      if (readerEl) {
        readerEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    },
    [onSelectArticle]
  );

  return (
    <article className="min-w-0 w-full pb-24">
      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-xs ${isDark ? "text-slate-500" : "text-slate-600"}`}
      >
        <span>Docs</span>
        <span aria-hidden>/</span>
        <span className={isDark ? "text-slate-400" : "text-slate-600"}>
          {isKhmer ? article.categoryKm : article.categoryEn}
        </span>
        <span aria-hidden>/</span>
        <span className={`font-semibold ${isDark ? "text-violet-300" : "text-violet-700"}`}>
          {isKhmer ? article.titleKm : article.titleEn}
        </span>
      </nav>

      {/* Where this page sits in its chapter. The bar is the flow made
          visible — a reader can see how much of the chain is left. */}
      {chapterTotal > 1 && (
        <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span
            className={`font-mono text-[11px] font-bold uppercase tracking-[0.14em] ${isDark ? "text-slate-500" : "text-slate-600"}`}
          >
            {fillCopy(text(READER_COPY.stepOf), { n: chapterIndex + 1, m: chapterTotal }, isKhmer)}
          </span>
          <span
            aria-hidden
            className={`h-1 w-full max-w-[220px] overflow-hidden rounded-full ${isDark ? "bg-white/10" : "bg-slate-200"}`}
          >
            <span
              className={`block h-full rounded-full bg-gradient-to-r transition-[width] duration-300 ${isDark ? "from-violet-400 to-cyan-400" : "from-violet-600 to-cyan-700"}`}
              style={{ width: `${chapterProgress}%` }}
            />
          </span>
        </div>
      )}

      <header className={`mt-4 border-b pb-7 ${isDark ? "border-white/10" : "border-slate-200"}`}>
        <h1
          className={`text-3xl font-black sm:text-4xl ${isDark ? "text-white" : "text-slate-900"} ${
            isKhmer ? "leading-[1.35]" : "tracking-tight leading-tight"
          }`}
        >
          {isKhmer ? article.titleKm : article.titleEn}
        </h1>

        <p className={`mt-3 text-[15px] ${isDark ? "text-slate-400" : "text-slate-600"} ${isKhmer ? "leading-loose" : "leading-relaxed"}`}>
          {isKhmer ? article.subtitleKm : article.subtitleEn}
        </p>

        {/* Metadata chips: the exact status, the route, the roles. Kept below
            the title rather than above it — they are reference, not headline. */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {article.status && (
            <span
              title={text(READER_COPY.status)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-[11px] ${isDark ? "border-white/10 bg-white/[0.04] text-slate-300" : "border-slate-300 bg-white text-slate-700 shadow-sm"}`}
            >
              <span
                aria-hidden
                className={`h-1.5 w-1.5 rounded-full ${isDark ? "bg-emerald-400" : "bg-emerald-600"}`}
              />
              {article.status}
            </span>
          )}

          {article.route && (
            <Link
              href={article.route}
              className={`group inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-[11px] transition-colors ${isDark ? "border-white/10 bg-white/[0.04] text-slate-300 hover:border-violet-400/60 hover:text-white" : "border-slate-300 bg-white text-slate-700 shadow-sm hover:border-violet-600 hover:text-violet-700"}`}
            >
              <Route className={`h-3 w-3 ${isDark ? "text-cyan-400" : "text-cyan-700"}`} />
              {article.route}
              <ExternalLink className="h-2.5 w-2.5 opacity-50 transition-opacity group-hover:opacity-100" />
            </Link>
          )}

          {article.roles?.map((role) => (
            <span
              key={role}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${isDark ? "border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-300" : "border-emerald-600 bg-emerald-50 text-emerald-700"}`}
            >
              <ShieldCheck className="h-3 w-3" />
              {role}
            </span>
          ))}
        </div>
      </header>

      {/* ── Overview ─────────────────────────────────────────────────────── */}
      <section id={docsAnchor(article.id, "overview")} className="scroll-mt-28 pt-10">
        <h2 className={`text-lg font-bold ${isDark ? "text-white" : "text-slate-900"}`}>{text(DOCS_OUTLINE_LABELS.overview)}</h2>
        <p
          className={`mt-3 border-l-2 pl-4 text-[15px] ${isDark ? "border-violet-500/50 text-slate-200" : "border-violet-600 text-slate-700 font-medium"} ${
            isKhmer ? "leading-loose" : "leading-relaxed"
          }`}
        >
          {isKhmer ? article.summaryKm : article.summaryEn}
        </p>
      </section>

      {/* ── Flow ─────────────────────────────────────────────────────────── */}
      {article.diagram && (
        <section id={docsAnchor(article.id, "flow")} className="scroll-mt-28 pt-12">
          <h2 className={`text-lg font-bold ${isDark ? "text-white" : "text-slate-900"}`}>{text(DOCS_OUTLINE_LABELS.flow)}</h2>
          <DocsInteractiveFlow
            diagram={article.diagram}
            type={
              article.id === "login-process-flow"
                ? "login"
                : article.id === "system-architecture"
                ? "architecture"
                : article.id === "workflow-lifecycle"
                ? "lifecycle"
                : "general"
            }
          />
        </section>
      )}

      {/* ── Steps ────────────────────────────────────────────────────────── */}
      {article.steps && article.steps.length > 0 && (
        <section id={docsAnchor(article.id, "steps")} className="scroll-mt-28 pt-12">
          <h2 className={`text-lg font-bold ${isDark ? "text-white" : "text-slate-900"}`}>{text(DOCS_OUTLINE_LABELS.steps)}</h2>

          {/* An ordered list, drawn as a spine. The connector is a border on
              the <ol>, so it is one element rather than one per row and it
              cannot fall out of step with the items. */}
          <ol className={`mt-5 space-y-5 border-l pl-7 ${isDark ? "border-white/10" : "border-slate-200"}`}>
            {article.steps.map((step) => (
              <li key={step.number} className="relative">
                <span
                  aria-hidden
                  className={`absolute -left-[38px] flex h-6 w-6 items-center justify-center rounded-full border font-mono text-[11px] font-bold ${isDark ? "border-violet-400/40 bg-[#0a0c18] text-violet-300" : "border-violet-600 bg-white text-violet-700 shadow-sm"}`}
                >
                  {step.number}
                </span>
                <h3 className={`text-[15px] font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                  {isKhmer ? step.titleKm : step.titleEn}
                </h3>
                <p
                  className={`mt-1 text-sm ${isDark ? "text-slate-400" : "text-slate-600"} ${
                    isKhmer ? "leading-loose" : "leading-relaxed"
                  }`}
                >
                  {isKhmer ? step.descKm : step.descEn}
                </p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* ── Report catalogue ─────────────────────────────────────────────── */}
      {article.reportTableCategory && (
        <section id={docsAnchor(article.id, "reports")} className="scroll-mt-28 pt-12">
          <h2 className={`text-lg font-bold ${isDark ? "text-white" : "text-slate-900"}`}>{text(DOCS_OUTLINE_LABELS.reports)}</h2>
          <div className="mt-5">
            <DocsReportCatalogTable filterCategory={article.reportTableCategory} />
          </div>
        </section>
      )}

      {/* ── Notes & warnings ─────────────────────────────────────────────── */}
      {article.callouts && article.callouts.length > 0 && (
        <section id={docsAnchor(article.id, "notes")} className="scroll-mt-28 pt-12">
          <h2 className={`text-lg font-bold ${isDark ? "text-white" : "text-slate-900"}`}>{text(DOCS_OUTLINE_LABELS.notes)}</h2>

          <div className="mt-5 space-y-3">
            {article.callouts.map((callout, index) => {
              const skin = (isDark ? CALLOUT_SKIN : CALLOUT_SKIN_LIGHT)[callout.type];
              return (
                <div
                  key={`${callout.type}-${index}`}
                  className={`rounded-xl border p-4 sm:p-5 ${skin.box}`}
                >
                  <h3 className={`flex items-center gap-2 text-sm font-bold ${skin.title}`}>
                    <skin.Icon className="h-4 w-4 shrink-0" />
                    {isKhmer ? callout.titleKm : callout.titleEn}
                  </h3>
                  <p
                    className={`mt-1.5 text-sm ${isDark ? "text-slate-300" : "text-slate-800"} ${
                      isKhmer ? "leading-loose" : "leading-relaxed"
                    }`}
                  >
                    {isKhmer ? callout.contentKm : callout.contentEn}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Prev / next ──────────────────────────────────────────────────── */}
      <nav
        aria-label={isKhmer ? "ទំព័រមុន និងបន្ទាប់" : "Previous and next page"}
        className={`mt-16 grid gap-3 border-t pt-8 sm:grid-cols-2 ${isDark ? "border-white/10" : "border-slate-200"}`}
      >
        {prevArticle ? (
          <button
            type="button"
            onClick={() => goTo(prevArticle.id)}
            className={`group cursor-pointer rounded-xl border p-4 text-left transition-colors ${isDark ? "border-white/10 bg-white/[0.02] hover:border-violet-400/50 hover:bg-white/[0.05]" : "border-slate-200 bg-white text-slate-900 shadow-sm hover:border-violet-500 hover:shadow-md"}`}
          >
            <span
              className={`flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.12em] transition-colors ${isDark ? "text-slate-500 group-hover:text-violet-300" : "text-slate-600 group-hover:text-violet-700"}`}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              {text(READER_COPY.prev)}
            </span>
            <span className={`mt-1.5 block text-sm font-bold ${isDark ? "text-white" : "text-slate-900"}`}>

              {isKhmer ? prevArticle.titleKm : prevArticle.titleEn}
            </span>
          </button>
        ) : (
          <span aria-hidden />
        )}

        {nextArticle && (
          <button
            type="button"
            onClick={() => goTo(nextArticle.id)}
            className={`group cursor-pointer rounded-xl border p-4 text-right transition-colors ${isDark ? "border-white/10 bg-white/[0.02] hover:border-violet-400/50 hover:bg-white/[0.05]" : "border-slate-200 bg-white text-slate-900 shadow-sm hover:border-violet-500 hover:shadow-md"} sm:col-start-2`}
          >
            <span
              className={`flex items-center justify-end gap-1 text-[11px] font-bold uppercase tracking-[0.12em] transition-colors ${isDark ? "text-slate-500 group-hover:text-violet-300" : "text-slate-600 group-hover:text-violet-700"}`}
            >
              {text(READER_COPY.next)}
              <ChevronRight className="h-3.5 w-3.5" />
            </span>
            <span className={`mt-1.5 block text-sm font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
              {isKhmer ? nextArticle.titleKm : nextArticle.titleEn}
            </span>
          </button>
        )}
      </nav>
    </article>
  );
}
