"use client";

/**
 * @file components/help/PageHelpDrawer.tsx
 * @description Universal contextual help drawer available on every page.
 *
 * Provides:
 * - Immediate summary of the active screen (តើទំព័រនេះសម្រាប់អ្វី?)
 * - Concrete step-by-step action instructions (ជំហានអនុវត្ត)
 * - Important caveats, tips & warnings (ចំណុចគួរដឹង)
 * - Deep link button directly to the exact article section on `/docs#<articleId>`
 * - One-click integration to ask Beta AI about this specific screen
 */

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  X,
  ExternalLink,
  Bot,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Info,
  ArrowRight,
  Loader2,
  Compass,
  FileText,
} from "lucide-react";
import { useI18n } from "@/i18n/LanguageProvider";
import { useAiAssistant } from "@/components/ai/AiAssistantProvider";
import { loadDocSummaryForRoute, RouteDocSummary } from "@/lib/routeDocMap";

interface PageHelpDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PageHelpDrawer({ isOpen, onClose }: PageHelpDrawerProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { lang } = useI18n();
  const isKhmer = lang === "km";
  const ai = useAiAssistant();

  const [loading, setLoading] = useState(false);
  const [docSummary, setDocSummary] = useState<RouteDocSummary | null>(null);

  // Fetch contextual doc summary whenever drawer opens or route changes
  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    setLoading(true);

    void loadDocSummaryForRoute(pathname).then((res) => {
      if (mounted) {
        setDocSummary(res);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, [isOpen, pathname]);

  // Handle ESC key to dismiss
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  const handleOpenDocs = () => {
    onClose();
    if (docSummary?.docsUrl) {
      router.push(docSummary.docsUrl);
    } else {
      router.push("/docs");
    }
  };

  const handleAskAi = () => {
    if (!ai || !docSummary) return;
    onClose();
    ai.setOpen(true);
    const question = isKhmer
      ? `សូមពន្យល់ពីរបៀបប្រើប្រាស់ទំព័រ "${docSummary.titleKm}" (${pathname}) ឱ្យខ្ញុំបានយល់លម្អិត។`
      : `Please explain how to use the "${docSummary.titleEn}" page (${pathname}) in detail.`;
    ai.ask(question);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] overflow-hidden flex justify-end">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm cursor-pointer"
            aria-hidden="true"
          />

          {/* Slide-over Drawer Panel */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={isKhmer ? "ផ្ទាំងជំនួយទំព័រនេះ" : "Page Help Guide"}
            initial={{ x: "100%", opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="relative w-full max-w-lg h-full bg-surface border-l border-subtle shadow-2xl flex flex-col z-[210] overflow-hidden"
          >
            {/* Top Bar Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-subtle bg-surface/90 backdrop-blur-md shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-accent-soft text-accent flex items-center justify-center shrink-0 shadow-sm border border-accent/20">
                  <Compass className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent-soft text-accent border border-accent/20">
                      {isKhmer ? "ជំនួយប្រព័ន្ធ" : "Page Guide"}
                    </span>
                    {docSummary?.badge && (
                      <span className="text-[10px] font-medium text-ink-muted truncate">
                        {docSummary.badge}
                      </span>
                    )}
                  </div>
                  <h2 className="text-base font-bold text-ink truncate leading-tight mt-0.5">
                    {loading ? (
                      <span className="inline-block w-32 h-4 bg-sunken animate-pulse rounded" />
                    ) : (
                      (isKhmer ? docSummary?.titleKm : docSummary?.titleEn) || "ឯកសារជំនួយ"
                    )}
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-muted hover:text-ink hover:bg-sunken transition-colors"
                title={isKhmer ? "បិទ" : "Close"}
                aria-label={isKhmer ? "បិទ" : "Close"}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
              {loading ? (
                <div className="space-y-4 py-8">
                  <div className="flex items-center justify-center gap-2 text-ink-muted text-sm">
                    <Loader2 className="w-5 h-5 animate-spin text-accent" />
                    <span>{isKhmer ? "កំពុងទាញយកមគ្គុទ្ទេសក៍..." : "Loading page guide..."}</span>
                  </div>
                  <div className="h-20 bg-sunken/60 animate-pulse rounded-2xl" />
                  <div className="h-32 bg-sunken/60 animate-pulse rounded-2xl" />
                </div>
              ) : docSummary ? (
                <>
                  {/* Category & Current Route Path */}
                  <div className="flex items-center justify-between text-xs px-3 py-2 rounded-xl bg-cushion/80 border border-subtle">
                    <span className="text-ink-secondary font-medium">
                      {isKhmer ? docSummary.categoryKm : docSummary.categoryEn}
                    </span>
                    <span className="font-mono text-[11px] text-accent font-semibold px-2 py-0.5 rounded bg-surface border border-subtle">
                      {pathname}
                    </span>
                  </div>

                  {/* Section 1: Overview / What is this page for? */}
                  <section className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-accent" />
                      {isKhmer ? "តើទំព័រនេះប្រើសម្រាប់អ្វី?" : "What is this page for?"}
                    </h3>
                    <div className="p-4 rounded-2xl bg-sunken/50 border border-subtle text-sm text-ink leading-relaxed">
                      {isKhmer ? docSummary.summaryKm : docSummary.summaryEn}
                    </div>
                  </section>

                  {/* Section 2: Step-by-Step Instructions */}
                  {docSummary.steps && docSummary.steps.length > 0 && (
                    <section className="space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                        {isKhmer ? "ជំហានអនុវត្តជាក់ស្តែង" : "Step-by-Step Instructions"}
                      </h3>
                      <div className="space-y-2.5">
                        {docSummary.steps.map((step, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-3 p-3.5 rounded-xl bg-surface border border-subtle hover:border-accent/40 transition-colors shadow-sm"
                          >
                            <span className="w-6 h-6 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                              {step.number || idx + 1}
                            </span>
                            <div className="min-w-0 space-y-1">
                              <p className="text-xs font-bold text-ink">
                                {isKhmer ? step.titleKm : step.titleEn}
                              </p>
                              <p className="text-xs text-ink-secondary leading-normal">
                                {isKhmer ? step.descKm : step.descEn}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Section 3: Callouts / Warnings & Tips */}
                  {docSummary.callouts && docSummary.callouts.length > 0 && (
                    <section className="space-y-2.5">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-warning" />
                        {isKhmer ? "ចំណុចគួរដឹង & ការព្រមាន" : "Key Notes & Tips"}
                      </h3>
                      {docSummary.callouts.map((c, idx) => (
                        <div
                          key={idx}
                          className={`p-3.5 rounded-xl border text-xs leading-relaxed ${
                            c.type === "warning"
                              ? "bg-warning-soft border-warning/30 text-warning-fg"
                              : c.type === "success"
                              ? "bg-success-soft border-success/30 text-success-fg"
                              : "bg-accent-soft border-accent/30 text-accent-soft-fg"
                          }`}
                        >
                          <div className="font-bold mb-1 flex items-center gap-1.5">
                            {c.type === "warning" ? (
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            ) : (
                              <Info className="w-3.5 h-3.5 shrink-0" />
                            )}
                            <span>{isKhmer ? c.titleKm : c.titleEn}</span>
                          </div>
                          <p>{isKhmer ? c.contentKm : c.contentEn}</p>
                        </div>
                      ))}
                    </section>
                  )}
                </>
              ) : null}
            </div>

            {/* Bottom Sticky Action Footer */}
            <div className="p-4 border-t border-subtle bg-surface/95 backdrop-blur-md space-y-2 shrink-0">
              {/* Button 1: Open Full Documentation on /docs#<articleId> */}
              <button
                type="button"
                onClick={handleOpenDocs}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-accent text-white font-semibold text-xs shadow-md hover:bg-accent-hover transition-all active:scale-[0.99]"
              >
                <BookOpen className="w-4 h-4" />
                <span>
                  {isKhmer
                    ? "អានឯកសារណែនាំពេញលេញលើ Docs"
                    : "Read Full Documentation in Docs"}
                </span>
                <ExternalLink className="w-3.5 h-3.5 opacity-80 ml-0.5" />
              </button>

              {/* Button 2: Ask Beta AI */}
              <button
                type="button"
                onClick={handleAskAi}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl border border-subtle bg-cushion hover:bg-sunken text-ink text-xs font-medium transition-colors"
              >
                <Bot className="w-3.5 h-3.5 text-accent" />
                <span>
                  {isKhmer
                    ? "សួរនាំ Beta AI អំពីទំព័រនេះ"
                    : "Ask Beta AI About This Page"}
                </span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
