/**
 * @file api/ai-search/image.ts
 * @description Image generation for the assistant, on Google's Nano Banana models.
 *
 * The assistant's normal job is to read the system and answer from it. This is
 * the one thing it *makes* rather than looks up: when a message asks for a
 * picture ("generate an image of…", "ជួយបង្កើតរូបភាព…") the question never
 * reaches the tool loop — there is nothing to look up — and is answered with a
 * generated image instead.
 *
 * Kept in its own module rather than added to the tool list on purpose. Image
 * models are a different family with their own ids, their own quota buckets and
 * a response shape (`inlineData`) the text path has no notion of, so folding
 * them into `GEMINI_MODELS` would put an image model in the text rotation and
 * in the picker, where selecting one produces a request that cannot answer a
 * question about tickets.
 *
 * ── Two providers, best-first ────────────────────────────────────────────
 * 1. Nano Banana (Gemini) — better pictures, but billing-gated, see below.
 * 2. Pollinations — keyless, free, no signup. Reached whenever Nano Banana
 *    can't serve, which on an unbilled project is every single request.
 *
 * The fallback is what makes this feature work out of the box: with no key and
 * no billing at all, a "draw me…" message still comes back with a picture.
 *
 * ── Free tier, and what it actually costs ────────────────────────────────
 * The list is ordered cheapest-first because the ask was for a free-tier
 * feature, but "free tier" is a property of the *project behind the key*, not
 * of the model. Verified against this repo's key on 2026-08-14 — every image
 * model, Lite included, reports:
 *
 *   Quota exceeded for metric: ...generate_content_free_tier_requests,
 *   limit: 0, model: gemini-3.1-flash-lite-image
 *
 * `limit: 0` is not a spent daily allowance; it is *no free allowance at all*.
 * Image generation on this API is billing-gated, so on an unbilled project
 * every model here 429s on the first request. That is why `freeTierUnavailable`
 * is reported separately from an ordinary quota wait: telling a user to "try
 * again in 4 seconds" when the real answer is "this key has no image quota"
 * sends them into an endless retry loop.
 *
 * Enabling billing on the Google Cloud project behind `GEMINI_API_KEY` turns
 * the whole list on with no code change. Text answers are unaffected either
 * way — they run on a separate free-tier allowance that is not zero. Until
 * then Pollinations answers instead, so the feature is not blocked on it.
 *
 * ── One thing to be aware of about the fallback ───────────────────────────
 * Pollinations is an anonymous public endpoint: the prompt is sent to a third
 * party over the open internet, with no account and no contract behind it.
 * Nothing from the workshop's data is included — only the words the user typed
 * after "draw me" — but a prompt is still user input leaving the system, so it
 * is worth knowing about in a business application. Set
 * `AI_IMAGE_POLLINATIONS=off` to turn the fallback off and keep image
 * generation on Gemini alone.
 */

/**
 * Nano Banana models, cheapest first.
 *
 * Ordered by price rather than quality, which is the opposite of the text
 * rotation in `route.ts` — there, whichever model answers *is* the feature's
 * quality, whereas here every model produces a usable picture and only the bill
 * differs. Lite leads at $0.0336/image, then Flash at $0.0672, then Pro at
 * $0.134 — so a working image costs as little as possible, and the more
 * expensive entries exist only to keep the feature alive when a cheaper one is
 * rate-limited.
 *
 * `-preview` aliases are deliberately omitted: they resolve to the same quota
 * bucket as the pinned id, so including them would add a guaranteed second 429
 * per bucket without adding any allowance.
 */
const IMAGE_MODELS: ReadonlyArray<{ id: string; label: string }> = [
  { id: "gemini-3.1-flash-lite-image", label: "Nano Banana 2 Lite" },
  { id: "gemini-3.1-flash-image", label: "Nano Banana 2" },
  { id: "gemini-2.5-flash-image", label: "Nano Banana" },
  { id: "gemini-3-pro-image", label: "Nano Banana Pro" },
];

/**
 * Longest we will wait for one picture, across every provider attempt.
 *
 * Sized from measurement, not taste. The anonymous Pollinations endpoint serves
 * the first request from an IP in ~2.5s and then throttles: every subsequent
 * one queues and lands at ~45s, still with a real image and a 200. A 45s budget
 * therefore aborted requests *one second before they succeeded* — the second
 * picture in a session always failed while the provider was working fine.
 *
 * 55s clears that with margin and stays under the route's `maxDuration` of 60s,
 * which is the hard ceiling this must not reach. It does not slow anything
 * down: a request that finishes in 3s still returns in 3s, and the budget only
 * bounds how long a throttled one is allowed to keep waiting.
 */
