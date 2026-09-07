"use client";

/**
 * @file app/face-link/page.tsx
 * @description The phone half of face pairing — what opens when someone scans
 * the QR code shown on the desktop.
 *
 * Two jobs, decided by the session the QR points at:
 *
 *  - **enroll**: capture three faces, pair this phone to the account that is
 *    signed in on the desktop, and keep the returned device token.
 *  - **login**: capture one face, prove it against the account this phone is
 *    already paired to, and let the desktop in.
 *
 * PUBLIC ROUTE (see `AuthGuard`), and it has to be: on the login path nobody is
 * signed in anywhere yet. Everything it can do is bounded by a pairing session
 * id that lives five minutes and is spent once.
 *
 * The device token is the one durable secret here. It lives in this phone's
 * `localStorage` under a key scoped to the origin, is never shown on screen, and
 * is never sent to the desktop.
 */

import React, { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, ScanFace, ShieldAlert, XCircle } from "lucide-react";
import FaceCapture from "@/components/FaceCapture";
import { isSecureCameraContext } from "@/lib/faceEmbedding";
import { useI18n } from "@/i18n/LanguageProvider";

/**
 * Where this phone remembers which account it is paired to.
 *
 * Scoped to the browser origin like everything else in localStorage, so a phone
 * paired against the office server does not present that token to a different
 * deployment.
 */
const DEVICE_TOKEN_KEY = "face_device_token";

type Stage =
  | "starting"
  | "capturing"
  | "submitting"
  | "done"
  | "notPaired"
  /** Reached over plain http from a LAN address - the browser hides the camera. */
  | "insecure"
  | "expired"
  | "failed";

