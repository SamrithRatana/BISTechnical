/**
 * @file api/ai-search/route.ts
 * @description The "Ask AI" assistant behind the header search box.
 *
 * It answers a plain-language question (English or Khmer) by actually querying
 * the system: the model is given read-only tools over tickets, spare parts,
 * customers, machines and user accounts (see `tools.ts`), calls whichever ones
 * the question needs, and only then writes its answer from the rows that came
 * back. It finishes with `present_results`, which carries both that answer and
 * the filters the header dropdown should list underneath it.
 *
 * This replaces the previous design, where the model only guessed a filter
 * object and never saw a single row — so every count, name and "which spare
 * parts" answer was written blind. Anything numeric it said was a guess.
 *
 * It also drives the interface. `present_results` carries an `actions` list —
 * validated here against `@/config/actions` and dispatched on the client
 * through the action bus — so an instruction like "open the parts page and
 * start a stock-out of 3 toner" arrives as real UI steps rather than as advice
 * about which button to press. Actions can carry field values, which fill a
 * dialog's form in. What none of them can do is submit: every id resolves to a
 * handler that opens or fills and then stops, leaving the save, edit and delete
 * clicks with the user.
 *
 * General questions are in scope too: greetings, "what can you do", and
 * ordinary general-knowledge questions are answered conversationally with
 * `category: "general"`, which tells the UI to show no record list.
 *
 * Provider: Google Gemini (`GEMINI_API_KEY`), with Anthropic Claude as a
 * fallback when `ANTHROPIC_API_KEY` is set instead. Both keys are server-side
 * only — no NEXT_PUBLIC_ prefix, so Next.js will never inline them into the
 * browser bundle. With neither key set the feature is inert: `GET` reports it
 * as disabled so the UI can hide the toggle, and `POST` degrades to a plain
 * keyword search rather than erroring.
 */

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { findNavItem } from "@/config/navigation";
import { findAction, sanitizeActionValues } from "@/config/actions";
import { recordRequest } from "@/services/activityTracker";
import { translations } from "@/i18n/translations";
import { loadUsers, parseJwtUser, type UserRecord } from "./backend";
import {
  IMAGE_BUDGET_MS,
  detectImageRequest,
  generateImage,
  imageModelStatus,
  imageModelsAvailable,
  isKhmerText,
  type GeneratedImage,
  type ImageRequest,
} from "./image";
import {
  CATEGORIES,
  STATUSES,
  anthropicTools,
  geminiFunctionDeclarations,
  runTool,
  toTicketQuery,
  type Category,
  type TicketFilterInput,
  type ToolContext,
} from "./tools";

export const runtime = "nodejs";
/** The loop can take several backend round-trips; the default 10s is too tight. */
export const maxDuration = 60;

/**
 * Gemini models to try, in order. Falling through the list is what keeps this
 * working when a model is busy (503), rate-limited (429), or retired — Google
 * removes older Gemini models on a rolling basis and returns 404 for them, and
 * a single pinned model turns that into a dead feature.
 *
 * On the free tier the request quota is *per model* (currently 20/day each), so
 * the list is also the daily budget: every live entry adds 20 more questions,
 * and a retired entry contributes nothing. The 2.5-* generation was in this
 * list long after Google stopped serving it — three dead entries, a third of
 * the rotation, silently worth zero. Check with a one-line probe before
 * assuming an entry still works:
 *
 *   curl "https://generativelanguage.googleapis.com/v1beta/models/<id>:generateContent?key=$KEY" \
 *     -H 'Content-Type: application/json' -d '{"contents":[{"parts":[{"text":"hi"}]}]}'
 *
 * 404 means retired for this project; 429 means it exists and the day's quota
 * is spent; 503 means it exists and is momentarily busy.
 *
 * Order is strongest first, because whichever model answers *is* the feature's
 * quality. `gemini-3.7-flash` leads: Google builds it for agentic workflows and
 * reliable multi-step execution, which is exactly this route's tool loop.
 * `gemini-flash-latest` follows as an alias that always resolves to a current
 * Flash model, so a retirement can't empty the front of the list. The lite
 * models sit near the end on purpose — a slightly worse answer beats no answer,
 * but only once the full models are spent.
 *
 * That paragraph was true of the *comment* and false of the *array* for a long
 * time: the three lite entries actually sat in slots 1-3 with 3.7-flash seventh,
 * so every question was answered at lite quality by a deprecated model while
 * this note claimed otherwise. Re-measure before trusting either.
 *
 * Measured 2026-08-17, one tool-calling round per model, on the project key
 * (`thinkingLevel: "low"`, see `generationConfig` below):
 *
 *   3.7-flash 1.9s · flash-latest 1.7s · 3-flash-preview 2.0s · 3.5-flash 1.8s
 *   3.5-flash-lite 1.2s · flash-lite-latest 1.3s · 3.1-flash-lite 2.7s
 *   3.6-flash 21-45s
 *
 * `gemini-3.6-flash` is last on that measurement alone. It answers correctly and
 * carries its own free-tier allowance, so it is worth keeping as the final
 * fallback, but one round of it can consume most of `AGENT_BUDGET_MS` — it can
 * realistically only finish a question that needs a single tool call.
 *
 * Deliberately NOT in this list, each verified against the live API rather than
 * assumed — re-check before re-adding:
 * - `gemini-3.1-pro-preview` / `gemini-pro-latest` — **no free tier at all**
 *   (ai.google.dev/pricing: "Free Tier: Not available"). Both answer 429 in
 *   ~0.5s on an unbilled key, every time. They were the two strongest-looking
 *   entries and could never once have produced an answer.
 * - `gemini-3.1-flash-lite-preview` — listed as shut down on the models page.
 *   It still answers today, which is exactly how a dead entry survives a review.
 * - `gemini-2.5-flash` / `gemini-2.5-flash-lite` — 404, "no longer available to
 *   new users".
 *
 * `gemini-3.1-flash-lite` is deprecated (shutdown 2027-05-07, superseded by
 * `gemini-3.5-flash-lite`) and is kept only for the extra daily allowance,
 * below the model that replaces it.
 */
const GEMINI_MODELS = [
  "gemini-3.7-flash",
  "gemini-flash-latest",
  "gemini-3-flash-preview",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-3.1-flash-lite",
  "gemini-3.6-flash",
];

/** Claude Opus 5, used when Anthropic is the configured provider. */
const ANTHROPIC_MODEL = "claude-opus-5";

// ---------------------------------------------------------------------------
// Rate-limit memory
// ---------------------------------------------------------------------------

/**
 * Quota and availability are tracked per *(key, model)* pair, not per model.
 *
 * Google meters the free tier per model **per project**, so the same model can
 * be spent on one key and untouched on another — that is the entire reason
 * multiple keys help. Keying this state by model alone would sideline a model
 * globally the moment any one key exhausted it, throwing away exactly the
 * headroom the extra keys were added for.
 *
 * `keyIndex` is used rather than the key itself so no credential ever reaches a
 * map key, a log line, or an error message.
 */
function slot(keyIndex: number, model: string): string {
  return `${keyIndex}:${model}`;
}

/**
 * Which (key, model) pairs are rate-limited, and until when.
 *
 * On the free tier each model has its own small daily allowance (20/day for
 * most of the list). Once the leading models are spent, every question paid a
 * full HTTP round-trip per dead model just to rediscover the same 429 — five
 * wasted trips before any real work, which is what turned ordinary questions
 * into 30-second ones. Remembering the exhaustion skips straight to a pair that
 * can actually answer.
 *
 * Module scope, so it is per server process and resets on restart. That is the
 * right lifetime: it is a latency optimisation, not a source of truth, and
 * being wrong only costs one probe.
 */
const modelCooldowns = new Map<string, { until: number; strikes: number }>();