export const IMAGE_BUDGET_MS = 55_000;

/**
 * Pollinations has two generations of API, and which one is reachable depends
 * entirely on whether a key is configured:
 *
 * - `gen.pollinations.ai/image/{prompt}` is the current, documented one
 *   (https://gen.pollinations.ai/docs#tag/image). It rejects anonymous calls
 *   with 401 — verified 2026-08-14 — so it is used only when
 *   `POLLINATIONS_API_KEY` is set. In exchange it offers the better free
 *   models: `zimage` (Z-Image Turbo, the API's own default) and `flux`
 *   (FLUX.1 Schnell) among them.
 * - `image.pollinations.ai/prompt/{prompt}` is the older endpoint and still
 *   serves anonymously. It is what makes this feature work with no signup at
 *   all, which is the reason the fallback exists.
 *
 * Keyless first-run therefore works, and adding a key is a pure upgrade rather
 * than a migration. Worth knowing that the legacy endpoint is the fragile half
 * of that arrangement: if Pollinations retires it, keyless generation stops and
 * a key becomes required.
 */
const POLLINATIONS_KEYED_ENDPOINT = "https://gen.pollinations.ai/image";
const POLLINATIONS_ANON_ENDPOINT = "https://image.pollinations.ai/prompt";

/**
 * Model used on the keyed endpoint. `zimage` is the API's own default and is
 * not `paid_only`; `flux` is the other well-known free option. Ignored on the
 * anonymous endpoint, which does not offer a choice.
 */
const POLLINATIONS_MODEL = process.env.POLLINATIONS_MODEL?.trim() || "zimage";

/**
 * Pollinations models offered in the picker: the ones its own catalogue does
 * not mark `paid_only`. Every entry still bills against the `pollen` balance,
 * so they are only reachable with a funded key — the anonymous entry below is
 * the one that works at zero balance.
 */
const POLLINATIONS_FREE_MODELS: ReadonlyArray<{ id: string; label: string }> = [
  { id: "zimage", label: "Z-Image Turbo" },
  { id: "flux", label: "FLUX.1 Schnell" },
  { id: "gptimage", label: "GPT Image 1 Mini" },
  { id: "klein", label: "FLUX.2 Klein 4B" },
];

/** Prefix marking a picker id as "route this to Pollinations, not Gemini". */
const POLLINATIONS_PREFIX = "pollinations:";
/** The keyless entry — no model choice, because the old endpoint offers none. */
export const POLLINATIONS_ANON_ID = "pollinations:anonymous";

function getPollinationsKey(): string | undefined {
  return process.env.POLLINATIONS_API_KEY?.trim() || undefined;
}

/**
 * When to stop bothering with the keyed endpoint.
 *
 * A key with no `pollen` balance answers 402 to every request in about a
 * second. That is a wasted round-trip on the way to the anonymous endpoint for
 * *every* picture, so the first one is remembered and the keyed attempt is
 * skipped until this expires. Half an hour is short enough that topping the
 * balance up starts working on its own, without needing a restart.
 */
let keyedUnavailableUntil = 0;
const KEYED_COOLDOWN_MS = 30 * 60_000;

/**
 * Opt-out rather than opt-in: the whole point of the fallback is that image
 * generation works with no setup, and defaulting it off would leave an unbilled
 * install with a feature that only ever apologises. Any of off/0/false/no
 * disables it, so whichever spelling someone reaches for in an env file works.
 */
function pollinationsEnabled(): boolean {
  const raw = (process.env.AI_IMAGE_POLLINATIONS ?? "").trim().toLowerCase();
  return !["off", "0", "false", "no", "disabled"].includes(raw);
}

/**
 * Rate-limit and retirement memory, keyed by `keyIndex:model`.
 *
 * Deliberately separate from the text rotation's maps in `route.ts`: image
 * models draw on their own quota buckets, so a spent image model says nothing
 * about the text models and must not sideline them (or appear in their picker).
 * Module scope, so it resets on restart — a latency optimisation, not a source
 * of truth.
 */
