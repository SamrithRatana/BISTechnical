"use client";

/**
 * @file FaceLinkQr.tsx
 * @description The desktop half of phone face pairing: shows the QR, waits on
 * the session's event stream, and hands the result back to its parent.
 *
 * Used twice with the same code — from Settings to pair a phone (`enroll`), and
 * from the login screen to sign in with one (`login`). The only difference is
 * which mode the session is created in and what arrives on the stream.
 *
 * The QR carries the session id and nothing else. The `secret` that lets this
 * browser read the stream is returned by the create call and never displayed, so
 * photographing the screen does not let a bystander collect the session token
 * that the login path delivers. See `lib/faceLinkBridge.ts`.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Clock,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Wifi,
  X,
  VenetianMask,
  Glasses,
  HardHat,
} from "lucide-react";
import QRCodeSvg from "@/components/QRCodeSvg";
import { useI18n } from "@/i18n/LanguageProvider";
import { readToken } from "@/services/authSession";

export interface FaceLinkQrProps {
  mode: "enroll" | "login";
  userName?: string;
  userId?: string;
  /** Fires once, with whatever the phone's action produced. */
  onDone: (payload: unknown) => void;
  onCancel: () => void;
}

type Status = "creating" | "waiting" | "phoneJoined" | "failed";

const QR_LIFETIME_SECONDS = 300; // 5 minutes solid lifetime for reliable scanning
/** How long the desktop waits for the phone to answer a push challenge. */
const PUSH_CHALLENGE_SECONDS = 90;

