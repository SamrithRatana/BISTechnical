"use client";

/**
 * @file ai/AiAssistantProvider.tsx
 * @description Owns the assistant conversation, so every surface that opens it
 * shares one state.
 *
 * This used to live inside `GlobalSearch`, which meant the assistant was a mode
 * of the header search box: its answer rendered in the results dropdown, and
 * nothing outside that component could open it. That produced the duplicated
 * answer — the same reply in the dropdown and again in the drawer — and left
 * the floating launcher with no way to reach the conversation.
 *
 * Lifting it here makes the conversation the thing, and the launcher, the
 * header toggle and the panel all views onto it.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { useActionBus, useActionHandler } from "@/components/ActionBus";
import type { SmartQueryResult, SmartQueryDegraded } from "@/services/smartQuery";

/** One entry in the model picker, as reported by `GET /api/ai-search`. */
export interface ModelStatus {
  id: string;
  label: string;
  available: boolean;
  retryInSeconds: number;
}

/** A picture the assistant drew, returned inline as a data URL. */
export interface GeneratedImage {
  dataUrl: string;
  mimeType: string;
  model: string;
  label: string;
  prompt: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  at: number;
  /**
   * Set only on a turn that asked for a picture. Held in memory for the life of
   * the conversation and never sent back up with `history` — the bytes are
   * large, and the prompt already carries everything a follow-up needs.
   */
  image?: GeneratedImage | null;
  /** Assistant turns only: what the reply was grounded in, for the badges. */
  filters?: SmartQueryResult | null;
  degraded?: SmartQueryDegraded | null;
  servedBy?: string | null;
  /**
   * The model the user picked, when it wasn't the one that answered. Set only
   * on a substitution, so the panel can say the choice was overridden — the
   * picker's checkmark otherwise implies it was honoured.
   */
  requestedModel?: string | null;
}

/**
 * How many earlier turns ride along with a question.
 *
 * A chat that can't follow "what about last month?" is a chat in appearance
 * only, so prior turns are sent. Bounded because they are re-sent every time
 * and each one is billed again — six turns is enough for the follow-ups people
 * actually ask without the request growing without limit.
 */
const HISTORY_TURNS = 6;

/**
 * How long the panel waits for `/api/ai-search` before giving up.
 *
 * Above every server-side budget (`AGENT_BUDGET_MS` 50s, `IMAGE_BUDGET_MS`
 * 55s, the route's `maxDuration` 60s), so this only ever fires when the
 * response is genuinely not coming — not when a slow model is still working.
 */
const ASK_TIMEOUT_MS = 70_000;

interface AiAssistantValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  messages: ChatMessage[];
  loading: boolean;
  ask: (question: string) => void;
  clear: () => void;
  models: ModelStatus[];
  selectedModel: string;
  setSelectedModel: (id: string) => void;
  /**
   * The picture models, kept apart from `models` because they answer different
   * messages — an image model can't run a ticket lookup, so one selection must
   * never stand in for the other.
   */
  imageModels: ModelStatus[];
  selectedImageModel: string;
  setSelectedImageModel: (id: string) => void;
  refreshModels: () => void;
  /** Live countdown while the free tier is rate-limited, else null. */
  quotaWait: number | null;
}

const AiAssistantContext = createContext<AiAssistantValue | null>(null);

export function useAiAssistant(): AiAssistantValue | null {
  return useContext(AiAssistantContext);
}

let messageSeq = 0;
const nextId = () => `m${++messageSeq}`;