const imageCooldowns = new Map<string, { until: number; strikes: number }>();
const imageRetired = new Set<string>();

const COOLDOWN_MIN_MS = 30_000;
const COOLDOWN_MAX_MS = 30 * 60_000;

function slot(keyIndex: number, model: string): string {
  return `${keyIndex}:${model}`;
}

// ---------------------------------------------------------------------------
// Recognising the request
// ---------------------------------------------------------------------------

/**
 * A verb that means "make one" followed by a word for a picture.
 *
 * Both halves are required. "image" on its own is not a request to draw —
 * "show me the image on that spare part" is a lookup, and treating it as a
 * generation would replace a real answer with an invented picture. Requiring
 * the verb is what keeps the two apart.
 */
/**
 * The subject is allowed to sit *between* the verb and the picture noun, which
 * is how people actually type this: "create cat image" and "generate a red
 * printer photo" are as common as "create an image of a cat", and requiring the
 * noun to follow the verb directly missed every one of them — the message fell
 * through to the tool loop and came back "I cannot generate images".
 *
 * Bounded at three words, and lazily, so the two halves stay in one phrase.
 * Without a bound, "make a note about the broken scanner and attach the photo"
 * would read as a drawing request.
 *
 * Capture groups are numbered rather than named because the project targets
 * ES2017, where named groups are a syntax error: [1] is the article, [2] the
 * words between, [3] the picture noun. Every other group is non-capturing to
 * keep those indexes stable if the verb list grows.
 */
