"use client";

/**
 * @file components/login/BrandChip.tsx
 * @description The white brand tile (logo or fallback icon) used by the form
 * header, the curtain header and the mobile header. Reads the shared brand
 * logo store directly so callers don't have to thread it through.
 */

import React from "react";
import { ShieldCheck, Sparkles } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import { useBrandLogo } from "@/services/brandLogoStore";
import { useTheme } from "@/theme/ThemeProvider";

interface BrandChipProps {
  /** sm = mobile header (32px), md = form/curtain headers (40–44px). */
  size?: "sm" | "md";
  fallback?: "sparkles" | "shield";
  className?: string;
}

export default function BrandChip({ size = "md", fallback = "sparkles", className = "" }: BrandChipProps) {
  const brandLogo = useBrandLogo();
  const { prefs } = useTheme();
  const FallbackIcon = fallback === "shield" ? ShieldCheck : Sparkles;
  const box = size === "sm" ? "w-8 h-8 rounded-xl p-1" : "w-10 h-10 xl:w-11 xl:h-11 rounded-2xl p-1.5";

  return (
    <div
      className={`${box} flex items-center justify-center border border-white/40 shadow-xl shadow-black/30 overflow-hidden bg-gradient-to-b from-white via-slate-50 to-slate-100 ring-1 ring-white/25 shrink-0 ${className}`}
    >
      {brandLogo ? (
        <BrandLogo
          src={brandLogo}
          alt="Logo"
          style={{ transform: `scale(${(prefs.logoScale ?? 130) / 100})` }}
          className="w-full h-full object-contain drop-shadow-xs"
        />
      ) : (
        <FallbackIcon className="w-4 h-4 text-slate-700" />
      )}
    </div>
  );
}
