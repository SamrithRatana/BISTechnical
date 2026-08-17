"use client";

import React from "react";
import Link from "next/link";
import { Home, Sparkles } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-ink text-ink flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-accent/20 border border-info/30 text-info flex items-center justify-center mb-6 shadow-xl shadow-accent/10">
        <Sparkles className="w-8 h-8" />
      </div>
      <h1 className="text-6xl font-extrabold tracking-tight text-white mb-2">404</h1>
      <h2 className="text-xl font-bold text-ink mb-3">Page Not Found</h2>
      <p className="text-sm text-ink-muted max-w-md mb-8">
        The requested service module or page route could not be located in the Service & Maintenance System.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-white font-semibold text-xs hover:bg-accent-hover transition-colors shadow-lg shadow-accent/25"
      >
        <Home className="w-4 h-4" />
        <span>Return to Home Dashboard</span>
      </Link>
    </div>
  );
}