/**
 * Pairs that cannot be reached at all, learned from a 404.
 *
 * A rate limit is temporary and a 404 is not: Google returns it when a model
 * has been retired *for that project*, and no amount of waiting brings it back.
 * Treating the two alike is what let three dead 2.5-* entries sit in the
 * rotation indefinitely — each one burning a round-trip on every question that
 * reached it, and each one still offered as a green, selectable option in the
 * model picker. Recording them here drops them from both.
 *
 * Scoped per key because retirement is per project: the 2.5 generation 404s for
 * a newly created project but still serves an older one, so a 404 on key A says
 * nothing about key B.
 */
const retiredSlots = new Set<string>();

/**
 * Which configured ids resolve to which real quota bucket, learned at runtime
 * from 429 bodies (`gemini-flash-latest` -> `gemini-3.7-flash`).
 *
 * Aliases are the point: `flash-latest` exists so a retirement can't empty the
 * front of the list, but it draws on its target's allowance rather than adding
 * a fresh one. Recording the mapping lets a single 429 sideline every name for
 * that bucket at once. Not hard-coded — Google can repoint an alias whenever it
 * likes, and a stale table would be worse than none.
 */
const aliasTargets = new Map<string, string>();

/** Shortest and longest we will sideline a (key, model) pair for. */
const COOLDOWN_MIN_MS = 30_000;
const COOLDOWN_MAX_MS = 30 * 60_000;

/** Keys still worth trying for one model, best-known first. */
function readyKeysFor(model: string, keyCount: number): number[] {
  const now = Date.now();
  const live = Array.from({ length: keyCount }, (_, i) => i).filter(
    (i) => !retiredSlots.has(slot(i, model))
  );
  const ready = live.filter((i) => (modelCooldowns.get(slot(i, model))?.until ?? 0) <= now);
  // Cooldowns are estimates and may be stale, so a model with every key cooling
  // is still worth one attempt rather than being skipped outright.
  return ready.length > 0 ? ready : live;
}

/** Models with at least one key that isn't known-retired for them. */
function readyModels(keyCount: number): string[] {
  const live = GEMINI_MODELS.filter((m) => readyKeysFor(m, keyCount).length > 0);
  // Every entry 404ing on every key is not a real state — more likely the keys
  // or the whole API are misconfigured — so fall back to the full list rather
  // than giving up permanently on a wrong conclusion.
  return live.length > 0 ? live : GEMINI_MODELS;
}

/**
 * Drops a model from the rotation for the life of this process. Also clears any
 * cooldown, so a model that 429'd before it 404'd doesn't linger in the picker
 * showing a countdown that will never resolve.
 */
function noteRetired(keyIndex: number, model: string) {
  retiredSlots.add(slot(keyIndex, model));
  modelCooldowns.delete(slot(keyIndex, model));
  console.warn(
    `[ai-search] ${model} returned 404 on key #${keyIndex + 1} — not available to that project. ` +
      `Dropping the pair; if every key 404s, remove it from GEMINI_MODELS to reclaim the attempt.`
  );
}

/**
 * Sidelines a model after a 429, backing off further each consecutive time.
 *
 * Google reports a `retryDelay` of well under a minute even when the exhausted
 * quota is a *daily* one, so the delay alone would have us re-probe a spent
 * model every 30 seconds forever. Doubling per strike finds the right interval
 * without needing to tell the two kinds of limit apart.
 */
function noteRateLimit(keyIndex: number, model: string, quotaBucket?: string) {
  // An alias and its target share one allowance, so both are sidelined together
  // — otherwise the rotation immediately retries the same exhausted bucket
  // under its other name and eats a guaranteed second 429.
  const affected = new Set<string>([model]);
  if (quotaBucket) {
    affected.add(quotaBucket);
    // Any other configured id that resolves to the same bucket. Learned from
    // the 429 body rather than hard-coded, because which alias points where is
    // Google's business and changes without notice.
    for (const candidate of GEMINI_MODELS) {
      if (aliasTargets.get(candidate) === quotaBucket) affected.add(candidate);
    }
    if (model !== quotaBucket) aliasTargets.set(model, quotaBucket);
  }

  for (const name of affected) {
    if (!GEMINI_MODELS.includes(name)) continue;
    const id = slot(keyIndex, name);
    const strikes = (modelCooldowns.get(id)?.strikes ?? 0) + 1;
    const backoff = COOLDOWN_MIN_MS * 2 ** (strikes - 1);
    modelCooldowns.set(id, {
      until: Date.now() + Math.min(backoff, COOLDOWN_MAX_MS),
      strikes,
    });
  }
}

/** A pair that answered is healthy again, whatever it did before. */
function clearRateLimit(keyIndex: number, model: string) {
  modelCooldowns.delete(slot(keyIndex, model));
}

export interface ModelStatus {
  id: string;
  /** Short name for the picker — the full ids are unreadable in a dropdown. */
  label: string;
  available: boolean;
  /** Seconds until it is worth trying again; 0 when it is available now. */
  retryInSeconds: number;
}

/** Drops the shared `gemini-` prefix, which carries no information in a list. */
function modelLabel(id: string): string {
  return id.replace(/^gemini-/, "");
}

/**
 * What the picker shows: every model still reachable, and whether its quota is
 * spent. Retired models are omitted rather than greyed out — a user can't do
 * anything about a 404, so offering it only invites a selection that will be
 * silently overridden.
 */
function geminiModelStatus(keyCount: number): ModelStatus[] {
  const now = Date.now();
  const keys = Array.from({ length: keyCount }, (_, i) => i);

  return GEMINI_MODELS
    // Hidden only when *every* key has 404'd for it — one project's retirement
    // says nothing about another's.
    .filter((id) => keys.some((i) => !retiredSlots.has(slot(i, id))))
    .map((id) => {
      const live = keys.filter((i) => !retiredSlots.has(slot(i, id)));
      // A model is available while any key can still serve it, and the
      // countdown shown is the soonest one — that is when it comes back, not
      // the average or the worst.
      const waits = live.map((i) => Math.max((modelCooldowns.get(slot(i, id))?.until ?? 0) - now, 0));
      const soonest = waits.length > 0 ? Math.min(...waits) : 0;
      return {
        id,
        label: modelLabel(id),
        available: soonest === 0,
        retryInSeconds: soonest > 0 ? Math.ceil(soonest / 1000) : 0,
      };
    });
}

/**
 * The order to try models in for this question.
 *
 * An explicitly chosen model goes first even when we believe it is cooling
 * down: the belief is an estimate, the user may know the daily quota has just
 * reset, and being wrong costs one request. The rest follow as a fallback so a
 * spent choice still gets answered rather than failing outright.
 */
function orderedModels(keyCount: number, preferred?: string): string[] {
  const ready = readyModels(keyCount);
  // A choice retired on every key is skipped rather than tried first: it is
  // guaranteed to 404, and leading with it only delays the answer.
  const usable =
    preferred &&
    GEMINI_MODELS.includes(preferred) &&
    readyKeysFor(preferred, keyCount).length > 0;
  if (!usable) return ready;
  return [preferred!, ...ready.filter((m) => m !== preferred)];
}

/** Tool rounds before we stop and answer with whatever we have. */
const MAX_ROUNDS = 6;

/**
 * Interface steps accepted from one reply.
 *
 * Real instructions are a handful of steps at most; a longer list means the
 * model has misread the request, and letting it through would flood the action
 * bus with requests that outlive the page they were meant for.
 */
const MAX_ACTIONS = 6;

/**
 * Wall-clock budget for the whole question, across every model attempt.
 *
 * Without this, a bad day on the provider compounds: seven models each retried
 * in turn, some slow rather than failing fast, and the header search box hangs
 * for minutes. Past the budget the question falls back to a plain keyword
 * search, which is instant and still useful.
 *
 * Sized around the slowest model in the list rather than the average: a
 * measured `gemini-3.1-pro-preview` answer took ~44s, so a 40s budget aborted
 * it every time and the question degraded to a keyword search — the Pro entry
 * was decorative. 50s clears that with margin while staying safely under
 * `maxDuration` (60s), which is the hard platform ceiling this must not reach.
 *
 * This does not slow down healthy requests: a Flash answer lands in ~5-15s and
 * returns as soon as it is done. The budget only bounds how long a *struggling*
 * question keeps trying before giving up, so raising it trades a longer
 * worst-case wait for Pro being usable at all.
 */
