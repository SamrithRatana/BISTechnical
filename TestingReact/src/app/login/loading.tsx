import React from "react";

/**
 * @file app/login/loading.tsx
 * @description Dedicated loading state for the sign-in portal.
 *
 * Matches the login page's dark marketing palette and volumetric light-well aesthetic.
 */
export default function LoginLoading() {
  return (
    <div className="min-h-screen bg-[#06090E] text-slate-100 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans select-none">
      <div className="absolute w-[500px] h-[500px] bg-emerald-500/15 rounded-full blur-[140px] pointer-events-none animate-pulse" />
      <div className="relative z-10 w-full max-w-[420px] rounded-3xl bg-slate-900/60 border border-slate-800/80 p-8 shadow-2xl backdrop-blur-xl flex flex-col items-center gap-6">
        {/* Brand logo skeleton */}
        <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center animate-pulse">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/30" />
        </div>

        {/* Title & subtitle skeleton */}
        <div className="space-y-2 text-center w-full flex flex-col items-center">
          <div className="h-6 w-36 bg-slate-800 rounded-lg animate-pulse" />
          <div className="h-3.5 w-52 bg-slate-800/60 rounded-md animate-pulse" />
        </div>

        {/* Inputs skeleton */}
        <div className="w-full space-y-4 pt-2">
          <div className="h-11 w-full bg-slate-800/50 rounded-xl border border-slate-700/40 animate-pulse" />
          <div className="h-11 w-full bg-slate-800/50 rounded-xl border border-slate-700/40 animate-pulse" />
          <div className="h-11 w-full bg-emerald-600/30 rounded-xl border border-emerald-500/20 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
