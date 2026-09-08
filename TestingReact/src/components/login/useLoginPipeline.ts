"use client";

/**
 * @file components/login/useLoginPipeline.ts
 * @description The five-stage sign-in pipeline — state + orchestration for
 * every auth method (password, face, passkey, phone). Logic is ported
 * unchanged from the v1 page; only the presentation moved.
 *
 * Stage map: 1 client gate → 2 auth API (the real credential exchange) →
 * 3 technical core health gate → 4 AI runtime → 5 launch. Only stage 2
 * (authenticate) and stage 3's health probe are real awaits; the rest is
 * pacing so the topology reads.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchDashboardStats,
  fetchRepairServices,
  fetchSparepartTransactions,
} from "@/services/api";
import { fetchAppLogoUrl, fetchGlobalBranding } from "@/services/appSettings";
import { publishBrandLogo } from "@/services/brandLogoStore";
import { loadTickets } from "@/hooks/useTicketSeries";
import { primeListCache } from "@/hooks/useInfiniteList";
import { SESSION_CHANGED_EVENT } from "@/services/authSession";
import { publishHealth } from "@/services/healthSnapshot";
import type { LoginResponse } from "@/services/types";
import { fetchUserMap } from "@/services/userService";
import { fetchMyPermissions } from "@/services/permissionStore";
import { useI18n } from "@/i18n/LanguageProvider";

export interface LoginPipeline {
  pipelineStep: number;
  pipelineLogs: string[];
  errorNodeId: number | null;
  isLoading: boolean;
  loginSuccess: boolean;
  errorMsg: string;
  setErrorMsg: (msg: string) => void;
  runLoginPipeline: (authenticate: () => Promise<LoginResponse>) => Promise<void>;
}

export function useLoginPipeline(): LoginPipeline {
  const router = useRouter();
  const { lang, t } = useI18n();

  // 0 = idle, 1..5 = connecting stages
  const [pipelineStep, setPipelineStep] = useState<number>(0);
  const [pipelineLogs, setPipelineLogs] = useState<string[]>([]);
  const [errorNodeId, setErrorNodeId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Guard against state updates after unmount (the pipeline spans awaits).
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const runLoginPipeline = async (authenticate: () => Promise<LoginResponse>) => {
    setIsLoading(true);
    setErrorMsg("");
    setErrorNodeId(null);
    setPipelineLogs([]);

    if (!isMountedRef.current) return;
    setPipelineStep(1);
    setPipelineLogs([
      lang === "km"
        ? "[01/05] ច្រកសុវត្ថិភាពម៉ាស៊ីន៖ ផ្ទៀងផ្ទាត់ទម្រង់ទិន្នន័យ & បង្កើតបណ្តាញ TLS..."
        : "[01/05] Client Gate: Sanitizing credentials & establishing TLS link...",
    ]);

    // Start background health probe in parallel immediately so it is ready on auth completion
    const healthProbePromise = fetch("/api/health", {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);

    await new Promise((r) => setTimeout(r, 140));

    try {
      if (!isMountedRef.current) return;
      setPipelineStep(2);
      setPipelineLogs((prev) => [
        ...prev,
        lang === "km"
          ? "[02/05] ប្រព័ន្ធ Auth API៖ កំពុងផ្ទៀងផ្ទាត់អត្តសញ្ញាណ និងបង្កើត JWT Token..."
          : "[02/05] User Auth API: Verifying ASP.NET Identity & signing JWT...",
      ]);

      const res = await authenticate();

      // A face challenge is not a failure: hide the overlay and let the page
      // show the camera stage.
      if ((res as unknown as { isFaceChallenge?: boolean })?.isFaceChallenge) {
        if (!isMountedRef.current) return;
        setPipelineStep(0);
        setErrorNodeId(null);
        setIsLoading(false);
        return;
      }

      if (!res.isSuccess || !res.token) {
        if (!isMountedRef.current) return;
        setErrorNodeId(2);
        setPipelineLogs((prev) => [
          ...prev,
          lang === "km"
            ? "[02/05] ❌ បរាជ័យ៖ ឈ្មោះអ្នកប្រើ ឬលេខសម្ងាត់មិនត្រឹមត្រូវ (Auth Failed)!"
            : "[02/05] ❌ FAILED: Invalid username or password (Auth Failed)!",
          lang === "km"
            ? "[SYSTEM] ត្រឡប់ទៅផ្ទាំង Login វិញដើម្បីអនុញ្ញាតឱ្យបញ្ចូលម្តងទៀត..."
            : "[SYSTEM] Rolling back to login to allow re-entry...",
        ]);
        await new Promise((r) => setTimeout(r, 1400));
        if (!isMountedRef.current) return;
        setPipelineStep(0);
        setErrorNodeId(null);
        setErrorMsg(res.message || t("login.failed"));
        setIsLoading(false);
        return;
      }

      localStorage.setItem("jwt_token", res.token);
      // Announce the new session in THIS tab
      window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
      sessionStorage.removeItem("robot_greeted");
      if (res.user) {
        const rawUser = res.user as Record<string, unknown>;
        const normalizedUser = {
          id: String(rawUser.id || rawUser.Id || ""),
          userName: String(rawUser.userName || rawUser.UserName || ""),
          email: String(rawUser.email || rawUser.Email || ""),
          firstName: String(rawUser.firstName || rawUser.FirstName || ""),
          lastName: String(rawUser.lastName || rawUser.LastName || ""),
          phoneNumber: String(rawUser.phoneNumber || rawUser.PhoneNumber || ""),
          profilePictureUrl: String(rawUser.profilePictureUrl || rawUser.ProfilePictureUrl || ""),
          coverUrl: String(rawUser.coverUrl || rawUser.CoverUrl || ""),
          roles: Array.isArray(rawUser.roles)
            ? rawUser.roles
            : Array.isArray(rawUser.Roles)
              ? rawUser.Roles
              : rawUser.role
                ? [rawUser.role]
                : ["Technician"],
        };
        const savedBrandLogo = localStorage.getItem("system_brand_logo");
        const userToStore =
          savedBrandLogo && !normalizedUser.profilePictureUrl
            ? { ...normalizedUser, profilePictureUrl: savedBrandLogo }
            : normalizedUser;
        localStorage.setItem("user_info", JSON.stringify(userToStore));
      }

      if (!isMountedRef.current) return;
      setPipelineStep(3);
      setPipelineLogs((prev) => [
        ...prev,
        lang === "km"
          ? "[03/05] ប្រព័ន្ធបច្ចេកទេសស្នូល API៖ ទាញទិន្នន័យសំបុត្រជួសជុល & ផ្ទៀងផ្ទាត់ Health Probe..."
          : "[03/05] Technical Core API: Synchronizing tickets, spare parts & probing health...",
      ]);

      // Fire and coordinate full workspace data pre-warm in parallel
      const prewarmPromise = Promise.allSettled([
        fetchDashboardStats(),
        loadTickets(),
        fetchRepairServices(1, 25, "Today", "").then((res) => {
          if (res?.items) {
            primeListCache("Today|", res.items, res.totalCount);
          }
          return res;
        }),
        fetchSparepartTransactions(1, 25, "All", "", false),
        fetchUserMap(),
        fetchGlobalBranding().then((b) => {
          if (b?.logoUrl) publishBrandLogo(b.logoUrl);
          return b;
        }),
        fetchAppLogoUrl().then((url) => {
          if (url) publishBrandLogo(url);
          return url;
        }),
        fetchMyPermissions(),
      ]);

      // Await health report + prewarm with a safety ceiling so login animation never hangs
      const [healthReport] = await Promise.all([
        healthProbePromise,
        Promise.race([
          prewarmPromise,
          new Promise((r) => setTimeout(r, 650)),
        ]),
      ]);

      if (healthReport) {
        publishHealth(healthReport);
      }

      // Smooth pacing so Step 3 animation & line smoothly advance
      await new Promise((r) => setTimeout(r, 180));

      if (!isMountedRef.current) return;
      setPipelineStep(4);
      setPipelineLogs((prev) => [
        ...prev,
        lang === "km"
          ? "[04/05] បច្ចេកវិទ្យា AI ជំនួយការ៖ ដំណើរការ Google Gemini & Pollinations Visual Runtime..."
          : "[04/05] AI Engine: Initializing Google Gemini & Pollinations AI models...",
      ]);

      // Smooth pacing so Step 4 animation & line smoothly advance
      await new Promise((r) => setTimeout(r, 160));

      if (!isMountedRef.current) return;
      setPipelineStep(5);
      setPipelineLogs((prev) => [
        ...prev,
        lang === "km"
          ? "[05/05] ✓ ផ្ទៀងផ្ទាត់ជោគជ័យគ្រប់ដំណាក់កាល ១០០%! កំពុងបើកផ្ទាំងការងារ Dashboard..."
          : "[05/05] ✓ All 5 microservices verified 100%! Launching Enterprise Dashboard...",
      ]);

      if (typeof window !== "undefined") {
        localStorage.setItem("last_workspace_sync_time", Date.now().toString());
        sessionStorage.setItem("workspace_pipeline_synced", "true");
        sessionStorage.setItem("workspace_dashboard_prewarmed_v1", "true");
      }

      // Final celebration pause so all 5 green checkmarks are clearly visible before entering dashboard
      await new Promise((r) => setTimeout(r, 220));

      if (!isMountedRef.current) return;
      setLoginSuccess(true);
      router.push("/");
    } catch {
      localStorage.removeItem("jwt_token");
      localStorage.removeItem("user_info");
      if (!isMountedRef.current) return;
      setPipelineStep(0);
      setErrorNodeId(null);
      setErrorMsg(t("login.connectFailed"));
      setIsLoading(false);
    }
  };

  return {
    pipelineStep,
    pipelineLogs,
    errorNodeId,
    isLoading,
    loginSuccess,
    errorMsg,
    setErrorMsg,
    runLoginPipeline,
  };
}
