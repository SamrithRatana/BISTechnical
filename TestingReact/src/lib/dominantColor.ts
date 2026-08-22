/**
 * @file lib/dominantColor.ts
 * @description Picks one representative accent colour out of an image, for
 * the Theme & Branding page's "Suggested from your photo" swatch.
 *
 * Method: draw the image to an offscreen `<canvas>`, read every pixel via
 * `getImageData`, bucket similar colours together (coarse RGB buckets, not
 * exact matches — a photo rarely repeats the exact same pixel value twice),
 * skip near-white/near-black/near-grey pixels (background, shadow, skin
 * highlights — rarely what anyone means by "the colour of this photo"), and
 * return the most-frequent bucket's average colour.
 *
 * ── CORS, not assumed away ─────────────────────────────────────────────────
 *
 * `getImageData` throws a SecurityError ("tainted canvas") unless the image
 * was loaded with permissive CORS headers — setting `crossOrigin="anonymous"`
 * on the `<img>` only works if the SERVER also sends
 * `Access-Control-Allow-Origin`. Whether the R2 bucket this app uploads to
 * does that is a bucket-CORS-policy question, not a code one — verify against
 * the real bucket before relying on this. `extractDominantColor` resolves to
 * `null` on that failure (and any other), so the caller can treat "no
 * suggestion available" as an expected, unremarkable outcome rather than an
 * error to surface.
 */

const SAMPLE_SIZE = 64; // Downscaled canvas edge — plenty for a dominant colour, cheap to scan.
const BUCKET_SIZE = 24; // Coarser buckets than 256 levels/channel — merges near-duplicate shades.

const dominantColorCache = new Map<string, string>();

function isNearNeutral(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const saturation = max === min ? 0 : (max - min) / (255 - Math.abs(2 * lightness - 255));
  // Low saturation (grey) OR extreme lightness (near-white / near-black)
  return saturation < 0.12 || lightness < 20 || lightness > 240;
}

function toHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Resolves to a vibrant hex colour from an image URL, File, or Blob.
 * Uses an internal CORS-safe proxy for remote URLs to avoid tainted canvas errors.
 */
export function extractDominantColor(input: string | File | Blob): Promise<string | null> {
  // ⚡ 0ms in-memory cache hit: prevents redundant HTTP proxy calls & Canvas allocations
  if (typeof input === "string" && dominantColorCache.has(input)) {
    return Promise.resolve(dominantColorCache.get(input)!);
  }

  return new Promise((resolve) => {
    let targetSrc: string;
    let isCreatedBlob = false;

    if (typeof input !== "string") {
      try {
        targetSrc = URL.createObjectURL(input);
        isCreatedBlob = true;
      } catch {
        return resolve(null);
      }
    } else {
      if (!input || input.trim() === "") return resolve(null);
      // If remote HTTP(S) URL, wrap in safe server-side image proxy to guarantee zero CORS tainted canvas errors
      if (input.startsWith("http://") || input.startsWith("https://")) {
        targetSrc = `/api/image-proxy?url=${encodeURIComponent(input)}`;
      } else {
        targetSrc = input;
      }
    }

    const cleanup = () => {
      if (isCreatedBlob && targetSrc) {
        try {
          URL.revokeObjectURL(targetSrc);
        } catch {}
      }
    };

    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      let canvas: HTMLCanvasElement | null = null;
      try {
        canvas = document.createElement("canvas");
        canvas.width = SAMPLE_SIZE;
        canvas.height = SAMPLE_SIZE;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          cleanup();
          return resolve(null);
        }

        ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
        const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);

        const buckets = new Map<string, { r: number; g: number; b: number; count: number; weight: number }>();

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const alpha = data[i + 3];
          if (alpha < 180) continue; // Skip transparent/semi-transparent pixels
          if (isNearNeutral(r, g, b)) continue;

          // Calculate saturation and contrast to prefer vibrant brand colors
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const sat = max === min ? 0 : (max - min) / 255;
          const pixelWeight = 1 + sat * 2; // Favor colorful pixels over dull ones

          const key = `${Math.floor(r / BUCKET_SIZE)}-${Math.floor(g / BUCKET_SIZE)}-${Math.floor(b / BUCKET_SIZE)}`;
          const bucket = buckets.get(key);
          if (bucket) {
            bucket.r += r;
            bucket.g += g;
            bucket.b += b;
            bucket.count += 1;
            bucket.weight += pixelWeight;
          } else {
            buckets.set(key, { r, g, b, count: 1, weight: pixelWeight });
          }
        }

        let best: { r: number; g: number; b: number; count: number; weight: number } | null = null;
        for (const bucket of buckets.values()) {
          if (!best || bucket.weight > best.weight) best = bucket;
        }

        cleanup();
        canvas.width = 0;
        canvas.height = 0;
        img.src = "";
        img.onload = null;
        img.onerror = null;

        if (!best || best.count === 0) return resolve(null);
        const hex = toHex(best.r / best.count, best.g / best.count, best.b / best.count);
        if (typeof input === "string") {
          dominantColorCache.set(input, hex);
        }
        resolve(hex);
      } catch {
        cleanup();
        if (canvas) {
          canvas.width = 0;
          canvas.height = 0;
        }
        img.src = "";
        img.onload = null;
        img.onerror = null;
        resolve(null);
      }
    };

    img.onerror = () => {
      cleanup();
      img.src = "";
      img.onload = null;
      img.onerror = null;
      resolve(null);
    };

    img.src = targetSrc;
  });
}
