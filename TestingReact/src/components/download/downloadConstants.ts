/**
 * @file components/download/downloadConstants.ts
 * @description Shared constants for the public /download landing page.
 *
 * URLs live here — never inline in a component — so the APK build, the Expo
 * release channel and the store listings are updated in exactly one place.
 */

export const DIRECT_APK_DOWNLOAD_URL =
  "https://expo.dev/artifacts/eas/u3JSTaiTlu4H-iaGaO_tyxo5ycFTZap2WhYLqL_afl0.apk";
export const IOS_APP_STORE_URL = "https://apps.apple.com/app/expo-go/id982107779";
export const ANDROID_PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=host.exp.exponent";
export const EXPO_CLOUD_APP_URL =
  "exp://u.expo.dev/cacb17a6-21d6-4b45-abf1-aab99521f61e?channel-name=master";

/** Expo project handle shown in the cloud pill. Brand data, not UI copy. */
export const EXPO_PROJECT_HANDLE = "@ratana2012/cam-id";

export const APP_VERSION = "v1.0.1";

export type DownloadPlatform = "android" | "ios";

/** QR module colors — the dark module must stay near-black on white so any
 *  phone camera reads it regardless of the page theme around it. */
export const QR_DARK = "#090d16";
export const QR_LIGHT = "#ffffff";
