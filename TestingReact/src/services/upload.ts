/**
 * @file services/upload.ts
 * @description The ONE function every image upload in the app calls —
 * SparePart Item images, the profile photo, and anything added later.
 *
 * Posts to `api/upload/route.ts`, which does the actual R2 write server-side
 * (credentials never reach the browser). This file only does client-side
 * validation (fail fast before spending a network round trip) and attaches
 * the caller's token — same `localStorage["jwt_token"]` key `services/api.ts`
 * and `AuthGuard` already use.
 *
 * Deliberately NOT reusing `api.ts`'s private `getAuthHeaders()`: that helper
 * always sets `Content-Type: application/json`, which is wrong for a
 * multipart upload — `fetch` has to set its own `Content-Type` (with the
 * boundary) when the body is a `FormData`, so this only ever adds
 * `Authorization`.
 */

/** Mirrors the server-side limits in `api/upload/route.ts`. */
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export type UploadErrorReason =
  | "unsupportedType"
  | "fileTooLarge"
  | "notSignedIn"
  | "notConfigured"
  | "uploadFailed";

export class UploadError extends Error {
  constructor(public reason: UploadErrorReason) {
    super(reason);
    this.name = "UploadError";
  }
}

/**
 * How long the upload may stall before it is abandoned.
 *
 * This is an INACTIVITY timeout, not a total one: it resets on every progress
 * event, so a genuinely slow 10MB upload on a weak connection is never cut off
 * while bytes are still moving. What it catches is the connection that is
 * accepted and then goes silent, which otherwise leaves the dialog on "0%"
 * with no error, forever.
 */
const STALL_TIMEOUT_MS = 30_000;

export interface UploadOptions {
  /** 0–100, called as bytes leave the browser. Never called after settle. */
  onProgress?: (percent: number) => void;
  /** Lets a caller cancel — e.g. the user closing the dialog mid-upload. */
  signal?: AbortSignal;
}

/**
 * Uploads one image to R2 and resolves to its public URL.
 *
 * ── Why XMLHttpRequest rather than fetch ──────────────────────────────────
 *
 * `fetch` cannot report upload progress. The Streams-based request body that
 * would allow it is not supported for `FormData`, and no browser fires
 * progress events for the request half of a `fetch`. So a 10MB photo over a
 * workshop's phone tether showed a spinner and nothing else — no percentage,
 * no way to tell a slow upload from a dead one, and no way to cancel.
 *
 * `XMLHttpRequest` is the older API and the only one with `upload.onprogress`.
 * That is the entire reason it is here; everything else about this function is
 * unchanged, including the server contract and the `UploadError` reasons.
 */
export function uploadImage(file: File, options: UploadOptions = {}): Promise<string> {
  const { onProgress, signal } = options;

  if (!ALLOWED_TYPES.has(file.type)) {
    return Promise.reject(new UploadError("unsupportedType"));
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return Promise.reject(new UploadError("fileTooLarge"));
  }

  return new Promise<string>((resolve, reject) => {
    const form = new FormData();
    form.append("file", file, file.name);

    const xhr = new XMLHttpRequest();
    let stallTimer: ReturnType<typeof setTimeout> | undefined;
    let settled = false;

    const cleanup = () => {
      if (stallTimer !== undefined) clearTimeout(stallTimer);
      signal?.removeEventListener("abort", onAbort);
    };
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn();
    };
    // Restarted on every byte of progress — see STALL_TIMEOUT_MS.
    const armStallTimer = () => {
      if (stallTimer !== undefined) clearTimeout(stallTimer);
      stallTimer = setTimeout(() => {
        xhr.abort();
        finish(() => reject(new UploadError("uploadFailed")));
      }, STALL_TIMEOUT_MS);
    };
    function onAbort() {
      xhr.abort();
      finish(() => reject(new DOMException("Upload cancelled", "AbortError")));
    }

    if (signal) {
      if (signal.aborted) { onAbort(); return; }
      signal.addEventListener("abort", onAbort, { once: true });
    }

    xhr.upload.addEventListener("progress", (e) => {
      armStallTimer();
      if (onProgress && e.lengthComputable) {
        onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
      }
    });

    // Bytes are all out; the server is now doing the R2 write. Progress events
    // have stopped, so the stall timer has to keep covering this window too.
    xhr.upload.addEventListener("load", armStallTimer);

    xhr.addEventListener("load", () => {
      let body: { url?: string; error?: UploadErrorReason } | null = null;
      try { body = JSON.parse(xhr.responseText); } catch { /* non-JSON error page */ }

      if (xhr.status >= 200 && xhr.status < 300 && body?.url) {
        onProgress?.(100);
        finish(() => resolve(body.url as string));
      } else {
        finish(() => reject(new UploadError(body?.error ?? "uploadFailed")));
      }
    });

    xhr.addEventListener("error", () => finish(() => reject(new UploadError("uploadFailed"))));
    xhr.addEventListener("abort", () => finish(() =>
      reject(new DOMException("Upload cancelled", "AbortError"))));

    xhr.open("POST", "/api/upload");
    const token = localStorage.getItem("jwt_token");
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    // Deliberately NOT setting Content-Type: the browser has to add the
    // multipart boundary itself, exactly as with fetch + FormData.
    armStallTimer();
    xhr.send(form);
  });
}