export default function FaceLinkQr({ mode, userName, userId, onDone, onCancel }: FaceLinkQrProps) {
  const { t, lang } = useI18n();
  const isKhmer = lang === "km";

  const [status, setStatus] = useState<Status>("creating");
  const [url, setUrl] = useState<string>("");
  const [errorText, setErrorText] = useState<string>("");
  const [sessionIndex, setSessionIndex] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(QR_LIFETIME_SECONDS);
  /** True when the QR will point at a plain-http LAN address. */
  const [insecure, setInsecure] = useState(false);
  const [matchingNumber, setMatchingNumber] = useState<number | null>(null);
  /**
   * Non-terminal rejection reported by the phone (wrong face, revoked pairing,
   * locked account). The session stays live so the phone can retry — this only
   * tells the person at the desktop WHY nothing is happening yet.
   */
  const [phoneHint, setPhoneHint] = useState<string>("");

  /**
   * Push-challenge state, declared HERE rather than beside the push UI below.
   *
   * The event-stream effect has to be able to report a refusal into this panel,
   * and an effect declared above these `useState` calls cannot reference their
   * setters — the deps array is evaluated during render, so it is a genuine
   * temporal-dead-zone error rather than a lint nicety.
   */
  const [pushState, setPushState] = useState<"idle" | "checking" | "sending" | "waiting" | "failed">("idle");
  const [pushStatusText, setPushStatusText] = useState<string>("");
  const [pushTimeLeft, setPushTimeLeft] = useState<number>(PUSH_CHALLENGE_SECONDS);
  /** Wall-clock deadline for the current challenge; the ticker reads it. */
  const [pushDeadline, setPushDeadline] = useState<number>(0);

  const sessionRef = useRef<{ id: string; secret: string } | null>(null);
  const sourceRef = useRef<EventSource | null>(null);
  /** Guards the async setup from finishing after the component is gone. */
  const liveRef = useRef(true);

  /**
   * True while a push challenge is in flight or awaiting the phone.
   *
   * A ref, not the `pushState` value, for two reasons: the expiry effect below is
   * declared ABOVE `pushState`'s `useState` (a deps array is evaluated during
   * render, so naming it there would throw), and the interval callback needs the
   * CURRENT value rather than the one captured when the interval was created.
   */
  const pushBusyRef = useRef(false);

  /**
   * True while the push/number-match tab is the one on screen.
   *
   * A ref because the error handler below is created inside an effect declared
   * ABOVE `loginTab`'s `useState`, and because that handler must see the
   * CURRENT tab rather than the one captured when the stream was opened.
   */
  const pushTabRef = useRef(false);

  const onDoneRef = useRef(onDone);
  const tRef = useRef(t);
  /** Stable handle to `refreshSession`, so the stream effect need not depend on it. */
  const refreshSessionRef = useRef<() => void>(() => {});

  useEffect(() => {
    onDoneRef.current = onDone;
    tRef.current = t;
  });

  const teardown = useCallback(() => {
    liveRef.current = false;
    sourceRef.current?.close();
    sourceRef.current = null;

    const session = sessionRef.current;
    sessionRef.current = null;

    if (session) {
      void fetch(
        `/api/auth/face-link/session?sessionId=${encodeURIComponent(session.id)}&secret=${encodeURIComponent(session.secret)}`,
        { method: "DELETE", keepalive: true }
      ).catch(() => undefined);
    }
  }, []);

  const refreshSession = useCallback(() => {
    teardown();
    setStatus("creating");
    setUrl("");
    setErrorText("");
    setPhoneHint("");
    setTimeLeft(QR_LIFETIME_SECONDS);
    setSessionIndex((i) => i + 1);
  }, [teardown]);

  useEffect(() => {
    refreshSessionRef.current = refreshSession;
  }, [refreshSession]);

  // Expiry Countdown Timer
  useEffect(() => {
    if (status !== "waiting") return;

    const interval = setInterval(() => {
      // Never rotate the session out from under a push challenge. The pushed
      // sessionId is what the phone approves and what this browser's event
      // stream listens on; refreshing it mid-flight deleted the session the
      // phone was about to answer, so a correct approval arrived for a session
      // nobody was watching and the desktop waited forever.
      if (pushBusyRef.current) return;

      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          refreshSession();
          return QR_LIFETIME_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [status, refreshSession]);

  useEffect(() => {
    liveRef.current = true;

    const start = async () => {
      try {
        const token = readToken();
        let targetUser = userName;
        let targetUserId = userId;
        if (!targetUser && typeof window !== "undefined") {
          try {
            const stored = localStorage.getItem("user_info");
            if (stored) {
              const parsed = JSON.parse(stored) as Record<string, unknown>;
              targetUser = (parsed.userName || parsed.UserName) as string | undefined;
              targetUserId = (parsed.id || parsed.userId || parsed.Id) as string | undefined;
            }
          } catch {
            // Ignore parse errors
          }
        }

        const res = await fetch("/api/auth/face-link/session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(mode === "enroll" && token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ mode, userName: targetUser, userId: targetUserId }),
        });

        const data = (await res.json().catch(() => ({}))) as {
          sessionId?: string;
          secret?: string;
          message?: string;
        };

        if (!res.ok || !data.sessionId || !data.secret) {
          if (!liveRef.current) return;
          setErrorText(data.message || tRef.current("faceLink.createFailed"));
          setStatus("failed");
          return;
        }

        if (!liveRef.current) return;
        sessionRef.current = { id: data.sessionId, secret: data.secret };

        let host = window.location.hostname;
        try {
          const ipRes = await fetch("/api/scanner/network-ip");
          const ip = (await ipRes.json()) as { primaryIp?: string };
          if (ip.primaryIp && ip.primaryIp !== "127.0.0.1") host = ip.primaryIp;
        } catch {
          // Fall back to location.hostname
        }

        if (!liveRef.current) return;

        const port = window.location.port ? `:${window.location.port}` : "";
        const userQuery = targetUser ? `&user=${encodeURIComponent(targetUser)}` : "";
        const modeQuery = `&mode=${encodeURIComponent(mode)}`;
        setUrl(`${window.location.protocol}//${host}${port}/face-link?sid=${data.sessionId}${userQuery}${modeQuery}`);
        setInsecure(window.location.protocol === "http:" && !/^(localhost|127\.|\[::1\])/.test(host));
        setStatus("waiting");

        const source = new EventSource(
          `/api/auth/face-link/session?sessionId=${encodeURIComponent(data.sessionId)}&secret=${encodeURIComponent(data.secret)}`
        );
        sourceRef.current = source;

        source.onmessage = (event) => {
          if (!liveRef.current) return;

          let parsed: { type?: string; payload?: unknown; message?: string };
          try {
            parsed = JSON.parse(event.data);
          } catch {
            return;
          }

          if (parsed.type === "phone-joined") {
            setStatus("phoneJoined");
          } else if (parsed.type === "phone-error") {
            // Non-terminal: the phone's attempt was rejected but it can retry
            // on this same QR. Show why, keep the stream open.
            setPhoneHint(parsed.message || tRef.current("faceLink.createFailed"));
          } else if (parsed.type === "done") {
            source.close();
            sourceRef.current = null;
            sessionRef.current = null;
            onDoneRef.current(parsed.payload);
          } else if (parsed.type === "error") {
            source.close();
            sourceRef.current = null;
            sessionRef.current = null;
            const failure =
              parsed.message ||
              (isKhmer
                ? "លេខផ្ទៀងផ្ទាត់មិនត្រឹមត្រូវ ឬសំណើត្រូវបានបដិសេធ"
                : "Incorrect match number or sign-in rejected.");

            if (pushTabRef.current) {
              // Push / number-match tab: report the refusal in the panel the
              // user is actually looking at, and mint a FRESH pairing session.
              //
              // Without the refresh this was a dead end: the denied session is
              // spent and `sessionRef` is null, while the auto-rotate that
              // would replace it only runs when `status === "waiting"` — which
              // this branch just left. Every later "Send" then answered
              // "Session initializing. Please click send again." forever, so a
              // single denied or mistyped-number attempt bricked Face Login,
              // PIN and Match Number until the page was reloaded.
              setPushState("failed");
              setPushStatusText(failure);
              refreshSessionRef.current();
              return;
            }

            setErrorText(failure);
            setStatus("failed");
            if (mode === "login") {
              onDoneRef.current({ isSuccess: false, message: failure });
            }
          }
        };

        source.onerror = () => {
          if (liveRef.current && source.readyState === EventSource.CLOSED) {
            setErrorText(tRef.current("faceLink.createFailed"));
            setStatus("failed");
          }
        };
      } catch {
        if (!liveRef.current) return;
        setErrorText(tRef.current("faceLink.createFailed"));
        setStatus("failed");
      }
    };

    const run = () => void start();
    run();

    return teardown;
  }, [mode, sessionIndex, teardown]);

  const [loginTab, setLoginTab] = useState<"push" | "numberMatch" | "qr">("push");
  const [userNameInput, setUserNameInput] = useState<string>(() =>
    typeof window !== "undefined"
      ? localStorage.getItem("camid_last_push_username") || "NavinCAM"
      : "NavinCAM"
  );
  useEffect(() => {
    pushBusyRef.current = pushState === "sending" || pushState === "waiting";
  }, [pushState]);

  useEffect(() => {
    pushTabRef.current = mode === "login" && (loginTab === "push" || loginTab === "numberMatch");
  }, [mode, loginTab]);

  /**
   * Live countdown for the push challenge, driven off the deadline stamped when
   * the challenge was SENT.
   *
   * The effect deliberately writes no state synchronously — it used to open
   * with `setPushTimeLeft(90)`, which is the cascading-render pattern this
   * project already carries four instances of. Reading a deadline also keeps
   * the display honest if the tab is backgrounded, where interval ticks are
   * throttled and a decrement-per-tick clock drifts slow.
   */
  useEffect(() => {
    if (pushState !== "waiting" || pushDeadline === 0) return;

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((pushDeadline - Date.now()) / 1000));
      setPushTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        setPushState("failed");
        setPushStatusText(
          isKhmer
            ? "អស់ពេលរង់ចាំទូរស័ព្ទ (Timeout)។ សូមប្រាកដថា App CAM ID បើកដំណើរការ ហើយផ្ញើសារម្តងទៀត។"
            : "Timed out waiting for the phone. Make sure the CAM ID app is open, then send again."
        );
      }
    };

    const interval = setInterval(tick, 1000);

    return () => clearInterval(interval);
  }, [pushState, pushDeadline, isKhmer]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSendPushChallenge = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!userNameInput.trim()) return;
    if (pushState === "sending") return;

    setPushState("sending");
    setPushStatusText(isKhmer ? "កំពុងពិនិត្យ និងផ្ញើសំណើ..." : "Sending challenge to paired phone...");

    try {
      let sessionId = sessionRef.current?.id;
      if (!sessionId) {
        // Auto-wait up to 2.5 seconds for session to finish initializing
        for (let i = 0; i < 25; i++) {
          await new Promise((r) => setTimeout(r, 100));
          sessionId = sessionRef.current?.id;
          if (sessionId) break;
        }
      }

      if (!sessionId) {
        setPushState("failed");
        setPushStatusText(
          isKhmer
            ? "ការតភ្ជាប់កំពុងដំណើរការឡើងវិញ។ សូមចុចម្តងទៀត។"
            : "Session initializing. Please click send again."
        );
        return;
      }

      const isNumberMatchMode = loginTab === "numberMatch";

      const res = await fetch("/api/proxy/auth/face/device/request-push?service=jwt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userName: userNameInput.trim(),
          sessionId,
          clientName: "Dell Workstation",
          requireNumberMatch: isNumberMatchMode,
        }),
        signal: AbortSignal.timeout(15_000),
      });

      const data = await res.json().catch(
        () => ({} as { IsSuccess?: boolean; Message?: string; MatchingNumber?: number; PhoneOnline?: boolean })
      );

      if (res.status === 429) {
        setPushState("failed");
        setPushStatusText(
          isKhmer
            ? "សំណើច្រើនដងពេក។ សូមរង់ចាំមួយនាទី ហើយព្យាយាមម្តងទៀត។"
            : "Too many requests. Please wait about a minute and try again."
        );
        return;
      }

      if (!res.ok || !data.IsSuccess) {
        setPushState("failed");
        setPushStatusText(
          data.Message || (isKhmer ? "រកមិនឃើញទូរស័ព្ទដែលបានភ្ជាប់ជាមួយគណនីនេះទេ" : "No paired phone found for this account.")
        );
        return;
      }

      if (data.MatchingNumber) {
        setMatchingNumber(data.MatchingNumber);
      } else {
        setMatchingNumber(null);
      }

      // Stamp the countdown here, in the handler that actually sent the
      // challenge, rather than from inside the ticking effect.
      setPushTimeLeft(PUSH_CHALLENGE_SECONDS);
      setPushDeadline(Date.now() + PUSH_CHALLENGE_SECONDS * 1000);
      setPushState("waiting");
      // `PhoneOnline: false` means nothing was listening on the hub when the
      // challenge went out — the app is closed, the phone is asleep, or the API
      // restarted and dropped its connection. Saying so immediately is the
      // difference between "waiting" and staring at a prompt that will never
      // arrive. It still waits, because SignalR usually reconnects in seconds.
      setPushStatusText(
        data.PhoneOnline === false
          ? isKhmer
            ? "ទូរស័ព្ទ CAM ID របស់អ្នកមិនទាន់ភ្ជាប់ទេ។ សូមបើកកម្មវិធី CAM ID លើទូរស័ព្ទ រួចផ្ញើម្តងទៀត។"
            : "Your CAM ID phone is not connected right now. Open the CAM ID app on your phone, then send again."
          : isKhmer
            ? `បានផ្ញើសំណើទៅកាន់ទូរស័ព្ទ CAM ID របស់អ្នករួចរាល់! សូមពិនិត្យទូរស័ព្ទដៃដើម្បីដោះសោ។`
            : `Challenge sent to your CAM ID phone! Please check your phone to unlock.`
      );
    } catch (err) {
      const aborted = err instanceof DOMException && (err.name === "TimeoutError" || err.name === "AbortError");
      setPushState("failed");
      setPushStatusText(
        aborted
          ? isKhmer
            ? "សំណើលើសពេលកំណត់។ សូមព្យាយាមម្តងទៀត។"
            : "The request timed out. Please try again."
          : isKhmer
            ? "បរាជ័យក្នុងការតភ្ជាប់"
            : "Connection failed."
      );
    }
  };

  return (
    <div className="space-y-3">
      {/* Mode Switcher Tabs for Login */}
      {mode === "login" && (
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-sunken p-1 border border-subtle">
          <button
            type="button"
            onClick={() => {
              setLoginTab("push");
              setPushState("idle");
              setMatchingNumber(null);
            }}
            className={`py-1.5 px-1 text-center text-[10px] sm:text-[10.5px] font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap tracking-tight ${
              loginTab === "push"
                ? "bg-surface text-ink shadow-xs border border-subtle"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            {isKhmer ? "📱 Face Login / PIN" : "📱 Face Login or PIN"}
          </button>
          <button
            type="button"
            onClick={() => {
              setLoginTab("numberMatch");
              setPushState("idle");
              setMatchingNumber(null);
            }}
            className={`py-1.5 px-1 text-center text-[10px] sm:text-[10.5px] font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap tracking-tight ${
              loginTab === "numberMatch"
                ? "bg-surface text-ink shadow-xs border border-subtle"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            {isKhmer ? "🔢 Match Number" : "🔢 Match Number"}
          </button>
          <button
            type="button"
            onClick={() => {
              setLoginTab("qr");
              setPushState("idle");
              setMatchingNumber(null);
            }}
            className={`py-1.5 px-1 text-center text-[10px] sm:text-[10.5px] font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap tracking-tight ${
              loginTab === "qr"
                ? "bg-surface text-ink shadow-xs border border-subtle"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            {isKhmer ? "📷 ស្កែន QR" : "📷 Scan QR"}
          </button>
        </div>
      )}

      {/* ── TAB 1 & TAB 2: PUSH LOGIN OR NUMBER MATCHING CHALLENGE ── */}
      {mode === "login" && (loginTab === "push" || loginTab === "numberMatch") ? (
        <div className="space-y-3 py-1">
          <form onSubmit={handleSendPushChallenge} className="space-y-2.5">
            <div className="space-y-1 text-left">
              <label className="text-xs font-bold text-slate-200">
                {isKhmer ? "បញ្ចូលឈ្មោះគណនី (Username ឬ Email)" : "Enter Account Username or Email"}
              </label>
              <input
                type="text"
                value={userNameInput}
                onChange={(e) => {
                  setUserNameInput(e.target.value);
                  try {
                    localStorage.setItem("camid_last_push_username", e.target.value);
                  } catch {}
                }}
                placeholder="e.g. NavinCAM, navin, or Navin@gmail.com"
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950/80 border border-white/15 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 shadow-inner font-medium"
                autoCapitalize="none"
              />
            </div>

            {pushState === "waiting" ? (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3.5 text-center space-y-2">
                <div className="mx-auto w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 animate-pulse">
                  <Smartphone className="w-5 h-5" />
                </div>
                <h4 className="text-xs font-bold text-emerald-400">
                  {isKhmer ? "កំពុងរង់ចាំការយល់ព្រមលើទូរស័ព្ទ..." : "Waiting for phone approval..."}
                </h4>

                {/* ⏱️ Live Countdown Timer */}
                <div className="flex items-center justify-center gap-2 py-0.5">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-xs font-bold border border-emerald-500/40 shadow-xs">
                    <Clock className="w-3.5 h-3.5 text-emerald-400 animate-spin" style={{ animationDuration: "6s" }} />
                    <span>{isKhmer ? "នៅសល់ពេល៖" : "Time remaining:"} {formatTimer(pushTimeLeft)}</span>
                  </div>
                </div>

                {loginTab === "numberMatch" && matchingNumber && (
                  <div className="my-2 p-2.5 bg-slate-900/90 border border-emerald-500/40 rounded-xl shadow-inner">
                    <p className="text-[11px] font-semibold text-emerald-300">
                      {isKhmer ? "🔢 លេខផ្ទៀងផ្ទាត់លើ CAM ID:" : "🔢 Match number on your CAM ID app:"}
                    </p>
                    <div className="text-3xl font-mono font-black text-white tracking-widest my-1">
                      {matchingNumber}
                    </div>
                    <p className="text-[10px] text-slate-400">
                      {isKhmer ? "ជ្រើសរើសលេខនេះលើទូរស័ព្ទដើម្បីបន្ត" : "Select this number on your phone to continue"}
                    </p>
                  </div>
                )}

                <p className="text-[11px] text-slate-300 leading-snug">
                  {pushStatusText}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setPushState("idle");
                    setMatchingNumber(null);
                  }}
                  className="mt-1 text-[11px] font-bold text-emerald-400 hover:text-emerald-300 hover:underline cursor-pointer"
                >
                  {isKhmer ? "ផ្ញើសារម្តងទៀត" : "Resend Challenge"}
                </button>
              </div>
            ) : (
              <button
                type="submit"
                disabled={pushState === "sending" || !userNameInput.trim()}
                className="w-full py-2.5 px-4 rounded-xl bg-accent text-white text-xs font-bold shadow-md hover:bg-accent/90 disabled:opacity-50 transition-all cursor-pointer"
              >
                {pushState === "sending" ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {isKhmer ? "កំពុងផ្ញើសំណើ..." : "Sending Challenge..."}
                  </span>
                ) : (
                  <span>
                    {loginTab === "numberMatch"
                      ? (isKhmer ? "🔢 ផ្ញើសំណើផ្ទៀងផ្ទាត់លេខ (Number Match)" : "🔢 Send Number Match Request")
                      : (isKhmer ? "🚀 ផ្ញើសំណើ Face Login ឬ PIN" : "🚀 Send Face Login or PIN Request")}
                  </span>
                )}
              </button>
            )}

            {pushState === "failed" && (
              <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold text-center leading-relaxed">
                {pushStatusText}
              </div>
            )}
          </form>

          <div className="flex items-center justify-center gap-1.5 text-[10px] text-ink-muted pt-1">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            <span>{isKhmer ? "ផ្ទៀងផ្ទាត់ដោយផ្ទាល់ជាមួយ App CAM ID របស់អ្នក" : "Direct Biometric Verification via CAM ID App"}</span>
          </div>
        </div>
      ) : (
        /* ── TAB 3: QR CODE SCANNING ── */
        <div className="space-y-3">
          {/* Enrolment guidance, shown on the COMPUTER before the user picks up
              the phone. The scan itself happens in the CAM ID app, so this panel
              has no camera of its own - but this is the moment the instruction is
              actually read, rather than glanced at mid-scan on a small screen.
              Enrolment only: it is meaningless when signing in. */}
          {mode === "enroll" && (
            <div className="rounded-2xl border border-warning/40 bg-warning-soft p-3 text-center">
              <p className="text-xs font-bold text-warning-soft-fg">{t("face.removeCoverings")}</p>
              <p className="mt-1 text-[11px] leading-snug text-warning-soft-fg/85">
                {t("face.removeCoveringsWhy")}
              </p>
              <div className="mt-2.5 flex items-center justify-center gap-4">
                {[
                  { Icon: VenetianMask, label: t("face.noMask") },
                  { Icon: Glasses, label: t("face.noGlasses") },
                  { Icon: HardHat, label: t("face.noHat") },
                ].map(({ Icon, label }) => (
                  <div key={label} className="flex flex-col items-center gap-1" title={label}>
                    <span className="relative grid h-10 w-10 place-items-center rounded-full border border-warning-soft-fg/50">
                      <Icon className="h-4.5 w-4.5 text-warning-soft-fg" aria-hidden="true" />
                      <span className="pointer-events-none absolute h-[1.5px] w-11 rotate-[-45deg] bg-warning-soft-fg/70" />
                    </span>
                    <span className="text-[10px] text-warning-soft-fg/80">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* QR Code Card Well */}
          <div className="relative mx-auto w-fit rounded-2xl border border-subtle bg-surface p-3 shadow-md">
            {status === "creating" || !url ? (
              <div className="grid h-[200px] w-[200px] place-items-center">
                <Loader2 className="h-7 w-7 animate-spin text-accent" aria-hidden="true" />
              </div>
            ) : (
              <QRCodeSvg value={url} size={200} />
            )}
          </div>

          {/* Expiry Countdown & Live Regenerate Row */}
          {status === "waiting" && (
            <div className="flex items-center justify-between px-2 text-[11px] text-ink-muted">
              <div className="inline-flex items-center gap-1.5 font-medium">
                <Clock className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
                <span className="text-slate-300">{t("faceLink.expiresIn")}:</span>
                <strong className="text-emerald-400 font-mono font-bold bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/25">
                  {formatTimer(timeLeft)}
                </strong>
              </div>
              <button
                type="button"
                onClick={refreshSession}
                className="inline-flex items-center gap-1 font-bold text-cyan-400 hover:text-cyan-300 hover:underline cursor-pointer transition-colors active:scale-95"
              >
                <RefreshCw className="h-3 w-3" />
                <span>{t("faceLink.refreshQr")}</span>
              </button>
            </div>
          )}

          {/* Status Indicator */}
          <div
            role="status"
            aria-live="polite"
            className="flex items-center justify-center gap-1.5 text-center text-xs font-semibold text-ink-secondary"
          >
            {status === "phoneJoined" ? (
              <>
                <Smartphone className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                {t("faceLink.phoneConnected")}
              </>
            ) : status === "failed" ? (
              <span className="text-danger">{errorText}</span>
            ) : (
              <>
                <Wifi className="h-3.5 w-3.5" aria-hidden="true" />
                {t("faceLink.scanPrompt")}
              </>
            )}
          </div>

          {/* Non-terminal phone rejection (wrong face / revoked pairing) — the
              session is still live, the phone can retry on this same QR. */}
          {phoneHint && status !== "failed" && (
            <p
              role="status"
              className="rounded-xl bg-warning-soft px-3 py-2 text-center text-[11px] font-semibold text-warning-soft-fg"
            >
              {phoneHint}
            </p>
          )}

          {/* Security Single-Use Badge */}
          <div className="flex items-center justify-center gap-1.5 text-[10px] text-ink-muted">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            <span>{t("faceLink.singleUseSecurity")}</span>
          </div>

          <p className="text-center text-[11px] text-ink-secondary">{t("faceLink.sameWifi")}</p>

          {insecure && (
            <p className="rounded-xl bg-warning-soft px-3 py-2 text-center text-[11px] font-semibold text-warning-soft-fg">
              {t("faceLink.needsHttps")}
            </p>
          )}
        </div>
      )}

      <div className="flex justify-center pt-1">
        <button
          type="button"
          onClick={() => {
            teardown();
            onCancel();
          }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-subtle bg-surface px-3.5 py-1.5 text-xs font-bold text-ink-secondary transition-colors hover:bg-sunken cursor-pointer"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          {t("action.cancel")}
        </button>
      </div>
    </div>
  );
}