export function AiAssistantProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const actionBus = useActionBus();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  /**
   * `ask` reads the transcript and the current route, but only at the moment it
   * is called — never during render. Listing them as dependencies gave `ask` a
   * new identity on every message AND every navigation, which changed the
   * context value, which re-rendered every consumer: `GlobalSearch` (in the
   * header of every page), `AiLauncher`, and the panel. A route change costing
   * a re-render of the header's search box is a cost with nothing to show for
   * it.
   *
   * Refs are written in an effect rather than during render: a render can be
   * discarded and replayed, and this project already treats a render-time ref
   * write as a bug (`react-hooks/refs`). `ask` only ever runs from a user
   * event, long after effects have flushed, so it never sees a stale value.
   */
  const messagesRef = useRef<ChatMessage[]>(messages);
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);
  const [models, setModels] = useState<ModelStatus[]>([]);
  const [selectedModel, setSelectedModelState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("beta_ai_model") || localStorage.getItem("beauramei_ai_model") || "gemini-3.5-flash-lite";
    }
    return "gemini-3.5-flash-lite";
  });
  const setSelectedModel = useCallback((modelId: string) => {
    setSelectedModelState(modelId);
    if (typeof window !== "undefined") {
      if (modelId) {
        localStorage.setItem("beta_ai_model", modelId);
      } else {
        localStorage.removeItem("beta_ai_model");
      }
    }
  }, []);
  const [imageModels, setImageModels] = useState<ModelStatus[]>([]);
  const [selectedImageModel, setSelectedImageModel] = useState("");
  const [quotaWait, setQuotaWait] = useState<number | null>(null);

  const refreshModels = useCallback(() => {
    void (async () => {
      try {
        const res = await fetch("/api/ai-search");
        if (!res.ok) return;
        const data = await res.json();
        setModels(Array.isArray(data.models) ? (data.models as ModelStatus[]) : []);
        setImageModels(Array.isArray(data.imageModels) ? (data.imageModels as ModelStatus[]) : []);
      } catch {
        // Availability is a convenience; failing to read it just hides the list.
      }
    })();
  }, []);

  // Cancels a question that has been superseded or abandoned. Without this a
  // 40-second call outlives the panel and its stale answer lands later.
  const requestRef = useRef<AbortController | null>(null);
  useEffect(() => () => requestRef.current?.abort(), []);

  const ask = useCallback(
    (question: string) => {
      const text = question.trim();
      if (!text || text.length < 2) return;

      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;

      /*
        Client-side ceiling on the wait.

        The route already bounds its own work — `AGENT_BUDGET_MS` 50s,
        `IMAGE_BUDGET_MS` 55s, `maxDuration` 60s — so in normal operation it
        always answers. What this catches is the case where the *response*
        never arrives at all: the dev server restarting mid-question, a
        connection dropped after the request went out, a proxy holding it open.
        `fetch` never rejects for those, so `loading` stayed true and the
        panel's typing indicator ran until the page was reloaded.

        70s sits above every server-side budget on purpose. Firing earlier
        would abort answers the route was still legitimately producing — the
        slowest model in the rotation measured 21-45s per round.

        `timedOut` distinguishes this abort from a real cancellation: the catch
        below returns silently on `AbortError`, which is right when a newer
        question superseded this one and wrong when nothing is coming back.
      */
      let timedOut = false;
      const timeoutId = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, ASK_TIMEOUT_MS);

      const history = messagesRef.current.slice(-HISTORY_TURNS).map((m) => ({
        role: m.role,
        text: m.text,
      }));

      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: "user", text, at: Date.now() },
      ]);
      setLoading(true);
      setOpen(true);

      void (async () => {
        try {
          const token =
            typeof window !== "undefined" ? localStorage.getItem("jwt_token") : null;
          const res = await fetch("/api/ai-search", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              query: text,
              ...(selectedModel ? { model: selectedModel } : {}),
              ...(selectedImageModel ? { imageModel: selectedImageModel } : {}),
              ...(history.length ? { history } : {}),
            }),
            signal: controller.signal,
          });
          // 401 is the one non-OK status that carries a real explanation: the
          // route refuses to read the workshop's data without the caller's own
          // token. Throwing it into the generic catch would tell the user the
          // AI is broken, when what they need to do is sign in again.
          if (!res.ok && res.status !== 401) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();

          const filters = data.filters as SmartQueryResult;
          const degraded = (data.degraded ?? null) as SmartQueryDegraded | null;

          setMessages((prev) => [
            ...prev,
            {
              id: nextId(),
              role: "assistant",
              // A degraded answer has no text; the footer explains why.
              text: filters?.grounded ? filters.answer : "",
              at: Date.now(),
              image: (data.image ?? null) as GeneratedImage | null,
              filters,
              degraded,
              servedBy: typeof data.servedBy === "string" ? data.servedBy : null,
              requestedModel:
                typeof data.requestedModel === "string" ? data.requestedModel : null,
            },
          ]);
          // Both quota reasons carry a real wait worth counting down. The
          // image *billing* reason deliberately does not — there is no wait
          // that ends it, so a ticking clock would promise one that never
          // arrives.
          // A *daily* exhaustion deliberately gets no countdown: it is hours
          // away, and a second-by-second tick toward tomorrow morning reads as
          // a bug. The bubble says "resets tomorrow" instead.
          setQuotaWait(
            (degraded?.reason === "quotaExceeded" && degraded.quotaScope !== "day") ||
              degraded?.reason === "imageQuotaExceeded"
              ? degraded.retryAfterSeconds ?? null
              : null
          );
          refreshModels();

          // Perform the interface steps the assistant asked for, in order.
          // They are queued before the navigation below rather than after: the
          // bus holds a request until a handler takes it, so a dialog on a page
          // that hasn't mounted yet is opened as soon as it does — whereas
          // firing them after the route change would race the mount.
          const steps = filters?.actions ?? [];
          if (steps.length > 0) {
            actionBus?.request(
              steps.map((step) => ({
                id: step.id,
                recordRef: step.recordRef ?? undefined,
                values: step.values ?? undefined,
              }))
            );
          }
          const nav = filters?.navigateTo;
          if (nav) {
            const term = filters.searchTerm?.trim() ?? "";
            const href = term ? `${nav.route}?q=${encodeURIComponent(term)}` : nav.route;
            if (pathnameRef.current !== nav.route) router.push(href);
          }
        } catch (err) {
          // A superseded question isn't a failure — its replacement owns the
          // conversation now. A TIMED-OUT one is: nothing is coming back, and
          // returning silently here would leave the user looking at their own
          // question with no reply and no explanation.
          if ((err as Error)?.name === "AbortError" && !timedOut) return;
          setMessages((prev) => [
            ...prev,
            {
              id: nextId(),
              role: "assistant",
              text: "",
              at: Date.now(),
              filters: null,
              degraded: { reason: "unavailable" },
            },
          ]);
        } finally {
          clearTimeout(timeoutId);
          if (requestRef.current === controller) setLoading(false);
        }
      })();
    },
    [selectedModel, selectedImageModel, refreshModels, actionBus, router]
  );

  // The panel covers the page it just acted on, so "get out of the way" has to
  // be something the assistant can do itself. Registered here because this is
  // where the panel's open state lives.
  useActionHandler("ui.assistant.close", () => {
    setOpen(false);
    return true;
  });

  const clear = useCallback(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    setMessages([]);
    setQuotaWait(null);
    setLoading(false);
  }, []);

  // Ticks the quota wait down so the notice stays honest as it elapses.
  const counting = quotaWait !== null;
  useEffect(() => {
    if (!counting) return;
    const id = setInterval(
      () => setQuotaWait((s) => (s === null || s <= 1 ? null : s - 1)),
      1000
    );
    return () => clearInterval(id);
  }, [counting]);

  const value = useMemo(
    () => ({
      open,
      setOpen,
      messages,
      loading,
      ask,
      clear,
      models,
      selectedModel,
      setSelectedModel,
      imageModels,
      selectedImageModel,
      setSelectedImageModel,
      refreshModels,
      quotaWait,
    }),
    [
      open,
      messages,
      loading,
      ask,
      clear,
      models,
      selectedModel,
      imageModels,
      selectedImageModel,
      refreshModels,
      quotaWait,
    ]
  );

  return <AiAssistantContext.Provider value={value}>{children}</AiAssistantContext.Provider>;
}