const AGENT_BUDGET_MS = 50_000;

/** Bounded so a pasted document can't turn one search box into a large bill. */
const MAX_QUERY_CHARS = 500;

/**
 * Earlier turns accepted from the client, and how much of each.
 *
 * History is re-sent and re-billed on every question, so it is capped at both
 * ends: enough turns to resolve a follow-up, and short enough per turn that a
 * long menu listing earlier in the chat can't dominate the request.
 */
const MAX_HISTORY_TURNS = 6;
const MAX_HISTORY_CHARS = 600;

const SYSTEM_PROMPT = `You are the built-in AI assistant for the CAMPROTEC Service Maintenance Application — a repair-workshop system that tracks machines from intake through inspection, spare-part requests, customer approval, repair and final verification.

You have read-only tools over the live system: repair tickets, the spare-parts catalogue, customers, the machine registry, user accounts and the dashboard counters. Use them. Never state a count, a name, a date, a stock level or a spare-part list from memory or inference — look it up first and answer from what came back. If a lookup returns nothing, say so plainly instead of filling the gap.

You also know the application itself — its menus, every page and what it is for, the actions a user can take, the full ticket workflow, the features, the business rules and the vocabulary — through describe_application. That tool is the only source for any of it. The menu is specific to this installation, so answering from memory invents screens that do not exist.

You also operate the interface. You can open any page, open the dialogs behind its buttons, collapse or expand the menu, switch the theme, switch the language, change the tab on a queue page, type into a search box, and fill a form in from what the user dictates. describe_application lists every one of these with the fields it accepts.

There is exactly one thing you cannot do: complete a change. Every action opens the same dialog the on-screen button opens and stops there — filled in, waiting. The save, edit, delete and confirm clicks belong to the user, always, including when they ask you to do it for them. Nothing you do writes to the system.

HOW TO WORK
1. Decide what the question actually asks for, then call the tools that answer it. Several calls are fine, and comparing a few counts before reading rows is usually cheaper than reading everything.
2. For "how many" questions use count_tickets — it returns the exact total across the whole system, not just the rows you can see.
3. When a question names a person, call find_users first if you are unsure of the spelling, then pass the name as staffName (never as searchTerm).
4. Finish by calling present_results exactly once, with your answer and the filters that produced it.

QUESTIONS ABOUT THE APPLICATION ITSELF
Anything about how the system is built rather than what is stored in it — "what menus do I have", "what pages are there", "what does this screen do", "where do I stock out a part", "how do I record an inspection", "what does Awaiting Sparepart mean", "what can this system do", "how does the repair process work" — is answered by calling describe_application first and reading the result. These are NOT general-knowledge questions and must never be answered from memory: this installation has its own menu, and guessing produces screens that do not exist. Give the real menu names as they appear in the sidebar, and say plainly when something the user asks about does not exist.

CHOOSING THE CATEGORY
category is the list shown under your answer. If you answered from a data lookup, name the records you read: "tickets", "spareParts", "customers", "items" or "users". Use "general" when you ran no data lookup — including every answer drawn from describe_application, where a record list would be noise.

OPENING A PAGE FOR THE USER
navigateTo opens a page immediately — the user is taken there the moment you answer, so treat it as an action you are performing, not a suggestion.

Set it when the question is a request to go somewhere or to do something that happens on a page: "open the spare parts page", "take me to the rejected jobs", "where do I stock out a part" asked as a request to do it, "show me ticket SVC-1024". If they named a specific record, also set searchTerm so the page opens with that record already filtered.

A Khmer request to open a page is the same request and must navigate exactly the same way. "បើក" (open), "ទៅ" (go to), "បង្ហាញ" (show me) or "យកខ្ញុំទៅ" (take me to) followed by a page or menu name is an instruction to open that page — set navigateTo to it. "បើក page គ្រឿងបន្លាស់" and "បើកទំព័រគ្រឿងបន្លាស់" both mean open /spareparts; they are NOT questions about the menu. Match the Khmer name against the labelKhmer of each menu item in describe_application. Do not answer these by listing the menu — that is the single most common way to get this wrong.

To open a specific TICKET, look up its current status first, then navigate to the page that owns that status — the "page" field on that stage in describe_application. A ticket only ever appears on that one queue, so sending the user anywhere else (the dashboard included) opens a page their ticket is not on. A Finished ticket opens /approve-verify, an Awaiting Sparepart ticket opens /spare-request, and so on. Pass its report number as searchTerm.

Leave it out when they asked a question and expect the answer where they are — "how many machines came in today", "what does Awaiting Sparepart mean", "what menus do I have", "who repaired SVC-1024". Yanking someone away from an answer they wanted to read is worse than not navigating at all. When in doubt, answer without navigating.

Because the page opens straight away, keep the answer for a navigation request to one short sentence saying what you opened. Never offer a page marked unavailable.

PERFORMING ACTIONS
When the request is to DO something rather than to know something — "print the report for 20251119-2198", "stock out 3 toner cartridges", "add a spare part called X priced at 45", "collapse the menu", "switch to Khmer", "show me the Awaiting Sparepart tab", "search this page for Canon" — call describe_application, pick the actions whose canTrigger is true, and list them in the actions argument. They run in the order you give them.

One instruction can be several steps, and they belong in one actions array. "Open the parts page and start a stock-out of 3 toner" is one reply with the stock-out action, navigateTo set to the parts page, and searchTerm set to the part.

For any action that targets a record, you must name the record: set its recordRef, and set navigateTo to the page that owns it and searchTerm to the same record. An action that needs a record and has none is discarded, because the page has nothing to match it against. If you cannot work out which record they mean — the search returned nothing, or several things equally — do not guess. Navigate them to the page and say plainly that you could not identify it and which one you need.

The shell actions (menu, theme, language, tab, page search, global search) target no record and work wherever the user already is, so do not navigate for them.

DESCRIBE ONLY WHAT YOU ACTUALLY DID
Your answer must match the actions you passed, exactly. Do not write that you set a quantity, filled a field, chose a part or opened a form unless the corresponding action carries that value. If you could not identify the record, say so instead of describing a dialog that never opened. A confident sentence about work that did not happen is worse than admitting you need one more detail — the user trusts the answer and moves on.

FILLING FORMS IN
An action with a fields list opens a form, and you can pass values for those fields to have them typed in. Use it whenever the user dictates content: "add a customer, ABC Trading, contact Sokha, 012345678", "record the inspection for SVC-1024 — the fuser is worn, replace it, chargeable", "edit that part's price to 45".

Four rules:
- If an action has fields and the user gave you anything to put in them, you must pass values. An action carrying no values does nothing with them — ui.search with no query searches for nothing, ui.tab with no tab switches nowhere, customer.create with no values opens an empty form. This is the most common way to get this wrong.
- Fill in only what they actually said. Never invent a phone number, a price, a serial or a date to complete a form. Fields they didn't mention stay as they are for the user to fill.
- Use the exact field names from that action's fields list. Anything else is dropped.
- Filling is not saving. Say what you filled in and what is left: "I've filled in the new customer form with ABC Trading, Sokha and that phone number — check it and press Save." Never say you added, saved, updated, changed or deleted anything, because you did not.

If an action's canTrigger is false, do not list it. Say where it is instead and navigate them to the page.

GENERAL QUESTIONS
You are a general assistant as well as this system's assistant. Greetings, questions about yourself, and ordinary questions with nothing to do with this workshop — history, language, maths, how something works, a translation, advice, a piece of writing — get a real, complete, helpful answer, the way any capable assistant would answer them. Do not deflect them back to the application, and do not apologise for the question being off-topic. Answer via present_results with category "general" and no filters; no lookup is needed for these.

Length follows the question: a greeting gets a line, an explanation gets as many sentences as it honestly takes. The "one to three sentences" guidance applies to answers about the system's own data, not to these.

"What can you do" is about this application: answer it from describe_application.

LANGUAGE
Match the question, and decide from the question alone. Look at the script the user typed in: Latin letters mean answer in English, Khmer script means answer in Khmer, politely and naturally.

Nothing else influences this. Not the language of the rows you read, not the Khmer labels attached to statuses, menus and actions in describe_application, not the Khmer name of an action you just performed. Those labels exist so you can answer *a Khmer question* well; seeing them is not a reason to switch. Answering an English question in Khmer is a bug, and it is the mistake most often made here.

WRITING THE ANSWER
The answer is prose the user reads, and nothing else. Never write JSON, tool names, tool-call syntax, or field names like "category" and "navigateTo" into it — those travel in the present_results arguments, not in the text. Refer to a page by the menu name a user would see ("SparePart Items Inventory"), never by its route ("/spareparts"); to send them there, pass navigateTo.

WORKFLOW STATUSES (use these exact spellings, including "Item Recieved")
- "Item Recieved" — machine intake. ម៉ាស៊ីនចូល, ទទួលម៉ាស៊ីន, បានទទួល
- "Inspecting" — being diagnosed now. កំពុងវិនិច្ឆ័យ, កំពុងពិនិត្យ
- "Inspection" — diagnosis complete. វិនិច្ឆ័យរួច, ឆែករួច
- "Awaiting Sparepart" — waiting on parts. រង់ចាំគ្រឿងបន្លាស់, ខ្វះគ្រឿង
- "Awaiting Customer Confirm" — waiting on the customer. រង់ចាំអតិថិជន, ចាំភ្ញៀវ
- "Sale Confirmed" — sales approved the repair. ផ្នែកលក់យល់ព្រម, យល់ព្រមជួសជុល
- "Sent Spareparts" — parts issued to the technician. ផ្ញើគ្រឿងបន្លាស់, បញ្ជូនគ្រឿង
- "Repairing" — repair under way. កំពុងជួសជុល
- "Repair by Third-Party" — outsourced. ជាងខាងក្រៅ
- "Finished" — repaired and verified. ជួសជុលរួច, រួចរាល់, ម៉ាស៊ីនចេញ
- "Customer Rejected" — customer declined. ភ្ញៀវបដិសេធ
- "Unrepairable" — cannot be repaired. មិនជួសជុលបាន, ធ្វើមិនកើត

DATES
Resolve relative wording ("today", "ថ្ងៃនេះ", "this month", "ខែនេះ", "last week") against the current date given below, and pass real YYYY-MM-DD bounds. A question about when work *happened* ("finished today", "who confirmed sales this week") needs dateFilterMode "statusChanged" together with that status; a question about what *came in* uses the default "received".

If a question names a time ("today", "ថ្ងៃនេះ", "this month") it always needs both a date window and the status that stage corresponds to. Never answer it with an unfiltered count — "how many machines came in today" / "តើថ្ងៃនេះមានម៉ាស៊ីនចូលប៉ុន្មាន" is status "Item Recieved" with fromDate and toDate both set to today, not a count of everything currently open.

SPARE PARTS & STOCK INVENTORY (គ្រឿងបន្លាស់ និងស្តុក)
- Questions about spare parts catalogue, in-stock quantity, part price, or part numbers ("គ្រឿងបន្លាស់", "ស្តុកគ្រឿងបន្លាស់", "ចំនួនគ្រឿងបន្លាស់ក្នុងស្តុក", "តម្លៃគ្រឿងបន្លាស់") -> call search_spare_parts.
- Questions about spare parts deducted from stock, issued to technicians, or used for repairs ("ចំនួនគ្រឿងបន្លាស់ដែលបានកាត់ចេញពីស្តុក", "កាត់ស្តុក", "ដកចេញពីស្តុក", "គ្រឿងបន្លាស់ដែលបានប្រើ") ->
  1. Call search_tickets with status "Sent Spareparts", "Repairing", or "Finished" to read the sparePartsUsed list on tickets.
  2. If the user asks generally about spare parts usage report, you can summarize what was used, or set navigateTo to "/sparepart-usage" (Spare Part Usage Report) or "/spareparts".
  3. If no parts were deducted for that period or query, answer clearly and politely in Khmer (or English if asked in English) stating that no spare parts were deducted/used for the specified period.`;

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

