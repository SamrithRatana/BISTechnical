/**
 * @file lib/deviceTier.ts
 * @description Works out roughly how much visual work this machine can afford.
 *
 * ── The rule this file is built around ─────────────────────────────────────
 *
 * **No single signal decides anything.** Every input here is either missing on
 * some real browser, or lies:
 *
 * - `deviceMemory` is Chromium-only, and it is bucketed and capped at 8 — a
 *   64 GB workstation and a 8 GB laptop both report `8`.
 * - `hardwareConcurrency` counts threads, not speed. A 4-thread modern laptop
 *   outruns a 16-thread machine from 2013.
 * - The WebGL renderer string is masked or absent under privacy settings, and
 *   `WEBGL_debug_renderer_info` is deliberately unavailable in some browsers.
 * - `saveData` says what the user wants for *bandwidth*, which correlates with
 *   a cheap device but is not a statement about the GPU.
 *
 * So each contributes a vote, and the frame benchmark — the only input that
 * measures this machine actually doing work rather than describing itself —
 * carries the most weight and is the fallback when everything else is absent.
 *
 * Where the APIs are missing and the benchmark is inconclusive, the answer is
 * **medium**, never low and never high. Guessing low costs a capable user the
 * design; guessing high costs a struggling user the thing that would have
 * helped. Medium changes nothing and lets `prefers-reduced-motion` be the
 * safety net.
 *
 * ── Cost ───────────────────────────────────────────────────────────────────
 *
 * Runs once, client-side, after hydration. The benchmark is capped at
 * `BENCHMARK_MS` and is the only part that takes measurable time; everything
 * else is property reads. It must never be on the critical path to first
 * paint — see `PerformanceProvider`, which defers it to an idle callback.
 */

export type DeviceTier = "low" | "medium" | "high";

export interface DeviceSignals {
  /** `navigator.hardwareConcurrency`, or null where unreported. */
  cores: number | null;
  /** `navigator.deviceMemory` in GB, or null (non-Chromium). */
  memoryGb: number | null;
  /** Unmasked WebGL renderer string, or null when masked/unavailable. */
  renderer: string | null;
  /** True when the renderer string matches a known software/low-end GPU. */
  weakGpu: boolean;
  /** `navigator.connection.saveData`. */
  saveData: boolean;
  /** Mean frame interval in ms during the benchmark; null if it could not run. */
  meanFrameMs: number | null;
  /** Frames per second implied by `meanFrameMs`. */
  fps: number | null;
}

export interface DeviceAssessment {
  tier: DeviceTier;
  signals: DeviceSignals;
  /** Short, non-localised notes on what drove the verdict. Diagnostics only. */
  reasons: string[];
}

/**
 * How long the frame benchmark samples for.
 *
 * The brief allows about a second. This is deliberately under that: it runs
 * while the user is looking at a freshly-loaded page, and any time spent here
 * is time the detector itself is the performance problem.
 */
const BENCHMARK_MS = 600;

/** Ignore the first few frames — layout and paint of the new route land there. */
const WARMUP_FRAMES = 3;

/**
 * Sustained frame interval, in ms, below which a machine is not struggling.
 * 33.3ms is 30fps, the floor the brief names.
 */
const SLOW_FRAME_MS = 33.3;

/** Comfortably smooth: better than ~50fps. */
const FAST_FRAME_MS = 20;

/**
 * Renderer substrings that indicate software rasterisation or a GPU old enough
 * that blur and layered shadows are genuinely expensive.
 *
 * Matched case-insensitively against the unmasked renderer string. Kept
 * deliberately short: a list that tries to enumerate every weak GPU ages badly
 * and starts producing false positives on new hardware whose name happens to
 * contain a matching fragment. These are the unambiguous ones.
 */
const WEAK_GPU_PATTERNS = [
  "swiftshader", // Chrome's software rasteriser — no GPU at all
  "llvmpipe", // Mesa software rasteriser
  "software rasterizer",
  "microsoft basic render", // Windows fallback adapter
  "mali-4", // Mali-400/450, pre-2015 mobile
  "mali-t6",
  "adreno (tm) 3", // Adreno 3xx
  "videocore", // Raspberry Pi
];

/** Older Intel integrated parts, matched only as a whole token to avoid false hits. */
const WEAK_INTEL = /\bintel\b.*\bhd graphics\s*(2000|2500|3000|4000|4400|4600|500|505|510|520)\b/i;

function readCores(): number | null {
  const n = typeof navigator !== "undefined" ? navigator.hardwareConcurrency : undefined;
  return typeof n === "number" && n > 0 ? n : null;
}

function readMemory(): number | null {
  const n = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return typeof n === "number" && n > 0 ? n : null;
}

function readSaveData(): boolean {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return c?.saveData === true;
}

