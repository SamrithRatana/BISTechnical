"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Smartphone,
  CheckCircle2,
  X,
  Radio,
  Zap,
  QrCode,
  Unlink,
  ExternalLink,
  ChevronDown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCompanionScanner } from "@/context/CompanionScannerContext";
import { useI18n } from "@/i18n/LanguageProvider";

export default function CompanionScannerHeaderButton() {
  const { lang } = useI18n();
  const isKhmer = lang === "km";

  const {
    isPhoneConnected,
    scanCount,
    lastScannedCode,
    openPairingModal,
    disconnectPhone,
    regenerateSession,
  } = useCompanionScanner();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  if (!isPhoneConnected) {
    return (
      <button
        type="button"
        onClick={openPairingModal}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/25 rounded-xl transition-all shadow-2xs cursor-pointer active:scale-95 shrink-0"
        title={isKhmer ? "ភ្ជាប់ទូរស័ព្ទធ្វើជា Barcode Scanner" : "Link Phone as Hardware Scanner"}
      >
        <Smartphone className="w-3.5 h-3.5" />
        <span className="hidden xl:inline">{isKhmer ? "ភ្ជាប់ទូរស័ព្ទ" : "Link Phone"}</span>
      </button>
    );
  }

  return (
    <div className="relative shrink-0" ref={menuRef}>
      <button
        type="button"
        onClick={() => setMenuOpen(!menuOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 rounded-xl transition-all shadow-2xs cursor-pointer active:scale-95"
        title={isKhmer ? "ទូរស័ព្ទកំពុងដំណើរការជា Barcode Scanner" : "Phone Active as Hardware Scanner"}
      >
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
        <Smartphone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span className="hidden xl:inline">
          {isKhmer ? "ទូរស័ព្ទភ្ជាប់រួច" : "Phone Linked"}
        </span>
        {scanCount > 0 && (
          <span className="px-1.5 py-0.2 rounded-full bg-emerald-500 text-slate-950 font-mono text-[10px] font-bold">
            {scanCount}
          </span>
        )}
        <ChevronDown className="w-3 h-3 text-emerald-600 dark:text-emerald-400 hidden xl:block" />
      </button>

      {/* Connected Dropdown Menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-64 p-3 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-800 shadow-2xl z-[300] space-y-3 text-xs"
          >
            {/* Header Status */}
            <div className="flex items-center justify-between pb-2 border-b border-black/[0.06] dark:border-white/[0.08]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">
                    {isKhmer ? "ទូរស័ព្ទភ្ជាប់រួចរាល់" : "Phone Linked"}
                  </p>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    {isKhmer ? "ស្កេនបាញ់ចូល Input ស្វ័យប្រវត្តិ" : "Auto-injecting to inputs"}
                  </p>
                </div>
              </div>

              <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-mono font-bold text-[11px] border border-emerald-500/30">
                {scanCount} {isKhmer ? "កូដ" : "scans"}
              </span>
            </div>

            {/* Last Scanned Code */}
            {lastScannedCode && (
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-0.5">
                  {isKhmer ? "កូដចុងក្រោយ" : "Last Scanned"}
                </p>
                <p className="font-mono font-bold text-cyan-600 dark:text-cyan-400 text-xs truncate">
                  ⚡ {lastScannedCode}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-1 pt-1">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  openPairingModal();
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition-colors cursor-pointer"
              >
                <QrCode className="w-4 h-4 text-cyan-500" />
                <span>{isKhmer ? "បង្ហាញ QR Code ឡើងវិញ" : "Show QR Code"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  disconnectPhone();
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-medium transition-colors cursor-pointer"
              >
                <Unlink className="w-4 h-4" />
                <span>{isKhmer ? "ផ្តាច់ការតភ្ជាប់ទូរស័ព្ទ (Unlink)" : "Disconnect Phone"}</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
