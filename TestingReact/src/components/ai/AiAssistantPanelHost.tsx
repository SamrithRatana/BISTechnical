"use client";

/**
 * @file ai/AiAssistantPanelHost.tsx
 * @description Mount point that keeps `AiAssistantPanel` out of the shared bundle.
 *
 * The panel is mounted by `app/layout.tsx`, so importing it statically put its
 * ~490 lines — plus its lucide icon set and `react-hot-toast` — into the chunk
 * that every one of the 55 routes downloads before it can paint. The panel
 * itself renders nothing until `ai.open` is true, so none of that weight is on
 * the path to a first paint on any route.
 *
 * This wrapper exists because `app/layout.tsx` is a server component and
 * `ssr: false` is only legal from a client one.
 *
 * ── Why it renders nothing until the panel has been opened ──────────────────
 *
 * Rendering the dynamic component unconditionally is a hydration mismatch, and
 * a measured one rather than a theoretical one: `ssr: false` makes the server
 * emit no markup here at all, while the client immediately renders a
 * `<Suspense>` boundary. React then finds the Toaster's `<div>` where it
 * expected that boundary and regenerates the tree —
 * "Hydration failed because the server rendered HTML didn't match the client",
 * which was reproduced in the browser against this exact file.
 *
 * Gating on `open` removes the mismatch by construction: the server renders
 * null, the first client render also renders null (the assistant starts
 * closed), and the dynamic component only ever mounts later, in response to a
 * click — long after hydration. It also means the chunk is not requested at
 * all until someone actually opens the assistant.
 *
 * `hasOpened` latches rather than tracking `open` directly, so closing the
 * panel does not unmount it and discard a half-typed message.
 */

import { useState } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import LazyMountBoundary from "@/components/LazyMountBoundary";
import { useAiAssistant } from "./AiAssistantProvider";

/**
 * Something has to be on screen while the chunk downloads.
 *
 * `AiLauncher` returns null as soon as `open` is true, so between the click and
 * the panel arriving there would otherwise be nothing at all — no panel, and no
 * launcher left to click again. On a cold cache over a slow link that reads as
 * a dead button (§12: every screen needs a loading state).
 */
const AiAssistantPanel = dynamic(() => import("./AiAssistantPanel"), {
  ssr: false,
  loading: () => (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-[1200] flex items-center gap-2 rounded-2xl border border-subtle bg-surface px-4 py-3 shadow-soft-lg"
    >
      <Loader2 className="h-4 w-4 animate-spin text-accent" />
      <span className="text-xs font-semibold text-ink-secondary">…</span>
    </div>
  ),
});

export default function AiAssistantPanelHost() {
  const ai = useAiAssistant();
  const open = ai?.open ?? false;

  // Adjusting state during render — React's documented pattern for deriving
  // from a prop/context change. Deliberately not a `useEffect`: an effect would
  // add a second render pass and trip this project's `set-state-in-effect`
  // rule, which it already carries four unresolved instances of.
  const [hasOpened, setHasOpened] = useState(false);
  if (open && !hasOpened) setHasOpened(true);

  if (!hasOpened) return null;
  return (
    <LazyMountBoundary label="AI assistant panel">
      <AiAssistantPanel />
    </LazyMountBoundary>
  );
}
