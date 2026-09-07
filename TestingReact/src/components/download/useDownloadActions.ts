"use client";

/**
 * @file components/download/useDownloadActions.ts
 * @description The side-effectful actions of the download hub — clipboard,
 * APK download, Expo deep link, iOS WebClip profile, Android PWA prompt —
 * kept out of the presentational components.
 */

import { useCallback, useState } from "react";
import toast from "react-hot-toast";
import { useI18n } from "@/i18n/LanguageProvider";
import { useSafeTimeout } from "@/hooks/useSafeTimeout";
import { DIRECT_APK_DOWNLOAD_URL, EXPO_CLOUD_APP_URL } from "./downloadConstants";
import type { BeforeInstallPromptEvent } from "./useDeviceType";

export interface DownloadActions {
  hasCopied: boolean;
  copyToClipboard: (text: string, label: string) => void;
  handleDownloadApk: () => void;
  handleOpenExpo: () => void;
  handleInstallIosWebClip: () => void;
  handleAddToAndroidHome: (deferredPrompt: BeforeInstallPromptEvent | null) => Promise<void>;
}

export function useDownloadActions(): DownloadActions {
  const { t } = useI18n();
  const [hasCopied, setHasCopied] = useState(false);
  const later = useSafeTimeout();

  const copyToClipboard = useCallback(
    (text: string, label: string) => {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          setHasCopied(true);
          toast.success(t("download.copiedToast", { label }), { duration: 3000 });
          later(() => setHasCopied(false), 3000);
        })
        .catch(() => {
          // Clipboard access can be denied outside a secure context; the
          // button simply not confirming is the honest outcome.
        });
    },
    [t, later]
  );

  const handleDownloadApk = useCallback(() => {
    toast.success(t("download.toastApk"), { duration: 4000 });
    window.open(DIRECT_APK_DOWNLOAD_URL, "_blank");
  }, [t]);

  const handleOpenExpo = useCallback(() => {
    copyToClipboard(EXPO_CLOUD_APP_URL, t("download.cloudUrlLabel"));
    toast(t("download.toastExpo"), { icon: "🚀", duration: 2500 });
    window.location.href = EXPO_CLOUD_APP_URL;
  }, [copyToClipboard, t]);

  const handleInstallIosWebClip = useCallback(() => {
    copyToClipboard(EXPO_CLOUD_APP_URL, t("download.cloudUrlLabel"));
    toast.success(t("download.toastProfile"), { duration: 4000 });
    // Not a page navigation: this API route serves a .mobileconfig WebClip
    // profile download, which router.push() cannot trigger.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/api/camid-profile";
  }, [copyToClipboard, t]);

  const handleAddToAndroidHome = useCallback(
    async (deferredPrompt: BeforeInstallPromptEvent | null) => {
      if (!deferredPrompt) {
        toast.success(t("download.toastHomeManual"), { duration: 5000 });
        return;
      }
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted") {
          toast.success(t("download.toastHomeAdded"), { duration: 4000 });
        }
      } catch {
        toast.success(t("download.toastHomeHint"), { duration: 4000 });
      }
    },
    [t]
  );

  return {
    hasCopied,
    copyToClipboard,
    handleDownloadApk,
    handleOpenExpo,
    handleInstallIosWebClip,
    handleAddToAndroidHome,
  };
}
