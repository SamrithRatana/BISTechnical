"use client";

/**
 * @file FaceVerificationManager.tsx
 * @description Settings panel for face verification: capture your face on this
 * computer OR on your phone, see which phones are paired, and delete any of it.
 *
 * Enrolment happens here rather than on the login screen because storing a
 * biometric-derived descriptor against an account has to be authorised by a
 * session that already exists - the same rule passkey enrolment follows, and
 * `FaceAuthController.Enroll` is `[Authorize]` for the same reason.
 *
 * The phone path exists because plenty of office desktops have a poor webcam or
 * none, while everyone has a phone with a good front camera. Pairing binds that
 * phone to this account so a later sign-in is a 1:1 check against one person's
 * samples rather than a search across every enrolled face - see
 * `UserFaceDevice` for why that distinction is the whole security model.
 *
 * "Turn off" is deliberately one click and a confirm, with nothing to fail on
 * the way. Withdrawing biometric data must be at least as easy as giving it.
 */

import React, { useCallback, useEffect, useState } from "react";
import { ScanFace, ShieldCheck, Smartphone, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { ConfirmDialog, ErrorState } from "@/components/av";
import FaceCapture from "@/components/FaceCapture";
import FaceLinkQr from "@/components/FaceLinkQr";
import { useI18n } from "@/i18n/LanguageProvider";
import {
  enrollFace,
  getFaceStatus,
  listFaceDevices,
  removeFace,
  revokeFaceDevice,
  toggleFaceTwoFactor,
  type FaceDevice,
  type FaceStatus,
} from "@/services/faceAuth";

type LoadState = "loading" | "ready" | "failed";

/** Which capture surface is open, if any. */
type Panel = "none" | "camera" | "phone";

export default function FaceVerificationManager() {
  const { t, lang } = useI18n();
  const isKhmer = lang === "km";

  const [state, setState] = useState<LoadState>("loading");
  const [status, setStatus] = useState<FaceStatus | null>(null);
  const [devices, setDevices] = useState<FaceDevice[]>([]);
  const [panel, setPanel] = useState<Panel>("none");
  const [saving, setSaving] = useState(false);
  const [toggling2fa, setToggling2fa] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [pendingUnpair, setPendingUnpair] = useState<FaceDevice | null>(null);
  const [unpairing, setUnpairing] = useState(false);

  // No synchronous setState here - see the note on PasskeyManager's load().
  const load = useCallback(async () => {
    try {
      // One await, not two sequential ones: they are independent reads and the
      // panel cannot render until both are in.
      const [nextStatus, nextDevices] = await Promise.all([
        getFaceStatus(),
        listFaceDevices().catch(() => [] as FaceDevice[]),
      ]);
      setStatus(nextStatus);
      setDevices(nextDevices);
      setState("ready");
    } catch {
      setState("failed");
    }
  }, []);

  useEffect(() => {
    const run = () => void load();
    run();
  }, [load]);

  const retry = () => {
    setState("loading");
    void load();
  };

  const handleToggle2FA = async () => {
    if (!status?.enrolled) {
      toast.error(t("face.enrollFirstFor2fa"));
      return;
    }
    const next = !status.twoFactorEnabled;
    setToggling2fa(true);
    try {
      await toggleFaceTwoFactor(next);
      setStatus((prev) => (prev ? { ...prev, twoFactorEnabled: next } : null));
      toast.success(next ? t("face.twoFactorEnabledToast") : t("face.twoFactorDisabledToast"));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update 2FA setting");
    } finally {
      setToggling2fa(false);
    }
  };

  const handleCaptured = async (descriptors: number[][]) => {
    setSaving(true);
    try {
      const count = await enrollFace(descriptors);
      setStatus((prev) => ({
        enrolled: true,
        twoFactorEnabled: true,
        sampleCount: count,
        requiredSamples: prev?.requiredSamples ?? 3,
        enrolledAt: new Date().toISOString(),
      }));
      setPanel("none");
      toast.success(t("face.enrolledOk"));
    } catch {
      toast.error(t("face.enrollFailed"));
    } finally {
      setSaving(false);
    }
  };

  /** The phone finished pairing. Refetch rather than guess at the new row. */
  const handlePhonePaired = useCallback(() => {
    setPanel("none");
    toast.success(t("faceLink.paired"));
    void load();
  }, [load, t]);

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await removeFace();
      setStatus({
        enrolled: false,
        twoFactorEnabled: false,
        sampleCount: 0,
        requiredSamples: status?.requiredSamples ?? 3,
        enrolledAt: null,
      });
      setConfirmOff(false);
      toast.success(t("face.turnedOff"));
    } catch {
      toast.error(t("face.statusFailed"));
    } finally {
      setRemoving(false);
    }
  };

  const handleUnpair = async () => {
    if (!pendingUnpair) return;
    setUnpairing(true);
    try {
      await revokeFaceDevice(pendingUnpair.id);
      setDevices((prev) => prev.filter((d) => d.id !== pendingUnpair.id));
      setPendingUnpair(null);
      toast.success(t("faceLink.unpaired"));
    } catch {
      toast.error(t("faceLink.unpairFailed"));
    } finally {
      setUnpairing(false);
    }
  };

  const formatDate = (value: string | null) => {
    if (!value) return t("faceLink.neverUsed");
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return t("faceLink.neverUsed");
    return date.toLocaleDateString(lang === "km" ? "km-KH" : "en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (state === "failed") {
    return <ErrorState compact title={t("face.statusFailed")} onRetry={retry} retryLabel={t("action.retry")} />;
  }

  if (state === "loading") {
    return <div className="h-14 rounded-xl bg-sunken animate-pulse" aria-busy="true" />;
  }

  if (panel === "camera") {
    return (
      <div className="space-y-3">
        <FaceCapture
          mode="enroll"
          busy={saving}
          onComplete={(d) => void handleCaptured(d)}
          onCancel={() => setPanel("none")}
        />
        {saving && <p className="text-center text-xs text-ink-secondary">{t("face.saving")}</p>}
        <p className="text-center text-[11px] text-ink-secondary">{t("face.moveSlightly")}</p>
      </div>
    );
  }

  if (panel === "phone") {
    return <FaceLinkQr mode="enroll" onDone={handlePhonePaired} onCancel={() => setPanel("none")} />;
  }

  const enrolled = status?.enrolled === true;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 rounded-xl border border-subtle bg-sunken px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          {enrolled ? (
            <ShieldCheck className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
          ) : (
            <ScanFace className="h-4 w-4 shrink-0 text-ink-secondary" aria-hidden="true" />
          )}
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-ink">{enrolled ? t("face.on") : t("face.off")}</p>
            {enrolled && (
              <p className="mt-0.5 truncate text-[11px] text-ink-secondary">
                {t("face.samplesStored", { count: String(status?.sampleCount ?? 0) })}
              </p>
            )}
          </div>
        </div>

        {enrolled && (
          <button
            type="button"
            onClick={() => setConfirmOff(true)}
            aria-label={t("face.turnOff")}
            className="shrink-0 rounded-lg p-2 text-ink-secondary transition-colors hover:bg-danger-soft hover:text-danger-soft-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/50 cursor-pointer"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ── Two-Factor Authentication (2FA) Toggle Switch ── */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-subtle bg-surface p-3.5 shadow-xs transition-colors">
        <div className="space-y-0.5 min-w-0 pr-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-ink">{t("face.twoFactorTitle")}</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                status?.twoFactorEnabled
                  ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30"
                  : "bg-sunken text-ink-muted border border-subtle"
              }`}
            >
              {status?.twoFactorEnabled ? (isKhmer ? "បានបើក" : "Enabled") : (isKhmer ? "បានបិទ" : "Disabled")}
            </span>
          </div>
          <p className="text-[11px] text-ink-secondary leading-snug">
            {t("face.twoFactorHint")}
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={status?.twoFactorEnabled ?? false}
          disabled={!enrolled || toggling2fa}
          onClick={handleToggle2FA}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed ${
            status?.twoFactorEnabled ? "bg-accent" : "bg-slate-700 dark:bg-slate-800"
          }`}
        >
          <span
            aria-hidden="true"
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
              status?.twoFactorEnabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setPanel("camera")}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-3.5 py-2 text-xs font-bold text-accent-fg transition-all hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 cursor-pointer"
        >
          <ScanFace className="h-4 w-4" aria-hidden="true" />
          <span>{enrolled ? t("face.redo") : t("face.setUp")}</span>
        </button>

        <button
          type="button"
          onClick={() => setPanel("phone")}
          className="inline-flex items-center gap-2 rounded-xl border border-subtle bg-surface px-3.5 py-2 text-xs font-bold text-ink transition-colors hover:bg-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 cursor-pointer"
        >
          <Smartphone className="h-4 w-4" aria-hidden="true" />
          <span>{t("faceLink.usePhone")}</span>
        </button>
      </div>

      <div className="space-y-2 pt-1">
        <h3 className="text-[11px] font-bold uppercase tracking-wide text-ink-secondary">
          {t("faceLink.pairedDevices")}
        </h3>

        {devices.length === 0 ? (
          <p className="text-[11px] text-ink-secondary">{t("faceLink.noDevices")}</p>
        ) : (
          <ul className="space-y-2">
            {devices.map((device) => (
              <li
                key={device.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-subtle bg-sunken px-3 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <Smartphone className="h-4 w-4 shrink-0 text-ink-secondary" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-ink">{device.deviceName}</p>
                    <p className="mt-0.5 truncate text-[11px] text-ink-secondary">
                      {t("faceLink.lastUsed")}: {formatDate(device.lastUsedAt)}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setPendingUnpair(device)}
                  aria-label={`${t("faceLink.unpair")} ${device.deviceName}`}
                  className="shrink-0 rounded-lg p-2 text-ink-secondary transition-colors hover:bg-danger-soft hover:text-danger-soft-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/50 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-[11px] text-ink-secondary">{t("face.secondFactorNote")}</p>

      <ConfirmDialog
        open={confirmOff}
        title={t("face.turnOffTitle")}
        description={t("face.turnOffBody")}
        confirmLabel={t("face.turnOff")}
        cancelLabel={t("action.cancel")}
        busy={removing}
        onConfirm={() => void handleRemove()}
        onCancel={() => setConfirmOff(false)}
      />

      <ConfirmDialog
        open={pendingUnpair !== null}
        title={t("faceLink.unpairTitle")}
        description={t("faceLink.unpairBody")}
        confirmLabel={t("faceLink.unpair")}
        cancelLabel={t("action.cancel")}
        busy={unpairing}
        onConfirm={() => void handleUnpair()}
        onCancel={() => setPendingUnpair(null)}
      />
    </div>
  );
}