/**
 * Every Gemini key configured, in preference order.
 *
 * Free-tier quota is metered per model **per project**, and projects cannot be
 * pooled — so the only way to raise the ceiling is to hold several keys and move
 * to the next when one is spent. `GEMINI_API_KEY` accepts a comma-separated
 * list for exactly that; a single key is just a list of one, so existing setups
 * keep working untouched.
 *
 * Keys live only in the environment. They are never logged, never returned by
 * `GET`, and are referred to everywhere else by index, so a leaked stack trace
 * or a shared screenshot cannot expose one.
 *
 *   GEMINI_API_KEY=key_one,key_two,key_three
 */
function getGeminiKeys(): string[] {
  const raw = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
  const seen = new Set<string>();
  return raw
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k && !seen.has(k) && seen.add(k));
}

function getAnthropicKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY?.trim() || undefined;
}

/**
 * Lets the client hide the AI toggle when no key is configured, and populate
 * the model picker with what is currently answering versus rate-limited.
 */
export async function GET() {
  const geminiKeys = getGeminiKeys();
  return NextResponse.json({
    enabled: Boolean(geminiKeys.length > 0 || getAnthropicKey()),
    models: geminiKeys.length > 0 ? geminiModelStatus(geminiKeys.length) : [],
    /**
     * How many keys are in rotation — the count only, never the keys. Lets the
     * UI show the real headroom (models x keys) instead of implying one bucket.
     */
    keyCount: geminiKeys.length,
    /** True when a paid fallback exists, so an exhausted free tier isn't fatal. */
    hasFallbackProvider: Boolean(getAnthropicKey()),
    /**
     * Whether "draw me…" can be answered at all. Image models are Gemini-only
     * here, so an Anthropic-only setup reports false rather than accepting a
     * request it would have to refuse.
     */
    imageEnabled: imageModelsAvailable(geminiKeys.length),
    /**
     * The picture models, listed separately from `models` rather than merged
     * into it. They are not interchangeable: an image model cannot call the
     * lookup tools, so one selected for a ticket question would answer nothing.
     * Two lists let the panel keep the two choices apart.
     */
    imageModels: imageModelStatus(geminiKeys.length),
  });
}

// ---------------------------------------------------------------------------
// The answer the client gets back
// ---------------------------------------------------------------------------

export interface AiSearchExtras {
  fromDate?: string;
  toDate?: string;
  serviceType?: string;
  serviceLocation?: string;
  userIds?: string[];
  userFilterStatuses?: string[];
  useProcessDateFiltering?: boolean;
  statusesForProcessFiltering?: string[];
}

export interface AiSearchFilters {
  /** The assistant's reply, already grounded in the rows it read. */
  answer: string;
  category: Category;
  /** Free text for the row query. */
  searchTerm: string;
  /** Status the question was understood to be about — shown as a badge. */
  status: string | null;
  /** Status to pass to `fetchRepairServices` ("All" when the filter is applied via extras). */
  listStatus: string;
  fromDate: string | null;
  toDate: string | null;
  serviceType: string | null;
  serviceLocation: string | null;
  /** Resolved staff member, when the question was about a person's work. */
  staffName: string | null;
  extras: AiSearchExtras;
  /** The page the assistant opens for the user. */
  navigateTo: { route: string; label: string; labelKhmer: string } | null;
  /**
   * The interface steps the assistant performs, in order — opening dialogs,
   * filling forms, toggling the shell. None of them completes a change.
   */
  actions: Array<{
    id: string;
    label: string;
    labelKhmer: string;
    recordRef: string | null;
    values: Record<string, string> | null;
  }>;
  /** False when no model ran and this is a plain keyword search. */
  grounded: boolean;
}

