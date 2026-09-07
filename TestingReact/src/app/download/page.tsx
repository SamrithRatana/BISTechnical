"use client";

/**
 * @file download/page.tsx
 * @description The CAM ID download hub — "Aperture Stage" redesign.
 *
 * A public, standalone dark landing page (no app shell): cinematic 3D phone
 * hero with a one-shot verification sequence, the Android/iOS platform duet
 * (in-place QR reveal, details accordion, copy link), a proof pipeline and a
 * closing CTA. Phones get a guided install timeline instead of the duet.
 *
 * This file only orchestrates — every section, hook and constant lives in
 * `src/components/download/`. Motion collapses to a static premium layout
 * under reduced-motion / Lite Mode (see useDownloadMotionMode).
 */

import React, { useState } from "react";
import { useI18n } from "@/i18n/LanguageProvider";
import DownloadHeader from "@/components/download/DownloadHeader";
import HeroStage from "@/components/download/HeroStage";
import StatementDivider from "@/components/download/StatementDivider";
import PlatformCard from "@/components/download/PlatformCard";
import ProofStrip from "@/components/download/ProofStrip";
import ClosingCta from "@/components/download/ClosingCta";
import DownloadFooter from "@/components/download/DownloadFooter";
import MobileInstallFlow from "@/components/download/MobileInstallFlow";
import { PLATFORM_CONTENT } from "@/components/download/platformContent";
import { useDownloadQr } from "@/components/download/useDownloadQr";
import { useDeviceType } from "@/components/download/useDeviceType";
import { useDownloadActions } from "@/components/download/useDownloadActions";
import { useDownloadMotionMode } from "@/components/download/useDownloadMotionMode";
import type { DownloadPlatform } from "@/components/download/downloadConstants";

export default function MobileDownloadPage() {
  const { t } = useI18n();
  const mode = useDownloadMotionMode();
  const deviceType = useDeviceType();
  const qr = useDownloadQr();
  const actions = useDownloadActions();

  // The visitor's explicit OS-tab choice wins; otherwise follow detection.
  const [tabOverride, setTabOverride] = useState<DownloadPlatform | null>(null);
  const activeMobileTab: DownloadPlatform =
    tabOverride ?? (deviceType === "desktop" ? "android" : deviceType);

  const [qrOpen, setQrOpen] = useState<Record<DownloadPlatform, boolean>>({
    android: false,
    ios: false,
  });

  const handleCta = (platform: DownloadPlatform) => {
    setQrOpen((prev) => ({ ...prev, [platform]: true }));
    document.getElementById("platforms")?.scrollIntoView({
      behavior: mode === "full" ? "smooth" : "auto",
      block: "start",
    });
  };

  return (
    <div
      className="relative min-h-screen overflow-x-clip font-sans text-slate-100 selection:bg-emerald-500/30"
      style={{
        background: "linear-gradient(180deg, #05070c, #0a1017 45%, #05070c)",
      }}
    >
      <DownloadHeader mode={mode} />

      {deviceType === "desktop" ? (
        <>
          <HeroStage mode={mode} onCta={handleCta} />
          <StatementDivider mode={mode} />

          <section
            id="platforms"
            className="mx-auto grid max-w-6xl scroll-mt-24 grid-cols-1 items-start gap-6 px-4 pb-24 sm:px-6 lg:grid-cols-2"
          >
            {(["android", "ios"] as const).map((key, i) => (
              <PlatformCard
                key={key}
                content={PLATFORM_CONTENT[key]}
                mode={mode}
                qrOpen={qrOpen[key]}
                onToggleQr={() => setQrOpen((prev) => ({ ...prev, [key]: !prev[key] }))}
                qrDataUrl={qr.qrDataUrl[key]}
                pageUrl={qr.pageUrl[key]}
                hasCopied={actions.hasCopied}
                onCopyLink={() =>
                  actions.copyToClipboard(qr.pageUrl[key], t(PLATFORM_CONTENT[key].linkLabelKey))
                }
                entranceDelay={i * 0.12}
              />
            ))}
          </section>

          <ProofStrip mode={mode} />
          <ClosingCta mode={mode} onCta={handleCta} />
          <DownloadFooter />
        </>
      ) : (
        <MobileInstallFlow
          platform={activeMobileTab}
          onSwitchTab={setTabOverride}
          detected={deviceType}
          mode={mode}
          actions={actions}
        />
      )}
    </div>
  );
}
