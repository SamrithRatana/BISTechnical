import type { UploadErrorReason } from "@/services/upload";
import type { TranslationKey } from "@/i18n/translations";

/**
 * Maps a `services/upload.ts` failure reason to the i18n key that explains
 * it — shared by every upload entry point (SparePart images, the profile
 * photo) rather than each call site re-deriving the key with a template
 * string, which `TranslationKey` (a strict union, not `string`) can't be
 * built from safely at the call site anyway.
 */
const UPLOAD_ERROR_KEY: Record<UploadErrorReason, TranslationKey> = {
  unsupportedType: "upload.error.unsupportedType",
  fileTooLarge: "upload.error.fileTooLarge",
  notSignedIn: "upload.error.notSignedIn",
  notConfigured: "upload.error.notConfigured",
  uploadFailed: "upload.error.uploadFailed",
};

export function uploadErrorTranslationKey(reason: UploadErrorReason): TranslationKey {
  return UPLOAD_ERROR_KEY[reason];
}