export default function FaceLinkPage() {
  const { t } = useI18n();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [mode, setMode] = useState<"enroll" | "login" | null>(null);
  const [stage, setStage] = useState<Stage>("starting");
  const [errorText, setErrorText] = useState<string>("");

  // Read the session id from the URL and announce this phone to the desktop.
  // Not `useSearchParams`: that forces a Suspense boundary on a page whose whole
  // job is to be reachable instantly from a QR scan.
  useEffect(() => {
    const join = async () => {
      const sid = new URLSearchParams(window.location.search).get("sid");
      if (!sid) {
        setStage("expired");
        return;
      }

      setSessionId(sid);

      try {
        const res = await fetch("/api/auth/face-link/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sid, type: "join" }),
        });

        const data = (await res.json().catch(() => ({}))) as { mode?: string; message?: string };

        if (!res.ok) {
          setStage("expired");
          setErrorText(data.message || "");
          return;
        }

        const resolved = data.mode === "enroll" ? "enroll" : "login";
        setMode(resolved);

        // Checked before anything opens a camera. Outside a secure context the
        // browser deletes `navigator.mediaDevices` entirely, so starting the
        // capture would surface as "no camera on this device" on a phone that
        // obviously has one. Saying the real reason here is the difference
        // between a two-minute fix and a hardware hunt.
        if (!isSecureCameraContext()) {
          setStage("insecure");
          return;
        }

        if (resolved === "login" && !localStorage.getItem(DEVICE_TOKEN_KEY)) {
          // Nothing to prove an identity with. Saying so plainly beats opening a
          // camera that could never succeed.
          setStage("notPaired");
          return;
        }

        setStage("capturing");
      } catch {
        setStage("failed");
      }
    };

    const run = () => void join();
    run();
  }, []);

  const handleCaptured = useCallback(
    async (descriptors: number[][]) => {
      if (!sessionId || !mode) return;

      setStage("submitting");

      try {
        const payload =
          mode === "enroll"
            ? {
                sessionId,
                type: "enroll",
                samples: descriptors,
                // A label the owner will recognise in Settings when revoking it.
                deviceName: describePhone(),
              }
            : {
                sessionId,
                type: "login",
                deviceToken: localStorage.getItem(DEVICE_TOKEN_KEY),
                descriptor: descriptors[0],
              };

        const res = await fetch("/api/auth/face-link/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = (await res.json().catch(() => ({}))) as {
          deviceToken?: string;
          message?: string;
        };

        if (!res.ok) {
          if (res.status === 410) {
            setStage("expired");
            return;
          }
          setErrorText(data.message || t("face.notRecognised"));
          // Back to the camera rather than a dead end: a bad frame is the most
          // likely reason to be here.
          setStage("capturing");
          return;
        }

        if (mode === "enroll" && data.deviceToken) {
          localStorage.setItem(DEVICE_TOKEN_KEY, data.deviceToken);
        }

        setStage("done");
      } catch {
        setStage("failed");
      }
    },
    [mode, sessionId, t]
  );

  return (
    <main className="min-h-dvh bg-slate-950 flex flex-col justify-center items-center px-4 py-6 text-slate-100 overflow-x-hidden">
      <div className="w-full max-w-xs sm:max-w-sm space-y-4">
        <header className="text-center">
          <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-2xl bg-cyan-500/15 border border-cyan-500/30 shadow-[0_0_12px_rgba(34,211,238,0.2)]">
            <ScanFace className="h-5 w-5 text-cyan-400" aria-hidden="true" />
          </div>
          <h1 className="text-base font-bold text-slate-100">
            {mode === "enroll" ? t("faceLink.pairTitle") : t("faceLink.loginTitle")}
          </h1>
          <p className="mt-0.5 text-xs text-slate-400">
            {mode === "enroll" ? t("faceLink.pairHint") : t("faceLink.loginHint")}
          </p>
        </header>

        {stage === "starting" && (
          <div className="grid place-items-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-ink-secondary" aria-hidden="true" />
          </div>
        )}

        {stage === "capturing" && (
          <div className="space-y-3">
            {errorText && (
              <p className="rounded-xl bg-danger-soft px-3 py-2 text-center text-xs font-semibold text-danger-soft-fg">
                {errorText}
              </p>
            )}
            <FaceCapture
              mode={mode === "enroll" ? "enroll" : "verify"}
              onComplete={(d) => void handleCaptured(d)}
              onCancel={() => setStage("failed")}
            />
          </div>
        )}

        {stage === "submitting" && (
          <div className="grid place-items-center gap-2 py-10">
            <Loader2 className="h-6 w-6 animate-spin text-ink-secondary" aria-hidden="true" />
            <p className="text-xs text-ink-secondary">{t("face.saving")}</p>
          </div>
        )}

        {stage === "done" && (
          <Outcome
            tone="success"
            icon={CheckCircle2}
            title={mode === "enroll" ? t("faceLink.paired") : t("faceLink.signedIn")}
            body={mode === "enroll" ? t("faceLink.pairedHint") : t("faceLink.signedInHint")}
          />
        )}

        {stage === "insecure" && (
          <Outcome
            tone="warning"
            icon={ShieldAlert}
            title={t("faceLink.needsHttpsTitle")}
            body={t("faceLink.needsHttps")}
          />
        )}

        {stage === "notPaired" && (
          <Outcome tone="warning" icon={ShieldAlert} title={t("faceLink.notPaired")} body={t("faceLink.notPairedHint")} />
        )}

        {stage === "expired" && (
          <Outcome tone="warning" icon={ShieldAlert} title={t("faceLink.expired")} body={t("faceLink.expiredHint")} />
        )}

        {stage === "failed" && (
          <Outcome tone="danger" icon={XCircle} title={t("face.failed")} body={t("faceLink.expiredHint")} />
        )}
      </div>
    </main>
  );
}

function Outcome({
  tone,
  icon: Icon,
  title,
  body,
}: {
  tone: "success" | "warning" | "danger";
  icon: React.ElementType;
  title: string;
  body: string;
}) {
  const toneClass =
    tone === "success"
      ? "bg-success-soft text-success-soft-fg"
      : tone === "warning"
        ? "bg-warning-soft text-warning-soft-fg"
        : "bg-danger-soft text-danger-soft-fg";

  return (
    <div className="rounded-2xl border border-subtle bg-surface p-5 text-center">
      <div className={`mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full ${toneClass}`}>
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>
      <h2 className="text-sm font-bold text-ink">{title}</h2>
      <p className="mt-1 text-xs text-ink-secondary">{body}</p>
    </div>
  );
}

/**
 * A label for this phone, for the owner's benefit when they later revoke it.
 *
 * Built from product names, so deliberately not translated - the same reasoning
 * as `describeThisDevice` in `lib/webauthn.ts`.
 */
function describePhone(): string {
  if (typeof navigator === "undefined") return "Phone";

  const ua = navigator.userAgent;

  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) {
    // Android UA strings carry the model between the build tag and the browser.
    const model = ua.match(/Android[^;]*;\s*([^)]+?)\s*(?:Build|\))/);
    return model ? `Android — ${model[1]}` : "Android phone";
  }

  return "Phone";
}
