"use client";

/**
 * @file app/docs/page.tsx
 * @description The manual — hero, the repair lifecycle drawn once, the reading
 * path, then the three-column reader.
 *
 * Default theme is DARK MODE.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Menu, Search, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import DocsHeader from "@/components/docs/DocsHeader";
import DocsHero from "@/components/docs/DocsHero";
import DocsFooter from "@/components/docs/DocsFooter";
import DocsPathway from "@/components/docs/DocsPathway";
import DocsSidebarNav from "@/components/docs/DocsSidebarNav";
import DocsArticleView from "@/components/docs/DocsArticleView";
import DocsOnThisPage from "@/components/docs/DocsOnThisPage";
import LifecycleRail from "@/components/docs/LifecycleRail";
import {
  DOCS_ALL_ARTICLES,
  DOCS_ARTICLE_COUNT,
  DOCS_DEFAULT_ARTICLE_ID,
  DOCS_SECTION_COUNT,
} from "@/components/docs/content/docsData";
import { LIFECYCLE_STAGES } from "@/components/docs/content/lifecycle";
import { HERO_STAT_LABELS, READER_COPY, SEARCH_COPY } from "@/components/docs/content/heroCopy";
import { docsArticleIdFromHash } from "@/components/docs/docsOutline";
import { DUR } from "@/components/docs/motion";
import { DocsThemeProvider, useDocsTheme } from "@/components/docs/DocsThemeContext";
import { useDocsMotionMode } from "@/components/docs/useDocsMotionMode";
import { useDocsText } from "@/components/docs/useDocsText";

/** Ids, resolved once — the hash reader checks against this on every change. */
const ARTICLE_IDS = new Set(DOCS_ALL_ARTICLES.map((article) => article.id));

const READER_SECTION_ID = "docs-reader";

/**
 * The page proper. Split out of the default export purely so it can sit INSIDE
 * `DocsThemeProvider` and read the same `isDark` every child reads — the shell
 * and its children used to hold two independent answers to that question.
 */
