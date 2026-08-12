"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // Hooks MUST be called unconditionally — no early returns before this
  useEffect(() => {
    // Login page: no auth check needed
    if (pathname === "/login") {
      setIsAuthenticated(true);
      return;
    }

    const token = localStorage.getItem("jwt_token");
    if (!token) {
      setIsAuthenticated(false);
      router.replace("/login");
    } else {
      setIsAuthenticated(true);
    }
  }, [pathname, router]);

  // Login page: render immediately without waiting for useEffect
  if (pathname === "/login") {
    return <>{children}</>;
  }

  // Protected routes: show loading while checking auth
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center mb-4 animate-pulse">
          <Sparkles className="w-6 h-6" />
        </div>
        <p className="text-xs text-slate-400 font-medium">Verifying JWT Authentication...</p>
      </div>
    );
  }

  // Unauthenticated — redirecting
  if (isAuthenticated === false) {
    return null;
  }

  return <>{children}</>;
}