const ENGLISH_TRIGGER =
  /\b(?:(?:can|could|please|help)\s+(?:me\s+)?(?:to\s+)?)?(?:generate|create|make|draw|design|render|produce|paint|sketch)\s+(?:me\s+)?(an?\s+|some\s+|the\s+)?((?:[A-Za-z0-9'-]+\s+){0,3}?)(image|picture|photo|photograph|logo|icon|illustration|drawing|artwork|art|graphic|banner|poster|wallpaper|avatar)s?\b/i;

/**
 * Nouns that only mean "a picture" and carry no subject of their own.
 *
 * The distinction decides what survives into the prompt. In "generate an image
 * of a red printer" the word *image* is packaging — the subject is the printer,
 * and keeping the packaging would just be noise. But in "draw a logo for my
 * repair shop" the word *logo* is the entire instruction: drop it and the
 * prompt becomes "my repair shop", which draws a repair shop rather than a logo
 * for one. Everything not listed here is treated as subject matter and put back.
 */
const GENERIC_PICTURE_NOUNS = new Set([
  "image",
  "picture",
  "photo",
  "photograph",
  "drawing",
  "art",
  "artwork",
  "graphic",
]);

/**
 * Khmer equivalent: a making verb plus រូបភាព/រូប (image/picture), or គូរ
 * (draw) which already implies one on its own.
 *
 * The verb and the noun are allowed to sit a few characters apart because
 * Khmer inserts particles between them (ជួយបង្កើត**ឲ្យខ្ញុំ**រូបភាព), and Khmer
 * is written without spaces so a word-boundary match is not available.
 */
const KHMER_TRIGGER = /(?:បង្កើត|ធ្វើ|ជួយ|សូម)[ក-៿\s]{0,14}?រូប(?:ភាព)?|គូរ/;

/** Leading connectives left behind once the trigger phrase is removed. */
const LEADING_FILLER =
  /^(?:\s*(?:of|for|about|showing|that shows|which shows|with|:|,|-|–|—|នៃ|អំពី|ដែល|ជា)\s*)+/i;

export interface ImageRequest {
  /** What to draw, with the trigger phrase stripped off. May be empty. */
  prompt: string;
}

/**
 * Decides whether a message is asking for a picture, and extracts the subject.
 *
 * Returns null for anything else, so an ordinary question falls straight
 * through to the tool loop untouched.
 */
export function detectImageRequest(query: string): ImageRequest | null {
  const text = query.trim();
  if (!text) return null;

  const english = text.match(ENGLISH_TRIGGER);
  const match = english ?? text.match(KHMER_TRIGGER);
  if (!match || match.index === undefined) return null;

  // Everything after the trigger is the subject; anything before it is usually
  // politeness ("hey, can you…"), so it is dropped rather than drawn.
  const after = text.slice(match.index + match[0].length);

  // Words captured between the verb and the picture noun — the subject in
  // "create cat image". Whatever the noun turns out to be, these are the user's
  // own words and must survive into the prompt.
  const middle = (english?.[2] ?? "").trim();
  const noun = english?.[3]?.toLowerCase();

  if (noun && !GENERIC_PICTURE_NOUNS.has(noun)) {
    // A subject-bearing noun goes back into the prompt, and the connective
    // after it is left alone — "for" in "a logo for my repair shop" joins the
    // two halves, unlike the "of" in "an image of a printer", which only links
    // packaging to subject.
    const article = english?.[1] ?? "";
    return { prompt: `${article}${middle ? `${middle} ` : ""}${noun}${after}`.trim() };
  }

  // Generic noun: it is packaging, so it is dropped and the subject is whatever
  // sat before it plus whatever follows — "create cat image" -> "cat",
  // "generate an image of a red printer" -> "a red printer".
  const trailing = after.replace(LEADING_FILLER, "").trim();
  return { prompt: [middle, trailing].filter(Boolean).join(" ").trim() };
}

/** Khmer script anywhere means the user is writing Khmer. */
export function isKhmerText(text: string): boolean {
  return /[ក-៿]/.test(text);
}

// ---------------------------------------------------------------------------
// Generating
// ---------------------------------------------------------------------------

export interface GeneratedImage {
  /** `data:<mime>;base64,<…>` — inlined so no blob has to be hosted anywhere. */
  dataUrl: string;
  mimeType: string;
  /** The model id that produced it. */
  model: string;
  /** Human-readable name for the transcript ("Nano Banana 2 Lite"). */
  label: string;
  /** The subject that was drawn, for the alt text. */
  prompt: string;
}

export type ImageOutcome =
  | { ok: true; image: GeneratedImage }
  | {
      ok: false;
      reason: "quota" | "unavailable";
      retryAfterSeconds?: number;
      /**
       * True when the provider reported a free-tier limit of *zero* rather than
       * an exhausted allowance — the key's project has no image quota at all,
       * and no amount of waiting changes that.
       */
      freeTierUnavailable?: boolean;
    };

interface ImagePart {
  text?: string;
  inlineData?: { mimeType?: string; data?: string };
  inline_data?: { mime_type?: string; data?: string };
}

/** Google reports the wait in a RetryInfo detail, and sometimes as a header. */
function parseRetryDelay(body: string, headers: Headers): number | undefined {
  const header = headers.get("retry-after");
  if (header && /^\d+$/.test(header.trim())) return Number(header.trim());
  const match = body.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  return match ? Math.ceil(Number(match[1])) : undefined;
}

/**
 * True when a 429 body says the free-tier *request* limit is 0 — i.e. the
 * project was never allowed image generation, as opposed to having used up a
 * real allowance.
 */
function isZeroFreeTier(body: string): boolean {
  return /free_tier_requests,\s*limit:\s*0\b/.test(body);
}

function noteRateLimit(keyIndex: number, model: string) {
  const id = slot(keyIndex, model);
  const strikes = (imageCooldowns.get(id)?.strikes ?? 0) + 1;
  imageCooldowns.set(id, {
    until: Date.now() + Math.min(COOLDOWN_MIN_MS * 2 ** (strikes - 1), COOLDOWN_MAX_MS),
    strikes,
  });
}

/** Key indexes still worth trying for one model, in preference order. */
function readyKeysFor(model: string, keyCount: number): number[] {
  const now = Date.now();
  const live = Array.from({ length: keyCount }, (_, i) => i).filter(
    (i) => !imageRetired.has(slot(i, model))
  );
  const ready = live.filter((i) => (imageCooldowns.get(slot(i, model))?.until ?? 0) <= now);
  // A cooldown is an estimate; a model with every key cooling still deserves
  // one attempt rather than being skipped outright.
  return ready.length > 0 ? ready : live;
}

/**
 * Whether a "draw me…" message can be answered at all.
 *
 * True with no Gemini key whatsoever as long as the fallback is on — which is
 * the normal case, and why this takes the key count rather than assuming one.
 */
export function imageModelsAvailable(keyCount: number): boolean {
  if (pollinationsEnabled()) return true;
  if (keyCount <= 0) return false;
  return IMAGE_MODELS.some(({ id }) => readyKeysFor(id, keyCount).length > 0);
}

/** One row in the picker's image section. Mirrors the text `ModelStatus`. */
export interface ImageModelStatus {
  id: string;
  label: string;
  available: boolean;
  retryInSeconds: number;
}

/**
 * What the picker shows for images.
 *
 * Everything reachable is listed with an honest availability dot rather than
 * hidden, because here "unavailable" is usually a *billing* state the user can
 * act on — an empty Nano Banana section would just look like the models don't
 * exist, when the truth is that they are one billing switch away. Entries with
 * no credential behind them at all are the exception and are omitted: the
 * Pollinations model rows appear only once a key is set, since without one they
 * could never be chosen.
 */
export function imageModelStatus(keyCount: number): ImageModelStatus[] {
  const now = Date.now();
  const keys = Array.from({ length: keyCount }, (_, i) => i);
  const rows: ImageModelStatus[] = [];

  for (const { id, label } of IMAGE_MODELS) {
    const live = keys.filter((i) => !imageRetired.has(slot(i, id)));
    if (keyCount > 0 && live.length === 0) continue; // 404 on every key
    const waits = live.map((i) => Math.max((imageCooldowns.get(slot(i, id))?.until ?? 0) - now, 0));
    const soonest = waits.length > 0 ? Math.min(...waits) : 0;
    rows.push({
      id,
      label,
      // With no Gemini key at all these can never serve, and saying so up front
      // beats letting someone pick one and silently getting Pollinations.
      available: keyCount > 0 && soonest === 0,
      retryInSeconds: soonest > 0 ? Math.ceil(soonest / 1000) : 0,
    });
  }

  if (pollinationsEnabled()) {
    if (getPollinationsKey()) {
      const cooling = Math.max(keyedUnavailableUntil - now, 0);
      for (const { id, label } of POLLINATIONS_FREE_MODELS) {
        rows.push({
          id: `${POLLINATIONS_PREFIX}${id}`,
          label: `Pollinations · ${label}`,
          available: cooling === 0,
          retryInSeconds: cooling > 0 ? Math.ceil(cooling / 1000) : 0,
        });
      }
    }
    // Always last and always available: the one that needs nothing at all.
    rows.push({
      id: POLLINATIONS_ANON_ID,
      label: "Pollinations (free, no key)",
      available: true,
      retryInSeconds: 0,
    });
  }

  return rows;
}

/**
 * One Pollinations request. Both endpoints return raw image bytes rather than a
 * JSON envelope, so the only difference is the URL and whether a key rides
 * along.
 *
 * The key goes in `?key=` rather than an `Authorization` header: on `/image`
 * the header form answers 401 while the query parameter authenticates fine
 * (verified 2026-08-14), even though the documentation offers both.
 *
 * A random seed defeats the prompt-keyed cache on both endpoints — without it,
 * asking for the same thing twice returns the identical picture, which reads as
 * the feature being stuck.
 */
async function callPollinations(
  prompt: string,
  keyed: boolean,
  deadline: number,
  signal?: AbortSignal,
  modelOverride?: string
): Promise<{ outcome: ImageOutcome; status?: number }> {
  const seed = Math.floor(Math.random() * 1_000_000);
  const key = keyed ? getPollinationsKey() : undefined;
  const model = modelOverride || POLLINATIONS_MODEL;

  const url = keyed
    ? `${POLLINATIONS_KEYED_ENDPOINT}/${encodeURIComponent(prompt)}` +
      `?model=${encodeURIComponent(model)}&width=1024&height=1024&seed=${seed}` +
      `&key=${encodeURIComponent(key ?? "")}`
    : `${POLLINATIONS_ANON_ENDPOINT}/${encodeURIComponent(prompt)}` +
      `?width=1024&height=1024&nologo=true&seed=${seed}` +
      // The legacy endpoint takes the key as `token` (not `key`, which it
      // ignores). It does not unlock the paid models — a zero balance is still
      // a zero balance — but it does appear to soften the anonymous throttle,
      // and it costs nothing to send when we already have one.
      (getPollinationsKey() ? `&token=${encodeURIComponent(getPollinationsKey()!)}` : "");

  try {
    const timeout = AbortSignal.timeout(Math.max(deadline - Date.now(), 1));
    const res = await fetch(url, {
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });

    if (!res.ok) {
      console.warn(`[ai-image] Pollinations ${keyed ? "keyed" : "anonymous"} returned ${res.status}.`);
      return {
        status: res.status,
        // 429 is a shared rate limit and worth reporting as a wait; everything
        // else (401 no key, 402 no balance, 5xx) is a plain outage from here.
        outcome:
          res.status === 429
            ? { ok: false, reason: "quota" }
            : { ok: false, reason: "unavailable" },
      };
    }

    const mimeType = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
    // Guards against an error page served with a 200, which would otherwise be
    // base64'd into an <img> that renders as a broken icon.
    if (!mimeType.startsWith("image/")) {
      console.warn(`[ai-image] Pollinations returned ${mimeType}, not an image.`);
      return { status: res.status, outcome: { ok: false, reason: "unavailable" } };
    }

    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length === 0) {
      return { status: res.status, outcome: { ok: false, reason: "unavailable" } };
    }

    return {
      status: res.status,
      outcome: {
        ok: true,
        image: {
          dataUrl: `data:${mimeType};base64,${bytes.toString("base64")}`,
          mimeType,
          model: keyed ? model : "pollinations",
          label: keyed ? `Pollinations · ${model}` : "Pollinations",
          prompt,
        },
      },
    };
  } catch (err) {
    console.warn("[ai-image] Pollinations failed:", err);
    return { outcome: { ok: false, reason: "unavailable" } };
  }
}

/**
 * Draws one picture on Pollinations, keyed endpoint first when a key exists.
 *
 * The keyed endpoint bills per image against a prepaid `pollen` balance, so a
 * key with an empty balance answers 402 to everything. That is not a reason to
 * give up — the anonymous endpoint still serves — but it *is* a reason not to
 * ask again for a while, hence the cooldown.
 */
async function generateWithPollinations(
  prompt: string,
  deadline: number,
  signal?: AbortSignal,
  modelOverride?: string
): Promise<ImageOutcome> {
  if (getPollinationsKey() && Date.now() >= keyedUnavailableUntil) {
    const { outcome, status } = await callPollinations(prompt, true, deadline, signal, modelOverride);
    if (outcome.ok) return outcome;
    // 401 (key not accepted) and 402 (no balance) are both settled states that
    // repeat identically on the next request, unlike a 429 or a 5xx.
    if (status === 401 || status === 402) {
      keyedUnavailableUntil = Date.now() + KEYED_COOLDOWN_MS;
      console.warn(
        `[ai-image] Pollinations key returned ${status} ` +
          `(${status === 402 ? "no pollen balance" : "not accepted"}); ` +
          `using the anonymous endpoint for the next ${KEYED_COOLDOWN_MS / 60_000} minutes.`
      );
    }
  }

  if (Date.now() >= deadline) return { ok: false, reason: "unavailable" };
  return (await callPollinations(prompt, false, deadline, signal)).outcome;
}

/**
 * Draws one picture, falling through the model list on quota or retirement.
 *
 * `keys` is the same `GEMINI_API_KEY` rotation the text path uses — quota is
 * metered per model *per project*, so a second key is a second allowance here
 * too.
 */
async function generateWithNanoBanana(
  keys: string[],
  prompt: string,
  deadline: number,
  signal?: AbortSignal,
  preferred?: string
): Promise<ImageOutcome> {
  let retryAfterSeconds: number | undefined;
  let freeTierUnavailable = false;
  let sawQuota = false;

  // A chosen model leads; the rest stay behind it as fallback, so a spent
  // choice still produces a picture instead of failing outright.
  const ordered = preferred
    ? [
        ...IMAGE_MODELS.filter((m) => m.id === preferred),
        ...IMAGE_MODELS.filter((m) => m.id !== preferred),
      ]
    : IMAGE_MODELS;

  for (const { id, label } of ordered) {
    if (Date.now() > deadline) break;

    for (const keyIndex of readyKeysFor(id, keys.length)) {
      if (Date.now() > deadline) break;

      try {
        const timeout = AbortSignal.timeout(Math.max(deadline - Date.now(), 1));
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${id}:generateContent?key=${encodeURIComponent(keys[keyIndex])}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              // Both modalities: these models narrate what they drew alongside
              // the picture, and asking for IMAGE alone is rejected by some of
              // them rather than simply omitting the text.
              generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
            }),
          }
        );

        if (!res.ok) {
          const body = await res.text().catch(() => "");
          if (res.status === 429) {
            sawQuota = true;
            noteRateLimit(keyIndex, id);
            retryAfterSeconds = Math.max(
              retryAfterSeconds ?? 0,
              parseRetryDelay(body, res.headers) ?? 0
            ) || undefined;
            if (isZeroFreeTier(body)) freeTierUnavailable = true;
          } else if (res.status === 404) {
            // Permanent for this project, unlike a quota or busy signal.
            imageRetired.add(slot(keyIndex, id));
            console.warn(`[ai-image] ${id} returned 404 on key #${keyIndex + 1} — dropping the pair.`);
          }
          continue;
        }

        const data = (await res.json()) as {
          candidates?: Array<{ content?: { parts?: ImagePart[] } }>;
        };
        const parts = data.candidates?.[0]?.content?.parts ?? [];
        // The field arrives camelCase over REST, but snake_case shows up in
        // some responses; accepting both costs a line and avoids a blank reply.
        const blob = parts
          .map((p) => p.inlineData ?? p.inline_data)
          .find((d): d is { mimeType?: string; mime_type?: string; data?: string } =>
            Boolean(d && (d as { data?: string }).data)
          );

        if (!blob?.data) {
          // Answered, but drew nothing — usually a prompt the model declined.
          // Another key would repeat it, so move to the next model.
          console.warn(`[ai-image] ${id} returned no image data.`);
          break;
        }

        const mimeType =
          (blob as { mimeType?: string }).mimeType ??
          (blob as { mime_type?: string }).mime_type ??
          "image/png";

        imageCooldowns.delete(slot(keyIndex, id));
        return {
          ok: true,
          image: {
            dataUrl: `data:${mimeType};base64,${blob.data}`,
            mimeType,
            model: id,
            label,
            prompt,
          },
        };
      } catch (err) {
        console.warn(`[ai-image] ${id} failed on key #${keyIndex + 1}:`, err);
      }
    }
  }

  return sawQuota
    ? { ok: false, reason: "quota", retryAfterSeconds, freeTierUnavailable }
    : { ok: false, reason: "unavailable" };
}

