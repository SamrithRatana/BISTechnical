"use client";

/**
 * @file components/download/useDeviceType.ts
 * @description User-agent OS detection for the download hub, plus the deferred
 * Android PWA install prompt.
 *
 * Detection reads through `useSyncExternalStore` (the `usePasskeySupport`
 * pattern): the server snapshot is "desktop", so server HTML and hydration
 * agree, and the real device re-renders once after hydration — without a
 * `setState`-in-effect cascade. A browser's UA never changes mid-life, so the
 * subscription is a no-op.
 */

import { useEffect, useState, useSyncExternalStore } from "react";
import type { DownloadPlatform } from "./downloadConstants";

export type DeviceType = "desktop" | DownloadPlatform;

const subscribeNever = () => () => {};

function readDeviceType(): DeviceType {
  const ua = navigator.userAgent || navigator.vendor || "";
  const isIos =
    /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
  if (isIos) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

export function useDeviceType(): DeviceType {
  return useSyncExternalStore(subscribeNever, readDeviceType, () => "desktop");
}

/**
 * Chrome's non-standard install event. Not in lib.dom — typed here rather
 * than reaching for `any`.
 */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function usePwaInstallPrompt(): BeforeInstallPromptEvent | null {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  return deferredPrompt;
}