/**
 * Validates an assistant-proposed destination against the real menu. The model
 * picks the route from `describe_application`, but a hallucinated or retired
 * path would send the user to the 404 page — so the button is only offered for
 * a route that exists and has a page behind it.
 */
/**
 * Validates the assistant's proposed steps against the registry, dropping any
 * the UI can't actually perform. A model naming an action that exists in the
 * list but isn't wired up would otherwise produce a silent no-op the user reads
 * as "it didn't work".
 *
 * Field values get the same treatment: `sanitizeActionValues` keeps only the
 * names the action really declares, so an invented field can't reach a form's
 * state. Nothing here can save anything — every id resolves to a handler that
 * opens or fills, never submits — but the registry is still the only thing
 * standing between a model's output and the UI, so it validates rather than
 * trusts.
 */
function resolveActions(value: unknown, fallbackRef: string): AiSearchFilters["actions"] {
  const raw = Array.isArray(value) ? value : [];
  const out: AiSearchFilters["actions"] = [];

  for (const entry of raw.slice(0, MAX_ACTIONS)) {
    if (!entry || typeof entry !== "object") continue;
    const step = entry as { id?: unknown; recordRef?: unknown; values?: unknown };
    if (typeof step.id !== "string") continue;

    const action = findAction(step.id);
    if (!action || !action.wired) continue;

    // Values arrive as flat "field=value" strings. A free-form object isn't
    // expressible in the JSON Schema subset both providers accept, and the
    // obvious alternative — a list of {field, value} objects — nests an array
    // of objects inside an array of objects, which Gemini drops often enough
    // that forms opened blank while the answer claimed they were filled in.
    // One level of nesting is reliable; two is not.
    const record: Record<string, unknown> = {};
    for (const entry of Array.isArray(step.values) ? step.values : []) {
      if (typeof entry !== "string") continue;
      const split = entry.indexOf("=");
      if (split <= 0) continue;
      // Split on the first `=` only, so a value containing one survives.
      record[entry.slice(0, split).trim()] = entry.slice(split + 1);
    }

    // Falls back to the question's searchTerm, which is the record the page was
    // opened on — the model routinely sets one and forgets the other.
    const ref = typeof step.recordRef === "string" && step.recordRef.trim()
      ? step.recordRef.trim()
      : fallbackRef.trim();

    // An action that targets a record but names none can never be handled: the
    // page has nothing to match, so the request would sit in the bus until it
    // expired — a silent no-op, or worse, a dialog opening on whatever page the
    // user wandered to next. Dropping it leaves the navigation, which at least
    // puts them on the right page.
    if (action.needsRecord && !ref) continue;

    out.push({
      id: action.id,
      label: action.label,
      labelKhmer: action.labelKhmer,
      recordRef: action.needsRecord ? ref || null : null,
      values: sanitizeActionValues(action, record) ?? null,
    });
  }

  return out;
}

function resolveNavigation(value: unknown): AiSearchFilters["navigateTo"] {
  if (typeof value !== "string") return null;
  const item = findNavItem(value);
  if (!item || item.available === false) return null;
  return {
    route: item.href,
    label: translations.en[item.nameKey],
    labelKhmer: translations.km[item.nameKey],
  };
}

function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}

/**
 * Strips a trailing echo of the `present_results` arguments out of the answer.
 *
 * Models occasionally write the tool call into the prose as well as calling it,
 * leaving a raw `{ "answer": ..., "category": ... }` blob under an otherwise
 * good reply. It is meaningless to the reader, so it is cut here rather than
 * being left to the panel to render — the answer is prose by contract, and a
 * prompt rule alone doesn't hold every time.
 */
/**
 * Pulls the real sentence out of an `answer` field that contains a serialised
 * present_results payload instead of prose.
 *
 * Returns null when the text is ordinary prose, so the caller falls through to
 * its normal handling. Deliberately conservative: it unwraps only when the text
 * really parses as an object carrying a string `answer`, so a reply that merely
 * *discusses* JSON is left untouched.
 */
function unwrapAnswerPayload(text: string): string | null {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  if (!trimmed.startsWith("{")) return null;

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const inner = (parsed as { answer?: unknown }).answer;
      // Cleaned again in case the payload was wrapped more than once. This
      // recurses with `cleanAnswer`, and terminates because each unwrap yields
      // a strictly shorter string — `inner` is a field inside what we parsed.
      if (typeof inner === "string" && inner.trim()) return cleanAnswer(inner);
    }
  } catch {
    // Not valid JSON — it's prose that happens to start with a brace.
  }
  return null;
}

function cleanAnswer(text: string): string {
  // The whole field being the arguments object, rather than prose with a blob
  // appended after it. Some models fill `answer` with a serialised copy of the
  // entire present_results payload, so the reply renders as raw JSON:
  //   { "answer": "There are 663 spare parts…", "category": "spareParts" }
  // Unwrapping one level recovers the real sentence. The trailing-blob strip
  // below can't catch this — it anchors on a newline before the `{`, and here
  // the `{` is the first character.
  const unwrapped = unwrapAnswerPayload(text);
  if (unwrapped !== null) return unwrapped;

  // A JSON echo of the arguments appended after real prose, fenced or bare.
  const blob = text.search(/\n\s*(?:```(?:json)?\s*)?\{\s*"answer"\s*:/);
  let out = blob === -1 ? text : text.slice(0, blob);

  // Or just the stray scalar fields, one per trailing line
  // (`category: general`, `"navigateTo": "/spareparts"`).
  out = out.replace(
    /(?:\n\s*"?(?:category|navigateTo|searchTerm|status)"?\s*:\s*"?[\w/-]*"?,?\s*)+$/,
    ""
  );

  return out.replace(/```\s*$/, "").trim();
}

/**
 * Converts the model's `present_results` arguments into the filter set the
 * table re-runs. Staff names are resolved to GUIDs here — the same translation
 * the tools use — so the rows under the answer are the rows the answer is about.
 */
function buildFilters(args: Record<string, unknown>, users: UserRecord[]): AiSearchFilters {
  const input = args as TicketFilterInput & { answer?: unknown; category?: unknown };
  const { query, matched } = toTicketQuery(input, users);
  const status = typeof input.status === "string" && (STATUSES as readonly string[]).includes(input.status)
    ? input.status
    : null;

  return {
    answer: typeof args.answer === "string" ? cleanAnswer(args.answer) : "",
    category: isCategory(args.category) ? args.category : "tickets",
    searchTerm: query.searchTerm ?? "",
    status,
    listStatus: query.status ?? "All",
    fromDate: query.fromDate ?? null,
    toDate: query.toDate ?? null,
    serviceType: query.serviceType ?? null,
    serviceLocation: query.serviceLocation ?? null,
    staffName: matched.length > 0 ? matched.map((u) => u.fullName).join(", ") : null,
    extras: {
      fromDate: query.fromDate,
      toDate: query.toDate,
      serviceType: query.serviceType,
      serviceLocation: query.serviceLocation,
      userIds: query.userIds,
      userFilterStatuses: query.userFilterStatuses,
      useProcessDateFiltering: query.useProcessDateFiltering || undefined,
      statusesForProcessFiltering: query.statusesForProcessFiltering,
    },
    navigateTo: resolveNavigation(args.navigateTo),
    actions: resolveActions(args.actions, query.searchTerm ?? ""),
    grounded: true,
  };
}

/** A conversational reply with no record list behind it. */
function generalAnswer(answer: string): AiSearchFilters {
  return {
    answer,
    category: "general",
    searchTerm: "",
    status: null,
    listStatus: "All",
    fromDate: null,
    toDate: null,
    serviceType: null,
    serviceLocation: null,
    staffName: null,
    extras: {},
    navigateTo: null,
    actions: [],
    grounded: true,
  };
}

/**
 * Last resort when no provider is configured or every provider failed: run the
 * question as an ordinary keyword search. No invented answer text — the UI
 * shows its normal "searching" state and the real rows, which beats a
 * confident sentence nobody checked.
 */
function plainSearch(query: string): AiSearchFilters {
  return {
    answer: "",
    category: "tickets",
    searchTerm: query,
    status: null,
    listStatus: "All",
    fromDate: null,
    toDate: null,
    serviceType: null,
    serviceLocation: null,
    staffName: null,
    extras: {},
    navigateTo: null,
    actions: [],
    grounded: false,
  };
}

// ---------------------------------------------------------------------------
// Why the assistant couldn't answer
// ---------------------------------------------------------------------------

/**
 * Why a question fell back to a plain keyword search. Without this the UI shows
 * a bare "no results for <the whole question>", which reads as *the system has
 * no such data* when the truth is that the assistant never ran — the most
 * confusing failure this feature had.
 */
export interface AiSearchDegraded {
  reason:
    | "quotaExceeded"
    | "unavailable"
    | "notConfigured"
    /**
     * The request carried no usable bearer token. Kept separate from
     * `unavailable` because it is the one reason on this list the user can
     * act on themselves.
     */
    | "notSignedIn"
    /** Image models were reachable but their allowance is spent for now. */
    | "imageQuotaExceeded"
    /**
     * Distinct from the above because the fix is different, not the wait: the
     * key's project reported a free-tier image limit of *zero*, so retrying
     * never succeeds and only enabling billing does. Telling someone to wait
     * here would loop them forever.
     */
    | "imageNotOnFreeTier"
    | "imageUnavailable";
  /** Seconds until the provider says it will accept requests again. */
  retryAfterSeconds?: number;
}

/** Carries the provider's HTTP status and retry hint up to the fallback logic. */
class ProviderError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfterSeconds?: number,
    /** The model the exhausted quota belongs to, which may be an alias target. */
    readonly quotaBucket?: string
  ) {
    super(message);
  }
}

