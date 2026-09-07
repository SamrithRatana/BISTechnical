"use client";

/**
 * @file BrandLogo.tsx
 * @description The one place the uploaded brand logo is turned into pixels.
 *
 * Every logo render in the app used a raw `<img src={brandLogo}>`. The logo
 * actually in use is 8000x4500 (36 MP) and is displayed in a 32-40px box, so
 * the browser decoded the full bitmap for each copy: 144 MB of RAM apiece, two
 * copies on every authenticated page (sidebar + header), 298 MB of decoded
 * image RAM measured on `/spareparts` alone.
 *
 * That weight was not only a memory cost. `ModalWrapper` stacks two
 * `backdrop-filter` layers (the full-screen `backdrop-blur-md` and the panel's
 * `blur(32px) saturate(190%)`), and a backdrop filter has to sample and blur
 * everything painted behind it -- including those two 36 MP layers. Measured on
 * the spare-parts image modal, the first open dropped a 300ms frame; later
 * opens were clean because the blurred result was cached. Removing the panel
 * blur removed the dropped frame, which is what identified the giant bitmaps
 * rather than the animation as the cause. The animation itself is fine: it is
 * transform/opacity only, per the standards.
 *
 * Routing the logo through `next/image` serves a ~128px variant, so there is no
 * 36 MP layer left for the blur to sample.
 *
 * ── Why the plain-<img> fallback is not dead code ──────────────────────────
 * `brandLogo` is a runtime value: an admin sets it in settings and it is read
 * back from `localStorage`, so it can point at any host. On a host missing
 * from `remotePatterns`, `next/image` throws at render time in development
 * (taking the whole sidebar down) and serves a 400/broken image in production
 * -- the throw is wrapped in a NODE_ENV check inside Next's image loader.
 * Either way the logo is lost. When the host is not one the optimizer accepts we render
 * the plain tag instead -- unoptimized, exactly as before, but never broken.
 * The same reasoning is why `spareparts/page.tsx` keeps a raw tag for part
 * photos, whose URLs come straight from the parts database.
 */

import Image from "next/image";
import type { CSSProperties } from "react";

/**
 * Inlined at build time by `next.config.ts` from `R2_PUBLIC_BASE_URL`, so this
 * check and `remotePatterns` are always derived from the same value. Empty when
 * R2 is unconfigured, which sends every logo down the fallback path.
 */
const OPTIMIZABLE_HOST = process.env.NEXT_PUBLIC_R2_PUBLIC_HOST ?? "";

/**
 * Intrinsic width handed to the optimizer. The largest box any caller renders
 * into is 40px (`w-10`), so 128 covers it at 3x device pixel ratio and still
 * lands on one of Next's built-in `imageSizes` steps rather than forcing a
 * bespoke resize.
 */
const INTRINSIC_PX = 128;

/**
 * True for same-origin paths and for the configured R2 host over https;
 * false otherwise.
 *
 * Must agree with `remotePatterns` in `next.config.ts`, which pins
 * `protocol: "https"` — so an `http://` URL on the right host must fail here
 * too, or dev throws at render and prod serves a broken image. Protocol-
 * relative `//host/...` is excluded from the same-origin branch for the same
 * reason: the default loader rejects it.
 */
function canOptimize(src: string): boolean {
  if (src.startsWith("/") && !src.startsWith("//")) return true;
  if (!OPTIMIZABLE_HOST) return false;
  try {
    const url = new URL(src);
    return url.protocol === "https:" && url.hostname === OPTIMIZABLE_HOST;
  } catch {
    // Not an absolute URL and not root-relative -- a `data:` URI or malformed
    // value. Hand it to the plain tag, which renders both without throwing.
    return false;
  }
}

export interface BrandLogoProps {
  /** Logo URL as stored by settings. */
  src: string;
  alt?: string;
  /** Sizing/appearance classes. Callers pass `w-full h-full object-contain`. */
  className?: string;
  /** Used for the caller-configurable `logoScale` transform. */
  style?: CSSProperties;
  /** Lets callers degrade (initials, placeholder) instead of a broken-image glyph. */
  onError?: () => void;
}

/**
 * Renders the brand logo, optimized when the host allows it.
 *
 * Display size is controlled entirely by `className` (`w-full h-full`), the way
 * the raw tags it replaces were. `width`/`height` here only tell the optimizer
 * which variant to generate; because both CSS dimensions are set, Next raises
 * no aspect-ratio warning, and `object-contain` keeps a non-square logo correct
 * inside a square box.
 */
export function BrandLogo({ src, alt = "Logo", className, style, onError }: BrandLogoProps) {
  if (!canOptimize(src)) {
    return (
      /* Host is not in `remotePatterns`; see the fallback note in this
         file's header for why this must stay a plain tag. Async decode and
         lazy load because this branch may be handed an arbitrarily large
         original -- exactly the case the optimized branch cannot take. */
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        className={className}
        style={style}
        decoding="async"
        loading="eager"
        onError={onError}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={INTRINSIC_PX}
      height={INTRINSIC_PX}
      className={className}
      style={style}
      priority
      onError={onError}
    />
  );
}

export default BrandLogo;
