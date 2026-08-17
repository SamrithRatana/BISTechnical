"use client";

/**
 * @file ai/AiAssistantPanel.tsx
 * @description The assistant as a floating live-chat widget panel.
 *
 * Designed after modern live-chat widgets: a titled header with live status,
 * a scrolling transcript of bubbles with timestamp and feedback controls,
 * and a composer pinned to the bottom.
 */

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  X, Loader2, AlertCircle, Cpu, Check, ArrowUp, Trash2,
  Copy, ThumbsUp, ThumbsDown, Bot, Download
} from "lucide-react";
import toast from "react-hot-toast";
import { useI18n } from "@/i18n/LanguageProvider";
import { translateStatus, translateServiceType } from "@/i18n/statusLabel";
import { useAiAssistant, type ChatMessage } from "./AiAssistantProvider";

const BADGE =
  "px-1.5 py-0.5 rounded bg-white/80 border border-accent text-ink ";

function formatWait(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`;
}

function formatTime(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * A save-as name built from what was drawn.
 *
 * Latin letters and digits only: the prompt may be Khmer, and Windows in
 * particular mangles a non-ASCII download name into something unopenable, so a
 * Khmer prompt falls back to the generic stem rather than a broken file.
 */
function imageFileName(prompt: string): string {
  const stem = prompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return stem || "generated-image";
}

/** Extension matching what the model actually returned, not an assumed PNG. */
function imageFileExt(mimeType: string): string {
  const subtype = mimeType.split("/")[1]?.split(";")[0]?.trim();
  return subtype === "jpeg" ? "jpg" : subtype || "png";
}

export default function AiAssistantPanel() {
  const ai = useAiAssistant();
  const { t, lang } = useI18n();
  const [draft, setDraft] = useState("");
  const [showModels, setShowModels] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  const open = ai?.open ?? false;
  const messages = ai?.messages;
  const loading = ai?.loading;

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading, open]);

  if (!ai || !open || typeof document === "undefined") return null;

  const send = () => {
    const text = draft.trim();
    if (!text || ai.loading) return;
    ai.ask(text);
    setDraft("");
  };

  const limitedCount = ai.models.filter((m) => !m.available).length;
  const isKhmer = lang === "km";

  return createPortal(
    <aside
      role="complementary"
      aria-label={t("ai.panelTitle")}
      className="fixed top-0 right-0 z-[95] h-screen w-[min(26rem,100vw)] flex flex-col bg-elevated border-l border-subtle shadow-2xl dropdown-panel-in"
    >
      {/* ── Top Header Bar ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-info/20 bg-gradient-to-r from-info via-info to-accent text-white shadow-md">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-full bg-white/20 border border-white/30 p-0.5 flex items-center justify-center overflow-hidden shadow-inner">
              <div className="w-full h-full rounded-full bg-info flex items-center justify-center text-white font-bold text-sm">
                <Bot className="w-5 h-5 text-white" />
              </div>
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-success border-2 border-info shadow-sm" />
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold text-white truncate tracking-wide">
                {isKhmer ? "បូណ៌មី BEAURAMEI" : "BEAURAMEI AI"}
              </h2>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/15 text-[10px] font-semibold text-info-fg border border-white/20">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                Live Chat
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 text-white/80 shrink-0">
          <button
            type="button"
            onClick={() => {
              setShowModels((v) => !v);
              ai.refreshModels();
            }}
            title={t("ai.model")}
            className="relative p-1.5 rounded-lg hover:bg-white/15 transition-colors"
          >
            <Cpu className="w-4 h-4" />
            {limitedCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[1rem] h-4 px-1 rounded-full bg-warning text-[9px] font-bold text-warning-fg flex items-center justify-center">
                {limitedCount}
              </span>
            )}
          </button>

          {ai.messages.length > 0 && (
            <button
              type="button"
              onClick={ai.clear}
              title={t("ai.clearChat")}
              className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => ai.setOpen(false)}
            title={t("ai.close")}
            className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

      {/* ── Model picker (collapsible) ─────────────────────────────────── */}
      {showModels && (
        <div className="px-3 py-2.5 border-b border-subtle bg-cushion ">
          <div className="flex flex-col gap-0.5 max-h-64 overflow-y-auto">
            {/* Two lists, not one: the text models answer questions and the
                image models draw. Merging them would let someone pick a model
                that cannot answer what they are about to type. */}
            <SectionLabel>{t("ai.modelSectionText")}</SectionLabel>
            <ModelOption
              label={t("ai.modelAuto")}
              selected={ai.selectedModel === ""}
              available
              onClick={() => ai.setSelectedModel("")}
            />
            {ai.models.map((m) => (
              <ModelOption
                key={m.id}
                label={m.label}
                selected={ai.selectedModel === m.id}
                available={m.available}
                note={
                  m.available
                    ? undefined
                    : m.retryInSeconds > 0
                      ? t("ai.modelLimited", { time: formatWait(m.retryInSeconds) })
                      : t("ai.modelLimitedUnknown")
                }
                onClick={() => ai.setSelectedModel(m.id)}
              />
            ))}

            {ai.imageModels.length > 0 && (
              <>
                <SectionLabel>{t("ai.modelSectionImage")}</SectionLabel>
                <ModelOption
                  label={t("ai.modelAuto")}
                  selected={ai.selectedImageModel === ""}
                  available
                  onClick={() => ai.setSelectedImageModel("")}
                />
                {ai.imageModels.map((m) => (
                  <ModelOption
                    key={m.id}
                    label={m.label}
                    selected={ai.selectedImageModel === m.id}
                    available={m.available}
                    note={
                      m.available
                        ? undefined
                        : m.retryInSeconds > 0
                          ? t("ai.modelLimited", { time: formatWait(m.retryInSeconds) })
                          : t("ai.modelNeedsBilling")
                    }
                    onClick={() => ai.setSelectedImageModel(m.id)}
                  />
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Transcript ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-4 bg-cushion/70 ">
        {ai.messages.length === 0 && !ai.loading && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8">
            <div className="w-12 h-12 rounded-full bg-info-soft text-info flex items-center justify-center mb-3">
              <Bot className="w-6 h-6" />
            </div>
            <p className="text-xs font-semibold text-ink mb-1">
              {isKhmer ? "សូមស្វាគមន៍មកកាន់ ជំនួយការ AI!" : "Welcome to AI Assistant!"}
            </p>
            <p className="text-xs text-ink-muted leading-relaxed max-w-xs">
              {t("ai.empty")}
            </p>
          </div>
        )}

        {ai.messages.map((m) => (
          <Bubble key={m.id} message={m} quotaWait={ai.quotaWait} />
        ))}

        {ai.loading && (
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-full bg-info text-white flex items-center justify-center shrink-0 text-xs">
              <Bot className="w-4 h-4" />
            </div>
            <div className="px-3.5 py-2.5 rounded-2xl rounded-tl-none bg-elevated border border-subtle text-xs text-ink-secondary flex items-center gap-2 shadow-sm">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-info " />
              <span>{t("ai.thinking")}</span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* ── Composer & Bottom Controls ─────────────────────────────────── */}
      <div className="border-t border-subtle bg-elevated p-3">
        <div className="flex items-center gap-2 bg-sunken border border-subtle/80 rounded-full px-3.5 py-1.5 focus-within:ring-2 focus-within:ring-info/30 focus-within:border-info transition-all">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={isKhmer ? "សូមសួរអំពីព័ត៌មានពាក់ព័ន្ធ..." : t("ai.composer")}
            className="flex-1 bg-transparent text-xs text-ink placeholder-ink-muted focus:outline-none py-1"
          />
          <button
            type="button"
            onClick={send}
            disabled={!draft.trim() || ai.loading}
            title={t("ai.send")}
            className="shrink-0 w-8 h-8 rounded-full bg-info text-white flex items-center justify-center hover:bg-info disabled:opacity-40 disabled:hover:bg-info transition-colors shadow-sm"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
        </div>

        {/* Footer info text */}
        <p className="mt-2 text-[10px] text-center text-ink-muted tracking-tight">
          {isKhmer ? "© ២០២៦ រក្សាសិទ្ធិដោយ ប្រព័ន្ធគ្រប់គ្រងសេវាកម្ម និងជួសជុល" : "© 2026 Service & Maintenance AI Assistant"}
        </p>
      </div>
    </aside>,
    document.body
  );
}

/** One turn in the conversation transcript */
function Bubble({ message, quotaWait }: { message: ChatMessage; quotaWait: number | null }) {
  const { t, lang } = useI18n();
  const [liked, setLiked] = useState<boolean | null>(null);

  const copyText = (text: string) => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(text);
      toast.success(lang === "km" ? "បានចម្លងអត្ថបទ" : "Copied to clipboard");
    }
  };

  if (message.role === "user") {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-br-none bg-info text-white text-[13px] leading-relaxed shadow-sm whitespace-pre-line">
          {message.text}
        </div>
        <span className="text-[10px] text-ink-muted pr-1 font-medium">{formatTime(message.at)}</span>
      </div>
    );
  }

  const f = message.filters;
  const hasBadges =
    f?.grounded &&
    (f.searchTerm || f.status || f.staffName || f.fromDate || f.toDate || f.serviceType);

  return (
    <div className="flex items-start gap-2 max-w-[95%]">
      <div className="w-7 h-7 rounded-full bg-info text-white flex items-center justify-center shrink-0 text-xs mt-0.5 shadow-sm">
        <Bot className="w-4 h-4" />
      </div>

      <div className="flex flex-col items-start gap-1 min-w-0 flex-1">
        <div className="w-full px-3.5 py-2.5 rounded-2xl rounded-tl-none bg-elevated border border-subtle/80 shadow-sm">
          {message.text ? (
            <p className="text-[13px] leading-relaxed text-ink whitespace-pre-line">
              {message.text}
            </p>
          ) : null}

          {message.image && (
            <figure className="mt-2 first:mt-0">
              {/* A data URL, so next/image would only add a proxy hop it can't
                  optimise — a plain img is the right element here. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={message.image.dataUrl}
                alt={message.image.prompt}
                className="w-full rounded-xl border border-subtle bg-sunken "
              />
              <figcaption className="flex items-center justify-between gap-2 mt-1.5 text-[10px] text-ink-muted">
                <span className="truncate">{message.image.label}</span>
                <a
                  href={message.image.dataUrl}
                  download={`${imageFileName(message.image.prompt)}.${imageFileExt(message.image.mimeType)}`}
                  className="inline-flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded hover:text-info-fg hover:bg-sunken transition-colors"
                >
                  <Download className="w-3 h-3" />
                  {t("ai.imageDownload")}
                </a>
              </figcaption>
            </figure>
          )}

          {/* Image failures are explained in the reply text itself, in the
              user's own language, so repeating a generic note under them would
              only contradict it ("showing a normal search instead" is not what
              happened). Only the text-path reasons get a footer. */}
          {message.degraded && !message.degraded.reason.startsWith("image") && (
            <p className="flex items-start gap-1.5 mt-1.5 text-[11px] text-warning-fg ">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                {message.degraded.reason !== "quotaExceeded"
                  ? t("header.aiFailed")
                  : quotaWait
                    ? t("header.aiQuotaWait", { time: formatWait(quotaWait) })
                    : t("header.aiQuotaUnknown")}
              </span>
            </p>
          )}

          {hasBadges && (
            <div className="flex flex-wrap items-center gap-1 mt-2 text-[10px]">
              <span className="font-semibold text-info-fg ">
                {t("header.aiUnderstood")}
              </span>
              {f.searchTerm && <span className={BADGE}>&ldquo;{f.searchTerm}&rdquo;</span>}
              {f.staffName && <span className={BADGE}>{f.staffName}</span>}
              {f.status && <span className={BADGE}>{translateStatus(f.status, t)}</span>}
              {(f.fromDate || f.toDate) && (
                <span className={BADGE}>
                  {f.fromDate ?? "…"} → {f.toDate ?? "…"}
                </span>
              )}
              {f.serviceType && <span className={BADGE}>{translateServiceType(f.serviceType, t)}</span>}
            </div>
          )}
        </div>

        {/* Action bar under assistant reply */}
        <div className="flex items-center justify-between w-full px-1 text-[10px] text-ink-muted">
          <span>
            {formatTime(message.at)}
            {message.servedBy && ` · ${message.servedBy}`}
            {/* Only set when the picked model couldn't answer — otherwise the
                checkmark in the picker silently misreports what ran. */}
            {message.requestedModel && message.servedBy && (
              <span className="ml-1 text-warning ">
                ·{" "}
                {t("ai.modelSubstituted", {
                  requested: message.requestedModel,
                  served: message.servedBy
                })}
              </span>
            )}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => copyText(message.text)}
              title="Copy"
              className="p-1 hover:text-ink-secondary transition-colors"
            >
              <Copy className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => setLiked(liked === true ? null : true)}
              title="Helpful"
              className={`p-1 transition-colors ${liked === true ? "text-info font-bold" : "hover:text-ink-secondary "}`}
            >
              <ThumbsUp className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => setLiked(liked === false ? null : false)}
              title="Not helpful"
              className={`p-1 transition-colors ${liked === false ? "text-danger font-bold" : "hover:text-ink-secondary "}`}
            >
              <ThumbsDown className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Group heading inside the picker ("Answering" / "Images"). */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2.5 pt-2 pb-1 text-[9px] font-bold uppercase tracking-wider text-ink-muted ">
      {children}
    </p>
  );
}

function ModelOption({
  label,
  selected,
  available,
  note,
  onClick
}: {
  label: string;
  selected: boolean;
  available: boolean;
  note?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] text-left transition-colors ${
        selected
          ? "bg-info text-white"
          : "text-ink-secondary hover:bg-sunken/70 "
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${available ? "bg-success" : "bg-warning"}`}
      />
      <span className="flex-1 truncate font-medium">{label}</span>
      {note && (
        <span className={selected ? "text-info-fg" : "text-warning "}>
          {note}
        </span>
      )}
      {selected && <Check className="w-3 h-3 shrink-0" />}
    </button>
  );
}