/**
 * Google reports the wait as an RFC 3339-ish duration in a `RetryInfo` detail
 * (`"37s"`), and sometimes as a `Retry-After` header. Neither is guaranteed, so
 * the caller must treat a missing value as "unknown wait", not "retry now".
 */
function parseRetryDelay(body: string, headers: Headers): number | undefined {
  const header = headers.get("retry-after");
  if (header && /^\d+$/.test(header.trim())) return Number(header.trim());

  const match = body.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  if (match) return Math.ceil(Number(match[1]));

  return undefined;
}

/**
 * The model whose quota a 429 actually belongs to.
 *
 * Aliases and pinned ids can share one bucket: calling `gemini-flash-latest`
 * returns a quota message naming `model: gemini-3.7-flash`, because the alias
 * resolves to it. Without reading that, the two look like separate allowances —
 * so the rotation sidelines `3.7-flash`, immediately tries `flash-latest`, and
 * eats a second guaranteed 429 for the same exhausted bucket. On a list this
 * long that is several wasted round-trips per question.
 *
 * Google reports it inside the quota-violation text:
 *   "* Quota exceeded for metric: ...generate_content_free_tier_requests,
 *      limit: 20, model: gemini-3.7-flash"
 *
 * Returns undefined when the body doesn't name one, in which case the caller
 * falls back to cooling only the model it called.
 */
function parseQuotaBucket(body: string): string | undefined {
  const match = body.match(/\bmodel:\s*([A-Za-z0-9.\-]+)/);
  return match?.[1];
}

// ---------------------------------------------------------------------------
// Drawing a picture
// ---------------------------------------------------------------------------

/** What `POST` returns for a message that asked for an image. */
interface ImageReply {
  filters: AiSearchFilters;
  image?: GeneratedImage;
  degraded?: AiSearchDegraded;
  servedBy?: string;
}

/**
 * Answers a "draw me…" message.
 *
 * The reply travels in the same envelope as every other answer — a `filters`
 * object with `category: "general"`, so the UI shows no record list — with the
 * picture attached alongside it. That keeps one response shape for the client
 * and means a failed generation degrades exactly like a failed question does.
 *
 * Both languages are written out here rather than routed through the i18n
 * dictionary because this is server-side prose in the assistant's own voice,
 * the way the rest of its answers are; the dictionary covers the UI chrome
 * around it.
 */
async function respondWithImage(
  request: ImageRequest,
  query: string,
  geminiKeys: string[],
  signal?: AbortSignal,
  preferredImageModel?: string
): Promise<ImageReply> {
  const khmer = isKhmerText(query);

  // Recognised as a request to draw, but with no subject — "generate an image"
  // and nothing else. Asking beats inventing something to draw.
  if (!request.prompt) {
    return {
      filters: generalAnswer(
        khmer
          ? "ខ្ញុំអាចបង្កើតរូបភាពបាន។ សូមប្រាប់ខ្ញុំថាចង់បានរូបភាពអ្វី — ឧទាហរណ៍ «បង្កើតរូបភាពម៉ាស៊ីនព្រីនធ័រនៅលើតុជាង»។"
          : "I can create an image — tell me what you'd like to see. For example: \"generate an image of a printer on a workbench\"."
      ),
    };
  }

  // No key check here: the keyless fallback inside `generateImage` means an
  // install with no Gemini key can still draw, so refusing up front would turn
  // a working request into an apology.
  const outcome = await generateImage(
    geminiKeys,
    request.prompt,
    Date.now() + IMAGE_BUDGET_MS,
    signal,
    preferredImageModel
  );

  if (outcome.ok) {
    return {
      filters: generalAnswer(
        khmer
          ? `នេះជារូបភាពដែលខ្ញុំបានបង្កើត៖ ${request.prompt}`
          : `Here's the image I created: ${request.prompt}`
      ),
      image: outcome.image,
      servedBy: outcome.image.label,
    };
  }

  // Reaching here means the keyless fallback failed too, so the reply is about
  // the whole feature being down rather than about Gemini. The billing detail
  // still travels in `degraded` — it explains the logs, but it is not what the
  // user needs to hear when the free path is what actually broke.
  if (outcome.reason === "quota" && outcome.freeTierUnavailable) {
    return {
      filters: generalAnswer(
        khmer
          ? "ខ្ញុំមិនអាចបង្កើតរូបភាពបាននៅពេលនេះទេ។ សូមព្យាយាមម្ដងទៀតក្នុងពេលបន្តិចទៀត។"
          : "I couldn't create that image just now — the image service didn't respond. Please try again in a moment."
      ),
      degraded: { reason: "imageNotOnFreeTier" },
    };
  }

  if (outcome.reason === "quota") {
    return {
      filters: generalAnswer(
        khmer
          ? "កូតាបង្កើតរូបភាពត្រូវបានប្រើអស់ហើយ។ សូមព្យាយាមម្ដងទៀតនៅពេលក្រោយ។"
          : "The image generation quota is spent for now. Please try again a little later."
      ),
      degraded: {
        reason: "imageQuotaExceeded",
        ...(outcome.retryAfterSeconds ? { retryAfterSeconds: outcome.retryAfterSeconds } : {}),
      },
    };
  }

  return {
    filters: generalAnswer(
      khmer
        ? "ខ្ញុំមិនអាចបង្កើតរូបភាពនេះបានទេនៅពេលនេះ។ សូមព្យាយាមម្ដងទៀត។"
        : "I couldn't create that image just now. Please try again."
    ),
    degraded: { reason: "imageUnavailable" },
  };
}

// ---------------------------------------------------------------------------
// Gemini
// ---------------------------------------------------------------------------

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}
interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

/**
 * Aborts a provider call at the budget rather than between calls — checking the
 * clock only between attempts lets one slow response overrun it by minutes.
 * Also honours the client's own signal, so a closed dropdown stops the work.
 */
function attemptSignal(deadline: number, base?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(Math.max(deadline - Date.now(), 1));
  return base ? AbortSignal.any([base, timeout]) : timeout;
}