function DocsPageInner() {
  const mode = useDocsMotionMode();
  const { text, isKhmer } = useDocsText();
  const { isDark, toggle } = useDocsTheme();

  const [query, setQuery] = useState("");
  const [activeArticleId, setActiveArticleId] = useState<string>(DOCS_DEFAULT_ARTICLE_ID);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const searchRef = React.useRef<HTMLInputElement>(null);

  const activeArticle = useMemo(
    () =>
      DOCS_ALL_ARTICLES.find((article) => article.id === activeArticleId) ?? DOCS_ALL_ARTICLES[0],
    [activeArticleId]
  );

  useEffect(() => {
    const readHash = () => {
      const hash = window.location.hash.replace("#", "");
      if (!hash) return;
      const articleId = docsArticleIdFromHash(hash);
      if (!articleId || !ARTICLE_IDS.has(articleId)) return;

      setActiveArticleId(articleId);

      setTimeout(() => {
        const targetElement = document.getElementById(hash) || document.getElementById(READER_SECTION_ID);
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
    };

    readHash();
    window.addEventListener("hashchange", readHash);
    return () => window.removeEventListener("hashchange", readHash);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;

      event.preventDefault();
      searchRef.current?.focus();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const openArticle = useCallback(
    (articleId: string) => {
      setActiveArticleId(articleId);
      setMobileNavOpen(false);
      window.history.replaceState(null, "", `#${articleId}`);
      const readerEl = document.getElementById(READER_SECTION_ID);
      if (readerEl) {
        const rect = readerEl.getBoundingClientRect();
        if (rect.top < -50 || rect.top > 250) {
          readerEl.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    },
    []
  );

  const openArticleAndScroll = useCallback(
    (articleId: string) => {
      openArticle(articleId);
      document.getElementById(READER_SECTION_ID)?.scrollIntoView({
        behavior: mode === "full" ? "smooth" : "auto",
        block: "start",
      });
    },
    [mode, openArticle]
  );

  const stats = useMemo(
    () => [
      { value: String(DOCS_SECTION_COUNT), label: text(HERO_STAT_LABELS.chapters) },
      { value: String(DOCS_ARTICLE_COUNT), label: text(HERO_STAT_LABELS.topics) },
      { value: String(LIFECYCLE_STAGES.length), label: text(HERO_STAT_LABELS.stages) },
    ],
    [text]
  );

  const searchInput = (
    <div className="relative w-full max-w-md">
      <Search
        aria-hidden
        className={`pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 ${isDark ? "text-slate-500" : "text-slate-600"}`}
      />
      <input
        ref={searchRef}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label={text(SEARCH_COPY.placeholder)}
        placeholder={text(SEARCH_COPY.placeholder)}
        className={`w-full rounded-xl border py-2 pl-10 pr-16 text-xs transition-colors focus:border-violet-400 focus:outline-none ${isDark ? "border-white/10 bg-white/[0.05] text-white placeholder:text-slate-500 focus:bg-white/[0.08]" : "border-slate-200 bg-white text-slate-900 placeholder:text-slate-500 shadow-sm focus:bg-slate-50"}`}
      />
      {query ? (
        <button
          type="button"
          onClick={() => setQuery("")}
          aria-label={text(SEARCH_COPY.clear)}
          className={`absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer rounded-md p-1 transition-colors ${isDark ? "text-slate-400 hover:bg-white/10 hover:text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : (
        <kbd
          aria-hidden
          className={`absolute right-3 top-1/2 -translate-y-1/2 rounded border px-1.5 py-0.5 font-mono text-[10px] ${isDark ? "border-white/10 bg-white/[0.06] text-slate-500" : "border-slate-300 bg-slate-100 text-slate-600"}`}
        >
          /
        </kbd>
      )}
    </div>
  );

  return (
    <div
      className={`relative min-h-screen overflow-x-clip font-sans transition-colors duration-300 ${isDark ? "text-slate-100 selection:bg-violet-500/30" : "text-slate-800 selection:bg-violet-500/20"}`}
      style={{
        background: isDark
          ? "linear-gradient(180deg, #04050d, #080a18 45%, #04050d)"
          : "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 45%, #f8fafc 100%)",
      }}
    >
      <DocsHeader
        mode={mode}
        search={searchInput}
        isDark={isDark}
        onToggleTheme={toggle}
      />

      <DocsHero
        mode={mode}
        onStart={() => openArticleAndScroll(DOCS_DEFAULT_ARTICLE_ID)}
        onLifecycle={() => openArticleAndScroll("workflow-lifecycle")}
        stats={stats}
      />

      <LifecycleRail stages={LIFECYCLE_STAGES} mode={mode} onOpenTopic={openArticleAndScroll} />

      <DocsPathway
        mode={mode}
        activeArticleId={activeArticleId}
        onOpenArticle={openArticleAndScroll}
      />

      <div id={READER_SECTION_ID} className="mx-auto max-w-7xl 2xl:max-w-[1536px] scroll-mt-20 px-4 py-12 sm:px-6 lg:px-8">
        <div className="lg:hidden">
          <button
            type="button"
            onClick={() => setMobileNavOpen((open) => !open)}
            aria-expanded={mobileNavOpen}
            className={`flex w-full cursor-pointer items-center gap-2 rounded-xl border p-3 text-xs font-bold transition-colors ${isDark ? "border-white/10 bg-white/[0.03] text-violet-300" : "border-slate-200 bg-white text-violet-700 shadow-sm"}`}
          >
            {mobileNavOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            <span>{text(READER_COPY.menu)}</span>
            <span className={`ml-auto truncate font-normal ${isDark ? "text-slate-400" : "text-slate-600"}`}>
              {isKhmer ? activeArticle.titleKm : activeArticle.titleEn}
            </span>
          </button>

          <AnimatePresence initial={false}>
            {mobileNavOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: DUR.panel }}
                className="overflow-hidden"
              >
                <div className="space-y-6 pt-4">
                  <DocsSidebarNav
                    activeArticleId={activeArticleId}
                    onSelectArticle={openArticle}
                    searchQuery={query}
                  />
                  <div className={`border-t pt-4 ${isDark ? "border-white/10" : "border-slate-200"}`}>
                    <DocsOnThisPage article={activeArticle} />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* The three-column reader */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:mt-0 lg:grid-cols-12 xl:gap-6 2xl:gap-8">
          {/* Left: Sticky sidebar navigation */}
          <aside className="hidden lg:col-span-3 lg:block xl:col-span-3 2xl:col-span-3">
            <div className="sticky top-20 max-h-[calc(100vh-5.5rem)] overflow-y-auto pr-3 overscroll-contain docs-sidebar-scroll">
              <DocsSidebarNav
                activeArticleId={activeArticleId}
                onSelectArticle={openArticle}
                searchQuery={query}
              />
            </div>
          </aside>

          {/* Centre: Article content */}
          <main className="min-w-0 lg:col-span-9 xl:col-span-9 2xl:col-span-7">
            <DocsArticleView
              article={activeArticle}
              onSelectArticle={openArticleAndScroll}
            />
          </main>

          {/* Right: On this page outline */}
          <aside className="hidden 2xl:col-span-2 2xl:block">
            <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pl-1 docs-sidebar-scroll">
              <DocsOnThisPage article={activeArticle} />
            </div>
          </aside>
        </div>
      </div>

      <DocsFooter mode={mode} />
    </div>
  );
}

export default function DocsPage() {
  return (
    <DocsThemeProvider>
      <DocsPageInner />
    </DocsThemeProvider>
  );
}
