"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Home, Sparkles } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center mb-6 shadow-xl shadow-blue-500/10">
        <Sparkles className="w-8 h-8" />
      </div>
      <h1 className="text-6xl font-extrabold tracking-tight text-white mb-2">404</h1>
      <h2 className="text-xl font-bold text-slate-200 mb-3">Page Not Found</h2>
      <p className="text-sm text-slate-400 max-w-md mb-8">
        The requested service module or page route could not be located in the Service & Maintenance System.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/25"
      >
        <Home className="w-4 h-4" />
        <span>Return to Home Dashboard</span>
      </Link>
    </div>
  );
}