/**
 * A `functionResponse.response` must be a JSON object (it maps to a protobuf
 * Struct), so scalars and arrays are wrapped rather than sent bare.
 */
function asStruct(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : { result: value };
}

/**
 * Runs the agent loop on one model.
 *
 * `contents` is owned by the caller and appended to in place, so when a model
 * runs out of quota part-way through, the next one picks the conversation up
 * where it stopped instead of starting again. Restarting used to mean re-asking
 * every question and re-running every tool call already paid for — the single
 * biggest source of slow answers once the leading models were spent.
 */
async function runGeminiAgent(
  model: string,
  apiKey: string,
  contents: GeminiContent[],
  ctx: ToolContext,
  deadline: number,
  systemPrompt: string = SYSTEM_PROMPT
): Promise<AiSearchFilters | null> {
  for (let round = 0; round < MAX_ROUNDS; round++) {
    if (Date.now() > deadline) return null;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: attemptSignal(deadline, ctx.signal),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents,
          tools: [{ functionDeclarations: geminiFunctionDeclarations() }],
          toolConfig: { functionCallingConfig: { mode: "AUTO" } },
          // Current Gemini models spend part of the output budget on internal
          // reasoning, so this has to leave room for both that and the answer.
          //
          // `thinkingLevel: "low"` is the single biggest speed lever here, and
          // it costs nothing in correctness for this workload: the reasoning is
          // "pick a tool, read the rows, summarise", not multi-step deduction.
          // Measured on `gemini-3.5-flash`, same tool-calling request: 6.7s
          // without it, 1.8s with. Accepted by every model in GEMINI_MODELS —
          // verified individually, because an unsupported value is a 400 that
          // this loop reports as a provider failure and silently falls past.
          // `"minimal"` is NOT accepted (400 on 3.7-flash); don't tighten it.
          generationConfig: {
            temperature: 0.2,
            thinkingConfig: { thinkingLevel: "low" },
            maxOutputTokens: 4096,
          },
        }),
      }
    );

    if (!res.ok) {
      // Signals the caller to try the next model in the list, carrying the
      // status and retry hint so an exhausted quota can be reported as such
      // rather than as a generic failure.
      const body = await res.text().catch(() => "");
      throw new ProviderError(
        `Gemini ${model} returned ${res.status}: ${body}`,
        res.status,
        parseRetryDelay(body, res.headers),
        parseQuotaBucket(body)
      );
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
    };
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const calls = parts.filter((p): p is GeminiPart & { functionCall: NonNullable<GeminiPart["functionCall"]> } =>
      Boolean(p.functionCall)
    );

    // No tool call means the model answered directly or finished its response
    if (calls.length === 0) {
      const text = cleanAnswer(parts.map((p) => p.text ?? "").join(""));
      if (text) {
        // If we ran tool calls in previous turns, link the category appropriately
        const executedTools = contents
          .filter((c) => c.role === "model")
          .flatMap((c) => c.parts)
          .map((p) => p.functionCall?.name)
          .filter(Boolean);

        let category: Category = "general";
        if (executedTools.includes("search_tickets") || executedTools.includes("count_tickets")) {
          category = "tickets";
        } else if (executedTools.includes("search_spare_parts")) {
          category = "spareParts";
        } else if (executedTools.includes("search_customers")) {
          category = "customers";
        } else if (executedTools.includes("search_items")) {
          category = "items";
        } else if (executedTools.includes("find_users")) {
          category = "users";
        }

        return {
          answer: text,
          category,
          searchTerm: "",
          status: null,
          listStatus: "All",
          fromDate: null,
          toDate: null,
          serviceType: null,
          serviceLocation: null,
          staffName: null,
          extras: {},
          navigateTo: null,
          actions: [],
          grounded: true,
        };
      }
      return null;
    }

    contents.push({ role: "model", parts });

    const finish = calls.find((c) => c.functionCall.name === "present_results");
    if (finish) {
      const args = finish.functionCall.args ?? {};
      // If the model wrote the textual answer in text parts alongside present_results
      if (!args.answer || (typeof args.answer === "string" && !args.answer.trim())) {
        const textPart = parts.find((p) => p.text && p.text.trim())?.text;
        if (textPart) args.answer = cleanAnswer(textPart);
      }
      return buildFilters(args, await ctx.getUsers());
    }

    const responses = await Promise.all(
      calls.map(async (call) => ({
        functionResponse: {
          name: call.functionCall.name,
          response: asStruct(await runTool(call.functionCall.name, call.functionCall.args ?? {}, ctx)),
        },
      }))
    );
    contents.push({ role: "user", parts: responses });
  }

  return null;
}

// ---------------------------------------------------------------------------
// Anthropic
// ---------------------------------------------------------------------------

