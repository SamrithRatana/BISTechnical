"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Image as ImageIcon, Loader2, Upload, X } from "lucide-react";
import toast from "react-hot-toast";
import { useI18n } from "@/i18n/LanguageProvider";
import { uploadImage, UploadError } from "@/services/upload";
import { uploadErrorTranslationKey } from "@/lib/uploadErrorMessage";
import { TAXONOMY_INPUT_CLASS, TaxonomyField } from "./TaxonomyFormModal";

interface BrandLogoFieldProps {
  value: string;
  onChange: (url: string) => void;
}

/**
 * Optional brand logo: upload to R2 through the app's one upload utility, or
 * paste a URL. The URL box stays visible so a logo hosted elsewhere works
 * without an upload. Mirrors the spare-part picture field on `/spareparts`.
 *
 * The upload is abortable and is aborted on unmount: the dialog unmounts its
 * children when it closes, and an upload that outlived it would otherwise
 * write into the page's form state and toast for a dialog nobody can see.
 */
export function BrandLogoField({ value, onChange }: BrandLogoFieldProps) {
  const { t } = useI18n();
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const onFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = ""; // allows re-selecting the same file after an error
      if (!file) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setUploading(true);
      try {
        const url = await uploadImage(file, { signal: controller.signal });
        if (controller.signal.aborted) return;
        onChange(url);
      } catch (err) {
        if (controller.signal.aborted) return; // closed mid-upload: nothing to report
        const reason = err instanceof UploadError ? err.reason : "uploadFailed";
        toast.error(t(uploadErrorTranslationKey(reason)));
      } finally {
        if (!controller.signal.aborted) setUploading(false);
      }
    },
    [onChange, t]
  );

  return (
    <TaxonomyField label={t("spTax.logoOptional")}>
      {(id) => (
        <div className="flex items-start gap-3">
          {value ? (
            <div className="w-24 h-24 shrink-0 rounded-xl border-2 border-dashed border-subtle bg-cushion flex items-center justify-center relative overflow-hidden">
              {/* Arbitrary R2 / external host — next/image cannot be whitelisted for it. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={value} alt="" className="max-h-20 max-w-full object-contain" />
              <button
                type="button"
                onClick={() => onChange("")}
                aria-label={t("spTax.removeLogo")}
                className="absolute top-1 right-1 p-0.5 rounded-full bg-ink/60 text-white hover:bg-ink transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              aria-label={t("spTax.uploadLogo")}
              className="w-24 h-24 shrink-0 rounded-xl border-2 border-dashed border-subtle bg-cushion flex items-center justify-center hover:border-accent/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
            >
              <ImageIcon className="w-6 h-6 text-ink-muted" />
            </button>
          )}
          <div className="flex-1 min-w-0 space-y-2">
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInput.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-subtle bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-ink-secondary transition-colors hover:bg-cushion hover:text-ink disabled:opacity-60"
            >
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {t(uploading ? "upload.uploading" : "spTax.uploadLogo")}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={onFileSelected}
              className="hidden"
            />
            <input
              id={id}
              type="url"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="https://"
              aria-label={t("spTax.logoUrl")}
              className={TAXONOMY_INPUT_CLASS}
            />
          </div>
        </div>
      )}
    </TaxonomyField>
  );
}
