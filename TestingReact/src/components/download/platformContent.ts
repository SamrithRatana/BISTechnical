/**
 * @file components/download/platformContent.ts
 * @description Everything that differs between the Android and iOS halves of
 * the download hub, as data. The card/detail components render ONE layout and
 * read this config, so the two platforms can never drift apart structurally —
 * the old page duplicated ~400 lines per platform and did exactly that.
 */

import { Cpu, Lock, ScanFace, Wifi, Zap, type LucideIcon } from "lucide-react";
import type { TranslationKey } from "@/i18n/translations";
import type { DownloadPlatform } from "./downloadConstants";

export interface PlatformDetail {
  icon: LucideIcon;
  titleKey: TranslationKey;
  bodyKey: TranslationKey;
}

export interface PlatformContent {
  key: DownloadPlatform;
  /** Brand name, deliberately untranslated. */
  name: string;
  badgeKey: TranslationKey;
  devicesKey: TranslationKey;
  tagKey: TranslationKey;
  descKey: TranslationKey;
  featureKeys: readonly [TranslationKey, TranslationKey, TranslationKey];
  downloadCtaKey: TranslationKey;
  qrTitleKey: TranslationKey;
  qrHintKey: TranslationKey;
  detailsTitleKey: TranslationKey;
  details: readonly PlatformDetail[];
  linkLabelKey: TranslationKey;
  subtitleKey: TranslationKey;
  stepBodyKeys: {
    step1Body: TranslationKey;
    step1Cta: TranslationKey;
    step2Body: TranslationKey;
    step3Title: TranslationKey;
    step3Body: TranslationKey;
    step3Cta: TranslationKey;
  };
}

export const ANDROID_CONTENT: PlatformContent = {
  key: "android",
  name: "Android",
  badgeKey: "download.androidBadge",
  devicesKey: "download.androidDevices",
  tagKey: "download.androidTag",
  descKey: "download.androidDesc",
  featureKeys: [
    "download.androidFeature1",
    "download.androidFeature2",
    "download.androidFeature3",
  ],
  downloadCtaKey: "download.downloadForAndroid",
  qrTitleKey: "download.qrTitleAndroid",
  qrHintKey: "download.qrHintAndroid",
  detailsTitleKey: "download.detailsTitleAndroid",
  details: [
    { icon: Cpu, titleKey: "download.androidDetail1Title", bodyKey: "download.androidDetail1Body" },
    { icon: ScanFace, titleKey: "download.androidDetail2Title", bodyKey: "download.androidDetail2Body" },
    { icon: Wifi, titleKey: "download.androidDetail3Title", bodyKey: "download.androidDetail3Body" },
    { icon: Lock, titleKey: "download.androidDetail4Title", bodyKey: "download.androidDetail4Body" },
  ],
  linkLabelKey: "download.linkLabelAndroid",
  subtitleKey: "download.mobileSubtitleAndroid",
  stepBodyKeys: {
    step1Body: "download.step1BodyAndroid",
    step1Cta: "download.step1CtaAndroid",
    step2Body: "download.step2BodyAndroid",
    step3Title: "download.step3TitleAndroid",
    step3Body: "download.step3BodyAndroid",
    step3Cta: "download.step3CtaAndroid",
  },
};

export const IOS_CONTENT: PlatformContent = {
  key: "ios",
  name: "Apple iOS",
  badgeKey: "download.iosBadge",
  devicesKey: "download.iosDevices",
  tagKey: "download.iosTag",
  descKey: "download.iosDesc",
  featureKeys: ["download.iosFeature1", "download.iosFeature2", "download.iosFeature3"],
  downloadCtaKey: "download.downloadForIos",
  qrTitleKey: "download.qrTitleIos",
  qrHintKey: "download.qrHintIos",
  detailsTitleKey: "download.detailsTitleIos",
  details: [
    { icon: ScanFace, titleKey: "download.iosDetail1Title", bodyKey: "download.iosDetail1Body" },
    { icon: Lock, titleKey: "download.iosDetail2Title", bodyKey: "download.iosDetail2Body" },
    { icon: Zap, titleKey: "download.iosDetail3Title", bodyKey: "download.iosDetail3Body" },
    { icon: Wifi, titleKey: "download.iosDetail4Title", bodyKey: "download.iosDetail4Body" },
  ],
  linkLabelKey: "download.linkLabelIos",
  subtitleKey: "download.mobileSubtitleIos",
  stepBodyKeys: {
    step1Body: "download.step1BodyIos",
    step1Cta: "download.step1CtaIos",
    step2Body: "download.step2BodyIos",
    step3Title: "download.step3TitleIos",
    step3Body: "download.step3BodyIos",
    step3Cta: "download.step3CtaIos",
  },
};

export const PLATFORM_CONTENT: Record<DownloadPlatform, PlatformContent> = {
  android: ANDROID_CONTENT,
  ios: IOS_CONTENT,
};
