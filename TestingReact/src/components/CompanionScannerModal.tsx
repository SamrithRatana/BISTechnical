"use client";

import React, { useState } from "react";
import {
  Smartphone,
  CheckCircle2,
  Copy,
  Check,
  Radio,
  X,
  ExternalLink,
  RefreshCw,
  Unlink,
} from "lucide-react";
import toast from "react-hot-toast";
import { ModalWrapper } from "@/components/av/ModalWrapper";
import QRCodeSvg from "./QRCodeSvg";
import { useI18n } from "@/i18n/LanguageProvider";
import { useCompanionScanner } from "@/context/CompanionScannerContext";

export interface CompanionScannerModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
}

export default function CompanionScannerModal({
  open,
  onClose,
  title,
}: CompanionScannerModalProps) {
  const { lang } = useI18n();
  const isKhmer = lang === "km";

  const {
    sessionId,
    mobileUrl,
    isPhoneConnected,
    scanCount,
    lastScannedCode,
    disconnectPhone,
    regenerateSession,
  } = useCompanionScanner();

  const [copied, setCopied] = useState<boolean>(false);

  const handleCopyUrl = () => {
    if (!mobileUrl) return;
    navigator.clipboard.writeText(mobileUrl);
    setCopied(true);
    toast.success(isKhmer ? "បានចម្លង Link រួចរាល់!" : "Link Copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ModalWrapper
      open={open}
      onClose={onClose}
      maxWidth="max-w-md"
      zIndex={210}
      placement="center"
      backdropVariant="heavy"
    >
      {/* Bounded column: the pairing title and the Copy Link / Test Tab row
          stay put, the QR and status block scrolls. At 1366x768 the natural
          height is 553px against a 525px budget once the header band is
          reserved — 28px, but 28px that would otherwise have taken the close
          button with it. */}
      <div className="p-6 flex flex-col items-center text-center select-none max-h-[var(--av-modal-inner-maxh)]">
        {/* ── Modal Header ── */}
        <div className="w-full shrink-0 flex items-center justify-between pb-3 mb-4 border-b border-black/[0.06] dark:border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
            <div className="text-left">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {title || (isKhmer ? "ភ្ជាប់ទូរស័ព្ទធ្វើជា Barcode Scanner" : "Link Mobile Barcode Scanner")}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {isKhmer ? "ស្កេន QR តែ ១ ដង ប្រើបានជាប់រហូត" : "Scan QR once to pair as wireless scanner"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 flex items-center justify-center text-slate-500 dark:text-slate-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="w-full flex-1 min-h-0 overflow-y-auto overscroll-contain flex flex-col items-center">
        {/* ── Status Banner ── */}
        <div className="w-full mb-3">
          {isPhoneConnected ? (
            <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold animate-in fade-in">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>
                {isKhmer
                  ? "ទូរស័ព្ទបានភ្ជាប់ជោគជ័យ! 🟢 អាចស្កេនបានគ្រប់ពេល..."
                  : "Phone Connected! 🟢 Ready to scan anytime..."}
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-semibold">
              <Radio className="w-3.5 h-3.5 animate-pulse text-amber-500" />
              <span>{isKhmer ? "កំពុងរង់ចាំទូរស័ព្ទ Scan QR Code..." : "Waiting for phone to scan QR..."}</span>
            </div>
          )}
        </div>

        {/* ── QR Code Card ── */}
        <div className="relative p-3 rounded-3xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-inner mb-3">
          <QRCodeSvg value={mobileUrl} size={200} />

          {isPhoneConnected && (
            <div className="absolute inset-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xs rounded-3xl flex flex-col items-center justify-center p-4 text-center animate-in fade-in duration-200">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center mb-2 animate-bounce">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                {isKhmer ? "ទូរស័ព្ទបានភ្ជាប់រួចរាល់ 🟢" : "Phone Linked as Scanner"}
              </p>
              <p className="text-[11px] text-slate-500 mt-1 max-w-[180px]">
                {isKhmer ? "លោកអ្នកអាចបិទផ្ទាំងនេះ ហើយស្កេនលើទូរស័ព្ទបានតាមចិត្ត" : "You can close this popup and keep scanning from phone"}
              </p>
              {lastScannedCode && (
                <div className="mt-2 px-3 py-1.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/50 border border-cyan-500/30 text-xs font-mono font-bold text-cyan-700 dark:text-cyan-300">
                  ⚡ {lastScannedCode}
                </div>
              )}
            </div>
          )}
        </div>

        {/* URL Pill Indicator */}
        {mobileUrl && (
          <div className="w-full mb-3 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-[11px] font-mono text-slate-600 dark:text-slate-300 max-w-full truncate flex items-center justify-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse shrink-0" />
            <span className="truncate">{mobileUrl}</span>
          </div>
        )}

        {/* ── Instructions & Stats ── */}
        <div className="w-full flex items-center justify-between px-3 py-2 mb-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
          <span className="text-slate-600 dark:text-slate-300 font-medium">
            {isKhmer ? "ចំនួនកូដដែលបានស្កេន៖" : "Total Codes Scanned:"}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-mono font-bold text-[11px]">
            {scanCount} {isKhmer ? "កូដ" : "scans"}
          </span>
        </div>

        </div>

        {/* ── Actions / Copy Link / Re-pair / Disconnect ── */}
        <div className="w-full shrink-0 flex flex-col gap-2 pt-2 border-t border-black/[0.06] dark:border-white/[0.08]">
          <div className="w-full flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyUrl}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              <span>{copied ? (isKhmer ? "បានចម្លង" : "Copied") : isKhmer ? "ចម្លង Link" : "Copy Link"}</span>
            </button>

            <a
              href={mobileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/20 text-xs font-semibold transition-colors"
              title="Open locally in new tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>{isKhmer ? "Test Tab" : "Test Tab"}</span>
            </a>
          </div>

          {isPhoneConnected && (
            <button
              type="button"
              onClick={() => {
                disconnectPhone();
                onClose();
              }}
              className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Unlink className="w-3.5 h-3.5" />
              <span>{isKhmer ? "ផ្តាច់ការតភ្ជាប់ទូរស័ព្ទ (Disconnect)" : "Disconnect Phone"}</span>
            </button>
          )}
        </div>
      </div>
    </ModalWrapper>
  );
}
