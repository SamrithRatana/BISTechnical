"use client";

/**
 * @file components/login/OtherMethodsButton.tsx
 * @description The "Other Sign-In Methods" secondary action that appears
 * under every auth panel — one definition instead of the three copies v1
 * carried.
 */

import React from "react";
import { motion } from "framer-motion";
import { ArrowRight, Layers } from "lucide-react";
import { useI18n } from "@/i18n/LanguageProvider";

interface OtherMethodsButtonProps {
  onClick: () => void;
}

export default function OtherMethodsButton({ onClick }: OtherMethodsButtonProps) {
  const { lang } = useI18n();

  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.015, y: -1 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="w-full py-2 rounded-xl bg-slate-100/90 hover:bg-slate-200/80 border border-slate-200/90 hover:border-emerald-500/50 text-slate-700 hover:text-slate-900 shadow-xs dark:bg-slate-800/80 dark:hover:bg-slate-800 dark:border-white/10 dark:hover:border-emerald-500/40 dark:text-slate-300 dark:hover:text-white text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer dark:shadow-sm group"
    >
      <Layers className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 group-hover:rotate-12 transition-transform" />
      <span>{lang === "km" ? "ជ្រើសរើសរបៀប Sign In ផ្សេងទៀត" : "Other Sign-In Methods"}</span>
      <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-white group-hover:translate-x-0.5 transition-transform" />
    </motion.button>
  );
}
