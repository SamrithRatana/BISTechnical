"use client";

/**
 * @file hooks/useProfilePhotoUpload.ts
 * @description The upload+persist half of changing a profile photo, shared by
 * every place that offers it — the header's profile dropdown (the direct,
 * discoverable one) and the Settings → Theme & Branding page (where it also
 * feeds the "suggested from your photo" accent swatch).
 *
 * Deliberately owns only the MUTATION, not "what photo is currently shown" —
 * the header's trigger avatar, its dropdown mini-avatar, and Settings' larger
 * preview each have their own display state and their own reasons to re-read
 * it (an async `fetchUserMap()` refresh, a route change), so a single shared
 * `profilePictureUrl` here would just be one more copy to keep in sync.
 * Callers get the new URL back from `uploadPhoto` and set their own state
 * with it.
 */

import { useCallback, useState } from "react";
import toast from "react-hot-toast";
import { uploadImage, UploadError } from "@/services/upload";
import { uploadErrorTranslationKey } from "@/lib/uploadErrorMessage";
import { updateProfilePictureUrl } from "@/services/api";
import { updateGlobalBranding } from "@/services/appSettings";
import { invalidateUserMapCache } from "@/services/userService";
import { useI18n } from "@/i18n/LanguageProvider";

/**
 * Mirrors the `profilePictureUrl` field onto `localStorage["user_info"]`,
 * same shape `Header.tsx`'s `readStoredUser` reads — so the NEXT full page
 * load (a fresh `PageWrapper`/`Header` mount) already has the new photo
 * without waiting on a network round trip.
 */
function writeStoredBrandLogo(url: string): void {
  try {
    localStorage.setItem("system_brand_logo", url);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("system_brand_logo_updated", { detail: { url } }));
    }
  } catch {
    // Best-effort
  }
}

function writeStoredUserProfilePictureUrl(url: string): void {
  try {
    const stored = localStorage.getItem("user_info");
    const parsed = stored ? JSON.parse(stored) : {};
    localStorage.setItem("user_info", JSON.stringify({ ...parsed, profilePictureUrl: url }));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("user_info_updated", { detail: { url } }));
    }
  } catch {
    // Best-effort
  }
}

export function useProfilePhotoUpload() {
  const { t } = useI18n();
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  /** Uploads the System Brand Logo (for Sidebar, Login page, and Theme Auto-Detection) */
  const uploadBrandLogo = useCallback(
    async (file: File): Promise<string | null> => {
      setIsUploading(true);
      setProgress(0);
      try {
        const url = await uploadImage(file, { onProgress: setProgress });
        if (!url) throw new UploadError("uploadFailed");

        writeStoredBrandLogo(url);
        // Persist to server so every user on every browser receives the new brand logo
        await updateGlobalBranding({ logoUrl: url });
        return url;
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return null;
        const reason = err instanceof UploadError ? err.reason : "uploadFailed";
        toast.error(t(uploadErrorTranslationKey(reason)));
        return null;
      } finally {
        setIsUploading(false);
        setProgress(null);
      }
    },
    [t]
  );

  /** Uploads the individual logged-in User's Profile Picture (for Header top-right avatar) */
  const uploadPhoto = useCallback(
    async (file: File): Promise<string | null> => {
      setIsUploading(true);
      setProgress(0);
      try {
        const url = await uploadImage(file, { onProgress: setProgress });
        if (!url) throw new UploadError("uploadFailed");

        writeStoredUserProfilePictureUrl(url);

        try {
          await updateProfilePictureUrl(url);
        } catch {
          // Backend sync failure is non-fatal
        }

        invalidateUserMapCache();
        return url;
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return null;
        const reason = err instanceof UploadError ? err.reason : "uploadFailed";
        toast.error(t(uploadErrorTranslationKey(reason)));
        return null;
      } finally {
        setIsUploading(false);
        setProgress(null);
      }
    },
    [t]
  );

  return { isUploading, progress, uploadPhoto, uploadBrandLogo };
}
