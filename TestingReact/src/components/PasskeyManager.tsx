"use client";

/**
 * @file PasskeyManager.tsx
 * @description Settings panel for face / passkey sign-in: lists the devices
 * enrolled against this account, adds the current one, removes one.
 *
 * Enrolment lives here rather than on the login screen on purpose. Adding a
 * passkey binds a new device to an account, so it has to be authorised by an
 * existing session — offering it to someone who is not signed in yet would let
 * anyone attach their own phone to somebody else's account. The API enforces
 * that too (`WebAuthnController.RegisterOptions` is `[Authorize]`); this is just
 * the matching shape in the UI.
 */

import React, { useCallback, useEffect, useState } from "react";
import { KeyRound, Plus, RefreshCw, ScanFace, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { ConfirmDialog, EmptyState, ErrorState } from "@/components/av";
import { useI18n } from "@/i18n/LanguageProvider";
import { PasskeyError } from "@/lib/webauthn";
import { usePasskeySupport } from "@/hooks/usePasskeySupport";
import { addPasskey, listPasskeys, removePasskey, type PasskeySummary } from "@/services/webauthn";

type LoadState = "loading" | "ready" | "failed";

export default function PasskeyManager() {
  const { t, lang } = useI18n();

  const supported = usePasskeySupport();
  const [state, setState] = useState<LoadState>("loading");
  const [passkeys, setPasskeys] = useState<PasskeySummary[]>([]);
  const [adding, setAdding] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<PasskeySummary | null>(null);
  const [removing, setRemoving] = useState(false);

  /**
   * Nothing is set synchronously here: the first statement is the await.
   *
   * That is not stylistic. `react-hooks/set-state-in-effect` flags a setState
   * reached synchronously from an effect, and the natural version of this
   * function opens with `setState("loading")` — which makes a plain
   * fetch-on-mount trip the rule. Since `state` already starts at "loading",
   * that call was redundant anyway; the retry path sets it from an event
   * handler, where it belongs.
   */
  const load = useCallback(async () => {
    try {
      const rows = await listPasskeys();
      setPasskeys(rows);
      setState("ready");
    } catch {
      setState("failed");
    }
  }, []);

  useEffect(() => {
    // Nested so the effect body itself never calls setState synchronously -
    // the same shape TemplateReportView uses for its fetch-on-mount.
    const run = () => void load();
    run();
  }, [load]);

  const retry = () => {
    setState("loading");
    void load();
  };

  const handleAdd = async () => {
    setAdding(true);
    try {
      const created = await addPasskey();
      // Prepend rather than refetch: the list is ordered newest-first and the
      // API already returned the row it just wrote.
      setPasskeys((prev) => [created, ...prev]);
      toast.success(t("passkey.added"));
    } catch (err) {
      const code = err instanceof PasskeyError ? err.code : "failed";
      if (code === "cancelled") {
        // Dismissing the prompt is a decision, not a fault. Saying nothing is
        // the correct response; a red toast here would read as a malfunction.
        return;
      }
      toast.error(
        code === "alreadyRegistered"
          ? t("passkey.alreadyAdded")
          : code === "unsupported"
            ? t("passkey.unsupported")
            : t("passkey.addFailed")
      );
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async () => {
    if (!pendingRemoval) return;
    setRemoving(true);
    try {
      await removePasskey(pendingRemoval.id);
      setPasskeys((prev) => prev.filter((p) => p.id !== pendingRemoval.id));
      toast.success(t("passkey.removed"));
      setPendingRemoval(null);
    } catch {
      toast.error(t("passkey.removeFailed"));
    } finally {
      setRemoving(false);
    }
  };

  const formatDate = (value: string | null) => {
    if (!value) return t("passkey.neverUsed");
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return t("passkey.neverUsed");
    return date.toLocaleDateString(lang === "km" ? "km-KH" : "en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (!supported) {
    return <p className="text-xs text-ink-secondary">{t("passkey.unsupported")}</p>;
  }

  if (state === "failed") {
    return (
      <ErrorState
        compact
        title={t("passkey.loadFailed")}
        onRetry={retry}
        retryLabel={t("action.retry")}
      />
    );
  }

  return (
    <div className="space-y-3">
      {state === "loading" ? (
        <div className="space-y-2" aria-busy="true">
          {[0, 1].map((i) => (
            <div key={i} className="h-14 rounded-xl bg-sunken animate-pulse" />
          ))}
        </div>
      ) : passkeys.length === 0 ? (
        <EmptyState
          compact
          icon={ScanFace}
          title={t("passkey.empty")}
          description={t("passkey.emptyHint")}
        />
      ) : (
        <ul className="space-y-2">
          {passkeys.map((passkey) => (
            <li
              key={passkey.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-subtle bg-sunken px-3 py-2.5"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <KeyRound className="h-4 w-4 shrink-0 text-ink-secondary" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-ink">{passkey.deviceName}</p>
                  <p className="mt-0.5 truncate text-[11px] text-ink-secondary">
                    {/* Whether a passkey is synced answers the question people
                        actually have — "if I lose this phone, am I locked out?" */}
                    {passkey.isBackedUp ? t("passkey.synced") : t("passkey.thisDeviceOnly")}
                    {" · "}
                    {t("passkey.lastUsed")}: {formatDate(passkey.lastUsedAt)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPendingRemoval(passkey)}
                aria-label={`${t("passkey.remove")} ${passkey.deviceName}`}
                className="shrink-0 rounded-lg p-2 text-ink-secondary transition-colors hover:bg-danger-soft hover:text-danger-soft-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/50 cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={handleAdd}
        disabled={adding || state === "loading"}
        className="inline-flex items-center gap-2 rounded-xl bg-accent px-3.5 py-2 text-xs font-bold text-accent-fg transition-all hover:brightness-110 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 cursor-pointer"
      >
        {adding ? (
          <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Plus className="h-4 w-4" aria-hidden="true" />
        )}
        <span>{adding ? t("passkey.adding") : t("passkey.add")}</span>
      </button>

      <ConfirmDialog
        open={pendingRemoval !== null}
        title={t("passkey.removeTitle")}
        description={t("passkey.removeBody")}
        confirmLabel={t("passkey.remove")}
        cancelLabel={t("action.cancel")}
        busy={removing}
        onConfirm={() => void handleRemove()}
        onCancel={() => setPendingRemoval(null)}
      />
    </div>
  );
}