/**
 * Draws one picture, best provider first.
 *
 * Nano Banana gets the first attempt whenever a Gemini key exists, because it
 * produces the better picture and is the model the feature was asked for. The
 * keyless fallback then covers every way that can fail — no key, no billing,
 * spent quota, a retired model — which is what keeps a "draw me…" message from
 * ever being answered with an apology while a free option was sitting unused.
 *
 * Only when *both* are unavailable does this report a failure, and the Gemini
 * diagnosis is preserved in that case: a spent quota is still reported as a
 * wait, so the UI can say something more useful than "it didn't work".
 */
export async function generateImage(
  keys: string[],
  prompt: string,
  deadline: number,
  signal?: AbortSignal,
  preferred?: string
): Promise<ImageOutcome> {
  let primary: ImageOutcome | null = null;

  // A Pollinations choice skips Gemini entirely rather than merely reordering
  // it: picking one is a statement about which service should draw, and paying
  // a round-trip to the other first would make the choice look ignored.
  const wantsPollinations = Boolean(preferred?.startsWith(POLLINATIONS_PREFIX));
  const pollinationsModel =
    wantsPollinations && preferred !== POLLINATIONS_ANON_ID
      ? preferred!.slice(POLLINATIONS_PREFIX.length)
      : undefined;

  if (keys.length > 0 && !wantsPollinations) {
    primary = await generateWithNanoBanana(keys, prompt, deadline, signal, preferred);
    if (primary.ok) return primary;
  }

  if (pollinationsEnabled() && Date.now() < deadline) {
    // The keyless entry means "don't use my key", so the keyed attempt is
    // skipped for it — otherwise choosing it would still spend a 402 probe.
    const fallback =
      preferred === POLLINATIONS_ANON_ID
        ? (await callPollinations(prompt, false, deadline, signal)).outcome
        : await generateWithPollinations(prompt, deadline, signal, pollinationsModel);
    if (fallback.ok) return fallback;
  }

  // Nothing drew anything. Prefer the Gemini diagnosis when there is one — it
  // is the specific answer ("quota spent, retry in 43s") next to the fallback's
  // generic one.
  return primary ?? { ok: false, reason: "unavailable" };
}