/**
 * The unmasked renderer string, or null.
 *
 * Wrapped in try/catch and followed by an explicit context loss: creating a
 * WebGL context costs real memory, and a browser only allows a small number of
 * them at once. Leaving this one alive to be garbage-collected whenever is
 * exactly the kind of thing that makes a "performance detector" a leak.
 */
function readRenderer(): string | null {
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) return null;

    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const raw = ext
      ? (gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string | null)
      : (gl.getParameter(gl.RENDERER) as string | null);

    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return typeof raw === "string" && raw.trim() ? raw.trim() : null;
  } catch {
    return null;
  }
}

function isWeakGpu(renderer: string | null): boolean {
  if (!renderer) return false;
  const r = renderer.toLowerCase();
  if (WEAK_GPU_PATTERNS.some((p) => r.includes(p))) return true;
  return WEAK_INTEL.test(renderer);
}

/**
 * Measures the mean interval between animation frames for `BENCHMARK_MS`.
 *
 * Deliberately does no synthetic work. An earlier shape of this spun a busy
 * loop to "load" the machine, which measured how fast the loop was rather than
 * whether the browser can hit its frame budget, and burned CPU on the exact
 * device it was trying to spare. An idle `requestAnimationFrame` loop already
 * reports the truth: a machine that cannot sustain its refresh rate while doing
 * nothing certainly cannot while compositing blurs.
 *
 * Resolves null if the tab is hidden — `rAF` is throttled or stopped there and
 * would report a false "very slow".
 */
function benchmarkFrames(): Promise<number | null> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame !== "function" || document.hidden) {
      resolve(null);
      return;
    }

    let frames = 0;
    let start = 0;
    let last = 0;
    let total = 0;
    let counted = 0;
    let rafId = 0;

    const stop = (value: number | null) => {
      cancelAnimationFrame(rafId);
      document.removeEventListener("visibilitychange", onHidden);
      resolve(value);
    };

    // A tab hidden mid-run makes every remaining sample meaningless.
    const onHidden = () => {
      if (document.hidden) stop(null);
    };
    document.addEventListener("visibilitychange", onHidden);

    const tick = (now: number) => {
      frames++;
      if (frames <= WARMUP_FRAMES) {
        last = now;
        start = now;
        rafId = requestAnimationFrame(tick);
        return;
      }
      total += now - last;
      counted++;
      last = now;

      if (now - start >= BENCHMARK_MS) {
        stop(counted > 0 ? total / counted : null);
        return;
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
  });
}

/**
 * Combines every signal into a tier.
 *
 * Scoring rather than a decision tree, so one missing input degrades the
 * confidence instead of short-circuiting the whole answer. Negative points
 * mean "struggling".
 */
function scoreToTier(s: DeviceSignals): { tier: DeviceTier; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  if (s.cores !== null) {
    if (s.cores <= 2) {
      score -= 2;
      reasons.push(`cores=${s.cores}`);
    } else if (s.cores >= 8) {
      score += 1;
    }
  }

  if (s.memoryGb !== null) {
    if (s.memoryGb <= 2) {
      score -= 2;
      reasons.push(`memory=${s.memoryGb}GB`);
    } else if (s.memoryGb >= 8) {
      score += 1;
    }
  }

  if (s.weakGpu) {
    score -= 2;
    reasons.push(`gpu=${s.renderer ?? "unknown"}`);
  }

  if (s.saveData) {
    score -= 1;
    reasons.push("saveData");
  }

  // The benchmark is the only measurement, so it is weighted heaviest and can
  // carry the verdict alone when every descriptive API was unavailable.
  if (s.meanFrameMs !== null) {
    if (s.meanFrameMs > SLOW_FRAME_MS) {
      score -= 3;
      reasons.push(`frame=${s.meanFrameMs.toFixed(1)}ms`);
    } else if (s.meanFrameMs <= FAST_FRAME_MS) {
      score += 2;
    }
  }

  if (score <= -3) return { tier: "low", reasons };
  if (score >= 2) return { tier: "high", reasons };
  // Everything else, including "we learned nothing", lands here on purpose.
  return { tier: "medium", reasons };
}

/**
 * Assesses the current device. Client-only — calling this during SSR throws on
 * `navigator`, which is why `PerformanceProvider` only calls it in an effect.
 */
export async function assessDevice(): Promise<DeviceAssessment> {
  const renderer = readRenderer();
  const meanFrameMs = await benchmarkFrames();

  const signals: DeviceSignals = {
    cores: readCores(),
    memoryGb: readMemory(),
    renderer,
    weakGpu: isWeakGpu(renderer),
    saveData: readSaveData(),
    meanFrameMs,
    fps: meanFrameMs !== null && meanFrameMs > 0 ? Math.round(1000 / meanFrameMs) : null,
  };

  const { tier, reasons } = scoreToTier(signals);
  return { tier, signals, reasons };
}