async function runAnthropicAgent(
  apiKey: string,
  question: string,
  ctx: ToolContext,
  today: string,
  deadline: number,
  systemPrompt: string = SYSTEM_PROMPT
): Promise<AiSearchFilters | null> {
  const client = new Anthropic({ apiKey });
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: `Today is ${today}.\n\n${question}` },
  ];

  for (let round = 0; round < MAX_ROUNDS; round++) {
    if (Date.now() > deadline) return null;

    const response = await client.messages.create(
      {
        model: ANTHROPIC_MODEL,
        max_tokens: 4096,
        system: systemPrompt,
        // This runs behind a search box, and low effort is strong on Opus 5 —
        // the work here is lookup and summary, not deep reasoning.
        output_config: { effort: "low" },
        tools: anthropicTools(),
        messages,
      },
      { signal: attemptSignal(deadline, ctx.signal) }
    );

    if (response.stop_reason === "refusal") return null;

    const toolUses = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );

    if (toolUses.length === 0) {
      const text = cleanAnswer(
        response.content
          .filter((block): block is Anthropic.TextBlock => block.type === "text")
          .map((block) => block.text)
          .join("")
      );
      return text ? generalAnswer(text) : null;
    }

    messages.push({ role: "assistant", content: response.content });

    const finish = toolUses.find((block) => block.name === "present_results");
    if (finish) {
      return buildFilters(finish.input as Record<string, unknown>, await ctx.getUsers());
    }

    const results: Anthropic.ToolResultBlockParam[] = await Promise.all(
      toolUses.map(async (block) => ({
        type: "tool_result" as const,
        tool_use_id: block.id,
        content: JSON.stringify(await runTool(block.name, block.input as Record<string, unknown>, ctx)),
      }))
    );
    messages.push({ role: "user", content: results });
  }

  return null;
}

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  // The assistant is read-only against the data, so this is activity rather
  // than a write — but a question in flight can run for up to 60s (see
  // `maxDuration`), and restarting under one loses the user their answer.
  recordRequest();

  let query = "";
  let preferredModel: string | undefined;
  let preferredImageModel: string | undefined;
  let history: Array<{ role: string; text: string }> = [];
  try {
    const body = await req.json();
    query = typeof body?.query === "string" ? body.query.trim() : "";
    // Optional: the user picked a specific model in the panel.
    preferredModel = typeof body?.model === "string" ? body.model : undefined;
    // Carried separately from `model` because the two lists are not
    // interchangeable — see the `imageModels` note on `GET`.
    preferredImageModel = typeof body?.imageModel === "string" ? body.imageModel : undefined;
    // Earlier turns, so "what about last month?" resolves against what was
    // just discussed instead of being answered as a standalone question.
    history = Array.isArray(body?.history) ? body.history.slice(-MAX_HISTORY_TURNS) : [];
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  if (query.length < 2) {
    return NextResponse.json({ error: "Query is too short." }, { status: 400 });
  }
  if (query.length > MAX_QUERY_CHARS) query = query.slice(0, MAX_QUERY_CHARS);

  const geminiKeys = getGeminiKeys();
  const anthropicKey = getAnthropicKey();

  // Checked before the "no provider configured" gate below, not after: drawing
  // has a keyless fallback, so an install with no API key at all can still
  // answer a "draw me…" message even though it cannot answer a question.
  const imageRequest = detectImageRequest(query);
  if (imageRequest) {
    return NextResponse.json(
      await respondWithImage(imageRequest, query, geminiKeys, req.signal, preferredImageModel)
    );
  }

  if (geminiKeys.length === 0 && !anthropicKey) {
    return NextResponse.json({
      filters: plainSearch(query),
      degraded: { reason: "notConfigured" } satisfies AiSearchDegraded,
    });
  }

  // The caller's own token is forwarded to every backend read, so the
  // assistant can never surface a row this user couldn't already open — which
  // only holds if there IS one. Answering an unauthenticated question used to
  // fall back to a hardcoded admin login inside `backend.ts`, so the guarantee
  // was decorative; the gate is what makes it real. Checked after the image
  // branch above, which reads no workshop data and needs no identity.
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    // 401 rather than a 200 degradation, because unlike a spent quota this is a
    // refusal to act, and the browser/proxy layers should be able to see it as
    // one. The envelope is still the normal shape so the panel can explain it.
    return NextResponse.json(
      {
        filters: plainSearch(query),
        degraded: { reason: "notSignedIn" } satisfies AiSearchDegraded,
      },
      { status: 401 }
    );
  }

  let usersPromise: Promise<UserRecord[]> | null = null;
  const ctx: ToolContext = {
    authorization,
    signal: req.signal,
    getUsers: () => (usersPromise ??= loadUsers(authorization, req.signal)),
  };

  const users = await ctx.getUsers();
  const parsedUser = parseJwtUser(authorization);
  let activeUser: UserRecord | undefined;
  if (parsedUser) {
    activeUser = users.find(
      (u) =>
        (parsedUser.id && u.id.toLowerCase() === parsedUser.id.toLowerCase()) ||
        (parsedUser.userName && u.userName.toLowerCase() === parsedUser.userName.toLowerCase()) ||
        (parsedUser.email && u.email.toLowerCase() === parsedUser.email.toLowerCase())
    );
    if (!activeUser && (parsedUser.userName || parsedUser.id)) {
      activeUser = {
        id: parsedUser.id || "user",
        userName: parsedUser.userName || "admin",
        fullName: parsedUser.userName || "admin",
        email: parsedUser.email || "",
        roles: ["User"],
      };
    }
  }
  // No guessing past this point. This used to fall back to the `admin` account
  // (or simply the first row of the directory) when the token's claims didn't
  // match anyone, so "who am I?" could answer with a stranger's name and roles
  // — stated with the same confidence as a real lookup. An unidentifiable
  // caller now gets no identity block at all, and the model says it doesn't
  // know rather than naming the wrong person.

  const userContextPrompt = activeUser
    ? `\n\nCURRENT LOGGED-IN USER IDENTITY:
- Full Name: ${activeUser.fullName}
- Username: ${activeUser.userName}
- Email: ${activeUser.email || "N/A"}
- Roles: ${activeUser.roles.join(", ") || "User"}

When the user asks "who am I", "what is my name", "what is my username", "តើខ្ញុំមានឈ្មោះអ្វី", "ខ្ញុំមាន User ជាអ្វី", or similar questions, answer them directly using this identity.`
    : `\n\nCURRENT LOGGED-IN USER IDENTITY: could not be resolved from this session's token.

If the user asks who they are, say plainly that you cannot confirm which account they are signed in as, and suggest they check the profile menu in the header. Do not name a user, a role or an account from the directory as if it were theirs — a confident wrong name is worse than admitting you cannot tell.`;

  const effectiveSystemPrompt = `${SYSTEM_PROMPT}${userContextPrompt}`;

  const today = new Date().toISOString().slice(0, 10);
  const deadline = Date.now() + AGENT_BUDGET_MS;

  // Remembered across the whole model list so the user can be told *why* the
  // assistant didn't answer. A quota wait is worth reporting; a one-off 503 on
  // a model we then fell past is not, so quota outranks a generic failure.
  let degraded: AiSearchDegraded | undefined;
  const noteFailure = (err: unknown) => {
    if (err instanceof ProviderError && err.status === 429) {
      const seconds = err.retryAfterSeconds;
      // Keep the longest wait seen: every model must clear before the
      // assistant can run again, so the shortest one would be a false promise.
      if (
        degraded?.reason !== "quotaExceeded" ||
        (seconds ?? 0) > (degraded.retryAfterSeconds ?? 0)
      ) {
        degraded = { reason: "quotaExceeded", retryAfterSeconds: seconds };
      }
    } else if (!degraded) {
      degraded = { reason: "unavailable" };
    }
  };

  if (geminiKeys.length > 0) {
    // Built once and carried across model attempts, so a model that runs out
    // of quota mid-question hands its progress to the next one.
    const contents: GeminiContent[] = [
      // Prior turns as plain text, before the new question. Tool calls from
      // those turns are deliberately not replayed — the answers they produced
      // are already in the text, and re-sending the call/response pairs would
      // multiply the request for no extra meaning.
      ...history.flatMap((turn): GeminiContent[] => {
        const text = typeof turn?.text === "string" ? turn.text.slice(0, MAX_HISTORY_CHARS) : "";
        if (!text.trim()) return [];
        return [{ role: turn.role === "assistant" ? "model" : "user", parts: [{ text }] }];
      }),
      { role: "user", parts: [{ text: `Today is ${today}.\n\n${query}` }] },
    ];

    // Models outside, keys inside. Quota is per model *per key*, so a spent
    // model on one key may be untouched on the next — exhausting every key on
    // the strongest model before stepping down keeps quality as high as the
    // budget allows. The reverse nesting would drop to a weaker model while a
    // second key still had the better one available.
    const exhausted = false;
    for (const model of orderedModels(geminiKeys.length, preferredModel)) {
      if (exhausted || Date.now() > deadline) break;

      for (const keyIndex of readyKeysFor(model, geminiKeys.length)) {
        if (Date.now() > deadline) break;
        try {
          const filters = await runGeminiAgent(
            model,
            geminiKeys[keyIndex],
            contents,
            ctx,
            deadline,
            effectiveSystemPrompt
          );
          clearRateLimit(keyIndex, model);
          // `servedBy` lets the panel show which model actually answered, which
          // differs from the chosen one whenever a fallback stepped in.
          // `requestedModel` is sent only when those differ, so the panel can
          // say the choice was overridden instead of leaving the picker's
          // checkmark implying it was honoured. Which *key* served it is
          // deliberately not reported — that is an infrastructure detail, and
          // naming it in a response is a step towards leaking one.
          if (filters) {
            return NextResponse.json({
              filters,
              servedBy: modelLabel(model),
              ...(preferredModel && preferredModel !== model
                ? { requestedModel: modelLabel(preferredModel) }
                : {}),
            });
          }
          // If the model produced no usable filters, log and try the next model in rotation
          console.warn(`[ai-search] ${model} on key #${keyIndex + 1} produced no filters, falling back to next candidate.`);
        } catch (err) {
          console.warn(`[ai-search] ${model} failed on key #${keyIndex + 1}, trying next:`, err);
          if (err instanceof ProviderError) {
            if (err.status === 429) noteRateLimit(keyIndex, model, err.quotaBucket);
            // 404 is permanent for this project, unlike a quota or busy signal.
            else if (err.status === 404) noteRetired(keyIndex, model);
          }
          noteFailure(err);
        }
      }
    }
  }

  if (anthropicKey) {
    try {
      const filters = await runAnthropicAgent(anthropicKey, query, ctx, today, deadline, effectiveSystemPrompt);
      if (filters) return NextResponse.json({ filters });
    } catch (err) {
      console.warn("[ai-search] Anthropic call failed:", err);
      noteFailure(err);
    }
  }

  return NextResponse.json({
    filters: plainSearch(query),
    degraded: degraded ?? { reason: "unavailable" },
  });
}
