"use client";

import React, { useEffect } from "react";
import { captureSystemError } from "@/services/systemObservability";
import { getUserRoles } from "@/services/authSession";

export function ObservabilityProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const getContext = () => {
      let username = "anonymous";
      try {
        const raw = localStorage.getItem("user_info");
        if (raw) {
          const parsed = JSON.parse(raw);
          username = parsed.username || parsed.fullName || parsed.email || "user";
        }
      } catch {}
      const roles = getUserRoles();
      return {
        username,
        role: roles.length ? roles.join(", ") : "User",
      };
    };

    const handleError = (event: ErrorEvent) => {
      try {
        captureSystemError({
          serviceId: "web-frontend",
          message: event.message || "Unhandled Javascript runtime error in frontend",
          severity: "ERROR",
          endpoint: typeof window !== "undefined" ? window.location.pathname : "/client-ui",
          stackTrace: event.error?.stack || `${event.filename}:${event.lineno}:${event.colno}`,
          userContext: getContext(),
        });
      } catch {}
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      try {
        const reason = event.reason;
        const msg = reason instanceof Error ? reason.message : String(reason);
        const stack = reason instanceof Error ? reason.stack : undefined;
        captureSystemError({
          serviceId: "web-frontend",
          message: `Unhandled Promise Rejection: ${msg}`,
          severity: "ERROR",
          endpoint: typeof window !== "undefined" ? window.location.pathname : "/client-ui",
          stackTrace: stack,
          userContext: getContext(),
        });
      } catch {}
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return <>{children}</>;
}
